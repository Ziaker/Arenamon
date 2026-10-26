// @ts-check
// Painel do Editor de Moves (Overhaul Mecânico Completo): palco expandido + play + análise A/B + cobertura total de parâmetros
// (Exclusivos do Move com categorias/busca/digitação exata/consumidor, Herdados de sistemas compartilhados, Calculados em tempo real e Constantes técnicas justificadas).
import {C, defaults} from '../sim/config.js';
import {escape} from '../ui/tuning.js';
import {isVisualWorldParam} from '../ui/moves-panel.js';
import {
  MOVE_MECHANIC_CATEGORIES,
  effectiveRangeOf,
  classifyParamRow,
} from '../sim/moves/params-registry.js';
import {
  getInheritedParamsForMove,
  getCalculatedValuesForMove,
  getTechnicalConstantsForMove,
} from '../sim/moves/move-mechanics-audit.js';
import {controls as atelierControls, help as atelierHelp, phaseOf, phaseNames} from '../../../sand-stone-lab/src/config.ts';
import {ATELIER_APPROVED, ATELIER_GAME_PARAMS} from '../view/quarks/atelier-game-params.js';
import {EDITABLE_MOVES, editableMove} from './editable-moves.js';
import {buildMoveDoc, buildVisualDoc, describeDiffs} from './move-save-model.js';
import {traceMove, compareTraces, currentValues, defaultValues, diffCount} from './move-trace.js';
import {
  makeMoveScenario,
  currentMoveJson,
  TARGET_STATES,
  STAGE_ARENAS,
  DEFAULT_STAGE,
  DISTANCE_RANGE,
  HOLD_RANGE,
  needsHold,
  suggestedHold,
  holdHint,
} from './move-editor-model.js';

/** Lê um caminho pontilhado (`actions.tackle.speed`, `world.charge.moveMult`, etc.) a partir de um objeto raiz. */
function getByPath(/** @type {any} */ rootObj, /** @type {string} */ dotted) {
  return dotted.split('.').reduce((acc, k) => (acc != null ? acc[k] : undefined), rootObj);
}

/** Escreve num caminho pontilhado a partir de um objeto raiz. */
function setByPath(/** @type {any} */ rootObj, /** @type {string} */ dotted, /** @type {any} */ val) {
  const parts = dotted.split('.');
  const last = parts.pop();
  const target = parts.reduce((acc, k) => (acc != null ? acc[k] : undefined), rootObj);
  if (target && last) target[last] = val;
}

/**
 * @param {{getWorld: () => any, $: (id: string) => any, tuning: any, startScenario: (def: any) => void, abortScenario: () => void, getScenario: () => any, getLastResult: () => any, save?: {available: boolean, read: (kind: 'moves' | 'approved', id: string) => Promise<{status: number, json: any}>, write: (kind: 'moves' | 'approved', id: string, doc: any, expectHash: string) => Promise<{status: number, json: any}>, rememberOpen?: (moveId: string) => void}, ficha?: {timelineMarkup: (id: string) => string, abMarkup: (id: string) => string, bind: (root: any) => void, fire: (id: string) => void}, openActions?: (id: string) => void, vfx?: {markup: (id: string) => string, bind: (root: any) => void, bindParams: (root: any, rerender: () => void) => void}, seekToTime?: (seconds: number) => boolean, download: (data: string, name: string, type?: string) => void, setTimeScale: (v: number) => void, onVisualChange?: (key: string, k: string, v: number) => void}} deps
 */
export function createMoveEditor({getWorld, $, tuning, startScenario, abortScenario, getScenario, getLastResult, save, ficha, openActions, vfx, seekToTime, download, setTimeScale, onVisualChange = () => {}}) {
  const root = $('move-editor-body');
  const state = {
    moveId: (EDITABLE_MOVES.find(m => m.id === 'sand-wave') ?? EDITABLE_MOVES[0]).id,
    distance: DEFAULT_STAGE.distance,
    target: DEFAULT_STAGE.target,
    arena: DEFAULT_STAGE.arena ?? 'open',
    hold: 0,
    loop: false,
    speed: 1,
    running: false,
    pinned: /** @type {Record<string, number> | null} */ (null),
    tierFilter: /** @type {'all' | 'essential' | 'advanced' | 'technical'} */ ('all'),
    searchQuery: '',
    onlyChanged: false,
  };
  const move = () => /** @type {any} */ (editableMove(state.moveId));
  const el = (/** @type {string} */ tag, /** @type {Record<string, any>} */ attrs = {}, /** @type {(Node | string)[]} */ kids = []) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) k === 'class' ? (e.className = v) : k === 'text' ? (e.textContent = v) : e.setAttribute(k, String(v));
    e.append(...kids);return e;
  };
  const status = (/** @type {string} */ t) => {const s = $('editor-status');if (s) s.textContent = t;};

  function play() {
    abortScenario();
    const def = makeMoveScenario(move(), {
      distance: state.distance,
      target: state.target,
      arena: state.arena,
      hold: needsHold(move()) ? state.hold : 0,
    });
    state.running = true;startScenario(def);
    status(`Executando «${move().name}»…`);
  }
  function showResult() {
    const r = getLastResult(), box = $('editor-result');
    if (!box || !r?.id?.startsWith('editor-')) return;
    box.innerHTML = `<table class="editor-table"><tr><th>Medida</th><th>Obtido</th></tr>${r.checks.map((/** @type {any} */ c) => `<tr><td class="${c.ok ? '' : 'bad'}">${c.ok ? '' : '✗ '}${escape(c.label)}</td><td>${escape(c.actual)}</td></tr>`).join('')}</table>`;
  }
  /** A cada ~0,25 s: detecta o fim do cenário do editor e, se «Repetir em laço» estiver ligado, executa de novo. */
  function poll() {
    const sc = getScenario();
    const mine = !!sc?.def?.id?.startsWith('editor-');
    if (state.running && !mine) {
      state.running = false;
      status('Execução concluída.');showResult();
      if (state.loop && !$('move-editor').hidden) setTimeout(() => { if (state.loop && !getScenario()) play(); }, 350);
    }
  }
  setInterval(poll, 250);

  function stageSection() {
    const sec = el('section', {class: 'editor-sec'}, [el('h4', {text: 'Palco'})]);
    const sel = /** @type {HTMLSelectElement} */ (el('select', {id: 'editor-move'}, EDITABLE_MOVES.map(m => el('option', {value: m.id, text: m.name}))));
    sel.value = state.moveId;sel.onchange = () => {state.moveId = sel.value;state.hold = suggestedHold(move());state.pinned = null;render();};

    const dist = /** @type {HTMLInputElement} */ (el('input', {type: 'range', id: 'editor-distance', min: DISTANCE_RANGE.min, max: DISTANCE_RANGE.max, step: DISTANCE_RANGE.step, value: state.distance}));
    const distNum = /** @type {HTMLInputElement} */ (el('input', {type: 'number', id: 'editor-distance-num', class: 'ed-num-input', min: DISTANCE_RANGE.min, max: DISTANCE_RANGE.max, step: DISTANCE_RANGE.step, value: state.distance, title: 'Digitação exata da distância (m)'}));
    const distOut = el('output', {text: `${state.distance} m`});
    const syncDist = (/** @type {number} */ raw) => {
      const v = Math.min(DISTANCE_RANGE.max, Math.max(DISTANCE_RANGE.min, Number.isFinite(raw) ? raw : state.distance));
      state.distance = v;dist.value = String(v);distNum.value = String(v);distOut.textContent = `${v} m`;scheduleAnalysis();
    };
    dist.oninput = () => syncDist(Number(dist.value));
    distNum.onchange = () => syncDist(Number(distNum.value));

    const holdRow = needsHold(move()) ? [(() => {
      const initHold = state.hold || suggestedHold(move());
      const hold = /** @type {HTMLInputElement} */ (el('input', {type: 'range', id: 'editor-hold', min: HOLD_RANGE.min, max: HOLD_RANGE.max, step: HOLD_RANGE.step, value: initHold}));
      const holdNum = /** @type {HTMLInputElement} */ (el('input', {type: 'number', id: 'editor-hold-num', class: 'ed-num-input', min: HOLD_RANGE.min, max: HOLD_RANGE.max, step: HOLD_RANGE.step, value: initHold, title: 'Digitação exata do tempo segurando o botão (s)'}));
      const out = el('output', {text: `${(+hold.value).toFixed(2)} s`});
      state.hold = Number(hold.value);
      const syncHold = (/** @type {number} */ raw) => {
        const v = Math.min(HOLD_RANGE.max, Math.max(HOLD_RANGE.min, Number.isFinite(raw) ? raw : state.hold));
        state.hold = v;hold.value = String(v);holdNum.value = String(v);out.textContent = `${v.toFixed(2)} s`;scheduleAnalysis();
      };
      hold.oninput = () => syncHold(Number(hold.value));
      holdNum.onchange = () => syncHold(Number(holdNum.value));
      return el('label', {class: 'editor-row', title: holdHint(move())}, [el('span', {text: 'Segurar o botão'}), hold, holdNum, out]);
    })(), el('p', {class: 'hint', text: holdHint(move())})] : [];

    const tgt = /** @type {HTMLSelectElement} */ (el('select', {id: 'editor-target'}, TARGET_STATES.map(([v, l]) => el('option', {value: v, text: l}))));
    tgt.value = state.target;tgt.onchange = () => {state.target = tgt.value;scheduleAnalysis();};

    const ar = /** @type {HTMLSelectElement} */ (el('select', {id: 'editor-arena'}, STAGE_ARENAS.map(([v, l]) => el('option', {value: v, text: l}))));
    ar.value = state.arena;ar.onchange = () => {state.arena = ar.value;scheduleAnalysis();};

    const spd = /** @type {HTMLSelectElement} */ (el('select', {id: 'editor-speed'}, [['1', 'Normal'], ['0.5', 'Câmera lenta (0,5×)'], ['0.25', 'Muito lenta (0,25×)']].map(([v, l]) => el('option', {value: v, text: l}))));
    spd.value = String(state.speed);spd.onchange = () => {state.speed = Number(spd.value);setTimeScale(state.speed);};
    const loop = /** @type {HTMLInputElement} */ (el('input', {type: 'checkbox', id: 'editor-loop'}));
    loop.checked = state.loop;loop.onchange = () => {state.loop = loop.checked;};
    const playBtn = el('button', {type: 'button', id: 'editor-play', class: 'primary', text: '▶ Executar'});playBtn.onclick = play;
    const stopBtn = el('button', {type: 'button', id: 'editor-stop', text: '■ Parar'});
    stopBtn.onclick = () => {state.loop = false;loop.checked = false;abortScenario();state.running = false;status('Parado.');};
    sec.append(
      el('label', {class: 'editor-row'}, [el('span', {text: 'Move'}), sel]),
      el('label', {class: 'editor-row'}, [el('span', {text: 'Distância do alvo'}), dist, distNum, distOut]),
      el('label', {class: 'editor-row'}, [el('span', {text: 'Alvo'}), tgt]),
      el('label', {class: 'editor-row'}, [el('span', {text: 'Geometria da arena'}), ar]),
      ...holdRow,
      el('label', {class: 'editor-row'}, [el('span', {text: 'Velocidade'}), spd]),
      el('label', {class: 'editor-row check'}, [loop, el('span', {text: 'Repetir em laço'})]),
      el('div', {class: 'editor-actions'}, [playBtn, stopBtn, (() => {const b = el('button', {type: 'button', id: 'editor-fire', title: 'Equipa o Move no azul (se preciso) e o dispara com a tecla real do slot, na partida atual', text: '▶ Disparar no jogo'});b.onclick = () => ficha?.fire(state.moveId);return b;})(), (() => {const b = el('button', {type: 'button', id: 'editor-open-actions', title: 'Abre a gaveta Ações neste Move: equipagem, botões e animações', text: '⚔ Equipar e animações'});b.onclick = () => openActions?.(state.moveId);return b;})()]),
      el('p', {id: 'editor-status', class: 'hint', text: 'Pronto. «Executar» roda o Move de verdade na arena, com os valores abaixo.'}),
      el('div', {id: 'editor-result'}),
    );
    return sec;
  }

  const UNIT = {num: '', int: '', sec: 's', pct: '%', m: 'm', ms: 'm/s', ms2: 'm/s²', deg: '°', x: '×', yesno: ''};
  const show = (/** @type {number} */ v, /** @type {string} */ unit) => unit === 'pct' ? `${+(v * 100).toFixed(1)} %` : `${+(+v).toFixed(3)} ${UNIT[/** @type {keyof typeof UNIT} */ (unit)] ?? ''}`.trim();
  const TIER_LABEL = {essential: 'essencial', advanced: 'avançado', technical: 'técnico'};

  // ---------- Análise: linha do tempo, números e comparação A × B ----------
  const stageOf = () => ({distance: state.distance, target: state.target, arena: state.arena, hold: needsHold(move()) ? state.hold : 0});
  const fmt = (/** @type {number | null} */ v) => v == null ? '—' : String(+(+v).toFixed(3));
  let analysisTimer = 0;
  function scheduleAnalysis() {clearTimeout(analysisTimer);analysisTimer = /** @type {any} */ (setTimeout(analyze, 120));}
  function analyze() {
    const box = $('editor-analysis');
    if (!box || !box.isConnected) return;
    const m = move(), valuesA = state.pinned ?? defaultValues(m), valuesB = currentValues(m);
    let A, B;
    try {A = traceMove(m, stageOf(), valuesA);B = traceMove(m, stageOf(), valuesB);}
    catch (e) {box.textContent = 'Não foi possível analisar: ' + /** @type {Error} */ (e).message;return;}
    const same = diffCount(valuesA, valuesB) === 0, total = Math.max(A.total, B.total, 0.5);
    const pct = (/** @type {number} */ v) => `${Math.max(0, Math.min(100, v / total * 100)).toFixed(2)}%`;
    const lane = (/** @type {import('./move-trace.js').Lane} */ l, /** @type {string} */ tag) => {
      const bar = el('div', {class: 'tl-bar tl-' + l.kind});
      for (const sp of l.spans) {
        const seg = el('span', {class: 'tl-seg', title: l.label + ': ' + sp.from.toFixed(2) + ' s → ' + sp.to.toFixed(2) + ' s (clique para ir a ' + sp.from.toFixed(2) + ' s)', 'data-from': sp.from});
        seg.style.left = pct(sp.from);seg.style.width = pct(Math.max(sp.to - sp.from, total * 0.004));
        seg.onclick = () => goTo(sp.from);bar.append(seg);
      }
      return el('div', {class: 'tl-lane'}, [el('span', {class: 'tl-label', title: l.label, text: tag + ' · ' + l.label}), bar]);
    };
    const group = (/** @type {import('./move-trace.js').MoveTrace} */ T, /** @type {string} */ tag) => {
      const rows = T.lanes.map(l => lane(l, tag));
      const hitBar = el('div', {class: 'tl-bar tl-hits'});
      for (const h of T.hits) {
        const mk = el('span', {class: 'tl-hit', title: 'Acerto em ' + h.t.toFixed(2) + ' s: ' + h.damage.toFixed(1) + ' HP (' + h.result + ')', 'data-t': h.t, text: '◆'});
        mk.style.left = pct(h.t);mk.onclick = () => goTo(h.t);hitBar.append(mk);
      }
      const press = el('span', {class: 'tl-press', title: 'Botão apertado em ' + T.press.toFixed(2) + ' s', text: '▼'});press.style.left = pct(T.press);hitBar.append(press);
      rows.push(el('div', {class: 'tl-lane'}, [el('span', {class: 'tl-label', text: tag + ' · Acertos (◆) e botão (▼)'}), hitBar]));
      return el('div', {class: 'tl-group', 'data-tag': tag}, rows);
    };
    const axis = el('div', {class: 'tl-axis'});
    for (let t = 0; t <= total + 1e-9; t += total > 6 ? 1 : 0.5) {const tick = el('span', {text: t.toFixed(1) + 's'});tick.style.left = pct(t);axis.append(tick);}
    const rows = compareTraces(A, B);
    const table = el('table', {class: 'editor-table editor-ab'}, [
      el('tr', {}, [el('th', {text: 'Medida'}), el('th', {text: state.pinned ? 'A (fixado)' : 'A (padrão)'}), el('th', {text: 'B (atual)'}), el('th', {text: 'Δ'})]),
      ...rows.map(r => el('tr', {class: r.delta ? 'changed' : ''}, [el('td', {text: r.label}), el('td', {text: fmt(r.a)}), el('td', {text: fmt(r.b)}), el('td', {class: r.better === 'b' ? 'good' : r.better === 'a' ? 'bad' : '', text: r.delta == null || r.delta === 0 ? '' : (r.delta > 0 ? '+' : '') + fmt(r.delta)})])),
    ]);
    box.replaceChildren(
      el('p', {class: 'hint', text: same ? 'A e B são iguais: mude um slider de mecânica (ou fixe outro A) para comparar.' : 'A × B: ' + diffCount(valuesA, valuesB) + ' valor(es) diferente(s). Verde = B melhora, vermelho = B piora (a leitura de «melhor» é só uma dica).'}),
      el('div', {class: 'tl'}, [axis, group(B, 'B'), ...(same ? [] : [group(A, 'A')])]),
      table,
    );
  }
  function goTo(/** @type {number} */ seconds) {
    const ok = seekToTime ? seekToTime(seconds) : false;
    status(ok ? 'Replay pausado em ' + seconds.toFixed(2) + ' s.' : 'Execute o Move uma vez (▶) para poder navegar no tempo.');
  }
  function analysisSection() {
    const sec = el('section', {class: 'editor-sec'}, [el('h4', {text: 'Análise'})]);
    const pin = el('button', {type: 'button', id: 'editor-pin', text: 'Fixar A = valores atuais'});
    pin.onclick = () => {state.pinned = currentValues(move());analyze();status('A fixado com os valores atuais. Mude os sliders: B segue os valores atuais.');};
    const def = el('button', {type: 'button', id: 'editor-unpin', text: 'A = padrão do Move'});
    def.onclick = () => {state.pinned = null;analyze();};
    sec.append(el('div', {class: 'editor-actions'}, [pin, def]), el('div', {id: 'editor-analysis'}));
    return sec;
  }

  /** Seção completa de Mecânica (Fases 3, 4 e 5): parâmetros exclusivos com categorias/busca/digitação exata, herdados, calculados e constantes técnicas. */
  function mechanicsSection() {
    const m = move();
    const sec = el('section', {class: 'editor-sec'}, [
      el('h4', {text: 'Mecânica'}),
      el('p', {class: 'hint', text: 'Valem no próximo uso (M28.4; Ctrl+Z desfaz). Cada controle possui faixa única, digitação exata, categoria, consumidor no motor e indicador de governança.'}),
    ]);

    // Barra de ferramentas de filtragem, profundidade e restauração
    const tierBar = el('div', {class: 'editor-actions ed-tier-bar'}, [
      .../** @type {const} */ ([['all', 'Todos'], ['essential', 'Essencial'], ['advanced', 'Avançado'], ['technical', 'Técnico']]).map(([tier, label]) => {
        const b = el('button', {
          type: 'button',
          class: 'mini' + (state.tierFilter === tier ? ' primary' : ''),
          'data-tier-filter': tier,
          text: label,
        });
        b.onclick = () => {
          state.tierFilter = tier;
          for (const btn of tierBar.querySelectorAll('[data-tier-filter]')) {
            btn.classList.toggle('primary', btn.getAttribute('data-tier-filter') === tier);
          }
          applyFilter();
        };
        return b;
      }),
    ]);
    const searchInput = /** @type {HTMLInputElement} */ (el('input', {
      type: 'search',
      id: 'editor-param-search',
      placeholder: 'Filtrar parâmetro, chave, categoria ou arquivo consumidor…',
      value: state.searchQuery,
    }));
    const onlyChangedChk = /** @type {HTMLInputElement} */ (el('input', {
      type: 'checkbox',
      id: 'editor-only-changed',
    }));
    onlyChangedChk.checked = state.onlyChanged;
    const resetMoveBtn = el('button', {
      type: 'button',
      id: 'editor-reset-move',
      class: 'mini',
      title: 'Restaura todos os parâmetros exclusivos deste Move para os valores padrão da ficha',
      text: '↺ Restaurar Move',
    });

    const toolbar = el('div', {class: 'ed-mech-toolbar'}, [
      tierBar,
      el('div', {class: 'editor-row'}, [
        searchInput,
        el('label', {class: 'editor-row check'}, [onlyChangedChk, el('span', {text: 'Só alterados'})]),
        resetMoveBtn,
      ]),
    ]);
    sec.append(toolbar);

    const box = el('div', {id: 'editor-mechanics'});
    /** @type {Array<() => void>} */
    const sync = [];
    /** @type {Array<{rowEl: HTMLElement, cat: string, tier: string, searchBlob: string, isChanged: () => boolean}>} */
    const rowEntries = [];
    /** @type {Map<string, HTMLElement>} */
    const catDetails = new Map();

    // Agrupa os parâmetros exclusivos por categoria oficial (16 categorias)
    /** @type {Map<string, Array<{r: any, meta: ReturnType<typeof classifyParamRow>}>>} */
    const byCat = new Map();
    for (const r of m.params.rows) {
      if (String(r.key).startsWith('hitShake') || isVisualWorldParam([m.group, r.key])) continue;
      const meta = classifyParamRow(m.group, r);
      const cat = meta.category;
      if (!byCat.has(cat)) byCat.set(cat, []);
      byCat.get(cat)?.push({r, meta});
    }

    const sortedCats = [...byCat.keys()].sort((a, b) => {
      const ia = MOVE_MECHANIC_CATEGORIES.indexOf(/** @type {any} */ (a));
      const ib = MOVE_MECHANIC_CATEGORIES.indexOf(/** @type {any} */ (b));
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });

    for (const cat of sortedCats) {
      const items = byCat.get(cat) ?? [];
      const catDet = el('details', {class: 'ed-cat-group', 'data-cat': cat, open: ''}, [
        el('summary', {}, [el('b', {text: cat}), el('small', {class: 'muted', text: ` (${items.length})`})]),
      ]);
      catDetails.set(cat, catDet);

      for (const {r, meta} of items) {
        const path = `world.${m.group}.${r.key}`;
        const range = meta.effectiveRange;
        const get = () => getWorld()[m.group][r.key];
        const isToggle = r.min === 0 && r.max === 1 && r.step === 1;
        const input = /** @type {HTMLInputElement} */ (el('input', isToggle
          ? {type: 'checkbox', 'data-path': path}
          : {type: 'range', 'data-path': path, min: range.min, max: range.max, step: range.step}));
        const numInput = !isToggle ? /** @type {HTMLInputElement} */ (el('input', {
          type: 'number',
          class: 'ed-num-input',
          'data-num-path': path,
          min: range.min,
          max: range.max,
          step: range.step,
          title: `Digitar valor exato (${range.min} a ${range.max})`,
        })) : null;
        const out = el('output', {text: ''});
        const depKey = meta.dependsOn;

        const badges = [
          el('small', {
            class: r.approved ? 'ok' : 'warn',
            title: r.approved ? 'Valor decidido pelo diretor' : 'Valor provisório (ainda não homologado)',
            text: r.approved ? 'aprovado' : 'provisório',
          }),
          el('small', {
            class: 'muted ed-tier-badge',
            title: `Nível de profundidade: ${TIER_LABEL[meta.tier] ?? meta.tier} · Consumidor: ${meta.consumer.file} (${meta.consumer.fn})`,
            text: ` · ${TIER_LABEL[meta.tier] ?? meta.tier}`,
          }),
        ];
        if (depKey) {
          badges.push(el('small', {
            class: 'muted ed-dep-badge',
            title: `Este parâmetro depende de «${depKey}» estar ativo`,
            text: ` · depende de ${depKey}`,
          }));
        }

        const reset = el('button', {type: 'button', class: 'mini', title: 'Voltar ao padrão', text: '↺'});
        const row = el('label', {
          class: 'editor-row',
          'data-tier': meta.tier,
          'data-param-key': r.key,
          title: `${r.tip || r.label}\nConsumidor: ${meta.consumer.file} → ${meta.consumer.fn}\nAplicação: próximo uso (M28.4)`,
        }, [
          el('span', {}, [r.label + ' ', ...badges]),
          input,
          ...(numInput ? [numInput] : []),
          out,
          reset,
        ]);

        const refresh = () => {
          const v = get();
          if (isToggle) input.checked = !!v;
          else {
            input.value = String(v);
            if (numInput && document.activeElement !== numInput) numInput.value = String(+(+v).toFixed(4));
          }
          out.textContent = isToggle ? (v ? 'sim' : 'não') : show(v, r.unit);
          row.classList.toggle('changed', v !== r.value);
          if (depKey && depKey in (getWorld()[m.group] ?? {})) {
            row.classList.toggle('ed-dep-off', !getWorld()[m.group][depKey]);
          }
        };

        let before = /** @type {number | null} */ (null);
        input.oninput = () => {
          if (isToggle) return;
          if (before === null) before = get();
          const v = Number(input.value);
          getWorld()[m.group][r.key] = v;
          if (numInput) numInput.value = String(+(+v).toFixed(4));
          out.textContent = show(v, r.unit);
          refreshCalculated();
          scheduleAnalysis();
        };
        input.onchange = () => {
          const after = isToggle ? (input.checked ? 1 : 0) : Number(input.value);
          const was = before ?? get();
          before = null;
          getWorld()[m.group][r.key] = was;
          if (was !== after) tuning.commit([[path, after]], r.label);
          for (const f of sync) f();
          refreshCalculated();
          applyFilter();
        };
        if (numInput) {
          numInput.onchange = () => {
            const raw = Number(numInput.value);
            if (!Number.isFinite(raw)) {refresh();return;}
            const clamped = Math.min(range.max, Math.max(range.min, raw));
            const was = get();
            if (was !== clamped) tuning.commit([[path, clamped]], r.label);
            for (const f of sync) f();
            refreshCalculated();
            applyFilter();
          };
        }
        reset.onclick = () => {
          if (get() !== r.value) tuning.commit([[path, r.value]], 'Restaurar ' + r.label);
          for (const f of sync) f();
          refreshCalculated();
          applyFilter();
        };

        sync.push(refresh);
        refresh();
        catDet.append(row);
        rowEntries.push({
          rowEl: row,
          cat,
          tier: meta.tier,
          searchBlob: `${r.label} ${r.key} ${cat} ${r.tip ?? ''} ${meta.consumer.file} ${meta.consumer.fn}`.toLowerCase(),
          isChanged: () => get() !== r.value,
        });
      }
      box.append(catDet);
    }

    function applyFilter() {
      const q = state.searchQuery.trim().toLowerCase();
      /** @type {Map<string, number>} */
      const visibleInCat = new Map();
      for (const item of rowEntries) {
        const tierOk = state.tierFilter === 'all' || item.tier === state.tierFilter;
        const searchOk = !q || item.searchBlob.includes(q);
        const changedOk = !state.onlyChanged || item.isChanged();
        const showRow = tierOk && searchOk && changedOk;
        item.rowEl.hidden = !showRow;
        if (showRow) visibleInCat.set(item.cat, (visibleInCat.get(item.cat) ?? 0) + 1);
      }
      for (const [cat, det] of catDetails.entries()) {
        det.hidden = (visibleInCat.get(cat) ?? 0) === 0;
      }
    }

    searchInput.oninput = () => {state.searchQuery = searchInput.value;applyFilter();};
    onlyChangedChk.onchange = () => {state.onlyChanged = onlyChangedChk.checked;applyFilter();};
    resetMoveBtn.onclick = () => {
      /** @type {Array<[string, number]>} */
      const changes = [];
      for (const r of m.params.rows) {
        if (String(r.key).startsWith('hitShake') || isVisualWorldParam([m.group, r.key])) continue;
        const cur = getWorld()[m.group]?.[r.key];
        if (typeof cur === 'number' && cur !== r.value) changes.push([`world.${m.group}.${r.key}`, r.value]);
      }
      if (changes.length) {
        tuning.commit(changes, `Restaurar todos os parâmetros de ${m.name}`);
        for (const f of sync) f();
        refreshCalculated();
        applyFilter();
      }
    };

    // 1. Subseção: Parâmetros herdados de sistemas compartilhados (Charge, Tackle, Combate, IA)
    const inheritedList = getInheritedParamsForMove(m.id, m.group);
    const inhDetails = el('details', {id: 'editor-inherited', class: 'ed-subsec'}, [
      el('summary', {}, [
        el('b', {text: `Parâmetros herdados de sistemas compartilhados (${inheritedList.length})`}),
        el('small', {class: 'muted', text: ' · Charge, Tackle, Combate e IA'}),
      ]),
      el('p', {class: 'hint', text: 'Valores globais herdados por este Move. Quando o Move possui um slider exclusivo que substitui o valor herdado, o indicador «substituído pelo Move» mostra qual parâmetro prevalece.'}),
    ]);
    for (const inh of inheritedList) {
      const defVal = Number(getByPath(defaults(), inh.path) ?? 0);
      const getInh = () => Number(getByPath(C, inh.path) ?? defVal);
      const inp = /** @type {HTMLInputElement} */ (el('input', {
        type: 'range',
        'data-inherited-path': inh.path,
        min: inh.min,
        max: inh.max,
        step: inh.step,
      }));
      const numInp = /** @type {HTMLInputElement} */ (el('input', {
        type: 'number',
        class: 'ed-num-input',
        'data-inherited-num': inh.path,
        min: inh.min,
        max: inh.max,
        step: inh.step,
      }));
      const out = el('output', {text: ''});
      const resetInh = el('button', {type: 'button', class: 'mini', title: 'Restaurar valor herdado padrão', text: '↺'});
      const badge = inh.overriddenBy
        ? el('small', {class: 'ok', title: `Este Move possui um parâmetro próprio que substitui ou escala este valor: ${inh.overriddenBy}`, text: `substituído por ${inh.overriddenBy}`})
        : el('small', {class: 'muted', text: inh.system});
      const row = el('label', {
        class: 'editor-row',
        title: `${inh.tip}\nCaminho global: C.${inh.path}\nConsumidor: ${inh.consumer}`,
      }, [
        el('span', {}, [`${inh.label} `, badge]),
        inp,
        numInp,
        out,
        resetInh,
      ]);
      const refreshInh = () => {
        const v = getInh();
        inp.value = String(v);
        if (document.activeElement !== numInp) numInp.value = String(+(+v).toFixed(4));
        out.textContent = show(v, inh.unit);
        row.classList.toggle('changed', v !== defVal);
      };
      let beforeInh = /** @type {number | null} */ (null);
      inp.oninput = () => {
        if (beforeInh === null) beforeInh = getInh();
        const v = Number(inp.value);
        setByPath(C, inh.path, v);
        numInp.value = String(+(+v).toFixed(4));
        out.textContent = show(v, inh.unit);
        refreshCalculated();
        scheduleAnalysis();
      };
      inp.onchange = () => {
        const after = Number(inp.value);
        const was = beforeInh ?? getInh();
        beforeInh = null;
        setByPath(C, inh.path, was);
        if (was !== after) tuning.commit([[inh.path, after]], inh.label);
        refreshInh();
        refreshCalculated();
      };
      numInp.onchange = () => {
        const raw = Number(numInp.value);
        if (!Number.isFinite(raw)) {refreshInh();return;}
        const clamped = Math.min(inh.max, Math.max(inh.min, raw));
        const was = getInh();
        if (was !== clamped) tuning.commit([[inh.path, clamped]], inh.label);
        refreshInh();
        refreshCalculated();
      };
      resetInh.onclick = () => {
        if (getInh() !== defVal) tuning.commit([[inh.path, defVal]], 'Restaurar ' + inh.label);
        refreshInh();
        refreshCalculated();
      };
      sync.push(refreshInh);
      refreshInh();
      inhDetails.append(row);
    }

    // 2. Subseção: Valores calculados (fórmulas mecânicas em tempo real)
    const calcBox = el('div', {id: 'editor-calculated-body'});
    const calcDetails = el('details', {id: 'editor-calculated', class: 'ed-subsec', open: ''}, [
      el('summary', {}, [el('b', {text: 'Valores calculados (fórmulas mecânicas em tempo real)'})]),
      el('p', {class: 'hint', text: 'Resultados derivados automaticamente dos sliders atuais (atualizados ao vivo enquanto você arrasta).'}),
      calcBox,
    ]);
    function refreshCalculated() {
      const calcRows = getCalculatedValuesForMove(m.id, m.group, getWorld(), C.profiles?.balanced?.attack ?? 10, C.test?.attackReference ?? 10);
      calcBox.innerHTML = `<table class="editor-table"><tr><th>Resultado mecânico</th><th>Fórmula</th><th>Valor atual</th></tr>${calcRows.map(c => `<tr><td>${escape(c.label)}</td><td><code>${escape(c.formula)}</code></td><td><b>${escape(String(c.value))}</b> ${escape(UNIT[/** @type {keyof typeof UNIT} */ (c.unit)] ?? c.unit)}</td></tr>`).join('')}</table>`;
    }
    refreshCalculated();

    // 3. Subseção: Constantes técnicas justificadas (bloqueadas)
    const techList = getTechnicalConstantsForMove(m.id);
    const techDetails = el('details', {id: 'editor-technical', class: 'ed-subsec'}, [
      el('summary', {}, [el('b', {text: `Constantes técnicas justificadas (${techList.length})`}), el('small', {class: 'muted', text: ' · bloqueadas por contrato'})]),
      el('p', {class: 'hint', text: 'Constantes matemáticas, de precisão IEEE-754 ou topologia discreta auditadas por moves-mechanics-audit.test.mjs.'}),
      el('table', {class: 'editor-table'}, [
        el('tr', {}, [el('th', {text: 'Constante'}), el('th', {text: 'Valores'}), el('th', {text: 'Arquivo'}), el('th', {text: 'Justificativa técnica'})]),
        ...techList.map(tc => el('tr', {}, [
          el('td', {}, [el('code', {text: tc.id})]),
          el('td', {text: tc.values.join(', ')}),
          el('td', {}, [el('small', {text: tc.file})]),
          el('td', {text: tc.reason}),
        ])),
      ]),
    ]);

    tuning.onChange?.(() => {
      if (box.isConnected) {
        for (const f of sync) f();
        refreshCalculated();
        applyFilter();
      }
    });

    sec.append(box, inhDetails, calcDetails, techDetails);
    return sec;
  }

  function visualSection() {
    const m = move();
    const key = m.visual?.atelier;
    const sec = el('section', {class: 'editor-sec'}, [el('h4', {text: 'Visual'})]);
    if (!key || !ATELIER_GAME_PARAMS[key]) {sec.append(el('p', {class: 'hint', text: 'Este Move não tem visual do atelier vinculado.'}));return sec;}
    const doc = /** @type {any} */ (ATELIER_APPROVED)[key];
    sec.append(el('p', {class: 'hint', text: `Atelier «${key}», alternativa ${doc.variant} (aprovado). Mudar aqui vale só nesta sessão e no próximo disparo — use «Copiar visual» para guardar em approved/${key}.json.`}));
    const defs = /** @type {any[]} */ (/** @type {any} */ (atelierControls)[key]);
    const det = el('details', {id: 'editor-visual'}, [el('summary', {text: `Parâmetros visuais (${defs.length})`})]);
    let lastPhase = '';
    for (const [k, label, unit, min, max, step, initial] of defs) {
      const phase = phaseOf(k);
      if (phase !== lastPhase) {lastPhase = phase;det.append(el('h5', {text: /** @type {any} */ (phaseNames)?.[phase] ?? phase}));}
      const cur = ATELIER_GAME_PARAMS[key][k] ?? initial;
      const input = /** @type {HTMLInputElement} */ (el('input', {type: 'range', 'data-visual': k, min, max, step, value: cur}));
      const out = el('output', {text: `${+(+cur).toFixed(3)} ${unit}`});
      input.oninput = () => {ATELIER_GAME_PARAMS[key][k] = Number(input.value);out.textContent = `${+(+input.value).toFixed(3)} ${unit}`;onVisualChange(key, k, Number(input.value));};
      det.append(el('label', {class: 'editor-row', title: /** @type {any} */ (atelierHelp)?.[k] ?? ''}, [el('span', {text: label}), input, out]));
    }
    sec.append(det);return sec;
  }

  /** VFX do jogo (efeitos de partículas, contato, explosão, cor e tremor de hit) — os mesmos controles que ficavam na aba «Visual (VFX)» de cada cartão da aba Moves. */
  function vfxSection() {
    const sec = el('section', {class: 'editor-sec', id: 'editor-vfx-sec'}, [el('h4', {text: 'Efeitos do jogo (VFX)'})]);
    if (!vfx) {sec.append(el('p', {class: 'hint', text: 'VFX indisponível nesta tela.'}));return sec;}
    const box = el('div', {id: 'editor-vfx'});
    const fill = () => {
      box.innerHTML = vfx.markup(state.moveId);
      vfx.bindParams(box, fill);vfx.bind(box);
    };
    fill();sec.append(box);return sec;
  }

  /** Linha do tempo DA FICHA (marcas planejadas em ticks de 120 Hz, sinais de VFX/câmera/animação, «Medir no motor») e comparação com o padrão de fábrica no motor (métricas e 1º tick em que divergem). */
  function fichaSection() {
    const sec = el('section', {class: 'editor-sec', id: 'editor-ficha-sec'}, [el('h4', {text: 'Ficha do Move: marcas e comparação com o padrão'})]);
    if (!ficha) {sec.append(el('p', {class: 'hint', text: 'Indisponível nesta tela.'}));return sec;}
    const tl = el('div', {id: 'editor-ficha-tl'}), ab = el('div', {id: 'editor-ficha-ab'});
    const fillTl = () => {tl.innerHTML = ficha.timelineMarkup(state.moveId);ficha.bind(tl);};
    tl.innerHTML = ficha.timelineMarkup(state.moveId);ficha.bind(tl);
    ab.innerHTML = ficha.abMarkup(state.moveId);ficha.bind(ab);
    tuning.onChange?.(() => {if (tl.isConnected && !tl.querySelector(':focus')) fillTl();});
    sec.append(el('details', {open: ''}, [el('summary', {text: 'Linha do tempo da ficha (ticks de 120 Hz)'}), tl]), el('details', {}, [el('summary', {text: 'Comparar com o padrão de fábrica (A/B no motor)'}), ab]));
    return sec;
  }

  /** Diálogo de confirmação com as diferenças (<dialog> nativo). Resolve true se o usuário confirmar. */
  function confirmDialog(/** @type {{title: string, file: string, diffs: {label: string, from: string, to: string}[]}} */ o) {
    return new Promise(resolve => {
      const dlg = /** @type {HTMLDialogElement} */ (el('dialog', {id: 'editor-confirm', class: 'editor-dialog', 'aria-labelledby': 'editor-confirm-title'}));
      const shown = o.diffs.slice(0, 60);
      const table = el('table', {class: 'editor-table'}, [el('tr', {}, [el('th', {text: 'O que muda'}), el('th', {text: 'Antes (no disco)'}), el('th', {text: 'Depois'})]), ...shown.map(d => el('tr', {}, [el('td', {text: d.label}), el('td', {text: d.from}), el('td', {class: 'good', text: d.to})]))]);
      const ok = el('button', {type: 'button', id: 'editor-confirm-ok', class: 'primary', text: 'Gravar no arquivo'}), no = el('button', {type: 'button', id: 'editor-confirm-cancel', text: 'Cancelar'});
      ok.onclick = () => {dlg.close('ok');};no.onclick = () => {dlg.close('cancel');};
      dlg.append(el('h3', {id: 'editor-confirm-title', text: o.title}), el('p', {class: 'hint'}, ['Arquivo: ', el('code', {text: o.file}), ` — ${o.diffs.length} alteração(ões)${o.diffs.length > shown.length ? ` (mostrando ${shown.length})` : ''}. O Git guarda a versão anterior.`]), el('div', {class: 'editor-dialog-body'}, [table]), el('div', {class: 'editor-actions'}, [no, ok]));
      dlg.addEventListener('close', () => {dlg.remove();resolve(dlg.returnValue === 'ok');});
      dlg.addEventListener('cancel', () => {dlg.returnValue = 'cancel';});
      document.body.append(dlg);dlg.showModal();no.focus();
    });
  }
  /** Fluxo de gravar: lê o arquivo do disco, calcula as diferenças, pede confirmação e só então grava (com o hash lido). */
  async function saveFlow(/** @type {'moves' | 'approved'} */ kind, /** @type {string} */ id, /** @type {(diskDoc: any) => any} */ makeDoc, /** @type {string} */ fileLabel) {
    if (!save?.available) {status('Para gravar direto no disco, abra o laboratório pelo servidor local (INICIAR_SERVIDOR.bat). Aqui você ainda pode copiar o JSON.');return;}
    status('Lendo o arquivo do disco…');
    const disk = await save.read(kind, id).catch((/** @type {Error} */ e) => ({status: 0, json: {error: e.message}}));
    if (disk.status !== 200) {status('Não foi possível ler ' + fileLabel + ': ' + (disk.json?.error ?? disk.status));return;}
    const next = makeDoc(disk.json.doc), diffs = describeDiffs(disk.json.doc, next);
    if (!diffs.length) {status('Nada para gravar: ' + fileLabel + ' já está igual aos valores atuais.');return;}
    const targetFile = disk.json?.file ?? fileLabel;
    const yes = await confirmDialog({title: 'Gravar no arquivo?', file: targetFile, diffs});
    if (!yes) {status('Gravação cancelada. Nada foi alterado.');return;}
    save.rememberOpen?.(state.moveId);
    const res = await save.write(kind, id, next, disk.json.hash).catch((/** @type {Error} */ e) => ({status: 0, json: {error: e.message}}));
    if (res.status === 200) status(res.json.changed ? 'Gravado em ' + targetFile + ' (' + diffs.length + ' alteração(ões)). O jogo recarrega para ler o arquivo novo.' : targetFile + ' já estava igual.');
    else if (res.status === 409) status('O arquivo mudou no disco depois que o editor o leu: nada foi gravado. Tente de novo (o editor lê o arquivo outra vez).');
    else status('Não gravou: ' + (res.json?.error ?? res.status));
  }

  function exportSection() {
    const m = move();
    const sec = el('section', {class: 'editor-sec'}, [el('h4', {text: 'Salvar'})]);
    const copy = async (/** @type {string} */ text, /** @type {string} */ name) => {
      try {await navigator.clipboard.writeText(text);status(`${name} copiado.`);}
      catch {download(text, name);status(`Sem área de transferência: ${name} baixado.`);}
    };
    const b1 = el('button', {type: 'button', id: 'editor-copy-move', text: 'Copiar move.json (mecânica)'});
    b1.onclick = () => copy(JSON.stringify(currentMoveJson(m), null, 2) + '\n', `${m.id}.move.json`);
    const b2 = el('button', {type: 'button', id: 'editor-copy-visual', text: 'Copiar visual (approved)'});
    b2.onclick = () => {
      const key = m.visual?.atelier;if (!key) return;
      const doc = structuredClone(/** @type {any} */ (ATELIER_APPROVED)[key]);doc.visualParameters = {...ATELIER_GAME_PARAMS[key]};
      copy(JSON.stringify(doc, null, 2) + '\n', `${key}.json`);
    };
    const w1 = el('button', {type: 'button', id: 'editor-save-move', class: 'primary', text: '💾 Gravar move.json no disco'});
    w1.onclick = () => saveFlow('moves', m.id, disk => buildMoveDoc(disk, /** @type {any} */ (C.world)[m.group] ?? {}), `src/sim/moves/${m.id}.move.json`);
    const w2 = el('button', {type: 'button', id: 'editor-save-visual', class: 'primary', text: '💾 Gravar visual aprovado no disco'});
    w2.onclick = () => {const key = m.visual?.atelier;if (!key) {status('Este Move não tem visual do atelier vinculado.');return;}saveFlow('approved', key, disk => buildVisualDoc(disk, ATELIER_GAME_PARAMS[key]), `prototypes/sand-stone-lab/approved/${key}.json`);};
    for (const b of [w1, w2]) if (!save?.available) {b.setAttribute('aria-disabled', 'true');b.title = 'Disponível só pelo servidor local (INICIAR_SERVIDOR.bat). Fora dele, use «Copiar».';}
    if (!m.visual?.atelier) w2.hidden = true;
    sec.append(el('div', {class: 'editor-actions'}, [w1, w2]), el('p', {class: 'hint', text: save?.available ? 'Servidor local ligado: gravar mostra as diferenças e pede confirmação; o jogo recarrega sozinho depois.' : 'Sem o servidor local não dá para gravar no disco: abra o laboratório por INICIAR_SERVIDOR.bat (veja docs/GRAVAR_NO_EDITOR.md). Enquanto isso, copie o JSON.'}), el('div', {class: 'editor-actions'}, [b1, b2]), el('p', {class: 'hint', text: 'Cole no arquivo do Move (src/sim/moves/…move.json) e em sand-stone-lab/approved/. Gravação direta no disco vem numa próxima fase.'}));
    return sec;
  }

  function render() {
    root.replaceChildren(stageSection(), analysisSection(), mechanicsSection(), visualSection(), vfxSection(), fichaSection(), exportSection());
    analyze();
  }
  render();
  tuning.onChange?.(() => {if (root.isConnected) scheduleAnalysis();});
  /** Abre o editor neste Move (usado pela vitrine da aba Moves). */
  function select(/** @type {string} */ id) {
    if (!editableMove(id)) return false;
    state.moveId = id;state.hold = suggestedHold(move());state.pinned = null;render();return true;
  }
  return {render, play, state, poll, analyze, select};
}
