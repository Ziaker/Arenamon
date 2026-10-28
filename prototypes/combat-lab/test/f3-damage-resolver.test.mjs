// @ts-check
// F3.1 — DamageResolver: autoridade central de dano. Matriz de regras, oráculo (cópia congelada do pipeline antigo) e conservação de HP em partidas IA×IA.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {C, defaults, resetConfig} from '../src/sim/config.js';
import {sturdyGuard, setPassiveLoadout} from '../src/sim/passive-engine.js';
import {wholeDamage} from '../src/sim/damage-rule.js';
import {resolveDamage, sourceKindOf} from '../src/sim/resolvers/damage-resolver.js';
import {processDamageWithShieldAndStages} from '../src/sim/map/map-damage.js';
import {Game} from '../src/sim/game.js';
import {registerStandardMoves} from '../src/sim/moves/standard.js';

registerStandardMoves();

/** Cópia CONGELADA do processDamageWithShieldAndStages anterior à F3.1 (forma não-legada). Não edite: é o oráculo. */
function oracle(defender, rawDamage, attacker = null, isBlocked = false, isPerfect = false, ctx = {}) {
  if (!defender || defender.hp <= 0) return {absorbedByShield: 0, hpDamage: 0};
  if (isPerfect) return {absorbedByShield: 0, hpDamage: 0};
  rawDamage = wholeDamage(rawDamage);
  defender.shield ??= {hp: 0, duration: 0, maxHp: 80};
  defender.stages ??= {attack: 0, defense: 0, staminaMax: 0, cooldown: 0, speed: 0};
  let unshieldedRaw = rawDamage, absorbed = 0;
  if (defender.shield.hp > 0) {
    if (defender.shield.hp >= rawDamage) {absorbed = rawDamage;defender.shield.hp -= rawDamage;unshieldedRaw = 0;}
    else {absorbed = defender.shield.hp;unshieldedRaw = rawDamage - defender.shield.hp;defender.shield.hp = 0;defender.shield.duration = 0;}
  }
  let finalHpDamage = 0, sg = null;
  if (unshieldedRaw > 0) {
    const guardMultiplier = isBlocked ? (C.extras?.combat?.guardDamageMultiplier ?? 0.5) : 1.0;
    const defenseFactor = Math.max(0, 1.0 - (defender.stages.defense ?? 0) * (C.map?.stageDefenseReduction ?? 0.10));
    finalHpDamage = wholeDamage(unshieldedRaw * guardMultiplier * defenseFactor);
    sg = sturdyGuard(defender, finalHpDamage, {...ctx, attacker});
    finalHpDamage = sg.hpDamage;
    defender.hp = sg.sturdy ? 1 : Math.max(0, defender.hp - finalHpDamage);
    if (attacker) {defender.lastAttacker = attacker.id;defender.lastDamagedTick = (defender.lastDamagedTick ?? 0) + 1;}
  }
  return {absorbedByShield: absorbed, hpDamage: finalHpDamage, sturdy: !!sg?.sturdy};
}

const fighter = ({hp = 100, shield = 0, defense = 0, sturdy = false} = {}) => ({id: 1, hp, attributes: {hp: 100}, lastAttacker: 'nenhum', lastDamagedTick: 7,
  shield: {hp: shield, duration: shield ? 10 : 0, maxHp: 80}, stages: {attack: 0, defense, staminaMax: 0, cooldown: 0, speed: 0},
  passiveState: {loadout: sturdy ? ['sturdy'] : [], sturdyAvailable: true, sturdyUsed: false}});
const ATK = {id: 0};
const withPassives = fn => {resetConfig(defaults());const prev = C.extras.toggles.enablePassives;C.extras.toggles.enablePassives = 1;try {fn();} finally {C.extras.toggles.enablePassives = prev;}};

test('matriz: escudo parcial/total, guarda, estágio de defesa, perfeito, inteiro para baixo', () => withPassives(() => {
  let f = fighter({shield: 40});
  let r = resolveDamage({target: f, attacker: ATK, rawDamage: 30, sourceKind: 'direct'});
  assert.equal(r.shieldAbsorbed, 30);assert.equal(r.hpDamage, 0);assert.equal(f.shield.hp, 10);assert.equal(f.hp, 100);
  assert.equal(f.lastAttacker, 'nenhum', 'tudo no escudo: autor não registrado (como antes)');
  f = fighter({shield: 20, defense: 2});
  r = resolveDamage({target: f, attacker: ATK, rawDamage: 50, sourceKind: 'direct'});
  assert.equal(r.shieldAbsorbed, 20);assert.equal(r.hpDamage, 24, '30 × 0,80');assert.equal(r.absorbedByDefense, 6);assert.equal(f.hp, 76);assert.equal(f.shield.duration, 0);
  f = fighter();
  r = resolveDamage({target: f, attacker: ATK, rawDamage: 21, sourceKind: 'direct', guarded: true});
  assert.equal(r.hpDamage, Math.floor(21 * C.extras.combat.guardDamageMultiplier), 'guarda × guardDamageMultiplier, inteiro para baixo');assert.equal(r.guarded, true);
  f = fighter({defense: 1});
  r = resolveDamage({target: f, rawDamage: 10, sourceKind: 'direct'});
  assert.equal(r.hpDamage, 9, 'estágio de defesa: −10 p.p.');
  f = fighter({shield: 50});
  r = resolveDamage({target: f, attacker: ATK, rawDamage: 80, sourceKind: 'direct', perfect: true, guarded: true});
  assert.equal(r.hpDamage, 0);assert.equal(r.shieldAbsorbed, 0);assert.equal(f.shield.hp, 50, 'perfeito: nada acontece');assert.equal(r.perfect, true);
  f = fighter();
  r = resolveDamage({target: f, rawDamage: 7.9, sourceKind: 'status'});
  assert.equal(r.rawDamage, 7);assert.equal(r.hpDamage, 7);assert.equal(f.hp, 93);
  r = resolveDamage({target: f, rawDamage: 0.99, sourceKind: 'status'});
  assert.equal(r.hpDamage, 0, '0,99 → 0');
}));

test('matriz: Sturdy só direto com atacante; ambiental/status sem Sturdy; killed', () => withPassives(() => {
  let f = fighter({hp: 5, sturdy: true});
  let r = resolveDamage({target: f, attacker: ATK, rawDamage: 50, sourceKind: 'direct'});
  assert.equal(r.sturdy, true);assert.equal(f.hp, 1);assert.equal(r.hpDamage, 4);assert.equal(r.killed, false);
  for (const sourceKind of ['environmental', 'status', 'reflected', 'system']) {
    f = fighter({hp: 5, sturdy: true});
    r = resolveDamage({target: f, attacker: ATK, rawDamage: 50, sourceKind});
    assert.equal(r.sturdy, false, `${sourceKind} não protege`);assert.equal(f.hp, 0);assert.equal(r.killed, true);
  }
  f = fighter({hp: 5, sturdy: true});
  r = resolveDamage({target: f, rawDamage: 50, sourceKind: 'direct'});
  assert.equal(r.sturdy, false, 'direto sem atacante não protege');
  f = fighter({hp: 5, sturdy: true});
  r = resolveDamage({target: f, indirectAttacker: ATK, rawDamage: 50, sourceKind: 'environmental'});
  assert.equal(r.sturdy, false);assert.equal(r.indirectAttackerId, 0);assert.equal(r.attackerId, null);
  assert.equal(f.lastAttacker, 0, 'autor indireto registrado (wall splat com lastAttacker)');
}));

test('matriz: refletido ignora escudo e estágio; trackAttacker=false e atacante nulo não mexem em lastAttacker', () => withPassives(() => {
  let f = fighter({shield: 30, defense: 3});
  let r = resolveDamage({target: f, attacker: ATK, rawDamage: 10, sourceKind: 'reflected', policy: {bypassShield: true, bypassDefense: true, trackAttacker: false}});
  assert.equal(r.hpDamage, 10);assert.equal(r.shieldAbsorbed, 0);assert.equal(r.absorbedByDefense, 0);assert.equal(f.shield.hp, 30);assert.equal(f.hp, 90);
  assert.equal(f.lastAttacker, 'nenhum');assert.equal(f.lastDamagedTick, 7);
  f = fighter();
  r = resolveDamage({target: f, attacker: null, rawDamage: 10, sourceKind: 'environmental'});
  assert.equal(f.hp, 90);assert.equal(f.lastAttacker, 'nenhum', 'atacante nulo não altera lastAttacker');assert.equal(f.lastDamagedTick, 7);
  assert.equal(resolveDamage({target: null, rawDamage: 10, sourceKind: 'direct'}).hpDamage, 0);
  f = fighter({hp: 0});
  assert.equal(resolveDamage({target: f, attacker: ATK, rawDamage: 10, sourceKind: 'direct'}).hpDamage, 0, 'derrotado não recebe dano');
}));

test('oráculo: resolveDamage e o adaptador dão o mesmo que o pipeline antigo numa grade de entradas', () => withPassives(() => {
  let n = 0;
  for (const hp of [100, 5, 1, 0]) for (const shield of [0, 3, 50]) for (const defense of [0, 2, -1, 12]) for (const raw of [0, 0.99, 7.9, 10, 37.5, 200])
    for (const guarded of [false, true]) for (const perfect of [false, true]) for (const category of ['direct', 'periodic', 'environmental', 'reflected', undefined])
      for (const attacker of [null, ATK]) for (const sturdy of [false, true]) {
        const a = fighter({hp, shield, defense, sturdy}), b = structuredClone(a), c = structuredClone(a);
        const exp = oracle(a, raw, attacker, guarded, perfect, {category});
        const got = resolveDamage({target: b, attacker, rawDamage: raw, sourceKind: sourceKindOf(category), guarded, perfect});
        const label = JSON.stringify({hp, shield, defense, raw, guarded, perfect, category, attacker: !!attacker, sturdy});
        assert.equal(got.hpDamage, exp.hpDamage, label);assert.equal(got.shieldAbsorbed, exp.absorbedByShield, label);assert.equal(got.sturdy, !!exp.sturdy, label);
        assert.deepEqual(b, a, `estado do alvo ${label}`);
        const legacy = processDamageWithShieldAndStages(c, raw, attacker, guarded, perfect, {category});
        assert.deepEqual(legacy, exp, `adaptador ${label}`);assert.deepEqual(c, a, `estado (adaptador) ${label}`);
        n++;
      }
  const d = fighter(), e = structuredClone(d);
  assert.deepEqual(processDamageWithShieldAndStages(null, d, 15, false), oracle(e, 15, null, false), 'sobrecarga legada (atacante, alvo, dano)');assert.deepEqual(d, e);
  assert.ok(n > 10000);
}));

// Conservação: em toda partida IA×IA, o HP perdido num passo = soma do hpDamage dos eventos com aquele alvo − curas registradas.
const DAMAGE_RESULTS = new Set(['impact', 'partial', 'perfect', 'clash', 'footstool', 'wallSplat', 'destructibleSplat', 'statusTick', 'passiveReflect']);
const healOf = (e, id) => (e.result === 'passiveHeal' || e.result === 'statusTick') && e.target === id ? (e.heal ?? 0) : e.result === 'healedHp' && e.fighter === id ? (e.amount ?? 0) : 0;
test('conservação de HP: 6 seeds IA×IA × 3000 passos', () => {
  let steps = 0, hits = 0;const kinds = new Set();
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    resetConfig(defaults());
    const g = new Game({seed});
    if (seed > 3) {   // metade das partidas com Rough Skin + Regenerator, Moves de projétil/área e wall splat com dano: cobre refletido e cura
      C.rules.wallSplatDamage = 5;
      for (const i of [0, 1]) {setPassiveLoadout(g, i, ['rough-skin', 'regenerator']);g.setLoadout(i, ['fire-spin', 'water-pulse', 'swift']);}
      g.reset();
    }
    g.start();g.mode = 'tactical';
    C.extras.toggles.enablePlayerAI = 1;
    for (let t = 0; t < 3000; t++) {
      if (g.phase !== 'playing') break;
      const before = g.fighters.map(f => f.hp);
      g.step(g.playerBrain.command(g.fighters[0], g.fighters[1], 'tactical', C.test.step));
      if (g.phase !== 'playing') break;   // KO/fim de rodada: fora da conta (overkill e reset)
      steps++;
      for (const e of g.lastStepEvents) if (DAMAGE_RESULTS.has(e.result) && (e.damage ?? 0) > 0) {
        hits++;kinds.add(e.result);
        assert.equal(typeof e.hpDamage, 'number', `evento ${e.result} sem hpDamage (seed ${seed}, passo ${t})`);
        assert.equal(typeof e.sourceKind, 'string', `evento ${e.result} sem sourceKind`);
        assert.equal(typeof e.rawDamage, 'number', `evento ${e.result} sem rawDamage`);assert.equal(typeof e.shieldAbsorbed, 'number', `evento ${e.result} sem shieldAbsorbed`);
      }
      for (const f of g.fighters) {
        let dmg = 0, heal = 0;
        for (const e of g.lastStepEvents) {if (e.target === f.id && DAMAGE_RESULTS.has(e.result)) dmg += e.hpDamage ?? e.damage ?? 0;heal += healOf(e, f.id);}
        assert.ok(Math.abs((before[f.id] - f.hp) - (dmg - heal)) < 1e-9,
          `seed ${seed} passo ${t} lutador ${f.id}: perdeu ${before[f.id] - f.hp}, eventos dizem ${dmg} − cura ${heal} — ${JSON.stringify(g.lastStepEvents.filter(e => e.target === f.id || e.fighter === f.id).map(e => [e.result, e.damage, e.heal ?? e.amount]))}`);
      }
    }
  }
  assert.ok(steps > 3000, `passos medidos: ${steps}`);assert.ok(hits > 0, 'houve dano');
  for (const k of ['impact', 'clash', 'footstool', 'passiveReflect']) assert.ok(kinds.has(k), `cobertura: ${k} (vistos: ${[...kinds]})`);
});
