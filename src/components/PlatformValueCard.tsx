import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Shield,
  ArrowLeftRight,
  Building2,
  Stethoscope,
  TrendingDown,
  Repeat,
  Zap,
  DollarSign,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function PlatformValueCard() {
  return (
    <Card className="border bg-card shadow-sm overflow-hidden">
      <CardContent className="p-0">
        {/* Dual-market header */}
        <div className="bg-gradient-to-r from-primary/5 via-transparent to-accent/5 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <ArrowLeftRight className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Dual-Market Intelligence Platform</h2>
              <p className="text-xs text-muted-foreground">
                One engine — two revenue surfaces — continuous feedback loop
              </p>
            </div>
          </div>
        </div>

        {/* The flywheel visual */}
        <div className="px-5 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Payer side */}
            <div className="rounded-lg border bg-primary/3 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                  Payer Module
                </span>
                <Badge variant="outline" className="text-[10px] ml-auto">Revenue Surface 1</Badge>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Payment integrity teams get adversarial AI analysis that catches what rules engines miss — 
                reducing false positives, accelerating determinations, and generating defensible audit packages 
                with built-in appeal resilience.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md border bg-card p-2.5 text-center">
                  <p className="text-sm font-semibold font-mono text-primary">3.2x</p>
                  <p className="text-[10px] text-muted-foreground">Faster Determinations</p>
                </div>
                <div className="rounded-md border bg-card p-2.5 text-center">
                  <p className="text-sm font-semibold font-mono text-consensus">72%</p>
                  <p className="text-[10px] text-muted-foreground">Fewer Overturned Appeals</p>
                </div>
              </div>
              <div className="flex items-start gap-2 rounded-md bg-muted/50 p-2.5">
                <Zap className="h-3.5 w-3.5 text-accent mt-0.5 shrink-0" />
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  <span className="font-medium text-foreground">Downstream revenue unlock: </span>
                  Payers who reduce provider friction create natural demand for proactive compliance tools — 
                  which this platform already provides.
                </p>
              </div>
            </div>

            {/* Provider side */}
            <div className="rounded-lg border bg-accent/3 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Stethoscope className="h-4 w-4 text-accent" />
                <span className="text-xs font-semibold uppercase tracking-wider text-accent">
                  Provider Module
                </span>
                <Badge variant="outline" className="text-[10px] ml-auto">Revenue Surface 2</Badge>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Facilities and physician groups receive the same intelligence payers use — 
                enabling pre-submission documentation optimization, reducing denial rates, 
                and eliminating the administrative cost of reactive compliance.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md border bg-card p-2.5 text-center">
                  <p className="text-sm font-semibold font-mono text-accent">91%</p>
                  <p className="text-[10px] text-muted-foreground">Clean Claim Rate</p>
                </div>
                <div className="rounded-md border bg-card p-2.5 text-center">
                  <p className="text-sm font-semibold font-mono text-consensus">$1.2M</p>
                  <p className="text-[10px] text-muted-foreground">Annual Admin Savings</p>
                </div>
              </div>
              <div className="flex items-start gap-2 rounded-md bg-muted/50 p-2.5">
                <Shield className="h-3.5 w-3.5 text-consensus mt-0.5 shrink-0" />
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  <span className="font-medium text-foreground">Provider positioning: </span>
                  Providers see this as documentation confidence — the assurance that submissions 
                  are pre-validated against the same AI that audits them. Natural upsell from payer relationship.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* The flywheel */}
        <div className="px-5 pb-5">
          <div className="rounded-lg border-2 border-dashed border-accent/30 bg-accent/3 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Repeat className="h-4 w-4 text-accent" />
              <span className="text-xs font-semibold uppercase tracking-wider text-accent">
                The Efficiency Flywheel
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {[
                {
                  step: '01',
                  label: 'Payer Adopts',
                  detail: 'Audit intelligence reduces false flags and appeal losses',
                  icon: Building2,
                },
                {
                  step: '02',
                  label: 'Providers Want In',
                  detail: 'Same AI engine offered as compliance tool — natural channel partner upsell',
                  icon: Stethoscope,
                },
                {
                  step: '03',
                  label: 'Claims Improve',
                  detail: 'Upstream accuracy reduces payer audit volume by 40-60%',
                  icon: TrendingDown,
                },
                {
                  step: '04',
                  label: 'Value Compounds',
                  detail: 'Lower audit costs + provider retention + new revenue stream per payer relationship',
                  icon: DollarSign,
                },
              ].map((item, i) => (
                <div key={i} className="relative">
                  <div className="rounded-md border bg-card p-3 space-y-1.5 h-full">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold text-accent">{item.step}</span>
                      <item.icon className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <p className="text-xs font-semibold">{item.label}</p>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">{item.detail}</p>
                  </div>
                  {i < 3 && (
                    <div className="hidden md:block absolute top-1/2 -right-2 -translate-y-1/2 text-accent/50 text-xs font-bold z-10">
                      →
                    </div>
                  )}
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-3 text-center italic">
              Each payer deployment creates organic demand for the provider-facing module — 
              one platform sale generates two revenue streams with zero incremental engineering cost.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
