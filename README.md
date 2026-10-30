# Tennis Simulator

Simulador de carreira de tênis no navegador. Você cria o jogador, sorteia o overall e a idade de estreia, escolhe o estilo de jogo e toma as decisões que definem títulos, lesões, rivalidades e o seu lugar no ranking, temporada a temporada, até a aposentadoria.

Funciona no computador e no celular, sem instalar nada.

## Como rodar

O jogo é um site estático (HTML, CSS e JavaScript puro, sem etapa de build).

- **Mais simples:** abra o `index.html` no navegador.
- **Com servidor local** (recomendado quando entrar o login):
  ```bash
  python -m http.server 8000
  # depois abra http://localhost:8000
  ```

Há dois modos de jogo:
- **Convidado:** a carreira fica salva só no navegador (localStorage).
- **Com conta:** entrar com Google ou com e-mail e senha (Supabase) e carreiras salvas na nuvem, com a lista "Minhas carreiras". A configuração está em [`docs/SUPABASE.md`](docs/SUPABASE.md).

## Estrutura

```
index.html            Página do jogo
css/styles.css        Visual (cores, tipografia, layout de PC e celular)
js/config.js          Endereço e chave pública do Supabase
js/engine.js          Motor da simulação: OVR, torneios, ranking, eventos, rivais, tags
js/cloud.js           Login e carreiras na nuvem (Supabase)
js/app.js             Telas e fluxo: tela inicial, criação, painel em etapas, temporada ao vivo, resumo
supabase/migrations/  Estrutura do banco (tabela de carreiras e regras de acesso)
tests/simulacao.js    Simulação em massa para calibrar as probabilidades
docs/regras/          Documento de regras de cada versão (V3 em diante)
docs/referencias/     Regras e telas originais que deram início ao projeto
CHANGELOG.md          O que mudou em cada versão
```

O `engine.js` não depende da interface. Ele roda tanto no navegador quanto no Node, o que permite simular milhares de carreiras:

```bash
node tests/simulacao.js 20000
```

## Regras

As regras completas da versão atual estão em [`docs/regras/`](docs/regras/). Em resumo:

- **Calendário:** 4 Grand Slams, 6 Masters 1000 e o ATP Finals (para o Top 8).
- **Overall (1–99):** define a chance de título; evolui dos 16 aos 22 anos, estabiliza e depois cai com a idade.
- **Play Style:** bônus e penalidades por superfície (rápida, saibro, grama).
- **Eventos:** decisões com odds visíveis, eventos especiais por idade e conquistas, e rivais com finais de Grand Slam decididas pela sua postura.
- **Resumo da carreira:** status (de Ruim a Lenda), tags de conquistas e o histórico completo.

## Próximos passos

- Publicação do site (GitHub Pages ou Vercel).
- SMTP próprio para os e-mails de login e página de privacidade.
