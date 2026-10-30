# Configurar o Supabase

Projeto: `rgyraqbvidnzzapdvrhm` (`https://rgyraqbvidnzzapdvrhm.supabase.co`)

Enquanto a chave pública não estiver no `js/config.js`, o jogo funciona só no modo convidado (como antes). Depois dos passos abaixo, aparecem a tela inicial, o login por e-mail e a lista "Minhas carreiras".

## 1. Criar a tabela de carreiras

1. No painel do Supabase, abra **SQL Editor** e clique em **New query**.
2. Cole todo o conteúdo de [`supabase/migrations/001_careers.sql`](../supabase/migrations/001_careers.sql).
3. Clique em **Run**. Deve aparecer "Success. No rows returned".

Isso cria a tabela `careers` com as regras de segurança: cada jogador só lê, cria, altera e apaga as próprias carreiras. Também limita cada jogador a 200 carreiras salvas.

## 2. Login por e-mail

1. **Authentication > Sign In / Providers**: confirme que **Email** está ativado (vem ativado por padrão).
2. **Authentication > URL Configuration**:
   - **Site URL**: o endereço onde o jogo vai ficar no ar. Com GitHub Pages: `https://pedrodinaccicelia-max.github.io/TENNIS-SIM/`
   - **Redirect URLs**: adicione o mesmo endereço e, para testar no computador, `http://localhost:8000/`

O link de acesso que chega por e-mail só funciona se o endereço do jogo estiver nessa lista.

## 3. Chave pública (anon)

1. **Project Settings > API Keys**: copie a chave **anon / public**.
2. Cole em `js/config.js`, no campo `supabaseAnonKey`.

Essa chave pode ficar no código: a segurança está nas regras do banco. **Nunca** use nem publique a chave `service_role`.

## 4. Testar

O login não funciona abrindo o `index.html` direto do disco. Use um servidor local:

```bash
python -m http.server 8000
# abra http://localhost:8000
```

Digite seu e-mail, abra o link que chegar no mesmo navegador e você cai em "Minhas carreiras".

## Para abrir ao público (depois)

- **E-mails:** o envio padrão do Supabase permite poucos e-mails por hora. Para muitos jogadores, configure um SMTP próprio (por exemplo, Resend) em **Authentication > Emails > SMTP Settings**.
- **Texto do e-mail:** em **Authentication > Emails > Templates > Magic Link** dá para traduzir a mensagem para português.
- **Plano grátis:** o projeto pausa depois de cerca de 1 semana sem uso; é só reativar no painel.

## Como o jogo usa o banco

| Ação no jogo | O que acontece |
|---|---|
| Criar carreira (logado) | Cria uma linha em `careers` |
| Decisões, temporadas, avançar, aposentar | Atualiza a linha (agrupa mudanças rápidas, ~1 s) |
| Minhas carreiras | Lista as carreiras do jogador (favoritas primeiro) |
| Continuar / Ver resumo | Carrega o estado completo e retoma de onde parou |
| Estrela | Marca ou desmarca como favorita |
| Apagar | Remove a carreira (com confirmação) |
| Entrar com uma carreira de convidado no aparelho | Oferece salvá-la na conta |
