// @ts-check
import {assert, C, cmd, vec, secs, suite, arena} from './moves-new-helpers.mjs';

const {test, done} = suite('SAND WAVE VERTICAL ALTITUDE (PILOTO 01)');

test('RED: alvo em plataforma a 1,5 m de altura NÃO é atingido com waveHeight padrão (0,35 m)', () => {
  const g = arena({equip: ['sand-wave'], positions: [vec(0, -4), vec(0, -1.5)]});
  // Cria plataforma real no mapa a 1,5 m onde o vermelho está apoiado
  g.mapState.platforms = [{pos: {x: 0, z: -1.5}, width: 3, depth: 3, height: 1.5}];
  g.fighters[1].groundY = 1.5;
  g.fighters[1].position.y = 1.5;

  // Azul dispara o Sand Wave no chão (y = 0)
  g.step(cmd({skill: 0, skillHeld: 1}), cmd());
  for (let i = 1; i < secs(1.5); i++) {
    g.step(cmd(), cmd());
  }

  // O oponente vermelho a 1,5 m não deve ter levado dano nem cegueira com waveHeight = 0,35 m
  assert.equal(g.fighters[1].hp, 100, 'não deve sofrer dano acima da onda');
  const blind = g.fighters[1].statuses?.find(s => s.id === 'blind');
  assert.ok(!blind, 'não deve ser cegado acima da onda');
});

test('A/B: aumentando waveHeight para 2,0 m, o alvo na plataforma de 1,5 m É atingido', () => {
  const g = arena({
    equip: ['sand-wave'],
    positions: [vec(0, -4), vec(0, -1.5)],
    setup: () => {
      C.world.sandWave.waveHeight = 2.0;
    }
  });
  g.mapState.platforms = [{pos: {x: 0, z: -1.5}, width: 3, depth: 3, height: 1.5}];
  g.fighters[1].groundY = 1.5;
  g.fighters[1].position.y = 1.5;

  g.step(cmd({skill: 0, skillHeld: 1}), cmd());
  for (let i = 1; i < secs(1.5); i++) {
    g.step(cmd(), cmd());
  }

  // Com waveHeight = 2.0 m, o alvo na plataforma a 1,5 m é atingido
  assert.ok(g.fighters[1].hp < 100, `deve sofrer dano (hp=${g.fighters[1].hp})`);
  const blind = g.fighters[1].statuses?.find(s => s.id === 'blind');
  assert.ok(blind, 'deve ser cegado com waveHeight ampliado');
  C.world.sandWave.waveHeight = 0.35; // restaura
});

test('Paridade: alvo no chão (y = 0) continua sendo atingido normalmente', () => {
  const g = arena({equip: ['sand-wave'], positions: [vec(0, -4), vec(0, -1.5)]});
  g.step(cmd({skill: 0, skillHeld: 1}), cmd());
  for (let i = 1; i < secs(1.5); i++) {
    g.step(cmd(), cmd());
  }
  assert.equal(g.fighters[1].hp, 94, 'dano fixo de 6 HP');
  const blind = g.fighters[1].statuses?.find(s => s.id === 'blind');
  assert.ok(blind, 'cegueira aplicada');
});

done();
