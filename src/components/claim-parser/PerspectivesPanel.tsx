// Six-perspective panel for a single parsed claim.
// Renders Builder / Red Team / Systems / Frame Breaker / Empath / Revenue
// plus a synthesis card. Lives next to the extracted-fields review.
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Hammer, Swords, Network, Eye, HeartHandshake, Sparkles, Loader2, AlertCircle, RefreshCw,
  CheckCircle2, TrendingUp, DollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type LensKey = "builder" | "red_team" | "systems" | "frame_breaker" | "empath" | "revenue";

export interface LensFinding {
  point: string;
  field_path?: string | null;
  severity: "low" | "medium" | "high";
}

export interface LensOutput {
  headline: string;
  findings: LensFinding[];
  recommended_actions: string[];
}

export interface LensResult {
  lens: LensKey | string;
  label?: string;
  output?: LensOutput;
  error?: string;
}

export interface PerspectiveSynthesis {
  overall_posture: "clean" | "defensible" | "needs_documentation" | "high_denial_risk" | "human_review_required";
  confidence: number;
  headline: string;
  validation_summary?: string;
  revenue_opportunities?: string[];
  agreement_points: string[];
  tension_points: string[];
  top_actions: string[];
}

interface PerspectivesPanelProps {
  loading: boolean;
  error?: string | null;
  perspectives?: LensResult[];
  synthesis?: PerspectiveSynthesis | null;
  onRun: () => void;
  hasRun: boolean;
}

const LENS_META: Record<LensKey, { label: string; icon: any; color: string }> = {
  builder:       { label: "Builder",       icon: Hammer,         color: "text-emerald-600 bg-emerald-500/10" },
  red_team:      { label: "Red Team",      icon: Swords,         color: "text-destructive bg-destructive/10" },
  systems:       { label: "Systems",       icon: Network,        color: "text-blue-600 bg-blue-500/10" },
  frame_breaker: { label: "Frame Breaker", icon: Eye,            color: "text-violet-600 bg-violet-500/10" },
  empath:        { label: "Empath",        icon: HeartHandshake, color: "text-amber-600 bg-amber-500/10" },
  revenue:       { label: "Revenue",       icon: DollarSign,     color: "text-green-600 bg-green-500/10" },
};

const POSTURE_META: Record<PerspectiveSynthesis["overall_posture"], { label: string; tone: string }> = {
  clean:                   { label: "Validated — Clean Claim",  tone: "text-emerald-700 border-emerald-500/50 bg-emerald-500/10" },
  defensible:              { label: "Defensible",              tone: "text-emerald-600 border-emerald-500/40 bg-emerald-500/5" },
  needs_documentation:     { label: "Needs Documentation",     tone: "text-amber-600 border-amber-500/40 bg-amber-500/5" },
  high_denial_risk:        { label: "High Denial Risk",        tone: "text-destructive border-destructive/40 bg-destructive/5" },
  human_review_required:   { label: "Human Review Required",   tone: "text-violet-600 border-violet-500/40 bg-violet-500/5" },
};

export function PerspectivesPanel({
  loading, error, perspectives, synthesis, onRun, hasRun,
}: PerspectivesPanelProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Five-Perspective Analysis
          </CardTitle>
          <Button size="sm" variant={hasRun ? "outline" : "default"} onClick={onRun} disabled={loading} className="gap-1.5">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {loading ? "Running…" : hasRun ? "Re-run" : "Run analysis"}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Builder · Red Team · Systems · Frame Breaker · Empath · Revenue — each lens reviews this claim independently. The synthesis validates clean claims and surfaces revenue opportunities.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {!hasRun && !loading && !error && (
          <p className="text-xs text-muted-foreground italic">
            Click "Run analysis" to evaluate this claim through all five lenses.
          </p>
        )}

        {loading && !perspectives?.length && (
          <div className="py-6 text-center space-y-2">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
            <p className="text-xs text-muted-foreground">Five perspectives reviewing this claim in parallel…</p>
          </div>
        )}

        {synthesis && (
          <div className={cn("rounded-md border px-3 py-2.5 space-y-2", POSTURE_META[synthesis.overall_posture].tone)}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Badge variant="outline" className={cn("text-[10px] font-semibold", POSTURE_META[synthesis.overall_posture].tone)}>
                {POSTURE_META[synthesis.overall_posture].label}
              </Badge>
              <Badge variant="outline" className="text-[10px] font-mono">
                {Math.round((synthesis.confidence || 0) * 100)}% confidence
              </Badge>
            </div>
            <p className="text-sm font-medium text-foreground">{synthesis.headline}</p>
            {synthesis.top_actions?.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Top actions</p>
                <ul className="space-y-1">
                  {synthesis.top_actions.map((a, i) => (
                    <li key={i} className="text-xs text-foreground flex gap-2">
                      <span className="text-muted-foreground shrink-0">{i + 1}.</span>
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(synthesis.agreement_points?.length > 0 || synthesis.tension_points?.length > 0) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                {synthesis.agreement_points?.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Where lenses agree</p>
                    <ul className="space-y-0.5">
                      {synthesis.agreement_points.map((p, i) => (
                        <li key={i} className="text-[11px] text-foreground">• {p}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {synthesis.tension_points?.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Where lenses disagree</p>
                    <ul className="space-y-0.5">
                      {synthesis.tension_points.map((p, i) => (
                        <li key={i} className="text-[11px] text-foreground">• {p}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {perspectives && perspectives.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {perspectives.map((p) => {
              const meta = LENS_META[p.lens as LensKey];
              if (!meta) return null;
              const Icon = meta.icon;
              return (
                <div key={p.lens} className="rounded-md border bg-card px-3 py-2.5 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className={cn("h-7 w-7 rounded-md flex items-center justify-center", meta.color)}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <p className="text-xs font-semibold text-foreground">{meta.label}</p>
                  </div>
                  {p.error ? (
                    <p className="text-[11px] text-destructive italic">Lens failed: {p.error}</p>
                  ) : p.output ? (
                    <>
                      <p className="text-xs text-foreground font-medium">{p.output.headline}</p>
                      {p.output.findings?.length > 0 && (
                        <ul className="space-y-1 pt-1">
                          {p.output.findings.slice(0, 5).map((f, i) => (
                            <li key={i} className="text-[11px] text-foreground flex gap-1.5 items-start">
                              <Badge variant="outline" className={cn(
                                "text-[8px] shrink-0 font-mono",
                                f.severity === "high" ? "border-destructive/40 text-destructive" :
                                f.severity === "medium" ? "border-amber-500/40 text-amber-600" :
                                "border-muted-foreground/40 text-muted-foreground",
                              )}>{f.severity}</Badge>
                              <span className="min-w-0">
                                {f.point}
                                {f.field_path && (
                                  <span className="block font-mono text-[9px] text-muted-foreground mt-0.5">{f.field_path}</span>
                                )}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {p.output.recommended_actions?.length > 0 && (
                        <div className="pt-1 border-t border-border/50">
                          <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-0.5">Actions</p>
                          <ul className="space-y-0.5">
                            {p.output.recommended_actions.slice(0, 3).map((a, i) => (
                              <li key={i} className="text-[11px] text-foreground">→ {a}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
