import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, Upload, Plus, DollarSign, ArrowRightLeft, Trash2, FileSpreadsheet, ListPlus, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  listCatalog, upsertCatalogItems, deleteCatalogItem,
  listPreferenceCards, createPreferenceCard, deletePreferenceCard,
  listWasteEvents, logWasteEvent, deleteWasteEvent,
  parseCatalogCsv, parsePreferenceCardCsv,
} from '@/lib/supplyService';
import type { SupplyCatalogItem, PreferenceCard, SupplyWasteEvent, SupplyOpenedItem, SupplyUsedItem } from '@/lib/supplyTypes';
import { computeWaste, SUPPLY_CATEGORIES } from '@/lib/supplyTypes';

interface Props {
  posture: 'payment-integrity' | 'compliance-coaching';
}

export function SupplyWasteSection({ posture }: Props) {
  const [catalog, setCatalog] = useState<SupplyCatalogItem[]>([]);
  const [cards, setCards] = useState<PreferenceCard[]>([]);
  const [events, setEvents] = useState<SupplyWasteEvent[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      const [c, p, e] = await Promise.all([listCatalog(), listPreferenceCards(), listWasteEvents()]);
      setCatalog(c);
      setCards(p);
      setEvents(e);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load supply data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  const totals = useMemo(() => {
    const wasteCost = events.reduce((s, e) => s + Number(e.waste_cost || 0), 0);
    const savings = events.reduce((s, e) => s + Number(e.savings_opportunity || 0), 0);
    const swaps = events.filter((e) => e.suggested_swap).length;
    return { wasteCost, savings, swaps };
  }, [events]);

  const swapSuggestions = useMemo(() => {
    // Roll up by SKU across events for top recommendations
    const map = new Map<string, { swap: string; count: number; savings: number }>();
    for (const e of events) {
      if (!e.suggested_swap) continue;
      for (const swap of e.suggested_swap.split(';').map((s) => s.trim()).filter(Boolean)) {
        const cur = map.get(swap) || { swap, count: 0, savings: 0 };
        cur.count++;
        cur.savings += Number(e.savings_opportunity || 0) / (e.suggested_swap?.split(';').length || 1);
        map.set(swap, cur);
      }
    }
    return Array.from(map.values()).sort((a, b) => b.savings - a.savings).slice(0, 6);
  }, [events]);

  return (
    <div className="rounded-lg border bg-card shadow-sm">
      <div className="p-4 border-b flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm font-semibold flex items-center gap-2">
            <Package className="h-4 w-4 text-info-blue" />
            Supply Utilization Audit
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {posture === 'payment-integrity'
              ? 'Identify supply waste and SKU mismatches that inflate per-case cost.'
              : 'Track opened-vs-used supplies and surface multi-pack savings against your preference cards.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Stat label="Waste" value={`$${totals.wasteCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} tone="violation" />
          <Stat label="Savings Found" value={`$${totals.savings.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} tone="consensus" />
          <Stat label="Swap Hits" value={String(totals.swaps)} tone="info-blue" />
        </div>
      </div>

      <Tabs defaultValue="dashboard" className="w-full">
        <div className="px-4 pt-3">
          <TabsList>
            <TabsTrigger value="dashboard" className="text-xs">Dashboard</TabsTrigger>
            <TabsTrigger value="log" className="text-xs">Log Waste</TabsTrigger>
            <TabsTrigger value="catalog" className="text-xs">Vendor Catalog</TabsTrigger>
            <TabsTrigger value="cards" className="text-xs">Preference Cards</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="dashboard" className="p-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-md border p-3">
              <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                <ArrowRightLeft className="h-3.5 w-3.5 text-info-blue" />
                Top SKU Swap Recommendations
              </p>
              {swapSuggestions.length === 0 ? (
                <p className="text-xs text-muted-foreground">No swap opportunities detected yet. Log a few waste events to populate.</p>
              ) : (
                <ul className="space-y-1.5">
                  {swapSuggestions.map((s) => (
                    <li key={s.swap} className="text-xs flex items-start justify-between gap-2 rounded border bg-muted/20 px-2 py-1.5">
                      <span className="font-mono">{s.swap}</span>
                      <Badge variant="outline" className="text-[10px] shrink-0">×{s.count}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-md border p-3">
              <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5 text-violation" />
                Recent Waste Events
              </p>
              {events.length === 0 ? (
                <p className="text-xs text-muted-foreground">No waste events logged yet.</p>
              ) : (
                <div className="space-y-1.5 max-h-[260px] overflow-y-auto">
                  {events.slice(0, 12).map((e) => (
                    <div key={e.id} className="text-xs rounded border bg-muted/10 px-2 py-1.5 flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="font-medium">
                          {e.surgeon_name || 'Surgeon —'} · {e.procedure_label || 'Procedure —'}
                        </div>
                        {e.suggested_swap && <div className="text-[11px] text-info-blue font-mono">{e.suggested_swap}</div>}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-violation font-semibold">${Number(e.waste_cost).toFixed(0)}</div>
                        {Number(e.savings_opportunity) > 0 && (
                          <div className="text-consensus text-[10px]">+${Number(e.savings_opportunity).toFixed(0)} swap</div>
                        )}
                      </div>
                      <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={async () => {
                        await deleteWasteEvent(e.id);
                        refresh();
                      }}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="log" className="p-4">
          <WasteLogForm catalog={catalog} cards={cards} onLogged={refresh} />
        </TabsContent>

        <TabsContent value="catalog" className="p-4 space-y-4">
          <CatalogPanel catalog={catalog} loading={loading} onChanged={refresh} />
        </TabsContent>

        <TabsContent value="cards" className="p-4 space-y-4">
          <PreferenceCardPanel cards={cards} catalog={catalog} loading={loading} onChanged={refresh} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: 'violation' | 'consensus' | 'info-blue' }) {
  return (
    <div className="text-right">
      <div className={cn('text-base font-bold font-mono',
        tone === 'violation' ? 'text-violation' : tone === 'consensus' ? 'text-consensus' : 'text-info-blue')}>{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}

// ─── Catalog panel ────────────────────────────
function CatalogPanel({ catalog, loading, onChanged }: { catalog: SupplyCatalogItem[]; loading: boolean; onChanged: () => void }) {
  const [filter, setFilter] = useState('');
  const filtered = useMemo(() => {
    const f = filter.toLowerCase().trim();
    if (!f) return catalog;
    return catalog.filter((c) =>
      c.sku.toLowerCase().includes(f) ||
      c.description.toLowerCase().includes(f) ||
      (c.vendor || '').toLowerCase().includes(f) ||
      (c.category || '').toLowerCase().includes(f),
    );
  }, [catalog, filter]);

  async function handleCsvUpload(file: File) {
    try {
      const text = await file.text();
      const rows = parseCatalogCsv(text);
      if (rows.length === 0) {
        toast.error('No valid rows found. Expected columns: sku, description, vendor, category, pack_size, unit_price, equivalent_sku, notes');
        return;
      }
      const count = await upsertCatalogItems(rows);
      toast.success(`Imported ${count} catalog item(s)`);
      onChanged();
    } catch (err: any) {
      toast.error(err.message || 'Import failed');
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Input placeholder="Search SKU, description, vendor…" value={filter} onChange={(e) => setFilter(e.target.value)} className="h-8 text-xs max-w-xs" />
        <label className="ml-auto">
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCsvUpload(f); e.currentTarget.value = ''; }}
          />
          <Button asChild size="sm" variant="outline" className="gap-1.5 text-xs">
            <span><Upload className="h-3.5 w-3.5" /> Import CSV</span>
          </Button>
        </label>
        <Button size="sm" variant="ghost" className="gap-1.5 text-xs" onClick={() => downloadSampleCatalog()}>
          <FileSpreadsheet className="h-3.5 w-3.5" /> Sample CSV
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Demo SKUs are seeded so the audit works out of the box. Upload your GPO/contracted catalog to override.
      </p>
      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : (
        <div className="rounded-md border max-h-[400px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/30 sticky top-0">
              <tr>
                <th className="text-left p-2 font-medium">SKU</th>
                <th className="text-left p-2 font-medium">Description</th>
                <th className="text-left p-2 font-medium">Vendor</th>
                <th className="text-left p-2 font-medium">Category</th>
                <th className="text-right p-2 font-medium">Pack</th>
                <th className="text-right p-2 font-medium">Price</th>
                <th className="text-left p-2 font-medium">Bulk Equiv.</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="p-2 font-mono">{c.sku}</td>
                  <td className="p-2">{c.description}</td>
                  <td className="p-2 text-muted-foreground">{c.vendor || '—'}</td>
                  <td className="p-2 text-muted-foreground">{c.category || '—'}</td>
                  <td className="p-2 text-right">{c.pack_size}</td>
                  <td className="p-2 text-right font-mono">${Number(c.unit_price).toFixed(2)}</td>
                  <td className="p-2 font-mono text-info-blue">{c.equivalent_sku || '—'}</td>
                  <td className="p-2 text-right">
                    {c.owner_id && (
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={async () => { await deleteCatalogItem(c.id); onChanged(); }}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="p-4 text-center text-muted-foreground">No catalog items.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function downloadSampleCatalog() {
  const csv = [
    'sku,description,vendor,category,pack_size,unit_price,equivalent_sku,notes',
    'VCP318H,Vicryl 3-0 18in CT-1 (single),Ethicon,suture,1,28.00,VCP318H-4PK,',
    'VCP318H-4PK,Vicryl 3-0 18in CT-1 (4-pack),Ethicon,suture,4,62.00,,',
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'supply_catalog_sample.csv'; a.click();
  URL.revokeObjectURL(url);
}

// ─── Preference cards panel ──────────────────
function PreferenceCardPanel({ cards, catalog, loading, onChanged }: { cards: PreferenceCard[]; catalog: SupplyCatalogItem[]; loading: boolean; onChanged: () => void }) {
  async function handleCsvUpload(file: File) {
    try {
      const text = await file.text();
      const parsed = parsePreferenceCardCsv(text);
      if (parsed.length === 0) {
        toast.error('No valid rows. Expected: surgeon_name, procedure_label, service_line, sku, description, quantity');
        return;
      }
      let imported = 0;
      for (const card of parsed) {
        await createPreferenceCard(card);
        imported++;
      }
      toast.success(`Imported ${imported} preference card(s)`);
      onChanged();
    } catch (err: any) {
      toast.error(err.message || 'Import failed');
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <label>
          <input type="file" accept=".csv,text/csv" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCsvUpload(f); e.currentTarget.value = ''; }} />
          <Button asChild size="sm" variant="outline" className="gap-1.5 text-xs">
            <span><Upload className="h-3.5 w-3.5" /> Import Preference Cards CSV</span>
          </Button>
        </label>
        <Button size="sm" variant="ghost" className="gap-1.5 text-xs" onClick={() => downloadSamplePrefCard()}>
          <FileSpreadsheet className="h-3.5 w-3.5" /> Sample CSV
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        One row per item. Multiple rows with the same surgeon + procedure are grouped into a single card.
      </p>
      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : cards.length === 0 ? (
        <p className="text-xs text-muted-foreground">No preference cards yet.</p>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {cards.map((card) => {
            const totalCost = card.items.reduce((s, it) => {
              const cat = catalog.find((c) => c.sku === it.sku);
              return s + (cat?.unit_price || 0) * it.quantity;
            }, 0);
            return (
              <div key={card.id} className="rounded-md border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs">
                    <span className="font-semibold">{card.surgeon_name}</span>
                    <span className="text-muted-foreground"> · {card.procedure_label}</span>
                    {card.service_line && <span className="text-muted-foreground"> · {card.service_line}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">${totalCost.toFixed(0)} expected</Badge>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={async () => { await deletePreferenceCard(card.id); onChanged(); }}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
                  {card.items.map((it, idx) => (
                    <div key={idx} className="text-[11px] rounded bg-muted/20 px-2 py-1 flex items-center justify-between gap-2">
                      <span className="font-mono truncate">{it.sku}</span>
                      <span className="text-muted-foreground shrink-0">×{it.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function downloadSamplePrefCard() {
  const csv = [
    'surgeon_name,procedure_label,service_line,sku,description,quantity',
    'Dr. Smith,Lap Chole,General Surgery,VCP318H,Vicryl 3-0,4',
    'Dr. Smith,Lap Chole,General Surgery,LAPSPNG-5,Lap sponge 5pk,2',
    'Dr. Smith,Lap Chole,General Surgery,TROCAR-12,12mm trocar,3',
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'preference_cards_sample.csv'; a.click();
  URL.revokeObjectURL(url);
}

// ─── Waste log form ──────────────────────────
function WasteLogForm({ catalog, cards, onLogged }: { catalog: SupplyCatalogItem[]; cards: PreferenceCard[]; onLogged: () => void }) {
  const [surgeon, setSurgeon] = useState('');
  const [procedure, setProcedure] = useState('');
  const [serviceLine, setServiceLine] = useState('');
  const [room, setRoom] = useState('');
  const [opened, setOpened] = useState<SupplyOpenedItem[]>([]);
  const [used, setUsed] = useState<SupplyUsedItem[]>([]);
  const [notes, setNotes] = useState('');
  const [pickSku, setPickSku] = useState('');
  const [pickQty, setPickQty] = useState('1');
  const [submitting, setSubmitting] = useState(false);

  // When a card is selected, prefill opened items from card
  function applyCard(cardId: string) {
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;
    setSurgeon(card.surgeon_name);
    setProcedure(card.procedure_label);
    setServiceLine(card.service_line || '');
    const filled: SupplyOpenedItem[] = card.items.map((it) => {
      const cat = catalog.find((c) => c.sku === it.sku);
      return { sku: it.sku, description: it.description || cat?.description || it.sku, qty: it.quantity, unit_price: cat?.unit_price || 0 };
    });
    setOpened(filled);
    setUsed(filled.map((it) => ({ sku: it.sku, qty: it.qty }))); // assume fully used; user adjusts
  }

  function addOpened() {
    if (!pickSku) return;
    const cat = catalog.find((c) => c.sku === pickSku);
    if (!cat) { toast.error('SKU not in catalog'); return; }
    const qty = parseInt(pickQty, 10) || 1;
    setOpened((prev) => [...prev, { sku: cat.sku, description: cat.description, qty, unit_price: Number(cat.unit_price) }]);
    setUsed((prev) => [...prev, { sku: cat.sku, qty }]);
    setPickSku(''); setPickQty('1');
  }

  function setUsedQty(sku: string, qty: number) {
    setUsed((prev) => prev.map((u) => (u.sku === sku ? { ...u, qty } : u)));
  }

  function removeItem(sku: string) {
    setOpened((prev) => prev.filter((o) => o.sku !== sku));
    setUsed((prev) => prev.filter((u) => u.sku !== sku));
  }

  const preview = useMemo(() => computeWaste(opened, used, catalog), [opened, used, catalog]);

  async function handleSubmit() {
    if (opened.length === 0) { toast.error('Add at least one opened item'); return; }
    setSubmitting(true);
    try {
      await logWasteEvent({
        surgeon_name: surgeon || null,
        procedure_label: procedure || null,
        service_line: serviceLine || null,
        room_id: room || null,
        opened_items: opened,
        used_items: used,
        catalog,
        notes: notes || null,
      });
      toast.success('Waste event logged');
      setOpened([]); setUsed([]); setNotes('');
      onLogged();
    } catch (err: any) {
      toast.error(err.message || 'Save failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {cards.length > 0 && (
        <div className="rounded-md border p-3 bg-muted/10">
          <Label className="text-xs">Prefill from preference card</Label>
          <Select onValueChange={applyCard}>
            <SelectTrigger className="h-8 text-xs mt-1">
              <SelectValue placeholder="Select a preference card…" />
            </SelectTrigger>
            <SelectContent>
              {cards.map((c) => (
                <SelectItem key={c.id} value={c.id} className="text-xs">
                  {c.surgeon_name} · {c.procedure_label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div><Label className="text-xs">Surgeon</Label><Input value={surgeon} onChange={(e) => setSurgeon(e.target.value)} className="h-8 text-xs" /></div>
        <div><Label className="text-xs">Procedure</Label><Input value={procedure} onChange={(e) => setProcedure(e.target.value)} className="h-8 text-xs" /></div>
        <div><Label className="text-xs">Service Line</Label><Input value={serviceLine} onChange={(e) => setServiceLine(e.target.value)} className="h-8 text-xs" /></div>
        <div><Label className="text-xs">Room</Label><Input value={room} onChange={(e) => setRoom(e.target.value)} className="h-8 text-xs" /></div>
      </div>

      <div className="rounded-md border p-3 space-y-3">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Label className="text-xs">Add opened item (catalog SKU)</Label>
            <Select value={pickSku} onValueChange={setPickSku}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Search catalog…" /></SelectTrigger>
              <SelectContent>
                {catalog.map((c) => (
                  <SelectItem key={c.id} value={c.sku} className="text-xs">
                    <span className="font-mono">{c.sku}</span> — {c.description} (${Number(c.unit_price).toFixed(2)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-20">
            <Label className="text-xs">Qty opened</Label>
            <Input type="number" min="1" value={pickQty} onChange={(e) => setPickQty(e.target.value)} className="h-8 text-xs" />
          </div>
          <Button size="sm" onClick={addOpened} className="gap-1 text-xs h-8"><Plus className="h-3 w-3" /> Add</Button>
        </div>

        {opened.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-[11px] text-muted-foreground grid grid-cols-12 gap-2 px-2">
              <span className="col-span-4">SKU / Description</span>
              <span className="col-span-2 text-right">Opened</span>
              <span className="col-span-2 text-right">Used</span>
              <span className="col-span-2 text-right">Unit $</span>
              <span className="col-span-2 text-right">Wasted $</span>
            </div>
            {opened.map((o) => {
              const u = used.find((x) => x.sku === o.sku);
              const usedQty = u?.qty ?? 0;
              const wasted = Math.max(0, o.qty - usedQty);
              return (
                <div key={o.sku} className="grid grid-cols-12 gap-2 items-center text-xs rounded bg-muted/20 px-2 py-1.5">
                  <div className="col-span-4">
                    <div className="font-mono">{o.sku}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{o.description}</div>
                  </div>
                  <div className="col-span-2 text-right font-mono">{o.qty}</div>
                  <div className="col-span-2">
                    <Input type="number" min="0" max={o.qty} value={usedQty}
                      onChange={(e) => setUsedQty(o.sku, Math.max(0, Math.min(o.qty, parseInt(e.target.value, 10) || 0)))}
                      className="h-7 text-xs text-right" />
                  </div>
                  <div className="col-span-2 text-right font-mono text-muted-foreground">${o.unit_price.toFixed(2)}</div>
                  <div className="col-span-1 text-right font-mono text-violation">${(wasted * o.unit_price).toFixed(2)}</div>
                  <div className="col-span-1 text-right">
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeItem(o.sku)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-2">
          <Label className="text-xs">Notes</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="text-xs" />
        </div>
        <div className="rounded-md border p-3 space-y-1.5 bg-muted/10">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Waste cost</span>
            <span className="font-mono font-semibold text-violation">${preview.wasteCost.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Multi-pack savings</span>
            <span className="font-mono font-semibold text-consensus">${preview.savings.toFixed(2)}</span>
          </div>
          {preview.suggestedSwap && (
            <div className="text-[11px] text-info-blue mt-1 font-mono leading-snug">{preview.suggestedSwap}</div>
          )}
          {!preview.suggestedSwap && opened.length > 0 && (
            <div className="text-[11px] text-muted-foreground flex items-start gap-1 mt-1">
              <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
              No bulk-pack swap available for the SKUs opened.
            </div>
          )}
        </div>
      </div>

      <Button onClick={handleSubmit} disabled={submitting || opened.length === 0} className="gap-1.5 text-xs">
        <ListPlus className="h-3.5 w-3.5" /> {submitting ? 'Saving…' : 'Log Waste Event'}
      </Button>
    </div>
  );
}