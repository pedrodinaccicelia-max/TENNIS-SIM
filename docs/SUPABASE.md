# Configurar o Supabase

Projeto: `rgyraqbvidnzzapdvrhm` (`https://rgyraqbvidnzzapdvrhm.supabase.co`)

Enquanto a chave pública não estiver no `js/config.js`, o jogo funciona só no modo convidado (como antes). Depois dos passos abaixo, aparecem a tela inicial, o login por e-mail e a lista "Minhas carreiras".

## 1. Criar a tabela de carreiras

1. No painel do Supabase, abra **SQL Editor** e clique em **New query**.
2. Cole todo o conteúdo de [`supabase/migrations/001_careers.sql`](../supabase/migrations/001_careers.sql).
3. Clique em **Run**. Deve aparecer "Success. No rows returned".

Isso cria a tabela `careers` com as regras de segurança: cada jogador só lê, cria, altera e apaga as próprias carreiras. Também limita cada jogador a 200 carreiras salvas.

> **Estado atual do projeto `rgyraqbvidnzzapdvrhm`:** os scripts 001 a 006 já estão aplicados (002 e 003 pelo conector do Supabase em 29/10/2026; 004, do modo Trivia, em 01/11/2026). Um projeto novo precisa do `001_careers.sql`, do `004_trivia.sql` do `005_comunidade.sql` e do `006_convidados.sql` (005 e 006 aplicados em 01/11/2026).

## 2. Formas de login

O jogo oferece **Entrar com Google** e **e-mail e senha**. Ele lê do próprio Supabase o que está ligado: o botão do Google só aparece quando o provedor Google estiver ativado.

### Endereços (obrigatório)
**Authentication > URL Configuration**
- **Site URL:** `https://pedrodinaccicelia-max.github.io/TENNIS-SIM/`
- **Redirect URLs:** o mesmo endereço e, para testes no computador, `http://localhost:8000/`

### E-mail e senha
**Authentication > Sign In / Providers > Email**
- **Enable Email provider:** ligado.
- **Confirm email:**
  - **Desligado (recomendado agora):** a conta é criada e a pessoa entra na hora, sem nenhum e-mail. Não esbarra no limite de 2 e-mails por hora do envio padrão.
  - **Ligado:** depois de criar a conta, a pessoa precisa clicar no link de confirmação antes de entrar. Só vale a pena com um SMTP próprio configurado.
- **Minimum password length:** 8 (o jogo já exige 8).

"Esqueci a senha" manda um e-mail com link para criar uma senha nova. Esse e-mail usa o mesmo envio padrão (limitado a poucos por hora); para o público, configure um SMTP próprio.

### Entrar com Google
1. Acesse <https://console.cloud.google.com> e crie um projeto (ex.: "Tennis Simulator").
2. **Google Auth Platform > Branding** (ou "Tela de consentimento OAuth"): nome do app, e-mail de suporte e e-mail de contato. Em **Audience**, escolha **External** e depois **Publish app**, para que qualquer pessoa consiga entrar (sem publicar, só os "usuários de teste" conseguem).
3. **Google Auth Platform > Clients > Create client**:
   - Tipo: **Web application**
   - **Authorized JavaScript origins:** `https://pedrodinaccicelia-max.github.io`
   - **Authorized redirect URIs:** `https://rgyraqbvidnzzapdvrhm.supabase.co/auth/v1/callback`
4. Copie o **Client ID** e o **Client secret**.
5. No Supabase: **Authentication > Sign In / Providers > Google**, ative, cole os dois valores e salve.

Pronto: o botão "Entrar com Google" aparece sozinho no jogo. O Client secret fica só no painel do Supabase; não precisa ir para o código.

## 3. Chave pública (anon)

1. **Project Settings > API Keys**: copie a chave **anon / public**.
2. Cole em `js/config.js`, no campo `supabaseAnonKey`.

Essa chave pode ficar no código: a segurança está nas regras do banco. **Nunca** use nem publique a chave `service_role`.

## 4. Testar

O login não funciona abrindo o `index.html` direto do disco. Use o site publicado ou um servidor local:

```bash
python -m http.server 8000
# abra http://localhost:8000
```

Crie uma conta com e-mail e senha (ou use o Google) e você cai em "Minhas carreiras".

## Para abrir ao público (depois)

- **E-mails:** o envio padrão do Supabase permite cerca de 2 e-mails por hora e só entrega para os e-mails da equipe do projeto. Para confirmação de cadastro e "esqueci a senha" com o público, configure um SMTP próprio em **Authentication > Emails > SMTP Settings** (Gmail com senha de app, Resend ou Brevo).
- **Texto dos e-mails:** em **Authentication > Emails > Templates** (Confirm signup, Reset password) dá para traduzir as mensagens para português.
- **Plano grátis:** o projeto pausa depois de cerca de 1 semana sem uso; é só reativar no painel.

## Como o jogo usa o banco

| Ação no jogo | O que acontece |
|---|---|
| Criar carreira (logado) | Cria uma linha em `careers` (`mode` = `full` ou `trivia`) |
| Decisões, temporadas, avançar, aposentar | Atualiza a linha (agrupa mudanças rápidas, ~1 s) |
| Minhas carreiras | Lista as carreiras do jogador (favoritas primeiro) |
| Continuar / Ver resumo | Carrega o estado completo e retoma de onde parou |
| Estrela | Marca ou desmarca como favorita |
| Apagar | Remove a carreira (com confirmação) |
| Entrar com uma carreira de convidado no aparelho | Oferece salvá-la na conta |
| Compartilhar na Comunidade (carreira encerrada) | Cria uma linha em `shared_careers` com a foto da carreira; só o dono, só se a carreira estiver aposentada e não tiver vindo do modo convidado (`from_guest`) |
| Comunidade e link `#c-…` | Qualquer pessoa lê `shared_careers` (sem `user_id`, denúncias ou ocultação) |
| Tirar da Comunidade / apagar a carreira | Apaga a linha em `shared_careers` |
| Denunciar | Cria uma linha em `share_reports`; com 3 denúncias a carreira fica oculta (`hidden`) |

Para revisar uma carreira ocultada: **Table Editor > shared_careers**, filtre `hidden = true`, confira e mude para `false` (ou apague a linha).
