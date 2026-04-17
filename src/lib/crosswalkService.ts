// Service layer for the Crosswalk Engine.
// Wraps the two edge functions and the persistence patches into audit_cases.metadata.
import { supabase } from "@/integrations/supabase/client";
import type { ParsedNote, CrosswalkVerdict } from "./crosswalkTypes";
import type { ParsedClaim } from "./parsedClaimTypes";

export interface NoteSourceInput {
  sourceText?: string;
  imageDataUrl?: string;
  fileName: string;
}

/** Parse a clinical note via edge function — returns structured ParsedNote. */
export async function parseClinicalNote(input: NoteSourceInput): Promise<ParsedNote> {
  const { data, error } = await supabase.functions.invoke("note-parse-structured", {
    body: {
      sourceText: input.sourceText,
      imageDataUrl: input.imageDataUrl,
      fileName: input.fileName,
    },
  });
  if (error) throw error;
  if (!data?.note) throw new Error("Note parser returned no data");
  return data.note as ParsedNote;
}

/** Run the strict auditor crosswalk over a claim+note pair. */
export async function runCrosswalk(claim: ParsedClaim, note: ParsedNote): Promise<CrosswalkVerdict> {
  const { data, error } = await supabase.functions.invoke("claim-clinical-crosswalk", {
    body: { claim, note },
  });
  if (error) throw error;
  if (!data?.verdict) throw new Error("Crosswalk returned no verdict");
  return data.verdict as CrosswalkVerdict;
}

/** Persist note + crosswalk back onto an existing parsed-claim audit_cases row. */
export async function persistCrosswalk(
  caseId: string,
  payload: { note?: ParsedNote | null; noteFileName?: string | null; verdict?: CrosswalkVerdict | null }
): Promise<void> {
  const { data: row, error: fetchErr } = await supabase
    .from("audit_cases")
    .select("metadata")
    .eq("id", caseId)
    .single();
  if (fetchErr) throw fetchErr;

  const meta: any = { ...(row?.metadata as any || {}) };
  if (payload.note !== undefined) meta.clinicalNote = payload.note;
  if (payload.noteFileName !== undefined) meta.clinicalNoteFileName = payload.noteFileName;
  if (payload.verdict !== undefined) meta.crosswalkVerdict = payload.verdict;
  meta.crosswalkUpdatedAt = new Date().toISOString();

  const { error } = await supabase.from("audit_cases").update({ metadata: meta }).eq("id", caseId);
  if (error) throw error;
}
