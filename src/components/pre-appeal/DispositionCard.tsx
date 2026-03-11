import type { RecommendedDisposition } from '@/lib/preAppealTypes';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Send, FolderSearch, RefreshCcw, Gavel, Ban, ShieldAlert } from 'lucide-react';

const dispositionConfig: Record<RecommendedDisposition, { label: string; description: string; icon: React.ElementType; color: string; bg: string }> = {
  'submit-pre-appeal': {
    label: 'Submit for Pre-Appeal Resolution',
    description: 'This case appears suitable for the accelerated resolution path. Prepare and submit a focused reconsideration packet.',
    icon: Send, color: 'text-consensus', bg: 'bg-consensus/10 border-consensus/30',
  },
  'gather-more-records': {
    label: 'Gather More Records First',
    description: 'Key supporting documentation is missing. Collect the identified records before submitting for resolution.',
    icon: FolderSearch, color: 'text-disagreement', bg: 'bg-disagreement/10 border-disagreement/30',
  },
  'correct-and-resubmit': {
    label: 'Correct and Resubmit',
    description: 'A coding correction or documentation clarification should be made before resubmission.',
    icon: RefreshCcw, color: 'text-accent', bg: 'bg-accent/10 border-accent/30',
  },
  'pursue-formal-appeal': {
    label: 'Pursue Formal Appeal Instead',
    description: 'This case involves substantive clinical disagreement that is better suited for the formal appeal process.',
    icon: Gavel, color: 'text-info-blue', bg: 'bg-info-blue/10 border-info-blue/30',
  },
  'do-not-pursue': {
    label: 'Do Not Pursue Further',
    description: 'This denial does not appear supportable. Resources are better directed toward prevention and process improvement.',
    icon: Ban, color: 'text-violation', bg: 'bg-violation/10 border-violation/30',
  },
  'escalate-internally': {
    label: 'Escalate Internally for Review',
    description: 'This case should be reviewed by compliance or coding leadership before determining next steps.',
    icon: ShieldAlert, color: 'text-disagreement', bg: 'bg-disagreement/10 border-disagreement/30',
  },
};

interface DispositionCardProps {
  disposition: RecommendedDisposition;
}

export function DispositionCard({ disposition }: DispositionCardProps) {
  const config = dispositionConfig[disposition];
  const Icon = config.icon;

  return (
    <Card className={cn('border', config.bg)}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn('rounded-full p-2 bg-background border shadow-sm')}>
            <Icon className={cn('h-5 w-5', config.color)} />
          </div>
          <div className="flex-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Recommended Disposition</p>
            <p className={cn('text-sm font-semibold mt-0.5', config.color)}>{config.label}</p>
            <p className="text-xs text-muted-foreground mt-1">{config.description}</p>
            <p className="text-[10px] text-muted-foreground mt-2 italic">This is decision support, not final legal advice. Standard appeal rights are preserved.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
