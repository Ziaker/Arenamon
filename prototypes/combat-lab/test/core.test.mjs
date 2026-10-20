// Etapa A — testes do núcleo mecânico (passo fixo, sem interface): X e C independentes, tackle e esquiva nas
// oito direções, cancelamento C → X (inclusive aéreo), clash, defesa, stamina, independência dos parâmetros e
// migração de JSON antigo. Grava o relatório “esperado × obtido” em validation/etapa-a-*.{json,md}.
// Uso: node prototypes/combat-lab/test/core.test.mjs
import assert from 'node:assert/strict';
import {mkdirSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {Game} from '../src/sim/game.js';
import {C, resetConfig, defaults, ETAPA_A_MOTION, ETAPA_A_RULES} from '../src/sim/config.js';
import {isInvulnerable} from '../src/sim/entity.js';
import {toCommand} from '../src/ui/input.js';
import {migrateFlat, flatten} from '../src/ui/actions-meta.js';
import {vec, length, normalize, angleOf, sub} from '../src/sim/math.js';

const out = fileURLToPath(new URL('../validation/', import.meta.url));mkdirSync(out, {recursive: true});
const report = [];let passed = 0;
const fmt = v => typeof v === 'number' ? (Math.abs(v) >= 100 ? v.toFixed(1) : +v.toFixed(4)) : v;
/** Registra uma verificação esperado × obtido e falha o teste se não bater. */
function expect(group, label, ok, expected, actual) {report.push({group, label, ok: !!ok, expected: fmt(expected), actual: fmt(actual)});assert.ok(ok, `${group} · ${label}: esperado ${expected}, obtido ${actual}`);}
/** Movimento da Etapa A (locomoção linear, setas relativas ao alvo, curva polinomial): para verificações que medem aquela curva ou aqueles tempos. */
function legacyMotion() {for (const [p, v] of Object.entries(ETAPA_A_MOTION)) {const k = p.split('.'), last = k.pop();k.reduce((o, x) => o[x], C)[last] = v;}}
/** As verificações deste arquivo documentam as regras aprovadas da Etapa A; as regras novas têm testes próprios (rules.test.mjs). */
function etapaARules() {for (const [p, v] of Object.entries(ETAPA_A_RULES)) {const k = p.split('.'), last = k.pop();k.reduce((o, x) => o[x], C)[last] = v;}}
function test(name, fn) {resetConfig();etapaARules();fn();passed++;console.log('✓', name);}
const cmd = (o = {}) => ({move: vec(), dodge: false, tackle: false, guard: false, guardPressed: false, target: null, ...o});
const DIRS = [['frente', 0, 1], ['trás', 0, -1], ['esquerda', 1, 0], ['direita', -1, 0], ['frente-esquerda', 1, 1], ['frente-direita', -1, 1], ['trás-esquerda', 1, -1], ['trás-direita', -1, -1]]
  .map(([name, x, z]) => ({name, d: normalize(vec(x, z))}));
const STEP = () => C.test.step;
/** Partida com posições, orientação (0 = +Z) e stamina definidas; o vermelho fica parado salvo comando. */
function setup({p0 = vec(0, 0), p1 = vec(0, 3), face0 = 0, face1 = Math.PI, stamina0, stamina1, profile0 = 'balanced', profile1 = 'balanced'} = {}) {
  const g = new Game();g.mode = 'inactive';g.profile = profile0;g.enemyProfile = profile1;g.reset({positions: [p0, p1]});
  // Estes testes medem a mecânica de combate em si: o mundo (plataformas, obstáculos,
  // destrutíveis, itens) fica neutro para não bloquear trajetórias nem curar stamina.
  g.mapState.platforms = [];g.mapState.obstacles = [];g.mapState.destructibles = [];g.mapState.items = [];
  const [a, b] = g.fighters;for (const [f, face] of [[a, face0], [b, face1]]) {f.facing = face;f.visualFacing = face;f.combatHeading = face;}
  if (stamina0 !== undefined) {a.stamina = stamina0;a.regenBase = stamina0;}if (stamina1 !== undefined) {b.stamina = stamina1;b.regenBase = stamina1;}
  return g;
}
/** Executa n passos com script(t) → [cmd0, cmd1]; devolve eventos e amostras por passo. */
function run(g, n, script) {
  const events = [], samples = [];
  for (let t = 0; t < n; t++) {
    const [a, b] = script ? script(t, g) : [cmd(), cmd()];g.step(a ?? cmd(), b ?? cmd());events.push(...g.lastStepEvents);
    samples.push(g.fighters.map(f => ({t, x: f.position.x, z: f.position.z, vx: f.velocity.x, vz: f.velocity.z, h: (f.flight?.y ?? 0) + f.vaultHeight, kind: f.action?.kind ?? null, elapsed: f.action?.elapsed,
      fromCancel: !!f.action?.fromCancel, heading: f.action?.heading, stamina: f.stamina, hp: f.hp, state: f.state, invulnerable: isInvulnerable(f), stun: f.stun, flight: !!f.flight, vault: !!f.action?.vault})));
  }
  return {events, samples};
}
const hitsOn = (events, target) => events.filter(e => e.target === target && (e.result === 'impact' || e.result === 'partial' || e.result === 'perfect'));

// ---------- Tackle X nas oito direções ----------
test('tackle X atinge nas 8 direções, sem lock-on, com o corpo sempre voltado para +Z', () => {
  for (const {name, d} of DIRS) {
    const g = setup({p1: {x: d.x * 2.2, z: d.z * 2.2}}), r = run(g, 60, t => [t === 2 ? cmd({move: d, tackle: true}) : cmd(), cmd()]);
    const hits = hitsOn(r.events, 1);
    expect('Tackle 8 direções (sem lock-on)', `${name}: um impacto`, hits.length === 1 && hits[0].result === 'impact', 'impact ×1', hits.map(h => h.result).join(',') || 'nenhum');
    expect('Tackle 8 direções (sem lock-on)', `${name}: dano`, hits[0]?.damage === C.profiles.balanced.attack, C.profiles.balanced.attack, hits[0]?.damage ?? 0);
    expect('Tackle 8 direções (sem lock-on)', `${name}: alvo lançado`, r.samples.some(s => s[1].flight), 'voo', r.samples.some(s => s[1].flight) ? 'voo' : 'sem voo');
  }
});
test('tackle X atinge nas 8 direções com lock-on (direção relativa ao alvo)', () => {
  for (const {name, d} of DIRS) {
    const g = setup({p1: {x: d.x * 2.2, z: d.z * 2.2}}), r = run(g, 60, t => [t === 2 ? cmd({move: d, dodgeDirection: d, tackle: true, target: 1}) : cmd({target: 1}), cmd()]);
    const hits = hitsOn(r.events, 1);
    expect('Tackle 8 direções (lock-on)', `${name}: um impacto`, hits.length === 1 && hits[0].result === 'impact', 'impact ×1', hits.map(h => h.result).join(',') || 'nenhum');
  }
});
test('tackle X pelo teclado com lock-on: ↑ investe contra um alvo que está ATRÁS do corpo (referencial do alvo, Etapa A)', () => {
  legacyMotion();
  const g = setup({p1: vec(0, -2.2), face0: 0});
  const r = run(g, 60, (t, game) => {const [a, b] = game.fighters;const c = toCommand({x: 0, forward: 1, tackle: t === 2, dodge: false, guard: false, guardPressed: false}, a, b, Math.PI, true);return [c, cmd()];});
  const hits = hitsOn(r.events, 1);expect('Entrada real', 'alvo atrás · ↑ + X com lock-on', hits.length === 1, 'impact ×1', hits.length);
});
test('tackle X sem contato e tackle afastando-se do alvo não causam dano', () => {
  let g = setup({p1: vec(4, 0)}), r = run(g, 80, t => [t === 2 ? cmd({move: vec(0, 1), tackle: true}) : cmd(), cmd()]);
  expect('Sem contato', 'tackle para frente, rival ao lado a 4 m', !r.events.length && g.fighters[1].hp === 100, '0 eventos · 100 HP', `${r.events.length} eventos · ${g.fighters[1].hp} HP`);
  g = setup({p1: vec(0, -1.05)});r = run(g, 80, t => [t === 2 ? cmd({move: vec(0, 1), tackle: true}) : cmd(), cmd()]);
  expect('Sem contato', 'tackle se afastando de rival encostado atrás', !hitsOn(r.events, 1).length && g.fighters[1].hp === 100, '0 impactos · 100 HP', `${hitsOn(r.events, 1).length} · ${g.fighters[1].hp} HP`);
});

// ---------- Esquiva C ----------
test('esquiva C nas 8 direções atravessando o rival: salta por cima, sem dano', () => {
  for (const {name, d} of DIRS) {
    const g = setup({p1: {x: d.x * 2.2, z: d.z * 2.2}}), r = run(g, 80, t => [t === 2 ? cmd({move: d, dodge: true, dodgeDirection: d}) : cmd(), cmd()]);
    const maxH = Math.max(...r.samples.map(s => s[0].h)), ahead = r.samples.at(-1)[0].x * d.x + r.samples.at(-1)[0].z * d.z;
    expect('Esquiva com salto', `${name}: salto`, r.samples.some(s => s[0].vault) && Math.abs(maxH - C.actions.dodge.vaultHeight) < .02, `altura ${C.actions.dodge.vaultHeight}`, maxH);
    expect('Esquiva com salto', `${name}: sem dano`, !r.events.some(e => e.damage > 0) && g.fighters[1].hp === 100 && g.fighters[0].hp === 100, '0 dano', r.events.map(e => e.result).join(',') || '0 dano');
    expect('Esquiva com salto', `${name}: passa além do rival`, ahead > 2.2 + 1, '> 3,2 m na direção', ahead);
  }
});
test('esquiva C nas 8 direções sem rival no caminho: sem salto, distância nominal', () => {
  const nominal = C.actions.dodge.distance * C.actions.dodge.duration * C.profiles.balanced.speed;
  for (const {name, d} of DIRS) {
    const g = setup({p1: vec(14, 14)}), r = run(g, 70, t => [t === 2 ? cmd({move: d, dodge: true, dodgeDirection: d}) : cmd(), cmd()]);
    const end = r.samples.at(-1)[0], dist = Math.hypot(end.x, end.z), maxH = Math.max(...r.samples.map(s => s[0].h));
    expect('Esquiva sem salto', `${name}: sem salto`, maxH === 0 && !r.samples.some(s => s[0].vault), 'altura 0', maxH);
    expect('Esquiva sem salto', `${name}: distância`, Math.abs(dist - nominal) < .02, nominal, dist);
    expect('Esquiva sem salto', `${name}: nenhum evento`, !r.events.length, 0, r.events.length);
  }
});

// ---------- Cancelamento C → X ----------
const cancelReport = [];
/** Cenário de C → X: C lateral (sem salto) e X rumo ao rival à frente após `k` passos. */
function cancelCase(label, k, {stamina, dodgeDir = vec(1, 0), tackleDir = 'aim', enemy = vec(0, 2.6), vaultCase = false} = {}) {
  const g = setup({p1: enemy, stamina0: stamina});const before = structuredClone(g.fighters[0]);
  let asked = null;
  const r = run(g, 150, (t, game) => {if (t === 2 + k) asked = tackleDir === 'aim' ? normalize(sub(game.fighters[1].position, game.fighters[0].position)) : tackleDir;
    return [t === 2 ? cmd({move: dodgeDir, dodge: true, dodgeDirection: dodgeDir}) : t === 2 + k ? cmd({move: asked, dodgeDirection: length(asked) ? asked : undefined, tackle: true}) : cmd(), cmd()];});
  const S = r.samples.map(s => s[0]), act = 2 + k, at = S[act], prev = S[act - 1];
  const speed = s => Math.hypot(s.vx, s.vz), dv = S.slice(1).map((s, i) => Math.hypot(s.vx - S[i].vx, s.vz - S[i].vz)), dp = S.slice(1).map((s, i) => Math.hypot(s.x - S[i].x, s.z - S[i].z));
  const maxV = Math.max(...S.map(speed)), maxJump = Math.max(...dp), tackleTicks = S.filter(s => s.kind === 'tackle').length;
  // Passos congelados pelo hitstop repetem o mesmo elapsed: conta só passos em que a ação avançou.
  const invulnTicks = new Set(S.filter(s => s.kind === 'tackle' && s.invulnerable).map(s => s.elapsed)).size;
  const row = {caso: label, passoC: 2, passoX: act, tempoNaEsquiva_ms: +(k * STEP() * 1000).toFixed(1), estadoAntesC: before.state, estadoDuranteC: prev.kind, estadoNoPassoX: at.kind,
    staminaAntesC: +before.stamina.toFixed(3), staminaAntesX: +prev.stamina.toFixed(3), staminaDepoisX: +at.stamina.toFixed(3),
    velocidadeAntes: +speed(prev).toFixed(3), velocidadeDepois: +speed(at).toFixed(3), maiorSaltoDeVelocidadePorPasso: +Math.max(...dv).toFixed(3), maiorDeslocamentoPorPasso: +maxJump.toFixed(4),
    direcaoX_graus: at.heading !== undefined ? +(at.heading * 180 / Math.PI).toFixed(1) : null, alturaAntes: +prev.h.toFixed(3), alturaNoPassoX: +at.h.toFixed(3),
    passosInvulneraveisNoX: invulnTicks, eventos: r.events.map(e => `${e.result}:${e.attacker}→${e.target}`), dano: r.events.filter(e => e.attacker === 0).reduce((a, e) => a + e.damage, 0), estadoFinal: S.at(-1).state, hpRival: g.fighters[1].hp};
  row.direcaoPedida_graus = length(asked) ? +(angleOf(asked) * 180 / Math.PI).toFixed(1) : 'nenhuma (continuidade)';
  cancelReport.push(row);return {g, r, S, row, act, prev, at, asked, maxV, maxJump, tackleTicks, invulnTicks};
}
test('C → X no início, durante e após a invulnerabilidade da esquiva', () => {
  const D = C.actions.dodge, X = C.actions.tackle;
  for (const [label, k] of [['início (1º passo)', 1], ['durante a invulnerabilidade (100 ms)', 12], ['após a invulnerabilidade (250 ms)', 30]]) {
    const c = cancelCase(label, k), invRemain = Math.max(0, D.invulnerable - k * STEP());
    expect('C → X', `${label}: X começa no passo pedido`, c.prev.kind === 'dodge' && c.at.kind === 'tackle' && c.at.fromCancel, 'dodge → tackle', `${c.prev.kind} → ${c.at.kind}`);
    expect('C → X', `${label}: stamina (C e X cobrados uma vez cada)`, Math.abs(c.prev.stamina - (3 - D.cost)) < 1e-6 && Math.abs(c.at.stamina - (3 - D.cost - X.cost)) < 1e-6, `${3 - D.cost} → ${3 - D.cost - X.cost}`, `${fmt(c.prev.stamina)} → ${fmt(c.at.stamina)}`);
    expect('C → X', `${label}: direção pedida (rumo ao rival)`, Math.abs(c.at.heading - angleOf(c.asked)) < 1e-9, angleOf(c.asked), c.at.heading);
    expect('C → X', `${label}: invulnerabilidade de X = só o resto de C`, Math.abs(c.invulnTicks - Math.ceil(invRemain / STEP() - 1e-9)) <= 1, Math.ceil(invRemain / STEP() - 1e-9), c.invulnTicks);
    expect('C → X', `${label}: sem teletransporte`, c.maxJump <= c.maxV * STEP() * 1.001 + 1e-9, `≤ ${fmt(c.maxV * STEP())} m/passo`, c.maxJump);
    expect('C → X', `${label}: impacto e dano do X`, hitsOn(c.r.events, 1).length === 1 && c.row.dano === X.duration * 0 + C.profiles.balanced.attack, C.profiles.balanced.attack, c.row.dano);
    expect('C → X', `${label}: a esquiva não registra dano`, !c.r.events.some(e => e.attacker === 0 && c.S[e.tick]?.kind === 'dodge'), 0, 0);
  }
});
test('C → X: transição de velocidade suave (sem pico artificial) — curva polinomial da Etapa A', () => {
  legacyMotion();
  const c = cancelCase('continuidade de velocidade (150 ms)', 18);
  // Referência: um X iniciado do repouso salta de 0 à velocidade inicial em um passo; no cancelamento o salto deve ser menor.
  const g = setup({p1: vec(0, 2.6)}), r = run(g, 10, t => [t === 2 ? cmd({move: vec(0, 1), tackle: true}) : cmd(), cmd()]);
  const fresh = Math.hypot(r.samples[2][0].vx, r.samples[2][0].vz);
  const jump = Math.hypot(c.at.vx - c.prev.vx, c.at.vz - c.prev.vz);
  expect('C → X', 'salto de velocidade no passo do cancelamento menor que o de um X do repouso', jump < fresh, `< ${fmt(fresh)} m/s`, jump);
  expect('C → X', 'velocidade nunca excede a de pico do tackle', c.maxV <= fresh * 1.0001, `≤ ${fmt(fresh)}`, c.maxV);
  // Sem pico para baixo: no passo do cancelamento a velocidade muda no máximo 15% da diferença entre C e X (transição suave).
  const maxStep = Math.max(...c.S.slice(c.act, c.act + 8).map((s, i) => Math.hypot(s.vx - c.S[c.act + i - 1].vx, s.vz - c.S[c.act + i - 1].vz)));
  // Limite analítico da mistura smoothstep: |vX − vC| · 1,5 · passo / transição (+ variação própria da curva de X).
  const vX = {x: Math.sin(c.at.heading) * fresh, z: Math.cos(c.at.heading) * fresh}, gap = Math.hypot(vX.x - c.prev.vx, vX.z - c.prev.vz);
  const bound = gap * 1.5 * STEP() / C.actions.cancel.transition + .1 * fresh;
  expect('C → X', 'maior variação de velocidade por passo dentro do limite da transição suave', maxStep <= bound, `≤ ${fmt(bound)} m/s`, maxStep);
  expect('C → X', 'velocidade no passo do cancelamento ≥ 85% da anterior', Math.hypot(c.at.vx, c.at.vz) >= .85 * Math.hypot(c.prev.vx, c.prev.vz), `≥ ${fmt(.85 * Math.hypot(c.prev.vx, c.prev.vz))}`, Math.hypot(c.at.vx, c.at.vz));
});
test('C → X durante o salto: começa na altura atual e desce sem teletransporte', () => {
  C.extras.toggles.enableMeteorSlam = 0;   // descida suave da Etapa A; com o meteor slam ligado o X do salto mergulha (teste próprio)
  const D = C.actions.dodge, k = 18, c = cancelCase('durante o salto (150 ms)', k, {dodgeDir: vec(0, 1), tackleDir: vec(), enemy: vec(0, 2.2)});
  const hs = c.S.slice(c.act - 3, c.act + 30).map(s => s.h), steps = hs.slice(1).map((h, i) => Math.abs(h - hs[i]));
  expect('C → X aéreo', 'estava no ar ao cancelar', c.prev.h > 1.5, '> 1,5 m', c.prev.h);
  expect('C → X aéreo', 'altura contínua no passo do X', Math.abs(c.at.h - c.prev.h) < .12, '|Δh| < 0,12 m', Math.abs(c.at.h - c.prev.h));
  expect('C → X aéreo', 'maior variação de altura por passo', Math.max(...steps) < .2, '< 0,2 m', Math.max(...steps));
  const landed = c.S.findIndex((s, i) => i > c.act && s.h === 0);
  expect('C → X aéreo', 'chega ao chão no tempo de descida', Math.abs((landed - c.act) * STEP() - C.actions.cancel.airDescent) <= 2 * STEP(), `${C.actions.cancel.airDescent} s`, (landed - c.act) * STEP());
  expect('C → X aéreo', 'continua na direção da esquiva sem nova direção', Math.abs(c.at.heading) < 1e-9, 0, c.at.heading);
  expect('C → X aéreo', 'invulnerabilidade não duplicada', c.invulnTicks <= Math.ceil((D.invulnerable - k * STEP()) / STEP()), `≤ ${Math.ceil((D.invulnerable - k * STEP()) / STEP())} passos`, c.invulnTicks);
  expect('C → X aéreo', 'sem dano enquanto acima da altura de atravessamento', !c.r.events.some(e => e.tick < c.act + 3), 'nenhum contato no ar', c.r.events.map(e => `${e.result}@${e.tick}`).join(',') || 'nenhum');
});
test('C → X com stamina insuficiente: a esquiva continua intacta', () => {
  const D = C.actions.dodge, c = cancelCase('stamina insuficiente', 12, {stamina: 1.5});
  expect('C → X', 'X não começa', c.at.kind === 'dodge' && !c.S.some(s => s.kind === 'tackle'), 'dodge', c.at.kind);
  expect('C → X', 'esquiva dura o tempo completo', c.S.filter(s => s.kind === 'dodge').length === Math.round(D.duration / STEP()) - 1, Math.round(D.duration / STEP()) - 1, c.S.filter(s => s.kind === 'dodge').length);
  expect('C → X', 'stamina não é cobrada pelo X', Math.abs(c.at.stamina - (1.5 - D.cost)) < 1e-6, 1.5 - D.cost, c.at.stamina);
  expect('C → X', 'sem dano', c.row.dano === 0, 0, c.row.dano);
});
test('C → X fora da janela ou desligado não interrompe a esquiva', () => {
  C.actions.cancel.windowStart = .1;C.actions.cancel.windowEnd = .2;C.actions.buffer.window = 0;
  let c = cancelCase('fora da janela (50 ms, janela 100–200 ms, sem buffer)', 6);
  expect('C → X', 'antes da janela: X ignorado', !c.S.some(s => s.kind === 'tackle'), 'sem X', c.S.some(s => s.kind === 'tackle') ? 'X' : 'sem X');
  resetConfig();C.actions.cancel.dodgeToTackle = 0;
  c = cancelCase('desligado', 30);
  expect('C → X', 'desligado: X ignorado durante C', !c.S.some(s => s.kind === 'tackle'), 'sem X', c.S.some(s => s.kind === 'tackle') ? 'X' : 'sem X');
});
test('esquiva perfeita seguida de C → X: bônus aplicados uma única vez', () => {
  C.extras.toggles.enableVault = 0;
  const g = setup({p0: vec(0, 0), p1: vec(0, 2.4)});
  const r = run(g, 120, t => [t === 12 ? cmd({move: vec(0, 1), dodge: true, dodgeDirection: vec(0, 1), target: 1}) : t === 30 ? cmd({move: vec(0, 1), tackle: true, target: 1}) : cmd({target: 1}), t === 10 ? cmd({move: vec(0, -1), tackle: true, target: 0}) : cmd({target: 0})]);
  const perfect = r.events.filter(e => e.result === 'perfectDodge'), tackleStart = r.samples.find(s => s[0].kind === 'tackle')?.[0];
  expect('Esquiva perfeita + C → X', 'esquiva perfeita registrada uma vez', perfect.length === 1, 1, perfect.length);
  // O X cancelado nasce sobreposto ao tackle ainda ativo do rival (salto desligado): o resultado correto é um clash nesse passo.
  const xEvent = r.events.find(e => e.attacker === 0 && e.tick >= 30);void tackleStart;
  expect('Esquiva perfeita + C → X', 'X cancelado entra em jogo no passo 30 (clash com o tackle ativo do rival)', r.samples[29][0].kind === 'dodge' && xEvent?.result === 'clash', 'dodge → clash', `${r.samples[29][0].kind} → ${xEvent?.result ?? 'nada'}`);
  const action = g.fighters[0].action;void action;
  expect('Esquiva perfeita + C → X', 'stamina: 3 − C + bônus − X', Math.abs(r.samples[30][0].stamina - (3 - C.actions.dodge.cost + C.actions.dodge.perfectEvadeStamina - C.actions.tackle.cost)) < 1e-6,
    3 - C.actions.dodge.cost + C.actions.dodge.perfectEvadeStamina - C.actions.tackle.cost, r.samples[30][0].stamina);
});

// ---------- Buffer de entrada ----------
test('buffer de entrada: X antecipado sai no primeiro passo permitido; expira e pode ser desligado', () => {
  const B = C.actions.buffer.window, step = STEP();
  // X 50 ms antes da janela C → X (100–200 ms): sai exatamente quando a janela abre.
  C.actions.cancel.windowStart = .1;C.actions.cancel.windowEnd = .2;
  let c = cancelCase('buffer: X 50 ms antes da janela', 6), first = c.S.findIndex(s => s.kind === 'tackle');
  expect('Buffer de entrada', 'X 50 ms antes da janela C → X sai na abertura', first === 2 + Math.round(.1 / step), 2 + Math.round(.1 / step), first);
  expect('Buffer de entrada', 'stamina cobrada uma vez', Math.abs(c.S[first].stamina - 1) < 1e-6, 1, c.S[first].stamina);
  // Pedido mais antigo que a janela do buffer: perdido.
  C.actions.cancel.windowStart = .2;C.actions.cancel.windowEnd = .4;c = cancelCase('buffer: X 150 ms antes da janela (expira)', 6);
  expect('Buffer de entrada', `X ${(.2 - 6 * step) * 1000 | 0} ms antes expira (buffer ${B * 1000} ms)`, !c.S.some(s => s.kind === 'tackle'), 'sem X', c.S.some(s => s.kind === 'tackle') ? 'X' : 'sem X');
  // C apertado durante o próprio tackle antes do encadeamento (200 ms): sai no passo em que o encadeamento abre.
  resetConfig();
  const g = setup({p1: vec(14, 14)}), r = run(g, 80, t => [t === 2 ? cmd({move: vec(1, 0), tackle: true}) : t === 2 + 18 ? cmd({move: vec(0, 1), dodge: true, dodgeDirection: vec(0, 1)}) : cmd(), cmd()]);
  const dodgeAt = r.samples.findIndex(s => s[0].kind === 'dodge');
  expect('Buffer de entrada', 'C 50 ms antes do fim do encadeamento do X sai quando ele abre', Math.abs(dodgeAt - (2 + Math.round(C.actions.tackle.chainAfter / step))) <= 1, 2 + Math.round(C.actions.tackle.chainAfter / step), dodgeAt);
  // Desligado: comportamento antigo (pedido perdido).
  C.actions.buffer.window = 0;
  const g2 = setup({p1: vec(14, 14)}), r2 = run(g2, 80, t => [t === 2 ? cmd({move: vec(1, 0), tackle: true}) : t === 2 + 18 ? cmd({move: vec(0, 1), dodge: true, dodgeDirection: vec(0, 1)}) : cmd(), cmd()]);
  expect('Buffer de entrada', 'buffer desligado: C antecipado é perdido', !r2.samples.some(s => s[0].kind === 'dodge'), 'sem C', r2.samples.some(s => s[0].kind === 'dodge') ? 'C' : 'sem C');
  // Um toque em D descarta o pedido guardado.
  resetConfig();
  const g3 = setup({p1: vec(14, 14)}), r3 = run(g3, 80, t => [t === 2 ? cmd({move: vec(1, 0), tackle: true}) : t === 20 ? cmd({move: vec(0, 1), dodge: true, dodgeDirection: vec(0, 1)}) : t === 22 ? cmd({guard: true, guardPressed: true}) : cmd(), cmd()]);
  expect('Buffer de entrada', 'toque em D descarta o pedido guardado', !r3.samples.some(s => s[0].kind === 'dodge'), 'sem C', r3.samples.some(s => s[0].kind === 'dodge') ? 'C' : 'sem C');
});

// ---------- Independência dos parâmetros ----------
test('parâmetros de C e X são independentes', () => {
  assert.notEqual(C.actions.dodge, C.actions.tackle);
  C.actions.dodge.duration = .6;C.actions.tackle.cost = 2;
  let g = setup({p1: vec(14, 14)}), r = run(g, 100, t => [t === 2 ? cmd({move: vec(1, 0), dodge: true, dodgeDirection: vec(1, 0)}) : cmd(), cmd()]);
  expect('Independência', 'duração de C = 0,6 s (71 amostras + passo final)', r.samples.filter(s => s[0].kind === 'dodge').length === 71, 71, r.samples.filter(s => s[0].kind === 'dodge').length);
  expect('Independência', 'custo de C continua 1', Math.abs(r.samples[3][0].stamina - 2) < 1e-9, 2, r.samples[3][0].stamina);
  g = setup({p1: vec(14, 14)});r = run(g, 100, t => [t === 2 ? cmd({move: vec(1, 0), tackle: true}) : cmd(), cmd()]);
  expect('Independência', 'duração de X continua 0,4 s (47 amostras + passo final)', r.samples.filter(s => s[0].kind === 'tackle').length === 47, 47, r.samples.filter(s => s[0].kind === 'tackle').length);
  expect('Independência', 'custo de X = 2', Math.abs(r.samples[3][0].stamina - 1) < 1e-9, 1, r.samples[3][0].stamina);
  resetConfig();etapaARules();legacyMotion();C.actions.tackle.steerLimit = 0;C.actions.tackle.curveStart = 3;C.actions.dodge.distance = 1;
  g = setup({p1: vec(14, 14)});r = run(g, 70, t => [t === 2 ? cmd({move: vec(1, 0), dodge: true, dodgeDirection: vec(1, 0)}) : t > 2 ? cmd({move: vec(1, 1)}) : cmd(), cmd()]);
  const endOf = (r, kind) => r.samples.find((s, i) => i > 2 && s[0].kind !== kind)[0];const dodgeEnd = endOf(r, 'dodge');
  expect('Independência', 'distância de C = 1 × 0,4 × 4,8', Math.abs(Math.hypot(dodgeEnd.x, dodgeEnd.z) - 1.92) < .2, '≈ 1,92 m (com esterçamento de C intacto)', Math.hypot(dodgeEnd.x, dodgeEnd.z));
  g = setup({p1: vec(14, 14)});r = run(g, 70, t => [t === 2 ? cmd({move: vec(1, 0), tackle: true}) : t > 2 ? cmd({move: vec(1, 1)}) : cmd(), cmd()]);
  expect('Independência', 'X sem esterçamento mantém o rumo', Math.abs(endOf(r, 'tackle').z) < 1e-9, 'z = 0', endOf(r, 'tackle').z);
  expect('Independência', 'curva de X com arrancada 3 (velocidade inicial = 3 × média)', Math.abs(Math.hypot(r.samples[2][0].vx, r.samples[2][0].vz) / 12 - 2.94) < .1, '≈ 2,9×', Math.hypot(r.samples[2][0].vx, r.samples[2][0].vz) / 12);
});

// ---------- Clash ----------
test('clash: frontal, diagonal, perto da parede, ataques diferentes e stamina baixa', () => {
  const clashOf = (g, r) => r.events.filter(e => e.result === 'clash');
  const both = (g, p0, p1, d0, d1, opts) => {const gg = setup({p0, p1, ...opts});return [gg, run(gg, 260, t => [t === 2 ? cmd({move: d0, tackle: true}) : cmd(), t === 2 ? cmd({move: d1, tackle: true}) : cmd()])];};
  let [g, r] = both(null, vec(0, -1.6), vec(0, 1.6), vec(0, 1), vec(0, -1));
  let c = clashOf(g, r);const dmg = C.profiles.balanced.attack * C.rules.clashFraction;
  expect('Clash', 'frontal: 2 eventos no mesmo passo', c.length === 2 && c[0].tick === c[1].tick, 2, c.length);
  expect('Clash', 'frontal: 30% do dano do adversário', c.every(e => Math.abs(e.damage - dmg) < 1e-9), dmg, c.map(e => e.damage).join('/'));
  const vy = r.samples.find(s => s[0].flight);
  expect('Clash', 'frontal: ambos lançados para trás e para cima', r.samples.some(s => s[0].flight && s[1].flight) && r.samples.some(s => s[0].h > 1 && s[1].h > 1) && g.fighters[0].position.z < -1.6 && g.fighters[1].position.z > 1.6, 'voo e recuo', `${fmt(g.fighters[0].position.z)} / ${fmt(g.fighters[1].position.z)}`);void vy;
  expect('Clash', 'frontal: aterrissam', r.samples.at(-1).every(s => !s.flight && s.h === 0), 'no chão', r.samples.at(-1).map(s => s.state).join('/'));
  [g, r] = both(null, vec(-1.15, -1.15), vec(1.15, 1.15), normalize(vec(1, 1)), normalize(vec(-1, -1)));c = clashOf(g, r);
  expect('Clash', 'diagonal: clash', c.length === 2, 2, c.length);
  g = setup({p0: vec(-3, 0), p1: vec(0, -3)});r = run(g, 200, t => [t === 0 ? cmd({move: vec(1, 0), tackle: true}) : cmd(), t === 60 ? cmd({move: vec(0, 1), tackle: true}) : cmd()]);
  expect('Clash', 'trajetórias cruzadas em tempos diferentes: sem clash e sem impacto', !r.events.length, 0, r.events.map(e => e.result).join(',') || 0);
  [g, r] = both(null, vec(0, -.6), vec(0, .6), vec(0, -1), vec(0, 1));
  expect('Clash', 'costas com costas, se afastando: nada', !r.events.length, 0, r.events.length);
  const h = C.test.arenaHalf;[g, r] = both(null, vec(0, h - 4.2), vec(0, h - 1.4), vec(0, 1), vec(0, -1));c = clashOf(g, r);
  const bound = h - C.test.halfExtent;
  expect('Clash', 'perto da parede: clash e ambos terminam dentro da arena', c.length === 2 && g.fighters.every(f => Math.abs(f.position.z) <= bound + 1e-9), 'clash · dentro', `${c.length} · ${fmt(g.fighters[1].position.z)}`);
  [g, r] = both(null, vec(0, -1.6), vec(0, 1.6), vec(0, 1), vec(0, -1), {profile0: 'resistant', profile1: 'agile'});c = clashOf(g, r);
  const toA = c.find(e => e.target === 0)?.damage, toB = c.find(e => e.target === 1)?.damage;
  expect('Clash', 'ataques diferentes: cada um recebe 30% do ataque do outro', Math.abs(toA - 16 * .3) < 1e-9 && Math.abs(toB - 24 * .3) < 1e-9, '4,8 (azul) / 7,2 (vermelho)', `${toA} / ${toB}`);
  [g, r] = both(null, vec(0, -1.6), vec(0, 1.6), vec(0, 1), vec(0, -1), {stamina0: 1, stamina1: 1});c = clashOf(g, r);
  expect('Clash', 'stamina baixa (exatamente o custo): clash e exaustão', c.length === 2 && r.samples[3].every(s => s.stamina === 0), 'clash · stamina 0', `${c.length} · ${r.samples[3].map(s => s.stamina).join('/')}`);
});
test('um impacto por alvo por ação, mesmo com contato prolongado', () => {
  C.extras.toggles.enableLaunch = 0;
  const h = C.test.arenaHalf, g = setup({p0: vec(0, h - 2.6), p1: vec(0, h - .6)}), r = run(g, 80, t => [t === 2 ? cmd({move: vec(0, 1), tackle: true}) : cmd(), cmd()]);
  expect('Regressão', 'contato contínuo contra a parede: 1 impacto', hitsOn(r.events, 1).length === 1, 1, hitsOn(r.events, 1).length);
});

// ---------- Defesa e recuo ----------
test('defesa: não desloca o defensor; recuo bloqueia X mas permite C e D; X guardado no guard stun (tempos da Etapa A)', () => {
  legacyMotion();
  const g = setup({p0: vec(0, -2.4), p1: vec(0, 0)});
  const start = {...g.fighters[1].position};
  const r = run(g, 140, t => [t === 40 ? cmd({move: vec(0, 1), tackle: true, target: 1}) : t === 52 ? cmd({tackle: true, target: 1, move: vec(0, 1)}) : cmd({target: 1}),
    cmd({guard: true, guardPressed: t === 0, target: 0, tackle: t === 52, move: t === 52 ? vec(0, -1) : vec()})]);
  const hit = r.events.find(e => e.result === 'partial'), ht = hit?.tick ?? 0, afterHit = r.samples.slice(ht, ht + 20);
  expect('Defesa', 'defesa parcial: dano reduzido', hit && hit.damage === C.profiles.balanced.attack * C.extras.combat.guardDamageMultiplier, 10, hit?.damage ?? 0);
  const stunEnd0 = r.samples.findIndex((s, i) => i > ht && s[1].stun <= 1e-8), slide = Math.max(...r.samples.slice(ht, stunEnd0).map(s => Math.hypot(s[1].x - r.samples[ht - 1][1].x, s[1].z - r.samples[ht - 1][1].z)));void start;
  expect('Defesa', 'defensor não voa nem desliza (do contato ao fim do guard stun)', afterHit.every(s => !s[1].flight) && slide < 1e-6, '0 m', slide);
  expect('Defesa', 'atacante entra em recuo', r.samples[ht + 1][0].kind === 'recoil', 'recoil', r.samples[ht + 1][0].kind);
  expect('Recuo (GDD 8.2)', 'X durante o recuo não começa', r.samples[53][0].kind === 'recoil', 'recoil', r.samples[53][0].kind);
  // Guard stun: o X do defensor no passo 52 fica guardado e sai quando o stun termina.
  const stunEnd = r.samples.findIndex((s, i) => i > ht && s[1].stun <= 1e-8);
  expect('Guard stun (GDD 5)', 'X guardado sai quando o stun acaba', r.samples.slice(ht, stunEnd).every(s => s[1].kind !== 'tackle') && r.samples[stunEnd][1].kind === 'tackle', `tackle no passo ${stunEnd}`, r.samples.findIndex(s => s[1].kind === 'tackle'));
});
test('recuo: C (esquiva) e D (defesa) cancelam o recuo; X não', () => {
  for (const [label, c, want] of [['C', cmd({move: vec(1, 0), dodge: true, dodgeDirection: vec(1, 0)}), 'dodge'], ['D', cmd({guard: true, guardPressed: true}), 'guard'], ['X', cmd({move: vec(0, 1), tackle: true}), 'recoil']]) {
    const g = setup({p0: vec(0, -2.4), p1: vec(0, 0)});let sent = null, after = null;
    run(g, 120, (t, game) => {
      const a = game.fighters[0];if (sent !== null && after === null) after = a.guard ? 'guard' : a.action?.kind ?? 'nenhuma';
      // Primeiro passo de recuo fora do hitstop (entradas no hitstop não contam).
      if (sent === null && a.action?.kind === 'recoil' && !game.frozen) {sent = t;return [c, cmd({guard: true, target: 0})];}
      return [t === 40 ? cmd({move: vec(0, 1), tackle: true, target: 1}) : cmd({target: 1}), cmd({guard: true, guardPressed: t === 0, target: 0})];
    });
    expect('Recuo (GDD 8.2)', `${label} durante o recuo → ${want}`, after === want, want, after);
  }
});

// ---------- Stamina ----------
test('stamina: três esquivas, exaustão, velocidade reduzida e regeneração', () => {
  const g = setup({p1: vec(14, 14)}), R = C.rules;
  const r = run(g, 120 * 9, t => [[2, 60, 118, 176].includes(t) ? cmd({move: vec(1, 0), dodge: true, dodgeDirection: vec(1, 0)}) : t > 240 && t < 360 ? cmd({move: vec(0, 1)}) : cmd(), cmd()]);
  const starts = r.samples.filter((s, i) => s[0].kind === 'dodge' && r.samples[i - 1]?.[0].kind !== 'dodge').length;
  expect('Stamina', 'três esquivas aceitas, a quarta não', starts === 3, 3, starts);
  const exhaustedWalk = r.samples.slice(300, 340).map(s => Math.hypot(s[0].vx, s[0].vz));
  expect('Stamina', 'velocidade exausta = 70%', Math.abs(Math.max(...exhaustedWalk) - C.profiles.balanced.speed * R.exhaustedSpeed) < 1e-6, C.profiles.balanced.speed * R.exhaustedSpeed, Math.max(...exhaustedWalk));
  const full = r.samples.findIndex(s => s[0].stamina >= R.staminaMax - 1e-9 && s[0].t > 120);
  // A regeneração fica pausada durante a recuperação de exaustão (comportamento do v6, coberto pela paridade).
  const expected = R.regenDelay + R.regenTime + C.extras.combat.exhaustRecovery;
  expect('Stamina', 'recuperação completa = 1 s + 5 s + recuperação de exaustão', Math.abs((full - 118) * STEP() - expected) < 2 * STEP(), expected, (full - 118) * STEP());
});

// ---------- Migração de JSON ----------
test('migração de JSON v6 e v7 para os parâmetros separados, com relatório', () => {
  const known = new Set(Object.keys(flatten(defaults())));
  const v6 = migrateFlat(flatten({rules: {dodge: .5, invulnerable: .25, steerLimit: .3, blend: .12, launchUp: 8, mystery: 3}, extras: {combat: {actionCost: 1.5, counterSpeed: 1.3, vaultReachBonus: .9}}}), known);
  const v = v6.values;
  expect('Migração', 'v6: duração compartilhada → C e X', v['actions.dodge.duration'] === .5 && v['actions.tackle.duration'] === .5, '0,5 / 0,5', `${v['actions.dodge.duration']} / ${v['actions.tackle.duration']}`);
  expect('Migração', 'v6: invulnerabilidade → C e X (e encadeamento)', v['actions.dodge.invulnerable'] === .25 && v['actions.tackle.chainAfter'] === .25, '0,25', v['actions.tackle.invulnerable']);
  expect('Migração', 'v6: custo compartilhado → C e X', v['actions.dodge.cost'] === 1.5 && v['actions.tackle.cost'] === 1.5, 1.5, v['actions.tackle.cost']);
  expect('Migração', 'v6: blend → defesa e transições de C e X', v['rules.blend'] === .12 && v['actions.dodge.blend'] === .12, .12, v['actions.dodge.blend']);
  expect('Migração', 'v6: contra-ataque e salto para os blocos certos', v['actions.tackle.counterSpeed'] === 1.3 && v['actions.dodge.vaultReachBonus'] === .9, '1,3 / 0,9', `${v['actions.tackle.counterSpeed']} / ${v['actions.dodge.vaultReachBonus']}`);
  expect('Migração', 'campo desconhecido listado, não descartado em silêncio', v6.ignored.some(i => i.path === 'rules.mystery'), 'rules.mystery', v6.ignored.map(i => i.path).join(','));
  expect('Migração', 'relatório de conversões', v6.converted.length >= 10, '≥ 10', v6.converted.length);
  const v7 = migrateFlat(flatten({rules: {dodge: .5, tackleDuration: .3}}), known).values;
  expect('Migração', 'v7: duração própria do tackle preservada', v7['actions.tackle.duration'] === .3 && v7['actions.dodge.duration'] === .5, '0,3 / 0,5', `${v7['actions.tackle.duration']} / ${v7['actions.dodge.duration']}`);
});

// ---------- Relatórios ----------
writeFileSync(out + 'etapa-a-report.json', JSON.stringify({checks: report, cancel: cancelReport}, null, 2));
const md = ['# Etapa A — esperado × obtido', '', `${report.filter(r => r.ok).length} de ${report.length} verificações aprovadas.`, ''];
let group = '';for (const r of report) {if (r.group !== group) {group = r.group;md.push('', `## ${group}`, '', '| Verificação | Esperado | Obtido |', '|---|---|---|');}md.push(`| ${r.ok ? '✓' : '✗'} ${r.label} | ${r.expected} | ${r.actual} |`);}
md.push('', '## Registro dos cancelamentos C → X', '', '| ' + Object.keys(cancelReport[0]).join(' | ') + ' |', '|' + Object.keys(cancelReport[0]).map(() => '---').join('|') + '|', ...cancelReport.map(r => '| ' + Object.values(r).map(v => Array.isArray(v) ? v.join(' ') : v).join(' | ') + ' |'));
writeFileSync(out + 'etapa-a-report.md', md.join('\n'));
console.log(`\n${passed} testes da Etapa A aprovados · ${report.length} verificações esperado × obtido (validation/etapa-a-report.md).`);
