// @ts-check
// Testes automatizados da checagem estática dedicada aos módulos VFX.
// Valida os cenários de:
//   1. Execução real com sucesso nos 4 módulos alvo
//   2. Falha de spawn do processo (r.error)
//   3. Interrupção por sinal do SO (r.signal)
//   4. Presença de erros no stderr
//   5. Código de saída anormal (status != 0, 1, 2)
//   6. Erros fatais de configuração do compilador (TS5xxx, TS6xxx)
//   7. Erro estrito real em arquivo alvo (ex: TS7006 em sand-wave.vfx.js)
//   8. Isolamento de diagnósticos de dependências legadas
//   9. Código não-zero sem diagnósticos emitidos
//  10. Rejeição de arquivos inexistentes ou sem // @ts-check
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  REQUIRED_VFX_FILES,
  validateTargetFiles,
  parseCompilerOutput,
  evaluateRunResult,
  runTypecheckVfx
} from './typecheck-vfx.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

console.log('--- TESTES AUTOMATIZADOS: TYPECHECK VFX ---\n');

// 1. Sucesso real de ponta a ponta
{
  const realRes = runTypecheckVfx();
  assert.equal(realRes.ok, true, 'Execução real deve ser bem-sucedida');
  assert.equal(realRes.code, 'SUCCESS');
  assert.equal(realRes.targetErrors.length, 0, 'Não deve haver erros nos módulos alvo');
  assert.ok(realRes.legacyCount > 0, 'Deve contabilizar diagnósticos isolados de dependências legadas');
  console.log('  ✓ [1/10] Execução real de ponta a ponta aprovada');
}

// 2. Falha de spawn (r.error)
{
  const res = evaluateRunResult({
    status: null,
    signal: null,
    error: new Error('spawnSync ENOENT: tsc não encontrado')
  });
  assert.equal(res.ok, false, 'Deve falhar quando houver r.error');
  assert.equal(res.code, 'EXEC_SPAWN_ERROR');
  assert.ok(res.message.includes('ENOENT'));
  console.log('  ✓ [2/10] Falha de spawn (r.error) rejeitada corretamente');
}

// 3. Encerramento por sinal (r.signal)
{
  const resKill = evaluateRunResult({
    status: null,
    signal: 'SIGKILL'
  });
  assert.equal(resKill.ok, false);
  assert.equal(resKill.code, 'PROCESS_SIGNAL');
  assert.ok(resKill.message.includes('SIGKILL'));

  const resTerm = evaluateRunResult({
    status: null,
    signal: 'SIGTERM'
  });
  assert.equal(resTerm.ok, false);
  assert.equal(resTerm.code, 'PROCESS_SIGNAL');
  console.log('  ✓ [3/10] Interrupção por sinal (SIGKILL / SIGTERM) rejeitada');
}

// 4. Presença de erros em stderr
{
  const res = evaluateRunResult({
    status: 1,
    signal: null,
    stderr: 'FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory'
  });
  assert.equal(res.ok, false);
  assert.equal(res.code, 'STDERR_NON_EMPTY');
  assert.ok(res.message.includes('heap out of memory'));
  console.log('  ✓ [4/10] Erros em stderr (Node crash / OOM) rejeitados');
}

// 5. Código de saída anormal
{
  const res137 = evaluateRunResult({
    status: 137,
    signal: null,
    stdout: ''
  });
  assert.equal(res137.ok, false);
  assert.equal(res137.code, 'ABNORMAL_EXIT_STATUS');

  const res4 = evaluateRunResult({
    status: 4,
    signal: null,
    stdout: ''
  });
  assert.equal(res4.ok, false);
  assert.equal(res4.code, 'ABNORMAL_EXIT_STATUS');
  console.log('  ✓ [5/10] Código de saída anormal (status != 0, 1, 2) rejeitado');
}

// 6. Erro fatal de configuração do TypeScript (TS5xxx / TS6xxx)
{
  const stdout = [
    'error TS5023: Unknown compiler option "invalidStrictOption".',
    'prototypes/combat-lab/src/sim/charge.js(10,5): error TS7053: Legacy error.'
  ].join('\n');

  const res = evaluateRunResult({
    status: 1,
    signal: null,
    stdout
  });
  assert.equal(res.ok, false, 'Erro TS5023 não pode ser considerado sucesso');
  assert.equal(res.code, 'FATAL_CONFIG_ERROR');
  assert.equal(res.fatalConfigErrors.length, 1);
  assert.ok(res.message.includes('TS5023'));

  const stdoutNotFound = 'error TS6053: File "non-existent-config.json" not found.';
  const resNotFound = evaluateRunResult({status: 1, signal: null, stdout: stdoutNotFound});
  assert.equal(resNotFound.ok, false);
  assert.equal(resNotFound.code, 'FATAL_CONFIG_ERROR');
  console.log('  ✓ [6/10] Erros de configuração do TypeScript (TS5xxx/TS6xxx) rejeitados');
}

// 7. Erro estrito real em módulo alvo de VFX
{
  const stdout = [
    'prototypes/combat-lab/src/sim/moves/sand-wave/sand-wave.vfx.js(42,12): error TS7006: Parameter "x" implicitly has an "any" type.',
    'prototypes/combat-lab/src/sim/config.js(213,18): error TS7006: Parameter "amplitude" implicitly has an "any" type.'
  ].join('\n');

  const res = evaluateRunResult({
    status: 1,
    signal: null,
    stdout
  });
  assert.equal(res.ok, false, 'Erro em módulo VFX alvo deve causar reprovação imediata');
  assert.equal(res.code, 'TARGET_MODULE_ERRORS');
  assert.equal(res.targetErrors.length, 1);
  assert.ok(res.targetErrors[0].includes('sand-wave.vfx.js'));
  console.log('  ✓ [7/10] Erro estrito real em arquivo alvo detectado e rejeitado');
}

// 8. Isolamento correto de erros de dependências legadas
{
  const stdout = [
    'prototypes/combat-lab/src/sim/charge.js(25,44): error TS7053: Element implicitly has an "any" type.',
    'prototypes/combat-lab/src/sim/config.js(213,18): error TS7006: Parameter "amplitude" implicitly has an "any" type.'
  ].join('\n');

  const res = evaluateRunResult({
    status: 1,
    signal: null,
    stdout
  });
  assert.equal(res.ok, true, 'Erros exclusivos de dependências legadas não reprovam os módulos alvo');
  assert.equal(res.code, 'SUCCESS');
  assert.equal(res.targetErrors.length, 0);
  assert.equal(res.legacyCount, 2);
  console.log('  ✓ [8/10] Isolamento de dependências legadas validado');
}

// 9. Status != 0 sem diagnósticos emitidos
{
  const res = evaluateRunResult({
    status: 1,
    signal: null,
    stdout: ''
  });
  assert.equal(res.ok, false);
  assert.equal(res.code, 'NONZERO_EXIT_WITHOUT_DIAGNOSTICS');
  console.log('  ✓ [9/10] Status não-zero sem diagnósticos capturados rejeitado');
}

// 10. Validação de arquivos inexistentes ou sem // @ts-check
{
  const missingRes = validateTargetFiles(repoRoot, ['arquivo-inexistente.vfx.js']);
  assert.equal(missingRes.ok, false);
  assert.ok(missingRes.errors[0].includes('não encontrado no disco'));

  // Validação real contra os 4 arquivos
  const realFileCheck = validateTargetFiles(repoRoot);
  assert.equal(realFileCheck.ok, true, 'Todos os 4 arquivos obrigatórios devem existir e ter // @ts-check');
  console.log('  ✓ [10/10] Validação física e diretivas // @ts-check comprovadas');
}

console.log('\n✓ Todos os 10 testes automatizados do typecheck-vfx APROVADOS com rigor.');
