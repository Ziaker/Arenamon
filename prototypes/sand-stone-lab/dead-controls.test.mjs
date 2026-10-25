// Nenhum slider pode ser «morto»: todo controle exibido para uma proposta precisa mudar o desenho dela (docs/PADRAO_ATELIES_VFX.md §5: efeito real
// no desenho). A assinatura inclui posições, escalas, rotações, cores, uniformes, geometria, o tremor a cada passo e as partículas criadas.
// Controles que NÃO se aplicam a uma categoria ou proposta ficam em `notUsed` (config.ts) e não aparecem no painel.
import assert from 'node:assert/strict';
import * as T from 'three';
import {Particles} from './src/particles.js';
import {SandEffect, StoneEffect, RockEffect} from './src/effects.js';
import {RiposteEffect} from './src/riposte-effect.ts';
import {RushEffect} from './src/rush-effects.ts';
import {SwiftEffect, PsyshockEffect} from './src/new-effects.ts';
import {defaults, controls, categories, isToggle, usedControls} from './src/config.ts';
import {disposeGroup} from './src/art.js';
import {PhaseClock} from './src/phases.ts';

const scene = new T.Scene(), stage = new T.Group();scene.add(stage);
const build = (c, v, p, particles) => c === 'sand' ? new SandEffect(stage, particles, v, p) : c === 'stone' ? new StoneEffect(stage, particles, v, p, null, v) : c === 'rock' ? new RockEffect(stage, v, p, null)
  : c === 'swift' ? new SwiftEffect(stage, particles, v, p) : c === 'psyshock' ? new PsyshockEffect(stage, particles, v, p, 5) : c === 'riposte' ? new RiposteEffect(stage, particles, v, p) : new RushEffect(stage, particles, c, v, p);
const f = n => +(+n).toFixed(3);
function objSig(o) {
  const a = [o.position.x, o.position.y, o.position.z, o.scale.x, o.scale.y, o.scale.z, o.rotation.x, o.rotation.y, o.rotation.z];
  for (const m of [].concat(o.material ?? [])) {
    a.push(m.opacity ?? 1);if (m.color) a.push(m.color.r, m.color.g, m.color.b);if (m.emissiveIntensity !== undefined) a.push(m.emissiveIntensity);
    if (m.uniforms) for (const u of Object.values(m.uniforms)) {const x = u.value;if (typeof x === 'number') a.push(x);else if (x?.isColor) a.push(x.r, x.g, x.b);else if (x?.isVector3) a.push(x.x, x.y, x.z);}
  }
  const g = o.geometry;
  if (g) {if (!g.boundingBox) g.computeBoundingBox();const bb = g.boundingBox, pos = g.attributes?.position;let sum = 0;if (pos) for (let i = 0; i < pos.array.length; i++) sum += pos.array[i] * ((i % 7) + 1);a.push(bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z, pos?.count ?? 0, sum);}
  return a.map(f).join(',');
}
export function signature(c, v, over) {
  const particles = new Particles(scene, {textures: false}), calls = [], create = particles.create.bind(particles);
  particles.create = o => {calls.push(JSON.stringify([o.kind, o.count, o.rate, o.duration, o.life, o.size, o.speed, o.radius, o.angle, o.opacity, o.color, o.gravity].map(x => typeof x === 'number' ? f(x) : x)));return create(o);};
  const fx = build(c, v, {...defaults[c], ...over}, particles), parts = [], punches = [];
  // como a tela: o relógio de fases costura as janelas (tempo parado da duração, fases desligadas)
  const clock = fx.timeline ? new PhaseClock(fx.timeline(), {...defaults[c], ...over}) : null, total = clock ? clock.duration : fx.duration;
  for (let i = 0; i <= 30; i++) {
    const t = total * i / 30;fx.update(clock ? clock.map(t) : t, total / 30);particles.update(1 / 30);punches.push(f(fx.punch));
    stage.traverse(o => {if (o.visible !== false) parts.push(objSig(o));});
  }
  const s = parts.join('|') + '#' + calls.join(';') + '#' + f(total) + '#' + punches.join(',');
  particles.clear();disposeGroup(stage);return s;
}
if (process.argv[1]?.endsWith('dead-controls.test.mjs')) {
  const dead = [];let checked = 0;
  for (const c of categories) for (const v of c === 'rock' ? [0] : [0, 1, 2]) for (const [key, , , min, max, , init] of usedControls(c, v)) {
    if (isToggle(key) || key.startsWith('shot') || key === 'scenario') continue;
    checked++;
    const probes = new Set([min, max, init, +(min + (max - min) * .37).toFixed(4)]);
    const extra = c === 'riposte' && key === 'finishTime' ? {scenario: 2} : {};   // a finalização do Riposte só existe nos cenários de falha
    if (new Set([...probes].map(x => signature(c, v, {[key]: x, ...extra}))).size === 1) dead.push(`${c}/${'ABC'[v]}/${key}`);
  }
  assert.deepEqual(dead, [], 'sliders sem efeito no desenho (esconda em notUsed ou ligue ao efeito)');
  console.log(`PASS: ${checked} controles verificados, todos mudam o desenho`);
}
