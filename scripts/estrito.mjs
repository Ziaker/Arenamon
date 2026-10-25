// Catraca do TypeScript estrito: conta os erros que o combat-lab teria com "strict": true e não deixa o número SUBIR.
//   node scripts/estrito.mjs            -> confere contra o orçamento (falha se aumentou; avisa se diminuiu)
//   node scripts/estrito.mjs --lista    -> ranking de arquivos com mais erros (por onde começar)
//   node scripts/estrito.mjs --gravar   -> grava o número atual como novo orçamento (só depois de CORRIGIR erros)
import {spawnSync} from 'node:child_process';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const budgetFile = path.join(root, 'prototypes/combat-lab/estrito-orcamento.json');
const tmp = path.join(root, 'node_modules/.cache/tsconfig.estrito.json');
mkdirSync(path.dirname(tmp), {recursive: true});
writeFileSync(tmp, JSON.stringify({extends: '../../prototypes/combat-lab/tsconfig.json', compilerOptions: {strict: true, noImplicitAny: true, noEmit: true}, include: ['../../prototypes/combat-lab/src/sim/**/*.js', '../../prototypes/combat-lab/src/sim/**/*.d.ts']}));
const r = spawnSync(process.execPath, [path.join(root, 'node_modules/typescript/bin/tsc'), '-p', tmp], {encoding: 'utf8', cwd: root, maxBuffer: 64 * 1024 * 1024});
const lines = (r.stdout + r.stderr).split('\n').filter(l => /error TS\d+/.test(l));
const count = lines.length;
const byFile = new Map(); for (const l of lines) {const f = l.split('(')[0].replace(/^.*combat-lab\/src\//, ''); byFile.set(f, (byFile.get(f) ?? 0) + 1);}
if (process.argv.includes('--lista')) { for (const [f, n] of [...byFile].sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(String(n).padStart(5), f); console.log(`total: ${count} erros em ${byFile.size} arquivos`); process.exit(0); }
let budget = null; try { budget = JSON.parse(readFileSync(budgetFile, 'utf8')).errors; } catch {}
if (process.argv.includes('--gravar') || budget === null) { writeFileSync(budgetFile, JSON.stringify({errors: count, arquivos: byFile.size, gravadoEm: new Date().toISOString().slice(0, 10)}, null, 2) + '\n'); console.log(`orçamento gravado: ${count} erros em ${byFile.size} arquivos`); process.exit(0); }
console.log(`TypeScript estrito: ${count} erros (orçamento ${budget})`);
if (count > budget) { console.log('✗ o código ganhou erros do modo estrito. Veja: node scripts/estrito.mjs --lista'); process.exit(1); }
if (count < budget) console.log('✓ abaixo do orçamento: rode  node scripts/estrito.mjs --gravar  para travar o ganho.');
