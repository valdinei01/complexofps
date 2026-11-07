// ---------- utilidades ----------
function mulberry(seed) { let s = seed >>> 0; return function () { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function h2(x, z, k) { let h = (x * 374761393 + z * 668265263 + (k || 0) * 1442695041) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
function angDiff(a, b) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }

// ---------- mapa: grade de 0,5 m ----------
// Reconstrução a partir do MAPA OFICIAL (imagem de referência). Coordenadas da imagem (px) viram metros:
// x = px * 0,15 (leste) e z = (940 - py) * 0,15 (norte). Mapa: 250 m (leste-oeste) x 141 m (norte-sul).
const CELL = 0.5, MW = 250, ML = 141, GX = 500, GZ = 282, NC = GX * GZ, MID = 70;
const K_VOID = 0, K_AVE = 1, K_WALK = 2, K_STREET = 3, K_ESC = 4, K_BECO = 5, K_ROOF = 6, K_BLOCK = 7, K_PLAZA = 8, K_LOT = 9, K_TRAIL = 10, K_MATA = 11;
const WALKABLE = new Uint8Array([0, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1, 1]);
// materiais de bloco
const B_MURO = 1, B_TANK = 2, B_GUARD = 3, B_WALL = 4, B_INVIS = 5, B_TANK2 = 6, B_SAND = 7, B_JERSEY = 8, B_BRICKS = 9, B_BARREL = 10, B_SUPPLY = 11, B_ROCK = 12, B_FENCE = 13, B_MODEL = 14;
// construções modeladas em 3D (public/models): tamanho real em metros (largura x, profundidade z, altura)
const MODEL_DEFS = [{"name": "casa1", "label": "Casa de dois andares", "s": 7.6, "w": 6.33, "d": 6.58, "h": 7.45, "cx": -0.0001, "cz": 0.0001, "y0": -0.4907}, {"name": "comercio", "label": "Com\u00e9rcio", "s": 8.4, "w": 5.52, "d": 8.22, "h": 6.97, "cx": 0.0, "cz": 0.0002, "y0": -0.4149}, {"name": "skj", "label": "Casa com varanda", "s": 7.8, "w": 7.13, "d": 6.2, "h": 7.65, "cx": 0.0002, "cz": 0.0002, "y0": -0.4906}, {"name": "ssjj", "label": "Sobrado de tr\u00eas andares", "s": 9.4, "w": 5.55, "d": 4.61, "h": 9.19, "cx": -0.0003, "cz": 0.0001, "y0": -0.4891}, {"name": "xx", "label": "Casa com laje", "s": 7.6, "w": 6.18, "d": 6.23, "h": 7.44, "cx": -0.0001, "cz": 0.0001, "y0": -0.4895}, {"name": "zss", "label": "Casa geminada", "s": 8.8, "w": 7.21, "d": 8.64, "h": 6.9, "cx": 0.0003, "cz": 0.0001, "y0": -0.3744}];
const MODEL_COUNT = { casa1: 8, comercio: 6, skj: 8, ssjj: 8, xx: 8, zss: 7 };
const STEP_UP = 0.55, NAV_STEP = 0.5, NAV_DROP = 3.4;
const PXS = 0.15, P = (px, py) => [px * PXS, (940 - py) * PXS], PL = a => a.map(q => P(q[0], q[1]));
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
  azul: { c: P(360, 160), rx: 17.5, rz: 11, h: 4.5, name: 'Base Azul (Alto da Mata)' },
  A: { c: P(820, 200), rx: 17, rz: 11, h: 3, name: 'Base A (Clareira da Mata)' },
  verm: { c: P(1510, 182), rx: 18.5, rz: 11, h: 4.5, name: 'Base Vermelha (Morro do Cruzeiro)' },
  praca: { c: P(430, 712), rx: 14, rz: 10, h: 0, name: 'Praça Central' },
  C: { c: P(1225, 716), rx: 7.5, rz: 5.5, h: 0, name: 'Base C (Canal)' },
  cl1: { c: P(600, 420), rx: 6, rz: 5, h: null }, cl2: { c: P(700, 615), rx: 5.5, rz: 4.5, h: null },
};
const QUADRA = { x: 205.5, z: 65.25, hx: 13, hz: 8, h: 0.8 };   // Quadra do Baile (piso 26 x 16 m)
const STAGE = { x: 205.5, z: 77.2, hx: 5, hz: 2.2, h: 1.7 };     // palco ao norte da quadra
const SOUND_DESK = { x: 205.5, z: 76.2 };                        // mesa de som do baile (em cima do palco)
// Malha organizada de ruas (em metros). Regra: toda rua e todo beco terminam em outra rua, numa praça ou na mata —
// não existe beco sem saída (há um teste automático que confere isso).
const SEG = (name, kind, hw, pts) => ({ name, kind, hw, pts });
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
  SEG('Rua do Alto', K_STREET, 3.1, [[27, 86], [27, 108]]),
  SEG('Ladeira do Alto', K_STREET, 2.9, [[22, 77], [4, 77]]),
  // ---- Favela do Valão (direita) ----
  SEG('Rua do Valão', K_STREET, 2.7, [[150, 10], [246, 10]]),
  SEG('Rua das Lajes', K_STREET, 2.7, [[149, 26], [246, 26]]),
  SEG('Rua Vila Nova', K_STREET, 2.7, [[156, 46], [246, 46]]),
  SEG('Rua da Quadra', K_STREET, 2.7, [[176, 86], [246, 86]]),
  SEG('Travessa do Canal', K_STREET, 2.5, [[176, 10], [176, 86]]),
  SEG('Travessa do Baile', K_STREET, 2.5, [[205, 10], [205, 56]]),
  SEG('Travessa do Topo', K_STREET, 2.5, [[230, 10], [230, 86]]),
  SEG('Rua do Cruzeiro', K_STREET, 2.6, [[246, 10], [246, 95]]),
  SEG('Beco da Quadra', K_BECO, 1.9, [[176, 66], [192, 66]]),
  SEG('Beco do Pagode', K_BECO, 1.9, [[219, 66], [230, 66]]),
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
  { name: 'Trilha da Ponte', pts: PL([[1178, 214], [1110, 210], [1040, 206], [960, 200], [932, 198]]) },
];
// Escadão Principal: lances retos e patamares (sobe da Praça Central até o Alto do Escadão)
const ESC = {
  flights: [{ ax: 'z', x0: 51, x1: 57, a0: 44.5, a1: 57, h0: 0, h1: 1.7 }, { ax: 'z', x0: 51, x1: 57, a0: 61, a1: 71, h0: 1.7, h1: 3.4 }, { ax: 'x', z0: 70.5, z1: 76.5, a0: 44, a1: 34, h0: 3.4, h1: 5 }],
  lands: [{ x0: 48, x1: 60, z0: 37.5, z1: 44.5, h: 0 }, { x0: 50, x1: 58, z0: 57, z1: 61, h: 1.7 }, { x0: 44, x1: 58, z0: 71, z1: 76.5, h: 3.4 }, { x0: 22, x1: 34, z0: 68, z1: 86, h: 5 }],
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
const HILLS = [[28, 80, 5, 40, 36], [54, 117, 3.2, 44, 34], [10, 120, 3, 30, 28], [123, 110, 2.4, 40, 32], [100, 72, 1.8, 38, 36], [226, 114, 3.2, 44, 34], [244, 128, 2.6, 28, 24], [236, 46, 2.4, 32, 34], [214, 98, 1.8, 30, 22], [8, 40, 1.6, 26, 30]];
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
for (const k of ['azul', 'A', 'verm']) CLEAR[k].h = Math.round(hillsAt(CLEAR[k].c[0], CLEAR[k].c[1]) * 20) / 20; // clareira no nível natural do morro

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
    if (k < 0) { for (const key of ['praca', 'C']) if (ellR(x, z, CLEAR[key]) <= 1) { k = K_PLAZA; sn = -10; } }
    if (k < 0 && Math.abs(x - STAGE.x) <= STAGE.hx && Math.abs(z - STAGE.z) <= STAGE.hz) { k = K_PLAZA; sn = -12; }
    if (k < 0 && Math.abs(x - QUADRA.x) <= QUADRA.hx + 2 && Math.abs(z - QUADRA.z) <= QUADRA.hz + 2) { k = K_PLAZA; sn = -11; }
    if (k < 0) for (let s = 0; s < STREETS.length; s++) { const S = STREETS[s]; if (polyDist(x, z, S.pts) <= S.hw) { k = S.kind; sn = s; break; } }
    if (k < 0) for (let s = 0; s < TRAILS.length; s++) if (polyDist(x, z, TRAILS[s].pts) <= 1.5) { k = K_TRAIL; sn = 100 + s; break; }
    if (k < 0) { for (const key of ['azul', 'A', 'verm', 'cl1', 'cl2']) if (ellR(x, z, CLEAR[key]) <= 1) { k = K_MATA; sn = -20; } }
    if (k < 0) k = (inPoly(x, z, POLY_LEFT) || inPoly(x, z, POLY_RIGHT)) && adC > CAN_HW + 4 ? K_LOT : K_MATA;
    K[c] = k; SN[c] = sn;
  }
  // 1b) construções 3D: procura lotes livres de frente para uma rua (a frente do modelo, +z local, aponta para a rua)
  const models = [];
  { const isLot = c => K[c] === K_LOT, isRoad = c => K[c] === K_STREET || K[c] === K_BECO || K[c] === K_PLAZA || K[c] === K_WALK;
    const cand = []; for (let j = 4; j < GZ - 4; j += 3) for (let i = 4; i < GX - 4; i += 3) if (isLot(idx(i, j))) cand.push([i, j]);
    const RR = mulberry(seed + 555); for (let k = cand.length - 1; k > 0; k--) { const q = Math.floor(RR() * (k + 1)); const t = cand[k]; cand[k] = cand[q]; cand[q] = t; }
    // prioriza os lugares mais frequentados (praça, entrada do escadão, quadra, Base C, ruas principais) para as construções 3D aparecerem bem
    const POI = [CLEAR.praca.c, [54, 46], [QUADRA.x, QUADRA.z], CLEAR.C.c, [24, 26], [190, 10], [230, 46], [88, 30], [27, 90]];
    const score = ([i, j]) => { const x = i * CELL, z = j * CELL; let d = 1e9; for (const q of POI) d = Math.min(d, Math.hypot(q[0] - x, q[1] - z)); return d + RR() * 18; };
    const sc = new Map(cand.map(c => [c, score(c)])); cand.sort((a, b) => sc.get(a) - sc.get(b));
    const order = []; for (const D of MODEL_DEFS) for (let n = 0; n < MODEL_COUNT[D.name]; n++) order.push(D);
    for (const D of order) {
      let done = false;
      for (const [i0, j0] of cand) { if (done) break;
        for (let rot = 0; rot < 4 && !done; rot++) {
          const fw = (rot % 2 ? D.d : D.w) + 0.6, fd = (rot % 2 ? D.w : D.d) + 0.6, ci = Math.ceil(fw / CELL), cj = Math.ceil(fd / CELL);
          if (i0 + ci >= GX - 2 || j0 + cj >= GZ - 2) continue;
          let ok = true; for (let j = j0; j < j0 + cj && ok; j++) for (let i = i0; i < i0 + ci; i++) if (!isLot(idx(i, j))) { ok = false; break; }
          if (!ok) continue;
          // lado da frente: rot 0 = +z (norte), 1 = +x, 2 = -z, 3 = -x — precisa haver rua encostada
          let front = 0; for (let t = 0; t < (rot % 2 ? cj : ci); t++) { const c = rot === 0 ? idx(i0 + t, j0 + cj) : rot === 2 ? idx(i0 + t, j0 - 1) : rot === 1 ? idx(i0 + ci, j0 + t) : idx(i0 - 1, j0 + t); if (isRoad(c)) front++; }
          if (front < (rot % 2 ? cj : ci) * 0.5) continue;
          const x = (i0 + ci / 2) * CELL, z = (j0 + cj / 2) * CELL;
          if (models.some(m => Math.hypot(m.x - x, m.z - z) < (m.name === D.name ? 18 : 9))) continue;
          let gmin = 1e9; for (let j = j0; j < j0 + cj; j++) for (let i = i0; i < i0 + ci; i++) gmin = Math.min(gmin, terrain((i + 0.5) * CELL, (j + 0.5) * CELL));
          const y = Math.max(0, gmin - 0.15);
          for (let j = j0; j < j0 + cj; j++) for (let i = i0; i < i0 + ci; i++) { const c = idx(i, j); K[c] = K_BLOCK; M[c] = B_MODEL; HV[c] = terrain((i + 0.5) * CELL, (j + 0.5) * CELL); H[c] = y + D.h; }
          models.push({ name: D.name, x, z, y, rot, i0, j0, ci, cj }); done = true; } } } }
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
  for (const h of houses) if (h.cells.length < 10) { for (const c of h.cells) { K[c] = K_BLOCK; M[c] = B_MURO; comp[c] = -1; } h.dead = true; } // sobras viram muro, nunca bolsão
  // 3) alturas do chão
  for (let j = 0; j < GZ; j++) for (let i = 0; i < GX; i++) {
    const c = idx(i, j), x = (i + 0.5) * CELL, z = (j + 0.5) * CELL, g = terrain(x, z), k = K[c];
    if (k === K_BLOCK && M[c] === B_MODEL) continue;
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
  for (let gz = 2; gz < ML - 2; gz += 4.2) for (let gx = 2; gx < MW - 2; gx += 4.2) {
    const x = gx + (h2(gx * 7 | 0, gz * 7 | 0, 1) - 0.5) * 3, z = gz + (h2(gx * 7 | 0, gz * 7 | 0, 2) - 0.5) * 3, i = Math.floor(x / CELL), j = Math.floor(z / CELL), c = idx(i, j);
    if (K[c] !== K_MATA || SN[c] === -20) continue;
    const r = h2(i, j, 3); if (r < 0.12) continue;
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
  { const [cx, cz] = Cz('praca'); cover(cx - 7, cz - 3, cx - 6, cz - 2, B_BRICKS, 1.15); cover(cx + 6, cz + 2, cx + 7, cz + 3, B_BRICKS, 1.15); cover(cx - 1, cz - 6.5, cx + 1.5, cz - 6, B_JERSEY, 1.0); }
  { const [cx, cz] = Cz('C'); cover(cx - 4.5, cz + 2, cx - 3.5, cz + 3, B_BARREL, 1.0); cover(cx + 3, cz - 3, cx + 4.5, cz - 2.5, B_SAND, 0.9); }
  for (const t of [0, 1]) { const s = SUPPLY[t]; cover(s.x - 0.75, s.z + 0.6, s.x + 0.75, s.z + 1.1, B_SUPPLY, 1.0); }
  // alambrado da quadra (lados leste e oeste, com portões)
  for (let j = 0; j < GZ; j++) for (const xs of [QUADRA.x - QUADRA.hx - 1.75, QUADRA.x + QUADRA.hx + 1.75]) { const z = (j + 0.5) * CELL; if (Math.abs(z - QUADRA.z) > QUADRA.hz + 1.5 || Math.abs(z - QUADRA.z) < 2.2) continue; const c = idx(Math.floor(xs / CELL), j); if (K[c] === K_PLAZA) { K[c] = K_BLOCK; M[c] = B_FENCE; HV[c] = H[c]; H[c] += 3.2; } }
  for (let c = 0; c < NC; c++) HV[c] = (K[c] === K_BLOCK && M[c] === B_SUPPLY) ? H[c] - 1.0 : (K[c] === K_BLOCK && (M[c] === B_INVIS || M[c] === B_FENCE || M[c] === B_MODEL)) ? HV[c] : H[c];
  ESC_LAND = ESC.lands.map(l => ({ x: (l.x0 + l.x1) / 2, z: (l.z0 + l.z1) / 2, hx: (l.x1 - l.x0) / 2, hz: (l.z1 - l.z0) / 2, h: l.h }));
  const map = { K, H, HV, M, HID, SN, CT, CB, houses, idx, decor: [], poles: [], cars: [], lamps: [], trees, rocks, bushes, models, seed, x0Esc: ESC_X0 };
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
