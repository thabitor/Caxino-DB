-- Drop the existing check constraint
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;

-- Add the new check constraint with 'in_progress' included
ALTER TABLE tasks ADD CONSTRAINT tasks_status_check 
  CHECK (status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text]));