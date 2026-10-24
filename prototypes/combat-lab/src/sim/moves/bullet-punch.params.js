// @ts-check
// Parâmetros do Move "bullet-punch" (declarativo): padrão em C.world.bulletPunch, faixa, unidade, rótulo e dica de cada slider da aba Moves.
// Módulo PURO (só importa params-registry.js): o config.js o carrega, então C.world.bulletPunch existe sempre, com ou sem os Moves registrados.
// Bullet Punch (como o Quick Attack, decisão de 22/10/2026): alvo = adversário mais próximo dentro de `reach` (alcance do Move), fixado ao soltar; preparação 0,75 s (corpo a 30%, slow .7),
// desaparecimento de `vanish` s numa corrida invisível até `stopShort` m do alvo, golpe PL2 de `strikeReach` m ao chegar (ou no primeiro adversário a `hitRadius` m do caminho),
// custo 1,5× o do Tackle (Tackle = 1) e 8 s; impactMult = velocidade de impacto do knockback. fxLines/fxHideBody: visual do sumiço (linhas de velocidade e corpo oculto).
import {defineMoveParams, paramRow} from './params-registry.js';

export const params = defineMoveParams('bulletPunch', {
    id: "bullet-punch", title: "Bullet Punch",
    hint: "Normal · PL2. Como o Quick Attack: segure para ver o círculo de alcance (azul = alvo dentro, vermelho = fora), solte: prepara 0,75 s, some por 0,2 s numa corrida invisível até o adversário mais próximo e golpeia ao chegar (quem estiver no caminho leva o golpe).",
    rows: [
      paramRow({key: "cost", label: "Custo de stamina (× Tackle)", tip: "Cobrado na SOLTURA com alvo no alcance, junto com a recarga; 1,5 = 1,5× o custo do Tackle (documento: 1,5×; faixa 0–5×).", min: 0, max: 5, step: 0.1, unit: 'x', value: 1.5}),
      paramRow({key: "cooldown", label: "Cooldown", tip: "Começa na soltura (documento: 8 s).", min: 0, max: 60, step: 0.5, unit: 'sec', value: 8}),
      paramRow({key: "cast", label: "Preparação", tip: "Depois de soltar; anda a 30% e pode ser interrompida mantendo o custo (documento: 0,75 s).", min: 0.1, max: 3, step: 0.05, unit: 'sec', value: 0.75}),
      paramRow({key: "vanish", label: "Tempo da corrida invisível", tip: "Tempo da viagem invisível até o alvo: o lutador não existe fisicamente (sem corpo, colisão, acerto nem alvo) e a câmera o acompanha (padrão: 0,2 s; faixa 0,05–6 s).", min: 0.05, max: 6, step: 0.05, unit: 'sec', value: 0.2}),
      paramRow({key: "reach", label: "Alcance do Move (aquisição do alvo)", tip: "Como o Quick Attack: o alvo é o adversário elegível mais próximo dentro desta distância, fixado ao soltar o botão. É o raio do círculo azul/vermelho que aparece ao segurar o botão (calibração: 6 m).", min: 0.5, max: 20, step: 0.25, unit: 'm', value: 6}),
      paramRow({key: "strikeReach", label: "Alcance do golpe na chegada", tip: "Distância percorrida pelo Tackle PL2 que sai NO MOMENTO da chegada, rumo ao alvo (padrão 2,2 m).", min: 0.5, max: 8, step: 0.1, unit: 'm', value: 2.2}),
      paramRow({key: "stopShort", label: "Distância de parada antes do alvo", tip: "A corrida invisível termina a esta distância do alvo (centro a centro), para o golpe acertar na hora (padrão 1,1 m; abaixo de 0,8 m a corrida já conta como contato).", min: 0.6, max: 4, step: 0.1, unit: 'm', value: 1.1}),
      paramRow({key: "hitRadius", label: "Raio de contato no caminho", tip: "Quem ficar a menos desta distância do trecho da corrida invisível leva o golpe e a corrida para ali (padrão 0,8 m).", min: 0.3, max: 3, step: 0.05, unit: 'm', value: 0.8}),
      paramRow({key: "impactMult", label: "Velocidade de impacto do knockback (× Tackle)", tip: "Multiplica a velocidade de impacto usada na fórmula do Tackle (documento: 1×; faixa 0–5×).", min: 0, max: 5, step: 0.1, unit: 'x', value: 1}),
      paramRow({key: "knockbackOwn", label: "Knockback próprio (em vez da fórmula do Tackle)", tip: "Desligado (padrão): o empurrão vem da fórmula do Tackle × a velocidade de impacto acima. Ligado: usa o Knockback horizontal e vertical abaixo, como o Lunge.", min: 0, max: 1, step: 1, unit: 'yesno', value: 0}),
      paramRow({key: "knockbackH", label: "Knockback horizontal (próprio)", tip: "Empurrão deslizante no alvo; só vale com “Knockback próprio” ligado.", min: 0, max: 15, step: 0.1, unit: 'ms', value: 4}),
      paramRow({key: "knockbackV", label: "Knockback vertical (próprio)", tip: "Com valor acima de 0 o golpe lança o alvo; só vale com “Knockback próprio” ligado.", min: 0, max: 15, step: 0.1, unit: 'ms', value: 0}),
      paramRow({key: "slow", label: "Redução da velocidade na preparação", tip: "0,7 = anda a 30% durante a preparação (documento: 70%).", min: 0, max: 0.95, step: 0.05, unit: 'pct', value: 0.7}),
      paramRow({key: "maxRise", label: "Altura de apoio na chegada (técnico)", tip: "Até que altura acima dos pés o lutador procura apoio ao reaparecer.", min: 0, max: 6, step: 0.25, unit: 'm', value: 2}),
      paramRow({key: "fxLines", label: "Linhas de velocidade no sumiço", tip: "Desenha linhas de velocidade do ponto de partida até o alvo enquanto o lutador some (e outras na volta, no Quick Attack). Só aparência.", min: 0, max: 1, step: 1, unit: 'yesno', value: 1}),
      paramRow({key: "fxHideBody", label: "Ocultar o corpo durante o sumiço", tip: "Liga/desliga o desaparecimento visual do corpo (a simulação não muda). Só aparência.", min: 0, max: 1, step: 1, unit: 'yesno', value: 1}),
      paramRow({key: "airReach", label: "Alcance vertical anti-aéreo", tip: "Altura de alvo em voo que o Move consegue adquirir e acertar (0 = só no chão). Padrão: 3 m.", min: 0, max: 8, step: 0.25, unit: 'm', value: 3}),
    ],
  });
