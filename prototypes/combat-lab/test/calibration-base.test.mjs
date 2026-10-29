// Base de calibração v8 (decisão do responsável, 22/10/2026): arenamon-calibracao-v8 (1).json + config-ts-proposta.patch viram o PADRÃO do laboratório/jogo.
// Garante: (1) a tabela só toca parâmetros que existem; (2) o «valor anterior» de cada linha é o valor de fábrica real (reversível linha a linha);
// (3) defaults() = fábrica + tabela, sem nenhuma outra diferença; (4) valores-chave conferem com o JSON do responsável; (5) o config.ts do jogo traz o patch;
// (6) a base é jogável: partidas IA × IA sem NaN, e os 15 cenários de colisão passam nesta base.
// Uso: node prototypes/combat-lab/test/calibration-base.test.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {C, defaults, factoryDefaults, resetConfig} from '../src/sim/config.js';
import {CALIBRATION_BASE} from '../src/sim/calibration-base.js';
import {Game} from '../src/sim/game.js';
import {COLLISION_SCENARIOS} from '../src/sim/scenarios-collision.js';
import {runScenario} from '../src/sim/scenarios.js';
import {registerStandardMoves} from '../src/sim/moves/standard.js';

registerStandardMoves();
let n = 0;const ok = l => {n++;console.log('✓', l);};
const get = (o, path) => path.split('.').reduce((a, k) => a?.[k], o);
const flat = (o, p = '', out = {}) => {for (const [k, v] of Object.entries(o)) {const q = p ? p + '.' + k : k;if (v && typeof v === 'object' && !Array.isArray(v)) flat(v, q, out);else out[q] = v;}return out;};
const fac = factoryDefaults(), base = defaults();

assert.equal(CALIBRATION_BASE.length, 186);ok('a tabela tem as 186 linhas (168 do export de 28/10 + 18 pedidos diretos de 29/10: empurrão constante do Sand Wave, Air Slash mais visível e Bullet Punch clássico) — antes: 168 linhas (1ª exportação de 21/10 + 2ª de 22/10 12:12 − 4 do marcador do Bullet Punch = 180; 3ª de 28/10, gerada por scripts/gen-calibration-base.mjs: troca 12 valores, acrescenta 4 e retira 16 linhas sem efeito, cujo valor novo era o de fábrica)');
for (const [path, value, old] of CALIBRATION_BASE) {
  assert.notEqual(get(fac, path), undefined, `parâmetro inexistente: ${path}`);
  assert.deepEqual(get(fac, path), old, `valor anterior de ${path} não é o de fábrica`);
  assert.deepEqual(get(base, path), value, `${path} não aplicado`);
}
ok('cada linha: o parâmetro existe, o valor anterior é o de fábrica e o valor novo é o padrão atual');
{
  const F = flat(fac), B = flat(base), listed = new Set(CALIBRATION_BASE.map(r => r[0])), extra = Object.keys(B).filter(k => !listed.has(k) && JSON.stringify(B[k]) !== JSON.stringify(F[k]));
  assert.deepEqual(extra, [], `diferenças fora da tabela: ${extra.slice(0, 5)}`);
}
ok('defaults() = fábrica + tabela; nenhuma outra diferença');
{
  resetConfig(defaults());
  const want = {'rules.staminaMax': 23.1, 'rules.regenTime': 1.4, 'rules.regenDelay': 0, 'rules.recoil': 0.61, 'rules.guardStun': 0.505, 'rules.landingRecovery': 0.467, 'rules.chargeTackleMove': 0.9, 'rules.chargeTackleSpeed2': 1.94, 'rules.chargeTackleSpeed3': 2.71, 'rules.tackleFriction1': 1.1, 'rules.tackleFriction3': 1,
    'extras.visual.smear.smearOpacity': 0.75, 'extras.visual.smear.smearColorMode': 1, 'extras.visual.squashStretch.dodgeSquashScale': 1.3, 'test.arenaRadius': 50,
    'rules.recoilFraction': 0.8, 'rules.perfect': 0.34, 'extras.combat.perfectGuardCounterWindow': 1.98, 'vfx.hit.size': 2.23, 'rules.launchGravity': 39.6, 'actions.tackle.duration': 1.143, 'actions.tackle.distance': 1.55, 'actions.dodge.duration': 0.657, 'actions.dodge.distance': 2.05, 'test.arenaHalf': 16, 'profiles.balanced.speed': 4.19, 'profiles.agile.speed': 6, 'profiles.resistant.speed': 4.08,
    'locomotion.acceleration': 40, 'locomotion.braking': 34, 'locomotion.reversal': 62, 'camera.maxDistance': 24, 'camera.closeRange': 1.3, 'map.jumpHeight': 2.4, 'map.jumpAirControl': 0.85, 'map.footstoolBounce': 11.1, 'extras.ai.revision': 1, 'world.riposte.cooldown': 8, 'world.riposte.cost': 1.55, 'world.riposte.knockbackH': 16.8, 'world.bulletPunch.impactMult': 2.6};
  for (const [p, v] of Object.entries(want)) assert.equal(get(C, p), v, p);
}
{
  // 3ª exportação (28/10/2026): defaults() reproduz o JSON do responsável folha a folha (números com tolerância de ruído; arrays/textos por valor).
  const json = JSON.parse(readFileSync(fileURLToPath(new URL('../../../docs/calibracao/arenamon-calibracao-v8-2026-10-28.json', import.meta.url)), 'utf8')).values;
  const AJUSTES_POSTERIORES = new Set(['world.sandWave.pushSpeed', 'world.sandWave.pushMaxSpeed', 'world.bulletPunch.atelierVfx']);   // + Air Slash mais visível (prefixo abaixo)   // 29/10: pedido direto do responsável (empurrão constante), depois do export
  const J = flat(json), B = flat(base), diff = Object.keys(J).filter(k => !AJUSTES_POSTERIORES.has(k) && !k.startsWith('vfx.elemental.visual.airSlash') && (typeof J[k] === 'number' ? !(Math.abs(J[k] - B[k]) <= 1e-12 * Math.max(1, Math.abs(J[k]))) : JSON.stringify(J[k]) !== JSON.stringify(B[k])));
  assert.deepEqual(diff, [], `defaults() difere do JSON de 28/10: ${diff.slice(0, 5)}`);
}
ok('defaults() = arenamon-calibracao-v8-2026-10-28.json em todas as folhas de values');
ok('valores-chave do JSON do responsável (3ª exportação 28/10: stamina 23,1 · regen 1,4 s sem espera · recuo 0,61 · guard stun 0,505 · pouso 0,467 · Tackle 1,143 s/1,55 m · esquiva 0,657 s/2,05 m · gravidade de lançamento 39,6 · perfis · locomoção · câmera · salto 2,3 · IA revisão 1 · Riposte · Bullet Punch)');
{
  const text = readFileSync(fileURLToPath(new URL('../../game/src/config.ts', import.meta.url)), 'utf8');
  for (const re of [/recoil: \.514, recoilFraction: \.8, blend: \.1, guardStun: \.514/, /perfect: \.34, perfectCooldown: 2, staminaMax: 11\.1, regenDelay: 1, regenTime: 4/, /arenaHalf: 16/, /speed: 4\.8/, /acceleration: 40, braking: 34, reversal: 62/, /maxDistance: 24/, /balanced: \{ attack: TEST\.attack, defense: TEST\.defense, speed: 4\.19/, /agile: \{ attack: 16, defense: 35, speed: 6,/, /resistant: \{ attack: 24, defense: 80, speed: 4\.08,/]) assert.match(text, re, String(re));
  assert.match(text, /dodge: \.4, invulnerable: \.2/, 'tempos aprovados (esquiva 0,4 s) NÃO mudam no config.ts: só a calibração provisória');
}
ok('prototypes/game/src/config.ts traz o patch de proposta (calibração provisória) e preserva os tempos aprovados');
{
  for (let seed = 1; seed <= 6; seed++) {
    resetConfig(defaults());const g = new Game({seed});g.start();g.mode = 'tactical';C.extras.toggles.enablePlayerAI = 1;
    for (let t = 0; t < 2400 && g.phase === 'playing'; t++) {
      g.step(g.playerBrain.command(g.fighters[0], g.fighters[1], 'tactical', C.test.step));
      for (const f of g.fighters) assert.ok([f.position.x, f.position.z, f.groundY, f.hp, f.stamina].every(Number.isFinite), `NaN: seed ${seed} t${t}`);
    }
  }
}
ok('base jogável: 6 partidas IA × IA de 20 s sem NaN');
for (const def of COLLISION_SCENARIOS) {
  resetConfig(defaults());const r = runScenario(def), bad = r.checks.filter(c => !c.ok);
  assert.equal(bad.length, 0, `${def.id}: ${bad.map(b => b.label).join('; ')}`);
}
ok('os 15 cenários de colisão passam na base de calibração');
resetConfig(defaults());
console.log(`\n${n} verificações da base de calibração v8 aprovadas.`);
