// @ts-check
// F5 — ciclo de vida e reset do View: 100 ciclos criar → eventos → reset() na cena three real (View inteiro, headless, com
// renderer injetado e DOM mínimo). O reset precisa liberar malhas, materiais, pools de emissores, sobreposições, timers e névoa:
// contagem de objetos da cena, geometrias/materiais/texturas vivos (criadas − descartadas) e tamanhos dos Map/Set/arrays internos
// estáveis depois do aquecimento; statusAura, aimMarkers, navDebug, waterChargePreview e névoa da cegueira zerados após o reset.
// Também: com o pós-processamento desligado (padrão) o despachante não acumula eventos para o 'post' (descarta em vez de adiar).
import assert from 'node:assert/strict';
import {test} from 'node:test';

// DOM mínimo: o View cria atlas em canvas 2D, faixas de passiva, sobreposições da cinemática e ouve eventos do canvas/janela.
const ctx2d = /** @type {any} */ (new Proxy(function () {}, {get: (t, k) => k === 'canvas' ? null : (k in t ? /** @type {any} */ (t)[k] : ctx2d), set: () => true, apply: () => ctx2d}));
const el = () => ({style: {}, classList: {add() {}, remove() {}, toggle() {}, contains: () => false}, children: /** @type {any[]} */ ([]), appendChild(/** @type {any} */ c) {this.children.push(c);return c;}, removeChild() {}, remove() {}, setAttribute() {}, addEventListener() {}, removeEventListener() {}, querySelector: () => null, querySelectorAll: () => [], getContext: () => ctx2d, getBoundingClientRect: () => ({width: 0, height: 0, left: 0, top: 0}), clientWidth: 0, clientHeight: 0, width: 0, height: 0, dataset: {}});
const G = /** @type {any} */ (globalThis);
G.document ??= {getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: el, body: el(), documentElement: el()};
G.Path2D ??= class {};G.window ??= globalThis;G.devicePixelRatio ??= 1;G.addEventListener ??= () => {};

const T = await import('three');
const {View} = await import('../src/view/view.js');
const {Game} = await import('../src/sim/game.js');
const {C, defaults, resetConfig} = await import('../src/sim/config.js');
const {registerStandardMoves} = await import('../src/sim/moves/standard.js');
const {VfxDispatch} = await import('../src/view/vfx/dispatch.js');
const {postBacklogMode, takePostEvents} = await import('../src/view/post/post-params.js');
registerStandardMoves();

// Contador de recursos vivos: criados = salto do id global (three numera geometria/material/textura em sequência); descartados = dispose() únicos.
const disposed = {g: 0, m: 0, t: 0}, once = new WeakSet();
for (const [K, k] of /** @type {const} */ ([[T.BufferGeometry, 'g'], [T.Material, 'm'], [T.Texture, 't']])) {
  const orig = K.prototype.dispose;
  K.prototype.dispose = function (/** @type {any[]} */ ...a) {if (!once.has(this)) {once.add(this);disposed[k]++;}return orig.apply(this, a);};
}
let probes = 0;
const nextIds = () => {probes++;return {g: new T.BufferGeometry().id, m: new T.Material().id, t: new T.Texture().id};};
const base = nextIds();
const alive = () => {const n = nextIds(), p = probes - 1;return {g: n.g - base.g - p - disposed.g, t: n.t - base.t - p - disposed.t};};
// Materiais: o VFXBatch do three.quarks chama super() de Mesh, que cria um MeshBasicMaterial padrão logo trocado (nunca desenhado, vai
// para o GC). Por isso o critério de material é o da GPU: todo material que já esteve na cena (amostrado durante a luta) precisa estar
// na cena agora ou ter sido descartado — sair da cena sem dispose() é vazamento de programa/uniforms.
const everMats = new Set();
const sampleMats = (/** @type {any} */ v) => v.scene.traverse((/** @type {any} */ o) => {for (const m of [o.material].flat()) if (m?.isMaterial) everMats.add(m);});
const leakedMats = (/** @type {any} */ v) => {const now = new Set();v.scene.traverse((/** @type {any} */ o) => {for (const m of [o.material].flat()) if (m) now.add(m);});return [...everMats].filter(m => !now.has(m) && !once.has(m)).length;};

function makeView() {
  const canvas = {...el(), setPointerCapture() {}, parentElement: null};
  return new View(canvas, {renderer: {setPixelRatio() {}, setSize() {}, render() {}, compile() {}, dispose() {}, info: {}}});
}
const countScene = (/** @type {any} */ v) => {let n = 0;v.scene.traverse(() => n++);return n;};
/** Tamanhos de Map/Set/arrays no View e nos subsistemas (2 níveis): quem cresce a cada reset é vazamento. */
function sizes(/** @type {any} */ v) {
  const out = /** @type {Record<string, number>} */ ({}), seen = new Set();
  const walk = (/** @type {any} */ o, /** @type {string} */ path, /** @type {number} */ depth) => {
    if (!o || typeof o !== 'object' || seen.has(o) || o.isObject3D || o.isMaterial || o.isBufferGeometry || o.isTexture || ArrayBuffer.isView(o)) return;
    seen.add(o);
    for (const [k, val] of Object.entries(o)) {
      if (k === 'stats' || k === 'unknownByResult' || k === 'scene' || k === 'view' || k === 'renderer' || k === 'camera' || k === 'canvas') continue;
      if (Array.isArray(val)) out[`${path}.${k}`] = val.length;
      else if (val instanceof Map || val instanceof Set) out[`${path}.${k}`] = val.size;
      else if (depth > 0 && val && typeof val === 'object') walk(val, `${path}.${k}`, depth - 1);
    }
  };
  walk(v, 'view', 2);
  return out;
}

/** Uma partida curta (IA × IA) com cegueira, Harden, mira, carga do Water Pulse e navegação visíveis no fim; depois reset(). */
function cycle(/** @type {any} */ view, /** @type {number} */ seed) {
  const g = new Game({seed});g.start();g.mode = 'tactical';
  for (let t = 0; t < 240; t++) {
    g.step(g.playerBrain.command(g.fighters[0], g.fighters[1], 'tactical', C.test.step));
    if (t % 2) continue;
    let fs = g.fighters;
    if (t > 120) {   // só a aparência: cópias rasas por protótipo, a simulação não vê nada disso
      const [a, b] = fs;
      fs = [Object.assign(Object.create(a), {statuses: [...(a.statuses ?? []), {id: 'blind', mul: {}, add: {}, stacks: 1}, {id: 'harden', mul: {}, add: {}, stacks: 1}], aim: {pos: {x: 1, z: 1}, y: 0, valid: true, params: {radius: 1}}}),
        Object.assign(Object.create(b), {charge: {move: 'water-pulse', ticks: t - 120, params: {maxTicks: 180}}})];
    }
    view.draw(fs, g.events, 1 / 60, {tick: g.tick, world: g.world, navGame: g});
    if (t % 20 === 0 || t === 238) sampleMats(view);
  }
  const before = {aura: !!view.statusAura, aim: !!view.aimMarkers, nav: !!view.navDebug, water: !!view.worldView.waterChargePreview, fog: !!view.scene.fog, blind: view.blindK > .5};
  view.reset(g.fighters[0]);
  return before;
}

test('100 resets: cena, geometrias/materiais/texturas vivos e coleções internas não crescem; sobreposições e névoa zeradas', () => {
  resetConfig(defaults());
  C.extras.toggles.enablePlayerAI = 1;C.extras.nav.enableNav = 1;C.extras.nav.showDebug = 1;
  try {
    const view = /** @type {any} */ (makeView());
    let warm = null, warmSizes = null;
    for (let i = 0; i < 100; i++) {
      const before = cycle(view, 1);
      if (i === 0) assert.deepEqual(before, {aura: true, aim: true, nav: true, water: true, fog: true, blind: true}, 'o cenário de fato liga tudo antes do reset');
      // Depois do reset nada sob demanda sobra vivo nem visível.
      assert.ok(view.statusAura == null, 'statusAura descartada no reset');
      assert.ok(view.aimMarkers == null, 'aimMarkers descartado no reset');
      assert.ok(view.navDebug == null, 'navDebug descartado no reset');
      assert.ok(view.worldView.waterChargePreview == null, 'waterChargePreview descartada no reset');
      assert.equal(view.worldView.waterChargeLevel, 0);
      assert.ok(view.scene.fog == null, 'névoa da cegueira removida');
      assert.equal(view.blindK, 0, 'blindK volta a 0');
      assert.equal(view.ambientLight.intensity, C.extras.visual.ambientLightIntensity);
      assert.equal(view.directionalLight.intensity, C.extras.visual.directionalIntensity);
      assert.ok(view.worldView.chargeRings.every((/** @type {any} */ r) => !r.visible), 'anéis de carga ocultos');
      assert.equal(view.worldView.preview.visible, false, 'prévia da barreira oculta');
      assert.equal(view.dispatch.backlog.size, 0, 'despachante sem atraso guardado');
      if (i === 4) warm = {scene: countScene(view), ...alive(), leakedMats: leakedMats(view)};
      if (i === 49) warmSizes = sizes(view);   // registros de diagnóstico com teto (ex.: vfx.log, 120) enchem nos primeiros ciclos
    }
    const end = {scene: countScene(view), ...alive(), leakedMats: leakedMats(view)};
    assert.equal(end.leakedMats, 0, 'nenhum material saiu da cena sem dispose()');
    assert.deepEqual(end, warm, `recursos vivos estáveis entre o 5º e o 100º reset (antes ${JSON.stringify(warm)}, depois ${JSON.stringify(end)})`);
    const endSizes = sizes(view), grew = Object.keys(endSizes).filter(k => endSizes[k] > (warmSizes?.[k] ?? 0)).map(k => `${k}: ${warmSizes?.[k] ?? 0} → ${endSizes[k]}`);
    assert.deepEqual(grew, [], 'coleções internas não crescem entre o 50º e o 100º reset');
    assert.equal(view.dispatch.stats.truncated, 0, 'pós desligado: nada adiado nem descartado por estouro');
  } finally {resetConfig(defaults());}
});

test('pós-processamento desligado descarta em vez de adiar; silhueta e canvas 0×0 adiam; ligado alimenta', () => {
  assert.equal(postBacklogMode({enabled: 0}, null, 800, 600), 'drop');
  assert.equal(postBacklogMode(null, null, 800, 600), 'drop');
  assert.equal(postBacklogMode({enabled: 1}, null, 800, 600), 'feed');
  assert.equal(postBacklogMode({enabled: 1}, 'white', 800, 600), 'defer');
  assert.equal(postBacklogMode({enabled: 1}, 'invert', 800, 600), 'defer');
  assert.equal(postBacklogMode({enabled: 1}, null, 0, 0), 'defer');
  const d = new VfxDispatch(), ev = (/** @type {number} */ id) => ({eventId: id, result: 'impact', attacker: 0, target: 1});
  for (let i = 1; i <= 200; i++) {d.dispatch([ev(i)]);assert.equal(takePostEvents(d, {enabled: 0}, null, 800, 600).length, 0);}
  assert.equal(d.backlog.size, 0, 'nada acumulado com o pós desligado');
  assert.equal(d.stats.truncated, 0, 'sem «adiados descartados» com o pós desligado');
  d.dispatch([ev(201)]);
  assert.deepEqual(takePostEvents(d, {enabled: 1}, null, 800, 600).map(e => e.eventId), [201], 'ao ligar, só o evento do quadro — nenhum pulso velho');
  d.dispatch([ev(202)]);assert.equal(takePostEvents(d, {enabled: 1}, 'white', 800, 600).length, 0, 'silhueta adia');
  d.dispatch([ev(203)]);assert.deepEqual(takePostEvents(d, {enabled: 1}, null, 800, 600).map(e => e.eventId), [202, 203], 'adiado entregue uma vez');
});

// F5 (revisão da Task 11): three.quarks 0.17 deixa o lote (VFXBatch) vazio no BatchedRenderer depois de deleteSystem(); todo dono de BatchedRenderer
// precisa podar (batch-prune.js) onde apaga sistemas — inclusive no reset, na ordem certa (Moves migrados dividem o lote do elementalFx).
const Q = await import('three.quarks');
const {GemSparkles} = await import('../src/view/consumables-gems.js');
const {QuarksBridge} = await import('../src/view/quarks/bridge.js');
const emptyIn = (/** @type {any} */ root) => {let n = 0;root.traverse((/** @type {any} */ o) => {if (o instanceof Q.BatchedRenderer) n += o.batches.filter((/** @type {any} */ b) => !b.systems.size).length;});return n;};

test('reset com Water Pulse em voo e camada QuarksBridge ligada: nenhum lote vazio sobra em nenhum BatchedRenderer', () => {
  resetConfig(defaults());C.vfx.quarks.enabled = 1;
  try {
    const view = /** @type {any} */ (makeView());
    const g = new Game({seed: 2});g.start();
    g.world.entities.push({id: 999, kind: 'projectile', visual: 'waterorb', pos: {x: 0, z: 2}, y: .9, dir: {x: 0, z: 1}, pl: 2, radius: .38, dead: false, owner: 0});
    view.draw(g.fighters, [{result: 'impact', attacker: 0, target: 1, damage: 10, eventId: 1}], 1 / 60, {tick: 1, world: g.world});
    assert.ok(view.worldView.movesVfx.activeInstances.size > 0, 'o Water Pulse está sendo desenhado');
    assert.ok(view.quarks, 'camada QuarksBridge ligada');
    view.reset(g.fighters[0]);
    assert.equal(emptyIn(view.scene), 0, 'nenhum lote vazio depois do reset');
  } finally {resetConfig(defaults());}
});

test('QuarksBridge: rajadas que expiram não deixam lote vazio', () => {
  resetConfig(defaults());
  try {
    const scene = new T.Scene();
    const br = new QuarksBridge({THREE: T, Quarks: Q, scene});
    br.fx.emitBurst('impact', {x: 0, y: 0, z: 0});
    br.fx.update(1 / 60);
    assert.ok(br.fx.renderer.batches.length > 0, 'lote criado');
    br.fx.update(10);   // passa do ttl: o sistema sai
    assert.equal(br.fx.bursts.length, 0);
    assert.equal(emptyIn(scene), 0, 'lote vazio podado');
    br.dispose();
  } finally {resetConfig(defaults());}
});

test('GemSparkles: tirar a centelha de uma gema não deixa lote vazio', () => {
  const parent = new T.Group(), sp = new GemSparkles(parent), gem = {type: {color: '#27d3ff'}, root: new T.Group()};
  sp.attach(gem);sp.renderer.update(1 / 60);
  assert.ok(sp.renderer.batches.length > 0);
  sp.detach(gem);
  assert.equal(emptyIn(parent), 0, 'lote vazio podado');
  sp.dispose();
});

test('three.quarks travado em 0.17.x: batch-prune.js mexe em internos (batches, systemToBatchIndex) — atualizar a lib exige revisar a poda (F9)', async () => {
  const {readFileSync} = await import('node:fs');
  const pkg = JSON.parse(readFileSync(new URL('../../../node_modules/three.quarks/package.json', import.meta.url), 'utf8'));
  assert.match(pkg.version, /^0\.17\./, `three.quarks ${pkg.version}: revise src/view/quarks/batch-prune.js (internos da 0.17) antes de atualizar`);
  const Q = await import('three.quarks');
  const br = new Q.BatchedRenderer();
  assert.ok(Array.isArray(/** @type {any} */ (br).batches), 'BatchedRenderer.batches (array) existe');
  assert.ok(/** @type {any} */ (br).systemToBatchIndex instanceof Map, 'BatchedRenderer.systemToBatchIndex (Map) existe');
});
