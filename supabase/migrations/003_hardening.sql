-- =============================================================
-- Tennis Simulator — ajustes de segurança (aplicado em 29/10/2026)
-- Recomendações do Security Advisor do Supabase.
-- =============================================================

-- quem está logado só tem as 4 operações necessárias (sem TRUNCATE etc.)
revoke all on table public.careers from authenticated;
grant select, insert, update, delete on table public.careers to authenticated;

-- funções de gatilho: search_path fixo e fora da API pública
alter function public.careers_touch_updated_at() set search_path = public;
revoke execute on function public.careers_touch_updated_at() from public, anon, authenticated;
revoke execute on function public.careers_limit_per_user() from public, anon, authenticated;
