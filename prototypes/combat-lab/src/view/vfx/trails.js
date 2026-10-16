// Trails e afterimages do VFX — três tipos independentes:
//  1. trail de trajetória física (segue a posição física do lutador)
//  2. trail preso a anchor/socket visual (segue um ponto do personagem)
//  3. afterimage do personagem (silhueta translúcida em posições anteriores)
// Nenhum influencia no movimento; nenhuma leitura direta de ossos obrigatória;
// fallback para centro/direção física quando um socket não existir.

import * as T from 'three';
import {Pool} from './pools.js';

const MODE = {billboard: 0, axis: 2};

// Um segmento de trail (quad entre dois pontos consecutivos).
class TrailSegment {
  constructor() {
    this.x1 = 0; this.y1 = 0; this.z1 = 0;
    this.x2 = 0; this.y2 = 0; this.z2 = 0;
    this.w1 = 0; this.w2 = 0;
    this.color = 0xffffff;
    this.alpha = 1;
    this.age = 0; this.life = 0;
    this.index = 0; // ordem no trail
    this.active = false;
  }
  reset() {
    this.x1 = 0; this.y1 = 0; this.z1 = 0;
    this.x2 = 0; this.y2 = 0; this.z2 = 0;
    this.w1 = 0; this.w2 = 0;
    this.color = 0xffffff; this.alpha = 1;
    this.age = 0; this.life = 0; this.index = 0; this.active = false;
  }
}

// Pool de segmentos de trail.
export class TrailSegmentPool extends Pool {
  constructor({capacity = 512} = {}) {
    super({
      capacity,
      name: 'trail-segments',
      create: () => new TrailSegment(),
      reset: (s) => s.reset(),
    });
  }
}

// Curva de largura/opacidade por progresso (0..1).
export const widthCurve = (k) => 1 - k; // afinar até o fim
export const alphaCurve = (k) => Math.pow(1 - k, 1.6);

// Gerencia um trail individual (lista de segmentos com fade previsível).
export class Trail {
  constructor({maxSegments = 24, life = 0.5, color = 0xffffff,
    widthAt = widthCurve, alphaAt = alphaCurve, pool} = {}) {
    this.maxSegments = maxSegments;
    this.life = life;
    this.color = color;
    this.widthAt = widthAt;
    this.alphaAt = alphaAt;
    this.pool = pool;
    this.segments = []; // segmento mais recente primeiro
    this.points = []; // histórico de pontos {x,y,z,t}
    this.active = false;
  }
  // Registra um ponto no trail (chamado a cada quadro enquanto ativo).
  addPoint(x, y, z, t) {
    this.points.push({x, y, z, t});
    if (this.points.length > this.maxSegments + 1) this.points.shift();
    this.active = true;
  }
  // Atualiza segmentos a partir do histórico de pontos. Retorna descritores para o pool.
  update(dt, now) {
    if (!this.active) return [];
    // Descartar pontos antigos além da vida.
    const cutoff = now - this.life;
    while (this.points.length > 0 && this.points[0].t < cutoff) this.points.shift();
    if (this.points.length < 2) { this.active = false; return []; }
    // Construir segmentos entre pontos consecutivos.
    const descs = [];
    for (let i = 1; i < this.points.length; i++) {
      const a = this.points[i - 1]; const b = this.points[i];
      const k = (now - b.t) / this.life; // progresso do ponto mais novo (0 = novo, 1 = velho)
      const w = this.widthAt(k);
      const alpha = this.alphaAt(k) * ((b.t - a.t) / Math.max(1e-6, this.life));
      descs.push({
        x1: a.x, y1: a.y, z1: a.z,
        x2: b.x, y2: b.y, z2: b.z,
        w1: w * 0.5, w2: w * 0.5,
        color: this.color, alpha: Math.max(0, Math.min(1, alpha)),
        life: this.life, age: now - b.t,
        index: i,
        mode: MODE.axis,
        cell: 1, // streak
        additive: true,
      });
    }
    return descs;
  }
  reset() {
    this.points = []; this.segments = []; this.active = false;
  }
}

// Três tipos de trail, instanciados via factory.
export class TrailManager {
  constructor({pool} = {}) {
    this.pool = pool || new TrailSegmentPool();
    this.trails = new Map(); // key → Trail
  }
  // Criar ou obter um trail por chave.
  get(key, opts = {}) {
    let tr = this.trails.get(key);
    if (!tr) {
      tr = new Trail({...opts, pool: this.pool});
      this.trails.set(key, tr);
    }
    return tr;
  }
  // Remover um trail.
  remove(key) { this.trails.delete(key); }
  // Atualizar todos os trails; devolve descritores de partículas (segmentos).
  update(dt, now) {
    const descs = [];
    for (const tr of this.trails.values()) {
      descs.push(...tr.update(dt, now));
      if (!tr.active && tr.points.length === 0) { /* mantém para reuso rápido */ }
    }
    return descs;
  }
  // Limpar todos (reset de luta, menu).
  clear() { for (const tr of this.trails.values()) tr.reset(); this.trails.clear(); }
}

// ---------- Factories para os três tipos ----------

// 1. Trail de trajetória física: segue a posição física do lutador.
export function physicalTrail(f, {alt = 0, maxSegments = 24, life = 0.4, color = 0xd8f4ff, width = 0.06} = {}) {
  return {
    key: `phys:${f.id}`,
    maxSegments, life, color,
    widthAt: (k) => width * (1 - k * 0.7),
    alphaAt: (k) => Math.pow(1 - k, 1.6),
    getPoint: () => ({x: f.position.x, y: (f.flight ? f.flight.y : 0) + alt, z: f.position.z, t: performance.now() / 1000}),
  };
}

// 2. Trail preso a anchor/socket: segue um ponto do personagem (pé, mão) ou fallback centro.
export function anchorTrail(target, {socket = null, maxSegments = 20, life = 0.3, color = 0x9dffd8, width = 0.05} = {}) {
  return {
    key: `anchor:${target.id != null ? target.id : 'anon'}`,
    maxSegments, life, color,
    widthAt: (k) => width * (1 - k),
    alphaAt: (k) => Math.pow(1 - k, 1.8),
    getPoint: () => {
      // Tentar socket (pé/mão) fornecido pelo personagem. Fallback: centro do alvo.
      if (socket && socket.getWorldPosition) {
        const v = new (require('three').Vector3)();
        socket.getWorldPosition(v);
        return {x: v.x, y: v.y, z: v.z, t: performance.now() / 1000};
      }
      const p = target.position || {x: 0, y: 0, z: 0};
      return {x: p.x, y: p.y + 0.6, z: p.z, t: performance.now() / 1000};
    },
  };
}

// 3. Afterimage do personagem: silhueta translúcida em posições anteriores.
// Implementado como trail de segmentos que ecoam a pose (sem leitura de ossos obrigatória).
export function afterimage(target, {maxSegments = 6, life = 0.5, color = 0xffffff, width = 1} = {}) {
  return {
    key: `afterimg:${target.id != null ? target.id : 'anon'}`,
    maxSegments, life, color,
    widthAt: (k) => width * (1 - k * 0.9),
    alphaAt: (k) => Math.pow(1 - k, 2.2),
    getPoint: () => {
      const p = target.position || {x: 0, y: 0, z: 0};
      return {x: p.x, y: p.y + 0.65, z: p.z, t: performance.now() / 1000};
    },
  };
}
