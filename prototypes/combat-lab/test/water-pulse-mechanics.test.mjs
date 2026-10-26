// @ts-check
import {assert, C, cmd, vec, secs, suite, arena, HOLD} from './moves-new-helpers.mjs';

const {test, done} = suite('WATER PULSE MECÂNICA E PL1–PL3 (PILOTO 03)');

test('Raio físico vs Escala visual: visualScale NÃO altera o colisor físico, enquanto o slider radius altera', () => {
  // O lutador tem meia-largura hx = 0,5 m.
  // Com raio físico padrão de 0,38 m, a distância máxima de contato no eixo X é 0,38 + 0,5 = 0,88 m.
  // Colocando o alvo em x = 1,0 m (além de 0,88 m):
  {
    const g = arena({
      equip: ['water-pulse'],
      positions: [vec(0, -2), vec(1.0, 2)],
      setup: () => {
        // Escala visual máxima em PL3 com bônus dobrado
        C.world.waterPulse.plScaleBonus = 1.0;
        C.world.waterPulse.radius = 0.38;
      }
    });
    // Dispara em PL3 (185 ticks de carga)
    g.step(cmd({skill: 0, skillHeld: HOLD(0)}), cmd());
    for (let i = 1; i <= 185; i++) g.step(cmd({skillHeld: HOLD(0)}), cmd());
    g.step(cmd(), cmd()); // solta
    for (let i = 186; i < secs(2.5); i++) g.step(cmd(), cmd());

    // Não deve atingir porque o raio físico é 0,38 m (alcance máx 0,88 m < 1,0 m), mesmo que visualScale seja enorme
    assert.equal(g.fighters[1].hp, 100, 'visualScale não deve aumentar a hitbox física');
  }

  // Agora aumentando o RAIO FÍSICO real para 0.60 m (alcance máx 0,60 + 0,5 = 1,10 m > 1,0 m)
  {
    const g = arena({
      equip: ['water-pulse'],
      positions: [vec(0, -2), vec(1.0, 2)],
      setup: () => {
        C.world.waterPulse.radius = 0.60;
      }
    });
    // Dispara em PL1 (toque rápido)
    g.step(cmd({skill: 0, skillHeld: HOLD(0)}), cmd());
    g.step(cmd(), cmd());
    for (let i = 2; i < secs(2); i++) g.step(cmd(), cmd());

    // Com raio físico 0.60 m, o projétil atinge o alvo em x=1.0 m
    assert.ok(g.fighters[1].hp < 100, `raio físico aumentado deve acertar o alvo lateral (hp=${g.fighters[1].hp})`);
    C.world.waterPulse.radius = 0.38;
    C.world.waterPulse.plScaleBonus = 0.25;
  }
});

test('Knockback vertical: knockbackV = 0 mantém alvo no chão, knockbackV = 5 lança o alvo em voo', () => {
  // Teste 1: V = 0
  let flightA = null;
  {
    const g = arena({equip: ['water-pulse'], positions: [vec(0, -2), vec(0, 2)]});
    g.step(cmd({skill: 0, skillHeld: HOLD(0)}), cmd());
    g.step(cmd(), cmd());
    for (let i = 2; i < secs(1.5); i++) {
      g.step(cmd(), cmd());
      if (g.fighters[1].flight) flightA = g.fighters[1].flight;
    }
  }
  assert.equal(flightA, null, 'com V=0 o alvo não entra em voo');

  // Teste 2: V = 5
  let flightB = null;
  {
    const g = arena({
      equip: ['water-pulse'],
      positions: [vec(0, -2), vec(0, 2)],
      setup: () => {
        C.world.waterPulse.knockbackV = 5;
      }
    });
    g.step(cmd({skill: 0, skillHeld: HOLD(0)}), cmd());
    g.step(cmd(), cmd());
    for (let i = 2; i < secs(1.5); i++) {
      g.step(cmd(), cmd());
      if (g.fighters[1].flight) flightB = {...g.fighters[1].flight};
    }
    C.world.waterPulse.knockbackV = 0;
  }
  assert.ok(flightB !== null && flightB.y > 0, 'com V=5 o alvo é lançado em voo');
});

test('Progressão PL1, PL2 e PL3: dano cresce 6 -> 9 -> 12 HP e empurrão cresce 3 -> 4,5 -> 6 m', () => {
  const damages = [];
  const pushes = [];

  for (const lvl of [1, 2, 3]) {
    const holdSteps = lvl === 1 ? 10 : lvl === 2 ? 95 : 185;
    const g = arena({equip: ['water-pulse'], positions: [vec(0, -4), vec(0, 1)]});
    g.step(cmd({skill: 0, skillHeld: HOLD(0)}), cmd());
    for (let i = 1; i <= holdSteps; i++) g.step(cmd({skillHeld: HOLD(0)}), cmd());
    g.step(cmd(), cmd());
    for (let i = holdSteps + 1; i < secs(2.5); i++) g.step(cmd(), cmd());

    damages.push(100 - g.fighters[1].hp);
    pushes.push(g.fighters[1].position.z - 1);
  }

  assert.deepEqual(damages, [6, 9, 12], 'danos nominais dos 3 níveis de PL');
  assert.ok(pushes[1] > pushes[0] + 0.5, `PL2 empurra mais que PL1: ${pushes[1].toFixed(2)} > ${pushes[0].toFixed(2)}`);
  assert.ok(pushes[2] > pushes[1] + 0.5, `PL3 empurra mais que PL2: ${pushes[2].toFixed(2)} > ${pushes[1].toFixed(2)}`);
});

done();
