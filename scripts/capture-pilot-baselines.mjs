import fs from 'node:fs';
import path from 'node:path';
import {arena, cmd, vec, secs, run, HOLD} from '../prototypes/combat-lab/test/moves-new-helpers.mjs';
import {C} from '../prototypes/combat-lab/src/sim/config.js';

const outDir = path.resolve('docs/overhaul-pilotos');
fs.mkdirSync(outDir, {recursive: true});

// 1. Sand Wave Baseline
{
  const g = arena({equip: ['sand-wave'], positions: [vec(0, -4), vec(0, -1.5)]});
  const trace = {
    moveId: 'sand-wave',
    defaultParams: {...C.world.sandWave},
    events: [],
    ticks: []
  };
  g.step(cmd({skill: 0, skillHeld: HOLD(0)}), cmd());
  for (let i = 1; i < secs(2); i++) {
    g.step(cmd(), cmd());
    if (g.lastStepEvents.length > 0) {
      for (const ev of g.lastStepEvents) {
        trace.events.push({tick: i, ...ev});
      }
    }
  }
  trace.finalState = {
    targetHp: g.fighters[1].hp,
    targetPosition: {x: g.fighters[1].position.x, z: g.fighters[1].position.z},
    attackerStamina: g.fighters[0].stamina,
    targetStatuses: g.fighters[1].statuses?.map(s => ({id: s.id, duration: s.duration})) ?? []
  };
  fs.writeFileSync(path.join(outDir, 'baseline_sand-wave.json'), JSON.stringify(trace, null, 2));
  console.log('Saved baseline_sand-wave.json');
}

// 2. Bullet Punch Baseline
{
  const g = arena({equip: ['bullet-punch'], positions: [vec(0, -4), vec(0, 0)]});
  const trace = {
    moveId: 'bullet-punch',
    defaultParams: {...C.world.bulletPunch},
    events: [],
    ticks: []
  };
  // Tap button: press then release to execute
  g.step(cmd({skill: 0, skillHeld: HOLD(0)}), cmd());
  g.step(cmd(), cmd());
  for (let i = 2; i < secs(2); i++) {
    g.step(cmd(), cmd());
    if (g.lastStepEvents.length > 0) {
      for (const ev of g.lastStepEvents) {
        trace.events.push({tick: i, ...ev});
      }
    }
  }
  trace.finalState = {
    targetHp: g.fighters[1].hp,
    targetPosition: {x: g.fighters[1].position.x, z: g.fighters[1].position.z},
    attackerStamina: g.fighters[0].stamina,
    attackerPosition: {x: g.fighters[0].position.x, z: g.fighters[0].position.z}
  };
  fs.writeFileSync(path.join(outDir, 'baseline_bullet-punch.json'), JSON.stringify(trace, null, 2));
  console.log('Saved baseline_bullet-punch.json');
}

// 3. Water Pulse Baseline (PL1, PL2, PL3)
{
  const trace = {
    moveId: 'water-pulse',
    defaultParams: {...C.world.waterPulse},
    levels: {}
  };
  for (const lvl of [1, 2, 3]) {
    const holdSteps = lvl === 1 ? 10 : lvl === 2 ? 95 : 185;
    const g = arena({equip: ['water-pulse'], positions: [vec(0, -4), vec(0, 1)]});
    const lvlEvents = [];
    g.step(cmd({skill: 0, skillHeld: HOLD(0)}), cmd());
    for (let i = 1; i <= holdSteps; i++) {
      g.step(cmd({skillHeld: HOLD(0)}), cmd());
      if (g.lastStepEvents.length > 0) {
        for (const ev of g.lastStepEvents) lvlEvents.push({tick: i, ...ev});
      }
    }
    // Release
    g.step(cmd(), cmd());
    for (let i = holdSteps + 1; i < secs(2.5); i++) {
      g.step(cmd(), cmd());
      if (g.lastStepEvents.length > 0) {
        for (const ev of g.lastStepEvents) lvlEvents.push({tick: i, ...ev});
      }
    }
    trace.levels[`PL${lvl}`] = {
      events: lvlEvents,
      targetHp: g.fighters[1].hp,
      attackerStamina: g.fighters[0].stamina,
      targetPosition: {x: g.fighters[1].position.x, z: g.fighters[1].position.z}
    };
  }
  fs.writeFileSync(path.join(outDir, 'baseline_water-pulse.json'), JSON.stringify(trace, null, 2));
  console.log('Saved baseline_water-pulse.json');
}
