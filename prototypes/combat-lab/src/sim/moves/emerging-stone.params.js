// @ts-check
// Parâmetros do Move "emerging-stone" (declarativo): padrão em C.world.emergingStone, faixa, unidade, rótulo e dica de cada slider da aba Moves.
// Módulo PURO (só importa params-registry.js): o config.js o carrega, então C.world.emergingStone existe sempre, com ou sem os Moves registrados.
// Emerging Stone (ES-D01…D103, cronologia C): cast 0,55 s (corpo a 30%), marcador 3–10 m 3D, projétil 15 m/s, explosão de 5 m horizontais (20 nominais × Ataque ÷ referência, 8 m/s radial),
// rocha 3 m × escala (0,25–4×, passo 0,25), emerge em 0,40 s, 5 HP, lançamento da emergência 8 H/14 V, até 3 por dono. markerSpeed/startDistance/rockSearch/maxRise: provisórios.
import {defineMoveParams, paramRow, hitShakeRows} from './params-registry.js';

export const params = defineMoveParams('emergingStone', {
    id: "emerging-stone", title: "Emerging Stone",
    hint: "Normal. Segure: o cast de 0,55 s começa já e as setas movem o marcador (3–10 m); solte com o cast completo para o projétil subterrâneo ir ao marcador, explodir (5 m) e deixar uma rocha 3×3×3 m.",
    rows: [
      paramRow({key: "cost", label: "Custo de stamina", tip: "Cobrado só quando o cast terminou E o botão foi solto com destino válido, antes do disparo; sem reembolso (documento: 3).", min: 0, max: 10, step: 0.1, unit: 'num', value: 3}),
      paramRow({key: "cooldown", label: "Cooldown", tip: "Começa junto com o custo, no disparo (documento: 9 s).", min: 0, max: 60, step: 0.5, unit: 'sec', value: 9}),
      paramRow({key: "cast", label: "Cast físico", tip: "Começa ao pressionar; o disparo espera o cast terminar E a soltura (documento: 0,55 s).", min: 0.1, max: 3, step: 0.05, unit: 'sec', value: 0.55}),
      paramRow({key: "castSlow", label: "Redução de velocidade no cast", tip: "0,7 = anda a 30% durante o cast; depois não há lentidão extra (documento: 70%).", min: 0, max: 0.95, step: 0.05, unit: 'pct', value: 0.7}),
      paramRow({key: "minRange", label: "Alcance mínimo do marcador (3D)", tip: "Marcador mais perto que isto fica vermelho e não confirma (documento: 3 m).", min: 0, max: 10, step: 0.25, unit: 'm', value: 3}),
      paramRow({key: "range", label: "Alcance máximo do marcador (3D)", tip: "Inclui a diferença de altura (documento: 10 m).", min: 1, max: 30, step: 0.5, unit: 'm', value: 10}),
      paramRow({key: "speed", label: "Velocidade do projétil", tip: "Linha reta virtual, atravessa paredes e buracos (documento: 15 m/s).", min: 2, max: 60, step: 0.5, unit: 'ms', value: 15}),
      paramRow({key: "blastRadius", label: "Raio da explosão (horizontal)", tip: "Independe da altura e atravessa paredes (documento: 5 m).", min: 0.5, max: 20, step: 0.25, unit: 'm', value: 5}),
      paramRow({key: "damage", label: "Dano nominal da explosão", tip: "Com o Ataque de referência; final = nominal × Ataque ÷ referência (MV-P13). Documento: 20.", min: 0, max: 100, step: 1, unit: 'num', value: 20}),
      paramRow({key: "blastKnockback", label: "Empurrão radial da explosão (horizontal)", tip: "Horizontal, para fora do centro (documento: 8 m/s).", min: 0, max: 15, step: 0.5, unit: 'ms', value: 8}),
      paramRow({key: "blastKnockbackV", label: "Empurrão radial da explosão (vertical)", tip: "Com valor acima de 0 a explosão também lança o alvo para cima. Padrão 0.", min: 0, max: 15, step: 0.1, unit: 'ms', value: 0}),
      paramRow({key: "rockScale", label: "Escala do prisma da rocha", tip: "Prisma 3×3×3 m × escala; colisor, topo e espaço necessário acompanham (documento: 0,25× a 4×, passo 0,25, padrão 1×).", min: 0.25, max: 4, step: 0.25, unit: 'x', value: 1}),
      paramRow({key: "rockHp", label: "HP da rocha", tip: "Dano por golpe válido: sem PL 1, PL1 2, PL2 3, PL3 4 (documento: 5 HP).", min: 1, max: 30, step: 1, unit: 'int', value: 5}),
      paramRow({key: "riseTime", label: "Tempo de emergência", tip: "Colisor e topo crescem com a altura exposta (documento: 0,40 s).", min: 0.1, max: 3, step: 0.05, unit: 'sec', value: 0.4}),
      paramRow({key: "launchH", label: "Lançamento da emergência: horizontal", tip: "Uma vez por personagem, na primeira interseção com a parte exposta (documento: 8 m/s).", min: 0, max: 30, step: 0.5, unit: 'ms', value: 8}),
      paramRow({key: "launchV", label: "Lançamento da emergência: vertical", tip: "Idem (documento: 14 m/s).", min: 0, max: 40, step: 0.5, unit: 'ms', value: 14}),
      paramRow({key: "maxRocks", label: "Rochas simultâneas por dono", tip: "A nova destrói a mais antiga que sobrou da explosão (documento: 3).", min: 1, max: 10, step: 1, unit: 'int', value: 3}),
      paramRow({key: "rockSearch", label: "Busca de lugar válido (m)", tip: "Se o prisma não couber no marcador, procura o lugar válido mais próximo até esta distância; a explosão fica no marcador (provisório: 4 m).", min: 0, max: 10, step: 0.25, unit: 'm', value: 4}),
      paramRow({key: "startDistance", label: "Distância inicial do marcador", tip: "Onde o marcador nasce ao pressionar (provisório: 5 m).", min: 1, max: 10, step: 0.25, unit: 'm', value: 5}),
      paramRow({key: "markerAccel", label: "Aceleração do marcador", tip: "Quão rápido o marcador ganha velocidade ao mudar a direção do corpo: ele DESLIZA para o novo lado em vez de aparecer lá. 0 = instantâneo (como antes); padrão 24 m/s².", min: 0, max: 200, step: 1, unit: 'num', value: 24}),
      paramRow({key: "fxTrailOn", label: "Rastro de terra do projétil", tip: "Efeito PROVISÓRIO: sulco de terra, montículo grande e terra saltando ao longo do trajeto subterrâneo. 1 = ligado.", min: 0, max: 1, step: 1, unit: 'yesno', value: 1}),
      paramRow({key: "fxTrailSize", label: "Tamanho do rastro de terra", tip: "Escala do montículo, do sulco e da terra que salta (padrão 1,8×; 1 = tamanho antigo).", min: 0.5, max: 5, step: 0.1, unit: 'x', value: 1.8}),
      paramRow({key: "markerSpeed", label: "Velocidade do marcador", tip: "Quão rápido a direção move o marcador (provisório: 8 m/s).", min: 1, max: 30, step: 0.5, unit: 'ms', value: 8}),
      paramRow({key: "maxRise", label: "Altura de apoio do marcador (técnico)", tip: "Até que altura acima dos pés o marcador procura apoio.", min: 0, max: 6, step: 0.25, unit: 'm', value: 2}),
      paramRow({key: "edgeMargin", label: "Folga da borda da arena (técnico)", tip: "O marcador não passa desta distância da borda.", min: 0, max: 2, step: 0.05, unit: 'm', value: 0.3}),
      paramRow({key: "radius", label: "Folga contra paredes do marcador (técnico)", tip: "0 = o marcador pode ficar colado; a rocha procura lugar se não couber.", min: 0, max: 3, step: 0.1, unit: 'm', value: 0}),
      paramRow({key: "allowOccupied", label: "Marcador sobre personagem?", tip: "1 = pode (a rocha lança quem estiver no local); 0 = marcador inválido sobre corpos.", min: 0, max: 1, step: 1, unit: 'yesno', value: 1}),
      ...hitShakeRows(),
    ],
  });
