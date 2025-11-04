-- Add call-specific fields to tasks table
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS is_call BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS phone_number TEXT,
ADD COLUMN IF NOT EXISTS call_topic TEXT;

-- Create call_logs table to track completed calls
CREATE TABLE IF NOT EXISTS call_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  phone_number TEXT NOT NULL,
  call_topic TEXT,
  call_time TIMESTAMP WITH TIME ZONE NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT,
  duration_minutes INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on call_logs
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for call_logs
CREATE POLICY "Users can view their own call logs" ON call_logs 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own call logs" ON call_logs 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own call logs" ON call_logs 
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own call logs" ON call_logs 
  FOR DELETE USING (auth.uid() = user_id);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_call_logs_user_id ON call_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_player_id ON call_logs(player_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_call_time ON call_logs(call_time);