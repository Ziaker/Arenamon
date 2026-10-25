// Gera os HTMLs únicos e offline: dist/arenamon-combate-laboratorio.html (laboratório),
// dist/arenamon-painel-relatorios.html (painel externo) e dist/arenamon-vfx-quarks.html
// (laboratório three.quarks de VFX) dist/arenamon-navegacao-yuka.html (laboratório de navegação Yuka) e dist/arenamon-posprocessamento.html (laboratório de pós-processamento).
import {writeFile, mkdir, readFile} from 'node:fs/promises';
import {buildElementalLab, buildLab, buildReportsPanel, buildQuarksLab, buildNavLab, buildPostLab, buildPhysicsLab, OUTPUTS} from './build-lib.mjs';

import {writeIndex} from './gen-fichas.mjs';
writeIndex();   // índice automático das fichas de Moves (src/sim/moves/fichas.generated.js)

const root = new URL('.', import.meta.url);
await mkdir(new URL('dist/', root), {recursive: true});

// Trava (pedido de 25/10/2026): nunca trocar um jogo compilado MAIS NOVO por um mais antigo. Acontecia quando a pasta principal estava numa branch
// atrasada (ex.: a do Eggo) e o vigia/build recompilava por cima da versão recém-entregue. Forçar mesmo assim: ARENAMON_FORCAR_BUILD=1.
{
  const semver = s => (s ?? '0.0.0').split('.').map(Number);
  const newer = (a, b) => {const x = semver(a), y = semver(b);for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];return false;};
  const mine = JSON.parse(await readFile(new URL('../../package.json', root), 'utf8')).version;
  const current = (await readFile(new URL(OUTPUTS.lab, root), 'utf8').catch(() => '')).match(/Versão (\d+\.\d+\.\d+) · compilado/)?.[1];
  if (current && newer(current, mine) && process.env.ARENAMON_FORCAR_BUILD !== '1') {
    console.error(`Error: BUILD BLOQUEADO — o jogo em dist/ é a versão ${current} e este código é a ${mine} (mais antiga). Nada foi sobrescrito.\n` +
      `Atualize esta branch com a main (ou use ARENAMON_FORCAR_BUILD=1 para forçar).`);
    process.exit(2);
  }
}
const [lab, reports, quarks, nav, post, physics] = await Promise.all([buildLab(), buildReportsPanel(), buildQuarksLab(), buildNavLab(), buildPostLab(), buildPhysicsLab()]);
await writeFile(new URL(OUTPUTS.lab, root), lab);
await writeFile(new URL(OUTPUTS.reports, root), reports);
await writeFile(new URL(OUTPUTS.quarks, root), quarks);
await writeFile(new URL(OUTPUTS.nav, root), nav);
await writeFile(new URL(OUTPUTS.post, root), post);
await writeFile(new URL(OUTPUTS.physics, root), physics);
console.log(`laboratório: ${(lab.length / 1024).toFixed(0)} KB · painel de relatórios: ${(reports.length / 1024).toFixed(0)} KB · quarks VFX: ${(quarks.length / 1024).toFixed(0)} KB · navegação Yuka: ${(nav.length / 1024).toFixed(0)} KB · pós-processamento: ${(post.length / 1024).toFixed(0)} KB · física Rapier: ${(physics.length / 1024).toFixed(0)} KB`);

await writeFile(new URL("dist/arenamon-elementais-quarks.html", root), await buildElementalLab());
