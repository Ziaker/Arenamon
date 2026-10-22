// Cenários de teste repetíveis. Cada um parte sempre do mesmo estado, usa comandos roteirizados para os
// dois lutadores (sem IA) e termina com uma lista “esperado × obtido”. Os valores esperados são calculados
// a partir da configuração ATUAL, então continuam válidos quando os parâmetros são ajustados.
import {C, ROOT_KEYS} from './config.js';
import {Game} from './game.js';
import {Recorder} from './telemetry.js';
import {vec, direction} from './math.js';
import {TACKLE_SCENARIOS} from './scenarios-tackle.js';
import {MAP_SCENARIOS} from './scenarios-map.js';
import {PASSIVE_SCENARIOS} from './scenarios-passives.js';
import {COLLISION_SCENARIOS} from './scenarios-collision.js';

const cmd = (o = {}) => ({move: vec(), dodge: false, tackle: false, guard: false, guardPressed: false, target: null, ...o});
const toward = (from, to) => {const dx = to.x - from.x, dz = to.z - from.z, d = Math.hypot(dx, dz) || 1;return vec(dx / d, dz / d);};
const face = (f, angle) => {f.facing = angle;f.visualFacing = angle;f.combatHeading = angle;};
const fmt = v => typeof v === 'number' ? (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(3).replace(/\.?0+$/, '')) : String(v);
const check = (label, ok, expected, actual) => ({label, ok: !!ok, expected: fmt(expected), actual: fmt(actual)});
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const events = (log, result) => log.events.filter(e => e.result === result);
// Esquiva perfeita: diagonal para dentro do tackle (encosta na invulnerabilidade e sai pela lateral, livre para contra-atacar).
const PERFECT_DODGE_DIR = (() => {const v = [.45, .9], d = Math.hypot(...v);return vec(v[0] / d, v[1] / d);})();
/** Tempo estimado até o tackle de `a` tocar `d` (∞ sem tackle em curso ou se afastando). */
function timeToContact(a, d) {
  if (a.action?.kind !== 'tackle') return Infinity;
  const dx = d.position.x - a.position.x, dz = d.position.z - a.position.z, dist = Math.hypot(dx, dz) || 1, gap = dist - 2 * C.test.halfExtent;
  const closing = (a.velocity.x * dx + a.velocity.z * dz) / dist - (d.velocity.x * dx + d.velocity.z * dz) / dist;
  return closing > .5 ? Math.max(0, gap) / closing : Infinity;
}
/** Passos suficientes para uma ação completa, recuperação, voo e aterrissagem com os ajustes atuais. */
const enough = (extra = 0) => Math.ceil((C.actions.tackle.duration + C.actions.tackle.recovery + C.actions.dodge.duration + C.actions.dodge.recovery + 2 * Math.max(C.rules.launchUp, C.rules.clashUp) / C.rules.launchGravity + C.rules.landingRecovery + C.rules.recoil + C.rules.guardStun + extra) / C.test.step) + 60;

const BASE_SCENARIOS = [
  {
    id: 'guard-partial', name: 'Tackle contra defesa', description: 'O vermelho defende parado (janela perfeita já encerrada); o azul investe de frente.',
    positions: [vec(0, -2.4), vec(0, 0)], ticks: () => enough(), setup: g => {face(g.fighters[0], 0);face(g.fighters[1], Math.PI);},
    script: (t, g) => [t === 40 ? cmd({move: vec(0, 1), tackle: true, target: 1}) : cmd({target: 1}), cmd({guard: true, guardPressed: t === 0, target: 0})],
    checks: ({log, start}) => {
      const e = events(log, 'partial')[0], after = log.afterHit;
      return [check('Resultado do contato', e, 'partial', e?.result ?? 'nenhum'),
        check('Dano reduzido pela defesa', e && near(e.damage, C.profiles.balanced.attack * C.extras.combat.guardDamageMultiplier, 1e-9), C.profiles.balanced.attack * C.extras.combat.guardDamageMultiplier, e?.damage ?? 0),
        check('Atacante entra em recuo', after?.attackerState === 'recoil', 'recoil', after?.attackerState ?? '—'),
        check('Defensor recebe guard stun', after && near(after.defenderStun, C.rules.guardStun, 1e-6), C.rules.guardStun, after?.defenderStun ?? 0),
        check('Defensor não é deslocado (m)', after && after.defenderShift < .05, '< 0,05', after?.defenderShift ?? 0)];
    },
  },
  {
    id: 'guard-perfect', name: 'Defesa perfeita', description: 'O vermelho aperta D pouco antes do contato, dentro da janela perfeita.',
    positions: [vec(0, -2.4), vec(0, 0)], ticks: () => enough(), setup: g => {face(g.fighters[0], 0);face(g.fighters[1], Math.PI);},
    // Adaptativo: o vermelho aperta D quando faltar menos de metade da janela perfeita para o contato (vale para qualquer duração/curva do tackle).
    script: (t, g, s) => {const [a, d] = g.fighters, press = !s.pressed && timeToContact(a, d) <= C.rules.perfect * .5;if (press) s.pressed = t;
      return [t === 10 ? cmd({move: vec(0, 1), tackle: true, target: 1}) : cmd({target: 1}), cmd({guard: s.pressed !== undefined, guardPressed: press, target: 0})];},
    checks: ({log, game}) => {
      const e = events(log, 'perfect')[0];
      return [check('Resultado do contato', e, 'perfect', log.events[0]?.result ?? 'nenhum'), check('Sem dano', e && e.damage === 0, 0, e?.damage ?? '—'),
        check('Janela de contra-ataque aberta', !C.extras.toggles.enableCounterBonus || log.maxCounter[1] > 0, C.extras.toggles.enableCounterBonus ? '> 0 s' : 'desligada', log.maxCounter[1])];
    },
  },
  {
    id: 'clash', name: 'Clash frontal', description: 'Os dois investem ao mesmo tempo, um contra o outro.',
    positions: [vec(0, -1.6), vec(0, 1.6)], ticks: () => enough(), setup: g => {face(g.fighters[0], 0);face(g.fighters[1], Math.PI);},
    script: (t) => [t === 10 ? cmd({move: vec(0, 1), tackle: true, target: 1}) : cmd({target: 1}), t === 10 ? cmd({move: vec(0, -1), tackle: true, target: 0}) : cmd({target: 0})],
    checks: ({log, game}) => {
      const c = events(log, 'clash'), dmg = C.profiles.balanced.attack * C.rules.clashFraction;
      return [check('Eventos de clash', c.length === 2, 2, c.length), check('Mesmo passo', c.length === 2 && c[0].tick === c[1].tick, 'sim', c.length === 2 && c[0].tick === c[1].tick ? 'sim' : 'não'),
        check('Dano de cada lado', c.every(e => near(e.damage, dmg, 1e-9)), dmg, c.map(e => fmt(e.damage)).join(' / ') || '—'),
        check('Ambos lançados', log.flew[0] && log.flew[1], 'sim', log.flew.map(Boolean).join(' / ')),
        check('Aterrissagem simétrica (m)', near(Math.abs(game.fighters[0].position.z), Math.abs(game.fighters[1].position.z), .02), '|Δ| ≤ 0,02', Math.abs(Math.abs(game.fighters[0].position.z) - Math.abs(game.fighters[1].position.z)))];
    },
  },
  {
    id: 'perfect-dodge', name: 'Esquiva perfeita e contra-ataque', description: 'O azul esquiva para dentro do tackle no início da invulnerabilidade e responde com X fortalecido.',
    positions: [vec(0, -2.4), vec(0, 0)], ticks: () => enough(), overrides: {'extras.toggles.enableVault': 0}, setup: g => {face(g.fighters[0], 0);face(g.fighters[1], Math.PI);},
    // Adaptativo: o azul esquiva quando o contato estiver a menos de metade da invulnerabilidade e contra-ataca assim que a janela abre
    // (durante a esquiva, se a regra permitir C → X depois de esquiva perfeita; senão, ao terminar).
    script: (t, g, s) => {
      const [p, r] = g.fighters, dodge = !s.dodged && timeToContact(r, p) <= C.actions.dodge.invulnerable * .5;if (dodge) s.dodged = t;
      // Contra-ataque assim que o tackle do vermelho passou pelo azul (de frente para um tackle em curso o resultado seria clash).
      const passed = r.action?.kind !== 'tackle' || (Math.sin(r.action.heading) * (p.position.x - r.position.x) + Math.cos(r.action.heading) * (p.position.z - r.position.z)) < 0;
      const canCounter = p.counterWindow > 0 && passed && (!p.action || (p.action.kind === 'dodge' && C.actions.cancel.perfectAnytime)) && !s.countered;if (canCounter) s.countered = t;
      return [dodge ? cmd({move: PERFECT_DODGE_DIR, dodge: true, dodgeDirection: PERFECT_DODGE_DIR, target: 1}) : canCounter ? cmd({move: toward(p.position, r.position), tackle: true, target: 1}) : cmd({target: 1}),
        t === 10 ? cmd({move: vec(0, -1), tackle: true, target: 0}) : cmd({target: 0})];
    },
    checks: ({log}) => {
      const e = events(log, 'perfectDodge')[0];
      return [check('Esquiva perfeita registrada', e, 'perfectDodge', log.events[0]?.result ?? 'nenhum'), check('Sem dano no azul', log.damageTaken[0] === 0, 0, log.damageTaken[0]),
        check('Stamina devolvida', !e || log.staminaBonus >= C.actions.dodge.perfectEvadeStamina - 1e-6, `+${fmt(C.actions.dodge.perfectEvadeStamina)}`, `+${fmt(log.staminaBonus)}`),
        check('X fortalecido no contra-ataque', !C.extras.toggles.enableCounterBonus || log.counterSpeed > 1, `× ${fmt(C.actions.tackle.counterSpeed)}`, `× ${fmt(log.counterSpeed)}`)];
    },
  },
  {
    id: 'sidestep', name: 'Esquiva lateral no último instante', description: 'O azul sai para o lado logo depois de o vermelho investir.',
    positions: [vec(0, -2.6), vec(0, 0)], ticks: () => enough(), setup: g => {face(g.fighters[0], 0);face(g.fighters[1], Math.PI);},
    script: (t) => [t === 13 ? cmd({move: vec(1, 0), dodge: true, dodgeDirection: vec(1, 0), target: 1}) : cmd({target: 1}), t === 10 ? cmd({move: vec(0, -1), tackle: true, target: 0}) : cmd({target: 0})],
    checks: ({log}) => [check('Nenhum impacto recebido', !events(log, 'impact').length, 0, events(log, 'impact').length), check('Sem dano no azul', log.damageTaken[0] === 0, 0, log.damageTaken[0])],
  },
  {
    id: 'launch', name: 'Lançamento em campo aberto', description: 'Tackle limpo em um adversário parado; mede tempo no ar e recuperação.',
    positions: [vec(0, -2.4), vec(0, 0)], ticks: () => enough(), setup: g => {face(g.fighters[0], 0);face(g.fighters[1], Math.PI);},
    script: (t) => [t === 10 ? cmd({move: vec(0, 1), tackle: true, target: 1}) : cmd({target: 1}), cmd({target: 0})],
    checks: ({log}) => {
      const e = events(log, 'impact')[0], air = 2 * C.rules.launchUp / C.rules.launchGravity / C.test.step;
      const base = C.rules.launchHorizontal * (C.extras.combat.launchAttackBase + C.extras.combat.launchAttackWeight * C.profiles.balanced.attack / C.extras.combat.launchAttackReference);
      return [check('Impacto', e, 'impact', log.events[0]?.result ?? 'nenhum'), check('Dano', e && near(e.damage, C.profiles.balanced.attack, 1e-9), C.profiles.balanced.attack, e?.damage ?? 0),
        check('Tempo no ar (passos)', !C.extras.toggles.enableLaunch || near(log.airTicks[1], air, 2), `${fmt(air)} ± 2`, log.airTicks[1]),
        check('Hitstop do impacto (passos)', !C.extras.toggles.enableHitstop || log.hitstopTicks === Math.ceil(C.extras.combat.impactHitstop / C.test.step - 1e-9), Math.ceil(C.extras.combat.impactHitstop / C.test.step - 1e-9), log.hitstopTicks),
        check('Velocidade de lançamento ≥ base', !e?.launch || e.launch.horizontal >= base - 1e-9, `≥ ${fmt(base)}`, e?.launch?.horizontal ?? '—'),
        check('Recuperação ao aterrissar (passos)', !C.extras.toggles.enableLaunch || near(log.landingTicks[1], C.rules.landingRecovery / C.test.step, 2), `${fmt(C.rules.landingRecovery / C.test.step)} ± 2`, log.landingTicks[1])];
    },
  },
  {
    id: 'wall', name: 'Knockback contra a parede', description: 'O vermelho é lançado na direção da parede e deve ricochetear para dentro da arena.',
    positions: [vec(0, 0), vec(0, 2.4)], ticks: () => enough(),
    // Adaptativo: o vermelho perto da parede e o azul a uma distância que o tackle alcança com os ajustes atuais.
    setup: g => {const radius = C.map.arenaShape === 'square' ? C.test.arenaHalf : (C.map.arenaRadius ?? 50), h = radius - C.test.halfExtent, zr = h - .9, reach = 2 * C.test.halfExtent + Math.min(1.4, .45 * C.actions.tackle.distance * (C.actions.tackle.distanceReference || C.actions.tackle.duration) * C.profiles.balanced.speed);
      g.fighters[0].position = vec(0, zr - reach);g.fighters[1].position = vec(0, zr);face(g.fighters[0], 0);face(g.fighters[1], Math.PI);},
    script: (t) => [t === 10 ? cmd({move: vec(0, 1), tackle: true, target: 1}) : cmd({target: 1}), cmd({target: 0})],
    checks: ({log, game}) => {
      const bound = (C.map?.arenaShape === 'square' ? C.test.arenaHalf : (C.map?.arenaRadius ?? 50)) - C.test.halfExtent, z = game.fighters[1].position.z;
      return [check('Impacto', events(log, 'impact').length, 'impact', log.events[0]?.result ?? 'nenhum'), check('Tocou a parede durante o voo', log.wallHits[1] > 0, '≥ 1', log.wallHits[1]),
        check('Ricochete para dentro', !C.extras.toggles.enableWallBounce || log.bounced, C.extras.toggles.enableWallBounce ? 'sim' : 'desligado', log.bounced ? 'sim' : 'não'),
        check('Termina dentro da arena', Math.abs(z) <= bound + 1e-9, `|z| ≤ ${fmt(bound)}`, Math.abs(z))];
    },
  },
  {
    id: 'exhaustion', name: 'Exaustão de stamina', description: 'O azul faz três esquivas seguidas e tenta uma quarta.',
    positions: [vec(0, -6), vec(0, 6)], ticks: () => 4 * Math.ceil((C.actions.dodge.duration + C.actions.dodge.recovery + C.extras.combat.exhaustRecovery + .1) / C.test.step) + 60, setup: g => {face(g.fighters[0], 0);face(g.fighters[1], Math.PI);},
    script: (t, g, s) => {const p = g.fighters[0], go = (s.n ?? 0) < 4 && !p.action && p.knockRecovery <= 0 && t - (s.last ?? -99) > 4;if (go) {s.n = (s.n ?? 0) + 1;s.last = t;}return [go ? cmd({move: vec(1, 0), dodge: true, dodgeDirection: vec(1, 0)}) : cmd(), cmd()];},
    checks: ({log}) => {
      const n = Math.floor(C.rules.staminaMax / C.actions.dodge.cost + 1e-9), exhaustsAt = C.rules.exhaustMode === 1 ? n : (Math.abs(C.rules.staminaMax - n * C.actions.dodge.cost) < 1e-9 ? n : Infinity);
      return [check('Ações aceitas', log.actionsStarted[0] === Math.min(4, n), Math.min(4, n), log.actionsStarted[0]),
        check('Fica exausto', exhaustsAt > 4 || log.wasExhausted[0], exhaustsAt > 4 ? 'não se aplica' : 'sim', log.wasExhausted[0] ? 'sim' : 'não'),
        check('Recuperação extra ao esgotar (passos)', exhaustsAt > 4 || near(log.exhaustTicks[0], (C.extras.combat.exhaustRecovery + n * 0) / C.test.step, 2 + Math.ceil(n * C.actions.dodge.recovery / C.test.step)), `${fmt(C.extras.combat.exhaustRecovery / C.test.step)} ± 2`, log.exhaustTicks[0])];
    },
  },
];
/** Cenários base + os do Tackle/meteor slam + os do Novo Mapa + os de Passivas + os de Colisão (overhaul). */
export const SCENARIOS = [...BASE_SCENARIOS, ...TACKLE_SCENARIOS, ...MAP_SCENARIOS, ...PASSIVE_SCENARIOS, ...COLLISION_SCENARIOS];

const pathGet = (root, path) => path.split('.').reduce((a, k) => a?.[k], root);
const pathSet = (root, path, v) => {const keys = path.split('.'), last = keys.pop();keys.reduce((a, k) => a[k], root)[last] = v;};

/** Prepara um cenário em um Game existente. Devolve funções para avançar e concluir (usadas pela interface e pelos testes). */
export function prepareScenario(def, game) {
  const saved = Object.fromEntries(Object.keys(def.overrides || {}).map(p => [p, pathGet(C, p)]));
  for (const [p, v] of Object.entries(def.overrides || {})) pathSet(C, p, v);
  game.mode = 'inactive';game.profile = 'balanced';game.enemyProfile = 'balanced';game.reset({positions: def.positions});
  // Cenários medem mecânica em condições controladas: o mundo fica neutro para não
  // desviar trajetórias nem curar stamina (os cenários de mapa montam no próprio setup
  // a geometria de que precisam).
  game.mapState.platforms = [];game.mapState.obstacles = [];game.mapState.destructibles = [];game.mapState.items = [];
  def.setup?.(game);
  const start = structuredClone(game.fighters.map(f => ({x: f.position.x, z: f.position.z, hp: f.hp, stamina: f.stamina})));
  const log = {events: [], hitstopTicks: 0, afterHit: null, maxCounter: [0, 0], flew: [false, false], damageTaken: [0, 0], staminaBonus: 0, counterSpeed: 1, airTicks: [0, 0], landingTicks: [0, 0],
    wallHits: [0, 0], bounced: false, actionsStarted: [0, 0], wasExhausted: [false, false], exhaustTicks: [0, 0], maxZ: -Infinity, states: new Set()};
  let t = 0, lastAction = [null, null];const scratch = {}, total = typeof def.ticks === 'function' ? def.ticks() : def.ticks;
  return {
    get tick() {return t;}, get done() {return t >= total;}, get total() {return total;},
    commands() {return def.script ? def.script(t, game, scratch) : [cmd({target: 1}), cmd({target: 0})];},
    /** Chamado depois de cada passo: atualiza o registro do cenário. */
    observe() {
      log.states.add(game.fighters[0].state);
      for (const e of game.lastStepEvents) {
        log.events.push(e);
        if (!log.afterHit && (e.result === 'partial' || e.result === 'perfect')) {const a = game.fighters[e.attacker], d = game.fighters[e.target];log.afterHit = {attackerState: a.state, defenderStun: d.stun, defenderShift: Math.hypot(d.position.x - start[e.target].x, d.position.z - start[e.target].z)};}
        if (e.result === 'perfectDodge') log.staminaBonus = game.fighters[e.target].stamina - log.staminaBefore;
      }
      game.fighters.forEach((f, i) => {
        log.maxCounter[i] = Math.max(log.maxCounter[i], f.counterWindow);if (f.flight) {log.flew[i] = true;if (!game.frozen) log.airTicks[i]++;}
        if (f.state === 'landing' && f.knockRecovery > 0 && !game.frozen) log.landingTicks[i]++;
        log.damageTaken[i] = start[i].hp - f.hp;
        if (f.action && f.action !== lastAction[i] && (f.action.kind === 'dodge' || f.action.kind === 'tackle')) {log.actionsStarted[i]++;if ((f.action.speedMultiplier ?? 1) > 1) log.counterSpeed = f.action.speedMultiplier;}
        lastAction[i] = f.action;if (f.exhausted) log.wasExhausted[i] = true;if (f.state === 'landing' && !f.flight && f.knockRecovery > 0 && f.hp > 0 && !log.flew[i]) log.exhaustTicks[i]++;
      });
      if (game.frozen) log.hitstopTicks++;
      log.staminaBefore = game.fighters[0].stamina;
      const enemy = game.fighters[1], bound = (C.map?.arenaShape === 'square' ? C.test.arenaHalf : (C.map?.arenaRadius ?? 50)) - C.test.halfExtent;
      const enemyDist = Math.hypot(enemy.position.x, enemy.position.z);
      // Toque na parede: velocidade horizontal do voo invertida (com subpassos a posição volta para dentro no mesmo passo).
      if (enemy.flight) {const hz = enemy.flight.horizontal.z, hx = enemy.flight.horizontal.x, ph = log.prevH;
        const atWall = C.map?.arenaShape === 'square' ? (Math.abs(enemy.position.z) >= bound - 1e-9 || Math.abs(enemy.position.x) >= bound - 1e-9) : (enemyDist >= bound - 1e-9);
        if ((ph && ((ph.z > .05 && hz < 0) || (ph.x > .05 && hx < 0) || (ph.x < -.05 && hx > 0))) || atWall) log.wallHits[1]++;
        if (hz < 0 && log.wallHits[1]) log.bounced = true;log.prevH = {x: hx, z: hz};} else log.prevH = null;
      t++;
    },
    finish() {
      const result = {id: def.id, name: def.name, checks: def.checks({log, game, start, scratch})};result.ok = result.checks.every(c => c.ok);
      for (const [p, v] of Object.entries(saved)) pathSet(C, p, v);
      return result;
    },
    abort() {for (const [p, v] of Object.entries(saved)) pathSet(C, p, v);},
  };
}

/** Executa um cenário inteiro sem interface (testes e “executar todos”). */
export function runScenario(def, {game = new Game(), recorder = new Recorder()} = {}) {
  const run = prepareScenario(def, game);recorder.clear();
  while (!run.done) {const [a, b] = run.commands();game.step(a, b);recorder.record(game);run.observe();}
  const result = run.finish();result.recorder = recorder;return result;
}
export const SCENARIO_KEYS = ROOT_KEYS;
