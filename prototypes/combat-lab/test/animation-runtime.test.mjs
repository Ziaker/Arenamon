// Animações no RUNTIME (gameplay real, Editor fechado): todas as ações configuráveis do Editor (65 entradas fixas + move_<id> dos 19 Moves + charge_/release_ dos Moves de carga)
// precisam TOCAR a partir de uma partida de verdade (Game + Character + AnimationMixer), com o clipe exato configurado e sem substituição silenciosa por reserva.
// Dois conjuntos: (1) personagem sintético com UM clipe distinto por ação (prova o roteamento de todas as ações) e (2) os GLBs importados de verdade (Wookada e Cogumelo).
// Também prova velocidade/recorte/laço do Editor aplicados ao mixer, persistência (salvar → recarregar) e determinismo (replay / save-load no meio).
// Uso: node prototypes/combat-lab/test/animation-runtime.test.mjs      (≈ 10 s; a matriz completa: node scripts/gen-matriz-animacoes.mjs → docs/MATRIZ_ANIMACOES_RUNTIME.md)
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {runAll, rowsFor, RESERVA} from './animation-runtime-matrix.mjs';
import {loadConfiguredSource, makeCharacter, makeMatch, configurableActions, setupRegistry, cmd, vec, C, listMoves, EDITOR_IDS} from './animation-runtime-harness.mjs';
import {SCENARIOS} from './animation-runtime-scenarios.mjs';
import {Character} from '../src/view/characters.js';
import {setField} from '../src/sim/animation-profile.js';

const chars = f => fileURLToPath(new URL('../../../chars/' + f, import.meta.url));
let n = 0;const ok = l => {n++;console.log('✓', l);};
setupRegistry();
const actions = configurableActions();

// ---- inventário: os números do pedido ----
assert.equal(EDITOR_IDS.length, 65, '65 entradas fixas do Editor');
assert.equal(listMoves().length, 19, '19 Moves');
ok(`inventário dinâmico: ${actions.length} ações configuráveis (65 fixas do Editor + ${actions.filter(a => a.kind === 'move').length} identidades de Move + ${actions.length - EDITOR_IDS.length - actions.filter(a => a.kind === 'move').length} fases charge_/release_ extras dos Moves de carga)`);

// ---- (1) sintético: TODAS as ações tocam, com o clipe exato ----
const syn = runAll(null), synCh = makeCharacter(actions, 'azul.glb'), synRows = rowsFor('sintético', synCh, syn, true);
const synConfigured = synRows.filter(r => r.configurado !== '—');
assert.deepEqual(synRows.filter(r => r.fallback !== 'não').map(r => `${r.acao}: tocou ${r.fallback} no lugar de ${r.configurado}`), [], 'nenhuma ação caiu em reserva não listada (FALLBACK)');
assert.deepEqual(synConfigured.filter(r => r.classificacao === 'NAO_ALCANCADA').map(r => r.acao), [], 'toda ação configurada com clipe válido tocou no gameplay real');
ok(`sintético: ${synConfigured.length} ações configuradas tocaram com o clipe exato (nenhuma reserva, nenhuma substituição)`);
const synCortadas = synConfigured.filter(r => r.classificacao === 'CORTADA_INDEVIDAMENTE');
const synCurtas = synConfigured.filter(r => !r.resultado.startsWith('aprovada') && !['CORTADA_INDEVIDAMENTE', 'SEM_CLIPE', '—'].includes(r.classificacao));
if (synCurtas.length) console.log('  · reprovadas só pelo portão de duração/peso (critério, não falha de roteamento):', synCurtas.map(r => `${r.acao} (${r.classificacao})`).join(', '));

// ---- (2) GLBs importados de verdade, COM a configuração salva do usuário (inicial/workspace-inicial.zip) ----
const w = await loadConfiguredSource(chars('wookada/wookada.glb'), 'wookada.glb'), c = await loadConfiguredSource(chars('mosh/Cogumelo.glb'), 'Cogumelo.glb');
// cada modelo importado é o lutador AZUL (o que age em todos os cenários) numa rodada própria; o outro serve de rival
const runs = [[w, runAll([w, c])], [c, runAll([c, w])]];
const realCortadas = [];
for (const [src, real] of runs) {
  const who = 0, ch = new Character(src, {persist: true}), rows = rowsFor(src.name, ch, real, false, who);
  const configured = rows.filter(r => r.configurado !== '—');
  realCortadas.push(...configured.filter(r => r.classificacao === 'CORTADA_INDEVIDAMENTE').map(r => `${src.name} ${r.acao}: ${r.resultado}`));
  const fallbackadas = rows.filter(r => r.classificacao === 'FALLBACK'), naoAlcancadas = configured.filter(r => r.classificacao === 'NAO_ALCANCADA');
  assert.deepEqual(fallbackadas.map(r => `${r.acao}: tocou ${r.fallback}`), [], `${src.name}: nenhuma ação caiu em reserva não listada (FALLBACK)`);
  assert.deepEqual(naoAlcancadas.map(r => r.acao), [], `${src.name}: toda ação com clipe configurado tocou no gameplay real`);
  const curtas = configured.filter(r => !r.resultado.startsWith('aprovada') && !['CORTADA_INDEVIDAMENTE', 'SEM_CLIPE', '—'].includes(r.classificacao));
  if (curtas.length) console.log(`  · ${src.name} reprovadas só pelo portão de duração/peso:`, curtas.map(r => `${r.acao} (${r.classificacao})`).join(', '));
  ok(`${src.name} (importado): ${configured.filter(r => r.resultado.startsWith('aprovada')).length}/${configured.length} ações configuradas aprovadas por execução, ${rows.filter(r => r.resultado.startsWith('reserva')).length} reservas, ${rows.length - configured.length} sem clipe configurado`);
}

// ---- (3) parâmetros do Editor aplicados ao mixer: velocidade, recorte e laço ----
{
  const run = setup => {const m = makeMatch();setup(m.chars[0]);m.run(120);return m.rec.frames.filter(f => f.who === 0 && f.id === 'idle');};
  const base = run(() => {}), fast = run(ch => {ch.speeds.idle = 2;});
  const rate = fr => {let s = 0, k = 0;for (let i = 1; i < fr.length; i++) {const d = fr[i].time - fr[i - 1].time;if (d > 0 && d < .5) {s += d;k++;}}return s / k / C.test.step;};
  assert.ok(Math.abs(rate(fast) / rate(base) - 2) < .15, `velocidade 2× dobra o avanço do clipe: ${(rate(fast) / rate(base)).toFixed(2)}×`);
  ok('velocidade do Editor (2×) dobra o avanço do clipe no mixer, medido em jogo');
  const d = base[0].duration;
  const trimmed = run(ch => {ch.animProfile = setField(setField(ch.animProfile, 'idle', 'trimStart', 20), 'idle', 'trimEnd', 60);});
  assert.ok(trimmed.length > 20 && trimmed.every(f => f.time >= .2 * d - 1e-3 && f.time <= .6 * d + 1e-3), `recorte 20–60%: min ${Math.min(...trimmed.map(f => f.time)).toFixed(2)} máx ${Math.max(...trimmed.map(f => f.time)).toFixed(2)} (duração ${d.toFixed(2)})`);
  ok('recorte do Editor (20–60%) mantém o mixer dentro do trecho, medido em jogo');
  const loop = run(ch => {ch.animProfile = setField(setField(ch.animProfile, 'idle', 'loopStart', 30), 'idle', 'loopEnd', 50);});
  const late = loop.slice(Math.floor(loop.length * .7));
  assert.ok(late.length > 10 && late.every(f => f.time >= .3 * d - 1e-3 && f.time <= .5 * d + 1e-3), 'laço central 30–50%: depois da entrada o tempo fica dentro do laço');
  ok('laço central do Editor (30–50%) prende o mixer no trecho, medido em jogo');
}

// ---- (3b) campos do Editor que antes eram salvos sem efeito: Reverso, Peso da camada, Blend de saída ----
{
  const run = setup => {const m = makeMatch();setup(m.chars[0]);m.run(90);return m.rec.frames.filter(f => f.who === 0 && f.id === 'idle');};
  const rev = run(ch => {ch.animProfile = setField(ch.animProfile, 'idle', 'reverse', true);});
  const dts = rev.slice(10).map((f, i, a) => i ? f.time - a[i - 1].time : 0).slice(1).filter(d => Math.abs(d) < .5);
  assert.ok(dts.length > 20 && dts.filter(d => d < 0).length > dts.length * .8, 'Reverso: o tempo do clipe anda para trás de forma contínua (não oscila)');
  ok('Reverso do Editor toca o clipe de trás para a frente, medido em jogo');
  const lw = run(ch => {ch.animProfile = setField(ch.animProfile, 'idle', 'layerWeight', .5);});
  assert.ok(lw.length > 20 && lw.slice(15).every(f => f.weight <= .5 + 1e-6), 'Peso da camada 0,5 limita o peso do clipe');
  ok('Peso da camada do Editor limita o peso do clipe no mixer, medido em jogo');
}
{
  const run = setup => {const m = makeMatch();setup(m.chars[0]);m.run(90);return m.rec.frames.filter(f => f.who === 0 && f.id === 'idle');};
  const fr = run(ch => {ch.animProfile = setField(setField(ch.animProfile, 'idle', 'freezeAt', 20), 'idle', 'freezeFor', .3);});
  let best = 0, cur = 1;for (let i = 1; i < fr.length; i++) {cur = Math.abs(fr[i].time - fr[i - 1].time) < 1e-9 ? cur + 1 : 1;best = Math.max(best, cur);}
  assert.ok(Math.abs(best * C.test.step - .3) < .06, `Congelamento: a pose fica parada ~0,3 s (${best} quadros iguais seguidos)`);
  ok('Congelamento do Editor (20 %, 0,3 s) segura a pose por ~0,3 s, medido em jogo');
}
{
  const {FIELDS} = await import('../src/sim/animation-profile.js');
  const flag = id => (Array.isArray(FIELDS) ? FIELDS : Object.values(FIELDS)).find(x => x.id === id)?.applied;
  assert.deepEqual(['blendOut', 'layerWeight', 'reverse'].filter(id => flag(id) !== true), [], 'blendOut/layerWeight/reverse marcados como aplicados');
  const semEfeito = (Array.isArray(FIELDS) ? FIELDS : Object.values(FIELDS)).filter(x => x.applied !== true).map(x => x.id).sort();
  const esperado = ['armor', 'autoNext', 'bufferWindow', 'combatPriority', 'displacement', 'exitCondition', 'hitstopMult', 'interruptible', 'minTime', 'priority', 'repeats', 'startup', 'verticalSpeed'].sort();
  assert.deepEqual(semEfeito.filter(x => !esperado.includes(x)), [], 'nenhum campo NOVO pode ficar sem efeito (catraca: a lista só encolhe)');
  console.log('  campos do Editor ainda SEM efeito no jogo (rotulados assim na interface):', semEfeito.join(', '));
  ok('blendOut, layerWeight e reverse estão marcados como aplicados no perfil (reverse e layerWeight provados acima)');
}

// ---- (4) salvar → recarregar mantém as associações e os parâmetros ----
{
  const keepStore = Character.stateStore;Character.stateStore = null;   // este passo prova o caminho de gravação do navegador (localStorage), não o workspace carregado
  const store = new Map();globalThis.localStorage = {getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k)};
  const a = new Character(w, {persist: true});
  a.speeds.walk = 1.5;a.animProfile = setField(a.animProfile, 'idle', 'trimEnd', 80);a.phaseOff = {tackle: {active: true}};a.save();
  const b = new Character(w, {persist: true});
  assert.equal(b.speeds.walk, 1.5);assert.equal(b.animProfile.entries.idle.trimEnd, 80);assert.deepEqual(b.phaseOff, {tackle: {active: true}});
  assert.deepEqual(b.variants, a.variants, 'as associações de clipe voltam idênticas');
  delete globalThis.localStorage;Character.stateStore = keepStore;
  ok('salvar e recarregar: associações, velocidade, recorte e fases voltam idênticos');
}

// ---- (5) replay e save/load no meio: a mesma partida toca a mesma sequência de animações ----
// Comparação por frame REFORÇADA (A9): não basta a chave — comparamos também o índice/identidade do clipe, o tempo
// do clipe (action.time) e o peso efetivo. Save/load no meio da conclusão visual deve retomar a mesma sequência.
{
  const sig = m => m.rec.frames.filter(f => f.who === 0).map(f => [f.key, f.id, +f.time.toFixed(4), +f.weight.toFixed(3)]);
  const play = () => SCENARIOS.find(x => x.name.startsWith('tackle X e recuperação')).build();
  assert.deepEqual(sig(play()), sig(play()), 'dois replays idênticos tocam a mesma sequência quadro a quadro (key · id · time · weight)');
  ok('replay: duas execuções da mesma partida tocam a mesma sequência de animações, quadro a quadro, com tempo de clipe e peso');
  const m1 = makeMatch();m1.run(20);m1.step(cmd({tackle: true, move: vec(0, 1), target: 1, locked: true}));m1.run(15);
  const snap = m1.g.save();for (let i = 0; i < 120; i++) m1.step();
  const m2 = makeMatch();m2.g.load(snap);for (let i = 0; i < 120; i++) m2.step();
  const tail = m => m.rec.frames.filter(f => f.who === 0).slice(-90).map(f => [f.key, f.id, +f.time.toFixed(4), +f.weight.toFixed(3)]);
  assert.deepEqual(tail(m2), tail(m1), 'depois do load a sequência final de animações é a mesma (key · id · time · weight)');
  ok('save/load no meio do tackle: a partida carregada termina tocando a mesma sequência, com tempo de clipe e peso');
}

// ---- (6) epílogo de execução única: NENHUMA execução é cortada para locomoção/neutral/idle/turn sem razão autorizada ----
// (Pós-correção do epílogo isto deve ser zero: cada ação de execução única leva o clipe ao fim efetivo ou é
// interrompida por razão autorizada. Se este assert falhar, o critério por execução achou um corte real.)
assert.deepEqual([...synCortadas.map(r => `sintético ${r.acao}: ${r.resultado}`), ...realCortadas], [], 'zero CORTADA_INDEVIDAMENTE nos três personagens (ações de execução única concluem ou são interrompidas por razão autorizada)');
ok('epílogo: zero cortes indevidos para locomoção/neutral/idle nos três personagens');
console.log(`\n${n} verificações de animação no runtime aprovadas.`);
process.exit(0);
