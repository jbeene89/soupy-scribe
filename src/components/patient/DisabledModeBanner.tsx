import { AlertTriangle } from 'lucide-react';

export function DisabledModeBanner({ reason }: { reason: string }) {
  if (!reason) return null;
  return (
    <div className="rounded-md border border-yellow-500/40 bg-yellow-500/5 px-4 py-3 flex items-start gap-3 text-sm">
      <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
      <div>
        <div className="font-semibold mb-0.5">Some analysis was disabled</div>
        <p className="text-muted-foreground whitespace-pre-wrap">{reason}</p>
      </div>
    </div>
  );
}