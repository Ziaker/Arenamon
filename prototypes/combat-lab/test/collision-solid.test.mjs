// Fase 1 do overhaul de colisões — lutador × sólidos do mundo (paredes e barreiras de Moves), plano XZ.
// Contrato: ao fim de UMA chamada de collideFighter o disco do lutador está fora do sólido, deslocado a MENOR distância
// possível (sem expulsão pela ponta da parede), sem perder a velocidade tangencial, sem jitter e sem empurrão de sólido morto.
// Origem dos casos: reprodução da Fase 0 sobre o commit 4634ca2 (docs/OVERHAUL_COLISOES_AMBIENTE.md, COL-A/COL-H) e testes do PR #100.
// Uso: node prototypes/combat-lab/test/collision-solid.test.mjs
import assert from 'node:assert/strict';
import {C, defaults, resetConfig} from '../src/sim/config.js';
import {vec} from '../src/sim/math.js';
import {toLocal, toWorld} from '../src/sim/geometry.js';
import {solidContact} from '../src/sim/solid-contact.js';
import {createWorld, spawn, collideFighter, closestOnShape} from '../src/sim/world.js';

resetConfig(defaults());
const r = C.test.halfExtent;
const near = (a, b, tolerance = 1e-8) => assert.ok(Math.abs(a - b) < tolerance, `${a} ≉ ${b}`);
const shifted = (p, c) => c ? {x: p.x + c.normal.x * c.depth, z: p.z + c.normal.z * c.depth} : {...p};
const fighter = (p, id = 0) => ({id, position: {...p}, velocity: vec(), locomotionVelocity: vec(), flight: null, vaultHeight: 0, contacts: 0, action: null});
const clearOf = (e, p) => closestOnShape(e, p).distance >= r - 1e-9;
let tests = 0;const failures = [];
// Cada bloco roda isolado: uma falha não esconde as demais (útil para ver o RED completo) e o processo sai com código 1.
const check = (name, fn) => {try {fn();tests++;console.log('✓', name);} catch (error) {failures.push(name);console.log('✗', name, '—', String(error.message).split(/\r?\n/)[0]);}};

// ---------- Núcleo puro: solidContact ----------
check('contato tangente sem penetração não gera impulso', () => {
  const e = {shape: 'box', pos: vec(), hx: 2, hz: .3}, p = vec(0, .3 + r);
  assert.equal(solidContact(e, p, r), null);
  assert.equal(solidContact({shape: 'circle', pos: vec(), radius: 2}, vec(2 + r, 0), r), null);
});
check('caixa: depenetração total de ponto interno, inclusive no centro', () => {
  const e = {shape: 'box', pos: vec(), hx: 3, hz: 2}, p = vec();
  const c = solidContact(e, p, r);assert.ok(c && c.inside);
  near(c.depth, 2 + r);
  assert.equal(solidContact(e, shifted(p, c), r), null, 'disco precisa terminar FORA da caixa');
});
check('caixa rotacionada: face local correta e sem atravessamento', () => {
  const e = {shape: 'box', pos: vec(1, -2), angle: Math.PI / 4, hx: 1.2, hz: .35};
  const p = toWorld(e, .2, .05);
  const c = solidContact(e, p, r);assert.ok(c && c.inside);
  const q = toLocal(e, shifted(p, c));
  near(q.v, .35 + r);
  near(q.u, .2);
  assert.equal(solidContact(e, shifted(p, c), r), null);
});
check('canto externo da caixa: contato diagonal', () => {
  const e = {shape: 'box', pos: vec(), hx: 2, hz: 2}, p = vec(2.25, 2.25);
  const c = solidContact(e, p, r);assert.ok(c && !c.inside);
  assert.ok(c.normal.x > 0 && c.normal.z > 0);
  assert.equal(solidContact(e, shifted(p, c), r), null);
});
check('círculo: interior e centro profundo sem correção insuficiente', () => {
  for (const p of [vec(1, 0), vec(0, 0), vec(0, -1)]) {
    const e = {shape: 'circle', pos: vec(), radius: 2}, c = solidContact(e, p, r);
    assert.ok(c && c.inside);
    near(Math.hypot(shifted(p, c).x, shifted(p, c).z), 2 + r);
    assert.equal(solidContact(e, shifted(p, c), r), null);
  }
});
check('empate entre faces: resultado determinístico e válido', () => {
  // Empate exato entre duas faces (quadrado perfeito, centro no meio): escolha determinística, sempre fora após o deslocamento.
  const e = {shape: 'box', pos: vec(), hx: 1, hz: 1}, c = solidContact(e, vec(), r), again = solidContact(e, vec(), r);
  assert.deepEqual(c, again);
  assert.equal(solidContact(e, shifted(vec(), c), r), null);
});

// ---------- Integração: world.collideFighter (UMA chamada deve bastar) ----------
const PENETRATIONS = [
  ['parede fina, perto da linha central, na ponta longa', {kind: 'wall', pos: vec(), hx: 1.5, hz: .3, y: 0, height: 2.2}, vec(1.2, .05), 'z'],
  ['parede fina, centro exato', {kind: 'wall', pos: vec(), hx: 1.5, hz: .3, y: 0, height: 2.2}, vec(0, 0), 'z'],
  ['caixa grande, dentro perto da face', {kind: 'wall', pos: vec(), hx: 3, hz: 2, y: 0, height: 2.2}, vec(0, 1.8), 'z'],
  ['caixa girada 45°, dentro', {kind: 'wall', pos: vec(1, -2), angle: Math.PI / 4, hx: 1.2, hz: .35, y: 0, height: 2.2}, vec(1.1, -1.9), null],
];
for (const [name, spec, start, axis] of PENETRATIONS) {
  check(`lutador dentro de sólido sai pela face mais próxima em uma chamada: ${name}`, () => {
    const w = createWorld(), e = spawn(w, spec, []), f = fighter(start);
    assert.equal(collideFighter(w, f), 1);
    assert.ok(clearOf(e, f.position), `${name}: ainda penetra após uma chamada (${f.position.x.toFixed(3)}, ${f.position.z.toFixed(3)})`);
    // Deslocamento mínimo: a distância percorrida é a da face mais próxima + r (nunca a da ponta da parede).
    const local = toLocal(e, start), faceGap = Math.min(spec.hx - Math.abs(local.u), spec.hz - Math.abs(local.v));
    near(Math.hypot(f.position.x - start.x, f.position.z - start.z), faceGap + r, 1e-6);
    if (axis === 'z') near(f.position.x, start.x, 1e-9);   // sem deslocamento lateral ao longo da parede
    assert.equal(collideFighter(w, f), 0, `${name}: segunda chamada não pode mover de novo (jitter)`);
  });
}
check('círculo: lutador dentro sai em uma chamada', () => {
  const w = createWorld(), e = spawn(w, {kind: 'wall', shape: 'circle', pos: vec(), radius: 2, y: 0, height: 2.2}, []), f = fighter(vec(1, 0));
  collideFighter(w, f);
  assert.ok(clearOf(e, f.position));
  near(Math.hypot(f.position.x, f.position.z), 2 + r);
});
check('separação com movimento paralelo conservado (só a componente normal é removida)', () => {
  const w = createWorld();
  spawn(w, {kind: 'wall', pos: vec(), hx: 2, hz: .3, y: 0, height: 2}, []);
  const f = fighter(vec(0, .4));
  f.velocity = vec(3, -2);f.locomotionVelocity = vec(3, -2);
  assert.equal(collideFighter(w, f), 1);
  near(f.position.z, .3 + r);
  near(f.velocity.x, 3);near(f.velocity.z, 0);
  near(f.locomotionVelocity.x, 3);near(f.locomotionVelocity.z, 0);
  assert.equal(collideFighter(w, f), 0, 'contato não deve acumular jitter');
});
check('destruição: colisor morto ignorado antes da limpeza de entidades', () => {
  const w = createWorld(), e = spawn(w, {kind: 'barrier', owner: 1, blocksOwner: true, blocksFighters: true, pos: vec(), hx: 2, hz: 1, y: 0, height: 2}, []);
  const f = fighter(vec(0, 0));
  e.dead = true;
  assert.equal(collideFighter(w, f), 0);
  assert.deepEqual(f.position, vec(0, 0));
});
check('barreira: blocksOwner continua respeitado', () => {
  const w = createWorld();
  spawn(w, {kind: 'barrier', owner: 0, blocksOwner: false, blocksFighters: true, pos: vec(), hx: 1, hz: .2, y: 0, height: 2}, []);
  const owner = fighter(vec(), 0), enemy = fighter(vec(), 1);
  assert.equal(collideFighter(w, owner), 0);
  assert.equal(collideFighter(w, enemy), 1);
});
check('sólido em outra altura não colide', () => {
  // Sólido fora da faixa vertical do lutador não toca (sem colisão fantasma por cima ou por baixo).
  const w = createWorld();
  spawn(w, {kind: 'wall', pos: vec(), hx: 2, hz: 1, y: 5, height: 2}, []);
  const f = fighter(vec());
  assert.equal(collideFighter(w, f), 0);
  assert.deepEqual(f.position, vec());
});

check('breakByTackle: tackle quebra a barreira quebrável sem empurrar e sem contar como contato', () => {
  const w = createWorld(), e = spawn(w, {kind: 'barrier', owner: 1, blocksOwner: true, blocksFighters: true, breakableByTackle: true, pos: vec(), hx: 2, hz: 1, y: 0, height: 2}, []);
  const events = [], f = fighter(vec(0, .2));
  f.attributes = {...C.profiles.balanced};f.hp = 100;f.knockRecovery = 0;f.state = 'tackle';
  f.action = {kind: 'tackle', neutralized: false, heading: 0, elapsed: .1};
  assert.equal(collideFighter(w, f, events), 0);
  assert.equal(e.dead, true);
  assert.deepEqual(f.position, vec(0, .2), 'quebrar não pode empurrar');
  assert.equal(f.action, null);
  assert.ok(events.some(x => x.result === 'barrierBroken' && x.by === 'tackle'));
});
check('breakByTackle: tackle neutralizado NÃO quebra e a barreira empurra normalmente', () => {
  const w = createWorld(), e = spawn(w, {kind: 'barrier', owner: 1, blocksOwner: true, blocksFighters: true, breakableByTackle: true, pos: vec(), hx: 2, hz: 1, y: 0, height: 2}, []);
  const f = fighter(vec(0, 1.2));
  f.action = {kind: 'tackle', neutralized: true, heading: 0, elapsed: .1};
  assert.equal(collideFighter(w, f, []), 1);
  assert.equal(e.dead, undefined);
  assert.ok(clearOf(e, f.position));
});

console.log(`Colisões de sólidos XZ: ${tests} verificações aprovadas, ${failures.length} falhas.`);
if (failures.length) process.exit(1);
