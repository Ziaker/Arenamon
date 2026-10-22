// @ts-check
// Lutador em pé sobre uma plataforma (groundY > 0, sem voo): a altura usada nos acertos tem de ser a do chão dele,
// e não 0. Antes, projéteis na altura da plataforma passavam por dentro do lutador e os que batiam no chão o acertavam.
import {assert, arena, vec, cmd, secs, suite} from './moves-new-helpers.mjs';
import {spawn} from '../src/sim/world.js';

const {test, done} = suite('LUTADOR SOBRE PLATAFORMA');
const shoot = (y) => {
  const g = arena({positions: [vec(0, -6), vec(0, 3)]});const r = g.fighters[1];
  g.mapState.platforms = [{pos: {x: 0, z: 3}, width: 3, depth: 3, height: 2}];r.groundY = 2;r.flight = null;
  for (let i = 0; i < 5; i++) g.step(cmd(), cmd());assert.equal(r.groundY, 2, 'em pé na plataforma');
  const hp = r.hp;
  spawn(g.world, {kind: 'projectile', owner: 0, pos: {x: 0, z: -2}, dir: {x: 0, z: 1}, speed: 14, y, radius: .2, life: 3, pierce: 1, pl: 1, hit: {damage: 5}}, []);
  for (let i = 0; i < secs(1); i++) g.step(cmd(), cmd());
  return hp - r.hp;
};
test('projétil na altura do corpo do lutador sobre a plataforma o acerta', () => assert.ok(shoot(2.65) > 0));
test('projétil rente ao chão da arena passa por baixo do lutador que está na plataforma', () => assert.equal(shoot(.65), 0));
done();
