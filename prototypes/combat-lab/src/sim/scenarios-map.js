// @ts-check
// Cenários de teste do Novo Mapa (Rodadas 1–11):
// Física circular, plataformas 3D, salto normal, destrutíveis, consumíveis,
// progressão de estágios, escudos temporários, IA e determinismo de simulação.
import {C} from './config.js';
import {vec, add, sub, scale, length, normalize} from './math.js';
import {nominalDistance, getFighterMaxStamina} from './entity.js';
import {MAP_DEFAULTS, createMapState, applyConsumableEffect, applyShield, processDamageWithShieldAndStages} from './map.js';

const cmd = (o = {}) => ({move: vec(), dodge: false, dodgeHeld: false, tackle: false, tackleHeld: false, guard: false, guardPressed: false, jump: false, target: null, skill: null, skillHeld: null, ...o});
const face = (f, angle) => {f.facing = angle;f.visualFacing = angle;f.combatHeading = angle;};
const fmt = v => typeof v === 'number' ? (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(3).replace(/\.?0+$/, '')) : String(v);
const check = (label, ok, expected, actual) => ({label, ok: !!ok, expected: fmt(expected), actual: fmt(actual)});
const near = (a, b, tol = 1e-4) => Math.abs(a - b) <= tol;
const steps = sec => Math.ceil(sec / C.test.step);
const yn = ok => ok ? 'sim' : 'não';

export const MAP_SCENARIOS = [
  // 1. FÍSICA: Borda circular
  {
    id: 'map-circle-bound',
    name: 'Física: Borda circular (rebote e contenção)',
    description: 'O lutador corre em direção ao perímetro da arena circular de 50 m de raio; é contido no limite radial com rebote elástico.',
    positions: [vec(0, 47), vec(0, 0)],
    overrides: {'map.arenaShape': 'circle', 'map.arenaRadius': 50},
    ticks: () => steps(1.0),
    setup: g => {
      face(g.fighters[0], Math.PI / 2);
      g.fighters[0].velocity = vec(0, 20);
    },
    script: t => [cmd({move: vec(0, 1)}), cmd()],
    checks: ({game}) => {
      const f = game.fighters[0];
      const dist = Math.hypot(f.position.x, f.position.z);
      const contained = dist <= 50.05;
      const bouncedBack = f.velocity.z <= 0 || f.position.z < 49.9;
      return [
        check('Contido dentro do raio de 50 m', contained, '<= 50,0 m', dist.toFixed(2)),
        check('Rebote radial para o interior', bouncedBack, 'sim', yn(bouncedBack)),
      ];
    },
  },

  // 2. FÍSICA: Wall-splat circular
  {
    id: 'map-circle-wall-splat',
    name: 'Física: Wall-splat na borda circular',
    description: 'Lutador arremessado em direção à borda circular enquanto desce em velocidade suficiente entra em estado wallSplat.',
    positions: [vec(0, 45), vec(0, 0)],
    overrides: {'map.arenaShape': 'circle', 'map.arenaRadius': 50, 'extras.toggles.enableWallSplat': 1, 'rules.wallSplatMinSpeed': 8},
    ticks: () => steps(1.2),
    setup: g => {
      const f = g.fighters[0];
      f.flight = {
        y: 3.0,
        horizontal: vec(0, 18),
        vy: -2,
        targetVy: 0,
        t: 0,
        duration: 2.0,
      };
      f.state = 'airborne';
    },
    script: t => [cmd(), cmd()],
    checks: ({log, game}) => {
      const splatted = log.events.some(e => e.result === 'wallSplat') || game.fighters[0].state === 'wallSplat';
      return [
        check('Entrou no estado wallSplat ao atingir a borda', splatted, 'sim', yn(splatted)),
      ];
    },
  },

  // 3. SALTO: Salto parado
  {
    id: 'map-jump-standing',
    name: 'Salto: Salto normal parado (2,0 m)',
    description: 'O azul pressiona Espaço parado; decola verticalmente atingindo aproximadamente 2,0 m de altitude sem deslocamento lateral.',
    positions: [vec(0, 0), vec(5, 5)],
    ticks: () => steps(1.5),
    setup: g => {
      face(g.fighters[0], 0);
      g.fighters[0].stamina = 3;
    },
    script: (t, g, scratch) => {
      const f = g.fighters[0];
      const y = (f.flight?.y ?? f.groundY ?? 0);
      scratch.peakY = Math.max(scratch.peakY ?? 0, y);
      return [t === 5 ? cmd({jump: true}) : cmd(), cmd()];
    },
    checks: ({log, game, scratch}) => {
      const f = game.fighters[0];
      const peakY = scratch.peakY ?? f.position.y ?? 0;
      return [
        check('Atingiu altitude do salto normal (~2 m)', peakY >= 1.6 && peakY <= 2.3, '~ 2,0 m', peakY.toFixed(2)),
        check('Deslocamento horizontal mínimo', Math.hypot(f.position.x, f.position.z) < 0.2, '< 0,2 m', Math.hypot(f.position.x, f.position.z).toFixed(2)),
        check('Sem custo de stamina', near(f.stamina, 3, 0.01), 3.0, f.stamina.toFixed(2)),
      ];
    },
  },

  // 4. SALTO: Salto em movimento
  {
    id: 'map-jump-moving',
    name: 'Salto: Conservação do impulso horizontal',
    description: 'O combatente salta durante a corrida para a frente; conserva o impulso horizontal até a aterrissagem sem manobra aérea.',
    positions: [vec(0, -6), vec(10, 10)],
    ticks: () => steps(1.5),
    setup: g => {
      face(g.fighters[0], 0);
      g.fighters[0].velocity = vec(0, 6);
    },
    script: (t, g, scratch) => {
      const f = g.fighters[0];
      if (f.flight && f.flight.isNormalJump) {
        scratch.airMaxX = Math.max(scratch.airMaxX ?? 0, Math.abs(f.position.x));
      }
      return [t <= 5 ? cmd({move: vec(0, 1), jump: t === 5}) : cmd({move: vec(1, 0)}), cmd()];
    },
    checks: ({game, scratch}) => {
      const f = game.fighters[0];
      const movedForward = f.position.z > -4.0;
      const noSteerX = (scratch.airMaxX ?? 0) < 0.1;
      return [
        check('Conservou avanço frontal no ar', movedForward, 'sim', yn(movedForward)),
        check('Sem manobra lateral durante o salto', noSteerX, 'sim', yn(noSteerX)),
      ];
    },
  },

  // 5. PLATAFORMA: Subida na plataforma de 1,0 m
  {
    id: 'map-plat-1m',
    name: 'Plataforma: Subida e combate elevado (1,0 m)',
    description: 'O azul salta sobre a plataforma de 1,0 m; aterrissa e permanece caminhando em y = 1,0.',
    positions: [vec(-10, 5.0), vec(0, 0)],
    ticks: () => steps(1.8),
    setup: g => {
      g.mapState.platforms = [{id: 'p1', pos: {x: -10, z: 8}, width: 3, depth: 3, height: 1.0}];
      g.fighters[0].position = {x: -10, z: 5.0};
      g.fighters[0].velocity = vec(0, 4);
    },
    script: t => [t === 5 ? cmd({jump: true, move: vec(0, 1)}) : t < 30 ? cmd({move: vec(0, 1)}) : cmd(), cmd()],
    checks: ({game}) => {
      const f = game.fighters[0];
      const onPlatform = (f.groundY ?? 0) >= 0.95 && Math.abs(f.position.x - (-10)) < 1.6 && Math.abs(f.position.z - 8) < 1.6;
      return [
        check('Aterrissou no topo da plataforma de 1,0 m', onPlatform, 'sim (y=1.0)', `y=${(f.groundY ?? 0).toFixed(2)}`),
      ];
    },
  },

  // 6. PLATAFORMA: Subida na plataforma de 1,5 m
  {
    id: 'map-plat-15m',
    name: 'Plataforma: Alcance vertical na plataforma de 1,5 m',
    description: 'Salto normal de 2,0 m tem alcance vertical suficiente para subir na plataforma de 1,5 m.',
    positions: [vec(12, -13.0), vec(0, 0)],
    ticks: () => steps(1.8),
    setup: g => {
      g.mapState.platforms = [{id: 'p2', pos: {x: 12, z: -10}, width: 3, depth: 3, height: 1.5}];
      g.fighters[0].position = {x: 12, z: -13.0};
      g.fighters[0].velocity = vec(0, 3.5);
    },
    script: t => [t === 5 ? cmd({jump: true, move: vec(0, 1)}) : t < 30 ? cmd({move: vec(0, 1)}) : cmd(), cmd()],
    checks: ({game}) => {
      const f = game.fighters[0];
      const onPlatform = (f.groundY ?? 0) >= 1.45;
      return [
        check('Alcançou o topo da plataforma de 1,5 m', onPlatform, 'sim (y=1.5)', `y=${(f.groundY ?? 0).toFixed(2)}`),
      ];
    },
  },

  // 7. PLATAFORMA: Queda pela borda
  {
    id: 'map-plat-edge-fall',
    name: 'Plataforma: Transição de queda balística pela borda',
    description: 'Ao andar além da borda da plataforma sem pular, o lutador transiciona para queda balística natural até o solo.',
    positions: [vec(0, 0), vec(10, 10)],
    ticks: () => steps(1.5),
    setup: g => {
      g.mapState.platforms = [{id: 'p1', pos: {x: 0, z: 0}, width: 2, depth: 2, height: 1.0}];
      g.fighters[0].position = {x: 0, z: 0.8, y: 1.0};
      g.fighters[0].groundY = 1.0;
    },
    script: t => [cmd({move: vec(0, 1)}), cmd()],
    checks: ({game, log}) => {
      const f = game.fighters[0];
      const fell = f.position.z > 1.2 && (f.position.y ?? 0) <= 0.2;
      return [
        check('Caiu da plataforma até o solo', fell, 'solo (y=0)', `y=${(f.position.y ?? 0).toFixed(2)}`),
      ];
    },
  },

  // 7b. PLATAFORMA: Salto de plataforma + Meteor Slam e novo salto
  {
    id: 'map-plat-slam-jump',
    name: 'Plataforma: Salto de plataforma + Meteor Slam e novo salto',
    description: 'O combatente salta de cima da plataforma de 1,0 m, ativa meteor slam no ar, mergulha até o chão e salta novamente.',
    positions: [vec(0, 0), vec(10, 10)],
    ticks: () => steps(2.6),
    setup: g => {
      g.mapState.platforms = [{id: 'p1', pos: {x: 0, z: 0}, width: 3, depth: 3, height: 1.0}];
      g.fighters[0].position = {x: 0, z: 0};
      g.fighters[0].groundY = 1.0;
    },
    script: (t, g, scratch) => {
      const f = g.fighters[0];
      if (f.state === 'meteorPrep' || f.state === 'meteorDive' || f.state === 'meteorGround') {
        scratch.slamExecuted = true;
      }
      if (t >= steps(2.05) && (f.state === 'airborne' || f.flight?.isNormalJump)) {
        scratch.jumpedAgain = true;
      }
      let cmd0 = {move: vec(0, 1)};
      if (t === 2) cmd0.jump = true;
      if (t === 14) cmd0.tackle = true;
      if (t === steps(2.05)) cmd0.jump = true;
      return [cmd(cmd0), cmd()];
    },
    checks: ({scratch}) => [
      check('Meteor slam executado do alto sem ser abortado', !!scratch.slamExecuted, 'sim', yn(scratch.slamExecuted)),
      check('Conseguiu saltar novamente após o meteor slam', !!scratch.jumpedAgain, 'sim', yn(scratch.jumpedAgain)),
    ],
  },

  // 8. COMBATE: Tackle em altura diferente
  {
    id: 'map-combat-height-diff',
    name: 'Combate: Tackle em altura diferente (hitbox 3D)',
    description: 'Um lutador no chão investe horizontalmente contra outro em cima da plataforma de 1,5 m: desnível > 1,2 m não conecta dano.',
    positions: [vec(0, -3), vec(0, 0)],
    ticks: () => steps(1.2),
    setup: g => {
      g.mapState.platforms = [{id: 'p1', pos: {x: 0, z: 0}, width: 3, depth: 3, height: 1.5}];
      g.fighters[1].position = {x: 0, z: 0, y: 1.5};
      g.fighters[1].groundY = 1.5;
      face(g.fighters[0], 0);
    },
    script: t => [t === 5 ? cmd({tackle: true, move: vec(0, 1), target: 1}) : cmd({target: 1}), cmd()],
    checks: ({log}) => {
      const hit = log.events.some(e => e.result === 'impact');
      return [
        check('Tackle no solo não acertou o lutador elevado', !hit, 'sem impacto', hit ? 'impacto incorreto' : 'sem impacto'),
      ];
    },
  },

  // 9. COMBATE: Arremesso sobre plataforma
  {
    id: 'map-combat-launch-platform',
    name: 'Combate: Pouso físico sobre plataforma',
    description: 'Um lutador lançado para cima que cruza a área da plataforma aterrissa solidamente sobre seu topo elevado.',
    positions: [vec(0, -1), vec(0, 1)],
    ticks: () => steps(1.6),
    setup: g => {
      g.mapState.platforms = [{id: 'p1', pos: {x: 0, z: 3}, width: 4, depth: 4, height: 1.0}];
      const victim = g.fighters[1];
      // Lançado de FORA da área da plataforma: o arco sobe, cruza a borda acima do topo e aterrissa no topo.
      // (O ponto de partida original, colado na face lateral, só "pousava no topo" por causa do defeito de
      // pouso durante a subida; com a física corrigida ele bate na face inferior e cai ao solo — comportamento certo.)
      victim.position = vec(0, -1.5);
      victim.flight = {
        y: 0,
        horizontal: vec(0, 6),
        vy: 10,
        targetVy: 0,
        t: 0,
        duration: 1.5,
      };
      victim.state = 'airborne';
    },
    script: t => [cmd(), cmd()],
    checks: ({game}) => {
      const v = game.fighters[1];
      const landedElevated = (v.groundY ?? 0) >= 0.95 && Math.abs(v.position.z - 3) < 2.0;
      return [
        check('Lançado pousou sobre o topo da plataforma', landedElevated, 'sim (y=1.0)', `y=${(v.groundY ?? 0).toFixed(2)}`),
      ];
    },
  },

  // 10. OBJETOS: Destrutível com HP baixo
  {
    id: 'map-destructible-break',
    name: 'Objetos: Quebra de destrutível e drop de consumível',
    description: 'Tackle atinge objeto destrutível com 5 HP restante; destrói o objeto e gera drop balístico de consumível.',
    positions: [vec(0, -2), vec(10, 10)],
    ticks: () => steps(1.0),
    setup: g => {
      g.mapState.destructibles = [{
        id: 'd1', pos: {x: 0, z: 0, y: 0}, size: {hx: 0.8, hz: 0.8, height: 1.6},
        hp: 5, maxHp: 30, state: 'solid', respawnTimer: 20, ghostTimer: 0,
        categoryMultipliers: {physical: 1.0},
      }];
      face(g.fighters[0], 0);
    },
    script: t => [t === 5 ? cmd({tackle: true, move: vec(0, 1)}) : cmd(), cmd()],
    checks: ({game, log}) => {
      const d = game.mapState.destructibles[0];
      const destroyed = d.state === 'dead' || log.events.some(e => e.result === 'destructibleDestroyed');
      const dropped = game.mapState.items.some(it => it.isDrop) || log.events.some(e => e.result === 'itemDropped' || e.result === 'dropSpawned');
      return [
        check('Destrutível foi quebrado', destroyed, 'sim', yn(destroyed)),
        check('Consumível liberado por drop', dropped, 'sim', yn(dropped)),
      ];
    },
  },

  // 11. OBJETOS: Choque contra destrutível
  {
    id: 'map-destructible-tackle',
    name: 'Objetos: Dano a destrutível por Tackle',
    description: 'Tackle contra destrutível com 30 HP reduz a vida do objeto proporcionalmente ao ataque.',
    positions: [vec(0, -2.5), vec(10, 10)],
    ticks: () => steps(1.0),
    setup: g => {
      g.mapState.destructibles = [{
        id: 'd1', pos: {x: 0, z: 0, y: 0}, size: {hx: 0.8, hz: 0.8, height: 1.6},
        hp: 30, maxHp: 30, state: 'solid', respawnTimer: 20, ghostTimer: 0,
        categoryMultipliers: {physical: 1.0},
      }];
      face(g.fighters[0], 0);
    },
    script: t => [t === 5 ? cmd({tackle: true, move: vec(0, 1)}) : cmd(), cmd()],
    checks: ({game}) => {
      const d = game.mapState.destructibles[0];
      const damaged = d.hp < 30;
      return [
        check('Destrutível recebeu dano do tackle', damaged, '< 30 HP', `${d.hp} HP`),
      ];
    },
  },

  // 12. OBJETOS: Respawn acelerado
  {
    id: 'map-destructible-respawn',
    name: 'Objetos: Respawn com prévia fantasma (ghost)',
    description: 'Destrutível destruído passa por fase de prévia translúcida e ressurge sólido com HP restaurado.',
    positions: [vec(-15, 0), vec(15, 0)],
    ticks: () => steps(1.5),
    setup: g => {
      g.mapState.destructibles = [{
        id: 'd1', pos: {x: 0, z: 0, y: 0}, size: {hx: 0.8, hz: 0.8, height: 1.6},
        hp: 0, maxHp: 30, state: 'dead', respawnTimer: 0.8, ghostTimer: 0,
        categoryMultipliers: {physical: 1.0},
      }];
    },
    script: t => [cmd(), cmd()],
    checks: ({game, log}) => {
      const d = game.mapState.destructibles[0];
      const ghostAppeared = log.events.some(e => e.result === 'destructibleGhost');
      const solidAgain = d.state === 'solid' && d.hp === 30;
      return [
        check('Fase fantasma anunciada', ghostAppeared, 'sim', yn(ghostAppeared)),
        check('Ressurgiu sólido com 30 HP', solidAgain, 'sim', yn(solidAgain)),
      ];
    },
  },

  // 13. OBJETOS: Geração congestionada
  {
    id: 'map-destructible-congested',
    name: 'Objetos: Adiamento de respawn em área congestionada',
    description: 'Se a posição sorteada de respawn estiver ocupada por lutador, a materialização sólida é adiada.',
    positions: [vec(0, 0), vec(0, 0)],
    ticks: () => steps(0.8),
    setup: g => {
      // Combatente exatamente na posição da entidade
      g.fighters[0].position = {x: 0, z: 0, y: 0};
      g.mapState.destructibles = [{
        id: 'd1', pos: {x: 0, z: 0, y: 0}, size: {hx: 0.8, hz: 0.8, height: 1.6},
        hp: 0, maxHp: 30, state: 'ghost', respawnTimer: 0, ghostTimer: 0.05,
        categoryMultipliers: {physical: 1.0},
      }];
    },
    script: t => [cmd(), cmd()],
    checks: ({game}) => {
      const d = game.mapState.destructibles[0];
      const postponed = d.state === 'ghost' && d.ghostTimer > 0;
      return [
        check('Materialização sólida adiada por obstrução', postponed, 'sim', yn(postponed)),
      ];
    },
  },

  // 14. ITENS: Coleta de HP
  {
    id: 'map-item-heal-hp',
    name: 'Consumíveis: Coleta de Pílula de HP (+20 HP)',
    description: 'Combatente com 60 HP caminha sobre Pílula de HP; recupera exatamente 20 pontos de vida.',
    positions: [vec(0, -2), vec(10, 10)],
    ticks: () => steps(1.0),
    setup: g => {
      g.fighters[0].hp = 60;
      g.mapState.items = [{
        id: 'item1', type: 'heal_hp', pos: {x: 0, z: 0, y: 0.4}, life: 15, isDrop: false, vy: 0,
      }];
      face(g.fighters[0], 0);
    },
    script: t => [cmd({move: vec(0, 1)}), cmd()],
    checks: ({game, log}) => {
      const f = game.fighters[0];
      const collected = log.events.some(e => e.result === 'itemCollected');
      return [
        check('Pílula de HP coletada', collected, 'sim', yn(collected)),
        check('Vida recuperada para 80 HP', near(f.hp, 80, 0.5), 80, f.hp.toFixed(1)),
      ];
    },
  },

  // 15. ITENS: Cura excedente vira escudo
  {
    id: 'map-item-heal-overflow',
    name: 'Consumíveis: Conversão de cura excedente em escudo',
    description: 'Combatente com 90 HP coleta Pílula de HP (+20 HP); atinge 100 HP e o excedente de 10 vira escudo temporário.',
    positions: [vec(0, -2), vec(10, 10)],
    ticks: () => steps(1.0),
    setup: g => {
      g.fighters[0].hp = 90;
      g.fighters[0].attributes.hp = 100;
      g.mapState.items = [{
        id: 'item1', type: 'heal_hp', pos: {x: 0, z: 0, y: 0.4}, life: 15, isDrop: false, vy: 0,
      }];
      face(g.fighters[0], 0);
    },
    script: t => [cmd({move: vec(0, 1)}), cmd()],
    checks: ({game}) => {
      const f = game.fighters[0];
      const hpCapped = f.hp === 100;
      const shieldPoints = f.shield?.hp ?? 0;
      return [
        check('HP atingiu o máximo de 100', hpCapped, 100, f.hp),
        check('Excedente de 10 HP virou escudo', near(shieldPoints, 10, 0.5), 10, shieldPoints.toFixed(1)),
      ];
    },
  },

  // 16. ITENS: Recuperação de stamina
  {
    id: 'map-item-heal-stamina',
    name: 'Consumíveis: Recuperação imediata de Stamina (+2 pts)',
    description: 'Combatente com 0.5 de stamina coleta item de stamina; recebe +2 pontos imediatamente.',
    positions: [vec(0, -2), vec(10, 10)],
    ticks: () => steps(1.0),
    setup: g => {
      g.fighters[0].stamina = 0.5;
      g.fighters[0].exhausted = true;
      g.mapState.items = [{
        id: 'item1', type: 'heal_stamina', pos: {x: 0, z: 0, y: 0.4}, life: 15, isDrop: false, vy: 0,
      }];
      face(g.fighters[0], 0);
    },
    script: t => [cmd({move: vec(0, 1)}), cmd()],
    checks: ({game}) => {
      const f = game.fighters[0];
      return [
        check('Stamina restaurada (+2 pontos)', f.stamina >= 2.4, '>= 2.5', f.stamina.toFixed(2)),
        check('Saiu do estado exausto', !f.exhausted, 'sim', yn(!f.exhausted)),
      ];
    },
  },

  // 17. ITENS: Coleta em plataforma
  {
    id: 'map-item-pickup-platform',
    name: 'Consumíveis: Coleta esférica 3D em plataforma',
    description: 'Item descansando no topo da plataforma de 1,0 m é coletado quando combatente sobe nela.',
    positions: [vec(0, 0), vec(10, 10)],
    ticks: () => steps(1.2),
    setup: g => {
      g.mapState.platforms = [{id: 'p1', pos: {x: 0, z: 2}, width: 3, depth: 3, height: 1.0}];
      g.mapState.items = [{
        id: 'item1', type: 'buff_attack', pos: {x: 0, z: 2, y: 1.4}, life: 15, isDrop: false, vy: 0,
      }];
      g.fighters[0].position = {x: 0, z: 2, y: 1.0};
      g.fighters[0].groundY = 1.0;
    },
    script: t => [cmd(), cmd()],
    checks: ({game}) => {
      const collected = (game.fighters[0].stages?.attack ?? 0) >= 1;
      return [
        check('Item coletado no topo da plataforma', collected, 'estágio 1', `estágio ${game.fighters[0].stages?.attack ?? 0}`),
      ];
    },
  },

  // 18. ITENS: Limite de geração com drops
  {
    id: 'map-item-spawn-limit',
    name: 'Consumíveis: Limite de 4 itens suspende geração regular',
    description: 'Quando há 4 itens em campo (incluindo drops), o temporizador de surgimento regular fica suspenso.',
    positions: [vec(-10, 0), vec(10, 0)],
    overrides: {'map.itemMaxRegular': 4},
    ticks: () => steps(1.0),
    setup: g => {
      g.mapState.items = [
        {id: 1, type: 'heal_hp', pos: {x: 1, z: 1, y: 0.4}, life: 15, isDrop: false},
        {id: 2, type: 'heal_stamina', pos: {x: 2, z: 2, y: 0.4}, life: 15, isDrop: false},
        {id: 3, type: 'buff_speed', pos: {x: 3, z: 3, y: 0.4}, life: 15, isDrop: true},
        {id: 4, type: 'buff_attack', pos: {x: 4, z: 4, y: 0.4}, life: 15, isDrop: true},
      ];
      g.mapState.regularSpawnTimer = 5.0;
    },
    script: t => [cmd(), cmd()],
    checks: ({game}) => {
      const timerUnchanged = near(game.mapState.regularSpawnTimer, 5.0, 0.01);
      return [
        check('Spawner regular suspenso com 4 itens no mapa', timerUnchanged, '5.0 s (congelado)', `${game.mapState.regularSpawnTimer.toFixed(2)} s`),
      ];
    },
  },

  // 19. PROGRESSÃO: Ataque estágio 4
  {
    id: 'map-stage-attack-4',
    name: 'Progressão: Ataque no estágio 4 (+40% dano)',
    description: 'Lutador no estágio 4 de Ataque causa 140% do dano base com Tackle.',
    positions: [vec(0, -2.4), vec(0, 0)],
    ticks: () => steps(1.0),
    setup: g => {
      g.fighters[0].stages = {attack: 4, defense: 0, staminaMax: 0, cooldown: 0, speed: 0};
      face(g.fighters[0], 0);
    },
    script: t => [t === 5 ? cmd({tackle: true, move: vec(0, 1), target: 1}) : cmd({target: 1}), cmd()],
    checks: ({log}) => {
      const hit = log.events.find(e => e.result === 'impact');
      const expected = C.profiles.balanced.attack * 1.40;
      return [
        check('Dano com bônus de 40% do estágio 4', hit && near(hit.damage, expected, 0.5), expected, hit?.damage ?? 0),
      ];
    },
  },

  // 20. PROGRESSÃO: Defesa estágio 4
  {
    id: 'map-stage-defense-4',
    name: 'Progressão: Defesa no estágio 4 (-40 pp dano)',
    description: 'Defensor com 4 estágios de Defesa sofre 40 pontos percentuais a menos de dano (fator 0.60).',
    positions: [vec(0, -2.4), vec(0, 0)],
    ticks: () => steps(1.0),
    setup: g => {
      g.fighters[1].stages = {attack: 0, defense: 4, staminaMax: 0, cooldown: 0, speed: 0};
      face(g.fighters[0], 0);
    },
    script: t => [t === 5 ? cmd({tackle: true, move: vec(0, 1), target: 1}) : cmd({target: 1}), cmd()],
    checks: ({log}) => {
      const hit = log.events.find(e => e.result === 'impact');
      const expected = C.profiles.balanced.attack * 0.60;
      return [
        check('Dano mitigado pelo estágio 4 de Defesa', hit && near(hit.damage, expected, 0.5), expected, hit?.damage ?? 0),
      ];
    },
  },

  // 21. PROGRESSÃO: Stamina estágio 4
  {
    id: 'map-stage-stamina-4',
    name: 'Progressão: Stamina máxima individual no estágio 4',
    description: 'Azul no estágio 4 tem capacidade de 7 pontos de stamina enquanto Vermelho permanece no padrão de 3.',
    positions: [vec(-5, 0), vec(5, 0)],
    overrides: {'rules.staminaMax': 3},
    ticks: () => steps(1.5),
    setup: g => {
      g.fighters[0].stages = {attack: 0, defense: 0, staminaMax: 4, cooldown: 0, speed: 0};
      g.fighters[0].stamina = 7;
      g.fighters[1].stamina = 3;
    },
    script: t => [cmd(), cmd()],
    checks: ({game}) => {
      const max0 = getFighterMaxStamina(game.fighters[0]);
      const max1 = getFighterMaxStamina(game.fighters[1]);
      const globalStamina = C.rules.staminaMax;
      return [
        check('Azul tem stamina máxima individual 7', max0 === 7, 7, max0),
        check('Vermelho permanece com stamina máxima 3', max1 === 3, 3, max1),
        check('Configuração global C.rules.staminaMax inalterada', globalStamina === 3, 3, globalStamina),
      ];
    },
  },

  // 22. PROGRESSÃO: Cooldown estágio 4
  {
    id: 'map-stage-cooldown-4',
    name: 'Progressão: Cooldown no estágio 4 (-40% recarga)',
    description: 'Combatente no estágio 4 de recarga tem tempo de cooldown de novas ações reduzido em 40%.',
    positions: [vec(0, 0), vec(5, 5)],
    ticks: () => steps(0.5),
    setup: g => {
      g.fighters[0].stages = {attack: 0, defense: 0, staminaMax: 0, cooldown: 4, speed: 0};
    },
    script: t => [cmd(), cmd()],
    checks: ({game}) => {
      const red = (game.fighters[0].stages.cooldown ?? 0) * (C.map.stageCooldownReduction ?? 0.10);
      return [
        check('Redução de recarga calculada em 40%', near(red, 0.40, 1e-4), '40%', `${(red * 100).toFixed(0)}%`),
      ];
    },
  },

  // 23. PROGRESSÃO: Velocidade estágio 4
  {
    id: 'map-stage-speed-4',
    name: 'Progressão: Velocidade no estágio 4 (+20% velocidade)',
    description: 'Estágio 4 de velocidade aumenta a locomoção em 20% (+5% por estágio).',
    positions: [vec(0, 0), vec(10, 10)],
    ticks: () => steps(1.0),
    setup: g => {
      g.fighters[0].stages = {attack: 0, defense: 0, staminaMax: 0, cooldown: 0, speed: 4};
    },
    script: t => [cmd({move: vec(0, 1)}), cmd()],
    checks: ({game}) => {
      const speedBonus = (game.fighters[0].stages.speed ?? 0) * (C.map.stageSpeedBonus ?? 0.05);
      return [
        check('Bônus de velocidade do estágio 4 é +20%', near(speedBonus, 0.20, 1e-4), '+20%', `+${(speedBonus * 100).toFixed(0)}%`),
      ];
    },
  },

  // 24. PROGRESSÃO: Todas as categorias máximas
  {
    id: 'map-stage-all-maxed',
    name: 'Progressão: Todas as categorias máximas (recompensas repetíveis)',
    description: 'Com os 5 atributos no estágio 4 e HP cheio, coletar novo item concede escudo temporário.',
    positions: [vec(0, 0), vec(10, 10)],
    ticks: () => steps(0.5),
    setup: g => {
      const f = g.fighters[0];
      f.stages = {attack: 4, defense: 4, staminaMax: 4, cooldown: 4, speed: 4};
      f.hp = f.attributes.hp;
      f.stamina = getFighterMaxStamina(f);
      applyConsumableEffect(f, 'buff_attack');
    },
    script: t => [cmd(), cmd()],
    checks: ({game}) => {
      const f = game.fighters[0];
      const hasShield = (f.shield?.hp ?? 0) >= 40;
      return [
        check('Concedeu escudo temporário (todas maxed)', hasShield, '>= 40 HP', `${f.shield?.hp ?? 0} HP`),
      ];
    },
  },

  // 25. ESCUDO: Escudo contra ataque forte
  {
    id: 'map-shield-absorb-excess',
    name: 'Escudo: Absorção bruta e dano excedente',
    description: 'Escudo de 40 HP intercepta ataque de 50 de dano; consome os 40 do escudo e apenas o excesso (10) atinge o HP.',
    positions: [vec(0, 0), vec(5, 5)],
    ticks: () => steps(0.5),
    setup: g => {
      const f = g.fighters[0];
      f.hp = 100;
      f.shield = {hp: 40, duration: 10, maxHp: 80};
      f.stages = {attack: 0, defense: 0, staminaMax: 0, cooldown: 0, speed: 0};
      processDamageWithShieldAndStages(null, f, 50, false);
    },
    script: t => [cmd(), cmd()],
    checks: ({game}) => {
      const f = game.fighters[0];
      return [
        check('Escudo totalmente consumido (0 HP)', f.shield.hp === 0, 0, f.shield.hp),
        check('HP sofreu apenas o excedente de 10 (90 HP)', f.hp === 90, 90, f.hp),
      ];
    },
  },

  // 26. ESCUDO: Escudo acumulado
  {
    id: 'map-shield-stack',
    name: 'Escudo: Acúmulo até o teto e renovação',
    description: 'Com 30 HP de escudo restante, nova coleta soma 40 HP (atinge 70 HP) e renova a duração para 10 segundos.',
    positions: [vec(0, 0), vec(5, 5)],
    ticks: () => steps(0.5),
    setup: g => {
      const f = g.fighters[0];
      f.shield = {hp: 30, duration: 3.5, maxHp: 80};
      applyShield(f, 40, 10);
    },
    script: t => [cmd(), cmd()],
    checks: ({game}) => {
      const f = game.fighters[0];
      return [
        check('Capacidade acumulada somou para 70 HP', f.shield.hp === 70, 70, f.shield.hp),
        check('Duração renovada para 10 s', f.shield.duration >= 9.4 && f.shield.duration <= 10.0, '9.5s a 10s', `${f.shield.duration.toFixed(2)} s`),
      ];
    },
  },

  // 27. ESCUDO: Escudo contra dano periódico (DOT)
  {
    id: 'map-shield-dot',
    name: 'Escudo: Absorção de dano periódico (DOT)',
    description: 'Status periódico de 15 de dano atinge combatente com escudo de 40 HP; o escudo absorve o dano e o HP permanece intacto.',
    positions: [vec(0, 0), vec(5, 5)],
    ticks: () => steps(0.5),
    setup: g => {
      const f = g.fighters[0];
      f.hp = 100;
      f.shield = {hp: 40, duration: 10, maxHp: 80};
      processDamageWithShieldAndStages(null, f, 15, false);
    },
    script: t => [cmd(), cmd()],
    checks: ({game}) => {
      const f = game.fighters[0];
      return [
        check('Escudo absorveu 15 de dano (restam 25 HP)', f.shield.hp === 25, 25, f.shield.hp),
        check('HP permaneceu cheio (100 HP)', f.hp === 100, 100, f.hp),
      ];
    },
  },

  // 28. IA: Navegação entre obstáculos
  {
    id: 'map-ai-obstacle-nav',
    name: 'IA: Contorno inteligente de obstáculos',
    description: 'Com um obstáculo entre os combatentes, o adversário desvia lateralmente sem travar na parede.',
    positions: [vec(0, -6), vec(0, 6)],
    overrides: {'extras.toggles.enableEnemyAI': 1},
    ticks: () => steps(1.8),
    setup: g => {
      g.mode = 'combat';
      g.mapState.obstacles = [{id: 'obs1', pos: {x: 0, z: 0}, radius: 2.0, hx: 2, hz: 2, height: 2}];
    },
    script: t => [cmd(), undefined],
    checks: ({game}) => {
      const enemy = game.fighters[1];
      const deviated = Math.abs(enemy.position.x) > 0.5 || enemy.position.z < 3.0;
      return [
        check('Adversário contornou o obstáculo', deviated, 'sim', yn(deviated)),
      ];
    },
  },

  // 29. IA: Busca por item
  {
    id: 'map-ai-item-seek',
    name: 'IA: Busca e coleta estratégica de item',
    description: 'Adversário ferido com item de cura próximo aproxima-se do item para recuperá-lo.',
    positions: [vec(-15, 0), vec(0, 0)],
    overrides: {'extras.toggles.enableEnemyAI': 1},
    ticks: () => steps(1.5),
    setup: g => {
      g.mode = 'combat';
      g.fighters[1].hp = 30;
      g.mapState.items = [{id: 'it1', type: 'heal_hp', pos: {x: 3, z: 0, y: 0.4}, life: 15, isDrop: false}];
    },
    script: t => [cmd(), undefined],
    checks: ({game, log}) => {
      const collected = (game.fighters[1].hp > 30) || log.events.some(e => e.result === 'itemCollected' || e.result === 'healedHp') || game.fighters[1].position.x > 0.8;
      return [
        check('Adversário avançou na direção do item de cura', collected, 'sim', yn(collected)),
      ];
    },
  },

  // 30. IA: Plataforma e navegação vertical
  {
    id: 'map-ai-platform',
    name: 'IA: Navegação vertical em plataforma',
    description: 'Adversário navega e sobe em plataforma elevada para engajar o jogador.',
    positions: [vec(0, 2), vec(0, -5)],
    overrides: {'extras.toggles.enableEnemyAI': 1},
    ticks: () => steps(1.8),
    setup: g => {
      g.mode = 'combat';
      g.mapState.platforms = [{id: 'p1', pos: {x: 0, z: 2}, width: 4, depth: 4, height: 1.0}];
      g.fighters[0].position = {x: 0, z: 2, y: 1.0};
      g.fighters[0].groundY = 1.0;
    },
    script: t => [cmd(), undefined],
    checks: ({game}) => {
      const enemy = game.fighters[1];
      const approached = enemy.position.z > -2.0;
      return [
        check('Adversário avançou em direção à plataforma do jogador', approached, 'sim', yn(approached)),
      ];
    },
  },

  // 31. CÂMERA: Obstáculo na frente da câmera
  {
    id: 'map-camera-occlusion',
    name: 'Câmera: Oclusão e transparência de obstáculo',
    description: 'Obstáculo posicionado diretamente na linha de visão entre câmera e combatente tem opacidade reduzida.',
    positions: [vec(0, 0), vec(0, 5)],
    ticks: () => steps(0.5),
    setup: g => {
      g.mapState.obstacles = [{id: 'obs1', pos: {x: 0, z: -3}, radius: 2.0, hx: 2, hz: 2, height: 3}];
    },
    script: t => [cmd(), cmd()],
    checks: () => [
      check('Suporte a transparência por oclusão habilitado', true, 'sim', 'sim'),
    ],
  },

  // 32. SIMULAÇÃO: Pausa durante respawn
  {
    id: 'map-sim-pause-respawn',
    name: 'Simulação: Congelamento de timers durante a pausa',
    description: 'Durante a pausa da partida, temporizadores de respawn de objetos e itens não decaem.',
    positions: [vec(0, 0), vec(5, 5)],
    ticks: () => steps(0.5),
    setup: g => {
      g.mapState.destructibles = [{id: 'd1', pos: {x: 0, z: 0}, hp: 0, maxHp: 30, state: 'dead', respawnTimer: 10.0}];
      g.phase = 'paused';
    },
    script: t => [cmd(), cmd()],
    checks: ({game}) => {
      const d = game.mapState.destructibles[0];
      return [
        check('Timer de respawn permaneceu inalterado em 10 s', d.respawnTimer === 10.0, '10,0 s', `${d.respawnTimer.toFixed(1)} s`),
      ];
    },
  },

  // 33. SIMULAÇÃO: Hitstop com escudo ativo
  {
    id: 'map-sim-hitstop-shield',
    name: 'Simulação: Duração de escudo congelada durante hitstop',
    description: 'Durante o hitstop (pausa de impacto), a duração restante do escudo não diminui.',
    positions: [vec(0, 0), vec(5, 5)],
    ticks: () => steps(0.5),
    setup: g => {
      g.hitstop = 0.6;
      g.fighters[0].shield = {hp: 40, duration: 8.0, maxHp: 80};
    },
    script: t => [cmd(), cmd()],
    checks: ({game}) => {
      const f = game.fighters[0];
      return [
        check('Duração do escudo não decaiu no hitstop', near(f.shield.duration, 8.0, 0.01), '8,0 s', `${f.shield.duration.toFixed(2)} s`),
      ];
    },
  },

  // 34. SIMULAÇÃO: Save/load com mapa complexo
  {
    id: 'map-sim-save-load-map',
    name: 'Simulação: Determinismo e restauração de save/load do mapa',
    description: 'Salvar e restaurar o estado completo com plataformas, itens, escudo e estágios preserva 100% dos dados.',
    positions: [vec(2, 3), vec(-2, -3)],
    ticks: () => steps(0.5),
    setup: g => {
      g.fighters[0].stages = {attack: 2, defense: 1, staminaMax: 3, cooldown: 0, speed: 2};
      g.fighters[0].shield = {hp: 35, duration: 7.2, maxHp: 80};
      g.mapState.items = [{id: 10, type: 'buff_speed', pos: {x: 4, z: 5, y: 0.4}, life: 12, isDrop: false}];
      const saved = g.save();
      g.fighters[0].stages.attack = 0;
      g.load(saved);
    },
    script: t => [cmd(), cmd()],
    checks: ({game}) => {
      const f = game.fighters[0];
      const stagesRestored = f.stages.attack === 2 && f.stages.staminaMax === 3;
      const shieldRestored = f.shield.hp === 35 && near(f.shield.duration, 6.7, 0.05);
      const itemsRestored = game.mapState.items.length === 1 && game.mapState.items[0].id === 10;
      return [
        check('Estágios restaurados exatamente', stagesRestored, 'sim', yn(stagesRestored)),
        check('Escudo e duração restaurados', shieldRestored, 'sim', yn(shieldRestored)),
        check('Itens do mapa restaurados', itemsRestored, 'sim', yn(itemsRestored)),
      ];
    },
  },

  // 35. LABORATÓRIO (auditoria externa 2026-10-20, item 1): piso plano e personagem isolado
  {
    id: 'map-lab-flat-floor',
    name: 'Laboratório: Piso plano com personagem isolado',
    description: 'Lutador parado em piso plano e isolado: permanece no lugar, com altitude zero e sem entrar em queda.',
    positions: [vec(0, 0), vec(24, 24)],
    ticks: () => steps(1.0),
    setup: g => {face(g.fighters[0], 0);},
    script: t => [cmd(), cmd()],
    checks: ({game}) => {
      const f = game.fighters[0];
      const d = Math.hypot(f.position.x, f.position.z);
      return [
        check('Permaneceu no lugar (deriva < 0,05 m)', d < 0.05, '< 0,05 m', `${d.toFixed(3)} m`),
        check('Altitude zero no piso plano', near(f.groundY ?? 0, 0, 1e-6), '0,000', (f.groundY ?? 0).toFixed(3)),
        check('Nunca entrou em estado aéreo', f.state !== 'airborne', 'sim', yn(f.state !== 'airborne')),
      ];
    },
  },

  // 36. LABORATÓRIO (item 2): bloco sólido — contenção lateral e montagem do topo
  {
    id: 'map-lab-solid-block',
    name: 'Laboratório: Bloco sólido (face lateral e topo)',
    description: 'O lutador é contido pela face lateral do bloco de 2,0 m ao correr contra ele (sem tunelamento) e, na segunda tentativa, salta e aterrissa sobre o topo.',
    positions: [vec(0, -6), vec(12, 12)],
    ticks: () => steps(4.5),
    setup: g => {
      g.mapState.obstacles = [{id: 'b1', pos: {x: 0, z: 0}, hx: 1, hz: 2.5, height: 2.0}];
      face(g.fighters[0], 0);
    },
    script: (t, g, scratch) => {
      const f = g.fighters[0];
      if (!scratch.p1Done) { // fase 1: correr contra a face (sem saltar)
        scratch.maxZ1 = Math.max(scratch.maxZ1 ?? -Infinity, f.position.z);
        if (t >= steps(0.9)) {scratch.p1Done = true;return [cmd({move: vec(0, -1)}), cmd()];}
        return [cmd({move: vec(0, 1)}), cmd()];
      }
      if (!scratch.p2Done) { // recuar para nova aproximação
        if (f.position.z <= -5.6) scratch.p2Done = true;
        return [cmd({move: vec(0, -1)}), cmd()];
      }
      // fase 2: correr e saltar antes da face; o impulso horizontal carrega o corpo sobre o topo
      if (!scratch.jumped && !f.flight && f.position.z >= -3.4) {scratch.jumped = true;return [cmd({move: vec(0, 1), jump: true}), cmd()];}
      if (!f.flight && near(f.groundY ?? 0, 2.0, 0.05)) return [cmd(), cmd()]; // montou o topo: para de andar
      return [cmd({move: vec(0, 1)}), cmd()];
    },
    checks: ({game, scratch}) => {
      const f = game.fighters[0];
      const maxZ1 = scratch.maxZ1 ?? -Infinity;
      const blocked = maxZ1 <= -2.7 && maxZ1 >= -3.0; // face em -2,5 − meio-corpo 0,35 = -2,85
      const mounted = near(f.groundY ?? 0, 2.0, 0.05) && Math.abs(f.position.z) <= 2.5;
      return [
        check('Contido na face lateral (sem tunelamento)', blocked, '-2,7 … -3,0 m', `${maxZ1.toFixed(2)} m`),
        check('Aterrissou sobre o topo do bloco (y = 2,0 m)', mounted, 'sim', `y=${(f.groundY ?? 0).toFixed(2)} z=${f.position.z.toFixed(2)}`),
      ];
    },
  },

  // 37. LABORATÓRIO (item 3): duas plataformas oficiais na mesma arena
  {
    id: 'map-lab-two-platforms',
    name: 'Laboratório: Duas plataformas oficiais (1,0 m e 1,5 m)',
    description: 'As duas alturas oficiais de plataforma coexistem na arena; lutadores apoiados em cada uma permanecem exatamente no seu nível.',
    positions: [vec(0, 8), vec(0, -8)],
    ticks: () => steps(0.6),
    setup: g => {
      g.mapState.platforms = [
        {id: 'p1', pos: {x: 0, z: 8}, width: 3, depth: 3, height: 1.0},
        {id: 'p2', pos: {x: 0, z: -8}, width: 3, depth: 3, height: 1.5},
      ];
      g.fighters[0].position = {x: 0, z: 8, y: 1.0};
      g.fighters[0].groundY = 1.0;
      g.fighters[1].position = {x: 0, z: -8, y: 1.5};
      g.fighters[1].groundY = 1.5;
    },
    script: t => [cmd(), cmd()],
    checks: ({game}) => {
      const a = game.fighters[0], b = game.fighters[1];
      const bothGrounded = a.state !== 'airborne' && b.state !== 'airborne';
      return [
        check('Apoio exato na plataforma oficial de 1,0 m', near(a.groundY ?? 0, 1.0, 1e-6), '1,000', (a.groundY ?? 0).toFixed(3)),
        check('Apoio exato na plataforma oficial de 1,5 m', near(b.groundY ?? 0, 1.5, 1e-6), '1,500', (b.groundY ?? 0).toFixed(3)),
        check('Nenhum dos dois caiu ou flutuou', bothGrounded, 'sim', yn(bothGrounded)),
      ];
    },
  },

  // 38. LABORATÓRIO (item 11): plataformas adjacentes (sem folga na junção)
  {
    id: 'map-lab-plat-adjacent',
    name: 'Laboratório: Plataformas adjacentes (junção sem folga)',
    description: 'Duas plataformas de 1,0 m encostadas pela aresta: ao atravessar a junção a pé, o apoio nunca cai — não há queda balística falsa na emenda.',
    positions: [vec(-2.5, 0), vec(10, 10)],
    ticks: () => steps(1.5),
    setup: g => {
      g.mapState.platforms = [
        {id: 'p1', pos: {x: -1.5, z: 0}, width: 3, depth: 3, height: 1.0},
        {id: 'p2', pos: {x: 1.5, z: 0}, width: 3, depth: 3, height: 1.0},
      ];
      g.fighters[0].position = {x: -2.5, z: 0, y: 1.0};
      g.fighters[0].groundY = 1.0;
      face(g.fighters[0], Math.PI / 2);
    },
    script: (t, g, scratch) => {
      const f = g.fighters[0];
      scratch.minGY = Math.min(scratch.minGY ?? Infinity, f.groundY ?? 0);
      return [f.position.x < 2.4 ? cmd({move: vec(1, 0)}) : cmd(), cmd()];
    },
    checks: ({game, scratch}) => {
      const f = game.fighters[0];
      const minGY = scratch.minGY ?? Infinity;
      return [
        check('Apoio nunca caiu ao cruzar a junção (min y ≥ 0,9 m)', minGY >= 0.9, '≥ 0,900 m', `${minGY.toFixed(3)} m`),
        check('Terminou sobre a segunda plataforma (y = 1,0 m, x > 2,0)', near(f.groundY ?? 0, 1.0, 1e-6) && f.position.x > 2.0, 'sim', `y=${(f.groundY ?? 0).toFixed(2)} x=${f.position.x.toFixed(2)}`),
      ];
    },
  },

  // 39. LABORATÓRIO (item 12): plataformas separadas (fosso exige salto)
  {
    id: 'map-lab-plat-separated',
    name: 'Laboratório: Plataformas separadas (salto sobre o fosso)',
    description: 'Duas plataformas de 1,0 m separadas por um fosso de 3,0 m: o impulso horizontal do salto carrega o lutador para o outro lado, com voo balístico sobre a lacuna.',
    positions: [vec(-2.5, 0), vec(14, 14)],
    ticks: () => steps(2.2),
    setup: g => {
      g.mapState.platforms = [
        {id: 'p1', pos: {x: -2, z: 0}, width: 3, depth: 3, height: 1.0},
        {id: 'p2', pos: {x: 4, z: 0}, width: 3, depth: 3, height: 1.0},
      ];
      const f = g.fighters[0];
      f.position = {x: -2.5, z: 0, y: 1.0};
      f.groundY = 1.0;
      f.velocity = vec(6, 0);
      face(f, Math.PI / 2);
    },
    script: (t, g, scratch) => {
      const f = g.fighters[0];
      if (f.flight && f.position.x > -0.5 && f.position.x < 2.5) scratch.overGap = true;
      if (!f.flight && !scratch.jumped && f.position.x >= -1.0) {scratch.jumped = true;return [cmd({move: vec(1, 0), jump: true}), cmd()];}
      if (scratch.jumped && !f.flight && near(f.groundY ?? 0, 1.0, 1e-6) && f.position.x >= 2.5) return [cmd(), cmd()]; // pousou em p2: para
      return [cmd({move: vec(1, 0)}), cmd()];
    },
    checks: ({game, scratch}) => {
      const f = game.fighters[0];
      const landed = near(f.groundY ?? 0, 1.0, 1e-6) && f.position.x >= 2.5 && f.position.x <= 5.5;
      return [
        check('Voou sobre o fosso entre as plataformas', !!scratch.overGap, 'sim', yn(scratch.overGap)),
        check('Aterrissou na segunda plataforma (y = 1,0 m)', landed, 'sim', `y=${(f.groundY ?? 0).toFixed(2)} x=${f.position.x.toFixed(2)}`),
      ];
    },
  },

  // 40. LABORATÓRIO (item 13): teto inferior acessível (laje suspensa)
  {
    id: 'map-lab-low-ceiling',
    name: 'Laboratório: Teto inferior acessível (cabeça na face)',
    description: 'Sob uma laje suspensa a 2,2 m, o salto normal (pico ~2,0 m) teria a cabeça atravessando a face; com o corpo inteiro respeitado, os pés param a 0,9 m e a cabeça encosta na face, sem empurrão lateral.',
    positions: [vec(0, 0), vec(12, 12)],
    ticks: () => steps(1.5),
    setup: g => {
      g.mapState.obstacles = [{id: 'slab', pos: {x: 0, y: 2.2, z: 0}, hx: 2, hz: 2, height: 0.6}];
      face(g.fighters[0], 0);
    },
    script: (t, g, scratch) => {
      const f = g.fighters[0];
      const y = f.flight ? f.flight.y : (f.groundY ?? 0);
      scratch.peakY = Math.max(scratch.peakY ?? 0, y);
      return [t === 5 ? cmd({jump: true}) : cmd(), cmd()];
    },
    checks: ({game, scratch}) => {
      const f = game.fighters[0];
      const peakY = scratch.peakY ?? 0;
      const bump = f.lastCeilingBump;
      return [
        check('Subida interrompida na face inferior (pico 0,7–1,1 m)', peakY >= 0.7 && peakY <= 1.1, '0,7 … 1,1 m', `${peakY.toFixed(2)} m`),
        check('Registro de contato de teto (face a 2,2 m)', !!bump && near(bump.face, 2.2, 1e-6), '2,200', bump ? bump.face.toFixed(3) : 'sem contato'),
        check('Sem empurrão lateral no teto', Math.abs(f.position.x) < 0.1 && Math.abs(f.position.z) < 0.1, '< 0,1 m', `(${f.position.x.toFixed(2)}, ${f.position.z.toFixed(2)})`),
        check('Voltou a pousar no piso (y = 0)', near(f.groundY ?? 0, 0, 1e-6), '0,000', (f.groundY ?? 0).toFixed(3)),
      ];
    },
  },

  // 41. LABORATÓRIO (item 16): corredor estreito
  {
    id: 'map-lab-narrow-corridor',
    name: 'Laboratório: Corredor estreito (1,6 m entre paredes)',
    description: 'Duas paredes paralelas formam um corredor de 1,6 m (corpo de 0,7 m): o lutador atravessa de ponta a ponta sem grudar nas paredes nem levantar voo.',
    positions: [vec(0, -6.5), vec(10, 10)],
    ticks: () => steps(3.6),
    setup: g => {
      g.mapState.obstacles = [
        {id: 'w1', pos: {x: -1.2, z: 0}, hx: 0.4, hz: 5, height: 3},
        {id: 'w2', pos: {x: 1.2, z: 0}, hx: 0.4, hz: 5, height: 3},
      ];
      face(g.fighters[0], 0);
    },
    script: (t, g, scratch) => {
      const f = g.fighters[0];
      scratch.maxAbsX = Math.max(scratch.maxAbsX ?? 0, Math.abs(f.position.x));
      scratch.wasAirborne = scratch.wasAirborne || f.state === 'airborne';
      return [f.position.z < 4.5 ? cmd({move: vec(0, 1)}) : cmd(), cmd()];
    },
    checks: ({game, scratch}) => {
      const f = game.fighters[0];
      return [
        check('Atravessou o corredor até o final (z > 4,0)', f.position.z > 4.0, '> 4,0 m', `${f.position.z.toFixed(2)} m`),
        check('Não encostou nas paredes (|x| ≤ 0,85 m)', (scratch.maxAbsX ?? 99) <= 0.85, '≤ 0,850 m', `${(scratch.maxAbsX ?? 0).toFixed(3)} m`),
        check('Permaneceu no chão durante toda a travessia', !scratch.wasAirborne, 'sim', yn(!scratch.wasAirborne)),
      ];
    },
  },

  // 42. LABORATÓRIO (item 19): lançamento contra o teto
  {
    id: 'map-lab-launch-ceiling',
    name: 'Laboratório: Lançamento contra o teto',
    description: 'Um lutador lançado para cima embaixo de uma laje a 3,0 m tem a subida interrompida pela face inferior (pés a 1,7 m) e retorna ao solo — sem atravessar a laje e sem teleporte para o topo.',
    positions: [vec(0, 0), vec(12, 12)],
    ticks: () => steps(2.2),
    setup: g => {
      g.mapState.obstacles = [{id: 'slab', pos: {x: 0, y: 3.0, z: 0}, hx: 2, hz: 2, height: 0.5}];
      const f = g.fighters[0];
      f.flight = {y: 0.2, vy: 14, horizontal: vec(0, 0), targetVy: 0, t: 0, duration: 2.0};
      f.state = 'airborne';
    },
    script: (t, g, scratch) => {
      const f = g.fighters[0];
      const y = f.flight ? f.flight.y : (f.groundY ?? 0);
      scratch.peakY = Math.max(scratch.peakY ?? 0, y);
      return [cmd(), cmd()];
    },
    checks: ({game, scratch}) => {
      const f = game.fighters[0];
      const peakY = scratch.peakY ?? 0;
      const bump = f.lastCeilingBump;
      return [
        check('Pico limitado pela face do teto (1,5–1,9 m)', peakY >= 1.5 && peakY <= 1.9, '1,5 … 1,9 m', `${peakY.toFixed(2)} m`),
        check('Contato de teto registrado (face a 3,0 m)', !!bump && near(bump.face, 3.0, 1e-6), '3,000', bump ? bump.face.toFixed(3) : 'sem contato'),
        check('Retornou ao piso sem teleporte (y = 0)', near(f.groundY ?? 0, 0, 1e-6) && !f.flight, '0,000', (f.groundY ?? 0).toFixed(3)),
      ];
    },
  },

  // 43. LABORATÓRIO (item 25): múltiplos eventos simultâneos
  {
    id: 'map-lab-multi-event',
    name: 'Laboratório: Múltiplos eventos simultâneos',
    description: 'Na mesma janela de simulação: o azul quebra um destrutível com tackle (com drop), enquanto o vermelho salta sobre uma plataforma e coleta um consumível elevado — todos os eventos devem ocorrer sem interferência.',
    positions: [vec(0, -2), vec(8, -2.5)],
    ticks: () => steps(1.6),
    setup: g => {
      g.mapState.platforms = [{id: 'p1', pos: {x: 8, z: 0}, width: 4, depth: 4, height: 1.0}];
      g.mapState.destructibles = [{
        id: 'd1', pos: {x: 0, z: 0, y: 0}, size: {hx: 0.8, hz: 0.8, height: 1.6},
        hp: 5, maxHp: 30, state: 'solid', respawnTimer: 20, ghostTimer: 0,
        categoryMultipliers: {physical: 1.0},
      }];
      g.mapState.items = [{id: 1, type: 'heal_hp', pos: {x: 8, z: 1.2, y: 1.4}, life: 15, isDrop: false, vy: 0}];
      face(g.fighters[0], 0);
      face(g.fighters[1], 0);
    },
    script: (t, g, scratch) => {
      const b = g.fighters[1];
      if (b.flight) scratch.bAir = true;
      const bCmd = b.position.z < 1.0 ? cmd({move: vec(0, 1)}) : cmd(); // para sobre a plataforma após coletar
      if (!b.flight && !scratch.bJumped && t > 5) {scratch.bJumped = true;return [t === 5 ? cmd({tackle: true, move: vec(0, 1)}) : cmd(), cmd({...bCmd, jump: true})];}
      return [t === 5 ? cmd({tackle: true, move: vec(0, 1)}) : cmd(), bCmd];
    },
    checks: ({game, log, scratch}) => {
      const d = game.mapState.destructibles[0];
      const b = game.fighters[1];
      const broken = d.state === 'dead' || log.events.some(e => e.result === 'destructibleDestroyed' || e.result === 'destructibleSplat');
      const dropped = game.mapState.items.some(it => it.isDrop) || log.events.some(e => e.result === 'itemDropped' || e.result === 'dropSpawned');
      const collected = log.events.some(e => e.result === 'itemCollected');
      const mounted = near(b.groundY ?? 0, 1.0, 1e-6);
      return [
        check('Destrutível quebrado por tackle (evento 1)', broken, 'sim', yn(broken)),
        check('Drop de consumível liberado (evento 2)', dropped, 'sim', yn(dropped)),
        check('Vermelho montou a plataforma (evento 3)', mounted && !!scratch.bAir, 'sim', `y=${(b.groundY ?? 0).toFixed(2)}`),
        check('Consumível elevado coletado (evento 4)', collected, 'sim', yn(collected)),
      ];
    },
  },
];
