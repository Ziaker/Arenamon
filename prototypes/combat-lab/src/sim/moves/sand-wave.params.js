// @ts-check
// Parâmetros do Move "sand-wave" (declarativo): padrão em C.world.sandWave, faixa, unidade, rótulo e dica de cada slider da aba Moves.
// Módulo PURO (só importa params-registry.js): o config.js o carrega, então C.world.sandWave existe sempre, com ou sem os Moves registrados.
// Sand Wave: Burst PL1 (MUSHROOM_MOVES_DECISOES §6). Prep 0,25 s, barragem 1,5 s (0,75 s de hitbox + 0,75 s de dissipação), retângulo 4 (frente) × 3 (lado) m, 6 HP fixos,
// empurrão 12 m/s² (×0,5 na parcial), cegueira 4 s, stagger de parede 0,30 s, visão do cegado 10 m, fog = redução de 60% da luz. cell/detour/replanSteps: grade do caminho livre (técnicos).
import {defineMoveParams, paramRow, hitShakeRows} from './params-registry.js';

export const params = defineMoveParams('sandWave', {
    id: "sand-wave", title: "Sand Wave",
    hint: "Burst · PL1 · só no chão. Toque: após 0,25 s lança uma barragem de areia 4 × 3 m que fere (6 HP), empurra e cega por 4 s quem estiver no chão dentro dela.",
    rows: [
      paramRow({key: "cost", label: "Custo de stamina", tip: "Cobrado na ATIVAÇÃO (t = 0), antes da preparação. Valor do documento (2).", min: 0, max: 5, step: 0.05, unit: 'num', value: 2}),
      paramRow({key: "cooldown", label: "Cooldown", tip: "Começa junto com o custo (documento: 10 s).", min: 0, max: 60, step: 0.5, unit: 'sec', value: 10}),
      paramRow({key: "cast", label: "Preparação", tip: "Único período obrigatório; sair do chão ou ser interrompido cancela sem devolver nada (documento: 0,25 s).", min: 0.05, max: 2, step: 0.01, unit: 'sec', value: 0.25}),
      paramRow({key: "length", label: "Alcance frontal (ALTURA na vista superior)", tip: "Comprimento do retângulo à frente do lançador (documento: 4 m; faixa 0,5–30 m). Velocidade da onda = alcance ÷ janela ativa.", min: 0.5, max: 30, step: 0.25, unit: 'm', value: 4}),
      paramRow({key: "width", label: "Largura", tip: "Extensão lateral do retângulo (documento: 3 m; faixa 0,5–20 m).", min: 0.5, max: 20, step: 0.25, unit: 'm', value: 3}),
      paramRow({key: "active", label: "Janela de acerto (hitbox)", tip: "Primeiros segundos da barragem: a onda avança e atinge (documento: 0,75 s).", min: 0.1, max: 3, step: 0.05, unit: 'sec', value: 0.75}),
      paramRow({key: "dissipate", label: "Dissipação visual", tip: "Tempo extra só de efeito, sem hitbox nem empurrão (documento: 0,75 s).", min: 0, max: 3, step: 0.05, unit: 'sec', value: 0.75}),
      paramRow({key: "damage", label: "Dano fixo", tip: "HP por inimigo por execução, independente do Ataque (documento: 6 HP).", min: 0, max: 40, step: 0.5, unit: 'num', value: 6}),
      paramRow({key: "knockbackH", label: "Knockback horizontal (golpe inicial)", tip: "Empurrão único no primeiro contato, além da aceleração contínua da onda. Padrão 0 (documento: só a aceleração).", min: 0, max: 15, step: 0.1, unit: 'ms', value: 0}),
      paramRow({key: "knockbackV", label: "Knockback vertical (golpe inicial)", tip: "Com valor acima de 0 o primeiro contato lança o alvo para cima. Padrão 0.", min: 0, max: 15, step: 0.1, unit: 'ms', value: 0}),
      paramRow({key: "accel", label: "Empurrão (aceleração)", tip: "Aceleração horizontal enquanto houver contato na janela; metade sob defesa parcial (documento: 12 m/s²).", min: 0, max: 40, step: 0.5, unit: 'ms2', value: 12}),
      paramRow({key: "partialFactor", label: "Fator do empurrão na defesa parcial", tip: "Multiplica a aceleração quando o alvo defende (documento: 0,5).", min: 0, max: 1, step: 0.05, unit: 'num', value: 0.5}),
      paramRow({key: "blind", label: "Duração da cegueira", tip: "Reiniciada (não somada) a cada novo acerto válido; defesa perfeita anula (documento: 4 s).", min: 0, max: 15, step: 0.25, unit: 'sec', value: 4}),
      paramRow({key: "wallStagger", label: "Stagger contra a parede", tip: "Sem dano extra; não renova enquanto o alvo continuar pressionado (documento: 0,30 s).", min: 0, max: 2, step: 0.05, unit: 'sec', value: 0.3}),
      paramRow({key: "visionRadius", label: "Raio de visão do cegado", tip: "Lock-on e IA só enxergam adversários até esta distância e com linha de visão (documento: 10 m).", min: 2, max: 30, step: 0.5, unit: 'm', value: 10}),
      paramRow({key: "fogDarkness", label: "Escurecimento do fog (só a câmera do cegado)", tip: "Redução da luz ambiente na visão do jogador cegado (documento: 60%). A arte final da areia/nuvem ainda não foi aprovada.", min: 0, max: 1, step: 0.05, unit: 'pct', value: 0.6}),
      paramRow({key: "cell", label: "Resolução do caminho livre (técnico)", tip: "Tamanho da célula da grade que calcula o caminho mais curto da onda ao redor de obstáculos.", min: 0.1, max: 1, step: 0.05, unit: 'm', value: 0.25}),
      paramRow({key: "detour", label: "Margem de desvio (técnico)", tip: "Quanto a grade se estende além do retângulo para a areia contornar obstáculos (provisório: 3 m).", min: 0, max: 10, step: 0.5, unit: 'm', value: 3}),
      paramRow({key: "replanSteps", label: "Recalcular obstáculos a cada (passos)", tip: "Obstáculos móveis: o caminho é refeito neste intervalo (SW-D67; provisório: 6).", min: 1, max: 60, step: 1, unit: 'int', value: 6}),
      ...hitShakeRows(),
    ],
  });
