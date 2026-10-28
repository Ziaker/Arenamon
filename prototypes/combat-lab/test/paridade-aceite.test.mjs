// @ts-check
// Task 12 (F5) — regras de aceite das baselines de paridade visual (test/paridade-aceite.mjs, usado por
// moves-vfx-parity.browser.mjs --aceitar=...): nunca misturar layouts, nunca aceitar efeito com análise pendente.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EFEITOS, planoDeAceite, assinaturaLayout} from './paridade-aceite.mjs';

const vp = {w: 1400, h: 900};
const cand = (layout = 'padrao', over = {}) => ({layout, viewport: vp, efeitos: Object.fromEntries(EFEITOS.map(e => [e, {layout, viewport: vp, ...(over[e] ?? {})}]))});
const todosExistem = () => true;

test('assinatura junta layout e viewport', () => {
  assert.equal(assinaturaLayout({layout: 'padrao', viewport: vp}), 'padrao@1400x900');
});

test('efeito desconhecido é recusado', () => {
  const r = planoDeAceite({alvo: 'xyz', candidatas: cand(), baselines: null, analise: {}, existe: todosExistem});
  assert.equal(r.ok, false);assert.match(r.erro, /desconhecido/i);
});

test('sem manifesto de candidatas é recusado', () => {
  const r = planoDeAceite({alvo: 'todos', candidatas: null, baselines: null, analise: {}, existe: todosExistem});
  assert.equal(r.ok, false);assert.match(r.erro, /update-baselines/);
});

test('todos: aceita os 5 juntos quando o layout é o mesmo e nada está pendente', () => {
  const r = planoDeAceite({alvo: 'todos', candidatas: cand(), baselines: null, analise: {}, existe: todosExistem});
  assert.equal(r.ok, true);
  assert.deepEqual(r.copias, EFEITOS);
  assert.equal(r.manifestoBase?.layout, 'padrao');assert.deepEqual(r.manifestoBase?.viewport, vp);
});

test('todos: recusa candidatas com layouts misturados', () => {
  const r = planoDeAceite({alvo: 'todos', candidatas: cand('padrao', {'water-pulse-voo': {layout: 'painel-aberto'}}), baselines: null, analise: {}, existe: todosExistem});
  assert.equal(r.ok, false);assert.match(r.erro, /layout/i);
});

test('todos: recusa se faltar uma candidata', () => {
  const r = planoDeAceite({alvo: 'todos', candidatas: cand(), baselines: null, analise: {}, existe: p => !p.endsWith('water-pulse-splash.png')});
  assert.equal(r.ok, false);assert.match(r.erro, /water-pulse-splash/);
});

test('efeito com análise pendente é recusado (sozinho ou em todos)', () => {
  const analise = {'water-pulse-voo': {pendente: true, texto: 'em investigação'}};
  for (const alvo of ['todos', 'water-pulse-voo']) {
    const r = planoDeAceite({alvo, candidatas: cand(), baselines: {layout: 'padrao', viewport: vp}, analise, existe: todosExistem});
    assert.equal(r.ok, false, alvo);assert.match(r.erro, /pendente/i);
  }
});

test('um efeito só: recusado sem manifesto das baselines (layout delas desconhecido)', () => {
  const r = planoDeAceite({alvo: 'sand-wave-ativo', candidatas: cand(), baselines: null, analise: {}, existe: todosExistem});
  assert.equal(r.ok, false);assert.match(r.erro, /--aceitar=todos/);
});

test('um efeito só: recusado se o layout da candidata difere do das baselines', () => {
  const r = planoDeAceite({alvo: 'sand-wave-ativo', candidatas: cand('padrao'), baselines: {layout: 'painel-aberto', viewport: vp}, analise: {}, existe: todosExistem});
  assert.equal(r.ok, false);assert.match(r.erro, /--aceitar=todos/);
});

test('um efeito só: aceito quando o layout bate com o das baselines', () => {
  const r = planoDeAceite({alvo: 'sand-wave-ativo', candidatas: cand('padrao'), baselines: {layout: 'padrao', viewport: vp}, analise: {}, existe: todosExistem});
  assert.equal(r.ok, true);assert.deepEqual(r.copias, ['sand-wave-ativo']);
});
