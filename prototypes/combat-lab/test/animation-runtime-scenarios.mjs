// Cenários de GAMEPLAY real para a matriz de animações: cada um conduz a simulação com comandos de jogador/IA (nada de definir estado na mão)
// e devolve a partida com o registro do que os dois Characters tocaram. Um cenário por condição de gameplay.
import {makeMatch, cmd, vec, C} from './animation-runtime-harness.mjs';

const lock = {target: 1, locked: true}, lockB = {target: 0, locked: true};
const P = (slot = 0) => ({skill: slot, skillHeld: [0, 1, 2, 3].map(i => i === slot)});
const dirs = {fwd: vec(0, 1), back: vec(0, -1), left: vec(-1, 0), right: vec(1, 0)};

/** Lista de cenários {name, build(): partida já executada}. */
export const SCENARIOS = [];
const sc = (name, fn, opts) => SCENARIOS.push({name, build(extra = {}) {const m = makeMatch({...opts, ...extra});m.scenario = name;fn(m);return m;}});

// ---------- locomoção ----------
sc('locomoção: parado, girar, andar nas 4 direções', m => {
  m.run(40);
  m.g.fighters[0].facing = Math.PI / 2;m.run(40);                       // gira no lugar até alinhar o visual
  for (const d of Object.values(dirs)) {m.run(70, () => cmd({move: d, ...lock}));m.run(30);}
});
sc('locomoção: sprint nas 4 direções e freios', m => {
  for (const d of Object.values(dirs)) {m.run(110, i => cmd({move: d, ...lock, dodge: i === 0, dodgeHeld: true}));m.run(60);}
  m.run(40, () => cmd({move: dirs.fwd, ...lock}));m.run(40);
});
// ---------- defesa ----------
sc('defesa: entra, segura, sai', m => {m.run(20);m.run(80, () => cmd({guard: true, guardPressed: false}));m.run(60);});
sc('defesa: bloqueia um tackle (guard stun no defensor, recuo no atacante)', m => {
  m.g.fighters[0].position = {x: 0, z: -1.6};m.g.fighters[1].position = {x: 0, z: 0};
  m.run(20, () => cmd({guard: true}), () => cmd());
  m.step(cmd({guard: true}), cmd({tackle: true, move: dirs.back, ...lockB}));
  m.run(200, () => cmd({guard: true}), () => cmd());
});
sc('defesa perfeita: toque de D no tempo certo', m => {
  m.g.fighters[0].position = {x: 0, z: -1.6};m.g.fighters[1].position = {x: 0, z: 0};
  m.step(cmd({guard: true, guardPressed: true}), cmd({tackle: true, move: dirs.back, ...lockB}));
  m.run(200, () => cmd({guard: true}), () => cmd());
});
// ---------- tackle e variantes ----------
sc('tackle X e recuperação', m => {m.run(20);m.step(cmd({tackle: true, move: dirs.fwd, ...lock}));m.run(200);});
sc('tackle carregado PL2/PL3', m => {m.run(20);m.run(150, () => cmd({tackle: true, tackleHeld: true, move: dirs.fwd, ...lock}));m.run(200, () => cmd({move: dirs.fwd, ...lock}));});
sc('tackle carregado solto cedo (PL2)', m => {m.run(20);m.run(50, () => cmd({tackle: true, tackleHeld: true, ...lock}));m.run(200, () => cmd({...lock}));});
sc('esquiva C nas 4 direções + vault sobre o rival', m => {
  for (const d of Object.values(dirs)) {m.run(30);m.step(cmd({dodge: true, move: d, dodgeDirection: d, ...lock}));m.run(110);}
  m.g.fighters[0].position = {x: 0, z: -1.2};m.g.fighters[1].position = {x: 0, z: 0};
  m.step(cmd({dodge: true, move: dirs.fwd, ...lock}));m.run(160);
});
sc('meteor slam: C → X a partir do vault', m => {
  m.g.fighters[0].position = {x: 0, z: -1.2};m.g.fighters[1].position = {x: 0, z: 1.5};
  m.step(cmd({dodge: true, move: dirs.fwd, ...lock}));
  for (let i = 0; i < 200; i++) m.step(cmd({tackle: i > 12, tackleHeld: i > 12, move: dirs.fwd, ...lock}));
  m.run(200);
});
sc('finta (brake): tackle cancelado pela esquiva', m => {m.run(20);m.step(cmd({tackle: true, move: dirs.fwd, ...lock}));m.run(10);m.step(cmd({dodge: true, move: dirs.back, ...lock}));m.run(200);});
// ---------- saltos ----------
sc('salto normal: fases e pouso', m => {m.run(30);m.step(cmd({jump: true, jumpHeld: true}));m.run(160, () => cmd({jumpHeld: false}));m.run(80);});
sc('salto com movimento e pouso com ação', m => {m.run(30);for (let i = 0; i < 200; i++) m.step(cmd({jump: i === 0, jumpHeld: i < 25, move: dirs.fwd, ...lock}));m.run(80);});

// ---------- giro do corpo travado no alvo (locomotion.lockFacing = 1): andar/sprint de costas e de lado ----------
const lockFace = () => {C.locomotion.lockFacing = 1;};
sc('lock-on com corpo sempre virado ao alvo: andar e sprint nas 4 direções', m => {
  for (const d of Object.values(dirs)) {m.run(70, () => cmd({move: d, ...lock}));m.run(40, () => cmd({...lock}));}
  for (const d of Object.values(dirs)) {m.run(90, i => cmd({move: d, ...lock, dodge: i === 0, dodgeHeld: true}));m.run(60, () => cmd({...lock}));}
}, {cfg: () => lockFace()});
// ---------- reações do defensor livre ----------
const adj = m => {m.g.fighters[0].position = {x: 0, z: -.9};m.g.fighters[1].position = {x: 0, z: .1};m.g.fighters[0].facing = 0;m.g.fighters[1].facing = Math.PI;};
sc('reação: tackle do rival acerta o lutador livre (hitstun, empurrão, recuperação)', m => {
  adj(m);m.step(cmd(), cmd({tackle: true, move: dirs.back, ...lockB}));m.run(240);
});
sc('reação: tackle carregado PL3 lança o alvo (aéreo, pouso, levantar)', m => {
  adj(m);m.run(150, () => cmd(), () => cmd({tackle: true, tackleHeld: true, move: dirs.back, ...lockB}));m.run(300);
});
sc('reação: acerto contra a parede (wall-splat e prensado)', m => {
  m.g.fighters[0].position = {x: 0, z: 48.6};m.g.fighters[1].position = {x: 0, z: 47.6};m.g.fighters[0].facing = Math.PI;m.g.fighters[1].facing = 0;
  m.run(150, () => cmd(), () => cmd({tackle: true, tackleHeld: true, move: dirs.fwd, target: 0, locked: true}));m.run(300);
});
sc('derrota: o último golpe derruba o lutador (KO)', m => {
  adj(m);m.g.fighters[0].hp = 3;m.step(cmd(), cmd({tackle: true, move: dirs.back, ...lockB}));m.run(300);
});
sc('exaustão: stamina zerada após ação (recover)', m => {
  m.g.fighters[0].stamina = .3;m.run(10);m.step(cmd({tackle: true, move: dirs.fwd, ...lock}));m.run(200);
});

// ---------- reações sem lançamento, empurrões e atordoamentos ----------
sc('reação: contato sem lançamento (enableLaunch desligado) → hitstun', m => {adj(m);m.step(cmd(), cmd({tackle: true, move: dirs.back, ...lockB}));m.run(240);}, {cfg: () => {C.extras.toggles.enableLaunch = 0;}});
sc('reação: clash X×X (atordoamento dos dois)', m => {
  m.g.fighters[0].position = {x: 0, z: -.7};m.g.fighters[1].position = {x: 0, z: .7};
  m.step(cmd({tackle: true, move: dirs.fwd, ...lock}), cmd({tackle: true, move: dirs.back, ...lockB}));m.run(300);
});
sc('reação: Sand Wave empurra o alvo (pushed lateral e frontal)', m => {
  m.g.fighters[0].position = {x: 0, z: -3};m.g.fighters[1].position = {x: 0, z: 0};
  m.step(cmd(), cmd({...P(0), ...lockB}));m.run(300);
}, {equip: [[], ['sand-wave']]});
sc('reação: Guard Break quebra a defesa (atordoamento)', m => {
  m.g.fighters[0].position = {x: 0, z: -1.6};m.g.fighters[1].position = {x: 0, z: 0};
  m.run(15, () => cmd({guard: true}), () => cmd());m.step(cmd({guard: true}), cmd({...P(0), ...lockB}));m.run(120, () => cmd({guard: true}), () => cmd({...P(0), skillHeld: [false, false, false, false]}));
  for (let i = 0; i < 100; i++) m.step(cmd({guard: true}), cmd());m.run(200);
}, {equip: [[], ['guard-break']]});
sc('contra-ataque: Riposte (atordoamento do atacante)', m => {
  m.g.fighters[0].position = {x: 0, z: -1.6};m.g.fighters[1].position = {x: 0, z: 0};
  m.step(cmd({...P(0), ...lock}), cmd());m.run(18);m.step(cmd(), cmd({tackle: true, move: dirs.back, ...lockB}));m.run(300);
}, {equip: [['riposte'], []]});
sc('recuperação de ações (tackle, esquiva e Move) com clipes próprios', m => {
  for (const d of [dirs.fwd, dirs.back]) {m.run(30);m.step(cmd({dodge: true, move: d, ...lock}));m.run(160);}
  m.run(30);m.step(cmd({tackle: true, move: dirs.fwd, ...lock}));m.run(160);
  m.run(30);m.step(cmd({...P(0), ...lock}));m.run(200);
}, {equip: [['swift'], []]});
// ---------- borda (Ledge Grab) ----------
sc('borda: agarrar, ficar pendurado, tentar subir bloqueado, subir e soltar', m => {
  const g = m.g;g.mapState.obstacles = [{id: 'cx', pos: {x: 0, y: 0, z: 0}, shape: 'box', hx: 1.5, hz: 1.5, height: 2.6, angle: 0}];
  const a = g.fighters[0], b = g.fighters[1];a.position = {x: -3.8, z: 0};a.facing = Math.PI / 2;a.visualFacing = Math.PI / 2;b.position = {x: 14, z: 10};
  let jumped = -1;
  for (let t = 0; t < 400 && !a.ledge; t++) {const dist = -2.0 - a.position.x, doJump = jumped < 0 && !a.flight && dist < .6;if (doJump) jumped = t;m.step(cmd({move: vec(1, 0), jump: doJump, jumpHeld: jumped >= 0 && t < jumped + 40}), cmd());}
  m.run(80);
  m.run(10, () => cmd({jump: true}));m.run(120);   // sobe
  // soltar: pendura de novo e solta (defesa)
  a.position = {x: -3.8, z: 0};a.flight = null;a.ledge = null;a.groundY = 0;a.ledgeCd = 0;jumped = -1;
  for (let t = 0; t < 400 && !a.ledge; t++) {const dist = -2.0 - a.position.x, doJump = jumped < 0 && !a.flight && dist < .6;if (doJump) jumped = t;m.step(cmd({move: vec(1, 0), jump: doJump, jumpHeld: jumped >= 0 && t < jumped + 40}), cmd());}
  m.run(40);m.run(60, () => cmd({guard: true}));m.run(120);
});
sc('borda bloqueada: o topo está ocupado pelo rival', m => {
  const g = m.g;g.mapState.obstacles = [{id: 'cx', pos: {x: 0, y: 0, z: 0}, shape: 'box', hx: 1.5, hz: 1.5, height: 2.6, angle: 0}];
  const a = g.fighters[0], b = g.fighters[1];a.position = {x: -3.8, z: 0};a.facing = Math.PI / 2;a.visualFacing = Math.PI / 2;b.position = {x: -.4, z: 0};b.groundY = 2.6;
  let jumped = -1;
  for (let t = 0; t < 400 && !a.ledge; t++) {const dist = -2.0 - a.position.x, doJump = jumped < 0 && !a.flight && dist < .6;if (doJump) jumped = t;m.step(cmd({move: vec(1, 0), jump: doJump, jumpHeld: jumped >= 0 && t < jumped + 40}), cmd());}
  m.run(60);m.run(40, () => cmd({jump: true}));m.run(60);
});
// ---------- Moves: um cenário por Move (a ficha de cada um define o gatilho) ----------
import {listMoves} from './animation-runtime-harness.mjs';
const MOVE_IDS = ['reflect', 'psyshock', 'harden', 'second-wind', 'swift', 'lunge', 'guard-break', 'bounce', 'spikes', 'sand-wave', 'bullet-punch', 'emerging-stone', 'feint', 'riposte', 'quick-attack', 'water-pulse', 'fire-spin', 'air-slash', 'seed-bomb'];
for (const id of MOVE_IDS) sc(`move ${id}: uso real (toque, carga e soltura, confirmação de mira)`, m => {
  m.g.fighters[0].position = {x: 0, z: -3};m.g.fighters[1].position = {x: 0, z: 0.4};
  const held = [true, false, false, false], rel = [false, false, false, false];
  m.run(20, () => cmd({...lock}));
  m.step(cmd({skill: 0, skillHeld: held, ...lock}));                    // 1º toque / início da carga
  m.run(100, () => cmd({skill: null, skillHeld: held, ...lock}));       // segura (cargas)
  m.step(cmd({skill: null, skillHeld: rel, ...lock}));                  // solta
  m.run(80, () => cmd({...lock}));
  m.step(cmd({skill: 0, skillHeld: held, ...lock}));                    // 2º toque (confirma mira / reaperta)
  m.run(60, () => cmd({skill: null, skillHeld: held, ...lock}));m.step(cmd({skill: null, skillHeld: rel, ...lock}));
  m.run(240, () => cmd({...lock}));
}, {equip: [[id], []]});
// mesma ideia sem lock-on e com o rival longe (Moves de mira/marcador, projéteis e áreas)
for (const id of MOVE_IDS) sc(`move ${id}: uso sem lock-on (mira livre), rival longe`, m => {
  m.g.fighters[0].position = {x: 0, z: -4};m.g.fighters[1].position = {x: 0, z: 6};
  const held = [true, false, false, false], rel = [false, false, false, false];
  m.step(cmd({skill: 0, skillHeld: held}));
  m.run(100, () => cmd({skillHeld: held}));
  m.step(cmd({skillHeld: rel}));m.run(60);
  m.step(cmd({skill: 0, skillHeld: held}));m.run(10, () => cmd({skillHeld: held}));m.step(cmd({skillHeld: rel}));
  m.run(240);
}, {equip: [[id], []]});

// ---------- cargas com tempo suficiente ----------
for (const id of ['reflect', 'psyshock', 'guard-break', 'bounce', 'water-pulse']) for (const hold of [160, 320]) sc(`move ${id}: carga segurada ${hold} passos e solta`, m => {
  m.g.fighters[0].position = {x: 0, z: -4};m.g.fighters[1].position = {x: 0, z: 2};
  const held = [true, false, false, false];
  m.step(cmd({skill: 0, skillHeld: held, ...lock}));m.run(hold, () => cmd({skillHeld: held, ...lock}));m.step(cmd({skillHeld: [false, false, false, false], ...lock}));m.run(260, () => cmd({...lock}));
}, {equip: [[id], []]});
// ---------- tackle carregado em vários tempos (PL2/PL3) ----------
for (const hold of [30, 45, 60, 75, 90, 105]) sc(`tackle carregado ${hold} passos (PL2/PL3)`, m => {
  m.run(10);m.run(hold, () => cmd({tackle: true, tackleHeld: true, move: dirs.fwd, ...lock}));m.run(220, () => cmd({move: dirs.fwd, ...lock}));
});
// ---------- freio da finta de tackle ----------
sc('finta de tackle (brake): C para o lado no começo do tackle', m => {m.run(10);m.step(cmd({tackle: true, move: dirs.fwd, ...lock}));m.run(4);m.step(cmd({dodge: true, move: dirs.left, dodgeDirection: dirs.left, ...lock}));m.run(220);}, {cfg: () => {C.extras.toggles.enableTackleFeint = 1;C.extras.toggles.enableTackleFeint = 1;}});
// ---------- atordoamentos, prensado, empurrão lateral, exaustão, recuperações ----------
sc('Guard Break contra a parede (prensado)', m => {
  m.g.fighters[0].position = {x: 0, z: 49};m.g.fighters[1].position = {x: 0, z: 47.6};m.g.fighters[0].facing = Math.PI;m.g.fighters[1].facing = 0;
  const held = [true, false, false, false];
  m.run(10, () => cmd({guard: true}), () => cmd());m.step(cmd({guard: true}), cmd({skill: 0, skillHeld: held, target: 0, locked: true}));
  m.run(160, () => cmd({guard: true}), () => cmd({skillHeld: held, target: 0, locked: true}));m.step(cmd({guard: true}), cmd({skillHeld: [false, false, false, false], target: 0, locked: true}));m.run(300, () => cmd({guard: true}), () => cmd());
}, {equip: [[], ['guard-break']]});
sc('Sand Wave pelo lado (empurrão lateral)', m => {
  m.g.fighters[0].position = {x: 0, z: 0};m.g.fighters[1].position = {x: 4, z: 0};m.g.fighters[1].facing = -Math.PI / 2;
  m.step(cmd(), cmd({skill: 0, skillHeld: [true, false, false, false], target: 0, locked: true}));m.run(300);
}, {equip: [[], ['sand-wave']]});
sc('exaustão: o custo zera a stamina (recover)', m => {m.g.fighters[0].stamina = 1;m.g.fighters[0].regenBase = 1;m.g.fighters[0].regenAge = 0;m.run(10);m.step(cmd({tackle: true, move: dirs.fwd, ...lock}));m.run(260);});
sc('recuperação das ações (sliders de recuperação do tackle e da esquiva > 0)', m => {
  m.step(cmd({tackle: true, move: dirs.fwd, ...lock}));m.run(220);m.step(cmd({dodge: true, move: dirs.back, ...lock}));m.run(220);
}, {cfg: () => {C.actions.tackle.recovery = .35;C.actions.dodge.recovery = .35;}});
// ---------- reservas: o clipe só toca quando o primário não está configurado (prova de que a reserva existe e funciona) ----------
sc('reserva: sem knockback/hit_up → «fall» e «hit»', m => {adj(m);m.step(cmd(), cmd({tackle: true, move: dirs.back, ...lockB}));m.run(240);}, {omit: ['knockback', 'hit_up']});
sc('reserva: sem hit_light → «hit»', m => {adj(m);m.step(cmd(), cmd({tackle: true, move: dirs.back, ...lockB}));m.run(240);}, {omit: ['hit_light'], cfg: () => {C.extras.toggles.enableLaunch = 0;}});
sc('reserva: sem death → «downed»', m => {adj(m);m.g.fighters[0].hp = 3;m.step(cmd(), cmd({tackle: true, move: dirs.back, ...lockB}));m.run(300);}, {omit: ['death']});
sc('reserva: sem a identidade do Move → clipe do slot (move_1)', m => {m.run(10);m.step(cmd({...P(0), ...lock}));m.run(200);}, {equip: [['swift'], []], omit: ['move_swift']});

// ---------- atordoamento real (state = stagger) ----------
sc('footstool: pisar no rival (atordoamento do pisado)', m => {
  m.g.fighters[0].position = {x: 0, z: -.5};m.g.fighters[1].position = {x: 0, z: .3};
  for (let i = 0; i < 160; i++) m.step(cmd({jump: i === 0, jumpHeld: i < 30, move: dirs.fwd, ...lock}), cmd());
  m.run(200);
});
sc('Reflect: a barreira rebate o tackle do rival (recuo do atacante)', m => {
  const held = [true, false, false, false];
  m.g.fighters[0].position = {x: 0, z: -3};m.g.fighters[1].position = {x: 0, z: 1};
  m.step(cmd({skill: 0, skillHeld: held, ...lock}));m.run(160, () => cmd({skillHeld: held, ...lock}));m.step(cmd({skillHeld: [false, false, false, false], ...lock}));
  m.run(30);m.step(cmd(), cmd({tackle: true, move: dirs.back, ...lockB}));m.run(260);
}, {equip: [['reflect'], []]});
sc('Sand Wave prende o alvo na parede (prensado)', m => {
  m.g.fighters[0].position = {x: 0, z: 49.2};m.g.fighters[1].position = {x: 0, z: 44};m.g.fighters[1].facing = 0;m.g.fighters[0].facing = Math.PI;
  m.step(cmd(), cmd({skill: 0, skillHeld: [true, false, false, false], target: 0, locked: true}));m.run(300);
}, {equip: [[], ['sand-wave']]});
sc('exaustão: stamina finita zerada pelo custo (recover)', m => {m.g.fighters[0].stamina = 1.01;m.g.fighters[0].regenBase = 1.01;m.g.fighters[0].regenAge = 0;m.run(10);m.step(cmd({tackle: true, move: dirs.fwd, ...lock}));m.run(260);}, {cfg: () => {C.extras.toggles.enableInfiniteStamina = 0;}});
// ---------- reservas de slot: move_2/3/4 ----------
for (const slot of [1, 2, 3]) sc(`reserva: Move no slot ${slot + 1} sem identidade → clipe do slot (move_${slot + 1})`, m => {
  m.run(10);m.step(cmd({...P(slot), ...lock}));m.run(200);
}, {equip: [[null, null, null, null].map((_, i) => i === slot ? 'swift' : null).filter((x, i) => i <= slot ? true : false).map(x => x), []], omit: ['move_swift']});
// Moves de carga sem release_<id> configurado: a identidade move_<id> toca na soltura
for (const id of ['reflect', 'psyshock', 'bounce', 'water-pulse']) sc(`move ${id}: sem release_${id} → identidade move_${id} na soltura`, m => {
  m.g.fighters[0].position = {x: 0, z: -4};m.g.fighters[1].position = {x: 0, z: 2};
  const held = [true, false, false, false];
  m.step(cmd({skill: 0, skillHeld: held, ...lock}));m.run(240, () => cmd({skillHeld: held, ...lock}));m.step(cmd({skillHeld: [false, false, false, false], ...lock}));m.run(260, () => cmd({...lock}));
}, {equip: [[id], []], omit: [`release_${id}`]});

sc('move guard-break: sem release_guard-break → identidade move_guard-break na soltura', m => {
  m.g.fighters[0].position = {x: 0, z: -4};m.g.fighters[1].position = {x: 0, z: 2};
  const held = [true, false, false, false];
  m.step(cmd({skill: 0, skillHeld: held, ...lock}));m.run(200, () => cmd({skillHeld: held, ...lock}));m.step(cmd({skillHeld: [false, false, false, false], ...lock}));m.run(260, () => cmd({...lock}));
}, {equip: [['guard-break'], []], omit: ['release_guard-break']});
sc('recuperação de Move: depois de soltar a carga (sem clipe de soltura), parado', m => {
  m.g.fighters[0].position = {x: 0, z: -4};m.g.fighters[1].position = {x: 0, z: 6};
  const held = [true, false, false, false];
  m.step(cmd({skill: 0, skillHeld: held, ...lock}));m.run(240, () => cmd({skillHeld: held, ...lock}));m.step(cmd({skillHeld: [false, false, false, false], ...lock}));m.run(120, () => cmd({...lock}));
}, {equip: [['reflect'], []], omit: ['release_reflect', 'move_reflect', 'move_1', 'tackle']});

// ---------- espelhados: o lutador AZUL (Wookada) é o atacante/agente ----------
sc('espelho: o azul ataca um defensor (recuo do atacante, guard stun do rival)', m => {
  m.g.fighters[0].position = {x: 0, z: -1.6};m.g.fighters[1].position = {x: 0, z: 0};
  m.run(20, () => cmd(), () => cmd({guard: true}));
  m.step(cmd({tackle: true, move: dirs.fwd, ...lock}), cmd({guard: true}));m.run(200, () => cmd(), () => cmd({guard: true}));
});
sc('espelho: o azul acerta o rival livre (empurrão e lançamento no rival)', m => {
  m.g.fighters[0].position = {x: 0, z: -.9};m.g.fighters[1].position = {x: 0, z: .1};
  m.step(cmd({tackle: true, move: dirs.fwd, ...lock}), cmd());m.run(300);
});
sc('espelho: o azul pisa no rival (footstool) e o rival cai em stagger', m => {
  m.g.fighters[0].position = {x: 0, z: -.5};m.g.fighters[1].position = {x: 0, z: .3};
  for (let i = 0; i < 160; i++) m.step(cmd({jump: i === 0, jumpHeld: i < 30, move: dirs.fwd, ...lock}), cmd());
  m.run(200);
});
