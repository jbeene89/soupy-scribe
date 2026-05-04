import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileSearch, DollarSign, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { listCDIFindings, runCDIAnalysis, updateCDIStatus } from '@/lib/cdiService';
import type { CDIFinding, CDIFindingType } from '@/lib/cdiTypes';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { AuditCase } from '@/lib/types';

const TYPE_LABEL: Record<CDIFindingType, string> = {
  missing_cc_mcc: 'Missing CC/MCC',
  weak_specificity: 'Weak Specificity',
  modifier_risk: 'Modifier Risk',
  missing_documentation: 'Missing Documentation',
  query_opportunity: 'Query Opportunity',
};

interface Props {
  auditCase: AuditCase;
}

export function CDIFindingsPanel({ auditCase }: Props) {
  const [findings, setFindings] = useState<CDIFinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const refresh = async () => {
    try {
      setFindings(await listCDIFindings(auditCase.id));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auditCase.id]);

  const runAnalysis = async () => {
    setRunning(true);
    try {
      const { data: row } = await supabase
        .from('audit_cases')
        .select('source_text')
        .eq('id', auditCase.id)
        .maybeSingle();
      const sourceText = (row as { source_text?: string } | null)?.source_text || '';
      const result = await runCDIAnalysis({
        caseId: auditCase.id,
        sourceText,
        cptCodes: auditCase.cptCodes,
        icdCodes: auditCase.icdCodes,
      });
      setFindings(result);
      toast.success(result.length > 0
        ? `${result.length} CDI finding(s) detected`
        : 'No CDI gaps detected');
    } catch (e) {
      console.error(e);
      toast.error('CDI analysis failed');
    } finally {
      setRunning(false);
    }
  };

  const totalImpact = findings
    .filter(f => f.status === 'open' || f.status === 'queried')
    .reduce((s, f) => s + Number(f.estimated_revenue_impact || 0), 0);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 mx-auto animate-spin mb-2" />
          Loading CDI findings…
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <FileSearch className="h-4 w-4" /> CDI / Coding Audit
              </CardTitle>
              <CardDescription>
                Pre-bill scan for missing CC/MCC, weak specificity, modifier risk, and query opportunities.
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              {totalImpact > 0 && (
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Estimated impact</div>
                  <div className="text-lg font-semibold tabular-nums flex items-center gap-1">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    {totalImpact.toLocaleString()}
                  </div>
                </div>
              )}
              <Button onClick={runAnalysis} disabled={running} size="sm">
                {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileSearch className="h-4 w-4 mr-2" />}
                {findings.length > 0 ? 'Re-run scan' : 'Run CDI scan'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {findings.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No CDI findings yet. Run the scan to surface documentation gaps and code specificity issues.
            </div>
          ) : (
            <div className="space-y-3">
              {findings.map(f => (
                <div key={f.id} className="border rounded-md p-3 space-y-2">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline">{TYPE_LABEL[f.finding_type]}</Badge>
                      <Badge
                        variant={f.severity === 'high' ? 'destructive' : f.severity === 'medium' ? 'default' : 'secondary'}
                        className="text-[10px]"
                      >
                        {f.severity}
                      </Badge>
                      {f.estimated_revenue_impact > 0 && (
                        <span className="text-xs text-muted-foreground tabular-nums">
                          ~${Number(f.estimated_revenue_impact).toLocaleString()} impact
                        </span>
                      )}
                    </div>
                    <Select
                      value={f.status}
                      onValueChange={async v => {
                        await updateCDIStatus(f.id, v as CDIFinding['status']);
                        refresh();
                      }}
                    >
                      <SelectTrigger className="h-7 w-[130px] text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="queried">Queried</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="dismissed">Dismissed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-sm">{f.description}</p>
                  {(f.current_code || f.suggested_code) && (
                    <div className="text-xs flex items-center gap-2 flex-wrap">
                      {f.current_code && (
                        <span className="font-mono px-1.5 py-0.5 rounded bg-muted">{f.current_code}</span>
                      )}
                      {f.suggested_code && (
                        <>
                          <span className="text-muted-foreground">→</span>
                          <span className="font-mono px-1.5 py-0.5 rounded bg-accent/15 text-accent">{f.suggested_code}</span>
                        </>
                      )}
                    </div>
                  )}
                  {f.evidence_excerpt && (
                    <div className="text-xs italic text-muted-foreground border-l-2 border-muted pl-2">
                      "{f.evidence_excerpt}"
                    </div>
                  )}
                  {f.rationale && (
                    <div className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                      <span>{f.rationale}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}