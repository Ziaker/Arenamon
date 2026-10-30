// Conclusão visual independente (epílogo): execução única não concluída segue tocando até o fim efetivo do clipe
// quando a simulação já a liberou. Mecânica real (Game) + Character real + mixer, sem navegador.
// Cobre: continuação até o fim do clipe, locomoção durante o epílogo, comando recusado, interrupções autorizadas
// (ação nova, impacto), síntese do pouso com recuperação zero e identidade própria de execuções consecutivas.
// Uso: node prototypes/combat-lab/test/animation-epilogue.test.mjs
import assert from 'node:assert/strict';
import {makeMatch, cmd, vec, C} from './animation-runtime-harness.mjs';

let n = 0;const ok = l => {n++;console.log('✓', l);};
const lock = {target: 1, locked: true};
// Tackle mecânico curto (8 passos exatos): sobra ~1/8 do clipe após o fim mecânico e o epílogo dura vários quadros.
const shortTackle = () => {C.actions.tackle.duration = C.test.step * 8;};
const stepsOf = s => Math.ceil(s / C.test.step);
/** Toca um tackle com o lutador azul e avança até o epílogo estar ativo (fim mecânico acabou de ocorrer). */
function tackleIntoEpilogue(extra = {}) {
  const m = makeMatch({cfg: shortTackle, ...extra});
  m.run(10);
  m.step(cmd({tackle: true, move: vec(0, 1), ...lock}));
  let guard = 0;
  while (!m.chars[0].epilogue && guard++ < 120) m.step();
  assert.ok(!m.g.fighters[0].action, 'ação mecânica encerrada');
  assert.ok(m.chars[0].epilogue, 'epílogo ativo após o fim mecânico');
  return m;
}

// ---- 1. após o fim mecânico o clipe continua avançando até o fim efetivo; SÓ então transita ----
{
  const m = tackleIntoEpilogue(), ch = m.chars[0];
  const cap = ch.current.clip.duration;
  const times = [];
  let guard = 0;
  while (ch.current?.key === 'tackle' && guard++ < 400) {m.step();if (ch.current?.key === 'tackle') times.push(ch.current.action.time);}
  assert.ok(ch.current.key !== 'tackle', 'transição para idle/locomoção só depois do fim do clipe');
  assert.ok(times.length >= 3, `o clipe continuou por ${times.length} passos após o fim mecânico`);
  for (let i = 1; i < times.length; i++) assert.ok(times[i] >= times[i - 1] - 1e-9, `tempo monotônico (${times[i - 1]} → ${times[i]})`);
  assert.ok(times.at(-1) >= cap - 3 * C.test.step, `tempo efetivo alcançou o fim do clipe (${times.at(-1).toFixed(3)} / ${cap.toFixed(3)})`);
  const ep = ch.log.filter(e => e.epilogue || e.epilogueEnd);
  assert.ok(ep.some(e => e.reason === 'conclusão visual' && e.epilogue === true && e.to === 'tackle'), 'evento de entrada no epílogo');
  assert.ok(ep.some(e => e.reason === 'conclusão natural' && e.epilogueEnd === true && e.playedPct === 100), 'evento de conclusão natural');
  const cut = ch.log.find(e => e.to === 'tackle' && !e.epilogue);
  const after2 = ch.log[ch.log.indexOf(cut) + 1];
  assert.ok(after2 && !after2.interrupted, 'a conclusão natural não conta como interrupção');
  ok(`fim mecânico → epílogo → conclusão natural: o clipe toca até ${(times.at(-1) / cap * 100).toFixed(0)}% do efetivo antes de transitar`);
}

// ---- 2. movimento direcional após a liberação mecânica NÃO interrompe o clipe ----
{
  const m = tackleIntoEpilogue(), ch = m.chars[0], f = m.g.fighters[0];
  const z0 = f.position.z;
  for (let i = 0; i < 6; i++) m.step(cmd({move: vec(0, 1)}));
  assert.ok(ch.epilogue && ch.current.key === 'tackle', `clipe da ação segue durante o movimento (key=${ch.current.key})`);
  assert.ok(Math.abs(f.position.z - z0) > .01, `o lutador se desloca fisicamente durante o epílogo (Δz=${(f.position.z - z0).toFixed(3)})`);
  ok('locomoção física liberada não corta o clipe: o lutador anda enquanto a ação conclui visualmente');
}

// ---- 3. comando recusado durante o epílogo NÃO interrompe o clipe ----
{
  const m = tackleIntoEpilogue(), ch = m.chars[0], f = m.g.fighters[0];
  m.step(cmd({skill: 0, skillHeld: [true, false, false, false], ...lock}));   // slot vazio: recusado, nunca altera f
  assert.ok(!f.action && !f.guard && !f.flight, 'o comando recusado não alterou o estado autoritativo');
  assert.ok(ch.epilogue && ch.current.key === 'tackle', 'o clipe segue após o comando recusado');
  ok('ação recusada durante o epílogo não interrompe o clipe (e não toca o estado mecânico)');
}

// ---- 4. nova esquiva autorizada durante o epílogo interrompe imediatamente ----
{
  const m = tackleIntoEpilogue(), ch = m.chars[0];
  m.step(cmd({dodge: true, move: vec(0, -1), dodgeDirection: vec(0, -1)}));
  assert.ok(!ch.epilogue, 'epílogo zerado pela ação nova');
  assert.ok(ch.current.key.startsWith('dodge'), `nova esquiva assume no mesmo passo (key=${ch.current.key})`);
  assert.ok(ch.current.action.time < ch.current.clip.duration * .5, 'clipe da esquiva começa do início');
  assert.ok(ch.log.at(-1).epilogueEnd === true, 'transição de interrupção marcada com epilogueEnd');
  ok('esquiva autorizada no meio do epílogo: interrupção imediata, com epilogueEnd no log');
}

// ---- 5. impacto (golpe recebido) durante o epílogo interrompe com a reação correta ----
{
  const m = tackleIntoEpilogue({positions: [vec(0, -3), vec(0, -1.4)], cfg: () => {shortTackle();C.actions.tackle.distance = 0;}}), ch = m.chars[0];
  C.actions.tackle.duration = .5;C.actions.tackle.distance = 2.5;   // devolve o alcance ao tackle do rival (o do azul já acabou)
  let reacted = null;
  for (let i = 0; i < 20 && !reacted; i++) {
    m.step(cmd(), cmd({tackle: true, move: vec(0, -1), target: 0, locked: true}));
    if (['hitstun', 'airborne', 'airborne_up', 'stagger'].includes(ch.current.key)) reacted = ch.current.key;
  }
  assert.ok(reacted, 'o impacto interrompeu o epílogo com a reação de combate');
  assert.ok(!ch.epilogue, 'epílogo encerrado pela reação');
  ok(`impacto durante o epílogo → reação imediata (${reacted}), sem atraso da autoridade mecânica`);
}

// ---- 6. pouso com recuperação mecânica zero toca o clipe «land» até o fim (síntese do pouso, A3) ----
{
  const m = makeMatch({cfg: () => {C.rules.landingRecovery = 0;}, positions: [vec(0, -.9), vec(0, .1)]});
  const ch = m.chars[0], f = m.g.fighters[0];
  m.run(140, () => cmd(), () => cmd({tackle: true, tackleHeld: true, move: vec(0, -1), target: 0, locked: true}));
  m.run(60, () => cmd(), () => cmd());
  let guard = 0;
  while ((f.flight || f.knockRecovery > 0) && guard++ < 900) m.step();
  assert.ok(!f.flight && f.hp > 0, 'o lutador azul foi lançado e pousou vivo');
  assert.equal(f.state, 'neutral', 'pouso com recuperação mecânica zero (estado neutro)');
  assert.equal(ch.current.key, 'landing', `o pouso sintetizado entra em «landing» (key=${ch.current.key})`);
  assert.ok(ch.epilogue, 'epílogo ativo sobre o «landing»');
  assert.ok(ch.log.some(e => e.to === 'landing' && e.reason === 'reação de combate'), 'entrada em «landing» registrada');
  const cap = ch.current.clip.duration, times = [];
  guard = 0;
  while (ch.current.key === 'landing' && guard++ < 500) {m.step();if (ch.current.key === 'landing') times.push(ch.current.action.time);}
  for (let i = 1; i < times.length; i++) assert.ok(times[i] >= times[i - 1] - 1e-9, 'tempo do «land» monotônico');
  assert.ok(times.at(-1) >= cap - 3 * C.test.step, `clipe «land» tocou até o fim (${times.at(-1).toFixed(3)} / ${cap.toFixed(3)})`);
  assert.ok(ch.log.some(e => e.reason === 'conclusão natural' && e.epilogueEnd), 'conclusão natural do pouso registrada');
  ok(`pouso com recuperação zero: clipe «land» sintetizado e tocado até o fim (${times.length} passos)`);
}

// ---- 7. duas execuções consecutivas do mesmo Move reiniciam o clipe do zero na segunda ----
{
  const m = tackleIntoEpilogue(), ch = m.chars[0];
  let guard = 0;
  while (ch.epilogue && guard++ < 400) m.step();   // deixa o epílogo concluir naturalmente
  assert.ok(!ch.epilogue, 'epílogo da primeira execução concluído');
  m.step(cmd({tackle: true, move: vec(0, 1), ...lock}));
  assert.equal(ch.current.key, 'tackle', 'segunda execução do mesmo Move');
  assert.ok(ch.current.action.time < ch.current.clip.duration * .5, `segunda execução recomeça do zero (t=${ch.current.action.time.toFixed(3)})`);
  assert.ok(['nova ação', 'nova ação (mesmo estado)'].includes(ch.log.at(-1).reason), `nova entrada com identidade própria (${ch.log.at(-1).reason})`);
  ok('duas execuções consecutivas do mesmo Move: o clipe recomeça do zero na segunda (epílogo antigo não controla a execução nova)');
}

// ---- controle do Editor «Conclusão visual»: desligado por ação, o clipe acompanha o estado mecânico (sem epílogo) ----
{
  const {setField} = await import('../src/sim/animation-profile.js');
  const m = makeMatch({cfg: shortTackle});
  m.chars[0].animProfile = setField(m.chars[0].animProfile, 'tackle', 'visualCompletion', false);
  m.run(10);
  m.step(cmd({tackle: true, move: vec(0, 1), ...lock}));
  let sawEpilogue = false;
  for (let i = 0; i < 80; i++) {m.step();if (m.chars[0].epilogue) sawEpilogue = true;}
  assert.ok(!sawEpilogue, 'com «Conclusão visual» desligada para o tackle o epílogo nunca começa');
  const on = tackleIntoEpilogue();
  assert.ok(on.chars[0].epilogue, 'ligada (padrão) o epílogo começa');
  ok('Editor › Conclusão visual: o interruptor por ação liga/desliga o epílogo no jogo');
}
console.log(`\n${n} verificações do epílogo de conclusão visual aprovadas.`);
process.exit(0);
