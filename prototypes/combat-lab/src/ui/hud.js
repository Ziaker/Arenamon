// HUD da arena (porto do v6): vida, stamina, estado, avisos de impacto, contato e depuração.
import {C} from '../sim/config.js';
import {isInvulnerable, isOffensive} from '../sim/entity.js';
import {AI_MODES} from '../sim/ai.js';

export const STATE_NAMES = {neutral: 'Livre', moving: 'Movimentação', airborne: 'Lançado', landing: 'Aterrissando', guard: 'Defesa', dodge: 'Esquiva', tackle: 'Tackle', guardStun: 'Guard stun', recoil: 'Recuo', pushed: 'Empurrão', defeated: 'Derrotado'};
export const RESULT_NAMES = {impact: 'Impacto', clash: 'CLASH!', partial: 'Bloqueio parcial', perfect: 'Defesa perfeita', perfectDodge: 'Esquiva perfeita', invulnerable: 'Invulnerável'};
const $ = id => document.getElementById(id);

export class Hud {
  constructor() {this.debug = false;this.lastNotice = null;this.noticeUntil = 0;this.lastInvulnNotice = 0;}
  render(game, fps, {locked, paused, replay, playerAI}) {
    const F = C.extras.fx;
    $('menu').hidden = game.phase !== 'menu';$('overlay').hidden = game.phase !== 'result';
    $('overlay-title').textContent = game.winner === 0 ? 'Vitória no teste' : game.winner === 1 ? 'Derrota no teste' : 'Empate no teste';
    const phase = {playing: 'Em combate', finishing: 'Finalizando impacto', menu: 'Preparação', paused: 'Pausa', result: 'Resultado'}[game.phase] || game.phase;
    $('phase').textContent = `${paused ? 'Pausado' : phase} · alvo ${locked ? 'fixado' : 'livre'}${playerAI ? ' · IA × IA' : ''}`;
    $('ai-chip').textContent = 'Vermelho: ' + (AI_MODES.find(([id]) => id === game.mode)?.[1] || game.mode);
    for (const f of game.fighters) {
      $(`hp${f.id}`).value = f.hp / f.attributes.hp;$(`stamina${f.id}`).value = f.stamina / C.rules.staminaMax;
      $(`state${f.id}`).textContent = `${Math.ceil(f.hp)} HP · ${STATE_NAMES[f.state] || f.state}${f.exhausted ? ' · Exausto' : ''}${f.counterWindow > 0 ? ' · Contra-ataque' : ''}`;
    }
    const s = game.events.at(-1), notice = $('impact-notice');
    if (s && s !== this.lastNotice) {
      const now = performance.now();this.lastNotice = s;
      const repeated = (s.result === 'invulnerable' || s.result === 'perfectDodge') && now - this.lastInvulnNotice < F.invulnNoticeMs;
      if (!repeated) {
        if (s.result === 'invulnerable' || s.result === 'perfectDodge') this.lastInvulnNotice = now;
        this.noticeUntil = now + (s.result === 'clash' ? F.clashNoticeMs : F.impactNoticeMs);notice.dataset.result = s.result;
        notice.textContent = s.result === 'clash' ? `CLASH · ${(C.rules.clashFraction * 100).toFixed(0)}% / ${(C.rules.clashFraction * 100).toFixed(0)}%` : s.result === 'impact' ? `IMPACTO  −${s.damage} HP` : s.result === 'partial' ? `DEFESA  −${s.damage} HP` : s.result === 'perfect' ? 'DEFESA PERFEITA' : s.result === 'perfectDodge' ? 'ESQUIVA PERFEITA · CONTRA-ATAQUE' : 'INVULNERÁVEL';
      }
    }
    notice.hidden = !paused && performance.now() > this.noticeUntil;
    $('contact').textContent = s ? `${RESULT_NAMES[s.result]} · ${s.attacker === 0 ? 'Jogador' : 'Adversário'} → ${s.target === 0 ? 'Jogador' : 'Adversário'} · ${s.damage} dano` : '↑↓←→ mover · X tackle · C esquiva · D defender · Tab alvo';
    $('replay-badge').hidden = !paused;$('replay-text').textContent = replay;
    const dbg = $('debug');dbg.hidden = !this.debug;
    if (this.debug) dbg.textContent = `${fps.toFixed(0)} FPS · simulação ${Math.round(1 / C.test.step)} Hz · passo ${game.tick}\n` + game.fighters.map(a => `${a.id === 0 ? 'Jogador' : 'Adversário'}: ${STATE_NAMES[a.state]}
pos ${a.position.x.toFixed(2)}, ${a.position.z.toFixed(2)} | vel ${a.velocity.x.toFixed(2)}, ${a.velocity.z.toFixed(2)}
frente ${(a.facing * 180 / Math.PI).toFixed(0)}° | contatos ${a.contacts}
invulnerável ${isInvulnerable(a)} | ofensivo ${isOffensive(a)} | contra-ataque ${a.counterWindow.toFixed(2)}s
ação ${a.action ? `${a.action.kind} ${(a.action.elapsed * 1000).toFixed(0)} ms` : '—'} | stamina ${a.stamina.toFixed(2)}`).join('\n\n');
  }
}
