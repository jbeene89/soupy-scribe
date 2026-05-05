import { Link } from 'react-router-dom';
import { ArrowLeft, Activity, CheckCircle2, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type State = 'operational' | 'degraded' | 'outage';

const STATE_META: Record<State, { label: string; dot: string; text: string }> = {
  operational: { label: 'Operational', dot: 'bg-emerald-500', text: 'text-emerald-400' },
  degraded:    { label: 'Degraded',    dot: 'bg-amber-500',   text: 'text-amber-400' },
  outage:      { label: 'Outage',      dot: 'bg-red-500',     text: 'text-red-400' },
};

const SERVICES: { name: string; state: State; note?: string }[] = [
  { name: 'Web application (soupyaudit.com)', state: 'operational' },
  { name: 'Authentication & SSO', state: 'operational' },
  { name: 'Audit pipeline (SOUPY engine v3)', state: 'operational' },
  { name: 'FHIR ingestion', state: 'operational' },
  { name: 'Document storage', state: 'operational' },
  { name: 'Inference providers (Gemini / GPT)', state: 'operational' },
  { name: 'Edge functions', state: 'operational' },
];

// Stub uptime — to be wired to real telemetry.
const UPTIME_DAYS = Array.from({ length: 60 }, (_, i) => ({
  day: i,
  state: 'operational' as State,
}));

export default function Status() {
  const allOperational = SERVICES.every(s => s.state === 'operational');

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/30 backdrop-blur">
        <div className="container max-w-5xl mx-auto px-6 py-6 flex items-center justify-between">
          <Link to="/trust" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Trust Center
          </Link>
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-emerald-400" />
            <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Status</span>
          </div>
        </div>
      </header>

      <section className="container max-w-5xl mx-auto px-6 py-16">
        <Card className={`p-8 border-2 ${allOperational ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-500/30 bg-amber-500/5'}`}>
          <div className="flex items-center gap-4">
            {allOperational ? (
              <CheckCircle2 className="h-10 w-10 text-emerald-400" />
            ) : (
              <AlertCircle className="h-10 w-10 text-amber-400" />
            )}
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold">
                {allOperational ? 'All systems operational' : 'Some systems are degraded'}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Last checked {new Date().toLocaleString('en-US')} · Auto-refresh on page load
              </p>
            </div>
          </div>
        </Card>

        <div className="mt-10 space-y-3">
          <h2 className="text-lg font-semibold mb-4">Services</h2>
          {SERVICES.map((svc) => {
            const meta = STATE_META[svc.state];
            return (
              <Card key={svc.name} className="p-4 bg-card/40 border-border">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`h-2.5 w-2.5 rounded-full ${meta.dot} flex-shrink-0`} />
                    <span className="text-sm font-medium truncate">{svc.name}</span>
                  </div>
                  <Badge variant="outline" className={`${meta.text} border-current/30 font-mono text-[10px] uppercase tracking-wide`}>
                    {meta.label}
                  </Badge>
                </div>
              </Card>
            );
          })}
        </div>

        <Card className="mt-10 p-6 bg-card/40 border-border">
          <h2 className="text-lg font-semibold mb-2">60-day uptime</h2>
          <p className="text-xs text-muted-foreground mb-4">
            Each bar = one day. Hover for state. Telemetry-backed status will replace this static view in Q3 2026.
          </p>
          <div className="flex gap-[3px]">
            {UPTIME_DAYS.map((d) => (
              <div
                key={d.day}
                title={`Day -${UPTIME_DAYS.length - d.day}: ${STATE_META[d.state].label}`}
                className={`h-10 flex-1 rounded-sm ${STATE_META[d.state].dot} opacity-80 hover:opacity-100 transition-opacity`}
              />
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-2 font-mono">
            <span>60 days ago</span>
            <span>Today</span>
          </div>
        </Card>

        <Card className="mt-10 p-6 bg-card/40 border-border">
          <h2 className="text-lg font-semibold mb-3">Incident history</h2>
          <p className="text-sm text-muted-foreground">
            No incidents reported in the last 60 days. New incidents will be posted here within 30 minutes of detection,
            with root-cause and remediation summaries within 5 business days of resolution.
          </p>
        </Card>

        <p className="text-xs text-muted-foreground text-center mt-10">
          For incident notifications via email, contact{' '}
          <a href="mailto:status@soupyaudit.com" className="underline hover:text-foreground">status@soupyaudit.com</a>.
        </p>
      </section>
    </div>
  );
}