import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle, Mail } from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const FN_URL = `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe`;

type State =
  | 'validating'
  | 'ready'
  | 'submitting'
  | 'done'
  | 'already'
  | 'invalid';

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [state, setState] = useState<State>('validating');

  useEffect(() => {
    if (!token) {
      setState('invalid');
      return;
    }
    fetch(`${FN_URL}?token=${encodeURIComponent(token)}`, {
      headers: { apikey: SUPABASE_ANON_KEY },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data?.valid === true) setState('ready');
        else if (data?.reason === 'already_unsubscribed') setState('already');
        else setState('invalid');
      })
      .catch(() => setState('invalid'));
  }, [token]);

  const confirm = async () => {
    if (!token) return;
    setState('submitting');
    try {
      const r = await fetch(FN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ token }),
      });
      const data = await r.json();
      if (data?.success) setState('done');
      else if (data?.reason === 'already_unsubscribed') setState('already');
      else setState('invalid');
    } catch {
      setState('invalid');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="max-w-md w-full p-8 text-center space-y-4">
        <div className="flex justify-center">
          <Mail className="h-10 w-10 text-primary" />
        </div>
        <h1 className="text-xl font-semibold">SOUPY email preferences</h1>

        {state === 'validating' && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-6">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking your link…
          </div>
        )}

        {state === 'ready' && (
          <>
            <p className="text-sm text-muted-foreground">
              Click below to unsubscribe this email address from SOUPY
              notifications. You'll stop receiving emails from us right away.
            </p>
            <Button onClick={confirm} className="w-full">
              Confirm unsubscribe
            </Button>
          </>
        )}

        {state === 'submitting' && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-6">
            <Loader2 className="h-4 w-4 animate-spin" /> Updating…
          </div>
        )}

        {state === 'done' && (
          <div className="space-y-2 py-2">
            <CheckCircle2 className="h-8 w-8 text-consensus mx-auto" />
            <p className="text-sm">
              You've been unsubscribed. We won't email this address again.
            </p>
          </div>
        )}

        {state === 'already' && (
          <div className="space-y-2 py-2">
            <CheckCircle2 className="h-8 w-8 text-consensus mx-auto" />
            <p className="text-sm">
              This address is already unsubscribed — no further action needed.
            </p>
          </div>
        )}

        {state === 'invalid' && (
          <div className="space-y-2 py-2">
            <XCircle className="h-8 w-8 text-destructive mx-auto" />
            <p className="text-sm text-muted-foreground">
              This unsubscribe link is invalid or has expired.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
