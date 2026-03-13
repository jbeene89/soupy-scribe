import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { AuditCase, CaseStatus } from '@/lib/types';
import { deriveCaseSignals } from '@/lib/caseIntelligence';
import { Clock, CheckCircle, XCircle, Search, FileText, AlertTriangle, AlertCircle, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';

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
  const signals = useMemo(() => deriveCaseSignals(auditCase), [auditCase]);

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
      <div className="flex items-start justify-between mb-2">
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

        {/* Synchronized disposition + signals (preliminary — v3 data loads on detail view) */}
        {signals.hasAnalyses && (
          <div className="pt-2 border-t border-border space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className={cn("text-[10px]", signals.disposition.borderClass, signals.disposition.colorClass)}>
                  {signals.disposition.label}
                </Badge>
                <span className="text-[9px] text-muted-foreground italic">Preliminary</span>
              </div>
              {signals.humanReview.triggered && (
                <div className="flex items-center gap-1 text-violation">
                  <ShieldAlert className="h-3 w-3" />
                  <span className="text-[10px] font-medium">Human Review</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span>Consensus: {signals.consensusScore}%</span>
              <span>•</span>
              <span>{signals.violationCount} violation{signals.violationCount !== 1 ? 's' : ''}</span>
              {signals.criticalViolationCount > 0 && (
                <>
                  <span>•</span>
                  <span className="text-violation">{signals.criticalViolationCount} critical</span>
                </>
              )}
            </div>
          </div>
        )}

        {!signals.hasAnalyses && auditCase.analyses.length === 0 && (
          <div className="pt-2 border-t border-border">
            <p className="text-[10px] text-muted-foreground">Awaiting AI analysis</p>
          </div>
        )}
      </div>
    </Card>
  );
}
