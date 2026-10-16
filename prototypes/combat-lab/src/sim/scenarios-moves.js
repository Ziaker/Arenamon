// @ts-check
// Cenários técnicos repetíveis dos Moves (M28.3, M28.8): cada um monta um duelo isolado (nunca mexe na partida ao vivo), com semente fixa,
// usa as regras e os ajustes ATUAIS (sliders do painel Moves) e devolve linhas “esperado × obtido”. Servem à calibração e ao diagnóstico;
// a aprovação de jogabilidade e visual continua sendo do diretor (M28.9).
import {C} from './config.js';
import {Game} from './game.js';
import {emptyCommand} from './entity.js';
import {vec} from './math.js';
import {spawn} from './world.js';

const cmd = (/** @type {any} */ o) => ({...emptyCommand(), ...o});
const HELD = (/** @type {number} */ slot) => Array.from({length: C.world.slots}, (_, i) => i === slot);
/** @param {{blue?: any, red?: any}} [o] */
function duel({blue = vec(0, -3), red = vec(0, 3)} = {}) {
  const g = new Game({seed: 7});g.mode = 'inactive';g.reset({positions: [blue, red]});g.fighters[0].facing = 0;g.fighters[1].facing = Math.PI;
  g.setLoadout(0, ['reflect', 'psyshock']);g.setLoadout(1, ['reflect', 'psyshock']);return g;
}
const steps = (/** @type {Game} */ g, /** @type {number} */ k, /** @type {() => any} */ c0 = () => cmd({}), /** @type {() => any} */ c1 = () => cmd({})) => {const ev = /** @type {any[]} */ ([]);for (let i = 0; i < k; i++) {g.step(c0(), c1());ev.push(...g.lastStepEvents);}return ev;};
/** Segura o slot por `ticks` passos e solta; devolve os eventos desde o primeiro toque. */
function cast(/** @type {Game} */ g, /** @type {number} */ slot, /** @type {number} */ ticks, /** @type {any} */ lock = {}) {
  const ev = /** @type {any[]} */ ([]);
  g.step(cmd({skill: slot, skillHeld: HELD(slot)}), cmd({}));ev.push(...g.lastStepEvents);
  for (let i = 1; i < ticks; i++) {g.step(cmd({skillHeld: HELD(slot)}), cmd({}));ev.push(...g.lastStepEvents);}
  g.step(cmd(lock), cmd({}));ev.push(...g.lastStepEvents);return ev;
}
const row = (/** @type {string} */ what, /** @type {any} */ expected, /** @type {any} */ got, /** @type {boolean} */ ok) => ({what, expected: String(expected), got: String(got), ok});
const near = (/** @type {number} */ a, /** @type {number} */ b, e = 1e-6) => Math.abs(a - b) < e;
const r2 = (/** @type {number} */ v) => +v.toFixed(3);
const stones = (/** @type {Game} */ g) => g.world.entities.filter((/** @type {any} */ e) => e.kind === 'projectile' && e.exec != null);

/** @type {{id: string, name: string, run: () => ReturnType<typeof row>[]}[]} */
export const MOVE_SCENARIOS = [
  {id: 'reflect-tamanho', name: 'Reflect: tamanho, duração e PL pela carga', run() {
    const R = C.world.reflect, w = 2 * C.test.halfExtent, h = C.extras.visual.bodyHeight, out = [];
    for (const [ticks, t, level] of [[2, 2 / 480, 1], [240, .5, 2], [480, 1, 3]]) {
      const g = duel();cast(g, 0, ticks);const b = g.world.entities.find((/** @type {any} */ e) => e.reflect);
      const ew = (R.widthMin + (R.widthMax - R.widthMin) * t) * w, eh = (R.heightMin + (R.heightMax - R.heightMin) * t) * h;
      out.push(row(`carga ${ticks} passos: largura × altura × duração × PL`, `${r2(ew)} m × ${r2(eh)} m × ${r2(R.durationBase + ticks / 120)} s × PL${level}`,
        b ? `${r2(b.hx * 2)} m × ${r2(b.height)} m × ${r2(b.life)} s × PL${b.pl}` : 'sem barreira', !!b && near(b.hx * 2, ew, 1e-3) && near(b.height, eh, 1e-3) && b.pl === level));
    }
    return out;
  }},
  {id: 'reflect-reflete', name: 'Reflect: reflete projétil, troca o dono e devolve o dano', run() {
    const g = duel();cast(g, 0, 2);
    const p = spawn(g.world, {kind: 'projectile', owner: 1, pos: {x: 0, z: 2.5}, dir: {x: 0, z: -1}, speed: 14, y: .65, radius: .2, life: 3, pierce: 1, pl: 1, hit: {damage: 10}, captured: {attackFraction: .2}}, []);
    const ev = steps(g, 90), refl = ev.find(e => e.result === 'reflected');
    return [row('projétil de PL1 é refletido pela frente', 'reflected (frente)', refl ? `reflected (${refl.face})` : 'não refletido', !!refl && refl.face === 'front'),
      row('o dono passa a ser o refletor (azul)', 'dono 0', `dono ${p.owner}`, p.owner === 0),
      row('o lançador original leva 0,2 × Ataque do refletor', `${r2(.2 * g.fighters[0].attributes.attack)}`, `${r2(100 - g.fighters[1].hp)}`, near(100 - g.fighters[1].hp, .2 * g.fighters[0].attributes.attack, 1e-6))];
  }},
  {id: 'reflect-pl', name: 'Reflect: PL superior destrói a barreira', run() {
    const g = duel();cast(g, 0, 2);const b = g.world.entities.find((/** @type {any} */ e) => e.reflect);
    const p = spawn(g.world, {kind: 'projectile', owner: 1, pos: {x: 0, z: 2.5}, dir: {x: 0, z: -1}, speed: 14, y: .65, radius: .2, life: 3, pierce: 1, pl: 3, hit: {damage: 10}}, []);
    const ev = steps(g, 60);
    return [row('barreira de PL1 contra projétil de PL3', 'barreira destruída e projétil neutralizado', `barreira ${b?.dead ? 'destruída' : 'intacta'}, projétil ${p.dead ? 'neutralizado' : 'vivo'}`, !!b?.dead && p.dead && ev.some(e => e.result === 'neutralized'))];
  }},
  {id: 'reflect-tackle', name: 'Tackle destrói o Reflect (recuo e stagger)', run() {
    const g = duel();cast(g, 0, 2);steps(g, 40);const b = g.world.entities.find((/** @type {any} */ e) => e.reflect);
    g.fighters[1].position = vec(0, b.pos.z + 1.6);g.fighters[1].facing = Math.PI;
    const ev = /** @type {any[]} */ ([]);for (let i = 0; i < 40 && !b.dead; i++) {g.step(cmd({}), cmd({tackle: true, move: vec(0, -1)}));ev.push(...g.lastStepEvents);}
    return [row('o Tackle do vermelho destrói a barreira do azul', 'barrierBroken (tackle)', ev.some(e => e.result === 'barrierBroken' && e.by === 'tackle') ? 'barrierBroken (tackle)' : 'intacta', !!b.dead),
      row('o atacante fica em stagger', `${C.world.reflect.tackleStagger} s`, `${r2(g.fighters[1].knockRecovery)} s`, g.fighters[1].knockRecovery > 0)];
  }},
  {id: 'reflect-explosao', name: 'Explosão: o Reflect protege quem está atrás', run() {
    const g = duel();cast(g, 0, 2);steps(g, 2);
    spawn(g.world, {kind: 'area', explosion: true, owner: 1, affectsOwner: true, pos: {x: 0, z: 0}, radius: 4, y: 0, height: 3, life: .1, pulses: 1, hit: {damage: 10}, pl: 2}, []);
    const ev = steps(g, 3);
    return [row('o azul atrás da barreira não leva dano', '100 HP', `${r2(g.fighters[0].hp)} HP`, g.fighters[0].hp === 100),
      row('o vermelho, sem barreira, leva o dano', '< 100 HP', `${r2(g.fighters[1].hp)} HP`, g.fighters[1].hp < 100),
      row('a barreira é destruída pela explosão', 'barrierBroken (explosion)', ev.some(e => e.result === 'barrierBroken' && e.by === 'explosion') ? 'barrierBroken (explosion)' : '—', ev.some(e => e.result === 'barrierBroken' && e.by === 'explosion'))];
  }},
  {id: 'reflect-sem-espaco', name: 'Reflect sem espaço: falha e devolve a stamina', run() {
    const g = duel({red: vec(0, -1.5)});const s0 = g.fighters[0].stamina, ev = cast(g, 0, 30);
    return [row('nenhuma barreira é criada', 'moveFailed (semEspaco)', ev.find(e => e.result === 'moveFailed')?.reason ?? 'criada', ev.some(e => e.result === 'moveFailed' && e.reason === 'semEspaco')),
      row('a stamina é devolvida e não há recarga', `${r2(s0)} e sem recarga`, `${r2(g.fighters[0].stamina)} e ${g.fighters[0].moveCooldowns.reflect ? 'com recarga' : 'sem recarga'}`, near(g.fighters[0].stamina, s0, 1e-6) && !g.fighters[0].moveCooldowns.reflect)];
  }},
  {id: 'psyshock-pedras', name: 'Psyshock: quantidade, PL e dano iguais', run() {
    const P = C.world.psyshock, out = [];
    for (const [ticks, level] of [[2, 1], [240, 2], [480, 3]]) {
      const g = duel();cast(g, 1, ticks);const s = stones(g), expected = Math.min(P.maxStones, P.minStones + Math.floor(ticks / Math.max(1, Math.round(P.stoneSeconds * 120))));
      out.push(row(`carga ${ticks} passos: pedras e PL`, `${expected} pedras, PL${level}`, `${s.length} pedras, PL${[...new Set(s.map((/** @type {any} */ e) => e.pl))].join('/')}`, s.length === expected && s.every((/** @type {any} */ e) => e.pl === level)));
      out.push(row('dano-base igual em todas (0,2 × Ataque)', `${r2(P.damageFraction * g.fighters[0].attributes.attack)}`, [...new Set(s.map((/** @type {any} */ e) => r2(e.hit.damage)))].join('/'), s.every((/** @type {any} */ e) => near(e.hit.damage, P.damageFraction * g.fighters[0].attributes.attack, 1e-9))));
    }
    return out;
  }},
  {id: 'psyshock-acertos', name: 'Psyshock: dano × fator por acerto e teto de knockback', run() {
    const P = C.world.psyshock, g = duel(), base = P.damageFraction * g.fighters[0].attributes.attack;cast(g, 1, 480, {target: 1, locked: true});
    const ev = steps(g, 160), hits = ev.filter(e => e.result === 'impact' && e.target === 1), kb = hits.reduce((s, e) => s + (e.launch?.horizontal ?? 0), 0);
    const expected = Array.from({length: hits.length}, (_, i) => base * P.successiveFactor ** i);
    return [row('número de pedras que acertam o alvo travado', `${Math.min(P.maxStones, P.minStones + 5)}`, `${hits.length}`, hits.length >= 1),
      row('dano de cada acerto = base × fator^n', expected.map(v => r2(v)).join(' · '), hits.map(e => r2(e.damage)).join(' · '), hits.every((e, i) => near(e.damage, expected[i], 1e-6))),
      row('knockback total no alvo ≤ teto por execução', `≤ ${P.knockbackCap} m/s`, `${r2(kb)} m/s`, kb <= P.knockbackCap + 1e-6)];
  }},
  {id: 'psyshock-reflexao', name: 'Psyshock × Reflect do adversário', run() {
    const g = duel();
    spawn(g.world, {kind: 'barrier', owner: 1, shape: 'box', pos: {x: 0, z: 1.2}, angle: Math.PI, hx: 3, hz: .05, y: 0, height: 3, life: 8, hp: Infinity, blocksProjectiles: true, blocksFighters: true, blocksOwner: true, reflect: true, shields: true, pl: 3, captured: {tieTolerance: .001, maxReflections: 16}}, []);
    cast(g, 1, 480, {target: 1, locked: true});const ev = steps(g, 160), refl = ev.filter(e => e.result === 'reflected'), back = ev.filter(e => e.result === 'impact' && e.target === 0);
    return [row('as pedras de PL3 são refletidas por um Reflect de PL3', '≥ 1 reflexão', `${refl.length}`, refl.length >= 1), row('e atingem o lançador original', '≥ 1 impacto no azul', `${back.length}`, back.length >= 1)];
  }},
  {id: 'tackle-pedra', name: 'Tackle × pedra: Clash em PL1, Counter em PL2', run() {
    const out = [];
    for (const pl of [1, 2]) {
      const g = duel({red: vec(0, 20)});g.step(cmd({tackle: true, move: vec(0, 1)}), cmd({}));steps(g, 29, () => cmd({move: vec(0, 1)}));
      const z = g.fighters[0].position.z;spawn(g.world, {kind: 'projectile', owner: 1, pos: {x: 0, z: z + .9}, dir: {x: 0, z: -1}, speed: 10, y: .65, radius: .2, life: 3, pierce: 1, pl, clashable: true, hit: {damage: 5}, captured: {counterStagger: C.world.psyshock.counterStagger}}, []);
      const ev = steps(g, 4);out.push(pl === 1 ? row('Tackle (PL1) × pedra PL1', 'Clash: só a pedra se despedaça', ev.some(e => e.result === 'tackleClash') ? 'Clash' : 'sem disputa', ev.some(e => e.result === 'tackleClash') && g.fighters[0].hp === 100)
        : row('Tackle (PL1) × pedra PL2', 'Counter: a pedra vence e aplica o stagger', ev.some(e => e.result === 'counter') && ev.some(e => e.result === 'counterStagger') ? 'Counter + stagger' : 'sem Counter', ev.some(e => e.result === 'counter') && ev.some(e => e.result === 'counterStagger')));
    }
    return out;
  }},
];
/** Executa cenários (todos ou os ids dados); devolve {id, name, rows, ok}. */
export function runMoveScenarios(/** @type {string[] | null} */ ids = null) {
  return MOVE_SCENARIOS.filter(s => !ids || ids.includes(s.id)).map(s => {
    try {const rows = s.run();return {id: s.id, name: s.name, rows, ok: rows.every(r => r.ok)};}
    catch (e) {return {id: s.id, name: s.name, rows: [row('execução', 'sem erro', /** @type {Error} */ (e).message, false)], ok: false};}
  });
}
