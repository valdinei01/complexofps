/* Complexo do Escadão 3D — simulação compartilhada (mapa, colisão, navegação e regras).
   Roda no servidor (Node) e no navegador (modo treino). Sem dependências.
   Gerado por shared/build.py a partir de _map.js, _world.js e _game.js. */
(function (root) {
'use strict';
// ---------- utilidades ----------
function mulberry(seed) { let s = seed >>> 0; return function () { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function h2(x, z, k) { let h = (x * 374761393 + z * 668265263 + (k || 0) * 1442695041) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
function angDiff(a, b) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }

// ---------- mapa: grade de 0,5 m ----------
// Mapa ampliado (140 x 280 m, 3x a área anterior). Eixo z liga as bases: Azul no sul (z≈0), Vermelha no norte (z≈280).
// No meio fica a ZONA CENTRAL: Praça Central (Base A), Escadão no morro (Base B) e Canal (Base C).
const CELL = 0.5, MW = 140, ML = 280, GX = 280, GZ = 560, NC = GX * GZ, MID = 140;
const K_VOID = 0, K_AVE = 1, K_WALK = 2, K_STREET = 3, K_ESC = 4, K_BECO = 5, K_ROOF = 6, K_BLOCK = 7, K_PLAZA = 8, K_LOT = 9;
const WALKABLE = new Uint8Array([0, 1, 1, 1, 1, 1, 1, 0, 1, 0]);
// materiais de bloco
const B_MURO = 1, B_TANK = 2, B_GUARD = 3, B_WALL = 4, B_INVIS = 5, B_TANK2 = 6, B_SAND = 7, B_JERSEY = 8, B_BRICKS = 9, B_BARREL = 10, B_SUPPLY = 11;
const STEP_UP = 0.55, NAV_STEP = 0.5, NAV_DROP = 3.4;
// Avenida das Américas: 2 faixas de rolamento + estacionamento de cada lado, calçadas largas
const AVE_HW = 6.5, SIDEW = 3.0, LANE_X = 2.0, PARK_X = 5.2;
const aveX = z => 22 + 1.2 * Math.cos((z - MID) / 40);
const aveEast = z => aveX(z) + AVE_HW + SIDEW;
const foldZ = z => z <= MID ? z : ML - z;
const ESC_HW = 3;                          // meia largura do escadão (6 m)
const WALK_X0 = 126.5, WALK_X1 = 131, WALK_H = 0.3, WATER_X1 = 137; // beira do valão e canal
function hill(x, z, cx, cz, rx, rz, h) { const r = Math.hypot((x - cx) / rx, (z - cz) / rz); return h * sm(1, 0.25, r); }
// relevo variado: baixada plana perto da avenida e nas bases, morro grande na zona central, morrinhos nos bairros
function terrain(x, z) {
  if (x < aveEast(z) + 0.6) return 0;
  const zf = foldZ(z), d = Math.abs(z - MID);
  let g = 15 * sm(56, 98, x) * (1 - sm(112, 126, x)) * sm(78, 46, d);          // Morro do Escadão
  g += hill(x, zf, 97, 62, 20, 22, 7);                                         // Morro do Mirante (um de cada lado)
  g += hill(x, zf, 66, 72, 12, 11, 2.6);                                       // elevação no bairro
  g += 0.3 * Math.sin(x / 9) * Math.sin(zf / 11) * sm(aveEast(z) + 2, aveEast(z) + 12, x) * (1 - sm(124, 127, x));
  g *= 1 - sm(120, 126.5, x);
  return Math.max(g, 0);
}
// ruas em coordenadas "dobradas" (metade sul; a metade norte é espelhada => mapa equilibrado)
function sampled(x0, x1, f, step) { const p = []; for (let x = x0; x <= x1 + 1e-6; x += step) p.push([x, f(x)]); return p; }
const STREETS = [
  // ruas principais (largas)
  { name: 'Rua Principal da Baixada', kind: K_STREET, hw: 3.4, pts: sampled(30, 127, x => 40 + 1.5 * Math.sin(x / 14), 3) },
  { name: 'Rua do Mirante', kind: K_STREET, hw: 3.2, pts: sampled(30, 127, x => 98 + 2 * Math.sin(x / 11 + 1), 3) },
  // ruas secundárias (intermediárias), com desvios nos cruzamentos
  { name: 'Rua do Comércio', kind: K_STREET, hw: 2.5, pts: [[47, 15], [47.5, 40]] },
  { name: 'Rua do Comércio', kind: K_STREET, hw: 2.5, pts: [[51, 40], [51.5, 98]] },
  { name: 'Rua do Comércio', kind: K_STREET, hw: 2.5, pts: [[47, 98], [47, 127]] },
  { name: 'Rua da Laje', kind: K_STREET, hw: 2.4, pts: [[73, 15], [74, 40]] },
  { name: 'Rua da Laje', kind: K_STREET, hw: 2.4, pts: [[78, 40], [78.5, 98]] },
  { name: 'Rua da Laje', kind: K_STREET, hw: 2.4, pts: [[74, 98], [74, 125]] },
  { name: 'Travessa Boa Vista', kind: K_STREET, hw: 2.5, pts: [[104, 15], [103, 40]] },
  { name: 'Travessa Boa Vista', kind: K_STREET, hw: 2.5, pts: [[108, 40], [108.5, 98]] },
  { name: 'Travessa Boa Vista', kind: K_STREET, hw: 2.5, pts: [[104, 98], [104, 136]] },
  { name: 'Ladeira do Alto', kind: K_STREET, hw: 2.6, pts: sampled(96, 127, x => 127 - (x - 96) * 0.06, 3) },
  { name: 'Caminho do Alto', kind: K_STREET, hw: 2.2, pts: [[96, 114], [96, 136]] },
  // becos e vielas (mais estreitos, mas sem aperto)
  { name: 'Beco do Gato', kind: K_BECO, hw: 1.25, pts: [[31, 22], [38, 22], [38, 27], [47, 27]] },
  { name: 'Beco da Dona Cida', kind: K_BECO, hw: 1.25, pts: [[51.5, 66], [60, 66], [60, 70], [78, 70]] },
  { name: 'Beco do Varal', kind: K_BECO, hw: 1.2, pts: [[78.5, 82], [90, 82], [90, 78], [108, 78]] },
  { name: 'Beco da Antena', kind: K_BECO, hw: 1.2, pts: [[104, 22], [115, 22], [115, 18], [127, 18]] },
  { name: 'Beco do Pagode', kind: K_BECO, hw: 1.2, pts: [[108.5, 60], [118, 60], [118, 64], [127, 64]] },
  { name: 'Beco da Bica', kind: K_BECO, hw: 1.25, pts: [[31, 116], [40, 116], [40, 120], [47, 120]] },
  { name: 'Escadinha do Sapo', kind: K_BECO, hw: 1.2, pts: [[60, 98], [60, 108], [64, 108], [64, 132]] },
  { name: 'Escadinha da Fé', kind: K_BECO, hw: 1.2, pts: [[86, 98], [86, 110], [82, 110], [82, 133]] },
  { name: 'Beco do Mirante', kind: K_BECO, hw: 1.2, pts: [[78.5, 50], [92, 50], [92, 46], [108, 46]] },
  { name: 'Beco do Quartel', kind: K_BECO, hw: 1.2, pts: [[110, 14], [127, 14]] },
];
function segDist(px, pz, a, b) { const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz; let t = l2 ? ((px - a[0]) * dx + (pz - a[1]) * dz) / l2 : 0; t = clamp(t, 0, 1); const qx = a[0] + dx * t - px, qz = a[1] + dz * t - pz; return Math.sqrt(qx * qx + qz * qz); }
let ESC_LAND = [];   // patamares do escadão: {x, h, hx, hz}
const ESC_X0 = 58, ESC_X1 = 104;
const LAND = [{ x: 67, hx: 2.5, hz: 6, h: 3.5 }, { x: 78, hx: 2.5, hz: 6, h: 7.5 }, { x: 89, hx: 3.5, hz: 7, h: 11.5 }, { x: 100, hx: 3, hz: 6.5, h: 15 }];
const PRACA = { x: 47, z: MID, r: 4.2, x0: 31, x1: ESC_X0, hz: 12 };   // Praça Central (Base A)
const BASEZ = 17;                                                         // bases principais: z dobrado de 2,5 a 17
const SUPPLY = [{ x: 76, z: 3.6 }, { x: 76, z: ML - 3.6 }];            // estação de munição: Azul (sul) e Vermelha (norte)
const CANAL_ST = [];
const FRONTAGE = [[20, 34], [58, 80], [102, 120]]; // trechos onde as casas encostam na calçada da avenida (lojinhas)

function buildMap(seed) {
  const R = mulberry(seed);
  const K = new Uint8Array(NC), H = new Float32Array(NC), HV = new Float32Array(NC), M = new Uint8Array(NC), HID = new Int32Array(NC).fill(-1), SN = new Int16Array(NC).fill(-1);
  const idx = (i, j) => j * GX + i;
  // 1) traçado
  const x0Esc = ESC_X0;
  ESC_LAND = [];
  for (let j = 0; j < GZ; j++) for (let i = 0; i < GX; i++) {
    const x = (i + 0.5) * CELL, z = (j + 0.5) * CELL, zf = foldZ(z), ax = aveX(z), c = idx(i, j), dzm = Math.abs(z - MID);
    if (x < 0.6 || x > MW - 0.6) { K[c] = K_BLOCK; M[c] = B_WALL; continue; }
    if (z < 1 || z > ML - 1) { // limites; na avenida só uma barreira baixa (os carros seguem além do mapa)
      if (x > ax - AVE_HW - SIDEW && x < ax + AVE_HW + SIDEW) { K[c] = K_BLOCK; M[c] = B_JERSEY; } else { K[c] = K_BLOCK; M[c] = B_WALL; } continue; }
    if (x > WATER_X1) { K[c] = K_BLOCK; M[c] = B_WALL; continue; }
    if (x > WALK_X1) { K[c] = K_VOID; continue; }                   // água do canal
    if (x < ax - AVE_HW - SIDEW) { K[c] = K_LOT; continue; }          // lojas do lado oeste
    if (x < ax - AVE_HW) { K[c] = K_WALK; continue; }
    if (x < ax + AVE_HW) { K[c] = K_AVE; continue; }
    if (x < ax + AVE_HW + SIDEW) { K[c] = K_WALK; continue; }
    let k = -1, sn = -1;
    if (x >= WALK_X0 && zf >= 12) { K[c] = K_STREET; SN[c] = -5; continue; }   // beira do valão (rota de flanco)
    if (x >= ESC_X0 && x <= ESC_X1 && dzm <= ESC_HW) k = K_ESC;
    else if (LAND.some(l => Math.abs(x - l.x) <= l.hx && dzm <= l.hz)) k = K_ESC;
    else if (x <= PRACA.x1 && dzm <= PRACA.hz) k = K_PLAZA;                 // Praça Central
    if (k < 0) for (let s = 0; s < STREETS.length; s++) { const S = STREETS[s]; for (let p = 0; p < S.pts.length - 1; p++) if (segDist(x, zf, S.pts[p], S.pts[p + 1]) <= S.hw) { k = S.kind; sn = s; break; } if (k >= 0) break; }
    if (k < 0 && zf >= 1 && zf <= BASEZ && x >= 36 && x <= 118) k = K_PLAZA;   // base principal (encostada no muro do fundo)
    if (k < 0 && x < ax + AVE_HW + SIDEW + 0.6 && !FRONTAGE.some(f => zf >= f[0] && zf <= f[1])) { K[c] = K_BLOCK; M[c] = B_MURO; continue; }
    K[c] = k < 0 ? K_LOT : k; SN[c] = sn;
  }
  // 2) lotes => casas (lotes em grade irregular; a metade norte espelha a sul)
  const rows = []; { let z = 1; while (z < MID) { const d = 5 + R() * 4; const z1 = Math.min(MID, z + d); const cols = []; let x = 0; while (x < 128) { const w = 5 + R() * 3.5; cols.push(Math.min(128, x + w)); x += w; } rows.push({ z0: z, z1, cols }); z = z1; } }
  const westShops = []; { let z = 1; while (z < ML - 1) { const d = 7 + R() * 5; westShops.push(Math.min(ML - 1, z + d)); z += d; } }
  const plotOf = (x, z) => {
    if (x < aveX(z) - AVE_HW - SIDEW) { let k = 0; while (westShops[k] < z) k++; return 100000 + k; }
    const zf = foldZ(z); let r = 0; while (r < rows.length - 1 && rows[r].z1 < zf) r++; const row = rows[r]; let cI = 0; while (cI < row.cols.length - 1 && row.cols[cI] < x) cI++; return (r * 64 + cI) * 2 + (z > MID ? 1 : 0);
  };
  // componentes conectados por lote
  const houses = []; const comp = new Int32Array(NC).fill(-1); const stack = [];
  for (let c = 0; c < NC; c++) {
    if (K[c] !== K_LOT || comp[c] >= 0) continue;
    const i0 = c % GX, j0 = (c / GX) | 0, pid = plotOf((i0 + 0.5) * CELL, (j0 + 0.5) * CELL); const cells = [];
    comp[c] = houses.length; stack.push(c);
    while (stack.length) { const q = stack.pop(); cells.push(q); const qi = q % GX, qj = (q / GX) | 0;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ni = qi + di, nj = qj + dj; if (ni < 0 || nj < 0 || ni >= GX || nj >= GZ) continue; const n = idx(ni, nj); if (K[n] === K_LOT && comp[n] < 0 && plotOf((ni + 0.5) * CELL, (nj + 0.5) * CELL) === pid) { comp[n] = houses.length; stack.push(n); } } }
    houses.push({ id: houses.length, plot: pid, cells, shop: pid >= 100000 });
  }
  // sobras minúsculas viram calçada/beco
  for (const h of houses) if (h.cells.length < 6 && !h.shop) { for (const c of h.cells) { K[c] = K_BECO; comp[c] = -1; } h.dead = true; }
  // 3) alturas do chão
  const escH = x => { // perfil do escadão: lances retos (degraus de 0,5 m) entre patamares planos
    const pts = [{ x: ESC_X0 - 0.5, h: 0, hx: 0 }].concat(LAND);
    for (let p = 1; p < pts.length; p++) if (x <= pts[p].x + pts[p].hx) {
      if (x >= pts[p].x - pts[p].hx) return pts[p].h;
      const a = pts[p - 1], b = pts[p], xa = a.x + a.hx, xb = b.x - b.hx, n = Math.max(1, Math.round((xb - xa) / CELL)), k = clamp(Math.floor((x - xa) / CELL), 0, n - 1);
      return a.h + (b.h - a.h) * (k + 1) / (n + 1);
    }
    return pts[pts.length - 1].h;
  };
  ESC_LAND = LAND.map(l => ({ x: l.x, hx: l.hx, hz: l.hz, h: l.h })); PRACA.h = 0;
  for (let j = 0; j < GZ; j++) for (let i = 0; i < GX; i++) {
    const c = idx(i, j), x = (i + 0.5) * CELL, z = (j + 0.5) * CELL, g = terrain(x, z), k = K[c];
    if (k === K_AVE) H[c] = 0; else if (k === K_WALK) H[c] = 0.15;
    else if (k === K_ESC) H[c] = escH(x);
    else if (SN[c] === -5) H[c] = WALK_H;
    else if (k === K_BECO) H[c] = Math.round(g / 0.3) * 0.3;
    else if (k === K_PLAZA) H[c] = Math.abs(z - MID) <= PRACA.hz + 0.1 && x <= PRACA.x1 + 0.1 ? 0 : Math.round(g / 0.4) * 0.4;
    else H[c] = g;
  }
  // 4) suaviza junções de ruas para nunca exceder o degrau
  const isGround = k => k === K_STREET || k === K_BECO || k === K_PLAZA || k === K_WALK || k === K_AVE || k === K_ESC;
  for (let it = 0; it < 60; it++) { let ch = 0;
    for (let c = 0; c < NC; c++) { const k = K[c]; if (!isGround(k) || k === K_ESC || k === K_AVE || k === K_WALK || SN[c] === -5) continue; const i = c % GX, j = (c / GX) | 0;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= GX || nj >= GZ) continue; const n = idx(ni, nj); if (!isGround(K[n])) continue; const d = H[c] - H[n];
        if (d > 0.42) { H[c] = H[n] + 0.42; ch++; } else if (d < -0.42) { H[c] = H[n] - 0.42; ch++; } } }
    if (!ch) break; }
  // 5) casas: andares, lajes acessíveis e escadas externas
  const prng = p => mulberry(seed * 7 + (p >> 1) * 131 + 17);   // mesmo número para casa e espelho
  const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const h of houses) {
    if (h.dead) continue; const pr = prng(h.shop ? h.plot * 2 : h.plot); const hr = mulberry(seed * 13 + h.id * 7919);
    let gmin = 1e9, gmax = -1e9; for (const c of h.cells) { gmin = Math.min(gmin, H[c]); gmax = Math.max(gmax, H[c]); }
    const fr = pr(); const floors = h.shop ? 1 + Math.floor(pr() * 3) : fr < 0.2 ? 1 : fr < 0.55 ? 2 : fr < 0.85 ? 3 : 4;
    let top = (h.shop ? 0.15 : gmax) + floors * 2.9 + 0.25;
    let sMax = -1e9; const edge = [];
    for (const c of h.cells) { const i = c % GX, j = (c / GX) | 0; for (let d = 0; d < 4; d++) { const ni = i + DIRS4[d][0], nj = j + DIRS4[d][1]; if (ni < 0 || nj < 0 || ni >= GX || nj >= GZ) continue; const n = idx(ni, nj); if (isGround(K[n]) && K[n] !== K_AVE) { sMax = Math.max(sMax, H[n]); edge.push({ c, n, d }); } } }
    h.gmin = gmin; h.floors = floors; h.access = 0;
    if (!h.shop && pr() < 0.62 && sMax - gmin >= 2.5 && sMax >= gmax - 0.8) { top = sMax; h.access = 1; }
    h.top = Math.round(top * 20) / 20;
    h.style = { tint: hr(), win: hr(), door: hr(), brick: !h.shop && hr() < 0.2, tank: hr(), obra: hr() };
    h.edge = edge; h.pr = pr;
    for (const c of h.cells) { K[c] = K_ROOF; H[c] = h.top; HID[c] = h.id; }
  }
  // paredão do grafite: casas dos dois lados do 2º lance do escadão ficam altas
  for (const h of houses) {
    if (h.dead || h.shop) continue; let need = -1;
    for (const c of h.cells) { const i = c % GX, j = (c / GX) | 0, x = (i + 0.5) * CELL, z = (j + 0.5) * CELL, dz = Math.abs(z - MID);
      if (x >= ESC_X0 && x <= ESC_X0 + 1.5 && dz > ESC_HW && dz <= PRACA.hz + 0.5) need = Math.max(need, 6.6);            // fachadas de frente para a praça (grafite)
      if (x >= LAND[0].x + LAND[0].hx && x <= LAND[0].x + LAND[0].hx + 1 && dz > ESC_HW && dz <= LAND[0].hz) need = Math.max(need, LAND[0].h + 2.9); // bandeiras do 1º patamar
      if (x >= 69.5 && x <= 76 && (j === 286 || j === 273)) need = Math.max(need, escH(76) + 3.4); }
    if (need > 0 && h.top < need) { h.top = Math.round(need * 20) / 20; h.access = 0; for (const c of h.cells) H[c] = h.top; }
    if (need > 0) h.mural = true;
  }
  // escadas externas para lajes (passagens às lajes)
  for (const h of houses) {
    if (h.dead || h.shop || h.access || h.mural || h.pr() > 0.6) continue;
    const runs = new Map();
    for (const e of h.edge) { const i = e.c % GX, j = (e.c / GX) | 0; const key = e.d + ':' + (e.d < 2 ? i : j); if (!runs.has(key)) runs.set(key, []); runs.get(key).push(e); }
    let best = null;
    for (const [key, list] of runs) { const d = +key.split(':')[0]; list.sort((a, b) => d < 2 ? (a.c / GX | 0) - (b.c / GX | 0) : (a.c % GX) - (b.c % GX));
      let run = [list[0]]; for (let q = 1; q < list.length; q++) { const prev = run[run.length - 1], cur = list[q]; const cont = d < 2 ? (cur.c - prev.c === GX) : (cur.c - prev.c === 1); if (cont) run.push(cur); else { if (!best || run.length > best.run.length) best = { run, d }; run = [cur]; } }
      if (!best || run.length > best.run.length) best = { run, d }; }
    if (!best) continue;
    const run = best.run, sh = H[run[0].n];
    let rise = h.top - sh, n = Math.ceil(rise / 0.46);
    if (run.length < n + 2) { // vira casa de um andar (puxadinho) com escada externa
      let gmax = -1e9; for (const c of h.cells) gmax = Math.max(gmax, terrain(((c % GX) + 0.5) * CELL, ((c / GX | 0) + 0.5) * CELL));
      const t1 = Math.round((Math.max(gmax, sh) + 3.15) * 20) / 20; const r1 = t1 - sh, n1 = Math.ceil(r1 / 0.46);
      if (run.length < n1 + 2 || t1 >= h.top) continue; h.top = t1; for (const c of h.cells) H[c] = t1; rise = r1; n = n1; }
    if (rise < 2.5) continue;
    const di = DIRS4[best.d][0], dj = DIRS4[best.d][1];
    for (let q = 0; q < n; q++) { const c = run[q].c, hh = sh + rise * (q + 1) / (n + 1); const ci = c % GX, cj = (c / GX) | 0, inner = idx(ci - di, cj - dj);
      K[c] = K_ESC; H[c] = hh; HID[c] = -2; M[c] = 1;
      if (HID[inner] === h.id) { K[inner] = K_ESC; H[inner] = hh; HID[inner] = -2; M[inner] = 1; } }
    h.access = 2;
  }
  // 6) blocos: caixas-d'água nas lajes (servem de cobertura)
  for (const h of houses) {
    if (h.dead || h.shop || h.style.tank > 0.55) continue;
    const set = new Set(h.cells.filter(c => K[c] === K_ROOF));
    const inner = h.cells.filter(c => { if (!set.has(c)) return false; const i = c % GX, j = (c / GX) | 0; for (let a = -2; a <= 3; a++) for (let b = -2; b <= 3; b++) { if (!set.has(idx(i + a, j + b))) return false; } return true; });
    if (!inner.length) continue;
    const c = inner[Math.floor(h.style.tank * 997) % inner.length], i = c % GX, j = (c / GX) | 0;
    for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const q = idx(i + a, j + b); K[q] = K_BLOCK; M[q] = h.style.tank < 0.3 ? B_TANK : B_TANK2; H[q] = h.top + 1.15; HV[q] = H[q]; }
  }
  for (let c = 0; c < NC; c++) { if (K[c] === K_BLOCK && M[c] === B_MURO) H[c] = 2.2; if (K[c] === K_BLOCK && M[c] === B_GUARD) H[c] = terrain(((c % GX) + 0.5) * CELL, ((c / GX | 0) + 0.5) * CELL) + 1.1; if (K[c] === K_BLOCK && M[c] === B_WALL) { const x = ((c % GX) + 0.5) * CELL, z = ((c / GX | 0) + 0.5) * CELL; H[c] = Math.max(5.5, terrain(x, clamp(z, 1.5, 158.5)) + 4.5); } if (K[c] === K_VOID) H[c] = ((c % GX) + 0.5) * CELL > WALK_X1 ? -1.2 : terrain(((c % GX) + 0.5) * CELL, ((c / GX | 0) + 0.5) * CELL); }
  const cover = (x0, z0, x1, z1, mat, hgt) => { for (const mz of [false, true]) for (let j = Math.floor((mz ? ML - z1 : z0) / CELL); j < Math.ceil((mz ? ML - z0 : z1) / CELL); j++) for (let i = Math.floor(x0 / CELL); i < Math.ceil(x1 / CELL); i++) { const c = idx(i, j); if (!WALKABLE[K[c]]) continue; const base = H[c]; K[c] = K_BLOCK; M[c] = mat; H[c] = base + hgt; } };
  cover(LAND[0].x - 1, MID - 5.5, LAND[0].x, MID - 4.5, B_SAND, 1.0);                       // sacos de areia no 1º patamar
  cover(38, MID - 9, 39, MID - 8, B_BRICKS, 1.15); cover(52, MID - 9, 53, MID - 8, B_BRICKS, 1.15); cover(44, MID - 4, 45.5, MID - 3.5, B_JERSEY, 1.0); // praça
  for (const zb of [30, 55, 80, 105, 125]) cover(130.5, zb, 131, zb + 0.5, B_BARREL, 1.0);  // barris na beira do valão
  cover(127, 70, 128, 70.5, B_SAND, 0.9); cover(127, 116, 128, 116.5, B_SAND, 0.9);
  cover(56, 12, 60, 12.5, B_JERSEY, 1.0); cover(90, 12, 94, 12.5, B_JERSEY, 1.0); cover(72, 15, 73, 15.5, B_BRICKS, 1.1); // cobertura nas bases
  cover(SUPPLY[0].x - 0.75, 2.5, SUPPLY[0].x + 0.75, 3.0, B_SUPPLY, 1.0);          // caixas de munição nas bases principais
  for (let c = 0; c < NC; c++) HV[c] = (K[c] === K_BLOCK && M[c] === B_SUPPLY) ? H[c] - 1.0 : H[c];
  const map = { K, H, HV, M, HID, SN, houses, idx, decor: [], poles: [], cars: [], lamps: [], seed, x0Esc };
  placeProps(map, R);
  return map;
}

// postes, carros estacionados e outros objetos com colisão
function placeProps(map, R) {
  const { K, H, HV, M, idx } = map;
  const blockAt = (x0, z0, x1, z1, top) => { const cells = []; for (let j = Math.floor(z0 / CELL); j <= Math.floor((z1 - 1e-3) / CELL); j++) for (let i = Math.floor(x0 / CELL); i <= Math.floor((x1 - 1e-3) / CELL); i++) { if (i < 0 || j < 0 || i >= GX || j >= GZ) continue; const c = idx(i, j); cells.push(c); } return cells; };
  // carros estacionados nas duas faixas de estacionamento da avenida
  const CAR_COL = [[0.85, 0.85, 0.82], [0.2, 0.22, 0.25], [0.62, 0.1, 0.1], [0.75, 0.75, 0.78], [0.15, 0.3, 0.55], [0.9, 0.75, 0.2], [0.3, 0.45, 0.3], [0.95, 0.95, 0.95]];
  // ônibus parados e barreiras de concreto (New Jersey) na entrada do escadão
  for (const zc of [70, ML - 70]) { const ax = aveX(zc), xc = ax + PARK_X, cells = blockAt(xc - 1.25, zc - 5.5, xc + 1.25, zc + 5.5);
    if (cells.every(c => K[c] === K_AVE)) { for (const c of cells) { K[c] = K_BLOCK; M[c] = B_INVIS; HV[c] = 0; H[c] = 3.0; } map.cars.push({ x: xc, z: zc, bus: true, col: [0.2, 0.45, 0.85] }); } }
  for (const side of [-1, 1]) { let z = 6 + R() * 4; while (z < ML - 8) {
      if (Math.abs(z + 2.2 - MID) < 16) { z += 6; continue; }
      if (R() < 0.62) { const zc = z + 2.2, ax = aveX(zc), xc = ax + side * PARK_X; const cells = blockAt(xc - 0.9, zc - 2.1, xc + 0.9, zc + 2.1);
        if (cells.every(c => K[c] === K_AVE)) { for (const c of cells) { K[c] = K_BLOCK; M[c] = B_INVIS; HV[c] = 0; H[c] = 1.45; } map.cars.push({ x: xc, z: zc, rot: side > 0 ? 0 : Math.PI, col: CAR_COL[Math.floor(R() * CAR_COL.length)], van: R() < 0.2 }); } }
      z += 5.5 + R() * 4; } }
  // árvores na calçada oeste
  map.trees = [];
  { let z = 8 + R() * 5; while (z < ML - 8) { const x = aveX(z) - AVE_HW - 1.6, c = idx(Math.floor(x / CELL), Math.floor(z / CELL)); if (K[c] === K_WALK) { K[c] = K_BLOCK; M[c] = B_INVIS; HV[c] = H[c]; H[c] = 3.2; map.trees.push({ x: (Math.floor(x / CELL) + 0.5) * CELL, z: (Math.floor(z / CELL) + 0.5) * CELL, s: 0.8 + R() * 0.5 }); } z += 9 + R() * 8; } }
  // postes ao longo das ruas mais largas
  const isStreetC = c => K[c] === K_STREET || K[c] === K_WALK;
  const taken = [];
  for (let j = 2; j < GZ - 2; j++) for (let i = 2; i < GX - 2; i++) {
    const c = idx(i, j); if (!isStreetC(c)) continue; const x = (i + 0.5) * CELL, z = (j + 0.5) * CELL;
    if (K[c] === K_WALK && !(x > aveX(z) + AVE_HW)) continue;
    let wallN = 0; for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = idx(i + a, j + b); if (K[n] === K_ROOF || (K[n] === K_BLOCK && M[n] !== B_INVIS)) wallN++; }
    if (wallN !== 1) continue;
    // a rua precisa ficar com pelo menos 2,5 m livres
    let free = 0; for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { let s = 0; for (let q = 1; q <= 6; q++) { const n = idx(i + a * q, j + b * q); if (WALKABLE[K[n]]) s++; else break; } free = Math.max(free, s); }
    if (free < 5) continue;
    if (taken.some(p => (p.x - x) ** 2 + (p.z - z) ** 2 < (K[c] === K_WALK ? 196 : 121))) continue;
    if (h2(i, j, 5) < 0.35) continue;
    const ave = K[c] === K_WALK; taken.push({ x, z }); K[c] = K_BLOCK; M[c] = B_INVIS; HV[c] = H[c]; const base = H[c]; H[c] = base + 7.5; map.poles.push({ x, z, base, ave });
  }
}

// ---------- colisão, raios e navegação ----------
function makeWorld(map) {
  const { K, H } = map;
  const blockedAt = (x, z) => { const i = Math.floor(x / CELL), j = Math.floor(z / CELL); if (i < 0 || j < 0 || i >= GX || j >= GZ) return true; return !WALKABLE[K[j * GX + i]]; };
  const hCell = (x, z) => { const i = Math.floor(x / CELL), j = Math.floor(z / CELL); if (i < 0 || j < 0 || i >= GX || j >= GZ) return 99; return H[j * GX + i]; };
  const OFF = [-1, 0, 1];
  // obstáculos móveis (carros) ficam em this.dyn: cada sala tem a sua lista (veja fork())
  function fitsD(dyn, x, z, feet, r) { for (const a of OFF) for (const b of OFF) { const px = x + a * r, pz = z + b * r; if (blockedAt(px, pz)) return false; if (hCell(px, pz) > feet + STEP_UP) return false; }
    for (const d of dyn) if (x + r > d.x0 && x - r < d.x1 && z + r > d.z0 && z - r < d.z1 && d.top > feet + STEP_UP) return false; return true; }
  function rayDyn(ox, oy, oz, dx, dy, dz, maxT) { let best = maxT; for (const d of this.dyn) { let t0 = 0, t1 = best; for (const [o, v, lo, hi] of [[ox, dx, d.x0, d.x1], [oy, dy, 0.25, d.top], [oz, dz, d.z0, d.z1]]) { if (Math.abs(v) < 1e-9) { if (o < lo || o > hi) { t0 = 1; t1 = 0; break; } continue; } let a = (lo - o) / v, b = (hi - o) / v; if (a > b) { const q = a; a = b; b = q; } t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) break; } if (t0 <= t1 && t0 < best) best = t0; } return best; }
  function groundAt(x, z, r) { let g = -99; for (const a of OFF) for (const b of OFF) { const px = x + a * r, pz = z + b * r; if (blockedAt(px, pz)) continue; g = Math.max(g, hCell(px, pz)); } return g; }
  // move um ator (pés em a.y) com deslizamento nas paredes
  function fits(x, z, feet, r) { return fitsD(this.dyn, x, z, feet, r); }
  function move(a, vx, vz, dt) {
    const dyn = this.dyn;
    const r = 0.3, dist = Math.hypot(vx, vz) * dt, n = Math.max(1, Math.ceil(dist / 0.18)); let hitWall = false;
    for (let s = 0; s < n; s++) {
      const dx = vx * dt / n, dz = vz * dt / n;
      if (dx) { if (fitsD(dyn, a.x + dx, a.z, a.y, r)) a.x += dx; else hitWall = true; }
      if (dz) { if (fitsD(dyn, a.x, a.z + dz, a.y, r)) a.z += dz; else hitWall = true; }
      const g = groundAt(a.x, a.z, r); if (a.onGround && g > a.y && g <= a.y + STEP_UP + 0.01) a.y = g;
    }
    const g = groundAt(a.x, a.z, r);
    if (a.vy > 0 || a.y > g + 0.02) { a.onGround = false; a.vy -= 19.6 * dt; a.y += a.vy * dt; if (a.y <= g) { a.y = g; a.vy = 0; a.onGround = true; } }
    else { a.y = g; a.vy = 0; a.onGround = true; }
    return hitWall;
  }
  // raio em DDA pela grade: devolve {t, face}
  function ray(ox, oy, oz, dx, dy, dz, maxT) {
    let i = Math.floor(ox / CELL), j = Math.floor(oz / CELL);
    const si = dx > 0 ? 1 : -1, sj = dz > 0 ? 1 : -1;
    const tdi = dx ? Math.abs(CELL / dx) : Infinity, tdj = dz ? Math.abs(CELL / dz) : Infinity;
    let tmi = dx ? (dx > 0 ? (i + 1) * CELL - ox : ox - i * CELL) / Math.abs(dx) : Infinity;
    let tmj = dz ? (dz > 0 ? (j + 1) * CELL - oz : oz - j * CELL) / Math.abs(dz) : Infinity;
    let t0 = 0, face = 0;
    for (let it = 0; it < 4000; it++) {
      const t1 = Math.min(tmi, tmj, maxT), inside = i >= 0 && j >= 0 && i < GX && j < GZ, h = inside ? H[j * GX + i] : -0.03;
      const ya = oy + dy * t0, yb = oy + dy * t1;
      if (ya <= h) return { t: t0, face, i, j };
      if (yb <= h) return { t: (h - oy) / dy, face: 0, i, j };
      if (t1 >= maxT) return null;
      if (tmi < tmj) { t0 = tmi; tmi += tdi; i += si; face = 1; } else { t0 = tmj; tmj += tdj; j += sj; face = 2; }
    }
    return null;
  }
  function los(ax, ay, az, bx, by, bz) { const dx = bx - ax, dy = by - ay, dz = bz - az, d = Math.hypot(dx, dy, dz); if (d < 0.01) return true; const h = ray(ax, ay, az, dx / d, dy / d, dz / d, d); return !h; }
  // navegação
  const OK = new Uint8Array(NC);
  for (let c = 0; c < NC; c++) { if (!WALKABLE[K[c]]) continue; const i = c % GX, j = (c / GX) | 0; if (i < 1 || j < 1 || i >= GX - 1 || j >= GZ - 1) continue; let ok = 1; for (let a = -1; a <= 1 && ok; a++) for (let b = -1; b <= 1; b++) { const n = (j + b) * GX + i + a; if (!WALKABLE[K[n]] || H[n] > H[c] + 0.5) { ok = 0; break; } } OK[c] = ok; }
  const N8 = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
  function edges(c, cb, anyDrop) { const i = c % GX, j = (c / GX) | 0;
    for (const [a, b, w] of N8) { const ni = i + a, nj = j + b; if (ni < 0 || nj < 0 || ni >= GX || nj >= GZ) continue; const n = nj * GX + ni; if (!OK[n]) continue; const dh = H[n] - H[c]; if (dh > NAV_STEP) continue; if (!anyDrop && -dh > NAV_DROP) continue;
      if (a && b) { const o1 = j * GX + ni, o2 = nj * GX + i; if (!OK[o1] || !OK[o2] || H[o1] - H[c] > NAV_STEP || H[o2] - H[c] > NAV_STEP) continue; }
      cb(n, w * CELL + (dh < -1 ? 1.5 : 0)); } }
  const gS = new Float32Array(NC), from = new Int32Array(NC), st = new Uint32Array(NC), cl = new Uint32Array(NC); let gen = 1;
  const hN = new Int32Array(600000), hF = new Float32Array(600000); let hs = 0;
  const push = (n, f) => { if (hs >= hN.length) return; let k = hs++; while (k > 0) { const p = (k - 1) >> 1; if (hF[p] <= f) break; hN[k] = hN[p]; hF[k] = hF[p]; k = p; } hN[k] = n; hF[k] = f; };
  const pop = () => { const r = hN[0]; hs--; if (hs > 0) { const n = hN[hs], f = hF[hs]; let k = 0; for (;;) { let c = 2 * k + 1; if (c >= hs) break; if (c + 1 < hs && hF[c + 1] < hF[c]) c++; if (hF[c] >= f) break; hN[k] = hN[c]; hF[k] = hF[c]; k = c; } hN[k] = n; hF[k] = f; } return r; };
  function path(s, gl, maxExp) {
    if (!OK[s] || !OK[gl]) return null; gen++; hs = 0; const gi = gl % GX, gj = (gl / GX) | 0;
    const hfn = n => { const dx = Math.abs(n % GX - gi), dz = Math.abs(((n / GX) | 0) - gj); return (Math.max(dx, dz) + 0.414 * Math.min(dx, dz)) * CELL; };
    st[s] = gen; gS[s] = 0; from[s] = -1; push(s, hfn(s)); let exp = 0;
    while (hs > 0) { const c = pop(); if (cl[c] === gen) continue; cl[c] = gen; if (c === gl) break; if (++exp > (maxExp || 40000)) return null;
      const gc = gS[c]; edges(c, (n, w) => { if (cl[n] === gen) return; const ng = gc + w; if (st[n] !== gen || ng < gS[n]) { st[n] = gen; gS[n] = ng; from[n] = c; push(n, ng + hfn(n) * 1.6); } }); }
    if (cl[gl] !== gen) return null; const out = []; let c = gl; while (c >= 0) { out.push(c); c = from[c]; } out.reverse(); return out;
  }
  function nearestOK(x, z, maxR) { const i0 = Math.floor(x / CELL), j0 = Math.floor(z / CELL); for (let r = 0; r <= (maxR || 8); r++) for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) { if (Math.max(Math.abs(a), Math.abs(b)) !== r) continue; const i = i0 + a, j = j0 + b; if (i < 0 || j < 0 || i >= GX || j >= GZ) continue; const c = j * GX + i; if (OK[c]) return c; } return -1; }
  function reach(start, anyDrop, reverse) { const seen = new Uint8Array(NC), q = [start]; seen[start] = 1;
    if (!reverse) { while (q.length) { const c = q.pop(); edges(c, n => { if (!seen[n]) { seen[n] = 1; q.push(n); } }, anyDrop); } return seen; }
    // reverso: quem consegue chegar em start
    const pred = []; for (let c = 0; c < NC; c++) if (OK[c]) edges(c, n => { (pred[n] || (pred[n] = [])).push(c); }, anyDrop);
    while (q.length) { const c = q.pop(); const p = pred[c]; if (p) for (const n of p) if (!seen[n]) { seen[n] = 1; q.push(n); } } return seen; }
  const cellX = c => ((c % GX) + 0.5) * CELL, cellZ = c => (((c / GX) | 0) + 0.5) * CELL;
  // fork(): mesma geometria e navegação (somente leitura), mas obstáculos móveis próprios — uma por sala no servidor
  const W = { dyn: [], cache: {}, rayDyn, move, ray, los, fits, groundAt, blockedAt, hCell, OK, path, nearestOK, reach, cellX, cellZ, edges, fork() { return Object.assign({}, this, { dyn: [] }); } };
  return W;
}

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

const API = { CONFIG, TEAM, BOT_NAMES, DIFF_FPS, CELL, GX, GZ, NC, MW, ML, K_VOID, K_AVE, K_WALK, K_STREET, K_ESC, K_BECO, K_ROOF, K_BLOCK, K_PLAZA, WALKABLE,
  B_MURO, B_TANK, B_GUARD, B_WALL, B_INVIS, B_TANK2, B_SAND, B_JERSEY, B_BRICKS, B_BARREL, B_SUPPLY, STEP_UP,
  buildMap, makeWorld, makeGame, terrain, aveX, foldZ, mulberry, h2, clamp, sm, lerp, angDiff, STREETS, SUPPLY, PRACA, CANAL_ST, WALK_X0, WALK_X1, WALK_H, STATION, MID, AVE_HW, SIDEW, LANE_X, PARK_X, ESC_HW, ESC_X0, ESC_X1, BASEZ, WATER_X1, aveEast,
  get ESC_LAND() { return ESC_LAND; } };
if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.EscSim = API;
})(typeof window !== 'undefined' ? window : globalThis);
