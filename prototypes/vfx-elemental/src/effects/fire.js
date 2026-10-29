import * as THREE from 'three';
import {STATE} from '../data.js';
import {clamp, computeDurationOpacity, smoothstep} from '../math.js';
import {OptionStage} from '../stage.js';

// Efeitos da família (métodos de OptionStage, aplicados por mixin em ../stage.js). Usam `this` do palco.
export class FireEffects {
  updateFire(catKey, u, absTime) {
    const showDummies = STATE.showDummies;
    this.caster.visible = showDummies;
    this.target.visible = showDummies;

    const layerMode = STATE.submodeByElement.fire || 'all';
    const showFlames = layerMode !== 'embers-only';
    const showEmbers = layerMode !== 'flame-only';
    const densityMult = layerMode === 'inferno-heavy' ? 1.6 : 1.0;

    if (catKey === 'emberaura') {
      this.caster.position.set(0, 0, 0);
      this.caster.rotation.y = 0;
      this.target.visible = false;
    } else if (catKey === 'pillar' || catKey === 'explosion') {
      this.caster.visible = false;
      this.target.position.set(0, 0, 0);
      this.target.rotation.y = 0;
    }

    if (catKey === 'sequence') {
      const pAura = STATE.elements.fire.emberaura[this.index];
      const pBall = STATE.elements.fire.fireball[this.index];
      const pPil = STATE.elements.fire.pillar[this.index];
      const pExp = STATE.elements.fire.explosion[this.index];

      if (u < 0.42) {
        this.renderFireAura(pAura, clamp(u / 0.42, 0, 1), absTime, new THREE.Vector3(-1.95, 0, 0), showFlames, showEmbers, densityMult);
      }
      if (u >= 0.15 && u <= 0.68) {
        this.renderFireball(pBall, clamp((u - 0.15) / 0.5, 0, 1), absTime, new THREE.Vector3(-1.35, 0, 0), new THREE.Vector3(1.95, 0, 0), showFlames, showEmbers, densityMult);
      }
      if (u >= 0.55) {
        const uImpact = clamp((u - 0.55) / 0.45, 0, 1);
        this.renderFirePillar(pPil, uImpact, absTime, new THREE.Vector3(1.95, 0, 0), showFlames, showEmbers, densityMult);
        this.renderFireExplosion(pExp, uImpact, absTime, new THREE.Vector3(1.95, 0, 0), showFlames, showEmbers, densityMult);
      }
      const domP = u < 0.25 ? pAura : u < 0.58 ? pBall : pPil;
      const domU = u < 0.25 ? u / 0.25 : u < 0.58 ? (u - 0.15) / 0.5 : (u - 0.55) / 0.45;
      this.lastAlpha = computeDurationOpacity(domP, clamp(domU, 0, 1));
      return;
    }

    const params = STATE.elements.fire[catKey][this.index];
    this.lastAlpha = computeDurationOpacity(params, u);

    if (catKey === 'fireball') {
      this.renderFireball(params, u, absTime, new THREE.Vector3(-1.35, 0, 0), new THREE.Vector3(1.95, 0, 0), showFlames, showEmbers, densityMult);
    } else if (catKey === 'pillar') {
      this.renderFirePillar(params, u, absTime, new THREE.Vector3(0, 0, 0), showFlames, showEmbers, densityMult);
    } else if (catKey === 'explosion') {
      this.renderFireExplosion(params, u, absTime, new THREE.Vector3(0, 0, 0), showFlames, showEmbers, densityMult);
    } else if (catKey === 'emberaura') {
      this.renderFireAura(params, u, absTime, new THREE.Vector3(0, 0, 0), showFlames, showEmbers, densityMult);
    }
  }

  // --------------------------------------------------------------------------
  // FOGO 1: RAJADA & BOLA DE FOGO (PROJÉTIL ÍGNEO + RASTRO)
  // --------------------------------------------------------------------------
  renderFireball(p, u, absTime, startPos, targetPos, showFlames, showEmbers, densityMult) {
    const alpha = computeDurationOpacity(p, u);
    if (alpha <= 0.002) return;

    const cMain = new THREE.Color(p.color);
    const cSec = new THREE.Color(p.color2);
    const cCore = new THREE.Color(p.color3);
    const S = p.size, I = p.intensity, L = p.lift, SC = p.scatter, V = p.velocity, TB = p.turbulence;
    const t = absTime * V;

    const chargeK = smoothstep(0.0, 0.24, u);
    const flyK = smoothstep(0.20, 0.88, u);
    const fx = THREE.MathUtils.lerp(startPos.x, targetPos.x, Math.pow(flyK, 1.5));
    const fy = (1.18 + Math.sin(flyK * Math.PI) * 0.28 * (this.index === 0 ? 1 : 0.4)) * L;
    const fz = Math.sin(t * 4.5) * 0.08 * TB * (1 - flyK);

    this.pointLight.position.set(fx, fy, fz);
    this.pointLight.color.copy(cMain);
    this.pointLight.intensity = 3.0 * I * alpha * p.glow;

    if (this.target.visible && flyK > 0.78) {
      this.target.position.x = targetPos.x + Math.sin(t * 45) * 0.14 * I;
    }

    if (showFlames) {
      // Núcleo Esférico + Cauda Cônica de Fogo (Shader GLSL da Opção A/B/C)
      const orb = this.nodes.fireOrbs[0];
      orb.visible = true;
      orb.position.set(fx, fy, fz);
      orb.scale.setScalar(0.68 * S * chargeK * (1 + 0.12 * Math.sin(t * p.pulseFreq * 2)));
      orb.rotation.set(t * 3, -t * 4, 0);
      this.syncShaderUniforms(orb.material, p, alpha, absTime);
      this.activeMeshCount++;

      // Cone de Chama arrastado para trás como cometa ígneo
      const wakeCol = this.nodes.fireColumns[0];
      wakeCol.visible = true;
      wakeCol.position.set(fx, fy, fz);
      wakeCol.rotation.set(0, 0, Math.PI / 2);
      wakeCol.scale.set(0.52 * S * SC, 1.15 * S * Math.max(0.2, flyK), 0.52 * S * SC);
      this.syncShaderUniforms(wakeCol.material, p, alpha * 0.88, absTime + 0.3);
      this.activeMeshCount++;

      if (this.index === 0) {
        // OPÇÃO A (Mitológico Japonês): Roda Solar Hinokami / Kaen-daiko girando ao redor da bola de fogo + Volutas Vermelhão/Ouro
        const wheelN = clamp(Math.round(12 * p.amount * densityMult), 4, 22);
        for (let i = 0; i < wheelN; i++) {
          const cb = this.nodes.crescents[i];
          cb.visible = true;
          const lag = Math.max(0, flyK - (i % 4) * 0.06);
          const wx = THREE.MathUtils.lerp(startPos.x, targetPos.x, Math.pow(lag, 1.5));
          const a = (i / wheelN) * Math.PI * 2 + t * 7.5;
          cb.position.set(wx, fy, fz);
          cb.rotation.set(a, Math.PI / 2 * (i % 2), a);
          cb.scale.setScalar((0.55 + (i % 3) * 0.22) * S * SC * chargeK);
          cb.material.color.copy(i % 2 === 0 ? cCore : cMain);
          cb.material.opacity = alpha * 0.92;
          this.activeMeshCount++;
        }
      } else if (this.index === 1) {
        // OPÇÃO B (Tinta Sumi-e): Rasgos de Pincel Negro + Brasa Viva cortando o ar
        const spN = clamp(Math.round(14 * p.amount * densityMult), 4, 22);
        for (let i = 0; i < spN; i++) {
          const sp = this.nodes.spikes[i];
          sp.visible = true;
          const lag = Math.max(0, flyK - i * 0.035);
          const sx = THREE.MathUtils.lerp(startPos.x, targetPos.x, Math.pow(lag, 1.5));
          const a = i * 1.9 + t * 8.0;
          const r = (0.25 + (i % 3) * 0.22) * S * SC;
          sp.position.set(sx, fy + Math.sin(a) * r, fz + Math.cos(a) * r);
          sp.rotation.set(0, 0, Math.PI / 2 + Math.sin(a) * 0.35);
          sp.scale.set(0.42 * S, 1.15 * S * I, 0.42 * S);
          sp.userData.core.material.color.copy(i % 2 === 0 ? cMain : cCore);
          sp.userData.core.material.opacity = alpha;
          sp.userData.hull.material.opacity = alpha;
          this.activeMeshCount += 2;
        }
      } else {
        // OPÇÃO C (Fogo Mágico Arcano): Selos Rúnicos Giratórios no Lançador + Anéis Astrais no Projétil
        for (let i = 0; i < 6; i++) {
          const r = this.nodes.rings[i];
          r.visible = true;
          if (i < 2) {
            // Círculo hermético duplo no lançador
            r.position.set(startPos.x, 1.18 * L, 0);
            r.rotation.set(0, Math.PI / 2, t * (i % 2 ? 3 : -3));
            r.scale.setScalar((0.75 + i * 0.35) * S * SC * chargeK);
          } else {
            // Anéis giroscópicos envolvendo o orbe mágico
            r.position.set(fx, fy, fz);
            r.rotation.set(t * 4 + i, t * 3 - i, i);
            r.scale.setScalar((0.48 + (i - 2) * 0.16) * S * SC);
          }
          r.material.color.copy(i % 2 === 0 ? cCore : cSec);
          r.material.opacity = alpha * 0.9;
          this.activeMeshCount++;
        }
      }
    }

    // Rastro de Brasas / Respingos de Tinta / Cristais de Éter
    if (showEmbers) {
      if (this.index === 1) {
        // Respingos 3D de Nanquim & Brasa (Sumi-e Ink Drops)
        const dropN = clamp(Math.round(20 * p.amount * densityMult), 6, 38);
        for (let i = 0; i < dropN; i++) {
          const dp = this.nodes.dustPuffs[i];
          dp.visible = true;
          const prog = (i / dropN + u * 1.6) % 1;
          const dx = THREE.MathUtils.lerp(startPos.x, fx, prog);
          const a = i * 2.3 + t * 4;
          const rad = (0.18 + (1 - prog) * 0.65) * S * SC;
          dp.position.set(dx, fy + Math.sin(a) * rad, Math.cos(a) * rad);
          dp.rotation.set(t * 5, a, i);
          dp.scale.setScalar((0.18 + (i % 3) * 0.1) * S);
          dp.material.color.copy(i % 3 === 0 ? cMain : new THREE.Color(0x110c14));
          dp.material.opacity = alpha * 0.92;
          this.activeMeshCount++;
        }
      } else {
        // Pétalas de Ouro Solar (Opção A) ou Cristais/Fagulhas Arcanas (Opção C)
        const embN = clamp(Math.round(24 * p.amount * densityMult), 6, 44);
        for (let i = 0; i < embN; i++) {
          const hn = this.nodes.helixNodes[i];
          hn.visible = true;
          const prog = (i / embN + u * 1.8) % 1;
          const ex = THREE.MathUtils.lerp(startPos.x, fx, prog);
          const a = i * 1.7 + t * 6.0;
          const rad = (0.15 + (1 - prog) * 0.72) * S * SC;
          hn.position.set(ex, fy + Math.sin(a) * rad + (1 - prog) * 0.35 * L, Math.cos(a) * rad);
          hn.scale.setScalar((0.11 + (i % 3) * 0.05) * S * I);
          hn.material.color.copy(i % 3 === 0 ? cCore : i % 3 === 1 ? cMain : cSec);
          hn.material.opacity = alpha * prog;
          this.activeMeshCount++;
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // FOGO 2: PILAR DE FOGO & ERUPÇÃO (COLUNA ÍGNEA / GÊISER 3D)
  // --------------------------------------------------------------------------
  renderFirePillar(p, u, absTime, center, showFlames, showEmbers, densityMult) {
    const alpha = computeDurationOpacity(p, u);
    if (alpha <= 0.002) return;

    const cMain = new THREE.Color(p.color);
    const cSec = new THREE.Color(p.color2);
    const cCore = new THREE.Color(p.color3);
    const S = p.size, I = p.intensity, L = p.lift, SC = p.scatter, V = p.velocity, TB = p.turbulence;
    const t = absTime * V;

    const erupt = smoothstep(0.0, 0.22, u);
    this.pointLight.position.set(center.x, 1.8 * L, center.z);
    this.pointLight.color.copy(cMain);
    this.pointLight.intensity = 3.5 * I * alpha * p.glow;

    if (this.target.visible) {
      this.target.position.set(center.x, Math.sin(u * Math.PI) * 0.75 * L * erupt, center.z);
      this.target.rotation.y = t * 5.0;
    }

    if (showFlames) {
      // Colunas de Fogo Concêntricas (Núcleo + Manto Externo Contra-Rotativo)
      for (let i = 0; i < 3; i++) {
        const fc = this.nodes.fireColumns[i];
        fc.visible = true;
        fc.position.set(center.x, 0.01, center.z);
        fc.rotation.set(0, t * (i % 2 === 0 ? 5.2 : -4.0) + i * 1.1, 0);
        const rS = (0.72 + i * 0.34) * S * SC * (0.3 + 0.7 * erupt);
        const hS = (1.28 - i * 0.1) * S * L * erupt;
        fc.scale.set(rS, hS, rS);
        this.syncShaderUniforms(fc.material, p, alpha * (i === 0 ? 0.98 : 0.78), absTime + i * 0.45);
        this.activeMeshCount++;
      }

      if (this.index === 0) {
        // OPÇÃO A (Mitológico Japonês): Volutas de Fogo Xintoísta (Kaen Scrolls) subindo em lótus + Espelho Solar no Chão
        const scrollN = clamp(Math.round(16 * p.amount * densityMult), 6, 24);
        for (let i = 0; i < scrollN; i++) {
          const cb = this.nodes.crescents[i];
          cb.visible = true;
          const hFrac = (i / scrollN + u * 1.8) % 1;
          const a = (i / scrollN) * Math.PI * 2 + t * 5.5;
          const rad = (0.55 + Math.sin(hFrac * Math.PI) * 0.65) * S * SC;
          cb.position.set(center.x + Math.cos(a) * rad * 0.35, hFrac * 2.8 * L * S * erupt, center.z + Math.sin(a) * rad * 0.35);
          cb.rotation.set(0.35, a, Math.PI / 4);
          cb.scale.setScalar(rad * (0.75 + 0.25 * (i % 2)));
          cb.material.color.copy(i % 2 === 0 ? cCore : cMain);
          cb.material.opacity = alpha * Math.sin(hFrac * Math.PI) * 0.95;
          this.activeMeshCount++;
        }
      } else if (this.index === 1) {
        // OPÇÃO B (Tinta Sumi-e): Rasgos Verticais de Pincel com Contorno de Nanquim Preto + Círculo Enso no Solo
        const spN = clamp(Math.round(18 * p.amount * densityMult), 6, 24);
        for (let i = 0; i < spN; i++) {
          const sp = this.nodes.spikes[i];
          sp.visible = true;
          const hFrac = (i / spN + u * 2.0) % 1;
          const a = i * 1.65 + t * 6.0;
          const rad = (0.45 + (1 - hFrac) * 0.55) * S * SC;
          sp.position.set(center.x + Math.cos(a) * rad, hFrac * 2.75 * L * S * erupt, center.z + Math.sin(a) * rad);
          sp.rotation.set(0.18 * Math.sin(a), -a, 0.15);
          const sc = (0.52 + (i % 3) * 0.2) * S * I;
          sp.scale.set(sc * 0.7, sc * 1.45, sc * 0.7);
          sp.userData.core.material.color.copy(i % 3 === 0 ? cCore : cMain);
          sp.userData.core.material.opacity = alpha;
          sp.userData.hull.material.opacity = alpha;
          this.activeMeshCount += 2;
        }
      } else {
        // OPÇÃO C (Fogo Mágico Arcano): Anéis de Invocação Rúnica Subindo pela Coluna + Poliedros de Éter
        const ringN = clamp(Math.round(10 * p.amount * densityMult), 4, 16);
        for (let i = 0; i < ringN; i++) {
          const r = this.nodes.rings[i];
          r.visible = true;
          const hFrac = i < 3 ? 0.03 + i * 0.03 : ((i - 3) / (ringN - 3) + u * 1.5) % 1;
          r.position.set(center.x, hFrac * 2.8 * L * S * erupt, center.z);
          r.rotation.set(Math.PI / 2 + (i >= 3 ? 0.22 * Math.sin(t * 3 + i) : 0), 0, t * (i % 2 ? 4 : -4));
          r.scale.setScalar((i < 3 ? 1.15 + i * 0.45 : 0.65 + Math.sin(hFrac * Math.PI) * 0.55) * S * SC);
          r.material.color.copy(i % 3 === 0 ? cCore : i % 3 === 1 ? cMain : cSec);
          r.material.opacity = alpha * (i < 3 ? 0.95 : Math.sin(hFrac * Math.PI));
          this.activeMeshCount++;
        }
      }
    }

    if (showEmbers) {
      if (this.index === 1) {
        // Nuvens de Fumaça/Nanquim & Gotas de Tinta na Base do Pilar Sumi-e
        const inkN = clamp(Math.round(24 * p.amount * densityMult), 8, 38);
        for (let i = 0; i < inkN; i++) {
          const dp = this.nodes.dustPuffs[i];
          dp.visible = true;
          const hFrac = (i / inkN + u * 1.4) % 1;
          const a = i * 2.1 + t * 4.5;
          const rad = (0.55 + (1 - hFrac) * 0.75) * S * SC;
          dp.position.set(center.x + Math.cos(a) * rad, hFrac * 2.3 * L * S, center.z + Math.sin(a) * rad);
          dp.rotation.set(t * 3, a, i);
          const sc = (0.35 * (1 - hFrac * 0.4)) * S;
          dp.scale.set(sc * 1.2, sc * 0.9, sc * 1.2);
          dp.material.color.copy(i % 3 === 0 ? cMain : new THREE.Color(0x140e16));
          dp.material.opacity = alpha * (1 - hFrac * 0.5) * 0.92;
          this.activeMeshCount++;
        }
      } else {
        // Chuva Ascendente de Pétalas Solares (A) ou Cristais de Fogo Mágico (C)
        const shardN = clamp(Math.round(22 * p.amount * densityMult), 6, 34);
        for (let i = 0; i < shardN; i++) {
          const sh = this.nodes.shards[i];
          sh.visible = true;
          const hFrac = (i / shardN + u * 1.6) % 1;
          const a = i * 2.35 + t * 5.0;
          const rad = (0.45 + Math.sin(hFrac * Math.PI) * 0.95) * S * SC;
          sh.position.set(center.x + Math.cos(a) * rad, (0.15 + hFrac * 2.95) * L * S, center.z + Math.sin(a) * rad);
          sh.rotation.set(t * 6 + i, t * 4, i);
          sh.scale.setScalar((0.16 + (i % 3) * 0.06) * S * I);
          const col = i % 3 === 0 ? cCore : i % 3 === 1 ? cMain : cSec;
          sh.material.color.copy(col);
          sh.material.emissive.copy(col);
          sh.material.opacity = alpha * Math.sin(hFrac * Math.PI);
          this.activeMeshCount++;
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // FOGO 3: EXPLOSÃO & HIT DE FOGO (COMBUSTÃO / DETONAÇÃO NO ALVO)
  // --------------------------------------------------------------------------
  renderFireExplosion(p, u, absTime, center, showFlames, showEmbers, densityMult) {
    const alpha = computeDurationOpacity(p, u);
    if (alpha <= 0.002) return;

    const cMain = new THREE.Color(p.color);
    const cSec = new THREE.Color(p.color2);
    const cCore = new THREE.Color(p.color3);
    const S = p.size, I = p.intensity, L = p.lift, SC = p.scatter, V = p.velocity, TB = p.turbulence;
    const t = absTime * V;

    const hitPos = new THREE.Vector3(center.x, 1.15 * L, center.z);
    const burst = 1 - Math.pow(1 - u, 2.5);

    this.pointLight.position.copy(hitPos);
    this.pointLight.color.copy(cCore);
    this.pointLight.intensity = 3.8 * I * alpha * p.glow;

    if (showFlames) {
      // Esferas de Detonação Ígnea em Camadas
      for (let i = 0; i < 2; i++) {
        const orb = this.nodes.fireOrbs[i];
        orb.visible = true;
        orb.position.copy(hitPos);
        orb.scale.setScalar((0.38 + burst * (1.75 + i * 0.65)) * S * SC);
        orb.rotation.set(t * (i ? -3 : 3), t * 4, i);
        this.syncShaderUniforms(orb.material, p, alpha * (i === 0 ? 0.96 : 0.68), absTime + i * 0.4);
        this.activeMeshCount++;
      }

      if (this.index === 0) {
        // OPÇÃO A (Mitológico Japonês): Desabrochar de Lótus de Fogo (Kaen Lotus) + Anéis Solares
        const lotusN = clamp(Math.round(16 * p.amount * densityMult), 6, 24);
        for (let i = 0; i < lotusN; i++) {
          const cb = this.nodes.crescents[i];
          cb.visible = true;
          const a = (i / lotusN) * Math.PI * 2 + t * 2.5;
          const layer = i % 2;
          const dist = (0.35 + burst * (1.35 + layer * 0.45)) * S * SC;
          cb.position.set(hitPos.x + Math.cos(a) * dist * 0.5, hitPos.y + (layer ? 0.25 : -0.15) * burst, hitPos.z + Math.sin(a) * dist * 0.5);
          cb.rotation.set(0.65 + layer * 0.4, a, t * 3);
          cb.scale.setScalar((0.55 + burst * 0.75) * S);
          cb.material.color.copy(i % 2 === 0 ? cCore : cMain);
          cb.material.opacity = alpha * 0.92;
          this.activeMeshCount++;
        }
      } else if (this.index === 1) {
        // OPÇÃO B (Tinta Sumi-e): Explosão de Lanças de Nanquim & Brasa (Ink-Splash Impact)
        const spN = clamp(Math.round(20 * p.amount * densityMult), 6, 24);
        for (let i = 0; i < spN; i++) {
          const sp = this.nodes.spikes[i];
          sp.visible = true;
          const golden = Math.PI * (3 - Math.sqrt(5));
          const y = 1 - (i / Math.max(1, spN - 1)) * 2;
          const r = Math.sqrt(Math.max(0, 1 - y * y));
          const th = golden * i * (1 + 0.1 * TB);
          const dir = new THREE.Vector3(Math.cos(th) * r, y * L, Math.sin(th) * r).normalize();
          const reach = (0.3 + burst * (1.65 + (i % 3) * 0.4)) * S * SC;
          sp.position.copy(hitPos).addScaledVector(dir, reach * 0.65);
          sp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
          sp.scale.set(0.55 * S, 1.3 * S * I * (1 - 0.2 * u), 0.55 * S);
          sp.userData.core.material.color.copy(i % 2 === 0 ? cMain : cCore);
          sp.userData.core.material.opacity = alpha;
          sp.userData.hull.material.opacity = alpha;
          this.activeMeshCount += 2;
        }
      } else {
        // OPÇÃO C (Fogo Mágico Arcano): Supernova Rúnica com Gaiola Poliedral + Anéis Herméticos Inclinados
        for (let i = 0; i < 3; i++) {
          const wf = this.nodes.wireframes[i];
          wf.visible = true;
          wf.position.copy(hitPos);
          wf.scale.setScalar((0.5 + burst * (1.6 + i * 0.55)) * S * SC);
          wf.rotation.set(t * (i + 1), -t * 2, i);
          wf.material.color.copy(i === 0 ? cCore : cSec);
          wf.material.opacity = alpha * 0.85;
          this.activeMeshCount++;
        }
        for (let i = 0; i < 6; i++) {
          const r = this.nodes.rings[i];
          r.visible = true;
          r.position.copy(hitPos);
          r.rotation.set(i * 0.7 + t * 2, i * 0.5, t * 3);
          r.scale.setScalar((0.4 + burst * (1.5 + i * 0.32)) * S * SC);
          r.material.color.copy(i % 2 === 0 ? cMain : cCore);
          r.material.opacity = alpha * 0.88;
          this.activeMeshCount++;
        }
      }
    }

    if (showEmbers) {
      const count = clamp(Math.round(24 * p.amount * densityMult), 6, 36);
      for (let i = 0; i < count; i++) {
        const mesh = this.index === 1 ? this.nodes.dustPuffs[i] : this.nodes.shards[i];
        mesh.visible = true;
        const phi = Math.acos(1 - (2 * (i + 0.5)) / count);
        const theta = Math.PI * (1 + Math.sqrt(5)) * i + t * 1.2;
        const dist = (0.35 + burst * (2.2 + (i % 3) * 0.45)) * S * SC;
        mesh.position.set(
          hitPos.x + Math.sin(phi) * Math.cos(theta) * dist,
          Math.max(0.12, hitPos.y + Math.cos(phi) * dist * L - 0.3 * u * u),
          hitPos.z + Math.sin(phi) * Math.sin(theta) * dist
        );
        mesh.rotation.set(t * 6 + i, t * 5, i);
        mesh.scale.setScalar((this.index === 1 ? 0.28 : 0.22) * S);
        mesh.material.color.copy(this.index === 1 && i % 2 === 0 ? new THREE.Color(0x140d16) : i % 2 === 0 ? cCore : cMain);
        if (mesh.material.emissive) mesh.material.emissive.copy(cMain);
        mesh.material.opacity = alpha;
        this.activeMeshCount++;
      }
    }
  }

  // --------------------------------------------------------------------------
  // FOGO 4: AURA FLAMEJANTE & BRASAS (MANTO DE FOGO CONTÍNUO)
  // --------------------------------------------------------------------------
  renderFireAura(p, u, absTime, center, showFlames, showEmbers, densityMult) {
    const alpha = computeDurationOpacity(p, u);
    if (alpha <= 0.002) return;

    const cMain = new THREE.Color(p.color);
    const cSec = new THREE.Color(p.color2);
    const cCore = new THREE.Color(p.color3);
    const S = p.size, I = p.intensity, L = p.lift, SC = p.scatter, V = p.velocity;
    const t = absTime * V;

    this.pointLight.position.set(center.x, 1.3 * L, center.z);
    this.pointLight.color.copy(cMain);
    this.pointLight.intensity = 2.6 * I * alpha * p.glow;

    if (showFlames) {
      // Manto de Fogo 3D ao redor do corpo do lutador
      const auraCol = this.nodes.fireColumns[0];
      auraCol.visible = true;
      auraCol.position.set(center.x, 0.02, center.z);
      auraCol.scale.set(0.75 * S * SC, 0.88 * S * L, 0.75 * S * SC);
      auraCol.rotation.y = t * 3.8;
      this.syncShaderUniforms(auraCol.material, p, alpha * 0.82, absTime);
      this.activeMeshCount++;

      if (this.index === 0) {
        // OPÇÃO A (Mitológico Japonês): Halo Sagrado Xintoísta (Kaen Mandorla / Amaterasu) atrás das costas do lutador!
        const haloRing = this.nodes.rings[0];
        haloRing.visible = true;
        haloRing.position.set(center.x, 1.25 * L, center.z - 0.32);
        haloRing.rotation.set(0, 0, t * 1.8);
        haloRing.scale.setScalar(1.05 * S * SC);
        haloRing.material.color.copy(cCore);
        haloRing.material.opacity = alpha * 0.95;
        this.activeMeshCount++;

        const tongueN = clamp(Math.round(12 * p.amount * densityMult), 4, 20);
        for (let i = 0; i < tongueN; i++) {
          const cb = this.nodes.crescents[i];
          cb.visible = true;
          const a = (i / tongueN) * Math.PI * 2 + t * 2.2;
          const rad = 1.05 * S * SC;
          cb.position.set(center.x + Math.cos(a) * rad, 1.25 * L + Math.sin(a) * rad, center.z - 0.32);
          cb.rotation.set(0, 0, a + Math.PI / 2);
          cb.scale.setScalar(0.32 * S * I);
          cb.material.color.copy(i % 2 === 0 ? cMain : cCore);
          cb.material.opacity = alpha * 0.92;
          this.activeMeshCount++;
        }
      } else if (this.index === 1) {
        // OPÇÃO B (Tinta Sumi-e): Labaredas de Pincel Negro + Brasa subindo do chão + Círculo Enso nos pés
        const spN = clamp(Math.round(16 * p.amount * densityMult), 6, 24);
        for (let i = 0; i < spN; i++) {
          const sp = this.nodes.spikes[i];
          sp.visible = true;
          const phase = (i / spN + u * 1.6) % 1;
          const a = i * 1.5 + t * 3.2;
          const rad = (0.58 + 0.25 * (1 - phase)) * S * SC;
          sp.position.set(center.x + Math.cos(a) * rad, (0.15 + phase * 1.95) * L, center.z + Math.sin(a) * rad);
          sp.rotation.set(0.15, -a, 0.2);
          const sc = Math.sin(phase * Math.PI) * 0.55 * S * I;
          sp.scale.set(sc * 0.65, sc * 1.4, sc * 0.65);
          sp.userData.core.material.color.copy(i % 2 === 0 ? cMain : cCore);
          sp.userData.core.material.opacity = alpha;
          sp.userData.hull.material.opacity = alpha;
          this.activeMeshCount += 2;
        }
      } else {
        // OPÇÃO C (Fogo Mágico Arcano): Selos Rúnicos nos Pés e Peito + Chamas Espirituais (Will-o'-the-Wisp) em Órbita
        for (let i = 0; i < 5; i++) {
          const r = this.nodes.rings[i];
          r.visible = true;
          r.position.set(center.x, (0.06 + i * 0.42) * L, center.z);
          r.rotation.set(Math.PI / 2 + 0.15 * Math.sin(t * 2 + i), 0, t * (i % 2 ? 3 : -3));
          r.scale.setScalar((1.15 - i * 0.12) * S * SC);
          r.material.color.copy(i % 2 === 0 ? cCore : cSec);
          r.material.opacity = alpha * 0.88;
          this.activeMeshCount++;
        }
      }
    }

    if (showEmbers) {
      const embN = clamp(Math.round(24 * p.amount * densityMult), 6, 42);
      for (let i = 0; i < embN; i++) {
        const hn = this.nodes.helixNodes[i];
        hn.visible = true;
        const phase = (i / embN + u * 1.4) % 1;
        const a = i * 1.85 + t * 3.5;
        const rad = (0.55 + 0.35 * Math.sin(phase * Math.PI + i)) * S * SC;
        hn.position.set(center.x + Math.cos(a) * rad, (0.1 + phase * 2.25) * L, center.z + Math.sin(a) * rad);
        hn.scale.setScalar((0.11 + 0.05 * Math.sin(t * 6 + i)) * S * I);
        hn.material.color.copy(i % 3 === 0 ? cCore : i % 3 === 1 ? cMain : cSec);
        hn.material.opacity = alpha * Math.sin(phase * Math.PI);
        this.activeMeshCount++;
      }
    }
  }

  // ==========================================================================
  // ABA 2: EFEITOS 3D DO TIPO VOADOR (TORNADOS, VENDAVAIS, TUFÕES, VENTO & POEIRA)
  // ==========================================================================
}
