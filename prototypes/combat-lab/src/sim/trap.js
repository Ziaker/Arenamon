// @ts-check
// Entidade 'trap' (armadilha de campo): círculo no chão com apoio, vida limitada e UM acionamento. Serve ao Spikes e a futuros Fields. Cada passo:
//   1. APOIO: se a superfície sob a armadilha sumiu (plataforma destruída), ela some sem efeito e sem flutuar (MV-P05);
//   2. ARMAÇÃO: nos primeiros `armDelay` s não aciona (dá tempo de sair de cima de uma armadilha recém-posta, MV-P31);
//   3. ACIONAMENTO: o primeiro adversário em terra que entra no círculo (e na faixa de altura) leva o golpe pela MESMA função de acerto das entidades
//      (`applyHit`: defesa parcial/perfeita, status, Sturdy como dano comum); a armadilha é consumida quando o golpe CONECTA ou é defendido/anulado. Quem
//      está invulnerável não aciona (a armadilha espera). Sem knockback (0 H e 0 V), sem Clash/Counter (não é Tackle nem projétil).
import {applyHit, closestOnShape} from './world.js';
import {getGroundHeight} from './physics.js';
import {C} from './config.js';
import {sub, length, normalize, direction} from './math.js';

const CONSUMING = new Set(['impact', 'partial', 'perfect', 'riposte']);
export function stepTrap(/** @type {any} */ game, /** @type {any} */ e, /** @type {number} */ dt, /** @type {any[]} */ events) {
  if (e.support && getGroundHeight(e.pos, game.world, e.y + .3) < e.y - .06) {
    e.dead = true;events.push({result: 'trapLost', attacker: e.owner ?? null, target: null, damage: 0, entity: e.id, kind: 'trap'});
    return;
  }
  if (e.age < e.armDelay - 1e-9) return;
  const bodyH = C.extras?.visual?.bodyHeight ?? 1.2;
  for (const f of game.fighters) {
    if (f.hp <= 0 || f.absent || f.flight || (f.id === e.owner && !e.affectsOwner)) continue;
    const foot = (f.groundY ?? 0) + (f.vaultHeight ?? 0);
    if (foot > e.y + e.height || foot + bodyH < e.y) continue;
    const box = {shape: 'box', pos: f.position, hx: C.test.halfExtent, hz: C.test.halfExtent, angle: 0};
    const c = closestOnShape(box, e.pos), dist = Math.max(0, c.inside ? 0 : c.distance);
    if (dist > e.radius) continue;
    const away = sub(f.position, e.pos), normal = length(away) > 1e-6 ? normalize(away) : direction(f.facing + Math.PI);
    const ev = applyHit(game, e.owner, f, e.hit, normal, {entity: e.id, source: 'trap', origin: e.pos, pl: e.pl, contact: 'trap'});
    if (ev && CONSUMING.has(ev.result)) {
      events.push(ev, {result: 'trapTrigger', attacker: e.owner ?? null, target: f.id, damage: 0, entity: e.id, kind: 'trap', x: e.pos.x, z: e.pos.z});
      e.dead = true;
      return;
    }
  }
}
