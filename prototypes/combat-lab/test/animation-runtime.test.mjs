// Animações no RUNTIME (gameplay real, Editor fechado): todas as ações configuráveis do Editor (65 entradas fixas + move_<id> dos 19 Moves + charge_/release_ dos Moves de carga)
// precisam TOCAR a partir de uma partida de verdade (Game + Character + AnimationMixer), com o clipe exato configurado e sem substituição silenciosa por reserva.
// Dois conjuntos: (1) personagem sintético com UM clipe distinto por ação (prova o roteamento de todas as ações) e (2) os GLBs importados de verdade (Wookada e Cogumelo).
// Também prova velocidade/recorte/laço do Editor aplicados ao mixer, persistência (salvar → recarregar) e determinismo (replay / save-load no meio).
// Uso: node prototypes/combat-lab/test/animation-runtime.test.mjs      (≈ 10 s; a matriz completa: node scripts/gen-matriz-animacoes.mjs → docs/MATRIZ_ANIMACOES_RUNTIME.md)
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {runAll, rowsFor, RESERVA} from './animation-runtime-matrix.mjs';
import {loadRealSource, makeCharacter, makeMatch, configurableActions, setupRegistry, cmd, vec, C, listMoves, EDITOR_IDS} from './animation-runtime-harness.mjs';
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
assert.deepEqual(synRows.filter(r => r.resultado !== 'OK').map(r => `${r.acao}: ${r.resultado}`), [], 'toda ação configurada com clipe válido toca no gameplay real com o clipe exato');
ok(`sintético: ${synRows.length} de ${synRows.length} ações tocaram com o clipe exato configurado (nenhuma reserva, nenhuma substituição)`);

// ---- (2) GLBs importados de verdade ----
const w = await loadRealSource(chars('wookada/wookada.glb'), 'wookada.glb'), c = await loadRealSource(chars('mosh/Cogumelo.glb'), 'Cogumelo.glb');
// cada modelo importado é o lutador AZUL (o que age em todos os cenários) numa rodada própria; o outro serve de rival
const runs = [[w, runAll([w, c])], [c, runAll([c, w])]];
for (const [src, real] of runs) {
  const who = 0, ch = new Character(src, {persist: false}), rows = rowsFor(src.name, ch, real, false, who);
  const configured = rows.filter(r => r.configurado !== '—');
  assert.deepEqual(rows.filter(r => r.resultado.startsWith('FALHA')).map(r => `${r.acao}: ${r.resultado}`), [], `${src.name}: toda ação com clipe configurado toca no gameplay real (ou é reserva documentada)`);
  ok(`${src.name} (importado): ${configured.length} ações configuradas, ${rows.filter(r => r.resultado === 'OK').length} tocadas com o clipe exato, ${rows.filter(r => r.resultado.startsWith('reserva')).length} reservas, ${rows.length - configured.length} sem clipe configurado`);
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

// ---- (4) salvar → recarregar mantém as associações e os parâmetros ----
{
  const store = new Map();globalThis.localStorage = {getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k)};
  const a = new Character(w, {persist: true});
  a.speeds.walk = 1.5;a.animProfile = setField(a.animProfile, 'idle', 'trimEnd', 80);a.phaseOff = {tackle: {active: true}};a.save();
  const b = new Character(w, {persist: true});
  assert.equal(b.speeds.walk, 1.5);assert.equal(b.animProfile.entries.idle.trimEnd, 80);assert.deepEqual(b.phaseOff, {tackle: {active: true}});
  assert.deepEqual(b.variants, a.variants, 'as associações de clipe voltam idênticas');
  delete globalThis.localStorage;
  ok('salvar e recarregar: associações, velocidade, recorte e fases voltam idênticos');
}

// ---- (5) replay e save/load no meio: a mesma partida toca a mesma sequência de animações ----
{
  const seq = m => m.rec.frames.filter(f => f.who === 0).map(f => `${f.key}>${f.id}`);
  const play = () => SCENARIOS.find(x => x.name.startsWith('tackle X e recuperação')).build();
  assert.deepEqual(seq(play()), seq(play()), 'dois replays idênticos tocam a mesma sequência quadro a quadro');
  ok('replay: duas execuções da mesma partida tocam a mesma sequência de animações, quadro a quadro');
  const m1 = makeMatch();m1.run(20);m1.step(cmd({tackle: true, move: vec(0, 1), target: 1, locked: true}));m1.run(15);
  const snap = m1.g.save();for (let i = 0; i < 120; i++) m1.step();
  const m2 = makeMatch();m2.g.load(snap);for (let i = 0; i < 120; i++) m2.step();
  const tail = m => m.rec.frames.filter(f => f.who === 0).slice(-90).map(f => `${f.key}>${f.id}`);
  assert.deepEqual(tail(m2), tail(m1), 'depois do load a sequência final de animações é a mesma');
  ok('save/load no meio do tackle: a partida carregada termina tocando a mesma sequência');
}
console.log(`\n${n} verificações de animação no runtime aprovadas.`);
process.exit(0);
