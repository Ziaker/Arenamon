// Executa uma lista de comandos (um por linha) em sequência e para no primeiro que falhar, como o «&&» original, mas sem estourar o limite
// de linha de comando do Windows (o runner da CI falhava com «The command line is too long»). Cada linha vira UM processo independente.
// Uso: node scripts/run-list.mjs scripts/combat-lab-unit.txt [--de N] (retoma da linha N, 1-based)
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const file = process.argv[2], from = Math.max(1, Number(process.argv[process.argv.indexOf('--de') + 1]) || 1);
if (!file) {console.error('uso: node scripts/run-list.mjs <lista.txt>');process.exit(2);}
const commands = readFileSync(file, 'utf8').split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
const t0 = Date.now();
for (let i = from - 1; i < commands.length; i++) {
  console.log(`\n[${i + 1}/${commands.length}] ${commands[i]}`);
  const r = spawnSync(commands[i], {stdio: 'inherit', shell: true});
  if (r.status !== 0) {console.error(`\nFALHOU na linha ${i + 1}/${commands.length}: ${commands[i]} (código ${r.status})`);process.exit(r.status || 1);}
}
console.log(`\n${commands.length - from + 1} comandos ok em ${((Date.now() - t0) / 1000).toFixed(0)} s`);
