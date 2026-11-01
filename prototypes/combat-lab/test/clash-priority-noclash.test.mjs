// Reproduz o risco apontado na auditoria pré-Melee: em clashPossible (sim/combat.js), diferenças de PL e de combatPriority
// são tratadas ANTES de noClash(). Este teste fixa o comportamento atual (caracterização), sem alterar o código.
import assert from 'node:assert/strict';
import {C, factoryDefaults, resetConfig} from '../src/sim/config.js';
import {clashPossible} from '../src/sim/combat.js';
import {vec} from '../src/sim/math.js';
import {combatModKey} from '../src/sim/entity.js';

let n = 0;const ok = l => {n++;console.log('✓', l);};
resetConfig(factoryDefaults());
const normal = vec(0, 1), relative = vec(0, 5);   // a (heading 0) aponta para +z, b (heading π) para -z; fecham um sobre o outro
/** Lutador mínimo: tackle de frente, PL e prioridade de combate configuráveis. */
const fighter = (heading, action = {}, prio = 0) => {
  const act = {kind: 'tackle', heading, pl: 1, ...action};   // a chave do Editor depende do PL (tackle / tackle_pl2 / tackle_pl3)
  return {id: 'x', flight: false, action: act, combatMods: prio ? {[combatModKey(act)]: {combatPriority: prio}} : null};
};
const pair = (a = {}, b = {}, pa = 0, pb = 0) => ({a: fighter(0, a, pa), b: fighter(Math.PI, b, pb)});

{ // base: dois tackles PL igual, prioridade igual → clash
  const {a, b} = pair();
  assert.equal(clashPossible(a, b, normal, relative), true);ok('base: tackle × tackle com PL e prioridade iguais fazem clash');
}
{ // Slam × tackle de PL igual: noClash barra o clash e ninguém é neutralizado
  const {a, b} = pair({slam: true, slamPrepDone: true, pl: 2}, {pl: 2});
  assert.equal(clashPossible(a, b, normal, relative), false);
  assert.ok(!a.action.neutralized && !b.action.neutralized);ok('Slam × tackle de mesmo PL: sem clash e ninguém neutralizado');
}
{ // Riposte × tackle de PL igual: idem
  const {a, b} = pair({riposteStrike: true, pl: 4}, {pl: 4});
  assert.equal(clashPossible(a, b, normal, relative), false);
  assert.ok(!a.action.neutralized && !b.action.neutralized);ok('Riposte × tackle de mesmo PL: sem clash e ninguém neutralizado');
}
{ // CORRIGIDO: mesmo PL e combatPriority diferente → Slam/Riposte não são neutralizados pela prioridade
  const {a, b} = pair({slam: true, slamPrepDone: true, pl: 2}, {pl: 2}, 0, 5);
  assert.equal(clashPossible(a, b, normal, relative), false);
  assert.ok(!a.action.neutralized && !b.action.neutralized && !a.plDefeated);ok('combatPriority maior não neutraliza o Slam');
  const r = pair({riposteStrike: true, pl: 4}, {pl: 4}, 0, 5);
  assert.equal(clashPossible(r.a, r.b, normal, relative), false);
  assert.ok(!r.a.action.neutralized && !r.b.action.neutralized);ok('combatPriority maior não neutraliza o contra-golpe do Riposte');
  const t = pair({}, {}, 0, 5);   // tackle × tackle: a prioridade continua desempatando
  assert.equal(clashPossible(t.a, t.b, normal, relative), false);assert.equal(t.a.action.neutralized, true);ok('tackle × tackle: combatPriority continua desempatando (menor neutralizado)');
}
{ // Diferença de PL também passa por cima do noClash (decisão por PL é o desenho documentado)
  const {a, b} = pair({slam: true, slamPrepDone: true, pl: 2}, {pl: 3});
  assert.equal(clashPossible(a, b, normal, relative), false);
  assert.equal(a.action.neutralized, true);ok('PL menor do Slam é neutralizado (desenho documentado: o PL decide)');
}
console.log(`\n${n} verificações de combatPriority × noClash aprovadas.`);
