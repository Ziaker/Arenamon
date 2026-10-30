// Relatório POR EXECUÇÃO das animações (adendo, item 9): cada execução de um clipe nos cenários de gameplay real vira uma linha com
// ação aceita, identidade da execução (chave#serial), variante, liberação mecânica, início/fim, primeiro/último quadro, curva de peso,
// motivo de encerramento, classificação e correspondência com a velocidade configurada no Editor.
// Também: clipes dos GLBs sem nenhuma associação, associações de sentido duvidoso (A7) com alternativas existentes no próprio GLB,
// e a medição de deslizamento dos pés durante a conclusão visual (só relatório — não muda física nem animação).
import * as T from 'three';
import {executions, classifyExecution, approvedExecution, configuredClips, playedPct, LOOPING_IDS} from './animation-runtime-matrix.mjs';
import {makeMatch, cmd, vec, C} from './animation-runtime-harness.mjs';

const STEP = 1 / 120, FPS = 30;
const q = (xs, p) => {if (!xs.length) return 0;const s = [...xs].sort((a, b) => a - b);return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))];};

/** Curva de peso: 5 amostras (0, 25, 50, 75, 100 % da execução). */
const weightCurve = ws => ws.length ? [0, .25, .5, .75, 1].map(p => ws[Math.round(p * (ws.length - 1))].toFixed(2)).join('→') : '—';

/** Linhas por execução de UM personagem (lutador `who` das rodadas `run`). */
export function executionRows(name, ch, run, who = 0) {
  const rows = [];
  for (const [bi, b] of run.builds.entries()) {
    const scen = b.scenario || `cenário ${bi + 1}`;
    for (const e of executions(b).filter(x => x.who === who)) {
      const a = run.actions.find(x => x.id === e.id) ?? {id: e.id, kind: 'editor'};
      const cfgs = configuredClips(ch, a);
      let cls = cfgs.length ? classifyExecution(e, cfgs, {looping: LOOPING_IDS.has(e.id)}) : 'SEM_CLIPE';
      // O critério da matriz chama de corte o que não é corte do runtime: o cenário de teste acabou no meio do clipe, ou um laço
      // (idle/andar/sprint/defesa) trocou para locomoção. Separados aqui para o corte REAL ficar visível sozinho.
      if (cls === 'CORTADA_INDEVIDAMENTE' && !e.endLog && !e.restartedBySameAction) cls = 'NAO_CONCLUIDA_NO_CENARIO';
      else if (cls === 'CORTADA_INDEVIDAMENTE' && LOOPING_IDS.has(e.id)) cls = 'SAIDA_DE_LACO';
      const variants = ch.variantsOf(e.id) || [], vi = variants.indexOf(e.index);
      // Velocidade observada só na conclusão visual (relógio livre; nas fases temporizadas o clipe segue o progresso da simulação).
      // Mediana dos avanços quadro a quadro (robusta a duas execuções seguidas com a mesma identidade e ao último quadro no cap).
      let rate = null;
      const deltas = e.epTimes.slice(1).map((t, i) => t - e.epTimes[i]).filter(d => d > 1e-6);
      if (deltas.length >= 2) rate = q(deltas, .5) / STEP;
      const want = ch.speedOf(e.id), confere = rate == null ? 'sem epílogo (relógio da simulação)' : Math.abs(rate - want) < want * .03 ? `sim (${rate.toFixed(2)}×)` : `NÃO (${rate.toFixed(2)}× vs ${want.toFixed(2)}×)`;
      rows.push({personagem: name, cenario: scen, acao: e.id, chave: e.key, execucao: e.entry ?? '—', clipe: e.clip, variante: vi >= 0 ? `${vi + 1}/${variants.length}` : '—',
        inicio: e.firstTick, fim: e.lastTick, liberacao: e.releaseTick ?? '—', quadros: `${Math.round(e.minTime * FPS)}–${Math.round(e.maxTime * FPS)}`, tocado: `${playedPct(e)}%`,
        peso: weightCurve(e.weights), motivo: e.endLog ? `${e.endLog.reason} → ${e.endLog.to}` : e.restartedBySameAction ? 'reentrada (nova execução)' : 'fim do cenário',
        classificacao: cls, aprovada: approvedExecution(e, cls) ? 'sim' : 'não', velocidade: confere, frames: e.frames});
    }
  }
  return rows;
}

/** Clipes do GLB que nenhuma ação usa (variants, moveAnims) — recurso disponível sem associação. */
export function orphanClips(ch) {
  const used = new Set(Object.values(ch.variants || {}).flat());
  for (const m of Object.values(ch.moveAnims || {})) for (const k of ['chargeClip', 'releaseClip']) if (m?.[k] != null) used.add(m[k]);
  return ch.clips.map((c, i) => ({i, name: c.name, duration: c.duration})).filter(c => !used.has(c.i));
}

/** Família semântica pelo nome do clipe (palavras do próprio nome; heurística só para APONTAR, nunca para trocar). */
const FAMILIES = [
  ['reação', /hit|react|impact|stagger|knock|death|die|dying|fall_hit|zombie/i], ['defesa', /block|guard|parry|shield/i],
  ['salto', /jump|land|fall|air/i], ['esquiva', /dodge|roll|evade|sidestep|dash/i], ['ataque', /attack|swip|punch|kick|tackle|blast|slash|strike|move/i],
  ['locomoção', /walk|run|sprint|idle|stop|turn|strafe|stand/i],
];
const familyOfClip = n => FAMILIES.find(([, re]) => re.test(n))?.[0] ?? null;
/** Família esperada pela ação. */
function familyOfAction(id) {
  if (/^(hit|push|stagger|knockback|wall_splat|death|downed|recover|guard_impact|blocked)/.test(id)) return 'reação';
  if (/^(block|perfect_guard)/.test(id)) return 'defesa';
  if (/^(jump|land|fall|ledge|vault)/.test(id)) return 'salto';
  if (/^dodge/.test(id)) return 'esquiva';
  if (/^(tackle|meteor|move_|release_|charge_|recovery_|brake)/.test(id)) return 'ataque';
  if (/^(idle|turn|walk|sprint)/.test(id)) return 'locomoção';
  return null;
}

/** Associações cujo nome do clipe sugere outra família (A7). Lista alternativas do MESMO GLB com a família esperada. */
export function suspiciousAssociations(ch) {
  const out = [];
  for (const [id, idx] of Object.entries(ch.variants || {})) {
    const want = familyOfAction(id);if (!want) continue;
    for (const i of idx) {
      const clip = ch.clips[i];if (!clip) continue;
      const got = familyOfClip(clip.name);
      if (got && got !== want) out.push({acao: id, clipe: clip.name, familiaClipe: got, familiaEsperada: want,
        alternativas: ch.clips.filter(c => familyOfClip(c.name) === want).map(c => c.name).slice(0, 6)});
    }
  }
  return out;
}

/**
 * Deslizamento dos pés (adendo, item 6): velocidade horizontal do pé de apoio (o mais baixo) no MUNDO, em m/s.
 * Compara andar normal (referência do próprio modelo) com andar durante a conclusão visual de um tackle.
 * Pés: ossos com «foot» no nome (sem «toe»/«end»). Só mede — nada é corrigido.
 */
export function footSlide(src, other) {
  const measure = withTackle => {
    const m = makeMatch({cfg: () => {C.actions.tackle.duration = C.test.step * 8;}, sources: [src, other]}), ch = m.chars[0];
    const feet = [];ch.root.traverse(o => {if (o.isBone && /foot/i.test(o.name) && !/toe|end/i.test(o.name)) feet.push(o);});
    if (feet.length < 2) return null;
    m.run(10);
    if (withTackle) {m.step(cmd({tackle: true, move: vec(0, 1), target: 1, locked: true}));let g = 0;while (!ch.epilogue && g++ < 120) m.step();}
    else m.run(60, () => cmd({move: vec(1, 0)}));
    const v = new T.Vector3(), speeds = [], body = [];let prev = null, guard = 0;
    while (guard++ < 240 && (withTackle ? ch.epilogue : guard < 120)) {
      m.step(cmd({move: vec(1, 0)}));
      ch.root.updateMatrixWorld(true);
      const pos = feet.map(b => b.getWorldPosition(v).clone()), low = pos.reduce((a, b) => b.y < a.y ? b : a);
      const f = m.g.fighters[0], li = pos.indexOf(low);
      if (prev && prev.li === li) {speeds.push(Math.hypot(low.x - prev.p.x, low.z - prev.p.z) / STEP);body.push(Math.hypot(f.position.x - prev.fx, f.position.z - prev.fz) / STEP);}
      prev = {li, p: low, fx: f.position.x, fz: f.position.z};
    }
    return {frames: speeds.length, mediana: q(speeds, .5), p90: q(speeds, .9), corpo: q(body, .5)};
  };
  return {andando: measure(false), epilogo: measure(true)};
}

export const toMarkdownRows = rows => ['| cenário | ação | execução | clipe | variante | início (tick) | liberação mecânica | fim (tick) | quadros (30 fps) | tocado | peso 0→100 % | encerramento | classificação | aprovada | velocidade confere |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|',
  ...rows.map(r => `| ${r.cenario} | \`${r.acao}\` | ${r.execucao} | ${r.clipe} | ${r.variante} | ${r.inicio} | ${r.liberacao} | ${r.fim} | ${r.quadros} | ${r.tocado} | ${r.peso} | ${r.motivo} | ${r.classificacao} | ${r.aprovada} | ${r.velocidade} |`)].join('\n');
