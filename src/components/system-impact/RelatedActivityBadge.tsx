import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Network } from 'lucide-react';
import { useSystemImpact } from '@/hooks/useSystemImpact';
import { formatUSD, type ImpactCategory } from '@/lib/systemImpactService';
import { cn } from '@/lib/utils';

interface Props {
  patientId?: string;
  physicianName?: string;
  excludeCategory?: ImpactCategory;
  className?: string;
}

/**
 * Inline badge that surfaces "this patient/physician also appears in N other modules".
 * Click → opens the unified timeline scoped to that ID.
 */
export function RelatedActivityBadge({
  patientId,
  physicianName,
  excludeCategory,
  className,
}: Props) {
  const navigate = useNavigate();
  const { relatedCounts } = useSystemImpact();

  if (!patientId && !physicianName) return null;

  const { count, total_loss, categories } = relatedCounts(
    { patient_id: patientId, physician_name: physicianName },
    excludeCategory
  );

  if (count === 0) return null;

  const params = new URLSearchParams();
  if (patientId) params.set('patient', patientId);
  if (physicianName) params.set('physician', physicianName);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={(ev) => {
            ev.stopPropagation();
            navigate(`/app/system-impact?${params.toString()}`);
          }}
          className={cn(
            'inline-flex items-center gap-1 rounded-full border bg-muted/40 hover:bg-muted px-2 py-0.5 text-[10px] font-medium transition-colors',
            className
          )}
        >
          <Network className="h-2.5 w-2.5" />
          {count} related · {formatUSD(total_loss)}
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <div className="text-xs">
          <div className="font-semibold">Cross-module activity</div>
          <div className="text-muted-foreground mt-0.5">
            {count} event{count > 1 ? 's' : ''} across {categories.length} module
            {categories.length > 1 ? 's' : ''}
          </div>
          <div className="mt-1">Click to open timeline</div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}