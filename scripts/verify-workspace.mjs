#!/usr/bin/env node
// scripts/verify-workspace.mjs
// Verificação de workspace oficial do Arenamon para Codex, Claude e Antigravity.
// Garante que o trabalho ocorre na pasta local oficial e previne a dispersão de arquivos.

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, normalize } from 'node:path';

const OFFICIAL_WORKSPACE = normalize('C:/Users/zerke/OneDrive/Área de Trabalho/Arenamon').replace(/\\/g, '/');
const OFFICIAL_REMOTE = 'https://github.com/Ziaker/Arenamon';

console.log('--- Verificação de Workspace Oficial do Arenamon ---');

let errors = [];
let warnings = [];

// 1. Verificar diretório raiz do Git
let topLevel = '';
try {
  topLevel = execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();
} catch (e) {
  errors.push(`Não foi possível determinar a raiz Git: ${e.message}`);
}

const normalizedTopLevel = normalize(topLevel).replace(/\\/g, '/');
console.log(`[Workspace Atual] ${normalizedTopLevel}`);

// Exigir o caminho oficial exato. Worktrees externos também terminam em
// "Arenamon", portanto validar apenas o nome da pasta seria insuficiente.
if (normalizedTopLevel.toLowerCase() !== OFFICIAL_WORKSPACE.toLowerCase()) {
  errors.push(
    `O diretório atual (${normalizedTopLevel}) não corresponde ao checkout oficial (${OFFICIAL_WORKSPACE}).`
  );
}

// 2. Verificar o remote oficial
try {
  const remotes = execSync('git remote -v', { encoding: 'utf-8' });
  if (!remotes.includes('Ziaker/Arenamon')) {
    warnings.push(`O remote 'origin' não parece apontar para ${OFFICIAL_REMOTE}.`);
  } else {
    console.log(`[Git Remote] Confirmado: ${OFFICIAL_REMOTE}`);
  }
} catch (e) {
  warnings.push(`Não foi possível verificar git remotes: ${e.message}`);
}

// 3. Auditar worktrees registrados
try {
  const wtOutput = execSync('git worktree list --porcelain', { encoding: 'utf-8' });
  const lines = wtOutput.split('\n');
  const worktrees = [];
  for (const line of lines) {
    if (line.startsWith('worktree ')) {
      worktrees.push(normalize(line.replace('worktree ', '').trim()).replace(/\\/g, '/'));
    }
  }

  console.log(`[Worktrees Ativos] ${worktrees.length} detectado(s):`);
  for (const wt of worktrees) {
    const isMain = wt.toLowerCase() === normalizedTopLevel.toLowerCase();
    const isInternalTemp = wt.toLowerCase().startsWith(`${normalizedTopLevel.toLowerCase()}/.worktrees/`);
    if (isMain) {
      console.log(`  ✓ Principal (Oficial): ${wt}`);
    } else if (isInternalTemp) {
      console.log(`  ✓ Temporário Interno Autorizado: ${wt}`);
    } else {
      console.log(`  ⚠ Worktree Externo Legado Detectado: ${wt}`);
      warnings.push(
        `Worktree externo detectado fora da pasta oficial: "${wt}". Pela nova política (AGENTS.md), novos worktrees devem ficar em ".worktrees/" dentro da pasta oficial.`
      );
    }
  }
} catch (e) {
  warnings.push(`Não foi possível listar worktrees: ${e.message}`);
}

// 4. Verificar arquivos essenciais de acesso na raiz oficial
const essentialFiles = [
  'ABRIR_ARENAMON.html',
  'HTMLS_ARENAMON.html',
  'JOGAR_ARENAMON.html',
  'TESTES_ARENAMON.html',
  'AGENTS.md',
  'package.json',
  'docs/MAPA_REPOSITORIO.md',
  'prototypes/index.html'
];

console.log('\n[Verificação de Portais e Acessibilidade]');
for (const file of essentialFiles) {
  const p = resolve(topLevel, file);
  if (existsSync(p)) {
    console.log(`  ✓ ${file}`);
  } else {
    errors.push(`Arquivo essencial ausente na raiz oficial: ${file}`);
  }
}

// 5. Verificar builds compilados essenciais
const distArtifacts = [
  { name: 'Arenamon Combate', path: 'prototypes/combat-lab/dist/arenamon-combate-laboratorio.html' },
  { name: 'Protótipo legado de blocos', path: 'prototypes/game/dist/arenamon-jogavel.html' },
  { name: 'Animation Studio', path: 'prototypes/studio/dist/arenamon-animation-studio.html' },
  { name: 'Propostas de Rigging', path: 'prototypes/studio/proposals/index.html' },
  { name: 'Importador', path: 'prototypes/importer/dist/importador-prototipo.html' },
  { name: 'Placeholders', path: 'prototypes/placeholders/dist/criaturas-laboratorio.html' }
];

console.log('\n[Verificação de Artefatos Compilados (dist)]');
for (const art of distArtifacts) {
  const p = resolve(topLevel, art.path);
  if (existsSync(p)) {
    console.log(`  ✓ ${art.name}: ${art.path}`);
  } else {
    warnings.push(`Artefato ${art.name} (${art.path}) não encontrado. Execute 'npm run build' para gerá-lo.`);
  }
}

// Relatório final
console.log('\n---------------------------------------------------');
if (warnings.length > 0) {
  console.log(`Avisos de Governança (${warnings.length}):`);
  for (const w of warnings) {
    console.log(`  ⚠ ${w}`);
  }
}

if (errors.length > 0) {
  console.error(`\nFALHA NA VERIFICAÇÃO DE WORKSPACE (${errors.length} erro(s)):`);
  for (const e of errors) {
    console.error(`  ✖ ${e}`);
  }
  process.exit(1);
} else {
  console.log('✓ Workspace oficial verificado e em conformidade com o AGENTS.md!\n');
  process.exit(0);
}
