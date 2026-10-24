// Aba Moves: equipar Reflect e Psyshock, ajustar os parâmetros (valem só para os PRÓXIMOS usos, M28.4), emitir projéteis e explosões de teste
// na partida e rodar os cenários técnicos repetíveis (M28.3, M28.8). Valores marcados “provisório” são pontos de partida (M30.10), não decisões.
import {C, defaults, factoryDefaults} from '../sim/config.js';
import {spawn} from '../sim/world.js';
import {listMoves, getMove} from '../sim/moves.js';
import {runMoveScenarios} from '../sim/scenarios-moves.js';
import {moveParamGroups} from '../sim/moves/params-registry.js';
import {createMoveSpecPanel} from './move-spec-panel.js';
import {buildMoveTimeline, measureMoveRun, TICK_RATE, clipFrameAtTick} from '../sim/move-timeline.js';
import {compareMoveVariants} from '../sim/move-ab.js';
import {SHAKE_GROUPS} from '../sim/move-hit-map.js';
/** Escapa texto para HTML (local: importar o ajustador arrastaria o config.ts do jogo, que só o esbuild lê). */
const escape = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

const STANDARD = [['reflect', 'Reflect', 0], ['psyshock', 'Psyshock', 1]];
/** Informações de interface por move (o que o registro não traz): grupo de parâmetros e texto de apoio. Moves novos funcionam sem entrada aqui. */
export const MOVE_INFO = {
  reflect: {group: 'Reflect', hint: 'Barreira refletora frontal. Segure para carregar, solte para criar.'},
  psyshock: {group: 'Psyshock', hint: 'Pedras psíquicas com homing. Segure para carregar, solte para disparar.'},
};
const SKILL_NAMES = ['skill1', 'skill2', 'skill3', 'skill4'];
const ACTION_NAMES = {forward: 'Mover ↑', back: 'Mover ↓', left: 'Mover ←', right: 'Mover →', tackle: 'Tackle (X)', dodge: 'Esquiva (C)', defend: 'Defesa (D)', lock: 'Travar alvo', pause: 'Pausar', restart: 'Reiniciar', debug: 'Depuração'};
const keyName = code => String(code ?? '?').replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, 'Num ').replace('Arrow', 'Seta ').replace('Space', 'Espaço').replace('Escape', 'Esc');
const yesno = v => v ? '1 · sim' : '0 · não';
const ms2 = v => `${v.toFixed(2)} m/s²`, sec = v => `${v.toFixed(2)} s`, pct = v => `${(v * 100).toFixed(0)}%`, num = v => v.toFixed(2), m = v => `${v.toFixed(2)} m`, deg = v => `${v.toFixed(0)}°`, ms = v => `${v.toFixed(2)} m/s`, x = v => `${v.toFixed(2)}×`, int = v => v.toFixed(0);
/** [grupo em C.world, chave, rótulo, descrição, min, max, passo, formato, aprovado?] — “aprovado” = valor decidido pelo diretor; o resto é provisório (M30.10). */
const PARAMS = [
  ['Carga (compartilhada)', [
    ['charge', 'moveSlow', 'Velocidade durante a carga', 'Fração da velocidade de caminhada enquanto carrega (M2.6).', .2, 1, .01, pct, true],
    ['charge', 'turnSlow', 'Giro durante a carga', 'Fração da velocidade de giro enquanto carrega (M11.7).', .2, 1, .01, pct, true],
    ['charge', 'dodgeCancelAfter', 'Esquiva cancela a carga após', 'Antes disso a esquiva é negada e a soltura dispara (M16.2).', 0, 1, .01, sec, true],
    ['charge', 'interruptCooldownFactor', 'Recarga após interrupção ou cancelamento', 'Fração da recarga normal aplicada quando a carga é interrompida (M7.3).', 0, 1, .01, pct, true],
    ['charge', 'recovery', 'Recuperação após soltar', 'Tempo sem Tackle nem novos Moves depois de materializar/disparar (M26s.8).', 0, 1, .01, sec, true],
    ['charge', 'bufferWindow', 'Comando guardado no fim da esquiva', 'Janela em que um Move pedido durante a esquiva fica guardado (M16.3).', 0, .5, .01, sec, true],
    ['charge', 'boostStaminaPerSecond', 'Custo da recarga acelerada', 'Stamina gasta por segundo de recarga encurtado por novo toque (M5.8).', 0, 3, .05, num, true],
    ['charge', 'boostStep', 'Recarga encurtada por toque', 'Segundos de recarga removidos por novo toque (M5.8).', .25, 4, .25, sec, true],
  ]],
  ['IA com Moves (decisões do adversário)', [
    ['ai', 'newMovesRate', 'Uso dos Moves novos pela IA', 'Multiplica a chance de a IA usar Harden, Second Wind, Swift, Lunge, Quick Attack, Guard Break, Feint, Riposte, Bounce, Spikes, Sand Wave, Bullet Punch e Emerging Stone quando equipados nela (0 = nunca usa; só vale para o que estiver equipado).', 0, 3, .1, x, false],
    ['ai', 'evadeDistance', 'Esquiva emergencial: distância do Tackle rival', 'Durante a carga, se o rival inicia um Tackle a menos desta distância, a IA esquiva cancelando a carga (provisório).', 0, 10, .1, m, false],
    ['ai', 'pl2Distance', 'Psyshock: distância para carregar até PL2', 'A partir desta distância do alvo a IA segura o Psyshock até o PL2 (provisório).', 0, 15, .1, m, false],
    ['ai', 'pl3Distance', 'Psyshock: distância para carregar até PL3', 'A partir desta distância do alvo a IA segura o Psyshock até o PL3 (provisório).', 0, 20, .1, m, false],
    ['ai', 'reflectHold', 'Reflect: tempo mínimo segurando', 'Tempo mínimo que a IA segura o Reflect antes de soltar (provisório).', .5, 4, .05, sec, false],
    ['ai', 'lastSecondDefend', 'Defesa em cima da hora (janela)', 'Se um projétil chega em menos que isto, a IA solta a carga e defende (provisório).', 0, 1, .01, sec, false],
    ['ai', 'noTimeDefend', 'Defesa sem tempo para o PL (janela)', 'Sem tempo de carregar um Reflect de PL suficiente, a IA defende se o projétil chega em menos que isto (provisório).', 0, 1, .01, sec, false],
    ['ai', 'barrierBreakRange', 'Barreira rival: alcance para destruir com Tackle', 'A IA tenta destruir a barreira do adversário com Tackle a menos desta distância (provisório).', 0, 8, .1, m, false],
    ['ai', 'barrierBreakChance', 'Barreira rival: chance de tentar', 'Probabilidade de a IA investir contra a barreira quando está ao alcance (provisório).', 0, 1, .01, pct, false],
    ['ai', 'psyshockMinDistance', 'Psyshock ofensivo: distância mínima', 'A IA só usa o Psyshock acima desta distância do alvo (provisório).', 0, 12, .1, m, false],
    ['ai', 'psyshockMinStamina', 'Psyshock ofensivo: stamina mínima', 'Stamina mínima para a IA iniciar o Psyshock (provisório).', 0, 6, .1, num, false],
    ['ai', 'psyshockChanceMax', 'Psyshock ofensivo: chance máxima por decisão', 'Teto da probabilidade de usar o Psyshock quando é viável (provisório).', 0, 1, .01, pct, false],
    ['ai', 'afterChargeWait', 'Pausa depois de uma carga', 'Tempo que a IA espera depois de soltar ou perder uma carga antes de decidir de novo (provisório).', 0, 3, .05, sec, false],
    ['ai', 'decisionInterval', 'Intervalo entre decisões de Move', 'Tempo mínimo entre duas decisões de Move da IA (provisório).', .1, 3, .05, sec, false],
  ]],
  ['Laser (emissor técnico)', [
    ['beam', 'length', 'Alcance do feixe', 'Comprimento total somando os segmentos refletidos (provisório).', 4, 40, 1, m, false],
    ['beam', 'maxSegments', 'Segmentos máximos', 'Salvaguarda contra reflexões em cadeia (M17.2); acima disso o feixe para e avisa uma vez.', 1, 16, 1, int, false],
    ['beam', 'interval', 'Intervalo entre danos', 'Tempo entre dois danos do feixe no mesmo alvo (provisório).', .05, 1, .05, sec, false],
    ['beam', 'damage', 'Dano por acerto', 'Dano de cada acerto do emissor técnico, antes do Ataque (provisório).', 0, 20, .5, num, false],
  ]],
];

/** Controles da aba (exportado para os testes de cobertura: cada parâmetro da configuração dos Moves precisa de slider). */
// Pedido de 22/10/2026: o limite máximo dos sliders de Moves vale o DOBRO (liga/desliga e seletores de poucos valores ficam como estão).
// Pedido de 23/10/2026: todo knockback (horizontal e vertical) vai de 0 a 15 em TODOS os Moves que causam dano; estes sliders não dobram.
/** Chaves de knockback/lançamento: limite fixo de 15. */
export const KNOCKBACK_KEY = /^(knockbackH|knockbackV|knockback|knockbackPl\d|knockbackPerStone|knockbackVertical|knockbackCap|blastKnockback|blastKnockbackV|burstForce|burstVertical|launchH|launchV)$/;
export const KNOCKBACK_MAX = 15;
// Moves em FICHA (um arquivo por Move em src/sim/moves/): título, texto de apoio e sliders vêm da própria ficha, sem tabela aqui.
const FORMATTERS = {num, int, sec, pct, m, ms, ms2, deg, x, yesno};
for (const g of moveParamGroups()) {
  MOVE_INFO[g.id] = {group: g.title, hint: g.hint ?? '', meta: g.meta};
  PARAMS.push([g.title, g.rows.map(r => [g.group, r.key, r.label, r.tip, r.min, r.max, r.step, FORMATTERS[r.unit], !!r.approved])]);
}
for (const [, rows] of PARAMS) for (const r of rows) {
  if (KNOCKBACK_KEY.test(r[1])) r[5] = KNOCKBACK_MAX;
  else if (r[7] !== yesno && !(r[6] >= 1 && r[5] <= 3)) r[5] *= 2;
}
// Tremor de câmera ao acertar (pedido de 23/10/2026): Moves que NÃO são corpo a corpo não tremem por padrão; o interruptor libera a intensidade e a duração (valem sobre o tremor padrão de hit).
const SHAKE_TITLES = {reflect: 'Reflect', psyshock: 'Psyshock', swift: 'Swift', emergingStone: 'Emerging Stone', sandWave: 'Sand Wave', spikes: 'Spikes', waterPulse: 'Water Pulse', fireSpin: 'Fire Spin', airSlash: 'Air Slash', seedBomb: 'Seed Bomb'};
for (const g of SHAKE_GROUPS) if (!PARAMS.find(([t]) => t === SHAKE_TITLES[g])[1].some(r => r[1] === 'hitShakeOn')) PARAMS.find(([t]) => t === SHAKE_TITLES[g])[1].push(   // Moves em ficha trazem as próprias linhas (hitShakeRows)
  [g, 'hitShakeOn', 'Tremor de câmera ao acertar', 'Desligado (padrão): este Move não treme a câmera ao acertar. Ligado: libera a intensidade e a duração do tremor. Só aparência.', 0, 1, 1, yesno, false],
  [g, 'hitShakeAmount', 'Tremor ao acertar: intensidade', 'Multiplica o tremor de hit padrão (1 = igual ao do Tackle). Só aparência.', 0, 6, .05, x, false],
  [g, 'hitShakeDuration', 'Tremor ao acertar: duração', 'Multiplica a duração do tremor de hit padrão (1 = igual ao do Tackle). Só aparência.', .1, 5, .05, x, false],
);
export const MOVES_PARAMS = PARAMS;
const VISUAL_WORLD_KEYS = new Set([
  'psyshock.scaleMin','psyshock.scaleMax',
  'quickAttack.fxLines','quickAttack.fxHideBody',
  'riposte.blastOn','riposte.blastSize','riposte.fxOn','riposte.fxIntensity','riposte.fxSize',
  'emergingStone.fxTrailOn','emergingStone.fxTrailSize',
  'bulletPunch.fxLines','bulletPunch.fxHideBody',
  'sandWave.dissipate',
  'airSlash.visualWidth','airSlash.visualHeight','airSlash.visualThickness',
  'seedBomb.blastLife',
  ...SHAKE_GROUPS.flatMap(g => [`${g}.hitShakeOn`, `${g}.hitShakeAmount`, `${g}.hitShakeDuration`]),
]);
/** Sliders que só aparecem quando o interruptor indicado está ligado (chave do dependente → chave do interruptor, no mesmo grupo). */
export const DEPENDS_ON = Object.freeze({
  'bulletPunch.knockbackH': 'knockbackOwn', 'bulletPunch.knockbackV': 'knockbackOwn',
  ...Object.fromEntries(SHAKE_GROUPS.flatMap(g => [[`${g}.hitShakeAmount`, 'hitShakeOn'], [`${g}.hitShakeDuration`, 'hitShakeOn']])),
});
export const isVisualWorldParam = row => VISUAL_WORLD_KEYS.has(`${row[0]}.${row[1]}`);

/**
 * Subgrupos da aba Mecânica (pedido de 23/10/2026): cada parâmetro vai para o primeiro subgrupo cujo padrão casar com a chave; o que sobrar fica em “Outros”.
 * `ONLY` fixa subgrupos de chaves ambíguas (grupo.chave) quando a regra geral erra.
 */
export const MECH_SUBS = [
  ['Custo e recarga', /^(cost|cooldown)$/],
  ['Carga', /^(maxCharge|minCharge|minStones|maxStones|stoneSeconds)$/],
  ['Tempos e duração', /^(cast|castSlow|recovery|startup|duration|durationBase|life|lifetime|flightTime|vanish|active|dissipate|riseTime|armDelay|landRecovery|approachMax|returnMax|chainAfter|hitStart|hitEnd|cancelAfter|cancelWindow|windowStart|windowEnd|invulnStart|invulnEnd|invulnerableSeconds|retreat|homingSeconds|slow|blastLife|interval|chargeRecovery)$/],
    ['Knockback', /^(knockback\w*|blastKnockback\w*|burstForce|burstVertical|burstPush|launchH|launchV|accel|partialFactor|impactMult)$/],
  ['Dano e efeitos de acerto', /^(damage\w*|burstDamage|burstHurt|successiveFactor|counterStagger|stun|guardStun|tackleStagger|tackleRecoil|wallStagger|blind|visionRadius|fogDarkness|rockHp|hitstopMult|shakeMult|regenPctPerSecond|mobilityCostPct|defensePct|negateKnockback)$/],
  ['Alcance e área', /^(range|minRange|reach|strikeReach|strikeRange|acquireRange|airReach|maxDistance|radius|seedRadius|zoneRadius|zoneHeight|explosionRadius|blastRadius|burstRadius|landRadius|contactRadius|hitRadius|stopShort|length|width|trapHeight|width\w*|height\w*|thickness|gapFraction|rockScale|rockSearch|scale\w*|searchRange|searchStep|detour|cell|occlusion|stopShort)$/],
  ['Marcador de mira', /^(marker\w*|startDistance|maxRise|edgeMargin|allowOccupied)$/],
  ['Projétil e disparo', /^(speed|speedMin|speedMax|maxSpeed|gravity|count|fanAngle|spawn\w*|originHeight|homingRate|arc|ring\w*|spacing|maxActive|maxRocks|maxReflections|tieTolerance|replanSteps|fx\w*|blast\w*)$/],
];
const ONLY = {'reflect.minCharge': 'Carga', 'fireSpin.life': 'Pulsos de dano', 'fireSpin.interval': 'Pulsos de dano', 'fireSpin.startup': 'Pulsos de dano'};
/** Ordem de exibição dos subgrupos. */
export const SUB_ORDER = ['Custo e recarga', 'Carga', 'Tempos e duração', 'Pulsos de dano', 'Dano e efeitos de acerto', 'Knockback', 'Alcance e área', 'Marcador de mira', 'Projétil e disparo', 'Outros'];
export const subOfParam = (group, key) => ONLY[`${group}.${key}`] ?? MECH_SUBS.find(([, re]) => re.test(key))?.[0] ?? 'Outros';

/** Itens da avaliação jogável e visual dos Moves (M28.9: separada dos testes automáticos; decisão do diretor). */
export const MOVES_HOMOLOG = [
  'Reflect: segurar A carrega e a prévia (verde/vermelha) mostra onde a barreira nasce; soltar cria a barreira',
  'Reflect: o tamanho cresce com a carga e a duração (4 a 8 s) é legível; o piscar de fim de vida avisa a expiração',
  'Reflect: reflete projéteis pela frente e pelas bordas, deixa passar pelo verso, e a cor mostra o PL',
  'Reflect: o Tackle destrói a barreira com recuo e stagger; a explosão destrói e protege quem está atrás',
  'Psyshock: segurar S forma as pedras (3 + 1 a cada 0,8 s) e soltar dispara todas juntas',
  'Psyshock: com alvo travado as pedras miram partes diferentes do corpo; sem alvo saem em leque',
  'Carga: a lentidão de 25%, o cancelamento por defesa/esquiva e a recuperação de 0,25 s têm boa sensação',
  'HUD dos slots: o estado (pronto, carregando, recarga, recuperação, bloqueado) é claro e confiável',
  'IA: usa Reflect e Psyshock de forma convincente e sem trapacear',
  'Visual e VFX: anéis de impacto, cores de PL e avisos de falha são suficientes (ou o que falta)',
];
const HOMOLOG_KEY = 'arenamon-moves-homolog';
const loadHomolog = () => {try {return JSON.parse(localStorage.getItem(HOMOLOG_KEY) ?? '{}');} catch {return {};}};
const saveHomolog = h => {try {localStorage.setItem(HOMOLOG_KEY, JSON.stringify(h));} catch {/* sem armazenamento: a avaliação vale só nesta sessão */}};

export function createMovesPanel({$, game, download, tuning, view, ui, canvas, startMatch, visual, nav = {}, presetValues = null}) {
  const root = $('moves-panel');
  const tabOf = new Map(), fireOpts = {hold: .4, auto: false};
  const specPanel = createMoveSpecPanel({download});
  let fireTimer = 0;
  let results = null, homolog = loadHomolog(), subscribed = false;
  const loadoutOf = id => Array.from({length: C.world.slots}, (_, i) => game.fighters[id]?.loadout?.[i] ?? null);
  const equipped = id => ({reflect: loadoutOf(id).includes('reflect'), psyshock: loadoutOf(id).includes('psyshock')});
  /** Descrição e uso do Move para dicas e linha de apoio: texto do Move, custo, recarga e botão. */
  const moveTip = (mid, key) => {const d = mid ? listMoves().find(m => m.id === mid) : null;if (!d) return '';const eff = getMove(mid) ?? d;return `${MOVE_INFO[mid]?.hint ?? d.description ?? ''} Custo ${(eff.cost ?? 1).toFixed(2)} de stamina · recarga ${(eff.cooldown ?? 0).toFixed(1)} s${key ? ` · botão ${key}` : ''}.`;};
  const moveLabel = mid => MOVE_INFO[mid]?.group ?? listMoves().find(m => m.id === mid)?.name ?? mid;
  /** Põe (ou tira, com null) um move num slot; um move não ocupa dois slots do mesmo lutador. */
  function setSlot(id, slot, moveId) {
    const list = loadoutOf(id);if (moveId) for (let i = 0; i < list.length; i++) if (list[i] === moveId) list[i] = null;
    list[slot] = moveId || null;game.setLoadout(id, list);
  }
  /** Compatível com o formato antigo: liga/desliga um move no primeiro slot livre (preferindo o slot clássico). Devolve false se não houver slot. */
  function setEquip(id, kind, on) {
    const list = loadoutOf(id), at = list.indexOf(kind);
    if (!on) {if (at >= 0) {list[at] = null;game.setLoadout(id, list);}return true;}
    if (at >= 0) return true;
    const pref = STANDARD.find(([k]) => k === kind)?.[2], slot = pref != null && !list[pref] ? pref : list.findIndex(v => !v);
    if (slot < 0) return false;
    list[slot] = kind;game.setLoadout(id, list);return true;
  }
  function emitProjectile(pl) {
    if (game.phase !== 'playing') return false;
    const [b, r] = game.fighters, dx = b.position.x - r.position.x, dz = b.position.z - r.position.z, d = Math.hypot(dx, dz) || 1;
    spawn(game.world, {kind: 'projectile', owner: 1, pos: {x: r.position.x + dx / d * .9, z: r.position.z + dz / d * .9}, dir: {x: dx / d, z: dz / d}, speed: 12, y: .7, radius: .2, life: 4, pierce: 1, pl, clashable: true,
      hit: {damage: C.world.psyshock.damageFraction * r.attributes.attack, knockback: {horizontal: C.world.psyshock.knockbackPerStone, vertical: 0}}, captured: {attackFraction: C.world.psyshock.damageFraction, counterStagger: C.world.psyshock.counterStagger}}, game.lastStepEvents);
    return true;
  }
  /** Laser técnico do vermelho rumo ao azul (PL 1–3); `turn` (rad/s) faz o emissor varrer a arena. Vive 4 s. */
  function emitLaser(pl, turn = 0) {
    if (game.phase !== 'playing') return false;
    const [b, r] = game.fighters, dx = b.position.x - r.position.x, dz = b.position.z - r.position.z, d = Math.hypot(dx, dz) || 1;
    spawn(game.world, {kind: 'beam', owner: 1, pos: {x: r.position.x + dx / d * .7, z: r.position.z + dz / d * .7}, dir: {x: dx / d, z: dz / d}, life: 4, pl, turn, length: C.world.beam.length, maxSegments: C.world.beam.maxSegments, interval: C.world.beam.interval, hit: {damage: C.world.beam.damage}}, game.lastStepEvents);
    return true;
  }
  /** Cenários de reflexão e neutralização em tempo real na simulação ativa */
  function testLaserScene(kind) {
    if (game.phase !== 'playing') game.startMatch?.('center');
    if (kind === 'reflect') {
      spawn(game.world, {kind: 'wall', reflect: true, owner: 0, pos: {x: 0, z: 0}, height: 2.2, hx: 2.5, hz: 0.1, angle: 0, life: 8, age: 0, pl: 1}, game.lastStepEvents);
      spawn(game.world, {kind: 'beam', owner: 1, pos: {x: 0, z: 5}, dir: {x: 0, z: -1}, life: 4, pl: 1, length: 24, maxSegments: 8, interval: 0.25, hit: {damage: 2}}, game.lastStepEvents);
    } else if (kind === 'neutralize') {
      spawn(game.world, {kind: 'wall', reflect: true, owner: 0, pos: {x: 0, z: 0}, height: 2.2, hx: 2.5, hz: 0.1, angle: 0, life: 8, age: 0, pl: 1}, game.lastStepEvents);
      spawn(game.world, {kind: 'beam', owner: 1, pos: {x: 0, z: 5}, dir: {x: 0, z: -1}, life: 4, pl: 3, length: 24, maxSegments: 8, interval: 0.25, hit: {damage: 2}}, game.lastStepEvents);
    }
    return true;
  }
  function emitExplosion() {
    if (game.phase !== 'playing') return false;
    spawn(game.world, {kind: 'area', explosion: true, owner: 1, affectsOwner: true, pos: {x: 0, z: 0}, radius: 4, y: 0, height: 3, life: .25, pulses: 1, falloff: 'linear', pl: 2, hit: {damage: 10, knockback: {horizontal: 5, vertical: 4}}}, game.lastStepEvents);
    return true;
  }
  function paramRow([group, key, label, tip, min, max, step, fmt, approved]) {
    const v = C.world[group][key], def = defaults().world[group][key], sw = DEPENDS_ON[`${group}.${key}`], hidden = sw && !C.world[group][sw];
    return `<div class="mvp-param" ${hidden ? 'hidden' : ''} data-dep="${sw ? `${group}.${sw}` : ''}" title="${escape(tip)}"><label>${escape(label)} <small class="${approved ? 'ok' : 'warn'}">${approved ? 'aprovado' : 'provisório'}</small></label>
      <div class="row">${min === 0 && max === 1 && step === 1 ? `<input type="checkbox" data-p="${group}.${key}" ${v ? 'checked' : ''}>` : `<input type="range" data-p="${group}.${key}" min="${min}" max="${max}" step="${step}" value="${v}">`}<output data-o="${group}.${key}">${fmt(v)}</output><button type="button" data-reset="${group}.${key}" title="Padrão: ${escape(fmt(def))}" ${v === def ? 'disabled' : ''}>↺</button></div></div>`;
  }
  /** Cartão de animação (carga com loop + disparo) de um move para o personagem de um lado (0 azul, 1 vermelho). */
  function animCard(moveId, who, showSliders = true) {
    const ch = ui?.characters?.[who], who_ = who ? 'Vermelho' : 'Azul';
    if (!ch) return `<div class="moves-anim-card"><small class="muted">${who_}: nenhum modelo GLB carregado. Carregue em <b>Personagens</b> para associar as animações deste move.</small></div>`;
    const conf = ch.getMoveAnimConfig(moveId), key = `${who}|${moveId}`;
    const chargeClip = conf.chargeClip != null ? ch.clips[conf.chargeClip] : null, chargeDur = chargeClip?.duration || 1.0;
    const loopEnd = Math.min(chargeDur, Math.max(0.02, conf.chargeLoopEnd ?? chargeDur)), loopStart = Math.min(Math.max(0, conf.chargeLoopStart || 0), Math.max(0, loopEnd - 0.02));
    const clipOptions = (selectedIdx, placeholder) => `<option value="">${placeholder}</option>` + ch.clips.map((c, i) => `<option value="${i}" ${i === selectedIdx ? 'selected' : ''}>${escape(c.name)} (${c.duration.toFixed(2)}s)</option>`).join('');
    const isPreviewing = ch.movePreview?.moveId === moveId;
    return `<div class="moves-anim-card" data-card="${key}">
      <div class="moves-anim-card-head"><div><h4>${who_} · animação e loop</h4></div>
        <button type="button" class="btn-preview-move ${isPreviewing ? 'active' : ''}" data-preview="${key}">${isPreviewing ? '⏹ Parar teste' : '▶ Testar carga (com loop) ➔ disparo'}</button></div>
      <div class="moves-anim-grid">
        <div class="moves-anim-col"><label>1. Animação de carga (segurar a tecla)</label>
          <select data-anim-select="charge" data-key="${key}">${clipOptions(conf.chargeClip, '— selecionar animação de carga —')}</select>
          ${showSliders ? `<div class="moves-loop-slider-box">
            <label>Início do loop <output data-loop-out="${key}|start">${loopStart.toFixed(2)} s</output></label>
            <input type="range" data-loop-range="${key}" data-loop-edge="start" min="0" max="${Math.max(0, loopEnd - 0.02).toFixed(2)}" step="0.01" value="${loopStart.toFixed(2)}" ${chargeClip ? '' : 'disabled'}>
            <label>Fim do loop <output data-loop-out="${key}|end">${loopEnd.toFixed(2)} s</output></label>
            <input type="range" data-loop-range="${key}" data-loop-edge="end" min="${Math.min(chargeDur, loopStart + 0.02).toFixed(2)}" max="${chargeDur.toFixed(2)}" step="0.01" value="${loopEnd.toFixed(2)}" ${chargeClip ? '' : 'disabled'}>
            <div class="move-loop-timeline" data-loop-timeline="${key}">
              <div class="loop-intro" style="flex:${Math.max(0.001, loopStart)}" title="Introdução: 0,00 s a ${loopStart.toFixed(2)} s">${loopStart > 0.15 ? `Intro (${loopStart.toFixed(2)}s)` : ''}</div>
              <div class="loop-repeat" style="flex:${Math.max(0.001, loopEnd - loopStart)}" title="Trecho repetido: ${loopStart.toFixed(2)} s a ${loopEnd.toFixed(2)} s">🔁 Loop (${(loopEnd - loopStart).toFixed(2)}s)</div>
              <div class="loop-tail" style="flex:${Math.max(0.001, chargeDur - loopEnd)}" title="Depois do loop: ${loopEnd.toFixed(2)} s a ${chargeDur.toFixed(2)} s">${chargeDur - loopEnd > 0.15 ? 'Final' : ''}</div>
            </div>
          </div>` : ''}</div>
        <div class="moves-anim-col"><label>2. Animação de disparo (ao soltar a tecla)</label>
          <select data-anim-select="release" data-key="${key}">${clipOptions(conf.releaseClip, '— selecionar animação de disparo —')}</select>
          <p class="hint">Dispara ao soltar, com blend suave a partir da pose de carga, sem esperar o clipe de carga terminar.</p></div>
      </div></div>`;
  }

  /** Slots (até C.world.slots) de um lutador: move e botão de cada um. */
  function loadoutBox(id, title) {
    const list = loadoutOf(id), moves = listMoves(), bind = id ? C.extras.bindings2 : C.extras.bindings, codes = C.extras.keyCodes;
    const used = Object.entries(bind).filter(([k]) => !SKILL_NAMES.includes(k));
    const count = list.filter(Boolean).length;
    const rows = list.map((cur, slot) => {
      const myKey = bind[SKILL_NAMES[slot]], clash = used.find(([, i]) => i === myKey) ?? SKILL_NAMES.map((n, j) => [n, bind[n], j]).find(([, i, j]) => j !== slot && i === myKey && list[j]);
      const warn = cur && clash ? `<small class="warn" title="A mesma tecla também é ${escape(ACTION_NAMES[clash[0]] ?? 'outro slot')}">tecla repetida</small>` : '';
      return `<div class="mv-slot" data-slot-row="${id}.${slot}"><span class="mv-slot-n">Slot ${slot + 1}</span>
        <select data-slot-move="${id}.${slot}" aria-label="Move do slot ${slot + 1} (${escape(title)})" ${cur ? `data-tip-title="${escape(moveLabel(cur))}" data-tip="${escape(moveTip(cur, keyName(codes[myKey])))}"` : 'data-tip-title="Slot vazio" data-tip="Escolha um Move: passe o mouse sobre o nome para ver a descrição e o uso."'}><option value="">— vazio —</option>${moves.map(m => `<option value="${m.id}" title="${escape(moveTip(m.id, ''))}" ${m.id === cur ? 'selected' : ''} ${list.includes(m.id) && m.id !== cur ? 'disabled' : ''}>${escape(moveLabel(m.id))}</option>`).join('')}</select>
        <label class="mv-key">Botão <select data-slot-key="${id}.${slot}" aria-label="Botão do slot ${slot + 1} (${escape(title)})">${codes.map((c, i) => `<option value="${i}" ${i === myKey ? 'selected' : ''}>${escape(keyName(c))}</option>`).join('')}</select></label>${warn}</div>${cur ? `<p class="tip-line">${escape(moveTip(cur, keyName(codes[myKey])))}</p>` : ''}`;
    }).join('');
    return `<div class="mv-loadout" data-loadout="${id}"><h4>${escape(title)} <small class="muted">${count} de ${list.length} slots${id ? ' · botões só valem no controle manual do vermelho' : ''}</small></h4>${rows}</div>`;
  }

  /** Garante o Move num slot do azul (primeiro livre) para poder testá-lo ou animá-lo. */
  function ensureEquipped(id) {
    if (loadoutOf(0).includes(id) || loadoutOf(1).includes(id)) return true;
    const slot = loadoutOf(0).findIndex(v => !v);if (slot < 0) return false;
    setSlot(0, slot, id);nav.refreshActions?.();return true;
  }
  /** Dispara o Move no azul com a tecla real do slot (segura `hold` s): vale a mesma regra de custo, recarga e cast de uma partida. */
  function fire(id) {
    if (!ensureEquipped(id) && !loadoutOf(0).includes(id)) {setSlot(0, 0, id);nav.refreshActions?.();}   // sem slot livre, o Move toma o slot 1
    if (game.phase !== 'playing') startMatch?.();
    const slot = loadoutOf(0).indexOf(id), code = C.extras.keyCodes[C.extras.bindings[SKILL_NAMES[slot]]];
    if (slot < 0 || !canvas) return;
    canvas.focus?.();canvas.dispatchEvent(new KeyboardEvent('keydown', {code, bubbles: true, cancelable: true}));
    setTimeout(() => canvas.dispatchEvent(new KeyboardEvent('keyup', {code, bubbles: true})), Math.max(40, fireOpts.hold * 1000));
    lastFired = id;
  }
  let lastFired = null;
  function focusMove(id, tab = 'mec') {
    tabOf.set(id, tab);render();
    const d = root.querySelector(`details.mv-move[data-move="${id}"]`);if (!d) return;
    d.open = true;d.scrollIntoView?.({block: 'start', behavior: 'smooth'});
  }
  function focusAction(id) {
    const d = $('act-moves').querySelector(`details[data-action-move="${id}"]`);if (!d) return;
    d.open = true;d.scrollIntoView?.({block: 'start', behavior: 'smooth'});
  }

  /** Ações conserva a equipagem e as animações; os controles numéricos ficam nas abas à esquerda. */
  function renderActions(container) {
    if (!container) return;
    const openMoves = new Set([...container.querySelectorAll('details[open][data-action-move]')].map(d => d.dataset.actionMove));
    const equipped = [...new Set([...loadoutOf(0), ...loadoutOf(1)].filter(Boolean))];
    container.innerHTML = `<h2 class="act-title">✦ Moves</h2>
      <p class="hint">Equipe Moves, escolha os botões e as animações (carga, loop e disparo) aqui. Parâmetros mecânicos e visuais ficam na aba Moves à esquerda.</p>
      <section class="act-card"><h3>Equipar</h3>${loadoutBox(0, 'Jogador (azul)')}${loadoutBox(1, 'Adversário (vermelho)')}</section>
      ${equipped.map(mid => `<details class="act-card" data-action-move="${mid}" ${openMoves.has(mid) ? 'open' : ''}><summary><b>${escape(moveLabel(mid))}</b></summary><div class="mv-actions"><button type="button" data-goto-params="${mid}" title="Abre os sliders de mecânica deste Move na aba Moves">⚙ Parâmetros ↗</button><button type="button" data-goto-vfx="${mid}" title="Abre os controles visuais deste Move na aba Moves">◈ Visual ↗</button></div>${[0, 1].filter(w => loadoutOf(w).includes(mid)).map(w => animCard(mid, w)).join('')}</details>`).join('')}`;
    for (const b of container.querySelectorAll('[data-goto-params]')) b.onclick = () => nav.openParams?.(b.dataset.gotoParams, 'mec');
    for (const b of container.querySelectorAll('[data-goto-vfx]')) b.onclick = () => nav.openParams?.(b.dataset.gotoVfx, 'vis');
    for (const sel of container.querySelectorAll('[data-slot-move]')) sel.onchange = () => {
      const [id, slot] = sel.dataset.slotMove.split('.').map(Number);
      setSlot(id, slot, sel.value || null);
      renderActions(container);
      render();
    };
    for (const sel of container.querySelectorAll('[data-slot-key]')) sel.onchange = () => {
      const [id, slot] = sel.dataset.slotKey.split('.').map(Number);
      const path = `extras.${id ? 'bindings2' : 'bindings'}.${SKILL_NAMES[slot]}`;
      if (tuning) tuning.commit([[path, Number(sel.value)]], `Botão do slot ${slot + 1}`);
      else C.extras[id ? 'bindings2' : 'bindings'][SKILL_NAMES[slot]] = Number(sel.value);
      renderActions(container);
      render();
    };
    for (const sel of container.querySelectorAll('[data-anim-select]')) sel.onchange = () => {
      const [who, moveId] = sel.dataset.key.split('|');
      ui?.characters?.[Number(who)]?.setMoveAnim(moveId, sel.dataset.animSelect, sel.value === '' ? null : Number(sel.value));
      renderActions(container);
      render();
    };
    const chOf = key => ui?.characters?.[Number(key.split('|')[0])], moveOf = key => key.split('|')[1];
    for (const inp of container.querySelectorAll('[data-loop-range]')) inp.oninput = () => {
      const key = inp.dataset.loopRange, ch = chOf(key), moveId = moveOf(key);if (!ch) return;
      const conf0 = ch.getMoveAnimConfig(moveId), chargeClip = conf0.chargeClip != null ? ch.clips[conf0.chargeClip] : null, chargeDur = chargeClip?.duration || 1.0;
      if (inp.dataset.loopEdge === 'start') ch.setMoveChargeLoopStart(moveId, Number(inp.value));else ch.setMoveChargeLoopEnd(moveId, Number(inp.value));
      const conf = ch.getMoveAnimConfig(moveId), start = conf.chargeLoopStart || 0, end = conf.chargeLoopEnd ?? chargeDur;
      const st = container.querySelector(`[data-loop-range="${key}"][data-loop-edge="start"]`), en = container.querySelector(`[data-loop-range="${key}"][data-loop-edge="end"]`);
      st.max = Math.max(0, end - 0.02).toFixed(2);en.min = Math.min(chargeDur, start + 0.02).toFixed(2);st.value = start.toFixed(2);en.value = end.toFixed(2);
      container.querySelector(`[data-loop-out="${key}|start"]`).textContent = `${start.toFixed(2)} s`;container.querySelector(`[data-loop-out="${key}|end"]`).textContent = `${end.toFixed(2)} s`;
      const tl = container.querySelector(`[data-loop-timeline="${key}"]`), intro = tl?.querySelector('.loop-intro'), rep = tl?.querySelector('.loop-repeat'), tail = tl?.querySelector('.loop-tail');
      if (intro) {intro.style.flex = String(Math.max(0.001, start));intro.textContent = start > 0.15 ? `Intro (${start.toFixed(2)}s)` : '';}
      if (rep) {rep.style.flex = String(Math.max(0.001, end - start));rep.textContent = `🔁 Loop (${(end - start).toFixed(2)}s)`;}
      if (tail) {tail.style.flex = String(Math.max(0.001, chargeDur - end));tail.textContent = chargeDur - end > 0.15 ? 'Final' : '';}
    };
    for (const button of container.querySelectorAll('[data-preview]')) button.onclick = () => {
      const [who, moveId] = button.dataset.preview.split('|'), ch = ui?.characters?.[Number(who)];
      if (!ch) return;
      if (ch.movePreview?.moveId === moveId) ch.stopMovePreview();
      else ch.startMovePreview(moveId, () => renderActions(container));
      renderActions(container);
    };
  }

  /** Comparador A/B do Move: A = valores atuais; B = padrão de fábrica ou um preset. Mesmo cenário, semente e entradas. */
  function abMarkup(mid) {
    const m = getMove(mid);
    if (!m?.group) return '';
    const opts = presetValues ? presetValues.options() : [];
    return `<details class="mv-ab" data-k="ab:${mid}"><summary>⚖ Comparar variantes (A/B)</summary>
      <p class="hint">Roda o Move no mesmo cenário (semente 7, rival a 4 m, mesmas entradas) com dois conjuntos de valores. <b>A</b> = valores atuais; <b>B</b> escolhido abaixo. Mede dano, stamina, recarga, entidades e o primeiro tick em que as duas execuções se separam. Não mede FPS nem render.</p>
      <div class="row"><label class="field">B<select data-ab-b="${mid}"><option value="__factory">Padrão de fábrica do Move</option>${opts.map(([v, t]) => `<option value="${escape(v)}">${escape(t)}</option>`).join('')}</select></label><button type="button" data-ab-run="${mid}">▶ Comparar A × B</button></div>
      <div class="report" data-ab-result="${mid}" aria-live="polite"></div></details>`;
  }
  /** Barra da linha do tempo em ticks de 120 Hz (definição + sliders); "Medir no motor" roda o Move de verdade e compara as marcas. */
  function timelineMarkup(mid) {
    const tl = buildMoveTimeline(mid);
    if (!tl || tl.totalTicks <= 0) return '<p class="hint">Este Move não tem duração fixa (Charge): a linha do tempo vale depois de soltar.</p>';
    const pct = t => `${(Math.min(tl.totalTicks, Math.max(0, t)) / tl.totalTicks * 100).toFixed(2)}%`;
    const spans = tl.spans.filter(sp => sp.kind !== 'cast').map(sp => `<i class="mv-tl-span ${sp.kind}" style="left:${pct(sp.from)};width:${(Math.max(0, sp.to - sp.from) / tl.totalTicks * 100).toFixed(2)}%" title="${escape(sp.label)}: tick ${sp.from} a ${sp.to}"></i>`).join('');
    const marks = tl.marks.map(k => `<b class="mv-tl-mark ${k.kind}" style="left:${pct(k.tick)}" title="${escape(k.label)} · tick ${k.tick} (${(k.tick / TICK_RATE).toFixed(3)} s)"></b>`).join('');
    return `<p class="hint">Ticks de ${TICK_RATE} Hz (passo fixo da simulação), não frames de animação. Fonte: ${escape(tl.source)}. Mude os sliders da Mecânica e a barra acompanha.</p>
      <div class="mv-tl" data-tl="${mid}" data-tl-total="${tl.totalTicks}"><div class="mv-tl-bar">${spans}${marks}</div><div class="mv-tl-scale"><span>0</span><span>${Math.round(tl.totalTicks / 2)}</span><span>${tl.totalTicks} ticks</span></div>
        ${['vfx', 'camera'].map(d => `<div class="mv-tl-lane" title="${d === 'vfx' ? 'VFX: disparados pelos eventos da simulação (tick)' : 'Câmera: tremor de hit (tick)'}"><em>${d === 'vfx' ? 'VFX' : 'Câmera'}</em>${tl.cues.filter(c => c.domain === d && c.tick !== null).map(c => `<b class="mv-tl-mark cue-${d}" style="left:${pct(c.tick)}" title="${escape(c.label)} · tick ${c.tick}"></b>`).join('')}</div>`).join('')}
        <div class="mv-tl-lane" title="Animação: o relógio é o do clipe (quadros), não o tick"><em>Animação</em>${tl.cues.filter(c => c.domain === 'animation' && c.tick !== null).map(c => `<i class="mv-tl-clip" style="left:${pct(c.tick)};width:${(100 - Number(pct(c.tick).slice(0, -1))).toFixed(2)}%" title="${escape(c.label)}"></i>`).join('')}</div></div>
      <ul class="mv-tl-list">${tl.marks.map(k => `<li><code>tick ${k.tick}</code> · ${(k.tick / TICK_RATE).toFixed(3)} s · ${escape(k.label)} <button type="button" class="mv-tl-seek" data-tl-seek="${mid}:${k.tick}" title="Pausa o replay da partida no momento em que este Move foi usado por último, neste tick da marca">⏸ pausar aqui</button></li>`).join('')}</ul>
      <p class="hint">VFX, câmera e animação (os dois primeiros seguem o tick; a animação segue o clipe).
        <label class="field">Quadros do clipe <input type="number" min="2" max="600" step="1" value="30" data-tl-clipframes="${mid}" title="Quantos quadros tem o clipe de animação deste Move (para converter tick em quadro; padrão 30)"></label></p>
      <ul class="mv-tl-list">${tl.cues.map(c => `<li><span class="mv-tl-dom ${c.domain}">${c.domain === 'vfx' ? 'VFX' : c.domain === 'camera' ? 'Câmera' : 'Animação'}</span> ${c.tick === null ? '<code>no acerto / durante a carga</code>' : `<code>${c.clock === 'animation' ? 'quadro ' : 'tick '}${c.clock === 'animation' ? `<span data-tl-frame="${c.tick}">0</span>` : c.tick}</code>`} · ${escape(c.label)}${c.tick !== null && c.clock === 'tick' ? ` <button type="button" class="mv-tl-seek" data-tl-seek="${mid}:${c.tick}" title="Pausa o replay neste tick">⏸ pausar aqui</button>` : ''}</li>`).join('')}${tl.marks.filter(k => ['spawn', 'effect', 'status', 'hit'].includes(k.kind)).map(k => `<li><span class="mv-tl-dom animation">Animação</span> <code>tick ${k.tick} → quadro <span data-tl-frame="${k.tick}">0</span></code> · onde o clipe está quando acontece «${escape(k.label)}»</li>`).join('')}</ul>
      <div class="mv-actions"><button type="button" data-tl-measure="${mid}" title="Usa o Move numa partida isolada e mede quando a ação começa, as entidades nascem e a ação termina">⏱ Medir no motor</button></div><div class="report" data-tl-result="${mid}" aria-live="polite"></div>`;
  }
  /** Etiqueta da ficha: categoria · tipos · PL, com os quatro status de governança na dica (proposto / aprovado / implementado / homologado). */
  function metaBadge(meta) {
    if (!meta) return '';
    const st = meta.status;
    const tip = `Proposto ${st.proposto ? '✓' : '✗'} · Aprovado ${st.aprovado ? '✓' : '✗'} · Implementado ${st.implementado ? '✓' : '✗'} · Homologado ${st.homologado ? '✓' : '✗'}`;
    return `<small class="mv-badge" title="${escape(tip)}">${escape(meta.category)} · ${escape(meta.types.join('+'))} · ${escape(meta.pl)}${st.homologado ? ' · homologado' : st.aprovado ? ' · aprovado' : ' · proposto'}</small>`;
  }
  function paramGroup(title, open = false) {
    const g = PARAMS.find(([t]) => t === title);if (!g) return '';
    const rows = g[1].filter(row => !isVisualWorldParam(row));
    const grouped = rows.length > 5 && !rows.some(r => ['charge', 'ai', 'beam'].includes(r[0]));
    if (!grouped) return `<details data-k="p:${escape(title)}" ${open ? 'open' : ''}><summary><b>${escape(title)}</b></summary>${rows.map(paramRow).join('')}</details>`;
    const subs = new Map();
    for (const r of rows) {const k = subOfParam(r[0], r[1]);if (!subs.has(k)) subs.set(k, []);subs.get(k).push(r);}
    const body = [...subs.entries()].sort((a, b) => SUB_ORDER.indexOf(a[0]) - SUB_ORDER.indexOf(b[0])).map(([name, list]) => `<details class="mv-sub" data-k="psub:${escape(title)}:${escape(name)}" data-sub-default="open" open><summary>${escape(name)} <small class="muted">${list.length}</small></summary>${list.map(paramRow).join('')}</details>`).join('');
    return `<details data-k="p:${escape(title)}" ${open ? 'open' : ''}><summary><b>${escape(title)}</b></summary>${body}</details>`;
  }

  /** Liga os controles de parâmetros (data-p) de um escopo: arrastar mostra o valor ao vivo e, ao soltar, entra UMA entrada no histórico do ajustador (Ctrl+Z / Ctrl+Y). */
  function bindParams(scope, rerender) {
    const before = new Map(), label = path => PARAMS.flatMap(p => p[1]).find(r => r[0] + '.' + r[1] === path)?.[2] ?? path;
    const show = (inp, v) => {const [g, k] = inp.dataset.p.split('.'), spec = PARAMS.flatMap(p => p[1]).find(r => r[0] === g && r[1] === k);scope.querySelector(`[data-o="${inp.dataset.p}"]`).textContent = spec[7](v);scope.querySelector(`[data-reset="${inp.dataset.p}"]`).disabled = v === defaults().world[g][k];};
    const commit = (changes, text) => tuning ? tuning.commit(changes, text) : changes.forEach(([p, , v]) => {const [g, k] = p.replace(/^world\./, '').split('.');C.world[g][k] = v;});
    for (const inp of scope.querySelectorAll('[data-p]')) {
      const [g, k] = inp.dataset.p.split('.'), path = `world.${g}.${k}`;
      if (inp.type === 'checkbox') {inp.onchange = () => {commit([[path, inp.checked ? 1 : 0]], label(inp.dataset.p));rerender();};continue;}
      inp.oninput = () => {const v = Number(inp.value);if (!before.has(path)) before.set(path, C.world[g][k]);C.world[g][k] = v;show(inp, v);};
      inp.onchange = () => {const after = C.world[g][k], was = before.get(path);before.delete(path);if (was !== undefined && was !== after) {C.world[g][k] = was;commit([[path, after]], label(inp.dataset.p));}rerender();};
    }
    for (const b of scope.querySelectorAll('[data-reset]')) b.onclick = () => {const [g, k] = b.dataset.reset.split('.');commit([[`world.${g}.${k}`, defaults().world[g][k]]], 'Restaurar ' + label(b.dataset.reset));rerender();};
  }
  /** Parâmetros da IA com Moves, para a aba IA da gaveta de Ações (antes ficavam na aba Moves). */
  function renderAiParams(container) {
    container.innerHTML = paramGroup('IA com Moves (decisões do adversário)', true);
    bindParams(container, () => renderAiParams(container));
  }
  function render() {
    const closedSubs = new Set([...root.querySelectorAll('details.mv-sub[data-k]:not([open])')].map(d => d.dataset.k));   // subgrupos nascem abertos; só ficam fechados os que você fechou
    const openKeys = new Set([...root.querySelectorAll('details[open][data-k]')].map(d => d.dataset.k));   // a interface não recolhe os grupos que você abriu
    const l0 = loadoutOf(0), l1 = loadoutOf(1), eqIds = listMoves().map(m => m.id);
    const scen = results ? results.map(s => `<details data-k="s:${s.id}" ${s.ok ? '' : 'open'}><summary class="${s.ok ? 'ok' : 'warn'}">${s.ok ? '✓' : '✗'} ${escape(s.name)}</summary><table><tr><th>Verificação</th><th>Esperado</th><th>Obtido</th></tr>${s.rows.map(r => `<tr class="${r.ok ? 'ok' : 'warn'}"><td>${r.ok ? '✓' : '✗'} ${escape(r.what)}</td><td>${escape(r.expected)}</td><td>${escape(r.got)}</td></tr>`).join('')}</table></details>`).join('') : '<p class="hint">Cada cenário roda num duelo isolado, com semente fixa e os ajustes atuais, e compara esperado × obtido.</p>';
    const cards = eqIds.map(mid => {
      const info = MOVE_INFO[mid], owners = [[0, l0], [1, l1]].filter(([, l]) => l.includes(mid)).map(([w, l]) => `${w ? 'Vermelho' : 'Azul'}: slot ${l.indexOf(mid) + 1}${w ? '' : ` · botão ${escape(keyName(C.extras.keyCodes[C.extras.bindings[SKILL_NAMES[l.indexOf(mid)]]]))}`}`).join(' · ');
      const tab = tabOf.get(mid) ?? 'mec', pane = (k, html) => `<div class="mv-pane" data-pane="${k}" ${tab === k ? '' : 'hidden'}>${html}</div>`;
      return `<details class="mv-move" data-move="${mid}" data-k="move:${mid}"><summary><b>✦ ${escape(moveLabel(mid))}</b>${metaBadge(info?.meta)}<small class="muted">${owners || 'Não equipado'}</small></summary>
        <div class="mv-actions"><button type="button" data-fire="${mid}" title="Dispara este Move no azul contra o vermelho, com a tecla real do slot">▶ Disparar</button><button type="button" data-goto-actions="${mid}" title="Abre Ações → Moves neste Move (equipagem, botão e animações)">🎞 Equipar / animar ↗</button></div>
        <div class="mv-tabs" role="tablist">${[['mec', 'Mecânica'], ['vis', 'Visual (VFX)'], ['anim', 'Animação'], ['time', 'Linha do tempo']].map(([k, t]) => `<button type="button" role="tab" data-mvtab="${mid}|${k}" aria-pressed="${tab === k}">${t}</button>`).join('')}</div>
        ${pane('mec', `${info?.hint ? `<p class="hint">${escape(info.hint)}</p>` : ''}${info ? paramGroup(info.group) : '<p class="hint">Este move ainda não tem parâmetros mecânicos ajustáveis nesta tela.</p>'}${abMarkup(mid)}`)}
        ${pane('vis', visual.markup(mid))}
        ${pane('time', timelineMarkup(mid))}
        ${pane('anim', '<p class="hint">As animações de carga, loop e disparo ficam em Ações, junto da equipagem e dos botões.</p><div class="mv-actions"><button type="button" data-goto-actions="' + mid + '">🎞 Abrir animações deste Move ↗</button></div>')}</details>`;
    }).join('');
    const shared = eqIds.length ? `<section class="mv-move" data-move="_charge"><header><h3>⚙ Carga (todos os moves equipados)</h3></header>${paramGroup('Carga (compartilhada)')}</section>` : '';
    root.innerHTML = `
      <p class="hint">Cada Move tem um cartão com <b>Mecânica</b>, <b>Visual (VFX)</b> e <b>Animação</b>, e o botão <b>▶ Disparar</b> para testar na hora. Equipagem, botões e animações ficam em <b>⚔ Ações → Moves</b>. Os valores entram no JSON de Exportar.</p>
      <div class="row"><button type="button" id="mvp-export-params">↓ Exportar parâmetros e VFX dos Moves (JSON)</button></div>
      <div class="mv-fire-opts"><label>Segurar a tecla (s) <input type="range" id="mv-hold" min="0" max="2" step=".05" value="${fireOpts.hold}"><output id="mv-hold-out">${fireOpts.hold.toFixed(2)} s</output></label><label><input type="checkbox" id="mv-auto" ${fireOpts.auto ? 'checked' : ''}> Redisparar ao soltar um slider</label></div>
      ${specPanel.markup()}
      ${visual.globalMarkup()}${cards}${shared}
      <details class="mv-tools" data-k="tools"><summary><b>Ferramentas de teste</b> <small class="muted">emissores, laser, cenários técnicos, estilo dos efeitos e avaliação</small></summary>
      <h3>Emissores técnicos & Laser (Simulação Física Real)</h3>
      <div class="row"><button type="button" data-emit="1">Projétil hostil PL1</button><button type="button" data-emit="2">PL2</button><button type="button" data-emit="3">PL3</button><button type="button" data-emit="boom">Explosão no centro (PL2)</button></div>
      <div class="row">
        <b>Laser real:</b>
        <button type="button" data-laser="1">Laser Real PL1 (Ciano)</button>
        <button type="button" data-laser="2">Laser Real PL2 (Dourado)</button>
        <button type="button" data-laser="3">Laser Real PL3 (Magenta)</button>
        <button type="button" data-laser="sweep">Laser Giratório (Sweep)</button>
      </div>
      <div class="row" style="margin-top:6px;">
        <b>Cenários de Laser Real:</b>
        <button type="button" data-laser-scene="reflect">▶ Testar Reflexão: Laser PL1 × Reflect</button>
        <button type="button" data-laser-scene="neutralize">▶ Testar Neutralização: Laser PL3 × Reflect PL1</button>
      </div>
      <p class="hint">Os feixes acima são gerados na simulação ativa (física real, dano, colisões, reflexão em barreiras e neutralização), consumidos em tempo real pelo novo BeamRenderer com exclusão mútua do renderizador legado.</p>
      <h3>Cenários técnicos</h3>
      <div class="row"><button type="button" id="mvp-run">▶ Executar todos</button><button type="button" id="mvp-export" ${results ? '' : 'disabled'}>↓ JSON</button></div>
      <div id="mvp-results">${scen}</div>
      ${paramGroup('Laser (emissor técnico)')}
      <details class="mvp-hom-fold" data-k="homolog"><summary><b>Avaliação jogável dos Moves (${MOVES_HOMOLOG.length})</b></summary>
      <p class="hint">A sua aprovação (separada dos testes automáticos). Fica salva neste navegador e vai no JSON exportado.</p>
      ${MOVES_HOMOLOG.map((t, i) => `<div class="mvp-hom"><div>${escape(t)}</div><div class="row"><select data-hom="${i}"><option value="">pendente</option><option value="ok" ${homolog[i]?.v === 'ok' ? 'selected' : ''}>aprovado</option><option value="no" ${homolog[i]?.v === 'no' ? 'selected' : ''}>reprovado</option></select><input type="text" data-hom-note="${i}" placeholder="observação" value="${escape(homolog[i]?.n ?? '')}"></div></div>`).join('')}</details>
      <div class="row"><button type="button" id="mvp-reset-all">Restaurar todos os padrões dos moves</button></div></details>`;
    for (const d of root.querySelectorAll('details[data-k]')) if (openKeys.has(d.dataset.k)) d.open = true;
    for (const d of root.querySelectorAll('details.mv-sub[data-k]')) if (closedSubs.has(d.dataset.k)) d.open = false;
    visual.bind(root);
    specPanel.bind(root);
    $('mv-hold').oninput = e => {fireOpts.hold = Number(e.target.value);$('mv-hold-out').textContent = `${fireOpts.hold.toFixed(2)} s`;};
    $('mv-auto').onchange = e => {fireOpts.auto = e.target.checked;};
    root.onchange = e => {if (fireOpts.auto && lastFired && e.target.matches?.('[data-p],[data-visual]')) {clearTimeout(fireTimer);fireTimer = setTimeout(() => fire(lastFired), 300);}};
    for (const b of root.querySelectorAll('[data-mvtab]')) b.onclick = () => {
      const [id, k] = b.dataset.mvtab.split('|');tabOf.set(id, k);
      const card = b.closest('.mv-move');
      for (const p of card.querySelectorAll(':scope > .mv-pane')) p.hidden = p.dataset.pane !== k;
      for (const o of card.querySelectorAll('[data-mvtab]')) o.setAttribute('aria-pressed', String(o === b));
    };
    for (const b of root.querySelectorAll('[data-fire]')) b.onclick = () => fire(b.dataset.fire);
    for (const b of root.querySelectorAll('[data-ab-run]')) b.onclick = () => {
      const id = b.dataset.abRun, g = getMove(id)?.group, out = root.querySelector(`[data-ab-result="${id}"]`), sel = root.querySelector(`[data-ab-b="${id}"]`).value;
      if (!g || !C.world[g]) {out.innerHTML = '<p class="warn">Este Move não tem grupo de parâmetros: nada para comparar.</p>';return;}
      const prefix = `world.${g}.`, only = vals => Object.fromEntries(Object.entries(vals).filter(([p]) => p.startsWith(prefix)));
      const A = Object.fromEntries(Object.entries(C.world[g]).map(([k, v]) => [prefix + k, v]));
      const B = sel === '__factory' ? Object.fromEntries(Object.entries(factoryDefaults().world[g] ?? {}).map(([k, v]) => [prefix + k, v])) : { ...A, ...only(presetValues.valuesOf(sel) ?? {}) };
      let r;try {r = compareMoveVariants(id, A, B);} catch (e) {out.innerHTML = `<p class="warn">${escape(String(e.message ?? e))}</p>`;return;}
      const LABEL = {damage: 'Dano causado', hits: 'Acertos', blocked: 'Bloqueados', firstImpactTick: '1º impacto (tick)', entities: 'Entidades criadas', actionTicks: 'Duração da ação (ticks)', maxDisplacement: 'Deslocamento máx. (m)', foeHpLoss: 'HP perdido pelo rival', staminaSpent: 'Stamina gasta', cooldown: 'Recarga (s)'};
      out.innerHTML = `<table><tr><th>Métrica</th><th>A · atual</th><th>B</th></tr>${r.rows.map(x => `<tr class="${x.same ? '' : 'warn'}"><td>${escape(LABEL[x.metric] ?? x.metric)}</td><td>${x.a ?? '—'}</td><td>${x.b ?? '—'}</td></tr>`).join('')}</table>`
        + (r.divergence.identical ? '<p class="muted">As duas execuções são idênticas: os valores escolhidos não mudam este cenário.</p>' : `<p>Primeiro tick em que A e B se separam: <b>${r.divergence.tick}</b>, campo <code>${escape(r.divergence.field)}</code>.</p>`)
        + `<p class="muted">${r.warnings.map(escape).join(' ')}</p>`;
    };
    // Pausar o replay no tick de uma marca: a partida guarda os últimos 12 s; o tick da marca é relativo ao começo da última vez que o Move foi usado.
    for (const b of root.querySelectorAll('[data-tl-seek]')) b.onclick = () => {
      const [id, tick] = b.dataset.tlSeek.split(':'), out = root.querySelector(`[data-tl-result="${id}"]`);
      const r = nav.seekMoveTick?.(id, Number(tick)) ?? {ok: false, msg: 'Esta tela não tem replay ligado.'};
      if (out) out.innerHTML = `<p class="${r.ok ? '' : 'warn'}">${escape(r.msg)}</p>`;
    };
    // Conversão tick → quadro do clipe (a animação tem relógio próprio; o valor é só uma conversão de exibição).
    for (const inp of root.querySelectorAll('[data-tl-clipframes]')) {
      const box = inp.closest('.mv-tl') ?? root.querySelector(`[data-tl="${inp.dataset.tlClipframes}"]`), total = Number(box?.dataset.tlTotal ?? 0);
      const upd = () => { for (const sp of root.querySelectorAll('[data-tl-frame]')) sp.textContent = `${clipFrameAtTick(Number(sp.dataset.tlFrame), total, Number(inp.value))} de ${inp.value}`; };
      inp.oninput = upd; upd();
    }
    for (const b of root.querySelectorAll('[data-tl-measure]')) b.onclick = () => {
      const id = b.dataset.tlMeasure, out = root.querySelector(`[data-tl-result="${id}"]`), tl = buildMoveTimeline(id);
      let m;try {m = measureMoveRun(id);} catch (e) {out.innerHTML = `<p class="warn">${escape(String(e.message ?? e))}</p>`;return;}
      const eff = tl.marks.find(k => k.kind === 'effect' || k.kind === 'spawn' || k.kind === 'status'), real = m.spawns[0]?.tick ?? m.statusAt;
      out.innerHTML = `<p>Medido: ação de <b>${m.actionStart ?? '—'}</b> a <b>${m.actionEnd ?? '—'}</b> (${m.actionEnd != null ? m.actionEnd - (m.actionStart ?? 0) : '—'} ticks; a ficha diz ${tl.totalTicks}). ${eff && real != null ? `Efeito: ficha tick ${eff.tick} × motor tick ${real}${Math.abs(real - eff.tick) <= 1 ? ' ✓' : ' ⚠'}.` : ''} Entidades: ${m.spawns.length ? m.spawns.map(sp => `${escape(sp.kind)}@${sp.tick}`).join(', ') : 'nenhuma'}. Impactos nos ticks: ${m.impacts.length ? m.impacts.join(', ') : 'nenhum'}.</p>`;
    };
    for (const b of root.querySelectorAll('[data-goto-actions]')) b.onclick = () => nav.openActions?.(b.dataset.gotoActions);

    // Slots: move e botão de cada um (o botão é o mesmo de Controles › Teclas e entra no desfazer).
    for (const sel of root.querySelectorAll('[data-slot-move]')) sel.onchange = () => {const [id, slot] = sel.dataset.slotMove.split('.').map(Number);setSlot(id, slot, sel.value || null);render();};
    for (const sel of root.querySelectorAll('[data-slot-key]')) sel.onchange = () => {
      const [id, slot] = sel.dataset.slotKey.split('.').map(Number), path = `extras.${id ? 'bindings2' : 'bindings'}.${SKILL_NAMES[slot]}`;
      if (tuning) tuning.commit([[path, Number(sel.value)]], `Botão do slot ${slot + 1}`);else {const [, g, k] = path.split('.');C.extras[g][k] = Number(sel.value);}
      render();
    };

    for (const s of root.querySelectorAll('[data-hom]')) s.onchange = () => {homolog[s.dataset.hom] = {...homolog[s.dataset.hom], v: s.value};saveHomolog(homolog);};
    for (const s of root.querySelectorAll('[data-hom-note]')) s.onchange = () => {homolog[s.dataset.homNote] = {...homolog[s.dataset.homNote], n: s.value};saveHomolog(homolog);};
    
    if (!subscribed && tuning?.onChange) {subscribed = true;tuning.onChange(() => {
      if (!root.closest('[data-section="moves"]')?.hidden && !root.querySelector('[data-p]:active, [data-visual]:active')) render();
    });}
    
    for (const b of root.querySelectorAll('[data-laser]')) b.onclick = () => {const k = b.dataset.laser;(k === 'sweep' ? emitLaser(1, .8) : emitLaser(Number(k)));};
    for (const b of root.querySelectorAll('[data-laser-scene]')) b.onclick = () => testLaserScene(b.dataset.laserScene);
    for (const b of root.querySelectorAll('[data-emit]')) b.onclick = () => {const k = b.dataset.emit;(k === 'boom' ? emitExplosion() : emitProjectile(Number(k)));};
    $('mvp-run').onclick = () => {results = runMoveScenarios();render();};
    $('mvp-export').onclick = () => results && download(JSON.stringify({schema: 'arenamon-lab-report', version: 1, kind: 'moves-scenarios', createdAt: new Date().toISOString(), step: C.test.step, scenarios: results, homologation: MOVES_HOMOLOG.map((t, i) => ({item: t, verdict: homolog[i]?.v || 'pendente', note: homolog[i]?.n || ''}))}, null, 1), 'arenamon-cenarios-moves.json');
    $('mvp-export-params').onclick = () => download(JSON.stringify(tuning.exportData(), null, 2), 'arenamon-parametros-moves.json');
    bindParams(root, render);
    $('mvp-reset-all').onclick = () => {const ch = [];for (const g of ['charge', 'reflect', 'psyshock', 'beam', 'ai']) for (const [k, v] of Object.entries(defaults().world[g])) if (C.world[g][k] !== v) ch.push([`world.${g}.${k}`, v]);commit(ch, 'Restaurar os parâmetros dos Moves');render();};
  }
  return {render, renderActions, focusMove, focusAction, ensureEquipped, fire, renderAiParams, emitProjectile, emitLaser, emitExplosion, setEquip, setSlot, loadoutOf, get results() {return results;}, STANDARD};
}
