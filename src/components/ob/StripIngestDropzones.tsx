import { useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Upload, X, Activity, Pill, FileText, Image as ImageIcon, HeartPulse, ClipboardList, UserSquare2, Camera, Loader2 } from 'lucide-react';
import { parseStripCSV, parseMAR, parseVitals, parseCareEvents, fileToText, fileToDataURL } from '@/lib/obFetalParser';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { CareEvent, MAREvent, OBCaseHeader, StripSample, VitalsReading } from '@/lib/obFetalTypes';

export interface IngestState {
  stripSamples: StripSample[];
  stripImages: { filename: string; dataUrl: string }[];
  marEvents: MAREvent[];
  vitalsReadings: VitalsReading[];
  careEvents: CareEvent[];
  notesText: string;
  parseWarnings: string[];
  caseHeader: OBCaseHeader;
}

export const EMPTY_INGEST: IngestState = {
  stripSamples: [],
  stripImages: [],
  marEvents: [],
  vitalsReadings: [],
  careEvents: [],
  notesText: '',
  parseWarnings: [],
  caseHeader: {},
};

export function StripIngestDropzones({
  value,
  onChange,
}: {
  value: IngestState;
  onChange: (next: IngestState) => void;
}) {
  const stripRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const marRef = useRef<HTMLInputElement>(null);
  const vitalsRef = useRef<HTMLInputElement>(null);
  const careRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const ocrRef = useRef<HTMLInputElement>(null);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrLog, setOcrLog] = useState<string[]>([]);

  async function handleStripFile(file: File) {
    setBusy(true);
    const text = await fileToText(file);
    const { samples, warnings } = parseStripCSV(text);
    onChange({
      ...value,
      stripSamples: samples,
      parseWarnings: [...value.parseWarnings.filter((w) => !w.startsWith('Strip:')), ...warnings.map((w) => `Strip: ${w}`)],
    });
    setBusy(false);
  }

  async function handleImages(files: FileList) {
    setBusy(true);
    const next: { filename: string; dataUrl: string }[] = [];
    for (const f of Array.from(files)) {
      const url = await fileToDataURL(f);
      next.push({ filename: f.name, dataUrl: url });
    }
    onChange({ ...value, stripImages: [...value.stripImages, ...next] });
    setBusy(false);
  }

  async function handleMARFile(file: File) {
    setBusy(true);
    const text = await fileToText(file);
    const { events, warnings } = parseMAR(text);
    onChange({
      ...value,
      marEvents: events,
      parseWarnings: [...value.parseWarnings.filter((w) => !w.startsWith('MAR:')), ...warnings.map((w) => `MAR: ${w}`)],
    });
    setBusy(false);
  }

  async function handleVitalsFile(file: File) {
    setBusy(true);
    const text = await fileToText(file);
    const { readings, warnings } = parseVitals(text);
    onChange({
      ...value,
      vitalsReadings: readings,
      parseWarnings: [...value.parseWarnings.filter((w) => !w.startsWith('Vitals:')), ...warnings.map((w) => `Vitals: ${w}`)],
    });
    setBusy(false);
  }

  async function handleCareFile(file: File) {
    setBusy(true);
    const text = await fileToText(file);
    const { events, warnings } = parseCareEvents(text);
    onChange({
      ...value,
      careEvents: events,
      parseWarnings: [...value.parseWarnings.filter((w) => !w.startsWith('Care:')), ...warnings.map((w) => `Care: ${w}`)],
    });
    setBusy(false);
  }

  function updateHeader(patch: Partial<OBCaseHeader>) {
    onChange({ ...value, caseHeader: { ...value.caseHeader, ...patch } });
  }

  async function handleOcrPhotos(files: FileList) {
    setOcrBusy(true);
    setOcrLog([]);
    try {
      const images: { filename: string; dataUrl: string }[] = [];
      for (const f of Array.from(files)) {
        images.push({ filename: f.name, dataUrl: await fileToDataURL(f) });
      }
      const anchorDate = value.caseHeader.dateOfAdmission || value.caseHeader.dateOfDelivery;
      const { data, error } = await supabase.functions.invoke('ob-photo-ocr', {
        body: { images, anchorDate },
      });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      const newVitals = (data?.vitalsReadings || []) as VitalsReading[];
      const newCare = (data?.careEvents || []) as CareEvent[];
      const perImage = data?.perImage || [];
      const warnings = (data?.warnings || []) as string[];
      onChange({
        ...value,
        vitalsReadings: dedupByEvidence([...value.vitalsReadings, ...newVitals]),
        careEvents: dedupByEvidence([...value.careEvents, ...newCare]),
        parseWarnings: [...value.parseWarnings, ...warnings.map((w) => `Photo: ${w}`)],
      });
      setOcrLog(perImage.map((p: any) =>
        p.error
          ? `${p.filename}: ${p.error}`
          : `${p.filename} (${p.artifact_type}): ${p.vitalsCount} vitals + ${p.careCount} care events`
      ));
      toast.success(`Transcribed ${newVitals.length} vitals + ${newCare.length} care events from ${images.length} photo${images.length === 1 ? '' : 's'}.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setOcrBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Case header */}
      <Card className="p-4">
        <div className="flex items-center gap-2 text-sm font-semibold mb-3">
          <UserSquare2 className="h-4 w-4 text-primary" /> Case header (for the complaint packet)
        </div>
        <div className="grid gap-2 md:grid-cols-3 text-xs">
          <LabeledInput label="Patient initials" value={value.caseHeader.patientInitials || ''} onChange={(v) => updateHeader({ patientInitials: v })} />
          <LabeledInput label="Facility" value={value.caseHeader.facility || ''} onChange={(v) => updateHeader({ facility: v })} placeholder="e.g. Baptist Medical Center Downtown" />
          <LabeledInput label="Unit" value={value.caseHeader.unit || ''} onChange={(v) => updateHeader({ unit: v })} placeholder="e.g. Labor & Delivery" />
          <LabeledInput label="Room number" value={value.caseHeader.roomNumber || ''} onChange={(v) => updateHeader({ roomNumber: v })} />
          <LabeledInput label="Attending OB" value={value.caseHeader.attendingOB || ''} onChange={(v) => updateHeader({ attendingOB: v })} />
          <LabeledInput label="Date of admission" value={value.caseHeader.dateOfAdmission || ''} onChange={(v) => updateHeader({ dateOfAdmission: v })} placeholder="YYYY-MM-DD" />
          <LabeledInput label="Date of delivery" value={value.caseHeader.dateOfDelivery || ''} onChange={(v) => updateHeader({ dateOfDelivery: v })} placeholder="YYYY-MM-DD" />
          <LabeledInput label="Prepared by" value={value.caseHeader.authorName || ''} onChange={(v) => updateHeader({ authorName: v })} />
        </div>
        <div className="mt-3">
          <div className="text-[11px] font-semibold text-muted-foreground mb-1">Narrative (your description of what happened)</div>
          <Textarea
            value={value.caseHeader.narrative || ''}
            onChange={(e) => updateHeader({ narrative: e.target.value })}
            placeholder="Plain-language summary of the admission and the events you observed. This is reprinted at the top of the complaint packet."
            className="min-h-[100px] text-xs"
          />
        </div>
      </Card>

    <div className="grid gap-3 md:grid-cols-2">
      {/* Strip CSV */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-sm font-semibold"><Activity className="h-4 w-4 text-primary" /> Structured strip export</div>
          <Badge variant="secondary">{value.stripSamples.length} samples</Badge>
        </div>
        <p className="text-xs text-muted-foreground mb-3">CSV / TSV with columns like <code>timestamp</code>, <code>fhr</code>, <code>uc</code> from PeriGen / OBIX / Centricity / Philips.</p>
        <input ref={stripRef} type="file" accept=".csv,.tsv,.txt,text/csv" className="hidden"
          onChange={(e) => e.target.files?.[0] && handleStripFile(e.target.files[0])} />
        <Button size="sm" variant="outline" onClick={() => stripRef.current?.click()} disabled={busy}>
          <Upload className="h-3.5 w-3.5 mr-1.5" /> Choose CSV
        </Button>
      </Card>

      {/* Strip images */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-sm font-semibold"><ImageIcon className="h-4 w-4 text-primary" /> Strip images / scans</div>
          <Badge variant="secondary">{value.stripImages.length} images</Badge>
        </div>
        <p className="text-xs text-muted-foreground mb-3">PNG / JPG photos or scans of the paper tracing. The audit engine reads each image into 10-minute windows.</p>
        <input ref={imgRef} type="file" accept="image/*" multiple className="hidden"
          onChange={(e) => e.target.files && handleImages(e.target.files)} />
        <div className="flex flex-wrap gap-2 mb-2">
          {value.stripImages.map((im, i) => (
            <Badge key={i} variant="outline" className="gap-1">
              {im.filename}
              <button onClick={() => onChange({ ...value, stripImages: value.stripImages.filter((_, j) => j !== i) })} aria-label="remove">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
        <Button size="sm" variant="outline" onClick={() => imgRef.current?.click()} disabled={busy}>
          <Upload className="h-3.5 w-3.5 mr-1.5" /> Add images
        </Button>
      </Card>

      {/* MAR */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-sm font-semibold"><Pill className="h-4 w-4 text-primary" /> Medication record (MAR)</div>
          <Badge variant="secondary">{value.marEvents.length} events</Badge>
        </div>
        <p className="text-xs text-muted-foreground mb-3">CSV with <code>time, medication, action, amount, unit</code> — or paste free-text lines like "14:32 Pitocin increased to 8 mU/min" below.</p>
        <input ref={marRef} type="file" accept=".csv,.tsv,.txt,text/csv" className="hidden"
          onChange={(e) => e.target.files?.[0] && handleMARFile(e.target.files[0])} />
        <div className="flex gap-2 mb-2">
          <Button size="sm" variant="outline" onClick={() => marRef.current?.click()} disabled={busy}>
            <Upload className="h-3.5 w-3.5 mr-1.5" /> Choose CSV
          </Button>
        </div>
        <Textarea
          placeholder="08:00 Pitocin started at 2 mU/min&#10;08:30 Pitocin increased to 6 mU/min&#10;09:00 Pitocin increased to 10 mU/min"
          className="min-h-[88px] text-xs font-mono"
          onBlur={(e) => {
            const { events, warnings } = parseMAR(e.target.value);
            if (events.length) onChange({
              ...value,
              marEvents: [...value.marEvents, ...events],
              parseWarnings: [...value.parseWarnings, ...warnings.map((w) => `MAR: ${w}`)],
            });
          }}
        />
      </Card>

      {/* Vitals */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-sm font-semibold"><HeartPulse className="h-4 w-4 text-primary" /> Maternal vitals flowsheet</div>
          <Badge variant="secondary">{value.vitalsReadings.length} readings</Badge>
        </div>
        <p className="text-xs text-muted-foreground mb-3">CSV with <code>time, sbp, dbp, hr, spo2</code> — or paste free-text like "21:14 BP 52/36 HR 118".</p>
        <input ref={vitalsRef} type="file" accept=".csv,.tsv,.txt,text/csv" className="hidden"
          onChange={(e) => e.target.files?.[0] && handleVitalsFile(e.target.files[0])} />
        <div className="flex gap-2 mb-2">
          <Button size="sm" variant="outline" onClick={() => vitalsRef.current?.click()} disabled={busy}>
            <Upload className="h-3.5 w-3.5 mr-1.5" /> Choose CSV
          </Button>
        </div>
        <Textarea
          placeholder="18:00 BP 54/36 HR 118&#10;18:15 BP 98/60 HR 96"
          className="min-h-[88px] text-xs font-mono"
          onBlur={(e) => {
            const { readings, warnings } = parseVitals(e.target.value);
            if (readings.length) onChange({
              ...value,
              vitalsReadings: [...value.vitalsReadings, ...readings],
              parseWarnings: [...value.parseWarnings, ...warnings.map((w) => `Vitals: ${w}`)],
            });
          }}
        />
      </Card>

      {/* Care events */}
      <Card className="p-4 md:col-span-2">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-sm font-semibold"><ClipboardList className="h-4 w-4 text-primary" /> Nursing / care events</div>
          <Badge variant="secondary">{value.careEvents.length} events</Badge>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          One line per event with a timestamp. The audit recognises phrases like
          <code> cervidil placed</code>, <code>membrane sweep</code>, <code>cervical exam</code>,
          <code>consent obtained</code>, <code>provider order</code>, <code>RN at bedside</code>,
          <code>provider notified</code>, <code>IV bolus</code>, <code>reposition</code>.
          These power the unattended-patient and consent / scope-of-practice rules.
        </p>
        <input ref={careRef} type="file" accept=".txt,.csv,.tsv" className="hidden"
          onChange={(e) => e.target.files?.[0] && handleCareFile(e.target.files[0])} />
        <div className="flex gap-2 mb-2">
          <Button size="sm" variant="outline" onClick={() => careRef.current?.click()} disabled={busy}>
            <Upload className="h-3.5 w-3.5 mr-1.5" /> Choose file
          </Button>
        </div>
        <Textarea
          placeholder="18:35 Cervidil placed by RN&#10;18:36 Membrane sweep performed (no consent documented)&#10;22:30 Provider notified, Pitocin order received&#10;03:30 Last vitals check&#10;07:15 RN at bedside"
          className="min-h-[100px] text-xs font-mono"
          onBlur={(e) => {
            const { events, warnings } = parseCareEvents(e.target.value);
            if (events.length) onChange({
              ...value,
              careEvents: [...value.careEvents, ...events],
              parseWarnings: [...value.parseWarnings, ...warnings.map((w) => `Care: ${w}`)],
            });
          }}
        />
      </Card>

      {/* Notes */}
      <Card className="p-4 md:col-span-2">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-sm font-semibold"><FileText className="h-4 w-4 text-primary" /> Clinical notes</div>
          <Badge variant="secondary">{value.notesText.length} chars</Badge>
        </div>
        <p className="text-xs text-muted-foreground mb-3">Paste nursing / provider notes. Lines with HH:MM timestamps are matched against violations to pull verbatim "charted response" quotes.</p>
        <Textarea
          placeholder="08:30 Reassuring tracing per RN.&#10;09:05 Mod variability noted.&#10;09:25 Provider notified of recurrent late decels."
          className="min-h-[140px] text-xs"
          value={value.notesText}
          onChange={(e) => onChange({ ...value, notesText: e.target.value })}
        />
      </Card>

      {/* Photo OCR */}
      <Card className="p-4 md:col-span-2 border-primary/30 bg-primary/[0.03]">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Camera className="h-4 w-4 text-primary" /> Photo OCR — drop pictures of paper chart pages
          </div>
          {ocrBusy && <Badge variant="secondary" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" /> reading photos…</Badge>}
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Drop photos of printed monitor vitals columns, paper MAR pages, nursing flowsheets, or the
          "Birthing Room" sign-in log. The AI transcribes each row into structured vitals and care
          events and adds them to the boxes above. Times like <code>11:33</code>, <code>0420</code>,
          or <code>2-26-26 23:35</code> are all understood. If the case header has a date of admission,
          rows that only show a clock time are anchored to that date.
        </p>
        <input ref={ocrRef} type="file" accept="image/*" multiple className="hidden"
          onChange={(e) => e.target.files && e.target.files.length > 0 && handleOcrPhotos(e.target.files)} />
        <Button size="sm" onClick={() => ocrRef.current?.click()} disabled={ocrBusy}>
          <Camera className="h-3.5 w-3.5 mr-1.5" /> {ocrBusy ? 'Transcribing…' : 'Add chart photos'}
        </Button>
        {ocrLog.length > 0 && (
          <ul className="mt-3 text-[11px] text-muted-foreground space-y-0.5">
            {ocrLog.map((l, i) => <li key={i}>• {l}</li>)}
          </ul>
        )}
      </Card>
    </div>
    </div>
  );
}

function LabeledInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold text-muted-foreground mb-1">{label}</span>
      <Input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="h-8 text-xs" />
    </label>
  );
}

function dedupByEvidence<T extends { t: string; evidence?: string; description?: string }>(arr: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const r of arr) {
    const k = `${r.t}|${r.evidence || r.description || ''}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out.sort((a, b) => a.t.localeCompare(b.t));
}
