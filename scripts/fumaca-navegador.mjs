// Teste de fumaça de navegador do laboratório: roda em sequência os testes de navegador que exercitam a montagem do main.js
// (abertura, painéis, workspace, Moves, passivas, pré-jogo) e imprime o tempo e o resultado de cada um.
//   node scripts/fumaca-navegador.mjs            -> conjunto padrão
// As imagens de evidência regravadas pelos testes são restauradas ao final (git checkout das pastas evidence/).
import {spawnSync} from 'node:child_process';
const SET = ['verify', 'overhaul', 'workspace', 'tools', 'moves-ui', 'passives', 'prejogo', 'calibration', 'move-editor', 'move-showcase'];
const files = SET.map(n => n === 'verify' ? 'prototypes/combat-lab/verify.mjs' : `prototypes/combat-lab/test/${n}.browser.mjs`);
let bad = 0;
for (const f of files) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [f], {encoding: 'utf8', timeout: 280000, env: {...process.env, ARENAMON_SKIP_SCREENSHOTS: '1'}});
  const ok = r.status === 0;
  if (!ok) bad++;
  console.log(`${ok ? 'ok    ' : 'FALHA '} ${((Date.now() - t0) / 1000).toFixed(0).padStart(3)}s  ${f}${ok ? '' : '\n' + (r.stdout + r.stderr).split('\n').slice(-6).join('\n')}`);
}
spawnSync('git', ['checkout', '--', 'prototypes/combat-lab/evidence', 'prototypes/combat-lab/validation'], {stdio: 'ignore'});
console.log(bad ? `${bad} falha(s)` : 'fumaça de navegador: tudo certo');
process.exit(bad ? 1 : 0);
