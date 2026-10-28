// @ts-check
// F5 — Despachante único de eventos visuais. O View.draw recebe a janela dos últimos eventos da simulação (game.events, até 12)
// a cada quadro; antes cada consumidor guardava o próprio `seen` (WeakSet por identidade) e o novo runtime não guardava nenhum
// (redisparava a janela inteira a cada quadro). Agora o despachante decide UMA vez por quadro quais eventos são novos (por
// eventId, F3.4) e entrega só esses (`fresh`) a todos os consumidores, na ordem da simulação.
// Regras (skill game-feel: um dono de feedback por canal; juice nunca toca a simulação — aqui só se lê o evento):
//  · OWNERS: quem desenha cada resultado, por canal. Canais diferentes para o mesmo resultado se somam de propósito (tremor +
//    partículas + anel); o defeito evitado é DOIS donos de `particles` (a explosão de contato) no mesmo modo.
//  · Modo = {useNewVfx, quarks}. Com three.quarks ligado ele é o dono das explosões que cobre (A/B do Fase 2) e o renderizador
//    ativo (legado ou novo) cede só as partículas desses resultados — tremor e flash continuam com ele.
//  · Resultado sem entrada em OWNERS nem em SEM_VISUAL é desconhecido: conta em diagnostics().unknown e não é entregue.
//  · Identidade: eventId é único por Game; reset/load trocam o Game.world (e reiniciam eventIdSeq em 1), então a troca do
//    `epoch` (world) ou a regressão do maior eventId reiniciam a contagem — além do reset explícito (view.reset()).

/** Canais. `particles` = explosão de contato principal (no máximo 1 dono por modo). Os demais são camadas que se somam:
 * solid = malhas 3D sólidas (solid-fx, independe do renderizador de sprites) · debris = estilhaços de entidade do mundo
 * (rocha/barreira, world-view) · move = VFX próprio do projétil/rush do Move (moves-vfx-registry, roteado por ev.entity)
 * · ring = anel do world-view · camera = tremor/feedback de câmera · post = pulsos do pós-processamento · flash = aura de
 * status / clarão do Riposte · anim = transiente de animação do personagem · hud = estatística/aviso · v6 = camada histórica
 * opcional (Visualizar › Efeitos legados, C.vfx.master.legacy; somada por escolha explícita, desligada por padrão). */
export const CHANNELS = ['particles', 'solid', 'debris', 'move', 'ring', 'camera', 'post', 'flash', 'anim', 'hud', 'v6'];

/** Modos medidos pelo teste: renderizador legado ou novo × three.quarks desligado/ligado. Padrão do jogo: o primeiro. */
export const MODES = [{useNewVfx: false, quarks: false}, {useNewVfx: false, quarks: true}, {useNewVfx: true, quarks: false}, {useNewVfx: true, quarks: true}];

// Atalhos de dono de partículas: legado = view/vfx.js (VfxSystem) · new = view/vfx/runtime.js · quarks = view/quarks/bridge.js
const VFX = {legacy: 'vfx', new: 'runtime'}, VFXQ = {...VFX, quarks: 'quarks'};

/** Dono por resultado e canal (a verdade medida em test/f5-vfx-dispatch.test.mjs: quem de fato emite em cada modo). */
export const OWNERS = Object.freeze({
  impact: {particles: VFXQ, solid: 'solid', debris: 'worldView', move: 'movesVfx', camera: ['vfx', 'runtime', 'cinematic'], post: 'post', flash: ['statusAura', 'riposteFx'], v6: 'v6', hud: 'matchStats'},
  partial: {particles: VFX, solid: 'solid', move: 'movesVfx', camera: ['vfx'], flash: ['statusAura'], v6: 'v6', hud: 'matchStats'},
  perfect: {particles: VFX, solid: 'solid', move: 'movesVfx', camera: ['vfx', 'runtime', 'cinematic'], post: 'post', anim: 'characters', v6: 'v6', hud: 'matchStats'},
  clash: {particles: VFXQ, solid: 'solid', move: 'movesVfx', camera: ['vfx', 'runtime', 'cinematic'], post: 'post', v6: 'v6', hud: 'matchStats'},
  tackleClash: {particles: {new: 'runtime', quarks: 'quarks'}, ring: 'worldView', debris: 'worldView', camera: ['runtime', 'cinematic'], post: 'post', hud: 'matchStats'},
  stoneClash: {particles: {new: 'runtime', quarks: 'quarks'}, ring: 'worldView', debris: 'worldView', camera: ['runtime', 'cinematic'], post: 'post', hud: 'matchStats'},
  footstool: {particles: VFXQ, camera: ['vfx', 'runtime', 'cinematic'], post: 'post', v6: 'v6', hud: 'matchStats'},
  wallSplat: {particles: VFXQ, move: 'movesVfx', camera: ['vfx'], post: 'post', v6: 'v6'},
  destructibleSplat: {particles: VFX, camera: ['vfx'], v6: 'v6'},
  ledgeGrab: {particles: {legacy: 'vfx'}},
  invulnerable: {particles: {new: 'runtime'}, v6: 'v6'},
  perfectDodge: {camera: ['cinematic'], hud: 'matchStats'},
  counter: {particles: {new: 'runtime'}, ring: 'worldView', debris: 'worldView', camera: ['runtime']},
  counterStagger: {ring: 'worldView'},
  shielded: {ring: 'worldView'},
  reflected: {ring: 'worldView', debris: 'worldView', move: 'movesVfx'},
  neutralized: {ring: 'worldView'},
  barrierBroken: {ring: 'worldView', debris: 'worldView', hud: 'matchStats'},
  destructibleHit: {particles: {new: 'runtime'}, move: 'movesVfx', camera: ['runtime']},
  groundHit: {particles: {new: 'runtime'}, move: 'movesVfx', camera: ['runtime']},
  bounceLand: {particles: {new: 'runtime'}, camera: ['runtime']},
  statusApplied: {particles: {new: 'runtime'}},
  chargeRelease: {solid: 'solid', anim: 'characters', camera: ['cinematic'], hud: 'matchStats'},
  move: {anim: 'characters'},
  riposteStrike: {flash: ['riposteFx']},
  sandStagger: {move: 'movesVfx'}, obstacleHit: {move: 'movesVfx'}, platformHit: {move: 'movesVfx'}, arenaHit: {move: 'movesVfx'},
  expire: {move: 'movesVfx'}, blocked: {move: 'movesVfx'}, bulletReturn: {move: 'movesVfx'},
  spawn: {hud: 'matchStats'}, passiveActivated: {hud: 'matchStats'}, moveFailed: {hud: 'matchStats'}, dodge: {hud: 'matchStats'},
});

/** Resultados conhecidos SEM visual por evento (entregues mesmo assim; nenhum consumidor desenha). Destruição de destrutível/rocha,
 * mira, itens e escudos são desenhados pelo ESTADO (world-view/wv-map, aim-markers, HUD), não pelo evento. */
export const SEM_VISUAL = new Set([
  'executed', 'denied', 'buffered', 'moveEffect', 'aimStart', 'aimConfirm', 'aimCancel', 'statusTick', 'statusExpired', 'stageUp', 'blinded', 'cooldownBoost',
  'sceneryDestroyed', 'destructibleDestroyed', 'destructibleDamaged', 'destructibleRespawned', 'destructibleGhost', 'rockDestroyed', 'rockCreated', 'rockLaunch',
  'stoneNoRock', 'stoneBlast', 'detonate', 'trapTrigger', 'trapLost', 'fieldReplaced', 'fieldLost', 'spawnRejected', 'spawnRefused', 'occluded',
  'itemCollected', 'itemSpawned', 'itemExpired', 'itemDropped', 'dropSpawned', 'expired', 'healedHp', 'healedStamina', 'shieldApplied', 'shieldExpired',
  'passiveEnded', 'passiveCycleSuspect', 'passiveReflect', 'passiveReady', 'passiveHeal', 'passiveBlocked', 'reflectCycle',
  'ledgeMantle', 'ledgeDrop', 'ledgeClimb', 'ledgeBlocked', 'pinEscape', 'feint', 'feintWhiff', 'riposte', 'chargeStart',
  'bulletVanish', 'bulletNoTarget', 'arenaBounce',
]);

/** Dono das partículas do resultado no modo (quarks ligado tem precedência nos resultados que cobre); null = ninguém. */
export function particleOwner(/** @type {string} */ result, {useNewVfx = false, quarks = false} = {}) {
  const p = /** @type {any} */ (OWNERS)[result]?.particles;if (!p) return null;
  return (quarks && p.quarks) || (useNewVfx ? p.new : p.legacy) || null;
}

/** Liga o filtro de partículas nos dois renderizadores conforme o modo (chamado pelo View.draw a cada quadro; custo: 2 atribuições). */
export function applyParticleOwners(/** @type {{vfx?: any, runtime?: any}} */ {vfx, runtime}, /** @type {{useNewVfx?: boolean, quarks?: boolean}} */ mode) {
  const m = {useNewVfx: !!mode.useNewVfx, quarks: !!mode.quarks}, key = `${+m.useNewVfx}${+m.quarks}`;
  if (vfx && vfx._ownsKey !== key) {vfx._ownsKey = key;vfx.ownsParticles = (/** @type {string} */ r) => particleOwner(r, m) === 'vfx';}
  if (runtime && runtime._ownsKey !== key) {runtime._ownsKey = key;runtime.ownsParticles = (/** @type {string} */ r) => particleOwner(r, m) === 'runtime';}
}

const NONE = Object.freeze([]), MAX_BACKLOG = 32;

export class VfxDispatch {
  constructor(owners = OWNERS, semVisual = SEM_VISUAL) {
    this.owners = owners;this.semVisual = semVisual;
    /** @type {any[]} */ this.fresh = [];
    this.stats = {frames: 0, delivered: 0, resets: 0, unknownTotal: 0};
    /** @type {Record<string, number>} */ this.unknownByResult = {};
    this.reset();this.stats.resets = 0;
  }
  /** Zera a identidade vista (novo Game, load, view.reset). Diagnóstico acumulado fica. */
  reset() {
    this.maxId = -Infinity;this.seenRaw = new WeakSet();this.epoch = undefined;this.fresh = [];
    /** @type {Map<string, any[]>} */ this.backlog = new Map();this.stats && this.stats.resets++;
  }
  /**
   * Uma vez por quadro. events = janela atual da simulação; epoch = objeto que muda quando o Game reinicia/carrega (game.world).
   * @param {any[]} events @param {{epoch?: any}} [o]
   * @returns {{fresh: any[], unknown: any[]}}
   */
  dispatch(events, {epoch = null} = {}) {
    this.stats.frames++;
    if (this.epoch !== undefined && epoch !== this.epoch) this.reset();
    this.epoch = epoch;
    let top = -Infinity;
    for (const e of events) if (Number.isFinite(e?.eventId) && e.eventId > top) top = e.eventId;
    if (top !== -Infinity && top < this.maxId) {this.reset();this.epoch = epoch;}   // eventId regrediu: Game novo sem troca de world (ex.: world null)
    const base = this.maxId, fresh = [], unknown = [];
    for (const e of events) {
      if (!e) continue;
      if (Number.isFinite(e.eventId)) {if (e.eventId <= base) continue;}
      else {if (this.seenRaw.has(e)) continue;this.seenRaw.add(e);}   // evento avulso sem eventId: identidade do objeto
      if (this.owners[e.result] || this.semVisual.has(e.result)) fresh.push(e);
      else {unknown.push(e);this.stats.unknownTotal++;this.unknownByResult[e.result] = (this.unknownByResult[e.result] ?? 0) + 1;}
    }
    if (top > this.maxId) this.maxId = top;
    this.stats.delivered += fresh.length;this.fresh = fresh;
    return {fresh, unknown};
  }
  /**
   * Eventos novos para um consumidor que só consome quando está pronto (cinemática fora da pausa, sólidos com dt > 0):
   * enquanto `ready` é falso acumula o `fresh` de cada quadro; quando volta entrega o acumulado + o deste quadro, uma única vez.
   * Chamar no máximo uma vez por quadro por chave, depois de dispatch().
   * @param {string} key @param {boolean} [ready]
   */
  take(key, ready = true) {
    const q = this.backlog.get(key);
    if (!ready) {if (this.fresh.length) this.backlog.set(key, (q ?? []).concat(this.fresh).slice(-MAX_BACKLOG));return NONE;}
    if (!q) return this.fresh;
    this.backlog.delete(key);return q.concat(this.fresh);
  }
  /** Contadores para o painel/telemetria: desconhecidos por resultado, quadros, eventos entregues e reinícios. */
  diagnostics() {
    return {unknown: {...this.unknownByResult}, unknownTotal: this.stats.unknownTotal, frames: this.stats.frames, delivered: this.stats.delivered, resets: this.stats.resets, deferred: Object.fromEntries([...this.backlog].map(([k, v]) => [k, v.length]))};
  }
}
