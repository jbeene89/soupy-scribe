import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BUCKET_COLORS, type FindingCard as FindingCardType } from '@/lib/patientSelfHelpTypes';

export function FindingCard({ card }: { card: FindingCardType }) {
  const colors = BUCKET_COLORS[card.bucket] ?? '';
  return (
    <Card className="border-l-4" style={{ borderLeftColor: 'currentColor' }}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <CardTitle className="text-base leading-snug">{card.title}</CardTitle>
          <Badge variant="outline" className={colors}>{card.bucket}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {card.whyItMatters && (
          <div>
            <div className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-1">Why it matters</div>
            <p>{card.whyItMatters}</p>
          </div>
        )}
        {card.whatRecordShows && (
          <div>
            <div className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-1">What the record shows</div>
            <p className="whitespace-pre-wrap">{card.whatRecordShows}</p>
          </div>
        )}
        {card.whatItDoesNotProve && (
          <div className="rounded-md bg-muted/50 px-3 py-2 border">
            <div className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-1">What it does NOT prove</div>
            <p>{card.whatItDoesNotProve}</p>
          </div>
        )}
        {card.askNext && (
          <div className="rounded-md bg-primary/5 px-3 py-2 border border-primary/20">
            <div className="font-semibold text-xs uppercase tracking-wide text-primary mb-1">Ask next</div>
            <p>{card.askNext}</p>
          </div>
        )}
        {card.sourceFile && (
          <p className="text-xs text-muted-foreground">
            Source: {card.sourceFile}{card.sourcePages?.length ? ` · pages ${card.sourcePages.join(', ')}` : ''}
          </p>
        )}
      </CardContent>
    </Card>
  );
}