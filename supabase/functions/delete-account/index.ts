// Tennis Simulator — exclui a conta do jogador e todos os dados dele (V10)
// Chamada pelo jogo com o token de quem está logado. Usa a chave service_role,
// que só existe aqui no servidor (variável de ambiente do Supabase), nunca no navegador.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const ALLOWED = [
  "https://tennissimulator.com.br",
  "https://www.tennissimulator.com.br",
  "https://pedrodinaccicelia-max.github.io",
  "http://localhost:8000",
];

function cors(req: Request) {
  const origin = req.headers.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED.includes(origin) ? origin : ALLOWED[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

Deno.serve(async (req: Request) => {
  const headers = { ...cors(req), "Content-Type": "application/json" };
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return reply({ error: "method_not_allowed" }, 405);

  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return reply({ error: "not_authenticated" }, 401);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // confere quem está pedindo pelo próprio token (ninguém exclui a conta de outra pessoa)
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return reply({ error: "not_authenticated" }, 401);

  const body = await req.json().catch(() => ({}));
  if (body?.confirm !== "EXCLUIR") return reply({ error: "confirmation_required" }, 400);

  // dados do jogo (as chaves estrangeiras também apagam em cascata; aqui fica explícito)
  for (const [table, column] of [["share_reports", "reporter"], ["shared_careers", "user_id"], ["careers", "user_id"]]) {
    const { error } = await admin.from(table).delete().eq(column, user.id);
    if (error) return reply({ error: "data_delete_failed", table }, 500);
  }

  // por fim, o login (e-mail, Google, sessões)
  const { error: delError } = await admin.auth.admin.deleteUser(user.id);
  if (delError) return reply({ error: "user_delete_failed" }, 500);

  return reply({ ok: true });
});
