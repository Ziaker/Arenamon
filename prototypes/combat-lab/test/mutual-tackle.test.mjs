// Tackle mútuo fora do clash frontal (sem vantagem de índice) e morte por dano periódico: sem navegador.
// Este teste caracteriza a mecânica nos valores de FÁBRICA do laboratório (factoryDefaults); a base de calibração v8 é coberta por calibration-base.test.mjs e pelos testes de colisão/ambiente.
import assert from 'node:assert/strict';
import {C, factoryDefaults, resetConfig} from '../src/sim/config.js';
import {Game} from '../src/sim/game.js';
import {vec} from '../src/sim/math.js';
import {stepPhysics} from '../src/sim/physics.js';
import {tickStatuses, applyStatus} from '../src/sim/status.js';

let n = 0;const ok = l => {n++;console.log('✓', l);};
const tackle = heading => ({kind: 'tackle', elapsed: 0, heading, offensive: true, hits: new Set(), from: null});

// Dois tackles convergentes cuja mira fica entre o alinhamento do tackle (.15) e o do clash (.2): os dois conectam.
function mutual(swap) {
  resetConfig(factoryDefaults());
  const g = new Game();g.mode = 'inactive';g.reset({positions: [vec(0, -.45), vec(0, .45)]});
  const [a, b] = g.fighters, X = C.extras.combat, h = Math.acos((X.tackleTargetAlignment + X.clashFacingAlignment) / 2);
  a.action = tackle(h);b.action = tackle(Math.acos(-(X.tackleTargetAlignment + X.clashFacingAlignment) / 2));
  a.velocity = vec(0, 3);b.velocity = vec(0, -3);
  if (swap) {g.fighters.reverse();g.fighters.forEach((f, i) => {f.id = i;});}
  const hp = g.fighters.map(f => f.hp), ev = stepPhysics(g.fighters, C.test.step, g.world);
  return {g, ev, lost: g.fighters.map((f, i) => hp[i] - f.hp)};
}
{
  const r = mutual(false);
  assert.ok(r.ev.some(e => e.result === 'clash'), 'tackle mútuo vira clash (os dois conectam)');
  assert.ok(r.lost[0] > 0 && r.lost[1] > 0, 'os dois perdem vida');assert.ok(r.g.fighters.every(f => f.flight), 'os dois são lançados');
  assert.ok(Math.abs(r.lost[0] - r.lost[1]) < 1e-9, 'dano igual (mesmo ataque)');ok('tackle mútuo oblíquo: resolução simétrica');
  const s = mutual(true);
  assert.deepEqual(s.lost.map(x => +x.toFixed(6)), r.lost.map(x => +x.toFixed(6)), 'trocar a ordem dos lutadores não muda o resultado');ok('ordem do array não dá vantagem');
}
// Só um conecta (o outro está fora da janela/alinhamento): continua sendo um acerto comum.
{
  resetConfig(factoryDefaults());
  const g = new Game();g.mode = 'inactive';g.reset({positions: [vec(0, -.45), vec(0, .45)]});
  const [a, b] = g.fighters;a.action = tackle(0);b.action = null;a.velocity = vec(0, 3);
  const ev = stepPhysics(g.fighters, C.test.step, g.world);
  assert.ok(ev.some(e => e.result === 'impact' && e.attacker === 0) && !ev.some(e => e.result === 'clash'), 'acerto simples não vira clash');ok('acerto simples intacto');
}
// Morte por dano periódico desarma a guarda (como um golpe que zera a vida).
{
  resetConfig(factoryDefaults());
  const g = new Game();g.mode = 'inactive';g.reset({});
  const f = g.fighters[0];f.hp = 5;f.guard = true;f.guardSuppressed = false;
  applyStatus(f, {id: 'veneno', duration: 1, tick: {interval: .05, damage: 50}, tags: ['debuff']}, {source: 1});
  tickStatuses(f, .06, C.rules.staminaMax);
  assert.equal(f.hp, 0);assert.equal(f.guard, false, 'sem guarda ao morrer por DoT');assert.equal(f.guardSuppressed, true);ok('DoT letal desarma a guarda');
}
console.log(`mutual-tackle: ${n} grupos ok`);
