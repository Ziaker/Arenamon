// VFX sólidos 3D: volume real, formas distintas por opção, nascimento nos pés, direção/intensidade, fade, teto de objetos,
// reutilização de geometrias/materiais e coerência do seletor (C.vfx) com o que é disparado. Roda em Node, sem navegador.
import assert from 'node:assert/strict';
import * as T from 'three';
import {SolidFx, SOLID_FAMILIES, SOLID_KEYS} from '../src/view/solid-fx.js';
import {C, resetConfig, vfxDefaults} from '../src/sim/config.js';
import {createMockTuningFor} from './solid-tuning-helper.mjs';

let passed = 0;
const test = (name, fn) => { resetConfig(); fn(); passed++; console.log('✓', name); };
const mk = () => new SolidFx(new T.Scene());
const fighter = (x = 0, z = 0, extra = {}) => ({id: 0, position: {x, y: 0, z}, state: 'idle', hp: 100, ...extra});
const sig = fx => [...new Set(fx.all.map(p => p.shape + ':' + p.mat))].sort().join(',');
const run = (fx, seconds, dt = 1 / 60) => { for (let t = 0; t < seconds; t += dt) fx.update([], [], dt); };

test('configuração: nove famílias 3D com variante, nomes descritivos e padrões coerentes', () => {
  assert.equal(SOLID_FAMILIES.length, 9);
  assert.equal(SOLID_FAMILIES.find(f => f.key === 'solidDust').names.length, 8, 'poeira tem 4 entregues + 4 novas');
  for (const f of SOLID_FAMILIES) {
    assert.ok(C.vfx[f.key], f.key); assert.equal(C.vfx[f.key].variant, 0);
    for (const n of f.names) assert.ok(n.length > 25 && /:/.test(n), 'o nome explica a aparência: ' + n);
    assert.equal(new Set(f.names).size, f.names.length);
  }
  assert.equal(C.vfx.solid.maxObjects, 220);
});

test('volume real: só malhas instanciadas com sólidos fechados; nenhum sprite, plano ou ponto', () => {
  const fx = mk();
  for (const g of Object.values(fx.geometries)) {
    assert.ok(!(g instanceof T.PlaneGeometry) && g.type !== 'PlaneGeometry', g.type);
    g.computeBoundingBox(); const s = g.boundingBox.getSize(new T.Vector3());
    assert.ok(s.x > 0 && s.y > 0 && s.z > 0, 'extensão nos três eixos ' + g.type);
    assert.ok(g.attributes.position.count >= 4, 'pelo menos um tetraedro');
  }
  for (const m of Object.values(fx.materials)) { assert.ok(!(m instanceof T.SpriteMaterial)); assert.equal(m.map, null); assert.equal(m.side, T.FrontSide); }
  fx.dust(fighter(), {dir: {x: 0, z: 1}, speed: 9, t: 0}, 'start', 0);
  fx.update([], [], 1 / 60);
  assert.ok(fx.meshes.size > 0);
  for (const m of fx.meshes.values()) { assert.ok(m instanceof T.InstancedMesh); assert.ok(!(m instanceof T.Sprite) && !m.isPoints); }
});

test('poeira: as quatro opções são formas e movimentos diferentes entre si', () => {
  const sigs = [], info = [];
  for (let v = 0; v < 4; v++) {
    C.vfx.solidDust.variant = v; const fx = mk(), s = {dir: {x: 1, z: 0}, speed: 9, t: 0};
    fx.dust(fighter(), s, 'start', 0); for (let k = 1; k <= 10; k++) { s.t = k * .03; fx.dust(fighter(k * .3, 0), s, 'dash', 0); }
    sigs.push(sig(fx));
    info.push({v, swirl: fx.all.some(p => p.swirl), maxSize: Math.max(...fx.all.map(p => Math.max(p.sx, p.sy, p.sz))), glow: fx.all.some(p => p.mat === 'glow'), wave: fx.all.some(p => p.shape === 'wave'), n: fx.all.length});
  }
  assert.equal(new Set(sigs).size, 4, 'assinaturas de forma/material distintas: ' + sigs.join(' | '));
  assert.ok(!info[0].swirl && info[1].swirl, 'B gira e se dispersa em espiral; A não');
  assert.ok(info[2].maxSize > info[0].maxSize * 1.5, 'C tem fragmentos bem maiores que A');
  assert.ok(info[3].glow && info[3].wave && !info[0].glow && !info[0].wave, 'D é luminoso e tem onda baixa');
});

test('poeira C: blocos grandes só no início do dash, depois apenas partículas pequenas', () => {
  C.vfx.solidDust.variant = 2; const fx = mk(), s = {dir: {x: 0, z: 1}, speed: 9, t: 0};
  fx.dust(fighter(), s, 'dash', 0); const early = Math.max(...fx.all.map(p => p.sx));
  fx.reset(); s.t = .5; fx.dust(fighter(), s, 'dash', 0); const late = Math.max(...fx.all.map(p => p.sx));
  assert.ok(early > 2.5 * late, `início ${early.toFixed(3)} × depois ${late.toFixed(3)}`);
});

test('nascimento nos pés e direção: partículas saem dos pés e vão para trás; a parada lança para a frente', () => {
  for (let v = 0; v < 4; v++) {
    C.vfx.solidDust.variant = v; const fx = mk(), f = fighter(5, -3), s = {dir: {x: 1, z: 0}, speed: 9, t: 0};
    fx.dust(f, s, 'dash', 0);
    for (const p of fx.all.filter(p => p.shape !== 'wave')) { assert.ok(Math.hypot(p.x - 5, p.z + 3) < .35, 'perto dos pés'); assert.ok(p.y < .12, 'rente ao chão'); }
    const mean = fx.all.filter(p => p.shape !== 'wave').reduce((a, p) => a + p.vx, 0) / Math.max(1, fx.all.filter(p => p.shape !== 'wave').length);
    assert.ok(mean < 0, `variante ${v}: velocidade média para trás (${mean.toFixed(2)})`);
    fx.reset(); fx.dust(f, s, 'stop', 0);
    const fwd = fx.all.filter(p => p.shape !== 'wave').reduce((a, p) => a + p.vx, 0);
    if (v !== 1) assert.ok(fwd > 0, `variante ${v}: a parada lança para a frente`);
  }
});

test('intensidade: dash mais rápido gera mais e mais forte; arrancada, dash e parada são diferentes', () => {
  for (let v = 0; v < 4; v++) {
    C.vfx.solidDust.variant = v; const slow = mk(), fast = mk();
    slow.dust(fighter(), {dir: {x: 0, z: 1}, speed: 3.5, t: 0}, 'start', 0); fast.dust(fighter(), {dir: {x: 0, z: 1}, speed: 16, t: 0}, 'start', 0);
    assert.ok(fast.all.length >= slow.all.length, `v${v}: ${fast.all.length} ≥ ${slow.all.length}`);
    const a = mk(), b = mk(), c = mk(), s = {dir: {x: 0, z: 1}, speed: 9, t: .4};
    a.dust(fighter(), s, 'start', 0); b.dust(fighter(), s, 'dash', 0); c.dust(fighter(), s, 'stop', 0);
    assert.ok(a.all.length > b.all.length, `v${v}: arrancada tem mais que o dash`);
    assert.notEqual(a.all.map(p => p.vz.toFixed(2)).join(), c.all.map(p => p.vz.toFixed(2)).join());
  }
});

test('desaparecem suavemente: escala e opacidade caem a zero antes do fim e tudo volta ao pool', () => {
  const fx = mk(); fx.spawn({shape: 'chunk', mat: 'lit', x: 0, y: 1, z: 0, s: .3, life: 1, hold: .4});
  let prevS = Infinity, prevA = Infinity, last = null;
  for (let t = 0; t < .98; t += 1 / 60) {
    fx.update([], [], 1 / 60);
    const m = [...fx.meshes.values()][0], e = new T.Matrix4(), pos = new T.Vector3(), q = new T.Quaternion(), sc = new T.Vector3();
    m.getMatrixAt(0, e); e.decompose(pos, q, sc); const al = m.geometry.attributes.instanceAlpha.array[0];
    if (t > .45) { assert.ok(sc.x <= prevS + 1e-9, 'escala só diminui'); assert.ok(al <= prevA + 1e-9, 'opacidade só diminui'); }
    prevS = sc.x; prevA = al; last = {s: sc.x, a: al};
  }
  assert.ok(last.s < .06 && last.a < .15, JSON.stringify(last));
  run(fx, .1); assert.equal(fx.all.length, 0); assert.equal(fx.free.length, 512, 'pool devolvido');
});

test('desempenho: teto de objetos ativos, geometrias/materiais reutilizados, sem crescimento', () => {
  C.vfx.solid.maxObjects = 40; const fx = mk(), s = {dir: {x: 0, z: 1}, speed: 9, t: 0};
  const geos = Object.keys(fx.geometries).length, mats = Object.keys(fx.materials).length;
  for (let k = 0; k < 200; k++) { fx.dust(fighter(), s, 'start', 0); fx.update([], [], 1 / 120); }
  assert.ok(fx.stats.peak <= 40, 'pico ' + fx.stats.peak); assert.ok(fx.stats.rejected > 0);
  assert.equal(Object.keys(fx.geometries).length, geos); assert.equal(Object.keys(fx.materials).length, mats);
  assert.ok(fx.meshes.size <= geos * mats, 'no máximo uma malha instanciada por (forma, material)');
  for (const m of fx.meshes.values()) assert.ok(m.count <= 40);
});

test('outras famílias 3D: cada opção dispara, é diferente das irmãs, sem NaN', () => {
  const ctx = {pos: {x: 1, z: 2}, n: {x: 0, z: 1}, dir: {x: 0, z: 1}, power: 1.2};
  for (const f of SOLID_FAMILIES.filter(f => ['solidDodge', 'solidLanding', 'solidImpact', 'solidBlock', 'solidClash'].includes(f.key))) {
    const sigs = [];
    for (let v = 0; v < f.names.length; v++) {
      C.vfx[f.key].variant = v; const fx = mk(); fx.fire(f.key, ctx, 'teste');
      assert.ok(fx.all.length >= 2, `${f.key}[${v}] cria objetos`);
      for (let k = 0; k < 20; k++) fx.update([], [], 1 / 60);
      for (const p of fx.all) assert.ok([p.x, p.y, p.z, p.sx, p.sy, p.sz].every(Number.isFinite), `${f.key}[${v}] finito`);
      const fx2 = mk(); fx2.fire(f.key, ctx, 'teste'); sigs.push(sig(fx2) + '|' + fx2.all.length + '|' + fx2.all.some(p => p.align) + fx2.all.some(p => p.rx));
      assert.equal(fx2.stats.byVariant[`${f.key}:${v}`], 1, 'a variante registrada é a exibida');
    }
    assert.equal(new Set(sigs).size, f.names.length, `${f.key}: opções distintas (${sigs.join(' ; ')})`);
  }
});

test('eventos reais: impacto, defesa, perfeita, clash, queda e esquiva/sprint disparam a família certa', () => {
  const fx = mk(), a = fighter(0, 0), b = fighter(0, 3, {id: 1});
  const ev = r => ({attacker: 0, target: 1, result: r, normal: {x: 0, z: 1}});
  fx.update([a, b], [ev('impact')], 1 / 60); fx.update([a, b], [ev('partial')], 1 / 60); fx.update([a, b], [ev('perfect')], 1 / 60); fx.update([a, b], [ev('clash')], 1 / 60);
  assert.deepEqual(Object.keys(fx.stats.byFamily).sort(), ['solidBlock', 'solidClash', 'solidImpact']);
  b.lastLanding = {n: 0, vertical: 6, x: 0, z: 3}; fx.update([a, b], [], 1 / 60); b.lastLanding = {n: 1, vertical: 6, x: 0, z: 3}; fx.update([a, b], [], 1 / 60);
  assert.equal(fx.stats.byFamily.solidLanding, 1);
  a.action = {kind: 'dodge', heading: 0}; fx.update([a, b], [], 1 / 60); assert.equal(fx.stats.byFamily.solidDodge, 1); assert.ok(fx.stats.byFamily.solidDust >= 1, 'dash comum gera poeira');
  a.action = null; fx.state[0].peak = 9; fx.update([a, b], [], 1 / 60);
  assert.ok(fx.log.some(l => l.reason === 'parada'), 'parada registrada');
  a.sprinting = true; fx.update([a, b], [], 1 / 60); assert.ok(fx.log.some(l => l.reason === 'arrancada'), 'arrancada registrada');
  const same = ev('impact'); const n0 = fx.stats.byFamily.solidImpact; fx.update([a, b], [same, same], 1 / 60); assert.equal(fx.stats.byFamily.solidImpact, n0 + 1, 'o mesmo evento não dispara duas vezes');
});

test('desligado, pausado e acessibilidade: nada é criado desligado; reduceMotion e alto contraste mudam o resultado', () => {
  C.vfx.solid.enabled = 0; let fx = mk(); fx.fire('solidImpact', {pos: {x: 0, z: 0}, n: {x: 0, z: 1}}, 'x'); assert.equal(fx.all.length, 0);
  C.vfx.solid.enabled = 1; C.vfx.solidImpact.enabled = 0; fx = mk(); fx.fire('solidImpact', {pos: {x: 0, z: 0}, n: {x: 0, z: 1}}, 'x'); assert.equal(fx.all.length, 0);
  C.vfx.solidImpact.enabled = 1; const a = mk(), b = mk(); b.setAccessibility({reduceMotion: true, highContrast: true});
  a.fire('solidImpact', {pos: {x: 0, z: 0}, n: {x: 0, z: 1}}, 'x'); b.fire('solidImpact', {pos: {x: 0, z: 0}, n: {x: 0, z: 1}}, 'x');
  assert.ok(Math.hypot(...b.all.map(p => p.vx)) < Math.hypot(...a.all.map(p => p.vx))); assert.ok(b.all[0].r >= a.all[0].r);
  const p = mk(); p.fire('solidImpact', {pos: {x: 0, z: 0}, n: {x: 0, z: 1}}, 'x'); const x0 = p.all[0].x; p.update([], [], 0); assert.equal(p.all[0].x, x0, 'dt = 0 congela');
});

test('seletor: escolher, desfazer e refazer mantém C.vfx igual ao que dispara', () => {
  const tuning = createMockTuningFor(C);
  for (const f of SOLID_FAMILIES) {
    const last = f.names.length - 1; tuning.commit([[`vfx.${f.key}.variant`, last]], f.label);
    const fx = mk(); fx.preview(f.key, [fighter(0, 0), fighter(2, 2, {id: 1})], f.previews ? 'run' : 'dash'); run(fx, .5);
    assert.ok(fx.log.some(l => l.effect === f.key && l.variant === last), `${f.key}: disparou a opção exibida (${last})`);
    tuning.undo(); assert.equal(C.vfx[f.key].variant, 0);
    const fx2 = mk(); fx2.preview(f.key, [fighter(0, 0), fighter(2, 2, {id: 1})], f.previews ? 'run' : 'dash'); run(fx2, .5); assert.ok(fx2.log.every(l => l.variant === 0), `${f.key}: após desfazer dispara a opção 0`);
    tuning.redo(); assert.equal(C.vfx[f.key].variant, last);
    const fx3 = mk(); fx3.preview(f.key, [fighter(0, 0), fighter(2, 2, {id: 1})], f.previews ? 'run' : 'dash'); run(fx3, .5); assert.ok(fx3.log.some(l => l.variant === last), `${f.key}: após refazer dispara a opção ${last}`);
  }
});

test('comparação: compareDust cria as oito faixas, uma por opção, lado a lado', () => {
  const fx = mk(); fx.compareDust([fighter(0, 0), fighter(4, 0, {id: 1})]);
  for (let k = 1; k <= 25; k++) fx.update([], [], 1 / 30);
  const ids = Object.keys(fx.stats.byVariant).filter(k => k.startsWith('solidDust:')).sort();
  assert.deepEqual(ids, Array.from({length: 8}, (_, v) => 'solidDust:' + v));
});

test('defaults: vfxDefaults() inclui as famílias 3D e é independente da cópia viva', () => {
  const d = vfxDefaults(); for (const k of [...SOLID_KEYS, 'solid']) assert.ok(d[k], k); d.solidDust.variant = 3; assert.equal(vfxDefaults().solidDust.variant, 0);
});

console.log(`\n${passed} testes de VFX sólidos aprovados.`);
