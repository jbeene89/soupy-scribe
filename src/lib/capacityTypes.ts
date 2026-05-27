export interface CapacityEvent {
  id: string;
  org_id?: string;
  case_id?: string;
  unit: string;
  shift?: string;
  day_of_week?: string;
  event_date?: string;
  staffed_beds: number;
  occupied_beds: number;
  nurses_on_shift: number;
  target_ratio: number;
  actual_ratio: number;
  classification: 'over_ratio' | 'under_ratio' | 'balanced';
  estimated_impact: number;
  impact_direction: 'loss_overstaffed' | 'risk_understaffed' | 'neutral';
  notes?: string;
  created_at: string;
}

// Loaded nurse cost per hour (wages + benefits, US RN average)
export const NURSE_HOURLY_LOADED = 75;
// Average nightly revenue per occupied bed (acute care, US average proxy)
export const REV_PER_BED_PER_DAY = 2200;
// Default shift length (hours) used when computing idle-cost
export const SHIFT_HOURS = 12;
// Risk multiplier when over-ratio: overtime + sentinel/LWBS exposure
export const OVER_RATIO_RISK_PER_EXCESS_PATIENT_PER_SHIFT = 850;

export interface CapacityInput {
  unit: string;
  shift?: string;
  day_of_week?: string;
  staffed_beds: number;
  occupied_beds: number;
  nurses_on_shift: number;
  target_ratio: number;
  notes?: string;
}

export interface CapacityComputed {
  actual_ratio: number;
  utilization_pct: number;
  classification: CapacityEvent['classification'];
  impact_direction: CapacityEvent['impact_direction'];
  estimated_impact: number;
  rationale: string;
}

export function computeCapacity(input: CapacityInput): CapacityComputed {
  const { staffed_beds, occupied_beds, nurses_on_shift, target_ratio } = input;
  const utilization_pct = staffed_beds > 0 ? (occupied_beds / staffed_beds) * 100 : 0;
  const actual_ratio = nurses_on_shift > 0 ? occupied_beds / nurses_on_shift : 0;

  // Tolerance: within 15% of target = balanced
  const upperBand = target_ratio * 1.15;
  const lowerBand = target_ratio * 0.7;

  let classification: CapacityEvent['classification'] = 'balanced';
  let impact_direction: CapacityEvent['impact_direction'] = 'neutral';
  let estimated_impact = 0;
  let rationale = `Within tolerance of target ${target_ratio}:1.`;

  if (actual_ratio > upperBand) {
    classification = 'over_ratio';
    impact_direction = 'risk_understaffed';
    // Excess patients above what target staffing supports
    const supported = nurses_on_shift * target_ratio;
    const excess = Math.max(0, occupied_beds - supported);
    estimated_impact = Math.round(excess * OVER_RATIO_RISK_PER_EXCESS_PATIENT_PER_SHIFT);
    rationale = `${excess.toFixed(1)} patient(s) above safe staffing — overtime, LWBS, and sentinel-event exposure.`;
  } else if (actual_ratio < lowerBand && nurses_on_shift > 0) {
    classification = 'under_ratio';
    impact_direction = 'loss_overstaffed';
    // Surplus nurses vs. what census needs
    const needed = target_ratio > 0 ? occupied_beds / target_ratio : 0;
    const surplus = Math.max(0, nurses_on_shift - needed);
    const idleCost = surplus * NURSE_HOURLY_LOADED * SHIFT_HOURS;
    // Empty-bed opportunity cost (partial — half of full daily rev)
    const emptyBeds = Math.max(0, staffed_beds - occupied_beds);
    const emptyOpportunity = emptyBeds * (REV_PER_BED_PER_DAY * 0.5);
    estimated_impact = Math.round(idleCost + emptyOpportunity);
    rationale = `${surplus.toFixed(1)} surplus nurse(s) idle + ${emptyBeds} empty bed(s) — wasted labor and opportunity cost.`;
  }

  return {
    actual_ratio: Number(actual_ratio.toFixed(2)),
    utilization_pct: Number(utilization_pct.toFixed(1)),
    classification,
    impact_direction,
    estimated_impact,
    rationale,
  };
}

export const DEFAULT_TARGET_RATIOS: Record<string, number> = {
  ICU: 2,
  'Step-Down': 3,
  PACU: 2,
  'Med-Surg': 5,
  Telemetry: 4,
  ED: 4,
  'L&D': 2,
  Oncology: 4,
  Pediatrics: 4,
};