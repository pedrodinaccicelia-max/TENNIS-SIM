// Junta o site num único HTML (sem Supabase: modo convidado) para testar como artifact
const fs = require('fs'), path = require('path');
const R = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const out = process.argv[2] || path.join(__dirname, '../dist/tennis-local.html');
let html = R('index.html');
html = html.replace(/<link rel="stylesheet" href="css\/styles.css">/, () => `<style>\n${R('css/styles.css')}\n</style>`);
html = html.replace(/<script src="https:\/\/cdn.jsdelivr.net[^"]*supabase[^"]*"><\/script>\n?/, '');
html = html.replace('<script src="js/config.js"></script>', '<script>window.TENNIS_CONFIG = { supabaseUrl: "", supabaseAnonKey: "" };</script>');
for (const f of ['engine', 'trivia-data', 'trivia-curated', 'trivia', 'cloud', 'app'])
  html = html.replace(`<script src="js/${f}.js"></script>`, () => `<script>\n${R('js/' + f + '.js')}\n</script>`);
if (process.argv.includes('--artifact')) {
  // o publicador do artifact já coloca doctype/html/head/body
  html = html.replace(/<!doctype html>\s*<html[^>]*>\s*<head>\s*/i, '').replace(/<meta charset="utf-8">\s*/, '')
    .replace(/<meta name="viewport"[^>]*>\s*/, '').replace(/<\/head>\s*<body>\s*/, '\n').replace(/<\/body>\s*<\/html>\s*$/, '\n')
    .replace('<title>Tennis Simulator</title>', '<title>Tennis Simulator Trivia</title>\n<meta name="claude:viewport-fit-sides" content="cover">');
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(out, (html.length / 1024).toFixed(0) + ' KB');
