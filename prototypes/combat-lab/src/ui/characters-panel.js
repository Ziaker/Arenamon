// Aba Personagens: modelos, blocos de animação (estados) com várias variantes, biblioteca de clipes (com importação),
// prévia, altura visual e telemetria da máquina de estados de animação.
import {Character, loadStudioFile, loadAnimationFile, ACTION_IDS, STATE_LABELS} from '../view/characters.js';
import {escape} from './tuning.js';
import {validateModel, validateAnimations} from '../view/validate.js';
import {installNewPanel} from './characters-new.js';


const ACTION_CATS = {
  moves: ['tackle', 'tackle_charge', 'tackle_pl2', 'tackle_pl3', 'brake', 'wall_splat', 'meteor_prep', 'meteor_dive', 'meteor_ground', 'dodge_forward', 'dodge_back', 'dodge_left', 'dodge_right', 'jump'],
  loco: ['idle', 'turn', 'walk', 'walk_back', 'walk_left', 'walk_right', 'run', 'run_back', 'run_left', 'run_right', 'sprint', 'sprint_back', 'sprint_left', 'sprint_right', 'walk_stop', 'sprint_stop'],
  react: ['block_start', 'block', 'block_end', 'guard_impact', 'blocked', 'hit', 'knockback', 'fall', 'land', 'recover', 'downed', 'death'],
};
export const ACTION_LABELS = {idle: 'Parado', turn: 'Girar no lugar', walk: 'Andar para frente', walk_back: 'Andar para trás', walk_left: 'Andar para esquerda', walk_right: 'Andar para direita',
  run: 'Correr para frente', run_back: 'Correr para trás', run_left: 'Correr para esquerda', run_right: 'Correr para direita', sprint: 'Sprint para frente', sprint_back: 'Sprint para trás', sprint_left: 'Sprint para esquerda', sprint_right: 'Sprint para direita', walk_stop: 'Freio da caminhada', sprint_stop: 'Freio do sprint', block_start: 'Entrar na defesa', block: 'Defesa', block_end: 'Sair da defesa',
  guard_impact: 'Impacto na defesa', blocked: 'Recuo (bloqueado)', tackle: 'Tackle PL1 (X)', tackle_charge: 'Carga do tackle (X segurado)', tackle_pl2: 'Tackle PL2', tackle_pl3: 'Tackle PL3', brake: 'Freio / derrapagem (finta)', wall_splat: 'Preso na parede (wall-splat)', meteor_prep: 'Meteor: preparação no ar', meteor_dive: 'Meteor: mergulho', meteor_ground: 'Meteor: no chão', dodge_forward: 'Esquiva frontal', dodge_back: 'Esquiva traseira', dodge_left: 'Esquiva esquerda',
  dodge_right: 'Esquiva direita', jump: 'Salto', hit: 'Dano', knockback: 'Lançado', fall: 'Queda', land: 'Aterrissar', recover: 'Levantar', downed: 'Caído', death: 'Derrota', move_1: 'Movimento 1', move_2: 'Movimento 2', move_3: 'Movimento 3', move_4: 'Movimento 4'};

/** Seção recolhível com botão ▼ (estado lembrado por chave). */
const openState = new Map();
export function fold(title, key, body, {open = false, count = null} = {}) {
  const box = document.createElement('div');box.className = 'fold';
  const head = document.createElement('div');head.className = 'fold-head';
  const btn = document.createElement('button');btn.type = 'button';btn.className = 'fold-btn';
  const label = document.createElement('span');label.className = 'fold-title';label.textContent = title;
  if (count !== null) {const c = document.createElement('small');c.className = 'fold-count';c.textContent = count;label.append(' ', c);}
  const set = v => {openState.set(key, v);body.hidden = !v;btn.textContent = v ? '▼' : '▶';btn.setAttribute('aria-expanded', String(v));btn.title = (v ? 'Recolher ' : 'Expandir ') + title;};
  btn.onclick = () => set(body.hidden);head.append(btn, label);body.classList.add('fold-body');box.append(head, body);set(openState.has(key) ? openState.get(key) : open);
  box.setOpen = set;return box;
}

/**
 * hooks (opcionais, instalados pelo workspace): loadModel(id, file) → carrega e persiste o GLB; useSame(); remove(id);
 * importAnimation(id, ch, file) → {report, message}; slotExtras(id, el) → acrescenta controles ao slot.
 */
export function createCharacterPanel({ui, view, $, onCharactersChanged, hooks = {}}) {
  function setCharacter(id, source) {
    ui.characters[id]?.dispose();ui.characters[id] = null;ui.sources[id] = source;
    if (source) {const ch = new Character(source, {tint: id === 1 && (ui.sources[0] === source || ui.sources[0]?.name === source.name) ? '#ff5a4a' : null, slot: id});view.scene.add(ch.root);ui.characters[id] = ch;ch.warmGround();ch.validation = validateModel(source, ch, source.bytes);ch.importValidations = [];}
    view.setCharacter(id, ui.characters[id]);render();onCharactersChanged();
  }
  /** Validação do modelo e das animações importadas: veredito, ressalvas e detalhe por clipe (com prévia). */
  function validationBox(id, ch) {
    const body = document.createElement('div');body.className = 'validation';
    const reportHtml = (r, open) => {
      const cls = ['ok', 'warn', 'bad'][r.verdict];
      return `<div class="val-report" data-kind="${r.kind}"><p><span class="badge val-${cls}">${r.label}</span> <b>${escape(r.name)}</b>${r.kind === 'animations' ? ' (importação)' : ''}</p>
        <ul class="val-issues">${r.issues.filter(i => i.level !== 'ok' || r.kind === 'model').map(i => `<li class="${i.level === 'bad' ? 'bad' : i.level === 'warn' ? 'warn' : 'muted'}">${escape(i.text)}</li>`).join('')}</ul>
        <details${open ? ' open' : ''}><summary>${r.clips.length} clipe(s)</summary><table>${r.clips.map(c => {const idx = ch.clips.findIndex(x => x.name === c.name || x.name.startsWith(c.name + ' ['));return `<tr><td><span class="badge val-${['ok', 'warn', 'bad'][c.verdict]}">${['ok', '!', '✗'][c.verdict]}</span> ${escape(c.name)}<br><small class="muted">${c.duration.toFixed(2)} s · ${c.tracks} trilhas · ${(c.coverage * 100).toFixed(0)}%${c.issues.length ? ' · ' + c.issues.map(i => escape(i.text)).join(' · ') : ''}</small></td><td>${idx >= 0 ? `<button type="button" data-val-preview="${idx}" title="Prévia antes de associar">▶</button>` : ''}</td></tr>`;}).join('')}</table></details></div>`;
    };
    const reps = [...(ch.importValidations || [])].reverse();
    body.innerHTML = (ch.validation ? reportHtml(ch.validation, false) : '') + reps.map(r => reportHtml(r, false)).join('');
    for (const b of body.querySelectorAll('[data-val-preview]')) b.onclick = () => ch.startPreview(Number(b.dataset.valPreview));
    const v = Math.max(ch.validation?.verdict ?? 0, ...reps.slice(0, 1).map(r => r.verdict));
    return fold('Validação do modelo e das animações', `v${id}`, body, {open: v > 0, count: ['Compatível', 'com ressalvas', 'Incompatível'][v]});
  }
  function heightBox(id, ch) {
    const body = document.createElement('div');
    body.innerHTML = `<label class="field">Altura visual do ${id ? 'vermelho' : 'azul'} <output data-out>${ch.visualOffset.toFixed(2)} m</output><input type="range" min="-1" max="1" step="0.01" value="${ch.visualOffset}" data-offset></label>
      <label class="check"><input type="checkbox" data-auto ${ch.autoGround ? 'checked' : ''}> Ajuste automático por animação (apoia o ponto mais baixo de cada clipe no chão)</label>
      <label class="check"><input type="checkbox" data-root-lock ${ch.lockRootMotion ? 'checked' : ''}> Travar deslocamento horizontal da animação (X/Z)</label>
      <label class="check"><input type="checkbox" data-ground-lock ${ch.lockToGround ? 'checked' : ''}> Travar no chão (remove o deslocamento vertical gravado na animação)</label>
      <p class="hint" data-ground></p><p class="hint">Só visual: saltos e lançamentos continuam seguindo a física. Compensação extra por clipe: Biblioteca.</p>`;
    const r = body.querySelector('[data-offset]');r.oninput = () => {ch.visualOffset = Number(r.value);body.querySelector('[data-out]').textContent = `${ch.visualOffset.toFixed(2)} m`;};r.onchange = () => ch.save();
    body.querySelector('[data-auto]').onchange = e => {ch.autoGround = e.target.checked;ch.save();};
    body.querySelector('[data-root-lock]').onchange = e => {ch.lockRootMotion = e.target.checked;ch.save();};
    body.querySelector('[data-ground-lock]').onchange = e => {ch.lockToGround = e.target.checked;ch.save();};
    return fold('Altura visual e apoio no chão', `h${id}`, body, {open: false});
  }
  function telemetryBox(id, ch) {
    const body = document.createElement('div');body.dataset.telemetry = id;
    body.innerHTML = `<div class="row"><button type="button" data-export>↓ Exportar telemetria (JSON)</button><button type="button" data-clear>Limpar</button><span class="muted" data-stats></span></div><div class="anim-log report" data-log></div>`;
    body.querySelector('[data-export]').onclick = () => {const a = document.createElement('a');a.href = URL.createObjectURL(new Blob([JSON.stringify({character: ch.source.name, transitions: ch.transitions, restartsAvoided: ch.restartsAvoided, log: ch.log}, null, 2)], {type: 'application/json'}));a.download = `arenamon-animacao-${id ? 'vermelho' : 'azul'}.json`;a.click();};
    body.querySelector('[data-clear]').onclick = () => {ch.log.length = 0;live();};
    return fold('Telemetria de animação', `t${id}`, body, {count: 'trocas, % tocada, motivo e origem'});
  }
  /** Atualização ~10×/s: animação atual e últimas trocas. */
  function live() {
    for (const el of document.querySelectorAll('.char-live')) {
      const ch = ui.characters[Number(el.dataset.char)];if (!ch?.current) {el.textContent = '';continue;}
      const cur = ch.current, d = cur.clip.duration || 1;
      el.innerHTML = `Agora: <b>${escape(STATE_LABELS[cur.key] || cur.key)}</b> → ${escape(cur.id)} (“${escape(ch.clips[cur.index].name)}”, ${(100 * Math.min(1, cur.action.time / d)).toFixed(0)}%, ${ch.speedOf(cur.id).toFixed(2)}×)`;
      for (const row of el.parentElement.querySelectorAll('.state-row')) row.classList.toggle('playing', row.dataset.action === cur.id);
    }
    for (const box of document.querySelectorAll('[data-telemetry]')) {
      const ch = ui.characters[Number(box.dataset.telemetry)];if (!ch || box.hidden || box.closest('[hidden]')) continue;
      box.querySelector('[data-stats]').textContent = `${ch.transitions} trocas · ${ch.restartsAvoided} reinícios evitados · ${ch.log.filter(e => e.interrupted).length} interrupções`;
      const rows = ch.log.slice(-24).reverse();
      // Lista compacta: uma linha por troca (cabe no painel estreito).
      box.querySelector('[data-log]').innerHTML = rows.map(e => `<div class="log-row${e.interrupted ? ' warn' : ''}"><span class="log-t">${e.t.toFixed(2)}</span><span class="log-main"><b>${escape(STATE_LABELS[e.from] || e.from || '—')} → ${escape(STATE_LABELS[e.to] || e.to)}</b><small>${escape(e.clipTo)}${e.variants > 1 ? ` (${String.fromCharCode(64 + e.variant)}/${e.variants})` : ''}${e.from ? ` · tocou ${e.playedSeconds.toFixed(2)} s (${e.playedPct}%)` : ''} · ${escape(e.reason)}${e.interrupted ? ' · interrompida' : ''} · ${escape(e.source)}</small></span></div>`).join('') || '<p class="hint">Nenhuma troca ainda.</p>';
    }
  }
  // Interface nova (characters-new.js): cabeçalho do modelo, lista de estados por grupos, biblioteca com arrastar e soltar.
  const NP = installNewPanel({ui, $, hooks, onCharactersChanged, setCharacter, escape, loadStudioFile, loadAnimationFile, validateAnimations, ACTION_IDS, ACTION_LABELS, STATE_LABELS, fold, openState, validationBox, heightBox, telemetryBox});
  function render() {NP.render();}
  function renderPreview() {NP.renderPreview();}
  $('char-preview-slot').onchange = renderPreview;
  $('char-preview-play').onclick = () => {const ch = ui.characters[Number($('char-preview-slot').value)], n = Number($('char-preview-clip').value);if (ch?.startPreview(n)) $('char-preview-info').textContent = `Prévia: ${ch.clips[n].name} (${ch.clips[n].duration.toFixed(2)} s), somente visual.`;};
  $('char-preview-stop').onclick = () => {ui.characters[Number($('char-preview-slot').value)]?.stopPreview();renderPreview();};
  return {render, live, setCharacter, selectFighter: id => NP.selectFighter(id)};
}
