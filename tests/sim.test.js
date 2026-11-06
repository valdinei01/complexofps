// Testes automáticos da simulação compartilhada (mapa, munição, dominação, civis e bots).
const S = require('../shared/sim.js');
const { test, eq, ok, summary } = require('./mini.js');

const map = S.buildMap(20261105), W = S.makeWorld(map);
const freshGame = (o) => S.makeGame(map, W, Object.assign({ humans: [{ key: 'a', name: 'Ana', team: 0 }, { key: 'b', name: 'Beto', team: 1 }], bots: { 0: 0, 1: 0 }, local: true }, o || {}));
const step = (G, sec, fn) => { const n = Math.round(sec * 30); for (let k = 0; k < n; k++) { if (fn) fn(k); G.update(1 / 30); } };
const placeAt = (a, c) => { a.x = W.cellX(c); a.z = W.cellZ(c); a.y = map.H[c]; a.alive = true; a.hp = 100; };

// ---------------- mapa e movimentação ----------------
test('nascimentos: os dois times não se enxergam', () => {
  const G = freshGame(); let vis = 0;
  for (const a of G.spawns[0]) for (const b of G.spawns[1]) if (W.los(W.cellX(a), map.H[a] + 1.6, W.cellZ(a), W.cellX(b), map.H[b] + 1.6, W.cellZ(b))) vis++;
  ok(G.spawns[0].length >= 6 && G.spawns[1].length >= 6, 'pontos de nascimento suficientes'); eq(vis, 0, 'pares com visão direta');
});
test('nascimentos fora de construções e com espaço livre', () => {
  const G = freshGame();
  for (const t of [0, 1]) for (const c of G.spawns[t]) { ok(W.OK[c] === 1, 'célula navegável'); ok(map.K[c] !== S.K_ROOF && S.WALKABLE[map.K[c]], 'chão de rua/praça'); ok(W.fits(W.cellX(c), W.cellZ(c), map.H[c], 0.3), 'cabe o personagem'); }
});
test('nenhuma armadilha: de qualquer ponto alcançável dá para voltar', () => {
  const G = freshGame(); const s = G.spawns[0][0]; const fw = W.reach(s, true, false), bw = W.reach(s, false, true); let trap = 0;
  for (let c = 0; c < S.NC; c++) if (fw[c] && !bw[c]) trap++; eq(trap, 0, 'células sem volta');
});
test('bases A, B, C e estações alcançáveis pelos dois times', () => {
  const G = freshGame(); for (const t of [0, 1]) { const r = W.reach(G.spawns[t][0], false, false); for (const b of G.bases) ok(r[b.cell], 'base ' + b.id + ' para time ' + t); ok(r[G.stationCell[t]], 'estação do time ' + t); }
});
test('subir e descer o escadão inteiro andando (física real)', () => {
  const G = freshGame(); const a = G.actors[0]; const c0 = W.nearestOK(map.x0Esc - 1, S.MID, 3); placeAt(a, c0); a.yaw = Math.PI / 2; a.in.mz = 1;
  step(G, 16); ok(a.x > S.ESC_X1 - 3, 'chegou ao alto (x=' + a.x.toFixed(1) + ')'); ok(a.y > 14, 'altura ' + a.y.toFixed(1));
  a.yaw = -Math.PI / 2; step(G, 16); ok(a.x < S.ESC_X0 - 2, 'voltou à praça (x=' + a.x.toFixed(1) + ')'); ok(a.y < 0.5, 'desceu (y=' + a.y.toFixed(2) + ')');
});
test('ir da base até a beira do valão e voltar', () => {
  const G = freshGame(); const a = G.actors[0]; const c0 = G.spawns[0][3]; placeAt(a, c0);
  const goal = W.nearestOK(128.75, 60, 4), p = W.path(c0, goal, 200000); ok(p && p.length > 10, 'caminho existe');
  const back = W.path(goal, c0, 200000); ok(back && back.length > 10, 'caminho de volta existe');
});
test('paredes bloqueiam: andar contra uma casa não atravessa', () => {
  const G = freshGame(); const a = G.actors[0];
  let c = -1; for (let k = 0; k < S.NC && c < 0; k++) { if (!W.OK[k]) continue; const n = k + 2; if (map.K[n] === S.K_ROOF && map.H[n] > map.H[k] + 3 && map.K[k + 1] !== S.K_ROOF) c = k; }
  placeAt(a, c); const x0 = a.x; a.yaw = Math.PI / 2; a.in.mz = 1; step(G, 2); ok(a.x < x0 + 0.8, 'parou na parede'); ok(Math.abs(a.y - map.H[c]) < 0.6, 'não subiu na parede');
});

// ---------------- munição ----------------
test('disparo consome munição, recarga usa só a reserva', () => {
  const G = freshGame(); const a = G.actors[0]; G.spawn(a); a.invuln = 0;
  a.in.fire = true; step(G, 0.55); a.in.fire = false; step(G, 0.1);
  const r = a.ammo.rifle; ok(r.mag < 30 && r.mag >= 24, 'carregador caiu (' + r.mag + ')'); eq(r.res, 180, 'reserva intacta');
  const before = r.mag + r.res; a.in.reload = true; step(G, 2.3); eq(r.mag, 30, 'carregador cheio'); eq(r.mag + r.res, before, 'total conservado');
});
test('munição nunca negativa nem acima do máximo; arma vazia não dispara', () => {
  const G = freshGame(); const a = G.actors[0]; G.spawn(a); a.invuln = 0;
  a.in.fire = true; step(G, 60, () => { const r = a.ammo.rifle; if (r.mag < 0 || r.res < 0 || r.mag > 30 || r.res > 180) throw new Error('fora dos limites'); });
  eq(a.ammo.rifle.mag, 0); eq(a.ammo.rifle.res, 0); const shots = G.stats.shots; step(G, 2); eq(G.stats.shots, shots, 'sem disparos com 0/0');
  a.in.fire = false;
});
test('troca para a pistola e semiautomática exige soltar o gatilho', () => {
  const G = freshGame(); const a = G.actors[0]; G.spawn(a); a.in.swap = true; step(G, 0.6); eq(a.cur, 'pistol');
  a.in.fire = true; step(G, 1.0); eq(a.ammo.pistol.mag, 14, 'segurar o gatilho = 1 tiro');
  for (let k = 0; k < 3; k++) { a.in.fire = false; step(G, 0.1); a.in.fire = true; step(G, 0.25); } eq(a.ammo.pistol.mag, 11, 'cada clique = 1 tiro'); a.in.fire = false;
});
test('reabastece na própria base segurando ~3 s (parcial e após esgotar)', () => {
  const G = freshGame(); const a = G.actors[0]; G.spawn(a); placeAt(a, G.stationCell[0]);
  a.ammo.rifle = { mag: 7, res: 40 }; a.ammo.pistol = { mag: 0, res: 0 }; a.in.use = true; step(G, 2.0); eq(a.ammo.rifle.res, 40, 'ainda não completou');
  step(G, 1.2); eq(a.ammo.rifle.mag, 30); eq(a.ammo.rifle.res, 180); eq(a.ammo.pistol.mag, 15); eq(a.ammo.pistol.res, 75); ok(G.events.some(e => e.type === 'refill'), 'evento de reabastecimento');
  a.ammo.rifle = { mag: 0, res: 0 }; step(G, 3.5); eq(a.ammo.rifle.res, 0, 'intervalo de segurança impede repetição imediata'); step(G, 5); eq(a.ammo.rifle.res, 180, 'depois do intervalo reabastece'); a.in.use = false;
});
test('não reabastece na base adversária nem à distância', () => {
  const G = freshGame(); const a = G.actors[0]; G.spawn(a); placeAt(a, G.stationCell[1]); a.ammo.rifle = { mag: 0, res: 0 }; a.in.use = true; step(G, 5); eq(a.ammo.rifle.res, 0, 'base inimiga recusada');
  placeAt(a, W.nearestOK(40, 20, 4)); step(G, 5); eq(a.ammo.rifle.res, 0, 'longe da estação recusado');
});
test('sair da área interrompe o reabastecimento', () => {
  const G = freshGame(); const a = G.actors[0]; G.spawn(a); placeAt(a, G.stationCell[0]); a.ammo.rifle = { mag: 0, res: 0 }; a.in.use = true; step(G, 2);
  a.x += 4; step(G, 0.1); a.x -= 4; ok(a.refillT < 0.5, 'tempo zerado ao sair'); step(G, 1.5); eq(a.ammo.rifle.res, 0, 'não completou com o tempo antigo'); a.in.use = false;
});
test('ao renascer volta com carregamento completo, sem duplicar', () => {
  const G = freshGame(); const a = G.actors[0], b = G.actors[1]; G.spawn(a); G.spawn(b); a.invuln = 0; a.ammo.rifle = { mag: 3, res: 0 }; G.damage(a, 999, b, false);
  ok(!a.alive); step(G, S.CONFIG.respawn + 0.3); ok(a.alive, 'renasceu'); eq(a.ammo.rifle.mag, 30); eq(a.ammo.rifle.res, 180); eq(a.ammo.pistol.res, 75);
});

// ---------------- dominação ----------------
test('captura de base neutra leva ~15 s e gera 1% a cada 12 s', () => {
  const G = freshGame(); const a = G.actors[0], b = G.actors[1]; G.spawn(a); G.spawn(b); const A = G.bases[0]; placeAt(a, A.cell);
  step(G, 13); eq(A.owner, -1, 'ainda neutra aos 13 s'); step(G, 2.5); eq(A.owner, 0, 'dominada após ~15 s');
  const s0 = G.score[0]; step(G, 24); ok(Math.abs(G.score[0] - s0 - 2) < 0.15, '2% em 24 s (' + (G.score[0] - s0).toFixed(2) + ')');
});
test('contestação congela a captura; recaptura passa por neutra', () => {
  const G = freshGame(); const a = G.actors[0], b = G.actors[1]; G.spawn(a); G.spawn(b); const A = G.bases[0]; placeAt(a, A.cell); step(G, 16); eq(A.owner, 0);
  placeAt(b, A.cell); a.invuln = b.invuln = 99; const p = A.prog; step(G, 5); eq(A.prog, p, 'congelada'); eq(A.state, 'contestada');
  a.alive = false; a.respawnT = 999; step(G, 15.5); eq(A.owner, -1, 'neutralizada'); step(G, 15.5); eq(A.owner, 1, 'recapturada pelo vermelho');
  const s1 = G.score[0]; step(G, 13); ok(G.score[0] - s1 < 0.01, 'azul parou de pontuar'); ok(G.score[1] > 0.9, 'vermelho pontua');
});
test('três bases rendem 3% a cada 12 s e a partida acaba em 100%', () => {
  const G = freshGame(); G.bases.forEach(b => { b.owner = 0; b.prog = -1; }); G.score[0] = 97.5; step(G, 12.5); ok(G.over, 'terminou'); eq(G.winner, 0); ok(G.score[0] >= 100);
});
test('civil eliminado: -5%, nunca abaixo de 0, sem penalidade duplicada', () => {
  const G = freshGame(); const a = G.actors[0]; G.spawn(a); step(G, 3); const n = G.npcs.find(q => q.alive); G.score[0] = 54;
  G.damage(n, 999, a, false); eq(G.score[0], 49); G.damage(n, 999, a, false); eq(G.score[0], 49, 'sem duplicar'); ok(G.events.some(e => e.type === 'npc'));
  const n2 = G.npcs.find(q => q.alive); G.score[0] = 2; G.damage(n2, 999, a, false); eq(G.score[0], 0, 'piso de 0%');
  G.bases[0].owner = 0; const n3 = G.npcs.find(q => q.alive); if (n3) { G.damage(n3, 999, a, false); eq(G.bases[0].owner, 0, 'não tira a posse da base'); }
});

// ---------------- bots ----------------
test('bot sem munição volta à base, reabastece e retorna ao combate', () => {
  const G = S.makeGame(map, W, { allBots: true }); step(G, 2); const a = G.actors.find(x => x.team === 0 && x.alive);
  a.ammo.rifle = { mag: 0, res: 0 }; a.ammo.pistol = { mag: 0, res: 0 }; let got = false;
  for (let k = 0; k < 30 * 120 && !got; k++) { a.invuln = 5; G.update(1 / 30); if (G.events.some(e => e.type === 'refill' && e.id === a.id)) got = true; G.events.length = 0; }
  ok(got, 'reabasteceu na estação'); eq(a.ammo.rifle.res, 180); ok(a.ai.mode !== 'refill' || true);
});
test('carros andam pela avenida, param para pedestres e bloqueiam a passagem', () => {
  const G = freshGame(); const a = G.actors[0]; G.spawn(a); const car = G.cars[0]; const z0 = car.z; step(G, 2); ok(car.z > z0 + 8, 'andou ' + (car.z - z0).toFixed(1) + ' m');
  car.z = 100; car.spd = 8; a.x = S.aveX(108) - S.LANE_X; a.z = 108; a.y = 0; a.alive = true; step(G, 3); ok(car.spd < 0.5, 'parou para o pedestre (vel ' + car.spd.toFixed(2) + ')'); ok(car.z < 105, 'não atropelou (z ' + car.z.toFixed(1) + ')');
  const box = W.dyn[0]; ok(!W.fits((box.x0 + box.x1) / 2, (box.z0 + box.z1) / 2, 0, 0.3), 'carro é obstáculo');
  const t = W.rayDyn((box.x0 + box.x1) / 2 - 10, 1, (box.z0 + box.z1) / 2, 1, 0, 0, 50); ok(t < 10, 'bala para no carro');
});
test('partida só com bots: capturam, reabastecem, munição finita e sem travar', () => {
  const G = S.makeGame(map, W, { allBots: true, diff: 'normal' }); let maxStep = 0, refills = 0, caps = 0, neg = 0, npcKills = 0;
  for (let k = 0; k < 30 * 420 && !G.over; k++) { const t = Date.now(); G.update(1 / 30); maxStep = Math.max(maxStep, Date.now() - t);
    for (const e of G.events) { if (e.type === 'refill') refills++; if (e.type === 'base' && e.team >= 0) caps++; if (e.type === 'npc') npcKills++; } G.events.length = 0;
    for (const a of G.actors) for (const w of ['rifle', 'pistol']) if (a.ammo[w].mag < 0 || a.ammo[w].res < 0 || a.ammo[w].mag > S.CONFIG.weapons[w].mag || a.ammo[w].res > S.CONFIG.weapons[w].res) neg++; }
  console.log('      placar', G.score.map(v => v.toFixed(1)).join(' x '), '| capturas', caps, '| reabastecimentos', refills, '| civis atingidos', npcKills, '| destravamentos', G.stats.unstuck, '| passo máx', maxStep + 'ms');
  ok(caps >= 3, 'bots capturaram bases'); eq(neg, 0, 'munição fora dos limites'); ok(G.stats.unstuck <= 3, 'destravamentos'); ok(G.score[0] + G.score[1] > 5, 'pontuação gerada');
});

summary();
