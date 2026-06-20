import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, ClipboardCheck, Printer, Download } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { exportSelfHelpRecordsChecklistPDF } from '@/lib/exportPatientSelfHelpPDFs';

export function RecordsToRequestPanel({
  asks,
  caseTitle,
  contactName,
}: { asks: string[]; caseTitle?: string | null; contactName?: string | null }) {
  const { toast } = useToast();
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [checked, setChecked] = useState<Record<number, boolean>>({});

  const toggle = (i: number) =>
    setChecked((prev) => ({ ...prev, [i]: !prev[i] }));

  const checkedCount = asks.reduce((n, _, i) => n + (checked[i] ? 1 : 0), 0);

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

  const downloadChecklist = () => {
    exportSelfHelpRecordsChecklistPDF(
      caseTitle ?? null,
      contactName ?? null,
      asks.map((text, i) => ({ text, checked: !!checked[i] })),
    );
  };

  const checkAll = () => {
    const all: Record<number, boolean> = {};
    asks.forEach((_, i) => { all[i] = true; });
    setChecked(all);
  };
  const clearAll = () => setChecked({});

  if (!asks.length) return null;

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="text-lg">Records to request next</CardTitle>
            <CardDescription>
              Check off each item as you request it, then download the checklist as a PDF to keep with your records.
              {asks.length > 0 && (
                <span className="block mt-1 text-xs">
                  {checkedCount} of {asks.length} marked requested
                </span>
              )}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" onClick={checkedCount === asks.length ? clearAll : checkAll}>
              {checkedCount === asks.length ? 'Clear all' : 'Check all'}
            </Button>
            <Button size="sm" variant="outline" onClick={copyAll}>
              <Copy className="h-4 w-4 mr-1" /> Copy all
            </Button>
            <Button size="sm" variant="outline" onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-1" /> Print
            </Button>
            <Button size="sm" onClick={downloadChecklist}>
              <Download className="h-4 w-4 mr-1" /> Download checklist PDF
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ol className="space-y-2">
          {asks.map((ask, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <Checkbox
                id={`ask-${i}`}
                checked={!!checked[i]}
                onCheckedChange={() => toggle(i)}
                className="mt-1 shrink-0"
              />
              <span className="font-mono text-xs text-muted-foreground pt-1 shrink-0">{i + 1}.</span>
              <label
                htmlFor={`ask-${i}`}
                className={`flex-1 cursor-pointer ${checked[i] ? 'line-through text-muted-foreground' : ''}`}
              >
                {ask}
              </label>
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