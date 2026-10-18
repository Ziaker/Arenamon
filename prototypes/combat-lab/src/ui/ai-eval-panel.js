// Cenários › Avaliação da IA: comparação estatística rigorosa entre a IA revisada e a anterior.
// Suporta partidas pareadas nos dois lados da arena (azul e vermelho alternados com as mesmas sementes),
// matriz de loadouts (sem moves, reflect, psyshock, ambos), métricas de projéteis, oportunidades perdidas
// e coleção fixa de 8 cenários difíceis.
import {evalSeries, evalPairedSeries, evalRows, runDifficultScenarios, LOADOUT_PRESETS, resolveLoadout} from '../sim/ai-eval.js';
import {STYLES, AI_REVISIONS} from '../sim/tactics.js';
import {escape} from './tuning.js';

export function createAiEvalPanel({$, download}) {
  let last = null;

  function run() {
    const matches = Math.max(4, Math.min(400, Number($('aieval-matches')?.value) || 60));
    const seed = Math.max(1, Number($('aieval-seed')?.value) || 1);
    const style = Number($('aieval-style')?.value) || 0;
    const loadout = $('aieval-loadout')?.value || 'none';
    const mode = $('aieval-mode')?.value || 'paired';
    const candidateRev = $('aieval-candidate-rev') ? Number($('aieval-candidate-rev').value) : 2;
    const baselineRev = $('aieval-baseline-rev') ? Number($('aieval-baseline-rev').value) : 0;
    const difficultyTier = $('aieval-difficulty')?.value || 'normal';
    const candLabel = AI_REVISIONS[candidateRev]?.label ?? `Revisão ${candidateRev}`;
    const baseLabel = AI_REVISIONS[baselineRev]?.label ?? `Revisão ${baselineRev}`;

    const values = {
      'extras.aiBlue.difficultyTier': difficultyTier,
      'extras.aiRed.difficultyTier': difficultyTier,
      ...(style ? {'extras.aiBlue.style': style, 'extras.aiRed.style': style} : {}),
    };
    const t0 = performance.now();

    if (mode === 'paired') {
      const pairs = Math.max(2, Math.floor(matches / 2));
      const paired = evalPairedSeries({
        pairs,
        seed,
        candidateRev,
        baselineRev,
        loadouts: loadout,
        values,
        measureDecisionTime: true,
      });
      const ms = performance.now() - t0;
      last = {
        schema: 'arenamon-lab-report',
        version: 2,
        kind: 'ai-evaluation',
        createdAt: new Date().toISOString(),
        config: {
          matches: pairs * 2,
          pairs,
          seed,
          candidateRev,
          baselineRev,
          difficultyTier,
          style: style ? STYLES[style - 1].id : 'sorteado',
          loadout,
          mode: 'paired',
          opponent: baseLabel,
        },
        paired,
        candidateStats: paired.candidateStats,
        baselineStats: paired.baselineStats,
        before: {sides: [paired.baselineStats, paired.candidateStats], matches: pairs * 2},
        after: {sides: [paired.candidateStats, paired.baselineStats], matches: pairs * 2},
        ms,
      };

      const rows = evalRows(paired);
      const candPct = (paired.candRateCombined * 100).toFixed(1);
      const basePct = (paired.baseRateCombined * 100).toFixed(1);
      const sePct = (paired.se * 1.96 * 100).toFixed(1);
      const loadoutLabel = LOADOUT_PRESETS[loadout]?.label ?? loadout;

      let html = `<p><b>${pairs * 2} lutas pareadas</b> (${pairs} no Azul, ${pairs} no Vermelho) · sementes ${seed}–${seed + pairs - 1} · Loadout: <b>${escape(loadoutLabel)}</b> · Dificuldade: <b>${escape(difficultyTier)}</b> · ${(ms / 1000).toFixed(1)} s.</p>`;
      html += `<p class="hint">Vitórias IA Revisada (${escape(candLabel)}): <b>${candPct}%</b> (IC 95%: [${(paired.ci95[0] * 100).toFixed(1)}%, ${(paired.ci95[1] * 100).toFixed(1)}%] ±${sePct} pts) · Linha de base (${escape(baseLabel)}): <b>${basePct}%</b>.</p>`;

      html += `<table><tr><th>Métrica (pareada nos 2 lados)</th><th>Anterior (${escape(baseLabel)})</th><th>Revisada (${escape(candLabel)})</th></tr>`;
      for (const r of rows) {
        const isDiff = String(r[1]) !== String(r[2]);
        html += `<tr><td>${escape(r[0])}</td><td>${escape(r[2])}</td><td class="${isDiff ? 'warn' : ''}">${escape(r[1])}</td></tr>`;
      }
      html += `</table>`;

      if (paired.blocks?.length > 1) {
        html += `<h3>Consistência por bloco de sementes</h3><table><tr><th>Bloco</th><th>Sementes</th><th>Revisada</th><th>Anterior</th><th>Ações negadas</th><th>Whiffs</th></tr>`;
        for (const b of paired.blocks) {
          const startS = seed + (b.blockIndex - 1) * 10;
          const endS = startS + b.pairsCount - 1;
          html += `<tr><td>#${b.blockIndex}</td><td>${startS}–${endS}</td><td>${(b.candidateWinRate * 100).toFixed(0)}%</td><td>${(b.baselineWinRate * 100).toFixed(0)}%</td><td>${b.deniedCandidate}</td><td>${b.whiffsCandidate}</td></tr>`;
        }
        html += `</table>`;
      }

      if (paired.defeatExplanation) {
        const exp = paired.defeatExplanation;
        html += `<div class="hint" style="margin-top:12px;background:rgba(245,158,11,0.08);border-left:3px solid #f59e0b;padding:8px 12px;border-radius:4px">`;
        html += `<h4 style="margin:0 0 4px 0;color:#f59e0b">Diagnóstico Explicativo da Derrota (Fase 1)</h4>`;
        html += `<pre style="white-space:pre-wrap;font-family:inherit;font-size:12px;margin:0;line-height:1.4">${escape(exp.summary)}</pre>`;
        html += `</div>`;
      }

      if (paired.worstDecisions?.length) {
        html += `<h3>Ranking de Decisões de Maior Custo (Fase 1: Explicação e Replay)</h3><table><tr><th>#</th><th>Semente</th><th>t (s)</th><th>Lutador</th><th>Taxonomia</th><th>Motivo e Contexto</th><th>Custo</th></tr>`;
        for (const [idx, d] of paired.worstDecisions.slice(0, 10).entries()) {
          const costStr = (d.hpCost ? `${d.hpCost} HP` : '') + (d.staminaCost ? ` ${d.staminaCost} Stamina` : '');
          const taxLabel = d.taxonomy ? d.taxonomy.replace('_', ' ') : '—';
          html += `<tr><td>${idx + 1}</td><td>${d.seed}</td><td>${d.time}</td><td>${d.fighter === 0 ? 'Azul' : 'Vermelho'}</td><td><b>${escape(taxLabel)}</b></td><td>${escape(d.reason)}${d.detail ? `<br><small style="opacity:0.8">${escape(d.detail)}</small>` : ''}</td><td>${escape(costStr || '—')}</td></tr>`;
        }
        html += `</table>`;
      }

      $('aieval-report').innerHTML = html;
      $('aieval-export').disabled = false;
      return last;
    }

    // Modo legado simples (Candidato só no Azul)
    const before = evalSeries({matches, seed, blueRev: 0, redRev: 0, loadouts: loadout, values});
    const after = evalSeries({matches, seed, blueRev: 1, redRev: 0, loadouts: loadout, values});
    const ms = performance.now() - t0;
    last = {
      schema: 'arenamon-lab-report',
      version: 1,
      kind: 'ai-evaluation',
      createdAt: new Date().toISOString(),
      config: {
        matches,
        seed,
        style: style ? STYLES[style - 1].id : 'sorteado',
        loadout,
        mode: 'blue',
        opponent: 'IA tática anterior (vermelho)',
      },
      before,
      after,
      ms,
    };
    const rb = evalRows(before), ra = evalRows(after), se = Math.sqrt(.25 / matches) * Math.SQRT2 * 100;
    $('aieval-report').innerHTML = `<p>${matches} lutas por lado · sementes ${seed}–${seed + matches - 1} · ${(ms / 1000).toFixed(1)} s · diferenças de vitória menores que ±${(2 * se).toFixed(0)} pontos são ruído.</p>
      <table><tr><th>Azul contra a IA anterior</th><th>Anterior</th><th>Revisada</th></tr>${rb.map((r, i) => `<tr><td>${escape(r[0])}</td><td>${escape(r[1])}</td><td class="${String(r[1]) !== String(ra[i][1]) ? 'warn' : ''}">${escape(ra[i][1])}</td></tr>`).join('')}</table>
      <p class="hint">Mesmas regras do jogador nos dois casos (mesmo controlador, mesmos custos e janelas). A revisada só pede ações que o motor aceitaria, estima o alcance do X e usa sprint; detalhes no relatório técnico.</p>`;
    $('aieval-export').disabled = false;
    return last;
  }

  function runScenarios() {
    const loadout = $('aieval-loadout')?.value || 'both';
    const candidateRev = $('aieval-candidate-rev') ? Number($('aieval-candidate-rev').value) : 2;
    const baselineRev = $('aieval-baseline-rev') ? Number($('aieval-baseline-rev').value) : 0;
    const candLabel = AI_REVISIONS[candidateRev]?.label ?? `Revisão ${candidateRev}`;
    const baseLabel = AI_REVISIONS[baselineRev]?.label ?? `Revisão ${baselineRev}`;
    const t0 = performance.now();
    const res = runDifficultScenarios({candidateRev, baselineRev, loadouts: loadout});
    const ms = performance.now() - t0;

    last = {
      schema: 'arenamon-lab-report',
      version: 2,
      kind: 'ai-evaluation',
      subkind: 'difficult-scenarios',
      createdAt: new Date().toISOString(),
      config: {loadout, candidateRev, baselineRev, opponent: baseLabel},
      scenariosResult: res,
      ms,
    };

    let html = `<h3>Bateria de Cenários Difíceis da IA</h3>`;
    html += `<p>Aproveitamento: Candidato (${escape(candLabel)}) <b>${res.candidateScore}/${res.totalScenarios} (${(res.candidatePassRate * 100).toFixed(0)}%)</b> · Linha de base (${escape(baseLabel)}) <b>${res.baselineScore}/${res.totalScenarios} (${(res.baselinePassRate * 100).toFixed(0)}%)</b> · ${(ms / 1000).toFixed(2)} s.</p>`;
    html += `<table><tr><th>Cenário</th><th>Situação</th><th>${escape(baseLabel)}</th><th>${escape(candLabel)}</th></tr>`;
    for (const s of res.scenarios) {
      const candOk = s.candidate.passed;
      const baseOk = s.baseline.passed;
      html += `<tr><td><b>${escape(s.name)}</b></td><td>${escape(s.description)}</td>
        <td class="${baseOk ? 'ok' : 'warn'}">${baseOk ? '✓ Aprovado' : '✗ Falhou'}<br><small>${escape(s.baseline.detail)}</small></td>
        <td class="${candOk ? 'ok' : 'warn'}">${candOk ? '✓ Aprovado' : '✗ Falhou'}<br><small>${escape(s.candidate.detail)}</small></td></tr>`;
    }
    html += `</table>`;

    $('aieval-report').innerHTML = html;
    $('aieval-export').disabled = false;
    return last;
  }

  if ($('aieval-style')) {
    $('aieval-style').replaceChildren(new Option('Sorteado por luta', '0'), ...STYLES.map((s, i) => new Option(s.label, String(i + 1))));
  }
  if ($('aieval-run')) $('aieval-run').onclick = run;
  if ($('aieval-scenarios')) $('aieval-scenarios').onclick = runScenarios;
  if ($('aieval-export')) {
    $('aieval-export').onclick = () => {
      if (last) download(JSON.stringify(last, null, 2), 'arenamon-avaliacao-ia.json');
    };
    $('aieval-export').disabled = true;
  }

  return {run, runScenarios, get last() { return last; }};
}
