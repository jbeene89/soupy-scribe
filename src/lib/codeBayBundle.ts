import JSZip from "jszip";
import Papa from "papaparse";

export const EXPECTED_FILES = [
  "run_manifest.json",
  "hidden_ground_truth.json",
  "charges.csv",
  "clinical_notes.csv",
  "staff_timesheets.csv",
  "vendor_invoices.csv",
  "fhir_r4.ndjson",
  "x12_837_sample.txt",
  "hl7_dft_sample.hl7",
  "audit_workbook.xlsx",
  "patient_packet.pdf",
  "vendor_msa.docx",
] as const;

export type ExpectedFile = (typeof EXPECTED_FILES)[number];

export type GroundTruthFinding = {
  sourceId?: string;
  findingType?: string;
  category?: string;
  description?: string;
  [k: string]: unknown;
};

export type RunManifest = {
  runId?: string;
  seed?: string | number;
  generatedAt?: string;
  patientCount?: number;
  chargeCount?: number;
  vendorInvoiceCount?: number;
  [k: string]: unknown;
};

export type ParsedBundle = {
  fileName: string;
  sizeBytes: number;
  manifest: RunManifest | null;
  groundTruth: GroundTruthFinding[];
  charges: Record<string, string>[];
  clinicalNotes: Record<string, string>[];
  staffTimesheets: Record<string, string>[];
  vendorInvoices: Record<string, string>[];
  fhirResources: any[];
  presence: Record<ExpectedFile, { present: boolean; sizeBytes: number }>;
  totals: {
    patientCount: number;
    chargeCount: number;
    vendorInvoiceCount: number;
    injectedFindingCount: number;
    findingCategories: Record<string, number>;
    totalBilledAmount: number;
  };
  warnings: string[];
};

export const MAX_BUNDLE_BYTES = 25 * 1024 * 1024; // 25 MB

function parseCsv(text: string): Record<string, string>[] {
  const out = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });
  return (out.data || []).filter((r) => r && Object.keys(r).length > 0);
}

function parseNdjson(text: string): any[] {
  const out: any[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    try {
      out.push(JSON.parse(line));
    } catch {
      /* ignore malformed line */
    }
  }
  return out;
}

function pickAmount(row: Record<string, string>): number {
  const keys = ["billed_amount", "billedAmount", "amount", "charge_amount", "total"];
  for (const k of keys) {
    const v = row[k];
    if (v == null) continue;
    const n = Number(String(v).replace(/[$,]/g, ""));
    if (!Number.isNaN(n)) return n;
  }
  return 0;
}

export async function parseCodeBayBundle(file: File): Promise<ParsedBundle> {
  if (file.size > MAX_BUNDLE_BYTES) {
    throw new Error(
      `Bundle is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max is 25 MB.`,
    );
  }
  const warnings: string[] = [];
  const zip = await JSZip.loadAsync(await file.arrayBuffer());

  // Build a flat lookup keyed by basename to tolerate subfolders.
  const byName = new Map<string, JSZip.JSZipObject>();
  zip.forEach((path, entry) => {
    if (entry.dir) return;
    const base = path.split("/").pop()!.toLowerCase();
    byName.set(base, entry);
  });

  const presence = {} as ParsedBundle["presence"];
  for (const name of EXPECTED_FILES) {
    const entry = byName.get(name.toLowerCase());
    presence[name] = {
      present: !!entry,
      // @ts-expect-error _data exists at runtime
      sizeBytes: entry?._data?.uncompressedSize ?? 0,
    };
  }

  async function readText(name: ExpectedFile): Promise<string | null> {
    const e = byName.get(name.toLowerCase());
    if (!e) return null;
    try {
      return await e.async("string");
    } catch (err) {
      warnings.push(`Could not read ${name}: ${(err as Error).message}`);
      return null;
    }
  }

  let manifest: RunManifest | null = null;
  const manifestText = await readText("run_manifest.json");
  if (manifestText) {
    try { manifest = JSON.parse(manifestText); } catch { warnings.push("run_manifest.json is not valid JSON."); }
  }

  let groundTruth: GroundTruthFinding[] = [];
  const gtText = await readText("hidden_ground_truth.json");
  if (gtText) {
    try {
      const parsed = JSON.parse(gtText);
      groundTruth = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.findings) ? parsed.findings : [];
    } catch { warnings.push("hidden_ground_truth.json is not valid JSON."); }
  }

  const charges = await (async () => {
    const t = await readText("charges.csv");
    return t ? parseCsv(t) : [];
  })();
  const clinicalNotes = await (async () => {
    const t = await readText("clinical_notes.csv");
    return t ? parseCsv(t) : [];
  })();
  const staffTimesheets = await (async () => {
    const t = await readText("staff_timesheets.csv");
    return t ? parseCsv(t) : [];
  })();
  const vendorInvoices = await (async () => {
    const t = await readText("vendor_invoices.csv");
    return t ? parseCsv(t) : [];
  })();
  const fhirResources = await (async () => {
    const t = await readText("fhir_r4.ndjson");
    return t ? parseNdjson(t) : [];
  })();

  const findingCategories: Record<string, number> = {};
  for (const g of groundTruth) {
    const cat = String(g.category ?? g.findingType ?? "uncategorized");
    findingCategories[cat] = (findingCategories[cat] || 0) + 1;
  }

  const totalBilledAmount = charges.reduce((sum, r) => sum + pickAmount(r), 0);

  return {
    fileName: file.name,
    sizeBytes: file.size,
    manifest,
    groundTruth,
    charges,
    clinicalNotes,
    staffTimesheets,
    vendorInvoices,
    fhirResources,
    presence,
    totals: {
      patientCount: Number(manifest?.patientCount ?? 0) || new Set(charges.map((c) => c.patient_id || c.patientId)).size,
      chargeCount: Number(manifest?.chargeCount ?? 0) || charges.length,
      vendorInvoiceCount: Number(manifest?.vendorInvoiceCount ?? 0) || vendorInvoices.length,
      injectedFindingCount: groundTruth.length,
      findingCategories,
      totalBilledAmount,
    },
    warnings,
  };
}

export type DetectorFinding = {
  sourceId: string;
  findingType?: string;
  reasoning?: string;
};

export type BenchmarkResult = {
  truePositives: DetectorFinding[];
  falsePositives: DetectorFinding[];
  falseNegatives: GroundTruthFinding[];
  matched: Array<{ detector: DetectorFinding; truth: GroundTruthFinding }>;
  precision: number;
  recall: number;
};

export function scoreDetector(
  detector: DetectorFinding[],
  truth: GroundTruthFinding[],
): BenchmarkResult {
  const truthBySource = new Map<string, GroundTruthFinding[]>();
  for (const t of truth) {
    const key = String(t.sourceId ?? "");
    if (!key) continue;
    const list = truthBySource.get(key) ?? [];
    list.push(t);
    truthBySource.set(key, list);
  }

  const tp: DetectorFinding[] = [];
  const fp: DetectorFinding[] = [];
  const matched: Array<{ detector: DetectorFinding; truth: GroundTruthFinding }> = [];
  const matchedTruth = new Set<GroundTruthFinding>();

  for (const d of detector) {
    const candidates = truthBySource.get(String(d.sourceId)) ?? [];
    let hit: GroundTruthFinding | undefined;
    if (d.findingType) {
      hit = candidates.find(
        (c) => String(c.findingType ?? "").toLowerCase() === String(d.findingType).toLowerCase() && !matchedTruth.has(c),
      );
    }
    if (!hit) hit = candidates.find((c) => !matchedTruth.has(c));
    if (hit) {
      tp.push(d);
      matched.push({ detector: d, truth: hit });
      matchedTruth.add(hit);
    } else {
      fp.push(d);
    }
  }

  const fn = truth.filter((t) => !matchedTruth.has(t));
  const precision = detector.length === 0 ? 0 : tp.length / detector.length;
  const recall = truth.length === 0 ? 0 : tp.length / truth.length;

  return { truePositives: tp, falsePositives: fp, falseNegatives: fn, matched, precision, recall };
}