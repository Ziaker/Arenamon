// @ts-check
// Checagem estática TypeScript dedicada aos módulos VFX dos Moves (Documento 02).
// Executa o compilador TypeScript com modo estrito completo (strict: true, noImplicitAny: true, checkJs: true)
// garantindo 0 erros de tipos nos módulos de renderização dos pilotos migrados sem inflar o orçamento legado.
// Possui baseline explícita e verificável (scripts/typecheck-vfx-baseline.json) para que QUALQUER diagnóstico
// novo introduzido em dependências provoque falha imediata, evitando falsos negativos.
import {spawnSync} from 'node:child_process';
import {writeFileSync, mkdirSync, existsSync, readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const REQUIRED_VFX_FILES = [
  'prototypes/combat-lab/src/sim/moves/sand-wave/sand-wave.vfx.js',
  'prototypes/combat-lab/src/sim/moves/bullet-punch/bullet-punch.vfx.js',
  'prototypes/combat-lab/src/sim/moves/water-pulse/water-pulse.vfx.js',
  'prototypes/combat-lab/src/view/moves-vfx-registry.js'
];

/**
 * Valida a existência física e a diretiva // @ts-check nos arquivos auditados.
 * @param {string} root
 * @param {string[]} [files]
 * @returns {{ok: boolean, errors: string[]}}
 */
export function validateTargetFiles(root, files = REQUIRED_VFX_FILES) {
  const errors = [];
  for (const rel of files) {
    const full = path.join(root, rel);
    if (!existsSync(full)) {
      errors.push(`Arquivo VFX obrigatório não encontrado no disco: ${rel}`);
      continue;
    }
    const content = readFileSync(full, 'utf8');
    if (!content.trimStart().startsWith('// @ts-check')) {
      errors.push(`Diretiva // @ts-check ausente na linha inicial de: ${rel}`);
    }
  }
  return {ok: errors.length === 0, errors};
}

/**
 * Normaliza e extrai assinatura estruturada de uma linha de diagnóstico do TypeScript.
 * @param {string} line
 * @returns {{file: string, line: number, col: number, code: string, message: string, sig: string, raw: string}}
 */
export function parseDiagnosticLine(line) {
  const norm = line.replace(/\\/g, '/').trim();
  const m = norm.match(/^([^(]+)(?:\((\d+),(\d+)\))?:\s*(error\s+TS\d+):\s*(.+)$/);
  if (m) {
    return {
      file: m[1],
      line: Number(m[2] || 0),
      col: Number(m[3] || 0),
      code: m[4],
      message: m[5],
      sig: `${m[1]}::${m[4]}::${m[5]}`,
      raw: norm
    };
  }
  return {file: '', line: 0, col: 0, code: '', message: '', sig: norm, raw: norm};
}

/**
 * Carrega a baseline de diagnósticos legados conhecidos.
 * @param {string} root
 * @returns {{version: string, totalKnown: number, rawSet: Set<string>, sigCounts: Map<string, number>}}
 */
export function loadBaseline(root) {
  const baselinePath = path.join(root, 'scripts/typecheck-vfx-baseline.json');
  if (!existsSync(baselinePath)) {
    throw new Error(`Arquivo de baseline não encontrado: ${baselinePath}`);
  }
  const data = JSON.parse(readFileSync(baselinePath, 'utf8'));
  const rawSet = new Set();
  /** @type {Map<string, number>} */
  const sigCounts = new Map();

  for (const d of data.diagnostics || []) {
    const raw = (d.raw || `${d.file}(${d.line},${d.col}): ${d.code}: ${d.message}`).replace(/\\/g, '/').trim();
    rawSet.add(raw);
    const sig = `${d.file}::${d.code}::${d.message}`;
    sigCounts.set(sig, (sigCounts.get(sig) || 0) + 1);
  }

  return {
    version: data.version || '1.0.0',
    totalKnown: data.totalKnown || (data.diagnostics ? data.diagnostics.length : 0),
    rawSet,
    sigCounts
  };
}

/**
 * Analisa a saída bruta do compilador TypeScript, categorizando os erros.
 * @param {string} [stdout]
 * @param {string} [stderr]
 * @param {string[]} [targetFiles]
 */
export function parseCompilerOutput(stdout = '', stderr = '', targetFiles = REQUIRED_VFX_FILES) {
  const normalizedTargets = targetFiles.map(f => f.replace(/\\/g, '/'));
  const allLines = (stdout + '\n' + stderr).split(/\r?\n/).map(l => l.trimEnd()).filter(Boolean);

  /** @type {string[]} */
  const targetErrors = [];
  /** @type {string[]} */
  const fatalConfigErrors = [];
  /** @type {string[]} */
  const dependencyErrors = [];

  for (const line of allLines) {
    if (!/error TS\d+/.test(line)) continue;

    const normLine = line.replace(/\\/g, '/');

    // 1. Erros em arquivos alvo auditados
    const isTarget = normalizedTargets.some(t => normLine.includes(t));
    if (isTarget) {
      targetErrors.push(line);
      continue;
    }

    // 2. Erros de configuração do TypeScript / projeto / CLI (TS5xxx e TS6xxx)
    if (/error TS(5\d{3}|6\d{3}):/.test(line)) {
      fatalConfigErrors.push(line);
      continue;
    }

    // 3. Diagnósticos emitidos em dependências importadas
    dependencyErrors.push(line);
  }

  return {
    targetErrors,
    fatalConfigErrors,
    dependencyErrors,
    totalDiagnostics: targetErrors.length + fatalConfigErrors.length + dependencyErrors.length
  };
}

/**
 * Avalia o resultado da execução do compilador contra a baseline explícita de diagnósticos legados.
 * Qualquer diagnóstico novo em dependências provoca falha imediata.
 * @param {{status: number | null, signal: string | NodeJS.Signals | null, error?: Error, stdout?: string, stderr?: string}} runResult
 * @param {string[]} [targetFiles]
 * @param {{rawSet: Set<string>, sigCounts: Map<string, number>}} [baseline]
 * @returns {{ok: boolean, code: string, message: string, targetErrors: string[], fatalConfigErrors: string[], newDependencyErrors: string[], knownLegacyCount: number}}
 */
export function evaluateRunResult(runResult, targetFiles = REQUIRED_VFX_FILES, baseline) {
  // 1. Falha de execução do spawn (ex: binário não encontrado, erro de SO, EACCES)
  if (runResult.error) {
    return {
      ok: false,
      code: 'EXEC_SPAWN_ERROR',
      message: `Falha fatal ao iniciar o compilador TypeScript: ${runResult.error.message || runResult.error}`,
      targetErrors: [],
      fatalConfigErrors: [],
      newDependencyErrors: [],
      knownLegacyCount: 0
    };
  }

  // 2. Processo encerrado anormalmente por sinal (ex: SIGKILL por OOM, SIGTERM, SIGINT)
  if (runResult.signal) {
    return {
      ok: false,
      code: 'PROCESS_SIGNAL',
      message: `Compilador TypeScript interrompido pelo sinal: ${runResult.signal}`,
      targetErrors: [],
      fatalConfigErrors: [],
      newDependencyErrors: [],
      knownLegacyCount: 0
    };
  }

  // 3. Presença de erros no stderr (ex: crash do Node.js, uncaughtException, falha interna do V8)
  const stderrTrimmed = (runResult.stderr || '').trim();
  if (stderrTrimmed.length > 0) {
    return {
      ok: false,
      code: 'STDERR_NON_EMPTY',
      message: `Erro na saída de erro (stderr) do compilador:\n${stderrTrimmed}`,
      targetErrors: [],
      fatalConfigErrors: [],
      newDependencyErrors: [],
      knownLegacyCount: 0
    };
  }

  // 4. Análise dos diagnósticos produzidos pelo compilador
  const parsed = parseCompilerOutput(runResult.stdout || '', runResult.stderr || '', targetFiles);

  // 5. Erros fatais de configuração / projeto do TypeScript
  if (parsed.fatalConfigErrors.length > 0) {
    return {
      ok: false,
      code: 'FATAL_CONFIG_ERROR',
      message: `Erro de configuração do TypeScript detectado:\n${parsed.fatalConfigErrors.join('\n')}`,
      targetErrors: parsed.targetErrors,
      fatalConfigErrors: parsed.fatalConfigErrors,
      newDependencyErrors: [],
      legacyCount: parsed.dependencyErrors.length
    };
  }

  // 6. Erros estritos nos arquivos alvo de VFX
  if (parsed.targetErrors.length > 0) {
    return {
      ok: false,
      code: 'TARGET_MODULE_ERRORS',
      message: `TypeScript VFX estrito: ${parsed.targetErrors.length} erro(s) encontrado(s) nos arquivos auditados:\n${parsed.targetErrors.join('\n')}`,
      targetErrors: parsed.targetErrors,
      fatalConfigErrors: [],
      newDependencyErrors: [],
      legacyCount: parsed.dependencyErrors.length
    };
  }

  // 7. Código de saída anormal fora do padrão do tsc (0 = sucesso limpo, 1 ou 2 = diagnósticos emitidos)
  if (runResult.status !== 0 && runResult.status !== 1 && runResult.status !== 2) {
    return {
      ok: false,
      code: 'ABNORMAL_EXIT_STATUS',
      message: `Compilador TypeScript encerrou com código de saída anormal: ${runResult.status}`,
      targetErrors: [],
      fatalConfigErrors: [],
      newDependencyErrors: [],
      legacyCount: parsed.dependencyErrors.length
    };
  }

  // 8. Se status != 0 mas nenhum erro foi emitido, há inconsistência no processo
  if (runResult.status !== 0 && parsed.totalDiagnostics === 0) {
    return {
      ok: false,
      code: 'NONZERO_EXIT_WITHOUT_DIAGNOSTICS',
      message: `Compilador encerrou com código ${runResult.status}, mas nenhum diagnóstico foi capturado.`,
      targetErrors: [],
      fatalConfigErrors: [],
      newDependencyErrors: [],
      legacyCount: 0
    };
  }

  // 9. Auditoria estrita contra a baseline de dependências legadas
  /** @type {string[]} */
  const newDependencyErrors = [];
  let knownLegacyCount = 0;

  if (baseline) {
    // Clona o contador de assinaturas para validar multiplicidade
    const pool = new Map(baseline.sigCounts);

    for (const depError of parsed.dependencyErrors) {
      const p = parseDiagnosticLine(depError);
      const isExactMatch = baseline.rawSet.has(p.raw);
      const remainingCount = pool.get(p.sig) || 0;

      if (isExactMatch || remainingCount > 0) {
        knownLegacyCount++;
        if (remainingCount > 0) pool.set(p.sig, remainingCount - 1);
      } else {
        newDependencyErrors.push(depError);
      }
    }
  } else {
    // Sem baseline informada, qualquer erro de dependência é considerado não tolerado
    newDependencyErrors.push(...parsed.dependencyErrors);
  }

  // Se houver qualquer diagnóstico novo em dependências, falha imediatamente
  if (newDependencyErrors.length > 0) {
    return {
      ok: false,
      code: 'NEW_DEPENDENCY_DIAGNOSTICS',
      message: `TypeScript VFX estrito: ${newDependencyErrors.length} novo(s) diagnóstico(s) detectado(s) em dependências legadas fora da baseline:\n${newDependencyErrors.join('\n')}`,
      targetErrors: [],
      fatalConfigErrors: [],
      newDependencyErrors,
      knownLegacyCount
    };
  }

  // Sucesso legítimo comprovado: 0 erros nos módulos alvo e 0 diagnósticos novos fora da baseline
  return {
    ok: true,
    code: 'SUCCESS',
    message: `0 erros nos ${targetFiles.length} módulos auditados (${knownLegacyCount} diagnósticos legados conhecidos tolerados na baseline; 0 novos).`,
    targetErrors: [],
    fatalConfigErrors: [],
    newDependencyErrors: [],
    knownLegacyCount
  };
}

/**
 * Executa a checagem completa de tipos VFX com validação de ambiente, baseline e compilação estrita.
 * @param {{root?: string, files?: string[], recordBaseline?: boolean}} [opts]
 */
export function runTypecheckVfx(opts = {}) {
  const rootDir = opts.root || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const targetFiles = opts.files || REQUIRED_VFX_FILES;

  // 1. Validação física dos arquivos alvo
  const fileCheck = validateTargetFiles(rootDir, targetFiles);
  if (!fileCheck.ok) {
    return {
      ok: false,
      code: 'FILE_VALIDATION_ERROR',
      message: fileCheck.errors.join('\n'),
      targetErrors: [],
      fatalConfigErrors: [],
      newDependencyErrors: [],
      knownLegacyCount: 0
    };
  }

  // 2. Validação do binário do compilador TypeScript
  const tscPath = path.join(rootDir, 'node_modules/typescript/bin/tsc');
  if (!existsSync(tscPath)) {
    return {
      ok: false,
      code: 'COMPILER_NOT_FOUND',
      message: `Binário do compilador TypeScript não encontrado em: ${tscPath}`,
      targetErrors: [],
      fatalConfigErrors: [],
      newDependencyErrors: [],
      knownLegacyCount: 0
    };
  }

  // 3. Geração da configuração temporária estrita
  const tmp = path.join(rootDir, 'node_modules/.cache/tsconfig.vfx-strict.json');
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
    include: targetFiles.map(f => '../../' + f)
  }, null, 2));

  // 4. Execução do compilador
  const r = spawnSync(process.execPath, [tscPath, '-p', tmp], {
    encoding: 'utf8',
    cwd: rootDir,
    maxBuffer: 64 * 1024 * 1024
  });

  // Modo de gravação de nova baseline (análogo ao estrito.mjs --gravar)
  if (opts.recordBaseline) {
    const parsed = parseCompilerOutput(r.stdout || '', r.stderr || '', targetFiles);
    const diags = parsed.dependencyErrors.map(parseDiagnosticLine);
    const baselineOut = {
      version: '1.0.0',
      description: 'Baseline verificável de diagnósticos conhecidos em dependências legadas importadas pelos módulos VFX (strict: true).',
      totalKnown: diags.length,
      diagnostics: diags.map(d => ({
        file: d.file,
        line: d.line,
        col: d.col,
        code: d.code,
        message: d.message,
        raw: d.raw
      }))
    };
    writeFileSync(path.join(rootDir, 'scripts/typecheck-vfx-baseline.json'), JSON.stringify(baselineOut, null, 2) + '\n', 'utf8');
    return {
      ok: true,
      code: 'BASELINE_RECORDED',
      message: `Baseline gravada com sucesso: ${diags.length} diagnósticos legados conhecidos.`,
      targetErrors: [],
      fatalConfigErrors: [],
      newDependencyErrors: [],
      knownLegacyCount: diags.length
    };
  }

  // 5. Carrega a baseline para confronto estrito
  const baseline = loadBaseline(rootDir);

  return evaluateRunResult(r, targetFiles, baseline);
}

// Execução direta via CLI
const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  const shouldRecord = process.argv.includes('--gravar-baseline');
  const res = runTypecheckVfx({recordBaseline: shouldRecord});
  if (!res.ok) {
    console.error(`✗ ${res.message}`);
    process.exit(1);
  }
  console.log(`✓ TypeScript VFX estrito: ${res.message}`);
  for (const f of REQUIRED_VFX_FILES) {
    console.log(`  ✓ ${f}`);
  }
}
