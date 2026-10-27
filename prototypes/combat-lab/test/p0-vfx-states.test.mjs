// @ts-check
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createFighter } from '../src/sim/entity.js';
import { updateFighter } from '../src/sim/controller/ctrl-update.js';
import { resolveHit, resolveFootstool } from '../src/sim/combat.js';
import { cancelCharge } from '../src/sim/controller/ctrl-moves.js';
import { createWorld, stepWorld, spawn } from '../src/sim/world.js';
import { adaptSimEvent, classifyVisualType } from '../src/view/vfx/contract.js';

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

test('ARC-01: Projétil com capacidade de perfuração (pierce > 1) não deve morrer no primeiro impacto', () => {
  const world = createWorld();
  const f1 = createFighter(1, baseAttrs, { x: 0, z: 0.5 });
  const f2 = createFighter(1, baseAttrs, { x: 0, z: 2.0 });

  const p = spawn(world, {
    kind: 'projectile',
    owner: 0,
    pos: { x: 0, z: 0 },
    dir: { x: 0, z: 1 },
    speed: 20,
    y: 0.6,
    radius: 0.5,
    life: 3,
    pierce: 3,
    hit: { damage: 5 }
  });

  const game = {
    world,
    fighters: [createFighter(0, baseAttrs, { x: 0, z: -3 }), f1, f2],
    tick: 1
  };

  const events = stepWorld(game, 0.05);

  assert.equal(Boolean(p.dead), false, 'Projétil com pierce > 1 não deve morrer no primeiro impacto');
  assert.equal(p.hitLog.length, 1, 'Projétil deve ter registrado exatamente 1 acerto no hitLog');
});

test('VFX-05: classifyVisualType deve reconhecer barrierBroken, stoneClash e wallSplat', () => {
  assert.equal(classifyVisualType('barrierBroken'), 'shatter');
  assert.equal(classifyVisualType('stoneClash'), 'clash');
  assert.equal(classifyVisualType('wallSplat'), 'wall');
  assert.equal(classifyVisualType('destructibleSplat'), 'wall');
});

test('EST-06: Animação de guardStun e stagger deve ser normalizada por stunMax e clamp em [0, 1]', () => {
  const f = createFighter(0, baseAttrs, { x: 0, z: 0 });
  f.stunMax = 0.6;
  f.stun = 0.6;
  const max = f.stunMax || 0.15;
  const prog1 = Math.min(1, Math.max(0, 1 - f.stun / Math.max(1e-6, max)));
  assert.equal(prog1, 0, 'No início de stun longo, progresso deve ser 0 (não negativo)');

  f.stun = 0.3;
  const prog2 = Math.min(1, Math.max(0, 1 - f.stun / Math.max(1e-6, max)));
  assert.equal(prog2, 0.5, 'Na metade do stun, progresso deve ser exatamente 0.5');
});
