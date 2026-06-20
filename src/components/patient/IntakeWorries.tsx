import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { WORRIES, type WorryValue, type Recollection } from '@/lib/patientSelfHelpTypes';

type Props = {
  worries: WorryValue[];
  onWorriesChange: (next: WorryValue[]) => void;
  recollection: Recollection;
  onRecollectionChange: (next: Recollection) => void;
};

export function IntakeWorries({ worries, onWorriesChange, recollection, onRecollectionChange }: Props) {
  const toggle = (v: WorryValue) => {
    if (worries.includes(v)) onWorriesChange(worries.filter((x) => x !== v));
    else onWorriesChange([...worries, v]);
  };
  const set = (k: keyof Recollection, v: string) =>
    onRecollectionChange({ ...recollection, [k]: v });

  return (
    <div className="space-y-6">
      <div>
        <Label className="text-base">What are you worried happened?</Label>
        <p className="text-xs text-muted-foreground mb-2">Pick any that fit. We use this to focus the review.</p>
        <div className="flex flex-wrap gap-2">
          {WORRIES.map((w) => {
            const active = worries.includes(w.value);
            return (
              <Badge
                key={w.value}
                variant={active ? 'default' : 'outline'}
                className="cursor-pointer text-sm py-1.5 px-3"
                onClick={() => toggle(w.value)}
              >
                {w.label}
              </Badge>
            );
          })}
        </div>
      </div>

      <div>
        <Label className="text-base">What do you remember?</Label>
        <p className="text-xs text-muted-foreground mb-2">All optional. Anything you fill in helps the review.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label htmlFor="approxTime" className="text-xs">Approximate date / time</Label>
            <Input id="approxTime" value={recollection.approxTime ?? ''} onChange={(e) => set('approxTime', e.target.value)} placeholder="e.g. March 14, around 2pm" />
          </div>
          <div>
            <Label htmlFor="whoPresent" className="text-xs">Who was present</Label>
            <Input id="whoPresent" value={recollection.whoPresent ?? ''} onChange={(e) => set('whoPresent', e.target.value)} placeholder="e.g. Dr. Smith, nurse Lacey" />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="whatWasSaid" className="text-xs">What was said to you</Label>
            <Textarea id="whatWasSaid" rows={2} value={recollection.whatWasSaid ?? ''} onChange={(e) => set('whatWasSaid', e.target.value)} />
          </div>
          <div>
            <Label htmlFor="consentedTo" className="text-xs">What you consented to</Label>
            <Textarea id="consentedTo" rows={2} value={recollection.whatYouConsentedTo ?? ''} onChange={(e) => set('whatYouConsentedTo', e.target.value)} />
          </div>
          <div>
            <Label htmlFor="notTold" className="text-xs">What you were NOT told</Label>
            <Textarea id="notTold" rows={2} value={recollection.whatYouWereNotTold ?? ''} onChange={(e) => set('whatYouWereNotTold', e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="quote" className="text-xs">Any quote you remember</Label>
            <Input id="quote" value={recollection.quote ?? ''} onChange={(e) => set('quote', e.target.value)} placeholder='e.g. "I think she just did a membrane sweep."' />
          </div>
        </div>
      </div>
    </div>
  );
}