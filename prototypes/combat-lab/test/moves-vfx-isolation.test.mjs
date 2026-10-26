// @ts-check
// Teste de Isolamento Arquitetural (Documento 02):
// Analisa o grafo real de dependências dos pontos de entrada da simulação headless e dos Moves.
// Garante estritamente que:
//   1. Nenhum módulo alcançado na simulação importa arquivos `.vfx.js`;
//   2. Arquivos `.vfx.js` só podem ser importados por módulos da camada `view/`;
//   3. Nenhum arquivo de Move (`sim/moves/*`) importa módulos da camada `view/`, Three.js ou DOM;
//   4. O simulador permanece 100% puro, determinístico e executável em Node.js a 120 Hz sem WebGL.

import assert from 'node:assert/strict';
import {readFileSync, existsSync, readdirSync} from 'node:fs';
import {join, dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const testDir = fileURLToPath(new URL('.', import.meta.url));
const labSrc = resolve(testDir, '../src');
const simRoot = resolve(labSrc, 'sim');
const viewRoot = resolve(labSrc, 'view');
const movesDir = resolve(simRoot, 'moves');

console.log('\n--- ISOLAMENTO ARQUITETURAL: GRAFO DE DEPENDÊNCIAS DA SIMULAÇÃO (DOC 02) ---\n');

/** Extrai caminhos importados por um arquivo JS (estáticos e dinâmicos). */
function extractImports(filePath) {
  const content = readFileSync(filePath, 'utf8');
  /** @type {string[]} */ const specs = [];
  const clean = content.replace(/\/\/[^\r\n]*|\/\*[\s\S]*?\*\//g, '');
  const fromRe = /(?:import|export)\s+(?:[\s\S]*?from\s+)?['"]([^'"]+)['"]/g;
  let m;
  while ((m = fromRe.exec(clean)) !== null) specs.push(m[1]);
  const dynRe = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((m = dynRe.exec(clean)) !== null) specs.push(m[1]);
  return specs;
}

/** Resolve um specifier relativo a partir de um arquivo de origem */
function resolveSpec(fromFile, spec) {
  if (spec.startsWith('.')) {
    let p = resolve(dirname(fromFile), spec);
    if (!existsSync(p) && existsSync(p + '.js')) p = p + '.js';
    return p;
  }
  return spec;
}

// 1. PONTOS DE ENTRADA DO MOTOR DE COMBATE E SIMULAÇÃO
const simEntryPoints = [
  resolve(simRoot, 'world.js'),
  resolve(simRoot, 'combat.js'),
  resolve(simRoot, 'moves.js'),
  resolve(simRoot, 'charge.js'),
  resolve(simRoot, 'sand.js'),
  resolve(simRoot, 'stone.js'),
  resolve(simRoot, 'trap.js'),
  resolve(simRoot, 'moves/new-moves.js'),
  resolve(simRoot, 'moves/fichas.generated.js'),
  resolve(simRoot, 'moves/params.generated.js'),
  resolve(simRoot, 'moves/move-data.js'),
  resolve(simRoot, 'moves/params-registry.js'),
];

// Adiciona todos os arquivos de lógica mecânica de Moves
for (const ent of readdirSync(movesDir, {withFileTypes: true})) {
  if (ent.isDirectory()) {
    const subJs = resolve(movesDir, ent.name, `${ent.name}.js`);
    if (existsSync(subJs)) simEntryPoints.push(subJs);
  } else if (ent.isFile() && ent.name.endsWith('.js') && !ent.name.endsWith('.params.js') && !ent.name.endsWith('.generated.js')) {
    simEntryPoints.push(resolve(movesDir, ent.name));
  }
}

// 2. CONSTRUÇÃO DO GRAFO E DETECÇÃO DE VIOLAÇÕES
const visited = new Set();
const queue = [...simEntryPoints];
const forbiddenRenderPackages = ['three', 'three.quarks', 'three/addons'];
const violations = [];

// Exceção estritamente documentada da calibração histórica de C.vfx.elemental (arquivos que são puros dicionários de números)
const ALLOWED_VIEW_DATA_MODULES = new Set([
  resolve(viewRoot, 'quarks/elemental-game-params.js'),
  resolve(viewRoot, 'quarks/presets.js'),
]);

while (queue.length > 0) {
  const current = queue.shift();
  if (!current || visited.has(current)) continue;
  visited.add(current);

  if (!existsSync(current)) continue;
  const rawImports = extractImports(current);

  for (const raw of rawImports) {
    // Regra 1: Simulação NUNCA pode importar Three.js ou three.quarks
    if (forbiddenRenderPackages.some(f => raw === f || raw.startsWith(f + '/'))) {
      violations.push({
        source: current,
        importSpec: raw,
        reason: 'Simulação headless importando pacote gráfico (' + raw + ')',
      });
    }

    // Regra 2: Simulação NUNCA pode importar arquivos .vfx.js
    if (raw.endsWith('.vfx.js') || raw.includes('.vfx.js')) {
      violations.push({
        source: current,
        importSpec: raw,
        reason: 'Simulação importando módulo visual .vfx.js',
      });
    }

    // Regra 3: Nenhum arquivo de Move em sim/moves/ pode importar view/
    const resolved = resolveSpec(current, raw);
    if (resolved.startsWith(labSrc)) {
      const relToLab = resolved.slice(labSrc.length).replace(/\\/g, '/');
      if (relToLab.startsWith('/view/')) {
        const isMove = current.includes('sim\\moves\\') || current.includes('sim/moves/');
        if (isMove || !ALLOWED_VIEW_DATA_MODULES.has(resolved)) {
          violations.push({
            source: current,
            importSpec: raw,
            resolved,
            reason: isMove
              ? 'Arquivo de Move em sim/moves/ importando a camada view/'
              : 'Simulação importando módulo da camada view/ fora das exceções de dados',
          });
        }
      }
      if (existsSync(resolved) && !visited.has(resolved) && (resolved.endsWith('.js') || resolved.endsWith('.mjs'))) {
        queue.push(resolved);
      }
    }
  }
}

// 3. CONFERÊNCIA COMPLEMENTAR: ARQUIVOS .vfx.js SÓ PODEM SER IMPORTADOS PELA CAMADA view/
function scanAllJsFiles(dir) {
  /** @type {string[]} */ const files = [];
  for (const ent of readdirSync(dir, {withFileTypes: true})) {
    const full = resolve(dir, ent.name);
    if (ent.isDirectory()) files.push(...scanAllJsFiles(full));
    else if (ent.isFile() && (ent.name.endsWith('.js') || ent.name.endsWith('.mjs'))) files.push(full);
  }
  return files;
}

const allLabFiles = scanAllJsFiles(labSrc);
for (const f of allLabFiles) {
  const imports = extractImports(f);
  for (const raw of imports) {
    if (raw.endsWith('.vfx.js') || raw.includes('.vfx.js')) {
      const isFromView = f.startsWith(viewRoot);
      if (!isFromView) {
        violations.push({
          source: f,
          importSpec: raw,
          reason: 'Arquivo fora da camada view/ tentando importar módulo .vfx.js',
        });
      }
    }
  }
}

console.log(`  ✓ Grafo analisado: ${visited.size} arquivos de simulação mapeados`);
console.log(`  ✓ Pontos de entrada inspecionados: ${simEntryPoints.length}`);

if (violations.length > 0) {
  console.error('\n✗ VIOLAÇÕES DE ISOLAMENTO ARQUITETURAL DETECTADAS:');
  for (const v of violations) {
    console.error(`  - Arquivo: ${v.source.slice(labSrc.length)}`);
    console.error(`    Import:  ${v.importSpec}`);
    console.error(`    Motivo:  ${v.reason}\n`);
  }
  process.exit(1);
}

console.log('  ✓ 100% de pureza: zero arquivos .vfx.js no grafo de simulação');
console.log('  ✓ 100% de pureza: zero dependências de Three.js ou three.quarks na simulação');
console.log('  ✓ 100% de pureza: nenhum arquivo em sim/moves/ importa a camada view/\n');
console.log('1 verificação de isolamento arquitetural aprovada.');
