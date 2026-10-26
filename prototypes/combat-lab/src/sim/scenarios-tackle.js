// @ts-check
// Cenários do Tackle e do meteor slam: finta (início e carga), tackle carregado PL3, atrito do Tackle e meteor slam (acertando e esquivado).
// Mesmo formato dos cenários de scenarios.js: posições fixas, comandos roteirizados (sem IA) e lista “esperado × obtido” calculada
// a partir da configuração ATUAL, então continuam válidos quando os sliders mudam.
import {C} from './config.js';
import {vec} from './math.js';
import {nominalDistance} from './entity.js';

const cmd = (o = {}) => ({move: vec(), dodge: false, dodgeHeld: false, tackle: false, tackleHeld: false, guard: false, guardPressed: false, target: null, skill: null, skillHeld: null, ...o});
const face = (f, angle) => {f.facing = angle;f.visualFacing = angle;f.combatHeading = angle;};
const fmt = v => typeof v === 'number' ? (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(3).replace(/\.?0+$/, '')) : String(v);
const check = (label, ok, expected, actual) => ({label, ok: !!ok, expected: fmt(expected), actual: fmt(actual)});
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const FWD = vec(0, 1), LEFT = vec(-1, 0), BACK = vec(0, -1), steps = sec => Math.ceil(sec / C.test.step);
const yn = ok => ok ? 'sim' : 'não';
const ATTACK = () => C.profiles.balanced.attack;
const meteorTotal = () => C.rules.slamPrepTime + C.rules.slamFallTime + C.rules.slamGroundTime + C.rules.slamRecovery + 2.2;
/** Dash de C por cima do vermelho (t = 0) e X no ar entre os passos 12 e 15: vira meteor slam. */
const meteorBlue = (t, extra = {}) => t === 0 ? cmd({dodge: true, dodgeHeld: true, move: FWD, dodgeDirection: FWD}) : t >= 12 && t < 16 ? cmd({tackle: true, tackleHeld: true, dodgeHeld: true, move: FWD, ...extra}) : cmd({move: FWD, dodgeHeld: t < 12});

export const TACKLE_SCENARIOS = [
  {
    id: 'feint-startup', name: 'Finta no início do Tackle (esquiva rápida para o lado)', description: 'O azul começa um Tackle e aperta C com ← logo depois: o ataque vira uma esquiva rápida para o lado (mais curta, mais veloz e mais cara que a normal), com os efeitos de esquiva amarelos.',
    positions: [vec(0, -3), vec(0, 3)], ticks: () => steps(1.4), setup: g => {face(g.fighters[0], 0);face(g.fighters[1], Math.PI);},
    script: (t, g, s) => {const f = g.fighters[0];if (t === 13) s.sBefore = f.stamina;if (f.action?.feint) {s.fx = true;s.dur = f.action.durationScale;s.x0 ??= f.position.x;s.x1 = f.position.x;s.sAfter ??= f.stamina;}
      return [t === 10 ? cmd({tackle: true, move: FWD, dodgeDirection: FWD}) : t === 13 ? cmd({dodge: true, dodgeHeld: true, move: LEFT, dodgeDirection: LEFT}) : cmd({move: t > 13 ? LEFT : vec()}), cmd()];},
    checks: ({game, start, log, scratch}) => [
      check('A finta foi feita (1 vez)', (game.fighters[0].feints ?? 0) === 1, 1, game.fighters[0].feints ?? 0),
      check('Virou esquiva (estado dodge)', log.states.has('dodge') && scratch.fx, 'sim', yn(log.states.has('dodge') && scratch.fx)),
      check('Duração = feintDuration × a da esquiva', scratch.dur !== undefined && near(scratch.dur, C.rules.feintDuration, 1e-9), C.rules.feintDuration, scratch.dur ?? '—'),
      check('Foi para o lado (m)', Math.abs((scratch.x1 ?? 0) - (scratch.x0 ?? 0)) > .3, '> 0,3', Math.abs((scratch.x1 ?? 0) - (scratch.x0 ?? 0))),
      check('Ninguém foi atingido', log.damageTaken[1] === 0, 0, log.damageTaken[1]),
      check('Stamina: custo do Tackle devolvido e custo da finta cobrado', near((scratch.sAfter ?? 0) - (scratch.sBefore ?? 0), C.actions.tackle.cost - C.rules.feintCost, .15), (C.actions.tackle.cost - C.rules.feintCost).toFixed(2), ((scratch.sAfter ?? 0) - (scratch.sBefore ?? 0)).toFixed(2))],
  },
  {
    id: 'feint-charge', name: 'Finta durante a carga do Tackle (para trás)', description: 'O azul segura X para carregar e aperta C com ↓: a carga vira uma esquiva rápida para trás. Com ↑ (para a frente) não haveria finta.',
    positions: [vec(0, -3), vec(0, 3)], ticks: () => steps(2), setup: g => {face(g.fighters[0], 0);face(g.fighters[1], Math.PI);},
    script: (t, g, s) => {const f = g.fighters[0];if (f.tackleCharge) s.charging = true;if (f.action?.feint) {s.fx = true;s.z0 ??= f.position.z;s.z1 = f.position.z;}
      return [t === 10 ? cmd({tackle: true, tackleHeld: true, move: FWD}) : t > 10 && t < 70 ? cmd({tackleHeld: true, move: FWD}) : t === 70 ? cmd({dodge: true, dodgeHeld: true, move: BACK, dodgeDirection: BACK}) : cmd({move: t > 70 ? BACK : vec()}), cmd()];},
    checks: ({log, game, scratch}) => [
      check('Entrou no estado de carga', scratch.charging, 'sim', yn(scratch.charging)),
      check('A carga virou esquiva rápida', (game.fighters[0].feints ?? 0) === 1 && scratch.fx, 'sim', yn((game.fighters[0].feints ?? 0) === 1 && scratch.fx)),
      check('Foi para trás (m)', (scratch.z0 ?? 0) - (scratch.z1 ?? 0) > .3, '> 0,3', (scratch.z0 ?? 0) - (scratch.z1 ?? 0)),
      check('Nenhum golpe foi dado', !log.events.some(e => e.result === 'impact'), 'sim', yn(!log.events.some(e => e.result === 'impact')))],
  },
  {
    id: 'charged-pl3', name: 'Tackle carregado no PL3', description: 'O azul segura X pelo tempo máximo e solta contra o vermelho parado: dano e lançamento do PL3.',
    positions: [vec(0, -4.6), vec(0, 0)], ticks: () => steps(C.rules.chargeTackleMaxTime + 1.6), setup: g => {face(g.fighters[0], 0);face(g.fighters[1], Math.PI);},
    script: t => {const held = t * C.test.step < C.rules.chargeTackleMaxTime + .1;
      return [t === 5 ? cmd({tackle: true, tackleHeld: true, move: FWD, target: 1}) : t > 5 && held ? cmd({tackleHeld: true, move: FWD, target: 1}) : cmd({move: FWD, target: 1}), cmd()];},
    checks: ({log}) => {
      const hit = log.events.find(e => e.result === 'impact'), dmg = ATTACK() * C.rules.chargeTackleDamage3;
      return [check('Entrou no estado de carga', log.states.has('tackleCharge'), 'sim', yn(log.states.has('tackleCharge'))),
        check('Acertou o vermelho', !!hit, 'impact', hit?.result ?? 'nenhum'),
        check('Dano do PL3', hit && near(hit.damage, dmg, 1e-6), dmg, hit?.damage ?? 0),
        check('Vermelho foi lançado', log.flew[1], 'sim', yn(log.flew[1]))];
    },
  },
  {
    id: 'tackle-friction', name: 'Atrito do Tackle (PL1)', description: 'Tackle PL1 no vazio com atrito 4/s (só neste cenário): o alcance fica bem menor que o nominal, sem atrito.',
    overrides: {'rules.tackleFriction1': 4}, positions: [vec(0, -6), vec(7, 7)], ticks: () => steps(1.6), setup: g => {face(g.fighters[0], 0);face(g.fighters[1], Math.PI);},
    script: (t, g, s) => {const f = g.fighters[0];if (f.action?.kind === 'tackle') {s.startZ ??= f.position.z;s.endZ = f.position.z;}
      return [t === 10 ? cmd({tackle: true, move: FWD, dodgeDirection: FWD}) : cmd({move: t > 10 ? FWD : vec()}), cmd()];},
    checks: ({game, scratch}) => {
      const nominal = nominalDistance(game.fighters[0], 'tackle'), run = (scratch.endZ ?? 0) - (scratch.startZ ?? 0);
      return [check('O ataque aconteceu', scratch.startZ !== undefined, 'sim', yn(scratch.startZ !== undefined)),
        check('Alcance menor que o nominal sem atrito (m)', run < nominal * .8, `< ${(nominal * .8).toFixed(2)}`, run),
        check('Ainda avançou (m)', run > .3, '> 0,3', run)];
    },
  },
  {
    id: 'meteor-hit', name: 'Meteor slam: preparação, mergulho e impacto', description: 'O azul faz o dash por cima do vermelho e aperta X no ar: sobe (sem dano), despenca em cima dele e fica no estado do chão causando dano e lançamento.',
    positions: [vec(0, -3.75), vec(0, 0)], ticks: () => steps(meteorTotal()), setup: g => {face(g.fighters[0], 0);face(g.fighters[1], Math.PI);},
    script: (t, g, s) => {if (g.fighters[0].state === 'meteorPrep') s.hpPrep = g.fighters[1].hp;return [meteorBlue(t), cmd()];},
    checks: ({log, start, scratch}) => {
      const hit = log.events.find(e => e.result === 'impact' && e.slam), dmg = ATTACK() * C.rules.slamDamage, S = log.states;
      return [check('Passou pela preparação (meteorPrep)', S.has('meteorPrep'), 'sim', yn(S.has('meteorPrep'))),
        check('Sem dano durante a preparação (HP do vermelho)', scratch.hpPrep === start[1].hp, start[1].hp, scratch.hpPrep ?? '—'),
        check('Mergulhou (meteorDive)', S.has('meteorDive'), 'sim', yn(S.has('meteorDive'))),
        check('Ficou no estado do chão (meteorGround)', S.has('meteorGround'), 'sim', yn(S.has('meteorGround'))),
        check('Acertou o vermelho', !!hit, 'impact (slam)', hit ? 'impact (slam)' : 'nenhum'),
        check('Dano = ataque × slamDamage (sem Power Level)', hit && near(hit.damage, dmg, 1e-6), dmg, hit?.damage ?? 0),
        check('Vermelho foi lançado', log.flew[1], 'sim', yn(log.flew[1])),
        check('Nunca entrou em “aterrissando”', !S.has('landing'), 'sim', yn(!S.has('landing')))];
    },
  },
  {
    id: 'meteor-dodged', name: 'Meteor slam esquivado', description: 'Igual ao anterior, mas o vermelho esquiva quando o mergulho começa: o azul ainda cai no chão (meteorGround), sem dano e sem “aterrissando”.',
    positions: [vec(0, -3.75), vec(0, 0)], ticks: () => steps(meteorTotal()), setup: g => {face(g.fighters[0], 0);face(g.fighters[1], Math.PI);},
    script: (t, g, s) => {if (g.fighters[0].state === 'meteorDive' && s.dodgeAt === undefined) s.dodgeAt = t;
      return [meteorBlue(t), s.dodgeAt !== undefined && t >= s.dodgeAt && t < s.dodgeAt + 3 ? cmd({dodge: true, dodgeHeld: true, move: vec(1, 0), dodgeDirection: vec(1, 0)}) : cmd()];},
    checks: ({log}) => {
      const S = log.states;
      return [check('Mergulhou (meteorDive)', S.has('meteorDive'), 'sim', yn(S.has('meteorDive'))),
        check('Ficou no estado do chão (meteorGround)', S.has('meteorGround'), 'sim', yn(S.has('meteorGround'))),
        check('Vermelho sem dano', log.damageTaken[1] === 0, 0, log.damageTaken[1]),
        check('Nunca entrou em “aterrissando”', !S.has('landing'), 'sim', yn(!S.has('landing')))];
    },
  },
  {
    id: 'meteor-blocked', name: 'Meteor slam bloqueado', description: 'Igual ao anterior, mas o vermelho segura a guarda durante o mergulho: o bloqueio anula o lançamento, o dano vira o reduzido e o vermelho é ARRASTADO para trás deslizando no chão (sem voo), enquanto o azul NÃO recua — o slam continua, aterrissa (meteorGround) e finaliza normalmente.',
    positions: [vec(0, -3.75), vec(0, 0)], ticks: () => steps(meteorTotal()), setup: g => {face(g.fighters[0], 0);face(g.fighters[1], Math.PI);},
    script: (t, g, s) => {if (g.fighters[1].state === 'pushed' || g.fighters[1].state === 'landing') s.redLanding = true;return [meteorBlue(t), cmd({guard: true, target: 0})];},
    checks: ({log, game, start, scratch}) => {
      const S = log.states, partial = log.events.find(e => e.result === 'partial' && e.slam), after = log.afterHit;
      const dmg = ATTACK() * C.rules.slamDamage * C.extras.combat.guardDamageMultiplier;
      const pushDist = Math.hypot(game.fighters[1].position.x - start[1].x, game.fighters[1].position.z - start[1].z);
      return [check('Mergulhou (meteorDive)', S.has('meteorDive'), 'sim', yn(S.has('meteorDive'))),
        check('Bloqueio registrado (parcial, slam)', !!partial, 'partial (slam)', partial ? 'partial (slam)' : 'nenhum'),
        check('Dano reduzido pela guarda', partial && near(partial.damage, dmg, 1e-9), dmg, partial?.damage ?? 0),
        check('Sem troca para recuo', !S.has('recoil'), 'não', yn(!S.has('recoil'))),
        check('Aterrissou e seguiu no chão (meteorGround)', S.has('meteorGround'), 'sim', yn(S.has('meteorGround'))),
        check('Defensor recebe guard stun', after && near(after.defenderStun, C.rules.guardStun, 1e-6), C.rules.guardStun, after?.defenderStun ?? 0),
        check('Defensor arrastado para trás (m)', pushDist >= C.rules.slamBlockPushDistance * .7, `≥ ${(C.rules.slamBlockPushDistance * .7).toFixed(2)}`, pushDist),
        check('Defensor deslizou no chão (sem lançamento)', !log.flew[1] && scratch.redLanding, 'sim', yn(!log.flew[1] && scratch.redLanding)),
        check('Ação do azul concluída (sem recuo preso)', game.fighters[0].action === null && game.fighters[0].state !== 'recoil', 'sim', yn(game.fighters[0].action === null && game.fighters[0].state !== 'recoil')),
        check('Nunca entrou em “aterrissando”', !S.has('landing'), 'sim', yn(!S.has('landing')))];
    },
  },
];
