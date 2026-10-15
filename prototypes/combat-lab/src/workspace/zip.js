// ZIP mínimo, sem dependências: escreve arquivos sem compressão (STORE; GLBs já são binários densos) e lê ZIPs
// STORE ou DEFLATE (este último via DecompressionStream, quando o navegador oferece). Verifica o CRC-32 de cada arquivo.
import {crc32} from './hash.js';

const enc = new TextEncoder(), dec = new TextDecoder();
const toBytes = d => d instanceof Uint8Array ? d : d instanceof ArrayBuffer ? new Uint8Array(d) : typeof d === 'string' ? enc.encode(d) : new Uint8Array(d.buffer, d.byteOffset, d.byteLength);

/** files: [{path, data (string | ArrayBuffer | Uint8Array), date?}] → Uint8Array do ZIP. */
export function writeZip(files) {
  const parts = [], central = [];let offset = 0;
  const dosTime = (d = new Date()) => [((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xffff, (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xffff];
  for (const f of files) {
    const name = enc.encode(f.path), data = toBytes(f.data), crc = crc32(data), [time, date] = dosTime(f.date);
    if (data.length >= 0xffffffff || offset >= 0xffffffff) throw new Error('Pacote grande demais para ZIP sem ZIP64 (4 GB).');
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);local.setUint16(4, 20, true);local.setUint16(6, 0x0800, true);local.setUint16(8, 0, true);
    local.setUint16(10, time, true);local.setUint16(12, date, true);local.setUint32(14, crc, true);local.setUint32(18, data.length, true);local.setUint32(22, data.length, true);
    local.setUint16(26, name.length, true);local.setUint16(28, 0, true);
    parts.push(new Uint8Array(local.buffer), name, data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true);c.setUint16(4, 20, true);c.setUint16(6, 20, true);c.setUint16(8, 0x0800, true);c.setUint16(10, 0, true);
    c.setUint16(12, time, true);c.setUint16(14, date, true);c.setUint32(16, crc, true);c.setUint32(20, data.length, true);c.setUint32(24, data.length, true);
    c.setUint16(28, name.length, true);c.setUint32(42, offset, true);
    central.push(new Uint8Array(c.buffer), name);
    offset += 30 + name.length + data.length;
  }
  const cdSize = central.reduce((n, p) => n + p.length, 0), end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);end.setUint16(8, files.length, true);end.setUint16(10, files.length, true);end.setUint32(12, cdSize, true);end.setUint32(16, offset, true);
  const all = [...parts, ...central, new Uint8Array(end.buffer)], out = new Uint8Array(all.reduce((n, p) => n + p.length, 0));
  let o = 0;for (const p of all) {out.set(p, o);o += p.length;}
  return out;
}

async function inflateRaw(bytes) {
  if (typeof DecompressionStream !== 'function') throw new Error('Este navegador não descomprime ZIP com DEFLATE; exporte o pacote pelo laboratório (sem compressão).');
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Lê um ZIP: Map(path → Uint8Array). Erros explícitos para arquivo truncado, CRC incorreto ou método não suportado. */
export async function readZip(input) {
  const bytes = toBytes(input), dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) {eocd = i;break;}
  if (eocd < 0) throw new Error('Não é um arquivo ZIP (diretório central não encontrado).');
  const count = dv.getUint16(eocd + 10, true), cdOffset = dv.getUint32(eocd + 16, true), files = new Map();
  let p = cdOffset;
  for (let i = 0; i < count; i++) {
    if (p + 46 > bytes.length || dv.getUint32(p, true) !== 0x02014b50) throw new Error('ZIP corrompido (entrada do diretório central inválida).');
    const method = dv.getUint16(p + 10, true), crc = dv.getUint32(p + 16, true), size = dv.getUint32(p + 20, true), nameLen = dv.getUint16(p + 28, true), extraLen = dv.getUint16(p + 30, true), commentLen = dv.getUint16(p + 32, true), localOffset = dv.getUint32(p + 42, true);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));p += 46 + nameLen + extraLen + commentLen;
    if (name.endsWith('/')) continue;
    if (dv.getUint32(localOffset, true) !== 0x04034b50) throw new Error(`ZIP corrompido: cabeçalho local de “${name}”.`);
    const start = localOffset + 30 + dv.getUint16(localOffset + 26, true) + dv.getUint16(localOffset + 28, true), raw = bytes.subarray(start, start + size);
    if (raw.length !== size) throw new Error(`ZIP truncado em “${name}”.`);
    const data = method === 0 ? raw.slice() : method === 8 ? await inflateRaw(raw) : null;
    if (!data) throw new Error(`Método de compressão ${method} não suportado em “${name}”.`);
    if (crc32(data) !== crc) throw new Error(`Falha de integridade (CRC-32) em “${name}”.`);
    files.set(name, data);
  }
  return files;
}
export const zipText = data => dec.decode(data);
