// Infraestrutura física 3D — reproduções e invariantes (auditoria sistêmica, 20/10/2026).
// Reproduz defeitos confirmados por inspeção do código e verifica os contratos físicos fundamentais:
//   1. launch() preserva a altitude atual (vault em curso ou voo em andamento) — antes descartava vaultHeight.
//   2. Pouso só ocorre na descida: subir pela lateral de uma plataforma não "teleporta" o lutador para o topo.
//   3. Teto: subir contra a face inferior de uma plataforma sólida para a subida (sem atravessar), com continuidade.
//   4. Salto normal sobre plataforma: aterrissa no topo exatamente uma vez (nenhuma aterrissagem repetida).
//   5. Limite circular da arena: o half-size legado da arena quadrada (16) não limita a arena circular oficial (raio 50);
//      um cap técnico explícito (test.circleCap) limita sem sentinel escondido.
//   6. Wall-splat: autoria do dano vem de lastAttacker real; sem lastAttacker o evento não atribui ao índice oposto.
//   7. Animação: entradas de estado não clonam o clipe e o cache de ações do mixer não cresce sem limite.
// Uso: node prototypes/combat-lab/test/physics3d.test.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
// O fixture do Studio é um módulo ES escrito para o navegador: carregado como texto, como em animation.test.mjs.
const {syntheticRig} = await import('data:text/javascript,' + encodeURIComponent(readFileSync(new URL('../../studio/test/fixture.js', import.meta.url), 'utf8')));
import {C, defaults, resetConfig} from '../src/sim/config.js';
import {Game} from '../src/sim/game.js';
import {emptyCommand} from '../src/sim/entity.js';
import {vec} from '../src/sim/math.js';
import {launch} from '../src/sim/combat.js';
import {clampToArena, getCeilingHeight, stepPhysics} from '../src/sim/physics.js';
import {Character} from '../src/view/characters.js';

let passed = 0, failed = 0;
const failures = [];
const test = (name, fn) => {
  try {fn();passed++;console.log('✓', name);}
  catch (e) {failed++;failures.push(name);console.log('✗', name, '—', String(e.message).split('\n')[0]);}
};

/** Partida inativa com mapa determinístico: uma plataforma sob medida no centro, sem demais objetos. */
function arena({height = 1, positions = [vec(0, -3), vec(0, 3)]} = {}) {
  resetConfig(defaults());
  const g = new Game({seed: 3});
  g.mode = 'inactive';
  g.reset({positions});
  g.mapState.platforms = [{id: 900, pos: {x: 0, z: 0}, width: 3, depth: 3, height}];
  g.mapState.obstacles = [];
  g.mapState.destructibles = [];
  g.mapState.items = [];
  return g;
}
/** Injeta um voo (salto normal) no lutador 0 e avança a física pura (sem controlador) passo a passo. */
function fly(f, g, opts) {
  const M = C.map ?? {};
  const gravity = opts.gravity ?? M.jumpGravity ?? C.rules.launchGravity;
  const vy0 = opts.vy ?? Math.sqrt(2 * gravity * (M.jumpHeight ?? 2));
  f.flight = {y: f.groundY ?? 0, vy: vy0, horizontal: {...(opts.horizontal ?? vec())}, gravity, isNormalJump: opts.normalJump ?? true};
  f.state = 'airborne';
}
const step = (g) => stepPhysics(g.fighters, C.test.step, g.world);

// ---------------------------------------------------------------------------
// 1. launch() preserva a altitude (contrato 6.1/6.2 da auditoria)
// ---------------------------------------------------------------------------
test('launch() no meio de um vault preserva a altitude física', () => {
  const g = arena();
  const f = g.fighters[0];
  f.groundY = 0;
  f.vaultHeight = 2.2; // vault de C em curso (altura ~2,2 m)
  f.position = vec(0, -3);
  launch(f, vec(1, 0), 5, 3);
  assert.ok(Math.abs(f.flight.y - 2.2) < 1e-9, `flight.y deve começar em 2,2 (veio ${f.flight.y})`);
  assert.equal(f.vaultHeight, 0, 'vaultHeight é absorvido pelo voo');
  // Continuidade: depois de um passo, a altitude evolui pela integração, não cai do zero.
  step(g);
  const expect = 2.2 + 3 * C.test.step - 0.5 * C.rules.launchGravity * C.test.step * C.test.step;
  assert.ok(Math.abs(f.flight.y - expect) < 1e-9, `altitude contínua após 1 passo (veio ${f.flight.y}, esperado ${expect})`);
});
test('launch() em alvo já em voo (juggle) preserva a altitude do voo em curso', () => {
  const g = arena();
  const f = g.fighters[0];
  f.groundY = 0;
  f.flight = {y: 3.4, vy: 2, horizontal: vec(1, 0)};
  launch(f, vec(1, 0), 5, 3);
  assert.ok(Math.abs(f.flight.y - 3.4) < 1e-9, `relançamento preserva flight.y (veio ${f.flight.y})`);
});

test('launch() a partir do topo de plataforma (1,5 m) cruza a borda e aterra no solo', () => {
  const g = arena({height: 1.5});
  const f = g.fighters[0];
  f.position = vec(0, -1.2);
  f.groundY = 1.5; // apoiado no topo
  launch(f, vec(0, 1), 7, 8); // arco longo: além da borda (1,5 m + meia-largura do corpo) e aterrissa no solo
  assert.ok(Math.abs(f.flight.y - 1.5) < 1e-9, `flight.y começa no topo (veio ${f.flight.y})`);
  for (let i = 0; i < 600 && f.flight; i++) step(g);
  assert.ok(!f.flight && Math.abs(f.groundY) < 1e-9, `aterrissou no solo além da borda (groundY=${f.groundY})`);
  assert.ok(f.position.z > 1.5, `cruzoou a borda da plataforma (z=${f.position.z.toFixed(2)})`);
});

// ---------------------------------------------------------------------------
// 2/3. Pouso só na descida + teto (sem "snap" para o topo e sem atravessar a face inferior)
// ---------------------------------------------------------------------------
test('subir pela lateral de uma plataforma não teleporta para o topo (pouso só na descida + continuidade)', () => {
  const g = arena({height: 1});
  const f = g.fighters[0];
  // Salto corrido contra a lateral da plataforma de 1 m: entra na área da plataforma ainda subindo, a ~0,8 m.
  f.position = vec(0, -1.72);
  f.groundY = 0;
  fly(f, g, {horizontal: vec(0, 2)});
  const dt = C.test.step;
  let prevY = f.flight.y, roseAbove = false;
  for (let i = 0; i < 400 && f.flight; i++) {
    const vyBefore = f.flight.vy, grav = f.flight.gravity ?? 0;
    step(g);
    if (!f.flight) break;
    const dy = f.flight.y - prevY;
    // Continuidade espacial (contrato 6.1): nenhum salto de altitude sem causa física.
    // No ápice (vy=0) o semi-implícito ainda desce g·dt² neste passo — tolerância física, não defeito.
    assert.ok(Math.abs(dy) <= Math.abs(vyBefore) * dt + grav * dt * dt + 1e-9, `Δy por passo contínuo (passo ${i}: Δy=${dy.toFixed(4)}, vy=${vyBefore.toFixed(2)})`);
    if (f.flight.vy > 0 && f.flight.y < 1 - 1e-6) {
      // Ainda subindo e abaixo do topo: não pode ter "pousado" (o defeito grudava no topo ao cruzar 0,65 m).
      assert.ok(f.flight.y > prevY - 1e-9 || f.flight.y > 1 - 0.05, 'sem pouso durante a subida abaixo do topo');
      if (f.flight.y > 0.65) roseAbove = true;
    }
    prevY = f.flight.y;
  }
  assert.ok(roseAbove, 'o cenário atravessa a faixa de 0,65 m ainda subindo');
  // Bateu a cabeça na face inferior e caiu de volta ao próprio piso: subir pela lateral não é "subir na plataforma".
  assert.ok(!f.flight && Math.abs(f.groundY) < 1e-9, `caiu de volta ao próprio piso (groundY=${f.groundY})`);
});
test('salto sob uma plataforma alta (1,9 m): bate na face inferior e volta ao seu piso, sem atravessar', () => {
  const g = arena({height: 1.9});
  const f = g.fighters[0];
  f.position = vec(0, -1.9);
  f.groundY = 0;
  fly(f, g, {horizontal: vec(0, 1.4)});
  let bonked = false;
  for (let i = 0; i < 400 && f.flight; i++) {
    step(g);
    if (f.flight && f.flight.vy === 0 && Math.abs(f.flight.y - 1.9) < 1e-6) bonked = true;
  }
  assert.ok(bonked, 'a subida parou na face inferior da plataforma (teto)');
  assert.ok(!f.flight && Math.abs(f.groundY) < 1e-9, `caiu de volta ao próprio piso (groundY=${f.groundY})`);
});
test('getCeilingHeight: só conta faces acima da faixa cruzada e dentro da área XZ', () => {
  resetConfig(defaults());
  const world = {mapState: {platforms: [{pos: {x: 0, z: 0}, width: 3, depth: 3, height: 2}], obstacles: [], destructibles: []}};
  assert.equal(getCeilingHeight(vec(0, 0), world, 0, 1), null, 'não cruza a face a 2 m');
  assert.equal(getCeilingHeight(vec(0, 0), world, 1.5, 2.2), 2, 'cruza a face a 2 m');
  assert.equal(getCeilingHeight(vec(5, 0), world, 1.5, 2.2), null, 'fora da área XZ não há teto');
  assert.equal(getCeilingHeight(vec(0, 0), world, 2.0, 2.2), null, 'face no próprio nível de partida não é teto');
});

// ---------------------------------------------------------------------------
// 4. Salto normal sobre a plataforma: pouso único no topo
// ---------------------------------------------------------------------------
test('salto normal sobre a plataforma aterrissa no topo exatamente uma vez', () => {
  const g = arena({height: 1});
  const f = g.fighters[0];
  // Corre e salta de fora: passa a borda perto do ápice e cai dentro da área da plataforma.
  f.position = vec(0, -2.5);
  f.groundY = 0;
  fly(f, g, {horizontal: vec(0, 4)});
  let landings = 0;
  for (let i = 0; i < 400 && (f.flight || f.knockRecovery > 0); i++) {
    const wasFlying = !!f.flight;
    step(g);
    if (wasFlying && !f.flight) landings++;
  }
  assert.equal(landings, 1, `uma única aterrissagem (houve ${landings})`);
  assert.ok(Math.abs(f.groundY - 1) < 1e-9, `apoiado no topo da plataforma (groundY=${f.groundY})`);
  assert.equal(f.lastLanding.n, 1, 'evento de pouso único para o contato');
});

// ---------------------------------------------------------------------------
// 5. Limite circular da arena sem sentinel escondido
// ---------------------------------------------------------------------------
test('arena circular oficial (raio 50) não é limitada pelo half-size legado 16 da arena quadrada', () => {
  resetConfig(defaults());
  const f = {id: 0, position: vec(60, 0), velocity: vec(1, 0), flight: null, contacts: 0};
  clampToArena(f);
  assert.ok(Math.abs(Math.hypot(f.position.x, f.position.z) - (50 - C.test.halfExtent)) < 1e-9, `clamp no raio oficial (r=${Math.hypot(f.position.x, f.position.z)})`);
  // Cap técnico explícito para a arena circular (testes técnicos), sem depender do valor 16.
  C.test.circleCap = 10;
  const g2 = {id: 0, position: vec(60, 0), velocity: vec(1, 0), flight: null, contacts: 0};
  clampToArena(g2);
  assert.ok(Math.abs(Math.hypot(g2.position.x, g2.position.z) - (10 - C.test.halfExtent)) < 1e-9, `cap explícito respeitado (r=${Math.hypot(g2.position.x, g2.position.z)})`);
});

// ---------------------------------------------------------------------------
// 6. Wall-splat: autoria real do dano
// ---------------------------------------------------------------------------
test('wall-splat sem lastAttacker não atribui o dano ao índice oposto', () => {
  const g = arena(); // arena() já faz resetConfig(defaults())
  C.rules.wallSplatDamage = 5; // após o reset: slider por padrão 0
  const [a, b] = g.fighters;
  // Gatilho natural: já fora do limite (49,6 > raio−halfExtent = 49,5), caindo e com velocidade de wall-splat.
  const splat = () => {
    b.position = vec(0, 49.6);
    b.wallSplat = null;
    b.flight = {y: 3, vy: -5, horizontal: vec(0, 9)};
    b.state = 'airborne';
  };
  b.lastAttacker = null;
  splat();
  const events = step(g);
  const ev = events.find(e => e.result === 'wallSplat');
  assert.ok(ev, 'evento de wall-splat emitido');
  assert.equal(ev.attacker, null, `sem autoria inventada (veio ${ev.attacker})`);
  assert.equal(b.hp, 95, 'dano ambiental bruto sem atacante (pipeline central de dano)');
  assert.equal(a.hp, 100, 'o outro lutador não é tocado');
  // Com lastAttacker real, a autoria é preservada.
  b.hp = 100;
  b.lastAttacker = a.id;
  splat();
  step(g);
  assert.equal(b.hp, 95, 'dano com autor aplicado e atribuído');
});

// ---------------------------------------------------------------------------
// 7. Animação: sem clone de clipe por entrada e cache do mixer estável
// ---------------------------------------------------------------------------
function clip(name, duration) {
  const times = [0, duration / 2, duration];
  return new T.AnimationClip(name, duration, [
    new T.QuaternionKeyframeTrack('mixamorigSpine.quaternion', times, new T.Quaternion().toArray().concat(new T.Quaternion().toArray(), new T.Quaternion().toArray())),
    new T.VectorKeyframeTrack('mixamorigHips.position', times, [0, 1, 0, 0, 1, 0, 0, 1, 0])]);
}
test('entradas de estado não clonam clipes e o cache de ações do mixer não cresce sem limite', () => {
  resetConfig(defaults());
  const {root} = syntheticRig(T);
  const source = {name: 'cache.glb', scene: root, animations: [clip('Idle', 2), clip('Running', .7), clip('Tackle A', .9)], manifest: null, eventsByClip: []};
  const ch = new Character(source, {persist: false});
  const g = new Game({seed: 3});
  g.mode = 'inactive';
  g.reset({positions: [vec(-6, 0), vec(8, 8)]});
  const f = g.fighters[0];
  const clipsBefore = ch.clips.slice();
  // Churn: alterna ações e locomoção 60 vezes (mais trocas que clipes distintos).
  for (let i = 0; i < 60; i++) {
    f.action = i % 2 ? {kind: 'tackle', elapsed: .05 + (i % 3) * .01, hits: new Set(), heading: 0} : null;
    f.flight = null;
    ch.update(f, C.test.step, 0, [], {tick: i, source: 'IA'});
  }
  assert.ok(ch.clips.every((c, i) => c === clipsBefore[i]), 'clipes do catálogo nunca são substituídos/clonados');
  const cached = Object.keys(ch.mixer._actionsByClip ?? {}).length;
  assert.ok(cached <= ch.clips.length, `cache do mixer limitado aos clipes distintos (cached=${cached}, clips=${ch.clips.length})`);
});

console.log(`\n${passed} passaram, ${failed} falharam.`);
if (failed) {console.log('Falhas:', failures.join(' | '));process.exit(1);}
