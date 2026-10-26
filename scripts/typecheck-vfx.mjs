// @ts-check
// Checagem estática TypeScript dedicada aos módulos VFX dos Moves (Documento 02).
// Executa o compilador TypeScript com modo estrito completo (strict: true, noImplicitAny: true, checkJs: true)
// garantindo 0 erros de tipos nos módulos de renderização dos pilotos migrados sem inflar o orçamento legado.
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
 * @param {string[]} files
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
  const legacyErrors = [];

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
    // Ex: TS5023 (opção desconhecida), TS5083 (arquivo não lido), TS6053 (arquivo de entrada não encontrado)
    if (/error TS(5\d{3}|6\d{3}):/.test(line)) {
      fatalConfigErrors.push(line);
      continue;
    }

    // 3. Demais diagnósticos pertencem a dependências legadas importadas
    legacyErrors.push(line);
  }

  return {targetErrors, fatalConfigErrors, legacyErrors, totalDiagnostics: targetErrors.length + fatalConfigErrors.length + legacyErrors.length};
}

/**
 * Avalia o resultado da execução do processo do compilador TypeScript com tratamento rigoroso de falhas.
 * @param {{status: number | null, signal: string | NodeJS.Signals | null, error?: Error, stdout?: string, stderr?: string}} runResult
 * @param {string[]} [targetFiles]
 * @returns {{ok: boolean, code: string, message: string, targetErrors: string[], fatalConfigErrors: string[], legacyCount: number}}
 */
export function evaluateRunResult(runResult, targetFiles = REQUIRED_VFX_FILES) {
  // 1. Falha de execução do spawn (ex: binário não encontrado, erro de SO, EACCES)
  if (runResult.error) {
    return {
      ok: false,
      code: 'EXEC_SPAWN_ERROR',
      message: `Falha fatal ao iniciar o compilador TypeScript: ${runResult.error.message || runResult.error}`,
      targetErrors: [],
      fatalConfigErrors: [],
      legacyCount: 0
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
      legacyCount: 0
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
      legacyCount: 0
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
      legacyCount: parsed.legacyErrors.length
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
      legacyCount: parsed.legacyErrors.length
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
      legacyCount: parsed.legacyErrors.length
    };
  }

  // 8. Se status != 0 mas nenhum erro (nem alvo nem legado) foi emitido, há inconsistência no processo
  if (runResult.status !== 0 && parsed.totalDiagnostics === 0) {
    return {
      ok: false,
      code: 'NONZERO_EXIT_WITHOUT_DIAGNOSTICS',
      message: `Compilador encerrou com código ${runResult.status}, mas nenhum diagnóstico foi capturado.`,
      targetErrors: [],
      fatalConfigErrors: [],
      legacyCount: 0
    };
  }

  // Sucesso legítimo: 0 erros nos módulos alvo
  return {
    ok: true,
    code: 'SUCCESS',
    message: `0 erros nos ${targetFiles.length} módulos auditados (${parsed.legacyErrors.length} diagnósticos externos isolados em dependências legadas).`,
    targetErrors: [],
    fatalConfigErrors: [],
    legacyCount: parsed.legacyErrors.length
  };
}

/**
 * Executa a checagem completa de tipos VFX com validação de ambiente e compilação estrita.
 * @param {{root?: string, files?: string[], verbose?: boolean}} [opts]
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
      legacyCount: 0
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
      legacyCount: 0
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

  return evaluateRunResult(r, targetFiles);
}

// Execução direta via CLI
const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  const res = runTypecheckVfx();
  if (!res.ok) {
    console.error(`✗ ${res.message}`);
    process.exit(1);
  }
  console.log(`✓ TypeScript VFX estrito: ${res.message}`);
  for (const f of REQUIRED_VFX_FILES) {
    console.log(`  ✓ ${f}`);
  }
}
