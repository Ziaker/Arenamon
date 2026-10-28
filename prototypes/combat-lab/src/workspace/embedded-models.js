// Modelos embutidos no build (ex.: Wookada). Cada GLB vira um asset comum do workspace: mesmo SHA-256 é o
// mesmo arquivo, então aparece nos seletores de Azul/Vermelho e persiste como qualquer outro modelo.
import {storeAsset} from './store.js';

/** Lê os <script data-embedded-model> do HTML e grava cada GLB no store. Devolve os nomes gravados. */
export async function seedEmbeddedModels(store, doc = globalThis.document) {
  const names = [];
  for (const tag of doc.querySelectorAll('script[data-embedded-model]')) {
    const name = tag.dataset.embeddedModel;
    try {
      const bin = atob(tag.textContent.trim()), bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      await storeAsset(store, {name, kind: 'model', bytes});
      names.push(name);
    } catch (e) {console.warn('modelo embutido ' + name + ':', e);}
  }
  return names;
}
