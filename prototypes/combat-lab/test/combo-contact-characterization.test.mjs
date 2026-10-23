// Caracterização do contato real: permissão de encadear não implica segundo acerto.
import {assert, arena, cmd, vec, secs, suite} from './moves-new-helpers.mjs';
import {canAct, canMove} from '../src/sim/entity.js';

const {test, done} = suite('COMBOS — CARACTERIZAÇÃO DE CONTATO');

test('Tackle seguido de Quick Attack produz dois impactos reais no mesmo alvo', () => {
  const g = arena({equip: ['quick-attack'], positions: [vec(0, -.9), vec(0, .9)]});
  const hits = [];
  let first = false, pressed = false, quickStarted = false, responseSteps = 0;
  for (let i = 0; i < secs(2); i++) {
    const pressQuick = first && !pressed && g.hitstop <= 0;
    const command = !first ? cmd({tackle: i === 0}) : pressQuick ? cmd({skill: 0, skillHeld: [true, false, false, false]}) : cmd();
    if (pressQuick) pressed = true;
    if (first && hits.length === 1 && g.hitstop <= 0 && (canAct(g.fighters[1]) || canMove(g.fighters[1]))) responseSteps++;
    g.step(command, cmd());
    if (g.fighters[0].action?.move === 'quick-attack') quickStarted = true;
    for (const e of g.lastStepEvents) if (e.attacker === 0 && e.target === 1 && e.result === 'impact' && e.damage > 0 && e.contact === 'tackle') hits.push({id: e.id, tick: e.tick, damage: e.damage});
    if (hits.length) first = true;
  }
  assert.ok(hits.length >= 1, 'o Tackle inicial precisa acertar');
  assert.ok(pressed, 'o Quick Attack precisa receber comando após o primeiro impacto');
  assert.ok(quickStarted, 'o Quick Attack começou após o Tackle');
  console.log(`    contatos observados: ${JSON.stringify(hits)}`);
  assert.equal(hits.length, 2, 'Tackle e Quick Attack conectam naturalmente neste cenário');
  assert.notEqual(hits[0].id, hits[1].id, 'eventos distintos');
  assert.ok(hits[1].tick > hits[0].tick, 'o segundo impacto ocorre depois do primeiro');
  assert.equal(responseSteps, 0, 'sem passo de resposta detectado pelo estado atual do defensor');
});

done();
