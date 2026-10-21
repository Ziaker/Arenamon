import {C} from '../sim/config.js';

export function createPassiveBanners() {
  const bars = [document.getElementById('ability-banner-0'), document.getElementById('ability-banner-1')], timers = [0, 0];
  function applyConfig() {
    const P = C.display.passive, root = document.querySelector('.stage');if (!root) return;
    root.dataset.abilityBorder = ['sweep', 'pulse', 'chase'][P.borderMotion | 0] ?? 'sweep';root.style.setProperty('--ability-text-scale', String(P.textScale));
    for (const bar of bars) bar.hidden = !P.enabled;
  }
  function show(id, name) {
    const bar = bars[id];if (!bar || !C.display.passive.enabled) return;
    clearTimeout(timers[id]);bar.querySelector('strong').textContent = name;bar.hidden = false;bar.classList.remove('show');void bar.offsetWidth;bar.classList.add('show');
    timers[id] = setTimeout(() => {bar.classList.remove('show');bar.hidden = true;}, 2300);
  }
  function clear() {for (let i = 0; i < bars.length; i++) {clearTimeout(timers[i]);bars[i]?.classList.remove('show');if (bars[i]) bars[i].hidden = true;}}
  applyConfig();return {show, clear, applyConfig};
}
