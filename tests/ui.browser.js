// Teste de navegador (Playwright + Chromium com renderização por software).
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const W = +process.argv[2] || 900, H = +process.argv[3] || 506, mobile = process.argv[4] === 'm';
(async () => {
  const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext(mobile ? { viewport: { width: W, height: H }, isMobile: true, hasTouch: true } : { viewport: { width: W, height: H } });
  const page = await ctx.newPage(); const errs = [];
  page.on('console', m => { if (m.type() === 'error' && !/fonts|socket\.io|404/.test(m.text())) errs.push(m.text()); }); page.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  const tag = mobile ? 'm' : 'd';
  await page.goto('http://localhost:8123/'); await page.waitForSelector('.mbtns', { timeout: 60000 });
  await page.waitForTimeout(800); await page.screenshot({ path: `tests/shots/${tag}_menu.png`, timeout: 120000 });
  for (const [go, name] of [['arms', 'armamento'], ['stats', 'estatisticas'], ['settings', 'config'], ['news', 'novidades'], ['rooms', 'salas']]) { await page.click(`[data-go=${go}]`); await page.waitForTimeout(300); await page.screenshot({ path: `tests/shots/${tag}_${name}.png`, timeout: 120000 }); await page.click('[data-back]'); await page.waitForTimeout(200); }
  await page.evaluate(() => { EscApp.debug.cfg.name = 'Teste'; });
  await page.click('[data-go=play]'); await page.click('#train'); await page.waitForTimeout(2500);
  const st = await page.evaluate(() => { const s = EscPlay.sess; return { mode: s.mode, alive: s.me.alive, ammo: s.me.ammo, bases: s.G.bases.map(b => b.id), npcs: s.G.npcs.filter(n => n.alive).length, audioReady: EscPlay.audio.ready }; });
  console.log('treino:', JSON.stringify(st));
  // dispara e recarrega
  await page.evaluate(() => { const s = EscPlay.sess; s.me.invuln = 999; s.input.fire = true; }); await page.waitForTimeout(1200);
  await page.evaluate(() => { const s = EscPlay.sess; s.input.fire = false; s.input.reload = true; }); await page.waitForTimeout(800);
  console.log('após tiros:', JSON.stringify(await page.evaluate(() => { const s = EscPlay.sess; return { mag: s.me.ammo.rifle.mag, res: s.me.ammo.rifle.res, reloading: s.me.reloadT > 0, shots: s.G.stats.shots }; })));
  await page.screenshot({ path: `tests/shots/${tag}_partida.png`, timeout: 120000 });
  // visita a Base A
  await page.evaluate(() => { const s = EscPlay.sess, b = s.G.bases[0]; s.me.x = b.x; s.me.z = b.z - 1; s.me.y = b.h; s.me.yaw = 0; s.cam = null; }); await page.waitForTimeout(2500);
  await page.screenshot({ path: `tests/shots/${tag}_baseA.png`, timeout: 120000 });
  // estação de munição
  await page.evaluate(() => { const s = EscPlay.sess, G = s.G, c = G.stationCell[s.me.team]; s.me.x = G.W.cellX(c); s.me.z = G.W.cellZ(c); s.me.y = G.map.H[c]; s.me.yaw = s.me.team ? 0 : Math.PI; s.me.ammo.rifle = { mag: 2, res: 10 }; s.cam = null; s.input.use = true; }); await page.waitForTimeout(1200);
  await page.screenshot({ path: `tests/shots/${tag}_estacao.png`, timeout: 120000 }); await page.waitForTimeout(4000);
  console.log('reabastecido:', JSON.stringify(await page.evaluate(() => { const s = EscPlay.sess; s.input.use = false; return s.me.ammo; })));
  // pausa e editor de HUD
  await page.evaluate(() => EscApp.debug.pauseScreen()); await page.waitForTimeout(300); await page.click('#ed'); await page.waitForTimeout(500);
  const box = await page.$('.ebox[data-k=radar]'); const bb = await box.boundingBox(); await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await page.mouse.down(); await page.mouse.move(bb.x + 300, bb.y + 120, { steps: 5 }); await page.mouse.up();
  await page.screenshot({ path: `tests/shots/${tag}_editor.png`, timeout: 120000 }); await page.click('#esv'); await page.waitForTimeout(300);
  console.log('layout salvo:', await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('escadao3d-hud-v1-' + (EscPlay.touch ? 'm' : 'd'))).radar)));
  await page.click('#ct'); await page.waitForTimeout(300);
  console.log('erros:', errs.length ? errs.join('\n') : 'nenhum');
  await browser.close();
})();
