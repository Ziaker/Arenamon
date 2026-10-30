// Campos de combate do Editor de animações com efeito REAL na simulação: Armadura, Interrompível, Hit-stop (×), Prioridade de combate e Buffer de entrada.
// Ponte: Character (animProfile) → combatModsOf → Game.setCombatMods → lutador.combatMods → resolveHit/clash/hitstop/buffer.
// Sem ajuste salvo o combate é idêntico ao original (primeira prova abaixo). Também cobre save/load e o caminho Character → sim.
// Uso: node prototypes/combat-lab/test/animation-combat-mods.test.mjs
import assert from 'node:assert/strict';
import {C, resetConfig} from '../src/sim/config.js';
import {Game} from '../src/sim/game.js';
import {createFighter, combatModOf} from '../src/sim/entity.js';
import {resolveHit, clashPossible} from '../src/sim/combat.js';
import {vec} from '../src/sim/math.js';
import {combatModsOf} from '../src/view/combat-mods.js';
import {setField} from '../src/sim/animation-profile.js';
import {makeCharacter, configurableActions, setupRegistry, makeMatch, cmd} from './animation-runtime-harness.mjs';

setupRegistry();
let n = 0;const ok = l => {n++;console.log('✓', l);};
const tackleAction = (extra = {}) => ({kind: 'tackle', elapsed: 15 * C.test.step, heading: 0, startAngle: 0, offensive: true, vault: false, hits: new Set(), from: null, speedMultiplier: 1, hitWindows: [new Set()], ...extra});
function pair() {
  resetConfig();
  const a = createFighter(0, C.profiles.balanced, vec(0, 0)), d = createFighter(1, C.profiles.balanced, vec(0, 1));
  a.action = tackleAction();a.velocity = vec(0, 5);d.facing = Math.PI;
  return {a, d};
}
const hit = (a, d) => resolveHit(a, d, vec(0, 1), vec(0, 5));

// ---- sem ajuste: idêntico ao original ----
{
  const base = pair(), r0 = hit(base.a, base.d);
  const {a, d} = pair();d.action = tackleAction({heading: Math.PI});d.combatMods = null;
  const r1 = hit(a, d);
  const {a: a2, d: d2} = pair();
  const r2 = hit(a2, d2);
  assert.equal(r0.damage, r2.damage);assert.ok(r1.damage > 0 && r1.launch, 'sem ajuste o defensor em ação toma dano e é lançado');
  ok('sem nenhum ajuste salvo o golpe se comporta como sempre (dano e lançamento)');
}
// ---- armadura: reduz o dano e dispensa a reação (só na janela ativa = ação ofensiva) ----
{
  const {a: a0, d: d0} = pair();d0.action = tackleAction({heading: Math.PI});
  const plain = hit(a0, d0);
  const {a, d} = pair();d.action = tackleAction({heading: Math.PI});d.combatMods = {tackle: {armor: 50}};
  assert.equal(combatModOf(d).armor, 50);
  const r = hit(a, d);
  assert.ok(Math.abs(r.damage - plain.damage * .5) < 1e-6, `armadura 50 % reduz o dano pela metade (${r.damage.toFixed(2)} × ${plain.damage.toFixed(2)})`);
  assert.equal(r.launch, null, 'com armadura o defensor não é lançado');
  assert.ok(!(d.knockRecovery > 0) && d.state !== 'hitstun', 'com armadura não há stun');
  ok('Armadura 50 %: dano pela metade e sem lançamento nem stun durante a ação ofensiva');
}
// ---- interrompível desligado: dano normal, sem reação ----
{
  const {a: a0, d: d0} = pair();d0.action = tackleAction({heading: Math.PI});
  const plain = hit(a0, d0);
  const {a, d} = pair();d.action = tackleAction({heading: Math.PI});d.combatMods = {tackle: {interruptible: false}};
  const r = hit(a, d);
  assert.equal(r.damage, plain.damage, 'o dano não muda');assert.equal(r.launch, null, 'sem lançamento');
  ok('Interrompível desligado: o golpe causa o dano normal mas não lança nem interrompe a ação');
}
// ---- armadura fora de ação: nada muda ----
{
  const {a: a0, d: d0} = pair();const plain = hit(a0, d0);
  const {a, d} = pair();d.combatMods = {tackle: {armor: 100, interruptible: false}};
  const r = hit(a, d);
  assert.equal(r.damage, plain.damage);assert.ok(r.launch, 'sem ação em curso o ajuste da ação não vale');
  ok('o ajuste só vale durante a ação a que pertence');
}
// ---- prioridade de combate: desempata o clash de PL igual ----
{
  const mk = prioA => {
    const {a, d} = pair();
    a.action = tackleAction({heading: 0, pl: 1});d.action = tackleAction({heading: Math.PI, pl: 1});
    a.position = vec(0, 0);d.position = vec(0, 1);a.velocity = vec(0, 5);d.velocity = vec(0, -5);
    a.combatMods = prioA ? {tackle: {combatPriority: 5}} : null;
    return {a, d, can: clashPossible(a, d, vec(0, 1), vec(0, 10))};
  };
  const base = mk(false), pri = mk(true);
  assert.equal(base.can, true, 'sem prioridade, PL igual faz clash');
  assert.equal(pri.can, false, 'com prioridade maior de um lado não há clash');
  assert.equal(pri.d.action.neutralized, true, 'o de menor prioridade é neutralizado');
  ok('Prioridade de combate: PL igual deixa de dar clash e o de maior prioridade vence');
}
// ---- hit-stop ×: multiplica a pausa do impacto do atacante ----
{
  const run = mods => {
    resetConfig();C.extras.toggles.enableHitstop = 1;
    const m = makeMatch();m.run(5);
    m.g.fighters[0].position = {x: 0, z: -.4};m.g.fighters[1].position = {x: 0, z: .4};
    if (mods) m.g.setCombatMods(0, mods);
    m.step(cmd({tackle: true, move: vec(0, 1), target: 1, locked: true}));
    let peak = 0;for (let i = 0; i < 90; i++) {m.step();peak = Math.max(peak, m.g.hitstop);}
    return peak;
  };
  const base = run(null), triple = run({tackle: {hitstopMult: 3}}), none = run({tackle: {hitstopMult: 0}});
  assert.ok(base > 0, 'o impacto gera hit-stop');
  assert.ok(Math.abs(triple / base - 3) < .05, `×3 triplica a pausa (${triple.toFixed(3)} / ${base.toFixed(3)})`);
  assert.ok(none < 1e-9, 'x0 elimina a pausa');
  ok('Hit-stop (×): 3× triplica a pausa e 0 a elimina, em partida simulada');
}
// ---- buffer de entrada: janela maior guarda o pedido por mais tempo ----
{
  const run = mods => {
    const m = makeMatch();m.run(5);
    if (mods) m.g.setCombatMods(0, mods);
    m.step(cmd({tackle: true, move: vec(0, 1), target: 1, locked: true}));
    m.step(cmd({tackle: true, move: vec(0, 1), target: 1, locked: true}));   // 2º X durante a ação: vai para o buffer
    const f = m.g.fighters[0];
    let age = 0;for (let i = 0; i < 200 && f.inputBuffer; i++) {m.step();age = f.inputBuffer?.age ?? age;}
    return {age, win: C.actions.buffer.window};
  };
  const base = run(null), big = run({tackle: {bufferWindow: .6}});
  assert.ok(big.age > base.age + .1 || big.age > base.win + .1, `o pedido fica guardado por mais tempo (${big.age.toFixed(2)} s × ${base.age.toFixed(2)} s)`);
  console.log('   buffer: base', base.age.toFixed(3), 's · com 0,6 s', big.age.toFixed(3), 's (global', base.win, ')');
  ok('Buffer de entrada: janela maior da ação mantém o pedido de X/C guardado por mais tempo');
}
// ---- caminho Character (Editor) → mods ----
{
  const ch = makeCharacter(configurableActions(), 'azul.glb');
  assert.deepEqual(combatModsOf(ch), {}, 'sem edições, nada é enviado à simulação');
  ch.animProfile = setField(setField(setField(ch.animProfile, 'tackle', 'armor', 40), 'tackle', 'hitstopMult', 2), 'tackle', 'interruptible', false);
  assert.deepEqual(combatModsOf(ch), {tackle: {armor: 40, hitstopMult: 2, interruptible: false}});
  ch.animProfile = setField(ch.animProfile, 'tackle', 'armor', 0);
  assert.equal(combatModsOf(ch).tackle.armor, undefined, 'valor neutro não é enviado');
  ok('o Editor (animProfile) vira o objeto de ajustes enviado ao Game; valores neutros não vão');
}
// ---- save/load ----
{
  const m = makeMatch();m.g.setCombatMods(0, {tackle: {armor: 25}});
  m.run(10);
  const snap = m.g.save(), m2 = makeMatch();m2.g.load(snap);
  assert.deepEqual(m2.g.fighters[0].combatMods, {tackle: {armor: 25}});assert.deepEqual(m2.g.combatMods[0], {tackle: {armor: 25}});
  ok('save/load preserva os ajustes de combate');
}
console.log(`\n${n} verificações dos campos de combate aprovadas.`);
process.exit(0);
