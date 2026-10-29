import * as THREE from 'three';
import {STATE} from '../data.js';
import {clamp, computeDurationOpacity, smoothstep} from '../math.js';
import {OptionStage} from '../stage.js';

// Efeitos da família (métodos de OptionStage, aplicados por mixin em ../stage.js). Usam `this` do palco.
export class PsychicEffects {
  updatePsychic(catKey, u, absTime) {
    const showDummies = STATE.showDummies;
    this.caster.visible = showDummies;
    this.target.visible = showDummies;

    if (catKey === 'aura') {
      this.caster.position.set(0, 0, 0);
      this.caster.rotation.y = 0;
      this.target.visible = false;
    } else if (catKey === 'hit') {
      this.caster.visible = false;
      this.target.position.set(0, 0, 0);
      this.target.rotation.y = 0;
    }

    if (catKey === 'sequence') {
      const pAura = STATE.elements.psychic.aura[this.index];
      const pSummon = STATE.elements.psychic.summon[this.index];
      const pHit = STATE.elements.psychic.hit[this.index];

      const uAura = clamp(u / 0.55, 0, 1);
      if (u < 0.6) this.renderPsychicAura(pAura, uAura, absTime, new THREE.Vector3(-1.95, 0, 0));
      if (u >= 0.12 && u <= 0.78) {
        this.renderPsychicSummon(pSummon, clamp((u - 0.12) / 0.62, 0, 1), absTime, new THREE.Vector3(-1.1, 0, 0), new THREE.Vector3(1.95, 0, 0));
      }
      if (u >= 0.62) {
        this.renderPsychicHit(pHit, clamp((u - 0.62) / 0.38, 0, 1), absTime, new THREE.Vector3(1.95, 0, 0));
      }
      const domP = u < 0.25 ? pAura : u < 0.65 ? pSummon : pHit;
      const domU = u < 0.25 ? uAura : u < 0.65 ? clamp((u - 0.12) / 0.62, 0, 1) : clamp((u - 0.62) / 0.38, 0, 1);
      this.lastAlpha = computeDurationOpacity(domP, domU);
      return;
    }

    const params = STATE.elements.psychic[catKey][this.index];
    this.lastAlpha = computeDurationOpacity(params, u);

    if (catKey === 'summon') {
      this.renderPsychicSummon(params, u, absTime, new THREE.Vector3(-1.05, 0, 0), new THREE.Vector3(1.95, 0, 0));
    } else if (catKey === 'hit') {
      this.renderPsychicHit(params, u, absTime, new THREE.Vector3(0, 0, 0));
    } else if (catKey === 'aura') {
      this.renderPsychicAura(params, u, absTime, new THREE.Vector3(0, 0, 0));
    }
  }

  renderPsychicSummon(p, u, absTime, spawnOrigin, targetOrigin) {
    const alpha = computeDurationOpacity(p, u);
    if (alpha <= 0.002) return;

    const c1 = new THREE.Color(p.color), c2 = new THREE.Color(p.color2), c3 = new THREE.Color(p.color3);
    const S = p.size, I = p.intensity, L = p.lift, SC = p.scatter, V = p.velocity, TB = p.turbulence;
    const t = absTime * V;

    const emergeK = smoothstep(0.0, 0.32, u);
    const launchK = smoothstep(0.66, 0.94, u);
    const hoverY = (1.35 + 0.22 * Math.sin(t * p.pulseFreq)) * L;
    const curX = THREE.MathUtils.lerp(spawnOrigin.x, targetOrigin.x - 0.2, Math.pow(launchK, 1.8));
    const curY = THREE.MathUtils.lerp(0.15, hoverY, emergeK) * (1 - 0.25 * launchK) + 0.25 * launchK;
    const curZ = Math.sin(t * 3.0) * 0.08 * TB * (1 - launchK);

    const core = this.nodes.summonCore;
    core.visible = true;
    core.position.set(curX, curY, curZ);
    core.scale.setScalar(Math.max(0.001, emergeK * S * (1 + 0.12 * Math.sin(t * p.pulseFreq * 1.5) * I)));
    core.rotation.set(t * 1.4 * (1 + 0.4 * TB), t * 2.1, t * 0.9);
    this.activeMeshCount += 2;

    const chosenObj = STATE.submodeByElement.psychic || 'boulder';
    for (const [k, m] of Object.entries(this.summonedMeshes)) {
      m.visible = k === chosenObj;
      if (m.visible) {
        if (k === 'polyhedron') {
          m.children[0].material.color.copy(c1);
          m.children[0].material.opacity = alpha;
          m.children[1].material.color.copy(c3);
          m.children[1].material.opacity = alpha * 0.85;
        } else if (k === 'biocore') {
          this.syncShaderUniforms(m.material, p, alpha, absTime);
        } else {
          m.material.color.copy(c1).lerp(new THREE.Color(0xffffff), 0.25);
          m.material.emissive.copy(c2);
          m.material.opacity = alpha;
        }
      }
    }

    const portal = this.nodes.shaderShells[0];
    portal.visible = true;
    portal.position.set(curX, curY, 0);
    portal.scale.setScalar(0.88 * S * emergeK);
    this.syncShaderUniforms(portal.material, p, alpha * 0.85, absTime);
    this.activeMeshCount++;

    const shardCount = clamp(Math.round(14 * p.amount), 3, 28);
    for (let i = 0; i < shardCount; i++) {
      const sh = this.nodes.shards[i];
      sh.visible = true;
      const ang = (i / shardCount) * Math.PI * 2 + t * 2.8;
      const orbitR = (1.1 - 0.45 * emergeK) * SC * S;
      sh.position.set(curX + Math.cos(ang) * orbitR * 0.45, curY + Math.sin(ang) * orbitR, Math.cos(ang * 2) * orbitR);
      sh.rotation.set(t * 4 + i, t * 3, i);
      sh.scale.setScalar(0.2 * S);
      sh.material.color.copy(i % 3 === 0 ? c1 : i % 3 === 1 ? c2 : c3);
      sh.material.opacity = alpha;
      this.activeMeshCount++;
    }
  }

  renderPsychicHit(p, u, absTime, center) {
    const alpha = computeDurationOpacity(p, u);
    if (alpha <= 0.002) return;

    const c1 = new THREE.Color(p.color), c2 = new THREE.Color(p.color2), c3 = new THREE.Color(p.color3);
    const S = p.size, I = p.intensity, L = p.lift, SC = p.scatter, V = p.velocity;
    const t = absTime * V;
    const impactCenter = new THREE.Vector3(center.x, 1.15 * L, center.z);
    const burst = 1 - Math.pow(1 - u, 2.6);

    const sh = this.nodes.shaderShells[0];
    sh.visible = true;
    sh.position.copy(impactCenter);
    sh.scale.setScalar((0.4 + burst * 1.75) * S * SC);
    this.syncShaderUniforms(sh.material, p, alpha * 0.92, absTime);
    this.activeMeshCount++;

    const shardN = clamp(Math.round(18 * p.amount), 4, 32);
    for (let i = 0; i < shardN; i++) {
      const s = this.nodes.shards[i];
      s.visible = true;
      const phi = Math.acos(1 - (2 * (i + 0.5)) / shardN);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i + t * 1.5;
      const dist = (0.3 + burst * 2.2) * S * SC;
      s.position.set(
        impactCenter.x + Math.sin(phi) * Math.cos(theta) * dist,
        Math.max(0.12, impactCenter.y + Math.cos(phi) * dist * L),
        impactCenter.z + Math.sin(phi) * Math.sin(theta) * dist
      );
      s.scale.setScalar(0.22 * S * I);
      s.material.color.copy(i % 3 === 0 ? c1 : i % 3 === 1 ? c2 : c3);
      s.material.opacity = alpha;
      this.activeMeshCount++;
    }
  }

  renderPsychicAura(p, u, absTime, center) {
    const alpha = computeDurationOpacity(p, u);
    if (alpha <= 0.002) return;

    const c1 = new THREE.Color(p.color), c2 = new THREE.Color(p.color2), c3 = new THREE.Color(p.color3);
    const S = p.size, L = p.lift, SC = p.scatter, V = p.velocity;
    const t = absTime * V;

    const shell = this.nodes.shaderShells[0];
    shell.visible = true;
    shell.position.set(center.x, 1.05 * L, center.z);
    shell.scale.set(1.05 * S * SC, 1.42 * S * L, 1.05 * S * SC);
    shell.rotation.y = t * 1.5;
    this.syncShaderUniforms(shell.material, p, alpha * 0.76, absTime);
    this.activeMeshCount++;

    const ringN = clamp(Math.round(8 * p.amount), 3, 14);
    for (let i = 0; i < ringN; i++) {
      const r = this.nodes.rings[i];
      r.visible = true;
      const phase = (i / ringN + u * 1.5) % 1;
      r.position.set(center.x, phase * 2.2 * L, center.z);
      r.rotation.set(Math.PI / 2, 0, t * 2);
      r.scale.setScalar((Math.sin(phase * Math.PI) * 1.1 + 0.35) * S * SC);
      r.material.color.copy(i % 3 === 0 ? c1 : i % 3 === 1 ? c2 : c3);
      r.material.opacity = alpha * Math.sin(phase * Math.PI);
      this.activeMeshCount++;
    }
  }
}
