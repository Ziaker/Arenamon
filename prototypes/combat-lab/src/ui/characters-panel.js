// Aba Personagens: modelos, blocos de animação (estados) com várias variantes, biblioteca de clipes (com importação),
// prévia, altura visual e telemetria da máquina de estados de animação.
import {Character, loadStudioFile, loadAnimationFile, ACTION_IDS, STATE_LABELS, VERTICAL_MOTION_FREE_GROUPS} from '../view/characters.js';
import {escape} from './tuning.js';
import {validateModel, validateAnimations} from '../view/validate.js';
import {installNewPanel} from './characters-new.js';
import {C} from '../sim/config.js';
import {listMoves} from '../sim/moves.js';
import {phaseReports, PHASE_FIELDS} from '../sim/phase-contract.js';


const ACTION_CATS = {
  moves: ['tackle', 'tackle_charge', 'tackle_pl2', 'tackle_pl3', 'brake', 'wall_splat', 'meteor_prep', 'meteor_dive', 'meteor_ground', 'dodge_forward', 'dodge_back', 'dodge_left', 'dodge_right', 'jump'],
  loco: ['idle', 'turn', 'walk', 'walk_back', 'walk_left', 'walk_right', 'sprint', 'sprint_back', 'sprint_left', 'sprint_right', 'walk_stop', 'sprint_stop'],
  react: ['block_start', 'block', 'block_end', 'guard_impact', 'blocked', 'hit', 'knockback', 'fall', 'land', 'recover', 'downed', 'death'],
};
export const ACTION_LABELS = {idle: 'Parado', turn: 'Girar no lugar', walk: 'Andar para frente', walk_back: 'Andar para trás', walk_left: 'Andar para esquerda', walk_right: 'Andar para direita',
  sprint: 'Sprint para frente', sprint_back: 'Sprint para trás', sprint_left: 'Sprint para esquerda', sprint_right: 'Sprint para direita', walk_stop: 'Freio da caminhada', sprint_stop: 'Freio do sprint', block_start: 'Entrar na defesa', block: 'Defesa', block_end: 'Sair da defesa',
  guard_impact: 'Impacto na defesa', blocked: 'Recuo (bloqueado)', tackle: 'Tackle PL1 (X)', tackle_charge: 'Carga do tackle (X segurado)', tackle_pl2: 'Tackle PL2', tackle_pl3: 'Tackle PL3', brake: 'Freio / derrapagem (finta)', wall_splat: 'Preso na parede (wall-splat)', meteor_prep: 'Meteor: preparação no ar', meteor_dive: 'Meteor: mergulho', meteor_ground: 'Meteor: no chão', dodge_forward: 'Esquiva frontal', dodge_back: 'Esquiva traseira', dodge_left: 'Esquiva esquerda',
  ledge_grab: 'Borda: agarrar (entrada)', ledge_hang: 'Borda: pendurado (laço)', ledge_climb: 'Borda: subir', ledge_drop: 'Borda: soltar', ledge_blocked: 'Borda: subida bloqueada',
  dodge_right: 'Esquiva direita', perfect_guard: 'Defesa perfeita (parry)', hit_light: 'Reação leve (hitstun)', hit_heavy: 'Reação pesada (stagger)', push: 'Empurrão', push_side: 'Empurrão lateral', hit_up: 'Reação ascendente', hit_crush: 'Prensado na parede', recovery_tackle: 'Recuperação do tackle', recovery_dodge: 'Recuperação da esquiva', recovery_move: 'Recuperação do Move', jump: 'Salto', jump_start: 'Início do pulo', jump_rise: 'Subida do pulo', jump_apex: 'Pico do pulo', jump_fall: 'Queda do pulo', hit: 'Dano', knockback: 'Lançado', fall: 'Queda', land: 'Aterrissar', recover: 'Levantar', downed: 'Caído', death: 'Derrota', move_1: 'Movimento 1', move_2: 'Movimento 2', move_3: 'Movimento 3', move_4: 'Movimento 4'};

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
    if (source) {const ch = new Character(source, {slot: id});view.scene.add(ch.root);ui.characters[id] = ch;ch.warmGround();ch.validation = validateModel(source, ch, source.bytes);ch.importValidations = [];}
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
  /** Game feel 6: modo das fases da animação, autorização por fase, tabela antes/depois e restauração fase a fase. */
  function phaseHtml(id) {
    const ch = ui.characters[id], G = C.extras.gameFeel, rep = phaseReports[id], st = rep?.tackle?.stepSeconds ?? 1 / 120;
    const fmt = w => w ? `${w[0]}–${w[1]} (${(w[0] * st).toFixed(3)}–${(w[1] * st).toFixed(3)} s)` : '—';
    const groups = [['tackle', 'Tackle X', rep?.tackle], ['dodge', 'Esquiva C', rep?.dodge], ...Object.entries(rep?.moves ?? {}).map(([m, r]) => ['move_' + m, 'Move ' + m, r])];
    const rows = groups.flatMap(([key, label, r]) => (r?.rows ?? []).map(row => {
      const auth = PHASE_FIELDS.find(p => p.key === row.key).auth, off = !!ch?.phaseOff?.[key]?.[row.key], live = G.phaseMode === 1 && G[auth];
      const btn = !live ? '' : off ? `<button type="button" data-reauth="${key}|${row.key}" title="Autoriza de novo a fase vinda da animação, só neste personagem e nesta ação">Reautorizar</button>` : `<button type="button" data-restore="${key}|${row.key}" title="Volta esta fase para a definição do Move, só neste personagem e nesta ação (os outros não mudam)">Restaurar</button>`;
      return `<tr><td>${label}</td><td>${row.phase}</td><td>${fmt(row.definition)}</td><td>${fmt(row.animation)}</td><td>${escape(row.status)}${off ? ' · restaurado à definição aqui' : ''}</td><td>${btn}</td></tr>`;
    })).join('');
    const errs = groups.flatMap(([, , r]) => r?.errors ?? []).map(e => `<div class="warn">⚠ ${escape(e)}</div>`).join('');
    const moves = listMoves().filter(m => !m.charge).map(m => `<label class="field">${escape(m.name ?? m.id)} <select data-track-profile="${m.id}">${[['', 'Padrão do Move'], ['head', 'Só cabeça'], ['headTorso', 'Cabeça e tronco'], ['aim', 'Cabeça + membro de mira'], ['off', 'Desligado']].map(([v, t]) => `<option value="${v}" ${(ch?.trackProfile?.[m.id] ?? '') === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>`).join('');
    return `<h4>Fases da animação nos tempos do combate</h4>
      <label class="field">Fonte dos tempos <select data-phase-mode>${['Definição do Move (padrão)', 'Animação aprovada', 'Comparar (não aplica)'].map((t, i) => `<option value="${i}" ${G.phaseMode === i ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      ${PHASE_FIELDS.map(p => `<label class="check"><input type="checkbox" data-phase-auth="${p.auth}" ${G[p.auth] ? 'checked' : ''}> Autorizar: ${p.label.toLowerCase()} vinda da animação (todos os personagens)</label>`).join('')}
      <table class="mini"><tr><th>Ação</th><th>Fase</th><th>Definição (passos)</th><th>Animação (passos)</th><th>Estado</th><th></th></tr>${rows || '<tr><td colspan="6">Sem clipe de tackle/esquiva/Move com marcadores neste personagem.</td></tr>'}</table>${errs}
      <p class="hint">As fases vêm dos marcadores do clipe e dos campos «Ativo/Cancelamento/Invencível» do editor de animações (aba Combate). Se o contrato for inválido, vale a definição inteira (nunca aplica parte). O contrato resolvido viaja com a partida salva e com o replay.</p>
      <details><summary>Olhar para o alvo travado: perfil por Move</summary><div class="row">${moves}</div><p class="hint">«Cabeça + membro de mira» gira o braço direito até o alcance de Ajustes › Visual › Game feel 5–9. Só vale para Moves com alvo travado pela simulação.</p></details>`;
  }
  function bindPhases(body, id) {
    const ch = ui.characters[id];
    const redraw = () => {const box = body.querySelector('[data-phases]');if (box) {box.innerHTML = phaseHtml(id);bindPhases(body, id);}};
    const apply = () => {ch?.save();onCharactersChanged();redraw();};
    const sel = body.querySelector('[data-phase-mode]');if (sel) sel.onchange = () => {C.extras.gameFeel.phaseMode = Number(sel.value);apply();};
    for (const b of body.querySelectorAll('[data-phase-auth]')) b.onchange = () => {C.extras.gameFeel[b.dataset.phaseAuth] = b.checked ? 1 : 0;apply();};
    for (const b of body.querySelectorAll('[data-restore]')) b.onclick = () => {const [k, ph] = b.dataset.restore.split('|');((ch.phaseOff[k] ??= {})[ph]) = true;apply();};
    for (const b of body.querySelectorAll('[data-reauth]')) b.onclick = () => {const [k, ph] = b.dataset.reauth.split('|');if (ch.phaseOff[k]) {delete ch.phaseOff[k][ph];if (!Object.keys(ch.phaseOff[k]).length) delete ch.phaseOff[k];}apply();};
    for (const s of body.querySelectorAll('[data-track-profile]')) s.onchange = () => {if (s.value) ch.trackProfile[s.dataset.trackProfile] = s.value;else delete ch.trackProfile[s.dataset.trackProfile];ch.save();};
  }
  function heightBox(id, ch) {
    const body = document.createElement('div');
    const scaleRow = (kind, label, value) => `<label class="field">${label} <output data-${kind}-out>${value.toFixed(2)}×</output><input type="range" min="0.5" max="3" step="0.05" value="${value}" data-${kind}-scale></label>`;
    const free = VERTICAL_MOTION_FREE_GROUPS.map(g => `<label class="check"><input type="checkbox" data-free="${g.id}" ${ch.freeVerticalMotion.includes(g.id) ? 'checked' : ''}> ${g.label} fora da trava vertical (sobe/desce)</label>`).join('');
    body.innerHTML = `<div class="row">${scaleRow('height', 'Altura (×)', ch.heightScale)}${scaleRow('width', 'Largura (×)', ch.widthScale)}</div>
      <label class="field">Altura visual do ${id ? 'vermelho' : 'azul'} <output data-out>${ch.visualOffset.toFixed(2)} m</output><input type="range" min="-1" max="1" step="0.01" value="${ch.visualOffset}" data-offset></label>
      <div class="row">
        <label class="field">Borda: ajuste vertical da pose <output data-ly-out>${ch.ledgeOffset.y.toFixed(2)} m</output><input type="range" min="-0.5" max="0.5" step="0.01" value="${ch.ledgeOffset.y}" data-ledge="y"></label>
        <label class="field">Borda: ajuste horizontal (rumo à parede) <output data-lz-out>${ch.ledgeOffset.z.toFixed(2)} m</output><input type="range" min="-0.5" max="0.5" step="0.01" value="${ch.ledgeOffset.z}" data-ledge="z"></label>
      </div>
      <label class="check"><input type="checkbox" data-foot ${ch.footEnabled ? 'checked' : ''}> Apoio visual dos pés (IK) neste personagem <small>(vale só com «Apoio visual dos pés» ligado em Ajustes › Visual › Game feel 5–9)</small></label>
      <label class="check"><input type="checkbox" data-track ${ch.trackEnabled ? 'checked' : ''}> Olhar para o alvo travado neste personagem <small>(vale só com o rastreamento ligado em Ajustes › Visual › Game feel 5–9)</small></label>
      <p class="hint" data-rigdiag>${ch.rigDiagnostic ? ch.rigDiagnostic() : ''}</p>
      <div class="phase-box" data-phases>${phaseHtml(id)}</div>
      <label class="check"><input type="checkbox" data-auto ${ch.autoGround ? 'checked' : ''}> Ajuste automático por animação (apoia o ponto mais baixo de cada clipe no chão)</label>
      <label class="check"><input type="checkbox" data-root-lock ${ch.lockRootMotion ? 'checked' : ''}> Travar deslocamento horizontal da animação (mundo X/Z)</label>
      <label class="check"><input type="checkbox" data-ground-lock ${ch.lockToGround ? 'checked' : ''}> Travar no chão (remove o deslocamento vertical gravado na animação)</label>
      <div class="hint">${free}<br>Os grupos marcados ignoram a trava no chão apenas no sobe/desce; o clipe pode subir, mas nunca afunda abaixo do piso. O deslocamento horizontal (X/Z) continua sempre travado.</div>
      <p class="hint" data-ground></p><p class="hint">Escala e altura são só visuais: colisor, sombra, saltos e lançamentos continuam seguindo a física. Compensação extra por clipe: Biblioteca.</p>`;
    const r = body.querySelector('[data-offset]');r.oninput = () => {ch.visualOffset = Number(r.value);body.querySelector('[data-out]').textContent = `${ch.visualOffset.toFixed(2)} m`;};r.onchange = () => ch.save();
    bindPhases(body, id);
    for (const ax of ['y', 'z']) {const s = body.querySelector(`[data-ledge="${ax}"]`), o = body.querySelector(`[data-l${ax}-out]`);s.oninput = () => {ch.ledgeOffset[ax] = Number(s.value);o.textContent = `${ch.ledgeOffset[ax].toFixed(2)} m`;};s.onchange = () => ch.save();}
    for (const [sel, prop] of [['[data-foot]', 'footEnabled'], ['[data-track]', 'trackEnabled']]) {const b = body.querySelector(sel);b.onchange = () => {ch[prop] = b.checked;ch.save();};}
    for (const kind of ['height', 'width']) {
      const input = body.querySelector(`[data-${kind}-scale]`), out = body.querySelector(`[data-${kind}-out]`);
      input.oninput = () => {ch[kind + 'Scale'] = Number(input.value);out.textContent = `${ch[kind + 'Scale'].toFixed(2)}×`;};
      input.onchange = () => ch.save();
    }
    for (const cb of body.querySelectorAll('[data-free]')) cb.onchange = () => {
      const set = new Set(ch.freeVerticalMotion);
      if (cb.checked) set.add(cb.dataset.free);else set.delete(cb.dataset.free);
      ch.freeVerticalMotion = VERTICAL_MOTION_FREE_GROUPS.map(g => g.id).filter(id => set.has(id));
      ch.save();
    };
    body.querySelector('[data-auto]').onchange = e => {ch.autoGround = e.target.checked;ch.save();};
    body.querySelector('[data-root-lock]').onchange = e => {ch.lockRootMotion = e.target.checked;ch.save();};
    body.querySelector('[data-ground-lock]').onchange = e => {ch.lockToGround = e.target.checked;ch.save();};
    return fold('Tamanho, altura visual e apoio no chão', `h${id}`, body, {open: false});
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
