// CADA slider de disparo precisa mudar o que se vê (pedido do responsável, 24/10): para cada controle e para cada tipo (Argola e Tiro em cone),
// o disparo com o controle no mínimo e no máximo tem que gerar um resultado MEDIDO diferente. Controle morto = teste vermelho.
import assert from 'node:assert/strict';
import * as T from 'three';
import {Particles} from './src/particles.js';
import {defaults, controls, categories} from './src/config.ts';
import {ShotEffect} from './src/shot-effect.ts';
import {shotKeyVisible} from './src/panel-model.ts';

const scene = new T.Scene(), stage = new T.Group();scene.add(stage);
const particles = new Particles(scene, {textures: false});
const shotKeys = controls.sand.map(d => d[0]).filter(k => k.startsWith('shot') && k !== 'shotKind');

/** Roda o disparo e mede o resultado: forma da argola (posição, escala, raio, espessura, opacidade) ou do jato (emissão, direção, velocidade, tamanho, vida). */
function measure(values, kind, followMoves = false) {
  stage.clear();particles.clear();
  let z = -2;
  const fx = new ShotEffect(stage, particles, {...defaults.sand, ...values, shotKind: kind}, {origin: [0, .4, z], direction: [0, 0, 1], follow: () => [0, .4, z]});
  fx.fire();
  const out = [];
  for (let i = 0; i < 6; i++) {
    if (followMoves) z += .5;
    fx.update(.05);particles.update(.05);
    const ring = stage.getObjectByName('shot-ring');
    if (ring) out.push(['ring', ring.position.toArray().map(n => +n.toFixed(4)), ring.scale.toArray().map(n => +n.toFixed(4)), +ring.geometry.parameters.radius.toFixed(4), +ring.geometry.parameters.tube.toFixed(4), +ring.material.opacity.toFixed(4), ring.visible]);
    const blades = stage.getObjectByName('shot-blades');
    if (blades) out.push(['blades', blades.position.toArray().map(n => +n.toFixed(4)), blades.scale.toArray().map(n => +n.toFixed(4)), blades.children.length, +(blades.children[0]?.rotation.z ?? 0).toFixed(4), +(blades.children[0]?.geometry.parameters.width ?? 0).toFixed(4), +(blades.children[0]?.material.color.r ?? 0).toFixed(4), blades.visible]);
    const cross = stage.getObjectByName('shot-cross');
    if (cross) out.push(['cross', cross.position.toArray().map(n => +n.toFixed(4)), cross.scale.toArray().map(n => +n.toFixed(4)), +cross.rotation.z.toFixed(4), +(cross.children[0]?.material.color.r ?? 0).toFixed(4), cross.visible]);
    for (const e of particles.systems) {
      const sys = e.system, dir = new T.Vector3(0, 0, 1).applyQuaternion(e.emitter.quaternion);
      out.push(['cone', e.emitter.position.toArray().map(n => +n.toFixed(4)), dir.toArray().map(n => +n.toFixed(4)), +sys.duration.toFixed(4), sys.emissionOverTime?.value ?? 0, particles.count, +(sys.startSize?.a ?? 0).toFixed(4), +(sys.startSpeed?.b ?? 0).toFixed(4), +(sys.startLife?.b ?? 0).toFixed(4), +(sys.emitterShape?.radius ?? 0).toFixed(4), +(sys.emitterShape?.angle ?? 0).toFixed(4)]);
    }
  }
  const sig = JSON.stringify(out);fx.dispose();stage.clear();particles.clear();
  return sig;
}

const kindNames = ['', 'Argola', 'Cone', 'BurstAnime', 'JatoPerfurante', 'ImpactoEstelar'];
const dead = [];
for (const kind of [1, 2, 3, 4, 5]) for (const key of shotKeys) {
  if (!shotKeyVisible(key, kind)) continue;
  const [, , , min, max, , initial] = controls.sand.find(d => d[0] === key);
  // dois valores DIFERENTES e não simétricos: o padrão e um valor bem afastado dele
  const alt = Math.abs(max - initial) >= Math.abs(initial - min) ? initial + (max - initial) * .65 : initial - (initial - min) * .65;
  const lo = measure({[key]: initial}, kind, key === 'shotFollow'), hi = measure({[key]: alt}, kind, key === 'shotFollow');
  if (lo === hi) dead.push(`${kindNames[kind]}/${key}`);
}
assert.deepEqual(dead, [], 'sliders de disparo que não mudam NADA no resultado: ' + dead.join(', '));
// o interruptor de cada tipo: Nenhum não produz nada; todos os 5 produzem resultados distintos entre si
assert.equal(JSON.parse(measure({}, 0)).length, 0);
const signatures = [1, 2, 3, 4, 5].map(k => measure({}, k));
for (let i = 0; i < signatures.length; i++) {
  for (let j = i + 1; j < signatures.length; j++) {
    assert.notEqual(signatures[i], signatures[j], `${kindNames[i + 1]} e ${kindNames[j + 1]} produzem o mesmo visual`);
  }
}
console.log(`PASS: ${shotKeys.length} sliders de disparo, todos mudam o resultado nas 5 opções de disparo`);
