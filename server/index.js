// Servidor do Complexo do Escadão 3D: arquivos do jogo + salas online (Socket.IO).
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');
const { RoomManager, world } = require('./rooms.js');

const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.mp3': 'audio/mpeg', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

function serve(req, res) {
  let url; try { url = decodeURIComponent((req.url || '/').split('?')[0]); } catch (e) { res.writeHead(400); return res.end(); }
  if (url === '/health') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('ok'); }
  let file;
  if (url === '/shared/sim.js') file = path.join(ROOT, 'shared', 'sim.js');
  else { if (url === '/' || url.startsWith('/sala/')) url = '/index.html'; file = path.join(PUBLIC, path.normalize(url)); if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); } }
  fs.readFile(file, (err, data) => {
    if (err) { if (!path.extname(file)) { return fs.readFile(path.join(PUBLIC, 'index.html'), (e2, d2) => { if (e2) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': TYPES['.html'], 'Cache-Control': 'no-cache' }); res.end(d2); }); } res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Não encontrado'); }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Cache-Control': ext === '.mp3' ? 'public, max-age=86400' : 'no-cache' });
    res.end(data);
  });
}

const server = http.createServer(serve);
const io = new Server(server, { cors: { origin: '*' }, pingInterval: 10000, pingTimeout: 15000, maxHttpBufferSize: 64 * 1024 });
world(); // gera o mapa uma vez ao iniciar
new RoomManager(io);
process.on('uncaughtException', e => console.error('[erro não tratado]', e && e.stack || e));
process.on('unhandledRejection', e => console.error('[promessa rejeitada]', e));
server.listen(PORT, '0.0.0.0', () => console.log('Complexo do Escadão 3D rodando na porta ' + PORT));
