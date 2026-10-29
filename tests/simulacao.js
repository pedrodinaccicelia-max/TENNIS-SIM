/*
 * Simulação em massa do motor do jogo (sem interface).
 * Uso:  node tests/simulacao.js [numero_de_carreiras]
 *
 * Joga carreiras completas com escolhas aleatórias (60% dos eventos aceitos,
 * postura aleatória contra o rival) e imprime as estatísticas que usamos para
 * calibrar o jogo: Grand Slams por carreira, status, eventos especiais, tags
 * e a checagem de que ninguém vence Slam com OVR abaixo de 75.
 */
const Engine = require('../js/engine.js');

const N = Number(process.argv[2]) || 20000;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const pct = (x, n = N) => (x / n * 100).toFixed(2) + '%';

const slams = [], titles = [];
const status = {}, tags = {}, special = {};
let rivals = 0, slamBelow75 = 0;

for (let i = 0; i < N; i++) {
  const s = Engine.newCareer(
    { exp: pick(['intenso', 'normal', 'express', 'random']), style: pick(Object.keys(Engine.STYLES)) },
    pick([50, 60, 70]), pick([16, 18, 21]),
  );
  while (!s.retired) {
    if (s.pendingRival) { Engine.ackRival(s); continue; }
    if (s.pendingEvent) {
      const ev = Engine.getEvent(s.pendingEvent);
      if (ev.special) special[ev.title] = (special[ev.title] || 0) + 1;
      Engine.resolveEvent(s, Math.random() < 0.6);
      continue;
    }
    const r = Engine.simulateSeason(s);
    if (r && r.status === 'paused') Engine.resolveRivalFinal(s, Math.floor(Math.random() * 3));
  }
  const st = Engine.careerStats(s);
  slams.push(st.majors); titles.push(st.titles);
  if (s.rival) rivals++;
  const k = Engine.careerStatus(st).label; status[k] = (status[k] || 0) + 1;
  for (const t of Engine.careerTags(s)) tags[t.name] = (tags[t.name] || 0) + 1;
  for (const se of s.seasons) for (const t of Engine.TOURNAMENTS)
    if (t.type === 'major' && se.results[t.id].label === 'W' && se.ovr < Engine.SLAM_MIN_OVR) slamBelow75++;
}

const avg = a => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(2);
const atLeast = t => pct(slams.filter(m => m >= t).length);

console.log(`\n${N} carreiras simuladas\n`);
console.log('Grand Slams por carreira (média):', avg(slams), '| títulos (média):', avg(titles));
console.log('10+ Slams:', atLeast(10), '| 20+:', atLeast(20), '| 25+:', atLeast(25), '| 30+:', atLeast(30));
console.log('Slams vencidos com OVR < 75 (deve ser 0):', slamBelow75);
console.log('Carreiras com rival:', pct(rivals));
console.log('\nStatus:');
Object.entries(status).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log('  ' + k.padEnd(18), pct(v)));
console.log('\nEventos especiais (carreiras em que aparecem):');
Object.entries(special).forEach(([k, v]) => console.log('  ' + k.padEnd(18), pct(v)));
console.log('\nTags:');
Object.entries(tags).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log('  ' + k.padEnd(26), pct(v)));
