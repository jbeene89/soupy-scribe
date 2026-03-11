import type { CurabilityStatus } from '@/lib/preAppealTypes';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { CheckCircle, AlertTriangle, XCircle, ArrowRight, FileQuestion } from 'lucide-react';

const curabilityConfig: Record<CurabilityStatus, { label: string; className: string; icon: React.ElementType }> = {
  'curable-with-records': {
    label: 'Curable with Targeted Records',
    className: 'border-consensus/40 text-consensus bg-consensus/10',
    icon: CheckCircle,
  },
  'curable-with-coding': {
    label: 'Curable with Coding Clarification',
    className: 'border-consensus/40 text-consensus bg-consensus/10',
    icon: CheckCircle,
  },
  'partial-resolution': {
    label: 'Potential Partial Resolution',
    className: 'border-disagreement/40 text-disagreement bg-disagreement/10',
    icon: AlertTriangle,
  },
  'structurally-weak': {
    label: 'Structurally Weak',
    className: 'border-violation/40 text-violation bg-violation/10',
    icon: XCircle,
  },
  'formal-appeal-appropriate': {
    label: 'Formal Appeal More Appropriate',
    className: 'border-info-blue/40 text-info-blue bg-info-blue/10',
    icon: ArrowRight,
  },
  'not-likely-supportable': {
    label: 'Not Likely Supportable',
    className: 'border-violation/40 text-violation bg-violation/10',
    icon: XCircle,
  },
};

interface CurabilityBadgeProps {
  status: CurabilityStatus;
  size?: 'sm' | 'lg';
}

export function CurabilityBadge({ status, size = 'sm' }: CurabilityBadgeProps) {
  const config = curabilityConfig[status];
  const Icon = config.icon;

  if (size === 'lg') {
    return (
      <div className={cn('inline-flex items-center gap-2 rounded-lg border px-4 py-2 font-semibold text-sm', config.className)}>
        <Icon className="h-4 w-4" />
        {config.label}
      </div>
    );
  }

  return (
    <Badge variant="outline" className={cn('gap-1', config.className)}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}
