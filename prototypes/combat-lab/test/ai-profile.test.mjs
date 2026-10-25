// @ts-check
// Perfil tático declarativo da IA (#09): equivalência com as regras antigas (em código), validação do perfil e integração com a IA de Moves.
import {assert, suite, arena} from './moves-new-helpers.mjs';
import {compileAiProfile, validateAiProfile, getAiRule, getAiProfile, aiProfileIds} from '../src/sim/ai-profile.js';
import {FICHAS} from '../src/sim/moves/fichas.generated.js';

const {test, done} = suite('PERFIL TÁTICO DECLARATIVO DA IA');

/** As regras que existiam em ai-new-moves.js ANTES da migração (contrato de equivalência). */
const has = (f, id) => !!f.statuses?.some(s => s.id === id);
const LEGACY = {
  harden: (x, self) => !has(self, 'harden') && x.distance < 4.5 && (x.tackling || x.tCharging) ? {p: .55, kind: 'tap', why: 'rival atacando perto: endurece'} : null,
  'second-wind': (x, self) => !has(self, 'second-wind') && self.stamina < 1.3 && x.distance > 3 && !x.tackling ? {p: .6, kind: 'tap', why: 'stamina baixa e rival longe: recupera'} : null,
  swift: x => x.distance > 3.5 && x.distance < 11 && x.tGround ? {p: .4, kind: 'tap', why: 'estrelas à distância'} : null,
  'guard-break': (x, self) => x.tGuard && x.distance < 3.3 && x.tGround && self.stamina >= 1.6 ? {p: .6, kind: 'charge', goal: x.distance > 2.4 ? 62 : 32, why: 'rival defendendo: quebra a guarda'} : null,
};
function* grid() {
  for (const distance of [0, 1.7, 2.4, 2.41, 3, 3.01, 3.3, 3.5, 3.51, 4.5, 6, 10.99, 11, 12])
    for (const bits of Array.from({length: 32}, (_, i) => i))
      for (const stamina of [0, 1.29, 1.3, 1.59, 1.6, 3])
        for (const status of [null, 'harden', 'second-wind'])
          yield [{distance, tGround: !!(bits & 1), tGuard: !!(bits & 2), facing: !!(bits & 4), tackling: !!(bits & 8), tCharging: !!(bits & 16)}, {stamina, statuses: status ? [{id: status}] : []}];
}

test('as regras compiladas dos perfis das fichas são idênticas às regras antigas em toda a grade de contextos', () => {
  let n = 0;
  for (const [id, legacy] of Object.entries(LEGACY)) {
    arena();   // registra os Moves e, com eles, os perfis das fichas
    const rule = getAiRule(id);assert.ok(rule, `${id}: sem perfil registrado`);
    for (const [x, self] of grid()) {assert.deepEqual(rule(x, self, {}), legacy(x, self), `${id} ${JSON.stringify([x, self])}`);n++;}
  }
  assert.ok(n > 10000, 'a grade cobre muitos contextos');
});
test('toda ficha com perfil tem perfil válido, registrado e com motivo para o log', () => {
  arena();
  const comPerfil = FICHAS.filter(f => f.ai);
  assert.ok(comPerfil.length >= 4);
  for (const f of comPerfil) {assert.deepEqual(validateAiProfile(f.ai), [], f.def.id);assert.ok(aiProfileIds().includes(f.def.id));assert.ok(getAiProfile(f.def.id).why.length > 5);}
});
test('perfil inválido é recusado com a causa', () => {
  assert.ok(validateAiProfile({kind: 'tap', p: 0, why: 'x'}).some(e => /chance base/.test(e)));
  assert.ok(validateAiProfile({kind: 'zzz', p: .5, why: 'x'}).some(e => /kind/.test(e)));
  assert.ok(validateAiProfile({kind: 'tap', p: .5}).some(e => /why/.test(e)));
  assert.ok(validateAiProfile({kind: 'tap', p: .5, why: 'x', requires: ['inexistente']}).some(e => /sinalizador/.test(e)));
  assert.ok(validateAiProfile({kind: 'tap', p: .5, why: 'x', distance: {min: 5, max: 2}}).some(e => /menor que/.test(e)));
  assert.ok(validateAiProfile({kind: 'charge', p: .5, why: 'x'}).some(e => /goal/.test(e)));
  assert.ok(validateAiProfile({kind: 'aim', p: .5, why: 'x'}).some(e => /mode/.test(e)));
  assert.throws(() => compileAiProfile({kind: 'tap', p: 2, why: 'x'}), /perfil de IA inválido/);
});
test('condição especial (when) e plano de marcador saem na regra compilada', () => {
  const rule = compileAiProfile({kind: 'aim', p: .2, why: 'teste', mode: 'near', offset: 1.1, distance: {min: 2}, when: (x, self) => self.stamina > 1});
  assert.equal(rule({distance: 3}, {stamina: 0}, {}), null);
  assert.deepEqual(rule({distance: 3}, {stamina: 2}, {}), {p: .2, kind: 'aim', why: 'teste', mode: 'near', offset: 1.1});
});

done();
