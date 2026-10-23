import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {C, factoryDefaults, resetConfig} from '../src/sim/config.js';   // caracteriza a mecânica nos valores de FÁBRICA; a base de calibração é coberta por calibration-base.test.mjs
import {Character} from '../src/view/characters.js';
import {createSquashState, updateSquash} from '../src/view/squash-stretch.js';
import {overhaulMeta} from '../src/ui/overhaul-meta.js';
import {mechanicsOf, levelOf} from '../src/ui/organize.js';

const near = (a, b, e = 1e-8) => assert.ok(Math.abs(a - b) < e, `${a} != ${b}`);
resetConfig(factoryDefaults());
const o = C.extras.visual.squashStretch, motion = C.actions.tackle;
const f = {hp: 100, state: 'tackle', action: {kind: 'tackle', elapsed: .03, heading: Math.PI / 2, pl: 1, hits: new Set()}, position: {x: 0, z: 0}, visualFacing: 0};
const s = createSquashState();
updateSquash(s, f, .01, o, motion);assert.ok(s.z < 1);near(s.transverse ** 2 * s.z, 1);
f.action.elapsed = motion.duration * .4;
updateSquash(s, f, .01, o, motion);near(s.z, 1.2);near(s.transverse ** 2 * s.z, 1);
f.action.pl = 2;updateSquash(s, f, .01, o, motion);near(s.z, 1.25);
f.action.pl = 3;updateSquash(s, f, .01, o, motion);near(s.z, 1.3);
o.plScaling = 0;updateSquash(s, f, .01, o, motion);near(s.z, 1.2);
o.preserveVolume = 0;updateSquash(s, f, .01, o, motion);near(s.transverse, 1);o.preserveVolume = 1;
f.action.hits.add(1);updateSquash(s, f, .001, o, motion);assert.ok(s.z > 1 && s.z < 1.2);
f.action = null;
const frozen = s.z;updateSquash(s, f, 0, o, motion);near(s.z, frozen);
for (let i = 0; i < 120; i++) updateSquash(s, f, 1 / 120, o, motion);
assert.equal(s.z, 1);assert.equal(s.transverse, 1);
// A solução exata não depende da frequência de quadros no retorno.
const a = createSquashState(), b = createSquashState();a.z = b.z = 1.4;
updateSquash(a, f, .08, o, motion);
for (let i = 0; i < 8; i++) updateSquash(b, f, .01, o, motion);
near(a.z, b.z);
for (const window of [0, 150]) {
  o.squashWindow = window;f.action = {kind: 'tackle', elapsed: .02, heading: 0, pl: 3};
  updateSquash(s, f, .01, o, {...motion, duration: .05});assert.ok(Number.isFinite(s.z) && s.z > 0);
}
o.enableSquashStretch = 0;updateSquash(s, f, 0, o, motion);assert.equal(s.z, 1);
resetConfig(factoryDefaults());

// Modelo com pés abaixo da origem: verifica a matriz mundial e o apoio.
const model = new T.Group();const mesh = new T.Mesh(new T.BoxGeometry(1, 2, 1), new T.MeshBasicMaterial());model.add(mesh);
const ch = new Character({name: 'squash-test', scene: model, animations: [], eventsByClip: []}, {persist: false});
try {
  ch.autoGround = false;
  f.action = {kind: 'tackle', elapsed: motion.duration * .4, heading: Math.PI / 2, pl: 1};
  const before = JSON.stringify(f);
  ch.place(f, 0, .1);ch.root.updateMatrixWorld(true);
  const expectedScale = C.extras.visual.bodyHeight / ch.restHeight;
  near(ch.root.scale.x, expectedScale);
  const e = ch.model.matrixWorld.elements;
  near(Math.hypot(e[0], e[1], e[2]), expectedScale * 1.2);
  near(Math.hypot(e[8], e[9], e[10]), expectedScale / Math.sqrt(1.2));
  // O operador de deformação alonga a direção mundial do golpe nas oito direções,
  // mesmo quando o corpo mantém uma orientação independente.
  for (let i = 0; i < 8; i++) {
    const heading = i * Math.PI / 4;f.action.heading = heading;f.visualFacing = -.37;
    ch.place(f, 0, .01);ch.root.updateMatrixWorld(true);
    const along = new T.Vector3(Math.sin(heading - f.visualFacing), 0, Math.cos(heading - f.visualFacing));
    along.applyMatrix3(new T.Matrix3().setFromMatrix4(ch.model.matrixWorld));
    near(along.length(), expectedScale * 1.2);
    near(along.x / along.length(), Math.sin(heading));near(along.z / along.length(), Math.cos(heading));
  }
  // O pé desloca exatamente pela compensação; o filtro de apoio original permanece separado.
  near(ch.root.position.y, ch.groundOffset - ch.restMinY * expectedScale * (ch.squash.transverse - 1));
  f.action.heading = Math.PI / 2;f.visualFacing = 0;
  assert.equal(JSON.stringify(f), before);
  f.action = {kind: 'recoil'};for (let i = 0; i < 100; i++) ch.place(f, 0, .01);
  assert.equal(ch.deformation.scale.z, 1);near(ch.root.scale.x, expectedScale);
  assert.equal(ch.mixer.getRoot(), ch.model);
} finally {ch.dispose();mesh.geometry.dispose();mesh.material.dispose();}

for (const [key, value] of Object.entries(C.extras.visual.squashStretch)) {
  const path = 'extras.visual.squashStretch.' + key, meta = overhaulMeta(path);
  assert.ok(meta && meta.range.min <= value && value <= meta.range.max);
  assert.ok(mechanicsOf(path).includes('tackle'));assert.equal(levelOf(path), 'basic');
}
// Guarda estrutural complementar: o teste funcional acima usa instâncias reais de Three.js.
const source = readFileSync(new URL('../src/view/squash-stretch.js', import.meta.url), 'utf8');
const hot = source.slice(source.indexOf('export function resetSquash'));
assert.doesNotMatch(hot, /\bnew\s|=>|\.map\(|\.slice\(|\.clone\(|\.join\(|return\s*\{|=\s*\[|=\s*\{/);
console.log('✓ Squash & Stretch: volume, PL1–3, impacto, pausa, retorno, extremos, direção mundial, escala base, apoio, metadados e guarda contra alocações explícitas.');
