// @ts-check
// Teste de Paridade Determinística dos 3 Pilotos Migrados (Documento 02).
// Compara o rastro de eventos e o estado final do simulador contra os baselines JSON do Documento 01:
//   1. Sand Wave (Portão SW) — baseline revisto em 26/10/2026: o empurrão segue até o fim da barragem
//   2. Bullet Punch (Portão BP)
//   3. Water Pulse PL1, PL2, PL3 (Portão WP)
// Exige 0 divergência mecânica dentro do comportamento atual.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {arena, cmd, vec, secs, HOLD} from './moves-new-helpers.mjs';

const outDir = path.resolve('docs/overhaul-pilotos');
// F3.1: o DamageResolver acrescenta campos de diagnóstico aos eventos de dano (rawDamage/hpDamage/shieldAbsorbed/sourceKind). Os baselines são anteriores:
// só se comparam os campos que o baseline já tinha (a mecânica — damage, HP, posições — segue exigida 100% igual).
const F3_FIELDS = ['rawDamage', 'hpDamage', 'shieldAbsorbed', 'sourceKind'];
const legacyView = (evs, base) => evs.map((e, i) => {const o = {...e};for (const k of F3_FIELDS) if (!(base[i] && k in base[i])) delete o[k];return o;});

console.log('\n--- PARIDADE DETERMINÍSTICA DOS 3 PILOTOS (DOC 02) ---');

// 1. Sand Wave
{
  const baseline = JSON.parse(fs.readFileSync(path.join(outDir, 'baseline_sand-wave.json'), 'utf8'));
  const g = arena({equip: ['sand-wave'], positions: [vec(0, -4), vec(0, -1.5)]});
  const events = [];
  g.step(cmd({skill: 0, skillHeld: HOLD(0)}), cmd());
  for (let i = 1; i < secs(2); i++) {
    g.step(cmd(), cmd());
    if (g.lastStepEvents.length > 0) {
      for (const ev of g.lastStepEvents) events.push({tick: i, ...ev});
    }
  }
  const finalState = {
    targetHp: g.fighters[1].hp,
    targetPosition: {x: g.fighters[1].position.x, z: g.fighters[1].position.z},
    attackerStamina: g.fighters[0].stamina,
    targetStatuses: g.fighters[1].statuses?.map(s => ({id: s.id, duration: s.duration})) ?? []
  };

  assert.deepEqual(legacyView(events, baseline.events), baseline.events, 'Sand Wave: eventos divergentes do baseline');
  assert.deepEqual(finalState, baseline.finalState, 'Sand Wave: estado final divergente do baseline');
  console.log('  ✓ Sand Wave: 100% de paridade determinística com baseline');
}

// 2. Bullet Punch
{
  const baseline = JSON.parse(fs.readFileSync(path.join(outDir, 'baseline_bullet-punch.json'), 'utf8'));
  const g = arena({equip: ['bullet-punch'], positions: [vec(0, -4), vec(0, 0)]});
  const events = [];
  g.step(cmd({skill: 0, skillHeld: HOLD(0)}), cmd());
  g.step(cmd(), cmd());
  for (let i = 2; i < secs(2); i++) {
    g.step(cmd(), cmd());
    if (g.lastStepEvents.length > 0) {
      for (const ev of g.lastStepEvents) events.push({tick: i, ...ev});
    }
  }
  const finalState = {
    targetHp: g.fighters[1].hp,
    targetPosition: {x: g.fighters[1].position.x, z: g.fighters[1].position.z},
    attackerStamina: g.fighters[0].stamina,
    attackerPosition: {x: g.fighters[0].position.x, z: g.fighters[0].position.z}
  };

  assert.deepEqual(legacyView(events, baseline.events), baseline.events, 'Bullet Punch: eventos divergentes do baseline');
  assert.deepEqual(finalState, baseline.finalState, 'Bullet Punch: estado final divergente do baseline');
  console.log('  ✓ Bullet Punch: 100% de paridade determinística com baseline');
}

// 3. Water Pulse (PL1, PL2, PL3)
{
  const baseline = JSON.parse(fs.readFileSync(path.join(outDir, 'baseline_water-pulse.json'), 'utf8'));
  for (const lvl of [1, 2, 3]) {
    const key = `PL${lvl}`;
    const holdSteps = lvl === 1 ? 10 : lvl === 2 ? 95 : 185;
    const g = arena({equip: ['water-pulse'], positions: [vec(0, -4), vec(0, 1)]});
    const events = [];
    g.step(cmd({skill: 0, skillHeld: HOLD(0)}), cmd());
    for (let i = 1; i <= holdSteps; i++) {
      g.step(cmd({skillHeld: HOLD(0)}), cmd());
      if (g.lastStepEvents.length > 0) {
        for (const ev of g.lastStepEvents) events.push({tick: i, ...ev});
      }
    }
    g.step(cmd(), cmd());
    for (let i = holdSteps + 1; i < secs(2.5); i++) {
      g.step(cmd(), cmd());
      if (g.lastStepEvents.length > 0) {
        for (const ev of g.lastStepEvents) events.push({tick: i, ...ev});
      }
    }
    const finalState = {
      targetHp: g.fighters[1].hp,
      attackerStamina: g.fighters[0].stamina,
      targetPosition: {x: g.fighters[1].position.x, z: g.fighters[1].position.z}
    };
    assert.deepEqual(legacyView(events, baseline.levels[key].events), baseline.levels[key].events, `Water Pulse ${key}: eventos divergentes do baseline`);
    assert.equal(finalState.targetHp, baseline.levels[key].targetHp, `Water Pulse ${key}: targetHp divergente`);
    assert.equal(finalState.attackerStamina, baseline.levels[key].attackerStamina, `Water Pulse ${key}: attackerStamina divergente`);
    assert.deepEqual(finalState.targetPosition, baseline.levels[key].targetPosition, `Water Pulse ${key}: targetPosition divergente`);
    console.log(`  ✓ Water Pulse ${key}: 100% de paridade determinística com baseline`);
  }
}

console.log('\nTodos os 3 pilotos validados com 0 divergência mecânica.\n');
