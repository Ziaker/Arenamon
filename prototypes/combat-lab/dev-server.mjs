// Servidor local OPCIONAL de desenvolvimento do laboratório. O HTML único e offline continua sendo a forma principal
// de jogar e testar (dist/arenamon-combate-laboratorio.html, por duplo clique); este servidor só acrescenta conforto:
//   • recompila ao salvar um arquivo de src/ (ou de reports/) e recarrega a página aberta;
//   • acesso CONTROLADO a pastas do projeto (lista, lê e grava só nas áreas abaixo, só extensões permitidas, sem
//     caminhos fora delas), para presets em JSON, modelos organizados em pastas e relatórios persistentes;
//   • base estável (http://127.0.0.1) para testes automatizados por navegador.
// Uso: npm run dev:combat-lab   (ou: node prototypes/combat-lab/dev-server.mjs --port 5173)
// Escuta só em 127.0.0.1 e recusa gravações vindas de outra origem. Nenhum serviço remoto é usado.
import {createServer} from 'node:http';
import {readFile, writeFile, readdir, stat, mkdir} from 'node:fs/promises';
import {watch} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join, resolve, relative, extname, sep} from 'node:path';
import {buildLab, buildReportsPanel} from './build-lib.mjs';
import {createMoveSaveApi} from './move-save-api.mjs';

const here = fileURLToPath(new URL('.', import.meta.url)), repo = resolve(here, '../..');
/** Áreas acessíveis (reaproveitam as pastas que o projeto já tem: modelos ficam em chars/, ignorada pelo Git). */
export const AREAS = {
  presets: {dir: join(here, 'presets'), ext: ['.json'], label: 'Presets de calibração (JSON, versionáveis)'},
  characters: {dir: join(repo, 'chars'), ext: ['.glb', '.gltf'], label: 'Modelos autorizados (chars/, fora do Git)', depth: 2},
  animations: {dir: join(repo, 'chars'), ext: ['.glb', '.gltf'], label: 'Clipes de animação (chars/, fora do Git)', depth: 2},
  reports: {dir: join(here, 'validation', 'reports'), ext: ['.json', '.csv'], label: 'Relatórios de teste (validation/, fora do Git)'},
  benchmarks: {dir: join(here, 'validation', 'benchmarks'), ext: ['.json'], label: 'Benchmarks de desempenho (validation/, fora do Git)'},
};
const MAX_BODY = 64 * 1024 * 1024;
/** Caminho seguro dentro da área: segmentos simples, sem “..”, sem absolutos, extensão permitida. */
export function safePath(area, name) {
  const A = AREAS[area];if (!A) return {error: 'área desconhecida', status: 404};
  const parts = String(name).split('/').filter(Boolean);
  if (!parts.length || parts.length > (A.depth ?? 1) || parts.some(p => p === '.' || p === '..' || /[\\:*?"<>|\0]/.test(p))) return {error: 'nome inválido', status: 400};
  if (!A.ext.includes(extname(parts.at(-1)).toLowerCase())) return {error: `extensão não permitida (${A.ext.join(', ')})`, status: 400};
  const full = resolve(A.dir, ...parts);
  if (!full.startsWith(resolve(A.dir) + sep)) return {error: 'fora da área', status: 400};
  return {full, rel: parts.join('/')};
}
async function list(area) {
  const A = AREAS[area], out = [];
  async function walk(dir, prefix, depth) {
    let entries;try {entries = await readdir(dir, {withFileTypes: true});} catch {return;}
    for (const e of entries) {
      if (e.isDirectory() && depth > 1) await walk(join(dir, e.name), prefix + e.name + '/', depth - 1);
      else if (e.isFile() && A.ext.includes(extname(e.name).toLowerCase())) {const s = await stat(join(dir, e.name));out.push({name: prefix + e.name, size: s.size, mtime: s.mtimeMs});}
    }
  }
  await walk(A.dir, '', A.depth ?? 1);return out.sort((a, b) => b.mtime - a.mtime);
}

/** Pastas que a API de gravação do Editor de Moves pode alterar (move.json dos Moves e visual aprovado do atelier). */
const DEFAULT_MOVES_DIR = join(here, 'src', 'sim', 'moves'), DEFAULT_APPROVED_DIR = join(repo, 'prototypes', 'sand-stone-lab', 'approved');
export async function startDevServer({port = 5173, quiet = false, watchFiles = true, movesDir = DEFAULT_MOVES_DIR, approvedDir = DEFAULT_APPROVED_DIR} = {}) {
  const saveApi = createMoveSaveApi({movesDir, approvedDir});
  let lab = await buildLab({minify: false}), reports = await buildReportsPanel({minify: false}), version = 1, lastError = null;
  const clients = new Set(), log = (...a) => {if (!quiet) console.log(...a);};
  async function rebuild(reason) {
    try {[lab, reports] = await Promise.all([buildLab({minify: false}), buildReportsPanel({minify: false})]);lastError = null;version++;log(`↻ recompilado (${reason})`);for (const c of clients) c.write(`data: ${version}\n\n`);}
    catch (e) {lastError = e.message;log('✗ erro de compilação:', e.message);for (const c of clients) c.write(`event: error\ndata: ${JSON.stringify(e.message)}\n\n`);}
  }
  const inject = html => html.replace('</body>', `<script>window.__ARENAMON_DEV__={api:'/api',save:true,version:${version}};(()=>{const s=new EventSource('/__dev/events');s.onmessage=()=>location.reload();s.addEventListener('error',e=>{if(e.data)console.error('Compilação:',JSON.parse(e.data));});})();</script></body>`);
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1'), send = (status, body, type = 'application/json; charset=utf-8') => {res.writeHead(status, {'content-type': type, 'cache-control': 'no-store'});res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));};
    try {
      if (url.pathname === '/' || url.pathname === '/index.html') return send(200, inject(lab), 'text/html; charset=utf-8');
      if (url.pathname === '/relatorios' || url.pathname === '/relatorios.html') return send(200, inject(reports), 'text/html; charset=utf-8');
      if (url.pathname === '/favicon.ico') {res.writeHead(204);return res.end();}
      if (url.pathname === '/__dev/events') {res.writeHead(200, {'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive'});res.write(': ok\n\n');clients.add(res);req.on('close', () => clients.delete(res));return;}
      if (url.pathname === '/__dev/rebuild' && req.method === 'POST') {if (!req.headers.origin || new URL(req.headers.origin).host !== req.headers.host) return send(403, {error: 'origem não autorizada'});await rebuild('pedido');return send(200, {version, error: lastError});}
      const saved = await saveApi.handle({method: req.method, pathname: url.pathname, origin: req.headers.origin, host: req.headers.host, readBody: async () => {const chunks = [];let size = 0;for await (const c of req) {size += c.length;if (size > MAX_BODY) throw new Error('grande');chunks.push(c);}return Buffer.concat(chunks).toString('utf8');}});
      if (saved) return saved.error ? send(saved.status, {error: saved.error, ...(saved.currentHash ? {currentHash: saved.currentHash} : {})}) : send(saved.status, saved.body);
      if (url.pathname === '/api/health') return send(200, {ok: true, version, error: lastError, areas: Object.fromEntries(Object.entries(AREAS).map(([k, a]) => [k, {label: a.label, ext: a.ext, dir: relative(repo, a.dir).replaceAll(sep, '/')}]))});
      const m = url.pathname.match(/^\/api\/files\/([a-z]+)(?:\/(.+))?$/);
      if (m) {
        const [, area, raw] = m;if (!AREAS[area]) return send(404, {error: 'área desconhecida'});
        if (!raw) return req.method === 'GET' ? send(200, {area, files: await list(area)}) : send(405, {error: 'método não permitido'});
        const p = safePath(area, decodeURIComponent(raw));if (p.error) return send(p.status, {error: p.error});
        if (req.method === 'GET') {try {return send(200, await readFile(p.full), 'application/octet-stream');} catch {return send(404, {error: 'arquivo não encontrado'});}}
        if (req.method === 'PUT') {
          // Só a própria página (mesma origem) pode gravar: outra aba ou site não escreve no disco.
          const origin = req.headers.origin, host = req.headers.host;
          if (!origin || new URL(origin).host !== host) return send(403, {error: 'origem não autorizada'});
          const chunks = [];let size = 0;for await (const c of req) {size += c.length;if (size > MAX_BODY) return send(413, {error: 'arquivo grande demais'});chunks.push(c);}
          await mkdir(resolve(p.full, '..'), {recursive: true});await writeFile(p.full, Buffer.concat(chunks));
          return send(200, {ok: true, name: p.rel, size});
        }
        return send(405, {error: 'método não permitido'});
      }
      send(404, {error: 'não encontrado'});
    } catch (e) {send(500, {error: e.message});}
  });
  await new Promise((ok, fail) => {server.once('error', fail);server.listen(port, '127.0.0.1', ok);});
  const actual = server.address().port, watchers = [];
  if (watchFiles) {
    let timer = null;const kick = (f) => {if (/\.tmp$/.test(String(f ?? ''))) return;clearTimeout(timer);timer = setTimeout(() => rebuild(f || 'arquivo alterado'), 120);};
    for (const d of ['src', 'reports']) watchers.push(watch(join(here, d), {recursive: true}, (_, f) => kick(f)));
    watchers.push(watch(approvedDir, {recursive: true}, (_, f) => kick(f)));   // visual aprovado do atelier (entra no jogo e no editor)
  }
  log(`Laboratório (desenvolvimento): http://127.0.0.1:${actual}/   ·   relatórios: http://127.0.0.1:${actual}/relatorios`);
  return {port: actual, rebuild, close: () => new Promise(r => {for (const w of watchers) w.close();for (const c of clients) c.end();server.close(r);})};
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const i = process.argv.indexOf('--port'), port = i > 0 ? Number(process.argv[i + 1]) : 5173;
  await startDevServer({port});
}
