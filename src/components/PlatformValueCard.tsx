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
  Brain,
  FileText,
  Eye,
  GitCompare,
} from 'lucide-react';

/** Circular flywheel rendered with pure CSS/SVG */
function FlywheelDiagram() {
  const segments = [
    { label: 'Enhances Stack', sub: 'Sits on ClaimsXten + Replay', color: 'hsl(var(--primary))' },
    { label: 'Appeals Drop', sub: 'Pre-tested determinations', color: 'hsl(var(--consensus))' },
    { label: 'Providers Want In', sub: 'Same engine, compliance mode', color: 'hsl(var(--accent))' },
    { label: 'Value Compounds', sub: 'New revenue + lower costs', color: 'hsl(var(--disagreement))' },
  ];

  const cx = 160;
  const cy = 160;
  const r = 120;
  const labelR = 120;
  const segCount = segments.length;

  const arcs = segments.map((seg, i) => {
    const startAngle = (i / segCount) * 2 * Math.PI - Math.PI / 2;
    const endAngle = ((i + 1) / segCount) * 2 * Math.PI - Math.PI / 2;
    const gap = 0.04;
    const sa = startAngle + gap;
    const ea = endAngle - gap;

    const x1 = cx + r * Math.cos(sa);
    const y1 = cy + r * Math.sin(sa);
    const x2 = cx + r * Math.cos(ea);
    const y2 = cy + r * Math.sin(ea);

    const midAngle = (sa + ea) / 2;
    const lx = cx + labelR * Math.cos(midAngle);
    const ly = cy + labelR * Math.sin(midAngle);

    const arrowAngle = ea + 0.06;
    const ax = cx + (r + 1) * Math.cos(arrowAngle);
    const ay = cy + (r + 1) * Math.sin(arrowAngle);

    return { seg, sa, ea, x1, y1, x2, y2, lx, ly, ax, ay, midAngle };
  });

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 320 320" className="w-full max-w-[320px] h-auto">
        <circle cx={cx} cy={cy} r={r - 20} fill="none" stroke="hsl(var(--border))" strokeWidth="1" strokeDasharray="4 4" />

        <text x={cx} y={cy - 12} textAnchor="middle" className="fill-foreground text-[11px] font-semibold">
          SOUPY Layer
        </text>
        <text x={cx} y={cy + 4} textAnchor="middle" className="fill-muted-foreground text-[9px]">
          Enhances Everything
        </text>
        <text x={cx} y={cy + 18} textAnchor="middle" className="fill-muted-foreground text-[9px]">
          Replaces Nothing
        </text>

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
      {/* What SOUPY adds that Lyric doesn't have */}
      <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-card to-accent/5 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-primary/10">
              <ArrowLeftRight className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">What SOUPY Adds to the Lyric Stack</h2>
              <p className="text-xs text-muted-foreground">
                Three capabilities that don't exist in ClaimsXten, Replay, Virtuoso, or ClaimShark
              </p>
            </div>
          </div>

          {/* The three unique capabilities */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {[
              {
                icon: Brain,
                title: 'Adversarial AI Reasoning',
                desc: '4 independent models stress-test every determination. Surfaces weaknesses before provider attorneys do.',
                stat: '4x',
                statLabel: 'Perspectives per case',
                color: 'text-accent',
              },
              {
                icon: FileText,
                title: 'Pre-Built Appeal Defense',
                desc: 'Both sides argued at point of determination. Appeal response ready before the appeal is filed.',
                stat: '0 days',
                statLabel: 'Appeal response time',
                color: 'text-consensus',
              },
              {
                icon: Stethoscope,
                title: 'Provider Revenue Channel',
                desc: 'Same engine, compliance posture. Providers pay to pre-validate against audit-grade AI.',
                stat: '2x',
                statLabel: 'Revenue per payer deal',
                color: 'text-primary',
              },
            ].map((cap, i) => (
              <div key={i} className="rounded-lg border bg-card p-4 space-y-3">
                <cap.icon className={`h-5 w-5 ${cap.color}`} />
                <p className="text-sm font-semibold">{cap.title}</p>
                <p className="text-[10px] text-muted-foreground leading-relaxed">{cap.desc}</p>
                <div className="pt-2 border-t">
                  <p className={`text-xl font-bold font-mono ${cap.color}`}>{cap.stat}</p>
                  <p className="text-[10px] text-muted-foreground">{cap.statLabel}</p>
                </div>
              </div>
            ))}
          </div>

          {/* What it enhances vs what it replaces */}
          <div className="rounded-lg border bg-muted/30 p-4 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <GitCompare className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">Enhancement Map</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { product: 'ClaimsXten', enhancement: 'Adds adversarial depth to edits', status: 'Enhances' },
                { product: 'Replay', enhancement: 'Adds multi-perspective audit reasoning', status: 'Enhances' },
                { product: 'Virtuoso', enhancement: 'Feeds appeal-resilience metrics', status: 'Enhances' },
                { product: 'ClaimShark', enhancement: 'Adds reasoning transparency layer', status: 'Enhances' },
              ].map((item, i) => (
                <div key={i} className="rounded-md border bg-card p-2.5 space-y-1">
                  <p className="text-xs font-semibold">{item.product}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">{item.enhancement}</p>
                  <Badge variant="outline" className="text-[9px] bg-consensus/10 text-consensus border-consensus/30">
                    {item.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          {/* Flywheel */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Repeat className="h-4 w-4 text-accent" />
                <span className="text-xs font-semibold uppercase tracking-wider text-accent">
                  Adoption Flywheel
                </span>
              </div>
              <FlywheelDiagram />
            </div>

            <div className="space-y-3">
              {/* Payer side */}
              <div className="rounded-lg border p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-primary">Payer Enhancement</span>
                  <Badge variant="outline" className="text-[10px] ml-auto">Existing Market</Badge>
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  SOUPY sits on top of your existing PI stack — making determinations defensible before
                  they ship. Not a new product category, an intelligence upgrade.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-md border bg-muted/30 p-2 text-center">
                    <p className="text-sm font-bold font-mono text-consensus">72%</p>
                    <p className="text-[10px] text-muted-foreground">Projected fewer overturned appeals*</p>
                  </div>
                  <div className="rounded-md border bg-muted/30 p-2 text-center">
                    <p className="text-sm font-bold font-mono text-primary">0 days</p>
                    <p className="text-[10px] text-muted-foreground">Appeal defense lead time</p>
                  </div>
                </div>
              </div>

              {/* Arrow */}
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <div className="h-px flex-1 bg-border" />
                <div className="flex items-center gap-1 px-2">
                  <Zap className="h-3 w-3 text-accent" />
                  <span className="text-[10px] font-medium text-accent">Same AI — New Revenue</span>
                  <Zap className="h-3 w-3 text-accent" />
                </div>
                <div className="h-px flex-1 bg-border" />
              </div>

              {/* Provider side */}
              <div className="rounded-lg border-2 border-accent/30 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Stethoscope className="h-4 w-4 text-accent" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-accent">Provider Module</span>
                  <Badge variant="outline" className="text-[10px] ml-auto bg-accent/10 text-accent border-accent/30">New Market</Badge>
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Providers pre-validate claims against the same AI that audits them.
                  "Audit insurance" — they pay to avoid surprises. Sold through existing payer relationships.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-md border bg-muted/30 p-2 text-center">
                    <p className="text-sm font-bold font-mono text-accent">91%</p>
                    <p className="text-[10px] text-muted-foreground">Clean claim rate</p>
                  </div>
                  <div className="rounded-md border bg-muted/30 p-2 text-center">
                    <p className="text-sm font-bold font-mono text-consensus">$1.2M</p>
                    <p className="text-[10px] text-muted-foreground">Admin savings/yr per facility</p>
                  </div>
                </div>
              </div>

              {/* Bottom line */}
              <div className="rounded-md border-2 border-dashed border-accent/30 bg-accent/5 p-3">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-accent" />
                  <p className="text-[11px] font-medium text-foreground">
                    Lyric doesn't sell to providers today.
                    <span className="text-muted-foreground font-normal ml-1">
                      SOUPY turns every payer relationship into a two-sided revenue engine.
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
