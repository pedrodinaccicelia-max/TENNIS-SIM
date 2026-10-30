-- =============================================================
-- Tennis Simulator — carreiras salvas por jogador
-- Rodar uma vez no Supabase: painel do projeto > SQL Editor > New query > colar > Run
-- =============================================================

create table if not exists public.careers (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 40),
  nat         text,
  status      text,                      -- status atual/final (ex.: "Lenda")
  retired     boolean not null default false,
  favorite    boolean not null default false,
  seasons     integer not null default 0,
  age         integer,
  ovr         integer,
  majors      integer not null default 0,
  titles      integer not null default 0,
  best_rank   integer,
  game_version integer not null default 7,
  state       jsonb not null,            -- estado completo da carreira (o jogo recarrega dele)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- evita que uma carreira gigante (ou maliciosa) ocupe o banco
  constraint careers_state_size check (pg_column_size(state) < 1000000)
);

create index if not exists careers_user_updated_idx on public.careers (user_id, updated_at desc);

-- atualiza updated_at a cada alteração
create or replace function public.careers_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists careers_touch_updated_at on public.careers;
create trigger careers_touch_updated_at
before update on public.careers
for each row execute function public.careers_touch_updated_at();

-- limite de carreiras por jogador (protege o plano grátis)
create or replace function public.careers_limit_per_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.careers where user_id = new.user_id) >= 200 then
    raise exception 'Limite de 200 carreiras salvas atingido';
  end if;
  return new;
end $$;

drop trigger if exists careers_limit_per_user on public.careers;
create trigger careers_limit_per_user
before insert on public.careers
for each row execute function public.careers_limit_per_user();

-- ---------- segurança: cada jogador só enxerga e mexe nas próprias carreiras ----------
alter table public.careers enable row level security;

drop policy if exists "careers_select_own" on public.careers;
create policy "careers_select_own" on public.careers
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "careers_insert_own" on public.careers;
create policy "careers_insert_own" on public.careers
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "careers_update_own" on public.careers;
create policy "careers_update_own" on public.careers
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "careers_delete_own" on public.careers;
create policy "careers_delete_own" on public.careers
  for delete to authenticated using (user_id = auth.uid());
