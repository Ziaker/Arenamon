// @ts-check
// Rótulos flutuantes "Ability: NOME" (retângulo branco estilo anúncio de habilidade): aparecem acima da
// cabeça do lutador quando uma passiva ativa (evento passiveActivated), sobem levemente e desvanecem.
// Sprite com textura de canvas (caixa branca arredondada, borda escura fina, texto escuro). Só aparência:
// nada aqui altera regras, tempos da simulação ou cooldowns. Respeita o mestre de acessibilidade
// (reduceMotion encurta a subida; noFlash reduz o brilho da borda) e o toggle C.vfx.passive.enabled.
import * as T from 'three';
import {C} from '../sim/config.js';
import {PASSIVE_BY_ID} from '../sim/passives.js';

const LIFE = 2.2, RISE = .45, FADE_IN = .12, FADE_OUT = .5, HEIGHT = .5, MAX_PER_FIGHTER = 3;

/** Cache de texturas por nome de passiva (o rótulo é sempre "Ability: NOME"). */
const texCache = new Map();

function roundRectPath(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** Desenha a caixa branca com o texto e devolve {tex, aspect}. */
function makeTexture(nome) {
  const label = `Ability: ${nome}`;
  const padX = 28, padY = 15, fs = 44;
  const cv = document.createElement('canvas');
  let g = cv.getContext('2d');
  g.font = `bold ${fs}px system-ui, 'Segoe UI', sans-serif`;
  const tw = g.measureText(label).width;
  const w = Math.ceil(tw) + padX * 2, h = fs + padY * 2;
  cv.width = w;cv.height = h;
  g = cv.getContext('2d');
  g.font = `bold ${fs}px system-ui, 'Segoe UI', sans-serif`;
  g.textBaseline = 'middle';
  // Caixa branca arredondada com borda escura fina (contraste sobre qualquer fundo).
  g.fillStyle = '#ffffff';
  g.strokeStyle = 'rgba(12,14,18,.9)';
  g.lineWidth = 5;
  roundRectPath(g, 3, 3, w - 6, h - 6, 18);g.fill();g.stroke();
  g.fillStyle = '#15171c';
  g.fillText(label, padX, h / 2 + 2);
  const tex = new T.CanvasTexture(cv);
  tex.colorSpace = T.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = T.LinearMipmapLinearFilter;
  return {tex, aspect: w / h};
}

export class AbilityLabels {
  /** @param {import('three').Scene} scene */
  constructor(scene) {
    this.scene = scene;
    /** @type {Array<{sprite: import('three').Sprite, fighter: any, age: number, baseY: number, mat: import('three').SpriteMaterial}>} */
    this.labels = [];
  }
  /**
   * Dispara rótulos para ativações de passivas do passo.
   * @param {Array<any>} events eventos do passo (game.lastStepEvents)
   * @param {Array<any>} fighters lutadores (posição atual)
   */
  onEvents(events, fighters) {
    if (!C.vfx?.passive?.enabled || !events?.length) return;
    for (const e of events) {
      if (e.result !== 'passiveActivated' || e.attacker == null) continue;
      const f = fighters[e.attacker];
      if (!f) continue;
      this.spawn(f, PASSIVE_BY_ID[e.passive]?.nome ?? e.passive);
    }
  }
  /** Cria o rótulo acima da cabeça do lutador (no máx. MAX_POR_LUTADOR por lutador). */
  spawn(f, nome) {
    let entry = texCache.get(nome);
    if (!entry) {entry = makeTexture(nome);texCache.set(nome, entry);}
    const mat = new T.SpriteMaterial({map: entry.tex, transparent: true, depthTest: false, opacity: 0});
    const sprite = new T.Sprite(mat);
    sprite.name = 'abilityLabel';
    sprite.scale.set(HEIGHT * entry.aspect, HEIGHT, 1);
    sprite.renderOrder = 999;
    const baseY = (f.groundY ?? 0) + (C.extras?.visual?.bodyHeight ?? 1.2) + .45;
    sprite.position.set(f.position.x, baseY, f.position.z);
    this.scene.add(sprite);
    this.labels.push({sprite, fighter: f, age: 0, baseY, mat});
    // Estourou o teto por lutador: remove o mais antigo dele.
    const mine = this.labels.filter(l => l.fighter === f);
    if (mine.length > MAX_PER_FIGHTER) this.remove(mine[0]);
  }
  remove(l) {
    this.scene.remove(l.sprite);
    l.mat.dispose();
    this.labels.splice(this.labels.indexOf(l), 1);
  }
  /** Avança os rótulos vivos (chamar a cada quadro renderizado; dt = 0 congela). */
  update(dt) {
    const reduce = !!C.vfx?.master?.reduceMotion;
    for (let i = this.labels.length - 1; i >= 0; i--) {
      const l = this.labels[i];
      l.age += dt;
      if (l.age >= LIFE) {this.remove(l);continue;}
      const k = l.age / LIFE;
      l.sprite.position.set(l.fighter.position.x, l.baseY + RISE * (reduce ? .4 : 1) * (k * k * (3 - 2 * k)), l.fighter.position.z);
      l.mat.opacity = l.age < FADE_IN ? l.age / FADE_IN : l.age > LIFE - FADE_OUT ? Math.max(0, (LIFE - l.age) / FADE_OUT) : 1;
    }
  }
  clear() {for (let i = this.labels.length - 1; i >= 0; i--) this.remove(this.labels[i]);}
}
