// @ts-check
// Anti-aéreo (Quick Attack / Bullet Punch), janela de combo após acerto corpo a corpo (0,7 s) e stamina infinita (23/10/2026).
// Estes testes prendem o contrato que o jogador sente no laboratório: alvo em voo baixo é elegível e acertável; um acerto abre a
// janela para encadear outra ação mesmo durante a recuperação; o interruptor de stamina infinita zera custos e mantém a barra cheia.
import {assert, C, cmd, vec, secs, suite, arena} from './moves-new-helpers.mjs';
import {getMove, nearestEligible, targetReachOf} from '../src/sim/moves.js';
import {movePermission, costOf, isDepleted} from '../src/sim/controller.js';

const {test, done} = suite('ANTI-AÉREO, COMBO E STAMINA INFINITA');
const press0 = {skill: 0, skillHeld: [true, false, false, false]};
const impacts = ev => ev.filter(e => e.result === 'impact' && e.attacker === 0);
const air = (y = 1.2) => ({flight: {y, vy: 0, gravity: 0, horizontal: vec(0, 0)}});

test('Quick Attack: alvo em voo baixo entra no alcance e no golpe (airReach 3 m)', () => {
  const g = arena({equip: ['quick-attack'], positions: [vec(0, -2.5), vec(0, 2.5)]});
  const b = g.fighters[0], r = g.fighters[1];
  Object.assign(r, air(1.2));
  assert.equal(nearestEligible(b, g.fighters, 7, targetReachOf(getMove('quick-attack'))), r, 'aquisição anti-aérea');
  assert.equal(nearestEligible(b, g.fighters, 7), null, 'sem a opção anti-aérea o voo continua fora');
  g.step(cmd(press0), cmd());
  g.step(cmd(), cmd());
  let hits = 0;
  for (let i = 0; i < secs(.5); i++) {g.step(cmd(), cmd());hits += impacts(g.lastStepEvents).length;}
  assert.equal(hits, 1, 'acerta o alvo em voo uma vez');
});

test('Quick Attack: acima de airReach o alvo em voo NÃO é elegível', () => {
  const g = arena({equip: ['quick-attack'], positions: [vec(0, -2.5), vec(0, 2.5)]});
  const b = g.fighters[0], r = g.fighters[1];
  Object.assign(r, air(4.2));
  assert.equal(nearestEligible(b, g.fighters, 7, targetReachOf(getMove('quick-attack'))), null, 'acima de 3 m não alcança');
});

test('Bullet Punch: alvo em voo baixo é aceito na preparação e no golpe', () => {
  const g = arena({equip: ['bullet-punch'], positions: [vec(0, -2), vec(0, 2)]});
  const b = g.fighters[0], r = g.fighters[1];
  Object.assign(r, air(1.1));
  assert.equal(nearestEligible(b, g.fighters, C.world.bulletPunch.reach, targetReachOf(getMove('bullet-punch'))), r, 'aquisição anti-aérea');
  assert.equal(movePermission(b, getMove('bullet-punch'), 0).ok, true, 'o Move pode começar contra alvo em voo');
  g.step(cmd(press0), cmd());
  g.step(cmd(), cmd());
  let hits = 0;
  for (let i = 0; i < secs(1.4); i++) {g.step(cmd(), cmd());hits += impacts(g.lastStepEvents).length;}
  assert.equal(hits, 1, 'o soco-bala alcança o alvo em voo');
});

test('combo: um Tackle que acerta abre 0,7 s para encadear um Move durante a recuperação', () => {
  const g = arena({equip: ['quick-attack'], positions: [vec(0, -.9), vec(0, .9)]});
  const b = g.fighters[0], r = g.fighters[1];
  let seen = false;
  for (let i = 0; i < secs(.6) && !seen; i++) {
    g.step(cmd({tackle: i === 0}), cmd());
    seen = g.lastStepEvents.some(e => (e.result === 'impact' || e.result === 'partial') && e.attacker === 0);
  }
  assert.ok(seen, 'o Tackle acertou');
  assert.ok((b.comboLeft ?? 0) > .5, `janela aberta (${(b.comboLeft ?? 0).toFixed(2)} s)`);
  assert.equal(movePermission(b, getMove('quick-attack'), 0).ok, true, 'o Move encadeia mesmo antes do fim da recuperação');
  b.comboLeft = 0;
  const deny = movePermission(b, getMove('quick-attack'), 0);
  assert.deepEqual([deny.ok, deny.reason], [false, 'chain'], 'sem a janela, a recuperação bloqueia');
  void r;
});

test('comboWindow = 0 desliga a janela; o slider muda o tempo aberto', () => {
  const g = arena({equip: ['quick-attack']});
  const b = g.fighters[0];
  b.action = {kind: 'tackle', move: 'tackle', elapsed: .05, hits: new Set(), params: {}, def: null};
  b.comboLeft = .7;
  C.rules.comboWindow = 0;
  b.comboLeft = 0;
  assert.equal(movePermission(b, getMove('quick-attack'), 0).reason, 'chain');
  C.rules.comboWindow = 1.4;
  b.comboLeft = 1.4;
  assert.equal(movePermission(b, getMove('quick-attack'), 0).ok, true);
});

test('stamina infinita: custo zero, nunca exausto e a barra volta ao máximo', () => {
  const g = arena({equip: ['quick-attack']});
  const b = g.fighters[0];
  C.extras.toggles.enableInfiniteStamina = 1;
  b.stamina = 0;b.exhausted = true;b.regenBase = 0;
  assert.equal(costOf(b, 3), 0, 'nenhum custo');
  assert.equal(isDepleted(0), false, 'zero não é exaustão');
  assert.equal(movePermission(b, getMove('quick-attack'), 0).ok, true, 'Move permitido sem stamina');
  g.step(cmd(), cmd());
  assert.equal(b.stamina, C.rules.staminaMax, 'barra cheia depois do passo');
  assert.equal(b.exhausted, false, 'não fica exausto');
});

test('stamina infinita desligada mantém a regra normal', () => {
  const g = arena({equip: ['quick-attack']});
  const b = g.fighters[0];
  C.extras.toggles.enableInfiniteStamina = 0;
  b.stamina = 0;b.exhausted = true;
  assert.equal(costOf(b, 1), 1);
  assert.equal(isDepleted(0), true);
  assert.equal(movePermission(b, getMove('quick-attack'), 0).ok, false, 'sem stamina o Move é negado');
});

done();
