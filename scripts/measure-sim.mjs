// Linha de base de desempenho da SIMULAÇÃO do laboratório de combate (Node, sem renderização). Só mede; não altera nada.
// Mede o custo por passo de 120 Hz em lutas IA × IA (tática, sementes fixas) e o custo isolado da simulação (sem IA do azul).
// NÃO mede GPU, draw calls, VFX nem tempo de abertura do HTML (isso exige navegador/GPU reais). Resultados dependem da máquina:
// compare apenas execuções na MESMA máquina. Uso: node scripts/measure-sim.mjs [--matches 12] [--rounds 5] [--json]
import {C, defaults, resetConfig} from '../prototypes/combat-lab/src/sim/config.js';
import {Game} from '../prototypes/combat-lab/src/sim/game.js';
import {emptyCommand} from '../prototypes/combat-lab/src/sim/entity.js';

const arg = (name, def) => {const i = process.argv.indexOf('--' + name);return i > 0 ? Number(process.argv[i + 1]) : def;};
const MATCHES = arg('matches', 12), ROUNDS = arg('rounds', 5), MAX_STEPS = 2400, asJson = process.argv.includes('--json');
const now = () => Number(process.hrtime.bigint()) / 1e6;
const pct = (a, p) => {const s = [...a].sort((x, y) => x - y);return s[Math.min(s.length - 1, Math.floor(p * s.length))];};
const median = a => pct(a, .5);

function fight(seed, withAI) {
  resetConfig(defaults());
  const g = new Game({seed});g.brain.seed = seed;g.playerBrain.seed = seed + 7;g.mode = 'tactical';g.reset();
  let steps = 0;const t0 = now();
  for (; steps < MAX_STEPS && g.phase === 'playing'; steps++) {
    const cmd = withAI ? g.playerBrain.command(g.fighters[0], g.fighters[1], 'tactical', C.test.step) : emptyCommand();
    g.step(cmd);
  }
  return {steps, ms: now() - t0, tick: g.tick, winner: g.winner};
}

const result = {node: process.version, platform: `${process.platform} ${process.arch}`, matches: MATCHES, rounds: ROUNDS, maxSteps: MAX_STEPS, budgetUsPerStep: Math.round(C.test.step * 1e6), modes: {}};
for (const [label, withAI] of [['ia_x_ia', true], ['sim_sem_ia_do_azul', false]]) {
  for (let i = 0; i < 2; i++) fight(100 + i, withAI); // aquecimento (JIT)
  const perRound = [];
  for (let r = 0; r < ROUNDS; r++) {
    let steps = 0, ms = 0;
    for (let m = 0; m < MATCHES; m++) {const x = fight(1 + m, withAI);steps += x.steps;ms += x.ms;}
    perRound.push({usPerStep: ms * 1000 / steps, stepsPerSec: steps / (ms / 1000), steps});
  }
  const us = perRound.map(x => x.usPerStep), sps = median(perRound.map(x => x.stepsPerSec));
  if (new Set(perRound.map(x => x.steps)).size !== 1) throw new Error("lutas não determinísticas entre rodadas: a medição não é comparável");
  result.modes[label] = {usPerStepMedian: +median(us).toFixed(2), usPerStepP95: +pct(us, .95).toFixed(2), usPerStepMin: +Math.min(...us).toFixed(2), usPerStepMax: +Math.max(...us).toFixed(2),
    stepsPerSecMedian: Math.round(sps), stepsPerRound: perRound[0].steps, realTimeFactor: +(sps / 120).toFixed(1)};
}
resetConfig(defaults());
const mu = process.memoryUsage();result.heapUsedMB = +(mu.heapUsed / 1048576).toFixed(1);result.note = 'heapUsed sem GC forçado: indicativo apenas';

if (asJson) console.log(JSON.stringify(result, null, 2));
else {
  console.log(`Simulação do laboratório — ${result.node} · ${result.platform} · ${MATCHES} lutas × ${ROUNDS} rodadas (≤ ${MAX_STEPS} passos)`);
  console.log(`Orçamento de um passo a 120 Hz: ${result.budgetUsPerStep} µs\n`);
  for (const [k, v] of Object.entries(result.modes)) console.log(`${k.padEnd(20)} mediana ${String(v.usPerStepMedian).padStart(7)} µs/passo · P95 ${String(v.usPerStepP95).padStart(7)} · mín ${v.usPerStepMin} · máx ${v.usPerStepMax} · ${v.stepsPerSecMedian.toLocaleString('pt-BR')} passos/s · ${v.realTimeFactor}× tempo real`);
  console.log(`\nheapUsed ≈ ${result.heapUsedMB} MB (sem GC forçado; indicativo). Não inclui renderização, VFX nem GPU.`);
}
