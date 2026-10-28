// @ts-check
// Visual e partículas do Bullet Punch (Documento 02).
// Módulo de renderização consumido exclusivamente pela camada view/ (moves-vfx-registry.js).
// Encapsula o ciclo de vida visual completo do avanço em disparada e soco metálico:
//   - Criação da malha 3D do punho metálico e emissor de partículas
//   - Sincronização com o estado da ação do lutador (f.absent / corrida invisível / retorno)
//   - Ondas de choque, pós-imagens e partículas de impacto metálico
//   - Limpeza completa de recursos e respeito à acessibilidade (noFlash/reduceMotion).

import * as T from 'three';
import {RushEffect} from '../../../../../sand-stone-lab/src/rush-effects.ts';
import {Particles} from '../../../../../sand-stone-lab/src/particles.js';
import {defaults} from '../../../../../sand-stone-lab/src/config.ts';
import {disposeGroup} from '../../../../../sand-stone-lab/src/art.js';
import {ATELIER_GAME_PARAMS, ATELIER_GAME_VARIANT} from '../../../view/quarks/atelier-game-params.js';
import {C} from '../../config.js';
import {parentPointToLocal} from '../../../view/quarks/coords.js';

export const id = 'bullet-punch';

/** Rush mais recente de cada lutador: só ele recebe os eventos (um rush antigo ainda na cauda não pega o retorno/impacto do próximo). */
const LATEST = new WeakMap();

/**
 * Interruptor do rush do Ateliê: `atelierVfx` (parâmetro do move.json, controle da aba Moves/Editor) é a fonte CANÔNICA; `enableAtelierVfx` é o
 * nome antigo e só vale quando a canônica não existe (presets/JSON/sessões antigos já são migrados na leitura: actions-meta.js/presets.js).
 * @param {any} cfg C.world.bulletPunch
 */
export function atelierVfxOn(cfg) {
  return (cfg?.atelierVfx ?? cfg?.enableAtelierVfx ?? 1) !== 0;
}

/**
 * Aplica as configurações de acessibilidade do jogo aos parâmetros do efeito
 * @param {Record<string, any>} p
 * @param {any} acc
 * @returns {Record<string, any>}
 */
function accessible(p, acc) {
  const res = {...p};
  const reduceMotion = !!(acc?.reduceMotion || C.vfx?.master?.reduceMotion);
  const noFlash = !!(acc?.noFlash || C.vfx?.master?.noFlash);
  if (reduceMotion) {
    for (const k of ['density', 'particleDensity', 'sparks', 'flash', 'emissivity', 'shards']) if (k in res) res[k] *= .45;
    if ('impactIntensity' in res) res.impactIntensity *= .7;
    for (const k of ['turn', 'angularSpeed', 'twist', 'spiral', 'undulation']) if (k in res) res[k] *= .3;
  }
  if (noFlash) {
    for (const k of ['flash', 'halo', 'shotRecoilFlash']) if (k in res) res[k] = 0;
    for (const k of ['coreGlow', 'edgeGlow', 'veinGlow', 'emissivity', 'glow']) if (k in res) res[k] *= .4;
  }
  return res;
}

/**
 * @param {Record<string, any>} [over]
 * @returns {Record<string, any>}
 */
function paramsOf(over = {}) {
  return {...defaults.bulletpunch, ...ATELIER_GAME_PARAMS.bulletpunch, ...over};
}

/**
 * Entidades do mundo: o Bullet Punch não cria entidades autônomas (atua sobre o lutador)
 * @param {any} e
 * @returns {boolean}
 */
export function handles(e) {
  return false;
}

/**
 * Verifica se a ação do lutador é a preparação/vanish de um Bullet Punch
 * @param {any} f
 * @returns {boolean}
 */
export function handlesFighter(f) {
  if (!atelierVfxOn(C.world?.bulletPunch)) return false;
  return f?.action?.move === 'bullet-punch' && f?.action?.kind !== 'tackle';
}

/**
 * Cria a instância visual do rush de Bullet Punch
 * @param {any} view
 * @param {any} f
 * @param {any} acc
 */
export function spawnRush(view, f, acc) {
  const parent = view.group ?? view;
  const group = new T.Group();
  parent.add(group);

  const heading = f.action?.startAngle ?? f.action?.heading ?? f.facing ?? 0;
  group.position.set(f.position.x, f.groundY ?? 0, f.position.z);
  group.rotation.y = heading;
  group.updateMatrixWorld(true);

  const batch = view.atelierFx?.batch ?? view.elementalFx?.batch;
  const particles = new Particles(group, /** @type {any} */ (batch ? {renderer: batch, emitterParent: group} : {emitterParent: group}));
  const p = accessible(paramsOf(), acc);
  const fx = new RushEffect(group, particles, 'bulletpunch', ATELIER_GAME_VARIANT.bulletpunch, p);

  // Oculta objetos de palco fora do combate real (alvo e boneco lançador)
  for (const o of [...group.children]) {
    if (Math.abs(o.position.z - 2.7) < 1e-6) o.visible = false;
  }
  if (fx.caster) fx.caster.visible = false;

  const y = 1.05, impactY = 1.05;
  const r = {
    f,
    move: 'bullet-punch',
    kind: 'bulletpunch',
    quick: false,
    group,
    particles,
    fx,
    action: f.action,
    age: 0,
    hist: /** @type {Array<{t: number, x: number, y: number, z: number}>} */ ([]),
    moved: false,
    out: 0,
    done: false,
    y,
    impact: new T.Vector3(0, impactY, .6),
    // F5: estado visual (preparacao → vanish → retorno → investida → impacto → fim), avançado pelo estado do lutador e pelos eventos DESTE Bullet Punch
    state: 'preparacao',
    returned: false,
    struck: false,
    /** @type {any} */ strike: null,
    /** @type {{x: number, y: number, z: number} | null} */ impactWorld: null
  };
  LATEST.set(f, r);

  /** @type {any} */ (fx).launch.position.set(0, .04, 0);
  if (/** @type {any} */ (fx).shot) {
    /** @type {any} */ (fx).shot.base.set(0, .4, 0);
    /** @type {any} */ (fx).shot.dir.set(0, 0, 1);
  }

  const sameAs = (/** @type {any} */ a, /** @type {any} */ b) => Array.isArray(a) && a.length === 3 && a.every((x, i) => Math.abs(x - b[i]) < 1e-9);
  const create = particles.create.bind(particles);
  particles.create = (o = {}) => create({
    ...o,
    position: sameAs(o.position, [0, .12, -2.4]) ? [0, .12, 0] : sameAs(o.position, [0, impactY, 2.35]) ? r.impact.toArray() : o.position
  });

  /** @type {any} */ (fx).path = (/** @type {number} */ t, /** @type {any} */ out) => {
    const h = r.hist;
    if (!h.length) return out.set(0, y, 0);
    let k = 0;
    while (k < h.length - 1 && h[k + 1].t <= t) k++;
    const a = h[k], b = h[Math.min(h.length - 1, k + 1)];
    const u = b.t > a.t ? Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))) : 0;
    return out.set(a.x + (b.x - a.x) * u, y + a.y + (b.y - a.y) * u, a.z + (b.z - a.z) * u);
  };

  return r;
}

/**
 * Atualiza o avanço do efeito e sincroniza com a trajetória física do lutador
 * @param {any} view
 * @param {any} r
 * @param {number} dt
 * @returns {boolean}
 */
export function advanceRush(view, r, dt) {
  r.age += dt;
  const f = r.f;
  const same = f.action === r.action && f.action?.move === r.move;
  if (r.state === 'preparacao' && same && f.absent) r.state = 'vanish';
  // A investida é o Tackle que o retorno encadeia (ação nova com move = bullet-punch); qualquer outra ação do lutador não conta.
  if (r.returned && !r.strike && isStrike(f, r)) {r.strike = f.action;if (!r.struck) r.state = 'investida';}
  if (same && !r.done) {
    const q = r.group.worldToLocal(new T.Vector3(
      f.position.x,
      (f.flight?.y ?? f.groundY ?? 0) + (f.vaultHeight ?? 0),
      f.position.z
    ));
    const d = Math.hypot(q.x, q.z);
    r.hist.push({t: r.age, x: q.x, y: q.y, z: q.z});
    if (!r.moved && d > .05) {
      r.moved = true;
      /** @type {any} */ (r.fx).charge = r.age;
    }
    if (r.moved && d + 1e-4 < r.out) {
      r.done = true;
    }
    r.out = Math.max(r.out, d);
  } else {
    r.done = true;
  }

  const fx = /** @type {any} */ (r.fx);
  if (!r.moved) fx.charge = r.age + .02;
  if (!r.done) fx.travel = Math.max(.01, r.age - fx.charge + .02);
  fx.arrival = fx.charge + fx.travel;
  fx.duration = fx.arrival + fx.tail;

  // Antes do retorno o ponto de impacto acompanha o ponto mais distante do trajeto (local); depois, vale o ponto do EVENTO (retorno/impacto).
  if (!r.returned) {
    const far = r.hist.reduce((/** @type {any} */ m, /** @type {any} */ q) => Math.hypot(q.x, q.z) > Math.hypot(m.x, m.z) ? q : m, {x: 0, y: 0, z: 0});
    r.impact.set(far.x, 1.05 + far.y, far.z + .6);
  }
  fx.impact.position.copy(r.impact);

  const t = Math.min(fx.duration, r.age);
  fx.update(t, dt);
  r.particles.update(dt);

  const finished = r.done && r.age >= fx.duration + .4;
  if (finished) r.state = 'fim';
  return finished;
}

/** A ação atual do lutador é a investida encadeada por ESTE Bullet Punch? @param {any} f @param {any} r */
function isStrike(f, r) {
  return !!f.action && f.action !== r.action && f.action.move === r.move && f.action.kind === 'tackle';
}

/** Fixa o ponto de impacto: coordenadas da simulação (espaço do pai do grupo) → local do grupo girado no heading do disparo. @param {any} r @param {number} x @param {number} y @param {number} z */
function setImpact(r, x, y, z) {
  r.impactWorld = {x, y, z};
  parentPointToLocal(r.group, r.impactWorld, r.impact);
  /** @type {any} */ (r.fx).impact.position.copy(r.impact);
  /** @type {any} */ (r.fx).arrival = Math.min(/** @type {any} */ (r.fx).arrival, r.age);
}

/**
 * Despacha eventos do lutador (retorno do desaparecimento e impacto do golpe)
 * @param {any} view
 * @param {any} ev
 * @param {any} r
 */
export function onFighterEvent(view, ev, r) {
  if (!r || !ev || ev.attacker == null || ev.attacker !== r.f?.id || LATEST.get(r.f) !== r) return;
  const f = r.f, ground = f.groundY ?? 0;
  if (ev.result === 'bulletReturn') {
    if (ev.move !== r.move || r.returned) return;
    r.returned = true;r.done = true;r.state = 'retorno';
    if (Number.isFinite(ev.x) && Number.isFinite(ev.z)) setImpact(r, ev.x, 1.05 + (ev.y ?? ground), ev.z);
    return;
  }
  if (!['impact', 'partial', 'perfect', 'hit'].includes(ev.result)) return;
  // F5: só o golpe DESTE Bullet Punch (a investida depois do retorno). Um Tackle comum ou outro Move do mesmo lutador não dispara o impacto do rush.
  if (!r.returned || r.struck || !(f.action === r.strike || isStrike(f, r))) return;
  r.struck = true;r.strike ??= f.action;r.state = 'impacto';r.done = true;
  const x = Number.isFinite(ev.x) ? ev.x : f.position.x, z = Number.isFinite(ev.z) ? ev.z : f.position.z;
  setImpact(r, x, 1.05 + (Number.isFinite(ev.y) ? ev.y : ground), z);
}

/**
 * Descarta e libera todos os recursos gráficos alocados
 * @param {any} view
 * @param {any} r
 */
export function disposeRush(view, r) {
  r.particles.clear();
  disposeGroup(r.group);
  r.group.removeFromParent();
}
