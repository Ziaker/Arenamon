// @ts-check
import {assert, C, cmd, vec, secs, suite, arena} from './moves-new-helpers.mjs';

const {test, done} = suite('BULLET PUNCH MECÂNICA E TACKLE (PILOTO 02)');

test('Knockback próprio: toggle knockbackOwn=1 com knockbackH=12 altera o deslocamento do alvo em relação ao Tackle padrão', () => {
  // Baseline: knockbackOwn = 0 (usa fórmula herdada do Tackle)
  let posA;
  {
    const g = arena({equip: ['bullet-punch'], positions: [vec(0, -4), vec(0, 0)]});
    g.step(cmd({skill: 0, skillHeld: 1}), cmd());
    g.step(cmd(), cmd());
    for (let i = 2; i < secs(2); i++) g.step(cmd(), cmd());
    posA = g.fighters[1].position.z;
  }

  // Variante: knockbackOwn = 1, knockbackH = 12
  let posB;
  {
    const g = arena({
      equip: ['bullet-punch'],
      positions: [vec(0, -4), vec(0, 0)],
      setup: () => {
        C.world.bulletPunch.knockbackOwn = 1;
        C.world.bulletPunch.knockbackH = 12;
      }
    });
    g.step(cmd({skill: 0, skillHeld: 1}), cmd());
    g.step(cmd(), cmd());
    for (let i = 2; i < secs(2); i++) g.step(cmd(), cmd());
    posB = g.fighters[1].position.z;
    C.world.bulletPunch.knockbackOwn = 0;
    C.world.bulletPunch.knockbackH = 4;
  }

  assert.ok(posB > posA + 0.5, `knockback próprio deve empurrar mais longe: ${posB.toFixed(2)} > ${posA.toFixed(2)}`);
});

test('Interceptação no caminho: lutador no meio da trajetória é atingido e interrompe a corrida antes do alvo final', () => {
  // 3 lutadores: Azul em (0,-4), Verde em (0,-1) bloqueando, Vermelho em (0,2) alvo travado
  const g = arena({equip: ['bullet-punch'], positions: [vec(0, -4), vec(0, 2)]});
  // Adiciona um terceiro lutador como obstáculo no caminho
  const blocker = {
    ...g.fighters[1],
    id: 2,
    position: {x: 0, y: 0, z: -1.5},
    hp: 100,
    statuses: []
  };
  g.fighters.push(blocker);

  g.step(cmd({skill: 0, skillHeld: 1}), cmd());
  g.step(cmd(), cmd());
  for (let i = 2; i < secs(1.5); i++) g.step(cmd(), cmd());

  // O blocker em z = -1.5 deve ter sido atingido
  assert.ok(blocker.hp < 100, `obstáculo no caminho deve sofrer dano (hp=${blocker.hp})`);
  // E o atacante não deve ter chegado ao destino final z = 2
  assert.ok(g.fighters[0].position.z < 0, `atacante parou no obstáculo (z=${g.fighters[0].position.z.toFixed(2)})`);
});

test('Anti-aéreo: alvo em voo baixo (y=2m) é atingido e o golpe sobe até ele', () => {
  const g = arena({equip: ['bullet-punch'], positions: [vec(0, -4), vec(0, 0)]});
  g.fighters[1].flight = {y: 2, vy: 0, horizontal: vec(0, 0)};

  g.step(cmd({skill: 0, skillHeld: 1}), cmd());
  g.step(cmd(), cmd());
  for (let i = 2; i < secs(2); i++) g.step(cmd(), cmd());

  assert.ok(g.fighters[1].hp < 100, `alvo em voo baixo deve ser atingido pelo anti-aéreo (hp=${g.fighters[1].hp})`);
});

test('Paridade: Tackle normal do jogo não é afetado pelas configurações do Bullet Punch', () => {
  const g = arena({positions: [vec(0, -2), vec(0, 0)]});
  // Azul usa Tackle normal (tecla tackle)
  g.step(cmd({tackle: true}), cmd());
  for (let i = 1; i < secs(1); i++) g.step(cmd(), cmd());
  assert.equal(g.fighters[1].hp, 80, 'Tackle padrão causa 20 HP (C.rules.damageBase)');
});

done();
