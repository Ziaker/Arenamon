// Fase 3 (plano de Reflect/Psyshock) — Psyshock, sem navegador. Cobre: M1.4–M1.7, M4.7–M4.9, M5.5, M6.3–M6.4, M8.1–M8.3, M9.1–M9.3,
// M10.1–M10.3, M11.1–M11.2, M12.1–M12.6, M26s.5–M26s.7, M27.3, M27.5, M29.3, M30.1–M30.3, M30.8 e o contrato M28.4. As pedras nascem
// do fluxo real (segurar → soltar o slot 2); Reflect e explosões de teste vêm de entidades montadas aqui.
import assert from 'node:assert/strict';
import {C, defaults, resetConfig} from '../src/sim/config.js';
import {Game} from '../src/sim/game.js';
import {emptyCommand} from '../src/sim/entity.js';
import {vec, length, angleOf} from '../src/sim/math.js';
import {clearMoves, getMove} from '../src/sim/moves.js';
import {clearEffects} from '../src/sim/move-effects.js';
import {registerStandardMoves} from '../src/sim/moves/standard.js';
import {stoneCount} from '../src/sim/moves/psyshock.js';
import {hash32, rng} from '../src/sim/moves/rng.js';
import {chargeParams} from '../src/sim/charge.js';
import {spawn} from '../src/sim/world.js';

let n = 0;const ok = l => {n++;console.log('✓', l);};
const cmd = o => ({...emptyCommand(), ...o});
const H = [false, true, false, false];
const near = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} ≠ ${b}`);
registerStandardMoves();
const events = [];
function arena({blue = vec(0, -3), red = vec(0, 3)} = {}) {
  resetConfig(defaults());events.length = 0;
  const g = new Game();g.mode = 'inactive';g.reset({positions: [blue, red]});g.fighters[0].facing = 0;g.fighters[1].facing = Math.PI;g.setLoadout(0, ['reflect', 'psyshock']);return g;
}
const step = (g, c0 = cmd(), c1 = cmd()) => {g.step(c0, c1);events.push(...g.lastStepEvents);return g.lastStepEvents;};
const steps = (g, k, c0 = () => cmd(), c1 = () => cmd()) => {for (let i = 0; i < k; i++) step(g, c0(i), c1(i));};
/** Segura o slot 2 por `ticks` passos e solta (com alvo travado se `lock`); devolve as pedras. */
function fire(g, ticks, lock = false) {
  step(g, cmd({skill: 1, skillHeld: H}));steps(g, ticks - 1, () => cmd({skillHeld: H}));
  step(g, lock ? cmd({target: 1, locked: true}) : cmd());return g.world.entities.filter(e => e.kind === 'projectile' && e.exec != null);
}

// ---------- Quantidade, igualdade e sorteios ----------
{
  const count = k => fire(arena(), k).length;
  assert.deepEqual([count(2), count(95), count(96), count(191), count(192), count(480), count(900)], [3, 3, 4, 4, 5, 8, 8]);
  const P = chargeParams(getMove('psyshock'));assert.equal(stoneCount(0, P), 3);assert.equal(stoneCount(480, P), 8);assert.equal(stoneCount(9999, P), 8);
}
ok('3 pedras iniciais, +1 a cada 0,8 s de carga (por contagem de passos), 8 no máximo (M11.1–M11.2)');
{
  const g = arena(), s = fire(g, 480), f = g.fighters[0];
  assert.equal(s.length, 8);
  assert.equal(new Set(s.map(e => e.pl)).size, 1);assert.equal(s[0].pl, 3, 'PL compartilhado pela execução (carga máxima = PL3)');
  assert.equal(new Set(s.map(e => e.hit.damage)).size, 1);near(s[0].hit.damage, .2 * f.attributes.attack, 1e-12);          // dano-base gravado no disparo: 0,2 × Ataque (M30.1, M30.2)
  assert.equal(new Set(s.map(e => e.radius)).size, 1, 'a física é igual em todas as pedras (tamanho visual não conta, M30.2)');
  assert.equal(new Set(s.map(e => e.exec)).size, 1);assert.ok(s.every(e => e.owner === 0 && e.life === Infinity && e.pierce === 1 && e.clashable));
  assert.ok(new Set(s.map(e => e.visualScale.toFixed(4))).size > 1 && new Set(s.map(e => e.y.toFixed(3))).size > 1, 'tamanhos e alturas visuais variam');
  assert.ok(s.every(e => e.captured.attackFraction === .2 && e.captured.knockbackCap === .9));
  const sp = s.map(e => Math.hypot(e.vel.x, e.vel.z, e.vy ?? 0));assert.ok(sp.every(v => v >= 10 - 1e-9 && v <= 14 + 1e-9) && new Set(sp.map(v => v.toFixed(4))).size > 1, `velocidade sorteada por pedra em 10–14 m/s (${sp.map(v => v.toFixed(2))})`);
  assert.ok(g.fighters[0].moveCooldowns.psyshock > 7.9 && g.fighters[0].moveRecovery > 0 && events.some(e => e.result === 'chargeRelease' && e.level === 3));
}
ok('todas as pedras da execução têm o mesmo PL, dano-base (0,2 × Ataque) e física; tamanho/altura visuais e velocidade (10–14 m/s) sorteados por pedra');
{
  const a = fire(arena(), 100), b = fire(arena(), 100);
  assert.equal(JSON.stringify(a.map(e => [e.pos, e.y, e.vel, e.vy])), JSON.stringify(b.map(e => [e.pos, e.y, e.vel, e.vy])), 'mesma situação, mesmos sorteios');
  const g = arena();steps(g, 7);const c = fire(g, 100);assert.notEqual(JSON.stringify(a.map(e => e.pos)), JSON.stringify(c.map(e => e.pos)), 'passo diferente, sorteio diferente');
  const r1 = rng(hash32(1, 2, 3)), r2 = rng(hash32(1, 2, 3)), r3 = rng(hash32(1, 2, 4));assert.equal(r1(), r2());assert.notEqual(r1(), r3());
}
ok('sorteios determinísticos por passo, lutador e execução (reprodutíveis em save/load e replay)');

// ---------- Mira ----------
{
  const s = fire(arena(), 2), ang = s.map(e => angleOf(e.vel) * 180 / Math.PI).sort((x, y) => x - y);          // 3 pedras, sem alvo travado
  near(ang[0], -10, 1e-6);near(ang[1], 0, 1e-6);near(ang[2], 10, 1e-6);assert.ok(s.every(e => !e.homing && !e.vy));
  const t = fire(arena(), 480).map(e => angleOf(e.vel) * 180 / Math.PI).sort((x, y) => x - y);
  near(t[0], -10, 1e-6);near(t[7], 10, 1e-6);const gaps = t.slice(1).map((v, i) => v - t[i]);assert.ok(gaps.every(d => Math.abs(d - gaps[0]) < 1e-6), 'leque discreto com espaçamento igual');
}
ok('sem alvo travado: leque frontal discreto de 20° (−10° a +10°), espaçamento igual, sem homing');
{
  const g = arena(), s = fire(g, 480, true);
  assert.ok(s.every(e => e.homing && e.homing.target === 1 && e.homing.ticks === 35 && Math.abs(e.homing.rate - Math.PI) < 1e-12), 'homing de 0,3 s (36 passos; o primeiro já correu no passo da soltura) a 180°/s');
  const o = s.map(e => e.homing.offset);assert.ok(o.every(v => Math.abs(v.x) <= .5 && Math.abs(v.z) <= .5 && v.y >= .05 * 1.3 && v.y <= .95 * 1.3), 'pontos de mira dentro da caixa lógica do alvo (M30.8)');
  assert.ok(new Set(o.map(v => v.y.toFixed(3))).size > 1 && s.some(e => Math.abs(e.vy) > 1e-6), 'cada pedra mira uma parte diferente do corpo (altura própria)');
  const first = s.map(e => angleOf(e.vel));steps(g, 60);                                                      // 0,5 s: o homing (0,3 s) já acabou
  assert.ok(s.every(e => e.dead || e.homing === null), 'homing encerra em 0,3 s');
  const total = g.fighters[1].hp;assert.ok(total < 100, 'as pedras alcançam o alvo');void first;
  const h = arena(), q = fire(h, 2, true), v0 = q.map(e => angleOf(e.vel)), sp0 = q.map(e => length(e.vel));
  steps(h, 40);for (let i = 0; i < q.length; i++) {if (q[i].dead) continue;const d = Math.abs(((angleOf(q[i].vel) - v0[i] + Math.PI) % (2 * Math.PI)) - Math.PI);assert.ok(d <= Math.PI * .3 + 1e-6, `giro máximo = 180°/s × 0,3 s = 54° (${d})`);near(length(q[i].vel), sp0[i], 1e-9);}
}
ok('com alvo travado: pontos de mira sorteados na caixa lógica; homing de 0,3 s limitado a 180°/s, sem mudar a velocidade');
{
  const g = arena(), s = fire(g, 480, true);g.fighters[1].hp = 0;g.fighters[1].state = 'defeated';const v = s.map(e => ({...e.vel}));
  step(g);assert.ok(s.every(e => e.homing === null), 'perder o alvo para sempre encerra o homing');
  s.forEach((e, i) => {if (!e.dead) {assert.ok(Math.hypot(e.vel.x, e.vel.z) > 0);void v[i];}});
}
ok('perder o alvo definitivamente encerra o homing e preserva a direção e a velocidade (M27.5)');

// ---------- Acertos: 0,8ⁿ, knockback e defesa ----------
{
  const g = arena(), s = fire(g, 480, true);steps(g, 150);
  const hits = events.filter(e => e.result === 'impact' && e.target === 1);
  assert.equal(hits.length, 8, 'as 8 pedras acertam');
  const base = .2 * 20, dmg = hits.map(e => e.damage);dmg.forEach((d, i) => near(d, base * .8 ** i, 1e-9));
  near(g.fighters[1].hp, 100 - base * (1 - .8 ** 8) / .2, 1e-9);                                                // 4 + 3,2 + 2,56 + …
  const kb = hits.map(e => e.launch?.horizontal ?? 0), sum = kb.reduce((a, b) => a + b, 0);
  near(sum, .9, 1e-9);assert.deepEqual(kb.map(x => +x.toFixed(6)), [.3, .3, .3, 0, 0, 0, 0, 0], 'knockback 0,3 por pedra, teto de 0,9 por alvo e execução (M30.3)');
  assert.ok(s.every(e => e.dead) && Object.keys(g.world.exec ?? {}).length === 0, 'execução descartada ao fim');
}
ok('acertos no mesmo alvo: dano × 0,8ⁿ, knockback de 0,3 m/s por pedra com teto de 0,9 m/s por alvo; só impactos com dano contam');
{
  const hit = guard => {
    const g = arena();fire(g, 2, true);for (let i = 0; i < 90; i++) step(g, cmd(), cmd({guard, guardPressed: false, target: 0}));return g.fighters[1].hp;
  };
  const open = hit(false), guarded = hit(true);assert.ok(guarded > open, `a defesa reduz o dano (${guarded} > ${open})`);
  const g = arena();fire(g, 2, true);steps(g, 5, () => cmd(), () => cmd({guard: true}));
  const e = events.find(x => x.result === 'partial');assert.ok(e || guarded > open);
}
ok('cada pedra interage individualmente com a defesa');
{
  // Duas execuções do mesmo lançador no mesmo alvo têm tetos próprios (não dividem o 0,9).
  const g = arena();g.fighters[0].stamina = 3;fire(g, 480, true);steps(g, 150);const a = events.filter(e => e.result === 'impact' && e.launch).length;
  events.length = 0;g.fighters[1].hp = 100;g.fighters[1].knockRecovery = 0;g.fighters[1].flight = null;g.fighters[0].moveCooldowns = {};g.fighters[0].moveRecovery = 0;g.fighters[0].stamina = 3;g.fighters[0].regenBase = 3;
  fire(g, 480, true);steps(g, 150);const b = events.filter(e => e.result === 'impact' && e.launch).length;
  assert.equal(a, 3);assert.equal(b, 3, 'cada execução tem o seu teto por alvo');
}
ok('o teto de knockback vale por alvo dentro de cada execução (execuções diferentes não dividem o teto)');

// ---------- Reflect × Psyshock, pedras entre si e espaço ----------
{
  const g = arena();
  spawn(g.world, {kind: 'barrier', owner: 1, shape: 'box', pos: {x: 0, z: 1.2}, angle: Math.PI, hx: 3, hz: .05, y: 0, height: 3, life: 8, hp: Infinity, blocksProjectiles: true, blocksFighters: true, blocksOwner: true, reflect: true, shields: true, pl: 3,
    captured: {tieTolerance: .001, maxReflections: 16}}, []);
  g.fighters[1].attributes.attack = 30;fire(g, 480, true);steps(g, 150);
  const refl = events.filter(e => e.result === 'reflected');assert.ok(refl.length >= 1 && refl.every(e => e.attacker === 1 && e.target === 0), 'o Reflect do adversário reflete as pedras (PL3 ≤ PL3)');
  const back = events.filter(e => e.result === 'impact' && e.target === 0 && e.attacker === 1);assert.ok(back.length >= 1, 'e elas atingem o lançador original');
  near(back[0].damage, .2 * 30, 1e-9);                                                                      // dano recalculado com o Ataque do refletor (M30.1)
  assert.equal(g.fighters[1].hp, 100, 'o refletor não leva dano das pedras refletidas');
}
ok('pedras refletidas pelo Reflect do adversário voltam como do refletor, com dano recalculado (0,2 × Ataque do refletor) e sem homing');
{
  const g = arena();g.step(cmd({skill: 0, skillHeld: [true, false, false, false]}), cmd());steps(g, 5, () => cmd({skillHeld: [true, false, false, false]}));step(g, cmd());     // Reflect próprio
  const b = g.world.entities.find(e => e.reflect);assert.ok(b);steps(g, 40);
  const s = fire(g, 100);steps(g, 200);
  assert.ok(!events.some(e => e.result === 'reflected'), 'as pedras do dono não são refletidas pela própria barreira (saem por trás/frente sem reflexão)');
  assert.ok(g.fighters[1].hp < 100, 'e alcançam o adversário');void s;
}
ok('as pedras do dono atravessam a própria barreira pelo verso e seguem até o alvo');
{
  const g = arena();
  const mk = (owner, pl, x) => spawn(g.world, {kind: 'projectile', owner, pos: {x, z: 0}, dir: {x: 0, z: 1}, speed: 0, y: .65, radius: .2, life: 2, pierce: 1, pl, clashable: true, hit: {damage: 1}}, []);
  const a = mk(0, 1, 0), b = mk(1, 1, .1), c = mk(0, 1, 5), d = mk(0, 1, 5.05);
  step(g);assert.ok(a.dead && b.dead, 'PL igual: as duas pedras envolvidas se destroem');assert.ok(!c.dead && !d.dead, 'pedras do mesmo dono não colidem entre si');
  assert.ok(events.some(e => e.result === 'stoneClash' && e.winner === null));
  const g2 = arena(), hi = (() => {const e = spawn(g2.world, {kind: 'projectile', owner: 0, pos: {x: 0, z: 0}, dir: {x: 0, z: 1}, speed: 0, y: .65, radius: .2, life: 2, pierce: 1, pl: 2, clashable: true, hit: {damage: 1}}, []);return e;})();
  const lo = spawn(g2.world, {kind: 'projectile', owner: 1, pos: {x: 0, z: .1}, dir: {x: 0, z: -1}, speed: 0, y: .65, radius: .2, life: 2, pierce: 1, pl: 1, clashable: true, hit: {damage: 1}}, []);
  const third = spawn(g2.world, {kind: 'projectile', owner: 1, pos: {x: 4, z: 0}, dir: {x: 0, z: -1}, speed: 0, y: .65, radius: .2, life: 2, pierce: 1, pl: 1, clashable: true, hit: {damage: 1}}, []);
  step(g2);assert.ok(lo.dead && !hi.dead && !third.dead, 'PL superior vence e continua; só as envolvidas somem (M19.4, M20.1)');
}
ok('colisão entre pedras de donos diferentes: PL igual destrói as duas; PL superior vence; só as envolvidas somem; mesmo dono não colide');
{
  const w = arena({blue: vec(0, 15.5)});fire(w, 30);
  assert.equal(w.world.entities.filter(e => e.exec != null).length, 0, 'sem espaço nenhuma pedra é criada');assert.ok(events.some(e => e.result === 'moveFailed' && e.reason === 'semEspaco'));
  near(w.fighters[0].stamina, 3, 1e-6);assert.equal(w.fighters[0].moveCooldowns.psyshock, undefined, 'sem recarga');assert.equal(w.fighters[0].moveRecovery, 0);
  const g = arena();spawn(g.world, {kind: 'wall', pos: {x: 0, z: -2}, hx: .3, hz: .3, y: 0, height: 2, life: Infinity}, []);
  const s = fire(g, 480);assert.equal(s.length, 8, 'busca posições alternativas à frente e mantém a quantidade (M26s.5, M27.3)');
  assert.ok(s.every(e => Math.hypot(e.pos.x - 0, e.pos.z + 2) >= .5 - 1e-9), 'nenhuma pedra nasce dentro da parede');
  const l = arena();for (let i = 0; i < 60; i++) spawn(l.world, {kind: 'area', pos: {x: 8, z: 8}, radius: .1, life: 99, y: 0, height: 1}, []);
  assert.equal(fire(l, 480).length, 0, 'o limite de entidades recusa o disparo inteiro');assert.ok(events.some(e => e.result === 'moveFailed' && e.reason === 'limiteDeEntidades'));
}
ok('falha de espaço: nenhuma pedra, stamina devolvida, sem recarga; paredes desviam as posições sem perder pedras; limite de entidades recusa tudo');

// ---------- Contrato M28.4, save/load ----------
{
  const g = arena();step(g, cmd({skill: 1, skillHeld: H}));steps(g, 479, () => cmd({skillHeld: H}));
  C.world.psyshock.maxStones = 3;C.world.psyshock.successiveFactor = .1;C.world.psyshock.knockbackCap = 0;C.world.psyshock.speedMin = 1;C.world.psyshock.speedMax = 2;       // sliders mexidos durante a carga
  step(g, cmd({target: 1, locked: true}));const s = g.world.entities.filter(e => e.exec != null);
  assert.equal(s.length, 8, 'o uso em andamento mantém os parâmetros do início');assert.ok(s.every(e => e.captured.successiveFactor === .8 && e.captured.knockbackCap === .9));
  C.world.psyshock.successiveFactor = .1;C.world.psyshock.knockbackCap = 0;steps(g, 150);
  const dmg = events.filter(e => e.result === 'impact' && e.target === 1).map(e => e.damage);near(dmg[1], 4 * .8, 1e-9);assert.equal(events.filter(e => e.launch).length, 3);
  const h = arena();C.world.psyshock.maxStones = 5;assert.equal(fire(h, 480).length, 5, 'o PRÓXIMO uso já usa os novos valores');
}
ok('M28.4/D1: parâmetros capturados ao apertar; pedras em voo não leem mais os sliders; o próximo uso usa os novos valores');
{
  const a = arena();fire(a, 200, true);steps(a, 10);const b = new Game();b.mode = 'inactive';b.load(a.save());
  steps(a, 120);steps(b, 120);
  assert.equal(JSON.stringify({w: a.world, f: a.fighters}), JSON.stringify({w: b.world, f: b.fighters}), 'save/load com pedras em voo e execução em curso reproduz a mesma partida');
}
ok('save/load com pedras em voo (homing e execução em curso) reproduz a mesma partida');

clearMoves();clearEffects();resetConfig(defaults());
console.log(`\n${n} verificações do Psyshock (Fase 3) aprovadas.`);
