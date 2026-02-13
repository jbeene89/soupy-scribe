import { useState } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getCPTInfo } from '@/lib/cptCodeInfo';
import { Badge } from '@/components/ui/badge';

interface CPTCodeBadgeProps {
  code: string;
}

export function CPTCodeBadge({ code }: CPTCodeBadgeProps) {
  const info = getCPTInfo(code);

  if (!info) {
    return <Badge variant="outline" className="font-mono text-xs">{code}</Badge>;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className="font-mono text-xs cursor-help border-accent/40 hover:border-accent transition-colors">
          {code}
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-sm p-4 space-y-2">
        <div>
          <p className="font-semibold text-sm">{info.code}: {info.shortDescriptor}</p>
          <p className="text-xs text-muted-foreground mt-1">{info.whyAudited}</p>
        </div>
        <div>
          <p className="text-xs font-medium mb-1">Common failure modes:</p>
          <ul className="text-xs text-muted-foreground space-y-0.5">
            {info.commonFailures.map((f, i) => (
              <li key={i} className="flex gap-1.5">
                <span className="text-destructive mt-0.5">•</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-medium mb-1">Required documentation:</p>
          <ul className="text-xs text-muted-foreground space-y-0.5">
            {info.requiredDocumentation.map((d, i) => (
              <li key={i} className="flex gap-1.5">
                <span className="text-consensus mt-0.5">•</span>
                <span>{d}</span>
              </li>
            ))}
          </ul>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
