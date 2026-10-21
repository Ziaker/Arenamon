// Gera os HTMLs únicos e offline: dist/arenamon-combate-laboratorio.html (laboratório),
// dist/arenamon-painel-relatorios.html (painel externo) e dist/arenamon-vfx-quarks.html
// (laboratório three.quarks de VFX).
import {writeFile, mkdir} from 'node:fs/promises';
import {buildLab, buildReportsPanel, buildQuarksLab, OUTPUTS} from './build-lib.mjs';

const root = new URL('.', import.meta.url);
await mkdir(new URL('dist/', root), {recursive: true});
const [lab, reports, quarks] = await Promise.all([buildLab(), buildReportsPanel(), buildQuarksLab()]);
await writeFile(new URL(OUTPUTS.lab, root), lab);
await writeFile(new URL(OUTPUTS.reports, root), reports);
await writeFile(new URL(OUTPUTS.quarks, root), quarks);
console.log(`laboratório: ${(lab.length / 1024).toFixed(0)} KB · painel de relatórios: ${(reports.length / 1024).toFixed(0)} KB · quarks VFX: ${(quarks.length / 1024).toFixed(0)} KB`);
