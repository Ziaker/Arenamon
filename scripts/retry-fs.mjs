// Pré-carregado nos testes por scripts/run-test-chain.mjs (NODE_OPTIONS=--import): a pasta do projeto fica no OneDrive, que às vezes trava por instantes
// o arquivo que acabou de ser regravado (erro UNKNOWN, errno -4094, também EBUSY/EPERM) e derruba testes que só gravam capturas de evidência.
// Aqui as gravações de arquivo tentam de novo (até 6 vezes, com espera crescente) antes de falhar. Não muda nada além de gravar com insistência.
import fs from 'node:fs';

const RETRYABLE = e => e && (e.code === 'UNKNOWN' || e.code === 'EBUSY' || e.code === 'EPERM' || e.errno === -4094);
const sleepSync = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const sleep = ms => new Promise(r => setTimeout(r, ms));

for (const name of ['writeFile', 'appendFile', 'copyFile', 'rename', 'mkdir']) {
  const original = fs.promises[name];
  if (typeof original === 'function') fs.promises[name] = async function (...args) {
    for (let t = 1; ; t++) {
      try {return await original.apply(this, args);} catch (e) {if (t >= 6 || !RETRYABLE(e)) throw e;await sleep(300 * t);}
    }
  };
  const sync = fs[name + 'Sync'];
  if (typeof sync === 'function') fs[name + 'Sync'] = function (...args) {
    for (let t = 1; ; t++) {
      try {return sync.apply(this, args);} catch (e) {if (t >= 6 || !RETRYABLE(e)) throw e;sleepSync(300 * t);}
    }
  };
}
