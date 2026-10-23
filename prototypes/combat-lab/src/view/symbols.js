// Símbolos 24×24 (traços e preenchimentos) dos 7 tipos de consumível e dos 5 atributos. Os mesmos caminhos desenham o HUD de
// progressão (SVG) e os indicadores flutuantes dos consumíveis (canvas). Só apresentação.
export const SYMBOLS = {
  hp: [{d: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z', fill: true}],
  stamRec: [{d: 'M13.5 2 5 13.5h6L10 22l9-12h-6z', fill: true}],
  attack: [{d: 'M12 2v6M12 16v6M2 12h6M16 12h6M5 5l3.5 3.5M15.5 15.5 19 19M19 5l-3.5 3.5M8.5 15.5 5 19'}, {d: 'M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z', fill: true}],
  defense: [{d: 'M12 3 20 6v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z', fill: true}],
  stamina: [{d: 'M6 7h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2zM18 10h2.5v4H18'}, {d: 'M11.7 8.6 8.9 12.4h2.6L10.3 15.4l3.4-3.9h-2.6z', fill: true}],
  cooldown: [{d: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z'}, {d: 'M12 7.5V12l3 2'}],
  speed: [{d: 'M4 5l7 7-7 7M12 5l7 7-7 7'}],
};

/** Símbolo como string SVG (para HTML). */
export function symbolSvg(id, {size = 24, color = 'currentColor', stroke = 2} = {}) {
  const parts = SYMBOLS[id].map(p => `<path d="${p.d}" fill="${p.fill ? color : 'none'}" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
  return `<svg class="pg-sym" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">${parts}</svg>`;
}

/** Desenha um símbolo em um contexto 2D de canvas, centrado em (cx, cy) com lado `size`. */
export function drawSymbol(ctx, id, cx, cy, size, color, stroke = 2.2) {
  const k = size / 24;
  ctx.save();ctx.translate(cx - 12 * k, cy - 12 * k);ctx.scale(k, k);
  ctx.strokeStyle = color;ctx.fillStyle = color;ctx.lineWidth = stroke;ctx.lineCap = 'round';ctx.lineJoin = 'round';
  for (const p of SYMBOLS[id]) {const path = new Path2D(p.d);if (p.fill) ctx.fill(path);ctx.stroke(path);}
  ctx.restore();
}
