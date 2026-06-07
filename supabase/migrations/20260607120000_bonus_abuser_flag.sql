alter table public.players
add column if not exists bonus_abuser boolean not null default false,
add column if not exists bonus_abuser_marked_at timestamptz;

create index if not exists players_bonus_abuser_idx
on public.players (bonus_abuser)
where bonus_abuser = true;
