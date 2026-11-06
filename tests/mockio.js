// Simulador mínimo da interface do Socket.IO (servidor e clientes no mesmo processo) para testar as salas.
class MockSocket {
  constructor(io, id) { this.io = io; this.id = id; this.handlers = {}; this.rooms = new Set(); this.client = null; }
  on(ev, fn) { (this.handlers[ev] = this.handlers[ev] || []).push(fn); }
  emit(ev, data) { if (this.client && this.client.connected) this.client._recv(ev, JSON.parse(JSON.stringify(data === undefined ? null : data))); }
  join(r) { this.rooms.add(r); } leave(r) { this.rooms.delete(r); }
  _trigger(ev, data, cb) { for (const fn of this.handlers[ev] || []) fn(data, cb); }
}
class MockIO {
  constructor() { this.handlers = {}; this.sockets = new Map(); this.n = 0; }
  on(ev, fn) { this.handlers[ev] = fn; }
  to(room) { return { emit: (ev, data) => { for (const s of this.sockets.values()) if (s.rooms.has(room)) s.emit(ev, data); } }; }
  connect() { const s = new MockSocket(this, 's' + (++this.n)); this.sockets.set(s.id, s); const c = new MockClient(s); s.client = c; this.handlers.connection(s); return c; }
}
class MockClient {
  constructor(s) { this.s = s; this.connected = true; this.got = {}; this.last = {}; }
  _recv(ev, d) { (this.got[ev] = this.got[ev] || []).push(d); this.last[ev] = d; }
  emit(ev, data) { let res; this.s._trigger(ev, JSON.parse(JSON.stringify(data === undefined ? null : data)), r => { res = r; }); return res; }
  disconnect() { this.connected = false; this.s.io.sockets.delete(this.s.id); this.s._trigger('disconnect'); }
  count(ev) { return (this.got[ev] || []).length; }
}
module.exports = { MockIO };
