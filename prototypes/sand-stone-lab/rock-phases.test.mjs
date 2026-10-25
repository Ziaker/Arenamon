// Rocha (inspeção de objeto): só existe a fase «Duração em cena»; as outras ficam marcadas como não aplicáveis (Tarefa 7 do plano de 24/10).
import assert from 'node:assert/strict';
import * as T from 'three';
import {RockEffect} from './src/effects.js';
import {defaults, phases} from './src/config.ts';
import {notApplicable} from './src/panel-model.ts';

const stage = new T.Group();
for (let v = 0; v < 3; v++) {
  const fx = new RockEffect(stage, v, {...defaults.rock}, null);
  assert.deepEqual(fx.timeline().map(s => s.id), ['hold'], 'só a duração em cena');
  fx.update(1);assert.equal(fx.rock.visible, true);
  const off = new RockEffect(stage, v, {...defaults.rock, holdOn: 0}, null);off.update(1);assert.equal(off.rock.visible, false, 'duração desligada: sem rocha');
}
assert.deepEqual(notApplicable.rock.phases, phases.filter(p => p !== 'hold'));
assert.match(notApplicable.rock.reason, /não um ataque/);
assert.equal(notApplicable.sand, undefined, 'ataques têm as seis fases');
console.log('PASS: Rocha como inspeção de objeto');
