// Melee G2 — eventos visuais tipados do Anim (state-enter, state-exit, epilogue-start, epilogue-end, epilogue-interrupted):
//   • cada evento tem identidade estável (executionId + tipo = eventId) e sai UMA vez por execução;
//   • conclusão natural, interrupção por locomoção e interrupção por ação nova são distinguíveis;
//   • prévia do Editor/Move fica isolada (não gera evento); comando recusado não gera evento;
//   • recorte e reverso concluem com um único epilogue-end;
//   • save/load no meio do epílogo NÃO repete state-enter/epilogue-start e conclui uma vez;
//   • replay determinístico; a simulação é idêntica com e sem ouvinte.
// Personagens reais: Eggo, Wookada e Cogumelo. Uso: node prototypes/combat-lab/test/anim-events-g2.test.mjs
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {makeMatch, cmd, vec, C, loadConfiguredSource} from './animation-runtime-harness.mjs';
import {setField} from '../src/sim/animation-profile.js';

let n = 0;const ok = l => {n++;console.log('✓', l);};
const lock = {target: 1, locked: true};
const shortTackle = () => {C.actions.tackle.duration = C.test.step * 8;};
const p = f => fileURLToPath(new URL('../../../chars/' + f, import.meta.url));
const TYPES = ['state-enter', 'state-exit', 'epilogue-start', 'epilogue-end', 'epilogue-interrupted'];
const idOf = (E, type) => e => e.executionId === E && e.type === type;
const sig = ev => ev.map(e => [e.type, e.eventId, e.tick, e.state, e.reasonCode ?? null]);

const eg = await loadConfiguredSource(p('Eggo/eggo.glb'), 'eggo.glb'), w = await loadConfiguredSource(p('wookada/wookada.glb'), 'wookada.glb'), co = await loadConfiguredSource(p('mosh/Cogumelo.glb'), 'Cogumelo.glb');

for (const [name, src, other] of [['Eggo', eg, co], ['Wookada', w, co], ['Cogumelo', co, w]]) {
  const fresh = (cfg = shortTackle) => makeMatch({cfg, sources: [src, other]});
  const tackleCmd = () => cmd({tackle: true, move: vec(0, 1), ...lock});
  const intoEpilogue = m => {
    m.run(10);m.step(tackleCmd());
    let guard = 0;while (!m.chars[0].epilogue && guard++ < 160) m.step();
    assert.ok(m.chars[0].epilogue && !m.g.fighters[0].action, `${name}: epílogo ativo`);
    return m.chars[0].current.entry;
  };
  const of = (m, type, ex) => m.chars[0].animEvents.filter(e => e.type === type && (ex === undefined || e.executionId === ex));

  // ---- 1. conclusão natural: enter → epilogue-start → epilogue-end → exit, cada um uma vez, ids únicos ----
  {
    const m = fresh(), ch = m.chars[0], seen = [];ch.onAnimEvent = e => seen.push(e);
    const E = intoEpilogue(m);
    let guard = 0;while (ch.current?.entry === E && guard++ < 600) m.step();
    const mine = ch.animEvents.filter(e => e.executionId === E).map(e => e.type);
    assert.deepEqual(mine, ['state-enter', 'epilogue-start', 'epilogue-end', 'state-exit'], `${name}: ciclo da execução ${E}: ${mine}`);
    assert.equal(new Set(ch.animEvents.map(e => e.eventId)).size, ch.animEvents.length, `${name}: eventId único`);
    assert.deepEqual(seen.map(e => e.eventId), ch.animEvents.map(e => e.eventId), `${name}: o ouvinte recebeu os mesmos eventos, na mesma ordem`);
    assert.ok(ch.animEvents.every(e => TYPES.includes(e.type) && e.eventId.startsWith(`${e.executionId}@`) && e.eventId.endsWith(`#${e.type}`)), `${name}: tipos e ids bem formados`);
    assert.equal(of(m, 'epilogue-end', E)[0].reasonCode, 'epilogue-end-natural');
    ok(`${name}: conclusão natural de ${E}: enter → epilogue-start → epilogue-end → exit (uma vez cada)`);
  }

  // ---- 2. interrupção por locomoção ----
  {
    const m = fresh(), ch = m.chars[0];
    const E = intoEpilogue(m);
    let guard = 0;while (ch.current?.entry === E && guard++ < 400) m.step(cmd({move: vec(1, 0)}));
    assert.equal(of(m, 'epilogue-end', E).length, 0, `${name}: sem conclusão natural quando andar corta`);
    const it = of(m, 'epilogue-interrupted', E);
    assert.equal(it.length, 1);assert.equal(it[0].cause ?? it[0].reasonCode, 'locomotion-cancel');
    ok(`${name}: andar cortou ${E} → epilogue-interrupted (locomotion-cancel)`);
  }

  // ---- 3. interrupção por ação nova aceita ----
  {
    const m = fresh(), ch = m.chars[0];
    const E = intoEpilogue(m);
    let guard = 0;while (ch.current?.entry === E && guard++ < 60) m.step(cmd({dodge: true, move: vec(1, 0)}));
    const it = of(m, 'epilogue-interrupted', E);
    assert.equal(it.length, 1, `${name}: a esquiva aceita interrompeu a conclusão`);
    assert.notEqual(it[0].reasonCode, 'locomotion-cancel');
    assert.equal(of(m, 'epilogue-end', E).length, 0);
    ok(`${name}: ação nova aceita cortou ${E} → epilogue-interrupted (${it[0].reasonCode})`);
  }

  // ---- 4. comando recusado/bufferizado não gera evento ----
  {
    const m = fresh(), ch = m.chars[0];
    const E = intoEpilogue(m), f = m.g.fighters[0];
    f.stamina = 0;f.regenBase = 0;f.exhausted = true;f.inputBuffer = null;
    const before = ch.animEvents.length;
    m.step(cmd({tackle: true, ...lock}));
    assert.equal(ch.animEvents.length, before, `${name}: nenhum evento visual por um comando não aceito`);
    assert.ok(ch.epilogue && ch.current.entry === E);
    ok(`${name}: comando não aceito não gerou evento`);
  }

  // ---- 5. prévia isolada ----
  {
    const m = fresh(), ch = m.chars[0], seen = [];ch.onAnimEvent = e => seen.push(e);
    m.run(10);
    const before = ch.animEvents?.length ?? 0;
    assert.ok(ch.startPreview(0), `${name}: prévia iniciada`);
    m.run(20);ch.stopPreview();
    assert.equal(ch.animEvents.length, before, `${name}: a prévia não gerou evento (${ch.animEvents.slice(before).map(e => e.type)})`);
    assert.ok(!seen.some(e => /preview/.test(String(e.state))), `${name}: o ouvinte não viu estado de prévia`);
    m.run(10);
    ok(`${name}: prévia do Editor isolada (nenhum evento visual durante a prévia)`);
  }

  // ---- 6. recorte e reverso concluem com um único epilogue-end ----
  for (const [label, fields] of [['Fim do recorte 80 %', {trimEnd: 80}], ['Reverso', {reverse: true}], ['recorte + reverso', {trimEnd: 80, reverse: true}]]) {
    const m = fresh(), ch = m.chars[0];
    for (const [k, v] of Object.entries(fields)) ch.animProfile = setField(ch.animProfile, 'tackle', k, v);
    const E = intoEpilogue(m);
    let guard = 0;while (ch.current?.entry === E && guard++ < 1200) m.step();
    assert.equal(of(m, 'epilogue-end', E).length, 1, `${name} · ${label}: um único epilogue-end`);
    assert.equal(of(m, 'epilogue-interrupted', E).length, 0);
    ok(`${name} · ${label}: um único epilogue-end`);
  }

  // ---- 7. save/load no meio do epílogo: não repete enter/start e conclui uma vez ----
  {
    const m1 = fresh(), ch1 = m1.chars[0];
    const E = intoEpilogue(m1);
    m1.run(3);
    const snap = m1.g.save();
    let guard = 0;while (ch1.current?.entry === E && guard++ < 600) m1.step();
    const endTick1 = of(m1, 'epilogue-end', E)[0]?.tick;
    const m2 = fresh(), ch2 = m2.chars[0];
    m2.run(10);
    const before = ch2.animEvents.length;
    m2.g.load(snap);
    guard = 0;while (!of(m2, 'epilogue-end', E).length && guard++ < 600) m2.step();
    const after = ch2.animEvents.slice(before);
    assert.ok(!after.some(e => e.executionId === E && (e.type === 'state-enter' || e.type === 'epilogue-start')), `${name}: o carregamento não repetiu state-enter/epilogue-start de ${E} (${after.map(e => e.type + ':' + e.executionId)})`);
    assert.equal(of(m2, 'epilogue-end', E).length, 1, `${name}: conclui uma vez depois do load`);
    assert.equal(of(m2, 'epilogue-end', E)[0].tick, endTick1, `${name}: conclui no mesmo tick (${endTick1})`);
    ok(`${name}: save/load no meio do epílogo — sem repetição, conclusão no mesmo tick (${endTick1})`);
  }

  // ---- 9. reentradas: estados sem serial próprio (neutral#0, walk#0) emitem a cada visita; ouvinte com erro não derruba nada ----
  {
    const m = fresh(), ch = m.chars[0];
    ch.onAnimEvent = () => {throw new Error('ouvinte quebrado');};
    m.run(10);
    for (let r = 0; r < 3; r++) {m.run(40, () => cmd({move: vec(1, 0)}));m.run(40, () => cmd());}
    const visits = ch.log.filter(e => e.execTo && e.reason !== 'conclusão visual').length, enters = ch.animEvents.filter(e => e.type === 'state-enter').length;
    assert.ok(enters >= 6 && enters === visits, `${name}: cada entrada do log gerou um state-enter (${enters}/${visits})`);
    assert.ok(ch.animEventErrors > 0, `${name}: o erro do ouvinte foi contido`);
    ok(`${name}: ${enters} entradas (neutral/walk repetidos) → ${enters} eventos; ouvinte com erro contido`);
  }

  // ---- 10. reinício da partida com os mesmos Characters: a nova linha do tempo emite de novo ----
  {
    const m = fresh(), ch = m.chars[0];
    const round = () => {m.run(10);m.run(30, () => cmd({move: vec(1, 0)}));m.run(30, () => cmd());};
    round();
    const first = ch.animEvents.length;
    m.g.reset({positions: [vec(0, -3), vec(0, 3)]});
    const t0 = ch.animEvents.length;
    round();
    assert.ok(ch.animEvents.length - t0 >= first - 1, `${name}: depois do reinício os eventos voltam a sair (${ch.animEvents.length - t0} novos de ${first} esperados)`);
    ch.resetVisual();
    assert.equal(ch.animEvents.length, 0, `${name}: resetVisual zera os eventos`);
    ok(`${name}: reinício da partida e resetVisual — eventos não ficam suprimidos`);
  }

  // ---- 8. replay determinístico e simulação idêntica com e sem ouvinte ----
  {
    const run = listen => {
      const m = fresh();if (listen) m.chars[0].onAnimEvent = () => {};
      m.run(10);
      for (const c of [tackleCmd(), ...Array(60).fill(0).map(() => cmd()), cmd({move: vec(1, 0)}), cmd({move: vec(1, 0)}), cmd({dodge: true, move: vec(1, 0)}), ...Array(40).fill(0).map(() => cmd())]) m.step(c);
      return {ev: sig(m.chars[0].animEvents), save: JSON.stringify(m.g.save())};
    };
    const a = run(true), b = run(true), c = run(false);
    assert.deepEqual(a.ev, b.ev, `${name}: dois replays produzem os mesmos eventos`);
    assert.ok(a.ev.length > 5, `${name}: houve eventos (${a.ev.length})`);
    assert.equal(a.save, c.save, `${name}: o save do Game é idêntico com e sem ouvinte`);
    ok(`${name}: replay determinístico (${a.ev.length} eventos) e simulação idêntica com e sem ouvinte`);
  }
}
console.log(`\n${n} verificações dos eventos visuais do Melee G2 aprovadas.`);
