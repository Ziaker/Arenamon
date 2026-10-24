// @ts-check
// Dividido de main.js (comportamento idêntico): wire-startup.

import {UI_AI_MODES} from '../sim/ai.js';
import {renderScenarios} from './scenario-flow.js';
import {applyConfig, syncTuneState} from './tuning-sync.js';
import {foldStaticSections, openTool, syncButtons} from './live-panels.js';
import {frame} from './main-loop.js';
import {$, cinePanel, closeTools, game, renderCharacters, tuning} from '../main.js';

export function wireExtras() {
$('cinematic-camera-btn')?.addEventListener('click', () => cinePanel?.toggle());
$('tools-cine-btn')?.addEventListener('click', () => {closeTools(); cinePanel?.toggle(true);});
$('enemy-ai-control').append(tuning.controlFor('extras.toggles.enableEnemyAI'), tuning.controlFor('extras.toggles.enemyManual'));
$('bindings-controls').append(...tuning.sectionControls('Teclas: índices configuráveis'));
$('bindings2-controls').append(...tuning.sectionControls('Teclas do vermelho (controle manual)'));
foldStaticSections();
}

export function startApp() {
applyConfig();
renderScenarios();
renderCharacters();
syncTuneState();
openTool('match');
syncButtons();
// IA do Vermelho na Seleção Rápida: mesmo valor do seletor da Partida (applyConfig define o modo efetivo).
$('quick-mode').replaceChildren(...UI_AI_MODES.map(([id, label]) => new Option(label, id)));
$('quick-mode').value = game.mode;
requestAnimationFrame(frame);
}
