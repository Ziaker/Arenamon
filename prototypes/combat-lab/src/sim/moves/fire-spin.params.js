// @ts-check
// Parâmetros do Move "fire-spin" (declarativo): padrão em C.world.fireSpin, faixa, unidade, rótulo e dica de cada slider da aba Moves.
// Módulo PURO (só importa params-registry.js): o config.js o carrega, então C.world.fireSpin existe sempre, com ou sem os Moves registrados.
// Fire Spin: Normal Field. Marcador de colocação (alcance 3D 10 m — pedido de 23/10 dobrou os 5 m do protótipo), cast 0,4 s + recovery 0,2 s, zona cilíndrica de 1,6 m de raio × 2,4 m,
// 2,4 s de vida, 4 pulsos a cada 0,6 s de 2 HP nominais, sem knockback e (padrão provisório) sem guard stun; occlusion = paredes bloqueiam o pulso; maxActive = zonas simultâneas por dono.
import {defineMoveParams, paramRow, hitShakeRows} from './params-registry.js';

/** Estado de governança dos valores do catálogo: implementado e testado, mas ainda NÃO aprovado nem homologado pelo diretor. */
const PROPOSTO = {proposto: true, aprovado: false, implementado: true, homologado: false};

export const params = defineMoveParams('fireSpin', {
    id: "fire-spin", title: "Fire Spin",
    meta: {category: 'Normal', types: ['Field'], pl: "SEM PL", status: PROPOSTO},
    hint: "Normal · Field. Segure para escolher o local (setas movem o marcador, até 20 m), solte para confirmar: após 0,4 s nasce um tornado de fogo (1,6 m de raio) que dá um pulso de dano a cada 0,6 s enquanto durar (2,4 s). O anel da prévia mostra o raio real da zona. Protótipo: números não homologados.",
    rows: [
      paramRow({key: "cost", label: "Custo de stamina", tip: "Cobrado ao CONFIRMAR o marcador (Normal); marcador inválido cancela sem custo. Prompt: 1,0.", min: 0, max: 5, step: 0.05, unit: 'num', value: 1}),
      paramRow({key: "cooldown", label: "Cooldown", tip: "Começa junto com o custo, na confirmação (prompt: 11 s).", min: 0, max: 60, step: 0.5, unit: 'sec', value: 11}),
      paramRow({key: "cast", label: "Cast (até a zona nascer)", tip: "Entre confirmar e a zona nascer (prompt: 0,4 s = 48 passos).", min: 0.05, max: 2, step: 0.01, unit: 'sec', value: 0.4}),
      paramRow({key: "recovery", label: "Recovery depois da zona nascer", tip: "Tempo até recuperar o controle; a zona vive sozinha (prompt: 0,2 s = 24 passos).", min: 0, max: 1, step: 0.01, unit: 'sec', value: 0.2}),
      paramRow({key: "range", label: "Alcance do marcador (3D)", tip: "Inclui a altura do apoio. Padrão atual: 20 m.", min: 1, max: 40, step: 0.5, unit: 'm', value: 20}),
      paramRow({key: "zoneRadius", label: "Raio da zona", tip: "Região ofensiva cilíndrica (prompt: 1,6 m). O anel da prévia usa este raio real.", min: 0.5, max: 4, step: 0.05, unit: 'm', value: 1.6}),
      paramRow({key: "zoneHeight", label: "Altura da zona", tip: "Faixa vertical que pega quem está dentro, a partir do apoio (prompt: 2,4 m).", min: 0.5, max: 5, step: 0.1, unit: 'm', value: 2.4}),
      paramRow({key: "life", label: "Duração da zona", tip: "Vida da entidade em tempo LOCAL (cada acerto congela o mundo 1 passo de hitstop). Não há limite de pulsos: a zona dá quantos pulsos couberem entre o start-up e o fim desta duração, um a cada intervalo (prompt: 2,4 s = 288 passos).", min: 0.5, max: 8, step: 0.1, unit: 'sec', value: 2.4}),
      paramRow({key: "interval", label: "Intervalo entre pulsos", tip: "Tempo entre um pulso e o seguinte. Quantidade de pulsos = o que couber na duração da zona (prompt: 0,6 s = 72 passos).", min: 0.1, max: 2, step: 0.05, unit: 'sec', value: 0.6}),
      paramRow({key: "startup", label: "Atraso do primeiro pulso (start-up)", tip: "Tempo, contado do nascimento da zona, antes do primeiro pulso de dano. 0 = o primeiro pulso sai logo que a zona nasce; os demais seguem a cada intervalo.", min: 0, max: 3, step: 0.05, unit: 'sec', value: 0}),
      paramRow({key: "damage", label: "Dano por pulso (nominal)", tip: "Final = nominal × Ataque ÷ referência (MV-P13); uma vez por alvo por pulso. Prompt: 2 HP (o teto de 8 HP por alvo é igual a 4 × 2, redundante).", min: 0, max: 10, step: 0.25, unit: 'num', value: 2}),
      paramRow({key: "knockbackH", label: "Knockback horizontal por pulso", tip: "Empurrão radial (para fora do centro da zona) em cada pulso. Padrão 0: a zona fere sem empurrar (prompt).", min: 0, max: 15, step: 0.1, unit: 'ms', value: 0}),
      paramRow({key: "knockbackV", label: "Knockback vertical por pulso", tip: "Com valor acima de 0 cada pulso lança o alvo para cima. Padrão 0.", min: 0, max: 15, step: 0.1, unit: 'ms', value: 0}),
      paramRow({key: "guardStun", label: "Guard stun por pulso", tip: "0 = quem defende toma o dano reduzido e continua livre (FS-P07 A, provisório). Com o valor do motor (0,514 s) a guarda trava ≈83% do tempo.", min: 0, max: 1, step: 0.01, unit: 'sec', value: 0}),
      paramRow({key: "occlusion", label: "Paredes bloqueiam os pulsos", tip: "Liga: sólidos de chão entre o centro e o alvo impedem o dano (plano XZ). Desligado: o dano atravessa (padrão do motor).", min: 0, max: 1, step: 1, unit: 'yesno', value: 1}),
      paramRow({key: "maxActive", label: "Zonas simultâneas por dono", tip: "A mais antiga some quando o limite é passado (FS-P04, provisório: 1).", min: 1, max: 4, step: 1, unit: 'int', value: 1}),
      paramRow({key: "allowOccupied", label: "Permitir colocar sobre um lutador", tip: "Desligado: o marcador fica inválido sobre personagens (prompt §3.1).", min: 0, max: 1, step: 1, unit: 'yesno', value: 1}),
      paramRow({key: "minRange", label: "Alcance mínimo do marcador", tip: "0 = pode colocar o destino colado em você.", min: 0, max: 10, step: 0.25, unit: 'm', value: 3}),
      paramRow({key: "markerSpeed", label: "Velocidade do marcador", tip: "Quão rápido a direção move o marcador enquanto o botão está segurado (8 m/s, MV-P29).", min: 1, max: 30, step: 0.5, unit: 'ms', value: 8}),
      paramRow({key: "markerAccel", label: "Aceleração do marcador", tip: "0 = instantâneo; o padrão desliza para o novo lado.", min: 0, max: 100, step: 1, unit: 'ms2', value: 24}),
      paramRow({key: "startDistance", label: "Distância inicial do marcador", tip: "Onde o marcador aparece ao apertar (3 m).", min: 0.5, max: 10, step: 0.25, unit: 'm', value: 3}),
      paramRow({key: "maxRise", label: "Altura máxima de apoio acima dos pés", tip: "Até que altura de plataforma o marcador alcança (2 m).", min: 0, max: 6, step: 0.25, unit: 'm', value: 2}),
      ...hitShakeRows(),
    ],
  });
