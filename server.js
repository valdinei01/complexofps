// Complexo do Escadão — servidor próprio (Node.js 18+, sem dependências)
// Entrega o jogo e faz o papel das salas online por WebSocket. Ninguém precisa de conta: basta o nome.
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');
const MAX_MSG = 16 * 1024, MAX_ROOM = 24, MAX_LOBBY = 2000, RATE = 160;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json' };

const server = http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  if (url === '/saude') { res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('ok'); return; }
  let file = path.normalize(path.join(PUBLIC, url === '/' ? 'index.html' : url));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Não encontrado'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

// ---------- WebSocket (RFC 6455) ----------
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
function frame(text) {
  const p = Buffer.from(text), n = p.length; let h;
  if (n < 126) h = Buffer.from([0x81, n]);
  else if (n < 65536) { h = Buffer.alloc(4); h[0] = 0x81; h[1] = 126; h.writeUInt16BE(n, 2); }
  else { h = Buffer.alloc(10); h[0] = 0x81; h[1] = 127; h.writeBigUInt64BE(BigInt(n), 2); }
  return Buffer.concat([h, p]);
}
let nextPeer = 1;
const rooms = new Map(); // nome -> Map(peer -> { c, presence, at })
function peerList(room) { return [...room.entries()].map(([peer, o]) => ({ peer, presence: o.presence, at: o.at })); }
function sendTo(c, obj) { if (c.alive && !c.sock.destroyed) { try { c.sock.write(frame(JSON.stringify(obj))); } catch (e) {} } }
function broadcastPeers(name, joined, left, updated) {
  const room = rooms.get(name); if (!room) return;
  const msg = { t: 'peers', room: name, peers: peerList(room), joined, left, updated };
  for (const o of room.values()) sendTo(o.c, msg);
}
function leaveRoom(c, name) {
  const room = rooms.get(name); if (!room || !room.has(c.peer)) return;
  const o = room.get(c.peer); room.delete(c.peer); c.rooms.delete(name);
  if (!room.size) rooms.delete(name); else broadcastPeers(name, [], [{ peer: c.peer, presence: o.presence, at: o.at }], []);
}
function handle(c, text) {
  let m; try { m = JSON.parse(text); } catch (e) { return; }
  if (!m || typeof m.room !== 'string' || m.room.length > 64) return;
  const name = m.room;
  if (m.t === 'join') {
    let room = rooms.get(name); if (!room) { room = new Map(); rooms.set(name, room); }
    if (!room.has(c.peer)) { if (room.size >= (name === 'lobby' ? MAX_LOBBY : MAX_ROOM)) { sendTo(c, { t: 'full', room: name }); return; } room.set(c.peer, { c, presence: (m.presence && typeof m.presence === 'object') ? m.presence : {}, at: Date.now() }); c.rooms.add(name); }
    broadcastPeers(name, [c.peer], [], []);
  } else if (m.t === 'pres') {
    const room = rooms.get(name); if (!room || !room.has(c.peer)) return;
    const o = room.get(c.peer), patch = m.patch || {};
    for (const k of Object.keys(patch).slice(0, 20)) { if (patch[k] === null) delete o.presence[k]; else o.presence[k] = patch[k]; }
    if (JSON.stringify(o.presence).length > 2048) o.presence = {};
    o.at = Date.now(); broadcastPeers(name, [], [], [c.peer]);
  } else if (m.t === 'emit') {
    const room = rooms.get(name); if (!room || !room.has(c.peer) || typeof m.topic !== 'string') return;
    const msg = JSON.stringify({ t: 'msg', room: name, topic: m.topic.slice(0, 32), data: m.data === undefined ? null : m.data, peer: c.peer });
    const f = frame(msg); for (const o of room.values()) if (o.c.alive && !o.c.sock.destroyed) { try { o.c.sock.write(f); } catch (e) {} }
  } else if (m.t === 'leave') leaveRoom(c, name);
}
server.on('upgrade', (req, sock) => {
  if ((req.url || '').split('?')[0] !== '/ws' || (req.headers.upgrade || '').toLowerCase() !== 'websocket') { sock.destroy(); return; }
  const key = req.headers['sec-websocket-key']; if (!key) { sock.destroy(); return; }
  const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  sock.setNoDelay(true);
  const c = { peer: 'p' + (nextPeer++).toString(36) + crypto.randomBytes(3).toString('hex'), sock, alive: true, rooms: new Set(), buf: Buffer.alloc(0), frag: [], count: 0, win: Date.now(), pong: Date.now() };
  sendTo(c, { t: 'hello', peer: c.peer });
  const close = () => { if (!c.alive) return; c.alive = false; for (const name of [...c.rooms]) leaveRoom(c, name); try { sock.destroy(); } catch (e) {} };
  sock.on('data', chunk => {
    c.buf = Buffer.concat([c.buf, chunk]);
    while (c.buf.length >= 2) {
      const b0 = c.buf[0], b1 = c.buf[1], fin = b0 & 0x80, op = b0 & 0x0f, masked = b1 & 0x80; let len = b1 & 0x7f, off = 2;
      if (len === 126) { if (c.buf.length < 4) return; len = c.buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (c.buf.length < 10) return; len = Number(c.buf.readBigUInt64BE(2)); off = 10; }
      if (len > MAX_MSG * 4) { close(); return; }
      const mOff = off; if (masked) off += 4;
      if (c.buf.length < off + len) return;
      let payload = c.buf.subarray(off, off + len);
      if (masked) { const mask = c.buf.subarray(mOff, mOff + 4); payload = Buffer.from(payload); for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3]; }
      c.buf = c.buf.subarray(off + len);
      if (op === 0x8) { close(); return; }
      if (op === 0x9) { try { sock.write(Buffer.concat([Buffer.from([0x8a, payload.length]), payload])); } catch (e) {} continue; }
      if (op === 0xA) { c.pong = Date.now(); continue; }
      if (op === 0x1 || op === 0x0) {
        c.frag.push(payload); if (!fin) continue;
        const text = Buffer.concat(c.frag).toString('utf8'); c.frag = [];
        const now = Date.now(); if (now - c.win > 1000) { c.win = now; c.count = 0; } if (++c.count > RATE) continue;
        if (text.length <= MAX_MSG) handle(c, text);
      }
    }
  });
  sock.on('close', close); sock.on('error', close); sock.on('end', close);
  c.ping = setInterval(() => { if (!c.alive) { clearInterval(c.ping); return; } if (Date.now() - c.pong > 70000) { clearInterval(c.ping); close(); return; } try { sock.write(Buffer.from([0x89, 0])); } catch (e) {} }, 25000);
});
server.listen(PORT, () => console.log('Complexo do Escadão rodando em http://localhost:' + PORT));
