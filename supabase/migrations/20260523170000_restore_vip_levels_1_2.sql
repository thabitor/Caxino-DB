ALTER TABLE public.players
DROP CONSTRAINT IF EXISTS players_vip_level_check;

ALTER TABLE public.players
ADD CONSTRAINT players_vip_level_check CHECK (vip_level >= 1 AND vip_level <= 5);

ALTER TABLE public.players
ALTER COLUMN vip_level SET DEFAULT 1;

COMMENT ON COLUMN public.players.vip_level IS 'VIP tier from 1 to 5. Levels 1 and 2 are supported for lower-tier VIP tracking and downgrade workflows.';
