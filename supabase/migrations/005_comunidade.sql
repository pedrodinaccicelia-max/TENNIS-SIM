-- =============================================================
-- Tennis Simulator — V10: carreiras compartilhadas e Comunidade (aplicado em 01/11/2026)
-- * Só carreiras encerradas (aposentadas) podem ser compartilhadas, uma vez cada.
-- * Qualquer pessoa (mesmo sem login) vê as carreiras compartilhadas que não foram ocultadas.
-- * Só o dono publica ou tira da comunidade. Quem está logado pode denunciar;
--   com 3 denúncias a carreira some da comunidade até revisão.
-- =============================================================

create table if not exists public.shared_careers (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  career_id   uuid not null unique references public.careers (id) on delete cascade,
  mode        text not null default 'full' check (mode in ('full', 'trivia')),
  name        text not null check (char_length(name) between 1 and 40),
  nat         text,
  status      text,
  status_key  text,
  majors      integer not null default 0,
  titles      integer not null default 0,
  best_rank   integer,
  accuracy    real check (accuracy is null or (accuracy >= 0 and accuracy <= 1)),
  seasons     integer not null default 0,
  first_year  integer,
  last_year   integer,
  game_version integer not null default 10,
  state       jsonb not null,            -- foto da carreira encerrada (para montar o resumo)
  reports     integer not null default 0,
  hidden      boolean not null default false,
  created_at  timestamptz not null default now(),
  constraint shared_state_size check (pg_column_size(state) < 1000000),
  constraint shared_state_retired check ((state ->> 'retired') = 'true')
);
create index if not exists shared_recent_idx on public.shared_careers (created_at desc) where not hidden;
create index if not exists shared_majors_idx on public.shared_careers (majors desc, created_at desc) where not hidden;
create index if not exists shared_user_idx on public.shared_careers (user_id);

alter table public.shared_careers enable row level security;

drop policy if exists "comunidade: todos veem" on public.shared_careers;
create policy "comunidade: todos veem" on public.shared_careers
  for select to anon, authenticated using (not hidden or user_id = auth.uid());

drop policy if exists "comunidade: dono publica carreira encerrada" on public.shared_careers;
create policy "comunidade: dono publica carreira encerrada" on public.shared_careers
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (select 1 from public.careers c where c.id = career_id and c.user_id = auth.uid() and c.retired)
  );

drop policy if exists "comunidade: dono tira do ar" on public.shared_careers;
create policy "comunidade: dono tira do ar" on public.shared_careers
  for delete to authenticated using (user_id = auth.uid());

-- quem não é dono não vê user_id, denúncias nem o campo de ocultação
revoke all on table public.shared_careers from anon, authenticated;
grant select (id, career_id, mode, name, nat, status, status_key, majors, titles, best_rank, accuracy, seasons,
              first_year, last_year, game_version, state, created_at) on public.shared_careers to anon, authenticated;
grant insert (career_id, mode, name, nat, status, status_key, majors, titles, best_rank, accuracy, seasons,
              first_year, last_year, game_version, state) on public.shared_careers to authenticated;
grant delete on public.shared_careers to authenticated;

-- ---------- denúncias ----------
create table if not exists public.share_reports (
  id          uuid primary key default gen_random_uuid(),
  share_id    uuid not null references public.shared_careers (id) on delete cascade,
  reporter    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  reason      text check (reason is null or char_length(reason) <= 200),
  created_at  timestamptz not null default now(),
  unique (share_id, reporter)
);
alter table public.share_reports enable row level security;
-- função auxiliar fora da API (esquema private): quem denuncia não pode ler user_id,
-- então a checagem "não é o dono" roda aqui com permissão elevada
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
create or replace function private.is_my_share(sid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.shared_careers where id = sid and user_id = auth.uid());
$$;
revoke execute on function private.is_my_share(uuid) from public, anon;
grant execute on function private.is_my_share(uuid) to authenticated;
drop policy if exists "denúncia: quem está logado denuncia" on public.share_reports;
create policy "denúncia: quem está logado denuncia" on public.share_reports
  for insert to authenticated with check (reporter = auth.uid() and not private.is_my_share(share_id));
revoke all on table public.share_reports from anon, authenticated;
grant insert (share_id, reason) on public.share_reports to authenticated;

-- conta as denúncias e oculta a carreira a partir de 3
create or replace function public.share_reports_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.shared_careers
     set reports = reports + 1, hidden = hidden or (reports + 1) >= 3
   where id = new.share_id;
  return new;
end $$;
revoke execute on function public.share_reports_count() from public, anon, authenticated;
drop trigger if exists share_reports_count on public.share_reports;
create trigger share_reports_count after insert on public.share_reports
for each row execute function public.share_reports_count();
