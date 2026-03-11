import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AIRoleCard } from './AIRoleCard';
import { ConsensusMeter } from './ConsensusMeter';
import { RiskIndicator } from './RiskIndicator';
import { CPTCodeBadge } from './CPTCodeBadge';
import { CodeCombinationAnalysisCard } from './spark/CodeCombinationAnalysisCard';
import { EnhancedAppealSummary } from './spark/EnhancedAppealSummary';
import { mockCases, mockCodeCombinations } from '@/lib/mockData';
import type { AuditCase } from '@/lib/types';
import {
  Brain,
  Monitor,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ArrowRight,
  Lightbulb,
  Eye,
  Layers,
  TrendingUp,
  Shield,
  Stethoscope,
  DollarSign,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const demoCase = mockCases.find(c => c.analyses.length > 0)!;

/** Reusable stagger wrapper */
function StaggerItem({ index, baseDelay = 0, children, className }: {
  index: number;
  baseDelay?: number;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn('opacity-0 animate-slide-up', className)}
      style={{ animationDelay: `${baseDelay + index * 100}ms`, animationFillMode: 'forwards' }}
    >
      {children}
    </div>
  );
}

function SingleModelPanel({ auditCase }: { auditCase: AuditCase }) {
  const singleAnalysis = auditCase.analyses[0];
  if (!singleAnalysis) return null;

  const allViolations = singleAnalysis.violations;
  const hasViolations = allViolations.length > 0;

  return (
    <div className="space-y-4">
      <StaggerItem index={0} baseDelay={200}>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Monitor className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">AI Assessment</CardTitle>
            </div>
            <CardDescription>Single-model analysis using {singleAnalysis.model}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Confidence</span>
              <span className="font-mono text-lg font-semibold">{singleAnalysis.confidence}%</span>
            </div>
            <div className="h-2 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-1000 ease-out"
                style={{ width: `${singleAnalysis.confidence}%`, transitionDelay: '600ms' }}
              />
            </div>

            <div className="p-3 rounded-md bg-muted/50 border">
              <p className="text-sm italic text-muted-foreground">"{singleAnalysis.perspectiveStatement}"</p>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Key Findings</p>
              <ul className="space-y-1.5">
                {singleAnalysis.keyInsights.map((insight, i) => (
                  <li
                    key={i}
                    className="flex gap-2 text-sm opacity-0 animate-slide-up"
                    style={{ animationDelay: `${800 + i * 120}ms`, animationFillMode: 'forwards' }}
                  >
                    <span className="text-primary mt-0.5 shrink-0">→</span>
                    <span>{insight}</span>
                  </li>
                ))}
              </ul>
            </div>

            {hasViolations && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  Violations ({allViolations.length})
                </p>
                <div className="space-y-2">
                  {allViolations.map((v, i) => (
                    <div
                      key={v.id}
                      className="flex items-center gap-2 p-2 rounded-md border bg-card opacity-0 animate-slide-up"
                      style={{ animationDelay: `${1200 + i * 150}ms`, animationFillMode: 'forwards' }}
                    >
                      {v.severity === 'critical' ? (
                        <XCircle className="h-4 w-4 text-destructive shrink-0" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-disagreement shrink-0" />
                      )}
                      <CPTCodeBadge code={v.code} />
                      <span className="text-xs text-muted-foreground truncate">{v.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Separator />
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Overall</p>
              <p className="text-sm">{singleAnalysis.overallAssessment}</p>
            </div>
          </CardContent>
        </Card>
      </StaggerItem>

      {/* Blind spots — animate after single model finishes */}
      <StaggerItem index={0} baseDelay={1600}>
        <Card className="border-dashed border-2 border-muted-foreground/20">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Eye className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">Enhancement Opportunities</span>
            </div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {[
                'Opportunity to add adversarial challenge to assumptions',
                'Opportunity to add regulatory framework cross-check',
                'Opportunity to add systemic pattern analysis',
                'Opportunity to add consensus divergence measurement',
                'Single perspective — opportunity for multi-model depth',
              ].map((spot, i) => (
                <li
                  key={i}
                  className="flex gap-2 opacity-0 animate-slide-up"
                  style={{ animationDelay: `${1800 + i * 100}ms`, animationFillMode: 'forwards' }}
                >
                  <ArrowRight className="h-3 w-3 text-primary/50 shrink-0" />
                  <span>{spot}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </StaggerItem>
    </div>
  );
}

function SOUPYPanel({ auditCase }: { auditCase: AuditCase }) {
  const matchingCombos = mockCodeCombinations.filter(cc =>
    cc.codes.every(c => auditCase.cptCodes.includes(c))
  );

  // SOUPY side starts later to create dramatic contrast
  const soupyBase = 800;

  return (
    <div className="space-y-4">
      {/* Risk + Consensus */}
      <div className="grid grid-cols-2 gap-4">
        <StaggerItem index={0} baseDelay={soupyBase}>
          <Card>
            <CardContent className="p-4">
              <RiskIndicator riskScore={auditCase.riskScore} />
            </CardContent>
          </Card>
        </StaggerItem>
        <StaggerItem index={1} baseDelay={soupyBase}>
          <Card>
            <CardContent className="p-4 flex flex-col justify-center">
              <ConsensusMeter score={auditCase.consensusScore} />
              {auditCase.consensusScore < 80 && (
                <div className="mt-2 rounded-md border border-disagreement/30 bg-disagreement/5 p-2">
                  <p className="text-[10px] font-medium text-disagreement">
                    ⚠ Models diverge — multiple perspectives surfaced
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </StaggerItem>
      </div>

      {/* Code Combination Analysis */}
      {matchingCombos.map((combo, i) => (
        <StaggerItem key={i} index={i} baseDelay={soupyBase + 300}>
          <CodeCombinationAnalysisCard analysis={combo} />
        </StaggerItem>
      ))}

      {/* SOUPY Role Cards */}
      <StaggerItem index={0} baseDelay={soupyBase + 500}>
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Layers className="h-4 w-4 text-accent" />
            <h3 className="text-sm font-semibold">4-Model Adversarial Analysis</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {auditCase.analyses.map((analysis, i) => (
              <AIRoleCard key={analysis.role} analysis={analysis} staggerIndex={i} />
            ))}
          </div>
        </div>
      </StaggerItem>

      {/* Enhanced Appeal Summary */}
      <StaggerItem index={0} baseDelay={soupyBase + 1000}>
        <EnhancedAppealSummary auditCase={auditCase} />
      </StaggerItem>
    </div>
  );
}

export function ComparisonView() {
  const auditCase = demoCase;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border bg-accent/10 text-accent">
          <Lightbulb className="h-4 w-4" />
          <span className="text-xs font-semibold uppercase tracking-wider">Value Demonstration</span>
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">
          Single Model vs. SOUPY ThinkTank
        </h2>
        <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
          See how forced epistemic diversity catches critical audit risks that traditional
          single-model AI overlooks. Same case, same data — dramatically different depth.
        </p>
      </div>

      {/* Case context bar */}
      <Card className="opacity-0 animate-slide-up" style={{ animationDelay: '100ms', animationFillMode: 'forwards' }}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-sm">{auditCase.caseNumber}</span>
              <Badge variant="outline" className="font-mono text-xs">{auditCase.physicianId}</Badge>
              <span className="text-sm text-muted-foreground">{auditCase.physicianName}</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span>DOS: {auditCase.dateOfService}</span>
              <span className="font-mono font-semibold text-foreground">
                ${auditCase.claimAmount.toLocaleString()}
              </span>
              <div className="flex gap-1">
                {auditCase.cptCodes.map(c => <CPTCodeBadge key={c} code={c} />)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Side-by-side comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative">
        {/* Left: Single Model — slides in from left */}
        <div className="space-y-3 opacity-0 animate-slide-in-left" style={{ animationDelay: '200ms', animationFillMode: 'forwards' }}>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-muted">
              <Monitor className="h-4 w-4 text-muted-foreground" />
            </div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Standard Single-Model AI
            </h3>
          </div>
          <SingleModelPanel auditCase={auditCase} />
        </div>

        {/* Center divider with arrow */}
        <div className="hidden lg:flex absolute left-1/2 top-12 bottom-0 -translate-x-1/2 flex-col items-center z-10">
          <div className="w-px flex-1 bg-border" />
          <div className="my-2 p-2 rounded-full border bg-card shadow-sm opacity-0 animate-count-up" style={{ animationDelay: '500ms', animationFillMode: 'forwards' }}>
            <ArrowRight className="h-4 w-4 text-accent" />
          </div>
          <div className="w-px flex-1 bg-border" />
        </div>

        {/* Right: SOUPY — slides in from right */}
        <div className="space-y-3 opacity-0 animate-slide-in-right" style={{ animationDelay: '400ms', animationFillMode: 'forwards' }}>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-accent/10">
              <Brain className="h-4 w-4 text-accent" />
            </div>
            <h3 className="text-sm font-semibold text-accent uppercase tracking-wider">
              SOUPY ThinkTank (4-Model)
            </h3>
          </div>
          <SOUPYPanel auditCase={auditCase} />
        </div>
      </div>

      {/* Value gap summary — appears last with pop effect */}
      <Card
        className="border-2 border-accent bg-accent/5 opacity-0 animate-slide-up"
        style={{ animationDelay: '2200ms', animationFillMode: 'forwards' }}
      >
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-2 rounded-lg bg-accent/10 shrink-0">
              <Brain className="h-6 w-6 text-accent" />
            </div>
            <div className="space-y-3 flex-1">
              <h3 className="font-semibold">The Amplification Layer</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { value: `${auditCase.analyses.length}x`, label: 'More Perspectives', colorClass: 'text-accent' },
                  { value: `${auditCase.analyses.flatMap(a => a.violations).length - (auditCase.analyses[0]?.violations.length || 0)}`, label: 'Additional Violations Found', colorClass: 'text-destructive' },
                  { value: `${auditCase.consensusScore}%`, label: 'Consensus Measured', colorClass: 'text-consensus' },
                ].map((stat, i) => (
                  <div key={i} className="rounded-md border bg-card p-3 text-center">
                    <p
                      className={cn('text-2xl font-semibold opacity-0 animate-count-up', stat.colorClass)}
                      style={{ animationDelay: `${2400 + i * 200}ms`, animationFillMode: 'forwards' }}
                    >
                      {stat.value}
                    </p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                Single-model AI found {auditCase.analyses[0]?.violations.length || 0} violation(s) with {auditCase.analyses[0]?.confidence}% confidence.
                SOUPY's adversarial protocol uncovered {auditCase.analyses.flatMap(a => a.violations).length} total violations across {auditCase.analyses.length} independent perspectives,
                with a {auditCase.consensusScore}% consensus score that flags areas of genuine analytical uncertainty.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Strategic positioning — what this means for the business */}
      <Card
        className="border border-primary/20 bg-primary/3 opacity-0 animate-slide-up"
        style={{ animationDelay: '2800ms', animationFillMode: 'forwards' }}
      >
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Operational Impact — Why This Matters</h3>
              <p className="text-xs text-muted-foreground">
                The same intelligence engine that strengthens payer determinations also eliminates provider friction
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg border bg-card p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-consensus" />
                <span className="text-xs font-semibold uppercase tracking-wider">For Payment Integrity</span>
              </div>
              <ul className="space-y-1.5">
                {[
                  'Defensible determinations with documented AI reasoning',
                  'Projected reduction in overturned appeals (modeled estimate)',
                  'Audit packages pre-built for each payer type',
                ].map((item, i) => (
                  <li key={i} className="text-[11px] text-muted-foreground flex gap-1.5">
                    <span className="text-consensus shrink-0">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-lg border bg-card p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Stethoscope className="h-4 w-4 text-accent" />
                <span className="text-xs font-semibold uppercase tracking-wider">For Provider Networks</span>
              </div>
              <ul className="space-y-1.5">
                {[
                  'Pre-submission validation against audit-grade AI',
                  'Documentation guidance that prevents flags at the source',
                  'Same engine, educational posture — natural channel extension',
                ].map((item, i) => (
                  <li key={i} className="text-[11px] text-muted-foreground flex gap-1.5">
                    <span className="text-accent shrink-0">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-lg border-2 border-dashed border-accent/40 bg-accent/5 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-accent" />
                <span className="text-xs font-semibold uppercase tracking-wider">Net Effect</span>
              </div>
              <ul className="space-y-1.5">
                {[
                  'Each payer deployment creates organic provider demand',
                  'Zero incremental engineering between modules',
                  'Retention flywheel: providers stay because the audit tool knows them',
                ].map((item, i) => (
                  <li key={i} className="text-[11px] text-muted-foreground flex gap-1.5">
                    <span className="text-foreground font-bold shrink-0">→</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="text-[10px] text-muted-foreground text-center italic">
            One platform, two market surfaces, compounding value with each deployment. 
            The intelligence layer that makes audit determinations stronger simultaneously makes provider claims cleaner — 
            reducing total cost of the payment integrity lifecycle for everyone in the chain.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
