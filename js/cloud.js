/* ============ Tennis Simulator — contas e carreiras na nuvem (Supabase) ============ */
const Cloud = (() => {
  const cfg = window.TENNIS_CONFIG || {};
  const enabled = !!(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase && window.supabase.createClient);
  let client = null;
  const TABLE = 'careers';
  const LIST_COLS = 'id,name,nat,status,retired,favorite,seasons,age,ovr,majors,titles,best_rank,updated_at';

  // Mensagens de erro em português, sem expor detalhes técnicos
  function friendly(err) {
    const m = (err && (err.message || err.error_description || String(err))) || '';
    if (/rate limit|too many|security purposes/i.test(m)) return 'Muitas tentativas seguidas. Espere um minuto e tente de novo.';
    if (/invalid.*email|email.*invalid|unable to validate/i.test(m)) return 'Esse e-mail não parece válido. Confira e tente de novo.';
    if (/limite de 200/i.test(m)) return 'Você atingiu o limite de 200 carreiras salvas. Apague alguma para salvar novas.';
    if (/fetch|network|failed to fetch|load failed/i.test(m)) return 'Sem conexão com o servidor. Verifique a internet e tente de novo.';
    if (/jwt|not authenticated|permission|policy/i.test(m)) return 'Sua sessão expirou. Entre de novo com o seu e-mail.';
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

  async function sendLink(email) {
    const redirect = location.origin + location.pathname;
    const { error } = await client.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect } });
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

  return { enabled, init, sendLink, signOut, list, load, save, remove, setFavorite };
})();
