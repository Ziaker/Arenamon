// Etapa A no jogo oficial: X (tackle) e C (esquiva) independentes, cancelamento C → X (inclusive no ar), recuo,
// guard stun, clash de 30%, defesa e esquiva perfeitas, buffer de entrada e parâmetros independentes.
// Usa a simulação do próprio jogo (validation/simulation.mjs, gerada por test.mjs). Grava validation/etapa-a.json.
// Uso: node prototypes/game/test.mjs && node prototypes/game/etapa-a.test.mjs
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const root = new URL('.', import.meta.url);
const {Game, ACTIONS, RULES, TEST, idle, vec, length, sub, scale, unit, dot, direction, angle, invulnerable, resolveCommand} = await import(new URL('validation/simulation.mjs', root));

const pristine = structuredClone(ACTIONS), restore = () => {for (const k of Object.keys(pristine)) {if (typeof pristine[k] === 'object') Object.assign(ACTIONS[k], structuredClone(pristine[k]));else ACTIONS[k] = pristine[k];}};
const report = [];let passed = 0;
const test = (name, fn) => {restore();fn();passed++;console.log('PASS', name);};
const expect = (group, label, ok, expected, actual) => {report.push({group, label, ok: !!ok, expected, actual});assert.ok(ok, `${group} · ${label}: esperado ${expected}, obtido ${actual}`);};
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;
const cmd = (o = {}) => ({...idle(), ...o});
const STEP = TEST.step, DIRS = [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]].map(([x, z]) => unit(vec(x, z)));
const label = d => `(${d.x.toFixed(2)}, ${d.z.toFixed(2)})`;
/** Partida “inactive” com posições, orientação e stamina definidas. */
function setup({p0 = vec(0, 0), p1 = vec(8, 8), face0 = 0, face1 = Math.PI, stamina0} = {}) {
  const g = new Game();g.mode = 'inactive';g.reset();const [a, b] = g.fighters;
  a.position = {...p0};b.position = {...p1};a.facing = a.visualFacing = a.combatHeading = face0;b.facing = b.visualFacing = b.combatHeading = face1;
  if (stamina0 !== undefined) {a.stamina = a.regenBase = stamina0;}
  return g;
}
/** Executa n passos; script(t, g) → [cmd0, cmd1]. Devolve eventos novos por passo e amostras do jogador 0. */
function run(g, n, script) {
  const seen = new Set(g.events), events = [], samples = [];
  for (let t = 0; t < n; t++) {
    const [c0, c1] = script ? script(t, g) : [];g.step(c0 ?? idle(), c1 ?? idle());
    for (const e of g.events) if (!seen.has(e)) {seen.add(e);events.push({...e, tick: t});}
    samples.push(g.fighters.map(f => ({t, x: f.position.x, z: f.position.z, vx: f.velocity.x, vz: f.velocity.z, h: f.vaultHeight, kind: f.action?.kind ?? null, heading: f.action?.heading,
      fromCancel: !!f.action?.fromCancel, elapsed: f.action?.elapsed, stamina: f.stamina, hp: f.hp, inv: invulnerable(f), stun: f.stun, guard: f.guard, state: f.state, vault: !!f.action?.vault})));
  }
  return {events, samples};
}
const damageTo = (r, id) => r.events.filter(e => e.target === id && e.damage > 0);

// ---------- Controles ----------
test('teclas: X gera tackle e C gera esquiva, ambos na direção comandada (8 direções)', () => {
  const g = setup(), [p, e] = g.fighters;
  for (const [x, forward] of [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const cx = resolveCommand({x, forward, dodge: false, tackle: true, guard: false, guardPressed: false}, p, e, Math.PI, false);
    const cc = resolveCommand({x, forward, dodge: true, tackle: false, guard: false, guardPressed: false}, p, e, Math.PI, false);
    expect('Controles', `${x},${forward}: X → tackle; C → esquiva`, cx.tackle && !cx.dodge && cc.dodge && !cc.tackle, 'tackle / dodge', `${cx.tackle}/${cc.dodge}`);
    expect('Controles', `${x},${forward}: mesma direção para X e C`, near(dot(cx.dodgeDirection, cc.dodgeDirection), 1), 1, dot(cx.dodgeDirection, cc.dodgeDirection));
  }
});

// ---------- C nunca causa dano; salto ----------
test('C nas 8 direções atravessando o rival: salta por cima, sem dano, e passa além', () => {
  for (const d of DIRS) {
    const g = setup({p1: scale(d, 2.2)}), r = run(g, 70, t => [t === 2 ? cmd({move: d, dodge: true, dodgeDirection: d}) : idle()]);
    const maxH = Math.max(...r.samples.map(s => s[0].h)), end = r.samples.at(-1)[0], ahead = end.x * d.x + end.z * d.z;
    expect('C com salto', `${label(d)}: salto`, r.samples.some(s => s[0].vault) && near(maxH, ACTIONS.dodge.vaultHeight, .02), ACTIONS.dodge.vaultHeight, maxH);
    expect('C com salto', `${label(d)}: sem dano`, !r.events.some(e => e.damage > 0) && g.fighters[1].hp === 100, 0, r.events.map(e => e.result).join(',') || 0);
    expect('C com salto', `${label(d)}: passa além do rival`, ahead > 3.2, '> 3,2 m', ahead.toFixed(2));
  }
});
test('C sem rival no caminho: não salta e percorre a distância nominal (2,5 × 0,4 s × 4 m/s = 4 m)', () => {
  for (const d of DIRS) {
    const g = setup(), r = run(g, 60, t => [t === 2 ? cmd({move: d, dodge: true, dodgeDirection: d}) : idle()]);
    const end = r.samples.at(-1)[0];
    expect('C sem salto', `${label(d)}: altura 0`, Math.max(...r.samples.map(s => s[0].h)) === 0, 0, Math.max(...r.samples.map(s => s[0].h)));
    expect('C sem salto', `${label(d)}: distância`, near(Math.hypot(end.x, end.z), 4, .01), 4, Math.hypot(end.x, end.z).toFixed(3));
  }
});
test('C contra um rival encostado de frente nunca causa dano (antes era tackle)', () => {
  const g = setup({p1: vec(0, 1.05)}), r = run(g, 60, t => [t === 2 ? cmd({move: vec(0, 1), dodge: true, dodgeDirection: vec(0, 1), target: 1}) : idle()]);
  expect('C sem dano', 'esquiva frontal encostada', !damageTo(r, 1).length && g.fighters[1].hp === 100, '0 dano', g.fighters[1].hp);
});

// ---------- C → X ----------
const cancelLog = [];
function cancelCase(name, k, {stamina, dodgeDir = vec(1, 0), enemy = vec(0, 2.6), aim = true} = {}) {
  const g = setup({p1: enemy, stamina0: stamina});let asked = null;
  const r = run(g, 150, (t, game) => {
    if (t === 2 + k) asked = aim ? unit(sub(game.fighters[1].position, game.fighters[0].position)) : vec();
    return [t === 2 ? cmd({move: dodgeDir, dodge: true, dodgeDirection: dodgeDir}) : t === 2 + k ? cmd({move: asked, tackle: true, dodgeDirection: length(asked) ? asked : undefined}) : idle()];
  });
  const S = r.samples.map(s => s[0]), act = 2 + k, at = S[act], prev = S[act - 1];
  const dp = S.slice(1).map((s, i) => Math.hypot(s.x - S[i].x, s.z - S[i].z)), maxV = Math.max(...S.map(s => Math.hypot(s.vx, s.vz)));
  const invTicks = new Set(S.filter(s => s.kind === 'tackle' && s.inv).map(s => s.elapsed)).size;
  const row = {caso: name, passoX: act, msNaEsquiva: +(k * STEP * 1000).toFixed(1), staminaAntesX: +prev.stamina.toFixed(3), staminaDepoisX: +at.stamina.toFixed(3),
    velocidadeAntes: +Math.hypot(prev.vx, prev.vz).toFixed(2), velocidadeDepois: +Math.hypot(at.vx, at.vz).toFixed(2), alturaAntes: +prev.h.toFixed(3), alturaNoX: +at.h.toFixed(3),
    passosInvulneraveisNoX: invTicks, eventos: r.events.map(e => `${e.result}:${e.attacker}→${e.target}`).join(' '), danoNoRival: 100 - g.fighters[1].hp};
  cancelLog.push(row);return {g, r, S, act, at, prev, asked, maxV, maxJump: Math.max(...dp), invTicks, row};
}
test('C → X no início, durante e depois da invulnerabilidade: custos, direção, invulnerabilidade e continuidade', () => {
  const D = ACTIONS.dodge, X = ACTIONS.tackle;
  for (const [name, k] of [['1º passo', 1], ['100 ms (invulnerável)', 12], ['250 ms', 30]]) {
    const c = cancelCase(name, k), remaining = Math.max(0, D.invulnerable - k * STEP);
    expect('C → X', `${name}: X começa a partir de C`, c.prev.kind === 'dodge' && c.at.kind === 'tackle' && c.at.fromCancel, 'dodge → tackle', `${c.prev.kind} → ${c.at.kind}`);
    expect('C → X', `${name}: stamina 3 − C − X`, near(c.prev.stamina, 3 - D.cost) && near(c.at.stamina, 3 - D.cost - X.cost), `${3 - D.cost} → ${3 - D.cost - X.cost}`, `${c.prev.stamina.toFixed(2)} → ${c.at.stamina.toFixed(2)}`);
    expect('C → X', `${name}: direção pedida`, near(c.at.heading, angle(c.asked)), angle(c.asked).toFixed(3), c.at.heading.toFixed(3));
    expect('C → X', `${name}: invulnerabilidade de X = resto de C`, Math.abs(c.invTicks - Math.ceil(remaining / STEP - 1e-9)) <= 1, Math.ceil(remaining / STEP - 1e-9), c.invTicks);
    expect('C → X', `${name}: sem teletransporte`, c.maxJump <= c.maxV * STEP * 1.001 + 1e-9, `≤ ${(c.maxV * STEP).toFixed(3)} m/passo`, c.maxJump.toFixed(3));
    expect('C → X', `${name}: velocidade contínua no passo do cancelamento (≥ 85%)`, Math.hypot(c.at.vx, c.at.vz) >= .85 * Math.hypot(c.prev.vx, c.prev.vz), '≥ 85%', `${c.row.velocidadeAntes} → ${c.row.velocidadeDepois}`);
    expect('C → X', `${name}: X acerta o rival (20 de dano)`, c.row.danoNoRival === 20, 20, c.row.danoNoRival);
  }
});
test('C → X durante o salto: começa na altura atual, desce sem teletransporte e sem contato no alto', () => {
  const k = 18, c = cancelCase('no ar (150 ms)', k, {dodgeDir: vec(0, 1), enemy: vec(0, 2.2), aim: false});
  const hs = c.S.slice(c.act - 3, c.act + 30).map(s => s.h), steps = hs.slice(1).map((h, i) => Math.abs(h - hs[i]));
  const landed = c.S.findIndex((s, i) => i > c.act && s.h === 0);
  expect('C → X aéreo', 'estava no ar', c.prev.h > 1.5, '> 1,5 m', c.prev.h.toFixed(2));
  expect('C → X aéreo', 'altura contínua no passo do X', Math.abs(c.at.h - c.prev.h) < .12, '|Δh| < 0,12', Math.abs(c.at.h - c.prev.h).toFixed(3));
  expect('C → X aéreo', 'maior variação de altura por passo', Math.max(...steps) < .2, '< 0,2 m', Math.max(...steps).toFixed(3));
  expect('C → X aéreo', 'chega ao chão no tempo de descida', Math.abs((landed - c.act) * STEP - ACTIONS.cancel.airDescent) <= 2 * STEP, ACTIONS.cancel.airDescent, ((landed - c.act) * STEP).toFixed(3));
  expect('C → X aéreo', 'sem nova direção: continua a de C', near(c.at.heading, 0), 0, c.at.heading);
  expect('C → X aéreo', 'invulnerabilidade não duplicada', c.invTicks <= Math.ceil((ACTIONS.dodge.invulnerable - k * STEP) / STEP), `≤ ${Math.ceil((ACTIONS.dodge.invulnerable - k * STEP) / STEP)}`, c.invTicks);
  expect('C → X aéreo', 'sem contato acima da altura de atravessamento', !c.r.events.some(e => e.tick < c.act + 3), 'nenhum', c.row.eventos || 'nenhum');
});
test('C → X sem stamina, fora da janela ou desligado: a esquiva continua intacta', () => {
  let c = cancelCase('stamina 1,5', 12, {stamina: 1.5});
  expect('C → X', 'sem stamina: X não começa', !c.S.some(s => s.kind === 'tackle') && near(c.at.stamina, .5), 'esquiva, stamina 0,5', `${c.at.kind}, ${c.at.stamina.toFixed(2)}`);
  ACTIONS.buffer.window = 0;ACTIONS.cancel.windowStart = .1;ACTIONS.cancel.windowEnd = .2;c = cancelCase('fora da janela (50 ms)', 6);
  expect('C → X', 'antes da janela (sem buffer): X ignorado', !c.S.some(s => s.kind === 'tackle'), 'sem X', c.S.some(s => s.kind === 'tackle') ? 'X' : 'sem X');
  restore();ACTIONS.cancel.dodgeToTackle = false;c = cancelCase('desligado', 30);
  expect('C → X', 'desligado: X ignorado durante C', !c.S.some(s => s.kind === 'tackle'), 'sem X', c.S.some(s => s.kind === 'tackle') ? 'X' : 'sem X');
});

// ---------- Recuo, guard stun e defesa ----------
/** O azul investe contra o vermelho, que defende de frente; devolve o jogo no primeiro passo de recuo. */
function blockedRecoil() {
  const g = setup({p0: vec(0, 0), p1: vec(0, 1.2), face1: Math.PI});g.fighters[1].perfectCooldown = 2;
  const guard = cmd({guard: true, target: 0});g.step(cmd({move: vec(0, 1), tackle: true, target: 1}), guard);
  while (g.fighters[0].action?.kind !== 'recoil') g.step(idle(), guard);
  return g;
}
test('recuo (GDD 8.2): X não sai; C e defesa saem imediatamente', () => {
  let g = blockedRecoil();g.step(cmd({move: vec(0, 1), tackle: true}), cmd({guard: true, target: 0}));
  expect('Recuo', 'X durante o recuo', g.fighters[0].action?.kind === 'recoil', 'recoil', g.fighters[0].action?.kind);
  g = blockedRecoil();g.step(cmd({move: vec(1, 0), dodge: true, dodgeDirection: vec(1, 0)}), cmd({guard: true, target: 0}));
  expect('Recuo', 'C durante o recuo', g.fighters[0].action?.kind === 'dodge', 'dodge', g.fighters[0].action?.kind);
  g = blockedRecoil();g.step(cmd({guard: true, guardPressed: true}), cmd({guard: true, target: 0}));
  expect('Recuo', 'defesa durante o recuo', g.fighters[0].action === null && g.fighters[0].guard, 'defesa', g.fighters[0].guard);
});
test('guard stun (GDD 5): X fica guardado e sai quando o stun acaba; segurar a defesa não descarta; novo toque descarta', () => {
  for (const [name, hold, press] of [['sem defesa', false, false], ['segurando a defesa', true, false], ['novo toque na defesa', true, true]]) {
    const g = blockedRecoil(), b = g.fighters[1];
    expect('Guard stun', `${name}: defensor em guard stun`, b.stun > 0, '> 0', b.stun);
    let fired = null, t = 0;
    for (; t < 60; t++) {
      const c1 = t === 0 ? cmd({move: vec(0, -1), tackle: true, target: 0, guard: hold}) : cmd({target: 0, guard: hold, guardPressed: press && t === 3});
      g.step(idle(), c1);if (b.action?.kind === 'tackle' && fired === null) fired = t;
      if (b.stun > 0) assert.notEqual(b.action?.kind, 'tackle', 'X não pode sair durante o stun');
    }
    if (press) expect('Guard stun', `${name}: pedido descartado`, fired === null, 'sem X', fired);
    else expect('Guard stun', `${name}: X sai no fim do stun`, fired !== null && fired <= Math.ceil(RULES.guardStun / STEP) + 1, `≤ ${Math.ceil(RULES.guardStun / STEP) + 1}`, fired);
  }
  const g = blockedRecoil();g.step(idle(), cmd({move: vec(1, 0), dodge: true, dodgeDirection: vec(1, 0), target: 0}));
  expect('Guard stun', 'C cancela o stun', g.fighters[1].action?.kind === 'dodge' && g.fighters[1].stun === 0, 'dodge, stun 0', `${g.fighters[1].action?.kind}, ${g.fighters[1].stun}`);
});
test('defesa: o defensor não desliza; defesa perfeita anula e abre contra-ataque', () => {
  const g = setup({p0: vec(0, 0), p1: vec(0, 1.6), face1: Math.PI});g.fighters[1].perfectCooldown = 2;
  const start = {...g.fighters[1].position}, r = run(g, 40, t => [t === 0 ? cmd({move: vec(0, 1), tackle: true, target: 1}) : idle(), cmd({guard: true, target: 0})]);
  const hit = r.events.find(e => e.result === 'partial'), base = r.samples[hit.tick][1], slide = Math.max(...r.samples.slice(hit.tick).map(s => Math.hypot(s[1].x - base.x, s[1].z - base.z)));void start;
  expect('Defesa', 'parcial: metade do dano', hit.damage === 10, 10, hit.damage);
  expect('Defesa', 'parcial: o defensor não é deslocado depois do contato', slide < 1e-6, '0 m', slide.toFixed(4));
  const p = setup({p0: vec(0, 0), p1: vec(0, 1.15), face1: Math.PI}), rp = run(p, 10, t => [t === 0 ? cmd({move: vec(0, 1), tackle: true, target: 1}) : idle(), cmd({guard: true, guardPressed: t === 0, target: 0})]);
  expect('Defesa perfeita', 'sem dano e janela de contra-ataque', rp.events.some(e => e.result === 'perfect') && p.fighters[1].hp === 100 && p.fighters[1].counterWindow > 0, `perfect, 100 HP, janela ${ACTIONS.perfectGuardCounterWindow} s`, `${p.fighters[1].hp} HP, ${p.fighters[1].counterWindow.toFixed(2)} s`);
});
test('esquiva perfeita: C invulnerável contra X dá stamina e contra-ataque; o X seguinte é mais rápido', () => {
  const g = setup({p0: vec(0, 0), p1: vec(0, 1.15), face1: Math.PI});
  const r = run(g, 30, t => [t === 2 ? cmd({move: vec(0, 1), tackle: true, target: 1}) : idle(), t === 2 ? cmd({move: vec(1, 0), dodge: true, dodgeDirection: vec(1, 0), target: 0}) : cmd({target: 0})]);
  const pd = r.events.filter(e => e.result === 'perfectDodge'), b = g.fighters[1];
  expect('Esquiva perfeita', 'registrada uma vez, sem dano', pd.length === 1 && b.hp === 100, '1 · 100 HP', `${pd.length} · ${b.hp}`);
  expect('Esquiva perfeita', 'stamina devolvida', near(r.samples[pd[0].tick][1].stamina, 3 - ACTIONS.dodge.cost + ACTIONS.dodge.perfectEvadeStamina, 1e-6), 3 - ACTIONS.dodge.cost + ACTIONS.dodge.perfectEvadeStamina, r.samples[pd[0].tick][1].stamina);
  expect('Esquiva perfeita', 'janela de contra-ataque aberta', b.counterWindow > 0, '> 0', b.counterWindow.toFixed(2));
  g.step(idle(), cmd({move: vec(0, -1), tackle: true, target: 0}));
  expect('Esquiva perfeita', 'X de contra-ataque mais rápido (×1,18) e consome a janela', b.action?.speedMultiplier === ACTIONS.tackle.counterSpeed && b.counterWindow === 0, ACTIONS.tackle.counterSpeed, b.action?.speedMultiplier);
});

// ---------- Clash ----------
test('clash: cada um recebe 30% do ataque do outro e é empurrado para trás; sem clash fora de frente', () => {
  const both = (p0, p1, d0, d1, att = [20, 20]) => {const g = setup({p0, p1});g.fighters[0].attributes.attack = att[0];g.fighters[1].attributes.attack = att[1];
    return [g, run(g, 120, t => [t === 2 ? cmd({move: d0, tackle: true, dodgeDirection: d0}) : idle(), t === 2 ? cmd({move: d1, tackle: true, dodgeDirection: d1}) : idle()])];};
  let [g, r] = both(vec(0, -1.6), vec(0, 1.6), vec(0, 1), vec(0, -1)), c = r.events.filter(e => e.result === 'clash');
  expect('Clash', 'frontal: dois eventos no mesmo passo', c.length === 2 && c[0].tick === c[1].tick, 2, c.length);
  expect('Clash', 'frontal: 30% do ataque do outro (6)', c.every(e => near(e.damage, 6)), '6 / 6', c.map(e => e.damage).join(' / '));
  expect('Clash', 'frontal: nenhum impacto além do clash', !r.events.some(e => e.result === 'impact'), 0, r.events.filter(e => e.result === 'impact').length);
  expect('Clash', 'frontal: os dois recuam', g.fighters[0].position.z < -1.6 + 1 && g.fighters[1].position.z > 1.6 - 1 && g.fighters[1].position.z - g.fighters[0].position.z > 1.5, 'separados', (g.fighters[1].position.z - g.fighters[0].position.z).toFixed(2));
  [g, r] = both(vec(-1.15, -1.15), vec(1.15, 1.15), unit(vec(1, 1)), unit(vec(-1, -1)));c = r.events.filter(e => e.result === 'clash');
  expect('Clash', 'diagonal', c.length === 2, 2, c.length);
  [g, r] = both(vec(0, -1.6), vec(0, 1.6), vec(0, 1), vec(0, -1), [16, 24]);c = r.events.filter(e => e.result === 'clash');
  expect('Clash', 'ataques diferentes (16 × 24)', near(c.find(e => e.target === 0).damage, 7.2) && near(c.find(e => e.target === 1).damage, 4.8), '7,2 (azul) / 4,8 (vermelho)', `${c.find(e => e.target === 0)?.damage} / ${c.find(e => e.target === 1)?.damage}`);
  const g2 = setup({p0: vec(-3, 0), p1: vec(-1, -3)}), r2 = run(g2, 150, t => [t === 0 ? cmd({move: vec(1, 0), tackle: true, dodgeDirection: vec(1, 0)}) : idle(), t === 60 ? cmd({move: vec(0, 1), tackle: true, dodgeDirection: vec(0, 1)}) : idle()]);
  expect('Clash', 'trajetórias cruzadas em tempos diferentes: nada', !r2.events.length, 0, r2.events.map(e => e.result).join(',') || 0);
  [g, r] = both(vec(0, -.6), vec(0, .6), vec(0, -1), vec(0, 1));
  expect('Clash', 'costas com costas se afastando: nada', !r.events.length, 0, r.events.length);
});

// ---------- Buffer, independência, regras gerais ----------
test('buffer de entrada: X antecipado sai na abertura; expira; desligado é perdido; a defesa descarta', () => {
  const chain = Math.round(ACTIONS.tackle.chainAfter / STEP), scenario = (pressAt, extra = {}) => {const g = setup();
    const r = run(g, 80, t => [t === 2 ? cmd({move: vec(1, 0), tackle: true, dodgeDirection: vec(1, 0)}) : t === 2 + pressAt ? cmd({move: vec(0, 1), dodge: true, dodgeDirection: vec(0, 1)}) : t === 2 + pressAt + 1 && extra.guardPress ? cmd({guard: true, guardPressed: true}) : idle()]);
    return r.samples.findIndex(s => s[0].kind === 'dodge');};
  let at = scenario(chain - 6);
  expect('Buffer', 'C 50 ms antes do encadeamento sai quando ele abre', Math.abs(at - (2 + chain)) <= 1, 2 + chain, at);
  at = scenario(chain - 18);expect('Buffer', 'C 150 ms antes: expira', at === -1, 'sem C', at);
  at = scenario(chain - 6, {guardPress: true});expect('Buffer', 'toque na defesa descarta', at === -1, 'sem C', at);
  ACTIONS.buffer.window = 0;at = scenario(chain - 6);expect('Buffer', 'desligado: pedido antecipado perdido', at === -1, 'sem C', at);
});
test('parâmetros de C e X são independentes', () => {
  ACTIONS.dodge.duration = .6;ACTIONS.tackle.cost = 2;
  let g = setup(), r = run(g, 100, t => [t === 2 ? cmd({move: vec(1, 0), dodge: true, dodgeDirection: vec(1, 0)}) : idle()]);
  expect('Independência', 'duração de C = 0,6 s', r.samples.filter(s => s[0].kind === 'dodge').length === Math.round(.6 / STEP) - 1, Math.round(.6 / STEP) - 1, r.samples.filter(s => s[0].kind === 'dodge').length);
  expect('Independência', 'custo de C continua 1', near(r.samples[3][0].stamina, 2), 2, r.samples[3][0].stamina);
  g = setup();r = run(g, 100, t => [t === 2 ? cmd({move: vec(1, 0), tackle: true, dodgeDirection: vec(1, 0)}) : idle()]);
  expect('Independência', 'duração de X continua 0,4 s', r.samples.filter(s => s[0].kind === 'tackle').length === Math.round(.4 / STEP) - 1, Math.round(.4 / STEP) - 1, r.samples.filter(s => s[0].kind === 'tackle').length);
  expect('Independência', 'custo de X = 2', near(r.samples[3][0].stamina, 1), 1, r.samples[3][0].stamina);
});
test('stamina: X e C custam 1 cada; três ações esgotam; exausto não age', () => {
  const g = setup(), r = run(g, 200, t => [t === 2 ? cmd({move: vec(1, 0), tackle: true, dodgeDirection: vec(1, 0)}) : t === 60 ? cmd({move: vec(0, 1), dodge: true, dodgeDirection: vec(0, 1)}) : t === 118 ? cmd({move: vec(-1, 0), tackle: true, dodgeDirection: vec(-1, 0)}) : t === 176 ? cmd({move: vec(0, -1), dodge: true, dodgeDirection: vec(0, -1)}) : idle()]);
  const starts = r.samples.filter((s, i) => s[0].kind && s[0].kind !== r.samples[i - 1]?.[0].kind).length;
  expect('Stamina', 'três ações aceitas, a quarta não', starts === 3 && g.fighters[0].exhausted, '3, exausto', `${starts}, ${g.fighters[0].exhausted}`);
});
test('um impacto por ação mesmo com contato prolongado contra a parede; resultado determinístico', () => {
  const h = TEST.arenaHalf, g = setup({p0: vec(0, h - 2.6), p1: vec(0, h - .6)}), r = run(g, 80, t => [t === 2 ? cmd({move: vec(0, 1), tackle: true, dodgeDirection: vec(0, 1)}) : cmd({move: vec(0, 1)})]);
  expect('Regras gerais', 'um impacto', damageTo(r, 1).length === 1, 1, damageTo(r, 1).length);
  const play = () => {const x = setup({p1: vec(0, 3)});run(x, 400, t => [t % 50 === 2 ? cmd({move: vec(0, 1), tackle: t % 100 === 2, dodge: t % 100 === 52, dodgeDirection: vec(0, 1), target: 1}) : idle(), t % 70 === 5 ? cmd({move: vec(0, -1), tackle: true, target: 0}) : idle()]);return JSON.stringify(x.snapshot());};
  expect('Regras gerais', 'mesma sequência, mesmo estado', play() === play(), 'igual', 'igual');
});

await writeFile(new URL('validation/etapa-a.json', root), JSON.stringify({passed, checks: report, cancel: cancelLog}, null, 2));
console.log(`${passed} cenários da Etapa A no jogo · ${report.length} verificações esperado × obtido`);
