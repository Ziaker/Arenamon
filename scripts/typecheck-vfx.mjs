// @ts-check
// Checagem estática TypeScript dedicada aos módulos VFX dos Moves (Documento 02).
// Executa o compilador TypeScript com modo estrito completo (strict: true, noImplicitAny: true, checkJs: true)
// garantindo 0 erros de tipos nos módulos de renderização dos pilotos migrados sem inflar o orçamento legado.
import {spawnSync} from 'node:child_process';
import {writeFileSync, mkdirSync, existsSync, readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// 1. Verificação explícita de existência e diretiva de tipos em todos os arquivos alvo
const requiredFiles = [
  'prototypes/combat-lab/src/sim/moves/sand-wave/sand-wave.vfx.js',
  'prototypes/combat-lab/src/sim/moves/bullet-punch/bullet-punch.vfx.js',
  'prototypes/combat-lab/src/sim/moves/water-pulse/water-pulse.vfx.js',
  'prototypes/combat-lab/src/view/moves-vfx-registry.js'
];

for (const rel of requiredFiles) {
  const full = path.join(root, rel);
  if (!existsSync(full)) {
    console.error(`✗ Arquivo VFX obrigatório não encontrado no disco: ${rel}`);
    process.exit(1);
  }
  const content = readFileSync(full, 'utf8');
  if (!content.trimStart().startsWith('// @ts-check')) {
    console.error(`✗ Diretiva // @ts-check ausente na linha inicial de: ${rel}`);
    process.exit(1);
  }
}

// 2. Configuração isolada com modo estrito completo
const tmp = path.join(root, 'node_modules/.cache/tsconfig.vfx-strict.json');
mkdirSync(path.dirname(tmp), {recursive: true});

writeFileSync(tmp, JSON.stringify({
  extends: '../../prototypes/combat-lab/tsconfig.json',
  compilerOptions: {
    checkJs: true,
    strict: true,
    noImplicitAny: true,
    strictNullChecks: true,
    strictFunctionTypes: true,
    strictBindCallApply: true,
    noImplicitThis: true,
    alwaysStrict: true,
    skipLibCheck: true,
    noEmit: true
  },
  include: requiredFiles.map(f => '../../' + f)
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

console.log(`✓ TypeScript VFX estrito: 0 erros nos ${requiredFiles.length} módulos auditados:`);
for (const f of requiredFiles) {
  console.log(`  ✓ ${f}`);
}
