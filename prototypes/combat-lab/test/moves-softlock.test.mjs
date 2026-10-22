// Regressão do softlock do Bullet Punch (checklist item 9, 22/10/2026) + varredura de travamentos de TODOS os Moves.
// Causa: o lutador «ausente» (invisível e intangível) caía da borda da plataforma durante a viagem do Bullet Punch (queda R7.10), o que apagava a ação e deixava `absent` ligado para sempre.
// Correções: a física não derruba quem está ausente (physics.js) e updateFighter encerra a ausência se a ação de viagem sumir (controller.js).
import assert from 'node:assert/strict';
import {cmd, vec, arena, HOLD} from './moves-new-helpers.mjs';
{
  const g = arena({equip: ['bullet-punch'], positions: [vec(0, -2), vec(0, 1.5)]});
  g.mapState.platforms = [{id: 'p', pos: {x: 0, y: 0, z: 0}, width: 5, depth: 5, height: .5}, {id: 'q', pos: {x: 0, y: 0, z: 6}, width: 3, depth: 3, height: .25}];
  const f = g.fighters[0];f.groundY = .5;
  g.step(cmd({skill: 0, skillHeld: HOLD(0), move: vec(0, 1)}), cmd());
  for (let i = 1; i < 160; i++) g.step(cmd({skillHeld: HOLD(0), move: vec(0, 1)}), cmd());
  g.step(cmd(), cmd());
  for (let i = 0; i < 400; i++) g.step(cmd(), cmd());
  assert.equal(!!f.absent, false, 'Bullet Punch em plataforma: o lutador não pode ficar ausente para sempre');
  console.log('  ✓ Bullet Punch partindo de plataforma e viajando sobre a borda reaparece');
}
import {C, defaults, resetConfig} from '../src/sim/config.js';
import {Game} from '../src/sim/game.js';
import {emptyCommand} from '../src/sim/entity.js';
import {isInvulnerable} from '../src/sim/entity.js';
import {registerStandardMoves} from '../src/sim/moves/standard.js';
import {NEW_MOVE_IDS} from '../src/sim/moves/new-moves.js';
const all = ['reflect', 'psyshock', ...NEW_MOVE_IDS];
let s0 = 12345; const rnd = () => ((s0 = (s0 * 1664525 + 1013904223) >>> 0) / 4294967296);
const found = {};
const mark = (k, c) => {found[k] ??= {n: 0, c}; found[k].n++;};
const N = Number(process.argv[2] ?? 12);
for (let run = 0; run < N; run++) {
  resetConfig(defaults()); registerStandardMoves();
  C.extras.toggles.enableEnemyAI = 0;
  const g = new Game({seed: run + 1}); g.start();
  const pick = () => Array.from({length: 4}, () => all[Math.floor(rnd() * all.length)]);
  g.setLoadout(0, pick()); g.setLoadout(1, pick());
  const state = [{move: {x: 0, z: 0}, hold: null, until: 0}, {move: {x: 0, z: 0}, hold: null, until: 0}];
  const since = new Map();
  const cmdFor = (i, t) => {
    const st = state[i], c = emptyCommand();
    if (t >= st.until) {
      st.until = t + 10 + Math.floor(rnd() * 90);
      const a = rnd() * Math.PI * 2; st.move = rnd() < .3 ? {x: 0, z: 0} : {x: Math.sin(a), z: Math.cos(a)};
      st.hold = rnd() < .5 ? Math.floor(rnd() * 4) : null; st.guard = rnd() < .12;
    }
    c.move = st.move; c.guard = !!st.guard;
    if (st.hold != null) {c.skillHeld = [0, 1, 2, 3].map(k => k === st.hold); if (t === st.until - 1 || t % 97 === 0) c.skill = st.hold;}
    if (rnd() < .01) {c.tackle = true;c.tackleHeld = true;}
    if (rnd() < .012) {c.dodge = true;c.dodgeHeld = true;}
    if (rnd() < .012) {c.jump = true;c.jumpHeld = true;}
    return c;
  };
  for (let t = 0; t < 5400 && g.phase === 'playing'; t++) {
    g.step(cmdFor(0, t), cmdFor(1, t));
    for (const f of g.fighters) {
      if (f.hp <= 0) continue;
      const conds = {absent: [!!f.absent, 120], acaoLonga: [!!f.action, 1000], voo: [!!f.flight, 900], invulneravel: [isInvulnerable(f), 360], mira: [!!f.aim, 1500], carga: [!!f.charge, 1500], recuperacao: [(f.knockRecovery ?? 0) > 0 || (f.moveRecovery ?? 0) > 0, 600]};
      for (const [k, [on, lim]] of Object.entries(conds)) {
        const key = f.id + k, v = since.get(key);
        if (on) { if (v === undefined) since.set(key, t); else if (t - v > lim) {mark(`${k} preso`, `run ${run + 1} t=${t} loadout=${f.loadout} act=${f.action?.kind}/${f.action?.move} flight=${!!f.flight}`);since.delete(key);} }
        else since.delete(key);
      }
    }
  }
}
assert.deepEqual(found, {}, 'travamentos: ' + JSON.stringify(found));
console.log(`  ✓ nenhum travamento (ausência, ação, voo, invulnerabilidade, mira, carga, recuperação) em ${N} partidas aleatórias com os 15 Moves`);
