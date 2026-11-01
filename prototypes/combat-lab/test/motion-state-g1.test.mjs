// Melee G1 — registro MotionState (projeção só de leitura) + observador IASA, sobre o jogo real:
//   1. o registro projeta os estados que o Character já usa, sem catálogo paralelo nem durações próprias;
//   2. entrada/saída de estado saem do log com motivo estável (reasonCode) e identidade de execução;
//   3. comando ACEITO (resultado autoritativo de Game) × RECUSADO × BUFFERIZADO: recusado não interrompe a apresentação;
//   4. andar/correr continuam cortando a conclusão visual (v1.49.19) e o interruptor «moveCancels» continua valendo;
//   5. a simulação é idêntica com e sem o observador (o save é igual byte a byte).
// Personagens reais: Eggo, Wookada e Cogumelo (GLB + configuração salva do workspace).
// Uso: node prototypes/combat-lab/test/motion-state-g1.test.mjs
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {makeMatch, cmd, vec, C, loadConfiguredSource} from './animation-runtime-harness.mjs';
import {ACTION_KEYS, COMBAT_KEYS, LOCOMOTION} from '../src/view/characters.js';
import {motionStateOf, reasonCodeOf, snapshotBefore, commandOutcome, listMotionStates} from '../src/view/motion-state.js';

let n = 0;const ok = l => {n++;console.log('✓', l);};
const lock = {target: 1, locked: true};
const shortTackle = () => {C.actions.tackle.duration = C.test.step * 8;};
const p = f => fileURLToPath(new URL('../../../chars/' + f, import.meta.url));

// ---- 1. registro: projeção dos conjuntos que o Character já usa ----
{
  const all = listMotionStates();
  for (const k of [...ACTION_KEYS, ...COMBAT_KEYS, ...LOCOMOTION]) assert.ok(all.has(k), `«${k}» está no registro`);
  assert.deepEqual(Object.keys(motionStateOf('tackle')).sort(), ['authority', 'key', 'kind', 'registered', 'timing'], 'o descritor não guarda duração, hitbox nem janela (isso é do Game)');
  assert.equal(motionStateOf('tackle').kind, 'action');assert.equal(motionStateOf('tackle').authority, 'simulation');
  assert.equal(motionStateOf('walk').kind, 'locomotion');assert.equal(motionStateOf('walk').authority, 'presentation');
  assert.equal(motionStateOf('hitstun').kind, 'reaction');assert.equal(motionStateOf('hitstun').authority, 'simulation');
  assert.equal(motionStateOf('estado_inexistente').registered, false);
  ok(`registro: ${all.size} estados projetados dos conjuntos do Character, sem durações próprias`);
}

// ---- IASA: aceito × bufferizado × recusado, sobre resultados sintéticos do Game ----
{
  const act = {kind: 'tackle'}, b = snapshotBefore({action: null, flight: null, inputBuffer: null});
  assert.deepEqual(commandOutcome(b, {tackle: true}, {action: act, flight: null}), {requested: ['tackle'], accepted: ['tackle'], buffered: [], refused: []});
  assert.deepEqual(commandOutcome(b, {tackle: true}, {action: null, flight: null, inputBuffer: {kind: 'tackle'}}), {requested: ['tackle'], accepted: [], buffered: ['tackle'], refused: []});
  assert.deepEqual(commandOutcome(b, {tackle: true}, {action: null, flight: null, inputBuffer: null}), {requested: ['tackle'], accepted: [], buffered: [], refused: ['tackle']});
  assert.deepEqual(commandOutcome(snapshotBefore({action: act}), {tackle: true}, {action: act}), {requested: ['tackle'], accepted: [], buffered: [], refused: ['tackle']}, 'a mesma ação em curso não conta como nova aceitação');
  assert.deepEqual(commandOutcome(b, {}, {action: act}).requested, [], 'sem pedido não há resultado');
  ok('commandOutcome: aceito / bufferizado / recusado derivados do resultado do Game, nunca da tecla');
}

// ---- motivos estáveis ----
{
  assert.equal(reasonCodeOf({reason: 'nova ação', to: 'tackle'}), 'action-accepted');
  assert.equal(reasonCodeOf({reason: 'nova ação (mesmo estado)', to: 'tackle'}), 'action-accepted-same-state');
  assert.equal(reasonCodeOf({reason: 'reação de combate', to: 'hitstun'}), 'combat-reaction');
  assert.equal(reasonCodeOf({reason: 'conclusão visual', epilogue: true, to: 'tackle'}), 'epilogue-start');
  assert.equal(reasonCodeOf({reason: 'conclusão natural', epilogueEnd: true, to: 'neutral'}), 'epilogue-end-natural');
  assert.equal(reasonCodeOf({reason: 'locomoção', epilogueEnd: true, to: 'walk'}), 'locomotion-cancel');
  assert.equal(reasonCodeOf({reason: 'locomoção', to: 'walk'}), 'locomotion');
  assert.equal(reasonCodeOf({reason: 'algo novo', to: 'x'}), 'other');
  ok('reasonCodeOf: motivos em português viram códigos estáveis');
}

const sources = async () => {
  const eg = await loadConfiguredSource(p('Eggo/eggo.glb'), 'eggo.glb'), w = await loadConfiguredSource(p('wookada/wookada.glb'), 'wookada.glb'), co = await loadConfiguredSource(p('mosh/Cogumelo.glb'), 'Cogumelo.glb');
  return [['Eggo', eg, co], ['Wookada', w, co], ['Cogumelo', co, w]];
};

for (const [name, src, other] of await sources()) {
  const fresh = (cfg = shortTackle) => makeMatch({cfg, sources: [src, other]});
  const step = (m, c) => {const f = m.g.fighters[0], b = snapshotBefore(f), nlog = m.chars[0].log.length;m.step(c);return {out: commandOutcome(b, c, f), logs: m.chars[0].log.slice(nlog)};};
  const intoEpilogue = m => {
    m.run(10);
    const r = step(m, cmd({tackle: true, move: vec(0, 1), ...lock}));
    let guard = 0;while (!m.chars[0].epilogue && guard++ < 160) m.step();
    assert.ok(m.chars[0].epilogue && !m.g.fighters[0].action, `${name}: epílogo ativo após o fim mecânico`);
    return r;
  };

  // ---- 2 e 3a. ação ACEITA: resultado autoritativo + entrada rastreável ----
  {
    const m = fresh();m.run(10);
    const {out, logs} = step(m, cmd({tackle: true, move: vec(0, 1), ...lock}));
    assert.deepEqual(out.accepted, ['tackle'], `${name}: tackle aceito pelo Game`);assert.deepEqual(out.refused, []);
    const enter = logs.find(e => e.to === 'tackle');
    assert.ok(enter, `${name}: a entrada em «tackle» saiu no log`);
    assert.equal(enter.reasonCode, 'action-accepted');assert.equal(enter.motion.kind, 'action');
    assert.match(enter.execTo, /^tackle#\d+$/, 'identidade da execução (serial) presente');
    ok(`${name}: tackle aceito → entrada «${enter.to}» com motivo «${enter.reasonCode}» e execução ${enter.execTo}`);
  }

  // ---- 3b. comando RECUSADO não interrompe a apresentação ----
  {
    const m = fresh(), ch = m.chars[0];
    intoEpilogue(m);
    const entry = ch.current.entry, clip = ch.current.clip.name, f = m.g.fighters[0];
    f.stamina = 0;f.regenBase = 0;f.exhausted = true;f.inputBuffer = null;   // sem stamina o Game recusa o X
    const nlog = ch.log.length;
    const {out} = step(m, cmd({tackle: true, ...lock}));   // parado: sem deslocamento, para só o comando recusado ser testado (andar corta a conclusão por outro motivo, ver 4)
    assert.ok(out.refused.includes('tackle') || out.buffered.includes('tackle'), `${name}: X sem stamina não é aceito (${JSON.stringify(out)})`);
    assert.deepEqual(out.accepted, []);
    assert.equal(ch.current.entry, entry, `${name}: a execução em curso continua a mesma`);assert.equal(ch.current.clip.name, clip);
    assert.ok(ch.epilogue, `${name}: a conclusão visual segue ativa`);
    assert.ok(!ch.log.slice(nlog).some(e => e.reasonCode === 'action-accepted'), `${name}: nenhuma transição «ação aceita» foi registrada`);
    ok(`${name}: comando ${out.refused.length ? 'recusado' : 'bufferizado'} não interrompeu «${clip}»`);
  }

  // ---- 4. andar corta a conclusão visual (v1.49.19) e o interruptor continua valendo ----
  {
    const m = fresh(), ch = m.chars[0];
    intoEpilogue(m);
    let cut = null, guard = 0;
    while (!cut && guard++ < 400) {const {logs} = step(m, cmd({move: vec(1, 0)}));cut = logs.find(e => e.epilogueEnd || e.reasonCode === 'locomotion-cancel');}
    assert.ok(cut, `${name}: a locomoção assumiu`);
    assert.equal(cut.reasonCode, 'locomotion-cancel', `${name}: motivo «${cut.reasonCode}» (esperado locomotion-cancel)`);
    assert.ok(cut.playedPct < 99, `${name}: cortou antes do fim do clipe (${cut.playedPct} %)`);
    ok(`${name}: andar cortou a conclusão visual aos ${cut.playedPct} % do clipe (${cut.reasonCode})`);

    const off = fresh(() => {shortTackle();C.display.animation.moveCancels = 0;}), chOff = off.chars[0];
    intoEpilogue(off);
    for (let i = 0; i < 6; i++) off.step(cmd({move: vec(1, 0)}));
    assert.ok(chOff.epilogue, `${name}: com «Andar e correr cortam» desligado a conclusão visual segue`);
    ok(`${name}: interruptor moveCancels desligado preservado`);
  }

  // ---- 5. a simulação é idêntica com e sem o observador ----
  {
    const run = observe => {
      const m = fresh();m.run(10);
      const seq = [cmd({tackle: true, move: vec(0, 1), ...lock}), ...Array(30).fill(0).map(() => cmd()), cmd({move: vec(1, 0)}), cmd({move: vec(1, 0)}), cmd({tackle: true, ...lock})];
      for (const c of seq) {const b = observe ? snapshotBefore(m.g.fighters[0]) : null;m.step(c);if (observe) commandOutcome(b, c, m.g.fighters[0]);}
      return JSON.stringify(m.g.save());
    };
    assert.equal(run(true), run(false), `${name}: o save do Game é idêntico com e sem observador`);
    ok(`${name}: equivalência mecânica (save idêntico com e sem observador)`);
  }
}
console.log(`\n${n} verificações do Melee G1 (MotionState + IASA observável) aprovadas.`);
