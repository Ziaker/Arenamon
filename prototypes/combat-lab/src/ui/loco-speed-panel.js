// Bloco «Velocidade da locomoção» do painel do personagem (view/loco-speed.js): de onde vêm as velocidades de andar e correr.
import {C} from '../sim/config.js';
import {locoSettingOf, stateClipSpeed} from '../view/loco-speed.js';

const f2 = n => (Math.round(n * 100) / 100).toFixed(2);

/** @param {number} id @param {any} ch personagem @param {() => void} onChange sincroniza com a simulação */
export function locoSpeedBox(id, ch, onChange) {
  const s = locoSettingOf(ch), box = document.createElement('div');box.className = 'loco-speed';
  const gameWalk = C.profiles?.balanced?.speed ?? C.test.speed, gameSprint = gameWalk * (C.locomotion?.sprint?.speedMultiplier ?? 1.55);
  const animWalk = stateClipSpeed(ch, 'walk'), animSprint = stateClipSpeed(ch, 'sprint');
  box.innerHTML = `<b>Velocidade da locomoção</b> <small>(andar e correr do ${id ? 'vermelho' : 'azul'})</small>
    <label class="field">De onde vem
      <select data-loco-mode>
        <option value="jogo">Do jogo (atributo: andar ${f2(gameWalk)} m/s · sprint ${f2(gameSprint)} m/s)</option>
        <option value="animacao">Da animação (o clipe: andar ${f2(animWalk)} m/s · sprint ${f2(animSprint)} m/s)</option>
        <option value="manual">Manual</option>
      </select></label>
    <div class="row" data-loco-manual>
      <label class="field">Andar <output data-loco-walk-out>${f2(s.walk)} m/s</output><input type="range" min="0.2" max="12" step="0.05" value="${s.walk}" data-loco-walk></label>
      <label class="field">Sprint <output data-loco-sprint-out>${f2(s.sprint)} m/s</output><input type="range" min="0.2" max="16" step="0.05" value="${s.sprint}" data-loco-sprint></label>
    </div>
    <p class="hint">«Da animação» usa quantos metros por segundo a walk e o sprint andam no próprio clipe: os pés não patinam, mas o personagem
    fica na velocidade que foi animado. Clipes no lugar (sem deslocamento gravado) não têm o que medir e seguem a regra do jogo.
    A passada também se ajusta ao corpo em até ±${C.display.animation.strideSyncLimit ?? 20}% (Visualizar › Animação: transições).</p>`;
  const sel = box.querySelector('[data-loco-mode]'), manual = box.querySelector('[data-loco-manual]');
  sel.value = s.mode;manual.hidden = s.mode !== 'manual';
  sel.onchange = () => {s.mode = sel.value;manual.hidden = s.mode !== 'manual';ch.save?.();onChange();};
  for (const k of ['walk', 'sprint']) {
    const r = box.querySelector(`[data-loco-${k}]`), out = box.querySelector(`[data-loco-${k}-out]`);
    r.oninput = () => {s[k] = Number(r.value);out.textContent = `${f2(s[k])} m/s`;};
    r.onchange = () => {ch.save?.();onChange();};
  }
  return box;
}
