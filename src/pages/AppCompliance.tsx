import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, FileSearch, KeyRound, Lock, Activity } from "lucide-react";
import { fetchOwnPhiAccessLog, type PhiAccessRow } from "@/lib/phiAccessLog";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

const CONTROLS: Array<{ icon: typeof ShieldCheck; label: string; status: "active" | "policy"; detail: string }> = [
  { icon: Lock,        label: "Encryption at rest (AES-256)",       status: "active", detail: "Database, storage, and backups encrypted by default." },
  { icon: Lock,        label: "Encryption in transit (TLS 1.2+)",   status: "active", detail: "All client-server traffic enforced over HTTPS." },
  { icon: KeyRound,    label: "Row-Level Security on every table",  status: "active", detail: "Owner-scoped policies on all PHI-bearing tables." },
  { icon: KeyRound,    label: "Leaked-password protection (HIBP)",  status: "active", detail: "Passwords checked against Have I Been Pwned at signup." },
  { icon: Activity,    label: "Idle session timeout (15 min)",      status: "active", detail: "Auto sign-out after inactivity per §164.312(a)(2)(iii)." },
  { icon: FileSearch,  label: "PHI access audit log (6-year retention)", status: "active", detail: "Every PHI read/write is recorded per §164.312(b)." },
  { icon: ShieldCheck, label: "PHI policy acknowledgment gate",      status: "active", detail: "Users must accept the PHI handling policy before proceeding." },
  { icon: ShieldCheck, label: "Safe Harbor de-identification utility", status: "active", detail: "Strips 18 HIPAA identifiers before LLM calls when enabled." },
  { icon: ShieldCheck, label: "Business Associate Agreement (BAA)",  status: "policy", detail: "Required from each customer organization before production PHI use." },
];

export default function AppCompliance() {
  const [rows, setRows] = useState<PhiAccessRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetchOwnPhiAccessLog(50)
      .then(setRows)
      .catch((e) => setErr(e instanceof Error ? e.message : "Failed to load access log"));
  }, []);

  return (
    <div className="space-y-6 p-6">
      <header>
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck className="h-5 w-5 text-emerald-500" />
          <h1 className="text-2xl font-semibold tracking-tight">HIPAA Compliance</h1>
        </div>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Technical, administrative, and physical safeguards in place. This page
          surfaces your own access trail. Soupy administrators can review the
          full org-wide log for compliance reviews.
        </p>
      </header>

      <section>
        <h2 className="text-sm font-mono uppercase tracking-wider text-muted-foreground mb-3">Controls</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {CONTROLS.map(({ icon: Icon, label, status, detail }) => (
            <Card key={label} className="p-4 flex items-start gap-3">
              <Icon className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-sm font-medium">{label}</span>
                  <Badge variant="outline" className={status === "active"
                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30 text-[10px]"
                    : "bg-amber-500/10 text-amber-500 border-amber-500/30 text-[10px]"}>
                    {status === "active" ? "Active" : "Per-customer"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{detail}</p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-mono uppercase tracking-wider text-muted-foreground">My Recent PHI Access</h2>
          <span className="text-xs text-muted-foreground">Last 50 events</span>
        </div>
        <Card className="overflow-hidden">
          {err && <div className="p-4 text-sm text-destructive">{err}</div>}
          {!rows && !err && <div className="p-4 space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}</div>}
          {rows && rows.length === 0 && <div className="p-6 text-sm text-muted-foreground text-center">No PHI access events recorded yet.</div>}
          {rows && rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/30 border-b border-border">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-mono uppercase tracking-wider text-[10px] text-muted-foreground">When</th>
                    <th className="px-3 py-2 font-mono uppercase tracking-wider text-[10px] text-muted-foreground">Action</th>
                    <th className="px-3 py-2 font-mono uppercase tracking-wider text-[10px] text-muted-foreground">Resource</th>
                    <th className="px-3 py-2 font-mono uppercase tracking-wider text-[10px] text-muted-foreground">ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {rows.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/20">
                      <td className="px-3 py-2 whitespace-nowrap font-mono">{format(new Date(r.created_at), "yyyy-MM-dd HH:mm:ss")}</td>
                      <td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">{r.action}</Badge></td>
                      <td className="px-3 py-2">{r.resource_type}</td>
                      <td className="px-3 py-2 font-mono text-muted-foreground truncate max-w-[200px]">{r.resource_id ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}