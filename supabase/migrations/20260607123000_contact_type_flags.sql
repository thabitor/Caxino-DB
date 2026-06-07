alter table public.players
add column if not exists contact_email_only boolean not null default false,
add column if not exists telegram_member boolean not null default false;

create index if not exists players_contact_email_only_idx
on public.players (contact_email_only)
where contact_email_only = true;

create index if not exists players_telegram_member_idx
on public.players (telegram_member)
where telegram_member = true;
