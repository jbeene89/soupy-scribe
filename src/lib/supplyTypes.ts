export interface SupplyCatalogItem {
  id: string;
  owner_id: string | null;
  sku: string;
  description: string;
  vendor: string | null;
  category: string | null;
  pack_size: number;
  unit_price: number;
  equivalent_sku: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PreferenceCardItem {
  sku: string;
  description: string;
  quantity: number;
}

export interface PreferenceCard {
  id: string;
  owner_id: string;
  surgeon_name: string;
  procedure_label: string;
  service_line: string | null;
  items: PreferenceCardItem[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupplyOpenedItem {
  sku: string;
  description: string;
  qty: number;
  unit_price: number;
}

export interface SupplyUsedItem {
  sku: string;
  qty: number;
}

export interface SupplyWasteEvent {
  id: string;
  owner_id: string;
  case_id: string | null;
  surgeon_name: string | null;
  procedure_label: string | null;
  service_line: string | null;
  room_id: string | null;
  opened_items: SupplyOpenedItem[];
  used_items: SupplyUsedItem[];
  waste_cost: number;
  savings_opportunity: number;
  suggested_swap: string | null;
  notes: string | null;
  created_at: string;
}

export const SUPPLY_CATEGORIES = [
  { value: 'suture',      label: 'Suture' },
  { value: 'sponge',      label: 'Sponge' },
  { value: 'drape',       label: 'Drape' },
  { value: 'gown',        label: 'Gown' },
  { value: 'cover',       label: 'Cover' },
  { value: 'positioning', label: 'Positioning' },
  { value: 'instrument',  label: 'Instrument' },
  { value: 'implant',     label: 'Implant' },
  { value: 'other',       label: 'Other' },
] as const;

/**
 * Compute waste cost (opened-but-not-used) and the multi-pack savings opportunity.
 */
export function computeWaste(
  opened: SupplyOpenedItem[],
  used: SupplyUsedItem[],
  catalog: SupplyCatalogItem[],
): { wasteCost: number; savings: number; suggestedSwap: string | null } {
  const usedMap = new Map(used.map((u) => [u.sku, u.qty]));
  let wasteCost = 0;
  let savings = 0;
  const swaps: string[] = [];

  for (const item of opened) {
    const usedQty = usedMap.get(item.sku) ?? 0;
    const wastedQty = Math.max(0, item.qty - usedQty);
    wasteCost += wastedQty * item.unit_price;

    // Multi-pack swap opportunity: if catalog has equivalent_sku and opening N singles costs more than 1 multi-pack
    const cat = catalog.find((c) => c.sku === item.sku);
    if (cat?.equivalent_sku && item.qty >= 2) {
      const bulk = catalog.find((c) => c.sku === cat.equivalent_sku);
      if (bulk && bulk.pack_size > 1) {
        const singlesCost = item.qty * item.unit_price;
        const packsNeeded = Math.ceil(item.qty / bulk.pack_size);
        const bulkCost = packsNeeded * bulk.unit_price;
        const delta = singlesCost - bulkCost;
        if (delta > 0) {
          savings += delta;
          swaps.push(`${item.qty}× ${item.sku} → ${packsNeeded}× ${bulk.sku} (save $${delta.toFixed(2)})`);
        }
      }
    }
  }

  return {
    wasteCost: Math.round(wasteCost * 100) / 100,
    savings: Math.round(savings * 100) / 100,
    suggestedSwap: swaps.length ? swaps.join('; ') : null,
  };
}