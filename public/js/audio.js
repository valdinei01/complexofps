/* Complexo do Escadão 3D — áudio espacial (Web Audio API).
   Um som fixo por arma, carregado uma única vez. Distância, direção e obstáculos alteram volume e timbre. */
(function () {
'use strict';
function makeAudio() {
  let ctx = null, master = null, comp = null, volume = 0.8, muted = false;
  const buf = { rifle: null, pistol: null }, src = { rifle: null, pistol: null }, amb = [], ambSrc = []; let ambActive = [];
  const voices = []; const lastByShooter = new Map(); let lastWhizz = 0, whizzActive = 0, noise = null;
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  // iPhone: com a chave lateral no silencioso, o som do jogo (Web Audio) fica mudo. Tocar um <audio> silencioso em loop
  // coloca a sessão de áudio no modo "reprodução" e o som do jogo passa a sair normalmente.
  let silentEl = null;
  function unlockIOS() { if (silentEl) { if (silentEl.paused) silentEl.play().catch(() => {}); return; } try { silentEl = document.createElement('audio'); silentEl.setAttribute('playsinline', ''); silentEl.setAttribute('x-webkit-airplay', 'deny'); silentEl.loop = true; silentEl.preload = 'auto'; silentEl.src = 'data:audio/wav;base64,UklGRkQDAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YSADAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA=='; silentEl.play().catch(() => {}); } catch (e) {} }
  function ensure() {
    unlockIOS();
    if (ctx) { if (ctx.state !== 'running' && ctx.resume) ctx.resume().catch(() => {}); return ctx; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    ctx = new AC(); comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6; comp.connect(ctx.destination);
    master = ctx.createGain(); master.gain.value = muted ? 0 : volume; master.connect(comp);
    for (const k of ['rifle', 'pistol']) if (src[k] && !buf[k]) decode(k);
    loadAmb(); if (typeof decodeBaile === 'function') decodeBaile();
    return ctx;
  }
  function decode(k) {
    const s = src[k]; if (!s || !ctx) return;
    const go = ab => { let done = false; const ok = b => { if (b && !done) { done = true; buf[k] = b; } }; try { const p = ctx.decodeAudioData(ab, ok, () => {}); if (p && p.then) p.then(ok).catch(() => {}); } catch (e) {} };
    if (s.startsWith('data:')) { const bin = atob(s.split(',')[1]), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); go(u8.buffer); }
    else fetch(s).then(r => r.arrayBuffer()).then(go).catch(() => {});
  }
  // gravações longas de tiroteio (os áudios enviados) para o som ambiente de confronto perto do jogador
  function loadAmb() { if (!ctx || amb.length || !ambSrc.length) return; ambSrc.forEach((u, i) => { const go = ab => { let ok = false; const fin = b => { if (b && !ok) { ok = true; amb[i] = b; } }; try { const p = ctx.decodeAudioData(ab, fin, () => {}); if (p && p.then) p.then(fin).catch(() => {}); } catch (e) {} };
    if (u.startsWith('data:')) { const bin = atob(u.split(',')[1]), u8 = new Uint8Array(bin.length); for (let k = 0; k < bin.length; k++) u8[k] = bin.charCodeAt(k); go(u8.buffer); } else fetch(u).then(r => r.arrayBuffer()).then(go).catch(() => {}); }); }
  function loadAmbient(urls) { ambSrc.push(...urls); if (ctx) loadAmb(); }
  // toca uma gravação inteira (até 2 ao mesmo tempo) na direção do tiroteio; intensidade 0..1
  function ambient(x, y, z, dist, intensity) {
    if (!ensure()) return false; const now = ctx.currentTime; ambActive = ambActive.filter(v => v.end > now + 0.4); const list = amb.filter(Boolean); if (!list.length || ambActive.length >= 2) return false;
    if (ambActive.length && ambActive[0].start > now - 1.8) return false; // espaça as camadas
    const b = list[Math.floor(Math.random() * list.length)], s2 = ctx.createBufferSource(); s2.buffer = b; s2.playbackRate.value = 0.94 + Math.random() * 0.1;
    const g = ctx.createGain(), f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = Math.max(900, 14000 * Math.pow(15 / Math.max(15, dist), 0.9));
    const vol = Math.min(0.55, 0.28 + 0.3 * intensity) * Math.pow(20 / Math.max(20, dist), 0.7); g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(Math.max(0.002, vol), now + 0.25);
    const p = panner(x, y, z); p.refDistance = 14; p.rolloffFactor = 0.6; s2.connect(f); f.connect(g); g.connect(p); p.connect(master); s2.start(now);
    ambActive.push({ s: s2, g, start: now, end: now + b.duration / s2.playbackRate.value }); return true;
  }
  function ambientFade() { if (!ctx) return; const now = ctx.currentTime; for (const v of ambActive) { if (v.fading) continue; v.fading = true; try { v.g.gain.cancelScheduledValues(now); v.g.gain.setValueAtTime(v.g.gain.value, now); v.g.gain.linearRampToValueAtTime(0.0001, now + 1.5); v.s.stop(now + 1.6); } catch (e) {} } }
  // ---- música do baile: toca em loop a partir do palco; volume cai até zero a ~38 m (só escuta quem chega perto) ----
  let baileBuf = null, baileSrc = '', baileNode = null;
  function loadBaile(url) { baileSrc = url; if (ctx) decodeBaile(); }
  function decodeBaile() { if (!ctx || baileBuf || !baileSrc) return; const go = ab => { let ok = false; const fin = b => { if (b && !ok) { ok = true; baileBuf = b; } }; try { const p = ctx.decodeAudioData(ab, fin, () => {}); if (p && p.then) p.then(fin).catch(() => {}); } catch (e) {} };
    if (baileSrc.startsWith('data:')) { const bin = atob(baileSrc.split(',')[1]), u8 = new Uint8Array(bin.length); for (let k = 0; k < bin.length; k++) u8[k] = bin.charCodeAt(k); go(u8.buffer); } else fetch(baileSrc).then(r => r.arrayBuffer()).then(go).catch(() => {}); }
  function baile(on, offset, x, y, z) {
    if (!ensure()) return false; decodeBaile();
    if (!on) { if (baileNode) { const n = baileNode; baileNode = null; try { n.g.gain.setTargetAtTime(0, ctx.currentTime, 0.15); n.s.stop(ctx.currentTime + 0.8); } catch (e) {} } return true; }
    if (baileNode || !baileBuf) return !!baileNode;
    const s2 = ctx.createBufferSource(); s2.buffer = baileBuf; s2.loop = true; const g = ctx.createGain(); g.gain.value = 0.9;
    const p = ctx.createPanner(); p.panningModel = 'equalpower'; p.distanceModel = 'linear'; p.refDistance = 5; p.maxDistance = 38; p.rolloffFactor = 1; setPos(p, x, y, z);
    s2.connect(g); g.connect(p); p.connect(master); s2.start(ctx.currentTime, ((offset % baileBuf.duration) + baileBuf.duration) % baileBuf.duration); baileNode = { s: s2, g, p }; return true;
  }
  // ---- voz de outro jogador: fluxo WebRTC -> volume pela distância -> posição 3D ----
  function voiceNode(stream) {
    if (!ensure()) return null; const src = ctx.createMediaStreamSource(stream), g = ctx.createGain(), an = ctx.createAnalyser(), p = ctx.createPanner();
    g.gain.value = 0; an.fftSize = 256; p.panningModel = 'equalpower'; p.distanceModel = 'linear'; p.refDistance = 1; p.maxDistance = 1e4; p.rolloffFactor = 0;
    src.connect(an); src.connect(g); g.connect(p); p.connect(master); const buf = new Uint8Array(an.fftSize);
    return { setPos(x, y, z) { setPos(p, x, y, z); }, setGain(v) { g.gain.setTargetAtTime(v, ctx.currentTime, 0.08); }, level() { an.getByteTimeDomainData(buf); let m = 0; for (const v of buf) m = Math.max(m, Math.abs(v - 128)); return m / 128; }, close() { try { src.disconnect(); g.disconnect(); p.disconnect(); } catch (e) {} } };
  }
  // sirene da viatura (padrão de viatura brasileira): alterna o "uivo" (sobe e desce devagar) com o "ié-ié" rápido,
  // tocada por um alto-falante de corneta (distorção leve + filtro de banda). Uma sirene por viatura, cada uma na sua posição.
  // Só é ouvida de perto: o volume vai a zero a 70 m e o som fica abafado com a distância.
  const sirens = new Map(); let sirenWant = false, hornCurve = null;
  function hornShape() { if (hornCurve) return hornCurve; const n = 1024; hornCurve = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; hornCurve[i] = Math.tanh(x * 2.2) * 0.9; } return hornCurve; }
  function makeSiren(id) {
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), mix = ctx.createGain(), sh = ctx.createWaveShaper(), bp = ctx.createBiquadFilter(), hp = ctx.createBiquadFilter(), lp = ctx.createBiquadFilter(), g = ctx.createGain(), p = ctx.createPanner();
    o1.type = 'sawtooth'; o2.type = 'square'; o2.detune.value = 7; mix.gain.value = 0.35; sh.curve = hornShape(); bp.type = 'bandpass'; bp.frequency.value = 1350; bp.Q.value = 0.7; hp.type = 'highpass'; hp.frequency.value = 420; lp.type = 'lowpass'; lp.frequency.value = 6000;
    g.gain.value = 0; p.panningModel = mobile ? 'equalpower' : 'HRTF'; p.distanceModel = 'linear'; p.refDistance = 6; p.maxDistance = 70; p.rolloffFactor = 1;
    o1.connect(mix); o2.connect(mix); mix.connect(sh); sh.connect(bp); bp.connect(hp); hp.connect(lp); lp.connect(g); g.connect(p); p.connect(master);
    const t0 = ctx.currentTime + 0.05, phase = (id * 1.37) % 1; // cada viatura num ponto diferente do ciclo
    // programa 24 s de padrão: 8 s de uivo (sobe 0,9 s / desce 1,1 s ... ), 4 s de ié-ié (8 ciclos/s)
    const prog = (start) => { let t = start; const f1 = o1.frequency, f2 = o2.frequency; f1.setValueAtTime(650, t); f2.setValueAtTime(650, t);
      for (let k = 0; k < 4; k++) { f1.linearRampToValueAtTime(1450, t + 0.9); f2.linearRampToValueAtTime(1450, t + 0.9); f1.linearRampToValueAtTime(650, t + 2.0); f2.linearRampToValueAtTime(650, t + 2.0); t += 2.0; }
      for (let k = 0; k < 32; k++) { f1.linearRampToValueAtTime(1500, t + 0.06); f2.linearRampToValueAtTime(1500, t + 0.06); f1.linearRampToValueAtTime(700, t + 0.125); f2.linearRampToValueAtTime(700, t + 0.125); t += 0.125; } return t; };
    let until = prog(t0 + phase * 2); o1.start(t0); o2.start(t0);
    return { o1, o2, g, p, lp, get until() { return until; }, more() { until = prog(until); } };
  }
  function siren(on) { sirenWant = on; if (!on) for (const [id, n] of sirens) { try { n.g.gain.setTargetAtTime(0, ctx.currentTime, 0.4); n.o1.stop(ctx.currentTime + 2); n.o2.stop(ctx.currentTime + 2); } catch (e) {} sirens.delete(id); } }
  // cars: [{ x, z }] das viaturas; listener: posição do jogador (para abafar com a distância)
  function sirenAt(cars, me) { if (!ctx) return; if (!Array.isArray(cars)) cars = cars ? [{ x: cars[0], z: cars[2] }] : [];
    for (let k = 0; k < cars.length; k++) { let n = sirens.get(k); if (!n && sirenWant) { n = makeSiren(k); sirens.set(k, n); } if (!n) continue; if (n.until < ctx.currentTime + 4) n.more();
      const c = cars[k]; setPos(n.p, c.x, 1.7, c.z); const d = me ? Math.hypot(c.x - me[0], c.z - me[2]) : 30; n.lp.frequency.setTargetAtTime(Math.max(900, 6500 * Math.pow(12 / Math.max(12, d), 0.9)), ctx.currentTime, 0.2); n.g.gain.setTargetAtTime(sirenWant ? 0.3 : 0, ctx.currentTime, 0.3); }
    for (const [k, n] of sirens) if (k >= cars.length) { try { n.g.gain.setTargetAtTime(0, ctx.currentTime, 0.3); n.o1.stop(ctx.currentTime + 1.5); n.o2.stop(ctx.currentTime + 1.5); } catch (e) {} sirens.delete(k); } }
  function voiceBus() { if (!ensure()) return null; const input = ctx.createGain(), g = ctx.createGain(), p = ctx.createPanner(); g.gain.value = 0; p.panningModel = 'equalpower'; p.distanceModel = 'linear'; p.refDistance = 1; p.maxDistance = 1e4; p.rolloffFactor = 0; input.connect(g); g.connect(p); p.connect(master);
    return { input, setPos(x, y, z) { setPos(p, x, y, z); }, setGain(v) { g.gain.setTargetAtTime(v, ctx.currentTime, 0.08); }, close() { try { input.disconnect(); g.disconnect(); p.disconnect(); } catch (e) {} } }; }
  function load(urls) { Object.assign(src, urls); if (ctx) for (const k in urls) decode(k); }
  const getNoise = () => { if (noise) return noise; const b = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return noise = b; };
  function setListener(x, y, z, yaw, pitch) { if (![...arguments].every(v => typeof v !== 'number' || Number.isFinite(v))) return;
    if (!ctx) return; const L = ctx.listener, fx = Math.sin(yaw) * Math.cos(pitch), fy = Math.sin(pitch), fz = Math.cos(yaw) * Math.cos(pitch);
    if (L.positionX) { const t = ctx.currentTime; L.positionX.setValueAtTime(x, t); L.positionY.setValueAtTime(y, t); L.positionZ.setValueAtTime(z, t); L.forwardX.setValueAtTime(fx, t); L.forwardY.setValueAtTime(fy, t); L.forwardZ.setValueAtTime(fz, t); L.upX.setValueAtTime(0, t); L.upY.setValueAtTime(1, t); L.upZ.setValueAtTime(0, t); }
    else { L.setPosition(x, y, z); L.setOrientation(fx, fy, fz, 0, 1, 0); }
  }
  function setPos(p, x, y, z) { if (![x, y, z].every(Number.isFinite)) return; if (p.positionX) { p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z; } else p.setPosition(x, y, z); }
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
  // explosão de granada: estrondo grave + chiado, com posição 3D e abafamento por paredes
  function boom(x, y, z, dist, occluded) {
    if (!ensure()) return; const now = ctx.currentTime, g = ctx.createGain(), f = ctx.createBiquadFilter(), n = ctx.createBufferSource(); n.buffer = getNoise(); f.type = 'lowpass';
    f.frequency.value = Math.max(400, (occluded ? 900 : 4200) * Math.pow(10 / Math.max(10, dist), 0.6)); const vol = Math.min(1.4, 1.6 * Math.pow(12 / Math.max(12, dist), 0.9));
    g.gain.setValueAtTime(vol, now); g.gain.exponentialRampToValueAtTime(0.001, now + 1.1); const p = panner(x, y, z); p.refDistance = 8; n.connect(f); f.connect(g); g.connect(p); p.connect(master); n.start(now, 0, 0.6);
    const o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(90, now); o.frequency.exponentialRampToValueAtTime(32, now + 0.5); og.gain.setValueAtTime(vol * 0.9, now); og.gain.exponentialRampToValueAtTime(0.001, now + 0.6); o.connect(og); og.connect(p); o.start(now); o.stop(now + 0.65);
  }
  function setVolume(v) { volume = v; if (master && !muted) master.gain.value = v; }
  return { siren, sirenAt, context: () => ctx, voiceBus, unlocked: () => !!ctx && ctx.state === 'running', get baileOn() { return !!baileNode; }, get baileReady() { return !!baileBuf; }, ensure, load, loadBaile, baile, voiceNode, loadAmbient, ambient, ambientFade, setListener, shot, whizz, boom, blip, thud, step, setVolume, setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : volume; }, get muted() { return muted; }, get ready() { return !!(buf.rifle && buf.pistol); }, get voices() { return voices.length; }, close() { if (ctx && ctx.close) ctx.close(); ctx = null; } };
}
window.EscAudio = makeAudio;
})();
