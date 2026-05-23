CREATE TABLE IF NOT EXISTS public.follow_up_viewed_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  manager_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  last_viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (player_id, manager_id)
);

CREATE INDEX IF NOT EXISTS idx_follow_up_viewed_players_player_id ON public.follow_up_viewed_players(player_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_viewed_players_manager_id ON public.follow_up_viewed_players(manager_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_viewed_players_last_viewed_at ON public.follow_up_viewed_players(last_viewed_at);

ALTER TABLE public.follow_up_viewed_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage follow up viewed players" ON public.follow_up_viewed_players
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP TRIGGER IF EXISTS update_follow_up_viewed_players_updated_at ON public.follow_up_viewed_players;
CREATE TRIGGER update_follow_up_viewed_players_updated_at
  BEFORE UPDATE ON public.follow_up_viewed_players
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.follow_up_viewed_players IS 'Stores the last time a manager opened a player follow-up. Entries older than one month are cleaned up by the app.';
