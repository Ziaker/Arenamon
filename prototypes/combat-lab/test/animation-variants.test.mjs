// Cobertura de 100% das VARIANTES configuradas dos personagens importados (Wookada e Cogumelo, com a configuração salva em inicial/workspace-inicial.zip).
// Para cada ação com 2+ variantes: (a) a escolha é determinística (mesma semente → mesma variante) e todas as variantes são alcançáveis pela semente do jogo;
// (b) em gameplay real, forçando a escolha da variante k, o clipe da variante k é o que o mixer executa (nada vira fallback nem outra variante).
// Variante cuja ação nenhum cenário alcança é listada como «não homologada» (nunca aprovada em silêncio).
// Uso: node prototypes/combat-lab/test/animation-variants.test.mjs
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {loadConfiguredSource, setupRegistry} from './animation-runtime-harness.mjs';
import {runAll, RESERVA} from './animation-runtime-matrix.mjs';
import {SCENARIOS} from './animation-runtime-scenarios.mjs';
import {Character} from '../src/view/characters.js';

const chars = f => fileURLToPath(new URL('../../../chars/' + f, import.meta.url));
setupRegistry();
let n = 0;const ok = l => {n++;console.log('✓', l);};
const w = await loadConfiguredSource(chars('wookada/wookada.glb'), 'wookada.glb'), c = await loadConfiguredSource(chars('mosh/Cogumelo.glb'), 'Cogumelo.glb');
const original = Character.prototype.pickVariant;
const naoHomologadas = [], reserva = [];

for (const [src, other] of [[w, c], [c, w]]) {
  const probe = new Character(src, {persist: true});
  const multi = Object.entries(probe.variants).filter(([, v]) => v.length > 1);
  // (a) determinismo e alcance de todas as variantes pela semente do jogo
  for (const [id, list] of multi) {
    const seen = new Set();
    for (let seed = 1; seed <= 400; seed++) {
      const a = probe.pickVariant(id, seed), b = probe.pickVariant(id, seed);
      assert.equal(a, b, `${src.name}/${id}: mesma semente, mesma variante`);
      seen.add(a);
    }
    assert.equal(seen.size, list.length, `${src.name}/${id}: todas as ${list.length} variantes são alcançáveis (${seen.size} vistas)`);
  }
  ok(`${src.name}: ${multi.length} ações com 2+ variantes (${multi.map(([k, v]) => `${k}×${v.length}`).join(', ')}): escolha determinística e todas alcançáveis`);
  // (b) execução real de cada variante
  const base = runAll([src, other]);
  for (const [id, list] of multi) {
    const reachedBy = base.reached.get(`0:${id}`);
    if (!reachedBy) {
      // Ação de reserva (só toca quando o clipe primário do estado falta): não é alcançável com a configuração real; fica listada como NÃO HOMOLOGADA, nunca aprovada.
      for (let k = 0; k < list.length; k++) (RESERVA.has(id) ? reserva : naoHomologadas).push(`${src.name}/${id}#${k + 1}: nenhum cenário alcança a ação${RESERVA.has(id) ? ' (reserva: só toca sem o clipe primário)' : ''}`);
      continue;
    }
    const names = [...reachedBy.cenarios];
    for (let k = 0; k < list.length; k++) {
      Character.prototype.pickVariant = function (aid, seed) {return aid === id && this.source === src ? this.variantsOf(id)[k] : original.call(this, aid, seed);};
      const clipName = probe.clips[list[k]].name;
      const builds = SCENARIOS.filter(s => names.includes(s.name)).map(s => s.build({sources: [src, other]}));
      Character.prototype.pickVariant = original;
      const got = new Set(builds.flatMap(b => [...(b.rec.reached.get(`0:${id}`)?.clips ?? [])]));
      if (!got.has(clipName)) naoHomologadas.push(`${src.name}/${id}#${k + 1} («${clipName}»): o mixer executou ${[...got].map(x => `«${x}»`).join(', ') || 'nada'}`);
    }
  }
}
Character.prototype.pickVariant = original;
assert.deepEqual(naoHomologadas, [], 'toda variante configurada é executada pelo mixer quando escolhida:\n  ' + naoHomologadas.join('\n  '));
if (reserva.length) console.log('⚠ variantes NÃO HOMOLOGADAS (reserva):\n  ' + reserva.join('\n  '));
ok('cada variante configurada alcançável (Wookada e Cogumelo) foi forçada em partida real e o clipe executado é o da variante escolhida');
console.log(`\n${n} verificações de variantes aprovadas.`);
process.exit(0);
