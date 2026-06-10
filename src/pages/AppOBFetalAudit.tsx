import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Play, Download, Sparkles, HeartPulse, AlertTriangle, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { SEO } from '@/components/SEO';
import { StripIngestDropzones, EMPTY_INGEST, type IngestState } from '@/components/ob/StripIngestDropzones';
import { StripTimeline } from '@/components/ob/StripTimeline';
import { StopRuleViolationsPanel } from '@/components/ob/StopRuleViolationsPanel';
import { ContraindicationLedger } from '@/components/ob/ContraindicationLedger';
import { runOBAudit, buildDemoOBBundle } from '@/lib/obFetalService';
import { exportOBAuditPDF } from '@/lib/exportOBAuditPDF';
import { exportOBComplaintPacketPDF } from '@/lib/exportOBComplaintPacketPDF';
import type { OBAuditResult } from '@/lib/obFetalTypes';

export default function AppOBFetalAudit() {
  const [ingest, setIngest] = useState<IngestState>(EMPTY_INGEST);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<OBAuditResult | null>(null);

  const hasInput =
    ingest.stripSamples.length > 0 ||
    ingest.stripImages.length > 0 ||
    ingest.marEvents.length > 0 ||
    ingest.vitalsReadings.length > 0 ||
    ingest.careEvents.length > 0;

  async function handleRun(payloadOverride?: Parameters<typeof runOBAudit>[0]) {
    setRunning(true);
    try {
      const payload = payloadOverride ?? {
        stripSamples: ingest.stripSamples,
        stripImages: ingest.stripImages,
        marEvents: ingest.marEvents,
        vitalsReadings: ingest.vitalsReadings,
        careEvents: ingest.careEvents,
        notesText: ingest.notesText,
        windowMinutes: 10,
        caseHeader: ingest.caseHeader,
      };
      const r = await runOBAudit(payload);
      setResult(r);
      const total = r.violations.length;
      toast.success(total === 0 ? 'Audit complete — no violations.' : `Audit complete — ${total} stop-rule violation${total === 1 ? '' : 's'}.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  async function handleDemo() {
    const demo = buildDemoOBBundle();
    setIngest({
      stripSamples: demo.stripSamples ?? [],
      stripImages: [],
      marEvents: demo.marEvents ?? [],
      vitalsReadings: demo.vitalsReadings ?? [],
      careEvents: demo.careEvents ?? [],
      notesText: demo.notesText ?? '',
      parseWarnings: [],
      caseHeader: demo.caseHeader ?? {},
    });
    await handleRun(demo);
  }

  function handleReset() {
    setIngest(EMPTY_INGEST);
    setResult(null);
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-7xl">
      <SEO path="/app/ob-fetal-audit" title="OB Fetal Monitoring Audit — SOUPY Audit" description="Audit fetal monitor strips against medication administration. Detect Pitocin and Misoprostol stop-rule violations with verbatim evidence." />

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <HeartPulse className="h-6 w-6 text-primary" />
            L&amp;D Fetal Monitoring Audit
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
            Retrospective audit of the fetal monitor strip against the medications given. Flags every moment Pitocin or Misoprostol should have been held, decreased, or discontinued — with the timestamp, the strip finding, and the verbatim charted response (or "no documented action").
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button variant="outline" size="sm" onClick={handleDemo} disabled={running}>
            <Sparkles className="h-4 w-4 mr-1.5" /> Load demo case
          </Button>
          {(hasInput || result) && (
            <Button variant="ghost" size="sm" onClick={handleReset} disabled={running}>
              <RotateCcw className="h-4 w-4 mr-1.5" /> Reset
            </Button>
          )}
        </div>
      </div>

      <Card className="p-4 bg-muted/30">
        <div className="flex items-start gap-2 text-xs">
          <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5" />
          <div>
            <span className="font-semibold">Retrospective decision-support only.</span> Not for real-time monitoring and not a substitute for clinical judgment. Stop-rules in v1 cover Oxytocin (Pitocin) and Misoprostol / Cervidil per ACOG / AWHONN guidance. Magnesium and tocolytic rules are on the roadmap.
          </div>
        </div>
      </Card>

      <StripIngestDropzones value={ingest} onChange={setIngest} />

      {ingest.parseWarnings.length > 0 && (
        <Card className="p-3 border-amber-500/40 bg-amber-500/5">
          <div className="text-xs font-semibold mb-1">Parse warnings ({ingest.parseWarnings.length})</div>
          <ul className="text-xs text-muted-foreground space-y-0.5 max-h-32 overflow-auto">
            {ingest.parseWarnings.slice(0, 20).map((w, i) => <li key={i}>• {w}</li>)}
          </ul>
        </Card>
      )}

      <div className="flex justify-end">
        <Button onClick={() => handleRun()} disabled={!hasInput || running} size="lg">
          <Play className="h-4 w-4 mr-1.5" />
          {running ? 'Running audit…' : 'Run OB audit'}
        </Button>
      </div>

      {result && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
            <SummaryTile label="Cat I windows" value={result.summary.catI} tone="ok" />
            <SummaryTile label="Cat II windows" value={result.summary.catII} tone="warn" />
            <SummaryTile label="Cat III windows" value={result.summary.catIII} tone="bad" />
            <SummaryTile label="Tachysystole" value={result.summary.tachysystoleWindows} tone="warn" />
            <SummaryTile label="Critical violations" value={result.summary.criticalViolations} tone="bad" />
            <SummaryTile label="Hypotension episodes" value={result.summary.hypotensionEpisodes} tone="bad" />
            <SummaryTile label="Unattended gaps" value={result.summary.unattendedGaps} tone="warn" />
            <SummaryTile label="Consent / scope flags" value={result.summary.consentScopeFlags} tone="warn" />
          </div>

          <Tabs defaultValue="violations" className="w-full">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <TabsList>
                <TabsTrigger value="violations">Violations ({result.violations.length})</TabsTrigger>
                <TabsTrigger value="contraindications">Contraindications ({result.contraindicationChecks.length})</TabsTrigger>
                <TabsTrigger value="timeline">Timeline ({result.windows.length})</TabsTrigger>
              </TabsList>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">{result.monitoredMinutes} min monitored</Badge>
                <Button size="sm" variant="outline" onClick={() => exportOBAuditPDF(result)}>
                  <Download className="h-3.5 w-3.5 mr-1.5" /> Timeline PDF
                </Button>
                <Button size="sm" onClick={() => exportOBComplaintPacketPDF(result)}>
                  <Download className="h-3.5 w-3.5 mr-1.5" /> Complaint packet
                </Button>
              </div>
            </div>
            <TabsContent value="violations" className="mt-4"><StopRuleViolationsPanel result={result} /></TabsContent>
            <TabsContent value="contraindications" className="mt-4"><ContraindicationLedger result={result} /></TabsContent>
            <TabsContent value="timeline" className="mt-4"><StripTimeline result={result} /></TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

function SummaryTile({ label, value, tone }: { label: string; value: number; tone: 'ok' | 'warn' | 'bad' }) {
  const cls =
    tone === 'bad' ? 'border-destructive/40 bg-destructive/5 text-destructive'
    : tone === 'warn' ? 'border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-300'
    : 'border-emerald-500/40 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300';
  return (
    <Card className={`p-3 border ${cls}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-[11px] uppercase tracking-wide opacity-80">{label}</div>
    </Card>
  );
}
