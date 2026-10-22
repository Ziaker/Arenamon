// @ts-check
// Suíte de testes unitários do Sistema de Câmera Cinemática Arenamon (estilo ZZZ).
// Cobre: CINEMATIC_DEFAULTS, instanciação, efeitos C01 a C12, física de molas (spring inertia),
// invariantes arquiteturais (preservação do yaw funcional, limites de segurança do chão),
// acessibilidade, reset imediato e detecção de eventos de combate.

import assert from 'node:assert/strict';
import {
  CinematicCamera,
  CINEMATIC_DEFAULTS
} from '../src/view/cinematic-camera.js';

let passed = 0;
let failed = 0;
const testQueue = [];

function test(name, fn) {
  testQueue.push({name, fn});
}

// Mock DOM container para testes sem navegador completo
function createMockDom() {
  const elements = {};
  const createMockElement = (id) => {
    const children = {};
    return {
      id,
      style: {},
      className: '',
      hidden: false,
      innerHTML: '',
      setAttribute: () => {},
      getAttribute: () => null,
      appendChild: (c) => c,
      querySelector: (sel) => {
        children[sel] ??= createMockElement(sel);
        return children[sel];
      },
      querySelectorAll: () => [],
      getContext: () => ({
        clearRect: () => {},
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        stroke: () => {},
        save: () => {},
        restore: () => {},
        strokeStyle: '',
        lineWidth: 1
      }),
      width: 800,
      height: 600
    };
  };

  return {
    getElementById: (id) => null,
    querySelector: (sel) => {
      elements[sel] ??= createMockElement(sel);
      return elements[sel];
    },
    querySelectorAll: () => [],
    createElement: (tag) => createMockElement(tag),
    appendChild: (c) => c
  };
}

console.log('\n--- INICIANDO TESTES DO SISTEMA DE CÂMERA CINEMÁTICA (ZZZ) ---\n');

// ==========================================
// 1. CONFIGURAÇÃO PADRÃO E DEFAULTS
// ==========================================
console.log('1. Configuração Padrão e Segurança:');

test('Câmera Cinemática inicia desativada por padrão (não afeta suítes existentes)', () => {
  assert.equal(CINEMATIC_DEFAULTS.enabled, false, 'enabled deve ser false por padrão');
});

test('Contém todos os parâmetros C01 a C12 na especificação oficial', () => {
  const c = CINEMATIC_DEFAULTS;
  assert.ok(c.dutchDodge, 'C01 dutchDodge definido');
  assert.ok(c.lowSpeed, 'C02 lowSpeed definido');
  assert.ok(c.snapParry, 'C03 snapParry definido');
  assert.ok(c.chargeFov, 'C04 chargeFov definido');
  assert.ok(c.releaseFov, 'C05 releaseFov definido');
  assert.ok(c.meteorSlam, 'C06 meteorSlam definido');
  assert.ok(c.koCamera, 'C07 koCamera definido');
  assert.ok(c.impactFrames, 'C08 impactFrames definido');
  assert.ok(c.speedlines, 'C09 speedlines definido');
  assert.ok(c.letterbox, 'C10 letterbox definido');
  assert.ok(c.slowMotion, 'C11 slowMotion definido');
  assert.ok(c.springInertia, 'C12 springInertia definido');
  assert.ok(c.chromaticAberration, 'chromaticAberration definido');
  assert.ok(c.roundIntro, 'roundIntro definido');
  assert.ok(c.combatPopups, 'combatPopups definido');
});

test('Parâmetros respeitam limites seguros de roll e altura', () => {
  const c = CINEMATIC_DEFAULTS;
  assert.ok(c.dutchDodge.maxRoll <= 15, 'Dutch angle maximo <= ~15 graus');
  assert.ok(c.springInertia.maxRollRad <= 0.35, 'Roll maximo do spring <= 0.35 rad');
  assert.ok(c.letterbox.barPct <= 20, 'Letterbox maximo <= 20%');
  assert.ok(c.lowSpeed.dropHeight <= 1.0, 'Drop da câmera de velocidade <= 1.0m');
});

// ==========================================
// 2. INVARIANTES DE SIMULAÇÃO E YAW DO RIG
// ==========================================
console.log('\n2. Invariantes de Simulação e Preservação de Yaw:');

test('Quando desativada, apply() retorna o basePose original sem qualquer alteração', () => {
  const mockDom = createMockDom();
  const cine = new CinematicCamera(null, {overlayContainer: mockDom});
  assert.equal(cine.config.enabled, false);

  const basePose = {
    position: {x: 0, y: 3, z: 8},
    height: 3,
    lookAt: {x: 0, y: 1, z: 0},
    lookHeight: 1,
    roll: 0,
    fov: 48,
    yaw: 1.25,
    pitch: 0.3,
    dist: 8
  };

  const result = cine.apply(basePose, [], [], 0.016);
  assert.equal(result.yaw, 1.25, 'Yaw deve ser exatamente preservado');
  assert.equal(result.fov, 48, 'FOV deve ser exatamente preservado');
  assert.deepEqual(result.position, basePose.position);
});

test('Quando ativada, apply() NUNCA altera o yaw funcional do rig', () => {
  const mockDom = createMockDom();
  const cine = new CinematicCamera(null, {overlayContainer: mockDom});
  cine.config.enabled = true;
  cine.triggerDodgeAngle({dir: 'left'});

  const basePose = {
    position: {x: 1, y: 3, z: 7},
    height: 3,
    lookAt: {x: 1, y: 1, z: 1},
    lookHeight: 1,
    roll: 0,
    fov: 48,
    yaw: 2.50,
    pitch: 0.35,
    dist: 7
  };

  const result = cine.apply(basePose, [], [], 0.016);
  // O yaw do rig nunca deve ser mutado
  assert.equal(basePose.yaw, 2.50, 'Yaw funcional deve ser idêntico a basePose.yaw');
  assert.ok(result.roll !== 0, 'Roll cinemático pode ser adicionado à apresentação');
});

test('Garante altura segura da câmera acima do solo (anti-colapso)', () => {
  const mockDom = createMockDom();
  const cine = new CinematicCamera(null, {overlayContainer: mockDom});
  cine.config.enabled = true;

  // Forçar offset negativo para baixo
  cine.triggerLowSpeed({duration: 1.0, dropHeight: 10.0});

  const basePose = {
    position: {x: 0, y: 0.05, z: 5},
    height: 0.05,
    lookAt: {x: 0, y: 0.05, z: 0},
    lookHeight: 0.05,
    roll: 0,
    fov: 48,
    yaw: 0,
    pitch: 0,
    dist: 5
  };

  const result = cine.apply(basePose, [], [], 0.016);
  assert.ok(result.height >= 0.2, 'Câmera não pode afundar no chão (< 0.2m)');
});

// ==========================================
// 3. EFEITOS CINEMÁTICOS C01 A C12
// ==========================================
console.log('\n3. Efeitos Cinemáticos Individuais (C01–C12):');

test('C01: Dutch angle ajusta roll na direção correta e decai via mola', () => {
  const mockDom = createMockDom();
  const cine = new CinematicCamera(null, {overlayContainer: mockDom});
  cine.config.enabled = true;

  cine.triggerDodgeAngle({dir: 'left'});
  assert.ok(cine.target.roll < 0, 'Esquiva à esquerda deve inclinar roll negativo');

  cine.triggerDodgeAngle({dir: 'right'});
  assert.ok(cine.target.roll > 0, 'Esquiva à direita deve inclinar roll positivo');

  // Atualizar simulação e verificar propagação no spring
  cine.update(0.05, []);
  assert.ok(cine.spring.roll !== 0, 'Roll do spring deve ter sido excitado');
});

test('C02: Low-speed camera altera altura e aproximação suavemente', () => {
  const mockDom = createMockDom();
  const cine = new CinematicCamera(null, {overlayContainer: mockDom});
  cine.config.enabled = true;

  cine.triggerLowSpeed({duration: 0.5});
  assert.equal(cine.activeEffect, 'lowSpeed');
  assert.ok(cine.target.posOffset.y < 0, 'Deve baixar a câmera em direção ao chão');
});

test('C03: Lateral snap ajusta câmera durante parry / clash', () => {
  const mockDom = createMockDom();
  const cine = new CinematicCamera(null, {overlayContainer: mockDom});
  cine.config.enabled = true;

  cine.triggerLateralSnap({targetHeading: 1.0});
  assert.ok(cine.snap !== null, 'Snap lateral deve ter sido agendado');
  assert.equal(cine.activeEffect, 'parry_snap');
});

test('C04: Charge breathing modula FOV dinamicamente com base no nível', () => {
  const mockDom = createMockDom();
  const cine = new CinematicCamera(null, {overlayContainer: mockDom});
  cine.config.enabled = true;

  cine.triggerChargeBreathing({level: 2});
  assert.equal(cine.activeEffect, 'chargeBreathing');
  assert.ok(cine.target.fovOffset < 0, 'Carregamento fecha FOV (zoom-in concentrado)');
});

test('C05: FOV punch gera pulso de abertura com retorno por mola', () => {
  const mockDom = createMockDom();
  const cine = new CinematicCamera(null, {overlayContainer: mockDom});
  cine.config.enabled = true;

  cine.triggerFovPunch(12, 0.2);
  assert.ok(cine.fovPunch !== null, 'fovPunch deve estar agendado');
  assert.equal(cine.activeEffect, 'fov_punch');

  // Após aplicar, spring.fovOffset é excitado
  cine.update(0.03, []);
  assert.ok(cine.spring.fovOffset > 0, 'Spring FOV offset positivo');
});

test('C06: Meteor Contraplongée posiciona câmera no chão olhando para cima', () => {
  const mockDom = createMockDom();
  const cine = new CinematicCamera(null, {overlayContainer: mockDom});
  cine.config.enabled = true;

  cine.triggerMeteorContraplongee();
  assert.equal(cine.activeEffect, 'meteorContraplongee');
  assert.ok(cine.target.posOffset.y < 0, 'Câmera desce para contraplongée');
  assert.ok(cine.fovPunch !== null, 'Aciona punch de impacto');
});

test('C07: KO Finisher aciona enquadramento dramático de finalização', () => {
  const mockDom = createMockDom();
  const cine = new CinematicCamera(null, {overlayContainer: mockDom});
  cine.config.enabled = true;

  cine.triggerKoFinisher();
  assert.equal(cine.activeEffect, 'ko_finish');
  assert.ok(cine.koState !== null, 'KO state ativo');
});

test('C08: Impact Frame ativa overlay visual de flash', () => {
  const mockDom = createMockDom();
  const cine = new CinematicCamera(null, {overlayContainer: mockDom});
  cine.config.enabled = true;

  cine.triggerImpactFrame({whiteDur: 0.05, invertDur: 0.05, strength: 0.9});
  assert.ok(cine.impactState !== null, 'Impact frame state ativo');
  assert.equal(cine.impactState.phase, 'white');
});

test('C09: Speedlines ativa raios radiais de velocidade', () => {
  const mockDom = createMockDom();
  const cine = new CinematicCamera(null, {overlayContainer: mockDom});
  cine.config.enabled = true;

  cine.triggerSpeedlines({duration: 0.25});
  assert.ok(cine.speedlineState !== null, 'Speedlines state ativo');
});

test('C10: Dynamic Letterbox adiciona faixas cinematográficas no topo e base', () => {
  const mockDom = createMockDom();
  const cine = new CinematicCamera(null, {overlayContainer: mockDom});
  cine.config.enabled = true;

  cine.triggerLetterbox({pct: 10, duration: 0.5});
  assert.ok(cine.letterboxState !== null, 'Letterbox state ativo');
});

test('C11: Visual Slow-Motion fornece multiplicador de tempo desacelerado', () => {
  const mockDom = createMockDom();
  const cine = new CinematicCamera(null, {overlayContainer: mockDom});
  cine.config.enabled = true;

  cine.triggerVisualSlowmo({scale: 0.25, duration: 0.3});
  assert.equal(cine.getVisualTimeScale(), 0.25, 'Visual time scale deve ser 0.25 durante slow-mo');

  // Ao esgotar o tempo, timeScale volta a 1.0
  cine.update(0.4, []);
  assert.equal(cine.getVisualTimeScale(), 1.0, 'Time scale volta ao normal (1.0)');
});

test('C12: Spring Inertia restaura suavemente posição, fov e roll para repouso', () => {
  const mockDom = createMockDom();
  const cine = new CinematicCamera(null, {overlayContainer: mockDom});
  cine.config.enabled = true;

  // Impor perturbações arbitrárias no spring
  cine.spring.pos.x = 2.0;
  cine.spring.pos.y = -1.5;
  cine.spring.roll = 0.2;
  cine.spring.fovOffset = 10.0;

  // Avançar 1.5s no tempo sem alvos ativos
  for (let i = 0; i < 90; i++) cine.update(0.016, []);

  assert.ok(Math.abs(cine.spring.pos.x) < 0.2, 'spring.pos.x amortecido');
  assert.ok(Math.abs(cine.spring.roll) < 0.05, 'spring.roll amortecido');
  assert.ok(Math.abs(cine.spring.fovOffset) < 0.8, 'spring.fovOffset amortecido');
});

// ==========================================
// 4. RESET, ACESSIBILIDADE E EVENTOS
// ==========================================
console.log('\n4. Reset, Acessibilidade e Ingestão de Eventos:');

test('reset() cancela imediatamente qualquer transição e zera offsets', () => {
  const mockDom = createMockDom();
  const cine = new CinematicCamera(null, {overlayContainer: mockDom});
  cine.config.enabled = true;
  cine.triggerDodgeAngle({dir: 'left'});
  cine.triggerLetterbox({pct: 12, duration: 1.0});
  cine.triggerSpeedlines({duration: 0.5});

  cine.reset();
  assert.equal(cine.spring.roll, 0);
  assert.equal(cine.target.roll, 0);
  assert.equal(cine.spring.fovOffset, 0);
  assert.equal(cine.letterboxState, null);
  assert.equal(cine.speedlineState, null);
  assert.equal(cine.activeEffect, 'none');
});

test('setAccessibility desativa impact frames se flashReduce for verdadeiro', () => {
  const mockDom = createMockDom();
  const cine = new CinematicCamera(null, {overlayContainer: mockDom});
  cine.config.enabled = true;

  cine.setAccessibility({flashReduce: true});
  cine.triggerImpactFrame({whiteDur: 0.1, invertDur: 0.1, strength: 1.0});
  assert.equal(cine.impactState, null, 'Impact frame deve ser suprimido com noFlash/flashReduce');
});

test('Ingestão de eventos de combate mapeia automaticamente para efeitos cinemáticos', () => {
  const mockDom = createMockDom();
  const cine = new CinematicCamera(null, {overlayContainer: mockDom});
  cine.config.enabled = true;

  const mockFighters = [
    {id: 0, state: 'idle', position: {x: 0, y: 0, z: 0}, hp: 100},
    {id: 1, state: 'idle', position: {x: 2, y: 0, z: 0}, hp: 100}
  ];

  // Evento de Defesa Perfeita (parry)
  const events = [{result: 'perfect', attacker: 1, target: 0}];
  cine.apply({position: {x: 0, y: 3, z: 8}, height: 3, lookAt: {x: 0, y: 1, z: 0}, lookHeight: 1, roll: 0, fov: 48, yaw: 0, pitch: 0, dist: 8}, mockFighters, events, 0.016);
  assert.ok(cine.snap !== null || cine.activeEffect === 'parry_snap');
});

// ==========================================
// 5. VALIDAÇÃO DOS PONTOS DA AUDITORIA INDEPENDENTE
// ==========================================
console.log('\n5. Validação dos Pontos da Auditoria Independente:');

test('C07: K.O. dispara exatamente uma vez sem disparos repetidos enquanto lutador permanece derrotado', () => {
  const mockDom = createMockDom();
  const cine = new CinematicCamera(null, {overlayContainer: mockDom});
  cine.config.enabled = true;

  const mockFighters = [
    {id: 0, state: 'idle', position: {x: 0, y: 0, z: 0}, hp: 100},
    {id: 1, state: 'defeated', position: {x: 2, y: 0, z: 0}, hp: 0}
  ];
  const basePose = {position: {x: 0, y: 3, z: 8}, height: 3, lookAt: {x: 0, y: 1, z: 0}, lookHeight: 1, roll: 0, fov: 48, yaw: 0, pitch: 0, dist: 8};

  // Quadro 1: dispara K.O.
  cine.apply(basePose, mockFighters, [], 0.016);
  assert.ok(cine.koState !== null, 'K.O. deve estar ativo no primeiro quadro');
  assert.equal(cine.koConsumed, true, 'Flag koConsumed deve ser marcada');

  // Simular expiração do K.O.
  cine.clock += 5.0;
  cine.apply(basePose, mockFighters, [], 0.016);
  assert.equal(cine.koState, null, 'koState deve expirar normalmente');

  // Quadro subsequente: com lutador ainda derrotado (hp = 0), NÃO deve re-disparar
  cine.apply(basePose, mockFighters, [], 0.016);
  assert.equal(cine.koState, null, 'K.O. não deve re-disparar em loop');
});

test('C12: Desativar springInertia.enabled desativa mola e aplica alvos diretamente', () => {
  const mockDom = createMockDom();
  const cine = new CinematicCamera(null, {overlayContainer: mockDom});
  cine.config.enabled = true;
  cine.config.springInertia.enabled = false; // Toggle individual desligado

  cine.target.roll = 0.15;
  cine.target.posOffset.y = -0.4;
  cine.previewActive = 'manual';

  const basePose = {position: {x: 0, y: 3, z: 8}, height: 3, lookAt: {x: 0, y: 1, z: 0}, lookHeight: 1, roll: 0, fov: 48, yaw: 0, pitch: 0, dist: 8};
  const result = cine.apply(basePose, [], [], 0.016);

  // Sem mola, o roll vai diretamente para o alvo no mesmo quadro
  assert.equal(result.roll, 0.15, 'Roll deve ser instantâneo sem delay de mola quando springInertia.enabled for false');
});

test('C04: Suporta tackleCharge além de charge normal', () => {
  const mockDom = createMockDom();
  const cine = new CinematicCamera(null, {overlayContainer: mockDom});
  cine.config.enabled = true;

  const mockFighters = [
    {id: 0, state: 'charging', position: {x: 0, y: 0, z: 0}, hp: 100, tackleCharge: {elapsed: 0.5, duration: 1.0}},
    {id: 1, state: 'idle', position: {x: 2, y: 0, z: 0}, hp: 100}
  ];
  const basePose = {position: {x: 0, y: 3, z: 8}, height: 3, lookAt: {x: 0, y: 1, z: 0}, lookHeight: 1, roll: 0, fov: 48, yaw: 0, pitch: 0, dist: 8};

  cine.apply(basePose, mockFighters, [], 0.016);
  assert.equal(cine.activeEffect, 'charge_breath', 'Deve reconhecer tackleCharge e ativar respiração de FOV');
  assert.ok(cine.spring.velFov < 0, 'FOV deve estar comprimindo');
});

test('C06: Reconhece estado meteorDive e descida rápida em queda livre', () => {
  const mockDom = createMockDom();
  const cine = new CinematicCamera(null, {overlayContainer: mockDom});
  cine.config.enabled = true;

  const mockFighters = [
    {id: 0, state: 'meteorDive', position: {x: 0, y: 5, z: 0}, flight: {y: 5, vy: -12, isSlam: true}, hp: 100},
    {id: 1, state: 'idle', position: {x: 2, y: 0, z: 0}, hp: 100}
  ];
  const basePose = {position: {x: 0, y: 3, z: 8}, height: 3, lookAt: {x: 0, y: 1, z: 0}, lookHeight: 1, roll: 0, fov: 48, yaw: 0, pitch: 0, dist: 8};

  cine.apply(basePose, mockFighters, [], 0.016);
  assert.equal(cine.activeEffect, 'meteor_dive', 'Deve ativar enquadramento cinemático de meteor dive');
});

test('previewEffect não vaza config.enabled para true se estava false', async () => {
  const mockDom = createMockDom();
  const cine = new CinematicCamera(null, {overlayContainer: mockDom});
  cine.config.enabled = false;

  cine.previewEffect('dutchDodge');
  assert.equal(cine.previewActive, 'dutchDodge');

  // Aguardar fim do timer da prévia
  await new Promise(r => setTimeout(r, 450));
  assert.equal(cine.config.enabled, false, 'enabled deve ser restaurado para false com 100% de integridade');
  assert.equal(cine.previewActive, null);
});

test('C08: getImpactFramePhase retorna white e invert nas durações exatas para silhueta real', () => {
  const mockDom = createMockDom();
  const cine = new CinematicCamera(null, {overlayContainer: mockDom});
  cine.config.enabled = true;

  cine.triggerImpactFrame({whiteDur: 0.04, invertDur: 0.04, strength: 1.0});
  assert.equal(cine.getImpactFramePhase(), 'white', 'Primeira fase deve ser silhueta branca');

  cine.clock += 0.05;
  assert.equal(cine.getImpactFramePhase(), 'invert', 'Segunda fase deve ser silhueta invertida');

  cine.clock += 0.05;
  assert.equal(cine.getImpactFramePhase(), null, 'Após expiração deve retornar null');
});

test('P0: K.O. avança mola e órbita mesmo quando dt = 0 na fase de resultado', () => {
  const mockDom = createMockDom();
  const cine = new CinematicCamera(null, {overlayContainer: mockDom});
  cine.config.enabled = true;

  const mockFighters = [
    {id: 0, state: 'idle', position: {x: 0, y: 0, z: 0}, hp: 100},
    {id: 1, state: 'defeated', position: {x: 2, y: 0, z: 0}, hp: 0}
  ];
  const basePose = {position: {x: 0, y: 3, z: 8}, height: 3, lookAt: {x: 0, y: 1, z: 0}, lookHeight: 1, roll: 0, fov: 48, yaw: 0, pitch: 0, dist: 8};

  // Disparo do K.O.
  cine.apply(basePose, mockFighters, [], 0.016, {paused: false, realDt: 0.016});
  assert.ok(cine.koState !== null);
  const posZ0 = cine.spring.pos.z;

  // Próximo quadro: simulando game.phase === 'result' onde dt = 0 e paused = true, mas realDt = 0.016
  for (let i = 0; i < 10; i++) {
    cine.apply(basePose, mockFighters, [], 0, {paused: true, realDt: 0.016});
  }

  // A mola e a órbita devem ter se movido mesmo com dt = 0
  assert.notEqual(cine.spring.pos.z, posZ0, 'A câmera deve continuar orbitando e a mola deve avançar no K.O. mesmo com dt=0');
});

test('P1: FOV da carga do Tackle atinge 100% de compressão apenas no chargeTackleMaxTime (1.2s)', () => {
  const mockDom = createMockDom();
  const cine = new CinematicCamera(null, {overlayContainer: mockDom});
  cine.config.enabled = true;

  // Teste com t = 0.6s (metade de 1.2s)
  const mockFightersHalf = [
    {id: 0, state: 'tackleCharge', position: {x: 0, y: 0, z: 0}, hp: 100, tackleCharge: {t: 0.6, level: 2}},
    {id: 1, state: 'idle', position: {x: 2, y: 0, z: 0}, hp: 100}
  ];
  const basePose = {position: {x: 0, y: 3, z: 8}, height: 3, lookAt: {x: 0, y: 1, z: 0}, lookHeight: 1, roll: 0, fov: 48, yaw: 0, pitch: 0, dist: 8};

  cine.apply(basePose, mockFightersHalf, [], 0.016);
  // smoothstep(0.5) = 0.5 * 0.5 * (3 - 2 * 0.5) = 0.5
  const halfFovTarget = -cine.config.chargeFov.maxCompression * 0.5;
  assert.ok(Math.abs(cine.target.fovOffset - halfFovTarget) < 0.2, 'Em 0.6s o FOV deve estar em aproximadamente 50% de compressão');

  // Teste com t = 1.2s (carga máxima total)
  const mockFightersFull = [
    {id: 0, state: 'tackleCharge', position: {x: 0, y: 0, z: 0}, hp: 100, tackleCharge: {t: 1.2, level: 3}},
    {id: 1, state: 'idle', position: {x: 2, y: 0, z: 0}, hp: 100}
  ];
  cine.apply(basePose, mockFightersFull, [], 0.016);
  assert.equal(cine.target.fovOffset, -cine.config.chargeFov.maxCompression, 'Em 1.2s o FOV deve atingir compressão máxima exata');
});

test('P1: clearAll() e reset() limpam slowMoState e restauram getVisualTimeScale() para 1.0', () => {
  const mockDom = createMockDom();
  const cine = new CinematicCamera(null, {overlayContainer: mockDom});
  cine.config.enabled = true;

  // Dispara bullet time
  cine.triggerVisualSlowmo({scale: 0.15, duration: 0.5});
  assert.ok(cine.slowMoState !== null, 'slowMoState deve estar ativo');
  assert.equal(cine.getVisualTimeScale(), 0.15, 'Time scale deve refletir a câmera lenta');

  // Executa clearAll()
  cine.clearAll();
  assert.equal(cine.slowMoState, null, 'clearAll deve anular slowMoState');
  assert.equal(cine.getVisualTimeScale(), 1.0, 'getVisualTimeScale deve retornar 1.0 imediatamente após clearAll');

  // Dispara novamente e testa reset()
  cine.config.enabled = true;
  cine.triggerVisualSlowmo({scale: 0.2, duration: 0.4});
  assert.ok(cine.slowMoState !== null);
  cine.reset();
  assert.equal(cine.slowMoState, null, 'reset deve anular slowMoState');
  assert.equal(cine.getVisualTimeScale(), 1.0, 'getVisualTimeScale deve retornar 1.0 imediatamente após reset');
});

test('P2: Letterbox C10 no modo cinema aplica pillarbox (.cine-bar-left, .cine-bar-right) em resoluções ultrawide (> 2.39:1)', () => {
  const origDoc = globalThis.document;
  const origWin = globalThis.window;
  const mockDom = createMockDom();
  mockDom.getElementById = (id) => null;
  globalThis.document = mockDom;
  globalThis.window = {innerWidth: 3840, innerHeight: 1080};

  try {
    // Simula canvas ultrawide 32:9 (ex: 3840 x 1080 -> aspect = 3.55 > 2.39)
    const mockCanvas = {clientWidth: 3840, clientHeight: 1080};
    const cine = new CinematicCamera(mockCanvas, {overlayContainer: mockDom});
    cine.config.enabled = true;
    cine.config.letterbox.enabled = true;
    cine.config.letterbox.mode = 'cinema';

    cine.triggerLetterbox({duration: 0.5, mode: 'cinema'});
    // Avança meio ciclo (env ~ 1.0 no ponto médio)
    cine.clock += 0.25;
    cine.renderOverlays();

    const leftBar = cine.letterboxEl?.querySelector('.cine-bar-left');
    const rightBar = cine.letterboxEl?.querySelector('.cine-bar-right');
    const topBar = cine.letterboxEl?.querySelector('.cine-bar-top');
    const botBar = cine.letterboxEl?.querySelector('.cine-bar-bottom');

    assert.ok(leftBar && rightBar, 'Elementos das barras laterais devem existir');
    assert.equal(topBar.style.height, '0%', 'Barras superior e inferior não devem cobrir ultrawide');
    assert.ok(parseFloat(leftBar.style.width) > 0, 'Barra lateral esquerda deve ter largura positiva no ultrawide');
    assert.ok(parseFloat(rightBar.style.width) > 0, 'Barra lateral direita deve ter largura positiva no ultrawide');
  } finally {
    globalThis.document = origDoc;
    globalThis.window = origWin;
  }
});

test('Opção A: Aberração Cromática dispara em impactos fortes e decai suavemente', () => {
  const origDoc = globalThis.document;
  const mockDom = createMockDom();
  mockDom.getElementById = () => null;
  globalThis.document = mockDom;

  try {
    const cine = new CinematicCamera(null, {overlayContainer: mockDom});
    cine.config.enabled = true;
    cine.triggerChromaticAberration({duration: 0.3, intensity: 8});
    assert.ok(cine.chromaState !== null, 'chromaState deve estar ativo');
    assert.equal(cine.chromaState.intensity, 8);

    // Avança tempo e chama renderOverlays
    cine.clock += 0.15;
    cine.renderOverlays();
    assert.ok(parseFloat(cine.chromaEl.style.opacity) > 0, 'Overlay de aberração deve ter opacidade positiva');

    // Ao esgotar o tempo, deve limpar
    cine.clock += 0.2;
    cine.renderOverlays();
    assert.equal(cine.chromaState, null, 'chromaState deve anular após a duração');
    assert.equal(cine.chromaEl.style.opacity, '0');
  } finally {
    globalThis.document = origDoc;
  }
});

test('Opção A: Intro de Round aplica sweeping inicial e recupera a visão de jogo', () => {
  const mockDom = createMockDom();
  const cine = new CinematicCamera(null, {overlayContainer: mockDom});
  cine.config.enabled = true;
  cine.triggerRoundIntro({duration: 1.0});

  const basePose = {position: {x: 0, y: 3, z: 8}, height: 3, lookAt: {x: 0, y: 1, z: 0}, lookHeight: 1, roll: 0, fov: 48, yaw: 0, pitch: 0, dist: 8};
  const mockFighters = [
    {id: 0, state: 'idle', position: {x: -1.5, y: 0, z: 0}, hp: 100},
    {id: 1, state: 'idle', position: {x: 1.5, y: 0, z: 0}, hp: 100}
  ];

  // Início da intro (t = 0.1s)
  cine.apply(basePose, mockFighters, [], 0.1);
  assert.equal(cine.activeEffect, 'round_intro');
  assert.ok(cine.target.roll > 0 || cine.target.posOffset.x !== 0, 'Alvo deve sofrer offset da intro');

  // Fim da intro (t = 1.0s)
  cine.apply(basePose, mockFighters, [], 1.0);
  assert.equal(cine.roundIntroState, null, 'roundIntroState deve finalizar ao completar duração');
});

test('Opção C: Popups de Combate e Números de Dano geram elementos estilizados', () => {
  const origDoc = globalThis.document;
  const mockDom = createMockDom();
  const spawnedElements = [];
  const origCreate = mockDom.createElement;
  mockDom.createElement = (tag) => {
    const el = origCreate(tag);
    el.parentNode = mockDom;
    spawnedElements.push(el);
    return el;
  };
  globalThis.document = mockDom;

  try {
    const cine = new CinematicCamera(null, {overlayContainer: mockDom});
    cine.config.enabled = true;

    // Dispara Callout de Parry Perfeito
    cine.spawnCallout('PERFECT DEFLECTION!', 'perfect', {x: 0.5, y: 0.4});
    const callout = spawnedElements.find(e => e.className.includes('cine-callout-perfect'));
    assert.ok(callout, 'Elemento de callout deve ser gerado');
    assert.equal(callout.textContent, 'PERFECT DEFLECTION!');

    // Dispara Número de Dano Crítico
    cine.spawnDamageNumber(45, true, {x: 0.55, y: 0.45});
    const damageEl = spawnedElements.find(e => e.className.includes('cine-crit'));
    assert.ok(damageEl, 'Elemento de dano crítico deve ser gerado');
    assert.equal(damageEl.textContent, '-45 CRIT!');
  } finally {
    globalThis.document = origDoc;
  }
});

// Execução assíncrona sequencial de todos os testes
for (const t of testQueue) {
  try {
    await t.fn();
    passed++;
    console.log(`  ✓ ${t.name}`);
  } catch (err) {
    failed++;
    console.error(`  ✗ ${t.name}:`, err.message);
  }
}

console.log('\n==========================================');
console.log(`TESTES CONCLUÍDOS: ${passed} passaram, ${failed} falharam.`);
console.log('==========================================\n');

if (failed > 0) {
  process.exit(1);
}
