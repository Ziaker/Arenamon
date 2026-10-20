// Gaveta de Ações (botão no canto da arena): abas Moves, Tackle, Esquiva, Bloqueio e IA. Cada aba reúne, com ícone por seção, os
// interruptores, os sliders que já existem desses sistemas (o mesmo controle do Ajustes: entra no desfazer e atualiza as outras abas)
// e os seletores de animação de cada personagem. A aba Moves é o painel de Moves (moves-panel.js).
import {ACTION_LABELS} from './characters-panel.js';

const T = 'extras.toggles.';
/** Seções de cada aba: [ícone + título, caminhos | '@Seção do Ajustes', aberta?]. Caminhos inexistentes são ignorados. */
export const ACTION_TABS = {
  tackle: {
    icon: '💥', label: 'Tackle', title: 'Tackle (X)',
    sections: [
      ['⚙ Sistemas', [T + 'enableTackle', T + 'enableChargeTackle', T + 'enableTackleFeint', T + 'enableWallSplat', T + 'enableMeteorSlam', T + 'enableFlightSlam', T + 'enableClash', T + 'enableClashPush', T + 'enableHitstop'], true],
      ['⚡ Carga e Power Level', '@Tackle carregado (PL)', true],
      ['🎭 Finta (esquiva rápida para os lados e para trás)', ['rules.feintWindow', 'rules.feintMinAngle', 'rules.feintDuration', 'rules.feintDistance', 'rules.feintCost', 'rules.feintFxOn', 'rules.feintFxIntensity', 'rules.feintFxSize', 'rules.feintFxColor'], true],
      ['🧱 Wall-splat', ['rules.wallSplatMinSpeed', 'rules.wallSplatDuration', 'rules.wallSplatDamage', 'rules.landingRecovery'], true],
      ['☄ Meteor slam e ground bounce', ['rules.slamAngle', 'rules.slamMinHeight', 'rules.slamDamage', 'rules.slamSpeedLoss', 'rules.slamRingOn', 'rules.slamRingStart', 'rules.slamRingRadius', 'rules.slamRingDuration', 'rules.slamRingThickness', 'rules.slamRingIntensity', 'rules.slamRingOpacity', 'rules.slamRingFade', 'rules.slamFxOn', 'rules.slamFxSize', 'rules.slamFxLength', 'rules.slamFxIntensity', 'rules.slamFxHeat', 'rules.slamFxSparks', 'rules.slamFxFlicker', 'rules.slamFxFadeOut', 'rules.slamGroundTime', 'rules.slamGroundRadius', 'rules.slamPrepTime', 'rules.slamHop', 'rules.slamFallTime', 'rules.slamImpactScale', 'rules.slamImpactShake', 'rules.slamRecovery', 'rules.slamLaunchHorizontal', 'rules.groundBounceForce', 'rules.slamBlockPushDistance'], true],
      ['🏃 Movimento e curva do tackle', '@Tackle (X)'],
      ['🧱 Recuo, empurrão e clash', ['rules.recoil', 'rules.recoilFraction', 'rules.clashFraction', 'rules.clashPushDistance', 'rules.clashPushDuration', 'rules.clashUp', 'rules.clashHorizontal', 'extras.combat.impactHitstop', 'extras.combat.clashHitstop']],
      ['⌨ Buffer de entrada', '@Buffer de entrada'],
    ],
    anims: ['tackle', 'tackle_charge', 'tackle_pl2', 'tackle_pl3', 'brake', 'wall_splat', 'meteor_prep', 'meteor_dive', 'meteor_ground'],
  },
  dodge: {
    icon: '💨', label: 'Esquiva', title: 'Esquiva (C) e sprint',
    sections: [
      ['⚙ Sistemas', [T + 'enableDodge', T + 'enableInvulnerability', T + 'enableVault', T + 'enableSprint', T + 'enableTechRecovery'], true],
      ['💨 Esquiva (C)', '@Esquiva (C)', true],
      ['🔀 Cancelamento C → X', '@Cancelamento C → X'],
      ['🏃 Sprint (C mantido)', '@Sprint (C mantido)'],
      ['🛟 Recovery rápido (C no ar)', ['rules.techWindow', 'rules.techMinAir', 'rules.techCost']],
    ],
    anims: ['dodge_forward', 'dodge_back', 'dodge_left', 'dodge_right', 'jump', 'sprint', 'sprint_stop'],
  },
  ai: {
    icon: '🤖', label: 'IA', title: 'IA (adversário e IA jogador)',
    sections: [
      ['⚙ Sistemas', ['extras.gameModes.enemyMode', 'extras.gameModes.playerProfile', T + 'enableEnemyAI', T + 'enemyManual', T + 'enablePlayerAI', T + 'enableAIAttack', T + 'enableAIReactive'], true],
      ['🧠 Estratégia, decisões e tackle', '@IA: estratégia e decisões', true],
      ['🔴 Personalidade do vermelho', '@IA: personalidade do vermelho'],
      ['🔵 Personalidade do azul (IA jogador)', '@IA: personalidade do azul (IA jogador)'],
      ['⏱ Ritmo legado', ['test.aiInterval', 'test.aiRange']],
    ],
    anims: [],
  },
  block: {
    icon: '🛡', label: 'Bloqueio', title: 'Bloqueio (D)',
    sections: [
      ['⚙ Sistemas', [T + 'enableDefense', T + 'enableCounterBonus'], true],
      ['🛡 Defesa e defesa perfeita', ['rules.guardStun', 'rules.perfect', 'rules.perfectCooldown', 'rules.guardSpeed', 'rules.guardTurn', 'rules.guardAcceleration', 'extras.combat.guardDamageMultiplier', 'extras.combat.guardFrontAlignment', 'extras.combat.perfectGuardCounterWindow', 'extras.combat.guardRegenFactor'], true],
      ['⚡ Stamina', ['rules.staminaMax', 'rules.regenDelay', 'rules.regenTime', 'rules.exhaustMode', 'rules.exhaustedSpeed', 'extras.combat.exhaustRecovery']],
    ],
    anims: ['block_start', 'block', 'block_end', 'guard_impact', 'blocked'],
  },
};

export function createActionsDrawer({$, tuning, ui, onCharactersChanged = () => {}, renderMoves = () => {}, renderAiMoves = () => {}}) {
  const tabs = $('act-tabs'), views = {moves: $('moves-panel'), tackle: $('act-tackle'), dodge: $('act-dodge'), block: $('act-block'), ai: $('act-ai')};
  let current = 'moves';
  const escape = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

  function pathsOf(spec) {
    const list = typeof spec === 'string' ? tuning.manifest.filter(m => m.section === spec.slice(1)).map(m => m.path) : spec;
    return list.filter(p => tuning.byPath.has(p));
  }
  /** Seletores de animação (clipe principal + prévia) dos blocos dados, para o azul e o vermelho. */
  function animBox(ids) {
    const box = document.createElement('section');box.className = 'act-card';
    box.innerHTML = '<h3>🎞 Animações</h3><p class="hint">Sem clipe próprio, cada nível usa o do tackle. Variantes e velocidade ficam em Personagens.</p>';
    for (const who of [0, 1]) {
      const ch = ui?.characters?.[who], head = document.createElement('h4');head.textContent = who ? 'Vermelho' : 'Azul';box.append(head);
      if (!ch) {const p = document.createElement('p');p.className = 'hint';p.textContent = 'Nenhum modelo GLB carregado neste lado (use Personagens).';box.append(p);continue;}
      const opts = sel => ['<option value="">— sem animação própria —</option>', ...ch.clips.map((c, i) => `<option value="${i}" ${ch.clipInfo[i].compatible ? '' : 'disabled'} ${i === sel ? 'selected' : ''}>${escape(c.name)} · ${c.duration.toFixed(2)} s</option>`)].join('');
      for (const id of ids) {
        const list = ch.variantsOf(id), row = document.createElement('div');row.className = 'act-anim';
        row.innerHTML = `<b title="${id}">${escape(ACTION_LABELS[id] || id)}</b><select data-anim="${who}|${id}" aria-label="Animação de ${escape(ACTION_LABELS[id] || id)} (${who ? 'vermelho' : 'azul'})">${opts(list[0] ?? -1)}</select><button type="button" data-prev="${who}|${id}" title="Prévia" ${list.length ? '' : 'disabled'}>▶</button>`;
        row.querySelector('select').onchange = e => {ch.setPrimary(id, e.target.value === '' ? null : Number(e.target.value));onCharactersChanged();render();};
        row.querySelector('button').onclick = () => {const l = ch.variantsOf(id);if (l.length) ch.startPreview(l[0]);};
        box.append(row);
      }
    }
    return box;
  }
  function renderTab(name) {
    const cfg = ACTION_TABS[name], root = views[name];if (!cfg || !root) return;
    root.replaceChildren();
    const head = document.createElement('h2');head.className = 'act-title';head.textContent = `${cfg.icon} ${cfg.title}`;root.append(head);
    for (const [title, spec, open] of cfg.sections) {
      const paths = pathsOf(spec);if (!paths.length) continue;
      const d = document.createElement('details');d.className = 'act-card';d.dataset.k = `act:${name}:${title}`;d.open = (ui.actOpen?.has(d.dataset.k) ?? false);
      const sum = document.createElement('summary');sum.innerHTML = `<b>${escape(title)}</b> <small class="muted">${paths.length}</small>`;d.append(sum);
      const body = document.createElement('div');body.className = 'act-controls';for (const p of paths) body.append(tuning.controlFor(p));d.append(body);
      d.addEventListener('toggle', () => {(ui.actOpen ??= new Set())[d.open ? 'add' : 'delete'](d.dataset.k);});
      root.append(d);
    }
    if (name === 'ai') {const box = document.createElement('section');box.className = 'act-card mv-ai-moves';root.append(box);renderAiMoves(box);}
    if (cfg.anims.length) root.append(animBox(cfg.anims));
  }
  function show(name) {
    current = name;
    for (const [k, el] of Object.entries(views)) el.hidden = k !== name;
    for (const b of tabs.querySelectorAll('[data-act]')) {b.setAttribute('aria-pressed', String(b.dataset.act === name));b.setAttribute('role', 'tab');}
    $('moves-drawer').dataset.tab = name;
    render();
  }
  function render() {if (current === 'moves') renderMoves();else renderTab(current);}
  for (const b of tabs.querySelectorAll('[data-act]')) b.onclick = () => show(b.dataset.act);
  show('moves');
  return {show, render, get current() {return current;}};
}
