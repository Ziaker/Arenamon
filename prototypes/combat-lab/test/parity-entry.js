// Entrada do teste de paridade: expõe a simulação do laboratório na página do v6.
import {Game} from '../src/sim/game.js';
import {C, V6_COMPAT} from '../src/sim/config.js';
window.__labSim = {Game, C, V6_COMPAT};
