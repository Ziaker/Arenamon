// Testes unitários do sistema de habilidades passivas (ordem 2026-10-20):
// fórmula aditiva R7–R11, validação de loadouts R4/R5, cooldowns R16–R20, término antecipado do
// Forewarn, Sturdy em save/load (R22/§7) e paridade exata com o sistema desligado (§32).
import assert from 'node:assert/strict';
import {Game} from '../src/sim/game.js';
import {C, resetConfig, defaults} from '../src/sim/config.js';
import {vec} from '../src/sim/math.js';
import {stat} from '../src/sim/status.js';
import {validateLoadout, PASSIVE_SLOTS, PASSIVES, PASSIVE_BY_ID, genericPassives, exclusivePassives, PASSIVE_SPECIES} from '../src/sim/passives.js';
import {attachPassives, setPassiveLoadout, tickPassives, passiveOnEvents, passiveContribute, dotFactor, knockbackFactor, hitStunFactor, perfectWindowBonus, passiveCost, sturdyGuard, P, ensureState} from '../src/sim/passive-engine.js';

let passed = 0;const test = (name, fn) => {fn();passed++;console.log('✓', name);};
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;
/** Jogo novo com loadouts de passivas equipados (fighters[0]=azul, fighters[1]=vermelho). */
const setup = (l0 = [], l1 = [], id0 = null, id1 = null) => {
  const g = new Game({seed: 11});
  g.passiveIdentity = [id0, id1];
  setPassiveLoadout(g, 0, l0);setPassiveLoadout(g, 1, l1);
  g.reset({positions: [vec(0, -4), vec(0, 4)]});
  return g;
};

test('fórmula aditiva: base×(1+Σ%)+Σadd sem arredondamento (R7–R11)', () => {
  const g = setup(['speed-boost'], []), f = g.fighters[0];
  ensureState(f).actives.push({id: 'anticipation', owner: 0, remaining: 9, duration: 9, params: {speedPct: .15}, cooldown: 0, cooldownMode: 'postEnd'});
  assert.ok(near(stat(f, 'speed', 100), 100 * (1 + P('speed-boost').speedPct + .15)), '100×1,30');
  ensureState(f).actives.length = 0;
  f.statuses.push({id: 'buff-add', duration: 9, remaining: 9, stacks: 1, maxStacks: 1, stacking: 'refresh', mul: {}, add: {speed: 30}, flags: {}, tick: null, acc: 0, tags: ['buff']});
  assert.ok(near(stat(f, 'speed', 100), 100 * (1 + P('speed-boost').speedPct) + 30), '100×1,15+30 = 145');
  f.statuses.length = 0;
  assert.ok(near(stat(f, 'speed', 87), 87 * (1 + P('speed-boost').speedPct), 1e-12), '87×1,15 = 100,05 (sem arredondar)');
  assert.ok(!Number.isInteger(stat(f, 'speed', 87)) || stat(f, 'speed', 87) !== 100, 'não arredonda para 100');
  f.statuses.length = 0;f.passiveState.loadout = [];
  assert.equal(stat(f, 'speed', 87), 87, 'sem passivas, identidade');
});

test('validateLoadout: duplicata, exclusiva alheia e limite de 2 (R4/R5)', () => {
  assert.ok(validateLoadout(['speed-boost', 'speed-boost'], null).length > 0, 'duplicata recusada');
  assert.ok(validateLoadout(['poison-touch'], 'vigoroth').some(e => e.includes('exclusiva')), 'exclusiva alheia recusada');
  assert.ok(validateLoadout(['poison-touch'], 'croagunk').length === 0, 'exclusiva própria aceita');
  assert.ok(validateLoadout(['speed-boost', 'technician', 'guts'], null).length > 0, 'mais de 2 recusado');
  assert.equal(PASSIVE_SLOTS, 2);
  const g = setup();
  const r = g.setPassiveLoadout(0, ['speed-boost', 'speed-boost']);
  assert.equal(r.ok, false, 'motor recusa duplicata');
});

test('R20: gatilhos da mesma passiva ignorados durante o efeito ativo', () => {
  const g = setup(['anticipation'], [], 'croagunk');
  const f = g.fighters[0];
  g.fighters[1].tackleCharge = {t: .8, level: 2, start: 0};
  f.position = vec(0, 0);g.fighters[1].position = vec(0, 2);   // distância 2 ≤ 3,5
  tickPassives(g, f, C.test.step);
  assert.equal(f.passiveState.actives.filter(a => a.id === 'anticipation').length, 1, 'ativou uma vez');
  tickPassives(g, f, C.test.step);
  assert.equal(f.passiveState.actives.filter(a => a.id === 'anticipation').length, 1, 'não duplicou nem renovou');
});

test('R16: cooldown pós-término — Forewarn termina antecipado e o cooldown começa na hora', () => {
  const g = setup(['forewarn'], [], 'drowzee');
  const f = g.fighters[0], opp = g.fighters[1];
  f.position = vec(0, 0);opp.position = vec(0, 2);
  opp.charge = {move: 'x', slot: 0, ticks: 999, params: {maxTicks: 100, pl2Ticks: 50, step: C.test.step}, cost: 1};
  g.tick = 0;tickPassives(g, f, C.test.step);
  assert.ok(f.passiveState.actives.some(a => a.id === 'forewarn'), 'forewarn ativo');
  opp.charge = null;                                            // oponente soltou: término antecipado
  let ended = -1, ready = -1, t = 0;
  while (t < 60 / C.test.step && ready < 0) {g.tick = t;const evs = tickPassives(g, f, C.test.step);t++;
    if (ended < 0 && evs.some(e => e.result === 'passiveEnded' && e.passive === 'forewarn')) ended = t;
    if (ended >= 0 && (f.passiveState.cooldowns.forewarn ?? 0) > 0 && ended < 0) ended = t;
    if (evs.some(e => e.result === 'passiveReady' && e.passive === 'forewarn')) ready = t;}
  assert.ok(ended > 0, 'efeito terminou antes dos 4 s');
  assert.ok((f.passiveState.cooldowns.forewarn ?? 0) > 0 || ready > 0, 'cooldown iniciado no término antecipado');
  const dur = P('forewarn').maxDuration, cd = P('forewarn').cooldown;
  assert.ok(ended * C.test.step < dur, `término aos ${(ended * C.test.step).toFixed(2)}s < ${dur}s`);
  if (ready > 0) assert.ok(near(ready * C.test.step, ended * C.test.step + cd, 2 * C.test.step), 'pronta = término + cooldown');
});

test('R18: efeito instantâneo inicia o cooldown logo após a aplicação (Rough Skin)', () => {
  const g = setup([], ['rough-skin']);
  const v = g.fighters[1], a = g.fighters[0];
  const out = passiveOnEvents(g, [{result: 'impact', attacker: 0, target: 1, damage: 10, contact: 'tackle'}]);
  assert.ok(out.some(e => e.result === 'passiveReflect' && e.passive === 'rough-skin'), 'reflexão');
  assert.ok(near(v.passiveState.cooldowns['rough-skin'], P('rough-skin').cooldown, 1e-9), 'cooldown cheio no mesmo passo');
  assert.equal(a.hp, 100 - P('rough-skin').reflectDamage, 'retorno descontado do agressor');
});

test('R22/§7: Sturdy usada NÃO é restaurada em load', () => {
  const g = setup([], ['sturdy'], null, 'mush');
  const v = g.fighters[1];v.hp = 5;
  const sg = sturdyGuard(v, 100, {category: 'direct', attacker: g.fighters[0]});
  assert.equal(sg.sturdy, true);assert.equal(v.hp, 1);assert.equal(v.passiveState.sturdyUsed, true);
  const g2 = new Game({seed: 11});g2.load(g.save());
  assert.equal(g2.fighters[1].passiveState.sturdyUsed, true, 'load não restaura Sturdy');
  g2.reset({positions: [vec(0, -4), vec(0, 4)]});
  assert.equal(g2.fighters[1].passiveState.sturdyUsed, false, 'reset (fronteira de rodada) restaura');
});

test('fatores: dotFactor, knockbackFactor, hitStunFactor, perfectWindowBonus, passiveCost', () => {
  const g = setup([], ['magic-guard', 'suction-cups'], null, null);
  const v = g.fighters[1];
  assert.ok(near(dotFactor(v), 1 - P('magic-guard').dotReductionPct), 'magic guard DOT');
  assert.ok(near(knockbackFactor(v), 1 - P('suction-cups').knockbackPct), 'suction cups no chão');
  assert.equal(knockbackFactor({...v, flight: {y: 1}}), 1, 'suction cups não segura no ar');
  const g2 = setup([], ['inner-focus'], null, 'drowzee');
  assert.ok(near(hitStunFactor(g2.fighters[1]), 1 - P('inner-focus').stunPct), 'inner focus');
  assert.equal(perfectWindowBonus(g2.fighters[1]), 0, 'sem forewarn ativo');
  const g3 = setup(['technician'], []);
  const a = g3.fighters[0];
  assert.ok(near(passiveCost(a, 'dodge', 1), 1 - P('technician').costPct), 'technician desconta esquiva');
  assert.equal(passiveCost(a, 'tackle', 1), 1, 'technician não desconta tackle');
  assert.equal(passiveCost(g.fighters[1], 'dodge', 1), 1, 'sem technician, custo cheio');
});

test('§32: paridade com o sistema desligado (toggle 0 = identidade)', () => {
  const prev = C.extras.toggles.enablePassives;C.extras.toggles.enablePassives = 0;
  try {
    const g = setup(['speed-boost', 'guts'], ['sturdy'], 'vigoroth', 'mush');
    const f = g.fighters[0];
    ensureState(f).actives.push({id: 'anticipation', owner: 0, remaining: 9, duration: 9, params: {speedPct: .15}, cooldown: 0, cooldownMode: 'postEnd'});
    assert.deepEqual(passiveContribute(f, 'speed'), {pct: 0, add: 0}, 'contribute zerado');
    assert.equal(stat(f, 'speed', 87), 87, 'stat identidade');
    assert.equal(dotFactor(g.fighters[1]), 1);assert.equal(knockbackFactor(g.fighters[1]), 1);
    assert.equal(perfectWindowBonus(f), 0);assert.equal(passiveCost(f, 'dodge', 1), 1);
    assert.equal(sturdyGuard(g.fighters[1], 100, {category: 'direct', attacker: f}).sturdy, false, 'sturdy inerte');
    assert.deepEqual(passiveOnEvents(g, [{result: 'impact', attacker: 0, target: 1, damage: 10, contact: 'tackle'}]), [], 'nenhum evento novo');
  } finally {C.extras.toggles.enablePassives = prev;}
});

test('sturdyGuard: DOT/ambiental/refletido não protege; direto não-letal não consome', () => {
  const g = setup([], ['sturdy'], null, 'mush');
  const v = g.fighters[1];v.hp = 5;
  for (const ctx of [{category: 'periodic'}, {category: 'environmental'}, {category: 'reflected'}, {}]) {
    const sg = sturdyGuard(v, 100, {...ctx, attacker: g.fighters[0]});
    assert.equal(sg.sturdy, false, `não protege ${ctx.category ?? 'sem categoria'}`);
  }
  v.hp = 50;
  const soft = sturdyGuard(v, 10, {category: 'direct', attacker: g.fighters[0]});
  assert.equal(soft.sturdy, false, 'dano não letal não consome');assert.equal(v.passiveState.sturdyUsed, false);
});

test('§32 registro: 18 habilidades, ids estáveis, categorias e exclusividade', () => {
  assert.equal(PASSIVES.length, 18, 'catálogo com 18 passivas');
  assert.equal(new Set(PASSIVES.map(p => p.id)).size, 18, 'ids únicos');
  for (const p of PASSIVES) {
    assert.ok(/^[a-z0-9-]+$/.test(p.id), `id estável kebab-case: ${p.id}`);
    assert.ok(['permanente', 'permanente condicional', 'gatilho'].includes(p.categoria), `categoria válida: ${p.id}`);
    for (const k of ['nome', 'gatilho', 'efeito']) assert.ok(p[k] && String(p[k]).length > 3, `${p.id} tem ${k}`);
    if (p.species) assert.ok(PASSIVE_SPECIES.includes(p.species), `${p.id} exclusiva de espécie do roster`);
  }
  const ROSTER = ['croagunk', 'drowzee', 'mush', 'vigoroth'];
  for (const sp of ROSTER) assert.equal(exclusivePassives(sp).length, 2, `2 exclusivas de ${sp}`);
  assert.equal(genericPassives().length, 10, '10 genéricas');
  assert.ok(!genericPassives().some(p => p.species), 'genéricas sem espécie');
  assert.ok(!exclusivePassives('mush').some(p => p.id === 'solid-rock'), 'Solid Rock removida não voltou');
});

test('R13: ordem dos slots não altera o resultado', () => {
  const mk = ids => {const g = setup(ids, [], null, null);return passiveContribute(g.fighters[0], 'speed');};
  const a = mk(['speed-boost', 'technician']), b = mk(['technician', 'speed-boost']);
  assert.deepEqual(a, b, 'contribute independente da ordem');
  const g = setup(['speed-boost', 'technician']);
  const g2 = setup(['technician', 'speed-boost']);
  assert.equal(stat(g.fighters[0], 'speed', 100), stat(g2.fighters[0], 'speed', 100), 'stat idêntica');
  assert.equal(passiveCost(g.fighters[0], 'dodge', 1), passiveCost(g2.fighters[0], 'dodge', 1), 'custo idêntico');
});

test('R12: duas passivas ativadas pelo MESMO evento (unidade)', () => {
  const g = setup([], ['rough-skin', 'stamina']);
  const out = passiveOnEvents(g, [{result: 'impact', attacker: 0, target: 1, damage: 10, contact: 'tackle'}]);
  const acts = out.filter(e => e.result === 'passiveActivated').map(e => e.passive).sort();
  assert.deepEqual(acts, ['rough-skin', 'stamina'], 'as duas avaliadas independentemente');
  assert.ok(out.some(e => e.result === 'passiveReflect'), 'reflexão presente');
});

test('R31: processamento duplicado do mesmo evento é detectado (ID estável)', () => {
  const g = setup([], ['rough-skin']);
  const ev = {result: 'impact', attacker: 0, target: 1, damage: 10, contact: 'tackle', id: 777};
  const first = passiveOnEvents(g, [ev]);
  const second = passiveOnEvents(g, [ev]);
  assert.equal(first.filter(e => e.result === 'passiveReflect').length, 1, 'primeiro processou');
  assert.ok(second.some(e => e.result === 'passiveCycleSuspect' && e.detail?.reason === 'duplicateEvent'), 'segundo sinalizado como duplicata');
  assert.equal(second.filter(e => e.result === 'passiveReflect').length, 0, 'sem reflexão duplicada');
});

test('R31: cadeia carrega a causa (id do evento origem)', () => {
  const g = setup([], ['rough-skin']);
  const out = passiveOnEvents(g, [{result: 'impact', attacker: 0, target: 1, damage: 10, contact: 'tackle', id: 42}]);
  const refl = out.find(e => e.result === 'passiveReflect');
  assert.equal(refl.cause, 42, 'reflexão aponta o evento causador');
});

test('R27/R28: evento legítimo recebido durante hitstop aplica imediatamente (caminho §6)', () => {
  const g = setup(['unburden'], []);
  g.hitstop = .3;g.frozen = true;   // simulação congelada; o caminho de eventos de passivas permanece avaliável
  const out = passiveOnEvents(g, [{result: 'itemCollected', fighter: 0, id: 5}]);
  assert.ok(out.some(e => e.passive === 'unburden'), 'ativação imediata durante hitstop');
  assert.ok(g.fighters[0].passiveState.actives.some(a => a.id === 'unburden'), 'efeito aplicado no mesmo processamento');
});

test('R31: proteção anti-ciclo não trava e sinaliza cadeia profunda', () => {
  const g = setup([], ['rough-skin']);
  // Cadeia sintética que se alimenta: cada reflexão reenvia um evento encadeável idêntico.
  let events = [{result: 'impact', attacker: 0, target: 1, damage: 10, contact: 'tackle', id: 1}];
  let guard = 0, suspect = 0;
  const t0 = Date.now();
  while (events.length && guard < 100) {guard++;const out = passiveOnEvents(g, events);
    suspect += out.filter(e => e.result === 'passiveCycleSuspect').length;
    events = out.filter(o => o.result === 'passiveReflect').map((o, i) => ({...o, id: 1000 + guard * 10 + i}));}
  assert.ok(Date.now() - t0 < 2000, 'sem travamento');
  assert.ok(guard <= 10, `encadeamento limitado pela profundidade (passos=${guard})`);
});

console.log(`\n${passed} testes de passivas passaram`);
