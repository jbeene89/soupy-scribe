import type { CodeViolation } from '@/lib/types';
import { ROLE_META, type SOUPYRole } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { CPTCodeBadge } from './CPTCodeBadge';
import { Download, Copy, Shield, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface AppealSummaryProps {
  violations: CodeViolation[];
  caseNumber: string;
}

export function AppealSummary({ violations, caseNumber }: AppealSummaryProps) {
  const uniqueViolations = violations.filter((v, i, arr) => arr.findIndex(x => x.id === v.id) === i);

  const exportAppeal = () => {
    let text = `APPEAL DEFENSE PACKAGE — ${caseNumber}\nGenerated: ${new Date().toISOString()}\n${'='.repeat(60)}\n\n`;
    uniqueViolations.forEach(v => {
      text += `VIOLATION: ${v.code} — ${v.description}\nSeverity: ${v.severity} | Type: ${v.type}\nRegulation: ${v.regulationRef}\n\n`;
      v.defenses.forEach(d => {
        text += `  [${ROLE_META[d.role].label}] (Strength: ${d.strength}%)\n`;
        text += `  Strategy: ${d.strategy}\n`;
        text += `  Strengths: ${d.strengths.join('; ')}\n`;
        text += `  Weaknesses: ${d.weaknesses.join('; ')}\n\n`;
      });
      text += `${'-'.repeat(60)}\n\n`;
    });
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `appeal-${caseNumber}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Appeal package downloaded');
  };

  const copyToClipboard = () => {
    const text = uniqueViolations.map(v => {
      const best = v.defenses.reduce((a, b) => a.strength > b.strength ? a : b);
      return `${v.code}: ${v.description}\nBest defense (${ROLE_META[best.role].label}, ${best.strength}%): ${best.strategy}`;
    }).join('\n\n');
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  if (uniqueViolations.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center shadow-sm">
        <Shield className="h-10 w-10 text-consensus mx-auto mb-3" />
        <p className="font-medium">No Violations Found</p>
        <p className="text-sm text-muted-foreground mt-1">All AI roles found no code violations for this case.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Appeal Defense Package</h3>
          <p className="text-sm text-muted-foreground">{uniqueViolations.length} violations with dual-voice analysis</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={copyToClipboard} className="gap-1.5 text-xs">
            <Copy className="h-3 w-3" />
            Quick Copy
          </Button>
          <Button size="sm" onClick={exportAppeal} className="gap-1.5 text-xs">
            <Download className="h-3 w-3" />
            Export Package
          </Button>
        </div>
      </div>

      <Accordion type="multiple" className="space-y-3">
        {uniqueViolations.map(v => {
          const bestDefense = v.defenses.reduce((a, b) => a.strength > b.strength ? a : b);
          return (
            <AccordionItem key={v.id} value={v.id} className="rounded-lg border bg-card shadow-sm">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <div className="flex items-center gap-3 text-left w-full">
                  <CPTCodeBadge code={v.code} />
                  <span className="text-sm flex-1">{v.description}</span>
                  <Badge variant="outline" className={cn('text-[10px]',
                    bestDefense.strength >= 60 ? 'bg-consensus/15 text-consensus border-consensus/30' :
                    bestDefense.strength >= 40 ? 'bg-disagreement/15 text-disagreement border-disagreement/30' :
                    'bg-violation/15 text-violation border-violation/30'
                  )}>
                    Best: {bestDefense.strength}%
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                  {/* Defense Column */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-consensus" />
                      <span className="text-sm font-medium">Defense Strategies</span>
                    </div>
                    {v.defenses.map(d => (
                      <div key={d.role} className="rounded-md border bg-consensus/5 border-consensus/20 p-3 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">{ROLE_META[d.role].label}</Badge>
                          <span className="text-xs font-mono text-consensus">{d.strength}%</span>
                        </div>
                        <p className="text-sm">{d.strategy}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {d.strengths.map((s, i) => (
                            <Badge key={i} variant="outline" className="text-[10px] bg-consensus/10 border-consensus/20">
                              ✓ {s}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Vulnerabilities Column */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-violation" />
                      <span className="text-sm font-medium">Vulnerabilities</span>
                    </div>
                    {v.defenses.map(d => (
                      <div key={d.role} className="rounded-md border bg-violation/5 border-violation/20 p-3 space-y-1.5">
                        <Badge variant="outline" className="text-[10px]">{ROLE_META[d.role].label}</Badge>
                        <ul className="space-y-1">
                          {d.weaknesses.map((w, i) => (
                            <li key={i} className="text-sm text-muted-foreground flex gap-1.5">
                              <span className="text-violation shrink-0">✗</span>
                              <span>{w}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>

                <p className="text-xs text-muted-foreground mt-3 font-mono">Ref: {v.regulationRef}</p>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
