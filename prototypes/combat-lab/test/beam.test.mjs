// Fase 7 (plano de Reflect/Psyshock) — lasers contínuos (entidade `beam`), sem navegador. Cobre: M3.5, M9.6, M17.5–M17.7, M20.6 e os
// emissores técnicos (M28.3). O feixe é recalculado a cada passo; eventos de reflexão/neutralização saem uma vez por contato novo.
import assert from 'node:assert/strict';
import {C, defaults, resetConfig} from '../src/sim/config.js';
import {Game} from '../src/sim/game.js';
import {emptyCommand} from '../src/sim/entity.js';
import {effectiveArenaRadius} from '../src/sim/map.js';
import {vec} from '../src/sim/math.js';
import {spawn, ENTITY_KINDS} from '../src/sim/world.js';

globalThis.__legacyFractionalDamage = true;   // este teste caracteriza a matemática de dano fracionária, anterior à regra de dano inteiro (ver sim/damage-rule.js)
let n = 0;const ok = l => {n++;console.log('✓', l);};
const near = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} ≠ ${b}`);
const events = [];
function arena({blue = vec(0, -3), red = vec(0, 3)} = {}) {
  resetConfig(defaults());events.length = 0;
  const g = new Game();g.mode = 'inactive';g.reset({positions: [blue, red]});return g;
}
const step = g => {g.step(emptyCommand(), emptyCommand());events.push(...g.lastStepEvents);return g.lastStepEvents;};
const steps = (g, k) => {for (let i = 0; i < k; i++) step(g);};
const barrier = (g, o = {}) => spawn(g.world, {kind: 'barrier', owner: 0, shape: 'box', pos: {x: 0, z: 0}, angle: 0, hx: 1, hz: .05, y: 0, height: 2, life: 9, hp: Infinity, blocksProjectiles: true, blocksFighters: false, blocksOwner: false,
  reflect: true, shields: true, breakableByTackle: true, breakableByBlast: true, pl: 1, captured: {tieTolerance: .001, maxReflections: 16}, ...o}, []);
const beam = (g, o = {}) => spawn(g.world, {kind: 'beam', owner: 1, pos: {x: 0, z: 2}, dir: {x: 0, z: -1}, life: 5, hit: {damage: 2}, ...o}, []);
const count = r => events.filter(e => e.result === r).length;

// ---------- Existe como tipo de entidade e tem padrões ----------
assert.ok(ENTITY_KINDS.includes('beam'));
assert.equal(C.world.beam.maxSegments, 8);assert.equal(C.world.beam.interval, .25);
ok('beam é um tipo de entidade com padrões provisórios em C.world.beam');

// ---------- Acerto direto: dano a cada intervalo, um segmento, para no corpo ----------
{
  const g = arena(), b = beam(g);steps(g, 120);
  assert.equal(b.segments.length, 1);assert.equal(b.segments[0].owner, 1);
  near(b.segments[0].b.z, -3 + C.test.halfExtent + b.width, 1e-9);                     // termina na face do corpo (não atravessa)
  assert.equal(count('impact'), 4);near(g.fighters[0].hp, 100 - 4 * 2, 1e-9);
  const hits = events.filter(e => e.result === 'impact');
  assert.ok(hits.every(e => e.attacker === 1 && e.target === 0 && e.source === 'laser' && e.kind === 'beam' && e.seg === 0 && e.entity === b.id));
  assert.equal(g.fighters[1].hp, 100, 'o dono não se fere');
}
ok('acerto direto: 1 acerto a cada 0,25 s, um segmento, termina no corpo, o dono não é atingido');

// ---------- Reflexão pela frente: troca de dono, dano com o novo dono, evento uma vez só (M17.5, M17.6) ----------
{
  const g = arena(), bar = barrier(g), b = beam(g);steps(g, 120);
  assert.equal(b.segments.length, 2);assert.equal(b.segments[1].owner, 0);assert.equal(b.segments[1].by, bar.id);
  near(b.segments[0].b.z, bar.hz + b.width, 1e-9);                                       // primeira superfície: a frente
  assert.equal(count('reflected'), 1, 'reflexão anunciada UMA vez, não a cada passo');
  const r = events.find(e => e.result === 'reflected');assert.deepEqual([r.attacker, r.target, r.face, r.seg], [0, 1, 'front', 0]);
  assert.equal(g.fighters[0].hp, 100, 'quem estava protegido não é ferido');
  assert.equal(count('impact'), 4);assert.ok(events.filter(e => e.result === 'impact').every(e => e.attacker === 0 && e.target === 1 && e.seg === 1));
  near(g.fighters[1].hp, 100 - 4 * 2, 1e-9);
}
ok('reflexão pela frente: dono do trecho refletido passa a ser o refletor e o lançador leva o dano (evento de reflexão uma vez)');

// ---------- Dano do trecho com a fração do Ataque do dono (M17.6, M30.1) ----------
{
  const g = arena();barrier(g);g.fighters[0].attributes.attack = 3;g.fighters[1].attributes.attack = 1;
  beam(g, {captured: {attackFraction: .5}});steps(g, 5);
  near(100 - g.fighters[1].hp, .5 * 3, 1e-9);
}
ok('captured.attackFraction recalcula o dano com o Ataque do dono do trecho (o refletor)');

// ---------- Sem a barreira o feixe recalcula e segue reto (M17.7) ----------
{
  const g = arena(), bar = barrier(g), b = beam(g);steps(g, 10);assert.equal(b.segments.length, 2);
  bar.dead = true;step(g);assert.equal(b.segments.length, 1);assert.equal(b.segments[0].owner, 1);near(b.segments[0].b.z, -3 + C.test.halfExtent + b.width, 1e-9);
  steps(g, 40);assert.ok(g.fighters[0].hp < 100, 'agora o alvo original é atingido');
}
ok('barreira que some: o feixe recalcula a trajetória sem ela no passo seguinte');

// ---------- Verso atravessa; borda reflete pela própria normal (M30.5) ----------
{
  const g = arena({blue: vec(0, 3), red: vec(0, -3)});barrier(g);
  const b = beam(g, {owner: 1, pos: {x: 0, z: -2}, dir: {x: 0, z: 1}});steps(g, 3);
  assert.equal(b.segments.length, 1, 'entrando pelo verso o feixe atravessa');assert.equal(count('reflected'), 0);assert.equal(b.segments[0].owner, 1);
}
{
  const g = arena({blue: vec(-3, -3), red: vec(3, 3)});barrier(g);
  const b = beam(g, {owner: 1, pos: {x: -3, z: 0}, dir: {x: 1, z: 0}});steps(g, 3);
  assert.equal(b.segments.length, 2);const r = events.find(e => e.result === 'reflected');assert.equal(r.face, 'edge');
  assert.ok(b.segments[1].b.x < b.segments[0].b.x, 'volta pela normal da borda');near(b.segments[1].a.z, 0, 1e-5);
}
ok('verso atravessa a barreira; a borda reflete pela própria normal');

// ---------- PL superior: derruba a barreira e neutraliza SÓ o segmento incidente; a fonte segue (M20.6, M18.8) ----------
{
  const g = arena(), bar = barrier(g, {pl: 1}), b = beam(g, {pl: 3});
  step(g);assert.ok(bar.dead);assert.equal(count('barrierBroken'), 1);assert.equal(count('neutralized'), 1);
  const nu = events.find(e => e.result === 'neutralized');assert.deepEqual([nu.entity, nu.by, nu.seg, nu.pl, nu.attacker, nu.target], [b.id, bar.id, 0, 3, 1, 0]);
  assert.equal(g.fighters[0].hp, 100, 'neste passo o segmento foi neutralizado');assert.ok(!b.dead, 'a fonte não é encerrada');
  steps(g, 30);assert.equal(count('neutralized'), 1, 'sem neutralização repetida');assert.ok(g.fighters[0].hp < 100, 'no passo seguinte o feixe emite de novo e atinge');
}
{
  const g = arena(), bar = barrier(g, {pl: 3});beam(g, {pl: 3});steps(g, 3);
  assert.ok(!bar.dead && count('reflected') === 1, 'PL igual é refletido');
}
ok('PL superior destrói a barreira e neutraliza só o segmento; PL igual reflete; sem repetição de eventos');

// ---------- Estabilidade: feixe paralelo e rente à face não gera contato nem evento ----------
{
  const g = arena({blue: vec(-3, -3), red: vec(3, -3)}), b = beam(g, {pos: {x: -4, z: .5}, dir: {x: 1, z: 0}});barrier(g);steps(g, 60);
  assert.equal(b.segments.length, 1);assert.equal(count('reflected'), 0);
}
ok('feixe paralelo à barreira, afastado da face: sem contato e sem eventos');

// ---------- Salvaguarda: cavidade de espelhos paralelos limita os segmentos e avisa uma vez ----------
{
  const g = arena({blue: vec(-4, 0), red: vec(4, 0)});
  barrier(g, {pos: {x: 0, z: 0}, hx: 2, owner: 0});barrier(g, {pos: {x: 0, z: 2}, hx: 2, angle: Math.PI, owner: 1});
  const b = beam(g, {owner: 0, pos: {x: 0, z: 1}, dir: {x: 0, z: -1}});steps(g, 20);
  assert.equal(b.segments.length, C.world.beam.maxSegments);assert.equal(count('reflectCycle'), 1);
  assert.deepEqual(b.segments.slice(0, 4).map(s => s.owner), [0, 0, 1, 0]);                   // o dono do trecho seguinte é o dono da barreira que refletiu
}
ok('espelhos paralelos: segmentos limitados por C.world.beam.maxSegments e um único aviso');

// ---------- Parede e limite da arena encerram o feixe; emissor pode girar ----------
{
  const g = arena({blue: vec(-3, 0), red: vec(3, 0)});spawn(g.world, {kind: 'wall', pos: {x: 0, z: 0}, hx: 3, hz: .3, angle: 0, y: 0, height: 2.2}, []);
  const b = beam(g, {pos: {x: 0, z: 2}, dir: {x: 0, z: -1}});step(g);assert.equal(b.segments.length, 1);near(b.segments[0].b.z, .3 + b.width, 1e-9);
  // O meio-lado legado (arenaHalf) só limita o feixe na arena QUADRADA; na circular (padrão) a borda é o raio efetivo (sem parede invisível; overhaul de colisões, Fase 6).
  const g2 = arena();C.map.arenaShape = 'square';
  const b2 = beam(g2, {pos: {x: 0, z: 0}, dir: {x: 1, z: 0}, owner: 0});step(g2);near(b2.segments[0].b.x, C.test.arenaHalf, 1e-9);
  const g3 = arena({blue: vec(-3, -3), red: vec(3, -3)}), b3 = beam(g3, {pos: {x: 0, z: 0}, dir: {x: 1, z: 0}, owner: 0, length: 200});step(g3);near(b3.segments[0].b.x, effectiveArenaRadius(), 1e-6);
}
{
  const g = arena(), b = beam(g, {turn: Math.PI / 2});const d0 = {...b.dir};steps(g, 120);
  assert.ok(Math.abs(Math.atan2(b.dir.x, b.dir.z) - Math.atan2(d0.x, d0.z)) > .1, 'o emissor gira');
}
ok('parede e limite da arena param o feixe; emissor pode girar');

// ---------- Estado em dados simples: clonável e determinístico ----------
{
  const run = () => {const g = arena(), b = (barrier(g), beam(g));steps(g, 90);return JSON.stringify([g.fighters.map(f => f.hp), b.segments, g.world.entities.length, events.map(e => e.result)]);};
  const x = run(), y = run();assert.equal(x, y);
  const g = arena();barrier(g);beam(g);steps(g, 5);const copy = structuredClone(g.world);assert.equal(copy.entities.length, 2);
}
ok('feixe é estado em dados simples (clonável) e determinístico');
console.log(`\n${n} verificações do laser concluídas`);
