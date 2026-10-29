import * as THREE from 'three';
import {STATE} from '../data.js';
import {clamp, computeDurationOpacity, smoothstep} from '../math.js';
import {OptionStage} from '../stage.js';

// Efeitos da família (métodos de OptionStage, aplicados por mixin em ../stage.js). Usam `this` do palco.
export class FlyingEffects {
  updateFlying(catKey, u, absTime) {
    const showDummies = STATE.showDummies;
    this.caster.visible = showDummies;
    this.target.visible = showDummies;

    const layerMode = STATE.submodeByElement.flying || 'all';
    const showWind = layerMode !== 'dust-only';
    const showDust = layerMode !== 'wind-only';
    const debrisMult = layerMode === 'heavy-debris' ? 1.75 : layerMode === 'wind-only' ? 0.0 : 1.0;

    if (catKey === 'winddust') {
      this.caster.position.set(0, 0, 0);
      this.caster.rotation.y = 0;
      this.target.visible = false;
    } else if (catKey === 'typhoon') {
      this.caster.visible = false;
      this.target.position.set(0, 0, 0);
      this.target.rotation.y = 0;
    }

    if (catKey === 'sequence') {
      const pWind = STATE.elements.flying.winddust[this.index];
      const pGale = STATE.elements.flying.gale[this.index];
      const pTyph = STATE.elements.flying.typhoon[this.index];

      if (u < 0.45) {
        this.renderFlyingWindDust(pWind, clamp(u / 0.45, 0, 1), absTime, new THREE.Vector3(-1.95, 0, 0), showWind, showDust, debrisMult);
      }
      if (u >= 0.15 && u <= 0.72) {
        const uG = clamp((u - 0.15) / 0.55, 0, 1);
        this.renderFlyingGale(pGale, uG, absTime, new THREE.Vector3(-1.4, 0, 0), new THREE.Vector3(1.95, 0, 0), showWind, showDust, debrisMult);
      }
      if (u >= 0.55) {
        const uT = clamp((u - 0.55) / 0.45, 0, 1);
        this.renderFlyingTyphoon(pTyph, uT, absTime, new THREE.Vector3(1.95, 0, 0), showWind, showDust, debrisMult);
      }
      const domP = u < 0.25 ? pWind : u < 0.6 ? pGale : pTyph;
      const domU = u < 0.25 ? u / 0.25 : u < 0.6 ? (u - 0.15) / 0.55 : (u - 0.55) / 0.45;
      this.lastAlpha = computeDurationOpacity(domP, clamp(domU, 0, 1));
      return;
    }

    const params = STATE.elements.flying[catKey][this.index];
    this.lastAlpha = computeDurationOpacity(params, u);

    if (catKey === 'tornado') {
      this.renderFlyingTornado(params, u, absTime, new THREE.Vector3(-1.1, 0, 0), new THREE.Vector3(1.95, 0, 0), showWind, showDust, debrisMult);
    } else if (catKey === 'gale') {
      this.renderFlyingGale(params, u, absTime, new THREE.Vector3(-1.45, 0, 0), new THREE.Vector3(1.95, 0, 0), showWind, showDust, debrisMult);
    } else if (catKey === 'typhoon') {
      this.renderFlyingTyphoon(params, u, absTime, new THREE.Vector3(0, 0, 0), showWind, showDust, debrisMult);
    } else if (catKey === 'winddust') {
      this.renderFlyingWindDust(params, u, absTime, new THREE.Vector3(0, 0, 0), showWind, showDust, debrisMult);
    }
  }

  renderFlyingTornado(p, u, absTime, startPos, targetPos, showWind, showDust, debrisMult) {
    const alpha = computeDurationOpacity(p, u);
    if (alpha <= 0.002) return;

    const cWind = new THREE.Color(p.color), cDust = new THREE.Color(p.color2), cBlade = new THREE.Color(p.color3);
    const S = p.size, I = p.intensity, L = p.lift, SC = p.scatter, V = p.velocity, TB = p.turbulence;
    const t = absTime * V;

    const travel = smoothstep(0.08, 0.88, u);
    const tx = THREE.MathUtils.lerp(startPos.x, targetPos.x, travel);
    const tz = Math.sin(travel * Math.PI * 2) * 0.32 * TB * (1 - travel * 0.5);
    const grow = smoothstep(0.0, 0.18, u);

    this.pointLight.position.set(tx, 1.5 * L, tz);
    this.pointLight.color.copy(cWind);
    this.pointLight.intensity = 2.4 * I * alpha * p.glow;

    if (this.target.visible && travel > 0.68) {
      this.target.position.y = Math.sin(clamp((travel - 0.68) / 0.32, 0, 1) * Math.PI) * 0.85 * L * I;
      this.target.rotation.y = -Math.PI / 2 + t * 8.0;
    }

    if (showWind) {
      for (let fIdx = 0; fIdx < 2; fIdx++) {
        const fn = this.nodes.funnels[fIdx];
        fn.visible = true;
        fn.position.set(tx, 0.02, tz);
        const radScale = (fIdx === 0 ? 0.78 : 1.12) * S * SC * grow;
        const hScale = (fIdx === 0 ? 1.15 : 0.98) * S * L * grow;
        fn.scale.set(radScale, hScale, radScale);
        fn.rotation.y = t * (fIdx === 0 ? 5.5 : -3.8);
        this.syncShaderUniforms(fn.material, p, alpha * (fIdx === 0 ? 0.95 : 0.65), absTime + fIdx * 0.7);
        this.activeMeshCount++;
      }

      const bladeN = clamp(Math.round(14 * p.amount), 4, 24);
      for (let i = 0; i < bladeN; i++) {
        const cb = this.nodes.crescents[i];
        cb.visible = true;
        const hFrac = (i / bladeN + u * 2.2) % 1;
        const y = hFrac * 2.75 * S * L * grow;
        const coneR = (0.28 + 0.88 * Math.pow(hFrac, 1.45)) * S * SC;
        const ang = i * 1.4 + t * 9.0;
        const swayX = Math.sin(hFrac * 4.2 - t * 4.8) * 0.22 * TB * (0.25 + hFrac);
        const swayZ = Math.cos(hFrac * 3.8 - t * 4.2) * 0.22 * TB * (0.25 + hFrac);
        cb.position.set(tx + swayX, y, tz + swayZ);
        cb.rotation.set(Math.PI / 2 + 0.28 * Math.sin(ang), 0.22 * Math.cos(ang), ang);
        cb.scale.setScalar(coneR * (0.85 + 0.25 * (i % 2)));
        cb.material.color.copy(i % 3 === 0 ? cBlade : cWind);
        cb.material.opacity = alpha * Math.sin(hFrac * Math.PI) * 0.92;
        this.activeMeshCount++;
      }
    }

    if (showDust) {
      const dustN = clamp(Math.round(24 * p.amount), 8, 40);
      for (let i = 0; i < dustN; i++) {
        const dp = this.nodes.dustPuffs[i];
        dp.visible = true;
        const ringLayer = i % 3;
        const a = (i / dustN) * Math.PI * 2 + t * (5.5 - ringLayer * 1.3);
        const rad = (0.42 + ringLayer * 0.34 + 0.14 * Math.sin(t * 6 + i)) * S * SC * grow;
        const py = (0.14 + ringLayer * 0.16 + 0.08 * Math.abs(Math.sin(t * 5 + i))) * S * L;
        dp.position.set(tx + Math.cos(a) * rad, py, tz + Math.sin(a) * rad);
        dp.rotation.set(t * 3 + i, a, t * 2);
        const puffScale = (0.42 + 0.18 * (i % 3)) * S * (1 + 0.15 * I);
        dp.scale.set(puffScale * 1.25, puffScale * 0.85, puffScale * 1.25);
        dp.material.color.copy(cDust).lerp(cWind, ringLayer === 2 ? 0.35 : 0.1);
        dp.material.opacity = alpha * (0.88 - ringLayer * 0.18);
        this.activeMeshCount++;
      }
    }

    if (debrisMult > 0) {
      const debN = clamp(Math.round(14 * p.amount * debrisMult), 3, 32);
      for (let i = 0; i < debN; i++) {
        const sh = this.nodes.shards[i];
        sh.visible = true;
        const hFrac = (i * 0.19 + u * 1.6) % 1;
        const a = i * 2.4 + t * 7.5;
        const rad = (0.38 + hFrac * 1.15) * S * SC;
        sh.position.set(tx + Math.cos(a) * rad, (0.15 + hFrac * 2.55) * L * S, tz + Math.sin(a) * rad);
        sh.rotation.set(t * 6 + i, t * 5, i);
        sh.scale.setScalar((0.16 + (i % 3) * 0.07) * S);
        sh.material.color.copy(i % 2 === 0 ? cDust : cBlade);
        sh.material.opacity = alpha;
        this.activeMeshCount++;
      }
    }
  }

  renderFlyingGale(p, u, absTime, startPos, targetPos, showWind, showDust, debrisMult) {
    const alpha = computeDurationOpacity(p, u);
    if (alpha <= 0.002) return;

    const cWind = new THREE.Color(p.color), cDust = new THREE.Color(p.color2), cBlade = new THREE.Color(p.color3);
    const S = p.size, I = p.intensity, L = p.lift, SC = p.scatter, V = p.velocity, TB = p.turbulence;
    const t = absTime * V;

    const surge = 1 - Math.pow(1 - u, 2.2);
    const gx = THREE.MathUtils.lerp(startPos.x, targetPos.x, surge);

    if (showWind) {
      const tunnel = this.nodes.funnels[0];
      tunnel.visible = true;
      tunnel.position.set(startPos.x, 1.1 * L, 0);
      tunnel.rotation.set(0, 0, -Math.PI / 2);
      tunnel.scale.set(0.68 * S * SC, 1.35 * S * Math.min(1, u * 2.2), 0.68 * S * SC);
      this.syncShaderUniforms(tunnel.material, p, alpha * 0.78, absTime);
      this.activeMeshCount++;

      const slashN = clamp(Math.round(12 * p.amount), 3, 22);
      for (let i = 0; i < slashN; i++) {
        const cb = this.nodes.crescents[i];
        cb.visible = true;
        const waveLag = clamp((u - (i % 4) * 0.07) / 0.75, 0, 1);
        const sx = THREE.MathUtils.lerp(startPos.x, targetPos.x + 0.4, 1 - Math.pow(1 - waveLag, 2));
        cb.position.set(sx, (1.1 + Math.sin(i * 2.1 + t * 5) * 0.38 * SC) * L, Math.cos(i * 1.7 + t * 4) * 0.45 * SC);
        cb.rotation.set((i % 2 === 0 ? 0.55 : -0.55) + Math.sin(t * 3 + i) * 0.2 * TB, Math.PI / 2, -Math.PI / 2 + t * 6);
        cb.scale.setScalar((0.55 + (i % 3) * 0.28) * S * I);
        cb.material.color.copy(i % 2 === 0 ? cBlade : cWind);
        cb.material.opacity = alpha * (1 - waveLag * 0.35);
        this.activeMeshCount++;
      }
    }

    if (showDust) {
      const wakeN = clamp(Math.round(22 * p.amount), 6, 38);
      for (let i = 0; i < wakeN; i++) {
        const dp = this.nodes.dustPuffs[i];
        dp.visible = true;
        const side = i % 2 === 0 ? 1 : -1;
        const prog = (i / wakeN + u * 1.4) % 1;
        dp.position.set(THREE.MathUtils.lerp(startPos.x - 0.3, gx, prog), (0.12 + prog * 0.45 * L) * S, side * (0.28 + prog * 0.95) * SC * S);
        dp.rotation.set(t * 4, prog * 3, side * t * 3);
        const sc = (0.32 + prog * 0.42) * S;
        dp.scale.set(sc * 1.35, sc * 0.8, sc);
        dp.material.color.copy(cDust);
        dp.material.opacity = alpha * (1 - prog * 0.65) * 0.9;
        this.activeMeshCount++;
      }
    }
  }

  renderFlyingTyphoon(p, u, absTime, center, showWind, showDust, debrisMult) {
    const alpha = computeDurationOpacity(p, u);
    if (alpha <= 0.002) return;

    const cWind = new THREE.Color(p.color), cDust = new THREE.Color(p.color2), cBlade = new THREE.Color(p.color3);
    const S = p.size, I = p.intensity, L = p.lift, SC = p.scatter, V = p.velocity;
    const t = absTime * V;
    const expand = 1 - Math.pow(1 - clamp(u / 0.35, 0, 1), 2.4);

    if (showWind) {
      for (let i = 0; i < 5; i++) {
        const fn = this.nodes.funnels[i];
        fn.visible = true;
        if (i < 3) {
          fn.position.set(center.x, 0.01, center.z);
          const rS = (0.75 + i * 0.58) * S * SC * expand;
          const hS = (1.35 - i * 0.12) * S * L * expand;
          fn.scale.set(rS, hS, rS);
          fn.rotation.y = t * (i % 2 === 0 ? 4.8 : -3.6);
        } else {
          const satA = t * 2.4 + (i - 3) * Math.PI;
          const satR = 1.65 * S * SC * expand;
          fn.position.set(center.x + Math.cos(satA) * satR, 0.02, center.z + Math.sin(satA) * satR);
          fn.scale.set(0.38 * S * SC, 0.92 * S * L * expand, 0.38 * S * SC);
          fn.rotation.y = -t * 8.0;
        }
        this.syncShaderUniforms(fn.material, p, alpha * (i === 0 ? 0.95 : 0.68), absTime + i * 0.4);
        this.activeMeshCount++;
      }
    }

    if (showDust) {
      const dustN = clamp(Math.round(32 * p.amount), 10, 42);
      for (let i = 0; i < dustN; i++) {
        const dp = this.nodes.dustPuffs[i];
        dp.visible = true;
        const band = i % 4;
        const a = (i / dustN) * Math.PI * 2 + t * (4.8 - band * 0.8);
        const rad = (0.55 + band * 0.52 + 0.2 * Math.sin(t * 4 + i)) * S * SC * expand;
        const py = (0.16 + band * 0.24 + 0.12 * Math.sin(t * 5 + i)) * S * L;
        dp.position.set(center.x + Math.cos(a) * rad, py, center.z + Math.sin(a) * rad);
        dp.rotation.set(t * 2.5 + i, a, t * 2);
        const sc = (0.48 + (i % 3) * 0.22) * S * (0.9 + 0.2 * I);
        dp.scale.set(sc * 1.3, sc * 0.85, sc * 1.3);
        dp.material.color.copy(cDust).lerp(cWind, band * 0.18);
        dp.material.opacity = alpha * (0.92 - band * 0.15);
        this.activeMeshCount++;
      }
    }
  }

  renderFlyingWindDust(p, u, absTime, center, showWind, showDust) {
    const alpha = computeDurationOpacity(p, u);
    if (alpha <= 0.002) return;

    const cWind = new THREE.Color(p.color), cDust = new THREE.Color(p.color2), cBlade = new THREE.Color(p.color3);
    const S = p.size, I = p.intensity, L = p.lift, SC = p.scatter, V = p.velocity;
    const t = absTime * V;

    if (showWind) {
      const auraFunnel = this.nodes.funnels[0];
      auraFunnel.visible = true;
      auraFunnel.position.set(center.x, 0.02, center.z);
      auraFunnel.scale.set(0.68 * S * SC, 0.85 * S * L, 0.68 * S * SC);
      auraFunnel.rotation.y = t * 4.2;
      this.syncShaderUniforms(auraFunnel.material, p, alpha * 0.72, absTime);
      this.activeMeshCount++;

      const cN = clamp(Math.round(10 * p.amount), 3, 20);
      for (let i = 0; i < cN; i++) {
        const cb = this.nodes.crescents[i];
        cb.visible = true;
        const phase = (i / cN + u * 1.5) % 1;
        const a = i * 1.7 + t * 5.5;
        cb.position.set(center.x, (0.2 + phase * 1.95) * L, center.z);
        cb.rotation.set(Math.PI / 2 + 0.32 * Math.sin(a), 0.25 * Math.cos(a), a);
        cb.scale.setScalar((0.55 + 0.35 * Math.sin(phase * Math.PI)) * S * SC);
        cb.material.color.copy(i % 2 === 0 ? cWind : cBlade);
        cb.material.opacity = alpha * Math.sin(phase * Math.PI) * 0.9;
        this.activeMeshCount++;
      }
    }

    if (showDust) {
      const dustN = clamp(Math.round(18 * p.amount), 6, 32);
      for (let i = 0; i < dustN; i++) {
        const dp = this.nodes.dustPuffs[i];
        dp.visible = true;
        const phase = (i / dustN + u) % 1;
        const a = (i / dustN) * Math.PI * 2 + t * 3.2;
        const rad = (0.48 + phase * 0.85) * S * SC;
        dp.position.set(center.x + Math.cos(a) * rad, (0.12 + Math.sin(phase * Math.PI) * 0.22) * S, center.z + Math.sin(a) * rad);
        const sc = Math.sin(phase * Math.PI) * 0.42 * S * I + 0.12;
        dp.scale.set(sc * 1.25, sc * 0.78, sc * 1.25);
        dp.material.color.copy(cDust);
        dp.material.opacity = alpha * Math.sin(phase * Math.PI) * 0.88;
        this.activeMeshCount++;
      }
    }
  }

  // ==========================================================================
  // ABA 1: EFEITOS 3D DO TIPO PSÍQUICO (INVOCAÇÃO, HIT, AURA & SEQUÊNCIA)
  // ==========================================================================
}
