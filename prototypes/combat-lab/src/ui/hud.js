// HUD da arena (porto do v6): vida, stamina, estado, avisos de impacto, contato e depuração.
import {C} from '../sim/config.js';
import {isInvulnerable, isOffensive} from '../sim/entity.js';
import {AI_MODES} from '../sim/ai.js';
import {fighterColorHex, fighterGlyph, fighterTitle} from './fighter-identity.js';

export const STATE_NAMES = {neutral: 'Livre', ledgeHang: 'Pendurado na borda', ledgeClimb: 'Subindo a borda', tackleCharge: 'Carregando tackle', meteorPrep: 'Meteor: preparação', meteorDive: 'Meteor: mergulho', meteorGround: 'Meteor: no chão', moving: 'Movimentação', airborne: 'Lançado', landing: 'Aterrissando', guard: 'Defesa', dodge: 'Esquiva', tackle: 'Tackle', guardStun: 'Guard stun', recoil: 'Recuo', pushed: 'Empurrão', defeated: 'Derrotado'};
export const RESULT_NAMES = {impact: 'Impacto', clash: 'CLASH!', partial: 'Bloqueio parcial', reflected: 'Reflexão', barrierBroken: 'Barreira destruída', neutralized: 'Projétil neutralizado', stoneClash: 'Choque de pedras', counter: 'Counter de PL', tackleClash: 'Tackle × pedra (Clash)', counterStagger: 'Counter Stagger', shielded: 'Protegido pela barreira', moveFailed: 'Movimento falhou', perfect: 'Defesa perfeita', perfectDodge: 'Esquiva perfeita', invulnerable: 'Invulnerável', wallSplat: 'Wall-splat!'};
const $ = id => document.getElementById(id);
const NOTICE = new Set(['impact', 'clash', 'partial', 'perfect', 'perfectDodge', 'invulnerable', 'reflected', 'barrierBroken', 'neutralized', 'stoneClash', 'counter', 'tackleClash', 'counterStagger', 'shielded', 'wallSplat', 'footstool']);

export class Hud {
  constructor() {this.debug = false;this.lastNotice = null;this.noticeUntil = 0;this.lastInvulnNotice = 0;}
  render(game, fps, {locked, paused, replay, playerAI}) {
    const F = C.extras.fx;
    $('menu').hidden = game.phase !== 'menu';if (game.phase !== 'result') this.resultAt = 0;else if (!this.resultAt) this.resultAt = performance.now();
    $('overlay').hidden = game.phase !== 'result' || performance.now() - this.resultAt < 1900;   // o K.O. aparece sozinho antes do cartão de resultado
    $('overlay-title').textContent = game.winner === 0 ? 'Vitória no teste' : game.winner === 1 ? 'Derrota no teste' : 'Empate no teste';
    const phase = {playing: 'Em combate', finishing: 'Finalizando impacto', menu: 'Preparação', paused: 'Pausa', result: 'Resultado'}[game.phase] || game.phase;
    const phaseText = `${paused ? 'Pausado' : phase}${locked ? ' · alvo fixado' : ''}${playerAI ? ' · IA × IA' : ''}`, phaseFull = `${paused ? 'Pausado' : phase} · alvo ${locked ? 'fixado' : 'livre'}${playerAI ? ' · IA × IA' : ''}`;
    if ($('phase').textContent !== phaseText) {$('phase').textContent = phaseText;$('phase').title = phaseFull;}
    const modeFull = AI_MODES.find(([id]) => id === game.mode)?.[1] || game.mode, modeShort = ({tactical: 'Normal', offensive: 'Ataque constante', guard: 'Defesa constante', inactive: 'Parado'})[game.mode] || modeFull;
    const aiText = C.extras.toggles.enableEnemyAI ? 'IA: ' + modeShort : 'IA: desligada';
    if ($('ai-chip').textContent !== aiText) {$('ai-chip').textContent = aiText;$('ai-chip').title = C.extras.toggles.enableEnemyAI ? 'Modo da IA do adversário: ' + modeFull : 'IA do oponente desligada (botão 🧠)';}
    for (const f of game.fighters) {
      const titleEl = $(`name${f.id}`);
      if (titleEl) {
        // Identidade visual: a cor escolhida no pré-jogo vale para o HUD inteiro; o símbolo (◆/●) distingue
        // os dois lutadores sem depender da cor (daltonismo).
        const title = fighterTitle(f.id, {playerAI});
        if (titleEl.textContent !== title) titleEl.textContent = title;
        if (titleEl.dataset.glyph !== fighterGlyph(f.id)) titleEl.dataset.glyph = fighterGlyph(f.id);
        const card = titleEl.parentElement;
        if (card && card.dataset.slot !== String(f.id)) card.dataset.slot = String(f.id);
        const hex = fighterColorHex(f.id);
        if (card) {
          if (hex && card.style.getPropertyValue('--fc') !== hex) card.style.setProperty('--fc', hex);
          else if (!hex && card.style.getPropertyValue('--fc')) card.style.removeProperty('--fc');
        }
      }
      const maxStamina = C.rules.staminaMax + (f.stages?.staminaMax || 0);
      $(`hp${f.id}`).value = f.hp / f.attributes.hp;
      $(`stamina${f.id}`).value = f.stamina / maxStamina;
      $(`stamina${f.id}`).classList.toggle("exhausted", !!f.exhausted);
      const shieldText = (f.shield && f.shield.hp > 0) ? ` · Escudo ${Math.ceil(f.shield.hp)}` : '';
      const stateName = (f.flight && f.flight.isNormalJump) ? 'Salto' : (STATE_NAMES[f.state] || f.state);
      $(`state${f.id}`).textContent = `${Math.ceil(f.hp)} HP${shieldText} · ${stateName}${f.exhausted ? ' · Exausto' : ''}${f.counterWindow > 0 ? ' · Contra-ataque' : ''}`;
      const stEl = $(`stages${f.id}`);
      if (stEl) {
        const parts = [];
        if (f.shield && f.shield.hp > 0) {
          parts.push(`<span class="st-badge shd" title="Escudo temporário: ${Math.ceil(f.shield.hp)} HP (${f.shield.duration.toFixed(1)}s)">🛡 ${Math.ceil(f.shield.hp)}</span>`);
        }
        if (f.stages) {
          if (f.stages.attack > 0) parts.push(`<span class="st-badge atk" title="Estágio de Ataque +${f.stages.attack * 10}%">⚔ +${f.stages.attack}</span>`);
          if (f.stages.defense > 0) parts.push(`<span class="st-badge def" title="Estágio de Defesa -${f.stages.defense * 10} pp">🛡 +${f.stages.defense}</span>`);
          if (f.stages.staminaMax > 0) parts.push(`<span class="st-badge sta" title="Estágio de Stamina Máx +${f.stages.staminaMax}">⚡ +${f.stages.staminaMax}</span>`);
          if (f.stages.cooldown > 0) parts.push(`<span class="st-badge cd" title="Estágio de Recarga -${f.stages.cooldown * 10}%">⏱ +${f.stages.cooldown}</span>`);
          if (f.stages.speed > 0) parts.push(`<span class="st-badge spd" title="Estágio de Velocidade +${f.stages.speed * 5}%">👟 +${f.stages.speed}</span>`);
        }
        const html = parts.join('');
        if (stEl.innerHTML !== html) stEl.innerHTML = html;
      }
    }
    // Só eventos de contato aparecem no aviso: criação, expiração, início/soltura de carga etc. não são contatos.
    const s = game.events.findLast(e => NOTICE.has(e.result)), notice = $('impact-notice');
    if (s && s !== this.lastNotice) {
      const now = performance.now();this.lastNotice = s;
      const repeated = (s.result === 'invulnerable' || s.result === 'perfectDodge') && now - this.lastInvulnNotice < F.invulnNoticeMs;
      if (!repeated) {
        if (s.result === 'invulnerable' || s.result === 'perfectDodge') this.lastInvulnNotice = now;
        this.noticeUntil = now + (s.result === 'clash' ? F.clashNoticeMs : F.impactNoticeMs);notice.dataset.result = s.result;
        notice.textContent = s.result === 'clash' ? `CLASH · ${(C.rules.clashFraction * 100).toFixed(0)}% / ${(C.rules.clashFraction * 100).toFixed(0)}%` : s.result === 'impact' ? (s.slam ? `METEOR SLAM  −${s.damage} HP` : `IMPACTO  −${s.damage} HP`) : s.result === 'partial' ? `DEFESA  −${s.damage} HP` : s.result === 'perfect' ? 'DEFESA PERFEITA' : s.result === 'perfectDodge' ? 'ESQUIVA PERFEITA · CONTRA-ATAQUE' : s.result === 'invulnerable' ? 'INVULNERÁVEL' : s.result === 'footstool' ? `FOOTSTOOL  −${s.damage} HP` : (RESULT_NAMES[s.result] ?? s.result).toUpperCase() + (s.pl ? ` · PL${s.pl}` : '');
      }
    }
    notice.hidden = !paused && performance.now() > this.noticeUntil;
    $('contact').textContent = s ? `${RESULT_NAMES[s.result] ?? s.result} · ${s.attacker === 0 ? 'Jogador' : 'Adversário'} → ${s.target === 0 ? 'Jogador' : s.target === 1 ? 'Adversário' : '—'} · ${s.damage} dano` : '↑↓←→ mover · X tackle · C esquiva · D defender · Tab alvo';
    $('replay-badge').hidden = !paused;$('replay-text').textContent = replay;
    const dbg = $('debug');dbg.hidden = !this.debug;
    if (this.debug) dbg.textContent = `${fps.toFixed(0)} FPS · simulação ${Math.round(1 / C.test.step)} Hz · passo ${game.tick}\n` + game.fighters.map(a => `${a.id === 0 ? 'Jogador' : 'Adversário'}: ${STATE_NAMES[a.state]}
pos ${a.position.x.toFixed(2)}, ${a.position.z.toFixed(2)} | vel ${a.velocity.x.toFixed(2)}, ${a.velocity.z.toFixed(2)}
frente ${(a.facing * 180 / Math.PI).toFixed(0)}° | contatos ${a.contacts}
invulnerável ${isInvulnerable(a)} | ofensivo ${isOffensive(a)} | contra-ataque ${a.counterWindow.toFixed(2)}s
ação ${a.action ? `${a.action.kind} ${(a.action.elapsed * 1000).toFixed(0)} ms` : '—'} | stamina ${a.stamina.toFixed(2)}`).join('\n\n');
  }
}
