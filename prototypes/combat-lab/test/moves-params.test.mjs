// Cobertura dos sliders da aba Moves: todo parâmetro de C.world.{charge,reflect,psyshock,beam} que a simulação LÊ tem controle com rótulo,
// faixa e unidade, e cada controle novo altera de fato o resultado do Move. Roda em Node, sem navegador.
import assert from 'node:assert/strict';
import {readdirSync, readFileSync, statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {C, defaults, resetConfig} from '../src/sim/config.js';
import {Game} from '../src/sim/game.js';
import {emptyCommand} from '../src/sim/entity.js';
import {vec} from '../src/sim/math.js';
import {registerStandardMoves} from '../src/sim/moves/standard.js';
import {spawn} from '../src/sim/world.js';
import {MOVES_PARAMS} from '../src/ui/moves-panel.js';

let n = 0;const ok = l => {n++;console.log('✓', l);};
registerStandardMoves();
const cmd = o => ({...emptyCommand(), ...o});
const HOLD = i => [0, 1, 2, 3].map(k => k === i);
function arena(setup) {
  resetConfig(defaults());setup?.();
  const g = new Game();g.mode = 'inactive';g.reset({positions: [vec(0, -3), vec(0, 3)]});g.fighters[0].facing = 0;g.fighters[1].facing = Math.PI;g.setLoadout(0, ['reflect', 'psyshock']);
  // Estes testes medem os efeitos dos sliders dos Moves: o mundo fica neutro (objetos no
  // caminho gastariam stamina da IA e distorceriam contagens de decisão).
  g.mapState.platforms = [];g.mapState.obstacles = [];g.mapState.destructibles = [];g.mapState.items = [];
  return g;
}
const step = (g, c = cmd()) => g.step(c, cmd());
/** Segura o slot por `ticks` passos e solta. */
function hold(g, slot, ticks) {step(g, cmd({skill: slot, skillHeld: HOLD(slot)}));for (let i = 1; i < ticks; i++) step(g, cmd({skillHeld: HOLD(slot)}));step(g, cmd());}
const stones = (g, ticks = 96) => {hold(g, 1, ticks);return g.world.entities.filter(e => e.kind === 'projectile' && e.exec != null);};
const mean = a => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);
const sdOf = a => {const m = mean(a);return Math.sqrt(mean(a.map(v => (v - m) ** 2)));};

// ---------- Cobertura: nada que a simulação lê fica sem slider ----------
const NEW = new Set(['reflect.burstRadius', 'reflect.burstForce', 'reflect.burstDamage', 'reflect.burstPush', 'reflect.burstHurt', 'psyshock.knockbackVertical', 'psyshock.knockbackLevelBonus', 'psyshock.knockbackSpeedFactor', 'reflect.minCharge', 'psyshock.searchStep', 'psyshock.arc', 'psyshock.ringMin', 'psyshock.ringMax', 'psyshock.heightMin', 'psyshock.heightMax', 'psyshock.scaleMin', 'psyshock.scaleMax']);
const GROUPS = ['charge', 'reflect', 'psyshock', 'beam', 'ai', 'harden', 'secondWind'];
const rows = new Map(MOVES_PARAMS.flatMap(([, list]) => list).map(r => [`${r[0]}.${r[1]}`, r]));
/** Chaves da configuração que NENHUM código da simulação ou da visão lê (campos legados): sem leitor, um slider seria controle morto. */
const UNUSED = new Set([]);
function sourceFiles(dir) {return readdirSync(dir).flatMap(f => {const p = dir + '/' + f;return statSync(p).isDirectory() ? sourceFiles(p) : /\.js$/.test(f) ? [p] : [];});}
{
  const src = sourceFiles(fileURLToPath(new URL('../src', import.meta.url))).filter(f => !/sim[\/]config\.js$/.test(f)).map(f => readFileSync(f, 'utf8')).join('\n');
  const missing = [], deadButListed = [];
  for (const g of GROUPS) for (const k of Object.keys(C.world[g])) {
    const id = `${g}.${k}`, used = new RegExp(`\b${k}\b`).test(src);
    if (UNUSED.has(id)) {if (used) deadButListed.push(id);continue;}
    if (!rows.has(id)) missing.push(id);
  }
  assert.deepEqual(missing, [], 'parâmetros lidos pela simulação sem slider na aba Moves: ' + missing.join(', '));
  assert.deepEqual(deadButListed, [], 'agora são lidos: crie o slider e tire de UNUSED: ' + deadButListed.join(', '));
}
ok('todo parâmetro dos Moves que o código lê tem slider (os 2 campos legados sem leitor ficam de fora de propósito)');
{
  for (const [id, [g, k, label, tip, min, max, stepv, fmt]] of rows) {
    const v = defaults().world[g][k];
    assert.ok(label.length > 3 && tip.length > 10, `${id}: rótulo e descrição`);
    assert.ok(stepv > 0 && max > min, `${id}: faixa válida`);
    assert.ok(v >= min - 1e-9 && v <= max + 1e-9, `${id}: padrão ${v} fora de ${min}..${max}`);
    assert.ok(/\d/.test(fmt(v)), `${id}: formato mostra o valor (${fmt(v)})`);
    if (NEW.has(id)) assert.ok(/[a-z°%×]/i.test(fmt(v).replace(/[\d.\s]/g, '')) && !/^\d+(\.\d+)?$/.test(fmt(v)), `${id}: formato com unidade (${fmt(v)})`);
  }
}
ok('cada slider tem rótulo, descrição, faixa que contém o padrão e formato com unidade');

// ---------- Efeito real dos controles novos ----------
{
  const spread = arc => {const g = arena(() => {C.world.psyshock.arc = arc;}), s = stones(g, 480);return sdOf(s.map(e => Math.atan2(e.pos.x - g.fighters[0].position.x, e.pos.z - g.fighters[0].position.z)));};
  assert.ok(spread(300) > spread(30) * 2, `abertura do arco: ${spread(30).toFixed(3)} → ${spread(300).toFixed(3)}`);
}
ok('psyshock.arc: abrir o arco espalha as pedras ao redor do lançador');
{
  const dist = (min, max) => {const g = arena(() => {C.world.psyshock.ringMin = min;C.world.psyshock.ringMax = max;}), s = stones(g, 480);return mean(s.map(e => Math.hypot(e.pos.x - g.fighters[0].position.x, e.pos.z - g.fighters[0].position.z)));};
  assert.ok(dist(2, 2.2) > dist(.4, .5) + 1, `anel: ${dist(.4, .5).toFixed(2)} → ${dist(2, 2.2).toFixed(2)}`);
}
ok('psyshock.ringMin/ringMax: a distância de saída das pedras acompanha o anel');
{
  const alt = (min, max) => mean(stones(arena(() => {C.world.psyshock.heightMin = min;C.world.psyshock.heightMax = max;}), 480).map(e => e.y));
  assert.ok(alt(1.6, 1.8) > alt(.1, .2) + 1, `altura: ${alt(.1, .2).toFixed(2)} → ${alt(1.6, 1.8).toFixed(2)}`);
}
ok('psyshock.heightMin/heightMax: a altura inicial das pedras acompanha os limites');
{
  const sz = (min, max) => {const s = stones(arena(() => {C.world.psyshock.scaleMin = min;C.world.psyshock.scaleMax = max;}), 480);return {v: mean(s.map(e => e.visualScale)), r: new Set(s.map(e => e.radius)).size};};
  const a = sz(.4, .5), b = sz(2.5, 2.8);
  assert.ok(b.v > a.v * 3, `tamanho visual: ${a.v.toFixed(2)} → ${b.v.toFixed(2)}`);assert.equal(a.r, 1);assert.equal(b.r, 1, 'a colisão (raio) continua igual (M30.2)');
}
ok('psyshock.scaleMin/scaleMax: mudam só o tamanho visual, nunca o raio de colisão');
{
  // Parede à frente do lançador cobre o anel: a busca avança em passos de searchStep até achar espaço.
  const forward = stepv => {const g = arena(() => {C.world.psyshock.searchStep = stepv;C.world.psyshock.searchRange = 3;C.world.psyshock.arc = 40;});
    spawn(g.world, {kind: 'wall', shape: 'box', pos: {x: 0, z: -2.1}, hx: 3, hz: .3, angle: 0, y: 0, height: 2, life: 99}, g.lastStepEvents);
    const s = stones(g, 96);return s.length ? mean(s.map(e => e.pos.z)) : null;};
  const fine = forward(.1), coarse = forward(1);
  assert.ok(fine !== null && coarse !== null && fine !== coarse, `busca: ${fine} × ${coarse}`);
  assert.ok(coarse > fine + .15, `passo grosso salta o espaço livre mais perto: ${fine?.toFixed(2)} → ${coarse?.toFixed(2)}`);
}
ok('psyshock.searchStep: o passo da busca muda onde as pedras acham espaço livre');
{
  const made = (minC, seconds) => {const g = arena(() => {C.world.reflect.minCharge = minC;});hold(g, 0, Math.round(seconds * 120));return g.world.entities.some(e => e.kind === 'barrier');};
  assert.equal(made(.3, .6), true, 'com carga mínima de 0,3 s, segurar 0,6 s materializa');
  assert.equal(made(2.5, 1.5), false, 'com carga mínima de 2,5 s, segurar 1,5 s falha');
  assert.equal(made(2.5, 2.8), true, 'segurando além da carga mínima materializa');
}
ok('reflect.minCharge: define o tempo mínimo segurando para a barreira nascer');
{
  const kbOf = (cfg, ticks = 96) => stones(arena(() => Object.assign(C.world.psyshock, cfg)), ticks).map(e => e.hit.knockback);
  const base = kbOf({});
  assert.ok(base.every(k => k.vertical === 0 && Math.abs(k.horizontal - .3) < 1e-9), 'padrão inalterado: 0,3 m/s horizontal, 0 vertical');
  assert.ok(kbOf({knockbackVertical: 2}).every(k => k.vertical === 2), 'lançamento vertical por pedra');
  const pl1 = kbOf({knockbackLevelBonus: 1}, 10), pl3 = kbOf({knockbackLevelBonus: 1}, 480);
  assert.ok(Math.abs(pl1[0].horizontal - .3) < 1e-9 && Math.abs(pl3[0].horizontal - .3 * 3) < 1e-9, `bônus por PL: PL1 ${pl1[0].horizontal} · PL3 ${pl3[0].horizontal}`);
  const sp = kbOf({knockbackSpeedFactor: 1}, 480).map(k => k.horizontal);
  assert.ok(Math.max(...sp) - Math.min(...sp) > .01, 'empurrão varia com a velocidade sorteada da pedra');
  assert.equal(new Set(kbOf({}, 480).map(k => k.horizontal.toFixed(6))).size, 1, 'sem o fator, todas as pedras empurram igual');
  assert.equal(MOVES_PARAMS.flatMap(g => g[1]).find(r => r[1] === 'knockbackPerStone')[5], 10);
  assert.equal(MOVES_PARAMS.flatMap(g => g[1]).find(r => r[1] === 'knockbackCap')[5], 10);
}
ok('psyshock: limites de knockback até 10 e novos controles (vertical, bônus por PL, velocidade da pedra) alteram o empurrão real');

{
  // Pulso ao invocar o Reflect: alcance, força, dano e os dois interruptores.
  const burst = cfg => {
    const g = arena(() => Object.assign(C.world.reflect, cfg)), evs = [], st = c => {g.step(c, cmd());evs.push(...g.lastStepEvents);};
    g.fighters[1].position.x = 0;g.fighters[1].position.z = 2;                       // adversário perto da barreira
    st(cmd({skill: 0, skillHeld: HOLD(0)}));for (let i = 1; i < 200; i++) st(cmd({skillHeld: HOLD(0)}));st(cmd());for (let i = 0; i < 6; i++) st(cmd());
    const hits = evs.filter(e => e.result === 'impact' && e.target === 1);
    return {made: g.world.entities.some(e => e.kind === 'barrier'), hits, hp: g.fighters[1].hp, kb: hits.map(h => h.launch?.horizontal ?? 0).reduce((a, b) => a + b, 0), dmg: hits.reduce((a, h) => a + h.damage, 0), barrierAlive: g.world.entities.some(e => e.kind === 'barrier' && !e.dead)};
  };
  const off = burst({}), noRadius = burst({burstRadius: 0, burstPush: 1, burstHurt: 1, burstDamage: 1}), pushOnly = burst({burstRadius: 10, burstPush: 1, burstForce: 4}), hurtOnly = burst({burstRadius: 10, burstHurt: 1, burstDamage: .5}), both = burst({burstRadius: 10, burstPush: 1, burstForce: 4, burstHurt: 1, burstDamage: .5});
  assert.ok(off.made && off.hits.length === 0 && off.hp === 100, 'padrão: sem pulso');
  assert.equal(noRadius.hits.length, 0, 'raio 0 desliga o pulso mesmo com os interruptores ligados');
  assert.ok(pushOnly.hits.length === 1 && pushOnly.kb > 0 && pushOnly.dmg === 0 && pushOnly.hp === 100, `só empurrão: ${JSON.stringify({kb: pushOnly.kb, dmg: pushOnly.dmg, hits: pushOnly.hits.length})}`);
  assert.ok(hurtOnly.hits.length === 1 && hurtOnly.dmg > 0 && hurtOnly.kb === 0 && hurtOnly.hp < 100, `só dano: ${JSON.stringify({kb: hurtOnly.kb, dmg: hurtOnly.dmg, hp: hurtOnly.hp})}`);
  assert.ok(both.kb > 0 && both.dmg > 0, 'os dois juntos');
  assert.ok(both.barrierAlive && both.made, 'o pulso não quebra a própria barreira');
  assert.equal(burst({burstRadius: .5, burstPush: 1, burstForce: 4}).hits.length, 0, 'alcance curto não atinge quem está longe');
  const weak = burst({burstRadius: 10, burstPush: 1, burstForce: 1}), strong = burst({burstRadius: 10, burstPush: 1, burstForce: 6});
  assert.ok(strong.kb > weak.kb * 2, `a força muda o empurrão: ${weak.kb} → ${strong.kb}`);
  const d1 = burst({burstRadius: 10, burstHurt: 1, burstDamage: .2}), d2 = burst({burstRadius: 10, burstHurt: 1, burstDamage: 1});
  assert.ok(d2.dmg > d1.dmg * 2, `o dano muda: ${d1.dmg} → ${d2.dmg}`);
}
ok('reflect: pulso ao invocar (alcance 0–10 m, força, dano e interruptores de empurrão e dano) altera o resultado real');

{
  // IA com Moves: os parâmetros da aba Moves mudam as decisões reais do adversário.
  const starts = cfg => {
    const g = arena(() => Object.assign(C.world.ai, cfg)), evs = [];
    g.setLoadout(1, ['reflect', 'psyshock']);g.mode = 'tactical';g.fighters[1].position.z = 6;g.fighters[0].position.z = -6;
    for (let i = 0; i < 1500; i++) {g.step(cmd(), g.brain.command(g.fighters[1], g.fighters[0], 'tactical', C.test.step));evs.push(...g.lastStepEvents);}
    return evs.filter(e => e.result === 'chargeStart' && e.attacker === 1 && e.move === 'psyshock').length;
  };
  const base = starts({});
  assert.ok(base > 0, 'padrão: a IA usa o Psyshock de longe (' + base + ')');
  assert.equal(starts({psyshockMinDistance: 30}), 0, 'distância mínima maior que a arena: nunca usa');
  assert.equal(starts({psyshockMinStamina: 6}), 0, 'stamina mínima acima do máximo: nunca usa');
  assert.equal(starts({psyshockChanceMax: 0}), 0, 'chance máxima 0: nunca usa');
  // decisionInterval: o portão entre DECISÕES de Move respeita o intervalo configurado (o número
  // de disparos pode ser igual nas duas configurações quando a stamina limita — por isso mede-se
  // o espaçamento das decisões na telemetria, não a contagem de chargeStart).
  const decisionGaps = cfg => {
    const g = arena(() => Object.assign(C.world.ai, cfg));
    g.setLoadout(1, ['reflect', 'psyshock']);g.mode = 'tactical';g.fighters[1].position.z = 6;g.fighters[0].position.z = -6;
    let last = -1;const gaps = [];
    for (let i = 0; i < 1500; i++) {
      g.step(cmd(), g.brain.command(g.fighters[1], g.fighters[0], 'tactical', C.test.step));
      if (g.brain.t.mv.log.length) {if (last >= 0) gaps.push((i - last) * C.test.step);last = i;g.brain.t.mv.log.length = 0;}
    }
    return gaps;
  };
  const gaps3 = decisionGaps({decisionInterval: 3});
  assert.ok(gaps3.length > 0 && gaps3.every(g => g >= 3 - 1e-6), `intervalo 3 s: toda decisão de Move vem ≥ 3 s após a anterior (${JSON.stringify(gaps3.map(g => +g.toFixed(2)))})`);
  const gaps05 = decisionGaps({decisionInterval: .5});
  assert.ok(gaps05.length > 0 && gaps05.every(g => g >= .5 - 1e-6), `intervalo 0,5 s: toda decisão de Move vem ≥ 0,5 s após a anterior (${JSON.stringify(gaps05.map(g => +g.toFixed(2)))})`);
}
ok('IA com Moves: distância mínima, stamina mínima, chance máxima e intervalo de decisão do Psyshock alteram as decisões reais do adversário');

console.log(`
${n} verificações dos sliders dos Moves aprovadas.`);
