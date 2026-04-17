import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Upload, Brain, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
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

// Map AI extraction output to PsychCaseInput. Defaults assume "on file" when AI returns null
// (clinician's EHR has the record even if note doesn't restate it). False means AI saw explicit
// evidence the item is missing/expired.
function mapExtractionToInput(extracted: any): PsychCaseInput {
  const orTrue = (v: boolean | null | undefined) => v === false ? false : true;
  const sessionType = (extracted.session_type as SessionType) || 'individual_therapy';
  const duration = extracted.session_duration_minutes ?? 45;
  const isTelehealth = extracted.is_telehealth ?? false;

  const input: PsychCaseInput = {
    sessionType,
    cptCode: extracted.cpt_code || '90834',
    diagnosisCodes: Array.isArray(extracted.diagnosis_codes) ? extracted.diagnosis_codes : [],
    sessionDurationMinutes: duration,
    placeOfService: extracted.place_of_service || (isTelehealth ? '10' : '11'),
    isTelehealth,
    isAudioOnly: extracted.is_audio_only ?? false,
    payerName: extracted.payer_name || '',
    patientLabel: extracted.patient_name || undefined,
    patientState: extracted.patient_state || undefined,
    providerState: 'FL',
    claimAmount: extracted.claim_amount ?? 150,

    // Documentation flags — default to "on file" unless AI explicitly saw it missing
    hasCurrentTreatmentPlan: orTrue(extracted.has_current_treatment_plan),
    hasAuthorizationOnFile: orTrue(extracted.has_authorization_on_file),
    hasProgressNotes: true, // they uploaded a note
    hasMedicalNecessityStatement: extracted.medical_necessity_statement_present ?? true,
    hasStartStopTime: extracted.has_start_stop_time ?? !!(extracted.session_start_time && extracted.session_stop_time),
    hasTelehealthConsent: isTelehealth ? orTrue(extracted.has_telehealth_consent) : true,
    telehealthPlatformDocumented: !isTelehealth || !!extracted.telehealth_platform,
    hasCrisisSafetyPlan: orTrue(extracted.has_crisis_safety_plan),
    hasPatientLocationDocumented: !isTelehealth || orTrue(extracted.has_patient_location_documented),
    hasEmergencyContactOnFile: orTrue(extracted.has_emergency_contact),

    hasScreeningTools: Array.isArray(extracted.screening_tools_used) && extracted.screening_tools_used.length > 0,
    screeningToolsUsed: Array.isArray(extracted.screening_tools_used) ? extracted.screening_tools_used : [],

    noteQuality: {
      hasFunctionalImpairment: extracted.functional_impairment_documented ?? false,
      hasSymptomSeverity: extracted.symptom_severity_documented ?? false,
      hasTreatmentResponse: extracted.treatment_response_documented ?? false,
      hasMoodAffectDetail: extracted.mood_affect_documented ?? false,
      hasSessionJustification: duration < 53,
      hasContinuedCareRationale: extracted.continued_care_rationale_documented ?? false,
      appearsCloned: extracted.copy_forward_risk ?? false,
    },
  };

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

  const handleParse = async () => {
    if (!sourceText.trim()) return;
    setStep('parsing');
    try {
      const { data, error } = await supabase.functions.invoke('psych-parse-note', {
        body: { sourceText },
      });
      if (error) throw error;
      if (!data?.extracted) throw new Error('No data returned from extraction');
      const result = mapExtractionToInput(data.extracted);
      result.id = `upload-${Date.now()}`;
      setParsed(result);
      setStep('review');
    } catch (e: any) {
      console.error('Parse error:', e);
      const msg = e?.message?.includes('429') ? 'Too many requests — try again in a moment.'
        : e?.message?.includes('402') ? 'AI credits exhausted. Add credits in Workspace Settings.'
        : 'Could not extract from this note. Please try again or paste a clearer version.';
      toast.error(msg);
      setStep('input');
    }
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
