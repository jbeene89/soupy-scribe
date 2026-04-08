import { cn } from '@/lib/utils';

interface ConsensusMeterProps {
  score: number;
  className?: string;
}

export function ConsensusMeter({ score, className }: ConsensusMeterProps) {
  // Thresholds synchronized with caseIntelligence.deriveCaseSignals
  const getColor = () => {
    if (score >= 90) return 'bg-consensus';
    if (score >= 75) return 'bg-info-blue';
    if (score >= 50) return 'bg-disagreement';
    return 'bg-violation';
  };

  const getLabel = () => {
    if (score >= 90) return 'Strong Agreement';
    if (score >= 75) return 'Majority Agreement';
    if (score >= 50) return 'Moderate Agreement';
    return 'High Divergence';
  };

  const getTextColor = () => {
    if (score >= 90) return 'text-consensus';
    if (score >= 75) return 'text-info-blue';
    if (score >= 50) return 'text-disagreement';
    return 'text-violation';
  };

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-muted-foreground">Consensus Integrity</span>
        <span className={cn('font-semibold text-xs', getTextColor())}>{getLabel()}</span>
      </div>
      <div className="h-2.5 w-full rounded-full bg-secondary overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-700 ease-out', getColor())}
          style={{ width: `${score}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Divergent</span>
        <span className="font-mono">{score}%</span>
        <span>Consensus</span>
      </div>
    </div>
  );
}
