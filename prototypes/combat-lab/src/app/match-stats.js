// @ts-check
// Dividido de main.js (comportamento idêntico): match-stats.

import {C} from '../sim/config.js';
import {PASSIVE_BY_ID} from '../sim/passives.js';
import {soundFx} from '../view/audio.js';
import {$, clock, diagnostics, game, view} from '../main.js';

/** Ativações reais do passo: som, placa metálica "Ability: NOME" e sparkles brancos presos ao lutador. */
export function passiveFeedback(events) {
  for (const e of events || []) {
    if (e.result !== 'passiveActivated' || e.attacker == null) continue;
    soundFx.playPassive(C.vfx?.passive?.variant ?? 0);
    const kind = e.attacker === 1 ? C.display.passive.enemyAbility : C.display.passive.playerAbility;
    view.passives.activate(e.attacker, kind, PASSIVE_BY_ID[e.passive]?.nome ?? e.passive);
  }
}

/** Avisos discretos dos Moves (M28.6): falha de execução com o motivo e a devolução da stamina. */
export const seenNotices = new WeakSet(), MOVE_FAIL = {semEspaco: 'sem espaço — stamina devolvida, sem recarga', limiteDeEntidades: 'limite de entidades do mundo — stamina devolvida', semCarga: 'sem carga', effectMissing: 'efeito não registrado'};

export function moveNotices() {
  for (const e of game.events) {
    if (seenNotices.has(e) || e.result !== 'moveFailed') continue;seenNotices.add(e);
    diagnostics.toast({text: `${e.move === 'psyshock' ? 'Psyshock' : e.move === 'reflect' ? 'Reflect' : e.move}: ${MOVE_FAIL[e.reason] ?? e.reason}`, fighter: e.attacker === 1 ? 1 : 0, kind: 'deny'});
  }
}

// ---------- Efeitos sonoros, telemetria e QoL da Arena ----------
export function handleSoundEvents(events) {
  for (const ev of events) {
    if (ev.result === 'impact') {
      if ((ev.damage ?? 0) >= 15) soundFx.playHeavyHit();
      else soundFx.playHit();
    } else if (ev.result === 'footstool') {
      soundFx.playHit();
    } else if (ev.result === 'partial') {
      soundFx.playBlock();
    } else if (ev.result === 'perfect') {
      soundFx.playParry();
    } else if (ev.result === 'clash' || ev.result === 'tackleClash' || ev.result === 'stoneClash') {
      soundFx.playClash();
    } else if (ev.result === 'dodge' || ev.result === 'perfectDodge') {
      soundFx.playDodge();
    } else if (ev.result === 'barrierBroken') {
      soundFx.playBarrierBreak();
    } else if (ev.result === 'chargeRelease') {
      soundFx.playChargeRelease(ev.level ?? 1);
    }
  }
}

export const lastChargePl = [0, 0];

export function trackChargeSounds() {
  for (const f of game.fighters) {
    if (f.charge) {
      const pl = f.charge.pl ?? (f.charge.ticks >= (f.charge.params?.maxTicks ?? 180) ? 3 : f.charge.ticks >= (f.charge.params?.pl2Ticks ?? 90) ? 2 : 1);
      if (pl > lastChargePl[f.id]) soundFx.playChargeLevel(pl);
      lastChargePl[f.id] = pl;
    } else {
      lastChargePl[f.id] = 0;
    }
  }
}

export const lastExhausted = [false, false];

export function trackExhaustionSounds() {
  for (const f of game.fighters) {
    const isEx = f.stamina <= 0 || f.state === 'exhausted';
    if (isEx && !lastExhausted[f.id]) {
      if (f.id === 0) soundFx.playExhaustion();
    }
    lastExhausted[f.id] = isEx;
  }
}

export const matchStats = {damageDealt: [0, 0], hitsLanded: [0, 0], parries: [0, 0], blocks: [0, 0], movesUsed: [0, 0], startTick: 0};

export let lastKoHandled = false;

export function resetMatchStats() {
  matchStats.damageDealt = [0, 0];
  matchStats.hitsLanded = [0, 0];
  matchStats.parries = [0, 0];
  matchStats.blocks = [0, 0];
  matchStats.movesUsed = [0, 0];
  matchStats.startTick = game.tick;
  lastKoHandled = false;
  lastChargePl[0] = lastChargePl[1] = 0;
  lastExhausted[0] = lastExhausted[1] = false;
  const overlayStats = $('match-summary-stats');
  if (overlayStats) overlayStats.innerHTML = '';
}

export function trackMatchEvents(events) {
  for (const ev of events) {
    const atk = ev.attacker, tgt = ev.target;
    if (ev.result === 'impact') {
      if (atk === 0 || atk === 1) {matchStats.damageDealt[atk] += ev.damage ?? 0; matchStats.hitsLanded[atk]++;}
    } else if (ev.result === 'footstool') {
      if (atk === 0 || atk === 1) {matchStats.damageDealt[atk] += ev.damage ?? 0; matchStats.hitsLanded[atk]++;}
    } else if (ev.result === 'partial') {
      if (tgt === 0 || tgt === 1) matchStats.blocks[tgt]++;
      if (atk === 0 || atk === 1) matchStats.damageDealt[atk] += ev.damage ?? 0;
    } else if (ev.result === 'perfect') {
      if (tgt === 0 || tgt === 1) matchStats.parries[tgt]++;
    } else if (ev.result === 'chargeRelease' || ev.result === 'spawn') {
      if (atk === 0 || atk === 1) matchStats.movesUsed[atk]++;
    }
  }
}

export function checkKoTrigger() {
  if (lastKoHandled) return;
  const hasKo = game.fighters.some(f => f.hp <= 0 && f.state === 'ko') || game.phase === 'finishing' || game.phase === 'result';
  if (hasKo) {
    lastKoHandled = true;
    soundFx.playKo();
    const banner = $('ko-banner');
    if (banner) {
      banner.hidden = false;
      banner.classList.add('animate-ko');
      setTimeout(() => {banner.hidden = true; banner.classList.remove('animate-ko');}, 2200);
    }
    const origScale = clock.timeScale;
    clock.timeScale = 0.25;
    setTimeout(() => {clock.timeScale = origScale;}, 600);
    renderMatchSummary();
  }
}

export function renderMatchSummary() {
  const container = $('match-summary-stats');
  if (!container) return;
  const durationSec = Math.max(0, (game.tick - matchStats.startTick) * C.test.step).toFixed(1);
  container.innerHTML = `
    <table class="summary-table">
      <thead>
        <tr><th>Estatística</th><th>Azul (Jogador)</th><th>Vermelho (Rival)</th></tr>
      </thead>
      <tbody>
        <tr><td>Dano Total</td><td><b>${matchStats.damageDealt[0].toFixed(0)}</b> HP</td><td><b>${matchStats.damageDealt[1].toFixed(0)}</b> HP</td></tr>
        <tr><td>Golpes Conectados</td><td>${matchStats.hitsLanded[0]}</td><td>${matchStats.hitsLanded[1]}</td></tr>
        <tr><td>Defesas / Parries</td><td>${matchStats.blocks[0]} / ${matchStats.parries[0]}</td><td>${matchStats.blocks[1]} / ${matchStats.parries[1]}</td></tr>
        <tr><td>Movimentos Usados</td><td>${matchStats.movesUsed[0]}</td><td>${matchStats.movesUsed[1]}</td></tr>
        <tr><td>Duração da Luta</td><td colspan="2" style="text-align:center">${durationSec} s</td></tr>
      </tbody>
    </table>
  `;
}

export function updateAudioBtn() {
  const b = $('audio-toggle');
  if (!b) return;
  b.textContent = soundFx.enabled ? '🔊 Som' : '🔇 Mudo';
  b.setAttribute('aria-checked', String(soundFx.enabled));
  b.classList.toggle('active', soundFx.enabled);
}
