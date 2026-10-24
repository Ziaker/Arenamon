// Visuais de Sand Wave e Emerging Stone no JOGO com o renderizador do atelier Areia/Pedra (prototypes/sand-stone-lab), usando os parâmetros aprovados
// em quarks/atelier-game-params.js (Sand Wave C, Emerging Stone A). Só aparência: posição, alcance, tempo e contato vêm da simulação; nada aqui decide dano,
// colisão, cegueira ou cooldown. Cada entidade ganha uma instância do efeito do atelier num grupo posicionado sobre o retângulo/trajeto real.
import * as T from 'three';
import * as Q from 'three.quarks';
import {SandEffect, StoneEffect} from '../../../../sand-stone-lab/src/effects.js';
import {Particles} from '../../../../sand-stone-lab/src/particles.js';
import {PhaseClock} from '../../../../sand-stone-lab/src/phases.ts';
import {defaults} from '../../../../sand-stone-lab/src/config.ts';
import {disposeGroup} from '../../../../sand-stone-lab/src/art.js';
import {ATELIER_GAME_PARAMS, ATELIER_GAME_VARIANT} from './atelier-game-params.js';

/** Acessibilidade do jogo (Sem flash / Movimento reduzido), do mesmo jeito que o atelier aplica. */
function accessible(p, acc) {
  if (acc?.reduceMotion) {
    for (const k of ['density', 'particleDensity', 'sparks', 'flash', 'emissivity', 'shards']) if (k in p) p[k] *= .45;
    if ('impactIntensity' in p) p.impactIntensity *= .7;
    for (const k of ['turn', 'angularSpeed', 'twist', 'spiral', 'undulation']) if (k in p) p[k] *= .3;
  }
  if (acc?.noFlash) {
    for (const k of ['flash', 'halo', 'shotRecoilFlash']) if (k in p) p[k] = 0;
    for (const k of ['coreGlow', 'edgeGlow', 'veinGlow', 'emissivity', 'glow']) if (k in p) p[k] *= .4;
  }
  return p;
}

export class AtelierGameFx {
  /** @param {any} parent grupo do mundo (mesma origem da cena) */
  constructor(parent) {
    this.parent = parent;
    this.batch = new Q.BatchedRenderer();
    parent.add(this.batch);
    /** @type {Map<number, any>} */
    this.items = new Map();
  }
  /** A entidade é desenhada por esta camada? Barragem da Sand Wave e projétil subterrâneo do Emerging Stone. */
  handles(e) {return !!e && (e.kind === 'sandwave' || e.kind === 'burrow');}
  paramsOf(key, over) {return {...defaults[key], ...ATELIER_GAME_PARAMS[key], ...over};}
  spawn(e, acc) {
    const group = new T.Group();
    this.parent.add(group);
    const particles = new Particles(group, {renderer: this.batch, emitterParent: group});
    let fx, p, start;
    if (e.kind === 'sandwave') {
      // O retângulo real vai de e.pos até e.pos + dir × comprimento; o efeito do atelier fica centrado nele e olha para +z.
      const len = e.length ?? 4, width = e.width ?? 3, dir = e.dir ?? {x: 0, z: 1};
      p = accessible(this.paramsOf('sand', {length: len, width, flightTime: Math.max(.05, e.active ?? .75)}), acc);
      group.position.set(e.pos.x + dir.x * len / 2, e.y ?? 0, e.pos.z + dir.z * len / 2);
      group.rotation.y = Math.atan2(dir.x, dir.z);
      fx = new SandEffect(group, particles, ATELIER_GAME_VARIANT.sand, p);
      start = p.startOn !== 0 ? fx.cast : 0;
    } else {
      // O efeito fica no ponto de destino olhando na direção do trajeto; o tempo de viagem e a distância vêm da simulação.
      const from = e.from ?? e.pos, to = e.to ?? e.pos, dx = to.x - from.x, dz = to.z - from.z, dist = Math.max(.5, Math.hypot(dx, dz));
      p = accessible(this.paramsOf('stone', {flightTime: Math.max(.05, (e.total ?? dist) / Math.max(.1, e.speed ?? 15))}), acc);
      group.position.set(to.x, to.y ?? 0, to.z);
      group.rotation.y = Math.atan2(dx, dz);
      fx = new StoneEffect(group, particles, ATELIER_GAME_VARIANT.stone, p, null, ATELIER_GAME_VARIANT.stone);
      fx.travelLen = dist;
      start = p.startOn !== 0 ? p.warning : 0;
    }
    const clock = fx.timeline ? new PhaseClock(fx.timeline(), p) : null;
    return {id: e.id, entity: e, kind: e.kind, group, particles, fx, clock, start, age: 0, signature: JSON.stringify([acc?.noFlash, acc?.reduceMotion])};
  }
  advance(it, dt) {
    it.age += dt;
    const total = it.clock ? it.clock.duration : it.fx.duration, t = Math.min(total, it.start + it.age);
    it.fx.update(it.clock ? it.clock.map(t) : t, dt);
    // A rocha 3×3×3 do Emerging Stone é a entidade real da simulação (desenhada pelo jogo); aqui fica só o trajeto, a erupção e a poeira.
    if (it.kind === 'burrow' && it.fx.rock) it.fx.rock.visible = false;
    it.particles.update(dt);
    return it.start + it.age >= total + .4;
  }
  disposeItem(it) {
    it.particles.clear();
    disposeGroup(it.group);
    it.group.removeFromParent();
  }
  sync(entities, dt, acc) {
    const seen = new Set();
    for (const e of entities ?? []) {
      if (!this.handles(e)) continue;
      seen.add(e.id);
      let it = this.items.get(e.id);
      // O mundo reinicia a numeração das entidades: o mesmo id pode ser outra entidade.
      if (it && it.entity !== e) {this.disposeItem(it);this.items.delete(e.id);it = undefined;}
      if (!it) {it = this.spawn(e, acc);this.items.set(e.id, it);}
    }
    for (const [id, it] of this.items) {
      if (!seen.has(id)) it.dying = true;
      if (this.advance(it, dt) && (it.dying || it.fx.duration <= it.start + it.age)) {this.disposeItem(it);this.items.delete(id);}
    }
    this.batch.update(dt);
  }
  positionOf(id) {return this.items.get(id)?.group.position ?? null;}
  clear() {for (const it of this.items.values()) this.disposeItem(it);this.items.clear();}
  /** Diagnóstico para os testes de navegador. */
  diagnostics() {
    return {count: this.items.size, items: [...this.items.values()].map(it => ({id: it.id, kind: it.kind, age: +it.age.toFixed(3), dying: !!it.dying, x: +it.group.position.x.toFixed(2), z: +it.group.position.z.toFixed(2), particles: it.particles.count}))};
  }
}
