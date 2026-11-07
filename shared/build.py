# Junta as partes da simulação em shared/sim.js (o arquivo que o servidor e o navegador usam).
import os
d=os.path.dirname(os.path.abspath(__file__))
r=lambda f: open(os.path.join(d,f),encoding='utf-8').read()
head="""/* Complexo do Escadão 3D — simulação compartilhada (mapa, colisão, navegação e regras).
   Roda no servidor (Node) e no navegador (modo treino). Sem dependências.
   Gerado por shared/build.py a partir de _map.js, _world.js e _game.js. */
(function (root) {
'use strict';
"""
tail="""
const API = { CONFIG, TEAM, BOT_NAMES, DIFF_FPS, CELL, GX, GZ, NC, MW, ML, K_VOID, K_AVE, K_WALK, K_STREET, K_ESC, K_BECO, K_ROOF, K_BLOCK, K_PLAZA, WALKABLE,
  B_MURO, B_TANK, B_GUARD, B_WALL, B_INVIS, B_TANK2, B_SAND, B_JERSEY, B_BRICKS, B_BARREL, B_SUPPLY, B_ROCK, B_FENCE, B_MODEL, MODEL_DEFS, K_TRAIL, K_MATA, STEP_UP,
  CLEAR, QUADRA, STAGE, SOUND_DESK, ESC, AVE_PTS, CANAL_PTS, BOTTOM_ROAD, BRIDGES, POLY_LEFT, POLY_RIGHT, TRAILS, polySide, polyDist, inPoly, escAt, ellR, CAN_HW, CAN_WALL, BANK_W,
  buildMap, makeWorld, makeGame, terrain, aveX, foldZ, mulberry, h2, clamp, sm, lerp, angDiff, STREETS, SUPPLY, PRACA, CANAL_ST, WALK_X0, WALK_X1, WALK_H, STATION, MID, AVE_HW, SIDEW, LANE_X, PARK_X, ESC_HW, ESC_X0, ESC_X1, BASEZ, WATER_X1, aveEast,
  get ESC_LAND() { return ESC_LAND; } };
if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.EscSim = API;
})(typeof window !== 'undefined' ? window : globalThis);
"""
open(os.path.join(d,'sim.js'),'w',encoding='utf-8').write(head+r('_map.js')+"\n"+r('_world.js')+"\n"+r('_game.js')+tail)
print('sim.js gerado')
