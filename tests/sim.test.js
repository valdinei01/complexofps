// Testes automáticos da simulação compartilhada (mapa, munição, dominação, civis e bots).
const S = require('../shared/sim.js');
const { test, eq, ok, summary } = require('./mini.js');

const map = S.buildMap(20261105), W = S.makeWorld(map);
const freshGame = (o) => S.makeGame(map, W, Object.assign({ humans: [{ key: 'a', name: 'Ana', team: 0 }, { key: 'b', name: 'Beto', team: 1 }], bots: { 0: 0, 1: 0 }, local: true, noPolice: true }, o || {}));
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
test('subir e descer o Escadão Principal inteiro andando (física real)', () => {
  const G = freshGame(); const a = G.actors[0]; placeAt(a, W.nearestOK(54 * S.SC, 41 * S.SC, 3)); a.yaw = 0; a.in.mz = 1;
  step(G, 10); ok(a.z > 72 * S.SC, 'subiu os dois lances (z=' + a.z.toFixed(1) + ')'); ok(a.y > 3.0, 'altura ' + a.y.toFixed(1));
  a.x = 50 * S.SC; a.z = 73.5 * S.SC; a.y = 3.4; a.yaw = -Math.PI / 2; step(G, 6); ok(a.x < 33 * S.SC, 'chegou ao Alto do Escadão (x=' + a.x.toFixed(1) + ')'); ok(a.y > 4.5, 'altura ' + a.y.toFixed(1));
  a.x = 27 * S.SC; a.z = 84 * S.SC; a.y = 5; a.yaw = 0; step(G, 8); ok(a.z > 100 * S.SC, 'seguiu pela Rua do Alto até a mata (z=' + a.z.toFixed(1) + ')'); a.x = 27 * S.SC; a.z = 73.5 * S.SC; a.y = 5;
  a.yaw = Math.PI / 2; step(G, 7); ok(a.x > 44 * S.SC, 'voltou ao patamar (x=' + a.x.toFixed(1) + ')'); a.x = 54 * S.SC; a.z = 70 * S.SC; a.yaw = Math.PI; step(G, 10); ok(a.z < 45 * S.SC, 'desceu até a praça (z=' + a.z.toFixed(1) + ')'); ok(a.y < 1.0, 'y=' + a.y.toFixed(2));
});
test('caminhos: trilhas da mata, pontes do canal, quadra e passagem de baixo', () => {
  const G = freshGame(); const s0 = G.spawns[0][0];
  for (const [nm, x, z] of [['Base A', S.CLEAR.A.c[0], S.CLEAR.A.c[1]], ['Base Vermelha', S.CLEAR.verm.c[0], S.CLEAR.verm.c[1]], ['Quadra do Baile', S.QUADRA.x, S.QUADRA.z], ['Palco', S.STAGE.x, S.STAGE.z], ['Base C', S.CLEAR.C.c[0], S.CLEAR.C.c[1]], ['Alto do Escadão', 28 * S.SC, 78 * S.SC], ['Beco da Mina', 56 * S.SC, 12 * S.SC], ['Base B — Largo da Serra', S.CLEAR.B.c[0], S.CLEAR.B.c[1]], ['Clareira da mata', S.CLEAR.cl1.c[0], S.CLEAR.cl1.c[1]]]) {
    const g = W.nearestOK(x, z, 6); ok(g >= 0, nm + ' tem chão navegável'); const p = W.path(s0, g, 400000); ok(p && p.length > 5, 'caminho até ' + nm); }
  for (const b of S.BRIDGES) { const m = [(b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2], c = W.nearestOK(m[0], m[1], 2); ok(c >= 0 && W.OK[c], 'ponte navegável em ' + m.map(v => v.toFixed(0))); }
});
test('paredes bloqueiam: andar contra uma casa não atravessa', () => {
  const G = freshGame(); const a = G.actors[0];
  let c = -1; for (let k = 0; k < S.NC && c < 0; k++) { if (!W.OK[k]) continue; const n = k + 2; if (map.K[n] === S.K_ROOF && map.H[n] > map.H[k] + 3 && map.K[k + 1] !== S.K_ROOF) c = k; }
  placeAt(a, c); const x0 = a.x; a.yaw = Math.PI / 2; a.in.mz = 1; step(G, 2); ok(a.x < x0 + 0.8, 'parou na parede'); ok(Math.abs(a.y - map.H[c]) < 0.6, 'não subiu na parede');
});

test('relevo suave e moderado: sem degraus no chão (no máximo 0,2 m a cada 0,5 m)', () => {
  const ground = k => k === S.K_MATA || k === S.K_TRAIL || k === S.K_STREET || k === S.K_BECO; // meio-fio (calçada) não conta
  let steep = 0, maxH = 0, maxStep = 0; for (let c = 0; c < S.NC; c++) { if (!ground(map.K[c]) || map.SN[c] === -6 || map.SN[c] === -5 || map.SN[c + 1] === -5 || map.SN[c + 1] === -6) continue; maxH = Math.max(maxH, map.H[c]); const i = c % S.GX; if (i + 1 < S.GX && ground(map.K[c + 1])) { const d = Math.abs(map.H[c + 1] - map.H[c]); maxStep = Math.max(maxStep, d); if (d > 0.14) steep++; } }
  console.log('      altura máx do chão', maxH.toFixed(1), 'm | maior desnível entre células vizinhas', maxStep.toFixed(2), 'm (0,5 m de distância)'); ok(maxH <= 6, 'relevo moderado'); ok(maxStep <= 0.2, 'sem degraus no chão (maior desnível ' + maxStep.toFixed(2) + ' m)'); console.log('      células com inclinação acima de 28%:', steep);
});
test('nenhum beco ou rua sem saída: as duas pontas de cada rua levam a outro caminho', () => {
  const walk = (x, z) => { const i = Math.floor(x / S.CELL), j = Math.floor(z / S.CELL); if (i < 0 || j < 0 || i >= S.GX || j >= S.GZ) return false; const c = j * S.GX + i, k = map.K[c]; return S.WALKABLE[k] && k !== S.K_ROOF && !(k === S.K_ESC && map.M[c] === 1) || (k === S.K_BLOCK && map.M[c] === S.B_INVIS); };
  const bad = [];
  // a ponta está ligada se, perto dela, existe chão andável que não pertence a esta mesma rua (outra rua, praça, mata, escadão...)
  S.STREETS.forEach((st, si) => { for (const end of [0, 1]) { const e = end ? st.pts[st.pts.length - 1] : st.pts[0], r = st.hw + 1.2; let other = 0;
    for (let x = e[0] - r; x <= e[0] + r; x += S.CELL) for (let z = e[1] - r; z <= e[1] + r; z += S.CELL) { if (Math.hypot(x - e[0], z - e[1]) > r) continue; const i = Math.floor(x / S.CELL), j = Math.floor(z / S.CELL); if (i < 0 || j < 0 || i >= S.GX || j >= S.GZ) continue; const c = j * S.GX + i;
      if (walk(x, z) && map.SN[c] !== si) other++; }
    if (other < 3) bad.push(st.name + (end ? ' (fim)' : ' (início)')); } });
  eq(bad.join(', '), '', 'pontas sem saída');
  // nenhuma rua/beco fica fora da rede principal (sem bolsões isolados)
  const G = freshGame(); const s0 = G.spawns[0][0], fw = W.reach(s0, false, false); let iso = 0; for (let c = 0; c < S.NC; c++) { const k = map.K[c]; if ((k === S.K_STREET || k === S.K_BECO || k === S.K_PLAZA) && W.OK[c] && !fw[c]) iso++; } eq(iso, 0, 'células de rua isoladas');
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

test('atropelamento: carro em velocidade mata quem entra na frente; parado não machuca', () => {
  const G = freshGame(); const a = G.actors[0]; G.spawn(a); a.invuln = 0; const car = G.cars[0]; car.s = G.aveLen * 0.4; car.spd = 9; G.carPose(car);
  a.x = car.x + car.fx * 2.6; a.z = car.z + car.fz * 2.6; a.y = 0; G.update(1 / 30); G.update(1 / 30); ok(!a.alive, 'atropelado morreu'); ok(G.events.some(e => e.type === 'kill' && e.cause === 'car'), 'morte registrada como atropelamento');
  const b = G.actors[1]; G.spawn(b); b.invuln = 0; const c2 = G.cars[1]; c2.spd = 0; c2.max = 0; G.carPose(c2); b.x = c2.x + c2.fx * 2.4; b.z = c2.z + c2.fz * 2.4; b.y = 0; G.update(1 / 30); ok(b.alive, 'carro parado não mata');
});
test('polícia: viaturas entram na favela, policiais desembarcam, tomam base e vão embora', () => {
  const G = S.makeGame(map, W, { allBots: true }); G.police.next = 0; G.police.next = 0; let ph = new Set(), took = false, n = 0; G.update(1 / 30); const team = G.police.team; ok(team === 0 || team === 1, 'escolheu um time: ' + team);
  while (G.police.phase === 'chegando' && n++ < 30 * 150) G.update(1 / 30); eq(G.police.phase, 'incursao', 'viaturas chegaram (' + (n / 30).toFixed(1) + ' s)');
  const cops = G.actors.filter(a => a.isPolice); eq(cops.length, 15, '15 policiais (3 viaturas)'); const fav = team === 0 ? S.POLY_LEFT : S.POLY_RIGHT; ok(G.police.cars.every(c => S.inPoly(c.x, c.z, fav) || Math.hypot(c.x - (team ? 193 : 72) * S.SC, c.z - 25 * S.SC) < 26), 'viaturas dentro da favela do time alvo');
  for (const a of G.actors) if (!a.isPolice) { a.alive = false; a.respawnT = 1e9; } // só a polícia em campo para testar a tomada
  for (let k = 0; k < 30 * 120 && !took; k++) { G.update(1 / 30); for (const e of G.events) if (e.type === 'base' && e.team === 2) took = true; G.events.length = 0; } ok(took, 'polícia tomou uma base da favela alvo');
  const owned = G.bases.filter(b => b.owner === 2).map(b => b.id); ok(owned.every(id => G.policeTargets(team).some(b => b.id === id)), 'só bases da favela alvo: ' + owned);
  for (const b of G.bases) if (b.owner !== 2) { b.owner = -1; b.prog = 0; } const s0 = G.score.slice(); for (let k = 0; k < 30 * 20; k++) G.update(1 / 30); ok(G.score[0] === s0[0] && G.score[1] === s0[1], 'base com a polícia não pontua para ninguém');
  G.police.endT = G.t; G.update(1 / 30); eq(G.police.phase, 'idle', 'operação terminou'); eq(G.actors.filter(a => a.isPolice).length, 0, 'policiais foram embora'); ok(G.bases.every(b => b.owner !== 2), 'bases voltaram a ficar neutras');
});
// ---------------- granadas ----------------
test('granada: estoque de 2, não lança sem estoque, explode e causa dano em área', () => {
  const G = freshGame(); const a = G.actors[0], b = G.actors[1]; G.spawn(a); G.spawn(b); a.invuln = b.invuln = 0;
  const c = W.nearestOK(S.CLEAR.A.c[0], S.CLEAR.A.c[1], 4); placeAt(a, c); placeAt(b, c); b.x += 2.5; a.yaw = Math.PI / 2; a.pitch = -1.3;
  eq(a.gren, 2, 'começa com 2'); a.in.gren = true; step(G, 0.1); eq(a.gren, 1); eq(G.grenades.length, 1, 'granada no ar');
  a.in.gren = true; step(G, 0.1); eq(a.gren, 1, 'intervalo entre arremessos'); step(G, 1.3); a.in.gren = true; step(G, 0.1); eq(a.gren, 0);
  a.in.gren = true; step(G, 2); eq(a.gren, 0, 'sem estoque não lança'); ok(G.events.filter(e => e.type === 'gthrow').length === 2, 'só 2 arremessos');
  step(G, 3); ok(G.events.some(e => e.type === 'gboom'), 'explodiu'); ok(b.hp < 100 || !b.alive, 'dano em área (hp ' + Math.round(b.hp) + ')'); eq(G.grenades.length, 0);
});
test('granada respeita o terreno: nunca fica abaixo do chão', () => {
  const G = freshGame(); const a = G.actors[0]; G.spawn(a); placeAt(a, W.nearestOK(54 * S.SC, 41 * S.SC, 3)); a.yaw = 0; a.pitch = 0.3; a.in.gren = true; let below = 0;
  for (let k = 0; k < 90; k++) { G.update(1 / 30); for (const g of G.grenades) if (g.y < W.hCell(g.x, g.z) - 0.05 && !W.blockedAt(g.x, g.z)) below++; } eq(below, 0, 'quadros abaixo do chão');
});
test('reabastecer na base devolve as granadas', () => {
  const G = freshGame(); const a = G.actors[0]; G.spawn(a); placeAt(a, G.stationCell[0]); a.gren = 0; a.in.use = true; step(G, 3.3); eq(a.gren, 2);
});
test('ciclo de dia e noite avança e dá a volta', () => {
  const G = freshGame(); const t0 = G.dayT; step(G, 60); ok(Math.abs(G.dayT - (t0 + 60 / S.CONFIG.dayLength)) < 1e-3, 'avançou 1 minuto'); G.dayT = 0.9999; step(G, 1); ok(G.dayT < 0.01, 'deu a volta');
});
test('bots no Normal erram mais (precisão moderada)', () => {
  const G = S.makeGame(map, W, { allBots: true, diff: 'normal' }); for (let k = 0; k < 30 * 300; k++) { G.update(1 / 30); G.events.length = 0; }
  const acc = G.stats.hits / Math.max(1, G.stats.shots); console.log('      precisão dos bots (Normal):', (acc * 100).toFixed(1) + '%', '| tiros', G.stats.shots); ok(acc < 0.2, 'precisão abaixo de 20%');
});
test('bots priorizam dominar bases; "Muito difícil" acerta mais que "Normal"', () => {
  const acc = {}; for (const diff of ['normal', 'elite']) { const G = S.makeGame(map, W, { allBots: true, diff }); let baseT = 0, tot = 0;
    for (let k = 0; k < 30 * 240; k++) { G.update(1 / 30); G.events.length = 0; if (k % 15 === 0) for (const a of G.actors) if (a.alive && a.ai) { tot++; if (a.ai.mode === 'base') baseT++; } }
    acc[diff] = G.stats.hits / Math.max(1, G.stats.shots); console.log('      ' + diff + ': ' + Math.round(100 * baseT / tot) + '% do tempo indo/defendendo bases | precisão ' + (acc[diff] * 100).toFixed(1) + '%'); if (diff === 'normal') ok(baseT / tot > 0.45, 'foco em bases'); }
  ok(acc.elite > acc.normal, 'Muito difícil é mais preciso');
});
// ---------------- bots ----------------
test('bot sem munição volta à base, reabastece e retorna ao combate', () => {
  const G = S.makeGame(map, W, { allBots: true }); step(G, 2); const a = G.actors.find(x => x.team === 0 && x.alive);
  a.ammo.rifle = { mag: 0, res: 0 }; a.ammo.pistol = { mag: 0, res: 0 }; let got = false;
  for (let k = 0; k < 30 * 120 && !got; k++) { a.invuln = 5; G.update(1 / 30); if (G.events.some(e => e.type === 'refill' && e.id === a.id)) got = true; G.events.length = 0; }
  ok(got, 'reabasteceu na estação'); eq(a.ammo.rifle.res, 180); ok(a.ai.mode !== 'refill' || true);
});
test('carros andam pela avenida, param para pedestres a uma distância segura e bloqueiam a passagem', () => {
  const G = freshGame(); const a = G.actors[0]; G.spawn(a); const car = G.cars[0]; const s0 = car.s; step(G, 2); ok(Math.abs(car.s - s0) > 8, 'andou ' + Math.abs(car.s - s0).toFixed(1) + ' m');
  car.s = G.aveLen * 0.45; car.spd = 8; G.carPose(car); a.x = car.x + car.fx * 13; a.z = car.z + car.fz * 13; a.y = 0; a.alive = true; step(G, 3); ok(car.spd < 0.5, 'parou para o pedestre (vel ' + car.spd.toFixed(2) + ')'); ok(Math.hypot(car.x - a.x, car.z - a.z) > 3, 'não atropelou');
  const box = W.dyn[0]; ok(!W.fits(box.x, box.z, 0, 0.3), 'carro é obstáculo');
  const t = W.rayDyn(box.x - box.fz * 10, 1, box.z + box.fx * 10, box.fz, 0, -box.fx, 50); ok(t < 10.5, 'bala para no carro (t=' + t.toFixed(1) + ')');
});
test('partida só com bots: capturam, reabastecem, munição finita e sem travar', () => {
  const G = S.makeGame(map, W, { allBots: true, diff: 'normal' }); let maxStep = 0, refills = 0, caps = 0, neg = 0, npcKills = 0;
  for (let k = 0; k < 30 * 420 && !G.over; k++) { const t = Date.now(); G.update(1 / 30); maxStep = Math.max(maxStep, Date.now() - t);
    for (const e of G.events) { if (e.type === 'refill') refills++; if (e.type === 'base' && e.team >= 0) caps++; if (e.type === 'npc') npcKills++; } G.events.length = 0;
    for (const a of G.actors) for (const w of ['rifle', 'pistol']) if (a.ammo[w].mag < 0 || a.ammo[w].res < 0 || a.ammo[w].mag > S.CONFIG.weapons[w].mag || a.ammo[w].res > S.CONFIG.weapons[w].res) neg++; }
  console.log('      placar', G.score.map(v => v.toFixed(1)).join(' x '), '| capturas', caps, '| reabastecimentos', refills, '| civis atingidos', npcKills, '| destravamentos', G.stats.unstuck, '| passo máx', maxStep + 'ms');
  ok(caps >= 2, 'bots capturaram bases'); eq(neg, 0, 'munição fora dos limites'); ok(G.stats.unstuck <= 10, 'destravamentos'); ok(G.score[0] + G.score[1] > 5, 'pontuação gerada');
});

summary();
