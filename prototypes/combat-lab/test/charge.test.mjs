// Fase 1 (plano de Reflect/Psyshock) — Charge no controlador, sem navegador. Os movimentos abaixo existem só neste teste
// (prefixo “teste:”), com um efeito de teste: o núcleo do laboratório continua sem registrar nenhum Move (D2).
// Cobre: M2.3–M2.6, M5.8–M5.9, M7.1–M7.5, M7.9, M13.7, M15.1–M15.4, M16.1–M16.5, M16.8, M17.8, M19.1, M26s.8, M27.1, M27.4,
// M28.4 (instantâneo de parâmetros, D1), M30.9 (ordem das entradas) e M30.10 (valores provisórios).
import assert from 'node:assert/strict';
import {C, defaults, resetConfig, keyFor} from '../src/sim/config.js';
import {Game} from '../src/sim/game.js';
import {emptyCommand} from '../src/sim/entity.js';
import {vec} from '../src/sim/math.js';
import {registerMove, clearMoves, validateMove} from '../src/sim/moves.js';
import {registerEffect, clearEffects} from '../src/sim/move-effects.js';
import {walkSpeed} from '../src/sim/controller.js';
import {chargeParams, chargeLevel, boostPlan} from '../src/sim/charge.js';
import {spawn} from '../src/sim/world.js';
import {toCommand} from '../src/ui/input.js';
import {setAttemptSink, describe} from '../src/sim/attempts.js';

let n = 0;const ok = l => {n++;console.log('✓', l);};
const cmd = o => ({...emptyCommand(), ...o});
const H = (i = 0) => Array.from({length: 4}, (_, j) => j === i);
const press = (o = {}) => cmd({skill: 0, skillHeld: H(0), ...o});   // borda do botão + botão mantido
const hold = (o = {}) => cmd({skillHeld: H(0), ...o});               // botão mantido
const FWD = vec(0, 1);
const calls = [], behavior = {result: {ok: true}};
registerEffect('teste:fx', (g, f, def, fx) => {calls.push({move: def.id, level: fx.charge.level, seconds: fx.charge.seconds, tick: g.tick});return behavior.result;});
registerMove({id: 'teste:a', charge: {max: 4}, cost: 1, cooldown: 8, cooldownBoost: true, timeline: [{effect: 'teste:fx'}]});
registerMove({id: 'teste:b', charge: {max: 4}, cost: 1, cooldown: 8, cooldownBoost: true, timeline: [{effect: 'teste:fx'}, {effect: 'teste:fx'}]});
function arena() {
  resetConfig(defaults());calls.length = 0;behavior.result = {ok: true};
  const g = new Game();g.mode = 'inactive';g.reset({positions: [vec(0, -3), vec(0, 3)]});g.fighters[0].facing = 0;g.fighters[1].facing = Math.PI;g.setLoadout(0, ['teste:a', 'teste:b']);return g;
}
const events = [];
const step = (g, c = cmd()) => {g.step(c, cmd());events.push(...g.lastStepEvents);return g.lastStepEvents;};
const steps = (g, k, c = () => cmd()) => {for (let i = 0; i < k; i++) step(g, c(i));};
/** Aperta e segura por `k` passos no total (1 passo de toque + k−1 mantidos), sem soltar. */
const charge = (g, k) => {step(g, press());steps(g, k - 1, () => hold());};
const blue = g => g.fighters[0];
const near = (a, b, e = .01) => assert.ok(Math.abs(a - b) < e, `${a} ≠ ${b}`);

// ---------- Início, retenção e soltura ----------
{
  const g = arena(), f = blue(g), s0 = f.stamina;
  const ev = step(g, press());
  assert.ok(f.charge && f.charge.move === 'teste:a' && !f.action, 'o Charge não é uma ação (o lutador continua livre para andar)');
  near(f.stamina, s0 - 1);assert.equal(f.moveCooldowns['teste:a'], undefined, 'a recarga só começa na materialização/disparo (M2.4/M2.5)');
  assert.ok(ev.some(e => e.result === 'chargeStart' && e.attacker === 0), 'evento de início');
  steps(g, 49, () => hold());assert.equal(f.charge.ticks, 50);assert.equal(calls.length, 0, 'segurar não executa');
  const rel = step(g, cmd());                                       // soltou
  assert.equal(f.charge, null);assert.equal(calls.length, 1);assert.equal(calls[0].level, 1);
  near(calls[0].seconds, 50 / 120);near(f.moveCooldowns['teste:a'], 8);near(f.moveRecovery, .25);
  assert.ok(rel.some(e => e.result === 'chargeRelease' && e.level === 1));
}
ok('segurar acumula sem executar; soltar executa uma vez, cobra a recarga de 8 s e abre 0,25 s de recuperação (custo de 1 no início)');
{
  const g = arena();step(g, press());                                // toque: o botão já não está mantido no passo seguinte
  step(g, cmd());assert.equal(calls.length, 1);assert.equal(calls[0].level, 1, 'um toque rápido executa com carga mínima (PL1)');
}
ok('toque rápido (soltar no passo seguinte) executa com a carga mínima');

// ---------- Power Level por contagem de passos (M19.1) e carga máxima (M7.5) ----------
{
  const lv = k => {const g = arena();charge(g, k);step(g, cmd());return calls[0]?.level;};
  assert.deepEqual([lv(239), lv(240), lv(479), lv(480), lv(900)], [1, 2, 2, 3, 3]);
  const p = chargeParams({id: 'x', charge: {max: 4}});
  assert.equal(p.maxTicks, 480);assert.equal(p.pl2Ticks, 240);assert.equal(chargeLevel(239, p), 1);assert.equal(chargeLevel(240, p), 2);assert.equal(chargeLevel(480, p), 3);
  const g = arena();charge(g, 900);assert.equal(blue(g).charge.ticks, 480, 'permanece carregado no máximo, indefinidamente');
}
ok('PL1 abaixo de 2,0 s, PL2 de 2,0 s a antes de 4,0 s, PL3 em 4,0 s (contagem de passos); parado no máximo até soltar');

// ---------- Movimentação lenta (M2.6, M11.7, M16.5) ----------
{
  const g = arena(), f = blue(g), normal = walkSpeed(f);
  charge(g, 2);near(walkSpeed(f), normal * .75, 1e-12);
  let top = 0;steps(g, 80, () => hold({move: FWD}));top = Math.hypot(f.velocity.x, f.velocity.z);
  const h = arena(), g2 = blue(h);let free = 0;steps(h, 80, () => cmd({move: FWD}));free = Math.hypot(g2.velocity.x, g2.velocity.z);
  assert.ok(top > .5 && Math.abs(top / free - .75) < .02, `velocidade durante a carga ≈ 75% (${top} / ${free})`);
  const t = arena(), ft = blue(t);charge(t, 2);let maxTurn = 0;steps(t, 90, () => hold({move: vec(0, -1)}));
  // gira 180° para trás: a velocidade angular máxima observada é 75% do limite
  const t2 = arena(), f2 = blue(t2);let maxFree = 0;for (let i = 0; i < 90; i++) {step(t2, cmd({move: vec(0, -1)}));maxFree = Math.max(maxFree, Math.abs(f2.turnVelocity));}
  const t3 = arena(), f3 = blue(t3);charge(t3, 2);for (let i = 0; i < 90; i++) {step(t3, hold({move: vec(0, -1)}));maxTurn = Math.max(maxTurn, Math.abs(f3.turnVelocity));}
  void ft;assert.ok(maxFree > 1 && Math.abs(maxTurn / maxFree - .75) < .02, `giro durante a carga ≈ 75% (${maxTurn} / ${maxFree})`);
  const r = arena();charge(r, 5);step(r, cmd());assert.equal(walkSpeed(blue(r)), normal, 'volta ao normal imediatamente ao soltar (M16.5)');
}
ok('durante a carga: −25% na velocidade e no giro; ao soltar, velocidade normal na hora');

// ---------- Interrupções e cancelamentos (M7.2–M7.4, M15.1–M15.4, M16.1–M16.2, M25.4) ----------
{
  let g = arena(), f = blue(g), s0 = f.stamina;
  charge(g, 60);step(g, cmd({guard: true, guardPressed: true}));          // defesa e soltura no mesmo passo: a defesa vence
  assert.equal(calls.length, 0, 'sem execução');assert.equal(f.charge, null);assert.equal(f.guard, true, 'a defesa começa');
  near(f.moveCooldowns['teste:a'], 4);near(f.stamina, s0 - 1);                // custo mantido, metade da recarga
  assert.ok(events.some(e => e.result === 'chargeCancel' && e.reason === 'guard'));
  g = arena();f = blue(g);charge(g, 60);step(g, cmd({dodge: true, move: FWD}));   // C depois de 0,2 s e soltura no mesmo passo: o C vence
  assert.equal(calls.length, 0);assert.equal(f.action?.kind, 'dodge');near(f.moveCooldowns['teste:a'], 4);
  g = arena();f = blue(g);charge(g, 11);const ev = step(g, cmd({dodge: true, move: FWD}));   // C antes de 0,2 s: negado; a soltura dispara
  assert.equal(f.action, null, 'C antes de 0,2 s é negado');assert.equal(calls.length, 1, 'a soltura dispara');assert.ok(ev.some(e => e.result === 'chargeRelease'));
  g = arena();f = blue(g);charge(g, 100);step(g, hold({tackle: true}));
  assert.equal(f.action, null, 'Tackle indisponível durante o Charge (M15.2)');assert.ok(f.charge, 'e não cancela a carga');
}
ok('M30.9: defesa e C (após 0,2 s) cancelam a carga antes da soltura (custo mantido, recarga de 4 s); C antes de 0,2 s é negado e a soltura dispara; Tackle indisponível');
{
  const diag = [];setAttemptSink((f, e) => diag.push(describe(e)));
  const g = arena();charge(g, 5);step(g, hold({tackle: true}));step(g, hold({dodge: true, move: FWD}));setAttemptSink(null);
  assert.ok(diag.some(t => /X (ignorado|guardado no buffer): carga em andamento/.test(t)), diag.join(' | '));assert.ok(diag.some(t => /C (ignorado|guardado no buffer): a esquiva só cancela a carga depois de/.test(t)), diag.join(' | '));
}
ok('diagnóstico: Tackle e C negados durante a carga informam o motivo');
{
  const hitWith = hit => {
    const g = arena(), f = blue(g);charge(g, 60);
    spawn(g.world, {kind: 'projectile', owner: 1, pos: {x: 0, z: -2}, dir: {x: 0, z: -1}, y: .65, radius: .25, speed: 14, life: 2, hit}, []);
    steps(g, 40, () => hold());return {g, f};
  };
  let r = hitWith({damage: 5, knockback: {horizontal: 4, vertical: 3}});
  assert.equal(r.f.charge, null, 'golpe com lançamento interrompe');assert.ok(r.f.moveCooldowns['teste:a'] > 3 && r.f.moveCooldowns['teste:a'] <= 4, 'metade da recarga');assert.equal(calls.length, 0);
  assert.ok(events.some(e => e.result === 'chargeInterrupt' && e.reason === 'hit'));
  r = hitWith({damage: 5});
  assert.ok(r.f.charge, 'golpe só com dano, sem hit stun/knockback/lançamento, não interrompe (M15.3)');assert.ok(r.f.hp < 100);
}
ok('só golpes com lançamento ou hit stun interrompem (recarga de 4 s, custo mantido); dano puro não interrompe');
{
  const g = arena(), f = blue(g);
  spawn(g.world, {kind: 'projectile', owner: 1, pos: {x: 0, z: -2}, dir: {x: 0, z: -1}, y: .65, radius: .25, speed: 14, life: 2, hit: {damage: 5, knockback: {horizontal: 4, vertical: 3}}}, []);
  steps(g, 12);assert.ok(f.flight, 'lançado');step(g, press());assert.equal(f.charge, null, 'não inicia no ar (M27.1)');
}
ok('não inicia carga com o lutador lançado/sem apoio');

// ---------- Sem carga simultânea e recarga acelerada (M16.4, M17.8, M2.3, M5.8, M7.9, M16.8) ----------
{
  const g = arena(), f = blue(g);charge(g, 10);
  step(g, hold({skill: 1, skillHeld: [true, true, false, false]}));
  assert.equal(f.charge.move, 'teste:a', 'a segunda carga não começa');
  f.moveCooldowns['teste:b'] = 3;const s0 = f.stamina;
  step(g, hold({skill: 1, skillHeld: [true, true, false, false]}));
  near(f.moveCooldowns['teste:b'], 2);near(f.stamina, s0 - .5);assert.equal(f.charge.move, 'teste:a', 'acelerar a recarga de outro Move durante o Charge não inicia outra carga');
  assert.ok(events.some(e => e.result === 'cooldownBoost' && e.move === 'teste:b'));
}
ok('um segundo Move durante o Charge não carrega; se estiver em recarga, o toque a encurta em 1 s por 0,5 de stamina');
{
  const g = arena(), f = blue(g);f.moveCooldowns['teste:a'] = .4;const s0 = f.stamina;
  step(g, cmd({skill: 0, skillHeld: H(0)}));
  assert.equal(f.moveCooldowns['teste:a'], undefined, 'recarga restante menor que 1 s termina de vez');near(f.stamina, s0 - .2);assert.equal(f.charge, null, 'o toque só acelera; não inicia a carga');
  const bp = boostPlan(.4, chargeParams({id: 'x', charge: {}}));near(bp.reduce, .4);near(bp.cost, .2);
  f.moveCooldowns['teste:a'] = 5;step(g, hold());step(g, hold());near(f.moveCooldowns['teste:a'], 5 - 2 / 120);        // segurar não acelera (só novo toque)
}
ok('custo proporcional na fração final (0,4 s → 0,2 de stamina); segurar o botão não acelera, só um novo toque');
{
  const g = arena(), f = blue(g);f.stamina = .3;f.regenBase = .3;f.moveCooldowns['teste:a'] = 3;
  step(g, press());assert.equal(f.moveCooldowns['teste:a'] > 2.9, true, 'sem stamina suficiente, não acelera');
  const h = arena(), fh = blue(h);fh.stamina = .5;fh.regenBase = .5;fh.regenAge = 0;fh.exhausted = true;step(h, press());assert.equal(fh.charge, null);
}
ok('sem stamina suficiente não inicia nem acelera');

// ---------- Falha de execução (M13.7, M29.3) ----------
{
  const g = arena(), f = blue(g), s0 = f.stamina;behavior.result = {ok: false, reason: 'semEspaco'};
  charge(g, 30);const ev = step(g, cmd());
  assert.equal(calls.length, 1);near(f.stamina, s0);assert.equal(f.moveCooldowns['teste:a'], undefined, 'sem recarga');assert.equal(f.moveRecovery, 0, 'sem recuperação');
  assert.equal(ev.filter(e => e.result === 'moveFailed').length, 1);assert.equal(ev.find(e => e.result === 'moveFailed').reason, 'semEspaco');
  const b = arena(), fb = blue(b), sb = fb.stamina;behavior.result = {ok: false, reason: 'x'};b.setLoadout(0, ['teste:b']);
  charge(b, 30);const e2 = step(b, cmd());
  assert.equal(calls.length, 2, 'os dois eventos da linha do tempo rodam');near(fb.stamina, sb);assert.equal(e2.filter(e => e.result === 'moveFailed').length, 1, 'devolve uma única vez');
  const w = arena(), fw = blue(w), sw = fw.stamina;behavior.result = {ok: true};charge(w, 30);step(w, cmd());near(fw.stamina, sw - 1);
}
ok('falha no efeito: devolve a stamina uma única vez, sem recarga nem recuperação, com evento e motivo; sucesso mantém o custo');

// ---------- Recuperação de 0,25 s (M26s.8, M27.4) ----------
{
  const g = arena(), f = blue(g);charge(g, 30);step(g, cmd());
  step(g, cmd({tackle: true}));assert.equal(f.action, null, 'Tackle bloqueado na recuperação');
  f.moveCooldowns['teste:b'] = 0;step(g, press({skill: 1, skillHeld: [false, true, false, false]}));assert.equal(f.charge, null, 'novo Move bloqueado na recuperação');
  step(g, cmd({move: FWD}));assert.ok(Math.hypot(f.velocity.x, f.velocity.z) > 0, 'movimento permitido na recuperação');
  step(g, cmd({dodge: true, move: FWD}));assert.equal(f.action?.kind, 'dodge', 'Dodge permitido na recuperação');
  const h = arena(), fh = blue(h);charge(h, 30);step(h, cmd());steps(h, 29);assert.ok(fh.moveRecovery > 0);steps(h, 2);assert.equal(fh.moveRecovery, 0);step(h, cmd({tackle: true}));assert.equal(fh.action?.kind, 'tackle', 'Tackle volta depois de 0,25 s');
  const d = arena(), fd = blue(d);charge(d, 30);step(d, cmd());step(d, cmd({guard: true, guardPressed: true}));assert.equal(fd.guard, true, 'defesa permitida na recuperação');
}
ok('recuperação de 0,25 s: bloqueia Tackle e novos Moves; movimento, defesa e Dodge continuam permitidos');

// ---------- Esquiva → Move (M15.5, M16.3) ----------
{
  const g = arena(), f = blue(g);step(g, cmd({dodge: true, move: FWD}));steps(g, 9);
  step(g, press());assert.equal(f.charge, null, 'no começo da esquiva o Move é negado');assert.equal(f.skillBuffer, null, 'e não é guardado (fora dos últimos 0,15 s)');
  const h = arena(), fh = blue(h);step(h, cmd({dodge: true, move: FWD}));steps(h, 25);                   // ≈ 0,22 s: dentro dos últimos 0,15 s do deslocamento principal (0,352 s)
  step(h, press());assert.ok(fh.skillBuffer, 'comando guardado nos últimos 0,15 s');assert.equal(fh.charge, null);
  for (let i = 0; i < 30 && !fh.charge; i++) step(h, hold());
  assert.ok(fh.charge?.fromBuffer, 'a carga começa quando o deslocamento principal termina');assert.equal(fh.action, null);
  const k = arena(), fk = blue(k);step(k, cmd({dodge: true, move: FWD}));steps(k, 44);                   // depois do fim do deslocamento principal
  step(k, press());assert.ok(fk.charge, 'depois do fim do deslocamento principal começa na hora, mesmo na recuperação final');
}
ok('Move durante a esquiva: negado cedo; guardado nos últimos 0,15 s; começa no fim do deslocamento principal');

// ---------- Contrato M28.4 / D1: instantâneo capturado no início do uso ----------
{
  const g = arena(), f = blue(g);charge(g, 10);
  assert.ok(Object.isFrozen(f.charge.params), 'parâmetros congelados');
  C.world.charge.recovery = 5;C.world.charge.moveSlow = .1;C.world.charge.interruptCooldownFactor = .9;
  near(walkSpeed(f), f.attributes.speed * .75);                       // este uso mantém 75%
  step(g, cmd());near(f.moveRecovery, .25);                           // e a recuperação de 0,25 s
  const h = arena(), fh = blue(h);C.world.charge.recovery = 5;charge(h, 10);step(h, cmd());near(fh.moveRecovery, 5);    // o PRÓXIMO uso já usa o novo valor
  const c = arena(), fc = blue(c);charge(c, 10);C.world.charge.interruptCooldownFactor = .9;step(c, cmd({guard: true, guardPressed: true}));near(fc.moveCooldowns['teste:a'], 4);
}
ok('M28.4/D1: os parâmetros do uso são capturados ao apertar; alterar sliders durante a carga só vale para os usos seguintes');

// ---------- Determinismo, save/load e comandos ----------
{
  const run = (split) => {
    const g = arena();charge(g, 40);let h = g;
    if (split) {h = new Game();h.mode = 'inactive';h.load(g.save());}
    steps(h, 20, () => hold({move: FWD}));step(h, cmd());steps(h, 10);return JSON.stringify({f: h.fighters, calls});
  };
  const a = run(false);const callsA = [...calls];void callsA;const b = run(true);
  assert.equal(a.replace(/"calls".*/, ''), b.replace(/"calls".*/, ''), 'save/load no meio da carga reproduz a mesma partida');
  assert.equal(run(false), run(false), 'determinismo');
}
ok('save/load no meio da carga e repetição da mesma entrada produzem o mesmo resultado');
{
  const self = {position: vec(0, 0), combatHeading: 0, facing: 0}, tgt = {id: 1, position: vec(0, 5)};
  const c = toCommand({x: 0, forward: 0, dodge: false, tackle: false, guard: false, guardPressed: false, skill: 0, skillHeld: [true, false, false, false]}, self, tgt, 0, false);
  assert.deepEqual(c.skillHeld, [true, false, false, false]);assert.equal(c.skill, 0);
  assert.equal(toCommand({x: 0, forward: 0}, self, tgt, 0, false).skillHeld, null, 'sem botão de slot mantido, o comando fica como antes (null)');
  assert.equal(emptyCommand().skillHeld, null);
  assert.equal(keyFor('skill1'), 'KeyA');assert.equal(keyFor('skill2'), 'KeyS');          // D3: A e S são o padrão dos dois primeiros slots
}
ok('entrada: o comando carrega os botões de slot mantidos; padrão A e S nos slots 1 e 2');

// ---------- Validação das definições ----------
{
  assert.throws(() => validateMove({id: 'x', charge: {max: 0}}), /charge\.max/);
  assert.throws(() => validateMove({id: 'x', charge: {recovery: -1}}), /charge\.recovery/);
  assert.throws(() => validateMove({id: 'x', charge: {}, cooldownBoost: 'sim'}), /cooldownBoost/);
  assert.throws(() => validateMove({id: 'x', charge: {}, timeline: [{effect: 3}]}), /effect/);
  assert.throws(() => validateMove({id: 'x', timeline: []}), /duration/, 'movimento comum continua exigindo duração');
  assert.ok(validateMove({id: 'x', charge: {max: 2}, cooldownBoost: true, timeline: [{effect: 'teste:fx'}]}));
}
ok('validação: charge, cooldownBoost e efeito nomeado; movimento comum continua exigindo duração');

clearMoves();clearEffects();resetConfig(defaults());
console.log(`\n${n} verificações do Charge (Fase 1) aprovadas.`);
