// @ts-check
// Regressões achadas na revisão independente de 23/10/2026: a configuração viva não pode ser alterada por A/B, linha do tempo e matriz;
// grupo de ficha não pode sobrescrever regras compartilhadas; gerador com apóstrofo; captura sem caminhos locais e com semente validada;
// comando do Markdown sem caracteres perigosos; ordem dos Moves nos menus; paridade dos Moves migrados com os valores de ANTES da ficha.
import {execFileSync} from 'node:child_process';
import {existsSync, readFileSync, rmSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {assert, C, suite, arena, factoryDefaults} from './moves-new-helpers.mjs';
import {compareMoveVariants} from '../src/sim/move-ab.js';
import {measureMoveRun} from '../src/sim/move-timeline.js';
import {runMoveMatrix} from '../src/sim/move-matrix.js';
import {defineMoveParams, removeMoveParams, paramRow, standardRows} from '../src/sim/moves/params-registry.js';
import {NEW_MOVE_IDS} from '../src/sim/moves/new-moves.js';
import {scrubPaths, parseBugCapture, BUG_SCHEMA} from '../src/sim/bug-capture.js';
import {newSpec, specToMarkdown, noFlags} from '../src/ui/move-spec-model.js';

const {test, done} = suite('REGRESSÕES DA REVISÃO INDEPENDENTE');
const lab = fileURLToPath(new URL('..', import.meta.url));

test('A/B, linha do tempo e matriz NÃO deixam a IA do rival (nem o hitstop) alterados na configuração viva', () => {
  arena();
  C.extras.toggles.enableEnemyAI = 1;C.extras.toggles.enableHitstop = 1;
  compareMoveVariants('swift', {}, {'world.swift.damage': 9});
  assert.equal(C.extras.toggles.enableEnemyAI, 1, 'depois do A/B');
  measureMoveRun('swift');
  assert.equal(C.extras.toggles.enableEnemyAI, 1, 'depois de medir a linha do tempo');
  runMoveMatrix('harden');
  assert.equal(C.extras.toggles.enableEnemyAI, 1, 'depois da matriz');
  C.extras.toggles.enableHitstop = 0;
  runMoveMatrix('harden');
  assert.equal(C.extras.toggles.enableHitstop, 0, 'o hitstop desligado pelo usuário volta como estava');
});
test('um grupo de ficha com o nome de uma regra compartilhada (charge, ai, beam) é recusado ao montar a configuração', () => {
  const rows = [...standardRows({cost: 1, cooldown: 5, cast: .3}), paramRow({key: 'x', label: 'X', tip: 'x', unit: 'num', value: .5})];
  for (const g of ['charge', 'ai', 'beam']) {
    defineMoveParams(g, {id: 'colide-' + g, title: 'Colide', rows});
    try {assert.throws(() => factoryDefaults(), /já existe em C\.world/, g);} finally {removeMoveParams(g);}
  }
  assert.doesNotThrow(() => factoryDefaults(), 'depois de remover, a configuração volta a montar');
});
test('o gerador recusa nomes que viram grupo reservado e aceita apóstrofo gerando JS válido', () => {
  const run = name => execFileSync(process.execPath, ['novo-move.mjs', name], {cwd: lab, encoding: 'utf8', stdio: 'pipe'});
  assert.throws(() => run('Charge'), e => /já existe em C\.world/.test(String(e.stderr)));
  const files = ['src/sim/moves/king-s-shield.js', 'src/sim/moves/king-s-shield.params.js', 'test/moves-king-s-shield.test.mjs'];
  try {
    run("King's Shield");
    for (const f of files) {
      assert.ok(existsSync(lab + f), f);
      execFileSync(process.execPath, ['--check', lab + f], {stdio: 'pipe'});   // sintaxe válida apesar do apóstrofo
    }
    assert.match(readFileSync(lab + files[1], 'utf8'), /title: "King's Shield"/);
  } finally {
    for (const f of files) rmSync(lab + f, {force: true});
    execFileSync(process.execPath, ['gen-fichas.mjs'], {cwd: lab, stdio: 'pipe'});
  }
  assert.ok(!readFileSync(lab + 'src/sim/moves/fichas.generated.js', 'utf8').includes('king-s-shield'), 'índice limpo depois');
});
test('a captura de bug tira caminhos locais das mensagens e recusa semente que não é número', () => {
  assert.equal(scrubPaths('Falha em file:///C:/Users/zerke/OneDrive/Arenamon/dist/lab.html:12'), 'Falha em <local>/lab.html:12');
  assert.ok(!/zerke/.test(scrubPaths('C:\\Users\\zerke\\Desktop\\x\\y.js quebrou')));
  const base = {schema: BUG_SCHEMA, version: 1, tick: 1, recording: {}, snapshot: {fighters: []}};
  assert.match(parseBugCapture({...base, seed: '<img src=x onerror=alert(1)>'}).error ?? '', /semente/);
  assert.ok(!parseBugCapture({...base, seed: 7}).error && !parseBugCapture({...base, seed: null}).error);
});
test('o comando de criação no Markdown não leva aspas, $ nem crases de um nome importado', () => {
  const s = newSpec();
  s.fields.id = {value: 'meu-move', flags: {...noFlags(), proposto: true}, source: ''};
  s.fields.name = {value: 'Mau"; rm -rf ~ $(x) `y`', flags: {...noFlags(), proposto: true}, source: ''};
  const line = specToMarkdown(s).split('\n').find(l => l.startsWith('npm run novo-move'));
  assert.ok(line, 'linha do comando');
  assert.ok(!/[$`;]/.test(line.replace(/^npm run novo-move -- "/, '').replace(/"$/, '')), line);
});
test('a ordem dos Moves novos nos menus é a de antes das fichas (migrados mantêm o lugar)', () => {
  arena();
  const antes = ['harden', 'second-wind', 'swift', 'lunge', 'guard-break', 'bounce', 'spikes', 'sand-wave', 'bullet-punch', 'emerging-stone', 'feint', 'riposte', 'quick-attack', 'water-pulse', 'fire-spin', 'air-slash', 'seed-bomb'];
  assert.deepEqual(NEW_MOVE_IDS.slice(0, antes.length), antes);
});
test('PARIDADE: os Moves migrados mantêm os valores de fábrica que tinham em config.js ANTES da ficha (commit 5b4343a)', () => {
  const antes = {
    harden: {cost: .8, cooldown: 10, cast: .35, duration: 5, defensePct: .30, negateKnockback: 1},
    secondWind: {cost: .8, cooldown: 12, cast: .35, duration: 5, regenPctPerSecond: .40, mobilityCostPct: .25},
    guardBreak: {cost: 1, cooldown: 10, maxCharge: 1, minCharge: 0, cast: .7, range: 2.6, damage: 6, knockbackH: 2, knockbackV: 0, stun: .5, invulnerableSeconds: 0, chainAfter: .47, hitStart: .333, hitEnd: .533},
    swift: {cost: .8, cooldown: 7, cast: .25, count: 3, speed: 15, damage: 3, homingSeconds: .25, homingRate: 90, range: 12, knockback: .3, knockbackCap: .9, radius: .2, fanAngle: 20, spawnForward: .9, spawnSpacing: .35, counterStagger: .2},
    lunge: {cost: 0.75, cooldown: 6, cast: 0.6, range: 3.5, damage: 8, knockbackH: 4, knockbackV: 0, invulnerableSeconds: 0.1333, chainAfter: 0.45, hitStart: 0.19, hitEnd: 0.26},
    quickAttack: {cost: 0.75, cooldown: 6, acquireRange: 7, approachMax: 0.16, returnMax: 0.14, recovery: 0.12, damage: 8, knockbackH: 4, knockbackV: 0, invulnerableSeconds: 0, airReach: 3, fxLines: 1, fxHideBody: 1},
    feint: {cost: 0.3, cooldown: 3, cast: 0.22, cancelAfter: 0.0333, cancelWindow: 0.1333, retreat: 0.25, invulnStart: 0.0167, invulnEnd: 0.0833},
    riposte: {cost: 0.8, cooldown: 8, cast: 0.65, windowStart: 0.13, windowEnd: 0.3, damage: 14, knockbackH: 9, knockbackV: 2.5, strikeRange: 1.6, hitstopMult: 2.5, shakeMult: 2.4, fxOn: 1, fxIntensity: 1, fxSize: 1, blastOn: 1, blastSize: 1.5},
  };
  const hoje = factoryDefaults().world;
  for (const [g, vals] of Object.entries(antes)) for (const [k, v] of Object.entries(vals)) assert.equal(hoje[g][k], v, `${g}.${k}`);
});

done();
