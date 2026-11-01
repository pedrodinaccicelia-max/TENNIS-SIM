/* ============ Tennis Simulator — telas e fluxo do jogo ============ */
(() => {
  const SAVE_KEY = 'tennis-sim-save-v1';
  const isTrivia = s => !!(s && s.mode === 'trivia');
  // carreiras do Trivia não passam pela migração do FULL Sim
  const loadState = raw => isTrivia(raw) ? raw : Engine.migrate(raw);
  const $app = document.getElementById('app');
  const T = Engine.TOURNAMENTS;

  const NATIONS = [
    ['BR','BRA','Brasil'],['AR','ARG','Argentina'],['ES','ESP','Espanha'],['FR','FRA','França'],['IT','ITA','Itália'],
    ['DE','GER','Alemanha'],['RS','SRB','Sérvia'],['CH','SUI','Suíça'],['GB','GBR','Reino Unido'],['US','USA','Estados Unidos'],
    ['CA','CAN','Canadá'],['AU','AUS','Austrália'],['NL','NED','Holanda'],['BE','BEL','Bélgica'],['PT','POR','Portugal'],
    ['GR','GRE','Grécia'],['NO','NOR','Noruega'],['DK','DEN','Dinamarca'],['SE','SWE','Suécia'],['FI','FIN','Finlândia'],
    ['AT','AUT','Áustria'],['CZ','CZE','República Tcheca'],['PL','POL','Polônia'],['HR','CRO','Croácia'],['HU','HUN','Hungria'],
    ['BG','BUL','Bulgária'],['UA','UKR','Ucrânia'],['RU','RUS','Rússia'],['KZ','KAZ','Cazaquistão'],['CL','CHI','Chile'],
    ['CO','COL','Colômbia'],['UY','URU','Uruguai'],['PY','PAR','Paraguai'],['PE','PER','Peru'],['MX','MEX','México'],
    ['JP','JPN','Japão'],['CN','CHN','China'],['KR','KOR','Coreia do Sul'],['IN','IND','Índia'],['ZA','RSA','África do Sul'],
  ].sort((a, b) => a[2].localeCompare(b[2], 'pt'));
  const flag = iso => String.fromCodePoint(...[...iso].map(c => 0x1F1A5 + c.charCodeAt(0)));
  const nation = code => NATIONS.find(n => n[1] === code) || NATIONS[0];
  const EXP = {
    intenso: ['Intenso', 'Eventos todo ano'], normal: ['Normal', 'Eventos a cada 2 anos'],
    express: ['Express', 'Simula 3 temporadas por vez, com evento a cada 3 anos'], random: ['Random', 'Eventos aleatórios'],
  };
  const SURF_COLOR = { hard: 'var(--hard)', clay: 'var(--clay)', grass: 'var(--grass)' };
  const SURF_NAME = { hard: 'rápida', clay: 'saibro', grass: 'grama' };
  const court = (s, cls = 'court') => `<svg class="${cls}" viewBox="0 0 30 18" aria-label="Quadra de ${SURF_NAME[s]}" role="img"><rect x=".5" y=".5" width="29" height="17" rx="2" fill="${SURF_COLOR[s]}"/><g stroke="rgba(255,255,255,.85)" stroke-width="1" fill="none"><rect x="3" y="2.5" width="24" height="13"/><path d="M3 5h24M3 13h24M15 2.5v13M9 5v8M21 5v8M9 9h12"/></g></svg>`;

  const money = v => v >= 1e6 ? `€${(v / 1e6).toFixed(v >= 1e8 ? 0 : 1).replace('.', ',')}M` : v >= 1e3 ? `€${Math.round(v / 1e3)}K` : `€${v}`;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tier = o => o >= 92 ? 't-icon' : o >= 85 ? 't-elite' : o >= 75 ? 't-gold' : o >= 65 ? 't-silver' : 't-bronze';
  const resLabel = { W: 'W', F: 'F', SF: 'SF', QF: 'QF', R16: 'R16', R3: 'R3', R2: 'R2', R1: 'R1', RR: 'RR', LES: 'LES', SUSP: 'SUSP', EST: 'FORA', FORA: 'FORA', '-': '–' };
  const resTitle = { W: 'Campeão', F: 'Vice-campeão', SF: 'Semifinal', QF: 'Quartas de final', R16: 'Oitavas de final', R3: '3ª rodada', R2: '2ª rodada', R1: '1ª rodada', RR: 'Fase de grupos', LES: 'Lesionado', SUSP: 'Suspenso', EST: 'Fora (estudos)', FORA: 'Fora (evento)', '-': 'Não classificado' };
  const STYLES = Engine.STYLES, RIVALS = Engine.RIVALS;
  const pct = p => `${Math.round(p * 100)}%`;
  const modChips = mod => ['grass', 'hard', 'clay'].map(sf => { const v = mod[sf] || 0;
    return `<span class="mod ${v > 0 ? 'up' : v < 0 ? 'down' : 'zero'}"><i style="background:${SURF_COLOR[sf]}"></i>${Engine.SURFACE_NAME[sf]} <b>${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(v)}</b></span>`; }).join('');
  const rivalNation = key => { const r = RIVALS[key]; return NATIONS.find(n => n[1] === r.nat) || NATIONS[0]; };
  const freshDraft = () => ({ mode: 'full', name: '', nat: 'BRA', hand: 'Destro', backhand: 'Duas mãos', exp: 'normal', style: 'allcourt', ovr: null, age: null, natOpen: false, natQ: '' });

  // ---------- estado ----------
  let state = null;          // carreira
  let ui = { view: 'create', confirm: null, modal: null, fresh: false };
  let draft = freshDraft();

  // ---------- conta (Supabase) ----------
  // mode: null (ainda não escolheu), 'guest' (salva só no aparelho) ou 'user' (salva na nuvem)
  let account = { mode: null, user: null };
  // authMode: 'login' | 'signup' | 'reset' (esqueci a senha) | 'newpass' (criar nova senha pelo link)
  let home = { checking: Cloud.enabled, authMode: 'login', email: '', err: '', info: '', busy: false, showPw: false,
               prov: { google: false, email: true, autoconfirm: false },
               list: null, listErr: '', loading: false, confirmDel: null, importing: false };

  function persist() {
    if (account.mode === 'user') { if (state) scheduleCloudSave(); return; }
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ state, view: ui.view })); } catch (e) {}
  }

  // salvamento na nuvem: agrupa alterações rápidas e salva uma de cada vez
  let saveTimer = null, saving = false, dirty = false;
  function rowFor(s) {
    const st = Engine.careerStats(s);
    const { cloudId, ...clean } = s;
    const tv = isTrivia(s), tst = tv ? Trivia.stats(s) : null;
    return { name: s.player.name, nat: s.player.nat, status: Engine.careerStatus(st).label, retired: !!s.retired,
             seasons: s.seasons.length, age: s.age, ovr: tv ? null : s.ovr, majors: st.majors, titles: st.titles,
             best_rank: s.bestRank, game_version: 8, mode: tv ? 'trivia' : 'full', accuracy: tv && tst.n ? tst.acc : null, state: clean };
  }
  function scheduleCloudSave(delay = 1200) {
    dirty = true; setSaveState('pending');
    clearTimeout(saveTimer); saveTimer = setTimeout(flushCloud, delay);
  }
  async function flushCloud() {
    if (!dirty || !state || account.mode !== 'user') return;
    if (saving) { clearTimeout(saveTimer); saveTimer = setTimeout(flushCloud, 500); return; }
    saving = true; dirty = false;
    const s = state;
    setSaveState('saving');
    try {
      const id = await Cloud.save(s.cloudId, rowFor(s));
      s.cloudId = id;
      setSaveState(dirty ? 'pending' : 'saved');
    } catch (e) {
      dirty = true; setSaveState('error', e.message);
      clearTimeout(saveTimer); saveTimer = setTimeout(flushCloud, 8000);
    } finally { saving = false; }
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushCloud(); });

  // indicador no topo: onde a carreira está salva
  let saveInfo = { kind: '', msg: '' };
  function setSaveState(kind, msg = '') { saveInfo = { kind, msg }; paintTop(); }
  function paintTop() {
    const el = document.getElementById('saveState'), btn = document.getElementById('homeBtn');
    if (btn) {
      btn.hidden = !Cloud.enabled || ui.view === 'home';
      btn.textContent = account.mode === 'user' ? 'Minhas carreiras' : 'Início';
    }
    if (!el) return;
    let txt = '', cls = '';
    if (ui.view === 'home' || !state) txt = '';
    else if (account.mode === 'user') {
      const k = saveInfo.kind;
      txt = k === 'saving' || k === 'pending' ? 'Salvando…' : k === 'error' ? 'Não salvo: tentando de novo' : 'Salvo na nuvem';
      cls = k === 'error' ? 'bad' : k === 'saved' || !k ? 'good' : '';
    } else if (Cloud.enabled) txt = 'Convidado · salvo neste aparelho';
    el.textContent = txt; el.className = 'save-state ' + cls; el.title = saveInfo.kind === 'error' ? saveInfo.msg : '';
  }

  function clearLive() {
    clearTimeout(ui.liveTimer);
    ui.live = null; ui.chain = null; ui.chainWait = false; ui.modal = null; ui.confirm = null;
  }
  function goHome() {
    flushCloud();
    clearLive();
    if (account.mode === 'guest') account = { mode: null, user: null };
    state = null; ui = { view: 'home', confirm: null, modal: null, fresh: false };
    render(); scrollTo({ top: 0 });
    if (account.mode === 'user') loadList();
  }
  async function loadList() {
    home.loading = true; home.listErr = ''; render();
    try { home.list = await Cloud.list(); } catch (e) { home.listErr = e.message; }
    home.loading = false; render();
  }
  function localGuestCareer() { const sv = loadSave(); return sv && sv.state ? sv : null; }
  function enterGuest() {
    account = { mode: 'guest', user: null };
    const sv = localGuestCareer();
    if (sv) { state = loadState(sv.state); ui = { view: sv.view === 'summary' && state.retired ? 'summary' : 'game', confirm: null, modal: state.pendingFinal ? 'rival' : null, fresh: false }; }
    else { state = null; ui = { view: 'create', confirm: null, modal: null, fresh: false }; }
    render(); scrollTo({ top: 0 });
  }
  async function openCareer(id) {
    home.loading = true; render();
    try {
      const row = await Cloud.load(id);
      state = loadState(row.state); state.cloudId = row.id;
      ui = { view: state.retired ? 'summary' : 'game', confirm: null, modal: state.pendingFinal ? 'rival' : null, fresh: false };
      saveInfo = { kind: 'saved', msg: '' };
      home.loading = false; render(); scrollTo({ top: 0 });
    } catch (e) { home.loading = false; home.listErr = e.message; render(); }
  }
  function onAuth(user, event) {
    home.checking = false;
    if (event === 'PASSWORD_RECOVERY' && user) {
      // veio do link "esqueci a senha": pede a nova senha antes de qualquer coisa
      flushCloud(); clearLive();
      account = { mode: 'user', user }; state = null;
      home.authMode = 'newpass'; home.err = ''; home.info = '';
      ui = { view: 'home', confirm: null, modal: null, fresh: false };
      render(); return;
    }
    if (user && account.mode !== 'user') {
      flushCloud(); clearLive();
      account = { mode: 'user', user }; state = null; home.err = ''; home.info = ''; home.authMode = 'login';
      ui = { view: 'home', confirm: null, modal: null, fresh: false };
      loadList();
    } else if (!user && account.mode === 'user') {
      account = { mode: null, user: null }; state = null; home.list = null;
      ui = { view: 'home', confirm: null, modal: null, fresh: false };
      render();
    } else if (ui.view === 'home') render();
  }
  Engine.setSaver(() => persist());
  Trivia.setSaver(() => persist());
  function loadSave() {
    try { const raw = localStorage.getItem(SAVE_KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }

  // ---------- criação ----------
  function viewCreate() {
    const n = nation(draft.nat);
    const q = draft.natQ.trim().toLowerCase();
    const list = NATIONS.filter(x => !q || x[2].toLowerCase().includes(q) || x[1].toLowerCase().includes(q));
    const tv = draft.mode === 'trivia';
    const ready = draftReady();
    return `
    <section class="hero">
      <span class="eyebrow">Nova carreira · Temporada 2026</span>
      <h1>Crie seu tenista</h1>
      <p>${tv ? 'No Trivia não existe overall: cada partida é uma pergunta sobre tênis. Acertou, avança. Errou ou o tempo acabou, está fora do torneio.' : 'Monte o jogador, sorteie o overall e a idade de estreia, e tome as decisões que vão definir títulos, lesões e o seu lugar no ranking.'}</p>
    </section>
    <div class="mode-grid" role="radiogroup" aria-label="Modo de jogo">
      <button class="mode-card" data-mode="full" role="radio" aria-checked="${!tv}"><span class="mode-k">Modo</span><strong>FULL Sim</strong><span>Overall, eventos, lesões e rivais. A simulação decide, você toma as decisões.</span></button>
      <button class="mode-card trivia" data-mode="trivia" role="radio" aria-checked="${tv}"><span class="mode-k">Modo</span><strong>Trivia</strong><span>Sem OVR e sem sorte: cada partida é uma pergunta de tênis, com o relógio correndo.</span></button>
    </div>
    <section class="panel">
      <div class="form-grid">
        <div class="field span-2">
          <label for="f-name">Nome</label>
          <input class="input" id="f-name" maxlength="28" autocomplete="off" placeholder="Ex.: Nelson Kramer" value="${esc(draft.name)}">
        </div>
        <div class="field span-2">
          <span class="label">Nacionalidade</span>
          <button class="nat-btn" id="natBtn" aria-expanded="${draft.natOpen}"><span class="flag">${flag(n[0])}</span>${n[2]}<span class="chev">${draft.natOpen ? '▲' : '▼'}</span></button>
          ${draft.natOpen ? `<div class="nat-pop">
            <input class="input" id="natQ" placeholder="Buscar país" value="${esc(draft.natQ)}" autocomplete="off">
            <div class="nat-list" role="listbox">${list.map(x => `<button role="option" data-nat="${x[1]}" aria-selected="${x[1] === draft.nat}"><span class="flag">${flag(x[0])}</span>${x[2]}</button>`).join('') || '<span class="muted">Nenhum país encontrado.</span>'}</div>
          </div>` : ''}
        </div>
        ${tv ? '' : `<div class="field">
          <span class="label">Mão dominante</span>
          <div class="seg">${['Destro', 'Canhoto'].map(h => `<button data-hand="${h}" aria-pressed="${draft.hand === h}">${h}</button>`).join('')}</div>
        </div>
        <div class="field">
          <span class="label">Backhand</span>
          <div class="seg">${['Uma mão', 'Duas mãos'].map(h => `<button data-bh="${h}" aria-pressed="${draft.backhand === h}">${h}</button>`).join('')}</div>
        </div>
        <div class="field span-2">
          <span class="label">Tipo de experiência</span>
          <div class="exp-grid">${Object.entries(EXP).map(([k, [t, d]]) => `<button class="exp" data-exp="${k}" aria-pressed="${draft.exp === k}"><strong>${t}</strong><span>${d}</span></button>`).join('')}</div>
        </div>
        <div class="field span-2">
          <span class="label">Play Style</span>
          <div class="style-grid">${Object.entries(STYLES).map(([k, st]) => `<button class="style" data-style="${k}" aria-pressed="${draft.style === k}"><strong>${st.name}</strong><span>${st.desc}</span><div class="mods">${modChips(st.mod)}</div></button>`).join('')}</div>
        </div>`}
      </div>
    </section>
    ${tv ? '' : `<div class="draws">
      ${drawBlock('ovr', 'Overall inicial', [50, 60, 70], 'Sortear overall')}
      ${drawBlock('age', 'Idade de estreia', [16, 18, 21], 'Sortear idade')}
    </div>`}
    ${tv ? `<section class="panel trivia-rules">
      <span class="eyebrow">Como funciona o Trivia</span>
      <ul>
        <li>Cada rodada de cada torneio é uma pergunta com 4 alternativas. Acertou, avança; errou ou o tempo acabou, está eliminado.</li>
        <li>O tempo para responder cai a cada rodada: <b>${Trivia.TIMERS.R1}s</b> na 1ª rodada até <b>${Trivia.TIMERS.F}s</b> na final. As perguntas também ficam mais difíceis.</li>
        <li>Às vezes aparece a <b class="gold">Pergunta Bônus</b>: muito difícil e com ${Trivia.TIMERS.BONUS}s. Acertou, ${Trivia.BONUS_WINS} vitórias garantidas; errou, ${Trivia.BONUS_LOSSES} derrotas.</li>
        <li>Toda carreira começa aos ${Trivia.START_AGE} anos, em 2026. Nenhuma pergunta se repete na mesma carreira. Sem eventos, sem rivais. Aposentadoria obrigatória aos ${Trivia.RETIRE_AGE} anos.</li>
      </ul>
    </section>` : ''}
    <div class="btn-row" style="margin-top:20px">
      <button class="btn btn-primary" id="startBtn" ${ready ? '' : 'disabled'}>${tv ? 'Começar carreira no Trivia' : 'Começar carreira'}</button>
    </div>
    <p class="draw-hint" style="margin-top:10px">${ready ? '' : tv ? 'Preencha o nome para começar.' : 'Preencha o nome e faça os dois sorteios para começar.'}</p>`;
  }
  function draftReady() { return !!(draft.name.trim() && (draft.mode === 'trivia' || (draft.age && draft.ovr))); }
  function drawBlock(key, title, opts, label) {
    const v = draft[key];
    return `<section class="panel draw">
      <div class="eyebrow">${title}</div>
      <div class="draw-opts" id="draw-${key}">${opts.map(o => `<div class="draw-opt ${v === o ? 'won' : ''}" data-v="${o}">${o}</div>`).join('')}</div>
      <button class="btn ${v ? 'btn-ghost' : 'btn-primary'}" data-draw="${key}" ${v ? 'disabled' : ''}>${v ? 'Sorteado' : label}</button>
    </section>`;
  }
  function runDraw(key) {
    const box = document.getElementById('draw-' + key);
    const cells = [...box.children];
    const btn = document.querySelector(`[data-draw="${key}"]`);
    btn.disabled = true;
    const final = Engine.randInt(0, 2);
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const steps = reduce ? 1 : 14 + final;   // termina no resultado
    const total = steps;
    let k = 0;
    const seq = [];
    for (let s = 0; s < total - 1; s++) seq.push(s % 3);
    const go = () => {
      cells.forEach(c => c.classList.remove('lit'));
      if (k >= seq.length) { draft[key] = +cells[final].dataset.v; render(); return; }
      cells[seq[k]].classList.add('lit'); k++;
      setTimeout(go, 55 + k * k * 1.7);
    };
    go();
  }

  // ---------- jogo ----------
  function viewGame() {
    if (isTrivia(state)) return viewTriviaGame();
    const s0 = state, p = s0.player, n = nation(p.nat), L = ui.live;
    // Durante a revelação, a temporada em andamento ainda não conta nos números do topo.
    const visible = L && L.complete ? s0.seasons.slice(0, -1) : s0.seasons;
    const s = L ? { ...s0, seasons: visible, age: L.age, ovr: L.ovr, year: L.year,
      bestRank: visible.reduce((m, x) => x.rank && (m === null || x.rank < m) ? x.rank : m, null),
      bestOvr: Math.max(s0.startOvr, L.ovr, ...visible.map(x => x.ovr)) } : s0;
    const st = Engine.careerStats(s);
    const last = s.seasons[s.seasons.length - 1];
    const curRank = last ? last.rank : null;
    const style = STYLES[p.style] || STYLES.allcourt;
    const specPill = (s.train ? `<span class="pill spec-${s.train}">Treino reforçado: ${Engine.SURFACE_NAME[s.train]} · ${s.year}</span>` : '')
      + (s.rival ? `<span class="pill rival">Rival: ${RIVALS[s.rival].name.split(' ').slice(-1)[0]} · ${s.rivalRecord.w}-${s.rivalRecord.l}</span>` : '');
    const suspPill = s.suspended > 0 && !s.retired ? `<span class="pill warn">Suspenso · ${s.suspended} ${s.suspended > 1 ? 'temporadas' : 'temporada'}</span>` : '';
    return `
    <section class="panel pcard">
      <div class="player">
        <div class="ovr ${tier(s.ovr)}"><small>OVR</small><b class="num">${s.ovr}</b></div>
        <div class="player-main">
          <div class="player-name">${esc(p.name)}</div>
          <div class="pills">
            <span class="pill"><span class="flag">${flag(n[0])}</span>${n[1]}</span>
            <span class="pill">${s.age} anos</span>
            <span class="pill">${p.hand}</span>
            <span class="pill">Backhand ${p.backhand === 'Uma mão' ? '1 mão' : '2 mãos'}</span>
            <span class="pill">${style.name}</span>
            <span class="pill">${EXP[p.exp][0]}</span>
            ${specPill}${suspPill}
          </div>
        </div>
      </div>
      <div class="stats">
        <div class="stat"><span>Rank atual</span><b>${curRank ? '#' + curRank : '–'}</b></div>
        <div class="stat"><span>Melhor rank</span><b>${s.bestRank ? '#' + s.bestRank : '–'}</b></div>
        <div class="stat"><span>Melhor OVR</span><b>${s.bestOvr}</b></div>
        <div class="stat"><span>V-D</span><b>${st.wins}-${st.losses}</b></div>
        <div class="stat"><span>Títulos</span><b>${st.titles}</b></div>
        <div class="stat"><span>Prêmios</span><b>${money(st.prize)}</b></div>
      </div>
    </section>

    <div class="main-row">
      <section class="panel vivo" id="vivo">${viewPanel()}</section>
      <section class="career-col">
    <div class="career-head">
      <div><span class="eyebrow">Carreira</span><h2>Temporada a temporada</h2></div>
      <span class="scroll-hint">Arraste a tabela para o lado →</span>
    </div>
    ${ui.live ? `<div class="live-strip"><span class="live-dot"></span><b id="stripNow">${ui.live.shown >= T.length ? 'Ranking final' : T[Math.min(ui.live.shown, T.length - 1)].name}</b><span id="stripLine" class="live-line ${ui.live.lineKind || ''}">${ui.live.lastLine || 'A temporada começou.'}</span><button class="btn btn-ghost" id="skipLive2">Pular</button></div>` : ''}
    ${viewTable()}
    <div class="legend">
      <span><span class="res W">W</span>Campeão</span><span><span class="res F">F</span>Vice</span><span><span class="res SF">SF</span>Semi</span>
      <span><span class="res QF">QF</span>Quartas</span><span><span class="res">R16</span>Oitavas</span><span><span class="res">R1–R3</span>Rodadas</span>
      <span><span class="res RR">RR</span>Grupos (Finals)</span><span><span class="res LES">LES</span>Lesão</span><span><span class="res SUSP">SUSP</span>Suspenso</span><span><span class="res FORA">FORA</span>Fora por evento</span>
      ${s.rival ? `<span><span class="res W vs">W</span>Final contra o rival</span>` : ''}
    </div>
      </section>
    </div>
    ${ui.modal ? viewModal() : ''}`;
  }

  // pop-up da final de Slam contra o rival
  function viewModal() {
    const s = state, n = nation(s.player.nat);
    if (ui.modal === 'rival' && s.pendingFinal) {
      const pf = s.pendingFinal, t = T.find(x => x.id === pf.tid), rn = rivalNation(s.rival);
      return `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="mTitle"><div class="modal-card">
        <span class="eyebrow">Final · ${t.name} ${s.year}</span>
        <h2 id="mTitle">Você contra o seu rival</h2>
        <div class="vs-row">
          <div class="who"><span class="flag">${flag(n[0])}</span><b>${esc(s.player.name)}</b></div>
          <span class="x">VS</span>
          <div class="who"><span class="flag">${flag(rn[0])}</span><b>${RIVALS[s.rival].name}</b></div>
        </div>
        <p class="muted">Sua chance de vencer esta final: <strong style="color:var(--fg)">${pct(pf.p)}</strong>. Como você quer jogar? Cada rival reage de um jeito à sua postura.</p>
        <div class="stack" style="gap:8px">${Engine.RIVAL_CHOICES.map((c, i) => `<button class="choice" data-rc="${i}"><strong>${c.name}</strong><span>${c.text}</span></button>`).join('')}</div>
      </div></div>`;
    }
    if (ui.modal === 'result' && s.lastRivalFinal) {
      const f = s.lastRivalFinal, c = Engine.RIVAL_CHOICES[f.choice], fx = Engine.RIVAL_FX[f.fx];
      return `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="mTitle"><div class="modal-card">
        <span class="eyebrow">Final · ${f.tname} ${f.year} · contra ${RIVALS[f.rival].name}</span>
        <div class="final-word ${f.win ? 'win' : 'loss'}" id="mTitle">${f.win ? 'Campeão!' : 'Vice-campeão'}</div>
        ${f.score ? `<div class="rf-score big">${f.score.split(' ').map(x => `<i class="${/^(\d+)-(\d+)/.exec(x) && +RegExp.$1 > +RegExp.$2 ? 'won' : 'lost'}">${x}</i>`).join('')}</div>` : ''}
        <p class="muted" style="text-align:center">${f.win ? `Você venceu ${RIVALS[f.rival].name.split(' ')[0]} na final.` : `${RIVALS[f.rival].name.split(' ')[0]} levou a melhor desta vez.`} Retrospecto em finais de Slam: ${s.rivalRecord.w}-${s.rivalRecord.l}.</p>
        <div class="fx">
          <div><span>Sua postura</span><b>${c.name}</b></div>
          <div><span>Impacto contra ele</span><b class="${f.fx}">${fx.label}</b></div>
          <div><span>Chance base</span><b>${pct(f.pBase)}</b></div>
          <div><span>Chance com a postura</span><b class="${f.fx}">${pct(f.p)}</b></div>
        </div>
        <button class="btn btn-primary" id="rivalContinue">Continuar temporada</button>
      </div></div>`;
    }
    return '';
  }

  function viewLive() {
    const L = ui.live, t = T[Math.min(L.shown, T.length - 1)];
    const ch = ui.chain ? ` · ${ui.chain.total - ui.chain.left + 1} de ${ui.chain.total}` : '';
    return `<span class="eyebrow"><span class="live-dot"></span>Temporada ${L.year} · ao vivo${ch}</span>
      <div class="live-now" id="liveNow">${L.shown >= T.length ? 'Ranking final' : t.name}</div>
      <div class="live-surf" id="liveSurf">${liveSurfHtml()}</div>
      <div class="live-progress" aria-hidden="true"><span id="liveBar" style="width:${Math.round(L.shown / 12 * 100)}%"></span></div>
      <p class="live-line" id="liveLine">${L.lastLine || 'A temporada começou.'}</p>
      <div class="season-sum" id="liveTally">${liveTally()}</div>
      <div class="actions"><button class="btn btn-ghost" id="skipLive">Pular para o fim</button></div>`;
  }
  // V7: OVR vivo — no torneio em andamento, mostra o OVR com o bônus/penalidade da superfície
  function liveMod(i) {
    const L = ui.live, t = T[i];
    let m = (STYLES[state.player.style] || STYLES.allcourt).mod[t.surface] || 0;
    if (L.train) m += L.train === t.surface ? 3 : -1;
    return m;
  }
  function livePlaying() {
    const L = ui.live; if (!L || L.shown >= T.length) return -1;
    const r = L.results[T[L.shown].id];
    return r && ['LES', 'SUSP', 'FORA', 'EST', '-'].includes(r.label) ? -1 : L.shown;
  }
  function liveOvrHtml() {
    const L = ui.live, i = livePlaying();
    const m = i < 0 ? 0 : liveMod(i), v = Math.max(1, Math.min(99, L.ovr + m));
    return m ? `<span class="ovr-live ${m > 0 ? 'up' : 'down'}">${v}<i>${m > 0 ? '▲' : '▼'}</i></span>` : `<span class="ovr-live">${L.ovr}</span>`;
  }
  function liveSurfHtml() {
    const L = ui.live, i = livePlaying();
    if (i < 0) return '';
    const t = T[i], m = liveMod(i), v = Math.max(1, Math.min(99, L.ovr + m));
    return `${court(t.surface)}<span>Quadra ${Engine.SURFACE_NAME[t.surface].toLowerCase()}</span>`
      + (m ? `<span class="ovr-live ${m > 0 ? 'up' : 'down'}">OVR ${L.ovr} → ${v}<i>${m > 0 ? '▲' : '▼'}</i></span>` : `<span class="muted">OVR ${L.ovr}</span>`);
  }
  function liveTally() {
    const L = ui.live; let ti = 0, w = 0, l = 0, pts = 0;
    T.slice(0, Math.min(L.shown, T.length)).forEach(t => { const r = L.results[t.id]; if (!r) return; ti += r.label === 'W'; w += r.wins; l += r.losses; pts += r.pts; });
    return `<div><span>Títulos</span><b>${ti}</b></div><div><span>V-D</span><b>${w}-${l}</b></div><div><span>Pontos</span><b>${pts.toLocaleString('pt-BR')}</b></div><div><span>Rank</span><b>${L.shown > T.length && L.rank ? '#' + L.rank : '…'}</b></div>`;
  }

  // ---------- painel em etapas (V6) ----------
  // decisão → desfecho + simular → ao vivo → resumo da temporada → avançar para o próximo ano
  function viewPanel() {
    const s = state;
    if (ui.live) return viewLive();
    if (ui.chainWait) return viewChainWait();
    if (s.awaitingAdvance || s.retired) return viewSeasonEnd();
    if (s.pendingRival) {
      const r = RIVALS[s.pendingRival], rn = rivalNation(s.pendingRival);
      return `<span class="pill tag rival">Rival novo</span>
        <h2>Alguém quer o seu trono</h2>
        <div class="rival-card flash"><span class="flag">${flag(rn[0])}</span><div><div class="rival-name">${r.name}</div><span class="muted">${rn[2]}</span></div></div>
        <p class="muted">Depois de duas temporadas no Top 5, você ganhou um rival. A cada duas finais de Grand Slam que você alcançar, a final será contra ele, e você escolhe como jogar.</p>
        <div class="btn-row"><button class="btn btn-primary" id="ackRival">Aceitar o desafio</button></div>`;
    }
    if (s.pendingEvent) {
      const ev = Engine.getEvent(s.pendingEvent);
      const odds = Engine.eventOdds(ev);
      const good = odds.accept.find(o => o.kind === 'good');
      return `<span class="pill tag ${ev.special ? 'special' : ''}">${ev.special ? 'Evento especial' : 'Decisão'} · ${ev.choice ? 'Escolha' : 'Teste de sorte'} · ${s.year}</span>
        <h2>${ev.title}</h2><p class="muted">${ev.text}</p>
        ${ev.special ? `<p class="special-req">Desbloqueado: ${esc(ev.special.req)}.</p>` : ''}
        <div class="odds">
          <div class="odds-col"><span class="odds-h">Se aceitar</span>
            ${odds.accept.length > 1 ? `<div class="odds-bar" aria-hidden="true"><span class="g" style="width:${good.p * 100}%"></span><span class="b" style="flex:1"></span></div>` : ''}
            ${odds.accept.map(o => `<div class="odd ${o.kind}"><b>${pct(o.p)}</b><span>${esc(o.text)}</span></div>`).join('')}
          </div>
          <div class="odds-col"><span class="odds-h">Se recusar</span><div class="odd none"><b>100%</b><span>${esc(ev.refuse || 'Nada acontece')}</span></div></div>
        </div>
        <div class="btn-row"><button class="btn btn-primary" data-ev="1">Aceitar</button><button class="btn btn-ghost" data-ev="0">Recusar</button></div>`;
    }
    return viewReady();
  }

  function viewReady() {
    const s = state;
    let body;
    if (s.lastEvent) {
      const e = s.lastEvent;
      const d = e.suspend ? `${e.suspend}A` : e.party ? (e.party > 1 ? '+10%' : '−10%') : e.ovrDelta ? (e.ovrDelta > 0 ? '+' : '−') + Math.abs(e.ovrDelta) : e.miss ? `−${e.miss}T` : e.kind === 'good' ? '✓' : '0';
      body = `<span class="eyebrow">Decisão da temporada ${s.year}</span><h2>${e.title}</h2>
        <div class="result flash"><span class="delta ${e.kind}">${d}</span><div><strong>${e.accepted ? (e.kind === 'good' ? 'Deu certo' : 'Deu errado') : 'Recusado'}</strong><p class="muted">${esc(e.msg)}${e.accepted && e.effect ? ` ${esc(e.effect)}.` : ''}</p></div></div>`;
    } else if (!s.seasons.length) {
      body = `<span class="eyebrow">Temporada ${s.year}</span><h2>Pronto para a estreia</h2>
        <p class="muted">Sua temporada tem 4 Grand Slams, 6 Masters 1000 e o ATP Finals para os 8 melhores do ano. Cada fase alcançada soma pontos, vitórias e prêmio.</p>
        <div class="pills">${T.map(t => `<span class="pill" title="${t.name}">${court(t.surface)} ${t.short}</span>`).join('')}</div>`;
    } else {
      body = `<span class="eyebrow">Temporada ${s.year}</span><h2>Sem decisões</h2><p class="empty">Nenhum evento nesta temporada. Hora de jogar.</p>`;
    }
    const multi = s.player.exp === 'express';
    let actions = `<button class="btn btn-primary" id="simBtn">${multi ? `Simular temporadas ${s.year}–${s.year + 2}` : `Simular temporada ${s.year}`}</button>`;
    if (s.age >= 30) {
      actions += ui.confirm === 'retire'
        ? `<div class="confirm"><strong>Encerrar a carreira agora, aos ${s.age} anos?</strong><div class="btn-row"><button class="btn btn-danger" id="retireYes">Sim, aposentar</button><button class="btn btn-ghost" id="retireNo">Continuar jogando</button></div></div>`
        : `<button class="btn btn-ghost" id="retireBtn">Aposentar</button>`;
    }
    return body + `<div class="actions">${actions}</div>`;
  }

  // entre temporadas de um bloco Express
  function viewChainWait() {
    const s = state, last = s.seasons[s.seasons.length - 1], ch = ui.chain;
    return `<span class="eyebrow"><span class="live-dot"></span>Bloco Express · ${ch.total - ch.left} de ${ch.total} concluídas</span>
      <div class="live-now">Indo para ${s.year}</div>
      <p class="live-line">Temporada ${last.year} encerrada: ${last.rank ? 'rank #' + last.rank : 'sem ranking'}, ${last.titles} título${last.titles === 1 ? '' : 's'}.</p>
      <div class="actions"><button class="btn btn-ghost" id="skipLive">Pular para o fim</button></div>`;
  }

  // destaques de uma temporada (títulos, ATP Finals, rival, lesões, eventos)
  function seasonItems(se) {
    const items = [];
    const news = se.news || (state.lastSeasonNews && state.lastSeasonNews.year === se.year ? state.lastSeasonNews.items : []);
    news.forEach(i => items.push(i));
    const titles = T.filter(t => se.results[t.id].label === 'W').map(t => t.name);
    if (titles.length) items.push({ kind: 'gold', text: `Título${titles.length > 1 ? 's' : ''}: ${titles.join(', ')}.` });
    T.filter(t => se.results[t.id].rival).forEach(t => { const r = se.results[t.id];
      items.push({ kind: r.label === 'W' ? 'good' : 'bad', text: `Final contra ${RIVALS[r.rival].name} em ${t.name}: ${r.label === 'W' ? 'campeão' : 'vice'}${r.score ? ` (${r.score})` : ''}.` }); });
    const fr = se.results.FIN.label;
    if (!['-', 'SUSP', 'LES'].includes(fr)) items.push({ kind: 'good', text: `Classificado para o ATP Finals (${resTitle[fr].toLowerCase()}).` });
    return items;
  }

  // resumo de fim de temporada (ou do bloco Express) com o botão para avançar
  function viewSeasonEnd() {
    const s = state;
    const years = s.awaitingAdvance ? s.awaitingAdvance.years : (s.seasons.length ? [s.seasons[s.seasons.length - 1].year] : []);
    const list = s.seasons.filter(se => years.includes(se.year));
    const action = s.retired
      ? `<div class="end-note"><strong>Fim de carreira.</strong> ${esc(s.retireReason || '')}</div><div class="actions"><button class="btn btn-primary" id="toSummary">Ver resumo da carreira</button></div>`
      : `<div class="actions"><button class="btn btn-primary" id="advanceBtn">Avançar para ${s.year}</button></div>`;
    if (!list.length) return `<span class="eyebrow">Fim de carreira</span><h2>Aposentado</h2>` + action;
    const lastSe = list[list.length - 1];
    const ovrLine = isTrivia(s) ? (lastSe.answered ? `<div class="news-line ${lastSe.acc >= 0.8 ? 'good' : lastSe.acc < 0.6 ? 'bad' : ''}"><i></i><span>Acertos na temporada: ${lastSe.correct} de ${lastSe.answered} (${Math.round(lastSe.acc * 100)}%).</span></div>` : '') : s.retired ? '' : (() => {
      const from = list.length > 1 ? list[0].ovrStart : lastSe.ovr, d = s.ovr - from;
      const txt = list.length > 1 ? `OVR ${from} → ${s.ovr} para ${s.year}` : (lastSe.nextDelta ? `${lastSe.nextDelta > 0 ? 'Evolução' : 'Desgaste da idade'}: ${lastSe.nextDelta > 0 ? '+' : ''}${lastSe.nextDelta} OVR para ${s.year} (${s.ovr})` : `Overall estável para ${s.year} (${s.ovr})`);
      return `<div class="news-line ${d > 0 ? 'good' : d < 0 ? 'bad' : ''}"><i></i><span>${txt}.</span></div>`;
    })();
    if (list.length === 1) {
      const se = list[0], items = seasonItems(se);
      if (!items.length) items.push({ kind: '', text: 'Temporada sem títulos nem lesões.' });
      return `<span class="eyebrow">Fim de temporada · ${se.year}</span>
        <h2 class="end-title">${se.rank ? `Rank #${se.rank}` : 'Sem ranking'}</h2>
        <div class="season-sum">
          <div><span>Títulos</span><b>${se.titles}</b></div>
          <div><span>V-D</span><b>${se.wins}-${se.losses}</b></div>
          <div><span>Pontos</span><b>${se.pts.toLocaleString('pt-BR')}</b></div>
          <div><span>Prêmio</span><b>${money(se.prize)}</b></div>
        </div>
        <div class="news">${items.map(i => `<div class="news-line ${i.kind} flash"><i></i><span>${esc(i.text)}</span></div>`).join('')}${ovrLine}</div>
        ${action}`;
    }
    const tot = list.reduce((a, se) => ({ t: a.t + se.titles, w: a.w + se.wins, l: a.l + se.losses, p: a.p + se.prize }), { t: 0, w: 0, l: 0, p: 0 });
    const items = list.flatMap(se => seasonItems(se).map(i => ({ ...i, text: `${se.year} · ${i.text}` })));
    return `<span class="eyebrow">Fim do bloco Express · ${list[0].year}–${lastSe.year}</span>
      <h2 class="end-title">${list.length} temporadas</h2>
      <table class="block-table">
        <thead><tr><th>Ano</th><th>Rank</th><th>Títulos</th><th>V-D</th><th>Prêmio</th></tr></thead>
        <tbody>${list.map(se => `<tr><td>${se.year}</td><td>${se.rank ? '#' + se.rank : '–'}</td><td>${se.titles}</td><td>${se.wins}-${se.losses}</td><td>${money(se.prize)}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td>Total</td><td></td><td>${tot.t}</td><td>${tot.w}-${tot.l}</td><td>${money(tot.p)}</td></tr></tfoot>
      </table>
      <div class="news">${items.map(i => `<div class="news-line ${i.kind} flash"><i></i><span>${esc(i.text)}</span></div>`).join('') || '<div class="news-line"><i></i><span>Bloco sem títulos nem lesões.</span></div>'}${ovrLine}</div>
      ${action}`;
  }

  function resChip(t, r, year, extra = '') {
    const cls = (r.label === '-' ? 'none' : r.label) + (r.rival ? ' vs' : '');
    const tip = `${t.name} ${year}: ${resTitle[r.label]}${r.rival ? ` contra ${RIVALS[r.rival].name}` : ''}${r.cause ? ` (${r.cause})` : ''}${r.pts ? ` · ${r.pts} pts · ${money(r.prize)}` : ''}`;
    return `<span class="res ${cls} ${extra}" title="${tip}">${resLabel[r.label]}</span>`;
  }
  function liveCell(i) {
    const L = ui.live;
    if (i === T.length) return L.shown > T.length ? `<span class="pop" style="display:inline-block">${L.rank || '–'}</span>` : (L.shown === T.length && L.complete ? '<span class="res playing">·</span>' : '·');
    if (i < L.shown) return resChip(T[i], L.results[T[i].id], L.year);
    if (i === L.shown) return `<span class="res playing">${L.paused && i === L.limit ? 'F' : '·'}</span>`;
    return '<span class="res wait">·</span>';
  }
  function viewTable() {
    const s = state, L = ui.live;
    const seasons = L && L.complete ? s.seasons.slice(0, -1) : s.seasons;
    // V5: temporada mais recente no topo
    const rows = seasons.map((se, i) => `<tr class="${ui.fresh && i === seasons.length - 1 ? 'fresh' : ''}">
      <td class="c-year sticky">${se.year}</td><td class="c-age">${se.age}</td><td class="c-ovr">${se.ovr}</td>
      ${T.map(t => `<td>${resChip(t, se.results[t.id], se.year)}</td>`).join('')}
      <td class="c-rank">${se.rank ? se.rank : '–'}</td></tr>`).reverse().join('');
    const pending = L
      ? `<tr class="live"><td class="c-year sticky">${L.year}</td><td class="c-age">${L.age}</td><td class="c-ovr" id="liveOvr">${liveOvrHtml()}</td>${T.map((t, i) => `<td data-live="${i}">${liveCell(i)}</td>`).join('')}<td class="c-rank" data-live="${T.length}">${liveCell(T.length)}</td></tr>`
      : s.retired ? '' : `<tr class="pending"><td class="c-year sticky">${s.year}</td><td class="c-age">${s.age}</td><td class="c-ovr">${s.ovr}</td>${T.map(() => '<td>·</td>').join('')}<td class="c-rank">·</td></tr>`;
    return `<div class="table-scroll"><table class="career">
      <thead><tr><th class="sticky">Ano</th><th>Idade</th><th>OVR</th>${T.map(t => `<th title="${t.name}">${court(t.surface)}${t.short}</th>`).join('')}<th>Rank</th></tr></thead>
      <tbody>${pending}${rows}</tbody></table></div>`;
  }

  // ---------- modo Trivia ----------
  const pctAcc = x => `${Math.round(x * 100)}%`;
  const fmtSec = ms => `${(ms / 1000).toFixed(1).replace('.', ',')} s`;
  const deOf = t => ['AO', 'USO', 'FIN', 'MC'].includes(t.id) ? 'do' : 'de';
  const ROUND_SHORT = { R1: 'R1', R2: 'R2', R3: 'R3', R16: 'R16', QF: 'QF', SF: 'SF', F: 'F', RR: 'RR' };

  function viewTriviaGame() {
    const s = state, p = s.player, n = nation(p.nat);
    const st = Engine.careerStats(s), tst = Trivia.stats(s);
    const last = s.seasons[s.seasons.length - 1];
    const bonusPill = s.autoWins > 0 ? `<span class="pill bonus-pill">Bônus: ${s.autoWins} ${s.autoWins > 1 ? 'vitórias garantidas' : 'vitória garantida'}</span>`
      : s.autoLosses > 0 ? `<span class="pill warn">Bônus: ${s.autoLosses} ${s.autoLosses > 1 ? 'derrotas' : 'derrota'} pela frente</span>` : '';
    const I = s.inSeason, bonusOn = I && ((I.phase === 'question' && I.cur && I.cur.bonus) || I.phase === 'offer');
    return `
    <section class="panel pcard">
      <div class="player">
        <div class="ovr acc-box"><small>Acerto</small><b class="num">${tst.n ? Math.round(tst.acc * 100) : '–'}${tst.n ? '<i>%</i>' : ''}</b></div>
        <div class="player-main">
          <div class="player-name">${esc(p.name)}</div>
          <div class="pills">
            <span class="pill"><span class="flag">${flag(n[0])}</span>${n[1]}</span>
            <span class="pill">${s.age} anos</span>
            ${p.hand ? `<span class="pill">${p.hand}</span>` : ''}
            <span class="pill trivia">Trivia</span>
            ${bonusPill}
          </div>
        </div>
      </div>
      <div class="stats">
        <div class="stat"><span>Rank atual</span><b>${last && last.rank ? '#' + last.rank : '–'}</b></div>
        <div class="stat"><span>Melhor rank</span><b>${s.bestRank ? '#' + s.bestRank : '–'}</b></div>
        <div class="stat"><span>Acertos</span><b>${tst.ok}/${tst.n}</b></div>
        <div class="stat"><span>V-D</span><b>${st.wins}-${st.losses}</b></div>
        <div class="stat"><span>Títulos</span><b>${st.titles}</b></div>
        <div class="stat"><span>Prêmios</span><b>${money(st.prize)}</b></div>
      </div>
    </section>
    <div class="main-row">
      <section class="panel vivo tvivo ${bonusOn ? 'is-bonus' : ''}" id="vivo">${viewTriviaPanel()}</section>
      <section class="career-col">
        <div class="career-head">
          <div><span class="eyebrow">Carreira · Trivia</span><h2>Temporada a temporada</h2></div>
          <span class="scroll-hint">Arraste a tabela para o lado →</span>
        </div>
        ${viewTriviaTable()}
        <div class="legend">
          <span><span class="res W">W</span>Campeão</span><span><span class="res F">F</span>Vice</span><span><span class="res SF">SF</span>Semi</span>
          <span><span class="res QF">QF</span>Quartas</span><span><span class="res">R16</span>Oitavas</span><span><span class="res">R1–R3</span>Rodadas</span>
          <span><span class="res RR">RR</span>Grupos (Finals)</span><span><span class="res none">–</span>Não classificado</span>
        </div>
      </section>
    </div>`;
  }

  function viewTriviaPanel() {
    const s = state;
    if (s.awaitingAdvance || s.retired) return viewSeasonEnd();
    if (!s.inSeason) return viewTriviaReady();
    const I = s.inSeason;
    const body = I.phase === 'question' ? viewQuestion() : I.phase === 'offer' ? viewOffer() : viewFeedback();
    return tourHeader() + body + triviaTally();
  }

  function tourHeader() {
    const I = state.inSeason, t = T[Math.min(I.ti, T.length - 1)], tr = I.tour;
    const kind = t.type === 'major' ? 'Grand Slam' : t.type === 'masters' ? 'Masters 1000' : 'Fim de temporada';
    let steps = '';
    if (tr) {
      const fb = I.fb, endedW = fb && fb.ended && fb.result && fb.result.label === 'W', endedL = fb && fb.ended && fb.result && !endedW && fb.result.label !== '-';
      if (t.type === 'finals') {
        const list = ['RR', 'RR', 'RR', 'SF', 'F'];
        const pos = tr.stage === 'RR' ? tr.rrPlayed : tr.stage === 'SF' ? 3 : 4;
        const lostAt = endedL ? (fb.result.label === 'RR' ? 2 : fb.result.label === 'SF' ? 3 : 4) : -1;
        steps = list.map((r, i) => `<i class="${i === lostAt ? 'lost' : endedW || (i < pos && !(lostAt >= 0 && i >= lostAt)) ? 'done' : i === pos && !(fb && fb.ended) ? 'cur' : ''}">${r}</i>`).join('');
      } else {
        steps = ['R1', 'R2', 'R3', 'R16', 'QF', 'SF', 'F'].map((r, i) => `<i class="${i < tr.start ? 'bye' : endedW || i < tr.ri ? 'done' : i === tr.ri && endedL ? 'lost' : i === tr.ri && !(fb && fb.ended) ? 'cur' : ''}">${r}</i>`).join('');
      }
    }
    return `<div class="tq-tour">${court(t.surface)}<div class="tq-tour-main"><span class="eyebrow">Temporada ${state.year} · ${kind} · ${Math.min(I.ti + 1, T.length)} de ${T.length}</span><div class="tq-tname">${t.name}</div></div></div>
      ${steps ? `<div class="tq-path" aria-hidden="true">${steps}</div>` : ''}`;
  }
  function triviaTally() {
    const I = state.inSeason; let ti = 0, w = 0, l = 0, pts = 0;
    Object.values(I.results).forEach(r => { ti += r.label === 'W'; w += r.wins; l += r.losses; pts += r.pts; });
    return `<div class="season-sum tally"><div><span>Títulos</span><b>${ti}</b></div><div><span>V-D</span><b>${w}-${l}</b></div><div><span>Pontos</span><b>${pts.toLocaleString('pt-BR')}</b></div><div><span>Acertos</span><b>${I.ok}/${I.n}</b></div></div>`;
  }

  function viewQuestion() {
    const c = state.inSeason.cur;
    const left = c.deadline ? Math.max(0, c.deadline - Date.now()) : c.limit * 1000;
    return `<div class="tq ${c.bonus ? 'bonus' : ''}">
      ${c.bonus ? `<div class="bonus-badge"><b>★ Pergunta Bônus</b><span>Acertou: ${Trivia.BONUS_WINS} vitórias garantidas · Errou: ${Trivia.BONUS_LOSSES} derrotas</span></div>` : ''}
      <div class="tq-meta"><b>${esc(c.label)}</b><span class="tq-diff d${c.d}">${Trivia.TIER_NAME[c.d]}</span><span class="tq-cat">${esc(c.cat)}</span></div>
      <div class="tq-timer" role="timer" aria-label="Tempo restante"><div class="tq-bar"><span id="tqBar" style="width:${left / (c.limit * 10)}%"></span></div><b id="tqSec" class="num">${Math.ceil(left / 1000)}</b></div>
      <p class="tq-q">${esc(c.q)}</p>
      <div class="tq-opts">${c.opts.map((o, i) => `<button class="tq-opt" data-opt="${i}"><kbd>${'ABCD'[i]}</kbd><span>${esc(o)}</span></button>`).join('')}</div>
      <p class="tq-hint">No teclado: 1 a 4 ou A a D</p>
    </div>`;
  }

  function viewOffer() {
    const c = state.inSeason.cur;
    return `<div class="tq bonus offer">
      <div class="bonus-badge"><b>★ Pergunta Bônus</b><span>Aparece de surpresa, no máximo uma vez por torneio</span></div>
      <h2>Arrisca tudo?</h2>
      <p class="muted">Antes da partida (${esc(c.label.toLowerCase())}) surgiu uma pergunta muito difícil, com só ${Trivia.TIMERS.BONUS} segundos para responder.</p>
      <div class="odds">
        <div class="odds-col"><span class="odds-h">Se acertar</span><div class="odd good"><b>+${Trivia.BONUS_WINS}</b><span>Vence esta partida e as próximas ${Trivia.BONUS_WINS - 1}, sem precisar responder.</span></div></div>
        <div class="odds-col"><span class="odds-h">Se errar</span><div class="odd bad"><b>−${Trivia.BONUS_LOSSES}</b><span>Perde esta partida e a próxima (mesmo que seja em outro torneio).</span></div></div>
      </div>
      <div class="btn-row"><button class="btn btn-gold" id="bonusYes">Encarar a Pergunta Bônus</button><button class="btn btn-ghost" id="bonusNo">Jogar a partida normal</button></div>
    </div>`;
  }

  function viewFeedback() {
    const I = state.inSeason, f = I.fb, t = T[Math.min(I.ti, T.length - 1)];
    let word, kind, detail = '';
    if (f.skip) { word = 'Fora do Finals'; kind = 'neutral'; detail = `<p class="muted">Você fechou os 10 torneios em ${f.rank ? '#' + f.rank : 'sem ranking'}. Só os 8 melhores do ano jogam o ATP Finals.</p>`; }
    else if (f.auto) {
      word = f.auto === 'win' ? 'Vitória garantida' : 'Derrota do bônus'; kind = f.auto === 'win' ? 'win' : 'loss';
      detail = `<p class="muted">${esc(f.label)}: ${f.auto === 'win' ? 'a Pergunta Bônus garantiu esta vitória' : 'a Pergunta Bônus errada custou esta partida'}.${f.left ? ` ${f.auto === 'win' ? 'Ainda resta' : 'Ainda falta'} ${f.left} ${f.auto === 'win' ? (f.left > 1 ? 'vitórias garantidas' : 'vitória garantida') : (f.left > 1 ? 'derrotas' : 'derrota')}.` : ''}</p>`;
    } else {
      word = f.ok ? 'Acertou!' : f.timeout ? 'Tempo esgotado' : 'Errou'; kind = f.ok ? 'win' : 'loss';
      detail = `<p class="tq-q small">${esc(f.q)}</p>
        <div class="tq-opts review">${f.opts.map((o, i) => `<div class="tq-opt ${i === f.ans ? 'right' : i === f.chosen ? 'wrong' : 'dim'}"><kbd>${'ABCD'[i]}</kbd><span>${esc(o)}</span>${i === f.ans ? '<em>Certa</em>' : i === f.chosen ? '<em>Sua resposta</em>' : ''}</div>`).join('')}</div>
        <p class="muted tq-time">${f.timeout ? 'O relógio zerou antes da resposta.' : `Respondeu em ${fmtSec(f.ms)}.`}${f.bonus ? (f.ok ? ` Pergunta Bônus certa: esta vitória e mais ${Trivia.BONUS_WINS - 1} garantidas.` : ` Pergunta Bônus errada: esta derrota e mais ${Trivia.BONUS_LOSSES - 1}.`) : ''}</p>
        ${f.note ? `<p class="tq-note">${esc(f.note)}</p>` : ''}`;
    }
    let outcome = '';
    if (f.ended && f.result && f.result.label !== '-') {
      const r = f.result;
      outcome = r.label === 'W'
        ? `<div class="tq-out W">Campeão ${deOf(t)} ${t.name}! <span>+${r.pts.toLocaleString('pt-BR')} pts · ${money(r.prize)}</span></div>`
        : `<div class="tq-out">${t.type === 'finals' && r.label === 'RR' ? 'Eliminado na fase de grupos' : `Fim de torneio: ${resTitle[r.label].toLowerCase()}`} <span>+${r.pts.toLocaleString('pt-BR')} pts · ${money(r.prize)}</span></div>`;
    } else if (f.advancedRR) outcome = `<div class="tq-out good">Classificado para a semifinal do ATP Finals!</div>`;
    const lastT = I.ti + 1 >= T.length;
    const next = f.ended ? (lastT ? 'Encerrar a temporada' : `Próximo torneio: ${T[I.ti + 1].name}`) : `Próxima partida: ${Trivia.matchLabel(state).toLowerCase()}`;
    return `<div class="tq fb">
      <div class="final-word ${kind}">${word}</div>
      ${detail}${outcome}
      <div class="actions"><button class="btn btn-primary" id="tqNext">${next}</button></div>
    </div>`;
  }

  function viewTriviaReady() {
    const s = state, first = !s.seasons.length;
    let actions = `<button class="btn btn-primary" id="tStart">Começar a temporada ${s.year}</button>`;
    if (s.age >= Trivia.RETIRE_BUTTON_AGE) {
      actions += ui.confirm === 'retire'
        ? `<div class="confirm"><strong>Encerrar a carreira agora, aos ${s.age} anos?</strong><div class="btn-row"><button class="btn btn-danger" id="retireYes">Sim, aposentar</button><button class="btn btn-ghost" id="retireNo">Continuar jogando</button></div></div>`
        : `<button class="btn btn-ghost" id="retireBtn">Aposentar</button>`;
    }
    return `<span class="eyebrow">Temporada ${s.year} · ${s.age} anos</span>
      <h2>${first ? 'Pronto para a estreia?' : 'Nova temporada'}</h2>
      <p class="muted">${first ? 'São 4 Grand Slams, 6 Masters 1000 e o ATP Finals para os 8 melhores do ano. Cada rodada é uma pergunta: acerte para avançar.' : `Faltam ${Trivia.RETIRE_AGE - s.age} ${Trivia.RETIRE_AGE - s.age === 1 ? 'temporada' : 'temporadas'} até a aposentadoria obrigatória aos ${Trivia.RETIRE_AGE}.`}</p>
      <div class="timers">${['R1', 'R2', 'R3', 'R16', 'QF', 'SF', 'F'].map(r => `<div><span>${r}</span><b>${Trivia.TIMERS[r]}s</b></div>`).join('')}</div>
      ${s.autoWins || s.autoLosses ? `<div class="end-note">Efeito da Pergunta Bônus para esta temporada: ${s.autoWins ? `${s.autoWins} ${s.autoWins > 1 ? 'vitórias garantidas' : 'vitória garantida'}` : `${s.autoLosses} ${s.autoLosses > 1 ? 'derrotas' : 'derrota'}`}.</div>` : ''}
      <div class="actions">${actions}</div>`;
  }

  function viewTriviaTable() {
    const s = state, I = s.inSeason;
    const accCell = v => v == null ? '–' : `${Math.round(v * 100)}%`;
    const rows = s.seasons.map((se, i) => `<tr class="${ui.fresh && i === s.seasons.length - 1 ? 'fresh' : ''}">
      <td class="c-year sticky">${se.year}</td><td class="c-age">${se.age}</td><td class="c-ovr">${accCell(se.acc)}</td>
      ${T.map(t => `<td>${resChip(t, se.results[t.id], se.year)}</td>`).join('')}
      <td class="c-rank">${se.rank ? se.rank : '–'}</td></tr>`).reverse().join('');
    let pending = '';
    if (I) {
      const k = I.ti < T.length && I.tour ? Trivia.roundKey(state) : null;
      pending = `<tr class="live"><td class="c-year sticky">${s.year}</td><td class="c-age">${s.age}</td><td class="c-ovr">${I.n ? accCell(I.ok / I.n) : '·'}</td>${T.map((t, i) => {
        const r = I.results[t.id];
        if (r) return `<td data-live="${i}">${resChip(t, r, s.year)}</td>`;
        if (i === I.ti) return `<td data-live="${i}"><span class="res playing">${k ? ROUND_SHORT[k] : '·'}</span></td>`;
        return `<td data-live="${i}"><span class="res wait">·</span></td>`;
      }).join('')}<td class="c-rank">·</td></tr>`;
    } else if (!s.retired) pending = `<tr class="pending"><td class="c-year sticky">${s.year}</td><td class="c-age">${s.age}</td><td class="c-ovr">·</td>${T.map(() => '<td>·</td>').join('')}<td class="c-rank">·</td></tr>`;
    return `<div class="table-scroll"><table class="career">
      <thead><tr><th class="sticky">Ano</th><th>Idade</th><th title="Aproveitamento nas perguntas">Acerto</th>${T.map(t => `<th title="${t.name}">${court(t.surface)}${t.short}</th>`).join('')}<th>Rank</th></tr></thead>
      <tbody>${pending}${rows}</tbody></table></div>`;
  }

  function viewTriviaStats(tst) {
    const bar = (label, m) => m && m.n ? `<div class="tbar"><span class="tbar-l">${label}</span><span class="tbar-t"><i style="width:${Math.round(m.ok / m.n * 100)}%"></i></span><span class="tbar-v">${m.ok}/${m.n} · <b>${pctAcc(m.ok / m.n)}</b></span></div>` : '';
    const roundOrder = ['R1', 'R2', 'R3', 'R16', 'QF', 'SF', 'F', 'RR', 'BONUS'];
    const roundName = { ...Trivia.ROUND_NAME, BONUS: 'Pergunta Bônus' };
    const cats = Object.entries(tst.byCat).sort((a, b) => b[1].n - a[1].n);
    const b = tst.bonus;
    return `<h2 class="section-title">Desempenho no Trivia</h2>
    <div class="big-stats tstats">
      <div><span>Perguntas</span><b>${tst.n}</b></div>
      <div><span>Acertos</span><b>${tst.ok}</b></div>
      <div><span>Erros</span><b>${tst.wrong}</b></div>
      <div><span>Tempo esgotado</span><b>${tst.timeouts}</b></div>
      <div><span>Melhor sequência</span><b>${tst.bestStreak}</b></div>
      <div><span>Tempo médio</span><b>${tst.n ? fmtSec(tst.avgMs) : '–'}</b></div>
      <div><span>Mais rápida</span><b>${tst.fastest != null ? fmtSec(tst.fastest) : '–'}</b></div>
      <div><span>Pergunta Bônus</span><b>${b.w}-${b.l}</b><small>${b.offered} oferecida${b.offered === 1 ? '' : 's'} · ${b.declined} recusada${b.declined === 1 ? '' : 's'}</small></div>
    </div>
    <div class="tbars-grid">
      <section class="panel"><h3>Por dificuldade</h3>${[1, 2, 3, 4].map(d => bar(Trivia.TIER_NAME[d], tst.byTier[d])).join('') || '<p class="muted">Sem respostas.</p>'}</section>
      <section class="panel"><h3>Por rodada</h3>${roundOrder.map(r => bar(roundName[r], tst.byRound[r])).join('') || '<p class="muted">Sem respostas.</p>'}</section>
      <section class="panel"><h3>Por tema</h3>${cats.map(([c, m]) => bar(esc(c), m)).join('') || '<p class="muted">Sem respostas.</p>'}</section>
    </div>
    ${tst.missed.length ? `<details class="rdetails"><summary><span class="chev" aria-hidden="true">▸</span>Revise as ${tst.missed.length === 40 ? 'últimas 40 perguntas' : tst.missed.length + (tst.missed.length === 1 ? ' pergunta' : ' perguntas')} que você errou</summary>
      <div class="missed">${tst.missed.map(m => `<div class="miss"><p>${esc(m.q)}</p><span><b>${esc(m.a)}</b> · ${m.year} · ${m.bonus ? 'Pergunta Bônus' : Trivia.ROUND_NAME[m.round]}${m.timeout ? ' · tempo esgotado' : ''}</span></div>`).join('')}</div></details>` : ''}`;
  }

  // relógio da pergunta
  let tqTimer = null;
  function stopTriviaClock() { clearInterval(tqTimer); tqTimer = null; }
  // V9: o painel da pergunta fica no centro; se o jogador rolou até a tabela, volta para ele
  function showTriviaPanel() {
    const v = document.getElementById('vivo'); if (!v) return;
    const r = v.getBoundingClientRect();
    if (r.top < 0 || r.top > innerHeight * 0.45) v.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
  }
  function triviaAnswer(idx) {
    stopTriviaClock();
    if (!Trivia.answer(state, idx)) return;
    render();
    showTriviaPanel();
  }
  function afterRenderTrivia() {
    if (!isTrivia(state) || ui.view !== 'game' || !state.inSeason) return;
    const I = state.inSeason;
    // no celular, a tabela acompanha o torneio atual
    const cur = document.querySelector(`[data-live="${Math.min(I.ti, T.length - 1)}"]`), box = document.querySelector('.table-scroll');
    if (cur && box && box.scrollWidth > box.clientWidth) box.scrollLeft = Math.max(0, cur.offsetLeft - box.clientWidth / 2 + cur.offsetWidth / 2);
    if (I.phase === 'feedback') { const nb = document.getElementById('tqNext'); if (nb && isWide()) nb.focus({ preventScroll: true }); return; }
    if (I.phase !== 'question') return;
    Trivia.startClock(state);
    const c = I.cur;
    const tick = () => {
      const left = c.deadline - Date.now();
      const bar = document.getElementById('tqBar'), sec = document.getElementById('tqSec');
      if (bar) bar.style.width = `${Math.max(0, left / (c.limit * 10))}%`;
      if (sec) { sec.textContent = Math.max(0, Math.ceil(left / 1000)); sec.parentElement.classList.toggle('warn', left <= 5000); }
      if (left <= 0) triviaAnswer(null);
    };
    tick();
    if (state.inSeason && state.inSeason.phase === 'question') tqTimer = setInterval(tick, 100);
  }
  function triviaClick(b) {
    if (b.dataset.opt !== undefined) { triviaAnswer(+b.dataset.opt); return true; }
    if (b.id === 'tqNext') { Trivia.cont(state); ui.fresh = !state.inSeason; render(); ui.fresh = false; showTriviaPanel(); return true; }
    if (b.id === 'bonusYes' || b.id === 'bonusNo') { Trivia.takeBonus(state, b.id === 'bonusYes'); render(); showTriviaPanel(); return true; }
    if (b.id === 'tStart') { ui.confirm = null; Trivia.startSeason(state); render(); showTriviaPanel(); return true; }
    if (b.id === 'retireYes') { Trivia.retire(state); ui.confirm = null; ui.view = 'summary'; persist(); render(); scrollTo({ top: 0 }); return true; }
    return false;
  }
  document.addEventListener('keydown', e => {
    if (!isTrivia(state) || ui.view !== 'game' || !state.inSeason || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest && e.target.closest('input, textarea')) return;
    const I = state.inSeason, k = e.key.toLowerCase();
    if (I.phase === 'question') {
      const i = ['1', '2', '3', '4'].indexOf(k) >= 0 ? ['1', '2', '3', '4'].indexOf(k) : ['a', 'b', 'c', 'd'].indexOf(k);
      if (i >= 0) { e.preventDefault(); triviaAnswer(i); }
    } else if (I.phase === 'feedback' && (k === 'enter' || k === ' ') && !(e.target.closest && e.target.closest('button'))) {
      e.preventDefault(); document.getElementById('tqNext')?.click();
    }
  });

  // ---------- resumo ----------
  function viewSummary() {
    const s = state, p = s.player, n = nation(p.nat);
    const st = Engine.careerStats(s);
    const status = Engine.careerStatus(st);
    const first = s.seasons[0], last = s.seasons[s.seasons.length - 1];
    const slams = ['AO', 'RG', 'WIM', 'USO'].map(id => T.find(t => t.id === id));
    const tv = isTrivia(s), tst = tv ? Trivia.stats(s) : null;
    const tags = tv ? Trivia.tags(s) : Engine.careerTags(s);
    const masters = T.filter(t => t.type !== 'major');
    return `
    <section class="status-hero">
      <span class="eyebrow">Status da carreira · <span class="flag">${flag(n[0])}</span> ${esc(p.name)}${first ? ` · ${first.year}–${last.year}` : ''}</span>
      <div class="status-row"><div class="status-word st-${status.key}">${status.label}</div>
        <div class="tags">${tags.length ? tags.map(t => `<button class="tagchip k-${t.kind}" data-desc="${esc(t.desc)}" aria-label="${esc(t.name)}: ${esc(t.desc)}">${esc(t.name)}</button>`).join('') : '<span class="muted">Nenhuma tag conquistada</span>'}</div></div>
      <p class="muted">${esc(s.retireReason || '')}</p>
    </section>
    <div class="big-stats">
      <div><span>Títulos</span><b>${st.titles}</b></div>
      <div><span>Grand Slams</span><b>${st.majors}</b></div>
      <div><span>Recorde V-D</span><b>${st.wins}-${st.losses}</b></div>
      <div><span>Prêmios</span><b>${money(st.prize)}</b></div>
      <div><span>Melhor rank</span><b>${st.bestRank ? '#' + st.bestRank : '–'}</b></div>
      ${tv ? `<div><span>Aproveitamento</span><b>${tst.n ? pctAcc(tst.acc) : '–'}</b></div>` : `<div><span>Melhor OVR</span><b>${st.bestOvr}</b></div>`}
    </div>

    <h2 class="section-title">Grand Slams</h2>
    <p class="legend" style="margin:-4px 0 12px"><span><span class="yr w">Ano</span> Campeão</span><span><span class="yr f">Ano</span> Vice</span></p>
    <div class="slams">${slams.map(t => { const x = st.per[t.id]; return `<div class="slam">
      <div class="slam-top"><span class="slam-name">${t.name}</span>${court(t.surface)}</div>
      <div class="slam-titles">${x.titles}<small>título${x.titles === 1 ? '' : 's'}</small></div>
      <div class="kv"><span>Recorde</span><b>${x.wins}-${x.losses}</b></div>
      <div class="kv"><span>Finais</span><b>${x.finalsW}-${x.finalsL}</b></div>
      <div class="years">${x.years.length ? x.years.map(y => `<span class="yr ${y.w ? 'w' : 'f'}" title="${y.w ? 'Campeão' : 'Vice'} em ${y.y}">${y.y}</span>`).join('') : '<span class="muted" style="font-size:13px">Nenhuma final</span>'}</div>
    </div>`; }).join('')}</div>

    ${tv ? viewTriviaStats(tst) : ''}
    ${!tv && s.rival ? `<h2 class="section-title">Rivalidade</h2>
    <div class="rival-card"><span class="flag">${flag(rivalNation(s.rival)[0])}</span><div style="flex:1;min-width:0"><div class="rival-name">${RIVALS[s.rival].name}</div><span class="muted">Finais de Grand Slam contra o rival</span></div><div class="slam-titles" style="font-size:44px">${s.rivalRecord.w}-${s.rivalRecord.l}</div></div>
    ${(s.rivalLog || []).length ? `<details class="rdetails"><summary><span class="chev" aria-hidden="true">▸</span>Ver as ${s.rivalLog.length} ${s.rivalLog.length === 1 ? 'final' : 'finais'} de Grand Slam contra ${RIVALS[s.rival].name.split(' ').slice(-1)[0]}</summary><div class="rfinals">${s.rivalLog.map(f => { const t = T.find(x => x.id === f.tid);
      return `<div class="rfinal"><div class="rf-where">${court(t.surface)}<span><b>${t.name}</b> ${f.year}</span></div>
        <span class="res ${f.win ? 'W' : 'F'}">${f.win ? 'Campeão' : 'Vice'}</span>
        <span class="rf-score">${f.score.split(' ').map(x => `<i class="${/^(\d+)-(\d+)/.exec(x) && +RegExp.$1 > +RegExp.$2 ? 'won' : 'lost'}">${x}</i>`).join('')}</span>
        <span class="rf-meta">${Engine.RIVAL_CHOICES[f.choice].name} · impacto <b class="${f.fx}">${Engine.RIVAL_FX[f.fx].label.toLowerCase()}</b></span></div>`; }).join('')}</div></details>` : ''}` : ''}

    <h2 class="section-title">Masters 1000 e ATP Finals</h2>
    <section class="panel masters-panel">
      <table class="masters"><thead><tr><th>Torneio</th><th>Títulos</th><th>Finais</th><th>Recorde</th></tr></thead>
      <tbody>${masters.map(t => { const x = st.per[t.id]; return `<tr><td><span class="tname">${court(t.surface)}${t.name}</span></td><td><b>${x.titles}</b></td><td>${x.finalsW}-${x.finalsL}</td><td>${x.wins}-${x.losses}</td></tr>`; }).join('')}</tbody></table>
    </section>

    <div class="btn-row" style="margin-top:24px">
      <button class="btn btn-ghost" id="backGame">Voltar para a carreira</button>
      ${ui.confirm === 'new'
        ? `<button class="btn btn-danger" id="newYes">Apagar e criar nova</button>`
        : `<button class="btn btn-primary" id="newCareer">Criar nova carreira</button>`}
    </div>
    ${ui.confirm === 'new' ? '<p class="draw-hint" style="margin-top:10px">A carreira atual será apagada deste aparelho.</p>' : ''}`;
  }

  // ---------- tela inicial: entrar, jogar como convidado, minhas carreiras ----------
  function fmtDate(iso) { try { return new Date(iso).toLocaleDateString('pt-BR'); } catch (e) { return ''; } }
  const GOOGLE_G = '<svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';

  function viewAuthCard() {
    const m = home.authMode, busy = home.busy;
    const err = home.err ? `<p class="form-err" role="alert">${esc(home.err)}</p>` : '';
    const info = home.info ? `<div class="end-note">${home.info}</div>` : '';
    const pwField = (id, label, auto) => `<div class="field"><label for="${id}">${label}</label>
      <div class="pw-wrap"><input class="input" id="${id}" type="${home.showPw ? 'text' : 'password'}" autocomplete="${auto}" minlength="8" placeholder="Mínimo de 8 caracteres">
      <button type="button" class="pw-toggle" id="pwToggle" aria-label="${home.showPw ? 'Esconder senha' : 'Mostrar senha'}">${home.showPw ? 'Esconder' : 'Mostrar'}</button></div></div>`;
    const emailField = `<div class="field"><label for="f-email">E-mail</label>
      <input class="input" id="f-email" type="email" inputmode="email" autocomplete="email" placeholder="voce@email.com" value="${esc(home.email)}"></div>`;
    if (m === 'reset') return `
      <span class="eyebrow">Com conta</span><h2>Esqueci a senha</h2>
      <p class="muted">Digite o e-mail da sua conta. Vamos mandar um link para você criar uma senha nova.</p>
      ${info}
      <form id="authForm" class="stack" novalidate>${emailField}
        <button class="btn btn-primary" type="submit" ${busy ? 'disabled' : ''}>${busy ? 'Enviando…' : 'Enviar link'}</button>${err}</form>
      <div class="btn-row"><button class="btn btn-ghost" id="toLogin">Voltar para entrar</button></div>`;
    const google = home.prov.google ? `<button class="btn btn-google" id="googleBtn" ${busy ? 'disabled' : ''}>${GOOGLE_G}Entrar com Google</button>
      <div class="or"><span>ou com e-mail e senha</span></div>` : '';
    return `
      <span class="eyebrow">Com conta</span><h2>${m === 'signup' ? 'Criar conta' : 'Entrar'}</h2>
      <p class="muted">Suas carreiras ficam salvas na nuvem e você continua de qualquer aparelho.</p>
      ${google}
      <div class="seg auth-tabs" role="tablist">
        <button type="button" role="tab" id="tabLogin" aria-pressed="${m === 'login'}" aria-selected="${m === 'login'}">Entrar</button>
        <button type="button" role="tab" id="tabSignup" aria-pressed="${m === 'signup'}" aria-selected="${m === 'signup'}">Criar conta</button>
      </div>
      ${info}
      <form id="authForm" class="stack" novalidate>
        ${emailField}
        ${pwField('f-pass', 'Senha', m === 'signup' ? 'new-password' : 'current-password')}
        ${m === 'signup' ? `<div class="field"><label for="f-pass2">Repita a senha</label><input class="input" id="f-pass2" type="${home.showPw ? 'text' : 'password'}" autocomplete="new-password"></div>` : ''}
        <button class="btn btn-primary" type="submit" ${busy ? 'disabled' : ''}>${busy ? 'Aguarde…' : m === 'signup' ? 'Criar conta' : 'Entrar'}</button>
        ${err}
      </form>
      ${m === 'login' ? `<button class="linkish" id="forgotBtn">Esqueci a senha</button>` : ''}`;
  }

  function viewNewPassword() {
    return `
    <section class="hero"><span class="eyebrow">Conta · ${esc(account.user.email || '')}</span><h1>Crie uma senha nova</h1></section>
    <section class="panel home-card" style="max-width:520px">
      <form id="newPassForm" class="stack" novalidate>
        <div class="field"><label for="f-np1">Nova senha</label><input class="input" id="f-np1" type="password" autocomplete="new-password" minlength="8" placeholder="Mínimo de 8 caracteres"></div>
        <div class="field"><label for="f-np2">Repita a nova senha</label><input class="input" id="f-np2" type="password" autocomplete="new-password"></div>
        <button class="btn btn-primary" type="submit" ${home.busy ? 'disabled' : ''}>${home.busy ? 'Salvando…' : 'Salvar nova senha'}</button>
        ${home.err ? `<p class="form-err" role="alert">${esc(home.err)}</p>` : ''}
      </form>
    </section>`;
  }

  function viewHome() {
    if (home.checking) return `<section class="hero"><span class="eyebrow">Tennis Simulator</span><h1>Carregando…</h1><p>Verificando a sua conta.</p></section>`;
    if (account.mode === 'user') return home.authMode === 'newpass' ? viewNewPassword() : viewMyCareers();
    const local = localGuestCareer();
    return `
    <section class="hero">
      <span class="eyebrow">Simulador de carreira de tênis</span>
      <h1>Sua carreira começa aqui</h1>
      <p>Crie um tenista e dispute Grand Slams, Masters e o ATP Finals até a aposentadoria. No FULL Sim, você toma as decisões; no Trivia, cada partida é uma pergunta de tênis.</p>
    </section>
    <div class="home-grid">
      <section class="panel home-card">${viewAuthCard()}</section>
      <section class="panel home-card">
        <span class="eyebrow">Sem conta</span>
        <h2>Jogar como convidado</h2>
        <p class="muted">Comece agora mesmo. A carreira fica salva só neste navegador e não aparece em outros aparelhos.</p>
        ${local ? `<div class="end-note">Carreira neste aparelho${isTrivia(local.state) ? ' (Trivia)' : ''}: <strong>${esc(local.state.player.name)}</strong>, ${local.state.retired ? 'aposentado' : `${local.state.age} anos, temporada ${local.state.year}`}.</div>` : ''}
        <div class="btn-row"><button class="btn btn-ghost" id="guestBtn">${local ? 'Continuar como convidado' : 'Jogar sem cadastro'}</button></div>
      </section>
    </div>
    <p class="privacy">Usamos o seu e-mail só para o login e para guardar as suas carreiras. Você pode apagar suas carreiras a qualquer momento.</p>`;
  }

  function viewMyCareers() {
    const local = localGuestCareer();
    const list = (home.list || []).slice().sort((a, b) => (b.favorite - a.favorite) || (b.updated_at > a.updated_at ? 1 : -1));
    let body;
    if (home.loading && !home.list) body = `<p class="muted">Carregando as suas carreiras…</p>`;
    else if (home.listErr) body = `<div class="end-note">${esc(home.listErr)}</div><div class="btn-row"><button class="btn btn-ghost" id="reloadList">Tentar de novo</button></div>`;
    else if (!list.length) body = `<section class="panel empty-card"><h2>Comece a sua primeira carreira</h2><p class="muted">Cada carreira que você criar fica salva aqui automaticamente, temporada a temporada. Você pode continuar de onde parou em qualquer aparelho.</p><div class="btn-row"><button class="btn btn-primary" id="newFromHome2">Criar carreira</button></div></section>`;
    else body = `<div class="career-list">${list.map(c => { const n = nation(c.nat);
      const del = home.confirmDel === c.id;
      return `<article class="ccard ${c.favorite ? 'fav' : ''} ${c.mode === 'trivia' ? 'is-trivia' : ''}">
        <div class="ccard-top">
          <div class="ccard-name"><span class="flag">${flag(n[0])}</span><b>${esc(c.name)}</b></div>
          <button class="star" data-fav="${c.id}" aria-pressed="${c.favorite}" aria-label="${c.favorite ? 'Tirar dos favoritos' : 'Marcar como favorita'}" title="${c.favorite ? 'Favorita' : 'Marcar como favorita'}">${c.favorite ? '★' : '☆'}</button>
        </div>
        <div class="pills"><span class="pill ${c.mode === 'trivia' ? 'trivia' : ''}">${c.mode === 'trivia' ? 'Trivia' : 'FULL Sim'}</span><span class="pill ${c.retired ? 'special' : ''}">${c.retired ? esc(c.status || 'Aposentado') : `Em andamento · ${c.age} anos`}</span><span class="pill">${c.mode === 'trivia' ? `Acerto ${c.accuracy != null ? Math.round(c.accuracy * 100) + '%' : '–'}` : `OVR ${c.ovr ?? '–'}`}</span></div>
        <div class="ccard-stats">
          <div><span>Temporadas</span><b>${c.seasons}</b></div><div><span>Slams</span><b>${c.majors}</b></div>
          <div><span>Títulos</span><b>${c.titles}</b></div><div><span>Melhor rank</span><b>${c.best_rank ? '#' + c.best_rank : '–'}</b></div>
        </div>
        <div class="ccard-foot">
          <span class="muted">Salva em ${fmtDate(c.updated_at)}</span>
          ${del ? `<span class="del-confirm">Apagar de vez? <button class="btn btn-danger btn-sm" data-delyes="${c.id}">Apagar</button><button class="btn btn-ghost btn-sm" id="delNo">Cancelar</button></span>`
                : `<span class="btn-row"><button class="btn btn-ghost btn-sm" data-del="${c.id}">Apagar</button><button class="btn btn-primary btn-sm" data-open="${c.id}">${c.retired ? 'Ver resumo' : 'Continuar'}</button></span>`}
        </div>
      </article>`; }).join('')}</div>`;
    return `
    <section class="home-head">
      <div><span class="eyebrow">Conectado como ${esc(account.user.email || '')}</span><h1>Minhas carreiras</h1></div>
      <div class="btn-row"><button class="btn btn-primary" id="newFromHome">Nova carreira</button><button class="btn btn-ghost" id="signOut">Sair</button></div>
    </section>
    ${local ? `<section class="panel import-card"><div><strong>Você tem uma carreira de convidado neste aparelho${isTrivia(local.state) ? ' (Trivia)' : ''}:</strong> ${esc(local.state.player.name)}, ${local.state.retired ? 'aposentado' : `${local.state.age} anos`}. Quer guardá-la na sua conta?</div>
      <div class="btn-row"><button class="btn btn-primary btn-sm" id="importLocal" ${home.importing ? 'disabled' : ''}>${home.importing ? 'Salvando…' : 'Salvar na minha conta'}</button></div></section>` : ''}
    ${body}`;
  }

  // redesenha a tela de login sem apagar o que a pessoa já digitou nos campos de senha
  function renderAuth() {
    const ids = ['f-pass', 'f-pass2', 'f-np1', 'f-np2'], vals = {};
    ids.forEach(id => { const f = document.getElementById(id); if (f) vals[id] = f.value; });
    render();
    ids.forEach(id => { const f = document.getElementById(id); if (f && vals[id] != null) f.value = vals[id]; });
  }
  function keepEmail() { const f = document.getElementById('f-email'); if (f) home.email = f.value.trim(); }
  const validEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  $app.addEventListener('submit', async e => {
    if (e.target.id === 'newPassForm') {
      e.preventDefault();
      const p1 = document.getElementById('f-np1').value, p2 = document.getElementById('f-np2').value;
      if (p1.length < 8) { home.err = 'A senha precisa ter pelo menos 8 caracteres.'; renderAuth(); return; }
      if (p1 !== p2) { home.err = 'As duas senhas não são iguais.'; renderAuth(); return; }
      home.busy = true; home.err = ''; renderAuth();
      try { await Cloud.updatePassword(p1); home.authMode = 'login'; home.busy = false; loadList(); }
      catch (err) { home.busy = false; home.err = err.message; renderAuth(); }
      return;
    }
    if (e.target.id !== 'authForm') return;
    e.preventDefault();
    const email = (document.getElementById('f-email').value || '').trim();
    home.email = email; home.err = ''; home.info = '';
    if (!validEmail(email)) { home.err = 'Digite um e-mail válido, como voce@email.com.'; renderAuth(); return; }
    if (home.authMode === 'reset') {
      home.busy = true; renderAuth();
      try { await Cloud.resetPassword(email); home.info = `Se existir uma conta com <strong>${esc(email)}</strong>, enviamos um link para criar uma senha nova. Abra o e-mail neste aparelho. Se não chegar, olhe a caixa de spam.`; }
      catch (err) { home.err = err.message; }
      home.busy = false; renderAuth(); return;
    }
    const pass = document.getElementById('f-pass').value;
    if (pass.length < 8) { home.err = 'A senha precisa ter pelo menos 8 caracteres.'; renderAuth(); return; }
    if (home.authMode === 'signup' && pass !== document.getElementById('f-pass2').value) { home.err = 'As duas senhas não são iguais.'; renderAuth(); return; }
    home.busy = true; renderAuth();
    try {
      if (home.authMode === 'signup') {
        const inNow = await Cloud.signUp(email, pass);
        if (!inNow) { home.authMode = 'login'; home.info = `Conta criada! Enviamos um e-mail para <strong>${esc(email)}</strong>. Confirme pelo link e depois entre com a sua senha.`; }
      } else await Cloud.signInPassword(email, pass);
      // ao entrar, onAuth leva para "Minhas carreiras"
    } catch (err) { home.err = err.message; }
    home.busy = false; if (account.mode !== 'user') renderAuth();
  });
  $app.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b || ui.view !== 'home') return;
    if (b.id === 'guestBtn') return enterGuest();
    if (b.id === 'tabLogin' || b.id === 'tabSignup') { home.authMode = b.id === 'tabLogin' ? 'login' : 'signup'; home.err = ''; home.info = ''; keepEmail(); render(); return; }
    if (b.id === 'forgotBtn') { keepEmail(); home.authMode = 'reset'; home.err = ''; home.info = ''; render(); return; }
    if (b.id === 'toLogin') { keepEmail(); home.authMode = 'login'; home.err = ''; home.info = ''; render(); return; }
    if (b.id === 'pwToggle') { keepEmail(); home.showPw = !home.showPw; renderAuth(); document.getElementById('f-pass')?.focus(); return; }
    if (b.id === 'googleBtn') {
      home.busy = true; home.err = ''; render();
      try { await Cloud.signInGoogle(); setTimeout(() => { if (home.busy) { home.busy = false; render(); } }, 8000); }
      catch (err) { home.busy = false; home.err = err.message; render(); }
      return;
    }
    if (b.id === 'signOut') { await Cloud.signOut(); return; }
    if (b.id === 'newFromHome' || b.id === 'newFromHome2') { state = null; draft = freshDraft(); ui = { view: 'create', confirm: null, modal: null, fresh: false }; render(); scrollTo({ top: 0 }); return; }
    if (b.id === 'reloadList') return loadList();
    if (b.dataset.open) return openCareer(b.dataset.open);
    if (b.dataset.del) { home.confirmDel = b.dataset.del; render(); return; }
    if (b.id === 'delNo') { home.confirmDel = null; render(); return; }
    if (b.dataset.delyes) {
      const id = b.dataset.delyes; home.confirmDel = null;
      try { await Cloud.remove(id); home.list = (home.list || []).filter(c => c.id !== id); } catch (err) { home.listErr = err.message; }
      render(); return;
    }
    if (b.dataset.fav) {
      const c = (home.list || []).find(x => x.id === b.dataset.fav); if (!c) return;
      c.favorite = !c.favorite; render();
      try { await Cloud.setFavorite(c.id, c.favorite); } catch (err) { c.favorite = !c.favorite; home.listErr = err.message; render(); }
      return;
    }
    if (b.id === 'importLocal') {
      const sv = localGuestCareer(); if (!sv) return;
      home.importing = true; render();
      try {
        const st = loadState(sv.state);
        await Cloud.save(null, rowFor(st));
        try { localStorage.removeItem(SAVE_KEY); } catch (err) {}
        home.importing = false; await loadList();
      } catch (err) { home.importing = false; home.listErr = err.message; render(); }
    }
  });

  // ---------- render + eventos ----------
  function render() {
    const meta = document.getElementById('topMeta');
    document.body.dataset.view = (ui.view === 'game' && state) ? (isTrivia(state) ? 'trivia-game' : 'game') : 'other';
    document.body.dataset.mode = isTrivia(state) && ui.view !== 'home' ? 'trivia' : 'full';
    stopTriviaClock();
    if (ui.view === 'home') { $app.innerHTML = viewHome(); meta.textContent = account.mode === 'user' ? 'Minhas carreiras' : 'Simulador de carreira'; paintTop(); return; }
    paintTop();
    if (ui.view === 'create' || !state) { $app.innerHTML = viewCreate(); meta.textContent = 'Simulador de carreira'; }
    else if (ui.view === 'summary') { $app.innerHTML = viewSummary(); meta.textContent = 'Resumo da carreira'; }
    else { $app.innerHTML = viewGame(); meta.textContent = (isTrivia(state) ? 'Trivia · ' : '') + (state.retired ? 'Carreira encerrada' : `Temporada ${state.year}`); }
    afterRenderTrivia();
  }

  $app.addEventListener('input', e => {
    if (e.target.id === 'f-name') { draft.name = e.target.value; const b = document.getElementById('startBtn'); b.disabled = !draftReady(); }
    if (e.target.id === 'natQ') {
      draft.natQ = e.target.value; const pos = e.target.selectionStart; render();
      const q = document.getElementById('natQ'); q.focus(); q.setSelectionRange(pos, pos);
    }
  });
  $app.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'natBtn') { draft.natOpen = !draft.natOpen; render(); if (draft.natOpen) document.getElementById('natQ')?.focus({ preventScroll: true }); return; }
    if (b.dataset.nat) { draft.nat = b.dataset.nat; draft.natOpen = false; draft.natQ = ''; render(); return; }
    if (b.dataset.hand) { draft.hand = b.dataset.hand; render(); return; }
    if (b.dataset.bh) { draft.backhand = b.dataset.bh; render(); return; }
    if (b.dataset.exp) { draft.exp = b.dataset.exp; render(); return; }
    if (b.dataset.style) { draft.style = b.dataset.style; render(); return; }
    if (b.dataset.mode) { draft.mode = b.dataset.mode; render(); return; }
    if (b.dataset.draw) { runDraw(b.dataset.draw); return; }
    if (b.id === 'startBtn' && draft.mode === 'trivia') {
      state = Trivia.newCareer({ name: draft.name.trim(), nat: draft.nat }, Trivia.START_AGE);
      ui.view = 'game'; ui.confirm = null; persist(); render(); scrollTo({ top: 0 }); return;
    }
    if (b.id === 'startBtn') {
      state = Engine.newCareer({ name: draft.name.trim(), nat: draft.nat, hand: draft.hand, backhand: draft.backhand, exp: draft.exp, style: draft.style }, draft.ovr, draft.age);
      ui.view = 'game'; ui.confirm = null; persist(); render(); scrollTo({ top: 0 }); return;
    }
    if (isTrivia(state) && triviaClick(b)) return;
    if (b.dataset.ev !== undefined) { Engine.resolveEvent(state, b.dataset.ev === '1'); persist(); render(); return; }
    if (b.id === 'simBtn') { if (state.awaitingAdvance) return; ui.confirm = null; ui.chain = state.player.exp === 'express' ? { left: 3, total: 3, skip: false, years: [] } : null; playOn(); return; }
    if (b.id === 'advanceBtn') { state.awaitingAdvance = null; persist(); render(); focusPanel(); return; }
    if (b.id === 'ackRival') { Engine.ackRival(state); persist(); render(); return; }
    if (b.dataset.rc !== undefined) { Engine.resolveRivalFinal(state, +b.dataset.rc); ui.modal = 'result'; persist(); render(); return; }
    if (b.id === 'rivalContinue') { ui.modal = null; if (ui.live) ui.live.shown = ui.live.limit; playOn(); return; }
    if (b.id === 'skipLive' || b.id === 'skipLive2') { skipLive(); return; }
    if (b.id === 'retireBtn') { ui.confirm = 'retire'; render(); return; }
    if (b.id === 'retireNo') { ui.confirm = null; render(); return; }
    if (b.id === 'retireYes') { Engine.retire(state); ui.confirm = null; ui.view = 'summary'; persist(); render(); scrollTo({ top: 0 }); return; }
    if (b.id === 'toSummary') { ui.view = 'summary'; persist(); render(); scrollTo({ top: 0 }); return; }
    if (b.id === 'backGame') { ui.view = 'game'; ui.confirm = null; persist(); render(); return; }
    if (b.id === 'newCareer') {
      if (account.mode === 'user') { flushCloud(); clearLive(); state = null; draft = freshDraft(); ui = { view: 'create', confirm: null, modal: null, fresh: false }; render(); scrollTo({ top: 0 }); return; }
      ui.confirm = 'new'; render(); return;
    }
    if (b.id === 'newYes') {
      const lastMode = isTrivia(state) ? 'trivia' : 'full';
      state = null; ui = { view: 'create', confirm: null };
      draft = { ...freshDraft(), mode: lastMode };
      persist(); render(); scrollTo({ top: 0 }); return;
    }
  });

  // Simula (ou continua) a temporada de uma vez e depois revela torneio a torneio.
  // Pausa no pop-up do rival; ao terminar, mostra o ranking e libera a próxima temporada.
  const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  function buildLive(shown) {
    const s = state;
    if (s.pendingFinal) {
      return { year: s.year, age: s.age, ovr: s.ovr, results: s.inSeason.results, rank: null, train: s.train,
               paused: true, complete: false, limit: T.findIndex(t => t.id === s.pendingFinal.tid), shown };
    }
    const se = s.seasons[s.seasons.length - 1];
    return { year: se.year, age: se.age, ovr: se.ovr, results: se.results, rank: se.rank, train: se.train,
             paused: false, complete: true, limit: T.length + 1, shown };
  }
  function playOn() {
    const continuing = !!ui.live;
    const keep = continuing ? ui.live.shown : 0, line = continuing ? ui.live.lastLine : '';
    const res = Engine.simulateSeason(state);
    persist();
    if (!res) return;
    ui.live = buildLive(keep); ui.live.lastLine = line;
    render();
    // PC: a página não rola, só a tabela volta ao topo (linha ao vivo). Celular: rola até a tabela.
    const box = document.querySelector('.table-scroll'); if (box) box.scrollTop = 0;
    const head = document.querySelector('.career-head');
    if (head && !continuing && !isWide()) head.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
    clearTimeout(ui.liveTimer);
    if (ui.chain && ui.chain.skip) { ui.live.shown = ui.live.limit; return liveEnd(); }
    ui.liveTimer = setTimeout(liveStep, continuing ? 350 : 700);
  }
  const speed = () => ui.chain ? 0.6 : 1;   // no Express a revelação é um pouco mais rápida
  function liveStep() {
    const L = ui.live; if (!L) return;
    if (L.shown >= L.limit) return liveEnd();
    const i = L.shown;
    let wait = 750;
    if (i < T.length) {
      const t = T[i], r = L.results[t.id];
      const quiet = ['LES', 'SUSP', 'FORA', 'EST', '-'].includes(r.label);
      L.lastLine = r.label === 'W' ? `${t.name}: campeão! +${r.pts.toLocaleString('pt-BR')} pts`
        : r.label === '-' ? `${t.name}: não se classificou.`
        : quiet ? `${t.name}: ${resTitle[r.label].toLowerCase()}.`
        : `${t.name}: ${resTitle[r.label].toLowerCase()} · +${r.pts.toLocaleString('pt-BR')} pts`;
      L.lineKind = r.label === 'W' ? 'W' : r.label === 'F' ? 'F' : ['LES', 'SUSP'].includes(r.label) ? 'bad' : '';
      wait = quiet ? 300 : r.label === 'W' ? 1100 : 750;
    } else {
      L.lastLine = L.rank ? `Fim de temporada: ranking #${L.rank}.` : 'Fim de temporada sem ranking.';
      L.lineKind = '';
    }
    L.shown++;
    // atualiza só a linha ao vivo e o painel, sem redesenhar a página
    for (const j of [i, i + 1]) { const td = document.querySelector(`[data-live="${j}"]`); if (td) td.innerHTML = liveCell(j); }
    const chip = document.querySelector(`[data-live="${i}"] .res`); if (chip) chip.classList.add('pop');
    const now = document.getElementById('liveNow'); if (now) now.textContent = L.shown >= T.length ? 'Ranking final' : T[Math.min(L.shown, T.length - 1)].name;
    const lo = document.getElementById('liveOvr'); if (lo) lo.innerHTML = liveOvrHtml();
    const ls = document.getElementById('liveSurf'); if (ls) ls.innerHTML = liveSurfHtml();
    const ln = document.getElementById('liveLine'); if (ln) { ln.textContent = L.lastLine; ln.className = 'live-line ' + (L.lineKind || ''); }
    const bar = document.getElementById('liveBar'); if (bar) bar.style.width = Math.round(L.shown / 12 * 100) + '%';
    const tally = document.getElementById('liveTally'); if (tally) tally.innerHTML = liveTally();
    const sn = document.getElementById('stripNow'); if (sn && now) sn.textContent = now.textContent;
    const sl = document.getElementById('stripLine'); if (sl) { sl.textContent = L.lastLine; sl.className = 'live-line ' + (L.lineKind || ''); }
    // no celular, a tabela rola para o lado acompanhando o torneio atual
    const cur = document.querySelector(`[data-live="${Math.min(L.shown, T.length)}"]`), box = document.querySelector('.table-scroll');
    if (cur && box && box.scrollWidth > box.clientWidth) {
      const target = cur.offsetLeft - box.clientWidth / 2 + cur.offsetWidth / 2;
      box.scrollTo({ left: Math.max(0, target), behavior: reduceMotion() ? 'auto' : 'smooth' });
    }
    ui.liveTimer = setTimeout(liveStep, reduceMotion() ? 120 : wait * speed());
  }
  function liveEnd() {
    const L = ui.live;
    clearTimeout(ui.liveTimer);
    if (L.paused) { ui.modal = 'rival'; render(); return; }
    ui.live = null;
    // Express: segue para a próxima temporada até completar 3 ou aparecer uma decisão
    const ch = ui.chain;
    if (ch) ch.years.push(L.year);
    const goOn = ch && ch.left > 1 && !state.retired && !state.pendingEvent && !state.pendingRival;
    if (goOn) {
      ch.left--;
      if (ch.skip) { playOn(); return; }
      ui.chainWait = true;
    } else {
      // fim da temporada (ou do bloco): o painel mostra o resumo até o jogador avançar
      state.awaitingAdvance = { years: ch ? ch.years : [L.year] };
      ui.chain = null;
      persist();
    }
    ui.fresh = true; render(); ui.fresh = false;
    if (goOn) setTimeout(() => { ui.chainWait = false; playOn(); }, 900);
    else focusPanel();
  }
  const isWide = () => matchMedia('(min-width: 1100px)').matches;
  // no celular, leva a tela até o painel (onde aparece o resumo ou a próxima decisão)
  function focusPanel() {
    if (isWide()) return;
    const v = document.getElementById('vivo'); if (v) v.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
  }
  function skipLive() {
    if (!ui.live && ui.chain) { ui.chain.skip = true; return; }
    const L = ui.live; if (!L) return;
    clearTimeout(ui.liveTimer);
    if (ui.chain) ui.chain.skip = true;
    L.shown = L.limit;
    liveEnd();
  }

  // Tooltip das tags: aparece após 0,5 s com o mouse parado em cima, ou na hora com um toque
  let tipEl = null, tipTimer = null;
  function showTip(el) {
    hideTip();
    tipEl = document.createElement('div'); tipEl.className = 'tip'; tipEl.textContent = el.dataset.desc;
    document.body.appendChild(tipEl);
    const r = el.getBoundingClientRect(), w = tipEl.offsetWidth, h = tipEl.offsetHeight;
    const left = Math.min(Math.max(16, r.left + r.width / 2 - w / 2), innerWidth - w - 16);
    const top = r.bottom + 8 + h > innerHeight ? r.top - h - 8 : r.bottom + 8;
    tipEl.style.left = left + 'px'; tipEl.style.top = top + 'px';
  }
  function hideTip() { clearTimeout(tipTimer); if (tipEl) { tipEl.remove(); tipEl = null; } }
  $app.addEventListener('pointerover', e => { const t = e.target.closest('.tagchip'); if (!t || e.pointerType === 'touch') return; clearTimeout(tipTimer); tipTimer = setTimeout(() => showTip(t), 500); });
  $app.addEventListener('pointerout', e => { if (e.target.closest('.tagchip')) hideTip(); });
  $app.addEventListener('click', e => { const t = e.target.closest('.tagchip'); if (t) { tipEl ? hideTip() : showTip(t); } else hideTip(); });
  addEventListener('scroll', hideTip, { passive: true });

  function start(data) {
    if (Cloud.enabled) {
      ui.view = 'home'; render();
      Cloud.providers().then(p => { home.prov = p; if (ui.view === 'home' && account.mode !== 'user') render(); });
      Cloud.init(onAuth).then(user => { home.checking = false; if (user) onAuth(user, 'INITIAL'); else render(); })
        .catch(() => { home.checking = false; render(); });
      return;
    }
    const saved = (data && data.state !== undefined) ? data : loadSave();
    if (saved && saved.state) {
      state = loadState(saved.state);
      ui.view = saved.view === 'summary' && state.retired ? 'summary' : 'game';
      if (state.pendingFinal) ui.modal = 'rival';
    }
    if (data && data.draft) draft = { ...freshDraft(), ...data.draft };
    render();
  }
  // quem volta do Google pelo botão "voltar" do navegador não fica com os botões travados
  addEventListener('pageshow', () => { if (home.busy) { home.busy = false; if (ui.view === 'home') render(); } });

  // botão do topo (fora do #app)
  document.getElementById('homeBtn').addEventListener('click', goHome);
  start(null);
})();
