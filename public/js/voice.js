/* Complexo do Escadão 3D — chat de voz por proximidade.
   WebRTC ponto a ponto entre os jogadores humanos da mesma sala (o servidor só repassa a sinalização).
   O volume de cada voz depende da distância: alto até 4 m, some aos 28 m. */
(function () {
'use strict';
const ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] };
const NEAR = 4, FAR = 28;
function create(P) {
  const V = { peers: new Map(), mic: null, sess: null, socket: null, talking: new Map(), micOn: new Map(), supported: !!(window.RTCPeerConnection && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) };
  const send = (to, data) => V.socket && V.socket.emit('voice:signal', { to, data });
  const myId = () => V.sess && V.sess.myId;
  function attach(id, stream) {
    const pr = V.peers.get(id); if (!pr || pr.node) return;
    // o Chrome só entrega o áudio remoto ao Web Audio se o fluxo estiver ligado a um elemento <audio> (mudo)
    const el = document.createElement('audio'); el.muted = true; el.autoplay = true; el.setAttribute('playsinline', ''); el.srcObject = stream; el.play().catch(() => {}); pr.el = el;
    pr.node = P.audio && P.audio.voiceNode(stream);
  }
  function ensurePeer(id) {
    let pr = V.peers.get(id); if (pr) return pr;
    const pc = new RTCPeerConnection(ICE); pr = { pc, tr: null, node: null, el: null }; V.peers.set(id, pr);
    pc.onicecandidate = e => { if (e.candidate) send(id, { ice: e.candidate }); };
    pc.ontrack = e => attach(id, e.streams && e.streams[0] ? e.streams[0] : new MediaStream([e.track]));
    pc.onconnectionstatechange = () => { if (pc.connectionState === 'failed') { drop(id); setTimeout(() => connectAll(), 1500); } };
    if (myId() < id) { // quem tem o menor id faz a oferta (evita as duas pontas oferecerem ao mesmo tempo)
      pr.tr = pc.addTransceiver('audio', { direction: 'sendrecv' }); if (V.mic) pr.tr.sender.replaceTrack(V.mic.getAudioTracks()[0]).catch(() => {});
      pc.createOffer().then(o => pc.setLocalDescription(o)).then(() => send(id, { sdp: pc.localDescription })).catch(e => console.warn('voz: oferta', e)); }
    return pr;
  }
  async function onSignal(m) {
    if (!V.sess || !m || m.from == null) return; const pr = ensurePeer(m.from), pc = pr.pc, d = m.data || {};
    try {
      if (d.sdp) { await pc.setRemoteDescription(d.sdp);
        if (d.sdp.type === 'offer') { pr.tr = pc.getTransceivers()[0]; if (pr.tr) { pr.tr.direction = 'sendrecv'; if (V.mic) await pr.tr.sender.replaceTrack(V.mic.getAudioTracks()[0]); }
          const a = await pc.createAnswer(); await pc.setLocalDescription(a); send(m.from, { sdp: pc.localDescription }); }
        for (const c of pr.pending || []) await pc.addIceCandidate(c).catch(() => {}); pr.pending = []; }
      else if (d.ice) { if (pc.remoteDescription) await pc.addIceCandidate(d.ice).catch(() => {}); else (pr.pending || (pr.pending = [])).push(d.ice); }
    } catch (e) { console.warn('voz: sinalização', e); }
  }
  function drop(id) { const pr = V.peers.get(id); if (!pr) return; try { pr.pc.close(); } catch (e) {} if (pr.node) pr.node.close(); if (pr.el) { pr.el.srcObject = null; } V.peers.delete(id); }
  // conecta com todos os outros jogadores humanos da partida
  function connectAll() { const s = V.sess; if (!s || !s.roster) return; for (const [id, info] of s.roster) if (id !== s.myId && !info.bot) ensurePeer(id); }
  V.start = function (sess, socket) {
    V.stop(); if (!V.supported || !socket) return; V.sess = sess; V.socket = socket;
    if (!V.bound) { V.bound = true; socket.on('voice:signal', m => onSignal(m)); socket.on('voice:state', m => { if (m) V.micOn.set(m.id, !!m.on); }); }
    connectAll(); if (V.mic) socket.emit('voice:state', { on: true });
  };
  V.stop = function () { for (const id of [...V.peers.keys()]) drop(id); V.sess = null; V.talking.clear(); };
  V.toggleMic = async function () {
    if (!V.supported) return { error: 'Seu navegador não permite chat de voz.' };
    if (V.mic) { V.mic.getTracks().forEach(t => t.stop()); V.mic = null; for (const pr of V.peers.values()) if (pr.tr) pr.tr.sender.replaceTrack(null).catch(() => {}); if (V.socket) V.socket.emit('voice:state', { on: false }); return { on: false }; }
    try { V.mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
    catch (e) { return { error: 'Não foi possível usar o microfone (permissão negada ou indisponível).' }; }
    const tk = V.mic.getAudioTracks()[0]; for (const pr of V.peers.values()) if (pr.tr) pr.tr.sender.replaceTrack(tk).catch(() => {});
    if (V.socket) V.socket.emit('voice:state', { on: true }); return { on: true };
  };
  // a cada quadro: volume e posição de cada voz conforme a distância até mim
  V.update = function () {
    const s = V.sess; if (!s) return; const me = s.me; connectAllLazy();
    for (const [id, pr] of V.peers) { if (!pr.node) continue; const a = s.actors.get(id); if (!a || !Number.isFinite(a.x)) { pr.node.setGain(0); continue; }
      const d = Math.hypot(a.x - me.x, a.y - me.y, a.z - me.z), g = d <= NEAR ? 1 : d >= FAR ? 0 : 1 - (d - NEAR) / (FAR - NEAR);
      pr.g = g; pr.node.setGain(g * 1.4); pr.node.setPos(a.x, a.y + 1.6, a.z); const lv = pr.node.level(); V.talking.set(id, lv > 0.06 && g > 0 ? performance.now() : (V.talking.get(id) || 0)); }
  };
  let lastConn = 0; function connectAllLazy() { const t = performance.now(); if (t - lastConn > 3000) { lastConn = t; connectAll(); } }
  V.isTalking = id => performance.now() - (V.talking.get(id) || 0) < 400;
  return V;
}
window.EscVoice = { create };
})();
