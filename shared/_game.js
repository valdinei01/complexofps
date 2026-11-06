// ===================== REGRAS DA PARTIDA (compartilhadas por servidor e modo treino) =====================
const CONFIG = {
  capTime: 15,          // segundos para dominar uma base neutra sem contestação
  scoreEvery: 12,       // cada base dominada rende 1% a cada N segundos
  winScore: 100,        // vitória ao chegar a 100%
  npcPenalty: 5,        // pontos percentuais perdidos ao eliminar um civil
  timeLimit: 30 * 60,   // limite de segurança: depois disso vence quem tiver mais
  respawn: 4,
  npcCount: 10,
  cars: 10,             // carros circulando pela Avenida das Américas
  npcRespawn: 25,
  refill: { time: 3, radius: 2.6, cooldown: 5 },
  weapons: {
    rifle: { name: 'FUZIL', mag: 30, res: 180, rate: 0.1, body: 27, head: 3.2, spread: 0.005, auto: true, reload: 2.1, range: 160, swap: 0.5 },
    pistol: { name: 'PISTOLA', mag: 15, res: 75, rate: 0.2, body: 21, head: 3.0, spread: 0.004, auto: false, reload: 1.5, range: 120, swap: 0.4 },
  },
};
const TEAM = [{ name: 'Azul', col: [0.18, 0.42, 0.86], css: '#2F7BE0', dark: [0.1, 0.2, 0.45] }, { name: 'Vermelho', col: [0.82, 0.2, 0.16], css: '#D8402F', dark: [0.45, 0.1, 0.08] }];
const BOT_NAMES = [['Tico', 'Bira', 'Neném', 'Pardal', 'Dentinho'], ['Zóio', 'Formiga', 'Juninho', 'Cabeça', 'Mago']];
const NPC_NAMES = ['Dona Cida', 'Seu Jorge', 'Tia Lurdes', 'Marquinho', 'Dona Neide', 'Seu Tião', 'Rosinha', 'Vovó Zélia'];
const DIFF_FPS = { facil: { react: 0.8, err: 0.075, fov: 1.85, turn: 3.6, burst: 3, gap: 0.55 }, normal: { react: 0.5, err: 0.048, fov: 2.1, turn: 5.2, burst: 4, gap: 0.4 }, dificil: { react: 0.3, err: 0.028, fov: 2.3, turn: 7.5, burst: 6, gap: 0.28 } };
const SKIN = [[0.85, 0.66, 0.5], [0.62, 0.44, 0.3], [0.45, 0.3, 0.2], [0.75, 0.55, 0.4], [0.35, 0.24, 0.16]];
const BASES_DEF = () => [
  { id: 'A', name: 'Praça Central', x: PRACA.x, z: MID, r: PRACA.r },
  { id: 'B', name: 'Escadão', x: ESC_LAND[2].x, z: MID, r: 3.0 },
  { id: 'C', name: 'Canal', x: (WALK_X0 + WALK_X1) / 2, z: MID, r: 2.8 },
];
const STATION = team => ({ x: SUPPLY[team].x, z: SUPPLY[team].z });

// cria a partida. opts: { team, diff, name, humans:[{key,name,team}], bots:{0:n,1:n}, local:true|false, rng }
function makeGame(map, W, opts) {
  opts = opts || {};
  const rnd = opts.rng || Math.random;
  const G = { map, W, t: 0, actors: [], npcs: [], score: [0, 0], over: false, winner: -1, feed: [], fx: { tracers: [], puffs: [], flashes: [] }, events: [], diff: DIFF_FPS[opts.diff] || DIFF_FPS.normal, stats: { unstuck: 0, shots: 0, hits: 0 }, nextId: 1, timeLeft: CONFIG.timeLimit, cfg: CONFIG };
  // ---------- nascimentos e rede principal de navegação ----------
  // rede principal de navegação: calculada uma vez por mapa e reaproveitada (evita travar o servidor a cada partida)
  if (!W.cache.main) { const hub = W.nearestOK(PRACA.x, PRACA.z, 6); W.cache.main = { reachS: W.reach(hub, false, false), backS: W.reach(hub, false, true) }; }
  const { reachS, backS } = W.cache.main;
  const mainNet = c => reachS[c] && backS[c];
  const nearestMain = (x, z) => { const i0 = Math.floor(x / CELL), j0 = Math.floor(z / CELL); for (let r = 0; r <= 30; r++) for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) { if (Math.max(Math.abs(a), Math.abs(b)) !== r) continue; const i = i0 + a, j = j0 + b; if (i < 0 || j < 0 || i >= GX || j >= GZ) continue; const c = j * GX + i; if (W.OK[c] && mainNet(c)) return c; } return -1; };
  const spawns = [[], []];
  for (const [team, zc] of [[0, 8], [1, ML - 8]]) for (const x of [44, 52, 60, 68, 84, 92, 100, 108]) { const c = W.nearestOK(x, zc, 6); if (c >= 0 && mainNet(c)) spawns[team].push(c); }
  G.spawns = spawns; G.mainNet = mainNet;
  // ---------- bases de dominação ----------
  G.bases = BASES_DEF().map(b => { const c = W.nearestOK(b.x, b.z, 6); return Object.assign(b, { h: map.H[c], owner: -1, prog: 0, inside: [0, 0], state: 'neutra', cell: c }); });
  // ---------- pontos estratégicos para os bots ----------
  const goals = [];
  const addGoal = (x, z, w, tag, base) => { const c = W.nearestOK(x, z, 6); if (c >= 0 && mainNet(c)) goals.push({ c, w, tag, base, z: W.cellZ(c) }); };
  G.bases.forEach((b, bi) => { for (const [dx, dz] of [[0, 0], [-1.2, -1.2], [1.2, 1.2], [-1.2, 1.2], [1.2, -1.2]]) addGoal(b.x + dx, b.z + dz, 1, 'base', bi); });
  for (const l of ESC_LAND) addGoal(l.x, MID, 1.5, 'escadao');
  for (const S of STREETS) for (const p of S.pts) if (Math.round(p[0]) % 3 === 0) { addGoal(p[0], p[1], 0.45, 'rua'); addGoal(p[0], ML - p[1], 0.45, 'rua'); }
  for (const h of map.houses) if (!h.dead && h.access && h.cells.length > 8) { const c = h.cells[(h.cells.length / 2) | 0]; if (W.OK[c] && mainNet(c)) goals.push({ c, w: 0.9, tag: 'laje', z: W.cellZ(c) }); }
  for (const z of [30, 60, 95, 120, 160, 185, 220, 250]) addGoal((WALK_X0 + WALK_X1) / 2, z, 0.6, 'valao');
  G.goals = goals;
  G.stationCell = [0, 1].map(t => W.nearestOK(STATION(t).x, STATION(t).z + (t ? -0.6 : 0.6), 4));
  // pontos de caminhada dos civis (avenida, praça, ladeiras) — longe das bases principais
  const farFromBases = c => G.bases.every(b => Math.hypot(W.cellX(c) - b.x, W.cellZ(c) - b.z) > 16);
  const npcSpots = []; for (const g of goals) if (g.tag === 'rua' && g.z > 30 && g.z < ML - 30 && farFromBases(g.c)) npcSpots.push(g.c);
  for (let z = 30; z < ML - 30; z += 9) { if (Math.abs(z - MID) < 20) continue; const c = W.nearestOK(aveX(z) + AVE_HW + 1.5, z, 4); if (c >= 0 && mainNet(c)) npcSpots.push(c); }
  G.npcSpots = npcSpots;
  // ---------- atores ----------
  const loadout = () => ({ rifle: { mag: CONFIG.weapons.rifle.mag, res: CONFIG.weapons.rifle.res }, pistol: { mag: CONFIG.weapons.pistol.mag, res: CONFIG.weapons.pistol.res } });
  const mk = (team, k, ctrl, name, key) => ({ id: G.nextId++, key: key || null, team, ctrl, isBot: ctrl === 'bot', name, x: 0, y: 0, z: 0, vy: 0, onGround: true, yaw: team ? Math.PI : 0, pitch: 0, hp: 100, alive: false, respawnT: 0.3 + k * 0.15, kills: 0, deaths: 0, caps: 0, ammo: loadout(), cur: 'rifle', reloadT: 0, swapT: 0, cd: 0, crouch: false, hurtT: 0, lastHurt: -9, invuln: 0, anim: 0, spd: 0, deathT: 0, skin: SKIN[(k + team * 2) % SKIN.length], spotT: -9, bloom: 0, refillT: 0, refillCd: 0, trig: false, sprinting: false,
    in: { mx: 0, mz: 0, dx: 0, dy: 0, fire: false, aim: false, jump: false, crouch: false, reload: false, sprint: false, swap: false, use: false },
    ai: ctrl === 'bot' ? { path: null, pi: 0, goal: -1, target: null, react: 0, seenT: -9, last: null, strafe: 1, strafeT: 0, stuckT: 0, lx: 0, lz: 0, stuck: 0, burst: 0, burstGap: 0, ex: 0, ey: 0, holdT: 0, lookYaw: 0, heard: null, think: rnd() * 0.2, wantPath: false, fail: 0, mode: 'roam', track: 0 } : null });
  G.mk = mk;
  if (opts.humans) { for (const h of opts.humans) G.actors.push(mk(h.team, G.actors.length, opts.local ? 'local' : 'remote', h.name, h.key)); }
  else { G.player = mk(opts.team || 0, 0, opts.allBots ? 'bot' : 'local', opts.name || 'Você'); G.actors.push(G.player); }
  const botsWanted = opts.bots || { 0: 5, 1: 5 };
  for (const team of [0, 1]) { const humans = G.actors.filter(a => a.team === team).length, want = opts.humans ? Math.min(botsWanted[team] || 0, 5 - humans) : 5 - humans; for (let k = 0; k < want; k++) G.actors.push(mk(team, humans + k + 1, 'bot', BOT_NAMES[team][k])); }
  if (opts.humans && opts.local) G.player = G.actors[0];
  // civis
  for (let k = 0; k < CONFIG.npcCount; k++) { const n = { id: G.nextId++, team: 2, npc: true, name: NPC_NAMES[k % NPC_NAMES.length], x: 0, y: 0, z: 0, vy: 0, onGround: true, yaw: 0, pitch: 0, hp: 60, alive: false, respawnT: 0.5 + k * 0.3, skin: SKIN[k % SKIN.length], anim: 0, spd: 0, deathT: 0, hurtT: 0, shirt: [[0.85, 0.75, 0.3], [0.3, 0.6, 0.4], [0.9, 0.9, 0.85], [0.6, 0.35, 0.6], [0.95, 0.55, 0.3], [0.4, 0.5, 0.7], [0.75, 0.3, 0.35], [0.5, 0.45, 0.35]][k % 8], path: null, pi: 0, waitT: 0, penalized: false }; G.npcs.push(n); }
  // carros circulando: mão dupla na Avenida das Américas; param para pedestres e para o carro da frente
  const CAR_COL = [[0.85, 0.85, 0.82], [0.2, 0.22, 0.25], [0.62, 0.1, 0.1], [0.75, 0.75, 0.78], [0.15, 0.3, 0.55], [0.9, 0.75, 0.2], [0.3, 0.45, 0.3], [0.95, 0.95, 0.95]];
  G.cars = []; W.dyn.length = 0;
  for (let k = 0; k < CONFIG.cars; k++) { const dir = k % 2 ? -1 : 1, n = Math.floor(k / 2); G.cars.push({ id: k, dir, off: dir > 0 ? -LANE_X : LANE_X, z: dir > 0 ? -40 + n * (ML + 80) / Math.ceil(CONFIG.cars / 2) : ML + 40 - n * (ML + 80) / Math.ceil(CONFIG.cars / 2) - 25, spd: 8, max: 7.5 + rnd() * 3, col: CAR_COL[k % CAR_COL.length], van: k % 4 === 3 }); }
  const carX = c => aveX(clamp(c.z, 0, ML)) + c.off;
  function updateCars(dt) {
    W.dyn.length = 0;
    for (const c of G.cars) {
      const cx = carX(c); let target = c.max;
      const blocks = a => { if (!a.alive) return false; const d = (a.z - c.z) * c.dir; return d > 0 && d < 9.5 && Math.abs(a.x - cx) < 2.1; };
      for (const a of G.actors) if (blocks(a)) { target = 0; break; }
      if (target) for (const n of G.npcs) if (blocks(n)) { target = 0; break; }
      for (const o of G.cars) if (o !== c && o.dir === c.dir) { const d = (o.z - c.z) * c.dir; if (d > 0 && d < 11) target = Math.min(target, Math.max(0, (d - 7) * 2)); }
      c.spd += clamp(target - c.spd, -10 * dt, 3.5 * dt); c.z += c.dir * c.spd * dt;
      if (c.dir > 0 && c.z > ML + 40) c.z = -40; if (c.dir < 0 && c.z < -40) c.z = ML + 40;
      const x = carX(c); c.x = x; W.dyn.push({ x0: x - 1.0, x1: x + 1.0, z0: c.z - 2.3, z1: c.z + 2.3, top: c.van ? 2.0 : 1.5 });
    }
  }
  G.updateCars = updateCars;
  const pathQ = [];
  // ---------- utilidades ----------
  const eyeH = a => a.crouch ? 1.15 : 1.6, bodyH = a => a.npc ? 1.72 : a.crouch ? 1.3 : 1.78;
  const dirOf = (yaw, pitch) => [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
  const W_ = n => CONFIG.weapons[n];
  const totalAmmo = (a, n) => a.ammo[n].mag + a.ammo[n].res;
  const emit = e => { e.t = G.t; G.events.push(e); };
  G.emit = emit;
  function spawn(a) {
    const enemies = G.actors.filter(o => o.alive && o.team !== a.team);
    let best = -1, bestS = -1e9;
    for (const c of spawns[a.team]) { const x = W.cellX(c), z = W.cellZ(c), y = map.H[c];
      if (G.actors.some(o => o.alive && o !== a && Math.hypot(o.x - x, o.z - z) < 1.2)) continue;
      let s = rnd() * 4; for (const e of enemies) { const d = Math.hypot(e.x - x, e.z - z); s += Math.min(d, 60) * 0.1; if (d < 70 && W.los(x, y + 1.6, z, e.x, e.y + 1.5, e.z)) s -= 50; } if (s > bestS) { bestS = s; best = c; } }
    if (best < 0) best = spawns[a.team][(rnd() * spawns[a.team].length) | 0];
    a.x = W.cellX(best); a.z = W.cellZ(best); a.y = map.H[best]; a.vy = 0; a.onGround = true; a.hp = 100; a.alive = true; a.reloadT = 0; a.swapT = 0; a.cd = 0; a.invuln = 2; a.deathT = 0; a.yaw = a.team ? Math.PI : 0; a.pitch = 0; a.crouch = false; a.bloom = 0; a.refillT = 0;
    a.ammo = loadout(); a.cur = 'rifle';   // nasceu na base: carregamento completo
    if (a.ai) Object.assign(a.ai, { path: null, goal: -1, target: null, stuck: 0, holdT: 0, lx: a.x, lz: a.z, stuckT: 0, mode: 'roam', fail: 0 });
    emit({ type: 'spawn', id: a.id });
  }
  function spawnNpc(n) { const c = G.npcSpots[(rnd() * G.npcSpots.length) | 0]; n.x = W.cellX(c); n.z = W.cellZ(c); n.y = map.H[c]; n.hp = 60; n.alive = true; n.penalized = false; n.path = null; n.waitT = rnd() * 3; n.deathT = 0; }
  // ---------- tiros ----------
  function hitActors(ox, oy, oz, dx, dy, dz, maxT, shooter) {
    let best = null;
    const test = v => { if (!v.alive || v === shooter || (!v.npc && v.team === shooter.team)) return;
      const fx = ox - v.x, fz = oz - v.z, a = dx * dx + dz * dz, b = 2 * (fx * dx + fz * dz), r = 0.34, c = fx * fx + fz * fz - r * r, bh = bodyH(v);
      const hy = v.y + bh - 0.15, hyy = oy - hy, B = fx * dx + hyy * dy + fz * dz, C = fx * fx + hyy * hyy + fz * fz - 0.03, D = B * B - C;
      if (D > 0) { const t = -B - Math.sqrt(D); if (t > 0 && t < maxT && (!best || t < best.t)) best = { t, v, head: true }; }
      if (a < 1e-9) return; const disc = b * b - 4 * a * c; if (disc < 0) return; const sq = Math.sqrt(disc); let t0 = (-b - sq) / (2 * a), t1 = (-b + sq) / (2 * a); if (t1 < 0) return; t0 = Math.max(t0, 0);
      const y0 = oy + dy * t0, lo = v.y, hi = v.y + bh - 0.28; let th = -1;
      if (y0 >= lo && y0 <= hi) th = t0; else if (dy) { for (const yy of [lo, hi]) { const tt = (yy - oy) / dy; if (tt >= t0 && tt <= t1 && (th < 0 || tt < th)) th = tt; } }
      if (th >= 0 && th < maxT && (!best || th < best.t - 0.02)) best = { t: th, v, head: false }; };
    for (const v of G.actors) test(v); for (const v of G.npcs) test(v);
    return best;
  }
  function canFire(a) { const w = a.ammo[a.cur]; return a.alive && a.cd <= 0 && a.reloadT <= 0 && a.swapT <= 0 && w.mag > 0; }
  // dispara a arma atual. O dano é calculado aqui (no servidor, no online); o traçante é só efeito visual.
  function fire(a, yaw, pitch, spread) {
    const wn = a.cur, wc = W_(wn), w = a.ammo[wn];
    if (!canFire(a)) return false;
    a.cd = wc.rate; w.mag--; G.stats.shots++;
    const ang = rnd() * Math.PI * 2, rad = Math.sqrt(rnd()) * spread; yaw += Math.cos(ang) * rad; pitch += Math.sin(ang) * rad;
    const d = dirOf(yaw, pitch), ex = a.x, ey = a.y + eyeH(a), ez = a.z;
    const wr = W.ray(ex, ey, ez, d[0], d[1], d[2], wc.range), wd = W.rayDyn(ex, ey, ez, d[0], d[1], d[2], wr ? wr.t : wc.range), wt = wd < (wr ? wr.t : wc.range) ? wd : wr ? wr.t : wc.range;
    const h = hitActors(ex, ey, ez, d[0], d[1], d[2], wt, a);
    const t = h ? h.t : wt, px = ex + d[0] * t, py = ey + d[1] * t, pz = ez + d[2] * t;
    emit({ type: 'shot', id: a.id, w: wn, ox: ex, oy: ey, oz: ez, ex: px, ey: py, ez: pz, hit: h ? h.v.id : 0, wall: !h && (!!wr || wt < wc.range) });
    if (h) { G.stats.hits++; damage(h.v, h.head ? wc.body * wc.head : wc.body * (0.85 + rnd() * 0.3), a, h.head); }
    for (const o of G.actors) if (o.ai && o.alive && o.team !== a.team && !o.ai.target && Math.hypot(o.x - ex, o.z - ez) < 45) o.ai.heard = { x: ex, z: ez, y: ey, t: G.t };
    a.spotT = G.t;
    if (w.mag === 0 && w.res === 0) emit({ type: 'empty', id: a.id, w: wn });
    return true;
  }
  function damage(v, amt, by, head) {
    if (!v.alive) return;
    if (v.npc) { v.hp -= amt; v.hurtT = 0.12; emit({ type: 'hit', v: v.id, by: by.id, head, npc: true });
      if (v.hp <= 0) { v.hp = 0; v.alive = false; v.deathT = 0; v.respawnT = CONFIG.npcRespawn; v.path = null;
        if (!v.penalized) { v.penalized = true; const tm = by.team; G.score[tm] = Math.max(0, G.score[tm] - CONFIG.npcPenalty); by.npcKills = (by.npcKills || 0) + 1; emit({ type: 'npc', team: tm, by: by.id, v: v.id }); } }
      return; }
    if (v.invuln > 0) return;
    v.hp -= amt; v.hurtT = 0.12; v.lastHurt = G.t; v.lastBy = by;
    if (v.ai && !v.ai.target) v.ai.heard = { x: by.x, z: by.z, y: by.y, t: G.t };
    emit({ type: 'hit', v: v.id, by: by.id, head });
    if (v.hp <= 0) { v.hp = 0; v.alive = false; v.deaths++; v.respawnT = CONFIG.respawn; v.deathT = 0; by.kills++; v.killer = by; v.refillT = 0;
      G.feed.unshift({ k: by.id, v: v.id, head, t: G.t }); if (G.feed.length > 5) G.feed.pop(); emit({ type: 'kill', v: v.id, by: by.id, head }); }
  }
  // recarga: só transfere da reserva o que falta no carregador (nunca cria munição)
  function startReload(a) { const w = a.ammo[a.cur], wc = W_(a.cur); if (!a.alive || a.reloadT > 0 || a.swapT > 0 || w.mag >= wc.mag || w.res <= 0) return false; a.reloadT = wc.reload; emit({ type: 'reload', id: a.id, w: a.cur }); return true; }
  function finishReload(a) { const w = a.ammo[a.cur], wc = W_(a.cur), need = Math.max(0, wc.mag - w.mag), take = Math.min(need, w.res); w.mag += take; w.res -= take; emit({ type: 'reloaded', id: a.id }); }
  function swap(a, to) { const n = to || (a.cur === 'rifle' ? 'pistol' : 'rifle'); if (!a.alive || n === a.cur || !CONFIG.weapons[n]) return false; a.cur = n; a.reloadT = 0; a.swapT = W_(n).swap; a.cd = 0; emit({ type: 'swap', id: a.id, w: n }); return true; }
  // reabastecimento: só na estação do próprio time, dentro da área, segurando 3 s
  function nearStation(a) { const s = STATION(a.team); return Math.hypot(a.x - s.x, a.z - s.z) <= CONFIG.refill.radius && Math.abs(a.y - map.H[G.stationCell[a.team]]) < 2.5; }
  function needsRefill(a) { for (const n in CONFIG.weapons) { const w = a.ammo[n], c = W_(n); if (w.mag < c.mag || w.res < c.res) return true; } return false; }
  function useStation(a, holding, dt) {
    if (a.refillCd > 0) a.refillCd -= dt;
    if (!holding || !a.alive || !nearStation(a) || a.refillCd > 0 || !needsRefill(a)) { if (a.refillT > 0 && holding !== 'keep') emit({ type: 'refillStop', id: a.id }); a.refillT = 0; return; }
    a.refillT += dt;
    if (a.refillT >= CONFIG.refill.time) { a.ammo = loadout(); a.refillT = 0; a.refillCd = CONFIG.refill.cooldown; a.reloadT = 0; emit({ type: 'refill', id: a.id }); }
  }
  // ---------- dominação ----------
  function updateBases(dt) {
    for (const b of G.bases) {
      b.inside = [0, 0];
      for (const a of G.actors) if (a.alive && Math.hypot(a.x - b.x, a.z - b.z) <= b.r && Math.abs(a.y - b.h) < 2.2) b.inside[a.team]++;
      const solo = b.inside[0] && !b.inside[1] ? 0 : b.inside[1] && !b.inside[0] ? 1 : -1, before = b.owner, prevState = b.state;
      const rate = 1 / CONFIG.capTime;
      if (b.inside[0] && b.inside[1]) b.state = 'contestada';
      else if (solo >= 0) { const target = solo === 0 ? -1 : 1, n = b.inside[solo]; if (b.prog !== target) { b.prog += Math.sign(target - b.prog) * rate * dt * Math.min(1.5, 1 + (n - 1) * 0.25); if ((target - b.prog) * Math.sign(target) < 0) b.prog = target; b.state = 'capturando'; b.capTeam = solo; } else b.state = b.owner >= 0 ? 'dominada' : 'neutra'; }
      else { const rest = b.owner === 0 ? -1 : b.owner === 1 ? 1 : 0; if (b.prog !== rest) { const s = Math.sign(rest - b.prog), np = b.prog + s * rate * 0.5 * dt; b.prog = (rest - np) * s < 0 ? rest : np; } b.state = b.owner >= 0 ? 'dominada' : 'neutra'; }
      // dono muda só quando a barra chega ao extremo; ao cruzar o centro a base fica neutra
      if (b.owner === 0 && b.prog > 0) b.owner = -1; if (b.owner === 1 && b.prog < 0) b.owner = -1;
      if (b.prog <= -1) { b.prog = -1; b.owner = 0; } if (b.prog >= 1) { b.prog = 1; b.owner = 1; }
      if (before !== b.owner) { emit({ type: 'base', base: b.id, team: b.owner, from: before });
        if (b.owner >= 0) for (const a of G.actors) if (a.alive && a.team === b.owner && Math.hypot(a.x - b.x, a.z - b.z) <= b.r + 0.5) a.caps = (a.caps || 0) + 1; }
      if (b.state !== prevState && b.state === 'contestada') emit({ type: 'contest', base: b.id });
    }
    for (const t of [0, 1]) { const owned = G.bases.filter(b => b.owner === t).length; if (owned) G.score[t] = Math.min(CONFIG.winScore, G.score[t] + owned * dt / CONFIG.scoreEvery); }
    for (const t of [0, 1]) if (G.score[t] >= CONFIG.winScore && !G.over) { G.over = true; G.winner = t; emit({ type: 'end', winner: t }); }
  }
  // ---------- bots ----------
  function canSee(a, b) { const ey = a.y + eyeH(a); return W.los(a.x, ey, a.z, b.x, b.y + bodyH(b) - 0.2, b.z) || W.los(a.x, ey, a.z, b.x, b.y + 1.0, b.z); }
  function civilInLine(a, tg) { // evita atirar com civil na frente
    const ax = a.x, az = a.z, bx = tg.x, bz = tg.z, L = Math.hypot(bx - ax, bz - az) || 1;
    for (const n of G.npcs) { if (!n.alive) continue; const t = ((n.x - ax) * (bx - ax) + (n.z - az) * (bz - az)) / (L * L); if (t <= 0 || t >= 1.6) continue; const px = ax + (bx - ax) * t, pz = az + (bz - az) * t; if (Math.hypot(n.x - px, n.z - pz) < 2.5) return true; }
    return false;
  }
  function lowAmmo(a) { return totalAmmo(a, 'rifle') < 20 && totalAmmo(a, 'pistol') < 8; }
  function pickGoal(a) {
    if (lowAmmo(a)) { a.ai.mode = 'refill'; return G.stationCell[a.team]; }
    a.ai.mode = 'roam';
    const enemySide = a.team === 0 ? 1 : -1; let tot = 0;
    const ws = G.goals.map(g => { let w = g.w;
      if (g.tag === 'base') { const b = G.bases[g.base]; w *= b.owner === a.team ? (b.state === 'capturando' || b.state === 'contestada' ? 12 : 2.2) : 9; }
      const zRel = (g.z - MID) * enemySide; if (zRel > 70) w *= 0.5; if (zRel < -80) w *= 0.25;
      if (Math.hypot(W.cellX(g.c) - a.x, g.z - a.z) < 6) w *= 0.15; tot += w; return w; });
    let r = rnd() * tot; for (let k = 0; k < ws.length; k++) { r -= ws[k]; if (r <= 0) { const g = G.goals[k]; a.ai.mode = g.tag === 'base' ? 'base' : 'roam'; return g.c; } } return G.goals[0].c;
  }
  function requestPath(a, goal) { a.ai.goal = goal; a.ai.wantPath = true; if (!pathQ.includes(a)) pathQ.push(a); }
  function botThink(a, dt) {
    const ai = a.ai, D = G.diff;
    // arma: troca para a pistola quando o fuzil acaba; recarrega usando a reserva
    if (a.ammo[a.cur].mag === 0 && a.reloadT <= 0 && a.swapT <= 0) { if (a.ammo[a.cur].res > 0) startReload(a); else { const other = a.cur === 'rifle' ? 'pistol' : 'rifle'; if (totalAmmo(a, other) > 0) swap(a, other); } }
    if (a.cur === 'pistol' && totalAmmo(a, 'rifle') > 0 && a.reloadT <= 0 && !ai.target) swap(a, 'rifle');
    if (lowAmmo(a) && ai.mode !== 'refill' && !ai.target) { requestPath(a, G.stationCell[a.team]); ai.mode = 'refill'; ai.holdT = 0; }
    useStation(a, ai.mode === 'refill' && nearStation(a), dt);
    if (ai.mode === 'refill' && !lowAmmo(a) && !needsRefill(a)) { ai.mode = 'roam'; ai.holdT = 0.2; }
    ai.think -= dt;
    if (ai.think <= 0) { ai.think = 0.12 + rnd() * 0.05;
      let best = null, bestD = 1e9;
      for (const e of G.actors) { if (!e.alive || e.team === a.team) continue; const dx = e.x - a.x, dz = e.z - a.z, d = Math.hypot(dx, dz); if (d > 80) continue;
        const ang = Math.abs(angDiff(a.yaw, Math.atan2(dx, dz))), alert = (G.t - a.lastHurt < 1.5 && a.lastBy === e) || ai.target === e;
        if (ang > D.fov / 2 && d > 5 && !alert) continue; if (!canSee(a, e)) continue; const sc = d * (ai.target === e ? 0.6 : 1); if (sc < bestD) { bestD = sc; best = e; } }
      if (best) { if (ai.target !== best) { ai.react = D.react * (0.75 + rnd() * 0.5); ai.ex = (rnd() - 0.5) * D.err * 4; ai.ey = (rnd() - 0.5) * D.err * 3; ai.track = 0; } ai.target = best; ai.seenT = G.t; ai.last = { x: best.x, y: best.y, z: best.z }; best.spotT = G.t; }
      else if (ai.target && (G.t - ai.seenT > 1.2 || !ai.target.alive)) { const l = ai.last; ai.target = null; if (l && ai.mode !== 'refill') { const c = W.nearestOK(l.x, l.z, 6); if (c >= 0) requestPath(a, c); } }
    }
    const tg = ai.target; let mvx = 0, mvz = 0, speed = 4.3;
    const hasAmmo = totalAmmo(a, a.cur) > 0 || totalAmmo(a, a.cur === 'rifle' ? 'pistol' : 'rifle') > 0;
    if (tg && tg.alive && G.t - ai.seenT < 1.2 && hasAmmo) {
      ai.track += dt; const settle = Math.max(0.35, 1.6 - ai.track * 0.9);
      const aimY = tg.y + (rnd() < 0.18 ? bodyH(tg) - 0.16 : 1.1), dx = tg.x - a.x, dz = tg.z - a.z, dist = Math.hypot(dx, dz);
      const wantYaw = Math.atan2(dx, dz) + ai.ex * settle, wantPitch = Math.atan2(aimY - (a.y + eyeH(a)), dist) + ai.ey * settle;
      const dy = angDiff(a.yaw, wantYaw), mx = D.turn * dt; a.yaw += clamp(dy, -mx, mx); a.pitch += clamp(wantPitch - a.pitch, -mx, mx);
      ai.ex += (rnd() - 0.5) * D.err * dt * 6; ai.ey += (rnd() - 0.5) * D.err * dt * 5; ai.ex = clamp(ai.ex, -D.err * 2, D.err * 2); ai.ey = clamp(ai.ey, -D.err * 1.5, D.err * 1.5);
      ai.react -= dt;
      if (ai.react <= 0 && Math.abs(dy) < 0.15 && canFire(a) && G.t - ai.seenT < 0.25 && !civilInLine(a, tg)) {
        if (ai.burstGap > 0) ai.burstGap -= dt;
        else { fire(a, a.yaw, a.pitch, (a.cur === 'pistol' ? 0.01 : 0.012) + (a.onGround ? 0 : 0.05)); ai.burst++; if (a.cur === 'pistol') ai.burstGap = 0.12 + rnd() * 0.15; if (ai.burst >= D.burst + Math.floor(rnd() * 3)) { ai.burst = 0; ai.burstGap = D.gap * (0.7 + rnd() * 0.6); } }
      } else if (ai.burstGap > 0) ai.burstGap -= dt;
      ai.strafeT -= dt; if (ai.strafeT <= 0) { ai.strafeT = 0.5 + rnd() * 0.9; ai.strafe = rnd() < 0.5 ? -1 : 1; if (rnd() < 0.2) ai.strafe = 0; }
      const rx = -Math.cos(a.yaw), rz = Math.sin(a.yaw); mvx = rx * ai.strafe; mvz = rz * ai.strafe; speed = 2.6;
      if (dist > 30) { mvx += Math.sin(a.yaw) * 0.6; mvz += Math.cos(a.yaw) * 0.6; }
      ai.path = null; ai.holdT = 0;
    } else {
      if (ai.heard && G.t - ai.heard.t < 3 && ai.mode !== 'refill') { const want = Math.atan2(ai.heard.x - a.x, ai.heard.z - a.z); a.yaw += clamp(angDiff(a.yaw, want), -D.turn * dt, D.turn * dt); }
      a.pitch *= 0.9;
      if (ai.holdT > 0) { ai.holdT -= dt; ai.lookT = (ai.lookT || 0) - dt; if (ai.lookT <= 0) { ai.lookT = 1 + rnd() * 1.5; ai.lookYaw = a.yaw + (rnd() - 0.5) * 2.4; } a.yaw += clamp(angDiff(a.yaw, ai.lookYaw), -2 * dt, 2 * dt);
        if (ai.mode === 'base' && ai.goalBase != null) { const b = G.bases[ai.goalBase]; if (b && b.state === 'capturando' && b.capTeam === a.team) ai.holdT = Math.max(ai.holdT, 0.5); }
        if (ai.holdT <= 0) requestPath(a, pickGoal(a)); }
      else if (!ai.path && !ai.wantPath) requestPath(a, pickGoal(a));
      if (ai.path) {
        let n = ai.path[ai.pi]; let tx = W.cellX(n), tz = W.cellZ(n);
        while (ai.pi < ai.path.length - 1 && Math.hypot(tx - a.x, tz - a.z) < 0.45) { ai.pi++; n = ai.path[ai.pi]; tx = W.cellX(n); tz = W.cellZ(n); }
        if (ai.pi + 2 < ai.path.length) { const n2 = ai.path[ai.pi + 2]; const x2 = W.cellX(n2), z2 = W.cellZ(n2); if (Math.hypot(x2 - a.x, z2 - a.z) < 1.05 && Math.abs(map.H[n2] - a.y) < 0.4) { ai.pi += 2; tx = x2; tz = z2; } }
        const dx = tx - a.x, dz = tz - a.z, d = Math.hypot(dx, dz);
        if (ai.pi >= ai.path.length - 1 && d < 0.5) { ai.path = null; ai.holdT = ai.recover ? 0.05 : ai.mode === 'base' ? 6 + rnd() * 6 : ai.mode === 'refill' ? 4 : 1.5 + rnd() * 4; ai.recover = false; }
        else if (d > 1e-3) { mvx = dx / d; mvz = dz / d; const want = Math.atan2(dx, dz); if (!(ai.heard && G.t - ai.heard.t < 3)) a.yaw += clamp(angDiff(a.yaw, want), -4 * dt, 4 * dt); }
      }
    }
    const len = Math.hypot(mvx, mvz); if (len > 1) { mvx /= len; mvz /= len; }
    const wall = W.move(a, mvx * speed, mvz * speed, dt); a.spd = len > 0.05 ? speed : 0;
    if (tg && wall) ai.strafe = -ai.strafe;
    ai.stuckT += dt;
    if (ai.stuckT > 1.2) { const moved = Math.hypot(a.x - ai.lx, a.z - ai.lz), wanted = ai.path && !ai.holdT;
      if (wanted && moved < 0.35) { ai.stuck++; if (ai.stuck >= 5) { const c = nearestMain(a.x, a.z); if (c >= 0) { a.x = W.cellX(c); a.z = W.cellZ(c); a.y = map.H[c]; } G.stats.unstuck++; ai.stuck = 0; requestPath(a, pickGoal(a)); } else if (ai.stuck >= 2) requestPath(a, pickGoal(a)); else requestPath(a, ai.goal); }
      else if (moved > 0.6) ai.stuck = 0;
      ai.stuckT = 0; ai.lx = a.x; ai.lz = a.z; }
  }
  function processPaths() {
    let budget = 1;
    while (pathQ.length && budget-- > 0) { const a = pathQ.shift(); if (!a.alive || !a.ai.wantPath) continue; a.ai.wantPath = false;
      const g = G.goals.find(q => q.c === a.ai.goal); a.ai.goalBase = g && g.tag === 'base' ? g.base : null;
      let s = W.nearestOK(a.x, a.z, 4); if (s >= 0 && !mainNet(s)) s = nearestMain(a.x, a.z);
      const p = s >= 0 ? W.path(s, a.ai.goal, 90000) : null;
      if (p && p.length > 1) { a.ai.path = p; a.ai.pi = 1; a.ai.fail = 0; }
      else if (p && p.length === 1) { a.ai.path = null; a.ai.holdT = a.ai.mode === 'base' ? 6 : 0.5; }
      else { a.ai.fail = (a.ai.fail || 0) + 1;
        if (a.ai.fail >= 3) { const c = nearestMain(a.x, a.z); if (c >= 0) { a.x = W.cellX(c); a.z = W.cellZ(c); a.y = map.H[c]; G.stats.unstuck++; } a.ai.fail = 0; a.ai.path = null; a.ai.holdT = 0.2; }
        else if (s >= 0 && Math.hypot(W.cellX(s) - a.x, W.cellZ(s) - a.z) > 0.3) { a.ai.path = [s, s]; a.ai.pi = 1; a.ai.recover = true; }
        else { a.ai.path = null; a.ai.holdT = 0.3 + rnd() * 0.5; } } }
  }
  // ---------- civis ----------
  const npcPathQ = [];
  function npcThink(n, dt) {
    if (!n.path) { n.waitT -= dt; n.spd = 0; if (n.waitT <= 0 && !npcPathQ.includes(n)) npcPathQ.push(n); }
    else { const c = n.path[n.pi], tx = W.cellX(c), tz = W.cellZ(c), dx = tx - n.x, dz = tz - n.z, d = Math.hypot(dx, dz);
      if (d < 0.4) { n.pi++; if (n.pi >= n.path.length) { n.path = null; n.waitT = 3 + rnd() * 8; } }
      else { const vx = dx / d, vz = dz / d; n.yaw += clamp(angDiff(n.yaw, Math.atan2(vx, vz)), -3 * dt, 3 * dt); const wall = W.move(n, vx * 1.3, vz * 1.3, dt); n.spd = 1.3; if (wall) { n.stk = (n.stk || 0) + dt; if (n.stk > 2) { n.path = null; n.stk = 0; n.waitT = 1; } } else n.stk = 0; } }
    n.anim += dt * n.spd * 2.2;
  }
  // ---------- atualização ----------
  function update(dt) {
    if (G.over) return;
    G.t += dt; G.timeLeft -= dt;
    if (G.timeLeft <= 0 && !G.over) { G.timeLeft = 0; G.over = true; G.winner = G.score[0] === G.score[1] ? -1 : G.score[0] > G.score[1] ? 0 : 1; emit({ type: 'end', winner: G.winner }); }
    for (const a of G.actors) {
      if (!a.alive) { a.deathT += dt; if (a.respawnT > -1) { a.respawnT -= dt; if (a.respawnT <= 0 && !a.waitSpawn) spawn(a); } continue; }
      a.invuln = Math.max(0, a.invuln - dt); a.hurtT = Math.max(0, a.hurtT - dt); a.cd = Math.max(0, a.cd - dt); a.bloom = Math.max(0, a.bloom - dt * 0.12);
      if (a.swapT > 0) a.swapT = Math.max(0, a.swapT - dt);
      if (a.reloadT > 0) { a.reloadT -= dt; if (a.reloadT <= 0) { a.reloadT = 0; finishReload(a); } }
      if (G.t - a.lastHurt > 5 && a.hp < 100) a.hp = Math.min(100, a.hp + 12 * dt);
      if (a.ctrl === 'bot') botThink(a, dt); else humanUpdate(a, dt);
      a.anim += dt * a.spd * 2.2;
      if (a.y < -5) damage(a, 999, a, false);
    }
    for (const n of G.npcs) { if (!n.alive) { n.deathT += dt; n.respawnT -= dt; if (n.respawnT <= 0) spawnNpc(n); continue; } n.hurtT = Math.max(0, n.hurtT - dt); npcThink(n, dt); }
    processPaths();
    let nb = 2; while (npcPathQ.length && nb-- > 0) { const n = npcPathQ.shift(); if (!n.alive) continue; const s = W.nearestOK(n.x, n.z, 4), g = G.npcSpots[(rnd() * G.npcSpots.length) | 0]; const p = s >= 0 ? W.path(s, g, 40000) : null; if (p && p.length > 1 && p.length < 260) { n.path = p; n.pi = 1; } else n.waitT = 2 + rnd() * 3; }
    updateCars(dt);
    updateBases(dt);
    for (const k of ['tracers', 'puffs', 'flashes']) { const L = G.fx[k]; for (const f of L) f.t -= dt; G.fx[k] = L.filter(f => f.t > 0); }
  }
  // jogador humano: no modo treino o movimento é calculado aqui; no online o servidor recebe a posição já validada
  function humanUpdate(a, dt) {
    const I = a.in;
    if (a.ctrl === 'local') {
      a.yaw -= I.dx; a.pitch = clamp(a.pitch - I.dy, -1.45, 1.45); I.dx = 0; I.dy = 0;
      a.crouch = !!I.crouch;
      const sprint = I.sprint && !I.aim && !a.crouch && I.mz > 0.3;
      const speed = a.crouch ? 2.2 : I.aim ? 2.8 : sprint ? 6.1 : 4.6;
      const fx = Math.sin(a.yaw), fz = Math.cos(a.yaw), rx = -Math.cos(a.yaw), rz = Math.sin(a.yaw);
      let mx = fx * I.mz + rx * I.mx, mz = fz * I.mz + rz * I.mx; const l = Math.hypot(mx, mz); if (l > 1) { mx /= l; mz /= l; }
      if (I.jump && a.onGround) { a.vy = 4.7; a.onGround = false; } I.jump = false;
      W.move(a, mx * speed, mz * speed, dt); a.spd = l > 0.05 ? speed : 0; a.sprinting = sprint;
    }
    actions(a, dt);
  }
  // ações de combate de um humano a partir do estado de entrada (mesma regra no treino e no servidor)
  function actions(a, dt) {
    const I = a.in;
    if (I.swap) { swap(a); I.swap = false; }
    if (I.reload) { startReload(a); I.reload = false; }
    const w = a.ammo[a.cur], wc = W_(a.cur);
    if (w.mag === 0 && w.res > 0 && a.reloadT <= 0 && a.swapT <= 0 && I.fire) startReload(a);
    useStation(a, I.use, dt);
    const moving = a.spd > 0.05;
    if (I.fire && !a.sprinting) {
      if (wc.auto || !a.trig) {
        if (canFire(a)) {
          let sp = wc.spread + a.bloom + (moving ? 0.022 : 0) + (a.onGround ? 0 : 0.06); if (I.aim) sp *= 0.35; if (a.crouch) sp *= 0.7;
          fire(a, a.yaw, a.pitch, sp); a.bloom = Math.min(0.03, a.bloom + (a.cur === 'rifle' ? 0.0045 : 0.006));
          if (a.ctrl === 'local') { const kick = (I.aim ? 0.008 : 0.013) * (a.cur === 'pistol' ? 1.4 : 1); a.pitch = clamp(a.pitch + kick, -1.45, 1.45); a.yaw += (rnd() - 0.5) * 0.006; }
          a.recoil = 1;
        } else if (w.mag === 0 && w.res === 0 && !a.trig) emit({ type: 'dry', id: a.id, w: a.cur });
      }
      a.trig = true;
    } else a.trig = false;
  }
  G.sectorAt = (x, z) => { const zf = foldZ(z), dz = Math.abs(z - MID), side = z < MID ? 0 : 1;
    if (zf <= BASEZ + 1 && x > 34 && x < 120) return 'Base ' + TEAM[side].name;
    if (x < aveEast(z) + 0.6) return 'Avenida das Américas';
    if (x >= WALK_X0 - 0.5) return 'Beira do Valão';
    if (dz <= PRACA.hz + 1 && x <= PRACA.x1) return 'Zona Central — Praça';
    if (dz <= 9 && x >= ESC_X0 && x <= ESC_X1 + 2) return 'Zona Central — Escadão';
    if (x > 92 && dz < 34) return 'Alto do Escadão';
    if (dz < 46) return 'Zona Central';
    if (Math.hypot((x - 97) / 20, (zf - 62) / 22) < 1) return 'Morro do Mirante';
    return 'Bairro ' + (side ? 'Vermelho' : 'Azul'); };
  Object.assign(G, { spawn, update, fire, damage, eyeH, bodyH, dirOf, canSee, startReload, finishReload, swap, useStation, nearStation, needsRefill, actions, totalAmmo, spawnNpc, nearestMain, hitActors });
  G.byId = id => G.actors.find(a => a.id === id) || G.npcs.find(n => n.id === id);
  return G;
}
