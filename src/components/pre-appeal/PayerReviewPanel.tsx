import type { PayerResponse, PayerResponseType } from '@/lib/preAppealTypes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AuthGate } from '@/components/AuthGate';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { toast } from 'sonner';
import { Shield, CheckCircle, AlertTriangle, XCircle, ArrowRight, FileSearch } from 'lucide-react';

const responseOptions: { type: PayerResponseType; label: string; icon: React.ElementType; color: string }[] = [
  { type: 'resolved-pay-as-submitted', label: 'Resolved — Pay as Submitted', icon: CheckCircle, color: 'text-consensus' },
  { type: 'resolved-partial', label: 'Resolved — Partial / Downcode', icon: AlertTriangle, color: 'text-disagreement' },
  { type: 'additional-records-needed', label: 'Additional Records Needed', icon: FileSearch, color: 'text-accent' },
  { type: 'clarification-needed', label: 'Clarification Needed', icon: FileSearch, color: 'text-accent' },
  { type: 'uphold-denial', label: 'Uphold Current Denial', icon: XCircle, color: 'text-violation' },
  { type: 'route-to-formal-appeal', label: 'Route to Formal Appeal', icon: ArrowRight, color: 'text-info-blue' },
  { type: 'escalate-compliance', label: 'Escalate to Compliance / SIU', icon: Shield, color: 'text-violation' },
];

interface PayerReviewPanelProps {
  existingResponse?: PayerResponse;
  onRespond?: (response: PayerResponse) => void;
}

export function PayerReviewPanel({ existingResponse, onRespond }: PayerReviewPanelProps) {
  const [selected, setSelected] = useState<PayerResponseType | null>(existingResponse?.type ?? null);
  const [rationale, setRationale] = useState(existingResponse?.rationale ?? '');
  const [missingItems, setMissingItems] = useState(existingResponse?.missingItems.join('\n') ?? '');
  const [reconsiderationNeeded, setReconsiderationNeeded] = useState(existingResponse?.reconsiderationNeeded ?? '');

  const handleSubmit = () => {
    if (!selected) return;
    const response: PayerResponse = {
      type: selected,
      rationale,
      missingItems: missingItems.split('\n').filter(Boolean),
      reconsiderationNeeded,
      formalAppealLikely: selected === 'route-to-formal-appeal' || selected === 'uphold-denial',
    };
    onRespond?.(response);
    toast.success('Payer response recorded');
  };

  if (existingResponse) {
    const opt = responseOptions.find(o => o.type === existingResponse.type);
    const Icon = opt?.icon ?? CheckCircle;

    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-accent" />
            Payer Review Response
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className={cn('flex items-center gap-2 text-sm font-semibold', opt?.color)}>
            <Icon className="h-4 w-4" />
            {opt?.label}
          </div>
          <p className="text-sm text-muted-foreground">{existingResponse.rationale}</p>
          {existingResponse.missingItems.length > 0 && (
            <div>
              <p className="text-xs font-medium">Missing Items:</p>
              <ul className="text-xs text-muted-foreground list-disc list-inside">
                {existingResponse.missingItems.map((m, i) => <li key={i}>{m}</li>)}
              </ul>
            </div>
          )}
          {existingResponse.formalAppealLikely && (
            <Badge variant="outline" className="text-xs border-info-blue/40 text-info-blue bg-info-blue/10">
              Formal appeal may be necessary
            </Badge>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-accent" />
          <CardTitle className="text-base">Payer Review Panel</CardTitle>
        </div>
        <p className="text-xs text-muted-foreground">Respond to this pre-appeal resolution request</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-1.5">
          {responseOptions.map(opt => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.type}
                onClick={() => setSelected(opt.type)}
                className={cn(
                  'flex items-center gap-2 rounded-md border p-2.5 text-left text-sm transition-colors',
                  selected === opt.type
                    ? 'border-accent bg-accent/10 font-medium'
                    : 'hover:bg-muted/50'
                )}
              >
                <Icon className={cn('h-4 w-4 shrink-0', opt.color)} />
                {opt.label}
              </button>
            );
          })}
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Short Rationale</Label>
          <Textarea
            placeholder="Explain the basis for this response..."
            value={rationale}
            onChange={e => setRationale(e.target.value)}
            className="min-h-[60px] text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Missing Items <span className="text-muted-foreground">(one per line)</span></Label>
          <Textarea
            placeholder="List any specific missing items..."
            value={missingItems}
            onChange={e => setMissingItems(e.target.value)}
            className="min-h-[50px] text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs">What Would Be Needed for Reconsideration</Label>
          <Textarea
            placeholder="Describe what the provider would need to submit..."
            value={reconsiderationNeeded}
            onChange={e => setReconsiderationNeeded(e.target.value)}
            className="min-h-[50px] text-sm"
          />
        </div>

        <AuthGate>
          <Button onClick={handleSubmit} disabled={!selected} className="w-full gap-2">
            <Shield className="h-4 w-4" />
            Submit Payer Response
          </Button>
        </AuthGate>
      </CardContent>
    </Card>
  );
}
