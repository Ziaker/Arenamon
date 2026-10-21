// @ts-check
// Fase 5 (Rapier, prova de conceito): cenários DECLARATIVOS compartilhados pelas duas físicas (a atual e Rapier).
// Cada cenário descreve sólidos (caixa/cilindro com base e topo), a posição inicial e um roteiro de comandos
// por tick de 120 Hz. Não altera nada do jogo: é só dado de teste.
export const DT = 1 / 120;
export const HALF = .5;        // meia largura do colisor (C.test.halfExtent)
export const BODY_H = 1.3;     // altura do corpo (C.extras.visual.bodyHeight)

/** @typedef {{id:string, shape:'box'|'cyl', x:number, z:number, hx:number, hz:number, r:number, base:number, top:number}} Solid */
const box = (id, x, z, hx, hz, top, base = 0) => ({id, shape: /** @type {const} */ ('box'), x, z, hx, hz, r: 0, base, top});
const cyl = (id, x, z, r, top) => ({id, shape: /** @type {const} */ ('cyl'), x, z, hx: r, hz: r, r, base: 0, top});

/**
 * Roteiro: lista de trechos {from,to,move:[x,z],jump?:tick,hold?:bool}. jump = tick em que aperta o salto; hold = mantém o
 * botão (salto completo). Fora dos trechos: sem comando.
 * @type {Record<string, {label:string, hint:string, solids:Solid[], start:{x:number,z:number,y:number}, ticks:number, script:{from:number,to:number,move:[number,number],jump?:number,hold?:boolean}[], launch?:{vx:number,vz:number}, expect:string}>}
 */
export const POC_SCENARIOS = {
  queda: {
    label: 'Queda e repouso no chão', hint: 'Cai de 3 m e fica parado: tempo de pouso, altura final e tremor em repouso.',
    solids: [], start: {x: 0, z: 0, y: 3}, ticks: 360, script: [], expect: 'pousa em y = 0 e fica estável',
  },
  salto_plataforma: {
    label: 'Salto para plataforma de 1,0 m', hint: 'Corre até a plataforma e salta; deve pousar no topo.',
    solids: [box('plat', 0, 5, 1.5, 3, 1.0)], start: {x: 0, z: 0, y: 0}, ticks: 420,
    script: [{from: 0, to: 100, move: [0, 1], jump: 42, hold: true}, {from: 100, to: 130, move: [0, 1]}], expect: 'termina em cima da plataforma (y = 1,0)',
  },
  parede_lateral: {
    label: 'Parede lateral (deslizar na quina)', hint: 'Anda na diagonal contra um bloco de 2,2 m: não pode atravessar e deve deslizar.',
    solids: [box('bloco', 0, 4, 1.5, 1.5, 2.2)], start: {x: -1, z: 0, y: 0}, ticks: 360,
    script: [{from: 0, to: 300, move: [.7071, .7071]}], expect: 'z nunca passa de 2,0 (face − meia largura) e x avança deslizando',
  },
  teto: {
    label: 'Colisão com teto', hint: 'Salta debaixo de uma laje flutuante (face inferior a 1,6 m): a cabeça deve parar na laje.',
    solids: [box('laje', 0, 3, 2, 2, 2.0, 1.6)], start: {x: 0, z: 2.2, y: 0}, ticks: 300,
    script: [{from: 0, to: 12, move: [0, 1]}, {from: 12, to: 20, move: [0, 0], jump: 14, hold: true}], expect: 'pés sobem no máximo a 0,3 m (1,6 − 1,3) e voltam ao chão',
  },
  pilar: {
    label: 'Pilar cilíndrico (contorno)', hint: 'Caminha de frente para um pilar de raio 0,9 m deslocado 0,3 m: contorna sem entrar.',
    solids: [cyl('pilar', .3, 4, .9, 4.5)], start: {x: 0, z: 0, y: 0}, ticks: 360,
    script: [{from: 0, to: 300, move: [0, 1]}], expect: 'não penetra o pilar e escorrega pela lateral',
  },
  tunel: {
    label: 'Alta velocidade contra parede fina', hint: 'Lançado a 40 m/s contra uma parede de 0,2 m: não pode atravessar (tunelamento).',
    solids: [box('parede', 0, 6, 3, .1, 3.0)], start: {x: 0, z: 0, y: 0}, ticks: 240, script: [], launch: {vx: 0, vz: 40}, expect: 'z final ≤ 5,4 (parede − meia largura)',
  },
  borda: {
    label: 'Queda pela borda da plataforma', hint: 'Anda por cima de uma plataforma de 1,5 m e cai pela borda.',
    solids: [box('plat', 0, 1.5, 2, 2.2, 1.5)], start: {x: 0, z: 0, y: 1.5}, ticks: 420,
    script: [{from: 0, to: 140, move: [0, 1]}], expect: 'cai pela borda e termina no chão (y = 0)',
  },
};
export const POC_IDS = Object.keys(POC_SCENARIOS);

/** Comando do tick t para o roteiro: {move:[x,z], jump:boolean, held:boolean}. */
export function commandAt(sc, t) {
  let move = [0, 0], jump = false, held = false;
  for (const s of sc.script) if (t >= s.from && t < s.to) {
    move = s.move;
    if (s.jump === t) jump = true;
    if (s.hold && s.jump !== undefined && t >= s.jump) held = true;
  }
  return {move, jump, held};
}
