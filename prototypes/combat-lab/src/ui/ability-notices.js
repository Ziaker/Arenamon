// Notificações de HUD "Ability: NOME" (retângulo branco) ao ativar passivas (§16): do jogador (lutador 0)
// entram deslizando da extrema esquerda para a direita; do oponente (lutador 1), espelhadas, da extrema
// direita para a esquerda. Ficam visíveis ~1,6 s e saem pela mesma borda; empilham para baixo (máx. 3 por
// lado). Com "movimento reduzido" (vfx.master.reduceMotion) aparecem sem deslize, só com fade. São DOM do
// HUD — nada a ver com a cena 3D — e respeitam o toggle C.vfx.passive.enabled.
import {C} from '../sim/config.js';
import {PASSIVE_BY_ID} from '../sim/passives.js';

const HOLD = 1600, OUT = 360, MAX_PER_SIDE = 3;

export class AbilityNotices {
  /** @param {HTMLElement|null} root container #ability-notices (criado no template) */
  constructor(root = document.getElementById('ability-notices')) {
    this.root = root;
  }
  /**
   * Dispara notificações para ativações de passivas do passo.
   * @param {Array<any>} events eventos do passo (game.lastStepEvents)
   */
  onEvents(events) {
    if (!C.vfx?.passive?.enabled || !events?.length || !this.root) return;
    for (const e of events) {
      if (e.result !== 'passiveActivated' || e.attacker == null) continue;
      this.notify(e.attacker, PASSIVE_BY_ID[e.passive]?.nome ?? e.passive);
    }
  }
  /** Cria a notificação de um lado (0 = jogador: entrada pela esquerda; 1 = oponente: pela direita). */
  notify(side, nome) {
    if (!this.root) return;
    const s = side ? 1 : 0;
    const el = document.createElement('div');
    el.className = `ability-notice side-${s}`;
    el.textContent = `Ability: ${nome}`;
    if (C.vfx?.master?.reduceMotion) el.style.transition = 'opacity .25s ease';   // sem deslize
    this.root.append(el);
    // Empilha as do mesmo lado para baixo e mantém o teto.
    const same = [...this.root.querySelectorAll(`.ability-notice.side-${s}`)];
    same.forEach((c, i) => {c.style.top = `calc(34% + ${i * 46}px)`;});
    if (same.length > MAX_PER_SIDE) same[0].remove();
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in')));
    setTimeout(() => {el.classList.add('out');}, HOLD);
    setTimeout(() => {el.remove();}, HOLD + OUT + 60);
  }
  clear() {this.root?.replaceChildren();}
}
