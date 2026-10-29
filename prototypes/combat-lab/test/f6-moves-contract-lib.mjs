// @ts-check
// F6 (Task 14) — Matriz executável dos Moves: para CADA Move do registro real (registerStandardMoves → listMoves) roda um cenário Game-based
// em 120 Hz com semente fixa e mede, passo a passo, se o Move passa pelos contratos compartilhados:
//   (a) evento de dano canônico (move, sourceKind, rawDamage, hpDamage, shieldAbsorbed, normal, position/contactPoint, displacementPolicy) e validateCombatEvent;
//   (b) HP/escudo só mudam por resolveDamage (livro damageLedger do resolvedor) e a soma dos eventos fecha com as transações do passo;
//   (c)/(estático) nenhum arquivo da simulação muta .hp/.shield.hp nem reimplementa guarda/estágio de Defesa fora da lista justificada;
//   (d) política de deslocamento declarada (impulse | force | displacement | none) por Move.
// Usado por test/f6-moves-contract.test.mjs (asserções) e por scripts/gen-matriz-moves-f6.mjs (docs/MATRIZ_MIGRACAO_MOVES_F6.md).
import {readdirSync, readFileSync, statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {arena, cmd, vec, HOLD, C} from './moves-new-helpers.mjs';
import {listMoves, getMove} from '../src/sim/moves.js';
import {usageOf} from '../src/sim/move-matrix.js';
import {validateCombatEvent} from '../src/sim/events/combat-event.js';
import {damageLedger} from '../src/sim/resolvers/damage-resolver.js';
import {moveParamGroups} from '../src/sim/moves/params-registry.js';
import {particleOwner} from '../src/view/vfx/dispatch.js';
import {MOVE_GROUP, MELEE_MOVES} from '../src/sim/move-hit-map.js';

export const LAB = fileURLToPath(new URL('..', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
export const REPO = LAB.replace(/\/prototypes\/combat-lab$/, '');
export const MATRIX_PATH = `${REPO}/docs/MATRIZ_MIGRACAO_MOVES_F6.md`;
export const POLICIES = ['impulse', 'force', 'displacement', 'none'];
const DAMAGE_RESULTS = new Set(['impact', 'partial', 'perfect', 'clash', 'footstool', 'wallSplat', 'destructibleSplat', 'statusTick']);
const HEAL_RESULTS = new Set(['healedHp', 'passiveHeal']);

/** Grupos do DOCX §13 (F6). Lunge e Riposte são corpo a corpo; o Tackle (ação base, fora do registro) entra como linha de referência. */
export const MOVE_GROUPS = Object.freeze({
  'contato corpo a corpo e counters': ['tackle', 'quick-attack', 'bullet-punch', 'guard-break', 'feint', 'riposte', 'lunge'],
  'projéteis, feixes e áreas': ['water-pulse', 'swift', 'psyshock', 'seed-bomb', 'air-slash', 'fire-spin', 'spikes', 'bounce'],
  'terreno, escudos e buff': ['sand-wave', 'emerging-stone', 'harden', 'second-wind', 'reflect'],
});
export const groupOf = (/** @type {string} */ id) => Object.entries(MOVE_GROUPS).find(([, ids]) => ids.includes(id))?.[0] ?? 'SEM GRUPO';

const held = (/** @type {number} */ slot) => HOLD(slot);
const lock = (/** @type {number} */ t) => ({target: t, locked: true});
/** Cenário genérico: o azul usa o Move do slot 0 (toque, carga ou marcador conforme usageOf) contra o vermelho parado a `dist` m à frente, com alvo travado. */
function generic(/** @type {string} */ id, dist = 3, ticks = 480) {
  return {
    id, how: `azul usa ${id} (${usageOf(getMove(id)).mode}) contra o vermelho parado a ${dist} m, alvo travado`, ticks, expect: 'damage',
    build: () => arena({equip: [id], positions: [vec(0, 0), vec(0, dist)]}),
    drive: (/** @type {number} */ t, /** @type {any} */ g) => {
      const u = usageOf(getMove(id));void g;
      return [t < u.hold ? cmd({skill: t === 0 ? 0 : null, skillHeld: held(0), ...lock(1)}) : cmd(lock(1)), cmd()];
    },
  };
}
/** Cenários dedicados (Moves que não causam dano sozinhos ou precisam de um agressor). `caster` = quem usa o Move; `aux` = Move auxiliar do outro lado. */
const DEDICATED = {
  reflect: {how: 'azul carrega Reflect 1,5 s; o vermelho dispara Swift travado no azul; as estrelas refletidas ferem o vermelho', ticks: 480, expect: 'damage', aux: {1: 'swift'},
    build: () => arena({equip: ['reflect'], equipRed: ['swift'], positions: [vec(0, -3), vec(0, 3)]}),
    drive: (/** @type {number} */ t) => [t < 180 ? cmd({skill: t === 0 ? 0 : null, skillHeld: held(0)}) : cmd(), t === 200 ? cmd({skill: 0, skillHeld: held(0), ...lock(0)}) : cmd(lock(0))],
    effect: (/** @type {any[]} */ ev) => ev.some(e => e.result === 'reflected')},
  harden: {how: 'azul usa Harden; 0,5 s depois o vermelho dá um Tackle nele (dano reduzido pelo status, sem knockback ofensivo)', ticks: 360, expect: 'effect', aux: {1: null},
    build: () => arena({equip: ['harden'], positions: [vec(0, 0), vec(0, 2)]}),
    drive: (/** @type {number} */ t) => [t === 0 ? cmd({skill: 0, skillHeld: held(0)}) : cmd(), cmd({tackle: t === 60, move: t >= 60 && t < 120 ? vec(0, -1) : vec(0, 0)})],
    effect: (/** @type {any[]} */ ev, /** @type {any} */ g, /** @type {any} */ seen) => seen.status.has('0:harden') && ev.some(e => e.target === 0 && e.hpDamage > 0)},
  'second-wind': {how: 'azul usa Second Wind (buff de stamina/mobilidade; sem dano)', ticks: 240, expect: 'effect',
    build: () => arena({equip: ['second-wind'], positions: [vec(0, 0), vec(0, 4)]}),
    drive: (/** @type {number} */ t) => [t === 0 ? cmd({skill: 0, skillHeld: held(0)}) : cmd(), cmd()],
    effect: (/** @type {any[]} */ ev, /** @type {any} */ g, /** @type {any} */ seen) => seen.status.has('0:second-wind')},
  spikes: {how: 'azul confirma o marcador do Spikes 3 m à frente; o vermelho anda até a armadilha e a aciona', ticks: 520, expect: 'damage',
    build: () => arena({equip: ['spikes'], positions: [vec(0, -4), vec(0, 6)], setup: () => {C.world.spikes.markerAccel = 0;}}),
    drive: (/** @type {number} */ t, /** @type {any} */ g) => {
      const blue = t === 0 ? cmd({skill: 0, skillHeld: held(0)}) : t <= 4 ? cmd({skillHeld: held(0)}) : cmd();
      if (t < 60) return [blue, cmd()];
      const r = g.fighters[1], dx = 0 - r.position.x, dz = -1 - r.position.z, l = Math.hypot(dx, dz);
      return [blue, cmd({move: l > .05 ? vec(dx / l, dz / l) : vec(0, 0)})];
    }},
  feint: {how: 'azul usa Feint sem ataque em curso: recuo curto com i-frames (sem dano)', ticks: 120, expect: 'effect',
    build: () => arena({equip: ['feint'], positions: [vec(0, 0), vec(0, 4)]}),
    drive: (/** @type {number} */ t) => [t === 0 ? cmd({skill: 0, skillHeld: held(0)}) : cmd(), cmd()],
    effect: (/** @type {any[]} */ ev, /** @type {any} */ g) => ev.some(e => e.result === 'feint') && g.fighters[0].position.z < -.2},
  riposte: {how: 'azul abre o Riposte; o vermelho (2 m) dispara 1 estrela do Swift dentro da janela; o contra-golpe acerta o vermelho', ticks: 200, expect: 'damage', aux: {1: 'swift'},
    build: () => arena({equip: ['riposte'], equipRed: ['swift'], positions: [vec(0, -1), vec(0, 1)], setup: () => {C.world.swift.count = 1;C.world.swift.fanAngle = 0;}}),
    drive: (/** @type {number} */ t) => [t === 0 ? cmd({skill: 0, skillHeld: held(0)}) : cmd(), t === 20 ? cmd({skill: 0, skillHeld: held(0)}) : cmd()],
    effect: (/** @type {any[]} */ ev) => ev.some(e => e.result === 'riposteStrike')},
};
/** Tackle (ação base, fora do registro): linha de referência do grupo corpo a corpo; seus eventos levam move null (contrato: null = Tackle/corpo). */
const TACKLE = {id: 'tackle', how: 'azul dá um Tackle (X) no vermelho parado a 2 m', ticks: 240, expect: 'damage', registry: false,
  build: () => arena({positions: [vec(0, 0), vec(0, 2)]}),
  drive: (/** @type {number} */ t) => [cmd({tackle: t === 0, move: t < 60 ? vec(0, 1) : vec(0, 0)}), cmd()]};

/** Ids do registro REAL, na ordem de registro (a lista não é escrita à mão). */
export function registryIds() {arena();return listMoves().map(d => d.id);}
export function scenarios() {
  const ids = registryIds();
  return [TACKLE, ...ids.map(id => DEDICATED[/** @type {keyof typeof DEDICATED} */ (id)] ? {id, registry: true, ...DEDICATED[/** @type {keyof typeof DEDICATED} */ (id)]} : {registry: true, ...generic(id)})];
}

const hpOf = (/** @type {any} */ f) => ({hp: f.hp, shield: f.shield?.hp ?? 0});
/**
 * Roda um cenário e devolve o rastro por passo: {events, ledger, before, after} — HP/escudo dos lutadores antes/depois e as transações do resolvedor.
 * @param {any} sc
 */
export function runScenario(sc) {
  const g = sc.build();
  const steps = [], seen = {status: new Set()};
  damageLedger.entries = [];
  try {
    for (let t = 0; t < sc.ticks; t++) {
      const [c0, c1] = sc.drive(t, g), before = g.fighters.map(hpOf), mark = damageLedger.entries.length;
      g.step(c0, c1);
      for (const f of g.fighters) for (const s of f.statuses ?? []) seen.status.add(`${f.id}:${s.id}`);
      steps.push({t, events: [...g.lastStepEvents], ledger: damageLedger.entries.slice(mark), before, after: g.fighters.map(hpOf)});
    }
  } finally {damageLedger.entries = null;}
  return {g, steps, seen, events: steps.flatMap(s => s.events)};
}

const fighterIds = (/** @type {any} */ g) => new Set(g.fighters.map((/** @type {any} */ f) => f.id));
/** Evento que carrega uma transação de dano em lutador (o que o contrato (a) cobre). */
export const isDamageEvent = (/** @type {any} */ e, /** @type {Set<number>} */ ids) => ids.has(e.target) && (e.rawDamage > 0 || e.hpDamage > 0 || e.shieldAbsorbed > 0);
/** Move esperado no evento de dano: o do cenário quando quem ataca é o lançador (azul; refletido conta para o refletor com o Move do projétil), o auxiliar do outro lado, null no Tackle. */
function expectedMoves(/** @type {any} */ sc, /** @type {any} */ e) {
  if (sc.id === 'tackle') return [null];
  if (sc.id === 'reflect') return e.attacker === 0 ? ['reflect', 'swift'] : ['swift'];   // estrela refletida segue sendo uma estrela do Swift (cor/tremor de hit do Swift), agora do refletor
  if (e.attacker === 0) return [sc.id];
  const aux = sc.aux?.[e.attacker];
  return aux === undefined ? [sc.id] : [aux];
}

/**
 * Verificações (a), (b) e (d) de um cenário. Devolve {violations: string[], row} — row alimenta a matriz.
 * @param {any} sc @param {ReturnType<typeof runScenario>} run
 */
export function checkScenario(sc, run) {
  const {g, steps, events, seen} = run, ids = fighterIds(g), v = /** @type {string[]} */ ([]);
  const dmg = events.filter(e => isDamageEvent(e, ids));
  // (a) contrato canônico do evento de dano
  for (const e of dmg) {
    const tag = `${sc.id} t${e.tick} ${e.result}#${e.eventId}`;
    for (const err of validateCombatEvent(e)) v.push(`${tag}: ${err}`);
    if (!('move' in e)) v.push(`${tag}: sem campo move`);
    if (!expectedMoves(sc, e).includes(e.move ?? null)) v.push(`${tag}: move ${JSON.stringify(e.move)} ≠ ${JSON.stringify(expectedMoves(sc, e))}`);
    for (const k of ['sourceKind', 'rawDamage', 'hpDamage', 'shieldAbsorbed']) if (e[k] === undefined) v.push(`${tag}: sem ${k}`);
    if (!e.normal) v.push(`${tag}: sem normal`);
    // posição do VFX: position (ponto do evento) | contactPoint (projétil em lutador) | corpo do alvo (CONTRATO_EVENTOS_VFX §6: acerto em lutador mantém position nula)
    const cp = e.contactPoint;
    if (cp && !(Number.isFinite(cp.x) && Number.isFinite(cp.y) && Number.isFinite(cp.z))) v.push(`${tag}: contactPoint inválido`);
    if (!e.position && !cp && !ids.has(e.targetId)) v.push(`${tag}: sem position/contactPoint e sem alvo lutador para ancorar o VFX`);
    // (d) política de deslocamento declarada
    if (e.result !== 'statusTick' && !POLICIES.includes(e.displacementPolicy)) v.push(`${tag}: displacementPolicy ${JSON.stringify(e.displacementPolicy)} fora de ${POLICIES.join('|')}`);
    const moved = e.launch && ((e.launch.horizontal ?? 0) > 1e-9 || (e.launch.vertical ?? 0) > 1e-9);
    if (moved && e.displacementPolicy === 'none') v.push(`${tag}: lançou (launch) mas declara displacementPolicy none`);
  }
  for (const e of events.filter(e => !isDamageEvent(e, ids) && e.displacementPolicy !== undefined && !POLICIES.includes(e.displacementPolicy))) v.push(`${sc.id} t${e.tick} ${e.result}: displacementPolicy inválida ${e.displacementPolicy}`);
  // (b) conservação: por passo e por lutador, ΔHP = −Σ transações do resolvedor (curas só com evento de cura); eventos fecham com as transações
  let transactions = 0;
  for (const s of steps) {
    transactions += s.ledger.length;
    const heal = s.events.some(e => HEAL_RESULTS.has(e.result));
    for (const f of g.fighters) {
      const L = s.ledger.filter((/** @type {any} */ x) => x.targetId === f.id), E = s.events.filter(e => e.target === f.id && isDamageEvent(e, ids));
      const lostHp = L.reduce((/** @type {number} */ a, /** @type {any} */ x) => a + (x.hpBefore - x.hpAfter), 0), lostShield = L.reduce((/** @type {number} */ a, /** @type {any} */ x) => a + (x.shieldBefore - x.shieldAfter), 0);
      const dHp = s.before[f.id].hp - s.after[f.id].hp, dSh = s.before[f.id].shield - s.after[f.id].shield;
      if (Math.abs(dHp - lostHp) > 1e-9 && !(heal && dHp < lostHp)) v.push(`${sc.id} t${s.t} lutador ${f.id}: HP caiu ${dHp}, resolvedor registrou ${lostHp} (HP mudou fora de resolveDamage)`);
      if (dSh > 1e-9 && Math.abs(dSh - lostShield) > 1e-9) v.push(`${sc.id} t${s.t} lutador ${f.id}: escudo caiu ${dSh}, resolvedor registrou ${lostShield}`);
      const sum = (/** @type {any[]} */ xs, /** @type {string} */ k) => xs.reduce((a, x) => a + (x[k] ?? 0), 0);
      for (const k of ['rawDamage', 'hpDamage', 'shieldAbsorbed']) if (Math.abs(sum(E, k) - sum(L, k)) > 1e-9) v.push(`${sc.id} t${s.t} lutador ${f.id}: Σ ${k} eventos ${sum(E, k)} ≠ resolvedor ${sum(L, k)}`);
      const nL = L.filter((/** @type {any} */ x) => x.rawDamage > 0).length, nE = E.filter(e => e.rawDamage > 0).length;
      if (nL !== nE) v.push(`${sc.id} t${s.t} lutador ${f.id}: ${nE} eventos com dano ≠ ${nL} transações com dano`);
    }
  }
  // efeito do cenário: Move de dano precisa causar dano a partir do lançador; os demais provam o efeito declarado
  const ownDmg = dmg.filter(e => e.attacker === 0);
  if (sc.expect === 'damage' && !ownDmg.length) v.push(`${sc.id}: o cenário não produziu dano do lançador`);
  if (sc.effect && !sc.effect(events, g, seen)) v.push(`${sc.id}: efeito declarado do cenário não aconteceu`);
  const policies = [...new Set(events.filter(e => e.attacker === 0 && e.displacementPolicy !== undefined && e.displacementPolicy !== 'none').map(e => `${e.displacementPolicy} (${e.result})`))];
  return {violations: v, row: {
    id: sc.id, registry: sc.registry !== false, group: groupOf(sc.id), how: sc.how,
    damagePath: ownDmg.length ? damagePathOf(ownDmg) : dmg.length ? `sem dano próprio; dano do agressor auxiliar: ${damagePathOf(dmg)}` : 'sem dano próprio', anchors: [...new Set(dmg.map(e => e.position ? 'position' : e.contactPoint ? 'contactPoint' : 'corpo do alvo'))], damageEvents: dmg.length, ownDamage: ownDmg.reduce((a, e) => a + e.hpDamage, 0), transactions,
    sourceKinds: [...new Set(dmg.map(e => e.sourceKind))], moves: [...new Set(dmg.map(e => e.move ?? null))],
    policies: policies.length ? policies : ['none'], results: [...new Set(events.filter(e => e.attacker === 0 || e.target === 0).map(e => e.result))],
    vfx: vfxOwnerOf(sc.id, events, g), params: paramsOf(sc.id), status: v.length ? 'FALHA' : 'ok',
  }};
}
/** Caminho do dano: contato declarado no evento (tackle → combat.resolveHit; projectile/area/trap/beam → world-hit.applyHit; bounce → efeito do Move) → resolveDamage. */
function damagePathOf(/** @type {any[]} */ ev) {
  const via = {tackle: 'combat.js resolveHit', clash: 'combat.js clash', footstool: 'combat.js footstool', projectile: 'world-hit.js applyHit', area: 'world-hit.js applyHit', trap: 'world-hit.js applyHit', beam: 'world-hit.js applyHit', bounce: 'world-hit.js applyHit (bounce.js)'};
  const c = [...new Set(ev.map(e => e.contact ?? '?'))];
  return c.map(k => `${k} → ${/** @type {any} */ (via)[k] ?? 'efeito do Move'} → resolveDamage`).join('; ');
}
/** Dono do VFX: módulo migrado (moves-vfx-registry), renderizador da entidade (quarks elemental/atelier ou world-view) e dono das partículas de cada resultado (OWNERS via particleOwner, modo padrão). */
function vfxOwnerOf(/** @type {string} */ id, /** @type {any[]} */ events, /** @type {any} */ g) {
  void g;
  const reg = readFileSync(`${LAB}/src/view/moves-vfx-registry.js`, 'utf8'), migrated = [...reg.matchAll(/this\.register\('([a-z-]+)'/g)].map(m => m[1]);
  const elem = readFileSync(`${LAB}/src/view/quarks/elemental-game.js`, 'utf8').match(/const MOVES = \{([^}]+)\}/)?.[1] ?? '';
  const elemGroups = [...elem.matchAll(/:\s*'([a-zA-Z]+)'/g)].map(m => m[1]);
  const atelier = [...(readFileSync(`${LAB}/src/view/quarks/atelier-game.js`, 'utf8').match(/return m === '([a-z-]+)' \|\| m === '([a-z-]+)'/) ?? [])].slice(1);
  const owner = migrated.includes(id) ? `movesVfx (src/sim/moves/${id}/${id}.vfx.js)` : atelier.includes(id) ? 'atelier-game (voleio quarks) + world-view'
    : elemGroups.includes(/** @type {any} */ (MOVE_GROUP)[id]) ? 'elemental-game (quarks) + world-view' : id === 'tackle' || MELEE_MOVES.has(id) ? 'personagem (corpo a corpo, sem entidade)' : 'world-view / compartilhado';
  const hits = [...new Set(events.filter(e => e.attacker === 0 && particleOwner(e.result)).map(e => `${e.result}→${particleOwner(e.result)}`))];
  return `${owner}${hits.length ? `; partículas ${hits.join(', ')}` : ''}`;
}
/** Parâmetros do editor (ficha): quantidade de linhas do grupo do Move. A cobertura de consumidor por parâmetro fica para a Task 15. */
function paramsOf(/** @type {string} */ id) {
  const grp = moveParamGroups().find(x => /** @type {any} */ (x).id === id || x.group === /** @type {any} */ (MOVE_GROUP)[id]);
  return grp ? grp.rows.length : 0;
}

// ---------- (b)/(c) verificação estática ----------
const walk = (/** @type {string} */ dir) => readdirSync(dir).flatMap(/** @returns {string[]} */ f => {const p = `${dir}/${f}`;return statSync(p).isDirectory() ? walk(p) : p.endsWith('.js') ? [p] : [];});
/**
 * Mutação direta de HP/escudo de qualquer objeto: `.hp =`, `.hp -=`/`+=`/`*=`/`/=`/`%=`/`**=`, `.hp ??=`/`||=`/`&&=`, `.hp--`, `--x.hp` (prefixo),
 * `.shield.hp …`, `['hp'] =`, troca do objeto inteiro `.shield = {` e `Object.assign(…hp|shield…)` (F9: brechas apontadas na revisão da F6).
 */
export const HP_WRITE = /\.hp\s*(?:(?:[-+*/%]|\*\*|\?\?|\|\||&&)?=(?!=)|--|\+\+)|(?:--|\+\+)\s*[\w$.]*\.hp\b|\[['"]hp['"]\]\s*(?:[-+*/%]|\?\?|\|\||&&)?=(?!=)|\.shield\s*=\s*\{|Object\.assign\([^)]*\b(?:hp|shield)\b/;
export const DEFENSE_MATH = /guardDamageMultiplier|stageDefenseReduction/;
/**
 * Lista EXPLÍCITA do que pode escrever HP/escudo fora de src/sim/resolvers/ — cada entrada com o motivo. Uma linha nova que escreva HP fora daqui
 * reprova o teste; uma entrada que não casa mais com nada também (a lista não pode ficar frouxa).
 */
export const HP_WRITE_ALLOW = Object.freeze([
  {file: 'src/sim/map/map-consumables.js', match: /fighter\.hp \+= amount|fighter\.hp = maxHp/, why: 'cura do consumível (Poção): ganho de HP, não dano'},
  {file: 'src/sim/map/map-consumables.js', match: /fighter\.shield\.hp = Math\.min\(maxCap/, why: 'concessão do escudo do consumível (applyShield)'},
  {file: 'src/sim/map/map-consumables.js', match: /fighter\.shield\.hp = 0;/, why: 'expiração do escudo por tempo (tickShield), não dano'},
  {file: 'src/sim/passive-engine.js', match: /owner\.hp = Math\.min\(owner\.attributes\.hp, owner\.hp \+ p\.heal\)/, why: 'cura de passiva (heal), não dano'},
  {file: 'src/sim/status.js', match: /if \(heal\) f\.hp = Math\.min\(f\.attributes\.hp, f\.hp \+ heal\)/, why: 'cura periódica de status, não dano (o dano periódico vai por resolveDamage)'},
  {file: 'src/sim/map/map-damage.js', match: /destructible\.hp = Math\.max\(0, destructible\.hp - /, why: 'HP de destrutível (entidade do mapa), não de lutador'},
  {file: 'src/sim/map/map-step.js', match: /d\.hp = d\.maxHp/, why: 'renascimento de destrutível'},
  {file: 'src/sim/stone.js', match: /d\.hp = 0/, why: 'destrutível destruído pela Emerging Stone (entidade do mapa)'},
  {file: 'src/sim/world.js', match: /b\.hp -= p\.hit\?\.damage/, why: 'HP de barreira (entidade do mundo) atingida por projétil'},
  {file: 'src/sim/scenarios-collision.js', match: /\.hp = 30/, why: 'montagem do estado inicial de cenário técnico (não roda na partida)'},
  {file: 'src/sim/scenarios-map.js', match: /\.hp = /, why: 'montagem do estado inicial de cenário técnico (não roda na partida)'},
  {file: 'src/sim/scenarios-map.js', match: /\.shield = \{hp: \d+, duration: [\d.]+, maxHp: 80\};/, why: 'escudo inicial montado no cenário técnico (não roda na partida); pego pela varredura endurecida da F9'},
  {file: 'src/sim/scenarios-passives.js', match: /\.hp = /, why: 'montagem do estado inicial de cenário técnico (não roda na partida)'},
]);
/** Leitura de guardDamageMultiplier/stageDefenseReduction fora do resolvedor — cada entrada justificada (nenhuma recalcula o dano do golpe). */
export const DEFENSE_MATH_ALLOW = Object.freeze([
  {file: 'src/sim/config.js', match: /guardDamageMultiplier: \.5/, why: 'valor de fábrica (config)'},
  {file: 'src/sim/map/map-config.js', match: /stageDefenseReduction: 0\.10/, why: 'valor de fábrica (config do mapa)'},
  {file: 'src/sim/combat.js', match: /const defStageKnockbackMult = /, why: 'estágio de Defesa reduz o KNOCKBACK do Tackle (R6.11) — reação, não dano; o dano já saiu do resolvedor'},
  {file: 'src/sim/moves/move-mechanics-audit.js', match: /path: 'extras\.combat\.guardDamageMultiplier'/, why: 'catálogo da auditoria (texto do caminho do parâmetro)'},
  {file: 'src/sim/scenarios-tackle.js', match: /guardDamageMultiplier/, why: 'oráculo do cenário técnico (valor esperado), não aplica dano'},
  {file: 'src/sim/scenarios.js', match: /guardDamageMultiplier/, why: 'oráculo do cenário técnico (valor esperado), não aplica dano'},
]);
/** Varre src/sim inteiro (fora de resolvers/) atrás de `re`; devolve {fora: linhas sem justificativa, ociosas: entradas da lista sem uso}. */
export function staticScan(/** @type {RegExp} */ re, /** @type {readonly {file: string, match: RegExp, why: string}[]} */ allow) {
  const used = new Set(), fora = [];
  for (const abs of walk(`${LAB}/src/sim`)) {
    const file = abs.slice(LAB.length + 1);
    if (file.startsWith('src/sim/resolvers/')) continue;
    for (const [i, line] of readFileSync(abs, 'utf8').split('\n').entries()) {
      if (!re.test(line) || /^\s*(\/\/|\*)/.test(line)) continue;
      const hit = allow.find(a => a.file === file && a.match.test(line));
      if (hit) used.add(hit);else fora.push(`${file}:${i + 1}: ${line.trim().slice(0, 160)}`);
    }
  }
  return {fora, ociosas: allow.filter(a => !used.has(a)).map(a => `${a.file} ${a.match}`)};
}

// ---------- matriz (docs/MATRIZ_MIGRACAO_MOVES_F6.md) ----------
export function buildMatrix() {
  const rows = scenarios().map(sc => checkScenario(sc, runScenario(sc)).row);
  const hp = staticScan(HP_WRITE, HP_WRITE_ALLOW), def = staticScan(DEFENSE_MATH, DEFENSE_MATH_ALLOW);
  const reg = rows.filter(r => r.registry);
  const cell = (/** @type {any} */ s) => String(s).replace(/\|/g, '\\|');
  const out = [
    '# Matriz de migração dos Moves (F6)', '',
    '> GERADO por `scripts/gen-matriz-moves-f6.mjs` a partir de `prototypes/combat-lab/test/f6-moves-contract-lib.mjs` (cenários reais em 120 Hz, semente fixa).',
    '> Não edite à mão: o teste `prototypes/combat-lab/test/f6-moves-contract.test.mjs` falha se este arquivo estiver desatualizado. Regere com `node scripts/gen-matriz-moves-f6.mjs`.', '',
    `Moves no registro: **${reg.length}** (lidos de \`listMoves()\` depois de \`registerStandardMoves()\`; lista em \`docs/INDICE_VIVO_MOVES.md\`) + Tackle (ação base) como referência do grupo corpo a corpo.`, '',
    'O que cada linha prova (cenário executado, não declaração):', '',
    '- **(a) evento canônico** — todo evento de dano em lutador tem `move`, `sourceKind`, `rawDamage`, `hpDamage`, `shieldAbsorbed`, `normal`, âncora do VFX (`position`, `contactPoint` ou o corpo do alvo, `docs/CONTRATO_EVENTOS_VFX.md` §6) e passa em `validateCombatEvent`;',
    '- **(b) conservação** — por passo e por lutador, a queda de HP/escudo é exatamente a soma das transações de `resolveDamage` (livro `damageLedger`) e a soma de `rawDamage/hpDamage/shieldAbsorbed` dos eventos fecha com elas;',
    '- **(c) sem escudo/defesa próprios** — nenhum arquivo de `src/sim` fora de `resolvers/` escreve HP/escudo nem lê `guardDamageMultiplier`/`stageDefenseReduction` sem entrada justificada (tabelas no fim);',
    '- **(d) deslocamento declarado** — todo evento de dano declara `displacementPolicy` (`impulse` | `force` | `displacement` | `none`) e lançamento nunca vem com `none`.', '',
    'Grupos do DOCX §13. «Parâmetros» = linhas da ficha no editor; a cobertura de consumidor por parâmetro (presente, persistido, A/B visível e consumido pelo Move real) é a Task 15 (F7).', '',
  ];
  for (const [grp, ids] of Object.entries(MOVE_GROUPS)) {
    out.push(`## ${grp[0].toUpperCase()}${grp.slice(1)}`, '', '| Move | Cenário | Caminho do dano | Deslocamento (policy) | Eventos do lançador | VFX (dono) | Parâmetros | Consumidores (Task 15) | Status |', '|---|---|---|---|---|---|---|---|---|');
    for (const id of ids) {
      const r = rows.find(x => x.id === id);if (!r) {out.push(`| \`${id}\` | — | — | — | — | — | — | — | NÃO REGISTRADO |`);continue;}
      const dano = r.damageEvents ? `${r.damagePath} (${r.damageEvents} evento(s), ${r.transactions} transação(ões); sourceKind ${r.sourceKinds.join('/')}; move ${r.moves.map(m => m === null ? 'null' : m).join('/')}; âncora ${r.anchors.join('/')})` : `${r.damagePath} (${r.transactions} transação(ões))`;
      out.push(`| \`${r.id}\`${r.registry ? '' : ' (ação base)'} | ${cell(r.how)} | ${cell(dano)} | ${cell(r.policies.join(', '))} | ${cell(r.results.join(', '))} | ${cell(r.vfx)} | ${r.params} | pendente (Task 15) | ${r.status} |`);
    }
    out.push('');
  }
  const extra = reg.filter(r => r.group === 'SEM GRUPO');
  if (extra.length) out.push('## Sem grupo no DOCX §13', '', ...extra.map(r => `- \`${r.id}\` — ${r.status}`), '');
  out.push('## Escrita de HP/escudo fora de `resolvers/` (lista justificada)', '', '| Arquivo | Trecho | Motivo |', '|---|---|---|',
    ...HP_WRITE_ALLOW.map(a => `| \`prototypes/combat-lab/${a.file}\` | \`${cell(a.match.source)}\` | ${a.why} |`), '',
    hp.fora.length ? `**Fora da lista (defeito):** ${hp.fora.join('; ')}` : 'Nenhuma escrita fora da lista.', '',
    '## Guarda/estágio de Defesa fora do resolvedor (lista justificada)', '', '| Arquivo | Trecho | Motivo |', '|---|---|---|',
    ...DEFENSE_MATH_ALLOW.map(a => `| \`prototypes/combat-lab/${a.file}\` | \`${cell(a.match.source)}\` | ${a.why} |`), '',
    def.fora.length ? `**Fora da lista (defeito):** ${def.fora.join('; ')}` : 'Nenhuma leitura fora da lista.', '');
  return out.join('\n');
}
