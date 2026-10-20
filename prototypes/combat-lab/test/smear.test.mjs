import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {C, resetConfig} from '../src/sim/config.js';
import {LimbSmear, smearAnchors} from '../src/view/smear-mesh.js';
import {View} from '../src/view/view.js';
import {overhaulMeta} from '../src/ui/overhaul-meta.js';
import {mechanicsOf, levelOf} from '../src/ui/organize.js';

resetConfig();
const scene = new T.Scene(), model = new T.Group();scene.add(model);
const mesh = new T.Mesh(new T.BoxGeometry(1, 2, 1), new T.MeshBasicMaterial({color: 0x896236}));model.add(mesh);
for (const [name, x, y] of [['LeftHand', -.5, .5], ['RightHand', .5, .5], ['Head', 0, 1]]) {const b = new T.Bone();b.name = name;b.position.set(x, y, 0);model.add(b);}
const character = {root: model, model, restHeight: 2, source: {name: 'generic.glb'}};
const options = C.extras.visual.smear, f = {hp: 100, action: {kind: 'tackle', pl: 1, hits: new Set()}};
const smear = new LimbSmear(scene, character), dt = 1 / 60;
let tick = 0;
const step = (distance, time = dt) => {model.position.x += distance;smear.update(f, time, options, tick++);};
try {
  assert.equal(smear.anchors.length, 3);
  step(0);step(.19);assert.equal(smear.activeCount, 0, 'abaixo de 12 m/s não dispara');
  step(.21);assert.equal(smear.activeCount, 3);assert.equal(smear.edges.visible, false);
  assert.ok(smear.geometry.index.count === 64 * 36 && smear.positions.length === 64 * 8 * 3);
  const edges = new Map(), indices = smear.geometry.index.array;let volume = 0;
  for (let i = 0; i < 36; i += 3) {
    const ids = [indices[i], indices[i+1], indices[i+2]];
    for (let j = 0; j < 3; j++) {const a = ids[j], b = ids[(j+1)%3], key = Math.min(a,b)+':'+Math.max(a,b);edges.set(key,(edges.get(key)||0)+1);}
    const a = new T.Vector3().fromArray(smear.positions, ids[0]*3), b = new T.Vector3().fromArray(smear.positions, ids[1]*3), c = new T.Vector3().fromArray(smear.positions, ids[2]*3);
    volume += a.dot(b.cross(c))/6;
  }
  assert.ok([...edges.values()].every(n => n === 2), 'Prisma fechado, sem bordas abertas');assert.ok(Math.abs(volume) > 1e-8, 'Lâmina possui volume 3D');
  const frozen = smear.life.slice();step(0, 0);assert.deepEqual(smear.life, frozen);
  f.action = null;step(0);assert.ok(smear.activeCount > 0);step(0);assert.equal(smear.activeCount, 0);
  step(1);assert.equal(smear.activeCount, 0, 'movimento rápido fora do Tackle não dispara');
  f.action = {kind: 'tackle', pl: 2};step(.3);
  const front = smear.positions.slice(4 * 3 + 3 * 8 * 3, 8 * 3 + 3 * 8 * 3);
  assert.ok(Math.abs(Math.max(front[2], front[5], front[8], front[11]) - Math.min(front[2], front[5], front[8], front[11]) - .18 * 1.25) < 1e-6);
  f.action.pl = 3;step(.3);assert.ok(smear.edges.visible);
  options.smearPlBoost = 0;step(.3);assert.equal(smear.edges.visible, false);options.smearPlBoost = 1;
  for (const mode of [0, 1, 2]) {
    options.smearColorMode = mode;step(.3);
    assert.equal(smear.material.uniforms.tint.value.getHex(), mode === 0 ? smear.color.getHex() : mode === 1 ? smear.accent.getHex() : 0xffffff);
  }
  options.enableSmear = 0;step(.3);assert.equal(smear.activeCount, 0);options.enableSmear = 1;
  step(.3);assert.equal(smear.activeCount, 0, 'reativar não liga a posições antigas');step(.3);assert.ok(smear.activeCount > 0);
  smear.reset();assert.equal(smear.activeCount, 0);assert.equal(smear.mesh.visible, false);
  step(0);step(100);assert.equal(smear.activeCount, 0, 'teletransporte não vira uma lâmina enorme');
  const geometry = smear.geometry, positions = smear.positions, life = smear.life, material = smear.material, children = scene.children.length;
  const bonesBefore = model.children.filter(o => o.isBone).map(b => [...b.position.toArray(), ...b.quaternion.toArray(), ...b.scale.toArray()]);
  for (let i = 0; i < 100; i++) {smear.reset();step(0);step(.3);assert.ok(smear.activeCount > 0);f.action = null;step(0);step(0);f.action = {kind: 'tackle', pl: 3};}
  assert.equal(smear.geometry, geometry);assert.equal(smear.positions, positions);assert.equal(smear.life, life);assert.equal(smear.material, material);assert.equal(scene.children.length, children);
  assert.deepEqual(model.children.filter(o => o.isBone).map(b => [...b.position.toArray(), ...b.quaternion.toArray(), ...b.scale.toArray()]), bonesBefore);
  for (const fps of [30, 60, 120, 240]) {
    smear.reset();step(0, 1 / fps);step(18 / fps, 1 / fps);assert.ok(smear.activeCount > 0);
    f.action = null;for (let i = 0; i < Math.ceil(options.smearDurationFrames * fps / 60) + 1; i++) step(0, 1 / fps);
    assert.equal(smear.activeCount, 0);f.action = {kind: 'tackle', pl: 1};
  }
  assert.equal(smearAnchors({...character, source: {name: 'Cogumelo.glb'}}).length, 2);
  assert.equal(smearAnchors({...character, source: {name: 'croagunk.glb'}}).length, 4);
  assert.equal(smearAnchors({...character, source: {name: 'vigoroth.glb'}}).length, 3);
  const plain = new T.Group();plain.add(mesh.clone());assert.equal(smearAnchors({...character, model: plain}).length, 2);
  const fakeView = {scene, characters: [], smears: []};
  let disposed = 0;
  View.prototype.setCharacter.call(fakeView, 0, character);fakeView.smears[0].geometry.addEventListener('dispose', () => disposed++);
  View.prototype.setCharacter.call(fakeView, 0, character);assert.equal(disposed, 1);
  View.prototype.setCharacter.call(fakeView, 0, null);assert.equal(scene.children.length, children);
  for (const [key, value] of Object.entries(options)) {
    const path = 'extras.visual.smear.' + key, meta = overhaulMeta(path);
    assert.ok(meta.range.min <= value && value <= meta.range.max);assert.ok(mechanicsOf(path).includes('tackle'));assert.equal(levelOf(path), 'basic');
  }
  const source = readFileSync(new URL('../src/view/smear-mesh.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source.slice(source.indexOf('  emit('), source.indexOf('  dispose(')), /\bnew\s|=>|\.map\(|\.slice\(|\.clone\(|return\s*\{|=\s*\[|=\s*\{/);
  console.log('✓ Smear: limiar de velocidade, Tackle exclusivo, PL2/PL3, cores, pausa, duração em 30–240 Hz, teletransporte, âncoras anatômicas/fallback, 100 disparos sem crescimento, descarte e controles.');
} finally {smear.dispose();mesh.geometry.dispose();mesh.material.dispose();}
