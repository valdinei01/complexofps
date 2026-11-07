/* Complexo do Escadão 3D — menu, salas online, lobby, configurações, estatísticas, controles e editor de HUD. */
(function () {
'use strict';
const S = window.EscSim, P = window.EscPlay, HUD = window.EscHUD;
const $ = (q, el) => (el || document).querySelector(q);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const VERSION = '2.4.0';
const store = { get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
const cfg = P.cfg = Object.assign({ name: '', quality: 'medio', sens: 1, volume: 0.8, diff: 'normal', team: 0, showFps: false, opTop: 0.65, opCtl: 0.6, muted: false, aimAssist: true }, store.get('escadao3d-cfg', {}));
const saveCfg = () => store.set('escadao3d-cfg', cfg);
const stats = Object.assign({ partidas: 0, vitorias: 0, derrotas: 0, abates: 0, mortes: 0, capturas: 0, civis: 0, online: 0 }, store.get('escadao3d-stats', {}));
let key = store.get('escadao3d-key', null); if (!key) { key = 'k' + Math.random().toString(36).slice(2) + Date.now().toString(36); store.set('escadao3d-key', key); }
const touch = P.touch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0 && matchMedia('(pointer:coarse)').matches);
const ONLINE = typeof window.io === 'function';
const app = { screen: null, socket: null, room: null, lobby: null, layout: null, keys: {}, last: performance.now(), fps: 60, fpsN: 0, fpsT: 0 };
window.EscApp = app;

// ---------------- elementos base ----------------
const root = $('#app'), glc = $('#gl'), hud = $('#hud'), ui = $('#ui'), touchLayer = $('#touch');
const hctx = hud.getContext('2d');
P.audio = window.EscAudio(); P.audio.setVolume(cfg.volume); P.audio.setMuted(!!cfg.muted);
P.audio.load({ rifle: window.ESC_AUDIO ? window.ESC_AUDIO.rifle : '/audio/fuzil.mp3', pistol: window.ESC_AUDIO ? window.ESC_AUDIO.pistol : '/audio/pistola.mp3' });
P.audio.loadAmbient(window.ESC_AUDIO && window.ESC_AUDIO.amb ? window.ESC_AUDIO.amb : [1, 2, 3, 4].map(k => '/audio/ambiente/tiroteio_' + k + '.mp3'));
const portrait = () => root.clientHeight > root.clientWidth;
// margens de segurança do aparelho (entalhe, barra de gestos), lidas do CSS env()
function insets() { const pr = document.getElementById('safeProbe'); if (!pr) return { t: 0, r: 0, b: 0, l: 0 }; const cs = getComputedStyle(pr); return { t: parseFloat(cs.paddingTop) || 0, r: parseFloat(cs.paddingRight) || 0, b: parseFloat(cs.paddingBottom) || 0, l: parseFloat(cs.paddingLeft) || 0 }; }
function resize() {
  const q = P.quality(), dpr = Math.min(window.devicePixelRatio || 1, q.scale >= 1 ? 1.5 : 1) * Math.min(1, q.scale), w = root.clientWidth, h = root.clientHeight;
  glc.width = Math.max(1, Math.round(w * dpr)); glc.height = Math.max(1, Math.round(h * dpr)); if (P.R) P.R.gl.viewport(0, 0, glc.width, glc.height);
  const hs = Math.min(window.devicePixelRatio || 1, 2); hud.width = Math.round(w * hs); hud.height = Math.round(h * hs); const por = h > w; if (!app.layout || app.portrait !== por) { app.portrait = por; if (!app.editing) app.layout = HUD.load(touch, por); }
  app.view = Object.assign(app.view || {}, { W: w, H: h, hs, hctx, area: HUD.area(w, h, insets()), op: { top: cfg.opTop, ctl: cfg.opCtl } }); layoutTouch();
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
    <label>Dificuldade dos bots</label><div class="seg" data-k="diff"><button data-v="facil">Fácil</button><button data-v="normal">Normal</button><button data-v="dificil">Difícil</button><button data-v="elite">Muito difícil</button></div></div></div>`, 'm-panel');
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
    <li><b>Relevo de volta, suave e moderado</b>: morros arredondados (no máximo ~5 m), chão contínuo sem degraus em bloco e texturas de chão mais lisas.</li>
    <li><b>Mais construções 3D</b>: os seis modelos enviados agora substituem cerca de 45 casas geradas, com três níveis de detalhe.</li>
    <li><b>Som ambiente de tiroteio</b>: quando outros jogadores trocam tiros perto de você, as gravações completas de tiroteio tocam na direção do confronto.</li>
    <li><b>Assistência de mira leve</b> (pode desligar em Configurações).</li>
    <li>Aviso ao tentar atirar sem munição: volte à base para recarregar.</li>
    <li>Bots focados em dominar as bases e nova dificuldade <b>Muito difícil</b>.</li>
    <li>Ruas e becos mais largos; continua sem nenhum beco sem saída.</li></ul>
    <h4>Versão 2.3.0</h4><ul>
    <li><b>Terreno plano</b>: o relevo foi retirado do mapa inteiro. Só o escadão, as lajes, a arquibancada e o palco têm altura.</li>
    <li><b>Casas organizadas em quadras</b>, com lotes regulares e ruas retas nas duas favelas.</li>
    <li><b>Nenhum beco sem saída</b>: toda rua e todo beco terminam em outra rua, numa praça ou na mata. O escadão agora desce do outro lado do Alto.</li>
    <li>Mata densa bloqueia a visão de longe (não as balas).</li></ul>
    <h4>Versão 2.2.0</h4><ul>
    <li><b>Mapa reconstruído</b> a partir do mapa oficial: Base Azul no Alto da Mata, Base A na clareira, Mata Central com trilhas, Avenida das Américas (uma faixa por sentido) e o canal com pontes, Favela do Escadão (Vila da Serra, Alto do Escadão, Praça Central, Beco da Mina), Favela do Valão (Vila do Valão, Quadra do Baile, Vila Nova, Lajes do Topo) e a passagem de baixo.</li>
    <li><b>Construções 3D</b> novas espalhadas pelas duas favelas (seis modelos detalhados).</li>
    <li><b>Dia e noite</b>: ciclo de 20 minutos com manhã, meio-dia, tarde, pôr do sol, noite com lua e estrelas, postes, janelas e refletores da quadra acendendo sozinhos.</li>
    <li><b>Granadas</b>: 2 por vida (recarregam na estação da base), botão próprio ou tecla G.</li>
    <li>Traçantes mais visíveis à noite. Bots menos precisos.</li>
    <li>HUD menor e mais transparente, controles no novo estilo e <b>editor de HUD</b> refeito.</li></ul>
    <h4>Versão 2.1.0</h4><ul>
    <li><b>Mapa 3x maior</b> (140 × 280 m) com uma <b>Zona Central</b> entre os times: Praça Central, Escadão no morro e Canal.</li>
    <li>Relevo variado: baixada plana perto da avenida e nas bases, o Morro do Escadão no meio e o Morro do Mirante em cada bairro.</li>
    <li>Ruas principais, secundárias e becos mais largos. Avenida das Américas com duas faixas e estacionamento de cada lado.</li>
    <li><b>Carros circulando</b> pela avenida nos dois sentidos. Eles param para pedestres e servem de cobertura.</li>
    <li>Nome do setor onde você está aparece embaixo do minimapa.</li>
    <li>Correções do servidor: salas não interferem mais umas nas outras, posição aceita em todo o mapa e reconexão após reinício do servidor.</li></ul>
    <h4>Versão 2.0.0</h4><ul>
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
    <label for="opt">Fundo do HUD superior (placar, minimapa)</label><input id="opt" type="range" min="0.2" max="1" step="0.05" value="${cfg.opTop}">
    <label for="opc">Fundo dos controles</label><input id="opc" type="range" min="0.2" max="1" step="0.05" value="${cfg.opCtl}">
    <label class="chk"><input type="checkbox" id="aa" ${cfg.aimAssist ? 'checked' : ''}> Assistência de mira (leve)</label>
    <label class="chk"><input type="checkbox" id="fps" ${cfg.showFps ? 'checked' : ''}> Mostrar quadros por segundo</label>
    <button class="btn" id="edit">Editar HUD</button></div>
    ${fromGame ? '<button class="btn red" id="close">Voltar à partida</button>' : ''}</div>`, 'm-panel');
  wireSeg(); wireBack();
  $('#nm').onchange = e => { cfg.name = e.target.value.trim().slice(0, 16); saveCfg(); };
  $('#sens').oninput = e => { cfg.sens = +e.target.value; saveCfg(); };
  $('#vol').oninput = e => { cfg.volume = +e.target.value; P.audio.setVolume(cfg.volume); saveCfg(); };
  $('#fps').onchange = e => { cfg.showFps = e.target.checked; saveCfg(); };
  $('#aa').onchange = e => { cfg.aimAssist = e.target.checked; saveCfg(); };
  $('#opt').oninput = e => { cfg.opTop = +e.target.value; saveCfg(); resize(); };
  $('#opc').oninput = e => { cfg.opCtl = +e.target.value; saveCfg(); resize(); };
  $('#edit').onclick = () => openEditor(fromGame ? () => pauseScreen() : settingsScreen);
  if (fromGame) $('#close').onclick = () => pauseScreen();
}

// ---------------- online ----------------
function connect(then) {
  if (!ONLINE) return toast('Servidor indisponível neste arquivo.', true);
  if (app.socket && app.socket.connected && app.helloOk) return then && then();
  if (!app.socket) {
    app.socket = window.io({ reconnection: true, reconnectionDelay: 800, reconnectionDelayMax: 4000, timeout: 20000 });
    const s = app.socket;
    s.on('connect', () => s.emit('hello', { key, name: cfg.name || 'Jogador' }, r => {
      app.helloOk = true;
      if (r && r.rejoined) { app.room = r.rejoined; if (r.state === 'lobby' && app.screen !== 'lobby') { if (P.sess) endGame(); lobbyScreen(); } }
      else if (app.room) { // o servidor reiniciou (ex.: nova versão no Render) e a sala deixou de existir
        app.room = null; app.lobby = null; if (P.sess) endGame(); toast('A conexão voltou, mas a sala não existe mais (o servidor foi reiniciado).', true); roomsScreen(); if (app.screen === 'rooms') s.emit('rooms:sub'); } if (app.pendingConnect) { const f = app.pendingConnect; app.pendingConnect = null; f(); } }));
    s.on('disconnect', () => { app.helloOk = false; });
    s.on('disconnect', () => { if (P.sess && P.sess.mode === 'online') toast('Conexão perdida. Tentando reconectar…', true); });
    s.on('connect_error', () => { if (!app.warnedConn) { app.warnedConn = true; toast('Não foi possível falar com o servidor. Tentando de novo…', true); } });
    s.on('connect', () => { app.warnedConn = false; if (app.screen === 'rooms') s.emit('rooms:sub'); });
    s.on('rooms:list', list => { app.rooms = list; if (app.screen === 'rooms') renderRoomList(); });
    s.on('lobby:state', st => { app.lobby = st; app.room = st.id; if (app.screen === 'lobby') renderLobby(); });
    s.on('lobby:back', () => { if (P.sess) endGame(); lobbyScreen(); });
    s.on('game:start', d => startOnline(d));
    s.on('room:closed', () => { app.room = null; app.lobby = null; if (P.sess) endGame(); toast('A sala foi encerrada.'); roomsScreen(); });
  }
  app.pendingConnect = then; if (app.socket.connected && app.helloOk && then) { app.pendingConnect = null; then(); }
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
    <label>Modo</label><div class="fixed">Dominação de Bases</div><label>Dificuldade dos bots</label><select id="df"><option value="facil">Fácil</option><option value="normal" selected>Normal</option><option value="dificil">Difícil</option><option value="elite">Muito difícil</option></select>
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
    <p class="note">Dominação de Bases · bots ${({ facil: 'fáceis', normal: 'normais', dificil: 'difíceis', elite: 'muito difíceis' })[L.diff]}${L.state === 'playing' ? ' · <b>partida em andamento</b>' : ''}</p>
    <div class="teams">${col(0)}${col(1)}</div>
    <div class="row wrap"><button class="btn" id="inv">Convidar amigos</button><button class="btn" id="sw">Trocar de time</button><button class="btn ${meP && meP.ready ? 'ok' : ''}" id="rd">${meP && meP.ready ? 'Pronto ✓' : 'Pronto'}</button>
    ${host ? `<select id="df"><option value="facil">Bots fáceis</option><option value="normal">Bots normais</option><option value="dificil">Bots difíceis</option><option value="elite">Bots muito difíceis</option></select><button class="btn red" id="st" ${L.state !== 'lobby' ? 'disabled' : ''}>Iniciar partida</button>` : '<span class="note">Aguardando o anfitrião iniciar.</span>'}</div>`;
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
function enterGame() { root.classList.add('ingame'); touchLayer.style.display = touch ? 'block' : 'none'; app.screen = 'game'; layoutTouch(); if (!touch) lockPointer(); P.audio.ensure(); }
function endGame() { P.endSession(); root.classList.remove('ingame'); touchLayer.style.display = 'none'; topBtns.style.display = 'none'; if (document.exitPointerLock && document.pointerLockElement) document.exitPointerLock(); hctx.setTransform(1, 0, 0, 1, 0, 0); hctx.clearRect(0, 0, hud.width, hud.height); }
function pauseScreen() {
  const s = P.sess; if (!s) return; s.paused = s.mode === 'offline'; app.screen = 'pause'; topBtns.style.display = 'none'; releaseInput(); if (document.exitPointerLock && document.pointerLockElement) document.exitPointerLock();
  show(`<div class="panel"><h2>Pausa</h2>${s.mode === 'online' ? '<p class="note">A partida online continua enquanto este menu está aberto.</p>' : ''}
    <button class="btn red" id="ct">Continuar</button><button class="btn" id="ed">Editar HUD</button><button class="btn" id="cf">Configurações</button><button class="btn ghost" id="ex">${s.mode === 'online' ? 'Sair da sala' : 'Sair para o menu'}</button>
    <p class="hint">${touch ? 'Esquerda: joystick. Direita: arraste para mirar. Botões de tiro, mira, pulo, agachar, recarregar, trocar arma e interagir.' : 'WASD anda · mouse mira · clique atira · botão direito mira · Shift corre · Espaço pula · C agacha · R recarrega · Q ou 1/2 troca arma · segure E na estação · Tab placar · Esc pausa'}</p></div>`, 'm-panel');
  $('#ct').onclick = resume; $('#ed').onclick = () => openEditor(pauseScreen); $('#cf').onclick = () => settingsScreen(true);
  $('#ex').onclick = () => { if (s.mode === 'online') { app.socket.emit('room:leave'); app.room = null; app.lobby = null; endGame(); roomsScreen(); } else { endGame(); menu(); } };
}
function resume() { const s = P.sess; if (!s) return; s.paused = false; app.screen = 'game'; show(''); layoutTouch(); if (!touch) lockPointer(); }
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
  if (e.code === 'Tab') { app.view.board = true; e.preventDefault(); } if (e.code === 'Escape' || e.code === 'KeyP') { pauseScreen(); return; } if (e.code === 'Space') { I.jump = true; e.preventDefault(); } if (e.code === 'KeyR') I.reload = true; if (e.code === 'KeyG') I.gren = true;
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
// ---------------- controles de toque (estilo da referência: botões escuros, ícones brancos, disparo vermelho) ----------------
const SVG = (d, vb) => `<svg viewBox="${vb || '0 0 24 24'}" aria-hidden="true">${d}</svg>`;
const IC = {
  fire: SVG('<path d="M3 17l3-1 9-9a3 3 0 014 0l1 1a3 3 0 010 4l-9 9-1 3-2-2-2 2-1-1 2-2z" fill="#fff" transform="rotate(0 12 12)"/><path d="M2 21l3-1M1 18l2-.5M4 23l.5-2" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/>'),
  aim: SVG('<circle cx="12" cy="12" r="7" fill="none" stroke="#fff" stroke-width="2"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5" stroke="#fff" stroke-width="2"/><circle cx="12" cy="12" r="1.6" fill="#fff"/>'),
  reload: SVG('<path d="M19 8A8 8 0 006 6.5L4 9M5 16a8 8 0 0013 1.5l2-2.5" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><path d="M3 4v5h5M21 20v-5h-5" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>'),
  crouch: SVG('<circle cx="10" cy="4.5" r="2.3" fill="#fff"/><path d="M8 8h4l1.5 4H20v2h-7.5L11 11l-1 4 3 2v5h-2.4v-3.6L6.5 16 7.5 9z" fill="#fff"/><path d="M13 9.5h8" stroke="#fff" stroke-width="1.6"/>'),
  sprint: SVG('<circle cx="15" cy="4" r="2.3" fill="#fff"/><path d="M8 9l4-2.5 3.5 1.5 2 3.5 3 1-.8 2-4-1.4-1.4-2-1.5 3.6 3 2.5-1.2 5.8h-2.3l1-4.7-3.4-2.4-2 3.6H3.5v-2.2h3.4L9.5 12l.5-2.3-1.2.8-1.6 2.5-1.8-1.1z" fill="#fff"/>'),
  jump: SVG('<path d="M12 3l6 7h-4v8h-4v-8H6z" fill="#fff"/><path d="M5 21h14" stroke="#fff" stroke-width="2" stroke-linecap="round"/>'),
  gren: SVG('<path d="M10 5h4v2.2a6 6 0 11-4 0z" fill="#fff"/><path d="M14 5.5l3-2.5 1.5 1.5-2.5 2.5" fill="none" stroke="#fff" stroke-width="1.6"/><path d="M9 12h6M9 15h6M12 10v8" stroke="#2b2b2b" stroke-width="1.1"/>'),
  swap: SVG('<path d="M4 8h13l-3-3M20 16H7l3 3" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>'),
  use: SVG('<path d="M8 11V5a1.5 1.5 0 013 0v5h.5V3.5a1.5 1.5 0 013 0V10h.5V5a1.5 1.5 0 013 0v8c0 4-2.5 7-6 7-2.5 0-4-1.2-5.4-3.3L4.5 13a1.6 1.6 0 012.6-1.8z" fill="#fff"/>'),
  pause: SVG('<rect x="6" y="5" width="4" height="14" rx="1" fill="#fff"/><rect x="14" y="5" width="4" height="14" rx="1" fill="#fff"/>'),
  sound: SVG('<path d="M4 9h4l5-4v14l-5-4H4z" fill="#fff"/><path d="M16 8.5a5 5 0 010 7M18.5 6a8.5 8.5 0 010 12" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/>'),
  mute: SVG('<path d="M4 9h4l5-4v14l-5-4H4z" fill="#fff"/><path d="M16 9l5 6M21 9l-5 6" stroke="#fff" stroke-width="2" stroke-linecap="round"/>'),
};
const BTN = ['fire', 'gren', 'aim', 'reload', 'crouch', 'sprint', 'jump', 'swap', 'use'];
touchLayer.innerHTML = `<div class="joy" data-b="joy"><div class="knob"></div></div>` + BTN.map(b => `<div class="tb tb-${b}" data-b="${b}" role="button" aria-label="${b}">${IC[b]}${b === 'gren' ? '<span class="badge">2</span>' : ''}${b === 'use' ? '<span class="lbl">REABASTECER</span>' : ''}</div>`).join('');
// pausa e som ficam visíveis também no computador
const topBtns = document.createElement('div'); topBtns.id = 'topbtns'; topBtns.innerHTML = `<button class="tb tb-pause" data-b="pause" aria-label="Pausar">${IC.pause}</button><button class="tb tb-sound" data-b="sound" aria-label="Som">${cfg.muted ? IC.mute : IC.sound}</button>`; root.appendChild(topBtns);
const TEL = {}; touchLayer.querySelectorAll('[data-b]').forEach(el => TEL[el.dataset.b] = el); topBtns.querySelectorAll('[data-b]').forEach(el => TEL[el.dataset.b] = el);
TEL.pause.addEventListener('click', () => { if (playing()) pauseScreen(); });
TEL.sound.addEventListener('click', () => { cfg.muted = !cfg.muted; P.audio.setMuted(cfg.muted); saveCfg(); TEL.sound.innerHTML = cfg.muted ? IC.mute : IC.sound; });
const elemRect = id => { const v = app.view; return HUD.place(app.layout, id, v.area); };
function layoutTouch() { const L = app.layout, v = app.view; if (!v || !L) return;
  document.documentElement.style.setProperty('--ctl-bg', `rgba(14,14,16,${cfg.opCtl})`); document.documentElement.style.setProperty('--top-bg', `rgba(14,14,16,${cfg.opTop})`);
  const put = k => { const el = TEL[k]; if (!el || !L[k]) return; const r = elemRect(k), sz = Math.round(r.w); el.style.width = sz + 'px'; el.style.height = Math.round(r.h) + 'px'; el.style.left = Math.round(r.cx - r.w / 2) + 'px'; el.style.top = Math.round(r.cy - r.h / 2) + 'px'; el.style.opacity = L[k].a; };
  put('joy'); for (const b of BTN) put(b); put('pause'); put('sound'); topBtns.style.display = P.sess && app.screen === 'game' || app.editing ? '' : 'none'; }
const T = new Map();
const hitBtn = (x, y) => { let best = null; for (const k of ['joy', ...BTN]) { const el = TEL[k]; if (!el || el.style.display === 'none' || el.classList.contains('off')) continue; const r = el.getBoundingClientRect(), pad = k === 'joy' ? 30 : 6; if (x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad) { const a = r.width * r.height; if (!best || a < best.a) best = { k, a }; } } return best && best.k; };
touchLayer.addEventListener('touchstart', e => { e.preventDefault(); if (!playing()) return; const I = P.sess.input;
  for (const t of e.changedTouches) { const k = hitBtn(t.clientX, t.clientY);
    if (k === 'joy' || (!k && t.clientX < app.view.W * 0.4)) { const r = TEL.joy.getBoundingClientRect(); T.set(t.identifier, { kind: 'joy', ox: r.left + r.width / 2, oy: r.top + r.height / 2, R: r.width / 2 }); moveJoy(T.get(t.identifier), t, I); continue; }
    if (k) TEL[k].classList.add('down');
    if (k === 'fire') { I.fire = true; T.set(t.identifier, { kind: 'look', x: t.clientX, y: t.clientY, btn: k, fire: true }); continue; }
    if (k === 'use') { I.use = true; T.set(t.identifier, { kind: 'use', btn: k }); continue; }
    if (k === 'aim') { I.aim = !I.aim; TEL.aim.classList.toggle('on', I.aim); }
    if (k === 'crouch') { I.crouch = !I.crouch; TEL.crouch.classList.toggle('on', I.crouch); }
    if (k === 'sprint') { app.sprintLock = !app.sprintLock; TEL.sprint.classList.toggle('on', app.sprintLock); }
    if (k === 'jump') I.jump = true; if (k === 'reload') I.reload = true; if (k === 'swap') I.swap = true; if (k === 'gren') I.gren = true;
    T.set(t.identifier, { kind: k ? 'tap' : 'look', x: t.clientX, y: t.clientY, btn: k }); } }, { passive: false });
function moveJoy(st, t, I) { let dx = (t.clientX - st.ox) / st.R, dy = (t.clientY - st.oy) / st.R; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; } I.mx = dx; I.mz = -dy; I.sprint = (l > 1.25 && -dy > 0.6) || (app.sprintLock && -dy > 0.3); TEL.joy.firstChild.style.transform = `translate(${dx * 35}%,${dy * 35}%)`; }
touchLayer.addEventListener('touchmove', e => { e.preventDefault(); if (!P.sess) return; const I = P.sess.input; for (const t of e.changedTouches) { const st = T.get(t.identifier); if (!st) continue;
  if (st.kind === 'joy') moveJoy(st, t, I); else if (st.kind === 'look' || st.kind === 'tap') { const k = 0.0058 * cfg.sens * (I.aim ? 0.55 : 1); I.dx += (t.clientX - st.x) * k; I.dy += (t.clientY - st.y) * k; st.x = t.clientX; st.y = t.clientY; } } }, { passive: false });
const tend = e => { if (!P.sess) return; const I = P.sess.input; for (const t of e.changedTouches) { const st = T.get(t.identifier); if (!st) continue; if (st.kind === 'joy') { I.mx = I.mz = 0; I.sprint = false; TEL.joy.firstChild.style.transform = ''; } if (st.fire) I.fire = false; if (st.kind === 'use') I.use = false; if (st.btn) TEL[st.btn].classList.remove('down'); T.delete(t.identifier); } };
touchLayer.addEventListener('touchend', tend); touchLayer.addEventListener('touchcancel', tend);
// atualiza contador de granadas e botão contextual de interação
function updateTouchState() { const s = P.sess; if (!s) return; const me = s.me, b = TEL.gren.querySelector('.badge'), n = String(me.gren == null ? 0 : me.gren); if (b.textContent !== n) b.textContent = n; TEL.gren.classList.toggle('empty', !+n);
  const near = !!s.nearStation; if (TEL.use.dataset.v !== String(near)) { TEL.use.dataset.v = String(near); TEL.use.style.display = near || app.editing ? '' : 'none'; } }

// ---------------- editor de HUD ----------------
// Modo exclusivo: mostra os controles reais, seleciona o elemento menor sob o dedo (sem pegar o vizinho),
// arrasta só depois de 6 px, mantém tudo dentro da área útil e a barra de ferramentas pequena, recolhível e fora do caminho.
function openEditor(done) {
  const s = P.sess; if (s) s.editing = true; app.editing = true; app.screen = 'editor';
  const por = app.portrait, L = JSON.parse(JSON.stringify(app.layout)); app.layout = L; let sel = null, collapsed = true;
  touchLayer.style.display = touch ? 'block' : 'none'; topBtns.style.display = ''; for (const k of BTN) if (TEL[k]) TEL[k].style.display = '';
  show(`<div class="editor"><div class="eboxes"></div>
    <div class="ebar" role="toolbar" aria-label="Editar HUD"><div class="ebar-row"><b class="etitle">Editar HUD</b><span class="esel">Toque num elemento</span><button class="ebtn" id="ecol" aria-label="Recolher">▾</button></div>
      <div class="ebar-body"><label>Tamanho <input id="esz" type="range" min="0.5" max="1.8" step="0.05" disabled></label><label>Opacidade <input id="eal" type="range" min="0.15" max="1" step="0.05" disabled></label>
      <div class="ebar-row"><button class="ebtn" id="erst">Restaurar padrão</button><button class="ebtn" id="ecn">Cancelar</button><button class="ebtn save" id="esv">Salvar</button></div></div></div></div>`, 'm-editor');
  const boxes = $('.eboxes'), bar = $('.ebar'), sz = $('#esz'), al = $('#eal'), selLbl = $('.esel');
  const ids = Object.keys(L).filter(k => touch || !['joy', ...BTN].includes(k));
  const draw = () => { layoutTouch(); boxes.innerHTML = ids.map(k => { const r = elemRect(k); return `<div class="ebox ${sel === k ? 'sel' : ''}" data-k="${k}" style="left:${r.cx - r.w / 2}px;top:${r.cy - r.h / 2}px;width:${r.w}px;height:${r.h}px"><span>${esc(L[k].label || k)}</span></div>`; }).join(''); placeBar(); };
  // a barra foge do elemento selecionado (vai para cima, ou para a lateral livre)
  // sem seleção: barra pequena no meio da tela (área livre, onde fica a mira); com seleção: vai para a metade oposta ao elemento
  function placeBar() { bar.classList.toggle('collapsed', collapsed); $('#ecol').textContent = collapsed ? '▴' : '▾';
    if (!sel) { bar.dataset.pos = 'mid'; return; } const r = elemRect(sel), H = app.view.H; bar.dataset.pos = r.cy > H * 0.5 ? 'top' : 'bottom'; }
  const pick = k => { sel = k; sz.disabled = al.disabled = !k; if (k) { sz.value = L[k].s; al.value = L[k].a; selLbl.textContent = L[k].label || k; collapsed = false; } else selLbl.textContent = 'Toque num elemento'; draw(); };
  sz.oninput = () => { if (sel) { L[sel].s = +sz.value; draw(); } }; al.oninput = () => { if (sel) { L[sel].a = +al.value; draw(); } };
  const smallestAt = (x, y) => { let best = null; for (const k of ids) { const r = elemRect(k); if (Math.abs(x - r.cx) <= r.w / 2 + 4 && Math.abs(y - r.cy) <= r.h / 2 + 4) { const a = r.w * r.h; if (!best || a < best.a) best = { k, a }; } } return best && best.k; };
  let drag = null;
  boxes.addEventListener('pointerdown', e => { const k = smallestAt(e.clientX, e.clientY); if (!k) { pick(null); return; } e.preventDefault(); pick(k); const r = elemRect(k); drag = { k, x0: e.clientX, y0: e.clientY, ox: e.clientX - r.cx, oy: e.clientY - r.cy, moving: false, id: e.pointerId }; try { boxes.setPointerCapture(e.pointerId); } catch (er) {} });
  boxes.addEventListener('pointermove', e => { if (!drag || e.pointerId !== drag.id) return; if (!drag.moving && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 6) return; drag.moving = true; const A = app.view.area;
    L[drag.k].x = HUD.clampV((e.clientX - drag.ox - A.x) / A.w); L[drag.k].y = HUD.clampV((e.clientY - drag.oy - A.y) / A.h); draw(); });
  const endDrag = e => { if (drag && e.pointerId === drag.id) { const r = elemRect(drag.k), A = app.view.area; L[drag.k].x = (r.cx - A.x) / A.w; L[drag.k].y = (r.cy - A.y) / A.h; drag = null; draw(); } };
  boxes.addEventListener('pointerup', endDrag); boxes.addEventListener('pointercancel', endDrag);
  $('#ecol').onclick = () => { collapsed = !collapsed; placeBar(); };
  const close = () => { app.editing = false; if (s) s.editing = false; touchLayer.style.display = touch && P.sess ? 'block' : 'none'; layoutTouch(); (done || menu)(); };
  $('#esv').onclick = () => { HUD.save(touch, por, L); app.layout = HUD.load(touch, por); toast('HUD salvo.'); close(); };
  $('#ecn').onclick = () => { app.layout = HUD.load(touch, por); close(); };
  $('#erst').onclick = () => { const d = HUD.reset(touch, por); for (const k in d) L[k] = d[k]; pick(null); };
  draw();
}

// ---------------- laço principal ----------------
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, Math.max(0, (now - app.last) / 1000)); app.last = now;
  app.fpsN++; app.fpsT += dt; if (app.fpsT > 1) { app.fps = app.fpsN / app.fpsT; app.fpsN = 0; app.fpsT = 0; }
  if (!P.R) return;
  const v = app.view; v.layout = app.layout; v.showFps = cfg.showFps; v.fps = app.fps; v.op = { top: cfg.opTop, ctl: cfg.opCtl };
  if (P.sess) { P.frame(dt, v); updateTouchState(); }
  else { P.applyEnv(0.735); P.renderScene(P.menuCamera(now / 1000), glc.width / glc.height); hctx.setTransform(1, 0, 0, 1, 0, 0); hctx.clearRect(0, 0, hud.width, hud.height); }
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
