// Base para os movimentos dos Pokémon (sem navegador). O laboratório NÃO registra nenhum movimento: as definições
// abaixo existem só dentro deste teste (prefixo “teste:”) e são removidas no fim. Verifica projéteis, barreiras,
// paredes, explosões e efeitos radiais, buffs/debuffs, slots, recarga, diagnóstico, determinismo e save/load.
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {C, defaults, resetConfig} from '../src/sim/config.js';
import {Game} from '../src/sim/game.js';
import {emptyCommand} from '../src/sim/entity.js';
import {vec, length} from '../src/sim/math.js';
import {registerMove, clearMoves, listMoves, validateMove} from '../src/sim/moves.js';
import {applyStatus, stat, hasFlag, validateStatus} from '../src/sim/status.js';
import {spawn} from '../src/sim/world.js';
import {walkSpeed} from '../src/sim/controller.js';
import {setAttemptSink, describe} from '../src/sim/attempts.js';

let n = 0;const ok = l => {n++;console.log('✓', l);};
const cmd = o => ({...emptyCommand(), ...o});
/** Partida limpa: azul em (0,-3) olhando +Z, vermelho parado em (0,3) olhando −Z. */
function arena({blue = vec(0, -3), red = vec(0, 3)} = {}) {
  resetConfig(defaults());const g = new Game();g.mode = 'inactive';g.reset({positions: [blue, red]});
  g.fighters[0].facing = 0;g.fighters[1].facing = Math.PI;return g;
}
const steps = (g, k, c0 = () => emptyCommand(), c1 = () => emptyCommand()) => {const ev = [];for (let i = 0; i < k; i++) {g.step(c0(i), c1(i));ev.push(...g.lastStepEvents);}return ev;};
const PROJ = {kind: 'projectile', offset: {forward: .8}, radius: .3, speed: 14, life: 1.5, hit: {damage: 12, knockback: {horizontal: 6, vertical: 4}}};

// ---------- Nada é adicionado ----------
{
  assert.equal(listMoves().length, 0, 'registro vazio ao carregar o motor');
  const walk = d => readdirSync(d, {withFileTypes: true}).flatMap(e => e.isDirectory() ? walk(`${d}/${e.name}`) : e.name.endsWith('.js') ? [`${d}/${e.name}`] : []);
  const files = walk(fileURLToPath(new URL('../src', import.meta.url))), src = f => readFileSync(f, 'utf8'), norm = f => f.replace(/\\/g, '/'), rel = f => norm(f).split('/src/').pop();
  // D2: só moves/standard.js chama registerMove, e só o bootstrap do laboratório (main.js) chama registerStandardMoves(); o núcleo sim/ nunca registra.
  const users = files.filter(f => !norm(f).endsWith('/sim/moves.js') && /registerMove\(/.test(src(f)));
  assert.deepEqual(users.map(rel), ['sim/moves/standard.js'], 'só os Moves padrão registram movimentos');
  const boot = files.filter(f => /registerStandardMoves\(\)/.test(src(f)) && !norm(f).endsWith('/sim/moves/standard.js'));
  assert.deepEqual(boot.map(rel), ['main.js'], 'registrados só no bootstrap do laboratório');
  const g = arena(), e0 = steps(g, 30, i => cmd({skill: i % 4}));
  assert.ok(!g.fighters[0].action && g.world.entities.length === 0 && e0.length === 0, 'teclas dos slots sem movimento equipado não fazem nada');
}
ok('nenhum movimento registrado; slots vazios não alteram a partida');
{
  const bad = [[{id: 'x'}, /duration/], [{id: 'x', duration: .3, aim: 'olhos'}, /aim/], [{id: 'x', duration: .3, timeline: [{at: .5, spawn: PROJ}]}, /fora da duração/],
    [{id: 'x', duration: .3, timeline: [{at: .1, spawn: {kind: 'raio'}}]}, /tipo desconhecido/], [{id: 'x', duration: .3, timeline: [{at: .1}]}, /exatamente um/],
    [{id: 'x', duration: .3, timeline: [{at: .1, status: {id: 's', duration: 1, mul: {sorte: 2}}}]}, /atributo desconhecido/]];
  for (const [def, re] of bad) assert.throws(() => validateMove(def), re);
  assert.throws(() => validateStatus({id: 's', duration: 1, flags: {voando: true}}), /flag desconhecida/);
  assert.throws(() => arena().setLoadout(0, ['teste:inexistente']), /não registrado/);
}
ok('validação: duração, mira, linha do tempo, tipos de entidade, atributos e flags desconhecidos são recusados com motivo');

// ---------- Projéteis ----------
registerMove({id: 'teste:projetil', name: 'Projétil de teste', duration: .4, cost: 1, cooldown: 1, cancelAfter: .3, timeline: [{at: .1, spawn: PROJ}]});
{
  const g = arena();g.setLoadout(0, ['teste:projetil']);const log = [];setAttemptSink((f, e) => log.push(describe(e)));
  const before = g.fighters[0].stamina;g.step(cmd({skill: 0}));
  const f = g.fighters[0];assert.equal(f.action?.kind, 'move');assert.ok(Math.abs(f.stamina - (before - 1)) < 1e-9 || f.stamina < before, 'cobra stamina');assert.ok(f.moveCooldowns['teste:projetil'] > .9);
  let ev = steps(g, 14);const sp = ev.find(e => e.result === 'spawn');assert.ok(sp, 'projétil criado no instante da linha do tempo');
  const p = g.world.entities.find(e => e.kind === 'projectile');assert.ok(p.pos.z > -3 && Math.abs(p.pos.x) < 1e-9 && p.owner === 0, 'na frente do dono, rumo ao alvo');
  ev = steps(g, 60);const hit = ev.find(e => e.result === 'impact' && e.entity);
  assert.ok(hit && Math.abs(hit.damage - 12) < 1e-9 && g.fighters[1].hp === 88, 'acerto: dano da definição');
  assert.ok(hit.launch && g.world.entities.every(e => e.kind !== 'projectile'), 'lançamento e projétil consumido (pierce 1)');
  g.step(cmd({skill: 0}));assert.ok(log.some(t => /Movimento 1 \(teste:projetil\) ignorado: em recarga/.test(t)), 'recarga: negado com motivo');setAttemptSink(null);
  g.fighters[1].hp = 100;const tickB = g.tick;steps(g, 130);g.step(cmd({skill: 0}));assert.equal(g.fighters[0].action?.kind, 'move', 'depois da recarga, sai de novo');void tickB;
}
ok('projétil: slot, custo, recarga, criação relativa ao lutador, voo em subpassos, dano, lançamento e consumo');
{
  // Defesa frontal e perfeita, e invulnerabilidade da esquiva, pela mesma regra do tackle.
  // O vermelho reage quando o projétil está a `near` metros (dentro da janela perfeita / da invulnerabilidade).
  const shoot = (react, near = 2.2) => {
    const g = arena();g.setLoadout(0, ['teste:projetil']);let fired = null;
    const red = () => {const p = g.world.entities.find(e => e.kind === 'projectile'), d = p ? Math.abs(p.pos.z - g.fighters[1].position.z) : Infinity;if (fired === null && d < near) fired = g.tick;return react(fired !== null, fired === g.tick);};
    g.step(cmd({skill: 0}));return steps(g, 90, () => emptyCommand(), red).find(e => e.entity && ['impact', 'partial', 'perfect', 'invulnerable'].includes(e.result));
  };
  const partial = shoot(() => cmd({guard: true}));assert.equal(partial.result, 'partial');assert.ok(Math.abs(partial.damage - 12 * C.extras.combat.guardDamageMultiplier) < 1e-9);
  const perfect = shoot((on, now) => cmd({guard: on, guardPressed: now}));assert.equal(perfect.result, 'perfect');assert.equal(perfect.damage, 0);
  const dodged = shoot((on, now) => now ? cmd({dodge: true, move: vec(1, 0), dodgeDirection: vec(1, 0)}) : cmd(), 1.2);
  assert.equal(dodged?.result, 'invulnerable', 'esquiva com invulnerabilidade atravessa o projétil');
}
ok('acertos de entidades respeitam defesa comum, defesa perfeita e invulnerabilidade');

// ---------- Barreiras e paredes ----------
{
  const g = arena();g.setLoadout(0, ['teste:projetil']);
  spawn(g.world, {kind: 'barrier', owner: 1, pos: {x: 0, z: 0}, hx: 1, hz: .2, hp: 5, life: 5});
  g.step(cmd({skill: 0}));const ev = steps(g, 60);
  assert.ok(ev.some(e => e.result === 'blocked' && e.kind === 'barrier'), 'barreira do adversário bloqueia');assert.ok(ev.some(e => e.result === 'barrierBroken'), 'barreira com vida se rompe');assert.equal(g.fighters[1].hp, 100);
  const g2 = arena();g2.setLoadout(0, ['teste:projetil']);spawn(g2.world, {kind: 'barrier', owner: 0, pos: {x: 0, z: 0}, hx: 1, hz: .2, life: 5});
  g2.step(cmd({skill: 0}));assert.ok(steps(g2, 60).some(e => e.result === 'impact'), 'o próprio projétil atravessa a própria barreira');
}
{
  const g = arena({blue: vec(0, -4), red: vec(9, 9)});spawn(g.world, {kind: 'wall', pos: {x: 0, z: 0}, hx: 3, hz: .3});
  steps(g, 240, () => cmd({move: vec(0, 1)}));
  assert.ok(g.fighters[0].position.z < -.3 - C.test.halfExtent + 1e-6, `parede segura o lutador (z = ${g.fighters[0].position.z.toFixed(3)})`);
  const g2 = arena();g2.setLoadout(0, ['teste:projetil']);spawn(g2.world, {kind: 'wall', pos: {x: 0, z: 0}, hx: 2, hz: .2});g2.step(cmd({skill: 0}));
  assert.ok(steps(g2, 60).some(e => e.result === 'blocked' && e.kind === 'wall') && g2.fighters[1].hp === 100, 'parede bloqueia projétil');
  // Lançado contra a parede: rebate (não atravessa).
  const g3 = arena({blue: vec(0, -2), red: vec(0, -.2)});spawn(g3.world, {kind: 'wall', pos: {x: 0, z: 1.5}, hx: 3, hz: .3});
  g3.fighters[1].flight = {y: .5, vy: 3, horizontal: vec(0, 10)};g3.fighters[1].state = 'airborne';steps(g3, 120);
  assert.ok(g3.fighters[1].position.z < 1.2 - C.test.halfExtent + 1e-6, 'lançado rebate na parede');
  // Girada: caixa a 45°.
  const g4 = arena({blue: vec(0, -4), red: vec(9, 9)});spawn(g4.world, {kind: 'wall', pos: {x: 0, z: 0}, hx: 3, hz: .3, angle: Math.PI / 4});steps(g4, 240, () => cmd({move: vec(0, 1)}));
  assert.ok(g4.fighters[0].position.z < 0 && g4.fighters[0].position.x < -.2, 'parede girada desvia o lutador pela face');
}
ok('barreiras (dono, vida, rompimento) e paredes (bloqueiam lutadores, projéteis, lançados e funcionam giradas)');

// ---------- Explosões e efeitos radiais ----------
registerMove({id: 'teste:explosivo', name: 'Explosivo de teste', duration: .4, cost: 1, timeline: [{at: .05, spawn: {...PROJ, hit: {damage: 5}, onHit: {kind: 'area', radius: 2.5, falloff: 'linear', life: .1, hit: {damage: 20, knockback: {horizontal: 8, vertical: 5}}}}}]});
registerMove({id: 'teste:pulso', name: 'Pulso radial de teste', duration: .3, cost: 1, timeline: [{at: 0, spawn: {kind: 'area', follow: true, radius: 3, pulses: 3, interval: .2, life: .65, hit: {damage: 4}}}]});
{
  const g = arena();g.setLoadout(0, ['teste:explosivo']);g.step(cmd({skill: 0}));const ev = steps(g, 80);
  const direct = ev.find(e => e.result === 'impact' && e.damage === 5), blast = ev.find(e => e.result === 'impact' && e.damage > 5);
  assert.ok(direct && blast, 'acerto direto e explosão no ponto do impacto');assert.ok(blast.damage < 20 && blast.damage > 0, `queda linear com a distância (${blast.damage.toFixed(2)})`);
  assert.ok(blast.normal.z > .5, 'empurrão radial, do centro para fora');
  const g2 = arena({blue: vec(0, -1), red: vec(0, 1)});g2.setLoadout(0, ['teste:pulso']);g2.step(cmd({skill: 0}));const ev2 = [...g2.lastStepEvents, ...steps(g2, 120)]; // o 1º pulso sai no próprio passo do movimento
  assert.equal(ev2.filter(e => e.entity && e.result === 'impact').length, 3, '3 pulsos = 3 acertos');assert.equal(g2.fighters[0].hp, 100, 'área não atinge o dono');
}
ok('explosão no impacto (queda linear, empurrão radial) e pulsos radiais (intervalo, uma vez por alvo por pulso, sem atingir o dono)');

// ---------- Buffs e debuffs ----------
{
  const g = arena(), f = g.fighters[0], base = walkSpeed(f);
  applyStatus(f, {id: 'rapido', duration: 1, mul: {speed: 1.5}, stacking: 'stack', maxStacks: 3, tags: ['buff']});applyStatus(f, {id: 'rapido', duration: 1, mul: {speed: 1.5}, stacking: 'stack', maxStacks: 3});
  assert.ok(Math.abs(walkSpeed(f) - base * 2.25) < 1e-9, 'pilhas multiplicam (1,5²)');
  applyStatus(f, {id: 'rapido', duration: 1, mul: {speed: 1.5}, stacking: 'stack', maxStacks: 3});applyStatus(f, {id: 'rapido', duration: 1, mul: {speed: 1.5}, stacking: 'stack', maxStacks: 3});
  assert.equal(f.statuses[0].stacks, 3, 'limite de pilhas');
  const ev = steps(g, 130);assert.ok(ev.some(e => e.result === 'statusExpired') && f.statuses.length === 0 && walkSpeed(f) === base, 'expira e volta exatamente ao normal');
  const r = g.fighters[1];applyStatus(r, {id: 'veneno', duration: 1, tick: {interval: .25, damage: 3}, tags: ['debuff']}, {source: 0});
  const t = steps(g, 125).filter(e => e.result === 'statusTick');assert.equal(t.length, 4);assert.equal(r.hp, 88, '4 × 3 de dano periódico');
  applyStatus(r, {id: 'raiz', duration: .5, flags: {rooted: true}});const p0 = {...r.position};steps(g, 30, () => emptyCommand(), () => cmd({move: vec(1, 0)}));
  assert.ok(length({x: r.position.x - p0.x, z: r.position.z - p0.z}) < 1e-9 && hasFlag(r, 'rooted'), 'enraizado não anda');
  applyStatus(r, {id: 'mudo', duration: .5, flags: {silenced: true, disarmed: true}});const log = [];setAttemptSink((ff, e) => {if (ff === r) log.push(e.reason);});
  g.setLoadout(1, ['teste:projetil']);g.step(emptyCommand(), cmd({skill: 0}));g.step(emptyCommand(), cmd({tackle: true}));setAttemptSink(null);
  assert.ok(log.includes('silenced') && log.includes('disarmed') && !r.action, 'silenciado e desarmado: negados com motivo');
}
{
  // Modificadores no combate básico: ataque, dano recebido, custo de stamina e regeneração.
  const g = arena({blue: vec(0, -2.4), red: vec(0, 0)});const [a, d] = g.fighters;
  applyStatus(a, {id: 'forca', duration: 5, mul: {attack: 1.5, staminaCost: .5}});applyStatus(d, {id: 'fragil', duration: 5, mul: {damageTaken: 2}});
  const st = a.stamina;g.step(cmd({tackle: true, move: vec(0, 1)}));assert.ok(Math.abs(a.stamina - (st - .5)) < .02, 'custo de stamina reduzido à metade');
  const ev = steps(g, 80).find(e => e.result === 'impact');assert.ok(Math.abs(ev.damage - C.profiles.balanced.attack * 1.5 * 2) < 1e-9, `dano do tackle com ataque e fragilidade (${ev.damage})`);
  assert.equal(stat(a, 'attack', 20), 30);
}
ok('buffs/debuffs: pilhas e limite, expiração exata, dano periódico, enraizar, silenciar, desarmar, ataque, dano recebido e custo de stamina');

// ---------- Golpe corpo a corpo, status por movimento e encadeamento ----------
registerMove({id: 'teste:corpo', name: 'Golpe de teste', duration: .35, cost: .5, cancelFrom: ['dodge'], motion: {type: 'dash', distance: 1.2, start: 0, end: .15}, invulnerable: [0, .1],
  timeline: [{at: .1, hit: {damage: 9, range: 1.4}}, {at: .2, status: {id: 'lento', duration: .8, mul: {speed: .5}, tags: ['debuff']}, target: 'opponent'}]});
{
  const g = arena({blue: vec(0, -2.1), red: vec(0, 0)});g.setLoadout(0, ['teste:corpo']);const z0 = g.fighters[0].position.z;
  g.step(cmd({skill: 0}));assert.ok(g.fighters[0].action.kind === 'move');
  const ev = steps(g, 40);assert.ok(ev.some(e => e.result === 'impact' && e.damage === 9), 'golpe corpo a corpo acerta');
  assert.ok(g.fighters[1].statuses.some(s => s.id === 'lento'), 'debuff aplicado ao adversário');assert.ok(g.fighters[0].position.z - z0 > 1, 'deslocamento (dash)');
  const g2 = arena({blue: vec(0, -6), red: vec(5, 5)});g2.setLoadout(0, ['teste:corpo']);g2.step(cmd({dodge: true, move: vec(0, 1), dodgeDirection: vec(0, 1)}));steps(g2, 3);g2.step(cmd({skill: 0}));
  assert.equal(g2.fighters[0].action.kind, 'move', 'cancelFrom: o movimento interrompe a esquiva');
}
ok('golpe corpo a corpo, status no adversário, deslocamento e cancelamento a partir da esquiva');

// ---------- Determinismo e save/load ----------
{
  const run = cut => {
    const g = arena();g.setLoadout(0, ['teste:explosivo']);g.setLoadout(1, ['teste:pulso']);applyStatus(g.fighters[1], {id: 'veneno', duration: 2, tick: {interval: .3, damage: 1}});
    const c0 = i => i === 0 || i === 90 ? cmd({skill: 0}) : cmd({move: vec(Math.sin(i / 20), 0)}), c1 = i => i === 40 ? cmd({skill: 0}) : emptyCommand();
    for (let i = 0; i < 200; i++) {g.step(c0(i), c1(i));if (i === cut) {const s = g.save(), h = new Game();h.load(s);for (let j = i + 1; j < 200; j++) h.step(c0(j), c1(j));return JSON.stringify({f: h.fighters, w: h.world});}}
    return JSON.stringify({f: g.fighters, w: g.world});
  };
  const full = run(-1);assert.equal(run(-1), full, 'mesmos comandos, mesmo resultado');
  assert.equal(run(20), full, 'save/load com projétil no ar, status e recargas reproduz o futuro');
}
ok('determinístico e com save/load (replay) no meio de projéteis, áreas, status e recargas');
clearMoves();assert.equal(listMoves().length, 0);
resetConfig(defaults());
console.log(`\n${n} verificações da base de movimentos aprovadas.`);
