// @ts-check
// Dividido de map.js (comportamento idêntico): map-collision.

import {C} from '../config.js';
import {circleContact, noteSurface} from '../solid-contact.js';
import {length} from '../math.js';
import {noteContact} from '../collision-probe.js';
import {damageDestructible, processDamageWithShieldAndStages} from './map-damage.js';

/**
 * Colisão física de um lutador contra plataformas (laterais sólidas), obstáculos e destrutíveis (R1.6, R1.8, R7.6, R7.15, R10.7-R10.8).
 */
/** Subindo rápido o bastante para passar por cima do topo? Só o salto voluntário (ou tudo, com launchSolidCollision = 0). */
/** Sobreposição mínima (m) que conta como contato: encostar na face (resíduo de ponto flutuante do reposicionamento) não é penetração. */
const TOUCH_EPS = 1e-9;
function risesOver(f, fY, top) {
  const fl = f.flight;
  if (!fl || !(fl.vy > 0) || fY + (fl.vy * fl.vy) / 35 < top) return false;
  if (fl.isNormalJump) return !!(C.map?.jumpPassOver ?? 0);   // salto voluntário: só passa por cima se `jumpPassOver` (ver MAP_DEFAULTS)
  return !((C.map?.launchSolidCollision) ?? 1);
}
/** Voo de ARREMESSO por golpe (launch() marca launchedByHit); salto voluntário, queda de borda e Move Bounce não são arremesso. */
const isLaunchThrow = f => !!f.launchedByHit && !f.flight.isNormalJump && !f.flight.bounce && !f.flight.isEdgeFall;
/** Arremessado contra um sólido indestrutível: reflete a parte horizontal que entra (ângulo especular) escalada pela restituição de parede (R3.12). */
function bounceOffSolid(f, n) {
  const h = f.flight.horizontal, hv = h.x * n.x + h.z * n.z;
  if (!(hv < 0)) return;
  // Limitado a 1 (rebote perfeito): contra pilares e caixas o arremesso nunca sai com mais velocidade do que entrou, mesmo com restituição × multiplicador > 1.
  const factor = C.extras.toggles.enableWallBounce ? Math.min(1, C.rules.wallRestitution * (C.map?.wallBounceMultiplier ?? 1)) : 0;
  f.flight.horizontal = {x: h.x - n.x * hv * (1 + factor), z: h.z - n.z * hv * (1 + factor)};
  f.velocity = {...f.flight.horizontal};
}
export function collideMapFighter(mapState, f, events = []) {
  if (!mapState) return;
  const hv0 = f.flight?.horizontal ?? f.velocity, v0x = hv0.x, v0z = hv0.z;   // velocidade horizontal antes de qualquer contato desta chamada (sonda de colisão; sem alocação)
  const halfExtent = C.test?.halfExtent ?? 0.35;
  const currentY = f.flight ? (f.flight.y ?? (f.groundY ?? 0)) : (f.groundY ?? 0);
  const fY = currentY + (f.vaultHeight ?? 0);
  const fHeight = C.extras?.visual?.bodyHeight ?? 1.2;
  const mount = C.map?.mountTolerance ?? 0.25;

  // 1. Plataformas (laterais sólidas R7.6 com tolerância para montar no topo)
  if (mapState.platforms) {
    for (const p of mapState.platforms) {
      if (fY >= p.height - mount) continue;
      if (risesOver(f, fY, p.height)) continue;
      const px = p.pos?.x ?? p.x, pz = p.pos?.z ?? p.z;
      const hx = (p.width ?? 3) / 2, hz = (p.depth ?? 3) / 2;
      const dx = f.position.x - px, dz = f.position.z - pz;
      const ox = (hx + halfExtent) - Math.abs(dx);
      const oz = (hz + halfExtent) - Math.abs(dz);
      if (ox > TOUCH_EPS && oz > TOUCH_EPS) {
        let n;
        if (ox < oz) {
          const sign = dx > 0 ? 1 : -1;n = {x: sign, z: 0};
          f.position.x = px + sign * (hx + halfExtent);
          if (f.velocity.x * sign < 0) f.velocity.x = 0;
          if (f.flight && !f.flight.isNormalJump && f.flight.horizontal.x * sign < 0) f.flight.horizontal.x = 0;
        } else {
          const sign = dz > 0 ? 1 : -1;n = {x: 0, z: sign};
          f.position.z = pz + sign * (hz + halfExtent);
          if (f.velocity.z * sign < 0) f.velocity.z = 0;
          if (f.flight && !f.flight.isNormalJump && f.flight.horizontal.z * sign < 0) f.flight.horizontal.z = 0;
        }
        f.contacts++;noteContact(f, 'platform', p.id ?? null, n, Math.min(ox, oz), v0x, v0z);
      }
    }
  }

  // 2. Obstáculos indestrutíveis (R1.8 com suporte a topo e tolerância)
  if (mapState.obstacles) {
    for (const o of mapState.obstacles) {
      const topY = (o.pos?.y ?? 0) + o.height;
      if (fY >= topY - mount) continue;
      if (fY + fHeight <= (o.pos?.y ?? 0)) continue;
      // Contato de teto: cabeça exatamente na face inferior, sem subida — é contato, não penetração: sem empurrão.
      if (f.flight && f.flight.vy <= 0 && Math.abs(fY + fHeight - (o.pos?.y ?? 0)) <= 1e-6) continue;
      if (risesOver(f, fY, topY)) continue;
      if (o.shape === 'cylinder' || o.shape === 'pillar') {
        // Menor translação real, inclusive com o centro do lutador exatamente no centro do pilar (antes: contato descartado e lutador preso).
        const contact = circleContact(o.pos, o.radius, f.position, halfExtent);
        if (contact) {
          const n = contact.normal;
          f.position.x += n.x * contact.depth;
          f.position.z += n.z * contact.depth;
          // Resposta DIFERENCIADA por estado (R3.12/R3.7/R7.15): nunca uma resposta genérica única.
          if (f.flight) {
            // Arremessado POR GOLPE (launch() marca launchedByHit) contra indestrutível (R3.12): rebote especular pelo ângulo, intensidade pela restituição
            // de parede. Salto voluntário, queda de borda e Move Bounce não são arremesso: mantêm a própria velocidade (só a posição é corrigida).
            if (isLaunchThrow(f)) bounceOffSolid(f, n);
          } else if (!f.action) {
            // Locomoção livre: remove só a componente que entra; a tangente é preservada e a normal alimenta o deslize do controlador.
            const into = f.velocity.x * n.x + f.velocity.z * n.z;
            if (into < 0) {f.velocity.x -= n.x * into;f.velocity.z -= n.z * into;}
            noteSurface(f, n);
          }
          // Ação em curso (tackle, esquiva...): a velocidade pertence à ação; só a posição é corrigida.
          f.contacts++;noteContact(f, 'obstacle', o.id ?? null, n, contact.depth, v0x, v0z);
        }
      } else {
        const dx = f.position.x - o.pos.x, dz = f.position.z - o.pos.z;
        const ox = (o.hx + halfExtent) - Math.abs(dx);
        const oz = (o.hz + halfExtent) - Math.abs(dz);
        if (ox > TOUCH_EPS && oz > TOUCH_EPS) {
          const n = ox < oz ? {x: dx > 0 ? 1 : -1, z: 0} : {x: 0, z: dz > 0 ? 1 : -1};
          if (ox < oz) {
            const sign = dx > 0 ? 1 : -1;
            f.position.x = o.pos.x + sign * (o.hx + halfExtent);
            if (f.flight && isLaunchThrow(f)) bounceOffSolid(f, {x: sign, z: 0});   // arremesso por golpe contra indestrutível: rebote (R3.12)
            else {
              if (f.velocity.x * sign < 0) f.velocity.x = 0;
              if (f.flight && !f.flight.isNormalJump && f.flight.horizontal.x * sign < 0) f.flight.horizontal.x = 0;
            }
          } else {
            const sign = dz > 0 ? 1 : -1;
            f.position.z = o.pos.z + sign * (o.hz + halfExtent);
            if (f.flight && isLaunchThrow(f)) bounceOffSolid(f, {x: 0, z: sign});
            else {
              if (f.velocity.z * sign < 0) f.velocity.z = 0;
              if (f.flight && !f.flight.isNormalJump && f.flight.horizontal.z * sign < 0) f.flight.horizontal.z = 0;
            }
          }
          f.contacts++;noteContact(f, 'obstacle', o.id ?? null, n, Math.min(ox, oz), v0x, v0z);
        }
      }
    }
  }

  // 3. Destrutíveis (R1.6, R3.7, R7.15, R10.7-R10.8)
  if (mapState.destructibles) {
    for (const d of mapState.destructibles) {
      if (d.state !== 'solid') continue;
      const topY = (d.pos?.y ?? 0) + (d.size?.height ?? 1.6);
      if (fY >= topY - mount) continue;
      if (fY + fHeight <= (d.pos?.y ?? 0)) continue;
      // Contato de teto: cabeça exatamente na face inferior, sem subida — é contato, não penetração: sem empurrão.
      if (f.flight && f.flight.vy <= 0 && Math.abs(fY + fHeight - (d.pos?.y ?? 0)) <= 1e-6) continue;
      if (risesOver(f, fY, topY)) continue;
      const dx = f.position.x - d.pos.x, dz = f.position.z - d.pos.z;
      const ox = (d.size.hx + halfExtent) - Math.abs(dx);
      const oz = (d.size.hz + halfExtent) - Math.abs(dz);
      if (ox > TOUCH_EPS && oz > TOUCH_EPS) {
        if (f.flight && !f.flight.isNormalJump) {
          const relSpeed = length(f.flight.horizontal);
          if (relSpeed > (C.map?.impactMinSpeed ?? 1.0)) {
            const dmgToObj = relSpeed * (C.map?.impactDamageToObject ?? 6.0);
            const dmgToFighter = relSpeed * (C.map?.impactDamageToFighter ?? 2.5);
            damageDestructible(d, dmgToObj, 'environment', f, mapState, events);
            processDamageWithShieldAndStages(f, dmgToFighter, null, false, false);
            const dPos = {x: d.pos.x, y: 0.6, z: d.pos.z};
            const splatNorm = ox < oz ? {x: dx > 0 ? -1 : 1, y: 0, z: 0} : {x: 0, y: 0, z: dz > 0 ? -1 : 1};
            events.push({result: 'destructibleSplat', attacker: f.lastAttacker ?? null, target: f.id, fighter: f.id, destructible: d.id, damage: dmgToFighter, position: dPos, x: dPos.x, y: dPos.y, z: dPos.z, normal: splatNorm});
            f.flight.horizontal = {x: 0, z: 0};
            f.velocity = {x: 0, z: 0};
          }
        }
        if (d.state === 'solid') {
          const n = ox < oz ? {x: dx > 0 ? 1 : -1, z: 0} : {x: 0, z: dz > 0 ? 1 : -1};
          if (ox < oz) {
            const sign = dx > 0 ? 1 : -1;
            f.position.x = d.pos.x + sign * (d.size.hx + halfExtent);
            if (f.velocity.x * sign < 0) f.velocity.x = 0;
            if (f.flight && !f.flight.isNormalJump && f.flight.horizontal.x * sign < 0) f.flight.horizontal.x = 0;
          } else {
            const sign = dz > 0 ? 1 : -1;
            f.position.z = d.pos.z + sign * (d.size.hz + halfExtent);
            if (f.velocity.z * sign < 0) f.velocity.z = 0;
            if (f.flight && !f.flight.isNormalJump && f.flight.horizontal.z * sign < 0) f.flight.horizontal.z = 0;
          }
          f.contacts++;noteContact(f, 'destructible', d.id ?? null, n, Math.min(ox, oz), v0x, v0z);
        }
      }
    }
  }
}
