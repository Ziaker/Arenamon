// Editor de Moves: (1) gravações simultâneas do MESMO arquivo são serializadas (nenhuma atualização se perde; a segunda recebe 409 pelo hash);
// (2) o Editor não grava Move que o motor recusaria ao registrar (duração/custo/recarga negativos, janela de invulnerabilidade invertida, evento fora da duração…),
// com HTTP 422 e o arquivo original intacto; (3) paridade: tudo que validateMoveMechanics recusa, validateMove (moves.js) também recusa.
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, copyFileSync, readFileSync, readdirSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {startDevServer} from '../dev-server.mjs';
import {validateMoveMechanics} from '../src/sim/moves/move-data.js';
import {validateMove} from '../src/sim/moves.js';
import '../src/sim/config.js';

const here = fileURLToPath(new URL('..', import.meta.url));
const real = join(here, 'src/sim/moves');
const tmp = mkdtempSync(join(tmpdir(), 'arenamon-conc-')), movesDir = join(tmp, 'moves'), approvedDir = join(tmp, 'approved');
mkdirSync(movesDir);mkdirSync(approvedDir);
copyFileSync(join(real, 'harden.move.json'), join(movesDir, 'harden.move.json'));
const file = join(movesDir, 'harden.move.json');
const srv = await startDevServer({port: 0, quiet: true, watchFiles: false, movesDir, approvedDir}), base = `http://127.0.0.1:${srv.port}`;
let n = 0;const ok = l => {n++;console.log('✓', l);};
const get = async () => (await (await fetch(base + '/api/moves/harden')).json());
const put = body => fetch(base + '/api/moves/harden', {method: 'PUT', body: JSON.stringify(body), headers: {origin: base}});
try {
  const r0 = await get(), before = readFileSync(file, 'utf8');
  // 1) duas gravações simultâneas com o MESMO hash: uma vence (200), a outra perde (409) — nunca as duas «ganham» e uma some
  const mk = cost => ({confirm: true, expectHash: r0.hash, doc: {...r0.doc, def: {...r0.doc.def, cost}}});
  const [a, b] = await Promise.all([put(mk(.5)), put(mk(.6))]);
  const sts = [a.status, b.status].sort();
  assert.deepEqual(sts, [200, 409], 'uma grava e a outra é recusada pelo hash: ' + sts);
  const onDisk = JSON.parse(readFileSync(file, 'utf8'));
  assert.ok([.5, .6].includes(onDisk.def.cost), 'o arquivo ficou com UMA das duas versões inteiras');
  assert.equal(readdirSync(movesDir).filter(f => f.endsWith('.tmp')).length, 0, 'nenhum .tmp sobra');
  ok('gravações simultâneas do mesmo arquivo: uma 200, outra 409; arquivo íntegro e sem .tmp');
  // 1b) várias em série encadeadas pelo hash novo funcionam
  let hash = (await get()).hash;
  for (const c of [.7, .8, .9]) {const r = await put({confirm: true, expectHash: hash, doc: {...onDisk, def: {...onDisk.def, cost: c}}});assert.equal(r.status, 200);hash = (await r.json()).hash;}
  ok('gravações encadeadas com o hash novo continuam funcionando');
  // 2) o Editor recusa o que o motor recusaria
  const cur = await get(), good = readFileSync(file, 'utf8');
  const ruins = {'duração negativa': {duration: -1}, 'custo negativo': {cost: -2}, 'recarga negativa': {cooldown: -1}, 'invulnerabilidade invertida': {invulnerable: [.5, .1]}, 'evento fora da duração': {timeline: [{at: 99, effect: 'x'}]}, 'aim desconhecido': {aim: 'banana'}};
  for (const [nome, patch] of Object.entries(ruins)) {
    const r = await put({confirm: true, expectHash: cur.hash, doc: {...cur.doc, def: {...cur.doc.def, ...patch}}});
    assert.equal(r.status, 422, `${nome}: esperava 422 e veio ${r.status}`);
    assert.equal(readFileSync(file, 'utf8'), good, `${nome}: o arquivo original ficou intacto`);
    // paridade com o motor
    const mecanica = validateMoveMechanics({...cur.doc.def, ...patch});
    assert.ok(mecanica.length, `${nome}: validateMoveMechanics recusa`);
    assert.throws(() => validateMove({...cur.doc.def, ...patch}), `${nome}: validateMove (motor) também recusa`);
  }
  ok('Move inválido para o motor: 422 e arquivo intacto; validateMoveMechanics e validateMove recusam os mesmos casos');
} finally {
  await srv.close();
  rmSync(tmp, {recursive: true, force: true});
}
console.log(`${n} verificações da gravação concorrente e das regras do motor aprovadas.`);
