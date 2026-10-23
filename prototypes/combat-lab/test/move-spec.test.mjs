// @ts-check
// Assistente de ficha de Move (#02): nada é preenchido por suposição, lacunas e conflitos aparecem, JSON/Markdown preservam proveniência.
import {assert, suite} from './moves-new-helpers.mjs';
import {newSpec, validateSpec, specToMarkdown, specToJSON, parseSpec, statusCounts, ALL_FIELDS, SPEC_SECTIONS} from '../src/ui/move-spec-model.js';

const {test, done} = suite('ASSISTENTE DE FICHA DE MOVE');
const fill = (spec, o) => {for (const [k, v] of Object.entries(o)) spec.fields[k] = {value: v, status: 'proposto', source: 'teste'};return spec;};

test('uma ficha nova tem todos os campos da ficha obrigatória e TODOS pendentes (nada é suposto)', () => {
  const s = newSpec();
  assert.equal(Object.keys(s.fields).length, ALL_FIELDS.length);
  assert.ok(SPEC_SECTIONS.length >= 10 && ALL_FIELDS.length >= 20);
  assert.ok(Object.values(s.fields).every(f => f.status === 'pendente' && f.value === ''));
  const gaps = validateSpec(s).filter(g => g.kind === 'lacuna');
  assert.equal(gaps.length, ALL_FIELDS.filter(f => f.required).length);
  assert.equal(statusCounts(s).pendente, ALL_FIELDS.length);
});
test('lacunas somem só quando o responsável responde; o assistente não completa nada', () => {
  const s = fill(newSpec(), {id: 'meu-move', name: 'Meu Move'});
  const gaps = validateSpec(s).filter(g => g.kind === 'lacuna').map(g => g.field);
  assert.ok(!gaps.includes('id') && !gaps.includes('name') && gaps.includes('category') && gaps.includes('knockback'));
});
test('conflitos: Burst com carga, SEM PL citando Clash, ID inválido e status sem valor', () => {
  const a = validateSpec(fill(newSpec(), {category: 'Burst', cast: 'segure para carregar 1 s'}));
  assert.ok(a.some(g => g.kind === 'conflito' && g.field === 'category'));
  const b = validateSpec(fill(newSpec(), {pl: 'SEM PL', purpose: 'vence o Clash'}));
  assert.ok(b.some(g => g.kind === 'conflito' && g.field === 'pl'));
  const c = validateSpec(fill(newSpec(), {id: 'Meu Move!'}));
  assert.ok(c.some(g => g.kind === 'formato'));
  const d = newSpec();d.fields.cost = {value: '', status: 'aprovado', source: ''};
  assert.ok(validateSpec(d).some(g => g.field === 'cost' && g.kind === 'conflito'));
  const e = validateSpec(fill(newSpec(), {category: 'Charge', cast: '0,3 s'}));
  assert.ok(e.some(g => g.kind === 'conflito' && g.field === 'cast'));
});
test('JSON preserva valor, status e fonte; formato inválido é recusado', () => {
  const s = fill(newSpec(), {id: 'meu-move', name: 'Meu Move'});s.fields.name.status = 'aprovado';s.fields.name.source = 'M18.1';
  const back = parseSpec(specToJSON(s));
  assert.ok(!back.error);
  assert.deepEqual(back.spec.fields.name, {value: 'Meu Move', status: 'aprovado', source: 'M18.1'});
  assert.match(parseSpec('x').error, /JSON inválido/);
  assert.match(parseSpec({schema: 'outro'}).error, /Não é uma ficha/);
  assert.match(parseSpec({schema: 'arenamon-move-spec', version: 9}).error, /desconhecida/);
});
test('o Markdown mostra PENDENTE, as decisões abertas e o comando para criar o Move', () => {
  const md = specToMarkdown(fill(newSpec(), {id: 'meu-move', name: 'Meu Move', category: 'Normal'}));
  assert.match(md, /^# Ficha de Move — Meu Move/);
  assert.match(md, /\*\*PENDENTE\*\*/);
  assert.match(md, /Decisões abertas e conflitos/);
  assert.match(md, /npm run novo-move -- "Meu Move"/);
  assert.match(md, /\| Categoria oficial \| Normal \| proposto \| teste \|/);
});

done();
