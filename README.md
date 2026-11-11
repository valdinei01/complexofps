# Complexo do Escadão 3D

FPS multiplayer de navegador ambientado numa comunidade carioca fictícia. Modo **Dominação de Bases**, 5 contra 5 (jogadores + bots), com civis neutros, carros circulando, munição limitada e reabastecimento nas bases principais.

## Mapa (versão 2.4) — reconstruído a partir do mapa oficial

312 × 176 m (ampliado 25% em cada direção), com a mesma organização da imagem de referência (norte para cima). O relevo é **suave e moderado** (morros arredondados de até ~5 m, chão contínuo sem degraus); as casas ficam em **quadras com lotes regulares** e **não há becos sem saída** — o teste automático `nenhum beco ou rua sem saída` confere isso a cada mudança no mapa:

- **Base Azul (Alto da Mata)**: clareira no alto, canto superior esquerdo.
- **Base Vermelha (Morro do Cruzeiro)**: clareira no alto, canto superior direito, com o cruzeiro e a antena.
- **Base A**: Coração da Mata, no fundo da mata densa (distância parecida para os dois times). **Base B**: Largo da Serra, no interior da favela do Escadão. **Base C**: Quadra do Baile, no interior da favela do Valão.
- **Mata Central** com trilhas de terra, clareiras, palmeiras, árvores, pedras e arbustos. As copas tapam a visão (não as balas).
- **Favela do Escadão** (esquerda): Vila da Serra, Escadão Principal com a bandeira pintada nos degraus (sobe da Praça Central até a plataforma do Alto do Escadão e desce do outro lado até a Saída do Alto) e Beco da Mina.
- **Avenida das Américas** (uma faixa por sentido, carros nos dois sentidos) e o **canal / valão** com contenção, margens e três pontes.
- **Favela do Valão** (direita): Vila do Valão, Quadra do Baile (alambrado, arquibancada, palco e refletores), Vila Nova e Lajes do Topo.
- **Passagem de baixo**: rua que liga as duas favelas à avenida, com ponte sobre o canal.

Quando outros jogadores trocam tiros por perto, o jogo toca as gravações longas de tiroteio (`public/audio/ambiente`) na direção do confronto, até duas ao mesmo tempo.

**Baile**: no palco da Quadra do Baile há uma mesa de som. Perto dela, aperte E (ou toque em SOM DO BAILE) para ligar/desligar a música (`public/audio/baile.mp3`). O estado fica no servidor, todos ouvem o mesmo trecho, e o volume vai a zero a ~38 m do palco.

**Chat de voz por proximidade** (salas online): botão de microfone ao lado do som. O microfone é enviado em pedaços pequenos e comprimidos pelo próprio Socket.IO do jogo; o servidor repassa cada pedaço só para quem está a até 30 m de quem fala (volume cheio até 4 m). Não depende de conexão direta entre os jogadores. O navegador pede permissão para o microfone (precisa de HTTPS — o Render já fornece).

**Entrar numa sala**: o jogador escolhe Azul ou Vermelho. Se o time estiver completo com bots, um bot sai e o jogador assume o lugar dele (também com a partida em andamento); ao sair, o personagem volta a ser bot.

**Polícia** (`CONFIG.police`): a primeira operação acontece num momento sorteado entre 1min30 e 7min, e as seguintes com intervalo sorteado entre 2min20 e 9min20 (a duração também é sorteada). A polícia escolhe um time (com leve preferência por quem está na frente), três viaturas descem a avenida com sirene e entram na favela dele pela passagem de baixo, e 15 policiais tentam tomar as bases daquela favela (Azul: B e A; Vermelho: C e A). A sirene só é ouvida a menos de ~70 m da viatura. Base com a polícia não pontua. A operação termina quando todos os policiais caem ou depois de ~3 min, e as bases ocupadas voltam a ficar neutras.

**Atropelamento**: carro em movimento mata quem entra na frente; os carros freiam para quem está longe o bastante.

O ciclo de **dia e noite** dura 20 minutos (configurável em `CONFIG.dayLength`). Postes, janelas, refletores e faróis acendem ao escurecer.

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
   - Start: `node server.js` (ou `npm start`, que faz a mesma coisa)
   - Verificação de saúde: `/health`
3. Sem Blueprint: **New > Web Service**, ambiente Node, build `npm install`, start `node server.js`. O Node usado é a versão 20 (definida no `package.json`).
4. O endereço gerado (ex.: `https://complexo-do-escadao-3d.onrender.com`) é o jogo. Convites usam `https://.../sala/CODIGO`.

Observações sobre o Render:

- No plano gratuito o servidor "dorme" depois de uns 15 minutos sem acesso; o primeiro acesso depois disso pode demorar cerca de um minuto.
- A cada novo deploy o servidor reinicia e as salas abertas são encerradas. Quem estava jogando recebe um aviso e volta para a lista de salas.
- O servidor usa a variável `PORT` que o Render fornece. Não é preciso configurar nada além do `render.yaml`.
- Para ver erros, abra o painel do serviço no Render > **Logs**. Erros de uma sala aparecem com o código dela e não derrubam as outras.

## Testes automáticos

```bash
npm test
```

Roda a simulação (mapa, colisões, munição, dominação, civis, bots) e o sistema de salas com um simulador da interface do Socket.IO.
Os testes de navegador (`tests/ui.browser.js`, `tests/online.browser.js e tests/voice.browser.js`) usam Playwright e não fazem parte do `npm test`.

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
| Granadas | 2 por vida (raio 6,5 m), recarregam na estação |
| Dificuldade dos bots | Fácil, Normal, Difícil, Muito difícil |
| Assistência de mira | leve, liga/desliga em Configurações |
| Ciclo de dia e noite | 20 min |
| Civis | 10 |
| Carros circulando | 10 |
| Limite de tempo | 30 min |

Depois de mudar `_game.js`, rode `python3 shared/build.py` para gerar o `sim.js`.

## Controles

Computador: WASD anda, mouse mira, clique atira, botão direito usa a mira, Shift corre, Espaço pula, C agacha, R recarrega, G lança granada, Q ou 1/2 troca de arma, segure E na estação, Tab mostra o placar, Esc pausa.

Celular: joystick à esquerda, arraste no lado direito para mirar, botões de atirar, granada, mirar, recarregar, agachar, correr, pular, trocar arma e interagir (aparece perto da estação). Todos podem ser movidos, redimensionados e ter a opacidade ajustada em **Configurações > Editar HUD** (o layout é salvo separado para tela deitada e em pé). A opacidade dos fundos do HUD e dos controles também fica em Configurações.

## Autoridade do servidor

O servidor guarda o estado oficial de cada sala: times, bots, munição, recargas, reabastecimentos, tiros e dano, capturas, pontuação, penalidades e vitória. O cliente envia apenas a posição e os comandos; posições impossíveis (atravessar paredes, velocidade alta demais) são recusadas e corrigidas.
