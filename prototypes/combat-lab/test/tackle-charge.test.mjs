// Fase 1 do Tackle carregado: carga estática, níveis de PL, X no sprint, PL nas disputas e interrupção. Sem navegador.
import assert from 'node:assert/strict';
import {C, defaults, resetConfig} from '../src/sim/config.js';
import {Game} from '../src/sim/game.js';
import {emptyCommand} from '../src/sim/entity.js';
import {vec} from '../src/sim/math.js';
import {spawn} from '../src/sim/world.js';
import {registerStandardMoves} from '../src/sim/moves/standard.js';
import {tackleChargeLevel} from '../src/sim/controller.js';

registerStandardMoves();
let n = 0;const ok = l => {n++;console.log('✓', l);};
const cmd = o => ({...emptyCommand(), ...o});
function arena({blue = vec(0, -6), red = vec(0, 6), over = {}} = {}) {
  resetConfig(defaults());
  for (const [p, v] of Object.entries(over)) {const k = p.split('.'), last = k.pop();k.reduce((a, x) => a[x], C)[last] = v;}
  const g = new Game();g.mode = 'inactive';g.reset({positions: [blue, red]});g.fighters[0].facing = 0;g.fighters[1].facing = Math.PI;return g;
}
const step = (g, a = cmd(), b = cmd()) => {g.step(a, b);return g.lastStepEvents;};
const hold = (g, seconds, extra = {}) => {const k = Math.round(seconds / C.test.step);for (let i = 0; i < k; i++) step(g, cmd({tackle: i === 0, tackleHeld: true, move: vec(0, 1), ...extra}));};
const releaseAfter = (over, seconds) => {const g = arena({over});hold(g, seconds);step(g, cmd({move: vec(0, 1)}));return g;};

// Níveis
assert.equal(tackleChargeLevel(.3, 1.2), 1);assert.equal(tackleChargeLevel(.6, 1.2), 2);assert.equal(tackleChargeLevel(1.19, 1.2), 2);assert.equal(tackleChargeLevel(1.2, 1.2), 3);
ok('níveis de PL: abaixo de 50% PL1, de 50% a 99% PL2, 100% PL3');

// Carga estática, dreno e disparo ao soltar
{
  const g = arena();const f = g.fighters[0], s0 = f.stamina;hold(g, .3);
  assert.ok(f.tackleCharge && !f.action, 'carregando, sem ação');assert.equal(f.state, 'tackleCharge');
  const p0 = {...f.position};hold(g, .2);assert.ok(Math.abs(f.position.z - p0.z) < 1e-6 && Math.abs(f.position.x - p0.x) < 1e-6, 'parado enquanto carrega (sem locomoção)');
  assert.ok(f.stamina < s0 - C.actions.tackle.cost - .2, `dreno durante a carga (${(s0 - f.stamina).toFixed(2)})`);
  step(g, cmd({move: vec(0, 1)}));assert.equal(f.action?.kind, 'tackle', 'soltar dispara');assert.equal(f.action.pl, 1);assert.ok(!f.tackleCharge);
  ok('segurar X: parado, dreno por segundo e disparo ao soltar (PL1 abaixo de 50%)');
}
for (const [secs, pl] of [[.35, 1], [.7, 2], [1.4, 3]]) {
  const g = releaseAfter({}, secs), a = g.fighters[0].action;
  assert.equal(a.pl, pl, `${secs}s → PL${pl}`);
  assert.equal(a.plSpeed, [1, C.rules.chargeTackleSpeed2, C.rules.chargeTackleSpeed3][pl - 1]);
  assert.equal(a.plDamage, [1, C.rules.chargeTackleDamage2, C.rules.chargeTackleDamage3][pl - 1]);
}
ok('soltar em 0,35 s / 0,7 s / 1,4 s dá PL1 / PL2 / PL3 com os multiplicadores dos sliders');

// Alcance e dano crescem com o PL
{
  const run = secs => {const g = releaseAfter({'test.arenaHalf': 40}, secs), f = g.fighters[0], z0 = f.position.z;for (let i = 0; i < 300 && f.action; i++) step(g, cmd({move: vec(0, 1)}));return f.position.z - z0;};
  const d1 = run(.1), d3 = run(1.4);assert.ok(d3 > d1 * 1.45, `PL3 vai bem mais longe (${d1.toFixed(2)} → ${d3.toFixed(2)} m)`);
  const hit = secs => {
    const g = arena({blue: vec(0, -2.2), red: vec(0, 0)});hold(g, secs);step(g, cmd({move: vec(0, 1)}));
    for (let i = 0; i < 120; i++) step(g, cmd({move: vec(0, 1)}), cmd());
    return 100 - g.fighters[1].hp;
  };
  const h1 = hit(.1), h3 = hit(1.4);assert.ok(h1 > 0 && Math.abs(h3 / h1 - C.rules.chargeTackleDamage3) < .05, `dano PL3 = ${C.rules.chargeTackleDamage3}× (${h1} → ${h3})`);
  ok('PL3 percorre mais e causa o dano multiplicado do slider');
}

// Stamina acaba: solta sozinho no PL atual
{
  const g = arena({over: {'rules.chargeTackleDrain': 6}}), f = g.fighters[0];f.stamina = 2;let pl = 0;
  for (let i = 0; i < 120 && !pl; i++) {step(g, cmd({tackle: i === 0, tackleHeld: true, move: vec(0, 1)}));if (f.action?.kind === 'tackle') pl = f.action.pl;}
  assert.ok(pl >= 1, 'sem stamina o tackle sai sozinho, ainda com o botão apertado');
  ok('acabar a stamina solta o tackle no PL alcançado');
}

// Golpe sofrido cancela e não devolve stamina
{
  const g = arena({blue: vec(0, -1.2), red: vec(0, 1.2)});const f = g.fighters[0];hold(g, .3);const s = f.stamina;
  assert.ok(f.tackleCharge);
  for (let i = 0; i < 100 && f.tackleCharge; i++) step(g, cmd({tackleHeld: true}), i === 3 ? cmd({tackle: true, move: vec(0, -1)}) : cmd({move: i > 3 ? vec(0, -1) : vec()}));
  assert.equal(f.tackleCharge, null, 'o golpe cancela a carga');assert.ok(f.stamina <= s + 1e-6, 'a stamina gasta não volta');
  ok('golpe sofrido cancela a carga sem devolver stamina');
}

// X no sprint = PL2 imediato; C → X sem carga; toggle desligado = imediato
{
  const g = arena();const f = g.fighters[0];f.sprinting = true;step(g, cmd({tackle: true, tackleHeld: true, move: vec(0, 1), dodgeHeld: true}));
  assert.equal(f.action?.kind, 'tackle');assert.equal(f.action.pl, C.rules.sprintTacklePL, 'sprint: PL2 imediato');assert.ok(!f.tackleCharge);
  const g2 = arena();const f2 = g2.fighters[0];step(g2, cmd({dodge: true, move: vec(0, 1)}));for (let i = 0; i < 36; i++) step(g2, cmd({move: vec(0, 1)}));
  step(g2, cmd({tackle: true, tackleHeld: true, move: vec(0, 1)}));
  assert.equal(f2.action?.kind, 'tackle');assert.equal(f2.action.pl ?? 1, 1, 'C → X: PL1');assert.ok(!f2.tackleCharge, 'C → X: sem carga');
  const g3 = arena({over: {'extras.toggles.enableChargeTackle': 0}});step(g3, cmd({tackle: true, tackleHeld: true, move: vec(0, 1)}));
  assert.equal(g3.fighters[0].action?.kind, 'tackle');assert.ok(!g3.fighters[0].tackleCharge, 'toggle desligado: X imediato');
  const g4 = arena();step(g4, cmd({tackle: true, move: vec(0, 1)}));assert.equal(g4.fighters[0].action?.kind, 'tackle', 'sem tackleHeld (IA/legado): imediato');
  ok('X no sprint vira PL2; C → X continua imediato; toggle desligado e comando sem tackleHeld = X imediato');
}

// C ou D cancelam a carga
{
  const g = arena();hold(g, .3);step(g, cmd({guard: true, tackleHeld: true}));assert.ok(!g.fighters[0].tackleCharge);
  const g2 = arena();hold(g2, .3);step(g2, cmd({dodge: true, tackleHeld: true, move: vec(1, 0)}));assert.ok(!g2.fighters[0].tackleCharge);
  ok('D ou C durante a carga cancelam');
}

// PL nas disputas
{
  const pick = (a, b) => {
    const g = arena({blue: vec(0, -3.2), red: vec(0, 3.2)});const ev = [];
    for (let i = 0; i < 90; i++) {
      g.step(cmd({move: vec(0, 1), tackle: i === 5, target: 1}), cmd({move: vec(0, -1), tackle: i === 5, target: 0}));ev.push(...g.lastStepEvents);
      if (i === 5) {g.fighters[0].action.pl = a;g.fighters[1].action.pl = b;}
    }
    return {g, ev};
  };
  const eq = pick(1, 1);assert.ok(eq.ev.some(e => e.result === 'clash'), 'PL igual: clash');
  const hi = pick(3, 1);assert.ok(!hi.ev.some(e => e.result === 'clash'), 'PL diferente: sem clash');
  assert.ok(hi.g.fighters[1].hp < 100 && hi.g.fighters[0].hp === 100, 'o PL3 conecta e o PL1 não');
  ok('tackle PL maior vence o menor; PL igual faz clash');
  const dispute = (tpl, spl) => {
    const g = arena({blue: vec(0, -3), red: vec(0, 6)}), f = g.fighters[0];
    step(g, cmd({tackle: true, move: vec(0, 1)}));f.action.pl = tpl;for (let i = 0; i < 29; i++) step(g, cmd({move: vec(0, 1)}));
    spawn(g.world, {kind: 'projectile', owner: 1, pos: {x: 0, z: f.position.z + 2.2}, dir: {x: 0, z: -1}, speed: 10, y: .65, radius: .2, life: 3, pierce: 1, pl: spl, clashable: true, hit: {damage: 2}, captured: {}}, g.lastStepEvents);
    const ev = [];for (let i = 0; i < 40; i++) ev.push(...step(g, cmd({move: vec(0, 1)})));return ev.map(e => e.result);
  };
  assert.ok(dispute(2, 2).includes('tackleClash'), 'tackle PL2 × pedra PL2: clash, só a pedra se despedaça');
  assert.ok(dispute(2, 3).includes('counter'), 'pedra PL3 vence o tackle PL2');
  assert.ok(dispute(3, 2).includes('tackleClash'), 'tackle PL3 destrói a pedra PL2');
  ok('o PL do tackle vale na disputa contra pedras do Psyshock');
}
console.log(`\n${n} verificações do tackle carregado (fase 1) aprovadas.`);
