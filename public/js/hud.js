/* Complexo do Escadão 3D — HUD (desenhado em canvas) e editor de HUD (arrastar, tamanho, transparência). */
(function () {
'use strict';
const KEY = 'escadao3d-hud-v1';
// posição = centro do elemento em fração da tela; s = escala; a = opacidade
function defaults(touch) {
  const d = {
    score: { x: 0.5, y: 0.055, s: 1, a: 1, label: 'Pontuação e bases' },
    radar: { x: 0.085, y: 0.15, s: 1, a: 0.95, label: 'Minimapa' },
    feed: { x: 0.87, y: 0.1, s: 1, a: 1, label: 'Abates' },
    alerts: { x: 0.5, y: 0.25, s: 1, a: 1, label: 'Avisos de captura' },
    health: { x: 0.11, y: 0.93, s: 1, a: 1, label: 'Vida' },
    ammo: { x: 0.88, y: 0.92, s: 1, a: 1, label: 'Munição' },
  };
  if (touch) Object.assign(d, {
    radar: { x: 0.13, y: 0.16, s: 0.85, a: 0.95, label: 'Minimapa' }, feed: { x: 0.8, y: 0.17, s: 0.85, a: 1, label: 'Abates' },
    health: { x: 0.5, y: 0.955, s: 0.9, a: 1, label: 'Vida' }, ammo: { x: 0.5, y: 0.895, s: 0.9, a: 1, label: 'Munição' },
    joy: { x: 0.16, y: 0.76, s: 1, a: 0.85, label: 'Joystick' }, fire: { x: 0.86, y: 0.76, s: 1, a: 0.85, label: 'Atirar' },
    aim: { x: 0.68, y: 0.83, s: 1, a: 0.85, label: 'Mira' }, jump: { x: 0.93, y: 0.6, s: 1, a: 0.85, label: 'Pular' },
    crouch: { x: 0.78, y: 0.6, s: 1, a: 0.85, label: 'Agachar' }, reload: { x: 0.7, y: 0.69, s: 1, a: 0.85, label: 'Recarregar' },
    swap: { x: 0.93, y: 0.45, s: 1, a: 0.85, label: 'Trocar arma' }, use: { x: 0.62, y: 0.58, s: 1, a: 0.85, label: 'Interagir' },
  });
  return d;
}
function load(touch) { const d = defaults(touch); try { const s = JSON.parse(localStorage.getItem(KEY + (touch ? '-m' : '-d')) || '{}'); for (const k in s) if (d[k]) Object.assign(d[k], { x: clampV(s[k].x), y: clampV(s[k].y), s: Math.min(1.8, Math.max(0.5, +s[k].s || 1)), a: Math.min(1, Math.max(0.2, +s[k].a || 1)) }); } catch (e) {} return d; }
function save(touch, L) { const o = {}; for (const k in L) o[k] = { x: L[k].x, y: L[k].y, s: L[k].s, a: L[k].a }; try { localStorage.setItem(KEY + (touch ? '-m' : '-d'), JSON.stringify(o)); } catch (e) {} }
function reset(touch) { try { localStorage.removeItem(KEY + (touch ? '-m' : '-d')); } catch (e) {} return defaults(touch); }
const clampV = v => Math.min(0.97, Math.max(0.03, +v || 0.5)); // nunca deixa um elemento sair da tela
const roundRect = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
const BASE_COL = o => o === 0 ? '#3D8BFF' : o === 1 ? '#FF5040' : '#9A9A9A';
const TXT = '600 13px Rubik, system-ui, sans-serif';

// desenha o HUD da partida. st = estado visto pelo cliente
function draw(g, W, H, L, st) {
  g.clearRect(0, 0, W, H);
  const P = id => [L[id].x * W, L[id].y * H, L[id].s, L[id].a];
  const shadowText = (t, x, y, col) => { g.fillStyle = 'rgba(0,0,0,.6)'; g.fillText(t, x + 1, y + 1.5); g.fillStyle = col || '#fff'; g.fillText(t, x, y); };
  g.textBaseline = 'middle';
  // marcadores de parceiros e das bases no mundo
  for (const m of st.markers) { g.globalAlpha = m.a || 1; if (m.kind === 'ally') { g.fillStyle = m.col; g.beginPath(); g.moveTo(m.x - 6, m.y - 7); g.lineTo(m.x + 6, m.y - 7); g.lineTo(m.x, m.y); g.closePath(); g.fill(); if (m.label) { g.font = '600 11px Rubik, system-ui, sans-serif'; g.textAlign = 'center'; shadowText(m.label, m.x, m.y - 15); } }
    else if (m.kind === 'base') { g.fillStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.arc(m.x, m.y, 13, 0, 7); g.fill(); g.strokeStyle = m.col; g.lineWidth = 3; g.beginPath(); g.arc(m.x, m.y, 12, 0, 7); g.stroke(); g.font = '400 13px Bungee, Rubik, sans-serif'; g.textAlign = 'center'; g.fillStyle = '#fff'; g.fillText(m.label, m.x, m.y + 1); if (m.dist) { g.font = '600 10px Rubik, system-ui, sans-serif'; shadowText(m.dist, m.x, m.y + 22); } }
    else if (m.kind === 'supply') { g.fillStyle = 'rgba(0,0,0,.45)'; roundRect(g, m.x - 12, m.y - 12, 24, 24, 6); g.fill(); g.strokeStyle = '#FFD24A'; g.lineWidth = 2; g.stroke(); g.fillStyle = '#FFD24A'; for (let k = -1; k <= 1; k++) g.fillRect(m.x + k * 6 - 1.5, m.y - 6, 3, 12); }
    g.globalAlpha = 1; }
  // pontuação: AZUL 0% | A B C | VERMELHO 0%
  { const [x, y, s, a] = P('score'); g.save(); g.translate(x, y); g.scale(s, s); g.globalAlpha = a;
    g.fillStyle = 'rgba(14,11,9,.72)'; roundRect(g, -150, -20, 300, 40, 11); g.fill();
    g.font = '400 15px Bungee, Rubik, sans-serif'; g.textAlign = 'left'; g.fillStyle = '#6FB0FF'; g.fillText('AZUL ' + Math.floor(st.score[0]) + '%', -140, 1);
    g.textAlign = 'right'; g.fillStyle = '#FF7A66'; g.fillText(Math.floor(st.score[1]) + '% VERM.', 140, 1);
    st.bases.forEach((b, i) => { const bx = -26 + i * 26; g.fillStyle = BASE_COL(b.owner); g.beginPath(); g.arc(bx, 0, 11, 0, 7); g.fill();
      if (b.state === 'capturando' || b.state === 'contestada') { g.strokeStyle = b.state === 'contestada' ? '#FFD24A' : b.prog < 0 ? '#3D8BFF' : '#FF5040'; g.lineWidth = 3; g.beginPath(); g.arc(bx, 0, 13.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.abs(b.prog)); g.stroke(); }
      g.font = '400 12px Bungee, Rubik, sans-serif'; g.textAlign = 'center'; g.fillStyle = '#fff'; g.fillText(b.id, bx, 1); });
    g.fillStyle = 'rgba(255,255,255,.16)'; g.fillRect(-140, 13, 280, 3); g.fillStyle = '#3D8BFF'; g.fillRect(-140, 13, 1.4 * Math.min(100, st.score[0]), 3); g.fillStyle = '#FF5040'; g.fillRect(140 - 1.4 * Math.min(100, st.score[1]), 13, 1.4 * Math.min(100, st.score[1]), 3);
    g.restore(); }
  // avisos (captura, penalidade, munição)
  { const [x, y, s, a] = P('alerts'); g.save(); g.translate(x, y); g.scale(s, s); g.globalAlpha = a; let yy = 0;
    for (const m of st.alerts) { g.font = (m.big ? '400 17px' : '600 14px') + ' ' + (m.big ? 'Bungee, Rubik, sans-serif' : 'Rubik, system-ui, sans-serif'); g.textAlign = 'center'; const w2 = g.measureText(m.text).width + 26; g.fillStyle = 'rgba(14,11,9,.6)'; roundRect(g, -w2 / 2, yy - 15, w2, 30, 9); g.fill(); g.fillStyle = m.col || '#fff'; g.fillText(m.text, 0, yy + 1); yy += 36; }
    if (st.capture) { const c = st.capture; g.font = '600 13px Rubik, system-ui, sans-serif'; g.textAlign = 'center'; g.fillStyle = 'rgba(14,11,9,.6)'; roundRect(g, -120, yy - 14, 240, 40, 9); g.fill(); g.fillStyle = c.col; g.fillText(c.text, 0, yy - 1); g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(-100, yy + 12, 200, 5); g.fillStyle = c.bar; g.fillRect(-100, yy + 12, 200 * c.p, 5); }
    g.restore(); }
  // abates
  { const [x, y, s, a] = P('feed'); g.save(); g.translate(x, y); g.scale(s, s); g.globalAlpha = a; g.textAlign = 'right'; g.font = '600 12.5px Rubik, system-ui, sans-serif'; let yy = 0;
    for (const f of st.feed) { const txt = f.k + (f.head ? '  ⌖  ' : '  ›  ') + f.v, w2 = g.measureText(txt).width; g.fillStyle = 'rgba(14,11,9,.5)'; roundRect(g, 70 - w2 - 12, yy - 11, w2 + 18, 22, 7); g.fill();
      g.fillStyle = f.vc; g.fillText(f.v, 73, yy + 1); const vw = g.measureText(f.v).width; g.fillStyle = '#ddd'; g.fillText(f.head ? '⌖' : '›', 73 - vw - 9, yy + 1); g.fillStyle = f.kc; g.fillText(f.k, 73 - vw - 24, yy + 1); yy += 26; }
    g.restore(); }
  // vida
  { const [x, y, s, a] = P('health'); g.save(); g.translate(x, y); g.scale(s, s); g.globalAlpha = a; g.fillStyle = 'rgba(14,11,9,.6)'; roundRect(g, -72, -15, 144, 30, 9); g.fill();
    g.fillStyle = st.hp > 35 ? '#5BD16B' : '#E84A3A'; roundRect(g, -36, -5, 100 * st.hp / 100, 10, 5); g.fill(); g.font = '700 14px Rubik, system-ui, sans-serif'; g.textAlign = 'left'; g.fillStyle = '#fff'; g.fillText(String(Math.ceil(st.hp)), -62, 1); g.restore(); }
  // munição: FUZIL — 30 / 180
  { const [x, y, s, a] = P('ammo'); g.save(); g.translate(x, y); g.scale(s, s); g.globalAlpha = a; g.fillStyle = 'rgba(14,11,9,.6)'; roundRect(g, -100, -17, 200, 34, 9); g.fill();
    const A = st.ammo, low = A.mag + A.res > 0 && A.res <= (A.max * 0.25), out = A.mag + A.res === 0;
    g.textAlign = 'left'; g.font = '700 11px Rubik, system-ui, sans-serif'; g.fillStyle = '#E8DCC6'; g.fillText(A.name, -88, 1);
    g.textAlign = 'right'; g.font = '400 19px Bungee, Rubik, sans-serif'; g.fillStyle = out ? '#FF6A55' : A.mag <= Math.ceil(A.magMax * 0.25) ? '#FFB45A' : '#fff'; g.fillText(st.reloading ? '...' : String(A.mag), 22, 1);
    g.font = '600 14px Rubik, system-ui, sans-serif'; g.fillStyle = low || out ? '#FFB45A' : '#E8DCC6'; g.textAlign = 'left'; g.fillText('/ ' + A.res, 30, 2);
    g.restore(); }
  // mira
  if (st.alive && !st.edit) { const gap = 5 + st.spread * H * 0.9, cx = W / 2, cy = H / 2; const cl = (col, w) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { g.moveTo(cx + dx * gap, cy + dy * gap); g.lineTo(cx + dx * (gap + 7), cy + dy * (gap + 7)); } g.stroke(); }; cl('rgba(0,0,0,.6)', 3.5); cl('#fff', 1.6); g.fillStyle = '#fff'; g.fillRect(cx - 1, cy - 1, 2, 2);
    if (st.hitT > 0) { g.strokeStyle = st.hitHead ? '#FFD24A' : '#fff'; g.lineWidth = 2.2; for (const [a2, b2] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { g.beginPath(); g.moveTo(cx + a2 * 6, cy + b2 * 6); g.lineTo(cx + a2 * 12, cy + b2 * 12); g.stroke(); } } }
  // dano recebido e direção
  if (st.alive && st.hp < 100) { const a = (1 - st.hp / 100) * 0.5, gr = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7); gr.addColorStop(0, 'rgba(150,0,0,0)'); gr.addColorStop(1, `rgba(150,0,0,${a})`); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
  for (const d of st.dmgDirs) { const r = Math.min(W, H) * 0.18; g.save(); g.translate(W / 2, H / 2); g.rotate(-d.rel); g.fillStyle = `rgba(230,40,30,${d.t * 0.85})`; g.beginPath(); g.moveTo(-18, -r); g.lineTo(18, -r); g.lineTo(0, -r - 16); g.closePath(); g.fill(); g.restore(); }
  // centro: reabastecimento, recarga, morte
  g.textAlign = 'center';
  if (st.center) { g.font = '700 14px Rubik, system-ui, sans-serif'; const w2 = g.measureText(st.center.text).width + 30; g.fillStyle = 'rgba(14,11,9,.65)'; roundRect(g, W / 2 - w2 / 2, H * 0.62 - 17, w2, 34, 9); g.fill(); g.fillStyle = st.center.col || '#FFD24A'; g.fillText(st.center.text, W / 2, H * 0.62 + 1);
    if (st.center.p != null) { g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(W / 2 - w2 / 2 + 12, H * 0.62 + 12, w2 - 24, 4); g.fillStyle = '#FFD24A'; g.fillRect(W / 2 - w2 / 2 + 12, H * 0.62 + 12, (w2 - 24) * st.center.p, 4); } }
  if (!st.alive && st.deathText) { g.font = '400 24px Bungee, Rubik, sans-serif'; shadowText(st.deathText, W / 2, H * 0.36, '#FFD24A'); g.font = '600 15px Rubik, system-ui, sans-serif'; shadowText('Voltando à base em ' + Math.max(0, st.respawn).toFixed(1) + ' s', W / 2, H * 0.36 + 30); }
}
// minimapa (rotaciona com o jogador)
function radar(g, W, H, L, img, me, dots, cell) {
  const [x, y, s, a] = [L.radar.x * W, L.radar.y * H, L.radar.s, L.radar.a], r = 62 * s, k = r / 45 * cell, ca = Math.cos(me.yaw), sa = Math.sin(me.yaw);
  g.save(); g.globalAlpha = a; g.beginPath(); g.arc(x, y, r, 0, 7); g.fillStyle = 'rgba(14,11,9,.65)'; g.fill(); g.clip();
  g.translate(x, y); g.transform(-ca * k, -sa * k, sa * k, -ca * k, 0, 0); g.translate(-me.x / cell, -me.z / cell); g.imageSmoothingEnabled = false; g.drawImage(img, 0, 0);
  for (const d of dots) { g.fillStyle = d.col; if (d.kind === 'base') { g.beginPath(); g.arc(d.x / cell, d.z / cell, 9 / k, 0, 7); g.fill(); g.fillStyle = '#fff'; g.font = `400 ${Math.round(11 / k * 10) / 10}px Bungee, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.save(); g.translate(d.x / cell, d.z / cell); g.transform(-ca / k, sa / k, -sa / k, -ca / k, 0, 0); g.scale(k, k); g.scale(1 / k, 1 / k); g.restore(); }
    else if (d.kind === 'supply') { g.fillRect(d.x / cell - 6 / k, d.z / cell - 6 / k, 12 / k, 12 / k); g.fillStyle = '#111'; g.fillRect(d.x / cell - 1.5 / k, d.z / cell - 4 / k, 3 / k, 8 / k); }
    else { g.beginPath(); g.arc(d.x / cell, d.z / cell, 3.4 / k, 0, 7); g.fill(); } }
  g.restore();
  // letras das bases sem girar o texto
  g.save(); g.globalAlpha = a; g.font = '400 10px Bungee, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const d of dots) { if (d.kind !== 'base' && d.kind !== 'supply') continue; const dx = (d.x - me.x) / cell * k, dz = (d.z - me.z) / cell * k; let sx = -ca * dx + sa * dz, sy = -sa * dx - ca * dz; const l = Math.hypot(sx, sy); if (l > r - 9) { sx *= (r - 9) / l; sy *= (r - 9) / l; if (d.kind === 'base') { g.fillStyle = d.col; g.beginPath(); g.arc(x + sx, y + sy, 8, 0, 7); g.fill(); } }
    g.fillStyle = d.kind === 'supply' ? '#FFD24A' : '#fff'; if (d.kind === 'base') g.fillText(d.label, x + sx, y + sy + 0.5); }
  g.restore();
  g.save(); g.globalAlpha = a; g.translate(x, y); g.fillStyle = '#FFD24A'; g.beginPath(); g.moveTo(0, -7); g.lineTo(5, 5); g.lineTo(0, 2); g.lineTo(-5, 5); g.closePath(); g.fill(); g.restore();
  g.globalAlpha = a; g.strokeStyle = 'rgba(233,162,59,.85)'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke(); g.font = '700 10px Rubik, system-ui, sans-serif'; g.textAlign = 'center'; g.fillStyle = '#FFD24A'; g.fillText('N', x + sa * (r - 8), y - ca * (r - 8)); g.globalAlpha = 1;
}
window.EscHUD = { defaults, load, save, reset, draw, radar, clampV, BASE_COL };
})();
