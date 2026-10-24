// Modelo do painel por fase (Tarefa 4 do plano docs/plans/2026-10-24-vfx-por-fase-atelier.md).
import assert from 'node:assert/strict';
import {categories, controls, help, phases, phaseNames, isToggle} from './src/config.ts';
import {buildPanel, shotKeyVisible, selectorLabels} from './src/panel-model.ts';

for (const c of categories) {
  const groups = buildPanel(controls[c]);
  assert.deepEqual(groups.map(g => g.phase), [...phases], `${c}: sempre as seis fases, na ordem`);
  for (const g of groups) {
    assert.equal(g.title, phaseNames[g.phase]);
    assert.equal(g.toggle?.[0], g.phase + 'On', `${c}/${g.phase}: interruptor «Ligar esta fase»`);
    assert.ok(g.controls.every(d => !isToggle(d[0])), 'o interruptor não se repete entre os sliders');
  }
  const seen = groups.flatMap(g => g.controls.map(d => d[0]));
  assert.equal(new Set(seen).size, seen.length, `${c}: nenhum controle repetido`);
  const expected = controls[c].map(d => d[0]).filter(k => !isToggle(k));
  assert.deepEqual([...seen].sort(), [...expected].sort(), `${c}: nenhum controle se perde`);
  for (const d of controls[c]) assert.ok(isToggle(d[0]) || help[d[0]], `${c}/${d[0]}: falta a explicação curta`);
}
// disparo: só os sliders do efeito escolhido
const ring = ['shotThickness', 'shotSquash'], cone = ['shotAngleH', 'shotAngleV', 'shotCount', 'shotLength', 'shotParticleSize', 'shotParticleLife'], common = ['shotRadius', 'shotHorizontal', 'shotVertical', 'shotImpulseH', 'shotImpulseV', 'shotTime', 'shotFollow'];
for (const k of common) for (const kind of [0, 1, 2]) assert.equal(shotKeyVisible(k, kind), kind !== 0, `${k} aparece com Argola e com Cone, não com Nenhum`);
for (const k of ring) {assert.equal(shotKeyVisible(k, 1), true);assert.equal(shotKeyVisible(k, 2), false);assert.equal(shotKeyVisible(k, 0), false);}
for (const k of cone) {assert.equal(shotKeyVisible(k, 2), true);assert.equal(shotKeyVisible(k, 1), false);assert.equal(shotKeyVisible(k, 0), false);}
assert.equal(shotKeyVisible('shotKind', 0), true, 'o seletor sempre aparece');
assert.equal(shotKeyVisible('length', 0), true, 'chave que não é de disparo sempre aparece');
assert.deepEqual(selectorLabels.shotKind, ['Nenhum', 'Argola', 'Tiro em cone']);
assert.equal(selectorLabels.scenario.length, 4);
assert.equal(selectorLabels.outcome.length, 3);
console.log('PASS: modelo do painel por fase');
