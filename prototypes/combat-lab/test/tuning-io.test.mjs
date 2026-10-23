// Exportação/importação dos parâmetros sem controle no Ajustes (Moves em world.*, etc.): o que foi alterado precisa sair em «changedFromLabDefaults» e voltar na importação.
// Origem: o export da calibração v8 trazia riposte/bulletPunch alterados só em `values`, fora de `changedFromLabDefaults` («parâmetros modificados em ações não exportados»).
// Uso: node prototypes/combat-lab/test/tuning-io.test.mjs
import assert from 'node:assert/strict';
import {C, defaults, resetConfig, ROOT_KEYS} from '../src/sim/config.js';
import {changedOutsideManifest, importOutsideManifest} from '../src/ui/tuning-io.js';

let n = 0;const ok = l => {n++;console.log('✓', l);};
const roots = o => Object.fromEntries(ROOT_KEYS.map(k => [k, o[k]]));
resetConfig(defaults());
const base = defaults(), none = new Set();

C.world.riposte.cooldown = 3.5;C.world.bulletPunch.reach = 4.25;C.actions.tackle.duration = 1.1;C.world.swift.count = 5;
{
  const out = changedOutsideManifest(roots(C), roots(base), none), paths = out.map(x => x.path);
  for (const p of ['world.riposte.cooldown', 'world.bulletPunch.reach', 'actions.tackle.duration', 'world.swift.count']) assert.ok(paths.includes(p), p);
  const r = out.find(x => x.path === 'world.riposte.cooldown');assert.equal(r.value, 3.5);assert.equal(r.lab, base.world.riposte.cooldown);
  assert.equal(out.length, 4, 'só o que mudou');
}
ok('todo parâmetro numérico alterado (Moves e ações) sai em changedFromLabDefaults, com valor padrão e valor atual');
{
  const inManifest = new Set(['actions.tackle.duration']);
  assert.ok(!changedOutsideManifest(roots(C), roots(base), inManifest).some(x => x.path === 'actions.tackle.duration'), 'o que o Ajustes já lista não duplica');
}
ok('o que o manifesto do Ajustes já lista não é duplicado');
{
  const exported = JSON.parse(JSON.stringify(roots(C)));
  resetConfig(defaults());
  const imp = importOutsideManifest(exported ? flatFrom(exported) : {}, roots(base), roots(C), none);
  const paths = imp.changes.map(c => c[0]);
  for (const p of ['world.riposte.cooldown', 'world.bulletPunch.reach', 'actions.tackle.duration', 'world.swift.count']) assert.ok(paths.includes(p), p);
  assert.equal(imp.invalid.length, 0);
}
ok('a importação devolve os mesmos parâmetros (ida e volta)');
{
  const imp = importOutsideManifest({'world.riposte.cooldown': NaN, 'world.inexistente.x': 3, 'world.riposte.cast': 0.9}, roots(base), roots(C), none);
  assert.deepEqual(imp.invalid, ['world.riposte.cooldown = NaN']);assert.deepEqual(imp.changes, [['world.riposte.cast', 0.9]]);
}
ok('valores inválidos são recusados com o motivo; caminhos que não existem no padrão são ignorados');

function flatFrom(obj, prefix = '', out = {}) {for (const [k, v] of Object.entries(obj)) {const p = prefix ? prefix + '.' + k : k;if (typeof v === 'number') out[p] = v;else if (v && typeof v === 'object' && !Array.isArray(v)) flatFrom(v, p, out);}return out;}
resetConfig(defaults());
console.log(`\n${n} verificações do export/import de parâmetros fora do Ajustes aprovadas.`);
