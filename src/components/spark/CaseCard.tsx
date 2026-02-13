import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { AuditCase, CaseStatus } from '@/lib/types';
import { Clock, CheckCircle, XCircle, Search, FileText, AlertTriangle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CaseCardProps {
  auditCase: AuditCase;
  onClick: () => void;
}

const statusConfig: Record<CaseStatus, { icon: React.ElementType; color: string; label: string }> = {
  pending: { icon: Clock, color: 'bg-muted text-muted-foreground', label: 'Pending' },
  'in-review': { icon: Search, color: 'bg-info-blue/15 text-info-blue', label: 'In Review' },
  approved: { icon: CheckCircle, color: 'bg-consensus/15 text-consensus', label: 'Approved' },
  rejected: { icon: XCircle, color: 'bg-destructive/15 text-destructive', label: 'Rejected' },
  appealed: { icon: FileText, color: 'bg-disagreement/15 text-disagreement', label: 'Appealed' },
};

export function CaseCard({ auditCase, onClick }: CaseCardProps) {
  const StatusIcon = statusConfig[auditCase.status].icon;

  const getRiskIndicator = () => {
    if (!auditCase.riskScore) return null;

    const { level, score } = auditCase.riskScore;
    let bgColor = '';
    let textColor = '';
    let icon: React.ReactNode = null;

    switch (level) {
      case 'high':
      case 'critical':
        bgColor = 'bg-destructive/15';
        textColor = 'text-destructive';
        icon = <AlertTriangle className="h-3.5 w-3.5" />;
        break;
      case 'medium':
        bgColor = 'bg-disagreement/15';
        textColor = 'text-disagreement';
        icon = <AlertCircle className="h-3.5 w-3.5" />;
        break;
      case 'low':
        bgColor = 'bg-consensus/15';
        textColor = 'text-consensus';
        icon = <CheckCircle className="h-3.5 w-3.5" />;
        break;
    }

    return (
      <div className={cn('flex items-center gap-1.5 px-2 py-1 rounded', bgColor, textColor)}>
        {icon}
        <span className="text-xs font-semibold uppercase">{level}</span>
        <span className="text-xs opacity-75">({score})</span>
      </div>
    );
  };

  const cardBorderClass = auditCase.riskScore?.level === 'high' || auditCase.riskScore?.level === 'critical'
    ? 'border-destructive/40'
    : auditCase.riskScore?.level === 'medium'
    ? 'border-disagreement/40'
    : '';

  return (
    <Card
      className={cn('p-4 cursor-pointer hover:border-accent transition-all duration-200 hover:shadow-md', cardBorderClass)}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <code className="font-mono font-semibold text-sm">{auditCase.caseNumber}</code>
            <Badge className={cn('text-xs', statusConfig[auditCase.status].color)}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {statusConfig[auditCase.status].label}
            </Badge>
            {getRiskIndicator()}
          </div>
          <p className="text-xs text-muted-foreground">
            {auditCase.physicianName} • {auditCase.physicianId}
          </p>
        </div>
        <div className="text-right ml-2">
          <div className="font-semibold text-sm font-mono">${auditCase.claimAmount.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground">{auditCase.dateOfService}</div>
        </div>
      </div>

      <div className="space-y-2">
        <div>
          <span className="text-xs text-muted-foreground">CPT: </span>
          <div className="flex flex-wrap gap-1 mt-1">
            {auditCase.cptCodes.slice(0, 4).map((code) => (
              <code key={code} className="font-mono text-xs bg-muted px-2 py-0.5 rounded">
                {code}
              </code>
            ))}
            {auditCase.cptCodes.length > 4 && (
              <span className="text-xs text-muted-foreground">+{auditCase.cptCodes.length - 4} more</span>
            )}
          </div>
        </div>

        {auditCase.analyses.length > 0 && (
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">AI Analysis:</span>
              <span className="text-xs font-medium">
                {auditCase.analyses.filter(a => a.status === 'complete').length} / {auditCase.analyses.length} complete
              </span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
