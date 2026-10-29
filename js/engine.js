/* ============ Tennis Simulator — motor de simulação (V7) ============ */
const Engine = (() => {
  const rnd = Math.random;
  const randInt = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pick = arr => arr[Math.floor(rnd() * arr.length)];
  const shuffle = arr => arr.map(v => [rnd(), v]).sort((a, b) => a[0] - b[0]).map(x => x[1]);

  const TOURNAMENTS = [
    { id: 'AO',  name: 'Australian Open', short: 'AO',  surface: 'hard',  type: 'major' },
    { id: 'IW',  name: 'Indian Wells',    short: 'IW',  surface: 'hard',  type: 'masters' },
    { id: 'MIA', name: 'Miami',           short: 'MIA', surface: 'hard',  type: 'masters' },
    { id: 'MC',  name: 'Monte Carlo',     short: 'MC',  surface: 'clay',  type: 'masters' },
    { id: 'MAD', name: 'Madrid',          short: 'MAD', surface: 'clay',  type: 'masters' },
    { id: 'RG',  name: 'Roland-Garros',   short: 'RG',  surface: 'clay',  type: 'major' },
    { id: 'WIM', name: 'Wimbledon',       short: 'WIM', surface: 'grass', type: 'major' },
    { id: 'CIN', name: 'Cincinnati',      short: 'CIN', surface: 'hard',  type: 'masters' },
    { id: 'USO', name: 'US Open',         short: 'USO', surface: 'hard',  type: 'major' },
    { id: 'SHA', name: 'Shanghai',        short: 'SHA', surface: 'hard',  type: 'masters' },
    { id: 'FIN', name: 'ATP Finals',      short: 'FIN', surface: 'hard',  type: 'finals' },
  ];
  const REGULAR = TOURNAMENTS.filter(t => t.type !== 'finals');
  const SURFACE_NAME = { hard: 'Rápida', clay: 'Saibro', grass: 'Grama' };

  // ---- estilos de jogo (modificadores de OVR por superfície) ----
  const STYLES = {
    allcourt: { name: 'All-Court',     desc: 'Sem bônus e sem penalidade em nenhuma superfície.', mod: { hard: 0, clay: 0, grass: 0 } },
    sv:       { name: 'Saque-Voleio',  desc: 'Domina a grama, sofre no saibro.',                  mod: { hard: 1, clay: -3, grass: 3 } },
    agr:      { name: 'Agressivo',     desc: 'Forte na rápida, perde força no saibro.',           mod: { hard: 2, clay: -2, grass: 1 } },
    def:      { name: 'Defensivo',     desc: 'Especialista no saibro, sofre na grama.',           mod: { hard: -1, clay: 4, grass: -2 } },
  };

  const ROUNDS = ['R1', 'R2', 'R3', 'R16', 'QF', 'SF', 'F', 'W'];
  const POINTS = {
    major:   { R1: 10, R2: 50, R3: 100, R16: 200, QF: 400, SF: 800, F: 1300, W: 2000 },
    masters: { R1: 10, R2: 30, R3: 50,  R16: 100, QF: 200, SF: 400, F: 650,  W: 1000 },
  };
  const PRIZE = { // €
    major:   { R1: 87000, R2: 130000, R3: 187000, R16: 285000, QF: 470000, SF: 750000, F: 1400000, W: 2800000 },
    masters: { R1: 21285, R2: 31585,  R3: 54110,  R16: 92470,  QF: 169375, SF: 297550, F: 535585,  W: 1007165 },
  };
  const FINALS = { rrWinPts: 200, sfWinPts: 400, fWinPts: 500,
                   base: 310000, rrWinPrize: 370000, sfWinPrize: 1030000, fWinPrize: 2060000 };

  // Chance de título (Masters) por overall — tabela do documento de regras
  function titleProbMasters(ovr) {
    if (ovr <= 60) return 0.01;
    if (ovr <= 65) return 0.03;
    if (ovr <= 70) return 0.05;
    if (ovr <= 75) return 0.07;
    if (ovr >= 81 && ovr <= 84) return 0.098;
    // V7: topo recalibrado para que 30+ Grand Slams fique em ~0,5% das carreiras
    return { 76: .079, 77: .081, 78: .085, 79: .089, 80: .093, 85: .11, 86: .137, 87: .17,
             88: .195, 89: .22, 90: .24, 91: .265, 92: .31, 93: .34, 94: .38, 95: .42,
             96: .45, 97: .48, 98: .51, 99: .56 }[ovr];
  }
  function titleProb(ovr, type, partyMod = 1) {
    let p = titleProbMasters(clamp(Math.round(ovr), 1, 99));
    if (type !== 'masters') p = Math.max(0.005, p - 0.025);
    return clamp(p * partyMod, 0.001, 0.95);
  }

  // Ranking: pontos da temporada -> posição (interpolando a tabela do documento)
  const RANK_ANCHORS = [
    [1, 10700], [2, 8700], [3, 7400], [4, 6400], [5, 5600], [6, 4900], [7, 4300], [8, 3800], [9, 3400], [10, 3100],
    [11, 2900], [12, 2700], [13, 2550], [14, 2400], [15, 2300], [16, 2250], [17, 2100], [18, 1950], [19, 1800], [20, 1700],
    [21, 1600], [22, 1500], [23, 1400], [24, 1300], [25, 1200], [26, 1150], [27, 1100], [28, 1050], [29, 1000], [30, 950],
    [50, 450], [100, 150], [200, 30], [500, 5], [900, 1],
  ];
  function pointsForRank(r) {
    for (let i = 0; i < RANK_ANCHORS.length - 1; i++) {
      const [r1, p1] = RANK_ANCHORS[i], [r2, p2] = RANK_ANCHORS[i + 1];
      if (r >= r1 && r <= r2) return p1 + (p2 - p1) * (r - r1) / (r2 - r1);
    }
    return 0;
  }
  function rankFromPoints(pts) {
    if (pts <= 0) return null;
    for (let r = 1; r <= 900; r++) if (pts >= pointsForRank(r)) return r;
    return 900;
  }

  // Chance de vencer a partida de cada rodada. Jogador fraco sofre mais nas primeiras rodadas,
  // jogador forte passa fácil no início e encontra resistência no fim.
  // O produto das chances de todas as rodadas é exatamente P (chance de título da tabela).
  function roundP(ovr, P, n, roundIdx) {
    const k = -0.15 + 0.30 * (clamp(ovr, 50, 99) - 50) / 49;
    const w = 1 + k * (roundIdx - (n - 1) / 2);
    return Math.pow(P, w / n);
  }
  function knockoutResult(t, idx, wins, hasBye) {
    const label = ROUNDS[idx];
    let pts = POINTS[t.type][label];
    if (hasBye && idx === 1) pts = 10;  // perdeu a estreia após bye
    return { label, wins, losses: label === 'W' ? 0 : 1, pts, prize: PRIZE[t.type][label] };
  }
  // Simula um torneio de mata-mata. Se `onFinal` devolver true, pausa antes da final.
  // Regra da V3: com OVR base abaixo de 75 é impossível vencer uma final de Grand Slam.
  const SLAM_MIN_OVR = 75;
  function slamLockedRefP(ovr) {
    if (ovr <= 60) return 0.0015;
    if (ovr <= 65) return 0.004;
    if (ovr <= 70) return 0.008;
    return 0.012;   // 71–74
  }
  function simKnockout(ovr, t, partyMod, hasBye, onFinal, baseOvr = ovr) {
    const slamLocked = t.type === 'major' && baseOvr < SLAM_MIN_OVR;
    // Abaixo de 75 a final é impossível de vencer; para as rodadas anteriores usamos uma
    // chance de referência menor, para que chegar à final também seja raro.
    const P = slamLocked ? slamLockedRefP(baseOvr) * partyMod : titleProb(ovr, t.type, partyMod);
    const startIdx = (t.type === 'masters' && hasBye) ? 1 : 0;
    const n = 7 - startIdx;
    let idx = startIdx, wins = 0;
    while (idx < 7) {
      const p = roundP(ovr, P, n, idx - startIdx);
      if (idx === 6 && slamLocked) break;   // chega à final, mas não consegue vencer
      if (idx === 6 && onFinal && onFinal()) return { paused: true, p, wins, hasBye };
      if (rnd() >= p) break;
      idx++; wins++;
    }
    return knockoutResult(t, idx, wins, hasBye);
  }

  // p por partida no ATP Finals: P(título) = P(≥2 vitórias em 3) * p²
  function finalsMatchP(P) {
    let lo = 0, hi = 1;
    for (let i = 0; i < 40; i++) {
      const p = (lo + hi) / 2;
      const adv = p * p * p + 3 * p * p * (1 - p);
      (adv * p * p < P) ? lo = p : hi = p;
    }
    return (lo + hi) / 2;
  }
  function simFinals(ovr, partyMod) {
    const p = finalsMatchP(titleProb(ovr, 'finals', partyMod));
    let rrW = 0;
    for (let i = 0; i < 3; i++) if (rnd() < p) rrW++;
    let wins = rrW, losses = 3 - rrW;
    let pts = rrW * FINALS.rrWinPts, prize = FINALS.base + rrW * FINALS.rrWinPrize;
    if (rrW < 2) return { label: 'RR', wins, losses, pts, prize };
    if (rnd() >= p) return { label: 'SF', wins, losses: losses + 1, pts, prize };
    wins++; pts += FINALS.sfWinPts; prize += FINALS.sfWinPrize;
    if (rnd() >= p) return { label: 'F', wins, losses: losses + 1, pts, prize };
    wins++; pts += FINALS.fWinPts; prize += FINALS.fWinPrize;
    return { label: 'W', wins, losses, pts, prize };
  }

  // ---- eventos ----
  // max: quantas vezes pode aparecer na carreira (Infinity = repete)
  const EVENTS = [
    { id: 1, title: 'Novo regime de treinamento', text: 'Seu preparador físico propõe um regime de treino bem mais pesado para esta temporada.', max: Infinity,
      ok: { p: .65, ovr: 2, msg: 'O corpo respondeu bem ao novo treino.' }, bad: { ovr: -1, msg: 'Overtraining. Você passou do limite.' } },
    { id: 2, title: 'Novo coach', text: 'Um treinador renomado quer assumir sua carreira e mudar sua forma de jogar.', max: Infinity,
      ok: { p: .60, ovr: 4, msg: 'A parceria encaixou desde o primeiro treino.' }, bad: { ovr: -2, msg: 'Você não se adaptou ao estilo dele.' } },
    { id: 3, title: 'Ir para a balada', text: 'Os amigos te chamaram para uma noite fora antes do início da temporada.', max: Infinity,
      ok: { p: .50, party: 1.1, msg: 'Viver é importante.' }, bad: { party: 0.9, msg: 'Curtiu até demais.' } },
    { id: 4, title: 'Doping', text: 'Alguém do seu staff oferece uma substância que "ninguém vai detectar".', max: 1,
      ok: { p: .80, ovr: 4, msg: 'Ninguém percebeu. Por enquanto.' }, bad: { suspend: 3, msg: 'Pego no antidoping.' } },
    { id: 5, title: 'Proposta estranha', text: 'Um apostador oferece dinheiro para você entregar algumas partidas.', max: 1,
      ok: { p: .50, ovr: 3, msg: 'O dinheiro pagou uma estrutura de treino melhor.' }, bad: { suspend: 1, msg: 'A integridade do circuito descobriu.' } },
    { id: 6, title: 'Treino com lenda', text: 'Um ex-número 1 do mundo te convida para uma semana de treinos.', max: 1,
      ok: { p: .75, ovr: 2, msg: 'Você absorveu tudo.' }, bad: { ovr: -2, msg: 'Ele não foi com a sua cara.' } },
    { id: 7, title: 'Troca de raquete', text: 'Uma marca oferece um contrato para você trocar de raquete.', max: 1,
      ok: { p: .50, ovr: 2, msg: 'Você amou a nova raquete.' }, bad: { ovr: -2, msg: 'Você não se adaptou à novidade.' } },
    { id: 8, title: 'Treino com técnico lendário', text: 'Um técnico histórico aceita observar seus treinos por alguns dias.', max: 1,
      ok: { p: .75, ovr: 1, msg: 'Você absorveu tudo.' }, bad: { ovr: -1, msg: 'Ele não foi com a sua cara.' } },
    { id: 9, title: 'Novo plano alimentar', text: 'Seu nutricionista sugere mudar toda a sua dieta.', max: Infinity,
      ok: { p: .65, ovr: 2, msg: 'Comida nova é comida boa.' }, bad: { ovr: -1, msg: 'A comida nova não caiu bem.' } },
    { id: 10, title: 'Namoro duvidoso', text: 'Você conheceu alguém intenso demais. Os amigos desconfiam.', max: 1,
      ok: { p: .45, ovr: 3, msg: 'Vocês são o casal perfeito.' }, bad: { ovr: -2, msg: 'Tava na cara que não ia dar certo.' } },
    { id: 11, title: 'Oportunidade de namoro', text: 'Alguém especial apareceu no meio da temporada.', max: 1,
      ok: { p: .65, ovr: 1, msg: 'Vocês são o casal perfeito.' }, bad: { ovr: -1, msg: 'Infelizmente não deu certo.' } },
    { id: 12, title: 'Treino reforçado: Saibro', text: 'Dedicar a pré-temporada ao saibro. Vale só para esta temporada.', max: Infinity,
      choice: { train: 'clay', msg: 'Pré-temporada inteira no saibro.' } },
    { id: 13, title: 'Treino reforçado: Grama', text: 'Dedicar a pré-temporada à grama. Vale só para esta temporada.', max: Infinity,
      choice: { train: 'grass', msg: 'Pré-temporada inteira na grama.' } },
    { id: 14, title: 'Treino reforçado: Rápida', text: 'Dedicar a pré-temporada à quadra rápida. Vale só para esta temporada.', max: Infinity,
      choice: { train: 'hard', msg: 'Pré-temporada inteira na quadra rápida.' } },
    { id: 15, title: 'Finalizar os estudos', text: 'Você ainda não terminou a escola. Dá para conciliar com o circuito?', max: 1,
      choice: { ovr: 1, miss: 3, msg: 'Diploma na mão.' } },
    { id: 16, title: 'Tempo fora das quadras', text: 'Você está cansado. Que tal umas semanas longe do tênis?', max: 2,
      ok: { p: .65, ovr: 3, miss: 2, msg: 'Descansou e voltou revigorado.' }, bad: { ovr: -1, msg: 'Esfriou até demais.' } },
    { id: 17, title: 'Tatuagem da confiança', text: 'Uma tatuagem nova para lembrar quem você é dentro da quadra.', max: Infinity,
      ok: { p: .70, ovr: 1, msg: 'Realmente deu confiança.' }, bad: { miss: 2, msg: 'Infeccionou.' } },

    // ---- eventos especiais: só aparecem numa faixa de idade, se a condição for cumprida ----
    // (V5) a chance de ativação é sorteada em cada temporada da faixa, até o evento aparecer uma vez
    { id: 101, special: { minAge: 32, maxAge: 35, chance: .60, cond: c => c.bestRank === 1 || c.majors >= 5 || c.titles >= 25,
        req: 'Entre 32 e 35 anos, tendo sido nº 1 do mundo, ou com 5+ Grand Slams, ou com 25+ títulos' },
      title: 'Imortal!', text: 'Passados os 30, todo mundo fala em fim de ciclo. Você topa se reinventar para provar que ainda é o melhor?', max: 1,
      ok: { p: .70, ovr: 5, msg: 'Você conseguiu se reinventar.' }, bad: { ovr: -3, msg: 'Seu tempo está passando mesmo.' } },
    { id: 102, special: { minAge: 16, maxAge: 21, chance: .40, cond: c => c.titles >= 3,
        req: 'Até os 21 anos, com pelo menos 3 títulos na carreira' },
      title: 'Jovem promessa', text: 'A imprensa já te chama de futuro número 1. Você abraça o rótulo e a pressão que vem junto?', max: 1,
      ok: { p: .70, ovr: 3, msg: 'Você é o próximo na linha.' }, bad: { ovr: -1, msg: 'Era só hype.' } },
    { id: 103, special: { minAge: 27, maxAge: 30, chance: .45, cond: c => c.majors >= 7 && c.ovr >= 90,
        req: 'Entre 27 e 30 anos, com pelo menos 7 Grand Slams e 90+ de OVR' },
      title: 'MODO PRIME', text: 'Você está no auge. Dá para ir além e entrar no modo mais dominante da sua carreira?', max: 1,
      ok: { p: .70, ovr: 5, msg: 'Modo ativado com sucesso.' }, bad: { ovr: -3, msg: 'Talvez a melhor fase já foi.' } },
    // Fenix: 35% de chance no total da faixa (não por temporada), para ser raro
    { id: 104, special: { minAge: 33, maxAge: 35, chance: 1 - Math.pow(1 - .35, 1 / 3), careerChance: .35, cond: c => c.maxOvrTo33 <= 80,
        req: 'Entre 33 e 35 anos, sem nunca ter passado de 80 de OVR até os 33' },
      title: 'Fenix', text: 'Você nunca chegou ao topo, mas ainda sente que tem algo a provar. Topa recomeçar do zero, com tudo o que isso custa?', max: 1,
      refuse: 'Nada acontece (pra que correr riscos, sou feliz já!)',
      ok: { p: .40, ovr: 7, msg: 'Você é um jogador "novo".' }, bad: { ovr: -4, msg: 'É pra acabar.' } },
  ];
  const getEvent = id => EVENTS.find(e => e.id === id);

  // Texto do efeito de um desfecho (usado para mostrar as odds ao jogador)
  function effectText(o) {
    const parts = [];
    if (o.ovr) parts.push(`${o.ovr > 0 ? '+' : '−'}${Math.abs(o.ovr)} OVR`);
    if (o.party) parts.push(`${o.party > 1 ? '+' : '−'}10% de chance de títulos na temporada`);
    if (o.suspend) parts.push(`Suspenso por ${o.suspend} ${o.suspend > 1 ? 'anos' : 'ano'}`);
    if (o.miss) parts.push(`Fora de ${o.miss} torneios na temporada`);
    if (o.train) parts.push(`+3 OVR na ${SURFACE_NAME[o.train].toLowerCase()} e −1 nas outras quadras, só nesta temporada`);
    return parts.join(' · ') || 'Nada acontece';
  }
  // Opções do evento com probabilidades, para a tela
  function eventOdds(ev) {
    if (ev.choice) return { accept: [{ p: 1, kind: 'good', text: effectText(ev.choice) }] };
    return { accept: [
      { p: ev.ok.p, kind: 'good', text: effectText(ev.ok) },
      { p: 1 - ev.ok.p, kind: 'bad', text: effectText(ev.bad) },
    ] };
  }

  function eventDue(state) {
    const s = state.seasons.length;
    switch (state.player.exp) {
      case 'intenso': return true;
      case 'normal':  return s % 2 === 0;
      case 'express': return s % 3 === 0;
      default:        return rnd() < 0.4;
    }
  }
  function drawEvent(state) {
    const used = id => state.usedEvents.filter(x => x === id).length;
    const pool = EVENTS.filter(e => !e.special && used(e.id) < e.max && e.id !== state.lastEventId);
    return pool.length ? pick(pool).id : null;
  }

  function resolveEvent(state, accept) {
    const ev = getEvent(state.pendingEvent);
    state.pendingEvent = null;
    state.lastEventId = ev.id;
    state.usedEvents.push(ev.id);
    let res;
    if (!accept) res = { kind: 'skip', msg: 'Você recusou. Nada acontece.', ovrDelta: 0 };
    else {
      let o, kind;
      if (ev.choice) { o = ev.choice; kind = 'good'; }
      else { const ok = rnd() < ev.ok.p; o = ok ? ev.ok : ev.bad; kind = ok ? 'good' : 'bad'; }
      if (o.ovr) state.ovr = clamp(state.ovr + o.ovr, 1, 99);
      if (o.party) state.partyMod = o.party;
      if (o.suspend) state.suspended = o.suspend;
      if (o.miss) state.missThisSeason += o.miss;
      if (o.train) state.train = o.train;
      res = { kind, msg: o.msg, effect: effectText(o), ovrDelta: o.ovr || 0, suspend: o.suspend || 0, party: o.party || 0, miss: o.miss || 0, train: o.train || null };
    }
    state.bestOvr = Math.max(state.bestOvr, state.ovr);
    state.lastEvent = { id: ev.id, title: ev.title, accepted: accept, ...res };
    save && save(state);
    return state.lastEvent;
  }

  // ---- rivais ----
  const RIVALS = {
    alcaraz:  { name: 'Carlos Alcaraz',   nat: 'ESP' },
    sinner:   { name: 'Jannik Sinner',    nat: 'ITA' },
    zverev:   { name: 'Alexander Zverev', nat: 'GER' },
    djokovic: { name: 'Novak Djokovic',   nat: 'SRB' },
  };
  const RIVAL_CHOICES = [
    { name: 'Cabeça Fria',     text: 'Sem emoções. Foque apenas no jogo e na sua técnica.' },
    { name: 'VAMOSSS!!!',      text: 'Lute por todos os pontos. O jogo inteiro é vida ou morte!' },
    { name: 'Mestre do Xadrez', text: 'Vença com tática. Cada ponto, uma armadilha nova.' },
  ];
  const RIVAL_TOP = 5;   // rival aparece após 2 temporadas no Top 5
  const RIVAL_FX = { pos: { delta: 0.15, label: 'Positivo' }, neu: { delta: 0, label: 'Neutro' }, neg: { delta: -0.15, label: 'Negativo' } };

  function ackRival(state) {
    state.rival = state.pendingRival;
    state.pendingRival = null;
    state.rivalFinals = 0;
    state.rivalRecord = { w: 0, l: 0 };
    state.rivalLog = [];
    save && save(state);
  }

  // ---- placar fictício de uma final de Grand Slam (melhor de 5 sets) ----
  // Sets normais: tie-break a 7 em 6-6. 5º set: tie-break a 10 em 6-6 (regra dos Slams desde 2022).
  // O número entre parênteses é a pontuação de quem perdeu o tie-break.
  function weighted(pairs) { let r = rnd() * pairs.reduce((a, p) => a + p[1], 0); for (const [v, w] of pairs) { r -= w; if (r < 0) return v; } return pairs[0][0]; }
  function setWon(isDecider) {
    const g = weighted([[[6, 0], 3], [[6, 1], 8], [[6, 2], 15], [[6, 3], 20], [[6, 4], 24], [[7, 5], 12], [[7, 6], 18]]);
    if (g[0] === 7 && g[1] === 6) {
      const target = isDecider ? 10 : 7;
      const tb = rnd() < 0.8 ? randInt(0, target - 2) : randInt(target - 1, target + 3); // às vezes passa do alvo (vence por 2)
      return { w: 7, l: 6, tb };
    }
    return { w: g[0], l: g[1] };
  }
  function finalScore(playerWon) {
    const lostSets = weighted([[0, 35], [1, 38], [2, 27]]);   // 3-0, 3-1 ou 3-2
    const total = 3 + lostSets;
    const order = shuffle([...Array(total - 1)].map((_, i) => i < lostSets ? 'L' : 'W')).concat('W'); // o último set é do vencedor
    return order.map((who, i) => {
      const st = setWon(i === 4);
      const winnerSide = who === 'W';             // set vencido por quem venceu a partida
      const playerTook = winnerSide === playerWon;
      const a = playerTook ? st.w : st.l, b = playerTook ? st.l : st.w;
      return `${a}-${b}${st.tb !== undefined ? `(${st.tb})` : ''}`;
    }).join(' ');
  }

  function resolveRivalFinal(state, choiceIdx) {
    const pf = state.pendingFinal, s = state.inSeason;
    const t = TOURNAMENTS.find(x => x.id === pf.tid);
    const rival = RIVALS[state.rival];
    // V3: o impacto da postura é sempre sorteado (1/3 positivo, 1/3 neutro, 1/3 negativo)
    const fxKey = pick(['pos', 'neu', 'neg']), fx = RIVAL_FX[fxKey];
    const p = clamp(pf.p + fx.delta, 0.05, 0.95);
    const win = rnd() < p;
    const r = knockoutResult(t, win ? 7 : 6, pf.wins + (win ? 1 : 0), pf.hasBye);
    r.rival = state.rival;
    s.results[t.id] = r;
    s.idx++;
    win ? state.rivalRecord.w++ : state.rivalRecord.l++;
    state.pendingFinal = null;
    const score = finalScore(win);
    r.score = score;
    state.lastRivalFinal = { tid: t.id, tname: t.name, rival: state.rival, choice: choiceIdx, fx: fxKey,
                             pBase: pf.p, p, win, year: state.year, score };
    (state.rivalLog = state.rivalLog || []).push({ year: state.year, tid: t.id, tname: t.name, win, score, choice: choiceIdx, fx: fxKey });
    save && save(state);
    return state.lastRivalFinal;
  }

  // ---- progressão ----
  const GROWTH_WEIGHTS = [1, 33, 25, 18, 10, 5, 4, 3, 1]; // +0 … +8 (soma 100)
  function growthRoll() {
    let r = rnd() * 100;
    for (let i = 0; i < GROWTH_WEIGHTS.length; i++) { r -= GROWTH_WEIGHTS[i]; if (r < 0) return i; }
    return 1;
  }
  function ageDelta(age) {
    if (age <= 22) return growthRoll();
    if (age <= 30) return 0;
    if (age <= 33) return -1;
    if (age <= 36) return -2;
    return -3;
  }
  function injuryChance(age) {
    if (age <= 25) return 0.05;
    if (age <= 30) return 0.07;
    if (age <= 35) return 0.10;
    return 0.17;
  }
  function surfaceMod(state, surface) {
    let m = (STYLES[state.player.style] || STYLES.allcourt).mod[surface] || 0;
    if (state.train) m += state.train === surface ? 3 : -1;
    return m;
  }
  const surfaceOvr = (state, surface) => clamp(state.ovr + surfaceMod(state, surface), 1, 99);

  // ---- criação / migração ----
  function newCareer(player, startOvr, startAge) {
    const state = {
      v: 3, player, startYear: 2026, year: 2026, age: startAge, ovr: startOvr, startOvr, startAge,
      bestOvr: startOvr, bestRank: null, seasons: [], usedEvents: [], lastEventId: null,
      pendingEvent: null, lastEvent: null, train: null, partyMod: 1, suspended: 0, missThisSeason: 0,
      retired: false, retireReason: null, lastSeasonNews: null,
      topSeasons: 0, rival: null, pendingRival: null, rivalFinals: 0, rivalRecord: null,
      inSeason: null, pendingFinal: null, lastRivalFinal: null,
    };
    if (eventDue(state)) state.pendingEvent = drawEvent(state);
    return state;
  }
  function migrate(state) {
    if (!state) return state;
    if (state.v === 2) {
      state.topSeasons = state.seasons.filter(s => s.rank && s.rank <= RIVAL_TOP).length;
      delete state.top3Seasons; state.v = 3;
      return state;
    }
    if (state.v >= 3) { if (!state.rivalLog) state.rivalLog = []; return state; }
    state.player.style = state.player.style || 'allcourt';
    if (state.studyThisSeason) state.missThisSeason = 3;
    if (state.pendingEvent && !getEvent(state.pendingEvent)) state.pendingEvent = null;
    Object.assign(state, { v: 3, train: state.spec || null, missThisSeason: state.missThisSeason || 0,
      topSeasons: state.seasons.filter(s => s.rank && s.rank <= RIVAL_TOP).length, rival: null, pendingRival: null,
      rivalFinals: 0, rivalRecord: null, inSeason: null, pendingFinal: null, lastRivalFinal: null });
    delete state.spec; delete state.studyThisSeason;
    return state;
  }

  // ---- temporada (pode pausar antes de uma final de Slam contra o rival) ----
  function beginSeason(state) {
    const s = { results: {}, news: [], injury: null, out: [], idx: 0, ovrStart: state.ovr, hasBye: false, suspended: false };
    state.inSeason = s;
    if (state.suspended > 0) {
      s.suspended = true;
      TOURNAMENTS.forEach(t => s.results[t.id] = { label: 'SUSP', wins: 0, losses: 0, pts: 0, prize: 0 });
      s.news.push({ kind: 'bad', text: `Suspenso nesta temporada${state.suspended > 1 ? ` (faltam ${state.suspended - 1} depois desta)` : ''}.` });
      state.suspended--;
      s.idx = TOURNAMENTS.length;
      return;
    }
    const out = new Set();
    if (rnd() < injuryChance(state.age)) {
      const loss = randInt(1, 5);
      state.ovr = clamp(state.ovr - loss, 1, 99);
      shuffle(REGULAR.map(t => t.id)).slice(0, loss).forEach(id => { out.add(id); s.results[id] = { label: 'LES', wins: 0, losses: 0, pts: 0, prize: 0 }; });
      s.injury = { loss };
      s.news.push({ kind: 'bad', text: `Lesão! −${loss} OVR e fora de ${loss} torneio${loss > 1 ? 's' : ''}.` });
    }
    if (state.missThisSeason > 0) {
      const cause = state.lastEvent && state.lastEvent.miss ? state.lastEvent.title : 'Evento';
      shuffle(REGULAR.map(t => t.id).filter(id => !out.has(id))).slice(0, state.missThisSeason)
        .forEach(id => { out.add(id); s.results[id] = { label: 'FORA', wins: 0, losses: 0, pts: 0, prize: 0, cause }; });
    }
    s.out = [...out];
    const prev = state.seasons[state.seasons.length - 1];
    s.hasBye = !!(prev && prev.rank && prev.rank <= 32);
  }

  function runSeason(state) {
    const s = state.inSeason;
    while (s.idx < TOURNAMENTS.length) {
      const t = TOURNAMENTS[s.idx];
      if (t.type === 'finals') {
        const pts = REGULAR.reduce((a, x) => a + (s.results[x.id] ? s.results[x.id].pts : 0), 0);
        const pr = rankFromPoints(pts);
        s.results.FIN = pr !== null && pr <= 8 ? simFinals(surfaceOvr(state, 'hard'), state.partyMod)
                                               : { label: '-', wins: 0, losses: 0, pts: 0, prize: 0 };
        s.idx++; continue;
      }
      if (s.out.includes(t.id)) { s.idx++; continue; }
      const onFinal = (t.type === 'major' && state.rival) ? () => { state.rivalFinals++; return state.rivalFinals % 2 === 0; } : null;
      const r = simKnockout(surfaceOvr(state, t.surface), t, state.partyMod, s.hasBye, onFinal, state.ovr);
      if (r.paused) {
        state.pendingFinal = { tid: t.id, p: r.p, wins: r.wins, hasBye: r.hasBye };
        save && save(state);
        return { status: 'paused', final: state.pendingFinal };
      }
      s.results[t.id] = r;
      s.idx++;
    }
    return { status: 'done', season: finishSeason(state) };
  }

  function simulateSeason(state) {
    if (state.retired || state.pendingEvent || state.pendingRival || state.pendingFinal) return null;
    if (!state.inSeason) { state.lastRivalFinal = null; beginSeason(state); }
    return runSeason(state);
  }

  function finishSeason(state) {
    const s = state.inSeason;
    const results = s.results;
    const totals = Object.values(results).reduce((a, r) => ({
      pts: a.pts + r.pts, prize: a.prize + r.prize, wins: a.wins + r.wins, losses: a.losses + r.losses,
      titles: a.titles + (r.label === 'W' ? 1 : 0) }), { pts: 0, prize: 0, wins: 0, losses: 0, titles: 0 });
    const rank = rankFromPoints(totals.pts);
    if (rank !== null) state.bestRank = state.bestRank === null ? rank : Math.min(state.bestRank, rank);
    if (rank !== null && rank <= RIVAL_TOP) state.topSeasons++;

    const season = { year: state.year, age: state.age, ovr: state.ovr, ovrStart: s.ovrStart, rank, results, ...totals,
                     injury: s.injury, event: state.lastEvent, party: state.partyMod !== 1 ? state.partyMod : null, train: state.train };
    state.seasons.push(season);
    state.partyMod = 1; state.missThisSeason = 0; state.train = null; state.lastEvent = null;
    state.inSeason = null;

    if (state.age + 1 >= 42) { state.retired = true; state.retireReason = 'Aposentadoria aos 42 anos: o corpo pediu para parar.'; }
    else if (state.age >= 35 && state.ovr < 50) { state.retired = true; state.retireReason = 'Com o overall abaixo de 50, não deu mais para competir.'; }

    if (!state.retired) {
      state.year++; state.age++;
      const d = ageDelta(state.age);
      state.ovr = clamp(state.ovr + d, 1, 99);
      state.bestOvr = Math.max(state.bestOvr, state.ovr);
      season.nextDelta = d;
      // rival novo e eventos especiais entram no lugar do evento comum
      let replaced = false;
      if (!state.rival && state.topSeasons >= 2) { state.pendingRival = pick(Object.keys(RIVALS)); replaced = true; }
      const sp = specialDue(state);
      if (sp) { state.pendingEvent = sp; replaced = true; }
      if (!replaced && eventDue(state)) state.pendingEvent = drawEvent(state);
      else if (!sp) state.pendingEvent = null;
    }
    season.news = s.news;
    state.lastSeasonNews = { year: season.year, items: s.news };
    save && save(state);
    return season;
  }

  function retire(state) {
    state.retired = true; state.pendingEvent = null; state.pendingRival = null;
    const n = state.seasons.length;
    state.retireReason = `Você anunciou a aposentadoria aos ${state.age} anos depois de ${n} ${n === 1 ? 'temporada' : 'temporadas'}.`;
    save && save(state);
  }

  // Evento especial cuja idade e condição batem com a nova temporada (sorteando a chance de ativação)
  function specialDue(state) {
    const st = careerStats(state);
    // maior OVR registrado até os 33 anos (início de cada temporada, OVR jogado e o atual, se ainda tem até 33)
    const upTo33 = state.seasons.filter(se => se.age <= 33).flatMap(se => [se.ovrStart ?? se.ovr, se.ovr]);
    const maxOvrTo33 = Math.max(state.startOvr, ...upTo33, ...(state.age <= 33 ? [state.ovr] : []));
    const c = { titles: st.titles, majors: st.majors, bestRank: state.bestRank, ovr: state.ovr, maxOvrTo33 };
    for (const e of EVENTS) {
      if (!e.special || state.usedEvents.includes(e.id) || state.age < e.special.minAge || state.age > e.special.maxAge) continue;
      if (e.special.cond(c) && rnd() < e.special.chance) return e.id;
    }
    return null;
  }

  // ---- estatísticas de carreira ----
  function careerStats(state) {
    const per = {};
    TOURNAMENTS.forEach(t => per[t.id] = { titles: 0, wins: 0, losses: 0, finalsW: 0, finalsL: 0, years: [] });
    let titles = 0, wins = 0, losses = 0, prize = 0, majors = 0;
    for (const s of state.seasons) {
      titles += s.titles; wins += s.wins; losses += s.losses; prize += s.prize;
      for (const t of TOURNAMENTS) {
        const r = s.results[t.id], st = per[t.id];
        st.wins += r.wins; st.losses += r.losses;
        if (r.label === 'W') { st.titles++; st.finalsW++; st.years.push({ y: s.year, w: true }); if (t.type === 'major') majors++; }
        if (r.label === 'F') { st.finalsL++; st.years.push({ y: s.year, w: false }); }
      }
    }
    return { per, titles, wins, losses, prize, majors, seasons: state.seasons.length,
             bestRank: state.bestRank, bestOvr: state.bestOvr };
  }

  function careerStatus(stats) {
    const { majors, titles, bestRank } = stats;
    const br = bestRank ?? 9999;
    if (majors >= 20 || (majors >= 14 && br === 1)) return { key: 'lenda', label: 'Lenda' };
    if (majors >= 8 || (majors >= 3 && br === 1)) return { key: 'superstar', label: 'Superstar' };
    if (majors >= 2 || titles >= 10) return { key: 'famoso', label: 'Famoso' };
    if (majors >= 1 || titles >= 4 || br <= 10) return { key: 'mediano', label: 'Mediano' };
    if (titles >= 1 || br <= 25) return { key: 'abaixo', label: 'Um pouco abaixo' };
    return { key: 'ruim', label: 'Ruim' };
  }

  // ---- tags de carreira (V4) ----
  const TAGS = [
    { id: 'canecos', kind: 'career', name: 'Colecionador de Canecos', desc: 'Conquistar 15 títulos na carreira', test: (st) => st.titles >= 15 },
    { id: 'lendacourts', kind: 'career', name: 'Lenda dos Courts', desc: 'Conquistar 30 títulos na carreira', test: (st) => st.titles >= 30 },
    { id: 'masterizado', kind: 'career', name: 'Masterizado', desc: 'Conquistar 10 Masters 1000', test: (st) => MASTERS.reduce((a, t) => a + st.per[t.id].titles, 0) >= 10 },
    { id: 'careerslam', kind: 'career', name: 'Career Grand Slam', desc: 'Ganhar os quatro Grand Slams diferentes na carreira', test: (st) => SLAMS.every(t => st.per[t.id].titles > 0) },
    { id: 'grandslam', kind: 'career', name: 'Grand Slam', desc: 'Ganhar os quatro Grand Slams na mesma temporada', test: (st, s) => s.seasons.some(se => SLAMS.every(t => se.results[t.id].label === 'W')) },
    { id: 'topo', kind: 'career', name: 'Topo da Montanha', desc: 'Terminar uma temporada como número 1', test: (st, s) => s.seasons.some(se => se.rank === 1) },
    { id: 'rei', kind: 'career', name: 'Rei da Montanha', desc: 'Terminar 3 temporadas como número 1', test: (st, s) => s.seasons.filter(se => se.rank === 1).length >= 3 },
    { id: 'vencer', kind: 'career', name: 'Vencer e Vencer', desc: 'Ter mais de 600 vitórias na carreira', test: (st) => st.wins > 600 },
    { id: 'branco', kind: 'career', name: 'Jornada em branco', desc: 'Não venceu nenhum título', test: (st) => st.titles === 0 },
    { id: 'senhorsaibro', kind: 'clay', name: 'Senhor Saibro', desc: 'Conquistar 1 título em cada torneio no saibro (Monte Carlo, Madrid e Roland-Garros)', test: (st) => bySurface('clay').every(t => st.per[t.id].titles > 0) },
    { id: 'hardmaster', kind: 'hard', name: 'Hard master', desc: 'Conquistar 5 títulos diferentes em quadra dura', test: (st) => bySurface('hard').filter(t => st.per[t.id].titles > 0).length >= 5 },
    { id: 'allrounder', kind: 'all', name: 'All-Rounder', desc: 'Conquistar pelo menos 2 títulos em cada uma das três superfícies', test: (st) => ['hard', 'clay', 'grass'].every(sf => bySurface(sf).reduce((a, t) => a + st.per[t.id].titles, 0) >= 2) },
    { id: 'imperador', kind: 'clay', name: 'Imperador do Saibro', desc: 'Conquistar Roland-Garros 5 vezes', test: (st) => st.per.RG.titles >= 5 },
    { id: 'lorde', kind: 'grass', name: 'Lorde da Grama', desc: 'Conquistar Wimbledon 5 vezes', test: (st) => st.per.WIM.titles >= 5 },
    { id: 'reihard', kind: 'hard', name: 'Rei do Hard Court', desc: 'Conquistar o Australian Open ou o US Open 5 vezes', test: (st) => st.per.AO.titles >= 5 || st.per.USO.titles >= 5 },
    { id: 'sirwim', kind: 'grass', name: 'Sir Wimbledon', desc: 'Conquistar Wimbledon 10 vezes', test: (st) => st.per.WIM.titles >= 10 },
    { id: 'outback', kind: 'hard', name: 'Outback Lover', desc: 'Conquistar o Australian Open 10 vezes', test: (st) => st.per.AO.titles >= 10 },
    { id: 'usa', kind: 'hard', name: 'Born in the USA', desc: 'Conquistar o US Open 10 vezes', test: (st) => st.per.USO.titles >= 10 },
    { id: 'monsieur', kind: 'clay', name: 'Monsieur Clay', desc: 'Conquistar Roland-Garros 10 vezes', test: (st) => st.per.RG.titles >= 10 },
    // V7: rivais e finais
    { id: 'imbativel', kind: 'rival', name: 'Imbatível', desc: 'Nunca perdeu uma final para o rival', test: (st, s) => !!s.rival && s.rivalRecord && s.rivalRecord.w > 0 && s.rivalRecord.l === 0 },
    { id: 'secondbest', kind: 'rival', name: 'Second Best', desc: 'Nunca venceu uma final contra o rival', test: (st, s) => !!s.rival && s.rivalRecord && s.rivalRecord.l > 0 && s.rivalRecord.w === 0 },
    { id: 'clutch', kind: 'career', name: 'Mr. Clutch', desc: 'Vencer mais de 90% das finais de Grand Slam (mínimo de 5 finais)', test: (st) => { const w = SLAMS_F(st, 'finalsW'), l = SLAMS_F(st, 'finalsL'); return w + l >= 5 && w / (w + l) > 0.9; } },
  ];
  const SLAMS = TOURNAMENTS.filter(t => t.type === 'major');
  const SLAMS_F = (st, k) => SLAMS.reduce((a, t) => a + st.per[t.id][k], 0);
  const MASTERS = TOURNAMENTS.filter(t => t.type === 'masters');
  const bySurface = sf => TOURNAMENTS.filter(t => t.surface === sf);
  function careerTags(state) {
    const st = careerStats(state);
    return TAGS.filter(t => t.test(st, state));
  }

  let save = null;
  return { finalScore, TAGS, careerTags, SLAM_MIN_OVR, RIVAL_TOP, TOURNAMENTS, EVENTS, STYLES, RIVALS, RIVAL_CHOICES, RIVAL_FX, SURFACE_NAME, GROWTH_WEIGHTS,
           getEvent, eventOdds, effectText, titleProb, rankFromPoints, newCareer, migrate, resolveEvent,
           ackRival, resolveRivalFinal, simulateSeason, retire, careerStats, careerStatus, surfaceMod, surfaceOvr, randInt,
           setSaver: fn => { save = fn; } };
})();
if (typeof module !== 'undefined') module.exports = Engine;
