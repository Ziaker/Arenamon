// Fase 1 do overhaul de colisões — lutador × obstáculos do mapa (map.collideMapFighter): depenetração sem pontos mortos.
// Origem: reprodução da Fase 0 sobre 4634ca2 (cilindro/pilar com o centro do lutador exatamente no centro do obstáculo
// não empurrava ninguém: o `d > 1e-6` descartava o contato e o lutador ficava preso dentro do sólido).
// Uso: node prototypes/combat-lab/test/collision-map.test.mjs
import assert from 'node:assert/strict';
import {C, defaults, resetConfig} from '../src/sim/config.js';
import {vec, length} from '../src/sim/math.js';
import {collideMapFighter} from '../src/sim/map.js';

resetConfig(defaults());
const r = C.test.halfExtent;
const fighter = p => ({id: 0, position: {...p}, velocity: vec(), locomotionVelocity: vec(), flight: null, vaultHeight: 0, groundY: 0, contacts: 0, action: null});
const world = obstacles => ({obstacles, platforms: [], destructibles: []});
let tests = 0;const failures = [];
// resetConfig(defaults()) não restaura valores alterados dentro de um teste (objetos aninhados compartilhados): cada verificação restaura o que mexeu.
const check = (name, fn) => {
  const keep = {map: {...C.map}, toggles: {...C.extras.toggles}};
  try {fn();tests++;console.log('✓', name);} catch (error) {failures.push(name);console.log('✗', name, '—', String(error.message).split(/\r?\n/)[0]);}
  finally {Object.assign(C.map, keep.map);Object.assign(C.extras.toggles, keep.toggles);}
};

for (const shape of ['cylinder', 'pillar']) {
  const o = {shape, pos: {x: 2, y: 0, z: -1}, radius: 1, height: 3};
  for (const [label, start] of [['exatamente no centro', vec(2, -1)], ['a 1e-7 do centro', vec(2 + 1e-7, -1)], ['dentro, perto da borda', vec(2.9, -1)]]) {
    check(`${shape}: lutador ${label} sai em uma chamada, até r + raio do centro`, () => {
      const f = fighter(start);
      collideMapFighter(world([o]), f, []);
      const d = Math.hypot(f.position.x - o.pos.x, f.position.z - o.pos.z);
      assert.ok(d >= o.radius + r - 1e-9, `ainda dentro: distância ${d.toFixed(4)} < ${(o.radius + r).toFixed(4)}`);
      assert.ok(Number.isFinite(f.position.x) && Number.isFinite(f.position.z));
      assert.equal(f.contacts, 1);
      const again = fighter(f.position);collideMapFighter(world([o]), again, []);
      assert.equal(again.contacts, 0, 'segunda chamada não pode mover de novo (jitter)');
    });
  }
}
check('cilindro: contato normal fora do centro continua empurrando radialmente e preservando a tangente', () => {
  const o = {shape: 'cylinder', pos: {x: 0, y: 0, z: 0}, radius: 1, height: 3}, f = fighter(vec(1.2, 0));
  f.velocity = vec(-2, 3);
  collideMapFighter(world([o]), f, []);
  assert.ok(Math.abs(f.position.x - (1 + r)) < 1e-9 && Math.abs(f.position.z) < 1e-9);
  // Só a componente que viola o contato é removida (como nas caixas): a tangente (z) fica intacta.
  assert.ok(Math.abs(f.velocity.x) < 1e-9, `velocidade para dentro do pilar ficou ${f.velocity.x}`);
  assert.ok(Math.abs(f.velocity.z - 3) < 1e-9);
});
check('cilindro: afastando-se do pilar a velocidade não é alterada', () => {
  const o = {shape: 'cylinder', pos: {x: 0, y: 0, z: 0}, radius: 1, height: 3}, f = fighter(vec(1.2, 0));
  f.velocity = vec(2, 1);
  collideMapFighter(world([o]), f, []);
  assert.deepEqual(f.velocity, vec(2, 1));
});
// ---------- Resposta física DIFERENCIADA por estado (R3.12, R3.7, R7.15; decisão do responsável de 21/10/2026) ----------
const pillar = () => ({shape: 'pillar', pos: {x: 0, y: 0, z: 0}, radius: 1, height: 3});
check('locomoção: remove só a componente que entra no pilar e preserva a tangente (sem rebote)', () => {
  const f = fighter(vec(1.2, 0));f.velocity = vec(-2, 3);
  collideMapFighter(world([pillar()]), f, []);
  assert.ok(Math.abs(f.velocity.x) < 1e-9 && Math.abs(f.velocity.z - 3) < 1e-9, JSON.stringify(f.velocity));
});
check('locomoção: o contato registra a normal da superfície para o controlador deslizar (sem travar)', () => {
  const f = fighter(vec(1.2, 0));f.velocity = vec(-2, 3);
  collideMapFighter(world([pillar()]), f, []);
  assert.equal(f.surfaceNormals.length, 1);
  assert.ok(Math.abs(f.surfaceNormals[0].x - 1) < 1e-12 && Math.abs(f.surfaceNormals[0].z) < 1e-12 && f.surfaceNormals[0].age === 0);
});
check('arremesso contra indestrutível (R3.12): rebote especular pelo ângulo, intensidade pela restituição, tangente preservada', () => {
  const f = fighter(vec(1.2, 0));f.flight = {y: 0, vy: -1, horizontal: vec(-5, 2)};f.launchedByHit = true;f.velocity = vec(-5, 2);
  const k = C.rules.wallRestitution * (C.map?.wallBounceMultiplier ?? 1);
  collideMapFighter(world([pillar()]), f, []);
  assert.ok(Math.abs(f.flight.horizontal.x - 5 * k) < 1e-9, `normal refletida: ${f.flight.horizontal.x} (esperado ${5 * k})`);
  assert.ok(Math.abs(f.flight.horizontal.z - 2) < 1e-9, 'tangente preservada');
  assert.deepEqual(f.velocity, f.flight.horizontal, 'a velocidade do voo segue o rebote nos subpassos restantes');
  assert.ok(Math.hypot(f.flight.horizontal.x, f.flight.horizontal.z) < Math.hypot(-5, 2), 'nunca ganha energia');
  assert.equal(f.surfaceNormals?.length ?? 0, 0, 'arremesso não alimenta o deslize da locomoção');
});
check('voos que NÃO são arremesso por golpe (queda de borda, Move Bounce) não rebatem: mantêm a própria velocidade', () => {
  for (const [name, flight] of [['queda de borda', {y: 0, vy: -1, horizontal: vec(-5, 2), isEdgeFall: true}], ['Move Bounce', {y: 0, vy: -1, horizontal: vec(-5, 2), bounce: {recovery: .3}}]]) {
    const f = fighter(vec(1.2, 0));f.flight = flight;f.velocity = vec(-5, 2);f.launchedByHit = true;   // flag obsoleta de um arremesso anterior (só é limpa no pouso)
    collideMapFighter(world([pillar()]), f, []);
    assert.deepEqual(f.flight.horizontal, vec(-5, 2), name);
    assert.ok(Math.abs(f.position.x - (1 + r)) < 1e-9, name);
  }
});
check('multiplicador 3 com a restituição padrão (3 × 0,28 = 0,84 ≤ 1): o arremesso não ganha energia', () => {
  C.map.wallBounceMultiplier = 3;
  const f = fighter(vec(1.2, 0));f.flight = {y: 0, vy: -1, horizontal: vec(-5, 2)};f.launchedByHit = true;
  collideMapFighter(world([pillar()]), f, []);
  assert.ok(Math.hypot(f.flight.horizontal.x, f.flight.horizontal.z) < Math.hypot(-5, 2));
});
check('fator de rebote limitado a 1 em pilares e caixas: com restituição 1 × multiplicador 3 (fator 3) o arremesso NUNCA sai mais rápido do que entrou', () => {
  const keepRestitution = C.rules.wallRestitution;
  try {
    C.rules.wallRestitution = 1;C.map.wallBounceMultiplier = 3;
    const speed = f => Math.hypot(f.flight.horizontal.x, f.flight.horizontal.z);
    for (const [name, obstacle, start] of [['pilar', pillar(), vec(1.2, 0)], ['caixa', {shape: 'box', pos: {x: 0, y: 0, z: 0}, hx: 1, hz: 1, height: 3}, vec(1.3, .4)]]) {
      const f = fighter(start);f.flight = {y: 0, vy: -1, horizontal: vec(-12, 4)};f.launchedByHit = true;f.velocity = vec(-12, 4);
      const before = speed(f);collideMapFighter(world([obstacle]), f, []);
      assert.ok(speed(f) <= before + 1e-9, `${name}: ganhou energia (${before.toFixed(2)} → ${speed(f).toFixed(2)})`);
      assert.ok(Math.abs(f.flight.horizontal.x - 12) < 1e-9, `${name}: a normal deveria sair com 100 % (reflexão total), saiu ${f.flight.horizontal.x}`);
      assert.ok(Math.abs(f.flight.horizontal.z - 4) < 1e-9, `${name}: tangente preservada`);
    }
  } finally {C.rules.wallRestitution = keepRestitution;}
});
check('abaixo do limite o fator continua valendo: restituição 0,28 × multiplicador 2 = 0,56 (não é cortado)', () => {
  C.map.wallBounceMultiplier = 2;
  const f = fighter(vec(1.2, 0));f.flight = {y: 0, vy: -1, horizontal: vec(-10, 0)};f.launchedByHit = true;f.velocity = vec(-10, 0);
  collideMapFighter(world([pillar()]), f, []);
  assert.ok(Math.abs(f.flight.horizontal.x - 10 * C.rules.wallRestitution * 2) < 1e-9, `saiu ${f.flight.horizontal.x}`);
});
check('arremesso afastando-se do pilar não é alterado', () => {
  const f = fighter(vec(1.2, 0));f.flight = {y: 0, vy: -1, horizontal: vec(5, 2)};f.launchedByHit = true;
  collideMapFighter(world([pillar()]), f, []);
  assert.deepEqual(f.flight.horizontal, vec(5, 2));
});
check('rebote desligado (enableWallBounce = 0): o arremesso apenas perde a parte que entra', () => {
  C.extras.toggles.enableWallBounce = 0;
  const f = fighter(vec(1.2, 0));f.flight = {y: 0, vy: -1, horizontal: vec(-5, 2)};f.launchedByHit = true;f.velocity = vec(-5, 2);
  collideMapFighter(world([pillar()]), f, []);
  assert.ok(Math.abs(f.flight.horizontal.x) < 1e-9 && Math.abs(f.flight.horizontal.z - 2) < 1e-9);
});
check('salto voluntário (isNormalJump) mantém flight.horizontal intacta; só a posição é corrigida', () => {
  const f = fighter(vec(1.2, 0));f.flight = {y: 0, vy: -1, horizontal: vec(-5, 2), isNormalJump: true};
  collideMapFighter(world([pillar()]), f, []);
  assert.deepEqual(f.flight.horizontal, vec(-5, 2));
  assert.ok(Math.abs(f.position.x - (1 + r)) < 1e-9);
});
check('ação especial (tackle/esquiva em curso): a velocidade da ação NÃO é alterada pelo pilar; só a posição', () => {
  for (const kind of ['tackle', 'dodge']) {
    const f = fighter(vec(1.2, 0));f.action = {kind, heading: Math.PI / 2, elapsed: .1};f.velocity = vec(-6, 1);
    collideMapFighter(world([pillar()]), f, []);
    assert.deepEqual(f.velocity, vec(-6, 1), kind);
    assert.ok(Math.abs(f.position.x - (1 + r)) < 1e-9, kind);
    assert.equal(f.surfaceNormals?.length ?? 0, 0, kind);
  }
});
check('pilar: lutador acima do topo (apoiado sobre ele) não sofre empurrão lateral', () => {
  const o = {shape: 'pillar', pos: {x: 0, y: 0, z: 0}, radius: 1, height: 1}, f = fighter(vec(.3, 0));
  f.groundY = 1;
  collideMapFighter(world([o]), f, []);
  assert.deepEqual(f.position, vec(.3, 0));
  assert.equal(f.contacts, 0);
});
check('pilar: centro exato resolve sempre na mesma direção (determinístico, compatível com o código anterior: +z)', () => {
  const o = {shape: 'cylinder', pos: {x: 0, y: 0, z: 0}, radius: 1, height: 3}, f = fighter(vec(0, 0));
  collideMapFighter(world([o]), f, []);
  assert.ok(Math.abs(f.position.x) < 1e-12 && Math.abs(f.position.z - (1 + r)) < 1e-9, JSON.stringify(f.position));
});


// ---------- Obstáculo em CAIXA (indestrutível): mesma regra por estado (R3.12) ----------
const box = () => ({shape: 'box', pos: {x: 0, y: 0, z: 0}, hx: 1, hz: 1, height: 3});
check('caixa: arremessado por golpe rebate pela normal da face (ângulo especular, restituição de parede) e nunca ganha energia', () => {
  const f = fighter(vec(1.3, .4));f.flight = {y: 0, vy: -1, horizontal: vec(-5, 2)};f.launchedByHit = true;f.velocity = vec(-5, 2);
  const k = C.rules.wallRestitution * (C.map?.wallBounceMultiplier ?? 1);
  collideMapFighter(world([box()]), f, []);
  assert.ok(Math.abs(f.flight.horizontal.x - 5 * k) < 1e-9, `normal refletida: ${f.flight.horizontal.x} (esperado ${5 * k})`);
  assert.ok(Math.abs(f.flight.horizontal.z - 2) < 1e-9, 'tangente preservada');
  assert.deepEqual(f.velocity, f.flight.horizontal);
  assert.ok(Math.hypot(f.flight.horizontal.x, f.flight.horizontal.z) < Math.hypot(-5, 2));
  assert.ok(Math.abs(f.position.x - (1 + r)) < 1e-9, 'posição corrigida na face');
});
check('caixa: face em z também rebate (eixo certo)', () => {
  const f = fighter(vec(.3, -1.3));f.flight = {y: 0, vy: -1, horizontal: vec(2, 6)};f.launchedByHit = true;f.velocity = vec(2, 6);
  const k = C.rules.wallRestitution * (C.map?.wallBounceMultiplier ?? 1);
  collideMapFighter(world([box()]), f, []);
  assert.ok(Math.abs(f.flight.horizontal.z + 6 * k) < 1e-9 && Math.abs(f.flight.horizontal.x - 2) < 1e-9, JSON.stringify(f.flight.horizontal));
});
check('caixa: queda de borda, Move Bounce e salto voluntário mantêm o comportamento anterior (sem rebote)', () => {
  const legacy = [{y: 0, vy: -1, horizontal: vec(-5, 2), isEdgeFall: true}, {y: 0, vy: -1, horizontal: vec(-5, 2), bounce: {recovery: .3}}];
  for (const flight of legacy) {
    const f = fighter(vec(1.3, .4));f.flight = flight;f.velocity = vec(-5, 2);f.launchedByHit = true;   // flag obsoleta (lançado → Meteor Slam → caiu da borda)
    collideMapFighter(world([box()]), f, []);
    assert.ok(Math.abs(f.flight.horizontal.x) < 1e-9 && Math.abs(f.flight.horizontal.z - 2) < 1e-9, JSON.stringify(f.flight.horizontal));
  }
  const j = fighter(vec(1.3, .4));j.flight = {y: 0, vy: -1, horizontal: vec(-5, 2), isNormalJump: true};
  collideMapFighter(world([box()]), j, []);
  assert.deepEqual(j.flight.horizontal, vec(-5, 2));
});
check('idempotência: depois de resolvido, uma 2ª chamada não conta contato nem move (caixa, plataforma e destrutível; ruído de ponto flutuante não vira contato)', () => {
  // Origem (fuzz de partidas da Fase 6): o reposicionamento na face deixava a sobreposição em +1e-16, a 2ª chamada contava contato de novo e o settleStatics nunca
  // convergia (12 rodadas → «conflito de espaço» falso, ~48 mil por 60 partidas), embora o lutador estivesse só encostado.
  let seedR = 12345;const rnd = () => (seedR = (seedR * 1664525 + 1013904223) >>> 0) / 4294967296;
  const defs = [
    ['caixa', () => ({obstacles: [{shape: 'box', pos: {x: 0.37, y: 0, z: -1.13}, hx: 1.5, hz: 1.0, height: 3}], platforms: [], destructibles: []})],
    ['plataforma', () => ({obstacles: [], platforms: [{id: 'p', pos: {x: -2.71, z: 3.29}, width: 3, depth: 3, height: 1}], destructibles: []})],
    ['destrutível', () => ({obstacles: [], platforms: [], destructibles: [{id: 'd', state: 'solid', hp: 30, maxHp: 30, pos: {x: 5.123, y: 0, z: 4.987}, size: {hx: .8, hz: .8, height: 1.6}, resistances: {}}]})],
  ];
  const bad = [];
  for (const [name, mk] of defs) for (let i = 0; i < 4000; i++) {
    const w = mk(), c = w.obstacles[0]?.pos ?? w.platforms[0]?.pos ?? w.destructibles[0].pos;
    const f = fighter(vec(c.x + (rnd() - .5) * 4.5, c.z + (rnd() - .5) * 4.5));
    collideMapFighter(w, f, []);
    f.contacts = 0;collideMapFighter(w, f, []);
    if (f.contacts !== 0) bad.push(`${name} #${i} (${f.position.x}, ${f.position.z})`);
  }
  assert.equal(bad.length, 0, `${bad.length} reposicionamentos não convergem; ex.: ${bad.slice(0, 2).join(' | ')}`);
});
check('caixa: locomoção continua zerando só a componente que entra (comportamento anterior preservado)', () => {
  const f = fighter(vec(1.3, .4));f.velocity = vec(-2, 3);
  collideMapFighter(world([box()]), f, []);
  assert.ok(Math.abs(f.velocity.x) < 1e-9 && Math.abs(f.velocity.z - 3) < 1e-9);
});

console.log(`Colisões de obstáculos do mapa: ${tests} verificações aprovadas, ${failures.length} falhas.`);
if (failures.length) process.exit(1);
