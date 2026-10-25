// @ts-check
// Captura de bug reproduzível (#11): pacote completo, ida e volta em JSON, recusa de pacotes inválidos e aviso de configuração/versão diferentes.
import {assert, C, Game, suite, arena, cmd, vec} from './moves-new-helpers.mjs';
import {MatchRecording} from '../src/sim/recording.js';
import {captureBug, parseBugCapture, reproduceBugCapture, encodeBug, BUG_SCHEMA} from '../src/sim/bug-capture.js';

const {test, done} = suite('CAPTURA DE BUG');

/** Mesma cena de arena() (sem obstáculos, azul voltado para +z, IA do vermelho desligada) para a reexecução. */
const sceneSetup = g => {C.extras.toggles.enableEnemyAI = 0;g.mapState.platforms = [];g.mapState.obstacles = [];g.mapState.destructibles = [];g.mapState.items = [];g.mapState.regularSpawnTimer = 1e9;g.fighters[0].facing = 0;g.fighters[1].facing = Math.PI;};

/** Joga 240 passos com Tackle e Quick Attack, gravando como o laboratório (comandos do azul por tick). */
function play() {
  const g = arena({equip: ['quick-attack'], positions: [vec(0, -.9), vec(0, .9)]});
  const rec = new MatchRecording();
  rec.start({seed: 3, positions: [vec(0, -.9), vec(0, .9)], profile: g.profile, enemyProfile: g.enemyProfile, mode: g.mode, values: {}, loadouts: g.passiveLoadouts, identity: g.passiveIdentity});
  for (let t = 0; t < 240; t++) {
    const c = cmd({tackle: t === 0, skill: t === 40 ? 0 : -1, skillHeld: [t >= 40 && t < 42, false, false, false]});
    const before = g.tick;g.step(c, cmd());if (g.tick > before) rec.record(before, c, undefined);
  }
  return {g, rec};
}

test('o pacote reúne semente, comandos, snapshot, equipamento, eventos e erros', () => {
  const {g, rec} = play();
  const cap = captureBug({game: g, recording: rec, appVersion: 'v1.27.0', note: 'o Quick Attack não acertou', errors: ['Erro de teste']});
  assert.equal(cap.schema, BUG_SCHEMA);assert.equal(cap.tick, g.tick);assert.equal(cap.seed, 3);
  assert.equal(cap.moveLoadouts[0][0], 'quick-attack');
  assert.ok(cap.recording.commands.length > 0 && cap.snapshot.fighters.length === 2);
  assert.ok(cap.recentEvents.length > 0 && cap.fighters[0].loadout.includes('quick-attack'));
  assert.deepEqual(cap.errors, ['Erro de teste']);assert.ok(cap.configHash.length === 8);
  assert.ok(!/userAgent|navigator|localStorage/.test(JSON.stringify(cap)), 'sem dados do ambiente do usuário');
});
test('imagem da tela só entra quando pedida e só como data URL de imagem', () => {
  const {g, rec} = play();
  assert.equal('screenshot' in captureBug({game: g, recording: rec}), false);
  const img = 'data:image/jpeg;base64,/9j/AA==';
  assert.equal(captureBug({game: g, recording: rec, screenshot: img}).screenshot, img);
  assert.equal('screenshot' in captureBug({game: g, recording: rec, screenshot: 'file:///C:/Users/x.png'}), false);
  assert.equal(parseBugCapture(encodeBug(captureBug({game: g, recording: rec, screenshot: img}))).error, undefined);
});
test('ida e volta em JSON preserva o estado e reproduz o instante capturado', () => {
  const {g, rec} = play();
  const text = encodeBug(captureBug({game: g, recording: rec, appVersion: 'v1.27.0'}));
  const parsed = parseBugCapture(text);
  assert.ok(!parsed.error, parsed.error);
  const fresh = new Game({seed: 1});
  const out = reproduceBugCapture(parsed.data, fresh, {appVersion: 'v1.27.0', setup: sceneSetup});
  assert.equal(fresh.tick, g.tick);assert.deepEqual(fresh.fighters.map(f => f.hp), g.fighters.map(f => f.hp));
  assert.equal(out.replayMatches, true, JSON.stringify(out.divergence));
  assert.deepEqual(out.warnings, []);
});
test('configuração ou versão diferentes são anunciadas', () => {
  const {g, rec} = play();
  const parsed = parseBugCapture(encodeBug(captureBug({game: g, recording: rec, appVersion: 'v1.27.0'})));
  C.rules.guardStun += .2;
  const out = reproduceBugCapture(parsed.data, new Game({seed: 1}), {appVersion: 'v1.28.0', verify: false});
  assert.equal(out.warnings.length, 2);
  assert.ok(out.warnings.some(w => /configuração atual é diferente/.test(w)) && out.warnings.some(w => /Versão diferente/.test(w)));
});
test('pacotes inválidos são recusados com a causa', () => {
  assert.match(parseBugCapture('não é json').error, /JSON inválido/);
  assert.match(parseBugCapture({schema: 'outra-coisa'}).error, /Não é uma captura/);
  assert.match(parseBugCapture({schema: BUG_SCHEMA, version: 0}).error, /Versão de captura inválida/);
  assert.match(parseBugCapture({schema: BUG_SCHEMA, version: 99}).error, /até a 1/);
  assert.match(parseBugCapture({schema: BUG_SCHEMA, version: 1}).error, /incompleta/);
});

done();
