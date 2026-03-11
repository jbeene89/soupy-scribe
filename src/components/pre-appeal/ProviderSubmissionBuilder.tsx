import type { PreAppealResolution, ProviderSubmission } from '@/lib/preAppealTypes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { AuthGate } from '@/components/AuthGate';
import { useState } from 'react';
import { toast } from 'sonner';
import { FileText, Send } from 'lucide-react';

interface ProviderSubmissionBuilderProps {
  resolution: PreAppealResolution;
}

export function ProviderSubmissionBuilder({ resolution }: ProviderSubmissionBuilderProps) {
  const [submission, setSubmission] = useState<ProviderSubmission>({
    issueSummary: '',
    codingExplanation: '',
    supportingDocChecklist: [],
    chronologyClarification: '',
    medicalNecessityClarification: '',
    coverNote: '',
  });

  const requiredDocs = resolution.evidenceChecklist
    .filter(e => e.priority === 'required' || e.priority === 'helpful')
    .map(e => e.record);

  const toggleDoc = (doc: string) => {
    setSubmission(prev => ({
      ...prev,
      supportingDocChecklist: prev.supportingDocChecklist.includes(doc)
        ? prev.supportingDocChecklist.filter(d => d !== doc)
        : [...prev.supportingDocChecklist, doc],
    }));
  };

  const handleSubmit = () => {
    toast.success('Pre-appeal resolution submission prepared');
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-accent" />
          <CardTitle className="text-base">Provider Submission Builder</CardTitle>
        </div>
        <p className="text-xs text-muted-foreground">Prepare a focused reconsideration packet for the optional accelerated resolution path</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="text-xs">Concise Issue Summary</Label>
          <Textarea
            placeholder="Briefly describe the core issue and why this denial may be resolvable..."
            value={submission.issueSummary}
            onChange={e => setSubmission(prev => ({ ...prev, issueSummary: e.target.value }))}
            className="min-h-[60px] text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Corrected / Clarified Coding Explanation</Label>
          <Textarea
            placeholder="Explain the coding rationale or correction..."
            value={submission.codingExplanation}
            onChange={e => setSubmission(prev => ({ ...prev, codingExplanation: e.target.value }))}
            className="min-h-[60px] text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Supporting Documentation Checklist</Label>
          <div className="space-y-1.5 rounded-md border bg-background p-3">
            {requiredDocs.map(doc => (
              <div key={doc} className="flex items-center gap-2">
                <Checkbox
                  checked={submission.supportingDocChecklist.includes(doc)}
                  onCheckedChange={() => toggleDoc(doc)}
                  id={`doc-${doc}`}
                />
                <label htmlFor={`doc-${doc}`} className="text-xs cursor-pointer">{doc}</label>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Chronology / Date Clarification <span className="text-muted-foreground">(if applicable)</span></Label>
          <Textarea
            placeholder="Clarify any timeline or date discrepancies..."
            value={submission.chronologyClarification}
            onChange={e => setSubmission(prev => ({ ...prev, chronologyClarification: e.target.value }))}
            className="min-h-[50px] text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Medical Necessity Clarification <span className="text-muted-foreground">(if applicable)</span></Label>
          <Textarea
            placeholder="Provide additional medical necessity justification..."
            value={submission.medicalNecessityClarification}
            onChange={e => setSubmission(prev => ({ ...prev, medicalNecessityClarification: e.target.value }))}
            className="min-h-[50px] text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Optional Cover Note</Label>
          <Textarea
            placeholder="Additional context for the reviewer..."
            value={submission.coverNote}
            onChange={e => setSubmission(prev => ({ ...prev, coverNote: e.target.value }))}
            className="min-h-[50px] text-sm"
          />
        </div>

        <AuthGate>
          <Button onClick={handleSubmit} className="w-full gap-2">
            <Send className="h-4 w-4" />
            Prepare Reconsideration Submission
          </Button>
        </AuthGate>
      </CardContent>
    </Card>
  );
}
