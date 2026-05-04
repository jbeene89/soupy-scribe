import { supabase } from '@/integrations/supabase/client';
import type { RevenueIntegrityFinding, RIDetectionResult } from './revenueIntegrityTypes';

export async function listRevenueIntegrityFindings(): Promise<RevenueIntegrityFinding[]> {
  const { data, error } = await supabase
    .from('revenue_integrity_findings')
    .select('*')
    .order('variance_amount', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as RevenueIntegrityFinding[];
}

export async function persistDetectionResult(
  detection: RIDetectionResult,
  ownerId: string,
): Promise<number> {
  if (!detection.findings.length) return 0;
  const rows = detection.findings.map(f => ({
    ...f,
    owner_id: ownerId,
  }));
  const { error, count } = await supabase
    .from('revenue_integrity_findings')
    .insert(rows, { count: 'exact' });
  if (error) throw error;
  return count ?? rows.length;
}

export async function updateFindingStatus(
  id: string,
  status: RevenueIntegrityFinding['status'],
) {
  const { error } = await supabase
    .from('revenue_integrity_findings')
    .update({ status })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteFinding(id: string) {
  const { error } = await supabase
    .from('revenue_integrity_findings')
    .delete()
    .eq('id', id);
  if (error) throw error;
}