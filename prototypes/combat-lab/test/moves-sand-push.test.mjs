// @ts-check
// Sand Wave — política do empurrão POR ALVO: no modo oficial, do primeiro contato até o fim da barragem
// (`active + dissipate`), com tolerância de contato, continuidade em stagger, preservação de velocidade, limite de
// velocidade, modos de aceleração, disputa entre ondas e motivos de interrupção. Cada bloco é um A/B individual usado
// como evidência do DOC03; os modos 1/2/3 ficam disponíveis para experimentação.
// Uso: node prototypes/combat-lab/test/moves-sand-push.test.mjs
import {assert, C, resetConfig, Game, emptyCommand, vec, suite} from './moves-new-helpers.mjs';
import {defaults} from '../src/sim/config.js';
import {stepSand} from '../src/sim/sand.js';
import {applySandPushStep, pushAccelNow, pushWindowState} from '../src/sim/moves/sand-wave/sand-push.js';
import {spawn, stepWorld} from '../src/sim/world.js';
import {updateFighter} from '../src/sim/controller.js';
import {getCalculatedValuesForMove} from '../src/sim/moves/move-mechanics-audit.js';
import {registerStandardMoves} from '../src/sim/moves/standard.js';

registerStandardMoves();

const {test, done} = suite('SAND PUSH — POLÍTICA POR ALVO');
const DT = 1 / 120;
const cmd = (/** @type {Record<string, any>} */ o = {}) => ({...emptyCommand(), ...o});

/** Arena limpa com os PADRÕES APROVADOS (não os de fábrica) e sem IA. */
function docArena() {
  resetConfig(defaults());
  const g = new Game({seed: 3});g.start();
  g.mapState.platforms = [];g.mapState.obstacles = [];g.mapState.destructibles = [];g.mapState.items = [];g.mapState.regularSpawnTimer = 1e9;
  g.reset({positions: [vec(0, -4), vec(0, 1)]});
  g.fighters[0].facing = 0;g.fighters[1].facing = Math.PI;
  return g;
}
/** Barragem mínima para exercitar o consumidor real (stepSand) sem depender do cast. */
function sandEntity(overrides = {}) {
  return {
    id: 999, kind: 'sandwave', owner: 0, pos: {x: 0, z: -4}, dir: {x: 0, z: 1}, length: 4, width: 3,
    active: .75, life: 1.5, speed: 4 / .75, speed0: 4 / .75, waveAccel: 0, damage: 0, knockbackH: 0,
    knockbackV: 0, accel: 0, pushSpeed: 0, pushDuration: 0, pushClearsLocomotion: 1,
    pushCancelsDodge: 1, pushCancelsExistingDodge: 1, partialFactor: .5, blind: 4, blindOnPartial: 1, hitsAirborne: 0,
    wallStagger: .3, wallStaggerOn: 1, cell: .25, detour: 3, replanSteps: 6, y: 0, height: .35,
    wallPressMinSpeed: .6, wallPressMoveRatio: .25, waveBottomTolerance: .2, maxTargets: 16,
    pushDurationMode: 0, pushContinueAfterActive: 0, pushContinuesOutsideArea: 0, pushReleaseDelay: 0,
    pushContinuesDuringStagger: 1, pushPreserveVelocity: 0, pushMaxSpeed: 0,
    pushAccelerationMode: 0, pushCurvePower: 1, pushTargetSpeed: 0, pushRampTime: .2,
    age: 0, targets: {}, pushed: [], ...overrides,
  };
}
function stepAt(/** @type {any} */ g, /** @type {any} */ e, /** @type {number} */ age, /** @type {any[]} */ events = []) {
  e.age = age;stepSand(g, e, DT, events);return e;
}
/** Alvo na frente da onda a `d` metros da origem (0,-4). */
function targetAt(/** @type {any} */ g, /** @type {number} */ d) {
  const f = g.fighters[1];f.position = vec(0, -4 + d);return f;
}
/** Roda a barragem em passos de 1/120 s e devolve os instantes em que o empurrão esteve ativo. */
function sweep(/** @type {any} */ g, /** @type {any} */ e, /** @type {number} */ from, /** @type {number} */ to) {
  const on = [];
  for (let t = from; t <= to + 1e-9; t += DT) {
    stepAt(g, e, t);
    if (g.fighters[1].sandPush?.by === e.id) on.push(t);
  }
  return {first: on[0] ?? null, last: on.at(-1) ?? null, ticks: on.length, duration: on.length * DT};
}

test('duração por alvo independente: fim da barragem encolhe com a distância e modo 1 fixa 0,40 s', () => {
  const barrage = [], independent = [];
  for (const d of [1, 2, 3, 4]) {
    const g1 = docArena();targetAt(g1, d);
    const e1 = sandEntity({accel: 12, pushDuration: 0});
    g1.world.entities.push(e1);
    const r1 = sweep(g1, e1, .01, 1.6);
    barrage.push(r1.duration);

    const g2 = docArena();targetAt(g2, d);
    const e2 = sandEntity({accel: 12, pushDuration: .4, pushDurationMode: 1, pushContinueAfterActive: 1});
    g2.world.entities.push(e2);
    const r2 = sweep(g2, e2, .01, 1.6);
    independent.push(r2.duration);
  }
  // Modo oficial: o fim da barragem é fixo em 1,5 s, mas o alvo distante só é alcançado perto de `active` e recebe
  // menos tempo de força. A distância não encurta a barragem: encurta o tempo restante até o fim dela.
  assert.ok(barrage[3] < barrage[0] - .2, `fim da barragem encurta o empurrão com a distância (${barrage.map(v => v.toFixed(2)).join(' / ')} s)`);
  // Modo 1: a duração é do ALVO, não da janela nem da dissipação.
  for (const [i, d] of [1, 2, 3, 4].entries()) assert.ok(Math.abs(independent[i] - .4) <= DT + 1e-9, `modo 1 mantém ~0,40 s a ${d} m (${independent[i].toFixed(3)} s)`);
});

test('modo oficial: active não encerra; a barragem encerra em 1,5 s', () => {
  const at = (/** @type {number} */ age, /** @type {Record<string, number>} */ cfg = {}) => {
    const g = docArena();const f = targetAt(g, 1);
    const e = sandEntity({accel: 12, ...cfg});
    g.world.entities.push(e);
    stepAt(g, e, .2);
    stepAt(g, e, age);
    return {on: !!f.sandPush, reason: e.targets[f.id]?.reason ?? null, life: e.life};
  };
  // O alvo fica parado dentro do retângulo: a única coisa que muda é o tempo.
  const afterActive = at(1.0);
  assert.equal(afterActive.on, true, 'depois de active (0,75 s) o empurrão continua');
  assert.equal(afterActive.reason, null, 'sem motivo de interrupção enquanto a barragem existe');
  const end = at(1.5);
  assert.equal(end.on, false, 'no fim da barragem (1,5 s) o empurrão encerra');
  assert.equal(end.reason, 'barrageEnded', 'motivo registrado: barrageEnded');
  assert.equal(end.life, 1.5, 'a vida da onda não é estendida no modo oficial');

  // Modo legado 3: reproduz a política antiga para comparação no Editor.
  const legacyOff = at(.8, {pushDurationMode: 3, pushContinueAfterActive: 0});
  assert.equal(legacyOff.on, false, 'modo legado sem continuidade encerra em active');
  assert.equal(legacyOff.reason, 'activeWindowEnded', 'motivo legado: activeWindowEnded');
  const legacyOn = at(1.6, {pushDurationMode: 3, pushContinueAfterActive: 1});
  assert.equal(legacyOn.on, true, 'modo legado com continuidade segue depois de active');
  assert.ok(legacyOn.life > 1.5, `vida estendida no modo experimental (${legacyOn.life.toFixed(2)} s)`);
});

test('limite opcional e saída do retângulo encerram o modo oficial', () => {
  const capped = (() => {
    const g = docArena();const f = targetAt(g, 1);
    const e = sandEntity({accel: 12, pushDuration: .5});
    g.world.entities.push(e);stepAt(g, e, .2);stepAt(g, e, .8);
    return {on: !!f.sandPush, reason: e.targets[f.id]?.reason ?? null};
  })();
  assert.equal(capped.on, false, 'um limite menor que a barragem antecipa o fim');
  assert.equal(capped.reason, 'durationElapsed', 'motivo registrado: durationElapsed');

  const outside = (() => {
    const g = docArena();const f = targetAt(g, 1);
    const e = sandEntity({accel: 12});
    g.world.entities.push(e);stepAt(g, e, .2);stepAt(g, e, .5);
    f.position = vec(0, 6);
    stepAt(g, e, .51);
    return {on: !!f.sandPush, reason: e.targets[f.id]?.reason ?? null};
  })();
  assert.equal(outside.on, false, 'sair do retângulo encerra a força no modo oficial');
  assert.equal(outside.reason, 'leftArea', 'motivo registrado: leftArea');
});

test('parede: stagger não desliga o empurrão oficial e a colisão impede a passagem', () => {
  const g = docArena();
  const f = g.fighters[1];
  f.position = vec(0, -.8);   // 3,2 m da origem, dentro do retângulo (4 m)
  spawn(g.world, {kind: 'wall', pos: vec(0, 0), hx: 3, hz: .2, height: 3, life: Infinity, blocksFighters: true, blocksProjectiles: true}, []);
  const e = sandEntity({accel: 12, damage: 0});
  g.world.entities.push(e);
  let maxOn = 0, sawWall = false;
  for (let i = 0; i < 200; i++) {
    g.step(emptyCommand(), emptyCommand());
    if (f.sandPush?.by === e.id) maxOn = e.age;
    if ((f.knockRecovery ?? 0) > 0) sawWall = true;
  }
  assert.ok(sawWall, 'o alvo entrou em stagger de parede');
  assert.ok(maxOn >= 1.45, `a força continua até perto do fim da barragem (${maxOn.toFixed(3)} s)`);
  assert.equal(e.targets[f.id]?.reason, 'barrageEnded', 'motivo final: barrageEnded, não wallStagger');
  assert.ok(f.position.z < -.4, `a parede impede a passagem (z = ${f.position.z.toFixed(2)})`);
});

test('velocidade adquirida sobrevive ao fim do empurrão e desacelera pelo motor', () => {
  const g = docArena();
  const f = targetAt(g, 1);
  const e = sandEntity({accel: 12});
  g.world.entities.push(e);
  let had = false, endSpeed = 0;
  for (let i = 0; i < 200; i++) {
    g.step(emptyCommand(), emptyCommand());
    if (f.sandPush?.by === e.id) had = true;
    else if (had) {endSpeed = Math.hypot(f.locomotionVelocity.x, f.locomotionVelocity.z);break;}
  }
  assert.ok(endSpeed > 1, `o alvo sai do retângulo já em movimento (${endSpeed.toFixed(2)} m/s)`);
  g.step(emptyCommand(), emptyCommand());
  const after = Math.hypot(f.locomotionVelocity.x, f.locomotionVelocity.z);
  assert.ok(after > 0 && after < endSpeed, `a velocidade é preservada e desacelera (${endSpeed.toFixed(2)} → ${after.toFixed(2)} m/s)`);
  assert.ok(after > endSpeed * .3, 'o fim do empurrão não zera a velocidade de uma vez');
});

test('permanência na área não repete dano nem renova a cegueira', () => {
  const g = docArena();
  const f = targetAt(g, 1);
  const e = sandEntity({accel: 12, damage: 6});
  const events = [];
  g.world.entities.push(e);
  stepAt(g, e, .2, events);
  const hp = f.hp;
  const blinds = events.filter(ev => ev.result === 'blinded').length;
  for (let t = .21; t <= 1.4; t += DT) stepAt(g, e, t, events);
  assert.equal(f.hp, hp, 'o HP não muda depois do primeiro acerto');
  assert.equal(blinds, 1, 'o primeiro contato aplicou exatamente uma cegueira');
  assert.equal(events.filter(ev => ev.result === 'blinded').length, 1, 'permanecer dentro não renova a cegueira');
});

test('fora do retângulo + tolerância de perda de contato', () => {
  const run = (/** @type {number} */ outside, /** @type {number} */ delay) => {
    const g = docArena();const f = targetAt(g, 1);
    const e = sandEntity({accel: 12, pushDuration: 1, pushDurationMode: 1, pushContinueAfterActive: 1, pushContinuesOutsideArea: outside, pushReleaseDelay: delay});
    g.world.entities.push(e);
    stepAt(g, e, .3);
    f.position = vec(0, 6);   // fora do retângulo (u = 10 > length 4)
    stepAt(g, e, .4);
    const grace = !!f.sandPush;
    stepAt(g, e, .55);
    return {grace, after: !!f.sandPush, reason: e.targets[f.id]?.reason ?? null};
  };
  const strict = run(0, 0);
  assert.equal(strict.grace, false, 'sem tolerância, sair do retângulo remove o empurrão');
  assert.equal(strict.reason, 'leftArea', 'motivo registrado: leftArea');
  assert.equal(run(0, .2).grace, true, 'tolerância de 0,20 s mantém a força durante a perda momentânea');
  assert.equal(run(0, .2).after, false, 'passada a tolerância, a força encerra');
  assert.equal(run(1, 0).after, true, 'continuar fora do retângulo ignora a saída');
});

test('preserva velocidade própria no primeiro contato', () => {
  const value = (/** @type {number} */ clears, /** @type {number} */ preserve, /** @type {number} */ impulse = 0) => {
    const g = docArena();const f = targetAt(g, 1);f.locomotionVelocity = {x: 0, z: 5};
    const e = sandEntity({accel: 0, pushSpeed: impulse, pushClearsLocomotion: clears, pushPreserveVelocity: preserve});
    g.world.entities.push(e);stepAt(g, e, .2);
    return f.locomotionVelocity.z;
  };
  assert.equal(value(1, 0), 0, 'preservar 0 zera a velocidade própria');
  assert.equal(value(1, .4), 2, 'preservar 0,4 mantém 2 m/s de 5');
  assert.equal(value(0, .4), 5, 'com «zerar movimento» desligado, conserva 100%');
  assert.equal(value(1, .5, 2), 4.5, 'o impulso soma à fração preservada');
});

test('limite de velocidade do empurrão', () => {
  const impulse = (() => {
    const g = docArena();const f = targetAt(g, 1);
    const e = sandEntity({accel: 0, pushSpeed: 20, pushMaxSpeed: 8});
    g.world.entities.push(e);stepAt(g, e, .2);
    return f.locomotionVelocity.z;
  })();
  assert.equal(impulse, 8, 'o impulso inicial respeita pushMaxSpeed');
  const g = docArena();const f = targetAt(g, 1);
  const e = sandEntity({accel: 12, pushMaxSpeed: 5, pushDuration: 1, pushDurationMode: 1, pushContinueAfterActive: 1, wallStaggerOn: 0});
  g.world.entities.push(e);
  let peak = 0;
  for (let t = .2; t < .8; t += DT) {stepAt(g, e, t);applySandPushStep(f, DT);peak = Math.max(peak, f.locomotionVelocity.z);}
  assert.ok(peak <= 5 + 1e-9 && peak > 4.9, `a aceleração contínua para no limite (${peak.toFixed(3)} m/s)`);
});

test('modos de aceleração: constante, curva temporal e velocidade-alvo', () => {
  const accelAt = (/** @type {number} */ mode, /** @type {number} */ age, /** @type {Record<string, number>} */ extra = {}) => {
    const g = docArena();const f = targetAt(g, 1);
    const e = sandEntity({accel: 12, pushDuration: 1, pushDurationMode: 1, pushContinueAfterActive: 1, pushAccelerationMode: mode, ...extra});
    g.world.entities.push(e);stepAt(g, e, age);
    return f.sandPush?.accel ?? 0;
  };
  assert.equal(accelAt(0, .7), 12, 'modo constante mantém 12 m/s²');
  const curveE = sandEntity({accel: 12, pushDuration: 1, pushDurationMode: 1, pushContinueAfterActive: 1, pushAccelerationMode: 1, pushCurvePower: 2});
  const curveT = {firstAt: 1.0};
  const curveF = {locomotionVelocity: {x: 0, z: 0}};
  assert.ok(Math.abs(pushAccelNow(curveE, curveT, curveF, 1.5) - 3) < 1e-9, 'curva com expoente 2 cai para 25% na metade da duração');
  const g = docArena();const f = targetAt(g, 1);
  const e = sandEntity({accel: 50, pushAccelerationMode: 2, pushTargetSpeed: 6, pushRampTime: .2, pushDuration: 1, pushDurationMode: 1, pushContinueAfterActive: 1, wallStaggerOn: 0});
  g.world.entities.push(e);
  let peak = 0, last = 0;
  for (let t = .2; t < .9; t += DT) {stepAt(g, e, t);applySandPushStep(f, DT);peak = Math.max(peak, f.locomotionVelocity.z);last = f.locomotionVelocity.z;}
  assert.ok(last > 5.8 && last < 6.1, `velocidade-alvo converge para ~6 m/s (${last.toFixed(3)})`);
  assert.ok(peak < 6.3, `velocidade-alvo não ultrapassa o alvo (${peak.toFixed(3)})`);
});

test('continua durante stagger/recuperação só com a política ligada', () => {
  const push = (/** @type {number} */ cont) => {
    const g = docArena();const f = g.fighters[1];
    f.knockRecovery = .3;f.locomotionVelocity = {x: 0, z: 0};
    f.sandPush = {by: 999, dir: {x: 0, z: 1}, accel: 12, maxSpeed: 0, continuesDuringStagger: cont};
    updateFighter(f, cmd(), g.fighters, DT, g.world);
    return f.locomotionVelocity.z;
  };
  assert.equal(push(0), 0, 'sem continuidade, o stagger zera a velocidade');
  assert.ok(push(1) > 0, 'com continuidade, a força é aplicada durante o stagger');
  const stun = (/** @type {number} */ cont) => {
    const g = docArena();const f = g.fighters[1];
    f.stun = .3;f.locomotionVelocity = {x: 0, z: 0};
    f.sandPush = {by: 999, dir: {x: 0, z: 1}, accel: 12, maxSpeed: 0, continuesDuringStagger: cont};
    updateFighter(f, cmd(), g.fighters, DT, g.world);
    return f.locomotionVelocity.z;
  };
  assert.equal(stun(0), 0, 'stun sem continuidade zera a velocidade');
  assert.ok(stun(1) > 0, 'stun com continuidade mantém o empurrão');
});

test('esquiva existente vs. nova esquiva são políticas separadas', () => {
  const dodgeExisting = (/** @type {number} */ toggle) => {
    const g = docArena();const f = targetAt(g, 1);
    f.action = {kind: 'dodge', elapsed: .3, invulnerableFor: 0, heading: 0};
    const e = sandEntity({pushCancelsDodge: 1, pushCancelsExistingDodge: toggle});
    g.world.entities.push(e);stepAt(g, e, .2);
    return f.action;
  };
  assert.equal(dodgeExisting(1), null, 'a política de esquiva existente interrompe a ação');
  assert.equal(dodgeExisting(0)?.kind, 'dodge', 'desligada, a esquiva em andamento continua');
});

test('modos de duração produzem motivos distintos e rastreáveis', () => {
  const reason = (/** @type {any} */ cfg) => {
    const g = docArena();const f = targetAt(g, 1);
    const e = sandEntity({accel: 12, ...cfg});
    g.world.entities.push(e);
    for (let t = .01; t <= 1.6; t += DT) stepAt(g, e, t);
    return e.targets[f.id]?.reason ?? null;
  };
  assert.equal(reason({}), 'barrageEnded', 'modo 0 (padrão) termina em barrageEnded');
  assert.equal(reason({pushDurationMode: 3}), 'activeWindowEnded', 'modo 3 (legado) termina em activeWindowEnded');
  assert.equal(reason({pushDuration: .3, pushDurationMode: 1, pushContinueAfterActive: 1}), 'durationElapsed', 'modo 1 termina em durationElapsed');
  const g = docArena();const f = targetAt(g, 1);
  const e = sandEntity({accel: 12, pushDurationMode: 2, pushContinueAfterActive: 1});
  g.world.entities.push(e);stepAt(g, e, .3);f.position = vec(0, 6);stepAt(g, e, .31);
  assert.equal(e.targets[f.id]?.reason, 'leftContact', 'modo 2 termina em leftContact');
});

test('onda mais forte assume o alvo; a mais fraca registra superseded', () => {
  const g = docArena();const f = targetAt(g, 1);
  const weak = sandEntity({id: 1001, accel: 6});
  const strong = sandEntity({id: 1002, accel: 12});
  g.world.entities.push(weak, strong);
  stepAt(g, weak, .2);stepAt(g, strong, .2);
  assert.equal(f.sandPush?.by, 1002, 'a onda de maior aceleração vence');
  stepAt(g, weak, .21);
  assert.equal(f.sandPush?.by, 1002, 'a onda fraca não sobrepõe a forte no passo seguinte');
  assert.equal(weak.targets[f.id]?.reason, 'superseded', 'a onda fraca registra o motivo superseded');
});

test('empate de aceleração mantém a onda que já estava ativa', () => {
  const g = docArena();const f = targetAt(g, 1);
  const first = sandEntity({id: 1003, accel: 12});
  const tie = sandEntity({id: 1004, accel: 12});
  g.world.entities.push(first, tie);
  stepAt(g, first, .2);stepAt(g, tie, .2);
  assert.equal(f.sandPush?.by, 1003, 'empate não troca a onda ativa');
  assert.equal(tie.targets[f.id]?.reason, 'superseded', 'a concorrente empatada registra superseded');
});

test('defesa perfeita anula o empurrão e registra perfectGuard', () => {
  const g = docArena();const f = targetAt(g, 1);
  f.guard = true;f.perfectLeft = 1;f.facing = Math.PI;
  const e = sandEntity({accel: 12, pushSpeed: 8});
  g.world.entities.push(e);stepAt(g, e, .2);
  assert.ok(!f.sandPush, 'defesa perfeita não cria empurrão');
  assert.equal(e.targets[f.id]?.reason, 'perfectGuard', 'motivo registrado: perfectGuard');
});

test('motivos de stagger, recuperação, alvo morto e onda removida', () => {
  const official = sandEntity({});
  const tOfficial = {firstAt: 0, lastContactAt: .2};
  assert.equal(pushWindowState(official, tOfficial, .2, {contact: true, pinned: true, recovering: true}).on, true, 'no padrão, stagger de parede não desliga a força');
  const e = sandEntity({pushContinuesDuringStagger: 0});
  const t = {firstAt: 0, lastContactAt: .2};
  assert.equal(pushWindowState(e, t, .2, {contact: true, pinned: true, recovering: true}).reason, 'wallStagger', 'com a política desligada, parede tem prioridade sobre recuperação');
  assert.equal(pushWindowState(e, t, .2, {contact: true, pinned: false, recovering: true}).reason, 'recovery', 'stun/recuperação fora da parede');
  assert.equal(pushWindowState(e, t, .2, {contact: true, airborne: true}).reason, 'airborne', 'alvo aéreo sem hitsAirborne');
  assert.equal(pushWindowState(e, t, .2, {contact: true, verticalOut: true}).reason, 'verticalOut', 'alvo acima da faixa vertical');

  const g = docArena();const f = targetAt(g, 1);
  const gone = sandEntity({accel: 12});g.world.entities.push(gone);
  stepAt(g, gone, .2);
  f.hp = 0;stepAt(g, gone, .21);
  assert.ok(!f.sandPush, 'alvo morto solta a força');
  assert.equal(gone.targets[f.id]?.reason, 'targetGone', 'motivo registrado: targetGone');

  const g2 = docArena();const f2 = targetAt(g2, 1);
  const removed = sandEntity({accel: 12});g2.world.entities.push(removed);
  stepAt(g2, removed, .2);
  assert.ok(f2.sandPush, 'onda empurra antes de ser removida');
  removed.dead = true;
  stepWorld(g2, DT);
  assert.ok(!f2.sandPush, 'onda removida solta a força');
  assert.equal(removed.targets[f2.id]?.reason, 'waveGone', 'motivo registrado: waveGone');
});

test('aceleração do empurrão NÃO altera a frente da onda; partialFactor NÃO é dano de guarda', () => {
  resetConfig(defaults());
  const e = sandEntity({accel: 12, waveAccel: 0});
  assert.equal(e.dir.z, 1);
  const g = docArena();targetAt(g, 2);
  const e2 = sandEntity({accel: 0, waveAccel: 0});
  g.world.entities.push(e2);
  const hitAt = (/** @type {number} */ pushAccel) => {
    const gg = docArena();targetAt(gg, 2);
    const ee = sandEntity({accel: pushAccel, waveAccel: 0, pushDurationMode: 1, pushContinueAfterActive: 1});
    gg.world.entities.push(ee);
    for (let t = .01; t <= .7; t += DT) {stepAt(gg, ee, t);if (ee.targets[gg.fighters[1].id]) return t;}
    return null;
  };
  assert.equal(hitAt(0), hitAt(30), 'mudar a aceleração do empurrão não muda o instante de acerto da onda');
  const calc = (/** @type {any} */ P) => {
    resetConfig(defaults());
    Object.assign(C.world.sandWave, P);
    return getCalculatedValuesForMove('sand-wave', 'sandWave', C.world);
  };
  const values = calc({partialFactor: .2});
  const guard = values.find(v => v.id === 'guardDmg');
  assert.ok(guard && guard.formula.includes('global') && guard.formula.includes('partialFactor NÃO'), 'a fórmula de dano em guarda aponta o multiplicador global');
  assert.equal(guard?.value, '3 HP', 'partialFactor 0,2 não altera o dano em guarda (6 × 0,5)');
  const defaultsCalc = calc({});
  assert.equal(defaultsCalc.find(v => v.id === 'pushMode')?.value, 'Fim da barragem (active + dissipate)', 'o painel calculado mostra o modo oficial');
  assert.equal(defaultsCalc.find(v => v.id === 'pushWindow')?.value, '1.5 s', 'o painel calculado mostra a barragem inteira, não só active');
});

done();
