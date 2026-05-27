import { supabase } from '@/integrations/supabase/client';
import type { WriteoffEvent, WriteoffInput, WriteoffType } from './writeoffTypes';
import { classifyWriteoff } from './writeoffTypes';

export async function fetchWriteoffEvents(): Promise<WriteoffEvent[]> {
  const { data, error } = await supabase
    .from('writeoff_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data || []) as WriteoffEvent[];
}

export async function createWriteoffEvent(input: WriteoffInput, opts: { org_id?: string; case_id?: string } = {}): Promise<WriteoffEvent> {
  const computed = classifyWriteoff(input);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('Not authenticated');

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
    throw new Error('You must belong to an organization to log write-off events.');
  }

  const payload = {
    org_id: org_id ?? null,
    case_id: case_id ?? null,
    payer: input.payer,
    patient_account: input.patient_account ?? null,
    writeoff_type: input.writeoff_type,
    amount: input.amount,
    reason_code: input.reason_code ?? null,
    policy_basis: input.policy_basis ?? null,
    appeal_viable: input.appeal_viable ?? false,
    classification: computed.classification,
    recoverable_estimate: computed.recoverable_estimate,
    notes: input.notes ?? null,
  };

  const { data, error } = await supabase
    .from('writeoff_events')
    .insert(payload)
    .select('*')
    .single();
  if (error) throw error;
  return data as WriteoffEvent;
}

export interface WriteoffRollup {
  totalEvents: number;
  totalAmount: number;
  totalRecoverable: number;
  leakCount: number;
  reviewCount: number;
  validCount: number;
  byPayer: { payer: string; count: number; amount: number; recoverable: number }[];
  byType: { type: WriteoffType; count: number; amount: number; recoverable: number }[];
}

export function rollupWriteoffs(events: WriteoffEvent[]): WriteoffRollup {
  const totalAmount = events.reduce((s, e) => s + Number(e.amount || 0), 0);
  const totalRecoverable = events.reduce((s, e) => s + Number(e.recoverable_estimate || 0), 0);

  const payerMap = new Map<string, { count: number; amount: number; recoverable: number }>();
  const typeMap = new Map<WriteoffType, { count: number; amount: number; recoverable: number }>();

  for (const e of events) {
    const p = payerMap.get(e.payer) || { count: 0, amount: 0, recoverable: 0 };
    p.count++; p.amount += Number(e.amount); p.recoverable += Number(e.recoverable_estimate);
    payerMap.set(e.payer, p);

    const t = typeMap.get(e.writeoff_type) || { count: 0, amount: 0, recoverable: 0 };
    t.count++; t.amount += Number(e.amount); t.recoverable += Number(e.recoverable_estimate);
    typeMap.set(e.writeoff_type, t);
  }

  return {
    totalEvents: events.length,
    totalAmount,
    totalRecoverable,
    leakCount: events.filter(e => e.classification === 'leak').length,
    reviewCount: events.filter(e => e.classification === 'review').length,
    validCount: events.filter(e => e.classification === 'valid').length,
    byPayer: Array.from(payerMap.entries())
      .map(([payer, v]) => ({ payer, ...v }))
      .sort((a, b) => b.recoverable - a.recoverable),
    byType: Array.from(typeMap.entries())
      .map(([type, v]) => ({ type, ...v }))
      .sort((a, b) => b.recoverable - a.recoverable),
  };
}