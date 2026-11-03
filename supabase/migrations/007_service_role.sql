-- =============================================================
-- Tennis Simulator — V10 (ajuste, aplicado em 02/11/2026)
-- A função delete-account usa a chave service_role. Neste projeto as tabelas foram
-- criadas sem as permissões padrão para esse papel, então a exclusão de conta falhava.
-- =============================================================
grant select, insert, update, delete on table public.careers, public.shared_careers, public.share_reports to service_role;
