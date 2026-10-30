// Viewport do Editor × jogo (adendo, item 10: «diferença não explicada entre a viewport e o jogo»), com Wookada e Cogumelo REAIS.
// A prévia é um Character persist:false sincronizado do lutador (syncFrom). Para o mesmo clipe e o mesmo tempo de clipe, a pose
// dos braços tem de ser IDÊNTICA à do lutador no jogo; e o relógio da prévia avança na mesma velocidade que a conclusão visual no jogo.
// Ossos de perna/pé/cabeça/coluna ficam de fora de propósito: no jogo o apoio dos pés e o olhar (camadas visuais) os ajustam; na prévia
// o lutador-dummy está parado — diferença explicada, não defeito. Variações: configuração salva, Reverso e recorte.
// Uso: node prototypes/combat-lab/test/animation-viewport-vs-jogo.test.mjs
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {makeMatch, cmd, vec, C, loadConfiguredSource} from './animation-runtime-harness.mjs';
import {createPreviewCharacter} from '../src/view/animation-preview.js';
import {setField} from '../src/sim/animation-profile.js';

let n = 0;const ok = l => {n++;console.log('✓', l);};
const p = f => fileURLToPath(new URL('../../../chars/' + f, import.meta.url));
const w = await loadConfiguredSource(p('wookada/wookada.glb'), 'wookada.glb'), co = await loadConfiguredSource(p('mosh/Cogumelo.glb'), 'Cogumelo.glb');
const ARM = /arm|hand|shoulder|clavicle/i;
const bones = root => {const m = new Map();root.traverse(o => {if (o.isBone && ARM.test(o.name)) m.set(o.name, o);});return m;};

for (const [name, src, other] of [['Wookada', w, co], ['Cogumelo', co, w]]) {
  for (const [label, fields] of [['configuração salva', {}], ['Reverso', {reverse: true}], ['Fim do recorte 80 %', {trimEnd: 80}]]) {
    const m = makeMatch({cfg: () => {C.actions.tackle.duration = C.test.step * 8;}, sources: [src, other]}), ch = m.chars[0];
    for (const [k, v] of Object.entries(fields)) ch.animProfile = setField(ch.animProfile, 'tackle', k, v);
    m.run(10);m.step(cmd({tackle: true, move: vec(0, 1), target: 1, locked: true}));
    let g = 0;while (!ch.epilogue && g++ < 120) m.step();
    assert.ok(ch.epilogue, `${name} · ${label}: conclusão visual ativa no jogo`);
    const pv = createPreviewCharacter(src).syncFrom(ch), idx = ch.current.index;
    const gb = bones(ch.root), pb = bones(pv.character.root);
    assert.ok(gb.size >= 4, `${name}: ossos de braço encontrados (${gb.size})`);
    let worst = 0, samples = 0;
    while (ch.epilogue && samples < 40) {
      const t = ch.current.action.time;
      pv.load(idx, {action: 'tackle', loop: false, paused: true, seek: t});pv.step(C.test.step);
      for (const [bn, b] of gb) {const o = pb.get(bn);if (o) worst = Math.max(worst, 1 - Math.abs(b.quaternion.dot(o.quaternion)));}
      samples++;m.step(cmd({move: vec(1, 0)}));
    }
    assert.ok(samples >= 2, `${name} · ${label}: ${samples} amostras comparadas`);
    assert.ok(worst < 1e-6, `${name} · ${label}: pose dos braços igual na prévia e no jogo (desvio ${worst.toExponential(2)})`);
    // Relógio: a prévia tocando avança à mesma taxa que a conclusão visual (velocidade configurada do Editor).
    pv.load(idx, {action: 'tackle', loop: false});
    pv.step(C.test.step);   // 1º quadro aplica o load (antes disso time() ainda mostra o seek anterior)
    const t0 = pv.time();for (let i = 0; i < 4; i++) pv.step(C.test.step);
    const rate = Math.abs(pv.time() - t0) / (4 * C.test.step), want = ch.speedOf('tackle');
    assert.ok(Math.abs(rate - want) < want * .02 || pv.time() >= ch.current.clip.duration - 1e-6, `${name} · ${label}: relógio da prévia ${rate.toFixed(3)}× = jogo ${want.toFixed(3)}×`);
    ok(`${name} · ${label}: prévia e jogo com a mesma pose (${samples} quadros, desvio ${worst.toExponential(1)}) e o mesmo relógio (${want.toFixed(2)}×)`);
    pv.dispose();
  }
}
console.log(`\n${n} verificações viewport × jogo aprovadas.`);
process.exit(0);
