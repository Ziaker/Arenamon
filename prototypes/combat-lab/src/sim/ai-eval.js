// @ts-check
// Avaliação da IA com sementes fixas (sem renderização): taxas de vitória, ações executadas, stamina gasta e
// desperdiçada, ações negadas, contra-ataques, dano de projéteis e decisões contextuais.
// Suporta comparação pareada nos dois lados da arena (azul e vermelho alternados com as mesmas sementes),
// matriz de loadouts (sem moves, reflect, psyshock, ambos), blocos de sementes e cenários difíceis.
// As duas IAs jogam com as MESMAS regras do jogador (mesmo controlador, mesmos custos); nada aqui dá vantagem.



// Fachada: o conteúdo foi dividido em módulos menores (pasta ai-eval/); os nomes exportados continuam os mesmos.
export * from './ai-eval/eval-loadout.js';
export * from './ai-eval/eval-match.js';
export * from './ai-eval/eval-series.js';
export * from './ai-eval/eval-scenarios.js';
export * from './ai-eval/eval-matrix.js';

