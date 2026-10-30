// Editor de animações: lista de animações (esquerda), prévia no personagem real (centro), configurações (direita)
// e timeline colorida (embaixo). Os três divisores arrastam (redimensiona) e, com um clique, recolhem até uma faixa mínima.
//
// Camada ADITIVA: lê e grava os mesmos valores que o painel de Personagens (velocidade, laço, duração máxima, offsets,
// trava de root motion/chão, variantes) e acrescenta o perfil por ação/variante (animation-profile.js). Nada é removido.
import {
  ANIMATION_GROUPS, FIELDS, FIELD_BY_ID, TRACK_KINDS, entryKey, resolveField, setField, setHitboxes, setMarkers, normalizeHitbox, normalizeMarker,
  buildTimeline, validateEntry, migrateProfile, JUMP_PHASES, PRINCIPLES, gameTracksFromPhases,
} from '../sim/animation-profile.js';
import * as THREE from 'three';
import {listMoves, getMove} from '../sim/moves.js';
import {effectiveMovePhases} from '../sim/move-phases.js';
import {presentationActionCandidates} from '../sim/move-presentation.js';
import {C} from '../sim/config.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const TABS = [['geral', 'Visão geral'], ['fases', 'Fases e janelas'], ['mov', 'Movimento'], ['trans', 'Transições'], ['hit', 'Hitboxes'], ['ev', 'Eventos VFX e áudio'], ['prin', 'Princípios'], ['jogo', 'Parâmetros do jogo'], ['diag', 'Diagnóstico']];
const TAB_TIPS = {geral: 'Reprodução, mistura e laço do clipe', fases: 'Startup, ativo, recovery, cancelamento, invencibilidade e congelamento', mov: 'Root motion, trava ao chão e deslocamento', trans: 'Estados que usam a animação, reserva e animação seguinte', hit: 'Declarar, adicionar, remover e posicionar hitboxes', ev: 'Eventos do GLB e marcadores de VFX/áudio', prin: 'Os 12 princípios da animação ligados aos sliders reais do jogo', jogo: 'Todos os sliders globais do jogo ligados a esta animação', diag: 'Cobertura, telemetria, conflitos e validação'};
const TAB_GROUPS = {geral: ['Reprodução', 'Mistura', 'Loop', 'Loop avançado'], fases: ['Combate'], mov: ['Movimento', 'Salto'], trans: ['Transições']};
const GAME_TAB = {locomotion: 'dodge', defense: 'block', tackle: 'tackle', dodge: 'dodge', jump: 'jump', wall: 'tackle', moves: 'tackle'};
const HB_TIPS = {shape: 'Forma do volume de contato.', bone: 'Osso do esqueleto em que a hitbox fica presa (vazio = raiz do personagem).', size: 'Dimensão da hitbox neste eixo, em metros.', position: 'Deslocamento da hitbox a partir do osso/raiz, em metros.', rotation: 'Giro da hitbox em graus.', start: 'Fração do clipe em que a hitbox passa a valer.', end: 'Fração do clipe em que a hitbox deixa de valer.', damage: 'Dano da hitbox quando aplicável (registrado).', target: 'Quem a hitbox pode atingir.', reaction: 'Reação causada no alvo (registrado).'};
const PREF = 'arenamon-anim-editor-layout:';
const MIN_STRIP = 18;

export function createAnimationEditor({ui, $, tuning = null, ACTION_TABS = {}, STATE_LABELS, ACTION_LABELS, STATE_ACTIONS, ACTION_IDS, onChanged = () => {}, loadAnimationFile}) {
  const root = $('anim-editor');
  if (!root) return {open() {}, close() {}, isOpen: () => false};
  const S = {slot: 0, action: 'idle', variantIdx: null, tab: 'geral', scope: 'action', search: '', onlyMissing: false, hit: 0, play: false, loop: true, paused: false, seek: 0, undo: [], redo: [], open: false, saved: true};
  const ch = () => ui.characters[S.slot] || null;
  /** Move pela identidade (`move_<id>`): clipe próprio de um Move, usado antes de move_1…4 e do tackle. */
  const moveIdentity = id => {const m = /^move_(.+)$/.exec(id || '');return m && !ACTION_IDS.includes(id) ? getMove(m[1]) : null;};
  const labelOf = id => (moveIdentity(id) ? `Move: ${moveIdentity(id).name ?? moveIdentity(id).id}` : ACTION_LABELS[id] || STATE_LABELS[id] || id);
  const lay = (() => {try {return JSON.parse(localStorage.getItem(PREF + 'v1') || '{}');} catch {return {};}})();
  const L = {left: lay.left ?? 250, right: lay.right ?? 340, bottom: lay.bottom ?? 210, cl: !!lay.cl, cr: !!lay.cr, cb: !!lay.cb};
  const saveLayout = () => {try {localStorage.setItem(PREF + 'v1', JSON.stringify(L));} catch { /* sem armazenamento */ }};

  // ---------- Dados da animação selecionada ----------
  const pseudo = id => /^(charge|release)_/.test(id) ? {type: id.split('_')[0], move: id.split('_')[1]} : null;
  const variants = c => c.variantsOf(S.action);
  const clipIndex = c => {const v = variants(c);return v.includes(S.variantIdx) ? S.variantIdx : v[0] ?? null;};
  const clipName = c => {const i = clipIndex(c);return i == null ? null : c.clips[i].name;};
  const profileKey = c => S.scope === 'variant' && clipName(c) ? entryKey(S.action, clipName(c)) : S.action;
  /** Valor global (armazenamentos antigos) de um campo que já tinha controle no jogo. */
  function globalOf(c, f) {
    if (f.id === 'rootMotion') return !c.lockRootMotion;
    if (f.id === 'lockToGround') return c.lockToGround;
    switch (f.store) {
      case 'speeds': return c.speeds[S.action] ?? 1;
      case 'playback': return f.id === 'loop' ? c.playbackOf(S.action, S.action).loop : c.playbackOf(S.action, S.action).maxDuration;
      case 'clipOffsets': return c.clipOffsets[clipIndex(c)] ?? 0;
      case 'lockRootMotion': return !c.lockRootMotion;
      case 'lockToGround': return c.lockToGround;
      default: return undefined;
    }
  }
  function setGlobal(c, f, v) {
    switch (f.store) {
      case 'speeds': if (v === 1) delete c.speeds[S.action];else c.speeds[S.action] = v;break;
      case 'playback': c.playback[S.action] = {...(c.playback[S.action] || {}), [f.id === 'loop' ? 'loop' : 'maxDuration']: v};break;
      case 'clipOffsets': if (clipIndex(c) != null) c.clipOffsets[clipIndex(c)] = v;break;
      case 'lockRootMotion': c.lockRootMotion = !v;break;
      case 'lockToGround': c.lockToGround = v;break;
      default:
    }
  }
  function valueOf(c, f) {
    const g = f.store || f.id === 'rootMotion' || f.id === 'lockToGround' ? globalOf(c, f) : undefined;
    const r = resolveField(c.animProfile, f.id, S.action, clipName(c), g !== undefined ? {[f.id]: g} : {});
    return {...r, global: g};
  }
  function allValues(c) {const o = {};for (const f of FIELDS) {const v = valueOf(c, f);o[f.id] = v.overridden || f.store ? v.value : (f.def ?? null);}
    // Campos sem valor local ficam nulos para a timeline herdar do GLB.
    for (const f of FIELDS) if (!f.store && !valueOf(c, f).overridden) o[f.id] = f.def === null || ['startup', 'activeStart', 'activeEnd', 'cancelStart', 'invulnStart', 'invulnEnd', 'freezeAt'].includes(f.id) ? null : f.def;
    return o;}

  // ---------- Desfazer / refazer ----------
  const snap = c => JSON.stringify({p: c.animProfile, sp: c.speeds, pb: c.playback, co: c.clipOffsets, rm: c.lockRootMotion, lg: c.lockToGround, v: c.variants, ma: c.moveAnims});
  function restoreSnap(c, text) {
    const o = JSON.parse(text);c.animProfile = migrateProfile(o.p);c.speeds = o.sp;c.playback = o.pb;c.clipOffsets = o.co;c.lockRootMotion = o.rm;c.lockToGround = o.lg;c.variants = o.v;if (o.ma) c.moveAnims = o.ma;
    c.refreshVisual();c.save();
  }
  function commit(mutate) {
    const c = ch();if (!c) return;
    const before = snap(c);
    mutate(c);
    if (snap(c) === before) return;   // edição repetida ou sem efeito: não polui o desfazer
    S.undo.push(before);if (S.undo.length > 100) S.undo.shift();S.redo.length = 0;
    c.save();S.saved = true;onChanged();refresh({keepList: true});
  }
  const undo = () => {const c = ch();if (!c || !S.undo.length) return;S.redo.push(snap(c));restoreSnap(c, S.undo.pop());onChanged();refresh();};
  const redo = () => {const c = ch();if (!c || !S.redo.length) return;S.undo.push(snap(c));restoreSnap(c, S.redo.pop());onChanged();refresh();};

  // ---------- Prévia no personagem real ----------
  function startPlay() {
    const c = ch(), i = c && clipIndex(c);if (i == null) return;
    c.startPreview(i, {action: S.action, loop: S.loop, paused: S.paused, seek: S.seek});
  }
  function playPause() {
    const c = ch();if (!c || clipIndex(c) == null) return;
    if (c.preview && !c.preview.paused) {S.paused = true;S.seek = c.current?.action.time ?? S.seek;} else {S.paused = false;}
    startPlay();refreshTransport();
  }
  function seekTo(seconds) {const c = ch();if (!c || clipIndex(c) == null) return;S.paused = true;S.seek = seconds;startPlay();refreshTransport();}
  function stopPlay() {ch()?.stopPreview();S.paused = false;refreshTransport();}

  // ---------- Lista ----------
  const statusOf = (c, id) => {
    const ps = pseudo(id);
    if (ps) {const conf = c.moveAnims?.[ps.move], i = ps.type === 'charge' ? conf?.chargeClip : conf?.releaseClip;return i != null && c.clips[i] ? {ok: true, n: 1} : {ok: false, n: 0};}
    const n = c.variantsOf(id).length;return n ? {ok: true, n} : {ok: false, n: 0};
  };
  function renderList() {
    const c = ch(), box = root.querySelector('[data-list]');
    if (!c) {box.innerHTML = '<p class="hint">Carregue um personagem em 👤 Personagens.</p>';return;}
    const q = S.search.trim().toLowerCase();let html = '';let total = 0, missing = 0;
    for (const [g, name, ids] of ANIMATION_GROUPS) {
      const rows = ids.filter(id => ACTION_IDS.includes(id) || pseudo(id)).map(id => ({id, st: statusOf(c, id)}));
      total += rows.length;missing += rows.filter(r => !r.st.ok).length;
      const shown = rows.filter(r => (!q || labelOf(r.id).toLowerCase().includes(q) || r.id.includes(q)) && (!S.onlyMissing || !r.st.ok));
      if (!shown.length) continue;
      html += `<div class="ae-group"><div class="ae-group-h">${esc(name)}</div>${shown.map(r => `<button type="button" class="ae-item${r.id === S.action ? ' on' : ''}${r.st.ok ? '' : ' miss'}" data-act="${r.id}" title="${r.st.ok ? r.st.n + ' clipe(s) associado(s)' : 'Sem clipe próprio: o jogo usa o clipe de reserva. Associe ou importe um clipe.'}"><span>${esc(labelOf(r.id))}</span><i>${r.st.ok ? (r.st.n > 1 ? r.st.n + '×' : '✓') : 'ausente'}</i></button>`).join('')}</div>`;
    }
    // Moves registrados: uma linha por identidade (`move_<id>`), aditiva aos blocos move_1…4.
    const moveRows = listMoves().map(d => ({id: `move_${d.id}`, st: statusOf(c, `move_${d.id}`)})).filter(r => (!q || labelOf(r.id).toLowerCase().includes(q) || r.id.includes(q)) && (!S.onlyMissing || !r.st.ok));
    if (moveRows.length) html += `<div class="ae-group"><div class="ae-group-h" title="Clipe próprio por Move. Vale antes de move_1…4 e do clipe do tackle.">Moves (por identidade)</div>${moveRows.map(r => `<button type="button" class="ae-item${r.id === S.action ? ' on' : ''}${r.st.ok ? '' : ' miss'}" data-act="${r.id}" title="${r.st.ok ? r.st.n + ' clipe(s) associado(s)' : 'Sem clipe próprio: o Move usa a animação padrão (tackle ou move_N). Associe um clipe para dar identidade.'}"><span>${esc(labelOf(r.id))}</span><i>${r.st.ok ? '✓' : 'padrão'}</i></button>`).join('')}</div>`;
    box.innerHTML = html || '<p class="hint">Nenhuma animação corresponde ao filtro.</p>';
    root.querySelector('[data-count]').textContent = `${total - missing} de ${total} com clipe · ${missing} ausentes`;
    for (const b of box.querySelectorAll('[data-act]')) b.onclick = () => select(b.dataset.act);
  }
  function select(id) {S.action = id;S.variantIdx = null;S.hit = 0;S.paused = false;stopPlay();refresh();}

  // ---------- Painel de propriedades ----------
  function fieldRow(c, f) {
    const v = valueOf(c, f), shown = v.value;
    const badge = `<small class="ae-src ${v.overridden ? 'ovr' : ''}" title="Origem do valor: ${v.from}">${v.overridden ? 'sobrescrito (' + v.from + ')' : v.from}${f.applied ? '' : ' · registrado'}</small>`;
    const reset = v.overridden ? `<button type="button" class="ae-reset" data-reset="${f.id}" title="Restaurar o padrão/global">↺</button>` : '';
    if (f.type === 'bool') {
      const on = shown === null || shown === undefined ? true : !!shown;
      return `<label class="ae-row" title="${esc(f.tip)}"><span>${esc(f.label)} ${badge}</span><input type="checkbox" data-f="${f.id}" ${on ? 'checked' : ''}>${reset}</label>`;
    }
    if (f.type === 'select') {
      const opts = f.options === 'actions' ? ['', ...ACTION_IDS] : f.options, cur = shown ?? '';
      return `<label class="ae-row" title="${esc(f.tip)}"><span>${esc(f.label)} ${badge}</span><select data-fs="${f.id}">${opts.map(o => `<option value="${esc(o)}"${o === cur ? ' selected' : ''}>${esc(o === '' ? '(padrão)' : f.options === 'actions' ? labelOf(o) : o)}</option>`).join('')}</select>${reset}</label>`;
    }
    const val = shown ?? '';
    return `<div class="ae-row" title="${esc(f.tip)}"><span>${esc(f.label)} <output data-out="${f.id}">${val === '' ? 'herda' : (+val).toFixed(f.step < .1 ? 2 : f.step < 1 ? 2 : 0)} ${esc(f.unit || '')}</output> ${badge}</span><input type="range" data-f="${f.id}" min="${f.min}" max="${f.max}" step="${f.step}" value="${val === '' ? (f.min) : val}"><input type="number" class="ae-num" data-n="${f.id}" min="${f.min}" max="${f.max}" step="${f.step}" value="${val === '' ? '' : val}" placeholder="herda">${reset}</div>`;
  }
  function renderProps() {
    const c = ch(), box = root.querySelector('[data-props]');
    if (!c) {box.innerHTML = '';return;}
    const st = statusOf(c, S.action);
    let html = `<div class="ae-sec"><b>Clipe</b>${clipPicker(c, st)}</div>`;
    if (S.tab === 'geral' || S.tab === 'fases' || S.tab === 'mov' || S.tab === 'trans') {
      const groups = TAB_GROUPS[S.tab];
      html += `<div class="ae-sec"><label class="ae-scope" title="Onde gravar o campo: em todas as variantes da ação ou só no clipe selecionado."><span>Gravar em</span><select data-scope><option value="action"${S.scope === 'action' ? ' selected' : ''}>Todas as variantes</option><option value="variant"${S.scope === 'variant' ? ' selected' : ''}>Só o clipe selecionado</option></select></label></div>`;
      for (const g of groups) {
        const fs = FIELDS.filter(f => f.group === g && (!f.only || f.only.includes(S.action)));
        if (fs.length) html += `<div class="ae-sec"><b>${g}</b>${fs.map(f => fieldRow(c, f)).join('')}</div>`;
      }
      if (S.tab === 'mov') html += `<div class="ae-sec"><b>Global do personagem</b><label class="ae-row" title="Trava o deslocamento horizontal (X/Z) gravado nos clipes de TODAS as animações deste personagem (padrão ligado). A sobrescrita por animação fica acima."><span>Travar deslocamento horizontal (X/Z)</span><input type="checkbox" data-g="lockRootMotion" ${c.lockRootMotion ? 'checked' : ''}></label><label class="ae-row" title="Remove o sobe/desce gravado nos clipes (pés sempre no chão)."><span>Travar no chão</span><input type="checkbox" data-g="lockToGround" ${c.lockToGround ? 'checked' : ''}></label><label class="ae-row" title="Apoia o ponto mais baixo de cada clipe no piso automaticamente."><span>Ajuste automático ao chão</span><input type="checkbox" data-g="autoGround" ${c.autoGround ? 'checked' : ''}></label></div><p class="hint">O que não for liberado por animação (X/Z) segue travado pela física.</p>`;
      if (S.tab === 'fases' && moveIdentity(S.action)) html += gameRulesHtml();
      if (S.tab === 'fases') html += `<p class="hint">As faixas «registrado» ficam salvas e aparecem na timeline; o jogo ainda deriva startup/ativo/recovery do GLB e das regras. A edição não altera o combate até a integração ser autorizada.</p>`;
      if (S.tab === 'geral' && S.action.startsWith('jump')) html += `<p class="hint">Fases do salto: se nenhuma delas tiver clipe, o jogo usa o clipe «Salto» inteiro como antes. Associando um clipe a qualquer fase, o salto passa a seguir a velocidade vertical (início → subida → pico → queda).</p>`;
    }
    if (S.tab === 'trans') html += transitionsHtml(c);
    if (S.tab === 'prin') html += principlesHtml(c);
    if (S.tab === 'jogo') html += '<div data-jogo></div>';
    if (S.tab === 'diag') html += diagHtml(c);
    if (S.tab === 'hit') html += hitboxHtml(c);
    if (S.tab === 'ev') html += eventsHtml(c);
    html += diagnosticsHtml(c);
    box.innerHTML = html;
    wireProps(c, box);
    mountTuning(c, box);
  }
  function clipPicker(c, st) {
    const ps = pseudo(S.action);
    if (ps) {
      const conf = c.getMoveAnimConfig(ps.move), idx = ps.type === 'charge' ? conf.chargeClip : conf.releaseClip;
      const opts = c.clips.map((cl, i) => c.clipInfo[i]?.compatible ? `<option value="${i}"${i === idx ? ' selected' : ''}>${esc(cl.name)} (${cl.duration.toFixed(2)} s)</option>` : '').join('');
      const dur = idx != null && c.clips[idx] ? c.clips[idx].duration : 1;
      const loopSliders = ps.type === 'charge' && idx != null ? `<label class="ae-row" title="Segundo do clipe em que o laço da carga recomeça."><span>Início do laço da carga <output>${(conf.chargeLoopStart || 0).toFixed(2)} s</output></span><input type="range" data-mv="start" min="0" max="${dur}" step=".01" value="${conf.chargeLoopStart || 0}"></label><label class="ae-row" title="Segundo do clipe em que o laço da carga termina e volta ao início do laço."><span>Fim do laço da carga <output>${(conf.chargeLoopEnd ?? dur).toFixed(2)} s</output></span><input type="range" data-mv="end" min=".02" max="${dur}" step=".01" value="${conf.chargeLoopEnd ?? dur}"></label>` : '';
      return `<div class="ae-clip-add"><select data-mvclip title="Clipe usado nesta fase do move"><option value="">— sem animação própria —</option>${opts}</select></div>${loopSliders}`;
    }
    const vs = variants(c), cur = clipIndex(c);
    const opts = c.clips.map((cl, i) => c.clipInfo[i]?.compatible ? `<option value="${i}">${esc(cl.name)} (${cl.duration.toFixed(2)} s)</option>` : '').join('');
    return `<div class="ae-clip">${st.ok ? vs.map(i => `<button type="button" class="ae-chip${i === cur ? ' on' : ''}" data-var="${i}" title="Selecionar esta variante">${esc(c.clips[i].name)}<span data-rm="${i}" title="Remover a associação (o clipe continua na biblioteca)">✕</span></button>`).join('') : '<span class="ae-miss">⚠ Sem clipe próprio — usando a reserva do estado</span>'}</div>
      <div class="ae-clip-add"><select data-addclip title="Associa outro clipe da biblioteca a esta animação (vira uma variante)"><option value="">+ Associar clipe…</option>${opts}</select><label class="btn-file" title="Importar clipes de outro .glb para a biblioteca"><input type="file" accept=".glb,.gltf" data-import hidden>⇪ Importar</label></div>`;
  }
  function gameRulesHtml() {
    const mv = moveIdentity(S.action), ph = effectiveMovePhases(mv, mv.group ? C.world[mv.group] : null), r = x => x ? `${x[0].toFixed(3)}–${x[1].toFixed(3)} s` : '—';
    return `<div class="ae-sec"><b>Regras do jogo (somente leitura)</b><p class="hint">Duração ${ph.duration.toFixed(3)} s · startup ${r(ph.startup)} · ativo ${ph.active.length ? ph.active.map(r).join(', ') : '— (sem hitbox declarada)'} · recovery ${r(ph.recovery)} · cancelável ${r(ph.cancel)} · invencível ${ph.invulnerable.length ? ph.invulnerable.map(r).join(', ') : '—'}.<br>Essas faixas aparecem na timeline como «Regra: …». Ajustá-las é feito nos sliders do Move (aba Parâmetros do jogo).</p></div>`;
  }
  function principlesHtml(c) {
    return `<p class="hint">Os 12 princípios da animação ligados aos controles reais do jogo. Cada bloco reúne os sliders globais e os campos desta animação.</p>` + PRINCIPLES.map(pr => {
      const fs = pr.fields.map(id => FIELD_BY_ID[id]).filter(f => f && (!f.only || f.only.includes(S.action)));
      const ch2 = (pr.char || []).map(k => `<label class="ae-row" title="${k === 'heightScale' ? 'Altura visual do personagem (só visual; a física não muda).' : 'Largura visual do personagem (só visual; a física não muda).'}"><span>${k === 'heightScale' ? 'Altura visual (×)' : 'Largura visual (×)'} <output>${c[k].toFixed(2)}×</output></span><input type="range" data-char="${k}" min=".5" max="3" step=".05" value="${c[k]}"></label>`).join('');
      return `<details class="ae-pr" ${pr.n <= 2 ? 'open' : ''}><summary title="${esc(pr.tip)}"><b>${pr.n}. ${esc(pr.name)}</b></summary><p class="hint">${esc(pr.tip)}</p>${fs.map(f => fieldRow(c, f)).join('')}${ch2}<div data-tp="${pr.id}"></div></details>`;
    }).join('');
  }
  function diagHtml(c) {
    const seen = c.statesSeen ? [...c.statesSeen] : [], keys = Object.keys(STATE_ACTIONS), never = keys.filter(k => !seen.includes(k));
    const own = ACTION_IDS.filter(a => c.variantsOf(a).length), miss = ACTION_IDS.filter(a => !c.variantsOf(a).length);
    const conflicts = [];
    for (const [key, vals] of Object.entries(c.animProfile.entries)) {
      const act = key.split('@')[0];
      if (!ACTION_IDS.includes(act) && !pseudo(act)) conflicts.push(`Perfil de «${key}» refere uma ação que não existe.`);
      else if (!statusOf(c, act).ok && Object.keys(vals).length) conflicts.push(`«${labelOf(act)}» tem ajustes salvos mas está sem clipe.`);
      if (key.includes('@') && !c.clips.some(cl => cl.name === key.split('@')[1])) conflicts.push(`Perfil de «${key}»: o clipe não existe neste modelo.`);
    }
    const log = c.log.slice(-30).reverse();
    return `<div class="ae-sec"><b>Cobertura de animações</b><p>${own.length} de ${ACTION_IDS.length} com clipe próprio · ${miss.length} ausentes${miss.length ? ': ' + miss.map(a => esc(labelOf(a))).join(', ') : ''}.</p><p>Estados visitados nesta sessão: ${seen.length} de ${keys.length}${never.length ? ' · ainda não vistos: ' + never.slice(0, 40).map(k => esc(STATE_LABELS[k] || k)).join(', ') : ''}.</p></div>
      <div class="ae-sec"><b>Conflitos e associações</b>${conflicts.length ? conflicts.map(t => `<div class="ae-iss aviso">⚠ ${esc(t)}</div>`).join('') : '<div class="ae-iss ok">✓ Nenhum conflito entre perfil e modelo.</div>'}${(c.missingAssociations || []).length ? `<div class="ae-iss aviso">⚠ Associações salvas sem clipe neste modelo: ${(c.missingAssociations).map(esc).join(', ')}</div>` : ''}</div>
      <div class="ae-sec"><b>Telemetria (últimas trocas)</b><div class="ae-btns"><button type="button" data-tlm-export title="Baixa o log completo de trocas de animação (JSON)">⬇ Exportar log</button><button type="button" data-tlm-clear title="Limpa o log de trocas">Limpar</button></div><p class="hint">${c.transitions} trocas · ${c.restartsAvoided} reinícios evitados · ${c.log.filter(e => e.interrupted).length} interrupções</p>${log.map(e => `<div class="ae-log${e.interrupted ? ' warn' : ''}"><span>${e.t.toFixed(2)}</span> <b>${esc(STATE_LABELS[e.from] || e.from || '—')} → ${esc(STATE_LABELS[e.to] || e.to)}</b> <small>${esc(e.clipTo)} · ${e.reason}</small></div>`).join('') || '<p class="hint">Sem trocas registradas ainda (jogue ou toque uma prévia).</p>'}</div>`;
  }
  /** Sliders globais reais (os mesmos do Ajustes) dentro do editor: Princípios e Parâmetros do jogo. */
  function mountTuning(c, box) {
    if (!tuning) return;
    const pathsOf = spec => (typeof spec === 'string' ? tuning.manifest.filter(m => m.section === spec.slice(1)).map(m => m.path) : spec).filter(p => tuning.byPath.has(p));
    for (const holder of box.querySelectorAll('[data-tp]')) {
      const pr = PRINCIPLES.find(x => x.id === holder.dataset.tp), paths = pathsOf(pr.paths);
      if (!paths.length) continue;
      const wrap = document.createElement('div');wrap.className = 'act-controls';for (const path of paths) wrap.append(tuning.controlFor(path));holder.append(wrap);
    }
    const jogo = box.querySelector('[data-jogo]');
    if (jogo) {
      const grp = ANIMATION_GROUPS.find(([, , ids]) => ids.includes(S.action)) ?? (moveIdentity(S.action) ? ['moves', 'Moves (por identidade)'] : null), tab = ACTION_TABS[GAME_TAB[grp?.[0]] || 'tackle'], mv = moveIdentity(S.action);
      const sections = [['🎞 Animação (global)', ['display.animation.fade', 'display.animation.actionFade', 'display.animation.locomotionHold', 'display.animation.speed', 'display.grounding.autoGround', 'display.grounding.visualOffset'], true], ...(tab?.sections || [])];
      const mvPaths = mv ? tuning.manifest.filter(m => mv.group && m.path.startsWith(`world.${mv.group}.`)).map(m => m.path) : [];
      if (mvPaths.length) sections.unshift([`✦ Sliders do Move «${mv.name ?? mv.id}»`, mvPaths, true]);
      jogo.innerHTML = `<p class="hint">Todos os sliders globais ligados a «${esc(grp?.[1] || 'esta animação')}». São os mesmos controles de Ajustes e Ações (entram no desfazer do jogo).</p>`;
      for (const [title, spec, open] of sections) {
        const paths = pathsOf(spec);if (!paths.length) continue;
        const d = document.createElement('details');d.className = 'ae-pr';d.open = !!open;
        d.innerHTML = `<summary><b>${esc(title)}</b> <small class="muted">${paths.length}</small></summary>`;
        const wrap = document.createElement('div');wrap.className = 'act-controls';for (const path of paths) wrap.append(tuning.controlFor(path));d.append(wrap);jogo.append(d);
      }
    }
  }
  function transitionsHtml(c) {
    const users = Object.entries(STATE_ACTIONS).filter(([, chain]) => chain.includes(S.action));
    const mv = moveIdentity(S.action), slotMatch = /^move_([1-4])$/.exec(S.action);
    const chain = STATE_ACTIONS[S.action] || null;
    const moveOrder = mv ? `<div class="ae-sec"><b>Ordem real do Move «${esc(mv.name ?? mv.id)}»</b><p class="hint">Ação: ${['move_' + mv.id, ...presentationActionCandidates(mv, 0, 'action')].filter((v, i, a) => a.indexOf(v) === i).map(a => esc(labelOf(a))).join(' → ')}.<br>Carga: ${presentationActionCandidates(mv, 0, 'charge').map(a => esc(labelOf(a))).join(' → ')}.<br>Disparo: ${presentationActionCandidates(mv, 0, 'release').map(a => esc(labelOf(a))).join(' → ')}.</p><p class="hint">Moves que usam a física do Tackle mantêm primeiro o clipe do tackle; o clipe desta identidade vence quando associado.</p></div>` : slotMatch ? `<div class="ae-sec"><b>Moves que usam este bloco</b><p class="hint">move_${slotMatch[1]} é o clipe do slot ${slotMatch[1]}. Moves de física de Tackle (Lunge, Quick Attack…) tocam o clipe do tackle antes dele; para dar um clipe a um Move específico use «Moves (por identidade)».</p></div>` : '';
    return moveOrder + `<div class="ae-sec"><b>Estados que usam esta animação</b>${users.length ? `<ul class="ae-list">${users.map(([k, chain2]) => `<li><b>${esc(STATE_LABELS[k] || k)}</b> — ordem de preferência: ${chain2.map(a => a === S.action ? `<u>${esc(labelOf(a))}</u>` : esc(labelOf(a))).join(' → ')}</li>`).join('')}</ul>` : '<p class="hint">Nenhum estado usa esta animação diretamente.</p>'}</div>
      <div class="ae-sec"><b>Reserva (fallback)</b><p class="hint">${chain ? `Se faltar clipe, ${esc(labelOf(S.action))} usa: ${chain.map(a => esc(labelOf(a))).join(' → ')}.` : 'Esta animação é um bloco direto; sem clipe, o estado cai para a reserva do estado que a usa.'}</p></div>
      <p class="hint">As ordens acima são as regras atuais do jogo (somente leitura). Editar condições, tempo mínimo e animação seguinte ainda não faz parte desta versão.</p>`;
  }
  function hitboxHtml(c) {
    const key = profileKey(c), list = c.animProfile.hitboxes[key] || [], h = list[S.hit] || list[0];
    const bones = [...c.bones.values()];
    let html = `<div class="ae-sec"><label class="ae-row" title="Declara se esta animação tem hitbox. Sem hitbox é um estado válido."><span>Possui hitbox</span><input type="checkbox" data-hb-has ${list.length ? 'checked' : ''}></label>
      <div class="ae-btns"><button type="button" data-hb-add title="Adiciona uma nova hitbox a esta animação">＋ Adicionar hitbox</button><button type="button" data-hb-del title="Remove a hitbox selecionada" ${list.length ? '' : 'disabled'}>－ Remover hitbox</button></div>
      ${list.length > 1 ? `<label class="ae-row"><span>Hitbox</span><select data-hb-sel>${list.map((x, i) => `<option value="${i}"${i === S.hit ? ' selected' : ''}>${i + 1} — ${x.shape}</option>`).join('')}</select></label>` : ''}</div>`;
    if (!list.length) html += '<p class="hint">Sem hitbox é um estado válido (ex.: andar, defesa). Use «Adicionar» para declarar uma.</p>';
    if (h) {
      const num = (label, k, i, min, max, step, unit = 'm') => `<label class="ae-row" title="${esc(HB_TIPS[k])}"><span>${label} <output>${h[k][i]} ${unit}</output></span><input type="range" data-hb="${k}.${i}" min="${min}" max="${max}" step="${step}" value="${h[k][i]}"></label>`;
      html += `<div class="ae-sec"><label class="ae-row" title="${HB_TIPS.shape}"><span>Forma</span><select data-hb="shape">${['sphere', 'box', 'capsule'].map(s => `<option${h.shape === s ? ' selected' : ''}>${s}</option>`).join('')}</select></label>
        <label class="ae-row" title="${HB_TIPS.bone}"><span>Osso de origem</span><select data-hb="bone"><option value="">(raiz do personagem)</option>${bones.map(b => `<option${h.bone === b ? ' selected' : ''}>${esc(b)}</option>`).join('')}</select></label>
        ${num('Tamanho X', 'size', 0, .05, 4, .05)}${num('Tamanho Y', 'size', 1, .05, 4, .05)}${num('Tamanho Z', 'size', 2, .05, 4, .05)}
        ${num('Posição X', 'position', 0, -3, 3, .05)}${num('Posição Y', 'position', 1, -3, 3, .05)}${num('Posição Z', 'position', 2, -3, 3, .05)}
        ${num('Rotação Y', 'rotation', 1, -180, 180, 5, '°')}
        <label class="ae-row" title="${HB_TIPS.start}"><span>Ativa de <output>${Math.round(h.start * 100)} %</output></span><input type="range" data-hb="start" min="0" max="1" step=".01" value="${h.start}"></label>
        <label class="ae-row" title="${HB_TIPS.end}"><span>Ativa até <output>${Math.round(h.end * 100)} %</output></span><input type="range" data-hb="end" min="0" max="1" step=".01" value="${h.end}"></label>
        <label class="ae-row" title="${HB_TIPS.damage}"><span>Dano <output>${h.damage}</output></span><input type="range" data-hb="damage" min="0" max="100" step="1" value="${h.damage}"></label>
        <label class="ae-row" title="${HB_TIPS.target}"><span>Alvo</span><select data-hb="target">${['rival', 'todos', 'aliado'].map(s => `<option${h.target === s ? ' selected' : ''}>${s}</option>`).join('')}</select></label>
        <label class="ae-row" title="${HB_TIPS.reaction}"><span>Reação</span><input type="text" data-hb="reaction" value="${esc(h.reaction)}" placeholder="hitstun, knockback…"></label></div>
        <p class="hint">A hitbox é declarada e salva no perfil; a faixa aparece na timeline. O combate ainda usa as hitboxes das regras (não é alterado por aqui).</p>`;
    }
    return html;
  }
  function eventsHtml(c) {
    const i = clipIndex(c), glb = i == null ? [] : c.source.eventsByClip?.[i] || [], key = profileKey(c), mk = c.animProfile.markers[key] || [];
    return `<div class="ae-sec"><b>Eventos do GLB (somente leitura)</b>${glb.length ? `<ul class="ae-list">${glb.map(e => `<li>${esc(e.type)} · ${(+e.time).toFixed(3)} s</li>`).join('')}</ul>` : '<p class="hint">Este clipe não traz eventos do Animation Studio.</p>'}</div>
      <div class="ae-sec"><b>Marcadores locais</b>${mk.map((m, n) => `<div class="ae-row"><span>${esc(m.kind)} ${esc(m.name)}</span><input type="range" data-mk="${n}" min="0" max="1" step=".01" value="${m.at}" title="Posição no clipe"><button type="button" data-mk-del="${n}" title="Remover marcador">✕</button></div>`).join('') || '<p class="hint">Nenhum marcador local.</p>'}
      <div class="ae-btns"><select data-mk-kind>${['vfx', 'audio', 'camera', 'shake', 'freeze', 'spawn', 'contact', 'callback', 'marker'].map(k => `<option>${k}</option>`).join('')}</select><input type="text" data-mk-name placeholder="nome (opcional)"><button type="button" data-mk-add>＋ Adicionar</button></div></div>
      <p class="hint">Marcadores locais são uma camada à parte: os eventos importados do GLB nunca são alterados. VFX/áudio ficam registrados no perfil (ainda sem disparo no jogo).</p>`;
  }
  function diagnosticsHtml(c) {
    const i = clipIndex(c), values = allValues(c), key = profileKey(c);
    const issues = validateEntry({duration: i == null ? 0 : c.clips[i].duration, values: {...values, trimStart: values.trimStart, trimEnd: values.trimEnd}, hitboxes: c.animProfile.hitboxes[key] || [], markers: c.animProfile.markers[key] || [], bones: new Set(c.bones.values()), hasClip: i != null});
    return `<div class="ae-sec ae-diag"><b>Validação</b>${issues.length ? issues.map(x => `<div class="ae-iss ${x.level}">${x.level === 'erro' ? '⛔' : '⚠'} ${esc(x.text)}</div>`).join('') : '<div class="ae-iss ok">✓ Sem conflitos.</div>'}</div>`;
  }
  function wireProps(c, box) {
    const key = profileKey(c);
    for (const g of box.querySelectorAll('[data-g]')) g.onchange = () => commit(c0 => {c0[g.dataset.g] = g.checked;});
    for (const sel of box.querySelectorAll('[data-fs]')) sel.onchange = () => commit(c0 => {c0.animProfile = setField(c0.animProfile, profileKey(c0), sel.dataset.fs, sel.value === '' ? null : sel.value);});
    for (const r of box.querySelectorAll('[data-char]')) {r.oninput = () => {r.previousElementSibling?.querySelector?.('output');const o = r.parentElement.querySelector('output');if (o) o.textContent = Number(r.value).toFixed(2) + '×';};r.onchange = () => commit(c0 => {c0[r.dataset.char] = Number(r.value);});}
    const ps = pseudo(S.action);
    box.querySelector('[data-mvclip]')?.addEventListener('change', e => commit(c0 => c0.setMoveAnim(ps.move, ps.type, e.target.value)));
    for (const r of box.querySelectorAll('[data-mv]')) r.onchange = () => commit(c0 => {if (r.dataset.mv === 'start') c0.setMoveChargeLoopStart(ps.move, Number(r.value));else c0.setMoveChargeLoopEnd(ps.move, Number(r.value));});
    box.querySelector('[data-tlm-export]')?.addEventListener('click', () => {const a = document.createElement('a');a.href = URL.createObjectURL(new Blob([JSON.stringify({character: c.source.name, transitions: c.transitions, restartsAvoided: c.restartsAvoided, log: c.log}, null, 2)], {type: 'application/json'}));a.download = 'telemetria-animacoes.json';a.click();setTimeout(() => URL.revokeObjectURL(a.href), 500);});
    box.querySelector('[data-tlm-clear]')?.addEventListener('click', () => {c.log.length = 0;renderProps();});
    box.querySelector('[data-scope]')?.addEventListener('change', e => {S.scope = e.target.value;refresh({keepList: true});});
    for (const b of box.querySelectorAll('[data-var]')) b.onclick = e => {if (e.target.dataset.rm) return;S.variantIdx = Number(b.dataset.var);if (c.preview) startPlay();refresh({keepList: true});};
    for (const x of box.querySelectorAll('[data-rm]')) x.onclick = e => {e.stopPropagation();commit(ch0 => ch0.removeVariant(S.action, Number(x.dataset.rm)));};
    box.querySelector('[data-addclip]')?.addEventListener('change', e => {if (e.target.value === '') return;const idx = Number(e.target.value);commit(ch0 => {ch0.addVariant(S.action, idx);});S.variantIdx = idx;refresh();});
    box.querySelector('[data-import]')?.addEventListener('change', async e => {
      const file = e.target.files[0];if (!file) return;
      try {const lib = await loadAnimationFile(file);commit(ch0 => {ch0.importClips({name: file.name, animations: lib.animations});});} catch (err) {box.querySelector('.ae-diag').insertAdjacentHTML('beforeend', `<div class="ae-iss erro">⛔ ${esc(err.message)}</div>`);}
    });
    for (const input of box.querySelectorAll('[data-f]')) {
      const f = FIELD_BY_ID[input.dataset.f];
      const write = v => commit(c0 => {
        if (f.store) setGlobal(c0, f, v);
        // Campos com store gravam também uma sobrescrita só quando o escopo é «clipe»; senão o global é o valor.
        if (!f.store || S.scope === 'variant') c0.animProfile = setField(c0.animProfile, profileKey(c0), f.id, v);
        if (f.store && S.scope !== 'variant') c0.animProfile = setField(c0.animProfile, profileKey(c0), f.id, null);
      });
      if (f.type === 'bool') input.onchange = () => write(input.checked);
      else {
        input.oninput = () => {const o = box.querySelector(`[data-out="${f.id}"]`), n = box.querySelector(`[data-n="${f.id}"]`);if (o) o.textContent = `${(+input.value).toFixed(f.step < 1 ? 2 : 0)} ${f.unit || ''}`;if (n) n.value = input.value;};
        input.onchange = () => write(Number(input.value));
      }
    }
    for (const n of box.querySelectorAll('[data-n]')) n.onchange = () => {
      const f = FIELD_BY_ID[n.dataset.n];
      if (n.value === '') commit(c0 => {c0.animProfile = setField(c0.animProfile, profileKey(c0), f.id, null);});
      else commit(c0 => {const v = Math.min(f.max, Math.max(f.min, Number(n.value)));if (f.store) setGlobal(c0, f, v);else c0.animProfile = setField(c0.animProfile, profileKey(c0), f.id, v);});
    };
    for (const r of box.querySelectorAll('[data-reset]')) r.onclick = () => commit(c0 => {const f = FIELD_BY_ID[r.dataset.reset];c0.animProfile = setField(c0.animProfile, profileKey(c0), f.id, null);if (f.store && f.id === 'speed') delete c0.speeds[S.action];});
    // Hitboxes
    const hbList = () => [...(c.animProfile.hitboxes[key] || [])];
    box.querySelector('[data-hb-has]')?.addEventListener('change', e => commit(c0 => {c0.animProfile = setHitboxes(c0.animProfile, key, e.target.checked ? [normalizeHitbox({shape: 'sphere', size: [.6, .6, .6], start: .25, end: .6})] : []);}));
    box.querySelector('[data-hb-add]')?.addEventListener('click', () => {S.hit = hbList().length;commit(c0 => {c0.animProfile = setHitboxes(c0.animProfile, key, [...hbList(), normalizeHitbox({shape: 'sphere', size: [.6, .6, .6], start: .25, end: .6})]);});});
    box.querySelector('[data-hb-del]')?.addEventListener('click', () => {const l = hbList();l.splice(S.hit, 1);S.hit = Math.max(0, S.hit - 1);commit(c0 => {c0.animProfile = setHitboxes(c0.animProfile, key, l);});});
    box.querySelector('[data-hb-sel]')?.addEventListener('change', e => {S.hit = Number(e.target.value);refresh({keepList: true});});
    for (const el of box.querySelectorAll('[data-hb]')) {
      const apply = () => {
        const l = hbList(), h = {...l[S.hit]}, [k, i] = el.dataset.hb.split('.');
        if (i !== undefined) {h[k] = [...h[k]];h[k][+i] = Number(el.value);} else h[k] = el.type === 'range' ? Number(el.value) : el.value;
        l[S.hit] = h;commit(c0 => {c0.animProfile = setHitboxes(c0.animProfile, key, l);});
      };
      el.onchange = apply;
    }
    // Marcadores
    const mkList = () => [...(c.animProfile.markers[key] || [])];
    box.querySelector('[data-mk-add]')?.addEventListener('click', () => {const kind = box.querySelector('[data-mk-kind]').value, name = box.querySelector('[data-mk-name]').value;commit(c0 => {c0.animProfile = setMarkers(c0.animProfile, key, [...mkList(), normalizeMarker({kind, name, at: .5})]);});});
    for (const d of box.querySelectorAll('[data-mk-del]')) d.onclick = () => {const l = mkList();l.splice(Number(d.dataset.mkDel), 1);commit(c0 => {c0.animProfile = setMarkers(c0.animProfile, key, l);});};
    for (const m of box.querySelectorAll('[data-mk]')) m.onchange = () => {const l = mkList();l[Number(m.dataset.mk)] = {...l[Number(m.dataset.mk)], at: Number(m.value)};commit(c0 => {c0.animProfile = setMarkers(c0.animProfile, key, l);});};
  }

  // ---------- Transporte e timeline ----------
  function refreshTransport() {
    const c = ch(), el = root.querySelector('[data-transport]');
    if (!el) return;
    const playing = !!(c?.preview && !c.preview.paused);
    el.querySelector('[data-play]').textContent = playing ? '⏸ Pausar' : '▶ Tocar';
    el.querySelector('[data-loop]').checked = S.loop;
  }
  /** Fases que a simulação declara para o Move da identidade selecionada (referência somente leitura). */
  function gameTracksOf() {
    const mv = moveIdentity(S.action);
    return mv ? gameTracksFromPhases(effectiveMovePhases(mv, mv.group ? C.world[mv.group] : null)) : [];
  }
  function renderTimeline() {
    const c = ch(), box = root.querySelector('[data-tl]');
    if (!c) {box.innerHTML = '';return;}
    const i = clipIndex(c);
    if (i == null) {box.innerHTML = `<p class="hint">Sem clipe associado a «${esc(labelOf(S.action))}»: não há timeline. Associe ou importe um clipe na aba Visão geral.</p>`;return;}
    const dur = c.clips[i].duration, values = allValues(c), speed = values.speed || 1, key = profileKey(c);
    const tl = buildTimeline({duration: dur, speed, glbEvents: c.source.eventsByClip?.[i] || [], values: {...values, loop: values.loop}, hitboxes: c.animProfile.hitboxes[key] || [], markers: c.animProfile.markers[key] || [], gameTracks: gameTracksOf()});
    const [t0, t1] = [values.trimStart / 100, values.trimEnd / 100];
    const ticks = Array.from({length: 11}, (_, n) => `<span style="left:${n * 10}%">${(tl.playSeconds * n / 10).toFixed(2)}</span>`).join('');
    const rows = tl.tracks.map(t => {
      const k = TRACK_KINDS[t.kind], editable = ['active', 'invuln', 'cancel', 'startup'].includes(t.kind);
      return `<div class="ae-track"><span class="ae-tn">${esc(t.label)}</span><div class="ae-lane"><div class="ae-seg ${t.origin}" style="left:${t.start * 100}%;width:${Math.max(.6, (t.end - t.start) * 100)}%;background:${k.color}" title="${esc(t.label)}: ${t.seconds[0].toFixed(3)}–${t.seconds[1].toFixed(3)} s (${Math.round(t.start * 100)}–${Math.round(t.end * 100)} %) · origem ${t.origin}">${editable ? `<b class="ae-h l" data-h="${t.kind}.s"></b><b class="ae-h r" data-h="${t.kind}.e"></b>` : ''}</div></div></div>`;
    }).join('');
    const ev = tl.events.map(e => `<i class="ae-ev ${e.origin}" style="left:${e.at * 100}%" title="${esc(e.label)} · ${e.seconds.toFixed(3)} s · ${e.origin}"></i>`).join('');
    box.innerHTML = `<div class="ae-ruler">${ticks}</div><div class="ae-tracks">${rows}<div class="ae-track"><span class="ae-tn">Eventos</span><div class="ae-lane">${ev}</div></div><div class="ae-trim" style="left:110px;width:calc((100% - 110px) * ${t0})"></div><div class="ae-trim" style="left:calc(110px + (100% - 110px) * ${t1});right:0"></div><div class="ae-playhead" data-head></div></div>
      <div class="ae-tl-info"><span data-time>0.000 s</span> · clipe ${dur.toFixed(3)} s · jogo ${tl.playSeconds.toFixed(3)} s (${speed.toFixed(2)}×)</div>`;
    const lanes = box.querySelector('.ae-tracks');
    lanes.onpointerdown = e => {
      if (e.target.dataset.h) return startHandleDrag(e, e.target.dataset.h, lanes, dur, values);
      const r = lanes.querySelector('.ae-lane').getBoundingClientRect();
      const seekFrom = ev0 => seekTo(Math.min(1, Math.max(0, (ev0.clientX - r.left) / r.width)) * dur);
      seekFrom(e);lanes.setPointerCapture(e.pointerId);lanes.onpointermove = seekFrom;lanes.onpointerup = () => {lanes.onpointermove = null;};
    };
  }
  function startHandleDrag(e, spec, lanes, dur, values) {
    const [kind, side] = spec.split('.'), map = {active: ['activeStart', 'activeEnd'], invuln: ['invulnStart', 'invulnEnd'], cancel: ['cancelStart', null], startup: [null, 'startup']}[kind];
    const fid = side === 's' ? map[0] : map[1] ?? map[0];if (!fid) return;
    e.preventDefault();const lane = lanes.querySelector('.ae-lane'), r = lane.getBoundingClientRect(), c = ch();
    const before = snap(c);let last = null;
    lanes.setPointerCapture(e.pointerId);
    lanes.onpointermove = ev => {last = Math.round(Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)) * 100);e.target.parentElement.title = `${fid}: ${last} %`;e.target.parentElement.style[side === 's' ? 'left' : 'width'] = '';
      root.querySelector('[data-time]').textContent = `${fid} → ${last} % (${(last / 100 * dur).toFixed(3)} s)`;};
    lanes.onpointerup = () => {lanes.onpointermove = null;lanes.onpointerup = null;if (last == null) return;
      S.undo.push(before);S.redo.length = 0;c.animProfile = setField(c.animProfile, profileKey(c), fid, last);c.save();onChanged();refresh({keepList: true});};
  }
  // ---------- Hitboxes visíveis sobre o personagem ----------
  let hbVis = {sig: '', owner: null, meshes: []};
  function clearHitboxVisuals() {for (const m of hbVis.meshes) {m.removeFromParent();m.geometry.dispose();m.material.dispose();}hbVis = {sig: '', owner: null, meshes: []};}
  const HB_COLORS = [0xff4d8d, 0xffb54a, 0x4de1e1, 0xc78bff];
  function syncHitboxVisuals() {
    const c = ch(), list = S.open && c && clipIndex(c) != null ? c.animProfile.hitboxes[profileKey(c)] || [] : [];
    const sig = c ? `${S.slot}|${profileKey(c)}|${JSON.stringify(list)}` : '';
    if (sig !== hbVis.sig) {
      clearHitboxVisuals();
      if (c && list.length) {
        hbVis.owner = c;
        list.forEach((h, n) => {
          const geo = h.shape === 'box' ? new THREE.BoxGeometry(1, 1, 1) : h.shape === 'capsule' ? new THREE.CapsuleGeometry(.5, .6, 4, 12) : new THREE.SphereGeometry(.5, 14, 10);
          const mat = new THREE.MeshBasicMaterial({color: HB_COLORS[n % HB_COLORS.length], wireframe: true, transparent: true, opacity: .9, depthTest: false});
          const mesh = new THREE.Mesh(geo, mat);mesh.renderOrder = 999;mesh.userData.hb = h;
          ((h.bone && c.model.getObjectByName(h.bone)) || c.presentation).add(mesh);hbVis.meshes.push(mesh);
        });
      }
      hbVis.sig = sig;
    }
    if (!c || !hbVis.meshes.length) return;
    const i = clipIndex(c), dur = c.clips[i].duration, t = c.preview && c.current?.action ? c.current.action.time : S.seek, frac = dur ? t / dur : 0, sc = new THREE.Vector3();
    for (const m of hbVis.meshes) {
      const h = m.userData.hb, p = m.parent;p.getWorldScale(sc);
      const rs = (v, k) => v / Math.max(1e-4, Math.abs(k));
      const on = frac >= h.start && frac <= h.end;
      m.material.opacity = on ? .95 : .18;
      m.scale.set(rs(h.size[0], sc.x), rs(h.size[1], sc.y), rs(h.size[2], sc.z));
      m.position.set(rs(h.position[0], sc.x), rs(h.position[1], sc.y), rs(h.position[2], sc.z));
      m.rotation.set(h.rotation[0] * Math.PI / 180, h.rotation[1] * Math.PI / 180, h.rotation[2] * Math.PI / 180);
    }
  }
  function liveHead() {
    if (!S.open) return;
    syncHitboxVisuals();
    const c = ch(), head = root.querySelector('[data-head]');
    if (!c || !head) return;
    const i = clipIndex(c);if (i == null) return;
    const dur = c.clips[i].duration, playing = c.preview && c.current?.action;
    const t = playing ? c.current.action.time : S.seek;
    head.style.left = `calc(110px + (100% - 110px) * ${Math.min(1, Math.max(0, t / dur))})`;
    const lab = root.querySelector('[data-time]');
    if (lab && !lab.textContent.includes('→')) lab.textContent = `${t.toFixed(3)} s · ${(t / dur * 100).toFixed(0)} % · quadro ${Math.round(t * 30)}`;
    const play = root.querySelector('[data-play]');if (play) play.textContent = c.preview && !c.preview.paused ? '⏸ Pausar' : '▶ Tocar';
  }

  // ---------- Montagem ----------
  function build() {
    root.innerHTML = `<div class="ae-head"><div class="ae-title"><strong data-title></strong><small data-path></small></div>
      <div class="ae-fighters"><button type="button" data-slot="0" aria-pressed="true">🔵 Azul</button><button type="button" data-slot="1" aria-pressed="false">🔴 Vermelho</button></div>
      <div class="ae-tools"><button type="button" data-undo title="Desfazer (Ctrl+Z)">↶</button><button type="button" data-redo title="Refazer (Ctrl+Y)">↷</button><button type="button" data-export title="Baixa o perfil de animações deste personagem (preset .json)">⬇ Exportar</button><label class="btn-file" title="Aplica um perfil .json exportado"><input type="file" accept=".json" data-import-profile hidden>⬆ Importar</label><button type="button" data-copy title="Copia o perfil do outro lutador para este">⎘ Copiar do outro</button></div>
      <div class="ae-tools"><span class="ae-saved" data-saved>✓ Salvo</span><button type="button" data-save class="primary" title="As edições já são salvas ao soltar cada controle; este botão grava de novo e confirma.">Salvar</button><button type="button" data-close title="Fechar (Esc)">Fechar ✕</button></div></div>
      <div class="ae-tabs">${TABS.map(([id, name]) => `<button type="button" data-tab="${id}" aria-pressed="${id === S.tab}" title="${TAB_TIPS[id]}">${name}</button>`).join('')}</div>
      <div class="ae-body"><div class="ae-left"><div class="ae-search"><input type="search" data-search placeholder="Buscar animação…" title="Filtra a lista pelo nome"><label class="check"><input type="checkbox" data-missing title="Mostra só as animações sem clipe próprio"> só ausentes</label></div><div class="ae-count" data-count></div><div class="ae-listbox" data-list></div></div>
      <div class="ae-div v" data-div="left" role="separator" aria-orientation="vertical" tabindex="0" title="Arraste para redimensionar · clique para recolher/abrir"></div>
      <div class="ae-center"><div class="ae-stage" data-stage><div class="ae-transport" data-transport><button type="button" data-play title="Toca ou pausa a animação no personagem real">▶ Tocar</button><button type="button" data-stop title="Para a prévia e volta ao jogo">⏹</button><button type="button" data-step="-1" title="Quadro anterior">⏮</button><button type="button" data-step="1" title="Próximo quadro">⏭</button><label class="check" title="Repete a prévia em laço (não muda o jogo)"><input type="checkbox" data-loop checked> laço</label></div><div class="ae-stage-note">O personagem real aparece na arena (atrás deste painel).</div></div></div>
      <div class="ae-div v" data-div="right" role="separator" aria-orientation="vertical" tabindex="0" title="Arraste para redimensionar · clique para recolher/abrir"></div>
      <div class="ae-right"><div data-props class="ae-props"></div></div></div>
      <div class="ae-div h" data-div="bottom" role="separator" aria-orientation="horizontal" tabindex="0" title="Arraste para redimensionar · clique para recolher/abrir"></div>
      <div class="ae-bottom"><div data-tl class="ae-tl"></div></div>`;
    wire();applyLayout();
  }
  function applyLayout() {
    root.style.setProperty('--ae-left', (L.cl ? MIN_STRIP : L.left) + 'px');root.style.setProperty('--ae-right', (L.cr ? MIN_STRIP : L.right) + 'px');root.style.setProperty('--ae-bottom', (L.cb ? MIN_STRIP : L.bottom) + 'px');
    root.classList.toggle('cl', L.cl);root.classList.toggle('cr', L.cr);root.classList.toggle('cb', L.cb);
  }
  function wire() {
    root.querySelector('[data-close]').onclick = () => close();
    root.querySelector('[data-save]').onclick = () => {const c = ch();if (c) {c.save();S.saved = true;root.querySelector('[data-saved]').textContent = '✓ Salvo agora';}};
    root.querySelector('[data-undo]').onclick = undo;root.querySelector('[data-redo]').onclick = redo;
    for (const b of root.querySelectorAll('[data-slot]')) b.onclick = () => {S.slot = Number(b.dataset.slot);S.undo.length = 0;S.redo.length = 0;stopPlay();for (const x of root.querySelectorAll('[data-slot]')) x.setAttribute('aria-pressed', String(x === b));refresh();};
    for (const b of root.querySelectorAll('[data-tab]')) b.onclick = () => {S.tab = b.dataset.tab;for (const x of root.querySelectorAll('[data-tab]')) x.setAttribute('aria-pressed', String(x === b));renderProps();};
    root.querySelector('[data-search]').oninput = e => {S.search = e.target.value;renderList();};
    root.querySelector('[data-missing]').onchange = e => {S.onlyMissing = e.target.checked;renderList();};
    root.querySelector('[data-play]').onclick = playPause;
    root.querySelector('[data-stop]').onclick = stopPlay;
    root.querySelector('[data-loop]').onchange = e => {S.loop = e.target.checked;if (ch()?.preview) startPlay();};
    for (const b of root.querySelectorAll('[data-step]')) b.onclick = () => {const c = ch(), i = c && clipIndex(c);if (i == null) return;const t = c.current?.action.time ?? S.seek;seekTo(Math.min(c.clips[i].duration, Math.max(0, t + Number(b.dataset.step) / 30)));};
    root.querySelector('[data-export]').onclick = () => {const c = ch();if (!c) return;const a = document.createElement('a');a.href = URL.createObjectURL(new Blob([JSON.stringify({kind: 'arenamon-anim-profile', character: c.source.name, profile: c.animProfile, speeds: c.speeds, playback: c.playback}, null, 2)], {type: 'application/json'}));a.download = `perfil-animacoes-${(c.source.name || 'personagem').replace(/\W+/g, '_')}.json`;a.click();setTimeout(() => URL.revokeObjectURL(a.href), 500);};
    root.querySelector('[data-import-profile]').onchange = async e => {
      const file = e.target.files[0];if (!file) return;
      try {const d = JSON.parse(await file.text());if (d.kind !== 'arenamon-anim-profile') throw Error('Arquivo não é um perfil de animações do Arenamon.');
        commit(c => {c.animProfile = migrateProfile(d.profile);Object.assign(c.speeds, d.speeds || {});Object.assign(c.playback, d.playback || {});});} catch (err) {root.querySelector('[data-saved]').textContent = '⛔ ' + err.message;}
      e.target.value = '';
    };
    root.querySelector('[data-copy]').onclick = () => {const other = ui.characters[1 - S.slot];if (!other) return;commit(c => {c.animProfile = migrateProfile(JSON.parse(JSON.stringify(other.animProfile)));});};
    for (const d of root.querySelectorAll('[data-div]')) wireDivider(d);
  }
  function wireDivider(d) {
    const which = d.dataset.div, vertical = which !== 'bottom';
    let start = null;
    d.onpointerdown = e => {d.setPointerCapture(e.pointerId);start = {x: e.clientX, y: e.clientY, v: which === 'left' ? L.left : which === 'right' ? L.right : L.bottom, moved: false};};
    d.onpointermove = e => {
      if (!start) return;const dx = e.clientX - start.x, dy = e.clientY - start.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) start.moved = true;if (!start.moved) return;
      if (which === 'left') {L.cl = false;L.left = Math.min(520, Math.max(160, start.v + dx));}
      else if (which === 'right') {L.cr = false;L.right = Math.min(620, Math.max(220, start.v - dx));}
      else {L.cb = false;L.bottom = Math.min(root.clientHeight - 200, Math.max(110, start.v - dy));}
      applyLayout();
    };
    d.onpointerup = () => {if (start && !start.moved) {const k = which === 'left' ? 'cl' : which === 'right' ? 'cr' : 'cb';L[k] = !L[k];applyLayout();}start = null;saveLayout();};
    d.onkeydown = e => {if (e.key === 'Enter' || e.key === ' ') {e.preventDefault();const k = which === 'left' ? 'cl' : which === 'right' ? 'cr' : 'cb';L[k] = !L[k];applyLayout();saveLayout();}};
    d.dataset.vertical = vertical;
  }
  function refresh({keepList = false} = {}) {
    const c = ch();
    root.querySelector('[data-title]').textContent = labelOf(S.action);
    const grp = ANIMATION_GROUPS.find(([, , ids]) => ids.includes(S.action)) ?? (moveIdentity(S.action) ? ['moves', 'Moves (por identidade)'] : null);
    root.querySelector('[data-path]').textContent = `${c ? c.source.name : 'sem personagem'} › ${grp ? grp[1] : '—'} › ${S.action}${c && clipName(c) ? ' › ' + clipName(c) : ''}`;
    root.querySelector('[data-undo]').disabled = !S.undo.length;root.querySelector('[data-redo]').disabled = !S.redo.length;
    root.querySelector('[data-saved]').textContent = S.saved ? '✓ Salvo' : '● Alterado';
    if (!keepList || true) renderList();
    renderProps();renderTimeline();refreshTransport();
  }
  let timer = null;
  function open(action) {
    if (!root.firstChild) build();
    if (action) S.action = action;
    root.hidden = false;S.open = true;$('anim-open')?.setAttribute('aria-expanded', 'true');
    $('anim-open')?.classList.add('active');
    refresh();clearInterval(timer);timer = setInterval(liveHead, 60);
  }
  function close() {
    stopPlay();root.hidden = true;S.open = false;clearInterval(timer);clearHitboxVisuals();$('anim-open')?.setAttribute('aria-expanded', 'false');$('anim-open')?.classList.remove('active');
  }
  window.addEventListener('keydown', e => {
    if (!S.open) return;
    if (e.key === 'Escape' && !e.target.matches?.('input[type=text],input[type=search]')) {e.preventDefault();e.stopImmediatePropagation();close();return;}
    if ((e.ctrlKey || e.metaKey) && !e.target.matches?.('input,textarea,select')) {if (e.key === 'z') {e.preventDefault();undo();} else if (e.key === 'y') {e.preventDefault();redo();}}
  }, true);
  $('anim-open')?.addEventListener('click', () => (S.open ? close() : open()));
  return {open, close, isOpen: () => S.open, select, state: S, JUMP_PHASES};
}
