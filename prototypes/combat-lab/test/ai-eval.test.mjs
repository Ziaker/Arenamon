// IA revisada × anterior (sem navegador): mesmas regras do jogador, sementes fixas, várias personalidades.
// Mede taxas de vitória, ações, stamina desperdiçada, ações negadas e contra-ataques; não exige que a revisada vença
// por vantagem — exige que não fique mais fraca além do ruído e que use melhor as mecânicas.
import assert from 'node:assert/strict';
import {C, defaults, resetConfig} from '../src/sim/config.js';
import {evalSeries, evalMatch} from '../src/sim/ai-eval.js';
import {REVISION_1, featuresOf} from '../src/sim/tactics.js';

let n = 0;const ok = l => {n++;console.log('✓', l);};
resetConfig(defaults());
assert.equal(C.extras.ai.revision, 1, 'revisada por padrão');assert.equal(featuresOf({revisionOverride: 0}).validate, false);assert.equal(REVISION_1.stamina, false);
{
  const a = evalMatch({seed: 9, blueRev: 1, redRev: 0}), b = evalMatch({seed: 9, blueRev: 1, redRev: 0});
  assert.deepEqual(a, b, 'mesma semente, mesma luta');
  const before = JSON.stringify(C);evalSeries({matches: 5, seed: 3, blueRev: 1, redRev: 0});assert.equal(JSON.stringify(C), before, 'a avaliação não altera a configuração');
}
ok('avaliação determinística por semente e sem efeito na configuração');
const N = 120, sum = (blueRev, redRev, values = {}) => {
  const out = {wins: 0, n: 0, denied: 0, tackleNoGuard: 0, sprints: 0, whiffs: 0, tackles: 0, spent: 0};
  for (const seed of [1, 501]) {const r = evalSeries({matches: N, seed, blueRev, redRev, values}), s = r.sides[0];out.wins += s.wins;out.n += r.matches;out.denied += s.denied;out.tackleNoGuard += s.deniedByReason.tackleNoGuard ?? 0;out.sprints += s.sprints;out.whiffs += s.whiffs;out.tackles += s.tackles;out.spent += s.staminaSpent;}
  out.rate = out.wins / out.n;return out;
};
const base = sum(0, 0), rev = sum(1, 0);
console.log(`   anterior × anterior: azul ${(base.rate * 100).toFixed(1)}% · negadas ${base.denied} · X sem contato ${(100 * base.whiffs / base.tackles).toFixed(0)}% · sprints ${base.sprints}`);
console.log(`   revisada × anterior: azul ${(rev.rate * 100).toFixed(1)}% · negadas ${rev.denied} · X sem contato ${(100 * rev.whiffs / rev.tackles).toFixed(0)}% · sprints ${rev.sprints}`);
assert.ok(rev.tackleNoGuard <= base.tackleNoGuard * .1, `quase nunca aperta D no próprio tackle sem efeito (${rev.tackleNoGuard} × ${base.tackleNoGuard}; o resto vem de X que sai do buffer no mesmo passo)`);
assert.ok(rev.denied < base.denied * .8, `menos ações negadas (${rev.denied} × ${base.denied})`);
assert.ok(rev.sprints > 0 && base.sprints === 0, 'usa o sprint para encurtar distância');
const se = Math.sqrt(base.rate * (1 - base.rate) / base.n) * Math.SQRT2;
assert.ok(rev.rate >= base.rate - 3 * se, `não fica mais fraca além do ruído: ${(rev.rate * 100).toFixed(1)}% × ${(base.rate * 100).toFixed(1)}% (±${(3 * se * 100).toFixed(1)})`);
ok('revisada × anterior (mesmo lado, mesmas sementes): menos ações negadas, usa sprint, quase nenhuma defesa inútil, força dentro do ruído');
{
  // Várias personalidades (estilo fixo nos dois lados): a revisada nunca despenca.
  for (const style of [1, 3, 4]) {
    const v = {'extras.aiBlue.style': style, 'extras.aiRed.style': style}, b = sum(0, 0, v), r = sum(1, 0, v);
    console.log(`   estilo ${style}: anterior ${(b.rate * 100).toFixed(0)}% · revisada ${(r.rate * 100).toFixed(0)}% · negadas ${b.denied} → ${r.denied}`);
    assert.ok(r.rate >= b.rate - .12 && r.denied <= b.denied, `estilo ${style}`);
  }
}
ok('estilos Agressor, Esquivador e Paredão: revisada sem perda relevante e com menos ações negadas');
resetConfig(defaults());
console.log(`\n${n} verificações da avaliação da IA aprovadas.`);
