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

A carreira em andamento fica salva no navegador (localStorage).

## Estrutura

```
index.html            Página do jogo
css/styles.css        Visual (cores, tipografia, layout de PC e celular)
js/engine.js          Motor da simulação: OVR, torneios, ranking, eventos, rivais, tags
js/app.js             Telas e fluxo: criação, painel em etapas, temporada ao vivo, resumo
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

- Contas de jogador (login por e-mail) e carreiras salvas na nuvem com Supabase.
- Publicação do site (GitHub Pages ou Vercel).
