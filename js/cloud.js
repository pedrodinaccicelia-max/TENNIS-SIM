/* ============ Tennis Simulator — contas e carreiras na nuvem (Supabase) ============ */
const Cloud = (() => {
  const cfg = window.TENNIS_CONFIG || {};
  const enabled = !!(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase && window.supabase.createClient);
  let client = null;
  const TABLE = 'careers';
  const LIST_COLS = 'id,name,nat,status,retired,favorite,seasons,age,ovr,majors,titles,best_rank,mode,accuracy,updated_at';

  // Mensagens de erro em português, sem expor detalhes técnicos
  function friendly(err) {
    const m = (err && (err.message || err.error_description || String(err))) || '';
    if (/email rate limit|over_email_send_rate/i.test(m) || (err && err.code === 'over_email_send_rate_limit')) return 'O servidor atingiu o limite de e-mails de login por hora. Tente de novo mais tarde ou jogue como convidado por enquanto.';
    if (/security purposes|only request this after/i.test(m)) return 'Você acabou de pedir um link. Espere cerca de 1 minuto antes de pedir outro.';
    if (/rate limit|too many/i.test(m)) return 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.';
    if (/invalid login credentials/i.test(m)) return 'E-mail ou senha incorretos.';
    if (/email not confirmed/i.test(m)) return 'Confirme o seu e-mail pelo link que enviamos antes de entrar.';
    if (/already registered|already been registered|user already exists/i.test(m)) return 'Já existe uma conta com esse e-mail. Use "Entrar" com a sua senha.';
    if (/password should be|password.*(at least|characters)|weak.?password/i.test(m)) return 'A senha precisa ter pelo menos 8 caracteres.';
    if (/same password|different from the old/i.test(m)) return 'A nova senha precisa ser diferente da anterior.';
    if (/provider is not enabled|unsupported provider/i.test(m)) return 'O login com Google ainda não está disponível.';
    if (/invalid.*email|email.*invalid|unable to validate/i.test(m)) return 'Esse e-mail não parece válido. Confira e tente de novo.';
    if (/limite de 200/i.test(m)) return 'Você atingiu o limite de 200 carreiras salvas. Apague alguma para salvar novas.';
    if (/fetch|network|failed to fetch|load failed/i.test(m)) return 'Sem conexão com o servidor. Verifique a internet e tente de novo.';
    if (/42501|permission denied|row-level security/i.test(m) || (err && err.code === '42501')) return 'O banco recusou salvar (permissões da tabela). Avise o administrador do jogo.';
    if (/PGRST205|42P01|does not exist|could not find the table/i.test(m) || (err && err.code === 'PGRST205')) return 'O banco ainda não está configurado (tabela de carreiras não encontrada).';
    if (/jwt|not authenticated/i.test(m)) return 'Sua sessão expirou. Entre de novo com o seu e-mail.';
    return 'Algo deu errado ao falar com o servidor. Tente de novo em instantes.';
  }
  const check = ({ data, error }) => { if (error) throw new Error(friendly(error)); return data; };

  function init(onAuth) {
    if (!enabled) return Promise.resolve(null);
    client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    client.auth.onAuthStateChange((event, session) => onAuth(session ? session.user : null, event));
    return client.auth.getSession().then(({ data }) => (data && data.session ? data.session.user : null));
  }

  const here = () => location.origin + location.pathname;

  // Quais formas de login o projeto tem ligadas (lido do próprio Supabase)
  async function providers() {
    try {
      const r = await fetch(cfg.supabaseUrl + '/auth/v1/settings', { headers: { apikey: cfg.supabaseAnonKey } });
      const j = await r.json();
      return { google: !!(j.external && j.external.google), email: !(j.external && j.external.email === false), autoconfirm: !!j.mailer_autoconfirm };
    } catch (e) { return { google: false, email: true, autoconfirm: false }; }
  }
  async function signInPassword(email, password) {
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw new Error(friendly(error));
  }
  // devolve true se já entrou direto (confirmação de e-mail desligada) ou false se precisa confirmar
  async function signUp(email, password) {
    const { data, error } = await client.auth.signUp({ email, password, options: { emailRedirectTo: here() } });
    if (error) throw new Error(friendly(error));
    if (data && data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0)
      throw new Error('Já existe uma conta com esse e-mail. Use "Entrar" com a sua senha.');
    return !!(data && data.session);
  }
  async function signInGoogle() {
    const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: here() } });
    if (error) throw new Error(friendly(error));
  }
  async function resetPassword(email) {
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: here() });
    if (error) throw new Error(friendly(error));
  }
  async function updatePassword(password) {
    const { error } = await client.auth.updateUser({ password });
    if (error) throw new Error(friendly(error));
  }
  async function signOut() { await client.auth.signOut(); }

  async function list() {
    return check(await client.from(TABLE).select(LIST_COLS).order('updated_at', { ascending: false }));
  }
  async function load(id) {
    return check(await client.from(TABLE).select('id,state').eq('id', id).single());
  }
  // cria (sem id) ou atualiza (com id); devolve o id
  async function save(id, row) {
    if (id) { check(await client.from(TABLE).update(row).eq('id', id)); return id; }
    const data = check(await client.from(TABLE).insert(row).select('id').single());
    return data.id;
  }
  async function remove(id) { check(await client.from(TABLE).delete().eq('id', id)); }
  async function setFavorite(id, favorite) { check(await client.from(TABLE).update({ favorite }).eq('id', id)); }

  return { enabled, init, providers, signInPassword, signUp, signInGoogle, resetPassword, updatePassword, signOut, list, load, save, remove, setFavorite };
})();
