// @ts-check
// Cenários de um clique do overhaul de colisões (Fase 7): cada um monta uma situação de contato com o ambiente e termina com «esperado × obtido».
// Aparecem na lista de cenários do laboratório (painel «Cenários») junto com os demais e rodam sem interface nos testes (collision-scenarios.test.mjs).
// Medem só física/contato: nenhum custo de stamina, dano ou janela de cancelamento é alterado para o cenário passar.
import {C} from './config.js';
import {vec} from './math.js';
import {spawn} from './world.js';
import {solidContact} from './solid-contact.js';
import {physicsProbe} from './physics.js';
import {collectSolids} from '../nav/nav-graph.js';
import {damageDestructible} from './map.js';
import {bodyPenetration} from './collision-probe.js';

const cmd = (/** @type {any} */ o = {}) => ({move: vec(), dodge: false, dodgeHeld: false, tackle: false, tackleHeld: false, guard: false, guardPressed: false, jump: false, jumpHeld: false, target: null, skill: null, skillHeld: null, ...o});
const fmt = (/** @type {any} */ v) => typeof v === 'number' ? (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(3).replace(/\.?0+$/, '')) : String(v);
const check = (/** @type {string} */ label, /** @type {any} */ ok, /** @type {any} */ expected, /** @type {any} */ actual) => ({label, ok: !!ok, expected: fmt(expected), actual: fmt(actual)});
const steps = (/** @type {number} */ sec) => Math.ceil(sec / C.test.step);
const CIRCLE = {'map.arenaShape': 'circle', 'map.arenaRadius': 50};
const FAR = vec(-25, -25);   // o outro lutador fica longe e parado quando o cenário é de um só
const wallOf = (/** @type {any} */ e) => ({shape: 'box', pos: e.pos, hx: e.hx, hz: e.hz, angle: e.angle ?? 0});
const dest = (/** @type {string} */ id, /** @type {number} */ x, /** @type {number} */ z, /** @type {any} */ extra = {}) => ({id, hp: 30, maxHp: 30, pos: {x, y: 0, z}, size: {hx: .8, hz: .8, height: 1.6}, shape: 'box', angle: 0, state: 'solid', respawnTimer: 0, ghostTimer: 0, resistances: {physical: 1, projectile: 1, area: 1, environmental: 1}, ...extra});
/** Maior penetração 3D do lutador nos sólidos do MAPA neste instante (0 = nenhuma). */
const mapPen = (/** @type {any} */ g, /** @type {any} */ f) => {
  const y = f.flight ? f.flight.y : f.groundY;let m = 0;
  for (const s of collectSolids(g.mapState)) m = Math.max(m, bodyPenetration({x: f.position.x, y, z: f.position.z}, s));
  return m;
};
/** Acumula, a cada passo (chamado dentro de `script`), o pior caso de um valor medido. */
/** Referências de montagem de cada cenário, por jogo (WeakMap: nada fica pendurado no Game da interface). */
const STATE = new WeakMap();
const st = (/** @type {any} */ g) => {let o = STATE.get(g);if (!o) STATE.set(g, o = {});return o;};
const track = (/** @type {any} */ s, /** @type {string} */ key, /** @type {number} */ v) => {s[key] = Math.max(s[key] ?? -Infinity, v);};

export const COLLISION_SCENARIOS = [
  {
    id: 'col-wall-slant', name: 'Colisão: parede reta e inclinada (30°)',
    description: 'O azul corre contra uma parede de Move inclinada a 30°: não pode penetrar e deve deslizar pela tangente (só a componente que entra é removida).',
    positions: [vec(-4, 0), FAR], overrides: CIRCLE, ticks: () => steps(2),
    setup: (/** @type {any} */ g) => {st(g).wall = spawn(g.world, {kind: 'wall', pos: {x: 0, z: 0}, hx: .15, hz: 5, angle: Math.PI / 6, y: 0, height: 3}, []);},
    script: (/** @type {number} */ t, /** @type {any} */ g, /** @type {any} */ s) => {const c = solidContact(wallOf(st(g).wall), g.fighters[0].position, C.test.halfExtent);track(s, 'pen', c?.depth ?? 0);return [cmd({move: vec(1, 0)}), cmd()];},
    checks: ({game, scratch, start}) => {
      const f = game.fighters[0], moved = Math.hypot(f.position.x - start[0].x, f.position.z - start[0].z);
      return [check('Penetração máxima na parede (m)', (scratch.pen ?? 0) <= 1e-3, '≤ 0,001', scratch.pen ?? 0), check('Deslizou pela tangente (deslocamento ≥ 1,5 m)', moved >= 1.5, '≥ 1,5 m', moved.toFixed(2))];
    },
  },
  {
    id: 'col-wall-parallel', name: 'Colisão: deslocamento paralelo à parede',
    description: 'O azul anda encostado numa parede reta (com um pouco de input contra ela); o vermelho faz o mesmo no espaço livre. A parede não pode roubar velocidade tangencial.',
    positions: [vec(-.65, -3), vec(10, -3)], overrides: CIRCLE, ticks: () => steps(1.5),
    setup: (/** @type {any} */ g) => {st(g).wall = spawn(g.world, {kind: 'wall', pos: {x: 0, z: 0}, hx: .15, hz: 8, angle: 0, y: 0, height: 3}, []);},
    script: (/** @type {number} */ t, /** @type {any} */ g, /** @type {any} */ s) => {const c = solidContact(wallOf(st(g).wall), g.fighters[0].position, C.test.halfExtent);track(s, 'pen', c?.depth ?? 0);return [cmd({move: vec(.3, .954)}), cmd({move: vec(.3, .954)})];},
    checks: ({game, scratch, start}) => {
      const a = game.fighters[0].position.z - start[0].z, b = game.fighters[1].position.z - start[1].z;
      return [check('Penetração máxima na parede (m)', (scratch.pen ?? 0) <= 1e-3, '≤ 0,001', scratch.pen ?? 0), check('Avanço junto à parede ≥ 90 % do avanço livre', a >= .9 * b, `≥ ${(.9 * b).toFixed(2)} m`, a.toFixed(2))];
    },
  },
  {
    id: 'col-corner', name: 'Colisão: personagem preso em quina',
    description: 'Duas paredes formam um canto em L e o azul empurra na diagonal para dentro dele: sem penetração, sem oscilação no fim e sem «conflito de espaço».',
    positions: [vec(0, 0), FAR], overrides: CIRCLE, ticks: () => steps(2.5),
    setup: (/** @type {any} */ g) => {st(g).w1 = spawn(g.world, {kind: 'wall', pos: {x: 0, z: 3}, hx: 6, hz: .15, angle: 0, y: 0, height: 3}, []);st(g).w2 = spawn(g.world, {kind: 'wall', pos: {x: 3, z: 0}, hx: .15, hz: 6, angle: 0, y: 0, height: 3}, []);st(g).conf0 = physicsProbe.staticConflictsTotal;},
    script: (/** @type {number} */ t, /** @type {any} */ g, /** @type {any} */ s) => {
      const p = g.fighters[0].position;for (const w of [st(g).w1, st(g).w2]) track(s, 'pen', solidContact(wallOf(w), p, C.test.halfExtent)?.depth ?? 0);
      if (t === steps(2) - 1) s.p0 = {...p};return [cmd({move: vec(.7071, .7071)}), cmd()];
    },
    checks: ({game, scratch}) => {
      const p = game.fighters[0].position, drift = Math.hypot(p.x - scratch.p0.x, p.z - scratch.p0.z);
      return [check('Penetração máxima nas paredes (m)', (scratch.pen ?? 0) <= 1e-3, '≤ 0,001', scratch.pen ?? 0), check('Parado no canto (deriva nos últimos 0,5 s, m)', drift <= 1e-3, '≤ 0,001', drift), check('Conflitos de espaço', physicsProbe.staticConflictsTotal - st(game).conf0 === 0, 0, physicsProbe.staticConflictsTotal - st(game).conf0)];
    },
  },
  {
    id: 'col-two-obstacles', name: 'Colisão: dois obstáculos muito próximos',
    description: 'Duas caixas deixam um vão igual ao «Vão mínimo entre objetos» (padrão 1,2 m). O azul atravessa o vão sem penetrar nem ficar preso.',
    positions: [vec(0, 0), FAR], overrides: CIRCLE, ticks: () => steps(3),
    setup: (/** @type {any} */ g) => {const half = (C.map.passageClearance ?? 1.2) / 2;g.mapState.obstacles = [1, -1].map((k, i) => ({id: `ob${i}`, shape: 'box', pos: {x: k * (half + 1.5), y: 0, z: 4}, hx: 1.5, hz: 1.5, radius: 1.5, height: 2.2, angle: 0}));st(g).conf0 = physicsProbe.staticConflictsTotal;},
    script: (/** @type {number} */ t, /** @type {any} */ g, /** @type {any} */ s) => {track(s, 'pen', mapPen(g, g.fighters[0]));return [cmd({move: vec(0, 1)}), cmd()];},
    checks: ({game, scratch}) => [check('Penetração máxima (m)', (scratch.pen ?? 0) <= 1e-3, '≤ 0,001', scratch.pen ?? 0), check('Atravessou o vão (z > 6,5)', game.fighters[0].position.z > 6.5, '> 6,5 m', game.fighters[0].position.z.toFixed(2)), check('Conflitos de espaço', physicsProbe.staticConflictsTotal - st(game).conf0 === 0, 0, physicsProbe.staticConflictsTotal - st(game).conf0)],
  },
  {
    id: 'col-corridor-duel', name: 'Colisão: dois personagens num corredor sem saída (Tackle comprime o azul)',
    description: 'Corredor de 1,8 m fechado no fundo: o vermelho investe e empurra o azul contra a parede do fundo. Os corpos não se sobrepõem, o azul não penetra nenhuma parede e não há conflito de espaço.',
    positions: [vec(0, -5), vec(0, -1)], overrides: CIRCLE, ticks: () => steps(3),
    setup: (/** @type {any} */ g) => {
      st(g).ws = [-1, 1].map(k => spawn(g.world, {kind: 'wall', pos: {x: k * 1.0, z: 0}, hx: .1, hz: 7, angle: 0, y: 0, height: 3}, []));
      st(g).ws.push(spawn(g.world, {kind: 'wall', pos: {x: 0, z: -6}, hx: 1.1, hz: .1, angle: 0, y: 0, height: 3}, []));st(g).conf0 = physicsProbe.staticConflictsTotal;g.fighters[0].facing = 0;g.fighters[1].facing = Math.PI;
    },
    script: (/** @type {number} */ t, /** @type {any} */ g, /** @type {any} */ s) => {
      for (const f of g.fighters) for (const w of st(g).ws) track(s, 'pen', solidContact(wallOf(w), f.position, C.test.halfExtent)?.depth ?? 0);
      const [a, b] = g.fighters, alt = (/** @type {any} */ f) => (f.flight?.y ?? f.groundY ?? 0) + (f.vaultHeight ?? 0);
      if (Math.abs(alt(a) - alt(b)) < (C.extras.visual.bodyHeight ?? 1.2)) track(s, 'overlap', 2 * C.test.halfExtent - Math.max(Math.abs(a.position.x - b.position.x), Math.abs(a.position.z - b.position.z)));   // só conta na mesma altura (R7.11)
      return [cmd(), cmd({tackle: t === 0, move: vec(0, -1)})];
    },
    checks: ({game, scratch}) => [check('Penetração nas paredes (m)', (scratch.pen ?? 0) <= 1e-3, '≤ 0,001', scratch.pen ?? 0), check('Sobreposição entre os corpos (m)', (scratch.overlap ?? 0) <= 2e-3, '≤ 0,002', scratch.overlap ?? 0), check('Conflitos de espaço', physicsProbe.staticConflictsTotal - st(game).conf0 === 0, 0, physicsProbe.staticConflictsTotal - st(game).conf0)],
  },
  {
    id: 'col-tackle-destructible', name: 'Colisão: Tackle contra objeto destrutível',
    description: 'O azul investe contra um destrutível (30 HP). O objeto leva o dano do Tackle uma vez; o azul não atravessa enquanto ele existir.',
    positions: [vec(0, 0), FAR], overrides: CIRCLE, ticks: () => steps(2.5),
    setup: (/** @type {any} */ g) => {g.mapState.destructibles = [dest('d1', 0, 3)];},
    script: (/** @type {number} */ t, /** @type {any} */ g, /** @type {any} */ s) => {if (g.mapState.destructibles[0].state === 'solid') track(s, 'pen', mapPen(g, g.fighters[0]));return [t === 0 ? cmd({tackle: true, move: vec(0, 1)}) : cmd({move: vec(0, 1)}), cmd()];},
    checks: ({game, scratch}) => {const d = game.mapState.destructibles[0], dmg = C.rules.tackleDamage ?? 10;return [check('Penetração enquanto sólido (m)', (scratch.pen ?? 0) <= 1e-3, '≤ 0,001', scratch.pen ?? 0), check('Dano ao objeto: exatamente um Tackle', Math.abs((d.maxHp - d.hp) - dmg) < 1e-6, `${dmg} (uma vez)`, d.maxHp - d.hp)];},
  },
  {
    id: 'col-throw-pillar', name: 'Colisão: arremesso contra pilar',
    description: 'O vermelho é arremessado por golpe contra um pilar: rebate pelo ângulo e intensidade (R3.12), sem penetrar e sem dano (pilar é indestrutível).',
    positions: [vec(-20, -20), vec(0, 0)], overrides: CIRCLE, ticks: () => steps(3),
    setup: (/** @type {any} */ g) => {g.mapState.obstacles = [{id: 'pi', shape: 'pillar', pos: {x: 0, y: 0, z: 5}, hx: .9, hz: .9, radius: .9, height: 4.5, angle: 0}];const r = g.fighters[1];r.flight = {y: .01, vy: 5, horizontal: vec(0, 12)};r.launchedByHit = true;r.state = 'airborne';},
    script: (/** @type {number} */ t, /** @type {any} */ g, /** @type {any} */ s) => {const r = g.fighters[1];track(s, 'pen', mapPen(g, r));if (r.flight) {track(s, 'back', -r.flight.horizontal.z);track(s, 'fwd', r.flight.horizontal.z);}return [cmd(), cmd()];},
    checks: ({game, scratch}) => [check('Penetração no pilar (m)', (scratch.pen ?? 0) <= 1e-3, '≤ 0,001', scratch.pen ?? 0), check('Rebateu (velocidade z invertida)', (scratch.back ?? -9) > 0, 'sim', (scratch.back ?? -9) > 0 ? 'sim' : 'não'), check('Sem dano do pilar', game.fighters[1].hp === 100, 100, game.fighters[1].hp)],
  },
  {
    id: 'col-projectile-thin-barrier', name: 'Colisão: projétil rápido contra barreira fina',
    description: 'Projétil a 80 m/s (0,67 m por passo) contra uma barreira de 2 cm com o vermelho atrás: a varredura contínua acha o primeiro contato e o vermelho não é atingido.',
    positions: [vec(0, -3), vec(0, 8)], overrides: CIRCLE, ticks: () => steps(2),
    setup: (/** @type {any} */ g) => {spawn(g.world, {kind: 'barrier', owner: 1, pos: {x: 0, z: 4}, angle: 0, hx: 1.5, hz: .01, y: 0, height: 2, life: 5}, []);spawn(g.world, {kind: 'projectile', owner: 0, pos: {x: 0, z: -1}, angle: 0, speed: 80, radius: .035, y: .65, life: 3, hit: {damage: 10}}, []);},
    script: () => [cmd(), cmd()],
    checks: ({game, log}) => [check('Projétil barrado (evento «blocked»)', log.events.some((/** @type {any} */ e) => e.result === 'blocked'), 'sim', log.events.some((/** @type {any} */ e) => e.result === 'blocked') ? 'sim' : 'não'), check('Vermelho sem dano', game.fighters[1].hp === 100, 100, game.fighters[1].hp)],
  },
  {
    id: 'col-jump-over-obstacle', name: 'Colisão: salto sobre obstáculo baixo e adversário',
    description: 'Um obstáculo de 0,6 m e o vermelho logo depois: o azul salta andando e passa por cima do obstáculo (R7.16) sem empurrão lateral nem penetração em solo.',
    positions: [vec(0, -1), vec(3, 7)], overrides: CIRCLE, ticks: () => steps(2.5),
    setup: (/** @type {any} */ g) => {g.mapState.obstacles = [{id: 'low', shape: 'box', pos: {x: 0, y: 0, z: 2}, hx: 1.5, hz: .6, radius: 1.5, height: .6, angle: 0}];},
    script: (/** @type {number} */ t, /** @type {any} */ g, /** @type {any} */ s) => {if (!g.fighters[0].flight && t > 5) track(s, 'pen', mapPen(g, g.fighters[0]));return [cmd({move: vec(0, 1), jump: t === 40, jumpHeld: t >= 40 && t < 60}), cmd()];},
    checks: ({game, scratch}) => [check('Passou por cima (z > 3)', game.fighters[0].position.z > 3, '> 3 m', game.fighters[0].position.z.toFixed(2)), check('Penetração em solo (m)', (scratch.pen ?? 0) <= 1e-3, '≤ 0,001', scratch.pen ?? 0)],
  },
  {
    id: 'col-land-platform-top', name: 'Colisão: pouso no topo de plataforma',
    description: 'O azul é arremessado por cima de uma plataforma de 1 m e pousa no topo: altura de apoio = 1 m e superfície de apoio = plataforma.',
    positions: [vec(0, 0), FAR], overrides: CIRCLE, ticks: () => steps(3),
    setup: (/** @type {any} */ g) => {g.mapState.platforms = [{id: 'pl', pos: {x: 0, y: 0, z: 4}, width: 3, depth: 3, height: 1}];const f = g.fighters[0];f.flight = {y: .01, vy: 7.5, horizontal: vec(0, 5)};f.launchedByHit = true;f.state = 'airborne';},
    script: () => [cmd(), cmd()],
    checks: ({game}) => {const f = game.fighters[0];return [check('Pousou (sem voo)', !f.flight, 'sim', f.flight ? 'não' : 'sim'), check('Superfície de apoio', f.support?.kind === 'platform', 'platform', f.support?.kind ?? '—'), check('Altura de apoio (m)', Math.abs(f.groundY - 1) < 1e-9, 1, f.groundY)];},
  },
  {
    id: 'col-platform-underside', name: 'Colisão: parte inferior de um bloco suspenso',
    description: 'Um bloco flutua a 1,4 m do chão sobre o azul. O azul salta: a cabeça para na face inferior (contato de teto) e o corpo nunca entra no bloco.',
    positions: [vec(0, 0), FAR], overrides: CIRCLE, ticks: () => steps(1.5),
    setup: (/** @type {any} */ g) => {g.mapState.obstacles = [{id: 'sus', shape: 'box', pos: {x: 0, y: 1.4, z: 0}, hx: 1.5, hz: 1.5, radius: 1.5, height: .5, angle: 0}];},
    script: (/** @type {number} */ t, /** @type {any} */ g, /** @type {any} */ s) => {const f = g.fighters[0];if (f.flight) track(s, 'head', f.flight.y + (C.extras.visual.bodyHeight ?? 1.2));return [cmd({jump: t === 5, jumpHeld: t >= 5 && t < 30}), cmd()];},
    checks: ({game, scratch}) => [check('Houve contato de teto', (game.fighters[0].lastCeilingBump?.n ?? 0) >= 1, '≥ 1', game.fighters[0].lastCeilingBump?.n ?? 0), check('Cabeça nunca acima da face inferior (m)', (scratch.head ?? 0) <= 1.4 + 1e-6, '≤ 1,4', (scratch.head ?? 0).toFixed(4))],
  },
  {
    id: 'col-support-destroyed', name: 'Colisão: destruição do suporte sob os pés',
    description: 'O azul está em cima de um destrutível (1,6 m). O objeto é destruído: o azul perde o apoio, cai até o chão e o objeto deixa de ser sólido.',
    positions: [vec(0, 0), FAR], overrides: CIRCLE, ticks: () => steps(2),
    setup: (/** @type {any} */ g) => {g.mapState.destructibles = [dest('d1', 0, 0)];g.fighters[0].groundY = 1.6;},
    script: (/** @type {number} */ t, /** @type {any} */ g) => {if (t === 30) damageDestructible(g.mapState.destructibles[0], 999, 'physical', null, g.mapState, []);return [cmd(), cmd()];},
    checks: ({game}) => {const f = game.fighters[0];return [check('Caiu até o chão', Math.abs(f.groundY) < 1e-9 && !f.flight, 'chão', `${f.groundY.toFixed(2)} m${f.flight ? ' (em voo)' : ''}`), check('Apoio atual', f.support?.kind === 'ground', 'ground', f.support?.kind ?? '—')];},
  },
  {
    id: 'col-drop-respawn', name: 'Colisão: drop e respawn de destrutível',
    description: 'O destrutível é destruído: o drop cai até o chão e o objeto reaparece (prévia translúcida e depois sólido) em outra posição com vão livre. Tempos encurtados só neste cenário (1–2 s).',
    positions: [vec(-20, -20), vec(20, 20)], overrides: {...CIRCLE, 'map.destructibleRespawnMin': 1, 'map.destructibleRespawnMax': 2, 'map.destructibleGhostPreview': .5}, ticks: () => steps(6),
    setup: (/** @type {any} */ g) => {g.mapState.destructibles = [dest('d1', 5, 5)];st(g).p0 = {x: 5, z: 5};},
    script: (/** @type {number} */ t, /** @type {any} */ g, /** @type {any} */ s) => {
      if (t === 10) damageDestructible(g.mapState.destructibles[0], 999, 'physical', null, g.mapState, []);
      const d = g.mapState.destructibles[0];if (d.state === 'ghost') s.ghost = true;
      for (const it of g.mapState.items) if (it.isDrop) s.drop = true;return [cmd(), cmd()];
    },
    checks: ({game, scratch}) => {const d = game.mapState.destructibles[0], moved = Math.hypot(d.pos.x - st(game).p0.x, d.pos.z - st(game).p0.z);return [check('Gerou drop', scratch.drop, 'sim', scratch.drop ? 'sim' : 'não'), check('Passou pela prévia', scratch.ghost, 'sim', scratch.ghost ? 'sim' : 'não'), check('Reapareceu sólido', d.state === 'solid', 'solid', d.state), check('Em outra posição', moved > 0.5, '> 0,5 m', moved.toFixed(2))];},
  },
  {
    id: 'col-invalid-spawn', name: 'Colisão: objeto gerado em posição inicialmente inválida',
    description: 'A prévia de um destrutível está sob o azul. A materialização é adiada enquanto o corpo estiver na folga; depois que ele sai, o objeto vira sólido.',
    positions: [vec(0, 3), FAR], overrides: CIRCLE, ticks: () => steps(3),
    setup: (/** @type {any} */ g) => {g.mapState.destructibles = [dest('d1', 0, 3, {state: 'ghost', ghostTimer: .1, hp: 0})];g.mapState.destructibles[0].hp = 30;},
    script: (/** @type {number} */ t, /** @type {any} */ g, /** @type {any} */ s) => {
      const d = g.mapState.destructibles[0], f = g.fighters[0];
      if (t < steps(1.2) && d.state === 'solid') s.early = true;
      if (d.state === 'solid') track(s, 'pen', mapPen(g, f));
      return [t >= steps(1.2) ? cmd({move: vec(1, 0)}) : cmd(), cmd()];
    },
    checks: ({game, scratch}) => [check('Não materializou sobre o lutador', !scratch.early, 'sim', scratch.early ? 'não' : 'sim'), check('Materializou depois que ele saiu', game.mapState.destructibles[0].state === 'solid', 'solid', game.mapState.destructibles[0].state), check('Penetração depois (m)', (scratch.pen ?? 0) <= 1e-3, '≤ 0,001', scratch.pen ?? 0)],
  },
  {
    id: 'col-simultaneous', name: 'Colisão: vários ataques e contatos ao mesmo tempo',
    description: 'Mapa denso: os dois lutadores investem em direção aos objetos e um ao outro enquanto um projétil cruza a cena. Nenhum NaN, nenhum conflito de espaço e ninguém afunda em sólido no chão.',
    positions: [vec(-3, 0), vec(3, 0)], overrides: CIRCLE, ticks: () => steps(4),
    setup: (/** @type {any} */ g) => {
      g.mapState.obstacles = [{id: 'o1', shape: 'pillar', pos: {x: 0, y: 0, z: 4}, hx: .9, hz: .9, radius: .9, height: 4, angle: 0}, {id: 'o2', shape: 'box', pos: {x: 0, y: 0, z: -4}, hx: 1.5, hz: 1, radius: 1.5, height: 2, angle: 0}];
      g.mapState.destructibles = [dest('d1', -5, 3), dest('d2', 5, -3)];g.mapState.platforms = [{id: 'pl', pos: {x: 0, y: 0, z: 9}, width: 3, depth: 3, height: 1}];
      spawn(g.world, {kind: 'projectile', owner: 0, pos: {x: -8, z: 2}, angle: Math.PI / 2, speed: 20, radius: .15, y: .65, life: 3, hit: {damage: 5}}, []);st(g).conf0 = physicsProbe.staticConflictsTotal;
    },
    script: (/** @type {number} */ t, /** @type {any} */ g, /** @type {any} */ s) => {
      for (const f of g.fighters) {if (![f.position.x, f.position.z].every(Number.isFinite)) s.nan = true;if (!f.flight) track(s, 'pen', mapPen(g, f));}
      const a = t % 240 < 120;return [cmd({tackle: t % 120 === 0, move: a ? vec(.5, .87) : vec(-.5, -.87)}), cmd({tackle: t % 150 === 30, move: a ? vec(-.5, .87) : vec(.5, -.87)})];
    },
    checks: ({game, scratch}) => [check('Sem NaN', !scratch.nan, 'sim', scratch.nan ? 'não' : 'sim'), check('Penetração no chão (m)', (scratch.pen ?? 0) <= 0.02, '≤ 0,02', scratch.pen ?? 0), check('Conflitos de espaço', physicsProbe.staticConflictsTotal - st(game).conf0 === 0, 0, physicsProbe.staticConflictsTotal - st(game).conf0)],
  },
];
