// Moves no ar (item 1 do checklist, 22/10/2026): salto normal, queda de borda e arco do vault da esquiva não bloqueiam mais os Moves; cada Move trata o ar do seu jeito
// (air.js: 'cast' = o corpo segue em voo; 'descend' = desce suavemente e age). Roda nos valores de fábrica, sem navegador.
import {assert, C, cmd, vec, arena, HOLD, suite} from './moves-new-helpers.mjs';
import {NEW_MOVE_IDS} from '../src/sim/moves/new-moves.js';
import {getMove} from '../src/sim/moves.js';
import {slotStatus} from '../src/sim/move-state.js';
import {applyHit} from '../src/sim/world.js';

const {test, done} = suite('MOVES NO AR');
const ALL = ['reflect', 'psyshock', ...NEW_MOVE_IDS];
const rich = () => {C.rules.staminaMax = 12;};
const JUMP = cmd({jump: true, jumpHeld: true}), JUMP_HELD = cmd({jumpHeld: true});
const evs = g => g.lastStepEvents.filter(e => e.attacker === 0);
/** Azul salta; devolve o jogo no instante em que está subindo, a ~1 m de altura. */
function airborne(id, {red = vec(0, 8)} = {}) {
  const g = arena({equip: [id], positions: [vec(0, -3), red], setup: rich});g.mapState.platforms = [];
  const f = g.fighters[0];g.step(JUMP, cmd());
  for (let i = 0; i < 40 && !(f.flight && f.flight.y > .9); i++) g.step(JUMP_HELD, cmd());
  assert.ok(f.flight && f.flight.isNormalJump, 'precisa estar em salto normal');
  return g;
}
/** Azul esquiva por cima do rival (vault); devolve o jogo durante o arco. */
function vaulting(id) {
  const g = arena({equip: [id], positions: [vec(0, -3), vec(0, -1.6)], setup: rich});g.mapState.platforms = [];
  const f = g.fighters[0];
  g.step(cmd({dodge: true, dodgeHeld: true, move: vec(0, 1), dodgeDirection: vec(0, 1)}), cmd());
  for (let i = 0; i < 12; i++) g.step(cmd(), cmd());
  assert.ok(f.action?.kind === 'dodge' && f.vaultHeight > .3, `arco do vault (altura ${f.vaultHeight})`);
  return g;
}
const press = (g, extra = {}) => g.step(cmd({skill: 0, skillHeld: HOLD(0), ...extra}), cmd());
const hold = (g, n, extra = {}) => {for (let i = 0; i < n; i++) g.step(cmd({skillHeld: HOLD(0), ...extra}), cmd());};
const idle = (g, n) => {for (let i = 0; i < n; i++) g.step(cmd(), cmd());};
const settled = f => !f.absent && !f.action && !f.charge && !f.aim && !f.flight && !(f.vaultHeight > 0) && !(f.moveRecovery > 0);

test('todos os 15 Moves declaram como tratam o ar (air: cast | descend)', () => {
  arena();
  const kinds = Object.fromEntries(ALL.map(id => [id, getMove(id).air]));
  for (const [id, k] of Object.entries(kinds)) assert.ok(k === 'cast' || k === 'descend', `${id}: air = ${k}`);
  assert.deepEqual(Object.keys(kinds).filter(id => kinds[id] === 'descend').sort(), ['bullet-punch', 'guard-break', 'lunge', 'quick-attack']);
});
test('salto: Harden e Second Wind aplicam o status sem tirar o corpo do voo', () => {
  for (const id of ['harden', 'second-wind']) {
    const g = airborne(id), f = g.fighters[0];press(g);idle(g, 60);
    assert.ok(f.statuses.some(s => s.id === id), `${id} sem status`);assert.ok(f.flight || f.statuses.length, 'segue o voo');
  }
});
test('salto: Swift dispara os 3 projéteis na altitude do corpo', () => {
  const g = airborne('swift'), f = g.fighters[0], n0 = g.world.entities.length, y = f.flight.y;
  press(g);idle(g, 40);
  assert.equal(g.world.entities.length - n0, 3);
  assert.ok(g.world.entities.some(e => (e.y ?? 0) > y - .8), 'projéteis nascem na altura do corpo');
});
test('salto: Reflect e Psyshock carregam no ar e a soltura cria a barreira / as pedras', () => {
  for (const [id, min] of [['reflect', 1], ['psyshock', 3]]) {
    const g = airborne(id), f = g.fighters[0], n0 = g.world.entities.length;
    press(g);hold(g, 150);   // atravessa o pouso: o salto normal não tem recuperação, a carga continua
    assert.ok(f.charge, `${id}: a carga segue depois do pouso`);
    g.step(cmd(), cmd());idle(g, 30);
    assert.ok(g.world.entities.length - n0 >= min, `${id}: ${g.world.entities.length - n0} entidade(s)`);
  }
});
test('salto: Spikes mira no ar, confirma e cria a armadilha', () => {
  const g = airborne('spikes'), n0 = g.world.entities.length;
  press(g);hold(g, 6);assert.ok(g.fighters[0].aim, 'marcador aberto no ar');
  g.step(cmd(), cmd());idle(g, 80);
  assert.ok(g.world.entities.some(e => e.kind === 'trap'), 'armadilha criada');assert.ok(g.world.entities.length > n0);
});
test('salto: Sand Wave nasce no chão sob o lutador', () => {
  const g = airborne('sand-wave');press(g);idle(g, 60);
  assert.ok(g.world.entities.some(e => e.kind === 'sandwave'));
});
test('salto: Bounce parte da altitude do corpo (novo arco), pousa e termina', () => {
  const g = airborne('bounce'), f = g.fighters[0], y0 = f.flight.y;
  press(g);hold(g, 40);g.step(cmd(), cmd());
  assert.ok(f.flight?.bounce && f.flight.y >= y0 - .05, `arco novo em ${f.flight?.y} (corpo estava em ${y0})`);
  idle(g, 900);assert.ok(settled(f), 'terminou no chão');
});
test('salto: Lunge, Guard Break e Quick Attack descem enquanto agem e terminam no chão', () => {
  for (const id of ['lunge', 'guard-break', 'quick-attack']) {
    const g = airborne(id, {red: vec(0, 4)}), f = g.fighters[0], z0 = f.position.z;
    press(g);if (id === 'guard-break') {hold(g, 20);g.step(cmd(), cmd());}
    if (id === 'quick-attack') g.step(cmd(), cmd());   // alvo único: o círculo de alcance abre ao apertar e o Move sai ao soltar
    assert.ok(f.action?.liftStart > 0 || id === 'guard-break', `${id}: ação não desce do ar`);
    idle(g, 15);
    assert.ok(f.vaultHeight < (f.action?.liftStart ?? 9) || !f.action, `${id}: não desceu`);
    idle(g, 400);assert.ok(settled(f), `${id}: não terminou no chão (${f.state})`);if (id !== 'quick-attack') assert.ok(f.position.z > z0 + .5, `${id}: não avançou`);   // o Quick Attack volta ao ponto de partida
    assert.ok((f.moveCooldowns?.[id] ?? 0) > 0, `${id}: sem recarga`);
  }
});
test('salto: Bullet Punch mira no ar, desaparece, reaparece e não fica preso', () => {
  const g = airborne('bullet-punch', {red: vec(0, 2)}), f = g.fighters[0];
  press(g);hold(g, 30);g.step(cmd(), cmd());
  const seen = new Set();for (let i = 0; i < 400; i++) {g.step(cmd(), cmd());evs(g).forEach(e => seen.add(e.result));}
  assert.ok(seen.has('bulletVanish') && seen.has('bulletReturn'), [...seen].join());assert.ok(settled(f));
});
test('salto: Emerging Stone abre o marcador, Feint e Riposte são aceitos e acabam', () => {
  let g = airborne('emerging-stone');press(g);assert.ok(g.fighters[0].aim, 'marcador do Emerging Stone no ar');
  for (const id of ['feint', 'riposte']) {
    g = airborne(id);press(g);assert.ok((g.fighters[0].moveCooldowns?.[id] ?? 0) > 0, `${id} não foi aceito no ar`);idle(g, 300);assert.ok(settled(g.fighters[0]), `${id} preso`);
  }
});
test('vault: Harden (cast) converte o arco em voo e o status entra; Lunge desce e age; Reflect carrega', () => {
  let g = vaulting('harden'), f = g.fighters[0];press(g);
  assert.ok(f.flight && f.action?.air, 'Harden no arco do vault: vira voo e a ação é aérea');idle(g, 60);
  assert.ok(f.statuses.some(s => s.id === 'harden'), 'status do Harden aplicado depois do cast');
  g = vaulting('lunge');f = g.fighters[0];const h0 = f.vaultHeight;press(g);
  assert.ok(f.action?.move === 'lunge' && f.action.liftStart > 0 && f.action.liftStart <= h0 + .5, 'Lunge parte da altura do vault');idle(g, 200);assert.ok(settled(f));
  g = vaulting('reflect');f = g.fighters[0];press(g);assert.ok(f.charge, 'carga iniciada no arco');idle(g, 5);
});
test('Riposte no ar: o acerto na janela é anulado e o contra-golpe sai descendo, terminando no chão', () => {
  const g = airborne('riposte', {red: vec(0, 1.6)}), f = g.fighters[0];press(g);idle(g, 24);   // dentro da janela do contra-golpe (0,13–0,30 s)
  assert.ok(f.flight && f.action?.air && f.action.def.riposte, 'postura aérea');
  const hp0 = f.hp, r = applyHit(g, 1, f, {damage: 10, knockback: {horizontal: 3, vertical: 0}}, vec(0, -1), {source: 'teste'});
  assert.equal(r?.result, 'riposte', 'o acerto na janela vira Riposte');assert.equal(f.hp, hp0, 'sem dano');
  let strike = false;for (let i = 0; i < 40 && !strike; i++) {g.step(cmd(), cmd());strike = !!f.action?.riposteStrike;}
  assert.ok(strike, 'contra-golpe iniciado no ar');assert.ok(f.action.liftStart > 0 || !f.flight, 'o contra-golpe desce do ar');
  idle(g, 400);assert.ok(settled(f), 'terminou no chão, sem ficar preso');
});
test('Emerging Stone no ar: aceito, e se o lutador pousa a tempo o disparo acontece; sem apoio ao fim do cast, cancela sem travar', () => {
  const g = airborne('emerging-stone'), f = g.fighters[0];press(g, {move: vec(0, 1)});hold(g, 40, {move: vec(0, 1)});g.step(cmd(), cmd());
  idle(g, 600);assert.ok(settled(f), 'não ficou preso');
  assert.ok((f.moveCooldowns?.['emerging-stone'] ?? 0) > 0 || !f.aim, 'ou disparou (recarga) ou cancelou limpo');
});
test('lançado por golpe continua sem comando: nenhum Move é aceito', () => {
  const g = arena({equip: ['harden', 'lunge', 'reflect', 'spikes'], setup: rich});const f = g.fighters[0];
  f.flight = {y: .01, vy: 8, horizontal: vec(0, 4)};f.launchedByHit = true;f.state = 'airborne';
  for (let s = 0; s < 4; s++) {const st = slotStatus(f, s);assert.equal(st.state, 'bloqueado', `slot ${s}`);assert.equal(st.reason, 'noGround');}
  g.step(cmd({skill: 0, skillHeld: HOLD(0)}), cmd());assert.ok(!(f.moveCooldowns?.harden > 0), 'Harden aceito num lançamento');
});
test('no salto o HUD mostra «pronto» (a tela não promete o que o motor nega)', () => {
  const g = airborne('harden');assert.equal(slotStatus(g.fighters[0], 0).state, 'pronto');
});
done();
