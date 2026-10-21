// Regression: solid-contact.js + world.collideFighter.
// Apenas casos de colisão XZ já existentes. As fases de CCD e plataforma 3D
// pertencem ao plano de overhaul, não a esta correção isolada.
import assert from 'node:assert/strict';
import {C, defaults, resetConfig} from '../src/sim/config.js';
import {vec} from '../src/sim/math.js';
import {toLocal, toWorld} from '../src/sim/geometry.js';
import {solidContact} from '../src/sim/solid-contact.js';
import {createWorld, spawn, collideFighter} from '../src/sim/world.js';

resetConfig(defaults());
const r = C.test.halfExtent;
const near = (a, b, tolerance = 1e-8) => assert.ok(Math.abs(a - b) < tolerance, `${a} ≉ ${b}`);
const shifted = (p, c) => c ? {x: p.x + c.normal.x * c.depth, z: p.z + c.normal.z * c.depth} : {...p};
const fighter = (p, id = 0) => ({id, position: {...p}, velocity: vec(), locomotionVelocity: vec(), flight: null, vaultHeight: 0, contacts: 0, action: null});
let tests = 0;const ok = x => {tests++;console.log('✓', x);};

// Contato tangente não causa impulso artificial nem acumula correções.
{
  const e = {shape: 'box', pos: vec(), hx: 2, hz: .3}, p = vec(0, .3 + r);
  assert.equal(solidContact(e, p, r), null);
  assert.equal(solidContact({shape: 'circle', pos: vec(), radius: 2}, vec(2 + r, 0), r), null);
  ok('contato tangente sem penetração não gera impulso');
}

// Inicialização DENTRO de uma caixa grande: expulsa até a face física, não r metros.
{
  const e = {shape: 'box', pos: vec(), hx: 3, hz: 2}, p = vec();
  const c = solidContact(e, p, r);assert.ok(c && c.inside);
  near(c.depth, 2 + r);
  const q = shifted(p, c);
  assert.equal(solidContact(e, q, r), null, 'disco precisa terminar FORA da caixa');
  ok('caixa: depenetração total de ponto interno, inclusive no centro');
}

// Caixa rotacionada: normal mínima no sistema local é convertida corretamente.
{
  const e = {shape: 'box', pos: vec(1, -2), angle: Math.PI / 4, hx: 1.2, hz: .35};
  const p = toWorld(e, .2, 0);
  const c = solidContact(e, p, r);assert.ok(c && c.inside);
  const q = toLocal(e, shifted(p, c));
  near(q.v, .35 + r);
  near(q.u, .2);
  assert.equal(solidContact(e, shifted(p, c), r), null);
  ok('caixa rotacionada: face local correta e sem atravessamento');
}

// Contato com canto: separar pelo vetor radial do canto, não por eixo arbitrário.
{
  const e = {shape: 'box', pos: vec(), hx: 2, hz: 2}, p = vec(2.25, 2.25);
  const c = solidContact(e, p, r);assert.ok(c && !c.inside);
  assert.ok(c.normal.x > 0 && c.normal.z > 0);
  assert.equal(solidContact(e, shifted(p, c), r), null);
  ok('canto externo da caixa: contato diagonal');
}

// Circulo: mesmo com centro do lutador já inserido, sair pelo raio + extents.
{
  for (const p of [vec(1, 0), vec(0, 0), vec(0, -1)]) {
    const e = {shape: 'circle', pos: vec(), radius: 2}, c = solidContact(e, p, r);
    assert.ok(c && c.inside);
    near(Math.hypot(shifted(p, c).x, shifted(p, c).z), 2 + r);
    assert.equal(solidContact(e, shifted(p, c), r), null);
  }
  ok('círculo: interior e centro profundo sem correção insuficiente');
}

// Integração com world: penetração corrigida, velocidade tangencial preservada.
{
  const w = createWorld();
  spawn(w, {kind: 'wall', pos: vec(), hx: 2, hz: .3, y: 0, height: 2}, []);
  const f = fighter(vec(0, .4));
  f.velocity = vec(3, -2);f.locomotionVelocity = vec(3, -2);
  assert.equal(collideFighter(w, f), 1);
  near(f.position.z, .3 + r);
  near(f.velocity.x, 3);near(f.velocity.z, 0);
  near(f.locomotionVelocity.x, 3);near(f.locomotionVelocity.z, 0);
  assert.equal(collideFighter(w, f), 0, 'contato não deve acumular jitter');
  ok('integração: separação e movimento paralelo conservados');
}

// Barreira destruída neste mesmo tick é imediatamente não-sólida.
{
  const w = createWorld(), e = spawn(w, {kind: 'barrier', owner: 1, blocksOwner: true, blocksFighters: true, pos: vec(), hx: 2, hz: 1, y: 0, height: 2}, []);
  const f = fighter(vec(0, 0));
  e.dead = true;
  assert.equal(collideFighter(w, f), 0);
  assert.deepEqual(f.position, vec(0, 0));
  ok('destruição: colisor morto ignorado antes da limpeza de entidades');
}

// Controle de proprietário das barreiras permanece idêntico.
{
  const w = createWorld();
  spawn(w, {kind: 'barrier', owner: 0, blocksOwner: false, blocksFighters: true, pos: vec(), hx: 1, hz: .2, y: 0, height: 2}, []);
  const owner = fighter(vec(), 0), enemy = fighter(vec(), 1);
  assert.equal(collideFighter(w, owner), 0);
  assert.equal(collideFighter(w, enemy), 1);
  assert.equal(solidContact(w.entities[0], enemy.position, r), null);
  ok('barreira: blocksOwner continua respeitado');
}

console.log(`Colisões de sólidos XZ: ${tests} verificações.`);
