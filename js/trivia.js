/* ============ Tennis Simulator — modo Trivia: banco de perguntas e motor da carreira ============
   Cada partida é uma pergunta. Acertou, avança; errou ou o tempo acabou, está eliminado.
   Sem OVR, sem eventos e sem rivais: tudo depende do que você sabe de tênis. */
const Trivia = (() => {
  const E = (typeof Engine !== 'undefined') ? Engine : require('./engine.js');
  const RAW = (typeof TRIVIA_RAW !== 'undefined') ? TRIVIA_RAW : require('./trivia-data.js').TRIVIA_RAW;
  const CURATED = (typeof TRIVIA_CURATED !== 'undefined') ? TRIVIA_CURATED : require('./trivia-curated.js').TRIVIA_CURATED;
  const T = E.TOURNAMENTS;

  // ---------- configuração ----------
  const RETIRE_AGE = 38;                 // aposentadoria obrigatória
  const RETIRE_BUTTON_AGE = 30;          // botão de aposentar a partir desta idade
  // segundos para responder, por rodada (cai a cada rodada até a final)
  const TIMERS = { R1: 30, R2: 26, R3: 22, R16: 19, QF: 16, SF: 13, F: 10, RR: 16, BONUS: 10 };
  // peso de cada nível de dificuldade por rodada (1 fácil · 2 média · 3 difícil · 4 muito difícil)
  const TIERS = {
    R1: { 1: .8, 2: .2 }, R2: { 1: .65, 2: .35 }, R3: { 1: .45, 2: .5, 3: .05 }, R16: { 1: .3, 2: .55, 3: .15 },
    QF: { 1: .15, 2: .55, 3: .3 }, RR: { 1: .15, 2: .55, 3: .3 }, SF: { 2: .5, 3: .5 }, F: { 2: .3, 3: .6, 4: .1 },
    BONUS: { 3: .25, 4: .75 },
  };
  const BONUS_CHANCE = 0.07;             // chance de a Pergunta Bônus aparecer antes de uma partida (no máx. 1 por torneio)
  const BONUS_WINS = 3, BONUS_LOSSES = 2;
  const THEME_CHANCE = 0.35;             // nos Slams, chance de a pergunta ser sobre o próprio torneio
  const ROUND_NAME = { R1: '1ª rodada', R2: '2ª rodada', R3: '3ª rodada', R16: 'Oitavas de final', QF: 'Quartas de final', SF: 'Semifinal', F: 'Final', RR: 'Fase de grupos' };
  const TIER_NAME = { 1: 'Fácil', 2: 'Média', 3: 'Difícil', 4: 'Muito difícil' };

  // ---------- utilidades ----------
  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function seeded(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const rnd = Math.random;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const shuffleWith = (arr, r) => arr.map(v => [r(), v]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
  const uniq = arr => [...new Set(arr)];

  // ---------- banco de perguntas ----------
  const ALIAS = { 'Kerry Melville': 'Kerry Melville Reid', 'Ann Haydon Jones': 'Ann Jones', 'Nancy Richey Gunter': 'Nancy Richey', 'Evonne Goolagong Cawley': 'Evonne Goolagong' };
  const N = RAW.N.map(n => ALIAS[n] || n);
  const EV = { AO: 'Australian Open', RG: 'Roland-Garros', WIM: 'Wimbledon', USO: 'US Open' };
  const COUNTRY = { 'United States': 'Estados Unidos', 'British Isles': 'Ilhas Britânicas', 'Belgium': 'Bélgica', 'Australasia': 'Australásia',
    'Great Britain': 'Grã-Bretanha', 'Japan': 'Japão', 'Australia': 'Austrália', 'France': 'França', 'Italy': 'Itália', 'Mexico': 'México',
    'Spain': 'Espanha', 'India': 'Índia', 'Romania': 'Romênia', 'West Germany': 'Alemanha Ocidental', 'South Africa': 'África do Sul',
    'Sweden': 'Suécia', 'Czechoslovakia': 'Tchecoslováquia', 'Chile': 'Chile', 'Argentina': 'Argentina', 'Germany': 'Alemanha',
    'Russia': 'Rússia', 'Switzerland': 'Suíça', 'Croatia': 'Croácia', 'Slovakia': 'Eslováquia', 'Serbia': 'Sérvia',
    'Czech Republic': 'República Tcheca', 'Canada': 'Canadá', 'Netherlands': 'Holanda', 'RTF': 'Rússia (RTF)' };
  // jogadores que ainda podem mudar os números (perguntas de "último título" ficam de fora para eles)
  const ACTIVE = new Set(['Novak Djokovic', 'Jannik Sinner', 'Carlos Alcaraz', 'Daniil Medvedev', 'Alexander Zverev', 'Stan Wawrinka', 'Marin Čilić',
    'Iga Świątek', 'Aryna Sabalenka', 'Coco Gauff', 'Elena Rybakina', 'Madison Keys', 'Naomi Osaka', 'Barbora Krejčíková', 'Markéta Vondroušová',
    'Mirra Andreeva', 'Linda Nosková', 'Sofia Kenin', 'Jeļena Ostapenko', 'Victoria Azarenka', 'Emma Raducanu', 'Bianca Andreescu', 'Sloane Stephens']);

  const BANK = [], BY_ID = {};
  function add(q) {
    if (BY_ID[q.id]) return;
    const opts = uniq([q.a, ...q.w]).slice(0, 4);
    if (opts.length < 4) return;              // sem alternativas suficientes, a pergunta não entra
    q.w = opts.slice(1); q.d = clamp(q.d, 1, 4);
    BANK.push(q); BY_ID[q.id] = q;
  }

  // finais de Grand Slam: [{ ev, g, year, label, champ, ru }]
  const finals = [];
  for (const key in RAW.S) {
    const [ev, g] = key.split('-');
    const rows = RAW.S[key].map(r => { const p = r.split(','); return { y: p[0], champ: N[+p[1]], ru: N[+p[3]] }; });
    rows.forEach((r, i) => {
      const year = parseInt(r.y, 10);
      const dup = rows.filter(x => parseInt(x.y, 10) === year).length > 1;
      const first = rows.findIndex(x => parseInt(x.y, 10) === year) === i;
      finals.push({ ev, g, year, label: dup ? `${year} (${first ? 'janeiro' : 'dezembro'})` : String(year), champ: r.champ, ru: r.ru, key });
    });
  }
  const slamCount = {}, firstFinal = {}, evTitles = {};
  finals.forEach(f => {
    slamCount[f.champ] = (slamCount[f.champ] || 0) + 1;
    [f.champ, f.ru].forEach(p => { firstFinal[p] = Math.min(firstFinal[p] || 9999, f.year); });
    const k = f.champ + '|' + f.ev; (evTitles[k] = evTitles[k] || []).push(f);
  });
  const fame = p => slamCount[p] || 0;
  const preOpen = p => firstFinal[p] < 1971;   // carreira começou antes da Era Aberta: contagens ficariam incompletas
  const yearScore = y => y >= 2000 ? 0 : y >= 1985 ? 1 : 2;
  const fameScore = p => fame(p) >= 10 ? -1 : fame(p) >= 4 ? 0 : 1;
  const genderLabel = g => g === 'M' ? 'masculino' : 'feminino';
  const de = ev => (ev === 'AO' || ev === 'USO') ? 'do' : 'de';        // "do US Open", "de Wimbledon"
  const art = ev => (ev === 'AO' || ev === 'USO') ? 'o ' : '';         // "venceu o US Open", "venceu Wimbledon"

  function nearNames(f, exclude, r, span = 8) {
    let pool = finals.filter(x => x.key === f.key && Math.abs(x.year - f.year) <= span).flatMap(x => [x.champ, x.ru]);
    pool = uniq(pool).filter(n => !exclude.includes(n));
    if (pool.length < 3) pool = uniq(finals.filter(x => x.g === f.g && Math.abs(x.year - f.year) <= 15).flatMap(x => [x.champ, x.ru])).filter(n => !exclude.includes(n));
    return shuffleWith(pool, r);
  }
  function numOpts(n, r, min = 1, spread = [1, 2, 3, -1, -2, -3]) {
    const c = shuffleWith(spread.map(d => n + d).filter(v => v >= min && v !== n), r);
    return uniq(c).slice(0, 3).map(String);
  }
  function yearOpts(y, r, avoid = []) {
    const c = shuffleWith([-4, -3, -2, -1, 1, 2, 3, 4, 5, -5].map(d => y + d).filter(v => v >= 1968 && v <= 2026 && !avoid.includes(v)), r);
    return c.slice(0, 3).map(String);
  }

  // 1) campeão e vice de cada final de Slam
  finals.forEach(f => {
    const r = seeded(hash(f.key + f.label));
    const evName = EV[f.ev], gl = genderLabel(f.g), fem = f.g === 'W';
    const dC = 1 + yearScore(f.year) + fameScore(f.champ);
    const wC = nearNames(f, [f.champ], r); if (r() < 0.5 && !wC.slice(0, 3).includes(f.ru)) wC.unshift(f.ru);
    add({ id: `s:${f.key}:${f.label}:c`, cat: 'Grand Slams', ev: f.ev, d: dC,
      q: `Quem ${fem ? 'foi a campeã' : 'foi o campeão'} de simples ${gl} ${de(f.ev)} ${evName} ${f.label}?`, a: f.champ, w: wC.slice(0, 3) });
    const dR = 1 + yearScore(f.year) + fameScore(f.ru) + 1;
    const wR = nearNames(f, [f.ru, f.champ], r);
    add({ id: `s:${f.key}:${f.label}:r`, cat: 'Grand Slams', ev: f.ev, d: dR,
      q: `Na final ${de(f.ev)} ${evName} ${f.label}, ${f.champ} venceu quem?`, a: f.ru, w: wR.slice(0, 3) });
  });
  // 2) em que ano X venceu Y na final (só quando o confronto aconteceu uma vez naquele torneio)
  finals.forEach(f => {
    if (f.label.includes('(')) return;
    const same = finals.filter(x => x.key === f.key && x.champ === f.champ && x.ru === f.ru);
    if (same.length > 1) return;
    const r = seeded(hash('y' + f.key + f.label));
    const avoid = finals.filter(x => x.key === f.key && (x.champ === f.champ || x.ru === f.ru)).map(x => x.year);
    add({ id: `s:${f.key}:${f.label}:y`, cat: 'Grand Slams', ev: f.ev, d: 2 + yearScore(f.year) + fameScore(f.champ),
      q: `Em que ano ${f.champ} venceu ${f.ru} na final ${de(f.ev)} ${EV[f.ev]}?`, a: String(f.year), w: yearOpts(f.year, r, avoid.filter(y => y !== f.year)) });
  });
  // 3) quantas vezes X venceu o torneio E (2+ títulos)
  const SKIP_COUNT = new Set(['Rafael Nadal|RG', 'Gustavo Kuerten|RG']);   // já estão nas perguntas escritas à mão
  Object.entries(evTitles).forEach(([k, list]) => {
    const [p, ev] = k.split('|'); const n = list.length;
    if (n < 2 || preOpen(p) || SKIP_COUNT.has(k)) return;
    const r = seeded(hash('n' + k));
    add({ id: `s:n:${k}`, cat: 'Grand Slams', ev, d: n >= 5 ? 1 + (fame(p) < 10 ? 1 : 0) : fame(p) >= 8 ? 2 : 3,
      q: `Quantas vezes ${p} venceu ${art(ev)}${EV[ev]} em simples?`, a: String(n), w: numOpts(n, r) });
  });
  // 4) total de Grand Slams (jogadores da Era Aberta, 3+ títulos)
  const SKIP_TOTAL = new Set(['Novak Djokovic', 'Roger Federer', 'Serena Williams']);
  Object.keys(slamCount).forEach(p => {
    const n = slamCount[p]; if (n < 3 || preOpen(p) || SKIP_TOTAL.has(p)) return;
    const r = seeded(hash('t' + p));
    add({ id: `s:t:${p}`, cat: 'Recordes', d: n >= 10 ? 2 : 3,
      q: `Quantos títulos de Grand Slam em simples ${p} conquistou${ACTIVE.has(p) ? ' (até 2026)' : ''}?`, a: String(n), w: numOpts(n, r, 1, n >= 10 ? [1, 2, -1, -2, 3, -3] : [1, 2, -1, -2, 3]) });
  });
  // 5) primeiro e último Slam de quem tem 3+ títulos
  Object.keys(slamCount).forEach(p => {
    if (slamCount[p] < 3 || preOpen(p)) return;
    const wins = finals.filter(f => f.champ === p).sort((a, b) => a.year - b.year || (a.label > b.label ? 1 : -1));
    const lab = f => `${EV[f.ev]} ${f.label}`;
    const r = seeded(hash('fl' + p));
    const others = (f) => {
      const near = finals.filter(x => x.g === f.g && Math.abs(x.year - f.year) <= 3 && lab(x) !== lab(f) && !(x.champ === p && x.year < f.year)).map(lab);
      return shuffleWith(uniq(near), r).slice(0, 3);
    };
    const first = wins[0];
    add({ id: `s:first:${p}`, cat: 'Grand Slams', d: fame(p) >= 8 ? 2 : 3, q: `Qual foi o primeiro título de Grand Slam de ${p}?`, a: lab(first),
      w: shuffleWith(uniq([...wins.slice(1, 3).map(lab), ...others(first)]), r).slice(0, 3) });
    const last = wins[wins.length - 1];
    if (!ACTIVE.has(p) && last.year <= 2020) {
      add({ id: `s:last:${p}`, cat: 'Grand Slams', d: fame(p) >= 8 ? 3 : 4, q: `Qual foi o último título de Grand Slam de ${p}?`, a: lab(last),
        w: shuffleWith(uniq([...wins.slice(-3, -1).map(lab), ...finals.filter(x => x.g === last.g && Math.abs(x.year - last.year) <= 2 && lab(x) !== lab(last)).map(lab)]), r).slice(0, 3) });
    }
  });
  // 6) qual destes campeões nunca venceu o torneio E
  ['AO', 'RG', 'WIM', 'USO'].forEach(ev => ['M', 'W'].forEach(g => {
    const champs = uniq(finals.filter(f => f.ev === ev && f.g === g).map(f => f.champ));
    // só os 2 mais famosos de cada torneio, para a mesma pergunta não aparecer várias vezes
    const famous = uniq(finals.filter(f => f.g === g).map(f => f.champ)).filter(p => fame(p) >= 4 && !preOpen(p) && !ACTIVE.has(p) && !champs.includes(p))
      .sort((a, b) => fame(b) - fame(a)).slice(0, 2);
    famous.forEach((p, k) => {
      const r = seeded(hash('nv' + ev + p));
      const era = finals.filter(f => f.ev === ev && f.g === g && fame(f.champ) >= 3 && Math.abs(f.year - (firstFinal[p] + 6)) <= 14).map(f => f.champ);
      const pool = shuffleWith(uniq(era.length >= 3 ? era : champs.filter(c => fame(c) >= 3)), r);
      add({ id: `s:nv:${ev}:${p}`, cat: 'Grand Slams', ev, d: fame(p) >= 7 ? 2 : 3,
        q: k === 0 ? `Qual ${g === 'M' ? 'destes campeões' : 'destas campeãs'} de Grand Slam nunca venceu ${art(ev)}${EV[ev]}?` : `${art(ev) ? 'O ' : ''}${EV[ev]} ficou faltando na carreira de ${g === 'M' ? 'qual destes campeões' : 'qual destas campeãs'}?`, a: p, w: pool.slice(0, 3) });
    });
  }));
  // 7) confrontos que mais se repetiram em finais de Slam
  const pairs = {};
  finals.forEach(f => { const k = [f.champ, f.ru].sort().join(' e '); pairs[k] = (pairs[k] || 0) + 1; });
  Object.entries(pairs).forEach(([k, n]) => {
    if (n < 4 || k === 'Serena Williams e Venus Williams' || k.split(' e ').some(preOpen)) return;
    add({ id: `s:pair:${k}`, cat: 'Recordes', d: 3, q: `Quantas finais de Grand Slam ${k} disputaram entre si?`, a: String(n), w: numOpts(n, seeded(hash(k))) });
  });

  // 8) ATP Finals e WTA Finals
  [['af', 'ATP Finals', 'M'], ['wf', 'WTA Finals', 'W']].forEach(([key, name, g]) => {
    const all = RAW.X[key].map(s => { const p = s.split(','); return { label: p[0], year: parseInt(p[0], 10), champ: N[+p[1]], ru: N[+p[2]] }; }).filter(x => x.champ !== '-');
    const rows = all.filter(x => !/\./.test(x.label));   // 1986 teve duas edições na WTA: ficam só na contagem
    const near = (y, ex) => shuffleWith(uniq(rows.filter(x => Math.abs(x.year - y) <= 7).flatMap(x => [x.champ, x.ru])).filter(n => !ex.includes(n)), seeded(hash(key + y + ex[0])));
    const counts = {};
    all.forEach(x => { counts[x.champ] = (counts[x.champ] || 0) + 1; });
    rows.forEach(x => {
      const fem = g === 'W';
      add({ id: `f:${key}:${x.year}:c`, cat: 'Finals', d: 2 + yearScore(x.year) + fameScore(x.champ),
        q: `Quem ${fem ? 'foi a campeã' : 'foi o campeão'} do ${name} (torneio de fim de temporada) em ${x.year}?`, a: x.champ, w: near(x.year, [x.champ]).slice(0, 3) });
      add({ id: `f:${key}:${x.year}:r`, cat: 'Finals', d: 3 + yearScore(x.year) + fameScore(x.ru),
        q: `Na final do ${name} de ${x.year}, ${x.champ} venceu quem?`, a: x.ru, w: near(x.year, [x.ru, x.champ]).slice(0, 3) });
    });
    Object.entries(counts).forEach(([p, n]) => {
      if (n < 3) return;
      add({ id: `f:${key}:n:${p}`, cat: 'Finals', d: n >= 6 ? 2 : 3, q: `Quantas vezes ${p} venceu o ${name}${ACTIVE.has(p) ? ' (até 2025)' : ''}?`, a: String(n), w: numOpts(n, seeded(hash(key + p))) });
    });
  });

  // 9) números 1 no fim do ano
  [['ay', 'ATP', 'M'], ['wy', 'WTA', 'W']].forEach(([key, tour, g]) => {
    const rows = RAW.X[key].map(s => { const p = s.split(','); return { year: +p[0], p: N[+p[1]] }; });
    const counts = {};
    rows.forEach(x => {
      counts[x.p] = (counts[x.p] || 0) + 1;
      const pool = shuffleWith(uniq(rows.filter(y => Math.abs(y.year - x.year) <= 8).map(y => y.p).concat(finals.filter(f => f.g === g && Math.abs(f.year - x.year) <= 2).map(f => f.champ))).filter(n => n !== x.p), seeded(hash(key + x.year)));
      add({ id: `r:${key}:${x.year}`, cat: 'Ranking', d: 1 + yearScore(x.year) + (fame(x.p) >= 10 ? 0 : 1),
        q: `Quem terminou a temporada de ${x.year} como número 1 do ranking ${tour}?`, a: x.p, w: pool.slice(0, 3) });
    });
    Object.entries(counts).forEach(([p, n]) => {
      if (n < 2 || ['Steffi Graf', 'Monica Seles'].includes(p)) return;   // 1995 teve número 1 dividido na WTA
      add({ id: `r:${key}:n:${p}`, cat: 'Ranking', d: n >= 5 ? 2 : 3, q: `Quantas temporadas ${p} terminou como número 1 do ranking ${tour}${ACTIVE.has(p) ? ' (até 2025)' : ''}?`, a: String(n), w: numOpts(n, seeded(hash(key + 'n' + p))) });
    });
  });
  // 10) semanas como número 1 (só quem já não pode mudar o número)
  [['aw', 'ATP'], ['ww', 'WTA']].forEach(([key, tour]) => {
    const rows = RAW.X[key].map(s => { const p = s.split(','); return { p: N[+p[0]], w: +p[1] }; });
    rows.forEach((x, i) => {
      const r = seeded(hash(key + x.p));
      const others = shuffleWith(rows.filter(y => y.p !== x.p && Math.abs(y.w - x.w) <= Math.max(40, x.w * 0.5)).map(y => y.w), r);
      const extra = numOpts(x.w, r, 1, [x.w > 50 ? 24 : 3, x.w > 50 ? -27 : -2, x.w > 50 ? 41 : 5]);
      add({ id: `r:${key}:w:${x.p}`, cat: 'Ranking', d: i < 6 ? 3 : 4, q: `Por quantas semanas ${x.p} foi número 1 do ranking ${tour}${x.p === 'Novak Djokovic' ? ' (recorde, até 2026)' : ''}?`,
        a: String(x.w), w: uniq([...others.map(String), ...extra]).filter(v => v !== String(x.w)).slice(0, 3) });
    });
    // quem ficou mais tempo no topo entre quatro nomes
    const top = rows.slice(0, 16);
    for (let i = 0; i < top.length; i++) {
      const r = seeded(hash(key + 'cmp' + i));
      const group = shuffleWith(top.filter((_, j) => j > i), r).slice(0, 3);
      if (group.length < 3 || group.some(y => y.w === top[i].w)) continue;
      const names = shuffleWith([top[i], ...group], r).map(y => y.p.split(' ').slice(-1)[0]);
      add({ id: `r:${key}:cmp:${top[i].p}`, cat: 'Ranking', d: i < 5 ? 2 : 3, q: `Entre ${names.slice(0, 3).join(', ')} e ${names[3]}, quem ficou mais semanas como número 1 do ranking ${tour}?`, a: top[i].p, w: group.map(y => y.p) });
    }
  });
  // 11) Copa Davis
  const davis = RAW.X.dv.map(s => { const p = s.split('|'); return { year: +p[0], win: COUNTRY[p[1]] || p[1], ru: COUNTRY[p[2]] || p[2] }; });
  davis.forEach(x => {
    const r = seeded(hash('dv' + x.year));
    const pool = shuffleWith(uniq(davis.filter(y => Math.abs(y.year - x.year) <= 12).flatMap(y => [y.win, y.ru])).filter(c => c !== x.win), r);
    if (r() < 0.5 && !pool.slice(0, 3).includes(x.ru)) pool.unshift(x.ru);
    const d = x.year >= 1990 ? 2 : x.year >= 1970 ? 3 : 4;
    add({ id: `d:${x.year}:c`, cat: 'Copa Davis', d, q: `Qual país venceu a Copa Davis de ${x.year}?`, a: x.win, w: pool.slice(0, 3) });
    if (x.year >= 1970) {
      const pr = shuffleWith(uniq(davis.filter(y => Math.abs(y.year - x.year) <= 12).flatMap(y => [y.win, y.ru])).filter(c => c !== x.ru && c !== x.win), r);
      add({ id: `d:${x.year}:r`, cat: 'Copa Davis', d: Math.min(4, d + 1), q: `Qual país foi vice-campeão da Copa Davis de ${x.year}?`, a: x.ru, w: pr.slice(0, 3) });
    }
  });
  [['Itália', 4], ['Espanha', 6], ['França', 10], ['Suécia', 7], ['Croácia', 2]].forEach(([c, n]) =>
    add({ id: `d:n:${c}`, cat: 'Copa Davis', d: 3, q: `Quantas vezes a ${c} venceu a Copa Davis (até 2025)?`, a: String(n), w: numOpts(n, seeded(hash('dvn' + c))) }));

  // 12) perguntas escritas à mão
  CURATED.forEach((c, i) => add({ id: `c:${String(i + 1).padStart(3, '0')}`, cat: c[0], d: c[1], q: c[2], a: c[3], w: c.slice(4, 7), note: c[7] || '' }));

  const BY_TIER = { 1: [], 2: [], 3: [], 4: [] };
  BANK.forEach(q => BY_TIER[q.d].push(q));

  // ---------- escolha da pergunta ----------
  function weightedTier(w) { let r = rnd() * Object.values(w).reduce((a, b) => a + b, 0); for (const k in w) { r -= w[k]; if (r < 0) return +k; } return +Object.keys(w)[0]; }
  function pickQuestion(state, roundKey, tid) {
    const used = new Set(state.usedQ);
    const recentCats = state.log.slice(-2).map(l => BY_ID[l[0]] && BY_ID[l[0]].cat);
    const tier = weightedTier(TIERS[roundKey]);
    const order = [tier, tier + 1, tier - 1, tier + 2, tier - 2, tier + 3, tier - 3].filter(t => t >= 1 && t <= 4);
    for (const t of order) {
      let pool = BY_TIER[t].filter(q => !used.has(q.id));
      if (!pool.length) continue;
      if (EV[tid] && rnd() < THEME_CHANCE) { const th = pool.filter(q => q.ev === tid); if (th.length) pool = th; }
      const fresh = pool.filter(q => !recentCats.includes(q.cat) || rnd() < 0.35);
      if (fresh.length) pool = fresh;
      return pool[Math.floor(rnd() * pool.length)];
    }
    // banco esgotado nesta carreira (muito improvável): libera as perguntas mais antigas
    state.usedQ = state.usedQ.slice(Math.floor(state.usedQ.length / 2));
    return pickQuestion(state, roundKey, tid);
  }
  function snapshot(q, roundKey, bonus) {
    const opts = shuffleWith([q.a, ...q.w], rnd);
    const limit = bonus ? TIMERS.BONUS : TIMERS[roundKey];
    return { id: q.id, q: q.q, cat: q.cat, d: q.d, opts, ans: opts.indexOf(q.a), round: roundKey, limit, bonus: !!bonus, startedAt: null, deadline: null };
  }

  // ---------- carreira ----------
  function newCareer(player, startAge) {
    return { mode: 'trivia', v: 1, player, startYear: 2026, year: 2026, age: startAge, startAge, ovr: null, startOvr: null, bestOvr: null,
      bestRank: null, seasons: [], usedQ: [], log: [], autoWins: 0, autoLosses: 0, bonusRec: { w: 0, l: 0, offered: 0, declined: 0 },
      retired: false, retireReason: null, inSeason: null, awaitingAdvance: null, rival: null, rivalRecord: null };
  }
  const rounds = E.ROUNDS, POINTS = E.POINTS, PRIZE = E.PRIZE, FIN = E.FINALS;

  function startSeason(state) {
    const prev = state.seasons[state.seasons.length - 1];
    state.inSeason = { results: {}, ti: 0, hasBye: !!(prev && prev.rank && prev.rank <= 32), tour: null, phase: null, cur: null, fb: null, n: 0, ok: 0 };
    newTour(state);
    prepare(state);
    save(state);
  }
  function newTour(state) {
    const s = state.inSeason, t = T[s.ti];
    if (!t) { s.tour = null; return; }
    if (t.type === 'finals') s.tour = { stage: 'RR', rrPlayed: 0, rrW: 0, bonusUsed: false };
    else { const start = (t.type === 'masters' && s.hasBye) ? 1 : 0; s.tour = { ri: start, start, wins: 0, bonusUsed: false }; }
  }
  // rodada atual (R1…F, RR, SF, F)
  function roundKey(state) {
    const s = state.inSeason, t = T[s.ti];
    if (t.type === 'finals') return s.tour.stage;
    return rounds[s.tour.ri];
  }
  function matchLabel(state) {
    const s = state.inSeason, t = T[s.ti], k = roundKey(state);
    if (t.type === 'finals' && k === 'RR') return `Fase de grupos · jogo ${s.tour.rrPlayed + 1} de 3`;
    return ROUND_NAME[k];
  }

  // prepara a próxima partida: pergunta, oferta de bônus ou resultado automático
  function prepare(state) {
    const s = state.inSeason;
    while (true) {
      if (s.ti >= T.length) { finishSeason(state); return; }
      const t = T[s.ti];
      if (t.type === 'finals' && s.tour.stage === 'RR' && s.tour.rrPlayed === 0 && s.tour.checked !== true) {
        s.tour.checked = true;
        const pts = T.filter(x => x.type !== 'finals').reduce((a, x) => a + (s.results[x.id] ? s.results[x.id].pts : 0), 0);
        const pr = E.rankFromPoints(pts);
        if (pr === null || pr > 8) {
          s.results.FIN = { label: '-', wins: 0, losses: 0, pts: 0, prize: 0 };
          s.phase = 'feedback'; s.cur = null;
          s.fb = { skip: true, ended: true, result: s.results.FIN, rank: pr };
          return;
        }
      }
      break;
    }
    const k = roundKey(state);
    if (state.autoWins > 0 || state.autoLosses > 0) {
      const win = state.autoWins > 0;
      win ? state.autoWins-- : state.autoLosses--;
      const label = matchLabel(state);
      const res = applyMatch(state, win);
      s.cur = null; s.phase = 'feedback';
      s.fb = { auto: win ? 'win' : 'loss', round: k, label, left: win ? state.autoWins : state.autoLosses, ...res };
      return;
    }
    if (!s.tour.bonusUsed && rnd() < BONUS_CHANCE) {
      s.tour.bonusUsed = true; state.bonusRec.offered++;
      s.phase = 'offer'; s.cur = { round: k, label: matchLabel(state) }; s.fb = null;
      return;
    }
    ask(state, k, false);
  }
  function ask(state, k, bonus) {
    const s = state.inSeason;
    const q = pickQuestion(state, bonus ? 'BONUS' : k, T[s.ti].id);
    s.cur = snapshot(q, k, bonus); s.cur.label = matchLabel(state);
    s.phase = 'question'; s.fb = null;
  }
  // a tela chama quando a pergunta aparece de fato (o relógio começa aqui)
  function startClock(state, now = Date.now()) {
    const c = state.inSeason && state.inSeason.cur;
    if (!c || c.deadline) return;
    c.startedAt = now; c.deadline = now + c.limit * 1000;
    save(state);
  }
  function takeBonus(state, yes) {
    const s = state.inSeason; if (s.phase !== 'offer') return;
    const k = s.cur.round;
    if (!yes) state.bonusRec.declined++;
    ask(state, k, yes);
    save(state);
  }

  // registra a resposta (idx = alternativa escolhida; null = tempo esgotado)
  function answer(state, idx, now = Date.now()) {
    const s = state.inSeason, c = s.cur;
    if (!s || s.phase !== 'question' || !c) return null;
    const ms = c.startedAt ? Math.min(now - c.startedAt, c.limit * 1000) : c.limit * 1000;
    const timeout = idx === null || (c.deadline && now > c.deadline + 400);
    const ok = !timeout && idx === c.ans;
    state.usedQ.push(c.id);
    state.log.push([c.id, timeout ? -1 : ok ? 1 : 0, ms, c.round, c.d, c.bonus ? 1 : 0, state.year]);
    s.n++; if (ok) s.ok++;
    const label = c.label;
    let res;
    if (c.bonus) {
      ok ? state.bonusRec.w++ : state.bonusRec.l++;
      res = applyMatch(state, ok);
      if (ok) state.autoWins += BONUS_WINS - 1;      // esta partida + as próximas 2
      else state.autoLosses += BONUS_LOSSES - 1;     // esta partida + a próxima
    } else res = applyMatch(state, ok);
    s.fb = { ok, timeout, chosen: timeout ? null : idx, ans: c.ans, opts: c.opts, q: c.q, id: c.id, round: c.round, label, bonus: c.bonus, ms, note: (BY_ID[c.id] || {}).note || '', ...res };
    s.phase = 'feedback';
    save(state);
    return s.fb;
  }

  // aplica o resultado da partida no torneio atual; devolve { ended, result }
  function applyMatch(state, won) {
    const s = state.inSeason, t = T[s.ti], tr = s.tour;
    if (t.type === 'finals') {
      if (tr.stage === 'RR') {
        tr.rrPlayed++; if (won) tr.rrW++;
        if (tr.rrPlayed < 3) return { ended: false };
        if (tr.rrW >= 2) { tr.stage = 'SF'; return { ended: false, advancedRR: true }; }
        return end(s, { label: 'RR', wins: tr.rrW, losses: 3 - tr.rrW, pts: tr.rrW * FIN.rrWinPts, prize: FIN.base + tr.rrW * FIN.rrWinPrize });
      }
      const base = { wins: tr.rrW, losses: 3 - tr.rrW, pts: tr.rrW * FIN.rrWinPts, prize: FIN.base + tr.rrW * FIN.rrWinPrize };
      if (tr.stage === 'SF') {
        if (!won) return end(s, { label: 'SF', ...base, losses: base.losses + 1 });
        tr.stage = 'F'; return { ended: false };
      }
      const sf = { wins: base.wins + 1, losses: base.losses, pts: base.pts + FIN.sfWinPts, prize: base.prize + FIN.sfWinPrize };
      if (!won) return end(s, { label: 'F', ...sf, losses: sf.losses + 1 });
      return end(s, { label: 'W', wins: sf.wins + 1, losses: sf.losses, pts: sf.pts + FIN.fWinPts, prize: sf.prize + FIN.fWinPrize });
    }
    if (won) {
      tr.wins++; tr.ri++;
      if (tr.ri === 7) return end(s, knock(t, 7, tr.wins, false));
      return { ended: false };
    }
    return end(s, knock(t, tr.ri, tr.wins, tr.start === 1));
  }
  function knock(t, idx, wins, hasBye) {
    const label = rounds[idx];
    let pts = POINTS[t.type][label];
    if (hasBye && idx === 1) pts = 10;
    return { label, wins, losses: label === 'W' ? 0 : 1, pts, prize: PRIZE[t.type][label] };
  }
  function end(s, result) { s.results[T[s.ti].id] = result; return { ended: true, result }; }

  // botão "continuar" depois do resultado da partida
  function cont(state) {
    const s = state.inSeason; if (!s || s.phase !== 'feedback') return;
    if (s.fb && s.fb.ended) { s.ti++; newTour(state); }
    s.fb = null;
    prepare(state);
    save(state);
  }

  function finishSeason(state) {
    const s = state.inSeason, results = s.results;
    T.forEach(t => { if (!results[t.id]) results[t.id] = { label: '-', wins: 0, losses: 0, pts: 0, prize: 0 }; });
    const totals = Object.values(results).reduce((a, r) => ({ pts: a.pts + r.pts, prize: a.prize + r.prize, wins: a.wins + r.wins, losses: a.losses + r.losses,
      titles: a.titles + (r.label === 'W' ? 1 : 0) }), { pts: 0, prize: 0, wins: 0, losses: 0, titles: 0 });
    const rank = E.rankFromPoints(totals.pts);
    if (rank !== null) state.bestRank = state.bestRank === null ? rank : Math.min(state.bestRank, rank);
    const season = { year: state.year, age: state.age, ovr: null, acc: s.n ? s.ok / s.n : null, answered: s.n, correct: s.ok, rank, results, ...totals, news: [] };
    state.seasons.push(season);
    state.inSeason = null;
    if (state.age + 1 >= RETIRE_AGE) { state.retired = true; state.retireReason = `Aposentadoria aos ${RETIRE_AGE} anos: no Trivia, a carreira termina aqui.`; }
    else { state.year++; state.age++; }
    state.awaitingAdvance = { years: [season.year] };
  }

  function retire(state) {
    if (state.inSeason) return;
    state.retired = true;
    const n = state.seasons.length;
    state.retireReason = `Você anunciou a aposentadoria aos ${state.age} anos depois de ${n} ${n === 1 ? 'temporada' : 'temporadas'}.`;
    save(state);
  }

  // ---------- estatísticas ----------
  function stats(state) {
    const log = state.log;
    let ok = 0, to = 0, streak = 0, best = 0, msOk = 0, nOk = 0, msAll = 0, fastest = null;
    const byTier = {}, byRound = {}, byCat = {};
    const bump = (m, k, good) => { (m[k] = m[k] || { n: 0, ok: 0 }); m[k].n++; if (good) m[k].ok++; };
    log.forEach(([id, r, ms, round, d, bonus]) => {
      const good = r === 1; if (good) { ok++; streak++; best = Math.max(best, streak); msOk += ms; nOk++; if (fastest === null || ms < fastest) fastest = ms; } else streak = 0;
      if (r === -1) to++;
      msAll += ms;
      bump(byTier, d, good);
      bump(byRound, bonus ? 'BONUS' : round, good);
      bump(byCat, (BY_ID[id] || {}).cat || 'Outras', good);
    });
    const missed = log.filter(l => l[1] !== 1).slice(-40).reverse().map(l => { const q = BY_ID[l[0]]; return q ? { q: q.q, a: q.a, timeout: l[1] === -1, year: l[6], round: l[3], bonus: !!l[5] } : null; }).filter(Boolean);
    return { n: log.length, ok, wrong: log.length - ok - to, timeouts: to, acc: log.length ? ok / log.length : 0, bestStreak: best, curStreak: streak,
      avgMs: log.length ? msAll / log.length : 0, avgOkMs: nOk ? msOk / nOk : 0, fastest, byTier, byRound, byCat, bonus: state.bonusRec, missed };
  }
  const TRIVIA_TAGS = [
    { id: 'enciclopedia', kind: 'trivia', name: 'Enciclopédia', desc: 'Responder 300+ perguntas com pelo menos 85% de acerto', test: st => st.n >= 300 && st.acc >= 0.85 },
    { id: 'imparavel', kind: 'trivia', name: 'Imparável', desc: 'Acertar 40 perguntas seguidas', test: st => st.bestStreak >= 40 },
    { id: 'relampago', kind: 'trivia', name: 'Relâmpago', desc: 'Responder em média em menos de 6 segundos (mínimo de 100 perguntas)', test: st => st.n >= 100 && st.avgMs < 6000 },
    { id: 'sanguefrio', kind: 'trivia', name: 'Sangue Frio', desc: 'Nunca deixar o tempo acabar (mínimo de 100 perguntas)', test: st => st.n >= 100 && st.timeouts === 0 },
    { id: 'apostador', kind: 'trivia', name: 'Apostador', desc: 'Acertar 3 ou mais Perguntas Bônus', test: st => st.bonus.w >= 3 },
    { id: 'sabetudo', kind: 'trivia', name: 'Sabe-Tudo', desc: 'Acertar 10+ perguntas muito difíceis', test: st => (st.byTier[4] || { ok: 0 }).ok >= 10 },
  ];
  function tags(state) {
    const st = stats(state);
    const career = E.careerTags(state).filter(t => t.kind !== 'rival');
    return [...career, ...TRIVIA_TAGS.filter(t => t.test(st))];
  }

  let saver = null;
  function save(state) { saver && saver(state); }

  return { BANK, BY_ID, BY_TIER, TIMERS, TIERS, ROUND_NAME, TIER_NAME, RETIRE_AGE, RETIRE_BUTTON_AGE, BONUS_WINS, BONUS_LOSSES, BONUS_CHANCE,
    newCareer, startSeason, prepare, startClock, takeBonus, answer, cont, retire, stats, tags, matchLabel, roundKey,
    setSaver: fn => { saver = fn; } };
})();
if (typeof module !== 'undefined') module.exports = Trivia;
