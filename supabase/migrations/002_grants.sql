-- =============================================================
-- Tennis Simulator — permissões da tabela de carreiras
-- Projetos novos do Supabase não liberam tabelas novas para a API automaticamente.
-- Sem isto, salvar dá "permission denied for table careers".
-- As regras de Row Level Security (001_careers.sql) continuam valendo:
-- cada jogador só lê e altera as próprias carreiras.
-- Rodar uma vez no SQL Editor.
-- =============================================================

grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.careers to authenticated;
-- visitantes sem login (anon) continuam sem acesso nenhum à tabela
revoke all on table public.careers from anon;
