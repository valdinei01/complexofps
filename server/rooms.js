// Gerenciador de salas e partidas — servidor autoritativo.
// Funciona com Socket.IO (ou qualquer objeto com a mesma interface: io.on/to/emit, socket.on/emit/join/leave).
'use strict';
const crypto = require('crypto');
const S = require('../shared/sim.js');

const TICK = 1 / 30;            // simulação a 30 Hz
const SNAP_EVERY = 2;           // fotografia do estado a cada 2 passos (15 Hz)
const LOBBY_GRACE = 20000;      // ms para reconectar no lobby
const GAME_GRACE = 45000;       // ms para reconectar durante a partida
const MAX_TEAM = 5;
const MAP_SEED = 20261105;

let MAP = null, WORLD = null;
function world() {
  if (!MAP) { MAP = S.buildMap(MAP_SEED); WORLD = S.makeWorld(MAP); S.makeGame(MAP, WORLD, { humans: [], bots: { 0: 0, 1: 0 }, local: true }); } // aquece o cache de navegação
  return { map: MAP, W: WORLD };
}
const hashPass = (p, salt) => crypto.createHash('sha256').update(salt + ':' + p).digest('hex');
const newId = () => crypto.randomBytes(4).toString('hex').slice(0, 6).toUpperCase();
const clean = (s, n) => String(s == null ? '' : s).replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, n);
const num = (v, a, b, d) => { v = Number(v); return Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : d; };

class RoomManager {
  constructor(io, opts) {
    this.io = io; this.rooms = new Map(); this.socks = new Map(); this.opts = opts || {};
    this.listDirty = false; this.now = () => Date.now();
    io.on('connection', s => this.onConnect(s));
    if (!this.opts.manualTick) { this.timer = setInterval(() => this.tick(), TICK * 1000); this.listTimer = setInterval(() => this.flushList(), 500); }
  }
  stop() { clearInterval(this.timer); clearInterval(this.listTimer); }
  // ---------------- conexão ----------------
  onConnect(s) {
    const me = { sid: s.id, key: null, name: 'Jogador', room: null, inputs: 0, inputWindow: 0 };
    this.socks.set(s.id, { s, me });
    // um erro num evento não pode derrubar o servidor inteiro (todas as salas)
    const on = (ev, fn) => s.on(ev, (...args) => { try { fn(...args); } catch (e) { console.error('[erro em ' + ev + ']', e && e.stack || e); const cb = args.find(x => typeof x === 'function'); if (cb) cb({ error: 'Erro no servidor. Tente de novo.' }); } });
    on('hello', (d, cb) => { me.key = clean(d && d.key, 40) || ('k' + s.id); me.name = clean(d && d.name, 16) || 'Jogador';
      // reconexão: se havia uma vaga deste jogador em alguma sala, volta para ela
      for (const r of this.rooms.values()) { const p = r.players.get(me.key); if (p) { p.sid = s.id; p.connected = true; p.lostAt = 0; p.name = me.name; me.room = r.id; s.join('room:' + r.id); this.sendLobby(r); if (r.state === 'playing') this.sendStart(r, p); if (cb) cb({ ok: true, rejoined: r.id, state: r.state }); return; } }
      if (cb) cb({ ok: true }); });
    on('rooms:sub', () => { s.join('list'); s.emit('rooms:list', this.listPayload()); });
    on('rooms:unsub', () => s.leave('list'));
    on('room:create', (d, cb) => this.create(s, me, d || {}, cb || (() => {})));
    on('room:join', (d, cb) => this.join(s, me, d || {}, cb || (() => {})));
    on('room:info', (d, cb) => { const r = this.rooms.get(clean(d && d.id, 8).toUpperCase()); if (cb) cb(r ? { ok: true, id: r.id, name: r.name, priv: !!r.pass, state: r.state, count: this.count(r) } : { error: 'Sala não encontrada.' }); });
    on('room:leave', () => this.leave(me, true));
    on('lobby:team', d => this.withRoom(me, (r, p) => { const t = d && d.team === 1 ? 1 : 0; if (r.state !== 'lobby' || t === p.team) return; if (this.teamCount(r, t) >= MAX_TEAM) return; p.team = t; p.ready = false; this.clampBots(r); this.sendLobby(r); this.dirty(); }));
    on('lobby:ready', d => this.withRoom(me, (r, p) => { if (r.state !== 'lobby') return; p.ready = !!(d && d.ready); this.sendLobby(r); }));
    on('lobby:bots', d => this.withRoom(me, (r, p) => { if (r.host !== p.key || r.state !== 'lobby') return; const t = d && d.team === 1 ? 1 : 0; r.bots[t] = num(d && d.n, 0, MAX_TEAM, 0); this.clampBots(r); this.sendLobby(r); this.dirty(); }));
    on('lobby:diff', d => this.withRoom(me, (r, p) => { if (r.host !== p.key || r.state !== 'lobby') return; if (S.DIFF_FPS[d && d.diff]) r.diff = d.diff; this.sendLobby(r); }));
    on('lobby:start', (d, cb) => this.withRoom(me, (r, p) => { if (r.host !== p.key) return cb && cb({ error: 'Só o anfitrião pode iniciar.' }); if (r.state !== 'lobby') return cb && cb({ error: 'A partida já começou.' }); this.start(r); cb && cb({ ok: true }); }));
    on('game:input', d => this.input(me, d));
    on('game:back', () => this.withRoom(me, (r, p) => { if (r.state === 'ended' && r.host === p.key) this.toLobby(r); }));
    on('disconnect', () => { this.socks.delete(s.id); const r = me.room && this.rooms.get(me.room); if (!r) return; const p = r.players.get(me.key); if (p && p.sid === s.id) { p.connected = false; p.lostAt = this.now(); if (p.actor) p.actor.in = Object.assign(p.actor.in, { mx: 0, mz: 0, fire: false, use: false }); this.sendLobby(r); this.dirty(); } });
  }
  withRoom(me, fn) { const r = me.room && this.rooms.get(me.room); if (!r) return; const p = r.players.get(me.key); if (p) fn(r, p); }
  // ---------------- salas ----------------
  count(r) { return r.players.size + r.bots[0] + r.bots[1]; }
  teamCount(r, t) { let n = r.bots[t]; for (const p of r.players.values()) if (p.team === t) n++; return n; }
  clampBots(r) { for (const t of [0, 1]) { let h = 0; for (const p of r.players.values()) if (p.team === t) h++; r.bots[t] = Math.max(0, Math.min(r.bots[t], MAX_TEAM - h)); } }
  create(s, me, d, cb) {
    if (!me.key) return cb({ error: 'Conexão não identificada. Recarregue a página.' });
    if (this.rooms.size >= 200) return cb({ error: 'Servidor cheio. Tente mais tarde.' });
    this.leave(me, true);
    let id; do id = newId(); while (this.rooms.has(id));
    const salt = crypto.randomBytes(6).toString('hex'), pass = clean(d.pass, 24);
    const r = { id, name: clean(d.name, 28) || ('Sala de ' + me.name), pass: pass ? hashPass(pass, salt) : null, salt, host: me.key, players: new Map(), bots: { 0: num(d.bots0, 0, 4, 2), 1: num(d.bots1, 0, 5, 3) }, diff: S.DIFF_FPS[d.diff] ? d.diff : 'normal', mode: 'dominacao', state: 'lobby', game: null, created: this.now(), tickN: 0 };
    this.rooms.set(id, r); this.addPlayer(s, me, r); this.clampBots(r); this.sendLobby(r); this.dirty(); cb({ ok: true, id });
  }
  join(s, me, d, cb) {
    if (!me.key) return cb({ error: 'Conexão não identificada. Recarregue a página.' });
    const r = this.rooms.get(clean(d.id, 8).toUpperCase()); if (!r) return cb({ error: 'Sala não encontrada.' });
    if (r.players.has(me.key)) { const p = r.players.get(me.key); p.sid = s.id; p.connected = true; me.room = r.id; s.join('room:' + r.id); this.sendLobby(r); if (r.state === 'playing') this.sendStart(r, p); return cb({ ok: true, id: r.id }); }
    if (r.pass && hashPass(clean(d.pass, 24), r.salt) !== r.pass) return cb({ error: 'Senha incorreta.', needPass: true });
    // abre vaga tirando um bot, se for preciso
    const free = t => this.teamCount(r, t) < MAX_TEAM || r.bots[t] > 0;
    let team = this.teamCount(r, 0) <= this.teamCount(r, 1) ? 0 : 1; if (!free(team)) team = 1 - team;
    if (!free(team)) return cb({ error: 'Sala cheia (5 contra 5).' });
    if (this.teamCount(r, team) >= MAX_TEAM) r.bots[team]--;
    this.leave(me, true); this.addPlayer(s, me, r, team);
    if (r.state === 'playing') { const p = r.players.get(me.key); this.addActor(r, p); this.sendStart(r, p); }
    this.sendLobby(r); this.dirty(); cb({ ok: true, id: r.id });
  }
  addPlayer(s, me, r, team) { const t = team != null ? team : (this.teamCount(r, 0) <= this.teamCount(r, 1) ? 0 : 1); r.players.set(me.key, { key: me.key, name: me.name, team: t, ready: false, sid: s.id, connected: true, lostAt: 0, actor: null }); me.room = r.id; s.join('room:' + r.id); }
  leave(me, voluntary) {
    const r = me.room && this.rooms.get(me.room); me.room = null; if (!r) return;
    const p = r.players.get(me.key); const sk = this.socks.get(p ? p.sid : ''); if (sk) sk.s.leave('room:' + r.id);
    if (p) this.removePlayer(r, p);
  }
  removePlayer(r, p) {
    r.players.delete(p.key);
    if (p.actor && r.game) { const G = r.game; G.actors = G.actors.filter(a => a !== p.actor); }
    if (!r.players.size) { this.closeRoom(r); return; }
    if (r.host === p.key) { const next = [...r.players.values()].find(q => q.connected) || [...r.players.values()][0]; r.host = next.key; }
    this.clampBots(r); this.sendLobby(r); this.dirty();
  }
  closeRoom(r) { this.io.to('room:' + r.id).emit('room:closed', { id: r.id }); this.rooms.delete(r.id); this.dirty(); }
  listPayload() { return [...this.rooms.values()].map(r => ({ id: r.id, name: r.name, priv: !!r.pass, humans: r.players.size, bots: r.bots[0] + r.bots[1], total: this.count(r), max: 10, state: r.state, full: this.count(r) >= 10 && !(r.bots[0] + r.bots[1]), mode: 'Dominação de Bases', host: (r.players.get(r.host) || {}).name || '' })); }
  dirty() { this.listDirty = true; }
  flushList() { if (!this.listDirty) return; this.listDirty = false; this.io.to('list').emit('rooms:list', this.listPayload()); }
  sendLobby(r) { this.io.to('room:' + r.id).emit('lobby:state', { id: r.id, name: r.name, priv: !!r.pass, state: r.state, host: r.host, diff: r.diff, mode: r.mode, bots: r.bots, players: [...r.players.values()].map(p => ({ key: p.key, name: p.name, team: p.team, ready: p.ready, host: p.key === r.host, conn: p.connected })) }); }
  // ---------------- partida ----------------
  start(r) {
    const { map, W: base } = world(); if (!r.W) r.W = base.fork(); const W = r.W; // cada sala com seus próprios carros/obstáculos
    const humans = [...r.players.values()].map(p => ({ key: p.key, name: p.name, team: p.team }));
    const G = S.makeGame(map, W, { humans, bots: r.bots, diff: r.diff, local: false });
    r.game = G; r.state = 'playing'; r.tickN = 0; G.events.length = 0;
    for (const p of r.players.values()) { p.actor = G.actors.find(a => a.key === p.key); p.ready = false; p.lastPos = null; p.lastInT = 0; }
    for (const p of r.players.values()) this.sendStart(r, p);
    this.sendLobby(r); this.dirty();
  }
  addActor(r, p) { const G = r.game; const a = G.mk(p.team, G.actors.length, 'remote', p.name, p.key); G.actors.push(a); p.actor = a; p.lastPos = null; }
  roster(r) { return r.game.actors.map(a => ({ id: a.id, name: a.name, team: a.team, bot: a.isBot })); }
  sendStart(r, p) { const sk = this.socks.get(p.sid); if (!sk || !r.game || !p.actor) return; sk.s.emit('game:start', { seed: MAP_SEED, myId: p.actor.id, roster: this.roster(r), npcs: r.game.npcs.map(n => ({ id: n.id, name: n.name, shirt: n.shirt })), cars: r.game.cars.map(c => ({ id: c.id, dir: c.dir, col: c.col, van: c.van, s: c.s })), cfg: S.CONFIG, dayT: r.game.dayT }); }
  // entrada do jogador: o servidor valida movimento e aplica ações com as mesmas regras do jogo
  input(me, d) {
    const r = me.room && this.rooms.get(me.room); if (!r || r.state !== 'playing' || !d) return; const p = r.players.get(me.key); if (!p || !p.actor) return;
    const now = this.now(); if (now - me.inputWindow > 1000) { me.inputWindow = now; me.inputs = 0; } if (++me.inputs > 45) return; // limite de mensagens
    const a = p.actor, I = a.in, G = r.game, W = G.W;
    I.mx = num(d.mx, -1, 1, 0); I.mz = num(d.mz, -1, 1, 0); I.aim = !!d.a; I.crouch = !!d.c; I.sprint = !!d.sp; I.fire = !!d.f; I.use = !!d.u;
    if (d.r) I.reload = true; if (d.sw) I.swap = true; if (d.g) I.gren = true; // granada: o servidor confere estoque e intervalo
    a.yaw = num(d.yaw, -1e4, 1e4, a.yaw); a.pitch = num(d.pitch, -1.45, 1.45, 0); a.crouch = I.crouch;
    if (!a.alive) return;
    const x = num(d.x, 0, S.MW, a.x), y = num(d.y, -10, 60, a.y), z = num(d.z, 0, S.ML, a.z);
    const dt = Math.max(0.02, Math.min(0.5, (now - (p.lastInT || now)) / 1000)) || 0.05; p.lastInT = now;
    const horiz = Math.hypot(x - a.x, z - a.z), maxH = 6.6 * dt * 1.6 + 0.35, g = W.groundAt(x, z, 0.3);
    const valid = horiz <= maxH && W.fits(x, z, Math.max(y, g), 0.3) && y >= g - 0.35 && y <= g + 3.2 && !(y - a.y > 1.4 + STEP_UP_SAFE * dt);
    if (valid) { a.spd = horiz / dt > 0.3 ? horiz / dt : 0; a.x = x; a.y = y; a.z = z; a.onGround = y <= g + 0.05; a.sprinting = I.sprint && a.spd > 5; }
    else { p.correct = true; p.rejects = (p.rejects || 0) + 1; p.lastReject = { horiz: +horiz.toFixed(2), maxH: +maxH.toFixed(2), fits: W.fits(x, z, Math.max(y, g), 0.3), y, g, ay: a.y, x, z, ax: a.x, az: a.z }; }
  }
  tick() {
    for (const r of this.rooms.values()) {
      const now = this.now();
      // limpeza de desconectados
      for (const p of [...r.players.values()]) if (!p.connected && p.lostAt && now - p.lostAt > (r.state === 'playing' ? GAME_GRACE : LOBBY_GRACE)) this.removePlayer(r, p);
      if (!this.rooms.has(r.id) || r.state !== 'playing') continue;
      try {
        const G = r.game; G.update(TICK); r.tickN++;
        if (r.tickN % SNAP_EVERY === 0) this.snapshot(r);
        if (G.over) this.finish(r);
      } catch (e) { console.error('[erro na sala ' + r.id + ']', e && e.stack || e); r.errors = (r.errors || 0) + 1; if (r.errors > 5) { this.io.to('room:' + r.id).emit('room:closed', { id: r.id, reason: 'erro' }); this.rooms.delete(r.id); this.dirty(); } }
    }
  }
  snapshot(r) {
    const G = r.game, q = v => Math.round(v * 100) / 100;
    const actors = G.actors.map(a => [a.id, q(a.x), q(a.y), q(a.z), Math.round(a.yaw * 1000) / 1000, Math.round(a.pitch * 1000) / 1000, Math.round(a.hp), (a.alive ? 1 : 0) | (a.crouch ? 2 : 0) | (a.cur === 'pistol' ? 4 : 0) | (a.reloadT > 0 ? 8 : 0) | (a.invuln > 0 ? 16 : 0) | (a.hurtT > 0 ? 32 : 0), q(a.spd), a.kills, a.deaths]);
    const npcs = G.npcs.map(n => [n.id, q(n.x), q(n.y), q(n.z), Math.round(n.yaw * 1000) / 1000, n.alive ? 1 : 0, q(n.spd), q(n.deathT)]);
    const bases = G.bases.map(b => [b.owner, Math.round(b.prog * 1000) / 1000, b.state, b.inside[0], b.inside[1]]);
    const ev = G.events.map(e => { const o = {}; for (const k in e) o[k] = typeof e[k] === 'number' && !Number.isInteger(e[k]) ? Math.round(e[k] * 100) / 100 : e[k]; return o; }); G.events.length = 0;
    const cars = G.cars.map(c => [q(c.s), q(c.spd)]), gr = G.grenades.map(g => [g.id, q(g.x), q(g.y), q(g.z)]);
    const base = { t: Math.round(G.t * 100) / 100, dn: Math.round(G.dayT * 1e5) / 1e5, gr, a: actors, n: npcs, c: cars, b: bases, s: [Math.round(G.score[0] * 100) / 100, Math.round(G.score[1] * 100) / 100], tl: Math.round(G.timeLeft), ev };
    for (const p of r.players.values()) { const sk = this.socks.get(p.sid); if (!sk || !p.connected || !p.actor) continue; const a = p.actor;
      const me = { id: a.id, hp: Math.round(a.hp), alive: a.alive, rt: Math.max(0, Math.round(a.respawnT * 10) / 10), cur: a.cur, am: [a.ammo.rifle.mag, a.ammo.rifle.res, a.ammo.pistol.mag, a.ammo.pistol.res], rl: Math.round(a.reloadT * 100) / 100, sw: Math.round(a.swapT * 100) / 100, rf: Math.round(a.refillT * 100) / 100, rfc: Math.round(a.refillCd * 10) / 10, near: G.nearStation(a), inv: a.invuln > 0, gn: a.gren || 0 };
      const justSpawned = a.alive && !p.wasAlive; p.wasAlive = a.alive;
      if (p.correct || !a.alive || justSpawned) { me.pos = [q(a.x), q(a.y), q(a.z)]; me.cor = 1; p.correct = false; }
      sk.s.emit('game:snap', Object.assign({ me }, base)); }
  }
  finish(r) {
    const G = r.game; r.state = 'ended';
    const stats = G.actors.map(a => ({ id: a.id, name: a.name, team: a.team, bot: a.isBot, kills: a.kills, deaths: a.deaths, caps: a.caps || 0, npc: a.npcKills || 0 }));
    this.io.to('room:' + r.id).emit('game:end', { winner: G.winner, score: G.score.map(v => Math.floor(v)), stats, bases: G.bases.map(b => ({ id: b.id, name: b.name, owner: b.owner })) });
    for (const p of r.players.values()) p.actor = null;
    this.sendLobby(r); this.dirty();
    r.backTimer = setTimeout(() => { if (this.rooms.has(r.id) && r.state === 'ended') this.toLobby(r); }, this.opts.backDelay || 20000);
  }
  toLobby(r) { clearTimeout(r.backTimer); r.state = 'lobby'; r.game = null; this.clampBots(r); this.sendLobby(r); this.io.to('room:' + r.id).emit('lobby:back', {}); this.dirty(); }
}
const STEP_UP_SAFE = 12; // tolerância vertical para pulos e degraus (m/s)
module.exports = { RoomManager, world, TICK };
