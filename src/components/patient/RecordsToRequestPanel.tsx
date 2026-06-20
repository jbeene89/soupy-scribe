import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, ClipboardCheck } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

export function RecordsToRequestPanel({ asks }: { asks: string[] }) {
  const { toast } = useToast();
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const copy = async (text: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIdx(idx);
      toast({ title: 'Copied', description: 'Paste this into your records-request message.' });
      setTimeout(() => setCopiedIdx(null), 2000);
    } catch { /* ignore */ }
  };

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(asks.map((a, i) => `${i + 1}. ${a}`).join('\n'));
      toast({ title: 'All copied', description: 'Full request list copied to clipboard.' });
    } catch { /* ignore */ }
  };

  if (!asks.length) return null;

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="text-lg">Records to request next</CardTitle>
            <CardDescription>Copy any line and send it to the health system's records department or patient relations office.</CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={copyAll}>
            <Copy className="h-4 w-4 mr-1" /> Copy all
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ol className="space-y-2">
          {asks.map((ask, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <span className="font-mono text-xs text-muted-foreground pt-1 shrink-0">{i + 1}.</span>
              <span className="flex-1">{ask}</span>
              <Button size="sm" variant="ghost" onClick={() => copy(ask, i)}>
                {copiedIdx === i ? <ClipboardCheck className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              </Button>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}