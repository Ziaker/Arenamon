// @ts-check
// Parâmetros do Move "water-pulse" (declarativo): padrão em C.world.waterPulse, faixa, unidade, rótulo e dica de cada slider da aba Moves.
// Módulo PURO (só importa params-registry.js): o config.js o carrega, então C.world.waterPulse existe sempre, com ou sem os Moves registrados.
// Water Pulse: Charge Projectile. Carga máx. 1,5 s (180 passos; PL2 em 90, PL3 em 180), custo e recarga na ativação, 6/9/12 HP nominais, empurrão H 2/3/4 (V 0 ⇒ o motor empurra 1,5 × H m),
// projétil de raio 0,38 m a 14 m/s e alcance 12 m (lifetime = alcance ÷ velocidade), recuperação de 0,30 s a partir da soltura. originHeight/spawnForward: nascimento (não definidos no prompt).
import {defineMoveParams, paramRow, hitShakeRows} from './params-registry.js';

/** Estado de governança dos valores do catálogo: implementado e testado, mas ainda NÃO aprovado nem homologado pelo diretor. */
const PROPOSTO = {proposto: true, aprovado: false, implementado: true, homologado: false};

export const params = defineMoveParams('waterPulse', {
    id: "water-pulse", title: "Water Pulse",
    meta: {category: 'Charge', types: ['Projectile'], pl: "PL1–PL3", status: PROPOSTO},
    hint: "Charge · Projectile · PL1–PL3. Segure para carregar (até 1,5 s; PL2 em 0,75 s, PL3 em 1,5 s) — a esfera de água cresce na mão — e solte para disparar UMA esfera reta, sem homing. Mais carga = mais dano e empurrão. Protótipo: números do prompt de 22/10, não homologados.",
    rows: [
      paramRow({key: "cost", label: "Custo de stamina", tip: "Cobrado quando a carga é ATIVADA (Charge, norma universal). Prompt: 1,0.", min: 0, max: 5, step: 0.05, unit: 'num', value: 1}),
      paramRow({key: "cooldown", label: "Cooldown", tip: "Começa junto com o custo, na ativação da carga. Interromper mantém a recarga cheia (prompt: 9 s).", min: 0, max: 60, step: 0.5, unit: 'sec', value: 9}),
      paramRow({key: "maxCharge", label: "Carga máxima", tip: "Tempo para o PL3; o PL2 vem em 50% dele. Em passos: 1,5 s = 180 (prompt: 1,5 s).", min: 0.5, max: 4, step: 0.05, unit: 'sec', value: 1.5}),
      paramRow({key: "minCharge", label: "Carga mínima para disparar", tip: "Soltar antes cancela (0 = sem mínimo).", min: 0, max: 2, step: 0.05, unit: 'sec', value: 0}),
      paramRow({key: "chargeRecovery", label: "Recuperação após soltar", tip: "Sem Tackle nem novos Moves a partir da soltura (prompt: 36 passos = 0,30 s). O projétil sai NO PASSO DA SOLTURA (WP-P08 A, provisório).", min: 0, max: 1, step: 0.01, unit: 'sec', value: 0.3}),
      paramRow({key: "damagePl1", label: "Dano PL1 (nominal)", tip: "Com o Ataque de referência; final = nominal × Ataque ÷ referência (MV-P13). Prompt: 6 HP.", min: 0, max: 40, step: 0.5, unit: 'num', value: 6}),
      paramRow({key: "damagePl2", label: "Dano PL2 (nominal)", tip: "Mesma regra do PL1 (MV-P13). Prompt: 9 HP.", min: 0, max: 40, step: 0.5, unit: 'num', value: 9}),
      paramRow({key: "damagePl3", label: "Dano PL3 (nominal)", tip: "Mesma regra do PL1 (MV-P13). Prompt: 12 HP.", min: 0, max: 40, step: 0.5, unit: 'num', value: 12}),
      paramRow({key: "knockbackPl1", label: "Empurrão H, PL1", tip: "ATENÇÃO: sem vertical, o motor empurra o alvo 1,5 × este valor em METROS (2 → 3 m) e dá 0,63 s de recuperação (EL-P04 A, provisório). Prompt: 2.", min: 0, max: 10, step: 0.1, unit: 'ms', value: 2}),
      paramRow({key: "knockbackPl2", label: "Empurrão H, PL2", tip: "Mesma regra do PL1: 1,5 × este valor em metros (prompt: 3).", min: 0, max: 10, step: 0.1, unit: 'ms', value: 3}),
      paramRow({key: "knockbackPl3", label: "Empurrão H, PL3", tip: "Mesma regra do PL1: 1,5 × este valor em metros (prompt: 4).", min: 0, max: 10, step: 0.1, unit: 'ms', value: 4}),
      paramRow({key: "knockbackV", label: "Empurrão V (todos os PL)", tip: "Componente vertical do empurrão. Acima de 0 o projétil LANÇA o alvo (voo) em vez de só deslizá-lo (prompt: 0).", min: 0, max: 15, step: 0.1, unit: 'ms', value: 0}),
      paramRow({key: "speed", label: "Velocidade do projétil", tip: "Velocidade escalar 3D (prompt: 14 m/s).", min: 5, max: 30, step: 0.5, unit: 'ms', value: 14}),
      paramRow({key: "radius", label: "Raio do projétil", tip: "Colisor circular (prompt: 0,38 m).", min: 0.1, max: 0.8, step: 0.01, unit: 'm', value: 0.38}),
      paramRow({key: "range", label: "Alcance", tip: "Distância máxima; a vida do projétil é alcance ÷ velocidade (o prompt tinha 12 m e 1,0 s, incoerentes a 14 m/s).", min: 3, max: 20, step: 0.5, unit: 'm', value: 12}),
      paramRow({key: "originHeight", label: "Altura de nascimento (mão)", tip: "Acima da altitude do atirador (chão, plataforma ou voo). Não definida no prompt.", min: 0.2, max: 1.3, step: 0.05, unit: 'm', value: 0.8}),
      paramRow({key: "spawnForward", label: "Distância de nascimento", tip: "À frente do corpo. Se houver sólido ali, o Move FALHA com reembolso (sem teletransporte).", min: 0.3, max: 1.5, step: 0.05, unit: 'm', value: 0.7}),
      paramRow({key: "counterStagger", label: "Counter Stagger", tip: "Stagger do derrotado quando este projétil vence um Counter e atinge o corpo (M21.5: 0,2 s).", min: 0, max: 1, step: 0.01, unit: 'sec', value: 0.2, approved: true}),
      ...hitShakeRows(),
    ],
  });
