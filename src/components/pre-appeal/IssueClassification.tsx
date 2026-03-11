import type { DenialIssue, IssueCategory } from '@/lib/preAppealTypes';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { ChevronDown, CheckCircle, XCircle, FileText, Code, Clock, ShieldAlert, Wrench, Gavel } from 'lucide-react';
import { useState } from 'react';

const categoryConfig: Record<IssueCategory, { label: string; icon: React.ElementType; color: string }> = {
  'missing-documentation': { label: 'Missing Documentation', icon: FileText, color: 'text-disagreement' },
  'documentation-contradiction': { label: 'Documentation Contradiction', icon: ShieldAlert, color: 'text-violation' },
  'coding-clarification': { label: 'Coding Clarification Needed', icon: Code, color: 'text-accent' },
  'modifier-support': { label: 'Modifier Support Needed', icon: Wrench, color: 'text-accent' },
  'medical-necessity': { label: 'Medical Necessity Support', icon: ShieldAlert, color: 'text-disagreement' },
  'timeline-mismatch': { label: 'Timeline / Date Mismatch', icon: Clock, color: 'text-disagreement' },
  'likely-non-curable': { label: 'Likely Non-Curable Issue', icon: XCircle, color: 'text-violation' },
  'likely-formal-appeal': { label: 'Likely Formal Appeal Issue', icon: Gavel, color: 'text-info-blue' },
  'administrative-correction': { label: 'Administrative Correction', icon: Wrench, color: 'text-muted-foreground' },
};

interface IssueClassificationProps {
  issues: DenialIssue[];
}

export function IssueClassification({ issues }: IssueClassificationProps) {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setOpenIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Issue Classification</CardTitle>
        <p className="text-xs text-muted-foreground">Identified denial/rejection issue categories</p>
      </CardHeader>
      <CardContent className="space-y-2">
        {issues.map(issue => {
          const cat = categoryConfig[issue.category];
          const Icon = cat.icon;
          const isOpen = openIds.has(issue.id);

          return (
            <Collapsible key={issue.id} open={isOpen} onOpenChange={() => toggle(issue.id)}>
              <CollapsibleTrigger className="flex w-full items-center gap-3 rounded-md border bg-background p-3 text-left hover:bg-muted/50 transition-colors">
                <Icon className={cn('h-4 w-4 shrink-0', cat.color)} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{issue.title}</p>
                  <Badge variant="outline" className="text-[10px] mt-1">{cat.label}</Badge>
                </div>
                {issue.isCurable ? (
                  <Badge variant="outline" className="text-[10px] border-consensus/40 text-consensus bg-consensus/10 shrink-0">Curable</Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] border-violation/40 text-violation bg-violation/10 shrink-0">Not Curable</Badge>
                )}
                <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />
              </CollapsibleTrigger>
              <CollapsibleContent className="px-3 pb-3">
                <div className="mt-2 rounded-md border bg-muted/30 p-3 space-y-2 text-sm">
                  <p className="text-muted-foreground">{issue.description}</p>
                  <div>
                    <p className="text-xs font-medium text-foreground">Clarification Needed:</p>
                    <p className="text-xs text-muted-foreground">{issue.clarificationNeeded}</p>
                  </div>
                  {issue.supportingEvidence.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-foreground">Supporting Evidence:</p>
                      <ul className="text-xs text-muted-foreground list-disc list-inside">
                        {issue.supportingEvidence.map((e, i) => <li key={i}>{e}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </CardContent>
    </Card>
  );
}
