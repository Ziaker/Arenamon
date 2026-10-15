// Gera os HTMLs únicos e offline: dist/arenamon-combate-laboratorio.html (laboratório) e
// dist/arenamon-painel-relatorios.html (painel externo de relatórios, complementar).
import {writeFile, mkdir} from 'node:fs/promises';
import {buildLab, buildReportsPanel, OUTPUTS} from './build-lib.mjs';

const root = new URL('.', import.meta.url);
await mkdir(new URL('dist/', root), {recursive: true});
const [lab, reports] = await Promise.all([buildLab(), buildReportsPanel()]);
await writeFile(new URL(OUTPUTS.lab, root), lab);await writeFile(new URL(OUTPUTS.reports, root), reports);
console.log(`laboratório: ${(lab.length / 1024).toFixed(0)} KB · painel de relatórios: ${(reports.length / 1024).toFixed(0)} KB`);
