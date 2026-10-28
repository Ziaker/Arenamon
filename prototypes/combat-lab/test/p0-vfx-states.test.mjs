// @ts-check
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { createFighter } from '../src/sim/entity.js';
import { updateFighter } from '../src/sim/controller/ctrl-update.js';
import { resolveHit, resolveFootstool } from '../src/sim/combat.js';
import { cancelCharge } from '../src/sim/controller/ctrl-moves.js';
import { createWorld, stepWorld, spawn } from '../src/sim/world.js';
import { adaptSimEvent, classifyVisualType } from '../src/view/vfx/contract.js';
import { Character } from '../src/view/characters.js';
import { Particles } from '../../sand-stone-lab/src/particles.js';
import { onEvent as onSandWaveEvent } from '../src/sim/moves/sand-wave/sand-wave.vfx.js';
import { handlesFighter as handlesBulletPunch } from '../src/sim/moves/bullet-punch/bullet-punch.vfx.js';
import { Game } from '../src/sim/game.js';
import { clash } from '../src/sim/combat.js';
import { C } from '../src/sim/config.js';
import { VfxSystem } from '../src/view/vfx.js';

const baseAttrs = { hp: 100, attack: 10, defense: 10, speed: 10 };

test('EST-01: Fim de recuperação (knockRecovery <= 0) deve transicionar para neutral/moving, nunca hitstun', () => {
  const f = createFighter(0, baseAttrs, { x: 0, z: 0 });
  f.state = 'recoil';
  f.stun = 0;
  f.knockRecovery = 0.001; // quase acabando
  f.knockRecovering = true;
  f.recoveryKind = 'neutral';

  const inputs = { move: { x: 0, z: 0 }, attack: false, dodge: false, guard: false, jump: false };
  updateFighter(f, inputs, [f], 0.016); // avança além do knockRecovery

  assert.equal(f.knockRecovery, 0);
  assert.notEqual(f.state, 'hitstun', 'Lutador NUNCA deve cair em hitstun ao terminar recuperação de knockback');
  assert.equal(f.state, 'neutral');
});

test('EST-02: Guard Break não deve ser sobrescrito por recoil no bloqueio', () => {
  const attacker = createFighter(0, baseAttrs, { x: 0, z: 0 });
  const defender = createFighter(1, baseAttrs, { x: 0, z: 1.0 });

  attacker.action = { kind: 'move', guardBreak: { stun: 0.6 }, ticks: 10, totalTicks: 20 };
  attacker.attacking = true;
  defender.guard = true;
  defender.facing = Math.PI; // olhando para -Z, de frente para o atacante
  defender.state = 'guard';

  const normal = { x: 0, y: 0, z: 1 };
  const relative = { x: 0, y: 0, z: 5 };
  const hitEvent = resolveHit(attacker, defender, normal, relative, true);

  assert.ok(hitEvent, 'Deve emitir evento de combate');
  assert.ok(hitEvent.broken || hitEvent.guardBreak, 'Evento deve indicar quebra de guarda');
  assert.notEqual(attacker.action?.kind, 'recoil', 'Atacante com guardBreak não deve entrar em recoil de bloqueio');
  assert.equal(defender.state, 'stagger', 'Defensor deve entrar em stagger prolongado');
});

test('EST-03: resolveFootstool deve atualizar defender.state para stagger e emitir normal', () => {
  const attacker = createFighter(0, baseAttrs, { x: 0, z: 0 });
  const defender = createFighter(1, baseAttrs, { x: 0, z: 0 });
  defender.state = 'moving';

  const ev = resolveFootstool(attacker, defender);

  assert.ok(ev, 'Footstool deve ser resolvido e retornar evento');
  assert.equal(defender.state, 'stagger', 'Defensor deve entrar em stagger ao sofrer pisão');
  assert.equal(ev.result, 'footstool');
  assert.ok(ev.normal != null, 'Evento de footstool deve possuir vetor normal');
  assert.equal(ev.normal.y, -1, 'Normal de footstool deve apontar para baixo');
});

test('EST-04: cancelCharge não deve disparar TypeError se ch.params.step for ausente', () => {
  const f = createFighter(0, baseAttrs, { x: 0, z: 0 });
  f.charge = { ticks: 5, params: {} }; // sem propriedade step

  assert.doesNotThrow(() => {
    cancelCharge(f);
  }, 'cancelCharge deve lidar com params sem step sem lançar exceção');
});

test('EST-05: Lutador derrotado (hp <= 0) deve limpar flag absent e cargas', () => {
  const f = createFighter(0, baseAttrs, { x: 0, z: 0 });
  f.absent = true;
  f.charge = { ticks: 10 };
  f.hp = 0;

  const inputs = { move: { x: 0, z: 0 }, attack: false, dodge: false, guard: false, jump: false };
  updateFighter(f, inputs, [f], 0.016);

  assert.equal(f.absent, false, 'Lutador KO não pode permanecer absent (invisível)');
  assert.equal(f.charge, null, 'Carga deve ser cancelada no KO');
});

test('EST-06: Character real normaliza guardStun e stagger por stunMax sem travar no frame 0', () => {
  const f = createFighter(0, baseAttrs, { x: 0, z: 0 });
  f.stunMax = 0.6;
  f.stun = 0.6;

  // Instância simulada de Character executando o método real progress()
  const char = Object.create(Character.prototype);
  char.clock = 0;

  const progStart = char.progress(f, 'guardStun');
  assert.equal(progStart, 0, 'No início de stun longo de 0.6s, progresso deve ser 0 (não negativo)');

  f.stun = 0.3;
  const progMid = char.progress(f, 'guardStun');
  assert.equal(progMid, 0.5, 'Na metade do stun, progresso deve ser exatamente 0.5');

  f.stun = 0;
  const progEnd = char.progress(f, 'guardStun');
  assert.equal(progEnd, 1.0, 'No final do stun, progresso deve ser 1.0');
});

test('VFX-01: Projétil quebrando barreira deve emitir evento com posição e normal válidos', () => {
  const world = createWorld();
  spawn(world, {
    kind: 'barrier',
    owner: 1,
    shape: 'box',
    pos: { x: 0, z: 0 },
    angle: 0,
    hx: 1,
    hz: 0.1,
    y: 0,
    height: 2,
    life: 5,
    hp: 5,
    blocksProjectiles: true,
    blocksFighters: true
  });

  spawn(world, {
    kind: 'projectile',
    owner: 0,
    pos: { x: 0, z: -0.5 },
    dir: { x: 0, z: 1 },
    speed: 20,
    y: 0.6,
    radius: 0.25,
    life: 3,
    hit: { damage: 10 }
  });

  const game = {
    world,
    fighters: [createFighter(0, baseAttrs, { x: 0, z: -3 }), createFighter(1, baseAttrs, { x: 0, z: 3 })],
    tick: 1
  };

  const events = stepWorld(game, 0.05);

  const barrierEv = events.find(e => e.result === 'barrierBroken');
  assert.ok(barrierEv, 'Deve emitir evento barrierBroken');
  assert.ok(Number.isFinite(barrierEv.x) || Number.isFinite(barrierEv.position?.x), 'Evento deve conter coordenada X');
  assert.ok(Number.isFinite(barrierEv.z) || Number.isFinite(barrierEv.position?.z), 'Evento deve conter coordenada Z');
});

test('ARC-01: Projétil com pierce=2 atravessa dois inimigos reais consecutivos antes de morrer', () => {
  const world = createWorld();
  const f1 = createFighter(1, baseAttrs, { x: 0, z: 1.0 });
  const f2 = createFighter(2, baseAttrs, { x: 0, z: 3.5 });

  const p = spawn(world, {
    kind: 'projectile',
    owner: 0,
    pos: { x: 0, z: 0 },
    dir: { x: 0, z: 1 },
    speed: 20,
    y: 0.6,
    radius: 0.3,
    life: 3,
    pierce: 2,
    hit: { damage: 5 }
  });

  const game = {
    world,
    fighters: [createFighter(0, baseAttrs, { x: 0, z: -3 }), f1, f2],
    tick: 1
  };

  // 1º passo: anda 1.2m e atinge f1 (z=1.0)
  stepWorld(game, 0.06);
  assert.equal(Boolean(p.dead), false, 'Após 1º impacto, projétil com pierce=2 DEVE permanecer vivo');
  assert.equal(p.hitLog.length, 1, 'Deve registrar o 1º acerto');
  assert.equal(p.hitLog[0], f1.id, '1º acerto deve ser no lutador f1');

  // 2º passo: anda mais 2.6m e atinge f2 (z=3.5)
  stepWorld(game, 0.13);
  assert.equal(p.dead, true, 'Após 2º impacto, projétil com pierce=2 atinge o limite e DEVE morrer');
  assert.equal(p.hitLog.length, 2, 'Deve ter registrado exatamente 2 acertos');
  assert.ok(p.hitLog.includes(f2.id), '2º acerto deve ser no lutador f2');
});

test('VFX-05: Eventos desconhecidos NÃO viram impactos de golpe (retornam null)', () => {
  assert.equal(classifyVisualType('barrierBroken'), 'shatter');
  assert.equal(classifyVisualType('stoneClash'), 'clash');
  assert.equal(classifyVisualType('wallSplat'), 'wall');
  assert.equal(classifyVisualType('destructibleSplat'), 'wall');
  assert.equal(classifyVisualType('evento_totalmente_desconhecido'), null, 'Evento desconhecido DEVE retornar null');

  const adapted = adaptSimEvent({ tick: 1, attacker: 0, target: 1, result: 'evento_totalmente_desconhecido' });
  assert.equal(adapted, null, 'adaptSimEvent deve ignorar eventos com tipo visual nulo');
});

test('VFX: Impacto do Sand Wave instancia partículas reais via three.quarks', () => {
  const scene = new THREE.Scene();
  const particles = new Particles(scene, { textures: false });
  const state = { particles, pos: { x: 0, z: 0 }, dir: { x: 0, z: 1 }, len: 4, y: 0.5 };

  assert.equal(particles.systems.length, 0, 'Inicialmente sem sistemas de partículas');

  onSandWaveEvent(null, { result: 'impact', x: 0, y: 0.5, z: 2.0 }, state);

  assert.ok(particles.systems.length > 0, 'onEvent deve instanciar sistema de partículas');
  particles.update(0.016);
  assert.ok(particles.count > 0, 'Partículas ativas devem ser maiores que zero após emissão de impacto');
});

test('VFX: Clash iniciado pelo Jogador 2 (attacker: 1) gera efeito de choque simétrico', () => {
  const scene = new THREE.Scene();
  const vfx = new VfxSystem(scene);
  let clashFired = false;
  vfx.fire = (type) => {
    if (type === 'clash') clashFired = true;
  };
  vfx.shake = () => {};

  const fighters = [createFighter(0, baseAttrs, { x: 0, z: -1 }), createFighter(1, baseAttrs, { x: 0, z: 1 })];
  const events = [{ result: 'clash', attacker: 1, target: 0, normal: { x: 0, y: 0, z: 1 }, tick: 10 }];

  vfx.update(fighters, events, 0.016);

  assert.equal(clashFired, true, 'Clash iniciado pelo Jogador 2 DEVE disparar o efeito visual de clash');
});

test('VFX: Dois clashes independentes no mesmo tick são ambos preservados, e duplicatas mútuas geram 1 único efeito', () => {
  const scene = new THREE.Scene();
  const vfx = new VfxSystem(scene);
  const clashes = [];
  vfx.fire = (type, data) => {
    if (type === 'clash') clashes.push(data);
  };
  vfx.shake = () => {};

  const fighters = [
    createFighter(0, baseAttrs, { x: -5, z: 0 }),
    createFighter(1, baseAttrs, { x: -3, z: 0 }),
    createFighter(2, baseAttrs, { x: 5, z: 0 }),
    createFighter(3, baseAttrs, { x: 7, z: 0 })
  ];

  // Tick 20: Confronto 1 (0 e 1) emitido por AMBOS os lados (duplicata simétrica)
  // E confronto 2 (2 e 3) independente no MESMO tick!
  const events = [
    { result: 'clash', attacker: 0, target: 1, normal: { x: 1, y: 0, z: 0 }, tick: 20 },
    { result: 'clash', attacker: 1, target: 0, normal: { x: -1, y: 0, z: 0 }, tick: 20 },
    { result: 'clash', attacker: 2, target: 3, normal: { x: 1, y: 0, z: 0 }, tick: 20 }
  ];

  vfx.update(fighters, events, 0.016);

  assert.equal(clashes.length, 2, 'Dois confrontos distintos no mesmo tick devem gerar exatamente 2 efeitos, descartando a duplicata 1->0');
  assert.equal(clashes[0].pos.x, -4, 'Ponto de contato do clash 0-1 deve ser no meio (-4)');
  assert.equal(clashes[1].pos.x, 6, 'Ponto de contato do clash 2-3 deve ser no meio (6)');
});

test('VFX Sand Wave: Coordenadas mundiais são convertidas canonicamente para o espaço local de group', () => {
  const scene = new THREE.Scene();
  const group = new THREE.Group();
  scene.add(group);

  // Group posicionado no mundo com offset em X=5 e Z=10, rotacionado 90 graus (Math.PI/2)
  group.position.set(5, 0, 10);
  group.rotation.y = Math.PI / 2;
  group.updateWorldMatrix(true, true);

  const particles = new Particles(group, { textures: false });
  const state = {
    group,
    particles,
    pos: { x: 5, z: 10 },
    dir: { x: 1, z: 0 },
    len: 4,
    y: 0
  };

  // Alvo atingido na coordenada mundial (x=7, y=0.5, z=10)
  onSandWaveEvent(null, { result: 'impact', x: 7, y: 0.5, z: 10 }, state);

  assert.equal(particles.systems.length, 1, 'Deve criar 1 sistema de partículas');
  const emitter = particles.systems[0].emitter;
  group.updateWorldMatrix(true, true);
  emitter.updateMatrixWorld(true);

  const worldPos = new THREE.Vector3();
  emitter.getWorldPosition(worldPos);

  // A posição final do emissor no mundo DEVE coincidir exatamente com a coordenada mundial do impacto!
  assert.ok(Math.abs(worldPos.x - 7) < 1e-4, `X de mundo (${worldPos.x}) deve ser 7`);
  assert.ok(Math.abs(worldPos.y - 0.5) < 1e-4, `Y de mundo (${worldPos.y}) deve ser 0.5`);
  assert.ok(Math.abs(worldPos.z - 10) < 1e-4, `Z de mundo (${worldPos.z}) deve ser 10`);
});


test('DET-01: Determinismo de contactId em Clash durante Game.save() e Game.load()', () => {
  const game = new Game();
  game.reset();

  const f0 = game.fighters[0];
  const f1 = game.fighters[1];

  // 1º Clash gera contactId = 1
  const ev1 = clash(f0, f1, { x: 0, y: 0, z: 1 }, game.world);
  assert.equal(ev1[0].contactId, 1);
  assert.equal(ev1[1].contactId, 1);

  // 2º Clash gera contactId = 2
  const ev2 = clash(f0, f1, { x: 0, y: 0, z: 1 }, game.world);
  assert.equal(ev2[0].contactId, 2);

  // Snapshot do jogo gravado no momento de contactId = 2
  const snapshot = game.save();

  // Avança na simulação: 3º Clash gera contactId = 3
  const ev3 = clash(f0, f1, { x: 0, y: 0, z: 1 }, game.world);
  assert.equal(ev3[0].contactId, 3);

  // Restaura o snapshot anterior
  game.load(snapshot);

  // O próximo clash após load DEVE reproduzir deterministicamente contactId = 3, não avançar para 4!
  const evPostLoad = clash(f0, f1, { x: 0, y: 0, z: 1 }, game.world);
  assert.equal(evPostLoad[0].contactId, 3, 'Save/Load deve restaurar a sequência exata de clashContactSeq');
  assert.equal(evPostLoad[1].contactId, 3);
});

test('VFX: Bullet Punch handlesFighter: atelierVfx canônico, enableAtelierVfx só como legado', () => {
  C.world ??= {};
  C.world.bulletPunch ??= {};

  const fighter = {
    action: { move: 'bullet-punch', kind: 'action' }
  };

  // 1. Padrão: atelierVfx = 1
  C.world.bulletPunch.atelierVfx = 1;
  delete C.world.bulletPunch.enableAtelierVfx;
  assert.equal(handlesBulletPunch(fighter), true, 'Com atelierVfx=1 o rush do Bullet Punch deve estar ativo');

  // 2. Toggle via slider atelierVfx = 0 desativa o rush
  C.world.bulletPunch.atelierVfx = 0;
  assert.equal(handlesBulletPunch(fighter), false, 'Com atelierVfx=0 o rush do Bullet Punch DEVE ser desativado');

  // 3. F5: `atelierVfx` é a fonte canônica; o nome antigo `enableAtelierVfx` só vale quando a canônica não existe (presets antigos são migrados na leitura)
  C.world.bulletPunch.atelierVfx = 1;
  C.world.bulletPunch.enableAtelierVfx = 0;
  assert.equal(handlesBulletPunch(fighter), true, 'Com a canônica atelierVfx=1, o nome antigo não desliga o rush');
  delete C.world.bulletPunch.atelierVfx;
  assert.equal(handlesBulletPunch(fighter), false, 'Sem a canônica, enableAtelierVfx=0 (legado) desativa o rush');

  // Restaura padrão
  C.world.bulletPunch.atelierVfx = 1;
  delete C.world.bulletPunch.enableAtelierVfx;
});
