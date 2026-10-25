// Todas as 24 propostas declaram a linha do tempo das fases: ordenada, sem sobreposição, só fases do padrão e fechando na duração.
import assert from 'node:assert/strict';
import * as T from 'three';
import {Particles} from './src/particles.js';
import {SandEffect, StoneEffect, RockEffect} from './src/effects.js';
import {RiposteEffect} from './src/riposte-effect.ts';
import {RushEffect} from './src/rush-effects.ts';
import {SwiftEffect, PsyshockEffect} from './src/new-effects.ts';
import {defaults, phases, categories} from './src/config.ts';
import {PhaseClock} from './src/phases.ts';

const stage = new T.Group(), particles = new Particles(new T.Scene(), {textures: false});
const build = (c, v, p) => c === 'sand' ? new SandEffect(stage, particles, v, p) : c === 'stone' ? new StoneEffect(stage, particles, v, p, null, v) : c === 'rock' ? new RockEffect(stage, v, p, null)
  : c === 'swift' ? new SwiftEffect(stage, particles, v, p) : c === 'psyshock' ? new PsyshockEffect(stage, particles, v, p, 5) : c === 'riposte' ? new RiposteEffect(stage, particles, v, p) : new RushEffect(stage, particles, c, v, p);
let n = 0;
for (const c of categories) for (let v = 0; v < 3; v++) {
  const p = {...defaults[c]}, fx = build(c, v, p), tl = fx.timeline();n++;
  assert.ok(tl.length > 0, `${c}${v}: sem janelas`);
  let last = 0;
  for (const s of tl) {
    assert.ok(phases.includes(s.id), `${c}${v}: fase desconhecida ${s.id}`);
    assert.ok(s.to > s.from, `${c}${v}: janela vazia ${s.id}`);
    if (c !== 'rock') assert.ok(Math.abs(s.from - last) < 1e-9, `${c}${v}: janelas contíguas em ${s.id} (${s.from} × ${last})`);
    last = s.to;
  }
  if (c !== 'rock') assert.ok(Math.abs(last - fx.duration) < 1e-9, `${c}${v}: fecha na duração (${last} × ${fx.duration})`);
  // o relógio costura as janelas e a legenda nunca mostra fase desligada
  const clock = new PhaseClock(tl, p);assert.equal(clock.nothingToShow, false);
  const off = new PhaseClock(tl, {...p, ...Object.fromEntries(phases.map(x => [x + 'On', 0]))});assert.equal(off.nothingToShow, true, `${c}${v}: tudo desligado = nada para mostrar`);
}
assert.equal(n, 24);
console.log('PASS: 24 propostas com linha do tempo de fases');
