/* Complexo do Escadão 3D — partida no cliente: treino local ou online (servidor autoritativo),
   controles, câmera, personagens, traçantes, áudio espacial e HUD. */
(function () {
'use strict';
const S = window.EscSim, RND = window.EscRender, HUD = window.EscHUD;
const { CELL, GX, GZ, TEAM, CONFIG, clamp, lerp, angDiff } = S;
const m4 = RND.m4;
const P = window.EscPlay = {};

// ---------------- mundo (gerado uma vez) ----------------
P.world = null;
P.ensureWorld = function () {
  if (P.world) return P.world;
  const map = S.buildMap(20261105), W = S.makeWorld(map);
  P.world = { map, W, radar: makeRadar(map) }; return P.world;
};
function makeRadar(map) { const cv = document.createElement('canvas'); cv.width = GX; cv.height = GZ; const g = cv.getContext('2d'), img = g.createImageData(GX, GZ);
  for (let j = 0; j < GZ; j++) for (let i = 0; i < GX; i++) { const c = j * GX + i, k = map.K[c], h = map.H[c]; let col;
    if (k === S.K_ROOF) { const t = clamp(h / 22, 0, 1); col = [70 + t * 60, 60 + t * 50, 52 + t * 40]; } else if (k === S.K_MATA || k === S.K_TRAIL) col = k === S.K_TRAIL ? [150, 110, 70] : [55, 95, 50]; else if (k === S.K_ESC) col = [255, 210, 74]; else if (k === S.K_AVE) col = [120, 122, 128]; else if (S.WALKABLE[k]) col = [205, 196, 178]; else if (k === S.K_VOID) col = h < 1 && ((i + 0.5) * CELL) > 75 ? [70, 110, 150] : [60, 90, 60]; else col = [40, 36, 32];
    const o = (j * GX + i) * 4; img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; img.data[o + 3] = 235; }
  g.putImageData(img, 0, 0); return cv; }

// ---------------- renderizador ----------------
P.initRenderer = function (canvas) {
  if (P.R) return P.R;
  const { map } = P.ensureWorld();
  const R = RND.createRenderer(canvas); if (!R) throw new Error('WebGL indisponível neste navegador.');
  const Wg = RND.buildGeometry(map); RND.buildDecor(map, Wg);
  const decalGeo = new RND.Geo(true); for (const d of Wg.decals) { const l = Wg.lit([1, 1, 1], d.n[0], d.n[1], d.n[2], 1, 1).map(v => Math.min(1.05, v * 1.05)); decalGeo.quad(d.p, d.uv, 0, [l, l, l, l]); }
  R.upload(Wg.geo, decalGeo, Wg.lines, RND.makeAtlas(), RND.makeDecals('"Bungee","Arial Black",Impact,sans-serif'));
  P.R = R; P.Wg = Wg;
  return R;
};
// hora do dia => luz do cenário (no menu: fim de tarde)
P.applyEnv = function (t) { if (P.R) P.R.setEnv(RND.dayEnv(t, (P.cfg && P.cfg.quality) || 'medio')); };
const QUALITY = { baixo: { scale: 0.6, fog: 0.0095, fx: 24 }, medio: { scale: 0.85, fog: 0.0074, fx: 60 }, alto: { scale: 1.5, fog: 0.0062, fx: 140 } };
P.quality = () => QUALITY[(P.cfg && P.cfg.quality) || 'medio'] || QUALITY.medio;

// ---------------- sessão ----------------
// opts: { mode:'offline'|'online', team, diff, name, socket, start:{myId, roster, npcs} }
P.startSession = function (opts, ui) {
  const { map, W } = P.ensureWorld();
  const s = P.sess = { mode: opts.mode, ui, t: 0, fx: { tracers: [], puffs: [], flashes: [] }, alerts: [], feed: [], dmgDirs: [], hitT: 0, cam: null, recoil: 0, lastSend: 0, seq: 0, center: null, stepT: 0, snaps: [], over: false, endData: null, editing: false, paused: false };
  s.input = { mx: 0, mz: 0, dx: 0, dy: 0, fire: false, aim: false, jump: false, crouch: false, reload: false, sprint: false, swap: false, use: false };
  if (opts.mode === 'offline') {
    s.G = S.makeGame(map, W, { team: opts.team, diff: opts.diff, name: opts.name });
    s.me = s.G.player; s.myId = s.me.id;
  } else {
    s.cars = (opts.start.cars || []).map(c => Object.assign({ spd: 0, ts: c.s, x: 0, z: 0, fx: 0, fz: 1 }, c)); s.grenades = []; s.dayT = opts.start.dayT || CONFIG.dayStart;
    s.socket = opts.socket; s.myId = opts.start.myId; s.roster = new Map(opts.start.roster.map(r => [r.id, r])); s.npcInfo = new Map(opts.start.npcs.map(n => [n.id, n]));
    s.actors = new Map(); s.npcs = new Map(); s.bases = S.makeGame ? null : null; s.score = [0, 0];
    s.me = { id: s.myId, team: (s.roster.get(s.myId) || {}).team || 0, x: 0, y: 0, z: 0, vy: 0, onGround: true, yaw: 0, pitch: 0, hp: 100, alive: false, crouch: false, spd: 0, anim: 0, ammo: { rifle: { mag: 30, res: 180 }, pistol: { mag: 15, res: 75 } }, cur: 'rifle', reloadT: 0, refillT: 0, respawnT: 0, bloom: 0, placed: false };
    const helper = S.makeGame(map, W, { humans: [], bots: { 0: 0, 1: 0 }, local: true }); sectorFn = helper.sectorAt; s.helper = helper;
    s.basesView = helper.bases.map(b => Object.assign({}, b));
    s.onSnap = d => onSnap(s, d); s.onEnd = d => { s.over = true; s.endData = d; ui.onEnd(d); };
    s.socket.on('game:snap', s.onSnap); s.socket.on('game:end', s.onEnd);
  }
  s.team = s.me.team; return s;
};
P.endSession = function () { const s = P.sess; if (!s) return; if (s.socket) { s.socket.off('game:snap', s.onSnap); s.socket.off('game:end', s.onEnd); } P.sess = null; };

// ---------------- rede (cliente) ----------------
function onSnap(s, d) {
  const now = performance.now();
  s.serverT = d.t; s.score = d.s; s.timeLeft = d.tl;
  for (const a of d.a) { const [id, x, y, z, yaw, pitch, hp, fl, spd, k, de] = a; let v = s.actors.get(id); const info = s.roster.get(id) || { name: '?', team: 0 };
    if (!v) { v = { id, name: info.name, team: info.team, buf: [], anim: 0, deathT: 0 }; s.actors.set(id, v); }
    const alive = !!(fl & 1); if (!alive && v.alive) v.deathT = 0; v.alive = alive; v.hp = hp; v.crouch = !!(fl & 2); v.cur = fl & 4 ? 'pistol' : 'rifle'; v.reloading = !!(fl & 8); v.inv = !!(fl & 16); v.hurtT = fl & 32 ? 0.12 : v.hurtT; v.spd = spd; v.kills = k; v.deaths = de;
    v.buf.push({ t: now, x, y, z, yaw, pitch }); if (v.buf.length > 8) v.buf.shift(); }
  for (const n of d.n) { const [id, x, y, z, yaw, alive, spd, dt] = n; let v = s.npcs.get(id); const info = s.npcInfo.get(id) || {}; if (!v) { v = { id, npc: true, team: 2, name: info.name, shirt: info.shirt || [0.8, 0.8, 0.7], skin: [0.75, 0.55, 0.4], buf: [], anim: 0 }; s.npcs.set(id, v); }
    v.alive = !!alive; v.spd = spd; v.deathT = dt; v.buf.push({ t: now, x, y, z, yaw, pitch: 0 }); if (v.buf.length > 8) v.buf.shift(); }
  if (d.c && s.cars) d.c.forEach((c, i) => { const car = s.cars[i]; if (!car) return; car.ts = c[0]; car.spd = c[1]; });
  if (d.gr) s.grenades = d.gr.map(g => ({ id: g[0], x: g[1], y: g[2], z: g[3] }));
  if (d.pol) s.pol = { phase: d.pol.ph, team: d.pol.tm, left: d.pol.left, cars: d.pol.c.map(c => ({ x: c[0], z: c[1], fx: c[2], fz: c[3], parked: !!c[4] })) };
  if (d.dn != null) s.dayT = d.dn;
  if (d.bl) s.baile = { on: !!d.bl[0], t0: d.bl[1] }; s.serverT = d.t; s.serverAt = performance.now();
  d.b.forEach((b, i) => { const v = s.basesView[i]; v.owner = b[0]; v.prog = b[1]; v.state = b[2]; v.inside = [b[3], b[4]]; });
  const me = s.me, m = d.me; if (m) {
    const wasAlive = me.alive; me.hp = m.hp; me.alive = m.alive; me.respawnT = m.rt; me.cur = m.cur; me.ammo.rifle.mag = m.am[0]; me.ammo.rifle.res = m.am[1]; me.ammo.pistol.mag = m.am[2]; me.ammo.pistol.res = m.am[3]; me.reloadT = m.rl; me.swapT = m.sw; me.refillT = m.rf; me.refillCd = m.rfc; me.near = m.near; me.desk = !!m.desk; me.invuln = m.inv ? 1 : 0; me.gren = m.gn;
    if (m.pos && (m.cor || !wasAlive || !me.placed)) { me.x = m.pos[0]; me.y = m.pos[1]; me.z = m.pos[2]; me.vy = 0; me.placed = true; if (!wasAlive && m.alive) { me.yaw = me.team ? Math.PI : 0; me.pitch = 0; s.cam = null; } }
  }
  for (const e of d.ev) handleEvent(s, e);
}
function viewActors(s) { // posições interpoladas ~100 ms no passado
  const now = performance.now() - 100, out = [];
  const interp = v => { const b = v.buf; if (!b.length) return null; let i = b.length - 1; while (i > 0 && b[i - 1].t > now) i--; const B = b[i], A = b[Math.max(0, i - 1)]; const k = B.t === A.t ? 1 : clamp((now - A.t) / (B.t - A.t), 0, 1);
    return { x: lerp(A.x, B.x, k), y: lerp(A.y, B.y, k), z: lerp(A.z, B.z, k), yaw: A.yaw + angDiff(A.yaw, B.yaw) * k, pitch: lerp(A.pitch, B.pitch, k) }; };
  for (const v of s.actors.values()) { if (v.id === s.myId) continue; const p = interp(v); if (p) { Object.assign(v, p); out.push(v); } }
  for (const v of s.npcs.values()) { const p = interp(v); if (p) { Object.assign(v, p); out.push(v); } }
  return out;
}
function sendInput(s, now) {
  if (now - s.lastSend < 50) return; s.lastSend = now; const I = s.input, me = s.me;
  const pos = me.placed && me.alive ? { x: me.x, y: me.y, z: me.z } : {};
  s.socket.emit('game:input', { ...pos, yaw: me.yaw, pitch: me.pitch, mx: I.mx, mz: I.mz, f: I.fire ? 1 : 0, a: I.aim ? 1 : 0, c: I.crouch ? 1 : 0, sp: I.sprint ? 1 : 0, u: I.use ? 1 : 0, r: s.pendReload ? 1 : 0, sw: s.pendSwap ? 1 : 0, g: s.pendGren ? 1 : 0 });
  s.pendReload = false; s.pendSwap = false; s.pendGren = false;
}

// ---------------- eventos (sons, traçantes, avisos) ----------------
function actorById(s, id) { if (s.mode === 'offline') return s.G.byId(id); if (id === s.myId) return s.me; return s.actors.get(id) || s.npcs.get(id); }
const nameOf = (s, id) => { const a = actorById(s, id); return a ? a.name : '?'; };
const teamCss = t => t === 0 ? '#6FB0FF' : t === 1 ? '#FF7A66' : t === 2 ? '#A9C0E0' : '#ddd';
function alert(s, text, col, big, dur) { s.alerts.unshift({ text, col, big, t: dur || 2.6 }); if (s.alerts.length > 3) s.alerts.pop(); }
function handleEvent(s, e) {
  const me = s.me, A = P.audio, Wd = P.world.W;
  const head = [me.x, me.y + (me.crouch ? 1.15 : 1.6), me.z];
  switch (e.type) {
    case 'shot': {
      const own = e.id === s.myId, sh = actorById(s, e.id), d = Math.hypot(e.ox - head[0], e.oz - head[2]);
      // traçante saindo do cano: para o próprio jogador, a partir da arma em primeira pessoa
      let mz;
      if (own) { const f = [Math.sin(me.yaw) * Math.cos(me.pitch), Math.sin(me.pitch), Math.cos(me.yaw) * Math.cos(me.pitch)], rt = [-Math.cos(me.yaw), 0, Math.sin(me.yaw)]; mz = [head[0] + f[0] * 0.7 + rt[0] * 0.16, head[1] - 0.13 + f[1] * 0.7, head[2] + f[2] * 0.7 + rt[2] * 0.16]; s.recoil = 1; }
      else { const yaw = sh ? sh.yaw : 0, f = [Math.sin(yaw), 0, Math.cos(yaw)], rt = [-Math.cos(yaw), 0, Math.sin(yaw)]; mz = [e.ox + f[0] * 0.75 + rt[0] * 0.12, e.oy - 0.3, e.oz + f[2] * 0.75 + rt[2] * 0.12]; }
      const len = Math.hypot(e.ex - mz[0], e.ey - mz[1], e.ez - mz[2]);
      if (s.fx.tracers.length < P.quality().fx) s.fx.tracers.push({ a: mz, b: [e.ex, e.ey, e.ez], len, t: 0, dur: Math.max(0.03, len / 420) });
      s.fx.flashes.push({ p: mz, t: 0.05, own });
      if (e.wall && s.fx.puffs.length < P.quality().fx) s.fx.puffs.push({ p: [e.ex, e.ey, e.ez], t: 0.5, T: 0.5, col: [0.62, 0.58, 0.52], s: 0.3, delay: len / 420 });
      if (e.hit && s.fx.puffs.length < P.quality().fx) s.fx.puffs.push({ p: [e.ex, e.ey, e.ez], t: 0.2, T: 0.2, col: [0.55, 0.5, 0.45], s: 0.18, delay: len / 420 });
      if (A) { const occluded = !own && !Wd.los(head[0], head[1], head[2], e.ox, e.oy, e.oz); A.shot(e.w || 'rifle', e.id, e.ox, e.oy, e.oz, d, own, occluded); }
      if (!own && d < 130) (s.battle || (s.battle = [])).push({ t: performance.now(), x: e.ox, y: e.oy, z: e.oz, id: e.id });
      // zumbido: o projétil passou perto e não me acertou
      if (!own && e.hit !== s.myId && me.alive && A) { const ax = e.ox, ay = e.oy, az = e.oz, bx = e.ex - ax, by = e.ey - ay, bz = e.ez - az, L2 = bx * bx + by * by + bz * bz || 1; const t = clamp(((head[0] - ax) * bx + (head[1] - ay) * by + (head[2] - az) * bz) / L2, 0, 1);
        const px = ax + bx * t, py = ay + by * t, pz = az + bz * t, dd = Math.hypot(head[0] - px, head[1] - py, head[2] - pz); if (dd < 2.2 && t > 0.02 && t < 0.98) setTimeout(() => A.whizz(px, py, pz), Math.min(400, Math.sqrt(L2) * t / 420 * 1000)); }
      break; }
    case 'hit': if (e.by === s.myId) { s.hitT = 0.18; s.hitHead = e.head; if (A) A.blip(e.head ? 1700 : 1150, 0.05, 'square', 0.06); } if (e.v === s.myId) { const b = actorById(s, e.by); if (A) A.thud(); if (b) s.dmgDirs.push({ ang: Math.atan2(b.x - me.x, b.z - me.z), t: 1 }); } break;
    case 'kill': { const k = e.cause === 'car' ? { name: 'Atropelado', team: -1 } : actorById(s, e.by), v = actorById(s, e.v);
      if (e.by === s.myId && e.v !== s.myId) { const now2 = performance.now(); s.streak = s.killIcon && now2 - s.killIcon.at < 4500 ? s.streak + 1 : 1; s.killIcon = { at: now2, head: !!e.head, n: s.streak }; }
      s.feed.unshift({ k: k ? k.name : '?', v: v ? v.name : '?', kc: teamCss(k && k.team), vc: teamCss(v && v.team), head: e.head, t: 6 }); if (s.feed.length > 5) s.feed.pop();
      if (e.by === s.myId && A) { A.blip(880, 0.09, 'triangle', 0.14); setTimeout(() => A.blip(1320, 0.12, 'triangle', 0.12), 70); } if (e.v === s.myId) { s.deathText = e.by === s.myId ? 'Você caiu' : 'Derrubado por ' + (k ? k.name : '?'); s.killer = e.by; } break; }
    case 'base': { const b = (s.mode === 'offline' ? s.G.bases : s.basesView).find(q => q.id === e.base); const nm = 'Base ' + e.base;
      if (e.team === s.team) { alert(s, nm + ' capturada', '#7BE07B', true); if (A) A.blip(990, 0.18, 'triangle', 0.12); }
      else if (e.team === 2) { alert(s, nm + ' ocupada pela POLÍCIA', '#A9C0E0', true); if (A) A.blip(250, 0.2, 'sawtooth', 0.08); }
      else if (e.team >= 0) { alert(s, nm + ' dominada pelo time ' + TEAM[e.team].name, teamCss(e.team), true); if (A) A.blip(330, 0.18, 'triangle', 0.12); }
      else if (e.from === s.team) alert(s, nm + ' perdida', '#FF8A6A', true); else alert(s, nm + ' neutralizada', '#ddd'); break; }
    case 'contest': alert(s, 'Base ' + e.base + ' contestada', '#FFD24A'); break;
    case 'runover': if (e.v === s.myId) s.deathText = 'Você foi atropelado'; break;
    case 'police': { const fav = 'favela do ' + (TEAM[e.team] ? TEAM[e.team].name : '?'), mine = e.team === s.team;
      if (e.phase === 'start') { alert(s, 'OPERAÇÃO POLICIAL NA ' + fav.toUpperCase() + '!' + (e.n ? ' (' + e.n + ' policiais)' : ''), '#A9C0E0', true, 5); if (mine) alert(s, 'As viaturas estão vindo para a SUA favela — defenda as bases!', '#FFB45A', false, 5); if (A) A.siren(true); }
      else if (e.phase === 'incursao') alert(s, 'Polícia desembarcou: incursão na ' + fav, '#A9C0E0', true, 4);
      else if (e.phase === 'end') { alert(s, e.result === 'derrotada' ? 'A polícia recuou: operação derrotada' : 'A polícia foi embora: fim da operação', '#7BE07B', true, 4); if (A) A.siren(false); }
      break; }
    case 'npc': alert(s, 'PENALIDADE: NPC CIVIL ELIMINADO — -' + CONFIG.npcPenalty + '%', teamCss(e.team), true, 3.5); if (A) A.blip(220, 0.3, 'sawtooth', 0.08); break;
    case 'refill': if (e.id === s.myId) { alert(s, 'MUNIÇÃO REABASTECIDA', '#FFD24A', true); if (A) A.blip(760, 0.12, 'triangle', 0.12); } break;
    case 'empty': if (e.id === s.myId) alert(s, 'SEM MUNIÇÃO — RETORNE À BASE', '#FF8A6A', true, 3); break;
    case 'dry': if (e.id === s.myId) { if (A) A.blip(180, 0.04, 'square', 0.07); const now2 = performance.now(); if (!s.dryAt || now2 - s.dryAt > 1800) { s.dryAt = now2; const tot = me.ammo.rifle.mag + me.ammo.rifle.res + me.ammo.pistol.mag + me.ammo.pistol.res;
      alert(s, tot ? CONFIG.weapons[me.cur].name + ' SEM MUNIÇÃO — troque de arma ou volte à base para recarregar' : 'SEM MUNIÇÃO — VOLTE À BASE PARA RECARREGAR', '#FF6A55', true, 3); } } break;
    case 'reload': if (e.id === s.myId && A) { A.blip(420, 0.04, 'square', 0.07); setTimeout(() => A.blip(300, 0.05, 'square', 0.07), 700); } break;
    case 'reloaded': if (e.id === s.myId && A) A.blip(620, 0.05, 'square', 0.08); break;
    case 'swap': if (e.id === s.myId && A) A.blip(520, 0.04, 'square', 0.06); break;
    case 'spawn': if (e.id === s.myId) { s.deathText = null; s.cam = null; } break;
    case 'gthrow': if (e.id === s.myId) { s.throwT = 0.5; if (A) A.blip(900, 0.05, 'square', 0.05); } break;
    case 'gboom': { const d = Math.hypot(e.x - head[0], e.y - head[1], e.z - head[2]);
      s.fx.flashes.push({ p: [e.x, e.y + 0.6, e.z], t: 0.12, big: 3.2 });
      for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2, r = 0.4 + Math.random() * 0.9; s.fx.puffs.push({ p: [e.x + Math.cos(a) * r, e.y + 0.3 + Math.random() * 1.4, e.z + Math.sin(a) * r], t: 1.4, T: 1.4, col: [0.32, 0.3, 0.28], s: 1.1 + Math.random() * 0.6 }); }
      for (let k = 0; k < 6; k++) s.fx.puffs.push({ p: [e.x + (Math.random() - 0.5) * 1.2, e.y + 0.3 + Math.random(), e.z + (Math.random() - 0.5) * 1.2], t: 0.35, T: 0.35, col: [1, 0.6, 0.25], s: 0.7, add: true });
      if (d < 12) { s.shake = Math.max(s.shake || 0, 1 - d / 12); } if (d < 7 && Wd.los(head[0], head[1], head[2], e.x, e.y + 0.3, e.z)) s.flash = Math.max(s.flash || 0, 0.7 * (1 - d / 7));
      if (A) A.boom(e.x, e.y, e.z, d, !Wd.los(head[0], head[1], head[2], e.x, e.y + 0.3, e.z)); break; }
  }
}

// ---------------- laço do quadro ----------------
P.frame = function (dt, view) {
  const s = P.sess; if (!s || !P.R) return;
  const I = s.input, me = s.me, now = performance.now(), Wd = P.world.W;
  if (!s.paused && !s.over && !s.editing) {
    if (s.mode === 'offline') {
      const G = s.G; Object.assign(me.in, { mx: I.mx, mz: I.mz, dx: I.dx, dy: I.dy, fire: I.fire, aim: I.aim, crouch: I.crouch, sprint: I.sprint, use: I.use }); if (I.jump) me.in.jump = true; if (I.reload) me.in.reload = true; if (I.swap) me.in.swap = true; if (I.gren) me.in.gren = true;
      I.dx = I.dy = 0; I.jump = I.reload = I.swap = I.gren = false;
      let rem = dt; while (rem > 1e-4) { const h = Math.min(rem, 1 / 30); G.update(h); rem -= h; }
      for (const e of G.events) handleEvent(s, e); G.events.length = 0;
      s.score = G.score; s.timeLeft = G.timeLeft; if (G.over && !s.over) { s.over = true; s.ui.onEnd(offlineEnd(G)); }
    } else {
      // carros: andam suavemente entre as fotografias do servidor e viram obstáculo para a previsão local
      Wd.dyn.length = 0; const AL = s.helper.aveLen; s.dayT = (s.dayT + dt / CONFIG.dayLength) % 1;
      for (const c of s.cars) { c.s += c.dir * c.spd * dt; let dd = c.ts - c.s; if (dd > AL / 2) dd -= AL; if (dd < -AL / 2) dd += AL; if (Math.abs(dd) > 25) c.s = c.ts; else c.s += dd * Math.min(1, dt * 3); if (c.s < 0) c.s += AL; if (c.s > AL) c.s -= AL;
        s.helper.carPose(c); Wd.dyn.push({ x: c.x, z: c.z, fx: c.fx, fz: c.fz, hl: 2.3, hw: 1.0, top: c.van ? 2 : 1.5 }); }
      for (const c of (s.pol ? s.pol.cars : [])) Wd.dyn.push({ x: c.x, z: c.z, fx: c.fx, fz: c.fz, hl: 2.4, hw: 1.05, top: 1.7 });
      // previsão local do próprio movimento (o servidor valida e corrige)
      me.yaw -= I.dx; me.pitch = clamp(me.pitch - I.dy, -1.45, 1.45); I.dx = I.dy = 0;
      if (me.alive && me.placed) { me.crouch = I.crouch; const sprint = I.sprint && !I.aim && !me.crouch && I.mz > 0.3, speed = me.crouch ? 2.2 : I.aim ? 2.8 : sprint ? 6.1 : 4.6;
        const fx = Math.sin(me.yaw), fz = Math.cos(me.yaw), rx = -Math.cos(me.yaw), rz = Math.sin(me.yaw); let mx = fx * I.mz + rx * I.mx, mz = fz * I.mz + rz * I.mx; const l = Math.hypot(mx, mz); if (l > 1) { mx /= l; mz /= l; }
        if (I.jump && me.onGround) { me.vy = 4.7; me.onGround = false; } I.jump = false; Wd.move(me, mx * speed, mz * speed, dt); me.spd = l > 0.05 ? speed : 0; me.sprinting = sprint;
        if (I.fire && !sprint) { const w = me.ammo[me.cur], wc = CONFIG.weapons[me.cur]; if ((wc.auto || !s.trig) && w.mag > 0 && me.reloadT <= 0 && (me.swapT || 0) <= 0 && (s.fireCd || 0) <= 0) { s.fireCd = wc.rate; me.pitch = clamp(me.pitch + (I.aim ? 0.008 : 0.013) * (me.cur === 'pistol' ? 1.4 : 1), -1.45, 1.45); me.bloom = Math.min(0.03, (me.bloom || 0) + 0.0045); } s.trig = true; } else s.trig = false; }
      s.fireCd = Math.max(0, (s.fireCd || 0) - dt); me.bloom = Math.max(0, (me.bloom || 0) - dt * 0.12);
      if (I.reload) { s.pendReload = true; I.reload = false; } if (I.swap) { s.pendSwap = true; I.swap = false; } if (I.gren) { s.pendGren = true; I.gren = false; }
      sendInput(s, now);
    }
  } else { I.dx = I.dy = 0; if (s.mode === 'online') sendInput(s, now); }
  if (!me.alive) me.deathT = (me.deathT || 0) + dt; else me.deathT = 0;
  s.throwT = Math.max(0, (s.throwT || 0) - dt); s.flash = Math.max(0, (s.flash || 0) - dt * 1.6); s.shake = Math.max(0, (s.shake || 0) - dt * 2);
  P.applyEnv(s.mode === 'offline' ? s.G.dayT : s.dayT);
  // efeitos
  for (const k of ['puffs', 'flashes']) { for (const f of s.fx[k]) { if (f.delay > 0) f.delay -= dt; else f.t -= dt; } s.fx[k] = s.fx[k].filter(f => f.t > 0); }
  for (const t of s.fx.tracers) t.t += dt; s.fx.tracers = s.fx.tracers.filter(t => t.t < t.dur + 0.05);
  for (const a of s.alerts) a.t -= dt; s.alerts = s.alerts.filter(a => a.t > 0);
  for (const f of s.feed) f.t -= dt; s.feed = s.feed.filter(f => f.t > 0);
  s.dmgDirs = s.dmgDirs.filter(d => (d.t -= dt * 0.9) > 0); s.hitT = Math.max(0, s.hitT - dt); s.recoil = Math.max(0, s.recoil - dt * 9);
  battleAmbience(s); if (!s.paused && !s.over && !s.editing) aimAssist(s, dt);
  baileSound(s); if (s.mode === 'online' && P.voice) P.voice.update();
  s.nearDesk = !!(me.alive && (s.mode === 'offline' ? s.G.nearDesk(me) : me.desk));
  render(s, dt, view);
};
// música do baile: toca a partir do palco quando alguém liga a caixa de som (todos ouvem o mesmo trecho)
function baileSound(s) {
  const A = P.audio; if (!A) return; const b = s.mode === 'offline' ? s.G.baile : s.baile; const on = !!(b && b.on);
  if (on === !!s.baileOn) return; const now = s.mode === 'offline' ? s.G.t : (s.serverT || 0) + (performance.now() - (s.serverAt || performance.now())) / 1000;
  if (A.baile(on, now - (b ? b.t0 : 0), S.STAGE.x, S.STAGE.h + 2, S.STAGE.z + 1) || !on) s.baileOn = on;
}
// som ambiente de tiroteio: quando outros jogadores trocam tiros por perto, toca as gravações longas na direção do confronto
function battleAmbience(s) {
  const A = P.audio, now = performance.now(); if (!A || !s.battle) return; s.battle = s.battle.filter(b => now - b.t < 3500);
  const me = s.me, shooters = new Set(s.battle.map(b => b.id)).size;
  if (s.battle.length >= 4 && shooters >= 2) { let x = 0, y = 0, z = 0; for (const b of s.battle) { x += b.x; y += b.y; z += b.z; } const n = s.battle.length; x /= n; y /= n; z /= n; const d = Math.hypot(x - me.x, z - me.z);
    if (d > 6) A.ambient(x, y, z, d, Math.min(1, n / 14)); s.battleOn = now; }
  else if (s.battleOn && now - s.battleOn > 4000) { A.ambientFade(); s.battleOn = 0; }
}
// assistência de mira leve: puxa um pouco a mira para o inimigo visível mais perto do centro (só ao atirar/mirar no PC; sempre no celular)
function aimAssist(s, dt) {
  if (!P.cfg || !P.cfg.aimAssist) return; const me = s.me, I = s.input; if (!me.alive || !me.placed && s.mode === 'online') return; if (!(I.fire || I.aim || P.touch)) return;
  if (!Number.isFinite(me.x) || !Number.isFinite(me.yaw)) return;
  const eye = [me.x, me.y + (me.crouch ? 1.15 : 1.6), me.z], list = s.mode === 'offline' ? s.G.actors : [...s.actors.values()]; let best = null, bd = 1e9;
  for (const e of list) { if (!e.alive || e === me || e.id === s.myId || e.npc || e.team === me.team || !Number.isFinite(e.x) || !Number.isFinite(e.y) || !Number.isFinite(e.z)) continue; const dx = e.x - eye[0], dz = e.z - eye[2], dist = Math.hypot(dx, dz); if (!(dist <= 80) || dist < 1.2) continue;
    const ey = angDiff(me.yaw, Math.atan2(dx, dz)), ep = Math.atan2(e.y + 1.2 - eye[1], dist) - me.pitch, err = Math.hypot(ey, ep); if (!Number.isFinite(err) || err > 0.06 + 0.5 / dist || err >= bd) continue; best = { e, ey, ep }; bd = err; }
  if (!best || !P.world.W.los(eye[0], eye[1], eye[2], best.e.x, best.e.y + 1.2, best.e.z)) return;
  const k = Math.min(1, dt * (P.touch ? 4 : 3)) * (P.touch ? 0.5 : 0.3); me.yaw += best.ey * k; me.pitch = clamp(me.pitch + best.ep * k, -1.45, 1.45);
}
function offlineEnd(G) { return { winner: G.winner, score: G.score.map(v => Math.floor(v)), stats: G.actors.map(a => ({ id: a.id, name: a.name, team: a.team, bot: a.isBot, kills: a.kills, deaths: a.deaths, caps: a.caps || 0, npc: a.npcKills || 0 })), bases: G.bases.map(b => ({ id: b.id, name: b.name, owner: b.owner })) }; }

// ---------------- câmera e desenho ----------------
function camera(s, dt) {
  const me = s.me; if (!s.cam) s.cam = { y: me.y + 1.6, aim: 0, bob: 0 }; const c = s.cam;
  if (me.alive) { const target = me.y + (me.crouch ? 1.15 : 1.6); if (Math.abs(target - c.y) > 0.8) c.y = target; else c.y += (target - c.y) * Math.min(1, dt * 16); c.bob += dt * (me.spd || 0) * 1.9 * (me.onGround ? 1 : 0); const b = Math.sin(c.bob * 2) * 0.03 * Math.min(1, (me.spd || 0) / 4); const sk = (s.shake || 0) * 0.05, jx = sk ? (Math.random() - 0.5) * sk : 0, jy = sk ? (Math.random() - 0.5) * sk : 0; return { eye: [me.x, c.y + b, me.z], yaw: me.yaw + jx, pitch: me.pitch + jy }; }
  const k = s.killer != null ? actorById(s, s.killer) : null, t = Math.min(1, (me.deathT || 0) / 1.5), ey = me.y + 1.6 + t * 2.5; let yaw = me.yaw, pitch = -0.3 * t;
  if (k && k !== me) { const dx = k.x - me.x, dz = k.z - me.z; yaw = Math.atan2(dx, dz); pitch = Math.atan2(k.y + 1.3 - ey, Math.hypot(dx, dz)); } return { eye: [me.x, ey, me.z], yaw, pitch };
}
P.menuCamera = function (t) { const a = t * 0.05; return { eye: [67.5 + Math.sin(a) * 1.2, 3.6 + Math.sin(t * 0.07) * 0.2, 35 + Math.sin(a * 0.6) * 1.0], yaw: Math.sin(a * 0.9) * 0.08, pitch: 0.2 }; };
P.renderScene = function (cam, aspect, extra) {
  const R = P.R, Q = P.quality(); const fov = (cam.fov || 74) * Math.PI / 180, vfov = aspect < 1 ? 2 * Math.atan(Math.tan(fov / 2) / Math.max(aspect, 0.56) * 0.9) : fov;
  const proj = m4.persp(vfov, aspect, 0.06, 900), f = [Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch)];
  const view = m4.look(cam.eye, [cam.eye[0] + f[0], cam.eye[1] + f[1], cam.eye[2] + f[2]], [0, 1, 0]), VP = m4.mul(proj, view);
  R.begin(VP, cam.eye, Q.fog); R.sky(); R.world(); if (extra) extra(VP, view); return { VP, view };
};
function render(s, dt, view) {
  const R = P.R, me = s.me, cam = camera(s, dt), aspect = R.canvas.width / R.canvas.height;
  const aiming = !!(s.input.aim && me.alive && me.reloadT <= 0); s.cam.aim += ((aiming ? 1 : 0) - s.cam.aim) * Math.min(1, dt * 12);
  cam.fov = P.forceFov || (P.touch ? 80 : 74) - s.cam.aim * 24;
  const others = s.mode === 'offline' ? s.G.actors.filter(a => a !== me).concat(s.G.npcs) : viewActors(s);
  for (const a of others) { a.anim = (a.anim || 0) + dt * (a.spd || 0) * 2.2; if (!a.alive) a.deathT = (a.deathT || 0) + (s.mode === 'online' && !a.npc ? dt : 0); a.hurtT = Math.max(0, (a.hurtT || 0) - (s.mode === 'online' ? dt : 0)); }
  const bases = s.mode === 'offline' ? s.G.bases : s.basesView;
  const r = P.renderScene(cam, aspect, (VP, viewM) => {
    R.solidBegin();
    for (const a of others) { if (!a.alive && (a.deathT || 0) > 3.6) continue; if (Math.hypot(a.x - cam.eye[0], a.z - cam.eye[2]) > 170) continue; drawActor(R, a); }
    for (const c of (s.mode === 'offline' ? s.G.cars : s.cars)) if (Math.hypot(c.x - cam.eye[0], c.z - cam.eye[2]) < 200) drawCar(R, c);
    const pcars = s.mode === 'offline' ? s.G.police.cars.filter(c => c.s >= 0) : (s.pol ? s.pol.cars : []); for (const c of pcars) if (Math.hypot(c.x - cam.eye[0], c.z - cam.eye[2]) < 220) drawPoliceCar(R, c);
    { const ph = s.mode === 'offline' ? s.G.police.phase : s.pol ? s.pol.phase : 'idle'; if (s.sirenPh !== ph && P.audio && P.audio.siren) { s.sirenPh = ph; P.audio.siren(ph !== 'idle'); } }
    if (P.audio && P.audio.sirenAt) P.audio.sirenAt(pcars.map(c => ({ x: c.x, z: c.z })), cam.eye);
    for (const g of (s.mode === 'offline' ? s.G.grenades : s.grenades || [])) R.cube(m4.mul(m4.tr(g.x, g.y, g.z), m4.sc(0.14, 0.18, 0.14)), [0.22, 0.3, 0.18], 0);
    const right = [viewM[0], viewM[4], viewM[8]], up = [viewM[1], viewM[5], viewM[9]], v = [];
    // anéis e bandeiras das bases (cinza neutra, azul, vermelha)
    const w = [], tt = performance.now() / 1000;
    for (const b of bases) { const oc = b.owner < 0 ? [0.62, 0.62, 0.6] : TEAM[b.owner].col, pc = b.prog < 0 ? TEAM[0].col : TEAM[1].col, y = b.h + 0.04;
      for (let k = 0; k < 40; k++) { const a0 = k / 40 * Math.PI * 2, a1 = (k + 1) / 40 * Math.PI * 2, filled = k / 40 < Math.abs(b.prog), col = filled ? pc : oc, rr = b.r, ri = b.r - 0.2;
        const A = [b.x + Math.cos(a0) * rr, y, b.z + Math.sin(a0) * rr], B = [b.x + Math.cos(a0) * ri, y, b.z + Math.sin(a0) * ri], C = [b.x + Math.cos(a1) * ri, y, b.z + Math.sin(a1) * ri], D = [b.x + Math.cos(a1) * rr, y, b.z + Math.sin(a1) * rr];
        for (const p of [A, B, C, A, C, D]) w.push(p[0], p[1], p[2], col[0], col[1], col[2], 0.85, 0, 0); }
      const fy = b.h + 5.1; for (let k = 0; k < 6; k++) { const u0 = k / 6, u1 = (k + 1) / 6, wv = q => Math.sin(tt * 4 + q * 5 + b.x) * 0.12 * q; const Pp = (u, vv) => [b.x + 0.05 + u * 1.4, fy - vv * 0.85, b.z + wv(u)];
        for (const [u, vv] of [[u0, 0], [u0, 1], [u1, 1], [u0, 0], [u1, 1], [u1, 0]]) { const q = Pp(u, vv); w.push(q[0], q[1], q[2], oc[0], oc[1], oc[2], 1, 0, 0); } } }
    R.fx(new Float32Array(w), R.gl.TRIANGLES, false, false, false);
    const bill = (pp, sz, col) => { for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]]) v.push(pp[0] + (right[0] * a + up[0] * b) * sz, pp[1] + (right[1] * a + up[1] * b) * sz, pp[2] + (right[2] * a + up[2] * b) * sz, col[0], col[1], col[2], col[3], (a + 1) / 2, (b + 1) / 2); };
    for (const pf of s.fx.puffs) { if (pf.delay > 0 || pf.add) continue; const k = pf.t / pf.T; bill(pf.p, pf.s * (1.6 - k), [pf.col[0], pf.col[1], pf.col[2], k * 0.8]); }
    if (v.length) R.fx(new Float32Array(v), R.gl.TRIANGLES, true, false, true);
    { const va = []; const vb = v; v.length = 0; for (const pf of s.fx.puffs) if (pf.add && !(pf.delay > 0)) { const k = pf.t / pf.T; bill(pf.p, pf.s * (1.4 - k * 0.5), [pf.col[0], pf.col[1], pf.col[2], k]); } if (v.length) R.fx(new Float32Array(v), R.gl.TRIANGLES, true, true, true, 1.5); }
    v.length = 0; for (const fl of s.fx.flashes) bill(fl.p, fl.big || (fl.own ? 0.15 : 0.28) * (1 + R.env.night * 0.6), [1, 0.8, 0.35, 1]); if (v.length) R.fx(new Float32Array(v), R.gl.TRIANGLES, true, true, true);
    // traçantes: um risco luminoso que viaja do cano até o ponto de impacto
    const lv = [], TB = R.env.tracer; for (const t of s.fx.tracers) { const k0 = clamp(t.t / t.dur, 0, 1), seg = Math.min(1, (2.2 + R.env.night * 1.6) / Math.max(t.len, 0.1)), k1 = clamp(k0 - seg, 0, 1), P0 = [lerp(t.a[0], t.b[0], k1), lerp(t.a[1], t.b[1], k1), lerp(t.a[2], t.b[2], k1)], P1 = [lerp(t.a[0], t.b[0], k0), lerp(t.a[1], t.b[1], k0), lerp(t.a[2], t.b[2], k0)];
      lv.push(P0[0], P0[1], P0[2], 1, 0.85, 0.45, 0.0, 0, 0, P1[0], P1[1], P1[2], 1, 0.95, 0.65, 0.95, 0, 0); }
    if (lv.length) R.fx(new Float32Array(lv), R.gl.LINES, false, true, true, TB);
    if (me.alive && s.cam.aim < 0.85 && !s.editing) drawViewmodel(R, s, aspect, dt);
  });
  s.VP = r.VP;
  if (P.audio) P.audio.setListener(cam.eye[0], cam.eye[1], cam.eye[2], cam.yaw, cam.pitch);
  // passos de quem está perto
  s.stepT -= dt; if (s.stepT <= 0 && P.audio) { s.stepT = 0.34; for (const a of others) { if (!a.alive || a.npc || (a.spd || 0) < 3) continue; if (Math.hypot(a.x - me.x, a.z - me.z) < 16) P.audio.step(a.x, a.y, a.z); } }
  drawHud(s, view, bases, others);
}
// viatura: branca com portas pretas, giroflex vermelho/azul piscando
function drawPoliceCar(R, c) {
  const X = m4.mul, T = m4.tr, B = X(T(c.x, 0, c.z), m4.ry(Math.atan2(c.fx, c.fz))), W = [0.92, 0.93, 0.95], K = [0.08, 0.08, 0.1], t = performance.now() / 1000, on = Math.floor(t * 6) % 2;
  R.cube(X(X(B, T(0, 0.66, 0)), m4.sc(1.9, 0.64, 4.5)), W, 0); R.cube(X(X(B, T(0, 0.62, 0.15)), m4.sc(1.92, 0.5, 1.6)), K, 0); R.cube(X(X(B, T(0, 1.2, -0.15)), m4.sc(1.66, 0.5, 2.2)), [0.25, 0.3, 0.38], 0); R.cube(X(X(B, T(0, 1.47, -0.15)), m4.sc(1.68, 0.05, 2.1)), W, 0);
  R.cube(X(X(B, T(-0.38, 1.56, -0.1)), m4.sc(0.6, 0.14, 0.3)), on ? [2.2, 0.2, 0.15] : [0.5, 0.08, 0.06], 0, on); R.cube(X(X(B, T(0.38, 1.56, -0.1)), m4.sc(0.6, 0.14, 0.3)), on ? [0.25, 0.35, 0.6] : [0.2, 0.45, 2.4], 0, 1 - on);
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) R.cube(X(X(B, T(a * 0.92, 0.33, b * 1.4)), m4.sc(0.24, 0.66, 0.66)), K, 0);
  R.cube(X(X(B, T(0, 0.55, 2.26)), m4.sc(1.6, 0.25, 0.03)), [0.1, 0.1, 0.12], 0); R.cube(X(X(B, T(-0.62, 0.75, 2.26)), m4.sc(0.3, 0.14, 0.02)), [1.6, 1.5, 1.2], 0, 1); R.cube(X(X(B, T(0.62, 0.75, 2.26)), m4.sc(0.3, 0.14, 0.02)), [1.6, 1.5, 1.2], 0, 1);
}
function drawCar(R, c) {
  const X = m4.mul, T = m4.tr, B = X(T(c.x, 0, c.z), m4.ry(Math.atan2(c.fx, c.fz))), col = c.col, Pc = M => R.cube(M, col, 0), dark = [0.12, 0.12, 0.13];
  if (c.van) { R.cube(X(X(B, T(0, 1.1, 0)), m4.sc(1.9, 1.6, 4.4)), col, 0); R.cube(X(X(B, T(0, 1.45, 2.21)), m4.sc(1.7, 0.6, 0.02)), [0.25, 0.32, 0.4], 0); }
  else { Pc(X(X(B, T(0, 0.65, 0)), m4.sc(1.8, 0.62, 4.3))); R.cube(X(X(B, T(0, 1.18, -0.1)), m4.sc(1.6, 0.5, 2.1)), [0.3, 0.38, 0.48], 0); R.cube(X(X(B, T(0, 1.44, -0.1)), m4.sc(1.62, 0.04, 2.0)), col, 0); }
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) R.cube(X(X(B, T(a * 0.88, 0.32, b * 1.35)), m4.sc(0.24, 0.64, 0.64)), dark, 0);
  const hl = R.env.lampOn; R.cube(X(X(B, T(-0.6, 0.72, 2.16)), m4.sc(0.3, 0.16, 0.02)), [1.6, 1.5, 1.2], 0, hl); R.cube(X(X(B, T(0.6, 0.72, 2.16)), m4.sc(0.3, 0.16, 0.02)), [1.6, 1.5, 1.2], 0, hl);
  R.cube(X(X(B, T(-0.6, 0.75, -2.16)), m4.sc(0.3, 0.14, 0.02)), [1.4, 0.15, 0.1], 0, hl); R.cube(X(X(B, T(0.6, 0.75, -2.16)), m4.sc(0.3, 0.14, 0.02)), [1.4, 0.15, 0.1], 0, hl);
}
function drawActor(R, a) {
  const X = m4.mul, T = m4.tr, base = X(T(a.x, a.y, a.z), m4.ry(a.yaw)), flash = (a.hurtT || 0) > 0 ? 0.6 : 0;
  const tc = a.npc ? a.shirt : (TEAM[a.team] || TEAM[0]).col, td = a.npc ? [0.3, 0.25, 0.2] : (TEAM[a.team] || TEAM[0]).dark;
  let B = base; if (!a.alive) { const k = Math.min(1, (a.deathT || 0) / 0.45); B = X(base, m4.rx(k * 1.52)); }
  const cr = a.crouch ? 0.6 : 1, hip = 0.85 * cr, sw = a.alive ? Math.sin((a.anim || 0) * 2.4) * Math.min(0.7, (a.spd || 0) * 0.14) : 0, Pd = (M, col) => R.cube(M, col, flash);
  const pants = a.npc ? [0.3, 0.32, 0.45] : [0.2, 0.22, 0.26];
  for (const s of [-1, 1]) { const L = X(X(B, T(s * 0.11, hip, 0)), m4.rx(sw * s)); Pd(X(X(L, T(0, -hip / 2, 0)), m4.sc(0.17, hip, 0.2)), pants); Pd(X(X(L, T(0, -hip + 0.05, 0.04)), m4.sc(0.18, 0.1, 0.28)), [0.1, 0.1, 0.1]); }
  const ty = hip + 0.31; Pd(X(X(B, T(0, ty, 0)), m4.sc(0.46, 0.62, 0.27)), tc);
  if (!a.npc) { Pd(X(X(B, T(0, ty + 0.06, 0)), m4.sc(0.48, 0.34, 0.3)), a.team === 2 ? [0.06, 0.06, 0.07] : [0.22, 0.24, 0.2]); Pd(X(X(B, T(0, ty + 0.18, 0)), m4.sc(0.5, 0.06, 0.31)), a.team === 2 ? [0.85, 0.85, 0.8] : tc); }
  const hy = hip + 0.76; Pd(X(X(B, T(0, hy, 0)), m4.sc(0.23, 0.26, 0.25)), a.skin || [0.75, 0.55, 0.4]);
  if (!a.npc) { Pd(X(X(B, T(0, hy + 0.13, -0.01)), m4.sc(0.25, 0.07, 0.27)), td); Pd(X(X(B, T(0, hy + 0.12, 0.15)), m4.sc(0.22, 0.03, 0.1)), td); }
  if (a.npc) { for (const s of [-1, 1]) Pd(X(X(X(B, T(s * 0.3, hip + 0.35, 0)), m4.rx(-sw * s * 0.8)), m4.sc(0.1, 0.55, 0.1)), tc); return; }
  const Gm = X(X(B, T(0, hip + 0.5, 0)), m4.rx(-(a.pitch || 0) * (a.alive ? 1 : 0) + (a.reloading || a.reloadT > 0 ? 0.5 : 0)));
  const pistol = a.cur === 'pistol', metal = [0.13, 0.13, 0.14];
  if (pistol) { Pd(X(X(Gm, T(0.08, -0.02, 0.45)), m4.sc(0.05, 0.08, 0.2)), metal); Pd(X(X(Gm, T(0.16, -0.07, 0.25)), m4.sc(0.1, 0.1, 0.42)), tc); Pd(X(X(X(Gm, T(0.0, -0.09, 0.26)), m4.ry(0.35)), m4.sc(0.1, 0.1, 0.42)), tc); return; }
  Pd(X(X(Gm, T(0.13, -0.05, 0.4)), m4.sc(0.07, 0.11, 0.8)), metal); Pd(X(X(Gm, T(0.13, -0.18, 0.36)), m4.sc(0.05, 0.18, 0.09)), metal); Pd(X(X(Gm, T(0.13, -0.02, 0.06)), m4.sc(0.06, 0.12, 0.22)), [0.35, 0.22, 0.12]);
  Pd(X(X(Gm, T(0.2, -0.07, 0.17)), m4.sc(0.1, 0.1, 0.42)), tc); Pd(X(X(X(Gm, T(-0.04, -0.09, 0.3)), m4.ry(0.55)), m4.sc(0.1, 0.1, 0.44)), tc);
}
function drawViewmodel(R, s, aspect, dt) {
  const me = s.me, c = s.cam, aim = c.aim, mv = Math.min(1, (me.spd || 0) / 4.6) * (me.onGround ? 1 : 0.3), rec = s.recoil;
  const bx = Math.sin(c.bob) * 0.012 * mv * (1 - aim), by = Math.abs(Math.cos(c.bob)) * 0.014 * mv * (1 - aim), wc = CONFIG.weapons[me.cur];
  const rl = me.reloadT > 0 ? Math.sin(Math.min(1, (wc.reload - me.reloadT) / wc.reload) * Math.PI) : 0, sw = Math.max((me.swapT || 0) > 0 ? me.swapT / wc.swap : 0, (s.throwT || 0) > 0 ? Math.sin(s.throwT / 0.5 * Math.PI) * 0.9 : 0);
  const px = lerp(0.16, 0.0, aim) + bx, py = lerp(-0.19, -0.098, aim) - by - rl * 0.12 - sw * 0.25, pz = lerp(-0.4, -0.3, aim) + rec * 0.035;
  const proj = m4.persp((aspect < 1 ? 66 : 54) * Math.PI / 180, aspect, 0.01, 10); R.clearDepth(); R.solidBegin(proj, [0, 0, 0]);
  const X = m4.mul, T = m4.tr, B = X(X(T(px, py, pz), m4.rx(-rec * 0.06 - rl * 0.6)), m4.ry(me.sprinting ? 0.2 : 0)), metal = [0.12, 0.12, 0.13], skin = me.skin || [0.75, 0.55, 0.4], sleeve = TEAM[me.team].col, Pv = (M, col) => R.cube(M, col, 0);
  if (me.cur === 'pistol') { Pv(X(X(B, T(0, 0.0, -0.12)), m4.sc(0.045, 0.06, 0.22)), metal); Pv(X(X(X(B, T(0, -0.07, -0.04)), m4.rx(0.3)), m4.sc(0.04, 0.12, 0.06)), [0.2, 0.2, 0.2]); Pv(X(X(B, T(0.0, -0.08, 0.02)), m4.sc(0.08, 0.08, 0.1)), skin); Pv(X(X(B, T(0.03, -0.11, 0.18)), m4.sc(0.08, 0.08, 0.3)), sleeve); Pv(X(X(X(B, T(-0.08, -0.11, 0.12)), m4.ry(-0.5)), m4.sc(0.08, 0.08, 0.28)), sleeve); return; }
  Pv(X(B, m4.sc(0.055, 0.085, 0.42)), metal); Pv(X(X(B, T(0, 0.012, -0.36)), m4.sc(0.024, 0.024, 0.32)), metal); Pv(X(X(B, T(0, -0.005, -0.2)), m4.sc(0.062, 0.06, 0.2)), [0.38, 0.23, 0.12]);
  Pv(X(X(X(B, T(0, -0.11, -0.04)), m4.rx(0.25)), m4.sc(0.045, 0.16, 0.075)), metal); Pv(X(X(B, T(0, -0.03, 0.27)), m4.sc(0.05, 0.1, 0.18)), [0.38, 0.23, 0.12]); Pv(X(X(B, T(0, 0.058, -0.02)), m4.sc(0.02, 0.035, 0.07)), metal);
  Pv(X(X(B, T(0.02, -0.07, 0.1)), m4.sc(0.07, 0.07, 0.11)), skin); Pv(X(X(B, T(0.07, -0.1, 0.28)), m4.sc(0.08, 0.08, 0.3)), sleeve); Pv(X(X(B, T(-0.01, -0.06, -0.24)), m4.sc(0.08, 0.06, 0.1)), skin); Pv(X(X(X(B, T(-0.12, -0.12, -0.08)), m4.ry(-0.6)), m4.sc(0.08, 0.08, 0.32)), sleeve);
}
function project(VP, x, y, z, W, H) { const m = VP, cx = m[0] * x + m[4] * y + m[8] * z + m[12], cy = m[1] * x + m[5] * y + m[9] * z + m[13], cw = m[3] * x + m[7] * y + m[11] * z + m[15]; if (cw <= 0.1) return null; return [(cx / cw * 0.5 + 0.5) * W, (1 - (cy / cw * 0.5 + 0.5)) * H]; }
function drawHud(s, view, bases, others) {
  const g = view.hctx, W = view.W, H = view.H, me = s.me, L = view.layout, A = view.area, op = view.op; g.setTransform(view.hs, 0, 0, view.hs, 0, 0);
  const markers = [];
  for (const a of others) { if (a.npc || !a.alive || a.team !== me.team) continue; const p = project(s.VP, a.x, a.y + 2.15, a.z, W, H); if (p) markers.push({ kind: 'ally', x: p[0], y: p[1], col: TEAM[a.team].css, label: Math.hypot(a.x - me.x, a.z - me.z) < 40 ? a.name : '' }); }
  if (P.voice && s.mode === 'online') for (const a of others) { if (a.npc || !a.alive || !P.voice.isTalking(a.id)) continue; const p = project(s.VP, a.x, a.y + 2.5, a.z, W, H); if (p) markers.push({ kind: 'talk', x: p[0], y: p[1] }); }
  for (const b of bases) { const p = project(s.VP, b.x, b.h + 6, b.z, W, H); if (p && p[0] > 10 && p[0] < W - 10 && p[1] > 10 && p[1] < H - 10) { const d = Math.hypot(b.x - me.x, b.z - me.z); markers.push({ kind: 'base', x: p[0], y: p[1], col: HUD.BASE_COL(b.owner), label: b.id, dist: d > 6 ? Math.round(d) + ' m' : '' }); } }
  const st0 = S.STATION(me.team), sy = P.world.map.H[P.world.W.nearestOK(st0.x, st0.z, 4)], sp = project(s.VP, st0.x, sy + 2.6, st0.z, W, H); if (sp && Math.hypot(st0.x - me.x, st0.z - me.z) < 70) markers.push({ kind: 'supply', x: sp[0], y: sp[1] });
  for (const gr of (s.mode === 'offline' ? s.G.grenades : s.grenades || [])) { if (Math.hypot(gr.x - me.x, gr.z - me.z) > 9) continue; const p = project(s.VP, gr.x, gr.y + 0.4, gr.z, W, H); if (p) markers.push({ kind: 'gren', x: p[0], y: p[1] }); }
  const wc = CONFIG.weapons[me.cur], w = me.ammo[me.cur];
  let center = null, capture = null;
  const total = me.ammo.rifle.mag + me.ammo.rifle.res + me.ammo.pistol.mag + me.ammo.pistol.res;
  const nearSt = s.mode === 'offline' ? s.G.nearStation(me) : me.near; s.nearStation = !!(me.alive && nearSt);
  if (s.nearDesk && !nearSt) { const on = s.mode === 'offline' ? s.G.baile.on : s.baile && s.baile.on; center = { text: (P.touch ? 'Toque em SOM DO BAILE' : 'Aperte E') + (on ? ' — DESLIGAR o som do baile' : ' — LIGAR o som do baile'), col: '#C9A0FF' }; }
  else if (me.alive && nearSt) { const full = me.ammo.rifle.mag === 30 && me.ammo.rifle.res === CONFIG.weapons.rifle.res && me.ammo.pistol.mag === 15 && me.ammo.pistol.res === CONFIG.weapons.pistol.res && (me.gren || 0) >= CONFIG.grenade.max;
    if (me.refillT > 0) center = { text: 'REABASTECENDO MUNIÇÃO', p: me.refillT / CONFIG.refill.time }; else if ((me.refillCd || 0) > 0) center = { text: 'Aguarde para reabastecer de novo', col: '#ddd' }; else if (!full) center = { text: (P.touch ? 'Segure INTERAGIR' : 'Segure E') + ' — REABASTECIMENTO DISPONÍVEL' }; else center = { text: 'Munição completa', col: '#ddd' }; }
  else if (me.alive && w.mag === 0 && w.res === 0) center = { text: total ? 'SEM MUNIÇÃO NO ' + wc.name + ' — troque de arma' : 'SEM MUNIÇÃO — RETORNE À BASE', col: '#FF8A6A' };
  else if (me.alive && me.reloadT > 0) center = { text: 'Recarregando', col: '#FFE7A8' };
  else if (me.alive && w.res <= wc.res * 0.25 && w.mag + w.res > 0) center = { text: 'Munição baixa — reabasteça na base', col: '#FFB45A' };
  for (const b of bases) if (me.alive && Math.hypot(b.x - me.x, b.z - me.z) <= b.r && Math.abs(me.y - b.h) < 2.2) { const p = Math.abs(b.prog), mine = me.team === 0 ? -1 : 1;
    capture = b.state === 'contestada' ? { text: 'Base ' + b.id + ' contestada', col: '#FFD24A', bar: '#FFD24A', p } : b.owner === me.team ? { text: 'Base ' + b.id + ' — ' + b.name + ' (sua)', col: '#7BE07B', bar: TEAM[me.team].css, p: 1 } : { text: 'Capturando Base ' + b.id, col: '#fff', bar: Math.sign(b.prog) === mine || b.prog === 0 ? TEAM[me.team].css : '#9A9A9A', p }; }
  const spread = (wc.spread + (me.bloom || 0) + ((me.spd || 0) > 0.1 ? 0.022 : 0) + (me.onGround ? 0 : 0.06)) * (s.input.aim ? 0.35 : 1);
  HUD.draw(g, W, H, L, { markers, score: s.score || [0, 0], bases, alerts: s.alerts, capture, feed: s.feed, hp: me.hp, alive: me.alive, ammo: { name: wc.name, mag: w.mag, res: w.res, max: wc.res, magMax: wc.mag }, reloading: me.reloadT > 0, spread, hitT: s.hitT, hitHead: s.hitHead, dmgDirs: s.dmgDirs.map(d => ({ rel: angDiff(me.yaw, d.ang), t: d.t })), center: s.editing ? null : center, deathText: s.deathText || 'Você caiu', respawn: me.respawnT, edit: s.editing, gren: me.gren || 0, touch: P.touch, flash: s.flash || 0 }, A, op);
  const dots = []; for (const a of others) { if (!a.alive || a.npc) continue; const ally = a.team === me.team; if (!ally && !(s.mode === 'offline' && s.G.t - a.spotT < 1.6)) continue; dots.push({ x: a.x, z: a.z, col: ally ? TEAM[a.team].css : '#FF3B2F' }); }
  for (const b of bases) dots.push({ kind: 'base', x: b.x, z: b.z, col: HUD.BASE_COL(b.owner), label: b.id }); dots.push({ kind: 'supply', x: st0.x, z: st0.z, col: '#FFD24A' });
  me.sector = me.alive ? sectorAt(s, me.x, me.z) : '';
  const PZ = s.mode === 'offline' ? { phase: s.G.police.phase, team: s.G.police.team, left: Math.max(0, Math.round(s.G.police.endT - s.G.t)) } : s.pol;
  if (PZ && PZ.phase !== 'idle') HUD.policeBar(g, W, H, L, A, op, { phase: PZ.phase, team: PZ.team, left: PZ.left, mine: PZ.team === me.team });
  if (s.killIcon) { const age = (performance.now() - s.killIcon.at) / 1000; if (age < 1.6) HUD.killIcon(g, W, H, s.killIcon, age); }
  HUD.radar(g, W, H, L, P.world.radar, me, dots, CELL, A, op);
  if (view.board) drawBoard(g, s, W, H);
  if (view.showFps) { g.textAlign = 'left'; g.font = '600 11px monospace'; g.fillStyle = '#fff'; g.fillText(Math.round(view.fps) + ' fps · ' + (P.R.stats ? P.R.stats.drawn : 0) + ' blocos', 10, H - 10); }
}
function drawBoard(g, s, W, H) {
  const list = s.mode === 'offline' ? s.G.actors : [...s.actors.values()].map(a => a.id === s.myId ? Object.assign({}, a, { name: a.name }) : a);
  const bw = Math.min(420, W - 30), bh = list.length * 20 + 70, x = (W - bw) / 2, y = Math.max(70, H * 0.5 - bh / 2); g.fillStyle = 'rgba(14,11,9,.85)'; g.beginPath(); g.rect(x, y, bw, bh); g.fill(); let yy = y + 20; g.textBaseline = 'middle';
  for (const t of [0, 1]) { g.textAlign = 'left'; g.font = '400 14px Bungee, Rubik, sans-serif'; g.fillStyle = teamCss(t); g.fillText('Time ' + TEAM[t].name + '  ' + Math.floor((s.score || [0, 0])[t]) + '%', x + 14, yy); g.textAlign = 'right'; g.font = '600 11px Rubik, system-ui, sans-serif'; g.fillStyle = '#CDBFA8'; g.fillText('abates  mortes', x + bw - 14, yy); yy += 20;
    for (const a of list.filter(a => a.team === t)) { g.textAlign = 'left'; g.font = (a.id === s.myId ? '700 ' : '500 ') + '13px Rubik, system-ui, sans-serif'; g.fillStyle = '#fff'; g.fillText(a.name, x + 22, yy); g.textAlign = 'right'; g.fillText((a.kills || 0) + '        ' + (a.deaths || 0), x + bw - 22, yy); yy += 19; } yy += 6; }
}
let sectorFn = null;
function sectorAt(s, x, z) { if (s.mode === 'offline') return s.G.sectorAt(x, z); if (!sectorFn) sectorFn = S.makeGame(P.world.map, P.world.W, { humans: [], bots: { 0: 0, 1: 0 }, local: true }).sectorAt; return sectorFn(x, z); }
P.handleEvent = handleEvent; P.aimAssist = aimAssist;
// lista de personagens atualizada pelo servidor (alguém entrou no lugar de um bot, ou saiu e o bot voltou)
P.setRoster = function (s, list) { if (!Array.isArray(list)) return; s.roster = new Map(list.map(r => [r.id, r])); for (const r of list) { const v = s.actors.get(r.id); if (v) { v.name = r.name; v.team = r.team; } } };
P.notice = function (s, text) { alert(s, text, '#FFE7A8', false, 3.5); };
})();
