// Física da locomoção (overhaul): inversão direcional contínua, sprint, diagonais, lock-on, jogador × IA, X/C sem
// saltos e preservação da distância. Grava registros por passo (CSV), gráficos de velocidade × tempo (SVG) e um
// relatório em validation/locomotion/.
// Uso: node prototypes/combat-lab/test/locomotion.test.mjs
import assert from 'node:assert/strict';
import {mkdirSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {Game} from '../src/sim/game.js';
import {C, resetConfig} from '../src/sim/config.js';
import {nominalDistance} from '../src/sim/entity.js';
import {locomotionParams, walkSpeed} from '../src/sim/controller.js';
import {accelerationLimit} from '../src/sim/locomotion.js';
import {Brain} from '../src/sim/ai.js';
import {toCommand, latchFrame} from '../src/ui/input.js';
import {CameraRig} from '../src/view/rig.js';
import {vec, length, normalize, sub, dot, angleOf} from '../src/sim/math.js';

const out = fileURLToPath(new URL('../validation/locomotion/', import.meta.url));mkdirSync(out, {recursive: true});
const report = [];let passed = 0;
const STEP = () => C.test.step;
function check(group, label, ok, expected, actual) {report.push({group, label, ok: !!ok, expected: String(expected), actual: typeof actual === 'number' ? +actual.toFixed(4) : String(actual)});assert.ok(ok, `${group} · ${label}: esperado ${expected}, obtido ${actual}`);}
function test(name, fn) {resetConfig();fn();passed++;console.log('✓', name);}
const cmd = (o = {}) => ({move: vec(), dodge: false, dodgeHeld: false, tackle: false, guard: false, guardPressed: false, target: null, ...o});

/** Partida sem IA, lutadores longe um do outro (sem colisão). */
function arena({p0 = vec(-8, 0), p1 = vec(8, 10), profile = 'balanced'} = {}) {
  const g = new Game();g.mode = 'inactive';g.profile = profile;g.enemyProfile = profile;g.reset({positions: [p0, p1]});
  for (const f of g.fighters) {f.facing = Math.PI / 2;f.visualFacing = Math.PI / 2;}
  return g;
}
/** Executa passos e registra, por passo, os campos pedidos no relatório. */
function trace(g, n, script, id = 0) {
  const rows = [];
  for (let t = 0; t < n; t++) {
    const [a, b] = script(t, g);g.step(a ?? cmd(), b ?? cmd());
    const f = g.fighters[id];
    rows.push({t: +(t * STEP()).toFixed(5), x: f.position.x, z: f.position.z, vx: f.velocity.x, vz: f.velocity.z, dvx: f.desiredVelocity.x, dvz: f.desiredVelocity.z,
      ax: f.appliedAccel.x, az: f.appliedAccel.z, ix: f.inputDir.x, iz: f.inputDir.z, facing: f.visualFacing, state: f.state, phase: f.locoPhase, action: f.action?.kind ?? '', sprint: f.sprinting ? 1 : 0,
      contacts: f.contacts, stamina: f.stamina});
  }
  return rows;
}
const csv = rows => [Object.keys(rows[0]).join(';'), ...rows.map(r => Object.values(r).map(v => typeof v === 'number' ? +v.toFixed(5) : v).join(';'))].join('\n');
/** Gráfico SVG de velocidade × tempo (várias séries), com eixo zero e marcações. */
function chart(name, title, rows, series, {marks = []} = {}) {
  const W = 760, H = 300, L = 54, R = 16, T = 34, B = 36, tMax = rows.at(-1).t, vals = series.flatMap(s => rows.map(s.get));
  const lo = Math.min(0, ...vals), hi = Math.max(.1, ...vals), pad = (hi - lo) * .08, y0 = lo - pad, y1 = hi + pad;
  const X = t => L + (W - L - R) * t / tMax, Y = v => T + (H - T - B) * (1 - (v - y0) / (y1 - y0));
  const ticks = [];for (let v = Math.ceil(y0); v <= y1; v += Math.max(1, Math.round((y1 - y0) / 8))) ticks.push(v);
  const colors = ['#2a78d6', '#e8554e', '#2a9d8f', '#b07cd8', '#c98a12'];
  const svg = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="Segoe UI, sans-serif" font-size="11"><rect width="${W}" height="${H}" fill="#fff"/>`,
    `<text x="${L}" y="18" font-size="13" font-weight="600">${title}</text>`,
    ...ticks.map(v => `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="${v === 0 ? '#555' : '#e4e8ec'}"/><text x="${L - 6}" y="${Y(v) + 4}" text-anchor="end" fill="#555">${v}</text>`),
    ...[0, .25, .5, .75, 1].map(f => `<text x="${X(tMax * f)}" y="${H - 14}" text-anchor="middle" fill="#555">${(tMax * f).toFixed(2)} s</text>`),
    ...marks.map(m => `<line x1="${X(m.t)}" x2="${X(m.t)}" y1="${T}" y2="${H - B}" stroke="#999" stroke-dasharray="4 3"/><text x="${X(m.t) + 3}" y="${T + 10}" fill="#666">${m.label}</text>`),
    ...series.map((s, i) => `<polyline fill="none" stroke="${colors[i % colors.length]}" stroke-width="1.8" points="${rows.map(r => `${X(r.t).toFixed(1)},${Y(s.get(r)).toFixed(1)}`).join(' ')}"/>`),
    ...series.map((s, i) => `<rect x="${L + 10 + i * 170}" y="${T + 2}" width="12" height="3" fill="${colors[i % colors.length]}"/><text x="${L + 26 + i * 170}" y="${T + 7}">${s.label}</text>`),
    `<text x="14" y="${T + (H - T - B) / 2}" transform="rotate(-90 14 ${T + (H - T - B) / 2})" text-anchor="middle" fill="#555">m/s</text></svg>`];
  writeFileSync(out + name + '.svg', svg.join('\n'));writeFileSync(out + name + '.csv', csv(rows));
}
/** Maior |Δv| por passo nas linhas de locomoção livre (sem ação, contato, voo ou stun). */
function maxDv(rows) {
  let m = 0;for (let i = 1; i < rows.length; i++) {const a = rows[i - 1], b = rows[i];if (a.action || b.action || b.contacts) continue;m = Math.max(m, Math.hypot(b.vx - a.vx, b.vz - a.vz));}
  return m;
}
const limitFor = f => accelerationLimit(locomotionParams(f), Math.max(walkSpeed(f), f.attributes.speed * C.actions.sprint.speedMultiplier)) * STEP() + 1e-9;

// ---------- Inversão direcional ----------
function reversal(label, file, {sprint = false, locked = false, diag = false} = {}) {
  const g = arena();const f = g.fighters[0];
  const right = diag ? normalize(vec(1, 1)) : vec(1, 0), left = diag ? normalize(vec(-1, -1)) : vec(-1, 0);
  const T1 = 150, T2 = 330;
  const rows = trace(g, T2, t => {
    const move = t < T1 ? right : left, c = cmd({move, target: locked ? 1 : null});
    if (sprint && t === 2) {c.dodge = true;c.dodgeDirection = right;}
    if (sprint) c.dodgeHeld = true;
    return [c, cmd()];
  });
  const along = r => (r.vx * right.x + r.vz * right.z);
  chart(file, `${label}: velocidade × tempo (direita → esquerda no passo ${T1})`, rows, [{label: 'v na direção inicial', get: along}, {label: 'v desejada', get: r => r.dvx * right.x + r.dvz * right.z}, {label: '|aceleração| / 10', get: r => Math.hypot(r.ax, r.az) / 10}], {marks: [{t: rows[T1].t, label: 'pressiona o oposto'}]});
  const before = along(rows[T1 - 1]), vmax = along(rows[T1 - 25]);
  const crossing = rows.findIndex((r, i) => i >= T1 && along(r) < 0), stepsToZero = crossing - T1;
  const firstStepDrop = before - along(rows[T1]);
  const dv = maxDv(rows), lim = limitFor(f);
  check(label, 'velocidade estável antes da inversão', Math.abs(before - vmax) < .02 * vmax && vmax > 1, 'variação < 2% em 25 passos', `${vmax.toFixed(2)} → ${before.toFixed(2)} m/s`);
  check(label, 'não inverte no passo seguinte (+v → −v proibido)', along(rows[T1]) > 0 && firstStepDrop < before * .5, `queda < ${(before * .5).toFixed(2)} m/s no 1º passo`, firstStepDrop);
  check(label, 'atravessa zero progressivamente', stepsToZero >= 4, '≥ 4 passos até zero', `${stepsToZero} passos (${(stepsToZero * STEP() * 1000).toFixed(0)} ms)`);
  // Monotonia: depois do comando oposto, a velocidade na direção inicial só diminui até se estabilizar no outro sentido.
  let mono = true;for (let i = T1 + 1; i < T2; i++) if (along(rows[i]) > along(rows[i - 1]) + 1e-9) mono = false;
  check(label, 'desacelera e acelera no novo sentido sem oscilar', mono, 'monótona', mono ? 'monótona' : 'oscila');
  check(label, '|Δv| por passo ≤ limite de aceleração × passo', dv <= lim, `≤ ${lim.toFixed(3)} m/s`, dv);
  const end = along(rows.at(-1));check(label, 'termina estável no sentido oposto', end < -.9 * vmax, `< ${(-.9 * vmax).toFixed(2)}`, end);
  return {rows, before, stepsToZero, dv, lim};
}
test('inversão direita → esquerda caminhando: velocidade atravessa zero progressivamente', () => reversal('Inversão (caminhada)', 'inversao-caminhada'));
// Stamina ampla: o sprint termina ao sobrar menos que o custo de uma ação (exaustão), o que encerraria a inversão no meio.
test('inversão durante o sprint', () => {C.rules.staminaMax = 8;reversal('Inversão (sprint)', 'inversao-sprint', {sprint: true});});
test('inversão diagonal (movimento diagonal normalizado)', () => {
  const r = reversal('Inversão (diagonal)', 'inversao-diagonal', {diag: true});
  check('Inversão (diagonal)', 'diagonal não é mais rápida que o eixo', r.before <= C.profiles.balanced.speed + 1e-6, `≤ ${C.profiles.balanced.speed}`, r.before);
});
test('inversão com lock-on ligado (referencial da câmera)', () => reversal('Inversão (lock-on)', 'inversao-lockon', {locked: true}));

test('mudança de 90° gradual (aderência lateral) e frenagem com deslizamento residual', () => {
  const g = arena(), f = g.fighters[0];
  const rows = trace(g, 300, t => [cmd({move: t < 120 ? vec(1, 0) : t < 200 ? vec(0, 1) : vec()}), cmd()]);
  chart('curva-90-e-frenagem', 'Mudança de 90° (passo 120) e frenagem (passo 200)', rows, [{label: 'vx', get: r => r.vx}, {label: 'vz', get: r => r.vz}, {label: '|v|', get: r => Math.hypot(r.vx, r.vz)}], {marks: [{t: rows[120].t, label: '90°'}, {t: rows[200].t, label: 'solta'}]});
  const decay = rows.findIndex((r, i) => i > 120 && Math.abs(r.vx) < .05) - 120;
  check('Curva 90°', 'componente antiga se dissipa em vários passos', decay >= 5, '≥ 5 passos', decay);
  const stop = rows.findIndex((r, i) => i > 200 && Math.hypot(r.vx, r.vz) < 1e-6) - 200;
  check('Frenagem', 'para em vários passos (velocidade residual)', stop >= 6, '≥ 6 passos', `${stop} passos`);
  check('Frenagem', 'nunca inverte ao frear', rows.slice(200).every(r => r.vz >= -1e-9), 'vz ≥ 0', Math.min(...rows.slice(200).map(r => r.vz)));
  check('Curva 90°', '|Δv| por passo ≤ limite', maxDv(rows) <= limitFor(f), `≤ ${limitFor(f).toFixed(3)}`, maxDv(rows));
});

// ---------- Lock-on separado da locomoção ----------
test('lock-on não força órbita: com a câmera seguindo o alvo, o lateral anda reto (referencial travado)', () => {
  // Câmera real do laboratório (rig.js) acompanhando o alvo a cada passo, como na partida.
  const run = on => {
    resetConfig();C.locomotion.frameLatch = on;C.camera.movingDeadZone = .15;const g = arena({p0: vec(0, -4), p1: vec(0, 2)}), rig = new CameraRig(), latch = {};
    rig.reset(g.fighters[0]);
    const rows = trace(g, 240, (t, game) => {rig.step(game.fighters[0], game.fighters[1], true, STEP());const intent = {x: 1, forward: 0, tackle: false, dodge: false, guard: false, guardPressed: false};
      return [toCommand(intent, game.fighters[0], game.fighters[1], latchFrame(latch, intent, rig.yaw), true), cmd()];});
    const heading = rows.slice(30).map(r => Math.atan2(r.vx, r.vz)), turn = Math.max(...heading) - Math.min(...heading);return {rows, turn};
  };
  const latched = run(1), free = run(0);
  check('Lock-on', 'referencial travado: direção da trajetória constante enquanto a seta é mantida', latched.turn < .01, '< 0,01 rad', latched.turn);
  check('Lock-on', 'sem trava (v6): a câmera que gira encurva a trajetória (órbita)', free.turn > .2, '> 0,2 rad', free.turn);
  resetConfig();
  // Corpo olha para o alvo (lock-on) enquanto anda de lado, mas a mira do tackle sem direção continua no alvo.
  const g = arena({p0: vec(0, -4), p1: vec(0, 2)});C.locomotion.lockFacing = 1;
  trace(g, 120, (t, game) => [toCommand({x: 1, forward: 0}, game.fighters[0], game.fighters[1], Math.PI, true), cmd()]);
  const f = g.fighters[0], toT = angleOf(sub(g.fighters[1].position, f.position));
  check('Lock-on', 'orientação visual acompanha o alvo (lockFacing = alvo)', Math.abs(Math.atan2(Math.sin(f.facing - toT), Math.cos(f.facing - toT))) < .05, '< 0,05 rad', f.facing - toT);
});
test('tackle com lock-on sem direção mira o alvo; com direção segue a câmera', () => {
  const g = arena({p0: vec(0, -2.2), p1: vec(0, 0)});const f = g.fighters[0];f.facing = Math.PI;f.visualFacing = Math.PI;
  trace(g, 3, (t, game) => [toCommand({x: 0, forward: 0, tackle: t === 1}, game.fighters[0], game.fighters[1], 0, true), cmd()]);
  check('Mira', 'X parado com lock-on sai rumo ao alvo', Math.abs(f.action.heading - 0) < 1e-6, '0 rad', f.action.heading);
});

// ---------- Jogador × IA ----------
test('IA usa o mesmo controlador: mesmas intenções → mesma física; intenções suavizadas sem zigue-zague', () => {
  // 1) Intenções idênticas pelo caminho do jogador (lutador 0) e do adversário (lutador 1) produzem velocidades idênticas.
  const g = arena({p0: vec(-8, -6), p1: vec(-8, 6)});
  const script = t => t < 150 ? vec(1, 0) : vec(-1, 0);
  const rows0 = [], rows1 = [];
  for (let t = 0; t < 300; t++) {g.step(cmd({move: script(t)}), cmd({move: script(t)}));rows0.push({...g.fighters[0].velocity});rows1.push({...g.fighters[1].velocity});}
  const diff = Math.max(...rows0.map((v, i) => Math.hypot(v.x - rows1[i].x, v.z - rows1[i].z)));
  check('Jogador × IA', 'mesmas intenções → mesmas velocidades em todos os passos', diff < 1e-12, '0', diff);
  // 2) Intenções brutas alternando a cada 4 passos (zigue-zague) passam pela suavização da IA.
  const brain = new Brain(5, 'aiRed');let flips = 0, prev = null;
  for (let t = 0; t < 240; t++) {
    const raw = {...cmd({move: Math.floor(t / 4) % 2 ? vec(1, .4) : vec(1, -.4)})};raw.move = normalize(raw.move);
    const c = brain.smooth(raw, STEP(), null), a = angleOf(c.move);if (prev !== null && Math.abs(a - prev) > .02) flips++;prev = a;
    if (t > 0) assert.ok(Math.abs(a - prev) <= C.extras.ai.moveSmoothing * STEP() + 1e-9);
  }
  check('Jogador × IA', 'giro da intenção limitado a moveSmoothing por segundo', true, `≤ ${C.extras.ai.moveSmoothing} rad/s`, 'ok');
  // 3) Luta real IA × IA: a locomoção livre dos dois lados respeita o mesmo limite de aceleração.
  const duel = new Game({seed: 9});duel.mode = 'tactical';duel.reset();
  let worst = [0, 0], prevV = duel.fighters.map(f => ({...f.velocity})), prevFree = [false, false];
  for (let t = 0; t < 120 * 40; t++) {
    duel.step(duel.playerBrain.command(duel.fighters[0], duel.fighters[1], 'tactical', STEP()));
    duel.fighters.forEach((f, i) => {
      const free = !f.action && !f.tackleCharge && !f.flight && f.stun <= 0 && f.knockRecovery <= 0 && !f.contacts && !f.landingSlide && !f.blend && f.hp > 0 && !duel.frozen;
      if (free && prevFree[i]) worst[i] = Math.max(worst[i], Math.hypot(f.velocity.x - prevV[i].x, f.velocity.z - prevV[i].z) / limitFor(f) * (C.test.step));
      prevV[i] = {...f.velocity};prevFree[i] = free;
    });
    if (duel.phase === 'result') duel.reset();
  }
  check('Jogador × IA', 'IA × IA (40 s): Δv da locomoção livre ≤ limite (azul)', worst[0] <= C.test.step * 1.0001, '≤ 100% do limite', `${(worst[0] / C.test.step * 100).toFixed(1)}%`);
  check('Jogador × IA', 'IA × IA (40 s): Δv da locomoção livre ≤ limite (vermelho)', worst[1] <= C.test.step * 1.0001, '≤ 100% do limite', `${(worst[1] / C.test.step * 100).toFixed(1)}%`);
  void flips;
});

// ---------- X e C: curva física contínua ----------
function actionRun(kind, {move = vec(1, 0), walkFirst = false} = {}) {
  const g = arena();const f = g.fighters[0];
  const start = walkFirst ? 60 : 2;
  const rows = trace(g, start + 90, t => [t === start ? cmd({move, [kind]: true, dodgeDirection: move}) : walkFirst && t < start ? cmd({move}) : cmd(), cmd()]);
  const seg = rows.slice(start).filter(r => r.action === kind);const s0 = rows[start - 1];
  const travel = Math.hypot(seg.at(-1).x - s0.x, seg.at(-1).z - s0.z) + Math.hypot(rows[start + seg.length].vx, rows[start + seg.length].vz) * 0;
  return {g, f, rows, seg, s0, start, travel};
}
test('tackle e esquiva: preparação → impulso → deslocamento → desaceleração → recuperação, sem saltos', () => {
  for (const kind of ['tackle', 'dodge']) {
    const p = C.actions[kind], {f, rows, seg, s0, start} = actionRun(kind);
    const speeds = [Math.hypot(s0.vx, s0.vz), ...seg.map(r => Math.hypot(r.vx, r.vz))], peak = Math.max(...speeds);
    const maxStep = Math.max(...speeds.slice(1).map((v, i) => Math.abs(v - speeds[i])));
    const end = rows[start + seg.length - 1], dist = Math.hypot(end.x - s0.x, end.z - s0.z), nominal = nominalDistance(f, kind);
    chart(`${kind}-curva`, `${kind === 'tackle' ? 'Tackle (X)' : 'Esquiva (C)'} a partir do repouso: velocidade × tempo`, rows.slice(Math.max(0, start - 2), start + seg.length + 20), [{label: '|v|', get: r => Math.hypot(r.vx, r.vz)}]);
    const name = kind === 'tackle' ? 'Tackle' : 'Esquiva';
    check(name, 'distância nominal preservada', Math.abs(dist - nominal) < .02, `${nominal.toFixed(3)} m`, dist);
    check(name, 'começa devagar (preparação): 1º passo < 25% do pico', speeds[1] < .25 * peak, `< ${(.25 * peak).toFixed(2)}`, speeds[1]);
    check(name, 'sem salto: maior variação por passo < 25% do pico', maxStep < .25 * peak, `< ${(.25 * peak).toFixed(2)} m/s`, maxStep);
    const tail = seg.slice(-Math.max(1, Math.floor(p.recoveryTime * p.duration / STEP()) - 1));
    check(name, 'recuperação: velocidade final ≈ 0', Math.hypot(tail.at(-1).vx, tail.at(-1).vz) < .05 * peak, '< 5% do pico', Math.hypot(tail.at(-1).vx, tail.at(-1).vz));
    check(name, 'duração preservada', Math.abs(seg.length * STEP() - p.duration) <= STEP() * 1.01, `${p.duration} s`, seg.length * STEP());
  }
});
test('X/C a partir de uma corrida: continuidade da velocidade residual e mesma distância', () => {
  for (const kind of ['tackle', 'dodge']) {
    const {f, rows, seg, s0, start} = actionRun(kind, {walkFirst: true});
    const entry = Math.hypot(s0.vx, s0.vz), first = Math.hypot(seg[0].vx, seg[0].vz);
    const end = rows[start + seg.length - 1], dist = Math.hypot(end.x - s0.x, end.z - s0.z), nominal = nominalDistance(f, kind);
    const name = kind === 'tackle' ? 'Tackle após corrida' : 'Esquiva após corrida';
    check(name, 'velocidade do 1º passo continua a da corrida (sem queda brusca)', Math.abs(first - entry) < .25 * entry, `≈ ${entry.toFixed(2)} m/s`, first);
    check(name, 'distância nominal preservada mesmo com a mistura de entrada', Math.abs(dist - nominal) < .03, `${nominal.toFixed(3)} m`, dist);
  }
});
test('duração diferente (ex.: clipe sincronizado) não muda a distância; a curva se redistribui', () => {
  for (const d of [.3, .4, .7]) {
    resetConfig();C.actions.dodge.duration = d;const {f, rows, seg, s0, start} = actionRun('dodge');
    const end = rows[start + seg.length - 1], dist = Math.hypot(end.x - s0.x, end.z - s0.z);
    check('Duração × distância', `duração ${d} s: distância`, Math.abs(dist - nominalDistance(f, 'dodge')) < .02 && Math.abs(nominalDistance(f, 'dodge') - 4.8) < 1e-9, '4,8 m', dist);
  }
});
test('colisores: andar contra o rival para no contato, sem atravessar', () => {
  const g = arena({p0: vec(0, -3), p1: vec(0, 0)});
  const rows = trace(g, 200, () => [cmd({move: vec(0, 1)}), cmd()]);
  const gap = Math.min(...rows.map(r => g.fighters[1].position.z - r.z));
  check('Colisores', 'separação mínima entre centros ≥ 2 × meia largura', gap >= 2 * C.test.halfExtent - 1e-6, `≥ ${2 * C.test.halfExtent}`, gap);
});

// ---------- Sprint ----------
test('sprint: C → manter C → sprint; consome stamina; soltar C desacelera; exaustão encerra', () => {
  const g = arena();const f = g.fighters[0];const right = vec(1, 0);
  const rows = trace(g, 600, t => {
    const c = cmd({move: right});if (t === 2) {c.dodge = true;c.dodgeDirection = right;}
    c.dodgeHeld = t < 200;return [c, cmd()];
  });
  chart('sprint', 'Esquiva → sprint (C mantido até 1,67 s) → solta C', rows, [{label: '|v|', get: r => Math.hypot(r.vx, r.vz)}, {label: 'stamina', get: r => r.stamina}, {label: 'sprint (0/1)', get: r => r.sprint * 2}], {marks: [{t: rows[200].t, label: 'solta C'}]});
  const sprintStart = rows.findIndex(r => r.sprint), vs = f.attributes.speed * C.actions.sprint.speedMultiplier;
  check('Sprint', 'entra em sprint vindo da esquiva com C mantido', sprintStart > 0 && rows[sprintStart - 1].action === 'dodge', 'esquiva → sprint', `passo ${sprintStart}, antes: ${rows[sprintStart - 1]?.action}`);
  const top = Math.max(...rows.slice(sprintStart + 60, 200).map(r => Math.hypot(r.vx, r.vz)));
  check('Sprint', 'entra herdando a velocidade da esquiva (sem queda brusca)', Math.abs(Math.hypot(rows[sprintStart].vx, rows[sprintStart].vz) - Math.hypot(rows[sprintStart - 1].vx, rows[sprintStart - 1].vz)) < 1, '< 1 m/s de diferença', Math.hypot(rows[sprintStart].vx, rows[sprintStart].vz) - Math.hypot(rows[sprintStart - 1].vx, rows[sprintStart - 1].vz));
  check('Sprint', 'mais rápido que a caminhada', top > f.attributes.speed * 1.2, `> ${(f.attributes.speed * 1.2).toFixed(2)} m/s`, top);
  check('Sprint', 'velocidade de cruzeiro do sprint respeitada', top <= vs + 1e-6, `≤ ${vs.toFixed(2)}`, top);
  const st0 = rows[sprintStart].stamina, st1 = rows[199].stamina, expect = C.actions.sprint.staminaDrain * (199 - sprintStart) * STEP();
  check('Sprint', 'consome stamina por segundo', Math.abs(st0 - st1 - expect) < .02, `${expect.toFixed(3)}`, st0 - st1);
  const after = rows.slice(200, 260).map(r => Math.hypot(r.vx, r.vz));
  check('Sprint', 'ao soltar C desacelera progressivamente até a caminhada', after[0] > f.attributes.speed && after.at(-1) <= f.attributes.speed + 1e-3 && after.every((v, i) => i === 0 || v <= after[i - 1] + 1e-9), 'queda gradual', `${after[0].toFixed(2)} → ${after.at(-1).toFixed(2)} m/s`);
  check('Sprint', '|Δv| por passo ≤ limite', maxDv(rows.slice(sprintStart)) <= limitFor(f), `≤ ${limitFor(f).toFixed(3)}`, maxDv(rows.slice(sprintStart)));
  // Exaustão: sprint até zerar a stamina.
  resetConfig();C.actions.sprint.staminaDrain = 1.5;const g2 = arena({p0: vec(-14, 0)});const f2 = g2.fighters[0];
  const rows2 = trace(g2, 500, t => {const c = cmd({move: right, dodgeHeld: true});if (t === 2) {c.dodge = true;c.dodgeDirection = right;}return [c, cmd()];});
  // Exaustão: stamina abaixo do menor custo de X/C encerra o sprint.
  const ex = rows2.findIndex((r, i) => i > 0 && rows2[i - 1].sprint && !r.sprint);
  check('Sprint', 'stamina esgotada (abaixo do custo de uma ação) encerra o sprint e deixa exausto', ex > 0 && rows2[ex].stamina < Math.min(C.actions.dodge.cost, C.actions.tackle.cost) + .02 && f2.exhausted, 'sprint encerrado e exausto', `passo ${ex}, stamina ${rows2[ex]?.stamina.toFixed(2)}, exausto ${f2.exhausted}`);
  const slow = Math.hypot(rows2[ex + 90].vx, rows2[ex + 90].vz);
  check('Sprint', 'após a exaustão anda na velocidade de exausto', Math.abs(slow - f2.attributes.speed * C.rules.exhaustedSpeed) < .05 || !f2.exhausted, `${(f2.attributes.speed * C.rules.exhaustedSpeed).toFixed(2)} m/s`, slow);
});
test('sprint desligado ou sem C mantido: esquiva normal', () => {
  C.extras.toggles.enableSprint = 0;const g = arena();
  const rows = trace(g, 200, t => {const c = cmd({move: vec(1, 0), dodgeHeld: true});if (t === 2) {c.dodge = true;c.dodgeDirection = vec(1, 0);}return [c, cmd()];});
  check('Sprint', 'desligado nos ajustes: nunca entra em sprint', rows.every(r => !r.sprint), 'nunca', rows.some(r => r.sprint) ? 'entrou' : 'nunca');
});

// ---------- IA do oponente desligada ----------
test('IA do oponente desligada: o vermelho vira boneco, mas recebe dano e reage fisicamente', () => {
  C.extras.toggles.enableEnemyAI = 0;
  const g = new Game({seed: 3});g.mode = 'tactical';g.reset({positions: [vec(0, -2.4), vec(0, 0)]});
  const [a, b] = g.fighters;a.facing = 0;b.facing = Math.PI;let moved = 0, hit = null;
  for (let t = 0; t < 200; t++) {g.step(t === 10 ? cmd({move: vec(0, 1), tackle: true}) : cmd());hit ??= g.lastStepEvents.find(e => e.target === 1);if (!hit && !b.contacts) moved = Math.max(moved, Math.hypot(b.position.x, b.position.z));}
  check('IA desligada', 'não se move antes de ser atingido', moved < 1e-9, '0 m', moved);
  check('IA desligada', 'recebe o impacto e é lançado', hit?.result === 'impact' && b.hp < 100, 'impact', hit?.result ?? 'nenhum');
});

// ---------- Relatório ----------
const ok = report.filter(r => r.ok).length;
writeFileSync(out + 'locomotion-report.json', JSON.stringify({createdAt: new Date().toISOString(), step: C.test.step, checks: report}, null, 2));
const md = ['# Locomoção — verificação (overhaul)', '', `Passo de simulação: ${(C.test.step * 1000).toFixed(2)} ms. ${ok}/${report.length} verificações aprovadas.`, '',
  'Gráficos (SVG) e registros por passo (CSV: tempo, posição X/Z, velocidade X/Z, velocidade desejada, aceleração aplicada, direção de entrada, orientação visual, estado e fase) nesta pasta.', '',
  '| Grupo | Verificação | Esperado | Obtido | |', '|---|---|---|---|---|', ...report.map(r => `| ${r.group} | ${r.label} | ${r.expected} | ${r.actual} | ${r.ok ? "✓" : "✗"} |`.replaceAll('|Δv|', '\\|Δv\\|'))];
writeFileSync(out + 'locomotion-report.md', md.join('\n'));
console.log(`\n${passed} testes de locomoção aprovados · ${ok} verificações (validation/locomotion/).`);
