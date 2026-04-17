// Main Claim Upload Parser screen.
// Multi-file flow: each uploaded file is parsed INDEPENDENTLY in parallel,
// reviewed via per-file tabs, and analyzed by the 5-perspective engine on demand.
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Brain, Loader2, AlertTriangle, CheckCircle2, FileSearch, ArrowLeft, Save, FileText, Image as ImageIcon, XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ClaimMultiFileDropzone, type IngestedFile } from "./ClaimMultiFileDropzone";
import { ClaimField } from "./ClaimField";
import { LineItemsTable } from "./LineItemsTable";
import { EvidenceDrawer } from "./EvidenceDrawer";
import { PerspectivesPanel, type LensResult, type PerspectiveSynthesis } from "./PerspectivesPanel";
import type { ParsedClaim, ParsedLineItem, ParsedSourceDocument } from "@/lib/parsedClaimTypes";
import type { PsychCaseInput, SessionType } from "@/lib/psychTypes";
import {
  persistParsedClaim,
  updateParsedClaimPerspectives,
  updateParsedClaimFields,
} from "@/lib/parsedClaimService";

interface Props {
  /** Called once per parsed file the user accepts into their dashboard. */
  onCaseCreated: (input: PsychCaseInput, parsedClaim: ParsedClaim, caseId: string) => void;
  onBack?: () => void;
  /** Optional: open the parser pre-populated with an existing saved claim (re-view mode). */
  initialClaim?: {
    caseId: string;
    parsedClaim: ParsedClaim;
    sourceFileName: string;
    perspectives?: LensResult[];
    synthesis?: PerspectiveSynthesis | null;
  };
}

type ParseStatus = "queued" | "parsing" | "ready" | "error";

interface ParsedFileState {
  ingested: IngestedFile;
  status: ParseStatus;
  claim?: ParsedClaim;
  errorMessage?: string;
  perspectives?: LensResult[];
  synthesis?: PerspectiveSynthesis | null;
  perspectivesLoading?: boolean;
  perspectivesError?: string | null;
  saved?: boolean;
  /** id of audit_cases row once persisted */
  persistedCaseId?: string;
}

interface EvidenceState {
  open: boolean;
  fieldLabel: string;
  fieldValue: string;
  source: ParsedSourceDocument | null;
  evidenceSnippet?: string | null;
  sourceLocation?: string | null;
  confidence?: number | null;
}

const EMPTY_CLAIM: ParsedClaim = {
  claim_header: {}, patient: {}, provider: {}, service: {}, financials: {}, codes: {},
  claim_line_items: [], review_flags: [], unmapped_text: [],
};

function mapToPsychInput(claim: ParsedClaim): PsychCaseInput {
  const cpt = claim.codes.cpt_codes?.value?.[0] || "90834";
  const dx = claim.codes.icd10_codes?.value || [];
  const pos = claim.service.place_of_service?.value || "11";
  const isTele = pos === "10" || pos === "02";
  const charge = claim.financials.total_billed_amount?.value;

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

export function ClaimParserView({ onCaseCreated, onBack, initialClaim }: Props) {
  // If we're opening with a pre-existing saved claim, seed state from it.
  const [files, setFiles] = useState<ParsedFileState[]>(() => {
    if (!initialClaim) return [];
    const ingested: IngestedFile = {
      id: `existing-${initialClaim.caseId}`,
      sourceText: "",
      source: { fileName: initialClaim.sourceFileName, kind: "text" },
      meta: "Saved claim",
    };
    return [{
      ingested,
      status: "ready",
      claim: initialClaim.parsedClaim,
      perspectives: initialClaim.perspectives,
      synthesis: initialClaim.synthesis ?? null,
      saved: true,
      persistedCaseId: initialClaim.caseId,
    }];
  });
  const [activeFileId, setActiveFileId] = useState<string | null>(
    initialClaim ? `existing-${initialClaim.caseId}` : null
  );
  const [parsing, setParsing] = useState(false);
  const [evidence, setEvidence] = useState<EvidenceState>({
    open: false, fieldLabel: "", fieldValue: "", source: null,
  });

  const ingestedList = useMemo(() => files.map(f => f.ingested), [files]);
  const activeFile = files.find(f => f.ingested.id === activeFileId) || null;
  const allReady = files.length > 0 && files.every(f => f.status === "ready");
  const anyClaim = files.some(f => f.status === "ready" && f.claim);

  // Add an ingested file to the queue
  const handleAdd = (file: IngestedFile) => {
    setFiles(prev => [...prev, { ingested: file, status: "queued" }]);
  };
  const handleRemove = (id: string) => {
    setFiles(prev => prev.filter(f => f.ingested.id !== id));
    if (activeFileId === id) setActiveFileId(null);
  };

  // Parse one file via the edge function
  const parseOne = async (state: ParsedFileState): Promise<ParsedFileState> => {
    try {
      const { data, error } = await supabase.functions.invoke("claim-parser", {
        body: {
          sourceText: state.ingested.sourceText || undefined,
          imageDataUrl: state.ingested.imageDataUrl,
          fileName: state.ingested.source.fileName,
        },
      });
      if (error) throw error;
      if (!data?.claim) throw new Error("No structured data returned");
      return { ...state, status: "ready", claim: data.claim };
    } catch (e: any) {
      console.error("Parse error", state.ingested.source.fileName, e);
      const msg = e?.message?.includes("429") ? "Rate limited — try again in a moment."
        : e?.message?.includes("402") ? "AI credits exhausted. Add credits in Workspace Settings."
        : e?.message || "Could not extract from this file.";
      return { ...state, status: "error", errorMessage: msg };
    }
  };

  const handleParseAll = async () => {
    if (files.length === 0) return;
    setParsing(true);
    // Mark all queued/error as parsing
    setFiles(prev => prev.map(f =>
      f.status === "ready" ? f : { ...f, status: "parsing", errorMessage: undefined }
    ));

    // Snapshot the files we want to parse
    const targets = files.filter(f => f.status !== "ready");
    // Run in parallel — each call gets ONLY its own file's content
    const results = await Promise.all(targets.map(parseOne));
    const byId = new Map(results.map(r => [r.ingested.id, r]));

    setFiles(prev => prev.map(f => byId.get(f.ingested.id) || f));
    setParsing(false);

    const failed = results.filter(r => r.status === "error").length;
    const ok = results.filter(r => r.status === "ready").length;
    if (ok > 0) {
      toast.success(`Extracted ${ok} claim${ok !== 1 ? "s" : ""}`, {
        description: failed > 0 ? `${failed} file(s) failed — check the tab.` : "Review and edit any fields below.",
      });
    } else if (failed > 0) {
      toast.error("All files failed to parse");
    }

    // Auto-select the first ready tab
    const firstReady = results.find(r => r.status === "ready") || files.find(f => f.status === "ready");
    if (firstReady) setActiveFileId(firstReady.ingested.id);
  };

  // Update a field on the active file's claim
  const updateField = <S extends keyof ParsedClaim>(section: S, key: string, newValue: any) => {
    if (!activeFile?.claim) return;
    setFiles(prev => prev.map(f => {
      if (f.ingested.id !== activeFile.ingested.id || !f.claim) return f;
      const sec: any = { ...(f.claim as any)[section] };
      const existing = sec[key] || {};
      sec[key] = { ...existing, value: newValue };
      return { ...f, claim: { ...f.claim, [section]: sec } as ParsedClaim };
    }));
  };

  const updateLineItems = (items: ParsedLineItem[]) => {
    if (!activeFile?.claim) return;
    setFiles(prev => prev.map(f => {
      if (f.ingested.id !== activeFile.ingested.id || !f.claim) return f;
      return { ...f, claim: { ...f.claim, claim_line_items: items } };
    }));
  };

  const showFieldEvidence = (label: string, field: any) => {
    if (!field || !activeFile) return;
    const valueDisplay = Array.isArray(field.value) ? (field.value || []).join(", ") : String(field.value ?? "");
    setEvidence({
      open: true,
      fieldLabel: label,
      fieldValue: valueDisplay,
      source: activeFile.ingested.source,
      evidenceSnippet: field.evidence_snippet,
      sourceLocation: field.source_location,
      confidence: field.confidence,
    });
  };

  const showLineItemEvidence = (item: ParsedLineItem, idx: number) => {
    if (!activeFile) return;
    setEvidence({
      open: true,
      fieldLabel: `Line item #${idx + 1}`,
      fieldValue: `${item.procedure_code || "—"} · ${item.charge_amount ? "$" + item.charge_amount : ""}`,
      source: activeFile.ingested.source,
      evidenceSnippet: item.evidence_snippet,
      sourceLocation: item.source_location,
      confidence: item.confidence,
    });
  };

  // Run 5-perspective analysis on the active claim
  const runPerspectives = async () => {
    if (!activeFile?.claim) return;
    const id = activeFile.ingested.id;
    setFiles(prev => prev.map(f => f.ingested.id === id ? {
      ...f, perspectivesLoading: true, perspectivesError: null,
    } : f));
    try {
      const { data, error } = await supabase.functions.invoke("claim-perspectives", {
        body: { claim: activeFile.claim, fileName: activeFile.ingested.source.fileName },
      });
      if (error) throw error;
      setFiles(prev => prev.map(f => f.ingested.id === id ? {
        ...f,
        perspectivesLoading: false,
        perspectives: data?.perspectives || [],
        synthesis: data?.synthesis || null,
        perspectivesError: null,
      } : f));
      toast.success("5-perspective analysis complete");
    } catch (e: any) {
      const msg = e?.message?.includes("429") ? "Rate limited — try again shortly."
        : e?.message?.includes("402") ? "AI credits exhausted. Add credits in Workspace Settings."
        : e?.message || "Analysis failed";
      setFiles(prev => prev.map(f => f.ingested.id === id ? {
        ...f, perspectivesLoading: false, perspectivesError: msg,
      } : f));
      toast.error(msg);
    }
  };


  const claim: ParsedClaim = activeFile?.claim || EMPTY_CLAIM;
  const reviewFlagCount = claim.review_flags.length;
  const lineItemCount = claim.claim_line_items.length;
  const lowConfFields = useMemo(() => countLowConf(claim), [claim]);
  const inUploadStep = !anyClaim && !parsing;

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
            <p className="text-xs text-muted-foreground">Multi-file structured extraction · per-file 5-perspective audit</p>
          </div>
        </div>
        {anyClaim && (
          <div className="flex gap-2">
            <Button onClick={handleSaveAll} variant="outline" className="gap-2" disabled={!allReady}>
              <Save className="h-4 w-4" /> Save All
            </Button>
            {activeFile?.claim && (
              <Button onClick={handleSaveActive} className="gap-2" disabled={activeFile.saved}>
                <Save className="h-4 w-4" /> {activeFile.saved ? "Saved" : "Save This Claim"}
              </Button>
            )}
          </div>
        )}
      </div>

      {parsing && <Progress value={50} className="h-1.5" />}

      {/* Upload step */}
      {inUploadStep && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Brain className="h-4 w-4 text-primary" />
              Step 1 — Upload one or more claim documents
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ClaimMultiFileDropzone
              files={ingestedList}
              onAdd={handleAdd}
              onRemove={handleRemove}
              busy={parsing}
            />
            <div className="flex justify-between items-center">
              <p className="text-[11px] text-muted-foreground">
                Each file is sent to the parser separately, so claims never get mixed up.
              </p>
              <Button onClick={handleParseAll} disabled={files.length === 0 || parsing} className="gap-2">
                <Brain className="h-4 w-4" />
                Extract {files.length > 0 ? `${files.length} ` : ""}Claim{files.length !== 1 ? "s" : ""}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Parsing step */}
      {parsing && !anyClaim && (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
            <p className="text-sm font-medium">
              Extracting {files.length} claim{files.length !== 1 ? "s" : ""} in parallel…
            </p>
            <p className="text-xs text-muted-foreground">Capturing payer, patient, provider, codes, line items, and dollar amounts.</p>
          </CardContent>
        </Card>
      )}

      {/* Review step — per-file tabs */}
      {anyClaim && (
        <>
          {/* Add-more affordance even after we've started parsing */}
          {files.length < 10 && (
            <Card>
              <CardContent className="py-3">
                <ClaimMultiFileDropzone
                  files={ingestedList}
                  onAdd={handleAdd}
                  onRemove={handleRemove}
                  busy={parsing}
                />
                {files.some(f => f.status === "queued" || f.status === "error") && (
                  <div className="flex justify-end mt-2">
                    <Button onClick={handleParseAll} disabled={parsing} size="sm" className="gap-2">
                      <Brain className="h-3.5 w-3.5" />
                      Parse New File(s)
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Tabs value={activeFileId || files[0].ingested.id} onValueChange={setActiveFileId}>
            <div className="overflow-x-auto -mx-1 px-1">
              <TabsList className="h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
                {files.map((f) => {
                  const isErr = f.status === "error";
                  const isPending = f.status === "queued" || f.status === "parsing";
                  return (
                    <TabsTrigger
                      key={f.ingested.id}
                      value={f.ingested.id}
                      className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5 px-2.5 py-1.5 text-xs"
                    >
                      {f.ingested.source.kind === "image" ? (
                        <ImageIcon className="h-3 w-3" />
                      ) : (
                        <FileText className="h-3 w-3" />
                      )}
                      <span className="max-w-[140px] truncate">{f.ingested.source.fileName}</span>
                      {isErr && <XCircle className="h-3 w-3 text-destructive" />}
                      {isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                      {f.saved && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>

            {files.map((f) => (
              <TabsContent key={f.ingested.id} value={f.ingested.id} className="space-y-4 mt-4">
                {f.status === "error" && (
                  <Card className="border-destructive/40 bg-destructive/5">
                    <CardContent className="py-3 flex items-center gap-2 text-xs text-destructive">
                      <XCircle className="h-4 w-4" />
                      <span className="flex-1">{f.errorMessage}</span>
                      <Button size="sm" variant="outline" onClick={handleParseAll} className="gap-1.5">
                        <Brain className="h-3 w-3" /> Retry
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {f.status === "ready" && f.claim && (
                  <ClaimReview
                    claim={f.claim}
                    fileName={f.ingested.source.fileName}
                    lineItemCount={lineItemCount}
                    reviewFlagCount={reviewFlagCount}
                    lowConfFields={lowConfFields}
                    onUpdateField={updateField}
                    onUpdateLineItems={updateLineItems}
                    onShowFieldEvidence={showFieldEvidence}
                    onShowLineItemEvidence={showLineItemEvidence}
                  />
                )}

                {f.status === "ready" && f.claim && (
                  <PerspectivesPanel
                    loading={!!f.perspectivesLoading}
                    error={f.perspectivesError}
                    perspectives={f.perspectives}
                    synthesis={f.synthesis}
                    onRun={runPerspectives}
                    hasRun={!!f.perspectives && f.perspectives.length > 0}
                  />
                )}
              </TabsContent>
            ))}
          </Tabs>
        </>
      )}

      <EvidenceDrawer
        open={evidence.open}
        onClose={() => setEvidence((e) => ({ ...e, open: false }))}
        source={evidence.source}
        fieldLabel={evidence.fieldLabel}
        fieldValue={evidence.fieldValue}
        evidenceSnippet={evidence.evidenceSnippet}
        sourceLocation={evidence.sourceLocation}
        confidence={evidence.confidence}
      />
    </div>
  );
}

// ---- Subcomponents ----

interface ClaimReviewProps {
  claim: ParsedClaim;
  fileName: string;
  lineItemCount: number;
  reviewFlagCount: number;
  lowConfFields: number;
  onUpdateField: <S extends keyof ParsedClaim>(section: S, key: string, newValue: any) => void;
  onUpdateLineItems: (items: ParsedLineItem[]) => void;
  onShowFieldEvidence: (label: string, field: any) => void;
  onShowLineItemEvidence: (item: ParsedLineItem, idx: number) => void;
}

function ClaimReview({
  claim, fileName, lineItemCount, reviewFlagCount, lowConfFields,
  onUpdateField, onUpdateLineItems, onShowFieldEvidence, onShowLineItemEvidence,
}: ClaimReviewProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryStat icon={CheckCircle2} label="Line items" value={lineItemCount} tone="emerald" />
        <SummaryStat icon={AlertTriangle} label="Needs review" value={reviewFlagCount} tone={reviewFlagCount > 0 ? "amber" : "muted"} />
        <SummaryStat icon={AlertTriangle} label="Low-confidence fields" value={lowConfFields} tone={lowConfFields > 0 ? "amber" : "muted"} />
        <SummaryStat icon={FileSearch} label="Source" value={fileName} tone="muted" small />
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

      <Section title="Claim Header">
        <Grid>
          <ClaimField label="Payer name" field={claim.claim_header.payer_name} onChange={(v) => onUpdateField("claim_header", "payer_name", v)} onShowEvidence={() => onShowFieldEvidence("Payer name", claim.claim_header.payer_name)} />
          <ClaimField label="Payer type" field={claim.claim_header.payer_type} onChange={(v) => onUpdateField("claim_header", "payer_type", v)} onShowEvidence={() => onShowFieldEvidence("Payer type", claim.claim_header.payer_type)} />
          <ClaimField label="Claim number" field={claim.claim_header.claim_number} onChange={(v) => onUpdateField("claim_header", "claim_number", v)} onShowEvidence={() => onShowFieldEvidence("Claim number", claim.claim_header.claim_number)} />
          <ClaimField label="Authorization #" field={claim.claim_header.authorization_number} onChange={(v) => onUpdateField("claim_header", "authorization_number", v)} onShowEvidence={() => onShowFieldEvidence("Authorization #", claim.claim_header.authorization_number)} />
          <ClaimField label="Claim status" field={claim.claim_header.claim_status} onChange={(v) => onUpdateField("claim_header", "claim_status", v)} onShowEvidence={() => onShowFieldEvidence("Claim status", claim.claim_header.claim_status)} />
          <ClaimField label="Denial status" field={claim.claim_header.denial_status} onChange={(v) => onUpdateField("claim_header", "denial_status", v)} onShowEvidence={() => onShowFieldEvidence("Denial status", claim.claim_header.denial_status)} />
          <ClaimField label="Appeal status" field={claim.claim_header.appeal_status} onChange={(v) => onUpdateField("claim_header", "appeal_status", v)} onShowEvidence={() => onShowFieldEvidence("Appeal status", claim.claim_header.appeal_status)} />
          <ClaimField label="Denial reason codes" kind="array" field={claim.claim_header.denial_reason_codes} onChange={(v) => onUpdateField("claim_header", "denial_reason_codes", v)} onShowEvidence={() => onShowFieldEvidence("Denial reason codes", claim.claim_header.denial_reason_codes)} />
          <ClaimField label="Denial reason text" field={claim.claim_header.denial_reason_text} onChange={(v) => onUpdateField("claim_header", "denial_reason_text", v)} onShowEvidence={() => onShowFieldEvidence("Denial reason text", claim.claim_header.denial_reason_text)} />
          <ClaimField label="Filing deadline" kind="date" field={claim.claim_header.filing_deadline} onChange={(v) => onUpdateField("claim_header", "filing_deadline", v)} onShowEvidence={() => onShowFieldEvidence("Filing deadline", claim.claim_header.filing_deadline)} />
          <ClaimField label="Appeal deadline" kind="date" field={claim.claim_header.appeal_deadline} onChange={(v) => onUpdateField("claim_header", "appeal_deadline", v)} onShowEvidence={() => onShowFieldEvidence("Appeal deadline", claim.claim_header.appeal_deadline)} />
        </Grid>
      </Section>

      <Section title="Patient">
        <Grid>
          <ClaimField label="Patient name" field={claim.patient.patient_name} onChange={(v) => onUpdateField("patient", "patient_name", v)} onShowEvidence={() => onShowFieldEvidence("Patient name", claim.patient.patient_name)} />
          <ClaimField label="Patient ID" field={claim.patient.patient_id} onChange={(v) => onUpdateField("patient", "patient_id", v)} onShowEvidence={() => onShowFieldEvidence("Patient ID", claim.patient.patient_id)} />
          <ClaimField label="DOB" kind="date" field={claim.patient.dob} onChange={(v) => onUpdateField("patient", "dob", v)} onShowEvidence={() => onShowFieldEvidence("DOB", claim.patient.dob)} />
          <ClaimField label="Sex" field={claim.patient.sex} onChange={(v) => onUpdateField("patient", "sex", v)} onShowEvidence={() => onShowFieldEvidence("Sex", claim.patient.sex)} />
        </Grid>
      </Section>

      <Section title="Provider">
        <Grid>
          <ClaimField label="Billing provider" field={claim.provider.billing_provider} onChange={(v) => onUpdateField("provider", "billing_provider", v)} onShowEvidence={() => onShowFieldEvidence("Billing provider", claim.provider.billing_provider)} />
          <ClaimField label="Rendering provider" field={claim.provider.rendering_provider} onChange={(v) => onUpdateField("provider", "rendering_provider", v)} onShowEvidence={() => onShowFieldEvidence("Rendering provider", claim.provider.rendering_provider)} />
          <ClaimField label="Facility" field={claim.provider.facility_name} onChange={(v) => onUpdateField("provider", "facility_name", v)} onShowEvidence={() => onShowFieldEvidence("Facility", claim.provider.facility_name)} />
          <ClaimField label="NPI numbers" kind="array" field={claim.provider.npi_numbers} onChange={(v) => onUpdateField("provider", "npi_numbers", v)} onShowEvidence={() => onShowFieldEvidence("NPI numbers", claim.provider.npi_numbers)} />
          <ClaimField label="Tax ID" field={claim.provider.tax_id} onChange={(v) => onUpdateField("provider", "tax_id", v)} onShowEvidence={() => onShowFieldEvidence("Tax ID", claim.provider.tax_id)} />
        </Grid>
      </Section>

      <Section title="Service Information">
        <Grid>
          <ClaimField label="DOS from" kind="date" field={claim.service.date_of_service_from} onChange={(v) => onUpdateField("service", "date_of_service_from", v)} onShowEvidence={() => onShowFieldEvidence("DOS from", claim.service.date_of_service_from)} />
          <ClaimField label="DOS to" kind="date" field={claim.service.date_of_service_to} onChange={(v) => onUpdateField("service", "date_of_service_to", v)} onShowEvidence={() => onShowFieldEvidence("DOS to", claim.service.date_of_service_to)} />
          <ClaimField label="Place of service" field={claim.service.place_of_service} onChange={(v) => onUpdateField("service", "place_of_service", v)} onShowEvidence={() => onShowFieldEvidence("Place of service", claim.service.place_of_service)} />
          <ClaimField label="Type of bill" field={claim.service.type_of_bill} onChange={(v) => onUpdateField("service", "type_of_bill", v)} onShowEvidence={() => onShowFieldEvidence("Type of bill", claim.service.type_of_bill)} />
        </Grid>
      </Section>

      <Section title="Financials">
        <Grid>
          <ClaimField label="Total billed" kind="currency" field={claim.financials.total_billed_amount} onChange={(v) => onUpdateField("financials", "total_billed_amount", v)} onShowEvidence={() => onShowFieldEvidence("Total billed", claim.financials.total_billed_amount)} />
          <ClaimField label="Allowed" kind="currency" field={claim.financials.allowed_amount} onChange={(v) => onUpdateField("financials", "allowed_amount", v)} onShowEvidence={() => onShowFieldEvidence("Allowed", claim.financials.allowed_amount)} />
          <ClaimField label="Paid" kind="currency" field={claim.financials.paid_amount} onChange={(v) => onUpdateField("financials", "paid_amount", v)} onShowEvidence={() => onShowFieldEvidence("Paid", claim.financials.paid_amount)} />
          <ClaimField label="Denied" kind="currency" field={claim.financials.denied_amount} onChange={(v) => onUpdateField("financials", "denied_amount", v)} onShowEvidence={() => onShowFieldEvidence("Denied", claim.financials.denied_amount)} />
          <ClaimField label="Patient resp." kind="currency" field={claim.financials.patient_responsibility} onChange={(v) => onUpdateField("financials", "patient_responsibility", v)} onShowEvidence={() => onShowFieldEvidence("Patient resp.", claim.financials.patient_responsibility)} />
        </Grid>
      </Section>

      <Section title="Codes">
        <Grid>
          <ClaimField label="CPT codes" kind="array" field={claim.codes.cpt_codes} onChange={(v) => onUpdateField("codes", "cpt_codes", v)} onShowEvidence={() => onShowFieldEvidence("CPT codes", claim.codes.cpt_codes)} />
          <ClaimField label="HCPCS codes" kind="array" field={claim.codes.hcpcs_codes} onChange={(v) => onUpdateField("codes", "hcpcs_codes", v)} onShowEvidence={() => onShowFieldEvidence("HCPCS codes", claim.codes.hcpcs_codes)} />
          <ClaimField label="Modifiers" kind="array" field={claim.codes.modifier_codes} onChange={(v) => onUpdateField("codes", "modifier_codes", v)} onShowEvidence={() => onShowFieldEvidence("Modifiers", claim.codes.modifier_codes)} />
          <ClaimField label="ICD-10 codes" kind="array" field={claim.codes.icd10_codes} onChange={(v) => onUpdateField("codes", "icd10_codes", v)} onShowEvidence={() => onShowFieldEvidence("ICD-10 codes", claim.codes.icd10_codes)} />
          <ClaimField label="Diagnosis pointers" kind="array" field={claim.codes.diagnosis_pointers} onChange={(v) => onUpdateField("codes", "diagnosis_pointers", v)} onShowEvidence={() => onShowFieldEvidence("Diagnosis pointers", claim.codes.diagnosis_pointers)} />
        </Grid>
      </Section>

      <Section title="Claim Line Items">
        <LineItemsTable
          items={claim.claim_line_items}
          onChange={onUpdateLineItems}
          onShowEvidence={onShowLineItemEvidence}
        />
      </Section>

      {claim.unmapped_text.length > 0 && (
        <Section title="Unmapped text from document">
          <div className="space-y-1.5">
            {claim.unmapped_text.map((t, i) => (
              <div key={i} className="rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground italic">"{t}"</div>
            ))}
          </div>
        </Section>
      )}
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
