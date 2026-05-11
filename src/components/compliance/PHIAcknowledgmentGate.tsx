import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";

const POLICY_VERSION = "2026-05-11.v1";

/**
 * Blocks the protected app surface until the signed-in user explicitly
 * acknowledges the PHI handling policy for the current policy version.
 * Persisted in `phi_policy_acknowledgements` and short-cached in
 * localStorage to avoid an extra round-trip on every navigation.
 */
export function PHIAcknowledgmentGate({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const [checked, setChecked] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [acked, setAcked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const userId = session?.user?.id;
  const cacheKey = userId ? `phi_ack_${userId}_${POLICY_VERSION}` : null;

  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (!userId) {
        setChecked(true);
        return;
      }
      if (cacheKey && localStorage.getItem(cacheKey) === "1") {
        setAcked(true);
        setChecked(true);
        return;
      }
      const { data } = await supabase
        .from("phi_policy_acknowledgements")
        .select("policy_version")
        .eq("user_id", userId)
        .maybeSingle();
      if (cancelled) return;
      if (data && data.policy_version === POLICY_VERSION) {
        setAcked(true);
        if (cacheKey) localStorage.setItem(cacheKey, "1");
      }
      setChecked(true);
    }
    check();
    return () => { cancelled = true; };
  }, [userId, cacheKey]);

  async function accept() {
    if (!userId || !agreed) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("phi_policy_acknowledgements")
        .upsert({
          user_id: userId,
          policy_version: POLICY_VERSION,
          user_agent: navigator.userAgent.slice(0, 500),
        }, { onConflict: "user_id" });
      if (error) throw error;
      if (cacheKey) localStorage.setItem(cacheKey, "1");
      setAcked(true);
    } catch (err) {
      toast.error("Could not record acknowledgement", {
        description: err instanceof Error ? err.message : "Try again.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !checked) return <>{children}</>;
  if (!session) return <>{children}</>;

  return (
    <>
      {children}
      <Dialog open={!acked} onOpenChange={() => { /* gate is mandatory */ }}>
        <DialogContent className="max-w-lg" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-500" />
              PHI Handling Policy — Acknowledgment Required
            </DialogTitle>
            <DialogDescription className="text-left space-y-3 pt-2">
              <p className="text-sm">
                SOUPY Audit may process Protected Health Information (PHI) under the
                terms of a Business Associate Agreement (BAA) with your organization.
                Before you proceed, you must acknowledge the following:
              </p>
              <ul className="text-sm list-disc pl-5 space-y-1.5">
                <li>You will only upload PHI you are authorized to handle.</li>
                <li>De-identified or synthetic data is preferred for testing and demos.</li>
                <li>All access is logged and auditable for 6 years per HIPAA §164.530(j).</li>
                <li>Sharing your account credentials is prohibited.</li>
                <li>Suspected breaches must be reported to <a className="underline" href="mailto:trust@soupyaudit.com">trust@soupyaudit.com</a> within 24 hours.</li>
                <li>If your organization has not signed a BAA with us, do not upload real PHI.</li>
              </ul>
              <p className="text-xs text-muted-foreground pt-1">Policy version: {POLICY_VERSION}</p>
            </DialogDescription>
          </DialogHeader>

          <label className="flex items-start gap-2 text-sm cursor-pointer pt-2">
            <Checkbox checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} className="mt-0.5" />
            <span>I understand and accept the PHI handling policy above.</span>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={async () => { await supabase.auth.signOut(); }}
            >
              Sign out
            </Button>
            <Button onClick={accept} disabled={!agreed || submitting}>
              {submitting ? "Recording…" : "Acknowledge & continue"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}