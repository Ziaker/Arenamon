// @ts-check
// Perfil tático declarativo da IA (#09): equivalência com as regras antigas (em código), validação do perfil e integração com a IA de Moves.
import {assert, suite, arena, C} from './moves-new-helpers.mjs';
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
  // regras que estavam em RULES de ai-new-moves.js até 25/10/2026 (copiadas sem mudança)
  lunge: (x, self) => x.distance > 1.7 && x.distance < 3.3 && x.facing && x.tGround && !x.tGuard && !x.tackling && self.stamina >= 2 ? {p: .3, kind: 'tap', why: 'fecha a distância com o Lunge'} : null,
  'quick-attack': (x, self) => x.distance > 3.2 && x.distance < 6.8 && x.tGround && !x.tGuard && !x.tackling && self.stamina >= 2 ? {p: .14, kind: 'tap', why: 'investida rápida e volta'} : null,
  riposte: (x, self) => x.tackling && x.ttc > .17 && x.ttc < .3 && x.distance < 4.5 && self.stamina >= 1 ? {p: .7, kind: 'tap', why: 'contra-ataque no tempo do golpe do rival'} : null,
  bounce: (x, self) => x.distance > 4 && x.distance < 6.2 && x.tGround && !x.tGuard && !x.tackling && !x.tCharging && self.stamina >= 2.2 ? {p: .12, kind: 'charge', goal: x.distance > 4.6 ? 74 : 14, why: 'salto sobre o rival'} : null,
  'sand-wave': (x, self) => x.distance < 3.4 && x.facing && x.tGround && self.stamina >= 2.2 ? {p: .3, kind: 'tap', why: 'barragem de areia no retângulo'} : null,
  spikes: (x, self) => x.distance > 3 && x.distance < 8 && x.tGround && self.stamina >= 1.5 ? {p: .22, kind: 'aim', mode: 'absolute', why: 'armadilha no caminho do rival'} : null,
  'bullet-punch': (x, self) => x.distance > 2.5 && x.distance < (C.world.bulletPunch.reach ?? 6) - .3 && x.tGround && self.stamina >= 2.2 ? {p: .25, kind: 'tap', why: 'soco-bala: some e golpeia o rival ao chegar'} : null,
  'emerging-stone': (x, self) => x.distance > 3.8 && x.distance < 6.4 && x.tGround && self.stamina >= 3 ? {p: .2, kind: 'aim', mode: 'cast', why: 'rocha emergente no rival'} : null,
  'water-pulse': (x, self) => x.distance > 3 && x.distance < 12 && self.stamina >= 1.5 ? {p: .3, kind: 'charge', goal: x.distance > 8 ? 100 : x.distance > 5 ? 50 : 20, why: 'esfera de água à distância'} : null,
  'fire-spin': (x, self) => x.distance > 2.2 && x.distance < 4.8 && x.tGround && self.stamina >= 1.5 ? {p: .22, kind: 'aim', mode: 'near', offset: 1.1, why: 'zona de fogo ao lado do rival'} : null,
  'air-slash': (x, self) => x.distance > 3 && x.distance < 9.5 && x.facing && self.stamina >= 1.2 ? {p: .4, kind: 'tap', why: 'lâmina de ar à distância'} : null,
  'seed-bomb': (x, self) => x.distance > 3 && x.distance < 7.5 && x.tGround && self.stamina >= 1.5 ? {p: .22, kind: 'aim', mode: 'near', offset: .9, why: 'semente explosiva perto do rival'} : null,
};
function* grid() {
  for (const distance of [0, 1.7, 1.71, 2.2, 2.21, 2.4, 2.41, 2.5, 2.51, 3, 3.01, 3.2, 3.21, 3.3, 3.4, 3.5, 3.51, 3.8, 3.81, 4, 4.01, 4.5, 4.6, 4.61, 4.8, 5, 5.01, 5.69, 5.7, 6, 6.2, 6.4, 6.8, 7.5, 8, 8.01, 9.5, 10.99, 11, 12])
    for (const bits of Array.from({length: 32}, (_, i) => i))
      for (const stamina of [0, .99, 1, 1.19, 1.2, 1.29, 1.3, 1.49, 1.5, 1.59, 1.6, 1.99, 2, 2.19, 2.2, 2.99, 3])
        for (const status of [null, 'harden', 'second-wind'])
          for (const ttc of [Infinity, .17, .2, .3])
            yield [{distance, tGround: !!(bits & 1), tGuard: !!(bits & 2), facing: !!(bits & 4), tackling: !!(bits & 8), tCharging: !!(bits & 16), ttc}, {stamina, statuses: status ? [{id: status}] : []}];
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
  assert.ok(comPerfil.length >= 16, 'todos os Moves com IA (exceto o Feint, decidido durante o Tackle) têm perfil na ficha');
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
