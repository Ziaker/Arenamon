// Dados de referência do laboratório (somente leitura). Valores de progressão = regras aprovadas
// (docs/MAPA_COMBAT_LAB_DECISOES_RODADAS.md: R5.1, R5.5–R5.8, R6.9–R6.13, R9.1–R9.2). Nada aqui altera o jogo.

export const MAX_STAGE = 4;

/** Os cinco atributos evolutivos. `per` = bônus por estágio; `fmt` formata o bônus acumulado. */
export const ATTRS = [
  {key: 'attack', label: 'ATAQUE', short: 'ATQ', color: '#ff8a1f', per: '+10% por estágio', cap: '+40%', fmt: s => `+${10 * s}%`},
  {key: 'defense', label: 'DEFESA', short: 'DEF', color: '#3f8cff', per: '−10 p.p. de dano e empurrão por estágio', cap: '−40 p.p.', fmt: s => `−${10 * s} p.p.`},
  {key: 'stamina', label: 'STAMINA MÁX.', short: 'STA', color: '#2fe0a0', per: '+1 ponto de capacidade por estágio', cap: '+4 pontos', fmt: s => `+${s}`},
  {key: 'cooldown', label: 'COOLDOWN', short: 'CD', color: '#b36bff', per: '−10% de duração por estágio', cap: '−40%', fmt: s => `−${10 * s}%`},
  {key: 'speed', label: 'VELOCIDADE', short: 'VEL', color: '#27d3ff', per: '+5% por estágio', cap: '+20%', fmt: s => `+${5 * s}%`},
];
export const ATTR_BY_KEY = Object.fromEntries(ATTRS.map(a => [a.key, a]));

/** Sete tipos oficiais de consumível (R4.1–R4.2, R5.12, R6.8). Os dois primeiros não são atributos evolutivos. */
export const ITEM_TYPES = [
  {id: 'hp', nome: 'Cura de HP', cat: 'Recuperação imediata', efeito: 'Cura 20 HP (respeitando o máximo).', color: '#ff3d71', attr: null},
  {id: 'stamRec', nome: 'Recuperação de Stamina', cat: 'Recuperação imediata', efeito: 'Restaura 2 pontos de stamina (respeitando a capacidade atual).', color: '#ffd23f', attr: null},
  {id: 'attack', nome: 'Evolução de Ataque', cat: 'Atributo evolutivo', efeito: '+1 estágio de Ataque (+10% por estágio, até +40%).', color: '#ff8a1f', attr: 'attack'},
  {id: 'defense', nome: 'Evolução de Defesa', cat: 'Atributo evolutivo', efeito: '+1 estágio de Defesa (−10 p.p. de dano e empurrão por estágio, até −40 p.p.).', color: '#3f8cff', attr: 'defense'},
  {id: 'stamina', nome: 'Evolução de Stamina máxima', cat: 'Atributo evolutivo', efeito: '+1 estágio de Stamina máxima (+1 ponto de capacidade por estágio, até +4).', color: '#2fe0a0', attr: 'stamina'},
  {id: 'cooldown', nome: 'Redução de Cooldown', cat: 'Atributo evolutivo', efeito: '+1 estágio de Cooldown (−10% de duração por estágio, até −40%).', color: '#b36bff', attr: 'cooldown'},
  {id: 'speed', nome: 'Evolução de Velocidade', cat: 'Atributo evolutivo', efeito: '+1 estágio de Velocidade (+5% por estágio, até +20%).', color: '#27d3ff', attr: 'speed'},
];
export const ITEM_BY_ID = Object.fromEntries(ITEM_TYPES.map(i => [i.id, i]));

export const ITEM_STYLES = [
  {id: 'A', nome: 'Gemas Facetadas', desc: 'Cristais angulares, faceta chapada, brilho interno e pedestal hexagonal.'},
  {id: 'B', nome: 'Vinil Cartoon', desc: 'Formas gordinhas com contorno grosso, sombreamento toon e saltitar elástico.'},
  {id: 'C', nome: 'Módulos Tech', desc: 'Peças mecânicas metálicas com faixas luminosas e partes giratórias.'},
];
export const HUD_STYLES = [
  {id: 'A', nome: 'Banco de Células', desc: 'Cinco células verticais com quatro segmentos empilhados (canto inferior esquerdo).'},
  {id: 'B', nome: 'Radar Pentagonal', desc: 'Pentágono com quatro anéis; a área preenchida mostra o conjunto (canto inferior direito).'},
  {id: 'C', nome: 'Faixa de Gemas', desc: 'Fita horizontal de cartões com quatro losangos por atributo (topo).'},
];

/** Símbolos 24×24 (traços + preenchimentos). Os mesmos caminhos desenham HUD (SVG) e indicadores 3D (canvas). */
export const SYMBOLS = {
  hp: [{d: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z', fill: true}],
  stamRec: [{d: 'M13.5 2 5 13.5h6L10 22l9-12h-6z', fill: true}],
  attack: [
    {d: 'M12 2v6M12 16v6M2 12h6M16 12h6M5 5l3.5 3.5M15.5 15.5 19 19M19 5l-3.5 3.5M8.5 15.5 5 19'},
    {d: 'M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z', fill: true},
  ],
  defense: [{d: 'M12 3 20 6v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z', fill: true}],
  stamina: [
    {d: 'M6 7h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2zM18 10h2.5v4H18'},
    {d: 'M11.7 8.6 8.9 12.4h2.6L10.3 15.4l3.4-3.9h-2.6z', fill: true},
  ],
  cooldown: [{d: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z'}, {d: 'M12 7.5V12l3 2'}],
  speed: [{d: 'M4 5l7 7-7 7M12 5l7 7-7 7'}],
};

/** Símbolo como string SVG (para HTML). */
export function symbolSvg(id, {size = 24, color = 'currentColor', stroke = 2, cls = ''} = {}) {
  const parts = SYMBOLS[id].map(p => `<path d="${p.d}" fill="${p.fill ? color : 'none'}" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
  return `<svg class="sym ${cls}" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">${parts}</svg>`;
}

/** Desenha um símbolo em um contexto 2D de canvas, centrado em (cx, cy) com lado `size`. */
export function drawSymbol(ctx, id, cx, cy, size, color, stroke = 2.2) {
  const k = size / 24;
  ctx.save();
  ctx.translate(cx - 12 * k, cy - 12 * k);
  ctx.scale(k, k);
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = stroke; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const p of SYMBOLS[id]) {
    const path = new Path2D(p.d);
    if (p.fill) ctx.fill(path);
    ctx.stroke(path);
  }
  ctx.restore();
}

export function stageText(key, stage) {
  return ATTR_BY_KEY[key].fmt(Math.max(0, Math.min(MAX_STAGE, stage)));
}
