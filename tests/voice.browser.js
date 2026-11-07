// Chat de voz por proximidade e som do baile: dois navegadores com microfone simulado + servidor de salas real (ponte que imita o Socket.IO).
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const { RoomManager } = require('../server/rooms.js');
const { MockIO } = require('./mockio.js');
const S = require('../shared/sim.js');
require('./static.js')(8125);
const io = new MockIO(); const rm = new RoomManager(io, { backDelay: 3000 });
const FAKE = `window.io = function () {
  const h = {}, s = { connected: true, id: 'x', on(e, f) { (h[e] = h[e] || []).push(f); return s; }, once(e, f) { const g = d => { s.off(e, g); f(d); }; return s.on(e, g); }, off(e, f) { h[e] = (h[e] || []).filter(x => x !== f); return s; },
    emit(e, d, cb) { window.__toServer(e, JSON.stringify(d === undefined ? null : d)).then(r => { if (cb) cb(r == null ? r : JSON.parse(r)); }); return s; } };
  window.__fromServer = (e, d) => { for (const f of (h[e] || []).slice()) f(d); };
  setTimeout(() => window.__fromServer('connect'), 10); return s; };`;
(async () => {
  const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
  const mk = async name => { const ctx = await browser.newContext({ viewport: { width: 700, height: 400 } }); await ctx.grantPermissions(['microphone'], { origin: 'http://localhost:8125' }); const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/fonts|ERR_NAME|404/.test(m.text())) errs.push(m.text()); });
    const client = io.connect(); let q = Promise.resolve(); client._recv = (ev, d) => { q = q.then(() => page.evaluate(([e, x]) => window.__fromServer && window.__fromServer(e, x), [ev, d]).catch(() => {})); };
    await page.exposeFunction('__toServer', (ev, json) => { const r = client.emit(ev, JSON.parse(json)); return r === undefined ? null : JSON.stringify(r); });
    await page.addInitScript(`localStorage.setItem('escadao3d-cfg', JSON.stringify({ name: '${name}', quality: 'baixo' }));` + FAKE); return { page, errs };
  };
  const A = await mk('Ana'), B = await mk('Beto'); let ok = true; const chk = (c, m) => { console.log((c ? 'OK  ' : 'FALHOU ') + m); if (!c) ok = false; };
  await A.page.goto('http://localhost:8125/'); await B.page.goto('http://localhost:8125/');
  await A.page.waitForSelector('.mbtns', { timeout: 120000 }); await B.page.waitForSelector('.mbtns', { timeout: 120000 });
  await A.page.click('[data-go=rooms]'); await A.page.waitForTimeout(500); await A.page.click('#create'); await A.page.fill('#b0', '0'); await A.page.fill('#b1', '0'); await A.page.$eval('.mcard #ok', b => b.click());
  await A.page.waitForSelector('#lob .teams', { timeout: 20000 }); const id = await A.page.evaluate(() => EscApp.lobby.id);
  await B.page.goto('http://localhost:8125/sala/' + id); await B.page.waitForSelector('#lob .teams', { timeout: 30000 }); await A.page.waitForTimeout(500); await A.page.$eval('#st', b => b.click()); await A.page.waitForFunction(() => EscPlay.sess && EscPlay.sess.me.alive, null, { timeout: 60000 }); await B.page.waitForFunction(() => EscPlay.sess && EscPlay.sess.me.alive, null, { timeout: 60000 });
  const room = [...rm.rooms.values()][0], [pa, pb] = [...room.players.values()], W = room.game.W, put = (a, x, z) => { const c = W.nearestOK(x, z, 4); a.x = W.cellX(c); a.z = W.cellZ(c); a.y = room.game.map.H[c]; };
  for (const [p, page, x] of [[pa, A.page, 62], [pb, B.page, 66]]) { put(p.actor, x, 32); p.correct = true; }
  await A.page.waitForTimeout(1500);
  const mic = await A.page.evaluate(async () => { await EscPlay.audio.ensure(); return EscPlay.voice.toggleMic(); }); await B.page.evaluate(() => EscPlay.audio.ensure());
  chk(mic.on === true, 'Ana ligou o microfone');
  await A.page.waitForTimeout(6000);
  const near = await B.page.evaluate(async id => { const pr = EscPlay.voice.peers.get(id); if (!pr) return null; let lv = 0; for (let k = 0; k < 40; k++) { if (pr.node) lv = Math.max(lv, pr.node.level()); await new Promise(r => setTimeout(r, 60)); } return { st: pr.pc.connectionState, node: !!pr.node, g: pr.g, lv, talking: EscPlay.voice.isTalking(id) }; }, pa.actor.id);
  console.log('     Beto recebendo a Ana (perto):', JSON.stringify(near));
  chk(near && near.st === 'connected' && near.node, 'conexão de voz estabelecida'); chk(near && near.g > 0.8, 'perto (4 m): volume alto'); chk(near && near.lv > 0.01, 'áudio chegando (nível ' + (near ? near.lv.toFixed(3) : 0) + ')');
  put(pa.actor, 64, 10); put(pb.actor, 64, 120 > 60 ? 60 : 60); pa.correct = pb.correct = true; await A.page.waitForTimeout(1500);
  const far = await B.page.evaluate(id => { const pr = EscPlay.voice.peers.get(id); return pr ? pr.g : -1; }, pa.actor.id);
  chk(far === 0, 'longe (50 m): voz não é ouvida (volume ' + far + ')');
  // baile: Ana vai até a mesa de som e liga
  put(pa.actor, S.SOUND_DESK.x, S.SOUND_DESK.z); pa.correct = true; await A.page.waitForTimeout(800);
  const desk = await A.page.evaluate(() => EscPlay.sess.nearDesk); chk(desk, 'Ana perto da mesa de som (aviso aparece)');
  await A.page.evaluate(() => { EscPlay.sess.input.use = true; }); await A.page.waitForTimeout(600); await A.page.evaluate(() => { EscPlay.sess.input.use = false; }); await A.page.waitForTimeout(2500);
  chk(room.game.baile.on, 'servidor: som do baile ligado');
  const bA = await A.page.evaluate(() => ({ on: EscPlay.sess.baile && EscPlay.sess.baile.on, tocando: EscPlay.audio.baileOn })), bB = await B.page.evaluate(() => ({ on: EscPlay.sess.baile && EscPlay.sess.baile.on, tocando: EscPlay.audio.baileOn }));
  chk(bA.on && bA.tocando && bB.on && bB.tocando, 'os dois clientes tocando a música (o volume depende da distância até o palco)');
  console.log('erros Ana:', A.errs.join(' | ') || 'nenhum', '| erros Beto:', B.errs.join(' | ') || 'nenhum');
  rm.stop && rm.stop(); await browser.close(); process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
