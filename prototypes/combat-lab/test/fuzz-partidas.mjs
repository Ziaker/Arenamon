// FERRAMENTA de caça a bugs (não faz parte do `npm test`, leva minutos): partidas aleatórias com mapas variados, os 15 Moves, navegação ligada e IA nos dois lados; confere invariantes
// a cada passo (NaN, fora da arena, stamina, estados presos, lutadores sobrepostos, exceções). Uso: node test/fuzz-partidas.mjs <partidas> <semente> <mix|ai>
// Caçada de bugs: partidas aleatórias com mapas variados, os 15 Moves, navegação ligada e (opcionalmente) IA nos dois lados; confere invariantes a cada passo.
import {C, defaults, resetConfig} from '../src/sim/config.js';
import {Game} from '../src/sim/game.js';
import {emptyCommand, isInvulnerable} from '../src/sim/entity.js';
import {effectiveArenaRadius} from '../src/sim/map.js';
import {registerStandardMoves} from '../src/sim/moves/standard.js';
import {NEW_MOVE_IDS} from '../src/sim/moves/new-moves.js';
const all = ['reflect', 'psyshock', ...NEW_MOVE_IDS];
const N = Number(process.argv[2] ?? 20), S0 = Number(process.argv[3] ?? 1), MODE = process.argv[4] ?? 'mix';
let s0 = 987654 + S0 * 7919; const rnd = () => ((s0 = (s0 * 1664525 + 1013904223) >>> 0) / 4294967296);
const found = {};
const mark = (k, c) => {if (!found[k]) found[k] = {n: 0, c}; found[k].n++;};
const fin = v => Number.isFinite(v);
for (let run = 0; run < N; run++) {
  resetConfig(defaults()); registerStandardMoves();
  const bothAI = MODE === 'ai' || (MODE === 'mix' && run % 2 === 0);
  C.extras.toggles.enableEnemyAI = 1;
  const g = new Game({seed: S0 * 1000 + run}); g.start();
  g.mode = 'tactical';
  const m = g.mapState;m.items = [];
  const k = Math.floor(rnd() * 4);
  m.platforms = [];m.obstacles = [];m.destructibles = [];
  if (k >= 1) m.platforms.push({id: 'pa', pos: {x: -3 + rnd() * 6, y: 0, z: -3 + rnd() * 6}, width: 3, depth: 3, height: [1, 1.5, .5][Math.floor(rnd() * 3)]});
  if (k >= 2) m.obstacles.push({id: 'ob', pos: {x: -6 + rnd() * 12, y: 0, z: -6 + rnd() * 12}, shape: 'box', hx: 1.1, hz: 1.1, height: [1, 2.2, 3.5][Math.floor(rnd() * 3)], angle: 0});
  if (k >= 3) m.platforms.push({id: 'pb', pos: {x: -8 + rnd() * 16, y: 0, z: -8 + rnd() * 16}, width: 4, depth: 2, height: 1});
  const pick = () => Array.from({length: 4}, () => all[Math.floor(rnd() * all.length)]);
  g.setLoadout(0, pick()); g.setLoadout(1, pick());
  const since = new Map(), maxR = C.test.arenaHalf ?? 16;
  let human = {move: {x: 0, z: 0}, until: 0, hold: null};
  const humanCmd = t => {
    const c = emptyCommand();
    if (t >= human.until) {human.until = t + 10 + Math.floor(rnd() * 80);const a = rnd() * 6.283;human.move = rnd() < .25 ? {x: 0, z: 0} : {x: Math.sin(a), z: Math.cos(a)};human.hold = rnd() < .5 ? Math.floor(rnd() * 4) : null;human.guard = rnd() < .1;}
    c.move = human.move;c.guard = human.guard;
    if (human.hold != null) {c.skillHeld = [0, 1, 2, 3].map(q => q === human.hold);if (t === human.until - 1 || t % 83 === 0) c.skill = human.hold;}
    if (rnd() < .01) {c.tackle = true;c.tackleHeld = true;}
    if (rnd() < .012) {c.dodge = true;c.dodgeHeld = true;}
    if (rnd() < .02) {c.jump = true;c.jumpHeld = true;} else if (rnd() < .3) c.jumpHeld = true;
    return c;
  };
  try {
    for (let t = 0; t < 7200 && g.phase === 'playing'; t++) {
      const c0 = bothAI ? g.assistNav(g.playerBrain, g.fighters[0], g.fighters[1], g.playerBrain.command(g.fighters[0], g.fighters[1], 'tactical', C.test.step)) : humanCmd(t);
      globalThis.__tick = t;g.step(c0, undefined);
      for (const f of g.fighters) {
        const tag = `run ${run + 1} seed ${S0 * 1000 + run} t=${t} f${f.id} map=${k} ai=${bothAI}`;
        for (const key of ['hp', 'stamina', 'groundY', 'vaultHeight']) if (f[key] !== undefined && !fin(f[key])) mark(`NaN em ${key}`, tag);
        if (!fin(f.position.x) || !fin(f.position.z) || !fin(f.velocity.x) || !fin(f.velocity.z)) mark('NaN em posição/velocidade', tag);
        if (Math.hypot(f.position.x, f.position.z) > effectiveArenaRadius() + .6) mark('fora da arena', `${tag} r=${Math.hypot(f.position.x, f.position.z).toFixed(2)} lim=${effectiveArenaRadius().toFixed(2)}`);
        if (f.stamina < -1e-6 || f.stamina > C.rules.staminaMax * 2 + 1) mark('stamina fora da faixa', `${tag} ${f.stamina}`);
        if (f.absent && !(f.action?.kind === 'move' && f.action.travel)) {mark('ausente sem viagem (1 passo é tolerado: rede de segurança)', tag);if (process.env.DBG && found['ausente sem viagem'].n < 4) console.log('DBG', tag, 'act=', f.action?.kind, f.action?.move, 'stun', f.stun, 'flags', (f.statuses||[]).map(x=>x.id).join(), 'ev', g.lastStepEvents.map(e => e.attacker + ':' + e.target + ':' + e.result).join(','), 'prevAct', f.__pa);}
        if (f.aim?.range && !f.aim.def) mark('mira de alcance sem def', tag);
        if ((f.groundY ?? 0) < -.01) mark('groundY negativo', `${tag} ${f.groundY}`);
        if (f.hp <= 0) continue;
        const conds = {ausente: [!!f.absent, 120], acao: [!!f.action, 900], voo: [!!f.flight, 900], invuln: [isInvulnerable(f), 360], mira: [!!f.aim, 1500], carga: [!!f.charge, 1500], pendurado: [!!f.ledge, 900], knock: [(f.knockRecovery ?? 0) > 0, 600]};
        for (const [name, [on, lim]] of Object.entries(conds)) {
          const key = f.id + name, v = since.get(key);
          if (on) {if (v === undefined) since.set(key, t);else if (t - v > lim) {mark(`${name} preso`, `${tag} loadout=${f.loadout} act=${f.action?.kind}/${f.action?.move} ledge=${f.ledge?.phase}`);since.delete(key);}}
          else since.delete(key);
        }
      }
      const [a, b] = g.fighters;
      if (a.hp > 0 && b.hp > 0 && !a.absent && !b.absent && !a.flight && !b.flight && Math.abs((a.groundY ?? 0) - (b.groundY ?? 0)) < .5) {
        const d = Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z), key = 'overlap';
        if (d < .25) {const v = since.get(key);if (v === undefined) since.set(key, t);else if (t - v > 240) {mark('lutadores sobrepostos', `run ${run + 1} seed ${S0 * 1000 + run} t=${t} d=${d.toFixed(2)}`);since.delete(key);}} else since.delete(key);
      }
    }
  } catch (e) {mark('EXCEÇÃO ' + e.message.slice(0, 90), `run ${run + 1} seed ${S0 * 1000 + run} ${String(e.stack).split('\n').slice(1, 3).join(' | ')}`);}
}
console.log(JSON.stringify(found, null, 1));
console.log(`fuzz ${MODE} S0=${S0}: ${N} partidas, ${Object.keys(found).length} tipos de achado`);
