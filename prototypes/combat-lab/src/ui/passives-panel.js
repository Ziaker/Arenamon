// Painel de seleção de passivas (aba Partida, antes da partida). Regras da UI (R1–R6):
// máximo de 2 equipadas, sem duplicata, exclusivas só da espécie do personagem, genéricas liberadas. A mesma
// validação roda no motor (passives.js validateLoadout + passive-engine setPassiveLoadout), então um loadout
// inválido nunca entra na simulação nem em save/replay/presets. Loadouts persistem em localStorage.
import {PASSIVES, PASSIVE_BY_ID, PASSIVE_SLOTS, genericPassives, exclusivePassives, speciesFromName, validateLoadout} from '../sim/passives.js';

const STORAGE_KEY = 'arenamon-passive-loadouts';
const escape = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

/** Estado global do painel: identidade de espécie por slot + loadouts escolhidos. */
export function loadPassivesState() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (Array.isArray(raw.loadouts) && raw.loadouts.length === 2) return {identity: raw.identity ?? [null, null], loadouts: raw.loadouts.map(l => Array.isArray(l) ? l.filter(Boolean).slice(0, PASSIVE_SLOTS) : [])};
  } catch {/* sem armazenamento ou dado inválido */}
  return {identity: [null, null], loadouts: [[], []]};
}
function savePassivesState(state) {try {localStorage.setItem(STORAGE_KEY, JSON.stringify(state));} catch {/* sem armazenamento */}}

/**
 * Cria o painel. `getCharacterNames` devolve [nomeAzul, nomeVermelho] (source.name dos modelos carregados;
 * a espécie NUNCA é inferida só pelo GLB — usa-se o nome declarado, R15).
 * @param {{getCharacterNames: () => (string | null)[], onChange?: () => void}} opts
 */
export function createPassivesPanel({getCharacterNames, onChange = null}) {
  const state = loadPassivesState();
  const root = document.createElement('div');
  root.className = 'passives-panel';
  root.id = 'passives-panel';
  const SLOT_LABELS = ['Azul', 'Vermelho'];

  /** Descrição e uso da passiva (gatilho + efeito) para dicas e linha de apoio. */
  const tipOf = p => `Gatilho: ${p.gatilho} Efeito: ${p.efeito}`;
  const optionsFor = species => {
    const opts = [...exclusivePassives(species), ...genericPassives()];
    return opts.map(p => `<option value="${p.id}" title="${escape(tipOf(p))}">${escape(p.nome)}${p.species ? ` <i>(${escape(p.species)})</i>` : ''}</option>`).join('');
  };
  const validate = (slot) => validateLoadout(state.loadouts[slot], state.identity[slot]);

  function render() {
    const names = getCharacterNames();
    for (let slot = 0; slot < 2; slot++) state.identity[slot] = speciesFromName(names[slot]);
    // personagem trocou: remove exclusivas que não pertencem mais à espécie (R4)
    for (let slot = 0; slot < 2; slot++) {
      state.loadouts[slot] = state.loadouts[slot].filter(id => {const def = PASSIVE_BY_ID[id];return def && (!def.species || def.species === state.identity[slot]);});
    }
    savePassivesState(state);
    const blocks = [];
    for (let slot = 0; slot < 2; slot++) {
      const species = state.identity[slot], chosen = state.loadouts[slot];
      const errors = validate(slot);
      const selects = [];
      for (let i = 0; i < PASSIVE_SLOTS; i++) {
        const val = chosen[i] ?? '';
        const cur = PASSIVE_BY_ID[val];
        selects.push(`<label class="field">Passiva ${i + 1}<select data-slot="${slot}" data-idx="${i}" ${cur ? `data-tip-title="${escape(cur.nome)}" data-tip="${escape(tipOf(cur))}"` : 'data-tip-title="Habilidade passiva" data-tip="Escolha uma habilidade: passe o mouse para ver o gatilho e o efeito."'}>
          <option value="">— nenhuma —</option>
          <optgroup label="${species ? `Exclusivas de ${escape(species)}` : 'Sem personagem (só genéricas)'}">${optionsFor(species)}</optgroup>
        </select></label>`);
        // o <select> acima lista tudo; o valor é fixado abaixo
      }
      blocks.push(`<div class="passives-slot" data-slot="${slot}">
        <h3>${SLOT_LABELS[slot]} <span class="muted">${species ? `· espécie: <b>${escape(species)}</b>` : '· sem personagem (genéricas apenas)'}</span></h3>
        <div class="row">${selects.join('')}</div>
        ${chosen.map(id => PASSIVE_BY_ID[id]).filter(Boolean).map(p => `<p class="tip-line"><b>${escape(p.nome)}</b> — ${escape(tipOf(p))}</p>`).join('')}
        <p class="${errors.length ? 'warn' : 'ok'}" data-errors>${errors.length ? escape(errors.join(' · ')) : '✓ loadout válido'}</p>
      </div>`);
    }
    root.innerHTML = `<p class="hint">Até <b>2 passivas</b> por lutador, escolhidas <b>antes</b> da partida e fixas durante ela. Duplicata é recusada aqui e no motor. Catálogo <b>experimental</b> (não homologado): valores ajustáveis em <b>Ajustes › Passivas</b>.</p>` + blocks.join('');
    root.querySelectorAll('select').forEach(sel => {
      const slot = Number(sel.dataset.slot), idx = Number(sel.dataset.idx);
      sel.value = state.loadouts[slot][idx] ?? '';
      sel.onchange = () => {
        const id = sel.value || null;
        const next = [...state.loadouts[slot]];
        while (next.length <= idx) next.push(null);
        next[idx] = id;
        // recompacta: remove nulos e duplicatas escolhidas por último (a escolha anterior perde)
        const seen = new Set(), compact = [];
        for (const x of next) {if (!x) continue;if (seen.has(x)) continue;seen.add(x);compact.push(x);}
        state.loadouts[slot] = compact.slice(0, PASSIVE_SLOTS);
        savePassivesState(state);
        render();
        onChange?.();
      };
    });
  }

  return {
    root, render,
    /** Aplica identidade + loadouts validados no jogo (chamar antes de game.reset()). */
    applyTo(game) {
      game.passiveIdentity = [...state.identity];
      for (let slot = 0;  slot < 2; slot++) game.setPassiveLoadout(slot, state.loadouts[slot]);
      return state;
    },
    /** Restaura loadouts de uma gravação (reprodução exata, §27). */
    setFromRecording(data) {
      if (!Array.isArray(data?.loadouts)) return;
      state.loadouts = data.loadouts.map(l => Array.isArray(l) ? l.filter(Boolean).slice(0, PASSIVE_SLOTS) : []);
      if (Array.isArray(data.identity)) state.identity = data.identity;
      savePassivesState(state);
      render();
    },
    get state() {return state;},
  };
}
