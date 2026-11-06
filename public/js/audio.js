/* Complexo do Escadão 3D — áudio espacial (Web Audio API).
   Um som fixo por arma, carregado uma única vez. Distância, direção e obstáculos alteram volume e timbre. */
(function () {
'use strict';
function makeAudio() {
  let ctx = null, master = null, comp = null, volume = 0.8;
  const buf = { rifle: null, pistol: null }, src = { rifle: null, pistol: null };
  const voices = []; const lastByShooter = new Map(); let lastWhizz = 0, whizzActive = 0, noise = null;
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  function ensure() {
    if (ctx) { if (ctx.state === 'suspended' && ctx.resume) ctx.resume(); return ctx; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    ctx = new AC(); comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6; comp.connect(ctx.destination);
    master = ctx.createGain(); master.gain.value = volume; master.connect(comp);
    for (const k of ['rifle', 'pistol']) if (src[k] && !buf[k]) decode(k);
    return ctx;
  }
  function decode(k) {
    const s = src[k]; if (!s || !ctx) return;
    const go = ab => { let done = false; const ok = b => { if (b && !done) { done = true; buf[k] = b; } }; try { const p = ctx.decodeAudioData(ab, ok, () => {}); if (p && p.then) p.then(ok).catch(() => {}); } catch (e) {} };
    if (s.startsWith('data:')) { const bin = atob(s.split(',')[1]), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); go(u8.buffer); }
    else fetch(s).then(r => r.arrayBuffer()).then(go).catch(() => {});
  }
  function load(urls) { Object.assign(src, urls); if (ctx) for (const k in urls) decode(k); }
  const getNoise = () => { if (noise) return noise; const b = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return noise = b; };
  function setListener(x, y, z, yaw, pitch) {
    if (!ctx) return; const L = ctx.listener, fx = Math.sin(yaw) * Math.cos(pitch), fy = Math.sin(pitch), fz = Math.cos(yaw) * Math.cos(pitch);
    if (L.positionX) { const t = ctx.currentTime; L.positionX.setValueAtTime(x, t); L.positionY.setValueAtTime(y, t); L.positionZ.setValueAtTime(z, t); L.forwardX.setValueAtTime(fx, t); L.forwardY.setValueAtTime(fy, t); L.forwardZ.setValueAtTime(fz, t); L.upX.setValueAtTime(0, t); L.upY.setValueAtTime(1, t); L.upZ.setValueAtTime(0, t); }
    else { L.setPosition(x, y, z); L.setOrientation(fx, fy, fz, 0, 1, 0); }
  }
  function panner(x, y, z) {
    const p = ctx.createPanner(); p.panningModel = mobile ? 'equalpower' : 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = 5; p.rolloffFactor = 0.9; p.maxDistance = 400;
    if (p.positionX) { p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z; } else p.setPosition(x, y, z); return p;
  }
  function prune(now) { for (let i = voices.length - 1; i >= 0; i--) if (voices[i].end < now) voices.splice(i, 1); }
  // um disparo = um único evento de áudio
  function shot(weapon, shooterId, x, y, z, dist, own, occluded) {
    if (!ensure() || !buf[weapon]) return; const now = ctx.currentTime; prune(now);
    if (!own && dist > 320) return;
    // corta a cauda do tiro anterior do mesmo atirador (rajadas não acumulam)
    const prev = lastByShooter.get(shooterId); if (prev && prev.end > now) { try { prev.g.gain.cancelScheduledValues(now); prev.g.gain.setValueAtTime(prev.g.gain.value, now); prev.g.gain.linearRampToValueAtTime(0, now + 0.06); prev.s.stop(now + 0.07); } catch (e) {} }
    if (voices.length >= 14) { let far = 0; for (let i = 1; i < voices.length; i++) if (voices[i].d > voices[far].d) far = i; if (!own && voices[far].d < dist) return; try { voices[far].s.stop(); } catch (e) {} voices.splice(far, 1); }
    const s = ctx.createBufferSource(); s.buffer = buf[weapon];
    const g = ctx.createGain(), f = ctx.createBiquadFilter(); f.type = 'lowpass';
    let gain = own ? (weapon === 'rifle' ? 0.8 : 0.7) : (weapon === 'rifle' ? 1 : 0.85), cut = 20000;
    if (!own) { cut = dist < 12 ? 18000 : Math.max(700, 18000 * Math.pow(12 / dist, 0.85)); if (occluded) { cut *= 0.35; gain *= 0.55; } if (dist > 60) gain *= 1.4; }
    f.frequency.value = cut; g.gain.value = gain; s.connect(f); f.connect(g);
    if (own) g.connect(master); else { const p = panner(x, y, z); g.connect(p); p.connect(master); }
    s.start(now); const v = { s, g, end: now + buf[weapon].duration, d: own ? 0 : dist }; voices.push(v); lastByShooter.set(shooterId, v);
  }
  // zumbido de projétil passando perto
  function whizz(x, y, z) {
    if (!ensure()) return; const now = ctx.currentTime; if (now - lastWhizz < 0.09 || whizzActive >= 3) return; lastWhizz = now; whizzActive++;
    const s = ctx.createBufferSource(); s.buffer = getNoise(); const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 3.5; f.frequency.setValueAtTime(3200, now); f.frequency.exponentialRampToValueAtTime(900, now + 0.16);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(0.55, now + 0.03); g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    const p = panner(x, y, z); p.refDistance = 1; s.connect(f); f.connect(g); g.connect(p); p.connect(master); s.start(now, Math.random() * 0.3, 0.2); s.onended = () => { whizzActive--; };
  }
  function blip(fr, d, type, vol) { if (!ensure()) return; const now = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(); o.type = type || 'square'; o.frequency.setValueAtTime(fr, now); g.gain.setValueAtTime(vol || 0.1, now); g.gain.exponentialRampToValueAtTime(0.001, now + d); o.connect(g); g.connect(master); o.start(now); o.stop(now + d + 0.02); }
  function thud() { if (!ensure()) return; const now = ctx.currentTime, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = getNoise(); f.type = 'lowpass'; f.frequency.value = 420; g.gain.setValueAtTime(0.45, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.2); s.connect(f); f.connect(g); g.connect(master); s.start(now, 0, 0.22); }
  function step(x, y, z) { if (!ensure()) return; const now = ctx.currentTime, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = getNoise(); f.type = 'bandpass'; f.frequency.value = 650 + Math.random() * 300; g.gain.setValueAtTime(0.35, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.07); const p = panner(x, y, z); p.refDistance = 2; p.rolloffFactor = 1.6; s.connect(f); f.connect(g); g.connect(p); p.connect(master); s.start(now, Math.random() * 0.3, 0.08); }
  function setVolume(v) { volume = v; if (master) master.gain.value = v; }
  return { ensure, load, setListener, shot, whizz, blip, thud, step, setVolume, get ready() { return !!(buf.rifle && buf.pistol); }, get voices() { return voices.length; }, close() { if (ctx && ctx.close) ctx.close(); ctx = null; } };
}
window.EscAudio = makeAudio;
})();
