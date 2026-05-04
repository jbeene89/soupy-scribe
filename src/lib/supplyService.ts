import { supabase } from '@/integrations/supabase/client';
import type {
  SupplyCatalogItem,
  PreferenceCard,
  SupplyWasteEvent,
  SupplyOpenedItem,
  SupplyUsedItem,
} from './supplyTypes';
import { computeWaste } from './supplyTypes';

// ─── Catalog ──────────────────────────────────

export async function listCatalog(): Promise<SupplyCatalogItem[]> {
  const { data, error } = await supabase
    .from('supply_catalog')
    .select('*')
    .order('category', { ascending: true })
    .order('description', { ascending: true });
  if (error) throw error;
  return (data || []) as SupplyCatalogItem[];
}

export async function upsertCatalogItems(
  rows: Array<Omit<SupplyCatalogItem, 'id' | 'created_at' | 'updated_at' | 'owner_id'>>,
): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const payload = rows.map((r) => ({ ...r, owner_id: user.id }));
  const { error, count } = await supabase
    .from('supply_catalog')
    .insert(payload, { count: 'exact' });
  if (error) throw error;
  return count || 0;
}

export async function deleteCatalogItem(id: string): Promise<void> {
  const { error } = await supabase.from('supply_catalog').delete().eq('id', id);
  if (error) throw error;
}

// ─── Preference cards ────────────────────────

export async function listPreferenceCards(): Promise<PreferenceCard[]> {
  const { data, error } = await supabase
    .from('preference_cards')
    .select('*')
    .order('surgeon_name', { ascending: true });
  if (error) throw error;
  return (data || []) as unknown as PreferenceCard[];
}

export async function createPreferenceCard(
  card: Omit<PreferenceCard, 'id' | 'owner_id' | 'created_at' | 'updated_at'>,
): Promise<PreferenceCard> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { data, error } = await supabase
    .from('preference_cards')
    .insert({ ...card, owner_id: user.id, items: card.items as any })
    .select()
    .single();
  if (error) throw error;
  return data as unknown as PreferenceCard;
}

export async function deletePreferenceCard(id: string): Promise<void> {
  const { error } = await supabase.from('preference_cards').delete().eq('id', id);
  if (error) throw error;
}

// ─── Waste events ────────────────────────────

export async function listWasteEvents(): Promise<SupplyWasteEvent[]> {
  const { data, error } = await supabase
    .from('supply_waste_events')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as unknown as SupplyWasteEvent[];
}

export async function logWasteEvent(args: {
  case_id?: string | null;
  surgeon_name?: string | null;
  procedure_label?: string | null;
  service_line?: string | null;
  room_id?: string | null;
  opened_items: SupplyOpenedItem[];
  used_items: SupplyUsedItem[];
  catalog: SupplyCatalogItem[];
  notes?: string | null;
}): Promise<SupplyWasteEvent> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { wasteCost, savings, suggestedSwap } = computeWaste(args.opened_items, args.used_items, args.catalog);
  const { data, error } = await supabase
    .from('supply_waste_events')
    .insert({
      owner_id: user.id,
      case_id: args.case_id ?? null,
      surgeon_name: args.surgeon_name ?? null,
      procedure_label: args.procedure_label ?? null,
      service_line: args.service_line ?? null,
      room_id: args.room_id ?? null,
      opened_items: args.opened_items as any,
      used_items: args.used_items as any,
      waste_cost: wasteCost,
      savings_opportunity: savings,
      suggested_swap: suggestedSwap,
      notes: args.notes ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as unknown as SupplyWasteEvent;
}

export async function deleteWasteEvent(id: string): Promise<void> {
  const { error } = await supabase.from('supply_waste_events').delete().eq('id', id);
  if (error) throw error;
}

// ─── CSV import helpers ─────────────────────

/**
 * Parse a CSV with header row. Expected columns:
 * sku,description,vendor,category,pack_size,unit_price,equivalent_sku,notes
 * Extra columns are ignored. Quoted fields with commas are supported.
 */
export function parseCatalogCsv(csv: string): Array<Omit<SupplyCatalogItem, 'id' | 'created_at' | 'updated_at' | 'owner_id'>> {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);
  const rows: Array<Omit<SupplyCatalogItem, 'id' | 'created_at' | 'updated_at' | 'owner_id'>> = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const sku = cols[idx('sku')]?.trim();
    const description = cols[idx('description')]?.trim();
    if (!sku || !description) continue;
    rows.push({
      sku,
      description,
      vendor: cols[idx('vendor')]?.trim() || null,
      category: cols[idx('category')]?.trim() || null,
      pack_size: parseInt(cols[idx('pack_size')] || '1', 10) || 1,
      unit_price: parseFloat(cols[idx('unit_price')] || '0') || 0,
      equivalent_sku: cols[idx('equivalent_sku')]?.trim() || null,
      notes: cols[idx('notes')]?.trim() || null,
    });
  }
  return rows;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      out.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

/**
 * Parse a preference-card CSV. Expected columns:
 * surgeon_name,procedure_label,service_line,sku,description,quantity
 * Multiple rows with the same surgeon+procedure get grouped into one card.
 */
export function parsePreferenceCardCsv(csv: string): Array<Omit<PreferenceCard, 'id' | 'owner_id' | 'created_at' | 'updated_at'>> {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);
  const grouped = new Map<string, Omit<PreferenceCard, 'id' | 'owner_id' | 'created_at' | 'updated_at'>>();
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const surgeon = cols[idx('surgeon_name')]?.trim();
    const proc = cols[idx('procedure_label')]?.trim();
    if (!surgeon || !proc) continue;
    const key = `${surgeon}::${proc}`;
    const item = {
      sku: cols[idx('sku')]?.trim() || '',
      description: cols[idx('description')]?.trim() || '',
      quantity: parseInt(cols[idx('quantity')] || '1', 10) || 1,
    };
    const existing = grouped.get(key);
    if (existing) {
      existing.items.push(item);
    } else {
      grouped.set(key, {
        surgeon_name: surgeon,
        procedure_label: proc,
        service_line: cols[idx('service_line')]?.trim() || null,
        items: [item],
        notes: null,
      });
    }
  }
  return Array.from(grouped.values());
}