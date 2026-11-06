// Dois clientes reais (navegador) + servidor de salas real, ligados por uma ponte que imita o Socket.IO.
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const { RoomManager } = require('../server/rooms.js');
const { MockIO } = require('./mockio.js');
require('./static.js')(8124);
const io = new MockIO(); const rm = new RoomManager(io, { backDelay: 3000 });
const FAKE = `window.io = function () {
  const h = {}, s = { connected: true, id: 'x', on(e, f) { (h[e] = h[e] || []).push(f); return s; }, once(e, f) { const g = d => { s.off(e, g); f(d); }; return s.on(e, g); }, off(e, f) { h[e] = (h[e] || []).filter(x => x !== f); return s; },
    emit(e, d, cb) { window.__toServer(e, JSON.stringify(d === undefined ? null : d)).then(r => { if (cb) cb(r == null ? r : JSON.parse(r)); }); return s; } };
  window.__fromServer = (e, d) => { for (const f of (h[e] || []).slice()) f(d); };
  setTimeout(() => window.__fromServer('connect'), 10); return s; };`;
(async () => {
  const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const mk = async (name, w, h, mobile) => {
    const ctx = await browser.newContext(mobile ? { viewport: { width: w, height: h }, isMobile: true, hasTouch: true } : { viewport: { width: w, height: h } }); const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/fonts|ERR_NAME|404/.test(m.text())) errs.push(m.text()); });
    const client = io.connect(); let q = Promise.resolve();
    client._recv = (ev, d) => { q = q.then(() => page.evaluate(([e, x]) => window.__fromServer && window.__fromServer(e, x), [ev, d]).catch(() => {})); };
    await page.exposeFunction('__toServer', (ev, json) => { const r = client.emit(ev, JSON.parse(json)); return r === undefined ? null : JSON.stringify(r); });
    await page.addInitScript(`localStorage.setItem('escadao3d-cfg', JSON.stringify({ name: '${name}', quality: 'baixo' }));` + FAKE);
    return { page, errs, client };
  };
  const A = await mk('Ana', 760, 430), B = await mk('Beto', 390, 760, true);
  await A.page.goto('http://localhost:8124/'); await B.page.goto('http://localhost:8124/sala/XXXX');
  await A.page.waitForSelector('.mbtns', { timeout: 60000 }); await B.page.waitForFunction(() => !!document.querySelector('.toast'), null, { timeout: 30000 }).catch(() => {});
  console.log('B ao abrir convite inválido:', await B.page.evaluate(() => (document.querySelector('.toast') || {}).textContent || ('sem aviso; tela=' + EscApp.screen + ' hello=' + EscApp.helloOk + ' socket=' + !!EscApp.socket)));
  // Ana cria sala privada
  await A.page.click('[data-go=rooms]'); await A.page.waitForTimeout(500); await A.page.click('#create'); await A.page.fill('#rp', 'laje'); await A.page.fill('#b0', '3'); await A.page.fill('#b1', '4'); await A.page.click('.mcard #ok');
  await A.page.waitForSelector('#lob .teams', { timeout: 20000 }); const code = await A.page.evaluate(() => EscApp.lobby.id); console.log('sala criada:', code);
  // Beto entra pelo link de convite com senha errada e depois certa
  await B.page.goto('http://localhost:8124/sala/' + code); await B.page.waitForSelector('#pw', { timeout: 30000 }); await B.page.fill('#pw', 'errada'); await B.page.click('.mcard #ok');
  await B.page.waitForSelector('.mcard .err', { timeout: 20000 }); console.log('senha errada recusada: sim'); await B.page.fill('#pw', 'laje'); await B.page.click('.mcard #ok');
  await B.page.waitForSelector('#lob .teams', { timeout: 20000 }); await A.page.waitForTimeout(500);
  console.log('lobby visto pela Ana:', await A.page.evaluate(() => EscApp.lobby.players.map(p => p.name + '/' + p.team + (p.host ? '*' : '')).join(' ') + ' bots ' + JSON.stringify(EscApp.lobby.bots)));
  await A.page.screenshot({ path: 'tests/shots/on_lobbyA.png', timeout: 120000 }); await B.page.screenshot({ path: 'tests/shots/on_lobbyB.png', timeout: 120000 });
  console.log('Beto vê botão iniciar?', await B.page.evaluate(() => !!document.querySelector('#st')));
  await A.page.click('#st'); await A.page.waitForFunction(() => EscPlay.sess && EscPlay.sess.me.alive, null, { timeout: 30000 }); await B.page.waitForFunction(() => EscPlay.sess && EscPlay.sess.me.alive, null, { timeout: 30000 });
  await A.page.waitForTimeout(2000);
  const room = rm.rooms.get(code), G = room.game; console.log('partida no servidor:', G.actors.length, 'atores (', G.actors.filter(a => !a.isBot).map(a => a.name).join(', '), ')', G.npcs.length, 'civis');
  // Ana anda para frente 2 s; posição chega ao servidor
  const before = await A.page.evaluate(() => [EscPlay.sess.me.x, EscPlay.sess.me.z]);
  await A.page.evaluate(() => { EscPlay.sess.input.mz = 1; }); await A.page.waitForTimeout(2500); console.log('estado:', await A.page.evaluate(() => { const s = EscPlay.sess, m = s.me; return JSON.stringify({ paused: s.paused, over: s.over, edit: s.editing, alive: m.alive, placed: m.placed, spd: m.spd, y: m.y, ground: EscPlay.world.W.groundAt(m.x, m.z, 0.3), fits: EscPlay.world.W.fits(m.x, m.z + 0.2, m.y, 0.3), dyn: EscPlay.world.W.dyn.length, screen: EscApp.screen }); })); await A.page.evaluate(() => { EscPlay.sess.input.mz = 0; }); await A.page.waitForTimeout(600);
  const after = await A.page.evaluate(() => [EscPlay.sess.me.x, EscPlay.sess.me.z]); const sv = G.actors.find(a => a.key === room.players.get([...room.players.keys()][0]).key);
  { const pa = [...room.players.values()].find(q => q.name === 'Ana'); console.log('rejeições:', pa.rejects || 0, JSON.stringify(pa.lastReject || {})); }
  console.log('Ana andou (cliente):', Math.hypot(after[0] - before[0], after[1] - before[1]).toFixed(2), 'm | servidor:', sv.x.toFixed(2), sv.z.toFixed(2), ' cliente:', after.map(v => v.toFixed(2)).join(' '));
  // Beto enxerga a Ana? (outros atores interpolados)
  console.log('Beto recebe atores:', await B.page.evaluate(() => EscPlay.sess.actors.size), 'civis:', await B.page.evaluate(() => EscPlay.sess.npcs.size));
  // Ana atira: munição cai no servidor e volta ao cliente
  await A.page.evaluate(() => { EscPlay.sess.input.fire = true; }); await A.page.waitForTimeout(1500); await A.page.evaluate(() => { EscPlay.sess.input.fire = false; }); await A.page.waitForTimeout(800);
  console.log('munição da Ana (servidor):', JSON.stringify(sv.ammo.rifle), '| cliente:', await A.page.evaluate(() => JSON.stringify(EscPlay.sess.me.ammo.rifle)));
  await A.page.screenshot({ path: 'tests/shots/on_gameA.png', timeout: 120000 }); await B.page.screenshot({ path: 'tests/shots/on_gameB.png', timeout: 120000 });
  // Beto desconecta e volta
  const bKey = [...room.players.values()].find(p => p.name === 'Beto').key; B.client.disconnect(); await A.page.waitForTimeout(500);
  console.log('Beto conectado após cair?', room.players.get(bKey).connected);
  // forçar fim da partida
  G.score[0] = 99.95; G.bases[0].owner = 0; G.bases[0].prog = -1; await A.page.waitForSelector('.final', { timeout: 30000 });
  console.log('resultado na Ana:', await A.page.evaluate(() => document.querySelector('.panel h2').textContent + ' | ' + document.querySelector('.final').textContent));
  await A.page.screenshot({ path: 'tests/shots/on_result.png', timeout: 120000 });
  await A.page.click('#lb'); await A.page.waitForSelector('#lob .teams', { timeout: 20000 }); console.log('voltou ao lobby:', room.state);
  console.log('erros A:', A.errs.join(' | ') || 'nenhum', '\nerros B:', B.errs.join(' | ') || 'nenhum');
  rm.stop(); await browser.close(); process.exit(0);
})().catch(e => { console.error('FALHOU:', e.message); process.exit(1); });
