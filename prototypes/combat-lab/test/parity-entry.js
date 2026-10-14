// Entrada do teste de paridade: expõe a simulação do laboratório na página do v6.
import {Game} from '../src/sim/game.js';
import {C} from '../src/sim/config.js';
window.__labSim = {Game, C};
