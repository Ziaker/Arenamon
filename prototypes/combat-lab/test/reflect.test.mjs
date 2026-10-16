// Fase 2 (plano de Reflect/Psyshock) — Reflect, sem navegador. Cobre: M3.x, M4.1–M4.6, M5.1–M5.4, M7.6–M7.8, M13.1–M13.7,
// M14.1–M14.8, M17.2–M17.4, M19.2–M19.3, M19.7, M19.9, M26s.1–M26s.4, M29.2, M30.1, M30.4–M30.7 e o contrato M28.4.
// O Reflect é criado pelo fluxo real (segurar → soltar); projéteis e explosões de teste são entidades montadas aqui.
import assert from 'node:assert/strict';
import {C, defaults, resetConfig} from '../src/sim/config.js';
import {Game} from '../src/sim/game.js';
import {emptyCommand} from '../src/sim/entity.js';
import {vec, length} from '../src/sim/math.js';
import {clearMoves, getMove} from '../src/sim/moves.js';
import {clearEffects} from '../src/sim/move-effects.js';
import {registerStandardMoves} from '../src/sim/moves/standard.js';
import {spawn} from '../src/sim/world.js';
import {sweepBox, rectsOverlap} from '../src/sim/geometry.js';

let n = 0;const ok = l => {n++;console.log('✓', l);};
const cmd = o => ({...emptyCommand(), ...o});
const H = [true, false, false, false];
const near = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} ≠ ${b}`);
registerStandardMoves();
const events = [];
function arena({blue = vec(0, -3), red = vec(0, 3)} = {}) {
  resetConfig(defaults());events.length = 0;
  const g = new Game();g.mode = 'inactive';g.reset({positions: [blue, red]});g.fighters[0].facing = 0;g.fighters[1].facing = Math.PI;g.setLoadout(0, ['reflect']);return g;
}
const step = (g, c0 = cmd(), c1 = cmd()) => {g.step(c0, c1);events.push(...g.lastStepEvents);return g.lastStepEvents;};
const steps = (g, k, c0 = () => cmd(), c1 = () => cmd()) => {for (let i = 0; i < k; i++) step(g, c0(i), c1(i));};
/** Segura o botão por `ticks` passos e solta: devolve a barreira criada (ou undefined se falhou). */
function cast(g, ticks) {step(g, cmd({skill: 0, skillHeld: H}));steps(g, ticks - 1, () => cmd({skillHeld: H}));step(g, cmd());return g.world.entities.find(e => e.reflect);}
const barrier = (g, o = {}) => spawn(g.world, {kind: 'barrier', owner: 0, shape: 'box', pos: {x: 0, z: 0}, angle: 0, hx: 1, hz: .05, y: 0, height: 2, life: 5, hp: Infinity, blocksProjectiles: true, blocksFighters: true, blocksOwner: true,
  reflect: true, shields: true, breakableByTackle: true, breakableByBlast: true, pl: 1, captured: {tieTolerance: .001, maxReflections: 16, tackleRecoil: .15, tackleStagger: .25}, ...o}, []);
const shot = (g, o = {}) => spawn(g.world, {kind: 'projectile', owner: 1, pos: {x: 0, z: 2.5}, dir: {x: 0, z: -1}, y: .65, radius: .25, speed: 14, life: 3, pierce: 1, hit: {damage: 10}, ...o}, []);

// ---------- Criação: dimensões, posição, duração, PL ----------
{
  const g = arena(), f = g.fighters[0], b = cast(g, 2);
  assert.ok(b && b.kind === 'barrier' && b.owner === 0 && b.reflect, 'a soltura cria a barreira');
  near(b.hx * 2, 1.5 * (1 + (2 / 480) * 1), 1e-9);near(b.height, (1.5 + (2 / 480)) * 1.3, 1e-9);near(b.hz, .05);near(b.life, 4 + 2 / 120, 1e-9);assert.equal(b.pl, 1);
  near(b.pos.x, 0);near(b.pos.z, f.position.z + .5 + .5 + .05, 1e-9);near(b.angle, 0);near(b.y, 0);
  assert.ok(b.blocksFighters && b.blocksOwner && b.blocksProjectiles, 'sólida para os dois lutadores (M9.4)');
  assert.ok(events.some(e => e.result === 'chargeRelease') && f.moveCooldowns.reflect > 7.9 && f.moveRecovery > 0);
}
ok('criação na soltura: largura e altura mínimas com pouca carga, base no chão, distância livre de 50% da profundidade, 4 s + carga, PL1');
{
  const mid = cast(arena(), 240), max = cast(arena(), 480);
  near(mid.hx * 2, 2.25, 1e-9);near(mid.height, 2.6, 1e-9);near(mid.life, 6, 1e-9);assert.equal(mid.pl, 2);
  near(max.hx * 2, 3, 1e-9);near(max.height, 3.25, 1e-9);near(max.life, 8, 1e-9);assert.equal(max.pl, 3);
}
ok('crescimento com a carga: metade → 2,25 m × 2,6 m, 6 s, PL2; máxima → 3 m × 3,25 m, 8 s, PL3 (dimensões lógicas do motor, M30.4)');
{
  const g = arena(), b = cast(g, 480), f = g.fighters[0];
  const heading = b.angle;g.fighters[0].facing = 1.2;steps(g, 5);near(b.angle, heading, 1e-12);                   // orientação congelada na criação
  assert.ok(f.charge === null);
  const h = arena(), b2 = cast(h, 100), c = arena();c.fighters[0].facing = Math.PI / 2;const b3 = cast(c, 100);
  near(b3.angle, Math.PI / 2, .5);assert.ok(b3.pos.x > b2.pos.x + .5, 'acompanha a orientação do personagem durante a carga');
}
ok('a orientação acompanha o personagem durante a carga e congela ao materializar');
{
  // Falta de espaço (M13.6/M13.7/M26s.3): encolhe até o mínimo; sem o mínimo, falha e devolve a stamina.
  const g = arena({red: vec(1.4, -1.9)}), b = cast(g, 480);
  assert.ok(b.hx * 2 < 3 && b.hx * 2 >= 1.5 - 1e-9 && Math.abs(b.hx * 2 - 1.8) < .01, `maior retângulo válido ≈ 1,8 m (${b.hx * 2})`);
  const h = arena({red: vec(0, -1.5)}), s0 = h.fighters[0].stamina, b2 = cast(h, 480);
  assert.equal(b2, undefined);assert.ok(events.some(e => e.result === 'moveFailed' && e.reason === 'semEspaco'));
  near(h.fighters[0].stamina, s0, 1e-9);assert.equal(h.fighters[0].moveCooldowns.reflect, undefined, 'sem recarga');assert.equal(h.fighters[0].moveRecovery, 0);
  const w = arena({blue: vec(0, 15.2)});assert.equal(cast(w, 10), undefined, 'a barreira não pode sair da arena');
  const k = arena();spawn(k.world, {kind: 'wall', pos: {x: 0, z: -1.95}, hx: 5, hz: .3, y: 0, height: 2.2, life: Infinity}, []);assert.equal(cast(k, 10), undefined, 'parede é obstáculo');
}
ok('sem espaço: encolhe até o maior retângulo válido (mínimo 1,5×); sem o mínimo, nenhuma barreira, stamina devolvida, sem recarga; arena e paredes contam');

// ---------- Reflexão ----------
{
  const g = arena(), b = cast(g, 2), p = shot(g, {pl: 1, captured: {attackFraction: .2}}), ev = [];
  steps(g, 3);                                                              // a recuperação acaba antes do projétil chegar? (irrelevante: só observamos o projétil)
  let reflectedAt = null, hit = null;
  for (let i = 0; i < 90 && !p.dead; i++) {const e = step(g);if (!reflectedAt && e.some(x => x.result === 'reflected')) reflectedAt = {z: p.pos.z, owner: p.owner};hit = e.find(x => x.result === 'impact') ?? hit;}
  const r = events.find(e => e.result === 'reflected');
  assert.ok(r && r.face === 'front' && r.by === b.id && r.attacker === 0 && r.target === 1, 'refletida pela frente');assert.equal(p.origin, 1);assert.equal(reflectedAt.owner, 0, 'passa a ser do refletor (M2.7)');
  assert.ok(hit && hit.attacker === 0 && hit.target === 1, 'atinge o lançador original (M17.4)');
  near(g.fighters[1].hp, 100 - .2 * 20, 1e-9);void ev;                       // dano recalculado com o Ataque do refletor: 0,2 × 20 (M30.1)
  const h = arena();h.fighters[0].attributes.attack = 30;cast(h, 2);const q = shot(h, {captured: {attackFraction: .2}});steps(h, 90);assert.ok(q.dead);near(h.fighters[1].hp, 100 - 6, 1e-9);
}
ok('reflexão especular pela frente: o dono passa a ser o refletor, atinge o lançador original com o dano recalculado (0,2 × Ataque do refletor)');
{
  const g = arena(), b = cast(g, 2), e0 = b.hx;
  const p = shot(g, {pos: {x: -3, z: b.pos.z}, dir: {x: 1, z: 0}, y: .65});
  steps(g, 40);
  const r = events.find(e => e.result === 'reflected');
  assert.ok(r && r.face === 'edge', 'a borda reflete');assert.ok(p.vel.x < 0 && Math.abs(p.vel.z) < 1e-6, 'pela normal da borda: volta no mesmo eixo');void e0;
}
ok('a borda reflete pela própria normal');
{
  const g = arena(), b = cast(g, 2);
  const p = spawn(g.world, {kind: 'projectile', owner: 0, pos: {x: 0, z: -3.6}, dir: {x: 0, z: 1}, y: .65, radius: .25, speed: 14, life: 3, pierce: 1, hit: {damage: 10}}, []);
  steps(g, 60);
  assert.ok(!events.some(e => e.result === 'reflected'), 'pelo verso atravessa');assert.ok(p.dead && g.fighters[1].hp === 90, 'e segue até o adversário');
  assert.equal(p.through?.includes(b.id) || p.dead, true);
}
ok('pelo verso o projétil atravessa (e não reflete ao sair pela frente) e segue até o alvo');
{
  const g = arena({blue: vec(0, 8), red: vec(0, 9)});
  const bar = barrier(g, {pos: {x: 0, z: 0}, hx: 1, hz: .05}), r = .02, k = 1, c0 = {x: bar.hx + r, z: bar.hz + r};
  const p = spawn(g.world, {kind: 'projectile', owner: 1, pos: {x: c0.x + k, z: c0.z + k}, dir: {x: -1, z: -1}, y: .65, radius: r, speed: 14, life: 3, pierce: 1, hit: {damage: 1}}, []);
  steps(g, 20);const rf = events.find(e => e.result === 'reflected');
  assert.ok(rf && rf.face === 'front', 'empate frente × borda: a frente vence');assert.ok(p.vel.x < 0 && p.vel.z > 0, 'refletida pela normal da frente (vx mantém, vz inverte)');
  // geometria: a varredura identifica a superfície
  const R = {pos: {x: 0, z: 0}, angle: 0, hx: 1, hz: .05};
  assert.equal(sweepBox(R, {x: 0, z: 2}, {x: 0, z: -2}, .02, .001).face, 'front');assert.equal(sweepBox(R, {x: 0, z: -2}, {x: 0, z: 2}, .02, .001).face, 'back');
  assert.equal(sweepBox(R, {x: 3, z: 0}, {x: -3, z: 0}, .02, .001).face, 'edge');assert.ok(sweepBox(R, {x: 0, z: 0}, {x: 0, z: 1}, .02, .001).inside);
  assert.equal(sweepBox(R, {x: 0, z: 2}, {x: 0, z: 1}, .02, .001), null, 'sem contato');
  assert.equal(sweepBox(R, {x: 2.02, z: 1.07}, {x: 0, z: -.93}, .02, .001).face, 'front', 'empate de quina: frente');
  const R2 = {...R, angle: Math.PI / 2};assert.equal(sweepBox(R2, {x: 2, z: 0}, {x: -2, z: 0}, .02, .001).face, 'front', 'respeita a rotação');
  assert.ok(rectsOverlap({pos: {x: 0, z: 0}, angle: .3, hx: 1, hz: .1}, {pos: {x: .5, z: .1}, angle: 0, hx: .2, hz: .2}));assert.ok(!rectsOverlap({pos: {x: 0, z: 0}, angle: 0, hx: 1, hz: .1}, {pos: {x: 0, z: 1}, angle: 0, hx: .2, hz: .2}));
}
ok('M30.5: primeira superfície atingida; empate de quina → frente > borda > verso; entrada pelo verso; rotação; sobreposição de retângulos');
{
  const run = (barPl, pPl) => {
    const g = arena({blue: vec(0, 8), red: vec(0, 9)}), bar = barrier(g, {pl: barPl}), p = spawn(g.world, {kind: 'projectile', owner: 1, pos: {x: 0, z: 1.5}, dir: {x: 0, z: -1}, y: .65, radius: .25, speed: 14, life: 3, pierce: 1, pl: pPl, hit: {damage: 10}}, []);
    events.length = 0;steps(g, 30);return {bar, p, ev: [...events]};
  };
  let r = run(2, 1);assert.ok(r.ev.some(e => e.result === 'reflected') && !r.bar.dead, 'PL menor: refletido');
  r = run(2, 2);assert.ok(r.ev.some(e => e.result === 'reflected') && !r.bar.dead, 'PL igual: refletido');
  r = run(1, 2);assert.ok(r.bar.dead && r.p.dead && r.ev.some(e => e.result === 'barrierBroken' && e.by === 'pl') && r.ev.some(e => e.result === 'neutralized') && !r.ev.some(e => e.result === 'reflected'), 'PL superior: destrói a barreira e é neutralizado');
}
ok('Power Level: PL igual ou inferior é refletido; PL superior destrói a barreira e é neutralizado (M18.8, M19.2, M19.3)');
{
  // Ciclo degenerado (M17.2): duas barreiras frente a frente e um projétil muito rápido.
  const g = arena({blue: vec(0, 8), red: vec(0, 9)});
  barrier(g, {pos: {x: 0, z: 0}, angle: 0, hx: 5, hz: .05});barrier(g, {pos: {x: 0, z: .25}, angle: Math.PI, hx: 5, hz: .05});
  const p = spawn(g.world, {kind: 'projectile', owner: 1, pos: {x: 0, z: .125}, dir: {x: 0, z: 1}, y: .65, radius: .02, speed: 1000, life: .5, pierce: 1, hit: {damage: 1}}, []);
  const t0 = Date.now();steps(g, 2);assert.ok(Date.now() - t0 < 2000, 'não trava');
  assert.ok(events.some(e => e.result === 'reflectCycle'), 'salvaguarda de ciclo acionada');assert.ok(events.filter(e => e.result === 'reflected').length <= 16 * 2 + 2, 'no máximo 16 reflexões por passo');void p;
}
ok('ciclo degenerado: no máximo 16 reflexões por passo; o projétil segue e a simulação não trava');

// ---------- Sólida, Tackle e explosão ----------
{
  const g = arena(), b = cast(g, 2);steps(g, 40);
  steps(g, 150, () => cmd(), () => cmd({move: vec(0, -1)}));
  assert.ok(g.fighters[1].position.z > b.pos.z + b.hz + .5 - 1e-6, `o adversário não atravessa a barreira (z=${g.fighters[1].position.z})`);
}
ok('a barreira é sólida para o adversário (que não a atravessa andando)');
{
  const run = ownerId => {
    const g = arena(), bar = barrier(g, {owner: ownerId, pos: {x: 0, z: 1.2}, angle: Math.PI});steps(g, 5);
    const ev = [];for (let i = 0; i < 40 && !bar.dead; i++) ev.push(...step(g, cmd(), cmd({tackle: true, move: vec(0, -1)})));
    return {g, bar, ev};
  };
  for (const owner of [0, 1]) {
    const r = run(owner), red = r.g.fighters[1];
    assert.ok(r.bar.dead && r.ev.some(e => e.result === 'barrierBroken' && e.by === 'tackle' && e.attacker === 1), `Tackle destrói (dono ${owner}, inclusive a própria)`);
    assert.ok(red.knockRecovery > .2 && red.knockRecovery <= .25 && red.action === null, 'stagger de 0,25 s');assert.ok(red.push && red.push.direction.z > .9, 'recuo curto para trás');
  }
}
ok('Tackle destrói o Reflect (qualquer PL, de qualquer dono) e o atacante recua e fica em stagger de 0,25 s');
{
  const blast = (g, o = {}) => spawn(g.world, {kind: 'area', explosion: true, owner: 1, affectsOwner: true, pos: {x: 0, z: 0}, radius: 4, y: 0, height: 3, life: .1, pulses: 1, hit: {damage: 10}, ...o}, []);
  const g = arena(), b = cast(g, 2);steps(g, 2);blast(g);events.length = 0;steps(g, 3);
  assert.equal(g.fighters[0].hp, 100, 'protegido pela barreira (segmento centro da explosão → centro do corpo cruza a barreira)');
  assert.ok(events.some(e => e.result === 'shielded' && e.target === 0) && b.dead && events.some(e => e.result === 'barrierBroken' && e.by === 'explosion'), 'e a barreira é destruída pela mesma explosão');
  assert.ok(g.fighters[1].hp < 100, 'quem não está atrás da barreira leva o dano');
  const c = arena();blast(c);steps(c, 3);assert.ok(c.fighters[0].hp < 100, 'sem barreira, o mesmo lutador leva o dano');
  const d = arena(), b2 = cast(d, 2);steps(d, 2);blast(d, {radius: 1});steps(d, 3);assert.ok(!b2.dead, 'explosão que não alcança a barreira não a destrói');
  const e = arena(), b3 = cast(e, 2);steps(e, 2);const side = spawn(e.world, {kind: 'area', explosion: true, owner: 1, pos: {x: 0, z: -1}, radius: 2, y: 0, height: 3, life: .1, pulses: 1, hit: {damage: 10}}, []);steps(e, 3);
  assert.ok(b3.dead && e.fighters[0].hp === 100, 'explosão atrás/na altura da barreira: o dono também é protegido (M30.7, qualquer personagem)');void side;
}
ok('explosão: destrói a barreira que alcança, mas quem estava atrás dela fica protegido daquela explosão (inclusive o dono); sem barreira, leva o dano');

// ---------- Contrato M28.4 e duração ----------
{
  const g = arena();step(g, cmd({skill: 0, skillHeld: H}));steps(g, 479, () => cmd({skillHeld: H}));
  C.world.reflect.widthMax = 1.6;C.world.reflect.thickness = .5;C.world.reflect.tackleStagger = 2;C.world.reflect.tieTolerance = .5;       // sliders mexidos durante a carga
  step(g, cmd());const b = g.world.entities.find(e => e.reflect);
  near(b.hx * 2, 3, 1e-9);near(b.hz, .05);assert.equal(b.captured.tackleStagger, .25);assert.equal(b.captured.tieTolerance, .001);
  C.world.reflect.thickness = .9;C.world.reflect.tackleStagger = 9;steps(g, 10);near(b.hz, .05);assert.equal(b.captured.tackleStagger, .25, 'a barreira criada não muda');
  const h = arena();C.world.reflect.widthMax = 1.6;C.world.reflect.thickness = .5;const b2 = cast(h, 480);near(b2.hx * 2, 1.6, 1e-9);near(b2.hz, .25);                     // o PRÓXIMO uso já usa os novos valores
}
ok('M28.4/D1: os parâmetros do Reflect são capturados ao apertar; mexer nos sliders depois não altera a barreira criada nem o uso em andamento');
{
  const g = arena(), b = cast(g, 2);steps(g, Math.round((b.life - .1) * 120));assert.ok(g.world.entities.includes(b));
  steps(g, 30);assert.ok(!g.world.entities.includes(b), 'some ao fim da duração');assert.ok(events.some(e => e.result === 'expire' && e.entity === b.id));
  const m = getMove('reflect');assert.ok(m.charge.group === 'reflect' && m.cooldownBoost && m.cooldown === 8 && m.cost === 1);
}
ok('a barreira expira ao fim de 4 s + carga; definição: custo 1, recarga 8 s, recarga acelerável');
{
  const g = arena(), s = JSON.stringify(g.save());cast(g, 30);const h = new Game();h.mode = 'inactive';h.load(g.save());
  const run = x => {steps(x, 20);return JSON.stringify({w: x.world, f: x.fighters});};
  const a = arena();cast(a, 30);const b = new Game();b.mode = 'inactive';b.load(a.save());steps(a, 20);steps(b, 20);
  assert.equal(JSON.stringify({w: a.world, f: a.fighters}), JSON.stringify({w: b.world, f: b.fighters}), 'save/load com barreira viva reproduz a mesma partida');void s;void run;void length;
}
ok('save/load com a barreira viva reproduz a mesma partida');

clearMoves();clearEffects();resetConfig(defaults());
console.log(`\n${n} verificações do Reflect (Fase 2) aprovadas.`);
