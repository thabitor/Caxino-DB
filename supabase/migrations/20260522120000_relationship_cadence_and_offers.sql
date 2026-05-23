-- Relationship cadence and offer tracking foundation.
-- This is intentionally additive so existing deployments keep working.

ALTER TABLE public.players
ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS contact_cadence_days INTEGER,
ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS next_contact_due_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS relationship_status TEXT,
ADD COLUMN IF NOT EXISTS last_offer_sent_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

ALTER TABLE public.players
DROP CONSTRAINT IF EXISTS players_contact_cadence_days_check,
ADD CONSTRAINT players_contact_cadence_days_check
  CHECK (contact_cadence_days IS NULL OR contact_cadence_days BETWEEN 1 AND 180);

ALTER TABLE public.players
DROP CONSTRAINT IF EXISTS players_relationship_status_check,
ADD CONSTRAINT players_relationship_status_check
  CHECK (
    relationship_status IS NULL OR
    relationship_status IN ('healthy', 'due_soon', 'due_today', 'overdue', 'needs_attention')
  );

UPDATE public.players
SET contact_cadence_days = CASE
  WHEN vip_level >= 5 THEN 7
  WHEN vip_level = 4 THEN 14
  ELSE 30
END
WHERE contact_cadence_days IS NULL;

UPDATE public.players p
SET last_contacted_at = latest.completed_at
FROM (
  SELECT player_id, MAX(COALESCE(completed_at, call_time)) AS completed_at
  FROM public.call_logs
  GROUP BY player_id
) latest
WHERE p.id = latest.player_id
  AND p.last_contacted_at IS NULL;

UPDATE public.players
SET next_contact_due_at = COALESCE(last_contacted_at, created_at, NOW()) + (contact_cadence_days || ' days')::interval
WHERE next_contact_due_at IS NULL
  AND contact_cadence_days IS NOT NULL;

UPDATE public.players
SET relationship_status = CASE
  WHEN next_contact_due_at < NOW() THEN 'overdue'
  WHEN next_contact_due_at::date = CURRENT_DATE THEN 'due_today'
  WHEN next_contact_due_at <= NOW() + INTERVAL '3 days' THEN 'due_soon'
  ELSE 'healthy'
END
WHERE relationship_status IS NULL
  AND next_contact_due_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.offer_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  manager_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  offer_type TEXT NOT NULL,
  offer_summary TEXT,
  channel TEXT CHECK (channel IS NULL OR channel IN ('phone', 'email', 'sms', 'chat', 'other')),
  outcome TEXT CHECK (outcome IS NULL OR outcome IN ('offered', 'accepted', 'declined', 'no_response', 'follow_up_needed')),
  offered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  follow_up_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.player_touchpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  manager_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  touchpoint_type TEXT NOT NULL CHECK (touchpoint_type IN ('call', 'email', 'offer', 'note', 'task', 'birthday', 'other')),
  title TEXT NOT NULL,
  body TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_table TEXT,
  source_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_players_manager_id ON public.players(manager_id);
CREATE INDEX IF NOT EXISTS idx_players_next_contact_due_at ON public.players(next_contact_due_at);
CREATE INDEX IF NOT EXISTS idx_players_relationship_status ON public.players(relationship_status);
CREATE INDEX IF NOT EXISTS idx_offer_logs_player_id ON public.offer_logs(player_id);
CREATE INDEX IF NOT EXISTS idx_offer_logs_manager_id ON public.offer_logs(manager_id);
CREATE INDEX IF NOT EXISTS idx_offer_logs_follow_up_at ON public.offer_logs(follow_up_at);
CREATE INDEX IF NOT EXISTS idx_player_touchpoints_player_id ON public.player_touchpoints(player_id);
CREATE INDEX IF NOT EXISTS idx_player_touchpoints_occurred_at ON public.player_touchpoints(occurred_at);

ALTER TABLE public.offer_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_touchpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage offer logs" ON public.offer_logs
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can manage player touchpoints" ON public.player_touchpoints
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP TRIGGER IF EXISTS update_offer_logs_updated_at ON public.offer_logs;
CREATE TRIGGER update_offer_logs_updated_at
  BEFORE UPDATE ON public.offer_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON COLUMN public.players.contact_cadence_days IS 'Target number of days between relationship contacts.';
COMMENT ON COLUMN public.players.next_contact_due_at IS 'Computed or manually adjusted next relationship contact due date.';
COMMENT ON COLUMN public.players.relationship_status IS 'Cached relationship health state for dashboard filtering.';
COMMENT ON TABLE public.offer_logs IS 'Manual offer history when external offer systems cannot be integrated.';
COMMENT ON TABLE public.player_touchpoints IS 'Unified relationship timeline events across calls, offers, notes, tasks, and external context.';
