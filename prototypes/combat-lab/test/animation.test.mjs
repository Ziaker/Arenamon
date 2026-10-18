// Máquina de estados de animação (overhaul), sem navegador: rig sintético do Studio + simulação real.
// Verifica tackle e esquiva até o fim, ausência de reinícios, esquiva → sprint, freios, variantes sorteadas na
// entrada (determinísticas), cancelamento legítimo C → X, importação de clipes e ajuste de altura.
// Uso: node prototypes/combat-lab/test/animation.test.mjs
import assert from 'node:assert/strict';
import {mkdirSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import * as T from 'three';
import {readFileSync} from 'node:fs';
// O fixture do Studio é um módulo ES escrito para o navegador (sem package.json “module”): carregado como texto.
const {syntheticRig} = await import('data:text/javascript,' + encodeURIComponent(readFileSync(new URL('../../studio/test/fixture.js', import.meta.url), 'utf8')));
import {Character} from '../src/view/characters.js';
import {Game} from '../src/sim/game.js';
import {C, resetConfig} from '../src/sim/config.js';
import {vec} from '../src/sim/math.js';
import {registerStandardMoves} from '../src/sim/moves/standard.js';

const out = fileURLToPath(new URL('../validation/', import.meta.url));mkdirSync(out, {recursive: true});
let passed = 0;const report = [];
const check = (label, ok, detail = '') => {report.push({label, ok: !!ok, detail});assert.ok(ok, `${label} ${detail}`);};
function test(name, fn) {resetConfig();fn();passed++;console.log('✓', name);}
const cmd = (o = {}) => ({move: vec(), dodge: false, dodgeHeld: false, tackle: false, guard: false, guardPressed: false, target: null, ...o});

/** Clipe sintético: inclina a coluna (amplitude diferente por clipe) e abaixa o quadril em `drop` cm. */
function clip(name, duration, amp = 20, drop = 0) {
  const times = [0, duration / 2, duration], q = a => new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), a * Math.PI / 180).toArray();
  return new T.AnimationClip(name, duration, [new T.QuaternionKeyframeTrack('mixamorigSpine.quaternion', times, [...q(0), ...q(amp), ...q(0)]),
    new T.VectorKeyframeTrack('mixamorigHips.position', times, [0, 100, 0, 3, 100 - drop, 40, 0, 100, 0])]);
}
function makeSource(extra = []) {
  const {root} = syntheticRig(T);
  const animations = [clip('Idle', 2), clip('Walking', 1), clip('Running', .7), clip('Tackle A', .9, 30), clip('Tackle B', 1.1, 40), clip('Tackle C', .8, 50),
    clip('Dodge Forward', .6), clip('Dodge Left', .6), clip('Dodge Right', .6), clip('Dodge Back', .6), clip('Sprint', .5), clip('Walk Stop', .5), clip('Run Stop', .6), clip('Crouch Idle', 1, 5, 30), ...extra];
  return {name: 'teste-sintetico.glb', scene: root, animations, manifest: null, eventsByClip: []};
}
function setup(source = makeSource()) {
  const ch = new Character(source, {persist: false});const g = new Game();g.mode = 'inactive';g.reset({positions: [vec(-6, 0), vec(8, 8)]});
  for (const f of g.fighters) {f.facing = Math.PI / 2;f.visualFacing = Math.PI / 2;}
  return {ch, g};
}
/** Executa n passos de simulação atualizando a animação a cada passo (como o laço do laboratório a 120 Hz). */
function run(ch, g, n, script) {
  const keys = [];
  for (let t = 0; t < n; t++) {const [a, b] = script(t, g);g.step(a ?? cmd(), b ?? cmd());ch.update(g.fighters[0], C.test.step, 0, g.lastStepEvents, {tick: g.tick, source: 'jogador'});keys.push({key: ch.current?.key, index: ch.current?.index, time: ch.current?.action.time});}
  return keys;
}
const entries = (ch, key) => ch.log.filter(e => e.to === key);
const after = (ch, e) => ch.log[ch.log.indexOf(e) + 1];

test('associação por nome: variantes de tackle, esquivas, sprint e freios', () => {
  const {ch} = setup();
  check('tackle com 1 variante automática', ch.variantsOf('tackle').length === 1, JSON.stringify(ch.variants.tackle));
  ch.addVariant('tackle', 4);ch.addVariant('tackle', 5);
  check('tackle com 3 variantes', ch.variantsOf('tackle').length === 3);
  check('sprint, walk_stop e sprint_stop associados', ch.actionFor('sprint') === 'sprint' && ch.actionFor('walk_stop') === 'walk_stop' && ch.actionFor('sprint_stop') === 'sprint_stop', JSON.stringify(ch.mapping));
});
test('tackle e esquiva tocam até o fim, sem reinício por detecção repetida', () => {
  for (const kind of ['tackle', 'dodge']) {
    const {ch, g} = setup();const keys = run(ch, g, 160, t => [t === 20 ? cmd({move: vec(1, 0), [kind]: true, dodgeDirection: vec(1, 0)}) : cmd(), cmd()]);
    const key = kind === 'tackle' ? 'tackle' : 'dodge_forward', e = entries(ch, key);
    check(`${kind}: uma única entrada`, e.length === 1, `${e.length} entradas`);
    const next = after(ch, e[0]);
    check(`${kind}: termina a ${next?.playedPct}% do clipe`, next && next.playedPct >= 95 && !next.interrupted && next.reason === 'ação concluída', JSON.stringify(next));
    // Tempo do clipe monotônico durante a ação (nunca volta ao início).
    const span = keys.filter(k => k.key === key);let mono = true;for (let i = 1; i < span.length; i++) if (span[i].time < span[i - 1].time - 1e-9) mono = false;
    check(`${kind}: tempo do clipe só avança`, mono);
  }
});
test('dois tackles seguidos reiniciam o clipe (nova ação legítima); variante sorteada só na entrada', () => {
  const {ch, g} = setup();C.actions.tackle.cost = 0;ch.addVariant('tackle', 4);ch.addVariant('tackle', 5);
  const keys = run(ch, g, 3000, t => [t % 100 === 10 ? cmd({move: vec(t % 200 < 100 ? 1 : -1, 0), tackle: true}) : cmd(), cmd()]);
  const tackles = entries(ch, 'tackle');
  check('uma entrada por tackle', tackles.length === 30, `${tackles.length}`);
  check('as 3 variantes aparecem', new Set(tackles.map(e => e.clipTo)).size === 3, [...new Set(tackles.map(e => e.clipTo))].join(', '));
  // Durante cada tackle o índice do clipe não muda.
  let stable = true;for (let i = 1; i < keys.length; i++) if (keys[i].key === 'tackle' && keys[i - 1].key === 'tackle' && keys[i].index !== keys[i - 1].index && keys[i].time > keys[i - 1].time) stable = false;
  check('variante fixa durante a reprodução', stable);
  // Determinismo: a mesma sequência de passos escolhe as mesmas variantes.
  const r2 = setup();C.actions.tackle.cost = 0;r2.ch.addVariant('tackle', 4);r2.ch.addVariant('tackle', 5);run(r2.ch, r2.g, 3000, t => [t % 100 === 10 ? cmd({move: vec(t % 200 < 100 ? 1 : -1, 0), tackle: true}) : cmd(), cmd()]);
  check('sorteio determinístico (replay escolhe as mesmas variantes)', JSON.stringify(entries(r2.ch, 'tackle').map(e => e.clipTo)) === JSON.stringify(tackles.map(e => e.clipTo)));
});
test('cancelamento C → X: transição legítima registrada, com o motivo', () => {
  const {ch, g} = setup();
  run(ch, g, 120, t => [t === 10 ? cmd({move: vec(1, 0), dodge: true, dodgeDirection: vec(1, 0)}) : t === 10 + Math.round((C.actions.dodge.duration - .08) / C.test.step) ? cmd({move: vec(1, 0), tackle: true}) : cmd(), cmd()]);
  const tk = entries(ch, 'tackle')[0];
  check('X depois de C registrado como cancelamento', tk?.reason === 'cancelamento C → X' && tk.from === 'dodge_forward', JSON.stringify(tk));
  check('a esquiva aparece como interrompida (legítimo)', tk.interrupted === true && tk.playedPct < 95, `${tk.playedPct}%`);
});
test('esquiva → sprint → freio do sprint → inversão', () => {
  const {ch, g} = setup();
  run(ch, g, 420, t => {const c = cmd({move: t < 300 ? vec(1, 0) : vec(-1, 0)});if (t === 10) {c.dodge = true;c.dodgeDirection = vec(1, 0);}c.dodgeHeld = t < 240;return [c, cmd()];});
  const seq = ch.log.map(e => e.to).filter((k, i, a) => k !== a[i - 1]);
  check('sequência esquiva → sprint', seq.indexOf('sprint') === seq.indexOf('dodge_forward') + 1, seq.join(' → '));
  check('sprint → freio do sprint ao soltar C', seq.includes('sprint_stop') && seq.indexOf('sprint_stop') > seq.indexOf('sprint'), seq.join(' → '));
  check('freio entra só com desaceleração real', ch.log.filter(e => e.to === 'sprint_stop').every(e => e.reason === 'freio físico'));
});
test('andar → freio da caminhada → inversão', () => {
  const {ch, g} = setup();
  run(ch, g, 300, t => [cmd({move: t < 150 ? vec(1, 0) : vec(-1, 0)}), cmd()]);
  const seq = ch.log.map(e => e.to);
  check('entra em walk_stop na inversão', seq.includes('walk_stop'), seq.join(' → '));
  check('volta à locomoção no novo sentido', ['run', 'walk', 'walk_back'].includes(seq.at(-1)), seq.at(-1));
});
test('locomoção sem oscilação: histerese evita trocas de poucos quadros', () => {
  const {ch, g} = setup();
  // Velocidade oscilando em torno do limiar andar/correr (comando parcial alternado).
  run(ch, g, 600, t => [cmd({move: vec(t % 6 < 3 ? .62 : .58, 0)}), cmd()]);
  const loco = ch.log.filter(e => ['walk', 'run'].includes(e.to));
  check('poucas trocas andar/correr', loco.length <= 2, `${loco.length} trocas`);
});
test('importar animação para a biblioteca: compatível por nome normalizado; incompatível sinalizado', () => {
  const {ch} = setup();
  const prefixed = new T.AnimationClip('Spin', 1, [new T.QuaternionKeyframeTrack('mixamorig:Spine.quaternion', [0, 1], [0, 0, 0, 1, 0, .7, 0, .7])]);
  const foreign = new T.AnimationClip('Alien', 1, [new T.QuaternionKeyframeTrack('Tentacle01.quaternion', [0, 1], [0, 0, 0, 1, 0, .7, 0, .7])]);
  const before = ch.clips.length, rep = ch.importClips({name: 'extra.glb', animations: [prefixed, foreign]});
  check('clipes existentes preservados', ch.clips.length === before + 2 && ch.clips.slice(0, before).every((c, i) => c.name === makeSource().animations[i].name));
  check('compatível (ossos com prefixo diferente)', rep[0].compatible && rep[0].renamed === 1, JSON.stringify(rep[0]));
  check('incompatível sinalizado', !rep[1].compatible, JSON.stringify(rep[1]));
  check('clipe importado pode ser usado em vários estados', ch.addVariant('turn', before) && ch.addVariant('tackle', before));
  check('clipe incompatível não pode ser associado', !ch.addVariant('tackle', before + 1));
});
test('altura visual: ajuste automático por animação, offset manual e independência da física', () => {
  const {ch, g} = setup();ch.variants.idle = [13];// Crouch Idle abaixa o quadril 30 cm (o modelo inteiro desce).
  ch.groundCurve(13);ch.groundCurve(0);// curvas pré-calculadas, como faz warmGround (no quadro o cálculo é adiado)
  const samples = [];for (let k = 0; k < 120; k++) {run(ch, g, 1, () => [cmd(), cmd()]);samples.push(ch.root.position.y);}
  const f = g.fighters[0], groundCrouch = ch.clipGround(13), groundIdle = ch.clipGround(0);
  check('clipe agachado tem o ponto mais baixo abaixo do da pose normal', groundCrouch < groundIdle - .1, `${groundCrouch.toFixed(3)} × ${groundIdle.toFixed(3)}`);
  check('compensação automática levanta o modelo no instante agachado', Math.max(...samples) > .1, Math.max(...samples).toFixed(3));
  ch.visualOffset = .2;ch.place(g.fighters[0], 0, 0);
  const base = -ch.groundAt(ch.current.index, ch.current.action.time) * ch.root.scale.x;
  check('offset manual soma à altura visual', Math.abs(ch.groundOffset - base - .2) < 1e-6, (ch.groundOffset - base).toFixed(4));
  check('posição física inalterada', Math.abs(f.position.x + 6) < 1e-9 && Math.abs(f.position.z) < 1e-9);
});
test('sem root motion: deslocamento horizontal do quadril descartado', () => {
  const {ch, g} = setup();run(ch, g, 50, t => [cmd({move: vec(1, 0)}), cmd()]);
  check('quadril sem deslocamento X/Z', Math.abs(ch.hips.position.x - ch.hipsRest.x) < 1e-9 && Math.abs(ch.hips.position.z - ch.hipsRest.z) < 1e-9);
});
test('disparo de movimentos: move_1 e move_2 ativam animação própria', () => {
  registerStandardMoves();
  const specialClip1 = clip('Special Move 1', .6, 45);
  const specialClip2 = clip('Special Move 2', .5, 35);
  const src = makeSource([specialClip1, specialClip2]);
  const {ch, g} = setup(src);
  g.setLoadout(0, ['reflect', 'psyshock', null, null]);
  const idx1 = src.animations.indexOf(specialClip1);
  const idx2 = src.animations.indexOf(specialClip2);
  ch.addVariant('move_1', idx1);
  ch.addVariant('move_2', idx2);

  // Passo 10 a 190: carrega Reflect (slot 0) por 180 passos (1,5 s de carga mínima) e solta no passo 190
  run(ch, g, 210, t => {
    const c = cmd();
    if (t === 10) c.skill = 0;
    c.skillHeld = [t >= 10 && t < 190, false, false, false];
    return [c, cmd()];
  });
  const m1 = entries(ch, 'release_reflect').concat(entries(ch, 'move_1'));
  check('disparo entra ao soltar a carga do Reflect', m1.length >= 1, `${m1.length} entradas`);
  check('disparo toca o clipe associado ao Reflect', m1[0]?.clipTo === 'Special Move 1', m1[0]?.clipTo);

  // Passo 10 a 20 da próxima bateria: carrega Psyshock (slot 1) e solta no passo 20
  run(ch, g, 40, t => {
    const c = cmd();
    if (t === 10) c.skill = 1;
    c.skillHeld = [false, t >= 10 && t < 20, false, false];
    return [c, cmd()];
  });
  const m2 = entries(ch, 'release_psyshock').concat(entries(ch, 'move_2'));
  check('disparo entra ao soltar a carga do Psyshock', m2.length >= 1, `${m2.length} entradas`);
  check('disparo toca o clipe associado ao Psyshock', m2[0]?.clipTo === 'Special Move 2', m2[0]?.clipTo);
});
test('movimentos especiais na aba moves: carga com loop configurável e disparo', () => {
  registerStandardMoves();
  const chargeClip = clip('Charge Loopable', 1.0, 20);
  const releaseClip = clip('Release Blast', 0.5, 30);
  const src = makeSource([chargeClip, releaseClip]);
  const {ch, g} = setup(src);
  g.setLoadout(0, ['reflect', 'psyshock', null, null]);

  const chargeIdx = src.animations.indexOf(chargeClip);
  const releaseIdx = src.animations.indexOf(releaseClip);

  // Configura carga com ponto de loop em 0.4s e disparo
  ch.setMoveAnim('reflect', 'charge', chargeIdx);
  ch.setMoveChargeLoopStart('reflect', 0.40);
  ch.setMoveAnim('reflect', 'release', releaseIdx);

  // Segura a carga por 180 passos (1.5 segundos):
  const keys = run(ch, g, 180, t => {
    const c = cmd();
    if (t === 0) c.skill = 0;
    c.skillHeld = [true, false, false, false];
    return [c, cmd()];
  });

  const chargeSamples = keys.filter(k => k.key === 'charge_reflect');
  check('estado charge_reflect ativo durante a carga', chargeSamples.length > 100, `${chargeSamples.length}`);
  check('tempo no passo 60 está em torno de 0.5s', Math.abs(chargeSamples[60].time - 0.5) < 0.05, `${chargeSamples[60]?.time}`);

  // Após 1.0s (passo 144 = 1.2s total = 0.2s após completar 1.0s), deve estar em 0.4s + 0.2s = 0.6s
  const sampleAfter1s = chargeSamples[144];
  check('após 1.0s o clipe fez loop a partir de 0.4s (esperado ~0.6s)', Math.abs(sampleAfter1s.time - 0.60) < 0.05, `${sampleAfter1s?.time}`);

  // Solta a carga e verifica o disparo
  run(ch, g, 30, () => [cmd({skillHeld: [false, false, false, false]}), cmd()]);
  const relEntries = entries(ch, 'release_reflect');
  check('release_reflect entra ao soltar a tecla', relEntries.length >= 1);
  check('release_reflect toca o clipe Release Blast', relEntries[0]?.clipTo === 'Release Blast', relEntries[0]?.clipTo);

  // Testar prévia integrada (startMovePreview / stopMovePreview)
  check('startMovePreview inicia a prévia da sequência', ch.startMovePreview('reflect'));
  check('prévia em fase de carga', ch.movePreview?.phase === 'charge');
  ch.stopMovePreview();
  check('stopMovePreview encerra a prévia', ch.movePreview === null);

  // O fim do ciclo pode ocorrer antes do fim do clipe: 0–0,4 intro, 0,4–0,7 loop, 0,7–1,0 fora do ciclo.
  const {ch: ranged, g: rangedGame} = setup(src);
  rangedGame.setLoadout(0, ['reflect', 'psyshock', null, null]);
  ranged.setMoveAnim('reflect', 'charge', chargeIdx);
  ranged.setMoveChargeLoopStart('reflect', 0.4);
  ranged.setMoveChargeLoopEnd('reflect', 0.7);
  const rangedKeys = run(ranged, rangedGame, 115, t => {
    const c = cmd();if (t === 0) c.skill = 0;c.skillHeld = [true, false, false, false];return [c, cmd()];
  }).filter(k => k.key === 'charge_reflect');
  check('loop inicia antes de acabar o clipe', Math.abs(rangedKeys[96]?.time - 0.5) < 0.05, `${rangedKeys[96]?.time}`);
  check('fim configurado é salvo no estado portátil', ranged.stateData().moveAnims.reflect.chargeLoopEnd === 0.7);
  ranged.setMoveChargeLoopEnd('reflect', 0.3);
  check('intervalo permanece válido ao antecipar o fim', ranged.getMoveAnimConfig('reflect').chargeLoopStart <= 0.28 + 1e-8);
});
writeFileSync(out + 'animation-report.json', JSON.stringify({createdAt: new Date().toISOString(), checks: report}, null, 2));
console.log(`\n${passed} testes de animação aprovados · ${report.length} verificações.`);
