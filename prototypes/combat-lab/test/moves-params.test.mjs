// Cobertura dos sliders da aba Moves: todo parâmetro de C.world.{charge,reflect,psyshock,beam} que a simulação LÊ tem controle com rótulo,
// faixa e unidade, e cada controle novo altera de fato o resultado do Move. Roda em Node, sem navegador.
import assert from 'node:assert/strict';
import {readdirSync, readFileSync, statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {C, defaults, resetConfig} from '../src/sim/config.js';
import {Game} from '../src/sim/game.js';
import {emptyCommand} from '../src/sim/entity.js';
import {vec} from '../src/sim/math.js';
import {registerStandardMoves} from '../src/sim/moves/standard.js';
import {spawn} from '../src/sim/world.js';
import {MOVES_PARAMS} from '../src/ui/moves-panel.js';

let n = 0;const ok = l => {n++;console.log('✓', l);};
registerStandardMoves();
const cmd = o => ({...emptyCommand(), ...o});
const HOLD = i => [0, 1, 2, 3].map(k => k === i);
function arena(setup) {
  resetConfig(defaults());setup?.();
  const g = new Game();g.mode = 'inactive';g.reset({positions: [vec(0, -3), vec(0, 3)]});g.fighters[0].facing = 0;g.fighters[1].facing = Math.PI;g.setLoadout(0, ['reflect', 'psyshock']);return g;
}
const step = (g, c = cmd()) => g.step(c, cmd());
/** Segura o slot por `ticks` passos e solta. */
function hold(g, slot, ticks) {step(g, cmd({skill: slot, skillHeld: HOLD(slot)}));for (let i = 1; i < ticks; i++) step(g, cmd({skillHeld: HOLD(slot)}));step(g, cmd());}
const stones = (g, ticks = 96) => {hold(g, 1, ticks);return g.world.entities.filter(e => e.kind === 'projectile' && e.exec != null);};
const mean = a => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);
const sdOf = a => {const m = mean(a);return Math.sqrt(mean(a.map(v => (v - m) ** 2)));};

// ---------- Cobertura: nada que a simulação lê fica sem slider ----------
const NEW = new Set(['psyshock.knockbackVertical', 'psyshock.knockbackLevelBonus', 'psyshock.knockbackSpeedFactor', 'reflect.minCharge', 'psyshock.searchStep', 'psyshock.arc', 'psyshock.ringMin', 'psyshock.ringMax', 'psyshock.heightMin', 'psyshock.heightMax', 'psyshock.scaleMin', 'psyshock.scaleMax']);
const GROUPS = ['charge', 'reflect', 'psyshock', 'beam'];
const rows = new Map(MOVES_PARAMS.flatMap(([, list]) => list).map(r => [`${r[0]}.${r[1]}`, r]));
/** Chaves da configuração que NENHUM código da simulação ou da visão lê (campos legados): sem leitor, um slider seria controle morto. */
const UNUSED = new Set(['reflect.supportTolerance', 'psyshock.followInertia']);
function sourceFiles(dir) {return readdirSync(dir).flatMap(f => {const p = dir + '/' + f;return statSync(p).isDirectory() ? sourceFiles(p) : /\.js$/.test(f) ? [p] : [];});}
{
  const src = sourceFiles(fileURLToPath(new URL('../src', import.meta.url))).filter(f => !/sim[\/]config\.js$/.test(f)).map(f => readFileSync(f, 'utf8')).join('\n');
  const missing = [], deadButListed = [];
  for (const g of GROUPS) for (const k of Object.keys(C.world[g])) {
    const id = `${g}.${k}`, used = new RegExp(`\b${k}\b`).test(src);
    if (UNUSED.has(id)) {if (used) deadButListed.push(id);continue;}
    if (!rows.has(id)) missing.push(id);
  }
  assert.deepEqual(missing, [], 'parâmetros lidos pela simulação sem slider na aba Moves: ' + missing.join(', '));
  assert.deepEqual(deadButListed, [], 'agora são lidos: crie o slider e tire de UNUSED: ' + deadButListed.join(', '));
}
ok('todo parâmetro dos Moves que o código lê tem slider (os 2 campos legados sem leitor ficam de fora de propósito)');
{
  for (const [id, [g, k, label, tip, min, max, stepv, fmt]] of rows) {
    const v = defaults().world[g][k];
    assert.ok(label.length > 3 && tip.length > 10, `${id}: rótulo e descrição`);
    assert.ok(stepv > 0 && max > min, `${id}: faixa válida`);
    assert.ok(v >= min - 1e-9 && v <= max + 1e-9, `${id}: padrão ${v} fora de ${min}..${max}`);
    assert.ok(/\d/.test(fmt(v)), `${id}: formato mostra o valor (${fmt(v)})`);
    if (NEW.has(id)) assert.ok(/[a-z°%×]/i.test(fmt(v).replace(/[\d.\s]/g, '')) && !/^\d+(\.\d+)?$/.test(fmt(v)), `${id}: formato com unidade (${fmt(v)})`);
  }
}
ok('cada slider tem rótulo, descrição, faixa que contém o padrão e formato com unidade');

// ---------- Efeito real dos controles novos ----------
{
  const spread = arc => {const g = arena(() => {C.world.psyshock.arc = arc;}), s = stones(g, 480);return sdOf(s.map(e => Math.atan2(e.pos.x - g.fighters[0].position.x, e.pos.z - g.fighters[0].position.z)));};
  assert.ok(spread(300) > spread(30) * 2, `abertura do arco: ${spread(30).toFixed(3)} → ${spread(300).toFixed(3)}`);
}
ok('psyshock.arc: abrir o arco espalha as pedras ao redor do lançador');
{
  const dist = (min, max) => {const g = arena(() => {C.world.psyshock.ringMin = min;C.world.psyshock.ringMax = max;}), s = stones(g, 480);return mean(s.map(e => Math.hypot(e.pos.x - g.fighters[0].position.x, e.pos.z - g.fighters[0].position.z)));};
  assert.ok(dist(2, 2.2) > dist(.4, .5) + 1, `anel: ${dist(.4, .5).toFixed(2)} → ${dist(2, 2.2).toFixed(2)}`);
}
ok('psyshock.ringMin/ringMax: a distância de saída das pedras acompanha o anel');
{
  const alt = (min, max) => mean(stones(arena(() => {C.world.psyshock.heightMin = min;C.world.psyshock.heightMax = max;}), 480).map(e => e.y));
  assert.ok(alt(1.6, 1.8) > alt(.1, .2) + 1, `altura: ${alt(.1, .2).toFixed(2)} → ${alt(1.6, 1.8).toFixed(2)}`);
}
ok('psyshock.heightMin/heightMax: a altura inicial das pedras acompanha os limites');
{
  const sz = (min, max) => {const s = stones(arena(() => {C.world.psyshock.scaleMin = min;C.world.psyshock.scaleMax = max;}), 480);return {v: mean(s.map(e => e.visualScale)), r: new Set(s.map(e => e.radius)).size};};
  const a = sz(.4, .5), b = sz(2.5, 2.8);
  assert.ok(b.v > a.v * 3, `tamanho visual: ${a.v.toFixed(2)} → ${b.v.toFixed(2)}`);assert.equal(a.r, 1);assert.equal(b.r, 1, 'a colisão (raio) continua igual (M30.2)');
}
ok('psyshock.scaleMin/scaleMax: mudam só o tamanho visual, nunca o raio de colisão');
{
  // Parede à frente do lançador cobre o anel: a busca avança em passos de searchStep até achar espaço.
  const forward = stepv => {const g = arena(() => {C.world.psyshock.searchStep = stepv;C.world.psyshock.searchRange = 3;C.world.psyshock.arc = 40;});
    spawn(g.world, {kind: 'wall', shape: 'box', pos: {x: 0, z: -2.1}, hx: 3, hz: .3, angle: 0, y: 0, height: 2, life: 99}, g.lastStepEvents);
    const s = stones(g, 96);return s.length ? mean(s.map(e => e.pos.z)) : null;};
  const fine = forward(.1), coarse = forward(1);
  assert.ok(fine !== null && coarse !== null && fine !== coarse, `busca: ${fine} × ${coarse}`);
  assert.ok(coarse > fine + .15, `passo grosso salta o espaço livre mais perto: ${fine?.toFixed(2)} → ${coarse?.toFixed(2)}`);
}
ok('psyshock.searchStep: o passo da busca muda onde as pedras acham espaço livre');
{
  const made = (minC, seconds) => {const g = arena(() => {C.world.reflect.minCharge = minC;});hold(g, 0, Math.round(seconds * 120));return g.world.entities.some(e => e.kind === 'barrier');};
  assert.equal(made(.3, .6), true, 'com carga mínima de 0,3 s, segurar 0,6 s materializa');
  assert.equal(made(2.5, 1.5), false, 'com carga mínima de 2,5 s, segurar 1,5 s falha');
  assert.equal(made(2.5, 2.8), true, 'segurando além da carga mínima materializa');
}
ok('reflect.minCharge: define o tempo mínimo segurando para a barreira nascer');
{
  const kbOf = (cfg, ticks = 96) => stones(arena(() => Object.assign(C.world.psyshock, cfg)), ticks).map(e => e.hit.knockback);
  const base = kbOf({});
  assert.ok(base.every(k => k.vertical === 0 && Math.abs(k.horizontal - .3) < 1e-9), 'padrão inalterado: 0,3 m/s horizontal, 0 vertical');
  assert.ok(kbOf({knockbackVertical: 2}).every(k => k.vertical === 2), 'lançamento vertical por pedra');
  const pl1 = kbOf({knockbackLevelBonus: 1}, 10), pl3 = kbOf({knockbackLevelBonus: 1}, 480);
  assert.ok(Math.abs(pl1[0].horizontal - .3) < 1e-9 && Math.abs(pl3[0].horizontal - .3 * 3) < 1e-9, `bônus por PL: PL1 ${pl1[0].horizontal} · PL3 ${pl3[0].horizontal}`);
  const sp = kbOf({knockbackSpeedFactor: 1}, 480).map(k => k.horizontal);
  assert.ok(Math.max(...sp) - Math.min(...sp) > .01, 'empurrão varia com a velocidade sorteada da pedra');
  assert.equal(new Set(kbOf({}, 480).map(k => k.horizontal.toFixed(6))).size, 1, 'sem o fator, todas as pedras empurram igual');
  assert.equal(MOVES_PARAMS.flatMap(g => g[1]).find(r => r[1] === 'knockbackPerStone')[5], 3.2);
  assert.equal(MOVES_PARAMS.flatMap(g => g[1]).find(r => r[1] === 'knockbackCap')[5], 4.8);
}
ok('psyshock: limites de knockback +60% e novos controles (vertical, bônus por PL, velocidade da pedra) alteram o empurrão real');

console.log(`
${n} verificações dos sliders dos Moves aprovadas.`);
