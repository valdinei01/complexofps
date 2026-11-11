// Testes do sistema de salas e da autoridade do servidor (com o simulador da interface do Socket.IO).
const { RoomManager } = require('../server/rooms.js');
const { MockIO } = require('./mockio.js');
const { test, eq, ok, summary } = require('./mini.js');

let clock = 1e6;
const setup = () => { const io = new MockIO(); const rm = new RoomManager(io, { manualTick: true, backDelay: 1 }); rm.now = () => clock; return { io, rm }; };
const player = (io, name) => { const c = io.connect(); c.emit('hello', { key: 'key-' + name, name }); return c; };
const ticks = (rm, n) => { for (let k = 0; k < n; k++) { clock += 33; rm.tick(); } };

test('criar sala, aparecer na lista e pesquisar', () => {
  const { io, rm } = setup(); const a = player(io, 'Ana'), b = player(io, 'Beto'); b.emit('rooms:sub');
  const r = a.emit('room:create', { name: 'Rolê no Escadão', bots0: 2, bots1: 3 }); ok(r.ok && r.id, 'sala criada'); rm.flushList();
  const list = b.last['rooms:list']; ok(list.some(x => x.id === r.id && x.name === 'Rolê no Escadão' && !x.priv), 'aparece na lista');
  eq(list.find(x => x.id === r.id).bots, 5, 'bots informados'); eq(rm.rooms.size, 1);
});
test('entrar com senha correta, recusar senha errada, convite sem senha no link', () => {
  const { io } = setup(); const a = player(io, 'Ana'), b = player(io, 'Beto'), c = player(io, 'Caio');
  const r = a.emit('room:create', { name: 'Privada', pass: 'laje123', bots0: 0, bots1: 0 });
  const info = b.emit('room:info', { id: r.id }); ok(info.priv, 'sala marcada como privada'); ok(!('pass' in info), 'senha nunca é enviada');
  const bad = b.emit('room:join', { id: r.id, pass: 'errada' }); ok(bad.error && bad.needPass, 'senha errada recusada');
  const good = b.emit('room:join', { id: r.id.toLowerCase(), pass: 'laje123' }); ok(good.ok, 'senha correta aceita');
  eq(c.emit('room:join', { id: 'ZZZZZZ' }).error, 'Sala não encontrada.');
});
test('limite 5 contra 5 com bots ocupando vagas; jogador novo substitui bot', () => {
  const { io, rm } = setup(); const a = player(io, 'Ana'); const r = a.emit('room:create', { name: 'Cheia', bots0: 4, bots1: 5 }); const room = rm.rooms.get(r.id);
  eq(rm.count(room), 10, '1 humano + 9 bots'); const b = player(io, 'Beto'); ok(b.emit('room:join', { id: r.id }).ok, 'entrou tirando um bot'); eq(rm.count(room), 10, 'continua 10');
  for (let k = 0; k < 8; k++) player(io, 'P' + k).emit('room:join', { id: r.id });
  eq(room.players.size, 10); const x = player(io, 'Excedente'); ok(x.emit('room:join', { id: r.id }).error, 'décimo primeiro recusado');
  eq(rm.teamCount(room, 0), 5); eq(rm.teamCount(room, 1), 5);
});
test('só o anfitrião controla bots e inicia; troca de time respeita vagas', () => {
  const { io, rm } = setup(); const a = player(io, 'Ana'), b = player(io, 'Beto'); const r = a.emit('room:create', { name: 'X', bots0: 0, bots1: 0 }); b.emit('room:join', { id: r.id }); const room = rm.rooms.get(r.id);
  b.emit('lobby:bots', { team: 0, n: 3 }); eq(room.bots[0], 0, 'convidado não mexe em bots'); ok(b.emit('lobby:start').error, 'convidado não inicia');
  a.emit('lobby:bots', { team: 0, n: 9 }); eq(room.bots[0], 4, 'limitado pelas vagas'); b.emit('lobby:team', { team: 0 }); eq(room.players.get('key-Beto').team, 0, 'time cheio de bots: um bot sai e a troca acontece'); eq(room.bots[0], 3, 'bot retirado'); b.emit('lobby:team', { team: 1 });
  a.emit('lobby:bots', { team: 0, n: 2 }); b.emit('lobby:team', { team: 0 }); eq(room.players.get('key-Beto').team, 0, 'troca aceita com vaga');
});
test('partida: início, fotografias isoladas por sala, sem jogadores/bots duplicados', () => {
  const { io, rm } = setup(); const a = player(io, 'Ana'), b = player(io, 'Beto'), c = player(io, 'Caio');
  const r1 = a.emit('room:create', { name: 'Um', bots0: 2, bots1: 3 }); b.emit('room:join', { id: r1.id }); const r2 = c.emit('room:create', { name: 'Dois', bots0: 1, bots1: 1 });
  ok(a.emit('lobby:start').ok); ticks(rm, 30);
  ok(a.count('game:snap') > 5 && b.count('game:snap') > 5, 'sala 1 recebe estado'); eq(c.count('game:snap'), 0, 'sala 2 não recebe nada da sala 1');
  const G = rm.rooms.get(r1.id).game; eq(G.actors.length, 7, '2 humanos + 5 bots'); eq(new Set(G.actors.map(x => x.id)).size, 7, 'ids únicos');
  eq(G.actors.filter(x => x.key === 'key-Ana').length, 1, 'Ana uma vez só');
});
test('servidor valida movimento e munição (cliente não inventa munição nem teleporta)', () => {
  const { io, rm } = setup(); const a = player(io, 'Ana'); const r = a.emit('room:create', { name: 'V', bots0: 0, bots1: 0 }); a.emit('lobby:start'); ticks(rm, 20);
  const room = rm.rooms.get(r.id), act = room.game.actors[0]; ok(act.alive, 'nasceu'); const x0 = act.x, z0 = act.z;
  a.emit('game:input', { x: x0 + 30, y: act.y, z: z0 + 30, yaw: 0, pitch: 0 }); eq(act.x, x0, 'teleporte recusado'); ticks(rm, 2); ok(a.last['game:snap'].me.cor === 1, 'cliente recebe correção');
  a.emit('game:input', { x: x0, y: act.y, z: z0, yaw: 0, pitch: 0, f: 1, am: [999, 999] }); ticks(rm, 15); a.emit('game:input', { x: x0, y: act.y, z: z0, f: 0 });
  const am = a.last['game:snap'].me.am; ok(am[0] < 30 && am[1] === 180, 'munição decidida pelo servidor: ' + am.join('/'));
});
test('movimento válido é aceito em qualquer parte do mapa grande (regressão: limite antigo de 80 m)', () => {
  const { io, rm } = setup(); const a = player(io, 'Ana'); const r = a.emit('room:create', { name: 'M', bots0: 0, bots1: 0 }); a.emit('lobby:start'); ticks(rm, 20);
  const room = rm.rooms.get(r.id), act = room.game.actors[0], W = room.game.W, c = W.nearestOK(262, 40, 6); act.x = W.cellX(c); act.z = W.cellZ(c); act.y = room.game.map.H[c];
  const nc = W.nearestOK(act.x, act.z + 0.3, 2); clock += 50; a.emit('game:input', { x: W.cellX(nc), y: room.game.map.H[nc], z: W.cellZ(nc), yaw: 0, pitch: 0 }); eq(act.x, W.cellX(nc), 'aceito em x=' + act.x); ok(!room.players.get('key-Ana').rejects, 'sem rejeição');
});
test('granadas: servidor limita o estoque mesmo com pedidos repetidos; dia/noite sincronizado', () => {
  const { io, rm } = setup(); const a = player(io, 'Ana'), b = player(io, 'Beto'); const r = a.emit('room:create', { name: 'G', bots0: 0, bots1: 0 }); b.emit('room:join', { id: r.id }); a.emit('lobby:start'); ticks(rm, 20);
  const room = rm.rooms.get(r.id), act = room.players.get('key-Ana').actor;
  for (let k = 0; k < 12; k++) { clock += 50; a.emit('game:input', { yaw: 0, pitch: -1, g: 1 }); ticks(rm, 6); }
  const thrown = (a.got['game:snap'] || []).reduce((n, sn) => n + sn.ev.filter(e => e.type === 'gthrow' && e.id === act.id).length, 0);
  eq(thrown, 2, 'só 2 granadas mesmo com 12 pedidos'); eq(a.last['game:snap'].me.gn, 0, 'contador zerado');
  const dnA = a.last['game:snap'].dn, dnB = b.last['game:snap'].dn; ok(typeof dnA === 'number' && dnA === dnB, 'mesma hora do dia para os dois');
});
test('entrar escolhendo o time: no lobby tira um bot do time; time só de humanos cheio recusa', () => {
  const { io, rm } = setup(); const a = player(io, 'Ana'); const r = a.emit('room:create', { name: 'T', bots0: 4, bots1: 5 }); const room = rm.rooms.get(r.id);
  const info = a.emit('room:info', { id: r.id }); eq(info.teams[1].bots, 5, 'resumo mostra 5 bots no Vermelho');
  const b = player(io, 'Beto'); const j = b.emit('room:join', { id: r.id, team: 1 }); ok(j.ok, 'Beto entrou no Vermelho'); eq(room.players.get('key-Beto').team, 1); eq(room.bots[1], 4, 'um bot saiu para dar lugar'); eq(rm.teamCount(room, 1), 5, 'time continua com 5');
  room.bots[0] = 0; for (const n of ['C1', 'C2', 'C3', 'C4']) player(io, n).emit('room:join', { id: r.id, team: 0 }); eq(rm.teamCount(room, 0), 5);
  const x = player(io, 'Xis').emit('room:join', { id: r.id, team: 0 }); ok(x.error && x.teamFull, 'time cheio de humanos recusa: ' + x.error);
});
test('entrar com a partida em andamento: assume o lugar de um bot do time escolhido; ao sair, o bot volta', () => {
  const { io, rm } = setup(); const a = player(io, 'Ana'); const r = a.emit('room:create', { name: 'H', bots0: 4, bots1: 5 }); a.emit('lobby:start'); ticks(rm, 30);
  const room = rm.rooms.get(r.id), G = room.game, n0 = G.actors.length, bots1 = G.actors.filter(q => q.isBot && q.team === 1).length;
  const b = player(io, 'Beto'); const j = b.emit('room:join', { id: r.id, team: 1 }); ok(j.ok, 'entrou'); const pb = room.players.get('key-Beto');
  ok(pb.actor && !pb.actor.isBot && pb.actor.team === 1 && pb.actor.name === 'Beto', 'Beto controla um personagem do Vermelho'); eq(G.actors.length, n0, 'nenhum personagem a mais'); eq(G.actors.filter(q => q.isBot && q.team === 1).length, bots1 - 1, 'um bot a menos');
  ok(b.last['game:start'] && b.last['game:start'].myId === pb.actor.id, 'recebeu o início da partida com o seu personagem'); ok((a.last['game:roster'] || []).some(q => q.name === 'Beto' && !q.bot), 'os outros jogadores recebem a lista atualizada');
  ticks(rm, 10); ok(b.last['game:snap'] && b.last['game:snap'].me, 'recebe o estado da partida');
  b.emit('room:leave'); ticks(rm, 3); eq(G.actors.length, n0, 'personagem continua na partida'); eq(G.actors.filter(q => q.isBot && q.team === 1).length, bots1, 'o bot voltou');
});
test('voz por proximidade: o servidor repassa só para quem está perto e nunca para outra sala', () => {
  const { io, rm } = setup(); const a = player(io, 'Ana'), b = player(io, 'Beto'), c = player(io, 'Caio'), z = player(io, 'Zé');
  const r = a.emit('room:create', { name: 'V', bots0: 0, bots1: 0 }); b.emit('room:join', { id: r.id }); c.emit('room:join', { id: r.id }); const r2 = z.emit('room:create', { name: 'Outra', bots0: 0, bots1: 0 });
  a.emit('lobby:start'); z.emit('lobby:start'); ticks(rm, 20); const room = rm.rooms.get(r.id), P2 = k => room.players.get('key-' + k).actor;
  P2('Ana').x = 60; P2('Ana').z = 30; P2('Beto').x = 66; P2('Beto').z = 30; P2('Caio').x = 60; P2('Caio').z = 110; for (const k of ['Ana', 'Beto', 'Caio']) P2(k).y = 0;
  a.emit('voice:data', 'QUJD'); const gb = (b.got['voice:data'] || []).length, gc = (c.got['voice:data'] || []).length, gz = (z.got['voice:data'] || []).length;
  eq(gb, 1, 'Beto (6 m) recebe'); eq(b.last['voice:data'].id, P2('Ana').id, 'com o id de quem fala'); eq(gc, 0, 'Caio (60 m) não recebe'); eq(gz, 0, 'outra sala não recebe'); eq((a.got['voice:data'] || []).length, 0, 'quem fala não recebe o próprio áudio');
  for (let k = 0; k < 100; k++) a.emit('voice:data', 'QUJD'); ok((b.got['voice:data'] || []).length <= 41, 'limite de 40 trechos por segundo (' + (b.got['voice:data'] || []).length + ')');
  a.emit('voice:data', { x: 1 }); a.emit('voice:data', 'A'.repeat(7000)); ok(true, 'dados inválidos são ignorados sem erro');
});
test('operação policial no servidor: viaturas no estado, policiais entram na lista e saem no fim', () => {
  const { io, rm } = setup(); const a = player(io, 'Ana'); const r = a.emit('room:create', { name: 'P', bots0: 4, bots1: 5 }); a.emit('lobby:start'); ticks(rm, 20);
  const room = rm.rooms.get(r.id), G = room.game; G.police.next = G.t; ticks(rm, 2); eq(G.police.phase, 'chegando', 'operação começou');
  ok(a.last['game:snap'].pol && a.last['game:snap'].pol.ph === 'chegando', 'fase da operação vai no estado'); let n = 0; while (G.police.phase === 'chegando' && n++ < 30 * 60) { clock += 33; rm.tick(); }
  eq(G.police.phase, 'incursao', 'viaturas chegaram e os policiais desembarcaram'); ticks(rm, 4); ok((a.last['game:roster'] || []).filter(q => q.police).length === 15, '15 policiais na lista dos jogadores');
  ok(a.last['game:snap'].pol.c.length === 3 && a.last['game:snap'].pol.c.every(c => c[4] === 1), 'três viaturas estacionadas');
  G.endOperation('retirada'); ticks(rm, 3); eq(G.actors.filter(q => q.isPolice).length, 0, 'policiais saem'); ok(!(a.last['game:roster'] || []).some(q => q.police), 'lista atualizada');
});
test('desconexão e reconexão voltam ao mesmo personagem; saída do anfitrião passa o comando', () => {
  const { io, rm } = setup(); const a = player(io, 'Ana'), b = player(io, 'Beto'); const r = a.emit('room:create', { name: 'R', bots0: 0, bots1: 0 }); b.emit('room:join', { id: r.id }); a.emit('lobby:start'); ticks(rm, 10);
  const room = rm.rooms.get(r.id), actB = room.players.get('key-Beto').actor; b.disconnect(); ticks(rm, 5); ok(!room.players.get('key-Beto').connected);
  const b2 = io.connect(); const res = b2.emit('hello', { key: 'key-Beto', name: 'Beto' }); eq(res.rejoined, r.id, 'voltou para a sala'); ok(b2.count('game:start') === 1, 'recebeu a partida'); eq(room.players.get('key-Beto').actor, actB, 'mesmo personagem');
  a.emit('room:leave'); eq(room.host, 'key-Beto', 'anfitrião transferido'); b2.emit('room:leave'); ok(!rm.rooms.has(r.id), 'sala vazia é removida');
});
test('desconectado por muito tempo sai da sala; partida termina e volta ao lobby', () => {
  const { io, rm } = setup(); const a = player(io, 'Ana'), b = player(io, 'Beto'); const r = a.emit('room:create', { name: 'T', bots0: 0, bots1: 0 }); b.emit('room:join', { id: r.id }); const room = rm.rooms.get(r.id);
  b.disconnect(); clock += 21000; rm.tick(); ok(!room.players.has('key-Beto'), 'removido no lobby após o prazo');
  a.emit('lobby:start'); ticks(rm, 5); room.game.score[0] = 99.99; room.game.bases[0].owner = 0; room.game.bases[0].prog = -1; ticks(rm, 30);
  ok(a.count('game:end') === 1, 'resultado enviado'); const end = a.last['game:end']; eq(end.winner, 0); ok(end.stats.length >= 1 && end.bases.length === 3, 'estatísticas e bases');
  a.emit('game:back'); eq(room.state, 'lobby', 'voltou ao lobby');
});
summary();
