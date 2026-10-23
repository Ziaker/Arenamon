// @ts-check
// Pré-jogo com três estilos (22/10/2026): o catálogo das telas vem do REGISTRO executável (nunca de lista nominal), passivas respeitam espécie e regras, e o modelo é puro.
import assert from 'node:assert/strict';
import {resetConfig, defaults} from '../src/sim/config.js';
import {clearMoves, listMoves} from '../src/sim/moves.js';
import {clearEffects} from '../src/sim/move-effects.js';
import {registerStandardMoves} from '../src/sim/moves/standard.js';
import {registerMove} from '../src/sim/moves.js';
import {MOVE_INFO} from '../src/ui/moves-panel.js';
import {moveCatalog, passiveCatalog, invalidReasons, iconForMove, keyLabel, usageLine, MOVE_ICON} from '../src/ui/menu-styles-model.js';
import {genericPassives, exclusivePassives, PASSIVE_SPECIES, PASSIVES} from '../src/sim/passives.js';

let passed = 0, failed = 0;
const test = (name, fn) => {try {fn();passed++;console.log(`  ✓ ${name}`);} catch (e) {failed++;console.error(`  ✗ ${name}: ${e.message}`);}};
console.log('\n--- PRÉ-JOGO: MODELO DAS TRÊS TELAS ---\n');
const boot = () => {resetConfig(defaults());clearMoves();clearEffects();registerStandardMoves();};

test('o catálogo de Moves é EXATAMENTE o registro executável (mesmos ids, mesma ordem), sem lista nominal', () => {
  boot();
  assert.deepEqual(moveCatalog(MOVE_INFO).map(m => m.id), listMoves().map(m => m.id));
  assert.ok(moveCatalog().length >= 15, 'os 15 Moves registrados');
});
test('um Move NÃO registrado não aparece (documentado, mas inexistente no motor); registrar faz aparecer', () => {
  boot();
  assert.ok(!moveCatalog().some(m => m.id === 'body-slam'));
  registerMove({id: 'teste-menu', name: 'Teste Menu', duration: .3, cost: .5, cooldown: 2, description: 'só para o teste'});
  const c = moveCatalog().find(m => m.id === 'teste-menu');
  assert.ok(c && c.name === 'Teste Menu' && c.cost === .5 && c.cooldown === 2, JSON.stringify(c));
});
test('custo e recarga são os do Move EFETIVO (sliders do grupo valem), e a descrição vem do texto real', () => {
  boot();
  const qa = moveCatalog(MOVE_INFO).find(m => m.id === 'quick-attack');
  assert.ok(qa && qa.cost > 0 && qa.cooldown > 0 && qa.description.length > 20, JSON.stringify(qa));
  assert.match(usageLine(qa), /^Custo \d+\.\d{2} de stamina · recarga \d+\.\d s$/);
});
test('ícones são decoração com fallback; rótulo de tecla', () => {
  assert.equal(iconForMove('quick-attack'), 'raio');assert.equal(iconForMove('inexistente'), 'impacto');
  assert.equal(keyLabel('KeyA'), 'A');assert.equal(keyLabel('Digit3'), '3');assert.equal(keyLabel(undefined), '');
  boot();for (const m of listMoves()) assert.ok(MOVE_ICON[m.id], `Move ${m.id} sem ícone mapeado (cai no padrão)`);
});
test('passivas: exclusivas SÓ da espécie atual e genéricas sempre; sem espécie = só genéricas', () => {
  for (const sp of PASSIVE_SPECIES) {
    const c = passiveCatalog(sp);
    assert.ok(c.exclusive.length > 0 && c.exclusive.every(p => p.especie === sp && p.origem === 'exclusiva'), sp);
    assert.deepEqual(c.generic.map(p => p.id), genericPassives().map(p => p.id));
  }
  const none = passiveCatalog(null);
  assert.equal(none.exclusive.length, 0);assert.ok(none.generic.every(p => p.origem === 'genérica' && p.especie === null));
  assert.equal(PASSIVES.length, passiveCatalog('mush').exclusive.length + passiveCatalog('croagunk').exclusive.length + passiveCatalog('drowzee').exclusive.length + passiveCatalog('vigoroth').exclusive.length + genericPassives().length);
});
test('invalidReasons repete as regras do painel/motor: duplicata, exclusiva de outra espécie, mais de 2', () => {
  const ex = exclusivePassives('croagunk')[0].id, g = genericPassives().slice(0, 3).map(p => p.id);
  assert.deepEqual(invalidReasons([g[0], g[1]], 'mush'), []);
  assert.ok(invalidReasons([g[0], g[0]], 'mush').length > 0, 'duplicata');
  assert.ok(invalidReasons([ex], 'mush').length > 0, 'exclusiva de outra espécie');
  assert.ok(invalidReasons([g[0], g[1], g[2]], 'mush').length > 0, 'mais de 2');
});

console.log(`\n${passed} passaram, ${failed} falharam`);
if (failed) process.exit(1);
