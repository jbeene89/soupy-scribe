import { supabase } from "@/integrations/supabase/client";

export type PhiAction =
  | "view"
  | "create"
  | "update"
  | "delete"
  | "export"
  | "analyze"
  | "upload"
  | "download";

export interface PhiLogEntry {
  resourceType: string; // e.g. "audit_case", "psych_note", "clawback_claim"
  resourceId?: string;
  action: PhiAction;
  metadata?: Record<string, unknown>;
}

/**
 * Append-only PHI access logger. Required by HIPAA §164.312(b).
 * Fire-and-forget — never blocks the UI. Failures are logged to console only.
 */
export async function logPhiAccess(entry: PhiLogEntry): Promise<void> {
  try {
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes.user;
    if (!user) return;

    await supabase.from("phi_access_log").insert({
      user_id: user.id,
      user_email: user.email ?? null,
      resource_type: entry.resourceType,
      resource_id: entry.resourceId ?? null,
      action: entry.action,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : null,
      metadata: (entry.metadata ?? {}) as never,
    });
  } catch (err) {
    // Never break the UI for an audit-log failure, but make it visible in dev.
    console.warn("[phiAccessLog] failed to record access", err);
  }
}

export interface PhiAccessRow {
  id: string;
  user_id: string | null;
  user_email: string | null;
  resource_type: string;
  resource_id: string | null;
  action: string;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export async function fetchOwnPhiAccessLog(limit = 200): Promise<PhiAccessRow[]> {
  const { data, error } = await supabase
    .from("phi_access_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as PhiAccessRow[];
}