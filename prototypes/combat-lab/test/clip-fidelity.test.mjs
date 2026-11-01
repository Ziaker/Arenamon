// Fidelidade ao animado (view/clip-fidelity.js, auditoria docs/AUDITORIA_ANIMACOES_JOGO.md): ações cronometradas tocam o clipe na
// velocidade original (1× o relógio) e o que sobra segue em epílogo; velocidade global padrão 1×; quadril só preso quando carrega o deslocamento.
// Uso: node prototypes/combat-lab/test/clip-fidelity.test.mjs
import assert from 'node:assert/strict';
import {makeMatch, cmd, vec, C} from './animation-runtime-harness.mjs';
import {defaults} from '../src/sim/config.js';
import {migrateFlat} from '../src/ui/actions-meta.js';
import {hipsCarriesTravel, jumpPhaseFade, vaultPhaseKey} from '../src/view/clip-fidelity.js';

let n = 0;const ok = l => {n++;console.log('✓', l);};

assert.equal(defaults().display.animation.speed, 1, 'velocidade global padrão 1×');
assert.equal(migrateFlat({'display.animation.speed': 1.75}, new Set(['display.animation.speed'])).values['display.animation.speed'], 1, 'workspace salvo com 1,75× volta a 1×');
ok('velocidade global 1× (e o 1,75× salvo migra para 1×)');

{
  const m = makeMatch(), ch = m.chars[0], step = C.test.step;
  assert.equal(C.display.animation.timedNative, 1, 'modo novo é o padrão');
  m.run(10);
  m.step(cmd({dodge: true, move: vec(1, 0), dodgeDirection: vec(1, 0)}));
  const rates = [];let prev = null, guard = 0;
  while (guard++ < 200) {
    m.step();const cur = ch.current;if (!cur?.key?.startsWith('dodge')) break;
    if (prev && prev.key === cur.key) rates.push((cur.action.time - prev.time) / (step * ch.speedOf(cur.id)));
    prev = {key: cur.key, time: cur.action.time};
  }
  assert.ok(rates.length > 5, `esquiva amostrada (${rates.length} passos)`);
  const mean = rates.reduce((a, b) => a + b, 0) / rates.length;
  assert.ok(Math.abs(mean - 1) < .02, `a esquiva toca o clipe a 1× o relógio (média ${mean.toFixed(3)})`);
  ok(`esquiva na velocidade original: ${mean.toFixed(3)}× durante ${rates.length} passos (antes: clipe inteiro espremido na duração da ação)`);
}

{
  // Depois da esquiva, andando: a locomoção entra na hora (o resto do clipe da esquiva é cortado).
  const run = moving => {
    const m = makeMatch(), ch = m.chars[0];m.run(10);
    m.step(cmd({dodge: true, move: vec(1, 0), dodgeDirection: vec(1, 0)}));
    let guard = 0;while (m.g.fighters[0].action && guard++ < 300) m.step(moving ? cmd({move: vec(0, 1)}) : cmd());
    const keys = [];for (let i = 0; i < 12; i++) {m.step(moving ? cmd({move: vec(0, 1)}) : cmd());keys.push(ch.current?.key);}
    return keys;
  };
  const andando = run(true);
  assert.ok(andando.slice(-6).every(k => k === 'walk'), `andando: locomoção assume logo após a esquiva (${andando.join(',')})`);
  ok(`andar corta o fim da esquiva: ${andando.join(', ')}`);
}

{
  const bone = (name, parent, y) => ({name, parent, isBone: true, position: {y, length: () => Math.abs(y)}});
  const top = bone('Hips', {isBone: false}, 1), under = bone('Hips', {isBone: true}, .3);
  const track = (dx) => ({tracks: [{name: 'Hips.position', values: [0, .3, 0, dx, .3, 0]}]});
  assert.equal(hipsCarriesTravel(top, [track(0)]), true, 'quadril no topo carrega o deslocamento');
  assert.equal(hipsCarriesTravel(under, [track(.02)]), false, 'quadril com raiz acima e só balanço: não é preso');
  assert.equal(hipsCarriesTravel(under, [track(1.5)]), true, 'quadril com raiz acima mas que viaja: é preso');
  ok('quadril: preso só quando carrega o deslocamento');
}

{
  // Pulo: transição curta entre as fases; salto sobre o rival usa as fases no arco (personagem com fases próprias).
  assert.equal(jumpPhaseFade('jump_rise'), C.display.animation.jumpPhaseFade, 'fases do pulo: transição curta');
  assert.equal(jumpPhaseFade('walk'), null, 'outros estados: transição comum');
  const fake = {variants: {jump_start: [0], jump_rise: [1], jump_apex: [2], jump_fall: [3]}, hasJumpPhases: () => true, clock: 0, current: null};
  const at = p => vaultPhaseKey(fake, {action: {jump: true, elapsed: p * 2 * C.actions.dodge.vaultUp / C.actions.dodge.vaultGravity}});
  assert.deepEqual([.05, .3, .5, .8].map(at), ['jump_start', 'jump_rise', 'jump_apex', 'jump_fall'], 'arco do salto → início, subida, pico, queda');
  assert.equal(vaultPhaseKey({...fake, hasJumpPhases: () => false}, {action: {jump: true, elapsed: 0}}), null, 'sem fases próprias: clipe de salto como antes');
  ok('pulo: fases com transição curta; salto sobre o rival nas fases do arco');
}
console.log(`\n${n} verificações de fidelidade ao animado aprovadas.`);
