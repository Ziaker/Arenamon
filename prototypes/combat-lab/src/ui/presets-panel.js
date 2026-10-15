// Aba Ajustes: biblioteca de presets (sensação, completos e por categoria), calibração simplificada (controles de alto
// impacto que editam os parâmetros OFICIAIS do laboratório), modo simples/avançado e comparação jogável A × B.
import {C} from '../sim/config.js';
import {BUILTIN_PRESETS, CATEGORIES, FEEL_CATEGORIES, categoryOf, categoryLabel, presetValues, applyPlan, migrateLegacyPreset, newPresetId, switchClass} from '../sim/presets.js';
import {ABSwitch, NEVER_SWITCHED} from '../sim/ab-switch.js';
import {standardSequence, runSequence, METRIC_LABELS} from '../sim/movement.js';
import {escape, pathGet} from './tuning.js';

const LEGACY_KEY = 'arenamon-lab-presets-v7';
const PI = Math.PI;
/**
 * Calibração simplificada. direct: um parâmetro oficial. macro: conjunto documentado de parâmetros, cada um com uma faixa
 * [em 0 %, em 100 %]; 50 % = padrão do laboratório. O valor mostrado é sempre derivado dos parâmetros reais (sem estado próprio).
 */
export const SIMPLE = [
  {id: 'walk', label: 'Velocidade de caminhada', path: () => `profiles.${['balanced', 'agile', 'resistant'][C.extras.gameModes.playerProfile | 0] || 'balanced'}.speed`, note: 'Do perfil do azul em uso. Também é a base da distância nominal de X e C (multiplicador × 0,4 s × velocidade) e do sprint (× multiplicador).'},
  {id: 'accel', label: 'Aceleração', path: 'locomotion.acceleration'},
  {id: 'brake', label: 'Frenagem', path: 'locomotion.braking'},
  {id: 'friction', label: 'Fricção', path: 'locomotion.friction'},
  {id: 'inertia', label: 'Intensidade da inércia', macro: [['locomotion.accelCurve', 0, .9], ['locomotion.brakeCurve', 0, .7], ['locomotion.residualSpeed', 0, .5]], note: 'Mais inércia: aproximação mais suave da velocidade máxima e deslizamento mais longo ao parar.'},
  {id: 'reversal', label: 'Resposta à inversão direcional', path: 'locomotion.reversal'},
  {id: 'turn', label: 'Velocidade de giro', macro: [['locomotion.turnRate', PI, 7 * PI], ['locomotion.visualTurnRate', 1.25 * PI, 8.75 * PI], ['locomotion.turnAcceleration', 20, 160]]},
  {id: 'sprint', label: 'Velocidade do sprint', path: 'actions.sprint.speedMultiplier'},
  {id: 'dodgeImpulse', label: 'Impulso do Dodge (C)', macro: [['actions.dodge.prepTime', .11, .01], ['actions.dodge.impulseTime', .22, .06], ['actions.dodge.prepSpeed', .15, .75]], note: 'Mais impulso: preparação mais curta e arranque mais forte. A distância total não muda.'},
  {id: 'dodgeDist', label: 'Distância do Dodge (C)', path: 'actions.dodge.distance', meters: 'dodge'},
  {id: 'dodgeDur', label: 'Duração do Dodge (C)', path: 'actions.dodge.duration'},
  {id: 'tackleImpulse', label: 'Impulso do Tackle (X)', macro: [['actions.tackle.prepTime', .11, .01], ['actions.tackle.impulseTime', .16, .04], ['actions.tackle.prepSpeed', .2, .8]], note: 'Mais impulso: preparação mais curta e arranque mais forte. A distância total não muda.'},
  {id: 'tackleDist', label: 'Distância do Tackle (X)', path: 'actions.tackle.distance', meters: 'tackle'},
  {id: 'tackleDur', label: 'Duração do Tackle (X)', path: 'actions.tackle.duration'},
  {id: 'fade', label: 'Tempo de transição das animações', macro: [['display.animation.fade', .02, .34], ['display.animation.actionFade', .02, .12]]},
  {id: 'impact', label: 'Intensidade visual dos impactos', macro: [['vfx.hit.intensity', 0, 2], ['vfx.clash.intensity', 0, 2.6], ['vfx.ground.intensity', 0, 2], ['vfx.shakeHit.intensity', 0, 2], ['vfx.shakeClash.intensity', 0, 2], ['vfx.shakeGround.intensity', 0, 2]], note: 'Só visual: efeitos e tremores de impacto, clash e queda.'},
];
/** Posição 0–1 de um macro a partir dos valores reais (média) e se os parâmetros divergem do conjunto documentado. */
export function macroState(def, get = p => pathGet(C, p)) {
  const ks = def.macro.map(([p, lo, hi]) => Math.max(0, Math.min(1, (get(p) - lo) / (hi - lo))));
  const k = ks.reduce((a, b) => a + b, 0) / ks.length;return {k, divergent: Math.max(...ks) - Math.min(...ks) > .02, ks};
}
export const macroValues = (def, k, byPath) => def.macro.map(([p, lo, hi]) => {const m = byPath.get(p), v = lo + (hi - lo) * k;return [p, m ? Math.max(m.min, Math.min(m.max, +v.toFixed(6))) : v];});

export function createPresetsPanel({tuning, $, game, download, onSaved = () => {}}) {
  const known = () => new Set(tuning.manifest.map(m => m.path));
  let user = loadLegacy(), ws = null, lastBefore = null, selected = BUILTIN_PRESETS[0].id;
  function loadLegacy() {try {return (JSON.parse(localStorage.getItem(LEGACY_KEY) || '[]') || []).map(migrateLegacyPreset);} catch {return [];}}
  const all = () => [...BUILTIN_PRESETS, ...user];
  const byId = id => all().find(p => p.id === id) ?? all().find(p => p.name === id);
  function persist() {
    if (ws) ws.set('presets', user);
    else try {localStorage.setItem(LEGACY_KEY, JSON.stringify(user));} catch {/* sem armazenamento: só nesta sessão */}
    onSaved();
  }
  /** Workspace aberto: presets passam a viver nele (os do formato antigo são migrados uma vez, sem apagar o original). */
  function attachWorkspace(w) {
    ws = w;
    if (Array.isArray(w.doc.presets)) user = w.doc.presets.map(migrateLegacyPreset);
    else {w.doc.presets = user;if (user.length) {w.notes?.push(`${user.length} preset(s) do formato antigo migrado(s) para o workspace.`);w.touch();}}
    render();
  }
  const fmt = (p, v) => {const m = tuning.byPath.get(p);return m && typeof v === 'number' ? m.fmt(v) : String(v ?? '—');};
  const valuesOf = id => id?.startsWith('__') ? tuning.valuesOf(id) : byId(id) ? presetValues(byId(id), known()) : {};
  const nameOf = id => ({__current: 'Ajustes atuais', __lab: 'Padrão do laboratório', __game: 'Jogo oficial'})[id] ?? byId(id)?.name ?? id;
  const options = (extra = true) => [...(extra ? [['__current', 'Ajustes atuais'], ['__lab', 'Padrão do laboratório'], ['__game', 'Jogo oficial']] : []), ...all().map(p => [p.id, p.name + (p.builtin ? ' (inicial)' : '')])];
  const fill = (sel, opts, fallback) => {const prev = sel.value;sel.replaceChildren(...opts.map(([v, t]) => new Option(t, v)));sel.value = opts.some(([v]) => v === prev) ? prev : fallback;};

  // ---------- Aplicação ----------
  function plan(preset) {return applyPlan(preset, tuning.snapshotValues(), known());}
  function applyPreset(preset, {label} = {}) {
    const changes = plan(preset);if (!changes.length) return 0;
    lastBefore = {name: preset.name, values: Object.fromEntries(changes.map(c => [c.path, c.from]))};
    ws?.addCalibration({label: `Antes de aplicar ${preset.name}`, values: tuning.snapshotValues(), kind: 'auto'});
    const n = tuning.commit(changes.map(c => [c.path, c.to]), label ?? 'Preset ' + preset.name);tuning.markSaved('preset ' + preset.name);
    render();return n;
  }
  function planHtml(changes) {
    const cats = {};for (const c of changes) (cats[c.category] ??= []).push(c);
    return `<p><b>${changes.length}</b> parâmetro(s) serão alterados:</p><ul class="plan-cats">${Object.entries(cats).map(([k, list]) => `<li>${escape(categoryLabel(k))}: ${list.length}</li>`).join('')}</ul>
      <details><summary>Ver valores</summary><table><tr><th>Parâmetro</th><th>Atual</th><th>Preset</th></tr>${changes.map(c => `<tr><td title="${c.path}">${escape(tuning.byPath.get(c.path)?.label ?? c.path)}</td><td>${fmt(c.path, c.from)}</td><td class="warn">${fmt(c.path, c.to)}</td></tr>`).join('')}</table></details>`;
  }

  // ---------- Biblioteca ----------
  function info(p) {
    const vals = presetValues(p, known()), cats = [...new Set(Object.keys(vals).map(categoryOf))];
    return `<p><b>${escape(p.name)}</b> · v${p.version ?? 1}${p.builtin ? ' · <span class="badge labonly">inicial (somente leitura)</span>' : ''}${p.migratedFrom ? ' · <span class="muted">migrado do formato antigo</span>' : ''}</p>
      ${p.description ? `<p class="hint">${escape(p.description)}</p>` : ''}
      <p class="muted">${p.scope === 'partial' ? 'Por categorias' : 'Completo'} · ${Object.keys(vals).length} parâmetros · ${cats.map(c => escape(categoryLabel(c))).join(' · ')}<br>Criado ${new Date(p.createdAt).toLocaleString('pt-BR')}${p.updatedAt && p.updatedAt !== p.createdAt ? ` · atualizado ${new Date(p.updatedAt).toLocaleString('pt-BR')}` : ''}</p>
      ${p.builtin ? '<p class="hint">Proposta para avaliação, não valores aprovados. Aplicar não substitui os parâmetros oficiais do jogo.</p>' : `<div class="row"><input type="text" id="preset-edit-name" value="${escape(p.name)}" maxlength="60" aria-label="Nome"><button type="button" id="preset-rename">Renomear</button></div>
      <label class="field">Descrição<textarea id="preset-edit-desc" rows="2">${escape(p.description || '')}</textarea></label>`}`;
  }
  function render() {
    const sel = $('preset-select');if (!sel) return;
    fill(sel, options(false), selected);if (byId(selected)) sel.value = selected;selected = sel.value;const p = byId(selected);
    $('preset-info').innerHTML = p ? info(p) : '';$('preset-plan').innerHTML = '';
    for (const id of ['preset-rename-btn', 'preset-update', 'preset-delete']) $(id) && ($(id).disabled = !p || !!p.builtin);
    $('preset-revert').disabled = !lastBefore;$('preset-revert').title = lastBefore ? `Volta os ${Object.keys(lastBefore.values).length} parâmetros alterados por “${lastBefore.name}”` : 'Nenhum preset aplicado nesta sessão';
    $('preset-rename')?.addEventListener('click', () => {
      const name = $('preset-edit-name').value.trim(), desc = $('preset-edit-desc').value;if (!name) return;
      if (all().some(x => x.name === name && x.id !== p.id)) {$('preset-plan').innerHTML = '<p class="warn">Já existe um preset com esse nome.</p>';return;}
      p.name = name;p.description = desc;p.updatedAt = new Date().toISOString();persist();render();
    });
    // Lista (aplicação rápida mostra quantos parâmetros mudariam).
    const box = $('preset-list');box.replaceChildren();
    for (const q of all()) {
      const n = plan(q).length, row = document.createElement('div');row.className = 'preset';row.dataset.preset = q.id;
      const name = document.createElement('span');name.textContent = `${q.name}${q.builtin ? ' (inicial)' : ''} · v${q.version ?? 1} · ${q.scope === 'partial' ? 'categorias' : 'completo'}`;name.title = q.description || q.name;
      const ap = document.createElement('button');ap.type = 'button';ap.textContent = n ? `Aplicar (${n})` : 'Em uso';ap.disabled = !n;ap.title = n ? `${n} parâmetro(s) mudariam` : 'Os valores atuais já são os deste preset';
      ap.onclick = () => {applyPreset(q);$('preset-plan').innerHTML = `<p class="ok">“${escape(q.name)}” aplicado: ${n} parâmetro(s). Ctrl+Z ou “↶ Restaurar estado anterior” desfazem.</p>`;};
      const pick = document.createElement('button');pick.type = 'button';pick.textContent = '…';pick.title = 'Selecionar para detalhes, renomear, duplicar ou comparar';pick.onclick = () => {selected = q.id;render();};
      row.append(name, ap, pick);box.append(row);
    }
    for (const id of ['preset-a', 'preset-b']) fill($(id), options(), id === 'preset-a' ? '__current' : '__lab');
    for (const id of ['ab-a', 'ab-b']) if ($(id)) fill($(id), options(), id === 'ab-a' ? BUILTIN_PRESETS[0].id : BUILTIN_PRESETS[2].id);
    renderAB();
  }
  function bind() {
    $('preset-select').onchange = e => {selected = e.target.value;render();};
    $('preset-apply').onclick = () => {
      const p = byId(selected), changes = plan(p);if (!changes.length) {$('preset-plan').innerHTML = '<p class="ok">Os valores atuais já são os deste preset.</p>';return;}
      $('preset-plan').innerHTML = planHtml(changes) + `<div class="row"><button type="button" class="primary" id="preset-confirm">Confirmar (${changes.length})</button><button type="button" id="preset-cancel">Cancelar</button></div>`;
      $('preset-confirm').onclick = () => {const n = applyPreset(p);$('preset-plan').innerHTML = `<p class="ok">“${escape(p.name)}” aplicado: ${n} parâmetro(s). Ctrl+Z ou “↶ Restaurar estado anterior” desfazem.</p>`;};
      $('preset-cancel').onclick = () => {$('preset-plan').innerHTML = '';};
    };
    $('preset-dup').onclick = () => {
      const p = byId(selected);let name = `${p.name} (cópia)`, n = 2;while (all().some(x => x.name === name)) name = `${p.name} (cópia ${n++})`;
      const now = new Date().toISOString(), copy = {...structuredClone(p), id: newPresetId(name), name, builtin: undefined, version: 1, createdAt: now, updatedAt: now, duplicatedFrom: p.name};
      delete copy.builtin;user.push(copy);selected = copy.id;persist();render();
    };
    $('preset-update').onclick = () => {
      const p = byId(selected);if (!p || p.builtin) return;
      const cur = tuning.snapshotValues(), vals = p.scope === 'partial' ? Object.fromEntries(Object.entries(cur).filter(([k]) => p.categories.includes(categoryOf(k)))) : cur;
      const changed = Object.keys(vals).filter(k => vals[k] !== p.values[k]).length;if (!changed) {$('preset-plan').innerHTML = '<p class="ok">O preset já tem os valores atuais.</p>';return;}
      p.values = vals;p.version = (p.version ?? 1) + 1;p.updatedAt = new Date().toISOString();persist();tuning.markSaved('preset ' + p.name);render();
      $('preset-plan').innerHTML = `<p class="ok">“${escape(p.name)}” atualizado para a v${p.version} (${changed} valor(es)).</p>`;
    };
    $('preset-delete').onclick = () => {const p = byId(selected);if (!p || p.builtin || !confirm(`Excluir o preset “${p.name}”?`)) return;user = user.filter(x => x.id !== p.id);selected = BUILTIN_PRESETS[0].id;persist();render();};
    $('preset-revert').onclick = () => {if (!lastBefore) return;const n = tuning.commit(Object.entries(lastBefore.values).filter(([, v]) => typeof v === 'number'), 'Restaurar antes de ' + lastBefore.name);$('preset-plan').innerHTML = `<p class="ok">${n} parâmetro(s) voltaram ao estado anterior a “${escape(lastBefore.name)}”.</p>`;lastBefore = null;render();};
    // Salvar como novo preset (completo ou por categorias).
    $('preset-cats').innerHTML = CATEGORIES.map(c => `<label class="check"><input type="checkbox" value="${c.id}" ${c.feel ? 'checked' : ''}> ${escape(c.label)}</label>`).join('');
    const scope = () => document.querySelector('input[name="preset-scope"]:checked')?.value ?? 'full';
    for (const r of document.querySelectorAll('input[name="preset-scope"]')) r.onchange = () => {$('preset-cats').hidden = scope() !== 'partial';};$('preset-cats').hidden = scope() !== 'partial';
    $('preset-save').onclick = () => {
      const name = $('preset-name').value.trim();if (!name) {$('preset-name').focus();return;}
      const sc = scope(), cats = [...$('preset-cats').querySelectorAll('input:checked')].map(i => i.value);
      if (sc === 'partial' && !cats.length) {$('preset-plan').innerHTML = '<p class="warn">Escolha ao menos uma categoria.</p>';return;}
      const cur = tuning.snapshotValues(), values = sc === 'partial' ? Object.fromEntries(Object.entries(cur).filter(([k]) => cats.includes(categoryOf(k)))) : cur, now = new Date().toISOString();
      const existing = user.find(p => p.name === name);
      if (existing) Object.assign(existing, {values, scope: sc, categories: sc === 'partial' ? cats : [], version: (existing.version ?? 1) + 1, updatedAt: now, description: $('preset-desc').value || existing.description});
      else user.push({id: newPresetId(name), name, version: 1, description: $('preset-desc').value, createdAt: now, updatedAt: now, scope: sc, categories: sc === 'partial' ? cats : [], values});
      selected = (existing ?? user.at(-1)).id;$('preset-name').value = '';$('preset-desc').value = '';persist();tuning.markSaved('preset ' + name);ws?.addCalibration({label: 'Preset salvo: ' + name, values: cur, kind: 'auto'});render();
    };
    $('preset-compare').onclick = compare;$('preset-measure').onclick = measure;
    // Modo simples/avançado.
    for (const b of document.querySelectorAll('[data-tune-mode-btn]')) b.onclick = () => setMode(b.dataset.tuneModeBtn);
    // A × B jogável.
    $('ab-start').onclick = () => ab.active ? stopAB() : startAB();
    for (const b of document.querySelectorAll('[data-ab-keep]')) b.onclick = () => stopAB(b.dataset.abKeep);
  }
  function compare() {
    const ia = $('preset-a').value, ib = $('preset-b').value, a = valuesOf(ia), b = valuesOf(ib);
    const rows = tuning.manifest.filter(m => m.path in a && m.path in b && Math.abs(a[m.path] - b[m.path]) > 1e-9);
    const onlyA = Object.keys(a).filter(p => !(p in b)).length, onlyB = Object.keys(b).filter(p => !(p in a)).length;
    $('preset-diff').innerHTML = (rows.length ? `<table><tr><th>Parâmetro</th><th>A</th><th>B</th></tr>${rows.map(m => `<tr><td title="${m.path}">${escape(m.label)}</td><td>${m.fmt(a[m.path])}</td><td>${m.fmt(b[m.path])}</td></tr>`).join('')}</table>` : '<p class="ok">Nenhuma diferença nos parâmetros em comum.</p>')
      + (onlyA || onlyB ? `<p class="hint">Fora da comparação: ${onlyA} parâmetro(s) só em A e ${onlyB} só em B (presets por categoria não definem os demais).</p>` : '');
  }
  /** Mede a sensação com a sequência padrão (mesmo estado inicial, mesmos comandos) para A e B. */
  function measure() {
    const ia = $('preset-a').value, ib = $('preset-b').value, seq = standardSequence();
    const ra = runSequence(seq, {values: valuesOf(ia)}).metrics, rb = runSequence(seq, {values: valuesOf(ib)}).metrics;
    const keys = ['timeToWalkSpeed', 'reversalToZero', 'reversalToSpeed', 'brakingTime', 'brakingDistance', 'maxWalkSpeed', 'maxSprintSpeed', 'dodgeDistance', 'tackleDistance', 'distance'];
    $('preset-diff').innerHTML = `<p>Sequência padrão (${escape(seq.label)}), mesmo estado inicial e mesmos comandos.</p><table><tr><th>Medida</th><th>A · ${escape(nameOf(ia))}</th><th>B · ${escape(nameOf(ib))}</th></tr>${keys.map(k => `<tr><td>${escape(METRIC_LABELS[k][0])}</td><td>${ra[k] ?? '—'} ${METRIC_LABELS[k][1]}</td><td class="${ra[k] !== rb[k] ? 'warn' : ''}">${rb[k] ?? '—'} ${METRIC_LABELS[k][1]}</td></tr>`).join('')}</table><p class="hint">Gráficos e mais medidas: Cenários › Gravador de movimento.</p>`;
    return {a: ra, b: rb};
  }

  // ---------- Calibração simplificada ----------
  function renderSimple() {
    const box = $('simple-controls');if (!box) return;box.replaceChildren();
    for (const def of SIMPLE) box.append(simpleRow(def));
  }
  function simpleRow(def) {
    const row = document.createElement('div');row.className = 'tune-control simple';row.dataset.simple = def.id;
    const isMacro = !!def.macro, path = isMacro ? null : typeof def.path === 'function' ? def.path() : def.path, m = path && tuning.byPath.get(path);
    const affected = isMacro ? def.macro.map(([p]) => p) : [path];
    row.innerHTML = `<div class="tune-top"><label for="simple-${def.id}">${escape(def.label)}</label><span class="tune-value" data-val></span></div>
      <input type="range" id="simple-${def.id}" ${isMacro ? 'min="0" max="1" step="0.01"' : `min="${m.min}" max="${m.max}" step="${m.step}"`} data-simple-input>
      <div class="tune-bottom"><span data-affects title="Parâmetros oficiais editados por este controle">${isMacro ? 'Edita: ' : ''}${affected.map(p => `<code>${p}</code>`).join(' ')}</span><span><button type="button" data-reset title="Padrão do laboratório">↺ lab</button></span></div>
      ${def.note ? `<p class="hint">${escape(def.note)}</p>` : ''}<p class="hint warn" data-div hidden>Os parâmetros deste conjunto foram ajustados individualmente (modo avançado); mover o controle realinha todos.</p>`;
    const input = row.querySelector('input'), out = row.querySelector('[data-val]');let before = null;
    const show = () => {
      if (isMacro) {const st = macroState(def);if (document.activeElement !== input) input.value = String(st.k);out.textContent = `${Math.round(st.k * 100)}% · ${def.macro.map(([p]) => fmt(p, pathGet(C, p))).join(' / ')}`;row.querySelector('[data-div]').hidden = !st.divergent;}
      else {const v = pathGet(C, path);if (document.activeElement !== input) input.value = String(v);out.textContent = fmt(path, v) + (def.meters ? ` (${(v * (C.actions[def.meters].distanceReference || C.actions[def.meters].duration) * C.profiles.balanced.speed).toFixed(2)} m no perfil equilibrado)` : '');}
      row.classList.toggle('changed', affected.some(p => Math.abs(pathGet(C, p) - tuning.byPath.get(p).initial) > 1e-9));
    };
    input.addEventListener('input', () => {
      const pairs = isMacro ? macroValues(def, Number(input.value), tuning.byPath) : [[path, Number(input.value)]];
      if (!before) before = Object.fromEntries(pairs.map(([p]) => [p, pathGet(C, p)]));tuning.setTransient(pairs);show();
    });
    input.addEventListener('change', () => {
      if (!before) return;const after = Object.keys(before).map(p => [p, pathGet(C, p)]);tuning.setTransient(Object.entries(before));before = null;
      tuning.commit(after, 'Calibração: ' + def.label);
    });
    row.querySelector('[data-reset]').onclick = () => tuning.commit(affected.map(p => [p, tuning.byPath.get(p).initial]), 'Padrão: ' + def.label);
    row.show = show;show();return row;
  }
  const refreshSimple = () => {for (const r of document.querySelectorAll('[data-simple]')) r.show?.();};
  tuning.onChange(() => {refreshSimple();if ($('preset-list') && !$('panel').hidden && $('panel').dataset.tool === 'tuning') renderListCounts();renderAB();});
  function renderListCounts() {for (const row of document.querySelectorAll('#preset-list [data-preset]')) {const p = byId(row.dataset.preset), n = p ? plan(p).length : 0, b = row.querySelector('button');b.textContent = n ? `Aplicar (${n})` : 'Em uso';b.disabled = !n;}}
  let mode = 'simple';
  function setMode(m) {
    mode = m === 'advanced' ? 'advanced' : 'simple';
    for (const b of document.querySelectorAll('[data-tune-mode-btn]')) b.setAttribute('aria-pressed', String(b.dataset.tuneModeBtn === mode));
    for (const el of document.querySelectorAll('[data-tune-mode]')) el.hidden = el.dataset.tuneMode !== mode;
    if (mode === 'simple') refreshSimple();else tuning.render();
  }

  // ---------- Comparação jogável A × B ----------
  const ab = new ABSwitch({get: p => pathGet(C, p), setTransient: pairs => tuning.setTransient(pairs)});
  let abInfo = null;
  function startAB() {
    const ia = $('ab-a').value, ib = $('ab-b').value;
    abInfo = ab.start({A: {name: nameOf(ia), values: valuesOf(ia)}, B: {name: nameOf(ib), values: valuesOf(ib)}}, {game, tick: game.tick});
    renderAB();return abInfo;
  }
  function stopAB(keep = 'baseline') {
    if (!ab.active) return;const label = keep === 'baseline' ? 'estado anterior' : `${keep} (${ab.names[keep]})`;
    const changes = ab.stop(keep);tuning.setTransient(Object.entries(ab.baseline));
    if (keep !== 'baseline') tuning.commit(changes, 'Comparação A × B: manter ' + label);
    abInfo = null;renderAB();
  }
  function toggleAB() {if (!ab.active) return null;const e = ab.toggle(game, game.tick);renderAB();return e;}
  function renderAB() {
    const st = ab.status, badge = $('ab-badge');
    if ($('ab-start')) {$('ab-start').textContent = st.active ? '■ Encerrar comparação' : '▶ Ativar comparação jogável';$('ab-keep').hidden = !st.active;$('ab-a').disabled = $('ab-b').disabled = st.active;}
    if (badge) {badge.hidden = !st.active;if (st.active) {badge.dataset.side = st.side;badge.innerHTML = `PRESET ${st.side} <small>${escape(st.name)}${st.pending ? ` · ${st.pending} parâmetro(s) aguardam o fim da ação` : ''}</small>`;}}
    const out = $('ab-status');if (!out) return;
    if (!st.active) {out.innerHTML = '<p class="hint">Escolha A e B e ative. A tecla de troca é configurável em Controles › Atalhos do laboratório.</p>';return;}
    // Lido do próprio ABSwitch (o plano de start() ainda não existe enquanto a primeira troca está sendo aplicada).
    const dif = ab.differing || [], live = dif.filter(p => ab.classes[p] === 'live').length, excl = ab.excluded || [];
    out.innerHTML = `<p><b>Ativa: PRESET ${st.side}</b> (${escape(st.name)}) · ${dif.length} parâmetro(s) diferentes entre A e B (${live} trocam na hora, ${dif.length - live} só fora de ações).</p>`
      + (excl.length ? `<p class="warn">Não são trocados durante a partida (exigem reiniciar ou mudariam o controle): ${excl.map(p => `<code>${p}</code>`).join(', ')}.</p>` : '')
      + `<p class="hint">Troque com a tecla <b>${escape(keyLabel())}</b>. Ao encerrar, escolha manter A, B ou voltar ao estado anterior.</p>`;
  }
  let abKey = 'KeyB';const keyLabel = () => abKey.replace(/^Key/, '').replace(/^Digit/, '');
  function setABKey(code) {abKey = code;renderAB();}

  bind();render();renderSimple();setMode('simple');
  return {render, renderSimple, attachWorkspace, valuesOf, nameOf, applyPreset, plan, byId, all, setMode, get mode() {return mode;}, compare, measure,
    ab, startAB, stopAB, toggleAB, setABKey, get abKey() {return abKey;},
    api: {list: () => structuredClone(user), saveAll: list => {user = list.map(migrateLegacyPreset);persist();render();return true;}}};
}
export {switchClass, NEVER_SWITCHED, FEEL_CATEGORIES};
