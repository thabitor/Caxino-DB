-- Add preferred time from and to columns to players table
ALTER TABLE players 
ADD COLUMN IF NOT EXISTS preferred_time_from INTEGER,
ADD COLUMN IF NOT EXISTS preferred_time_to INTEGER;

-- Add check constraints to ensure values are between 9 and 21
ALTER TABLE players
ADD CONSTRAINT preferred_time_from_range CHECK (preferred_time_from IS NULL OR (preferred_time_from >= 9 AND preferred_time_from <= 21)),
ADD CONSTRAINT preferred_time_to_range CHECK (preferred_time_to IS NULL OR (preferred_time_to >= 9 AND preferred_time_to <= 21));

-- Add comment for clarity
COMMENT ON COLUMN players.preferred_time_from IS 'Preferred contact time start hour (9-21)';
COMMENT ON COLUMN players.preferred_time_to IS 'Preferred contact time end hour (9-21)';