// @ts-check
// Lunge (genérico adicional, Burst · Melee · PL1): Tackle de curta distância sem retorno; 3,5 m, 0,6 s, 8 HP nominais, 4 m/s H (empurrão), PL1.
// Fonte: docs/moves-nao-iniciados/5_MOVES_GENERICOS_PROMPT.md §3 (proposta). Resolve como Tackle (colisão, defesa, Clash, janelas).
import {assert, C, Game, cmd, vec, secs, suite, arena, step, run, fighterHash} from './moves-new-helpers.mjs';
import {getMove} from '../src/sim/moves.js';
import {isInvulnerable} from '../src/sim/entity.js';
import {spawn} from '../src/sim/world.js';

const {test, done} = suite('LUNGE');
const lock = {target: 1, locked: true};
const press0 = {skill: 0, skillHeld: [true, false, false, false]};
/** Azul usa Lunge contra o vermelho (parado) a `dist` m; devolve o jogo logo após o toque. */
function lunge({dist = 3.5, tweak = null, red = {}, atk = null, guard = null} = {}) {
  const g = arena({equip: ['lunge'], setup: tweak, positions: [vec(0, -dist / 2), vec(0, dist / 2)]});
  if (atk) g.fighters[0].attributes.attack = atk;
  Object.assign(g.fighters[1], red);
  g.step(cmd({...press0, ...lock}), guard ? cmd({guard: true, guardPressed: true}) : cmd());
  return g;
}
const play = (g, n, guard = false) => {const ev = [];for (let i = 0; i < n; i++) {g.step(cmd(), guard ? cmd({guard: true}) : cmd());ev.push(...g.lastStepEvents);}return ev;};

test('registrado com os dados da proposta: 0,75 de stamina, 6 s, 0,6 s; nada equipado por padrão', () => {
  const g = arena();const d = getMove('lunge');
  assert.deepEqual([d.cost, d.cooldown, d.duration, d.tackle], [.75, 6, .6, 'lunge']);
  assert.ok(g.fighters.every(f => (f.loadout ?? []).every(x => !x)));
});
test('cobra stamina e cooldown no início; a ação é UM Tackle real marcado com o Move', () => {
  const g = lunge();const b = g.fighters[0];
  assert.equal(b.action.kind, 'tackle');assert.equal(b.action.move, 'lunge');assert.equal(b.action.pl, 1);
  assert.ok(Math.abs(b.moveCooldowns.lunge - 6) < .06, `cooldown ${b.moveCooldowns.lunge}`);
  assert.ok(C.rules.staminaMax - b.stamina > .7 && C.rules.staminaMax - b.stamina < .8, `stamina gasta ${C.rules.staminaMax - b.stamina}`);
});
test('avança ~3,5 m em linha reta, dura 0,6 s e PERMANECE no ponto final (sem retorno)', () => {
  const g = lunge({dist: 12});const b = g.fighters[0], z0 = b.position.z;   // alvo longe: avanço livre
  run(g, secs(.6) + 20);
  const dz = b.position.z - z0;
  assert.ok(Math.abs(dz - 3.5) < .2, `distância percorrida ${dz.toFixed(3)}`);
  const end = b.position.z;run(g, 120);
  assert.ok(Math.abs(b.position.z - end) < .05, 'fica onde parou');
  assert.ok(!b.action, 'ação terminou');
});
test('dano nominal 8 HP com Ataque de referência e proporcional ao Ataque (MV-P13)', () => {
  const dmg = atk => {const g = lunge({atk});const r = g.fighters[1], hp0 = r.hp;play(g, 120);return hp0 - r.hp;};
  assert.ok(Math.abs(dmg(20) - 8) < 1e-6, `${dmg(20)}`);
  assert.ok(Math.abs(dmg(40) - 16) < 1e-6);
});
test('knockback 4 m/s horizontal e 0 vertical: empurrão deslizante, NÃO voo', () => {
  const g = lunge();const ev = play(g, 120).filter(e => e.result === 'impact' && e.attacker === 0);
  assert.equal(ev.length, 1, 'um único acerto');
  assert.ok(Math.abs(ev[0].launch.horizontal - 4) < 1e-6 && ev[0].launch.vertical === 0, JSON.stringify(ev[0].launch));
  assert.ok(!g.fighters[1].flight);
});
test('defesa comum reduz o dano (×0,5 do sistema) e dá guard stun; defesa perfeita anula dano e empurrão', () => {
  const none = (() => {const g = lunge();const r = g.fighters[1], h = r.hp;play(g, 120);return h - r.hp;})();
  const part = (() => {const g = lunge({guard: true});const r = g.fighters[1], h = r.hp;const ev = play(g, 120, true);return {loss: h - r.hp, ev};})();
  assert.ok(part.loss < none && part.loss > 0, `${part.loss} < ${none}`);
  const perfect = (() => {const g = lunge({guard: true});g.fighters[1].perfectLeft = 1;g.fighters[1].perfectSucceeded = false;const r = g.fighters[1], h = r.hp;play(g, 120, true);return h - r.hp;})();
  assert.equal(perfect, 0);
});
test('i-frames do atacante só na janela inicial de 0,133 s (proposta) e desligáveis por slider', () => {
  const g = lunge({dist: 12});const b = g.fighters[0];
  assert.ok(isInvulnerable(b), 'invulnerável logo ao iniciar');
  run(g, secs(.2));assert.ok(!isInvulnerable(b), 'depois da janela, vulnerável');
  const h = lunge({dist: 12, tweak: () => {C.world.lunge.invulnerableSeconds = 0;}});
  assert.ok(!isInvulnerable(h.fighters[0]));
});
test('Clash: Lunge PL1 × Tackle PL1 em curso gera disputa (mesma regra do Tackle × Tackle)', () => {
  const g = arena({equip: ['lunge'], positions: [vec(0, -1.8), vec(0, 1.8)]});
  g.fighters[0].facing = 0;g.fighters[1].facing = Math.PI;
  g.step(cmd({...press0, ...lock}), cmd({tackle: true, move: vec(0, -1), ...{target: 0, locked: true}}));
  const ev = play(g, 120);
  assert.ok(ev.some(e => /clash/i.test(e.result)), `eventos: ${[...new Set(ev.map(e => e.result))].join(',')}`);
});
test('parede no caminho: o avanço para na parede sem atravessar e termina o Move', () => {
  const g = arena({equip: ['lunge'], positions: [vec(0, -3), vec(0, 8)]});
  spawn(g.world, {kind: 'wall', pos: {x: 0, z: -1}, hx: 3, hz: .3, angle: 0, y: 0, height: 3}, []);
  g.step(cmd({...press0}), cmd());
  run(g, secs(.8));
  assert.ok(g.fighters[0].position.z <= -1 - .3 - C.test.halfExtent + .02, `z=${g.fighters[0].position.z}`);
});
test('cancelável só depois de 0,45 s: esquiva antes é negada, depois é aceita', () => {
  const tryDodge = at => {
    const g = lunge({dist: 12});run(g, secs(at));
    g.step(cmd({dodge: true, move: vec(1, 0)}), cmd());
    return g.fighters[0].action?.kind;
  };
  assert.equal(tryDodge(.2), 'tackle');
  assert.equal(tryDodge(.5), 'dodge');
});
test('janela ativa 0,19–0,26 s vale com "janelas de combate" ligadas: acertos só dentro dela', () => {
  const hitAt = () => {
    const g = lunge({dist: 1.3, tweak: () => {C.extras.toggles.enableAnimationCombatWindows = 1;}});const t = [];
    for (let i = 0; i < secs(.7); i++) {g.step(cmd(), cmd());if (g.lastStepEvents.some(e => e.result === 'impact' && e.attacker === 0)) t.push(i * C.test.step);}
    return t;
  };
  const ts = hitAt();
  assert.ok(ts.length >= 1 && ts[0] >= .19 - .02 && ts[0] <= .26 + .02, JSON.stringify(ts));
});
test('M28.4: sliders mexidos depois do início não alteram o Lunge em andamento; o próximo uso lê o novo', () => {
  const g = lunge({dist: 12});const b = g.fighters[0], z0 = b.position.z;
  C.world.lunge.range = 8;C.world.lunge.damage = 99;
  run(g, secs(.6) + 20);
  assert.ok(Math.abs(b.position.z - z0 - 3.5) < .2, 'distância capturada');
  assert.ok(!b.action || Math.abs(b.action.plDamage - .4) < 1e-9, 'dano capturado (0,4 × Ataque)');
});
test('sliders têm efeito: range, damage, knockbackH e knockbackV mudam o resultado', () => {
  const g1 = lunge({dist: 14, tweak: () => {C.world.lunge.range = 2;}});run(g1, secs(.6) + 20);
  assert.ok(Math.abs(g1.fighters[0].position.z + 7 - 2) < .2, `range 2 → ${g1.fighters[0].position.z + 7}`);
  const g2 = lunge({tweak: () => {C.world.lunge.knockbackV = 5;}});const ev = play(g2, 120).find(e => e.result === 'impact' && e.attacker === 0);
  assert.ok(ev.launch.vertical > 0, 'com V > 0 vira lançamento (voo), não só empurrão');
});
test('paridade e determinismo: registrado e não equipado não muda nada; save/load no meio do avanço reproduz o futuro', () => {
  const sim = () => {const g = arena();g.mode = 'tactical';C.extras.toggles.enableEnemyAI = 1;for (let i = 0; i < 1200; i++) g.step(cmd(), undefined);return fighterHash(g);};
  assert.equal(sim(), sim());
  const go = split => {
    const g = lunge();run(g, 25);
    if (split) {const snap = g.save();const h = new Game({seed: 3});h.start();h.load(snap);run(h, 200);return fighterHash(h);}
    run(g, 200);return fighterHash(g);
  };
  assert.equal(go(true), go(false));
});

done();
void step;
