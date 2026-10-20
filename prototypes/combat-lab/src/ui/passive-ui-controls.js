// Controles de UI para ativação de habilidades passivas (Propostas A, B, C).
// Este módulo liga os botões do template.html aos métodos de spawn de passivas.

import {spawnPassiveA, spawnPassiveB, spawnPassiveC, deactivatePassive, getPassiveStats} from '../view/passive-view-extension.js';
import {passiveToast} from './passive-toast.js';
import {C} from '../sim/config.js';

const $ = id => document.getElementById(id);

/**
 * Inicializa todos os controles de passivas na UI.
 * Chamar uma vez após o DOM estar pronto.
 */
export function initPassiveControls(view, game) {
  let activeIds = {A: [], B: [], C: []};

  // ─── Botões de ativação ───
  $('passive-activate-a')?.addEventListener('click', () => {
    const targetEnemy = $('passive-target-enemy')?.checked;
    const fighterId = targetEnemy ? 1 : 0;
    const fighter = game.fighters[fighterId];
    if (!fighter) return;
    const pos = fighter.position;
    const opts = buildOpts('A');
    const id = spawnPassiveA(view, fighterId, pos, opts);
    activeIds.A.push(id);
  });

  $('passive-activate-b')?.addEventListener('click', () => {
    const targetEnemy = $('passive-target-enemy')?.checked;
    const fighterId = targetEnemy ? 1 : 0;
    const fighter = game.fighters[fighterId];
    if (!fighter) return;
    const pos = fighter.position;
    const opts = buildOpts('B');
    const id = spawnPassiveB(view, fighterId, pos, opts);
    activeIds.B.push(id);
  });

  $('passive-activate-c')?.addEventListener('click', () => {
    const targetEnemy = $('passive-target-enemy')?.checked;
    const fighterId = targetEnemy ? 1 : 0;
    const fighter = game.fighters[fighterId];
    if (!fighter) return;
    const pos = fighter.position;
    const opts = buildOpts('C');
    const id = spawnPassiveC(view, fighterId, pos, opts);
    activeIds.C.push(id);
  });

  // ─── Todas simultâneas ───
  $('passive-all-simultaneous')?.addEventListener('change', (e) => {
    if (e.target.checked) {
      // Ativa as 3 ao mesmo tempo no jogador
      const fighter = game.fighters[0];
      if (!fighter) return;
      const pos = fighter.position;
      setTimeout(() => spawnPassiveA(view, 0, pos, buildOpts('A')), 0);
      setTimeout(() => spawnPassiveB(view, 0, pos, buildOpts('B')), 80);
      setTimeout(() => spawnPassiveC(view, 0, pos, buildOpts('C')), 160);
    }
  });

  // ─── Comparação A→B→C ───
  $('passive-compare-abc')?.addEventListener('click', () => {
    const fighter = game.fighters[0];
    if (!fighter) return;
    const pos = fighter.position;
    // Desativa anteriores
    [...activeIds.A, ...activeIds.B, ...activeIds.C].forEach(id => deactivatePassive(view, id));
    activeIds = {A: [], B: [], C: []};
    // Sequência de comparação
    spawnPassiveA(view, 0, pos, {...buildOpts('A'), duration: 2.5});
    setTimeout(() => {
      spawnPassiveB(view, 0, pos, {...buildOpts('B'), duration: 2.5});
    }, 1200);
    setTimeout(() => {
      spawnPassiveC(view, 0, pos, {...buildOpts('C'), duration: 2.5});
    }, 2400);
  });

  // ─── Limpar todos ───
  $('passive-clear-all')?.addEventListener('click', () => {
    [...activeIds.A, ...activeIds.B, ...activeIds.C].forEach(id => deactivatePassive(view, id));
    activeIds = {A: [], B: [], C: []};
    passiveToast.dismissAll();
  });

  // ─── Sliders de tuning ───
  buildPassiveSliders();

  // ─── Atualização de stats ───
  setInterval(() => {
    const stats = getPassiveStats(view);
    const el = $('passive-stats');
    if (el) {
      el.innerHTML = `Partículas ativas: <b>${stats.active}</b> · Pico: <b>${stats.peak}</b> · Spawnadas: <b>${stats.spawned}</b> · Rejeitadas: <b>${stats.rejected}</b> · Efeitos passivos: <b>${stats.passives}</b>`;
    }
  }, 500);

  // Atalhos de teclado para passivas
  document.addEventListener('keydown', (e) => {
    if (e.target?.matches('input, textarea, select')) return;
    if (e.key === '1' && !e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault();
      $('passive-activate-a')?.click();
    }
    if (e.key === '2' && !e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault();
      $('passive-activate-b')?.click();
    }
    if (e.key === '3' && !e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault();
      $('passive-activate-c')?.click();
    }
    if (e.key === '0' && !e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault();
      $('passive-clear-all')?.click();
    }
  });
}

function buildOpts(type) {
  const cfg = C.vfx[`passive${type}`];
  if (!cfg) return {};
  return {
    color: cfg.color,
    color2: cfg.color2,
    opacity: cfg.opacity,
    duration: cfg.duration,
    quality: cfg.quality,
    ...(type === 'A' ? {
      radius: cfg.radius,
      particleCount: cfg.particleCount,
      orbitSpeed: cfg.orbitSpeed,
    } : type === 'B' ? {
      beamCount: cfg.beamCount,
      beamLength: cfg.beamLength,
      rotationSpeed: cfg.rotationSpeed,
    } : {
      waveCount: cfg.waveCount,
      waveRadius: cfg.waveRadius,
      pulseSpeed: cfg.pulseSpeed,
    }),
  };
}

function buildPassiveSliders() {
  const container = $('passive-sliders');
  if (!container) return;

  const sliders = [
    // Proposta A
    {key: 'passiveA.radius', label: 'A: Raio orbital', min: 0.5, max: 3, step: 0.1},
    {key: 'passiveA.particleCount', label: 'A: Partículas', min: 8, max: 64, step: 1},
    {key: 'passiveA.orbitSpeed', label: 'A: Vel. orbital', min: 0.5, max: 6, step: 0.5},
    {key: 'passiveA.opacity', label: 'A: Opacidade', min: 0.1, max: 1, step: 0.05},
    // Proposta B
    {key: 'passiveB.beamCount', label: 'B: Feixes', min: 2, max: 12, step: 1},
    {key: 'passiveB.beamLength', label: 'B: Comprimento', min: 1, max: 5, step: 0.5},
    {key: 'passiveB.rotationSpeed', label: 'B: Vel. rotação', min: 0.2, max: 4, step: 0.2},
    {key: 'passiveB.opacity', label: 'B: Opacidade', min: 0.1, max: 1, step: 0.05},
    // Proposta C
    {key: 'passiveC.waveCount', label: 'C: Ondas', min: 1, max: 8, step: 1},
    {key: 'passiveC.waveRadius', label: 'C: Raio ondas', min: 1, max: 5, step: 0.5},
    {key: 'passiveC.pulseSpeed', label: 'C: Vel. pulso', min: 0.5, max: 5, step: 0.5},
    {key: 'passiveC.opacity', label: 'C: Opacidade', min: 0.1, max: 1, step: 0.05},
  ];

  for (const s of sliders) {
    const div = document.createElement('div');
    div.className = 'field';
    const parts = s.key.split('.');
    const val = parts.reduce((o, k) => o?.[k], C);
    div.innerHTML = `
      <label>${s.label} <output>${typeof val === 'number' ? val.toFixed(2) : val}</output></label>
      <input type="range" min="${s.min}" max="${s.max}" step="${s.step}" value="${val ?? s.min}">
    `;
    const input = div.querySelector('input');
    const output = div.querySelector('output');
    input.addEventListener('input', () => {
      let obj = C;
      for (let i = 0; i < parts.length - 1; i++) obj = obj[parts[i]];
      obj[parts[parts.length - 1]] = parseFloat(input.value);
      output.textContent = input.value;
    });
    container.appendChild(div);
  }
}
