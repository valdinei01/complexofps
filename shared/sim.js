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
// Reconstrução a partir do MAPA OFICIAL (imagem de referência). Coordenadas da imagem (px) viram metros:
// x = px * 0,1875 (leste) e z = (940 - py) * 0,1875 (norte). Mapa: 312 m (leste-oeste) x 176 m (norte-sul) — ampliado 25% em cada direção.
const CELL = 0.5, MW = 312, ML = 176, GX = 624, GZ = 352, NC = GX * GZ, MID = 88;
const SC = 1.25; // escala das coordenadas em metros do traçado original (ruas, escadão, morros, quadra)
const SCP = a => a.map(q => [q[0] * SC, q[1] * SC]);
const K_VOID = 0, K_AVE = 1, K_WALK = 2, K_STREET = 3, K_ESC = 4, K_BECO = 5, K_ROOF = 6, K_BLOCK = 7, K_PLAZA = 8, K_LOT = 9, K_TRAIL = 10, K_MATA = 11;
const WALKABLE = new Uint8Array([0, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1, 1]);
// materiais de bloco
const B_MURO = 1, B_TANK = 2, B_GUARD = 3, B_WALL = 4, B_INVIS = 5, B_TANK2 = 6, B_SAND = 7, B_JERSEY = 8, B_BRICKS = 9, B_BARREL = 10, B_SUPPLY = 11, B_ROCK = 12, B_FENCE = 13, B_MODEL = 14;
const STEP_UP = 0.55, NAV_STEP = 0.5, NAV_DROP = 3.4;
const PXS = 0.1875, P = (px, py) => [px * PXS, (940 - py) * PXS], PL = a => a.map(q => P(q[0], q[1]));
// ---- catálogo de setores da imagem (px) ----
const AVE_PTS = PL([[1215, -80], [1205, 0], [1195, 120], [1150, 230], [1065, 330], [1020, 420], [985, 520], [930, 620], [870, 720], [820, 820], [790, 940], [780, 1020]]);
const CANAL_PTS = PL([[1300, -80], [1290, 40], [1270, 150], [1215, 260], [1140, 360], [1095, 450], [1055, 560], [1005, 660], [965, 760], [935, 860], [915, 940], [910, 1020]]);
const AVE_HW = 3.6, SIDEW = 2.0, LANE_X = 1.8, PARK_X = 0;      // uma faixa em cada sentido
const CAN_HW = 2.6, CAN_WALL = 0.5, BANK_W = 1.8, WALK_H = 0.25;  // canal: água, contenção e margens
const BOTTOM_ROAD = PL([[480, 760], [480, 780], [486, 842], [545, 872], [700, 872], [790, 872], [1000, 872], [1150, 866], [1250, 840], [1286, 800], [1286, 773]]);
const BRIDGES = [PL([[1178, 212], [1272, 232]]), PL([[1046, 466], [1124, 466]]), PL([[978, 632], [1052, 642]])];
const POLY_LEFT = PL([[0, 255], [120, 232], [230, 252], [330, 300], [385, 362], [430, 432], [470, 520], [560, 562], [640, 640], [705, 700], [745, 765], [735, 850], [700, 945], [0, 945]]);
const POLY_RIGHT = PL([[1150, 250], [1232, 232], [1335, 250], [1420, 298], [1560, 318], [1675, 330], [1675, 945], [955, 945], [985, 800], [1035, 690], [1075, 560], [1118, 452], [1168, 352]]);
const CLEAR = { // clareiras e praças: centro (m), raios (m), altura do piso
  azul: { c: P(360, 160), rx: 21.875, rz: 13.75, h: 4.5, name: 'Base Azul (Alto da Mata)' },
  A: { c: [163, 133], rx: 12, rz: 10, h: 1.2, name: 'Base A (Coração da Mata)' },
  B: { c: [16 * SC, 35 * SC], rx: 11.5, rz: 9.8, h: 0, name: 'Largo da Serra (Base B)' },
  clN: { c: P(820, 200), rx: 17.5, rz: 11.25, h: 3 },   // antiga clareira do norte: continua como clareira, sem base
  verm: { c: P(1510, 182), rx: 23.125, rz: 13.75, h: 4.5, name: 'Base Vermelha (Morro do Cruzeiro)' },
  praca: { c: P(430, 712), rx: 17.5, rz: 12.5, h: 0, name: 'Praça Central' },
  C: { c: P(1225, 716), rx: 9.375, rz: 6.875, h: 0, name: 'Pracinha do Canal' },
  cl1: { c: P(600, 420), rx: 7.5, rz: 6.25, h: null }, cl2: { c: P(700, 615), rx: 6.875, rz: 5.625, h: null },
};
const QUADRA = { x: 224 * SC, z: 56 * SC, hx: 13, hz: 8, h: 0.8 };   // Quadra do Baile (piso 26 x 16 m)
const STAGE = { x: QUADRA.x, z: QUADRA.z + 11.7, hx: 5, hz: 2.2, h: 1.7 };     // palco ao norte da quadra
const SOUND_DESK = { x: STAGE.x, z: STAGE.z - 1 };                        // mesa de som do baile (em cima do palco)
// Malha organizada de ruas (em metros). Regra: toda rua e todo beco terminam em outra rua, numa praça ou na mata —
// não existe beco sem saída (há um teste automático que confere isso).
const SEG = (name, kind, hw, pts) => ({ name, kind, hw, pts: SCP(pts) });
const STREETS = [
  // ---- Favela do Escadão (esquerda) ----
  SEG('Rua da Mina', K_STREET, 2.7, [[3, 10.2], [82, 10.2]]),
  SEG('Rua da Serra', K_STREET, 2.6, [[4, 10.2], [4, 108]]),
  SEG('Rua da Praça', K_STREET, 2.9, [[4, 26], [60, 26]]),
  SEG('Rua do Escadão', K_STREET, 2.7, [[4, 44], [50, 44]]),
  SEG('Rua da Vila', K_STREET, 2.6, [[4, 62], [44, 62]]),
  SEG('Travessa da Serra', K_STREET, 2.4, [[24, 10.2], [24, 62]]),
  SEG('Travessa do Meio', K_STREET, 2.3, [[44, 44], [44, 62]]),
  SEG('Rua da Mata', K_STREET, 2.7, [[78, 30], [112, 30]]),
  SEG('Travessa do Mato', K_STREET, 2.4, [[88, 10.2], [88, 56]]),
  SEG('Travessa da Ponta', K_STREET, 2.3, [[100, 10.2], [100, 44]]),
  SEG('Beco da Mina', K_BECO, 1.8, [[58, 10.2], [58, 27]]),
  SEG('Beco do Varal', K_BECO, 1.8, [[14, 10.2], [14, 26]]),
  SEG('Beco da Bica', K_BECO, 1.8, [[4, 52], [24, 52]]),
  SEG('Beco do Sapo', K_BECO, 1.8, [[34, 26], [34, 44]]),
  SEG('Beco do Largo', K_BECO, 1.8, [[4, 35], [9, 35]]),
  SEG('Rua do Alto', K_STREET, 3.1, [[27, 86], [27, 108]]),
  SEG('Ladeira do Alto', K_STREET, 2.9, [[22, 77], [4, 77]]),
  // ---- Favela do Valão (direita) ----
  SEG('Rua do Valão', K_STREET, 2.7, [[150, 10], [246, 10]]),
  SEG('Rua das Lajes', K_STREET, 2.7, [[149, 26], [246, 26]]),
  SEG('Rua Vila Nova', K_STREET, 2.7, [[156, 46], [246, 46]]),
  SEG('Rua da Quadra', K_STREET, 2.7, [[176, 86], [246, 86]]),
  SEG('Travessa do Canal', K_STREET, 2.5, [[176, 10], [176, 86]]),
  SEG('Travessa do Baile', K_STREET, 2.5, [[205, 10], [205, 86]]),
  SEG('Travessa do Topo', K_STREET, 2.5, [[230, 10], [230, 86]]),
  SEG('Rua do Cruzeiro', K_STREET, 2.6, [[246, 10], [246, 95]]),
  SEG('Beco da Quadra', K_BECO, 1.9, [[176, 66], [205, 66]]),
  SEG('Beco do Baile', K_BECO, 1.9, [[205, 58], [214, 58]]),
  SEG('Beco do Pagode', K_BECO, 1.9, [[205, 74], [230, 74], [230, 86]]),
  SEG('Beco da Vila Nova', K_BECO, 1.8, [[230, 64], [246, 64]]),
  SEG('Beco do Topo', K_BECO, 1.8, [[190, 26], [190, 46]]),
];
const TRAILS = [ // trilhas de terra na mata
  { name: 'Trilha da Mata', pts: PL([[445, 172], [520, 118], [600, 92], [680, 150], [735, 190]]) },
  { name: 'Trilha do Alto', pts: PL([[335, 228], [280, 240], [205, 248]]) },
  { name: 'Trilha da Avenida', pts: PL([[905, 222], [960, 250], [1020, 300], [1062, 322]]) },
  { name: 'Trilha Central', pts: PL([[800, 270], [700, 360], [640, 450], [580, 540], [520, 622], [480, 662]]) },
  { name: 'Trilha do Sul', pts: PL([[600, 560], [700, 600], [800, 640], [890, 650]]) },
  { name: 'Trilha Norte', pts: PL([[760, 128], [840, 62], [950, 40], [1060, 70], [1150, 100]]) },
  { name: 'Trilha do Cruzeiro', pts: PL([[1300, 367], [1300, 255], [1350, 210], [1400, 190]]) },
  { name: 'Trilha da Base A', pts: [[163, 133], [170, 118], [176, 104], [182.5, 89]] },
  { name: 'Trilha do Meio', pts: [[163, 133], [148, 112], [140, 84], [150, 56]] },
  { name: 'Trilha de Cima', pts: [[163, 133], [174.75, 138.4]] },
  { name: 'Trilha da Vila', pts: [[163, 133], [140, 120], [118, 108], [90, 102]] },
  { name: 'Trilha da Ponte', pts: PL([[1178, 214], [1110, 210], [1040, 206], [960, 200], [932, 198]]) },
];
// Escadão Principal: lances retos e patamares (sobe da Praça Central até o Alto do Escadão)
const ESC = {
  flights: [{ ax: 'z', x0: 63.75, x1: 71.25, a0: 55.625, a1: 71.25, h0: 0, h1: 1.7 }, { ax: 'z', x0: 63.75, x1: 71.25, a0: 76.25, a1: 88.75, h0: 1.7, h1: 3.4 }, { ax: 'x', z0: 88.125, z1: 95.625, a0: 55, a1: 42.5, h0: 3.4, h1: 5 }],
  lands: [{ x0: 60, x1: 75, z0: 46.875, z1: 55.625, h: 0 }, { x0: 62.5, x1: 72.5, z0: 71.25, z1: 76.25, h: 1.7 }, { x0: 55, x1: 72.5, z0: 88.75, z1: 95.625, h: 3.4 }, { x0: 27.5, x1: 42.5, z0: 85, z1: 107.5, h: 5 }],
};
let ESC_LAND = ESC.lands.map(l => ({ x: (l.x0 + l.x1) / 2, z: (l.z0 + l.z1) / 2, hx: (l.x1 - l.x0) / 2, hz: (l.z1 - l.z0) / 2, h: l.h }));
const PRACA = { x: CLEAR.praca.c[0], z: CLEAR.praca.c[1], r: 4.5, h: CLEAR.praca.h };
const SUPPLY = [{ x: CLEAR.azul.c[0] - 6, z: CLEAR.azul.c[1] + 4.6 }, { x: CLEAR.verm.c[0] + 6, z: CLEAR.verm.c[1] + 4.6 }]; // ponto de reabastecimento (a caixa fica logo ao norte)
const CANAL_ST = [];
// compatibilidade com o código anterior
const WALK_X0 = 0, WALK_X1 = 0, WATER_X1 = 0, ESC_HW = 3, ESC_X0 = 51, ESC_X1 = 57, BASEZ = 0;
const foldZ = z => z;
function segDist(px, pz, a, b) { const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz; let t = l2 ? ((px - a[0]) * dx + (pz - a[1]) * dz) / l2 : 0; t = clamp(t, 0, 1); const qx = a[0] + dx * t - px, qz = a[1] + dz * t - pz; return Math.sqrt(qx * qx + qz * qz); }
function polyDist(x, z, pts) { let d = 1e9; for (let i = 0; i < pts.length - 1; i++) d = Math.min(d, segDist(x, z, pts[i], pts[i + 1])); return d; }
// distância com sinal (positivo a leste da linha) — usado para saber o lado da avenida/canal
function polySide(x, z, pts) { let best = 1e9, side = 1; for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1], d = segDist(x, z, a, b); if (d < best) { best = d; const cr = (b[0] - a[0]) * (z - a[1]) - (b[1] - a[1]) * (x - a[0]); side = cr < 0 ? 1 : -1; } } return best * side; }
function inPoly(x, z, poly) { let ins = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) ins = !ins; } return ins; }
// ponto da avenida para um dado z (as duas vias são "verticais" o bastante para isso)
function lineX(pts, z) { for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1]; if ((z <= a[1] && z >= b[1]) || (z >= a[1] && z <= b[1])) { const t = (z - a[1]) / (b[1] - a[1] || 1); return a[0] + (b[0] - a[0]) * t; } } return pts[pts.length - 1][0]; }
const aveX = z => lineX(AVE_PTS, z);
const aveEast = z => aveX(z) + AVE_HW + SIDEW;
const ellR = (x, z, k) => Math.hypot((x - k.c[0]) / k.rx, (z - k.c[1]) / k.rz);
// relevo: pontos de controle (m) — morros nas bases e no Alto do Escadão, baixada na avenida e no canal
// relevo suave e moderado: morros arredondados (perfil (1-r²)², sem quinas) somados, baixada na avenida e no canal
const HILLS = [[35, 100, 5, 50, 45], [67.5, 146.25, 3.2, 55, 42.5], [12.5, 150, 3, 37.5, 35], [153.75, 137.5, 2.4, 50, 40], [125, 90, 1.8, 47.5, 45], [282.5, 142.5, 3.2, 55, 42.5], [305, 160, 2.6, 35, 30], [295, 57.5, 2.4, 40, 42.5], [267.5, 122.5, 1.8, 37.5, 27.5], [10, 50, 1.6, 32.5, 37.5]];
const hillsAt = (x, z) => { let g = 0; for (const [cx, cz, h, rx, rz] of HILLS) { const r2 = ((x - cx) / rx) ** 2 + ((z - cz) / rz) ** 2; if (r2 < 1) g += h * (1 - r2) * (1 - r2); } return g; };
function terrain(x, z) {
  let g = hillsAt(x, z);
  for (const k in CLEAR) { const C = CLEAR[k]; if (C.h == null) continue; const r = ellR(x, z, C); g = lerp(g, C.h, sm(2.6, 0.9, r)); }
  { const r = Math.hypot((x - QUADRA.x) / (QUADRA.hx + 7), (z - QUADRA.z) / (QUADRA.hz + 9)); g = lerp(g, QUADRA.h, sm(1.6, 0.9, r)); }
  // baixada da avenida, do canal, da passagem de baixo e das cabeceiras das pontes (aplicada por último)
  const dAC = Math.min(Math.abs(polySide(x, z, AVE_PTS)), Math.abs(polySide(x, z, CANAL_PTS))); g *= sm(6, 28, dAC);
  const dR = polyDist(x, z, BOTTOM_ROAD); g *= sm(3, 12, dR);
  for (const b of BRIDGES) g *= sm(3, 16, polyDist(x, z, b));
  return Math.max(0, g);
}
for (const k of ['azul', 'A', 'verm', 'clN']) CLEAR[k].h = Math.round(hillsAt(CLEAR[k].c[0], CLEAR[k].c[1]) * 20) / 20; // clareira no nível natural do morro

function escAt(x, z) { // altura do escadão nesta célula (ou null)
  for (const L of ESC.lands) if (x >= L.x0 && x <= L.x1 && z >= L.z0 && z <= L.z1) return { h: L.h, flat: true };
  for (const F of ESC.flights) { const across = F.ax === 'z' ? x : z, lo = F.ax === 'z' ? F.x0 : F.z0, hi = F.ax === 'z' ? F.x1 : F.z1; if (across < lo || across > hi) continue;
    const along = F.ax === 'z' ? z : x, a0 = Math.min(F.a0, F.a1), a1 = Math.max(F.a0, F.a1); if (along < a0 || along > a1) continue;
    const n = Math.max(1, Math.round((a1 - a0) / CELL)), k = clamp(Math.floor(Math.abs(along - F.a0) / CELL), 0, n - 1);
    return { h: F.h0 + (F.h1 - F.h0) * (k + 1) / (n + 1), flat: false, F }; }
  return null;
}

function buildMap(seed) {
  const R = mulberry(seed);
  const K = new Uint8Array(NC), H = new Float32Array(NC), HV = new Float32Array(NC), M = new Uint8Array(NC), HID = new Int32Array(NC).fill(-1), SN = new Int16Array(NC).fill(-1);
  const CT = new Float32Array(NC), CB = new Float32Array(NC);   // copa das árvores (topo/base): bloqueia a VISÃO, não as balas
  const idx = (i, j) => j * GX + i;
  // 1) traçado: prioridade borda > ponte/estrada > canal > avenida > escadão/praças > ruas > trilhas > favela (lote) > mata
  for (let j = 0; j < GZ; j++) for (let i = 0; i < GX; i++) {
    const x = (i + 0.5) * CELL, z = (j + 0.5) * CELL, c = idx(i, j);
    const dA = polySide(x, z, AVE_PTS), dC = polySide(x, z, CANAL_PTS), adA = Math.abs(dA), adC = Math.abs(dC), dR = polyDist(x, z, BOTTOM_ROAD);
    const edge = x < 0.8 || x > MW - 0.8 || z < 0.8 || z > ML - 0.8;
    if (edge) { if (adA <= AVE_HW + SIDEW) { K[c] = K_BLOCK; M[c] = B_JERSEY; } else if (adC <= CAN_HW) K[c] = K_VOID; else { K[c] = K_BLOCK; M[c] = B_ROCK; } continue; }
    let k = -1, sn = -1;
    if (BRIDGES.some(b => polyDist(x, z, b) <= 1.3)) { k = K_STREET; sn = -6; }
    else if (dR <= 3.4) { k = adA <= AVE_HW ? K_AVE : K_STREET; sn = -7; }
    else if (adC <= CAN_HW) { K[c] = K_VOID; continue; }
    else if (adC <= CAN_HW + CAN_WALL) { K[c] = K_BLOCK; M[c] = B_GUARD; continue; }
    else if (adC <= CAN_HW + CAN_WALL + BANK_W && z >= 8.5 && z <= 109) { k = K_STREET; sn = -5; }
    else if (adC <= CAN_HW + CAN_WALL + BANK_W) { K[c] = K_BLOCK; M[c] = B_GUARD; continue; }
    else if (adA <= AVE_HW) k = K_AVE;
    else if (adA <= AVE_HW + SIDEW) k = K_WALK;
    if (k < 0) { const e = escAt(x, z); if (e) { k = K_ESC; } }
    if (k < 0) { for (const key of ['praca', 'C', 'B']) if (ellR(x, z, CLEAR[key]) <= 1) { k = K_PLAZA; sn = -10; } }
    if (k < 0 && Math.abs(x - STAGE.x) <= STAGE.hx && Math.abs(z - STAGE.z) <= STAGE.hz) { k = K_PLAZA; sn = -12; }
    if (k < 0 && Math.abs(x - QUADRA.x) <= QUADRA.hx + 2 && Math.abs(z - QUADRA.z) <= QUADRA.hz + 2) { k = K_PLAZA; sn = -11; }
    if (k < 0) for (let s = 0; s < STREETS.length; s++) { const S = STREETS[s]; if (polyDist(x, z, S.pts) <= S.hw) { k = S.kind; sn = s; break; } }
    if (k < 0) for (let s = 0; s < TRAILS.length; s++) if (polyDist(x, z, TRAILS[s].pts) <= 1.5) { k = K_TRAIL; sn = 100 + s; break; }
    if (k < 0) { for (const key of ['azul', 'A', 'verm', 'clN', 'cl1', 'cl2']) if (ellR(x, z, CLEAR[key]) <= 1) { k = K_MATA; sn = -20; } }
    if (k < 0) k = (inPoly(x, z, POLY_LEFT) || inPoly(x, z, POLY_RIGHT)) && adC > CAN_HW + 4 ? K_LOT : K_MATA;
    K[c] = k; SN[c] = sn;
  }
  // 2) lotes => casas (lotes em grade irregular)
  const LOT_W = 6, LOT_D = 7; // casas organizadas em quadras: lotes regulares de 6 x 7 m
  const plotOf = (x, z) => Math.floor(z / LOT_D) * 1000 + Math.floor(x / LOT_W);
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
  // casas fininhas: toda casa precisa ter pelo menos 4 m nos dois sentidos; as menores são unidas à vizinha com a maior parede em comum
  const MIN_SIDE = 4;
  for (let pass = 0; pass < 4; pass++) for (const h of houses) { if (h.dead) continue; let i0 = 1e9, i1 = -1, j0 = 1e9, j1 = -1; for (const c of h.cells) { const i = c % GX, j = (c / GX) | 0; if (i < i0) i0 = i; if (i > i1) i1 = i; if (j < j0) j0 = j; if (j > j1) j1 = j; }
    const wx = (i1 - i0 + 1) * CELL, wz = (j1 - j0 + 1) * CELL, fill = h.cells.length / ((i1 - i0 + 1) * (j1 - j0 + 1)); if (Math.min(wx, wz) >= MIN_SIDE && h.cells.length >= 40 && fill > 0.55) continue;
    const share = new Map(); for (const c of h.cells) { const i = c % GX, j = (c / GX) | 0; for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ni = i + a, nj = j + b; if (ni < 0 || nj < 0 || ni >= GX || nj >= GZ) continue; const o = comp[idx(ni, nj)]; if (o >= 0 && o !== h.id && !houses[o].dead) share.set(o, (share.get(o) || 0) + 1); } }
    let best = -1, bn = 0; for (const [o, n] of share) if (n > bn) { bn = n; best = o; }
    if (best >= 0 && bn >= 3) { const t = houses[best]; for (const c of h.cells) { comp[c] = best; t.cells.push(c); } h.cells = []; h.dead = true; }
    else if (pass === 3) { for (const c of h.cells) { K[c] = K_BLOCK; M[c] = B_MURO; comp[c] = -1; } h.dead = true; } }
  for (let c = 0; c < NC; c++) if (K[c] === K_ROOF && comp[c] >= 0) HID[c] = comp[c];
  // 3) alturas do chão
  for (let j = 0; j < GZ; j++) for (let i = 0; i < GX; i++) {
    const c = idx(i, j), x = (i + 0.5) * CELL, z = (j + 0.5) * CELL, g = terrain(x, z), k = K[c];
    if (k === K_AVE) H[c] = 0; else if (k === K_WALK) H[c] = 0.15;
    else if (k === K_ESC) H[c] = escAt(x, z).h;
    else if (SN[c] === -5 || SN[c] === -6) H[c] = WALK_H;
    else if (SN[c] === -7) H[c] = Math.min(g, 1.5) * sm(3, 9, Math.abs(polySide(x, z, AVE_PTS)));
    else if (SN[c] === -11) H[c] = QUADRA.h;
    else if (SN[c] === -12) H[c] = STAGE.h;
    else if (k === K_PLAZA) H[c] = g;
    else if (k === K_BECO) H[c] = g;
    else H[c] = g;
  }
  // arquibancada (3 degraus) no lado sul da quadra e degraus do palco
  for (let j = 0; j < GZ; j++) for (let i = 0; i < GX; i++) { const c = idx(i, j), x = (i + 0.5) * CELL, z = (j + 0.5) * CELL;
    if (SN[c] === -11 && Math.abs(x - QUADRA.x) <= QUADRA.hx - 3 && Math.abs(x - QUADRA.x) >= 3 && z < QUADRA.z - QUADRA.hz) { const row = Math.floor((QUADRA.z - QUADRA.hz - z) / 0.7); H[c] = QUADRA.h + 0.42 * Math.min(3, row + 1); }
    if (SN[c] === -11 && Math.abs(x - STAGE.x) <= 2.5 && z > QUADRA.z + QUADRA.hz && z < STAGE.z - STAGE.hz) H[c] = QUADRA.h + Math.min(0.75, 0.25 * Math.ceil((z - (QUADRA.z + QUADRA.hz)) / 0.5)); }
  // 4) suaviza junções de ruas para nunca exceder o degrau
  const isGround = k => k === K_STREET || k === K_BECO || k === K_PLAZA || k === K_WALK || k === K_AVE || k === K_ESC || k === K_TRAIL;
  const fixed = c => K[c] === K_ESC || K[c] === K_AVE || K[c] === K_WALK || SN[c] === -5 || SN[c] === -6 || SN[c] === -11 || SN[c] === -12;
  for (let it = 0; it < 80; it++) { let ch = 0;
    for (let c = 0; c < NC; c++) { const k = K[c]; if (!isGround(k) || fixed(c)) continue; const i = c % GX, j = (c / GX) | 0;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= GX || nj >= GZ) continue; const n = idx(ni, nj); if (!isGround(K[n]) || SN[n] === -11 || SN[n] === -12) continue; const d = H[c] - H[n];
        if (d > 0.42) { H[c] = H[n] + 0.42; ch++; } else if (d < -0.42) { H[c] = H[n] - 0.42; ch++; } } }
    if (!ch) break; }
  // 5) casas: andares, lajes acessíveis e escadas externas
  const prng = p => mulberry(seed * 7 + p * 131 + 17);
  const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const h of houses) {
    if (h.dead) continue; const pr = prng(h.plot); const hr = mulberry(seed * 13 + h.id * 7919);
    let gmin = 1e9, gmax = -1e9; for (const c of h.cells) { gmin = Math.min(gmin, H[c]); gmax = Math.max(gmax, H[c]); }
    const fr = pr(); const floors = h.shop ? 1 + Math.floor(pr() * 3) : fr < 0.2 ? 1 : fr < 0.55 ? 2 : fr < 0.85 ? 3 : 4;
    let top = gmax + floors * 2.9 + 0.25;
    let sMax = -1e9; const edge = [];
    for (const c of h.cells) { const i = c % GX, j = (c / GX) | 0; for (let d = 0; d < 4; d++) { const ni = i + DIRS4[d][0], nj = j + DIRS4[d][1]; if (ni < 0 || nj < 0 || ni >= GX || nj >= GZ) continue; const n = idx(ni, nj); if (isGround(K[n]) && K[n] !== K_AVE && K[n] !== K_MATA) { sMax = Math.max(sMax, H[n]); edge.push({ c, n, d }); } } }
    h.gmin = gmin; h.floors = floors; h.access = 0;
    if (!h.shop && pr() < 0.62 && sMax - gmin >= 2.5 && sMax >= gmax - 0.8) { top = sMax; h.access = 1; }
    h.top = Math.round(top * 20) / 20;
    h.style = { tint: hr(), win: hr(), door: hr(), brick: !h.shop && hr() < 0.2, tank: hr(), obra: hr() };
    h.edge = edge; h.pr = pr;
    for (const c of h.cells) { K[c] = K_ROOF; H[c] = h.top; HID[c] = h.id; }
  }
  // escadas externas para lajes (passagens às lajes)
  for (const h of houses) {
    if (h.dead || h.access || h.pr() > 0.6) continue;
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
    if (h.dead || h.style.tank > 0.55) continue;
    const set = new Set(h.cells.filter(c => K[c] === K_ROOF));
    const inner = h.cells.filter(c => { if (!set.has(c)) return false; const i = c % GX, j = (c / GX) | 0; for (let a = -2; a <= 3; a++) for (let b = -2; b <= 3; b++) { if (!set.has(idx(i + a, j + b))) return false; } return true; });
    if (!inner.length) continue;
    const c = inner[Math.floor(h.style.tank * 997) % inner.length], i = c % GX, j = (c / GX) | 0;
    for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const q = idx(i + a, j + b); K[q] = K_BLOCK; M[q] = h.style.tank < 0.3 ? B_TANK : B_TANK2; H[q] = h.top + 1.15; HV[q] = H[q]; }
  }
  // 7) mata: árvores (troncos com colisão, copas que tapam a visão), pedras e arbustos
  const trees = [], rocks = [], bushes = [];
  const nearPath = (x, z, r) => { for (let a = -r; a <= r; a += CELL) for (let b = -r; b <= r; b += CELL) { const i = Math.floor((x + a) / CELL), j = Math.floor((z + b) / CELL); if (i < 0 || j < 0 || i >= GX || j >= GZ) continue; const k = K[idx(i, j)]; if (k !== K_MATA && k !== K_LOT && k !== K_ROOF) return true; } return false; };
  for (let gz = 2; gz < ML - 2; gz += 3.3) for (let gx = 2; gx < MW - 2; gx += 3.3) { // mata densa
    const x = gx + (h2(gx * 7 | 0, gz * 7 | 0, 1) - 0.5) * 3, z = gz + (h2(gx * 7 | 0, gz * 7 | 0, 2) - 0.5) * 3, i = Math.floor(x / CELL), j = Math.floor(z / CELL), c = idx(i, j);
    if (K[c] !== K_MATA || SN[c] === -20) continue;
    const r = h2(i, j, 3); if (r < 0.05) continue;
    if (nearPath(x, z, r < 0.25 ? 1.0 : 2.2)) { if (!nearPath(x, z, 1.0) && r > 0.6) bushes.push({ x, z, y: H[c], s: 0.6 + r * 0.6 }); continue; }
    if (r < 0.2) { rocks.push({ x, z, y: H[c], s: 0.8 + h2(i, j, 4) * 1.0 }); for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const q = idx(i + a, j + b); if (K[q] === K_MATA) { K[q] = K_BLOCK; M[q] = B_ROCK; HV[q] = H[q]; H[q] = H[q] + 0.9 + h2(i, j, 5) * 0.8; } } continue; }
    const palm = h2(i, j, 6) < 0.3, tall = 5 + h2(i, j, 7) * 7, cr = palm ? 2.2 : 2.4 + h2(i, j, 8) * 1.6;
    trees.push({ x: (i + 0.5) * CELL, z: (j + 0.5) * CELL, y: H[c], h: tall, r: cr, palm });
    K[c] = K_BLOCK; M[c] = B_INVIS; HV[c] = H[c]; const g0 = H[c]; H[c] = g0 + Math.min(tall, 3.2);
    for (let a = -cr; a <= cr; a += CELL) for (let b = -cr; b <= cr; b += CELL) { if (a * a + b * b > cr * cr) continue; const ii = Math.floor((x + a) / CELL), jj = Math.floor((z + b) / CELL); if (ii < 0 || jj < 0 || ii >= GX || jj >= GZ) continue; const q = idx(ii, jj);
      const top = g0 + tall + 0.6, bot = g0 + (palm ? tall - 1.2 : Math.max(2.2, tall * 0.4)); if (top > CT[q]) { CT[q] = top; CB[q] = CB[q] ? Math.min(CB[q], bot) : bot; } }
    if (h2(i, j, 9) < 0.5) bushes.push({ x: x + 1.2, z: z - 0.8, y: g0, s: 0.5 + h2(i, j, 10) * 0.5 });
  }
  for (let c = 0; c < NC; c++) { const x = ((c % GX) + 0.5) * CELL, z = ((c / GX | 0) + 0.5) * CELL;
    if (K[c] === K_BLOCK && M[c] === B_GUARD) H[c] = WALK_H + 0.95;
    if (K[c] === K_BLOCK && M[c] === B_MURO) H[c] = 2.2;
    if (K[c] === K_BLOCK && M[c] === B_JERSEY && (x < 0.8 || x > MW - 0.8 || z < 0.8 || z > ML - 0.8)) H[c] = 0.15 + 0.9;
    if (K[c] === K_BLOCK && M[c] === B_ROCK && HV[c] === 0 && H[c] === 0) H[c] = terrain(x, z) + 6;
    if (K[c] === K_VOID) H[c] = -1.5; }
  const cover = (x0, z0, x1, z1, mat, hgt) => { for (let j = Math.floor(z0 / CELL); j < Math.ceil(z1 / CELL); j++) for (let i = Math.floor(x0 / CELL); i < Math.ceil(x1 / CELL); i++) { const c = idx(i, j); if (!WALKABLE[K[c]]) continue; const base = H[c]; K[c] = K_BLOCK; M[c] = mat; H[c] = base + hgt; } };
  // cobertura e objetos das bases (poucas construções: caixas e barris)
  const Cz = k => CLEAR[k].c;
  for (const k of ['azul', 'verm']) { const [cx, cz] = Cz(k); cover(cx - 9, cz - 3, cx - 7.5, cz - 1.5, B_BRICKS, 1.1); cover(cx + 7, cz + 1, cx + 8.5, cz + 2.5, B_BARREL, 1.0); cover(cx + 2, cz - 6, cx + 5, cz - 5.5, B_JERSEY, 1.0); }
  { const [cx, cz] = Cz('A'); cover(cx - 6, cz - 2, cx - 4.5, cz - 0.5, B_BRICKS, 1.1); cover(cx + 4.5, cz + 0.5, cx + 6, cz + 2, B_BRICKS, 1.1); cover(cx - 1, cz + 5, cx + 1.5, cz + 5.5, B_SAND, 0.9); cover(cx + 1, cz - 6, cx + 3.5, cz - 5.5, B_SAND, 0.9); }
  { const [cx, cz] = Cz('B'); cover(cx - 5, cz - 2, cx - 4, cz - 1, B_BRICKS, 1.15); cover(cx + 4, cz + 1, cx + 5, cz + 2, B_BRICKS, 1.15); cover(cx - 1, cz + 4.5, cx + 1.5, cz + 5, B_SAND, 0.95); cover(cx + 1, cz - 5, cx + 3, cz - 4.5, B_BARREL, 1.0); }
  { const [cx, cz] = Cz('praca'); cover(cx - 7, cz - 3, cx - 6, cz - 2, B_BRICKS, 1.15); cover(cx + 6, cz + 2, cx + 7, cz + 3, B_BRICKS, 1.15); cover(cx - 1, cz - 6.5, cx + 1.5, cz - 6, B_JERSEY, 1.0); }
  { const [cx, cz] = Cz('C'); cover(cx - 4.5, cz + 2, cx - 3.5, cz + 3, B_BARREL, 1.0); cover(cx + 3, cz - 3, cx + 4.5, cz - 2.5, B_SAND, 0.9); }
  // Base C dentro do baile: sacos de areia e caixas nas pontas da quadra
  cover(QUADRA.x - 8.5, QUADRA.z - 1.5, QUADRA.x - 8, QUADRA.z + 1.5, B_SAND, 0.95); cover(QUADRA.x + 8, QUADRA.z - 1.5, QUADRA.x + 8.5, QUADRA.z + 1.5, B_SAND, 0.95); cover(QUADRA.x - 3, QUADRA.z - 6.5, QUADRA.x - 1.5, QUADRA.z - 5.5, B_BRICKS, 1.1); cover(QUADRA.x + 1.5, QUADRA.z + 5.5, QUADRA.x + 3, QUADRA.z + 6.5, B_BRICKS, 1.1);
  for (const t of [0, 1]) { const s = SUPPLY[t]; cover(s.x - 0.75, s.z + 0.6, s.x + 0.75, s.z + 1.1, B_SUPPLY, 1.0); }
  // alambrado da quadra (lados leste e oeste, com portões)
  for (let j = 0; j < GZ; j++) for (const xs of [QUADRA.x - QUADRA.hx - 1.75, QUADRA.x + QUADRA.hx + 1.75]) { const z = (j + 0.5) * CELL; if (Math.abs(z - QUADRA.z) > QUADRA.hz + 1.5 || Math.abs(z - QUADRA.z) < 2.2) continue; const c = idx(Math.floor(xs / CELL), j); if (K[c] === K_PLAZA) { K[c] = K_BLOCK; M[c] = B_FENCE; HV[c] = H[c]; H[c] += 3.2; } }
  for (let c = 0; c < NC; c++) HV[c] = (K[c] === K_BLOCK && M[c] === B_SUPPLY) ? H[c] - 1.0 : (K[c] === K_BLOCK && (M[c] === B_INVIS || M[c] === B_FENCE || M[c] === B_MODEL)) ? HV[c] : H[c];
  ESC_LAND = ESC.lands.map(l => ({ x: (l.x0 + l.x1) / 2, z: (l.z0 + l.z1) / 2, hx: (l.x1 - l.x0) / 2, hz: (l.z1 - l.z0) / 2, h: l.h }));
  const map = { K, H, HV, M, HID, SN, CT, CB, houses, idx, decor: [], poles: [], cars: [], lamps: [], trees, rocks, bushes, seed, x0Esc: ESC_X0 };
  placeProps(map, R);
  return map;
}

// postes (avenida, ruas, praças, quadra e bases) e outros objetos
function placeProps(map, R) {
  const { K, H, HV, M, idx } = map;
  map.trees = map.trees || [];
  // iluminação pública da avenida: um poste a cada ~22 m, alternando os lados
  let s = 0, k = 0; const L = AVE_PTS;
  for (let p = 0; p < L.length - 1; p++) { const a = L[p], b = L[p + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]), tx = (b[0] - a[0]) / len, tz = (b[1] - a[1]) / len;
    for (; s < len; s += 22) { const side = k++ % 2 ? 1 : -1, x = a[0] + tx * s + tz * side * (AVE_HW + 1.2) * -1, z = a[1] + tz * s - tx * side * (AVE_HW + 1.2) * -1; if (x < 2 || z < 2 || x > MW - 2 || z > ML - 2) continue;
      const i = Math.floor(x / CELL), j = Math.floor(z / CELL), c = idx(i, j); if (K[c] !== K_WALK) continue; K[c] = K_BLOCK; M[c] = B_INVIS; HV[c] = H[c]; const base = H[c]; H[c] = base + 7.5; map.poles.push({ x: (i + 0.5) * CELL, z: (j + 0.5) * CELL, base, ave: true, dir: [-tz * side * -1, tx * side * -1] }); }
    s -= len; }
  // postes ao longo das ruas
  const isStreetC = c => K[c] === K_STREET || K[c] === K_BECO;
  const taken = map.poles.map(p => ({ x: p.x, z: p.z }));
  for (let j = 2; j < GZ - 2; j++) for (let i = 2; i < GX - 2; i++) {
    const c = idx(i, j); if (!isStreetC(c) || map.SN[c] < 0) continue; const x = (i + 0.5) * CELL, z = (j + 0.5) * CELL;
    let wallN = 0; for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = idx(i + a, j + b); if (K[n] === K_ROOF || (K[n] === K_BLOCK && M[n] !== B_INVIS)) wallN++; }
    if (wallN !== 1) continue;
    let free = 0; for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { let q = 0; for (let t = 1; t <= 6; t++) { const n = idx(i + a * t, j + b * t); if (WALKABLE[K[n]]) q++; else break; } free = Math.max(free, q); }
    if (free < 4) continue;
    if (taken.some(p => (p.x - x) ** 2 + (p.z - z) ** 2 < 150)) continue;
    if (h2(i, j, 5) < 0.3) continue;
    taken.push({ x, z }); K[c] = K_BLOCK; M[c] = B_INVIS; HV[c] = H[c]; const base = H[c]; H[c] = base + 7.5; map.poles.push({ x, z, base, ave: false });
  }
  // pontos de luz extra (praças, bases, quadra) — usados pela iluminação noturna
  map.lights = [];
  for (const p of map.poles) map.lights.push({ x: p.x + (p.dir ? p.dir[0] * 1.6 : 0), y: p.base + 7.1, z: p.z + (p.dir ? p.dir[1] * 1.6 : 0), r: p.ave ? 17 : 14, i: 1.15 });
  for (const kk of ['azul', 'A', 'verm', 'praca', 'C']) { const C = CLEAR[kk]; for (const [dx, dz] of [[-0.7, -0.6], [0.7, 0.6]]) map.lights.push({ x: C.c[0] + dx * C.rx, y: C.h + 6, z: C.c[1] + dz * C.rz, r: 17, i: 1.1, mast: true }); }
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) map.lights.push({ x: QUADRA.x + dx * (QUADRA.hx + 1), y: QUADRA.h + 9, z: QUADRA.z + dz * (QUADRA.hz + 1), r: 27, i: 1.9, tower: true });
}

// ---------- colisão, raios e navegação ----------
function makeWorld(map) {
  const { K, H } = map; const CT = map.CT, CB = map.CB;
  const blockedAt = (x, z) => { const i = Math.floor(x / CELL), j = Math.floor(z / CELL); if (i < 0 || j < 0 || i >= GX || j >= GZ) return true; return !WALKABLE[K[j * GX + i]]; };
  const hCell = (x, z) => { const i = Math.floor(x / CELL), j = Math.floor(z / CELL); if (i < 0 || j < 0 || i >= GX || j >= GZ) return 99; return H[j * GX + i]; };
  const OFF = [-1, 0, 1];
  // obstáculos móveis (carros) ficam em this.dyn: cada sala tem a sua lista (veja fork())
  // obstáculos móveis (carros): caixas orientadas {x, z, fx, fz (frente), hl, hw, top}
  function fitsD(dyn, x, z, feet, r) { for (const a of OFF) for (const b of OFF) { const px = x + a * r, pz = z + b * r; if (blockedAt(px, pz)) return false; if (hCell(px, pz) > feet + STEP_UP) return false; }
    for (const d of dyn) { const dx = x - d.x, dz = z - d.z, al = dx * d.fx + dz * d.fz, la = -dx * d.fz + dz * d.fx; if (Math.abs(al) < d.hl + r && Math.abs(la) < d.hw + r && d.top > feet + STEP_UP) return false; } return true; }
  function rayDyn(ox, oy, oz, dx, dy, dz, maxT) { let best = maxT; for (const d of this.dyn) { const rx = ox - d.x, rz = oz - d.z, o1 = rx * d.fx + rz * d.fz, o2 = -rx * d.fz + rz * d.fx, v1 = dx * d.fx + dz * d.fz, v2 = -dx * d.fz + dz * d.fx; let t0 = 0, t1 = best;
    for (const [o, v, lo, hi] of [[o1, v1, -d.hl, d.hl], [oy, dy, 0.25, d.top], [o2, v2, -d.hw, d.hw]]) { if (Math.abs(v) < 1e-9) { if (o < lo || o > hi) { t0 = 1; t1 = 0; break; } continue; } let a = (lo - o) / v, b = (hi - o) / v; if (a > b) { const q = a; a = b; b = q; } t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) break; }
    if (t0 <= t1 && t0 < best) best = t0; } return best; }
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
  // vision=true: as copas das árvores também bloqueiam (usado na percepção, não nas balas)
  function ray(ox, oy, oz, dx, dy, dz, maxT, vision) {
    let i = Math.floor(ox / CELL), j = Math.floor(oz / CELL);
    const si = dx > 0 ? 1 : -1, sj = dz > 0 ? 1 : -1;
    const tdi = dx ? Math.abs(CELL / dx) : Infinity, tdj = dz ? Math.abs(CELL / dz) : Infinity;
    let tmi = dx ? (dx > 0 ? (i + 1) * CELL - ox : ox - i * CELL) / Math.abs(dx) : Infinity;
    let tmj = dz ? (dz > 0 ? (j + 1) * CELL - oz : oz - j * CELL) / Math.abs(dz) : Infinity;
    let t0 = 0, face = 0, leafAcc = 0;
    for (let it = 0; it < 4000; it++) {
      const t1 = Math.min(tmi, tmj, maxT), inside = i >= 0 && j >= 0 && i < GX && j < GZ, h = inside ? H[j * GX + i] : -0.03;
      const ya = oy + dy * t0, yb = oy + dy * t1;
      if (ya <= h) return { t: t0, face, i, j };
      if (yb <= h) return { t: (h - oy) / dy, face: 0, i, j };
      // mata densa: depois de ~7 m dentro da vegetação (copas e mato baixo) a visão é bloqueada
      if (vision && inside) { const c = j * GX + i, top = CT[c]; if (top > 0) { const lo = Math.min(ya, yb), hi = Math.max(ya, yb); if (hi >= 0.5 && lo <= top) { leafAcc += t1 - t0; if (leafAcc > 7) return { t: t0, face: 3, i, j, leaf: true }; } } }
      if (t1 >= maxT) return null;
      if (tmi < tmj) { t0 = tmi; tmi += tdi; i += si; face = 1; } else { t0 = tmj; tmj += tdj; j += sj; face = 2; }
    }
    return null;
  }
  function los(ax, ay, az, bx, by, bz) { const dx = bx - ax, dy = by - ay, dz = bz - az, d = Math.hypot(dx, dy, dz); if (d < 0.01) return true; const h = ray(ax, ay, az, dx / d, dy / d, dz / d, d, true); return !h; }
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
  grenade: { start: 2, max: 2, fuse: 2.6, radius: 6.5, damage: 115, speed: 15, cooldown: 1.2 }, // granadas: quantidade e efeito em área
  baile: { radius: 2.8, cooldown: 2 },   // caixa de som do baile: liga/desliga perto da mesa de som
  police: { first: [90, 420], every: [140, 560], duration: [150, 260], cars: 3, perCar: 5, hp: 130, speed: 11 }, // operações policiais (horário sorteado)
  dayLength: 20 * 60,    // ciclo completo de dia e noite (segundos reais)
  dayStart: 0.3,         // hora inicial (0 = meia-noite, 0.25 = 6h, 0.5 = meio-dia, 0.75 = 18h)
  weapons: {
    rifle: { name: 'FUZIL', mag: 30, res: 180, rate: 0.1, body: 27, head: 3.2, spread: 0.005, auto: true, reload: 2.1, range: 160, swap: 0.5 },
    pistol: { name: 'PISTOLA', mag: 15, res: 75, rate: 0.2, body: 21, head: 3.0, spread: 0.004, auto: false, reload: 1.5, range: 120, swap: 0.4 },
  },
};
const TEAM = [{ name: 'Azul', col: [0.18, 0.42, 0.86], css: '#2F7BE0', dark: [0.1, 0.2, 0.45] }, { name: 'Vermelho', col: [0.82, 0.2, 0.16], css: '#D8402F', dark: [0.45, 0.1, 0.08] }, { name: 'Polícia', col: [0.16, 0.19, 0.24], css: '#8FA6C8', dark: [0.08, 0.09, 0.12] }];
const POLICE_NAMES = ['Sd. Rocha', 'Cb. Lima', 'Sd. Prado', 'Sgt. Vieira', 'Sd. Nunes', 'Cb. Moura', 'Sd. Dias', 'Ten. Castro'];
const BOT_NAMES = [['Tico', 'Bira', 'Neném', 'Pardal', 'Dentinho'], ['Zóio', 'Formiga', 'Juninho', 'Cabeça', 'Mago']];
const NPC_NAMES = ['Dona Cida', 'Seu Jorge', 'Tia Lurdes', 'Marquinho', 'Dona Neide', 'Seu Tião', 'Rosinha', 'Vovó Zélia'];
const DIFF_FPS = { facil: { react: 0.95, err: 0.095, fov: 1.8, turn: 3.0, burst: 3, gap: 0.65, spread: 0.026, think: 0.28 }, normal: { react: 0.62, err: 0.062, fov: 2.0, turn: 4.4, burst: 4, gap: 0.45, spread: 0.016, think: 0.2 }, dificil: { react: 0.4, err: 0.04, fov: 2.2, turn: 6.0, burst: 5, gap: 0.33, spread: 0.012, think: 0.15 }, elite: { react: 0.26, err: 0.026, fov: 2.4, turn: 7.8, burst: 6, gap: 0.24, spread: 0.009, think: 0.11, grenade: 2 } };
const SKIN = [[0.85, 0.66, 0.5], [0.62, 0.44, 0.3], [0.45, 0.3, 0.2], [0.75, 0.55, 0.4], [0.35, 0.24, 0.16]];
const BASES_DEF = () => [
  { id: 'A', name: 'Coração da Mata', x: CLEAR.A.c[0], z: CLEAR.A.c[1], r: 5 },      // no fundo da mata densa
  { id: 'B', name: 'Largo da Serra', x: CLEAR.B.c[0], z: CLEAR.B.c[1], r: 5 },       // no interior da favela do Escadão
  { id: 'C', name: 'Quadra do Baile', x: QUADRA.x, z: QUADRA.z, r: 5 },              // no interior da favela do Valão, com o baile
];
const STATION = team => ({ x: SUPPLY[team].x, z: SUPPLY[team].z });

// cria a partida. opts: { team, diff, name, humans:[{key,name,team}], bots:{0:n,1:n}, local:true|false, rng }
function makeGame(map, W, opts) {
  opts = opts || {};
  const rnd = opts.rng || Math.random;
  const G = { map, W, t: 0, actors: [], npcs: [], score: [0, 0], police: { phase: 'idle', next: 0, team: -1, endT: 0, cars: [], ops: 0 }, over: false, winner: -1, feed: [], fx: { tracers: [], puffs: [], flashes: [] }, events: [], diff: DIFF_FPS[opts.diff] || DIFF_FPS.normal, stats: { unstuck: 0, shots: 0, hits: 0 }, nextId: 1, timeLeft: CONFIG.timeLimit, cfg: CONFIG, dayT: opts.dayT != null ? opts.dayT : CONFIG.dayStart };
  // ---------- nascimentos e rede principal de navegação ----------
  // rede principal de navegação: calculada uma vez por mapa e reaproveitada (evita travar o servidor a cada partida)
  if (!W.cache.main) { const hub = W.nearestOK(PRACA.x, PRACA.z, 6); W.cache.main = { reachS: W.reach(hub, false, false), backS: W.reach(hub, false, true) }; }
  const { reachS, backS } = W.cache.main;
  const mainNet = c => reachS[c] && backS[c];
  const nearestMain = (x, z) => { const i0 = Math.floor(x / CELL), j0 = Math.floor(z / CELL); for (let r = 0; r <= 30; r++) for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) { if (Math.max(Math.abs(a), Math.abs(b)) !== r) continue; const i = i0 + a, j = j0 + b; if (i < 0 || j < 0 || i >= GX || j >= GZ) continue; const c = j * GX + i; if (W.OK[c] && mainNet(c)) return c; } return -1; };
  const spawns = [[], []];
  for (const [team, key] of [[0, 'azul'], [1, 'verm']]) for (const [fx, fz] of [[-0.6, -0.35], [-0.3, -0.5], [0, -0.55], [0.3, -0.5], [0.6, -0.35], [-0.45, 0.1], [0.45, 0.1], [0, 0.25]]) { const C = CLEAR[key], c = W.nearestOK(C.c[0] + fx * C.rx, C.c[1] + fz * C.rz, 6); if (c >= 0 && mainNet(c)) spawns[team].push(c); }
  G.spawns = spawns; G.mainNet = mainNet;
  // ---------- bases de dominação ----------
  G.bases = BASES_DEF().map(b => { const c = W.nearestOK(b.x, b.z, 6); return Object.assign(b, { h: map.H[c], owner: -1, prog: 0, inside: [0, 0], state: 'neutra', cell: c }); });
  // ---------- pontos estratégicos para os bots ----------
  const goals = [];
  const addGoal = (x, z, w, tag, base) => { const c = W.nearestOK(x, z, 6); if (c >= 0 && mainNet(c)) goals.push({ c, w, tag, base, z: W.cellZ(c) }); };
  G.bases.forEach((b, bi) => { for (const [dx, dz] of [[0, 0], [-1.2, -1.2], [1.2, 1.2], [-1.2, 1.2], [1.2, -1.2]]) addGoal(b.x + dx, b.z + dz, 1, 'base', bi); });
  for (const l of ESC_LAND) addGoal(l.x, l.z, 1.5, 'escadao');
  for (const T of TRAILS) for (let q = 0; q < T.pts.length; q += 2) addGoal(T.pts[q][0], T.pts[q][1], 0.6, 'trilha');
  addGoal(QUADRA.x, QUADRA.z, 1.2, 'quadra'); addGoal(CLEAR.cl1.c[0], CLEAR.cl1.c[1], 0.8, 'clareira'); addGoal(CLEAR.cl2.c[0], CLEAR.cl2.c[1], 0.8, 'clareira');
  for (const S of STREETS) for (const p of S.pts) if (Math.round(p[0]) % 3 === 0) { addGoal(p[0], p[1], 0.5, 'rua'); }
  for (const h of map.houses) if (!h.dead && h.access && h.cells.length > 8) { const c = h.cells[(h.cells.length / 2) | 0]; if (W.OK[c] && mainNet(c)) goals.push({ c, w: 0.9, tag: 'laje', z: W.cellZ(c) }); }
  for (const z of [25, 50, 75, 100, 125]) { const x = lineX(CANAL_PTS, z) + CAN_HW + CAN_WALL + BANK_W / 2; addGoal(x, z, 0.6, 'valao'); }
  G.goals = goals;
  G.stationCell = [0, 1].map(t => W.nearestOK(STATION(t).x, STATION(t).z, 4));
  // pontos de caminhada dos civis (avenida, praça, ladeiras) — longe das bases principais
  const farFromBases = c => G.bases.every(b => Math.hypot(W.cellX(c) - b.x, W.cellZ(c) - b.z) > 16);
  const npcSpots = []; for (const g of goals) if ((g.tag === 'rua' || g.tag === 'quadra') && farFromBases(g.c)) npcSpots.push(g.c);
  for (let z = 12; z < ML - 12; z += 10) { const c = W.nearestOK(aveX(z) + AVE_HW + 1.0, z, 4); if (c >= 0 && mainNet(c)) npcSpots.push(c); }
  G.npcSpots = npcSpots;
  // ---------- atores ----------
  const loadout = () => ({ rifle: { mag: CONFIG.weapons.rifle.mag, res: CONFIG.weapons.rifle.res }, pistol: { mag: CONFIG.weapons.pistol.mag, res: CONFIG.weapons.pistol.res } });
  const mk = (team, k, ctrl, name, key) => ({ id: G.nextId++, key: key || null, team, ctrl, isBot: ctrl === 'bot', name, x: 0, y: 0, z: 0, vy: 0, onGround: true, yaw: team ? Math.PI : 0, pitch: 0, hp: 100, alive: false, respawnT: 0.3 + k * 0.15, kills: 0, deaths: 0, caps: 0, ammo: loadout(), cur: 'rifle', reloadT: 0, swapT: 0, cd: 0, crouch: false, hurtT: 0, lastHurt: -9, invuln: 0, anim: 0, spd: 0, deathT: 0, skin: SKIN[(k + team * 2) % SKIN.length], spotT: -9, bloom: 0, refillT: 0, refillCd: 0, trig: false, sprinting: false,
    gren: CONFIG.grenade.start, grenCd: 0,
    in: { mx: 0, mz: 0, dx: 0, dy: 0, fire: false, aim: false, jump: false, crouch: false, reload: false, sprint: false, swap: false, use: false, gren: false },
    ai: ctrl === 'bot' ? { path: null, pi: 0, goal: -1, target: null, react: 0, seenT: -9, last: null, strafe: 1, strafeT: 0, stuckT: 0, lx: 0, lz: 0, stuck: 0, burst: 0, burstGap: 0, ex: 0, ey: 0, holdT: 0, lookYaw: 0, heard: null, think: rnd() * 0.2, wantPath: false, fail: 0, mode: 'roam', track: 0 } : null });
  G.mk = mk;
  const BOT_NAMES = ['Zeca', 'Tonho', 'Biu', 'Neguinho', 'Marreta', 'Cabeça', 'Fumaça', 'Tatu', 'Pezão', 'Ligeiro'];
  // um jogador assume o lugar de um bot do time escolhido (mantém posição, vida e placar do personagem)
  G.takeOver = (team, name, key) => { const a = G.actors.find(q => q.isBot && q.team === team && q.alive) || G.actors.find(q => q.isBot && q.team === team); if (!a) return null; a.isBot = false; a.ctrl = 'remote'; a.ai = null; a.name = name; a.key = key || null; a.in = mk(team, 0, 'remote', '').in; G.nextId--; return a; };
  // quando o jogador sai, o personagem volta a ser bot (os times continuam completos)
  G.toBot = a => { const t = mk(a.team, 0, 'bot', ''); G.nextId--; a.isBot = true; a.ctrl = 'bot'; a.ai = t.ai; a.key = null; a.in = t.in; a.name = BOT_NAMES[a.id % BOT_NAMES.length] + ' (bot)'; return a; };
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
  const AL = [0]; for (let q = 1; q < AVE_PTS.length; q++) AL.push(AL[q - 1] + Math.hypot(AVE_PTS[q][0] - AVE_PTS[q - 1][0], AVE_PTS[q][1] - AVE_PTS[q - 1][1])); const ALEN = AL[AL.length - 1];
  const aveAt = sPos => { let q = 1; while (q < AL.length - 1 && AL[q] < sPos) q++; const a = AVE_PTS[q - 1], b = AVE_PTS[q], seg = AL[q] - AL[q - 1], t = clamp((sPos - AL[q - 1]) / seg, 0, 1); return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, tx: (b[0] - a[0]) / seg, tz: (b[1] - a[1]) / seg }; };
  G.aveAt = aveAt; G.aveLen = ALEN;
  for (let k = 0; k < CONFIG.cars; k++) { const dir = k % 2 ? -1 : 1, n = Math.floor(k / 2); G.cars.push({ id: k, dir, s: (n + (dir > 0 ? 0 : 0.5)) * ALEN / Math.ceil(CONFIG.cars / 2), spd: 8, max: 7 + rnd() * 3, col: CAR_COL[k % CAR_COL.length], van: k % 4 === 3, x: 0, z: 0, fx: 0, fz: 1 }); }
  const carPose = c => { const p = aveAt(c.s), fx = p.tx * c.dir, fz = p.tz * c.dir, rx = -fz, rz = fx; c.x = p.x + rx * LANE_X; c.z = p.z + rz * LANE_X; c.fx = fx; c.fz = fz; };
  G.cars.forEach(carPose); G.carPose = carPose;
  function updateCars(dt) {
    W.dyn.length = 0;
    for (const c of G.cars) {
      let target = c.max;
      const blocks = a => { if (!a.alive) return false; const dx = a.x - c.x, dz = a.z - c.z, al = dx * c.fx + dz * c.fz, la = -dx * c.fz + dz * c.fx; return al > 0 && al < 15 && Math.abs(la) < 2.2; };
      for (const a of G.actors) if (blocks(a)) { target = 0; c.wait = (c.wait || 0) + dt;
        // bot parado na frente do carro: sai da faixa para o lado mais próximo da calçada
        if (a.ai && c.wait > 1.5 && !(a.ai.side > 0)) { const la = -(a.x - c.x) * c.fz + (a.z - c.z) * c.fx, sgn = la >= 0 ? 1 : -1; a.ai.sx = -c.fz * sgn; a.ai.sz = c.fx * sgn; a.ai.side = 1.4; }
        if (a.ai && c.wait > 5) { const la = -(a.x - c.x) * c.fz + (a.z - c.z) * c.fx, sgn = la >= 0 ? 1 : -1; for (const d of [3.2, 4.5, 6]) { const nx = a.x - c.fz * sgn * d, nz = a.z + c.fx * sgn * d; if (W.fits(nx, nz, a.y, 0.3)) { a.x = nx; a.z = nz; a.y = W.groundAt(nx, nz, 0.3); c.wait = 0; break; } } }
        break; }
      if (target) c.wait = 0;
      if (target) for (const n of G.npcs) if (blocks(n)) { target = 0; break; }
      for (const o of G.cars) if (o !== c && o.dir === c.dir) { const d = (o.s - c.s) * c.dir; if (d > 0 && d < 12) target = Math.min(target, Math.max(0, (d - 7.5) * 2)); }
      c.spd += clamp(target - c.spd, -6 * dt, 3.5 * dt); c.s += c.dir * c.spd * dt; // freia como carro de verdade: quem entra na frente em cima da hora é atropelado
      if (c.s > ALEN) c.s -= ALEN; if (c.s < 0) c.s += ALEN;
      carPose(c); W.dyn.push({ x: c.x, z: c.z, fx: c.fx, fz: c.fz, hl: 2.3, hw: 1.0, top: c.van ? 2.0 : 1.5 }); runOver(c);
    }
    updatePolice(dt);
  }
  const CAR_KILLER = { id: -1, team: -1, name: 'Carro', kills: 0, x: 0, y: 0, z: 0 };
  function runOver(c) { if (c.spd < 2.5) return; for (const v of [...G.actors, ...G.npcs]) { if (!v.alive) continue; const dx = v.x - c.x, dz = v.z - c.z, al = dx * c.fx + dz * c.fz, la = -dx * c.fz + dz * c.fx; if (Math.abs(al) < 2.6 && Math.abs(la) < 1.3 && v.y < 1.6) { const inv = v.invuln; v.invuln = 0; CAR_KILLER.x = c.x; CAR_KILLER.z = c.z; damage(v, 999, CAR_KILLER, false, 'car'); if (!v.npc) v.invuln = inv; emit({ type: 'runover', v: v.id, x: v.x, z: v.z }); } } }
  G.updateCars = updateCars;
  // ---------- POLÍCIA: de tempos em tempos escolhe um time e faz uma operação na favela dele ----------
  // As viaturas descem a Avenida das Américas, pegam a passagem de baixo e entram na favela; os policiais desembarcam e tentam tomar as bases.
  const PC = CONFIG.police, PZ = G.police, between = r => r[0] + rnd() * (r[1] - r[0]); PZ.next = between(PC.first);
  const junction = (() => { let bi = 0, bd = 1e9; BOTTOM_ROAD.forEach((p, i) => { const d = Math.abs(p[0] - aveX(p[1])); if (d < bd) { bd = d; bi = i; } }); return bi; })();
  function policeRoute(team) { const pts = []; for (const p of AVE_PTS) { if (p[1] < BOTTOM_ROAD[junction][1] + 4) break; pts.push([p[0] - LANE_X * 0.9, p[1]]); } pts.push([aveX(BOTTOM_ROAD[junction][1] + 4) - 1, BOTTOM_ROAD[junction][1] + 4]);
    if (team === 0) for (let i = junction; i >= 0; i--) pts.push(BOTTOM_ROAD[i]); else for (let i = junction; i < BOTTOM_ROAD.length; i++) pts.push(BOTTOM_ROAD[i]);
    const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return { pts, L, len: L[L.length - 1] }; }
  const routeAt = (R, s2) => { let i = 1; while (i < R.L.length - 1 && R.L[i] < s2) i++; const a = R.pts[i - 1], b = R.pts[i], seg = R.L[i] - R.L[i - 1] || 1, t = clamp((s2 - R.L[i - 1]) / seg, 0, 1); return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, fx: (b[0] - a[0]) / seg, fz: (b[1] - a[1]) / seg }; };
  G.policeTargets = team => G.bases.filter(b => team === 0 ? b.id !== 'C' : b.id !== 'B'); // favela do Azul: B e A; favela do Vermelho: C e A
  function startOperation() {
    const lead = G.score[0] === G.score[1] ? (rnd() < 0.5 ? 0 : 1) : G.score[0] > G.score[1] ? 0 : 1, team = rnd() < 0.6 ? lead : 1 - lead; // sorteio, com leve preferência por quem está na frente
    const R = policeRoute(team); PZ.phase = 'chegando'; PZ.team = team; PZ.endT = G.t + between(PC.duration) + 30; PZ.ops++; PZ.cars = [];
    for (let k = 0; k < PC.cars; k++) { const car = { id: k, R, s: -k * 14, stop: R.len - 2 - k * 8.5, spd: 0, x: 0, z: 0, fx: 0, fz: -1, parked: false, crew: [] }; Object.assign(car, routeAt(R, 0)); PZ.cars.push(car); }
    emit({ type: 'police', phase: 'start', team, n: PC.cars * PC.perCar });
  }
  function disembark(car) { car.parked = true;
    for (let k = 0; k < PC.perCar; k++) { const side = k % 2 ? 1 : -1, back = (k >> 1) * 1.6 - 1.6, x = car.x - car.fz * side * 2.2 - car.fx * back, z = car.z + car.fx * side * 2.2 - car.fz * back, c = W.nearestOK(x, z, 5); if (c < 0) continue;
      const a = mk(2, k, 'bot', POLICE_NAMES[(PZ.ops * 3 + car.id * PC.perCar + k) % POLICE_NAMES.length]); a.isPolice = true; G.actors.push(a);
      a.x = W.cellX(c); a.z = W.cellZ(c); a.y = map.H[c]; a.hp = PC.hp; a.alive = true; a.invuln = 1; a.ammo = loadout(); a.cur = 'rifle'; a.gren = 1; a.yaw = Math.atan2(car.fx, car.fz); a.respawnT = -9; car.crew.push(a); }
    emit({ type: 'roster' }); if (!PZ.cars.some(c => c !== car && c.parked)) emit({ type: 'police', phase: 'incursao', team: PZ.team });
  }
  function endOperation(result) { G.actors = G.actors.filter(a => !a.isPolice); for (const b of G.bases) if (b.owner === 2) { b.owner = -1; b.prog = 0; b.polProg = 0; emit({ type: 'base', base: b.id, team: -1, from: 2 }); }
    emit({ type: 'police', phase: 'end', team: PZ.team, result }); emit({ type: 'roster' }); PZ.phase = 'idle'; PZ.cars = []; PZ.next = G.t + between(PC.every); }
  function updatePolice(dt) {
    if (PZ.phase === 'idle') { if (G.t >= PZ.next && !G.over && !opts.noPolice) startOperation(); return; }
    for (const car of PZ.cars) { if (car.parked) { W.dyn.push({ x: car.x, z: car.z, fx: car.fx, fz: car.fz, hl: 2.4, hw: 1.05, top: 1.7 }); continue; }
      let target = car.stop - car.s < 14 ? Math.max(1.5, (car.stop - car.s) * 0.8) : PC.speed;
      for (const v of [...G.actors, ...G.npcs]) { if (!v.alive || v.isPolice) continue; const dx = v.x - car.x, dz = v.z - car.z, al = dx * car.fx + dz * car.fz, la = -dx * car.fz + dz * car.fx; if (al > 0 && al < 12 && Math.abs(la) < 2.3) { target = Math.min(target, Math.max(0, (al - 4) * 1.2)); } } car.spd += clamp(target - car.spd, -7 * dt, 4 * dt); car.s += car.spd * dt;
      if (car.s >= 0) { Object.assign(car, routeAt(car.R, car.s)); W.dyn.push({ x: car.x, z: car.z, fx: car.fx, fz: car.fz, hl: 2.4, hw: 1.05, top: 1.7 }); runOver(car); }
      if (car.s >= car.stop) disembark(car); }
    if (PZ.phase === 'chegando' && PZ.cars.every(c => c.parked)) PZ.phase = 'incursao';
    if (PZ.phase === 'incursao') { const alive = G.actors.filter(a => a.isPolice && a.alive).length; if (!alive) endOperation('derrotada'); else if (G.t >= PZ.endT) endOperation('retirada'); }
  }
  G.startOperation = startOperation; G.endOperation = endOperation;
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
    a.ammo = loadout(); a.cur = 'rifle'; a.gren = CONFIG.grenade.start; a.grenCd = 0;   // nasceu na base: carregamento completo
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
  function damage(v, amt, by, head, cause) {
    if (!v.alive) return;
    if (v.npc) { v.hp -= amt; v.hurtT = 0.12; emit({ type: 'hit', v: v.id, by: by.id, head, npc: true });
      if (v.hp <= 0) { v.hp = 0; v.alive = false; v.deathT = 0; v.respawnT = CONFIG.npcRespawn; v.path = null;
        if (!v.penalized) { v.penalized = true; const tm = by.team; if (tm === 0 || tm === 1) G.score[tm] = Math.max(0, G.score[tm] - CONFIG.npcPenalty); by.npcKills = (by.npcKills || 0) + 1; emit({ type: 'npc', team: tm, by: by.id, v: v.id }); } }
      return; }
    if (v.invuln > 0) return;
    v.hp -= amt; v.hurtT = 0.12; v.lastHurt = G.t; v.lastBy = by;
    if (v.ai && !v.ai.target) v.ai.heard = { x: by.x, z: by.z, y: by.y, t: G.t };
    emit({ type: 'hit', v: v.id, by: by.id, head });
    if (v.hp <= 0) { v.hp = 0; v.alive = false; v.deaths++; v.respawnT = v.isPolice ? -9 : CONFIG.respawn; v.deathT = 0; v.killer = by; v.refillT = 0;
      if (by.kills != null) by.kills++; G.feed.unshift({ k: by.id, v: v.id, head, t: G.t, cause }); if (G.feed.length > 5) G.feed.pop(); emit({ type: 'kill', v: v.id, by: by.id, head, cause }); }
  }
  // recarga: só transfere da reserva o que falta no carregador (nunca cria munição)
  function startReload(a) { const w = a.ammo[a.cur], wc = W_(a.cur); if (!a.alive || a.reloadT > 0 || a.swapT > 0 || w.mag >= wc.mag || w.res <= 0) return false; a.reloadT = wc.reload; emit({ type: 'reload', id: a.id, w: a.cur }); return true; }
  function finishReload(a) { const w = a.ammo[a.cur], wc = W_(a.cur), need = Math.max(0, wc.mag - w.mag), take = Math.min(need, w.res); w.mag += take; w.res -= take; emit({ type: 'reloaded', id: a.id }); }
  function swap(a, to) { const n = to || (a.cur === 'rifle' ? 'pistol' : 'rifle'); if (!a.alive || n === a.cur || !CONFIG.weapons[n]) return false; a.cur = n; a.reloadT = 0; a.swapT = W_(n).swap; a.cd = 0; emit({ type: 'swap', id: a.id, w: n }); return true; }
  // reabastecimento: só na estação do próprio time, dentro da área, segurando 3 s
  function nearStation(a) { const s = STATION(a.team); return Math.hypot(a.x - s.x, a.z - s.z) <= CONFIG.refill.radius && Math.abs(a.y - map.H[G.stationCell[a.team]]) < 2.5; }
  function needsRefill(a) { if ((a.gren || 0) < CONFIG.grenade.max) return true; for (const n in CONFIG.weapons) { const w = a.ammo[n], c = W_(n); if (w.mag < c.mag || w.res < c.res) return true; } return false; }
  function useStation(a, holding, dt) {
    if (a.refillCd > 0) a.refillCd -= dt;
    if (!holding || !a.alive || !nearStation(a) || a.refillCd > 0 || !needsRefill(a)) { if (a.refillT > 0 && holding !== 'keep') emit({ type: 'refillStop', id: a.id }); a.refillT = 0; return; }
    a.refillT += dt;
    if (a.refillT >= CONFIG.refill.time) { a.ammo = loadout(); a.gren = Math.max(a.gren || 0, CONFIG.grenade.max); a.refillT = 0; a.refillCd = CONFIG.refill.cooldown; a.reloadT = 0; emit({ type: 'refill', id: a.id }); }
  }
  // ---------- granadas (o servidor valida estoque e calcula a explosão) ----------
  // ---------- som do baile (estado no servidor: todos ouvem a mesma música no mesmo ponto) ----------
  G.baile = { on: false, t0: 0, by: 0, cd: 0 };
  const nearDesk = a => a.alive && Math.hypot(a.x - SOUND_DESK.x, a.z - SOUND_DESK.z) < CONFIG.baile.radius && Math.abs(a.y - STAGE.h) < 1.6;
  G.nearDesk = nearDesk;
  function toggleBaile(a) { if (G.t < G.baile.cd) return; G.baile.on = !G.baile.on; G.baile.t0 = G.t; G.baile.by = a.id; G.baile.cd = G.t + CONFIG.baile.cooldown; emit({ type: 'baile', on: G.baile.on, t0: G.baile.t0, id: a.id }); }
  G.grenades = []; let gid = 1;
  function throwGrenade(a) {
    const C = CONFIG.grenade; if (!a.alive || (a.gren || 0) <= 0 || a.grenCd > 0 || a.reloadT > 0) return false;
    a.gren--; a.grenCd = C.cooldown;
    const d = dirOf(a.yaw, a.pitch + 0.18), ey = a.y + eyeH(a);
    const g = { id: gid++, owner: a.id, team: a.team, x: a.x + d[0] * 0.6, y: ey - 0.2 + d[1] * 0.6, z: a.z + d[2] * 0.6, vx: d[0] * C.speed, vy: d[1] * C.speed + 1.5, vz: d[2] * C.speed, t: C.fuse };
    if (!W.fits(g.x, g.z, g.y - 0.5, 0.05)) { g.x = a.x; g.z = a.z; }
    G.grenades.push(g); emit({ type: 'gthrow', id: a.id, gid: g.id, x: g.x, y: g.y, z: g.z, vx: g.vx, vy: g.vy, vz: g.vz });
    return true;
  }
  function stepGrenade(g, dt) {
    for (let k = 0; k < 4; k++) { const h = dt / 4; g.vy -= 9.8 * h;
      const nx = g.x + g.vx * h, nz = g.z + g.vz * h;
      if (W.hCell(nx, g.z) > g.y || W.blockedAt(nx, g.z) && W.hCell(nx, g.z) > g.y - 0.1) g.vx = -g.vx * 0.45; else g.x = nx;
      if (W.hCell(g.x, nz) > g.y || W.blockedAt(g.x, nz) && W.hCell(g.x, nz) > g.y - 0.1) g.vz = -g.vz * 0.45; else g.z = nz;
      g.y += g.vy * h; const gr = Math.max(W.hCell(g.x, g.z), -1.5) + 0.08;
      if (g.y < gr) { g.y = gr; if (g.vy < 0) g.vy = -g.vy * 0.32; g.vx *= 0.72; g.vz *= 0.72; if (Math.abs(g.vy) < 0.6) g.vy = 0; } }
  }
  function explode(g) {
    const C = CONFIG.grenade, by = G.byId(g.owner) || { id: g.owner, team: g.team, kills: 0, x: g.x, y: g.y, z: g.z };
    emit({ type: 'gboom', gid: g.id, x: g.x, y: g.y, z: g.z, by: g.owner });
    const hitOne = v => { if (!v.alive || v === by || (!v.npc && v.team === g.team)) return; const d = Math.hypot(v.x - g.x, v.y + 1.0 - (g.y + 0.3), v.z - g.z); if (d > C.radius) return;
      const dx = v.x - g.x, dy = v.y + 1.0 - (g.y + 0.3), dz = v.z - g.z, L = Math.hypot(dx, dy, dz) || 1; if (W.ray(g.x, g.y + 0.3, g.z, dx / L, dy / L, dz / L, L)) return; // parede protege
      damage(v, C.damage * Math.pow(1 - d / C.radius, 1.3) + 8, by, false); };
    for (const v of G.actors) hitOne(v); for (const n of G.npcs) hitOne(n);
    for (const o of G.actors) if (o.ai && o.alive && Math.hypot(o.x - g.x, o.z - g.z) < 50) o.ai.heard = { x: g.x, z: g.z, y: g.y, t: G.t };
  }
  function updateGrenades(dt) { for (const g of G.grenades) { stepGrenade(g, dt); g.t -= dt; if (g.t <= 0) explode(g); } G.grenades = G.grenades.filter(g => g.t > 0); }
  G.stepGrenade = stepGrenade;
  // ---------- dominação ----------
  function updateBases(dt) {
    for (const b of G.bases) {
      b.inside = [0, 0, 0];
      for (const a of G.actors) if (a.alive && Math.hypot(a.x - b.x, a.z - b.z) <= b.r && Math.abs(a.y - b.h) < 2.2) b.inside[a.team]++;
      const before = b.owner, prevState = b.state, rate = 1 / CONFIG.capTime, pol = b.inside[2], t0 = b.inside[0], t1 = b.inside[1];
      if (pol && !t0 && !t1) { // polícia sozinha na base: ocupa em capTime (a barra volta ao meio e a base fica com a polícia)
        if (b.owner !== 2) { b.polProg = (b.polProg || 0) + rate * dt * Math.min(1.5, 1 + (pol - 1) * 0.25); b.state = 'capturando'; b.capTeam = 2; b.prog *= Math.max(0, 1 - rate * dt * 2); if (b.polProg >= 1) { b.polProg = 0; b.prog = 0; b.owner = 2; } }
        else b.state = 'ocupada';
      } else {
        if (!pol) b.polProg = Math.max(0, (b.polProg || 0) - rate * dt * 0.5);
        const solo = t0 && !t1 && !pol ? 0 : t1 && !t0 && !pol ? 1 : -1, contested = (t0 && t1) || (pol && (t0 || t1));
        if (contested) b.state = 'contestada';
        else if (solo >= 0) { const target = solo === 0 ? -1 : 1, n = b.inside[solo]; if (b.prog !== target) { b.prog += Math.sign(target - b.prog) * rate * dt * Math.min(1.5, 1 + (n - 1) * 0.25); if ((target - b.prog) * Math.sign(target) < 0) b.prog = target; b.state = 'capturando'; b.capTeam = solo; } else b.state = b.owner === solo ? 'dominada' : 'capturando'; }
        else { const rest = b.owner === 0 ? -1 : b.owner === 1 ? 1 : 0; if (b.prog !== rest) { const sg = Math.sign(rest - b.prog), np = b.prog + sg * rate * 0.5 * dt; b.prog = (rest - np) * sg < 0 ? rest : np; } b.state = b.owner === 2 ? 'ocupada' : b.owner >= 0 ? 'dominada' : 'neutra'; }
        // dono muda só quando a barra chega ao extremo; ao cruzar o centro a base fica neutra
        if (b.owner === 0 && b.prog > 0) b.owner = -1; if (b.owner === 1 && b.prog < 0) b.owner = -1; if (b.owner === 2 && Math.abs(b.prog) > 0.5) b.owner = -1;
        if (b.prog <= -1) { b.prog = -1; b.owner = 0; } if (b.prog >= 1) { b.prog = 1; b.owner = 1; }
      }
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
    if (a.isPolice) { const tg = G.policeTargets(PZ.team), todo = tg.filter(b => b.owner !== 2), b = (todo.length ? todo : tg).sort((p, q) => Math.hypot(p.x - a.x, p.z - a.z) - Math.hypot(q.x - a.x, q.z - a.z))[rnd() < 0.75 ? 0 : todo.length > 1 ? 1 : 0]; a.ai.mode = 'base'; return b.cell; }
    if (lowAmmo(a)) { a.ai.mode = 'refill'; return G.stationCell[a.team]; }
    a.ai.mode = 'roam';
    const enemySide = a.team === 0 ? 1 : -1; let tot = 0;
    const ws = G.goals.map(g => { let w = g.w;
      if (g.tag === 'base') { const b = G.bases[g.base]; w *= b.owner === a.team ? (b.state === 'capturando' || b.state === 'contestada' ? 40 : 3) : 34; w *= 90 / (50 + Math.hypot(b.x - a.x, b.z - a.z)); } // bots priorizam dominar as bases
      const own = CLEAR[a.team ? 'verm' : 'azul'].c, foe = CLEAR[a.team ? 'azul' : 'verm'].c, dOwn = Math.hypot(W.cellX(g.c) - own[0], g.z - own[1]), dFoe = Math.hypot(W.cellX(g.c) - foe[0], g.z - foe[1]); if (dFoe < 30) w *= 0.3; if (dOwn < 25 && g.tag !== 'base') w *= 0.4;
      if (Math.hypot(W.cellX(g.c) - a.x, g.z - a.z) < 6) w *= 0.15; tot += w; return w; });
    let r = rnd() * tot; for (let k = 0; k < ws.length; k++) { r -= ws[k]; if (r <= 0) { const g = G.goals[k]; a.ai.mode = g.tag === 'base' ? 'base' : 'roam'; return g.c; } } return G.goals[0].c;
  }
  function requestPath(a, goal) { a.ai.goal = goal; a.ai.wantPath = true; if (!pathQ.includes(a)) pathQ.push(a); }
  function botThink(a, dt) {
    const ai = a.ai, D = a.isPolice ? DIFF_FPS.dificil : G.diff;
    // arma: troca para a pistola quando o fuzil acaba; recarrega usando a reserva
    if (a.ammo[a.cur].mag === 0 && a.reloadT <= 0 && a.swapT <= 0) { if (a.ammo[a.cur].res > 0) startReload(a); else { const other = a.cur === 'rifle' ? 'pistol' : 'rifle'; if (totalAmmo(a, other) > 0) swap(a, other); } }
    if (a.cur === 'pistol' && totalAmmo(a, 'rifle') > 0 && a.reloadT <= 0 && !ai.target) swap(a, 'rifle');
    if (lowAmmo(a) && ai.mode !== 'refill' && !ai.target) { requestPath(a, G.stationCell[a.team]); ai.mode = 'refill'; ai.holdT = 0; }
    useStation(a, ai.mode === 'refill' && nearStation(a), dt);
    if (ai.mode === 'refill' && !lowAmmo(a) && !needsRefill(a)) { ai.mode = 'roam'; ai.holdT = 0.2; }
    ai.think -= dt;
    if (ai.think <= 0) { ai.think = D.think * (0.8 + rnd() * 0.5);
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
        else { fire(a, a.yaw, a.pitch, D.spread * (a.cur === 'pistol' ? 0.85 : 1) * (1 + Math.min(1, a.spd / 4) * 0.6) + (a.onGround ? 0 : 0.05)); ai.burst++; if (a.cur === 'pistol') ai.burstGap = 0.12 + rnd() * 0.15; if (ai.burst >= D.burst + Math.floor(rnd() * 3)) { ai.burst = 0; ai.burstGap = D.gap * (0.7 + rnd() * 0.6); } }
      } else if (ai.burstGap > 0) ai.burstGap -= dt;
      if ((a.gren || 0) > 0 && a.grenCd <= 0 && dist > 10 && dist < 28 && G.t - ai.seenT < 0.3 && rnd() < dt * 0.12 * (D.grenade || 1)) { // arremesso em arco, impreciso
        const v = CONFIG.grenade.speed, hgt = tg.y - (a.y + eyeH(a)), g9 = 9.8, disc = v ** 4 - g9 * (g9 * dist * dist + 2 * hgt * v * v);
        if (disc > 0) { const th = Math.atan((v * v - Math.sqrt(disc)) / (g9 * dist)), keep = a.pitch; a.pitch = th - 0.18 + (rnd() - 0.5) * 0.12; a.yaw += (rnd() - 0.5) * 0.15; throwGrenade(a); a.pitch = keep; } }
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
        if (ai.pi >= ai.path.length - 1 && d < 0.5) { ai.path = null; ai.holdT = ai.recover ? 0.05 : ai.mode === 'base' ? 4 + rnd() * 3 : ai.mode === 'refill' ? 4 : 1 + rnd() * 2.5; ai.recover = false; }
        else if (d > 1e-3) { mvx = dx / d; mvz = dz / d; const want = Math.atan2(dx, dz); if (!(ai.heard && G.t - ai.heard.t < 3)) a.yaw += clamp(angDiff(a.yaw, want), -4 * dt, 4 * dt); }
      }
    }
    const len = Math.hypot(mvx, mvz); if (len > 1) { mvx /= len; mvz /= len; }
    // atravessar a avenida: espera o carro passar (quem entra na frente de carro em movimento é atropelado)
    if (len > 0.05 && !(ai.side > 0)) { const ahead = Math.abs(polySide(a.x + mvx * 1.2, a.z + mvz * 1.2, AVE_PTS)), here = Math.abs(polySide(a.x, a.z, AVE_PTS));
      if (ahead < AVE_HW + 0.3 && here >= AVE_HW - 0.2) for (const c of [...G.cars, ...PZ.cars]) { if (c.spd < 1) continue; const dx = a.x - c.x, dz = a.z - c.z, al = dx * c.fx + dz * c.fz; if (al > -2 && al < 22 && Math.abs(-dx * c.fz + dz * c.fx) < 4.5) { mvx = 0; mvz = 0; break; } } }
    // desvio de carros parados: se bateu num carro, dá alguns passos para o lado antes de seguir
    if (ai.side > 0) { ai.side -= dt; mvx = ai.sx; mvz = ai.sz; }
    const wall = W.move(a, mvx * speed, mvz * speed, dt); a.spd = len > 0.05 ? speed : 0;
    if (tg && wall) ai.strafe = -ai.strafe;
    if (wall && !(ai.side > 0)) for (const d of W.dyn) { const dx = a.x - d.x, dz = a.z - d.z; if (dx * dx + dz * dz < 16) { const al = dx * d.fx + dz * d.fz; ai.sx = al >= 0 ? d.fx : -d.fx; ai.sz = al >= 0 ? d.fz : -d.fz; ai.side = 1.1; break; } }
    ai.stuckT += dt;
    if (ai.stuckT > 1.2) { const moved = Math.hypot(a.x - ai.lx, a.z - ai.lz), wanted = ai.path && !ai.holdT;
      if (wanted && moved < 0.35) { ai.stuck++; if (ai.stuck >= 5) { const c = nearestMain(a.x, a.z); if (c >= 0) { a.x = W.cellX(c); a.z = W.cellZ(c); a.y = map.H[c]; } G.stats.unstuck++; (G.stats.where || (G.stats.where = [])).push([Math.round(a.x), Math.round(a.z), 'mov']); ai.stuck = 0; requestPath(a, pickGoal(a)); } else if (ai.stuck >= 2) requestPath(a, pickGoal(a)); else requestPath(a, ai.goal); }
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
        if (a.ai.fail >= 3) { const c = nearestMain(a.x, a.z); if (c >= 0) { (G.stats.where || (G.stats.where = [])).push([Math.round(a.x), Math.round(a.z), 'path']); a.x = W.cellX(c); a.z = W.cellZ(c); a.y = map.H[c]; G.stats.unstuck++; } a.ai.fail = 0; a.ai.path = null; a.ai.holdT = 0.2; }
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
      a.grenCd = Math.max(0, (a.grenCd || 0) - dt); a.invuln = Math.max(0, a.invuln - dt); a.hurtT = Math.max(0, a.hurtT - dt); a.cd = Math.max(0, a.cd - dt); a.bloom = Math.max(0, a.bloom - dt * 0.12);
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
    updateGrenades(dt);
    G.dayT = (G.dayT + dt / CONFIG.dayLength) % 1;
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
    if (I.gren) { throwGrenade(a); I.gren = false; }
    if (I.use && !a.usePrev && !a.ai && nearDesk(a)) toggleBaile(a); a.usePrev = I.use;
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
  G.sectorAt = (x, z) => {
    for (const [k, nm] of [['azul', 'Base Azul — Alto da Mata'], ['verm', 'Base Vermelha — Morro do Cruzeiro'], ['A', 'Base A — Coração da Mata'], ['B', 'Base B — Largo da Serra'], ['praca', 'Praça Central'], ['C', 'Pracinha do Canal']]) if (ellR(x, z, CLEAR[k]) <= 1.15) return nm;
    if (Math.abs(x - QUADRA.x) <= QUADRA.hx + 3 && z >= QUADRA.z - QUADRA.hz - 3 && z <= STAGE.z + 3) return 'Quadra do Baile (Base C)';
    if (polyDist(x, z, BOTTOM_ROAD) <= 4) return 'Passagem de baixo';
    const dA = Math.abs(polySide(x, z, AVE_PTS)), dC = Math.abs(polySide(x, z, CANAL_PTS));
    if (dA <= AVE_HW + SIDEW + 0.5) return 'Avenida das Américas';
    if (dC <= CAN_HW + CAN_WALL + BANK_W + 0.5) return 'Canal / Valão';
    if (escAt(x, z)) return z > 66 * SC && x < 36 * SC ? 'Alto do Escadão' : 'Escadão Principal';
    const xs = x / SC, zs = z / SC;
    if (inPoly(x, z, POLY_LEFT)) { if (zs > 78) return 'Alto do Escadão'; if (xs < 30) return 'Vila da Serra'; if (zs < 22) return 'Beco da Mina'; return 'Favela do Escadão'; }
    if (inPoly(x, z, POLY_RIGHT)) { if (zs > 75 && xs < 195) return 'Vila do Valão'; if (xs > 232) return 'Vila Nova'; if (zs < 40 && xs > 205) return 'Lajes do Topo'; return 'Favela do Valão'; }
    return 'Mata Central'; };
  Object.assign(G, { throwGrenade, spawn, update, fire, damage, eyeH, bodyH, dirOf, canSee, startReload, finishReload, swap, useStation, nearStation, needsRefill, actions, totalAmmo, spawnNpc, nearestMain, hitActors });
  G.byId = id => G.actors.find(a => a.id === id) || G.npcs.find(n => n.id === id);
  return G;
}

const API = { CONFIG, TEAM, BOT_NAMES, DIFF_FPS, CELL, GX, GZ, NC, MW, ML, K_VOID, K_AVE, K_WALK, K_STREET, K_ESC, K_BECO, K_ROOF, K_BLOCK, K_PLAZA, WALKABLE,
  B_MURO, B_TANK, B_GUARD, B_WALL, B_INVIS, B_TANK2, B_SAND, B_JERSEY, B_BRICKS, B_BARREL, B_SUPPLY, B_ROCK, B_FENCE, B_MODEL, K_TRAIL, K_MATA, STEP_UP,
  SC, CLEAR, QUADRA, STAGE, SOUND_DESK, ESC, AVE_PTS, CANAL_PTS, BOTTOM_ROAD, BRIDGES, POLY_LEFT, POLY_RIGHT, TRAILS, polySide, polyDist, inPoly, escAt, ellR, CAN_HW, CAN_WALL, BANK_W,
  buildMap, makeWorld, makeGame, terrain, aveX, foldZ, mulberry, h2, clamp, sm, lerp, angDiff, STREETS, SUPPLY, PRACA, CANAL_ST, WALK_X0, WALK_X1, WALK_H, STATION, MID, AVE_HW, SIDEW, LANE_X, PARK_X, ESC_HW, ESC_X0, ESC_X1, BASEZ, WATER_X1, aveEast,
  get ESC_LAND() { return ESC_LAND; } };
if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.EscSim = API;
})(typeof window !== 'undefined' ? window : globalThis);
