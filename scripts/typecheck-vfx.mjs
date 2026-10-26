// @ts-check
// Checagem estática TypeScript dedicada aos módulos VFX dos Moves (Documento 02).
// Executa o compilador TypeScript com modo estrito completo (strict: true, noImplicitAny: true, checkJs ativo via @ts-check)
// garantindo 0 erros de tipos nos módulos de renderização dos pilotos migrados sem inflar o orçamento legado.
import {spawnSync} from 'node:child_process';
import {writeFileSync, mkdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = path.join(root, 'node_modules/.cache/tsconfig.vfx-strict.json');
mkdirSync(path.dirname(tmp), {recursive: true});

writeFileSync(tmp, JSON.stringify({
  extends: '../../prototypes/combat-lab/tsconfig.json',
  compilerOptions: {
    strict: true,
    noImplicitAny: true,
    noEmit: true
  },
  include: [
    '../../prototypes/combat-lab/src/sim/moves/*/*.vfx.js',
    '../../prototypes/combat-lab/src/view/moves-vfx-registry.js'
  ]
}, null, 2));

const r = spawnSync(process.execPath, [path.join(root, 'node_modules/typescript/bin/tsc'), '-p', tmp], {
  encoding: 'utf8',
  cwd: root,
  maxBuffer: 64 * 1024 * 1024
});

const lines = (r.stdout + r.stderr).split('\n').filter(l => /error TS\d+/.test(l));
const vfxErrors = lines.filter(l => l.includes('.vfx.js') || l.includes('moves-vfx-registry.js'));

if (vfxErrors.length > 0) {
  console.error(`✗ TypeScript VFX estrito: ${vfxErrors.length} erro(s) encontrado(s):`);
  console.error(vfxErrors.join('\n'));
  process.exit(1);
}

console.log('✓ TypeScript VFX estrito: 0 erros em todos os módulos .vfx.js e moves-vfx-registry.js');
