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
