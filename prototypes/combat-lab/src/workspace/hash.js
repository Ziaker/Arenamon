// Identidade de assets: SHA-256 do conteúdo (nunca o nome do arquivo). Usa crypto.subtle quando disponível
// (contexto seguro) e uma implementação própria, idêntica bit a bit, quando não (alguns navegadores em file://).
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
const toBytes = data => data instanceof Uint8Array ? data : data instanceof ArrayBuffer ? new Uint8Array(data) : ArrayBuffer.isView(data) ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength) : new TextEncoder().encode(String(data));
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');

/** SHA-256 síncrono em JavaScript puro (referência e fallback). */
export function sha256Sync(data) {
  const bytes = toBytes(data), n = bytes.length, total = ((n + 9 + 63) >> 6) << 6, m = new Uint8Array(total);
  m.set(bytes);m[n] = 0x80;const dv = new DataView(m.buffer), bits = n * 8;
  dv.setUint32(total - 8, Math.floor(bits / 0x100000000));dv.setUint32(total - 4, bits >>> 0);
  const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]), W = new Uint32Array(64);
  for (let off = 0; off < total; off += 64) {
    for (let i = 0; i < 16; i++) W[i] = dv.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const a = W[i - 15], b = W[i - 2];
      W[i] = (((a >>> 7 | a << 25) ^ (a >>> 18 | a << 14) ^ a >>> 3) + W[i - 7] + ((b >>> 17 | b << 15) ^ (b >>> 19 | b << 13) ^ b >>> 10) + W[i - 16]) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + ((e >>> 6 | e << 26) ^ (e >>> 11 | e << 21) ^ (e >>> 25 | e << 7)) + ((e & f) ^ (~e & g)) + K[i] + W[i]) >>> 0;
      const t2 = (((a >>> 2 | a << 30) ^ (a >>> 13 | a << 19) ^ (a >>> 22 | a << 10)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      h = g;g = f;f = e;e = (d + t1) >>> 0;d = c;c = b;b = a;a = (t1 + t2) >>> 0;
    }
    H[0] += a;H[1] += b;H[2] += c;H[3] += d;H[4] += e;H[5] += f;H[6] += g;H[7] += h;
  }
  const out = new DataView(new ArrayBuffer(32));H.forEach((v, i) => out.setUint32(i * 4, v));return hex(out.buffer);
}

/** SHA-256 em hexadecimal (64 caracteres). */
export async function sha256(data) {
  const bytes = toBytes(data), subtle = globalThis.crypto?.subtle;
  if (subtle) {try {return hex(await subtle.digest('SHA-256', bytes));} catch {/* contexto não seguro: segue para a implementação própria */}}
  return sha256Sync(bytes);
}

/** CRC-32 (ZIP). */
let CRC_TABLE = null;
export function crc32(data) {
  if (!CRC_TABLE) {CRC_TABLE = new Uint32Array(256);for (let i = 0; i < 256; i++) {let c = i;for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;CRC_TABLE[i] = c >>> 0;}}
  const bytes = toBytes(data);let c = 0xffffffff;for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);return (c ^ 0xffffffff) >>> 0;
}
