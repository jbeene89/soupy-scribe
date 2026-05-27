import type { CapacityEvent } from './capacityTypes';
import { computeCapacity } from './capacityTypes';

function mk(
  partial: { unit: string; shift: string; day: string; staffed: number; occupied: number; nurses: number; target: number; daysAgo: number; notes?: string }
): CapacityEvent {
  const c = computeCapacity({
    unit: partial.unit,
    shift: partial.shift,
    day_of_week: partial.day,
    staffed_beds: partial.staffed,
    occupied_beds: partial.occupied,
    nurses_on_shift: partial.nurses,
    target_ratio: partial.target,
  });
  return {
    id: crypto.randomUUID(),
    unit: partial.unit,
    shift: partial.shift,
    day_of_week: partial.day,
    staffed_beds: partial.staffed,
    occupied_beds: partial.occupied,
    nurses_on_shift: partial.nurses,
    target_ratio: partial.target,
    actual_ratio: c.actual_ratio,
    classification: c.classification,
    estimated_impact: c.estimated_impact,
    impact_direction: c.impact_direction,
    notes: partial.notes,
    created_at: new Date(Date.now() - partial.daysAgo * 86400000).toISOString(),
  };
}

export const mockCapacityEvents: CapacityEvent[] = [
  mk({ unit: 'Med-Surg 4W', shift: 'Night', day: 'Tue', staffed: 24, occupied: 22, nurses: 3, target: 5, daysAgo: 1, notes: 'Two callouts, no float available.' }),
  mk({ unit: 'ICU 6N', shift: 'Day', day: 'Mon', staffed: 16, occupied: 8, nurses: 6, target: 2, daysAgo: 2, notes: 'Census dropped after weekend discharges.' }),
  mk({ unit: 'PACU', shift: 'Evening', day: 'Wed', staffed: 10, occupied: 9, nurses: 2, target: 2, daysAgo: 3 }),
  mk({ unit: 'Telemetry 5E', shift: 'Night', day: 'Fri', staffed: 28, occupied: 26, nurses: 4, target: 4, daysAgo: 4, notes: 'Edge of tolerance — borderline.' }),
  mk({ unit: 'ED', shift: 'Evening', day: 'Sat', staffed: 32, occupied: 30, nurses: 5, target: 4, daysAgo: 5, notes: 'Holiday weekend surge.' }),
  mk({ unit: 'Med-Surg 4W', shift: 'Day', day: 'Sun', staffed: 24, occupied: 11, nurses: 5, target: 5, daysAgo: 6, notes: 'Quiet Sunday — 13 empty beds.' }),
  mk({ unit: 'L&D', shift: 'Night', day: 'Thu', staffed: 12, occupied: 4, nurses: 6, target: 2, daysAgo: 7 }),
  mk({ unit: 'ICU 6N', shift: 'Night', day: 'Wed', staffed: 16, occupied: 14, nurses: 5, target: 2, daysAgo: 8, notes: 'High acuity night, one nurse short.' }),
  mk({ unit: 'Oncology', shift: 'Day', day: 'Tue', staffed: 20, occupied: 19, nurses: 5, target: 4, daysAgo: 9 }),
  mk({ unit: 'Step-Down', shift: 'Day', day: 'Mon', staffed: 18, occupied: 8, nurses: 6, target: 3, daysAgo: 10, notes: 'Post-holiday low census.' }),
];