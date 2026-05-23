CREATE TABLE IF NOT EXISTS public.manual_follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  manager_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  note TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

ALTER TABLE public.manual_follow_ups
DROP CONSTRAINT IF EXISTS manual_follow_ups_status_check,
ADD CONSTRAINT manual_follow_ups_status_check
  CHECK (status IN ('active', 'resolved', 'cancelled'));

CREATE INDEX IF NOT EXISTS idx_manual_follow_ups_player_id ON public.manual_follow_ups(player_id);
CREATE INDEX IF NOT EXISTS idx_manual_follow_ups_status ON public.manual_follow_ups(status);
CREATE INDEX IF NOT EXISTS idx_manual_follow_ups_created_at ON public.manual_follow_ups(created_at);

ALTER TABLE public.manual_follow_ups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage manual follow ups" ON public.manual_follow_ups
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP TRIGGER IF EXISTS update_manual_follow_ups_updated_at ON public.manual_follow_ups;
CREATE TRIGGER update_manual_follow_ups_updated_at
  BEFORE UPDATE ON public.manual_follow_ups
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.manual_follow_ups IS 'Manager-created queue entries for players that need attention outside automatic cadence/task rules.';
