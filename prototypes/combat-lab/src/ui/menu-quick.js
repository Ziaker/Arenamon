// Seleção Rápida do menu pré-jogo: DOIS BLOCOS (azul e vermelho), cada um com seleção de PERSONAGEM
// (modelos salvos no workspace, aplicados na hora), PRÉVIA 3D do modelo, MOVES (4 slots, registro de moves)
// e ABILITIES/PASSIVAS (catálogo experimental, regras R1–R6: máximo 2, sem duplicata, exclusivas só da
// espécie). As escolhas são aplicadas no jogo ao iniciar (applyAll) e persistem no workspace (collect/apply).
import {listMoves} from '../sim/moves.js';
import {PASSIVE_SLOTS, exclusivePassives, genericPassives, speciesFromName, validateLoadout} from '../sim/passives.js';
import {createMenuPreview} from './menu-preview.js';

const escape = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const SLOTS = [0, 1];

export function createQuickMenu({$, game, ui, passivesPanel}) {
  // ---------- Estado das escolhas ----------
  const defaults = () => {
    const ids = listMoves().map(m => m.id), out = [null, null, null, null];
    out[0] = ids.includes('reflect') ? 'reflect' : ids[0] ?? null;
    out[1] = ids.includes('psyshock') ? 'psyshock' : ids.find(i => i !== out[0]) ?? null;
    return out;
  };
  const state = {
    char: [null, null],                                  // modelId salvo para reaplicar ao reabrir (null = manter o carregado)
    moves: [defaults(), defaults()],
    passives: [[null, null], [null, null]],
  };
  // Sincroniza com o que já está equipado (ex.: restaurado de gravação/painel) quando não é tudo vazio.
  for (const s of SLOTS) {
    const cur = game.loadouts?.[s] ?? [];
    if (cur.some(Boolean)) state.moves[s] = [0, 1, 2, 3].map(i => cur[i] ?? null);
    const pl = passivesPanel.state.loadouts?.[s];
    if (pl?.length) state.passives[s] = [0, 1].map(i => pl[i] ?? null);
  }

  let store = null, wsUI = null;
  const pendingChar = [undefined, undefined];
  const previews = [createMenuPreview($('quick-preview-0')), createMenuPreview($('quick-preview-1'), {tint: '#ff5a4a'})];

  // ---------- Personagem (modelo) ----------
  function updateCharLabel(slot) {
    const el = $(`quick-char-name-${slot}`);
    if (el) el.textContent = ui.sources[slot]?.name ?? 'Sem modelo carregado';
  }
  function updatePreview(slot) {
    previews[slot].setCharacter(ui.characters[slot]);
    updateCharLabel(slot);
  }
  async function selectChar(slot, modelId) {
    state.char[slot] = modelId;
    if (!modelId) return;   // “manter o carregado”
    if (ui.sources[slot]?.assetId !== modelId) {
      const sel = $(`quick-char-${slot}`);
      if (sel) sel.disabled = true;
      try {if (wsUI) await wsUI.reopen(slot, {modelId});} finally {if (sel) sel.disabled = false;}
    }
    renderPassives(slot);   // a espécie pode mudar com o modelo
    updatePreview(slot);
  }
  /** Repõe a lista de personagens salvos; reaplica a escolha pendente (vinda da persistência). */
  async function refreshModels() {
    if (!store) return;
    let models = [];
    try {models = (await store.listAssets()).filter(a => a.kind === 'model').sort((a, b) => (b.lastUsedAt ?? b.addedAt ?? 0) - (a.lastUsedAt ?? a.addedAt ?? 0));} catch {models = [];}
    for (const slot of SLOTS) {
      const sel = $(`quick-char-${slot}`);
      if (!sel) continue;
      const prev = pendingChar[slot] !== undefined ? pendingChar[slot] : sel.value;
      sel.replaceChildren(
        new Option(`Manter o carregado${ui.sources[slot]?.name ? ` (${ui.sources[slot].name})` : ''}`, ''),
        ...models.map(a => new Option(a.name, a.id)));
      const wanted = prev && [...sel.options].some(o => o.value === prev) ? prev : '';
      pendingChar[slot] = undefined;
      sel.value = wanted;
      if (wanted) await selectChar(slot, wanted);
      else {renderPassives(slot);updatePreview(slot);}
    }
  }

  // ---------- Moves (4 slots por lutador) ----------
  function renderMoves(slot) {
    const box = $(`quick-moves-${slot}`);
    if (!box) return;
    const moves = listMoves(), cur = state.moves[slot];
    box.replaceChildren(...cur.map((mid, i) => {
      const sel = document.createElement('select');
      sel.setAttribute('aria-label', `Move do slot ${i + 1}`);
      sel.append(new Option('— vazio —', ''), ...moves.map(m => new Option(m.name ?? m.id, m.id)));
      sel.value = mid && moves.some(m => m.id === mid) ? mid : '';
      sel.onchange = () => {
        const arr = [...state.moves[slot]];
        arr[i] = sel.value || null;
        if (arr[i]) for (let k = 0; k < arr.length; k++) if (k !== i && arr[k] === arr[i]) arr[k] = null;   // um move não ocupa dois slots
        state.moves[slot] = arr;
        game.setLoadout(slot, arr);
        renderMoves(slot);
      };
      return sel;
    }));
  }

  // ---------- Abilities / passivas (2 por lutador) ----------
  function renderPassives(slot) {
    const box = $(`quick-passives-${slot}`);
    if (!box) return;
    const species = speciesFromName(ui.sources[slot]?.name ?? null);
    const opts = [...exclusivePassives(species), ...genericPassives()];
    const chosen = state.passives[slot];
    box.replaceChildren(...Array.from({length: PASSIVE_SLOTS}, (_, i) => {
      const sel = document.createElement('select');
      sel.setAttribute('aria-label', `Passiva ${i + 1}`);
      sel.append(new Option('— nenhuma —', ''), ...opts.map(p => new Option(p.nome + (p.species ? ` (${p.species})` : ''), p.id)));
      const val = chosen[i] && opts.some(p => p.id === chosen[i]) ? chosen[i] : '';
      if (chosen[i] && !val) chosen[i] = null;   // exclusiva que não pertence mais à espécie
      sel.value = val;
      sel.onchange = () => {
        const arr = [...state.passives[slot]];
        arr[i] = sel.value || null;
        const seen = new Set(), compact = [];
        for (const x of arr) {if (!x || seen.has(x)) continue;seen.add(x);compact.push(x);}   // a escolha anterior perde (sem duplicata)
        while (compact.length < PASSIVE_SLOTS) compact.push(null);
        state.passives[slot] = compact.slice(0, PASSIVE_SLOTS);
        renderPassives(slot);
      };
      return sel;
    }));
    const errors = validateLoadout(state.passives[slot].filter(Boolean), species);
    const st = $(`quick-passive-status-${slot}`);
    if (st) {st.className = 'qf-passive-status ' + (errors.length ? 'warn' : 'ok');st.textContent = errors.length ? errors.join(' · ') : '✓ loadout válido';}
  }

  // ---------- Ligação dos seletores de personagem ----------
  for (const slot of SLOTS) {
    const sel = $(`quick-char-${slot}`);
    if (sel) sel.onchange = () => selectChar(slot, sel.value || null);
  }

  // ---------- Laço da prévia (só desenha com o menu visível) ----------
  let lastT = performance.now();
  (function loop(now) {
    const dt = Math.min(.05, Math.max(0, (now - lastT) / 1000));
    lastT = now;
    const menu = $('menu');
    if (menu && !menu.hidden) for (const p of previews) p.tick(dt);
    requestAnimationFrame(loop);
  })(performance.now());

  // ---------- Inicialização dos controles ----------
  for (const slot of SLOTS) {renderMoves(slot);renderPassives(slot);updatePreview(slot);}

  // ---------- API ----------
  return {
    /** Chamar quando o workspace terminar de inicializar (store/wsUI disponíveis). */
    attachWorkspace(boot) {store = boot?.store ?? null;wsUI = boot?.wsUI ?? null;return refreshModels();},
    /** Modelos/personagens mudaram (carregado, removido, importado): repõe lista e prévias. */
    refresh() {renderPassives(0);renderPassives(1);updatePreview(0);updatePreview(1);return refreshModels();},
    /** Aplica tudo no jogo (chamar antes de startMatch): moves dos dois lutadores + passivas no painel. */
    applyAll() {
      for (const slot of SLOTS) game.setLoadout(slot, state.moves[slot]);
      for (const slot of SLOTS) passivesPanel.state.loadouts[slot] = state.passives[slot].filter(Boolean);
      passivesPanel.render();   // recalcula identidade pelos nomes, valida (R5) e persiste em localStorage
    },
    collect() {return {char: [...state.char], moves: state.moves.map(a => [...a]), passives: state.passives.map(a => [...a])};},
    apply(saved) {
      if (!saved) return;
      for (const slot of SLOTS) {
        if (Array.isArray(saved.moves?.[slot])) {
          const arr = saved.moves[slot].slice(0, 4);
          while (arr.length < 4) arr.push(null);
          state.moves[slot] = arr;
          game.setLoadout(slot, arr);
          renderMoves(slot);
        }
        if (Array.isArray(saved.passives?.[slot])) {
          const arr = saved.passives[slot].filter(Boolean).slice(0, PASSIVE_SLOTS);
          while (arr.length < PASSIVE_SLOTS) arr.push(null);
          state.passives[slot] = arr;
          renderPassives(slot);
        }
        if (typeof saved.char?.[slot] === 'string' && saved.char[slot]) pendingChar[slot] = saved.char[slot];
      }
    },
    get state() {return state;},
  };
}
