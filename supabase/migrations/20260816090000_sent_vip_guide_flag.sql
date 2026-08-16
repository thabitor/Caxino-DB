alter table public.players
add column if not exists sent_vip_guide boolean not null default false;

create index if not exists players_sent_vip_guide_idx
on public.players (sent_vip_guide)
where sent_vip_guide = true;
