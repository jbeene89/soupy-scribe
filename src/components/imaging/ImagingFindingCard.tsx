import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScanSearch, AlertTriangle, CheckCircle2, FileSearch, User, Stethoscope, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import type { ImagingFinding } from '@/lib/imagingTypes';
import { SEVERITY_LABELS } from '@/lib/imagingTypes';
import { RelatedActivityBadge } from '@/components/system-impact/RelatedActivityBadge';
import { updateFindingStatus, deleteImagingFinding } from '@/lib/imagingService';
import { toast } from 'sonner';
import { useAdminContext } from '@/components/admin/AdminContext';

const sevColor: Record<string, string> = {
  low: 'bg-consensus/15 text-consensus border-consensus/30',
  medium: 'bg-info-blue/15 text-info-blue border-info-blue/30',
  high: 'bg-disagreement/15 text-disagreement border-disagreement/30',
  critical: 'bg-violation/15 text-violation border-violation/30',
};

interface Props { finding: ImagingFinding; }

export function ImagingFindingCard({ finding: f }: Props) {
  const navigate = useNavigate();
  const { reloadImagingFindings } = useAdminContext();

  const markReviewed = async () => {
    try {
      await updateFindingStatus(f.id, { status: 'reviewed' });
      toast.success('Marked reviewed');
      reloadImagingFindings();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    }
  };

  const dismiss = async () => {
    try {
      await updateFindingStatus(f.id, { status: 'dismissed' });
      toast.info('Finding dismissed');
      reloadImagingFindings();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    }
  };

  const remove = async () => {
    if (!confirm('Delete this imaging finding?')) return;
    try {
      await deleteImagingFinding(f.id, f.image_storage_path);
      toast.success('Deleted');
      reloadImagingFindings();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const implantMismatch = f.detected_implant_count < f.expected_implant_count;

  return (
    <Card className={cn('overflow-hidden', f.status === 'dismissed' && 'opacity-60')}>
      <div className="grid md:grid-cols-[280px,1fr] gap-0">
        {/* Image side */}
        <div className="bg-muted/30 border-b md:border-b-0 md:border-r flex items-center justify-center p-3 min-h-[200px]">
          {f.image_preview_url ? (
            <img src={f.image_preview_url} alt={f.image_file_name ?? 'clinical image'}
              className="max-h-64 object-contain" />
          ) : (
            <div className="text-center text-muted-foreground text-xs">
              <ScanSearch className="h-8 w-8 mx-auto mb-2 opacity-50" />
              {f.image_file_name || 'No preview available'}
            </div>
          )}
        </div>

        {/* Findings side */}
        <div>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="space-y-1 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className={cn('border', sevColor[f.severity])}>
                    {SEVERITY_LABELS[f.severity]}
                  </Badge>
                  {f.status === 'reviewed' && <Badge variant="outline" className="bg-consensus/10 text-consensus border-consensus/30"><CheckCircle2 className="h-3 w-3 mr-1" />Reviewed</Badge>}
                  {f.status === 'dismissed' && <Badge variant="outline">Dismissed</Badge>}
                  <span className="text-xs text-muted-foreground">AI confidence {Math.round(f.ai_confidence)}%</span>
                </div>
                <h3 className="font-semibold text-sm">{f.procedure_label || 'Imaging finding'}{f.body_region ? ` · ${f.body_region}` : ''}</h3>
                {f.ai_summary && <p className="text-sm text-muted-foreground">{f.ai_summary}</p>}
              </div>
              {f.estimated_loss > 0 && (
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Est. impact</div>
                  <div className="text-lg font-semibold text-violation">${f.estimated_loss.toLocaleString()}</div>
                </div>
              )}
            </div>

            {/* Cross-module identifiers */}
            <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground pt-2">
              {f.patient_id && (
                <span className="inline-flex items-center gap-1"><User className="h-3 w-3" />{f.patient_id}</span>
              )}
              {f.physician_name && (
                <span className="inline-flex items-center gap-1"><Stethoscope className="h-3 w-3" />{f.physician_name}</span>
              )}
              {f.case_id && (
                <span className="inline-flex items-center gap-1"><Link2 className="h-3 w-3" />Linked to case</span>
              )}
              {f.cpt_codes && f.cpt_codes.length > 0 && (
                <span>CPT: {f.cpt_codes.join(', ')}</span>
              )}
              <RelatedActivityBadge
                patientId={f.patient_id}
                physicianName={f.physician_name}
                excludeCategory="imaging"
              />
            </div>
          </CardHeader>

          <CardContent className="space-y-3 pt-0">
            {/* Implant counter */}
            <div className={cn(
              'rounded-md border px-3 py-2 text-sm flex items-center justify-between',
              implantMismatch ? 'bg-violation/5 border-violation/30' : 'bg-consensus/5 border-consensus/30'
            )}>
              <span className="inline-flex items-center gap-2">
                {implantMismatch ? <AlertTriangle className="h-4 w-4 text-violation" /> : <CheckCircle2 className="h-4 w-4 text-consensus" />}
                Implant count
              </span>
              <span className="font-mono text-xs">
                detected <strong>{f.detected_implant_count}</strong> / expected <strong>{f.expected_implant_count}</strong>
              </span>
            </div>

            {f.ai_findings.length > 0 && (
              <ul className="space-y-2">
                {f.ai_findings.map((sub, i) => (
                  <li key={i} className="rounded-md border p-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{sub.label}</span>
                      <Badge variant="outline" className={cn('border text-[10px]', sevColor[sub.severity])}>
                        {sub.severity}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{sub.detail}</p>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex gap-2 pt-1 flex-wrap">
              {f.case_id && (
                <Button size="sm" variant="outline" onClick={() => navigate('/app/cases')}>
                  <FileSearch className="h-3 w-3 mr-1" />Open case
                </Button>
              )}
              {f.status !== 'reviewed' && f.status !== 'dismissed' && (
                <Button size="sm" variant="outline" onClick={markReviewed}>
                  <CheckCircle2 className="h-3 w-3 mr-1" />Mark reviewed
                </Button>
              )}
              {f.status !== 'dismissed' && (
                <Button size="sm" variant="ghost" onClick={dismiss}>Dismiss</Button>
              )}
              <Button size="sm" variant="ghost" className="text-violation" onClick={remove}>Delete</Button>
            </div>
          </CardContent>
        </div>
      </div>
    </Card>
  );
}