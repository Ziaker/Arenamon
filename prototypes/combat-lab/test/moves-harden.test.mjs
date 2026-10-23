// @ts-check
// Harden (genérico, Normal · Status · sem PL): +30% Defesa e knockback ofensivo 0 por 5 s, cast 0,35 s. Fonte: docs/MOVES_GENERICOS_CATALOGO.md §4.
import {assert, C, Game, cmd, vec, DT, secs, suite, arena, step, run, press, status, redTackle, fighterHash, resetConfig, factoryDefaults} from './moves-new-helpers.mjs';
import {getMove, clearMoves} from '../src/sim/moves.js';
import {clearEffects} from '../src/sim/move-effects.js';
import {isInvulnerable} from '../src/sim/entity.js';
import {hardenStatus} from '../src/sim/moves/harden.js';
import {spawn} from '../src/sim/world.js';

globalThis.__legacyFractionalDamage = true;   // este teste caracteriza a matemática de dano fracionária, anterior à regra de dano inteiro (ver sim/damage-rule.js)
const {test, done} = suite('HARDEN');
const CAST = secs(.35);

/** Azul usa Harden (opcional) e leva o Tackle do vermelho; devolve {hpLoss, displacement, launched}. */
function takeTackle({harden, tweak = null}) {
  const g = arena({equip: harden ? ['harden'] : [], setup: tweak, positions: [vec(0, -3), vec(0, -1.6)]});
  const b = g.fighters[0];
  if (harden) {press(g, 0);run(g, CAST + 2);}
  const hp0 = b.hp, p0 = {...b.position};
  g.fighters[1].position = vec(0, b.position.z + 2.2);
  const at = redTackle(g);
  run(g, 120);
  return {at, hpLoss: hp0 - b.hp, displacement: Math.hypot(b.position.x - p0.x, b.position.z - p0.z), g, b};
}

test('registrado com os dados do catálogo: 0,8 de stamina, 10 s, cast 0,35 s, sem PL; nada equipado por padrão', () => {
  const g = arena();const d = getMove('harden');
  assert.deepEqual([d.cost, d.cooldown, d.duration], [.8, 10, .35]);
  assert.ok(g.fighters.every(f => (f.loadout ?? []).every(x => !x)));
});
test('cobra stamina e cooldown ao iniciar o cast; o status só existe depois dos 0,35 s e dura 5 s', () => {
  const g = arena({equip: ['harden']});const b = g.fighters[0], s0 = b.stamina;
  press(g, 0);
  assert.ok(Math.abs((s0 - b.stamina) - .8) < .02, `stamina gasta ${s0 - b.stamina}`);
  assert.ok(Math.abs(b.moveCooldowns.harden - 10) < .02, `cooldown ${b.moveCooldowns.harden}`);
  run(g, CAST - 4);assert.equal(status(b, 'harden'), null, 'ainda em cast');
  run(g, 8);assert.ok(status(b, 'harden'), 'ativo após o cast');
  const t0 = b.statuses.find(s => s.id === 'harden').remaining;
  assert.ok(Math.abs(t0 - 5) < .06, `duração ${t0}`);
  run(g, secs(5) - 10);assert.ok(status(b, 'harden'), 'ainda ativo perto dos 5 s');
  run(g, 14);assert.equal(status(b, 'harden'), null, 'expirou');
});
test('+30% de Defesa: o dano recebido cai para exatamente 1/1,3 (convenção da passiva de Defesa)', () => {
  const base = takeTackle({harden: false}), hard = takeTackle({harden: true});
  assert.ok(base.at >= 0 && hard.at >= 0, 'o tackle conectou nos dois casos');
  assert.ok(Math.abs(hard.hpLoss / base.hpLoss - 1 / 1.3) < 1e-6, `razão ${hard.hpLoss / base.hpLoss}`);
});
test('knockback ofensivo zerado: o Tackle causa dano, mas NÃO arremessa (sem voo); sobra só o empurrão físico de corpo do atacante', () => {
  const base = takeTackle({harden: false});
  let flightSteps = 0, maxAlt = 0;
  const hard = (() => {
    const g = arena({equip: ['harden'], positions: [vec(0, -3), vec(0, -1.6)]});const b = g.fighters[0];
    press(g, 0);run(g, CAST + 2);
    const hp0 = b.hp, p0 = {...b.position};
    g.fighters[1].position = vec(0, b.position.z + 2.2);
    redTackle(g);
    for (let i = 0; i < 120; i++) {step(g);if (b.flight) {flightSteps++;maxAlt = Math.max(maxAlt, b.flight.y);}}
    return {hpLoss: hp0 - b.hp, displacement: Math.hypot(b.position.x - p0.x, b.position.z - p0.z)};
  })();
  assert.ok(base.displacement > 5, `sem Harden o alvo é arremessado (${base.displacement.toFixed(2)} m)`);
  assert.ok(maxAlt < .02 && flightSteps <= 8, `sem arremesso: só um toque de voo de altura zero, contado junto do hitstop de 0,035 s (${flightSteps} passos, ${maxAlt.toFixed(3)} m) que vira o hit stun de pouso`);
  assert.ok(hard.displacement < 1.3 && hard.displacement < base.displacement * .2, `só o contato físico de corpo desloca (${hard.displacement.toFixed(3)} m, MV-P12)`);
  assert.ok(hard.hpLoss > 0, 'o dano continua');
});
test('não concede invulnerabilidade nem imunidade a stun (dano e hit stun seguem valendo)', () => {
  const r = takeTackle({harden: true});
  assert.ok(!isInvulnerable(r.b) && r.hpLoss > 0);
});
test('projéteis também têm o knockback anulado (mesma função de acerto das entidades)', () => {
  const run1 = hard => {
    const g = arena({equip: hard ? ['harden'] : []});const b = g.fighters[0];
    if (hard) {press(g, 0);run(g, CAST + 2);}
    const p0 = {...b.position};
    spawn(g.world, {kind: 'projectile', owner: 1, pos: {x: 0, z: b.position.z + 2}, dir: {x: 0, z: -1}, speed: 14, radius: .25, y: .65, life: 2, hit: {damage: 4, knockback: {horizontal: 8, vertical: 0}}});
    run(g, 150);
    return Math.hypot(b.position.x - p0.x, b.position.z - p0.z);
  };
  assert.ok(run1(false) > .5 && run1(true) < .05);
});
test('cast interrompido antes de concluir: sem status e SEM reembolso de stamina/cooldown', () => {
  const g = arena({equip: ['harden'], positions: [vec(0, -3), vec(0, -1.2)]});const b = g.fighters[0];
  press(g, 0);const spent = b.stamina;
  redTackle(g);run(g, 60);
  assert.equal(status(b, 'harden'), null, 'o golpe interrompeu o cast');
  assert.ok(b.moveCooldowns.harden > 8, 'cooldown mantido');
  assert.ok(b.stamina <= spent + .05, 'sem reembolso');
});
test('M28.4: sliders mexidos depois do início do uso NÃO alteram o uso em andamento; o próximo uso lê o valor novo', () => {
  const g = arena({equip: ['harden']});const b = g.fighters[0];
  press(g, 0);
  C.world.harden.duration = 1;C.world.harden.cooldown = 99;C.world.harden.defensePct = 2;
  run(g, CAST + 2);
  const s = status(b, 'harden');
  assert.ok(Math.abs(s.remaining - 5) < .06, `duração capturada (${s.remaining})`);
  assert.ok(Math.abs(s.mul.damageTaken - 1 / 1.3) < 1e-9, 'defesa capturada');
  assert.ok(b.moveCooldowns.harden < 10.01, 'recarga em curso não vira 99');
  run(g, secs(11));
  press(g, 0);assert.ok(Math.abs(b.moveCooldowns.harden - 99) < .02, 'o próximo uso usa o slider novo');
});
test('sliders têm efeito: defensePct 0,6 → dano × 1/1,6; negateKnockback 0 → o alvo é lançado', () => {
  const base = takeTackle({harden: false});
  const strong = takeTackle({harden: true, tweak: () => {C.world.harden.defensePct = .6;}});
  assert.ok(Math.abs(strong.hpLoss / base.hpLoss - 1 / 1.6) < 1e-6);
  const soft = takeTackle({harden: true, tweak: () => {C.world.harden.negateKnockback = 0;}});
  assert.ok(soft.displacement > 5, 'sem a anulação o alvo é lançado');
});
test('reutilizar com o status ativo apenas renova (1 pilha), sem acumular a Defesa', () => {
  const g = arena({equip: ['harden'], setup: () => {C.world.harden.cooldown = 0;}});const b = g.fighters[0];
  press(g, 0);run(g, CAST + 2);run(g, 100);press(g, 0);run(g, CAST + 2);
  const s = status(b, 'harden');
  assert.equal(s.stacks, 1);assert.ok(Math.abs(s.mul.damageTaken - 1 / 1.3) < 1e-9);assert.ok(s.remaining > 4.9);
});
test('hardenStatus é função pura dos parâmetros (serve à prévia e à IA)', () => {
  const st = hardenStatus({duration: 5, defensePct: .3, negateKnockback: 1});
  assert.deepEqual([st.mul.knockbackTaken, +st.mul.damageTaken.toFixed(6)], [0, +(1 / 1.3).toFixed(6)]);
});
test('paridade: com Harden registrado e NÃO equipado a partida é idêntica à sem nenhum Move registrado', () => {
  const play = registered => {
    resetConfig(factoryDefaults());clearMoves();clearEffects();
    if (registered) import('../src/sim/moves/standard.js').then(m => m.registerStandardMoves());
    return null;
  };
  void play;
  const sim = reg => {
    const g = arena();if (!reg) {clearMoves();clearEffects();}
    g.mode = 'tactical';C.extras.toggles.enableEnemyAI = 1;
    for (let i = 0; i < 1500; i++) g.step(cmd(), undefined);
    return fighterHash(g);
  };
  assert.equal(sim(true), sim(false));
});
test('save/load no meio do status reproduz exatamente o futuro (determinismo)', () => {
  const play = split => {
    const g = arena({equip: ['harden']});press(g, 0);run(g, CAST + 50);
    if (split) {const snap = g.save();const h = new Game({seed: 3});h.start();h.load(snap);run(h, 300);return fighterHash(h);}
    run(g, 300);return fighterHash(g);
  };
  assert.equal(play(true), play(false));
});

done();
void DT;void step;void Game;
