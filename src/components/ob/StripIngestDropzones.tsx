import { useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Upload, X, Activity, Pill, FileText, Image as ImageIcon } from 'lucide-react';
import { parseStripCSV, parseMAR, fileToText, fileToDataURL } from '@/lib/obFetalParser';
import type { MAREvent, StripSample } from '@/lib/obFetalTypes';

export interface IngestState {
  stripSamples: StripSample[];
  stripImages: { filename: string; dataUrl: string }[];
  marEvents: MAREvent[];
  notesText: string;
  parseWarnings: string[];
}

export const EMPTY_INGEST: IngestState = {
  stripSamples: [],
  stripImages: [],
  marEvents: [],
  notesText: '',
  parseWarnings: [],
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
  const [busy, setBusy] = useState(false);

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

  return (
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

      {/* Notes */}
      <Card className="p-4">
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
    </div>
  );
}
