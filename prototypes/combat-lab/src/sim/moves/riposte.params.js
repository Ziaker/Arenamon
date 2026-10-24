// @ts-check
// Parâmetros do Move "riposte" (declarativo): padrão em C.world.riposte, faixa, unidade, rótulo e dica de cada slider da aba Moves.
// Módulo PURO (só importa params-registry.js): o config.js o carrega, então C.world.riposte existe sempre, com ou sem os Moves registrados.
// Riposte: Normal Status+Melee PL1. Postura de 0,65 s; entre 0,13 e 0,30 s qualquer acerto elegível (menos Guard Break) é anulado e dispara um contra-golpe PL1 de 6 HP
// (× Ataque ÷ referência), 3 m/s H, na hora do gatilho (MV-P24); strikeRange = alcance do golpe (não definido no documento: MV-P25). Janela fechada sem acerto = recuperação exposta.
import {defineMoveParams, paramRow} from './params-registry.js';

/** Estado de governança dos valores do catálogo: implementado e testado, mas ainda NÃO aprovado nem homologado pelo diretor. */
const PROPOSTO = {proposto: true, aprovado: false, implementado: true, homologado: false};

export const params = defineMoveParams('riposte', {
    id: "riposte", title: "Riposte",
    meta: {category: 'Normal', types: ['Status', 'Melee'], pl: "SEM PL", status: PROPOSTO},
    hint: "Normal · Status + Melee. Toque e seja atingido entre 0,13 e 0,30 s: o golpe é anulado e você contra-ataca na hora. Fora do tempo, fica exposto.",
    rows: [
      paramRow({key: "cost", label: "Custo de stamina", tip: "Cobrado no toque, sem marcador (MV-P11). Valor da proposta — não homologada.", min: 0, max: 5, step: 0.05, unit: 'num', value: 0.8}),
      paramRow({key: "cooldown", label: "Cooldown", tip: "Começa junto com o custo (proposta: 8 s).", min: 0, max: 60, step: 0.5, unit: 'sec', value: 8}),
      paramRow({key: "cast", label: "Duração total da postura", tip: "Da postura ao fim da recuperação exposta (proposta: 0,65 s).", min: 0.2, max: 3, step: 0.01, unit: 'sec', value: 0.65}),
      paramRow({key: "windowStart", label: "Janela do contra-ataque: início", tip: "Acertos antes disto causam dano normal (proposta: 0,13 s).", min: 0, max: 2, step: 0.01, unit: 'sec', value: 0.13}),
      paramRow({key: "windowEnd", label: "Janela do contra-ataque: fim", tip: "Entre início e fim, o acerto é anulado e dispara o contra-golpe; Guard Break não é anulado (proposta: 0,30 s).", min: 0, max: 2, step: 0.01, unit: 'sec', value: 0.3}),
      paramRow({key: "damage", label: "Dano nominal do contra-golpe", tip: "Com o Ataque de referência; final = nominal × Ataque ÷ referência (MV-P13). Proposta: 6 HP.", min: 0, max: 40, step: 0.5, unit: 'num', value: 14}),
      paramRow({key: "knockbackH", label: "Knockback horizontal do contra-golpe", tip: "Empurrão em quem foi contra-atacado (laboratório: 9 m/s; a calibração do jogo substitui por 16,8).", min: 0, max: 40, step: 0.1, unit: 'ms', value: 9}),
      paramRow({key: "knockbackV", label: "Knockback vertical do contra-golpe", tip: "Com valor acima de zero o contra-golpe lança o alvo (laboratório: 2,5 m/s).", min: 0, max: 40, step: 0.1, unit: 'ms', value: 2.5}),
      paramRow({key: "strikeRange", label: "Alcance do contra-golpe", tip: "Distância percorrida pelo golpe rumo a quem atacou; não definida no documento (MV-P25).", min: 0.3, max: 6, step: 0.1, unit: 'm', value: 1.6}),
      paramRow({key: "hitstopMult", label: "Pausa de impacto do contra-golpe (×)", tip: "Multiplica a pausa (hitstop) normal de impacto quando o contra-golpe acerta: 1 = igual a um golpe comum; 2,5 = bem pesado (padrão).", min: 0, max: 8, step: 0.1, unit: 'num', value: 2.5}),
      paramRow({key: "shakeMult", label: "Tremor de tela do contra-golpe (×)", tip: "Multiplica o tremor de tela do impacto quando o contra-golpe acerta (padrão 2,4).", min: 0, max: 8, step: 0.1, unit: 'num', value: 2.4}),
      paramRow({key: "blastOn", label: "Explosão visual do contra-golpe", tip: "Efeito PROVISÓRIO: onda esférica, anéis, faíscas e clarão no alvo quando o contra-golpe acerta. 1 = ligado.", min: 0, max: 1, step: 1, unit: 'num', value: 1}),
      paramRow({key: "blastSize", label: "Tamanho da explosão visual", tip: "Escala da explosão provisória do contra-golpe (padrão 1,5).", min: 0.3, max: 5, step: 0.1, unit: 'num', value: 1.5}),
      paramRow({key: "fxOn", label: "Efeito visual: ligado", tip: "Liga/desliga o visual da postura (disco de aço e lâmina de guarda, dourados dentro da janela) e do contra-golpe (clarão, anel e corte em X). Só aparência.", min: 0, max: 1, step: 1, unit: 'yesno', value: 1}),
      paramRow({key: "fxIntensity", label: "Efeito visual: intensidade", tip: "Brilho e opacidade do visual do Riposte (1 = padrão). Só aparência.", min: 0, max: 3, step: 0.05, unit: 'num', value: 1}),
      paramRow({key: "fxSize", label: "Efeito visual: tamanho", tip: "Escala da lâmina, do disco e do clarão do Riposte (1 = padrão). Só aparência.", min: 0.3, max: 3, step: 0.05, unit: 'num', value: 1}),
    ],
  });
