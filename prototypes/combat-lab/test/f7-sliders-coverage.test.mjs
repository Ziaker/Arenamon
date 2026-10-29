// F7 (Task 15) — cobertura dos sliders com consumidor real: TODO slider do Editor (Ajustes + aba Moves/Editor de Moves) sai das definições reais e
// passa por: caminho em C, rótulo, unidade, faixa, padrão na faixa, round-trip JSON (Ajustes e preset), consumidor estático e A/B (mín × máx).
// Lógica em f7-sliders-coverage-lib.mjs; a matriz gerada é docs/MATRIZ_SLIDERS_F7.md (node scripts/gen-matriz-sliders.mjs).
import {existsSync, readFileSync} from 'node:fs';
import {assert, suite} from './moves-new-helpers.mjs';
import * as L from './f7-sliders-coverage-lib.mjs';
import {MOVES_PARAMS} from '../src/ui/moves-panel.js';
import {Game} from '../src/sim/game.js';
import {emptyCommand} from '../src/sim/entity.js';
import {vec} from '../src/sim/math.js';
import {C, resetConfig, defaults} from '../src/sim/config.js';

const {test, done} = suite('F7 — COBERTURA DOS SLIDERS (consumidor real, round-trip, A/B)');
const sliders = await L.allSliders(), {tuningManifest} = await L.tuningModule(), byId = new Map(sliders.map(s => [s.id, s]));
const rt = await L.roundTripProblems(sliders.filter(s => s.min < s.max));
/** Seletores de variante com UMA só variante registrada (faixa 0..0): o controle existe e o consumidor lê; ganham opções quando houver variantes. */
const SINGLE_OPTION = ['vfx.jumpLanding.variant', 'vfx.wallImpact.variant'];

test(`enumera TODOS os sliders das definições reais (${sliders.length}): manifesto do Ajustes + MOVES_PARAMS, sem id repetido`, () => {
  const manifest = tuningManifest(), moveRows = MOVES_PARAMS.reduce((n, [, rows]) => n + rows.length, 0);
  assert.equal(sliders.length, manifest.length + moveRows);
  assert.equal(new Set(sliders.map(s => s.id)).size, sliders.length, 'id repetido');
  assert.ok(sliders.length >= 1600, `só ${sliders.length}`);
});

test('definição: caminho numérico em C, rótulo próprio, formato válido, faixa não vazia e padrão dentro da faixa', () => {
  const bad = sliders.map(s => [s.id, L.definitionProblems(s).filter(p => !(SINGLE_OPTION.includes(s.id) && /faixa vazia/.test(p)))]).filter(([, p]) => p.length);
  assert.deepEqual(bad, []);
  for (const id of SINGLE_OPTION) assert.ok(byId.has(id), `${id} sumiu: tire de SINGLE_OPTION`);
});

test('round-trip JSON: exportar (formato do Ajustes) → importar (previewTuningImport) e preset salvo → lido preservam o valor de TODO slider', () => {
  assert.deepEqual(rt, []);
});

test('consumidor real: todo slider é lido fora dos arquivos de definição; órfãos só os rotulados «(sem efeito)»', () => {
  const none = sliders.filter(s => !L.findConsumer(s)).map(s => s.id), labeled = L.ORPHANS_LABELED.map(o => o.id);
  assert.deepEqual(none.filter(id => !labeled.includes(id)), [], 'slider sem consumidor e sem rótulo');
  assert.deepEqual(labeled.filter(id => !none.includes(id)), [], 'órfão rotulado que ganhou consumidor: tire da lista e do rótulo');
  for (const id of labeled) {
    const s = byId.get(id);assert.ok(s, `${id} não existe`);assert.ok(s.label.includes(L.ORPHAN_MARK), `${id}: rótulo sem «${L.ORPHAN_MARK}» (${s.label})`);
    assert.ok(/não aplicado/i.test(s.help ?? ''), `${id}: a dica ainda descreve um efeito que não existe (falta «não aplicado»): ${s.help}`);
  }
  // Recíproca: a marca «(sem efeito)» só nos órfãos listados (nenhum slider que funciona com o rótulo de órfão).
  assert.deepEqual(sliders.filter(s => s.label.includes(L.ORPHAN_MARK) && !labeled.includes(s.id)).map(s => s.id), []);
  for (const d of L.OWNER_DECISIONS) assert.ok(byId.has(d.id), `decisão pendente de slider inexistente: ${d.id}`);
});

test(`pendentes de A/B só diminuem (≤ ${L.PENDING_BUDGET}) e os pendentes só com evidência fraca de consumidor também (≤ ${L.WEAK_PENDING_BUDGET})`, () => {
  assert.ok(L.pendingCount() <= L.PENDING_BUDGET, `pendentes: ${L.pendingCount()}`);
  const weak = sliders.filter(s => L.classify(s).kind === 'pendente' && L.findConsumer(s)?.weak).map(s => s.id);
  assert.ok(weak.length <= L.WEAK_PENDING_BUDGET, `consumerWeak: ${weak.join(', ')}`);
});

test('famílias genéricas e allowlists sem regra morta', () => {
  for (const m of L.MANUAL_CONSUMERS) assert.ok(sliders.some(s => m.match.test(s.id)), `família sem slider: ${m.match}`);
  for (const v of L.VISUAL_OR_DEBUG) assert.ok(sliders.some(s => typeof v.match === 'function' ? s.moveGroup && v.match(s) : v.match.test(s.path)), `regra visual sem slider: ${v.match}`);
  for (const [k, g] of Object.entries(L.SENSITIVITY_PENDING)) for (const id of g.ids) {const s = byId.get(id);assert.ok(s, `pendente ${k} inexistente: ${id}`);assert.equal(L.classify(s).kind, 'pendente', `${id} pendente mas classificado como ${L.classify(s).kind}`);}
});

test('sem parâmetro jogável oculto: todo número de rules/actions/profiles/locomotion/map/ledge/passivas/world tem slider (exceto limites técnicos listados)', () => {
  assert.deepEqual(L.hiddenParams(sliders).filter(p => !(p in L.TECHNICAL_NO_SLIDER)), []);
  for (const p of Object.keys(L.TECHNICAL_NO_SLIDER)) assert.equal(typeof defaults().world[p.split('.')[1]], 'number', `${p} sumiu de C`);
});

test(`unidade: sliders numéricos sem unidade no formato não passam do orçamento (${L.UNIT_MISSING_BUDGET})`, () => {
  assert.ok(sliders.filter(L.missingUnit).length <= L.UNIT_MISSING_BUDGET);
});

test('extremo mínimo: Sand Wave com cegueira 0 s acerta sem exceção e sem aplicar cegueira', () => {
  resetConfig(defaults());C.world.sandWave.blind = 0;
  try {
    const g = new Game({seed: 7});g.reset({positions: [vec(0, -1.5), vec(0, 1.5)]});g.mapState.destructibles = [];g.mapState.obstacles = [];g.mapState.platforms = [];
    g.setLoadout(0, ['sand-wave']);g.fighters[0].facing = 0;g.fighters[1].facing = Math.PI;g.start();
    const ev = [];
    for (let t = 0; t < 300; t++) {g.step({...emptyCommand(), target: 1, skill: t === 1 ? 0 : null, skillHeld: [t === 1, false, false, false]}, emptyCommand());ev.push(...g.lastStepEvents);}
    assert.ok(ev.some(e => e.target === 1 && (e.rawDamage > 0 || e.hpDamage > 0)), 'a onda acerta');
    assert.ok(!ev.some(e => e.result === 'blinded'), 'cegueira 0 não cega');
  } finally {resetConfig(defaults());}
});

const doc = existsSync(L.DOC_PATH) ? readFileSync(L.DOC_PATH, 'utf8') : '', claims = L.claimsFrom(doc);
test('A/B: todo slider de gameplay (fora visual, órfão e pendente) muda o cenário registrado na matriz entre o mínimo e o máximo', () => {
  assert.ok(doc, 'matriz não gerada: node scripts/gen-matriz-sliders.mjs');
  const fail = [], control = new Map();
  for (const s of sliders) {
    if (L.classify(s).kind !== 'gameplay') continue;
    const claim = claims.get(s.id) ?? '', m = claim.match(/^muda · (.+)$/);
    if (!m) {fail.push(`${s.id}: matriz diz «${claim}»`);continue;}
    const r = L.verifyScenario(s, m[1]);if (!r.ok) fail.push(`${s.id}: ${r.detail}`);
    // Controle do passo travado: uma vez por cenário usado, o MESMO valor nos dois lados nunca pode divergir.
    if (!control.has(m[1])) control.set(m[1], [s.id, L.controlRun(s, m[1])]);
  }
  assert.deepEqual(fail, []);
  assert.deepEqual([...control].filter(([, [, t]]) => t !== -1).map(([sc, [id, t]]) => `${sc} (${id}) divergiu no passo ${t} com o mesmo valor`), []);
  assert.ok(control.size >= 20, `só ${control.size} cenários com controle`);
});

// Regenera com as MESMAS linhas A/B (verificadas acima); só o número da linha do consumidor pode variar.
const rebuilt = doc ? await L.buildMatrix(s => claims.get(s.id) ?? 'FALHA: sem linha') : '';
test('docs/MATRIZ_SLIDERS_F7.md igual à regeneração', () => {
  assert.ok(doc, 'matriz não gerada');
  assert.equal(L.normalizeMatrix(doc), L.normalizeMatrix(rebuilt));
});

done();
