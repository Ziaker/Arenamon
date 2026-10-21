// @ts-check
// Fase 5: critérios de aprovação de cada cenário (usados pelo laboratório e pelo teste em Node) e execução da bateria.
import {POC_IDS, POC_SCENARIOS} from './poc-scenarios.js';
import {runArenamon} from './poc-arenamon.js';
import {runRapier, rapierDefaults} from './poc-rapier.js';

/** Motores comparados. */
export const ENGINES = [
  {id: 'arenamon', label: 'Arenamon (atual)'},
  {id: 'box', label: 'Rapier · caixa'},
  {id: 'capsule', label: 'Rapier · cápsula'},
];
/** Tolerância de penetração: 2 cm (o Arenamon tem tolerância de degrau de 0,25 m POR PROJETO ao montar plataformas). */
export const PEN_TOL = .02, MOUNT_TOL = .25;
const near = (v, t, e) => Math.abs(v - t) <= e;

/** Critérios por cenário: [descrição, função(r, engine) → boolean]. */
export const CRITERIA = {
  queda: [['pousa em y ≈ 0 (±2 cm)', r => near(r.final.y, 0, .02)], ['em repouso sem tremor (< 0,5 mm)', r => r.jitter.y < .5]],
  salto_plataforma: [['termina em cima da plataforma (y ≈ 1,0)', r => near(r.final.y, 1, .02)], ['penetração dentro da tolerância', (r, e) => r.penetration <= (e === 'arenamon' ? MOUNT_TOL : PEN_TOL)]],
  parede_lateral: [['não atravessa o bloco', r => r.penetration <= PEN_TOL]],
  teto: [['cabeça para na laje (pés ≤ 0,31 m)', r => near(r.maxY, .3, .02)], ['não penetra a laje', r => r.penetration <= PEN_TOL]],
  pilar: [['contorna o pilar (passa de z = 6)', r => r.final.z > 6], ['não penetra o pilar', r => r.penetration <= PEN_TOL]],
  tunel: [['não atravessa a parede fina (z ≤ 5,41)', r => r.final.z <= 5.41], ['sem penetração', r => r.penetration <= PEN_TOL]],
  borda: [['cai pela borda e termina no chão', r => near(r.final.y, 0, .02)], ['penetração dentro da tolerância', (r, e) => r.penetration <= (e === 'arenamon' ? MOUNT_TOL : e === 'capsule' ? .15 : PEN_TOL)]],
};

/** Executa um cenário nos três motores. */
export function runAll(RAPIER, id, opts = rapierDefaults(), tweak = null) {
  const sc = POC_SCENARIOS[id];
  return {
    arenamon: runArenamon(sc, {tweak}),
    box: runRapier(RAPIER, sc, {opts: {...opts, shape: 'box'}}),
    capsule: runRapier(RAPIER, sc, {opts: {...opts, shape: 'capsule'}}),
  };
}
/** Avalia os critérios do cenário para cada motor. */
export function evaluate(id, results) {
  const out = [];
  for (const e of ENGINES) {
    const r = results[e.id];
    for (const [text, fn] of CRITERIA[id]) out.push({engine: e.id, ok: !!fn(r, e.id), text});
    if (e.id !== 'arenamon') r.sim?.dispose?.();
  }
  return out;
}
/** Bateria completa: devolve linhas por cenário e contagem de aprovações por motor. */
export function battery(RAPIER, opts = rapierDefaults(), tweak = null) {
  const rows = [], pass = {arenamon: 0, box: 0, capsule: 0}, total = {arenamon: 0, box: 0, capsule: 0};
  for (const id of POC_IDS) {
    const results = runAll(RAPIER, id, opts, tweak), checks = evaluate(id, results);
    for (const c of checks) {total[c.engine]++;if (c.ok) pass[c.engine]++;}
    rows.push({id, results, checks});
  }
  return {rows, pass, total};
}
