// Regra do repositório (AGENTS.md): nenhum arquivo-fonte de código passa de 2.000 linhas; 1.200 é o alerta de modularização.
// Fiscaliza só o que se edita à mão: arquivos gerados/compilados e dados (json, evidências, dist) ficam de fora, com a lista aberta abaixo.
// Uso: node scripts/check-tamanho.mjs [--lista]   (sai com código 1 se algum arquivo passar do limite)
import {execFileSync} from 'node:child_process';
import {readFileSync, existsSync} from 'node:fs';

const LIMITE = 2000, ALERTA = 1200;
const CODIGO = /\.(js|mjs|cjs|ts|tsx|py|css|bat|ps1|sh)$/i;
/** Gerados, embutidos ou de dados: não são código-fonte editável. Cada entrada diz por quê. */
const EXCECOES = [
  [/(^|\/)dist\//, 'compilado'],
  [/\.generated\.(js|mjs|ts)$/, 'gerado por script'],
  [/(^|\/)evidence\//, 'evidências (capturas/relatórios)'],
  [/(^|\/)prototypes\/studio\/proposals\/proposta-[abc]\.html$/, 'HTML gerado por proposals/build.mjs (Three.js/CSS/JS embutidos, offline por desenho)'],
  [/(^|\/)test\/replays\//, 'replays de referência (dados)'],
  [/(^|\/)package-lock\.json$/, 'lockfile'],
  [/(^|\/)vendor\//, 'dependência de terceiros copiada'],
];
const excecao = f => EXCECOES.find(([re]) => re.test(f))?.[1] ?? null;
const arquivos = execFileSync('git', ['ls-files', '-z'], {encoding: 'utf8', maxBuffer: 1 << 28}).split('\0').filter(f => f && CODIGO.test(f) && existsSync(f));
const linhas = f => {const t = readFileSync(f, 'utf8');return t.length ? t.split('\n').length - (t.endsWith('\n') ? 1 : 0) : 0;};
const medidos = arquivos.map(f => ({f, n: linhas(f), ex: excecao(f)})).sort((a, b) => b.n - a.n);
const estouro = medidos.filter(m => m.n > LIMITE && !m.ex), alerta = medidos.filter(m => m.n > ALERTA && m.n <= LIMITE && !m.ex), isentos = medidos.filter(m => m.n > LIMITE && m.ex);
if (process.argv.includes('--lista')) for (const m of medidos.slice(0, 25)) console.log(String(m.n).padStart(6), m.f, m.ex ? `(isento: ${m.ex})` : '');
for (const m of isentos) console.log(`isento  ${m.n} linhas  ${m.f}  — ${m.ex}`);
for (const m of alerta) console.log(`ALERTA  ${m.n} linhas  ${m.f}  — acima de ${ALERTA}: avalie dividir por responsabilidade`);
for (const m of estouro) console.error(`FALHA   ${m.n} linhas  ${m.f}  — passa de ${LIMITE}: divida por funcionalidade real (sem comprimir linhas nem criar um módulo central gigante)`);
console.log(`${medidos.length} arquivos de código medidos · limite ${LIMITE} · ${estouro.length} acima do limite · ${alerta.length} em alerta`);
process.exit(estouro.length ? 1 : 0);
