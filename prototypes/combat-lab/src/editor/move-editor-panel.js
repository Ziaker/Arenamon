// @ts-check
// Painel do Editor de Moves (fase 2): palco + play + sliders de um Move já migrado para move.json.
// Só interface: o cenário e os números vêm de move-editor-model.js; os sliders de mecânica são os MESMOS do ajustador (desfazer, presets, workspace);
// os de visual alteram, nesta sessão, os parâmetros aprovados do atelier que o jogo usa no próximo disparo.
import {escape} from '../ui/tuning.js';
import {controls as atelierControls, help as atelierHelp, phaseOf, phaseNames} from '../../../sand-stone-lab/src/config.ts';
import {ATELIER_APPROVED, ATELIER_GAME_PARAMS} from '../view/quarks/atelier-game-params.js';
import {EDITABLE_MOVES, editableMove} from './editable-moves.js';
import {traceMove, compareTraces, currentValues, defaultValues, diffCount} from './move-trace.js';
import {makeMoveScenario, currentMoveJson, TARGET_STATES, DEFAULT_STAGE, DISTANCE_RANGE, HOLD_RANGE, needsHold, suggestedHold, holdHint} from './move-editor-model.js';

/**
 * @param {{getWorld: () => any, $: (id: string) => any, tuning: any, startScenario: (def: any) => void, abortScenario: () => void, getScenario: () => any, getLastResult: () => any, seekToTime?: (seconds: number) => boolean, download: (data: string, name: string, type?: string) => void, setTimeScale: (v: number) => void}} deps
 */
export function createMoveEditor({getWorld, $, tuning, startScenario, abortScenario, getScenario, getLastResult, seekToTime, download, setTimeScale}) {
  const root = $('move-editor-body');
  const state = {moveId: (EDITABLE_MOVES.find(m => m.id === 'sand-wave') ?? EDITABLE_MOVES[0]).id, distance: DEFAULT_STAGE.distance, target: DEFAULT_STAGE.target, hold: 0, loop: false, speed: 1, running: false, pinned: /** @type {Record<string, number> | null} */ (null)};
  const move = () => /** @type {any} */ (editableMove(state.moveId));
  const el = (/** @type {string} */ tag, /** @type {Record<string, any>} */ attrs = {}, /** @type {(Node | string)[]} */ kids = []) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) k === 'class' ? (e.className = v) : k === 'text' ? (e.textContent = v) : e.setAttribute(k, String(v));
    e.append(...kids);return e;
  };
  const status = (/** @type {string} */ t) => {const s = $('editor-status');if (s) s.textContent = t;};

  function play() {
    abortScenario();
    const def = makeMoveScenario(move(), {distance: state.distance, target: state.target, hold: needsHold(move()) ? state.hold : 0});
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
    const distOut = el('output', {text: `${state.distance} m`});
    dist.oninput = () => {state.distance = Number(dist.value);distOut.textContent = `${state.distance} m`;scheduleAnalysis();};
    const holdRow = needsHold(move()) ? [(() => {
      const hold = /** @type {HTMLInputElement} */ (el('input', {type: 'range', id: 'editor-hold', min: HOLD_RANGE.min, max: HOLD_RANGE.max, step: HOLD_RANGE.step, value: state.hold || suggestedHold(move())}));
      const out = el('output', {text: `${(+hold.value).toFixed(2)} s`});
      state.hold = Number(hold.value);
      hold.oninput = () => {state.hold = Number(hold.value);out.textContent = `${state.hold.toFixed(2)} s`;scheduleAnalysis();};
      return el('label', {class: 'editor-row', title: holdHint(move())}, [el('span', {text: 'Segurar o botão'}), hold, out]);
    })(), el('p', {class: 'hint', text: holdHint(move())})] : [];
    const tgt = /** @type {HTMLSelectElement} */ (el('select', {id: 'editor-target'}, TARGET_STATES.map(([v, l]) => el('option', {value: v, text: l}))));
    tgt.value = state.target;tgt.onchange = () => {state.target = tgt.value;scheduleAnalysis();};
    const spd = /** @type {HTMLSelectElement} */ (el('select', {id: 'editor-speed'}, [['1', 'Normal'], ['0.5', 'Câmera lenta (0,5×)'], ['0.25', 'Muito lenta (0,25×)']].map(([v, l]) => el('option', {value: v, text: l}))));
    spd.value = String(state.speed);spd.onchange = () => {state.speed = Number(spd.value);setTimeScale(state.speed);};
    const loop = /** @type {HTMLInputElement} */ (el('input', {type: 'checkbox', id: 'editor-loop'}));
    loop.checked = state.loop;loop.onchange = () => {state.loop = loop.checked;};
    const playBtn = el('button', {type: 'button', id: 'editor-play', class: 'primary', text: '▶ Executar'});playBtn.onclick = play;
    const stopBtn = el('button', {type: 'button', id: 'editor-stop', text: '■ Parar'});
    stopBtn.onclick = () => {state.loop = false;loop.checked = false;abortScenario();state.running = false;status('Parado.');};
    sec.append(
      el('label', {class: 'editor-row'}, [el('span', {text: 'Move'}), sel]),
      el('label', {class: 'editor-row'}, [el('span', {text: 'Distância do alvo'}), dist, distOut]),
      el('label', {class: 'editor-row'}, [el('span', {text: 'Alvo'}), tgt]),
      ...holdRow,
      el('label', {class: 'editor-row'}, [el('span', {text: 'Velocidade'}), spd]),
      el('label', {class: 'editor-row check'}, [loop, el('span', {text: 'Repetir em laço'})]),
      el('div', {class: 'editor-actions'}, [playBtn, stopBtn]),
      el('p', {id: 'editor-status', class: 'hint', text: 'Pronto. «Executar» roda o Move de verdade na arena, com os valores abaixo.'}),
      el('div', {id: 'editor-result'}),
    );
    return sec;
  }

  const UNIT = {num: '', int: '', sec: 's', pct: '%', m: 'm', ms: 'm/s', ms2: 'm/s²', deg: '°', x: '×', yesno: ''};
  const show = (/** @type {number} */ v, /** @type {string} */ unit) => unit === 'pct' ? `${+(v * 100).toFixed(1)} %` : `${+(+v).toFixed(3)} ${UNIT[/** @type {keyof typeof UNIT} */ (unit)] ?? ''}`.trim();
  /** Sliders de mecânica: gravam em C.world[grupo][chave] como a aba Moves (arrastar = prévia; soltar = UMA entrada no histórico, Ctrl+Z desfaz). */
  // ---------- Análise: linha do tempo, números e comparação A × B ----------
  const stageOf = () => ({distance: state.distance, target: state.target, hold: needsHold(move()) ? state.hold : 0});
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

  function mechanicsSection() {
    const m = move();
    const world = /** @type {any} */ (tuning.world ?? null);
    const sec = el('section', {class: 'editor-sec'}, [el('h4', {text: 'Mecânica'}), el('p', {class: 'hint', text: 'Valem no próximo uso (Ctrl+Z desfaz). «↺» volta ao valor padrão do Move.'})]);
    const box = el('div', {id: 'editor-mechanics'});
    const sync = [];
    for (const r of m.params.rows) {
      if (String(r.key).startsWith('hitShake')) continue;
      const path = `world.${m.group}.${r.key}`;
      const get = () => getWorld()[m.group][r.key];
      const isToggle = r.min === 0 && r.max === 1 && r.step === 1;
      const input = /** @type {HTMLInputElement} */ (el('input', isToggle ? {type: 'checkbox', 'data-path': path} : {type: 'range', 'data-path': path, min: r.min, max: r.max, step: r.step}));
      const out = el('output', {text: ''});
      const refresh = () => {const v = get();if (isToggle) input.checked = !!v;else input.value = String(v);out.textContent = isToggle ? (v ? 'sim' : 'não') : show(v, r.unit);row.classList.toggle('changed', v !== r.value);};
      let before = null;
      input.oninput = () => {if (isToggle) return;if (before === null) before = get();getWorld()[m.group][r.key] = Number(input.value);out.textContent = show(Number(input.value), r.unit);};
      input.onchange = () => {
        const after = isToggle ? (input.checked ? 1 : 0) : Number(input.value), was = before ?? get();before = null;
        if (isToggle) getWorld()[m.group][r.key] = was;else getWorld()[m.group][r.key] = was;
        if (was !== after) tuning.commit([[path, after]], r.label);refresh();
      };
      const reset = el('button', {type: 'button', class: 'mini', title: 'Voltar ao padrão', text: '↺'});
      reset.onclick = () => {if (get() !== r.value) tuning.commit([[path, r.value]], 'Restaurar ' + r.label);refresh();};
      const row = el('label', {class: 'editor-row', title: r.tip}, [el('span', {text: r.label}), input, out, reset]);
      sync.push(refresh);refresh();box.append(row);
    }
    tuning.onChange?.(() => { if (box.isConnected) for (const f of sync) f(); });
    sec.append(box);return sec;
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
      input.oninput = () => {ATELIER_GAME_PARAMS[key][k] = Number(input.value);out.textContent = `${+(+input.value).toFixed(3)} ${unit}`;};
      det.append(el('label', {class: 'editor-row', title: /** @type {any} */ (atelierHelp)?.[k] ?? ''}, [el('span', {text: label}), input, out]));
    }
    sec.append(det);return sec;
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
    sec.append(el('div', {class: 'editor-actions'}, [b1, b2]), el('p', {class: 'hint', text: 'Cole no arquivo do Move (src/sim/moves/…move.json) e em sand-stone-lab/approved/. Gravação direta no disco vem numa próxima fase.'}));
    return sec;
  }

  function render() {
    root.replaceChildren(stageSection(), analysisSection(), mechanicsSection(), visualSection(), exportSection());
    analyze();
  }
  render();
  tuning.onChange?.(() => {if (root.isConnected) scheduleAnalysis();});
  return {render, play, state, poll, analyze};
}
