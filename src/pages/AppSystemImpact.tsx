import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Network,
  TrendingDown,
  AlertTriangle,
  Users,
  Stethoscope,
  ArrowRight,
  ChevronRight,
} from 'lucide-react';
import { useSystemImpact } from '@/hooks/useSystemImpact';
import { formatUSD } from '@/lib/systemImpactService';
import { UnifiedTimeline } from '@/components/system-impact/UnifiedTimeline';
import { cn } from '@/lib/utils';

export default function AppSystemImpact() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { entries, categories, physicians, patients, patterns, totalLoss } = useSystemImpact();

  const patientFilter = searchParams.get('patient') ?? undefined;
  const physicianFilter = searchParams.get('physician') ?? undefined;
  const filterActive = Boolean(patientFilter || physicianFilter);

  const [activeTab, setActiveTab] = useState<'patterns' | 'physicians' | 'patients' | 'all'>(
    'patterns'
  );

  useEffect(() => {
    if (filterActive) setActiveTab('patterns');
  }, [filterActive]);

  const clearFilter = () => setSearchParams({});

  if (entries.length === 0) {
    return (
      <Card className="p-10 text-center">
        <Network className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
        <h2 className="text-lg font-semibold mb-1">No cross-module activity yet</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Once cases, OR events, triage misses, post-op delays, or advocate findings start landing,
          they'll be aggregated here as a single financial and pattern picture.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Network className="h-5 w-5 text-primary" />
            System Impact
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Cross-module financial roll-up and pattern detection
          </p>
        </div>
      </div>

      {/* Top metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Metric
          icon={<TrendingDown className="h-4 w-4" />}
          label="Estimated loss"
          value={formatUSD(totalLoss)}
          subtitle={`${entries.length} events`}
        />
        <Metric
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Active patterns"
          value={String(patterns.length)}
          subtitle={`${patterns.filter((p) => p.severity === 'critical').length} critical`}
        />
        <Metric
          icon={<Stethoscope className="h-4 w-4" />}
          label="Physicians involved"
          value={String(physicians.length)}
          subtitle="with measurable impact"
        />
        <Metric
          icon={<Users className="h-4 w-4" />}
          label="Patients touched"
          value={String(patients.length)}
          subtitle="across modules"
        />
      </div>

      {/* Category roll-up */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Loss by source module</h2>
          <span className="text-[11px] text-muted-foreground">
            Conservative estimates, see assumptions in code
          </span>
        </div>
        <div className="space-y-2">
          {categories.map((c) => {
            const pct = totalLoss === 0 ? 0 : (c.total_loss / totalLoss) * 100;
            return (
              <button
                key={c.category}
                onClick={() => {
                  const path = entries.find((e) => e.category === c.category)?.module_path;
                  if (path) navigate(path);
                }}
                className="w-full text-left group"
              >
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium group-hover:text-primary transition-colors">
                    {c.category_label}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {formatUSD(c.total_loss)} · {c.event_count} events
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary group-hover:bg-primary/80 transition-colors"
                    style={{ width: `${Math.max(2, pct)}%` }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Filtered timeline (if filter active) */}
      {filterActive && (
        <UnifiedTimeline
          patientId={patientFilter}
          physicianName={physicianFilter}
          onClear={clearFilter}
        />
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList>
          <TabsTrigger value="patterns">
            Patterns
            {patterns.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-[10px]">
                {patterns.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="physicians">Physicians</TabsTrigger>
          <TabsTrigger value="patients">Patients</TabsTrigger>
          <TabsTrigger value="all">All events</TabsTrigger>
        </TabsList>

        <TabsContent value="patterns" className="space-y-3 mt-4">
          {patterns.length === 0 ? (
            <Card className="p-6 text-sm text-muted-foreground text-center">
              No cross-module patterns detected yet. Patterns surface when the same physician,
              patient, or category repeats across multiple events.
            </Card>
          ) : (
            patterns.map((p) => (
              <Card
                key={p.id}
                className={cn(
                  'p-4 border-l-4',
                  p.severity === 'critical' && 'border-l-destructive',
                  p.severity === 'warning' && 'border-l-disagreement',
                  p.severity === 'info' && 'border-l-info-blue'
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant={p.severity === 'critical' ? 'destructive' : 'secondary'}
                        className="text-[10px]"
                      >
                        {p.severity}
                      </Badge>
                      <h3 className="text-sm font-semibold">{p.title}</h3>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{p.detail}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-semibold">{formatUSD(p.total_loss)}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {p.related_entries.length} events
                    </div>
                  </div>
                </div>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="physicians" className="space-y-2 mt-4">
          {physicians.slice(0, 25).map((p) => (
            <button
              key={p.physician_name}
              onClick={() =>
                setSearchParams({ physician: p.physician_name })
              }
              className="w-full text-left rounded-md border p-3 hover:bg-muted/40 transition-colors flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{p.physician_name}</div>
                <div className="text-[11px] text-muted-foreground">
                  {p.event_count} events · {p.categories.length} module
                  {p.categories.length > 1 ? 's' : ''}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-sm font-semibold tabular-nums">
                  {formatUSD(p.total_loss)}
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </button>
          ))}
          {physicians.length === 0 && (
            <Card className="p-6 text-sm text-muted-foreground text-center">
              No physicians associated with measurable impact yet.
            </Card>
          )}
        </TabsContent>

        <TabsContent value="patients" className="space-y-2 mt-4">
          {patients.slice(0, 25).map((p) => (
            <button
              key={p.patient_id}
              onClick={() => setSearchParams({ patient: p.patient_id })}
              className="w-full text-left rounded-md border p-3 hover:bg-muted/40 transition-colors flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">Patient {p.patient_id}</div>
                <div className="text-[11px] text-muted-foreground">
                  {p.event_count} events · {p.categories.length} module
                  {p.categories.length > 1 ? 's' : ''}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-sm font-semibold tabular-nums">
                  {formatUSD(p.total_loss)}
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </button>
          ))}
          {patients.length === 0 && (
            <Card className="p-6 text-sm text-muted-foreground text-center">
              No patient IDs associated with measurable impact yet.
            </Card>
          )}
        </TabsContent>

        <TabsContent value="all" className="mt-4">
          <Card className="divide-y">
            {entries.slice(0, 50).map((e) => (
              <div key={e.id} className="p-3 flex items-start justify-between gap-3 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">
                      {e.category_label}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(e.occurred_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="mt-1 line-clamp-2">{e.description}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {[e.physician_name && `Dr. ${e.physician_name}`, e.patient_id && `Pt ${e.patient_id}`, e.service_line]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-semibold tabular-nums">{formatUSD(e.estimated_loss)}</div>
                  <button
                    onClick={() => navigate(e.module_path)}
                    className="text-[11px] text-primary hover:underline inline-flex items-center gap-0.5"
                  >
                    Open <ArrowRight className="h-2.5 w-2.5" />
                  </button>
                </div>
              </div>
            ))}
            {entries.length > 50 && (
              <div className="p-3 text-[11px] text-muted-foreground text-center">
                Showing 50 of {entries.length} events. Use Patterns / Physicians / Patients tabs to
                filter.
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  subtitle,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="text-xl font-bold mt-1 tabular-nums">{value}</div>
      {subtitle && <div className="text-[11px] text-muted-foreground">{subtitle}</div>}
    </Card>
  );
}