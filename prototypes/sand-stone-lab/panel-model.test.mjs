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
// disparo: só os sliders do efeito escolhido (os testes completos dos 27 sliders estão em shot-sliders.test.mjs)
assert.equal(shotKeyVisible('shotKind', 0), true, 'o seletor sempre aparece');
assert.equal(shotKeyVisible('length', 0), true, 'chave que não é de disparo sempre aparece');
for (const k of ['shotRadius', 'shotHorizontal', 'shotImpulseH']) {assert.equal(shotKeyVisible(k, 0), false, k + ' escondido com Nenhum');assert.equal(shotKeyVisible(k, 1), true, k + ' aparece com Argola');}
assert.equal(shotKeyVisible('shotThickness', 1), true);assert.equal(shotKeyVisible('shotThickness', 2), false);
assert.equal(shotKeyVisible('shotCount', 2), true);assert.equal(shotKeyVisible('shotCount', 1), false);
assert.equal(shotKeyVisible('shotWindBlades', 3), true);assert.equal(shotKeyVisible('shotCavitation', 4), true);assert.equal(shotKeyVisible('shotCrossArms', 5), true);assert.equal(shotKeyVisible('shotCrossArms', 4), false);
assert.deepEqual(selectorLabels.shotKind, ['Nenhum', 'Argola', 'Tiro em cone', 'Burst de vento anime', 'Jato pressurizado', 'Impacto estelar']);
assert.equal(selectorLabels.scenario.length, 4);
assert.equal(selectorLabels.outcome.length, 3);
// controles que não se aplicam ficam escondidos (slider sem efeito seria «morto»)
const keysOf = (c, v) => buildPanel(controls[c], c, v).flatMap(g => g.controls.map(d => d[0]));
assert.ok(keysOf('sand', 0).includes('outcome'), 'Sand Wave tem o resultado da prévia');
assert.ok(!keysOf('rock', 0).includes('outcome') && !keysOf('rock', 0).includes('shotKind') && !keysOf('rock', 0).includes('flightTime'), 'Rocha: sem resultado, disparo nem trajeto');
assert.ok(!keysOf('stone', 0).includes('outcome') && !keysOf('riposte', 0).includes('outcome'));
assert.ok(keysOf('psyshock', 0).includes('ringThickness') && !keysOf('psyshock', 1).includes('ringThickness'), 'espessura dos glifos só nas propostas A e C');
assert.ok(!keysOf('sand', 0).includes('rotationX') && !keysOf('sand', 0).includes('hitOn'), 'controles mortos foram removidos');
console.log('PASS: modelo do painel por fase');
