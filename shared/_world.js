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
