/* Complexo do Escadão 3D — HUD (canvas) e layout personalizável.
   Posições são frações da área útil da tela (já descontadas as margens de segurança do celular). */
(function () {
'use strict';
const KEY = 'escadao3d-hud-v2';
// x, y = centro do elemento (fração da área útil); s = escala; a = opacidade
function defaults(touch, portrait) {
  const d = {
    score: { x: 0.5, y: 0.045, s: 1, a: 1, label: 'Placar' },
    radar: { x: 0.065, y: 0.11, s: 1, a: 1, label: 'Minimapa' },
    feed: { x: 0.86, y: 0.16, s: 1, a: 1, label: 'Abates' },
    alerts: { x: 0.5, y: 0.2, s: 1, a: 1, label: 'Avisos' },
    health: { x: 0.12, y: 0.94, s: 1, a: 1, label: 'Vida' },
    ammo: { x: 0.9, y: 0.93, s: 1, a: 1, label: 'Munição' },
  };
  if (touch) {
    const P = portrait;
    Object.assign(d, {
      score: { x: 0.5, y: P ? 0.035 : 0.06, s: P ? 0.85 : 1, a: 1, label: 'Placar' },
      radar: { x: P ? 0.14 : 0.075, y: P ? 0.1 : 0.16, s: P ? 0.9 : 1, a: 1, label: 'Minimapa' },
      feed: { x: 0.82, y: P ? 0.14 : 0.2, s: 0.85, a: 1, label: 'Abates' },
      alerts: { x: 0.5, y: P ? 0.2 : 0.26, s: 0.9, a: 1, label: 'Avisos' },
      health: { x: P ? 0.5 : 0.4, y: P ? 0.965 : 0.94, s: 0.85, a: 1, label: 'Vida' },
      ammo: { x: P ? 0.68 : 0.7, y: P ? 0.53 : 0.68, s: 0.95, a: 1, label: 'Munição' },
      joy: { x: P ? 0.2 : 0.13, y: P ? 0.84 : 0.76, s: 1, a: 1, label: 'Joystick' },
      fire: { x: P ? 0.8 : 0.875, y: P ? 0.86 : 0.8, s: 1, a: 1, label: 'Atirar' },
      gren: { x: P ? 0.58 : 0.765, y: P ? 0.87 : 0.84, s: 1, a: 1, label: 'Granada' },
      aim: { x: P ? 0.66 : 0.84, y: P ? 0.74 : 0.56, s: 1, a: 1, label: 'Mirar' },
      reload: { x: P ? 0.84 : 0.925, y: P ? 0.72 : 0.56, s: 1, a: 1, label: 'Recarregar' },
      crouch: { x: P ? 0.66 : 0.84, y: P ? 0.63 : 0.38, s: 1, a: 1, label: 'Agachar' },
      sprint: { x: P ? 0.84 : 0.925, y: P ? 0.61 : 0.38, s: 1, a: 1, label: 'Correr' },
      jump: { x: P ? 0.92 : 0.965, y: P ? 0.5 : 0.22, s: 0.9, a: 1, label: 'Pular' },
      swap: { x: P ? 0.46 : 0.69, y: P ? 0.9 : 0.88, s: 0.85, a: 1, label: 'Trocar arma' },
      use: { x: P ? 0.5 : 0.62, y: P ? 0.74 : 0.62, s: 1, a: 1, label: 'Interagir' },
      sound: { x: P ? 0.31 : 0.15, y: P ? 0.06 : 0.09, s: 1, a: 1, label: 'Som' },
      mic: { x: P ? 0.31 : 0.15, y: P ? 0.115 : 0.2, s: 1, a: 1, label: 'Microfone' },
      pause: { x: P ? 0.93 : 0.955, y: P ? 0.04 : 0.07, s: 1, a: 1, label: 'Pausa' },
    });
  } else Object.assign(d, { sound: { x: 0.125, y: 0.05, s: 1, a: 1, label: 'Som' }, mic: { x: 0.125, y: 0.115, s: 1, a: 1, label: 'Microfone' }, pause: { x: 0.97, y: 0.05, s: 1, a: 1, label: 'Pausa' } });
  return d;
}
const keyFor = (touch, portrait) => KEY + (touch ? '-m' : '-d') + (portrait ? '-p' : '-l');
const clampV = v => Math.min(0.98, Math.max(0.02, +v || 0.5));
function load(touch, portrait) { const d = defaults(touch, portrait); try { const s = JSON.parse(localStorage.getItem(keyFor(touch, portrait)) || '{}'); for (const k in s) if (d[k]) Object.assign(d[k], { x: clampV(s[k].x), y: clampV(s[k].y), s: Math.min(1.8, Math.max(0.5, +s[k].s || 1)), a: Math.min(1, Math.max(0.15, +s[k].a || 1)) }); } catch (e) {} return d; }
function save(touch, portrait, L) { const o = {}; for (const k in L) o[k] = { x: L[k].x, y: L[k].y, s: L[k].s, a: L[k].a }; try { localStorage.setItem(keyFor(touch, portrait), JSON.stringify(o)); } catch (e) {} }
function reset(touch, portrait) { try { localStorage.removeItem(keyFor(touch, portrait)); } catch (e) {} return defaults(touch, portrait); }
// tamanhos base (px) de cada elemento — usados pelo HUD, pelos botões e pelo editor
const SIZES = { score: [252, 34], radar: [92, 92], feed: [210, 60], alerts: [280, 34], health: [120, 22], ammo: [118, 30], joy: [128, 128], fire: [92, 92], gren: [52, 52], aim: [54, 54], reload: [54, 54], crouch: [54, 54], sprint: [54, 54], jump: [50, 50], swap: [46, 46], use: [58, 58], sound: [36, 36], mic: [36, 36], pause: [38, 38] };
const roundRect = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
const BASE_COL = o => o === 0 ? '#3D8BFF' : o === 1 ? '#FF4A3A' : o === 2 ? '#A9C0E0' : '#8E8E8E';
// área útil: a tela menos as margens de segurança (entalhe, barra de gestos)
function area(W, H, ins) { ins = ins || { t: 0, r: 0, b: 0, l: 0 }; return { x: ins.l, y: ins.t, w: W - ins.l - ins.r, h: H - ins.t - ins.b }; }
// posição final em px de um elemento, sempre dentro da área útil
function place(L, id, A) { const o = L[id], sz = SIZES[id] || [60, 60], w = sz[0] * o.s, h = sz[1] * o.s; let cx = A.x + o.x * A.w, cy = A.y + o.y * A.h; cx = Math.min(A.x + A.w - w / 2 - 2, Math.max(A.x + w / 2 + 2, cx)); cy = Math.min(A.y + A.h - h / 2 - 2, Math.max(A.y + h / 2 + 2, cy)); return { cx, cy, w, h, s: o.s, a: o.a }; }

// desenha o HUD da partida. st = estado visto pelo cliente; op = { top, ctl } opacidades de fundo
function draw(g, W, H, L, st, A, op) {
  g.clearRect(0, 0, W, H);
  const bgTop = op ? op.top : 0.65;
  const shadowText = (t, x, y, col) => { g.fillStyle = 'rgba(0,0,0,.6)'; g.fillText(t, x + 1, y + 1.2); g.fillStyle = col || '#fff'; g.fillText(t, x, y); };
  g.textBaseline = 'middle';
  for (const m of st.markers) { g.globalAlpha = m.a || 1; if (m.kind === 'ally') { g.fillStyle = m.col; g.beginPath(); g.moveTo(m.x - 5, m.y - 6); g.lineTo(m.x + 5, m.y - 6); g.lineTo(m.x, m.y); g.closePath(); g.fill(); if (m.label) { g.font = '600 10.5px Rubik, system-ui, sans-serif'; g.textAlign = 'center'; shadowText(m.label, m.x, m.y - 13); } }
    else if (m.kind === 'base') { g.fillStyle = `rgba(0,0,0,${0.4 * bgTop / 0.65})`; g.beginPath(); g.arc(m.x, m.y, 11, 0, 7); g.fill(); g.strokeStyle = m.col; g.lineWidth = 2.5; g.beginPath(); g.arc(m.x, m.y, 10, 0, 7); g.stroke(); g.font = '700 11px Rubik, sans-serif'; g.textAlign = 'center'; g.fillStyle = '#fff'; g.fillText(m.label, m.x, m.y + 1); if (m.dist) { g.font = '600 9.5px Rubik, system-ui, sans-serif'; shadowText(m.dist, m.x, m.y + 19); } }
    else if (m.kind === 'supply') { g.fillStyle = 'rgba(0,0,0,.4)'; roundRect(g, m.x - 10, m.y - 10, 20, 20, 5); g.fill(); g.strokeStyle = '#FFD24A'; g.lineWidth = 1.6; g.stroke(); g.fillStyle = '#FFD24A'; for (let k = -1; k <= 1; k++) g.fillRect(m.x + k * 5 - 1.2, m.y - 5, 2.4, 10); }
    else if (m.kind === 'talk') { g.fillStyle = 'rgba(10,10,12,.7)'; g.beginPath(); g.arc(m.x, m.y, 9, 0, 7); g.fill(); g.fillStyle = '#7BE07B'; g.fillRect(m.x - 2.5, m.y - 6, 5, 8); g.strokeStyle = '#7BE07B'; g.lineWidth = 1.5; g.beginPath(); g.arc(m.x, m.y - 1, 4.5, 0.2, Math.PI - 0.2); g.stroke(); g.fillRect(m.x - 0.75, m.y + 3, 1.5, 3); }
    else if (m.kind === 'gren') { g.strokeStyle = 'rgba(255,90,60,.95)'; g.lineWidth = 2; g.beginPath(); g.arc(m.x, m.y, 9, 0, 7); g.stroke(); g.fillStyle = '#FF6A4A'; g.font = '700 11px Rubik, sans-serif'; g.textAlign = 'center'; g.fillText('!', m.x, m.y + 0.5); }
    g.globalAlpha = 1; }
  // placar compacto: AZUL 0% — (A)(B)(C) — VERM. 0%
  { const p = place(L, 'score', A); g.save(); g.translate(p.cx, p.cy); g.scale(p.s, p.s); g.globalAlpha = p.a; const w = 252, h = 34, sk = 9;
    const slant = (x0, x1, edge) => { g.beginPath(); g.moveTo(x0 + sk, -h / 2); g.lineTo(x1, -h / 2); g.lineTo(x1 - sk, h / 2); g.lineTo(x0, h / 2); g.closePath(); g.fillStyle = `rgba(10,10,12,${bgTop})`; g.fill(); g.strokeStyle = edge; g.lineWidth = 1.5; g.stroke(); };
    slant(-w / 2, -40, 'rgba(61,139,255,.85)'); slant(40, w / 2, 'rgba(255,74,58,.85)');
    g.font = '700 14px Rubik, system-ui, sans-serif'; g.textAlign = 'center'; g.fillStyle = '#fff'; g.fillText('AZUL ' + Math.floor(st.score[0]) + '%', -w / 4 - 16, 0.5); g.fillText('VERM. ' + Math.floor(st.score[1]) + '%', w / 4 + 16, 0.5);
    st.bases.forEach((b, i) => { const bx = -27 + i * 27; g.fillStyle = `rgba(10,10,12,${Math.min(1, bgTop + 0.15)})`; g.beginPath(); g.arc(bx, 0, 12, 0, 7); g.fill();
      g.strokeStyle = BASE_COL(b.owner); g.lineWidth = 2.2; g.beginPath(); g.arc(bx, 0, 11, 0, 7); g.stroke();
      if (b.state === 'capturando' || b.state === 'contestada') { g.strokeStyle = b.state === 'contestada' ? '#FFD24A' : b.capTeam === 2 ? '#A9C0E0' : b.prog < 0 ? '#3D8BFF' : '#FF4A3A'; g.lineWidth = 2.6; g.beginPath(); g.arc(bx, 0, 14, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.abs(b.prog)); g.stroke(); }
      g.font = '700 13px Rubik, system-ui, sans-serif'; g.fillStyle = '#fff'; g.fillText(b.id, bx, 0.5); });
    g.restore(); }
  // avisos
  { const p = place(L, 'alerts', A); g.save(); g.translate(p.cx, p.cy); g.scale(p.s, p.s); g.globalAlpha = p.a; let yy = 0;
    for (const m of st.alerts) { g.font = (m.big ? '700 14.5px' : '600 13px') + ' Rubik, system-ui, sans-serif'; g.textAlign = 'center'; const w2 = g.measureText(m.text).width + 24; g.fillStyle = `rgba(10,10,12,${bgTop * 0.85})`; roundRect(g, -w2 / 2, yy - 13, w2, 26, 8); g.fill(); g.fillStyle = m.col || '#fff'; g.fillText(m.text, 0, yy + 1); yy += 31; }
    if (st.capture) { const c = st.capture; g.font = '600 12.5px Rubik, system-ui, sans-serif'; g.textAlign = 'center'; g.fillStyle = `rgba(10,10,12,${bgTop * 0.85})`; roundRect(g, -110, yy - 13, 220, 36, 8); g.fill(); g.fillStyle = c.col; g.fillText(c.text, 0, yy - 1); g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(-92, yy + 10, 184, 4); g.fillStyle = c.bar; g.fillRect(-92, yy + 10, 184 * c.p, 4); }
    g.restore(); }
  // abates
  { const p = place(L, 'feed', A); g.save(); g.translate(p.cx + 105 * p.s, p.cy - 22 * p.s); g.scale(p.s, p.s); g.globalAlpha = p.a; g.textAlign = 'right'; g.font = '600 12px Rubik, system-ui, sans-serif'; let yy = 0;
    for (const f of st.feed) { const txt = f.k + (f.head ? '  ⌖  ' : '  ›  ') + f.v, w2 = g.measureText(txt).width; g.fillStyle = `rgba(10,10,12,${bgTop * 0.75})`; roundRect(g, -w2 - 14, yy - 10, w2 + 18, 20, 6); g.fill();
      g.fillStyle = f.vc; g.fillText(f.v, -4, yy + 1); const vw = g.measureText(f.v).width; g.fillStyle = '#ddd'; g.fillText(f.head ? '⌖' : '›', -vw - 11, yy + 1); g.fillStyle = f.kc; g.fillText(f.k, -vw - 25, yy + 1); yy += 23; }
    g.restore(); }
  // vida
  { const p = place(L, 'health', A); g.save(); g.translate(p.cx, p.cy); g.scale(p.s, p.s); g.globalAlpha = p.a; g.fillStyle = `rgba(10,10,12,${(op ? op.ctl : 0.6) * 0.9})`; roundRect(g, -60, -11, 120, 22, 8); g.fill();
    g.fillStyle = st.hp > 35 ? '#5BD16B' : '#E84A3A'; roundRect(g, -30, -4, 84 * st.hp / 100, 8, 4); g.fill(); g.font = '700 12.5px Rubik, system-ui, sans-serif'; g.textAlign = 'left'; g.fillStyle = '#fff'; g.fillText(String(Math.ceil(st.hp)), -52, 1); g.restore(); }
  // munição: só os números (30 / 180)
  { const p = place(L, 'ammo', A); g.save(); g.translate(p.cx, p.cy); g.scale(p.s, p.s); g.globalAlpha = p.a; const Am = st.ammo, out = Am.mag + Am.res === 0, low = !out && Am.res <= Am.max * 0.25;
    g.textBaseline = 'middle'; g.textAlign = 'right'; g.font = '700 24px Rubik, system-ui, sans-serif'; const magTxt = st.reloading ? '...' : String(Am.mag);
    g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.55)'; g.strokeText(magTxt, 6, 0); g.fillStyle = out ? '#FF6A55' : Am.mag <= Math.ceil(Am.magMax * 0.25) ? '#FFB45A' : '#fff'; g.fillText(magTxt, 6, 0);
    g.textAlign = 'left'; g.font = '600 15px Rubik, system-ui, sans-serif'; g.strokeText('/ ' + Am.res, 12, 2); g.fillStyle = low || out ? '#FFB45A' : 'rgba(255,255,255,.85)'; g.fillText('/ ' + Am.res, 12, 2);
    g.font = '600 9.5px Rubik, system-ui, sans-serif'; g.textAlign = 'center'; g.strokeText(Am.name, 0, -19); g.fillStyle = 'rgba(255,255,255,.75)'; g.fillText(Am.name, 0, -19);
    if (!st.touch && st.gren != null) { g.textAlign = 'left'; g.font = '600 11px Rubik, system-ui, sans-serif'; g.strokeText('GRANADA ×' + st.gren, -50, 21); g.fillStyle = st.gren ? '#C8F0A0' : 'rgba(255,255,255,.4)'; g.fillText('GRANADA ×' + st.gren, -50, 21); }
    g.restore(); }
  // mira
  if (st.alive && !st.edit) { const gap = 5 + st.spread * H * 0.9, cx = W / 2, cy = H / 2; const cl = (col, w) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { g.moveTo(cx + dx * gap, cy + dy * gap); g.lineTo(cx + dx * (gap + 7), cy + dy * (gap + 7)); } g.stroke(); }; cl('rgba(0,0,0,.6)', 3.5); cl('#fff', 1.6); g.fillStyle = '#fff'; g.fillRect(cx - 1, cy - 1, 2, 2);
    if (st.hitT > 0) { g.strokeStyle = st.hitHead ? '#FFD24A' : '#fff'; g.lineWidth = 2.2; for (const [a2, b2] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { g.beginPath(); g.moveTo(cx + a2 * 6, cy + b2 * 6); g.lineTo(cx + a2 * 12, cy + b2 * 12); g.stroke(); } } }
  if (st.alive && st.hp < 100) { const a = (1 - st.hp / 100) * 0.5, gr = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7); gr.addColorStop(0, 'rgba(150,0,0,0)'); gr.addColorStop(1, `rgba(150,0,0,${a})`); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
  if (st.flash > 0) { g.fillStyle = `rgba(255,245,225,${Math.min(0.85, st.flash)})`; g.fillRect(0, 0, W, H); }
  for (const d of st.dmgDirs) { const r = Math.min(W, H) * 0.18; g.save(); g.translate(W / 2, H / 2); g.rotate(-d.rel); g.fillStyle = `rgba(230,40,30,${d.t * 0.85})`; g.beginPath(); g.moveTo(-18, -r); g.lineTo(18, -r); g.lineTo(0, -r - 16); g.closePath(); g.fill(); g.restore(); }
  g.textAlign = 'center';
  if (st.center) { g.font = '700 13.5px Rubik, system-ui, sans-serif'; const w2 = g.measureText(st.center.text).width + 28, cy = H * 0.64; g.fillStyle = `rgba(10,10,12,${bgTop})`; roundRect(g, W / 2 - w2 / 2, cy - 15, w2, 30, 8); g.fill(); g.fillStyle = st.center.col || '#FFD24A'; g.fillText(st.center.text, W / 2, cy + 1);
    if (st.center.p != null) { g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(W / 2 - w2 / 2 + 12, cy + 10, w2 - 24, 4); g.fillStyle = '#FFD24A'; g.fillRect(W / 2 - w2 / 2 + 12, cy + 10, (w2 - 24) * st.center.p, 4); } }
  if (!st.alive && st.deathText) { g.font = '400 22px Bungee, Rubik, sans-serif'; shadowText(st.deathText, W / 2, H * 0.36, '#FFD24A'); g.font = '600 14px Rubik, system-ui, sans-serif'; shadowText('Voltando à base em ' + Math.max(0, st.respawn).toFixed(1) + ' s', W / 2, H * 0.36 + 28); }
}
// minimapa (gira com o jogador), 25% menor e com fundo semitransparente
function radar(g, W, H, L, img, me, dots, cell, A, op) {
  const p = place(L, 'radar', A), x = p.cx, y = p.cy, r = 46 * p.s, k = r / 40 * cell, ca = Math.cos(me.yaw), sa = Math.sin(me.yaw), bg = op ? op.top : 0.65;
  g.save(); g.globalAlpha = p.a; g.beginPath(); g.arc(x, y, r, 0, 7); g.fillStyle = `rgba(8,8,10,${bg * 0.8})`; g.fill(); g.clip();
  g.globalAlpha = p.a * 0.85; g.translate(x, y); g.transform(-ca * k, -sa * k, sa * k, -ca * k, 0, 0); g.translate(-me.x / cell, -me.z / cell); g.imageSmoothingEnabled = false; g.drawImage(img, 0, 0); g.globalAlpha = p.a;
  for (const d of dots) { if (d.kind) continue; g.fillStyle = d.col; g.beginPath(); g.arc(d.x / cell, d.z / cell, 3 / k, 0, 7); g.fill(); }
  g.restore();
  g.save(); g.globalAlpha = p.a; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const d of dots) { if (d.kind !== 'base' && d.kind !== 'supply') continue; const dx = (d.x - me.x) / cell * k, dz = (d.z - me.z) / cell * k; let sx = -ca * dx + sa * dz, sy = -sa * dx - ca * dz; const l = Math.hypot(sx, sy); if (l > r - 7) { sx *= (r - 7) / l; sy *= (r - 7) / l; }
    if (d.kind === 'base') { g.fillStyle = d.col; g.beginPath(); g.arc(x + sx, y + sy, 6.5, 0, 7); g.fill(); g.font = '700 8.5px Rubik, sans-serif'; g.fillStyle = '#fff'; g.fillText(d.label, x + sx, y + sy + 0.5); }
    else { g.fillStyle = '#FFD24A'; g.fillRect(x + sx - 4, y + sy - 4, 8, 8); g.fillStyle = '#111'; g.fillRect(x + sx - 1, y + sy - 3, 2, 6); } }
  g.fillStyle = '#FFD24A'; g.beginPath(); g.moveTo(x, y - 6); g.lineTo(x + 4.5, y + 4.5); g.lineTo(x, y + 1.8); g.lineTo(x - 4.5, y + 4.5); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke();
  const nx = x + sa * (r - 1), ny = y - ca * (r - 1); g.fillStyle = 'rgba(10,10,12,.85)'; g.beginPath(); g.arc(nx, ny, 7, 0, 7); g.fill(); g.font = '700 9px Rubik, sans-serif'; g.fillStyle = '#fff'; g.fillText('N', nx, ny + 0.5);
  if (me.sector) { g.font = '600 10px Rubik, system-ui, sans-serif'; g.fillStyle = 'rgba(0,0,0,.6)'; g.fillText(me.sector, x + 1, y + r + 12); g.fillStyle = '#F4E6C8'; g.fillText(me.sector, x, y + r + 11); }
  g.restore();
}
// faixa da operação policial (abaixo do placar)
function policeBar(g, W, H, L, A, op, P2) { const p = place(L, 'score', A), y = p.cy + 30 * p.s, txt = (P2.phase === 'chegando' ? 'VIATURAS A CAMINHO' : 'OPERAÇÃO POLICIAL') + ' — favela do ' + (P2.team === 0 ? 'Azul' : 'Vermelho') + (P2.phase === 'incursao' ? '  ' + Math.floor(P2.left / 60) + ':' + String(P2.left % 60).padStart(2, '0') : '');
  g.save(); g.font = '700 11.5px Rubik, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; const w = g.measureText(txt).width + 34, on = Math.floor(performance.now() / 350) % 2;
  g.fillStyle = `rgba(12,16,26,${(op ? op.top : 0.65) + 0.15})`; roundRect(g, p.cx - w / 2, y - 11, w, 22, 6); g.fill(); g.fillStyle = on ? '#FF3B30' : '#3D7BFF'; g.beginPath(); g.arc(p.cx - w / 2 + 11, y, 4, 0, 7); g.fill(); g.fillStyle = on ? '#3D7BFF' : '#FF3B30'; g.beginPath(); g.arc(p.cx + w / 2 - 11, y, 4, 0, 7); g.fill();
  g.fillStyle = P2.mine ? '#FFB45A' : '#C9D6EA'; g.fillText(txt, p.cx, y + 0.5); g.restore(); }
// caveirinha de abate (estilo CrossFire). Tiro na cabeça: caveira com o furo da bala e alvo vermelho em volta
function killIcon(g, W, H, k, age) {
  const pop = age < 0.12 ? 0.6 + age / 0.12 * 0.65 : age < 0.25 ? 1.25 - (age - 0.12) / 0.13 * 0.25 : 1, fade = age > 1.2 ? 1 - (age - 1.2) / 0.4 : 1, s = Math.min(W, H) / 420 * pop, x = W / 2, y = H * 0.66;
  g.save(); g.globalAlpha = Math.max(0, fade); g.translate(x, y); g.scale(s, s);
  if (k.head) { g.strokeStyle = '#E8342A'; g.lineWidth = 3; g.beginPath(); g.arc(0, -2, 34, 0, 7); g.stroke(); for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) { g.beginPath(); g.moveTo(Math.cos(a) * 28, -2 + Math.sin(a) * 28); g.lineTo(Math.cos(a) * 42, -2 + Math.sin(a) * 42); g.stroke(); } }
  const skull = col => { g.fillStyle = col; g.beginPath(); g.moveTo(-18, 4); g.bezierCurveTo(-22, -26, 22, -26, 18, 4); g.lineTo(13, 8); g.lineTo(12, 16); g.lineTo(-12, 16); g.lineTo(-13, 8); g.closePath(); g.fill();
    g.fillRect(-10, 16, 20, 7); };
  g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 6; skull(k.head ? '#FFF3E0' : '#F2F2F2'); g.shadowBlur = 0;
  g.fillStyle = '#1A1A1A'; g.beginPath(); g.ellipse(-7.5, -3, 5.5, 6, 0.1, 0, 7); g.fill(); g.beginPath(); g.ellipse(7.5, -3, 5.5, 6, -0.1, 0, 7); g.fill();
  g.beginPath(); g.moveTo(0, 3); g.lineTo(-3, 9); g.lineTo(3, 9); g.closePath(); g.fill(); for (let i = -2; i <= 2; i++) g.fillRect(i * 4 - 1, 16, 2, 7);
  if (k.head) { g.fillStyle = '#1A1A1A'; g.beginPath(); g.arc(4, -15, 3.6, 0, 7); g.fill(); g.strokeStyle = '#1A1A1A'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(6, -18); g.lineTo(11, -21); g.moveTo(1.5, -17); g.lineTo(-2, -22); g.moveTo(7, -13); g.lineTo(12, -11); g.stroke(); }
  g.font = '800 13px Rubik, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; const lbl = k.head ? 'HEADSHOT' : k.n > 1 ? k.n + ' ABATES' : 'ABATE'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.7)'; g.strokeText(lbl, 0, 44); g.fillStyle = k.head ? '#FF5A4A' : '#FFD24A'; g.fillText(lbl, 0, 44);
  if (k.n > 1 && k.head) { g.font = '800 11px Rubik, sans-serif'; g.strokeText('×' + k.n, 30, -26); g.fillStyle = '#FFD24A'; g.fillText('×' + k.n, 30, -26); }
  g.restore(); }
window.EscHUD = { policeBar, killIcon, defaults, load, save, reset, draw, radar, clampV, BASE_COL, SIZES, place, area, keyFor };
})();
