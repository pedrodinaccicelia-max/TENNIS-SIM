/*
 * Configuração pública do Supabase.
 * A chave "anon" é feita para ficar no navegador: a segurança fica nas regras
 * do banco (Row Level Security em supabase/migrations/001_careers.sql).
 * NUNCA coloque aqui a chave "service_role".
 *
 * Onde achar: painel do Supabase > Project Settings > API Keys > anon / public.
 * Enquanto supabaseAnonKey estiver vazia, o jogo funciona só no modo convidado.
 */
window.TENNIS_CONFIG = {
  supabaseUrl: 'https://rgyraqbvidnzzapdvrhm.supabase.co',
  supabaseAnonKey: '',
};
