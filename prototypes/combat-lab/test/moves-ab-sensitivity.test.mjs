// @ts-check
// Fase 7 do Overhaul dos Sliders Mecânicos: Testes Automatizados de Sensibilidade A/B,
// Invariância de Captura em Execução (M28.4), Combinações Extremas e Determinismo para os 19 Moves.
// Uso: node prototypes/combat-lab/test/moves-ab-sensitivity.test.mjs
import assert from 'node:assert/strict';
import {C, resetConfig, defaults} from '../src/sim/config.js';
import {Game} from '../src/sim/game.js';
import {emptyCommand} from '../src/sim/entity.js';
import {vec} from '../src/sim/math.js';
import {registerStandardMoves} from '../src/sim/moves/standard.js';
import {EDITABLE_MOVES, editableMove} from '../src/editor/editable-moves.js';
import {traceMove, compareTraces, defaultValues} from '../src/editor/move-trace.js';
import {makeMoveScenario} from '../src/editor/move-editor-model.js';
import {runScenario} from '../src/sim/scenarios.js';

registerStandardMoves();

let passed = 0, failed = 0;
function test(/** @type {string} */ name, /** @type {() => void} */ fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    const e = /** @type {Error} */ (err);
    console.error(`  ✗ ${name}\n    ${(e.stack || e.message).split('\n').slice(0, 4).join('\n    ')}`);
    process.exitCode = 1;
  }
}

console.log('\n--- SENSIBILIDADE A/B, CAPTURA M28.4 E EXTREMOS DOS 19 MOVES ---\n');

// 1. Sensibilidade A/B de parâmetros exclusivos em todos os 19 Moves
test('A/B: todos os 19 Moves alteram resultado mecânico mensurável quando seus parâmetros exclusivos mudam', () => {
  /** @type {Array<{id: string, stage?: any, key: string, valB: number, verify?: (A: any, B: any, m: any) => boolean}>} */
  const cases = [
    {id: 'quick-attack', key: 'damage', valB: 16},
    {id: 'quick-attack', stage: {distance: 4, target: 'still'}, key: 'approachStopDist', valB: 2.5},
    {id: 'emerging-stone', stage: {distance: 5, target: 'still', hold: 0.35}, key: 'damage', valB: 18},
    {id: 'emerging-stone', key: 'rockHp', valB: 45, verify: () => {
      resetConfig(defaults());
      C.world.emergingStone.rockHp = 45;
      C.world.emergingStone.rockBaseWidth = 3.6;
      const g = new Game({seed: 7});g.start();
      g.mapState.destructibles = [];g.mapState.obstacles = [];g.mapState.platforms = [];
      g.fighters[0].position = vec(0, -8);g.fighters[1].position = vec(0, 30);
      g.fighters[0].facing = 0;g.fighters[1].facing = Math.PI;
      g.setLoadout(0, ['emerging-stone']);
      for (let t = 0; t < 200; t++) {
        const isHold = t >= 1 && t <= 70;
        g.step(isHold ? {...emptyCommand(), skill: t === 1 ? 0 : null, skillHeld: [true, false, false, false]} : emptyCommand(), emptyCommand());
      }
      const rock = g.mapState.destructibles.find(d => d.rock);
      return !!rock && rock.hp === 45 && Math.abs(rock.size.hx - 1.8) < 1e-6;
    }},
    {id: 'sand-wave', key: 'damage', valB: 15},
    {id: 'sand-wave', key: 'waveHeight', valB: 2.5, verify: () => {
      resetConfig(defaults());
      C.world.sandWave.waveHeight = 2.5;
      const g = new Game({seed: 7});g.start();
      g.setLoadout(0, ['sand-wave']);
      g.step({...emptyCommand(), target: 1, skill: 0, skillHeld: [true, false, false, false]}, emptyCommand());
      for (let t = 0; t < 40; t++) g.step(emptyCommand(), emptyCommand());
      const w = g.world.entities.find(e => e.kind === 'sandwave');
      return !!w && Math.abs(w.height - 2.5) < 1e-6;
    }},
    {id: 'bullet-punch', key: 'cast', valB: 1.4},
    {id: 'bounce', key: 'damage', valB: 18},
    {id: 'water-pulse', stage: {distance: 3, target: 'still', hold: 0.3}, key: 'damagePl1', valB: 15},
    {id: 'water-pulse', stage: {distance: 3, target: 'still', hold: 1.0}, key: 'damagePl2', valB: 20},
    {id: 'psyshock', key: 'damageFraction', valB: 0.9},
    {id: 'reflect', stage: {distance: 3, hold: 1.2}, key: 'durationBase', valB: 9},
    {id: 'fire-spin', key: 'damage', valB: 6},
    {id: 'seed-bomb', key: 'damage', valB: 14},
    {id: 'swift', key: 'damage', valB: 10},
    {id: 'air-slash', key: 'damage', valB: 14},
    {id: 'air-slash', key: 'pierce', valB: 3, verify: () => {
      resetConfig(defaults());
      C.world.airSlash.pierce = 3;
      const g = new Game({seed: 7});g.start();
      g.setLoadout(0, ['air-slash']);
      g.step({...emptyCommand(), target: 1, skill: 0, skillHeld: [true, false, false, false]}, emptyCommand());
      for (let t = 0; t < 35; t++) g.step(emptyCommand(), emptyCommand());
      const p = g.world.entities.find(e => e.kind === 'projectile');
      return !!p && p.pierce === 3;
    }},
    {id: 'harden', key: 'duration', valB: 10},
    {id: 'second-wind', key: 'duration', valB: 9},
    {id: 'second-wind', key: 'regenPctPerSecond', valB: 1.5, verify: () => {
      const stamWith = (rate, regenInterval) => {
        resetConfig(defaults());
        C.world.secondWind.regenPctPerSecond = rate;
        C.world.secondWind.regenInterval = regenInterval;
        const g = new Game({seed: 7});g.start();
        g.fighters[0].stamina = 1.05;
        g.setLoadout(0, ['second-wind']);
        g.step({...emptyCommand(), skill: 0, skillHeld: [true, false, false, false]}, emptyCommand());
        for (let t = 0; t < 66; t++) g.step(emptyCommand(), emptyCommand());
        return g.fighters[0].stamina;
      };
      return stamWith(1.5, 0.1) > stamWith(0.1, 0.1) + 0.5;
    }},
    {id: 'guard-break', stage: {distance: 2.2, target: 'guard', hold: 0.6}, key: 'damage', valB: 18},
    {id: 'lunge', key: 'damage', valB: 15},
    {id: 'feint', key: 'cooldown', valB: 14},
    {id: 'riposte', stage: {distance: 2.2, target: 'tackle'}, key: 'damage', valB: 20},
    {id: 'spikes', stage: {distance: 12, hold: 0.35}, key: 'lifetime', valB: 16},
  ];

  for (const c of cases) {
    resetConfig(defaults());
    const m = editableMove(c.id);
    assert.ok(m, `Move ${c.id} encontrado`);
    const base = defaultValues(m);
    const mod = {...base, [c.key]: c.valB};
    const st = c.stage ?? {distance: 3, target: 'still', hold: m.def.charge ? 1.2 : m.def.aimMode ? 0.35 : 0};
    const A = traceMove(m, st, base);
    const B = traceMove(m, st, mod);
    if (c.verify) {
      assert.ok(c.verify(A, B, m), `Sensibilidade específica verificada para ${c.id}.${c.key}`);
      continue;
    }
    const diffs = compareTraces(A, B).filter(r => r.delta !== null && r.delta !== 0);
    const laneDiff = JSON.stringify(A.lanes) !== JSON.stringify(B.lanes);
    assert.ok(diffs.length > 0 || laneDiff, `Esperava diferença A/B ao mudar ${c.id}.${c.key} para ${c.valB}`);
  }
  resetConfig(defaults());
});

// 2. Invariância em meio à execução (Regra M28.4)
test('M28.4: alterar C.world[group] após o início da execução não corrompe nem altera a execução já iniciada', () => {
  for (const id of ['sand-wave', 'air-slash', 'swift', 'fire-spin', 'harden']) {
    resetConfig(defaults());
    const m = editableMove(id);
    // Execução 1: sem mutação no meio
    const runClean = () => {
      resetConfig(defaults());
      const g = new Game({seed: 11});g.start();
      g.fighters[0].position = vec(0, -1.5);g.fighters[1].position = vec(0, 1.5);
      g.fighters[0].facing = 0;g.fighters[1].facing = Math.PI;
      g.setLoadout(0, [id]);
      for (let t = 0; t < 120; t++) {
        g.step(t === 1 ? {...emptyCommand(), target: 1, skill: 0, skillHeld: [true, false, false, false]} : {...emptyCommand(), target: 1}, emptyCommand());
      }
      return {hp1: g.fighters[1].hp, stam0: g.fighters[0].stamina, cd0: g.fighters[0].moveCooldowns[id]};
    };
    // Execução 2: muta cost e cooldown logo depois do tick 1 (quando a ação já cobrou custo/recarga e capturou params)
    const runMutatedMidFlight = () => {
      resetConfig(defaults());
      const g = new Game({seed: 11});g.start();
      g.fighters[0].position = vec(0, -1.5);g.fighters[1].position = vec(0, 1.5);
      g.fighters[0].facing = 0;g.fighters[1].facing = Math.PI;
      g.setLoadout(0, [id]);
      for (let t = 0; t < 120; t++) {
        g.step(t === 1 ? {...emptyCommand(), target: 1, skill: 0, skillHeld: [true, false, false, false]} : {...emptyCommand(), target: 1}, emptyCommand());
        if (t === 40) {
          // Muta depois que a ação/projétil já nasceu (tick 40 > cast de 0.25s = 30 ticks)
          C.world[m.group].cost = 4.9;
          C.world[m.group].cooldown = 55;
          if ('damage' in C.world[m.group]) C.world[m.group].damage = 99;
        }
      }
      return {hp1: g.fighters[1].hp, stam0: g.fighters[0].stamina, cd0: g.fighters[0].moveCooldowns[id]};
    };
    assert.deepEqual(runClean(), runMutatedMidFlight(), `Execução em andamento de ${id} permaneceu imune a edições após o disparo`);
  }
  resetConfig(defaults());
});

// 3. Estabilidade em combinações extremas (todos os sliders no mínimo e no máximo)
test('Estabilidade em extremos: todos os 19 Moves rodam com parâmetros no mínimo e no máximo sem NaN nem exceção', () => {
  for (const m of EDITABLE_MOVES) {
    for (const mode of ['min', 'max']) {
      resetConfig(defaults());
      for (const r of m.params.rows) {
        if (String(r.key).startsWith('hitShake')) continue;
        if (r.key === 'cost' && mode === 'max') {
          C.world[m.group][r.key] = Math.min(r.max, 3); // permite ativar com a stamina padrão
          continue;
        }
        C.world[m.group][r.key] = mode === 'min' ? r.min : r.max;
      }
      const res = runScenario(makeMoveScenario(m, {distance: 3, target: 'still'}));
      assert.ok(Array.isArray(res.checks) && res.checks.length >= 9, `${m.id} (${mode}) retornou checks válidos`);
      for (const chk of res.checks) {
        assert.ok(!String(chk.actual).includes('NaN'), `${m.id} (${mode}) sem NaN em ${chk.label}: ${chk.actual}`);
      }
    }
  }
  resetConfig(defaults());
});

// 4. Determinismo estrito do traceMove
test('Determinismo: duas análises seguidas de qualquer Move produzem exatamente os mesmos hits, faixas e métricas', () => {
  resetConfig(defaults());
  for (const m of EDITABLE_MOVES) {
    const vals = defaultValues(m);
    const st = {distance: 3.5, target: 'still', arena: 'open', hold: m.def.charge ? 1.1 : m.def.aimMode ? 0.3 : 0};
    const t1 = traceMove(m, st, vals);
    const t2 = traceMove(m, st, vals);
    assert.deepEqual(t1, t2, `Trace determinístico para ${m.id}`);
  }
});

console.log(`\n${passed} passaram, ${failed} falharam`);
if (failed > 0) process.exit(1);
