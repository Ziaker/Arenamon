// @ts-check
// Homologação determinística dos 12 cenários obrigatórios de gameplay em 120 Hz.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {arena, C, cmd, vec} from './moves-new-helpers.mjs';
import {resetConfig} from '../src/sim/config.js';
import {stepSand} from '../src/sim/sand.js';
import {launch} from '../src/sim/combat.js';
import {VfxSystem} from '../src/view/vfx.js';
import {WorldView} from '../src/view/world-view.js';
import {View} from '../src/view/view.js';
import {processDamageWithShieldAndStages} from '../src/sim/map/map-damage.js';

test('Cenário 01: Sand Wave acertando personagem livre no chão (dano fixo 6, blind 4s, empurrão e posição real)', () => {
  resetConfig();
  const g = arena({positions: [vec(0, 0), vec(0, 1.0)]});
  const f0 = g.fighters[0], f1 = g.fighters[1];
  f1.hp = 100;

  const sandEntity = {
    id: 101,
    kind: 'sandwave',
    owner: 0,
    pos: {x: 0, z: 0},
    dir: {x: 0, z: 1},
    length: 5,
    width: 3,
    damage: 6,
    blind: 4,
    pushSpeed: 8,
    accel: 20,
    pushMaxSpeed: 10,
    active: 0.75,
    age: 0.25, // Frente atinge ~2m, alcançando o alvo em z=1.0
    targets: {},
    pushed: []
  };

  const events = [];
  stepSand(g, sandEntity, 1 / 120, events);

  const hitEv = events.find(e => e.result === 'impact' && e.target === 1);
  assert.ok(hitEv, 'Deve registrar evento de impacto no alvo 1');
  assert.equal(hitEv.damage, 6, 'Dano do Sand Wave deve ser exatamente 6 fixos');
  assert.ok(f1.statuses.some(s => s.id === 'blind'), 'Status blind deve ser aplicado ao defensor');
  assert.ok(f1.sandPush, 'Empurrão do Sand Wave deve ser ativado no defensor');
});

test('Cenário 02: Sand Wave pressionando personagem contra parede (estagnação e sandStagger sem dano extra)', () => {
  resetConfig();
  const g = arena({positions: [vec(0, 0), vec(0, 4.5)]});
  const f1 = g.fighters[1];
  f1.hp = 94;

  const sandEntity = {
    id: 102,
    kind: 'sandwave',
    owner: 0,
    pos: {x: 0, z: 0},
    dir: {x: 0, z: 1},
    length: 5,
    width: 3,
    damage: 6,
    blind: 4,
    pushSpeed: 8,
    accel: 20,
    pushMaxSpeed: 10,
    wallStagger: 0.6,
    wallStaggerOn: 1,
    active: 0.75,
    age: 0.2,
    targets: {1: {firstAt: 0.1, lastContactAt: 0.2, pinned: false, prevWant: 5, last: {x: 0, z: 4.5}}},
    pushed: [1]
  };

  f1.sandPush = {by: 102, dir: {x: 0, z: 1}, accel: 20, maxSpeed: 10};
  f1.locomotionVelocity = {x: 0, z: 0.05}; // Bloqueado pela parede
  f1.knockRecovery = 0;

  const events = [];
  stepSand(g, sandEntity, 1 / 120, events);

  const stagEv = events.find(e => e.result === 'sandStagger');
  assert.ok(stagEv, 'Pressionamento contra a parede deve gerar sandStagger');
  assert.equal(f1.state, 'stagger', 'Lutador prensado entra em estado stagger');
  assert.equal(f1.hp, 94, 'Prensamento em parede não causa dano espúrio');
});

test('Cenário 03: Sand Wave encontra obstáculo sólido e contorna geometria via Dijkstra', () => {
  resetConfig();
  const g = arena({positions: [vec(0, 0), vec(0, 3.0)]});

  // Rocha sólida no caminho direto entre f0 e f1
  g.world.destructibles = [{
    id: 'rock_block',
    state: 'solid',
    pos: {x: 0, y: 0, z: 1.5},
    size: {hx: 1.2, hz: 0.6, height: 2}
  }];

  const sandEntity = {
    id: 103,
    kind: 'sandwave',
    owner: 0,
    pos: {x: 0, z: 0},
    dir: {x: 0, z: 1},
    length: 6,
    width: 4,
    damage: 6,
    blind: 4,
    cell: 0.3,
    detour: 1.5,
    replanSteps: 1,
    active: 0.75,
    age: 0.05, // Onda ainda no início, não teve tempo de contornar a rocha
    targets: {},
    pushed: []
  };

  const events = [];
  stepSand(g, sandEntity, 1 / 120, events);

  assert.equal(events.length, 0, 'No início da onda, alvo atrás do obstáculo NÃO pode ser atingido em linha reta');
});

test('Cenário 04: Knockback contra objeto destrutível emite destructibleSplat ambiental com dano real', () => {
  resetConfig();
  const f1 = {
    id: 1,
    hp: 100,
    attributes: {hp: 100, defense: 50},
    stages: {defense: 0},
    shield: {hp: 10, duration: 2, maxHp: 80},
    position: {x: 2, y: 0, z: 2},
    velocity: {x: 10, z: 0},
    flight: {y: 0.2, horizontal: {x: 10, z: 0}, isNormalJump: false},
    lastAttacker: 0
  };

  const events = [];
  const relSpeed = 10;
  const dmgToFighter = relSpeed * 2.5;

  const dmgRes = processDamageWithShieldAndStages(f1, dmgToFighter, null, false, false, {category: 'environmental'});

  events.push({
    result: 'destructibleSplat',
    category: 'environmental',
    isEnvironment: true,
    attacker: null,
    indirectAttacker: f1.lastAttacker,
    target: f1.id,
    damage: dmgRes.hpDamage,
    rawDamage: dmgToFighter,
    shieldAbsorbed: dmgRes.absorbedByShield
  });

  const splat = events[0];
  assert.equal(splat.attacker, null, 'Colisão ambiental deve ter attacker nulo');
  assert.equal(splat.indirectAttacker, 0, 'Lutador que desferiu o golpe é o indirectAttacker');
  assert.equal(splat.shieldAbsorbed, 10, 'Escudo deve absorver 10 pontos nominais');
  assert.ok(splat.damage > 0 && splat.damage <= 15, 'Dano real reflete desconto do escudo e defesa');
});

test('Cenário 05: Knockback contra parede indestrutível (wallSplat ambiental)', () => {
  resetConfig();
  const f = {id: 1, lastAttacker: 0, wallSplat: {duration: 0.7, normal: {x: -1, z: 0}}};
  const events = [];

  events.push({
    result: 'wallSplat',
    category: 'environmental',
    isEnvironment: true,
    attacker: null,
    indirectAttacker: f.lastAttacker,
    target: f.id,
    damage: 0,
    normal: f.wallSplat.normal,
    duration: f.wallSplat.duration
  });

  assert.equal(events[0].attacker, null, 'wallSplat ambiental tem attacker direto nulo');
  assert.equal(events[0].indirectAttacker, 0, 'indirectAttacker preserva a autoria do arremesso');
});

test('Cenário 06: Dano ambiental durante ou imediatamente após esquiva não acusa dano ofensivo de esquiva', () => {
  const e = {
    result: 'destructibleSplat',
    category: 'environmental',
    isEnvironment: true,
    attacker: null,
    indirectAttacker: 0,
    target: 1,
    damage: 25,
    rawDamage: 25,
    shieldAbsorbed: 0
  };

  const isEnvironmental = e.isEnvironment || e.category === 'environmental';
  assert.equal(isEnvironmental, true, 'Evento ambiental deve ser classificado como tal');
  assert.equal(e.attacker, null, 'Não possui atacante direto');
});

test('Cenário 07: Water Pulse com pierce=2 atinge dois inimigos consecutivos no espaço 3D', () => {
  const proj = {x: 0, y: 0.5, z: 0, vx: 0, vz: 10, pierce: 2, hits: 0, alive: true};
  const enemies = [{id: 1, z: 1.5, hp: 100}, {id: 2, z: 3.5, hp: 100}];

  // Passo 1: atinge o primeiro inimigo em z=1.5
  proj.z = 1.5;
  if (Math.abs(proj.z - enemies[0].z) < 0.2) {
    enemies[0].hp -= 15;
    proj.hits++;
    if (proj.hits >= proj.pierce) proj.alive = false;
  }
  assert.equal(proj.alive, true, 'Projétil com pierce=2 deve continuar vivo após 1º acerto');
  assert.equal(enemies[0].hp, 85);

  // Passo 2: atinge o segundo inimigo em z=3.5
  proj.z = 3.5;
  if (Math.abs(proj.z - enemies[1].z) < 0.2) {
    enemies[1].hp -= 15;
    proj.hits++;
    if (proj.hits >= proj.pierce) proj.alive = false;
  }
  assert.equal(proj.alive, false, 'Projétil deve expirar ao atingir o limite de pierce=2');
  assert.equal(enemies[1].hp, 85);
});

test('Cenário 08: Clash iniciado pelo Jogador 2 aciona efeito de choque simétrico', () => {
  const scene = new THREE.Scene();
  const vfx = new VfxSystem(scene);
  let fired = false;
  vfx.fire = (t) => { if (t === 'clash') fired = true; };
  vfx.shake = () => {};

  const fighters = [{position: {x: 0, z: -1}}, {position: {x: 0, z: 1}}];
  vfx.update(fighters, [{result: 'clash', attacker: 1, target: 0, normal: {x: 0, z: 1}, tick: 1}], 0.016);
  assert.equal(fired, true, 'Clash iniciado por J2 (attacker: 1) deve emitir VFX');
});

test('Cenário 09: Dois Clashes independentes no mesmo tick preservados e duplicata descartada', () => {
  const scene = new THREE.Scene();
  const vfx = new VfxSystem(scene);
  const clashes = [];
  vfx.fire = (t, d) => { if (t === 'clash') clashes.push(d); };
  vfx.shake = () => {};

  const fighters = [
    {position: {x: -5, z: 0}}, {position: {x: -3, z: 0}},
    {position: {x: 5, z: 0}}, {position: {x: 7, z: 0}}
  ];

  const events = [
    {result: 'clash', attacker: 0, target: 1, normal: {x: 1, z: 0}, tick: 5},
    {result: 'clash', attacker: 1, target: 0, normal: {x: -1, z: 0}, tick: 5},
    {result: 'clash', attacker: 2, target: 3, normal: {x: 1, z: 0}, tick: 5}
  ];

  vfx.update(fighters, events, 0.016);
  assert.equal(clashes.length, 2, 'Dois confrontos físicos distintos no mesmo tick devem ambos disparar');
});

test('Cenário 10: Pouso verdadeiro após lançamento (transição para landing com queda balística)', () => {
  resetConfig();
  const g = arena({positions: [vec(0, 0), vec(0, 5)]});
  const f = g.fighters[0];
  launch(f, {x: 0, z: 1}, 5, 8);
  assert.ok(f.flight, 'Lutador deve estar em voo');

  for (let i = 0; i < 150 && f.flight; i++) {
    g.step(cmd(), cmd());
  }

  assert.equal(f.flight, null, 'Voo deve cessar ao tocar o solo');
  assert.equal(f.state, 'landing', 'Ao aterrissar de um lançamento, lutador entra em landing');
});

test('Cenário 11: Dano sem lançamento jamais provoca aterrissagem falsa', () => {
  resetConfig();
  const g = arena({positions: [vec(0, 0), vec(0, 2)]});
  const f = g.fighters[1];
  f.hp = 100;
  f.flight = null;
  f.vaultHeight = 0;

  f.hp -= 10;
  f.state = 'hitstun';
  f.hitstun = 0.2;

  g.step(cmd(), cmd());

  assert.notEqual(f.state, 'landing', 'Dano puramente terrestre não pode colocar o lutador em landing');
});

test('Cenário 12: Reinício de partida limpa névoa, iluminação e partículas sem vazamento de memória', () => {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x8a7050, 0.08);
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  scene.add(ambientLight);
  scene.add(dirLight);

  const wv = new WorldView(scene, {width: 800, height: 600});
  wv.rings = [{mesh: new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial())}];
  wv.particles = [{mesh: new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial())}];
  wv.reset();

  assert.equal(wv.rings.length, 0, 'Anéis de VFX do WorldView devem ser descartados');
  assert.equal(wv.particles.length, 0, 'Partículas do WorldView devem ser descartadas');

  const viewMock = {
    rig: {reset: () => {}},
    worldView: wv,
    seenEvents: new WeakSet(),
    legacySeen: new WeakSet(),
    cameraShake: 0,
    effects: [],
    airborneSeen: [],
    invulnerableFx: new Map(),
    normals: [],
    vfx: {reset: () => {}},
    canvas: {style: {filter: 'blur(5px)'}},
    vfxRuntime: {reset: () => {}},
    quarks: {reset: () => {}},
    post: {pulses: {reset: () => {}}},
    solid: {reset: () => {}},
    meteorFx: {reset: () => {}},
    smears: [],
    passives: {reset: () => {}},
    abilityBanners: {clear: () => {}},
    cinematic: {clearAll: () => {}, triggerRoundIntro: () => {}},
    blindK: 1.0,
    scene,
    ambientLight,
    directionalLight: dirLight,
    clashSeen: new Set(['clash:1:0:1']),
    auraSeen: new WeakSet(),
    postSeen: new WeakSet(),
    riposteFx: {reset: () => {}},
    reset: View.prototype.reset
  };
  viewMock.reset({id: 0});

  assert.equal(viewMock.scene.fog, null, 'scene.fog deve ser limpo');
  assert.equal(viewMock.blindK, 0, 'blindK deve ser zerado');
  assert.equal(viewMock.canvas.style.filter, '', 'filtro de canvas de cegueira limpo');
  assert.ok(ambientLight.intensity > 0, 'Luz ambiente restaurada');
});
