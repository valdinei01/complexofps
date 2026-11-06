/* Complexo do Escadão 3D — renderização WebGL (texturas procedurais, geometria e decoração). */
(function () {
'use strict';
const S = window.EscSim;
const { CELL, GX, GZ, NC, K_VOID, K_AVE, K_WALK, K_STREET, K_ESC, K_BECO, K_ROOF, K_BLOCK, K_PLAZA, WALKABLE, B_MURO, B_TANK, B_GUARD, B_WALL, B_INVIS, B_TANK2, B_SAND, B_JERSEY, B_BRICKS, B_BARREL, B_SUPPLY, mulberry, h2, clamp, lerp, aveX, terrain, CANAL_ST, SUPPLY, WALK_X0, WALK_X1, TEAM } = S;
// ---------- texturas procedurais ----------
const T_ASPH = 0, T_CONC = 1, T_BRICK = 2, T_WIN_A = 3, T_WIN_B = 4, T_PLASTER = 5, T_SHOP = 6, T_DOOR = 7, T_SLAB = 8, T_STEP = 9, T_EARTH = 10, T_TANK = 11, T_AZUL = 12, T_MURO = 13, T_ZINC = 14, T_WATER = 15;
function makeAtlas() {
  const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S * 4; const g = cv.getContext('2d');
  const R = mulberry(4242);
  const tile = (t, fn) => { g.save(); g.translate((t % 4) * S, Math.floor(t / 4) * S); g.beginPath(); g.rect(0, 0, S, S); g.clip(); fn(g); g.restore(); };
  const speck = (n, c, a, sz) => { for (let k = 0; k < n; k++) { g.fillStyle = c; g.globalAlpha = a * R(); const s = sz * (0.4 + R()); g.fillRect(R() * S, R() * S, s, s); } g.globalAlpha = 1; };
  const grime = (h0) => { const gr = g.createLinearGradient(0, h0, 0, S); gr.addColorStop(0, 'rgba(60,50,40,0)'); gr.addColorStop(1, 'rgba(60,50,40,0.28)'); g.fillStyle = gr; g.fillRect(0, 0, S, S); for (let k = 0; k < 14; k++) { g.fillStyle = 'rgba(70,60,50,' + (0.05 + R() * 0.08) + ')'; const x = R() * S; g.fillRect(x, R() * 40, 2 + R() * 4, 40 + R() * 140); } };
  const plaster = (base) => { g.fillStyle = base; g.fillRect(0, 0, S, S); speck(900, '#000', 0.06, 2); speck(500, '#fff', 0.08, 2); };
  const windowAt = (x, y, w, h, kind) => {
    g.fillStyle = '#3b3a37'; g.fillRect(x - 4, y - 4, w + 8, h + 8);
    const gr = g.createLinearGradient(x, y, x + w, y + h); gr.addColorStop(0, '#5d7286'); gr.addColorStop(0.5, '#2b3540'); gr.addColorStop(1, '#495a69'); g.fillStyle = gr; g.fillRect(x, y, w, h);
    g.fillStyle = '#c9ccd0'; g.fillRect(x + w / 2 - 2, y, 4, h); g.fillRect(x, y + h / 2 - 2, w, 3);
    if (kind === 1) { g.strokeStyle = '#1f1f1f'; g.lineWidth = 3; for (let k = 1; k < 6; k++) { g.beginPath(); g.moveTo(x + k * w / 6, y - 3); g.lineTo(x + k * w / 6, y + h + 3); g.stroke(); } g.beginPath(); g.moveTo(x - 3, y + h * 0.33); g.lineTo(x + w + 3, y + h * 0.33); g.moveTo(x - 3, y + h * 0.66); g.lineTo(x + w + 3, y + h * 0.66); g.stroke(); }
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x - 6, y + h + 4, w + 12, 6);
  };
  tile(T_ASPH, () => { g.fillStyle = '#4a4a4c'; g.fillRect(0, 0, S, S); speck(4000, '#000', 0.25, 2); speck(2500, '#9a9a9a', 0.2, 2); g.strokeStyle = 'rgba(20,20,20,.5)'; g.lineWidth = 1.5; for (let k = 0; k < 4; k++) { g.beginPath(); let x = R() * S, y = R() * S; g.moveTo(x, y); for (let q = 0; q < 6; q++) { x += (R() - 0.5) * 50; y += (R() - 0.5) * 50; g.lineTo(x, y); } g.stroke(); } });
  tile(T_CONC, () => { g.fillStyle = '#b4afa6'; g.fillRect(0, 0, S, S); speck(3000, '#000', 0.12, 2); speck(1500, '#fff', 0.15, 2); g.strokeStyle = 'rgba(60,55,50,.35)'; g.lineWidth = 2; g.strokeRect(1, 1, S - 2, S - 2); for (let k = 0; k < 5; k++) { g.fillStyle = 'rgba(80,70,60,' + (R() * 0.12) + ')'; g.beginPath(); g.arc(R() * S, R() * S, 10 + R() * 40, 0, 7); g.fill(); } });
  tile(T_BRICK, () => { g.fillStyle = '#8d7a68'; g.fillRect(0, 0, S, S); const bw = 64, bh = 32; for (let r = 0; r < S / bh; r++) for (let c = -1; c < S / bw + 1; c++) { const x = c * bw + (r % 2 ? bw / 2 : 0), y = r * bh; const t = R(); g.fillStyle = `rgb(${176 + t * 40 | 0},${88 + t * 30 | 0},${52 + t * 20 | 0})`; g.fillRect(x + 3, y + 3, bw - 6, bh - 6); g.fillStyle = 'rgba(70,30,15,.35)'; g.fillRect(x + 10, y + 10, bw - 20, 4); g.fillRect(x + 10, y + bh - 14, bw - 20, 4); } speck(1500, '#000', 0.12, 2); g.fillStyle = 'rgba(200,190,170,.25)'; for (let k = 0; k < 6; k++) g.fillRect(R() * S, R() * S, 20 + R() * 40, 6); });
  tile(T_WIN_A, () => { plaster('#e9e3d6'); windowAt(70, 60, 116, 92, 0); grime(140); });
  tile(T_WIN_B, () => { plaster('#e6e0d3'); windowAt(40, 70, 90, 80, 1); g.fillStyle = '#d9d9d4'; g.fillRect(160, 96, 60, 40); g.fillStyle = '#9fa3a3'; for (let k = 0; k < 6; k++) g.fillRect(166, 102 + k * 5, 48, 2); g.fillStyle = 'rgba(40,40,40,.35)'; g.fillRect(186, 136, 3, 80); grime(150); });
  tile(T_PLASTER, () => { plaster('#e8e1d2'); grime(120); g.fillStyle = 'rgba(120,110,90,.18)'; g.fillRect(0, 0, S, 10); });
  tile(T_SHOP, () => { g.fillStyle = '#d8d2c4'; g.fillRect(0, 0, S, S); g.fillStyle = '#8f9599'; g.fillRect(14, 40, S - 28, S - 40); for (let y = 44; y < S; y += 9) { g.fillStyle = '#a9afb3'; g.fillRect(14, y, S - 28, 5); g.fillStyle = '#6b7175'; g.fillRect(14, y + 5, S - 28, 2); } g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(14, 40, S - 28, 6); speck(700, '#3a2a1a', 0.2, 3); g.fillStyle = '#5b5f62'; g.fillRect(118, S - 18, 20, 8); });
  tile(T_DOOR, () => { plaster('#e7e0d1'); g.fillStyle = '#5a3d27'; g.fillRect(36, 60, 74, S - 60); g.fillStyle = '#6c4a30'; g.fillRect(42, 66, 62, S - 66); g.fillStyle = '#cfc6b0'; g.fillRect(92, 150, 6, 6); g.fillStyle = '#3a3a3a'; g.fillRect(30, 54, 86, 6); windowAt(150, 80, 70, 64, 1); g.fillStyle = 'rgba(40,30,20,.3)'; g.fillRect(0, S - 22, S, 22); grime(160); });
  tile(T_SLAB, () => { g.fillStyle = '#9b9890'; g.fillRect(0, 0, S, S); speck(3500, '#000', 0.14, 2); speck(1000, '#fff', 0.1, 2); for (let k = 0; k < 8; k++) { g.fillStyle = 'rgba(40,45,30,' + (R() * 0.15) + ')'; g.beginPath(); g.ellipse(R() * S, R() * S, 20 + R() * 50, 10 + R() * 30, R() * 3, 0, 7); g.fill(); } });
  tile(T_STEP, () => { g.fillStyle = '#aaa59b'; g.fillRect(0, 0, S, S); speck(2500, '#000', 0.14, 2); g.fillStyle = '#7d786f'; g.fillRect(0, 0, S, 18); g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(0, 18, S, 4); g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(0, S - 30, S, 30); });
  tile(T_EARTH, () => { g.fillStyle = '#6d5b3e'; g.fillRect(0, 0, S, S); speck(3000, '#3a2a18', 0.3, 3); for (let k = 0; k < 900; k++) { g.fillStyle = `rgba(${60 + R() * 40 | 0},${110 + R() * 60 | 0},${40 + R() * 30 | 0},${0.5 + R() * 0.5})`; const x = R() * S, y = R() * S; g.fillRect(x, y, 2, 4 + R() * 8); } });
  tile(T_TANK, () => { g.fillStyle = '#2f6fb3'; g.fillRect(0, 0, S, S); for (let y = 0; y < S; y += 32) { g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(0, y, S, 6); g.fillStyle = 'rgba(0,0,0,.15)'; g.fillRect(0, y + 26, S, 6); } speck(800, '#000', 0.1, 2); });
  tile(T_AZUL, () => { g.fillStyle = '#d7dfe3'; g.fillRect(0, 0, S, S); for (let y = 0; y < S; y += 16) for (let x = 0; x < S; x += 16) { const t = R(); g.fillStyle = `rgb(${200 + t * 30 | 0},${212 + t * 25 | 0},${220 + t * 20 | 0})`; g.fillRect(x + 1, y + 1, 14, 14); } windowAt(70, 64, 116, 88, 0); grime(170); });
  tile(T_MURO, () => { plaster('#d9d2c2'); g.fillStyle = 'rgba(120,110,95,.4)'; g.fillRect(0, 0, S, 14); const cols = ['#1d1d1d', '#c0392b', '#2471a3', '#229954', '#7d3c98', '#d68910']; g.lineCap = 'round'; for (let k = 0; k < 4; k++) { g.strokeStyle = cols[Math.floor(R() * cols.length)]; g.lineWidth = 4 + R() * 5; g.beginPath(); let x = 20 + R() * 180, y = 60 + R() * 140; g.moveTo(x, y); for (let q = 0; q < 7; q++) { x += (R() - 0.3) * 40; y += (R() - 0.5) * 40; g.quadraticCurveTo(x - 10, y - 20, x, y); } g.stroke(); } grime(120); });
  tile(T_ZINC, () => { g.fillStyle = '#8c9296'; g.fillRect(0, 0, S, S); for (let x = 0; x < S; x += 16) { g.fillStyle = 'rgba(255,255,255,.15)'; g.fillRect(x, 0, 5, S); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x + 10, 0, 5, S); } for (let k = 0; k < 10; k++) { g.fillStyle = 'rgba(140,70,30,' + R() * 0.4 + ')'; g.fillRect(R() * S, R() * S, 10 + R() * 50, 6 + R() * 30); } });
  tile(T_WATER, () => { g.fillStyle = '#3d4a33'; g.fillRect(0, 0, S, S); for (let k = 0; k < 120; k++) { g.strokeStyle = 'rgba(160,170,140,' + R() * 0.25 + ')'; g.lineWidth = 1.5; g.beginPath(); const x = R() * S, y = R() * S; g.moveTo(x, y); g.lineTo(x + 20 + R() * 30, y + (R() - 0.5) * 4); g.stroke(); } });
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

// ---------- geometria estática (luz e sombra pré-calculadas) ----------
const SUN = (() => { const v = [-0.55, 0.62, 0.36], l = Math.hypot(v[0], v[1], v[2]); return v.map(a => a / l); })();
const AMB = [0.46, 0.5, 0.58], SUNC = [0.78, 0.68, 0.52];
const TINTS = [[0.98, 0.78, 0.72], [0.72, 0.88, 0.8], [0.99, 0.91, 0.6], [0.7, 0.8, 0.96], [0.96, 0.95, 0.92], [0.99, 0.72, 0.55], [0.86, 0.76, 0.93], [0.82, 0.91, 0.66], [0.96, 0.8, 0.82], [0.86, 0.83, 0.76], [0.6, 0.8, 0.86], [0.93, 0.62, 0.5]];
class Geo {
  constructor(raw) { this.raw = !!raw; this.chunks = []; this.newChunk(); }
  newChunk() { this.v = []; this.i = []; this.n = 0; this.chunks.push({ v: this.v, i: this.i }); }
  // p: 4 pontos [x,y,z], uv: 4 pares, tile, c: 4 cores [r,g,b]
  quad(p, uv, tile, c) {
    if (this.n + 4 > 65000) this.newChunk();
    const o = tile * 128; let mu = 0, mv = 0;
    if (!this.raw) { mu = Math.floor(Math.min(uv[0][0], uv[1][0], uv[2][0], uv[3][0])); mv = Math.floor(Math.min(uv[0][1], uv[1][1], uv[2][1], uv[3][1])); }
    for (let k = 0; k < 4; k++) this.v.push(p[k][0], p[k][1], p[k][2], uv[k][0] - mu + o, uv[k][1] - mv, c[k][0], c[k][1], c[k][2]);
    const n = this.n; this.i.push(n, n + 1, n + 2, n, n + 2, n + 3); this.n += 4;
  }
  // caixa com luz simples (normal por face). faces: bitmask 1=topo 2=base 4=+x 8=-x 16=+z 32=-z
  box(x0, y0, z0, x1, y1, z1, tile, tint, sc, faces, shade) {
    faces = faces == null ? 61 : faces; sc = sc || 1; shade = shade == null ? 1 : shade;
    const L = (nx, ny, nz) => { const d = Math.max(0, nx * SUN[0] + ny * SUN[1] + nz * SUN[2]); return [tint[0] * (AMB[0] + SUNC[0] * d) * shade, tint[1] * (AMB[1] + SUNC[1] * d) * shade, tint[2] * (AMB[2] + SUNC[2] * d) * shade]; };
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
function buildGeometry(map) {
  const { K, H, HV, M, HID, houses, idx } = map;
  const geo = new Geo(), lines = [], decals = [];
  const hAt = (x, z) => { const i = Math.floor(x / CELL), j = Math.floor(z / CELL); if (i < 0 || j < 0 || i >= GX || j >= GZ) return -50; return H[j * GX + i]; };
  const shadow = (x, y, z) => { for (let t = 0.35; t < 48; t += 0.45) { const py = y + SUN[1] * t; if (py > 24) return 1; if (hAt(x + SUN[0] * t, z + SUN[2] * t) > py) return 0.38; } return 1; };
  const lit = (tint, nx, ny, nz, sh, ao) => { const d = Math.max(0, nx * SUN[0] + ny * SUN[1] + nz * SUN[2]) * sh; return [tint[0] * (AMB[0] * ao + SUNC[0] * d), tint[1] * (AMB[1] * ao + SUNC[1] * d), tint[2] * (AMB[2] * ao + SUNC[2] * d)]; };
  const houseTint = h => h.style.brick ? [1, 1, 1] : TINTS[Math.floor(h.style.tint * TINTS.length)];
  const inAve = (x, z) => x > aveX(z) - 5 && x < aveX(z) + 5;
  // ---- topos ----
  const topInfo = c => {
    const k = K[c], i = c % GX, j = (c / GX) | 0, x = (i + 0.5) * CELL, z = (j + 0.5) * CELL;
    switch (k) {
      case K_AVE: return [T_ASPH, 4, [1, 1, 1], 0];
      case K_WALK: return [T_CONC, 1.5, [0.95, 0.93, 0.9], 0];
      case K_STREET: return map.SN[c] === -5 ? [T_CONC, 1.5, [0.7, 0.7, 0.66], 0] : [T_CONC, 2.5, [0.84, 0.81, 0.77], 0];
      case K_ESC: { const land = S.ESC_LAND.find(l => Math.abs(x - l.x) <= l.hx), flat = M[c] === 0 && (Math.abs(z - 80) > 2.01 || land);
        if (flat) return land === S.ESC_LAND[1] ? [T_CONC, 2, [0.8, 0.62, 0.5], 0] : [T_CONC, 2, [0.92, 0.88, 0.82], 0];
        if (M[c] === 0) { const dz = z - 80, stripe = dz > -1.6 && dz < -0.8 ? [0.35, 0.78, 0.38] : dz > 0.4 && dz < 1.2 ? [1.25, 1.05, 0.3] : dz > 1.2 && dz < 1.8 ? [0.45, 0.6, 1.1] : null; return [T_STEP, 0, stripe || [0.95, 0.92, 0.86], 1]; }
        return [T_STEP, 0, [0.86, 0.84, 0.8], 1]; }
      case K_BECO: return [T_CONC, 1.5, [0.78, 0.75, 0.7], 0];
      case K_PLAZA: return [T_CONC, 2, [0.93, 0.86, 0.78], 0];
      case K_ROOF: { const h = houses[HID[c]]; return h && h.style.brick && !h.access ? [T_SLAB, 3, [0.92, 0.85, 0.8], 0] : [T_SLAB, 3, [1, 1, 1], 0]; }
      case K_BLOCK: { const m = M[c]; if (m === B_TANK) return [T_TANK, 1.2, [0.6, 0.75, 0.95], 0]; if (m === B_TANK2) return [T_SLAB, 1.2, [0.62, 0.64, 0.66], 0]; if (m === B_INVIS) return inAve(x, z) ? [T_ASPH, 4, [1, 1, 1], 0] : [T_CONC, 2.5, [0.84, 0.81, 0.77], 0]; if (m === B_GUARD) return [T_CONC, 1, [0.8, 0.8, 0.78], 0]; if (m === B_SAND) return [T_CONC, 0.6, [0.95, 0.82, 0.6], 0]; if (m === B_JERSEY) return [T_CONC, 1, [1.05, 0.95, 0.55], 0]; if (m === B_BRICKS) return [T_BRICK, 1.2, [1, 1, 1], 0]; if (m === B_BARREL) return [T_ZINC, 0.8, [0.45, 0.6, 1], 0]; return [T_PLASTER, 2, [0.85, 0.82, 0.78], 0]; }
      default: return x > 74 ? [T_EARTH, 3, [0.7, 0.8, 0.6], 0] : [T_EARTH, 3, [0.9, 0.9, 0.85], 0];
    }
  };
  const tops = new Array(NC);
  for (let c = 0; c < NC; c++) {
    const i = c % GX, j = (c / GX) | 0, x = (i + 0.5) * CELL, z = (j + 0.5) * CELL, y = HV[c];
    const info = topInfo(c); let occ = 0;
    for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) { if (!a && !b) continue; const ni = i + a, nj = j + b; if (ni < 0 || nj < 0 || ni >= GX || nj >= GZ) continue; const d = H[nj * GX + ni] - y; if (d > 0.9) occ += (Math.abs(a) + Math.abs(b) <= 2 ? 1 : 0.5); }
    const ao = clamp(1 - occ * 0.045, 0.55, 1), sh = shadow(x, y + 0.05, z);
    const col = lit(info[2], 0, 1, 0, sh, ao);
    tops[c] = { info, key: info[0] + '|' + info[1] + '|' + info[2].join(',') + '|' + y.toFixed(3) + '|' + Math.round(sh * 10) + '|' + Math.round(ao * 14) + '|' + info[3] + (info[3] ? '|' + i : ''), col, y };
  }
  // fusão gulosa em retângulos
  const used = new Uint8Array(NC);
  for (let j = 0; j < GZ; j++) for (let i = 0; i < GX; i++) {
    const c = j * GX + i; if (used[c]) continue; const t = tops[c];
    let w = 1; while (i + w < GX && !used[c + w] && tops[c + w].key === t.key) w++;
    let hgt = 1; outer: while (j + hgt < GZ) { for (let q = 0; q < w; q++) { const n = (j + hgt) * GX + i + q; if (used[n] || tops[n].key !== t.key) break outer; } hgt++; }
    for (let b = 0; b < hgt; b++) for (let a = 0; a < w; a++) used[(j + b) * GX + i + a] = 1;
    const x0 = i * CELL, z0 = j * CELL, x1 = (i + w) * CELL, z1 = (j + hgt) * CELL, y = t.y, [tile, sc] = t.info;
    const p = [[x0, y, z0], [x0, y, z1], [x1, y, z1], [x1, y, z0]];
    const uv = t.info[3] ? [[z0 / 1.2, 0.03], [z1 / 1.2, 0.03], [z1 / 1.2, w * 0.97], [z0 / 1.2, w * 0.97]] : [[x0 / sc, z0 / sc], [x0 / sc, z1 / sc], [x1 / sc, z1 / sc], [x1 / sc, z0 / sc]];
    geo.quad(p, uv, tile, [t.col, t.col, t.col, t.col]);
  }
  // ---- paredes laterais ----
  const DIR = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const groundish = k => k === K_AVE || k === K_WALK || k === K_STREET || k === K_ESC || k === K_BECO || k === K_PLAZA;
  const faces = new Map();
  for (let c = 0; c < NC; c++) {
    const i = c % GX, j = (c / GX) | 0, y1 = HV[c];
    for (let d = 0; d < 4; d++) {
      const ni = i + DIR[d][0], nj = j + DIR[d][1]; let y0, nk;
      if (ni < 0 || nj < 0 || ni >= GX || nj >= GZ) { y0 = Math.min(0, y1 - 0.01); nk = K_VOID; } else { const n = nj * GX + ni; y0 = HV[n]; nk = K[n]; }
      if (y1 - y0 < 0.01) continue;
      const k = K[c]; let key;
      if (k === K_ROOF) { key = 'h' + HID[c] + (groundish(nk) ? 'g' : 'r'); }
      else if (k === K_BLOCK) key = 'b' + M[c];
      else if (k === K_VOID) key = 'v';
      else key = 'c' + k;
      const line = d < 2 ? i : j, along = d < 2 ? j : i;
      const fk = d + ':' + line; if (!faces.has(fk)) faces.set(fk, []);
      faces.get(fk).push({ along, y0, y1, key, c });
    }
  }
  const signs = [];
  for (const [fk, list] of faces) {
    const [ds, ls] = fk.split(':'), d = +ds, line = +ls; list.sort((a, b) => a.along - b.along);
    let run = null;
    const flush = () => { if (run) emitWall(d, line, run); run = null; };
    for (const f of list) {
      if (run && f.along === run.a1 + 1 && Math.abs(f.y0 - run.y0) < 0.005 && Math.abs(f.y1 - run.y1) < 0.005 && f.key === run.key && run.a1 - run.a0 < 15) { run.a1 = f.along; }
      else { flush(); run = { a0: f.along, a1: f.along, y0: f.y0, y1: f.y1, key: f.key, c: f.c }; }
    }
    flush();
  }
  function emitWall(d, line, r) {
    // posição do plano
    const nx = DIR[d][0], nz = DIR[d][1];
    let pA, pB; // extremos horizontais [x,z]
    if (d < 2) { const x = (line + (d === 0 ? 1 : 0)) * CELL; pA = [x, r.a0 * CELL]; pB = [x, (r.a1 + 1) * CELL]; if (d === 0) { const t = pA; pA = pB; pB = t; } }
    else { const z = (line + (d === 2 ? 1 : 0)) * CELL; pA = [r.a0 * CELL, z]; pB = [(r.a1 + 1) * CELL, z]; if (d === 3) { const t = pA; pA = pB; pB = t; } }
    const len = Math.hypot(pB[0] - pA[0], pB[1] - pA[1]), alongStart = d < 2 ? (d === 0 ? (r.a1 + 1) * CELL : r.a0 * CELL) : (d === 3 ? (r.a1 + 1) * CELL : r.a0 * CELL);
    const k = K[r.c]; let tint = [0.75, 0.73, 0.7], bands = [];
    if (k === K_ROOF) {
      const h = houses[HID[r.c]]; tint = houseTint(h); const st = h.style; const g = r.key.endsWith('g');
      const winT = st.brick ? T_BRICK : (st.win < 0.45 ? T_WIN_A : st.win < 0.8 ? T_WIN_B : T_AZUL);
      const doorT = st.brick ? T_BRICK : (h.shop || (g && nx * 1 !== 0 && false)) ? T_SHOP : st.door < 0.55 ? T_DOOR : (st.door < 0.8 ? winT : T_SHOP);
      const lowT = h.shop ? T_SHOP : doorT;
      if (g && r.y1 - r.y0 > 1.2) { const m = Math.min(r.y1, r.y0 + 2.9); bands.push([r.y0, m, lowT, 3, r.y0]); if (r.y1 > m + 0.01) bands.push([m, r.y1, winT, 3, m]); if (lowT === T_SHOP && (h.shop || st.door > 0.8) && r.y1 - r.y0 > 2.95 && len >= 3) signs.push({ pA, pB, y: r.y0 + 2.95, nx, nz, len, h }); }
      else bands.push([r.y0, r.y1, winT, 3, r.y0]);
    } else if (k === K_BLOCK) {
      const m = M[r.c];
      if (m === B_MURO) { tint = [0.95, 0.92, 0.86]; bands.push([r.y0, r.y1, T_MURO, 3, r.y0]); }
      else if (m === B_TANK) { tint = [0.75, 0.85, 1]; bands.push([r.y0, r.y1, T_TANK, 1.2, r.y0]); }
      else if (m === B_TANK2) { tint = [0.7, 0.72, 0.74]; bands.push([r.y0, r.y1, T_ZINC, 1.2, r.y0]); }
      else if (m === B_WALL) { tint = [0.8, 0.78, 0.74]; bands.push([r.y0, r.y1, T_MURO, 3, r.y0]); }
      else if (m === B_GUARD) { tint = [1.1, 0.95, 0.35]; bands.push([r.y0, r.y1, T_CONC, 1.5, r.y0]); }
      else if (m === B_SAND) { tint = [0.95, 0.82, 0.6]; bands.push([r.y0, r.y1, T_CONC, 0.35, r.y0]); }
      else if (m === B_JERSEY) { tint = [1.1, 0.95, 0.45]; bands.push([r.y0, r.y1, T_MURO, 1.5, r.y0]); }
      else if (m === B_BRICKS) { tint = [1, 1, 1]; bands.push([r.y0, r.y1, T_BRICK, 1.2, r.y0]); }
      else if (m === B_BARREL) { tint = [0.4, 0.55, 0.95]; bands.push([r.y0, r.y1, T_ZINC, 0.8, r.y0]); }
      else { tint = [0.7, 0.68, 0.65]; bands.push([r.y0, r.y1, T_CONC, 2, r.y0]); }
    } else if (k === K_VOID) { const xx = d < 2 ? (line + 0.5) * CELL : (r.a0 + 0.5) * CELL; if (xx > 70) { tint = [0.72, 0.74, 0.7]; bands.push([r.y0, r.y1, T_MURO, 3, 0]); } else { tint = [0.85, 0.85, 0.8]; bands.push([r.y0, r.y1, T_EARTH, 3, 0]); } }
    else if (k === K_ESC) { tint = [0.78, 0.75, 0.7]; bands.push([r.y0, r.y1, T_CONC, 1.5, 0]); }
    else { tint = [0.72, 0.7, 0.66]; bands.push([r.y0, r.y1, T_CONC, 2, 0]); }
    for (const [y0, y1, tile, sc, yref] of bands) {
      const u0 = alongStart / sc, u1 = (alongStart + len) / sc, v0 = (y0 - yref) / (tile === T_WIN_A || tile === T_WIN_B || tile === T_AZUL || tile === T_DOOR || tile === T_SHOP ? 2.9 : sc), v1 = (y1 - yref) / (tile === T_WIN_A || tile === T_WIN_B || tile === T_AZUL || tile === T_DOOR || tile === T_SHOP ? 2.9 : sc);
      const pts = [[pA[0], y0, pA[1]], [pA[0], y1, pA[1]], [pB[0], y1, pB[1]], [pB[0], y0, pB[1]]];
      const cols = pts.map((p, q) => { const sh = shadow(p[0] + nx * 0.15 + (q >= 2 ? -1 : 1) * (pB[0] - pA[0]) / Math.max(len, 1e-3) * 0.05, Math.max(p[1] - 0.02, y0 + 0.05) + (q === 1 || q === 2 ? -0.05 : 0.08), p[2] + nz * 0.15 + (q >= 2 ? -1 : 1) * (pB[1] - pA[1]) / Math.max(len, 1e-3) * 0.05); const ao = (q === 0 || q === 3) && Math.abs(y0 - r.y0) < 0.01 ? 0.72 : 1; return lit(tint, nx, 0, nz, sh, ao); });
      const flip = (d === 0 || d === 3);
      const uA = flip ? u1 : u0, uB = flip ? u0 : u1;
      geo.quad(pts, [[uA, v0], [uA, v1], [uB, v1], [uB, v0]], tile, cols);
    }
  }
  map.signs = signs;
  return { geo, lines, decals, hAt, shadow, lit };
}

// ---------- objetos de cena ----------
function buildDecor(map, W) {
  const { geo, lines, decals, hAt, lit } = W; const { K, H, HV, HID, houses, idx } = map;
  const R = mulberry(map.seed + 99);
  const L = (a, b, col, sag) => { // fio com catenária
    const n = sag ? 6 : 1, len = Math.hypot(b[0] - a[0], b[2] - a[2]);
    for (let k = 0; k < n; k++) { const t0 = k / n, t1 = (k + 1) / n, s0 = sag ? Math.sin(t0 * Math.PI) * len * 0.035 : 0, s1 = sag ? Math.sin(t1 * Math.PI) * len * 0.035 : 0;
      lines.push(lerp(a[0], b[0], t0), lerp(a[1], b[1], t0) - s0, lerp(a[2], b[2], t0), col[0], col[1], col[2], lerp(a[0], b[0], t1), lerp(a[1], b[1], t1) - s1, lerp(a[2], b[2], t1), col[0], col[1], col[2]); }
  };
  const WIRE = [0.08, 0.08, 0.08], METAL = [0.45, 0.47, 0.5], YEL = [1.15, 0.9, 0.12];
  // decalque virado para quem olha na direção -n (n = normal da parede)
  const decal = (cx, cy, cz, nx, nz, w, h, u0, v0, u1, v1) => { const rx = nz, rz = -nx, o = 0.03; const P = (a, b) => [cx + rx * a * w / 2 + nx * o, cy + b * h / 2, cz + rz * a * w / 2 + nz * o];
    decals.push({ p: [P(-1, -1), P(-1, 1), P(1, 1), P(1, -1)], uv: [[u0, v1], [u0, v0], [u1, v0], [u1, v1]], n: [nx, 0, nz] }); };
  // postes de concreto, transformadores, luminárias e fiação
  for (const p of map.poles) {
    const t = p.base + 7.5; geo.box(p.x - 0.12, p.base, p.z - 0.12, p.x + 0.12, t, p.z + 0.12, T_CONC, [0.78, 0.77, 0.74], 1);
    geo.box(p.x - 0.7, t - 0.5, p.z - 0.06, p.x + 0.7, t - 0.38, p.z + 0.06, T_CONC, [0.7, 0.7, 0.7], 1);
    geo.box(p.x - 0.06, t - 0.5, p.z - 0.7, p.x + 0.06, t - 0.38, p.z + 0.7, T_CONC, [0.7, 0.7, 0.7], 1);
    if (h2(p.x * 10 | 0, p.z * 10 | 0, 3) < 0.3) geo.box(p.x + 0.14, t - 2.2, p.z - 0.3, p.x + 0.6, t - 1.3, p.z + 0.3, T_ZINC, [0.55, 0.58, 0.6], 1);
    if (p.ave) { const dir = -1; geo.box(p.x + dir * 1.6, t - 0.2, p.z - 0.06, p.x, t - 0.1, p.z + 0.06, T_ZINC, METAL, 1); geo.box(p.x + dir * 1.9, t - 0.32, p.z - 0.18, p.x + dir * 1.3, t - 0.18, p.z + 0.18, T_PLASTER, [1.5, 1.45, 1.2], 1); }
    else if (h2(p.x * 10 | 0, p.z * 10 | 0, 4) < 0.6) geo.box(p.x - 0.18, t - 1.4, p.z - 0.18, p.x + 0.18, t - 1.2, p.z + 0.18, T_PLASTER, [1.45, 1.4, 1.15], 1);
    p.top = t - 0.45;
  }
  const seen = new Set();
  map.poles.forEach((p, a) => {
    const near = map.poles.map((q, b) => ({ b, d: (q.x - p.x) ** 2 + (q.z - p.z) ** 2 })).filter(o => o.b !== a && o.d < 480).sort((u, v) => u.d - v.d).slice(0, 3);
    for (const o of near) { const k = Math.min(a, o.b) + ':' + Math.max(a, o.b); if (seen.has(k)) continue; seen.add(k); const q = map.poles[o.b];
      for (const off of [-0.55, 0, 0.55]) L([p.x + off, p.top, p.z], [q.x + off, q.top, q.z], WIRE, true); }
    // ramais para as casas (gatos de luz)
    for (let k = 0; k < 4; k++) { const ang = R() * Math.PI * 2, dist = 3 + R() * 6, x = p.x + Math.cos(ang) * dist, z = p.z + Math.sin(ang) * dist, i = Math.floor(x / CELL), j = Math.floor(z / CELL); if (i < 0 || j < 0 || i >= GX || j >= GZ) continue; const c = j * GX + i; if (K[c] !== K_ROOF || H[c] > p.top - 0.3) continue; L([p.x, p.top - 0.2, p.z], [x, H[c] + 0.25 + R() * 0.6, z], WIRE, true); }
  });
  // carros estacionados
  for (const car of map.cars) {
    if (car.bus) { const { x, z } = car; // ônibus urbano azul e branco
      geo.box(x - 1.25, 0.35, z - 5.5, x + 1.25, 1.3, z + 5.5, T_PLASTER, [0.95, 0.95, 0.95], 1, 61); geo.box(x - 1.25, 1.3, z - 5.5, x + 1.25, 2.2, z + 5.5, T_WATER, [0.3, 0.38, 0.48], 1, 60);
      geo.box(x - 1.25, 2.2, z - 5.5, x + 1.25, 3.0, z + 5.5, T_PLASTER, [0.25, 0.5, 0.95], 1, 61); geo.box(x - 1.26, 0.6, z - 5.5, x + 1.26, 0.9, z + 5.5, T_PLASTER, [0.25, 0.5, 0.95], 1, 60);
      for (const [a, b] of [[-1, -3.6], [1, -3.6], [-1, 3.4], [1, 3.4]]) geo.box(x + a * 1.2 - 0.15, 0, z + b - 0.5, x + a * 1.2 + 0.15, 1.0, z + b + 0.5, T_ASPH, [0.22, 0.22, 0.22], 1, 61); continue; }
    const { x, z, col } = car, hl = 2.1, hw = 0.85;
    geo.box(x - hw, 0.32, z - hl, x + hw, 0.95, z + hl, T_PLASTER, col, 1, 61);
    if (car.van) geo.box(x - hw + 0.05, 0.95, z - hl + 0.6, x + hw - 0.05, 1.9, z + hl - 0.1, T_PLASTER, col, 1, 61);
    else { geo.box(x - hw + 0.12, 0.95, z - 0.9, x + hw - 0.12, 1.42, z + 1.0, T_WATER, [0.35, 0.42, 0.5], 1, 61); geo.box(x - hw + 0.1, 1.41, z - 0.85, x + hw - 0.1, 1.45, z + 0.95, T_PLASTER, col, 1, 1); }
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) geo.box(x + a * hw - 0.12, 0, z + b * 1.35 - 0.33, x + a * hw + 0.12, 0.62, z + b * 1.35 + 0.33, T_ASPH, [0.25, 0.25, 0.25], 1, 61);
    geo.box(x - hw + 0.15, 0.62, z + hl, x - hw + 0.45, 0.8, z + hl + 0.02, T_PLASTER, [1.6, 1.5, 1.2], 1, 16);
    geo.box(x + hw - 0.45, 0.62, z + hl, x + hw - 0.15, 0.8, z + hl + 0.02, T_PLASTER, [1.6, 1.5, 1.2], 1, 16);
  }
  // árvores
  for (const t of map.trees) { geo.box(t.x - 0.13, 0.15, t.z - 0.13, t.x + 0.13, 2.8, t.z + 0.13, T_EARTH, [0.45, 0.35, 0.25], 1);
    for (let k = 0; k < 4; k++) { const ox = (h2(t.x * 9 | 0, k, 1) - 0.5) * 1.6, oz = (h2(t.z * 9 | 0, k, 2) - 0.5) * 1.6, s = (1 + h2(k, t.z * 3 | 0, 3)) * t.s; geo.box(t.x + ox - s, 2.4 + k * 0.4, t.z + oz - s, t.x + ox + s, 3.6 + k * 0.45, t.z + oz + s, T_EARTH, [0.42, 0.72, 0.36], 2); } }
  // sinalização da Avenida das Américas
  for (let z = 1.5; z < 158.5; z += 1) { const ax = aveX(z), ax2 = aveX(z + 1), y = 0.012;
    for (const o of [-0.12, 0.12]) geo.quad([[ax + o - 0.05, y, z], [ax2 + o - 0.05, y, z + 1], [ax2 + o + 0.05, y, z + 1], [ax + o + 0.05, y, z]], [[0, 0], [0, 0.2], [0.2, 0.2], [0.2, 0]], T_PLASTER, [[1.2, 0.95, 0.3], [1.2, 0.95, 0.3], [1.2, 0.95, 0.3], [1.2, 0.95, 0.3]]);
    if (Math.floor(z) % 4 < 2) for (const o of [-2.8, 2.8]) geo.quad([[ax + o - 0.06, y, z], [ax2 + o - 0.06, y, z + 1], [ax2 + o + 0.06, y, z + 1], [ax + o + 0.06, y, z]], [[0, 0], [0, 0.2], [0.2, 0.2], [0.2, 0]], T_PLASTER, [[1.1, 1.1, 1.1], [1.1, 1.1, 1.1], [1.1, 1.1, 1.1], [1.1, 1.1, 1.1]]); }
  for (let k = 0; k < 9; k++) { const ax = aveX(80), x0 = ax - 4.6 + k * 1.05; geo.quad([[x0, 0.014, 77.6], [x0, 0.014, 82.4], [x0 + 0.55, 0.014, 82.4], [x0 + 0.55, 0.014, 77.6]], [[0, 0], [0, 0.3], [0.3, 0.3], [0.3, 0]], T_PLASTER, [[1.15, 1.15, 1.12], [1.15, 1.15, 1.12], [1.15, 1.15, 1.12], [1.15, 1.15, 1.12]]); }
  // pontos de ônibus
  for (const zc of [38, 122]) { const x = aveX(zc) + 6.6; geo.box(x - 0.9, 2.4, zc - 1.8, x + 0.9, 2.5, zc + 1.8, T_ZINC, [0.6, 0.62, 0.65], 1); for (const dz of [-1.6, 1.6]) geo.box(x + 0.7, 0.15, zc + dz - 0.05, x + 0.8, 2.4, zc + dz + 0.05, T_ZINC, METAL, 1); geo.box(x + 0.3, 0.55, zc - 1.2, x + 0.7, 0.62, zc + 1.2, T_ZINC, [0.5, 0.35, 0.25], 1); }
  // escadão: corrimão central, luminárias nos patamares
  const escAt = x => hAt(x, 80);
  const onLand = x => S.ESC_LAND.some(l => Math.abs(x - l.x) < l.hx + 0.25);
  for (let x = map.x0Esc + 0.6; x < 69; x += 1.5) { const y = escAt(x); if (onLand(x)) continue; for (const zz of [80, 78.08, 81.92]) geo.box(x - 0.035, y, zz - 0.035, x + 0.035, y + 0.95, zz + 0.035, T_ZINC, YEL, 1); const y2 = escAt(x + 1.5); if (!onLand(x + 1.5) && x + 1.5 < 69) for (const zz of [80, 78.08, 81.92]) { L([x, y + 0.95, zz], [x + 1.5, y2 + 0.95, zz], YEL, false); L([x, y + 0.5, zz], [x + 1.5, y2 + 0.5, zz], YEL, false); } }
  for (const l of S.ESC_LAND) for (const zz of [80 - l.hz + 0.25, 80 + l.hz - 0.25]) { const x0 = l.x - l.hx + 0.15; geo.box(x0, l.h, zz - 0.08, x0 + 0.16, l.h + 3.6, zz + 0.08, T_ZINC, METAL, 1); geo.box(x0, l.h + 3.5, zz - 0.08, x0 + 0.8, l.h + 3.6, zz + 0.08, T_ZINC, METAL, 1); geo.box(x0 + 0.55, l.h + 3.3, zz - 0.2, x0 + 0.9, l.h + 3.5, zz + 0.2, T_PLASTER, [1.6, 1.5, 1.2], 1); }
  // Praça Central: quadra de futsal pintada e mastro da bandeira de captura
  { const P = S.ESC_LAND[1], y = P.h + 0.012, x0 = P.x - 3.2, x1 = P.x + 3.2, z0 = 80 - 6.6, z1 = 80 + 6.6, LC = [1.25, 1.25, 1.2];
    const line = (a, b, c, d) => geo.quad([[a, y, b], [a, y, d], [c, y, d], [c, y, b]], [[0, 0], [0, 0.2], [0.2, 0.2], [0.2, 0]], T_PLASTER, [LC, LC, LC, LC]);
    line(x0, z0, x1, z0 + 0.08); line(x0, z1 - 0.08, x1, z1); line(x0, z0, x0 + 0.08, z1); line(x1 - 0.08, z0, x1, z1); line(x0, 79.96, x1, 80.04);
    for (let k = 0; k < 24; k++) { const a0 = k / 24 * Math.PI * 2, a1 = (k + 1) / 24 * Math.PI * 2, r0 = 1.6, r1 = 1.68; geo.quad([[P.x + Math.cos(a0) * r0, y, 80 + Math.sin(a0) * r0], [P.x + Math.cos(a0) * r1, y, 80 + Math.sin(a0) * r1], [P.x + Math.cos(a1) * r1, y, 80 + Math.sin(a1) * r1], [P.x + Math.cos(a1) * r0, y, 80 + Math.sin(a1) * r0]], [[0, 0], [0, 0.2], [0.2, 0.2], [0.2, 0]], T_PLASTER, [LC, LC, LC, LC]); }
    for (const zz of [z0 + 0.3, z1 - 0.3]) { geo.box(P.x - 1.5, P.h, zz - 0.04, P.x - 1.42, P.h + 2, zz + 0.04, T_PLASTER, [1.1, 1.1, 1.1], 1); geo.box(P.x + 1.42, P.h, zz - 0.04, P.x + 1.5, P.h + 2, zz + 0.04, T_PLASTER, [1.1, 1.1, 1.1], 1); geo.box(P.x - 1.5, P.h + 1.92, zz - 0.04, P.x + 1.5, P.h + 2, zz + 0.04, T_PLASTER, [1.1, 1.1, 1.1], 1); }
    geo.box(P.x - 0.05, P.h, 79.95, P.x + 0.05, P.h + 5.2, 80.05, T_ZINC, [0.85, 0.85, 0.88], 1); geo.box(P.x - 0.3, P.h, 79.7, P.x + 0.3, P.h + 0.25, 80.3, T_CONC, [0.7, 0.7, 0.7], 1); }
  // beira do valão: guarda-corpo amarelo e escadarias de acesso
  for (const zs of [[10, 80], [80, 150]]) for (let z = zs[0]; z < zs[1]; z += 2) { geo.box(75.45, 0.9, z - 0.04, 75.53, 1.95, z + 0.04, T_ZINC, YEL, 1); L([75.49, 1.95, z], [75.49, 1.95, Math.min(z + 2, zs[1])], YEL, false); L([75.49, 1.45, z], [75.49, 1.45, Math.min(z + 2, zs[1])], YEL, false); }
  for (const t of CANAL_ST) for (const mz of [false, true]) { const za = mz ? 160 - t.zt : t.zt, zb = mz ? 160 - t.zb : t.zb, n = 10; for (let k = 0; k < n; k++) { const z0 = lerp(za, zb, k / n), z1 = lerp(za, zb, (k + 1) / n); L([72.45, hAt(72.2, z0) + 1, z0], [72.45, hAt(72.2, z1) + 1, z1], YEL, false); } }
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
  // grafites COMPLEXO DO ESCADÃO
  decals.push({ p: [[18.96, 0.25, 83.3], [18.96, 2.15, 83.3], [18.96, 2.15, 90.7], [18.96, 0.25, 90.7]], uv: [[0, 300 / 1024], [0, 0], [1, 0], [1, 300 / 1024]], n: [-1, 0, 0] });
  decals.push({ p: [[18.96, 0.25, 69.3], [18.96, 2.15, 69.3], [18.96, 2.15, 76.7], [18.96, 0.25, 76.7]], uv: [[0, 300 / 1024], [0, 0], [1, 0], [1, 300 / 1024]], n: [-1, 0, 0] });
  { const xa = 29.8, xb = 36.6, ya = escAt(xa) + 0.55, yb = escAt(xb) + 0.55;
    decals.push({ p: [[xb, yb, 81.97], [xb, yb + 2.7, 81.97], [xa, ya + 2.7, 81.97], [xa, ya, 81.97]], uv: [[0, 300 / 1024], [0, 0], [1, 0], [1, 300 / 1024]], n: [0, 0, -1] });
    decals.push({ p: [[xa, ya, 78.03], [xa, ya + 2.7, 78.03], [xb, yb + 2.7, 78.03], [xb, yb, 78.03]], uv: [[0, 300 / 1024], [0, 0], [1, 0], [1, 300 / 1024]], n: [0, 0, 1] }); }
  { const l = S.ESC_LAND[0], y = l.h + 1.45; decal(29.5, y, 83.75, -1, 0, 2.5, 1.72, 0, 848 / 1024, 0.25, 1); decal(29.5, y, 76.25, -1, 0, 2.5, 1.72, 0, 848 / 1024, 0.25, 1); }
  for (const [team, zw, nz] of [[0, 1.0, 1], [1, 159.0, -1]]) for (const xc of [27, 47]) { const zp = team ? 157 : 3, hb = hAt(xc, zp), u0 = team ? 432 / 1024 : 256 / 1024;
    decal(xc, hb + 2.4, zw, 0, nz, 3.2, 3.2, u0, 848 / 1024, u0 + 176 / 1024, 1);
    const nc = team ? [2.2, 0.5, 0.4] : [0.5, 1.1, 2.4]; geo.box(xc - 2, hb + 4.3, zw + nz * 0.02 - 0.05, xc + 2, hb + 4.42, zw + nz * 0.02 + 0.05, T_PLASTER, nc, 1); }
  for (const [zc, zb] of [[-1.5, 1], [161.5, 159]]) { const x = 62, b = terrain(x, zb) + 4.5; for (const [a, c] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) geo.box(x + a * 1.2 - 0.12, b - 4.5, zc + c * 1.2 - 0.12, x + a * 1.2 + 0.12, b + 3, zc + c * 1.2 + 0.12, T_CONC, [0.7, 0.7, 0.68], 1);
    geo.box(x - 1.5, b + 2.6, zc - 1.5, x + 1.5, b + 3, zc + 1.5, T_CONC, [0.75, 0.74, 0.7], 1); geo.box(x - 1.5, b + 3, zc - 1.5, x + 1.5, b + 4, zc - 1.42, T_BRICK, [1, 1, 1], 1); geo.box(x - 1.7, b + 5.2, zc - 1.7, x + 1.7, b + 5.35, zc + 1.7, T_ZINC, [0.6, 0.62, 0.65], 1);
    for (const [a, c] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) geo.box(x + a * 1.45 - 0.05, b + 3, zc + c * 1.45 - 0.05, x + a * 1.45 + 0.05, b + 5.2, zc + c * 1.45 + 0.05, T_ZINC, METAL, 1); }
  for (const [zc, nz] of [[16, -1], [144, 1]]) { const x = aveX(zc) - 5.6; geo.box(x - 0.06, 0.15, zc - 0.06, x + 0.06, 5.1, zc + 0.06, T_ZINC, METAL, 1); geo.box(x, 4.6, zc - 0.03, x + 3.9, 4.7, zc + 0.03, T_ZINC, METAL, 1);
    decal(x + 2.1, 4.25, zc - 0.05, 0, -1, 3.6, 0.78, 612 / 1024, 852 / 1024, 1020 / 1024, 940 / 1024); decal(x + 2.1, 4.25, zc + 0.05, 0, 1, 3.6, 0.78, 612 / 1024, 852 / 1024, 1020 / 1024, 940 / 1024); }
  // estações de munição nas bases principais e mastros das bases B e C
  for (const t of [0, 1]) { const st = SUPPLY[t], z0 = t ? 157.0 : 2.5, z1 = t ? 157.5 : 3.0, y = hAt(st.x, t ? 156.4 : 3.6), tc = TEAM[t].col;
    geo.box(st.x - 0.75, y, z0, st.x - 0.05, y + 0.6, z1, T_ZINC, [0.3, 0.42, 0.26], 1); geo.box(st.x + 0.05, y, z0, st.x + 0.75, y + 0.6, z1, T_ZINC, [0.3, 0.42, 0.26], 1); geo.box(st.x - 0.5, y + 0.6, z0, st.x + 0.5, y + 1.0, z1, T_ZINC, [0.35, 0.45, 0.3], 1);
    geo.box(st.x - 0.76, y + 0.25, z0 - 0.01, st.x + 0.76, y + 0.33, z1 + 0.01, T_PLASTER, tc, 1);
    decal(st.x, y + 2.5, t ? z0 - 0.02 : z1 + 0.02, 0, t ? -1 : 1, 2.2, 0.37, 612 / 1024, 950 / 1024, 1020 / 1024, 1018 / 1024);
    geo.box(st.x - 1.2, y + 2.2, t ? z0 - 0.05 : z1 - 0.05, st.x + 1.2, y + 2.8, t ? z0 + 0.05 : z1 + 0.05, T_PLASTER, [0.1, 0.1, 0.1], 1, 0); }
  for (const bx of [S.ESC_LAND[2].x, (WALK_X0 + WALK_X1) / 2]) { const y = hAt(bx, 80); geo.box(bx - 0.05, y, 79.95, bx + 0.05, y + 5.2, 80.05, T_ZINC, [0.85, 0.85, 0.88], 1); geo.box(bx - 0.3, y, 79.7, bx + 0.3, y + 0.25, 80.3, T_CONC, [0.7, 0.7, 0.7], 1); }
  // letreiros das lojas
  for (const s of map.signs) {
    const w = Math.min(s.len - 0.3, 4.2), cx = (s.pA[0] + s.pB[0]) / 2, cz = (s.pA[1] + s.pB[1]) / 2, ux = s.nz, uz = -s.nx, o = 0.04;
    const a = [cx - ux * w / 2 + s.nx * o, cz - uz * w / 2 + s.nz * o], b = [cx + ux * w / 2 + s.nx * o, cz + uz * w / 2 + s.nz * o];
    const si = s.h.id % SIGN_NAMES.length, u0 = (si % 2) * 0.5, v0 = (320 + Math.floor(si / 2) * 64) / 1024, v1 = v0 + 64 / 1024;
    decals.push({ p: [[a[0], s.y - 0.62, a[1]], [a[0], s.y - 0.05, a[1]], [b[0], s.y - 0.05, b[1]], [b[0], s.y - 0.62, b[1]]], uv: [[u0, v1], [u0, v0], [u0 + 0.5, v0], [u0 + 0.5, v1]], n: [s.nx, 0, s.nz] });
  }
  // pichações nos muros da avenida
  for (let k = 0; k < 16; k++) { const z = 14 + k * 9 + R() * 4; if (Math.abs(z - 80) < 12) continue; const x = 18.96 + (aveX(z) - aveX(80)); const ti = Math.floor(R() * 4), u0 = ti * 0.25, v0 = 720 / 1024, v1 = 848 / 1024;
    const i = Math.floor((x + 0.3) / CELL), j = Math.floor(z / CELL); if (K[j * GX + i] !== K_BLOCK) continue; const fx = i * CELL - 0.04;
    decals.push({ p: [[fx, 0.6, z], [fx, 1.9, z], [fx, 1.9, z + 2.4], [fx, 0.6, z + 2.4]], uv: [[u0, v1], [u0, v0], [u0 + 0.25, v0], [u0 + 0.25, v1]], n: [-1, 0, 0] }); }
  // água do valão e encosta do outro lado
  geo.quad([[73.6, 0.55, -40], [73.6, 0.55, 200], [81, 0.55, 200], [81, 0.55, -40]], [[0, 0], [0, 60], [2, 60], [2, 0]], T_WATER, [[0.75, 0.8, 0.75], [0.75, 0.8, 0.75], [0.75, 0.8, 0.75], [0.75, 0.8, 0.75]]);
  for (let z = -60; z < 220; z += 10) for (let x = 80; x < 220; x += 10) {
    const hh = (xx, zz) => xx <= 80 ? 0.4 : 0.4 + (xx - 80) * 0.32 + 4 * Math.sin(zz / 23) * Math.sin(xx / 17) + 2 * Math.sin(zz / 7 + xx / 11);
    const c = lit([0.46, 0.62, 0.36], -0.3, 1, 0, 1, 1);
    geo.quad([[x, hh(x, z), z], [x, hh(x, z + 10), z + 10], [x + 10, hh(x + 10, z + 10), z + 10], [x + 10, hh(x + 10, z), z]], [[x / 6, z / 6], [x / 6, (z + 10) / 6], [(x + 10) / 6, (z + 10) / 6], [(x + 10) / 6, z / 6]], T_EARTH, [c, c, c, c]);
    if (h2(x, z, 8) < 0.35) { const tx = x + 5, tz = z + 5, ty = hh(tx, tz); geo.box(tx - 1.8, ty, tz - 1.8, tx + 1.8, ty + 4 + h2(x, z, 9) * 4, tz + 1.8, T_EARTH, [0.32, 0.55, 0.3], 3); }
  }
  // chão além do mapa, cidade a oeste, continuação da favela ao norte e ao sul, montanhas
  geo.quad([[-320, -0.03, -320], [-320, -0.03, 480], [80, -0.03, 480], [80, -0.03, -320]], [[0, 0], [0, 130], [65, 130], [65, 0]], T_EARTH, [[0.55, 0.55, 0.5], [0.55, 0.55, 0.5], [0.55, 0.55, 0.5], [0.55, 0.55, 0.5]]);
  for (let z = -50; z < 210; z += 9 + R() * 6) { let x = -4; while (x > -70) { const w = 8 + R() * 10, d = 7 + R() * 6, hgt = 6 + R() * (R() < 0.2 ? 30 : 14), tint = TINTS[Math.floor(R() * TINTS.length)].map(v => v * 0.85); geo.box(x - w, 0, z, x, hgt, z + d, R() < 0.5 ? T_WIN_A : T_WIN_B, tint, 3); x -= w + 3 + R() * 6; } }
  for (const [za, zb] of [[-48, 0.6], [159.4, 206]]) for (let z = za; z < zb; z += 4 + R() * 3) for (let x = 15; x < 72; x += 4 + R() * 3.5) {
    const zc = clamp(z, 1, 159), base = terrain(x, zc) * (x > 70 ? 0 : 1), hgt = base + 3 + Math.floor(R() * 3) * 2.9, tint = TINTS[Math.floor(R() * TINTS.length)];
    if (x > 70) continue; const w = 3.5 + R() * 2.5, d = 3.5 + R() * 2.5; geo.box(x, base - 3, z, x + w, hgt, z + d, R() < 0.25 ? T_BRICK : R() < 0.5 ? T_WIN_A : T_WIN_B, R() < 0.25 ? [1, 1, 1] : tint, 3, 61);
    geo.box(x, hgt, z, x + w, hgt + 0.02, z + d, T_SLAB, [1, 1, 1], 3, 1); }
  for (let z = -50; z < 210; z += 8) { const ax = aveX(clamp(z, 1, 159)); if (z > 0 && z < 160) continue; geo.box(ax - 5, -0.02, z, ax + 5, 0.0, z + 8, T_ASPH, [1, 1, 1], 4, 1); }
  for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2 + 0.3, dist = 260 + R() * 120, cx = 40 + Math.cos(a) * dist, cz = 80 + Math.sin(a) * dist, s = 70 + R() * 70, hgt = 60 + R() * 90, col = lit([0.38, 0.5, 0.36], 0, 1, 0, 1, 1);
    const top = [cx, hgt, cz], b = [[cx - s, -1, cz - s], [cx + s, -1, cz - s], [cx + s, -1, cz + s], [cx - s, -1, cz + s]];
    for (let q = 0; q < 4; q++) { const p0 = b[q], p1 = b[(q + 1) % 4], dark = [col[0] * (0.7 + q * 0.1), col[1] * (0.7 + q * 0.1), col[2] * (0.7 + q * 0.1)]; geo.quad([p0, top, top, p1], [[0, 0], [5, 12], [5, 12], [10, 0]], T_EARTH, [dark, col, col, dark]); } }
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
  const world = compile(hp + `attribute vec3 aP; attribute vec2 aU; attribute vec3 aC; uniform mat4 uVP; uniform vec3 uEye; uniform float uMode;
    varying vec2 vU; varying vec2 vT; varying vec3 vC; varying float vD;
    void main(){ float t = floor(aU.x/128.0); vU = vec2(aU.x - t*128.0, aU.y); if (uMode > 0.5) vU = aU; vT = vec2(mod(t,4.0), floor(t/4.0))*0.25; vC = aC; vD = distance(aP, uEye); gl_Position = uVP*vec4(aP,1.0); }`,
    (fancy ? '#extension GL_EXT_shader_texture_lod : enable\n#extension GL_OES_standard_derivatives : enable\n' : '') + fhp + FOG + `uniform sampler2D uTex; uniform float uMode; varying vec2 vU; varying vec2 vT; varying vec3 vC; varying float vD;
    void main(){ vec4 tx;
      if (uMode > 0.5) { tx = texture2D(uTex, vU); if (tx.a < 0.45) discard; }
      else { vec2 st = vT + (0.004 + fract(vU)*0.992)*0.25;
        ${fancy ? 'vec2 dx = dFdx(vU)*256.0, dy = dFdy(vU)*256.0; float lod = clamp(0.5*log2(max(dot(dx,dx), dot(dy,dy))), 0.0, 4.0); tx = texture2DLodEXT(uTex, st, lod);' : 'tx = texture2D(uTex, st);'} }
      vec3 c = tx.rgb * vC * 1.12; gl_FragColor = vec4(fogit(c, vD), 1.0); }`);
  const solid = compile(hp + `attribute vec3 aP; attribute vec3 aN; uniform mat4 uVP; uniform mat4 uM; uniform vec3 uEye; varying vec3 vN; varying float vD;
    void main(){ vec4 w = uM*vec4(aP,1.0); vN = mat3(uM)*aN; vD = distance(w.xyz, uEye); gl_Position = uVP*w; }`,
    fhp + FOG + `uniform vec3 uCol; uniform vec3 uSun; uniform float uFlash; varying vec3 vN; varying float vD;
    void main(){ vec3 n = normalize(vN); float d = max(dot(n, uSun), 0.0); vec3 c = uCol*(vec3(0.5,0.54,0.62) + vec3(0.8,0.7,0.55)*d); c = mix(c, vec3(1.0,0.3,0.25), uFlash); gl_FragColor = vec4(fogit(c, vD), 1.0); }`);
  const flat = compile(hp + `attribute vec3 aP; attribute vec4 aC; attribute vec2 aU; uniform mat4 uVP; uniform vec3 uEye; varying vec4 vC; varying vec2 vU; varying float vD;
    void main(){ vC = aC; vU = aU; vD = distance(aP, uEye); gl_Position = uVP*vec4(aP,1.0); }`,
    fhp + FOG + `uniform float uSoft; uniform float uNoFog; varying vec4 vC; varying vec2 vU; varying float vD;
    void main(){ float a = vC.a; if (uSoft > 0.5) { float r = length(vU*2.0-1.0); a *= smoothstep(1.0, 0.2, r); }
      vec3 c = uNoFog > 0.5 ? vC.rgb : fogit(vC.rgb, vD); gl_FragColor = vec4(c, a); }`);
  // cubo unitário com normais
  const cube = (() => { const v = []; const F = [[0, 1, 0, [[-1, 1, -1], [-1, 1, 1], [1, 1, 1], [1, 1, -1]]], [0, -1, 0, [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]]], [1, 0, 0, [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]]], [-1, 0, 0, [[-1, -1, 1], [-1, 1, 1], [-1, 1, -1], [-1, -1, -1]]], [0, 0, 1, [[1, -1, 1], [1, 1, 1], [-1, 1, 1], [-1, -1, 1]]], [0, 0, -1, [[-1, -1, -1], [-1, 1, -1], [1, 1, -1], [1, -1, -1]]]];
    for (const [nx, ny, nz, p] of F) for (const k of [0, 1, 2, 0, 2, 3]) v.push(p[k][0] * 0.5, p[k][1] * 0.5, p[k][2] * 0.5, nx, ny, nz);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.STATIC_DRAW); return b; })();
  // céu: cúpula com gradiente
  const sky = (() => { const v = []; const ring = (a, b) => { for (let k = 0; k < 24; k++) { const t0 = k / 24 * Math.PI * 2, t1 = (k + 1) / 24 * Math.PI * 2; const pt = (t, e) => [Math.cos(t) * Math.cos(e) * 500, Math.sin(e) * 500, Math.sin(t) * Math.cos(e) * 500]; const col = e => { const s = Math.max(0, Math.sin(e)); return [lerp(FOG_C[0], 0.36, Math.pow(s, 0.6)), lerp(FOG_C[1], 0.56, Math.pow(s, 0.6)), lerp(FOG_C[2], 0.86, Math.pow(s, 0.6)), 1]; };
      const q = [[t0, a], [t0, b], [t1, b], [t0, a], [t1, b], [t1, a]]; for (const [t, e] of q) { const p = pt(t, e), c = col(e); v.push(p[0], p[1], p[2], c[0], c[1], c[2], c[3], 0, 0); } } };
    const E = [-0.2, 0, 0.06, 0.15, 0.3, 0.55, 0.9, 1.4, 1.5708]; for (let k = 0; k < E.length - 1; k++) ring(E[k], E[k + 1]);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.STATIC_DRAW); return { b, n: v.length / 9 }; })();
  const dyn = gl.createBuffer();
  let atlasTex = null, decalTex = null; const chunks = []; let lineBuf = null, lineN = 0, decalBuf = null, decalN = 0, decalIdx = null;
  function texFrom(cv, mip) { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    if (mip) { gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); } else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); return t; }
  function upload(geo, decalGeo, lines, atlas, decalCv) {
    atlasTex = texFrom(atlas, fancy); decalTex = texFrom(decalCv, true);
    for (const c of geo.chunks) { if (!c.i.length) continue; const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(c.v), gl.STATIC_DRAW); const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(c.i), gl.STATIC_DRAW); chunks.push({ vb, ib, n: c.i.length }); }
    const dc = decalGeo.chunks[0]; if (dc.i.length) { decalBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, decalBuf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(dc.v), gl.STATIC_DRAW); decalIdx = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, decalIdx); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(dc.i), gl.STATIC_DRAW); decalN = dc.i.length; }
    lineBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, lineBuf); const lv = []; for (let k = 0; k < lines.length; k += 6) lv.push(lines[k], lines[k + 1], lines[k + 2], lines[k + 3], lines[k + 4], lines[k + 5], 1, 0, 0); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(lv), gl.STATIC_DRAW); lineN = lv.length / 9;
  }
  const bindWorld = (vb) => { gl.bindBuffer(gl.ARRAY_BUFFER, vb); const a = world.a; gl.enableVertexAttribArray(a.aP); gl.vertexAttribPointer(a.aP, 3, gl.FLOAT, false, 32, 0); gl.enableVertexAttribArray(a.aU); gl.vertexAttribPointer(a.aU, 2, gl.FLOAT, false, 32, 12); gl.enableVertexAttribArray(a.aC); gl.vertexAttribPointer(a.aC, 3, gl.FLOAT, false, 32, 20); };
  const bindFlat = (b) => { gl.bindBuffer(gl.ARRAY_BUFFER, b); const a = flat.a; gl.enableVertexAttribArray(a.aP); gl.vertexAttribPointer(a.aP, 3, gl.FLOAT, false, 36, 0); gl.enableVertexAttribArray(a.aC); gl.vertexAttribPointer(a.aC, 4, gl.FLOAT, false, 36, 12); if (a.aU >= 0) { gl.enableVertexAttribArray(a.aU); gl.vertexAttribPointer(a.aU, 2, gl.FLOAT, false, 36, 28); } };
  const disableAll = () => { for (let i = 0; i < 4; i++) gl.disableVertexAttribArray(i); };
  let VP = null, eye = [0, 0, 0], fogD = 0.0062;
  const R = {
    gl, fancy, canvas,
    upload,
    begin(vp, e, fd) { VP = vp; eye = e; fogD = fd; gl.clearColor(FOG_C[0], FOG_C[1], FOG_C[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND); },
    sky() { gl.useProgram(flat.p); gl.depthMask(false); const vp = m4.mul(VP, m4.tr(eye[0], eye[1], eye[2])); gl.uniformMatrix4fv(flat.u.uVP, false, vp); gl.uniform3fv(flat.u.uEye, [0, 0, 0]); gl.uniform1f(flat.u.uSoft, 0); gl.uniform1f(flat.u.uNoFog, 1); gl.uniform3fv(flat.u.uFogC, FOG_C); gl.uniform1f(flat.u.uFogD, 0); disableAll(); bindFlat(sky.b); gl.drawArrays(gl.TRIANGLES, 0, sky.n); gl.depthMask(true); },
    world() { gl.useProgram(world.p); gl.uniformMatrix4fv(world.u.uVP, false, VP); gl.uniform3fv(world.u.uEye, eye); gl.uniform3fv(world.u.uFogC, FOG_C); gl.uniform1f(world.u.uFogD, fogD); gl.uniform1f(world.u.uMode, 0);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, atlasTex); gl.uniform1i(world.u.uTex, 0); disableAll();
      for (const c of chunks) { bindWorld(c.vb); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, c.ib); gl.drawElements(gl.TRIANGLES, c.n, gl.UNSIGNED_SHORT, 0); }
      if (decalN) { gl.uniform1f(world.u.uMode, 1); gl.bindTexture(gl.TEXTURE_2D, decalTex); gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-1, -2); bindWorld(decalBuf); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, decalIdx); gl.drawElements(gl.TRIANGLES, decalN, gl.UNSIGNED_SHORT, 0); gl.disable(gl.POLYGON_OFFSET_FILL); }
      gl.useProgram(flat.p); gl.uniformMatrix4fv(flat.u.uVP, false, VP); gl.uniform3fv(flat.u.uEye, eye); gl.uniform1f(flat.u.uSoft, 0); gl.uniform1f(flat.u.uNoFog, 0); gl.uniform3fv(flat.u.uFogC, FOG_C); gl.uniform1f(flat.u.uFogD, fogD); disableAll(); bindFlat(lineBuf); gl.drawArrays(gl.LINES, 0, lineN); },
    solidBegin(vp, e) { gl.useProgram(solid.p); gl.uniformMatrix4fv(solid.u.uVP, false, vp || VP); gl.uniform3fv(solid.u.uEye, e || eye); gl.uniform3fv(solid.u.uSun, SUN); gl.uniform3fv(solid.u.uFogC, FOG_C); gl.uniform1f(solid.u.uFogD, e ? 0 : fogD); disableAll(); gl.bindBuffer(gl.ARRAY_BUFFER, cube); gl.enableVertexAttribArray(solid.a.aP); gl.vertexAttribPointer(solid.a.aP, 3, gl.FLOAT, false, 24, 0); gl.enableVertexAttribArray(solid.a.aN); gl.vertexAttribPointer(solid.a.aN, 3, gl.FLOAT, false, 24, 12); },
    cube(M, col, flash) { gl.uniformMatrix4fv(solid.u.uM, false, M); gl.uniform3fv(solid.u.uCol, col); gl.uniform1f(solid.u.uFlash, flash || 0); gl.drawArrays(gl.TRIANGLES, 0, 36); },
    fx(verts, mode, soft, additive, noDepthWrite) { // verts: Float32Array (9 floats por vértice)
      if (!verts.length) return; gl.useProgram(flat.p); gl.uniformMatrix4fv(flat.u.uVP, false, VP); gl.uniform3fv(flat.u.uEye, eye); gl.uniform1f(flat.u.uSoft, soft ? 1 : 0); gl.uniform1f(flat.u.uNoFog, 0); gl.uniform3fv(flat.u.uFogC, FOG_C); gl.uniform1f(flat.u.uFogD, fogD);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, additive ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA); if (noDepthWrite) gl.depthMask(false);
      disableAll(); gl.bindBuffer(gl.ARRAY_BUFFER, dyn); gl.bufferData(gl.ARRAY_BUFFER, verts, gl.DYNAMIC_DRAW); bindFlat(dyn); gl.drawArrays(mode, 0, verts.length / 9); gl.disable(gl.BLEND); gl.depthMask(true); },
    clearDepth() { gl.clear(gl.DEPTH_BUFFER_BIT); },
    destroy() { const e = gl.getExtension('WEBGL_lose_context'); if (e) e.loseContext(); },
  };
  return R;
}

window.EscRender = { makeAtlas, makeDecals, buildGeometry, buildDecor, createRenderer, m4, Geo, FOG_C, SUN, TINTS };
})();
