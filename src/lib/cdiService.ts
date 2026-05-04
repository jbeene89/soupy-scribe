import { supabase } from '@/integrations/supabase/client';
import { detectCDIGaps, type CDIFinding, type NewCDIFinding } from './cdiTypes';

export async function listCDIFindings(caseId: string): Promise<CDIFinding[]> {
  const { data, error } = await supabase
    .from('cdi_findings')
    .select('*')
    .eq('case_id', caseId)
    .order('estimated_revenue_impact', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as CDIFinding[];
}

export async function runCDIAnalysis(args: {
  caseId: string;
  sourceText: string | null | undefined;
  cptCodes: string[];
  icdCodes: string[];
}): Promise<CDIFinding[]> {
  const findings = detectCDIGaps(args);

  // Replace prior open findings for this case to keep results idempotent.
  await supabase
    .from('cdi_findings')
    .delete()
    .eq('case_id', args.caseId)
    .eq('status', 'open');

  if (findings.length === 0) {
    return listCDIFindings(args.caseId);
  }

  const { error } = await supabase
    .from('cdi_findings')
    .insert(findings as NewCDIFinding[]);
  if (error) throw error;
  return listCDIFindings(args.caseId);
}

export async function updateCDIStatus(id: string, status: CDIFinding['status']) {
  const { error } = await supabase
    .from('cdi_findings')
    .update({ status })
    .eq('id', id);
  if (error) throw error;
}