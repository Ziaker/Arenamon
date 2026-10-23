// Benchmark da SIMULAÇÃO com carga de Moves (#15 do plano de 23/10/2026): estende a linha de base de 16/10 (mundo vazio) com cenários que têm
// projéteis, áreas, reflexões e o máximo de entidades. Mede só CPU de simulação em Node (passo fixo de 120 Hz); NÃO mede GPU, draw calls, VFX
// nem FPS de render: isso exige navegador com GPU real (painel Visualizar › Desempenho) e números de uma máquina não valem para outra.
// Uso:  node prototypes/combat-lab/bench-moves.mjs [--repeats 3] [--ticks 1800] [--write]   (--write grava docs/DESEMPENHO_MOVES_<data>.md)
import os from 'node:os';
import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {C, defaults, resetConfig} from './src/sim/config.js';
import {Game} from './src/sim/game.js';
import {emptyCommand} from './src/sim/entity.js';
import {registerStandardMoves} from './src/sim/moves/standard.js';
import {spawn} from './src/sim/world.js';

const now = () => Number(process.hrtime.bigint()) / 1e3;   // µs
const pct = (a, p) => {const s = [...a].sort((x, y) => x - y);return s[Math.min(s.length - 1, Math.floor(p * s.length))];};
const cmd = o => ({...emptyCommand(), ...o});
const held = slot => Array.from({length: C.world.slots}, (_, i) => i === slot);

/** Cenários: cada um monta o jogo e devolve (tick) → [comandoAzul, comandoVermelho | undefined]. */
export const SCENARIOS = [
  {id: 'ia-sem-moves', label: 'IA × IA, nenhum Move equipado (baseline)', build: () => {const g = start({ai: true});return {g, drive: () => [g.playerBrain.command(g.fighters[0], g.fighters[1], 'tactical', C.test.step), undefined]};}},
  {id: 'ia-todos-os-moves', label: 'IA × IA com 4 Moves equipados em cada lado', build: () => {
    const g = start({ai: true});g.setLoadout(0, ['swift', 'water-pulse', 'air-slash', 'harden']);g.setLoadout(1, ['fire-spin', 'seed-bomb', 'quick-attack', 'guard-break']);
    return {g, drive: () => [g.playerBrain.command(g.fighters[0], g.fighters[1], 'tactical', C.test.step), undefined]};}},
  {id: 'swift-metralhadora', label: 'Swift repetido (stamina infinita): muitos projéteis', build: () => {
    const g = start({ai: false, far: true});C.extras.toggles.enableInfiniteStamina = 1;C.world.swift.cooldown = .05;g.setLoadout(0, ['swift']);
    return {g, drive: t => [t % 20 === 0 ? cmd({skill: 0, skillHeld: held(0)}) : cmd(), undefined]};}},
  {id: 'zonas-fire-spin', label: 'Fire Spin repetido: várias zonas de pulso ativas', build: () => {
    const g = start({ai: false, far: false});C.extras.toggles.enableInfiniteStamina = 1;C.world.fireSpin.cooldown = .05;g.setLoadout(0, ['fire-spin']);
    return {g, drive: t => [t % 90 < 30 ? cmd({skill: t % 90 === 0 ? 0 : null, skillHeld: held(0)}) : cmd(), undefined]};}},
  {id: 'reflect-x-projeteis', label: 'Reflect do azul contra projéteis do vermelho', build: () => {
    const g = start({ai: false, far: false});C.extras.toggles.enableInfiniteStamina = 1;C.world.swift.cooldown = .05;g.setLoadout(0, ['reflect']);g.setLoadout(1, ['swift']);
    return {g, drive: t => [t % 200 < 60 ? cmd({skill: t % 200 === 0 ? 0 : null, skillHeld: held(0)}) : cmd(), t % 30 === 0 ? cmd({skill: 0, skillHeld: held(0), move: {x: 0, z: -1}}) : cmd({move: {x: 0, z: -1}})]};}},
  {id: 'entidades-no-limite', label: `Mundo no limite de entidades (C.world.maxEntities)`, build: () => {
    const g = start({ai: false, far: true});
    for (let i = 0; i < C.world.maxEntities; i++) spawn(g.world, {kind: 'projectile', owner: 1, pos: {x: -9 + (i % 16) * 1.2, z: 9 - Math.floor(i / 16) * 1.2}, dir: {x: 0, z: -1}, speed: 2, life: 60, pierce: 1, hit: {damage: 0}}, []);
    return {g, drive: () => [cmd(), undefined]};}},
];

function start({ai, far = false}) {
  resetConfig(defaults());registerStandardMoves();
  C.extras.toggles.enableEnemyAI = ai ? 1 : 0;
  const g = new Game({seed: 11});g.brain.seed = 11;g.playerBrain.seed = 18;g.mode = 'tactical';g.start();g.reset({positions: far ? [{x: 0, z: -9}, {x: 0, z: 9}] : [{x: 0, z: -3}, {x: 0, z: 3}]});
  g.mapState.platforms = [];g.mapState.obstacles = [];g.mapState.destructibles = [];g.mapState.items = [];
  return g;
}

/** Roda um cenário `ticks` passos e devolve µs por passo (um valor por passo). */
function once(sc, ticks) {
  const {g, drive} = sc.build();
  const us = [];
  const heap0 = process.memoryUsage().heapUsed;
  let entities = 0;
  for (let t = 0; t < ticks && g.phase !== 'result'; t++) {
    const [a, b] = drive(t);
    const t0 = now();g.step(a, b);us.push(now() - t0);
    entities = Math.max(entities, g.world.entities.length);
  }
  return {us, entities, heapDeltaKB: Math.round((process.memoryUsage().heapUsed - heap0) / 1024)};
}

export function runBench({repeats = 3, ticks = 1800, only = null} = {}) {
  const budget = Math.round(C.test.step * 1e6);
  const rows = [];
  for (const sc of SCENARIOS) {
    if (only && !only.includes(sc.id)) continue;
    once(sc, Math.min(ticks, 300));   // aquecimento (JIT)
    const reps = Array.from({length: repeats}, () => once(sc, ticks));
    const medians = reps.map(r => pct(r.us, .5));
    const all = reps.flatMap(r => r.us);
    const mean = medians.reduce((s, x) => s + x, 0) / medians.length;
    const cv = mean > 0 ? Math.sqrt(medians.reduce((s, x) => s + (x - mean) ** 2, 0) / medians.length) / mean : 0;
    rows.push({id: sc.id, label: sc.label, ticks: all.length, p50: +pct(all, .5).toFixed(2), p95: +pct(all, .95).toFixed(2), p99: +pct(all, .99).toFixed(2), max: +Math.max(...all).toFixed(1),
      budgetPctP95: +(pct(all, .95) / budget * 100).toFixed(3), stepsPerSecond: Math.round(1e6 / (pct(all, .5) || 1)), maxEntities: Math.max(...reps.map(r => r.entities)), heapDeltaKB: Math.round(reps.reduce((s, r) => s + r.heapDeltaKB, 0) / reps.length),
      repeatNoisePct: +(cv * 100).toFixed(1), noisy: cv > .15});
  }
  return {env: {node: process.version, platform: `${process.platform} ${process.arch}`, cpu: os.cpus()[0]?.model ?? '?', cores: os.cpus().length, gpu: 'não medida (simulação em Node)'}, repeats, ticks, budgetUsPerStep: budget, rows, generatedAt: new Date().toISOString()};
}

export function toMarkdown(r) {
  const date = r.generatedAt.slice(0, 10);
  return `# Desempenho da simulação com carga de Moves (${date})

> Gerado por \`node prototypes/combat-lab/bench-moves.mjs --write\` (#15 do plano de 23/10/2026). **Só CPU da simulação em Node**: não mede GPU, draw calls, VFX, FPS nem P95 de render. Números de uma máquina não valem para outra; compare apenas execuções no MESMO computador.

**Ambiente:** ${r.env.cpu} · ${r.env.cores} núcleos · ${r.env.platform} · Node ${r.env.node} · GPU: ${r.env.gpu}.
**Método:** ${r.repeats} repetições de ${r.ticks} passos por cenário (mais aquecimento), tempo de cada \`game.step\` com \`process.hrtime\`. Orçamento de um passo a 120 Hz: **${r.budgetUsPerStep} µs**.

| Cenário | P50 µs | P95 µs | P99 µs | Máx µs | P95 / orçamento | Passos/s (P50) | Entidades (máx) | Heap Δ KB | Ruído entre repetições |
|---|---|---|---|---|---|---|---|---|---|
${r.rows.map(x => `| ${x.label} | ${x.p50} | ${x.p95} | ${x.p99} | ${x.max} | ${x.budgetPctP95}% | ${x.stepsPerSecond.toLocaleString('pt-BR')} | ${x.maxEntities} | ${x.heapDeltaKB} | ${x.repeatNoisePct}%${x.noisy ? ' ⚠ alto' : ''} |`).join('\n')}

## Leitura

- Quando o P95 é uma fração pequena do orçamento, a simulação **não é o gargalo** e não há motivo para otimizá-la; o limite de FPS vem do desenho (GPU/VFX), que este benchmark não vê.
- "Ruído entre repetições" é o desvio relativo das medianas das repetições; acima de 15% o resultado é marcado e deve ser repetido antes de qualquer conclusão.
- Nada aqui altera física, dano ou tick: é só medição. Otimizações só entram com meta aprovada e medição antes/depois no mesmo computador.

## Pendente (não medido)

1. FPS, P95 de quadro, draw calls, memória e GC do **navegador** com GPU real (aba Visualizar › Desempenho); o medidor existe, falta rodar nas máquinas-alvo.
2. Metas por perfil de máquina (decisão do responsável).
`;
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('bench-moves.mjs')) {
  const arg = (n, d) => {const i = process.argv.indexOf('--' + n);return i > 0 ? Number(process.argv[i + 1]) : d;};
  const r = runBench({repeats: arg('repeats', 3), ticks: arg('ticks', 1800)});
  console.log(toMarkdown(r));
  if (process.argv.includes('--write')) {
    const p = fileURLToPath(new URL(`../../docs/DESEMPENHO_MOVES_${r.generatedAt.slice(0, 10)}.md`, import.meta.url));
    writeFileSync(p, toMarkdown(r));console.log('\nGravado:', p);
  }
}
