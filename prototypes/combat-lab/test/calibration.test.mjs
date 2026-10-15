// Fase 2 (sem navegador): presets de sensação, segurança da troca A × B durante a partida, gravador de movimento
// determinístico e métricas. Usa o mesmo motor (Game.step) do laboratório.
import assert from 'node:assert/strict';
import {C, defaults, resetConfig} from '../src/sim/config.js';
import {Game} from '../src/sim/game.js';
import {emptyCommand} from '../src/sim/entity.js';
import {vec, length, sub} from '../src/sim/math.js';
import {accelerationLimit} from '../src/sim/locomotion.js';
import {locomotionParams} from '../src/sim/controller.js';
import {BUILTIN_PRESETS, FEEL_CATEGORIES, categoryOf, presetValues, applyPlan, switchClass, migrateLegacyPreset, safeBoundary} from '../src/sim/presets.js';
import {ABSwitch, NEVER_SWITCHED} from '../src/sim/ab-switch.js';
import {standardSequence, runSequence, parseSequence, serializeSequence, samplesCsv, comparability} from '../src/sim/movement.js';

let n = 0;const ok = l => {n++;console.log('✓', l);};
const get = p => p.split('.').reduce((o, k) => o?.[k], C);
const set = (p, v) => {const k = p.split('.'), last = k.pop(), o = k.reduce((a, x) => a[x], C);o[last] = v;};
const flat = (o, pre = '', out = {}) => {for (const [k, v] of Object.entries(o)) {const p = pre ? `${pre}.${k}` : k;if (typeof v === 'number') out[p] = v;else if (v && typeof v === 'object' && !Array.isArray(v)) flat(v, p, out);}return out;};
const allPaths = () => flat(Object.fromEntries(['rules', 'test', 'locomotion', 'camera', 'profiles', 'extras', 'actions', 'vfx', 'display'].map(k => [k, C[k]])));
const known = new Set(Object.keys(allPaths()));

// ---------- Presets ----------
for (const p of BUILTIN_PRESETS) {
  const vals = presetValues(p, known);
  assert.ok(Object.keys(vals).length >= 30, p.name);
  assert.ok(Object.keys(vals).every(k => FEEL_CATEGORIES.includes(categoryOf(k))), `${p.name}: só categorias de sensação`);
  assert.ok(!Object.keys(vals).some(k => k.startsWith('vfx.') || k.startsWith('camera') || k.startsWith('display.hud') || k.startsWith('rules.')), `${p.name}: nunca VFX/HUD/câmera/regras`);
  assert.ok(Object.keys(vals).every(k => known.has(k)), `${p.name}: só caminhos existentes`);
  assert.ok(p.version && p.description && p.createdAt && p.name, 'nome, versão, descrição e data');
}
assert.deepEqual(new Set(BUILTIN_PRESETS.map(p => p.name)), new Set(['Storm-like', 'Etapa A', 'Pesado']));
ok('presets iniciais Storm-like, Etapa A e Pesado: versão, descrição, data e só categorias de sensação');
{
  const cur = allPaths(), plan = applyPlan(BUILTIN_PRESETS[0], cur, known);
  assert.ok(plan.length > 0 && plan.every(c => FEEL_CATEGORIES.includes(c.category)));
  const partial = {scope: 'partial', categories: ['locomotion'], values: {'locomotion.acceleration': 99, 'vfx.hit.size': 3, 'camera.distance': 9}};
  assert.deepEqual(Object.keys(presetValues(partial, known)), ['locomotion.acceleration'], 'preset de locomoção não muda VFX nem câmera, mesmo que traga esses valores');
  const legacy = migrateLegacyPreset({name: 'Antigo', savedAt: 1760000000000, values: {'rules.recoil': .4}});
  assert.equal(legacy.scope, 'full');assert.equal(legacy.version, 1);assert.equal(legacy.migratedFrom, 'v7');assert.ok(legacy.id.startsWith('user:'));
}
ok('aplicação mostra o plano (caminho, de, para, categoria); presets por categoria filtram; presets antigos migram');

// ---------- Gravador de movimento ----------
const seq = standardSequence();
{
  const a = runSequence(seq), b = runSequence(seq);
  assert.equal(a.finalState, b.finalState);assert.deepEqual(a.samples, b.samples);assert.deepEqual(a.markers, b.markers);
  const types = new Set(a.markers.map(m => m.type));
  for (const t of ['reverse', 'zero', 'dodgeStart', 'dodgeEnd', 'sprintStart', 'sprintEnd', 'tackleStart', 'tackleEnd']) assert.ok(types.has(t), 'marcador ' + t);
  const m = a.metrics;for (const k of ['timeToWalkSpeed', 'brakingTime', 'reversalToZero', 'reversalToSpeed', 'dodgeDistance', 'tackleDistance', 'tackleDuration']) assert.ok(m[k] > 0, k);
  assert.ok(Math.abs(m.tackleDistance - 4.8) < .1, `tackle preserva a distância nominal (${m.tackleDistance})`);
  // Mesmos comandos, outra semente da IA: adversário parado, então nada muda (a semente só afeta a IA).
  assert.equal(runSequence({...seq, seed: 99}).finalState, a.finalState);
}
ok('sequência padrão determinística (mesmas amostras e marcadores) com inversão, v=0, C, sprint, X e frenagem medidos');
{
  const vals = presetValues(BUILTIN_PRESETS.find(p => p.name === 'Pesado'), known), before = JSON.stringify(allPaths());
  const heavy = runSequence(seq, {values: vals}).metrics, lab = runSequence(seq).metrics;
  assert.equal(JSON.stringify(allPaths()), before, 'a configuração volta exatamente ao estado anterior');
  assert.ok(heavy.timeToWalkSpeed > lab.timeToWalkSpeed && heavy.reversalToSpeed > lab.reversalToSpeed && heavy.brakingTime > lab.brakingTime, 'Pesado: mais inércia');
  const storm = runSequence(seq, {values: presetValues(BUILTIN_PRESETS[0], known)}).metrics;
  assert.ok(storm.timeToWalkSpeed < lab.timeToWalkSpeed && storm.reversalToSpeed < lab.reversalToSpeed, 'Storm-like: resposta mais rápida');
  console.log('   métricas (lab · Storm · Etapa A · Pesado):', ['timeToWalkSpeed', 'reversalToZero', 'reversalToSpeed', 'brakingTime', 'brakingDistance', 'maxSprintSpeed'].map(k => `${k} ${lab[k]} · ${storm[k]} · ${runSequence(seq, {values: presetValues(BUILTIN_PRESETS[1], known)}).metrics[k]} · ${heavy[k]}`).join(' | '));
}
ok('comparação reproduzível: mesma sequência com presets diferentes muda só a sensação, e a config é restaurada');
{
  const back = parseSequence(JSON.stringify(serializeSequence(seq)));assert.deepEqual(back.seq.commands, seq.commands);
  assert.match(parseSequence('{"schema":"x"}').error, /Não é uma sequência/);
  assert.ok(comparability(seq, {'test.step': 1 / 60}, {}).length === 1, 'passo diferente: resultados não comparáveis');
  const csv = samplesCsv([{name: 'A', result: runSequence(seq)}]);assert.equal(csv.split('\n').length, seq.ticks + 1);assert.match(csv.split('\n')[0], /A:speed/);
}
ok('sequência exporta/importa (comprimida), CSV por passo e aviso de condições não comparáveis');
{
  // Gravação a partir de um estado salvo de partida (como no laboratório): mesmo resultado em reexecuções.
  const g = new Game();g.mode = 'combat';g.reset();for (let i = 0; i < 90; i++) g.step({...emptyCommand(), move: vec(1, 0)});
  const rec = {schema: 'arenamon-movement-sequence', version: 1, id: 'r', label: 'r', step: C.test.step, seed: 3, profile: 'balanced', enemyProfile: 'balanced', initial: g.save(), enemy: 'recorded', commands: [], commands1: [], ticks: 0};
  for (let i = 0; i < 240; i++) {const c = {...emptyCommand(), move: vec(i < 120 ? 1 : -1, 0), tackle: i === 150};g.step(c);rec.commands.push(c);rec.commands1.push(g.lastCommands[1]);}
  rec.ticks = 240;
  const r1 = runSequence(rec), r2 = runSequence(rec);assert.equal(r1.finalState, r2.finalState);
  assert.equal(r1.finalState, JSON.stringify(g.fighters), 'reexecução do estado gravado reproduz a partida original');
}
ok('gravação a partir de uma partida em andamento: reexecução reproduz exatamente a partida (mesmos comandos dos dois lados)');

// ---------- A × B durante a partida ----------
const heavy = presetValues(BUILTIN_PRESETS.find(p => p.name === 'Pesado'), known), storm = presetValues(BUILTIN_PRESETS[0], known);
function scenario({toggleAt, tackleAt = null, length: ticks = 360, sides = {A: {name: 'Storm', values: storm}, B: {name: 'Pesado', values: heavy}}} = {}) {
  resetConfig(defaults());
  const g = new Game();g.mode = 'inactive';g.reset({positions: [vec(-6, 0), vec(8, 10)]});
  const ab = new ABSwitch({get, setTransient: pairs => {for (const [p, v] of pairs) set(p, v);}});
  const trace = [];ab.start(sides, {game: g, tick: 0});
  for (let t = 0; t < ticks; t++) {
    if (toggleAt?.includes(t)) ab.toggle(g, g.tick);
    ab.beforeStep(g);
    const before = {pos: {...g.fighters[0].position}, vel: {...g.fighters[0].velocity}, stamina: g.fighters[0].stamina, action: g.fighters[0].action?.kind ?? null, elapsed: g.fighters[0].action?.elapsed ?? null};
    g.step({...emptyCommand(), move: vec(t < 200 ? 1 : -1, 0), tackle: t === tackleAt});
    const f = g.fighters[0];
    trace.push({t, pos: {...f.position}, vel: {...f.velocity}, dpos: length(sub(f.position, before.pos)), dv: length(sub(f.velocity, before.vel)), stamina: f.stamina, action: f.action?.kind ?? null, P: locomotionParams(f), vmax: f.attributes.speed * (f.sprinting ? C.actions.sprint.speedMultiplier : 1), prep: C.actions.tackle.prepTime, pending: ab.pending.length});
  }
  return {g, ab, trace};
}
{
  // Troca durante a locomoção (aceleração, inversão): continuidade de posição e velocidade.
  const {trace, ab} = scenario({toggleAt: [40, 80, 205, 230]});
  for (const s of trace) {
    assert.ok(s.dpos <= s.vmax * C.test.step * 1.0001 + 1e-9, `sem teletransporte no passo ${s.t} (${s.dpos})`);
    // |Δv| por passo dentro do limite do controlador com os parâmetros em vigor naquele passo (A ou B).
    assert.ok(s.dv <= accelerationLimit(s.P, s.vmax) * C.test.step * 1.0001 + 1e-9, `velocidade contínua no passo ${s.t}: ${s.dv} > ${accelerationLimit(s.P, s.vmax) * C.test.step}`);
  }
  // Cada troca na locomoção vale no próximo passo: nenhum parâmetro adiado (não há ação em curso).
  assert.ok(ab.log.every(e => e.deferred === 0 && e.appliedTick === e.tick), JSON.stringify(ab.log));
  // A trajetória antes da primeira troca é idêntica à de quem nunca troca (sem mudança retroativa).
  const ref = scenario({toggleAt: []}).trace;
  for (let i = 0; i < 40; i++) assert.deepEqual(trace[i].pos, ref[i].pos);
}
ok('troca A × B durante a locomoção: aplicada no passo seguinte, sem teletransporte, velocidade contínua, sem mudança retroativa');
{
  // Troca no meio do tackle: os parâmetros da ação (curva de X) ficam adiados até o fim da ação.
  const tackleAt = 100, toggle = tackleAt + 12;
  const {trace, ab} = scenario({toggleAt: [toggle], tackleAt}), ref = scenario({toggleAt: [], tackleAt}).trace;
  const end = trace.findIndex((s, i) => i > tackleAt && !s.action);
  assert.ok(trace[toggle].pending > 0, 'parâmetros da ação adiados');
  assert.equal(trace[toggle].prep, storm['actions.tackle.prepTime'], 'curva de X não muda no meio do tackle');
  for (let i = tackleAt; i < end; i++) assert.deepEqual(trace[i].pos, ref[i].pos, `trajetória do tackle idêntica (passo ${i})`);
  assert.equal(trace[end + 1].prep, heavy['actions.tackle.prepTime'], 'aplicados no primeiro passo seguro depois da ação');
  assert.ok(ab.log.at(-1).appliedTick > toggle);
  // Stamina: idêntica à da execução sem troca durante todo o tackle (a troca nunca escreve stamina).
  for (let i = 0; i < end; i++) assert.equal(trace[i].stamina, ref[i].stamina);
}
ok('troca A × B no meio do tackle: curva/duração de X adiadas até o fim da ação, trajetória e stamina intactas');
{
  // Só os caminhos de A ou B mudam; passo da simulação e teclas nunca são trocados.
  resetConfig(defaults());const before = allPaths();
  const ab = new ABSwitch({get, setTransient: pairs => {for (const [p, v] of pairs) set(p, v);}});
  const info = ab.start({A: {name: 'A', values: {'locomotion.acceleration': 50, 'test.step': 1 / 60, 'extras.bindings.tackle': 11}}, B: {name: 'B', values: {'vfx.hit.size': 2}}});
  assert.deepEqual(info.excluded.sort(), ['extras.bindings.tackle', 'test.step']);
  const after = allPaths(), changed = Object.keys(after).filter(p => after[p] !== before[p]);
  assert.deepEqual(changed, ['locomotion.acceleration'], 'em A, só a aceleração (vfx.hit.size continua no valor de antes, que é o de A)');
  ab.toggle(null, 0);const afterB = allPaths(), changedB = Object.keys(afterB).filter(p => afterB[p] !== before[p]);
  assert.deepEqual(changedB, ['vfx.hit.size'], 'em B, a aceleração volta ao valor anterior e só o VFX muda');
  const restore = ab.stop('baseline');for (const [p, v] of restore) set(p, v);
  assert.deepEqual(allPaths(), before, 'encerrar voltando ao estado anterior restaura tudo');
  assert.equal(switchClass('test.step'), 'restart');assert.equal(switchClass('profiles.agile.hp'), 'restart');assert.equal(switchClass('locomotion.braking'), 'live');assert.equal(switchClass('actions.tackle.duration'), 'boundary');
  assert.ok(NEVER_SWITCHED('extras.bindings2.dodge'));
}
ok('A × B altera só os parâmetros dos presets; passo, arena, vida/stamina máximas e teclas nunca trocam; encerrar restaura');
{
  const g = new Game();g.reset();assert.ok(safeBoundary(g));g.step({...emptyCommand(), tackle: true, move: vec(0, 1)});assert.ok(!safeBoundary(g), 'em ação: não seguro');
  g.fighters[0].action = null;g.fighters[0].stun = .1;assert.ok(!safeBoundary(g), 'em guard stun: não seguro');g.fighters[0].stun = 0;g.hitstop = .02;assert.ok(!safeBoundary(g), 'em hitstop: não seguro');
}
ok('limite seguro: nenhuma ação, stun, voo, recuperação, empurrão, buffer ou hitstop');
resetConfig(defaults());
console.log(`\n${n} verificações da calibração aprovadas.`);
