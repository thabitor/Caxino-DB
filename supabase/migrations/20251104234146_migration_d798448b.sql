-- Migrate existing players with VIP level 1 or 2 to random levels 3, 4, or 5
UPDATE players 
SET vip_level = CASE 
  WHEN random() < 0.33 THEN 3
  WHEN random() < 0.66 THEN 4
  ELSE 5
END
WHERE vip_level IN (1, 2);

-- Drop the old constraint
ALTER TABLE players DROP CONSTRAINT IF EXISTS players_vip_level_check;

-- Add new constraint to only allow VIP levels 3, 4, and 5
ALTER TABLE players ADD CONSTRAINT players_vip_level_check CHECK (vip_level >= 3 AND vip_level <= 5);

-- Update default value to 3 instead of 1
ALTER TABLE players ALTER COLUMN vip_level SET DEFAULT 3;