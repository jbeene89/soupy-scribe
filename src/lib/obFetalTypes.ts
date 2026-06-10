// Types for the OB Fetal Monitoring Audit module.
// All timestamps are ISO 8601 strings.

export type NICHDCategory = 'I' | 'II' | 'III' | 'indeterminate';

export type DecelType = 'early' | 'late' | 'variable' | 'prolonged';

export type VariabilityLevel = 'absent' | 'minimal' | 'moderate' | 'marked';

/** A single sample point from a structured strip export. */
export interface StripSample {
  /** ISO timestamp of the sample. */
  t: string;
  /** Fetal heart rate, bpm. */
  fhr: number | null;
  /** Uterine contraction signal (relative units, peaks count as contractions). */
  uc: number | null;
}

/** Aggregated 10-minute window used by the engine. */
export interface StripWindow {
  /** ISO start timestamp of the window. */
  start: string;
  /** ISO end timestamp (start + windowMinutes). */
  end: string;
  baselineFHR: number | null;
  variability: VariabilityLevel;
  accelerations: number;
  decels: { type: DecelType; tAt: string; }[];
  /** Contractions counted inside the window. */
  contractionCount: number;
  /** True when averaged over the trailing 30-min window contraction rate exceeds 5 / 10 min. */
  tachysystole: boolean;
  /** NICHD category derived from the rules below. */
  category: NICHDCategory;
  /** Plain-language reason the category was assigned. */
  categoryReason: string;
  /** Source of this window's data — used for trust labelling in the UI. */
  source: 'structured' | 'image';
  /** When source === 'image', this points to the image filename it came from. */
  imageRef?: string;
}

export type MedName = 'pitocin' | 'misoprostol' | 'cervidil' | 'magnesium' | 'terbutaline' | 'other';

/** One row from the medication administration record. */
export interface MAREvent {
  t: string;
  medication: MedName;
  medicationLabel: string;
  /** Action — what the nurse/provider did. */
  action: 'start' | 'increase' | 'decrease' | 'hold' | 'resume' | 'dose' | 'discontinue';
  /** Numeric dose or rate, when known. mU/min for Pitocin, mcg for Miso, mg for Mag. */
  amount?: number;
  unit?: string;
  route?: string;
  /** Verbatim text from the source row. */
  evidence: string;
}

export type ViolationSeverity = 'critical' | 'high' | 'moderate';

/** Maternal vital signs reading from the flowsheet. */
export interface VitalsReading {
  t: string;
  /** Systolic BP (mmHg). */
  sbp?: number;
  /** Diastolic BP (mmHg). */
  dbp?: number;
  /** Maternal heart rate (bpm). */
  hr?: number;
  /** SpO2 (%). */
  spo2?: number;
  /** Temperature (F). */
  tempF?: number;
  evidence?: string;
}

export type CareEventKind =
  | 'vitals_check'
  | 'rn_at_bedside'
  | 'provider_notified'
  | 'cervical_exam'
  | 'membrane_sweep'
  | 'arom'
  | 'cervidil_placed'
  | 'cervidil_removed'
  | 'epidural'
  | 'consent_obtained'
  | 'provider_order'
  | 'iv_bolus'
  | 'position_change'
  | 'oxygen'
  | 'reassessment'
  | 'other';

/** Any nursing / provider / care activity that has a time and (often) a verbatim chart line. */
export interface CareEvent {
  t: string;
  kind: CareEventKind;
  /** Free-text label / verbatim chart line. */
  description: string;
  /** Optional staff name from the chart. */
  staff?: string;
  evidence?: string;
}

/** A point where the strip + MAR + chart show the medication should have been held/reduced but wasn't. */
export interface StopRuleViolation {
  id: string;
  /** ISO timestamp of the violation. */
  t: string;
  /** When the violation isn't tied to a medication (e.g. hypotension, unattended), this is "system". */
  medication: MedName | 'system';
  medicationLabel: string;
  /** Stable rule code so the PDF / complaint packet can group findings. */
  ruleCode?:
    | 'pit_cat3' | 'pit_tachy' | 'pit_cat2' | 'pit_running_cat3'
    | 'miso_interval' | 'miso_tachy'
    | 'maternal_hypotension'
    | 'ripening_interval'
    | 'unattended_patient'
    | 'consent_scope';
  rule: string;
  severity: ViolationSeverity;
  /** Human description: what the strip showed. */
  stripFinding: string;
  /** Human description: what was given/changed despite the strip. */
  medAction: string;
  /** What the chart said happened at or after the violation (verbatim quote or "no documented action"). */
  chartedResponse: string;
  /** The MAR event IDs / strip window starts that support this finding. */
  evidence: string[];
  /** Minutes between the strip trigger and the next stop/decrease action (null if never stopped). */
  minutesToAction: number | null;
}

/** For every dose of a high-risk medication, what contraindications were present at the time. */
export interface ContraindicationCheck {
  id: string;
  doseEventTime: string;
  medication: MedName;
  medicationLabel: string;
  dose: string;
  contraindicationsPresent: {
    label: string;
    evidence: string;
  }[];
  /** True when the check found nothing — explicit "none documented" rather than silence. */
  clear: boolean;
}

export interface OBAuditResult {
  generatedAt: string;
  windowMinutes: number;
  windows: StripWindow[];
  marEvents: MAREvent[];
  vitalsReadings: VitalsReading[];
  careEvents: CareEvent[];
  violations: StopRuleViolation[];
  contraindicationChecks: ContraindicationCheck[];
  /** Total monitored time in minutes covered by the windows. */
  monitoredMinutes: number;
  /** Summary counts for the dashboard. */
  summary: {
    catI: number;
    catII: number;
    catIII: number;
    tachysystoleWindows: number;
    criticalViolations: number;
    highViolations: number;
    moderateViolations: number;
    pitocinIncreasesDuringConcern: number;
    misoRedosesUnderInterval: number;
    hypotensionEpisodes: number;
    unattendedGaps: number;
    consentScopeFlags: number;
    ripeningIntervalFlags: number;
  };
  notes: string[];
  /** Any rows the parser couldn't classify, surfaced for human review. */
  parseWarnings: string[];
  /** Optional case header used by the complaint packet (patient initials, facility, DOS). */
  caseHeader?: OBCaseHeader;
}

export interface OBCaseHeader {
  patientInitials?: string;
  facility?: string;
  unit?: string;
  roomNumber?: string;
  attendingOB?: string;
  dateOfAdmission?: string;
  dateOfDelivery?: string;
  authorName?: string;
  /** Free-text narrative the user wrote describing the case. */
  narrative?: string;
}

/** Payload sent to the edge function. */
export interface OBAuditRequest {
  /** Pre-parsed structured strip samples (timestamp + FHR + UC). Optional. */
  stripSamples?: StripSample[];
  /** Strip images as data URLs ("data:image/png;base64,..."). Optional. */
  stripImages?: { filename: string; dataUrl: string }[];
  /** Pre-parsed MAR events. Optional. */
  marEvents?: MAREvent[];
  /** Maternal vitals readings. Optional. */
  vitalsReadings?: VitalsReading[];
  /** Nursing / provider care events. Optional. */
  careEvents?: CareEvent[];
  /** Optional clinical notes text — used to fill in chartedResponse on violations. */
  notesText?: string;
  /** Override window size, default 10. */
  windowMinutes?: number;
  /** Case header carried through to the complaint packet. */
  caseHeader?: OBCaseHeader;
}
