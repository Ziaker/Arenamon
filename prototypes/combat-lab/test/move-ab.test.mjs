// @ts-check
// Comparador A/B de variantes de um Move (#07): mesmo cenário, métricas comparáveis, divergência, avisos e restauração da configuração.
import {assert, C, suite, arena} from './moves-new-helpers.mjs';
import {compareMoveVariants, runMoveVariant, groupValues} from '../src/sim/move-ab.js';
import {configHash} from '../src/sim/replay-diff.js';

const {test, done} = suite('COMPARADOR A/B DE VARIANTES DE UM MOVE');

test('repetir a mesma variante dá métricas idênticas e nenhuma divergência (determinismo)', () => {
  arena();
  const r = compareMoveVariants('swift', {}, {});
  assert.equal(r.divergence.identical, true);
  assert.ok(r.rows.every(x => x.same));
  assert.ok(r.warnings.some(w => /mesmos valores/.test(w)));
});
test('mais dano na variante B aparece no dano total e a divergência acusa o primeiro tick', () => {
  arena();
  const r = compareMoveVariants('swift', {}, {'world.swift.damage': C.world.swift.damage + 6}, {distance: 3});
  const row = name => r.rows.find(x => x.metric === name);
  assert.ok(row('damage').b > row('damage').a, `dano A ${row('damage').a} × B ${row('damage').b}`);
  assert.ok(row('foeHpLoss').b > row('foeHpLoss').a);
  assert.equal(r.divergence.identical, false);
  assert.equal(r.seed, 7);
});
test('custo diferente muda a stamina gasta e a recarga muda o cooldown; cenário (entidades) é o mesmo', () => {
  arena();
  const r = compareMoveVariants('swift', {'world.swift.cost': .5, 'world.swift.cooldown': 3}, {'world.swift.cost': 1.5, 'world.swift.cooldown': 9});
  const row = name => r.rows.find(x => x.metric === name);
  assert.ok(row('staminaSpent').b > row('staminaSpent').a);assert.ok(row('cooldown').b > row('cooldown').a);
  assert.equal(row('entities').a, row('entities').b, 'mesmo número de estrelas nos dois lados');
});
test('a configuração é restaurada e a assinatura de configuração das variantes é anunciada', () => {
  arena();const h = configHash(), dmg = C.world.swift.damage;
  const r = compareMoveVariants('swift', {}, {'world.swift.damage': 99});
  assert.equal(C.world.swift.damage, dmg);assert.equal(configHash(), h);
  assert.notEqual(r.versions.a, r.versions.b, 'configs diferentes têm assinaturas diferentes');
  assert.ok(r.warnings.some(w => /FPS e P95/.test(w)), 'aviso de que render/P95 não são medidos na simulação');
});
test('groupValues transforma o grupo em caminhos aplicáveis', () => {
  arena();
  const v = groupValues('swift', {world: {swift: {damage: 3, cost: .8}}});
  assert.deepEqual(v, {'world.swift.damage': 3, 'world.swift.cost': .8});
  assert.ok(runMoveVariant('swift', v).metrics.entities >= 1);
});
test('Move inexistente dá erro legível', () => {assert.throws(() => runMoveVariant('nao-existe', {}), /não registrado/);});

done();
