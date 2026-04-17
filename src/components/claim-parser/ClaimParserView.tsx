// Main Claim Upload Parser screen. Handles upload → AI extraction → editable review → save.
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Brain, Loader2, AlertTriangle, CheckCircle2, FileSearch, ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ClaimFileDropzone, type IngestedFile } from "./ClaimFileDropzone";
import { ClaimField } from "./ClaimField";
import { LineItemsTable } from "./LineItemsTable";
import { EvidenceDrawer } from "./EvidenceDrawer";
import type { ParsedClaim, ParsedLineItem, ParsedSourceDocument } from "@/lib/parsedClaimTypes";
import type { PsychCaseInput, SessionType } from "@/lib/psychTypes";

interface Props {
  onCaseCreated: (input: PsychCaseInput, parsedClaim: ParsedClaim) => void;
  onBack?: () => void;
}

type Step = "upload" | "parsing" | "review";

interface EvidenceState {
  open: boolean;
  fieldLabel: string;
  fieldValue: string;
  evidenceSnippet?: string | null;
  sourceLocation?: string | null;
  confidence?: number | null;
}

const EMPTY_CLAIM: ParsedClaim = {
  claim_header: {}, patient: {}, provider: {}, service: {}, financials: {}, codes: {},
  claim_line_items: [], review_flags: [], unmapped_text: [],
};

/** Map a parsed claim → PsychCaseInput so the existing audit engine can run on it. */
function mapToPsychInput(claim: ParsedClaim): PsychCaseInput {
  const cpt = claim.codes.cpt_codes?.value?.[0] || "90834";
  const dx = claim.codes.icd10_codes?.value || [];
  const pos = claim.service.place_of_service?.value || "11";
  const isTele = pos === "10" || pos === "02";
  const charge = claim.financials.total_billed_amount?.value;

  // Crude session type guess from CPT
  let sessionType: SessionType = "individual_therapy";
  if (cpt === "90837") sessionType = "individual_therapy";
  else if (cpt === "90791") sessionType = "intake_evaluation";
  else if (cpt === "90847" || cpt === "90846") sessionType = "family_therapy";
  else if (cpt === "90853") sessionType = "group_therapy";
  else if (cpt?.startsWith("992")) sessionType = "medication_management";

  const durMatch = cpt === "90832" ? 30 : cpt === "90834" ? 45 : cpt === "90837" ? 60 : 45;

  return {
    sessionType,
    cptCode: cpt,
    diagnosisCodes: dx,
    sessionDurationMinutes: durMatch,
    placeOfService: pos,
    isTelehealth: isTele,
    payerName: claim.claim_header.payer_name?.value || "",
    patientLabel: claim.patient.patient_name?.value || undefined,
    claimAmount: typeof charge === "number" ? charge : 150,
    hasCurrentTreatmentPlan: true,
    hasAuthorizationOnFile: !!claim.claim_header.authorization_number?.value,
    hasProgressNotes: true,
    hasMedicalNecessityStatement: true,
    hasStartStopTime: true,
    hasTelehealthConsent: !isTele || true,
    telehealthPlatformDocumented: !isTele || true,
    hasCrisisSafetyPlan: true,
    hasPatientLocationDocumented: true,
    hasEmergencyContactOnFile: true,
    hasScreeningTools: false,
    screeningToolsUsed: [],
    noteQuality: {
      hasFunctionalImpairment: false,
      hasSymptomSeverity: false,
      hasTreatmentResponse: false,
      hasMoodAffectDetail: false,
      hasSessionJustification: durMatch < 53,
      hasContinuedCareRationale: false,
      appearsCloned: false,
    },
  };
}

export function ClaimParserView({ onCaseCreated, onBack }: Props) {
  const [step, setStep] = useState<Step>("upload");
  const [ingested, setIngested] = useState<IngestedFile | null>(null);
  const [claim, setClaim] = useState<ParsedClaim>(EMPTY_CLAIM);
  const [evidence, setEvidence] = useState<EvidenceState>({ open: false, fieldLabel: "", fieldValue: "" });

  const source: ParsedSourceDocument | null = ingested?.source || null;

  const handleIngested = (file: IngestedFile) => {
    setIngested(file);
  };

  const handleParse = async () => {
    if (!ingested) return;
    setStep("parsing");
    try {
      const { data, error } = await supabase.functions.invoke("claim-parser", {
        body: {
          sourceText: ingested.sourceText || undefined,
          imageDataUrl: ingested.imageDataUrl,
          fileName: ingested.source.fileName,
        },
      });
      if (error) throw error;
      if (!data?.claim) throw new Error("No structured data returned");
      setClaim(data.claim);
      setStep("review");
      toast.success("Claim extracted", { description: "Review and edit any fields below." });
    } catch (e: any) {
      console.error("Parse error", e);
      const msg = e?.message?.includes("429") ? "Too many requests — try again in a moment."
        : e?.message?.includes("402") ? "AI credits exhausted. Add credits in Workspace Settings."
        : "Could not extract from this file. Try a clearer document or paste the text.";
      toast.error(msg);
      setStep("upload");
    }
  };

  const updateField = <S extends keyof ParsedClaim>(section: S, key: string, newValue: any) => {
    setClaim((prev) => {
      const sec: any = { ...(prev as any)[section] };
      const existing = sec[key] || {};
      sec[key] = { ...existing, value: newValue };
      return { ...prev, [section]: sec } as ParsedClaim;
    });
  };

  const showFieldEvidence = (label: string, field: any) => {
    if (!field) return;
    const valueDisplay = Array.isArray(field.value) ? (field.value || []).join(", ") : String(field.value ?? "");
    setEvidence({
      open: true,
      fieldLabel: label,
      fieldValue: valueDisplay,
      evidenceSnippet: field.evidence_snippet,
      sourceLocation: field.source_location,
      confidence: field.confidence,
    });
  };

  const showLineItemEvidence = (item: ParsedLineItem, idx: number) => {
    setEvidence({
      open: true,
      fieldLabel: `Line item #${idx + 1}`,
      fieldValue: `${item.procedure_code || "—"} · ${item.charge_amount ? "$" + item.charge_amount : ""}`,
      evidenceSnippet: item.evidence_snippet,
      sourceLocation: item.source_location,
      confidence: item.confidence,
    });
  };

  const handleSave = () => {
    const input = mapToPsychInput(claim);
    input.id = `claim-${Date.now()}`;
    onCaseCreated(input, claim);
    toast.success("Claim saved to dashboard");
  };

  const reviewFlagCount = claim.review_flags.length;
  const lineItemCount = claim.claim_line_items.length;
  const lowConfFields = useMemo(() => countLowConf(claim), [claim]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
          )}
          <div className="h-10 w-10 rounded-lg bg-primary/15 flex items-center justify-center">
            <FileSearch className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Claim Upload Parser</h1>
            <p className="text-xs text-muted-foreground">Structured extraction from PDFs, EOBs, remits, denial letters, and screenshots</p>
          </div>
        </div>
        {step === "review" && (
          <Button onClick={handleSave} className="gap-2">
            <Save className="h-4 w-4" /> Save to Dashboard
          </Button>
        )}
      </div>

      {step !== "upload" && (
        <Progress value={step === "parsing" ? 50 : 100} className="h-1.5" />
      )}

      {/* Upload step */}
      {step === "upload" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Brain className="h-4 w-4 text-primary" />
              Step 1 — Upload claim document
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ClaimFileDropzone onIngested={handleIngested} busy={false} />
            <div className="flex justify-end">
              <Button onClick={handleParse} disabled={!ingested} className="gap-2">
                <Brain className="h-4 w-4" /> Extract Claim Data
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Text-based PDFs are read locally for speed. Scanned PDFs and images are sent to the vision parser.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Parsing step */}
      {step === "parsing" && (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
            <p className="text-sm font-medium">Extracting claim data…</p>
            <p className="text-xs text-muted-foreground">Capturing payer, patient, provider, codes, line items, and dollar amounts.</p>
          </CardContent>
        </Card>
      )}

      {/* Review step */}
      {step === "review" && (
        <div className="space-y-4">
          {/* Top summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SummaryStat icon={CheckCircle2} label="Line items" value={lineItemCount} tone="emerald" />
            <SummaryStat icon={AlertTriangle} label="Needs review" value={reviewFlagCount} tone={reviewFlagCount > 0 ? "amber" : "muted"} />
            <SummaryStat icon={AlertTriangle} label="Low-confidence fields" value={lowConfFields} tone={lowConfFields > 0 ? "amber" : "muted"} />
            <SummaryStat icon={FileSearch} label="Source" value={ingested?.source.fileName || "—"} tone="muted" small />
          </div>

          {claim.document_summary && (
            <Card>
              <CardContent className="py-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Document summary</p>
                <p className="text-xs text-foreground">{claim.document_summary}</p>
              </CardContent>
            </Card>
          )}

          {claim.review_flags.length > 0 && (
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" /> Review flags
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {claim.review_flags.map((f, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <Badge variant="outline" className={
                      f.severity === "high" ? "border-destructive/40 text-destructive text-[9px]"
                      : f.severity === "medium" ? "border-amber-500/40 text-amber-600 text-[9px]"
                      : "border-muted-foreground/40 text-muted-foreground text-[9px]"
                    }>{f.severity}</Badge>
                    <div className="min-w-0">
                      <p className="font-mono text-[10px] text-muted-foreground">{f.field_path}</p>
                      <p className="text-foreground">{f.reason}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Sections */}
          <Section title="Claim Header">
            <Grid>
              <ClaimField label="Payer name" field={claim.claim_header.payer_name} onChange={(v) => updateField("claim_header", "payer_name", v)} onShowEvidence={() => showFieldEvidence("Payer name", claim.claim_header.payer_name)} />
              <ClaimField label="Payer type" field={claim.claim_header.payer_type} onChange={(v) => updateField("claim_header", "payer_type", v)} onShowEvidence={() => showFieldEvidence("Payer type", claim.claim_header.payer_type)} />
              <ClaimField label="Claim number" field={claim.claim_header.claim_number} onChange={(v) => updateField("claim_header", "claim_number", v)} onShowEvidence={() => showFieldEvidence("Claim number", claim.claim_header.claim_number)} />
              <ClaimField label="Authorization #" field={claim.claim_header.authorization_number} onChange={(v) => updateField("claim_header", "authorization_number", v)} onShowEvidence={() => showFieldEvidence("Authorization #", claim.claim_header.authorization_number)} />
              <ClaimField label="Claim status" field={claim.claim_header.claim_status} onChange={(v) => updateField("claim_header", "claim_status", v)} onShowEvidence={() => showFieldEvidence("Claim status", claim.claim_header.claim_status)} />
              <ClaimField label="Denial status" field={claim.claim_header.denial_status} onChange={(v) => updateField("claim_header", "denial_status", v)} onShowEvidence={() => showFieldEvidence("Denial status", claim.claim_header.denial_status)} />
              <ClaimField label="Appeal status" field={claim.claim_header.appeal_status} onChange={(v) => updateField("claim_header", "appeal_status", v)} onShowEvidence={() => showFieldEvidence("Appeal status", claim.claim_header.appeal_status)} />
              <ClaimField label="Denial reason codes" kind="array" field={claim.claim_header.denial_reason_codes} onChange={(v) => updateField("claim_header", "denial_reason_codes", v)} onShowEvidence={() => showFieldEvidence("Denial reason codes", claim.claim_header.denial_reason_codes)} />
              <ClaimField label="Denial reason text" field={claim.claim_header.denial_reason_text} onChange={(v) => updateField("claim_header", "denial_reason_text", v)} onShowEvidence={() => showFieldEvidence("Denial reason text", claim.claim_header.denial_reason_text)} />
              <ClaimField label="Filing deadline" kind="date" field={claim.claim_header.filing_deadline} onChange={(v) => updateField("claim_header", "filing_deadline", v)} onShowEvidence={() => showFieldEvidence("Filing deadline", claim.claim_header.filing_deadline)} />
              <ClaimField label="Appeal deadline" kind="date" field={claim.claim_header.appeal_deadline} onChange={(v) => updateField("claim_header", "appeal_deadline", v)} onShowEvidence={() => showFieldEvidence("Appeal deadline", claim.claim_header.appeal_deadline)} />
            </Grid>
          </Section>

          <Section title="Patient">
            <Grid>
              <ClaimField label="Patient name" field={claim.patient.patient_name} onChange={(v) => updateField("patient", "patient_name", v)} onShowEvidence={() => showFieldEvidence("Patient name", claim.patient.patient_name)} />
              <ClaimField label="Patient ID" field={claim.patient.patient_id} onChange={(v) => updateField("patient", "patient_id", v)} onShowEvidence={() => showFieldEvidence("Patient ID", claim.patient.patient_id)} />
              <ClaimField label="DOB" kind="date" field={claim.patient.dob} onChange={(v) => updateField("patient", "dob", v)} onShowEvidence={() => showFieldEvidence("DOB", claim.patient.dob)} />
              <ClaimField label="Sex" field={claim.patient.sex} onChange={(v) => updateField("patient", "sex", v)} onShowEvidence={() => showFieldEvidence("Sex", claim.patient.sex)} />
            </Grid>
          </Section>

          <Section title="Provider">
            <Grid>
              <ClaimField label="Billing provider" field={claim.provider.billing_provider} onChange={(v) => updateField("provider", "billing_provider", v)} onShowEvidence={() => showFieldEvidence("Billing provider", claim.provider.billing_provider)} />
              <ClaimField label="Rendering provider" field={claim.provider.rendering_provider} onChange={(v) => updateField("provider", "rendering_provider", v)} onShowEvidence={() => showFieldEvidence("Rendering provider", claim.provider.rendering_provider)} />
              <ClaimField label="Facility" field={claim.provider.facility_name} onChange={(v) => updateField("provider", "facility_name", v)} onShowEvidence={() => showFieldEvidence("Facility", claim.provider.facility_name)} />
              <ClaimField label="NPI numbers" kind="array" field={claim.provider.npi_numbers} onChange={(v) => updateField("provider", "npi_numbers", v)} onShowEvidence={() => showFieldEvidence("NPI numbers", claim.provider.npi_numbers)} />
              <ClaimField label="Tax ID" field={claim.provider.tax_id} onChange={(v) => updateField("provider", "tax_id", v)} onShowEvidence={() => showFieldEvidence("Tax ID", claim.provider.tax_id)} />
            </Grid>
          </Section>

          <Section title="Service Information">
            <Grid>
              <ClaimField label="DOS from" kind="date" field={claim.service.date_of_service_from} onChange={(v) => updateField("service", "date_of_service_from", v)} onShowEvidence={() => showFieldEvidence("DOS from", claim.service.date_of_service_from)} />
              <ClaimField label="DOS to" kind="date" field={claim.service.date_of_service_to} onChange={(v) => updateField("service", "date_of_service_to", v)} onShowEvidence={() => showFieldEvidence("DOS to", claim.service.date_of_service_to)} />
              <ClaimField label="Place of service" field={claim.service.place_of_service} onChange={(v) => updateField("service", "place_of_service", v)} onShowEvidence={() => showFieldEvidence("Place of service", claim.service.place_of_service)} />
              <ClaimField label="Type of bill" field={claim.service.type_of_bill} onChange={(v) => updateField("service", "type_of_bill", v)} onShowEvidence={() => showFieldEvidence("Type of bill", claim.service.type_of_bill)} />
            </Grid>
          </Section>

          <Section title="Financials">
            <Grid>
              <ClaimField label="Total billed" kind="currency" field={claim.financials.total_billed_amount} onChange={(v) => updateField("financials", "total_billed_amount", v)} onShowEvidence={() => showFieldEvidence("Total billed", claim.financials.total_billed_amount)} />
              <ClaimField label="Allowed" kind="currency" field={claim.financials.allowed_amount} onChange={(v) => updateField("financials", "allowed_amount", v)} onShowEvidence={() => showFieldEvidence("Allowed", claim.financials.allowed_amount)} />
              <ClaimField label="Paid" kind="currency" field={claim.financials.paid_amount} onChange={(v) => updateField("financials", "paid_amount", v)} onShowEvidence={() => showFieldEvidence("Paid", claim.financials.paid_amount)} />
              <ClaimField label="Denied" kind="currency" field={claim.financials.denied_amount} onChange={(v) => updateField("financials", "denied_amount", v)} onShowEvidence={() => showFieldEvidence("Denied", claim.financials.denied_amount)} />
              <ClaimField label="Patient resp." kind="currency" field={claim.financials.patient_responsibility} onChange={(v) => updateField("financials", "patient_responsibility", v)} onShowEvidence={() => showFieldEvidence("Patient resp.", claim.financials.patient_responsibility)} />
            </Grid>
          </Section>

          <Section title="Codes">
            <Grid>
              <ClaimField label="CPT codes" kind="array" field={claim.codes.cpt_codes} onChange={(v) => updateField("codes", "cpt_codes", v)} onShowEvidence={() => showFieldEvidence("CPT codes", claim.codes.cpt_codes)} />
              <ClaimField label="HCPCS codes" kind="array" field={claim.codes.hcpcs_codes} onChange={(v) => updateField("codes", "hcpcs_codes", v)} onShowEvidence={() => showFieldEvidence("HCPCS codes", claim.codes.hcpcs_codes)} />
              <ClaimField label="Modifiers" kind="array" field={claim.codes.modifier_codes} onChange={(v) => updateField("codes", "modifier_codes", v)} onShowEvidence={() => showFieldEvidence("Modifiers", claim.codes.modifier_codes)} />
              <ClaimField label="ICD-10 codes" kind="array" field={claim.codes.icd10_codes} onChange={(v) => updateField("codes", "icd10_codes", v)} onShowEvidence={() => showFieldEvidence("ICD-10 codes", claim.codes.icd10_codes)} />
              <ClaimField label="Diagnosis pointers" kind="array" field={claim.codes.diagnosis_pointers} onChange={(v) => updateField("codes", "diagnosis_pointers", v)} onShowEvidence={() => showFieldEvidence("Diagnosis pointers", claim.codes.diagnosis_pointers)} />
            </Grid>
          </Section>

          <Section title="Claim Line Items">
            <LineItemsTable
              items={claim.claim_line_items}
              onChange={(items) => setClaim((p) => ({ ...p, claim_line_items: items }))}
              onShowEvidence={showLineItemEvidence}
            />
          </Section>

          {claim.unmapped_text.length > 0 && (
            <Section title="Unmapped text from document">
              <div className="space-y-1.5">
                {claim.unmapped_text.map((t, i) => (
                  <div key={i} className="rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground italic">“{t}”</div>
                ))}
              </div>
            </Section>
          )}

          <div className="sticky bottom-2 flex justify-end">
            <Button onClick={handleSave} size="lg" className="gap-2 shadow-lg">
              <Save className="h-4 w-4" /> Save Claim to Dashboard
            </Button>
          </div>
        </div>
      )}

      <EvidenceDrawer
        open={evidence.open}
        onClose={() => setEvidence((e) => ({ ...e, open: false }))}
        source={source}
        fieldLabel={evidence.fieldLabel}
        fieldValue={evidence.fieldValue}
        evidenceSnippet={evidence.evidenceSnippet}
        sourceLocation={evidence.sourceLocation}
        confidence={evidence.confidence}
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">{children}</div>;
}

function SummaryStat({ icon: Icon, label, value, tone, small }: { icon: any; label: string; value: any; tone: "emerald" | "amber" | "muted"; small?: boolean }) {
  const toneClass = tone === "emerald" ? "text-emerald-600 bg-emerald-500/10"
    : tone === "amber" ? "text-amber-600 bg-amber-500/10"
    : "text-muted-foreground bg-muted";
  return (
    <Card>
      <CardContent className="pt-3 pb-2 flex items-center gap-3">
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${toneClass}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className={small ? "text-xs font-medium text-foreground truncate" : "text-xl font-bold text-foreground"}>{value}</p>
          <p className="text-[10px] text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function countLowConf(claim: ParsedClaim): number {
  let n = 0;
  const sections: any[] = [claim.claim_header, claim.patient, claim.provider, claim.service, claim.financials, claim.codes];
  for (const sec of sections) {
    for (const k of Object.keys(sec || {})) {
      const f = sec[k];
      if (f && typeof f.confidence === "number" && f.confidence < 0.8) n++;
    }
  }
  for (const li of claim.claim_line_items) {
    if (typeof li.confidence === "number" && li.confidence < 0.8) n++;
  }
  return n;
}
