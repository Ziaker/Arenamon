// Ajustador: todos os parâmetros numéricos do laboratório, agrupados em abas, com busca, filtros
// (alterados / diferentes do jogo / só do laboratório), desfazer/refazer, presets, comparação de presets,
// exportação/importação versionada e relatório de diferenças em relação ao config.ts do jogo.
import {C, ROOT_KEYS, defaults, resetConfig} from '../sim/config.js';
import {AI_MODES} from '../sim/ai.js';
import {NAMES, SECTIONS, TOOLTIPS, KEY_HELP} from './tuning-meta.js';
import {OFFICIAL} from './official.js';

const $ = id => document.getElementById(id);
export const pathGet = (root, path) => path.split('.').reduce((a, k) => a?.[k], root);
export const pathSet = (root, path, value) => {const keys = path.split('.'), last = keys.pop();const obj = keys.reduce((a, k) => a?.[k], root);if (!obj || !(last in obj)) return false;obj[last] = value;return true;};
const TABS = [
  ['Combate', ['Regras de ação e stamina', 'Knockback e clash', 'Combate e colisões']],
  ['Atributos', ['Atributos: equilibrado', 'Atributos: ágil', 'Atributos: resistente']],
  ['Movimento', ['Movimento']], ['Câmera', ['Câmera', 'Câmera: ajustes avançados']], ['IA', ['IA: estratégia e decisões', 'IA: personalidade do vermelho', 'IA: personalidade do azul (IA jogador)']], ['Arena', ['Arena e simulação']],
  ['Visual', ['Renderizador e personagens', 'Efeitos e feedback', 'HUD e visualização', 'Cores: canais RGB individuais']],
  ['Sistemas', ['Ativar ou desativar sistemas', 'Modos de jogo', 'Teclas: índices configuráveis']],
];
const COLOR_NAMES = {player: 'Jogador azul', enemy: 'Adversário vermelho', floor: 'Piso', wall: 'Paredes', background: 'Fundo', gridMajor: 'Grid principal', gridMinor: 'Grid secundário', impact: 'Impacto', clash: 'Clash', landing: 'Poeira ao aterrissar', partial: 'Defesa parcial', perfect: 'Defesa perfeita', invulnerable: 'Invulnerabilidade', shadow: 'Sombra', arrow: 'Seta frontal', arrowGuard: 'Seta defendendo', defeated: 'Derrotado', glowGuard: 'Brilho da defesa', glowInvuln: 'Brilho da invulnerabilidade', glowRecoil: 'Brilho de recuo', glowTackle: 'Brilho de tackle'};
const SAFE_MIN = {'rules.dodge': .05, 'rules.tackleDuration': .05, 'rules.recoil': .05, 'rules.regenTime': .1, 'rules.launchGravity': .5, 'rules.staminaMax': .1, 'test.contactStep': .01, 'test.halfExtent': .1, 'test.attackReference': .01, 'test.speedReference': .01,
  'test.defenseMedian': .01, 'camera.minDistance': .1, 'camera.maxDistance': .2, 'extras.cameraExtra.nearClip': .01, 'extras.combat.launchAttackReference': .01, 'extras.ai.evadeCycle': 1, 'extras.fx.impactDuration': .02,
  'extras.fx.clashDuration': .02, 'extras.visual.bodyWidth': .1, 'extras.visual.bodyHeight': .1, 'extras.visual.bodyDepth': .1, 'profiles.balanced.hp': 1, 'profiles.agile.hp': 1, 'profiles.resistant.hp': 1, 'test.hp': 1};
const RADIANS = ['steerLimit', 'steerRate', 'guardTurn', 'guardAcceleration', 'turnRate', 'visualTurnRate', 'maxTurnRate', 'deadZone', 'movingDeadZone', 'initialYaw', 'forwardTolerance'];
const INTEGERS = ['staminaMax', 'hp', 'attack', 'defense', 'attackReference', 'speedReference', 'defenseMedian', 'contactProjectionPasses', 'impactCount', 'clashCount', 'landingCount', 'evadeCycle', 'evadeCycleIndex', 'noticeFontSize', 'clashNoticeFontSize', 'debugFontSize', 'footerFontSize'];
const toggled = key => key.startsWith('enable') || ['fxVisible', 'hudVisible', 'debugVisible', 'showHitboxes', 'showAttackVectors'].includes(key);
const PROFILE_LABEL = ['Equilibrado', 'Ágil', 'Resistente'];

/** Faixa, passo e formato de cada parâmetro (regras do ajustador v6). */
function range(key, value, path) {
  const parent = path.split('.').slice(0, -1).join('.');
  if (parent === 'extras.bindings') return {min: 0, max: C.extras.keyCodes.length - 1, step: 1, fmt: n => C.extras.keyCodes[n] ?? '?'};
  if (parent === 'extras.colors') return {min: 0, max: 255, step: 1, fmt: n => String(n)};
  if (parent === 'extras.gameModes') return key === 'enemyMode' ? {min: 0, max: AI_MODES.length - 1, step: 1, fmt: n => AI_MODES[n]?.[1] ?? '?'} : {min: 0, max: 2, step: 1, fmt: n => PROFILE_LABEL[n] ?? '?'};
  if (toggled(key)) return {min: 0, max: 1, step: 1, fmt: n => n ? 'Ligado' : 'Desligado'};
  if (RADIANS.includes(key)) {const max = key === 'initialYaw' ? 360 : /rate/i.test(key) || key === 'guardTurn' || key === 'guardAcceleration' ? 1440 : 180;return {min: 0, max: max * Math.PI / 180, step: Math.PI / 180, fmt: n => (n * 180 / Math.PI).toFixed(0) + '°'};}
  // Durações que podem vir das animações: até 4 s para caber clips longos.
  if (['dodge', 'tackleDuration', 'recoil', 'guardStun', 'landingRecovery', 'invulnerable'].includes(key) && path.startsWith('rules.')) return {min: 0, max: 4, step: .01, fmt: n => n.toFixed(2) + ' s'};
  if (key === 'epsilon') return {min: 0, max: .000001, step: .000000001, fmt: n => n.toExponential(2)};
  if (key === 'step') return {min: 1 / 240, max: 1 / 30, step: 1 / 24000, fmt: n => (1000 * n).toFixed(2) + ' ms'};
  if (key === 'arenaHalf') return {min: 6, max: 100, step: 1, fmt: n => (n * 2) + ' × ' + (n * 2) + ' m'};
  if (INTEGERS.includes(key)) {const upper = key === 'staminaMax' ? 12 : key === 'contactProjectionPasses' ? 10 : key === 'evadeCycle' || key === 'evadeCycleIndex' ? 12 : /Count$/.test(key) ? 64 : key.endsWith('Size') ? 56 : key === 'hp' ? 800 : 200;return {min: key === 'contactProjectionPasses' ? 1 : 0, max: upper, step: 1, fmt: n => String(n)};}
  if (['invulnRepeatDelay', 'impactNoticeMs', 'clashNoticeMs', 'invulnNoticeMs'].includes(key)) return {min: 0, max: 5000, step: 10, fmt: n => n + ' ms'};
  if (key === 'fov') return {min: 20, max: 120, step: 1, fmt: n => n + '°'};
  if (key === 'farClip') return {min: 10, max: 1000, step: 5, fmt: n => n + ' m'};
  if (key === 'renderPixelRatio') return {min: .5, max: 3, step: .1, fmt: n => n.toFixed(1) + '×'};
  if (key === 'fpsSmoothing') return {min: .01, max: .5, step: .01, fmt: n => n.toFixed(2)};
  if (key === 'speed' || key.endsWith('Speed')) return {min: .01, max: 30, step: .01, fmt: n => n.toFixed(2)};
  if (['launchGravity', 'launchHorizontal', 'clashHorizontal', 'clashUp', 'launchUp'].includes(key)) return {min: 0, max: 60, step: .1, fmt: n => n.toFixed(1)};
  if (['reversal', 'acceleration', 'braking'].includes(key)) return {min: 0, max: 400, step: 1, fmt: n => String(n)};
  if (['lightX', 'lightY', 'lightZ'].includes(key)) return {min: -30, max: 30, step: .5, fmt: n => n.toFixed(1)};
  if (key === 'gridDivisions') return {min: 2, max: 100, step: 1, fmt: n => String(n)};
  if (/Fraction|Multiplier|Restitution|Scale|Weight|Base$|Opacity|Strength|Smoothing|Alignment|Dot$|Visible$/.test(key)) return {min: /Alignment|Dot/.test(key) ? -1 : 0, max: key === 'uiScale' ? 3 : 2, step: .01, fmt: n => n.toFixed(2)};
  const s = Math.abs(value), max = s >= 50 ? s * 3 : s >= 10 ? s * 4 : s >= 1 ? Math.max(10, s * 4) : s >= .1 ? Math.max(2, s * 5) : Math.max(.5, s * 8), step = s >= 20 ? .5 : s >= 1 ? .05 : s >= .1 ? .01 : .001;
  return {min: 0, max: Math.ceil(max / step) * step, step, fmt: n => n.toFixed(step >= .5 ? 1 : step >= .01 ? 2 : 3)};
}
function help(path, label) {
  const parts = path.split('.'), key = parts.at(-1);
  if (path.startsWith('extras.colors.')) return `Canal ${({R: 'vermelho', G: 'verde', B: 'azul'})[key.slice(-1)]} (0–255) da cor “${label}”. Não modifica a física.`;
  if (path.startsWith('extras.bindings.')) return `Tecla física que executa ${KEY_HELP[key] || key}. Evite atribuir a mesma tecla a comandos diferentes.`;
  if (path.startsWith('profiles.')) return `Perfil ${({balanced: 'equilibrado', agile: 'ágil', resistant: 'resistente'})[parts[1]]}: ${({attack: 'dano base de um tackle sem defesa; também influencia a força do lançamento.', defense: 'resistência legada a empurrões; não torna invulnerável.', speed: 'velocidade ao caminhar e referência da distância nominal de X/C.', hp: 'vida máxima.'})[key]}`;
  if (path === 'extras.gameModes.enemyMode') return 'Comportamento do adversário vermelho. Inclui os quatro modos do v6 e os modos de dummy do laboratório.';
  return TOOLTIPS[key] || 'Parâmetro do laboratório.';
}
/** Valor do jogo oficial para um caminho (ou undefined se o parâmetro não existe no jogo). */
export function officialValue(path) {
  const [root, ...rest] = path.split('.');
  if (root === 'extras') return undefined;
  return pathGet(OFFICIAL[root], rest.join('.'));
}
const same = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

export function createTuning({apply}) {
  const base = defaults(), manifest = [];
  for (const [section, rootPath, subset] of SECTIONS) {
    const root = pathGet(C, rootPath);
    for (const key of subset ?? Object.keys(root)) {
      const v = root[key];if (typeof v !== 'number') continue;
      const path = rootPath + '.' + key, r = range(key, v, path);
      r.min = Math.max(r.min, SAFE_MIN[path] ?? -Infinity);r.min = Math.min(r.min, v);r.max = Math.max(r.max, v);
      const label = path.startsWith('extras.colors.') ? (COLOR_NAMES[key.slice(0, -1)] || key) + ' · ' + ({R: 'Vermelho', G: 'Verde', B: 'Azul'})[key.slice(-1)] : path === 'extras.bindings.dodge' ? 'Tecla de esquiva (C)' : NAMES[key] || key;
      manifest.push({section, path, key, label, help: help(path, label), initial: pathGet(base, path), official: officialValue(path), ...r});
    }
  }
  const byPath = new Map(manifest.map(m => [m.path, m]));
  const state = {tab: TABS[0][0], filter: 'all', undo: [], redo: [], saved: snapshotValues(), savedLabel: 'padrão', listeners: new Set()};
  function snapshotValues() {return Object.fromEntries(manifest.map(m => [m.path, pathGet(C, m.path)]));}
  const status = m => {const v = pathGet(C, m.path);return m.official === undefined ? 'lab' : same(v, m.official) ? 'official' : 'experimental';};
  const changed = m => !same(pathGet(C, m.path), m.initial);
  function emit() {for (const fn of state.listeners) fn();}
  /** Aplica um conjunto de mudanças como uma única entrada de histórico. */
  function commit(changes, label) {
    const real = changes.filter(([p, v]) => !same(pathGet(C, p), v)).map(([p, v]) => [p, pathGet(C, p), v]);
    if (!real.length) return 0;
    for (const [p, , v] of real) pathSet(C, p, v);
    state.undo.push({label, changes: real});state.redo.length = 0;if (state.undo.length > 300) state.undo.shift();
    apply();render();emit();return real.length;
  }
  function undo() {const e = state.undo.pop();if (!e) return;for (const [p, before] of e.changes) pathSet(C, p, before);state.redo.push(e);apply();render();emit();}
  function redo() {const e = state.redo.pop();if (!e) return;for (const [p, , after] of e.changes) pathSet(C, p, after);state.undo.push(e);apply();render();emit();}
  const dirty = () => manifest.some(m => !same(pathGet(C, m.path), state.saved[m.path]));
  function markSaved(label) {state.saved = snapshotValues();state.savedLabel = label;emit();}

  // ---------- Interface ----------
  const tip = $('help-tip');
  function showTip(m, el) {tip.replaceChildren();const t = document.createElement('strong');t.textContent = m.label;const b = document.createElement('span');b.textContent = m.help;const c = document.createElement('code');c.textContent = m.path + (m.official !== undefined ? ` · jogo: ${m.fmt(m.official)}` : ' · não existe no jogo');tip.append(t, b, c);tip.hidden = false;const r = el.getBoundingClientRect(), w = tip.getBoundingClientRect().width;tip.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.right - w)) + 'px';const h = tip.getBoundingClientRect().height;tip.style.top = (r.top - h - 8 > 8 ? r.top - h - 8 : r.bottom + 8) + 'px';}
  const hideTip = () => {tip.hidden = true;};
  function renderTabs() {
    const box = $('tune-tabs');box.replaceChildren();
    for (const [name, sections] of TABS) {
      const n = manifest.filter(m => sections.includes(m.section) && visible(m)).length, b = document.createElement('button');b.type = 'button';b.role = 'tab';
      b.textContent = `${name} · ${n}`;b.setAttribute('aria-pressed', String(state.tab === name));b.onclick = () => {state.tab = name;render();};box.append(b);
    }
  }
  function visible(m) {
    const q = $('tune-search').value.trim().toLowerCase();
    if (q && !(m.label + ' ' + m.path + ' ' + m.help + ' ' + m.section).toLowerCase().includes(q)) return false;
    return state.filter === 'all' || (state.filter === 'changed' ? changed(m) : status(m) === state.filter);
  }
  function render() {
    renderTabs();const list = $('tune-list');list.replaceChildren();const q = $('tune-search').value.trim();
    const sections = q || state.filter !== 'all' ? TABS.flatMap(([, s]) => s) : TABS.find(([n]) => n === state.tab)[1];
    let total = 0;
    for (const section of sections) {
      const members = manifest.filter(m => m.section === section && visible(m));if (!members.length) continue;total += members.length;
      const group = document.createElement('div');group.className = 'tune-group';
      const head = document.createElement('header');const title = document.createElement('span');title.textContent = section;
      const reset = document.createElement('button');reset.type = 'button';reset.textContent = '↺ grupo';reset.title = 'Restaurar este grupo aos padrões do laboratório';
      reset.onclick = () => commit(members.map(m => [m.path, m.initial]), 'Restaurar ' + section);
      head.append(title, reset);group.append(head);
      for (const m of members) group.append(control(m));
      list.append(group);
    }
    if (!total) {const p = document.createElement('p');p.className = 'hint';p.textContent = 'Nenhum parâmetro neste filtro.';list.append(p);}
    $('tune-counter').textContent = `${total} de ${manifest.length} · ${manifest.filter(m => status(m) === 'experimental').length} ≠ jogo`;
    $('tune-undo').disabled = !state.undo.length;$('tune-redo').disabled = !state.redo.length;
    $('tune-undo').title = state.undo.length ? 'Desfazer: ' + state.undo.at(-1).label : 'Nada para desfazer';$('tune-redo').title = state.redo.length ? 'Refazer: ' + state.redo.at(-1).label : 'Nada para refazer';
  }
  function control(m) {
    const v = pathGet(C, m.path), row = document.createElement('div');row.className = 'tune-control' + (changed(m) ? ' changed' : '');
    const top = document.createElement('div');top.className = 'tune-top';
    const id = 'tune-' + m.path.replaceAll('.', '-'), label = document.createElement('label');label.htmlFor = id;label.textContent = m.label;
    const q = document.createElement('button');q.type = 'button';q.className = 'tune-help';q.textContent = '?';q.setAttribute('aria-label', 'Explicação: ' + m.label);
    q.onpointerenter = () => showTip(m, q);q.onpointerleave = hideTip;q.onfocus = () => showTip(m, q);q.onblur = hideTip;
    const st = status(m), badge = document.createElement('span');badge.className = 'badge ' + st;
    badge.textContent = st === 'official' ? 'jogo' : st === 'experimental' ? '≠ jogo' : 'lab';
    badge.title = st === 'official' ? 'Igual ao config.ts do jogo' : st === 'experimental' ? `Difere do jogo (jogo: ${m.fmt(m.official)})` : 'Existe só no laboratório';
    const value = document.createElement('span');value.className = 'tune-value';value.textContent = m.fmt(v);
    top.append(label, q, badge, value);
    const slider = document.createElement('input');slider.type = 'range';slider.id = id;slider.min = m.min;slider.max = m.max;slider.step = m.step;slider.value = v;slider.setAttribute('aria-describedby', id + '-d');
    let before = null;
    slider.addEventListener('input', () => {if (before === null) before = pathGet(C, m.path);const n = Math.max(m.min, Math.min(m.max, Number(slider.value)));pathSet(C, m.path, n);value.textContent = m.fmt(n);apply();});
    slider.addEventListener('change', () => {const after = pathGet(C, m.path);if (before !== null && !same(before, after)) {pathSet(C, m.path, before);commit([[m.path, after]], m.label);}before = null;});
    const bottom = document.createElement('div');bottom.className = 'tune-bottom';const code = document.createElement('span');code.id = id + '-d';code.textContent = m.path;
    const actions = document.createElement('span');
    const reset = document.createElement('button');reset.type = 'button';reset.textContent = '↺ lab';reset.title = 'Padrão do laboratório: ' + m.fmt(m.initial);reset.disabled = !changed(m);reset.onclick = () => commit([[m.path, m.initial]], 'Restaurar ' + m.label);
    actions.append(reset);
    if (st === 'experimental') {const g = document.createElement('button');g.type = 'button';g.textContent = '= jogo';g.title = 'Usar o valor do jogo: ' + m.fmt(m.official);g.onclick = () => commit([[m.path, m.official]], 'Valor do jogo: ' + m.label);actions.append(g);}
    bottom.append(code, actions);row.append(top, slider, bottom);return row;
  }
  $('tune-search').addEventListener('input', () => {hideTip();render();});
  for (const b of document.querySelectorAll('[data-filter]')) b.onclick = () => {state.filter = b.dataset.filter;for (const x of document.querySelectorAll('[data-filter]')) x.setAttribute('aria-pressed', String(x === b));render();};
  $('tune-undo').onclick = undo;$('tune-redo').onclick = redo;
  $('tune-list').addEventListener('scroll', hideTip, {passive: true});

  // ---------- Presets (guardados neste navegador) ----------
  const KEY = 'arenamon-lab-presets-v7';
  const loadPresets = () => {try {return JSON.parse(localStorage.getItem(KEY) || '[]');} catch {return [];}};
  const savePresets = list => {try {localStorage.setItem(KEY, JSON.stringify(list));return true;} catch {return false;}};
  function renderPresets() {
    const list = loadPresets(), box = $('preset-list');box.replaceChildren();
    if (!list.length) {const p = document.createElement('p');p.className = 'hint';p.textContent = 'Nenhum preset salvo. Os presets ficam neste navegador; exporte o JSON para guardar um arquivo.';box.append(p);}
    for (const p of list) {
      const row = document.createElement('div');row.className = 'preset';const name = document.createElement('span');name.textContent = `${p.name} · ${Object.keys(p.values).length} valores · ${new Date(p.savedAt).toLocaleString('pt-BR')}`;
      const load = document.createElement('button');load.type = 'button';load.textContent = 'Carregar';load.onclick = () => {commit(Object.entries(p.values).filter(([k]) => byPath.has(k)), 'Preset ' + p.name);markSaved('preset ' + p.name);};
      const del = document.createElement('button');del.type = 'button';del.textContent = '×';del.title = 'Excluir preset';del.onclick = () => {savePresets(loadPresets().filter(x => x.name !== p.name));renderPresets();};
      row.append(name, load, del);box.append(row);
    }
    for (const id of ['preset-a', 'preset-b']) {const sel = $(id), prev = sel.value;sel.replaceChildren(new Option('Ajustes atuais', '__current'), new Option('Padrão do laboratório', '__lab'), new Option('Jogo oficial', '__game'), ...list.map(p => new Option(p.name, p.name)));sel.value = [...sel.options].some(o => o.value === prev) ? prev : id === 'preset-a' ? '__current' : '__lab';}
  }
  $('preset-save').onclick = () => {
    const name = $('preset-name').value.trim();if (!name) {$('preset-name').focus();return;}
    const list = loadPresets().filter(p => p.name !== name);list.push({name, savedAt: Date.now(), values: snapshotValues()});
    if (!savePresets(list)) {$('preset-diff').textContent = 'Não foi possível salvar: armazenamento do navegador indisponível.';return;}
    $('preset-name').value = '';markSaved('preset ' + name);renderPresets();
  };
  const valuesOf = id => id === '__current' ? snapshotValues() : id === '__lab' ? Object.fromEntries(manifest.map(m => [m.path, m.initial])) : id === '__game' ? Object.fromEntries(manifest.filter(m => m.official !== undefined).map(m => [m.path, m.official])) : loadPresets().find(p => p.name === id)?.values || {};
  $('preset-compare').onclick = () => {
    const a = valuesOf($('preset-a').value), b = valuesOf($('preset-b').value), rows = manifest.filter(m => m.path in a && m.path in b && !same(a[m.path], b[m.path]));
    $('preset-diff').innerHTML = rows.length ? `<table><tr><th>Parâmetro</th><th>A</th><th>B</th></tr>${rows.map(m => `<tr><td title="${m.path}">${escape(m.label)}</td><td>${m.fmt(a[m.path])}</td><td>${m.fmt(b[m.path])}</td></tr>`).join('')}</table>` : '<p class="ok">Nenhuma diferença nos parâmetros em comum.</p>';
  };

  // ---------- JSON ----------
  function exportData() {
    const values = Object.fromEntries(ROOT_KEYS.map(k => [k, structuredClone(C[k])]));
    return {schema: 'arenamon-tuning', version: 7, source: 'arenamon-combate-laboratorio-v7.html', createdAt: new Date().toISOString(), values,
      changedFromLabDefaults: manifest.filter(changed).map(m => ({path: m.path, lab: m.initial, value: pathGet(C, m.path)})),
      differencesFromGame: manifest.filter(m => status(m) === 'experimental').map(m => ({path: m.path, game: m.official, lab: pathGet(C, m.path)})),
      labOnlyParameters: manifest.filter(m => m.official === undefined).length,
      note: 'Valores do laboratório. Nada é aplicado ao jogo automaticamente; use differencesFromGame para decidir o que levar ao config.ts.'};
  }
  /** Valida sem aplicar. Aceita JSON v5/v6 ({values}) e v7. */
  function preview(raw) {
    let data;try {data = JSON.parse(raw);} catch (e) {return {error: 'JSON inválido: ' + e.message};}
    const values = data?.values ?? data;if (!values || typeof values !== 'object' || Array.isArray(values)) return {error: 'Objeto de configurações não encontrado.'};
    const changes = [], invalid = [];
    for (const m of manifest) {const v = pathGet(values, m.path);if (v === undefined) continue;if (typeof v !== 'number' || !Number.isFinite(v) || v < m.min - 1e-8 || v > m.max + 1e-8) {invalid.push(`${m.path} = ${v}`);continue;}if (!same(v, pathGet(C, m.path))) changes.push([m.path, v]);}
    if (invalid.length) return {error: `Valores inválidos ou fora da faixa (${invalid.length}): ${invalid.slice(0, 5).join(', ')}${invalid.length > 5 ? '…' : ''}`};
    return {changes, schema: data.schema || 'v5/v6', version: data.version ?? '—'};
  }
  function apply_(changes, label) {const n = commit(changes, label);markSaved(label);return n;}
  function resetAll() {commit(manifest.map(m => [m.path, m.initial]), 'Restaurar todos os padrões');}
  render();renderPresets();
  return {manifest, byPath, commit, undo, redo, render, renderPresets, exportData, preview, applyChanges: apply_, resetAll, markSaved, dirty, status, changed,
    onChange: fn => state.listeners.add(fn), get savedLabel() {return state.savedLabel;}, snapshotValues, officialValue};
}
export const escape = s => String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c]);
export {resetConfig};
