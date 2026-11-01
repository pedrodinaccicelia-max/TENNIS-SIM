// Gera js/trivia-data.js a partir de data/raw.json (dados extraídos da Wikipédia em out/2026)
const fs = require('fs'), path = require('path');
const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/raw.json'), 'utf8'));
const out = `/* ============ Tennis Simulator — dados históricos do modo Trivia (gerado por tools/build-data.js) ============
   Fonte: Wikipédia (finais de Grand Slam da Era Aberta, ATP/WTA Finals, Copa Davis, números 1 do ranking), out/2026. */
const TRIVIA_RAW = ${JSON.stringify(raw)};\nif (typeof module !== 'undefined') module.exports = { TRIVIA_RAW };\n`;
fs.writeFileSync(path.join(__dirname, '../js/trivia-data.js'), out);
console.log('js/trivia-data.js:', out.length, 'bytes');
