drop index if exists public.idx_players_username;
drop index if exists idx_players_username;
alter table public.players drop column if exists username;
