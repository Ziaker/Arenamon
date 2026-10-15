// Cenários › Avaliação da IA: a IA revisada e a anterior jogam as MESMAS lutas (mesmas sementes, mesmo lado, mesmo
// adversário: a IA anterior no vermelho) e o relatório compara vitórias, ações, stamina, negadas e contra-ataques.
import {evalSeries, evalRows} from '../sim/ai-eval.js';
import {STYLES} from '../sim/tactics.js';
import {escape} from './tuning.js';

export function createAiEvalPanel({$, download}) {
  let last = null;
  function run() {
    const matches = Math.max(4, Math.min(400, Number($('aieval-matches').value) || 60)), seed = Math.max(1, Number($('aieval-seed').value) || 1), style = Number($('aieval-style').value) || 0;
    const values = style ? {'extras.aiBlue.style': style, 'extras.aiRed.style': style} : {}, t0 = performance.now();
    const before = evalSeries({matches, seed, blueRev: 0, redRev: 0, values}), after = evalSeries({matches, seed, blueRev: 1, redRev: 0, values});
    last = {schema: 'arenamon-lab-report', version: 1, kind: 'ai-evaluation', createdAt: new Date().toISOString(), config: {matches, seed, style: style ? STYLES[style - 1].id : 'sorteado', opponent: 'IA tática anterior (vermelho)'}, before, after, ms: performance.now() - t0};
    const rb = evalRows(before), ra = evalRows(after), se = Math.sqrt(.25 / matches) * Math.SQRT2 * 100;
    $('aieval-report').innerHTML = `<p>${matches} lutas por lado · sementes ${seed}–${seed + matches - 1} · ${(last.ms / 1000).toFixed(1)} s · diferenças de vitória menores que ±${(2 * se).toFixed(0)} pontos são ruído.</p>
      <table><tr><th>Azul contra a IA anterior</th><th>Anterior</th><th>Revisada</th></tr>${rb.map((r, i) => `<tr><td>${escape(r[0])}</td><td>${escape(r[1])}</td><td class="${String(r[1]) !== String(ra[i][1]) ? 'warn' : ''}">${escape(ra[i][1])}</td></tr>`).join('')}</table>
      <p class="hint">Mesmas regras do jogador nos dois casos (mesmo controlador, mesmos custos e janelas). A revisada só pede ações que o motor aceitaria, estima o alcance do X e usa sprint; detalhes no relatório técnico.</p>`;
    $('aieval-export').disabled = false;return last;
  }
  $('aieval-style').replaceChildren(new Option('Sorteado por luta', '0'), ...STYLES.map((s, i) => new Option(s.label, String(i + 1))));
  $('aieval-run').onclick = run;$('aieval-export').onclick = () => {if (last) download(JSON.stringify(last), 'arenamon-avaliacao-ia.json');};$('aieval-export').disabled = true;
  return {run, get last() {return last;}};
}
