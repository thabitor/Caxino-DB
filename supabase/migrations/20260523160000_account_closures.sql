ALTER TABLE public.players
ADD COLUMN IF NOT EXISTS account_closure_reason TEXT,
ADD COLUMN IF NOT EXISTS account_closure_type TEXT,
ADD COLUMN IF NOT EXISTS account_closure_until TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS account_closed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS account_reopened_at TIMESTAMPTZ;

ALTER TABLE public.players
DROP CONSTRAINT IF EXISTS players_account_closure_reason_check,
ADD CONSTRAINT players_account_closure_reason_check
  CHECK (
    account_closure_reason IS NULL OR
    account_closure_reason IN ('GA', 'Self harm', 'RG', 'QL', 'LT', 'Normal')
  );

ALTER TABLE public.players
DROP CONSTRAINT IF EXISTS players_account_closure_type_check,
ADD CONSTRAINT players_account_closure_type_check
  CHECK (
    account_closure_type IS NULL OR
    account_closure_type IN ('break', 'permanent')
  );

CREATE INDEX IF NOT EXISTS idx_players_account_closure
ON public.players(account_status, account_closure_type, account_closure_until);

COMMENT ON COLUMN public.players.account_closure_reason IS 'Reason for account closure: GA, Self harm, RG, QL, LT, or Normal.';
COMMENT ON COLUMN public.players.account_closure_type IS 'Closure type: temporary break or permanent closure.';
COMMENT ON COLUMN public.players.account_closure_until IS 'End date for temporary account breaks; account remains closed until explicitly reopened.';
COMMENT ON COLUMN public.players.account_closed_at IS 'Timestamp when the account was marked closed.';
COMMENT ON COLUMN public.players.account_reopened_at IS 'Timestamp when a temporary closure was reopened.';
