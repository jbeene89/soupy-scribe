import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Settings, ArrowUp, ArrowDown, RotateCcw } from 'lucide-react';
import type { SOUPYConfig, SOUPYRole, AIModel } from '@/lib/types';
import { ROLE_META } from '@/lib/types';
import { defaultSOUPYConfig } from '@/lib/mockData';
import { toast } from 'sonner';

const AI_MODELS: AIModel[] = ['GPT-4o', 'GPT-4o Mini', 'Claude 3.5', 'Gemini Pro'];

interface SOUPYConfigDialogProps {
  config: SOUPYConfig;
  onSave: (config: SOUPYConfig) => void;
}

export function SOUPYConfigDialog({ config, onSave }: SOUPYConfigDialogProps) {
  const [localConfig, setLocalConfig] = useState(config);
  const [open, setOpen] = useState(false);

  const moveRole = (index: number, direction: -1 | 1) => {
    const newOrder = [...localConfig.executionOrder];
    const target = index + direction;
    if (target < 0 || target >= newOrder.length) return;
    [newOrder[index], newOrder[target]] = [newOrder[target], newOrder[index]];
    setLocalConfig({ ...localConfig, executionOrder: newOrder });
  };

  const handleSave = () => {
    onSave(localConfig);
    setOpen(false);
    toast.success('SOUPY configuration saved');
  };

  const handleReset = () => {
    setLocalConfig(defaultSOUPYConfig);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
          <Settings className="h-3.5 w-3.5" />
          SOUPY Settings
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">SOUPY Protocol Configuration</DialogTitle>
          <p className="text-sm text-muted-foreground">Assign AI models to each role and set execution order.</p>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Role-to-Model Assignments</p>
            <div className="space-y-3">
              {(Object.keys(ROLE_META) as SOUPYRole[]).map(role => (
                <div key={role} className="flex items-center gap-3">
                  <span className="text-sm font-medium w-28">{ROLE_META[role].label}</span>
                  <Select
                    value={localConfig.roles[role]}
                    onValueChange={(value: AIModel) =>
                      setLocalConfig({ ...localConfig, roles: { ...localConfig.roles, [role]: value } })
                    }
                  >
                    <SelectTrigger className="flex-1 h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AI_MODELS.map(model => (
                        <SelectItem key={model} value={model}>{model}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Execution Order</p>
            <div className="space-y-2">
              {localConfig.executionOrder.map((role, i) => (
                <div key={role} className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
                  <span className="text-xs font-mono text-muted-foreground w-5">{i + 1}.</span>
                  <span className="text-sm font-medium flex-1">{ROLE_META[role].label}</span>
                  <Button
                    variant="ghost" size="icon" className="h-6 w-6"
                    onClick={() => moveRole(i, -1)} disabled={i === 0}
                  >
                    <ArrowUp className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost" size="icon" className="h-6 w-6"
                    onClick={() => moveRole(i, 1)} disabled={i === localConfig.executionOrder.length - 1}
                  >
                    <ArrowDown className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-between mt-4">
          <Button variant="ghost" size="sm" onClick={handleReset} className="text-xs gap-1.5">
            <RotateCcw className="h-3 w-3" />
            Reset to Defaults
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSave}>Save Configuration</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
