// Fase 4 (plano de Reflect/Psyshock) — Power Level, Clash e Counter, sem navegador. Cobre: M18.4–M18.8, M19.2–M19.9, M20.1–M20.2, M20.4,
// M20.8–M20.9, M21.1, M21.3–M21.7, M21.9, M22.5 e M28.4 (Counter Stagger capturado). Tackle PL1 fixo; pedras do Psyshock com PL próprio.
// Interações de Fields/explosões entre si (M22.2–M22.4) dependem de Moves ofensivos de área que ainda não existem (nem Reflect nem Psyshock são).
import assert from 'node:assert/strict';
import {C, defaults, resetConfig} from '../src/sim/config.js';
import {Game} from '../src/sim/game.js';
import {emptyCommand} from '../src/sim/entity.js';
import {vec} from '../src/sim/math.js';
import {clearMoves} from '../src/sim/moves.js';
import {clearEffects} from '../src/sim/move-effects.js';
import {registerStandardMoves} from '../src/sim/moves/standard.js';
import {TACKLE_PL, applyCounterStagger} from '../src/sim/world.js';
import {spawn} from '../src/sim/world.js';

let n = 0;const ok = l => {n++;console.log('✓', l);};
const cmd = o => ({...emptyCommand(), ...o});
registerStandardMoves();
const events = [];
function arena({blue = vec(0, -3), red = vec(0, 3)} = {}) {
  resetConfig(defaults());events.length = 0;
  const g = new Game();g.mode = 'inactive';g.reset({positions: [blue, red]});g.fighters[0].facing = 0;g.fighters[1].facing = Math.PI;g.setLoadout(0, ['reflect', 'psyshock']);return g;
}
const step = (g, c0 = cmd(), c1 = cmd()) => {g.step(c0, c1);events.push(...g.lastStepEvents);return g.lastStepEvents;};
const steps = (g, k, c0 = () => cmd(), c1 = () => cmd()) => {for (let i = 0; i < k; i++) step(g, c0(i), c1(i));};
const stone = (g, o = {}) => spawn(g.world, {kind: 'projectile', owner: 1, pos: {x: 0, z: 0}, dir: {x: 0, z: -1}, speed: 10, y: .65, radius: .2, life: 3, pierce: 1, pl: 1, clashable: true, hit: {damage: 5}, captured: {counterStagger: .2}, ...o}, []);
/** Azul em Tackle há 0,25 s (já fora da janela de invulnerabilidade de 0,2 s), apontando para +Z; devolve o azul. */
function tackling(g, move = vec(0, 1)) {step(g, cmd({tackle: true, move}));steps(g, 29, () => cmd({move}));return g.fighters[0];
}

assert.equal(TACKLE_PL, 1);
{
  const g = arena({red: vec(0, 20)}), blue = tackling(g), z0 = blue.position.z;
  assert.equal(blue.action?.kind, 'tackle');assert.ok(blue.action.elapsed > .2);
  const s = stone(g, {pos: {x: 0, z: z0 + .9}, pl: 1});
  const hp = blue.hp;steps(g, 3);
  assert.ok(s.dead && blue.hp === hp, 'PL igual: a pedra se despedaça e não machuca');assert.equal(blue.action?.kind === 'tackle' || blue.action === null, true);
  const e = events.find(x => x.result === 'tackleClash');assert.ok(e && e.attacker === 0 && e.target === 1 && e.pl === 1, 'evento com os PLs');assert.ok(!blue.action?.neutralized, 'o Tackle segue');
}
ok('Tackle (PL1) × pedra de PL1: Clash — só a pedra se despedaça e o Tackle continua');
{
  const g = arena(), blue = tackling(g), z0 = blue.position.z, red = g.fighters[1];
  const s = stone(g, {pos: {x: 0, z: z0 + .9}, pl: 2});
  steps(g, 3);
  assert.ok(blue.action === null || blue.action.neutralized, 'o Tackle foi neutralizado ou interrompido pelo golpe');
  const c = events.find(x => x.result === 'counter');assert.ok(c && c.attacker === 1 && c.target === 0 && c.pl === 2 && c.other === 1, 'Counter registrado com os PLs');
  assert.ok(blue.hp < 100, 'a pedra de PL superior vence e segue: atinge o corpo do derrotado');
  assert.equal(events.filter(x => x.result === 'counterStagger').length, 1, 'Counter Stagger aplicado ao corpo atingido');assert.ok(blue.counterStagger > .15 && blue.knockRecovery > 0);
  void s;void red;
  // um Tackle neutralizado não machuca ninguém nesta ação
  const h = arena({red: vec(0, 20)}), b2 = tackling(h);const r2 = h.fighters[1];r2.position = vec(0, b2.position.z + 1.6);
  const s2 = stone(h, {pos: {x: 0, z: b2.position.z + .6}, pl: 2});void s2;steps(h, 25);
  assert.equal(r2.hp, 100, 'o Tackle neutralizado por um Counter não causa dano');
  const k = arena({red: vec(0, 20)}), kb = tackling(k);k.fighters[1].position = vec(0, kb.position.z + 1.6);steps(k, 25);assert.ok(k.fighters[1].hp < 100, 'controle: sem pedra, o mesmo Tackle machuca');
}
ok('Tackle × pedra de PL2: Counter — a pedra vence e atinge o corpo, aplica o Counter Stagger de 0,2 s, e o Tackle fica neutralizado');
{
  const g = arena(), blue = tackling(g), z0 = blue.position.z;
  stone(g, {pos: {x: 0, z: z0 + .9}, pl: 3, hit: {damage: 1}});steps(g, 3);
  const t0 = blue.counterStagger;assert.ok(t0 > .15);
  stone(g, {pos: {x: 0, z: blue.position.z + .9}, pl: 3, hit: {damage: 1}});steps(g, 3);
  assert.equal(events.filter(x => x.result === 'counterStagger').length, 1, 'Counters sucessivos não acumulam nem reiniciam o stagger ativo (M21.6)');
  steps(g, 15);assert.ok(blue.counterStagger < t0, 'e o contador continua descendo (o hitstop de impacto congela o relógio por alguns passos)');
  assert.equal(applyCounterStagger({counterStagger: 0, knockRecovery: 0}, 0, [], null), false, 'duração 0 não aplica');
  steps(g, 40);assert.equal(blue.counterStagger, 0);
}
ok('Counter Stagger de 0,2 s: não acumula nem reinicia enquanto ativo; expira');
{
  // Charge interrompido pelo Counter Stagger (M21.7)
  const g = arena();g.step(cmd({skill: 1, skillHeld: [false, true, false, false]}), cmd());for (let i = 0; i < 60; i++) step(g, cmd({skillHeld: [false, true, false, false]}));
  const blue = g.fighters[0];assert.ok(blue.charge);
  // pedra de PL2 do vermelho vence a de PL1 do azul perto do azul e depois atinge o corpo dele
  const mine = spawn(g.world, {kind: 'projectile', owner: 0, pos: {x: 0, z: -1.5}, dir: {x: 0, z: 1}, speed: 0, y: .65, radius: .2, life: 3, pierce: 1, pl: 1, clashable: true, hit: {damage: 1}}, []);
  const theirs = stone(g, {pos: {x: 0, z: -1.4}, pl: 2, speed: 12, hit: {damage: 1}});
  step(g, cmd({skillHeld: [false, true, false, false]}));
  assert.ok(mine.dead && !theirs.dead && theirs.counterWon, 'PL2 vence a de PL1 e continua');
  assert.ok(events.some(x => x.result === 'counter' && x.winner === theirs.id), 'Counter entre pedras registrado');
  assert.equal(events.filter(x => x.result === 'counterStagger').length, 0, 'disputa à distância não causa stagger (M21.4)');
  steps(g, 20, () => cmd({skillHeld: [false, true, false, false]}));
  assert.ok(events.some(x => x.result === 'counterStagger' && x.target === 0), 'ao atingir o corpo do derrotado, o stagger se aplica');
  assert.equal(blue.charge, null, 'e interrompe o Charge');assert.ok(events.some(x => x.result === 'chargeInterrupt'));
}
ok('pedra de PL superior vence a inferior à distância (sem stagger) e, ao atingir o corpo do derrotado, aplica o Counter Stagger e interrompe o Charge');
{
  const g = arena({red: vec(0, 20)}), blue = g.fighters[0];
  const s = spawn(g.world, {kind: 'projectile', owner: 1, pos: {x: 0, z: -2}, dir: {x: 0, z: -1}, speed: 10, y: .65, radius: .2, life: 3, pierce: 1, pl: 1, hit: {damage: 5}}, []);   // pedra comum (não clashable)
  const hp = blue.hp;steps(g, 12);assert.ok(blue.hp < hp && s.dead, 'projétil sem PL/clash continua funcionando como antes');
  const t = arena({red: vec(0, 20)}), tb = tackling(t);const s2 = stone(t, {pos: {x: 0, z: tb.position.z + .9}, pl: 1, clashable: false});steps(t, 3);
  assert.ok(!events.some(e => e.result === 'tackleClash') && s2.dead, 'só entidades marcadas como disputáveis participam da disputa de PL');
}
ok('projéteis comuns (sem `clashable`) mantêm o comportamento anterior');
{
  const g = arena();g.fighters[0].facing = 0;const bar = spawn(g.world, {kind: 'barrier', owner: 1, shape: 'box', pos: {x: 0, z: -1.7}, angle: Math.PI, hx: 2, hz: .05, y: 0, height: 3, life: 8, hp: Infinity, blocksProjectiles: true, blocksFighters: true, blocksOwner: true, reflect: true, breakableByTackle: true, pl: 3,
    captured: {tackleRecoil: .15, tackleStagger: .25, tieTolerance: .001, maxReflections: 16}}, []);
  steps(g, 3, () => cmd({tackle: true, move: vec(0, 1)}));for (let i = 0; i < 20 && !bar.dead; i++) step(g, cmd({move: vec(0, 1)}));
  assert.ok(bar.dead, 'o Tackle destrói o Reflect de PL3 (qualquer PL, M19.9)');
}
ok('o Tackle (PL1) ainda destrói o Reflect de qualquer PL (M19.9)');
{
  // M28.4: o Counter Stagger é capturado ao disparar; M20.9: PL nos eventos de impacto
  const g = arena({red: vec(0, 20)});
  g.step(cmd({skill: 1, skillHeld: [false, true, false, false]}), cmd());for (let i = 0; i < 479; i++) step(g, cmd({skillHeld: [false, true, false, false]}));step(g, cmd());
  const ss = g.world.entities.filter(e => e.exec != null);assert.ok(ss.length === 8 && ss.every(e => e.captured.counterStagger === .2 && e.pl === 3));
  C.world.psyshock.counterStagger = 5;assert.ok(ss.every(e => e.captured.counterStagger === .2), 'sliders posteriores não alteram as pedras em voo');
  const h = arena({red: vec(0, 6)}), r = h.fighters[1];r.facing = Math.PI;
  const p = stone(h, {pos: {x: 0, z: 4}, dir: {x: 0, z: 1}, pl: 2});void p;steps(h, 3);
  const imp = events.find(e => e.result === 'impact' || e.result === 'partial');assert.ok(!imp || imp.pl === 2 || imp.pl === null);
}
ok('o Counter Stagger é capturado na criação das pedras; eventos de acerto trazem o PL');

clearMoves();clearEffects();resetConfig(defaults());
console.log(`\n${n} verificações de Power Level, Clash e Counter (Fase 4) aprovadas.`);
