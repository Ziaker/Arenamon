// Game feel 5–9: decisão de golpe no vazio, detecção de rig/limites de olhar, contrato de fases e cadeias de reserva da borda.
// Tudo é apresentação, exceto phaseMode (paridade: com 0 a simulação não muda).
import {strict as assert} from 'node:assert';
import {C, resetConfig} from '../src/sim/config.js';
import {isWhiff} from '../src/view/whiff-fx.js';
import {detectRig, splitTracking, footWeight, smoothAlpha, sideOf, legPartOf} from '../src/view/rig-layers.js';
import {validateWindows, resolvePhaseContract, resolveAllPhases} from '../src/sim/phase-contract.js';
import {windowsOn, isOffensive, isInvulnerable, createFighter} from '../src/sim/entity.js';
import {createAnimationCombatWindows, fromGlbEvents, effectiveArenaWindows} from '../src/sim/animation-combat-windows.js';
import {STATE_ACTIONS, ACTION_IDS} from '../src/view/characters.js';
import {vec} from '../src/sim/math.js';

let passed = 0;
const test = (name, fn) => {resetConfig();try {fn();console.log('✓ ' + name);passed++;} catch (e) {console.error('✗ ' + name);console.error(e);process.exit(1);} finally {resetConfig();}};

// ---- 5. golpe no vazio ----
const A = (o = {}) => ({kind: 'tackle', slam: false, hitCount: 0, elapsed: .4, duration: .4, ...o});
const F = (o = {}) => ({hp: 100, state: 'actionRecovery', ...o});
const O = (o = {}) => ({step: 1 / 120, nearestGap: 2, minDistance: .25, ...o});
test('whiff: tackle terminado sozinho, sem alvo registrado e rival longe', () => assert.equal(isWhiff(A(), F(), O()), true));
test('whiff: qualquer alvo registrado (acerto, bloqueio, parry, reflexo, invulnerável) suprime', () => assert.equal(isWhiff(A({hitCount: 1}), F(), O()), false));
test('whiff: ação cancelada antes do fim (finta/esquiva/defesa) não conta', () => assert.equal(isWhiff(A({elapsed: .1}), F(), O()), false));
test('whiff: interrompido por golpe sofrido ou derrota não conta', () => {
  for (const state of ['hitstun', 'stagger', 'pushed', 'airborne', 'guardStun', 'wallSplat']) assert.equal(isWhiff(A(), F({state}), O()), false, state);
  assert.equal(isWhiff(A(), F({hp: 0}), O()), false);
});
test('whiff: rival colado (menor que a distância mínima) suprime; meteor slam e outros tipos não contam', () => {
  assert.equal(isWhiff(A(), F(), O({nearestGap: .1})), false);
  assert.equal(isWhiff(A({slam: true}), F(), O()), false);
  assert.equal(isWhiff(A({kind: 'dodge'}), F(), O()), false);
});
test('whiff: padrões do ajuste existem e estão nas faixas do brief', () => {
  const G = C.extras.gameFeel;
  assert.ok(G.whiffTrail >= 0 && G.whiffTrail <= 2 && G.whiffDust >= 0 && G.whiffDust <= 2 && G.whiffOvershoot >= 0 && G.whiffOvershoot <= 12 && G.whiffMinDistance >= 0 && G.whiffMinDistance <= 1);
});

// ---- 7. borda ----
test('borda: cadeias de reserva preservam o comportamento anterior e acrescentam os clipes novos', () => {
  assert.deepEqual(STATE_ACTIONS.ledge_hang, ['ledge_hang', 'wall_splat', 'fall', 'idle']);
  assert.deepEqual(STATE_ACTIONS.ledge_climb, ['ledge_climb', 'jump', 'vault', 'idle']);
  assert.deepEqual(STATE_ACTIONS.ledge_grab.slice(0, 2), ['ledge_grab', 'ledge_hang']);
  assert.equal(STATE_ACTIONS.ledge_drop.at(-2), 'fall');
  assert.deepEqual(STATE_ACTIONS.ledge_blocked.slice(0, 2), ['ledge_blocked', 'ledge_hang']);
  for (const id of ['ledge_grab', 'ledge_hang', 'ledge_climb', 'ledge_drop', 'ledge_blocked']) assert.ok(ACTION_IDS.includes(id), id);
});

// ---- 8 e 9. rig ----
test('rig: Mixamo, Rigify e nomes ambíguos', () => {
  const mx = ['mixamorig:Hips', 'mixamorig:Spine', 'mixamorig:Spine1', 'mixamorig:Spine2', 'mixamorig:Neck', 'mixamorig:Head', 'mixamorig:LeftUpLeg', 'mixamorig:LeftLeg', 'mixamorig:LeftFoot', 'mixamorig:LeftToeBase', 'mixamorig:RightUpLeg', 'mixamorig:RightLeg', 'mixamorig:RightFoot', 'mixamorig:RightToeBase'];
  const d = detectRig(mx);
  assert.deepEqual(d.legs.l, {up: 'mixamorig:LeftUpLeg', low: 'mixamorig:LeftLeg', foot: 'mixamorig:LeftFoot'});
  assert.deepEqual(d.legs.r, {up: 'mixamorig:RightUpLeg', low: 'mixamorig:RightLeg', foot: 'mixamorig:RightFoot'});
  assert.equal(d.head, 'mixamorig:Head');assert.equal(d.chest, 'mixamorig:Spine2');assert.deepEqual(d.issues, []);
  const rg = detectRig(['thigh.L', 'shin.L', 'foot.L', 'toe.L', 'thigh.R', 'shin.R', 'foot.R', 'head', 'neck', 'chest', 'spine']);
  assert.equal(rg.legs.l.foot, 'foot.L');assert.equal(rg.legs.r.low, 'shin.R');
  const amb = detectRig(['LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftAnkle', 'Head']);
  assert.equal(amb.legs.l.foot, null);assert.ok(amb.issues.some(t => /ambíguo/.test(t)));
  assert.ok(detectRig(['Hips']).issues.some(t => /cabeça ausente/.test(t)));
  assert.equal(sideOf('mixamorig:LeftFoot'), 'l');assert.equal(legPartOf('mixamorig:LeftToeBase'), null);
});
test('rastreamento: cabeça e tronco respeitam limites e a divisão', () => {
  const s = splitTracking({yawErr: 3, pitchErr: 3, headYaw: 45, headPitch: 20, torsoPct: .35});
  const d = Math.PI / 180;
  assert.ok(Math.abs(s.headYaw) <= 45 * d + 1e-9, 'cabeça no limite horizontal');
  assert.ok(Math.abs(s.headPitch) <= 20 * d + 1e-9, 'cabeça no limite vertical');
  assert.ok(Math.abs(s.torsoYaw + s.headYaw) <= 100 * d + 1e-9);
  const small = splitTracking({yawErr: .2, pitchErr: -.1, headYaw: 45, headPitch: 20, torsoPct: 0});
  assert.equal(small.torsoYaw, 0);assert.ok(Math.abs(small.headYaw - .2) < 1e-9 && Math.abs(small.headPitch + .1) < 1e-9);
  assert.equal(splitTracking({yawErr: 1, pitchErr: 1, headYaw: 0, headPitch: 0, torsoPct: 0}).headYaw, 0);
});
test('pés: peso do apoio e suavização', () => {
  assert.equal(footWeight(0), 1);assert.equal(footWeight(.3), 0);assert.ok(footWeight(.12) > 0 && footWeight(.12) < 1);
  assert.equal(smoothAlpha(0, .1), 0);assert.equal(smoothAlpha(1, 0), 1);assert.ok(smoothAlpha(.05, .1) > 0 && smoothAlpha(.05, .1) < 1);
});
test('padrões do ajuste: pés e olhar desligados (nada muda sem pedido) e dentro das faixas', () => {
  const G = C.extras.gameFeel;
  assert.equal(G.footOn, 0);assert.equal(G.trackOn, 0);assert.equal(G.phaseMode, 0);
  assert.ok(G.footMaxCorrection <= .25 && G.footPelvisMax <= .15 && G.footSmooth >= .02 && G.footSmooth <= .2 && G.footPlantSpeed <= 1.5 && G.footSlope <= 100);
  assert.ok(G.trackHeadYaw <= 65 && G.trackHeadPitch <= 35 && G.trackTorso <= 70 && G.trackSmooth >= .03 && G.trackSmooth <= .3 && G.trackRelease >= .03 && G.trackRelease <= .25);
});

// ---- 6. fases ----
const contract = (o = {}) => createAnimationCombatWindows({characterId: 'x', actionId: 'tackle', clipName: 'c', clipDurationSeconds: 1, actionDurationSeconds: C.actions.tackle.duration, activeWindows: [[10, 38]], invulnerabilityWindows: [[0, 12]], cancelWindows: [[12, 48]], ...o});
const defOf = () => effectiveArenaWindows('tackle', C);
const AUTH = {active: true, cancel: true, invuln: true};
test('fases: validação de ordem, sobreposição e duração', () => {
  assert.equal(validateWindows('x', [[1, 5], [6, 9]], 48), null);
  assert.match(validateWindows('x', [[5, 5]], 48), /não vem depois/);
  assert.match(validateWindows('x', [[1, 6], [5, 9]], 48), /sobrepõem/);
  assert.match(validateWindows('x', [[1, 60]], 48), /passa da duração/);
  assert.match(validateWindows('x', [[1.5, 6]], 48), /inteiro/);
});
test('fases: contrato válido aplica só o que foi autorizado', () => {
  const r = resolvePhaseContract({actionId: 'tackle', contract: contract(), definition: defOf(), auth: {active: true, cancel: false, invuln: false}, stepSeconds: C.test.step});
  assert.deepEqual(r.applied, {active: true, cancel: false, invuln: false});
  assert.deepEqual(r.windows.activeWindows, [[10, 38]]);assert.deepEqual(r.windows.invulnerabilityWindows, []);assert.deepEqual(r.windows.cancelWindows, []);
  assert.equal(r.windows.phaseContract.cancelAfterSeconds, null);
  const all = resolvePhaseContract({actionId: 'tackle', contract: contract(), definition: defOf(), auth: AUTH, stepSeconds: C.test.step});
  assert.equal(all.windows.phaseContract.cancelAfterSeconds, +(12 * C.test.step).toFixed(4));
});
test('fases: contrato inválido recusa TUDO (sem aplicação parcial) e informa o motivo', () => {
  const bad = contract({invulnerabilityWindows: [[0, 9999]]});
  const r = resolvePhaseContract({actionId: 'tackle', contract: bad, definition: defOf(), auth: AUTH, stepSeconds: C.test.step});
  assert.equal(r.windows, null);assert.deepEqual(r.applied, {active: false, cancel: false, invuln: false});assert.ok(r.errors.some(e => /passa da duração/.test(e)));
  assert.ok(r.rows.filter(x => x.authorized).every(x => /rejeitado/.test(x.status)));
});
test('fases: cancelamento antes do primeiro compromisso é rejeitado', () => {
  const r = resolvePhaseContract({actionId: 'tackle', contract: contract({cancelWindows: [[2, 48]]}), definition: defOf(), auth: AUTH, stepSeconds: C.test.step});
  assert.equal(r.windows, null);assert.ok(r.errors.some(e => /antes do primeiro compromisso/.test(e)));
});
test('fases: sem clipe/contrato usa a definição; sem autorização não há nada a aplicar', () => {
  const none = resolvePhaseContract({actionId: 'tackle', contract: null, definition: defOf(), auth: AUTH, stepSeconds: C.test.step});
  assert.equal(none.windows, null);assert.ok(none.errors.length);
  const off = resolvePhaseContract({actionId: 'tackle', contract: contract(), definition: defOf(), auth: {active: false, cancel: false, invuln: false}, stepSeconds: C.test.step});
  assert.equal(off.windows, null);assert.deepEqual(off.errors, []);
});
test('fases: a tabela mostra definição e animação em passos e segundos', () => {
  const r = resolvePhaseContract({actionId: 'tackle', contract: contract(), definition: defOf(), auth: AUTH, stepSeconds: C.test.step});
  const act = r.rows.find(x => x.key === 'active');
  assert.deepEqual(act.animation, [10, 38]);assert.equal(act.animationSeconds[0], +(10 * C.test.step).toFixed(4));assert.equal(act.status, 'aplicado');
});
test('fases: modo Definição (padrão) não liga as janelas; modo Animação liga só as fases autorizadas', () => {
  assert.equal(windowsOn('phaseActive'), false);assert.equal(windowsOn('phaseInvuln'), false);
  C.extras.gameFeel.phaseMode = 1;
  assert.equal(windowsOn('phaseActive'), false, 'sem autorização continua igual');
  C.extras.gameFeel.phaseActive = 1;
  assert.equal(windowsOn('phaseActive'), true);assert.equal(windowsOn('phaseInvuln'), false);
  C.extras.gameFeel.phaseMode = 2;
  assert.equal(windowsOn('phaseActive'), false, 'Comparar nunca aplica');
});
test('fases: no combate, a janela ativa aprovada decide quando o tackle é ofensivo; fora do modo, não', () => {
  const f = createFighter(0, C.profiles.balanced, vec(0, 0));f.action = {kind: 'tackle', elapsed: 0, combatWindows: {activeWindows: [[10, 38]], invulnerabilityWindows: []}, hits: new Set()};
  assert.equal(isOffensive(f), true, 'definição: sempre ofensivo');
  C.extras.gameFeel.phaseMode = 1;C.extras.gameFeel.phaseActive = 1;
  assert.equal(isOffensive(f), false, 'startup: ainda não ofensivo');
  f.action.elapsed = 20 * C.test.step;assert.equal(isOffensive(f), true);
  f.action.elapsed = 40 * C.test.step;assert.equal(isOffensive(f), false, 'recuperação');
});
test('fases: resolveAllPhases devolve contrato recusado vazio (nunca parcial) e metadados para o replay', () => {
  const raw = {tackle: contract({invulnerabilityWindows: [[0, 9999]]}), dodge: null};
  const res = resolveAllPhases(raw, C, {phaseMode: 1, phaseActive: 1, phaseCancel: 0, phaseInvuln: 1});
  assert.deepEqual(res.windows.tackle.activeWindows, []);assert.equal(res.windows.tackle.phaseContract.rejected, true);assert.equal(res.windows.dodge, null);
  const ok = resolveAllPhases({tackle: contract(), dodge: null}, C, {phaseMode: 1, phaseActive: 1, phaseCancel: 0, phaseInvuln: 0});
  assert.equal(ok.windows.tackle.phaseContract.applied.active, true);
});
test('fases: marcadores cancel_start/cancel_end do clipe entram no contrato', () => {
  const c = fromGlbEvents([{type: 'cancel_start', time: .1, id: 'a'}, {type: 'cancel_end', time: .3, id: 'b'}, {type: 'hitbox_on', time: .05}, {type: 'hitbox_off', time: .2}], {clipDurationSeconds: .4, actionDurationSeconds: .4, actionId: 'tackle'});
  assert.equal(c.cancelWindows.length, 1);assert.ok(c.cancelWindows[0][1] > c.cancelWindows[0][0]);
  assert.deepEqual(fromGlbEvents([], {}).cancelWindows, []);
});

console.log(`\n${passed} verificações de game feel 5–9 aprovadas.`);
