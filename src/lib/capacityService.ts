import { supabase } from '@/integrations/supabase/client';
import type { CapacityEvent, CapacityInput } from './capacityTypes';
import { computeCapacity } from './capacityTypes';

export async function fetchCapacityEvents(): Promise<CapacityEvent[]> {
  const { data, error } = await supabase
    .from('capacity_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data || []) as CapacityEvent[];
}

export async function createCapacityEvent(input: CapacityInput, opts: { org_id?: string; case_id?: string } = {}): Promise<CapacityEvent> {
  const computed = computeCapacity(input);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('Not authenticated');

  // Need either org_id or case_id per RLS. If neither provided, look up first org membership.
  let org_id = opts.org_id;
  const case_id = opts.case_id;
  if (!org_id && !case_id) {
    const { data: membership } = await supabase
      .from('org_members')
      .select('org_id')
      .eq('user_id', userData.user.id)
      .limit(1)
      .maybeSingle();
    org_id = membership?.org_id;
  }
  if (!org_id && !case_id) {
    throw new Error('You must belong to an organization to log capacity events.');
  }

  const payload = {
    org_id: org_id ?? null,
    case_id: case_id ?? null,
    unit: input.unit,
    shift: input.shift ?? null,
    day_of_week: input.day_of_week ?? null,
    staffed_beds: input.staffed_beds,
    occupied_beds: input.occupied_beds,
    nurses_on_shift: input.nurses_on_shift,
    target_ratio: input.target_ratio,
    actual_ratio: computed.actual_ratio,
    classification: computed.classification,
    estimated_impact: computed.estimated_impact,
    impact_direction: computed.impact_direction,
    notes: input.notes ?? null,
  };

  const { data, error } = await supabase
    .from('capacity_events')
    .insert(payload)
    .select('*')
    .single();
  if (error) throw error;
  return data as CapacityEvent;
}

export interface CapacityRollup {
  totalEvents: number;
  overRatio: number;
  underRatio: number;
  balanced: number;
  totalRiskCost: number;
  totalIdleLoss: number;
  totalImpact: number;
  byUnit: { unit: string; events: number; over: number; under: number; impact: number; avgUtil: number }[];
  byShift: { shift: string; events: number; over: number; under: number; impact: number }[];
}

export function rollupCapacity(events: CapacityEvent[]): CapacityRollup {
  const overRatio = events.filter(e => e.classification === 'over_ratio').length;
  const underRatio = events.filter(e => e.classification === 'under_ratio').length;
  const balanced = events.filter(e => e.classification === 'balanced').length;
  const totalRiskCost = events.filter(e => e.impact_direction === 'risk_understaffed').reduce((s, e) => s + Number(e.estimated_impact || 0), 0);
  const totalIdleLoss = events.filter(e => e.impact_direction === 'loss_overstaffed').reduce((s, e) => s + Number(e.estimated_impact || 0), 0);

  const unitMap = new Map<string, { events: number; over: number; under: number; impact: number; utilSum: number }>();
  for (const e of events) {
    const cur = unitMap.get(e.unit) || { events: 0, over: 0, under: 0, impact: 0, utilSum: 0 };
    cur.events += 1;
    if (e.classification === 'over_ratio') cur.over += 1;
    if (e.classification === 'under_ratio') cur.under += 1;
    cur.impact += Number(e.estimated_impact || 0);
    const util = e.staffed_beds > 0 ? (e.occupied_beds / e.staffed_beds) * 100 : 0;
    cur.utilSum += util;
    unitMap.set(e.unit, cur);
  }
  const byUnit = Array.from(unitMap.entries())
    .map(([unit, v]) => ({ unit, events: v.events, over: v.over, under: v.under, impact: v.impact, avgUtil: v.events ? v.utilSum / v.events : 0 }))
    .sort((a, b) => b.impact - a.impact);

  const shiftMap = new Map<string, { events: number; over: number; under: number; impact: number }>();
  for (const e of events) {
    const k = e.shift || 'unspecified';
    const cur = shiftMap.get(k) || { events: 0, over: 0, under: 0, impact: 0 };
    cur.events += 1;
    if (e.classification === 'over_ratio') cur.over += 1;
    if (e.classification === 'under_ratio') cur.under += 1;
    cur.impact += Number(e.estimated_impact || 0);
    shiftMap.set(k, cur);
  }
  const byShift = Array.from(shiftMap.entries())
    .map(([shift, v]) => ({ shift, ...v }))
    .sort((a, b) => b.impact - a.impact);

  return {
    totalEvents: events.length,
    overRatio,
    underRatio,
    balanced,
    totalRiskCost,
    totalIdleLoss,
    totalImpact: totalRiskCost + totalIdleLoss,
    byUnit,
    byShift,
  };
}