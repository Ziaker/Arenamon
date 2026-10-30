// Save/load no meio do epílogo de conclusão visual (contrato): a partida salva DURANTE o epílogo deve retomar a
// MESMA sequência de animação — comparada por frame: chave do estado visual, identidade do clipe, tempo do clipe
// (action.time) e peso efetivo. O estado do epílogo precisa fazer parte do save/load (visual-epilogue.js).
// Este arquivo é intencionalmente separado de animation-epilogue.test.mjs (mantido pela sessão do visual-epilogue).
// Uso: node prototypes/combat-lab/test/animation-epilogue-persist.test.mjs
import assert from 'node:assert/strict';
import {makeMatch, clip, cmd, vec, setupRegistry} from './animation-runtime-harness.mjs';

const lock = {target: 1, locked: true};
const STEP = 1 / 120;

/** Partida com o clipe do Move «swift» (execução única de laço livre) trocado por um de 2,5 s. */
function match() {
  setupRegistry();
  const m = makeMatch({equip: [['swift'], []]});
  const sIdx = m.chars[0].variants.move_swift[0];
  m.chars[0].clips[sIdx] = clip(m.chars[0].clips[sIdx].name, 2.5, 25);
  m.run(15);
  return m;
}
const frames = (m, who = 0) => m.rec.frames.filter(f => f.who === who);

// ---- save no meio do epílogo: a partida carregada retoma a mesma sequência (key · id · time · weight) ----
{
  const m1 = match(), f = m1.g.fighters[0];
  m1.step(cmd({skill: 0, skillHeld: [true, false, false, false], ...lock}));
  let i = 0;while (i++ < 600 && f.action) m1.step();          // até a liberação mecânica
  m1.run(10);                                                  // 10 frames dentro do epílogo
  const cur = m1.chars[0].current;
  assert.equal(cur?.id, 'move_swift', `save feito no meio do epílogo (clipe atual «${cur?.id}», tempo ${cur?.action.time.toFixed(2)}/${cur?.clip.duration.toFixed(2)} s)`);
  const snap = m1.g.save();
  for (let j = 0; j < 90; j++) m1.step();
  const m2 = match();
  const n0 = frames(m2).length;   // frames do warmup pré-load (descartados na comparação)
  m2.g.load(snap);
  for (let j = 0; j < 90; j++) m2.step();
  const sig = x => [x.key, x.id, +x.time.toFixed(4), +x.weight.toFixed(3)];
  const tail1 = frames(m1).slice(-90).map(sig), tail2 = frames(m2).slice(n0).map(sig);
  assert.deepEqual(tail2, tail1, 'partida carregada retoma a mesma sequência de animação do epílogo (key · id · time · weight)');
  console.log('✓ save/load no meio do epílogo: a sequência retoma idêntica (chave, clipe, tempo e peso por frame)');
}

// ---- replay no meio do epílogo: duas execuções idênticas reproduzem frame a frame ----
{
  const play = () => {const m = match();m.step(cmd({skill: 0, skillHeld: [true, false, false, false], ...lock}));m.run(150);return frames(m).map(x => [x.key, x.id, +x.time.toFixed(4), +x.weight.toFixed(3)]);};
  assert.deepEqual(play(), play(), 'dois replays com epílogo reproduzem a mesma sequência quadro a quadro');
  console.log('✓ replay com epílogo: sequência idêntica quadro a quadro (chave, clipe, tempo e peso)');
}
console.log('\nsave/load e replay do epílogo aprovados.');
process.exit(0);
