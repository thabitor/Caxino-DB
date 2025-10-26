-- Create players table
CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  firstname TEXT NOT NULL,
  lastname TEXT NOT NULL,
  dob DATE,
  gender TEXT CHECK (gender IN ('male', 'female', 'other')),
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  casino TEXT,
  vip_level INTEGER CHECK (vip_level BETWEEN 1 AND 5) DEFAULT 1,
  total_deposits DECIMAL(10, 2) DEFAULT 0.00,
  last_email_sent TIMESTAMP WITH TIME ZONE,
  preferences JSONB DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
  status TEXT CHECK (status IN ('pending', 'completed', 'cancelled')) DEFAULT 'pending',
  due_date TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_players_vip_level ON players(vip_level);
CREATE INDEX IF NOT EXISTS idx_players_email ON players(email);
CREATE INDEX IF NOT EXISTS idx_players_username ON players(username);
CREATE INDEX IF NOT EXISTS idx_tasks_player_id ON tasks(player_id);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

-- Enable Row Level Security
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for players table (allow all operations for now)
CREATE POLICY "Enable all operations for players" ON players
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create RLS policies for tasks table (allow all operations for now)
CREATE POLICY "Enable all operations for tasks" ON tasks
  FOR ALL
  USING (true)
  WITH CHECK (true);