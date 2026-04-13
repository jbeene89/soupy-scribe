import { useState, useMemo } from 'react';
import { Calculator, DollarSign, TrendingUp, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

const DEFAULTS = {
  monthlyClaimVolume: 5000,
  avgClaimValue: 1200,
  denialRate: 12,
  currentReviewCostPerClaim: 25,
  reviewCoverage: 30, // % of claims currently reviewed
};

export function ROICalculator() {
  const [expanded, setExpanded] = useState(false);
  const [inputs, setInputs] = useState(DEFAULTS);

  const results = useMemo(() => {
    const { monthlyClaimVolume, avgClaimValue, denialRate, currentReviewCostPerClaim, reviewCoverage } = inputs;

    // Current state
    const claimsReviewed = Math.round(monthlyClaimVolume * (reviewCoverage / 100));
    const currentMonthlyCost = claimsReviewed * currentReviewCostPerClaim;
    const totalDeniedValue = monthlyClaimVolume * (denialRate / 100) * avgClaimValue;

    // With SOUPY — reviews all claims, catches more
    const soupyCostPerClaim = 8; // blended Phase 2 cost
    const soupyMonthlyCost = monthlyClaimVolume * soupyCostPerClaim;
    const soupyCatchRate = 0.78; // conservative
    const currentCatchRate = 0.45; // industry average for manual review on subset

    const currentRecovery = totalDeniedValue * currentCatchRate * (reviewCoverage / 100);
    const soupyRecovery = totalDeniedValue * soupyCatchRate;

    const netCurrentSavings = currentRecovery - currentMonthlyCost;
    const netSoupySavings = soupyRecovery - soupyMonthlyCost;
    const incrementalValue = netSoupySavings - netCurrentSavings;

    // Time savings
    const manualHoursPerMonth = claimsReviewed * 0.5; // 30 min per manual review
    const soupyHoursPerMonth = monthlyClaimVolume * 0.05; // 3 min human touch on flagged only
    const hoursSaved = manualHoursPerMonth - soupyHoursPerMonth;

    return {
      currentMonthlyCost,
      soupyMonthlyCost,
      currentRecovery,
      soupyRecovery,
      incrementalValue,
      hoursSaved: Math.max(0, Math.round(hoursSaved)),
      annualIncrementalValue: incrementalValue * 12,
      coverageIncrease: `${reviewCoverage}% → 100%`,
    };
  }, [inputs]);

  const fmt = (n: number) =>
    n >= 1_000_000
      ? `$${(n / 1_000_000).toFixed(1)}M`
      : n >= 1_000
        ? `$${(n / 1_000).toFixed(0)}K`
        : `$${n.toFixed(0)}`;

  const updateInput = (key: keyof typeof inputs, value: number) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="w-full max-w-3xl mx-auto mt-8 px-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between bg-card border border-border/50 rounded-lg px-4 py-3 hover:bg-accent/30 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Calculator className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">ROI Calculator</span>
          <span className="text-[10px] text-muted-foreground">Estimate your savings</span>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="border border-t-0 border-border/50 rounded-b-lg bg-card/50 p-4 space-y-5 animate-fade-in">
          {/* Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <SliderInput
              label="Monthly claim volume"
              value={inputs.monthlyClaimVolume}
              min={500}
              max={50000}
              step={500}
              format={(v) => v.toLocaleString()}
              onChange={(v) => updateInput('monthlyClaimVolume', v)}
            />
            <SliderInput
              label="Avg claim value"
              value={inputs.avgClaimValue}
              min={200}
              max={10000}
              step={100}
              format={(v) => `$${v.toLocaleString()}`}
              onChange={(v) => updateInput('avgClaimValue', v)}
            />
            <SliderInput
              label="Denial rate"
              value={inputs.denialRate}
              min={2}
              max={30}
              step={1}
              format={(v) => `${v}%`}
              onChange={(v) => updateInput('denialRate', v)}
            />
            <SliderInput
              label="Current review coverage"
              value={inputs.reviewCoverage}
              min={5}
              max={100}
              step={5}
              format={(v) => `${v}%`}
              onChange={(v) => updateInput('reviewCoverage', v)}
            />
            <SliderInput
              label="Current cost per review"
              value={inputs.currentReviewCostPerClaim}
              min={5}
              max={50}
              step={1}
              format={(v) => `$${v}`}
              onChange={(v) => updateInput('currentReviewCostPerClaim', v)}
            />
          </div>

          {/* Results */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <ResultCard
              label="Incremental Monthly Value"
              value={fmt(results.incrementalValue)}
              icon={DollarSign}
              highlight
            />
            <ResultCard
              label="Annual Impact"
              value={fmt(results.annualIncrementalValue)}
              icon={TrendingUp}
            />
            <ResultCard
              label="Hours Saved / Month"
              value={`${results.hoursSaved}`}
              icon={Clock}
            />
            <ResultCard
              label="Coverage"
              value={results.coverageIncrease}
              icon={TrendingUp}
            />
          </div>

          {/* Comparison bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Net monthly recovery</span>
            </div>
            <ComparisonBar
              label="Current"
              value={results.currentRecovery - results.currentMonthlyCost}
              maxValue={results.soupyRecovery}
              color="bg-muted-foreground/30"
            />
            <ComparisonBar
              label="With SOUPY"
              value={results.soupyRecovery - results.soupyMonthlyCost}
              maxValue={results.soupyRecovery}
              color="bg-primary"
            />
          </div>

          <p className="text-[9px] text-muted-foreground/50 leading-relaxed">
            Estimates based on industry averages. Actual results depend on payer mix, case complexity, and documentation quality. SOUPY cost modeled at $8/claim blended rate for Phase 2+ engagement.
          </p>
        </div>
      )}
    </div>
  );
}

function SliderInput({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">{label}</span>
        <span className="text-[11px] font-semibold text-foreground">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-secondary rounded-full appearance-none cursor-pointer accent-primary"
      />
    </div>
  );
}

function ResultCard({
  label,
  value,
  icon: Icon,
  highlight,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border p-3 text-center',
        highlight
          ? 'border-primary/30 bg-primary/5'
          : 'border-border/30 bg-card/30'
      )}
    >
      <Icon className={cn('h-3.5 w-3.5 mx-auto mb-1', highlight ? 'text-primary' : 'text-muted-foreground')} />
      <div className={cn('text-base font-bold', highlight ? 'text-primary' : 'text-foreground')}>
        {value}
      </div>
      <div className="text-[9px] text-muted-foreground leading-tight mt-0.5">{label}</div>
    </div>
  );
}

function ComparisonBar({
  label,
  value,
  maxValue,
  color,
}: {
  label: string;
  value: number;
  maxValue: number;
  color: string;
}) {
  const pct = maxValue > 0 ? Math.max(5, (Math.max(0, value) / maxValue) * 100) : 5;
  const fmt = (n: number) =>
    n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${(n / 1_000).toFixed(0)}K` : `$${n.toFixed(0)}`;

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-muted-foreground w-16 shrink-0">{label}</span>
      <div className="flex-1 bg-secondary/30 rounded-full h-4 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500 flex items-center justify-end pr-2', color)}
          style={{ width: `${pct}%` }}
        >
          <span className="text-[9px] font-semibold text-white whitespace-nowrap">
            {fmt(value)}
          </span>
        </div>
      </div>
    </div>
  );
}
