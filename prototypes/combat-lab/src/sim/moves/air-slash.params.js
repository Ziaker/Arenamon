// @ts-check
// Parâmetros do Move "air-slash" (declarativo): padrão em C.world.airSlash, faixa, unidade, rótulo e dica de cada slider da aba Moves.
// Módulo PURO (só importa params-registry.js): o config.js o carrega, então C.world.airSlash existe sempre, com ou sem os Moves registrados.
// Air Slash: Burst Projectile PL1. Startup 8 passos + recovery 20 passos, lâmina a 22 m/s com alcance 10 m (lifetime = alcance ÷ velocidade), colisor = círculo equivalente de raio 0,6 m,
// 8 HP nominais, empurrão H 2,5 (V 0). visualWidth/Height/Thickness: só o desenho da lâmina (1,20 × 0,70 × 0,22 m).
import {defineMoveParams, paramRow, hitShakeRows} from './params-registry.js';

/** Estado de governança dos valores do catálogo: implementado e testado, mas ainda NÃO aprovado nem homologado pelo diretor. */
const PROPOSTO = {proposto: true, aprovado: false, implementado: true, homologado: false};

export const params = defineMoveParams('airSlash', {
    id: "air-slash", title: "Air Slash",
    meta: {category: 'Burst', types: ['Projectile'], pl: "PL1", status: PROPOSTO},
    hint: "Burst · Projectile · PL1. Toque: após 8 passos (0,067 s) nasce uma lâmina de ar rápida em linha reta, sem homing; com alvo travado a mira é a do instante do toque. Protótipo: números não homologados.",
    rows: [
      paramRow({key: "cost", label: "Custo de stamina", tip: "Cobrado NO TOQUE (Burst, MV-P11). Prompt: 0,8.", min: 0, max: 5, step: 0.05, unit: 'num', value: 0.8}),
      paramRow({key: "cooldown", label: "Cooldown", tip: "Começa no toque (prompt: 6 s).", min: 0, max: 60, step: 0.5, unit: 'sec', value: 6}),
      paramRow({key: "startup", label: "Startup (sem hitbox)", tip: "Do toque até a lâmina nascer (prompt: 8 passos = 0,067 s).", min: 0, max: 0.5, step: 0.005, unit: 'sec', value: 0.06666666666666667}),
      paramRow({key: "recovery", label: "Recovery", tip: "Depois da lâmina nascer, até recuperar o controle (prompt: 20 passos = 0,167 s).", min: 0, max: 1, step: 0.005, unit: 'sec', value: 0.16666666666666666}),
      paramRow({key: "speed", label: "Velocidade da lâmina", tip: "Prompt: 22 m/s.", min: 5, max: 50, step: 0.5, unit: 'ms', value: 22}),
      paramRow({key: "range", label: "Alcance", tip: "A vida da lâmina é alcance ÷ velocidade (o prompt tinha 10 m e 0,60 s, incoerentes a 22 m/s).", min: 2, max: 25, step: 0.5, unit: 'm', value: 10}),
      paramRow({key: "radius", label: "Raio do colisor (equivalente)", tip: "O motor colide projéteis como CÍRCULO; a caixa 1,20 × 0,70 × 0,22 do prompt é só o desenho (AS-P02 A, provisório). Alcança 0,5 m + este raio do centro do alvo.", min: 0.1, max: 1.5, step: 0.05, unit: 'm', value: 0.6}),
      paramRow({key: "damage", label: "Dano (nominal)", tip: "Final = nominal × Ataque ÷ referência (MV-P13). Prompt: 8 HP.", min: 0, max: 40, step: 0.5, unit: 'num', value: 8}),
      paramRow({key: "knockbackH", label: "Empurrão H", tip: "ATENÇÃO: sem vertical, o motor empurra 1,5 × este valor em METROS (2,5 → 3,75 m) e dá 0,63 s de recuperação (EL-P04 A, provisório). Prompt: 2,5.", min: 0, max: 12, step: 0.1, unit: 'ms', value: 2.5}),
      paramRow({key: "knockbackV", label: "Empurrão V", tip: "Componente vertical do empurrão. Acima de 0 a lâmina LANÇA o alvo (voo) em vez de só deslizá-lo (prompt: 0).", min: 0, max: 15, step: 0.1, unit: 'ms', value: 0}),
      paramRow({key: "originHeight", label: "Altura de nascimento (mão)", tip: "Acima da altitude do atirador.", min: 0.2, max: 1.3, step: 0.05, unit: 'm', value: 0.8}),
      paramRow({key: "spawnForward", label: "Distância de nascimento", tip: "À frente do corpo; sólido ali = a lâmina se dissipa (Burst gasto sem efeito).", min: 0.3, max: 1.5, step: 0.05, unit: 'm', value: 0.6}),
      paramRow({key: "counterStagger", label: "Counter Stagger", tip: "Stagger do derrotado quando este projétil vence um Counter (M21.5: 0,2 s).", min: 0, max: 1, step: 0.01, unit: 'sec', value: 0.2, approved: true}),
      paramRow({key: "visualWidth", label: "Desenho: largura (só aparência)", tip: "Largura do crescente (prompt: 1,20 m). Não muda a colisão.", min: 0.2, max: 3, step: 0.05, unit: 'm', value: 1.2}),
      paramRow({key: "visualHeight", label: "Desenho: altura (só aparência)", tip: "Altura do crescente (prompt: 0,70 m).", min: 0.2, max: 2, step: 0.05, unit: 'm', value: 0.7}),
      paramRow({key: "visualThickness", label: "Desenho: espessura (só aparência)", tip: "Espessura do crescente (prompt: 0,22 m).", min: 0.05, max: 1, step: 0.01, unit: 'm', value: 0.22}),
      ...hitShakeRows(),
    ],
  });
