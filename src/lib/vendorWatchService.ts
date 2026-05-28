import { supabase } from '@/integrations/supabase/client';
import { extractTextFromFile } from './fileTextExtractor';
import type {
  VendorWatchDocument,
  VendorWatchFinding,
  VendorWatchDocType,
} from './vendorWatchTypes';

const BUCKET = 'vendor-submissions';

export async function listVendorWatchDocuments(): Promise<VendorWatchDocument[]> {
  const { data, error } = await supabase
    .from('vendor_watch_documents')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as VendorWatchDocument[];
}

export async function listVendorWatchFindings(documentId?: string): Promise<VendorWatchFinding[]> {
  let q = supabase.from('vendor_watch_findings').select('*').order('severity', { ascending: false }).order('created_at', { ascending: false });
  if (documentId) q = q.eq('document_id', documentId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as VendorWatchFinding[];
}

export async function uploadVendorWatchDocument(opts: {
  file: File;
  vendorKey: string;
  vendorName: string;
  docType: VendorWatchDocType | 'auto';
}): Promise<VendorWatchDocument> {
  const { data: session } = await supabase.auth.getUser();
  const userId = session?.user?.id;
  if (!userId) throw new Error('You must be signed in to upload vendor documents.');

  // 1. Extract text in the browser so the analyzer doesn't need to re-parse.
  let rawText = '';
  let extractWarning: string | undefined;
  try {
    const ext = await extractTextFromFile(opts.file);
    rawText = ext.text || '';
    extractWarning = ext.warning;
  } catch (e) {
    extractWarning = (e as Error).message;
  }

  // 2. Upload the original binary into the per-user folder.
  const safeName = opts.file.name.replace(/[^a-z0-9._-]/gi, '_');
  const vendorKey = opts.vendorKey || 'unclassified';
  const path = `${userId}/vendor-watch/${vendorKey}/${Date.now()}-${safeName}`;
  const up = await supabase.storage.from(BUCKET).upload(path, opts.file, {
    upsert: false,
    contentType: opts.file.type || undefined,
  });
  if (up.error) throw up.error;

  // 3. Create the document row.
  const { data, error } = await supabase
    .from('vendor_watch_documents')
    .insert([{
      owner_id: userId,
      vendor_key: vendorKey,
      vendor_name: opts.vendorName?.trim() || 'Auto-detecting…',
      doc_type: opts.docType === 'auto' ? 'other' : opts.docType,
      file_path: path,
      file_name: opts.file.name,
      file_size: opts.file.size,
      mime_type: opts.file.type || null,
      raw_text: rawText,
      status: rawText.trim().length >= 30 ? 'pending' : 'failed',
      error_message: rawText.trim().length >= 30 ? null : (extractWarning || 'No readable text extracted.'),
    }])
    .select('*')
    .single();

  if (error) {
    // Clean up the orphan file.
    await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
    throw error;
  }
  return data as unknown as VendorWatchDocument;
}

export async function analyzeVendorWatchDocument(documentId: string): Promise<void> {
  const { error } = await supabase.functions.invoke('vendor-watch-analyze', {
    body: { documentId },
  });
  if (error) throw error;
}

export async function deleteVendorWatchDocument(doc: VendorWatchDocument): Promise<void> {
  if (doc.file_path) {
    await supabase.storage.from(BUCKET).remove([doc.file_path]).catch(() => {});
  }
  const { error } = await supabase.from('vendor_watch_documents').delete().eq('id', doc.id);
  if (error) throw error;
}

export async function getSignedDownloadUrl(filePath: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(filePath, 60);
  if (error) throw error;
  return data.signedUrl;
}

export async function updateFindingStatus(
  findingId: string,
  status: VendorWatchFinding['status'],
): Promise<void> {
  const { error } = await supabase
    .from('vendor_watch_findings')
    .update({ status })
    .eq('id', findingId);
  if (error) throw error;
}