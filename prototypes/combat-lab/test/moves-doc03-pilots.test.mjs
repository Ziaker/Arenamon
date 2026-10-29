// @ts-check
// DOC03 — Portão ZERO dos três pilotos: matriz de candidatos, IA declarativa editável e provas A/B das lacunas
// apontadas pelo documento (waveBottomTolerance, pierce do Water Pulse e herança completa do Tackle no Bullet Punch).
// Uso: node prototypes/combat-lab/test/moves-doc03-pilots.test.mjs
import assert from 'node:assert/strict';
import {C, resetConfig, defaults} from '../src/sim/config.js';
import {Game} from '../src/sim/game.js';
import {emptyCommand} from '../src/sim/entity.js';
import {vec} from '../src/sim/math.js';
import {registerStandardMoves} from '../src/sim/moves/standard.js';
import {EDITABLE_MOVES} from '../src/editor/editable-moves.js';
import {
  getAiProfile,
  getDefaultAiProfile,
  getAiProfileOverride,
  setAiProfileOverride,
  resetAiProfileOverride,
  registerAiProfile,
  aiProfileIds,
  getAiRule,
} from '../src/sim/ai-profile.js';
import {
  PILOT_MOVES,
  buildPilotMatrix,
  coverageSummary,
  PILOT_POLICIES,
  PILOT_TECH_JUSTIFIED,
} from '../src/sim/moves/pilot-coverage.js';
import {getInheritedParamsForMove, getCalculatedValuesForMove} from '../src/sim/moves/move-mechanics-audit.js';
import {spawn} from '../src/sim/world.js';
import {canSee} from '../src/sim/vision.js';
import {blockingSolids, pointInSolid} from '../src/sim/collision/queries.js';
import {stepSand} from '../src/sim/sand.js';

registerStandardMoves();

let passed = 0, failed = 0;
function test(/** @type {string} */ name, /** @type {() => void} */ fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    const e = /** @type {Error} */ (err);
    console.error(`  ✗ ${name}\n    ${(e.stack || e.message).split('\n').slice(0, 5).join('\n    ')}`);
    process.exitCode = 1;
  }
}

console.log('\n--- DOC03: PORTÃO ZERO E LACUNAS DOS PILOTOS ---\n');

const pilotMoves = () => PILOT_MOVES.map(p => {
  const m = EDITABLE_MOVES.find(x => x.id === p.id);
  assert.ok(m, `piloto ${p.id} registrado`);
  return {...m, runtime: C.world[m.group] ?? {}, aiProfile: getAiProfile(p.id), inherited: getInheritedParamsForMove(p.id, m.group, {tackle: C.actions.tackle})};
});

// ---- Auxiliares dos A/B (mesmo padrão determinístico dos testes de Move) ----
const HOLD = i => [0, 1, 2, 3].map(k => k === i);
const press0 = {skill: 0, skillHeld: HOLD(0)};
const held0 = {skillHeld: HOLD(0)};
const secs = s => Math.round(s * 120);
const cmd = (/** @type {Record<string, any>} */ o = {}) => ({...emptyCommand(), ...o});
const run = (g, n, c0 = () => cmd(), c1 = () => cmd()) => {for (let i = 0; i < n; i++) g.step(c0(i), c1(i));};
/** Arena limpa: sem mapa/IA, azul em (0,-3) olhando +z, vermelho em (0,3). */
function docArena({equip = [], positions = [vec(0, -3), vec(0, 3)]} = {}) {
  resetConfig(defaults());
  const g = new Game({seed: 3});g.start();
  g.mapState.platforms = [];g.mapState.obstacles = [];g.mapState.destructibles = [];g.mapState.items = [];g.mapState.regularSpawnTimer = 1e9;
  g.reset({positions});g.fighters[0].facing = 0;g.fighters[1].facing = Math.PI;
  if (equip.length) g.setLoadout(0, equip);
  return g;
}
/** Hash só do estado mecânico (posição/HP/stamina/status/entidades), sem parâmetros de ação nem visual. */
const stateHash = g => JSON.stringify({
  f: g.fighters.map(f => [f.position, f.hp, f.stamina, f.groundY ?? 0, f.state, !!f.absent,
    (f.statuses ?? []).map(s => [s.id, +s.remaining.toFixed(3)])]),
  e: g.world.entities.map(e => [e.kind, e.pos, e.dead ?? false, +(e.age ?? 0).toFixed(3)]),
});
/** Sand Wave: aperta o botão, deixa o cast terminar e roda `ticks` passos. */
function sandCast(positions, ticks = 34, tweak = null) {
  const g = docArena({equip: ['sand-wave'], positions});
  tweak?.(g);
  g.step(cmd(press0), cmd());
  run(g, ticks);
  return g;
}
/** Barragem mínima para exercitar o consumidor real (stepSand) com um alvo só, sem depender do cast. */
function sandEntity(overrides = {}) {
  return {
    id: 999, kind: 'sandwave', owner: 0, pos: {x: 0, z: -4}, dir: {x: 0, z: 1}, length: 4, width: 3,
    active: .75, life: 1.5, speed: 4 / .75, speed0: 4 / .75, waveAccel: 0, damage: 0, knockbackH: 0,
    knockbackV: 0, accel: 0, pushSpeed: 0, pushDuration: 0, pushClearsLocomotion: 1,
    pushCancelsDodge: 1, partialFactor: .5, blind: 4, blindOnPartial: 1, hitsAirborne: 0,
    wallStagger: .3, wallStaggerOn: 1, cell: .25, detour: 3, replanSteps: 6, y: 0, height: .35,
    wallPressMinSpeed: .6, wallPressMoveRatio: .25, waveBottomTolerance: .2, maxTargets: 16,
    age: .2, targets: {}, pushed: [], ...overrides,
  };
}
/** Um passo de stepSand no tempo `age`; devolve a barragem para encadear passos. */
function sandStepAt(g, e, age, events = []) {
  e.age = age;
  stepSand(g, e, 1 / 120, events);
  return e;
}
/** Tick em que o vermelho perde HP desde o início do cast (-1 = não foi atingido na janela observada). */
function sandHitTick(tweak, positions = [vec(0, -4), vec(0, -1)]) {
  const g = docArena({equip: ['sand-wave'], positions});
  tweak?.(g);
  g.step(cmd(press0), cmd());
  for (let t = 1; t < secs(1.2); t++) {
    g.step(cmd(), cmd());
    if (g.fighters[1].hp < g.fighters[1].attributes.hp) return t;
  }
  return -1;
}
/** Bullet Punch: segura 3 passos e solta (cast aprovado = 0,2 s na base de calibração). */
function bpCast(tweak = null, positions = [vec(0, -1), vec(0, 4.5)]) {
  const g = docArena({equip: ['bullet-punch'], positions});
  tweak?.(g);
  g.step(cmd(press0), cmd());
  for (let i = 1; i < 4; i++) g.step(cmd(held0), cmd());
  g.step(cmd(), cmd());
  return g;
}
/** Water Pulse: segura `k` passos e solta; devolve o jogo logo após a soltura. */
function wpCast(k = 10, tweak = null) {
  const g = docArena({equip: ['water-pulse'], positions: [vec(0, -3), vec(0, 3)]});
  tweak?.(g);
  g.step(cmd(press0), cmd());
  for (let i = 1; i < k; i++) g.step(cmd(held0), cmd());
  g.step(cmd(), cmd());
  return g;
}
const waterOrbs = g => g.world.entities.filter(e => e.kind === 'projectile' && e.visual === 'waterorb' && !e.dead);

test('matriz DOC03: todo candidato dos 3 pilotos tem origem, consumidor, UI, persistência e decisão', () => {
  resetConfig(defaults());
  const moves = pilotMoves();
  assert.equal(moves.length, 3, 'três pilotos cobertos');
  const entries = moves.flatMap(m => buildPilotMatrix(/** @type {any} */ (m)));
  assert.ok(entries.length >= 120, `matriz completa (veio ${entries.length} candidatos)`);
  for (const e of entries) {
    assert.ok(e.id && e.move && e.origin, `entrada com identidade: ${JSON.stringify(e).slice(0, 120)}`);
    assert.ok(e.consumer && e.consumer.includes(':'), `${e.id}: consumidor arquivo:função`);
    assert.ok(e.ui, `${e.id}: presença ou bloqueio declarado`);
    assert.ok(e.persistence, `${e.id}: persistência declarada`);
    assert.ok(['PASS', 'TECH-JUSTIFIED', 'INHERITED', 'BLOCKED', 'OPEN'].includes(e.decision), `${e.id}: decisão válida (${e.decision})`);
    assert.ok(e.evidence, `${e.id}: evidência/justificativa`);
  }
  // Nada da ficha some da matriz.
  for (const m of moves) {
    for (const r of m.params.rows) {
      if (String(r.key).startsWith('hitShake')) continue;
      assert.ok(entries.some(e => e.id === `${m.id}.${r.key}`), `${m.id}.${r.key} presente na matriz`);
    }
  }
  // IA e políticas também estão representadas.
  for (const m of moves) {
    assert.ok(entries.some(e => e.id.startsWith(`${m.id}.ai.`)), `${m.id}: campos de IA na matriz`);
    for (const pol of PILOT_POLICIES.filter(p => p.move === m.id)) {
      assert.ok(entries.some(e => e.id === pol.id), `${pol.id}: política fixa classificada`);
    }
  }
  const sum = coverageSummary(entries);
  assert.equal(sum.openIds.length, sum.open, 'lista de abertos bate com o resumo');
  assert.equal(sum.open, 0, `Portão ZERO sem abertos (${sum.openIds.join(', ')})`);
  assert.equal(sum.decided, sum.total, 'todo candidato tem decisão');
  assert.ok(sum.decidedPct === 100, `cobertura decidida 100% (${sum.decidedPct}%)`);
  // Técnicos justificados não podem se passar por A/B de efeito.
  for (const e of entries.filter(x => x.decision === 'TECH-JUSTIFIED')) {
    assert.ok(e.ab && e.evidence, `${e.id}: técnico com invariante e justificativa`);
  }
  assert.ok(Object.keys(PILOT_TECH_JUSTIFIED).every(id => entries.some(e => e.id === id)), 'técnicos declarados aparecem na matriz');
  // A ficha pode divergir do padrão aprovado em runtime; a matriz mostra os dois e só aceita os overrides conhecidos.
  const drift = entries.filter(e => typeof e.runtime === 'number' && typeof e.value === 'number' && Math.abs(e.runtime - e.value) > 1e-9).map(e => e.id).sort();
  assert.deepEqual(drift, ['bullet-punch.atelierVfx', 'bullet-punch.cast', 'bullet-punch.impactMult', 'sand-wave.pushMaxSpeed', 'sand-wave.pushSpeed'], `overrides documentados (${drift.join(', ')})`);
});

test('Recursos do DOC03: waveBottomTolerance e pierce existem na ficha e chegam ao consumidor', () => {
  const sw = /** @type {any} */ (EDITABLE_MOVES.find(m => m.id === 'sand-wave')).params.rows.find(r => r.key === 'waveBottomTolerance');
  assert.ok(sw, 'Sand Wave declara waveBottomTolerance');
  assert.equal(sw.value, 0.2, 'padrão aprovado preservado (0,2 m)');
  const wp = /** @type {any} */ (EDITABLE_MOVES.find(m => m.id === 'water-pulse')).params.rows.find(r => r.key === 'pierce');
  assert.ok(wp, 'Water Pulse declara pierce');
  assert.equal(wp.value, 1, 'pierce padrão aprovado preservado (1)');
});

test('A/B Sand Wave: waveBottomTolerance decide o acerto em alvo na altura limítrofe', () => {
  /** @type {(tol: number) => {hp: number, blind: boolean}} */
  const run = (tol) => {
    resetConfig(defaults());
    C.world.sandWave.waveBottomTolerance = tol;
    const g = new Game({seed: 21});g.start();
    g.setLoadout(0, ['sand-wave']);
    g.fighters[0].position = vec(0, -1.5);g.fighters[1].position = vec(0, 1.5);
    g.fighters[0].facing = 0;g.fighters[1].facing = Math.PI;
    g.step({...emptyCommand(), target: 1, skill: 0, skillHeld: [true, false, false, false]}, emptyCommand());
    for (let t = 0; t < 34; t++) g.step({...emptyCommand(), target: 1}, emptyCommand());
    const wave = g.world.entities.find(e => e.kind === 'sandwave');
    assert.ok(wave, 'onda criada');
    wave.y = 0.15;   // base 15 cm acima do alvo: fica dentro da tolerância de 0,2 m e fora da de 0,05 m
    for (let t = 0; t < 90; t++) g.step({...emptyCommand(), target: 1}, emptyCommand());
    return {hp: g.fighters[1].hp, blind: g.fighters[1].statuses.some(s => s.id === 'blind')};
  };
  const wide = run(0.2), narrow = run(0.05);
  assert.ok(wide.hp < 100 && wide.blind, `tolerância 0,2 m alcança o alvo (hp ${wide.hp}, cego ${wide.blind})`);
  assert.equal(narrow.hp, 100, 'tolerância 0,05 m não alcança o alvo desnivelado');
  assert.equal(narrow.blind, false, 'sem cegueira fora da tolerância');
  resetConfig(defaults());
});

test('A/B Water Pulse: pierce sai da ficha para o projétil real', () => {
  /** @type {(pierce: number) => number} */
  const run = (pierce) => {
    resetConfig(defaults());
    C.world.waterPulse.pierce = pierce;
    const g = new Game({seed: 33});g.start();
    g.setLoadout(0, ['water-pulse']);
    g.fighters[0].position = vec(0, -4);g.fighters[1].position = vec(0, 4);
    g.fighters[0].facing = 0;g.fighters[1].facing = Math.PI;
    g.step({...emptyCommand(), target: 1, skill: 0, skillHeld: [true, false, false, false]}, emptyCommand());
    for (let t = 0; t < 50; t++) g.step({...emptyCommand(), target: 1, skillHeld: [true, false, false, false]}, emptyCommand());
    g.step({...emptyCommand(), target: 1}, emptyCommand());
    for (let t = 0; t < 10; t++) g.step({...emptyCommand(), target: 1}, emptyCommand());
    const p = g.world.entities.find(e => e.kind === 'projectile' && e.visual === 'waterorb');
    assert.ok(p, 'esfera de água criada');
    assert.equal(p.owner, 0, 'pertence ao azul');
    return p.pierce;
  };
  assert.equal(run(1), 1, 'pierce 1 preservado por padrão');
  assert.equal(run(2), 2, 'pierce 2 chega ao consumidor');
  resetConfig(defaults());
});

test('Herança completa do Tackle: Bullet Punch enxerga todos os campos globais (não só 4 curvas)', () => {
  resetConfig(defaults());
  const bp = EDITABLE_MOVES.find(m => m.id === 'bullet-punch');
  const inherited = getInheritedParamsForMove('bullet-punch', /** @type {any} */ (bp).group, {tackle: C.actions.tackle});
  const tacklePaths = inherited.filter(i => i.path.startsWith('actions.tackle.')).map(i => i.path.split('.').pop());
  const fields = Object.keys(C.actions.tackle).filter(k => typeof C.actions.tackle[k] === 'number');
  assert.ok(fields.length >= 20, `C.actions.tackle tem ${fields.length} campos numéricos`);
  for (const k of fields) assert.ok(tacklePaths.includes(k), `Tackle.${k} exposto como herdado`);
  for (const k of ['prepTime', 'impulseTime', 'decelStart', 'travelEnd', 'duration', 'distance', 'steerRate', 'invulnerable']) {
    assert.ok(tacklePaths.includes(k), `campo herdado crítico ${k} presente`);
  }
});

test('IA declarativa: override do Editor muda a decisão e restaurar volta ao perfil da ficha', () => {
  const id = 'doc03-synthetic';
  registerAiProfile(id, {kind: 'tap', p: 0.3, why: 'teste', distance: {max: 3.4}, requires: ['tGround'], minStamina: 2.2});
  const context = (/** @type {number} */ distance) => ({distance, facing: true, tGround: true, tGuard: false, tackling: false, tCharging: false});
  const self = {stamina: 3, statuses: []}, target = {};
  const rule = () => /** @type {any} */ (getAiRule(id));
  assert.ok(rule()(context(3), self, target), 'perfil de fábrica aceita 3 m');
  const ok = setAiProfileOverride(id, {distance: {max: 2}});
  assert.equal(ok.ok, true, 'override válido aplicado');
  assert.equal(rule()(context(3), self, target), null, 'override reduz o alcance da decisão');
  assert.ok(rule()(context(1.5), self, target), 'dentro da nova faixa continua decidindo');
  assert.deepEqual(getAiProfileOverride(id), {distance: {max: 2}}, 'override registrado');
  resetAiProfileOverride(id);
  assert.ok(rule()(context(3), self, target), 'restaurar volta ao perfil declarativo');
  assert.equal(getAiProfileOverride(id), null, 'sem override após restaurar');
  // Os pilotos reais expõem os campos que o Editor mostra.
  for (const m of PILOT_MOVES) {
    const prof = getAiProfile(m.id);
    assert.ok(prof, `${m.id}: perfil de IA declarado`);
    assert.ok(typeof prof.p === 'number', `${m.id}: chance p declarada`);
    assert.ok(getDefaultAiProfile(m.id), `${m.id}: padrão de fábrica disponível`);
  }
  assert.ok(aiProfileIds().includes('sand-wave'), 'perfil de fábrica do Sand Wave no registro');
  resetAiProfileOverride('sand-wave');
  resetAiProfileOverride('bullet-punch');
  resetAiProfileOverride('water-pulse');
});

test('detector de mutação: candidato novo sem classificação entra como OPEN (não desaparece)', () => {
  const fakeMove = {
    id: 'fake-pilot', group: 'fakePilot',
    params: {rows: [{key: 'mysteryKnob', label: 'x', tip: 'x', min: 0, max: 1, step: 0.1, unit: 'num', value: 0.4}]},
    aiProfile: null, inherited: [],
  };
  const entries = buildPilotMatrix(fakeMove);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].decision, 'OPEN', 'candidato sem A/B registrado fica OPEN');
  assert.equal(coverageSummary(entries).open, 1);
});

test('A/B Sand Wave: knockbackV, accel, wallStagger e visionRadius mudam o resultado', () => {
  // knockbackV: 0 = só empurrão; >0 lança no primeiro contato.
  const kick = (/** @type {number} */ v) => {
    const g = sandCast([vec(0, -1.5), vec(0, 1.5)], 34, () => {C.world.sandWave.knockbackV = v;});
    let maxY = 0, hit = false;
    for (let i = 0; i < 100; i++) {g.step(cmd(), cmd());hit ||= g.lastStepEvents.some(e => e.result === 'impact');maxY = Math.max(maxY, g.fighters[1].flight?.y ?? 0);}
    return {maxY, hit};
  };
  const flat = kick(0), up = kick(6);
  assert.ok(flat.hit && up.hit, 'os dois cenários acertam');
  assert.equal(flat.maxY, 0, 'V=0 não lança');
  assert.ok(up.maxY > .3, `V=6 lança (${up.maxY.toFixed(2)} m)`);

  // accel: 0 não empurra; 30 empurra muito mais que o padrão.
  const push = (/** @type {number} */ a) => {
    const g = sandCast([vec(0, -4), vec(0, -3.2)], secs(.25) + 12, () => {C.world.sandWave.accel = a;C.world.sandWave.pushSpeed = 0;C.world.sandWave.pushMaxSpeed = 0;});   // isola a aceleração: o impulso constante de 29/10 (pushSpeed) empurraria mesmo com accel 0
    const z0 = g.fighters[1].position.z;run(g, secs(.5));
    return g.fighters[1].position.z - z0;
  };
  const none = push(0), strong = push(30);
  assert.ok(none < .3, `accel 0 quase não empurra (${none.toFixed(2)} m)`);
  assert.ok(strong > 1.5 && strong > none + 1, `accel 30 empurra (${strong.toFixed(2)} m)`);

  // wallStagger: o tempo do stagger é exatamente o configurado.
  const stagger = (/** @type {number} */ ws) => {
    const g = docArena({equip: ['sand-wave'], positions: [vec(0, -4), vec(0, -2.2)]});
    C.world.sandWave.wallStagger = ws;
    spawn(g.world, {kind: 'wall', pos: {x: 0, z: -1.1}, hx: 4, hz: .3, angle: 0, y: 0, height: 3}, []);
    const r = g.fighters[1];let seconds = null, maxRec = 0;
    g.step(cmd(press0), cmd());
    for (let i = 1; i < secs(1.1); i++) {
      g.step(cmd(), cmd());
      for (const e of g.lastStepEvents) if (e.result === 'sandStagger') seconds = e.seconds;
      maxRec = Math.max(maxRec, r.knockRecovery);
    }
    return {seconds, maxRec};
  };
  const short = stagger(.1), long = stagger(.8);
  assert.ok(Math.abs(short.seconds - .1) < 1e-9 && Math.abs(long.seconds - .8) < 1e-9, `eventos ${short.seconds}/${long.seconds}`);
  assert.ok(short.maxRec < .2 && long.maxRec > .7, `recuperação ${short.maxRec.toFixed(2)}/${long.maxRec.toFixed(2)}`);

  // visionRadius: 4 m não vê a 6 m; 12 m vê.
  const see = (/** @type {number} */ radius) => {
    const g = docArena({positions: [vec(0, 0), vec(0, 6)]});
    C.world.sandWave.visionRadius = radius;
    const f = g.fighters[0];
    f.statuses = [{id: 'blind', duration: 4, remaining: 4, stacks: 1, maxStacks: 1, stacking: 'refresh', mul: {}, add: {}, flags: {blind: true}, tick: null, acc: 0, tags: ['debuff']}];
    return canSee(f, g.fighters[1], g.world);
  };
  assert.equal(see(4), false, 'visão 4 m não alcança 6 m');
  assert.equal(see(12), true, 'visão 12 m alcança 6 m');
});

test('A/B Sand Wave: detour decide o desvio; cell, replanSteps e fogDarkness são técnicos invariantes', () => {
  // detour pequeno não consegue representar o caminho ao redor da parede larga; grande consegue.
  const around = (/** @type {number} */ d) => {
    const g = docArena({equip: ['sand-wave'], positions: [vec(0, -4), vec(0, -.5)]});
    C.world.sandWave.detour = d;C.world.sandWave.length = 10;
    spawn(g.world, {kind: 'wall', pos: {x: 0, z: -2.3}, hx: 3, hz: .3, angle: 0, y: 0, height: 3}, []);
    g.step(cmd(press0), cmd());
    for (let i = 1; i < secs(1.5); i++) {g.step(cmd(), cmd());if (g.lastStepEvents.some(e => e.source === 'sand')) return i;}
    return -1;
  };
  assert.equal(around(.3), -1, 'detour 0,3 m não contorna a parede');
  assert.ok(around(10) > 0, 'detour 10 m contorna e acerta');

  // cell: a resolução da grade não muda o tick do acerto no mesmo cenário.
  const cellTick = (/** @type {number} */ cell) => {
    const g = docArena({equip: ['sand-wave'], positions: [vec(0, -4), vec(0, -.8)]});
    C.world.sandWave.cell = cell;
    spawn(g.world, {kind: 'wall', pos: {x: -2.2, z: -1.9}, hx: 2, hz: .3, angle: 0, y: 0, height: 3}, []);
    spawn(g.world, {kind: 'wall', pos: {x: 2.2, z: -3.1}, hx: 2, hz: .3, angle: 0, y: 0, height: 3}, []);
    g.step(cmd(press0), cmd());
    for (let i = 1; i < secs(1.3); i++) {g.step(cmd(), cmd());if (g.lastStepEvents.some(e => e.source === 'sand')) return i;}
    return -1;
  };
  assert.equal(cellTick(.1), cellTick(.5), 'cell fina e grossa acertam no mesmo tick');

  // replanSteps: com obstáculo estático, o intervalo de recálculo não muda nada.
  const replanTick = (/** @type {number} */ r) => {
    const g = docArena({equip: ['sand-wave'], positions: [vec(0, -4), vec(0, -.8)]});
    C.world.sandWave.replanSteps = r;
    spawn(g.world, {kind: 'wall', pos: {x: 0, z: -2.3}, hx: .9, hz: .3, angle: 0, y: 0, height: 3}, []);
    g.step(cmd(press0), cmd());
    for (let i = 1; i < secs(1.3); i++) {g.step(cmd(), cmd());if (g.lastStepEvents.some(e => e.source === 'sand')) return i;}
    return -1;
  };
  assert.equal(replanTick(1), replanTick(60), 'replanSteps 1 e 60 acertam no mesmo tick');

  // fogDarkness é só da câmera: a simulação termina idêntica.
  const fog = (/** @type {number} */ dark) => {
    const g = sandCast([vec(0, -4), vec(0, -3.2)], 34, () => {C.world.sandWave.fogDarkness = dark;});
    run(g, secs(1.5));
    return stateHash(g);
  };
  assert.equal(fog(.2), fog(.9), 'fogDarkness não altera o estado mecânico');
});

test('A/B Sand Wave: wallPressMinSpeed e wallPressMoveRatio decidem o stagger contra a parede', () => {
  /** Executa três passos do consumidor real (stepSand) com o alvo andando e sendo freado. */
  const wallPress = (/** @type {number} */ minSpeed, /** @type {number} */ moveRatio) => {
    const g = docArena();
    const f = g.fighters[1];f.position = vec(0, -2);
    const dt = 1 / 120;
    const e = {
      id: 999, kind: 'sandwave', owner: 0, pos: {x: 0, z: -4}, dir: {x: 0, z: 1}, length: 4, width: 3,
      active: .75, life: 1.5, speed: 4 / .75, damage: 1, knockbackH: 0, knockbackV: 0, accel: 0,
      partialFactor: .5, blind: 4, wallStagger: .3, cell: .25, detour: 3, replanSteps: 6, y: 0, height: .35,
      wallPressMinSpeed: minSpeed, wallPressMoveRatio: moveRatio, waveBottomTolerance: .2, age: .5, targets: {}, pushed: [],
    };
    g.world.entities.push(e);
    const events = [];
    // 1º passo: primeiro contato (zera a velocidade própria). 2º: volta a andar (want > 0). 3º: move só metade do esperado.
    f.locomotionVelocity = {x: 0, z: 2};stepSand(g, e, dt, events);e.age += dt;
    f.locomotionVelocity = {x: 0, z: 2};stepSand(g, e, dt, events);e.age += dt;
    f.locomotionVelocity = {x: 0, z: 2};f.position = vec(0, f.position.z + .5 * 2 * dt);stepSand(g, e, dt, events);
    return events.filter(x => x.result === 'sandStagger').length;
  };
  assert.equal(wallPress(.1, .9), 1, 'limiar alcançável + frenagem 50% → stagger');
  assert.equal(wallPress(100, .9), 0, 'minPressSpeed alto nunca considera pressão');
  assert.equal(wallPress(.1, .25), 0, 'moveRatio estrito não considera a frenagem de 50%');
});

test('A/B Bullet Punch: custo, cooldown, slow, knockback próprio e maxRise', () => {
  const spend = () => {
    const g = bpCast(() => {C.world.bulletPunch.cost = 3;C.world.bulletPunch.cooldown = 20;});
    return {spent: C.rules.staminaMax - g.fighters[0].stamina, cd: g.fighters[0].moveCooldowns['bullet-punch']};
  };
  const heavy = spend();
  assert.ok(Math.abs(heavy.spent - 3) < .01, `custo 3 cobrado (${heavy.spent.toFixed(2)})`);
  assert.ok(heavy.cd > 19.9, `cooldown 20 iniciado (${heavy.cd.toFixed(2)})`);

  // slow: durante o cast, slow 0,7 anda bem menos que slow 0.
  const walk = (/** @type {number} */ slow) => {
    const g = bpCast(() => {C.world.bulletPunch.slow = slow;});
    const b = g.fighters[0], z0 = b.position.z;
    run(g, 30, () => cmd({move: vec(0, 1)}));
    return b.position.z - z0;
  };
  const fast = walk(0), slow = walk(.7);
  assert.ok(slow < fast - .2, `slow 0,7 anda menos (${slow.toFixed(2)} < ${fast.toFixed(2)})`);

  // knockback próprio: desliga a fórmula do Tackle e usa H/V da ficha.
  const hitZ = (/** @type {number} */ own, /** @type {number} */ h, /** @type {number} */ v) => {
    const g = bpCast(() => {C.world.bulletPunch.knockbackOwn = own;C.world.bulletPunch.knockbackH = h;C.world.bulletPunch.knockbackV = v;});
    let maxY = 0;
    for (let i = 0; i < secs(2); i++) {g.step(cmd(), cmd());maxY = Math.max(maxY, g.fighters[1].flight?.y ?? 0);}
    return {z: g.fighters[1].position.z, maxY};
  };
  const formula = hitZ(0, 4, 0), h2 = hitZ(1, 2, 0), h10 = hitZ(1, 10, 0), v8 = hitZ(1, 0, 8);
  assert.ok(h10.z > h2.z + 3, `H=10 empurra mais que H=2 (${h10.z.toFixed(1)} > ${h2.z.toFixed(1)})`);
  assert.ok(Math.abs(h2.z - formula.z) > .5, 'knockbackOwn desliga a fórmula do Tackle');
  assert.equal(v8.maxY > .2, true, `V=8 lança (${v8.maxY.toFixed(2)} m)`);

  // maxRise: reaparecer em cima de uma plataforma alta depende do limite de apoio.
  const rise = (/** @type {number} */ mr) => {
    const g = bpCast(gg => {
      C.world.bulletPunch.maxRise = mr;
      gg.mapState.platforms = [{id: 'p', pos: {x: 0, z: 4}, x: 0, z: 4, width: 6, depth: 6, height: 2.5}];
      gg.fighters[1].groundY = 2.5;
    });
    run(g, secs(1.2));
    return g.fighters[0].groundY;
  };
  assert.equal(rise(0), 0, 'maxRise 0 não sobe a plataforma');
  assert.equal(rise(6), 2.5, 'maxRise 6 apoia na plataforma');
});

test('A/B Bullet Punch: freeSearchRadius e freeSearchStep acham espaço livre na chegada bloqueada', () => {
  /** A parede nasce depois do início do sumiço (o destino já foi fixado) e antes do retorno. */
  const landing = (/** @type {number} */ radius, /** @type {number} */ step) => {
    const g = bpCast(() => {C.world.bulletPunch.freeSearchRadius = radius;C.world.bulletPunch.freeSearchStep = step;});
    run(g, 30);
    assert.ok(g.fighters[0].absent, 'ainda no sumiço');
    spawn(g.world, {kind: 'wall', pos: {x: 0, z: 3.4}, hx: .6, hz: 2, angle: 0, y: 0, height: 3}, []);
    for (let i = 0; i < secs(.3); i++) {
      g.step(cmd(), cmd());
      if (g.lastStepEvents.some(e => e.result === 'bulletReturn')) {
        const f = g.fighters[0], solids = blockingSolids(g.world);
        return {pos: {...f.position}, blocked: pointInSolid(f.position, solids, {margin: C.test.halfExtent * .9})};
      }
    }
    return null;
  };
  const tight = landing(1, .25), wide = landing(8, .25);
  const fine = landing(8, .05), coarse = landing(8, 1);
  assert.ok(tight && wide && fine && coarse, 'todos reaparecem');
  assert.equal(tight.blocked, false, 'raio 1 m ainda encontra ponto livre');
  assert.notDeepEqual(tight.pos, wide.pos, 'o raio muda o ponto de chegada');
  assert.ok(Math.hypot(fine.pos.x, fine.pos.z - 3.4) < Math.hypot(coarse.pos.x, coarse.pos.z - 3.4), 'passo fino fica mais perto do destino');
});

test('A/B Water Pulse: chargeRecovery, originHeight, spawnForward, knockbackV e counterStagger', () => {
  const recovery = (/** @type {number} */ cr) => {
    const g = wpCast(20, () => {C.world.waterPulse.chargeRecovery = cr;});
    return g.fighters[0].moveRecovery;
  };
  assert.ok(Math.abs(recovery(.1) - .1) < .02 && Math.abs(recovery(.8) - .8) < .02, 'recuperação segue o slider');

  const orb = (/** @type {number} */ oh, /** @type {number} */ sf) => {
    const g = wpCast(20, () => {C.world.waterPulse.originHeight = oh;C.world.waterPulse.spawnForward = sf;});
    const p = waterOrbs(g)[0], f = g.fighters[0];
    return {y: p.y, dist: Math.hypot(p.pos.x - f.position.x, p.pos.z - f.position.z)};
  };
  const low = orb(.3, .3), high = orb(1.2, 1.4);
  assert.ok(Math.abs(low.y - .3) < 1e-9 && Math.abs(high.y - 1.2) < 1e-9, `altura ${low.y}/${high.y}`);
  assert.ok(high.dist > low.dist + .8, `nascimento à frente ${low.dist.toFixed(2)}/${high.dist.toFixed(2)}`);

  const fly = (/** @type {number} */ v) => {
    const g = wpCast(10, () => {C.world.waterPulse.knockbackV = v;});
    let maxY = 0;
    for (let i = 0; i < secs(2); i++) {g.step(cmd(), cmd());maxY = Math.max(maxY, g.fighters[1].flight?.y ?? 0);}
    return maxY;
  };
  assert.equal(fly(0), 0, 'V=0 só desliza');
  assert.ok(fly(8) > .3, `V=8 lança (${fly(8).toFixed(2)} m)`);

  // counterStagger: a esfera vence um Tackle PL1 e o valor da ficha vira o stagger do derrotado.
  const counter = (/** @type {number} */ cs) => {
    const g = docArena({equip: ['water-pulse'], positions: [vec(0, -3), vec(0, 2)]});
    C.world.waterPulse.counterStagger = cs;
    const r = g.fighters[1];
    r.action = {kind: 'tackle', elapsed: 0, move: 'tackle', pl: 1, duration: 2, heading: Math.PI};
    spawn(g.world, {
      kind: 'projectile', owner: 0, pos: {x: 0, z: 1.2}, dir: {x: 0, z: 1}, speed: 0, vy: 0, life: 3, radius: .38, y: 1,
      pierce: 1, clashable: true, pl: 2, blockedBy: [], hit: {damage: 1, knockback: {horizontal: 0, vertical: 0}},
      captured: {move: 'water-pulse', counterStagger: cs, attackFraction: 1, successiveFactor: 1, level: 2},
    }, []);
    let seconds = null;
    for (let i = 0; i < 10; i++) {g.step(cmd(), cmd());for (const e of g.lastStepEvents) if (e.result === 'counterStagger') seconds = e.seconds;}
    return {applied: r.counterStagger, seconds};
  };
  const c1 = counter(.2), c2 = counter(.7);
  assert.ok(c1.applied > .1 && c2.applied > .6, `stagger aplicado ${c1.applied.toFixed(2)}/${c2.applied.toFixed(2)}`);
  assert.ok(Math.abs(c1.seconds - .2) < 1e-9 && Math.abs(c2.seconds - .7) < 1e-9, 'evento carrega o valor configurado');
});

test('Visual isolado: fxLines/fxHideBody e plScaleBonus não mudam a simulação', () => {
  const bpFx = (/** @type {number} */ lines, /** @type {number} */ hide) => {
    const g = bpCast(() => {C.world.bulletPunch.fxLines = lines;C.world.bulletPunch.fxHideBody = hide;});
    run(g, secs(.6));
    return stateHash(g);
  };
  assert.equal(bpFx(1, 1), bpFx(0, 0), 'Bullet Punch: linhas/corpo oculto são só aparência');

  const wpScale = (/** @type {number} */ bonus) => {
    const g = wpCast(200, () => {C.world.waterPulse.plScaleBonus = bonus;});
    const p = waterOrbs(g)[0];
    const snap = {radius: p.radius, visualScale: p.visualScale, damage: p.hit.damage, kb: {...p.hit.knockback}};
    run(g, 20);
    return {...snap, hash: stateHash(g)};
  };
  const s1 = wpScale(.1), s2 = wpScale(.5);
  assert.equal(s1.radius, s2.radius, 'raio físico igual');
  assert.equal(s1.damage, s2.damage, 'dano igual');
  assert.deepEqual(s1.kb, s2.kb, 'knockback igual');
  assert.notEqual(s1.visualScale, s2.visualScale, 'escala visual muda');
  assert.equal(s1.hash, s2.hash, 'estado mecânico idêntico');
});

test('A/B Sand Wave: sincronização, velocidade manual e aceleração da frente', () => {
  const sync = (/** @type {number} */ v) => sandHitTick(() => {
    C.world.sandWave.speedFromReach = 1;C.world.sandWave.waveSpeed = v;C.world.sandWave.waveAccel = 0;
  });
  const syncSlow = sync(.5), syncFast = sync(20);
  assert.ok(syncSlow > 0 && syncFast > 0, 'os dois cenários sincronizados acertam');
  assert.equal(syncSlow, syncFast, 'com a sincronização ligada, waveSpeed manual é ignorado e o tick não muda');

  const manual = (/** @type {number} */ v) => sandHitTick(() => {
    C.world.sandWave.speedFromReach = 0;C.world.sandWave.waveSpeed = v;C.world.sandWave.waveAccel = 0;
  });
  const slow = manual(.5), fast = manual(20);
  assert.equal(slow, -1, 'velocidade manual 0,5 m/s não alcança 3 m na janela ativa');
  assert.ok(fast > 0 && fast < syncSlow, `velocidade manual 20 m/s acerta antes da sincronizada (${fast} < ${syncSlow})`);

  // Com a sincronização ligada, a aceleração positiva obriga uma v₀ menor para ainda percorrer 4 m em 0,75 s:
  // a frente chega mais tarde ao alvo intermediário, embora alcance o fim da janela.
  const accel = (/** @type {number} */ a) => sandHitTick(() => {
    C.world.sandWave.speedFromReach = 1;C.world.sandWave.waveAccel = a;
  }, [vec(0, -4), vec(0, -2.5)]);
  const flat = accel(0), curved = accel(10);
  assert.ok(flat > 0 && curved >= flat + 3, `waveAccel 10 atrasa a chegada (${flat} → ${curved} ticks)`);
});

test('A/B Sand Wave: impulso, duração, limpeza e cancelamento do empurrão', () => {
  const impulse = (/** @type {number} */ ps) => {
    const g = docArena();
    const f = g.fighters[1];f.position = vec(0, -3.5);
    const e = sandEntity({pushSpeed: ps, accel: 0});
    g.world.entities.push(e);sandStepAt(g, e, .2);
    return f.locomotionVelocity.z;
  };
  assert.equal(impulse(0), 0, 'pushSpeed 0 preserva o comportamento sem impulso');
  assert.ok(impulse(8) > 7.9, `pushSpeed 8 entra na velocidade de locomoção (${impulse(8).toFixed(2)} m/s)`);

  // Defesa perfeita anula o impulso; a parcial recebe partialFactor (0,5).
  const guarded = (/** @type {boolean} */ perfect) => {
    const g = docArena();
    const f = g.fighters[1];f.position = vec(0, -3.5);f.guard = true;f.perfectLeft = perfect ? 1 : 0;f.facing = Math.PI;
    const e = sandEntity({pushSpeed: 8, accel: 0});
    g.world.entities.push(e);sandStepAt(g, e, .2);
    return f.locomotionVelocity.z;
  };
  assert.equal(guarded(true), 0, 'defesa perfeita anula o pushSpeed');
  assert.ok(Math.abs(guarded(false) - 4) < 1e-9, 'defesa parcial aplica partialFactor 0,5 ao pushSpeed');

  const lasts = (/** @type {number} */ seconds) => {
    const g = docArena();
    const f = g.fighters[1];f.position = vec(0, -3.5);
    const e = sandEntity({pushDuration: seconds, accel: 12});
    g.world.entities.push(e);
    sandStepAt(g, e, .2);sandStepAt(g, e, .25);sandStepAt(g, e, .31);
    return !!f.sandPush;
  };
  assert.equal(lasts(.1), false, 'pushDuration 0,1 s desliga o empurrão contínuo depois de 0,11 s');
  assert.equal(lasts(0), true, 'pushDuration 0 mantém o empurrão enquanto houver contato');

  const clears = (/** @type {number} */ toggle) => {
    const g = docArena();
    const f = g.fighters[1];f.position = vec(0, -3.5);f.locomotionVelocity = {x: 0, z: -5};
    const e = sandEntity({pushClearsLocomotion: toggle});
    g.world.entities.push(e);sandStepAt(g, e, .2);
    return f.locomotionVelocity.z;
  };
  assert.equal(clears(1), 0, 'pushClearsLocomotion 1 zera a velocidade própria');
  assert.equal(clears(0), -5, 'pushClearsLocomotion 0 conserva a velocidade própria');

  const dodge = (/** @type {number} */ toggle) => {
    const g = docArena();
    const f = g.fighters[1];f.position = vec(0, -3.5);
    f.action = {kind: 'dodge', elapsed: .3, invulnerableFor: 0, heading: 0};
    const e = sandEntity({pushCancelsDodge: toggle});
    g.world.entities.push(e);sandStepAt(g, e, .2);
    return f.action;
  };
  assert.equal(dodge(1), null, 'pushCancelsDodge 1 interrompe a esquiva');
  assert.equal(dodge(0)?.kind, 'dodge', 'pushCancelsDodge 0 deixa a esquiva continuar');
});

test('A/B Sand Wave: cegueira na parcial, alvo aéreo, stagger e limite de alvos', () => {
  const partial = (/** @type {number} */ on) => {
    const g = docArena({equip: ['sand-wave'], positions: [vec(0, -4), vec(0, -1.5)]});
    C.world.sandWave.blindOnPartial = on;
    g.step(cmd(press0), cmd({guard: true, guardPressed: true}));
    for (let i = 1; i < secs(1.2); i++) g.step(cmd(), cmd({guard: true}));
    const r = g.fighters[1];
    return {blind: r.statuses.some(s => s.id === 'blind'), loss: r.attributes.hp - r.hp};
  };
  const yes = partial(1), no = partial(0);
  assert.ok(yes.loss > 0 && no.loss > 0, 'a defesa parcial continua recebendo dano reduzido');
  assert.equal(yes.blind, true, 'blindOnPartial 1 cega na defesa parcial');
  assert.equal(no.blind, false, 'blindOnPartial 0 não cega na defesa parcial');

  const air = (/** @type {number} */ toggle) => {
    const g = docArena();
    const f = g.fighters[1];f.position = vec(0, -3.5);
    f.flight = {y: .1, vy: 0, horizontal: {x: 0, z: 0}, gravity: 0};
    const e = sandEntity({hitsAirborne: toggle});
    g.world.entities.push(e);sandStepAt(g, e, .2);
    return !!e.targets[f.id];
  };
  assert.equal(air(0), false, 'hitsAirborne 0 ignora alvo em voo');
  assert.equal(air(1), true, 'hitsAirborne 1 acerta alvo em voo baixo');

  const wall = (/** @type {number} */ toggle) => {
    const g = docArena();
    const f = g.fighters[1];f.position = vec(0, -2);
    const e = sandEntity({wallStaggerOn: toggle, wallPressMinSpeed: .1, wallPressMoveRatio: .9});
    g.world.entities.push(e);
    const events = [];
    f.locomotionVelocity = {x: 0, z: 2};sandStepAt(g, e, .5, events);
    f.locomotionVelocity = {x: 0, z: 2};sandStepAt(g, e, .5 + 1 / 120, events);
    f.locomotionVelocity = {x: 0, z: 2};f.position = vec(0, f.position.z + .5 * 2 / 120);sandStepAt(g, e, .5 + 2 / 120, events);
    return events.filter(x => x.result === 'sandStagger').length;
  };
  assert.equal(wall(1), 1, 'wallStaggerOn 1 aplica stagger de parede');
  assert.equal(wall(0), 0, 'wallStaggerOn 0 só empurra, sem stagger');

  // wallPressStopRatio: no 3º passo a intenção cai a zero; só há stagger se 0 < ratio × 2.
  const stopRatio = (/** @type {number} */ ratio) => {
    const g = docArena();
    const f = g.fighters[1];f.position = vec(0, -2);
    const e = sandEntity({wallPressMinSpeed: .1, wallPressMoveRatio: 0, wallPressStopRatio: ratio});
    g.world.entities.push(e);
    const events = [];
    f.locomotionVelocity = {x: 0, z: 2};sandStepAt(g, e, .5, events);
    f.locomotionVelocity = {x: 0, z: 2};sandStepAt(g, e, .5 + 1 / 120, events);
    f.locomotionVelocity = {x: 0, z: 0};sandStepAt(g, e, .5 + 2 / 120, events);
    return events.filter(x => x.result === 'sandStagger').length;
  };
  assert.equal(stopRatio(.3), 1, 'stopRatio 0,3 reconhece a intenção zerada como parede');
  assert.equal(stopRatio(0), 0, 'stopRatio 0 exige queda estritamente abaixo de zero e não dispara');

  // wallUnpinDistance: depois do stagger, um deslocamento de 0,2 m solta (ou não) o estado «prensado».
  const unpin = (/** @type {number} */ dist) => {
    const g = docArena();
    const f = g.fighters[1];f.position = vec(0, -2);
    const e = sandEntity({wallPressMinSpeed: .1, wallPressMoveRatio: .9, wallUnpinDistance: dist});
    g.world.entities.push(e);
    f.locomotionVelocity = {x: 0, z: 2};sandStepAt(g, e, .5);
    f.locomotionVelocity = {x: 0, z: 2};sandStepAt(g, e, .5 + 1 / 120);
    f.locomotionVelocity = {x: 0, z: 0};f.position = vec(0, f.position.z + .5 * 2 / 120);sandStepAt(g, e, .5 + 2 / 120);
    f.locomotionVelocity = {x: 0, z: 0};f.position = vec(0, f.position.z + .2);sandStepAt(g, e, .5 + 3 / 120);
    return e.targets[1].pinned;
  };
  assert.equal(unpin(.01), false, 'unpin 1 cm solta com 20 cm de deslocamento');
  assert.equal(unpin(.5), true, 'unpin 0,5 m mantém prensado com 20 cm');

  const targets = (/** @type {number} */ max) => {
    const g = docArena();
    const f1 = g.fighters[1];f1.position = vec(0, -3.5);
    const f2 = structuredClone(f1);f2.id = 2;f2.position = vec(.4, -3.4);f2.hp = f2.attributes.hp;f2.statuses = [];f2.action = null;f2.flight = null;f2.sandPush = null;
    g.fighters.push(f2);
    const e = sandEntity({maxTargets: max});
    g.world.entities.push(e);sandStepAt(g, e, .2);
    return Object.keys(e.targets).length;
  };
  assert.equal(targets(1), 1, 'maxTargets 1 atinge só um alvo');
  assert.equal(targets(2), 2, 'maxTargets 2 atinge os dois alvos');
});

test('Herança do Sand Wave: física, lançamento, mundo e fórmulas calculadas coerentes', () => {
  resetConfig(defaults());
  const sw = /** @type {any} */ (EDITABLE_MOVES.find(m => m.id === 'sand-wave'));
  const inherited = getInheritedParamsForMove('sand-wave', sw.group, {tackle: C.actions.tackle});
  const paths = inherited.map(i => i.path);
  for (const p of ['locomotion.friction', 'locomotion.accelCurve', 'locomotion.brakeCurve', 'locomotion.residualSpeed', 'rules.launchGravity', 'rules.launchDrag', 'extras.toggles.enableLaunch', 'world.maxEntities']) {
    assert.ok(paths.includes(p), `${p} exposto como herdado do Sand Wave`);
  }

  const count = (/** @type {number} */ max) => {
    const g = docArena({equip: ['sand-wave'], positions: [vec(0, -4), vec(0, -1)]});
    C.world.maxEntities = max;
    spawn(g.world, {kind: 'wall', pos: {x: 0, z: -1}, hx: 4, hz: .3, angle: 0, y: 0, height: 3}, []);
    g.step(cmd(press0), cmd());run(g, 34);
    return g.world.entities.filter(e => e.kind === 'sandwave').length;
  };
  assert.equal(count(1), 0, 'world.maxEntities 1 (já ocupado por uma parede) recusa a barragem');
  assert.equal(count(2), 1, 'world.maxEntities 2 permite a barragem');

  C.world.sandWave.speedFromReach = 1;
  const calc = getCalculatedValuesForMove('sand-wave', 'sandWave', C.world);
  const byId = Object.fromEntries(calc.map(c => [c.id, c]));
  assert.match(byId.v0.formula, /waveAccel/, 'v₀ usa waveAccel, não accel');
  assert.match(byId.vf.formula, /waveAccel/, 'v_f usa waveAccel, não accel');
  assert.equal(byId.v0.value, '13.33 m/s', 'v₀ padrão = 10 ÷ 0,75');
  assert.equal(byId.vf.value, '13.33 m/s', 'v_f padrão = v₀ (sem aceleração da frente)');
});

console.log(`\n${passed} passaram, ${failed} falharam`);
if (failed > 0) process.exit(1);
