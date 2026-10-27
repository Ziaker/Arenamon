// Visuais de Sand Wave e Emerging Stone no JOGO com o renderizador do atelier Areia/Pedra (prototypes/sand-stone-lab), usando os parâmetros aprovados
// em quarks/atelier-game-params.js (Sand Wave C, Emerging Stone A). Só aparência: posição, alcance, tempo e contato vêm da simulação; nada aqui decide dano,
// colisão, cegueira ou cooldown. Cada entidade ganha uma instância do efeito do atelier num grupo posicionado sobre o retângulo/trajeto real.
import * as T from 'three';
import * as Q from 'three.quarks';
import {SandEffect, StoneEffect} from '../../../../sand-stone-lab/src/effects.js';
import {SwiftEffect} from '../../../../sand-stone-lab/src/swift-effect.ts';
import {PsyshockEffect} from '../../../../sand-stone-lab/src/psyshock-effect.ts';
import {RushEffect} from '../../../../sand-stone-lab/src/rush-effects.ts';
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
  /** A entidade é desenhada por esta camada? Barragem da Sand Wave, projétil subterrâneo do Emerging Stone e projéteis de Swift e Psyshock. */
  handles(e) {return !!e && (e.kind === 'sandwave' || e.kind === 'burrow' || !!volleyMove(e));}
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
  sync(entities, dt, acc, fighters = []) {
    const seen = new Set();
    this.syncVolleys(entities, dt, acc);
    this.syncRushes(fighters, dt, acc);
    for (const e of entities ?? []) {
      if (!this.handles(e) || volleyMove(e)) continue;
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
  // ---------- Swift e Psyshock: uma rajada (disparo) = uma instância do efeito aprovado, presa às posições REAIS dos projéteis ----------
  // O efeito do atelier encena o Move inteiro num palco fixo (lançador em z −2,45, alvo em z +2,55). No jogo, o grupo fica no ponto de disparo,
  // virado para a direção média da rajada; o caminho de cada estrela/pedra (`path`) passa a ler o histórico da entidade da simulação, e o tempo
  // de voo acompanha a vida real dos projéteis. Só aparência: colisão, alcance e acerto continuam sendo os da entidade.
  spawnVolley(move, ents, acc) {
    const group = new T.Group();
    this.parent.add(group);
    const n = ents.length, c = ents.reduce((a, e) => ({x: a.x + e.pos.x / n, y: a.y + (e.y ?? 1) / n, z: a.z + e.pos.z / n, dx: a.dx + (e.dir?.x ?? 0), dz: a.dz + (e.dir?.z ?? 1)}), {x: 0, y: 0, z: 0, dx: 0, dz: 0});
    group.position.set(c.x, 0, c.z);
    group.rotation.y = Math.atan2(c.dx, c.dz);
    group.updateMatrixWorld(true);
    const particles = new Particles(group, {renderer: this.batch, emitterParent: group});
    const p = accessible(this.paramsOf(move), acc);
    const fx = move === 'swift' ? new SwiftEffect(group, particles, ATELIER_GAME_VARIANT.swift, p) : new PsyshockEffect(group, particles, ATELIER_GAME_VARIANT.psyshock, p, n);
    // Bonecos do palco do atelier (lançador e alvo em cápsula) não entram no jogo.
    group.traverse(o => {if (o.geometry?.type === 'CapsuleGeometry' && o.parent) o.parent.visible = false;});
    const cast = move === 'swift' ? fx.cast : fx.chargeT, flightKey = move === 'swift' ? 'flight' : 'flightT', tail = fx.duration - cast - fx[flightKey];
    const v = {move, group, particles, fx, cast, flightKey, tail, age: 0, ids: ents.map(e => e.id), hist: ents.map(() => []), alive: true, lastAlive: 0, impact: new T.Vector3(0, c.y, 0)};
    // Pontos fixos do palco → pontos reais (em coordenadas do grupo): origem do disparo e ponto de contato.
    const launch = new T.Vector3(0, c.y, 0);
    if (fx.source) fx.source.position.copy(launch);
    if (fx.shot) {fx.shot.base.copy(launch);fx.shot.dir.set(0, 0, 1);}
    const sameAs = (a, b) => Array.isArray(a) && a.length === 3 && a.every((x, i) => Math.abs(x - b[i]) < 1e-9);
    const create = particles.create.bind(particles);
    particles.create = (o = {}) => create({...o, position: sameAs(o.position, [0, 1.2, -2.45]) ? launch.toArray() : sameAs(o.position, [0, 1.3, 2.55]) || sameAs(o.position, [0, 1.4, 2.4]) ? v.impact.toArray() : o.position});
    // Caminho real: amostra o histórico da entidade i no instante de jogo correspondente ao tempo `at` do efeito.
    fx.path = (at, i, out) => {
      const h = v.hist[i % v.hist.length], g = at - cast;
      if (!h.length) return out.copy(launch);
      let k = 0;while (k < h.length - 1 && h[k + 1].t <= g) k++;
      const a = h[k], b = h[Math.min(h.length - 1, k + 1)], u = b.t > a.t ? Math.min(1, Math.max(0, (g - a.t) / (b.t - a.t))) : 0;
      return out.set(a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u, a.z + (b.z - a.z) * u);
    };
    return v;
  }
  advanceVolley(v, byId, dt) {
    v.age += dt;
    const tmp = new T.Vector3();
    let any = false;
    v.ids.forEach((id, i) => {
      const e = byId.get(id);
      if (!e || e.dead || v.ents.get(id) !== e) {
        if (v.fx.stones?.[i]) v.fx.stones[i].visible = false;
        if (v.fx.stars?.[i]) v.fx.stars[i].visible = false;
        return;
      }
      any = true;
      v.group.worldToLocal(tmp.set(e.pos.x, e.y ?? 1, e.pos.z));
      v.hist[i].push({t: v.age, x: tmp.x, y: tmp.y, z: tmp.z});
    });
    if (!any) {
      if (v.fx.stones) v.fx.stones.forEach(s => { s.visible = false; });
      if (v.fx.stars) v.fx.stars.forEach(s => { s.visible = false; });
    }
    if (any) v.lastAlive = v.age;
    v.alive = any;
    // Contato = onde os projéteis estavam por último (média).
    const last = v.hist.map(h => h[h.length - 1]).filter(Boolean);
    if (last.length) v.impact.set(last.reduce((s, q) => s + q.x, 0) / last.length, last.reduce((s, q) => s + q.y, 0) / last.length, last.reduce((s, q) => s + q.z, 0) / last.length);
    // Voo dura o que os projéteis duram: enquanto vivem, a chegada fica logo à frente; ao sumirem, a chegada congela ali.
    v.fx[v.flightKey] = Math.max(.01, v.lastAlive + (any ? .02 : 0));
    v.fx.duration = v.cast + v.fx[v.flightKey] + v.tail;
    if (v.fx.impact) v.fx.impact.position.copy(v.impact);
    if (v.fx.echo) v.fx.echo.position.set(v.impact.x, .045, v.impact.z);
    const t = Math.min(v.fx.duration, v.cast + v.age);
    v.fx.update(t, dt);
    v.particles.update(dt);
    return !any && v.cast + v.age >= v.fx.duration + .4;
  }
  syncVolleys(entities, dt, acc) {
    this.volleys ??= new Map();
    const byId = new Map(), fresh = new Map();
    for (const e of entities ?? []) {
      byId.set(e.id, e);
      const move = volleyMove(e);if (!move) continue;
      if ([...this.volleys.values()].some(v => v.ids.includes(e.id) && v.ents?.get(e.id) === e)) continue;
      const key = `${move}:${e.owner}:${e.exec ?? e.id}`;
      (fresh.get(key) ?? fresh.set(key, {move, ents: []}).get(key)).ents.push(e);
    }
    for (const [key, {move, ents}] of fresh) {
      const v = this.spawnVolley(move, ents.sort((a, b) => a.id - b.id), acc);
      v.ents = new Map(ents.map(e => [e.id, e]));
      this.volleys.set(key + ':' + ents[0].id, v);
    }
    for (const [key, v] of this.volleys) {
      if (this.advanceVolley(v, byId, dt)) {v.particles.clear();disposeGroup(v.group);v.group.removeFromParent();this.volleys.delete(key);}
    }
  }
  // ---------- Quick Attack e Bullet Punch: o efeito aprovado do atelier SOMADO ao visual que o jogo já tinha (pedido de 25/10/2026) ----------
  // Uma ação do Move = uma instância. O grupo fica onde a ação começou, virado para a direção dela; o «ator» do atelier (punho do Bullet Punch)
  // e os rastros seguem o histórico REAL do lutador; o corpo de corrida do Quick Attack (o próprio lutador) e os bonecos do palco não entram.
  // Antecipação dura até o lutador sair do lugar; o avanço, até ele parar de se afastar da origem (o contato fica nesse ponto).
  spawnRush(f, move, acc) {
    const kind = move === 'quick-attack' ? 'quickattack' : 'bulletpunch', quick = kind === 'quickattack';
    const group = new T.Group();
    this.parent.add(group);
    const heading = f.action?.startAngle ?? f.action?.heading ?? f.facing ?? 0;
    group.position.set(f.position.x, f.groundY ?? 0, f.position.z);
    group.rotation.y = heading;
    group.updateMatrixWorld(true);
    const particles = new Particles(group, {renderer: this.batch, emitterParent: group});
    const p = accessible(this.paramsOf(kind), acc);
    const fx = new RushEffect(group, particles, kind, ATELIER_GAME_VARIANT[kind], p);
    // Fora do jogo: alvo e marca do palco (z ≈ 2,7), boneco lançador do Bullet Punch e o corpo do Quick Attack (é o lutador real).
    for (const o of [...group.children]) if (Math.abs(o.position.z - 2.7) < 1e-6) o.visible = false;
    if (fx.caster) fx.caster.visible = false;
    const y = quick ? .68 : 1.05, impactY = quick ? .8 : 1.05;
    const r = {f, move, kind, quick, group, particles, fx, action: f.action, age: 0, hist: [], moved: false, out: 0, done: false, y, impact: new T.Vector3(0, impactY, .6)};
    fx.launch.position.set(0, .04, 0);
    if (fx.shot) {fx.shot.base.set(0, .4, 0);fx.shot.dir.set(0, 0, 1);}
    const sameAs = (a, b) => Array.isArray(a) && a.length === 3 && a.every((x, i) => Math.abs(x - b[i]) < 1e-9);
    const create = particles.create.bind(particles);
    particles.create = (o = {}) => create({...o, position: sameAs(o.position, [0, .12, -2.4]) ? [0, .12, 0] : sameAs(o.position, [0, impactY, 2.35]) ? r.impact.toArray() : o.position});
    fx.path = (t, out) => {
      const h = r.hist;if (!h.length) return out.set(0, y, 0);
      let k = 0;while (k < h.length - 1 && h[k + 1].t <= t) k++;
      const a = h[k], b = h[Math.min(h.length - 1, k + 1)], u = b.t > a.t ? Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))) : 0;
      return out.set(a.x + (b.x - a.x) * u, y + a.y + (b.y - a.y) * u, a.z + (b.z - a.z) * u);
    };
    return r;
  }
  advanceRush(r, dt) {
    r.age += dt;
    const f = r.f, same = f.action === r.action && f.action?.move === r.move;
    if (same && !r.done) {
      const q = r.group.worldToLocal(new T.Vector3(f.position.x, (f.flight?.y ?? f.groundY ?? 0) + (f.vaultHeight ?? 0), f.position.z));
      const d = Math.hypot(q.x, q.z);
      r.hist.push({t: r.age, x: q.x, y: q.y, z: q.z});
      if (!r.moved && d > .05) {r.moved = true;r.fx.charge = r.age;}
      if (r.moved && d + 1e-4 < r.out) r.done = true;   // começou a voltar (Quick Attack) ou parou: o contato é aqui
      r.out = Math.max(r.out, d);
    } else r.done = true;
    const fx = r.fx;
    if (!r.moved) fx.charge = r.age + .02;
    if (!r.done) fx.travel = Math.max(.01, r.age - fx.charge + .02);
    fx.arrival = fx.charge + fx.travel;
    fx.duration = fx.arrival + fx.tail;
    const far = r.hist.reduce((m, q) => Math.hypot(q.x, q.z) > Math.hypot(m.x, m.z) ? q : m, {x: 0, y: 0, z: 0});
    r.impact.set(far.x, (r.quick ? .8 : 1.05) + far.y, far.z + .6);
    fx.impact.position.copy(r.impact);
    const t = Math.min(fx.duration, r.age);
    fx.update(t, dt);
    if (r.quick) fx.actor.visible = false;
    r.particles.update(dt);
    return r.done && r.age >= fx.duration + .4;
  }
  syncRushes(fighters, dt, acc) {
    this.rushes ??= [];
    for (const f of fighters ?? []) {
      const m = f?.action?.move;
      // Quick Attack permanece no atelier-game legado (não migrado).
      // Bullet Punch agora é gerenciado exclusivamente por moves-vfx-registry.js (Documento 02).
      if (m === 'quick-attack' && !this.rushes.some(r => r.action === f.action)) this.rushes.push(this.spawnRush(f, m, acc));
    }
    this.rushes = this.rushes.filter(r => {
      if (!this.advanceRush(r, dt)) return true;
      r.particles.clear();disposeGroup(r.group);r.group.removeFromParent();return false;
    });
  }
  positionOf(id) {
    const it = this.items.get(id);if (it) return it.group.position;
    for (const v of this.volleys?.values() ?? []) {
      const i = v.ids.indexOf(id);if (i < 0) continue;
      const q = v.hist[i][v.hist[i].length - 1];return q ? v.group.localToWorld(new T.Vector3(q.x, q.y, q.z)) : v.group.position;
    }
    return null;
  }
  clear() {
    for (const it of this.items.values()) this.disposeItem(it);this.items.clear();
    for (const v of this.volleys?.values() ?? []) {v.particles.clear();disposeGroup(v.group);v.group.removeFromParent();}this.volleys?.clear();
    for (const r of this.rushes ?? []) {r.particles.clear();disposeGroup(r.group);r.group.removeFromParent();}this.rushes = [];
  }
  /** Diagnóstico para os testes de navegador. */
  diagnostics() {
    return {count: this.items.size, items: [...this.items.values()].map(it => ({id: it.id, kind: it.kind, age: +it.age.toFixed(3), dying: !!it.dying, x: +it.group.position.x.toFixed(2), z: +it.group.position.z.toFixed(2), particles: it.particles.count})),
      volleys: [...(this.volleys?.values() ?? [])].map(v => ({move: v.move, projectiles: v.ids.length, alive: v.alive, age: +v.age.toFixed(3), samples: v.hist.reduce((s, h) => s + h.length, 0),
        // distância (m, no chão) entre cada estrela/pedra DESENHADA e a última posição real do seu projétil
        nodeGap: +Math.max(0, ...v.ids.map((_, i) => {const node = (v.fx.stars ?? v.fx.stones)?.[i], q = v.hist[i][v.hist[i].length - 1];if (!node || !q) return 0;const w = node.getWorldPosition(new T.Vector3()), r = v.group.localToWorld(new T.Vector3(q.x, q.y, q.z));return Math.hypot(w.x - r.x, w.z - r.z);})).toFixed(3)})),
      rushes: (this.rushes ?? []).map(r => ({move: r.move, age: +r.age.toFixed(3), moved: r.moved, done: r.done, samples: r.hist.length, out: +r.out.toFixed(2), particles: r.particles.count,
        // distância (m, no chão) entre o «ator» do atelier (punho) e o lutador real enquanto a ação avança
        actorGap: r.hist.length ? +Math.hypot(r.fx.actor.position.x - r.hist[r.hist.length - 1].x, r.fx.actor.position.z - r.hist[r.hist.length - 1].z).toFixed(3) : null}))};
  }
}

/** Swift e Psyshock (projéteis) usam o visual aprovado do atelier: devolve o nome da categoria aprovada, ou null. */
export function volleyMove(e) {
  if (e?.kind !== 'projectile') return null;
  const m = e.captured?.move;
  return m === 'swift' || m === 'psyshock' ? m : null;
}
