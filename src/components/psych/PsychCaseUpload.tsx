import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Upload, Brain, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { PsychCaseInput, SessionType } from '@/lib/psychTypes';
import { PsychFileDropzone } from './PsychFileDropzone';

interface PsychCaseUploadProps {
  onCaseCreated: (input: PsychCaseInput) => void;
}

const SAMPLE_PSYCH_NOTE = `SESSION NOTE — Telehealth
Date of Service: 2026-04-16
Patient: Patient M
Payer: UnitedHealthcare

Session Type: Individual Therapy (Video)
CPT Code: 90834
Place of Service: 10 (Patient Home)
Duration: 48 minutes (Start: 10:00 AM, Stop: 10:48 AM)

Diagnosis: F33.1 — Major Depressive Disorder, Recurrent, Moderate
Secondary: F41.1 — Generalized Anxiety Disorder

Treatment Plan: Current (updated 03/15/2026)
Authorization: On file (12 sessions remaining)
Telehealth Consent: Documented (signed 01/10/2026)
Platform: Doxy.me (HIPAA-compliant)
Patient Location: Jacksonville, FL
Emergency Contact: On file

Clinical Note:
Patient reports persistent low mood and difficulty concentrating at work. PHQ-9 score: 14 (moderate, down from 18 last month). GAD-7 score: 11 (moderate). Sleep remains disrupted 3-4 nights/week. Functional impairment continues in occupational setting — missed 2 deadlines this week. Patient is responding to CBT interventions with gradual improvement in cognitive distortions. Continued weekly sessions recommended to maintain progress and prevent relapse.

Interventions: CBT — cognitive restructuring, behavioral activation planning
Treatment Response: Partial improvement
Safety: No SI/HI. Crisis safety plan reviewed and current.

Charge: $150.00`;

// Simple parser that extracts structured data from pasted notes
function parseSessionNote(text: string): PsychCaseInput {
  const t = text.toLowerCase();
  const input: PsychCaseInput = {
    sessionType: 'individual_therapy',
    cptCode: '90834',
    diagnosisCodes: [],
    sessionDurationMinutes: 45,
    hasCurrentTreatmentPlan: true,
    hasAuthorizationOnFile: true,
    hasProgressNotes: true,
    hasMedicalNecessityStatement: true,
    placeOfService: '10',
    isTelehealth: true,
    hasStartStopTime: true,
    claimAmount: 150,
    payerName: '',
    noteQuality: {
      hasFunctionalImpairment: false,
      hasSymptomSeverity: false,
      hasTreatmentResponse: false,
      hasMoodAffectDetail: false,
      hasSessionJustification: false,
      hasContinuedCareRationale: false,
      appearsCloned: false,
    },
  };

  // Patient label
  const patMatch = text.match(/patient[:\s]+([A-Z][a-z]*(?:\s+[A-Z])?)/i);
  if (patMatch) input.patientLabel = patMatch[1].trim();

  // CPT code
  const cptMatch = text.match(/(?:cpt|code)[:\s]*(\d{5})/i);
  if (cptMatch) input.cptCode = cptMatch[1];

  // Diagnosis codes
  const dxMatches = text.match(/[FGZ]\d{2,3}\.\d{1,2}/gi);
  if (dxMatches) input.diagnosisCodes = [...new Set(dxMatches.map(d => d.toUpperCase()))];

  // Duration
  const durMatch = text.match(/(?:duration|time)[:\s]*(\d+)\s*min/i);
  if (durMatch) input.sessionDurationMinutes = parseInt(durMatch[1]);

  // Payer
  const payers = ['UnitedHealthcare', 'Aetna', 'Cigna', 'Anthem BCBS', 'Medicaid', 'Medicare', 'TRICARE', 'Humana'];
  for (const p of payers) {
    if (t.includes(p.toLowerCase())) { input.payerName = p; break; }
  }

  // Session type detection
  if (t.includes('group therapy') || t.includes('group session')) input.sessionType = 'group_therapy';
  else if (t.includes('family') || t.includes('couples')) input.sessionType = 'family_therapy';
  else if (t.includes('psych testing') || t.includes('psychological testing')) input.sessionType = 'psych_testing';
  else if (t.includes('medication management') || t.includes('med management')) input.sessionType = 'medication_management';
  else if (t.includes('crisis')) input.sessionType = 'crisis_intervention';
  else if (t.includes('intake') || t.includes('evaluation') || t.includes('90791') || t.includes('90792')) input.sessionType = 'intake_evaluation';

  // Telehealth flags
  input.isTelehealth = t.includes('telehealth') || t.includes('video') || t.includes('doxy') || t.includes('zoom') || ['10', '02'].includes(input.placeOfService);
  if (t.includes('audio only') || t.includes('phone only') || t.includes('audio-only')) input.isAudioOnly = true;

  // POS
  const posMatch = text.match(/(?:pos|place of service)[:\s]*(\d{1,2})/i);
  if (posMatch) input.placeOfService = posMatch[1].padStart(2, '0');

  // Documentation
  input.hasCurrentTreatmentPlan = t.includes('treatment plan') && (t.includes('current') || t.includes('updated'));
  input.hasAuthorizationOnFile = t.includes('authorization') && (t.includes('on file') || t.includes('approved'));
  input.hasProgressNotes = true; // If they're pasting notes, they exist
  input.hasMedicalNecessityStatement = t.includes('medical necessity') || t.includes('medically necessary') || t.includes('functional impairment');
  input.hasStartStopTime = /start[:\s]*\d/i.test(text) || /stop[:\s]*\d/i.test(text) || t.includes('start:') || t.includes('start time');
  input.hasTelehealthConsent = t.includes('consent') && (t.includes('documented') || t.includes('signed') || t.includes('on file'));
  input.telehealthPlatformDocumented = t.includes('doxy') || t.includes('zoom') || t.includes('hipaa-compliant') || t.includes('hipaa compliant');
  input.hasCrisisSafetyPlan = t.includes('safety plan') || t.includes('crisis plan');
  input.hasPatientLocationDocumented = /(?:patient )?location[:\s]/i.test(text) || /jacksonville|miami|orlando|tampa|tallahassee/i.test(text);
  input.hasEmergencyContactOnFile = t.includes('emergency contact');

  // Patient/provider state
  const stateMatch = text.match(/(?:location|state)[:\s]*(?:\w+,?\s*)?(FL|GA|TX|NY|CA|NC|SC|AL|TN|OH|PA|IL|VA|MD|NJ)/i);
  if (stateMatch) input.patientState = stateMatch[1].toUpperCase();
  input.providerState = 'FL'; // Default for Jackie's practice

  // Screening tools
  const screeningTools: string[] = [];
  if (t.includes('phq-9') || t.includes('phq9')) screeningTools.push('PHQ-9');
  if (t.includes('gad-7') || t.includes('gad7')) screeningTools.push('GAD-7');
  if (t.includes('pcl-5') || t.includes('pcl5')) screeningTools.push('PCL-5');
  if (t.includes('audit')) screeningTools.push('AUDIT');
  if (screeningTools.length > 0) {
    input.hasScreeningTools = true;
    input.screeningToolsUsed = screeningTools;
  }

  // Note quality signals
  if (input.noteQuality) {
    input.noteQuality.hasFunctionalImpairment = t.includes('functional') || t.includes('impairment') || t.includes('difficulty') || t.includes('unable to');
    input.noteQuality.hasSymptomSeverity = t.includes('moderate') || t.includes('severe') || t.includes('mild') || /phq-?9[:\s]*\d/i.test(text) || /gad-?7[:\s]*\d/i.test(text);
    input.noteQuality.hasTreatmentResponse = t.includes('improvement') || t.includes('responding') || t.includes('declining') || t.includes('stable') || t.includes('treatment response');
    input.noteQuality.hasMoodAffectDetail = t.includes('mood') || t.includes('affect') || t.includes('low mood') || t.includes('anxious') || t.includes('irritable');
    input.noteQuality.hasSessionJustification = input.sessionDurationMinutes < 53 || t.includes('justified') || t.includes('complexity');
    input.noteQuality.hasContinuedCareRationale = t.includes('continued') || t.includes('ongoing') || t.includes('recommended') || t.includes('maintain');
    input.noteQuality.appearsCloned = false;
  }

  // Claim amount
  const chargeMatch = text.match(/\$(\d+(?:\.\d{2})?)/);
  if (chargeMatch) input.claimAmount = parseFloat(chargeMatch[1]);

  return input;
}

type UploadStep = 'input' | 'parsing' | 'review' | 'complete';

export function PsychCaseUpload({ onCaseCreated }: PsychCaseUploadProps) {
  const [open, setOpen] = useState(false);
  const [sourceText, setSourceText] = useState('');
  const [step, setStep] = useState<UploadStep>('input');
  const [parsed, setParsed] = useState<PsychCaseInput | null>(null);

  const reset = () => {
    setSourceText('');
    setStep('input');
    setParsed(null);
  };

  const handleParse = () => {
    if (!sourceText.trim()) return;
    setStep('parsing');
    // Simulate brief processing
    setTimeout(() => {
      const result = parseSessionNote(sourceText);
      result.id = `upload-${Date.now()}`;
      setParsed(result);
      setStep('review');
    }, 800);
  };

  const handleConfirm = () => {
    if (!parsed) return;
    onCaseCreated(parsed);
    setStep('complete');
    toast.success('Case added to your dashboard');
    setTimeout(() => { setOpen(false); reset(); }, 1200);
  };

  const progressValue = step === 'parsing' ? 50 : step === 'review' ? 75 : step === 'complete' ? 100 : 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Upload className="h-4 w-4" />
          Upload Case
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-violet-500" />
            Upload Session for Review
          </DialogTitle>
        </DialogHeader>

        {step !== 'input' && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                {step === 'parsing' ? 'Extracting session details...' :
                 step === 'review' ? 'Review extracted data' :
                 'Case added'}
              </span>
              <span>{progressValue}%</span>
            </div>
            <Progress value={progressValue} className="h-2" />
          </div>
        )}

        {step === 'input' && (
          <div className="space-y-3">
            <PsychFileDropzone
              onTextExtracted={(text, fileName) => {
                setSourceText(text);
                toast.success(`Loaded ${fileName} into the form`);
              }}
            />

            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-border" />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">or paste text</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <div className="flex justify-between items-center">
              <p className="text-xs text-muted-foreground">Paste a session note, superbill, or claim summary</p>
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => { setSourceText(SAMPLE_PSYCH_NOTE); toast.info('Sample note loaded'); }}
              >
                Load Sample
              </Button>
            </div>
            <Textarea
              placeholder="Paste your session note, progress note, or superbill here..."
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              className="min-h-[200px] font-mono text-xs"
            />
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">
                {sourceText.length > 0 ? `${sourceText.length.toLocaleString()} characters` : ''}
              </span>
              <Button onClick={handleParse} disabled={!sourceText.trim()} className="gap-2">
                <Brain className="h-4 w-4" />
                Extract & Review
              </Button>
            </div>
          </div>
        )}

        {step === 'parsing' && (
          <div className="py-8 text-center space-y-3">
            <Loader2 className="h-10 w-10 animate-spin mx-auto text-violet-500" />
            <p className="text-sm font-medium">Extracting session details...</p>
            <p className="text-xs text-muted-foreground">Identifying CPT codes, diagnosis, documentation status, and note quality signals...</p>
          </div>
        )}

        {step === 'review' && parsed && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">We extracted the following from your note. Review before adding to your dashboard.</p>
            
            <div className="grid grid-cols-2 gap-3 text-xs">
              <ExtractedField label="Patient" value={parsed.patientLabel || 'Not detected'} />
              <ExtractedField label="Session Type" value={parsed.sessionType.replace(/_/g, ' ')} />
              <ExtractedField label="CPT Code" value={parsed.cptCode} />
              <ExtractedField label="Duration" value={`${parsed.sessionDurationMinutes} min`} />
              <ExtractedField label="Payer" value={parsed.payerName || 'Not detected'} />
              <ExtractedField label="Claim Amount" value={parsed.claimAmount ? `$${parsed.claimAmount}` : 'Not detected'} />
              <ExtractedField label="Place of Service" value={`POS ${parsed.placeOfService}`} />
              <ExtractedField label="Telehealth" value={parsed.isTelehealth ? 'Yes' : 'No'} />
            </div>

            {parsed.diagnosisCodes.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Diagnosis Codes</p>
                <div className="flex gap-1.5 flex-wrap">
                  {parsed.diagnosisCodes.map(d => (
                    <Badge key={d} variant="outline" className="font-mono text-xs">{d}</Badge>
                  ))}
                </div>
              </div>
            )}

            {parsed.screeningToolsUsed && parsed.screeningToolsUsed.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Screening Tools Detected</p>
                <div className="flex gap-1.5 flex-wrap">
                  {parsed.screeningToolsUsed.map(t => (
                    <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <DocStatus label="Treatment Plan" ok={parsed.hasCurrentTreatmentPlan} />
              <DocStatus label="Authorization" ok={parsed.hasAuthorizationOnFile} />
              <DocStatus label="Start/Stop Time" ok={!!parsed.hasStartStopTime} />
              <DocStatus label="Telehealth Consent" ok={!!parsed.hasTelehealthConsent} />
              <DocStatus label="Safety Plan" ok={!!parsed.hasCrisisSafetyPlan} />
              <DocStatus label="Emergency Contact" ok={!!parsed.hasEmergencyContactOnFile} />
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={reset}>Start Over</Button>
              <Button className="flex-1 gap-2" onClick={handleConfirm}>
                <CheckCircle className="h-4 w-4" />
                Add to Dashboard
              </Button>
            </div>
          </div>
        )}

        {step === 'complete' && (
          <div className="py-8 text-center space-y-3">
            <CheckCircle className="h-10 w-10 text-emerald-500 mx-auto" />
            <p className="text-sm font-semibold">Case Added</p>
            <p className="text-xs text-muted-foreground">The pre-submission audit has been run automatically.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ExtractedField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border px-3 py-2">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="text-xs font-medium text-foreground capitalize">{value}</p>
    </div>
  );
}

function DocStatus({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-2 text-xs rounded-md border px-3 py-1.5">
      <div className={`h-2 w-2 rounded-full ${ok ? 'bg-emerald-500' : 'bg-amber-500'}`} />
      <span className="text-muted-foreground">{label}</span>
      <span className={`ml-auto font-medium ${ok ? 'text-emerald-600' : 'text-amber-600'}`}>
        {ok ? 'Found' : 'Not found'}
      </span>
    </div>
  );
}
