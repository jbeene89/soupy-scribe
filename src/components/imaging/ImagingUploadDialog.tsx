import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Upload, Sparkles, Link2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { analyzeAndSaveImaging } from '@/lib/imagingService';
import { BODY_REGIONS } from '@/lib/imagingTypes';
import { useAdminContext } from '@/components/admin/AdminContext';
import { extractAllCues, describeCues, findCaseMatches, type ImagingCues, type CaseMatch } from '@/lib/imagingCueExtractor';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved?: () => void;
}

export function ImagingUploadDialog({ open, onOpenChange, onSaved }: Props) {
  const { reloadImagingFindings, allCases } = useAdminContext();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [procedureLabel, setProcedureLabel] = useState('');
  const [bodyRegion, setBodyRegion] = useState<string>('knee');
  const [expectedImplants, setExpectedImplants] = useState<string>('1');
  const [patientId, setPatientId] = useState('');
  const [physicianName, setPhysicianName] = useState('');
  const [linkedCaseId, setLinkedCaseId] = useState<string>('none');
  const [busy, setBusy] = useState(false);
  const [cues, setCues] = useState<ImagingCues | null>(null);
  const [matches, setMatches] = useState<CaseMatch[]>([]);

  const reset = () => {
    setFile(null); setPreviewUrl(null); setProcedureLabel(''); setBodyRegion('knee');
    setExpectedImplants('1'); setPatientId(''); setPhysicianName(''); setLinkedCaseId('none');
    setCues(null); setMatches([]);
  };

  const handleFile = async (f: File | null) => {
    setFile(f);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(f ? URL.createObjectURL(f) : null);
    if (!f) { setCues(null); setMatches([]); return; }

    // Extract procedure cues from filename + EXIF + DICOM tags, then auto-suggest a link.
    const c = await extractAllCues(f);
    setCues(c);
    if (c.bodyRegion) setBodyRegion(c.bodyRegion);
    if (c.patientId && !patientId) setPatientId(c.patientId);
    if (c.cptCodes.length && !procedureLabel) {
      setProcedureLabel(`CPT ${c.cptCodes.slice(0, 2).join(', ')}`);
    }
    const found = findCaseMatches(c, allCases, { floor: 20, limit: 3 });
    setMatches(found);
    if (found[0]) {
      handleCaseLink(found[0].case.id);
      const srcs = Array.from(new Set(Object.values(c.sources ?? {}).filter(Boolean)));
      toast.success(`Auto-linked to ${found[0].case.caseNumber}`, {
        description: srcs.length ? `Cues from ${srcs.join(' + ')}` : 'Cues from filename',
      });
    }
  };

  const handleCaseLink = (id: string) => {
    setLinkedCaseId(id);
    if (id === 'none') return;
    const c = allCases.find((c) => c.id === id);
    if (c) {
      setPatientId(c.patientId);
      setPhysicianName(c.physicianName);
      if (!procedureLabel && c.cptCodes.length) setProcedureLabel(`CPT ${c.cptCodes.slice(0, 2).join(', ')}`);
    }
  };

  const submit = async () => {
    if (!file) { toast.error('Pick an image first'); return; }
    setBusy(true);
    try {
      const linkedCase = allCases.find((c) => c.id === linkedCaseId);
      await analyzeAndSaveImaging({
        file,
        procedureLabel: procedureLabel || undefined,
        bodyRegion,
        expectedImplantCount: parseInt(expectedImplants) || 0,
        patientId: patientId || undefined,
        physicianName: physicianName || undefined,
        caseId: linkedCaseId === 'none' ? undefined : linkedCaseId,
        cptCodes: linkedCase?.cptCodes,
      });
      toast.success('Imaging analyzed');
      await reloadImagingFindings();
      onSaved?.();
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload clinical image for AI audit</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Image (JPG, PNG, TIFF, DICOM)</Label>
            <Input
              type="file"
              accept="image/*,.tif,.tiff,.dcm,.dicom"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              disabled={busy}
            />
            {previewUrl && (
              <div className="rounded-md border bg-muted/20 p-2">
                <img src={previewUrl} alt="preview" className="max-h-56 mx-auto object-contain" />
              </div>
            )}
          </div>

          <div className="space-y-3">
            {cues && (cues.cptCodes.length || cues.bodyRegion || cues.laterality || cues.patientId || cues.physicianFragment || cues.procedureKeywords.length) ? (
              <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                <div className="flex items-center gap-2 text-xs font-medium">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Detected from filename
                </div>
                <div className="flex flex-wrap gap-1">
                  {describeCues(cues).map((d) => (
                    <Badge key={d} variant="secondary" className="text-[10px]">{d}</Badge>
                  ))}
                </div>
                {matches.length > 0 && (
                  <div className="space-y-1 pt-1 border-t">
                    <div className="text-[11px] text-muted-foreground">Suggested case matches:</div>
                    {matches.map((m) => (
                      <button
                        key={m.case.id}
                        type="button"
                        onClick={() => handleCaseLink(m.case.id)}
                        className={`w-full text-left rounded px-2 py-1.5 text-xs border transition-colors ${
                          linkedCaseId === m.case.id ? 'bg-primary/10 border-primary' : 'hover:bg-muted border-border'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium flex items-center gap-1">
                            <Link2 className="h-3 w-3" />
                            {m.case.caseNumber}
                          </span>
                          <span className="text-[10px] text-muted-foreground">score {m.score}</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {m.case.patientId} · {m.case.physicianName} · {m.reasons[0]}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {matches.length === 0 && (
                  <div className="text-[11px] text-muted-foreground italic">
                    No confident case match — review the link below or leave unlinked.
                  </div>
                )}
              </div>
            ) : null}

            <div>
              <Label>Link to existing case (auto-fills patient & surgeon)</Label>
              <Select value={linkedCaseId} onValueChange={handleCaseLink} disabled={busy}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— No link —</SelectItem>
                  {allCases.slice(0, 50).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.caseNumber} · {c.patientId} · {c.physicianName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Procedure label</Label>
              <Input value={procedureLabel} onChange={(e) => setProcedureLabel(e.target.value)}
                placeholder="e.g. Bilateral TKA — primary" disabled={busy} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Body region</Label>
                <Select value={bodyRegion} onValueChange={setBodyRegion} disabled={busy}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BODY_REGIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Expected implants</Label>
                <Input type="number" min={0} value={expectedImplants}
                  onChange={(e) => setExpectedImplants(e.target.value)} disabled={busy} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Patient ID</Label>
                <Input value={patientId} onChange={(e) => setPatientId(e.target.value)} disabled={busy} />
              </div>
              <div>
                <Label>Physician</Label>
                <Input value={physicianName} onChange={(e) => setPhysicianName(e.target.value)} disabled={busy} />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy || !file}>
            {busy ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Analyzing…</> : <><Upload className="h-4 w-4 mr-2" />Run AI audit</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}