// Proposta de patch para o config.ts do jogo: substituições certas, conflitos detectados e diff aplicável
// (`git apply --check`, sem aplicar).
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {patchConfigTs, unifiedDiff, collectChanges, formatNumber} from '../src/ui/gamepatch.js';

const repo = fileURLToPath(new URL('../../../', import.meta.url)), source = readFileSync(join(repo, 'prototypes/game/src/config.ts'), 'utf8');
let passed = 0;const test = (name, fn) => {fn();passed++;console.log('✓', name);};

test('formatação de números (π e decimais)', () => {
  assert.equal(formatNumber(Math.PI / 6), 'Math.PI / 6');assert.equal(formatNumber(4 * Math.PI), '4 * Math.PI');assert.equal(formatNumber(Math.PI), 'Math.PI');
  assert.equal(formatNumber(.45), '.45');assert.equal(formatNumber(16), '16');assert.equal(formatNumber(1 / 3), '.333333');
});
test('substitui só a chave certa de cada objeto', () => {
  const {text, applied, skipped} = patchConfigTs(source, [
    {gamePath: 'rules.dodge', value: .5, from: ['actions.dodge.duration']}, {gamePath: 'rules.steerLimit', value: Math.PI / 4, from: ['x']},
    {gamePath: 'test.arenaHalf', value: 16, from: ['test.arenaHalf']}, {gamePath: 'camera.distance', value: 7, from: ['camera.distance']},
    {gamePath: 'profiles.agile.speed', value: 5.5, from: ['profiles.agile.speed']}, {gamePath: 'rules.inexistente', value: 1, from: ['?']},
  ]);
  assert.match(text, /dodge: \.5, invulnerable: \.2, steerLimit: Math\.PI \/ 4, steerRate: Math\.PI,/);
  assert.match(text, /arenaHalf: 16, halfExtent: \.5,/);assert.match(text, /distance: 7, height: 2\.2/);
  assert.match(text, /agile: \{ attack: 16, defense: 35, speed: 5\.5, hp: TEST\.hp \}/);assert.match(text, /resistant: \{ attack: 24, defense: 80, speed: 3\.4/);
  assert.match(text, /minDistance: 4\.8, maxDistance: 16/, 'chaves parecidas (minDistance) intactas');
  assert.equal(applied.length, 5);assert.deepEqual(skipped.map(s => s.gamePath), ['rules.inexistente']);
  assert.equal(text.split('\n').length, source.split('\n').length);
});
test('conflitos: X e C com durações diferentes não entram na proposta', () => {
  const {changes, conflicts} = collectChanges([
    {path: 'actions.dodge.duration', gamePath: 'rules.dodge', value: .5, official: .4}, {path: 'actions.tackle.duration', gamePath: 'rules.dodge', value: .4, official: .4},
    {path: 'actions.dodge.steerLimit', gamePath: 'rules.steerLimit', value: .6, official: Math.PI / 6}, {path: 'actions.tackle.steerLimit', gamePath: 'rules.steerLimit', value: .6, official: Math.PI / 6},
    {path: 'test.speed', gamePath: 'test.speed', value: 4, official: 4},
  ]);
  assert.deepEqual(conflicts.map(c => c.gamePath), ['rules.dodge']);
  assert.deepEqual(changes, [{gamePath: 'rules.steerLimit', value: .6, from: ['actions.dodge.steerLimit', 'actions.tackle.steerLimit']}]);
});
test('o diff unificado é aplicável ao repositório (git apply --check, sem aplicar)', () => {
  const {text} = patchConfigTs(source, [{gamePath: 'rules.dodge', value: .45, from: []}, {gamePath: 'camera.maxDistance', value: 14, from: []}, {gamePath: 'profiles.resistant.defense', value: 75, from: []}]);
  const diff = unifiedDiff(source, text), dir = mkdtempSync(join(tmpdir(), 'arenamon-patch-')), file = join(dir, 'proposta.patch');
  try {writeFileSync(file, diff);execFileSync('git', ['apply', '--check', file], {cwd: repo});} finally {rmSync(dir, {recursive: true, force: true});}
  assert.equal(unifiedDiff(source, source), '');
  assert.equal(readFileSync(join(repo, 'prototypes/game/src/config.ts'), 'utf8'), source, 'o jogo não foi alterado');
});
console.log(`\n${passed} testes da proposta de patch aprovados.`);
