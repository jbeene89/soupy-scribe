import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { X } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  onClose: () => void;
}

export function ORReadinessForm({ onClose }: Props) {
  const [formData, setFormData] = useState({
    room_id: '', event_type: 'other', delay_minutes: 0, replacement_source: '',
    patient_wait_status: 'stable', classification: 'isolated', vendor_rep: '',
    service_line: '', shift: 'AM', day_of_week: '', safety_flag: false, notes: '',
  });

  const handleSubmit = () => {
    toast.success('OR readiness event logged');
    onClose();
  };

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Log OR Readiness Event</p>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}><X className="h-4 w-4" /></Button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Event Type</Label>
          <Select value={formData.event_type} onValueChange={v => setFormData(p => ({ ...p, event_type: v }))}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="dropped_implant">Dropped Implant</SelectItem>
              <SelectItem value="wrong_size">Wrong Size</SelectItem>
              <SelectItem value="sterilization_lapse">Sterilization Lapse</SelectItem>
              <SelectItem value="contaminated">Contaminated</SelectItem>
              <SelectItem value="tray_not_ready">Tray Not Ready</SelectItem>
              <SelectItem value="missing_instrument">Missing Instrument</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Room</Label>
          <Input className="h-8 text-xs" placeholder="OR-1" value={formData.room_id} onChange={e => setFormData(p => ({ ...p, room_id: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Delay (min)</Label>
          <Input className="h-8 text-xs" type="number" value={formData.delay_minutes} onChange={e => setFormData(p => ({ ...p, delay_minutes: parseInt(e.target.value) || 0 }))} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Classification</Label>
          <Select value={formData.classification} onValueChange={v => setFormData(p => ({ ...p, classification: v }))}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="isolated">Isolated</SelectItem>
              <SelectItem value="workflow_issue">Workflow Issue</SelectItem>
              <SelectItem value="repeat_pattern">Repeat Pattern</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Patient Status</Label>
          <Select value={formData.patient_wait_status} onValueChange={v => setFormData(p => ({ ...p, patient_wait_status: v }))}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="stable">Stable</SelectItem>
              <SelectItem value="under_anesthesia">Under Anesthesia</SelectItem>
              <SelectItem value="awake_waiting">Awake Waiting</SelectItem>
              <SelectItem value="repositioned">Repositioned</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Service Line</Label>
          <Input className="h-8 text-xs" placeholder="Orthopedics" value={formData.service_line} onChange={e => setFormData(p => ({ ...p, service_line: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Shift</Label>
          <Select value={formData.shift} onValueChange={v => setFormData(p => ({ ...p, shift: v }))}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="AM">AM</SelectItem>
              <SelectItem value="PM">PM</SelectItem>
              <SelectItem value="Night">Night</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Day of Week</Label>
          <Select value={formData.day_of_week} onValueChange={v => setFormData(p => ({ ...p, day_of_week: v }))}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(d => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Vendor Rep</Label>
          <Input className="h-8 text-xs" placeholder="Optional" value={formData.vendor_rep} onChange={e => setFormData(p => ({ ...p, vendor_rep: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Replacement Source</Label>
          <Input className="h-8 text-xs" placeholder="Where was replacement sourced?" value={formData.replacement_source} onChange={e => setFormData(p => ({ ...p, replacement_source: e.target.value }))} />
        </div>
        <div className="space-y-1 col-span-2 flex items-center gap-3 pt-4">
          <Switch
            checked={formData.safety_flag}
            onCheckedChange={v => setFormData(p => ({ ...p, safety_flag: v }))}
          />
          <Label className="text-xs">Flag as Patient Safety Concern</Label>
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Notes</Label>
        <Textarea className="text-xs min-h-[60px]" placeholder="Describe the event..." value={formData.notes} onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))} />
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" className="text-xs" onClick={onClose}>Cancel</Button>
        <Button size="sm" className="text-xs" onClick={handleSubmit}>Log Event</Button>
      </div>
    </div>
  );
}
