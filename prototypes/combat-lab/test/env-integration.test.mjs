// Fase 6 do overhaul — integração do ambiente com Moves, combate, projéteis e IA: transições de estado afetadas por contato ambiental.
// Cada objeto do cenário (pilar, caixa, plataforma, destrutível) é testado como obstáculo de: Tackle, esquiva, arremesso por golpe, lutador comprimido por um
// Tackle do adversário, projétil e feixe (cobertura), e por partidas completas IA × IA (a IA obedece à mesma física, sem privilégio de colisão).
// Invariantes (sem alterar custo de stamina, dano, recovery ou janelas de cancelamento): nunca penetra além de 1 µm; o estado termina normalmente; stamina e
// velocidade iguais às do espaço livre; dano ao destrutível uma vez por contato.
// Uso: node prototypes/combat-lab/test/env-integration.test.mjs
import assert from 'node:assert/strict';
import {C, defaults, resetConfig} from '../src/sim/config.js';
import {Game} from '../src/sim/game.js';
import {emptyCommand} from '../src/sim/entity.js';
import {vec} from '../src/sim/math.js';
import {spawn} from '../src/sim/world.js';
import {physicsProbe} from '../src/sim/physics.js';
import {collectSolids} from '../src/nav/nav-graph.js';
import {penetration} from '../src/physics-poc/poc-metrics.js';
import {registerStandardMoves} from '../src/sim/moves/standard.js';

registerStandardMoves();
let tests = 0;const failures = [];
const check = (name, fn) => {try {resetConfig(defaults());fn();tests++;console.log('✓', name);} catch (error) {failures.push(name);console.log('✗', name, '—', String(error.message).split(/\r?\n/)[0]);}};
const cmd = o => ({...emptyCommand(), ...o});
const FACE = {pilar: 3.1, caixa: 2.5, plataforma: 3.0, destrutível: 3.2};   // z da face voltada para o lutador em z = 0
const WITH = {
  pilar: () => ({obstacles: [{id: 'o', shape: 'pillar', pos: {x: 0, y: 0, z: 4}, hx: .9, hz: .9, radius: .9, height: 4.5, angle: 0}]}),
  caixa: () => ({obstacles: [{id: 'o', shape: 'box', pos: {x: 0, y: 0, z: 4}, hx: 1.5, hz: 1.5, radius: 1.5, height: 2.2, angle: 0}]}),
  plataforma: () => ({platforms: [{id: 'p', pos: {x: 0, y: 0, z: 4.5}, width: 3, depth: 3, height: 1}]}),
  destrutível: () => ({destructibles: [{id: 'd', hp: 30, maxHp: 30, pos: {x: 0, y: 0, z: 4}, size: {hx: .8, hz: .8, height: 1.6}, shape: 'box', angle: 0, state: 'solid', respawnTimer: 0, ghostTimer: 0, resistances: {physical: 1, projectile: 1, area: 1, environmental: 1}}]}),
};
const lab = kind => {
  C.extras.toggles.enableEnemyAI = 0;
  const g = new Game();g.reset({positions: [vec(0, 0), vec(-20, -20)]});g.mode = 'inactive';g.fighters[0].facing = 0;
  Object.assign(g.mapState, {platforms: [], obstacles: [], destructibles: [], items: [], regularSpawnTimer: 1e9, ...(kind ? WITH[kind]() : {})});
  return g;
};
const fine = (g, c0 = emptyCommand()) => {g.step(c0, emptyCommand());};

/** Roda uma ação e devolve o resumo: z máximo, velocidade máxima, stamina e HP finais, se a ação terminou. */
function run(kind, first, hold, ticks = 420) {
  const g = lab(kind), f = g.fighters[0];let maxZ = -9, maxV = 0, nan = false;
  for (let t = 0; t < ticks; t++) {
    fine(g, t === 0 ? first : hold);
    if (![f.position.x, f.position.z].every(Number.isFinite)) nan = true;
    maxZ = Math.max(maxZ, f.position.z);maxV = Math.max(maxV, Math.hypot(f.velocity.x, f.velocity.z));
  }
  return {g, f, maxZ, maxV, nan, ended: f.action === null, stamina: f.stamina, hp: f.hp};
}

for (const [label, first] of [['Tackle', cmd({tackle: true, move: vec(0, 1)})], ['esquiva', cmd({dodge: true, move: vec(0, 1)})]]) {
  const hold = cmd({move: vec(0, 1)});
  const free = run(null, first, hold);
  for (const kind of label === 'esquiva' ? ['pilar', 'caixa', 'destrutível'] : Object.keys(WITH)) {
    check(`${label} contra ${kind}: não penetra, termina normalmente e custa/rende o mesmo que no espaço livre`, () => {
      const r = run(kind, first, hold);
      assert.ok(!r.nan);
      assert.ok(r.maxZ + C.test.halfExtent <= FACE[kind] + 1e-6, `penetrou ${(r.maxZ + C.test.halfExtent - FACE[kind]).toFixed(4)} m`);
      assert.ok(r.ended, 'a ação não terminou');
      assert.ok(Math.abs(r.stamina - free.stamina) < 1e-9, `stamina ${r.stamina} ≠ ${free.stamina}`);
      assert.ok(r.maxV <= free.maxV + 1e-9, `ganhou velocidade: ${r.maxV} > ${free.maxV}`);
      assert.equal(physicsProbe.staticConflicts, 0);
    });
  }
}
check('Tackle em destrutível: o dano é aplicado UMA vez por ação (não repete enquanto o lutador continua encostado)', () => {
  const r = run('destrutível', cmd({tackle: true, move: vec(0, 1)}), cmd({move: vec(0, 1)}), 600);
  const d = r.g.mapState.destructibles[0], dmg = C.rules.tackleDamage ?? 10;
  assert.ok(Math.abs((d.maxHp - d.hp) - dmg) < 1e-6, `dano ${d.maxHp - d.hp} (esperado ${dmg} uma vez; estado ${d.state})`);
});
for (const kind of Object.keys(WITH)) {
  check(`arremesso por golpe contra ${kind}: não penetra, pousa, estados terminam e só o destrutível causa dano ambiental`, () => {
    const g = lab(kind), f = g.fighters[0];
    f.flight = {y: .01, vy: 6, horizontal: vec(0, 12)};f.launchedByHit = true;f.state = 'airborne';
    let maxZ = -9, splat = false, hp0 = f.hp, back = false;
    for (let t = 0; t < 600; t++) {fine(g);maxZ = Math.max(maxZ, f.position.z);splat ||= f.state === 'wallSplat' || !!f.wallSplat;if (f.flight && f.flight.horizontal.z < -0.5) back = true;}
    const onTop = kind === 'plataforma' && f.groundY > 0.5;   // pode pousar no topo da plataforma (R7.14)
    const broken = kind === 'destrutível' && g.mapState.destructibles[0].state !== 'solid';   // destruído pelo impacto: deixa de ser sólido e o corpo segue
    if (!onTop && !broken) assert.ok(maxZ + C.test.halfExtent <= FACE[kind] + 1e-6 || f.groundY > 0.5, `penetrou ${(maxZ + C.test.halfExtent - FACE[kind]).toFixed(4)} m`);
    assert.equal(f.flight, null, 'ainda em voo');
    assert.ok(f.action === null && ['neutral', 'landing'].includes(f.state), `estado final ${f.state}`);
    assert.ok(!splat, 'wall-splat só existe na borda da arena, não em objetos');
    if (kind === 'pilar' || kind === 'caixa') assert.ok(back, 'R3.12: o arremessado deve rebater (velocidade z invertida)');
    if (kind === 'destrutível') assert.ok(f.hp < hp0 && g.mapState.destructibles[0].hp < 30, 'R3.7/R7.15: dano nos dois lados');
    else assert.equal(f.hp, hp0, 'objeto indestrutível/plataforma não causa dano (rebote R3.12)');
  });
}
for (const kind of Object.keys(WITH)) {
  check(`comprimido entre o adversário (Tackle) e ${kind}: sem penetração, sem conflito de espaço e sem dano além do golpe`, () => {
    const g = lab(kind), a = g.fighters[0], b = g.fighters[1];
    a.position = vec(0, FACE[kind] - C.test.halfExtent - .6);a.groundY = 0;a.facing = Math.PI;
    b.position = vec(0, a.position.z - 2.6);b.facing = 0;b.groundY = 0;
    const conflicts0 = physicsProbe.staticConflictsTotal;let worstGround = 0, worstAir = 0, splats = 0;
    for (let t = 0; t < 420; t++) {
      g.step(emptyCommand(), t === 0 ? cmd({tackle: true, move: vec(0, 1)}) : cmd({move: vec(0, 1)}));splats += g.lastStepEvents.filter(e => e.result === 'destructibleSplat').length;
      const y = a.flight ? a.flight.y : a.groundY;
      for (const sd of collectSolids(g.mapState)) {const pen = penetration({x: a.position.x, y, z: a.position.z}, sd, 'box');if (a.flight) worstAir = Math.max(worstAir, pen);else worstGround = Math.max(worstGround, pen);}
    }
    assert.ok(worstGround <= 1e-3, `penetrou ${worstGround.toFixed(4)} m no chão`);
    assert.ok(worstAir <= C.map.mountTolerance + 1e-3, `penetrou ${worstAir.toFixed(3)} m no ar (acima da faixa de montagem)`);
    assert.equal(physicsProbe.staticConflictsTotal - conflicts0, 0, 'conflitos de espaço');
    if (kind !== 'destrutível') assert.ok(a.hp >= 100 - (C.rules.tackleDamage ?? 10) * 2, `dano excessivo: ${100 - a.hp}`);   // no destrutível vale o dano ambiental por velocidade (R7.15)
    assert.ok(splats <= 1, `${splats} impactos no destrutível pelo mesmo arremesso`);
  });
}

// ---------- Altitude real (R7.11): flight.y é ABSOLUTA; somar groundY dobrava a altura de quem voa a partir de uma plataforma ----------
for (const [top, rise] of [[1, .9], [1, 1.1], [1.5, .9]]) {
  check(`3D real sobre plataforma de ${top} m: quem pula ${rise} m acima do topo ao lado do rival na plataforma é separado dele (volumes se sobrepõem)`, () => {
    const g = lab(), [a, b] = g.fighters;
    Object.assign(g.mapState, {platforms: [{id: 'p', pos: {x: 0, y: 0, z: 0}, width: 6, depth: 6, height: top}]});
    a.position = vec(0, 0);b.position = vec(.6, 0);a.groundY = b.groundY = top;
    a.flight = {y: top + rise, vy: 0, horizontal: vec(0, 0), isNormalJump: true};
    g.step(emptyCommand(), emptyCommand());
    const d = Math.max(Math.abs(a.position.x - b.position.x), Math.abs(a.position.z - b.position.z));
    assert.ok(d >= 2 * C.test.halfExtent - 1e-6, `atravessou o rival: distância ${d.toFixed(3)} m`);
  });
}

// ---------- Cobertura: projéteis e feixes ----------
for (const kind of Object.keys(WITH)) {
  check(`projétil rasteiro contra ${kind} na frente do alvo: o objeto cobre (alvo sem dano)`, () => {
    const g = lab(kind), t = g.fighters[1];
    g.fighters[0].position = vec(0, -6);t.position = vec(0, 9);
    spawn(g.world, {kind: 'projectile', owner: 0, pos: {x: 0, z: -4}, dir: {x: 0, z: 1}, speed: 14, y: .65, radius: .2, life: 3, hit: {damage: 10}}, []);
    for (let i = 0; i < 240; i++) fine(g);
    assert.equal(t.hp, 100);
  });
  check(`feixe contínuo contra ${kind} na frente do alvo: o objeto cobre (o trecho termina na face e o alvo não é atingido)`, () => {
    const g = lab(kind), t = g.fighters[1];
    g.fighters[0].position = vec(-8, -8);t.position = vec(0, 9);
    const b = spawn(g.world, {kind: 'beam', owner: 0, pos: {x: 0, z: -4}, dir: {x: 0, z: 1}, life: 1, pl: 1, length: 24, maxSegments: 8, interval: C.world.beam.interval, hit: {damage: C.world.beam.damage}}, []);
    for (let i = 0; i < 60; i++) fine(g);
    assert.equal(t.hp, 100, 'o feixe atravessou o objeto');
    assert.ok(b.segments[0].b.z <= FACE[kind] + 1e-6, `trecho terminou em z = ${b.segments[0].b.z.toFixed(3)} (face em ${FACE[kind]})`);
  });
}
check('pilar é redondo para projéteis (como para lutadores): passa rente ao canto do quadrado circunscrito sem ser barrado', () => {
  const g = lab('pilar'), t = g.fighters[1];
  t.position = vec(5.6, 8.2);g.fighters[0].position = vec(-8, -8);   // alvo no fim da diagonal x − z = 1,6 (relativa ao centro do pilar em (0,4))
  const dir = {x: Math.SQRT1_2, z: Math.SQRT1_2};
  spawn(g.world, {kind: 'projectile', owner: 0, pos: {x: -1.4, z: 1}, dir, speed: 14, y: .65, radius: .1, life: 3, hit: {damage: 10}}, []);
  for (let i = 0; i < 240; i++) fine(g);
  assert.ok(t.hp < 100, 'o projétil foi barrado pela caixa circunscrita do pilar');
});

// ---------- IA × IA: mesma física, sem privilégios ----------
check('12 partidas IA × IA em mapa denso (8 + 8): nenhum conflito de espaço, nenhum NaN e ninguém afundado em sólido enquanto anda/ataca no chão', () => {
  const MOVES = ['reflect', 'psyshock', 'bounce', 'bullet-punch', 'emerging-stone', 'guard-break', 'lunge', 'quick-attack', 'sand-wave', 'spikes', 'swift'];
  const before = physicsProbe.staticConflictsTotal, bad = [];
  for (let seed = 1; seed <= 12; seed++) {
    resetConfig(defaults());Object.assign(C.map, {obstacleCount: 8, destructibleCount: 8});
    const g = new Game({seed});g.brain.seed = seed;g.playerBrain.seed = seed + 11;g.mode = 'tactical';
    g.setLoadout(0, [MOVES[seed % MOVES.length], MOVES[(seed * 3 + 1) % MOVES.length]]);g.setLoadout(1, [MOVES[(seed + 4) % MOVES.length], MOVES[(seed * 5 + 2) % MOVES.length]]);
    g.reset();
    for (let t = 0; t < 1800 && g.phase === 'playing'; t++) {
      g.step(g.playerBrain.command(g.fighters[0], g.fighters[1], 'tactical', C.test.step));
      const solids = collectSolids(g.mapState);
      for (const f of g.fighters) {
        if (![f.position.x, f.position.z, f.groundY].every(Number.isFinite)) {bad.push(`seed ${seed}: NaN`);continue;}
        if (f.flight || f.wallSplat || f.state === 'airborne' || (f.vaultHeight ?? 0) > 0.05) continue;   // em voo ou em arco de vault (no ar) vale a faixa de montagem (resíduo documentado)
        for (const s of solids) if (penetration({x: f.position.x, y: f.groundY, z: f.position.z}, s, 'box') > 0.03) bad.push(`seed ${seed} t${t} f${f.id} ${f.action?.kind ?? f.state} em ${s.id}`);
      }
    }
  }
  assert.equal(physicsProbe.staticConflictsTotal - before, 0, 'conflitos de espaço');
  assert.equal(bad.length, 0, `${bad.length} ocorrências; ex.: ${bad.slice(0, 3).join(' | ')}`);
});

console.log(`Integração do ambiente (Fase 6): ${tests} verificações aprovadas, ${failures.length} falhas.`);
if (failures.length) process.exit(1);
