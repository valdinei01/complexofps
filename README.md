# Complexo do Escadão 3D

FPS multiplayer de navegador ambientado numa comunidade carioca fictícia. Modo **Dominação de Bases**, 5 contra 5 (jogadores + bots), com civis neutros, munição limitada e reabastecimento nas bases principais.

Este projeto é **independente** do jogo 2D de estratégia "Complexo do Escadão".

## Como rodar no seu computador

Requisitos: Node.js 18 ou mais novo.

```bash
npm install
npm start
```

Abra `http://localhost:3000`. Para testar com amigos na mesma rede, use o IP do computador (ex.: `http://192.168.0.10:3000`).

## Publicar no GitHub + Render

1. Crie um repositório no GitHub e envie todos os arquivos desta pasta (sem `node_modules`).
2. No Render, clique em **New > Blueprint** e escolha o repositório. O arquivo `render.yaml` já configura tudo:
   - Build: `npm install`
   - Start: `npm start`
   - Verificação de saúde: `/health`
3. Sem Blueprint: **New > Web Service**, ambiente Node, build `npm install`, start `npm start`.
4. O endereço gerado (ex.: `https://complexo-do-escadao-3d.onrender.com`) é o jogo. Convites usam `https://.../sala/CODIGO`.

Observação: no plano gratuito do Render o servidor "dorme" depois de um tempo sem uso; o primeiro acesso pode demorar cerca de um minuto.

## Testes automáticos

```bash
npm test
```

Roda a simulação (mapa, colisões, munição, dominação, civis, bots) e o sistema de salas com um simulador da interface do Socket.IO.
Os testes de navegador (`tests/ui.browser.js`, `tests/online.browser.js`) usam Playwright e não fazem parte do `npm test`.

## Estrutura

```
server/index.js      servidor HTTP + Socket.IO
server/rooms.js      salas, lobby, partida autoritativa (30 Hz), fotografias do estado (15 Hz)
shared/sim.js        mapa, colisão, navegação, regras e bots (usado pelo servidor e pelo navegador)
shared/_map.js, _world.js, _game.js   fontes do sim.js (gere de novo com: python3 shared/build.py)
public/index.html    página do jogo
public/js/render.js  renderização WebGL (texturas procedurais, geometria, decoração)
public/js/play.js    partida no cliente: treino local ou online, câmera, efeitos, HUD
public/js/app.js     menu, salas, lobby, configurações, estatísticas, controles, editor de HUD
public/js/hud.js     HUD desenhado em canvas e layout personalizável
public/js/audio.js   áudio espacial (Web Audio API)
public/audio/        fuzil.mp3, pistola.mp3 (recortes) e originais/ (arquivos enviados, intactos)
tools/build-standalone.py   gera dist/complexo-do-escadao-3d.html (arquivo único, só treino)
tests/               testes automáticos
```

## Regras configuráveis (shared/_game.js → CONFIG)

| Item | Valor inicial |
|---|---|
| Captura de base neutra | 15 s |
| Pontuação | 1% a cada 12 s por base dominada |
| Vitória | 100% (limite de segurança de 25 min) |
| Penalidade por civil | −5% (nunca abaixo de 0) |
| Fuzil | 30 no carregador, 180 de reserva |
| Pistola | 15 no carregador, 75 de reserva |
| Reabastecimento | segurar 3 s na estação, raio 2,6 m, intervalo de 5 s |
| Civis | 7 |

Depois de mudar `_game.js`, rode `python3 shared/build.py` para gerar o `sim.js`.

## Controles

Computador: WASD anda, mouse mira, clique atira, botão direito usa a mira, Shift corre, Espaço pula, C agacha, R recarrega, Q ou 1/2 troca de arma, segure E na estação, Tab mostra o placar, Esc pausa.

Celular: joystick à esquerda, arraste no lado direito para mirar, botões de atirar, mira, pular, agachar, recarregar, trocar arma e interagir. Todos podem ser movidos em **Configurações > Editar HUD**.

## Autoridade do servidor

O servidor guarda o estado oficial de cada sala: times, bots, munição, recargas, reabastecimentos, tiros e dano, capturas, pontuação, penalidades e vitória. O cliente envia apenas a posição e os comandos; posições impossíveis (atravessar paredes, velocidade alta demais) são recusadas e corrigidas.
