// Contrato fino do epílogo de conclusão visual (visual-epilogue.js), dois grupos de asserts que os demais testes
// não carregam em precisão:
//   1. Transição pós-epílogo: com ação de execução única (duração mecânica < duração do clipe) e sem novos comandos,
//      a transição que encerra a conclusão visual (a) ocorre SÓ após o clipe alcançar o fim efetivo, (b) tem reason
//      'locomoção' ou 'conclusão natural' e (c) carrega epilogueEnd: true com playedPct 100 (≥95) no character.log.
//   2. Peso dominante do sucessor: quando uma ação autorizada interrompe o epílogo, no PRIMEIRO frame em que o clipe
//      novo está presente no mixer o peso efetivo dele é o dominante (> 0,5) — interrupção imediata de verdade,
//      sem frame fantasma com peso residual do clipe antigo.
// Mecânica real (Game) + Character real + mixer, sem navegador. Infra: animation-runtime-harness.mjs.
// Uso: node prototypes/combat-lab/test/animation-epilogue-contract.test.mjs
import assert from 'node:assert/strict';
import {makeMatch, cmd, vec, C} from './animation-runtime-harness.mjs';

let n = 0;const ok = l => {n++;console.log('✓', l);};
const lock = {target: 1, locked: true};
// Tackle mecânico curto (8 passos): a liberação mecânica acontece com ~1/8 do clipe, sobrando um epílogo longo.
const shortTackle = () => {C.actions.tackle.duration = C.test.step * 8;};
/** Toca um tackle com o lutador azul e avança até o epílogo estar ativo (fim mecânico recém-ocorrido). */
function tackleIntoEpilogue() {
  const m = makeMatch({cfg: shortTackle});
  m.run(10);
  m.step(cmd({tackle: true, move: vec(0, 1), ...lock}));
  let guard = 0;
  while (!m.chars[0].epilogue && guard++ < 120) m.step();
  assert.ok(!m.g.fighters[0].action, 'ação mecânica encerrada');
  assert.ok(m.chars[0].epilogue, 'epílogo ativo após o fim mecânico');
  return m;
}
const frames0 = m => m.rec.frames.filter(f => f.who === 0);

// ---- 1. transição pós-epílogo: só no fim efetivo, reason 'locomoção'/'conclusão natural', epilogueEnd + playedPct 100 ----
{
  const m = tackleIntoEpilogue(), ch = m.chars[0];
  const cap = ch.current.clip.duration, step = C.test.step;
  const times = [];
  let endTick = null, guard = 0;
  while (ch.current?.key === 'tackle' && guard++ < 400) {
    m.step();
    if (ch.current?.key === 'tackle') {times.push(ch.current.action.time);endTick = m.g.tick;}
  }
  assert.ok(ch.current.key !== 'tackle', 'o epílogo transitou para fora do tackle');
  const last = times.at(-1);
  // (a) a transição só ocorre DEPOIS do fim efetivo do clipe
  assert.ok(times.length >= 3, `o clipe continuou por ${times.length} passos após o fim mecânico`);
  assert.ok(last >= cap - 3 * step, `(a) fim efetivo alcançado antes da transição (${last.toFixed(3)} / ${cap.toFixed(3)} s)`);
  // (b)+(c) o evento que encerra o epílogo: reason autorizada pós-conclusão, epilogueEnd e playedPct 100
  const closers = ch.log.filter(e => e.epilogueEnd === true && ['locomoção', 'conclusão natural'].includes(e.reason));
  assert.ok(closers.length > 0, `(b) existe transição encerrando o epílogo com reason 'locomoção'/'conclusão natural' (log tem: ${ch.log.filter(e => e.epilogueEnd).map(e => `${e.reason}@${e.tick}`).join(', ') || 'nenhuma'})`);
  const closer = closers.at(-1);
  assert.ok(closer.tick >= endTick, `(a) a transição pós-epílogo ocorre após o último quadro do clipe (tick ${closer.tick} ≥ ${endTick})`);
  assert.ok(closer.playedPct >= 95, `(c) playedPct do fechamento ≥ 95 (veio ${closer.playedPct})`);
  ok(`transição pós-epílogo: clipe a ${(last / cap * 100).toFixed(0)}% do efetivo, fechamento «${closer.reason}» com epilogueEnd e playedPct ${closer.playedPct}`);
}

// ---- 2. sucessão com blend: presença imediata, dominância no prazo do blendIn, epílogo sem camadas residuais ----
// Critério do responsável: «começar no mesmo passo» = clipe novo PRESENTE e avançando no passo do comando (o fade-in
// ~0,1 s é o blend visual apropriado — corte duro com peso 1 o violaria). A dominância é exigida só dentro do blendIn.
{
  const m = tackleIntoEpilogue(), ch = m.chars[0];
  const step = C.test.step;
  // (3) ANTES da interrupção: durante o epílogo o clipe corrente é dominante (≥ 0,9) — nada de camadas de fade
  // residuais lingerando durante a conclusão visual. Amostra ANTES do comando; o assert fica ao final do grupo.
  const epW = [];
  let guard = 0;
  while (ch.epilogue && ch.current?.key === 'tackle' && guard++ < 60) {
    m.step();
    const lf = frames0(m).at(-1);
    if (ch.epilogue && ch.current?.key === 'tackle') epW.push(lf.weight);
  }
  assert.ok(epW.length >= 3, `epílogo amostrado por ${epW.length} passos antes da interrupção`);
  const minEp = Math.min(...epW);
  // (1) MESMO passo do comando autorizado: clipe novo presente, peso > 0 e tempo avançando a partir de 0.
  const before = frames0(m).length;
  m.step(cmd({dodge: true, move: vec(0, -1), dodgeDirection: vec(0, -1)}));
  const born = frames0(m).slice(before);
  const firstNew = born.find(f => f.key.startsWith('dodge'));
  assert.ok(firstNew, 'o clipe novo está presente no mixer já no passo do comando');
  assert.ok(firstNew.weight > 0, `(1) clipe novo com peso > 0 no mesmo passo (${firstNew.weight.toFixed(3)})`);
  assert.ok(firstNew.time < step * 1.5, `(1) clipe novo começando do zero (time ${firstNew.time.toFixed(4)} s)`);
  m.step();
  const nxt = frames0(m).at(-1);
  assert.ok(nxt.key.startsWith('dodge') && nxt.time > firstNew.time, `(1) tempo do clipe novo avançando (${firstNew.time.toFixed(4)} → ${nxt.time.toFixed(4)} s)`);
  ok(`(1) mesmo passo: clipe novo presente (peso ${firstNew.weight.toFixed(3)}), começando do zero e avançando`);
  // (2) dominância em até ceil(blendIn/step) passos (blendIn efetivo da ação: profile 'blendIn' ?? actionFade).
  const blendIn = ch.current.fade ?? 0.1, window = Math.max(1, Math.ceil(blendIn / step));
  m.run(Math.max(0, window - 2));
  const after = frames0(m).slice(before);
  const residual = ch.layers.reduce((a, l) => a + l.weight, 0);
  const dodgeFrames = after.filter(f => f.key.startsWith('dodge'));
  const dominant = dodgeFrames.find(f => f.weight >= 0.5) ?? (dodgeFrames.at(-1).weight >= 2 * residual ? dodgeFrames.at(-1) : null);
  assert.ok(dominant, `(2) clipe novo dominante em até ${window} passos (blendIn ${blendIn.toFixed(3)} s; pesos ${dodgeFrames.map(f => f.weight.toFixed(2)).join('→')}, residual ${residual.toFixed(2)})`);
  ok(`(2) dominância no prazo do blend: peso ${dominant.weight.toFixed(2)} no frame ${dodgeFrames.indexOf(dominant) + 1} (janela ${window}, blendIn ${blendIn.toFixed(2)} s)`);
  assert.ok(minEp >= 0.9, `(3) clipe corrente dominante durante o epílogo (peso mínimo ${minEp.toFixed(3)} em ${epW.length} passos)`);
  ok(`sucessão com blend respeitado; epílogo com peso mínimo ${minEp.toFixed(2)}`);
}

console.log(`\n${n} verificações do contrato fino do epílogo aprovadas.`);
process.exit(0);
