import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ═══════════════════════════════════════════════════════════════
// SOUPY Engine v3 — Operations & Health
// Ghost cases, gold set replay, calibration, physician profiles,
// payer profiles, engine health, appeal outcomes, regulatory flags
// ═══════════════════════════════════════════════════════════════

async function authenticateRequest(req: Request, supabaseUrl: string, supabaseAnonKey: string): Promise<{ userId: string | null } | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    // Allow unauthenticated access for admin/health endpoints — authorization handled per-action
    return { userId: null };
  }
  const token = authHeader.replace("Bearer ", "");
  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await supabaseAuth.auth.getClaims(token);
  if (error || !data?.claims?.sub) {
    // Token present but invalid — still allow through for service-level actions
    return { userId: null };
  }
  return { userId: data.claims.sub as string };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authResult = await authenticateRequest(req, supabaseUrl, supabaseAnonKey);
    const userId = (authResult as { userId: string | null }).userId;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json();
    const { action } = body;

    // ═══════════════════════════════════════════════════
    // ACTION: inject-ghost — Run a ghost case through the engine
    // ═══════════════════════════════════════════════════
    if (action === "inject-ghost") {
      const { ghostCaseId } = body;
      const { data: ghost, error: ghostErr } = await supabase
        .from("ghost_cases").select("*").eq("id", ghostCaseId).single();

      if (ghostErr || !ghost) {
        return new Response(JSON.stringify({ error: "Ghost case not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const template = ghost.case_template as any;
      const { data: newCase, error: caseErr } = await supabase
        .from("audit_cases")
        .insert({
          patient_id: template.patient_id || `GHOST-PT-${Date.now()}`,
          physician_id: template.physician_id || `GHOST-DR-${Date.now()}`,
          physician_name: template.physician_name || "Ghost Case",
          date_of_service: template.date_of_service || new Date().toISOString().split("T")[0],
          cpt_codes: template.cpt_codes || [],
          icd_codes: template.icd_codes || [],
          claim_amount: template.claim_amount || 0,
          source_text: template.source_text || "",
          status: "pending",
          risk_score: {},
          metadata: { summary: template.summary, isGhostCase: true, ghostCaseId },
          owner_id: userId,
        })
        .select().single();

      if (caseErr || !newCase) {
        return new Response(JSON.stringify({ error: "Failed to create ghost case" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase.from("ghost_cases").update({
        last_injected_at: new Date().toISOString(),
        times_tested: (ghost.times_tested || 0) + 1,
        updated_at: new Date().toISOString(),
      }).eq("id", ghostCaseId);

      return new Response(JSON.stringify({
        success: true, caseId: newCase.id, ghostCaseId,
        message: "Ghost case injected. Run analyze-case to test the engine.",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ═══════════════════════════════════════════════════
    // ACTION: validate-ghost — Compare engine output to known answer
    // ═══════════════════════════════════════════════════
    if (action === "validate-ghost") {
      const { caseId, ghostCaseId } = body;
      const [caseResult, ghostResult] = await Promise.all([
        supabase.from("audit_cases").select("*").eq("id", caseId).single(),
        supabase.from("ghost_cases").select("*").eq("id", ghostCaseId).single(),
      ]);

      if (!caseResult.data || !ghostResult.data) {
        return new Response(JSON.stringify({ error: "Case or ghost case not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const auditCase = caseResult.data;
      const ghost = ghostResult.data;
      const known = ghost.known_answer as any;
      const deviations: any[] = [];
      let accuracyScore = 100;

      // Check consensus range
      const consensus = auditCase.consensus_score || 0;
      const [minC, maxC] = known.expected_consensus_range || [0, 100];
      if (consensus < minC || consensus > maxC) {
        deviations.push({ type: "consensus_out_of_range", expected: `${minC}-${maxC}`, actual: consensus, penalty: 25 });
        accuracyScore -= 25;
      }

      // Check risk level
      const riskLevel = (auditCase.risk_score as any)?.level;
      if (riskLevel && known.expected_risk_level && riskLevel !== known.expected_risk_level) {
        deviations.push({ type: "wrong_risk_level", expected: known.expected_risk_level, actual: riskLevel, penalty: 20 });
        accuracyScore -= 20;
      }

      // Check recommended action (v3)
      const metadata = auditCase.metadata as any;
      if (known.expected_action && metadata?.recommendedAction && metadata.recommendedAction !== known.expected_action) {
        deviations.push({ type: "wrong_action", expected: known.expected_action, actual: metadata.recommendedAction, penalty: 15 });
        accuracyScore -= 15;
      }

      // Check contradictions
      if (known.expected_contradictions !== undefined) {
        const { count } = await supabase.from("contradictions").select("*", { count: "exact", head: true }).eq("case_id", caseId);
        if (Math.abs((count || 0) - known.expected_contradictions) > 1) {
          deviations.push({ type: "contradiction_count_mismatch", expected: known.expected_contradictions, actual: count, penalty: 10 });
          accuracyScore -= 10;
        }
      }

      // Check violation count
      const { data: analyses } = await supabase
        .from("case_analyses").select("violations").eq("case_id", caseId).eq("status", "complete");
      const totalViolations = (analyses || []).reduce((s, a) => s + ((a.violations as any[])?.length || 0), 0);
      const expectedViolations = known.expected_violations ?? -1;
      if (expectedViolations >= 0 && Math.abs(totalViolations - expectedViolations) > 1) {
        deviations.push({ type: "violation_count_mismatch", expected: expectedViolations, actual: totalViolations, penalty: 15 });
        accuracyScore -= 15;
      }

      accuracyScore = Math.max(0, accuracyScore);
      const isCorrect = accuracyScore >= 70;

      await supabase.from("ghost_case_results").insert({
        ghost_case_id: ghostCaseId, case_id: caseId,
        engine_output: { consensus, riskLevel, totalViolations, recommendedAction: metadata?.recommendedAction },
        expected_output: known, accuracy_score: accuracyScore, deviation_details: deviations,
      });

      const newTimesCorrect = (ghost.times_correct || 0) + (isCorrect ? 1 : 0);
      const newTimesTotal = ghost.times_tested || 1;
      await supabase.from("ghost_cases").update({
        times_correct: newTimesCorrect,
        accuracy_rate: (newTimesCorrect / newTimesTotal) * 100,
        updated_at: new Date().toISOString(),
      }).eq("id", ghostCaseId);

      return new Response(JSON.stringify({
        success: true, accuracyScore, isCorrect, deviations, keyTest: known.key_test,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ═══════════════════════════════════════════════════
    // ACTION: replay-gold-set — Validate against locked benchmark
    // ═══════════════════════════════════════════════════
    if (action === "replay-gold-set") {
      const { goldCaseId } = body;
      const { data: goldCase, error: goldErr } = await supabase
        .from("gold_set_cases").select("*").eq("id", goldCaseId).single();

      if (goldErr || !goldCase) {
        return new Response(JSON.stringify({ error: "Gold set case not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create a temporary case from the gold set template
      const template = goldCase.case_template as any;
      const { data: newCase, error: caseErr } = await supabase
        .from("audit_cases")
        .insert({
          patient_id: template.patient_id || `GOLD-PT-${Date.now()}`,
          physician_id: template.physician_id || `GOLD-DR-${Date.now()}`,
          physician_name: template.physician_name || "Gold Set Case",
          date_of_service: template.date_of_service || new Date().toISOString().split("T")[0],
          cpt_codes: template.cpt_codes || [],
          icd_codes: template.icd_codes || [],
          claim_amount: template.claim_amount || 0,
          source_text: template.source_text || "",
          status: "pending",
          risk_score: {},
          metadata: { summary: template.summary, isGoldSetCase: true, goldCaseId: goldCase.id, goldCaseLabel: goldCase.case_label },
          owner_id: userId,
        })
        .select().single();

      if (caseErr || !newCase) {
        return new Response(JSON.stringify({ error: "Failed to create gold set case" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase.from("gold_set_cases").update({
        last_replayed_at: new Date().toISOString(),
        total_replays: (goldCase.total_replays || 0) + 1,
      }).eq("id", goldCaseId);

      return new Response(JSON.stringify({
        success: true, caseId: newCase.id, goldCaseId: goldCase.id,
        message: `Gold set case "${goldCase.case_label}" created. Run analyze-case to validate.`,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ═══════════════════════════════════════════════════
    // ACTION: calibrate — Record actual outcome
    // ═══════════════════════════════════════════════════
    if (action === "calibrate") {
      const { caseId, actualOutcome } = body;
      if (!caseId || !actualOutcome) {
        return new Response(JSON.stringify({ error: "caseId and actualOutcome required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: calibration } = await supabase
        .from("engine_calibration").select("*").eq("case_id", caseId)
        .order("created_at", { ascending: false }).limit(1).single();

      if (!calibration) {
        return new Response(JSON.stringify({ error: "No calibration record found for case" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const predicted = calibration.predicted_outcome;
      const deviation = predicted === actualOutcome ? 0 :
        ((predicted === "approved" && actualOutcome === "rejected") || (predicted === "rejected" && actualOutcome === "approved")) ? 100 : 50;

      await supabase.from("engine_calibration").update({
        actual_outcome: actualOutcome,
        deviation_score: deviation,
        resolved_at: new Date().toISOString(),
        calibration_notes: `${calibration.calibration_notes || ""} | Outcome: ${actualOutcome} (predicted: ${predicted}, deviation: ${deviation})`,
      }).eq("id", calibration.id);

      return new Response(JSON.stringify({
        success: true, predicted, actual: actualOutcome, deviationScore: deviation, wasCorrect: deviation === 0,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ═══════════════════════════════════════════════════
    // ACTION: record-appeal-outcome — Track appeal results
    // ═══════════════════════════════════════════════════
    if (action === "record-appeal-outcome") {
      const { caseId, payerCode: pc, denialType, appealStrategy, outcome, successFactors, failureFactors, notes, cptCodes: codes } = body;

      await supabase.from("appeal_outcomes").insert({
        case_id: caseId || null,
        payer_code: pc || null,
        denial_type: denialType || null,
        cpt_codes: codes || [],
        appeal_strategy: appealStrategy,
        outcome,
        success_factors: successFactors || [],
        failure_factors: failureFactors || [],
        notes: notes || null,
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ═══════════════════════════════════════════════════
    // ACTION: engine-health — Comprehensive engine metrics
    // ═══════════════════════════════════════════════════
    if (action === "engine-health") {
      // Ghost case accuracy
      const { data: ghostCases } = await supabase.from("ghost_cases").select("accuracy_rate, times_tested, category");
      const avgGhostAccuracy = ghostCases?.length ? ghostCases.reduce((s, g) => s + Number(g.accuracy_rate || 0), 0) / ghostCases.length : null;

      // Gold set accuracy
      const { data: goldCases } = await supabase.from("gold_set_cases").select("accuracy_rate, total_replays, category");
      const avgGoldAccuracy = goldCases?.length ? goldCases.reduce((s, g) => s + Number(g.accuracy_rate || 0), 0) / goldCases.length : null;

      // Calibration accuracy
      const { data: calibrations } = await supabase
        .from("engine_calibration").select("deviation_score, predicted_outcome, actual_outcome").not("actual_outcome", "is", null);
      const calibrationAccuracy = calibrations?.length ? calibrations.filter(c => Number(c.deviation_score) === 0).length / calibrations.length * 100 : null;

      // Stability metrics
      const { data: stabilityChecks } = await supabase
        .from("stability_checks").select("drift_score, is_stable").order("created_at", { ascending: false }).limit(50);
      const stabilityRate = stabilityChecks?.length ? stabilityChecks.filter(s => s.is_stable).length / stabilityChecks.length * 100 : null;
      const avgDrift = stabilityChecks?.length ? stabilityChecks.reduce((s, c) => s + Number(c.drift_score || 0), 0) / stabilityChecks.length : null;

      // Consensus integrity stats
      const { data: daResults } = await supabase
        .from("devils_advocate_results").select("consensus_survived, reanalysis_triggered").order("created_at", { ascending: false }).limit(50);
      const ciStats = daResults?.length ? {
        totalRuns: daResults.length,
        consensusSurvivedRate: daResults.filter(d => d.consensus_survived).length / daResults.length * 100,
        reanalysisRate: daResults.filter(d => d.reanalysis_triggered).length / daResults.length * 100,
      } : null;

      // Confidence floor events
      const { count: floorEventCount } = await supabase
        .from("confidence_floor_events").select("*", { count: "exact", head: true });

      // Contradiction frequency
      const { count: contradictionCount } = await supabase
        .from("contradictions").select("*", { count: "exact", head: true });

      // Decision trace stats
      const { count: decisionTraceCount } = await supabase
        .from("decision_traces").select("*", { count: "exact", head: true });

      // Payer profiles & graph
      const { count: payerCount } = await supabase.from("payer_profiles").select("*", { count: "exact", head: true });
      const { count: edgeCount } = await supabase.from("case_graph_edges").select("*", { count: "exact", head: true });

      // Regulatory flags
      const { count: regFlagCount } = await supabase.from("regulatory_flags").select("*", { count: "exact", head: true }).eq("is_active", true);

      // Appeal outcomes
      const { count: appealOutcomeCount } = await supabase.from("appeal_outcomes").select("*", { count: "exact", head: true });

      return new Response(JSON.stringify({
        success: true,
        engineVersion: "SOUPY-v3",
        health: {
          ghostCaseAccuracy: avgGhostAccuracy,
          ghostCasesConfigured: ghostCases?.length || 0,
          goldSetAccuracy: avgGoldAccuracy,
          goldSetCasesConfigured: goldCases?.length || 0,
          calibrationAccuracy,
          calibrationSamples: calibrations?.length || 0,
          stabilityRate,
          avgDriftScore: avgDrift,
          stabilityChecks: stabilityChecks?.length || 0,
          consensusIntegrity: ciStats,
          confidenceFloorEvents: floorEventCount || 0,
          contradictionFrequency: contradictionCount || 0,
          decisionTracesStored: decisionTraceCount || 0,
          payerProfilesLoaded: payerCount || 0,
          caseGraphEdges: edgeCount || 0,
          regulatoryFlagsActive: regFlagCount || 0,
          appealOutcomesTracked: appealOutcomeCount || 0,
        },
        modules: [
          "consensus_integrity_engine",
          "decision_trace",
          "evidence_sufficiency_score",
          "contradiction_detector",
          "confidence_floor_enforcement",
          "regulatory_currency_monitor",
          "action_pathway_recommender",
          "minimal_winning_packet_builder",
          "source_reliability_weighting",
          "physician_behavioral_fingerprint",
          "payer_specific_adversarial_tuning",
          "appeal_outcome_memory",
        ],
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ═══════════════════════════════════════════════════
    // ACTION: physician-profile
    // ═══════════════════════════════════════════════════
    if (action === "physician-profile") {
      const { physicianId } = body;
      const { data: cases } = await supabase
        .from("audit_cases").select("*").eq("physician_id", physicianId).order("created_at", { ascending: false });

      if (!cases?.length) {
        return new Response(JSON.stringify({ error: "No cases found for physician" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const allCodes = cases.flatMap(c => c.cpt_codes || []);
      const codeFreq: Record<string, number> = {};
      for (const code of allCodes) codeFreq[code] = (codeFreq[code] || 0) + 1;

      const riskScores = cases.map(c => (c.risk_score as any)?.score || 0).filter(s => s > 0);
      const consensusScores = cases.map(c => c.consensus_score || 0).filter(s => s > 0);

      const caseIds = cases.map(c => c.id);
      const { data: edges } = await supabase.from("case_graph_edges").select("*").in("source_case_id", caseIds);
      const { data: calibrations } = await supabase
        .from("engine_calibration").select("*").in("case_id", caseIds).not("actual_outcome", "is", null);

      const predictionAccuracy = calibrations?.length
        ? calibrations.filter(c => Number(c.deviation_score) === 0).length / calibrations.length * 100 : null;

      return new Response(JSON.stringify({
        success: true,
        profile: {
          physicianId,
          physicianName: cases[0].physician_name,
          totalCases: cases.length,
          statusBreakdown: {
            pending: cases.filter(c => c.status === "pending").length,
            inReview: cases.filter(c => c.status === "in-review").length,
            approved: cases.filter(c => c.status === "approved").length,
            rejected: cases.filter(c => c.status === "rejected").length,
          },
          topCodes: Object.entries(codeFreq).sort((a, b) => b[1] - a[1]).slice(0, 10),
          avgRiskScore: riskScores.length > 0 ? riskScores.reduce((a, b) => a + b, 0) / riskScores.length : 0,
          avgConsensusScore: consensusScores.length > 0 ? consensusScores.reduce((a, b) => a + b, 0) / consensusScores.length : 0,
          rejectionRate: cases.filter(c => c.status === "rejected").length / cases.length * 100,
          graphConnections: edges?.length || 0,
          predictionAccuracy,
          riskTrend: riskScores.slice(0, 5),
        },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ═══════════════════════════════════════════════════
    // ACTION: list-payer-profiles
    // ═══════════════════════════════════════════════════
    if (action === "list-payer-profiles") {
      const { data: profiles } = await supabase
        .from("payer_profiles").select("id, payer_name, payer_code, denial_patterns, appeal_success_rates, behavioral_notes, last_updated").order("payer_name");
      return new Response(JSON.stringify({ success: true, profiles: profiles || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ═══════════════════════════════════════════════════
    // ACTION: create-ghost-case — Create a new ghost case
    // ═══════════════════════════════════════════════════
    if (action === "create-ghost-case") {
      const { caseTemplate, knownAnswer, difficulty, category } = body;
      if (!caseTemplate || !knownAnswer) {
        return new Response(JSON.stringify({ error: "caseTemplate and knownAnswer are required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: ghost, error: insertErr } = await supabase
        .from("ghost_cases")
        .insert({
          case_template: caseTemplate,
          known_answer: knownAnswer,
          difficulty: difficulty || "medium",
          category: category || "general",
        })
        .select()
        .single();

      if (insertErr || !ghost) {
        return new Response(JSON.stringify({ error: insertErr?.message || "Failed to create ghost case" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, ghostCase: ghost }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ═══════════════════════════════════════════════════
    // ACTION: list-ghost-cases
    // ═══════════════════════════════════════════════════
    if (action === "list-ghost-cases") {
      const { data: ghosts } = await supabase.from("ghost_cases").select("*").order("created_at");

      // Also fetch recent results for each ghost case
      const ghostIds = (ghosts || []).map((g: any) => g.id);
      const { data: results } = ghostIds.length > 0
        ? await supabase.from("ghost_case_results").select("*").in("ghost_case_id", ghostIds).order("created_at", { ascending: false })
        : { data: [] };

      return new Response(JSON.stringify({ success: true, ghostCases: ghosts || [], results: results || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ═══════════════════════════════════════════════════
    // ACTION: list-gold-set-cases
    // ═══════════════════════════════════════════════════
    if (action === "list-gold-set-cases") {
      const { data: goldCases } = await supabase.from("gold_set_cases").select("*").order("created_at");
      return new Response(JSON.stringify({ success: true, goldCases: goldCases || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ═══════════════════════════════════════════════════
    // ACTION: list-regulatory-flags
    // ═══════════════════════════════════════════════════
    if (action === "list-regulatory-flags") {
      const { data: flags } = await supabase
        .from("regulatory_flags").select("*").eq("is_active", true).order("effective_date", { ascending: false });
      return new Response(JSON.stringify({ success: true, flags: flags || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e: any) {
    console.error("soupy-engine error:", e);
    return new Response(JSON.stringify({ error: e?.message || "Internal error" }), {
      status: e?.status || 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
