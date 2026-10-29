// Seleção Rápida do menu pré-jogo: DOIS BLOCOS (azul e vermelho), cada um com seleção de PERSONAGEM
// (modelos salvos no workspace, aplicados na hora), PRÉVIA 3D do modelo, MOVES (4 slots, registro de moves)
// e ABILITIES/PASSIVAS (catálogo experimental, regras R1–R6: máximo 2, sem duplicata, exclusivas só da
// espécie). As escolhas são aplicadas no jogo ao iniciar (applyAll) e persistem no workspace (collect/apply).
import {listMoves} from '../sim/moves.js';
import {PASSIVE_SLOTS, exclusivePassives, genericPassives, speciesFromName, validateLoadout} from '../sim/passives.js';
import {createMenuPreview} from './menu-preview.js';
import {COLOR_OPTIONS, COLOR_IDS, colorHex, effectiveColor, sameModel} from '../view/character-colors.js';
import {fighterColorLabel, fighterGlyph, setFighterIdentity} from './fighter-identity.js';

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
    color: ['auto', 'auto'],                             // cor do lutador: automática, azul, vermelho, amarelo ou roxo
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

  let store = null, wsUI = null, modelsCache = [];
  const pendingChar = [undefined, undefined];
  // Eventos de mudança (as telas A/B/C se redesenham a partir do MESMO estado; nada é guardado por tema).
  const listeners = new Set();
  const emit = (type, slot) => {for (const fn of [...listeners]) {try {fn({type, slot});} catch (e) {console.error('menu-quick: ouvinte falhou', e);}}};
  const previews = [createMenuPreview($('quick-preview-0')), createMenuPreview($('quick-preview-1'))];

  // ---------- Personagem (modelo) ----------
  function updateCharLabel(slot) {
    const el = $(`quick-char-name-${slot}`);
    if (el) el.textContent = ui.sources[slot]?.name ?? 'Sem modelo carregado';
  }
  // ---------- Cor do lutador (prévia + personagem da partida) ----------
  const sameFighters = () => sameModel(ui.sources[0], ui.sources[1]);
  /** Cor efetiva do espaço: 'auto' vira vermelho/azul quando os dois usam o mesmo modelo. */
  const colorOf = slot => effectiveColor(slot, state.color[slot], state.color[1 - slot], sameFighters());
  function syncColorSelect(slot) {
    const sel = $(`quick-color-${slot}`);
    if (sel && sel.value !== state.color[slot]) sel.value = state.color[slot];
  }
  /** Cabeçalho do bloco do menu: acompanha a cor escolhida (antes era "Lutador Azul"/"Adversário Vermelho" fixo). */
  function syncHeader(slot, hex) {
    const h = $(`quick-head-${slot}`);
    if (!h) return;
    const label = fighterColorLabel(slot);
    const pretty = label ? ' ' + label.charAt(0) + label.slice(1).toLowerCase() : '';
    h.textContent = `${fighterGlyph(slot)} ${slot ? 'Adversário' : 'Lutador'}${pretty}`;
    if (hex) h.style.color = hex; else h.style.removeProperty('color');
  }
  /** Aplica a cor nos DOIS lutadores: prévia 3D e Character usado na partida. */
  function applyColors() {
    for (const slot of SLOTS) {
      const id = colorOf(slot), hex = colorHex(id);
      previews[slot].setTint(hex);
      ui.characters[slot]?.setTint?.(hex);
      setFighterIdentity(slot, id);   // HUD da arena, slots de Move e indicador de recarga acelerada
      syncHeader(slot, hex);
    }
  }
  /** ÚNICO caminho de escrita da cor (select do menu atual e botões das telas A/B/C). */
  function setColor(slot, id) {
    if (!SLOTS.includes(slot)) return false;
    state.color[slot] = COLOR_IDS.includes(id) ? id : 'auto';
    syncColorSelect(slot);
    applyColors();
    emit('color', slot);
    return true;
  }
  function updatePreview(slot) {
    previews[slot].setCharacter(ui.characters[slot]);
    previews[slot].setTint(colorHex(colorOf(slot)));
    updateCharLabel(slot);
  }
  /** O <select> nativo acompanha SEMPRE o estado (senão refreshModels() leria o valor velho e desfaria a escolha feita nas telas A/B/C). */
  function syncCharSelect(slot, modelId) {
    const sel = $(`quick-char-${slot}`);
    if (sel && [...sel.options].some(o => o.value === (modelId ?? ''))) sel.value = modelId ?? '';
  }
  const charBusy = [Promise.resolve(), Promise.resolve()];   // uma troca de personagem por vez em cada lutador (cliques rápidos não competem)
  function selectChar(slot, modelId) {
    state.char[slot] = modelId;
    syncCharSelect(slot, modelId);
    const done = () => {renderPassives(slot);updatePreview(slot);applyColors();emit('char', slot);};   // a espécie/cor podem mudar com o modelo
    if (!modelId) {done();return Promise.resolve();}   // “manter o carregado”
    const run = async () => {
      if (ui.sources[slot]?.assetId !== modelId) {
        const sel = $(`quick-char-${slot}`);
        if (sel) sel.disabled = true;
        try {const r = wsUI ? await wsUI.reopen(slot, {modelId}) : null;if (r?.error) throw new Error(String(r.error));} catch (e) {
          console.error('menu-quick: não foi possível abrir o personagem', e);
          if (ui.sources[slot]?.assetId !== modelId) {state.char[slot] = null;syncCharSelect(slot, null);}   // a escolha não vale: o carregado continua
        } finally {if (sel) sel.disabled = false;}
      }
      done();
    };
    charBusy[slot] = charBusy[slot].then(run, run);
    return charBusy[slot];
  }
  /** Repõe a lista de personagens salvos; reaplica a escolha pendente (vinda da persistência). */
  async function refreshModels() {
    if (!store) return;
    let models = [];
    try {models = (await store.listAssets()).filter(a => a.kind === 'model').sort((a, b) => (b.lastUsedAt ?? b.addedAt ?? 0) - (a.lastUsedAt ?? a.addedAt ?? 0));} catch {models = [];}
    modelsCache = models;
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
    emit('char', -1);
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
      sel.onchange = () => setMove(slot, i, sel.value || null);
      return sel;
    }));
  }

  /** Atribui (ou esvazia) o Move de um slot; é o ÚNICO caminho de escrita dos Moves (selects e telas A/B/C). Id fora do registro é recusado. */
  function setMove(slot, i, id) {
    if (!SLOTS.includes(slot) || !(i >= 0 && i < 4)) return false;
    if (id && !listMoves().some(m => m.id === id)) return false;
    const arr = [...state.moves[slot]];
    arr[i] = id || null;
    if (arr[i]) for (let k = 0; k < arr.length; k++) if (k !== i && arr[k] === arr[i]) arr[k] = null;   // um move não ocupa dois slots
    state.moves[slot] = arr;
    game.setLoadout(slot, arr);
    renderMoves(slot);
    emit('move', slot);
    return true;
  }

  // ---------- Abilities / passivas (2 por lutador) ----------
  function renderPassives(slot) {
    const box = $(`quick-passives-${slot}`);
    if (!box) return;
    const species = speciesFromName(ui.sources[slot]?.name ?? null);
    const opts = [...(species ? exclusivePassives(species) : []), ...genericPassives()];   // sem espécie não há exclusivas (exclusivePassives(null) devolveria as genéricas de novo)
    const chosen = state.passives[slot];
    box.replaceChildren(...Array.from({length: PASSIVE_SLOTS}, (_, i) => {
      const sel = document.createElement('select');
      sel.setAttribute('aria-label', `Passiva ${i + 1}`);
      sel.append(new Option('— nenhuma —', ''), ...opts.map(p => new Option(p.nome + (p.species ? ` (${p.species})` : ''), p.id)));
      const val = chosen[i] && opts.some(p => p.id === chosen[i]) ? chosen[i] : '';
      if (chosen[i] && !val) chosen[i] = null;   // exclusiva que não pertence mais à espécie
      sel.value = val;
      sel.onchange = () => setPassive(slot, i, sel.value || null);
      return sel;
    }));
    const errors = validateLoadout(state.passives[slot].filter(Boolean), species);
    const st = $(`quick-passive-status-${slot}`);
    if (st) {st.className = 'qf-passive-status ' + (errors.length ? 'warn' : 'ok');st.textContent = errors.length ? errors.join(' · ') : '✓ loadout válido';}
  }

  /** Atribui (ou esvazia) a passiva de um espaço; sem duplicata (a escolha anterior perde) e só do catálogo/espécie válidos. */
  function setPassive(slot, i, id) {
    if (!SLOTS.includes(slot) || !(i >= 0 && i < PASSIVE_SLOTS)) return false;
    const species = speciesFromName(ui.sources[slot]?.name ?? null);
    if (id && ![...(species ? exclusivePassives(species) : []), ...genericPassives()].some(p => p.id === id)) return false;
    const arr = [...state.passives[slot]];
    arr[i] = id || null;
    const seen = new Set(), compact = [];
    for (const x of arr) {if (!x || seen.has(x)) continue;seen.add(x);compact.push(x);}   // a escolha anterior perde (sem duplicata)
    while (compact.length < PASSIVE_SLOTS) compact.push(null);
    state.passives[slot] = compact.slice(0, PASSIVE_SLOTS);
    renderPassives(slot);
    emit('passive', slot);
    return true;
  }

  // ---------- Ligação dos seletores de personagem e cor ----------
  for (const slot of SLOTS) {
    const sel = $(`quick-char-${slot}`);
    if (sel) sel.onchange = () => selectChar(slot, sel.value || null);
    const csel = $(`quick-color-${slot}`);
    if (csel) {
      csel.replaceChildren(...COLOR_OPTIONS.map(c => new Option(c.label, c.id)));
      csel.value = state.color[slot];
      csel.onchange = () => setColor(slot, csel.value);
    }
  }

  // ---------- Laço da prévia (só desenha com o menu visível) ----------
  let lastT = performance.now();
  (function loop(now) {
    const dt = Math.min(.05, Math.max(0, (now - lastT) / 1000));
    lastT = now;
    const menu = $('menu');
    requestAnimationFrame(loop);   // primeiro: uma falha numa prévia não pode parar o laço das duas
    if (menu && !menu.hidden) for (const p of previews) {try {p.tick(dt);} catch (e) {console.error('menu-quick: prévia falhou', e);}}
  })(performance.now());

  // ---------- Inicialização dos controles ----------
  for (const slot of SLOTS) {renderMoves(slot);renderPassives(slot);updatePreview(slot);syncColorSelect(slot);}
  applyColors();

  // ---------- API ----------
  return {
    /** Chamar quando o workspace terminar de inicializar (store/wsUI disponíveis). */
    attachWorkspace(boot) {store = boot?.store ?? null;wsUI = boot?.wsUI ?? null;return refreshModels();},
    /** Modelos/personagens mudaram (carregado, removido, importado): repõe lista, prévias e cores. */
    refresh() {renderPassives(0);renderPassives(1);updatePreview(0);updatePreview(1);applyColors();emit('char', -1);return refreshModels();},
    /** Aplica tudo no jogo (chamar antes de startMatch): moves dos dois lutadores + passivas no painel + cores. */
    applyAll() {
      for (const slot of SLOTS) game.setLoadout(slot, state.moves[slot]);
      for (const slot of SLOTS) passivesPanel.state.loadouts[slot] = state.passives[slot].filter(Boolean);
      passivesPanel.render();   // recalcula identidade pelos nomes, valida (R5) e persiste em localStorage
      applyColors();
    },
    setMove, setPassive, setColor,
    /** Cor escolhida ('auto' | 'blue' | 'red' | 'yellow' | 'purple') e cor efetiva (null = sem tingimento). */
    colorPick: slot => state.color[slot],
    colorOf,
    /** Seleciona o personagem (modelo salvo) do lutador; null = manter o carregado. */
    selectCharacter: (slot, modelId) => selectChar(slot, modelId || null),
    /** Personagens disponíveis (modelos salvos no workspace) + o que está carregado agora. */
    characters(slot) {return {loaded: ui.sources[slot]?.name ?? null, loadedId: ui.sources[slot]?.assetId ?? null, saved: modelsCache.map(a => ({id: a.id, name: a.name}))};},
    speciesOf: slot => speciesFromName(ui.sources[slot]?.name ?? null),
    /** Assina mudanças (tipo: 'move' | 'passive' | 'char'); devolve a função que cancela. */
    onChange(fn) {listeners.add(fn);return () => listeners.delete(fn);},
    get previews() {return previews;},
    collect() {return {char: [...state.char], color: [...state.color], moves: state.moves.map(a => [...a]), passives: state.passives.map(a => [...a])};},
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
        if (COLOR_IDS.includes(saved.color?.[slot])) {state.color[slot] = saved.color[slot];syncColorSelect(slot);}
      }
      applyColors();
      emit('init', -1);
    },
    get state() {return state;},
  };
}
