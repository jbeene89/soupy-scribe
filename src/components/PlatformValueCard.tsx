import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Shield,
  ArrowLeftRight,
  Building2,
  Stethoscope,
  TrendingDown,
  Repeat,
  Zap,
  DollarSign,
  ArrowRight,
} from 'lucide-react';

/** Circular flywheel rendered with pure CSS/SVG */
function FlywheelDiagram() {
  const segments = [
    { label: 'Payer Adopts', sub: 'Audit intelligence layer', color: 'hsl(var(--primary))' },
    { label: 'Provider Demand', sub: 'Same engine, compliance mode', color: 'hsl(var(--accent))' },
    { label: 'Claims Improve', sub: '40-60% fewer flags', color: 'hsl(var(--consensus))' },
    { label: 'Value Compounds', sub: '2x revenue per deal', color: 'hsl(var(--disagreement))' },
  ];

  const cx = 160;
  const cy = 160;
  const r = 120;
  const labelR = 120;
  const segCount = segments.length;

  // Create arc paths for each segment
  const arcs = segments.map((seg, i) => {
    const startAngle = (i / segCount) * 2 * Math.PI - Math.PI / 2;
    const endAngle = ((i + 1) / segCount) * 2 * Math.PI - Math.PI / 2;
    const gap = 0.04; // small gap between segments
    const sa = startAngle + gap;
    const ea = endAngle - gap;

    const x1 = cx + r * Math.cos(sa);
    const y1 = cy + r * Math.sin(sa);
    const x2 = cx + r * Math.cos(ea);
    const y2 = cy + r * Math.sin(ea);

    const midAngle = (sa + ea) / 2;
    const lx = cx + labelR * Math.cos(midAngle);
    const ly = cy + labelR * Math.sin(midAngle);

    // Arrow position (at end of arc)
    const arrowAngle = ea + 0.06;
    const ax = cx + (r + 1) * Math.cos(arrowAngle);
    const ay = cy + (r + 1) * Math.sin(arrowAngle);

    return { seg, sa, ea, x1, y1, x2, y2, lx, ly, ax, ay, midAngle };
  });

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 320 320" className="w-full max-w-[320px] h-auto">
        {/* Background circle */}
        <circle cx={cx} cy={cy} r={r - 20} fill="none" stroke="hsl(var(--border))" strokeWidth="1" strokeDasharray="4 4" />

        {/* Center text */}
        <text x={cx} y={cy - 12} textAnchor="middle" className="fill-foreground text-[11px] font-semibold">
          One Platform
        </text>
        <text x={cx} y={cy + 4} textAnchor="middle" className="fill-muted-foreground text-[9px]">
          Two Markets
        </text>
        <text x={cx} y={cy + 18} textAnchor="middle" className="fill-muted-foreground text-[9px]">
          Compounding Value
        </text>

        {/* Arcs */}
        {arcs.map(({ seg, x1, y1, x2, y2, lx, ly, midAngle }, i) => (
          <g key={i}>
            <path
              d={`M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`}
              fill="none"
              stroke={seg.color}
              strokeWidth="10"
              strokeLinecap="round"
              opacity="0.8"
            />
            {/* Step number dot */}
            <circle
              cx={cx + (r - 28) * Math.cos(midAngle)}
              cy={cy + (r - 28) * Math.sin(midAngle)}
              r="10"
              fill={seg.color}
              opacity="0.15"
            />
            <text
              x={cx + (r - 28) * Math.cos(midAngle)}
              y={cy + (r - 28) * Math.sin(midAngle) + 3.5}
              textAnchor="middle"
              fill={seg.color}
              className="text-[9px] font-bold"
            >
              {String(i + 1).padStart(2, '0')}
            </text>
          </g>
        ))}
      </svg>

      {/* Labels around — rendered as HTML for better readability */}
      <div className="grid grid-cols-2 gap-3 w-full mt-2">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-start gap-2 rounded-md border bg-card p-2.5">
            <div
              className="w-2 h-2 rounded-full mt-1 shrink-0"
              style={{ backgroundColor: seg.color }}
            />
            <div>
              <p className="text-xs font-semibold">{seg.label}</p>
              <p className="text-[10px] text-muted-foreground">{seg.sub}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PlatformValueCard() {
  return (
    <div className="space-y-6">
      {/* Executive summary — the one card they actually read */}
      <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-card to-accent/5 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-primary/10">
              <ArrowLeftRight className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Platform Value Architecture</h2>
              <p className="text-xs text-muted-foreground">
                One intelligence engine — two revenue surfaces — self-reinforcing adoption cycle
              </p>
            </div>
          </div>

          {/* The key insight — big and unmissable */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {[
              { value: '2x', label: 'Revenue per Deal', sub: 'Payer + Provider from single deployment', color: 'text-primary' },
              { value: '$0', label: 'Incremental Eng. Cost', sub: 'Same engine, different posture', color: 'text-consensus' },
              { value: '40-60%', label: 'Audit Volume Reduction', sub: 'When providers use compliance module', color: 'text-accent' },
            ].map((stat, i) => (
              <div key={i} className="rounded-lg border bg-card p-4 text-center">
                <p className={`text-2xl font-bold font-mono ${stat.color}`}>{stat.value}</p>
                <p className="text-xs font-semibold mt-1">{stat.label}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{stat.sub}</p>
              </div>
            ))}
          </div>

          {/* Flywheel diagram */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Repeat className="h-4 w-4 text-accent" />
                <span className="text-xs font-semibold uppercase tracking-wider text-accent">
                  Revenue Flywheel
                </span>
              </div>
              <FlywheelDiagram />
            </div>

            {/* The two modules side by side */}
            <div className="space-y-3">
              {/* Payer */}
              <div className="rounded-lg border p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-primary">Payer Module</span>
                  <Badge variant="outline" className="text-[10px] ml-auto">Revenue Surface 1</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-md border bg-muted/30 p-2 text-center">
                    <p className="text-sm font-bold font-mono text-primary">3.2x</p>
                    <p className="text-[10px] text-muted-foreground">Faster Decisions</p>
                  </div>
                  <div className="rounded-md border bg-muted/30 p-2 text-center">
                    <p className="text-sm font-bold font-mono text-consensus">72%</p>
                    <p className="text-[10px] text-muted-foreground">Fewer Overturns</p>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Adversarial AI catches what rules engines miss. Defensible audit packages with built-in appeal resilience.
                </p>
              </div>

              {/* Arrow */}
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <div className="h-px flex-1 bg-border" />
                <div className="flex items-center gap-1 px-2">
                  <Zap className="h-3 w-3 text-accent" />
                  <span className="text-[10px] font-medium text-accent">Natural Channel Extension</span>
                  <Zap className="h-3 w-3 text-accent" />
                </div>
                <div className="h-px flex-1 bg-border" />
              </div>

              {/* Provider */}
              <div className="rounded-lg border p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Stethoscope className="h-4 w-4 text-accent" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-accent">Provider Module</span>
                  <Badge variant="outline" className="text-[10px] ml-auto">Revenue Surface 2</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-md border bg-muted/30 p-2 text-center">
                    <p className="text-sm font-bold font-mono text-accent">91%</p>
                    <p className="text-[10px] text-muted-foreground">Clean Claim Rate</p>
                  </div>
                  <div className="rounded-md border bg-muted/30 p-2 text-center">
                    <p className="text-sm font-bold font-mono text-consensus">$1.2M</p>
                    <p className="text-[10px] text-muted-foreground">Admin Savings/yr</p>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Providers pre-validate against the same AI that audits them. Documentation confidence as a service.
                </p>
              </div>

              {/* Bottom line */}
              <div className="rounded-md border-2 border-dashed border-accent/30 bg-accent/5 p-3">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-accent" />
                  <p className="text-[11px] font-medium text-foreground">
                    Each payer deployment creates organic provider demand.
                    <span className="text-muted-foreground font-normal ml-1">
                      One sale, two revenue streams, zero additional build.
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}