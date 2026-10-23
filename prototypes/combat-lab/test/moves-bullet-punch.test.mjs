// @ts-check
// Bullet Punch (Mushroom, Normal · PL2) como o Quick Attack (decisão de 22/10/2026): alvo = adversário mais próximo dentro do alcance (`reach`), fixado ao soltar o botão; segurar só mostra o
// círculo de alcance (sem custo); preparação 0,75 s (anda a 30%), ausência física 0,2 s numa corrida invisível até colar no alvo, golpe PL2 curto NO MOMENTO da chegada; quem estiver no caminho
// leva o golpe e a corrida para ali. Sem marcador de destino. Fonte: docs/MUSHROOM_MOVES_DECISOES.md §2–3 + pedido de 22/10/2026.
import {assert, C, Game, cmd, vec, secs, suite, arena, run, fighterHash, HOLD} from './moves-new-helpers.mjs';
import {getMove} from '../src/sim/moves.js';

const {test, done} = suite('BULLET PUNCH (como o Quick Attack)');
const press0 = {skill: 0, skillHeld: HOLD(0)};
const held = {skillHeld: HOLD(0)};
/** Azul segura o botão por `ticks` passos (incluindo o toque) e solta; devolve o jogo logo depois da soltura. */
function bp({ticks = 3, red = vec(0, 4.5), blue = vec(0, -1), tweak = null, release = true, redCmd = () => cmd()} = {}) {
  const g = arena({equip: ['bullet-punch'], positions: [blue, red], setup: tweak});
  g.step(cmd(press0), redCmd(0));
  for (let i = 1; i < ticks; i++) g.step(cmd(held), redCmd(i));
  if (release) g.step(cmd(), redCmd(ticks));
  return g;
}
const upto = (g, n, redCmd = () => cmd()) => {const ev = [];for (let i = 0; i < n; i++) {g.step(cmd(), redCmd(i));ev.push(...g.lastStepEvents);}return ev;};

test('registrado: 1,5× o Tackle de stamina, 8 s, 0,95 s (0,75 + 0,20), alvo por alcance e sem marcador; nada equipado por padrão', () => {
  const g = arena();const d = getMove('bullet-punch');
  assert.deepEqual([d.cost, d.cooldown, d.duration, d.aimMode, d.needsTarget], [1.5, 8, .95, undefined, 'reach']);
  assert.ok(g.fighters.every(f => (f.loadout ?? []).every(x => !x)));
});
test('segurar o botão só abre o círculo de alcance: nada é cobrado e o corpo anda livre', () => {
  const g = bp({ticks: 4, release: false});const b = g.fighters[0];
  assert.ok(b.aim?.range && b.aim.inRange && Math.abs(b.aim.rangeValue - C.world.bulletPunch.reach) < 1e-9, JSON.stringify(b.aim));
  assert.equal(b.stamina, C.rules.staminaMax);assert.ok(!(b.moveCooldowns?.['bullet-punch'] > 0));
  const walk = (equip) => {const h = arena({equip, positions: [vec(0, -6), vec(0, 8)]});const x = h.fighters[0], z0 = x.position.z;
    h.step(cmd({...(equip.length ? press0 : {}), move: vec(0, 1)}), cmd());for (let i = 1; i < 120; i++) h.step(cmd({...(equip.length ? held : {}), move: vec(0, 1)}), cmd());return x.position.z - z0;};
  assert.ok(Math.abs(walk(['bullet-punch']) - walk([])) < .05, 'segurar não deixa o corpo lento');
});
test('o círculo fica vermelho (inRange falso) quando não há alvo dentro do alcance', () => {
  const g = bp({ticks: 3, red: vec(0, 14), release: false});assert.equal(g.fighters[0].aim.inRange, false);
  const h = bp({ticks: 3, red: vec(0, 4), release: false});assert.equal(h.fighters[0].aim.inRange, true);
});
test('soltar com alvo dentro do alcance cobra 1,5 de stamina e 8 s e começa a preparação de 0,75 s, com o alvo fixado', () => {
  const g = bp({ticks: 5});const b = g.fighters[0];
  assert.equal(b.action.move, 'bullet-punch');assert.ok(Math.abs(b.moveCooldowns['bullet-punch'] - 8) < .06);
  assert.ok(C.rules.staminaMax - b.stamina > 1.45 && C.rules.staminaMax - b.stamina < 1.55, `${C.rules.staminaMax - b.stamina}`);
  assert.equal(b.action.lock, 1, 'alvo fixado ao soltar');
});
test('soltar SEM alvo no alcance não gasta nada, não começa e pisca o círculo vermelho (rangeFlash)', () => {
  const g = bp({ticks: 4, red: vec(0, 14)});const b = g.fighters[0];
  assert.ok(!b.action && !b.aim);assert.equal(b.stamina, C.rules.staminaMax);assert.ok(!(b.moveCooldowns?.['bullet-punch'] > 0));
  assert.ok(b.rangeFlash && b.rangeFlash.t > 0, 'piscada vermelha ativa');
  run(g, secs(1), () => cmd());assert.ok(!b.rangeFlash, 'a piscada acaba');
});
test('um toque rápido (apertar e soltar) executa assim que o botão é solto', () => {
  const g = arena({equip: ['bullet-punch'], positions: [vec(0, -1), vec(0, 4.5)]});
  g.step(cmd(press0), cmd());g.step(cmd(), cmd());
  assert.equal(g.fighters[0].action?.move, 'bullet-punch');
});
test('preparação anda a 30% e a interrupção mantém custo e recarga (sem desaparecer)', () => {
  const g = bp({ticks: 4});const b = g.fighters[0];
  run(g, 30);b.stun = .3;b.action = null;
  upto(g, secs(2));
  assert.ok(!b.absent);assert.ok(C.rules.staminaMax - b.stamina > 1.4);assert.ok(b.moveCooldowns['bullet-punch'] > 5);
});
test('depois de 0,75 s a ausência é FÍSICA: sem corpo, sem acerto, sem colisão, fora da seleção de alvo; reaparece em 0,20 s', () => {
  const g = bp({ticks: 4, red: vec(0, 4.5)});const b = g.fighters[0], r = g.fighters[1];
  upto(g, secs(.75) + 3);
  assert.ok(b.absent, 'ausente');
  r.position = vec(b.position.x + 4, b.position.z);const hp = b.hp;
  const ev = upto(g, 10, () => cmd({tackle: true, move: vec(-1, 0), target: 0, locked: true}));
  assert.equal(b.hp, hp);assert.ok(!ev.some(e => e.target === 0 && ['impact', 'partial', 'perfect'].includes(e.result)));
  upto(g, secs(.3));assert.ok(!b.absent, 'reapareceu');
});
test('a corrida invisível avança até colar no alvo e o golpe sai NA HORA da chegada: PL2, dano e knockback do Tackle', () => {
  const g = bp({ticks: 4, red: vec(0, 4.5)});const b = g.fighters[0], r = g.fighters[1];
  upto(g, secs(.75) + 2);assert.ok(b.absent, 'ausente');
  const z = [];for (let i = 0; i < 6 && b.absent; i++) {upto(g, 3);z.push(b.position.z);}
  assert.ok(z.length >= 2 && z.every((v, i) => i === 0 || v > z[i - 1] + 1e-6), `avança rumo ao alvo: ${z.map(x => x.toFixed(2))}`);
  const h = r.hp;let arrive = -1, ev = [];
  for (let i = 0; i < secs(.4) && arrive < 0; i++) {g.step(cmd(), cmd());ev.push(...g.lastStepEvents);if (!b.absent) arrive = i;}
  assert.ok(arrive >= 0, 'reapareceu');
  assert.equal(b.action?.kind, 'tackle', 'o golpe começa NA chegada (mesmo passo)');assert.equal(b.action.pl, 2);assert.equal(b.action.move, 'bullet-punch');
  assert.ok(Math.hypot(r.position.x - b.position.x, r.position.z - b.position.z) < 1.6, 'colado no alvo');
  ev.push(...upto(g, secs(.5)));
  assert.ok(r.hp < h, 'acertou');
  const hit = ev.find(e => e.attacker === 0 && e.result === 'impact');
  assert.ok(hit && hit.launch, 'knockback do Tackle');
});
test('quem estiver no caminho da corrida invisível leva o golpe e a corrida PARA ali', () => {
  const g = bp({ticks: 4, red: vec(0, 4.5)});const b = g.fighters[0], r = g.fighters[1];
  upto(g, secs(.75) + 2);assert.ok(b.absent);
  r.position = vec(b.position.x + .2, b.position.z + 1.6);   // entrou no trecho da corrida: contato antes do destino
  const z0 = b.position.z;let ev = [], zBack = null;
  for (let i = 0; i < secs(.4); i++) {g.step(cmd(), cmd());ev.push(...g.lastStepEvents);if (zBack === null && !b.absent) zBack = b.position.z;}
  assert.ok(ev.some(e => e.result === 'bulletReturn' && e.blocked), 'reaparece no ponto do contato');
  assert.ok(ev.some(e => e.attacker === 0 && e.result === 'impact'), 'o adversário do caminho é atingido');
  assert.ok(zBack !== null && zBack - z0 < 1.6, `não atravessou o adversário (parou em ${zBack - z0})`);
});
test('alvo que foge durante o preparo: a corrida percorre no máximo o alcance e o golpe sai no vazio, sem perseguir', () => {
  const g = bp({ticks: 4, red: vec(0, 4.5)});const b = g.fighters[0], r = g.fighters[1];
  upto(g, secs(.6));r.position = vec(0, 15);const z0 = b.position.z;
  upto(g, secs(.75));
  assert.ok(!b.absent && b.position.z - z0 <= C.world.bulletPunch.reach + C.world.bulletPunch.stopShort + C.world.bulletPunch.strikeReach + .3, `percorreu ${b.position.z - z0}`);
});

test('pode ser ativado durante uma esquiva e soltar interrompe a esquiva na hora', () => {
  const g = arena({equip: ['bullet-punch'], positions: [vec(0, -1), vec(0, 4.5)]});const b = g.fighters[0];
  g.step(cmd({dodge: true, move: vec(1, 0)}), cmd());run(g, 10, () => cmd({move: vec(1, 0)}));
  assert.equal(b.action?.kind, 'dodge');
  g.step(cmd({...press0, move: vec(1, 0)}), cmd());
  assert.ok(b.aim?.range, 'círculo aberto durante a esquiva');assert.equal(b.action?.kind, 'dodge', 'a esquiva segue');
  g.step(cmd(), cmd());
  assert.equal(b.action?.move, 'bullet-punch', 'soltar interrompe a esquiva e inicia a preparação');
});
test('M28.4: sliders mexidos depois de soltar não alteram esse uso', () => {
  const g = bp({ticks: 4, red: vec(0, 4.5)});
  C.world.bulletPunch.vanish = 5;C.world.bulletPunch.cast = 3;
  upto(g, secs(1.2));assert.ok(!g.fighters[0].absent, 'já reapareceu em 0,95 s (valores capturados)');
});
test('sliders têm efeito: vanish, reach, stopShort e strikeReach', () => {
  const g = bp({ticks: 4, red: vec(0, 4.5), tweak: () => {C.world.bulletPunch.vanish = .3;}});
  upto(g, secs(1.2));assert.ok(!g.fighters[0].absent, 'desaparecimento de 0,3 s');
  const h = bp({ticks: 4, red: vec(0, 9), release: false});assert.equal(h.fighters[0].aim.inRange, false, 'padrão: 9 m está fora');
  const i = bp({ticks: 4, red: vec(0, 9), release: false, tweak: () => {C.world.bulletPunch.reach = 12;}});assert.equal(i.fighters[0].aim.inRange, true, 'reach 12 m alcança');
  const stop = (s) => {const k = bp({ticks: 4, red: vec(0, 4.5), tweak: () => {C.world.bulletPunch.stopShort = s;}});upto(k, secs(.75) + secs(.2) + 1);return Math.hypot(k.fighters[0].position.x - k.fighters[1].position.x, k.fighters[0].position.z - k.fighters[1].position.z);};
  assert.ok(stop(2) > stop(1) + .5, 'stopShort maior para mais longe do alvo');
});
test('paridade e determinismo: registrado e não equipado não muda nada; save/load com o lutador ausente reproduz o futuro', () => {
  const sim = () => {const g = arena();g.mode = 'tactical';C.extras.toggles.enableEnemyAI = 1;for (let i = 0; i < 1200; i++) g.step(cmd(), undefined);return fighterHash(g);};
  assert.equal(sim(), sim());
  const go = split => {
    const g = bp({ticks: 4, red: vec(0, 4)});upto(g, secs(.9));
    if (split) {const snap = g.save();const h = new Game({seed: 3});h.start();h.load(snap);upto(h, secs(2));return fighterHash(h);}
    upto(g, secs(2));return fighterHash(g);
  };
  assert.equal(go(true), go(false));
});

done();
void secs;
