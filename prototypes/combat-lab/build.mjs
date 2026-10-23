// Gera os HTMLs únicos e offline: dist/arenamon-combate-laboratorio.html (laboratório),
// dist/arenamon-painel-relatorios.html (painel externo) e dist/arenamon-vfx-quarks.html
// (laboratório three.quarks de VFX) dist/arenamon-navegacao-yuka.html (laboratório de navegação Yuka) e dist/arenamon-posprocessamento.html (laboratório de pós-processamento).
import {writeFile, mkdir} from 'node:fs/promises';
import {buildElementalLab, buildLab, buildReportsPanel, buildQuarksLab, buildNavLab, buildPostLab, buildPhysicsLab, OUTPUTS} from './build-lib.mjs';

import {writeIndex} from './gen-fichas.mjs';
writeIndex();   // índice automático das fichas de Moves (src/sim/moves/fichas.generated.js)

const root = new URL('.', import.meta.url);
await mkdir(new URL('dist/', root), {recursive: true});
const [lab, reports, quarks, nav, post, physics] = await Promise.all([buildLab(), buildReportsPanel(), buildQuarksLab(), buildNavLab(), buildPostLab(), buildPhysicsLab()]);
await writeFile(new URL(OUTPUTS.lab, root), lab);
await writeFile(new URL(OUTPUTS.reports, root), reports);
await writeFile(new URL(OUTPUTS.quarks, root), quarks);
await writeFile(new URL(OUTPUTS.nav, root), nav);
await writeFile(new URL(OUTPUTS.post, root), post);
await writeFile(new URL(OUTPUTS.physics, root), physics);
console.log(`laboratório: ${(lab.length / 1024).toFixed(0)} KB · painel de relatórios: ${(reports.length / 1024).toFixed(0)} KB · quarks VFX: ${(quarks.length / 1024).toFixed(0)} KB · navegação Yuka: ${(nav.length / 1024).toFixed(0)} KB · pós-processamento: ${(post.length / 1024).toFixed(0)} KB · física Rapier: ${(physics.length / 1024).toFixed(0)} KB`);

await writeFile(new URL("dist/arenamon-elementais-quarks.html", root), await buildElementalLab());
