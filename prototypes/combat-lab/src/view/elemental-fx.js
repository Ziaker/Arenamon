// @ts-check
// Visuais dos Moves elementais (Water Pulse, Fire Spin, Air Slash, Seed Bomb) — protótipo de 23/10/2026, arte PROVISÓRIA. Só aparência: o desenho lê a entidade e nunca decide
// nada (a colisão é o raio/volume da simulação; o desenho do Air Slash tem a caixa do prompt, mas colide como círculo). Respeita noFlash e reduceMotion.
// `makeElemental` devolve um grupo (ou null se a entidade não é elemental); `updateElemental` o atualiza a cada quadro.
import * as T from 'three';

const PL_COLORS = [0xffffff, 0x59d6e6, 0xffcf6a, 0xff6adf];
const additive = (/** @type {number} */ color, /** @type {number} */ opacity = .8) => new T.MeshBasicMaterial({color, transparent: true, opacity, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide});
const solid = (/** @type {number} */ color, /** @type {number} */ opacity = .9) => new T.MeshBasicMaterial({color, transparent: true, opacity, depthWrite: false, side: T.DoubleSide});

/** Crescente (visto de cima): arco que abaula para a frente (+z), extrudado na vertical; base com largura 1, abaulamento 0,35 e espessura 1. */
function crescentGeometry() {
  const s = new T.Shape();
  s.moveTo(-.5, 0);s.quadraticCurveTo(0, .55, .5, 0);s.quadraticCurveTo(0, .2, -.5, 0);
  const g = new T.ExtrudeGeometry(s, {depth: 1, bevelEnabled: false});
  g.rotateX(Math.PI / 2);g.translate(0, .5, 0);   // y do desenho → +z (frente); a extrusão vira altura, centrada em y = 0
  return g;
}

/** @param {any} e entidade do mundo @returns {T.Group | null} */
export function makeElemental(e) {
  const g = new T.Group();
  if (e.kind === 'projectile' && e.visual === 'waterorb') {
    const orb = new T.Mesh(new T.SphereGeometry(.5, 20, 14), solid(0x3aa8ff, .55));orb.name = 'orb';
    const core = new T.Mesh(new T.SphereGeometry(.28, 14, 10), additive(0xbfeaff, .95));core.name = 'core';
    const ring = new T.Mesh(new T.TorusGeometry(.62, .035, 8, 32), additive(PL_COLORS[Math.min(3, e.pl ?? 1)], .9));ring.name = 'ring';
    const ring2 = new T.Mesh(new T.TorusGeometry(.62, .03, 8, 32), additive(0x9fdcff, .7));ring2.name = 'ring2';ring2.rotation.x = Math.PI / 2;
    g.add(orb, core, ring, ring2);
    for (let i = 0; i < 6; i++) {const d = new T.Mesh(new T.SphereGeometry(.07, 6, 5), solid(0x9fe0ff, .8));d.name = 'drop';d.userData.k = i;g.add(d);}   // gotas em órbita
    return g;
  }
  if (e.kind === 'projectile' && e.visual === 'airslash') {
    const blade = new T.Mesh(crescentGeometry(), additive(0xe9f6ff, .9));blade.name = 'blade';
    const edge = new T.Mesh(crescentGeometry(), solid(0x7cc8ff, .5));edge.name = 'edge';edge.scale.set(1.12, 1.15, 1.35);
    g.add(edge, blade);
    for (let i = 0; i < 5; i++) {const s = new T.Mesh(new T.PlaneGeometry(.04, 1), additive(0xd6efff, .5));s.name = 'streak';s.userData.k = i;g.add(s);}   // estelas finas atrás da lâmina
    return g;
  }
  if (e.kind === 'projectile' && e.visual === 'seed') {
    const geo = new T.OctahedronGeometry(.5, 0);geo.scale(.85, 1.15, .85);
    const body = new T.Mesh(geo, new T.MeshStandardMaterial({color: 0x6a8f2f, roughness: .8, flatShading: true, emissive: 0x1d3a0b, emissiveIntensity: .5}));body.name = 'seedBody';
    const leafGeo = new T.ConeGeometry(.16, .5, 5);leafGeo.translate(0, .45, 0);
    for (let i = 0; i < 3; i++) {const l = new T.Mesh(leafGeo, solid(0x8fd14f, .95));l.name = 'leaf';l.rotation.set(0, i * 2.1, .7);g.add(l);}
    g.add(body);
    return g;
  }
  if (e.kind === 'area' && e.visual === 'firespin') {
    // coluna aberta, espirais de chamas (cones que giram), anel no chão e um anel de pulso que o desenho dispara a cada pulso
    const col = new T.Mesh(new T.CylinderGeometry(1, 1, 1, 32, 1, true), additive(0xff6a1a, .18));col.name = 'column';col.position.y = .5;g.add(col);
    const base = new T.Mesh(new T.RingGeometry(.9, 1, 48).rotateX(-Math.PI / 2), additive(0xffb347, .75));base.name = 'base';base.position.y = .03;g.add(base);
    const pulse = new T.Mesh(new T.RingGeometry(.92, 1, 48).rotateX(-Math.PI / 2), additive(0xffe08a, 0));pulse.name = 'pulse';pulse.position.y = .06;g.add(pulse);
    const coneGeo = new T.ConeGeometry(.12, 1, 6);coneGeo.translate(0, .5, 0);
    for (let i = 0; i < 18; i++) {const c = new T.Mesh(coneGeo, additive(i % 3 ? 0xff7a1f : 0xffd34d, .75));c.name = 'flame';c.userData.k = i;g.add(c);}
    for (let i = 0; i < 14; i++) {const c = new T.Mesh(new T.BoxGeometry(.06, .06, .06), additive(0xffa033, .9));c.name = 'ember';c.userData.k = i;g.add(c);}
    return g;
  }
  if (e.kind === 'area' && e.visual === 'seedblast') {
    const sph = new T.Mesh(new T.SphereGeometry(1, 24, 16), additive(0x7bd957, .45));sph.name = 'blast';
    const shell = new T.Mesh(new T.SphereGeometry(1, 16, 10), new T.MeshBasicMaterial({color: 0xc8ff9a, wireframe: true, transparent: true, opacity: .7}));shell.name = 'shell';
    g.add(sph, shell);
    for (let i = 0; i < 16; i++) {const l = new T.Mesh(new T.PlaneGeometry(.22, .12), solid(i % 2 ? 0x59b53a : 0xa6e36b, .95));l.name = 'leafBit';l.userData.k = i;g.add(l);}   // folhas lançadas
    return g;
  }
  return null;
}

const calm = (/** @type {any} */ acc) => !!(acc?.reduceMotion);

/**
 * Atualiza o desenho de uma entidade elemental. `time` = relógio do desenho (s), `dt` = passo do quadro, `acc` = acessibilidade {noFlash, reduceMotion, highContrast}.
 * Devolve true se a entidade era elemental (o chamador pula o desenho padrão).
 */
export function updateElemental(/** @type {T.Group} */ m, /** @type {any} */ e, /** @type {number} */ time, /** @type {number} */ dt, /** @type {any} */ acc = null) {
  const slow = calm(acc) ? .35 : 1, noFlash = !!acc?.noFlash;
  if (e.kind === 'projectile' && e.visual === 'waterorb') {
    m.position.set(e.pos.x, e.y, e.pos.z);m.scale.setScalar(e.radius * 2 * (e.visualScale ?? 1) * 1.05);
    m.getObjectByName('ring')?.rotation.set(time * 3 * slow, time * 1.5 * slow, 0);m.getObjectByName('ring2')?.rotation.set(Math.PI / 2, time * 4 * slow, time * 2 * slow);
    const core = m.getObjectByName('core');if (core) core.scale.setScalar(.9 + .12 * Math.sin(time * 14 * slow));
    for (const c of m.children) if (c.name === 'drop') {const k = c.userData.k, a = time * 5 * slow + k * 1.05;c.position.set(Math.cos(a) * .72, Math.sin(a * 1.3 + k) * .5, Math.sin(a) * .72);}
    return true;
  }
  if (e.kind === 'projectile' && e.visual === 'airslash') {
    const c = e.captured ?? {}, w = c.w ?? 1.2, h = c.h ?? .7, th = c.t ?? .22;
    m.position.set(e.pos.x, e.y, e.pos.z);m.rotation.y = Math.atan2(e.vel?.x ?? e.dir.x, e.vel?.z ?? e.dir.z);m.scale.set(w, h, th / .35);
    const blade = m.getObjectByName('blade');if (blade) blade.material.opacity = noFlash ? .85 : .75 + .15 * Math.sin(time * 40);
    for (const s of m.children) if (s.name === 'streak') {const k = s.userData.k;s.position.set((k - 2) * .18, ((k % 2) - .5) * .25, -.5 - k * .12);s.scale.set(1, .6 + k * .35, 1);s.rotation.x = Math.PI / 2;}
    return true;
  }
  if (e.kind === 'projectile' && e.visual === 'seed') {
    m.position.set(e.pos.x, e.y, e.pos.z);m.scale.setScalar(e.radius * 2.1);m.rotation.x += 7 * dt * slow;m.rotation.z += 4 * dt * slow;
    return true;
  }
  if (e.kind === 'area' && e.visual === 'firespin') {
    const R = e.radius, H = e.height, left = e.life - e.age, fade = left < .5 ? Math.max(.15, left / .5) : Math.min(1, e.age / .2 + .3);
    m.position.set(e.pos.x, e.y, e.pos.z);
    const col = m.getObjectByName('column');if (col) {col.scale.set(R, H, R);col.material.opacity = .16 * fade;}
    const base = m.getObjectByName('base');if (base) {base.scale.set(R, 1, R);base.material.opacity = .7 * fade;}
    const turn = time * 2.6 * slow;
    for (const c of m.children) {
      if (c.name === 'flame') {const k = c.userData.k, a = turn + k * (Math.PI * 2 / 18), r = R * (.25 + .7 * ((k * 0.61803) % 1)), flick = .75 + .25 * Math.sin(time * 9 + k * 2.1);c.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);c.scale.set(1, H * (.45 + .5 * ((k * 0.37) % 1)) * flick * fade, 1);c.rotation.z = Math.cos(a) * .25;c.rotation.x = Math.sin(a) * .25;}
      else if (c.name === 'ember') {const k = c.userData.k, ph = (time * .9 * slow + k * .13) % 1, a = turn * 1.6 + k * .9, r = R * (.3 + .6 * ((k * 0.37) % 1));c.position.set(Math.cos(a) * r, ph * H, Math.sin(a) * r);c.material.opacity = .9 * (1 - ph) * fade;}
    }
    // anel de pulso: dispara a cada pulso novo e se expande (cada pulso é distinguível)
    const pulse = m.getObjectByName('pulse');
    if (pulse) {
      if (m.userData.pulsesSeen === undefined) m.userData.pulsesSeen = 0;
      if (e.pulsesDone > m.userData.pulsesSeen) {m.userData.pulsesSeen = e.pulsesDone;m.userData.pulseAge = 0;}
      const pa = m.userData.pulseAge ?? 9;m.userData.pulseAge = pa + dt;const k = Math.min(1, pa / .35);
      pulse.scale.set(R * (.5 + .55 * k), 1, R * (.5 + .55 * k));pulse.material.opacity = (noFlash ? .45 : .9) * (1 - k);
    }
    return true;
  }
  if (e.kind === 'area' && e.visual === 'seedblast') {
    const k = Math.min(1, e.age / .14), fade = 1 - Math.min(1, e.age / Math.max(.15, e.life));
    m.position.set(e.pos.x, e.y + e.radius, e.pos.z);const s = e.radius * (.25 + .75 * (1 - Math.pow(1 - k, 3)));
    const blast = m.getObjectByName('blast'), shell = m.getObjectByName('shell');
    if (blast) {blast.scale.setScalar(s);blast.material.opacity = (noFlash ? .3 : .5) * fade;}
    if (shell) {shell.scale.setScalar(s * 1.02);shell.material.opacity = .7 * fade;}
    for (const c of m.children) if (c.name === 'leafBit') {const q = c.userData.k, a = q * 2.4, up = ((q * 0.37) % 1) - .3, r = s * (.5 + .5 * ((q * 0.61803) % 1));c.position.set(Math.cos(a) * r, up * s * .9 + 1.2 * k * (1 - k), Math.sin(a) * r);c.rotation.set(q, time * 6 * slow + q, 0);c.material.opacity = .95 * fade;}
    return true;
  }
  return false;
}
