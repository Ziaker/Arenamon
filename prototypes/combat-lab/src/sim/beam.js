// @ts-check
// Lasers contínuos (Fase 7; M3.5, M9.6, M17.5–M17.7, M20.6): a entidade `beam` é uma fonte que emite UM feixe por passo. O feixe é recalculado
// do zero a cada passo (sem estado de trajetória), por isso reflexão em cadeia, troca de dono e “sem a barreira, o feixe segue reto” (M17.7)
// são consequências diretas e não há contatos repetidos artificiais em incidência tangencial.
//
//   • segmento: do ponto atual até o primeiro obstáculo (barreira refletora, parede, lutador ou limite da arena);
//   • barreira refletora: frente e borda refletem (a borda pela própria normal); o verso é atravessado (M30.5); PL do feixe superior ao da
//     barreira a destrói e neutraliza SÓ o segmento incidente — a fonte continua e emite de novo no passo seguinte (M20.6);
//   • quem reflete passa a ser o dono do trecho seguinte (M17.6); lutador atingido encerra o feixe (não atravessa corpos);
//   • eventos de reflexão/neutralização saem UMA vez por contato novo (a identificação `seg` + barreira evita Counter ou aviso repetido).
// Sem DOM nem Three. Muta apenas as barreiras destruídas e os campos próprios do feixe (`segments`, `contacts`).
import {C} from './config.js';
import {sweepBox} from './geometry.js';
import {add, sub, scale, dot, normalize} from './math.js';

const altOf = (/** @type {any} */ f) => (f.flight?.y ?? 0) + (f.vaultHeight ?? 0);
const vOverlap = (/** @type {number} */ a0, /** @type {number} */ a1, /** @type {number} */ b0, /** @type {number} */ b1) => a0 <= b1 && b0 <= a1;
const EPS_NORMAL = 1e-4;     // |direção · normal| abaixo disso: incidência rasante, a barreira é ignorada neste trecho

/**
 * Calcula os segmentos do feixe neste passo e as colisões com lutadores. Devolve {segments, hits}; `hits` traz, em ordem, o lutador atingido
 * e o dono do trecho. Gera eventos de reflexão/neutralização/ciclo apenas para contatos novos em relação ao passo anterior.
 * @param {any} game @param {any} e @param {any[]} events
 */
export function traceBeam(game, e, events) {
  const world = game.world, tie = .001, width = e.width ?? 0, max = e.maxSegments ?? C.world.beam.maxSegments;
  const segments = /** @type {any[]} */ ([]), hits = /** @type {any[]} */ ([]), contacts = /** @type {string[]} */ ([]), before = new Set(e.contacts ?? []);
  const note = (/** @type {string} */ key, /** @type {any} */ ev) => {contacts.push(key);if (!before.has(key)) events.push(ev);};
  const bars = world.entities.filter((/** @type {any} */ b) => b.reflect && !b.dead && vOverlap(e.y - width, e.y + width, b.y, b.y + b.height));
  const walls = world.entities.filter((/** @type {any} */ b) => b.kind === 'wall' && b.blocksProjectiles && !b.dead && vOverlap(e.y - width, e.y + width, b.y, b.y + b.height));
  const half = C.test.arenaHalf, hx = C.test.halfExtent, fh = C.extras.visual.bodyHeight;
  let a = {x: e.pos.x, z: e.pos.z}, dir = normalize(e.dir), owner = e.owner, remaining = e.length, pl = e.pl ?? 1, by = null;
  for (let i = 0; i < max && remaining > 1e-6; i++) {
    const ignored = new Set(), b = () => add(a, scale(dir, remaining));
    /** @type {any} */ let best = null;
    for (let guard = 0; guard < 64; guard++) {
      best = null;const end = b();
      const consider = (/** @type {any} */ c) => {if (!best || c.t < best.t - 1e-12) best = c;};
      for (const bar of bars) {
        if (ignored.has(bar.id)) continue;
        const h = sweepBox(bar, a, end, width, tie);
        if (!h) continue;
        if ('inside' in h) {ignored.add(bar.id);continue;}
        consider({...h, type: 'barrier', bar});
      }
      for (const w of walls) {const h = sweepBox(w, a, end, width, tie);if (h && !('inside' in h)) consider({...h, type: 'wall'});}
      for (const f of game.fighters) {
        if (f.hp <= 0 || f.absent || (f.id === owner && !e.hitsOwner)) continue;
        const alt = altOf(f);if (!vOverlap(e.y - width, e.y + width, alt, alt + fh)) continue;
        const box = {pos: f.position, angle: 0, hx, hz: hx}, h = sweepBox(box, a, end, width, tie);
        if (!h) continue;
        consider('inside' in h ? {t: 0, type: 'fighter', fighter: f, point: {...a}, len: remaining} : {...h, type: 'fighter', fighter: f});
      }
      // Limite da arena: onde o raio sai de [−half, half]².
      let ta = Infinity;
      for (const [o, d] of [[a.x, dir.x], [a.z, dir.z]]) if (Math.abs(d) > 1e-12) ta = Math.min(ta, ((d > 0 ? half : -half) - o) / d);
      if (ta < remaining) consider({t: Math.max(0, ta) / remaining, type: 'arena', point: add(a, scale(dir, Math.max(0, ta))), len: remaining});
      if (best?.type === 'barrier' && (best.face === 'back' || Math.abs(dot(dir, best.normal)) < EPS_NORMAL)) {ignored.add(best.bar.id);continue;}   // verso atravessa (M30.5); rasante não gera contato
      break;
    }
    const seg = {a: {...a}, b: /** @type {any} */ (null), owner, pl, by};segments.push(seg);
    if (!best) {seg.b = b();break;}
    const point = best.point ?? b(), run = best.t * (best.len ?? remaining);
    seg.b = {x: point.x, z: point.z};
    if (best.type !== 'barrier') {
      if (best.type === 'fighter') hits.push({target: best.fighter.id, owner, seg: segments.length - 1, point: seg.b});
      break;
    }
    const bar = best.bar;
    if (pl > (bar.pl ?? 1)) {                    // PL superior: a barreira cai e SÓ este segmento é neutralizado (M20.6)
      bar.dead = true;seg.neutralized = true;
      events.push({result: 'barrierBroken', attacker: owner ?? null, target: bar.owner ?? null, damage: 0, entity: bar.id, kind: 'barrier', by: 'pl'});
      note(`n:${bar.id}:${i}`, {result: 'neutralized', attacker: owner ?? null, target: bar.owner ?? null, damage: 0, entity: e.id, by: bar.id, kind: 'beam', seg: i, pl});
      break;
    }
    const n = best.normal, nd = normalize(sub(dir, scale(n, 2 * dot(dir, n))));
    note(`r:${bar.id}:${i}:${best.face}`, {result: 'reflected', attacker: bar.owner ?? null, target: owner ?? null, damage: 0, entity: e.id, by: bar.id, face: best.face, kind: 'beam', seg: i, pl, barrierPl: bar.pl ?? 1});
    remaining -= run;a = add(best.point, scale(n, 1e-6));dir = nd;owner = bar.owner;by = bar.id;
    if (i === max - 1 && remaining > 1e-6) note('cycle', {result: 'reflectCycle', attacker: owner ?? null, target: null, damage: 0, entity: e.id, kind: 'beam'});
  }
  e.contacts = contacts;
  return {segments, hits};
}
