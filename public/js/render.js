/* Complexo do Escadão 3D — renderização WebGL (texturas procedurais, geometria e decoração). */
(function () {
'use strict';
const S = window.EscSim;
const { K_TRAIL, K_MATA, B_ROCK, B_FENCE, B_MODEL, MODEL_DEFS, CLEAR, QUADRA, STAGE, ESC, AVE_PTS, CANAL_PTS, BOTTOM_ROAD, BRIDGES, polySide, polyDist, CAN_HW, CAN_WALL, BANK_W, aveEast, CELL, GX, GZ, NC, K_VOID, K_AVE, K_WALK, K_STREET, K_ESC, K_BECO, K_ROOF, K_BLOCK, K_PLAZA, WALKABLE, B_MURO, B_TANK, B_GUARD, B_WALL, B_INVIS, B_TANK2, B_SAND, B_JERSEY, B_BRICKS, B_BARREL, B_SUPPLY, mulberry, h2, clamp, lerp, aveX, terrain, CANAL_ST, SUPPLY, WALK_X0, WALK_X1, TEAM } = S;
// ---------- texturas procedurais ----------
const T_ASPH = 0, T_CONC = 1, T_BRICK = 2, T_WIN_A = 3, T_WIN_B = 4, T_PLASTER = 5, T_SHOP = 6, T_DOOR = 7, T_SLAB = 8, T_STEP = 9, T_EARTH = 10, T_TANK = 11, T_AZUL = 12, T_MURO = 13, T_ZINC = 14, T_WATER = 15;
function makeAtlas() {
  const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S * 4; const g = cv.getContext('2d');
  const R = mulberry(4242);
  const glass = []; let off = [0, 0];
  const tile = (t, fn) => { off = [(t % 4) * S, Math.floor(t / 4) * S]; g.save(); g.translate((t % 4) * S, Math.floor(t / 4) * S); g.beginPath(); g.rect(0, 0, S, S); g.clip(); fn(g); g.restore(); };
  const LOWPOLY = 0.3; // intensidade dos detalhes de textura (estilo low poly: cores chapadas)
  const speck = (n, c, a, sz) => { a *= LOWPOLY; n = Math.ceil(n * 0.5); for (let k = 0; k < n; k++) { g.fillStyle = c; g.globalAlpha = a * R(); const s = sz * (0.4 + R()); g.fillRect(R() * S, R() * S, s, s); } g.globalAlpha = 1; };
  const grime = (h0) => { const gr = g.createLinearGradient(0, h0, 0, S); gr.addColorStop(0, 'rgba(60,50,40,0)'); gr.addColorStop(1, 'rgba(60,50,40,0.1)'); g.fillStyle = gr; g.fillRect(0, 0, S, S); for (let k = 0; k < 14; k++) { g.fillStyle = 'rgba(70,60,50,' + (0.05 + R() * 0.08) + ')'; const x = R() * S; g.fillRect(x, R() * 40, 2 + R() * 4, 40 + R() * 140); } };
  const plaster = (base) => { g.fillStyle = base; g.fillRect(0, 0, S, S); speck(900, '#000', 0.06, 2); speck(500, '#fff', 0.08, 2); };
  const windowAt = (x, y, w, h, kind) => {
    g.fillStyle = '#3b3a37'; g.fillRect(x - 4, y - 4, w + 8, h + 8);
    glass.push([off[0] + x, off[1] + y, w, h]);
    const gr = g.createLinearGradient(x, y, x + w, y + h); gr.addColorStop(0, '#5d7286'); gr.addColorStop(0.5, '#2b3540'); gr.addColorStop(1, '#495a69'); g.fillStyle = gr; g.fillRect(x, y, w, h);
    g.fillStyle = '#c9ccd0'; g.fillRect(x + w / 2 - 2, y, 4, h); g.fillRect(x, y + h / 2 - 2, w, 3);
    if (kind === 1) { g.strokeStyle = '#1f1f1f'; g.lineWidth = 3; for (let k = 1; k < 6; k++) { g.beginPath(); g.moveTo(x + k * w / 6, y - 3); g.lineTo(x + k * w / 6, y + h + 3); g.stroke(); } g.beginPath(); g.moveTo(x - 3, y + h * 0.33); g.lineTo(x + w + 3, y + h * 0.33); g.moveTo(x - 3, y + h * 0.66); g.lineTo(x + w + 3, y + h * 0.66); g.stroke(); }
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x - 6, y + h + 4, w + 12, 6);
  };
  tile(T_ASPH, () => { g.fillStyle = '#4a4a4c'; g.fillRect(0, 0, S, S); speck(1600, '#000', 0.12, 2); speck(900, '#9a9a9a', 0.1, 2); g.strokeStyle = 'rgba(20,20,20,.5)'; g.lineWidth = 1.5; for (let k = 0; k < 4; k++) { g.beginPath(); let x = R() * S, y = R() * S; g.moveTo(x, y); for (let q = 0; q < 6; q++) { x += (R() - 0.5) * 50; y += (R() - 0.5) * 50; g.lineTo(x, y); } g.stroke(); } });
  tile(T_CONC, () => { g.fillStyle = '#b4afa6'; g.fillRect(0, 0, S, S); speck(1100, '#000', 0.06, 2); speck(600, '#fff', 0.08, 2); g.strokeStyle = 'rgba(60,55,50,.35)'; g.lineWidth = 2; g.strokeRect(1, 1, S - 2, S - 2); for (let k = 0; k < 5; k++) { g.fillStyle = 'rgba(80,70,60,' + (R() * 0.05) + ')'; g.beginPath(); g.arc(R() * S, R() * S, 20 + R() * 50, 0, 7); g.fill(); } });
  tile(T_BRICK, () => { g.fillStyle = '#8d7a68'; g.fillRect(0, 0, S, S); const bw = 64, bh = 32; for (let r = 0; r < S / bh; r++) for (let c = -1; c < S / bw + 1; c++) { const x = c * bw + (r % 2 ? bw / 2 : 0), y = r * bh; const t = R(); g.fillStyle = `rgb(${176 + t * 40 | 0},${88 + t * 30 | 0},${52 + t * 20 | 0})`; g.fillRect(x + 3, y + 3, bw - 6, bh - 6); g.fillStyle = 'rgba(70,30,15,.35)'; g.fillRect(x + 10, y + 10, bw - 20, 4); g.fillRect(x + 10, y + bh - 14, bw - 20, 4); } speck(1500, '#000', 0.12, 2); g.fillStyle = 'rgba(200,190,170,.25)'; for (let k = 0; k < 6; k++) g.fillRect(R() * S, R() * S, 20 + R() * 40, 6); });
  tile(T_WIN_A, () => { plaster('#e9e3d6'); windowAt(70, 60, 116, 92, 0); grime(140); });
  tile(T_WIN_B, () => { plaster('#e6e0d3'); windowAt(40, 70, 90, 80, 1); g.fillStyle = '#d9d9d4'; g.fillRect(160, 96, 60, 40); g.fillStyle = '#9fa3a3'; for (let k = 0; k < 6; k++) g.fillRect(166, 102 + k * 5, 48, 2); g.fillStyle = 'rgba(40,40,40,.35)'; g.fillRect(186, 136, 3, 80); grime(150); });
  tile(T_PLASTER, () => { plaster('#e8e1d2'); grime(120); g.fillStyle = 'rgba(120,110,90,.18)'; g.fillRect(0, 0, S, 10); });
  tile(T_SHOP, () => { g.fillStyle = '#d8d2c4'; g.fillRect(0, 0, S, S); g.fillStyle = '#8f9599'; g.fillRect(14, 40, S - 28, S - 40); for (let y = 44; y < S; y += 9) { g.fillStyle = '#a9afb3'; g.fillRect(14, y, S - 28, 5); g.fillStyle = '#6b7175'; g.fillRect(14, y + 5, S - 28, 2); } g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(14, 40, S - 28, 6); speck(700, '#3a2a1a', 0.2, 3); g.fillStyle = '#5b5f62'; g.fillRect(118, S - 18, 20, 8); });
  tile(T_DOOR, () => { plaster('#e7e0d1'); g.fillStyle = '#5a3d27'; g.fillRect(36, 60, 74, S - 60); g.fillStyle = '#6c4a30'; g.fillRect(42, 66, 62, S - 66); g.fillStyle = '#cfc6b0'; g.fillRect(92, 150, 6, 6); g.fillStyle = '#3a3a3a'; g.fillRect(30, 54, 86, 6); windowAt(150, 80, 70, 64, 1); g.fillStyle = 'rgba(40,30,20,.3)'; g.fillRect(0, S - 22, S, 22); grime(160); });
  tile(T_SLAB, () => { g.fillStyle = '#9b9890'; g.fillRect(0, 0, S, S); speck(3500, '#000', 0.14, 2); speck(1000, '#fff', 0.1, 2); for (let k = 0; k < 8; k++) { g.fillStyle = 'rgba(40,45,30,' + (R() * 0.15) + ')'; g.beginPath(); g.ellipse(R() * S, R() * S, 20 + R() * 50, 10 + R() * 30, R() * 3, 0, 7); g.fill(); } });
  tile(T_STEP, () => { g.fillStyle = '#aaa59b'; g.fillRect(0, 0, S, S); speck(2500, '#000', 0.14, 2); g.fillStyle = '#7d786f'; g.fillRect(0, 0, S, 18); g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(0, 18, S, 4); g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(0, S - 30, S, 30); });
  tile(T_EARTH, () => { g.fillStyle = '#6d5b3e'; g.fillRect(0, 0, S, S); const eg = g.createLinearGradient(0, 0, S, S); eg.addColorStop(0, 'rgba(120,150,80,.35)'); eg.addColorStop(1, 'rgba(90,120,60,.25)'); g.fillStyle = eg; g.fillRect(0, 0, S, S); speck(1200, '#3a2a18', 0.15, 3); for (let k = 0; k < 450; k++) { g.fillStyle = `rgba(${60 + R() * 40 | 0},${110 + R() * 60 | 0},${40 + R() * 30 | 0},${0.5 + R() * 0.5})`; const x = R() * S, y = R() * S; g.fillRect(x, y, 2, 4 + R() * 8); } });
  tile(T_TANK, () => { g.fillStyle = '#2f6fb3'; g.fillRect(0, 0, S, S); for (let y = 0; y < S; y += 32) { g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(0, y, S, 6); g.fillStyle = 'rgba(0,0,0,.15)'; g.fillRect(0, y + 26, S, 6); } speck(800, '#000', 0.1, 2); });
  tile(T_AZUL, () => { g.fillStyle = '#d7dfe3'; g.fillRect(0, 0, S, S); for (let y = 0; y < S; y += 16) for (let x = 0; x < S; x += 16) { const t = R(); g.fillStyle = `rgb(${200 + t * 30 | 0},${212 + t * 25 | 0},${220 + t * 20 | 0})`; g.fillRect(x + 1, y + 1, 14, 14); } windowAt(70, 64, 116, 88, 0); grime(170); });
  tile(T_MURO, () => { plaster('#d9d2c2'); g.fillStyle = 'rgba(120,110,95,.4)'; g.fillRect(0, 0, S, 14); const cols = ['#1d1d1d', '#c0392b', '#2471a3', '#229954', '#7d3c98', '#d68910']; g.lineCap = 'round'; for (let k = 0; k < 4; k++) { g.strokeStyle = cols[Math.floor(R() * cols.length)]; g.lineWidth = 4 + R() * 5; g.beginPath(); let x = 20 + R() * 180, y = 60 + R() * 140; g.moveTo(x, y); for (let q = 0; q < 7; q++) { x += (R() - 0.3) * 40; y += (R() - 0.5) * 40; g.quadraticCurveTo(x - 10, y - 20, x, y); } g.stroke(); } grime(120); });
  tile(T_ZINC, () => { g.fillStyle = '#8c9296'; g.fillRect(0, 0, S, S); for (let x = 0; x < S; x += 16) { g.fillStyle = 'rgba(255,255,255,.15)'; g.fillRect(x, 0, 5, S); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x + 10, 0, 5, S); } for (let k = 0; k < 10; k++) { g.fillStyle = 'rgba(140,70,30,' + R() * 0.4 + ')'; g.fillRect(R() * S, R() * S, 10 + R() * 50, 6 + R() * 30); } });
  tile(T_WATER, () => { g.fillStyle = '#3d4a33'; g.fillRect(0, 0, S, S); for (let k = 0; k < 120; k++) { g.strokeStyle = 'rgba(160,170,140,' + R() * 0.25 + ')'; g.lineWidth = 1.5; g.beginPath(); const x = R() * S, y = R() * S; g.moveTo(x, y); g.lineTo(x + 20 + R() * 30, y + (R() - 0.5) * 4); g.stroke(); } });
  for (const [x, y, w, h] of glass) { const d = g.getImageData(x, y, w, h); for (let k = 3; k < d.data.length; k += 4) d.data[k] = 128; g.putImageData(d, x, y); } // vidro: alpha 0,5
  return cv;
}
const SIGN_NAMES = ['Bar do Tião', 'Mercadinho Dois Irmãos', 'Açougue Boi Gordo', 'Oficina do Careca', 'Salão da Neide', 'Lanchonete Ponto Final', 'Depósito Rei do Tijolo', 'Pet Shop Au Au', 'Drogaria Vida Nova', 'Mercearia do Escadão', 'Bar do Escadão', 'Gás e Água do Escadão'];
const SIGN_COL = [['#c0392b', '#fff'], ['#f4d03f', '#1b2631'], ['#7b241c', '#fdebd0'], ['#1f618d', '#fff'], ['#a93272', '#fff'], ['#e67e22', '#fff'], ['#145a32', '#f9e79f'], ['#2e86c1', '#fff'], ['#17a589', '#fff'], ['#b9770e', '#fff'], ['#5b2c6f', '#f8f9f9'], ['#d35400', '#fff']];
function makeDecals(font) {
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 1024; const g = cv.getContext('2d');
  // grafite principal (0..1024 x 0..300)
  g.save();
  const txt1 = 'COMPLEXO', txt2 = 'DO ESCADÃO';
  const draw = (t, x, y, size) => {
    g.font = `${size}px ${font}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    g.lineWidth = size * 0.34; g.strokeStyle = '#111'; g.strokeText(t, x + 6, y + 8);
    g.lineWidth = size * 0.26; g.strokeStyle = '#ffd400'; g.strokeText(t, x, y);
    g.lineWidth = size * 0.1; g.strokeStyle = '#111'; g.strokeText(t, x, y);
    const gr = g.createLinearGradient(0, y - size / 2, 0, y + size / 2); gr.addColorStop(0, '#41c7ff'); gr.addColorStop(0.55, '#1f6fe0'); gr.addColorStop(1, '#13a35a'); g.fillStyle = gr; g.fillText(t, x, y);
    g.globalAlpha = 0.55; g.fillStyle = '#fff'; g.fillRect(x - size * 2.2, y - size * 0.33, size * 4.4, size * 0.07); g.globalAlpha = 1;
  };
  g.fillStyle = 'rgba(0,0,0,0)'; g.clearRect(0, 0, 1024, 300);
  // fundo em spray
  g.fillStyle = 'rgba(232,90,40,0.85)'; g.beginPath(); g.ellipse(512, 150, 500, 140, 0, 0, 7); g.fill();
  g.fillStyle = 'rgba(120,30,140,0.55)'; g.beginPath(); g.ellipse(420, 175, 360, 105, -0.05, 0, 7); g.fill();
  for (let k = 0; k < 26; k++) { g.fillStyle = 'rgba(232,90,40,0.85)'; const x = 60 + k * 36 + Math.sin(k) * 9; g.fillRect(x, 230 + Math.sin(k * 3) * 30, 6, 30 + (k * 37 % 55)); }
  draw(txt1, 512, 96, 118); draw(txt2, 512, 214, 100);
  // coroa (marca do Complexo)
  const crown = (cx, cy, w, fill) => { g.fillStyle = fill; g.strokeStyle = '#111'; g.lineWidth = w * 0.07; g.beginPath(); g.moveTo(cx - w / 2, cy + w * 0.3); g.lineTo(cx - w / 2, cy - w * 0.15); g.lineTo(cx - w / 4, cy + w * 0.05); g.lineTo(cx, cy - w * 0.3); g.lineTo(cx + w / 4, cy + w * 0.05); g.lineTo(cx + w / 2, cy - w * 0.15); g.lineTo(cx + w / 2, cy + w * 0.3); g.closePath(); g.fill(); g.stroke(); };
  crown(930, 52, 90, '#ffd400');
  g.restore();
  // placas (2 por linha, 512x64) de y=320
  SIGN_NAMES.forEach((n, i) => { const x = (i % 2) * 512, y = 320 + Math.floor(i / 2) * 64, [bg, fg] = SIGN_COL[i];
    g.fillStyle = bg; g.fillRect(x + 2, y + 2, 508, 60); g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x + 2, y + 2, 508, 8); g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 4; g.strokeRect(x + 4, y + 4, 504, 56);
    g.fillStyle = fg; g.font = `36px ${font}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(n, x + 256, y + 34, 480); });
  // pichações pequenas 4 x (256x128) em y=720
  const tags = ['ESCADÃO', 'CDE', 'TMJ', 'PAZ'];
  tags.forEach((t, i) => { const x = i * 256, y = 720; g.save(); g.translate(x + 128, y + 64); g.rotate(-0.08 + i * 0.05); g.font = `${i % 2 ? 46 : 54}px ${font}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 9; g.strokeStyle = '#111'; g.strokeText(t, 0, 0); g.fillStyle = ['#e74c3c', '#f1c40f', '#3498db', '#2ecc71'][i]; g.fillText(t, 0, 0); g.restore(); });
  // bandeira do Brasil pintada no muro (0..256 x 848..1024)
  { const x = 0, y = 848, w = 256, h = 176; g.fillStyle = '#1f9a45'; g.fillRect(x + 4, y + 4, w - 8, h - 8); g.fillStyle = '#f7d117'; g.beginPath(); g.moveTo(x + w / 2, y + 18); g.lineTo(x + w - 18, y + h / 2); g.lineTo(x + w / 2, y + h - 18); g.lineTo(x + 18, y + h / 2); g.closePath(); g.fill();
    g.fillStyle = '#20368f'; g.beginPath(); g.arc(x + w / 2, y + h / 2, 44, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 7; g.beginPath(); g.arc(x + w / 2 + 6, y + h / 2 + 70, 92, -2.25, -0.9); g.stroke();
    g.fillStyle = '#fff'; for (let k = 0; k < 14; k++) g.fillRect(x + w / 2 - 30 + (k * 37 % 60), y + h / 2 - 10 + (k * 23 % 36), 3, 3);
    g.globalAlpha = 0.25; g.fillStyle = '#000'; for (let k = 0; k < 40; k++) g.fillRect(x + (k * 61 % w), y + (k * 37 % h), 3 + k % 5, 14); g.globalAlpha = 1; }
  // emblemas dos times: caveira com coroa (azul 256.., vermelho 432..)
  const emblem = (x, col) => { const y = 848, cx = x + 88, cy = y + 96; g.fillStyle = col; g.beginPath(); g.arc(cx, cy - 6, 52, Math.PI, 0); g.lineTo(cx + 52, cy + 22); g.lineTo(cx + 30, cy + 34); g.lineTo(cx + 30, cy + 62); g.lineTo(cx - 30, cy + 62); g.lineTo(cx - 30, cy + 34); g.lineTo(cx - 52, cy + 22); g.closePath(); g.fill();
    g.fillStyle = '#111'; g.beginPath(); g.ellipse(cx - 21, cy + 6, 14, 17, 0, 0, 7); g.ellipse(cx + 21, cy + 6, 14, 17, 0, 0, 7); g.fill(); g.beginPath(); g.moveTo(cx, cy + 22); g.lineTo(cx - 7, cy + 36); g.lineTo(cx + 7, cy + 36); g.closePath(); g.fill();
    for (let k = -2; k <= 2; k++) g.fillRect(cx + k * 11 - 2, cy + 44, 4, 18); crown(cx, y + 26, 70, '#ffd400'); };
  emblem(256, '#2F7BE0'); emblem(432, '#D8402F');
  // placa MUNIÇÃO (608..1024 x 948..1020)
  { const x = 612, y = 950, w = 408, h = 68; g.fillStyle = '#1b1f1a'; g.fillRect(x, y, w, h); g.strokeStyle = '#E9A23B'; g.lineWidth = 5; g.strokeRect(x + 4, y + 4, w - 8, h - 8); g.fillStyle = '#FFD24A'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `400 40px ${font}`; g.fillText('MUNIÇÃO', x + w / 2, y + h / 2 + 2, w - 40); }
  // placa de rua (608..1024 x 848..944)
  { const x = 612, y = 852, w = 408, h = 88; g.fillStyle = '#0d6b3a'; g.fillRect(x, y, w, h); g.strokeStyle = '#fff'; g.lineWidth = 5; g.strokeRect(x + 6, y + 6, w - 12, h - 12); g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `600 34px "Rubik", Arial, sans-serif`; g.fillText('Avenida das Américas', x + w / 2, y + h / 2 + 1, w - 30); }
  return cv;
}

// ---------- geometria estática ----------
// Cada vértice guarda: posição, uv, cor do material e 4 termos de luz pré-calculados
// (sol com sombra, oclusão do ambiente, luz dos postes, brilho próprio). As cores do dia e da noite
// são aplicadas no shader, então o mesmo cenário serve para manhã, pôr do sol e noite sem refazer nada.
const SUN = (() => { const v = [-0.55, 0.62, 0.36], l = Math.hypot(v[0], v[1], v[2]); return v.map(a => a / l); })();
const AMB = [0.46, 0.5, 0.58], SUNC = [0.78, 0.68, 0.52];
const TINTS = [[0.98, 0.78, 0.72], [0.72, 0.88, 0.8], [0.99, 0.91, 0.6], [0.7, 0.8, 0.96], [0.96, 0.95, 0.92], [0.99, 0.72, 0.55], [0.86, 0.76, 0.93], [0.82, 0.91, 0.66], [0.96, 0.8, 0.82], [0.86, 0.83, 0.76], [0.6, 0.8, 0.86], [0.93, 0.62, 0.5]];
const VSTRIDE = 12;
// cor "acesa" (lâmpadas, refletores): brilha quando os postes acendem
const GLOW = (r, g, b) => [r, g, b, 0.8, 1, 0, 1];
class Geo {
  // a geometria é separada em blocos de 32 m (com caixa envolvente) para descartar o que está fora da visão
  constructor(raw) { this.raw = !!raw; this.chunks = []; this.tiles = new Map(); this.lampFn = null; }
  chunkFor(p) {
    const cx = (p[0][0] + p[2][0]) / 2, cz = (p[0][2] + p[2][2]) / 2, span = Math.max(Math.abs(p[0][0] - p[2][0]), Math.abs(p[0][2] - p[2][2]), Math.abs(p[1][0] - p[3][0]), Math.abs(p[1][2] - p[3][2]));
    const key = this.raw || span > 40 ? 'big' : Math.floor(cx / 32) + ',' + Math.floor(cz / 32);
    let ch = this.tiles.get(key);
    if (!ch || ch.n + 4 > 65000) { ch = { v: [], i: [], n: 0, box: [1e9, 1e9, 1e9, -1e9, -1e9, -1e9], always: key === 'big' }; this.tiles.set(key, ch); this.chunks.push(ch); }
    return ch;
  }
  // c: 4 entradas [r,g,b, sol, oclusão, brilho] (ou [r,g,b] = material já claro, sem sombra)
  quad(p, uv, tile, c) {
    const ch = this.chunkFor(p), b = ch.box;
    const o = tile * 128; let mu = 0, mv = 0;
    if (!this.raw) { mu = Math.floor(Math.min(uv[0][0], uv[1][0], uv[2][0], uv[3][0])); mv = Math.floor(Math.min(uv[0][1], uv[1][1], uv[2][1], uv[3][1])); }
    let nx = 0, ny = 1, nz = 0;
    if (this.lampFn) { const ax = p[1][0] - p[0][0], ay = p[1][1] - p[0][1], az = p[1][2] - p[0][2], bx = p[3][0] - p[0][0], by = p[3][1] - p[0][1], bz = p[3][2] - p[0][2]; nx = ay * bz - az * by; ny = az * bx - ax * bz; nz = ax * by - ay * bx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l; if (ny < -0.5) { nx = -nx; ny = -ny; nz = -nz; } }
    for (let k = 0; k < 4; k++) { const q = p[k], col = c[k], lamp = this.lampFn ? this.lampFn(q[0], q[1], q[2], nx, ny, nz) : 0;
      ch.v.push(q[0], q[1], q[2], uv[k][0] - mu + o, uv[k][1] - mv, col[0], col[1], col[2], col.length > 3 ? col[3] : 0.8, col.length > 4 ? col[4] : 1, lamp, col.length > 5 ? col[5] : 0);
      if (q[0] < b[0]) b[0] = q[0]; if (q[1] < b[1]) b[1] = q[1]; if (q[2] < b[2]) b[2] = q[2]; if (q[0] > b[3]) b[3] = q[0]; if (q[1] > b[4]) b[4] = q[1]; if (q[2] > b[5]) b[5] = q[2]; }
    const n = ch.n; ch.i.push(n, n + 1, n + 2, n, n + 2, n + 3); ch.n += 4;
  }
  // caixa (normal por face). faces: bitmask 1=topo 2=base 4=+x 8=-x 16=+z 32=-z. glow: 0 normal, 1 lâmpada
  box(x0, y0, z0, x1, y1, z1, tile, tint, sc, faces, shade, glow) {
    faces = faces == null ? 61 : faces; sc = sc || 1; shade = shade == null ? 1 : shade; glow = glow || (tint.length > 6 ? tint[6] : 0);
    const L = (nx, ny, nz) => [tint[0], tint[1], tint[2], Math.max(0, nx * SUN[0] + ny * SUN[1] + nz * SUN[2]), shade, glow];
    const q = (p, u, nrm) => { const c = L(nrm[0], nrm[1], nrm[2]); this.quad(p, u, tile, [c, c, c, c]); };
    const w = (x1 - x0) / sc, h = (y1 - y0) / sc, d = (z1 - z0) / sc;
    if (faces & 1) q([[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]], [[0, 0], [0, d], [w, d], [w, 0]], [0, 1, 0]);
    if (faces & 2) q([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [[0, 0], [w, 0], [w, d], [0, d]], [0, -1, 0]);
    if (faces & 4) q([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], [[0, 0], [0, h], [d, h], [d, 0]], [1, 0, 0]);
    if (faces & 8) q([[x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0]], [[0, 0], [0, h], [d, h], [d, 0]], [-1, 0, 0]);
    if (faces & 16) q([[x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [x0, y0, z1]], [[0, 0], [0, h], [w, h], [w, 0]], [0, 0, 1]);
    if (faces & 32) q([[x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]], [[0, 0], [0, h], [w, h], [w, 0]], [0, 0, -1]);
  }
}
// luz dos postes pré-calculada por vértice (grade espacial para achar as lâmpadas próximas)
function makeLampFn(lights) {
  const B = 16, grid = new Map(); for (const l of lights) { const k = Math.floor(l.x / B) + ',' + Math.floor(l.z / B); (grid.get(k) || grid.set(k, []).get(k)).push(l); }
  return (x, y, z, nx, ny, nz) => { let s = 0; const gx = Math.floor(x / B), gz = Math.floor(z / B);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const L = grid.get((gx + a) + ',' + (gz + b)); if (!L) continue;
      for (const l of L) { const dx = l.x - x, dy = l.y - y, dz = l.z - z, d = Math.hypot(dx, dy, dz); if (d > l.r || d < 1e-3) continue; const f = Math.pow(1 - d / l.r, 1.4) * l.i, face = (dx * nx + dy * ny + dz * nz) / d; s += f * Math.max(0.12, face); } }
    return Math.min(1.6, s); };
}
function buildGeometry(map) {
  const { K, H, HV, M, HID, houses, idx, SN } = map;
  const geo = new Geo(), lines = [], decals = [];
  geo.lampFn = makeLampFn(map.lights || []);
  const hAt = (x, z) => { const i = Math.floor(x / CELL), j = Math.floor(z / CELL); if (i < 0 || j < 0 || i >= GX || j >= GZ) return -50; return H[j * GX + i]; };
  const shadow = (x, y, z) => { for (let t = 0.35; t < 52; t += 0.45) { const py = y + SUN[1] * t; if (py > 40) return 1; if (hAt(x + SUN[0] * t, z + SUN[2] * t) > py) return 0.35; } return 1; };
  const lit = (tint, nx, ny, nz, sh, ao, glow) => [tint[0], tint[1], tint[2], Math.max(0, nx * SUN[0] + ny * SUN[1] + nz * SUN[2]) * sh, ao, glow || 0];
  const houseTint = h => h.style.brick ? [1, 1, 1] : TINTS[Math.floor(h.style.tint * TINTS.length)];
  // bandeira do Brasil pintada nos degraus dos dois primeiros lances do escadão
  const flagCol = (x, z) => { const F0 = ESC.flights[0], F1 = ESC.flights[1], u = (x - F0.x0) / (F0.x1 - F0.x0), v = (z - F0.a0) / (F1.a1 - F0.a0); if (u < 0 || u > 1 || v < 0 || v > 1) return null;
    const du = (u - 0.5) * (F0.x1 - F0.x0), dv = (v - 0.5) * (F1.a1 - F0.a0); if (du * du + dv * dv < 6.2) return Math.abs(dv + 0.6 - du * 0.15) < 0.3 ? [1.25, 1.25, 1.2] : [0.32, 0.42, 1.05];
    if (Math.abs(u - 0.5) * 2 + Math.abs(v - 0.5) * 2 < 0.92) return [1.3, 1.1, 0.25]; return [0.3, 0.78, 0.38]; };
  // ---- topos ----
  const topInfo = c => {
    const k = K[c], i = c % GX, j = (c / GX) | 0, x = (i + 0.5) * CELL, z = (j + 0.5) * CELL, sn = SN[c];
    switch (k) {
      case K_AVE: return [T_ASPH, 4, [1, 1, 1], 0];
      case K_WALK: return [T_CONC, 1.5, [0.95, 0.93, 0.9], 0];
      case K_STREET: if (sn === -5) return [T_CONC, 1.5, [0.72, 0.72, 0.68], 0]; if (sn === -6) return [T_CONC, 1.2, [0.88, 0.86, 0.82], 0]; if (sn === -7) return [T_ASPH, 4, [0.95, 0.95, 0.95], 0]; return [T_CONC, 2.5, [0.84, 0.81, 0.77], 0];
      case K_ESC: { const e = S.escAt(x, z); if (!e || e.flat) return [T_CONC, 2, [0.92, 0.88, 0.82], 0]; const fc = flagCol(x, z); return [T_STEP, 0, fc || [0.95, 0.92, 0.86], e.F.ax === 'z' ? 2 : e.F.a1 > e.F.a0 ? 1 : 3]; }
      case K_BECO: return [T_CONC, 1.5, [0.8, 0.76, 0.7], 0];
      case K_TRAIL: return [T_EARTH, 2, [1.05, 0.72, 0.5], 0];
      case K_MATA: return sn === -20 ? [T_EARTH, 2.5, [1.08, 0.82, 0.58], 0] : [T_EARTH, 3, [0.55, 0.78, 0.45], 0];
      case K_PLAZA: {
        if (sn === -11) { const dx = Math.abs(x - QUADRA.x), dz = Math.abs(z - QUADRA.z); if (dx <= QUADRA.hx - 1 && dz <= QUADRA.hz - 1) return [T_CONC, 3, dx < QUADRA.hx - 4 && dz < QUADRA.hz - 2.5 ? [0.38, 0.55, 0.95] : [0.98, 0.55, 0.3], 0]; return [T_CONC, 2, [0.78, 0.76, 0.74], 0]; }
        if (sn === -12) return [T_ZINC, 1, [0.35, 0.3, 0.38], 0];
        return [T_CONC, 2, [0.93, 0.86, 0.78], 0]; }
      case K_ROOF: { const h = houses[HID[c]]; return h && h.style.brick && !h.access ? [T_SLAB, 3, [0.92, 0.85, 0.8], 0] : [T_SLAB, 3, [1, 1, 1], 0]; }
      case K_BLOCK: { const m = M[c]; if (m === B_TANK) return [T_TANK, 1.2, [0.6, 0.75, 0.95], 0]; if (m === B_TANK2) return [T_SLAB, 1.2, [0.62, 0.64, 0.66], 0];
        if (m === B_INVIS || m === B_FENCE || m === B_MODEL) { if (map.CT[c] > 0 || (!S.WALKABLE[K[c]] && Math.abs(polySide(x, z, AVE_PTS)) > S.AVE_HW + S.SIDEW)) return [T_EARTH, 3, [0.55, 0.78, 0.45], 0]; return Math.abs(polySide(x, z, AVE_PTS)) <= S.AVE_HW ? [T_ASPH, 4, [1, 1, 1], 0] : [T_CONC, 2.5, [0.84, 0.81, 0.77], 0]; }
        if (m === B_GUARD) return [T_CONC, 1, [0.8, 0.8, 0.78], 0]; if (m === B_SAND) return [T_CONC, 0.6, [0.95, 0.82, 0.6], 0]; if (m === B_JERSEY) return [T_CONC, 1, [1.05, 0.95, 0.55], 0]; if (m === B_BRICKS) return [T_BRICK, 1.2, [1, 1, 1], 0]; if (m === B_BARREL) return [T_ZINC, 0.8, [0.45, 0.6, 1], 0];
        if (m === B_ROCK) return [T_EARTH, 1.5, [0.6, 0.6, 0.56], 0]; if (m === B_SUPPLY) return [T_EARTH, 3, [1.08, 0.82, 0.58], 0]; return [T_PLASTER, 2, [0.85, 0.82, 0.78], 0]; }
      default: return [T_WATER, 3, [0.7, 0.75, 0.7], 0];
    }
  };
  // CHÃO SUAVE: ruas, calçadas, praças, trilhas e mata viram uma malha contínua (alturas nos cantos),
  // sem degraus em forma de bloco. Blocos de 1 m com o mesmo material viram um único quadrado.
  const natural = c => { const k = K[c]; if (k === K_MATA || k === K_TRAIL || k === K_STREET || k === K_BECO || k === K_WALK || k === K_AVE) return true;
    if (k === K_PLAZA) return SN[c] !== -11 && SN[c] !== -12; return k === K_BLOCK && (M[c] === B_INVIS || M[c] === B_FENCE || M[c] === B_MODEL); };
  const smooth = new Uint8Array(NC), NX = GX + 1, NZ = GZ + 1, nh = new Float32Array(NX * NZ), nl = new Float32Array(NX * NZ * 2);
  for (let nj = 0; nj < NZ; nj++) for (let ni = 0; ni < NX; ni++) { let s2 = 0, n = 0, occ = 0; for (const [a, b] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) { const i = ni + a, j = nj + b; if (i < 0 || j < 0 || i >= GX || j >= GZ) continue; const c = j * GX + i; if (natural(c)) { s2 += HV[c]; n++; } else occ++; }
    nh[nj * NX + ni] = n ? s2 / n : 0; }
  for (let c = 0; c < NC; c++) if (natural(c)) smooth[c] = 1;
  const nodeLight = (ni, nj) => { const o = (nj * NX + ni) * 2; if (nl[o + 1]) return [nl[o], nl[o + 1]]; const x = ni * CELL, z = nj * CELL, y = nh[nj * NX + ni]; const ci = Math.min(GX - 1, ni), cj = Math.min(GZ - 1, nj), k = cj * GX + ci;
    let occ = 0; for (let a = -3; a <= 2; a++) for (let b = -3; b <= 2; b++) { const ii = ni + a, jj = nj + b; if (ii < 0 || jj < 0 || ii >= GX || jj >= GZ) continue; if (H[jj * GX + ii] - y > 0.9) occ++; }
    const leaf = map.CT[k] > y + 1 ? 0.6 : 1; nl[o] = shadow(x, y + 0.05, z) * leaf; nl[o + 1] = clamp(1 - occ * 0.03, 0.6, 1) * (leaf < 1 ? 0.85 : 1); return [nl[o], nl[o + 1]]; };
  const matKey = c => { const t = topInfo(c); return t[0] + '|' + t[1] + '|' + t[2].join(','); };
  const smoothQuad = (i, j, w, info) => { const ni = [i, i, i + w, i + w], nj = [j, j + w, j + w, j], Y = ni.map((a, q) => nh[nj[q] * NX + a]), x0 = i * CELL, z0 = j * CELL, x1 = (i + w) * CELL, z1 = (j + w) * CELL, sc = info[1] || 2, tint = info[2];
    const nxv = (Y[3] + Y[2] - Y[0] - Y[1]) / (2 * w * CELL), nzv = (Y[1] + Y[2] - Y[0] - Y[3]) / (2 * w * CELL), ln = Math.hypot(nxv, 1, nzv), nn = [-nxv / ln, 1 / ln, -nzv / ln], dd = Math.max(0, nn[0] * SUN[0] + nn[1] * SUN[1] + nn[2] * SUN[2]);
    const cols = ni.map((a, q) => { const L2 = nodeLight(a, nj[q]); return [tint[0], tint[1], tint[2], dd * L2[0], L2[1], 0]; });
    geo.quad([[x0, Y[0], z0], [x0, Y[1], z1], [x1, Y[2], z1], [x1, Y[3], z0]], [[x0 / sc, z0 / sc], [x0 / sc, z1 / sc], [x1 / sc, z1 / sc], [x1 / sc, z0 / sc]], info[0], cols); };
  { const done = new Uint8Array(NC);
    for (let j = 0; j + 1 < GZ; j += 2) for (let i = 0; i + 1 < GX; i += 2) { const a = j * GX + i, q = [a, a + 1, a + GX, a + GX + 1]; if (!q.every(c => smooth[c])) continue; const k0 = matKey(a); if (!q.every(c => matKey(c) === k0)) continue; smoothQuad(i, j, 2, topInfo(a)); for (const c of q) done[c] = 1; }
    for (let c = 0; c < NC; c++) if (smooth[c] && !done[c]) smoothQuad(c % GX, (c / GX) | 0, 1, topInfo(c)); }
  const tops = new Array(NC);
  for (let c = 0; c < NC; c++) {
    const i = c % GX, j = (c / GX) | 0, x = (i + 0.5) * CELL, z = (j + 0.5) * CELL, y = HV[c];
    if (smooth[c]) { tops[c] = { key: 's' }; continue; }
    const info = topInfo(c); let occ = 0;
    for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) { if (!a && !b) continue; const ni = i + a, nj = j + b; if (ni < 0 || nj < 0 || ni >= GX || nj >= GZ) continue; const d = H[nj * GX + ni] - y; if (d > 0.9) occ += (Math.abs(a) + Math.abs(b) <= 2 ? 1 : 0.5); }
    const leaf = map.CT[c] > y + 1 ? 0.55 : 1; // sombra das copas no chão da mata
    const ao = clamp(1 - occ * 0.045, 0.55, 1) * (leaf < 1 ? 0.85 : 1), sh = shadow(x, y + 0.05, z) * leaf;
    tops[c] = { info, key: info[0] + '|' + info[1] + '|' + info[2].join(',') + '|' + y.toFixed(3) + '|' + Math.round(sh * 10) + '|' + Math.round(ao * 14) + '|' + info[3] + (info[3] ? '|' + i + '|' + j : ''), col: lit(info[2], 0, 1, 0, sh, ao), y };
  }
  // fusão gulosa em retângulos
  const used = new Uint8Array(NC);
  for (let j = 0; j < GZ; j++) for (let i = 0; i < GX; i++) {
    const c = j * GX + i; if (used[c]) continue; if (smooth[c]) { used[c] = 1; continue; } const t = tops[c];
    let w = 1; while (i + w < GX && !used[c + w] && !smooth[c + w] && tops[c + w].key === t.key) w++;
    let hgt = 1; outer: while (j + hgt < GZ) { for (let q = 0; q < w; q++) { const n = (j + hgt) * GX + i + q; if (used[n] || smooth[n] || tops[n].key !== t.key) break outer; } hgt++; }
    for (let b = 0; b < hgt; b++) for (let a = 0; a < w; a++) used[(j + b) * GX + i + a] = 1;
    const x0 = i * CELL, z0 = j * CELL, x1 = (i + w) * CELL, z1 = (j + hgt) * CELL, y = t.y, [tile, sc] = t.info;
    const p = [[x0, y, z0], [x0, y, z1], [x1, y, z1], [x1, y, z0]];
    let uv; if (t.info[3] === 1) uv = [[z0 / 1.2, 0.03], [z1 / 1.2, 0.03], [z1 / 1.2, 0.97], [z0 / 1.2, 0.97]]; else if (t.info[3] === 3) uv = [[z0 / 1.2, 0.97], [z1 / 1.2, 0.97], [z1 / 1.2, 0.03], [z0 / 1.2, 0.03]]; else if (t.info[3] === 2) uv = [[x0 / 1.2, 0.03], [x0 / 1.2, 0.97], [x1 / 1.2, 0.97], [x1 / 1.2, 0.03]]; else uv = [[x0 / sc, z0 / sc], [x0 / sc, z1 / sc], [x1 / sc, z1 / sc], [x1 / sc, z0 / sc]];
    geo.quad(p, uv, tile, [t.col, t.col, t.col, t.col]);
  }
  // ---- paredes laterais ----
  const DIR = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const groundish = k => k === K_AVE || k === K_WALK || k === K_STREET || k === K_ESC || k === K_BECO || k === K_PLAZA || k === K_TRAIL || k === K_MATA;
  const faces = new Map();
  for (let c = 0; c < NC; c++) {
    const i = c % GX, j = (c / GX) | 0, y1 = HV[c];
    for (let d = 0; d < 4; d++) {
      const ni = i + DIR[d][0], nj = j + DIR[d][1]; let y0, nk;
      if (ni < 0 || nj < 0 || ni >= GX || nj >= GZ) { y0 = Math.min(0, y1 - 0.01); nk = K_VOID; } else { const n = nj * GX + ni; y0 = HV[n]; nk = K[n]; }
      if (y1 - y0 < 0.01) continue;
      if (nk !== K_VOID && smooth[c] && smooth[nj * GX + ni]) continue;
      if (nk !== K_VOID && smooth[nj * GX + ni]) y0 -= 0.3; // parede desce um pouco abaixo do chão suave (sem frestas)
      const k = K[c]; let key;
      if (k === K_ROOF) key = 'h' + HID[c] + (groundish(nk) ? 'g' : 'r');
      else if (k === K_BLOCK) key = 'b' + M[c];
      else if (k === K_VOID) key = 'v';
      else key = 'c' + k;
      const line = d < 2 ? i : j, along = d < 2 ? j : i;
      const fk = d + ':' + line; if (!faces.has(fk)) faces.set(fk, []);
      faces.get(fk).push({ along, y0, y1, key, c });
    }
  }
  const isWin = t => t === T_WIN_A || t === T_WIN_B || t === T_AZUL || t === T_DOOR || t === T_SHOP;
  const signs = [];
  for (const [fk, list] of faces) {
    const [ds, ls] = fk.split(':'), d = +ds, line = +ls; list.sort((a, b) => a.along - b.along);
    let run = null;
    const flush = () => { if (run) emitWall(d, line, run); run = null; };
    for (const f of list) {
      if (run && f.along === run.a1 + 1 && Math.abs(f.y0 - run.y0) < 0.005 && Math.abs(f.y1 - run.y1) < 0.005 && f.key === run.key && run.a1 - run.a0 < 15) run.a1 = f.along;
      else { flush(); run = { a0: f.along, a1: f.along, y0: f.y0, y1: f.y1, key: f.key, c: f.c }; }
    }
    flush();
  }
  function emitWall(d, line, r) {
    const nx = DIR[d][0], nz = DIR[d][1];
    let pA, pB;
    if (d < 2) { const x = (line + (d === 0 ? 1 : 0)) * CELL; pA = [x, r.a0 * CELL]; pB = [x, (r.a1 + 1) * CELL]; if (d === 0) { const t = pA; pA = pB; pB = t; } }
    else { const z = (line + (d === 2 ? 1 : 0)) * CELL; pA = [r.a0 * CELL, z]; pB = [(r.a1 + 1) * CELL, z]; if (d === 3) { const t = pA; pA = pB; pB = t; } }
    const len = Math.hypot(pB[0] - pA[0], pB[1] - pA[1]), alongStart = d < 2 ? (d === 0 ? (r.a1 + 1) * CELL : r.a0 * CELL) : (d === 3 ? (r.a1 + 1) * CELL : r.a0 * CELL);
    const k = K[r.c]; let tint = [0.75, 0.73, 0.7], bands = [], glow = 0;
    if (k === K_ROOF) {
      const h = houses[HID[r.c]]; tint = houseTint(h); const st = h.style, g = r.key.endsWith('g');
      glow = 2 + h2(h.id, 7, 11) * 0.999; // janelas: parte das casas fica com luz acesa à noite
      const winT = st.brick ? T_BRICK : (st.win < 0.45 ? T_WIN_A : st.win < 0.8 ? T_WIN_B : T_AZUL);
      const lowT = st.brick ? T_BRICK : st.door < 0.55 ? T_DOOR : (st.door < 0.8 ? winT : T_SHOP);
      if (g && r.y1 - r.y0 > 1.2) { const m = Math.min(r.y1, r.y0 + 2.9); bands.push([r.y0, m, lowT, 3, r.y0]); if (r.y1 > m + 0.01) bands.push([m, r.y1, winT, 3, m]); if (lowT === T_SHOP && st.door > 0.8 && r.y1 - r.y0 > 2.95 && len >= 3) signs.push({ pA, pB, y: r.y0 + 2.95, nx, nz, len, h }); }
      else bands.push([r.y0, r.y1, winT, 3, r.y0]);
    } else if (k === K_BLOCK) {
      const m = M[r.c];
      if (m === B_MURO) { tint = [0.95, 0.92, 0.86]; bands.push([r.y0, r.y1, T_MURO, 3, r.y0]); }
      else if (m === B_TANK) { tint = [0.75, 0.85, 1]; bands.push([r.y0, r.y1, T_TANK, 1.2, r.y0]); }
      else if (m === B_TANK2) { tint = [0.7, 0.72, 0.74]; bands.push([r.y0, r.y1, T_ZINC, 1.2, r.y0]); }
      else if (m === B_WALL) { tint = [0.8, 0.78, 0.74]; bands.push([r.y0, r.y1, T_MURO, 3, r.y0]); }
      else if (m === B_GUARD) { tint = [0.78, 0.78, 0.74]; bands.push([r.y0, r.y1, T_CONC, 1.5, r.y0]); }
      else if (m === B_SAND) { tint = [0.95, 0.82, 0.6]; bands.push([r.y0, r.y1, T_CONC, 0.35, r.y0]); }
      else if (m === B_JERSEY) { tint = [1.1, 0.95, 0.45]; bands.push([r.y0, r.y1, T_MURO, 1.5, r.y0]); }
      else if (m === B_BRICKS) { tint = [1, 1, 1]; bands.push([r.y0, r.y1, T_BRICK, 1.2, r.y0]); }
      else if (m === B_BARREL) { tint = [0.4, 0.55, 0.95]; bands.push([r.y0, r.y1, T_ZINC, 0.8, r.y0]); }
      else if (m === B_ROCK) { tint = [0.62, 0.6, 0.56]; bands.push([r.y0, r.y1, T_EARTH, 1.5, 0]); }
      else if (m === B_INVIS || m === B_FENCE || m === B_SUPPLY || m === B_MODEL) return;
      else { tint = [0.7, 0.68, 0.65]; bands.push([r.y0, r.y1, T_CONC, 2, r.y0]); }
    } else if (k === K_VOID) { tint = [0.72, 0.74, 0.7]; bands.push([r.y0, r.y1, T_MURO, 3, 0]); }
    else if (k === K_MATA || k === K_TRAIL) { tint = [0.85, 0.75, 0.6]; bands.push([r.y0, r.y1, T_EARTH, 2, 0]); }
    else if (k === K_ESC) { tint = [0.78, 0.75, 0.7]; bands.push([r.y0, r.y1, T_CONC, 1.5, 0]); }
    else { tint = [0.72, 0.7, 0.66]; bands.push([r.y0, r.y1, T_CONC, 2, 0]); }
    for (const [y0, y1, tile, sc, yref] of bands) {
      const vs = isWin(tile) ? 2.9 : sc, u0 = alongStart / sc, u1 = (alongStart + len) / sc, v0 = (y0 - yref) / vs, v1 = (y1 - yref) / vs;
      const pts = [[pA[0], y0, pA[1]], [pA[0], y1, pA[1]], [pB[0], y1, pB[1]], [pB[0], y0, pB[1]]];
      const cols = pts.map((p, q) => { const sh = shadow(p[0] + nx * 0.15 + (q >= 2 ? -1 : 1) * (pB[0] - pA[0]) / Math.max(len, 1e-3) * 0.05, Math.max(p[1] - 0.02, y0 + 0.05) + (q === 1 || q === 2 ? -0.05 : 0.08), p[2] + nz * 0.15 + (q >= 2 ? -1 : 1) * (pB[1] - pA[1]) / Math.max(len, 1e-3) * 0.05); const ao = (q === 0 || q === 3) && Math.abs(y0 - r.y0) < 0.01 ? 0.72 : 1; return lit(tint, nx, 0, nz, sh, ao, isWin(tile) ? glow : 0); });
      const flip = (d === 0 || d === 3), uA = flip ? u1 : u0, uB = flip ? u0 : u1;
      geo.quad(pts, [[uA, v0], [uA, v1], [uB, v1], [uB, v0]], tile, cols);
    }
  }
  map.signs = signs;
  return { geo, lines, decals, hAt, shadow, lit };
}


function buildDecor(map, W) {
  const { geo, lines, decals, hAt, lit } = W; const { K, H, HV, HID, houses, idx } = map;
  const R = mulberry(map.seed + 99);
  const L = (a, b, col, sag) => { // fio com catenária
    const n = sag ? 6 : 1, len = Math.hypot(b[0] - a[0], b[2] - a[2]);
    for (let k = 0; k < n; k++) { const t0 = k / n, t1 = (k + 1) / n, s0 = sag ? Math.sin(t0 * Math.PI) * len * 0.035 : 0, s1 = sag ? Math.sin(t1 * Math.PI) * len * 0.035 : 0;
      lines.push(lerp(a[0], b[0], t0), lerp(a[1], b[1], t0) - s0, lerp(a[2], b[2], t0), col[0], col[1], col[2], lerp(a[0], b[0], t1), lerp(a[1], b[1], t1) - s1, lerp(a[2], b[2], t1), col[0], col[1], col[2]); }
  };
  const WIRE = [0.08, 0.08, 0.08], METAL = [0.45, 0.47, 0.5], YEL = [1.15, 0.9, 0.12], BULB = GLOW(1.35, 1.25, 1.0);
  const decal = (cx, cy, cz, nx, nz, w, h, u0, v0, u1, v1) => { const rx = nz, rz = -nx, o = 0.03; const P = (a, b) => [cx + rx * a * w / 2 + nx * o, cy + b * h / 2, cz + rz * a * w / 2 + nz * o];
    decals.push({ p: [P(-1, -1), P(-1, 1), P(1, 1), P(1, -1)], uv: [[u0, v1], [u0, v0], [u1, v0], [u1, v1]], n: [nx, 0, nz] }); };
  const flat = (pts, y, tile, col, sc) => { const c = col.length > 3 ? col : [col[0], col[1], col[2], 0.8, 1, 0]; geo.quad(pts.map(p => [p[0], y + (p[2] || 0), p[1]]), pts.map(p => [p[0] / (sc || 1), p[1] / (sc || 1)]), tile, [c, c, c, c]); };
  // faixa pintada ao longo de uma polilinha (deslocada lateralmente)
  const stripe = (pts, off, hw, col, dash, y0) => { let acc = 0;
    for (let q = 0; q < pts.length - 1; q++) { const a = pts[q], b = pts[q + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]), tx = (b[0] - a[0]) / len, tz = (b[1] - a[1]) / len, nx = tz, nz = -tx;
      for (let s = 0; s < len; s += 1) { const s1 = Math.min(len, s + 1); acc += s1 - s; if (dash && Math.floor(acc / 2) % 2) continue; const P0 = [a[0] + tx * s + nx * off, a[1] + tz * s + nz * off], P1 = [a[0] + tx * s1 + nx * off, a[1] + tz * s1 + nz * off];
        const y = (y0 != null ? y0 : Math.max(hAt(P0[0], P0[1]), 0)) + 0.014; if (P0[0] < -60 || P0[0] > 310 || P0[1] < -60 || P0[1] > 200) continue;
        flat([[P0[0] - nx * hw, P0[1] - nz * hw], [P1[0] - nx * hw, P1[1] - nz * hw], [P1[0] + nx * hw, P1[1] + nz * hw], [P0[0] + nx * hw, P0[1] + nz * hw]], y, T_PLASTER, col, 0.2); } } };
  // ---- postes, luminárias e fiação ----
  for (const p of map.poles) {
    const t = p.base + 7.5; geo.box(p.x - 0.12, p.base, p.z - 0.12, p.x + 0.12, t, p.z + 0.12, T_CONC, [0.78, 0.77, 0.74], 1);
    geo.box(p.x - 0.7, t - 0.5, p.z - 0.06, p.x + 0.7, t - 0.38, p.z + 0.06, T_CONC, [0.7, 0.7, 0.7], 1);
    if (h2(p.x * 10 | 0, p.z * 10 | 0, 3) < 0.3) geo.box(p.x + 0.14, t - 2.2, p.z - 0.3, p.x + 0.6, t - 1.3, p.z + 0.3, T_ZINC, [0.55, 0.58, 0.6], 1);
    if (p.ave && p.dir) { const dx = p.dir[0], dz = p.dir[1], ex = p.x + dx * 1.6, ez = p.z + dz * 1.6; L([p.x, t - 0.15, p.z], [ex, t - 0.15, ez], METAL, false); L([p.x, t - 0.6, p.z], [ex, t - 0.15, ez], METAL, false); geo.box(ex - 0.28, t - 0.35, ez - 0.28, ex + 0.28, t - 0.18, ez + 0.28, T_PLASTER, BULB, 1); }
    else geo.box(p.x - 0.2, t - 1.45, p.z - 0.2, p.x + 0.2, t - 1.25, p.z + 0.2, T_PLASTER, BULB, 1);
    p.top = t - 0.45;
  }
  const seen = new Set();
  map.poles.forEach((p, a) => { if (p.ave) return;
    const near = map.poles.map((q, b) => ({ b, d: (q.x - p.x) ** 2 + (q.z - p.z) ** 2 })).filter(o => o.b !== a && !map.poles[o.b].ave && o.d < 500).sort((u, v) => u.d - v.d).slice(0, 3);
    for (const o of near) { const k = Math.min(a, o.b) + ':' + Math.max(a, o.b); if (seen.has(k)) continue; seen.add(k); const q = map.poles[o.b]; for (const off of [-0.55, 0, 0.55]) L([p.x + off, p.top, p.z], [q.x + off, q.top, q.z], WIRE, true); }
    for (let k = 0; k < 4; k++) { const ang = R() * Math.PI * 2, dist = 3 + R() * 6, x = p.x + Math.cos(ang) * dist, z = p.z + Math.sin(ang) * dist, i = Math.floor(x / CELL), j = Math.floor(z / CELL); if (i < 0 || j < 0 || i >= GX || j >= GZ) continue; const c = j * GX + i; if (K[c] !== K_ROOF || H[c] > p.top - 0.3) continue; L([p.x, p.top - 0.2, p.z], [x, H[c] + 0.25 + R() * 0.6, z], WIRE, true); }
  });
  // mastros de luz das praças e bases, torres da quadra
  for (const l of map.lights) { if (l.mast) { const y0 = hAt(l.x, l.z); geo.box(l.x - 0.09, y0, l.z - 0.09, l.x + 0.09, l.y, l.z + 0.09, T_ZINC, METAL, 1); geo.box(l.x - 0.45, l.y, l.z - 0.2, l.x + 0.45, l.y + 0.3, l.z + 0.2, T_PLASTER, BULB, 1); }
    if (l.tower) { const y0 = QUADRA.h; for (const [a, b] of [[-0.25, -0.25], [0.25, 0.25]]) geo.box(l.x + a - 0.06, y0, l.z + b - 0.06, l.x + a + 0.06, l.y, l.z + b + 0.06, T_ZINC, METAL, 1); geo.box(l.x - 0.9, l.y, l.z - 0.15, l.x + 0.9, l.y + 0.8, l.z + 0.15, T_ZINC, [0.3, 0.3, 0.32], 1); geo.box(l.x - 0.8, l.y + 0.08, l.z - 0.17, l.x + 0.8, l.y + 0.72, l.z + 0.17, T_PLASTER, BULB, 1, 48); } }
  // ---- Avenida das Américas: faixa dupla amarela, bordas brancas, faixas de pedestres e placas ----
  stripe(AVE_PTS, -0.12, 0.05, [1.2, 0.95, 0.3]); stripe(AVE_PTS, 0.12, 0.05, [1.2, 0.95, 0.3]);
  stripe(AVE_PTS, -S.AVE_HW + 0.3, 0.06, [1.1, 1.1, 1.1]); stripe(AVE_PTS, S.AVE_HW - 0.3, 0.06, [1.1, 1.1, 1.1]);
  stripe(BOTTOM_ROAD, 0, 0.05, [1.2, 0.95, 0.3], true);
  for (const [cx, cz] of [[S.aveX(11 * S.SC), 11 * S.SC], [S.aveX(48 * S.SC), 48 * S.SC]]) for (let k = -3; k <= 3; k++) { const z0 = cz + k * 1.1; flat([[cx - S.AVE_HW + 0.4, z0], [cx - S.AVE_HW + 0.4, z0 + 0.55], [cx + S.AVE_HW - 0.4, z0 + 0.55], [cx + S.AVE_HW - 0.4, z0]], 0.016, T_PLASTER, [1.15, 1.15, 1.12], 0.2); }
  for (const zc of [30 * S.SC, 92 * S.SC, 128 * S.SC]) { const ax = S.aveX(zc), x = ax - S.AVE_HW - 1.2; geo.box(x - 0.06, 0.15, zc - 0.06, x + 0.06, 5.1, zc + 0.06, T_ZINC, METAL, 1); geo.box(x, 4.6, zc - 0.03, x + 3.6, 4.7, zc + 0.03, T_ZINC, METAL, 1);
    decal(x + 2.0, 4.25, zc - 0.05, 0, -1, 3.4, 0.74, 612 / 1024, 852 / 1024, 1020 / 1024, 940 / 1024); decal(x + 2.0, 4.25, zc + 0.05, 0, 1, 3.4, 0.74, 612 / 1024, 852 / 1024, 1020 / 1024, 940 / 1024); }
  // ponto de ônibus na calçada leste
  { const zc = 70 * S.SC, x = S.aveX(zc) + S.AVE_HW + 1.2; geo.box(x - 0.8, 2.55, zc - 1.8, x + 0.8, 2.65, zc + 1.8, T_ZINC, [0.6, 0.62, 0.65], 1); for (const dz of [-1.6, 1.6]) geo.box(x + 0.6, 0.15, zc + dz - 0.05, x + 0.7, 2.55, zc + dz + 0.05, T_ZINC, METAL, 1); geo.box(x + 0.2, 0.55, zc - 1.2, x + 0.6, 0.62, zc + 1.2, T_ZINC, [0.5, 0.35, 0.25], 1); }
  // ---- canal: água, vegetação nas margens e pontes com guarda-corpo ----
  for (let q = 0; q < CANAL_PTS.length - 1; q++) { const a = CANAL_PTS[q], b = CANAL_PTS[q + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]), nx = (b[1] - a[1]) / len, nz = -(b[0] - a[0]) / len, w = S.CAN_HW + 0.1;
    const c = [0.55, 0.62, 0.56, 0.5, 1, 0]; geo.quad([[a[0] - nx * w, -0.95, a[1] - nz * w], [b[0] - nx * w, -0.95, b[1] - nz * w], [b[0] + nx * w, -0.95, b[1] + nz * w], [a[0] + nx * w, -0.95, a[1] + nz * w]], [[0, 0], [0, len / 3], [2, len / 3], [2, 0]], T_WATER, [c, c, c, c]);
    for (let s = 0; s < len; s += 5) for (const side of [-1, 1]) { if (h2(q * 100 + s | 0, side + 5, 7) < 0.45) continue; const off = side * (S.CAN_HW + S.CAN_WALL + S.BANK_W + 1.2), x = a[0] + (b[0] - a[0]) * s / len + nx * off, z = a[1] + (b[1] - a[1]) * s / len + nz * off, y = hAt(x, z); if (y > 3 || y < -1) continue; const sz = 0.5 + h2(s | 0, q, 3) * 0.5; geo.box(x - sz, y, z - sz, x + sz, y + 0.7 + sz * 0.6, z + sz, T_EARTH, [0.42, 0.7, 0.36], 1); } }
  for (const b of BRIDGES) { const [a, c] = b, len = Math.hypot(c[0] - a[0], c[1] - a[1]), tx = (c[0] - a[0]) / len, tz = (c[1] - a[1]) / len, nx = -tz, nz = tx;
    for (const side of [-1, 1]) { const ox = nx * 1.25 * side, oz = nz * 1.25 * side; L([a[0] + ox, S.WALK_H + 1.0, a[1] + oz], [c[0] + ox, S.WALK_H + 1.0, c[1] + oz], YEL, false); L([a[0] + ox, S.WALK_H + 0.5, a[1] + oz], [c[0] + ox, S.WALK_H + 0.5, c[1] + oz], YEL, false);
      for (let s = 0; s <= len; s += 2) { const x = a[0] + tx * s + ox, z = a[1] + tz * s + oz; geo.box(x - 0.04, S.WALK_H, z - 0.04, x + 0.04, S.WALK_H + 1.0, z + 0.04, T_ZINC, YEL, 1); } } }
  // ---- Escadão Principal: corrimãos, muretas pintadas e grafite ----
  for (const F of ESC.flights) { const n = Math.abs(F.a1 - F.a0), dir = Math.sign(F.a1 - F.a0);
    const rails = F.ax === 'z' ? [F.x0 + 0.12, (F.x0 + F.x1) / 2, F.x1 - 0.12] : [F.z0 + 0.12, (F.z0 + F.z1) / 2, F.z1 - 0.12];
    for (const r of rails) for (let s = 0; s < n - 0.5; s += 1.5) { const a0 = F.a0 + dir * s, a1 = F.a0 + dir * Math.min(n, s + 1.5), p0 = F.ax === 'z' ? [r, a0] : [a0, r], p1 = F.ax === 'z' ? [r, a1] : [a1, r];
      const y0 = (S.escAt(p0[0], p0[1]) || { h: hAt(p0[0], p0[1]) }).h, y1 = (S.escAt(p1[0], p1[1]) || { h: hAt(p1[0], p1[1]) }).h;
      geo.box(p0[0] - 0.035, y0, p0[1] - 0.035, p0[0] + 0.035, y0 + 0.95, p0[1] + 0.035, T_ZINC, YEL, 1); L([p0[0], y0 + 0.95, p0[1]], [p1[0], y1 + 0.95, p1[1]], YEL, false); L([p0[0], y0 + 0.5, p0[1]], [p1[0], y1 + 0.5, p1[1]], YEL, false); } }
  for (const l of S.ESC_LAND) for (const [dx, dz] of [[-1, -1], [1, 1]]) { const x = l.x + dx * (l.hx - 0.3), z = l.z + dz * (l.hz - 0.3); if (!S.escAt(x, z)) continue; geo.box(x - 0.08, l.h, z - 0.08, x + 0.08, l.h + 3.6, z + 0.08, T_ZINC, METAL, 1); geo.box(x - 0.3, l.h + 3.5, z - 0.3, x + 0.3, l.h + 3.7, z + 0.3, T_PLASTER, BULB, 1); }
  // grafite COMPLEXO DO ESCADÃO na parede ao norte do 2º patamar e na lateral do 1º lance
  { const yb = S.ESC_LAND[2].h + 0.6; const L2 = ESC.lands[2]; decal(L2.x0 + 7, yb + 1.3, L2.z1 - 0.03, 0, -1, 8.6, 2.5, 0, 0, 1, 300 / 1024); }
  { const F0 = ESC.flights[0], xa = F0.x1 + 0.03, xm = (F0.x0 + F0.x1) / 2; for (const zc of [F0.a0 + 6, ESC.flights[1].a0 + 4]) decal(xa, (S.escAt(xm, zc) || { h: 3 }).h + 1.9, zc, 1, 0, 7, 2.05, 0, 0, 1, 300 / 1024); }
  { const l = S.ESC_LAND[1], L1 = ESC.lands[1]; decal(L1.x0 - 0.03, l.h + 1.5, l.z, -1, 0, 2.4, 1.65, 0, 848 / 1024, 0.25, 1); }
  // ---- Praça Central: canteiros com árvores, banco, quiosque ----
  { const [cx, cz] = CLEAR.praca.c; for (const [tx, tz] of [[cx - 9, cz + 5], [cx + 9, cz + 5], [cx - 9, cz - 5], [cx + 8, cz - 6]]) { const y = hAt(tx, tz); geo.box(tx - 0.9, y, tz - 0.9, tx + 0.9, y + 0.45, tz + 0.9, T_CONC, [0.7, 0.68, 0.64], 1); geo.box(tx - 0.12, y + 0.45, tz - 0.12, tx + 0.12, y + 2.8, tz + 0.12, T_EARTH, [0.45, 0.35, 0.25], 1); for (let k = 0; k < 3; k++) geo.box(tx - 1.4 + k * 0.3, y + 2.4 + k * 0.45, tz - 1.3 + k * 0.2, tx + 1.3 - k * 0.2, y + 3.4 + k * 0.5, tz + 1.4 - k * 0.3, T_EARTH, [0.42, 0.72, 0.36], 2); }
    const ky = hAt(cx + 4, cz + 7); geo.box(cx + 2.5, ky, cz + 6, cx + 5.5, ky + 2.3, cz + 8.4, T_SHOP, [0.6, 0.75, 0.95], 3, 61); geo.box(cx + 2.2, ky + 2.3, cz + 5.7, cx + 5.8, ky + 2.45, cz + 8.7, T_ZINC, [0.3, 0.45, 0.85], 1);
    for (const bz of [cz - 2, cz + 2]) geo.box(cx - 3, hAt(cx, bz) + 0.4, bz - 0.25, cx - 1, hAt(cx, bz) + 0.48, bz + 0.25, T_ZINC, [0.5, 0.35, 0.25], 1); }
  // ---- Quadra do Baile: linhas, traves, alambrado, palco e caixas de som ----
  { const Q = QUADRA, y = Q.h + 0.013, x0 = Q.x - Q.hx + 1, x1 = Q.x + Q.hx - 1, z0 = Q.z - Q.hz + 1, z1 = Q.z + Q.hz - 1, LC = [1.25, 1.25, 1.2];
    const ln = (a, b, c, d) => flat([[a, b], [a, d], [c, d], [c, b]], y, T_PLASTER, LC, 0.2);
    ln(x0, z0, x1, z0 + 0.08); ln(x0, z1 - 0.08, x1, z1); ln(x0, z0, x0 + 0.08, z1); ln(x1 - 0.08, z0, x1, z1); ln(Q.x - 0.04, z0, Q.x + 0.04, z1);
    for (let k = 0; k < 24; k++) { const a0 = k / 24 * Math.PI * 2, a1 = (k + 1) / 24 * Math.PI * 2; flat([[Q.x + Math.cos(a0) * 1.9, Q.z + Math.sin(a0) * 1.9], [Q.x + Math.cos(a0) * 2, Q.z + Math.sin(a0) * 2], [Q.x + Math.cos(a1) * 2, Q.z + Math.sin(a1) * 2], [Q.x + Math.cos(a1) * 1.9, Q.z + Math.sin(a1) * 1.9]], y, T_PLASTER, LC, 0.2); }
    for (const xx of [x0 + 0.2, x1 - 0.2]) { geo.box(xx - 0.05, Q.h, Q.z - 1.6, xx + 0.05, Q.h + 2.1, Q.z - 1.5, T_PLASTER, [1.1, 1.1, 1.1], 1); geo.box(xx - 0.05, Q.h, Q.z + 1.5, xx + 0.05, Q.h + 2.1, Q.z + 1.6, T_PLASTER, [1.1, 1.1, 1.1], 1); geo.box(xx - 0.05, Q.h + 2, Q.z - 1.6, xx + 0.05, Q.h + 2.1, Q.z + 1.6, T_PLASTER, [1.1, 1.1, 1.1], 1); }
    for (const xs of [Q.x - Q.hx - 1.75, Q.x + Q.hx + 1.75]) { for (let z = Q.z - Q.hz - 1.5; z <= Q.z + Q.hz + 1.5; z += 2.5) { if (Math.abs(z - Q.z) < 2.2) continue; geo.box(xs - 0.05, Q.h, z - 0.05, xs + 0.05, Q.h + 3.2, z + 0.05, T_ZINC, METAL, 1); }
      for (const hy of [0.4, 1.1, 1.8, 2.5, 3.15]) { L([xs, Q.h + hy, Q.z - Q.hz - 1.5], [xs, Q.h + hy, Q.z - 2.2], [0.5, 0.52, 0.55], false); L([xs, Q.h + hy, Q.z + 2.2], [xs, Q.h + hy, Q.z + Q.hz + 1.5], [0.5, 0.52, 0.55], false); }
      for (let z = Q.z - Q.hz - 1.5; z < Q.z + Q.hz + 1.5; z += 0.6) { if (Math.abs(z - Q.z) < 2.4) continue; L([xs, Q.h, z], [xs, Q.h + 3.2, z + 0.6], [0.45, 0.47, 0.5], false); } }
    const St = STAGE; geo.box(St.x - St.hx, St.h, St.z + St.hz - 0.2, St.x + St.hx, St.h + 4, St.z + St.hz, T_ZINC, [0.18, 0.16, 0.22], 1);
    for (const sx of [-1, 1]) { geo.box(St.x + sx * St.hx - 0.15, St.h, St.z - St.hz, St.x + sx * St.hx + 0.15, St.h + 4.3, St.z - St.hz + 0.3, T_ZINC, METAL, 1); geo.box(St.x + sx * (St.hx - 1) - 0.6, St.h, St.z + 0.6, St.x + sx * (St.hx - 1) + 0.6, St.h + 1.8, St.z + 1.6, T_ZINC, [0.12, 0.12, 0.13], 1); }
    geo.box(St.x - St.hx - 0.2, St.h + 4.2, St.z - St.hz - 0.2, St.x + St.hx + 0.2, St.h + 4.45, St.z + St.hz + 0.2, T_ZINC, [0.55, 0.58, 0.62], 1);
    { const D = S.SOUND_DESK; geo.box(D.x - 1.1, St.h, D.z - 0.4, D.x + 1.1, St.h + 0.95, D.z + 0.4, T_ZINC, [0.16, 0.15, 0.18], 1); geo.box(D.x - 1.0, St.h + 0.95, D.z - 0.35, D.x + 1.0, St.h + 1.0, D.z + 0.35, T_ZINC, [0.3, 0.3, 0.34], 1); for (let k = 0; k < 6; k++) geo.box(D.x - 0.8 + k * 0.32, St.h + 1.0, D.z - 0.2, D.x - 0.68 + k * 0.32, St.h + 1.04, D.z - 0.08, T_PLASTER, GLOW(0.3 + (k % 3) * 0.4, 1.2 - (k % 3) * 0.3, 0.4), 1); }
    for (let k = 0; k < 5; k++) geo.box(St.x - 3.6 + k * 1.8 - 0.15, St.h + 3.9, St.z - St.hz + 0.1, St.x - 3.6 + k * 1.8 + 0.15, St.h + 4.15, St.z - St.hz + 0.4, T_PLASTER, GLOW(1.1, 0.5, 1.4), 1); }
  // ---- bases principais: bandeira, emblema, estação de munição; Cruzeiro e antena no morro vermelho ----
  for (const t of [0, 1]) { const C = CLEAR[t ? 'verm' : 'azul'], [cx, cz] = C.c, y = C.h, tc = TEAM[t].col, fx = cx + (t ? 9 : -9), fz = cz + 6;
    geo.box(fx - 0.05, y, fz - 0.05, fx + 0.05, y + 7, fz + 0.05, T_ZINC, [0.85, 0.85, 0.88], 1); geo.box(fx + 0.05, y + 5.6, fz - 0.02, fx + 1.9, y + 6.9, fz + 0.02, T_PLASTER, tc, 1, 48);
    const st = SUPPLY[t], sy = hAt(st.x, st.z), z0 = st.z + 0.6, z1 = st.z + 1.1;
    geo.box(st.x - 0.75, sy, z0, st.x - 0.05, sy + 0.6, z1, T_ZINC, [0.3, 0.42, 0.26], 1); geo.box(st.x + 0.05, sy, z0, st.x + 0.75, sy + 0.6, z1, T_ZINC, [0.3, 0.42, 0.26], 1); geo.box(st.x - 0.5, sy + 0.6, z0, st.x + 0.5, sy + 1.0, z1, T_ZINC, [0.35, 0.45, 0.3], 1);
    geo.box(st.x - 0.76, sy + 0.25, z0 - 0.01, st.x + 0.76, sy + 0.33, z1 + 0.01, T_PLASTER, tc, 1);
    geo.box(st.x - 1.2, sy + 2.2, z1 - 0.05, st.x + 1.2, sy + 2.8, z1 + 0.05, T_PLASTER, [0.1, 0.1, 0.1], 1, 0); decal(st.x, sy + 2.5, z0 - 0.06, 0, -1, 2.2, 0.37, 612 / 1024, 950 / 1024, 1020 / 1024, 1018 / 1024);
    const ew = cz + C.rz + 0.5; decal(cx, y + 2.2, ew - 0.6, 0, -1, 2.6, 2.6, (t ? 432 : 256) / 1024, 848 / 1024, (t ? 608 : 432) / 1024, 1); geo.box(cx - 1.6, y, ew - 0.55, cx + 1.6, y + 3.7, ew - 0.45, T_MURO, [0.8, 0.78, 0.74], 1); }
  { const [cx, cz] = CLEAR.verm.c, y = CLEAR.verm.h, x = cx - 9, z = cz + 9; geo.box(x - 0.2, y, z - 0.2, x + 0.2, y + 6, z + 0.2, T_PLASTER, [1.2, 1.2, 1.18], 1); geo.box(x - 1.4, y + 4, z - 0.2, x + 1.4, y + 4.4, z + 0.2, T_PLASTER, [1.2, 1.2, 1.18], 1);
    const ax = cx + 13, az = cz + 7; for (let k = 0; k < 6; k++) { const w = 1.4 - k * 0.2, y0 = y + k * 2.5; for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) L([ax + a * w, y0, az + b * w], [ax + a * (w - 0.2), y0 + 2.5, az + b * (w - 0.2)], [0.75, 0.2, 0.15], false); }
    geo.box(ax - 0.12, y + 15, az - 0.12, ax + 0.12, y + 15.4, az + 0.12, T_PLASTER, GLOW(1.6, 0.25, 0.2), 1); }
  // ---- mata: árvores (copas e palmeiras), pedras e arbustos ----
  // ---- vegetação low poly: copas facetadas (cada face com uma cor só), troncos de 5 lados, pedras lapidadas ----
  const tri = (a, b, c, col, sh) => { const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2]; let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l; if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; }
    const d = Math.max(0, nx * SUN[0] + ny * SUN[1] + nz * SUN[2]), k = [col[0], col[1], col[2], d * (sh == null ? 1 : sh), 0.82 + ny * 0.18, 0]; geo.quad([a, b, c, c], [[0, 0], [0.5, 1], [1, 0], [1, 0]], T_PLASTER, [k, k, k, k]); };
  const cone = (x, y0, z, r, h, n, col, rot, y1) => { const top = [x, y0 + h, z], base = []; for (let k = 0; k < n; k++) { const a = rot + k / n * Math.PI * 2; base.push([x + Math.cos(a) * r, (y1 == null ? y0 : y1), z + Math.sin(a) * r]); }
    for (let k = 0; k < n; k++) { const p0 = base[k], p1 = base[(k + 1) % n], f = 0.9 + 0.2 * ((k * 7) % 3) / 2; tri(p0, top, p1, [col[0] * f, col[1] * f, col[2] * f]); } };
  const gem = (x, y, z, r, h, n, col, rot) => { // duas pirâmides unidas pela base (copa arredondada facetada)
    const mid = []; for (let k = 0; k < n; k++) { const a = rot + k / n * Math.PI * 2; mid.push([x + Math.cos(a) * r, y + h * 0.45, z + Math.sin(a) * r]); } const top = [x, y + h, z], bot = [x, y, z];
    for (let k = 0; k < n; k++) { const p0 = mid[k], p1 = mid[(k + 1) % n], f = 0.88 + 0.24 * ((k * 5) % 4) / 3; tri(p0, top, p1, [col[0] * f, col[1] * f, col[2] * f]); tri(p0, p1, bot, [col[0] * f * 0.8, col[1] * f * 0.8, col[2] * f * 0.8], 0.6); } };
  for (const t of map.trees) { const y = t.y, rot = h2(t.x * 3 | 0, t.z * 3 | 0, 4) * 6.28;
    if (t.palm) { const top = y + t.h; cone(t.x, y, t.z, 0.2, t.h + 0.2, 5, [0.55, 0.43, 0.3], rot);
      for (let k = 0; k < 6; k++) { const a = rot + k / 6 * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a), l = t.r + 1, c = [0.34, 0.62, 0.28]; tri([t.x, top, t.z], [t.x + dx * l - dz * 0.5, top - 0.8, t.z + dz * l + dx * 0.5], [t.x + dx * l + dz * 0.5, top - 0.8, t.z + dz * l - dx * 0.5], c); } }
    else { cone(t.x, y, t.z, 0.24, t.h * 0.62, 5, [0.47, 0.36, 0.26], rot); const g0 = 0.3 + h2(t.x * 3 | 0, t.z * 3 | 0, 1) * 0.14, col = [g0, g0 + 0.34, g0 - 0.06];
      if (h2(t.x * 5 | 0, t.z * 5 | 0, 2) < 0.4) { cone(t.x, y + t.h * 0.3, t.z, t.r * 1.05, t.h * 0.5, 6, col, rot); cone(t.x, y + t.h * 0.58, t.z, t.r * 0.78, t.h * 0.45, 6, [col[0] * 1.08, col[1] * 1.08, col[2] * 1.08], rot + 0.5); }
      else gem(t.x, y + t.h * 0.36, t.z, t.r * 1.05, t.h * 0.72, 7, col, rot); } }
  for (const r of map.rocks) { const s2 = r.s, rot = h2(r.x * 7 | 0, r.z * 7 | 0, 3) * 6.28; gem(r.x, r.y - 0.25, r.z, s2 * 0.75, s2 * 1.35, 5, [0.6, 0.59, 0.55], rot); }
  for (const b of map.bushes) { const s2 = b.s, rot = h2(b.x * 7 | 0, b.z * 7 | 0, 5) * 6.28; gem(b.x, b.y - 0.1, b.z, s2, s2 * 1.25, 6, [0.36, 0.62, 0.3], rot); }
  // casas: decoração das lajes
  // decoração das lajes: caixas, antenas, varais, obras
  const CLOTH = [[0.9, 0.2, 0.2], [0.2, 0.5, 0.9], [0.95, 0.85, 0.2], [0.95, 0.95, 0.95], [0.3, 0.7, 0.3], [0.9, 0.5, 0.7]];
  for (const h of houses) {
    if (h.dead || !h.cells.length) continue;
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const c of h.cells) { const x = (c % GX) * CELL, z = ((c / GX) | 0) * CELL; x0 = Math.min(x0, x); x1 = Math.max(x1, x + CELL); z0 = Math.min(z0, z); z1 = Math.max(z1, z + CELL); }
    const roofOk = (x, z) => { const i = Math.floor(x / CELL), j = Math.floor(z / CELL); if (i < 0 || j < 0 || i >= GX || j >= GZ) return false; const c = j * GX + i; return HID[c] === h.id && K[c] === K_ROOF; };
    const y = h.top, st = h.style, r = mulberry(h.id * 31 + 7);
    if (!h.access && st.obra < 0.3 && !h.shop) { // laje em obra: pilares com vergalhões
      for (const [cx, cz] of [[x0 + 0.3, z0 + 0.3], [x1 - 0.3, z0 + 0.3], [x0 + 0.3, z1 - 0.3], [x1 - 0.3, z1 - 0.3]]) { if (!roofOk(cx, cz)) continue; geo.box(cx - 0.15, y, cz - 0.15, cx + 0.15, y + 1.2 + r() * 0.8, cz + 0.15, T_CONC, [0.75, 0.72, 0.68], 1); for (let q = 0; q < 4; q++) L([cx + (q & 1 ? 0.07 : -0.07), y + 1.4, cz + (q & 2 ? 0.07 : -0.07)], [cx + (q & 1 ? 0.1 : -0.1), y + 2.4 + r() * 0.4, cz + (q & 2 ? 0.1 : -0.1)], [0.35, 0.2, 0.12], false); }
      if (roofOk(x0 + 0.3, z0 + 0.3) && roofOk(x1 - 0.3, z0 + 0.3) && r() < 0.6) geo.box(x0 + 0.15, y, z0 + 0.05, x1 - 0.15, y + 1.0, z0 + 0.3, T_BRICK, [1, 1, 1], 1);
    }
    if (r() < 0.3) { const cx = lerp(x0, x1, 0.3 + r() * 0.4), cz = lerp(z0, z1, 0.3 + r() * 0.4); if (roofOk(cx, cz)) { L([cx, y, cz], [cx, y + 2.2, cz], METAL, false); L([cx - 0.5, y + 1.9, cz], [cx + 0.5, y + 1.9, cz], METAL, false); L([cx - 0.35, y + 1.5, cz], [cx + 0.35, y + 1.5, cz], METAL, false); } }
    if (r() < 0.25) { const cx = lerp(x0, x1, 0.2 + r() * 0.6), cz = lerp(z0, z1, 0.2 + r() * 0.6); if (roofOk(cx, cz)) geo.box(cx - 0.3, y + 0.4, cz - 0.05, cx + 0.3, y + 0.95, cz + 0.05, T_PLASTER, [0.9, 0.9, 0.9], 1); }
    if (h.access && r() < 0.45 && x1 - x0 > 3) { const cz = lerp(z0, z1, 0.5); if (roofOk(x0 + 0.6, cz) && roofOk(x1 - 0.6, cz)) { L([x0 + 0.6, y + 1.7, cz], [x1 - 0.6, y + 1.7, cz], [0.85, 0.85, 0.85], true); for (let q = 0; q < 4; q++) { const cx = lerp(x0 + 1, x1 - 1, (q + 0.5) / 4), cc = CLOTH[Math.floor(r() * CLOTH.length)]; geo.box(cx - 0.25, y + 1.0, cz - 0.02, cx + 0.25, y + 1.62, cz + 0.02, T_PLASTER, cc, 1, 60); } } }
  }
  // letreiros das lojas
  for (const s of map.signs) {
    const w = Math.min(s.len - 0.3, 4.2), cx = (s.pA[0] + s.pB[0]) / 2, cz = (s.pA[1] + s.pB[1]) / 2, ux = s.nz, uz = -s.nx, o = 0.04;
    const a = [cx - ux * w / 2 + s.nx * o, cz - uz * w / 2 + s.nz * o], b = [cx + ux * w / 2 + s.nx * o, cz + uz * w / 2 + s.nz * o];
    const si = s.h.id % SIGN_NAMES.length, u0 = (si % 2) * 0.5, v0 = (320 + Math.floor(si / 2) * 64) / 1024, v1 = v0 + 64 / 1024;
    decals.push({ p: [[a[0], s.y - 0.62, a[1]], [a[0], s.y - 0.05, a[1]], [b[0], s.y - 0.05, b[1]], [b[0], s.y - 0.62, b[1]]], uv: [[u0, v1], [u0, v0], [u0 + 0.5, v0], [u0 + 0.5, v1]], n: [s.nx, 0, s.nz] });
  }
  // ---- além dos limites: morros com mata, chão e montanhas distantes ----
  const MW = S.MW, ML = S.ML;
  geo.quad([[-400, -0.6, -400], [-400, -0.6, ML + 400], [MW + 400, -0.6, ML + 400], [MW + 400, -0.6, -400]], [[0, 0], [0, 200], [200, 200], [200, 0]], T_EARTH, [[0.4, 0.62, 0.34, 0.8, 1, 0], [0.4, 0.62, 0.34, 0.8, 1, 0], [0.4, 0.62, 0.34, 0.8, 1, 0], [0.4, 0.62, 0.34, 0.8, 1, 0]]);
  const ring = (x, z) => { const ix = Math.max(0, -x, x - MW), iz = Math.max(0, -z, z - ML); return Math.hypot(ix, iz); };
  for (let z = -90; z < ML + 90; z += 9) for (let x = -90; x < MW + 90; x += 9) { const d = ring(x + 4.5, z + 4.5); if (d < 2) continue; if (Math.abs(polySide(x, z, AVE_PTS)) < 8 || Math.abs(polySide(x, z, CANAL_PTS)) < 6) continue;
    const hh = 1.5 + d * 0.22 + 3 * Math.sin(x / 23) * Math.sin(z / 17); if (h2(x | 0, z | 0, 8) < 0.6) { const s = 2.6 + h2(x | 0, z | 0, 9) * 2.2, g = 0.32 + h2(x | 0, z | 0, 2) * 0.1; geo.box(x + 4.5 - s, hh - 3, z + 4.5 - s, x + 4.5 + s, hh + 3 + h2(x | 0, z | 0, 3) * 5, z + 4.5 + s, T_EARTH, [g, g + 0.26, g - 0.04], 3); } }
  for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2 + 0.2, dist = 340 + R() * 160, cx = MW / 2 + Math.cos(a) * dist, cz = ML / 2 + Math.sin(a) * dist, s = 90 + R() * 80, hgt = 70 + R() * 110, col = [0.38, 0.5, 0.36, 0.8, 1, 0];
    const top = [cx, hgt, cz], b = [[cx - s, -1, cz - s], [cx + s, -1, cz - s], [cx + s, -1, cz + s], [cx - s, -1, cz + s]];
    for (let q = 0; q < 4; q++) { const p0 = b[q], p1 = b[(q + 1) % 4], f = 0.7 + q * 0.1, dark = [col[0] * f, col[1] * f, col[2] * f, 0.6, 1, 0]; geo.quad([p0, top, top, p1], [[0, 0], [5, 12], [5, 12], [10, 0]], T_EARTH, [dark, col, col, dark]); } }
}


// ---------- matrizes ----------
const m4 = {
  id() { const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; },
  persp(fy, a, n, f) { const t = 1 / Math.tan(fy / 2), m = new Float32Array(16); m[0] = t / a; m[5] = t; m[10] = (f + n) / (n - f); m[11] = -1; m[14] = 2 * f * n / (n - f); return m; },
  look(e, c, u) { let zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2], l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
    let xx = u[1] * zz - u[2] * zy, xy = u[2] * zx - u[0] * zz, xz = u[0] * zy - u[1] * zx; l = Math.hypot(xx, xy, xz); xx /= l; xy /= l; xz /= l;
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx, m = new Float32Array(16);
    m[0] = xx; m[1] = yx; m[2] = zx; m[4] = xy; m[5] = yy; m[6] = zy; m[8] = xz; m[9] = yz; m[10] = zz;
    m[12] = -(xx * e[0] + xy * e[1] + xz * e[2]); m[13] = -(yx * e[0] + yy * e[1] + yz * e[2]); m[14] = -(zx * e[0] + zy * e[1] + zz * e[2]); m[15] = 1; return m; },
  mul(a, b) { const o = new Float32Array(16); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k]; o[i * 4 + j] = s; } return o; },
  tr(x, y, z) { const m = m4.id(); m[12] = x; m[13] = y; m[14] = z; return m; },
  ry(a) { const m = m4.id(), c = Math.cos(a), s = Math.sin(a); m[0] = c; m[2] = -s; m[8] = s; m[10] = c; return m; },
  rx(a) { const m = m4.id(), c = Math.cos(a), s = Math.sin(a); m[5] = c; m[6] = s; m[9] = -s; m[10] = c; return m; },
  sc(x, y, z) { const m = m4.id(); m[0] = x; m[5] = y; m[10] = z; return m; },
};
const FOG_C = [0.74, 0.79, 0.84];
// ---------- ciclo de dia e noite: hora (0..1) => cores de sol, céu, ambiente e luzes ----------
// 0 = meia-noite, 0.25 = amanhecer (6h), 0.5 = meio-dia, 0.75 = pôr do sol (18h)
function dayEnv(t, quality) {
  const a = (t - 0.25) * Math.PI * 2, e = Math.sin(a), mix3 = (p, q, k) => [lerp(p[0], q[0], k), lerp(p[1], q[1], k), lerp(p[2], q[2], k)];
  const day = clamp((e + 0.06) / 0.28, 0, 1), dusk = clamp(1 - Math.abs(e) / 0.3, 0, 1) * (e > -0.2 ? 1 : 0), night = 1 - day;
  const sunDir = (() => { const v = [Math.cos(a) * 0.9, Math.max(e, -0.2), 0.32], l = Math.hypot(v[0], v[1], v[2]); return v.map(q => q / l); })();
  const moonDir = (() => { const v = [-Math.cos(a) * 0.8, Math.max(-e, 0.15), -0.3], l = Math.hypot(v[0], v[1], v[2]); return v.map(q => q / l); })();
  const warm = clamp(1 - e / 0.45, 0, 1);
  let sunC = mix3([0.82, 0.72, 0.56], [1.05, 0.62, 0.36], warm * day).map(v => v * day * (0.6 + 0.4 * clamp(e / 0.4, 0, 1)));
  const moonC = [0.13, 0.16, 0.26];
  sunC = sunC.map((v, i) => v + moonC[i] * night);                       // luar: usa as mesmas sombras pré-calculadas
  let ambC = mix3([0.11, 0.13, 0.22], [0.46, 0.5, 0.58], day); ambC = mix3(ambC, [0.42, 0.33, 0.36], dusk * 0.45 * day);
  const lampOn = clamp(1 - (e + 0.02) / 0.14, 0, 1), winOn = clamp(1 - (e + 0.06) / 0.14, 0, 1);
  let skyZ = mix3([0.015, 0.025, 0.07], [0.36, 0.56, 0.86], day), skyH = mix3([0.05, 0.07, 0.13], [0.74, 0.79, 0.84], day);
  skyH = mix3(skyH, [0.98, 0.56, 0.32], dusk * 0.85); skyZ = mix3(skyZ, [0.3, 0.32, 0.55], dusk * 0.5);
  return { t, elev: e, day, night, dusk, sunDir, moonDir, sunC, ambC, lampC: [1.0, 0.78, 0.48], lampOn, winOn, skyZ, skyH, fogC: skyH, starA: clamp(night * 1.3 - 0.3, 0, 1) * (quality === 'baixo' ? 0.6 : 1), tracer: 1 + 2.2 * night + dusk };
}
function createRenderer(canvas) {
  const opts = { antialias: false, alpha: false, depth: true, stencil: false, powerPreference: 'high-performance', preserveDrawingBuffer: false };
  const gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
  if (!gl) return null;
  const extLod = gl.getExtension('EXT_shader_texture_lod'), extDer = gl.getExtension('OES_standard_derivatives');
  const fancy = !!(extLod && extDer);
  const hp = 'precision highp float;\n';
  const fhp = '#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n';
  const compile = (vs, fs) => { const mk = (t, s) => { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); return sh; };
    const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name] = gl.getUniformLocation(p, a.name); }
    const a = {}, na = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES); for (let i = 0; i < na; i++) { const at = gl.getActiveAttrib(p, i); a[at.name] = gl.getAttribLocation(p, at.name); } return { p, u, a }; };
  const FOG = 'uniform vec3 uFogC; uniform float uFogD; vec3 fogit(vec3 c, float d){ float f = 1.0 - exp(-(d*uFogD)*(d*uFogD)); return mix(c, uFogC, f); }\n';
  const world = compile(hp + `attribute vec3 aP; attribute vec2 aU; attribute vec3 aC; attribute vec4 aL; uniform mat4 uVP; uniform vec3 uEye; uniform float uMode;
    varying vec2 vU; varying vec2 vT; varying vec3 vC; varying vec4 vL; varying float vD;
    void main(){ float t = floor(aU.x/128.0); vU = vec2(aU.x - t*128.0, aU.y); if (uMode > 0.5) vU = aU; vT = vec2(mod(t,4.0), floor(t/4.0))*0.25; vC = aC; vL = aL; vD = distance(aP, uEye); gl_Position = uVP*vec4(aP,1.0); }`,
    (fancy ? '#extension GL_EXT_shader_texture_lod : enable\n#extension GL_OES_standard_derivatives : enable\n' : '') + fhp + FOG + `uniform sampler2D uTex; uniform float uMode; uniform vec3 uSunC; uniform vec3 uAmbC; uniform vec3 uLampC; uniform float uLampOn; uniform float uWinOn;
    varying vec2 vU; varying vec2 vT; varying vec3 vC; varying vec4 vL; varying float vD;
    void main(){ vec4 tx;
      if (uMode > 0.5) { tx = texture2D(uTex, vU); if (tx.a < 0.45) discard; }
      else { vec2 st = vT + (0.004 + fract(vU)*0.992)*0.25;
        ${fancy ? 'vec2 dx = dFdx(vU)*256.0, dy = dFdy(vU)*256.0; float lod = clamp(0.5*log2(max(dot(dx,dx), dot(dy,dy))), 0.0, 4.0); tx = texture2DLodEXT(uTex, st, lod);' : 'tx = texture2D(uTex, st);'} }
      vec3 light = uAmbC*vL.y + uSunC*vL.x + uLampC*(vL.z*uLampOn);
      vec3 c = tx.rgb * vC * light * 1.12;
      if (vL.w > 0.5 && vL.w < 1.5) c += vC * uLampOn * 1.5;
      if (vL.w >= 2.0 && uMode < 0.5) { float lit = step(0.45, vL.w - 2.0); c += vec3(1.0, 0.74, 0.4) * clamp((0.8 - tx.a) * 3.0, 0.0, 1.0) * uWinOn * lit * 0.95; }
      gl_FragColor = vec4(fogit(c, vD), 1.0); }`);
  const solid = compile(hp + `attribute vec3 aP; attribute vec3 aN; uniform mat4 uVP; uniform mat4 uM; uniform vec3 uEye; varying vec3 vN; varying float vD;
    void main(){ vec4 w = uM*vec4(aP,1.0); vN = mat3(uM)*aN; vD = distance(w.xyz, uEye); gl_Position = uVP*w; }`,
    fhp + FOG + `uniform vec3 uCol; uniform vec3 uSun; uniform vec3 uSunC; uniform vec3 uAmbC; uniform float uFlash; uniform float uEmit; varying vec3 vN; varying float vD;
    void main(){ vec3 n = normalize(vN); float d = max(dot(n, uSun), 0.0); vec3 c = uCol*(uAmbC*1.1 + uSunC*d*1.05); c = mix(c, uCol, uEmit); c = mix(c, vec3(1.0,0.3,0.25), uFlash); gl_FragColor = vec4(fogit(c, vD), 1.0); }`);
  const flat = compile(hp + `attribute vec3 aP; attribute vec4 aC; attribute vec2 aU; uniform mat4 uVP; uniform vec3 uEye; uniform float uPt; varying vec4 vC; varying vec2 vU; varying float vD;
    void main(){ vC = aC; vU = aU; vD = distance(aP, uEye); gl_Position = uVP*vec4(aP,1.0); gl_PointSize = uPt; }`,
    fhp + FOG + `uniform float uSoft; uniform float uNoFog; uniform float uBright; varying vec4 vC; varying vec2 vU; varying float vD;
    void main(){ float a = vC.a; if (uSoft > 0.5) { float r = length(vU*2.0-1.0); a *= smoothstep(1.0, 0.2, r); }
      vec3 c = vC.rgb * uBright; c = uNoFog > 0.5 ? c : fogit(c, vD); gl_FragColor = vec4(c, a); }`);
  const skyP = compile(hp + `attribute vec3 aP; uniform mat4 uVP; varying vec3 vDir; void main(){ vDir = aP; gl_Position = uVP*vec4(aP,1.0); }`,
    fhp + `uniform vec3 uZ; uniform vec3 uH; uniform vec3 uSunDir; uniform vec3 uMoonDir; uniform float uDay; uniform float uNight; uniform vec3 uSunTint; varying vec3 vDir;
    void main(){ vec3 d = normalize(vDir); float e = max(d.y, 0.0); vec3 c = mix(uH, uZ, pow(e, 0.55));
      float s = max(dot(d, uSunDir), 0.0); c += uSunTint * (pow(s, 900.0) * 6.0 + pow(s, 12.0) * 0.35) * uDay;
      float m = max(dot(d, uMoonDir), 0.0); c += vec3(0.85, 0.9, 1.0) * (step(0.9994, m) * 1.2 + pow(m, 60.0) * 0.12) * uNight;
      gl_FragColor = vec4(c, 1.0); }`);
  // cubo unitário com normais
  const cube = (() => { const v = []; const F = [[0, 1, 0, [[-1, 1, -1], [-1, 1, 1], [1, 1, 1], [1, 1, -1]]], [0, -1, 0, [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]]], [1, 0, 0, [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]]], [-1, 0, 0, [[-1, -1, 1], [-1, 1, 1], [-1, 1, -1], [-1, -1, -1]]], [0, 0, 1, [[1, -1, 1], [1, 1, 1], [-1, 1, 1], [-1, -1, 1]]], [0, 0, -1, [[-1, -1, -1], [-1, 1, -1], [1, 1, -1], [1, -1, -1]]]];
    for (const [nx, ny, nz, p] of F) for (const k of [0, 1, 2, 0, 2, 3]) v.push(p[k][0] * 0.5, p[k][1] * 0.5, p[k][2] * 0.5, nx, ny, nz);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.STATIC_DRAW); return b; })();
  // cúpula do céu (as cores vêm do ciclo de dia e noite)
  const sky = (() => { const v = []; const pt = (t, e) => [Math.cos(t) * Math.cos(e) * 500, Math.sin(e) * 500, Math.sin(t) * Math.cos(e) * 500];
    const E = [-0.3, 0, 0.06, 0.15, 0.3, 0.55, 0.9, 1.25, 1.5708]; for (let r = 0; r < E.length - 1; r++) for (let k = 0; k < 32; k++) { const t0 = k / 32 * Math.PI * 2, t1 = (k + 1) / 32 * Math.PI * 2; for (const [t, e] of [[t0, E[r]], [t0, E[r + 1]], [t1, E[r + 1]], [t0, E[r]], [t1, E[r + 1]], [t1, E[r]]]) v.push(...pt(t, e)); }
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.STATIC_DRAW); return { b, n: v.length / 3 }; })();
  const stars = (() => { const v = [], Rr = mulberry(77); for (let k = 0; k < 420; k++) { const t = Rr() * Math.PI * 2, e = 0.08 + Math.asin(Rr()) * 0.95, b = 0.5 + Rr() * 0.5; v.push(Math.cos(t) * Math.cos(e) * 480, Math.sin(e) * 480, Math.sin(t) * Math.cos(e) * 480, b, b, b * 1.05, 1, 0, 0); }
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.STATIC_DRAW); return { b, n: v.length / 9 }; })();
  const dyn = gl.createBuffer();
  let atlasTex = null, decalTex = null; const chunks = []; let lineBuf = null, lineN = 0, decalBuf = null, decalN = 0, decalIdx = null;
  function texFrom(cv, mip) { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    if (mip) { gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); } else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); return t; }
  function upload(geo, decalGeo, lines, atlas, decalCv) {
    atlasTex = texFrom(atlas, fancy); decalTex = texFrom(decalCv, true);
    for (const c of geo.chunks) { if (!c.i.length) continue; const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(c.v), gl.STATIC_DRAW); const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(c.i), gl.STATIC_DRAW); chunks.push({ vb, ib, n: c.i.length, box: c.box, always: c.always }); c.v = null; c.i = null; }
    const dc = decalGeo.chunks[0]; if (dc && dc.i.length) { decalBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, decalBuf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(dc.v), gl.STATIC_DRAW); decalIdx = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, decalIdx); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(dc.i), gl.STATIC_DRAW); decalN = dc.i.length; }
    lineBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, lineBuf); const lv = []; for (let k = 0; k < lines.length; k += 6) lv.push(lines[k], lines[k + 1], lines[k + 2], lines[k + 3], lines[k + 4], lines[k + 5], 1, 0, 0); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(lv), gl.STATIC_DRAW); lineN = lv.length / 9;
  }
  const S4 = VSTRIDE * 4;
  const bindWorld = (vb) => { gl.bindBuffer(gl.ARRAY_BUFFER, vb); const a = world.a; gl.enableVertexAttribArray(a.aP); gl.vertexAttribPointer(a.aP, 3, gl.FLOAT, false, S4, 0); gl.enableVertexAttribArray(a.aU); gl.vertexAttribPointer(a.aU, 2, gl.FLOAT, false, S4, 12); gl.enableVertexAttribArray(a.aC); gl.vertexAttribPointer(a.aC, 3, gl.FLOAT, false, S4, 20); gl.enableVertexAttribArray(a.aL); gl.vertexAttribPointer(a.aL, 4, gl.FLOAT, false, S4, 32); };
  const bindFlat = (b) => { gl.bindBuffer(gl.ARRAY_BUFFER, b); const a = flat.a; gl.enableVertexAttribArray(a.aP); gl.vertexAttribPointer(a.aP, 3, gl.FLOAT, false, 36, 0); gl.enableVertexAttribArray(a.aC); gl.vertexAttribPointer(a.aC, 4, gl.FLOAT, false, 36, 12); if (a.aU >= 0) { gl.enableVertexAttribArray(a.aU); gl.vertexAttribPointer(a.aU, 2, gl.FLOAT, false, 36, 28); } };
  const disableAll = () => { for (let i = 0; i < 6; i++) gl.disableVertexAttribArray(i); };
  let VP = null, eye = [0, 0, 0], fogD = 0.0062, maxDist = 400, env = dayEnv(0.45, 'medio');
  const flatSetup = (noFog, bright) => { gl.useProgram(flat.p); gl.uniformMatrix4fv(flat.u.uVP, false, VP); gl.uniform3fv(flat.u.uEye, eye); gl.uniform1f(flat.u.uSoft, 0); gl.uniform1f(flat.u.uNoFog, noFog ? 1 : 0); gl.uniform3fv(flat.u.uFogC, env.fogC); gl.uniform1f(flat.u.uFogD, fogD); gl.uniform1f(flat.u.uBright, bright == null ? 1 : bright); if (flat.u.uPt) gl.uniform1f(flat.u.uPt, 2.0); };
  function frustum(m) { const P = []; const r = (a, b, c, d) => { const l = Math.hypot(a, b, c); P.push([a / l, b / l, c / l, d / l]); };
    r(m[3] + m[0], m[7] + m[4], m[11] + m[8], m[15] + m[12]); r(m[3] - m[0], m[7] - m[4], m[11] - m[8], m[15] - m[12]); r(m[3] + m[1], m[7] + m[5], m[11] + m[9], m[15] + m[13]); r(m[3] - m[1], m[7] - m[5], m[11] - m[9], m[15] - m[13]); r(m[3] + m[2], m[7] + m[6], m[11] + m[10], m[15] + m[14]); return P; }
  function boxVisible(P, b, e, md) { const dx = Math.max(b[0] - e[0], 0, e[0] - b[3]), dz = Math.max(b[2] - e[2], 0, e[2] - b[5]); if (dx * dx + dz * dz > md * md) return false;
    for (const p of P) { const x = p[0] > 0 ? b[3] : b[0], y = p[1] > 0 ? b[4] : b[1], z = p[2] > 0 ? b[5] : b[2]; if (p[0] * x + p[1] * y + p[2] * z + p[3] < 0) return false; } return true; }
  const R = {
    gl, fancy, canvas, upload,
    setEnv(e) { env = e; }, get env() { return env; },
    get cur() { return { VP, eye, fogD, maxDist }; },
    begin(vp, e, fd) { VP = vp; eye = e; fogD = fd * (1 + env.night * 0.35); maxDist = Math.min(700, 2.2 / fogD); gl.clearColor(env.fogC[0], env.fogC[1], env.fogC[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND); },
    sky() { gl.depthMask(false); const vp = m4.mul(VP, m4.tr(eye[0], eye[1], eye[2])); gl.useProgram(skyP.p); gl.uniformMatrix4fv(skyP.u.uVP, false, vp); gl.uniform3fv(skyP.u.uZ, env.skyZ); gl.uniform3fv(skyP.u.uH, env.skyH); gl.uniform3fv(skyP.u.uSunDir, env.sunDir); gl.uniform3fv(skyP.u.uMoonDir, env.moonDir); gl.uniform1f(skyP.u.uDay, clamp(env.day + env.dusk, 0, 1)); gl.uniform1f(skyP.u.uNight, env.night); gl.uniform3fv(skyP.u.uSunTint, env.dusk > 0.2 ? [1.0, 0.6, 0.35] : [1.0, 0.95, 0.85]);
      disableAll(); gl.bindBuffer(gl.ARRAY_BUFFER, sky.b); gl.enableVertexAttribArray(skyP.a.aP); gl.vertexAttribPointer(skyP.a.aP, 3, gl.FLOAT, false, 12, 0); gl.drawArrays(gl.TRIANGLES, 0, sky.n);
      if (env.starA > 0.02) { gl.useProgram(flat.p); gl.uniformMatrix4fv(flat.u.uVP, false, vp); gl.uniform3fv(flat.u.uEye, [0, 0, 0]); gl.uniform1f(flat.u.uSoft, 0); gl.uniform1f(flat.u.uNoFog, 1); gl.uniform1f(flat.u.uBright, env.starA); gl.uniform1f(flat.u.uPt, 2.0); gl.uniform1f(flat.u.uFogD, 0); gl.uniform3fv(flat.u.uFogC, env.fogC); disableAll(); bindFlat(stars.b); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE); gl.drawArrays(gl.POINTS, 0, stars.n); gl.disable(gl.BLEND); }
      gl.depthMask(true); },
    world() { gl.useProgram(world.p); gl.uniformMatrix4fv(world.u.uVP, false, VP); gl.uniform3fv(world.u.uEye, eye); gl.uniform3fv(world.u.uFogC, env.fogC); gl.uniform1f(world.u.uFogD, fogD); gl.uniform1f(world.u.uMode, 0);
      gl.uniform3fv(world.u.uSunC, env.sunC); gl.uniform3fv(world.u.uAmbC, env.ambC); gl.uniform3fv(world.u.uLampC, env.lampC); gl.uniform1f(world.u.uLampOn, env.lampOn); gl.uniform1f(world.u.uWinOn, env.winOn);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, atlasTex); gl.uniform1i(world.u.uTex, 0); disableAll();
      const pl = frustum(VP); let drawn = 0;
      for (const c of chunks) { if (!c.always && !boxVisible(pl, c.box, eye, maxDist)) continue; drawn++; bindWorld(c.vb); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, c.ib); gl.drawElements(gl.TRIANGLES, c.n, gl.UNSIGNED_SHORT, 0); }
      R.stats = { chunks: chunks.length, drawn };
      if (decalN) { gl.uniform1f(world.u.uMode, 1); gl.bindTexture(gl.TEXTURE_2D, decalTex); gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-1, -2); bindWorld(decalBuf); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, decalIdx); gl.drawElements(gl.TRIANGLES, decalN, gl.UNSIGNED_SHORT, 0); gl.disable(gl.POLYGON_OFFSET_FILL); }
      flatSetup(false, 0.35 + 0.65 * env.day); disableAll(); bindFlat(lineBuf); gl.drawArrays(gl.LINES, 0, lineN); },
    solidBegin(vp, e) { gl.useProgram(solid.p); gl.uniformMatrix4fv(solid.u.uVP, false, vp || VP); gl.uniform3fv(solid.u.uEye, e || eye); gl.uniform3fv(solid.u.uSun, env.day > 0.05 ? env.sunDir : env.moonDir); gl.uniform3fv(solid.u.uSunC, env.sunC); gl.uniform3fv(solid.u.uAmbC, env.ambC.map(v => v + env.lampOn * 0.07)); gl.uniform3fv(solid.u.uFogC, env.fogC); gl.uniform1f(solid.u.uFogD, e ? 0 : fogD); gl.uniform1f(solid.u.uEmit, 0);
      disableAll(); gl.bindBuffer(gl.ARRAY_BUFFER, cube); gl.enableVertexAttribArray(solid.a.aP); gl.vertexAttribPointer(solid.a.aP, 3, gl.FLOAT, false, 24, 0); gl.enableVertexAttribArray(solid.a.aN); gl.vertexAttribPointer(solid.a.aN, 3, gl.FLOAT, false, 24, 12); },
    cube(M, col, flash, emit) { gl.uniformMatrix4fv(solid.u.uM, false, M); gl.uniform3fv(solid.u.uCol, col); gl.uniform1f(solid.u.uFlash, flash || 0); gl.uniform1f(solid.u.uEmit, emit || 0); gl.drawArrays(gl.TRIANGLES, 0, 36); },
    fx(verts, mode, soft, additive, noDepthWrite, bright) { // verts: Float32Array (9 floats por vértice)
      if (!verts.length) return; flatSetup(false, bright == null ? 1 : bright); gl.uniform1f(flat.u.uSoft, soft ? 1 : 0);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, additive ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA); if (noDepthWrite) gl.depthMask(false);
      disableAll(); gl.bindBuffer(gl.ARRAY_BUFFER, dyn); gl.bufferData(gl.ARRAY_BUFFER, verts, gl.DYNAMIC_DRAW); bindFlat(dyn); gl.drawArrays(mode, 0, verts.length / 9); gl.disable(gl.BLEND); gl.depthMask(true); },
    clearDepth() { gl.clear(gl.DEPTH_BUFFER_BIT); },
    destroy() { const e = gl.getExtension('WEBGL_lose_context'); if (e) e.loseContext(); },
  };
  return R;
}

window.EscRender = { makeAtlas, makeDecals, buildGeometry, buildDecor, createRenderer, dayEnv, m4, Geo, FOG_C, SUN, TINTS, GLOW };
})();
