-- =============================================================
-- Tennis Simulator — V10 (ajuste): carreiras de convidado não vão para a Comunidade
-- (aplicado em 01/11/2026)
-- * Carreira de convidado levada para a conta ("Salvar na minha conta") fica marcada com from_guest.
-- * O jogador não consegue mudar essa marca (update só nas colunas que o jogo usa).
-- * Publicar exige carreira criada com a conta: from_guest = false e state.createdAs diferente de 'guest'.
-- =============================================================
alter table public.careers add column if not exists from_guest boolean not null default false;

revoke update on table public.careers from authenticated;
grant update (name, nat, status, retired, favorite, seasons, age, ovr, majors, titles, best_rank, game_version, state, mode, accuracy)
  on public.careers to authenticated;

drop policy if exists "comunidade: dono publica carreira encerrada" on public.shared_careers;
create policy "comunidade: dono publica carreira encerrada" on public.shared_careers
  for insert to authenticated with check (
    user_id = auth.uid()
    and coalesce(state ->> 'createdAs', '') <> 'guest'
    and exists (select 1 from public.careers c where c.id = career_id and c.user_id = auth.uid() and c.retired and not c.from_guest)
  );
