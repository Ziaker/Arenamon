// prototypes/combat-lab/src/sim/combat-windows-report.js
// Relatório somente leitura de janelas de combate por personagem e variante.
// Compara janelas marcadas na animação × janelas efetivas atuais da Arena.
// Semântica de intervalos: estritamente semiabertos [startStep, endStep).

import {
  createTimeHelpers,
  fromGlbEvents,
  effectiveArenaWindows,
  validateCombatWindows,
  extractClipDuration,
  DEFAULT_STEP_SECONDS
} from './animation-combat-windows.js';

/** Hash determinístico (mesma implementação de characters.js) */
function hash(...parts) {
  let h = 2166136261;
  for (const ch of parts.join('|')) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Gerador pseudo-aleatório mulberry32 */
function mulberry(seed) {
  let t = (seed + 0x6D2B79F5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * Gera relatório analítico de janelas de combate para um personagem e suas variantes.
 * @param {Object} character - Objeto Character (ou mock estrutural com source/clips)
 * @param {Object} [options]
 * @returns {Object} Relatório estruturado
 */
export function generateCombatWindowsReport(character, options = {}) {
  const config = options.config || {
    test: {step: DEFAULT_STEP_SECONDS},
    actions: {
      tackle: {duration: 0.40, chainAfter: 0.20, invulnerable: 0.20},
      dodge: {duration: 0.40, invulnerable: 0.20, chainAfter: 0.20, cancel: {dodgeToTackle: 1, fromEnd: 0.15, windowMode: 1}}
    },
    extras: {toggles: {enableInvulnerability: 1}}
  };

  const stepSec = config.test?.step ?? DEFAULT_STEP_SECONDS;
  const helpers = createTimeHelpers(stepSec);

  const actionIds = options.actionIds || ['tackle', 'dodge_forward', 'dodge_back', 'dodge_left', 'dodge_right', 'move_1', 'move_2'];
  const tick = options.tick ?? null;
  const serial = options.serial ?? null;
  const slot = character.slot ?? 0;

  const characterId = character.source?.name || character.name || 'personagem';
  const actionsReport = [];

  for (const actionId of actionIds) {
    const variantIndices = character.variantsOf ? character.variantsOf(actionId) : (character.variants?.[actionId] || []);

    if (!variantIndices || variantIndices.length === 0) {
      actionsReport.push({
        actionId,
        hasAnimation: false,
        note: `Nenhuma variante de animação associada para ${actionId}.`,
        variants: []
      });
      continue;
    }

    // Identificação da variante selecionada (executada vs simulada)
    let pickedIndex = variantIndices[0];
    let selectionContext = {type: 'primary', description: 'Variante primária (índice 0)'};

    if (variantIndices.length > 1) {
      if (tick != null && serial != null) {
        const seed = hash(slot, actionId, tick, serial);
        const r = mulberry(seed);
        pickedIndex = variantIndices[Math.floor(r * variantIndices.length)];
        selectionContext = {
          type: 'executed',
          description: `Variante executada na simulação (tick ${tick}, serial ${serial})`,
          tick,
          serial
        };
      } else if (tick != null) {
        const seed = hash(slot, actionId, tick, 0);
        const r = mulberry(seed);
        pickedIndex = variantIndices[Math.floor(r * variantIndices.length)];
        selectionContext = {
          type: 'simulated_seed',
          description: `Variante simulada para esta seed/tick ${tick} (serial assumido = 0)`,
          tick,
          serialAssumed: 0
        };
      }
    }

    const arenaEffective = effectiveArenaWindows(actionId, config);
    const variantsData = [];

    for (let i = 0; i < variantIndices.length; i++) {
      const clipIndex = variantIndices[i];
      const clip = character.clips?.[clipIndex] || {name: `Clip_${clipIndex}`};
      const rawEvents = character.source?.eventsByClip?.[clipIndex] || clip.userData?.arenamon?.events || [];

      // Duração real da animação do GLB
      const realClipDurSec = extractClipDuration(clip, character.source?.gltfAccessors) || clip.duration || 1.0;

      // Duração da ação na Arena
      const actionDurSec = actionId === 'tackle' ? (config.actions?.tackle?.duration ?? 0.40)
        : actionId.startsWith('dodge') ? (config.actions?.dodge?.duration ?? 0.40)
        : realClipDurSec;

      const contract = fromGlbEvents(rawEvents, {
        characterId,
        actionId,
        clipName: clip.name,
        variantIndex: i,
        stepSeconds: stepSec,
        clipDurationSeconds: realClipDurSec,
        actionDurationSeconds: actionDurSec
      });

      const validation = validateCombatWindows(contract, rawEvents, {expectedStepSeconds: stepSec});

      // Cálculo de fases em intervalos semiabertos [start, end)
      const markedActive = contract.activeWindows;
      const firstActiveStart = markedActive.length > 0 ? markedActive[0][0] : null;
      const lastActiveEnd = markedActive.length > 0 ? markedActive[markedActive.length - 1][1] : null;

      // Duração ativa total = soma de (end - start)
      const totalMarkedActiveSteps = markedActive.reduce((acc, [s, e]) => acc + Math.max(0, e - s), 0);
      const markedStartupSteps = firstActiveStart != null ? firstActiveStart : contract.actionDurationSteps;
      const markedVisualRecoverySteps = lastActiveEnd != null ? Math.max(0, contract.actionDurationSteps - lastActiveEnd) : 0;

      // Janela efetiva da Arena atual
      const arenaActive = arenaEffective.activeWindows;
      const totalArenaActiveSteps = arenaActive.reduce((acc, [s, e]) => acc + Math.max(0, e - s), 0);
      const arenaStartupSteps = arenaActive.length > 0 ? arenaActive[0][0] : 0;
      const arenaLastActiveEnd = arenaActive.length > 0 ? arenaActive[arenaActive.length - 1][1] : 0;
      const arenaVisualRecoverySteps = Math.max(0, arenaEffective.durationSteps - arenaLastActiveEnd);

      // Invulnerabilidade marcada × efetiva
      const markedInv = contract.invulnerabilityWindows;
      const arenaInv = arenaEffective.invulnerabilityWindows;
      const totalMarkedInvSteps = markedInv.reduce((acc, [s, e]) => acc + Math.max(0, e - s), 0);
      const totalArenaInvSteps = arenaInv.reduce((acc, [s, e]) => acc + Math.max(0, e - s), 0);

      // Deltas (Marcada - Arena)
      const diffStartupSteps = markedStartupSteps - arenaStartupSteps;
      const diffActiveSteps = totalMarkedActiveSteps - totalArenaActiveSteps;
      const diffRecoverySteps = markedVisualRecoverySteps - arenaVisualRecoverySteps;
      const diffInvSteps = totalMarkedInvSteps - totalArenaInvSteps;

      variantsData.push({
        variantIndex: i,
        clipIndex,
        clipName: clip.name,
        isPrimary: i === 0,
        isSelected: clipIndex === pickedIndex,
        clipDurationSeconds: +realClipDurSec.toFixed(4),
        timeScale: contract.timeScale,
        rawEventCount: rawEvents.length,
        contract,
        validation,
        phases: {
          marked: {
            startupSteps: markedStartupSteps,
            startupMs: +helpers.stepToMs(markedStartupSteps).toFixed(1),
            activeSteps: totalMarkedActiveSteps,
            activeMs: +helpers.stepToMs(totalMarkedActiveSteps).toFixed(1),
            recoverySteps: markedVisualRecoverySteps,
            recoveryMs: +helpers.stepToMs(markedVisualRecoverySteps).toFixed(1),
            invulnerabilitySteps: totalMarkedInvSteps,
            invulnerabilityMs: +helpers.stepToMs(totalMarkedInvSteps).toFixed(1),
            activeWindows: markedActive,
            invulnerabilityWindows: markedInv,
            recoveryMarker: contract.recoveryStart,
            impactHints: contract.impactHints
          },
          arena: {
            startupSteps: arenaStartupSteps,
            startupMs: +helpers.stepToMs(arenaStartupSteps).toFixed(1),
            activeSteps: totalArenaActiveSteps,
            activeMs: +helpers.stepToMs(totalArenaActiveSteps).toFixed(1),
            recoverySteps: arenaVisualRecoverySteps,
            recoveryMs: +helpers.stepToMs(arenaVisualRecoverySteps).toFixed(1),
            invulnerabilitySteps: totalArenaInvSteps,
            invulnerabilityMs: +helpers.stepToMs(totalArenaInvSteps).toFixed(1),
            activeWindows: arenaActive,
            invulnerabilityWindows: arenaInv,
            chainAfterStep: arenaEffective.chainAfterStep,
            chainAfterMs: arenaEffective.chainAfterMs
          },
          deltas: {
            startup: {steps: diffStartupSteps, ms: +helpers.stepToMs(diffStartupSteps).toFixed(1)},
            active: {steps: diffActiveSteps, ms: +helpers.stepToMs(diffActiveSteps).toFixed(1)},
            recovery: {steps: diffRecoverySteps, ms: +helpers.stepToMs(diffRecoverySteps).toFixed(1)},
            invulnerability: {steps: diffInvSteps, ms: +helpers.stepToMs(diffInvSteps).toFixed(1)}
          }
        }
      });
    }

    actionsReport.push({
      actionId,
      hasAnimation: true,
      variantCount: variantIndices.length,
      selectionContext,
      pickedVariantClip: character.clips?.[pickedIndex]?.name || null,
      arenaReference: arenaEffective,
      variants: variantsData
    });
  }

  return {
    characterId,
    timestamp: new Date().toISOString(),
    stepSeconds: stepSec,
    fps: helpers.fps,
    stepMs: +(stepSec * 1000).toFixed(3),
    intervalSemantics: '[startStep, endStep)',
    actions: actionsReport
  };
}

/**
 * Formata o relatório analítico em texto Markdown legível.
 * @param {Object} report
 * @returns {string} Texto formatado
 */
export function formatCombatWindowsReportText(report) {
  const lines = [];
  lines.push(`# Relatório de Janelas de Combate da Animação`);
  lines.push(`- **Personagem:** ${report.characterId}`);
  lines.push(`- **Frequência de Simulação:** ${report.fps} Hz (1 passo = ${report.stepMs} ms, step = ${report.stepSeconds.toFixed(6)} s)`);
  lines.push(`- **Semântica dos Intervalos:** Estritamente semiabertos ${report.intervalSemantics}`);
  lines.push(`- **Data da Amostragem:** ${report.timestamp}`);
  lines.push('');

  for (const act of report.actions) {
    lines.push(`## Ação: ${act.actionId.toUpperCase()}`);
    if (!act.hasAnimation) {
      lines.push(`> ⚠️ ${act.note}`);
      lines.push('');
      continue;
    }

    lines.push(`- Variantes configuradas: ${act.variantCount}`);
    lines.push(`- Seleção de variante: **${act.selectionContext.description}** → clipe “${act.pickedVariantClip}”`);
    lines.push(`- Comportamento de referência da Arena: ${act.arenaReference.note}`);
    lines.push('');

    for (const v of act.variants) {
      const tag = v.isSelected ? `★ [SELECIONADA: ${act.selectionContext.type.toUpperCase()}]` : (v.isPrimary ? '• [PRIMÁRIA]' : '•');
      lines.push(`### ${tag} Variante #${v.variantIndex + 1}: “${v.clipName}”`);
      lines.push(`- Duração real da animação no GLB: **${v.clipDurationSeconds.toFixed(3)} s** | Escala temporal: ×${v.timeScale.toFixed(3)} | Eventos brutos no GLB: ${v.rawEventCount}`);

      const p = v.phases;
      lines.push('');
      lines.push(`| Fase do Golpe | Janela Marcada | Arena Atual (Efetiva) | Diferença (Marcada - Arena) |`);
      lines.push(`| :--- | :--- | :--- | :--- |`);
      lines.push(`| **Preparação (Startup)** | ${p.marked.startupSteps} passos (${p.marked.startupMs} ms) | ${p.arena.startupSteps} passos (${p.arena.startupMs} ms) | **${p.deltas.startup.steps >= 0 ? '+' : ''}${p.deltas.startup.steps} passos** (${p.deltas.startup.ms >= 0 ? '+' : ''}${p.deltas.startup.ms} ms) |`);
      lines.push(`| **Ativo (Hitbox)** | ${p.marked.activeSteps} passos (${p.marked.activeMs} ms) | ${p.arena.activeSteps} passos (${p.arena.activeMs} ms) | **${p.deltas.active.steps >= 0 ? '+' : ''}${p.deltas.active.steps} passos** (${p.deltas.active.ms >= 0 ? '+' : ''}${p.deltas.active.ms} ms) |`);
      lines.push(`| **Recuperação Pós-Ativo** | ${p.marked.recoverySteps} passos (${p.marked.recoveryMs} ms) | ${p.arena.recoverySteps} passos (${p.arena.recoveryMs} ms) | **${p.deltas.recovery.steps >= 0 ? '+' : ''}${p.deltas.recovery.steps} passos** (${p.deltas.recovery.ms >= 0 ? '+' : ''}${p.deltas.recovery.ms} ms) |`);
      lines.push(`| **Invulnerabilidade** | ${p.marked.invulnerabilitySteps} passos (${p.marked.invulnerabilityMs} ms) | ${p.arena.invulnerabilitySteps} passos (${p.arena.invulnerabilityMs} ms) | **${p.deltas.invulnerability.steps >= 0 ? '+' : ''}${p.deltas.invulnerability.steps} passos** (${p.deltas.invulnerability.ms >= 0 ? '+' : ''}${p.deltas.invulnerability.ms} ms) |`);
      lines.push('');

      // Detalhamento dos intervalos semiabertos
      if (p.marked.activeWindows.length > 0) {
        lines.push(`- **Intervalos Ativos Marcados:** ${p.marked.activeWindows.map(([s, e]) => `[${s}, ${e}) (${(s * report.stepMs).toFixed(1)}..${(e * report.stepMs).toFixed(1)} ms, ${e - s} passos)`).join(', ')}`);
      } else {
        lines.push(`- **Intervalos Ativos Marcados:** Nenhum (ação defensiva ou sem hitbox)`);
      }

      if (p.marked.invulnerabilityWindows.length > 0) {
        lines.push(`- **Invulnerabilidade Marcada:** ${p.marked.invulnerabilityWindows.map(([s, e]) => `[${s}, ${e}) (${(s * report.stepMs).toFixed(1)}..${(e * report.stepMs).toFixed(1)} ms, ${e - s} passos)`).join(', ')}`);
      }

      if (p.arena.chainAfterStep != null) {
        lines.push(`- **Encadeamento / Cancelamento Arena (chainAfter):** permitido a partir do passo ${p.arena.chainAfterStep} (${p.arena.chainAfterMs.toFixed(1)} ms)`);
      }

      if (p.marked.recoveryMarker != null) {
        lines.push(`- **Marcador Visual de Recuperação (recovery_start):** passo ${p.marked.recoveryMarker} (${(p.marked.recoveryMarker * report.stepMs).toFixed(1)} ms)`);
      }

      if (p.marked.impactHints.length > 0) {
        lines.push(`- **Pistas de Impacto (impact hints):** ${p.marked.impactHints.map(h => `passo ${h.step} (${h.timeMs} ms)`).join(', ')}`);
      }

      // Validação
      if (v.validation.errors.length > 0) {
        lines.push('');
        lines.push(`> ❌ **Erros de Validação:**`);
        for (const err of v.validation.errors) {
          lines.push(`> - [${err.code}] ${err.message}`);
        }
      }

      if (v.validation.warnings.length > 0) {
        lines.push('');
        lines.push(`> ⚠️ **Avisos de Diagnóstico:**`);
        for (const w of v.validation.warnings) {
          lines.push(`> - [${w.code}] ${w.message}`);
        }
      }

      lines.push('');
    }
  }

  return lines.join('\n');
}
