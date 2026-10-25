// Dividido de world-view.js (comportamento idêntico): métodos de WorldView — wv-map.
// Mixin: Object.assign(WorldView.prototype, wvMap) no arquivo original.

import * as T from 'three';
import {GemConsumable, GemSparkles} from '../consumables-gems.js';
import {C} from '../../sim/config.js';
import {altitudeOf} from '../../sim/entity.js';
import {OCCLUSION_HEIGHTS} from './wv-geometry.js';

let slabT0 = 0, slabT1 = 1;
function slab(o, d, lo, hi) {
  if (Math.abs(d) < 1e-9) return o >= lo && o <= hi;
  let a = (lo - o) / d, b = (hi - o) / d;if (a > b) {const t = a;a = b;b = t;}
  if (a > slabT0) slabT0 = a;if (b < slabT1) slabT1 = b;
  return slabT0 <= slabT1;
}

export const wvMap = {
drawMap(mapState, fighters = [], dt = 0, camera = null) {
    if (!mapState) return;
    this.mapGroup ??= new T.Group();
    if (!this.mapGroup.parent) this.group.add(this.mapGroup);
    this.mapMeshes ??= new Map();
    this.shieldBubbles ??= [null, null];

    // 1. Escudos esféricos dos lutadores (R9.3-R9.7, R10.2)
    for (let i = 0; i < fighters.length; i++) {
      const f = fighters[i];
      let bubble = this.shieldBubbles[i];
      if (!bubble) {
        const geo = new T.SphereGeometry(0.9, 24, 24);
        const mat = new T.MeshStandardMaterial({
          color: 0x38bdf8,
          emissive: 0x0284c7,
          emissiveIntensity: 0.5,
          transparent: true,
          opacity: 0.35,
          roughness: 0.1,
          metalness: 0.2,
          side: T.DoubleSide,
          depthWrite: false,
        });
        bubble = new T.Mesh(geo, mat);
        bubble.renderOrder = 850;
        this.group.add(bubble);
        this.shieldBubbles[i] = bubble;
      }
      if (f.shield && f.shield.hp > 0 && f.hp > 0) {
        bubble.visible = true;
        const fY = altitudeOf(f);
        bubble.position.set(f.position.x, fY + 0.6, f.position.z);
        const ratio = Math.min(1, f.shield.hp / (f.shield.maxHp || 80));
        bubble.material.opacity = 0.22 + 0.28 * ratio + 0.08 * Math.sin(this.time * 5);
        const pulse = 1.0 + 0.03 * Math.sin(this.time * 6);
        bubble.scale.set(1.1 * pulse, 1.35 * pulse, 1.1 * pulse);
      } else {
        bubble.visible = false;
      }
    }

    const aliveMapIds = new Set();

    // 2. Plataformas (2 plataformas: 3x3m a 1.0m e 1.5m)
    for (const p of mapState.platforms ?? []) {
      aliveMapIds.add(p.id);
      let m = this.mapMeshes.get(p.id);
      if (!m) {
        const geo = new T.BoxGeometry(p.width ?? 3, p.height, p.depth ?? 3);
        const mat = new T.MeshStandardMaterial({
          color: 0x475569,
          roughness: 0.8,
          metalness: 0.15,
        });
        m = new T.Mesh(geo, mat);
        m.name = `platform_${p.id}`;
        const edgeGeo = new T.EdgesGeometry(geo);
        const edgeMat = new T.LineBasicMaterial({color: 0x94a3b8, transparent: true, opacity: 0.7});
        m.add(new T.LineSegments(edgeGeo, edgeMat));
        this.mapGroup.add(m);
        this.mapMeshes.set(p.id, m);
      }
      m.position.set(p.pos?.x ?? p.x, p.height / 2, p.pos?.z ?? p.z);
      this.checkOcclusion(m, camera, fighters);
    }

    // 3. Obstáculos indestrutíveis (4 obstáculos)
    for (const o of mapState.obstacles ?? []) {
      aliveMapIds.add(o.id);
      let m = this.mapMeshes.get(o.id);
      if (!m) {
        let geo;
        if (o.shape === 'cylinder' || o.shape === 'pillar') {   // pilar colide como círculo: desenhado como cilindro (visual = físico)
          geo = new T.CylinderGeometry(o.radius, o.radius, o.height, 24);
        } else {
          geo = new T.BoxGeometry(o.hx * 2, o.height, o.hz * 2);
        }
        const mat = new T.MeshStandardMaterial({
          color: 0x334155,
          roughness: 0.65,
          metalness: 0.35,
        });
        m = new T.Mesh(geo, mat);
        m.name = `obstacle_${o.id}`;
        const edgeGeo = new T.EdgesGeometry(geo);
        const edgeMat = new T.LineBasicMaterial({color: 0x64748b, transparent: true, opacity: 0.6});
        m.add(new T.LineSegments(edgeGeo, edgeMat));
        this.mapGroup.add(m);
        this.mapMeshes.set(o.id, m);
      }
      m.position.set(o.pos.x, o.pos.y + o.height / 2, o.pos.z);
      this.checkOcclusion(m, camera, fighters);
    }

    // 4. Objetos Destrutíveis (4 destrutíveis) com prévia ghost (R11.9)
    for (const d of mapState.destructibles ?? []) {
      aliveMapIds.add(d.id);
      let m = this.mapMeshes.get(d.id);
      if (!m) {
        const geo = d.rock ? new T.BoxGeometry(1, 1, 1) : new T.BoxGeometry(d.size.hx * 2, d.size.height, d.size.hz * 2);
        const mat = new T.MeshStandardMaterial({
          color: d.rock ? 0x8b8f98 : 0xd97706,
          roughness: 0.7,
          metalness: 0.1,
          transparent: true,
          opacity: 1.0,
        });
        m = new T.Mesh(geo, mat);
        m.name = `destructible_${d.id}`;
        const edgeGeo = new T.EdgesGeometry(geo);
        const edgeMat = new T.LineBasicMaterial({color: 0xfbbf24, transparent: true, opacity: 0.8});
        m.add(new T.LineSegments(edgeGeo, edgeMat));

        // Barra de HP simples flutuante
        const hpBarGeo = new T.PlaneGeometry(0.8, 0.08);
        const hpBarMat = new T.MeshBasicMaterial({color: 0x22c55e, side: T.DoubleSide, depthTest: false});
        const hpBar = new T.Mesh(hpBarGeo, hpBarMat);
        hpBar.name = 'hpBar';
        hpBar.position.set(0, d.size.height / 2 + 0.25, 0);
        if (d.rock) hpBar.visible = false;
        m.add(hpBar);

        this.mapGroup.add(m);
        this.mapMeshes.set(d.id, m);
      }
      m.position.set(d.pos.x, d.pos.y + d.size.height / 2, d.pos.z);
      if (d.rock) {   // rocha do Emerging Stone: o desenho cresce com a altura exposta (o colisor é o mesmo); rachaduras = escurecer conforme o HP cai, sem encolher
        m.scale.set(d.size.hx * 2, Math.max(.01, d.size.height), d.size.hz * 2);
        const k = Math.max(0, d.hp / (d.maxHp || 5));m.material.color.setRGB(.55 * (.45 + .55 * k), .56 * (.45 + .55 * k), .6 * (.45 + .55 * k));
        m.visible = true;this.checkOcclusion(m, camera, fighters);
        continue;
      }

      const hpBar = m.getObjectByName('hpBar');
      if (d.state === 'solid') {
        m.visible = true;
        m.material.color.setHex(0xd97706);
        if (m.userData.wasGhost) {m.material.opacity = 1;m.userData.wasGhost = false;}   // sai da prévia: opaco uma vez; depois a transparência da oclusão manda
        if (hpBar) {
          hpBar.visible = true;
          const hpRatio = Math.max(0, d.hp / (d.maxHp || 30));
          hpBar.scale.x = hpRatio;
          hpBar.material.color.setHex(hpRatio > 0.5 ? 0x22c55e : hpRatio > 0.25 ? 0xfacc15 : 0xef4444);
          if (camera) hpBar.quaternion.copy(camera.quaternion);
        }
        this.checkOcclusion(m, camera, fighters);
      } else if (d.state === 'ghost') {
        // Prévia translúcida antes de tornar sólido (R11.9)
        m.visible = true;
        m.material.color.setHex(0xfef08a);
        if (!m.material.transparent) {m.material.transparent = true;m.material.needsUpdate = true;}
        m.userData.wasGhost = true;
        m.material.opacity = 0.32 + 0.22 * Math.sin(this.time * 8);
        m.material.depthWrite = false;
        if (hpBar) hpBar.visible = false;
      } else {
        m.visible = false;
        if (hpBar) hpBar.visible = false;
      }
    }

    // 5. Consumíveis (7 tipos com cores e geometrias únicas, R4.7, R11.5). display.consumables.gemStyle: 1 = Gemas Facetadas (aprovado em 21/10/2026), 0 = formas clássicas.
    const K = C.display.consumables, gemOn = (K?.gemStyle | 0) === 1;
    this.gems ??= new Set();
    this.gemSparkles ??= new GemSparkles(this.group);
    for (const it of mapState.items ?? []) {
      aliveMapIds.add(it.id);
      let m = this.mapMeshes.get(it.id);
      if (m && (m.userData.consStyle ?? 0) !== (gemOn ? 1 : 0)) {this._removeMapMesh(it.id, m);m = undefined;}   // trocou de estilo: recria
      if (!m) {
        if (gemOn) {const gem = new GemConsumable(it.type);m = gem.root;this.gems.add(gem);}
        else m = this.createConsumableMesh(it.type);
        m.userData.consStyle = gemOn ? 1 : 0;
        this.mapGroup.add(m);
        this.mapMeshes.set(it.id, m);
      }
      if (gemOn) {
        m.position.set(it.pos.x, it.pos.y, it.pos.z);
        m.userData.gem.update(this.time, camera);
        continue;
      }
      const bob = 0.12 * Math.sin(this.time * 3.5 + it.id);
      m.position.set(it.pos.x, it.pos.y + 0.45 + bob, it.pos.z);
      m.rotation.y += 1.8 * dt;

      const ring = m.getObjectByName('pickupRing');
      if (ring) {
        ring.position.y = -0.4 - bob;
        const pScale = 0.9 + 0.15 * Math.sin(this.time * 5 + it.id);
        ring.scale.set(pScale, pScale, pScale);
      }
    }
    this.gemSparkles.update(dt, gemOn && !!K.gemParticles, this.gems);

    // Limpeza de entidades removidas do mapa
    for (const [id, m] of this.mapMeshes) {
      if (!aliveMapIds.has(id)) this._removeMapMesh(id, m);
    }
  },

/** Remove e libera um desenho do mapa (gemas também saem do conjunto e perdem as centelhas). */
  _removeMapMesh(id, m) {
    const gem = m.userData?.gem;
    if (gem) {this.gems.delete(gem);this.gemSparkles?.detach(gem);}
    this.mapGroup.remove(m);
    m.traverse(o => {
      if (!o.isSprite) o.geometry?.dispose();   // a geometria do Sprite é compartilhada pelo Three
      if (Array.isArray(o.material)) o.material.forEach(mat => mat.dispose());
      else o.material?.dispose();
    });
    this.mapMeshes.delete(id);
  },

createConsumableMesh(type) {
    const group = new T.Group();
    let geo, color;
    switch (type) {
      case 'heal_hp':
        geo = new T.DodecahedronGeometry(0.3, 0);
        color = 0xef4444;
        break;
      case 'heal_stamina':
        geo = new T.OctahedronGeometry(0.3, 0);
        geo.scale(0.8, 1.4, 0.8);
        color = 0xeab308;
        break;
      case 'buff_attack':
        geo = new T.TetrahedronGeometry(0.32, 0);
        color = 0xf97316;
        break;
      case 'buff_defense':
        geo = new T.IcosahedronGeometry(0.3, 0);
        color = 0x3b82f6;
        break;
      case 'buff_stamina_max':
        geo = new T.TorusGeometry(0.24, 0.09, 12, 24);
        geo.rotateX(Math.PI / 3);
        color = 0xf59e0b;
        break;
      case 'buff_cooldown':
        geo = new T.OctahedronGeometry(0.28, 0);
        geo.scale(1.2, 0.6, 1.2);
        color = 0xa855f7;
        break;
      case 'buff_speed':
      default:
        geo = new T.ConeGeometry(0.24, 0.5, 5);
        geo.rotateZ(-Math.PI / 6);
        color = 0x22c55e;
        break;
    }

    const mat = new T.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.45,
      roughness: 0.3,
      metalness: 0.3,
    });
    const core = new T.Mesh(geo, mat);
    group.add(core);

    const ringGeo = new T.RingGeometry(0.35, 0.55, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new T.MeshBasicMaterial({color, transparent: true, opacity: 0.5, side: T.DoubleSide, depthWrite: false});
    const ring = new T.Mesh(ringGeo, ringMat);
    ring.name = 'pickupRing';
    group.add(ring);

    return group;
  },

/**
   * Objeto do mapa na frente de um lutador, visto da câmera, fica translúcido. O teste é geométrico: o segmento câmera→lutador (pés, meio e cabeça) contra a caixa REAL do objeto
   * (antes era uma esfera em volta do centro, que não pegava objetos largos ou altos). A opacidade desliza até o alvo (sem piscar) e o realce de arestas acompanha.
   */
  checkOcclusion(mesh, camera, fighters) {
    if (!camera || !fighters?.length) return;
    const geo = mesh.geometry;if (!geo) return;
    if (!geo.boundingBox) geo.computeBoundingBox();
    const bb = geo.boundingBox, s = mesh.scale, p = mesh.position, pad = .04;
    const x0 = p.x + bb.min.x * s.x - pad, x1 = p.x + bb.max.x * s.x + pad, y0 = p.y + bb.min.y * s.y - pad, y1 = p.y + bb.max.y * s.y + pad, z0 = p.z + bb.min.z * s.z - pad, z1 = p.z + bb.max.z * s.z + pad;
    const cx = camera.position.x, cy = camera.position.y, cz = camera.position.z;
    const inside = cx > x0 && cx < x1 && cy > y0 && cy < y1 && cz > z0 && cz < z1;
    let occludes = false;
    if (!inside) for (const f of fighters) {
      if (f.hp <= 0 || f.absent) continue;
      const base = altitudeOf(f);
      for (let hi = 0; hi < OCCLUSION_HEIGHTS.length && !occludes; hi++) {
        const dx = f.position.x - cx, dy = base + OCCLUSION_HEIGHTS[hi] - cy, dz = f.position.z - cz;
        slabT0 = 0;slabT1 = .985;   // só até perto do lutador: o que ele pisa ou encosta não o cobre
        if (slab(cx, dx, x0, x1) && slab(cy, dy, y0, y1) && slab(cz, dz, z0, z1) && slabT0 <= slabT1) occludes = true;
      }
      if (occludes) break;
    }
    const mat = mesh.material, O = C.display.occlusion ?? {occEnabled: 1, occOpacity: .25, occFade: .3}, want = occludes && O.occEnabled ? O.occOpacity : 1;
    // O material PRECISA nascer/virar transparente com needsUpdate: sem isso o shader opaco (`#define OPAQUE`) força alfa 1 e a opacidade não tem efeito visual (verificado em GPU real).
    if (!mat.transparent) {mat.transparent = true;mat.needsUpdate = true;}
    mat.opacity += (want - mat.opacity) * Math.max(.02, Math.min(1, O.occFade));
    if (Math.abs(want - mat.opacity) < .01) mat.opacity = want;
    mat.depthWrite = mat.opacity >= .999;
    for (const ch of mesh.children) if (ch.isLineSegments && ch.material) {   // o realce de arestas acompanha a transparência
      const u = ch.userData;u.baseOp ??= ch.material.opacity;ch.material.opacity = u.baseOp * (.25 + .75 * mat.opacity);
    }
  }
};
