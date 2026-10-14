// IA tática: determinismo por semente, variedade de estilos, uso de todas as mecânicas, adaptação ao adversário e
// desempenho contra a IA do v6. Uso: node prototypes/combat-lab/test/ai.test.mjs
import assert from 'node:assert/strict';
import {Game} from '../src/sim/game.js';
import {C, resetConfig} from '../src/sim/config.js';
import {STYLES} from '../src/sim/tactics.js';
import {runBalance} from '../src/sim/balance.js';

let passed = 0;const test = (name, fn) => {resetConfig();fn();passed++;console.log('✓', name);};
/** Uma luta IA × IA; devolve o registro de contatos e a luta. */
function fight(seed, {blue = 'tactical', red = 'tactical', ticks = 120 * 60, until} = {}) {
  const g = new Game({seed});g.mode = red;g.reset();const log = [];
  for (let t = 0; t < ticks && g.phase !== 'result'; t++) {
    g.step(g.playerBrain.command(g.fighters[0], g.fighters[1], blue, C.test.step));
    for (const e of g.lastStepEvents) log.push(`${e.tick}:${e.attacker}:${e.result}`);
    if (until?.(g, t)) break;
  }
  return {g, log};
}

test('determinismo: mesma semente repete a luta; sementes diferentes lutam diferente', () => {
  const a = fight(5).log, b = fight(5).log, c = fight(6).log;
  assert.deepEqual(a, b);assert.notDeepEqual(a, c);assert.ok(a.length > 5);
});
test('replay por estado no meio da luta (estado tático incluído) reproduz o mesmo futuro', () => {
  const g = new Game({seed: 9});g.mode = 'tactical';g.reset();let saved;const step = () => g.step(g.playerBrain.command(g.fighters[0], g.fighters[1], 'tactical', C.test.step));
  for (let t = 0; t < 2400; t++) {step();if (t === 1200) saved = g.save();}
  const end = JSON.stringify(g.save());g.load(saved);for (let t = 1201; t < 2400; t++) step();
  assert.equal(JSON.stringify(g.save()), end);assert.ok(saved.brain.t?.style, 'estado tático salvo');
});
test('estilos: sorteados por partida (variados entre sementes) e fixáveis pela personalidade', () => {
  const seen = new Set();
  for (let s = 1; s <= 40; s++) {const {g} = fight(s, {ticks: 2});seen.add(g.brain.t.style.id);seen.add(g.playerBrain.t.style.id);}
  assert.ok(seen.size >= 5, `${seen.size} estilos diferentes`);
  C.extras.aiRed.style = 4;C.extras.aiBlue.style = 1;const {g} = fight(3, {ticks: 2});
  assert.equal(g.brain.t.style.id, STYLES[3].id);assert.equal(g.playerBrain.t.style.id, STYLES[0].id);
  // Os traços do estilo variam de uma partida para outra.
  const r1 = fight(11, {ticks: 2}).g.brain.t.style, r2 = fight(12, {ticks: 2}).g.brain.t.style;assert.notEqual(r1.attack, r2.attack);
  console.log(`   ${seen.size} de ${STYLES.length} estilos sorteados em 40 lutas`);
});
test('usa todas as mecânicas: X, C, C → X, salto, defesa (parcial e perfeita), esquiva perfeita e clash', () => {
  const r = runBalance({matches: 30, seed: 1, mode: 'tactical'}), sum = k => r.sides[0][k] + r.sides[1][k];
  for (const k of ['tackle', 'dodge', 'cancel', 'vault', 'partial', 'perfect', 'perfectDodge', 'clash', 'impact']) assert.ok(sum(k) > 0, `${k} usado`);
  assert.ok(sum('clash') < sum('impact') / 2, 'o clash não domina');
  assert.ok(r.timeouts <= r.matches * .35, `${r.timeouts} lutas sem vencedor`);
  console.log(`   30 lutas: X ${sum('tackle')}, C ${sum('dodge')}, C → X ${sum('cancel')}, saltos ${sum('vault')}, bloqueios ${sum('partial')}, defesas perfeitas ${sum('perfect')}, esquivas perfeitas ${sum('perfectDodge')}, clashes ${sum('clash')}, sem vencedor ${r.timeouts}`);
});
test('mais forte que a IA do v6, dos dois lados', () => {
  const a = runBalance({matches: 30, seed: 2, mode: 'tactical', enemyMode: 'combat'}), b = runBalance({matches: 30, seed: 3, mode: 'combat', enemyMode: 'tactical'});
  const ra = a.sides[0].wins / a.matches, rb = b.sides[1].wins / b.matches;
  console.log(`   tática (azul) × v6: ${(ra * 100).toFixed(0)}% · v6 × tática (vermelho): ${(rb * 100).toFixed(0)}%`);
  assert.ok(ra >= .6 && rb >= .55, 'vence a IA do v6 com folga (o vermelho tem reação mais lenta e mais erros)');
});
test('adaptação: aprende de que distância o adversário ataca e que ele defende muito', () => {
  // Contra a IA do v6 (ataca de ~3,35 m), a distância aprendida converge para perto disso.
  let {g} = fight(4, {red: 'combat', ticks: 120 * 25});
  const dist = g.playerBrain.t.model.attackDist;assert.ok(dist > 2.4 && dist < 4.3, `distância aprendida ${dist}`);
  // Contra um dummy que só defende, a leitura de “defende” sobe.
  ({g} = fight(4, {red: 'guard', ticks: 120 * 25}));
  assert.ok(g.playerBrain.t.model.guard > .6, `leitura de defesa ${g.playerBrain.t.model.guard}`);
  console.log(`   distância de ataque aprendida contra o v6: ${dist.toFixed(2)} m · leitura de defesa contra quem só defende: ${(g.playerBrain.t.model.guard * 100).toFixed(0)}%`);
});
test('percepção humana: não reage antes do tempo de reação', () => {
  // Reação longa: a IA não pode responder ao X do adversário antes do atraso configurado.
  C.extras.aiBlue.reaction = .3;C.extras.aiBlue.reactionJitter = 0;C.extras.aiBlue.mistake = 0;C.actions.tackle.duration = .9; // X longo: ainda ativo quando a reação chega
  const g = new Game({seed: 2});g.mode = 'inactive';g.reset();g.fighters[1].position = {x: 0, z: 5};
  let start = null, firstReact = null;
  for (let t = 0; t < 120; t++) {
    const red = t === 30 ? {move: {x: 0, z: -1}, dodge: false, tackle: true, guard: false, guardPressed: false, target: 0} : undefined;
    const before = g.playerBrain.t?.threat;
    g.step(g.playerBrain.command(g.fighters[0], g.fighters[1], 'tactical', C.test.step), red);
    if (g.fighters[1].action?.kind === 'tackle' && start === null) start = t;
    if (start !== null && firstReact === null && g.playerBrain.t?.threat?.decided) firstReact = t;void before;
  }
  assert.ok(firstReact !== null, 'percebeu o X');assert.ok((firstReact - start) * C.test.step >= .3 - 2 * C.test.step, `reagiu em ${((firstReact - start) * C.test.step * 1000).toFixed(0)} ms`);
});
test('a configuração não é alterada pela IA', () => {const before = JSON.stringify(C);fight(7, {ticks: 3000});assert.equal(JSON.stringify(C), before);});
console.log(`\n${passed} testes da IA tática aprovados.`);
