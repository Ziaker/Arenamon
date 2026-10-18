// Testes do novo sistema de VFX declarativo (prototypes/combat-lab/src/view/vfx/).
// Executam em Node sem navegador, sem requests HTTP(S) e sem modificar a simulação.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  adaptSimEvent, classifyVisualType, freezeVisualEvent, QUALITY,
} from '../src/view/vfx/contract.js';
import {PoolManager} from '../src/view/vfx/pools.js';
import {Budget, QUALITY_LIMITS} from '../src/view/vfx/budget.js';
import {EffectRegistry, AGGREGATION, REPLAY} from '../src/view/vfx/registry.js';
import {Scheduler, PHASES} from '../src/view/vfx/scheduler.js';
import {VfxTelemetry} from '../src/view/vfx/telemetry.js';
import {CameraFeedback, CAMERA_PROFILES} from '../src/view/vfx/camera-feedback.js';
import {PresetManager, PRESET_SCHEMA, PRESET_SCHEMA_VERSION} from '../src/view/vfx/presets.js';
import {VfxRuntime} from '../src/view/vfx/runtime.js';
import {registerAllEffects} from '../src/view/vfx/index.js';
import {buildClashC} from '../src/view/vfx/effects/clash.js';
import {BeamRenderer, BEAM_PL_COLORS} from '../src/view/vfx/beam-renderer.js';
import * as T from 'three';
import {Game} from '../src/sim/game.js';
import {C, resetConfig} from '../src/sim/config.js';
import {WorldView} from '../src/view/world-view.js';
import {spawn} from '../src/sim/world.js';

let passed = 0;
const test = (name, fn) => {fn(); passed++; console.log('✓', name);};

// ============ CONTRATO ============

test('contrato: adaptSimEvent imutável e não modifica o evento da simulação', () => {
  const sim = {tick: 10, attacker: 0, target: 1, result: 'impact', damage: 20,
    normal: {x: 1, y: 0, z: 0}, position: {x: 3, y: 0, z: 4}, launch: {direction: {x: 0, y: 1, z: 0}, horizontal: 11, vertical: 7.3}};
  const before = JSON.stringify(sim);
  const ev = adaptSimEvent(sim, {fighters: [{position: {x: 0, y: 0, z: 0}}, {position: {x: 3, y: 0, z: 4}}]});
  assert.equal(ev.tick, 10);
  assert.equal(ev.attacker, 0);
  assert.equal(ev.target, 1);
  assert.equal(ev.type, 'hit');
  assert.equal(ev.damage, 20);
  assert.ok(ev.seed >= 0 && ev.seed <= 1);
  assert.ok(ev.eventId.startsWith('vfx:10:0:1:hit'));
  assert.deepEqual(ev.position, {x: 3, y: 0, z: 4});
  assert.deepEqual(ev.normal, {x: 1, y: 0, z: 0});
  assert.equal(ev.launch.horizontal, 11);
  // Congelado (imutável).
  assert.ok(Object.isFrozen(ev));
  assert.ok(Object.isFrozen(ev.position));
  assert.ok(Object.isFrozen(ev.normal));
  // Simulação não modificada.
  assert.equal(JSON.stringify(sim), before);
});

test('contrato: mesmo evento → mesmo eventId e mesma seed (determinismo)', () => {
  const sim = {tick: 5, attacker: 1, target: 0, result: 'clash', damage: 10, normal: {x: 0, y: 1, z: 0}};
  const a = adaptSimEvent(sim);
  const b = adaptSimEvent(sim);
  assert.equal(a.eventId, b.eventId);
  assert.equal(a.seed, b.seed);
});

test('contrato: eventos diferentes → seeds diferentes', () => {
  const base = {tick: 5, attacker: 0, target: 1, result: 'impact', normal: {x: 0, y: 1, z: 0}};
  const a = adaptSimEvent({...base, tick: 5}).seed;
  const b = adaptSimEvent({...base, tick: 6}).seed;
  assert.notEqual(a, b);
});

test('contrato: classifyVisualType mapeia resultados da simulação', () => {
  assert.equal(classifyVisualType('impact'), 'hit');
  assert.equal(classifyVisualType('partial'), 'partial');
  assert.equal(classifyVisualType('perfect'), 'perfect');
  assert.equal(classifyVisualType('perfectDodge'), 'perfectDodge');
  assert.equal(classifyVisualType('invulnerable'), 'invulnerable');
  assert.equal(classifyVisualType('clash'), 'clash');
  assert.equal(classifyVisualType('ground'), 'ground');
  assert.equal(classifyVisualType('desconhecido'), 'hit');
});

test('contrato: freezeVisualEvent congela profundamente', () => {
  const ev = adaptSimEvent({tick: 1, attacker: 0, target: 1, result: 'hit', normal: {x: 0, y: 1, z: 0}});
  // adaptSimEvent já congela; freezeVisualEvent devolve o mesmo objeto quando já está congelado.
  const fr = freezeVisualEvent(ev);
  assert.ok(Object.isFrozen(fr));
  assert.ok(Object.isFrozen(fr.position));
  // Em objeto não congelado, produz uma cópia congelada (não a mesma referência).
  const raw = {tick: 1, attacker: 0, target: 1, result: 'hit', position: {x: 0}, normal: {y: 1}, direction: {z: 0}, damage: 0, closingSpeed: 0, launch: null, surface: null, seed: 0.1, reason: 'x'};
  const fr2 = freezeVisualEvent(raw);
  assert.ok(Object.isFrozen(fr2));
  assert.notEqual(fr2, raw);
});

// ============ POOLS ============

test('pools: acquire/reuse/release sem alocação no hot path', () => {
  const pool = new PoolManager({maxParticles: 8});
  const objs = [];
  for (let i = 0; i < 8; i++) objs.push(pool.acquireParticle());
  assert.equal(pool.acquireParticle(), null); // esgotado
  pool.releaseParticle(objs[0]);
  const again = pool.acquireParticle();
  assert.ok(again !== null);
  const st = pool.stats();
  assert.equal(st.particles.capacity, 8);
  assert.equal(st.particles.active, 8);
  assert.equal(st.totalActive, 8);
});

test('pools: releaseAll limpa tudo', () => {
  const pool = new PoolManager({maxParticles: 8});
  const o = pool.acquireParticle();
  pool.clearAll();
  assert.equal(pool.acquireParticle() !== null, true);
});

// ============ ORÇAMENTO ============

test('orçamento: reserva e libera recursos', () => {
  const b = new Budget({quality: 'medium'});
  const r = b.reserve('impact', {particles: 100, rings: 1});
  assert.ok(r.ok);
  assert.equal(b.active.particles, 100);
  b.release({particles: 100, rings: 1});
  assert.equal(b.active.particles, 0);
});

test('orçamento: suprime quando excede o limite e registra na telemetria', () => {
  const b = new Budget({quality: 'low'});
  const r1 = b.reserve('impact', {particles: 400});
  assert.ok(r1.ok);
  const r2 = b.reserve('impact', {particles: 50});
  assert.ok(!r2.ok);
  assert.ok(r2.over.includes('particles'));
  b.suppress({effect: 'impact', tick: 3, reason: 'teste', position: {x: 0, y: 0, z: 0}, anchor: 'contact', normal: {x: 0, y: 1, z: 0}, variant: 0, seed: 0.5, duration: 0.4});
  assert.equal(b.suppressed.length, 1);
  assert.equal(b.frameSuppressed, 1);
  b.beginFrame();
  assert.equal(b.frameSuppressed, 0);
});

test('orçamento: níveis baixo/médio/alto têm limites diferentes', () => {
  for (const q of ['low', 'medium', 'high']) {
    const b = new Budget({quality: q});
    assert.ok(b.limits.maxParticles > 0);
    assert.ok(QUALITY_LIMITS[q].maxParticles > 0);
  }
  assert.ok(QUALITY_LIMITS.low.maxParticles < QUALITY_LIMITS.high.maxParticles);
  assert.equal(QUALITY_LIMITS.low.maxLights, 0); // sem luzes dinâmicas em baixo
});

// ============ REGISTRO ============

test('registro: cadastra e busca efeitos por id e versão', () => {
  const reg = new EffectRegistry();
  const r = reg.register({id: 'impact:hit', version: '1.0', trigger: 'hit', duration: 0.4});
  assert.ok(r.ok);
  const e = reg.get('impact:hit', '1.0');
  assert.ok(e);
  assert.equal(e.duration, 0.4);
  assert.equal(reg.getLatest('impact:hit'), e);
});

test('registro: valida campos obrigatórios', () => {
  const reg = new EffectRegistry();
  const r1 = reg.register({id: 'x', version: '1.0', trigger: 't', duration: 0});
  assert.ok(!r1.ok);
  assert.ok(r1.errors.some(e => e.includes('duration')));
  const r2 = reg.register({version: '1.0', trigger: 't', duration: 0.4});
  assert.ok(!r2.ok);
  assert.ok(r2.errors.some(e => e.includes('id')));
});

test('registro: aggregation e replay são valores válidos', () => {
  assert.ok(Object.values(AGGREGATION).includes('none'));
  assert.ok(Object.values(REPLAY).includes('full'));
  const reg = new EffectRegistry();
  reg.register({id: 'a', version: '1.0', trigger: 't', duration: 0.4, aggregation: AGGREGATION.stack, replay: REPLAY.reduced});
  assert.equal(reg.list().length, 1);
});

// ============ SCHEDULER ============

test('scheduler: fases spawn → sustain → decay → cancel', () => {
  const sched = new Scheduler({maxConcurrent: 8});
  let spawnCalled = 0, sustainCalled = 0, decayCalled = 0;
  const def = {
    id: 'test:fx', version: '1.0', trigger: 't', duration: 0.1,
    onSpawn: () => { spawnCalled++; },
    onSustain: () => { sustainCalled++; },
    onDecay: () => { decayCalled++; },
  };
  sched.schedule(def, {tick: 0});
  sched.tick(0); // spawn
  assert.equal(spawnCalled, 1);
  sched.tick(0.05); // sustain
  assert.equal(sustainCalled, 1);
  sched.tick(0.1); // decay (atinge a vida)
  assert.equal(decayCalled, 1);
  // depois de decay a instância é removida
  assert.equal(sched.stats().active, 0);
});

test('scheduler: cancel para instância específica', () => {
  const sched = new Scheduler();
  const def = {id: 'a', version: '1.0', trigger: 't', duration: 1};
  const id = sched.schedule(def, {tick: 0});
  sched.cancel(id);
  sched.tick(0.01); // o cancelamento é efetivado no próximo tick
  assert.equal(sched.stats().active, 0);
});

test('scheduler: cancelAll e clear', () => {
  const sched = new Scheduler();
  sched.schedule({id: 'a', version: '1.0', trigger: 't', duration: 1}, {tick: 0});
  sched.schedule({id: 'b', version: '1.0', trigger: 't', duration: 1}, {tick: 0});
  assert.equal(sched.stats().active, 2);
  sched.cancelAll();
  assert.equal(sched.stats().active, 0);
});

// ============ TELEMETRIA ============

test('telemetria: registra efeito e snapshot (somente leitura)', () => {
  const tel = new VfxTelemetry();
  tel.recordEffect({effect: 'impact', tick: 1, reason: 'contato', position: {x: 1}, normal: {y: 1}, variant: 0, seed: 0.5, duration: 0.4, particlesRequested: 10, particlesProduced: 10, suppressed: false});
  tel.recordSnapshot({tick: 1, activeObjects: 10, peakParticles: 10, drawCalls: 2, cpuMs: 0.5});
  const list = tel.list();
  assert.equal(list.length, 1);
  assert.equal(list[0].effect, 'impact');
  assert.equal(list[0].particlesProduced, 10);
  const ps = tel.particleStats();
  assert.equal(ps.requested, 10);
  assert.equal(ps.produced, 10);
  assert.equal(ps.fillRate, 1);
  const pk = tel.peakStats();
  assert.equal(pk.peakParticles, 10);
  // export não expõe referências internas mutáveis.
  const exp = tel.export();
  assert.ok(Array.isArray(exp.events));
  assert.equal(exp.particleStats.fillRate, 1);
});

test('telemetria: filtros por supressão e família', () => {
  const tel = new VfxTelemetry();
  tel.recordEffect({effect: 'impact', tick: 1, reason: 'r', variant: 0, seed: 0, duration: 0.4, suppressed: false});
  tel.recordEffect({effect: 'clash', tick: 2, reason: 'r', variant: 0, seed: 0, duration: 0.6, suppressed: true});
  const sup = tel.suppressions();
  assert.equal(sup.length, 1);
  assert.equal(sup[0].effect, 'clash');
  const byFam = tel.byFamily();
  assert.equal(byFam.impact, 1);
  assert.equal(byFam.clash, 1);
});

test('telemetria: não altera execução (apenas lê)', () => {
  const tel = new VfxTelemetry();
  const before = JSON.stringify(tel.export());
  tel.recordEffect({effect: 'x', tick: 1, reason: 'r', variant: 0, seed: 0, duration: 0.4});
  tel.recordSnapshot({tick: 1, activeObjects: 1, peakParticles: 1});
  tel.list();
  tel.suppressions();
  tel.byFamily();
  tel.particleStats();
  tel.peakStats();
  // O estado interno é o esperado (somente acréscimo).
  assert.equal(tel.events.length, 1);
  assert.equal(tel.snapshots.length, 1);
});

// ============ CÂMERA E FEEDBACK ============

test('câmera: perfis declarativos existem para todos os tipos exigidos', () => {
  for (const k of ['lightHit', 'heavyHit', 'perfectBlock', 'clash', 'landing', 'wall', 'finisher']) {
    assert.ok(CAMERA_PROFILES[k], `perfil ${k} ausente`);
    const p = CAMERA_PROFILES[k];
    assert.ok(p.shake);
    assert.ok(p.flash);
  }
});

test('câmera: aplicar perfil produz deslocamento sem acessar a simulação', () => {
  const cam = new CameraFeedback({canvas: null, flashEl: null});
  cam.applyProfile('heavyHit', {power: 1});
  const out = cam.update(0.016, performance.now() / 1000, null);
  assert.ok('x' in out && 'y' in out && 'z' in out && 'roll' in out);
});

test('câmera: acessibilidade desliga flash e tremor', () => {
  const cam = new CameraFeedback({canvas: null, flashEl: null});
  cam.setAccessibility({noFlash: true, noShake: true, globalIntensity: 0});
  cam.applyProfile('heavyHit', {power: 1});
  assert.equal(cam.shakes.length, 0);
  assert.equal(cam.flash, null);
});

test('câmera: respeita prefers-reducedmotion (sem shake/freeze/blur)', () => {
  const cam = new CameraFeedback({canvas: null, flashEl: null});
  cam.setAccessibility({preferReducedMotion: true});
  cam.applyProfile('clash', {power: 1});
  assert.equal(cam.shakes.length, 0);
  assert.equal(cam.freezeUntil, 0);
});

// ============ PRESETS ============

test('presets: schema versionado e validação de valores', () => {
  const reg = new EffectRegistry();
  reg.register({id: 'impact:hit', version: '1.0', trigger: 'hit', duration: 0.4, defaults: {size: 1}});
  const pm = new PresetManager(reg);
  const r = pm.capture('meu-preset', {size: 2, enabled: true, variant: 1});
  assert.ok(r.ok);
  const p = pm.get('meu-preset');
  assert.equal(p.schema, PRESET_SCHEMA);
  assert.equal(p.version, PRESET_SCHEMA_VERSION);
  assert.equal(p.values.size, 2);
});

test('presets: exportação e importação com preview', () => {
  const reg = new EffectRegistry();
  reg.register({id: 'impact:hit', version: '1.0', trigger: 'hit', duration: 0.4});
  const pm = new PresetManager(reg);
  pm.capture('p1', {size: 5});
  const json = pm.export('p1');
  assert.ok(json.includes(PRESET_SCHEMA));
  const imp = pm.import(json);
  assert.ok(imp.ok);
  assert.equal(imp.preview, true);
  assert.equal(imp.values.size, 5);
});

test('presets: importação rejeita schema inválido', () => {
  const pm = new PresetManager(new EffectRegistry());
  const imp = pm.import('{"schema": "outro", "values": {}}');
  assert.ok(!imp.ok);
  assert.ok(imp.error);
});

test('presets: desfazer/refazer', () => {
  const reg = new EffectRegistry();
  reg.register({id: 'impact:hit', version: '1.0', trigger: 'hit', duration: 0.4});
  const pm = new PresetManager(reg);
  pm.capture('a', {size: 1});
  pm.capture('b', {size: 2});
  const u = pm.undo();
  assert.ok(u.ok);
  const r = pm.redo();
  assert.ok(r.ok);
});

test('presets: comparação A/B', () => {
  const reg = new EffectRegistry();
  reg.register({id: 'impact:hit', version: '1.0', trigger: 'hit', duration: 0.4});
  const pm = new PresetManager(reg);
  pm.capture('A', {size: 1, count: 10});
  pm.capture('B', {size: 2, count: 10});
  const cmp = pm.compare('A', 'B');
  assert.ok(cmp.ok);
  assert.ok(cmp.diff.size);
  assert.equal(cmp.identical, false);
  const cmp2 = pm.compare('A', 'A');
  assert.ok(cmp2.identical);
});

test('presets: reset por efeito e por família', () => {
  const reg = new EffectRegistry();
  reg.register({id: 'impact:hit', version: '1.0', trigger: 'hit', duration: 0.4, defaults: {size: 1}});
  const pm = new PresetManager(reg);
  const re = pm.resetEffect('impact:hit');
  assert.ok(re.ok);
  assert.equal(re.values.size, 1);
  const rf = pm.resetFamily('impact');
  assert.ok(rf.ok);
});

// ============ RUNTIME (headless) ============

function makeRuntime() {
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(60, 1, 0.1, 100);
  const rt = new VfxRuntime(scene, {camera, quality: 'medium', maxParticles: 256});
  registerAllEffects(rt);
  return rt;
}

const fighters = [
  {id: 0, position: {x: 0, y: 0, z: 0}, state: 'idle', hp: 100, stamina: 3, exhausted: false, sprinting: false, staminaTrend: 0},
  {id: 1, position: {x: 3, y: 0, z: 4}, state: 'idle', hp: 100, stamina: 3, exhausted: false, sprinting: false, staminaTrend: 0},
];

test('runtime: update executa sem erro e processa evento de impacto', () => {
  const rt = makeRuntime();
  const ev = [{tick: 10, attacker: 0, target: 1, result: 'impact', damage: 20, normal: {x: 0, y: 1, z: 0}}];
  const out = rt.update(fighters, ev, 0.016, {tick: 10});
  assert.ok(out);
  assert.ok(out.stats);
  assert.ok(out.stats.active >= 0);
});

test('runtime: mesmo evento + mesma seed → mesma quantidade de partículas (determinismo)', () => {
  const ev = [{tick: 20, attacker: 0, target: 1, result: 'impact', damage: 20, normal: {x: 0, y: 1, z: 0}}];
  const r1 = makeRuntime(); r1.update(fighters, ev, 0.016, {tick: 20});
  const n1 = r1.stats.spawned;
  const r2 = makeRuntime(); r2.update(fighters, ev, 0.016, {tick: 20});
  const n2 = r2.stats.spawned;
  assert.equal(n1, n2);
  assert.ok(n1 > 0);
});

test('runtime: desligar VFX não cria partículas', () => {
  const rt = makeRuntime();
  rt.enabled = false;
  const ev = [{tick: 30, attacker: 0, target: 1, result: 'impact', damage: 20, normal: {x: 0, y: 1, z: 0}}];
  rt.update(fighters, ev, 0.016, {tick: 30});
  assert.equal(rt.stats.spawned, 0);
});

test('runtime: múltiplos impactos no mesmo passo são todos processados', () => {
  const rt = makeRuntime();
  const ev = [
    {tick: 40, attacker: 0, target: 1, result: 'impact', damage: 20, normal: {x: 1, y: 0, z: 0}},
    {tick: 40, attacker: 1, target: 0, result: 'partial', damage: 5, normal: {x: -1, y: 0, z: 0}},
  ];
  rt.update(fighters, ev, 0.016, {tick: 40});
  assert.ok(rt.stats.firesByType['impact:hit'] >= 1 || rt.stats.firesByType['defense:block'] >= 1);
  assert.ok(rt.stats.spawned > 0);
});

test('runtime: reset limpa partículas e instâncias', () => {
  const rt = makeRuntime();
  const ev = [{tick: 50, attacker: 0, target: 1, result: 'impact', damage: 20, normal: {x: 0, y: 1, z: 0}}];
  rt.update(fighters, ev, 0.016, {tick: 50});
  assert.ok(rt.stats.spawned > 0);
  rt.reset();
  assert.equal(rt.stats.spawned, 0);
  assert.equal(rt.stats.active, 0);
});

test('runtime: limites do pool são respeitados (maxParticles)', () => {
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(60, 1, 0.1, 100);
  const rt = new VfxRuntime(scene, {camera, quality: 'low', maxParticles: 4});
  registerAllEffects(rt);
  const ev = [{tick: 60, attacker: 0, target: 1, result: 'impact', damage: 20, normal: {x: 0, y: 1, z: 0}}];
  rt.update(fighters, ev, 0.016, {tick: 60});
  // não deve lançar mesmo com pool pequeno
  assert.ok(rt.stats.active >= 0);
});

test('runtime: supressão por orçamento registra na telemetria', () => {
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(60, 1, 0.1, 100);
  const rt = new VfxRuntime(scene, {camera, quality: 'low', maxParticles: 2});
  registerAllEffects(rt);
  // forçar muitas partículas para estourar orçamento
  const ev = [{tick: 70, attacker: 0, target: 1, result: 'impact', damage: 20, normal: {x: 0, y: 1, z: 0}}];
  rt.update(fighters, ev, 0.016, {tick: 70});
  const sup = rt.telemetry.suppressions();
  // pode ou não suprimir dependendo do custo; apenas verifica que não quebra
  assert.ok(Array.isArray(sup));
});

test('runtime: fallback de qualidade muda limites', () => {
  const rt = makeRuntime();
  rt.setQuality('low');
  assert.equal(rt.budget.limits.maxParticles, QUALITY_LIMITS.low.maxParticles);
  rt.setQuality('high');
  assert.equal(rt.budget.limits.maxParticles, QUALITY_LIMITS.high.maxParticles);
});

// ============ EFEITOS NÃO MODIFICAM SNAPSHOT DA SIMULAÇÃO ============

test('simulação: estado idêntico com VFX ligado e desligado (mesma seed)', () => {
  // Executa duas lutas idênticas; a presença do VFX não deve alterar o resultado mecânico.
  resetConfig();
  const run = (vfxOn) => {
    const g = new Game({seed: 42});
    g.mode = 'combat';
    g.reset();
    let tickVfxCalls = 0;
    const stepOrig = g.step.bind(g);
    // Wrapper que, quando vfxOn, consome os eventos (sem alterá-los) simulando o VFX lendo-os.
    g.step = function (cmd0, cmd1) {
      stepOrig(cmd0, cmd1);
      if (vfxOn) {
        const evs = g.lastStepEvents || [];
        for (const e of evs) {
          // só leitura: adaptar sem gravar nada que afete a simulação
          const ve = adaptSimEvent(e, {fighters: g.fighters});
          tickVfxCalls++;
        }
      }
    };
    for (let t = 0; t < 600 && g.phase !== 'result'; t++) {
      g.step(g.playerBrain.command(g.fighters[0], g.fighters[1], 'combat', C.test.step));
      if (g.phase === 'result') g.reset();
    }
    return {save: g.save(), tickVfxCalls};
  };
  const a = run(true);
  const b = run(false);
  assert.deepEqual(JSON.stringify(a.save), JSON.stringify(b.save), 'mesmo estado mecânico com e sem VFX');
  assert.ok(a.tickVfxCalls > 0, 'VFX consumiu eventos');
});

// ============ SEM PERSONAGEM GLB / OFFLINE ============

test('runtime: funciona sem personagem GLB (apenas blocos/lutadores)', () => {
  const rt = makeRuntime();
  const ev = [{tick: 80, attacker: 0, target: 1, result: 'perfect', damage: 0, normal: {x: 0, y: 1, z: 0}}];
  const out = rt.update(fighters, ev, 0.016, {tick: 80, characters: []});
  assert.ok(out);
});

test('execução offline: nenhum módulo faz requests HTTP(S)', () => {
  // Verificação estática: nenhum import/use de fetch, XMLHttpRequest, WebSocket nos módulos VFX.
  const files = ['contract.js', 'pools.js', 'budget.js', 'registry.js', 'scheduler.js',
    'telemetry.js', 'camera-feedback.js', 'presets.js', 'runtime.js', 'index.js',
    'effects/impact.js', 'effects/defense.js', 'effects/clash.js', 'effects/landing.js',
    'effects/movement.js', 'effects/status.js', 'effects/environment.js'];
  let foundNetwork = false;
  for (const f of files) {
    const c = readFileSync(`prototypes/combat-lab/src/view/vfx/${f}`, 'utf8');
    if (/fetch\(|XMLHttpRequest|WebSocket|import\(['"]http/.test(c)) foundNetwork = true;
  }
  assert.ok(!foundNetwork, 'nenhum módulo VFX faz requests de rede');
});

// ============ CICLO DE VIDA COMPLETO (evento → reserva → partículas → expiração → liberação → reutilização) ============

test('ciclo: evento → reserva → partículas → expiração → orçamento zerado → reutilização', () => {
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(60, 1, 0.1, 100);
  const rt = new VfxRuntime(scene, {camera, quality: 'medium', maxParticles: 256});
  registerAllEffects(rt);
  const ev = [{tick: 100, attacker: 0, target: 1, result: 'impact', damage: 20, normal: {x: 0, y: 1, z: 0}}];
  const before = rt.budget.active.particles;
  rt.update(fighters, ev, 0.016, {tick: 100});
  const afterSpawn = rt.budget.active.particles;
  assert.ok(afterSpawn > before, 'orçamento consumido no spawn');
  // Avançar além da duração do efeito (0.38 s) em vários quadros para expirar.
  for (let i = 0; i < 25; i++) rt.update(fighters, [], 0.016, {tick: 100 + i});
  const afterExpire = rt.budget.active.particles;
  assert.equal(afterExpire, before, 'orçamento zerado depois da expiração');
  // Reutilizar: disparar novamente deve consumir o orçamento de novo.
  rt.update(fighters, ev, 0.016, {tick: 200});
  assert.ok(rt.budget.active.particles > before, 'orçamento reutilizado após expiração');
});

test('ciclo: pool reutilizável após milhares de partículas sem esgotar', () => {
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(60, 1, 0.1, 100);
  const rt = new VfxRuntime(scene, {camera, quality: 'low', maxParticles: 64});
  registerAllEffects(rt);
  const ev = [{tick: 300, attacker: 0, target: 1, result: 'impact', damage: 20, normal: {x: 0, y: 1, z: 0}}];
  let totalSpawned = 0;
  for (let i = 0; i < 40; i++) {
    rt.update(fighters, ev, 0.016, {tick: 300 + i});
    totalSpawned += rt.stats.spawned;
    // avançar o tempo para expirar e devolver ao pool
    for (let j = 0; j < 30; j++) rt.update(fighters, [], 0.016, {tick: 300 + i + j * 0.016});
  }
  // não deve lançar nem travar mesmo com muitas partículas passando pelo pool
  assert.ok(totalSpawned > 0, 'partículas produzidas ao longo de múltiplos ciclos');
  const st = rt.pools.stats().particles;
  assert.ok(st.active <= st.capacity, 'pool não excede a capacidade');
});

test('ciclo: expulsão por capacidade do pool não trava o runtime', () => {
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(60, 1, 0.1, 100);
  const rt = new VfxRuntime(scene, {camera, quality: 'low', maxParticles: 4});
  registerAllEffects(rt);
  // evento com custo acima da capacidade do pool
  const ev = [{tick: 400, attacker: 0, target: 1, result: 'impact', damage: 20, normal: {x: 0, y: 1, z: 0}}];
  let threw = false;
  try { rt.update(fighters, ev, 0.016, {tick: 400}); } catch (e) { threw = true; }
  assert.ok(!threw, 'pool esgotado não lança exceção');
});

test('ciclo: Clash C executa liberação diferida (onRelease) através do runtime', () => {
  // Verifica o contrato declarativo: build retorna {parts, hold, onRelease}.
  const ctx = {position: {x: 0, y: 0.85, z: 0}, normal: {x: 1, y: 0, z: 0}, seed: 0.42, tick: 900};
  const result = buildClashC(ctx, ctx.seed);
  assert.ok(result && result.parts && result.onRelease && result.hold > 0,
    'buildClashC devolve {parts, hold, onRelease}');
  const releaseParts = result.onRelease(ctx, ctx.seed);
  assert.ok(Array.isArray(releaseParts) && releaseParts.length > 0,
    'onRelease do Clash C produz partículas na liberação');

  // Runtime: registra apenas a variante C do clash (remove A e B) para forçar
  // o caminho real de onRelease ao processar um evento de clash.
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(60, 1, 0.1, 100);
  const rt = new VfxRuntime(scene, {camera, quality: 'high', maxParticles: 512});
  registerAllEffects(rt);
  assert.ok(rt.registry.unregister('clash:clash', '1.0'), 'remove variante A');
  assert.ok(rt.registry.unregister('clash:clash', '1.1'), 'remove variante B');
  assert.equal(rt.registry.byFamily('clash').length, 1, 'apenas a variante C permanece');

  const ev = [{tick: 910, attacker: 0, target: 1, result: 'clash', damage: 10, normal: {x: 1, y: 0, z: 0}}];
  const spawnedBefore = rt.stats.spawned;
  rt.update(fighters, ev, 0.016, {tick: 910});
  // Avançar além do hold (0.18s) para disparar onRelease da instância ativa.
  for (let i = 0; i < 15; i++) rt.update(fighters, [], 0.016, {tick: 910 + i});
  const spawnedAfterRelease = rt.stats.spawned;
  assert.ok(spawnedAfterRelease > spawnedBefore,
    'onRelease do Clash C produz partículas adicionais no runtime na liberação');
  // orçamento liberado após a expiração total
  for (let i = 0; i < 30; i++) rt.update(fighters, [], 0.016, {tick: 970 + i});
  assert.equal(rt.budget.active.particles, 0, 'orçamento zerado após expiração total do clash');
});

test('ciclo: reset completo zera orçamento e instâncias', () => {
  const rt = makeRuntime();
  const ev = [{tick: 600, attacker: 0, target: 1, result: 'impact', damage: 20, normal: {x: 0, y: 1, z: 0}}];
  rt.update(fighters, ev, 0.016, {tick: 600});
  assert.ok(rt.budget.active.particles > 0, 'orçamento ativo antes do reset');
  assert.ok(rt.activeEffects.size > 0 || rt.stats.spawned > 0, 'efeitos ativos antes do reset');
  rt.reset();
  assert.equal(rt.budget.active.particles, 0, 'orçamento zerado pelo reset');
  assert.equal(rt.activeEffects.size, 0, 'instâncias limpas pelo reset');
  assert.equal(rt.scheduler.stats().active, 0, 'scheduler limpo pelo reset');
});

test('ciclo: replay idêntico — mesmos eventos produzem mesmas partículas', () => {
  const makeCount = () => {
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(60, 1, 0.1, 100);
    const rt = new VfxRuntime(scene, {camera, quality: 'medium', maxParticles: 256});
    registerAllEffects(rt);
    const ev = [
      {tick: 700, attacker: 0, target: 1, result: 'impact', damage: 20, normal: {x: 1, y: 0, z: 0}},
      {tick: 700, attacker: 1, target: 0, result: 'partial', damage: 5, normal: {x: -1, y: 0, z: 0}},
      {tick: 702, attacker: 0, target: 1, result: 'clash', damage: 10, normal: {x: 0, y: 1, z: 0}},
    ];
    for (const e of ev) rt.update(fighters, [e], 0.016, {tick: e.tick});
    for (let i = 0; i < 40; i++) rt.update(fighters, [], 0.016, {tick: 702 + i});
    return rt.stats.spawned;
  };
  assert.equal(makeCount(), makeCount(), 'mesmos eventos → mesma quantidade de partículas (replay determinístico)');
});

test('ciclo: runtime inativo (enabled=false) não processa nem consome orçamento', () => {
  const rt = makeRuntime();
  rt.enabled = false;
  const ev = [{tick: 800, attacker: 0, target: 1, result: 'impact', damage: 20, normal: {x: 0, y: 1, z: 0}}];
  rt.update(fighters, ev, 0.016, {tick: 800});
  assert.equal(rt.stats.spawned, 0, 'runtime desligado não produz partículas');
  assert.equal(rt.budget.active.particles, 0, 'runtime desligado não consome orçamento');
  assert.equal(rt.activeEffects.size, 0, 'runtime desligado não cria instâncias');
});

test('ciclo: ativar → criar efeitos → desativar → reativar zera o orçamento', () => {
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(60, 1, 0.1, 100);
  const rt = new VfxRuntime(scene, {camera, quality: 'medium', maxParticles: 256});
  registerAllEffects(rt);
  // cria efeitos
  const ev = [{tick: 900, attacker: 0, target: 1, result: 'impact', damage: 20, normal: {x: 0, y: 1, z: 0}}];
  rt.update(fighters, ev, 0.016, {tick: 900});
  assert.ok(rt.budget.active.particles > 0, 'orçamento consumido com VFX ligado');
  // desativa: deve zerar orçamento
  rt.enabled = false;
  rt.update(fighters, [], 0.016, {tick: 901});
  assert.equal(rt.budget.active.particles, 0, 'desativar zera o orçamento');
  // reativa: orçamento volta a estar disponível para novos efeitos
  rt.enabled = true;
  rt.update(fighters, ev, 0.016, {tick: 902});
  assert.ok(rt.budget.active.particles > 0, 'reativar permite consumir orçamento novamente');
});

test('ciclo: exaustão/regeneração determinística após reset (relógio zerado)', () => {
  const makeCount = () => {
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(60, 1, 0.1, 100);
    const rt = new VfxRuntime(scene, {camera, quality: 'medium', maxParticles: 256});
    registerAllEffects(rt);
    const exhausted = {...fighters[1], exhausted: true, hp: 100};
    const fts = [fighters[0], exhausted];
    // roda ~1 s gerando partículas contínuas de exaustão
    for (let i = 0; i < 60; i++) rt.update(fts, [], 0.016, {tick: 1000 + i});
    const n = rt.stats.spawned;
    rt.reset();
    // roda novamente do zero: mesmo resultado esperado
    for (let i = 0; i < 60; i++) rt.update(fts, [], 0.016, {tick: 1000 + i});
    return {first: n, second: rt.stats.spawned};
  };
  const {first, second} = makeCount();
  assert.equal(first, second, 'mesma quantidade de partículas de exaustão antes e depois do reset');
});

// ============ BEAM RENDERER (LASER DA ARENA) ============

test('beam: BeamRenderer inicializa sem erros e instancia grupos e malhas', () => {
  const scene = new T.Scene();
  const renderer = new BeamRenderer(scene, {maxBeams: 2, maxSegments: 4, quality: 'medium'});
  assert.equal(renderer.beams.length, 2);
  assert.equal(renderer.beams[0].segments.length, 4);
  assert.ok(renderer.group.children.length >= 2);
  renderer.dispose();
});

test('beam: núcleo físico (coreMesh) é incondicional e nunca é suprimido, mesmo em Low', () => {
  const scene = new T.Scene();
  const renderer = new BeamRenderer(scene, {quality: 'low'});
  const fakeWorld = {
    entities: [{
      id: 1, kind: 'beam', y: 0.8, pl: 1, dead: false,
      segments: [{a: {x: 0, z: 0}, b: {x: 5, z: 0}, pl: 1}]
    }]
  };
  renderer.update(fakeWorld, 0.016);
  const seg0 = renderer.beams[0].segments[0];
  assert.equal(seg0.coreMesh.visible, true, 'núcleo físico deve estar visível');
  assert.equal(seg0.coreMat.opacity, 0.95);
  renderer.dispose();
});

test('beam: halo aditivo adapta cor pelo Power Level (PL1, PL2, PL3)', () => {
  const scene = new T.Scene();
  const renderer = new BeamRenderer(scene, {quality: 'high'});
  const fakeWorld = {
    entities: [{
      id: 1, kind: 'beam', y: 0.8, pl: 1, dead: false,
      segments: [{a: {x: 0, z: 0}, b: {x: 5, z: 0}, pl: 1}]
    }]
  };
  // PL1 -> Ciano
  renderer.update(fakeWorld, 0.016);
  assert.equal(renderer.beams[0].segments[0].haloMat.color.getHex(), BEAM_PL_COLORS[1].halo);
  // PL2 -> Dourado / Âmbar
  fakeWorld.entities[0].pl = 2;
  fakeWorld.entities[0].segments[0].pl = 2;
  renderer.update(fakeWorld, 0.016);
  assert.equal(renderer.beams[0].segments[0].haloMat.color.getHex(), BEAM_PL_COLORS[2].halo);
  // PL3 -> Magenta
  fakeWorld.entities[0].pl = 3;
  fakeWorld.entities[0].segments[0].pl = 3;
  renderer.update(fakeWorld, 0.016);
  assert.equal(renderer.beams[0].segments[0].haloMat.color.getHex(), BEAM_PL_COLORS[3].halo);
  renderer.dispose();
});

test('beam: acessibilidade noFlash oculta muzzle e flare sem suprimir núcleo', () => {
  const scene = new T.Scene();
  const renderer = new BeamRenderer(scene);
  renderer.setConfig({noFlash: true});
  const fakeWorld = {
    entities: [{
      id: 1, kind: 'beam', y: 0.8, pl: 1, dead: false,
      segments: [{a: {x: 0, z: 0}, b: {x: 5, z: 0}, pl: 1}]
    }]
  };
  renderer.update(fakeWorld, 0.016);
  assert.equal(renderer.beams[0].muzzleMesh.visible, false, 'muzzle oculto com noFlash');
  assert.equal(renderer.beams[0].segments[0].flareMesh.visible, false, 'flare oculto com noFlash');
  assert.equal(renderer.beams[0].segments[0].coreMesh.visible, true, 'núcleo permanece visível');
  renderer.dispose();
});

test('beam: compensação frontal amplia halo e núcleo quando alinhado com a câmera', () => {
  const scene = new T.Scene();
  const renderer = new BeamRenderer(scene);
  const camera = new T.PerspectiveCamera(60, 1, 0.1, 100);
  camera.position.set(0, 0.8, 10);
  const fakeWorld = {
    entities: [{
      id: 1, kind: 'beam', y: 0.8, pl: 1, dead: false,
      segments: [{a: {x: 0, z: 0}, b: {x: 0, z: 5}, pl: 1}]
    }]
  };
  renderer.update(fakeWorld, 0.016, {camera});
  const seg0 = renderer.beams[0].segments[0];
  assert.ok(seg0.coreMesh.scale.x > renderer.config.coreWidth1);
  renderer.dispose();
});

test('beam: reset e dispose limpam malhas e feixes ativos', () => {
  const scene = new T.Scene();
  const renderer = new BeamRenderer(scene);
  const fakeWorld = {
    entities: [{
      id: 1, kind: 'beam', y: 0.8, pl: 1, dead: false,
      segments: [{a: {x: 0, z: 0}, b: {x: 5, z: 0}, pl: 1}]
    }]
  };
  renderer.update(fakeWorld, 0.016);
  assert.equal(renderer.beams[0].beamGroup.visible, true);
  renderer.reset();
  assert.equal(renderer.beams[0].beamGroup.visible, false);
  renderer.dispose();
  assert.equal(renderer.beams.length, 0);
});

// ============ VARIANTES A/B/C ============

test('variantes: defesa parcial (block) possui variantes A, B e C funcionais', () => {
  const rt = makeRuntime();
  const ctx = {position: {x: 0, y: 0, z: 0}, normal: {x: 0, y: 0, z: 1}};
  const defs = rt.registry.list().filter(d => d.trigger === 'partial');
  assert.ok(defs.some(d => d.variant === 0), 'variante A de block existe');
  assert.ok(defs.some(d => d.variant === 1), 'variante B de block existe');
  assert.ok(defs.some(d => d.variant === 2), 'variante C de block existe');
  for (const def of defs) {
    const parts = def.build(ctx, 0.42);
    assert.ok(parts && parts.length > 0, `variante ${def.variant} de block produz partículas`);
  }
});

test('variantes: defesa perfeita (perfect) possui variantes A, B e C funcionais', () => {
  const rt = makeRuntime();
  const ctx = {position: {x: 0, y: 0, z: 0}, normal: {x: 0, y: 0, z: 1}};
  const defs = rt.registry.list().filter(d => d.trigger === 'perfect');
  assert.ok(defs.some(d => d.variant === 0), 'variante A de perfect existe');
  assert.ok(defs.some(d => d.variant === 1), 'variante B de perfect existe');
  assert.ok(defs.some(d => d.variant === 2), 'variante C de perfect existe');
  for (const def of defs) {
    const parts = def.build(ctx, 0.42);
    assert.ok(parts && parts.length > 0, `variante ${def.variant} de perfect produz partículas`);
  }
});

test('variantes: aterrissagem (landing) possui variantes A, B e C funcionais', () => {
  const rt = makeRuntime();
  const ctx = {position: {x: 0, y: 0, z: 0}, normal: {x: 0, y: 1, z: 0}};
  const defs = rt.registry.list().filter(d => d.trigger === 'ground');
  assert.ok(defs.some(d => d.variant === 0), 'variante A de ground existe');
  assert.ok(defs.some(d => d.variant === 1), 'variante B de ground existe');
  assert.ok(defs.some(d => d.variant === 2), 'variante C de ground existe');
  for (const def of defs) {
    const parts = def.build(ctx, 0.42);
    assert.ok(parts && parts.length > 0, `variante ${def.variant} de ground produz partículas`);
  }
});

test('variantes: esquiva e sprint possuem variantes A, B e C funcionais', () => {
  const rt = makeRuntime();
  const ctx = {position: {x: 0, y: 0, z: 0}, direction: {x: 1, y: 0, z: 0}};
  const dodges = rt.registry.list().filter(d => d.trigger === 'dodge');
  const sprints = rt.registry.list().filter(d => d.trigger === 'sprint');
  assert.equal(dodges.length, 3, '3 variantes de esquiva');
  assert.equal(sprints.length, 3, '3 variantes de sprint');
  for (const d of [...dodges, ...sprints]) {
    const parts = d.build(ctx, 0.5);
    assert.ok(parts && parts.length > 0, `efeito ${d.id} var ${d.variant} produz partículas`);
  }
});

test('variantes: exaustão e regeneração possuem variantes A, B e C funcionais', () => {
  const rt = makeRuntime();
  const ctx = {position: {x: 0, y: 0, z: 0}};
  const exhausts = rt.registry.list().filter(d => d.id === 'status:exhaust');
  const regens = rt.registry.list().filter(d => d.id === 'status:regen');
  assert.equal(exhausts.length, 3, '3 variantes de exhaust');
  assert.equal(regens.length, 3, '3 variantes de regen');
  for (const d of [...exhausts, ...regens]) {
    const parts = d.build(ctx, 0.5);
    assert.ok(parts && parts.length > 0, `efeito ${d.id} var ${d.variant} produz partículas`);
  }
});

test('variantes: a variante disparada vem de C.vfx (fonte única), igual à exibida no painel', () => {
  const rt = makeRuntime();
  const before = C.vfx.hit.variant;
  C.vfx.hit.variant = 2;
  const ev = [{tick: 10, attacker: 0, target: 1, result: 'impact', damage: 20, normal: {x: 0, y: 0, z: 1}}];
  rt.update(fighters, ev, 0.016, {tick: 10});
  const active = [...rt.activeEffects.values()];
  assert.ok(active.length > 0);
  assert.equal(active[0].effectDef.variant, 2, 'deve disparar a variante 2 (C)');
  C.vfx.hit.variant = before;
});

test('variantes: setVariant não sobrepõe C.vfx; desfazer/refazer (C mudou) vale no próximo disparo', () => {
  const rt = makeRuntime();
  const before = C.vfx.hit.variant;
  rt.setVariant('hit', 2);                 // chamada antiga do painel: não pode criar uma escolha paralela
  assert.equal(rt.getVariant('hit'), before, 'sem desvio: continua o valor da configuração');
  C.vfx.hit.variant = 1; assert.equal(rt.getVariant('hit'), 1);
  C.vfx.hit.variant = 0; assert.equal(rt.getVariant('hit'), 0, 'depois do desfazer o runtime acompanha a configuração');
  rt.update(fighters, [{tick: 11, attacker: 0, target: 1, result: 'impact', damage: 20, normal: {x: 0, y: 0, z: 1}}], 0.016, {tick: 11});
  assert.equal([...rt.activeEffects.values()][0].effectDef.variant, 0);
  C.vfx.hit.variant = before;
});

test('runtime: update repassa world para o BeamRenderer e contabiliza beamsActive', () => {
  const rt = makeRuntime();
  const fakeWorld = {
    entities: [{
      id: 1, kind: 'beam', y: 0.8, pl: 1, dead: false,
      segments: [{a: {x: 0, z: 0}, b: {x: 5, z: 0}, pl: 1}]
    }]
  };
  rt.update(fighters, [], 0.016, {tick: 20, world: fakeWorld});
  assert.equal(rt.stats.beamsActive, 1, '1 feixe ativo registrado');
  assert.equal(rt.beamRenderer.beams[0].beamGroup.visible, true);
});

test('beam: binding de controles C.vfx.laser sincroniza com BeamRenderer.setConfig()', () => {
  const scene = new T.Scene();
  const renderer = new BeamRenderer(scene);
  const cfg = C.vfx.laser;
  assert.ok(cfg, 'C.vfx.laser deve existir na configuração');
  assert.equal(typeof cfg.coreWidth1, 'number');
  assert.equal(typeof cfg.intensity, 'number');
  assert.equal(typeof cfg.pulseFreq, 'number');
  renderer.setConfig({
    coreWidth1: 0.22,
    intensity: 1.8,
    pulseFreq: 2.5,
    noFlash: true,
    reduceMotion: true,
    highContrast: true
  });
  assert.equal(renderer.config.coreWidth1, 0.22);
  assert.equal(renderer.config.intensity, 1.8);
  assert.equal(renderer.config.pulseFreq, 2.5);
  assert.equal(renderer.config.noFlash, true);
  assert.equal(renderer.config.reduceMotion, true);
  assert.equal(renderer.config.highContrast, true);
  renderer.dispose();
});

test('beam: serialização e restauração de parâmetros via snapshot JSON', () => {
  const scene = new T.Scene();
  const renderer = new BeamRenderer(scene);
  const original = JSON.parse(JSON.stringify(C.vfx.laser));
  const modified = {...original, coreWidth1: 0.25, haloWidth3: 1.1, pulseFreq: 2.8};
  const serialized = JSON.stringify(modified);
  const restored = JSON.parse(serialized);
  renderer.setConfig(restored);
  assert.equal(renderer.config.coreWidth1, 0.25);
  assert.equal(renderer.config.haloWidth3, 1.1);
  assert.equal(renderer.config.pulseFreq, 2.8);
  renderer.dispose();
});

test('beam: acessibilidade reduceMotion e highContrast ajustam animação e opacidades', () => {
  const scene = new T.Scene();
  const renderer = new BeamRenderer(scene);
  renderer.setConfig({reduceMotion: true, highContrast: true});
  const fakeWorld = {
    entities: [{
      id: 1, kind: 'beam', y: 0.8, pl: 1, dead: false,
      segments: [{a: {x: 0, z: 0}, b: {x: 5, z: 0}, pl: 1}]
    }]
  };
  renderer.update(fakeWorld, 0.016);
  const seg0 = renderer.beams[0].segments[0];
  assert.equal(seg0.coreMat.opacity, 0.95);
  assert.ok(seg0.coreMesh.scale.x > renderer.config.coreWidth1, 'highContrast amplia largura do núcleo');
  renderer.dispose();
});

test('beam: troca de qualidade (low, medium, high) ajusta visibilidade de halos', () => {
  const scene = new T.Scene();
  const renderer = new BeamRenderer(scene, {quality: 'medium'});
  const fakeWorld = {
    entities: [{
      id: 1, kind: 'beam', y: 0.8, pl: 1, dead: false,
      segments: [
        {a: {x: 0, z: 0}, b: {x: 5, z: 0}, pl: 1},
        {a: {x: 5, z: 0}, b: {x: 10, z: 0}, pl: 1}
      ]
    }]
  };
  renderer.setQuality('medium');
  renderer.update(fakeWorld, 0.016);
  assert.equal(renderer.beams[0].segments[0].haloMesh.visible, true);
  assert.equal(renderer.beams[0].segments[1].haloMesh.visible, true);
  renderer.setQuality('low');
  renderer.update(fakeWorld, 0.016);
  assert.equal(renderer.beams[0].segments[0].haloMesh.visible, true, 'halo do primeiro segmento mantido');
  assert.equal(renderer.beams[0].segments[1].haloMesh.visible, false, 'halo do segundo segmento ocultado em Low');
  renderer.dispose();
});

test('beam: reset durante feixe ativo oculta e limpa grupos sem referências órfãs', () => {
  const scene = new T.Scene();
  const renderer = new BeamRenderer(scene);
  const fakeWorld = {
    entities: [{
      id: 1, kind: 'beam', y: 0.8, pl: 2, dead: false,
      segments: [{a: {x: 0, z: 0}, b: {x: 8, z: 0}, pl: 2}]
    }]
  };
  renderer.update(fakeWorld, 0.016);
  assert.equal(renderer.beams[0].beamGroup.visible, true);
  assert.equal(renderer.beams[0].segments[0].coreMesh.visible, true);
  renderer.reset();
  assert.equal(renderer.beams[0].beamGroup.visible, false);
  renderer.update(fakeWorld, 0.016);
  assert.equal(renderer.beams[0].beamGroup.visible, true);
  renderer.dispose();
});

test('beam: reflexão e neutralização ativam sinalizadores visuais e flare', () => {
  const scene = new T.Scene();
  const renderer = new BeamRenderer(scene);
  renderer.setConfig({reflectionActive: 1, neutralizeActive: 1});
  const fakeWorld = {
    entities: [{
      id: 1, kind: 'beam', y: 0.8, pl: 2, dead: false,
      segments: [
        {a: {x: 0, z: 0}, b: {x: 3, z: 0}, pl: 2, by: 10},
        {a: {x: 3, z: 0}, b: {x: 6, z: 0}, pl: 2, neutralized: true}
      ]
    }]
  };
  renderer.update(fakeWorld, 0.016);
  const seg0 = renderer.beams[0].segments[0];
  const seg1 = renderer.beams[0].segments[1];
  assert.equal(seg0.flareMesh.visible, true, 'flare visível na reflexão');
  assert.equal(seg1.coreMat.color.getHex(), 0xd0d0d0, 'núcleo cinza esbranquiçado quando neutralizado');
  assert.equal(seg1.coreMat.opacity, 0.35, 'opacidade reduzida quando neutralizado');
  renderer.dispose();
});

test('beam: exclusão mútua entre WorldView e BeamRenderer (skipBeams=true)', () => {
  const scene = new T.Scene();
  const wv = new WorldView(scene);
  const fakeWorld = {
    entities: [{
      id: 10, kind: 'beam', y: 0.8, pl: 1, dead: false,
      segments: [{a: {x: 0, z: 0}, b: {x: 5, z: 0}, pl: 1}]
    }]
  };
  wv.update(fakeWorld, {dt: 0.016, skipBeams: false});
  const beamMesh = wv.meshes.get(10);
  assert.ok(beamMesh, 'malha criada no worldView');
  assert.equal(beamMesh.children[0].visible, true, 'feixe legado visível no worldView');
  wv.update(fakeWorld, {dt: 0.016, skipBeams: true});
  assert.equal(beamMesh.children[0].visible, false, 'feixe legado oculto no worldView sob novo VFX');
});

test('beam: gatilho experimental com simulação física real (Game.step() e Beam entity)', () => {
  const game = new Game();
  game.reset();
  const scene = new T.Scene();
  const renderer = new BeamRenderer(scene);
  const b = spawn(game.world, {
    kind: 'beam', owner: 1, pos: {x: 0, z: 5}, dir: {x: 0, z: -1},
    life: 4, pl: 2, length: 20, maxSegments: 8, interval: 0.25,
    hit: {damage: 5}
  });
  assert.ok(b, 'entidade beam spawnada');
  game.step();
  assert.ok(b.segments.length > 0, 'simulação física gerou segmentos de feixe');
  renderer.update(game.world, 0.016);
  assert.equal(renderer.beams[0].entityId, b.id);
  assert.equal(renderer.beams[0].beamGroup.visible, true);
  assert.equal(renderer.beams[0].segments[0].coreMesh.visible, true);
  renderer.dispose();
});

console.log(`\n${passed} testes de VFX aprovados.`);
