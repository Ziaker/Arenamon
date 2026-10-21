// HUD de progressão "Banco de Células" (escolhido em 21/10/2026 no laboratório prototypes/hud-consumiveis): cinco células verticais, uma
// por atributo evolutivo, com segmentos empilhados (cheios numerados, vazios hachurados), bônus acumulado, n/máx e "MAX". Lê
// fighter.stages (somente leitura). Só apresentação: nada aqui altera a simulação.
import {C} from '../sim/config.js';
import {symbolSvg} from '../view/symbols.js';
import {progressRows} from './progress-values.js';

const NAMES = ['JOGADOR', 'ADVERSÁRIO'];

export class ProgressHud {
  /** root: contêiner (#progress-hud) dentro do palco. Cada lutador exibido ganha um banco de células. */
  constructor(root) {
    this.root = root;
    this.banks = new Map();   // id do lutador → {el, cells, max, prev, key}
    this.subjectKey = '';
    this.scaleKey = '';
  }

  _build(id, max) {
    const el = document.createElement('div');
    el.className = 'pg-bank';el.dataset.fighter = String(id);
    const rows = progressRows(null, {stagesMax: max});
    el.innerHTML = `<div class="pg-owner">${NAMES[id] ?? 'LUTADOR'}</div><div class="pg-cells">` + rows.map(r => `
      <div class="pg-cell" data-attr="${r.key}" style="--c:${r.color}" title="${r.label}: ${r.per}">
        <div class="pg-icon">${symbolSvg(r.key, {size: 26, stroke: 2.2})}</div>
        <div class="pg-tube">${Array.from({length: max}, (_, i) => `<i class="pg-seg" data-n="${max - i}"></i>`).join('')}</div>
        <div class="pg-val">+0%</div>
        <div class="pg-name">${r.short}<small>0/${max}</small></div>
      </div>`).join('') + '</div>';
    const cells = Object.fromEntries([...el.querySelectorAll('.pg-cell')].map(c => [c.dataset.attr, c]));
    return {el, cells, max, prev: null, key: ''};
  }

  /** Chamado a cada quadro: só toca no DOM quando algo muda. */
  render(game) {
    const P = C.display.progress, root = this.root;
    const on = !!P.pgEnabled;
    root.hidden = !on;
    root.closest('.stage')?.toggleAttribute('data-progress-hud', on);
    if (!on) return;
    const subject = P.pgSubject | 0, ids = subject === 2 ? [0, 1] : [subject === 1 ? 1 : 0];
    const max = Math.max(1, C.map?.stagesMax ?? 4), subKey = ids.join() + '/' + max + '/' + (subject === 2);
    if (subKey !== this.subjectKey) {
      this.subjectKey = subKey;this.banks.clear();root.replaceChildren();
      for (const id of ids) {const b = this._build(id, max);this.banks.set(id, b);root.append(b.el);}
      root.dataset.multi = String(ids.length > 1);
    }
    const stageH = root.parentElement?.clientHeight ?? 720, scale = +(P.pgScale * (C.extras.hud.uiScale || 1) * (stageH >= 900 ? 1.15 : 1)).toFixed(3);
    if (String(scale) !== this.scaleKey) {this.scaleKey = String(scale);root.style.setProperty('--pg-scale', scale);}
    for (const [id, b] of this.banks) {
      const f = game.fighters?.[id];
      if (!f) continue;
      const rows = progressRows(f, C.map), key = rows.map(r => r.stage).join(',') + '|' + rows[0].text + rows[1].text + rows[2].text + rows[3].text + rows[4].text;
      if (key === b.key) continue;
      b.key = key;
      rows.forEach((r, i) => {
        const cell = b.cells[r.key], gained = b.prev && r.stage > b.prev[i];
        cell.dataset.stage = String(r.stage);
        cell.classList.toggle('max', r.isMax);cell.classList.toggle('zero', r.stage === 0);
        cell.querySelectorAll('.pg-seg').forEach(seg => seg.classList.toggle('on', +seg.dataset.n <= r.stage));
        cell.querySelector('.pg-val').textContent = r.text;
        cell.querySelector('small').textContent = r.isMax ? 'MAX' : `${r.stage}/${r.max}`;
        if (gained && P.pgAnimate) {
          const restart = (el, cls) => {el.classList.remove(cls);void el.offsetWidth;el.classList.add(cls);};
          restart(cell, 'gain');
          const seg = cell.querySelector(`.pg-seg[data-n="${r.stage}"]`);if (seg) restart(seg, 'new');
        }
      });
      b.prev = rows.map(r => r.stage);
    }
  }
}
