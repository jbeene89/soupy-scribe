import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";

const IDLE_LIMIT_MS = 15 * 60 * 1000; // 15 minutes — HIPAA §164.312(a)(2)(iii)
const WARNING_BEFORE_MS = 60 * 1000;  // warn 1 minute before sign-out

/**
 * Auto-signs the user out after 15 minutes of inactivity.
 * Tracks: mouse, keyboard, touch, scroll. Fully passive listeners.
 */
export function IdleTimeoutGuard() {
  const { session } = useAuth();
  const [warningOpen, setWarningOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(60);
  const lastActivity = useRef(Date.now());
  const tickRef = useRef<number | null>(null);

  useEffect(() => {
    if (!session) return;

    const bump = () => {
      lastActivity.current = Date.now();
      if (warningOpen) setWarningOpen(false);
    };

    const events: (keyof WindowEventMap)[] = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, bump, { passive: true } as AddEventListenerOptions));

    tickRef.current = window.setInterval(() => {
      const idle = Date.now() - lastActivity.current;
      if (idle >= IDLE_LIMIT_MS) {
        supabase.auth.signOut();
      } else if (idle >= IDLE_LIMIT_MS - WARNING_BEFORE_MS) {
        setSecondsLeft(Math.max(0, Math.ceil((IDLE_LIMIT_MS - idle) / 1000)));
        setWarningOpen(true);
      }
    }, 5000);

    return () => {
      events.forEach((e) => window.removeEventListener(e, bump));
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, [session, warningOpen]);

  if (!session) return null;

  return (
    <Dialog open={warningOpen} onOpenChange={setWarningOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" />
            Session expiring
          </DialogTitle>
          <DialogDescription>
            For security, you'll be signed out in {secondsLeft} seconds due to inactivity.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => supabase.auth.signOut()}>Sign out now</Button>
          <Button onClick={() => { lastActivity.current = Date.now(); setWarningOpen(false); }}>Stay signed in</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}