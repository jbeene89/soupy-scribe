// Service layer for the Imaging Audit module.
// - Uploads the image to the case-files bucket.
// - Calls the imaging-analyze edge function (Gemini multimodal).
// - Persists the structured finding in imaging_findings.
// - Provides fetch / update / delete helpers.
import { supabase } from '@/integrations/supabase/client';
import type { ImagingFinding, ImagingSubFinding } from './imagingTypes';

const BUCKET = 'case-files';

function rowToFinding(row: any, previewUrl?: string, cptCodes?: string[]): ImagingFinding {
  return {
    id: row.id,
    case_id: row.case_id ?? undefined,
    org_id: row.org_id ?? undefined,
    patient_id: row.patient_id ?? undefined,
    physician_name: row.physician_name ?? undefined,
    procedure_label: row.procedure_label ?? undefined,
    body_region: row.body_region ?? undefined,
    expected_implant_count: row.expected_implant_count ?? 0,
    detected_implant_count: row.detected_implant_count ?? 0,
    image_storage_path: row.image_storage_path ?? undefined,
    image_file_name: row.image_file_name ?? undefined,
    image_mime_type: row.image_mime_type ?? undefined,
    image_preview_url: previewUrl,
    ai_summary: row.ai_summary ?? undefined,
    ai_findings: Array.isArray(row.ai_findings) ? (row.ai_findings as ImagingSubFinding[]) : [],
    ai_confidence: Number(row.ai_confidence ?? 0),
    estimated_loss: Number(row.estimated_loss ?? 0),
    severity: (row.severity as ImagingFinding['severity']) || 'low',
    status: (row.status as ImagingFinding['status']) || 'analyzed',
    reviewer_notes: row.reviewer_notes ?? undefined,
    cpt_codes: cptCodes,
    created_at: row.created_at,
    updated_at: row.updated_at ?? undefined,
  };
}

async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

export interface AnalyzeImagingInput {
  file: File;
  procedureLabel?: string;
  bodyRegion?: string;
  expectedImplantCount?: number;
  patientId?: string;
  physicianName?: string;
  caseId?: string;
  cptCodes?: string[];
}

/** Run the AI vision pipeline against an image and persist the finding. */
export async function analyzeAndSaveImaging(input: AnalyzeImagingInput): Promise<ImagingFinding> {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) throw new Error('You must be signed in to upload images.');

  // 1. Upload to storage so the image persists for later review.
  const ext = input.file.name.split('.').pop() || 'jpg';
  const storagePath = `imaging/${userData.user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(storagePath, input.file, {
    contentType: input.file.type || 'image/jpeg',
    upsert: false,
  });
  if (uploadErr) throw new Error(`Image upload failed: ${uploadErr.message}`);

  // 2. Read as data URL for the AI call.
  const dataUrl = await readFileAsDataUrl(input.file);

  // 3. Invoke the imaging-analyze edge function.
  const { data: aiResp, error: aiErr } = await supabase.functions.invoke('imaging-analyze', {
    body: {
      imageDataUrl: dataUrl,
      procedureLabel: input.procedureLabel,
      bodyRegion: input.bodyRegion,
      expectedImplantCount: input.expectedImplantCount ?? null,
      cptCodes: input.cptCodes ?? null,
      physicianName: input.physicianName,
      patientId: input.patientId,
    },
  });
  if (aiErr) throw new Error(aiErr.message || 'AI analysis failed.');
  const report = aiResp?.report;
  if (!report) throw new Error('AI returned no structured report.');

  // 4. Persist the finding row.
  const insertRow = {
    owner_id: userData.user.id,
    case_id: input.caseId ?? null,
    patient_id: input.patientId ?? null,
    physician_name: input.physicianName ?? null,
    procedure_label: input.procedureLabel ?? null,
    body_region: input.bodyRegion ?? report.body_region ?? null,
    expected_implant_count: input.expectedImplantCount ?? 0,
    detected_implant_count: report.detected_implant_count ?? 0,
    image_storage_path: storagePath,
    image_file_name: input.file.name,
    image_mime_type: input.file.type || 'image/jpeg',
    ai_summary: report.ai_summary ?? null,
    ai_findings: report.ai_findings ?? [],
    ai_confidence: report.ai_confidence ?? 0,
    estimated_loss: report.estimated_loss ?? 0,
    severity: report.severity ?? 'low',
    status: 'analyzed',
    metadata: { implant_mismatch: !!report.implant_mismatch, cpt_codes: input.cptCodes ?? [] },
  };

  const { data: row, error: insErr } = await supabase
    .from('imaging_findings')
    .insert(insertRow)
    .select()
    .single();
  if (insErr) throw new Error(`Failed to save finding: ${insErr.message}`);

  // 5. Build a signed preview URL for immediate display.
  const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 60 * 60);

  return rowToFinding(row, signed?.signedUrl, input.cptCodes);
}

/** Fetch findings the current user can see (own + org). */
export async function fetchImagingFindings(): Promise<ImagingFinding[]> {
  const { data, error } = await supabase
    .from('imaging_findings')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  if (!data) return [];

  // Sign preview URLs in parallel (best-effort — never block the list).
  const withUrls = await Promise.all(
    data.map(async (row: any) => {
      let url: string | undefined;
      if (row.image_storage_path) {
        const { data: signed } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(row.image_storage_path, 60 * 60);
        url = signed?.signedUrl ?? undefined;
      }
      return rowToFinding(row, url);
    })
  );
  return withUrls;
}

export async function updateFindingStatus(
  id: string,
  patch: { status?: ImagingFinding['status']; reviewer_notes?: string }
): Promise<void> {
  const { error } = await supabase.from('imaging_findings').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteImagingFinding(id: string, storagePath?: string): Promise<void> {
  if (storagePath) {
    await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => {});
  }
  const { error } = await supabase.from('imaging_findings').delete().eq('id', id);
  if (error) throw error;
}