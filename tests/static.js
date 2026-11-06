// Servidor estático só para testes de navegador sem Socket.IO (o servidor real é server/index.js).
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), PUB = path.join(ROOT, 'public');
const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.mp3': 'audio/mpeg' };
module.exports = (port, extra) => http.createServer((q, r) => { let u = decodeURIComponent(q.url.split('?')[0]); if (extra && extra(q, r)) return; let f = u === '/shared/sim.js' ? path.join(ROOT, 'shared/sim.js') : path.join(PUB, u === '/' || u.startsWith('/sala/') ? 'index.html' : u);
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); }).listen(port);
if (require.main === module) module.exports(+process.argv[2] || 8123);
