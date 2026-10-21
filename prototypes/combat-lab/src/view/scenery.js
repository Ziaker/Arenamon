// Cenário "Laboratório técnico" da arena (escolhido em 21/10/2026 no laboratório prototypes/hud-consumiveis): piso escuro com
// régua de anéis, anel de blocos geométricos e prismas decorativos. SÓ APRESENTAÇÃO: não altera colisão, física nem regras.
// Respeita os controles de Visualizar: raio da arena, cores (piso, grid, fundo, paredes), espessura do piso, divisões do grid e
// altura/espessura das paredes viram tons e proporções sobre a paleta do laboratório (com os valores padrão = visual aprovado).
// labTheme = 0 devolve o visual clássico.
import * as T from 'three';
import {C, defaults} from '../sim/config.js';

const DEF_COLORS = {...defaults().extras.colors};
const DEF_WALL_H = defaults().extras.visual.wallHeight, DEF_WALL_T = defaults().extras.visual.wallThickness;
/** Compensação de brilho do piso: o jogo usa luzes mais fortes que o laboratório de apresentação (luz ambiente 2,5 e direcional 2). */
export const FLOOR_EXPOSURE = 0.85;

const PALETTE = {
  floorIn: [0x18, 0x22, 0x38], floorOut: [0x0d, 0x14, 0x24], slab: [0x0d, 0x14, 0x24], background: [0x09, 0x0d, 0x19], outer: [0x0a, 0x0f, 0x1c],
  gridMinor: [130, 170, 255], gridMajor: [130, 170, 255], ring: [95, 225, 255], label: [140, 235, 255], rim: [0x1b, 0x25, 0x40],
  blocks: [[0x25, 0x32, 0x4f], [0x2a, 0x3a, 0x5c], [0x1f, 0x2a, 0x44], [0x33, 0x32, 0x4f], [0x23, 0x39, 0x4a]],
  accents: [[0x4a, 0xa3, 0xff], [0x7b, 0xe0, 0xd0], [0x9a, 0x8c, 0xff], [0x6e, 0xc1, 0xff]],
  props: [0x2c3d63, 0x3a3a60, 0x274a58, 0x2c3d63],
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
/** Razão entre o valor atual do canal de cor em Visualizar e o padrão (1 = padrão). */
const ratio = (base, ch) => {const d = DEF_COLORS[base + ch] || 1;return clamp((C.extras.colors[base + ch] ?? d) / d, 0, 4);};
const tintRgb = (rgb, base) => [clamp(rgb[0] * ratio(base, 'R'), 0, 255), clamp(rgb[1] * ratio(base, 'G'), 0, 255), clamp(rgb[2] * ratio(base, 'B'), 0, 255)];
const css = (rgb, a = 1) => `rgba(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0},${a})`;
const hex = rgb => ((rgb[0] | 0) << 16) | ((rgb[1] | 0) << 8) | (rgb[2] | 0);

/** Chave de tudo que muda a textura do piso (evita redesenhar a cada ajuste que não a afeta). */
export function floorKey(rad) {
  const S = C.display.scenery, c = C.extras.colors;
  return [rad, C.extras.visual.gridDivisions, S.labRingStep, S.labRulers, c.floorR, c.floorG, c.floorB, c.gridMajorR, c.gridMajorG, c.gridMajorB, c.gridMinorR, c.gridMinorG, c.gridMinorB].join('|');
}

/** Desenha a textura do piso (círculo inscrito em um quadrado que cobre o diâmetro). */
export function drawFloor(canvas, rad) {
  const S = canvas.width, x = canvas.getContext('2d'), ppm = S / (rad * 2), cfg = C.display.scenery;
  const fIn = tintRgb(PALETTE.floorIn, 'floor'), fOut = tintRgb(PALETTE.floorOut, 'floor');
  const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, css(fIn)); g.addColorStop(1, css(fOut));
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  const divisions = Math.max(2, C.extras.visual.gridDivisions | 0), spacing = rad * 2 / divisions, step = Math.max(.5, cfg.labRingStep || 4);
  const major = Math.max(1, Math.round(step / spacing)), minC = tintRgb(PALETTE.gridMinor, 'gridMinor'), majC = tintRgb(PALETTE.gridMajor, 'gridMajor');
  x.save(); x.beginPath(); x.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2); x.clip();
  for (let i = -Math.ceil(divisions / 2); i <= Math.ceil(divisions / 2); i++) {
    const p = S / 2 + i * spacing * ppm, isMajor = i % major === 0;
    x.strokeStyle = css(isMajor ? majC : minC, isMajor ? .30 : .11); x.lineWidth = isMajor ? Math.max(2.2, S / 900) : Math.max(1.1, S / 1800);
    x.beginPath(); x.moveTo(p, 0); x.lineTo(p, S); x.moveTo(0, p); x.lineTo(S, p); x.stroke();
  }
  const ringC = tintRgb(PALETTE.ring, 'gridMajor'), labelC = tintRgb(PALETTE.label, 'gridMajor');
  const font = clamp(Math.round(ppm * .5), 22, 46);
  x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `bold ${font}px Consolas, "Cascadia Mono", monospace`;
  for (let r = step; r <= rad + .001; r += step) {
    const last = r + step > rad + .001;
    x.strokeStyle = css(ringC, .55); x.lineWidth = Math.max(3, S / 650); x.setLineDash(last ? [] : [S / 115, S / 170]);
    x.beginPath(); x.arc(S / 2, S / 2, r * ppm - 1.5, 0, Math.PI * 2); x.stroke(); x.setLineDash([]);
    if (!cfg.labRulers) continue;
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      if (last && dy !== 0) continue;
      x.fillStyle = css(labelC, .75); x.fillText(`${Number.isInteger(r) ? r : r.toFixed(1)} m`, S / 2 + dx * (r * ppm - font * 1.15), S / 2 + dy * (r * ppm - font * 1.15));
    }
  }
  x.strokeStyle = 'rgba(255,255,255,.4)'; x.lineWidth = 3;
  x.beginPath(); x.moveTo(S / 2 - 22, S / 2); x.lineTo(S / 2 + 22, S / 2); x.moveTo(S / 2, S / 2 - 22); x.lineTo(S / 2, S / 2 + 22); x.stroke();
  x.restore();
}

/** Parâmetros determinísticos dos blocos do anel (altura/largura/cores por índice). Puro e testável. */
export function ringBlocks(rad, scaleH = 1, scaleD = 1) {
  const radius = rad + 1.5, n = Math.max(18, Math.round(Math.PI * 2 * radius / 3.2)), out = [];
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2, h = (1.1 + ((i * 37) % 11) / 11 * 2.6) * scaleH, w = 2.1 + ((i * 17) % 5) * .22;
    out.push({angle: a, x: Math.cos(a) * radius, z: Math.sin(a) * radius, w, h, d: 1.5 * scaleD, tone: i % PALETTE.blocks.length, accent: i % PALETTE.accents.length});
  }
  return out;
}

export class ArenaScenery {
  constructor(scene, view) {
    this.scene = scene; this.view = view;
    this.group = new T.Group(); this.group.name = 'lab-scenery'; this.group.visible = false; scene.add(this.group);
    this.key = ''; this.blockKey = '';
    this.floorTex = null;
    this.floor = new T.Mesh(new T.CircleGeometry(1, 128), new T.MeshStandardMaterial({roughness: .82, metalness: .08, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2}));
    this.floor.rotation.x = -Math.PI / 2; this.floor.position.y = .004; this.floor.name = 'lab-floor'; this.group.add(this.floor);
    this.outer = new T.Mesh(new T.CircleGeometry(400, 48), new T.MeshBasicMaterial());
    this.outer.rotation.x = -Math.PI / 2; this.outer.name = 'lab-outer'; this.group.add(this.outer);
    this.rim = new T.Mesh(new T.TorusGeometry(1, .09, 8, 160), new T.MeshStandardMaterial({color: hex(PALETTE.rim), emissive: 0x2aa8c8, emissiveIntensity: 1.1}));
    this.rim.rotation.x = Math.PI / 2; this.rim.name = 'lab-rim'; this.group.add(this.rim);
    this.blocks = null; this.strips = null; this.props = new T.Group(); this.props.name = 'lab-props'; this.group.add(this.props);
  }

  /** Reaplica o cenário. Retorna true quando o visual do laboratório está ativo (View esconde o piso/grid/anel clássicos). */
  apply(isCircle, rad) {
    const S = C.display.scenery, on = S.labTheme > 0 && isCircle;
    this.group.visible = on;
    if (!on) return false;
    const V = C.extras.visual;
    const key = floorKey(rad);
    if (key !== this.key) {
      this.key = key;
      const size = rad > 24 ? 3072 : 2048;
      if (!this.floorTex || this.floorTex.image.width !== size) {
        this.floorTex?.dispose();
        const cv = document.createElement('canvas'); cv.width = cv.height = size;
        this.floorTex = new T.CanvasTexture(cv); this.floorTex.colorSpace = T.SRGBColorSpace; this.floorTex.anisotropy = 8;
        this.floor.material.map = this.floorTex; this.floor.material.needsUpdate = true;
      }
      drawFloor(this.floorTex.image, rad); this.floorTex.needsUpdate = true;
    }
    this.floor.scale.set(rad, rad, 1);
    this.floor.material.color.setScalar(FLOOR_EXPOSURE);
    this.outer.position.y = -V.floorThickness - .02; this.outer.material.color.setHex(hex(tintRgb(PALETTE.outer, 'background')));
    this.rim.visible = !!S.labRimGlow; this.rim.position.y = .09;
    if (this.rimRad !== rad) {
      this.rimRad = rad; this.rim.geometry.dispose();
      this.rim.geometry = new T.TorusGeometry(rad, .09 * Math.max(1, Math.sqrt(rad / 16)), 8, 192);
    }
    this.updateBlocks(rad, S);
    this.props.visible = !!S.labProps;
    if (this.props.children.length === 0) this.buildProps();
    this.placeProps(rad);
    return true;
  }

  /** Cor de fundo da cena no tema (tinge pelo controle Fundo de Visualizar). */
  backgroundHex() {return hex(tintRgb(PALETTE.background, 'background'));}
  slabHex() {return hex(tintRgb(PALETTE.slab, 'floor'));}

  updateBlocks(rad, S) {
    const on = !!S.labBlocks;
    const h = clamp(C.extras.visual.wallHeight / DEF_WALL_H, .2, 6) * clamp(S.labBlockScale ?? 1, .2, 4), d = clamp(C.extras.visual.wallThickness / DEF_WALL_T, .3, 6);
    const key = [rad, h.toFixed(3), d.toFixed(3), C.extras.colors.wallR, C.extras.colors.wallG, C.extras.colors.wallB, C.extras.colors.gridMajorR, C.extras.colors.gridMajorG, C.extras.colors.gridMajorB].join('|');
    if (this.blocks) this.blocks.visible = this.strips.visible = on;
    if (!on || key === this.blockKey) return;
    this.blockKey = key;
    const list = ringBlocks(rad, h, d), n = list.length;
    if (!this.blocks || this.blocks.count !== n) {
      for (const m of [this.blocks, this.strips]) if (m) {this.group.remove(m);m.dispose?.();m.geometry.dispose();m.material.dispose();}
      this.blocks = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), new T.MeshStandardMaterial({roughness: .7, metalness: .2}), n);
      this.strips = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), new T.MeshBasicMaterial(), n);
      this.group.add(this.blocks, this.strips);
    }
    const m = new T.Matrix4(), q = new T.Quaternion(), s = new T.Vector3(), p = new T.Vector3(), up = new T.Vector3(0, 1, 0), col = new T.Color();
    list.forEach((b, i) => {
      q.setFromAxisAngle(up, -b.angle + Math.PI / 2);
      p.set(b.x, b.h / 2, b.z); s.set(b.w, b.h, b.d);
      this.blocks.setMatrixAt(i, m.compose(p, q, s));
      col.setHex(hex(tintRgb(PALETTE.blocks[b.tone], 'wall'))); this.blocks.setColorAt(i, col);
      // faixa luminosa na face voltada ao centro, perto do topo do bloco
      const toCenter = new T.Vector3(-b.x, 0, -b.z).normalize().multiplyScalar(b.d / 2 + .02);
      p.set(b.x + toCenter.x, b.h - .22, b.z + toCenter.z); s.set(b.w * .8, .07, .05);
      this.strips.setMatrixAt(i, m.compose(p, q, s));
      col.setHex(hex(tintRgb(PALETTE.accents[b.accent], 'gridMajor'))); this.strips.setColorAt(i, col);
    });
    this.blocks.instanceMatrix.needsUpdate = this.strips.instanceMatrix.needsUpdate = true;
    if (this.blocks.instanceColor) this.blocks.instanceColor.needsUpdate = true;
    if (this.strips.instanceColor) this.strips.instanceColor.needsUpdate = true;
  }

  /** Prismas e pilares decorativos, FORA do piso (não parecem obstáculos jogáveis). */
  buildProps() {
    const defs = [
      {g: new T.CylinderGeometry(.45, .55, 1.4, 6), a: .35, h: .7, c: PALETTE.props[0]}, {g: new T.BoxGeometry(1.1, 2.2, 1.1), a: 1.7, h: 1.1, c: PALETTE.props[1]},
      {g: new T.OctahedronGeometry(.8, 0), a: 3.35, h: 1.5, c: PALETTE.props[2]}, {g: new T.CylinderGeometry(.35, .35, 2.6, 16), a: 4.9, h: 1.3, c: PALETTE.props[3]},
    ];
    this.propDefs = defs.map(d => ({a: d.a}));
    for (const d of defs) {
      const m = new T.Mesh(d.g, new T.MeshStandardMaterial({color: d.c, roughness: .55, metalness: .3, flatShading: true}));
      m.userData.baseY = d.h; this.props.add(m);
    }
  }
  placeProps(rad) {
    this.props.children.forEach((m, i) => {const a = this.propDefs[i].a, r = rad + 6.5;m.position.set(Math.cos(a) * r, m.userData.baseY, Math.sin(a) * r);});
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse(o => {o.geometry?.dispose();if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());});
    this.floorTex?.dispose();
  }
}
