import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {createPackage, openPackage} from '../package-io.mjs';
import {zipSync, unzipSync} from 'fflate';

const root = new URL('../', import.meta.url);
const validation = new URL('validation/', root);
await mkdir(validation, {recursive: true});
await build({
  entryPoints: [fileURLToPath(new URL('src/index.ts', root))],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: fileURLToPath(new URL('f0.mjs', validation)),
});

const api = await import(new URL('f0.mjs', validation));
const passed = [];
const test = (name, fn) => {
  fn();
  passed.push(name);
  console.log('PASS', name);
};

const phase = (duration = 0.1, enabled = true) => ({enabled, duration, tracks: []});
const project = () => ({
  schema: 'arenamon.vfx-project',
  schemaVersion: 1,
  projectId: 'project-water-pulse',
  revision: 1,
  effectId: 'water-pulse.custom',
  phases: {
    start: phase(), launch: phase(), body: phase(0.2), hold: phase(0.3),
    finish: phase(0.15), impact: phase(0.08),
  },
  nodes: [], assets: [], subeffects: [],
  timeline: {fps: 30, tracks: []},
  qualityProfiles: {},
  accessibility: {noFlash: false, reduceMotion: false},
  pinnedComponents: [{componentId: 'ring.core', version: '1.10.0'}],
});

test('schema aceita projeto canônico e rejeita ausência, futuro e não finitos', () => {
  assert.equal(api.validateProject(project()).ok, true);
  const missing = project(); delete missing.projectId;
  assert.equal(api.validateProject(missing).ok, false);
  assert.match(api.validateProject(missing).issues[0].path, /projectId/);
  const future = project(); future.schemaVersion = 2;
  assert.match(api.validateProject(future).issues.map(x => x.message).join(' '), /futura/i);
  const nonFinite = project(); nonFinite.phases.body.duration = Infinity;
  assert.match(api.validateProject(nonFinite).issues.map(x => x.message).join(' '), /finito/i);
});

test('assets rejeitam caminho absoluto traversal e protocolo remoto', () => {
  for (const uri of ['C:\\segredo.png', '../segredo.png', '/etc/passwd', 'https://example.com/a.png']) {
    const value = project(); value.assets = [{assetId: 'texture-a', uri, kind: 'texture'}];
    const result = api.validateProject(value);
    assert.equal(result.ok, false, uri);
    assert.match(result.issues.map(x => x.message).join(' '), /caminho/i);
  }
  const safe = project(); safe.assets = [{assetId: 'texture-a', uri: 'assets/water/mask.png', kind: 'texture'}];
  assert.equal(api.validateProject(safe).ok, true);
});

test('runtime e binding validam trigger, anchor e versão fixa', () => {
  const runtime = {schema: 'arenamon.vfx-runtime', schemaVersion: 1, effectId: 'water-pulse.custom', version: '1.0.0', phases: project().phases, budget: {particles: 100, lights: 1, drawCalls: 3}};
  assert.equal(api.validateRuntime(runtime).ok, true);
  const binding = {moveId: 'water-pulse', trigger: 'hit', effectId: 'water-pulse.custom', version: '1.10.0', anchor: 'contact', offsets: {x: 0, y: 0, z: 0}};
  assert.equal(api.validateEffectBinding(binding).ok, true);
  assert.equal(api.validateEffectBinding({...binding, trigger: 'mystery'}).ok, false);
  assert.equal(api.validateEffectBinding({...binding, anchor: ''}).ok, false);
  assert.equal(api.validateEffectBinding({...binding, version: 'latest'}).ok, false);
});

test('versões ordenam 1.9 antes de 1.10 e componentes ficam fixados', () => {
  assert.equal(api.compareVersions('1.9.0', '1.10.0'), -1);
  assert.equal(api.compareVersions('1.10.0', '1.9.0'), 1);
  const encoded = api.serializeProject(project());
  const decoded = api.deserializeProject(encoded);
  assert.equal(decoded.ok, true);
  assert.deepEqual(decoded.value, project());
  assert.equal(decoded.value.pinnedComponents[0].version, '1.10.0');
  assert.equal(api.deserializeProject('{"schemaVersion":1,"code":"eval(1)"}').ok, false);
});

test('relógio omite fases off, preserva dados e escolhe apenas um desfecho', () => {
  const value = project(); value.phases.launch.enabled = false;
  const finish = api.buildAuthoringClock(value.phases, 'finish');
  assert.deepEqual(finish.segments.map(x => x.phase), ['start', 'body', 'hold', 'finish']);
  assert.equal(value.phases.launch.duration, 0.1);
  assert.equal(finish.invisible, false);
  const impact = api.buildAuthoringClock(value.phases, 'impact');
  assert.deepEqual(impact.segments.map(x => x.phase), ['start', 'body', 'hold', 'impact']);
  for (const key of Object.keys(value.phases)) value.phases[key].enabled = false;
  assert.equal(api.buildAuthoringClock(value.phases, 'finish').invisible, true);
});

test('frames 24 30 60 mantêm segundos e scrub determinístico', () => {
  for (const fps of [24, 30, 60]) {
    assert.equal(api.frameToSeconds(fps, fps), 1);
    assert.equal(api.secondsToFrame(1, fps), fps);
  }
  const phases = project().phases;
  const clock = api.buildAuthoringClock(phases, 'impact');
  assert.deepEqual(api.sampleAuthoringClock(clock, 0.35), api.sampleAuthoringClock(clock, 0.35));
});

test('eventos desconhecidos miss timeout e cancel nunca viram hit ou impact', () => {
  assert.equal(api.classifyComposerEvent('impact'), 'hit');
  assert.equal(api.classifyComposerEvent('miss'), 'miss');
  assert.equal(api.classifyComposerEvent('timeout'), 'timeout');
  assert.equal(api.classifyComposerEvent('cancel'), 'cancel');
  assert.equal(api.classifyComposerEvent('mystery'), 'unsupported');
  for (const input of ['miss', 'timeout']) assert.equal(api.selectOutcome(input), 'finish');
  for (const input of ['cancel', 'mystery', 'spawn', 'cast']) assert.equal(api.selectOutcome(input), null);
  assert.equal(api.selectOutcome('impact'), 'impact');
  assert.equal(api.selectOutcome('clash'), 'impact');
  assert.equal(api.selectOutcome('perfectDodge'), null);
});

test('cancelamento e cleanup são idempotentes e informam motivo', () => {
  const life = new api.VisualLifecycle('instance-1');
  assert.equal(life.cancel('reset').changed, true);
  assert.equal(life.cancel('reset').changed, false);
  assert.equal(life.cleanup().changed, true);
  assert.equal(life.cleanup().changed, false);
  assert.deepEqual(life.snapshot(), {instanceId: 'instance-1', status: 'cleaned', cancelReason: 'reset'});
});

test('mesma seed repete sequência e seeds diferentes divergem', () => {
  const a = api.createDeterministicRandom(123), b = api.createDeterministicRandom(123), c = api.createDeterministicRandom(124);
  const seqA = [a(), a(), a()], seqB = [b(), b(), b()], seqC = [c(), c(), c()];
  assert.deepEqual(seqA, seqB);
  assert.notDeepEqual(seqA, seqC);
});

test('orçamento agrega custos e bloqueia publicação acima do perfil', () => {
  assert.equal(api.evaluateBudget('low', {particles: 400, lights: 0, drawCalls: 20}).publishable, true);
  const over = api.evaluateBudget('low', {particles: 401, lights: 1, drawCalls: 20});
  assert.equal(over.publishable, false);
  assert.deepEqual(over.over.sort(), ['lights', 'particles']);
  assert.equal(api.evaluateBudget('high', {particles: 1400, lights: 16, drawCalls: 100}).publishable, true);
});

test('entrada hostil profunda é rejeitada sem executar getters ou perder dados', () => {
  for (const bad of [NaN, Infinity, undefined, () => 1, 1n]) {
    const p = project(); p.nodes = [{nested: {value: bad}}];
    assert.equal(api.validateProject(p).ok, false);
  }
  const cyclic = project(); cyclic.nodes.push(cyclic);
  assert.equal(api.validateProject(cyclic).ok, false);
  let invoked = false;
  const getter = project(); Object.defineProperty(getter, 'effectId', {get() {invoked = true; return 'x';}, enumerable: true});
  assert.equal(api.validateProject(getter).ok, false);
  assert.equal(invoked, false);
  const fps = project(); fps.timeline.fps = '30';
  assert.equal(api.validateProject(fps).ok, false);
  for (const inherited of ['constructor', '__proto__', 'toString']) assert.equal(api.classifyComposerEvent(inherited), 'unsupported');
  assert.throws(() => api.compareVersions('9007199254740993.0.0', '1.0.0'));
});

test('recuperação mantém snapshot anterior e rejeita revisão antiga', () => {
  const storage = new Map();
  const store = {getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value)};
  const first = project(); api.saveRecoverable(store, first);
  const next = project(); next.revision = 2; next.phases.start.enabled = false;
  api.saveRecoverable(store, next);
  assert.deepEqual(api.recoverProject(store, first.projectId).project, next);
  assert.throws(() => api.saveRecoverable(store, first), /Revisão/);
  storage.set(`arenamon.vfx.${first.projectId}`, 'corrompido');
  const recovered = api.recoverProject(store, first.projectId);
  assert.equal(recovered.recovered, true);
  assert.deepEqual(recovered.project, first);
  assert.equal(storage.get(`arenamon.vfx.${first.projectId}`), 'corrompido');
});

test('orçamento não inventa teto de draw calls nem certificação de performance', () => {
  const assessment = api.evaluateBudget('low', {particles: 1, lights: 0, drawCalls: 1000});
  assert.equal(assessment.publishable, true);
  assert.equal(assessment.performanceVerified, false);
  assert.equal(api.evaluateBudget('low', {particles: -1, lights: 0, drawCalls: 0}).publishable, false);
  assert.throws(() => api.evaluateBudget('constructor', {particles: 0, lights: 0, drawCalls: 0}));
});

test('conteúdo tipado rejeita referências ausentes, ciclos e keyframes inválidos', () => {
  const p = project();
  p.nodes = [{id: 'root', kind: 'group', parentId: null, assetIds: []}];
  p.timeline.tracks = [{id: 'opacity', targetId: 'root', property: 'opacity', keyframes: [{time: 0, value: 1, interpolation: 'linear'}]}];
  assert.equal(api.validateProject(p).ok, true);
  for (const mutate of [
    q => q.nodes.push({...q.nodes[0]}),
    q => q.nodes[0].parentId = 'root',
    q => q.nodes[0].assetIds.push('missing'),
    q => q.timeline.tracks[0].targetId = 'missing',
    q => q.timeline.tracks[0].keyframes[0].time = -1,
    q => q.nodes[0].kind = 'execute',
  ]) {const q = structuredClone(p); mutate(q); assert.equal(api.validateProject(q).ok, false);}
});

test('snapshot de nascimento não muda retroativamente com controles do projeto', () => {
  const p = project(); const snapshot = api.snapshotProject(p);
  p.phases.start.duration = 2;
  assert.equal(snapshot.phases.start.duration, 0.1);
  assert.throws(() => snapshot.phases.start.duration = 3, TypeError);
  assert.equal(snapshot.phases.start.duration, 0.1);
});

test('dissipação por motivo libera recursos uma vez mesmo com erro no cleanup', () => {
  const policy = {...api.DEFAULT_DISSIPATION, cancel: 0.2};
  const life = new api.VisualLifecycle('cancelled', policy);
  policy.cancel = 8;
  let releases = 0;
  life.own(() => {releases++; throw new Error('release failure');});
  life.own(() => {releases++;});
  life.cancel('cancel');
  assert.equal(life.advance(0.1).changed, false);
  const result = life.advance(0.1);
  assert.equal(result.changed, true); assert.equal(result.errors.length, 1);
  assert.equal(releases, 2);
  life.cleanup(); life.advance(1);
  assert.equal(releases, 2);
  assert.throws(() => life.own(() => {}));
  assert.throws(() => life.advance(NaN));
  const reset = new api.VisualLifecycle('reset'); reset.cancel('scene-reset');
  assert.equal(reset.advance(0).changed, true);
});

test('stream rejeita duplicados e contato inválido sem consumir identidade', () => {
  const stream = new api.EventStream(1);
  const e = {eventId: 'hit:1', tick: 12, seed: 9, result: 'impact', position: {x: 1, y: 2, z: 3}};
  assert.equal(stream.accept({...e, position: {x: NaN, y: 0, z: 0}}).ok, false);
  const accepted = stream.accept(e); assert.equal(accepted.ok, true);
  e.position.x = 8; assert.equal(accepted.event.position.x, 1);
  assert.equal(stream.accept(e).ok, false);
  assert.equal(stream.accept({...e, eventId: 'hit:2'}).ok, false);
  stream.reset(); assert.equal(stream.accept(e).ok, true);
  assert.equal(new api.EventStream().accept({...e, result: 'unknown'}).ok, false);
});

test('hold segue vida autoritativa e desfecho respeita desligamento e rewind', () => {
  const phases = project().phases;
  assert.equal(api.samplePersistentClock(phases, 100, {alive: true, endedAt: null, outcome: null}).phase, 'hold');
  const ended = {alive: false, endedAt: 5, outcome: 'impact'};
  assert.equal(api.samplePersistentClock(phases, 5.01, ended).phase, 'impact');
  assert.equal(api.samplePersistentClock(phases, 6, ended).done, true);
  assert.equal(api.samplePersistentClock(phases, 1, ended).phase, 'hold');
  phases.impact.enabled = false;
  assert.equal(api.samplePersistentClock(phases, 5.01, ended).phase, null);
  assert.throws(() => api.samplePersistentClock(phases, 1, {alive: false, endedAt: null, outcome: null}));
});

test('ZIP real preserva projeto e bytes e rejeita adulteração traversal e compressão', () => {
  const p = project(); p.assets = [{assetId: 'mask', kind: 'texture', uri: 'assets/mask.bin'}];
  const text = api.serializeProject(p);
  const bytes = new Uint8Array([0, 1, 2, 255]);
  const packed = createPackage(text, {'assets/mask.bin': bytes}, api.deserializeProject);
  const opened = openPackage(packed, api.deserializeProject);
  assert.equal(opened.projectText, text); assert.deepEqual(opened.assets['assets/mask.bin'], bytes);
  assert.equal(api.deserializeProject(opened.projectText).ok, true);
  const tampered = unzipSync(packed); tampered['assets/mask.bin'][0] = 9;
  assert.throws(() => openPackage(zipSync(tampered, {level: 0}), api.deserializeProject), /Hash/);
  assert.throws(() => openPackage(zipSync({'../escape': bytes}, {level: 0}), api.deserializeProject), /Caminho/);
  assert.throws(() => openPackage(zipSync({'assets/mask.bin': bytes}, {level: 6}), api.deserializeProject), /Compressão/);
  assert.throws(() => createPackage(text, {'assets/CON.bin': bytes}, api.deserializeProject), /Asset/);
  assert.throws(() => createPackage(text, {}, api.deserializeProject), /Dependência/);
});

test('binding e runtime rejeitam âncora arbitrária custos negativos e payload executável', () => {
  const binding = {moveId: 'water-pulse', trigger: 'hit', effectId: 'custom', version: '1.0.0', anchor: 'anywhere', offsets: {x: 0, y: 0, z: 0}};
  assert.equal(api.validateEffectBinding(binding).ok, false);
  binding.anchor = 'socket:hand'; assert.equal(api.validateEffectBinding(binding).ok, true);
  const runtime = {schema: 'arenamon.vfx-runtime', schemaVersion: 1, effectId: 'custom', version: '1.0.0', phases: project().phases, budget: {particles: -1, lights: 0, drawCalls: 0}};
  assert.equal(api.validateRuntime(runtime).ok, false);
  runtime.budget.particles = 0; runtime.phases.start.tracks = [{id: 'unsupported'}];
  assert.equal(api.validateRuntime(runtime).ok, false);
});

test('catálogo permite atualização e rollback explícitos preservando versões fixadas', () => {
  const catalog = new api.ComponentCatalog(); const p = project();
  catalog.register('1.9.0', p); p.revision = 2; catalog.register('1.10.0', p);
  assert.equal(catalog.latest(p.effectId), '1.10.0');
  assert.equal(catalog.get(p.effectId, '1.9.0').revision, 1);
  assert.equal(catalog.select(p.effectId, '1.9.0', '1.10.0', false), '1.9.0');
  assert.equal(catalog.select(p.effectId, '1.9.0', '1.10.0', true), '1.10.0');
  assert.equal(catalog.select(p.effectId, '1.10.0', '1.9.0', true), '1.9.0');
  assert.throws(() => catalog.register('1.9.0', p));
  assert.throws(() => catalog.select(p.effectId, '1.9.0', '2.0.0', true));
});

test('matriz de capacidades distingue produtores auditados de eventos não suportados', () => {
  assert.equal(api.CAPABILITY_VERSION, 1);
  assert.equal(api.EVENT_CAPABILITIES.hit.status, 'available');
  assert.match(api.EVENT_CAPABILITIES.hit.source, /combat-lab/);
  assert.equal(api.EVENT_CAPABILITIES.status.status, 'available');
  assert.equal(api.EVENT_CAPABILITIES.miss.status, 'unsupported');
  assert.equal(api.EVENT_CAPABILITIES.cancel.status, 'unsupported');
  assert.equal(Object.isFrozen(api.EVENT_CAPABILITIES), true);
  assert.equal(Object.isFrozen(api.EVENT_CAPABILITIES.hit), true);
});

test('auditoria das capacidades disponíveis confere os produtores reais sem importar a simulação', () => {
  assert.equal(typeof api.auditEventCapabilities, 'function');
  const sources = {
    combat: readFileSync(new URL('../combat-lab/src/sim/combat.js', root), 'utf8'),
    game: readFileSync(new URL('../combat-lab/src/sim/game.js', root), 'utf8'),
  };
  assert.deepEqual(api.auditEventCapabilities(sources), []);
  const drifted = {...sources, combat: sources.combat.replace("result: perfect ? 'perfect' : protectedFront ? 'partial' : 'impact'", "result: 'changed'")};
  assert.deepEqual(api.auditEventCapabilities(drifted).map(issue => issue.trigger), ['hit', 'partial', 'perfect']);
});

console.log(`\n${passed.length} contratos F0 aprovados.`);
await mkdir(new URL('evidence/', root), {recursive: true});
await writeFile(new URL('evidence/contracts.json', root), JSON.stringify({scope: 'F0 contracts only', passed, count: passed.length, browser: false, gameIntegration: false}, null, 2) + '\n');
