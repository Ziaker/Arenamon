// @ts-check
// Assistente de ficha de Move (#02): nada é preenchido por suposição, lacunas e conflitos aparecem, quatro status independentes por campo,
// JSON/Markdown preservam proveniência e fichas antigas (v1, um status só) continuam abrindo.
import {assert, suite} from './moves-new-helpers.mjs';
import {newSpec, validateSpec, specToMarkdown, specToJSON, parseSpec, statusCounts, noFlags, GOV_FLAGS, ALL_FIELDS, SPEC_SECTIONS, SPEC_VERSION} from '../src/ui/move-spec-model.js';

const {test, done} = suite('ASSISTENTE DE FICHA DE MOVE');
const fill = (spec, o) => {for (const [k, v] of Object.entries(o)) spec.fields[k] = {value: v, flags: {...noFlags(), proposto: true}, source: 'teste'};return spec;};

test('uma ficha nova tem todos os campos da ficha obrigatória, todos pendentes e SEM nenhum status ligado (nada é suposto)', () => {
  const s = newSpec();
  assert.equal(Object.keys(s.fields).length, ALL_FIELDS.length);
  assert.ok(SPEC_SECTIONS.length >= 10 && ALL_FIELDS.length >= 20);
  assert.ok(Object.values(s.fields).every(f => f.value === '' && GOV_FLAGS.every(g => f.flags[g] === false)));
  assert.equal(validateSpec(s).filter(g => g.kind === 'lacuna').length, ALL_FIELDS.filter(f => f.required).length);
  assert.equal(statusCounts(s).pendente, ALL_FIELDS.length);
  assert.deepEqual(GOV_FLAGS, ['proposto', 'aprovado', 'implementado', 'homologado']);
});
test('os quatro status são independentes: um campo pode ser implementado sem estar aprovado', () => {
  const s = fill(newSpec(), {name: 'Meu Move'});
  s.fields.name.flags = {proposto: true, aprovado: false, implementado: true, homologado: false};
  const c = statusCounts(s);
  assert.deepEqual([c.proposto, c.aprovado, c.implementado, c.homologado], [1, 0, 1, 0]);
  assert.equal(validateSpec(s).some(g => g.field === 'name'), false, 'combinação válida não gera conflito');
});
test('lacunas somem só quando o responsável responde; o assistente não completa nada', () => {
  const s = fill(newSpec(), {id: 'meu-move', name: 'Meu Move'});
  const gaps = validateSpec(s).filter(g => g.kind === 'lacuna').map(g => g.field);
  assert.ok(!gaps.includes('id') && !gaps.includes('name') && gaps.includes('category') && gaps.includes('knockback'));
});
test('conflitos: Burst com carga, SEM PL citando Clash, ID inválido, Charge sem carga e status sem valor', () => {
  assert.ok(validateSpec(fill(newSpec(), {category: 'Burst', cast: 'segure para carregar 1 s'})).some(g => g.kind === 'conflito' && g.field === 'category'));
  assert.ok(validateSpec(fill(newSpec(), {pl: 'SEM PL', purpose: 'vence o Clash'})).some(g => g.kind === 'conflito' && g.field === 'pl'));
  assert.ok(validateSpec(fill(newSpec(), {id: 'Meu Move!'})).some(g => g.kind === 'formato'));
  const d = newSpec();d.fields.cost.flags.aprovado = true;
  assert.ok(validateSpec(d).some(g => g.field === 'cost' && g.kind === 'conflito' && /aprovado/.test(g.message)));
  assert.ok(validateSpec(fill(newSpec(), {category: 'Charge', cast: '0,3 s'})).some(g => g.kind === 'conflito' && g.field === 'cast'));
});
test('JSON v2 preserva valor, os quatro status e a fonte; formato inválido é recusado', () => {
  const s = fill(newSpec(), {id: 'meu-move', name: 'Meu Move'});s.fields.name.flags = {proposto: true, aprovado: true, implementado: false, homologado: false};s.fields.name.source = 'M18.1';
  const back = parseSpec(specToJSON(s));
  assert.ok(!back.error);assert.equal(JSON.parse(specToJSON(s)).version, SPEC_VERSION);
  assert.deepEqual(back.spec.fields.name, {value: 'Meu Move', flags: {proposto: true, aprovado: true, implementado: false, homologado: false}, source: 'M18.1'});
  assert.match(parseSpec('x').error, /JSON inválido/);
  assert.match(parseSpec({schema: 'outro'}).error, /Não é uma ficha/);
  assert.match(parseSpec({schema: 'arenamon-move-spec', version: 9}).error, /desconhecida/);
});
test('ficha antiga (v1, status único) abre e vira o status correspondente ligado', () => {
  const old = {schema: 'arenamon-move-spec', version: 1, createdAt: '2026-10-23T00:00:00Z', fields: {name: {value: 'Velho', status: 'aprovado', source: 'M1'}, id: {value: 'velho', status: 'pendente', source: ''}}};
  const r = parseSpec(old);
  assert.ok(!r.error);
  assert.deepEqual(r.spec.fields.name.flags, {proposto: false, aprovado: true, implementado: false, homologado: false});
  assert.deepEqual(r.spec.fields.id.flags, noFlags());
});
test('o Markdown mostra PENDENTE, a coluna Governança, as decisões abertas e o comando para criar o Move', () => {
  const md = specToMarkdown(fill(newSpec(), {id: 'meu-move', name: 'Meu Move', category: 'Normal'}));
  assert.match(md, /^# Ficha de Move — Meu Move/);
  assert.match(md, /\*\*PENDENTE\*\*/);assert.match(md, /Governança/);
  assert.match(md, /Decisões abertas e conflitos/);
  assert.match(md, /npm run novo-move -- "Meu Move"/);
  assert.match(md, /\| Categoria oficial \| Normal \| proposto \| teste \|/);
});

done();
