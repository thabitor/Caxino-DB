alter table public.players
add column if not exists whatsapp_channel boolean not null default false,
add column if not exists novatalks_channel boolean not null default false,
add column if not exists email_channel boolean not null default false;

create index if not exists players_whatsapp_channel_idx
on public.players (whatsapp_channel)
where whatsapp_channel = true;

create index if not exists players_novatalks_channel_idx
on public.players (novatalks_channel)
where novatalks_channel = true;

create index if not exists players_email_channel_idx
on public.players (email_channel)
where email_channel = true;
