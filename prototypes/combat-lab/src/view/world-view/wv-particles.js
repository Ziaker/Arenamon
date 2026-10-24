// Dividido de world-view.js (comportamento idêntico): métodos de WorldView — wv-particles.
// Mixin: Object.assign(WorldView.prototype, wvParticles) no arquivo original.

import * as T from 'three';
import {C} from '../../sim/config.js';


export const wvParticles = {
/** Anel que se expande e some (VFX de evento). */
  ring(x, y, z, color, size, life = .55) {
    const isNoFlash = !!(this.accessibility?.noFlash || C.vfx.master?.noFlash || C.vfx.laser?.noFlash);
    const isHighContrast = !!(this.accessibility?.highContrast || C.vfx.master?.highContrast || C.vfx.laser?.highContrast);
    const opacity = isNoFlash ? 0.45 : isHighContrast ? 1.0 : 0.85;
    const geo = new T.RingGeometry(.82, 1, 40);
    geo.rotateX(-Math.PI / 2);
    const mesh = new T.Mesh(geo, new T.MeshBasicMaterial({color, transparent: true, opacity, depthWrite: false, side: T.DoubleSide}));
    mesh.position.set(x, y, z);
    mesh.renderOrder = 802;
    this.group.add(mesh);
    this.rings.push({mesh, age: 0, life, size});
  },

/** Emite partículas de rastro em voo para as pedras. */
  emitRockTrail(x, y, z, vel, color, scaleVal) {
    const geo = new T.BoxGeometry(0.06 * scaleVal, 0.06 * scaleVal, 0.06 * scaleVal);
    const mat = new T.MeshBasicMaterial({color, transparent: true, opacity: 0.8, depthWrite: false});
    const mesh = new T.Mesh(geo, mat);
    mesh.position.set(
      x + (Math.random() - 0.5) * 0.15,
      y + (Math.random() - 0.5) * 0.15,
      z + (Math.random() - 0.5) * 0.15
    );
    this.group.add(mesh);
    this.particles.push({
      mesh,
      age: 0,
      life: 0.28,
      vel: {x: (Math.random() - 0.5) * 0.6, y: Math.random() * 0.5, z: (Math.random() - 0.5) * 0.6},
      rotVel: {x: Math.random() * 8, y: Math.random() * 8, z: Math.random() * 8},
      startScale: scaleVal * 0.9,
    });
  },

/** Emite fragmentos/estilhaços físicos quando uma rocha colide ou se quebra. */
  emitRockShatter(x, y, z, normal, color) {
    const isReduceMotion = !!(this.accessibility?.reduceMotion || C.vfx.master?.reduceMotion || C.vfx.laser?.reduceMotion);
    const motionScale = isReduceMotion ? 0.25 : 1.0;
    const count = isReduceMotion ? 6 : (C.vfx?.rock?.shatterCount ?? 14);
    const nx = normal?.x ?? 0, nz = normal?.z ?? 0;
    const rc = C.vfx?.rock ?? {}, spdK = rc.shatterSpeed ?? 1, lifeK = rc.shatterLife ?? 1, sizeK = rc.shatterSize ?? 1;
    for (let i = 0; i < count; i++) {
      const geo = new T.DodecahedronGeometry((0.08 + Math.random() * 0.08) * sizeK, 0);
      const isGlowing = Math.random() < 0.45;
      const mat = new T.MeshBasicMaterial({
        color: isGlowing ? color : 0x3a424e,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
      });
      const mesh = new T.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      this.group.add(mesh);

      const angle = Math.random() * Math.PI * 2;
      const speed = (2.5 + Math.random() * 5.5) * motionScale * spdK;
      const up = (1.5 + Math.random() * 5.0) * motionScale * spdK;
      this.particles.push({
        mesh,
        age: 0,
        life: (0.42 + Math.random() * 0.22) * lifeK,
        vel: {
          x: Math.cos(angle) * speed + nx * 2.5 * motionScale,
          y: up,
          z: Math.sin(angle) * speed + nz * 2.5 * motionScale,
        },
        rotVel: {x: (Math.random() - 0.5) * 16 * motionScale, y: (Math.random() - 0.5) * 16 * motionScale, z: (Math.random() - 0.5) * 16 * motionScale},
        startScale: 1.0,
      });
    }
  },

/** Emite estilhaços cristalinos quando uma barreira é destruída. */
  emitBarrierShatter(x, y, z, color) {
    const isReduceMotion = !!(this.accessibility?.reduceMotion || C.vfx.master?.reduceMotion || C.vfx.laser?.reduceMotion);
    const motionScale = isReduceMotion ? 0.25 : 1.0;
    const count = isReduceMotion ? 8 : (C.vfx?.barrier?.shatterFragments ?? 20);
    const bc = C.vfx?.barrier ?? {}, spdK = bc.shatterSpeed ?? 1, lifeK = bc.shatterLife ?? 1, sizeK = bc.shatterSize ?? 1;
    for (let i = 0; i < count; i++) {
      const geo = new T.BoxGeometry((0.12 + Math.random() * 0.15) * sizeK, (0.12 + Math.random() * 0.15) * sizeK, 0.02);
      const mat = new T.MeshBasicMaterial({color, transparent: true, opacity: 0.85, side: T.DoubleSide, depthWrite: false});
      const mesh = new T.Mesh(geo, mat);
      mesh.position.set(x + (Math.random() - 0.5) * 1.5, y + (Math.random() - 0.5) * 1.2, z + (Math.random() - 0.5) * 0.2);
      this.group.add(mesh);

      const angle = Math.random() * Math.PI * 2;
      const speed = (2.0 + Math.random() * 4.5) * motionScale * spdK;
      this.particles.push({
        mesh,
        age: 0,
        life: (0.5 + Math.random() * 0.25) * lifeK,
        vel: {x: Math.cos(angle) * speed, y: (1.0 + Math.random() * 4.0) * motionScale * spdK, z: Math.sin(angle) * speed},
        rotVel: {x: (Math.random() - 0.5) * 18 * motionScale, y: (Math.random() - 0.5) * 18 * motionScale, z: (Math.random() - 0.5) * 18 * motionScale},
        startScale: 1.0,
      });
    }
  }
};
