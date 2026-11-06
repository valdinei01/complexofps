/* Complexo do Escadão 3D — menu, salas online, lobby, configurações, estatísticas, controles e editor de HUD. */
(function () {
'use strict';
const S = window.EscSim, P = window.EscPlay, HUD = window.EscHUD;
const $ = (q, el) => (el || document).querySelector(q);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const VERSION = '2.0.0';
const store = { get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
const cfg = P.cfg = Object.assign({ name: '', quality: 'medio', sens: 1, volume: 0.8, diff: 'normal', team: 0, showFps: false }, store.get('escadao3d-cfg', {}));
const saveCfg = () => store.set('escadao3d-cfg', cfg);
const stats = Object.assign({ partidas: 0, vitorias: 0, derrotas: 0, abates: 0, mortes: 0, capturas: 0, civis: 0, online: 0 }, store.get('escadao3d-stats', {}));
let key = store.get('escadao3d-key', null); if (!key) { key = 'k' + Math.random().toString(36).slice(2) + Date.now().toString(36); store.set('escadao3d-key', key); }
const touch = P.touch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0 && matchMedia('(pointer:coarse)').matches);
const ONLINE = typeof window.io === 'function';
const app = { screen: null, socket: null, room: null, lobby: null, layout: HUD.load(touch), keys: {}, last: performance.now(), fps: 60, fpsN: 0, fpsT: 0 };
window.EscApp = app;

// ---------------- elementos base ----------------
const root = $('#app'), glc = $('#gl'), hud = $('#hud'), ui = $('#ui'), touchLayer = $('#touch');
const hctx = hud.getContext('2d');
P.audio = window.EscAudio(); P.audio.setVolume(cfg.volume);
P.audio.load({ rifle: window.ESC_AUDIO ? window.ESC_AUDIO.rifle : '/audio/fuzil.mp3', pistol: window.ESC_AUDIO ? window.ESC_AUDIO.pistol : '/audio/pistola.mp3' });
function resize() {
  const q = P.quality(), dpr = Math.min(window.devicePixelRatio || 1, q.scale >= 1 ? 1.5 : 1) * Math.min(1, q.scale), w = root.clientWidth, h = root.clientHeight;
  glc.width = Math.max(1, Math.round(w * dpr)); glc.height = Math.max(1, Math.round(h * dpr)); if (P.R) P.R.gl.viewport(0, 0, glc.width, glc.height);
  const hs = Math.min(window.devicePixelRatio || 1, 2); hud.width = Math.round(w * hs); hud.height = Math.round(h * hs); app.view = Object.assign(app.view || {}, { W: w, H: h, hs, hctx }); layoutTouch();
}
window.addEventListener('resize', resize);

// ---------------- telas ----------------
function show(html, cls) { ui.innerHTML = html; ui.className = 'ui ' + (cls || ''); ui.style.display = html ? '' : 'none'; }
function toast(text, bad) { const t = document.createElement('div'); t.className = 'toast' + (bad ? ' bad' : ''); t.textContent = text; document.body.appendChild(t); setTimeout(() => t.remove(), 2800); }
function modal(html) { const m = document.createElement('div'); m.className = 'modal'; m.innerHTML = `<div class="mcard">${html}</div>`; document.body.appendChild(m); m.addEventListener('click', e => { if (e.target === m) m.remove(); }); return m; }
const ICON = {
  play: '<svg viewBox="0 0 24 24"><path d="M7 4l13 8-13 8z" fill="currentColor"/></svg>',
  rooms: '<svg viewBox="0 0 24 24"><circle cx="8" cy="8" r="3.2" fill="currentColor"/><circle cx="16.5" cy="9" r="2.6" fill="currentColor"/><path d="M2 20c0-3.6 2.7-6 6-6s6 2.4 6 6zM13.5 20c.2-2.4-.6-4.3-1.8-5.3 3.6-1 8.3.6 8.3 5.3z" fill="currentColor"/></svg>',
  gun: '<svg viewBox="0 0 24 24"><path d="M2 8h15l1-2h3v4h-3l-1 2H11l-1 2-1 5H5l1-5H4V10H2z" fill="currentColor"/></svg>',
  stats: '<svg viewBox="0 0 24 24"><path d="M3 20h18v-2H3zm2-4h3V9H5zm5 0h3V4h-3zm5 0h3v-5h-3z" fill="currentColor"/></svg>',
  gear: '<svg viewBox="0 0 24 24"><path d="M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7zm8.6 4.8l1.9 1.5-2 3.4-2.3-.9a7.7 7.7 0 01-2 1.2L15.9 21h-4l-.3-2.5a7.7 7.7 0 01-2-1.2l-2.3.9-2-3.4 1.9-1.5a8 8 0 010-2.6L5.3 9.2l2-3.4 2.3.9a7.7 7.7 0 012-1.2L11.9 3h4l.3 2.5a7.7 7.7 0 012 1.2l2.3-.9 2 3.4-1.9 1.5a8 8 0 010 2.6z" fill="currentColor"/></svg>',
  news: '<svg viewBox="0 0 24 24"><path d="M4 4h13v14a2 2 0 002 2H6a2 2 0 01-2-2zm15 4h2v10a2 2 0 01-2 2zM7 7v3h7V7zm0 5v1.5h7V12zm0 3.5V17h7v-1.5z" fill="currentColor"/></svg>',
};
function menu() {
  leaveOnlineList(); app.screen = 'menu';
  show(`<div class="menu"><div class="logo"><div class="l1">COMPLEXO DO</div><div class="l2">ESCADÃO</div><div class="l3">— FPS ONLINE —</div></div>
    <nav class="mbtns">
      <button class="mb main" data-go="play">${ICON.play}<span>JOGAR</span></button>
      <button class="mb" data-go="rooms">${ICON.rooms}<span>SALAS</span></button>
      <button class="mb" data-go="arms">${ICON.gun}<span>ARMAMENTO</span></button>
      <button class="mb" data-go="stats">${ICON.stats}<span>ESTATÍSTICAS</span></button>
      <button class="mb" data-go="settings">${ICON.gear}<span>CONFIGURAÇÕES</span></button>
      <button class="mb" data-go="news">${ICON.news}<span>NOVIDADES</span></button>
    </nav>
    <div class="who">Jogando como <b>${esc(cfg.name || 'Jogador')}</b> · <button class="link" data-go="settings">trocar nome</button></div>
    <div class="ver">v${VERSION}${ONLINE ? '' : ' · modo sem servidor'}</div></div>`, 'm-menu');
  ui.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { P.audio.ensure(); ({ play: playMenu, rooms: roomsScreen, arms: armsScreen, stats: statsScreen, settings: settingsScreen, news: newsScreen })[b.dataset.go](); });
}
function back(fn) { return `<button class="back" data-back>‹ Voltar</button>`; }
function wireBack(fn) { const b = ui.querySelector('[data-back]'); if (b) b.onclick = fn || menu; }
function needName(then) { if (cfg.name) return then(); const m = modal(`<h3>Como você quer ser chamado?</h3><input id="nm" maxlength="16" placeholder="Seu apelido" value=""><div class="row"><button class="btn red" id="ok">Continuar</button></div>`); const i = $('#nm', m); i.focus(); const go = () => { const v = i.value.trim().slice(0, 16); if (!v) return i.focus(); cfg.name = v; saveCfg(); m.remove(); then(); }; $('#ok', m).onclick = go; i.onkeydown = e => { if (e.key === 'Enter') go(); }; }
// Jogar: partida online rápida (se houver servidor) ou treino com bots
function playMenu() {
  app.screen = 'play';
  show(`<div class="panel">${back()}<h2>Jogar</h2>
    <button class="big" id="quick" ${ONLINE ? '' : 'disabled'}><b>Partida online rápida</b><small>${ONLINE ? 'Entra numa sala pública com vaga ou cria uma nova' : 'Indisponível: este arquivo não está conectado ao servidor do jogo (Render).'}</small></button>
    <button class="big" id="train"><b>Treino com bots</b><small>Dominação de Bases no seu aparelho, você + 4 bots contra 5 bots, sem internet</small></button>
    <div class="opts"><label>Time no treino</label><div class="seg" data-k="team"><button data-v="0">Azul</button><button data-v="1">Vermelho</button></div>
    <label>Dificuldade dos bots</label><div class="seg" data-k="diff"><button data-v="facil">Fácil</button><button data-v="normal">Normal</button><button data-v="dificil">Difícil</button></div></div></div>`, 'm-panel');
  wireSeg(); wireBack();
  $('#train').onclick = () => needName(() => startOffline());
  if (ONLINE) $('#quick').onclick = () => needName(() => connect(() => { app.socket.emit('rooms:sub'); app.socket.once('rooms:list', list => { const r = list.find(x => !x.priv && x.state !== 'ended' && x.humans + 0 < 10 && (x.total < 10 || x.bots > 0)); if (r) joinRoom(r.id); else createRoom({ name: 'Sala de ' + cfg.name, bots0: 4, bots1: 5, diff: cfg.diff }); }); }));
}
function wireSeg() { ui.querySelectorAll('.seg').forEach(sg => { const k = sg.dataset.k; sg.querySelectorAll('button').forEach(b => { b.setAttribute('aria-pressed', String(String(cfg[k]) === b.dataset.v)); b.onclick = () => { cfg[k] = k === 'team' ? +b.dataset.v : b.dataset.v; saveCfg(); sg.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); if (k === 'quality') resize(); }; }); }); }
function armsScreen() {
  app.screen = 'arms'; const W = S.CONFIG.weapons;
  const card = (k, w, desc) => `<div class="arm"><div class="arm-h">${esc(w.name)}</div><p>${desc}</p><table>
    <tr><td>Carregador</td><td>${w.mag}</td></tr><tr><td>Reserva</td><td>${w.res}</td></tr><tr><td>Total após reabastecer</td><td>${w.mag + w.res}</td></tr>
    <tr><td>Dano no corpo / cabeça</td><td>${w.body} / ${Math.round(w.body * w.head)}</td></tr><tr><td>Cadência</td><td>${Math.round(60 / w.rate)} tiros/min · ${w.auto ? 'automático' : 'semiautomático'}</td></tr><tr><td>Recarga</td><td>${w.reload} s</td></tr></table></div>`;
  show(`<div class="panel">${back()}<h2>Armamento</h2><div class="arms">${card('rifle', W.rifle, 'Arma principal. Rajadas longas, bom para médio alcance.')}${card('pistol', W.pistol, 'Arma de apoio. Um tiro por clique, ótima quando o fuzil acaba.')}</div>
    <p class="note">A munição é limitada. Recarregar usa só a reserva. Para recuperar tudo, volte à estação de suprimentos da base do seu time e segure <b>E</b> (ou o botão <b>INTERAGIR</b> no celular) por ${S.CONFIG.refill.time} segundos.</p></div>`, 'm-panel'); wireBack();
}
function statsScreen() {
  app.screen = 'stats'; const kd = stats.mortes ? (stats.abates / stats.mortes).toFixed(2) : stats.abates.toFixed(2);
  show(`<div class="panel">${back()}<h2>Estatísticas</h2><div class="stats">
    ${[['Partidas', stats.partidas], ['Vitórias', stats.vitorias], ['Derrotas', stats.derrotas], ['Abates', stats.abates], ['Mortes', stats.mortes], ['Abates/Mortes', kd], ['Bases capturadas', stats.capturas], ['Civis atingidos', stats.civis], ['Partidas online', stats.online]].map(([l, v]) => `<div class="st"><b>${v}</b><span>${l}</span></div>`).join('')}
    </div><p class="note">Salvas neste aparelho.</p><button class="btn ghost" id="zero">Zerar estatísticas</button></div>`, 'm-panel'); wireBack();
  $('#zero').onclick = () => { for (const k in stats) stats[k] = 0; store.set('escadao3d-stats', stats); statsScreen(); };
}
function newsScreen() {
  app.screen = 'news';
  show(`<div class="panel">${back()}<h2>Novidades</h2><div class="news">
    <h4>Versão ${VERSION}</h4><ul>
    <li>Novo modo <b>Dominação de Bases</b>: Base A (Praça Central), Base B (Escadão) e Base C (Canal). Cada base dominada rende 1% a cada 12 s; vence quem chegar a 100%.</li>
    <li><b>Munição limitada</b> com fuzil (30/180) e pistola (15/75). Reabastecimento nas estações das bases principais.</li>
    <li><b>Civis</b> circulando pela comunidade. Eliminar um civil custa 5% da pontuação do time.</li>
    <li>Ruas principais mais largas, Avenida das Américas com placas, ônibus e comércio, escadão com patamares maiores.</li>
    <li>Um som fixo para cada arma, áudio 3D com distância, direção e paredes, e zumbido de projétil passando perto.</li>
    <li>Traçantes visíveis saindo do cano, clarão e impactos.</li>
    <li><b>Editar HUD</b>: arraste, mude o tamanho e a transparência de cada elemento.</li>
    <li>Salas públicas e privadas, convite por link e lobby com times.</li></ul></div></div>`, 'm-panel'); wireBack();
}
function settingsScreen(fromGame) {
  app.screen = 'settings';
  show(`<div class="panel">${fromGame ? '' : back()}<h2>Configurações</h2><div class="opts">
    <label for="nm">Apelido</label><input id="nm" maxlength="16" value="${esc(cfg.name)}" placeholder="Seu apelido">
    <label>Gráficos</label><div class="seg" data-k="quality"><button data-v="baixo">Baixo</button><button data-v="medio">Médio</button><button data-v="alto">Alto</button></div>
    <small class="hint">Baixo: menor resolução interna, menos efeitos e neblina mais próxima. Alto: resolução cheia e mais partículas.</small>
    <label for="sens">Sensibilidade da mira</label><input id="sens" type="range" min="0.3" max="2.5" step="0.05" value="${cfg.sens}">
    <label for="vol">Volume</label><input id="vol" type="range" min="0" max="1" step="0.05" value="${cfg.volume}">
    <label class="chk"><input type="checkbox" id="fps" ${cfg.showFps ? 'checked' : ''}> Mostrar quadros por segundo</label>
    <button class="btn" id="edit">Editar HUD</button></div>
    ${fromGame ? '<button class="btn red" id="close">Voltar à partida</button>' : ''}</div>`, 'm-panel');
  wireSeg(); wireBack();
  $('#nm').onchange = e => { cfg.name = e.target.value.trim().slice(0, 16); saveCfg(); };
  $('#sens').oninput = e => { cfg.sens = +e.target.value; saveCfg(); };
  $('#vol').oninput = e => { cfg.volume = +e.target.value; P.audio.setVolume(cfg.volume); saveCfg(); };
  $('#fps').onchange = e => { cfg.showFps = e.target.checked; saveCfg(); };
  $('#edit').onclick = () => openEditor(fromGame ? () => pauseScreen() : settingsScreen);
  if (fromGame) $('#close').onclick = () => pauseScreen();
}

// ---------------- online ----------------
function connect(then) {
  if (!ONLINE) return toast('Servidor indisponível neste arquivo.', true);
  if (app.socket && app.socket.connected) return then && then();
  if (!app.socket) {
    app.socket = window.io({ transports: ['websocket', 'polling'], reconnection: true });
    const s = app.socket;
    s.on('connect', () => s.emit('hello', { key, name: cfg.name || 'Jogador' }, r => { if (r && r.rejoined) { app.room = r.rejoined; if (r.state === 'lobby') lobbyScreen(); } if (app.pendingConnect) { const f = app.pendingConnect; app.pendingConnect = null; f(); } }));
    s.on('disconnect', () => { if (P.sess && P.sess.mode === 'online') toast('Conexão perdida. Tentando reconectar…', true); });
    s.on('rooms:list', list => { app.rooms = list; if (app.screen === 'rooms') renderRoomList(); });
    s.on('lobby:state', st => { app.lobby = st; app.room = st.id; if (app.screen === 'lobby') renderLobby(); });
    s.on('lobby:back', () => { if (P.sess) endGame(); lobbyScreen(); });
    s.on('game:start', d => startOnline(d));
    s.on('room:closed', () => { app.room = null; app.lobby = null; if (P.sess) endGame(); toast('A sala foi encerrada.'); roomsScreen(); });
  }
  app.pendingConnect = then; if (app.socket.connected && then) { app.pendingConnect = null; then(); }
}
function leaveOnlineList() { if (app.socket && app.socket.connected) app.socket.emit('rooms:unsub'); }
function roomsScreen() {
  app.screen = 'rooms';
  show(`<div class="panel wide">${back()}<h2>Salas</h2>
    ${ONLINE ? `<div class="bar"><input id="q" placeholder="Pesquisar sala pelo nome" value="${esc(app.q || '')}"><button class="btn red" id="create">Criar sala</button></div>
      <div class="bar"><input id="code" maxlength="8" placeholder="Código da sala (convite)"><button class="btn" id="go">Entrar</button></div><div id="list" class="list"><p class="note">Conectando…</p></div>`
    : `<p class="note">As salas online funcionam quando o jogo é aberto pelo endereço publicado no Render (servidor Node.js + Socket.IO). Este arquivo roda sem servidor, então aqui só existe o treino com bots.</p><button class="btn red" id="train">Ir para o treino</button>`}</div>`, 'm-panel'); wireBack();
  if (!ONLINE) { $('#train').onclick = playMenu; return; }
  needName(() => connect(() => app.socket.emit('rooms:sub')));
  $('#q').oninput = e => { app.q = e.target.value; renderRoomList(); };
  $('#create').onclick = () => needName(createDialog);
  $('#go').onclick = () => { const c = $('#code').value.trim().toUpperCase(); if (c) needName(() => connect(() => joinRoom(c))); };
  if (app.rooms) renderRoomList();
}
function renderRoomList() {
  const el = $('#list'); if (!el) return; const q = (app.q || '').toLowerCase(); const list = (app.rooms || []).filter(r => !q || r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q));
  if (!list.length) { el.innerHTML = `<p class="note">${(app.rooms || []).length ? 'Nenhuma sala com esse nome.' : 'Nenhuma sala aberta agora. Crie a primeira!'}</p>`; return; }
  el.innerHTML = list.map(r => { const full = r.humans >= 10; return `<div class="room"><div class="rn"><b>${esc(r.name)}</b><small>${r.priv ? '🔒 Privada' : 'Pública'} · ${esc(r.mode)} · código ${r.id}</small></div>
    <div class="rc"><span>${r.humans} jogador${r.humans === 1 ? '' : 'es'} · ${r.bots} bots</span><span class="tag ${r.state}">${r.state === 'lobby' ? 'No lobby' : r.state === 'playing' ? 'Em partida' : 'Encerrando'}</span>${full ? '<span class="tag full">Cheia</span>' : ''}</div>
    <button class="btn" data-join="${r.id}" ${full ? 'disabled' : ''}>Entrar</button></div>`; }).join('');
  el.querySelectorAll('[data-join]').forEach(b => b.onclick = () => joinRoom(b.dataset.join));
}
function createDialog() {
  const m = modal(`<h3>Criar sala</h3><label>Nome da sala</label><input id="rn" maxlength="28" value="${esc('Sala de ' + cfg.name)}"><label>Senha (opcional)</label><input id="rp" maxlength="24" placeholder="Deixe vazio para sala pública" autocomplete="off">
    <div class="two"><div><label>Bots no Azul</label><input id="b0" type="number" min="0" max="5" value="4"></div><div><label>Bots no Vermelho</label><input id="b1" type="number" min="0" max="5" value="5"></div></div>
    <label>Modo</label><div class="fixed">Dominação de Bases</div><label>Dificuldade dos bots</label><select id="df"><option value="facil">Fácil</option><option value="normal" selected>Normal</option><option value="dificil">Difícil</option></select>
    <div class="row"><button class="btn ghost" id="cn">Cancelar</button><button class="btn red" id="ok">Criar</button></div>`);
  $('#cn', m).onclick = () => m.remove();
  $('#ok', m).onclick = () => { createRoom({ name: $('#rn', m).value, pass: $('#rp', m).value, bots0: +$('#b0', m).value, bots1: +$('#b1', m).value, diff: $('#df', m).value }); m.remove(); };
}
function createRoom(o) { connect(() => app.socket.emit('room:create', o, r => { if (r && r.ok) { app.room = r.id; lobbyScreen(); } else toast((r && r.error) || 'Não foi possível criar a sala.', true); })); }
function joinRoom(id, pass) {
  connect(() => app.socket.emit('room:join', { id, pass }, r => {
    if (r && r.ok) { app.room = r.id; if (app.screen !== 'game') lobbyScreen(); return; }
    if (r && r.needPass) { const m = modal(`<h3>Sala privada</h3><p class="note">Digite a senha da sala ${esc(id)}.</p><input id="pw" type="password" maxlength="24" autocomplete="off">${pass != null ? '<p class="err">Senha incorreta.</p>' : ''}<div class="row"><button class="btn ghost" id="cn">Cancelar</button><button class="btn red" id="ok">Entrar</button></div>`); const i = $('#pw', m); i.focus(); const go = () => { m.remove(); joinRoom(id, i.value); }; $('#ok', m).onclick = go; i.onkeydown = e => { if (e.key === 'Enter') go(); }; $('#cn', m).onclick = () => m.remove(); return; }
    toast((r && r.error) || 'Não foi possível entrar.', true);
  }));
}
function lobbyScreen() { app.screen = 'lobby'; leaveOnlineList(); show(`<div class="panel wide" id="lob"><p class="note">Carregando sala…</p></div>`, 'm-panel'); renderLobby(); }
function renderLobby() {
  const el = $('#lob'), L = app.lobby; if (!el || !L) return; const meP = L.players.find(p => p.key === key), host = meP && meP.host;
  const col = t => { const ps = L.players.filter(p => p.team === t), bots = L.bots[t], free = 5 - ps.length - bots;
    return `<div class="team t${t}"><h3>Time ${S.TEAM[t].name} <small>${ps.length + bots}/5</small></h3>${ps.map(p => `<div class="pl ${p.key === key ? 'me' : ''}">${p.host ? '<span class="crown" title="Anfitrião">♛</span>' : ''}<b>${esc(p.name)}</b>${p.ready ? '<span class="tag ok">Pronto</span>' : ''}${p.conn ? '' : '<span class="tag">reconectando</span>'}</div>`).join('')}
      ${Array.from({ length: bots }, (_, i) => `<div class="pl bot">🤖 ${S.BOT_NAMES[t][i]} <small>bot</small></div>`).join('')}${Array.from({ length: Math.max(0, free) }, () => '<div class="pl empty">vaga livre</div>').join('')}
      ${host ? `<div class="bots"><span>Bots</span><button class="btn sm" data-bot="${t}" data-d="-1">−</button><b>${bots}</b><button class="btn sm" data-bot="${t}" data-d="1">+</button></div>` : ''}</div>`; };
  el.innerHTML = `<button class="back" data-back>‹ Sair da sala</button><h2>${esc(L.name)} <small class="code">código ${L.id}${L.priv ? ' · 🔒 privada' : ''}</small></h2>
    <p class="note">Dominação de Bases · bots ${({ facil: 'fáceis', normal: 'normais', dificil: 'difíceis' })[L.diff]}${L.state === 'playing' ? ' · <b>partida em andamento</b>' : ''}</p>
    <div class="teams">${col(0)}${col(1)}</div>
    <div class="row wrap"><button class="btn" id="inv">Convidar amigos</button><button class="btn" id="sw">Trocar de time</button><button class="btn ${meP && meP.ready ? 'ok' : ''}" id="rd">${meP && meP.ready ? 'Pronto ✓' : 'Pronto'}</button>
    ${host ? `<select id="df"><option value="facil">Bots fáceis</option><option value="normal">Bots normais</option><option value="dificil">Bots difíceis</option></select><button class="btn red" id="st" ${L.state !== 'lobby' ? 'disabled' : ''}>Iniciar partida</button>` : '<span class="note">Aguardando o anfitrião iniciar.</span>'}</div>`;
  el.querySelector('[data-back]').onclick = () => { app.socket.emit('room:leave'); app.room = null; app.lobby = null; roomsScreen(); };
  $('#inv').onclick = () => { const link = location.origin + '/sala/' + L.id; const done = () => toast('Link copiado: ' + link + (L.priv ? ' (a senha é pedida separadamente)' : '')); if (navigator.clipboard) navigator.clipboard.writeText(link).then(done, () => prompt('Copie o link do convite:', link)); else prompt('Copie o link do convite:', link); };
  $('#sw').onclick = () => app.socket.emit('lobby:team', { team: meP.team === 0 ? 1 : 0 });
  $('#rd').onclick = () => app.socket.emit('lobby:ready', { ready: !(meP && meP.ready) });
  if (host) { const df = $('#df'); df.value = L.diff; df.onchange = () => app.socket.emit('lobby:diff', { diff: df.value }); $('#st').onclick = () => app.socket.emit('lobby:start', {}, r => { if (r && r.error) toast(r.error, true); });
    el.querySelectorAll('[data-bot]').forEach(b => b.onclick = () => { const t = +b.dataset.bot; app.socket.emit('lobby:bots', { team: t, n: L.bots[t] + +b.dataset.d }); }); }
}

// ---------------- partida ----------------
function ensure3D() { try { P.initRenderer(glc); resize(); return true; } catch (e) { show(`<div class="panel"><h2>Não foi possível abrir o 3D</h2><p class="note">${esc(e.message)}</p><button class="btn red" id="m">Menu</button></div>`, 'm-panel'); $('#m').onclick = menu; return false; } }
function startOffline() {
  if (!ensure3D()) return; show(''); app.screen = 'game';
  P.startSession({ mode: 'offline', team: cfg.team, diff: cfg.diff, name: cfg.name || 'Você' }, { onEnd: showResult });
  enterGame();
}
function startOnline(d) {
  if (!ensure3D()) return; if (P.sess) P.endSession(); show(''); app.screen = 'game';
  P.startSession({ mode: 'online', socket: app.socket, start: d }, { onEnd: showResult }); enterGame();
}
function enterGame() { root.classList.add('ingame'); touchLayer.style.display = touch ? 'block' : 'none'; layoutTouch(); if (!touch) lockPointer(); P.audio.ensure(); }
function endGame() { P.endSession(); root.classList.remove('ingame'); touchLayer.style.display = 'none'; if (document.exitPointerLock && document.pointerLockElement) document.exitPointerLock(); hctx.setTransform(1, 0, 0, 1, 0, 0); hctx.clearRect(0, 0, hud.width, hud.height); }
function pauseScreen() {
  const s = P.sess; if (!s) return; s.paused = s.mode === 'offline'; app.screen = 'pause'; releaseInput(); if (document.exitPointerLock && document.pointerLockElement) document.exitPointerLock();
  show(`<div class="panel"><h2>Pausa</h2>${s.mode === 'online' ? '<p class="note">A partida online continua enquanto este menu está aberto.</p>' : ''}
    <button class="btn red" id="ct">Continuar</button><button class="btn" id="ed">Editar HUD</button><button class="btn" id="cf">Configurações</button><button class="btn ghost" id="ex">${s.mode === 'online' ? 'Sair da sala' : 'Sair para o menu'}</button>
    <p class="hint">${touch ? 'Esquerda: joystick. Direita: arraste para mirar. Botões de tiro, mira, pulo, agachar, recarregar, trocar arma e interagir.' : 'WASD anda · mouse mira · clique atira · botão direito mira · Shift corre · Espaço pula · C agacha · R recarrega · Q ou 1/2 troca arma · segure E na estação · Tab placar · Esc pausa'}</p></div>`, 'm-panel');
  $('#ct').onclick = resume; $('#ed').onclick = () => openEditor(pauseScreen); $('#cf').onclick = () => settingsScreen(true);
  $('#ex').onclick = () => { if (s.mode === 'online') { app.socket.emit('room:leave'); app.room = null; app.lobby = null; endGame(); roomsScreen(); } else { endGame(); menu(); } };
}
function resume() { const s = P.sess; if (!s) return; s.paused = false; app.screen = 'game'; show(''); if (!touch) lockPointer(); }
function showResult(d) {
  const s = P.sess; if (!s) return; app.screen = 'result'; releaseInput(); if (document.exitPointerLock && document.pointerLockElement) document.exitPointerLock();
  const myId = s.myId, me = d.stats.find(x => x.id === myId) || {}, won = d.winner === s.team;
  stats.partidas++; if (d.winner >= 0) { if (won) stats.vitorias++; else stats.derrotas++; } stats.abates += me.kills || 0; stats.mortes += me.deaths || 0; stats.capturas += me.caps || 0; stats.civis += me.npc || 0; if (s.mode === 'online') stats.online++; store.set('escadao3d-stats', stats);
  const rows = [0, 1].map(t => d.stats.filter(a => a.team === t).sort((a, b) => b.kills - a.kills).map(a => `<tr class="${a.id === myId ? 'me' : ''}"><td><i class="dot t${t}"></i>${esc(a.name)}${a.bot ? ' <small>bot</small>' : ''}</td><td>${a.kills}</td><td>${a.deaths}</td><td>${a.caps}</td><td>${a.npc || ''}</td></tr>`).join('')).join('');
  show(`<div class="panel wide"><h2>${d.winner < 0 ? 'Empate' : won ? 'Vitória do seu time!' : 'Vitória do time ' + S.TEAM[d.winner].name}</h2>
    <div class="final"><span class="t0">Azul ${d.score[0]}%</span><span>×</span><span class="t1">${d.score[1]}% Vermelho</span></div>
    <div class="fbases">${d.bases.map(b => `<span class="fb o${b.owner}">${b.id} · ${esc(b.name)}</span>`).join('')}</div>
    <div class="tbl"><table><tr><th>Jogador</th><th>Abates</th><th>Mortes</th><th>Capturas</th><th>Civis</th></tr>${rows}</table></div>
    <div class="row">${s.mode === 'online' ? '<button class="btn red" id="lb">Voltar ao lobby</button>' : '<button class="btn red" id="ag">Jogar de novo</button><button class="btn ghost" id="mn">Menu</button>'}</div></div>`, 'm-panel');
  if (s.mode === 'online') $('#lb').onclick = () => { endGame(); app.socket.emit('game:back'); lobbyScreen(); };
  else { $('#ag').onclick = () => { endGame(); startOffline(); }; $('#mn').onclick = () => { endGame(); menu(); }; }
}

// ---------------- controles ----------------
function lockPointer() { if (app.noLock || touch) return; try { const r = glc.requestPointerLock && glc.requestPointerLock(); if (r && r.catch) r.catch(() => { app.noLock = true; }); } catch (e) { app.noLock = true; } }
function releaseInput() { const s = P.sess; if (!s) return; Object.assign(s.input, { mx: 0, mz: 0, fire: false, aim: false, sprint: false, use: false }); for (const k in app.keys) app.keys[k] = false; }
const playing = () => P.sess && app.screen === 'game';
function keyState() { const s = P.sess; if (!s) return; const K = app.keys, I = s.input; I.mz = (K.KeyW || K.ArrowUp ? 1 : 0) - (K.KeyS || K.ArrowDown ? 1 : 0); I.mx = (K.KeyD || K.ArrowRight ? 1 : 0) - (K.KeyA || K.ArrowLeft ? 1 : 0); I.sprint = !!(K.ShiftLeft || K.ShiftRight); I.crouch = !!(K.KeyC || K.ControlLeft); I.use = !!K.KeyE; }
window.addEventListener('keydown', e => { if (!playing() || e.target.tagName === 'INPUT') { if (e.code === 'Escape' && app.screen === 'pause') resume(); return; } const I = P.sess.input;
  if (e.code === 'Tab') { app.view.board = true; e.preventDefault(); } if (e.code === 'Escape' || e.code === 'KeyP') { pauseScreen(); return; } if (e.code === 'Space') { I.jump = true; e.preventDefault(); } if (e.code === 'KeyR') I.reload = true;
  if (e.code === 'KeyQ' || (e.code === 'Digit1' && P.sess.me.cur !== 'rifle') || (e.code === 'Digit2' && P.sess.me.cur !== 'pistol')) I.swap = true; if (e.code.startsWith('Arrow')) e.preventDefault(); app.keys[e.code] = true; keyState(); });
window.addEventListener('keyup', e => { if (e.code === 'Tab') app.view.board = false; app.keys[e.code] = false; keyState(); });
window.addEventListener('blur', () => { releaseInput(); });
let drag = false;
glc.addEventListener('mousedown', e => { if (!playing() || touch) return; if (!document.pointerLockElement && !app.noLock) { lockPointer(); return; } const I = P.sess.input; if (e.button === 0) I.fire = true; if (e.button === 2) I.aim = true; drag = true; });
window.addEventListener('mouseup', e => { const s = P.sess; if (!s) return; if (e.button === 0) s.input.fire = false; if (e.button === 2) s.input.aim = false; drag = false; });
glc.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('mousemove', e => { if (!playing() || touch) return; if (document.pointerLockElement === glc || (app.noLock && drag)) { const I = P.sess.input, k = 0.0022 * cfg.sens * (I.aim ? 0.6 : 1); I.dx += e.movementX * k; I.dy += e.movementY * k; } });
document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && playing() && !touch && !app.noLock) pauseScreen(); });
document.addEventListener('pointerlockerror', () => { app.noLock = true; });
document.addEventListener('visibilitychange', () => { if (document.hidden && playing()) pauseScreen(); });
// toque: joystick fixo, mira arrastando, botões posicionados pelo layout do HUD
const TB = [['fire', 'ATIRAR', 96], ['aim', 'MIRA', 60], ['jump', 'PULAR', 60], ['crouch', 'AGACHAR', 60], ['reload', 'RECARR.', 60], ['swap', 'TROCAR', 60], ['use', 'INTERAGIR', 60]];
touchLayer.innerHTML = `<div class="joy" data-b="joy"><div class="knob"></div></div><button class="tpause" data-b="pause" aria-label="Pausar">II</button>` + TB.map(([b, l]) => `<div class="tb" data-b="${b}">${l}</div>`).join('');
const TEL = {}; touchLayer.querySelectorAll('[data-b]').forEach(el => TEL[el.dataset.b] = el);
function layoutTouch() { const L = app.layout, v = app.view; if (!v || !L.joy) return;
  const put = (k, d) => { const el = TEL[k], o = L[k]; if (!el || !o) return; const sz = d * o.s; el.style.width = el.style.height = sz + 'px'; el.style.left = Math.max(4, Math.min(v.W - sz - 4, o.x * v.W - sz / 2)) + 'px'; el.style.top = Math.max(4, Math.min(v.H - sz - 4, o.y * v.H - sz / 2)) + 'px'; el.style.opacity = o.a; };
  put('joy', 130); for (const [k, , d] of TB) put(k, d); }
const T = new Map();
touchLayer.addEventListener('touchstart', e => { e.preventDefault(); if (!playing()) return; const I = P.sess.input;
  for (const t of e.changedTouches) { const el = document.elementFromPoint(t.clientX, t.clientY), b = el && el.closest && el.closest('[data-b]'), k = b && b.dataset.b;
    if (k === 'pause') { pauseScreen(); continue; }
    if (k === 'joy' || (!k && t.clientX < app.view.W * 0.4)) { const r = TEL.joy.getBoundingClientRect(); T.set(t.identifier, { kind: 'joy', ox: r.left + r.width / 2, oy: r.top + r.height / 2, R: r.width / 2 }); moveJoy(T.get(t.identifier), t, I); continue; }
    if (k === 'fire') { I.fire = true; TEL.fire.classList.add('on'); T.set(t.identifier, { kind: 'look', x: t.clientX, y: t.clientY, fire: true }); continue; }
    if (k === 'use') { I.use = true; TEL.use.classList.add('on'); T.set(t.identifier, { kind: 'use' }); continue; }
    if (k === 'aim') { I.aim = !I.aim; TEL.aim.classList.toggle('on', I.aim); continue; }
    if (k === 'crouch') { I.crouch = !I.crouch; TEL.crouch.classList.toggle('on', I.crouch); continue; }
    if (k === 'jump') { I.jump = true; continue; } if (k === 'reload') { I.reload = true; continue; } if (k === 'swap') { I.swap = true; continue; }
    T.set(t.identifier, { kind: 'look', x: t.clientX, y: t.clientY }); } }, { passive: false });
function moveJoy(st, t, I) { let dx = (t.clientX - st.ox) / st.R, dy = (t.clientY - st.oy) / st.R; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; } I.mx = dx; I.mz = -dy; I.sprint = l > 1.25 && -dy > 0.6; TEL.joy.firstChild.style.transform = `translate(${dx * 35}px,${dy * 35}px)`; }
touchLayer.addEventListener('touchmove', e => { e.preventDefault(); if (!P.sess) return; const I = P.sess.input; for (const t of e.changedTouches) { const st = T.get(t.identifier); if (!st) continue;
  if (st.kind === 'joy') moveJoy(st, t, I); else if (st.kind === 'look') { const k = 0.0058 * cfg.sens * (I.aim ? 0.55 : 1); I.dx += (t.clientX - st.x) * k; I.dy += (t.clientY - st.y) * k; st.x = t.clientX; st.y = t.clientY; } } }, { passive: false });
const tend = e => { if (!P.sess) return; const I = P.sess.input; for (const t of e.changedTouches) { const st = T.get(t.identifier); if (!st) continue; if (st.kind === 'joy') { I.mx = I.mz = 0; I.sprint = false; TEL.joy.firstChild.style.transform = ''; } if (st.fire) { I.fire = false; TEL.fire.classList.remove('on'); } if (st.kind === 'use') { I.use = false; TEL.use.classList.remove('on'); } T.delete(t.identifier); } };
touchLayer.addEventListener('touchend', tend); touchLayer.addEventListener('touchcancel', tend);

// ---------------- editor de HUD ----------------
const SIZES = { score: [300, 40], radar: [124, 124], feed: [220, 70], alerts: [300, 40], health: [144, 30], ammo: [200, 34], joy: [130, 130], fire: [96, 96], aim: [60, 60], jump: [60, 60], crouch: [60, 60], reload: [60, 60], swap: [60, 60], use: [60, 60] };
function openEditor(done) {
  const s = P.sess; if (s) s.editing = true; app.screen = 'editor'; touchLayer.style.visibility = 'hidden';
  const L = JSON.parse(JSON.stringify(app.layout)); let sel = null;
  show(`<div class="editor"><div class="ebar"><b>Editar HUD</b><span class="note">Arraste os elementos. Toque em um para mudar tamanho e transparência.</span>
    <div class="ectl"><label>Tamanho <input id="esz" type="range" min="0.5" max="1.8" step="0.05" disabled></label><label>Transparência <input id="eal" type="range" min="0.2" max="1" step="0.05" disabled></label></div>
    <div class="row"><button class="btn ghost" id="erst">Restaurar padrão</button><button class="btn ghost" id="ecn">Cancelar</button><button class="btn red" id="esv">Salvar</button></div></div><div class="eboxes"></div></div>`, 'm-editor');
  const boxes = $('.eboxes'), V = app.view;
  const draw = () => { boxes.innerHTML = Object.keys(L).map(k => { const [w, h] = SIZES[k] || [80, 40], o = L[k]; return `<div class="ebox ${sel === k ? 'sel' : ''}" data-k="${k}" style="left:${o.x * V.W - w * o.s / 2}px;top:${o.y * V.H - h * o.s / 2}px;width:${w * o.s}px;height:${h * o.s}px;opacity:${0.35 + o.a * 0.65}">${esc(o.label || k)}</div>`; }).join(''); };
  draw();
  const sz = $('#esz'), al = $('#eal');
  const pick = k => { sel = k; sz.disabled = al.disabled = false; sz.value = L[k].s; al.value = L[k].a; draw(); };
  sz.oninput = () => { if (sel) { L[sel].s = +sz.value; draw(); app.layout = L; } }; al.oninput = () => { if (sel) { L[sel].a = +al.value; draw(); app.layout = L; } };
  let dragK = null, off = null;
  boxes.addEventListener('pointerdown', e => { const b = e.target.closest('.ebox'); if (!b) return; e.preventDefault(); pick(b.dataset.k); dragK = b.dataset.k; off = [e.clientX - L[dragK].x * V.W, e.clientY - L[dragK].y * V.H]; boxes.setPointerCapture(e.pointerId); });
  boxes.addEventListener('pointermove', e => { if (!dragK) return; L[dragK].x = HUD.clampV((e.clientX - off[0]) / V.W); L[dragK].y = HUD.clampV((e.clientY - off[1]) / V.H); app.layout = L; draw(); });
  boxes.addEventListener('pointerup', () => { dragK = null; });
  const prev = JSON.parse(JSON.stringify(app.layout_saved || HUD.load(touch)));
  const close = () => { if (s) s.editing = false; touchLayer.style.visibility = ''; layoutTouch(); (done || menu)(); };
  $('#esv').onclick = () => { app.layout = L; HUD.save(touch, L); app.layout_saved = L; toast('HUD salvo.'); close(); };
  $('#ecn').onclick = () => { app.layout = HUD.load(touch); close(); };
  $('#erst').onclick = () => { const d = HUD.reset(touch); for (const k in d) L[k] = d[k]; app.layout = L; sel = null; draw(); };
}

// ---------------- laço principal ----------------
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, Math.max(0, (now - app.last) / 1000)); app.last = now;
  app.fpsN++; app.fpsT += dt; if (app.fpsT > 1) { app.fps = app.fpsN / app.fpsT; app.fpsN = 0; app.fpsT = 0; }
  if (!P.R) return;
  const v = app.view; v.layout = app.layout; v.showFps = cfg.showFps; v.fps = app.fps;
  if (P.sess) P.frame(dt, v);
  else { P.renderScene(P.menuCamera(now / 1000), glc.width / glc.height); hctx.setTransform(1, 0, 0, 1, 0, 0); hctx.clearRect(0, 0, hud.width, hud.height); }
}
function boot() {
  resize();
  setTimeout(() => {
    try { P.initRenderer(glc); resize(); } catch (e) { console.error(e); }
    $('#loading').remove(); menu(); requestAnimationFrame(loop);
    // convite: /sala/CODIGO ou ?sala=CODIGO
    const m = location.pathname.match(/\/sala\/([A-Za-z0-9]{4,8})/) || location.search.match(/[?&]sala=([A-Za-z0-9]{4,8})/);
    if (m && ONLINE) needName(() => connect(() => joinRoom(m[1].toUpperCase())));
    else if (m) toast('Convites de sala só funcionam no endereço publicado do jogo.', true);
  }, 30);
}
app.debug = { P, startOffline, menu, settingsScreen, openEditor, pauseScreen, cfg, stats, get layout() { return app.layout; } };
boot();
})();
