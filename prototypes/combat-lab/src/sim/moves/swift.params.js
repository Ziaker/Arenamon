// @ts-check
// Parâmetros do Move "swift" (declarativo): padrão em C.world, faixa, unidade, rótulo e dica de cada slider da aba Moves.
// Módulo PURO (só importa params-registry.js): o config.js o carrega, então C.world.swift existe sempre, com ou sem os Moves registrados.
import {defineMoveParams, paramRow, hitShakeRows} from './params-registry.js';

/** Estado de governança dos valores do catálogo: implementado e testado, mas ainda NÃO aprovado nem homologado pelo diretor. */
const PROPOSTO = {proposto: true, aprovado: false, implementado: true, homologado: false};

export const params = defineMoveParams('swift', {
    id: 'swift', title: "Swift",
    meta: {category: 'Burst', types: ['Projectile'], pl: 'PL1', status: PROPOSTO},
    hint: 'Burst · Projectile · PL1. Toque para disparar 3 estrelas com homing curto (com alvo travado) ou em leque (sem alvo).',
    rows: [
      paramRow({key: "cost", label: "Custo de stamina", tip: "Cobrado no início do uso (Burst); vale nos PRÓXIMOS usos (M28.4). Valor do catálogo — proposta, não homologada.", min: 0, max: 5, step: 0.05, unit: 'num', value: 0.8}),
      paramRow({key: "cooldown", label: "Cooldown", tip: "Começa junto com o custo, no início do uso (proposta).", min: 0, max: 60, step: 0.5, unit: 'sec', value: 7}),
      paramRow({key: "cast", label: "Duração da ação", tip: "Tempo da ação (recuperação do Burst: não definido no catálogo; provisório MV-P14).", min: 0.05, max: 2, step: 0.01, unit: 'sec', value: 0.25}),
      paramRow({key: "count", label: "Quantidade de estrelas", tip: "Estrelas por uso (catálogo: 3).", min: 1, max: 9, step: 1, unit: 'int', value: 3}),
      paramRow({key: "speed", label: "Velocidade", tip: "Velocidade de cada estrela (catálogo: 15 m/s).", min: 2, max: 40, step: 0.5, unit: 'ms', value: 15}),
      paramRow({key: "damage", label: "Dano nominal por estrela", tip: "Dano com o Ataque de referência; final = nominal × Ataque ÷ referência (MV-P13). Catálogo: 3 HP.", min: 0, max: 30, step: 0.5, unit: 'num', value: 3}),
      paramRow({key: "homingSeconds", label: "Duração do homing", tip: "Só com alvo travado; sem garantia de acerto (catálogo: 0,25 s).", min: 0, max: 1.5, step: 0.05, unit: 'sec', value: 0.25}),
      paramRow({key: "homingRate", label: "Correção angular do homing", tip: "Graus por segundo (catálogo: 90°/s).", min: 0, max: 720, step: 10, unit: 'deg', value: 90}),
      paramRow({key: "range", label: "Alcance máximo", tip: "Distância percorrida antes de expirar (catálogo: 12 m).", min: 2, max: 40, step: 0.5, unit: 'm', value: 12}),
      paramRow({key: "knockback", label: "Knockback por acerto", tip: "Empurrão horizontal de cada estrela (catálogo: 0,3 m/s); vertical é sempre 0.", min: 0, max: 10, step: 0.05, unit: 'ms', value: 0.3}),
      paramRow({key: "knockbackV", label: "Knockback vertical por acerto", tip: "Componente vertical do empurrão de cada estrela; acima de 0 a estrela lança o alvo para cima (catálogo: 0).", min: 0, max: 15, step: 0.05, unit: 'ms', value: 0}),
      paramRow({key: "knockbackCap", label: "Teto de knockback por alvo e execução", tip: "Máximo acumulado pelas estrelas de um mesmo uso (catálogo: 0,9 m/s).", min: 0, max: 10, step: 0.05, unit: 'ms', value: 0.9}),
      paramRow({key: "radius", label: "Raio de colisão da estrela", tip: "Colisor de cada estrela (provisório).", min: 0.05, max: 0.5, step: 0.01, unit: 'm', value: 0.2}),
      paramRow({key: "fanAngle", label: "Leque sem alvo travado", tip: "Abertura total do leque frontal quando não há lock-on (provisório).", min: 0, max: 90, step: 1, unit: 'deg', value: 20}),
      paramRow({key: "spawnForward", label: "Saída à frente do lançador", tip: "Distância à frente em que as estrelas nascem (provisório).", min: 0.3, max: 2, step: 0.05, unit: 'm', value: 0.9}),
      paramRow({key: "spawnSpacing", label: "Espaçamento lateral na saída", tip: "Distância lateral entre as estrelas ao nascer (provisório).", min: 0, max: 1.5, step: 0.05, unit: 'm', value: 0.35}),
      paramRow({key: "counterStagger", label: "Counter Stagger", tip: "Stagger quando a estrela vence uma disputa de PL e atinge o corpo (M21.5; PL1 não vence PL1).", min: 0, max: 1, step: 0.01, unit: 'sec', value: 0.2}),
      ...hitShakeRows(),
    ],
  });
