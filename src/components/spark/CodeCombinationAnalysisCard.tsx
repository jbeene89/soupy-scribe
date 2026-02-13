import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { CodeCombinationAnalysis } from '@/lib/types';
import { AlertTriangle, CheckCircle, FileText } from 'lucide-react';

interface CodeCombinationAnalysisCardProps {
  analysis: CodeCombinationAnalysis;
}

export function CodeCombinationAnalysisCard({ analysis }: CodeCombinationAnalysisCardProps) {
  return (
    <Card className="border-2 border-disagreement bg-disagreement/5">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-7 w-7 text-disagreement" />
            <div>
              <CardTitle className="text-xl">Code Combination Analysis</CardTitle>
              <CardDescription className="mt-1">
                Why this set of codes is being flagged
              </CardDescription>
            </div>
          </div>
          <div className="flex gap-1">
            {analysis.codes.map((code) => (
              <Badge key={code} variant="outline" className="font-mono">
                {code}
              </Badge>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-3 bg-muted/50 rounded-md">
          <div className="text-xs font-medium text-muted-foreground mb-1">FLAG REASON</div>
          <p className="text-sm font-medium">{analysis.flagReason}</p>
        </div>

        <Separator />

        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-consensus" />
              <h4 className="font-semibold text-sm">Common Legitimate Explanations</h4>
            </div>
            <ul className="space-y-2">
              {analysis.legitimateExplanations.map((explanation, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm bg-consensus/10 p-2.5 rounded border border-consensus/20">
                  <span className="text-consensus font-bold mt-0.5 shrink-0">{idx + 1}.</span>
                  <span className="flex-1">{explanation}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <h4 className="font-semibold text-sm">Common Noncompliant Explanations</h4>
            </div>
            <ul className="space-y-2">
              {analysis.noncompliantExplanations.map((explanation, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm bg-destructive/10 p-2.5 rounded border border-destructive/20">
                  <span className="text-destructive font-bold mt-0.5 shrink-0">{idx + 1}.</span>
                  <span className="flex-1">{explanation}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-info-blue" />
            <h4 className="font-semibold text-sm">Required Documentation to Clear This Flag</h4>
          </div>
          <div className="grid gap-2">
            {analysis.requiredDocumentation.map((doc, idx) => (
              <div key={idx} className="flex items-start gap-2 text-sm p-2.5 bg-info-blue/10 rounded border border-info-blue/20">
                <Badge variant="outline" className="shrink-0 text-xs">
                  {idx + 1}
                </Badge>
                <span className="flex-1">{doc}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
