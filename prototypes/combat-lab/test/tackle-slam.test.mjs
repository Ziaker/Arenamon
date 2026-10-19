// Fase 2 do Tackle: wall-splat (caindo na parede), meteor slam (C → X no vault e X de quem foi lançado) e ground bounce. Sem navegador.
import assert from 'node:assert/strict';
import {C, defaults, resetConfig} from '../src/sim/config.js';
import {Game} from '../src/sim/game.js';
import {emptyCommand} from '../src/sim/entity.js';
import {vec} from '../src/sim/math.js';
import {launch} from '../src/sim/combat.js';

let n = 0;const ok = l => {n++;console.log('✓', l);};
const cmd = o => ({...emptyCommand(), ...o});
function arena({blue = vec(0, -3), red = vec(0, 3), over = {}} = {}) {
  resetConfig(defaults());
  for (const [p, v] of Object.entries(over)) {const k = p.split('.'), last = k.pop();k.reduce((a, x) => a[x], C)[last] = v;}
  const g = new Game();g.mode = 'inactive';g.reset({positions: [blue, red]});g.fighters[0].facing = 0;g.fighters[1].facing = Math.PI;return g;
}
const step = (g, a = cmd(), b = cmd()) => {g.step(a, b);return g.lastStepEvents;};
const wallX = () => (C.map?.arenaShape === 'square' ? C.test.arenaHalf : (C.map?.arenaRadius ?? 50)) - C.test.halfExtent;
/** Lutador 0 voando rente à parede +x. */
function nearWall(flight, over = {}) {
  const g = arena({blue: vec(0, 0), red: vec(-8, 0), over});const f = g.fighters[0];
  f.position = vec(wallX() - .05, 0);f.flight = {y: 1, vy: -2, horizontal: vec(10, 0), ...flight};f.state = 'airborne';return {g, f};
}

// ---------- Wall-splat ----------
{
  const {g, f} = nearWall({});const ev = step(g);
  assert.ok(f.wallSplat, 'caindo e rápido: gruda na parede');assert.ok(ev.some(e => e.result === 'wallSplat' && e.target === 0), 'evento wallSplat');
  const y0 = f.flight.y;for (let i = 0; i < 40; i++) step(g);
  assert.ok(f.wallSplat && Math.abs(f.flight.y - y0) < 1e-9, 'suspenso na altura do impacto (sem gravidade)');assert.equal(f.state, 'wallSplat');
  const x0 = f.position.x;step(g, cmd({move: vec(-1, 0), dodge: true, tackle: true}));assert.ok(Math.abs(f.position.x - x0) < 1e-6 && !f.action, 'indefeso: não age nem anda');
  const k = Math.ceil(C.rules.wallSplatDuration / C.test.step) + 2;for (let i = 0; i < k; i++) step(g);
  assert.ok(!f.wallSplat, 'a janela acaba');
  for (let i = 0; i < 20; i++) step(g);assert.ok(f.flight ? f.flight.vy < 0 : true, 'volta a cair');
  for (let i = 0; i < 200 && f.flight; i++) step(g);assert.ok(!f.flight, 'aterrissa depois');
  ok('wall-splat: caindo, rápido e na parede → suspenso e indefeso pela janela, depois cai');
}
{
  const up = nearWall({vy: 3});step(up.g);assert.ok(!up.f.wallSplat && up.f.flight.horizontal.x < 0, 'subindo: ricochete, sem splat');
  const slow = nearWall({horizontal: vec(C.rules.wallSplatMinSpeed - 1, 0)});step(slow.g);assert.ok(!slow.f.wallSplat, 'devagar demais: sem splat');
  const off = nearWall({}, {'extras.toggles.enableWallSplat': 0});step(off.g);assert.ok(!off.f.wallSplat, 'toggle desligado: ricochete');
  const dmg = nearWall({}, {'rules.wallSplatDamage': 7});step(dmg.g);assert.equal(dmg.f.hp, 93, 'dano extra do slider');
  const short = nearWall({}, {'rules.wallSplatDuration': .2});for (let i = 0; i < 40; i++) step(short.g);assert.ok(!short.f.wallSplat, 'duração do slider');
  ok('wall-splat só ocorre caindo e acima da velocidade mínima; toggle, dano e duração em sliders');
}
{
  // Preso na parede, o rival continua acertável (combo): o tackle conecta e relança.
  const g = arena({blue: vec(wallX() - 4.5, 0), red: vec(0, 8)});const red = g.fighters[1], blue = g.fighters[0];
  red.position = vec(wallX() - .05, 0);red.flight = {y: .8, vy: -2, horizontal: vec(10, 0)};red.state = 'airborne';blue.facing = Math.PI / 2;
  step(g);assert.ok(red.wallSplat);const hp0 = red.hp;
  for (let i = 0; i < 60; i++) step(g, cmd({tackle: i === 0, move: vec(1, 0), dodgeDirection: vec(1, 0)}));
  assert.ok(red.hp < hp0, `o tackle acerta quem está preso (${hp0} → ${red.hp})`);
  ok('quem está preso na parede pode ser acertado de novo (combo)');
}

// ---------- Meteor slam ----------
const vaulting = (over = {}) => {
  const g = arena({blue: vec(0, -2), red: vec(0, 2), over});const f = g.fighters[0];
  step(g, cmd({dodge: true, move: vec(0, 1), dodgeDirection: vec(0, 1)}));for (let i = 0; i < 34; i++) step(g, cmd({move: vec(0, 1)}));
  return {g, f, red: g.fighters[1]};
};
{
  const {g, f, red} = vaulting();assert.ok(f.vaultHeight > C.rules.slamMinHeight + .3, `no ar do vault (${f.vaultHeight.toFixed(2)} m)`);
  const h0 = f.vaultHeight;step(g, cmd({tackle: true, move: vec(0, 1), dodgeDirection: vec(0, 1)}));
  assert.equal(f.action?.kind, 'tackle');assert.ok(f.action.slam, 'C → X no vault vira meteor slam');assert.equal(f.action.plDamage, C.rules.slamDamage);
  const hs = [h0];let ev = [];for (let i = 0; i < 80; i++) {ev.push(...step(g, cmd({move: vec(0, 1)})));hs.push(f.vaultHeight);}
  const peak = hs.indexOf(Math.max(...hs));assert.ok(hs.slice(1, peak + 1).every((h, i) => h >= hs[i] - 1e-9) && hs[peak] > h0 + C.rules.slamHop * .9, `preparação: sobe ${C.rules.slamHop} m jogado para cima`);assert.ok(hs.slice(peak + 1).every((h, i) => h <= hs[peak + i] + 1e-9), 'mergulho: depois do pico a altura só desce');assert.ok(hs.some(h => h === 0), 'chega ao solo');
  const hit = ev.find(e => e.result === 'impact' && e.slam);assert.ok(hit, 'o slam acerta e marca o evento');assert.equal(hit.launch.bounce, true);
  assert.ok(Math.abs(hit.damage - C.profiles.balanced.attack * C.rules.slamDamage) < 1e-9, `dano = ataque × slamDamage, sem Power Level (${hit.damage})`);
  assert.ok(Math.abs(hit.launch.vertical - C.rules.groundBounceForce) < 1e-9, 'quique: lançamento para cima pelo groundBounceForce');
  assert.ok(hit.launch.horizontal < 11 * .6, 'pouco empurrão horizontal');
  ok('C → X no salto do vault vira meteor slam: mergulha, causa o dano base e lança o rival para cima (ground bounce)');
}
{
  const {g, f} = vaulting({'extras.toggles.enableMeteorSlam': 0});g.fighters[1].position = vec(0, 9);step(g, cmd({tackle: true, move: vec(0, 1)}));
  assert.ok(!f.action?.slam, 'toggle desligado: descida suave de sempre');
  const m = vaulting();m.g.fighters[1].position = vec(0, 9);step(m.g, cmd({tackle: true, move: vec(0, 1), dodgeDirection: vec(0, 1)}));
  assert.ok(m.f.action.slam);let ground = 0, landing = false;for (let i = 0; i < 300 && m.f.action; i++) {step(m.g, cmd({move: vec(0, 1)}));if (m.f.state === 'meteorGround') ground++;if (m.f.state === 'landing') landing = true;}
  assert.ok(ground * C.test.step >= (C.rules.slamGroundTime + C.rules.slamRecovery) * .95, `errou o mergulho: fica no estado do chão por mais tempo (${(ground * C.test.step).toFixed(2)} s)`);assert.ok(!landing && m.f.knockRecovery === 0, 'sem estado de aterrissar depois do meteor');
  ok('slam que erra fica mais tempo no estado do chão (sem aterrissar); toggle desligado mantém o comportamento antigo');
}
{
  const g = arena({blue: vec(0, -2), red: vec(0, 6)});C.extras.toggles.enableFlightSlam = 1;const f = g.fighters[0];launch(f, vec(1, 0), 4, 6);step(g, cmd());
  const y = f.flight.y;assert.ok(y > 0);const s0 = f.stamina;
  step(g, cmd({tackle: true, move: vec(0, 1), dodgeDirection: vec(0, 1)}));
  assert.ok(!f.flight && f.action?.slam, 'X de quem foi lançado: sai do voo e mergulha');assert.ok(f.vaultHeight > 0 && Math.abs(f.vaultHeight - y) < .5, `na altura em que estava (${f.vaultHeight.toFixed(2)} ≈ ${y.toFixed(2)})`);
  assert.ok(s0 - f.stamina >= C.actions.tackle.cost - 1e-6, 'paga o custo do tackle');
  const poor = arena();poor.fighters[0].stamina = .2;launch(poor.fighters[0], vec(1, 0), 4, 6);step(poor);step(poor, cmd({tackle: true}));assert.ok(poor.fighters[0].flight, 'sem stamina não mergulha');
  const stuck = nearWall({});step(stuck.g);step(stuck.g, cmd({tackle: true}));assert.ok(stuck.f.wallSplat && !stuck.f.action, 'preso na parede não mergulha');
  ok('quem foi lançado pode mergulhar com X (custo de stamina; não preso na parede)');
}
console.log(`\n${n} verificações do tackle (fase 2) aprovadas.`);
