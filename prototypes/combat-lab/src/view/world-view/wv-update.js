// Dividido de world-view.js (comportamento idêntico): métodos de WorldView — wv-update.
// Mixin: Object.assign(WorldView.prototype, wvUpdate) no arquivo original.

import * as T from 'three';
import {C} from '../../sim/config.js';
import {altitudeOf} from '../../sim/entity.js';
import {sandFrontAt} from '../../sim/sand.js';
import {reflectPlacement} from '../../sim/moves/reflect.js';
import {stoneCount} from '../../sim/moves/psyshock.js';
import {updateElemental} from '../elemental-fx.js';
import {ElementalPreview} from '../quarks/elemental-preview.js';
import {ELEMENTAL_GAME_PARAMS} from '../quarks/elemental-game-params.js';
import {FIGHTER_EVENTS, PL_HEX, RING} from './wv-geometry.js';


export const wvUpdate = {
update(world, {fighters = [], events = [], dt = 0, skipBeams = false, camera = null} = {}) {
    this.fighters = fighters;
    if (this.movesVfx) this.movesVfx.fighters = fighters;
    this.time += dt;
    this.trailTimer += dt;
    const emitTrailsNow = this.trailTimer >= 0.04;
    if (emitTrailsNow) this.trailTimer = 0;

    const alive = new Set();
    const fxAcc = {...this.accessibility, noFlash: !!(this.accessibility?.noFlash || C.vfx.master?.noFlash), reduceMotion: !!(this.accessibility?.reduceMotion || C.vfx.master?.reduceMotion)};
    for (const e of world?.entities ?? []) {
      alive.add(e.id);
      // Água/Fogo/Vento são desenhados pela camada three.quarks (elemental-game.js); o Seed Bomb segue no desenho provisório.
      if (this.movesVfx?.handles(e) || this.elementalFx.handles(e) || this.atelierFx.handles(e)) {
        const stale = this.meshes.get(e.id);
        if (stale) {
          this.group.remove(stale);
          stale.traverse(o => {o.geometry?.dispose();if (Array.isArray(o.material)) o.material.forEach(mat => mat.dispose());else o.material?.dispose();});
          this.meshes.delete(e.id);
        }
        continue;
      }
      let m = this.meshes.get(e.id) ?? this.make(e);
      if (e.kind === 'projectile') {
        let border = m.getObjectByName('plBorder');
        if (C.vfx?.projectilePlBorder && !border) {
          border = new T.Mesh(new T.TorusGeometry(1.35, .06, 8, 32), new T.MeshBasicMaterial({color: PL_HEX[Math.max(0, Math.min(3, e.pl ?? 1))], transparent: true, opacity: .9, depthWrite: false}));
          border.rotation.x = Math.PI / 2;border.name = 'plBorder';m.add(border);
        } else if (!C.vfx?.projectilePlBorder && border) {
          border.removeFromParent();border.geometry.dispose();border.material.dispose();
        }
        if (border && C.vfx?.projectilePlBorder) border.material.color.setHex(PL_HEX[Math.max(0, Math.min(3, e.pl ?? 1))]);
      }
      if (updateElemental(m, e, this.time, dt, fxAcc)) continue;

      if (e.kind === 'beam') {
        if (skipBeams) {
          m.children.forEach(s => { s.visible = false; });
          continue;
        }
        m.children.forEach((s, i) => {
          const g = e.segments?.[i];s.visible = !!g;if (!g) return;
          const dx = g.b.x - g.a.x, dz = g.b.z - g.a.z, len = Math.hypot(dx, dz), w = Math.max(.05, (e.width ?? .04) * 2);
          s.position.set((g.a.x + g.b.x) / 2, e.y, (g.a.z + g.b.z) / 2);s.rotation.y = Math.atan2(dx, dz);s.scale.set(w, w, Math.max(1e-3, len));
          s.material.color.setHex(g.neutralized ? 0xffffff : PL_HEX[Math.min(3, g.pl ?? 1)]);s.material.opacity = g.neutralized ? .35 : .85;
        });
      } else if (e.kind === 'projectile') {
        m.position.set(e.pos.x, e.y, e.pos.z);
        const rockScale = (C.vfx?.rock?.scale ?? 1.0);
        const scaleVal = e.visual === 'star' ? e.radius * 2.2 : e.radius * (e.visualScale ?? 1) * (e.exec != null ? 1.15 : 1) * rockScale;
        m.scale.setScalar(scaleVal);
        const col = this.colorOf(e);

        if (m.isGroup) {
          const glow = m.getObjectByName('rockGlow');
          const core = m.getObjectByName('rockCore');
          if (glow) glow.material.color.setHex(col);
          if (core) core.material.color.setHex(col);

          // Rotação física da rocha em voo
          const rs = m.userData.rotSpeed;
          if (rs && dt > 0) {
            m.rotation.x += rs.x * dt;
            m.rotation.y += rs.y * dt;
            m.rotation.z += rs.z * dt;
          }
        } else if (m.material) {
          m.material.color.setHex(col);
        }

        // Rastro de poeira e partículas telecinéticas
        if (emitTrailsNow && C.vfx?.rock?.trail && dt > 0) {
          this.emitRockTrail(e.pos.x, e.y, e.pos.z, e.vel ?? e.dir, col, scaleVal);
        }
      } else if (e.kind === 'burrow') {
        const ground = (e.alt ?? 0);m.position.set(e.pos.x, 0, e.pos.z);
        const P = e.params ?? {}, fxOn = P.fxTrailOn !== 0, S = fxOn ? (P.fxTrailSize ?? 1.8) : 1, heading = Math.atan2(e.to.x - e.from.x, e.to.z - e.from.z), run = Math.hypot(e.pos.x - e.from.x, e.pos.z - e.from.z);
        for (const c of m.children) {
          if (c.name === 'mound') {c.position.y = ground + .25 * S;c.rotation.y = heading;c.scale.setScalar((.85 + .15 * Math.sin(this.time * 18)) * S);}
          else if (c.name === 'burrowTrail') {   // faixa de terra do ponto de partida até o montículo (sobe do chão e vai afundando para trás)
            c.visible = fxOn && run > .05;c.rotation.y = heading;c.scale.set(.9 * S, .14 * S, Math.max(.01, run));
            c.position.set((e.from.x - e.pos.x) / 2, ground + .07 * S, (e.from.z - e.pos.z) / 2);
          } else if (c.name === 'burrowClod') {   // torrões que saltam ao longo do trajeto, na frente do montículo e atrás dele
            const k = c.userData.k, ph = (this.time * 2.2 + k * .137) % 1, back = ((k * 0.61803) % 1) * Math.min(run, 4 * S), side = (((k * 0.37) % 1) - .5) * 1.4 * S, hop = Math.sin(ph * Math.PI) * (.5 + (k % 4) * .18) * S;
            c.visible = fxOn && run > .05;
            const sn = Math.sin(heading), cs = Math.cos(heading);
            c.position.set(-sn * back + cs * side, ground + .12 * S + hop, -cs * back - sn * side);
            c.scale.setScalar((.1 + (k % 3) * .05) * S);c.rotation.set(ph * 6, k, ph * 4);
          }
          else if (c.name === 'burrowTarget') {c.position.set(e.to.x - e.pos.x, (e.to.y ?? 0) + .05, e.to.z - e.pos.z);const r = (e.params?.blastRadius ?? 5);c.scale.set(r, 1, r);c.material.opacity = .45 + .35 * Math.sin(this.time * 6);}
        }
      } else if (e.kind === 'sandwave') {
        // retângulo real (comprimento à frente × largura), com a frente da onda avançando na velocidade do motor e dissipando nos 0,75 s finais
        m.position.set(e.pos.x, .03, e.pos.z);m.rotation.y = Math.atan2(e.dir.x, e.dir.z);
        const act = Math.min(e.age, e.active), fade = e.age <= e.active ? 1 : Math.max(0, 1 - (e.age - e.active) / Math.max(1e-6, e.life - e.active)), reach = sandFrontAt(e, act);
        for (const c of m.children) {
          if (c.name === 'sandPlane') {c.scale.set(e.width, 1, Math.max(.01, reach));c.position.z = reach / 2;c.material.opacity = .28 * fade;}
          else if (c.name === 'sandFront') {c.scale.set(e.width, 1, 1);c.position.set(0, .25, reach);c.visible = e.age <= e.active;c.material.opacity = .55 * fade;}
          else if (c.name === 'sandGrain') {
            const k = c.userData.k, u = ((k * 0.61803) % 1) * reach, v = (((k * 0.37) % 1) - .5) * e.width, t = (this.time * 1.4 + k * .13) % 1;
            c.position.set(v, .1 + t * .9, u);c.material.opacity = .8 * fade * (1 - t);c.visible = reach > .05;
          }
        }
      } else if (e.kind === 'trap') {
        // Brotam em sequência rápida (0,25 s), pulsam de leve e piscam no último segundo; antes de armar ficam translúcidos.
        m.position.set(e.pos.x, e.y ?? 0, e.pos.z);
        const grow = Math.min(1, e.age / .25), armed = e.age >= (e.armDelay ?? 0), left = e.life - e.age, blink = left < 1 ? (.5 + .5 * Math.abs(Math.sin(this.time * 24))) : 1;
        let i = 0;
        for (const c of m.children) {
          if (c.name === 'spike') {const k = Math.max(0, Math.min(1, grow * 1.4 - i * .06));c.scale.set(1, (c.userData.h ?? 1) * 1.05 * k, 1);c.material.opacity = (armed ? .95 : .55) * blink;c.material.emissiveIntensity = (armed ? .55 + .2 * Math.sin(this.time * 5 + i) : .25);i++;}
          else if (c.name === 'trapRing') c.material.opacity = (armed ? .45 : .2) * blink;
        }
      } else if (e.kind === 'area') {
        m.position.set(e.pos.x, (e.y ?? 0) + .03, e.pos.z);
        if (e.shape === 'box') {m.scale.set(e.hx * 2, 1, e.hz * 2);m.rotation.y = e.angle ?? 0;} else m.scale.set(e.radius, 1, e.radius);
        m.material.opacity = .45 * Math.max(.15, 1 - e.age / Math.max(1e-6, e.life));
      } else {
        m.position.set(e.pos.x, e.y + e.height / 2, e.pos.z);m.rotation.y = e.angle ?? 0;
        if (e.shape === 'circle') m.scale.set(e.radius, e.height, e.radius);else m.scale.set(e.hx * 2, e.height, e.hz * 2);
        if (e.reflect) {
          const currentStyle = Math.max(0, Math.min(2, C.vfx?.barrier?.variant ?? 0));
          if (m.userData.style !== currentStyle) {
            this.group.remove(m);
            m.traverse(o => {if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose();});
            this.meshes.delete(e.id);
            m = this.make(e);
            m.position.set(e.pos.x, e.y + e.height / 2, e.pos.z);
            m.rotation.y = e.angle ?? 0;
            if (e.shape === 'circle') m.scale.set(e.radius, e.height, e.radius);
            else m.scale.set(e.hx * 2, e.height, e.hz * 2);
          }
          // Pulsação suave e enfraquecimento no fim da vida
          const left = e.life - e.age;
          const pulse = 0.88 + 0.12 * Math.sin(this.time * (C.vfx?.barrier?.pulseFreq ?? 2.2) * Math.PI * 2);
          const weak = left < 1 ? (.45 + .55 * Math.abs(Math.sin(this.time * 30))) : 1;
          const isHighContrast = !!(this.accessibility?.highContrast || C.vfx.master?.highContrast || C.vfx.laser?.highContrast);
          const baseOp = isHighContrast ? 0.95 : (C.vfx?.barrier?.opacity ?? 0.65);
          if (m.material) {
            m.material.opacity = baseOp * weak * pulse;
            m.material.emissiveIntensity = (C.vfx?.barrier?.edgeGlow ?? 0.8) * weak * pulse;
          }
          if (m.userData.style === 0) {
            const subGrid = m.getObjectByName('subGrid');
            if (subGrid?.material) subGrid.material.opacity = (isHighContrast ? 0.8 : (0.3 + 0.25 * Math.sin(this.time * 5))) * weak;
          } else if (m.userData.style === 2) {
            const inner = m.getObjectByName('innerWave');
            if (inner?.material) {
              inner.material.opacity = (isHighContrast ? 0.6 : (0.2 + 0.2 * Math.cos(this.time * 6))) * weak;
              inner.scale.z = 0.92 + 0.08 * Math.sin(this.time * 4);
            }
          }
        }
      }
    }

    // Efeitos elementais em three.quarks: cria/atualiza os que seguem entidades e mantém o contato delas.
    if (this.movesVfx) {
      this.movesVfx.sync(world?.entities ?? [], dt, fxAcc, fighters, events);   // F5: os eventos do quadro chegam ANTES da transição de morte (ponto do contato)
    }
    const unmigrated = this.movesVfx ? this.movesVfx.filterUnmigrated(world?.entities ?? []) : (world?.entities ?? []);
    this.elementalFx.sync(unmigrated, dt, fxAcc);
    this.atelierFx.sync(unmigrated, dt, fxAcc, fighters);

    // Eventos novos viram anéis e geram estilhaços/shatter de rochas e barreiras
    for (const ev of events) {
      if (this.seen.has(ev)) continue;
      this.seen.add(ev);
      const spec = RING[ev.result];
      const m = this.meshes.get(ev.entity), f = FIGHTER_EVENTS.has(ev.result) ? fighters[ev.target] : null;
      const be = ev.kind === 'beam' && ev.seg != null ? world?.entities.find(x => x.id === ev.entity) : null, bp = be?.segments?.[ev.seg]?.b;
      const evPos = (Number.isFinite(ev.x) && Number.isFinite(ev.z)) ? {x: ev.x, y: ev.y ?? .6, z: ev.z} : null;
      const pos = evPos ?? (bp ? {x: bp.x, y: be.y, z: bp.z} : f ? {x: f.position.x, y: .6, z: f.position.z} : m ? m.position : (this.movesVfx?.positionOf(ev.entity) ?? this.elementalFx.positionOf(ev.entity) ?? this.atelierFx.positionOf(ev.entity)));
      this.movesVfx?.onEvent(ev);
      if (!pos) continue;

      const evColor = spec ? (spec[0] ?? PL_HEX[Math.min(3, ev.barrierPl ?? ev.pl ?? 1)]) : 0xffffff;
      if (spec) {
        this.ring(pos.x, pos.y ?? .6, pos.z, evColor, spec[1]);
      }

      // Estilhaçamento de rochas no impacto, choque entre pedras ou reflexão
      if (C.vfx?.rock?.shatter && (ev.result === 'impact' || ev.result === 'stoneClash' || ev.result === 'counter' || ev.result === 'tackleClash' || ev.result === 'reflected')) {
        this.emitRockShatter(pos.x, pos.y ?? 0.6, pos.z, ev.normal, evColor);
      }

      // Estilhaçamento de barreira ao ser destruída
      if (ev.result === 'barrierBroken') {
        this.emitBarrierShatter(pos.x, pos.y ?? 1.0, pos.z, evColor);
      }
    }

    // Remoção de entidades mortas
    for (const [id, m] of this.meshes) {
      if (!alive.has(id)) {
        this.group.remove(m);
        m.traverse(o => {
          o.geometry?.dispose();
          if (Array.isArray(o.material)) o.material.forEach(mat => mat.dispose());
          else o.material?.dispose();
        });
        this.meshes.delete(id);
      }
    }

    // Atualização dos anéis
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.age += dt;
      const k = Math.min(1, r.age / r.life);
      r.mesh.scale.setScalar(.25 + r.size * k);
      r.mesh.material.opacity = .85 * (1 - k);
      if (k >= 1) {
        this.group.remove(r.mesh);
        r.mesh.geometry.dispose();
        r.mesh.material.dispose();
        this.rings.splice(i, 1);
      }
    }

    // Atualização das partículas de rastro e estilhaços físicos
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += dt;
      const prog = Math.min(1, p.age / p.life);

      // Integração física (gravidade e arrasto)
      p.vel.y -= 14 * dt;
      p.mesh.position.x += p.vel.x * dt;
      p.mesh.position.y += p.vel.y * dt;
      p.mesh.position.z += p.vel.z * dt;

      // Colisão simples no chão (y = 0.04)
      if (p.mesh.position.y < 0.04) {
        p.mesh.position.y = 0.04;
        p.vel.y = -p.vel.y * 0.35;
        p.vel.x *= 0.7;
        p.vel.z *= 0.7;
      }

      p.mesh.rotation.x += p.rotVel.x * dt;
      p.mesh.rotation.y += p.rotVel.y * dt;
      p.mesh.rotation.z += p.rotVel.z * dt;

      p.mesh.scale.setScalar(p.startScale * (1 - prog * 0.8));
      p.mesh.material.opacity = Math.max(0, 0.9 * (1 - prog));

      if (prog >= 1) {
        this.group.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
        this.particles.splice(i, 1);
      }
    }

    this.drawCharging(world, fighters, dt);
    this.drawMap(world?.mapState, fighters, dt, camera);
    return alive.size;
  },

/** Prévia da barreira (com indicação de carga mínima de 1,5 s) e pedras que se formam ao redor do lutador. */
  drawCharging(world, fighters, dt = 0) {
    let showPreview = false;
    const acc = {...this.accessibility, noFlash: !!(this.accessibility?.noFlash || C.vfx.master?.noFlash), reduceMotion: !!(this.accessibility?.reduceMotion || C.vfx.master?.reduceMotion)};
    for (const f of fighters) {
      const ring = this.chargeRings?.[f.id];
      const ch = f.charge, tc = f.tackleCharge;
      if (ring) {
        if (ch || tc) {
          ring.visible = true;
          ring.position.set(f.position.x, 0.04, f.position.z);
          const ratio = tc ? tc.t / Math.max(1e-6, C.rules.chargeTackleMaxTime) : (ch.ratio ?? (ch.ticks / (ch.params?.maxTicks || 180)));
          const scale = 0.6 + Math.min(1.2, ratio * 0.8);
          ring.scale.set(scale, scale, scale);
          const plIdx = tc ? tc.level : ch.ticks >= (ch.params?.maxTicks ?? 180) ? 3 : ch.ticks >= (ch.params?.pl2Ticks ?? 90) ? 2 : 1;
          ring.material.color.setHex(PL_HEX[plIdx]);
          ring.material.opacity = 0.35 + 0.25 * Math.sin(this.time * 9);
        } else {
          ring.visible = false;
        }
      }
      const orbs = this.orbs[f.id] ??= [];
      let want = 0;

      // Water Pulse: a esfera de água cresce na mão enquanto a carga corre (só aparência; PL muda a cor do anel).
      // Esfera de carga do Water Pulse com o visual do ateliê (three.quarks), cresce com a carga/PL.
      if (ch && ch.move === 'water-pulse') {
        const maxTicks = Math.max(1, ch.params?.maxTicks ?? 180), ratio = Math.min(1, ch.ticks / maxTicks);
        const level = ratio >= 1 ? 3 : ratio >= .5 ? 2 : 1, reach = .62;
        const base = C.vfx.elemental?.visual?.[`waterPulse${Math.max(0, level - 1)}`] ?? ELEMENTAL_GAME_PARAMS.waterPulse[Math.max(0, level - 1)];
        if (!this.waterChargePreview) {
          this.waterChargePreview = new ElementalPreview(this.group, {batch: this.elementalFx.batch, parent: this.group});
          this.waterChargePreview.root.visible = true;
        }
        const p = this.waterChargePreview;
        p.root.visible = true;
        p.root.position.set(f.position.x + Math.sin(f.facing) * reach, altitudeOf(f) + .58 + .12 * ratio, f.position.z + Math.cos(f.facing) * reach);
        p.root.scale.setScalar(.4 + .9 * ratio);
        if (p.p?.variant !== 0) { /* keep variant 0 */ }
        const chargeSignature = JSON.stringify(base);
        if (!p.active || p.chargeSignature !== chargeSignature || p.chargeLevel !== level) {
          p.play('waterPulse', {...base, variant: 0, shotFollowTime: base.shotFollowTime ?? C.vfx.elemental?.shotFollowTime ?? .3}, level, {noFlash: !!acc.noFlash, reduced: !!acc.reduceMotion, follow: true});
          p.chargeSignature = chargeSignature;p.chargeLevel = level;
        }
        p.noFlash = !!acc.noFlash; p.reduced = !!acc.reduceMotion;
        p.velocity = (p.p?.speed ?? base.speed);
        p.update(dt);
      } else if (this.waterChargePreview) {
        this.waterChargePreview.root.visible = false;
      }

      if (ch && ch.move === 'reflect') {
        const P = ch.params, place = reflectPlacement({world, fighters}, f, P, ch.ticks / P.maxTicks, f.facing), p = this.preview;
        showPreview = true;
        p.visible = true;

        // Com carga mínima de 1,5 s (180 passos): indica se já está carregada ou ainda acumulando
        const minTicks = P.minTicks ?? 180;
        const hasMinCharge = ch.ticks >= minTicks;

        if (place.ok) {
          p.position.set(place.center.x, place.base + place.height / 2, place.center.z);
          p.scale.set(place.width, place.height, place.thickness);
          // Verde firme quando pronta (>= 1,5s); ciano pulsante quando carregando os 1,5s iniciais
          if (hasMinCharge) {
            p.material.color.setHex(0x59e68a);
            p.material.opacity = 0.38;
          } else {
            const shimmer = 0.2 + 0.18 * Math.sin(this.time * 8);
            p.material.color.setHex(0x59d6e6);
            p.material.opacity = shimmer;
          }
        } else {
          const w = P.group.widthMin * 2 * P.body.halfExtent;
          p.position.set(f.position.x + Math.sin(f.facing) * 1.05, P.body.height, f.position.z + Math.cos(f.facing) * 1.05);
          p.scale.set(w, P.group.heightMin * P.body.height, P.group.thickness);
          p.material.color.setHex(0xff5a5a);
          p.material.opacity = 0.3;
        }
        p.rotation.y = f.facing;
      } else if (ch && ch.move === 'psyshock') {
        want = stoneCount(ch.ticks, ch.params);
      }

      while (orbs.length < 16) {
        const o = this.makeChargingRockOrb();
        o.visible = false;
        this.group.add(o);
        orbs.push(o);
      }

      for (let i = 0; i < orbs.length; i++) {
        const o = orbs[i];
        o.visible = i < want;
        if (i >= want) continue;

        const arc = 2.1;
        const a = f.facing + (want === 1 ? 0 : (i / (want - 1) - .5) * arc) + Math.sin(this.time * 1.7 + i) * .06;
        const r = .95 + .12 * Math.sin(this.time * 2.3 + i * 1.7);
        const lev = Math.sin(this.time * 3.4 + i * 1.9) * 0.08;

        o.position.set(
          f.position.x + Math.sin(a) * r,
          .45 + .55 * (.5 + .5 * Math.sin(this.time * 2 + i * 2.1)) + (i % 3) * .1 + lev,
          f.position.z + Math.cos(a) * r
        );

        const plIdx = ch.ticks >= ch.params.maxTicks ? 3 : ch.ticks >= ch.params.pl2Ticks ? 2 : 1;
        const plColor = PL_HEX[plIdx];
        const rockScale = (C.vfx?.rock?.scale ?? 1.0);
        o.scale.setScalar((.14 + .07 * ((i * 7) % 5) / 4) * rockScale);

        // Rotação suave das pedras levitando
        o.rotation.x += 1.4 * (dt || 0.016);
        o.rotation.y += 2.1 * (dt || 0.016);

        if (o.userData.glow) o.userData.glow.material.color.setHex(plColor);
        if (o.userData.core) o.userData.core.material.color.setHex(plColor);
      }
    }
    if (!showPreview) this.preview.visible = false;
  }
};
