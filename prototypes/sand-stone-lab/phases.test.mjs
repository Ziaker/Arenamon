// Relógio de fases (Tarefa 1 do plano docs/plans/2026-10-24-vfx-por-fase-atelier.md): pula as fases desligadas e diz qual está ativa.
import assert from 'node:assert/strict';
import {PhaseClock, enabledPhases} from './src/phases.ts';

const spans = [{id: 'start', from: 0, to: .25}, {id: 'body', from: .25, to: 1}, {id: 'finish', from: 1, to: 1.65}];
const on = {startOn: 1, launchOn: 1, bodyOn: 1, sustainOn: 1, finishOn: 1, impactOn: 1};

// tudo ligado: o relógio é a identidade
const all = new PhaseClock(spans, on);
assert.equal(all.duration, 1.65);
assert.equal(all.nothingToShow, false);
assert.equal(all.map(.3), .3);
assert.equal(all.phaseAt(.3), 'body');
assert.equal(all.phaseAt(0), 'start');
assert.equal(all.phaseAt(1.6), 'finish');
assert.equal(all.map(99), 1.65, 'passou do fim: trava no fim');

// fase desligada é pulada e nunca aparece na legenda
const noStart = new PhaseClock(spans, {...on, startOn: 0});
assert.ok(Math.abs(noStart.duration - 1.4) < 1e-9, 'duração: ' + noStart.duration);
assert.equal(noStart.map(0), .25, 'começa direto no corpo');
assert.equal(noStart.phaseAt(0), 'body');
for (let t = 0; t <= noStart.duration; t += .01) assert.notEqual(noStart.phaseAt(t), 'start');
const noBody = new PhaseClock(spans, {...on, bodyOn: 0});
assert.ok(Math.abs(noBody.duration - .9) < 1e-9);
assert.equal(noBody.map(.3), 1.05, 'depois do surgimento (.25) segue direto para a finalização (1.0)');
assert.equal(noBody.phaseAt(.3), 'finish');

// nada ligado
const none = new PhaseClock(spans, {startOn: 0, launchOn: 0, bodyOn: 0, sustainOn: 0, finishOn: 0, impactOn: 0});
assert.equal(none.nothingToShow, true);
assert.equal(none.duration, 0);
assert.equal(none.map(1), 0);
assert.equal(none.phaseAt(1), null);

// a fase sem janela no efeito (ex.: disparo instantâneo) não conta como «algo para mostrar»
const onlyLaunch = new PhaseClock(spans, {startOn: 0, launchOn: 1, bodyOn: 0, sustainOn: 0, finishOn: 0, impactOn: 0});
assert.equal(onlyLaunch.nothingToShow, true);

// valor ausente = ligada (compatibilidade com presets antigos)
assert.deepEqual(enabledPhases({}), ['start', 'launch', 'body', 'sustain', 'finish', 'impact']);
assert.deepEqual(enabledPhases({startOn: 0, impactOn: 0}), ['launch', 'body', 'sustain', 'finish']);
console.log('PASS: relógio de fases');
