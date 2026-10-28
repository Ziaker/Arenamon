// @ts-check
// F5 — coordenadas mundo/local dos emissores (three.quarks/Three) e os 3 pilotos coerentes com a física:
//   • posição por worldToLocal e direção pelo quaternion mundial inverso sob pais aninhados girados; matriz normal com escala não uniforme (erro < 1e-6);
//   • Sand Wave: a posição de contato vem do EVENTO da simulação (x/z do alvo no contato), não de um extremo/centro arbitrário; o relógio visual segue a frente física;
//   • Bullet Punch: uma fonte canônica para o interruptor (`atelierVfx`; `enableAtelierVfx` migrado na leitura de presets/JSON/sessão); estados visuais
//     coerentes (preparação → vanish → retorno → investida → impacto) e nenhum impacto de OUTRA ação do mesmo lutador conta para o rush;
//   • Water Pulse: `dying` visual separado da morte física (reflexão não congela o projétil), splash de 2,4 s e descarte efetivo dos emissores e lotes.
import assert from 'node:assert/strict';
import {test} from 'node:test';

// DOM mínimo (ElementalPreview e a areia do ateliê criam texturas em canvas 2D).
const ctx2d = /** @type {any} */ (new Proxy(function () {}, {get: (t, k) => k === 'canvas' ? null : (k in t ? /** @type {any} */ (t)[k] : ctx2d), set: () => true, apply: () => ctx2d}));
const el = () => ({style: {}, classList: {add() {}, remove() {}, toggle() {}, contains: () => false}, children: /** @type {any[]} */ ([]), appendChild(/** @type {any} */ c) {this.children.push(c);return c;}, removeChild() {}, remove() {}, setAttribute() {}, addEventListener() {}, removeEventListener() {}, querySelector: () => null, querySelectorAll: () => [], getContext: () => ctx2d, getBoundingClientRect: () => ({width: 0, height: 0, left: 0, top: 0}), clientWidth: 0, clientHeight: 0, width: 0, height: 0, dataset: {}});
const G = /** @type {any} */ (globalThis);
G.document ??= {getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: el, body: el(), documentElement: el()};
G.Path2D ??= class {};G.window ??= globalThis;G.devicePixelRatio ??= 1;G.addEventListener ??= () => {};

const T = await import('three');
const Q = await import('three.quarks');
const {worldPointToLocal, worldDirToLocal, worldNormalToLocal} = await import('../src/view/quarks/coords.js');
const {Particles} = await import('../../sand-stone-lab/src/particles.js');
const sandVfx = await import('../src/sim/moves/sand-wave/sand-wave.vfx.js');
const bpVfx = await import('../src/sim/moves/bullet-punch/bullet-punch.vfx.js');
const wpVfx = await import('../src/sim/moves/water-pulse/water-pulse.vfx.js');
const {MovesVfxRegistry} = await import('../src/view/moves-vfx-registry.js');
const {migrateFlat} = await import('../src/ui/actions-meta.js');
const {migrateLegacyPreset} = await import('../src/sim/presets.js');
const {editableMove} = await import('../src/editor/editable-moves.js');
const {arena, cmd, vec, secs, HOLD, C, resetConfig, factoryDefaults} = await import('./moves-new-helpers.mjs');
const {spawn} = await import('../src/sim/world.js');
const {sandFieldOf} = await import('../src/sim/sand.js');

const close = (/** @type {any} */ a, /** @type {any} */ b, eps = 1e-6) => Math.abs(a.x - b.x) < eps && Math.abs(a.y - b.y) < eps && Math.abs(a.z - b.z) < eps;
const fmt = (/** @type {any} */ v) => `(${v.x.toFixed(8)}, ${v.y.toFixed(8)}, ${v.z.toFixed(8)})`;

/** Três pais aninhados com rotações nos 3 eixos e (opcional) escala não uniforme. */
function nested(nonUniform = false) {
  const scene = new T.Scene(), a = new T.Group(), b = new T.Group(), c = new T.Group();
  a.position.set(3, -1, 7);a.rotation.set(.4, 1.1, -.3);
  b.position.set(-2, .5, 1.5);b.rotation.set(-.8, .25, .9);b.scale.setScalar(nonUniform ? 1 : 1.7);
  c.position.set(.3, 2, -.4);c.rotation.set(.15, -1.4, .6);
  if (nonUniform) {a.scale.set(1, 2.5, .6);c.scale.set(3, .5, 1.2);}
  scene.add(a);a.add(b);b.add(c);scene.updateMatrixWorld(true);
  return {scene, leaf: c};
}

test('coordenadas: posição por worldToLocal sob 3 pais girados e com escala (uniforme e não uniforme), erro < 1e-6', () => {
  for (const nu of [false, true]) {
    const {leaf} = nested(nu), p = {x: 4.2, y: 1.3, z: -2.7};
    const local = worldPointToLocal(leaf, p), back = leaf.localToWorld(local.clone());
    assert.ok(close(back, p), `${nu ? 'não uniforme' : 'uniforme'}: ${fmt(back)} ≠ ${fmt(p)}`);
  }
});

test('coordenadas: direção pelo quaternion mundial inverso em grupos rotacionais (pais aninhados), erro < 1e-6', () => {
  const {leaf} = nested(false), d = new T.Vector3(.3, .5, -.8).normalize();
  const local = worldDirToLocal(leaf, d);
  const q = new T.Quaternion();leaf.getWorldQuaternion(q);
  const viaQuat = d.clone().applyQuaternion(q.clone().invert());
  assert.ok(close(local, viaQuat), `deve ser o quaternion mundial inverso: ${fmt(local)} × ${fmt(viaQuat)}`);
  const back = local.clone().transformDirection(leaf.matrixWorld);
  assert.ok(close(back, d), `volta ao mundo: ${fmt(back)} ≠ ${fmt(d)}`);
});

test('coordenadas: escala não uniforme — direção pela inversa linear e normal pela matriz normal (o quaternion sozinho erra)', () => {
  const {leaf} = nested(true), d = new T.Vector3(.6, -.2, .77).normalize(), n = new T.Vector3(-.1, .9, .42).normalize();
  const ld = worldDirToLocal(leaf, d), backD = ld.clone().transformDirection(leaf.matrixWorld);
  assert.ok(close(backD, d), `direção: ${fmt(backD)} ≠ ${fmt(d)}`);
  const ln = worldNormalToLocal(leaf, n), backN = ln.clone().applyMatrix3(new T.Matrix3().getNormalMatrix(leaf.matrixWorld)).normalize();
  assert.ok(close(backN, n), `normal: ${fmt(backN)} ≠ ${fmt(n)}`);
  // Prova de que o caso é não trivial: só o quaternion inverso não acerta a direção com escala não uniforme.
  const q = new T.Quaternion();leaf.getWorldQuaternion(q);
  const naive = d.clone().applyQuaternion(q.invert()).transformDirection(leaf.matrixWorld);
  assert.ok(!close(naive, d, 1e-3), 'o caminho ingênuo deveria falhar aqui');
});

// ---------- Sand Wave ----------
/** Sand Wave real (Game) até o primeiro contato: devolve o evento de dano e o alvo no momento. */
function sandContact() {
  const g = arena({equip: ['sand-wave'], positions: [vec(0, -4), vec(.6, -1.5)]});
  g.step(cmd({skill: 0, skillHeld: HOLD(0)}), cmd());
  for (let i = 1; i < secs(2); i++) {
    g.step(cmd(), cmd());
    const ev = g.lastStepEvents.find((/** @type {any} */ e) => e.move === 'sand-wave' && (e.result === 'impact' || e.result === 'partial'));
    if (ev) return {g, ev, target: {...g.fighters[1].position}, wave: g.world.entities.find((/** @type {any} */ e) => e.kind === 'sandwave')};
  }
  return {g, ev: null, target: null, wave: null};
}

test('Sand Wave: o evento de contato traz a posição do alvo (x/z) e o emissor nasce nela, sob pais girados', () => {
  try {
    const {ev, wave} = sandContact();
    assert.ok(ev, 'houve contato');
    assert.ok(Number.isFinite(ev.x) && Number.isFinite(ev.z), `o evento traz x/z do contato: ${JSON.stringify({x: ev.x, z: ev.z})}`);
    assert.ok(Math.abs(ev.x - .6) < .05 && Math.abs(ev.z + 1.5) < .3, `contato no alvo, não no centro/extremo da onda: ${ev.x}, ${ev.z}`);
    // Emissor: grupo da onda sob um pai girado/deslocado (o mundo do jogo pode ser transformado)
    const scene = new T.Scene(), world = new T.Group();world.position.set(2, .5, -3);world.rotation.y = .7;scene.add(world);
    const group = new T.Group();group.position.set(wave.pos.x, 0, wave.pos.z + 2);group.rotation.y = .3;world.add(group);scene.updateMatrixWorld(true);
    const particles = new Particles(group, {textures: false});
    sandVfx.onEvent({fighters: []}, ev, {group, particles, pos: wave.pos, dir: wave.dir, len: wave.length, y: 0, front: 0});
    const emitter = particles.systems[0].emitter;emitter.updateMatrixWorld(true);
    const got = emitter.getWorldPosition(new T.Vector3()), want = world.localToWorld(new T.Vector3(ev.x, sandVfx.CONTACT_Y, ev.z));
    assert.ok(close(got, want), `emissor no contato do evento: ${fmt(got)} ≠ ${fmt(want)}`);
  } finally {resetConfig(factoryDefaults());}
});

test('Sand Wave: sem posição nem alvo, o fallback é a FRENTE física da onda (não o meio do retângulo)', () => {
  const scene = new T.Scene(), group = new T.Group();scene.add(group);
  const particles = new Particles(group, {textures: false});
  sandVfx.onEvent({fighters: []}, {result: 'impact', target: null}, {group, particles, pos: {x: 0, z: 0}, dir: {x: 0, z: 1}, len: 4, y: 0, front: 1.2});
  const emitter = particles.systems[0].emitter;emitter.updateMatrixWorld(true);
  const got = emitter.getWorldPosition(new T.Vector3());
  assert.ok(Math.abs(got.z - 1.2) < 1e-6 && Math.abs(got.x) < 1e-6, `fallback na frente (z = 1,2): ${fmt(got)}`);
});

test('Sand Wave: o relógio visual segue a idade física da entidade (quadros perdidos não atrasam a frente)', () => {
  const view = {group: new T.Group()};
  const e = {id: 1, kind: 'sandwave', pos: {x: 0, z: 0}, dir: {x: 0, z: 1}, length: 4, width: 3, active: .75, life: 1.5, age: 0, y: 0, speed0: 4 / .75, waveAccel: 0};
  const st = sandVfx.spawn(view, e, {});
  e.age = .3;sandVfx.update(view, e, st, 1 / 60, {});   // o view só desenhou 1 quadro, mas a simulação já andou 0,3 s
  assert.ok(Math.abs(st.age - .3) < 1e-9, `idade visual = idade física (${st.age})`);
  assert.ok(Math.abs(st.front - 4 * .3 / .75) < 1e-9, `frente física guardada (${st.front})`);
  sandVfx.onDeath(view, e, st);sandVfx.updateDying(view, e, st, .1, {});
  assert.ok(Math.abs(st.age - .4) < 1e-9, 'na dissipação o relógio continua pelo dt');
  sandVfx.dispose(view, e, st);
});

// ---------- Bullet Punch ----------
test('Bullet Punch: `atelierVfx` é a fonte canônica; `enableAtelierVfx` só vale como legado quando a canônica não existe', () => {
  assert.equal(bpVfx.atelierVfxOn({atelierVfx: 1, enableAtelierVfx: 0}), true, 'a canônica manda');
  assert.equal(bpVfx.atelierVfxOn({atelierVfx: 0, enableAtelierVfx: 1}), false);
  assert.equal(bpVfx.atelierVfxOn({enableAtelierVfx: 0}), false, 'legado lido quando a canônica falta');
  assert.equal(bpVfx.atelierVfxOn({}), true, 'padrão ligado');
});

test('Bullet Punch: presets, JSON importado e sessão antiga migram `enableAtelierVfx` → `atelierVfx`', () => {
  const known = new Set(['world.bulletPunch.atelierVfx']);
  const m = migrateFlat({'world.bulletPunch.enableAtelierVfx': 0}, known);
  assert.deepEqual(m.values, {'world.bulletPunch.atelierVfx': 0});
  assert.deepEqual(m.converted, [{from: 'world.bulletPunch.enableAtelierVfx', to: 'world.bulletPunch.atelierVfx', value: 0}]);
  assert.deepEqual(m.ignored, [], 'nada descartado em silêncio');
  assert.deepEqual(migrateFlat({'world.bulletPunch.enableAtelierVfx': 0, 'world.bulletPunch.atelierVfx': 1}, known).values, {'world.bulletPunch.atelierVfx': 1}, 'com as duas, vale a canônica');
  const p = migrateLegacyPreset({name: 'velho', savedAt: 1, values: {'world.bulletPunch.enableAtelierVfx': 0, 'world.sandWave.damage': 6}});
  assert.deepEqual(p.values, {'world.bulletPunch.atelierVfx': 0, 'world.sandWave.damage': 6});
});

test('Bullet Punch: o controle da interface (Editor/aba Moves) escreve a chave canônica', () => {
  const bp = editableMove('bullet-punch');
  assert.ok(bp, 'Bullet Punch no editor');
  const rows = bp.params.rows.map((/** @type {any} */ r) => r.key);
  assert.ok(rows.includes('atelierVfx') && !rows.includes('enableAtelierVfx'), rows.join(','));
  assert.equal(`world.${bp.group}.atelierVfx`, 'world.bulletPunch.atelierVfx', 'data-path do controle = caminho canônico');
});

/** Rush do Bullet Punch numa luta real, desenhado pelo registro; devolve o rush e a lista de eventos por passo. */
function bulletRun(/** @type {(g: any, i: number) => void} */ extra = () => {}) {
  const g = arena({equip: ['bullet-punch'], positions: [vec(0, -4), vec(0, 0)]});
  const view = {group: new T.Group()}, reg = new MovesVfxRegistry(view);
  const states = /** @type {string[]} */ ([]);let rush = null;
  g.step(cmd({skill: 0, skillHeld: HOLD(0)}), cmd());
  for (let i = 1; i < secs(1.6); i++) {
    g.step(cmd(), cmd());extra(g, i);
    reg.sync([], 1 / 120, {}, g.fighters);
    for (const ev of g.lastStepEvents) reg.onEvent(ev);
    rush ??= reg.rushes[0]?.rush ?? null;
    if (rush && states.at(-1) !== rush.state) states.push(rush.state);
  }
  return {g, reg, rush, states};
}

test('Bullet Punch: estados visuais coerentes (preparação → vanish → retorno → investida → impacto) e impacto convertido para o espaço do grupo', () => {
  try {
    const {rush, states, reg} = bulletRun();
    assert.ok(rush, 'rush criado');
    assert.deepEqual(states.filter(s => s !== 'fim'), ['preparacao', 'vanish', 'retorno', 'investida', 'impacto'], states.join(' → '));
    // impacto: o ponto local (grupo girado no heading do disparo) volta ao mundo no ponto do lutador no contato
    const w = rush.group.localToWorld(rush.impact.clone());
    assert.ok(close(w, {x: rush.impactWorld.x, y: rush.impactWorld.y, z: rush.impactWorld.z}), `impacto local→mundo ${fmt(w)} ≠ ${fmt(rush.impactWorld)}`);
    reg.disposeAll();
  } finally {resetConfig(factoryDefaults());}
});

test('Bullet Punch: impacto de OUTRA ação do mesmo lutador não dispara o impacto do rush', () => {
  try {
    const view = {group: new T.Group()}, reg = new MovesVfxRegistry(view);
    const f = {id: 0, position: {x: 0, z: 0}, groundY: 0, facing: 0, action: {move: 'bullet-punch', kind: 'move'}};
    reg.sync([], 1 / 60, {}, [f]);
    const r = reg.rushes[0].rush;
    // Tackle comum do mesmo lutador (sem retorno do Bullet Punch antes): ignorado
    f.action = {kind: 'tackle'};
    reg.onEvent({result: 'impact', attacker: 0, target: 1, contact: 'tackle'});
    assert.equal(r.state === 'impacto', false, 'impacto de um Tackle comum não é do rush');
    assert.equal(r.struck, false);
    // Evento de outro lutador: ignorado
    reg.onEvent({result: 'bulletReturn', attacker: 1, move: 'bullet-punch', x: 1, z: 1});
    assert.equal(r.returned, false);
    reg.disposeAll();
  } finally {resetConfig(factoryDefaults());}
});

// ---------- Water Pulse ----------
const waterOrb = (/** @type {number} */ id, /** @type {any} */ pos) => ({id, kind: 'projectile', visual: 'waterorb', pos: {...pos}, y: .9, dir: {x: 0, z: 1}, pl: 1, radius: .38, dead: false});
function waterView() {
  const group = new T.Group(), batch = new Q.BatchedRenderer();group.add(batch);
  return {group, elementalFx: {batch}};
}
const emptyBatches = (/** @type {any} */ b) => b.batches.filter((/** @type {any} */ x) => !x.systems.size).length;

test('Water Pulse: reflexão (entidade viva) não vira dying visual nem congela o projétil', () => {
  const view = waterView(), reg = new MovesVfxRegistry(view), e = waterOrb(7, {x: 0, z: 0});
  reg.sync([e], 1 / 60, {}, []);
  reg.onEvent({result: 'reflected', entity: 7, attacker: 1});
  const st = reg.activeInstances.get(7).state;
  assert.equal(st.visualDying, false, 'reflexão não encerra o visual');
  e.pos = {x: 0, z: 2};e.dir = {x: 0, z: -1};
  reg.sync([e], 1 / 60, {}, []);
  assert.ok(Math.abs(st.preview.root.position.z - 2) < 1e-9, `o visual continua seguindo a entidade (z = ${st.preview.root.position.z})`);
  reg.disposeAll();
});

test('Water Pulse: contato terminal = dying visual no ponto do contato; morte física depois; splash 2,4 s; descarte efetivo de emissores e lotes', () => {
  const view = waterView(), reg = new MovesVfxRegistry(view), e = waterOrb(9, {x: 1, z: 1});
  reg.sync([e], 1 / 60, {}, []);
  const inst = reg.activeInstances.get(9), st = inst.state, systems = [...st.preview.systems], emitters = systems.map((/** @type {any} */ s) => s.emitter);
  assert.ok(systems.length > 0, 'emissores criados');
  // A simulação mata a entidade no contato; o evento chega no mesmo quadro, antes de ela sumir da lista.
  e.dead = true;
  reg.onEvent({result: 'impact', entity: 9, attacker: 0, target: 1, x: 1.4, z: 1.6});
  assert.equal(st.visualDying, true, 'contato terminal inicia o dying visual');
  assert.equal(st.physicallyDead, false, 'a entidade ainda não saiu do mundo');
  assert.ok(Math.abs(st.preview.root.position.x - 1.4) < 1e-9 && Math.abs(st.preview.root.position.z - 1.6) < 1e-9, 'splash no ponto do contato');
  reg.sync([], 1 / 60, {}, []);   // a entidade sumiu: morte física
  assert.equal(st.physicallyDead, true);
  for (let i = 0; i < 23; i++) reg.sync([], .1, {}, []);
  reg.sync([], .09, {}, []);   // 2,39 s desde a morte física
  assert.ok(reg.activeInstances.has(9), 'splash ainda vivo antes de 2,4 s');
  reg.sync([], .02, {}, []);
  assert.ok(!reg.activeInstances.has(9), 'splash encerrado em 2,4 s');
  assert.equal(st.preview.systems.length, 0, 'sistemas descartados');
  assert.ok(emitters.every((/** @type {any} */ m) => !m.parent), 'emissores fora da cena');
  assert.equal(emptyBatches(view.elementalFx.batch), 0, 'nenhum lote vazio do three.quarks sobra');
  assert.ok(!st.preview.root.parent, 'raiz removida');
});

// ---------- Revisão da Task 13 (rodada 1) ----------

/** Sand Wave real (Game) desenhado pelo registro a cada passo; devolve o histórico do comprimento visível/desenhado e o campo físico. */
function sandRun(/** @type {any[]} */ obstacles) {
  const g = arena({equip: ['sand-wave'], positions: [vec(0, -4), vec(6, 6)]});
  g.mapState.obstacles = obstacles;
  const view = {group: new T.Group()}, reg = new MovesVfxRegistry(view), hist = /** @type {any[]} */ ([]);
  let wave = null;
  g.step(cmd({skill: 0, skillHeld: HOLD(0)}), cmd());
  for (let i = 1; i < secs(1.6); i++) {
    g.step(cmd(), cmd());
    wave ??= g.world.entities.find((/** @type {any} */ e) => e.kind === 'sandwave') ?? null;
    reg.sync(g.world.entities, 1 / 120, {}, g.fighters, g.lastStepEvents);
    const st = wave ? reg.activeInstances.get(wave.id)?.state : null;
    if (st) hist.push({reach: st.reach, drawn: st.drawnLength, visible: st.visibleLength, front: st.front});
  }
  return {wave, field: wave ? sandFieldOf(wave) : null, hist, reg};
}

test('Sand Wave: a frente visual para no obstáculo do caminho (rota física do campo de distâncias), dentro de uma célula', () => {
  try {
    // Caixa atravessando o eixo da onda (origem z = −4, eixo +z): face próxima em z = −2 → 2 m de caminho livre
    const {wave, field, hist, reg} = sandRun([{id: 'ob', shape: 'box', pos: {x: 0, y: 0, z: -1.5}, hx: 2, hz: .5, radius: 2, height: 2, angle: 0}]);
    assert.ok(wave && field, 'onda e campo físico calculados');
    const reach = hist.at(-1).reach, cs = field.cs;
    assert.ok(Math.abs(reach - 2) <= cs + .02, `alcance livre ${reach} ≈ 2 m (face do obstáculo), célula ${cs}`);
    assert.ok(hist.every(h => h.visible <= h.reach + 1e-9), 'o desenho nunca passa do alcance livre');
    assert.ok(hist.some(h => h.drawn > h.reach + cs), 'sem o corte o desenho atravessaria o obstáculo (o corte agiu)');
    const at = (/** @type {number} */ u) => {const x = wave.pos.x + wave.dir.x * u, z = wave.pos.z + wave.dir.z * u;return field.dist[Math.floor((z - field.minZ) / cs) * field.nx + Math.floor((x - field.minX) / cs)];};
    assert.ok(Number.isFinite(at(reach - cs)), 'antes do corte: alcançável em linha');
    assert.ok(!Number.isFinite(at(reach + cs / 4)) || at(reach + cs / 4) - reach > 1.5 * cs, 'no corte: bloqueado ou só contornando');
    reg.disposeAll();
  } finally {resetConfig(factoryDefaults());}
});

test('Sand Wave: sem obstáculo o corte não age — comprimento visível idêntico ao desenhado em todos os quadros', () => {
  try {
    const {hist, wave, reg} = sandRun([]);
    assert.ok(hist.length > 100);
    assert.ok(hist.every(h => h.reach === wave.length), 'alcance livre = comprimento inteiro');
    assert.ok(hist.every(h => h.visible === h.drawn), 'quadro a quadro igual ao desenho sem corte');
    reg.disposeAll();
  } finally {resetConfig(factoryDefaults());}
});

/**
 * Water Pulse numa luta real, com a ORDEM do jogo (wv-update.js): a simulação remove a entidade morta no mesmo passo do contato; o desenho
 * chama sync(entidades, …, eventos) e só depois onEvent de cada evento.
 */
function waterRun({setup = /** @type {(g: any) => void} */ (() => {}), every = /** @type {(g: any) => void} */ (() => {}), red = vec(0, 1), hold = 10, redCmd = /** @type {any} */ ({})} = {}) {
  const g = arena({equip: ['water-pulse'], positions: [vec(0, -4), red]});
  setup(g);
  const view = waterView(), reg = new MovesVfxRegistry(view);
  /** @type {any} */ let st = null;
  let systems = /** @type {any[]} */ ([]), terminal = /** @type {any} */ (null), reflected = /** @type {any} */ (null), followedAfterReflect = false, finishedAt = /** @type {number | null} */ (null), id = /** @type {any} */ (null);
  const frame = () => {
    reg.sync(g.world.entities, 1 / 120, {}, g.fighters, g.lastStepEvents);
    for (const ev of g.lastStepEvents) reg.onEvent(ev);
    const proj = g.world.entities.find((/** @type {any} */ e) => e.kind === 'projectile' && e.visual === 'waterorb');
    if (proj && id == null) {id = proj.id;st = reg.activeInstances.get(id).state;systems = [...st.preview.systems];}
    if (reflected && proj && !st.visualDying && Math.abs(st.preview.root.position.z - proj.pos.z) < 1e-9 && Math.abs(proj.pos.z - reflected.z) > .2) followedAfterReflect = true;
  };
  g.step(cmd({skill: 0, skillHeld: HOLD(0)}), cmd());frame();
  for (let i = 1; i <= hold; i++) {every(g);g.step(cmd({skillHeld: HOLD(0)}), cmd(redCmd));frame();}
  for (let i = 0; i < secs(6) && finishedAt == null; i++) {
    every(g);g.step(cmd(), cmd(redCmd));
    for (const ev of g.lastStepEvents) if (id != null && ev.entity === id) {
      if (ev.result === 'reflected') reflected ??= {z: g.world.entities.find((/** @type {any} */ e) => e.id === id)?.pos.z};
      else if (!g.world.entities.some((/** @type {any} */ e) => e.id === id)) terminal ??= ev;
    }
    frame();
    if (st && id != null && !reg.activeInstances.has(id)) finishedAt = i;
  }
  return {g, view, st, systems, terminal, reflected, followedAfterReflect, finishedAt};
}

/** Checagens comuns: o evento terminal traz o ponto do contato, o splash nasce nele, os emissores saem e nenhum lote vazio sobra. */
function checkSplash(/** @type {any} */ r, /** @type {string[]} */ results) {
  assert.ok(r.terminal, 'houve contato terminal');
  assert.ok(results.includes(r.terminal.result), `resultado ${r.terminal.result}`);
  const c = r.terminal.contactPoint ?? r.terminal;
  assert.ok(Number.isFinite(c.x) && Number.isFinite(c.z), `o evento terminal ${r.terminal.result} traz o ponto do contato: ${JSON.stringify(c)}`);
  assert.deepEqual(r.st.splashAt, {x: c.x, z: c.z, result: r.terminal.result}, 'splash posto no ponto do evento (ordem real: sync → onEvent)');
  assert.ok(r.finishedAt != null, 'splash encerrado');
  assert.equal(r.st.preview.systems.length, 0, 'sistemas descartados');
  assert.ok(r.systems.length > 0 && r.systems.every((/** @type {any} */ s) => !s.emitter.parent), 'emissores fora da cena');
  assert.equal(emptyBatches(r.view.elementalFx.batch), 0, 'nenhum lote vazio');
}

/** Faz o vermelho olhar para o azul. @param {any} g */
const faceBlue = g => {const b = g.fighters[1], a = g.fighters[0];return Math.atan2(a.position.x - b.position.x, a.position.z - b.position.z);};

test('Water Pulse (ordem real): acerto no lutador — splash no ponto do contato do projétil', () => {
  try {checkSplash(waterRun(), ['impact']);} finally {resetConfig(factoryDefaults());}
});

test('Water Pulse (ordem real): defesa parcial e perfeita — splash no ponto do contato', () => {
  try {
    checkSplash(waterRun({redCmd: {guard: true}, every: g => {const b = g.fighters[1];b.facing = faceBlue(g);b.perfectLeft = 0;}}), ['partial']);
    checkSplash(waterRun({redCmd: {guard: true}, every: g => {const b = g.fighters[1];b.facing = faceBlue(g);b.perfectLeft = 1;}}), ['perfect']);
  } finally {resetConfig(factoryDefaults());}
});

test('Water Pulse (ordem real): obstáculo e plataforma no caminho — splash no ponto do contato', () => {
  try {
    checkSplash(waterRun({setup: g => {g.mapState.obstacles = [{id: 'ob', shape: 'box', pos: {x: 0, y: 0, z: -1.5}, hx: 2, hz: .4, radius: 2, height: 3, angle: 0}];}}), ['obstacleHit']);
    checkSplash(waterRun({setup: g => {g.mapState.platforms = [{id: 'pl', pos: {x: 0, y: 0, z: -1.5}, width: 4, depth: .8, height: 3}];}}), ['platformHit']);
  } finally {resetConfig(factoryDefaults());}
});

test('Water Pulse (ordem real): escudo — reflexão mantém o voo e o contato final tem splash no ponto; bloqueio e neutralização também', () => {
  try {
    const barrier = (/** @type {any} */ over) => (/** @type {any} */ g) => {spawn(g.world, {kind: 'barrier', owner: 1, shape: 'box', pos: {x: 0, z: -.5}, angle: Math.PI, hx: 3, hz: .05, y: 0, height: 3, life: 30, hp: Infinity, blocksProjectiles: true, blocksFighters: true, blocksOwner: true, reflect: true, shields: true, pl: 3, captured: {maxReflections: 16}, ...over}, []);};
    const refl = waterRun({setup: barrier({})});
    assert.ok(refl.reflected, 'refletiu');
    assert.ok(refl.followedAfterReflect, 'depois da reflexão o visual segue a entidade viva (não congela)');
    checkSplash(refl, ['impact', 'partial', 'perfect', 'arenaHit', 'obstacleHit', 'platformHit', 'groundHit', 'destructibleHit']);
    checkSplash(waterRun({setup: barrier({reflect: false})}), ['blocked']);
    checkSplash(waterRun({setup: barrier({pl: 1}), hold: 185}), ['neutralized']);
  } finally {resetConfig(factoryDefaults());}
});

// ---------- Revisão da Task 13 (rodada 2): corte da frente pela MESMA regra de alcance da simulação ----------

/**
 * Sand Wave real numa direção qualquer, com sólidos no mapa e o vermelho parado no eixo em `redU` metros. Devolve o menor alcance visual
 * (freeReachOf) da execução e se o vermelho foi atingido pela onda. Base: varreduras da revisão (scratchpad side.mjs/phys.mjs).
 */
function sandAxis({deg = 0, redU = 3.7, obstacles = /** @type {any[]} */ ([]), destructibles = /** @type {any[]} */ ([]), each = /** @type {(g: any, i: number) => void} */ (() => {})} = {}) {
  const a = deg * Math.PI / 180, d = {x: Math.sin(a), z: Math.cos(a)};
  const g = arena({equip: ['sand-wave'], positions: [vec(0, 0), vec(d.x * redU, d.z * redU)]});
  g.mapState.obstacles = obstacles;g.mapState.destructibles = destructibles;
  g.fighters[0].facing = a;
  g.step(cmd({skill: 0, skillHeld: HOLD(0)}), cmd());
  let w = /** @type {any} */ (null), reach = Infinity, hit = false;
  const reaches = /** @type {number[]} */ ([]);
  for (let i = 0; i < secs(1.5); i++) {
    each(g, i);g.step(cmd(), cmd());
    w ??= g.world.entities.find((/** @type {any} */ e) => e.kind === 'sandwave') ?? null;
    if (w && sandFieldOf(w)) {const r = sandVfx.freeReachOf(w);reaches.push(r);reach = Math.min(reach, r);}
    if (g.lastStepEvents.some((/** @type {any} */ ev) => ev.move === 'sand-wave' && ev.target === 1 && ['impact', 'partial', 'perfect'].includes(ev.result))) hit = true;
  }
  return {w, reach, reaches, hit, d, side: {x: d.z, z: -d.x}};
}

test('Sand Wave: obstáculo AO LADO do eixo (círculo e caixa, folgas 0,15/0,3/1,2 m, 4 direções) não corta — e a física acerta no fim', () => {
  try {
    const bad = /** @type {string[]} */ ([]);
    for (const deg of [0, 22.5, 37.5, 45, 67.5]) for (const gap of [.15, .3, 1.2]) for (const shape of ['pillar', 'box', 'circle']) {
      const a = deg * Math.PI / 180, d = {x: Math.sin(a), z: Math.cos(a)}, side = {x: d.z, z: -d.x}, r = .5;
      // distância do centro ao eixo para a borda ficar a `gap` do eixo (caixa alinhada aos eixos do mundo: meia-largura projetada r·(|cos|+|sin|))
      // 'circle' = o caso da revisão (scratchpad phys.mjs): sem hx/hz, vira caixa r × r em solidsOf e a quina pode RASPAR o eixo — a régua é a física
      const off = gap + (shape === 'box' ? r * (Math.abs(Math.cos(a)) + Math.abs(Math.sin(a))) : r);
      const c = {x: d.x * 2 + side.x * off, z: d.z * 2 + side.z * off};
      const ob = shape === 'circle' ? {id: 'o', shape, pos: {x: c.x, y: 0, z: c.z}, radius: r, height: 2} : {id: 'o', shape, pos: {x: c.x, y: 0, z: c.z}, hx: r, hz: r, radius: r, height: 2, angle: 0};
      const run = sandAxis({deg, obstacles: [ob]});
      if (!(run.reach === run.w.length && run.hit)) bad.push(`${deg}° folga ${gap} ${shape}: alcance visual ${run.reach.toFixed(2)}, vermelho em 3,7 m ${run.hit ? 'atingido' : 'NÃO atingido'}`);
    }
    assert.deepEqual(bad, [], bad.join('\n'));
  } finally {resetConfig(factoryDefaults());}
});

test('Sand Wave: bloqueio real no eixo — o fim visual é alcançado pela física e o que está atrás do bloqueio não é', () => {
  try {
    for (const deg of [0, 30]) {
      const a = deg * Math.PI / 180, d = {x: Math.sin(a), z: Math.cos(a)};
      // parede larga (12 m) atravessando o eixo a 2 m: o contorno sai da região de desvio do campo (inalcançável)
      const wall = {id: 'w', shape: 'box', pos: {x: d.x * 2.4, y: 0, z: d.z * 2.4}, hx: 6, hz: .4, radius: 6, height: 2, angle: 0};
      const probe = sandAxis({deg, obstacles: [wall], redU: 9});   // só mede o alcance (vermelho longe, fora do retângulo)
      const reach = probe.reach;
      assert.ok(reach < probe.w.length - .5, `${deg}°: a parede corta o desenho (alcance ${reach})`);
      const atEnd = sandAxis({deg, obstacles: [wall], redU: Math.max(.6, reach - .3)});
      assert.ok(atEnd.hit, `${deg}°: vermelho no fim visual (${(reach - .3).toFixed(2)} m) é atingido`);
      const behind = sandAxis({deg, obstacles: [wall], redU: 3.5});
      assert.ok(!behind.hit, `${deg}°: vermelho atrás do bloqueio (3,5 m) não é atingido`);
    }
  } finally {resetConfig(factoryDefaults());}
});

test('Sand Wave: rocha destrutível no eixo corta enquanto existe e o corte some quando ela sai do mapa', () => {
  try {
    const rock = {id: 'd1', hp: 30, maxHp: 30, pos: {x: 0, y: 0, z: 2}, size: {hx: 1.5, hz: .4, height: 1.6}, hx: 1.5, hz: .4, height: 1.6, shape: 'box', angle: 0, state: 'solid', respawnTimer: 0, ghostTimer: 0};
    const run = sandAxis({destructibles: [rock], redU: 9, each: (g, i) => {if (i === 40) g.mapState.destructibles = [];}});
    assert.ok(run.reaches.length > 50);
    assert.ok(run.reaches.slice(0, 5).every(r => r < run.w.length - .5), `corta com a rocha (${run.reaches.slice(0, 5).map(r => r.toFixed(2))})`);
    assert.equal(run.reaches.at(-1), run.w.length, 'sem a rocha volta ao comprimento inteiro (campo recalculado)');
  } finally {resetConfig(factoryDefaults());}
});

test('Sand Wave: clipToReach — sem corte (reach = length) não mexe em nada; com corte, só o que passa do alcance', () => {
  const head = (/** @type {number} */ z) => ({head: {visible: true, position: new T.Vector3(0, 0, z)}});
  const mk = () => ({len: 4, fx: {fronts: [head(-1.5), head(1.2), head(1.9)], streams: [{dust: {emitter: {position: new T.Vector3(0, 0, 1.8)}}, grain: {emitter: {position: new T.Vector3(0, 0, .2)}}}], shocks: [{position: new T.Vector3(0, 0, 2)}], rubble: {position: new T.Vector3(0, 0, 2)}}});
  const a = /** @type {any} */ (mk());
  sandVfx.clipToReach(a, 4);
  assert.deepEqual(a.fx.fronts.map((/** @type {any} */ f) => f.head.position.z), [-1.5, 1.2, 1.9], 'sem corte: frentes intactas');
  assert.equal(a.fx.streams[0].dust.emitter.position.z, 1.8);
  assert.ok(Math.abs(a.drawnLength - 3.9) < 1e-9 && a.visibleLength === a.drawnLength, `visível = desenhado (${a.visibleLength})`);
  const b = /** @type {any} */ (mk());
  sandVfx.clipToReach(b, 2.5);   // maxZ = −2 + 2,5 = 0,5
  assert.deepEqual(b.fx.fronts.map((/** @type {any} */ f) => f.head.position.z), [-1.5, .5, .5], 'só as frentes além do alcance são cortadas');
  assert.equal(b.fx.streams[0].dust.emitter.position.z, .5);
  assert.equal(b.fx.streams[0].grain.emitter.position.z, .2, 'jato aquém do alcance fica');
  assert.equal(b.fx.shocks[0].position.z, .5);assert.equal(b.fx.rubble.position.z, .5);
  assert.ok(Math.abs(b.drawnLength - 3.9) < 1e-9 && b.visibleLength === 2.5, 'desenhado 3,9 m, visível 2,5 m');
});

// ---------- Revisão da Task 13 (rodada 2): efeito colateral declarado — x/y/z nos contatos de projétil viram a `position` canônica ----------
// Correção de bug assumida (decisão do controlador): antes, groundHit/destructibleHit/neutralized sem ponto caíam em fighters[target ?? 0]
// (runtime) ou na última malha (anel do WorldView). Agora vão no ponto real do contato, para QUALQUER projétil — aqui, um que não é o Water Pulse.
const {adaptSimEvent} = await import('../src/view/vfx/contract.js');
const {WorldView} = await import('../src/view/world-view.js');
const {VfxSystem} = await import('../src/view/vfx.js');

/** Projétil genérico (não Water Pulse) numa luta real até o evento `result`; devolve o evento, a posição do projétil no passo e o jogo. */
function projectileUntil(/** @type {string} */ result, /** @type {(g: any) => any} */ setup) {
  const g = arena({positions: [vec(0, -8), vec(9, 9)]});
  const p = setup(g);
  for (let i = 0; i < secs(4); i++) {
    g.step(cmd(), cmd());
    const ev = g.lastStepEvents.find((/** @type {any} */ e) => e.result === result && e.entity === p.id);
    if (ev) return {g, ev, at: {x: p.pos.x, y: p.y, z: p.pos.z}};
  }
  return {g, ev: null, at: null};
}
const shot = (/** @type {any} */ over) => (/** @type {any} */ g) => spawn(g.world, {kind: 'projectile', owner: 0, pos: {x: 0, z: -6}, dir: {x: 0, z: 1}, speed: 10, y: .65, radius: .2, life: 4, pierce: 1, pl: 1, hit: {damage: 5}, visual: 'seed', ...over}, []);

test('contatos de projétil (não Water Pulse): groundHit, destructibleHit e neutralized trazem o ponto do contato e o runtime usa ele', () => {
  try {
    const cases = [
      projectileUntil('groundHit', shot({gravity: 9, vy: 2})),
      projectileUntil('destructibleHit', g => {g.mapState.destructibles = [{id: 'd1', hp: 30, maxHp: 30, pos: {x: 0, y: 0, z: -2}, size: {hx: .8, hz: .8, height: 1.6}, hx: .8, hz: .8, height: 1.6, shape: 'box', angle: 0, state: 'solid', respawnTimer: 0, ghostTimer: 0}];return shot({})(g);}),
      projectileUntil('neutralized', g => {spawn(g.world, {kind: 'barrier', owner: 1, shape: 'box', pos: {x: 0, z: -2}, angle: Math.PI, hx: 3, hz: .05, y: 0, height: 3, life: 30, hp: Infinity, blocksProjectiles: true, reflect: true, shields: true, pl: 1, captured: {maxReflections: 16}}, []);return shot({pl: 3})(g);}),
    ];
    for (const {g, ev, at} of cases) {
      assert.ok(ev && at, 'evento ocorreu');
      assert.deepEqual({x: ev.x, y: ev.y, z: ev.z}, at, `${ev.result}: x/y/z = ponto do projétil no contato`);
      assert.deepEqual(ev.position, at, `${ev.result}: position canônica = ponto do contato`);
      const adapted = adaptSimEvent(ev, {fighters: g.fighters});
      assert.ok(adapted, `${ev.result} tem visual no runtime`);
      assert.deepEqual({...adapted.position}, at, `${ev.result}: runtime (partículas/câmera) no contato, não em fighters[0] (${JSON.stringify(g.fighters[0].position)})`);
      // Antes da correção (sem x/y/z): o runtime caía no lutador `target ?? 0` ou na origem — registrado como diferença medida
      const {x, y, z, position, ...old} = ev;void x;void y;void z;void position;
      const before = adaptSimEvent({...old, position: null}, {fighters: g.fighters});
      assert.ok(before && Math.hypot(before.position.x - at.x, before.position.z - at.z) > .5, `${ev.result}: antes ia para ${JSON.stringify(before?.position)} (longe do contato)`);
    }
  } finally {resetConfig(factoryDefaults());}
});

test('anel do WorldView no `neutralized` vai para o ponto do contato; VFX legado (padrão, useNewVfx = false) não muda com os campos novos', () => {
  try {
    const {g, ev, at} = projectileUntil('neutralized', g => {spawn(g.world, {kind: 'barrier', owner: 1, shape: 'box', pos: {x: 0, z: -2}, angle: Math.PI, hx: 3, hz: .05, y: 0, height: 3, life: 30, hp: Infinity, blocksProjectiles: true, reflect: true, shields: true, pl: 1, captured: {maxReflections: 16}}, []);return shot({pl: 3})(g);});
    assert.ok(ev);
    const wv = /** @type {any} */ (new WorldView(new T.Scene()));
    wv.update(g.world, {fighters: g.fighters, events: [ev], dt: 1 / 60});
    const ring = wv.rings.at(-1);
    assert.ok(ring, 'anel criado');
    assert.ok(Math.abs(ring.mesh.position.x - at.x) < 1e-9 && Math.abs(ring.mesh.position.z - at.z) < 1e-9, `anel no contato (${ring.mesh.position.x}, ${ring.mesh.position.z}) = (${at.x}, ${at.z})`);
    // VFX legado: mesmas chamadas com e sem os campos novos (ele não lê o ponto desses eventos)
    const legacy = (/** @type {any} */ e) => {const v = /** @type {any} */ (new VfxSystem(new T.Scene()));const calls = /** @type {any[]} */ ([]);v.fire = (/** @type {any} */ t, /** @type {any} */ d) => calls.push([t, JSON.stringify(d)]);v.shake = (/** @type {any[]} */ ...a) => calls.push(['shake', ...a]);v.update(g.fighters, [e], 1 / 60, {world: g.world});return calls;};
    const {x, y, z, position, ...old} = ev;void x;void y;void z;void position;
    for (const e of [ev, {...ev, result: 'groundHit'}, {...ev, result: 'destructibleHit'}]) assert.deepEqual(legacy(e), legacy({...old, result: e.result}), `${e.result}: legado idêntico`);
  } finally {resetConfig(factoryDefaults());}
});
