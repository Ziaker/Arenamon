// Fase 4 (sem navegador): perfis gráficos tocam só parâmetros gráficos e não mudam a simulação; estatísticas do medidor.
import assert from 'node:assert/strict';
import {C, defaults, resetConfig} from '../src/sim/config.js';
import {Game} from '../src/sim/game.js';
import {GRAPHICS_PROFILES, GRAPHICS_PATHS, detectProfile} from '../src/sim/graphics.js';
import {categoryOf} from '../src/sim/presets.js';

let n = 0;const ok = l => {n++;console.log('✓', l);};
const set = (p, v) => {const k = p.split('.'), last = k.pop(), o = k.reduce((a, x) => a[x], C);assert.ok(last in o, p);o[last] = v;};
resetConfig(defaults());
assert.equal(detectProfile(), 'high', 'padrão do laboratório = Alto');
for (const p of GRAPHICS_PROFILES) {
  for (const path of Object.keys(p.values)) {
    assert.ok(GRAPHICS_PATHS.includes(path), path);
    assert.ok(['vfx', 'display'].includes(categoryOf(path)), `${path}: só categorias visuais (${categoryOf(path)})`);
    assert.ok(!/^(rules|actions|locomotion|profiles|extras\.(ai|combat|toggles)|test)\b/.test(path), `${path}: nunca física, dano, stamina, IA ou tempos`);
  }
  for (const [path, v] of Object.entries(p.values)) set(path, v);assert.equal(detectProfile(), p.id);resetConfig(defaults());
}
set('vfx.hit.count', 3);assert.equal(detectProfile(), 'custom');resetConfig(defaults());
ok('perfis Baixo/Médio/Alto: só resolução, partículas e sombra; detecção do perfil em uso e “Personalizado”');
{
  // A mesma luta IA × IA com o perfil Baixo e com o Alto: estados idênticos (o perfil não toca a simulação).
  const fight = profile => {resetConfig(defaults());for (const [p, v] of Object.entries(GRAPHICS_PROFILES.find(x => x.id === profile).values)) set(p, v);
    const g = new Game({seed: 5});g.brain.seed = 5;g.playerBrain.seed = 12;g.mode = 'tactical';g.reset();for (let t = 0; t < 2400 && g.phase === 'playing'; t++) g.step(g.playerBrain.command(g.fighters[0], g.fighters[1], 'tactical', C.test.step));return JSON.stringify({f: g.fighters, tick: g.tick, w: g.winner});};
  assert.equal(fight('low'), fight('high'));
}
ok('luta IA × IA com perfil Baixo e Alto: simulação idêntica');
{
  globalThis.performance ??= {now: () => Date.now()};
  const {PerfMeter} = await import('../src/ui/perf.js');
  const m = new PerfMeter();for (let i = 0; i < 100; i++) m.push({frameMs: i === 99 ? 50 : 16, simMs: 1, steps: 2, animMs: .5, vfxMs: .3, renderMs: 2, overlayMs: .1, calls: 20, triangles: 1000, active: i, spawned: i * 3});
  const s = m.summary();assert.equal(s.frames, 100);assert.equal(s.frameWorst, 50);assert.equal(s.frameP95, 16);assert.ok(Math.abs(s.workAvg - 3.9) < 1e-9);assert.equal(s.activePeak, 99);assert.equal(s.spawned, 297);assert.equal(s.gpuAvg, null);
}
ok('medidor: média, P95, pior quadro, trabalho de CPU, pico e partículas geradas; GPU nula sem medição');
resetConfig(defaults());
console.log(`\n${n} verificações de desempenho aprovadas.`);
