// API de GRAVAÇÃO do Editor de Moves (servidor local, só 127.0.0.1): lê e grava `<id>.move.json` (src/sim/moves) e o visual aprovado do atelier
// (prototypes/sand-stone-lab/approved/<categoria>.json). Regras:
//   • só arquivos que JÁ existem (nada de criar caminhos): o id/categoria precisa casar com um arquivo da pasta;
//   • valida o conteúdo antes de gravar (esquema do move.json; exportação válida do atelier, sem campos ignorados);
//   • controle de concorrência por hash: quem lê recebe o hash do texto; gravar com hash diferente do atual = 409 (alguém mexeu no arquivo);
//   • gravação atômica (arquivo temporário + rename) e a mesma formatação de sempre (JSON com 2 espaços e quebra final);
//   • a confirmação do usuário é da interface (diálogo com as diferenças); o servidor ainda exige `confirm: true` no corpo.
import {readFile, writeFile, rename, readdir, stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {validateMoveData} from './src/sim/moves/move-data.js';
import {parsePreset} from '../sand-stone-lab/src/presets.ts';

const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const sha = (/** @type {string} */ t) => createHash('sha1').update(t).digest('hex');
const MAX_BODY = 512 * 1024;

/** @param {{movesDir: string, approvedDir: string}} dirs */
export function createMoveSaveApi({movesDir, approvedDir}) {
  const kinds = {
    moves: {dir: movesDir, file: id => `${id}.move.json`},
    approved: {dir: approvedDir, file: id => `${id}.json`},
  };
  async function locate(/** @type {string} */ kind, /** @type {string} */ id) {
    const k = /** @type {any} */ (kinds)[kind];
    if (!k) return {error: 'tipo desconhecido', status: 404};
    if (!ID.test(id)) return {error: 'nome inválido', status: 400};
    if (kind === 'moves') {
      const subPath = join(k.dir, id, `${id}.move.json`);
      const flatPath = join(k.dir, `${id}.move.json`);
      let subExists = false, flatExists = false;
      try {await stat(subPath); subExists = true;} catch {}
      try {await stat(flatPath); flatExists = true;} catch {}
      if (subExists && flatExists) {
        return {error: `arquivo duplicado detectado: o Move '${id}' existe simultaneamente na subpasta e na raiz (${subPath} e ${flatPath})`, status: 409};
      }
      if (subExists) return {file: subPath, k};
      if (flatExists) return {file: flatPath, k};
      return {error: 'não existe (a gravação só altera arquivos existentes)', status: 404};
    }
    const file = join(k.dir, k.file(id));
    try {await stat(file);} catch {return {error: 'não existe (a gravação só altera arquivos existentes)', status: 404};}
    return {file, k};
  }
  /** Lê o arquivo e devolve o texto, o hash e o documento. */
  async function read(kind, id) {
    const loc = await locate(kind, id);
    if (loc.error) return loc;
    const text = await readFile(loc.file, 'utf8').then(t => t.replace(/\r\n/g, '\n'));
    const relPath = loc.file.replace(/\\/g, '/').split('prototypes/combat-lab/')[1] ?? loc.file;
    return {status: 200, body: {kind, id, file: relPath, hash: sha(text), doc: JSON.parse(text)}};
  }
  /** Valida o documento conforme o tipo; devolve null se válido ou a mensagem de erro. */
  function validate(kind, id, doc) {
    if (kind === 'moves') {
      const bad = validateMoveData(doc);   // inclui as regras mecânicas do motor (validateMoveMechanics): nada que o registro recusaria é gravado
      if (bad.length) return 'move.json inválido: ' + bad.slice(0, 5).join('; ');
      if (doc.def.id !== id) return `def.id (${doc.def.id}) diferente do arquivo (${id})`;
      return null;
    }
    try {
      const r = parsePreset(JSON.stringify(doc));
      if (r.scope !== 'single') return 'precisa ser a exportação de UMA alternativa do atelier';
      if (r.category !== id) return `categoria (${r.category}) diferente do arquivo (${id})`;
      if (r.ignored) return `${r.ignored} campo(s) que o atelier ignora`;
      return null;
    } catch (e) {return 'visual inválido: ' + /** @type {Error} */ (e).message;}
  }
  /** Exclusão mútua por arquivo: duas gravações do mesmo arquivo nunca se intercalam (nem dividem o mesmo .tmp); a segunda confere o hash DEPOIS da primeira. */
  const filas = new Map();
  let tmpSeq = 0;
  async function comFila(/** @type {string} */ chave, /** @type {() => Promise<any>} */ fn) {
    const anterior = filas.get(chave) ?? Promise.resolve();
    const minha = anterior.catch(() => {}).then(fn);
    const fim = minha.catch(() => {});filas.set(chave, fim);
    try {return await minha;} finally {if (filas.get(chave) === fim) filas.delete(chave);}
  }
  /** Grava o documento (com `confirm: true` e o hash lido). */
  async function write(kind, id, body) {
    if (!body || body.confirm !== true) return {status: 400, error: 'falta a confirmação (confirm: true)'};
    const loc0 = await locate(kind, id);
    if (loc0.error) return loc0;
    return comFila(loc0.file, () => gravar(kind, id, body));
  }
  async function gravar(kind, id, body) {
    if (!body || body.confirm !== true) return {status: 400, error: 'falta a confirmação (confirm: true)'};
    const loc = await locate(kind, id);
    if (loc.error) return loc;
    const bad = validate(kind, id, body.doc);
    if (bad) return {status: 422, error: bad};
    const current = await readFile(loc.file, 'utf8').then(t => t.replace(/\r\n/g, '\n'));
    if (typeof body.expectHash !== 'string' || body.expectHash !== sha(current)) return {status: 409, error: 'o arquivo mudou no disco desde que o editor o leu: recarregue antes de gravar', currentHash: sha(current)};
    const next = JSON.stringify(body.doc, null, 2) + '\n';
    if (next === current) return {status: 200, body: {ok: true, changed: false, hash: sha(current), bytes: 0}};
    const tmp = `${loc.file}.${process.pid}.${++tmpSeq}.tmp`;   // nome próprio por gravação
    await writeFile(tmp, next);await rename(tmp, loc.file);
    return {status: 200, body: {ok: true, changed: true, hash: sha(next), bytes: Buffer.byteLength(next)}};
  }
  async function list(kind) {
    const k = /** @type {any} */ (kinds)[kind];
    if (!k) return {status: 404, error: 'tipo desconhecido'};
    if (kind === 'moves') {
      const entries = await readdir(k.dir, {withFileTypes: true});
      /** @type {Set<string>} */ const ids = new Set();
      /** @type {Set<string>} */ const seenFlat = new Set();
      /** @type {Set<string>} */ const seenSub = new Set();
      for (const ent of entries) {
        if (ent.isDirectory() && ID.test(ent.name)) {
          try {
            await stat(join(k.dir, ent.name, `${ent.name}.move.json`));
            seenSub.add(ent.name);
            ids.add(ent.name);
          } catch {}
        } else if (ent.isFile() && ent.name.endsWith('.move.json')) {
          const id = ent.name.replace(/\.move\.json$/, '');
          seenFlat.add(id);
          ids.add(id);
        }
      }
      const duplicates = [...seenSub].filter(id => seenFlat.has(id));
      if (duplicates.length) {
        return {status: 409, error: `duplicação detectada nos arquivos de Moves: ${duplicates.join(', ')} existem na subpasta e na raiz`};
      }
      return {status: 200, body: {kind, ids: [...ids].sort()}};
    }
    const names = (await readdir(k.dir)).filter(f => f.endsWith('.json'));
    return {status: 200, body: {kind, ids: names.map(f => f.replace(/\.json$/, '')).sort()}};
  }
  /**
   * Roteia GET/PUT em /api/moves/<id>, /api/approved/<id> e /api/moves (lista). Devolve null se a rota não é desta API.
   * @param {{method: string, pathname: string, origin?: string, host?: string, readBody: () => Promise<string>}} req
   */
  async function handle(req) {
    const m = req.pathname.match(/^\/api\/(moves|approved)(?:\/([^/]+))?$/);
    if (!m) return null;
    const [, kind, id] = m;
    if (!id) return req.method === 'GET' ? list(kind) : {status: 405, error: 'método não permitido'};
    if (req.method === 'GET') return read(kind, decodeURIComponent(id));
    if (req.method === 'PUT') {
      // Só a própria página (mesma origem) grava: outra aba ou site não escreve no disco.
      if (!req.origin || new URL(req.origin).host !== req.host) return {status: 403, error: 'origem não autorizada'};
      let text;try {text = await req.readBody();} catch {return {status: 413, error: 'corpo grande demais'};}
      if (text.length > MAX_BODY) return {status: 413, error: 'corpo grande demais'};
      let body;try {body = JSON.parse(text);} catch {return {status: 400, error: 'JSON inválido'};}
      return write(kind, decodeURIComponent(id), body);
    }
    return {status: 405, error: 'método não permitido'};
  }
  return {handle, read, write, list, validate};
}
