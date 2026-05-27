import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Wallet, TrendingUp, ArrowRightLeft } from 'lucide-react';
import type { CapacityEvent } from '@/lib/capacityTypes';
import { computeRedeployment } from '@/lib/redeploymentLogic';
import { cn } from '@/lib/utils';

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

export function RedeploymentPanel({ events }: { events: CapacityEvent[] }) {
  const summary = useMemo(() => computeRedeployment(events), [events]);

  if (summary.slackFteWeekly <= 0) {
    return (
      <Card className="p-6 text-sm text-muted-foreground">
        No dormant capacity detected in the current event log. Redeployment opportunities appear when
        under-ratio shifts (overstaffed vs. census) are recorded.
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 border-l-4 border-l-primary">
        <div className="flex items-start gap-2">
          <ArrowRightLeft className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div className="space-y-1">
            <div className="font-semibold text-sm">Redeployment opportunity, not headcount reduction</div>
            <div className="text-xs text-muted-foreground">
              Dormant capacity is already paid for. The fastest ROI is pointing it at revenue-protecting work
              currently going undone — not cuts. CFO/COO framing, not HR.
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard
          icon={<Users className="h-4 w-4 text-primary" />}
          label="Slack capacity (weekly)"
          value={`${summary.slackFteWeekly} FTE`}
          sub={`${Math.round(summary.slackHoursWeekly)} hours / week`}
        />
        <StatCard
          icon={<Wallet className="h-4 w-4 text-disagreement" />}
          label="Already-paid labor (weekly)"
          value={fmt(summary.slackLaborCostWeekly)}
          sub="Burning whether redeployed or not"
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4 text-consensus" />}
          label="Annualized slack cost"
          value={fmt(summary.annualizedSlackCost)}
          sub="Pre-redeployment baseline"
          tone="primary"
        />
      </div>

      <div className="space-y-2">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold px-1">
          Ranked redeployment targets
        </div>
        {summary.topTargets.map((t, i) => (
          <Card key={t.id} className={cn('p-4', i === 0 && 'border-l-4 border-l-consensus')}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">{t.title}</span>
                  <SkillBadge gap={t.skillGap} />
                  {i === 0 && <Badge className="bg-consensus text-consensus-foreground text-[10px]">Top ROI</Badge>}
                </div>
                <div className="text-xs text-muted-foreground max-w-2xl">{t.description}</div>
                <div className="text-[11px] text-muted-foreground">
                  Redeploy from: <span className="font-medium text-foreground">{t.fromFunctions.join(' · ')}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-sm text-consensus">{fmt(t.potentialAnnualRecovery)}</div>
                <div className="text-[10px] text-muted-foreground">
                  /yr potential · {fmt(t.recoveryPerFtePerYear)}/FTE
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub, tone }: { icon: React.ReactNode; label: string; value: string; sub?: string; tone?: 'primary' }) {
  return (
    <Card className={cn('p-4 space-y-1', tone === 'primary' && 'border-l-4 border-l-primary')}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        {icon}{label}
      </div>
      <div className="text-xl font-bold">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
    </Card>
  );
}

function SkillBadge({ gap }: { gap: 'none' | 'training-light' | 'cert-required' }) {
  const map = {
    'none': { label: 'No training', cls: 'bg-consensus/15 text-consensus border-consensus/30' },
    'training-light': { label: 'Light training', cls: 'bg-amber-500/15 text-amber-600 border-amber-500/30' },
    'cert-required': { label: 'Cert required', cls: 'bg-violation/15 text-violation border-violation/30' },
  };
  const m = map[gap];
  return <Badge variant="outline" className={cn('text-[10px]', m.cls)}>{m.label}</Badge>;
}