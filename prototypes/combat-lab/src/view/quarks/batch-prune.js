// @ts-check
// F5 — three.quarks 0.17: BatchedRenderer.deleteSystem() tira o sistema do lote, mas o lote (VFXBatch: malha + geometria + material
// CLONADO) fica para sempre como filho do renderizador. Como cada efeito do jogo cria materiais/texturas novos, o lote nunca é
// reaproveitado: um lote vazio sobrava a cada Water Pulse, Air Slash, Swift... e a cada reset. Esta poda descarta os lotes vazios e
// reindexa systemToBatchIndex (que guarda o ÍNDICE do lote). Descarta a geometria, o ShaderMaterial do lote e o molde clonado (settings.material). Custo: uma passada nos lotes; chame antes de batch.update() e no clear().

/** Remove e descarta os lotes sem sistemas. Devolve quantos saíram. @param {any} br BatchedRenderer */
export function pruneEmptyBatches(br) {
  const batches = br?.batches;if (!batches?.length) return 0;
  let empty = 0;for (const b of batches) if (!b.systems?.size) empty++;
  if (!empty) return 0;
  const keep = batches.filter((/** @type {any} */ b) => b.systems?.size), at = new Map(keep.map((/** @type {any} */ b, /** @type {number} */ i) => [b, i]));
  for (const [s, i] of br.systemToBatchIndex) br.systemToBatchIndex.set(s, at.get(batches[i]));
  for (const b of batches) if (!b.systems?.size) {b.removeFromParent();b.dispose?.();b.material?.dispose?.();b.settings?.material?.dispose?.();}
  br.batches = keep;
  return empty;
}
