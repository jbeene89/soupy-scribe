
CREATE TABLE public.recovery_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  label TEXT,
  status TEXT NOT NULL DEFAULT 'running',
  encounter_count INTEGER NOT NULL DEFAULT 0,
  completed_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  total_dollars_at_risk NUMERIC NOT NULL DEFAULT 0,
  total_dollars_recoverable NUMERIC NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.recovery_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage recovery_batches"
ON public.recovery_batches FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access recovery_batches"
ON public.recovery_batches FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE TRIGGER trg_recovery_batches_updated_at
BEFORE UPDATE ON public.recovery_batches
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.recovery_runs
  ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES public.recovery_batches(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_recovery_runs_batch_id ON public.recovery_runs(batch_id);

ALTER TABLE public.recovery_findings
  ADD COLUMN IF NOT EXISTS adversarial_verdict TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS adversarial_note TEXT,
  ADD COLUMN IF NOT EXISTS adversarial_checked_at TIMESTAMPTZ;
