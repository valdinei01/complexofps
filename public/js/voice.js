/* Complexo do Escadão 3D — chat de voz por proximidade (via servidor).
   O microfone é capturado em pedaços de 40 ms, reduzido para 16 kHz e comprimido (lei µ, 8 bits).
   O servidor repassa cada pedaço só para os jogadores que estão a até 30 m de quem fala.
   Não depende de conexão direta entre os jogadores: funciona em qualquer rede em que o jogo funciona. */
(function () {
'use strict';
const RATE = 16000, FRAME = 640, NEAR = 4, FAR = 28;
// lei µ (G.711): 16 bits -> 8 bits
function muEnc(s) { const BIAS = 0x84, CLIP = 32635; let sign = 0; if (s < 0) { s = -s; sign = 0x80; } if (s > CLIP) s = CLIP; s += BIAS; let exp = 7; for (let m = 0x4000; (s & m) === 0 && exp > 0; m >>= 1) exp--; return ~(sign | (exp << 4) | ((s >> (exp + 3)) & 0x0F)) & 0xFF; }
const MU_DEC = (() => { const t = new Float32Array(256); for (let i = 0; i < 256; i++) { const u = ~i & 0xFF, sign = u & 0x80, exp = (u >> 4) & 7, man = u & 0x0F; let s = ((man << 3) + 0x84) << exp; s -= 0x84; t[i] = (sign ? -s : s) / 32768; } return t; })();
const b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s); };
const unb64 = str => { const bin = atob(str), o = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) o[i] = bin.charCodeAt(i); return o; };
function create(P) {
  const V = { mic: null, sess: null, socket: null, speakers: new Map(), sent: 0, received: 0, supported: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia), state: 'desligado', lastError: '' };
  let cap = null; // { src, proc, sink }
  const ctxOf = () => P.audio && P.audio.context && P.audio.context();
  function startCapture(stream) {
    const ctx = ctxOf(); if (!ctx) throw new Error('áudio do jogo ainda não iniciou');
    const src = ctx.createMediaStreamSource(stream), proc = ctx.createScriptProcessor(2048, 1, 1), sink = ctx.createGain(); sink.gain.value = 0;
    const step = ctx.sampleRate / RATE; let acc = 0, sum = 0, cnt = 0, hang = 0; const out = new Uint8Array(FRAME); let n = 0, energy = 0;
    proc.onaudioprocess = e => { const x = e.inputBuffer.getChannelData(0);
      for (let i = 0; i < x.length; i++) { sum += x[i]; cnt++; acc += 1; if (acc >= step) { acc -= step; const v = sum / cnt; sum = 0; cnt = 0; energy += v * v; out[n++] = muEnc(Math.max(-1, Math.min(1, v * 1.6)) * 32767 | 0);
        if (n === FRAME) { const rms = Math.sqrt(energy / FRAME); energy = 0; n = 0; V.level = rms; if (rms > 0.012) hang = 10; else if (hang > 0) hang--; // só envia quando há voz (com 400 ms de folga)
          if (hang > 0 && V.socket && V.sess) { V.socket.emit('voice:data', b64(out)); V.sent++; V.talkingSelf = performance.now(); } } } } };
    src.connect(proc); proc.connect(sink); sink.connect(ctx.destination); cap = { src, proc, sink };
  }
  function stopCapture() { if (!cap) return; try { cap.proc.onaudioprocess = null; cap.src.disconnect(); cap.proc.disconnect(); cap.sink.disconnect(); } catch (e) {} cap = null; }
  // recebe um pedaço de voz de alguém: agenda para tocar com ~120 ms de folga (absorve variação da rede)
  function onData(m) {
    const ctx = ctxOf(); if (!ctx || !V.sess || !m || typeof m.d !== 'string') return; V.received++;
    let sp = V.speakers.get(m.id); if (!sp) { const node = P.audio.voiceBus(); if (!node) return; sp = { node, next: 0, last: 0, g: 0 }; V.speakers.set(m.id, sp); }
    const u8 = unb64(m.d), up = ctx.sampleRate / RATE, len = Math.round(u8.length * up), buf = ctx.createBuffer(1, len, ctx.sampleRate), ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) { const p = i / up, i0 = Math.min(u8.length - 1, p | 0), i1 = Math.min(u8.length - 1, i0 + 1), f = p - i0; ch[i] = MU_DEC[u8[i0]] * (1 - f) + MU_DEC[u8[i1]] * f; }
    const now = ctx.currentTime; if (sp.next < now + 0.02 || sp.next > now + 0.8) sp.next = now + 0.12;
    const s = ctx.createBufferSource(); s.buffer = buf; s.connect(sp.node.input); s.start(sp.next); sp.next += buf.duration; sp.last = performance.now();
  }
  V.start = function (sess, socket) { V.sess = sess; V.socket = socket; if (socket && !V.bound) { V.bound = true; socket.on('voice:data', onData); } if (V.mic && socket) socket.emit('voice:state', { on: true }); };
  V.stop = function () { V.sess = null; for (const sp of V.speakers.values()) sp.node.close(); V.speakers.clear(); };
  V.toggleMic = async function () {
    if (!V.supported) { V.lastError = 'Este navegador não permite usar o microfone (é preciso HTTPS).'; return { error: V.lastError }; }
    if (V.mic) { stopCapture(); V.mic.getTracks().forEach(t => t.stop()); V.mic = null; V.state = 'desligado'; if (V.socket) V.socket.emit('voice:state', { on: false }); return { on: false }; }
    try { if (P.audio) P.audio.ensure(); V.mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } }); startCapture(V.mic); }
    catch (e) { if (V.mic) { V.mic.getTracks().forEach(t => t.stop()); V.mic = null; } V.state = 'erro'; V.lastError = e && e.name === 'NotAllowedError' ? 'Permissão do microfone negada. Libere o microfone para este site nas configurações do navegador.' : 'Não foi possível usar o microfone: ' + (e && e.message || e); console.error('[voz]', e); return { error: V.lastError }; }
    V.state = 'ligado'; if (V.socket) V.socket.emit('voice:state', { on: true }); return { on: true };
  };
  // a cada quadro: volume e direção de cada voz conforme a distância
  V.update = function () { const s = V.sess; if (!s) return; const me = s.me;
    for (const [id, sp] of V.speakers) { const a = s.actors.get(id); if (!a || !Number.isFinite(a.x)) { sp.node.setGain(0); continue; } const d = Math.hypot(a.x - me.x, a.y - me.y, a.z - me.z); sp.g = d <= NEAR ? 1 : d >= FAR ? 0 : 1 - (d - NEAR) / (FAR - NEAR); sp.node.setGain(sp.g * 1.8); sp.node.setPos(a.x, a.y + 1.6, a.z); } };
  V.isTalking = id => { const sp = V.speakers.get(id); return !!sp && performance.now() - sp.last < 350 && sp.g > 0; };
  V.selfTalking = () => performance.now() - (V.talkingSelf || 0) < 350;
  return V;
}
window.EscVoice = { create, muEnc, MU_DEC };
})();
