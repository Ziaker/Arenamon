// @ts-check
// Invariantes de colisão com o mapa, medidos em partidas IA×IA completas (mapas aleatórios por semente) com o oráculo geométrico
// da Fase 5 (src/physics-poc/poc-metrics.js). Nasceu da varredura que achou lançados atravessando até 1 m das plataformas.
import assert from 'node:assert/strict';
import {C, defaults, resetConfig} from '../src/sim/config.js';
import {Game} from '../src/sim/game.js';
import {registerStandardMoves} from '../src/sim/moves/standard.js';
import {collectSolids} from '../src/nav/nav-graph.js';
import {penetration} from '../src/physics-poc/poc-metrics.js';
import {spawn} from '../src/sim/world.js';
import {emptyCommand} from '../src/sim/entity.js';

registerStandardMoves();
let passed = 0, failed = 0;
function test(name, fn) {try {fn();passed++;console.log(`  ✓ ${name}`);} catch (e) {failed++;console.error(`  ✗ ${name}: ${e.message}`);}}
console.log('\n--- INVARIANTES DE COLISÃO COM O MAPA (varredura de partidas) ---\n');

/** Varre `seeds` partidas e devolve a penetração máxima por categoria de movimento. */
function sweep(seeds, ticks, tweak = null) {
  const r = {ground: 0, jump: 0, launch: 0, over25: 0, ticks: 0, flightTicks: 0, below: 0, outside: 0, ffUnexplained: 0, ffVault: 0, ffMaxRun: 0};
  for (let seed = 1; seed <= seeds; seed++) {
    resetConfig(defaults());tweak?.(C);let ffRun = 0;
    const g = new Game({seed});g.start();g.mode = 'tactical';
    C.extras.toggles.enablePlayerAI = 1;
    for (let t = 0; t < ticks; t++) {
      g.step(g.playerBrain.command(g.fighters[0], g.fighters[1], 'tactical', C.test.step));
      r.ticks++;
      if (g.phase === 'result') break;
      const solids = collectSolids(g.mapState);
      for (const f of g.fighters) {
        if (f.hp <= 0) continue;
        const y = f.flight ? f.flight.y : (f.groundY ?? 0) + (f.vaultHeight ?? 0), p = {x: f.position.x, y, z: f.position.z};
        if (f.flight) r.flightTicks++;
        // Em arco de vault da esquiva (vaultHeight > 5 cm) o corpo está no AR: vale a faixa de montagem, como no salto; «chão» é só com os pés no piso.
        const kind = f.flight ? (f.flight.isNormalJump || f.flight.isEdgeFall ? 'jump' : 'launch') : (f.vaultHeight ?? 0) > 0.05 ? 'jump' : 'ground';
        for (const s of solids) {
          const d = penetration(p, s, 'box');
          if (d > r[kind]) r[kind] = d;
          if (d > .25) r.over25++;
        }
        if (y < -.001) r.below++;
        const R = C.map.arenaShape === 'square' ? C.test.arenaHalf : C.map.arenaRadius, rr = C.map.arenaShape === 'square' ? Math.max(Math.abs(p.x), Math.abs(p.z)) : Math.hypot(p.x, p.z);
        if (rr > R + .01) r.outside++;
      }
      {
        // Sobreposição lutador × lutador (mesma altura): só é permitida durante o salto da esquiva por cima do rival (action.jump.over).
        const [a, b] = g.fighters, H = C.extras.visual.bodyHeight;
        const ya = (a.flight?.y ?? a.groundY ?? 0) + (a.vaultHeight ?? 0), yb = (b.flight?.y ?? b.groundY ?? 0) + (b.vaultHeight ?? 0);
        if (a.hp > 0 && b.hp > 0 && !(ya + H < yb || yb + H < ya)) {
          const d = C.test.contactShape ? 1 - Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z) : Math.min(1 - Math.abs(a.position.x - b.position.x), 1 - Math.abs(a.position.z - b.position.z));
          if (d > .05) {if (a.action?.jump?.over === b.id || b.action?.jump?.over === a.id) {r.ffVault++;ffRun = 0;} else {r.ffUnexplained++;ffRun++;r.ffMaxRun = Math.max(r.ffMaxRun, ffRun);}} else ffRun = 0;
        } else ffRun = 0;
      }
    }
  }
  return r;
}
const fixed = sweep(12, 3000), legacy = sweep(12, 3000, c => {c.map.launchSolidCollision = 0;});
console.log(`      corrigido: chão ${(fixed.ground * 100).toFixed(1)} cm · salto ${(fixed.jump * 100).toFixed(1)} cm · lançado ${(fixed.launch * 100).toFixed(1)} cm | legado: lançado ${(legacy.launch * 100).toFixed(1)} cm (${fixed.ticks} passos, ${fixed.flightTicks} em voo)`);

test('andando no chão: penetração em sólidos ≤ 2 cm', () => assert.ok(fixed.ground <= .02, `${fixed.ground}`));
test('salto voluntário: penetração ≤ tolerância de montagem (25 cm)', () => assert.ok(fixed.jump <= C.map.mountTolerance + .01, `${fixed.jump}`));
test('lançado por golpe: não atravessa a lateral de plataformas/obstáculos (≤ tolerância de montagem)', () => assert.ok(fixed.launch <= .26, `${fixed.launch}`));
test('o comportamento legado (launchSolidCollision = 0) ainda reproduz o problema, provando que o interruptor funciona', () => {
  // Determinístico (a amostra de partidas da IA não garante lançamentos contra sólidos em toda calibração): lançado a 12 m/s (subindo a 12 m/s) contra uma caixa de 2,2 m a 3 m.
  const run = flag => {
    resetConfig(defaults());C.extras.toggles.enableEnemyAI = 0;C.map.launchSolidCollision = flag;
    const g = new Game({seed: 2});g.start();g.mode = 'inactive';
    g.mapState.obstacles = [{id: 'b', pos: {x: 0, y: 0, z: 3}, shape: 'box', hx: 1.5, hz: 1.5, radius: 1.5, height: 2.2, angle: 0}];g.mapState.platforms = [];g.mapState.destructibles = [];g.mapState.items = [];g.mapState.regularSpawnTimer = 1e9;
    const f = g.fighters[0];f.position = {x: 0, z: 0};g.fighters[1].position = {x: 20, z: 20};
    f.flight = {y: .01, vy: 12, horizontal: {x: 0, z: 12}};f.launchedByHit = true;f.state = 'airborne';
    let worst = 0;
    for (let t = 0; t < 240; t++) {g.step(emptyCommand(), emptyCommand());for (const sd of collectSolids(g.mapState)) worst = Math.max(worst, penetration({x: f.position.x, y: f.flight ? f.flight.y : f.groundY, z: f.position.z}, sd, 'box'));}
    return worst;
  };
  const legacyPen = run(0), fixedPen = run(1);
  assert.ok(legacyPen > .5, `legado: ${legacyPen}`);assert.ok(fixedPen <= .26, `corrigido: ${fixedPen}`);
});
test('ninguém fica abaixo do chão nem fora da arena', () => {assert.equal(fixed.below, 0);assert.equal(fixed.outside, 0);});
// O pouso do salto da esquiva por cima do rival pode terminar sobre ele por UM passo (8 ms) até o par ser separado; medido na base de calibração v8: 44 eventos em 24 partidas, todos de 1 passo.
// A invariante é: nunca persistir (no máximo 2 passos seguidos sem explicação) — sobreposição que dura é defeito.
test('lutador × lutador: sobreposição só durante o salto da esquiva por cima do rival e, sem explicação, no máximo 2 passos seguidos (pouso)', () => assert.ok(fixed.ffMaxRun <= 2, `${fixed.ffUnexplained} passos sem explicação, maior sequência ${fixed.ffMaxRun} (${fixed.ffVault} do salto por cima)`));
test('projétil colide com a MESMA caixa alinhada aos eixos que o desenho e os lutadores usam (campo angle do obstáculo é legado)', () => {
  resetConfig(defaults());C.extras.toggles.enableEnemyAI = 0;
  const g = new Game({seed: 2});g.start();
  g.mapState.obstacles = [{id: 'o1', pos: {x: 0, y: 0, z: 5}, shape: 'box', hx: 2, hz: .5, radius: 2, height: 2, angle: Math.PI / 2}];g.mapState.platforms = [];g.mapState.destructibles = [];g.mapState.items = [];g.mapState.regularSpawnTimer = 1e9;
  g.fighters[0].position = {x: -20, z: -20};g.fighters[1].position = {x: 20, z: 20};
  spawn(g.world, {kind: 'projectile', owner: 0, pos: {x: 1.5, z: 0}, angle: 0, speed: 20, radius: .1, y: .65, life: 2, hit: {damage: 5}});
  let blocked = false;
  for (let t = 0; t < 120 && !blocked; t++) {g.step(emptyCommand(), emptyCommand());blocked = g.lastStepEvents.some(e => e.result === 'obstacleHit');}
  assert.ok(blocked, 'em x = 1,5 a caixa desenhada (hx 2) bloqueia; antes a caixa girada invisível (x ±0,5) deixava passar');
});
test('mountTolerance menor reduz a penetração do salto (parâmetro tem efeito mensurável)', () => {
  const t = sweep(6, 3000, c => {c.map.mountTolerance = .12;});
  assert.ok(t.jump <= .13, `${t.jump}`);
});

console.log(`\n${passed} passaram, ${failed} falharam`);
if (failed) process.exit(1);
