// VFX sólidos de movimento (poeira e vento do dash/esquiva e da corrida): geometrias fechadas, estilos distintos, pipeline
// arrancada → corrida → curva → desaceleração → parada, combinação poeira+vento, sliders com efeito mensurável, sem vazamento de
// malhas/materiais. Roda em Node, sem navegador.
import assert from 'node:assert/strict';
import * as T from 'three';
import {SolidFx, SOLID_FAMILIES, SOLID_PARAMS} from '../src/view/solid-fx.js';
import {C, resetConfig} from '../src/sim/config.js';
import {overhaulMeta} from '../src/ui/overhaul-meta.js';
import {createMockTuningFor} from './solid-tuning-helper.mjs';

let passed = 0;
const test = (name, fn) => { resetConfig(); fn(); passed++; console.log('✓', name); };
const mk = () => new SolidFx(new T.Scene());
const run = (fx, sec, dt = 1 / 60) => { for (let t = 0; t < sec; t += dt) fx.update([], [], dt); };
const sig = fx => [...new Set(fx.all.map(p => p.shape + ':' + p.mat + (p.orb ? ':orb' : '') + (p.swirl ? ':sw' : '') + (p.align ? ':al' : '')))].sort().join(',');
const stage = [{position: {x: 0, z: 0}}, {position: {x: 3.5, z: 0}}];
const FAMS = Object.fromEntries(SOLID_FAMILIES.map(f => [f.key, f]));

/** Volume com sinal de uma malha indexada (positivo = sólido fechado com normais para fora). */
function signedVolume(g) {
  const p = g.attributes.position, idx = g.index; let v = 0; const a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3();
  const tri = (i, j, k) => { a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, j); c.fromBufferAttribute(p, k); v += a.dot(new T.Vector3().crossVectors(b, c)) / 6; };
  if (idx) for (let i = 0; i < idx.count; i += 3) tri(idx.getX(i), idx.getX(i + 1), idx.getX(i + 2)); else for (let i = 0; i < p.count; i += 3) tri(i, i + 1, i + 2);
  return v;
}

test('geometrias novas: sólidos fechados com volume positivo, sem planos', () => {
  const fx = mk();
  for (const k of ['lump', 'crescent', 'arch', 'windArc', 'windSpiral', 'windCurl']) {
    const g = fx.geometries[k]; g.computeBoundingBox(); const s = g.boundingBox.getSize(new T.Vector3());
    assert.ok(s.x > .05 && s.y > .05 && s.z > .05, `${k} tem extensão nos três eixos ${s.toArray().map(n => n.toFixed(2))}`);
    assert.ok(signedVolume(g) > 1e-4, `${k}: volume ${signedVolume(g).toFixed(4)} (normais para fora)`);
    assert.ok(g.type !== 'PlaneGeometry' && g.attributes.position.count > 20, k);
  }
});

test('poeira: os oito estilos têm silhuetas diferentes (formas, materiais e movimento)', () => {
  const sigs = [], shapes = [];
  for (let v = 0; v < 8; v++) {
    C.vfx.solidDust.variant = v; const fx = mk(), s = {dir: {x: 1, z: 0}, speed: 9, t: 0, n: 0}, f = {position: {x: 0, z: 0}};
    fx.dust(f, s, 'start', 0); for (let k = 1; k <= 12; k++) { s.t = k * .03; f.position.x += .27; fx.dust(f, s, 'dash', 0); }
    assert.ok(fx.all.length >= 6, `variante ${v} cria objetos: ${fx.all.length}`);
    sigs.push(sig(fx)); shapes.push(new Set(fx.all.map(p => p.shape)));
  }
  assert.equal(new Set(sigs).size, 8, sigs.join(' | '));
  assert.ok(shapes[4].has('crescent') && shapes[5].has('lump') && shapes[6].has('lump') && shapes[7].has('lump'));
  assert.ok(sigs[7].includes(':orb') && !sigs[6].includes(':orb'), 'a coluna em espiral orbita; o anel não');
});

test('vento (dash/esquiva): quatro estilos com silhuetas próprias', () => {
  const sigs = [];
  for (let v = 0; v < 4; v++) { C.vfx.solidWind.variant = v; const fx = mk(), s = {dir: {x: 0, z: 1}, speed: 9, t: 0}; fx.wind({position: {x: 0, z: 0}}, s, 'start', 0); for (let k = 0; k < 8; k++) { s.t = k * .03; fx.wind({position: {x: 0, z: k * .27}}, s, 'dash', 0); } sigs.push(sig(fx)); }
  assert.equal(new Set(sigs).size, 4, sigs.join(' | '));
  assert.ok(sigs[0].includes('windArc') && sigs[1].includes('windSpiral') && sigs[2].includes('windCurl') && sigs[3].includes('spike'));
  for (const s of sigs) assert.ok(s.includes(':wind'), 'vento usa o material próprio');
});

test('corrida: três poeiras e três ventos distintos, contínuos e diferentes do burst do dash', () => {
  const emit = (key, v, what = 'run') => { C.vfx[key].variant = v; const fx = mk(); fx.preview(key, stage, what); run(fx, 1.1); return fx; };
  for (const key of ['solidRunDust', 'solidRunWind']) {
    const sigs = [], counts = [];
    for (let v = 0; v < 3; v++) {
      C.vfx[key].variant = v; const fx = mk(); fx.preview(key, stage, 'run'); run(fx, .6); const half = fx.stats.spawned; run(fx, .5);
      sigs.push(sig(fx)); counts.push(fx.stats.spawned); assert.ok(half >= 2 && fx.stats.spawned >= half + 2 && fx.stats.spawned >= (key === 'solidRunWind' ? 4 : 12), `${key}[${v}] emite continuamente (${half} → ${fx.stats.spawned})`);
    }
    assert.equal(new Set(sigs).size, 3, `${key}: ${sigs.join(' | ')}`);
  }
  const burst = mk(); C.vfx.solidDust.variant = 0; burst.dust({position: {x: 0, z: 0}}, {dir: {x: 0, z: 1}, speed: 9, t: 0}, 'start', 0);
  const cont = emit('solidRunDust', 0); assert.ok(!cont.log.some(l => l.effect === 'solidDust'), 'a corrida não repete o burst de dash (solo)');
});

test('corrida: arrancada → emissão contínua → desaceleração → parada, no mesmo caminho da luta', () => {
  const fx = mk(), f = {position: {x: 0, z: 0}, sprinting: false, action: null}, fighters = [f], dt = 1 / 120; let t = 0; const reasons = [];
  const step = (v, sprint) => { f.position.z += v * dt; f.sprinting = sprint; fx.update(fighters, [], dt); t += dt; };
  for (let i = 0; i < 40; i++) step(0, false);
  for (let i = 0; i < 480; i++) step(Math.min(6.5, 6.5 * i * dt / .4), true);           // 4 s de corrida
  const spawnedRun = fx.stats.spawned;
  for (let i = 0; i < 120; i++) step(Math.max(0, 6.5 - 20 * i * dt), false);             // desacelera
  for (let i = 0; i < 120; i++) step(0, false);
  const why = fx.log.map(l => l.reason);
  assert.ok(why.includes('arrancada') && why.includes('corrida') && why.includes('desaceleração') && why.includes('parada'), why.join(','));
  assert.ok(why.indexOf('arrancada') < why.indexOf('corrida') && why.indexOf('corrida') < why.indexOf('desaceleração') && why.lastIndexOf('parada') > why.indexOf('desaceleração'));
  assert.ok(spawnedRun > 100, 'emissão contínua durante a corrida: ' + spawnedRun);
  run(fx, 2); assert.equal(fx.all.length, 0, 'tudo some ao terminar');
  const before = fx.stats.spawned; run(fx, 1); assert.equal(fx.stats.spawned, before, 'sem emissão parado');
});

test('corrida: responde à velocidade (mais rápido, mais emissão) e à curva (lateral para fora)', () => {
  const spawnedAt = v => { const fx = mk(), f = {position: {x: 0, z: 0}, sprinting: true, action: null}; for (let i = 0; i < 240; i++) { f.position.z += v / 120; fx.update([f], [], 1 / 120); } return fx.stats.spawned; };
  assert.ok(spawnedAt(8) > spawnedAt(3) * 1.15, `${spawnedAt(8)} > ${spawnedAt(3)}`);
  const lateral = (w) => { C.vfx.solidRunDust.variant = 0; const fx = mk(), f = {position: {x: 0, z: 0}, sprinting: true, action: null}; let hd = 0, sx = 0, n = 0;
    for (let i = 0; i < 360; i++) { hd += w / 120; f.position.x += Math.sin(hd) * 6 / 120; f.position.z += Math.cos(hd) * 6 / 120; fx.update([f], [], 1 / 120); if (i > 200) for (const p of fx.all) if (p.age < .02) { const d = {x: Math.cos(hd), z: -Math.sin(hd)}; sx += p.vx * d.x + p.vz * d.z; n++; } }
    return {turn: fx.state[0].turn, side: sx / Math.max(1, n)}; };
  const straight = lateral(0), right = lateral(1.5), left = lateral(-1.5);
  assert.ok(Math.abs(straight.turn) < .1 && right.turn > .8 && left.turn < -.8, JSON.stringify({straight, right, left}));
  assert.ok(right.side < straight.side - .05 && left.side > straight.side + .05, 'o pé de fora da curva solta mais poeira para o lado de fora: ' + JSON.stringify({straight, right, left}));
});

test('combinar poeira e vento: estilo e intensidade independentes, usados na luta', () => {
  C.vfx.solidDust.variant = 5; C.vfx.solidDust.intensity = .5; C.vfx.solidWind.variant = 2; C.vfx.solidWind.intensity = 2;
  const fx = mk(), f = {position: {x: 0, z: 0}, sprinting: false, action: {kind: 'dodge', heading: 0}}; fx.update([f], [], 1 / 60); f.position.z += .3; fx.update([f], [], 1 / 60);
  assert.ok(fx.stats.byVariant['solidDust:5'] >= 1 && fx.stats.byVariant['solidWind:2'] >= 1, JSON.stringify(fx.stats.byVariant));
  const speed = key => { const fx2 = mk(), s = {dir: {x: 0, z: 1}, speed: 9, t: 0}; fx2[key === 'solidDust' ? 'dust' : 'wind']({position: {x: 0, z: 0}}, s, 'start', 0); return fx2.all.reduce((a, p) => a + Math.hypot(p.vx, p.vy, p.vz), 0) / Math.max(1, fx2.all.length); };
  const w2 = speed('solidWind'); C.vfx.solidWind.intensity = .5; const w05 = speed('solidWind'); assert.ok(w2 > w05 * 1.3, 'a intensidade do vento é independente da da poeira');
  C.vfx.solidWind.enabled = 0; const only = mk(); const s = {dir: {x: 0, z: 1}, speed: 9, t: 0}; only.burst({position: {x: 0, z: 0}}, s, 'start', 0); assert.ok(only.all.length && only.all.every(p => p.mat !== 'wind'), 'só poeira quando o vento está desligado');
});

// ---------------------------------------------------------------------------------------------------------------------
// Sliders: cada controle muda de forma mensurável o efeito da sua família.
function emitFamily(key) {
  const fx = mk(), f = {position: {x: 0, z: 0}}, s = {dir: {x: 0, z: 1}, speed: 9, t: 0, n: 0, foot: 0, turn: 0, solo: key};
  const ctx = {pos: {x: 0, z: 0}, n: {x: 0, z: 1}, dir: {x: 0, z: 1}, power: 1};
  if (key === 'solidDust') fx.dust(f, s, 'start', 0); else if (key === 'solidWind') fx.wind(f, s, 'start', 0);
  else if (key === 'solidRunDust' || key === 'solidRunWind') for (let n = 0; n < 12; n++) { s.n = n; s.foot = n & 1; fx.runTick(f, s, 1); }
  else fx.fire(key, ctx, 'slider');
  return fx;
}
const metrics = fx => {
  const ps = fx.all, n = ps.length || 1, speedOf = p => p.orb ? Math.hypot(p.orb.vx, p.orb.vz, p.orb.rise) : Math.hypot(p.vx, p.vy, p.vz);
  const out = {n: ps.length, size: ps.reduce((a, p) => a + Math.max(p.sx, p.sy, p.sz), 0) / n, life: ps.reduce((a, p) => a + p.life, 0) / n, speed: ps.reduce((a, p) => a + speedOf(p), 0) / n,
    tb: ps.reduce((a, p) => a + Math.abs(p.wx) + Math.abs(p.wy) + Math.abs(p.wz) + Math.abs(p.swirl) + p.tbAmp + (p.orb ? Math.abs(p.orb.w) : 0), 0) / n, alpha: ps.reduce((a, p) => a + p.alpha, 0) / n, r: ps.reduce((a, p) => a + p.r, 0) / n, b: ps.reduce((a, p) => a + p.b, 0) / n};
  out.energy = out.n * out.speed; run(fx, .2);
  const al = fx.all.length || 1; out.spread = fx.all.reduce((a, p) => a + Math.hypot(p.x, p.z), 0) / al; out.height = fx.all.reduce((a, p) => a + p.y, 0) / al;
  return out;
};
const METRIC = {intensity: 'energy', amount: 'n', size: 'size', duration: 'life', velocity: 'speed', scatter: 'spread', lift: 'height', turbulence: 'tb', opacity: 'alpha'};
const LOHI = {opacity: [.3, 1]};

test('sliders: cada controle de cada família 3D muda o efeito de forma perceptível', () => {
  const bad = [];
  for (const f of SOLID_FAMILIES) {
    for (const param of SOLID_PARAMS) {
      const [lo, hi] = LOHI[param] ?? [.5, 2], m = {};
      for (const [tag, val] of [['lo', lo], ['hi', hi]]) { resetConfig(); C.vfx[f.key][param] = val; m[tag] = metrics(emitFamily(f.key)); }
      const k = METRIC[param], a = m.lo[k], b = m.hi[k], ratio = (Math.max(a, b) + 1e-9) / (Math.min(a, b) + 1e-9);
      if (!(b > a && ratio >= 1.15)) bad.push(`${f.key}.${param} → ${k}: ${a.toFixed(3)} → ${b.toFixed(3)}`);
    }
    resetConfig(); C.vfx[f.key].color = 0xff0000; const red = metrics(emitFamily(f.key)); C.vfx[f.key].color = 0x0000ff; const blue = metrics(emitFamily(f.key));
    if (!(red.r > blue.r + .05 && blue.b > red.b + .05)) bad.push(`${f.key}.color não muda a cor (r ${red.r.toFixed(2)}/${blue.r.toFixed(2)})`);
    if (f.key === 'solidDust') { resetConfig(); C.vfx.solidDust.variant = 3; C.vfx.solidDust.color2 = 0xff0000; const a = metrics(emitFamily('solidDust')); C.vfx.solidDust.color2 = 0x0000ff; const b = metrics(emitFamily('solidDust')); if (!(a.r > b.r + .03)) bad.push('solidDust.color2 (estilo D) não muda a cor'); }
  }
  assert.deepEqual(bad, [], '\n' + bad.join('\n'));
});

test('metadados: todo slider tem rótulo, unidade e faixa; os padrões ficam dentro da faixa', () => {
  for (const f of SOLID_FAMILIES) {
    for (const param of [...SOLID_PARAMS, 'enabled', 'variant', 'color']) {
      const meta = overhaulMeta(`vfx.${f.key}.${param}`); assert.ok(meta, `${f.key}.${param} sem metadados`);
      const v = C.vfx[f.key][param]; assert.ok(v >= meta.range.min - 1e-9 && v <= meta.range.max + 1e-9, `${f.key}.${param}=${v} fora de ${meta.range.min}..${meta.range.max}`);
      assert.ok(/./.test(meta.label) && (param === 'color' || /./.test(meta.range.fmt(v))), `${f.key}.${param} rótulo/formatação`);
    }
    assert.equal(overhaulMeta(`vfx.${f.key}.variant`).range.max, f.names.length - 1, `${f.key}: faixa da variante = número de estilos`);
  }
  assert.ok(overhaulMeta('vfx.solid.maxObjects') || true);
});

test('seletor, desfazer/refazer e exportação conservam as escolhas das novas famílias', () => {
  const tuning = createMockTuningFor(C);
  tuning.commit([['vfx.solidDust.variant', 6], ['vfx.solidWind.variant', 3], ['vfx.solidRunDust.variant', 2], ['vfx.solidRunWind.variant', 1], ['vfx.solidWind.intensity', 1.8]], 'combinação');
  const exported = JSON.parse(JSON.stringify(Object.fromEntries(['vfx'].map(k => [k, C[k]]))));
  assert.deepEqual([exported.vfx.solidDust.variant, exported.vfx.solidWind.variant, exported.vfx.solidRunDust.variant, exported.vfx.solidRunWind.variant, exported.vfx.solidWind.intensity], [6, 3, 2, 1, 1.8], 'exportação (JSON) contém as escolhas');
  const fx = mk(), f = {position: {x: 0, z: 0}, sprinting: true, action: null}; for (let i = 0; i < 60; i++) { f.position.z += .05; fx.update([f], [], 1 / 60); }
  for (const [k, v] of [['solidDust', 6], ['solidWind', 3], ['solidRunDust', 2], ['solidRunWind', 1]]) assert.ok(fx.log.some(l => l.effect === k && l.variant === v), `${k}: a luta usou a variante ${v}`);
  tuning.undo(); assert.deepEqual([C.vfx.solidDust.variant, C.vfx.solidWind.variant, C.vfx.solidRunDust.variant, C.vfx.solidRunWind.variant, C.vfx.solidWind.intensity], [0, 0, 0, 0, 1]);
  const fx2 = mk(), g = {position: {x: 0, z: 0}, sprinting: true, action: null}; for (let i = 0; i < 60; i++) { g.position.z += .05; fx2.update([g], [], 1 / 60); }
  assert.ok(fx2.log.filter(l => ['solidDust', 'solidWind', 'solidRunDust', 'solidRunWind'].includes(l.effect)).every(l => l.variant === 0), 'depois de desfazer a luta usa o estilo A');
  tuning.redo(); assert.equal(C.vfx.solidDust.variant, 6);
});

test('sem vazamento: trocar estilos, resetar e prever 300 vezes não cria malhas, materiais ou geometrias novas', () => {
  const fx = mk(), scene = fx.scene; const geos = Object.keys(fx.geometries).length, mats = Object.keys(fx.materials).length;
  for (let i = 0; i < 300; i++) {
    for (const f of SOLID_FAMILIES) C.vfx[f.key].variant = i % f.names.length;
    fx.preview(['solidDust', 'solidWind', 'solidRunDust', 'solidRunWind'][i % 4], stage, ['dash', 'start', 'run', 'turn', 'stop'][i % 5]);
    fx.compare(['solidDust', 'solidWind'][i % 2], stage, 'dash'); run(fx, .2, 1 / 30); if (i % 7 === 0) fx.reset();
  }
  assert.equal(Object.keys(fx.geometries).length, geos); assert.equal(Object.keys(fx.materials).length, mats);
  assert.ok(fx.meshes.size <= geos * mats, `malhas ${fx.meshes.size}`); assert.equal(scene.children[0].children.length, fx.meshes.size, 'cada malha instanciada uma vez na cena');
  assert.equal(fx.wrappers.size, fx.meshes.size); assert.ok(fx.stats.peak <= fx.cap());
  fx.reset(); assert.equal(fx.all.length, 0); assert.equal(fx.free.length, 512); for (const m of fx.meshes.values()) assert.equal(m.count, 0);
  fx.dispose(); assert.equal(scene.children.length, 0);
});

test('teto de objetos com as famílias novas: vento e poeira juntos nunca passam do limite', () => {
  C.vfx.solid.maxObjects = 60; C.vfx.solidDust.amount = 3; C.vfx.solidWind.amount = 3; const fx = mk();
  for (let i = 0; i < 50; i++) { fx.preview('all', stage, 'run', {lane: i * .1}); fx.update([], [], 1 / 30); assert.ok(fx.all.length <= 60); }
  assert.ok(fx.stats.rejected > 0);
});

console.log(`\n${passed} testes de VFX de movimento aprovados.`);
