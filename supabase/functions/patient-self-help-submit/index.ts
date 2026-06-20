import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

/**
 * Public submit endpoint for the Patient Self-Help record review.
 *
 * Two-phase flow:
 *  - phase "start": validate the invite code, create a draft case row + file
 *    rows, mint signed upload URLs for each file. Returns { case_id,
 *    access_token, uploads: [...] }.
 *  - phase "finalize": after the client has uploaded all files via the signed
 *    URLs, mark the case as "queued" and kick off the processing function.
 *
 * The invite code is the only auth boundary. The access_token returned to the
 * client is the only thing that lets them poll their own case results.
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = "patient-self-help";
const MAX_FILES = 25;
const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB per file

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const phase = String(body.phase || "start");
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (phase === "start") {
      const inviteCode = String(body.invite_code || "").trim().toUpperCase();
      const files = Array.isArray(body.files) ? body.files : [];
      const contactEmail = String(body.contact_email || "").trim().slice(0, 320) || null;
      const contactName = String(body.contact_name || "").trim().slice(0, 200) || null;
      const caseTitle = String(body.case_title || "").trim().slice(0, 300) || null;
      const scope = String(body.scope || "").trim().slice(0, 80) || null;
      const narrative = String(body.narrative || "").slice(0, 30000) || null;
      const worries: string[] = Array.isArray(body.worries)
        ? body.worries.filter((w: unknown) => typeof w === "string").slice(0, 20)
        : [];
      const recollection = (body.recollection && typeof body.recollection === "object" && !Array.isArray(body.recollection))
        ? body.recollection
        : {};

      if (!inviteCode) return jsonResponse({ error: "Invite code required." }, 400);
      if (files.length === 0 && !narrative) {
        return jsonResponse({ error: "Provide at least one file or a narrative." }, 400);
      }
      if (files.length > MAX_FILES) {
        return jsonResponse({ error: `At most ${MAX_FILES} files per case.` }, 400);
      }
      for (const f of files) {
        if (typeof f?.name !== "string" || !f.name) return jsonResponse({ error: "File missing name." }, 400);
        if (typeof f.size === "number" && f.size > MAX_FILE_BYTES) {
          return jsonResponse({ error: `${f.name} exceeds 50 MB.` }, 400);
        }
      }

      // Validate invite
      const { data: invite, error: invErr } = await admin
        .from("patient_self_help_invites")
        .select("code, max_uses, uses_count, expires_at, is_active")
        .ilike("code", inviteCode)
        .maybeSingle();
      if (invErr) return jsonResponse({ error: invErr.message }, 500);
      if (!invite || !invite.is_active) return jsonResponse({ error: "Invite code not recognized." }, 403);
      const canonicalCode = invite.code;
      if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
        return jsonResponse({ error: "This invite code has expired." }, 403);
      }
      if (invite.uses_count >= invite.max_uses) {
        return jsonResponse({ error: "This invite code has been used up." }, 403);
      }

      // Create case row
      const { data: caseRow, error: caseErr } = await admin
        .from("patient_self_help_cases")
        .insert({
          invite_code: canonicalCode,
          contact_email: contactEmail,
          contact_name: contactName,
          case_title: caseTitle,
          scope,
          narrative,
          status: "awaiting_files",
          file_count: files.length,
          worries,
          recollection,
        })
        .select("id, access_token")
        .single();
      if (caseErr || !caseRow) return jsonResponse({ error: caseErr?.message || "case create failed" }, 500);

      // Mint signed upload URLs per file
      const uploads: Array<{ name: string; path: string; token: string; signed_url: string }> = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const safeName = String(f.name).replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 120);
        const path = `${caseRow.id}/${String(i).padStart(2, "0")}-${safeName}`;
        const { data: signed, error: sErr } = await admin.storage
          .from(BUCKET)
          .createSignedUploadUrl(path);
        if (sErr || !signed) return jsonResponse({ error: sErr?.message || "signed url failed" }, 500);
        uploads.push({ name: f.name, path, token: signed.token, signed_url: signed.signedUrl });

        const userDocType = typeof f.doc_type === "string" && f.doc_type !== "auto" ? f.doc_type : null;
        await admin.from("patient_self_help_files").insert({
          case_id: caseRow.id,
          storage_path: path,
          file_name: f.name,
          file_type: f.type || null,
          file_size: typeof f.size === "number" ? f.size : null,
          doc_type: userDocType,
          doc_type_source: userDocType ? "user" : null,
        });
      }

      // Increment invite use counter
      await admin
        .from("patient_self_help_invites")
        .update({ uses_count: invite.uses_count + 1 })
        .eq("code", canonicalCode);

      return jsonResponse({
        case_id: caseRow.id,
        access_token: caseRow.access_token,
        uploads,
      });
    }

    if (phase === "finalize") {
      const caseId = String(body.case_id || "");
      const accessToken = String(body.access_token || "");
      if (!caseId || !accessToken) return jsonResponse({ error: "case_id and access_token required" }, 400);

      const { data: row, error } = await admin
        .from("patient_self_help_cases")
        .select("id, access_token, status")
        .eq("id", caseId)
        .eq("access_token", accessToken)
        .maybeSingle();
      if (error || !row) return jsonResponse({ error: "case not found" }, 404);

      await admin
        .from("patient_self_help_cases")
        .update({ status: "queued", progress_message: "Queued for review" })
        .eq("id", caseId);

      // Fire-and-forget the processor
      const processorUrl = `${SUPABASE_URL}/functions/v1/patient-self-help-process`;
      const invocation = fetch(processorUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "apikey": SUPABASE_SERVICE_ROLE_KEY,
        },
        body: JSON.stringify({ case_id: caseId, access_token: accessToken }),
      }).catch((e) => console.error("processor invoke failed", e));
      // @ts-ignore - EdgeRuntime is provided by Supabase
      try { EdgeRuntime.waitUntil(invocation); } catch { /* ignore */ }

      return jsonResponse({ ok: true, status: "queued" });
    }

    if (phase === "status") {
      const caseId = String(body.case_id || "");
      const accessToken = String(body.access_token || "");
      if (!caseId || !accessToken) return jsonResponse({ error: "case_id and access_token required" }, 400);

      const { data: row, error } = await admin
        .from("patient_self_help_cases")
        .select("id, status, progress_message, results, error, file_count, created_at, updated_at, case_title, scope, analysis_modes, disabled_modes_reason, worries, recollection")
        .eq("id", caseId)
        .eq("access_token", accessToken)
        .maybeSingle();
      if (error || !row) return jsonResponse({ error: "case not found" }, 404);
      return jsonResponse(row);
    }

    return jsonResponse({ error: `unknown phase: ${phase}` }, 400);
  } catch (e) {
    console.error("submit error", e);
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});