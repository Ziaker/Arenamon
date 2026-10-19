#!/usr/bin/env node
/**
 * Runner inteligente de testes Arenamon
 *
 * Uso:
 *   node scripts/run-tests.mjs                    # todos os testes
 *   node scripts/run-tests.mjs --fast             # modo rápido (CI)
 *   node scripts/run-tests.mjs --unit             # só unitários
 *   node scripts/run-tests.mjs --browser          # só navegador
 *   node scripts/run-tests.mjs --combat-lab       # só combat-lab
 *   node scripts/run-tests.mjs --match tackle     # só arquivos com "tackle"
 *   node scripts/run-tests.mjs --json report.json # relatório em JSON
 *
 * Saída:
 *   Código 0 = todos passaram
 *   Código 1 = algum falhou
 */

import { spawn } from 'node:child_process';
import { readdir, stat } from 'node:fs/promises';
import { join, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');

/* ================================================================
   Configuração de suites (ordem importa: build primeiro, depois testes)
   ================================================================= */

const SUITES = [
  {
    name: 'placeholders',
    build: 'node prototypes/placeholders/build.mjs',
    verify: 'node prototypes/placeholders/verify.mjs',
    tests: [],
  },
  {
    name: 'game',
    build: 'node prototypes/game/build.mjs',
    verify: 'node prototypes/game/verify.mjs',
    tests: ['prototypes/game/test.mjs', 'prototypes/game/locomotion.test.mjs'],
  },
  {
    name: 'importer',
    build: 'node prototypes/importer/build.mjs',
    verify: 'node prototypes/importer/verify.mjs',
    tests: [],
  },
  {
    name: 'studio',
    build: 'node prototypes/studio/build.mjs',
    verify: 'node prototypes/studio/verify.mjs',
    tests: [
      'prototypes/studio/test/ops.test.mjs',
      'prototypes/studio/test/rigging.test.mjs',
      'prototypes/studio/test/rigging.browser.mjs',
    ],
  },
  {
    name: 'combat-lab',
    build: 'node prototypes/combat-lab/build.mjs',
    verify: 'node prototypes/combat-lab/verify.mjs',
    testsDir: 'prototypes/combat-lab/test',
  },
];

/* ================================================================
   Testes pesados (excluídos no modo --fast)
   ================================================================= */

const SLOW_TESTS = new Set([
  'properties.test.mjs',
  'ai-eval.test.mjs',
  'perf.test.mjs',
  'parity.mjs',          // precisa do v6 local
  'combat-windows.test.mjs', // precisa do GLB local em prototypes/combat-lab/validation/ (ignorado no Git; não existe no CI)
]);

/* ================================================================
   CLI args
   ================================================================= */

const args = process.argv.slice(2);
const flags = {
  fast: args.includes('--fast'),
  unit: args.includes('--unit'),
  browser: args.includes('--browser'),
  json: null,
  match: null,
  suiteFilter: null,
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--json' && args[i + 1]) flags.json = args[i + 1];
  if (args[i] === '--match' && args[i + 1]) flags.match = args[i + 1];
}

// --combat-lab, --game, etc.
for (const s of SUITES) {
  if (args.includes(`--${s.name}`)) flags.suiteFilter = s.name;
}
// --unit e --match rodam só os arquivos escolhidos, sem rebuild nem verify (use sem filtros para o ciclo completo).
const light = flags.unit || !!flags.match;

/* ================================================================
   Helpers
   ================================================================= */

async function discoverTests(dir) {
  const files = [];
  try {
    const entries = await readdir(join(ROOT, dir));
    for (const f of entries) {
      if (f.endsWith('.test.mjs') || f.endsWith('.browser.mjs')) {
        files.push(join(dir, f));
      }
    }
  } catch { /* diretório não existe */ }
  return files.sort();
}

function color(code, text) {
  const c = { red: 31, green: 32, yellow: 33, gray: 90, cyan: 36 };
  return process.stdout.isTTY ? `\x1b[${c[code]}m${text}\x1b[0m` : text;
}

function log(label, msg) {
  const now = new Date().toISOString().slice(11, 19);
  console.log(`[${now}] ${label.padEnd(8)} ${msg}`);
}

async function run(cmd, label, timeoutMs = 120_000) {
  return new Promise((resolve) => {
    const [exe, ...argv] = cmd.split(' ');
    const child = spawn(exe, argv, {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => { stdout += d; process.stdout.write(d); });
    child.stderr.on('data', d => { stderr += d; process.stderr.write(d); });

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      log('TIMEOUT', `${label} (> ${timeoutMs / 1000}s)`);
    }, timeoutMs);

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

/* ================================================================
   Main
   ================================================================= */

const results = [];
let total = 0;
let passed = 0;
let failed = 0;

async function main() {
  console.log('\n' + color('cyan', '═'.repeat(60)));
  console.log(color('cyan', '  Arenamon Test Runner'));
  console.log(color('cyan', '═'.repeat(60)));
  if (flags.fast) console.log(color('yellow', '  Modo FAST (testes pesados ignorados)'));
  if (flags.unit) console.log(color('yellow', '  Filtro: apenas unitários'));
  if (flags.browser) console.log(color('yellow', '  Filtro: apenas navegador'));
  if (flags.match) console.log(color('yellow', `  Filtro: match "${flags.match}"`));
  if (flags.suiteFilter) console.log(color('yellow', `  Filtro: suite "${flags.suiteFilter}"`));
  console.log('');

  for (const suite of SUITES) {
    if (flags.suiteFilter && suite.name !== flags.suiteFilter) continue;

    // --- descoberta dinâmica para combat-lab ---
    let tests = [...(suite.tests ?? [])];
    if (suite.testsDir) {
      const discovered = await discoverTests(suite.testsDir);
      tests = [...tests, ...discovered];
    }

    // --- filtros ---
    const filtered = tests.filter((t) => {
      const base = basename(t);
      if (flags.fast && SLOW_TESTS.has(base)) return false;
      if (flags.unit && base.endsWith('.browser.mjs')) return false;
      if (flags.browser && !base.endsWith('.browser.mjs')) return false;
      if (flags.match && !base.includes(flags.match)) return false;
      return true;
    });

    if (filtered.length === 0 && (light || !suite.build)) continue;

    console.log(color('cyan', `▶ ${suite.name}`));

    // --- build ---
    if (suite.build && !light) {
      log('BUILD', suite.build);
      const r = await run(suite.build, `${suite.name}:build`, 60_000);
      results.push({ suite: suite.name, task: 'build', ...r });
      if (r.code !== 0) {
        log('FAIL', `${suite.name}:build`);
        failed++;
        continue; // não roda testes se build falhou
      }
      log('OK', `${suite.name}:build`);
      passed++;
      total++;
    }

    // --- verify ---
    if (suite.verify && !light) {
      log('VERIFY', suite.verify);
      const r = await run(suite.verify, `${suite.name}:verify`, 120_000);
      results.push({ suite: suite.name, task: 'verify', ...r });
      total++;
      if (r.code !== 0) {
        log('FAIL', `${suite.name}:verify`);
        failed++;
        continue;
      }
      log('OK', `${suite.name}:verify`);
      passed++;
    }

    // --- tests ---
    for (const test of filtered) {
      const label = relative(ROOT, test);
      const isBrowser = test.endsWith('.browser.mjs');
      const timeout = isBrowser ? 180_000 : 120_000;
      log('TEST', label);
      const r = await run(`node ${test}`, label, timeout);
      results.push({ suite: suite.name, task: label, ...r });
      total++;
      if (r.code !== 0) {
        log('FAIL', label);
        failed++;
      } else {
        log('OK', label);
        passed++;
      }
    }

    console.log('');
  }

  // --- resumo ---
  console.log(color('cyan', '═'.repeat(60)));
  console.log(`  Total:  ${total}`);
  console.log(`  Passou: ${color('green', passed.toString())}`);
  console.log(`  Falhou: ${color('red', failed.toString())}`);
  console.log(color('cyan', '═'.repeat(60)));

  if (flags.json) {
    const fs = await import('node:fs/promises');
    await fs.writeFile(
      join(ROOT, flags.json),
      JSON.stringify({ summary: { total, passed, failed }, results }, null, 2)
    );
    console.log(`\nRelatório JSON: ${flags.json}`);
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
