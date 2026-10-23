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

assert.equal(CALIBRATION_BASE.length, 180);ok('a tabela tem as 180 linhas (1ª exportação de 21/10 + 2ª de 22/10 12:12, que sobrescreve 34 valores e acrescenta 26; menos 4 linhas do marcador do Bullet Punch, que deixou de existir em 22/10 tarde)');
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
  const want = {'rules.staminaMax': 11.1, 'rules.regenTime': 4, 'rules.recoilFraction': 0.8, 'rules.perfect': 0.34, 'extras.combat.perfectGuardCounterWindow': 1.98, 'vfx.hit.size': 2.23, 'rules.launchGravity': 39.6, 'actions.tackle.duration': 0.65, 'actions.tackle.distance': 1.55, 'actions.dodge.duration': 0.5, 'actions.dodge.distance': 2.05, 'test.arenaHalf': 16, 'profiles.balanced.speed': 4.19, 'profiles.agile.speed': 6, 'profiles.resistant.speed': 4.08,
    'locomotion.acceleration': 40, 'locomotion.braking': 34, 'locomotion.reversal': 62, 'camera.maxDistance': 24, 'camera.closeRange': 1.3, 'map.jumpHeight': 2.4, 'map.jumpAirControl': 0.85, 'map.footstoolBounce': 11.1, 'extras.ai.revision': 1, 'world.riposte.cooldown': 8, 'world.riposte.cost': 1.55, 'world.riposte.knockbackH': 16.8, 'world.bulletPunch.impactMult': 2.6};
  for (const [p, v] of Object.entries(want)) assert.equal(get(C, p), v, p);
}
ok('valores-chave do JSON do responsável (stamina 11,1 · regen 4 s · gravidade de lançamento 39,6 · Tackle 0,65 s/1,55 m · esquiva 0,5 s/2,05 m · perfis · locomoção · câmera · salto 2,3 · IA revisão 1 · Riposte · Bullet Punch)');
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
