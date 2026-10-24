// @ts-check
// Parâmetros do Move "feint" (declarativo): padrão em C.world.feint, faixa, unidade, rótulo e dica de cada slider da aba Moves.
// Módulo PURO (só importa params-registry.js): o config.js o carrega, então C.world.feint existe sempre, com ou sem os Moves registrados.
// Feint: Burst Trick sem PL. Cancela Tackle/Lunge/Guard Break (e a carga de Tackle) só na antecipação (cancelWindow = 4 quadros a 30 fps = 0,133 s) e vira um recuo curto
// (retreat m, para trás ou para o lado do input) com i-frames de 2 a 10 passos a 120 Hz. Fora da janela o Move é gasto sem efeito e o golpe segue (punível; MV-P21).
import {defineMoveParams, paramRow} from './params-registry.js';

/** Estado de governança dos valores do catálogo: implementado e testado, mas ainda NÃO aprovado nem homologado pelo diretor. */
const PROPOSTO = {proposto: true, aprovado: false, implementado: true, homologado: false};

export const params = defineMoveParams('feint', {
    id: "feint", title: "Feint",
    meta: {category: 'Burst', types: ['Trick'], pl: "SEM PL", status: PROPOSTO},
    hint: "Burst · Trick. Toque logo após iniciar um ataque (ou durante a carga) para cancelá-lo e recuar com i-frames curtos. Tarde demais: gasta o Move e o ataque segue.",
    rows: [
      paramRow({key: "cost", label: "Custo de stamina", tip: "Cobrado na confirmação (Burst); o custo da ação cancelada não volta (MV-P26). Valor da proposta — não homologada.", min: 0, max: 3, step: 0.05, unit: 'num', value: 0.3}),
      paramRow({key: "cooldown", label: "Cooldown", tip: "Começa junto com o custo (proposta: 3 s).", min: 0, max: 30, step: 0.5, unit: 'sec', value: 3}),
      paramRow({key: "cast", label: "Duração do recuo", tip: "Do disparo até o fim do recuo (proposta: 0,22 s).", min: 0.05, max: 1, step: 0.01, unit: 'sec', value: 0.22}),
      paramRow({key: "cancelAfter", label: "Libera outras ações após", tip: "Instante a partir do qual esquiva/ataque/outro Move podem começar (provisório: 0,033 s).", min: 0, max: 1, step: 0.01, unit: 'sec', value: 0.0333}),
      paramRow({key: "cancelWindow", label: "Janela de cancelamento do ataque", tip: "Só cancela Tackle/Lunge/Guard Break que ainda estão nesta antecipação (proposta: 4 quadros = 0,133 s); depois o Move é gasto sem efeito (MV-P21). Cargas em curso sempre são canceladas.", min: 0, max: 1, step: 0.01, unit: 'sec', value: 0.1333}),
      paramRow({key: "retreat", label: "Distância do recuo", tip: "Deslocamento para trás (ou para o lado do input). A proposta varia de 5,5 cm a 40 cm; provisório: 25 cm.", min: 0, max: 2, step: 0.01, unit: 'm', value: 0.25}),
      paramRow({key: "invulnStart", label: "I-frames: início", tip: "Micro-janela de invulnerabilidade durante o recuo (proposta: passo 2 = 0,017 s).", min: 0, max: 0.5, step: 0.005, unit: 'sec', value: 0.0167}),
      paramRow({key: "invulnEnd", label: "I-frames: fim", tip: "Fim da invulnerabilidade (proposta: passo 10 = 0,083 s).", min: 0, max: 0.5, step: 0.005, unit: 'sec', value: 0.0833}),
    ],
  });
