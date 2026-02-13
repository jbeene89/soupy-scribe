import { cn } from '@/lib/utils';
import type { RiskScore } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';
import { ChevronDown, ChevronUp, Info } from 'lucide-react';

interface RiskIndicatorProps {
  riskScore: RiskScore;
  compact?: boolean;
}

export function RiskIndicator({ riskScore, compact }: RiskIndicatorProps) {
  const [showDebug, setShowDebug] = useState(false);

  const levelConfig = {
    low: { label: 'Low', className: 'bg-consensus/15 text-consensus border-consensus/30' },
    medium: { label: 'Medium', className: 'bg-info-blue/15 text-info-blue border-info-blue/30' },
    high: { label: 'High', className: 'bg-disagreement/15 text-disagreement border-disagreement/30' },
    critical: { label: 'Critical', className: 'bg-violation/15 text-violation border-violation/30' },
  };

  const config = levelConfig[riskScore.level];

  if (compact) {
    return (
      <Badge variant="outline" className={cn('text-xs font-semibold', config.className)}>
        {config.label} ({riskScore.score})
      </Badge>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className={cn('flex items-center gap-2 rounded-lg border px-3 py-2', config.className)}>
          <span className="text-lg font-bold font-mono">{riskScore.score}</span>
          <span className="text-xs font-medium">/100</span>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{config.label} Risk</span>
            <span className="text-xs text-muted-foreground">({riskScore.percentile}th percentile)</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-muted-foreground">Confidence: {riskScore.confidence}%</span>
            <span className="text-xs text-muted-foreground">•</span>
            <span className="text-xs text-muted-foreground">Data: {riskScore.dataCompleteness.score}%</span>
          </div>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">{riskScore.recommendation}</p>

      {riskScore.factors.filter(f => f.triggered).length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Active Risk Factors</p>
          {riskScore.factors.filter(f => f.triggered).map(factor => (
            <div key={factor.id} className="rounded-md border bg-card p-3 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{factor.title}</span>
                {factor.isDeterminative ? (
                  <Badge variant="outline" className="text-[10px] bg-violation/10 text-violation border-violation/30">Determinative</Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px]">Contextual</Badge>
                )}
                <span className="ml-auto text-xs text-muted-foreground font-mono">wt: {factor.weight}</span>
              </div>
              <p className="text-xs text-muted-foreground">{factor.whyItMatters}</p>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => setShowDebug(!showDebug)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <Info className="h-3 w-3" />
        <span>View Debug Data</span>
        {showDebug ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {showDebug && (
        <div className="rounded-md border bg-muted/50 p-3 space-y-2 text-xs font-mono animate-fade-in">
          <div className="flex justify-between"><span>Raw Score:</span><span>{riskScore.rawScore}</span></div>
          <div className="flex justify-between"><span>Normalized:</span><span>{riskScore.score}</span></div>
          <div className="flex justify-between"><span>Percentile:</span><span>{riskScore.percentile}th</span></div>
          <div className="flex justify-between"><span>Confidence:</span><span>{riskScore.confidence}%</span></div>
          <div className="mt-2">
            <p className="text-muted-foreground mb-1">Present: {riskScore.dataCompleteness.present.join(', ')}</p>
            <p className="text-muted-foreground">Missing: {riskScore.dataCompleteness.missing.join(', ')}</p>
          </div>
        </div>
      )}
    </div>
  );
}
