// Simula carreiras inteiras do modo Trivia com um "jogador" que acerta com probabilidade p
const Trivia = require('../js/trivia.js');
function career(p, age = 18) {
  const s = Trivia.newCareer({ name: 'Teste', nat: 'BRA', hand: 'Destro', backhand: 'Duas mãos' }, age);
  let guard = 0;
  while (!s.retired && guard++ < 100) {
    s.awaitingAdvance = null;
    Trivia.startSeason(s);
    while (s.inSeason) {
      const ph = s.inSeason.phase;
      if (ph === 'offer') Trivia.takeBonus(s, Math.random() < 0.5);
      else if (ph === 'question') { Trivia.startClock(s, 0); const c = s.inSeason.cur; const ok = Math.random() < (c.bonus ? p * 0.7 : p); Trivia.answer(s, ok ? c.ans : (c.ans + 1) % 4, 4000); }
      else if (ph === 'feedback') Trivia.cont(s);
      else throw new Error('fase ' + ph);
    }
  }
  return s;
}
for (const p of [0.6, 0.8, 0.9, 0.95]) {
  let tot = { majors: 0, titles: 0, q: 0, rep: 0, best1: 0, maxQ: 0 }; const n = 200;
  for (let i = 0; i < n; i++) {
    const s = career(p);
    const ids = s.log.map(l => l[0]); const rep = ids.length - new Set(ids).size;
    const majors = s.seasons.reduce((a, se) => a + ['AO','RG','WIM','USO'].filter(t => se.results[t].label === 'W').length, 0);
    tot.majors += majors; tot.titles += s.seasons.reduce((a, se) => a + se.titles, 0); tot.q += ids.length; tot.rep += rep; tot.best1 += s.bestRank === 1; tot.maxQ = Math.max(tot.maxQ, ids.length);
    if (i === 0 && p === 0.9) { const last = s.seasons[s.seasons.length - 1]; console.log('ex: temporadas', s.seasons.length, 'idade final', last.age, s.retireReason, 'FIN', s.seasons.map(x => x.results.FIN.label).join('')); }
  }
  console.log(`p=${p}: slams/carreira ${(tot.majors/n).toFixed(1)}, títulos ${(tot.titles/n).toFixed(1)}, perguntas ${(tot.q/n).toFixed(0)} (máx ${tot.maxQ}), repetidas ${tot.rep}, nº1 ${(tot.best1/n*100).toFixed(0)}%`);
}
const st = Trivia.stats(career(0.85));
console.log('stats', { n: st.n, acc: st.acc.toFixed(2), best: st.bestStreak, bonus: st.bonus, tiers: st.byTier });
