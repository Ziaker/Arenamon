// Cenários de teste repetíveis. Cada um parte sempre do mesmo estado, usa comandos roteirizados para os
// dois lutadores (sem IA) e termina com uma lista “esperado × obtido”. Os valores esperados são calculados
// a partir da configuração ATUAL, então continuam válidos quando os parâmetros são ajustados.
import {C, ROOT_KEYS} from './config.js';
import {Game} from './game.js';
import {Recorder} from './telemetry.js';
import {vec, direction} from './math.js';

const cmd = (o = {}) => ({move: vec(), dodge: false, tackle: false, guard: false, guardPressed: false, target: null, ...o});
const toward = (from, to) => {const dx = to.x - from.x, dz = to.z - from.z, d = Math.hypot(dx, dz) || 1;return vec(dx / d, dz / d);};
const face = (f, angle) => {f.facing = angle;f.visualFacing = angle;f.combatHeading = angle;};
const fmt = v => typeof v === 'number' ? (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(3).replace(/\.?0+$/, '')) : String(v);
const check = (label, ok, expected, actual) => ({label, ok: !!ok, expected: fmt(expected), actual: fmt(actual)});
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const events = (log, result) => log.events.filter(e => e.result === result);

export const SCENARIOS = [
  {
    id: 'guard-partial', name: 'Tackle contra defesa', description: 'O vermelho defende parado (janela perfeita já encerrada); o azul investe de frente.',
    positions: [vec(0, -2.4), vec(0, 0)], ticks: 130, setup: g => {face(g.fighters[0], 0);face(g.fighters[1], Math.PI);},
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
    positions: [vec(0, -2.4), vec(0, 0)], ticks: 110, setup: g => {face(g.fighters[0], 0);face(g.fighters[1], Math.PI);},
    script: (t) => [t === 40 ? cmd({move: vec(0, 1), tackle: true, target: 1}) : cmd({target: 1}), cmd({guard: t >= 38, guardPressed: t === 38, target: 0})],
    checks: ({log, game}) => {
      const e = events(log, 'perfect')[0];
      return [check('Resultado do contato', e, 'perfect', log.events[0]?.result ?? 'nenhum'), check('Sem dano', e && e.damage === 0, 0, e?.damage ?? '—'),
        check('Janela de contra-ataque aberta', !C.extras.toggles.enableCounterBonus || log.maxCounter[1] > 0, C.extras.toggles.enableCounterBonus ? '> 0 s' : 'desligada', log.maxCounter[1])];
    },
  },
  {
    id: 'clash', name: 'Clash frontal', description: 'Os dois investem ao mesmo tempo, um contra o outro.',
    positions: [vec(0, -1.6), vec(0, 1.6)], ticks: 240, setup: g => {face(g.fighters[0], 0);face(g.fighters[1], Math.PI);},
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
    positions: [vec(0, -2.4), vec(0, 0)], ticks: 160, overrides: {'extras.toggles.enableVault': 0}, setup: g => {face(g.fighters[0], 0);face(g.fighters[1], Math.PI);},
    script: (t, g) => {
      const p = g.fighters[0];
      const counter = t > 50 && p.counterWindow > 0 && !p.action;
      return [t === 12 ? cmd({move: vec(0, 1), dodge: true, dodgeDirection: vec(0, 1), target: 1}) : counter ? cmd({move: toward(p.position, g.fighters[1].position), tackle: true, target: 1}) : cmd({target: 1}),
        t === 10 ? cmd({move: vec(0, -1), tackle: true, target: 0}) : cmd({target: 0})];
    },
    checks: ({log}) => {
      const e = events(log, 'perfectDodge')[0];
      return [check('Esquiva perfeita registrada', e, 'perfectDodge', log.events[0]?.result ?? 'nenhum'), check('Sem dano no azul', log.damageTaken[0] === 0, 0, log.damageTaken[0]),
        check('Stamina devolvida', !e || log.staminaBonus >= C.extras.combat.perfectEvadeStamina - 1e-6, `+${fmt(C.extras.combat.perfectEvadeStamina)}`, `+${fmt(log.staminaBonus)}`),
        check('X fortalecido no contra-ataque', !C.extras.toggles.enableCounterBonus || log.counterSpeed > 1, `× ${fmt(C.extras.combat.counterSpeed)}`, `× ${fmt(log.counterSpeed)}`)];
    },
  },
  {
    id: 'sidestep', name: 'Esquiva lateral no último instante', description: 'O azul sai para o lado logo depois de o vermelho investir.',
    positions: [vec(0, -2.6), vec(0, 0)], ticks: 120, setup: g => {face(g.fighters[0], 0);face(g.fighters[1], Math.PI);},
    script: (t) => [t === 13 ? cmd({move: vec(1, 0), dodge: true, dodgeDirection: vec(1, 0), target: 1}) : cmd({target: 1}), t === 10 ? cmd({move: vec(0, -1), tackle: true, target: 0}) : cmd({target: 0})],
    checks: ({log}) => [check('Nenhum impacto recebido', !events(log, 'impact').length, 0, events(log, 'impact').length), check('Sem dano no azul', log.damageTaken[0] === 0, 0, log.damageTaken[0])],
  },
  {
    id: 'launch', name: 'Lançamento em campo aberto', description: 'Tackle limpo em um adversário parado; mede tempo no ar e recuperação.',
    positions: [vec(0, -2.4), vec(0, 0)], ticks: 260, setup: g => {face(g.fighters[0], 0);face(g.fighters[1], Math.PI);},
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
    positions: [vec(0, 0), vec(0, 2.4)], ticks: 260,
    setup: g => {const h = C.test.arenaHalf;g.fighters[0].position = vec(0, h - 4);g.fighters[1].position = vec(0, h - 1.6);face(g.fighters[0], 0);face(g.fighters[1], Math.PI);},
    script: (t) => [t === 10 ? cmd({move: vec(0, 1), tackle: true, target: 1}) : cmd({target: 1}), cmd({target: 0})],
    checks: ({log, game}) => {
      const bound = C.test.arenaHalf - C.test.halfExtent, z = game.fighters[1].position.z;
      return [check('Impacto', events(log, 'impact').length, 'impact', log.events[0]?.result ?? 'nenhum'), check('Tocou a parede durante o voo', log.wallHits[1] > 0, '≥ 1', log.wallHits[1]),
        check('Ricochete para dentro', !C.extras.toggles.enableWallBounce || log.bounced, C.extras.toggles.enableWallBounce ? 'sim' : 'desligado', log.bounced ? 'sim' : 'não'),
        check('Termina dentro da arena', Math.abs(z) <= bound + 1e-9, `|z| ≤ ${fmt(bound)}`, Math.abs(z))];
    },
  },
  {
    id: 'exhaustion', name: 'Exaustão de stamina', description: 'O azul faz três esquivas seguidas e tenta uma quarta.',
    positions: [vec(0, -6), vec(0, 6)], ticks: 260, setup: g => {face(g.fighters[0], 0);face(g.fighters[1], Math.PI);},
    script: (t) => [[5, 60, 115, 170].includes(t) ? cmd({move: vec(1, 0), dodge: true, dodgeDirection: vec(1, 0)}) : cmd(), cmd()],
    checks: ({log}) => {
      const n = Math.floor(C.rules.staminaMax / C.extras.combat.actionCost + 1e-9);
      return [check('Ações aceitas', log.actionsStarted[0] === Math.min(4, n), Math.min(4, n), log.actionsStarted[0]),
        check('Fica exausto', n >= 4 || log.wasExhausted[0], n >= 4 ? 'não se aplica' : 'sim', log.wasExhausted[0] ? 'sim' : 'não'),
        check('Recuperação extra ao esgotar (passos)', n >= 4 || near(log.exhaustTicks[0], C.extras.combat.exhaustRecovery / C.test.step, 2), `${fmt(C.extras.combat.exhaustRecovery / C.test.step)} ± 2`, log.exhaustTicks[0])];
    },
  },
];

const pathGet = (root, path) => path.split('.').reduce((a, k) => a?.[k], root);
const pathSet = (root, path, v) => {const keys = path.split('.'), last = keys.pop();keys.reduce((a, k) => a[k], root)[last] = v;};

/** Prepara um cenário em um Game existente. Devolve funções para avançar e concluir (usadas pela interface e pelos testes). */
export function prepareScenario(def, game) {
  const saved = Object.fromEntries(Object.keys(def.overrides || {}).map(p => [p, pathGet(C, p)]));
  for (const [p, v] of Object.entries(def.overrides || {})) pathSet(C, p, v);
  game.mode = 'inactive';game.profile = 'balanced';game.enemyProfile = 'balanced';game.reset({positions: def.positions});def.setup?.(game);
  const start = structuredClone(game.fighters.map(f => ({x: f.position.x, z: f.position.z, hp: f.hp, stamina: f.stamina})));
  const log = {events: [], hitstopTicks: 0, afterHit: null, maxCounter: [0, 0], flew: [false, false], damageTaken: [0, 0], staminaBonus: 0, counterSpeed: 1, airTicks: [0, 0], landingTicks: [0, 0],
    wallHits: [0, 0], bounced: false, actionsStarted: [0, 0], wasExhausted: [false, false], exhaustTicks: [0, 0], maxZ: -Infinity};
  let t = 0, lastAction = [null, null];
  return {
    get tick() {return t;}, get done() {return t >= def.ticks;},
    commands() {return def.script(t, game);},
    /** Chamado depois de cada passo: atualiza o registro do cenário. */
    observe() {
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
      const enemy = game.fighters[1], bound = C.test.arenaHalf - C.test.halfExtent;
      if (enemy.flight) {if (Math.abs(enemy.position.z) >= bound - 1e-9 || Math.abs(enemy.position.x) >= bound - 1e-9) log.wallHits[1]++;if (enemy.flight.horizontal.z < 0 && log.wallHits[1]) log.bounced = true;}
      t++;
    },
    finish() {
      const result = {id: def.id, name: def.name, checks: def.checks({log, game, start})};result.ok = result.checks.every(c => c.ok);
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
