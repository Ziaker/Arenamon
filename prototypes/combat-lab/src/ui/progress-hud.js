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

  _build(id, max, layout) {
    const el = document.createElement('div');
    el.className = 'pg-bank';el.dataset.fighter = String(id);
    const rows = progressRows(null, {stagesMax: max});
    const segs = Array.from({length: max}, (_, i) => `<i class="pg-seg" data-n="${max - i}"></i>`).join('');
    const cell = layout === 'h'
      // horizontal compacto: ícone + bônus em cima; segmentos + n/máx embaixo
      ? r => `<div class="pg-cell" data-attr="${r.key}" style="--c:${r.color}" title="${r.label}: ${r.per}">
          <div class="pg-top"><span class="pg-icon">${symbolSvg(r.key, {size: 15, stroke: 2.4})}</span><span class="pg-val">+0%</span></div>
          <div class="pg-row"><span class="pg-tube">${[...Array(max).keys()].map(i => `<i class="pg-seg" data-n="${i + 1}"></i>`).join('')}</span><span class="pg-name"><small>0/${max}</small></span></div>
        </div>`
      : r => `<div class="pg-cell" data-attr="${r.key}" style="--c:${r.color}" title="${r.label}: ${r.per}">
          <div class="pg-icon">${symbolSvg(r.key, {size: 26, stroke: 2.2})}</div>
          <div class="pg-tube">${segs}</div>
          <div class="pg-val">+0%</div>
          <div class="pg-name">${r.short}<small>0/${max}</small></div>
        </div>`;
    el.innerHTML = `<div class="pg-owner">${NAMES[id] ?? 'LUTADOR'}</div><div class="pg-cells">` + rows.map(cell).join('') + '</div>';
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
    const subject = P.pgSubject | 0, ids = subject === 2 ? [0, 1] : [subject === 1 ? 1 : 0], layout = P.pgLayout ? 'h' : 'v';
    const max = Math.max(1, C.map?.stagesMax ?? 4), subKey = ids.join() + '/' + max + '/' + layout;
    if (subKey !== this.subjectKey) {
      this.subjectKey = subKey;this.scaleKey = '';this.banks.clear();root.replaceChildren();
      for (const id of ids) {const b = this._build(id, max, layout);this.banks.set(id, b);root.append(b.el);}
      root.dataset.multi = String(ids.length > 1);root.dataset.layout = layout;
    }
    // tamanho independente do jogador (pgScale) e do adversário (pgScaleEnemy), somado à escala geral do HUD
    const ui = C.extras.hud.uiScale || 1, sk = [P.pgScale, P.pgScaleEnemy, ui].join('/');
    if (sk !== this.scaleKey) {
      this.scaleKey = sk;
      for (const [id, b] of this.banks) b.el.style.setProperty('--pg-scale', +((id === 1 ? P.pgScaleEnemy : P.pgScale) * ui).toFixed(3));
    }
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
