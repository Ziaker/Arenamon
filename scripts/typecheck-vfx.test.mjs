// @ts-check
// Testes automatizados da checagem estática dedicada aos módulos VFX.
// Valida os cenários de:
//   1. Execução real com sucesso contra a baseline de diagnósticos conhecidos
//   2. Erros legados conhecidos da baseline são tolerados (teste sintético)
//   3. Erros NOVOS em dependências fora da baseline são rejeitados (teste sintético)
//   4. Multiplicidade excedida de erro da baseline é rejeitada (teste sintético)
//   5. Falha de spawn do processo (r.error)
//   6. Interrupção por sinal do SO (r.signal)
//   7. Presença de erros no stderr
//   8. Código de saída anormal (status != 0, 1, 2)
//   9. Erros fatais de configuração do compilador (TS5xxx, TS6xxx)
//  10. Erro estrito real em arquivo alvo (ex: TS7006 em sand-wave.vfx.js)
//  11. Código não-zero sem diagnósticos emitidos
//  12. Rejeição de arquivos inexistentes ou sem // @ts-check
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  REQUIRED_VFX_FILES,
  validateTargetFiles,
  parseCompilerOutput,
  evaluateRunResult,
  runTypecheckVfx,
  loadBaseline
} from './typecheck-vfx.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

console.log('--- TESTES AUTOMATIZADOS: TYPECHECK VFX COM BASELINE ESTREITA ---\n');

// 1. Sucesso real de ponta a ponta contra a baseline oficial
{
  const realRes = runTypecheckVfx({root: repoRoot});
  assert.equal(realRes.ok, true, 'Execução real deve ser bem-sucedida');
  assert.equal(realRes.code, 'SUCCESS');
  assert.equal(realRes.targetErrors.length, 0, 'Não deve haver erros nos módulos alvo');
  assert.equal(realRes.newDependencyErrors.length, 0, 'Não deve haver diagnósticos novos fora da baseline');
  assert.ok(realRes.knownLegacyCount > 0, 'Deve comprovar diagnósticos conhecidos na baseline');
  console.log(`  ✓ [1/12] Execução real contra baseline aprovada (${realRes.knownLegacyCount} diagnósticos legados validados)`);
}

// Mock de baseline controlada para testes sintéticos
const mockBaseline = {
  version: '1.0.0',
  totalKnown: 2,
  rawSet: new Set([
    'prototypes/combat-lab/src/sim/charge.js(25,44): error TS7053: Element implicitly has an any type.',
    'prototypes/combat-lab/src/sim/config.js(100,5): error TS7006: Parameter implicitly has any type.'
  ]),
  sigCounts: new Map([
    ['prototypes/combat-lab/src/sim/charge.js::error TS7053::Element implicitly has an any type.', 1],
    ['prototypes/combat-lab/src/sim/config.js::error TS7006::Parameter implicitly has any type.', 1]
  ])
};

// 2. Teste sintético: Erros conhecidos da baseline são tolerados
{
  const stdout = [
    'prototypes/combat-lab/src/sim/charge.js(25,44): error TS7053: Element implicitly has an any type.',
    'prototypes/combat-lab/src/sim/config.js(100,5): error TS7006: Parameter implicitly has any type.'
  ].join('\n');

  const res = evaluateRunResult({status: 1, signal: null, stdout}, REQUIRED_VFX_FILES, mockBaseline);
  assert.equal(res.ok, true, 'Erros conhecidos que constam na baseline devem ser tolerados');
  assert.equal(res.code, 'SUCCESS');
  assert.equal(res.newDependencyErrors.length, 0);
  assert.equal(res.knownLegacyCount, 2);
  console.log('  ✓ [2/12] Sintético: Erros conhecidos da baseline são tolerados com sucesso');
}

// 3. Teste sintético: Erro NOVO em dependência provoca falha imediata
{
  const stdoutWithNewError = [
    'prototypes/combat-lab/src/sim/charge.js(25,44): error TS7053: Element implicitly has an any type.',
    'prototypes/combat-lab/src/sim/entity.js(999,1): error TS2304: Cannot find name "nova_variavel_invalida".'
  ].join('\n');

  const res = evaluateRunResult({status: 1, signal: null, stdout: stdoutWithNewError}, REQUIRED_VFX_FILES, mockBaseline);
  assert.equal(res.ok, false, 'Erro novo fora da baseline DEVE provocar falha');
  assert.equal(res.code, 'NEW_DEPENDENCY_DIAGNOSTICS');
  assert.equal(res.newDependencyErrors.length, 1);
  assert.ok(res.newDependencyErrors[0].includes('nova_variavel_invalida'));
  assert.equal(res.knownLegacyCount, 1);
  console.log('  ✓ [3/12] Sintético: Erro novo em dependência fora da baseline rejeitado com falha');
}

// 4. Teste sintético: Multiplicidade excedida de erro da baseline é rejeitada
{
  const stdoutDuplicate = [
    'prototypes/combat-lab/src/sim/charge.js(25,44): error TS7053: Element implicitly has an any type.',
    'prototypes/combat-lab/src/sim/charge.js(26,44): error TS7053: Element implicitly has an any type.' // 2ª ocorrência (baseline só permite 1)
  ].join('\n');

  const res = evaluateRunResult({status: 1, signal: null, stdout: stdoutDuplicate}, REQUIRED_VFX_FILES, mockBaseline);
  assert.equal(res.ok, false, 'Ocorrência extra não prevista na baseline deve falhar');
  assert.equal(res.code, 'NEW_DEPENDENCY_DIAGNOSTICS');
  assert.equal(res.newDependencyErrors.length, 1);
  console.log('  ✓ [4/12] Sintético: Multiplicidade excedida de erro de baseline rejeitada');
}

// 5. Falha de spawn (r.error)
{
  const res = evaluateRunResult({
    status: null,
    signal: null,
    error: new Error('spawnSync ENOENT: tsc não encontrado')
  }, REQUIRED_VFX_FILES, mockBaseline);
  assert.equal(res.ok, false, 'Deve falhar quando houver r.error');
  assert.equal(res.code, 'EXEC_SPAWN_ERROR');
  assert.ok(res.message.includes('ENOENT'));
  console.log('  ✓ [5/12] Falha de spawn (r.error) rejeitada corretamente');
}

// 6. Encerramento por sinal (r.signal)
{
  const resKill = evaluateRunResult({status: null, signal: 'SIGKILL'}, REQUIRED_VFX_FILES, mockBaseline);
  assert.equal(resKill.ok, false);
  assert.equal(resKill.code, 'PROCESS_SIGNAL');
  assert.ok(resKill.message.includes('SIGKILL'));

  const resTerm = evaluateRunResult({status: null, signal: 'SIGTERM'}, REQUIRED_VFX_FILES, mockBaseline);
  assert.equal(resTerm.ok, false);
  assert.equal(resTerm.code, 'PROCESS_SIGNAL');
  console.log('  ✓ [6/12] Interrupção por sinal (SIGKILL / SIGTERM) rejeitada');
}

// 7. Presença de erros em stderr
{
  const res = evaluateRunResult({
    status: 1,
    signal: null,
    stderr: 'FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory'
  }, REQUIRED_VFX_FILES, mockBaseline);
  assert.equal(res.ok, false);
  assert.equal(res.code, 'STDERR_NON_EMPTY');
  assert.ok(res.message.includes('heap out of memory'));
  console.log('  ✓ [7/12] Erros em stderr (Node crash / OOM) rejeitados');
}

// 8. Código de saída anormal
{
  const res137 = evaluateRunResult({status: 137, signal: null, stdout: ''}, REQUIRED_VFX_FILES, mockBaseline);
  assert.equal(res137.ok, false);
  assert.equal(res137.code, 'ABNORMAL_EXIT_STATUS');

  const res4 = evaluateRunResult({status: 4, signal: null, stdout: ''}, REQUIRED_VFX_FILES, mockBaseline);
  assert.equal(res4.ok, false);
  assert.equal(res4.code, 'ABNORMAL_EXIT_STATUS');
  console.log('  ✓ [8/12] Código de saída anormal (status != 0, 1, 2) rejeitado');
}

// 9. Erro fatal de configuração do TypeScript (TS5xxx / TS6xxx)
{
  const stdout = [
    'error TS5023: Unknown compiler option "invalidStrictOption".',
    'prototypes/combat-lab/src/sim/charge.js(25,44): error TS7053: Element implicitly has an any type.'
  ].join('\n');

  const res = evaluateRunResult({status: 1, signal: null, stdout}, REQUIRED_VFX_FILES, mockBaseline);
  assert.equal(res.ok, false, 'Erro TS5023 não pode ser considerado sucesso');
  assert.equal(res.code, 'FATAL_CONFIG_ERROR');
  assert.equal(res.fatalConfigErrors.length, 1);
  assert.ok(res.message.includes('TS5023'));

  const stdoutNotFound = 'error TS6053: File "non-existent-config.json" not found.';
  const resNotFound = evaluateRunResult({status: 1, signal: null, stdout: stdoutNotFound}, REQUIRED_VFX_FILES, mockBaseline);
  assert.equal(resNotFound.ok, false);
  assert.equal(resNotFound.code, 'FATAL_CONFIG_ERROR');
  console.log('  ✓ [9/12] Erros de configuração do TypeScript (TS5xxx/TS6xxx) rejeitados');
}

// 10. Erro estrito real em módulo alvo de VFX
{
  const stdout = [
    'prototypes/combat-lab/src/sim/moves/sand-wave/sand-wave.vfx.js(42,12): error TS7006: Parameter "x" implicitly has an "any" type.',
    'prototypes/combat-lab/src/sim/charge.js(25,44): error TS7053: Element implicitly has an any type.'
  ].join('\n');

  const res = evaluateRunResult({status: 1, signal: null, stdout}, REQUIRED_VFX_FILES, mockBaseline);
  assert.equal(res.ok, false, 'Erro em módulo VFX alvo deve causar reprovação imediata');
  assert.equal(res.code, 'TARGET_MODULE_ERRORS');
  assert.equal(res.targetErrors.length, 1);
  assert.ok(res.targetErrors[0].includes('sand-wave.vfx.js'));
  console.log('  ✓ [10/12] Erro estrito real em arquivo alvo detectado e rejeitado');
}

// 11. Status != 0 sem diagnósticos emitidos
{
  const res = evaluateRunResult({status: 1, signal: null, stdout: ''}, REQUIRED_VFX_FILES, mockBaseline);
  assert.equal(res.ok, false);
  assert.equal(res.code, 'NONZERO_EXIT_WITHOUT_DIAGNOSTICS');
  console.log('  ✓ [11/12] Status não-zero sem diagnósticos capturados rejeitado');
}

// 12. Validação de arquivos inexistentes ou sem // @ts-check
{
  const missingRes = validateTargetFiles(repoRoot, ['arquivo-inexistente.vfx.js']);
  assert.equal(missingRes.ok, false);
  assert.ok(missingRes.errors[0].includes('não encontrado no disco'));

  // Validação real contra os 4 arquivos
  const realFileCheck = validateTargetFiles(repoRoot);
  assert.equal(realFileCheck.ok, true, 'Todos os 4 arquivos obrigatórios devem existir e ter // @ts-check');
  console.log('  ✓ [12/12] Validação física e diretivas // @ts-check comprovadas');
}

console.log('\n✓ Todos os 12 testes automatizados do typecheck-vfx (incluindo baseline sintética) APROVADOS com rigor.');
