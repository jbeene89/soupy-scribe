// OB Fetal Monitoring Audit — deterministic stop-rule engine.
//
// Stage A: normalize inputs into 10-min strip windows.
//   - Structured samples are bucketed directly.
//   - Strip images are sent to the multimodal vision model with a strict JSON
//     schema that asks for per-window summaries (baseline FHR, variability,
//     decel pattern, contraction count). The result is merged with structured
//     windows; structured wins on conflict.
//
// Stage B: deterministic rule engine — no LLM. Walks the merged timeline,
// classifies each window NICHD I/II/III, joins MAR events, and emits
// StopRuleViolation[] + ContraindicationCheck[] with verbatim evidence.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type NICHDCategory = "I" | "II" | "III" | "indeterminate";
type VariabilityLevel = "absent" | "minimal" | "moderate" | "marked";
type DecelType = "early" | "late" | "variable" | "prolonged";

interface StripSample { t: string; fhr: number | null; uc: number | null; }
interface StripWindow {
  start: string; end: string;
  baselineFHR: number | null;
  variability: VariabilityLevel;
  accelerations: number;
  decels: { type: DecelType; tAt: string }[];
  contractionCount: number;
  tachysystole: boolean;
  category: NICHDCategory;
  categoryReason: string;
  source: "structured" | "image";
  imageRef?: string;
}

type MedName = "pitocin" | "misoprostol" | "cervidil" | "magnesium" | "terbutaline" | "other";
interface MAREvent {
  t: string;
  medication: MedName;
  medicationLabel: string;
  action: "start" | "increase" | "decrease" | "hold" | "resume" | "dose" | "discontinue";
  amount?: number;
  unit?: string;
  route?: string;
  evidence: string;
}

type ViolationSeverity = "critical" | "high" | "moderate";
interface StopRuleViolation {
  id: string;
  t: string;
  medication: MedName | "system";
  medicationLabel: string;
  ruleCode?: string;
  rule: string;
  severity: ViolationSeverity;
  stripFinding: string;
  medAction: string;
  chartedResponse: string;
  evidence: string[];
  minutesToAction: number | null;
}

interface ContraindicationCheck {
  id: string;
  doseEventTime: string;
  medication: MedName;
  medicationLabel: string;
  dose: string;
  contraindicationsPresent: { label: string; evidence: string }[];
  clear: boolean;
}

interface VitalsReading {
  t: string;
  sbp?: number;
  dbp?: number;
  hr?: number;
  spo2?: number;
  tempF?: number;
  evidence?: string;
}

interface CareEvent {
  t: string;
  kind: string;
  description: string;
  staff?: string;
  evidence?: string;
}

// ── Stage A.1: structured bucketing ──────────────────────────────────────

function bucketSamples(samples: StripSample[], windowMinutes: number): StripWindow[] {
  if (!samples.length) return [];
  const sorted = [...samples].sort((a, b) => a.t.localeCompare(b.t));
  const startMs = new Date(sorted[0].t).getTime();
  const endMs = new Date(sorted[sorted.length - 1].t).getTime();
  const windowMs = windowMinutes * 60_000;
  const windows: StripWindow[] = [];

  for (let wStart = startMs; wStart <= endMs; wStart += windowMs) {
    const wEnd = wStart + windowMs;
    const inWin = sorted.filter((s) => {
      const t = new Date(s.t).getTime();
      return t >= wStart && t < wEnd;
    });
    if (!inWin.length) continue;

    const fhrs = inWin.map((s) => s.fhr).filter((v): v is number => typeof v === "number" && isFinite(v));
    const baseline = fhrs.length ? Math.round(median(fhrs)) : null;

    // Variability: range across moving averages.
    let variability: VariabilityLevel = "moderate";
    if (fhrs.length >= 5) {
      const range = Math.max(...fhrs) - Math.min(...fhrs);
      if (range < 3) variability = "absent";
      else if (range < 6) variability = "minimal";
      else if (range <= 25) variability = "moderate";
      else variability = "marked";
    } else {
      variability = "minimal";
    }

    // Decel detection — fhr dropping > 15 bpm below baseline for ≥15s windows.
    const decels: { type: DecelType; tAt: string }[] = [];
    if (baseline !== null) {
      for (const s of inWin) {
        if (s.fhr !== null && baseline - s.fhr >= 15) {
          // Classify late vs variable vs prolonged heuristically by depth + timing.
          let type: DecelType = "variable";
          if (baseline - s.fhr >= 40) type = "prolonged";
          else if (baseline - s.fhr >= 25) type = "late";
          decels.push({ type, tAt: s.t });
        }
      }
    }

    // Accelerations — fhr ≥ 15 above baseline.
    let accels = 0;
    if (baseline !== null) {
      for (const s of inWin) if (s.fhr !== null && s.fhr - baseline >= 15) accels++;
    }

    // Contractions — count UC peaks above threshold separated by ≥45s.
    let contractionCount = 0;
    let lastPeakMs = -Infinity;
    for (const s of inWin) {
      if (s.uc !== null && s.uc > 60) {
        const ms = new Date(s.t).getTime();
        if (ms - lastPeakMs > 45_000) {
          contractionCount++;
          lastPeakMs = ms;
        }
      }
    }

    windows.push({
      start: new Date(wStart).toISOString(),
      end: new Date(wEnd).toISOString(),
      baselineFHR: baseline,
      variability,
      accelerations: accels,
      decels: collapseDecels(decels),
      contractionCount,
      tachysystole: false, // set in rolling pass below
      category: "indeterminate",
      categoryReason: "",
      source: "structured",
    });
  }

  applyRollingTachysystole(windows, windowMinutes);
  for (const w of windows) classifyNICHD(w);
  return windows;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function collapseDecels(decels: { type: DecelType; tAt: string }[]): { type: DecelType; tAt: string }[] {
  // Merge sequential decel samples within 60s into one event.
  const out: { type: DecelType; tAt: string }[] = [];
  let lastMs = -Infinity;
  let lastType: DecelType | null = null;
  for (const d of decels) {
    const ms = new Date(d.tAt).getTime();
    if (ms - lastMs <= 60_000 && lastType === d.type) continue;
    out.push(d);
    lastMs = ms;
    lastType = d.type;
  }
  return out;
}

function applyRollingTachysystole(windows: StripWindow[], windowMinutes: number) {
  // Tachysystole = >5 contractions / 10 min averaged over a rolling 30-min window.
  const ratio = 10 / windowMinutes;
  const lookback = Math.max(1, Math.round(30 / windowMinutes));
  for (let i = 0; i < windows.length; i++) {
    const from = Math.max(0, i - lookback + 1);
    const slice = windows.slice(from, i + 1);
    const totalCx = slice.reduce((a, w) => a + w.contractionCount, 0);
    const per10 = (totalCx / slice.length) * ratio;
    windows[i].tachysystole = per10 > 5;
  }
}

function classifyNICHD(w: StripWindow) {
  const reasons: string[] = [];
  const lateOrProlonged = w.decels.filter((d) => d.type === "late" || d.type === "prolonged").length;
  const variable = w.decels.filter((d) => d.type === "variable").length;

  if (w.variability === "absent" && (lateOrProlonged > 0 || variable >= 2)) {
    w.category = "III";
    w.categoryReason = "Absent variability with recurrent late, prolonged, or variable decelerations.";
    return;
  }
  const concerning =
    lateOrProlonged >= 1 ||
    variable >= 2 ||
    w.variability === "minimal" ||
    w.variability === "marked" ||
    w.tachysystole ||
    (w.baselineFHR !== null && (w.baselineFHR > 160 || w.baselineFHR < 110));

  if (concerning) {
    if (lateOrProlonged > 0) reasons.push(`${lateOrProlonged} late/prolonged decel(s)`);
    if (variable >= 2) reasons.push(`${variable} variable decels`);
    if (w.variability === "minimal") reasons.push("minimal variability");
    if (w.variability === "absent") reasons.push("absent variability");
    if (w.tachysystole) reasons.push("tachysystole on rolling 30-min average");
    if (w.baselineFHR !== null && w.baselineFHR > 160) reasons.push(`baseline tachycardia ${w.baselineFHR}`);
    if (w.baselineFHR !== null && w.baselineFHR < 110) reasons.push(`baseline bradycardia ${w.baselineFHR}`);
    w.category = "II";
    w.categoryReason = reasons.join("; ");
    return;
  }

  if (w.baselineFHR !== null && w.variability === "moderate" && w.decels.length === 0) {
    w.category = "I";
    w.categoryReason = "Baseline 110–160, moderate variability, no decels, no tachysystole.";
    return;
  }

  w.category = "indeterminate";
  w.categoryReason = "Insufficient data in this window.";
}

// ── Stage A.2: image normalization via vision model ──────────────────────

async function normalizeImages(
  images: { filename: string; dataUrl: string }[],
  apiKey: string,
  windowMinutes: number,
): Promise<{ windows: StripWindow[]; warnings: string[] }> {
  if (!images.length) return { windows: [], warnings: [] };
  const url = "https://ai.gateway.lovable.dev/v1/chat/completions";
  const model = "google/gemini-2.5-flash";
  const out: StripWindow[] = [];
  const warnings: string[] = [];

  for (const img of images) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: STRIP_VISION_PROMPT(windowMinutes) },
            { role: "user", content: [
              { type: "text", text: `Strip filename: ${img.filename}. Return JSON only.` },
              { type: "image_url", image_url: { url: img.dataUrl } },
            ] },
          ],
        }),
        signal: AbortSignal.timeout(60_000),
      });
      if (!res.ok) {
        warnings.push(`${img.filename}: vision model returned ${res.status}`);
        continue;
      }
      const json = await res.json();
      const content = json.choices?.[0]?.message?.content || "{}";
      const parsed = JSON.parse(content);
      const wins = Array.isArray(parsed.windows) ? parsed.windows : [];
      for (const w of wins) {
        const start = String(w.start || "");
        const end = String(w.end || "");
        if (!start || !end) continue;
        out.push({
          start, end,
          baselineFHR: typeof w.baselineFHR === "number" ? w.baselineFHR : null,
          variability: VARIABILITY_SET.has(w.variability) ? w.variability : "minimal",
          accelerations: Number(w.accelerations) || 0,
          decels: Array.isArray(w.decels) ? w.decels.filter((d: any) => DECEL_SET.has(d?.type) && d?.tAt).map((d: any) => ({ type: d.type, tAt: d.tAt })) : [],
          contractionCount: Number(w.contractionCount) || 0,
          tachysystole: false,
          category: "indeterminate",
          categoryReason: "",
          source: "image",
          imageRef: img.filename,
        });
      }
    } catch (e) {
      warnings.push(`${img.filename}: ${(e as Error).message}`);
    }
  }

  applyRollingTachysystole(out, windowMinutes);
  for (const w of out) classifyNICHD(w);
  return { windows: out, warnings };
}

const VARIABILITY_SET = new Set(["absent", "minimal", "moderate", "marked"]);
const DECEL_SET = new Set(["early", "late", "variable", "prolonged"]);

const STRIP_VISION_PROMPT = (windowMinutes: number) => `You are reading a fetal monitor strip image.

Break the entire visible time range into ${windowMinutes}-minute windows. For EACH window,
return ONE object with this exact shape:

{
  "start": "<ISO timestamp visible on the strip>",
  "end": "<ISO timestamp = start + ${windowMinutes} min>",
  "baselineFHR": <integer bpm or null>,
  "variability": "absent" | "minimal" | "moderate" | "marked",
  "accelerations": <integer>,
  "decels": [ { "type": "early" | "late" | "variable" | "prolonged", "tAt": "<ISO timestamp>" } ],
  "contractionCount": <integer>
}

If you cannot read a timestamp from the strip, use ISO timestamps anchored to today
at hour 00:00 (window 0 = 00:00, window 1 = 00:${String(windowMinutes).padStart(2, "0")}, etc.)
but still produce one entry per visible window.

Return JSON only: {"windows":[ ... ]}`;

// ── Stage A.3: merge structured + image windows ──────────────────────────

function mergeWindows(structured: StripWindow[], imageWins: StripWindow[]): StripWindow[] {
  const byKey = new Map<string, StripWindow>();
  for (const w of structured) byKey.set(`${w.start}|${w.end}`, w);
  for (const w of imageWins) {
    const k = `${w.start}|${w.end}`;
    if (!byKey.has(k)) byKey.set(k, w); // structured wins
  }
  return [...byKey.values()].sort((a, b) => a.start.localeCompare(b.start));
}

// ── Stage B: deterministic stop-rule engine ──────────────────────────────

function windowAt(windows: StripWindow[], iso: string): StripWindow | null {
  const t = new Date(iso).getTime();
  for (const w of windows) {
    const s = new Date(w.start).getTime();
    const e = new Date(w.end).getTime();
    if (t >= s && t < e) return w;
  }
  // Fall back to the window closest to t.
  if (!windows.length) return null;
  let best = windows[0];
  let bestDist = Infinity;
  for (const w of windows) {
    const s = new Date(w.start).getTime();
    const dist = Math.abs(t - s);
    if (dist < bestDist) { best = w; bestDist = dist; }
  }
  return best;
}

function windowsInRange(windows: StripWindow[], fromIso: string, toIso: string): StripWindow[] {
  const f = new Date(fromIso).getTime();
  const t = new Date(toIso).getTime();
  return windows.filter((w) => {
    const s = new Date(w.start).getTime();
    return s >= f && s <= t;
  });
}

function findChartedResponse(notesText: string, fromIso: string, withinMinutes: number): string {
  if (!notesText) return "no documented action";
  const from = new Date(fromIso).getTime();
  const to = from + withinMinutes * 60_000;
  // Try to find a line with HH:MM that lands in the window AND mentions a stop/decrease/escalation.
  for (const line of notesText.split(/\r?\n/)) {
    const m = line.match(/(\d{1,2}):(\d{2})/);
    if (!m) continue;
    const hh = Number(m[1]);
    const mm = Number(m[2]);
    const dayAnchor = new Date(fromIso);
    dayAnchor.setHours(hh, mm, 0, 0);
    const ts = dayAnchor.getTime();
    if (ts >= from && ts <= to && /stop|d\/c|dc\b|decrease|hold|notified|reposition|o2|oxygen|fluid|bolus|terbutaline/i.test(line)) {
      return line.trim();
    }
  }
  return "no documented action within 30 min";
}

function timeToFirstStopOrDecrease(events: MAREvent[], med: MedName, fromIso: string): number | null {
  const from = new Date(fromIso).getTime();
  for (const e of events) {
    if (e.medication !== med) continue;
    if (e.action !== "discontinue" && e.action !== "hold" && e.action !== "decrease") continue;
    const t = new Date(e.t).getTime();
    if (t >= from) return Math.round((t - from) / 60_000);
  }
  return null;
}

function runRules(
  windows: StripWindow[],
  marEvents: MAREvent[],
  notesText: string,
): { violations: StopRuleViolation[]; contraindicationChecks: ContraindicationCheck[]; pitIncDuringConcern: number; misoUnder: number } {
  const violations: StopRuleViolation[] = [];
  const contraindicationChecks: ContraindicationCheck[] = [];
  let pitIncDuringConcern = 0;
  let misoUnder = 0;

  // Rule 1 & 2: Pitocin increase or continued infusion during tachysystole / Cat II / Cat III.
  for (let i = 0; i < marEvents.length; i++) {
    const e = marEvents[i];
    if (e.medication !== "pitocin") continue;
    if (e.action !== "increase" && e.action !== "start" && e.action !== "resume") continue;
    const w = windowAt(windows, e.t);
    if (!w) continue;
    // Look at the trailing 30 minutes.
    const trailingStart = new Date(new Date(e.t).getTime() - 30 * 60_000).toISOString();
    const trailing = windowsInRange(windows, trailingStart, e.t);
    const cat3 = trailing.find((x) => x.category === "III") || (w.category === "III" ? w : null);
    const tachy = trailing.find((x) => x.tachysystole) || (w.tachysystole ? w : null);
    const cat2concern = trailing.find((x) => x.category === "II") || (w.category === "II" ? w : null);

    if (cat3) {
      pitIncDuringConcern++;
      violations.push({
        id: `v-pit-cat3-${i}`,
        t: e.t,
        medication: "pitocin",
        medicationLabel: e.medicationLabel,
        rule: "Pitocin must be discontinued immediately for any Category III tracing (ACOG / AWHONN).",
        severity: "critical",
        stripFinding: `Category III window at ${shortTime(cat3.start)} — ${cat3.categoryReason}`,
        medAction: `Pitocin ${e.action} to ${e.amount ?? "?"} ${e.unit ?? ""} at ${shortTime(e.t)} (${e.evidence})`.trim(),
        chartedResponse: findChartedResponse(notesText, e.t, 30),
        evidence: [e.t, cat3.start],
        minutesToAction: timeToFirstStopOrDecrease(marEvents, "pitocin", e.t),
      });
    } else if (tachy) {
      pitIncDuringConcern++;
      violations.push({
        id: `v-pit-tachy-${i}`,
        t: e.t,
        medication: "pitocin",
        medicationLabel: e.medicationLabel,
        rule: "Pitocin should be reduced or held during tachysystole (>5 contractions / 10 min averaged over 30 min).",
        severity: "high",
        stripFinding: `Tachysystole detected at ${shortTime(tachy.start)} — ${tachy.contractionCount} contractions in window, rolling 30-min rate exceeds 5/10 min.`,
        medAction: `Pitocin ${e.action} to ${e.amount ?? "?"} ${e.unit ?? ""} at ${shortTime(e.t)}`.trim(),
        chartedResponse: findChartedResponse(notesText, e.t, 30),
        evidence: [e.t, tachy.start],
        minutesToAction: timeToFirstStopOrDecrease(marEvents, "pitocin", e.t),
      });
    } else if (cat2concern) {
      pitIncDuringConcern++;
      violations.push({
        id: `v-pit-cat2-${i}`,
        t: e.t,
        medication: "pitocin",
        medicationLabel: e.medicationLabel,
        rule: "Pitocin should not be increased during a Category II tracing with concerning features without intrauterine resuscitation.",
        severity: "moderate",
        stripFinding: `Category II window at ${shortTime(cat2concern.start)} — ${cat2concern.categoryReason}`,
        medAction: `Pitocin ${e.action} to ${e.amount ?? "?"} ${e.unit ?? ""} at ${shortTime(e.t)}`.trim(),
        chartedResponse: findChartedResponse(notesText, e.t, 30),
        evidence: [e.t, cat2concern.start],
        minutesToAction: timeToFirstStopOrDecrease(marEvents, "pitocin", e.t),
      });
    }
  }

  // Rule 3: Pitocin still running into a Cat III window (no rate-change event but no stop event either).
  const lastPitState = lastInfusionStateBy(marEvents, "pitocin");
  for (const w of windows) {
    if (w.category !== "III") continue;
    const stateAt = stateAtTime(marEvents, "pitocin", w.start);
    if (stateAt === "active") {
      const stopAfter = timeToFirstStopOrDecrease(marEvents, "pitocin", w.start);
      if (stopAfter === null || stopAfter > 10) {
        violations.push({
          id: `v-pit-running-cat3-${w.start}`,
          t: w.start,
          medication: "pitocin",
          medicationLabel: "Oxytocin (Pitocin)",
          rule: "Pitocin must be discontinued within minutes of any Category III tracing.",
          severity: "critical",
          stripFinding: `Category III at ${shortTime(w.start)} — ${w.categoryReason}`,
          medAction: stopAfter === null
            ? "Pitocin infusion never documented as stopped after this window."
            : `Pitocin not stopped/decreased for ${stopAfter} minutes after this window started.`,
          chartedResponse: findChartedResponse(notesText, w.start, 30),
          evidence: [w.start],
          minutesToAction: stopAfter,
        });
      }
    }
  }
  void lastPitState;

  // Rule 4: Misoprostol redose under interval (default 4h minimum).
  const misoDoses = marEvents.filter((e) => e.medication === "misoprostol" && (e.action === "dose" || e.action === "start"));
  for (let i = 1; i < misoDoses.length; i++) {
    const prev = misoDoses[i - 1];
    const curr = misoDoses[i];
    const gapMin = (new Date(curr.t).getTime() - new Date(prev.t).getTime()) / 60_000;
    if (gapMin < 240) {
      misoUnder++;
      violations.push({
        id: `v-miso-interval-${i}`,
        t: curr.t,
        medication: "misoprostol",
        medicationLabel: "Misoprostol",
        rule: "Misoprostol should not be re-dosed under the 4-hour minimum interval (vaginal route).",
        severity: "high",
        stripFinding: `Previous dose at ${shortTime(prev.t)}; re-dose at ${shortTime(curr.t)} (${Math.round(gapMin)} min apart).`,
        medAction: `${curr.medicationLabel} ${curr.amount ?? "?"} ${curr.unit ?? "mcg"} at ${shortTime(curr.t)}`,
        chartedResponse: findChartedResponse(notesText, curr.t, 30),
        evidence: [prev.t, curr.t],
        minutesToAction: null,
      });
    }
  }

  // Rule 5: Misoprostol dosed during tachysystole or after regular labor established.
  for (const e of misoDoses) {
    const w = windowAt(windows, e.t);
    if (!w) continue;
    const trailingStart = new Date(new Date(e.t).getTime() - 30 * 60_000).toISOString();
    const trailing = windowsInRange(windows, trailingStart, e.t);
    const tachy = trailing.find((x) => x.tachysystole) || (w.tachysystole ? w : null);
    if (tachy) {
      violations.push({
        id: `v-miso-tachy-${e.t}`,
        t: e.t,
        medication: "misoprostol",
        medicationLabel: e.medicationLabel,
        rule: "Misoprostol is contraindicated when tachysystole is present in the prior 30 minutes.",
        severity: "critical",
        stripFinding: `Tachysystole at ${shortTime(tachy.start)} preceding dose.`,
        medAction: `${e.medicationLabel} ${e.amount ?? "?"} ${e.unit ?? "mcg"} at ${shortTime(e.t)}`,
        chartedResponse: findChartedResponse(notesText, e.t, 30),
        evidence: [tachy.start, e.t],
        minutesToAction: null,
      });
    }
  }

  // Contraindication ledger: every Pit start/increase + every Miso dose.
  for (let i = 0; i < marEvents.length; i++) {
    const e = marEvents[i];
    if (!(e.medication === "pitocin" && (e.action === "start" || e.action === "increase")) &&
        !(e.medication === "misoprostol" && (e.action === "dose" || e.action === "start"))) continue;
    const w = windowAt(windows, e.t);
    const trailingStart = new Date(new Date(e.t).getTime() - 30 * 60_000).toISOString();
    const trailing = w ? windowsInRange(windows, trailingStart, e.t) : [];
    const contraindications: { label: string; evidence: string }[] = [];
    if (trailing.some((x) => x.tachysystole)) {
      contraindications.push({ label: "Tachysystole within prior 30 min", evidence: `Window ${shortTime(trailing.find((x) => x.tachysystole)!.start)}` });
    }
    const catII = trailing.find((x) => x.category === "II");
    const catIII = trailing.find((x) => x.category === "III");
    if (catIII) contraindications.push({ label: "Category III tracing within prior 30 min", evidence: catIII.categoryReason });
    else if (catII) contraindications.push({ label: "Category II tracing within prior 30 min", evidence: catII.categoryReason });
    if (e.medication === "misoprostol") {
      const prevMiso = marEvents.find((x) => x.medication === "misoprostol" && new Date(x.t).getTime() < new Date(e.t).getTime() && (new Date(e.t).getTime() - new Date(x.t).getTime()) < 240 * 60_000);
      if (prevMiso) contraindications.push({ label: "Prior Misoprostol dose within 4 h", evidence: prevMiso.evidence });
    }
    contraindicationChecks.push({
      id: `c-${i}`,
      doseEventTime: e.t,
      medication: e.medication,
      medicationLabel: e.medicationLabel,
      dose: `${e.amount ?? "?"} ${e.unit ?? ""}`.trim(),
      contraindicationsPresent: contraindications,
      clear: contraindications.length === 0,
    });
  }

  return { violations, contraindicationChecks, pitIncDuringConcern, misoUnder };
}

function shortTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")} UTC`;
}

/** Was the medication actively infusing at the given timestamp (start/increase/resume not followed by stop/hold)? */
function stateAtTime(events: MAREvent[], med: MedName, iso: string): "active" | "off" | "unknown" {
  const t = new Date(iso).getTime();
  let state: "active" | "off" | "unknown" = "unknown";
  for (const e of events) {
    if (e.medication !== med) continue;
    const et = new Date(e.t).getTime();
    if (et > t) break;
    if (e.action === "start" || e.action === "increase" || e.action === "resume") state = "active";
    else if (e.action === "discontinue" || e.action === "hold") state = "off";
  }
  return state;
}

function lastInfusionStateBy(events: MAREvent[], med: MedName): "active" | "off" | "unknown" {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.medication !== med) continue;
    if (e.action === "discontinue" || e.action === "hold") return "off";
    if (e.action === "start" || e.action === "increase" || e.action === "resume") return "active";
  }
  return "unknown";
}

// ── HTTP handler ─────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const samples: StripSample[] = Array.isArray(body?.stripSamples) ? body.stripSamples : [];
    const images: { filename: string; dataUrl: string }[] = Array.isArray(body?.stripImages) ? body.stripImages : [];
    const marEvents: MAREvent[] = Array.isArray(body?.marEvents) ? body.marEvents : [];
    const notesText: string = typeof body?.notesText === "string" ? body.notesText : "";
    const windowMinutes = Math.max(1, Math.min(30, Number(body?.windowMinutes) || 10));
    const parseWarnings: string[] = [];

    const structuredWins = bucketSamples(samples, windowMinutes);

    let imageWins: StripWindow[] = [];
    if (images.length) {
      const apiKey = Deno.env.get("LOVABLE_API_KEY") || "";
      if (!apiKey) {
        parseWarnings.push("No vision model key — strip images were skipped.");
      } else {
        const r = await normalizeImages(images, apiKey, windowMinutes);
        imageWins = r.windows;
        parseWarnings.push(...r.warnings);
      }
    }

    const windows = mergeWindows(structuredWins, imageWins);
    if (!windows.length && !marEvents.length) {
      return new Response(JSON.stringify({ error: "No strip or MAR data provided." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { violations, contraindicationChecks, pitIncDuringConcern, misoUnder } = runRules(windows, marEvents, notesText);

    const summary = {
      catI: windows.filter((w) => w.category === "I").length,
      catII: windows.filter((w) => w.category === "II").length,
      catIII: windows.filter((w) => w.category === "III").length,
      tachysystoleWindows: windows.filter((w) => w.tachysystole).length,
      criticalViolations: violations.filter((v) => v.severity === "critical").length,
      highViolations: violations.filter((v) => v.severity === "high").length,
      moderateViolations: violations.filter((v) => v.severity === "moderate").length,
      pitocinIncreasesDuringConcern: pitIncDuringConcern,
      misoRedosesUnderInterval: misoUnder,
    };

    const monitoredMinutes = windows.length * windowMinutes;

    const result = {
      generatedAt: new Date().toISOString(),
      windowMinutes,
      windows,
      marEvents,
      violations,
      contraindicationChecks,
      monitoredMinutes,
      summary,
      notes: notesText ? [notesText.slice(0, 2000)] : [],
      parseWarnings,
    };

    return new Response(JSON.stringify(result), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
