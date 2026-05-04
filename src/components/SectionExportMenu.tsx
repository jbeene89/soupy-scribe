import { useState } from 'react';
import { Download, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';

export interface ExportSection {
  id: string;
  label: string;
  description?: string;
}

interface SectionExportMenuProps {
  sections: ExportSection[];
  /** Called with the list of selected section ids. If all are selected, full export. */
  onExport: (selectedIds: string[]) => void;
  buttonLabel?: string;
  disabled?: boolean;
  size?: 'sm' | 'default';
}

/**
 * Dropdown that lets the user pick which PDF sections to include.
 * Defaults to all sections selected (= full report). Caller chooses how
 * to use the resulting selectedIds — typically passed as `sections` to
 * an exporter that filters its blocks accordingly.
 */
export function SectionExportMenu({
  sections,
  onExport,
  buttonLabel = 'Export PDF',
  disabled,
  size = 'sm',
}: SectionExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(() => sections.map(s => s.id));

  const toggle = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const allOn = selected.length === sections.length;
  const noneOn = selected.length === 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size={size} className="gap-2 shrink-0" disabled={disabled}>
          <Download className="h-4 w-4" />
          {buttonLabel}
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold">Sections to include</p>
          <button
            type="button"
            className="text-xs text-primary hover:underline"
            onClick={() => setSelected(allOn ? [] : sections.map(s => s.id))}
          >
            {allOn ? 'Clear all' : 'Select all'}
          </button>
        </div>
        <Separator className="mb-2" />
        <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
          {sections.map(s => (
            <label
              key={s.id}
              className="flex items-start gap-2 cursor-pointer text-sm py-1"
            >
              <Checkbox
                checked={selected.includes(s.id)}
                onCheckedChange={() => toggle(s.id)}
                className="mt-0.5"
              />
              <span className="flex-1">
                <span className="block font-medium leading-tight">{s.label}</span>
                {s.description && (
                  <span className="block text-[11px] text-muted-foreground leading-tight">
                    {s.description}
                  </span>
                )}
              </span>
            </label>
          ))}
        </div>
        <Separator className="my-2" />
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-muted-foreground">
            {selected.length} of {sections.length} selected
          </span>
          <Button
            size="sm"
            disabled={noneOn}
            onClick={() => {
              onExport(selected);
              setOpen(false);
            }}
          >
            Export
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}