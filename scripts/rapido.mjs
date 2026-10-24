// Entrega rápida: roda em PARALELO (todos os núcleos) o build do combat-lab e os testes unitários.
//   node scripts/rapido.mjs            -> build + typecheck do lab + todos os *.test.mjs do combat-lab e sand-stone-lab
//   node scripts/rapido.mjs --sem-cache -> ignora o cache e roda tudo de novo
//   node scripts/rapido.mjs --tudo     -> inclui os testes lentos de IA/propriedades (≈5 min), rode antes de mexer em IA/regras
//   node scripts/rapido.mjs --so-build -> só o build (1-2 s), para ver a mudança no jogo na hora
//   node scripts/rapido.mjs --lento    -> também mostra os 10 testes mais lentos
// Os testes de navegador (*.browser.mjs) NÃO entram: rode só o que tocar, ex. node prototypes/combat-lab/test/ledge.browser.mjs
import {spawn} from 'node:child_process';
import {readdirSync, readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {build as esbuild} from 'esbuild';
import {cpus} from 'node:os';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const RETRY_FS = new URL('./retry-fs.mjs', import.meta.url).href;
const env = {...process.env, NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --import=${RETRY_FS}`.trim()};

const run = (cmd, argv) => new Promise(resolve => {
  const t0 = Date.now(); let out = '';
  const p = spawn(cmd, argv, {cwd: root, env, shell: false});
  p.stdout.on('data', d => out += d); p.stderr.on('data', d => out += d);
  p.on('close', code => resolve({code, out, ms: Date.now() - t0}));
  p.on('error', e => resolve({code: 1, out: String(e), ms: Date.now() - t0}));
});

const T0 = Date.now();
const node = process.execPath;

const build = await run(node, ['prototypes/combat-lab/build.mjs']);
console.log(`build combat-lab: ${build.code === 0 ? 'ok' : 'FALHOU'} (${(build.ms / 1000).toFixed(1)}s)`);
if (build.code) { console.log(build.out); process.exit(1); }
if (args.has('--so-build')) { console.log(`pronto em ${((Date.now() - T0) / 1000).toFixed(1)}s -> abra JOGAR_ARENAMON.html`); process.exit(0); }

const tests = [];
for (const dir of ['prototypes/combat-lab/test', 'prototypes/sand-stone-lab']) {
  let files = []; try { files = readdirSync(path.join(root, dir)); } catch {}
  for (const f of files) if (f.endsWith('.test.mjs')) tests.push(`${dir}/${f}`);
}
// Testes que levam de 50 s a 5 min (avaliação de IA, partidas simuladas longas). Só entram com --tudo.
const SLOW = /(ai-eval|ai-new-moves|ai-elemental|nav-ai|dead-controls|\/ai\.test|properties|limits)/;
const pool = args.has('--tudo') ? tests : tests.filter(t => !SLOW.test(t));

// Cache por dependência: o esbuild lista todos os arquivos que cada teste importa; se nenhum mudou desde a última
// passada, o teste é pulado. Só arquivos IMPORTADOS entram na conta (dados lidos em tempo de execução não: use --sem-cache).
const CACHE_FILE = path.join(root, 'node_modules/.cache/arenamon-testes.json');
let cache = {}; try {cache = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));} catch {}
async function fingerprint(test) {
  try {
    const r = await esbuild({entryPoints: [path.join(root, test)], bundle: true, write: false, metafile: true, platform: 'node', format: 'esm', packages: 'external', logLevel: 'silent', outdir: 'out'});
    const h = createHash('sha1');
    for (const f of Object.keys(r.metafile.inputs).sort()) h.update(f).update(readFileSync(path.join(root, f)));
    h.update(readFileSync(path.join(root, 'package.json'), 'utf8').match(/"version": "[^"]+"/)?.[0] ?? '');
    return h.digest('hex');
  } catch {return null;}
}
const useCache = !args.has('--sem-cache');
const prints = new Map();
let skipped = 0;
const fresh = [];
await Promise.all(pool.map(async t => {const fp = useCache ? await fingerprint(t) : null; prints.set(t, fp); if (fp && cache[t] === fp) skipped++; else fresh.push(t);}));
const jobs = [
  ['typecheck lab', node, [path.join(root, 'node_modules/typescript/bin/tsc'), '--noEmit', '-p', 'prototypes/combat-lab/tsconfig.json']],
  ...fresh.map(t => [t, node, [t]]),
];
// Os mais pesados primeiro (heurística: nomes de simulação/IA/física), o resto na ordem.
const heavy = /(sim|ai|perf|physics|collision|calibration|properties|bench)/;
jobs.sort((a, b) => (heavy.test(b[0]) ? 1 : 0) - (heavy.test(a[0]) ? 1 : 0));

const limit = Math.max(2, cpus().length - 1);
const done = []; let i = 0;
await Promise.all(Array.from({length: limit}, async () => {
  while (i < jobs.length) {
    const [name, cmd, argv] = jobs[i++];
    const r = await run(cmd, argv);
    done.push({name, ...r});
  }
}));

// Falha sob carga paralela pode ser só tempo: reexecuta as que falharam, uma por vez, antes de acusar.
for (const d of done.filter(x => x.code !== 0)) {
  const job = jobs.find(j => j[0] === d.name);
  const again = await run(job[1], job[2]);
  if (again.code === 0) { d.code = 0; d.flaky = true; }
}
for (const d of done) if (d.code === 0 && prints.get(d.name)) cache[d.name] = prints.get(d.name); else if (prints.has(d.name)) delete cache[d.name];
try {mkdirSync(path.dirname(CACHE_FILE), {recursive: true}); writeFileSync(CACHE_FILE, JSON.stringify(cache));} catch {}
const fail = done.filter(d => d.code !== 0);
const flaky = done.filter(d => d.flaky).map(d => d.name);
if (flaky.length) console.log(`(passaram na 2ª tentativa, instáveis sob carga: ${flaky.join(', ')})`);
for (const f of fail) console.log(`\n✗ ${f.name}\n${f.out.split('\n').slice(-25).join('\n')}`);
if (args.has('--lento')) for (const d of [...done].sort((a, b) => b.ms - a.ms).slice(0, 10)) console.log(`${(d.ms / 1000).toFixed(1)}s  ${d.name}`);
console.log(`\n${done.length - fail.length}/${done.length} ok em ${((Date.now() - T0) / 1000).toFixed(1)}s${fail.length ? ' — FALHAS: ' + fail.map(f => f.name).join(', ') : ''}`);
process.exit(fail.length ? 1 : 0);
