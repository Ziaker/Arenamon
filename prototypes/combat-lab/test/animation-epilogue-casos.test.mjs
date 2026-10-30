// Conclusão visual (epílogo): casos que a bateria principal (animation-epilogue.test.mjs) não cobria.
//   • Recorte (Fim do recorte), Reverso e os dois juntos: o epílogo PRECISA concluir (antes ficava preso até uma autoridade).
//   • Pausa no meio do epílogo (o app chama update com dt 0): o clipe congela, o epílogo segue e conclui ao retomar.
//   • KO e lançamento (tackle carregado) no meio do epílogo: a autoridade assume no mesmo passo.
//   • Wookada e Cogumelo REAIS (GLB + configuração salva do workspace): velocidade ≠ 1×, recorte e laço central no epílogo,
//     com deslocamento físico idêntico com a conclusão visual ligada ou desligada.
// Uso: node prototypes/combat-lab/test/animation-epilogue-casos.test.mjs
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {makeMatch, cmd, vec, C, loadConfiguredSource} from './animation-runtime-harness.mjs';
import {setField} from '../src/sim/animation-profile.js';

let n = 0;const ok = l => {n++;console.log('✓', l);};
const lock = {target: 1, locked: true};
const shortTackle = () => {C.actions.tackle.duration = C.test.step * 8;};

/** Tackle do azul até o epílogo começar; `fields` = campos do Editor aplicados ao tackle antes. */
function intoEpilogue({fields = {}, speed = null, extra = {}, tackle = {move: vec(0, 1), ...lock}} = {}) {
  const m = makeMatch({cfg: shortTackle, ...extra}), ch = m.chars[0];
  for (const [k, v] of Object.entries(fields)) ch.animProfile = setField(ch.animProfile, 'tackle', k, v);
  if (speed) ch.speeds = {...ch.speeds, tackle: speed};
  m.run(10);m.step(cmd({tackle: true, ...tackle}));
  let guard = 0;
  while (!ch.epilogue && guard++ < 120) m.step();
  assert.ok(ch.epilogue && !m.g.fighters[0].action, 'epílogo ativo após o fim mecânico');
  return m;
}
/** Avança até o tackle sair; devolve passos tocados e o log da saída. */
function finish(m, c = () => cmd(), limit = 600) {
  const ch = m.chars[0], from = ch.log.length, times = [];let steps = 0;
  while (ch.current?.key === 'tackle' && steps < limit) {if (ch.epilogue) times.push(ch.current.action.time);m.step(c(steps));steps++;}
  const outs = ch.log.slice(from).filter(e => e.from === 'tackle');   // a conclusão natural vem antes da transição normal do mesmo quadro
  return {steps, times, stuck: ch.current?.key === 'tackle', end: outs.find(e => e.epilogueEnd) ?? outs[0]};
}

// ---- 1. recorte, reverso e recorte + reverso concluem naturalmente (regressão: antes o epílogo nunca terminava) ----
for (const [label, fields] of [['Fim do recorte 60 %', {trimEnd: 60}], ['Reverso', {reverse: true}], ['Recorte 70 % + Reverso', {trimEnd: 70, reverse: true}], ['Início do recorte 20 %', {trimStart: 20}]]) {
  const m = intoEpilogue({fields}), r = finish(m);
  assert.ok(!r.stuck, `${label}: o epílogo concluiu (${r.steps} passos)`);
  assert.ok(m.chars[0].log.some(e => e.reason === 'conclusão natural' && e.epilogueEnd), `${label}: conclusão natural registrada`);
  ok(`${label}: conclusão visual chega ao fim efetivo e transita (${r.steps} passos)`);
}

// ---- 2. pausa no meio do epílogo: dt 0 congela o clipe sem encerrar o epílogo; ao retomar, conclui ----
{
  const m = intoEpilogue(), ch = m.chars[0], f = m.g.fighters[0];
  m.step();m.step();
  const t0 = ch.current.action.time, logs0 = ch.log.length;
  for (let i = 0; i < 90; i++) ch.update(f, 0, 0, [], {tick: m.g.tick, source: 'jogador', fighters: m.g.fighters});   // o que view.js faz com a partida pausada
  assert.equal(ch.current.action.time, t0, 'clipe congelado durante a pausa');
  assert.ok(ch.epilogue && ch.current.key === 'tackle', 'epílogo segue ativo durante a pausa');
  assert.equal(ch.log.length, logs0, 'nenhuma transição durante a pausa');
  const r = finish(m);
  assert.ok(!r.stuck && r.end?.reason === 'conclusão natural', `retomado, o epílogo conclui naturalmente (${r.end?.reason})`);
  ok(`pausa de 90 quadros no meio do epílogo: tempo congelado em ${t0.toFixed(3)} s, sem transição; retomado, conclui`);
}

// ---- 3. KO no meio do epílogo: a derrota assume no mesmo passo ----
{
  const m = intoEpilogue({extra: {positions: [vec(0, -3), vec(0, -1.4)], cfg: () => {shortTackle();C.actions.tackle.distance = 0;}}}), ch = m.chars[0], f = m.g.fighters[0];
  C.actions.tackle.duration = .5;C.actions.tackle.distance = 2.5;
  f.hp = 1;
  let ko = false;
  for (let i = 0; i < 30 && !ko; i++) {m.step(cmd(), cmd({tackle: true, move: vec(0, -1), target: 0, locked: true}));ko = f.hp <= 0;}
  assert.ok(ko, 'o azul foi derrotado');
  assert.ok(!ch.epilogue, 'epílogo encerrado pelo KO');
  assert.notEqual(ch.current.key, 'tackle', `o clipe da ação saiu no passo do KO (key=${ch.current.key})`);
  ok(`KO durante o epílogo: a derrota assume na hora (key=${ch.current.key})`);
}

// ---- 4. lançamento (tackle carregado do rival) no meio do epílogo: o voo assume ----
{
  const m = makeMatch({cfg: () => {shortTackle();C.actions.tackle.distance = 0;}, positions: [vec(0, -.9), vec(0, .1)]}), ch = m.chars[0], f = m.g.fighters[0];
  const hold = cmd({tackle: true, tackleHeld: true, move: vec(0, -1), target: 0, locked: true});
  m.run(125, () => cmd(), () => hold);
  m.step(cmd({tackle: true, move: vec(0, -1)}), hold);
  let guard = 0;
  while (!ch.epilogue && guard++ < 40) m.step(cmd(), hold);
  assert.ok(ch.epilogue, 'epílogo do azul ativo enquanto o rival carrega');
  let launched = false;
  for (let i = 0; i < 40 && !launched; i++) {m.step(cmd(), cmd({move: vec(0, -1), target: 0, locked: true}));launched = !!f.flight;}
  assert.ok(launched, 'o azul foi lançado pelo tackle carregado');
  assert.ok(!ch.epilogue && ch.current.key !== 'tackle', `o lançamento encerrou o epílogo (key=${ch.current.key})`);
  ok(`lançamento durante o epílogo: o voo assume na hora (key=${ch.current.key})`);
}

// ---- 5. GLBs reais com a configuração salva: velocidade ≠ 1×, recorte e laço central; física idêntica ligada/desligada ----
const p = f => fileURLToPath(new URL('../../../chars/' + f, import.meta.url));
const w = await loadConfiguredSource(p('wookada/wookada.glb'), 'wookada.glb'), co = await loadConfiguredSource(p('mosh/Cogumelo.glb'), 'Cogumelo.glb');
for (const [name, src, other] of [['Wookada', w, co], ['Cogumelo', co, w]]) {
  for (const [label, fields, speed] of [['configuração salva', {}, null], ['velocidade 1,5×', {}, 1.5], ['velocidade 0,7×', {}, .7], ['Fim do recorte 80 %', {trimEnd: 80}, null], ['laço central 20–60 %', {loopStart: 20, loopEnd: 60}, null], ['Reverso', {reverse: true}, null]]) {
    const m = intoEpilogue({fields, speed, extra: {sources: [src, other]}}), ch = m.chars[0], f = m.g.fighters[0];
    const clip = ch.current.clip.name, x0 = f.position.x;
    const r = finish(m, () => cmd({move: vec(1, 0)}), 2400);
    assert.ok(!r.stuck, `${name} · ${label}: o epílogo de «${clip}» concluiu`);
    assert.ok(Math.abs(f.position.x - x0) > .01, `${name} · ${label}: o lutador andou durante o epílogo`);
    assert.equal(r.end?.reason, 'conclusão natural', `${name} · ${label}: saída por conclusão natural (${r.end?.reason})`);
    if (!fields.reverse && !fields.loopStart && r.times.length >= 3) {   // relógio próprio: avança velocidade × passo (sem laço nem espelho)
      const rate = (r.times.at(-1) - r.times[0]) / ((r.times.length - 1) * C.test.step), want = ch.speedOf('tackle');
      assert.ok(Math.abs(rate - want) < want * .02, `${name} · ${label}: o clipe avança a ${rate.toFixed(3)}×/s no epílogo (esperado ${want.toFixed(3)})`);
    }
    ok(`${name} · ${label}: «${clip}» conclui andando (${r.steps} passos, Δx ${(f.position.x - x0).toFixed(2)} m)`);
  }
  const trace = off => {
    const m = makeMatch({cfg: shortTackle, sources: [src, other]});
    if (off) m.chars[0].animProfile = setField(m.chars[0].animProfile, 'tackle', 'visualCompletion', false);
    m.run(10);m.step(cmd({tackle: true, move: vec(0, 1), ...lock}));
    const out = [];
    for (let i = 0; i < 150; i++) {m.step(i > 10 ? cmd({move: vec(1, 0)}) : cmd());out.push(m.g.fighters.map(x => [x.position.x, x.position.z, x.hp, x.stamina, x.state].map(v => typeof v === 'number' ? +v.toFixed(9) : v)).join('|'));}
    return out;
  };
  assert.deepEqual(trace(false), trace(true), `${name}: física idêntica com a conclusão visual ligada/desligada`);
  ok(`${name}: o epílogo não altera colisor, posição, vida, stamina nem estado (150 passos andando)`);
}
console.log(`\n${n} verificações dos casos extras da conclusão visual aprovadas.`);
process.exit(0);
