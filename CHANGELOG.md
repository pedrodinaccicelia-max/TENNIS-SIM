# Histórico de versões

O detalhamento de cada versão está nos documentos de [`docs/regras/`](docs/regras/).

## V10: Comunidade
- Carreiras encerradas (aposentadas) podem ser compartilhadas: o resumo ganha o bloco "Compartilhar na Comunidade", com link próprio e opção de tirar do ar.
- Página **Comunidade** (botão no topo e link `#comunidade`): carreiras compartilhadas dos dois modos, com filtro por modo e ordem (mais recentes, mais Grand Slams, mais títulos, melhor ranking, melhor acerto no Trivia).
- Link da carreira (`#c-…`) abre o resumo completo para qualquer pessoa, mesmo sem login. A revisão das perguntas erradas do Trivia fica de fora.
- Moderação: nomes ofensivos não são publicados, quem está logado pode denunciar e, com 3 denúncias, a carreira sai da Comunidade.
- "Minhas carreiras" mostra o selo "Na Comunidade". Imagem e texto de prévia para quando o link do jogo é colado no WhatsApp ou numa rede social.
- Supabase: tabelas `shared_careers` e `share_reports` (migração 005).

## V9: Trivia mais direto
- Layout vertical no Trivia: cartão do jogador no topo, painel da pergunta centralizado e a tabela temporada a temporada embaixo (o FULL Sim não mudou).
- No PC, as 4 alternativas ficam em duas colunas; a trilha das rodadas marca em vermelho a rodada em que você caiu.
- Criação do Trivia só com nome e nacionalidade; toda carreira começa aos 19 anos (2026).
- Em "Minhas carreiras", as carreiras do Trivia aparecem com fundo azul.

## V8: modo Trivia
- Novo modo de jogo **Trivia**, escolhido na criação da carreira (o jogo de antes passa a se chamar **FULL Sim**).
- Cada rodada é uma pergunta de 4 alternativas; errar ou deixar o tempo acabar elimina do torneio.
- Tempo por rodada: 30, 26, 22, 19, 16, 13 e 10 segundos (R1 até a final); no ATP Finals, 16 s nos grupos, 13 s na semi e 10 s na final.
- Dificuldade cresce com a rodada; nos Slams, parte das perguntas é sobre o próprio torneio.
- Banco com cerca de 2.300 perguntas (finais de Grand Slam da Era Aberta, ATP/WTA Finals, Copa Davis, números 1 do ranking e perguntas escritas à mão). Nenhuma se repete na mesma carreira.
- **Pergunta Bônus:** aparece de surpresa (7% antes de cada partida, no máximo 1 por torneio), 10 s, muito difícil. Acertou: 3 vitórias garantidas. Errou: 2 derrotas. Pode ser recusada.
- Sem OVR, eventos, lesões ou rivais. Aposentadoria a partir dos 30 e obrigatória aos 38.
- Resumo da carreira com o desempenho no Trivia (acertos por dificuldade, rodada e tema, tempos, Pergunta Bônus e revisão das perguntas erradas) e 6 tags próprias.
- "Minhas carreiras" mostra o modo e o aproveitamento de cada carreira (colunas `mode` e `accuracy` no Supabase).

## Contas
- Tela inicial com "Entrar com Google", e-mail e senha (Entrar / Criar conta / Esqueci a senha) ou "Jogar como convidado".
- O botão do Google aparece sozinho quando o provedor estiver ativado no Supabase.
- "Minhas carreiras": lista com favoritas, continuar, ver resumo e apagar.
- Salvamento automático na nuvem (Supabase) a cada decisão e temporada, com indicador no topo.
- Carreira de convidado pode ser levada para a conta ao entrar.

## V7
- Topo da tabela de chance de título recalibrado (OVR 90–99), para que 30+ Grand Slams aconteça em cerca de 0,5% das carreiras.
- Evento especial **Fenix** (33 a 35 anos, para quem nunca passou de 80 de OVR até os 33; 35% no total da faixa).
- Botão de aposentadoria a partir dos 30 anos.
- OVR vivo: durante a temporada, o OVR da linha atual sobe (verde) ou desce (vermelho) conforme o bônus ou a penalidade da superfície.
- Tags novas: Imbatível, Second Best e Mr. Clutch.
- Lista de finais contra o rival retrátil no resumo da carreira.
- No PC, painel mais estreito para a tabela mostrar os 11 torneios sem rolar para o lado.

## V6
- Layout horizontal no PC (cartão do jogador compacto, painel à esquerda, tabela à direita, sem rolagem da página).
- Painel em etapas: decisão → simular → ao vivo → resumo → avançar.
- Resumo de 3 anos no modo Express.

## V5
- Eventos especiais em faixa de idade; Jovem promessa com 3 títulos até os 21 anos.
- Finais contra o rival com placar em 5 sets no resumo.
- Tabela com a temporada mais recente no topo.

## V4
- Anos das finais nos Grand Slams do resumo.
- Eventos especiais (Imortal!, Jovem promessa, MODO PRIME) e tags de carreira e de superfície.
- Modo Express simulando 3 temporadas por vez.

## V3
- Rival a partir do Top 5, com impacto da postura sorteado.
- Temporada revelada torneio a torneio.
- Impossível vencer Grand Slam com OVR abaixo de 75.
- Primeiro documento de regras por versão.

## V2
- Progressão com pesos, odds visíveis nos eventos, Play Style, Treino reforçado temporário e mecânica de rivais.

## V1
- Criação do jogador, simulação de 11 torneios, eventos, lesões, ranking, aposentadoria e resumo da carreira.
