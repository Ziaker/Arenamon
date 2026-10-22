// Dados e estado demonstrativo do laboratório "HUD de Vida, Stamina e Moves".
// Nada aqui é regra de jogo: os valores espelham só a ESCALA real (stamina base 3 pontos; estados dos slots iguais
// aos de sim/move-state.js: pronto, carregando, recarga, bloqueado) para que a leitura visual seja coerente.

export const HP_MAX = 100;
export const ST_MAX = 3;

/** Estados de um slot. `semStamina` e `selecionado` são camadas visuais extras pedidas no briefing. */
export const MOVE_STATES = [
  ['pronto', 'Pronto'],
  ['recarga', 'Em recarga'],
  ['carregando', 'Carregando'],
  ['bloqueado', 'Bloqueado'],
  ['semStamina', 'Sem stamina'],
];
export const STATE_LABEL = Object.fromEntries(MOVE_STATES);

export const HUD_STYLES = [
  {id: 'A', nome: 'Impacto', desc: 'Urbano, angular, vermelho/preto/branco'},
  {id: 'B', nome: 'Quadrinhos', desc: 'Painéis, halftone, balões e onomatopeias'},
  {id: 'C', nome: 'Clássico', desc: 'Limpo, sólido e profissional'},
];

/** Ícones originais (viewBox 24×24, traço/preenchimento simples). Nenhum vem de jogo ou obra existente. */
export const ICONS = {
  impacto: '<path d="M12 1.5l2.4 6.3 6.6-1.9-3.7 5.8 5.2 4.2-6.6.4-.9 6.5L12 16.3 7 22.8l-.9-6.5-6.6-.4 5.2-4.2L1 5.9l6.6 1.9z"/>',
  escudo: '<path d="M12 2l8.5 3v6.2c0 5.2-3.5 9.2-8.5 10.8C7 20.400 3.500 16.400 3.500 11.200V5z"/>',
  raio: '<path d="M13.500 1.500L4 13.500h6.500L9 22.500l11-13h-7z"/>',
  chama: '<path d="M12 1.500c.6 3.500-2.200 5.200-3.600 7.500C6.900 11.300 6 13.200 6 15.200 6 19 8.700 22 12 22s6-3 6-6.800c0-2.400-1.200-4.200-2.300-5.400-.1 1.600-.8 2.800-1.900 3.300.6-3.800-.3-7.800-1.800-11.600z"/>',
  onda: '<path d="M1.500 9.500c2.700-4 4.700-4 7.500 0s4.800 4 7.500 0l3.500-3.500v4.500c-2.700 4-4.700 4-7.500 0s-4.800-4-7.500 0zm0 8c2.700-4 4.700-4 7.500 0s4.800 4 7.500 0l3.500-3.500v4.500c-2.700 4-4.700 4-7.500 0s-4.800-4-7.500 0z"/>',
  estrela: '<path d="M12 2l2.900 6.200 6.800.8-5 4.700 1.300 6.700L12 17l-6 3.400 1.300-6.700-5-4.700 6.800-.8z"/>',
  espiral: '<path d="M12 3a9 9 0 1 0 9 9h-3a6 6 0 1 1-6-6zm0 5a4 4 0 1 0 4 4h-2.600a1.400 1.400 0 1 1-1.400-1.400z"/>',
  gota: '<path d="M12 1.500c3.500 4.700 7 8.300 7 12.200A7 7 0 0 1 5 13.700c0-3.900 3.500-7.500 7-12.200z"/>',
  pedra: '<path d="M4 15.500L7.500 6l6-3.500 6 4.500 1.500 8-6 5.500-8-.5z"/>',
  punho: '<path d="M5 9.500a3 3 0 0 1 3-3h8.500a3.500 3.500 0 0 1 3.500 3.500v5.500A5.500 5.500 0 0 1 14.500 21H11a6 6 0 0 1-6-6zm4.500-.7v3.300m3-3.300v3.300m3-3.300v3.300"/>',
};
export const ICON_NAMES = Object.keys(ICONS);
export const iconSvg = (name, cls = '') =>
  `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" stroke="currentColor" stroke-width="0" stroke-linejoin="round">${ICONS[name] ?? ICONS.impacto}</svg>`;

/** Nomes sugeridos (movimentos reais do catálogo do combate; editáveis na interface). */
export const MOVE_NAME_SUGGESTIONS = ['Quick Attack', 'Psyshock', 'Harden', 'Sand Wave', 'Bullet Punch', 'Reflect', 'Second Wind', 'Lunge', 'Riposte', 'Bounce'];

/** Padrão do jogo: skill1–4 = A, S, 3, 4. */
const DEFAULT_KEYS = ['A', 'S', '3', '4'];

export function defaultMove(i) {
  return {
    name: ['Quick Attack', 'Psyshock', 'Harden', 'Sand Wave'][i],
    key: DEFAULT_KEYS[i],
    icon: ['raio', 'espiral', 'escudo', 'onda'][i],
    cost: [0.5, 1, 0.5, 1][i],     // custo de stamina exibido (demonstrativo)
    state: 'pronto',
    cd: 0.6,                        // fração de recarga RESTANTE (1 = acabou de usar; 0 = pronto)
    charge: 0.5,                    // fração de carga (0–1)
    selected: false,
  };
}

export function defaultModel() {
  return {
    p: {name: 'JOGADOR', hp: 100, st: 3},
    e: {name: 'ADVERSÁRIO', hp: 100, st: 3},
    moves: [0, 1, 2, 3].map(defaultMove),
  };
}

/** Presets de teste visual. Cada um sobrescreve o modelo inteiro (escalas reais: HP 0–100, stamina 0–3). */
const mv = (i, over) => ({...defaultMove(i), ...over});
export const PRESETS = [
  {id: 'neutro', curto: 'Neutro', nome: 'Estado neutro', desc: 'Vida e stamina altas, moves prontos.', build: () => ({
    p: {name: 'JOGADOR', hp: 100, st: 3}, e: {name: 'ADVERSÁRIO', hp: 100, st: 3},
    moves: [mv(0, {}), mv(1, {}), mv(2, {}), mv(3, {})],
  })},
  {id: 'avancado', curto: 'Avançado', nome: 'Combate avançado', desc: 'HP e stamina parciais, dois moves em recarga.', build: () => ({
    p: {name: 'JOGADOR', hp: 64, st: 1.7}, e: {name: 'ADVERSÁRIO', hp: 41, st: 2.2},
    moves: [mv(0, {}), mv(1, {state: 'recarga', cd: 0.72}), mv(2, {state: 'recarga', cd: 0.28}), mv(3, {selected: true})],
  })},
  {id: 'critica', curto: 'Crítica', nome: 'Situação crítica', desc: 'HP baixo, stamina quase zerada, um bloqueado e outro sem stamina.', build: () => ({
    p: {name: 'JOGADOR', hp: 14, st: 0.25}, e: {name: 'ADVERSÁRIO', hp: 78, st: 1.4},
    moves: [mv(0, {state: 'semStamina'}), mv(1, {state: 'bloqueado'}), mv(2, {state: 'recarga', cd: 0.45}), mv(3, {state: 'semStamina', cost: 1.5})],
  })},
  {id: 'carga', curto: 'Carga', nome: 'Carga / especial', desc: 'Um move carregando, outro pronto, um em recarga e um indisponível.', build: () => ({
    p: {name: 'JOGADOR', hp: 82, st: 2.4}, e: {name: 'ADVERSÁRIO', hp: 55, st: 1},
    moves: [mv(0, {state: 'carregando', charge: 0.68, selected: true}), mv(1, {}), mv(2, {state: 'recarga', cd: 0.5}), mv(3, {state: 'bloqueado'})],
  })},
];

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/** Estado efetivo do slot: pronto sem stamina suficiente vira `semStamina` (camada visual derivada). */
export function effectiveState(m, st) {
  if (m.state === 'pronto' && st + 1e-9 < m.cost) return 'semStamina';
  return m.state;
}
export const keyText = k => (k || '?').toString().toUpperCase().slice(0, 4);
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
