// @ts-check
// Game feel 8 e 9 — camadas de pose SÓ VISUAIS aplicadas depois da animação base: apoio dos pés (IK de dois ossos) e rastreamento aditivo
// do alvo (cabeça + tronco). Nada aqui toca a simulação: posição, colisores, mira, alvo e hitboxes continuam exatamente os do combate.
// Todas as rotações são calculadas em ESPAÇO MUNDIAL e convertidas para o espaço local do osso, então não dependem da orientação local dos
// eixos do arquivo exportado; o que a camada exige é só a cadeia coxa → canela → pé (e cabeça/pescoço/tronco) e uma verificação de sanidade.
// Osso ausente, ambíguo ou cadeia inválida desliga APENAS aquela perna/camada e gera um diagnóstico legível (diagnostics()).

/** Normaliza o nome do osso para comparação. */
const norm = (/** @type {string} */ n) => String(n).toLowerCase().replace(/^.*[:|]/, '').replace(/^mixamorig\d*/, '');
/** Lado do osso: 'l' | 'r' | null. Aceita Left/Right, .L/_L e prefixos l_/r_. */
export function sideOf(/** @type {string} */ name) {
  const n = norm(name);
  if (/left/.test(n)) return 'l';
  if (/right/.test(n)) return 'r';
  if (/(^|[._\-])l$|^l[._\-]|[._\-]l[._\-]/.test(n)) return 'l';
  if (/(^|[._\-])r$|^r[._\-]|[._\-]r[._\-]/.test(n)) return 'r';
  return null;
}
/** Papel do osso na perna: 'up' (coxa), 'low' (canela), 'foot' (pé/tornozelo) ou null (inclui dedos). */
export function legPartOf(/** @type {string} */ name) {
  const n = norm(name).replace(/[^a-z0-9]/g, '');
  if (/toe|ball|finger|hand|arm|twist|roll|helper|ik|pole/.test(n)) return null;
  if (/foot|ankle/.test(n)) return 'foot';
  if (/upleg|upperleg|thigh|legupper/.test(n)) return 'up';
  if (/calf|shin|lowerleg|leglower|knee/.test(n) || /(^|[^a-z])leg$/.test(norm(name)) || /^(left|right)?leg$/.test(n)) return 'low';
  return null;
}
/**
 * Detecta a perna (coxa/canela/pé por lado), o tronco, o pescoço e a cabeça a partir dos nomes. Pura (testável).
 * @param {string[]} names
 * @returns {{legs: {l: any, r: any}, chest: string|null, neck: string|null, head: string|null, issues: string[]}}
 */
export function detectRig(names) {
  const issues = [], out = {legs: {l: {up: null, low: null, foot: null}, r: {up: null, low: null, foot: null}}, chest: null, neck: null, head: null, issues};
  /** @type {Record<string, Set<string>>} */ const cand = {};
  for (const name of names) {
    const side = sideOf(name), part = legPartOf(name);
    if (!side || !part) continue;
    (cand[side + part] ??= new Set()).add(name);
  }
  for (const side of /** @type {const} */ (['l', 'r'])) for (const part of /** @type {const} */ (['up', 'low', 'foot'])) {
    const set = cand[side + part];
    if (!set) {issues.push(`perna ${side === 'l' ? 'esquerda' : 'direita'}: osso «${{up: 'coxa', low: 'canela', foot: 'pé'}[part]}» ausente`);continue;}
    if (set.size > 1) {issues.push(`perna ${side === 'l' ? 'esquerda' : 'direita'}: vários candidatos a «${{up: 'coxa', low: 'canela', foot: 'pé'}[part]}» (${[...set].join(', ')}) — ambíguo`);continue;}
    out.legs[side][part] = [...set][0];
  }
  const pick = (/** @type {RegExp} */ re, /** @type {RegExp} */ not) => {const m = names.filter(n => re.test(norm(n).replace(/[^a-z0-9]/g, '')) && !(not && not.test(norm(n))));return m.length === 1 ? m[0] : m.length > 1 ? m.sort((a, b) => a.length - b.length)[0] : null;};
  out.head = pick(/^head$|head$/, /top|end|tip|nub|eye|jaw|ear|brow|hair/);
  out.neck = pick(/neck$/, /twist|end|tip/);
  for (const re of [/upperchest$/, /chest$/, /spine2$|spine02$/, /spine1$|spine01$/, /spine$/]) {out.chest = pick(re, /twist|end|tip/);if (out.chest) break;}
  if (!out.head) issues.push('olhar: osso da cabeça ausente');
  if (!out.chest && !out.neck) issues.push('olhar: tronco/pescoço ausentes (só a cabeça poderá girar)');
  return out;
}

export const clamp = (/** @type {number} */ v, /** @type {number} */ lo, /** @type {number} */ hi) => Math.max(lo, Math.min(hi, v));
export const wrapPi = (/** @type {number} */ a) => {a = (a + Math.PI) % (2 * Math.PI);if (a < 0) a += 2 * Math.PI;return a - Math.PI;};
/** Fator de suavização exponencial para o passo dt e a constante de tempo tau (0 = imediato; dt 0 = sem mudança). */
export const smoothAlpha = (/** @type {number} */ dt, /** @type {number} */ tau) => tau <= 1e-6 ? 1 : 1 - Math.exp(-Math.max(0, dt) / tau);
const smoothstep = (/** @type {number} */ a, /** @type {number} */ b, /** @type {number} */ x) => {const t = clamp((x - a) / (b - a), 0, 1);return t * t * (3 - 2 * t);};
/** Peso do apoio: pé rente ao chão = 1; erguido além da folga = 0 (a perna em passo livre segue a animação). */
export const footWeight = (/** @type {number} */ heightAboveSupport) => 1 - smoothstep(.04, .22, heightAboveSupport);
/**
 * Divide o erro angular entre cabeça e tronco respeitando os limites (graus → rad). Pura (testável).
 * A cabeça nunca passa de headYaw/headPitch; o tronco leva a fração `torsoPct` (0–1) do giro horizontal.
 */
export function splitTracking({yawErr, pitchErr, headYaw, headPitch, torsoPct}) {
  const d = Math.PI / 180, p = clamp(torsoPct, 0, .7), maxTotal = Math.min(100 * d, headYaw * d / Math.max(.3, 1 - p));
  const yaw = clamp(yawErr, -maxTotal, maxTotal), pitch = clamp(pitchErr, -headPitch * d, headPitch * d);
  return {torsoYaw: yaw * p, headYaw: yaw * (1 - p), headPitch: pitch};
}
/** Estados em que o rastreamento é desligado/reduzido (reação, derrota, parede, borda, ar). */
export const TRACK_BLOCKED = new Set(['hitstun', 'stagger', 'pushed', 'guardStun', 'defeated', 'airborne', 'landing', 'recover', 'ledgeHang', 'ledgeClimb']);

export class RigLayers {
  /** @param {any} T three @param {any} model raiz animada (GLB) @param {any} hips osso do quadril */
  constructor(T, model, hips) {
    this.T = T;this.model = model;this.hips = hips;
    const bones = new Map();model.traverse((/** @type {any} */ o) => {if (o.isBone) bones.set(o.name, o);});
    this.bones = bones;
    const det = detectRig([...bones.keys()]);
    this.issues = [...det.issues];
    this.legs = {};
    for (const side of ['l', 'r']) {
      const g = det.legs[side], up = bones.get(g.up), low = bones.get(g.low), foot = bones.get(g.foot);
      const chain = up && low && foot && low.parent === up && this.isDescendant(foot, low);
      if (up && low && foot && !chain) this.issues.push(`perna ${side === 'l' ? 'esquerda' : 'direita'}: cadeia coxa → canela → pé fora de ordem`);
      this.legs[side] = chain ? {up, low, foot, s: 0, plant: null, prev: null, lw: 0} : null;
    }
    this.head = bones.get(det.head ?? '') ?? null;this.neck = bones.get(det.neck ?? '') ?? null;this.chest = bones.get(det.chest ?? '') ?? null;
    this.footOk = !!(this.legs.l || this.legs.r);
    this.trackOk = !!this.head;
    this.v = [new T.Vector3(), new T.Vector3(), new T.Vector3(), new T.Vector3(), new T.Vector3(), new T.Vector3()];
    this.q = [new T.Quaternion(), new T.Quaternion(), new T.Quaternion()];
    /** Ossos que esta camada alterou no quadro anterior: {base (antes), out (depois)}. O mixer só reescreve um osso quando o valor animado MUDA, então sem desfazer a camada se acumularia em pose parada/estática. */
    this.touched = new Map();
    this.fw = 0;this.pelvis = 0;this.tw = 0;this.ty = 0;this.tp = 0;this.axesChecked = false;this.restFootH = null;
  }
  isDescendant(/** @type {any} */ node, /** @type {any} */ of) {for (let n = node?.parent; n; n = n.parent) if (n === of) return true;return false;}
  /** Texto legível para o painel do personagem. */
  diagnostics() {
    const bits = [];
    bits.push(`Pés: ${this.legs.l ? 'esquerdo ok' : 'esquerdo desligado'} · ${this.legs.r ? 'direito ok' : 'direito desligado'}`);
    bits.push(`Olhar: ${this.head ? 'cabeça ok' : 'sem cabeça'}${this.chest ? ' · tronco ok' : ' · sem tronco'}`);
    return bits.join(' — ') + (this.issues.length ? ` (${this.issues.join('; ')})` : '');
  }
  /** Sanidade dos eixos: a cabeça precisa estar ACIMA do quadril e os pés ABAIXO dele (rig de pé). */
  checkAxes() {
    if (this.axesChecked) return;this.axesChecked = true;
    const [a, b] = this.v;this.model.updateMatrixWorld(true);
    if (this.hips && this.head) {
      this.hips.getWorldPosition(a);this.head.getWorldPosition(b);
      if (!(b.y > a.y + .05)) {this.trackOk = false;this.issues.push('olhar: a cabeça não está acima do quadril (eixos do rig inválidos)');}
    }
    for (const side of ['l', 'r']) {
      const L = this.legs[side];if (!L || !this.hips) continue;
      this.hips.getWorldPosition(a);L.foot.getWorldPosition(b);
      if (!(b.y < a.y - .05)) {this.legs[side] = null;this.issues.push(`perna ${side === 'l' ? 'esquerda' : 'direita'}: o pé não está abaixo do quadril (eixos inválidos)`);}
    }
    this.footOk = !!(this.legs.l || this.legs.r);
  }
  /** Desfaz as alterações do quadro anterior nos ossos que o mixer NÃO reescreveu (valor ainda igual ao que a camada deixou). Idempotente. */
  undo() {
    for (const [bone, t] of this.touched) {
      if (bone.quaternion.equals(t.outQ)) bone.quaternion.copy(t.baseQ);
      if (t.basePos && bone.position.equals(t.outPos)) bone.position.copy(t.basePos);
    }
    this.touched.clear();
  }
  /** Guarda o estado de base de um osso antes da primeira alteração do quadro. */
  touch(/** @type {any} */ bone, /** @type {boolean} */ withPos = false) {
    if (!this.touched.has(bone)) this.touched.set(bone, {baseQ: bone.quaternion.clone(), outQ: bone.quaternion.clone(), basePos: withPos ? bone.position.clone() : null, outPos: withPos ? bone.position.clone() : null});
    else if (withPos && !this.touched.get(bone).basePos) {const t = this.touched.get(bone);t.basePos = bone.position.clone();t.outPos = bone.position.clone();}
  }
  /** Registra o resultado do quadro (para reconhecer, no próximo, se o mixer reescreveu o osso). */
  seal() {for (const [bone, t] of this.touched) {t.outQ.copy(bone.quaternion);if (t.outPos) t.outPos.copy(bone.position);}}
  /** Gira um osso em espaço mundial por `delta` (quaternion) e atualiza as matrizes dele e dos filhos. */
  rotateWorld(/** @type {any} */ bone, /** @type {any} */ delta) {
    this.touch(bone);
    const [q0, q1] = this.q;bone.getWorldQuaternion(q0);q0.premultiply(delta);
    bone.parent.getWorldQuaternion(q1);q1.invert().multiply(q0);bone.quaternion.copy(q1);bone.updateMatrixWorld(true);
  }
  /**
   * Aplica as camadas. Chamar depois de a pose base e a posição visual do personagem estarem calculadas.
   * @param {any} f lutador da simulação (leitura) @param {number} dt
   * @param {{foot: boolean, track: boolean, G: any, ground: (x:number,z:number,y:number)=>number, fighters: any[], facing: number, scaleY: number, bodyHeight: number, restMinY: number}} o
   */
  apply(f, dt, o) {
    this.undo();   // sempre primeiro: mesmo desligada, a camada precisa devolver o que alterou
    if (!o.foot && !o.track && this.fw < .005 && this.tw < .005) return;
    this.checkAxes();
    this.model.updateMatrixWorld(true);
    const calm = !f.flight && !f.ledge && !f.action?.jump && !f.action?.vault && !f.action?.slam && !STUN.has(f.state ?? '') && f.hp > 0;
    if (this.footOk) this.applyFeet(f, dt, o, o.foot && calm);
    if (this.trackOk) this.applyTrack(f, dt, o);
    this.seal();
  }
  applyFeet(/** @type {any} */ f, /** @type {number} */ dt, /** @type {any} */ o, /** @type {boolean} */ on) {
    const T = this.T, G = o.G, [A, B, Cp, Tg, N, tmp] = this.v;
    this.fw += ((on ? 1 : 0) - this.fw) * smoothAlpha(dt, on ? G.footSmooth : Math.max(.04, G.footSmooth * .6));
    if (this.fw < .005) {this.pelvis = 0;return;}
    const base = f.groundY ?? 0, sides = ['l', 'r'].filter(s => this.legs[s]);
    // Altura do tornozelo acima do ponto mais baixo do corpo (espaço do modelo): o menor valor visto com o lutador no chão (o pé apoiado de um ciclo de passos).
    if (!f.flight) for (const s of sides) {this.legs[s].foot.getWorldPosition(Cp);this.model.worldToLocal(tmp.copy(Cp));const h = Math.max(0, tmp.y - o.restMinY);this.restFootH = this.restFootH == null ? h : Math.min(this.restFootH, h);}
    const ankleH = (this.restFootH ?? 0) * o.scaleY;
    // 1) Erro bruto de apoio de cada pé (altura do suporte sob o pé − altura sob o corpo), só nos pés rentes ao chão.
    const raw = {}, wgt = {};
    for (const s of sides) {
      const L = this.legs[s];L.foot.getWorldPosition(Cp);
      const support = o.ground(Cp.x, Cp.z, base + .3);
      wgt[s] = footWeight(Cp.y - base - ankleH) * this.fw;
      raw[s] = Number.isFinite(support) ? clamp(support - base, -.6, .6) : 0;
    }
    // 2) Pelve: parte do erro que excede a correção máxima do tornozelo, compartilhada e limitada.
    let ex = 0, n = 0;
    for (const s of sides) {const e = raw[s] - clamp(raw[s], -G.footMaxCorrection, G.footMaxCorrection);if (wgt[s] > .05) {ex += e * wgt[s];n++;}}
    const pelvisTarget = n ? clamp(ex / n, -G.footPelvisMax, G.footPelvisMax) : 0;
    this.pelvis += (pelvisTarget - this.pelvis) * smoothAlpha(dt, G.footSmooth);
    if (Math.abs(this.pelvis) > 1e-4 && this.hips?.parent) {
      this.touch(this.hips, true);this.hips.getWorldPosition(tmp);tmp.y += this.pelvis;this.hips.parent.worldToLocal(tmp);this.hips.position.copy(tmp);this.hips.updateMatrixWorld(true);
    }
    // 3) IK de dois ossos por perna, em espaço mundial, com plantio vertical suavizado.
    for (const s of sides) {
      const L = this.legs[s], w = wgt[s];
      if (w < .01) {L.s += (0 - L.s) * smoothAlpha(dt, G.footSmooth);L.prev = null;continue;}
      L.foot.getWorldPosition(Cp);
      const speed = L.prev && dt > 1e-6 ? Math.hypot(Cp.x - L.prev.x, Cp.z - L.prev.z) / dt : 0;
      L.prev = {x: Cp.x, z: Cp.z};
      const want = clamp(raw[s] - this.pelvis, -G.footMaxCorrection, G.footMaxCorrection) * w;
      L.s += (want - L.s) * smoothAlpha(dt, G.footSmooth);
      // Pé quase parado: trava a posição horizontal onde pousou (limitada pela correção máxima); pé em passo livre solta.
      let tx = Cp.x, tz = Cp.z;
      if (speed < G.footPlantSpeed && w > .8) {
        L.plant ??= {x: Cp.x, z: Cp.z};
        const dx = L.plant.x - Cp.x, dz = L.plant.z - Cp.z, dl = Math.hypot(dx, dz);
        if (dl > G.footMaxCorrection) L.plant = null;
        else {tx = L.plant.x;tz = L.plant.z;}
      } else L.plant = null;
      if (Math.abs(L.s) < 1e-4 && tx === Cp.x && tz === Cp.z) continue;
      Tg.set(tx, Cp.y + L.s, tz);
      this.solveTwoBone(L.up, L.low, L.foot, Tg, A, B, Cp, N, tmp);
      if (G.footSlope > 0) {
        // Sola acompanha o apoio: inclina o pé rumo à normal do suporte (derivada por diferenças finitas).
        L.foot.getWorldPosition(Cp);
        const h = .15, y0 = base + .3, hx = o.ground(Cp.x + h, Cp.z, y0) - o.ground(Cp.x - h, Cp.z, y0), hz = o.ground(Cp.x, Cp.z + h, y0) - o.ground(Cp.x, Cp.z - h, y0);
        N.set(-hx / (2 * h), 1, -hz / (2 * h)).normalize();
        const [q] = this.q;q.setFromUnitVectors(tmp.set(0, 1, 0), N);
        const part = new T.Quaternion().slerp(q, clamp(G.footSlope / 100, 0, 1) * w);
        this.rotateWorld(L.foot, part);
      }
    }
  }
  /** Resolve a perna (coxa/canela) para o pé alcançar `target` (mundo); a articulação (joelho) mantém o lado em que já dobrava. */
  solveTwoBone(/** @type {any} */ up, /** @type {any} */ low, /** @type {any} */ foot, /** @type {any} */ target, /** @type {any} */ A, /** @type {any} */ B, /** @type {any} */ Cp, /** @type {any} */ N, /** @type {any} */ tmp) {
    const T = this.T;
    up.getWorldPosition(A);low.getWorldPosition(B);foot.getWorldPosition(Cp);
    const l1 = A.distanceTo(B), l2 = B.distanceTo(Cp);
    if (l1 < 1e-5 || l2 < 1e-5) return;
    const toT = tmp.copy(target).sub(A), d = clamp(toT.length(), Math.abs(l1 - l2) + 1e-4, l1 + l2 - 1e-4);
    toT.normalize();
    // Direção em que o joelho dobra: componente de (B − A) perpendicular a A→alvo (se a perna está reta, o plano é indefinido: não corrige).
    const ab = N.copy(B).sub(A), perp = ab.clone().addScaledVector(toT, -ab.dot(toT));
    if (perp.lengthSq() < 1e-8) return;
    perp.normalize();
    const cosA = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1), sinA = Math.sqrt(1 - cosA * cosA);
    const bNew = A.clone().addScaledVector(toT, l1 * cosA).addScaledVector(perp, l1 * sinA);
    const tgt = A.clone().addScaledVector(toT, d);
    // Coxa: A→B vira A→B'.
    const cur = B.clone().sub(A).normalize(), want = bNew.clone().sub(A).normalize();
    this.rotateWorld(up, new T.Quaternion().setFromUnitVectors(cur, want));
    // Canela: depois da coxa, B→pé vira B'→alvo.
    low.getWorldPosition(B);foot.getWorldPosition(Cp);
    const cur2 = Cp.clone().sub(B).normalize(), want2 = tgt.clone().sub(B).normalize();
    this.rotateWorld(low, new T.Quaternion().setFromUnitVectors(cur2, want2));
  }
  /** Alvo travado pela SIMULAÇÃO (nunca adquire um novo): alvo do Move em curso ou ponto de mira confirmado. */
  lockedPoint(/** @type {any} */ f, /** @type {any[]} */ fighters, /** @type {number} */ bodyHeight, /** @type {any} */ out) {
    const id = f.action?.lock;
    if (id != null) {
      const t = fighters.find(x => x.id === id);
      if (t && t.hp > 0 && !t.absent) {out.set(t.position.x, (t.flight?.y ?? t.groundY ?? 0) + (t.vaultHeight ?? 0) + bodyHeight * .6, t.position.z);return true;}
      return false;
    }
    const a = f.aim;
    if (a && a.valid && a.pos && !a.free && !a.range) {out.set(a.pos.x, (a.y ?? 0) + bodyHeight * .5, a.pos.z);return true;}
    return false;
  }
  applyTrack(/** @type {any} */ f, /** @type {number} */ dt, /** @type {any} */ o) {
    const G = o.G, [P, H] = this.v, d = Math.PI / 180;
    const blocked = !!f.ledge || !!f.flight || TRACK_BLOCKED.has(f.state ?? '') || f.hp <= 0 || !!f.wallSplat;
    const has = o.track && !blocked && this.lockedPoint(f, o.fighters, o.bodyHeight, P);
    this.tw += ((has ? 1 : 0) - this.tw) * smoothAlpha(dt, has ? G.trackSmooth : G.trackRelease);
    if (!has && this.tw < .004) {this.tw = 0;this.ty = 0;this.tp = 0;return;}
    if (!this.head) return;
    let yawErr = this.ty, pitchErr = this.tp;
    if (has) {
      this.head.getWorldPosition(H);
      const dx = P.x - H.x, dz = P.z - H.z, dy = P.y - H.y, hd = Math.hypot(dx, dz);
      if (hd < .05) return;
      const wantYaw = wrapPi(Math.atan2(dx, dz) - o.facing), wantPitch = Math.atan2(dy, hd);
      // Fora do cone configurado (atrás do lutador): solta em vez de torcer o corpo.
      const cone = (G.trackHeadYaw / Math.max(.3, 1 - clamp(G.trackTorso / 100, 0, .7))) * d + 25 * d;
      if (Math.abs(wantYaw) > cone) {this.tw += (0 - this.tw) * smoothAlpha(dt, G.trackRelease);}
      else {const a = smoothAlpha(dt, G.trackSmooth);this.ty += (wantYaw - this.ty) * a;this.tp += (wantPitch - this.tp) * a;}
      yawErr = this.ty;pitchErr = this.tp;
    }
    const sp = splitTracking({yawErr, pitchErr, headYaw: G.trackHeadYaw, headPitch: G.trackHeadPitch, torsoPct: G.trackTorso / 100});
    const T = this.T, k = this.tw, up = new T.Vector3(0, 1, 0);
    if (this.chest && Math.abs(sp.torsoYaw) > 1e-4) this.rotateWorld(this.chest, new T.Quaternion().setFromAxisAngle(up, sp.torsoYaw * k));
    if (Math.abs(sp.headYaw) > 1e-4) this.rotateWorld(this.head, new T.Quaternion().setFromAxisAngle(up, sp.headYaw * k));
    if (Math.abs(sp.headPitch) > 1e-4) {
      const fwd = new T.Vector3(Math.sin(o.facing + yawErr), 0, Math.cos(o.facing + yawErr)), axis = fwd.clone().cross(up).normalize();
      this.rotateWorld(this.head, new T.Quaternion().setFromAxisAngle(axis, sp.headPitch * k));
    }
  }
}
const STUN = new Set(['hitstun', 'stagger', 'pushed', 'guardStun', 'defeated', 'airborne', 'landing', 'recover', 'ledgeHang', 'ledgeClimb', 'wallSplat']);
