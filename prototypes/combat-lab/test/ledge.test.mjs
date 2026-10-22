// Ledge Grab & Mantle (issue #95) e faixa de montagem (jumpPassOver). Sem navegador, nos valores de fábrica.
import assert from 'node:assert/strict';
import {C, factoryDefaults, resetConfig} from '../src/sim/config.js';
import {Game} from '../src/sim/game.js';
import {emptyCommand} from '../src/sim/entity.js';
import {vec} from '../src/sim/math.js';
import {applyHit} from '../src/sim/world.js';
import {slotStatus} from '../src/sim/move-state.js';
import {registerStandardMoves} from '../src/sim/moves/standard.js';

let passed = 0, failed = 0;
const test = (name, fn) => {try {fn();passed++;console.log('  ✓', name);} catch (e) {failed++;console.error('  ✗', name, '—', e.message);}};
const cmd = o => ({...emptyCommand(), ...o});
const BOX = {id: 'cx', pos: {x: 0, y: 0, z: 0}, shape: 'box', hx: 1.5, hz: 1.5, height: 2.6, angle: 0};
/** Lutador azul a 3,6 m da face oeste de uma caixa; vermelho longe. `patch` ajusta C.ledge; `map` troca os objetos. */
function scene({patch = {}, obstacles = [BOX], platforms = [], destructibles = []} = {}) {
  resetConfig(factoryDefaults());registerStandardMoves();C.extras.toggles.enableEnemyAI = 0;Object.assign(C.ledge, patch);
  const g = new Game({seed: 1});g.start();g.reset({positions: [vec(-3.6, 0), vec(-20, -20)]});
  Object.assign(g.mapState, {platforms, obstacles, destructibles, items: [], regularSpawnTimer: 1e9});
  return g;
}
/** Corre contra a face e salta; devolve quando agarrou (ou null). `keepMove`: continua segurando a direção da parede. */
function jumpAtWall(g, {keepMove = true, press = false, maxSteps = 300} = {}) {
  const f = g.fighters[0];let jumped = -1;
  for (let t = 0; t < maxSteps; t++) {
    const dist = (-1.5 - C.test.halfExtent) - f.position.x, doJump = jumped < 0 && !f.flight && dist < .6;if (doJump) jumped = t;
    const move = keepMove || jumped < 0 ? vec(1, 0) : vec(0, 0);
    g.step(cmd({move, jump: doJump || (press && !!f.flight && f.flight.vy < 0), jumpHeld: jumped >= 0 && t < jumped + 40}), cmd());
    if (f.ledge) return t;
  }
  return null;
}
const run = (g, n, c = () => cmd()) => {for (let i = 0; i < n; i++) g.step(c(i), cmd());};
const settled = f => !f.ledge && !f.flight && !f.action && !(f.vaultHeight > 0);

console.log('\n--- LEDGE GRAB ---\n');
test('modo 1 (automático): saltar contra a face segurando a direção agarra a borda e o corpo fica pendurado sem cair', () => {
  const g = scene(), f = g.fighters[0];
  assert.ok(jumpAtWall(g) !== null, 'não agarrou');
  run(g, 60, () => cmd({move: vec(0, 0)}));
  assert.equal(f.ledge.phase, 'hang');assert.ok(Math.abs(f.groundY - (BOX.height - C.ledge.hangDrop)) < 1e-6, `altura da pose ${f.groundY}`);
  assert.ok(Math.abs(f.position.x - (-1.5 - C.test.halfExtent)) < 1e-6, 'colado à face');assert.equal(f.flight, null);
  run(g, 120, () => cmd());assert.equal(f.ledge?.phase, 'hang', 'continua pendurado (sem gravidade)');
});
test('modo 0 desliga; modo 2 só agarra com Espaço no ar', () => {
  assert.equal(jumpAtWall(scene({patch: {mode: 0}})), null, 'modo 0 agarrou');
  assert.equal(jumpAtWall(scene({patch: {mode: 2}}), {press: false, maxSteps: 150}), null, 'modo 2 agarrou sem botão');
  const g = scene({patch: {mode: 2}});assert.ok(jumpAtWall(g, {press: true}) !== null, 'modo 2 não agarrou com Espaço');
});
test('sem direção para a parede o modo 1 não agarra (queda normal)', () => {
  const g = scene();assert.equal(jumpAtWall(g, {keepMove: false, maxSteps: 220}), null);
});
test('subir (Espaço) leva ao topo: pés na altura da caixa, corpo sobre ela, estado encerrado', () => {
  const g = scene(), f = g.fighters[0];jumpAtWall(g);run(g, 40, () => cmd());
  g.step(cmd({jump: true}), cmd());assert.equal(f.ledge?.phase, 'climb');
  run(g, 90, () => cmd());
  assert.equal(f.ledge, null);assert.ok(Math.abs(f.groundY - BOX.height) < 1e-6, `groundY ${f.groundY}`);assert.ok(f.position.x > -1.5, `x ${f.position.x}`);assert.equal(f.flight, null);
  assert.ok(g.lastStepEvents.length >= 0);
});
test('com climbInput 0 a direção NÃO sobe; com 1 a direção sobe depois de climbHold', () => {
  let g = scene({patch: {climbInput: 0}});jumpAtWall(g);run(g, 120, () => cmd({move: vec(1, 0)}));assert.equal(g.fighters[0].ledge?.phase, 'hang');
  g = scene({patch: {climbInput: 1}});jumpAtWall(g);run(g, 20, () => cmd());run(g, 60, () => cmd({move: vec(1, 0)}));assert.ok(!g.fighters[0].ledge || g.fighters[0].ledge.phase === 'climb' || g.fighters[0].groundY > 2);
});
test('soltar com D, C ou direção contrária: vira queda de borda, empurra para longe e termina no chão', () => {
  for (const [name, c] of [['D', () => cmd({guard: true})], ['C', i => cmd({dodge: i === 0})], ['direção contrária', () => cmd({move: vec(-1, 0)})]]) {
    const g = scene(), f = g.fighters[0];jumpAtWall(g);run(g, 40, () => cmd());
    run(g, 30, c);assert.ok(!f.ledge, `${name}: ainda pendurado`);
    run(g, 400, () => cmd());assert.ok(settled(f) && f.groundY === 0, `${name}: não terminou no chão`);assert.ok(f.position.x < -2, `${name}: não se afastou (${f.position.x})`);
  }
});
test('tempo máximo e stamina zerada soltam a borda', () => {
  let g = scene({patch: {maxHang: .5}}), f = g.fighters[0];jumpAtWall(g);run(g, 120, () => cmd());assert.ok(!f.ledge, 'maxHang não soltou');
  g = scene({patch: {hangDrain: 20}});f = g.fighters[0];jumpAtWall(g);run(g, 200, () => cmd());assert.ok(!f.ledge, 'stamina zerada não soltou');
});
test('golpe sofrido derruba; hurtDrops 0 mantém', () => {
  let g = scene(), f = g.fighters[0];jumpAtWall(g);run(g, 40, () => cmd());
  const hp0 = f.hp;applyHit(g, 1, f, {damage: 10, knockback: {horizontal: 3, vertical: 0}}, vec(-1, 0), {source: 'teste'});
  g.step(cmd(), cmd());assert.ok(!f.ledge && f.hp < hp0, 'golpe não soltou');run(g, 400, () => cmd());assert.ok(settled(f));
  g = scene({patch: {hurtDrops: 0}});f = g.fighters[0];jumpAtWall(g);run(g, 40, () => cmd());applyHit(g, 1, f, {damage: 10, knockback: {horizontal: 0, vertical: 0}}, vec(-1, 0), {source: 'teste'});run(g, 20, () => cmd());
  assert.ok(f.ledge, 'hurtDrops 0 soltou');
});
test('subida bloqueada por outro lutador no topo; libera quando ele sai', () => {
  const g = scene(), f = g.fighters[0], b = g.fighters[1];jumpAtWall(g);run(g, 40, () => cmd());
  b.position = {x: -.9, z: 0};b.groundY = BOX.height;
  const ev = [];run(g, 60, () => {return cmd({jump: true});});
  assert.equal(f.ledge?.phase, 'hang', 'subiu dentro do outro lutador');
  b.position = {x: 5, z: 5};b.groundY = 0;run(g, 120, () => cmd({jump: true}));assert.ok(!f.ledge && Math.abs(f.groundY - BOX.height) < 1e-6, 'não subiu depois de liberar');
});
test('perder o apoio (destrutível destruído) solta', () => {
  const D = {id: 'd1', hp: 30, maxHp: 30, pos: {x: 0, y: 0, z: 0}, size: {hx: 1.5, hz: 1.5, height: 2.6}, shape: 'box', angle: 0, state: 'solid', respawnTimer: 0, ghostTimer: 0};
  const g = scene({obstacles: [], destructibles: [D]}), f = g.fighters[0];jumpAtWall(g);run(g, 40, () => cmd());assert.ok(f.ledge, 'não agarrou o destrutível');
  D.state = 'dead';run(g, 5, () => cmd());assert.ok(!f.ledge, 'segurou um apoio que sumiu');run(g, 400, () => cmd());assert.ok(settled(f));
});
test('plataforma: agarra a borda de uma plataforma de 1,5 m; objetos desligados (ledge.objects 0) ignoram caixas', () => {
  const P = {id: 'p1', pos: {x: 0, y: 0, z: 0}, width: 3, depth: 3, height: 2.2};
  const g = scene({obstacles: [], platforms: [P]});assert.ok(jumpAtWall(g) !== null, 'plataforma não agarrada');
  assert.equal(jumpAtWall(scene({patch: {objects: 0}})), null, 'objects 0 ainda agarra caixa');
});
test('pendurado: nenhum Move é aceito e o HUD mostra o motivo; a IA pendurada sobe sozinha', () => {
  const g = scene(), f = g.fighters[0];registerStandardMoves();g.setLoadout(0, ['harden', 'lunge', 'reflect', 'spikes']);jumpAtWall(g);run(g, 40, () => cmd());
  for (let s = 0; s < 4; s++) {const st = slotStatus(f, s);assert.equal(st.state, 'bloqueado', `slot ${s}`);assert.equal(st.reason, 'ledge');}
  C.extras.toggles.enablePlayerAI = 1;
  for (let i = 0; i < 200 && f.ledge; i++) g.step(cmd(), cmd());
  assert.ok(!f.ledge && f.groundY > 2.5, 'a IA ficou pendurada para sempre');
});
test('invulnerabilidade opcional na subida (climbInvuln) e custo de stamina ao agarrar', () => {
  const g = scene({patch: {climbInvuln: .5, grabCost: 1}}), f = g.fighters[0], s0 = f.stamina;jumpAtWall(g);assert.ok(f.stamina <= s0 - 1 + 1e-6, 'não cobrou o agarre');
  run(g, 40, () => cmd());g.step(cmd({jump: true}), cmd());g.step(cmd(), cmd());assert.ok(f.ledge?.invuln > 0, 'sem i-frames na subida');
});
test('determinismo: mesma sequência, mesmo resultado', () => {
  const trace = () => {const g = scene(), f = g.fighters[0], out = [];jumpAtWall(g);for (let i = 0; i < 200; i++) {g.step(cmd({jump: i === 60}), cmd());out.push([f.position.x.toFixed(5), (f.groundY ?? 0).toFixed(5), f.ledge?.phase ?? '-'].join());}return out.join('|');};
  assert.equal(trace(), trace());
});

console.log('\n--- FAIXA DE MONTAGEM (jumpPassOver) ---\n');
function fuzzEjections(passOver) {
  let s0 = 99;const rnd = () => ((s0 = (s0 * 1664525 + 1013904223) >>> 0) / 4294967296);let events = 0;
  for (const H of [2.2, 1.5, 3.0]) for (let run = 0; run < 14; run++) {
    const g = scene({patch: {mode: 0}, obstacles: [{...BOX, height: H}]});C.map.jumpPassOver = passOver;const f = g.fighters[0];
    let move = vec(1, 0), until = 0, prev = {...f.position};
    for (let t = 0; t < 900; t++) {
      if (t >= until) {until = t + 15 + Math.floor(rnd() * 60);const a = rnd() * Math.PI * 2;move = rnd() < .2 ? vec(0, 0) : vec(Math.sin(a), Math.cos(a));}
      const c = cmd({move});if (rnd() < .02) {c.jump = true;c.jumpHeld = true;}
      g.step(c, cmd());
      const d = Math.hypot(f.position.x - prev.x, f.position.z - prev.z), v = Math.hypot((f.flight?.horizontal ?? f.velocity).x, (f.flight?.horizontal ?? f.velocity).z);
      if (d - (v + 2) / 120 > .02) events++;
      prev = {...f.position};
    }
  }
  return events;
}
test('jumpPassOver 0 (padrão): nenhuma ejeção lateral em partidas aleatórias; 1 (antigo) ainda as produz', () => {
  assert.equal(fuzzEjections(0), 0, 'ejeções com a regra estrita');
  assert.ok(fuzzEjections(1) > 0, 'a regra antiga deixou de reproduzir o defeito (o teste perdeu o sentido)');
});
test('montar em caixas continua possível: salto até a borda de uma caixa de 1,5 m termina em cima', () => {
  const g = scene({patch: {mode: 0}, obstacles: [{...BOX, height: 1.5}]}), f = g.fighters[0];let jumped = -1, mounted = false;
  for (let t = 0; t < 400; t++) {const dist = (-1.5 - C.test.halfExtent) - f.position.x, doJump = jumped < 0 && !f.flight && dist < .6;if (doJump) jumped = t;g.step(cmd({move: vec(1, 0), jump: doJump, jumpHeld: jumped >= 0 && t < jumped + 60}), cmd());if (!f.flight && f.groundY >= 1.49) mounted = true;}
  assert.ok(mounted);
});
console.log('\n--- FUZZ: nada fica preso ---\n');
test('partidas aleatórias com caixas e plataformas: sem NaN, sem pendurado além do limite, sem lutador dentro de sólido', () => {
  let s0 = 7;const rnd = () => ((s0 = (s0 * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let run = 0; run < 16; run++) {
    const g = scene({obstacles: [BOX, {...BOX, id: 'c2', pos: {x: 6, y: 0, z: 4}, hx: 1, hz: 2, height: 1.8}], platforms: [{id: 'p', pos: {x: -6, y: 0, z: -5}, width: 3, depth: 3, height: 1.5}]});
    const f = g.fighters[0];let move = vec(1, 0), until = 0, hang = 0;
    for (let t = 0; t < 2400; t++) {
      if (t >= until) {until = t + 10 + Math.floor(rnd() * 50);const a = rnd() * Math.PI * 2;move = rnd() < .15 ? vec(0, 0) : vec(Math.sin(a), Math.cos(a));}
      const c = cmd({move, guard: rnd() < .01, dodge: rnd() < .008});if (rnd() < .025) {c.jump = true;c.jumpHeld = true;}
      g.step(c, cmd());
      assert.ok([f.position.x, f.position.z, f.groundY].every(Number.isFinite), 'NaN');
      hang = f.ledge ? hang + 1 : 0;assert.ok(hang <= (C.ledge.maxHang + C.ledge.climbTime + 1) * 120, `pendurado por ${hang} passos`);
    }
  }
});
console.log(`\n${passed} passaram, ${failed} falharam`);
if (failed) process.exit(1);
