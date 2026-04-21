import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Stethoscope, ClipboardCheck, Brain } from 'lucide-react';
import type { PsychCaseInput, SessionType } from '@/lib/psychTypes';

const SESSION_TYPES: { value: SessionType; label: string }[] = [
  { value: 'individual_therapy', label: 'Individual Therapy' },
  { value: 'group_therapy', label: 'Group Therapy' },
  { value: 'family_therapy', label: 'Family / Couples Therapy' },
  { value: 'psych_testing', label: 'Psychological Testing' },
  { value: 'medication_management', label: 'Medication Management' },
  { value: 'crisis_intervention', label: 'Crisis Intervention' },
  { value: 'telehealth', label: 'Telehealth Session' },
  { value: 'intake_evaluation', label: 'Intake / Evaluation' },
];

const COMMON_CPT: Record<SessionType, string[]> = {
  individual_therapy: ['90832', '90834', '90837'],
  group_therapy: ['90853'],
  family_therapy: ['90847', '90846'],
  psych_testing: ['96130', '96131', '96136', '96137'],
  medication_management: ['99213', '99214', '99215', '90863'],
  crisis_intervention: ['90839', '90840'],
  telehealth: ['90832', '90834', '90837'],
  intake_evaluation: ['90791', '90792'],
};

const PAYERS = ['UnitedHealthcare', 'Aetna', 'Cigna', 'Anthem BCBS', 'Medicaid', 'Medicare', 'TRICARE', 'Humana', 'Other'];

const DEFAULT: PsychCaseInput = {
  sessionType: 'individual_therapy',
  cptCode: '90834',
  diagnosisCodes: ['F33.1'],
  sessionDurationMinutes: 45,
  hasCurrentTreatmentPlan: true,
  hasAuthorizationOnFile: true,
  hasProgressNotes: true,
  hasMedicalNecessityStatement: true,
  placeOfService: '11',
  isTelehealth: false,
  hasStartStopTime: true,
  claimAmount: 150,
  payerName: '',
  noteQuality: {
    hasFunctionalImpairment: true,
    hasSymptomSeverity: true,
    hasTreatmentResponse: true,
    hasMoodAffectDetail: true,
    hasSessionJustification: true,
    hasContinuedCareRationale: true,
    appearsCloned: false,
  },
};

export function PsychCaseForm({ onSubmit }: { onSubmit: (input: PsychCaseInput) => void }) {
  const [input, setInput] = useState<PsychCaseInput>(DEFAULT);
  const update = (partial: Partial<PsychCaseInput>) => setInput(prev => ({ ...prev, ...partial }));
  const updateNQ = (partial: Partial<NonNullable<PsychCaseInput['noteQuality']>>) =>
    setInput(prev => ({ ...prev, noteQuality: { ...prev.noteQuality!, ...partial } }));

  const showEM = input.sessionType === 'medication_management' || ['99213', '99214', '99215'].includes(input.cptCode);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Stethoscope className="h-4 w-4" /> Session Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Patient Label">
              <Input placeholder="e.g. Patient A" value={input.patientLabel || ''} onChange={e => update({ patientLabel: e.target.value })} />
            </Field>
            <Field label="Payer">
              <Select value={input.payerName || ''} onValueChange={v => update({ payerName: v })}>
                <SelectTrigger><SelectValue placeholder="Select payer" /></SelectTrigger>
                <SelectContent>{PAYERS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Session Type">
              <Select value={input.sessionType} onValueChange={v => { const st = v as SessionType; update({ sessionType: st, cptCode: COMMON_CPT[st][0] }); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SESSION_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="CPT Code">
              <Select value={input.cptCode} onValueChange={v => update({ cptCode: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{COMMON_CPT[input.sessionType].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Session Duration (minutes)">
              <Input type="number" value={input.sessionDurationMinutes} onChange={e => update({ sessionDurationMinutes: parseInt(e.target.value) || 0 })} />
            </Field>
            <Field label="Claim Amount ($)">
              <Input type="number" value={input.claimAmount || ''} onChange={e => update({ claimAmount: parseFloat(e.target.value) || 0 })} />
            </Field>
            <Field label="Place of Service">
              <Select value={input.placeOfService} onValueChange={v => update({ placeOfService: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="11">11 — Office</SelectItem>
                  <SelectItem value="10">10 — Telehealth (Patient Home)</SelectItem>
                  <SelectItem value="02">02 — Telehealth (Other)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Diagnosis (ICD-10)">
              <Input value={input.diagnosisCodes.join(', ')} onChange={e => update({ diagnosisCodes: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} placeholder="F33.1, F41.1" />
            </Field>
          </div>

          <Separator />

          <p className="text-xs font-medium text-foreground">Documentation Checks</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {([
              ['hasCurrentTreatmentPlan', 'Current treatment plan on file'],
              ['hasAuthorizationOnFile', 'Prior authorization obtained'],
              ['hasProgressNotes', 'Progress notes completed'],
              ['hasMedicalNecessityStatement', 'Medical necessity documented'],
              ['isTelehealth', 'Telehealth session'],
              ['hasStartStopTime', 'Start/stop time documented'],
            ] as const).map(([key, label]) => (
              <ToggleRow key={key} label={label} checked={!!input[key]} onChange={v => update({ [key]: v })} />
            ))}
          </div>

          {input.isTelehealth && (
            <ToggleRow label="Telehealth consent documented" checked={!!input.hasTelehealthConsent} onChange={v => update({ hasTelehealthConsent: v })} />
          )}

          <Separator />

          <p className="text-xs font-medium text-foreground">Note Quality</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {([
              ['hasFunctionalImpairment', 'Functional impairment documented'],
              ['hasSymptomSeverity', 'Symptom severity described'],
              ['hasTreatmentResponse', 'Treatment response noted'],
              ['hasMoodAffectDetail', 'Specific mood/affect detail'],
              ['hasSessionJustification', 'Session length justified'],
              ['hasContinuedCareRationale', 'Continued care rationale present'],
              ['appearsCloned', 'Note appears cloned / copy-forward'],
            ] as const).map(([key, label]) => (
              <ToggleRow
                key={key}
                label={label}
                checked={!!input.noteQuality?.[key]}
                onChange={v => updateNQ({ [key]: v })}
                inverted={key === 'appearsCloned'}
              />
            ))}
          </div>

          {showEM && (
            <>
              <Separator />
              <EMSection input={input} update={update} />
            </>
          )}

          <Button onClick={() => onSubmit(input)} className="w-full">
            <ClipboardCheck className="h-4 w-4 mr-2" /> Run Pre-Submission Check
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}

function ToggleRow({ label, checked, onChange, inverted }: { label: string; checked: boolean; onChange: (v: boolean) => void; inverted?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-md border px-3 py-2">
      <Label className="text-xs">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function EMSection({ input, update }: { input: PsychCaseInput; update: (p: Partial<PsychCaseInput>) => void }) {
  const em = input.emInput || {
    selectedEMCode: '99214', problemsAddressed: 2, isNewProblem: false,
    dataReviewed: [], riskLevel: 'moderate' as const, hasIndependentInterpretation: false, hasAssessmentPlan: true,
  };
  const updateEM = (partial: Partial<NonNullable<PsychCaseInput['emInput']>>) =>
    update({ emInput: { ...em, ...partial } });

  // Initialize if needed
  if (!input.emInput) update({ emInput: em });

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-foreground flex items-center gap-2"><Brain className="h-3.5 w-3.5" /> E/M Coding Review</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Selected E/M Code">
          <Select value={em.selectedEMCode} onValueChange={v => updateEM({ selectedEMCode: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {['99212', '99213', '99214', '99215', '99205'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Problems Addressed">
          <Input type="number" min={1} max={10} value={em.problemsAddressed} onChange={e => updateEM({ problemsAddressed: parseInt(e.target.value) || 1 })} />
        </Field>
        <Field label="MDM Risk Table Level">
          <Select value={em.riskLevel} onValueChange={v => updateEM({ riskLevel: v as any })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {['minimal', 'low', 'moderate', 'high'].map(r => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <ToggleRow label="New problem requiring workup" checked={em.isNewProblem} onChange={v => updateEM({ isNewProblem: v })} />
        <ToggleRow label="Independent data interpretation" checked={em.hasIndependentInterpretation} onChange={v => updateEM({ hasIndependentInterpretation: v })} />
        <ToggleRow label="Assessment/plan documented" checked={em.hasAssessmentPlan} onChange={v => updateEM({ hasAssessmentPlan: v })} />
      </div>
    </div>
  );
}
