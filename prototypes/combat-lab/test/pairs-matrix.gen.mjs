// Gera a matriz §30: classificação dos 66 pares elegíveis por personagem (4 × 66 = 264 linhas).
// Uso: node test/pairs-matrix.gen.mjs > test/pairs-matrix.md
import {exclusivePassives, genericPassives} from '../src/sim/passives.js';

const ROSTER = ['croagunk', 'drowzee', 'mush', 'vigoroth'];
const INTERACT = [
  ['clear-body', 'defiant'], ['guts', 'magic-guard'], ['guts', 'defiant'], ['speed-boost', 'unburden'],
  ['speed-boost', 'anticipation'], ['unburden', 'anticipation'], ['anticipation', 'forewarn'],
  ['technician', 'vital-spirit'], ['stamina', 'suction-cups'], ['stamina', 'magic-guard'],
  ['inner-focus', 'suction-cups'], ['regenerator', 'magic-guard'], ['rough-skin', 'stamina'],
  ['rough-skin', 'effect-spore'], ['sturdy', 'rough-skin'], ['sturdy', 'stamina'], ['sturdy', 'magic-guard'],
  ['effect-spore', 'sturdy'],
].map(p => p.slice().sort().join('+'));
const key = p => p.slice().sort().join('+');
const counts = {};
const lines = ['| Personagem | Par (slot A + slot B) | Classificação |', '|---|---|---|'];
for (const sp of ROSTER) {
  const elig = [...exclusivePassives(sp).map(p => p.id), ...genericPassives().map(p => p.id)];
  if (elig.length !== 12) throw new Error(`esperadas 12 elegíveis para ${sp}, tem ${elig.length}`);
  for (let i = 0; i < elig.length; i++) for (let j = i + 1; j < elig.length; j++) {
    const cls = INTERACT.includes(key([elig[i], elig[j]])) ? 'compatíveis com interação' : 'compatíveis';
    counts[cls] = (counts[cls] ?? 0) + 1;
    lines.push(`| ${sp} | ${elig[i]} + ${elig[j]} | ${cls} |`);
  }
}
console.log(`<!-- §30: ${Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(' · ')} · total ${Object.values(counts).reduce((a, b) => a + b, 0)} linhas (4 personagens × 66 pares) · 0 incompatíveis · 0 dependentes de decisão · 0 impossíveis no catálogo atual -->`);
console.log(lines.join('\n'));
