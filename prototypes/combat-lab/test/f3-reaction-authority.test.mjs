// @ts-check
// F3.2 — contrato: só o ReactionResolver ESCREVE reação (stagger/stun/hitstun/state de reação). Qualquer outro arquivo de src/ que atribua
// esses campos com um valor de reação (duração > 0 ou estado 'stagger'/'guardStun'/'hitstun') falha aqui. Zerar/decrementar (tick, limpeza) é permitido.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {join, relative, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));
const AUTHORITY = 'sim/resolvers/reaction-resolver.js';
const walk = (/** @type {string} */ d) => readdirSync(d).flatMap(n => {const p = join(d, n);return statSync(p).isDirectory() ? walk(p) : p.endsWith('.js') ? [p] : [];});

const FIELD = /\.(stagger|staggerMax|counterStagger|stun|stunMax|hitstun|hitstunMax)\s*=(?!=)\s*([^;\n]*)/g;
const STATE = /\.state\s*=\s*'(stagger|guardStun|hitstun)'/g;
/** Atribuição permitida fora do resolvedor: limpar (0) ou decrementar o relógio (Math.max(0, x - dt)). */
const benign = (/** @type {string} */ rhs) => /^(0|null|undefined|false)\b/.test(rhs.trim()) || /^Math\.max\(\s*0\s*,/.test(rhs.trim());

test('só o ReactionResolver escreve estados de reação (stagger/stun/hitstun)', () => {
  const offenders = [];
  for (const file of walk(SRC)) {
    const rel = relative(SRC, file).split(sep).join('/');
    if (rel === AUTHORITY || rel.startsWith('sim/scenarios')) continue;   // cenários de teste montam o estado de propósito
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(FIELD)) if (!benign(m[2])) offenders.push(`${rel}: .${m[1]} = ${m[2].slice(0, 60)}`);
    for (const m of text.matchAll(STATE)) offenders.push(`${rel}: .state = '${m[1]}'`);
  }
  assert.deepEqual(offenders, [], 'escreva a reação por applyReaction(...) em sim/resolvers/reaction-resolver.js');
});

test('os três caminhos antes soltos chamam o resolvedor', () => {
  const need = [['sim/world.js', "kind: 'counterStagger'"], ['sim/world.js', "kind: 'barrierRecoil'"], ['sim/sand.js', "kind: 'wallStagger'"]];
  for (const [rel, token] of need) assert.ok(readFileSync(join(SRC, rel), 'utf8').includes(token), `${rel} deve usar ${token}`);
});
