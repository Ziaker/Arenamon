// Vitrine de Moves (fase 4): o modelo puro — equipados em destaque por slot, não equipados abaixo, equipar/trocar/tirar.
// Uso: node prototypes/combat-lab/test/move-showcase.test.mjs
import assert from 'node:assert/strict';
import {buildShowcase, equipInto, firstFreeSlot, statusBadge} from '../src/editor/move-showcase-model.js';

let n = 0;
const ok = (name, fn) => {try {fn();n++;console.log('  ✓ ' + name);} catch (e) {console.log('  ✗ ' + name + '\n' + (e.stack || e.message).split('\n').slice(0, 4).join('\n'));process.exitCode = 1;}};
const card = (id, o = {}) => ({id, name: id.toUpperCase(), category: null, types: [], pl: null, status: null, hint: '', cost: 1, cooldown: 5, editable: true, ...o});
const cards = [card('sand-wave'), card('harden'), card('reflect', {editable: false}), card('psyshock', {editable: false}), card('air-slash'), card('bounce')];
const keys = i => 'ASDF'[i];

ok('equipados aparecem na ordem dos slots, com o botão do jogo; slots vazios também aparecem', () => {
  const s = buildShowcase({loadout: ['harden', null, 'sand-wave', null], slots: 4, keys, cards});
  assert.deepEqual(s.equipped.map(e => [e.slot, e.key, e.id]), [[0, 'A', 'harden'], [1, 'S', null], [2, 'D', 'sand-wave'], [3, 'F', null]]);
  assert.equal(s.free, 2);
  assert.equal(s.equipped[0].name, 'HARDEN');
});
ok('os não equipados são os que sobram: sem repetir equipado; editáveis primeiro, depois por nome', () => {
  const s = buildShowcase({loadout: ['harden', null, 'sand-wave', null], slots: 4, keys, cards});
  assert.deepEqual(s.others.map(c => c.id), ['air-slash', 'bounce', 'psyshock', 'reflect']);
  const ids = [...s.equipped.map(e => e.id).filter(Boolean), ...s.others.map(c => c.id)];
  assert.equal(new Set(ids).size, ids.length, 'nenhum Move duplicado');
  assert.equal(ids.length, cards.length, 'nenhum Move sumiu');
});
ok('loadout com id desconhecido vira slot vazio (não quebra a vitrine)', () => {
  const s = buildShowcase({loadout: ['fantasma', 'harden'], slots: 2, keys, cards});
  assert.equal(s.equipped[0].id, null);
  assert.equal(s.equipped[1].id, 'harden');
});
ok('sem nada equipado: todos os Moves estão em «não equipados»', () => {
  const s = buildShowcase({loadout: [], slots: 3, keys, cards});
  assert.equal(s.free, 3);
  assert.equal(s.others.length, cards.length);
});
ok('equipInto: põe no slot, não repete o Move em dois slots e esvazia com null', () => {
  assert.deepEqual(equipInto(['harden', null, null, null], 4, 2, 'sand-wave'), ['harden', null, 'sand-wave', null]);
  assert.deepEqual(equipInto(['harden', null, 'sand-wave', null], 4, 0, 'sand-wave'), ['sand-wave', null, null, null], 'mover: o slot antigo esvazia');
  assert.deepEqual(equipInto(['harden', 'bounce', null, null], 4, 1, null), ['harden', null, null, null]);
  assert.deepEqual(equipInto(['harden'], 4, 3, 'bounce'), ['harden', null, null, 'bounce'], 'completa o tamanho com vazios');
  const original = ['harden', null];equipInto(original, 2, 1, 'bounce');
  assert.deepEqual(original, ['harden', null], 'não altera o array recebido');
});
ok('firstFreeSlot acha o primeiro vazio (ou -1)', () => {
  assert.equal(firstFreeSlot(['a', null, 'b'], 3), 1);
  assert.equal(firstFreeSlot(['a', 'b'], 2), -1);
  assert.equal(firstFreeSlot([], 4), 0);
});
ok('statusBadge: do mais avançado para o mais cru', () => {
  assert.equal(statusBadge(null), null);
  assert.equal(statusBadge({proposto: true}).text, 'proposto');
  assert.equal(statusBadge({proposto: true, aprovado: true}).text, 'aprovado');
  assert.equal(statusBadge({proposto: true, aprovado: true, implementado: true}).text, 'aprovado');
  assert.equal(statusBadge({implementado: true}).text, 'implementado');
  assert.equal(statusBadge({proposto: true, aprovado: true, implementado: true, homologado: true}).text, 'homologado');
});
console.log(`${n} verificações da vitrine de Moves.`);
