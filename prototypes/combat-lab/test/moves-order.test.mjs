// Fase 0 (plano de Reflect/Psyshock) — TESTE DE CARACTERIZAÇÃO da ordem das entradas no mesmo passo (base de M30.9).
// Documenta como o controlador resolve HOJE comandos simultâneos de defesa (D), X, C e movimento de slot, para que a Fase 1
// (Charge) acrescente a soltura do Move DEPOIS de X/C sem alterar o resto. Não corrige nada; se o controlador mudar,
// este teste acusa e a mudança precisa ser deliberada. Sem navegador.
import assert from 'node:assert/strict';
import {defaults, resetConfig} from '../src/sim/config.js';
import {Game} from '../src/sim/game.js';
import {emptyCommand} from '../src/sim/entity.js';
import {vec} from '../src/sim/math.js';
import {registerMove, clearMoves} from '../src/sim/moves.js';

let n = 0;const ok = l => {n++;console.log('✓', l);};
const cmd = o => ({...emptyCommand(), ...o});
const arena = () => {resetConfig(defaults());const g = new Game();g.mode = 'inactive';g.reset({positions: [vec(0, -3), vec(0, 3)]});g.fighters[0].facing = 0;g.fighters[1].facing = Math.PI;g.setLoadout(0, ['teste:m']);return g;};
const view = g => {const f = g.fighters[0];return {action: f.action?.kind ?? null, move: f.action?.move ?? null, guard: f.guard};};
const FWD = vec(0, 1);
registerMove({id: 'teste:m', duration: .4, cost: 1, cooldown: 1, timeline: []});   // definição só deste teste; removida no fim
const idle = (g, k) => {for (let i = 0; i < k; i++) g.step(cmd());};

// ---------- Pedidos no mesmo passo ----------
{
  let g = arena();g.step(cmd({tackle: true, dodge: true, move: FWD}));
  assert.deepEqual(view(g), {action: 'tackle', move: null, guard: false});
  g = arena();g.step(cmd({tackle: true, skill: 0}));
  assert.deepEqual(view(g), {action: 'tackle', move: null, guard: false});
  g = arena();g.step(cmd({dodge: true, move: FWD, skill: 0}));
  assert.deepEqual(view(g), {action: 'dodge', move: null, guard: false});
}
ok('mesmo passo: X vence C; X e C vencem o movimento de slot (o slot só entra se nenhum X/C foi pedido)');
{
  let g = arena();g.step(cmd({guard: true, guardPressed: true, tackle: true}));
  assert.deepEqual(view(g), {action: 'tackle', move: null, guard: false}, 'D + X no mesmo passo: a defesa é aplicada primeiro e o X a substitui');
  g = arena();g.step(cmd({guard: true, guardPressed: true, dodge: true, move: FWD}));
  assert.deepEqual(view(g), {action: 'dodge', move: null, guard: false});
  g = arena();g.step(cmd({guard: true, guardPressed: true, skill: 0}));
  assert.deepEqual(view(g), {action: 'move', move: 'teste:m', guard: false}, 'D + slot no mesmo passo: o movimento começa e a defesa fica suprimida');
}
ok('mesmo passo com defesa: a defesa é resolvida antes, mas o X/C/movimento pedido no mesmo passo prevalece e a defesa deixa de valer');

// ---------- Defesa e movimento durante uma ação em curso ----------
{
  let g = arena();g.step(cmd({dodge: true, move: FWD}));idle(g, 24);                       // ~0,2 s de esquiva
  g.step(cmd({guard: true, guardPressed: true}));
  assert.deepEqual(view(g), {action: null, move: null, guard: true}, 'defesa cancela a esquiva quando a janela de encadeamento está aberta');
  g = arena();g.step(cmd({dodge: true, move: FWD}));idle(g, 24);g.step(cmd({skill: 0}));
  assert.deepEqual(view(g), {action: 'move', move: 'teste:m', guard: false}, 'movimento de slot substitui a esquiva depois da janela de encadeamento');
  g = arena();g.step(cmd({dodge: true, move: FWD}));g.step(cmd({skill: 0}));
  assert.deepEqual(view(g), {action: 'dodge', move: null, guard: false}, 'movimento de slot logo no início da esquiva é negado (ação em curso)');
}
ok('durante a esquiva: defesa cancela quando encadeável; movimento de slot só entra depois da janela de encadeamento');
{
  let g = arena();g.step(cmd({skill: 0}));g.step(cmd({guard: true, guardPressed: true}));
  assert.deepEqual(view(g), {action: 'move', move: 'teste:m', guard: false}, 'sem cancelAfter, a defesa não interrompe um movimento de slot (hoje)');
  g = arena();g.step(cmd({skill: 0}));g.step(cmd({dodge: true, move: FWD}));
  assert.deepEqual(view(g), {action: 'move', move: 'teste:m', guard: false});
  g = arena();g.step(cmd({skill: 0}));g.step(cmd({tackle: true}));
  assert.deepEqual(view(g), {action: 'move', move: 'teste:m', guard: false});
}
ok('durante um movimento de slot comum (chainAfter = duração): D, C e X não o interrompem — o Charge da Fase 1 definirá os cancelamentos (M15.1–M16.2)');

clearMoves();
console.log(`\n${n} verificações da ordem de entradas (caracterização, Fase 0) aprovadas.`);
resetConfig(defaults());
