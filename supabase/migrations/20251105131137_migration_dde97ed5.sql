-- Drop the restrictive SELECT policy
DROP POLICY IF EXISTS "Users can view their own call logs" ON call_logs;

-- Create a new policy that allows all authenticated users to view all call logs
CREATE POLICY "Authenticated users can view all call logs" ON call_logs
  FOR SELECT
  TO public
  USING (auth.uid() IS NOT NULL);