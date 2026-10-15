import { Game } from './game';
import { RULES } from './config';
import { invulnerable, offensive } from './entity';
const states: Record<string, string> = { neutral: 'Livre', moving: 'Movimentação', guard: 'Defesa', dodge: 'Esquiva', tackle: 'Tackle', guardStun: 'Guard stun', recoil: 'Recuo', pushed: 'Empurrão', defeated: 'Derrotado' };
const results: Record<string, string> = { impact: 'Impacto', partial: 'Bloqueio parcial', perfect: 'Defesa perfeita', invulnerable: 'Invulnerável' };
export class UI {
  debug = false;
  render(game: Game, fps: number, locked: boolean) {
    document.getElementById('menu')!.hidden = game.phase !== 'menu';
    document.getElementById('overlay')!.hidden = game.phase !== 'paused' && game.phase !== 'result';
    document.getElementById('overlay-title')!.textContent = game.phase === 'paused' ? 'Partida pausada' : game.winner === 0 ? 'Vitória no teste' : game.winner === 1 ? 'Derrota no teste' : 'Empate no teste';
    document.getElementById('resume')!.hidden = game.phase !== 'paused';
    document.getElementById('phase')!.textContent = `${game.phase === 'playing' ? 'Em combate' : game.phase === 'menu' ? 'Preparação' : game.phase === 'paused' ? 'Pausa' : 'Resultado'} · Alvo ${locked ? 'fixado' : 'livre'}`;
    for (const f of game.fighters) {
      (document.getElementById(`hp${f.id}`) as HTMLMeterElement).value = f.hp / f.attributes.hp;
      (document.getElementById(`stamina${f.id}`) as HTMLMeterElement).value = f.stamina / RULES.staminaMax;
      document.getElementById(`state${f.id}`)!.textContent = `${Math.ceil(f.hp)} HP · ${states[f.state]}${f.exhausted ? ' · Exausto' : ''}`;
    }
    const event = game.events.at(-1);
    document.getElementById('contact')!.textContent = event ? `${results[event.result]} · ${event.attacker === 0 ? 'Jogador' : 'Adversário'} → ${event.target === 0 ? 'Jogador' : 'Adversário'} · ${event.damage} dano` : 'Setas mover · C esquivar/investir · F defesa provisória · Tab fixar alvo.';
    const debug = document.getElementById('debug')!; debug.hidden = !this.debug;
    if (this.debug) debug.textContent = `${fps.toFixed(0)} FPS · Simulação 120 Hz · passo ${game.tick}\n` + game.fighters.map(f => `${f.id === 0 ? 'Jogador' : 'Adversário'}: ${states[f.state]}\npos ${f.position.x.toFixed(2)}, ${f.position.z.toFixed(2)} | vel ${f.velocity.x.toFixed(2)}, ${f.velocity.z.toFixed(2)}\nfrente ${(f.facing * 180 / Math.PI).toFixed(0)}° | contatos ${f.contacts}\ninvulnerável ${invulnerable(f)} | ofensivo ${offensive(f)}\nação restante ${f.action ? Math.max(0, (f.action.kind === 'dodge' ? RULES.dodge : RULES.recoil) - f.action.elapsed).toFixed(3) : '0'}s | stamina ${f.stamina.toFixed(2)}`).join('\n\n');
  }
}
