// @ts-check
// Visuais dos Moves elementais no JOGO com o renderizador do Ateliê Elemental (three.quarks):
// Água (Water Pulse), Fogo (Fire Spin) e Vento (Air Slash) usam os parâmetros aprovados em param.txt,
// com as opções A/B/C escolhidas em Visualizar › Elementais. O Seed Bomb NÃO passa por aqui: continua
// exatamente com o desenho provisório de view/elemental-fx.js.
//
// Só aparência: a posição, o raio, a vida e o contato vêm da simulação; nada aqui decide regra, dano,
// colisão ou cooldown. Cada efeito é um ElementalPreview em modo "seguir entidade" (root na posição da
// entidade, núcleo em 0,0,0), com um único BatchedRenderer compartilhado por todos.
import * as THREE from 'three';
import * as Q from 'three.quarks';
import {C} from '../../sim/config.js';
import {ElementalPreview} from './elemental-preview.js';
import {ELEMENTAL_GAME_PARAMS} from './elemental-game-params.js';
import {elementalVisualKey} from '../../sim/elemental-visual-config.js';

const MOVES = {waterorb: 'waterPulse', airslash: 'airSlash', firespin: 'fireSpin', seed: 'seedBomb'};
const PL_HEX = [0xffffff, 0x59d6e6, 0xffcf6a, 0xff6adf];
const VARIANT_KEY = {waterPulse: 'waterVariant', airSlash: 'airVariant', fireSpin: 'fireVariant'};
/** Tempo (s) que o efeito continua depois que a entidade some: cobre a explosão/o corte do contato. */
const TAIL = {waterPulse: 2.4, airSlash: 2.0, fireSpin: 1.2, seedBomb: 2.6};

const elementalCfg = () => C.vfx?.elemental ?? {};

/** Camada de desenho dos 3 Moves elementais; o WorldView cria uma e chama `sync()` a cada quadro. */
export class ElementalGameFx {
  /** @param {any} parent grupo do mundo (mesma origem da cena) */
  constructor(parent) {
    this.parent = parent;
    /** @type {any} */
    this.batch = new Q.BatchedRenderer();
    parent.add(this.batch);
    /** @type {Map<number, any>} */
    this.items = new Map();
  }
  get enabled() {return elementalCfg().enabled !== 0;}
  /** A entidade é desenhada por esta camada? (Seed Bomb e Seed Blast ficam de fora.) */
  handles(e) {
    if (!this.enabled || !e) return false;
    if (e.kind === 'projectile') return e.visual === 'waterorb' || e.visual === 'airslash' || e.visual === 'seed';
    if (e.kind === 'area' && e.visual === 'seedblast') return true;   // sem preview proprio: a explosao vem do contato() da semente
    if (e.kind === 'area') return e.visual === 'firespin';
    return false;
  }
  /** Variante A/B/C escolhida no painel (0, 1 ou 2). */
  variantOf(move) {if (move === 'seedBomb') return 0; return Math.max(0, Math.min(2, Math.round(elementalCfg()[VARIANT_KEY[move]] ?? 0)));}
  paramsOf(move, variant = this.variantOf(move)) {return elementalCfg().visual?.[elementalVisualKey(move, variant)] ?? ELEMENTAL_GAME_PARAMS[move]?.[variant];}
  disposeItem(it) {it.preview.root.getObjectByName('plBorder')?.material?.dispose();it.preview.dispose();}
  /** Escala do efeito para casar com o volume que a simulação já usa (raio/altura da entidade). */
  scaleOf(move, e, base, pl) {
    if (move === 'waterPulse') {
      const eff = Math.max(.05, base.size * (1 + (Math.max(1, Math.min(3, pl)) - 1) * .32));
      return Math.max(.05, (e.radius ?? .38) * (e.visualScale ?? 1) / eff);
    }
    if (move === 'airSlash') return Math.max(.05, 1.45 * (e.radius ?? .6) / Math.max(.05, base.size));
    if (move === 'seedBomb') return Math.max(.05, (e.radius ?? .24) / Math.max(.05, base.size ?? 1.2));
    return Math.max(.05, (e.radius ?? 1.6) / Math.max(.05, base.opening + base.size * .8));
  }
  applyScale(preview, move, e, base, pl) {
    const scale = this.scaleOf(move, e, base, pl);
    if (move === 'airSlash') {
      const c = e.captured ?? {};
      preview.root.scale.set(scale * (c.w ?? 1.2) / 1.2, scale * (c.h ?? .7) / .7, scale * (c.t ?? .22) / .22);
    } else preview.root.scale.setScalar(scale);
  }
  /** Gira o eixo +X do ateliê para a direção real do projétil (nariz, jato de disparo e corte). */
  headingOf(e) {
    const dx = e?.dir?.x ?? 0, dz = e?.dir?.z ?? 0;
    if (!dx && !dz) return 0;
    return Math.atan2(-dz, dx);
  }
  /** Cria o efeito de uma entidade (uma vez, no primeiro quadro em que ela aparece). */
  spawn(e, acc) {
    if (e.visual === 'seedblast') return null;   // sem preview: a explosao visual vem do contato() da semente
    const move = MOVES[e.visual];
    const base = this.paramsOf(move);
    if (!base) return null;
    const pl = e.pl ?? 1, variant = this.variantOf(move);
    /** @type {any} */
    const params = {...base, variant, shotFollowTime: elementalCfg().shotFollowTime ?? .3};
    if (move === 'seedBomb') params.shotEffect = ['none','ring','cone'][elementalCfg().seedShotEffect ?? 0] ?? 'none';
    const settingsSignature = JSON.stringify(params);
    // No jogo a zona do Fire Spin vive o tempo da simulação (2,4 s), não os 20,8 s do ateliê:
    // a subida e o apagar aprovados (fireRise/fireFade) continuam valendo dentro dessa vida.
    if (move === 'fireSpin') params.duration = Math.max(.3, e.life ?? 2.4);
    const preview = new ElementalPreview(this.parent, {batch: this.batch, parent: this.parent});
    preview.root.position.set(e.pos.x, e.y ?? 0, e.pos.z);
    preview.root.rotation.y = this.headingOf(e);
    this.applyScale(preview, move, e, base, pl);
    preview.play(move, params, pl, {noFlash: !!acc?.noFlash, reduced: !!acc?.reduceMotion, follow: true});
    // O ateliê calcula o "smear" pela velocidade do trajeto; no jogo a velocidade vem do parâmetro aprovado.
    preview.velocity = preview.p.speed;
    return {id: e.id, entity: e, move, variant, settings: settingsSignature, preview, dying: false, age: 0};
  }
  /**
   * Cria/atualiza os efeitos das entidades vivas e mantém os que estão terminando (contato).
   * @param {any[]} entities
   * @param {number} dt
   * @param {any} acc {noFlash, reduceMotion}
   */
  sync(entities, dt, acc) {
    if (!this.enabled) {this.clear();return;}
    const seen = new Set();
    for (const e of entities ?? []) {
      if (!this.handles(e)) continue;
      seen.add(e.id);
      let it = this.items.get(e.id);
      // O mundo reinicia a numeração das entidades: o mesmo id pode ser outra entidade.
      if (it && (it.entity !== e || it.variant !== this.variantOf(it.move) || it.settings !== JSON.stringify({...this.paramsOf(it.move), variant: it.variant, shotFollowTime: elementalCfg().shotFollowTime ?? .3, ...(it.move === 'seedBomb' ? {shotEffect: ['none','ring','cone'][elementalCfg().seedShotEffect ?? 0] ?? 'none'} : {})}))) {this.disposeItem(it);this.items.delete(e.id);it = null;}
      if (!it) {it = this.spawn(e, acc);if (!it) continue;this.items.set(e.id, it);}
      it.preview.root.position.set(e.pos.x, e.y ?? 0, e.pos.z);
      it.preview.root.rotation.y = this.headingOf(e);
      // Borda com a cor do PL (toggle visual): anel ao redor do projétil.
      const borderOn = !!C.vfx?.projectilePlBorder;
      let border = it.preview.root.getObjectByName('plBorder');
      if (borderOn && !border && it.move !== 'fireSpin') {
        const plIdx = Math.max(0, Math.min(3, e.pl ?? 1));
        const ring = new THREE.Mesh(new THREE.TorusGeometry(1.1, .06, 8, 32), new THREE.MeshBasicMaterial({color: PL_HEX[plIdx], transparent: true, opacity: .9, depthWrite: false}));
        ring.rotation.x = Math.PI / 2; ring.name = 'plBorder';
        it.preview.root.add(ring);
      } else if (!borderOn && border) {
        border.removeFromParent(); border.geometry?.dispose(); border.material?.dispose();
      } else if (borderOn && border) {
        const plIdx = Math.max(0, Math.min(3, e.pl ?? 1));
        if (border.material?.color) border.material.color.setHex(PL_HEX[plIdx]);
      }
      it.preview.noFlash = !!acc?.noFlash;
      it.preview.reduced = !!acc?.reduceMotion;
      it.preview.update(dt);
    }
    for (const [id, it] of this.items) {
      if (seen.has(id)) continue;
      if (!it.dying) {
        // A entidade saiu do mundo: no projétil isso é o contato (explosão/corte) no último ponto.
        it.dying = true;it.age = 0;
        if (it.move !== 'fireSpin') it.preview.contact();
      } else {
        it.age += dt;
        it.preview.update(dt);
      }
      if (it.age >= TAIL[it.move]) {this.disposeItem(it);this.items.delete(id);}
    }
    this.batch.update(dt);
  }
  /** Posição do efeito (para os anéis de evento do WorldView). */
  positionOf(id) {return this.items.get(id)?.preview.root.position ?? null;}
  clear() {for (const it of this.items.values()) this.disposeItem(it);this.items.clear();}
  /** Diagnóstico para os testes de navegador. */
  diagnostics() {
    const items = [...this.items.values()].map(it => ({
      id: it.id, move: it.move, variant: it.variant, dying: it.dying, age: +it.age.toFixed(3),
      time: +it.preview.time.toFixed(3), active: it.preview.active,
      systems: it.preview.systems.length,
      particles: it.preview.systems.reduce((n, s) => n + s.particleNum, 0),
      x: +it.preview.root.position.x.toFixed(3), y: +it.preview.root.position.y.toFixed(3), z: +it.preview.root.position.z.toFixed(3),
      scale: +it.preview.root.scale.x.toFixed(3), heading: +it.preview.root.rotation.y.toFixed(3),
      settings: {variant: it.preview.p?.variant, duration: it.preview.p?.duration, size: it.preview.p?.size},
    }));
    return {enabled: this.enabled, count: items.length, items};
  }
}
