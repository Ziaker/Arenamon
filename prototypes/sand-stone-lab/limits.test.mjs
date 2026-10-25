// Estabilidade nos limites ampliados (auditoria de 24/10: «verificar estabilidade/limpeza nos novos limites»): cada controle no mínimo e no máximo,
// um de cada vez, sem NaN/Infinity em posições, escalas e partículas, e com limpeza ao final. Só estabilidade numérica; desempenho em GPU não é medido aqui.
import assert from 'node:assert/strict';
import * as T from 'three';
import {Particles} from './src/particles.js';
import {SandEffect, StoneEffect, RockEffect} from './src/effects.js';
import {RiposteEffect} from './src/riposte-effect.ts';
import {RushEffect} from './src/rush-effects.ts';
import {SwiftEffect, PsyshockEffect} from './src/new-effects.ts';
import {defaults, controls, categories, isToggle} from './src/config.ts';
import {disposeGroup} from './src/art.js';

const scene = new T.Scene(), stage = new T.Group();scene.add(stage);
const build = (c, v, p, particles) => c === 'sand' ? new SandEffect(stage, particles, v, p) : c === 'stone' ? new StoneEffect(stage, particles, v, p, null, v) : c === 'rock' ? new RockEffect(stage, v, p, null)
  : c === 'swift' ? new SwiftEffect(stage, particles, v, p) : c === 'psyshock' ? new PsyshockEffect(stage, particles, v, p, 5) : c === 'riposte' ? new RiposteEffect(stage, particles, v, p) : new RushEffect(stage, particles, c, v, p);
let runs = 0;
for (const c of categories) {
  const v = c === 'riposte' ? 1 : 0;
  for (const [key, , , min, max] of controls[c]) {
    if (isToggle(key)) continue;
    for (const value of new Set([min, max])) {
      const particles = new Particles(scene, {textures: false}), p = {...defaults[c], [key]: value};
      if (key === 'shotKind') continue;
      const fx = build(c, v, p, particles);runs++;
      const steps = 40, dur = fx.duration;
      for (let i = 0; i <= steps; i++) {
        const t = dur * i / steps;fx.update(t, dur / steps);particles.update(1 / 30);
        stage.traverse(o => {for (const n of [o.position.x, o.position.y, o.position.z, o.scale.x, o.scale.y, o.scale.z]) assert.ok(Number.isFinite(n), `${c}/${key}=${value}: valor inválido em t=${t.toFixed(2)} (${o.name || o.type})`);});
        assert.ok(Number.isFinite(fx.punch), `${c}/${key}=${value}: tremor inválido`);
      }
      particles.clear();disposeGroup(stage);assert.equal(particles.count, 0, `${c}/${key}: limpeza`);
    }
  }
}
// disparo nos extremos, com os dois tipos
for (const kind of [1, 2]) for (const [key, , , min, max] of controls.sand.filter(d => d[0].startsWith('shot') && d[0] !== 'shotKind')) for (const value of [min, max]) {
  const particles = new Particles(scene, {textures: false}), p = {...defaults.sand, shotKind: kind, [key]: value};
  const fx = new SandEffect(stage, particles, 0, p);runs++;
  for (let i = 0; i <= 30; i++) {fx.update(fx.duration * i / 30, .05);particles.update(1 / 30);stage.traverse(o => {for (const n of [o.position.x, o.position.y, o.position.z, o.scale.x, o.scale.y, o.scale.z]) assert.ok(Number.isFinite(n), `disparo ${kind}/${key}=${value}`);});}
  particles.clear();disposeGroup(stage);
}
console.log(`PASS: ${runs} execuções nos limites dos controles, sem valores inválidos`);
