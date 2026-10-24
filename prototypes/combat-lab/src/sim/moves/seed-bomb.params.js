// @ts-check
// Parâmetros do Move "seed-bomb" (declarativo): padrão em C.world.seedBomb, faixa, unidade, rótulo e dica de cada slider da aba Moves.
// Módulo PURO (só importa params-registry.js): o config.js o carrega, então C.world.seedBomb existe sempre, com ou sem os Moves registrados.
// Seed Bomb: Normal Projectile + Field instantâneo. Marcador (alcance 3D 16 m — pedido de 23/10 dobrou os 8 m do protótipo), cast 0,3 s + recovery 0,2 s, arco balístico de 0,65 s
// (gravidade 17,5 = a do salto/Bounce) com velocidade máx. 20 m/s, semente de raio 0,24 m (vida 1,25 s), explosão ESFÉRICA de 1,8 m, 10 HP nominais, empurrão 3 H / 1 V, oclusão por paredes.
import {defineMoveParams, paramRow, hitShakeRows} from './params-registry.js';

/** Estado de governança dos valores do catálogo: implementado e testado, mas ainda NÃO aprovado nem homologado pelo diretor. */
const PROPOSTO = {proposto: true, aprovado: false, implementado: true, homologado: false};

export const params = defineMoveParams('seedBomb', {
    id: "seed-bomb", title: "Seed Bomb",
    meta: {category: 'Normal', types: ['Projectile', 'Field'], pl: "SEM PL", status: PROPOSTO},
    hint: "Normal · Projectile + Field. Segure para escolher o destino (até 32 m, setas movem o marcador), solte para confirmar: após 0,3 s uma semente voa em arco e explode ao tocar algo, num raio esférico de 1,8 m. O anel da prévia mostra o raio real da explosão. Protótipo: números não homologados.",
    rows: [
      paramRow({key: "cost", label: "Custo de stamina", tip: "Cobrado ao CONFIRMAR o marcador (Normal). Prompt: 1,0.", min: 0, max: 5, step: 0.05, unit: 'num', value: 1}),
      paramRow({key: "cooldown", label: "Cooldown", tip: "Começa junto com o custo, na confirmação (prompt: 8 s).", min: 0, max: 60, step: 0.5, unit: 'sec', value: 8}),
      paramRow({key: "cast", label: "Cast (até a semente sair)", tip: "Prompt: 0,3 s = 36 passos.", min: 0.05, max: 2, step: 0.01, unit: 'sec', value: 0.3}),
      paramRow({key: "recovery", label: "Recovery", tip: "Prompt: 0,2 s = 24 passos (ação total 0,5 s).", min: 0, max: 1, step: 0.01, unit: 'sec', value: 0.2}),
      paramRow({key: "range", label: "Alcance do marcador (3D)", tip: "Padrão atual: 32 m. O destino precisa de apoio sólido (não mira o ar).", min: 2, max: 64, step: 0.5, unit: 'm', value: 32}),
      paramRow({key: "flightTime", label: "Tempo de voo (arco)", tip: "Fixo: quanto mais longe, mais rápida a semente (prompt: 0,65 s = 78 passos).", min: 0.2, max: 1.5, step: 0.01, unit: 'sec', value: 0.65}),
      paramRow({key: "gravity", label: "Gravidade do arco", tip: "Não definida no prompt: 17,5 é a do salto e do Bounce. Com 28,5 ou 39,6 destinos altos passam da velocidade máxima.", min: 5, max: 60, step: 0.5, unit: 'ms2', value: 17.5}),
      paramRow({key: "maxSpeed", label: "Velocidade inicial máxima", tip: "Destino que exigir mais FALHA (sem corrigir a trajetória em silêncio). Prompt: 20 m/s.", min: 5, max: 35, step: 0.5, unit: 'ms', value: 20}),
      paramRow({key: "seedRadius", label: "Raio da semente", tip: "Colisor circular (prompt: 0,24 m). A semente só detona; não causa dano por contato.", min: 0.1, max: 0.6, step: 0.01, unit: 'm', value: 0.24}),
      paramRow({key: "lifetime", label: "Vida máxima da semente", tip: "Sem contato até aqui, ela se dissolve SEM explodir (prompt: 1,25 s).", min: 0.5, max: 3, step: 0.05, unit: 'sec', value: 1.25}),
      paramRow({key: "explosionRadius", label: "Raio da explosão (esfera 3D)", tip: "Volume ESFÉRICO de verdade (SB-P04 B, provisório): conta a altura do alvo. Prompt: 1,8 m. O anel da prévia usa este raio real.", min: 0.5, max: 4, step: 0.05, unit: 'm', value: 1.8}),
      paramRow({key: "damage", label: "Dano da explosão (nominal)", tip: "UM evento por alvo; final = nominal × Ataque ÷ referência (MV-P13); na reflexão usa o Ataque de quem refletiu. Prompt: 10 HP.", min: 0, max: 40, step: 0.5, unit: 'num', value: 10}),
      paramRow({key: "knockbackH", label: "Empurrão H", tip: "Radial a partir do centro. Com V > 0 vira um salto físico (prompt: 3).", min: 0, max: 12, step: 0.1, unit: 'ms', value: 3}),
      paramRow({key: "knockbackV", label: "Empurrão V", tip: "ATENÇÃO: 1 m/s sob a gravidade de lançamento dá um salto de ≈1 cm (prompt: 1).", min: 0, max: 12, step: 0.1, unit: 'ms', value: 1}),
      paramRow({key: "occlusion", label: "Paredes bloqueiam a explosão", tip: "Liga: sólidos de chão entre o centro e o alvo impedem o dano (plano XZ).", min: 0, max: 1, step: 1, unit: 'yesno', value: 1}),
      paramRow({key: "blastLife", label: "Duração visual da explosão", tip: "Só aparência: o dano é um único pulso no instante do contato.", min: 0.1, max: 1.5, step: 0.05, unit: 'sec', value: 0.3}),
      paramRow({key: "originHeight", label: "Altura de lançamento (mão)", tip: "Acima da altitude do atirador.", min: 0.2, max: 1.3, step: 0.05, unit: 'm', value: 0.8}),
      paramRow({key: "spawnForward", label: "Distância de nascimento", tip: "À frente do corpo; sólido ali = o Move falha.", min: 0.3, max: 1.5, step: 0.05, unit: 'm', value: 0.5}),
      paramRow({key: "markerSpeed", label: "Velocidade do marcador", tip: "Quão rápido a direção move o marcador com o botão segurado (8 m/s, MV-P29).", min: 1, max: 30, step: 0.5, unit: 'ms', value: 8}),
      paramRow({key: "markerAccel", label: "Aceleração do marcador", tip: "0 = instantâneo; o padrão desliza para o novo lado em vez de aparecer lá.", min: 0, max: 100, step: 1, unit: 'ms2', value: 24}),
      paramRow({key: "startDistance", label: "Distância inicial do marcador", tip: "Onde o marcador aparece ao apertar, à frente do corpo (3 m).", min: 0.5, max: 10, step: 0.25, unit: 'm', value: 3}),
      paramRow({key: "minRange", label: "Alcance mínimo do marcador", tip: "0 = pode colocar o destino colado em você.", min: 0, max: 10, step: 0.25, unit: 'm', value: 3}),
      paramRow({key: "maxRise", label: "Altura máxima de apoio acima dos pés", tip: "Até que altura de plataforma o marcador alcança (2 m).", min: 0, max: 6, step: 0.25, unit: 'm', value: 2}),
      paramRow({key: "allowOccupied", label: "Permitir destino sobre um lutador", tip: "Desligado: marcador inválido sobre personagens.", min: 0, max: 1, step: 1, unit: 'yesno', value: 1}),
      paramRow({key: "counterStagger", label: "Counter Stagger", tip: "Stagger do derrotado quando este projétil vence um Counter (M21.5: 0,2 s).", min: 0, max: 1, step: 0.01, unit: 'sec', value: 0.2, approved: true}),
      ...hitShakeRows(),
    ],
  });
