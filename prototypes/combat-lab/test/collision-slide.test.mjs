// Deslize em obstáculos redondos durante a locomoção (partida real do motor, 120 Hz).
// Origem: remover a velocidade que entra no pilar (decisão do responsável) fazia o controlador amortecer o deslize lateral como
// "indesejado" (turnGrip) e o lutador ficava grudado na frente do pilar: rapier.test.mjs › "pilar · arenamon: contorna o pilar".
// Contrato: o controlador recebe as normais de contato do passo anterior e projeta a ENTRADA sobre a tangente (a entrada que
// empurra para dentro do obstáculo é descartada), então o deslize é acelerado, nunca amortecido, e nunca excede a velocidade pedida.
// Uso: node prototypes/combat-lab/test/collision-slide.test.mjs
import assert from 'node:assert/strict';
import {C, defaults, resetConfig} from '../src/sim/config.js';
import {Game} from '../src/sim/game.js';
import {emptyCommand} from '../src/sim/entity.js';
import {vec, length} from '../src/sim/math.js';
import {registerStandardMoves} from '../src/sim/moves/standard.js';

registerStandardMoves();
let tests = 0;const failures = [];
const check = (name, fn) => {try {resetConfig(defaults());fn();tests++;console.log('✓', name);} catch (error) {failures.push(name);console.log('✗', name, '—', String(error.message).split(/\r?\n/)[0]);}};

function lab(pillarX) {
  const g = new Game();g.reset({positions: [vec(0, 0), vec(-30, -30)]});g.mode = 'inactive';
  Object.assign(g.mapState, {platforms: [], destructibles: [], items: [], obstacles: [{id: 'p', shape: 'cylinder', pos: {x: pillarX, y: 0, z: 4}, radius: .9, height: 4.5}]});
  return g;
}
function walk(g, ticks, move = vec(0, 1)) {
  const A = g.fighters[0], trace = [];let maxSpeed = 0, pen = 0;
  for (let t = 0; t < ticks; t++) {
    g.step({...emptyCommand(), move}, emptyCommand());
    trace.push({x: A.position.x, z: A.position.z});
    maxSpeed = Math.max(maxSpeed, length(A.velocity));
    pen = Math.max(pen, .9 + C.test.halfExtent - Math.hypot(A.position.x - g.mapState.obstacles[0].pos.x, A.position.z - 4));
  }
  return {A, trace, maxSpeed, pen};
}

for (const off of [.3, -.3, .05]) {
  check(`pilar deslocado ${off} m: andar de frente contorna o pilar em 3 s, sem penetrar e sem passar da velocidade de caminhada`, () => {
    const g = lab(off), {A, maxSpeed, pen} = walk(g, 360);
    assert.ok(A.position.z > 6, `ficou preso: z=${A.position.z.toFixed(3)}`);
    assert.ok(pen <= 1e-6, `penetração ${pen.toFixed(5)} m`);
    // Tolerância de 1%: locomotionStep soma par·d + perp, então toda curva tem sobra transitória (medido no 4634ca2, curva de 45° em campo
    // aberto: 4,808 m/s para caminhada de 4,8). O que se proíbe aqui é ganho real de velocidade pelo contato.
    assert.ok(maxSpeed <= A.attributes.speed * 1.01, `velocidade ${maxSpeed.toFixed(3)} > ${A.attributes.speed} + 1%`);
  });
}
check('pilar exatamente de frente (simetria perfeita): para na face, sem NaN, sem oscilação', () => {
  const g = lab(0), {A, trace} = walk(g, 360);
  assert.ok(Number.isFinite(A.position.x) && Number.isFinite(A.position.z));
  const last = trace.slice(-60), spread = Math.max(...last.map(p => p.z)) - Math.min(...last.map(p => p.z));
  assert.ok(spread <= 1e-6, `oscilou ${spread.toExponential(2)} m`);
  assert.ok(A.position.z < 4 - .9 - C.test.halfExtent + 1e-6, 'não pode atravessar o pilar');
});
check('soltar o direcional: o lutador para; empurrar para longe do pilar não é afetado pelas normais antigas', () => {
  const g = lab(.3), A = g.fighters[0];
  walk(g, 150);
  for (let t = 0; t < 120; t++) g.step({...emptyCommand(), move: vec(0, -1)}, emptyCommand());   // anda para trás, saindo do contato
  assert.ok(A.position.z < 2, `não recuou: z=${A.position.z.toFixed(3)}`);
  assert.equal((A.surfaceNormals ?? []).length, 0, 'normais devem ser renovadas a cada passo físico');
});
check('determinismo: duas execuções idênticas dão a mesma trajetória', () => {
  const run = () => JSON.stringify(walk(lab(.3), 240).trace.filter((_, i) => i % 20 === 0));
  assert.equal(run(), run());
});
check('save/load no meio do deslize reproduz a MESMA trajetória inteira e as mesmas normais', () => {
  const g = lab(.3);walk(g, 100);
  const snap = g.save(), a = walk(g, 120), normalsA = JSON.stringify(g.fighters[0].surfaceNormals);
  const h = new Game();h.load(snap);
  const b = walk(h, 120);
  assert.deepEqual(a.trace, b.trace);
  assert.equal(JSON.stringify(h.fighters[0].surfaceNormals), normalsA);
});

console.log(`Deslize em obstáculos redondos: ${tests} verificações aprovadas, ${failures.length} falhas.`);
if (failures.length) process.exit(1);
