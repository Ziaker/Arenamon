// prototypes/combat-lab/test/combat-windows.test.mjs
// Testes unitários do contrato AnimationCombatWindows, do validador estrutural e da telemetria de janelas.
// Execução: node prototypes/combat-lab/test/combat-windows.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  SCHEMA_VERSION,
  DEFAULT_SIMULATION_FPS,
  DEFAULT_STEP_SECONDS,
  createTimeHelpers,
  extractClipDuration,
  createAnimationCombatWindows,
  fromGlbEvents,
  effectiveArenaWindows,
  validateCombatWindows
} from '../src/sim/animation-combat-windows.js';
import {
  generateCombatWindowsReport,
  formatCombatWindowsReportText
} from '../src/sim/combat-windows-report.js';

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log('✓', name);
}

// 1. Taxa de passos dinâmica e aritmética de tempo
test('createTimeHelpers suporta taxa configurável e preserva aritmética inteira', () => {
  const h120 = createTimeHelpers(1 / 120);
  assert.equal(h120.fps, 120);
  assert.equal(h120.stepToMs(120), 1000);
  assert.equal(h120.msToStep(1000), 120);
  assert.equal(h120.secondsToStep(0.40), 48);
  assert.equal(h120.stepToMs(48), 400);

  // 60 Hz configurável
  const h60 = createTimeHelpers(1 / 60);
  assert.equal(h60.fps, 60);
  assert.equal(h60.secondsToStep(0.40), 24);
  assert.equal(h60.stepToMs(24), 400);
});

// 2. Semântica estrita de intervalos semiabertos [startStep, endStep)
test('intervalos semiabertos [start, end) possuem duração exata (end - start) e fronteira contígua', () => {
  const contract = createAnimationCombatWindows({
    actionDurationSeconds: 0.40, // 48 passos
    activeWindows: [[10, 38]],   // [10, 38)
    invulnerabilityWindows: [[0, 24]] // [0, 24)
  });

  assert.equal(contract.intervalSemantics, '[startStep, endStep)');
  const [s, e] = contract.activeWindows[0];
  assert.equal(s, 10);
  assert.equal(e, 38);
  assert.equal(e - s, 28, 'Janela [10, 38) contém exatamente 28 passos');

  // Comportamento em tempo de execução: currentStep >= start && currentStep < end
  const isActive = step => step >= s && step < e;
  assert.equal(isActive(9), false, 'Passo 9 é antes do início');
  assert.equal(isActive(10), true, 'Passo 10 é o primeiro passo ativo');
  assert.equal(isActive(37), true, 'Passo 37 é o último passo ativo');
  assert.equal(isActive(38), false, 'Passo 38 é exclusivo (já encerrou)');
});

// 3. Suporte a multi-hit e ausência de falso overlap em janelas contíguas
test('duas janelas ativas contíguas [10, 20) e [20, 30) NÃO se sobrepõem no modelo semiaberto', () => {
  const contract = createAnimationCombatWindows({
    actionDurationSeconds: 0.60,
    activeWindows: [[10, 20], [20, 30]] // contíguas: término de w1 coincide com início de w2
  });

  const val = validateCombatWindows(contract);
  assert.ok(val.valid, 'Janelas semiabertas contíguas não se sobrepõem');
  assert.equal(val.errors.length, 0);

  // Já [10, 21) e [20, 30) devem ser rejeitadas por sobreposição
  const contractOverlap = createAnimationCombatWindows({
    actionDurationSeconds: 0.60,
    activeWindows: [[10, 21], [20, 30]]
  });
  const valOverlap = validateCombatWindows(contractOverlap);
  assert.equal(valOverlap.valid, false);
  assert.ok(valOverlap.errors.some(err => err.code === 'OVERLAPPING_ACTIVE_WINDOWS'));
});

// 4. Validador estrutural rigoroso (NaN, Infinity, intervalos vazios e volumes)
test('validador rejeita NaN, Infinity, intervalos vazios/invertidos e vetores inválidos', () => {
  // NaN em janela
  const contractNan = createAnimationCombatWindows({
    actionDurationSeconds: 0.40,
    activeWindows: [[NaN, 20]]
  });
  const valNan = validateCombatWindows(contractNan);
  assert.equal(valNan.valid, false);
  assert.ok(valNan.errors.some(e => e.code === 'NAN_OR_INFINITY_IN_WINDOW'));

  // Intervalo vazio [20, 20) ou invertido [25, 20)
  const contractEmpty = createAnimationCombatWindows({
    actionDurationSeconds: 0.40,
    activeWindows: [[20, 20]]
  });
  const valEmpty = validateCombatWindows(contractEmpty);
  assert.equal(valEmpty.valid, false);
  assert.ok(valEmpty.errors.some(e => e.code === 'EMPTY_OR_INVERTED_WINDOW'));

  // Volume com offset ou size inválido
  const contractBadVolume = createAnimationCombatWindows({
    actionDurationSeconds: 0.40,
    volume: {
      shape: 'aabb',
      offset: [0, 0], // apenas 2 componentes
      size: [1, -1, 1], // tamanho negativo
      metadataOnly: true
    }
  });
  const valBadVol = validateCombatWindows(contractBadVolume);
  assert.equal(valBadVol.valid, false);
  assert.ok(valBadVol.errors.some(e => e.code === 'INVALID_VOLUME_OFFSET'));
  assert.ok(valBadVol.errors.some(e => e.code === 'INVALID_VOLUME_SIZE'));
});

// 5. Pareamento por IDENTIDADE de evento (imunidade à colisão de passos quantizados)
test('fromGlbEvents pareia eventos por identidade mesmo quando caem no mesmo passo', () => {
  // Dois eventos hitbox_off muito próximos que quantizam para o mesmo passo
  const rawEvents = [
    {id: 'on_1', type: 'hitbox_on', time: 0.10},
    {id: 'off_1', type: 'hitbox_off', time: 0.201}, // passo 24
    {id: 'on_2', type: 'hitbox_on', time: 0.25},
    {id: 'off_2', type: 'hitbox_off', time: 0.202}  // também passo 24, com ID diferente
  ];

  const contract = fromGlbEvents(rawEvents, {
    clipDurationSeconds: 1.0,
    actionDurationSeconds: 1.0,
    stepSeconds: 1 / 120
  });

  assert.equal(contract.activeWindows.length, 2);
  // O pareamento por identidade garante que off_1 consome apenas o primeiro par
  assert.deepEqual(contract.activeWindows[0], [12, 24]);
  // on_2 não confunde off_1 como livre
  assert.equal(contract.activeWindows[1][0], 30);
});

// 6. Invulnerabilidade do Tackle e da Esquiva na Arena Efetiva
test('effectiveArenaWindows inclui invulnerabilidade do tackle e da esquiva a partir da config', () => {
  const config = {
    test: {step: 1 / 120},
    actions: {
      tackle: {duration: 0.40, chainAfter: 0.20, invulnerable: 0.20},
      dodge: {duration: 0.40, chainAfter: 0.20, invulnerable: 0.20, cancel: {dodgeToTackle: 1, fromEnd: 0.15, windowMode: 1}}
    },
    extras: {toggles: {enableInvulnerability: 1}}
  };

  const effTackle = effectiveArenaWindows('tackle', config);
  assert.deepEqual(effTackle.activeWindows, [[0, 48]], 'Tackle legado ativo em [0, 48)');
  assert.deepEqual(effTackle.invulnerabilityWindows, [[0, 24]], 'Tackle possui invulnerabilidade em [0, 24)');
  assert.equal(effTackle.chainAfterStep, 24, 'chainAfter é aos 200 ms (passo 24)');

  const effDodge = effectiveArenaWindows('dodge_forward', config);
  assert.deepEqual(effDodge.activeWindows, [], 'Esquiva não tem hitbox');
  assert.deepEqual(effDodge.invulnerabilityWindows, [[0, 24]], 'Esquiva tem invulnerabilidade em [0, 24)');
  assert.deepEqual(effDodge.cancelWindow, [30, 48], 'Cancelamento C->X nos últimos 150 ms (passo 30..48)');
});

// 7. Distinção formal entre chainAfter, recovery visual e mechanical recovery
test('relatório distingue chainAfter mecânico de recuperação visual pós-hitbox', () => {
  const mockChar = {
    name: 'Fighter_Test',
    clips: [{name: 'tackle_anim', duration: 1.0}],
    variantsOf: () => [0],
    source: {
      eventsByClip: [[
        {id: '1', type: 'hitbox_on', time: 0.20},
        {id: '2', type: 'hitbox_off', time: 0.30},
        {id: '3', type: 'recovery_start', time: 0.35}
      ]]
    }
  };

  const report = generateCombatWindowsReport(mockChar, {
    actionIds: ['tackle'],
    config: {
      test: {step: 1 / 120},
      actions: {tackle: {duration: 0.40, chainAfter: 0.20, invulnerable: 0.20}},
      extras: {toggles: {enableInvulnerability: 1}}
    }
  });

  const rep = report.actions[0].variants[0];
  // chainAfter da Arena: passo 24
  assert.equal(rep.phases.arena.chainAfterStep, 24);
  // Marcador visual da animação: recovery_start (0.35s reescalado)
  assert.notEqual(rep.phases.marked.recoveryMarker, rep.phases.arena.chainAfterStep);
});

// 8. Seleção de variante: Executada com serial vs Simulada por seed
test('seleção de variante distingue execução real (com serial) de simulação de seed', () => {
  const mockCharMulti = {
    name: 'Multi_Var_Char',
    clips: [{name: 'clip_0', duration: 1.0}, {name: 'clip_1', duration: 1.0}],
    variantsOf: () => [0, 1],
    source: {eventsByClip: [[], []]}
  };

  // 1. Com tick e serial reais de telemetria
  const reportExec = generateCombatWindowsReport(mockCharMulti, {
    actionIds: ['tackle'],
    tick: 120,
    serial: 5
  });
  assert.equal(reportExec.actions[0].selectionContext.type, 'executed');
  assert.ok(reportExec.actions[0].selectionContext.description.includes('serial 5'));

  // 2. Apenas com tick (serial assumido = 0)
  const reportSim = generateCombatWindowsReport(mockCharMulti, {
    actionIds: ['tackle'],
    tick: 120
  });
  assert.equal(reportSim.actions[0].selectionContext.type, 'simulated_seed');
  assert.ok(reportSim.actions[0].selectionContext.description.includes('serial assumido = 0'));
});

// 9. TESTE COM GLB REAL: personagem-studio.glb (duração de 3 s e janela [10, 38))
// O GLB mora em validation/ (pasta ignorada pelo Git, só existe na máquina local): na CI (variável CI) o teste é PULADO de forma visível; localmente continua obrigatório.
const glbPath = path.resolve('prototypes/combat-lab/validation/personagem-studio.glb');
if (process.env.CI && !fs.existsSync(glbPath)) console.log('- PULADO na CI: GLB real (personagem-studio.glb) não está no repositório (validation/ é local)');
else test('GLB real (personagem-studio.glb): duração real de 3 s, janela ativa [10, 38) e zero erros', () => {
  assert.ok(fs.existsSync(glbPath), 'Arquivo GLB oficial deve existir');

  const buf = fs.readFileSync(glbPath);
  const jsonLen = buf.readUInt32LE(12);
  const gltf = JSON.parse(buf.toString('utf8', 20, 20 + jsonLen));

  const tackleAnim = gltf.animations.find(a => a.name === 'tackle');
  assert.ok(tackleAnim, 'Animação tackle deve existir no GLB');

  // 1. Extração da duração real a partir dos accessors
  const realDuration = extractClipDuration(tackleAnim, gltf.accessors);
  assert.equal(realDuration, 3.0, 'Duração real do tackle no GLB deve ser exatamente 3.0 s');

  // 2. Construção do contrato com a duração real
  const events = tackleAnim.extras?.arenamon?.events || [];
  assert.equal(events.length, 5, 'Tackle possui 5 eventos no GLB');

  const contract = fromGlbEvents(events, {
    characterId: 'personagem_studio',
    actionId: 'tackle',
    clipName: 'tackle',
    clipDurationSeconds: realDuration,
    actionDurationSeconds: 0.40, // 48 passos na Arena
    stepSeconds: 1 / 120
  });

  // 3. Validação do contrato: não deve haver erro de TIME_EXCEEDS_DURATION!
  const validation = validateCombatWindows(contract, events, {expectedStepSeconds: 1 / 120});
  assert.ok(validation.valid, 'Contrato do tackle real deve ser válido');
  assert.equal(validation.errors.length, 0, 'Não deve haver erros falsos de duração');

  // 4. Verificação das janelas reescaladas
  // Hitbox liga a 0.6s -> 80 ms -> passo 10
  // Hitbox desliga a 2.4s -> 320 ms -> passo 38
  assert.deepEqual(contract.activeWindows, [[10, 38]], 'Janela ativa deve ser [10, 38)');

  // Invulnerabilidade liga a 0.0s -> 0 ms -> passo 0
  // Invulnerabilidade desliga a 1.5s -> 200 ms -> passo 24
  assert.deepEqual(contract.invulnerabilityWindows, [[0, 24]], 'Invulnerabilidade deve ser [0, 24)');

  // Impacto em 0.9s -> 120 ms -> passo 14
  assert.equal(contract.impactHints.length, 1);
  assert.equal(contract.impactHints[0].step, 14);

  // 5. Comparação e relatório com a Arena
  const mockChar = {
    source: {name: 'Personagem_Studio_Real', eventsByClip: [events], gltfAccessors: gltf.accessors},
    clips: [{name: 'tackle', duration: realDuration}],
    variantsOf: () => [0]
  };

  const report = generateCombatWindowsReport(mockChar, {
    actionIds: ['tackle'],
    config: {
      test: {step: 1 / 120},
      actions: {tackle: {duration: 0.40, chainAfter: 0.20, invulnerable: 0.20}},
      extras: {toggles: {enableInvulnerability: 1}}
    }
  });

  const rep = report.actions[0].variants[0];
  // Marcada: startup = 10 passos (83.3 ms), ativo = 28 passos (233.3 ms), recuperação pós-ativo = 10 passos (83.3 ms)
  assert.equal(rep.phases.marked.startupSteps, 10);
  assert.equal(rep.phases.marked.activeSteps, 28);
  assert.equal(rep.phases.marked.recoverySteps, 10);

  // Invulnerabilidade marcada vs Arena: [0, 24) vs [0, 24) -> Concordância perfeita (delta = 0)!
  assert.equal(rep.phases.deltas.invulnerability.steps, 0);
  assert.equal(rep.phases.deltas.invulnerability.ms, 0);

  // Markdown formatado
  const md = formatCombatWindowsReportText(report);
  assert.ok(md.includes('[10, 38)'));
  assert.ok(md.includes('Duração real da animação no GLB: **3.000 s**'));
});

console.log(`\nTODOS OS ${passed} CENÁRIOS DE TESTE PASSARAM COM SUCESSO!`);
