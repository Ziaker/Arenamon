// @ts-check
// Módulo de Gerenciamento do Mapa: Arena Circular de 50 m de raio (100 m diâmetro),
// Plataformas 3D sólidas, Obstáculos Indestrutíveis, Objetos Destrutíveis com Respawn e Prévia Translúcida,
// Consumíveis (7 tipos com probabilidades iguais, drops balísticos, coleta esférica 3D),
// Progressão de 4 Estágios Permanentes por Atributo e Sistema de Escudo Temporário.
// Implementa rigorosamente as decisões das Rodadas 1–11 de docs/MAPA_COMBAT_LAB_DECISOES_RODADAS.md.



// Fachada: o conteúdo foi dividido em módulos menores (pasta map/); os nomes exportados continuam os mesmos.
export * from './map/map-config.js';
export * from './map/map-state.js';
export * from './map/map-spawn.js';
export * from './map/map-step.js';
export * from './map/map-consumables.js';
export * from './map/map-damage.js';
export * from './map/map-collision.js';

