// Dividido de ai-eval.js (comportamento idêntico): eval-scenarios.

import {C} from '../config.js';
import {vec, length} from '../math.js';
import {spawn} from '../world.js';
import {evalMatch} from './eval-match.js';

/**
 * Coleção Fixa de Situações Difíceis para Teste da IA:
 * 1. wall_pressure: encurralado na parede com oponente avançando.
 * 2. low_stamina: stamina crítica sem tentar tackle suicida.
 * 3. opponent_guarding: oponente com defesa perfeita armada (evita atacar direto).
 * 4. aggressive_tackle: oponente em tackle frontal (esquiva ou defesa reativa).
 * 5. projectile_incoming: projétil vindo em alta velocidade (reflect ou defesa).
 * 6. charge_in_progress: cancelamento com evasão emergencial quando o rival ataca.
 * 7. rival_recovery: aproveitamento da janela de punição (rival em recoil/landing).
 * 8. rival_airborne: não desperdiça tackle contra rival no ar.
 */
export const DIFFICULT_SCENARIOS = [
  {
    id: 'wall_pressure',
    name: 'Pressão na parede',
    description: 'Lutador encurralado próximo à parede da arena com adversário avançando diretamente.',
    run: (candidateRev) => {
      let wallHit = false;
      const res = evalMatch({
        seed: 42,
        blueRev: candidateRev,
        redRev: 0,
        maxSeconds: 1.5,
        initialPositions: [vec(C.test.arenaHalf - 0.5, 0), vec(C.test.arenaHalf - 2.2, 0)],
        scenarioSetup: g => {
          g.fighters[0].facing = Math.PI;
          g.fighters[1].facing = 0;
        },
      });
      // A IA não deve registrar ações negadas por colisão direta ou tentar passar a parede
      const deniedWall = res.sides[0].deniedByReason['arenaBounds'] ?? 0;
      const passed = deniedWall === 0 && res.sides[0].whiffs === 0;
      return {
        id: 'wall_pressure',
        name: 'Pressão na parede',
        passed,
        score: passed ? 1 : 0,
        detail: passed ? 'Manebrou sem tentar atravessar limites da arena' : `Ações negadas na parede: ${deniedWall}`,
      };
    },
  },
  {
    id: 'low_stamina',
    name: 'Pouca stamina',
    description: 'Lutador com stamina crítica (0.4) e adversário a 1.6m de distância.',
    run: (candidateRev) => {
      const res = evalMatch({
        seed: 77,
        blueRev: candidateRev,
        redRev: 0,
        maxSeconds: 0.8,
        initialPositions: [vec(0, -0.8), vec(0, 0.8)],
        scenarioSetup: g => {
          g.fighters[0].stamina = 0.4;
          g.fighters[1].stamina = 2.0;
        },
      });
      // Não deve pedir tackle com custo 1.0 (não se exaure voluntariamente)
      const passed = res.sides[0].tackles === 0 && res.sides[0].exhaustedTime === 0;
      return {
        id: 'low_stamina',
        name: 'Pouca stamina',
        passed,
        score: passed ? 1 : 0,
        detail: passed ? 'Preservou stamina e evitou exaustão não forçada' : `Tentou ${res.sides[0].tackles} tackle(s) sem stamina`,
      };
    },
  },
  {
    id: 'opponent_guarding',
    name: 'Adversário defendendo',
    description: 'Adversário com guarda frontal ativa esperando golpe a 1.8m.',
    run: (candidateRev) => {
      const res = evalMatch({
        seed: 101,
        blueRev: candidateRev,
        redRev: 0,
        maxSeconds: 0.6,
        initialPositions: [vec(0, -0.9), vec(0, 0.9)],
        scenarioSetup: g => {
          g.fighters[1].guard = true;
          g.fighters[1].perfectLeft = 0.2;
        },
      });
      // A IA não deve se chocar precipitadamente no primeiro passo
      const passed = res.sides[0].blocked === 0;
      return {
        id: 'opponent_guarding',
        name: 'Adversário defendendo',
        passed,
        score: passed ? 1 : 0,
        detail: passed ? 'Respeitou a guarda do adversário sem atacar cegamente' : 'Atacou diretamente a defesa armada',
      };
    },
  },
  {
    id: 'aggressive_tackle',
    name: 'Investida agressiva',
    description: 'Adversário em pleno tackle frontal direcionado a 2.8m.',
    run: (candidateRev) => {
      const res = evalMatch({
        seed: 133,
        blueRev: candidateRev,
        redRev: 0,
        maxSeconds: 0.8,
        initialPositions: [vec(0, -1.4), vec(0, 1.4)],
        scenarioSetup: g => {
          g.fighters[1].action = {kind: 'tackle', heading: -Math.PI / 2, elapsed: C.rules.feintWindow + 0.03, duration: 0.35, speedMultiplier: 1, hits: new Set()};   // já fora da janela da finta: o rival não cancela o ataque
          g.fighters[1].velocity = vec(0, -7.5);
        },
      });
      // Deve defender, esquivar ou amortecer o golpe
      const defended = res.sides[0].guards > 0 || res.sides[0].dodges > 0 || res.sides[0].perfectGuards > 0;
      const passed = defended || res.sides[1].blocked > 0 || res.sides[0].perfectDodges > 0;
      return {
        id: 'aggressive_tackle',
        name: 'Investida agressiva',
        passed,
        score: passed ? 1 : 0,
        detail: passed ? 'Respondeu reativamente à investida com defesa/esquiva' : 'Apanhou limpo sem reagir',
      };
    },
  },
  {
    id: 'projectile_incoming',
    name: 'Projétil hostil a caminho',
    description: 'Projétil hostil de PL1 a 12 m/s a 0.25 s de impacto com Reflect equipado.',
    run: (candidateRev) => {
      const res = evalMatch({
        seed: 155,
        blueRev: candidateRev,
        redRev: 0,
        loadouts: 'both',
        maxSeconds: 0.7,
        initialPositions: [vec(0, -1.2), vec(0, 1.2)],
        scenarioSetup: g => {
          spawn(g.world, {
            kind: 'projectile',
            owner: 1,
            pos: vec(0, 1.5),
            y: 0.6,
            vel: vec(0, -12),
            radius: 0.3,
            pl: 1,
            life: 1.5,
            hit: {damage: 0.25},
          });
        },
      });
      // Tomou menos do que o dano total ou ativou reflect/guarda
      const passed = res.sides[0].projectileDamageTaken < 0.25 || res.sides[0].chargesStarted > 0 || res.sides[0].guards > 0;
      return {
        id: 'projectile_incoming',
        name: 'Projétil hostil a caminho',
        passed,
        score: passed ? 1 : 0,
        detail: passed ? 'Detectou projétil e preparou contra-medida defensiva' : 'Atingido pelo projétil sem contra-medida',
      };
    },
  },
  {
    id: 'charge_in_progress',
    name: 'Carga em andamento vs investida',
    description: 'Lutador no meio de uma carga de Psyshock quando adversário inicia tackle a 3.5m.',
    run: (candidateRev) => {
      const res = evalMatch({
        seed: 202,
        blueRev: candidateRev,
        redRev: 0,
        loadouts: 'both',
        maxSeconds: 0.6,
        initialPositions: [vec(0, -1.6), vec(0, 1.6)],
        scenarioSetup: g => {
          g.fighters[0].charge = {move: 'psyshock', ticks: 40, slot: 1, params: {dodgeLockTicks: 25}};
          g.fighters[1].action = {kind: 'tackle', heading: -Math.PI / 2, elapsed: C.rules.feintWindow + 0.03, duration: 0.35, speedMultiplier: 1, hits: new Set()};   // já fora da janela da finta: o rival não cancela o ataque
          g.fighters[1].velocity = vec(0, -7.5);
        },
      });
      // Deve esquivar em emergência cancelando a carga
      const passed = res.sides[0].dodges > 0 || res.sides[0].chargesAborted > 0 || res.sides[0].chargesCompleted > 0;
      return {
        id: 'charge_in_progress',
        name: 'Carga em andamento vs investida',
        passed,
        score: passed ? 1 : 0,
        detail: passed ? 'Realizou evasão de emergência / soltura durante charge sob ataque' : 'Permaneceu congelado carregando durante o ataque',
      };
    },
  },
  {
    id: 'rival_recovery',
    name: 'Adversário em recuperação',
    description: 'Adversário em recoil após whiff ou bloqueio a 1.2m (janela de punição aberta).',
    run: (candidateRev) => {
      const res = evalMatch({
        seed: 244,
        blueRev: candidateRev,
        redRev: 0,
        maxSeconds: 0.8,
        initialPositions: [vec(0, -0.6), vec(0, 0.6)],
        scenarioSetup: g => {
          g.playerBrain.cooldown = 0;
          g.fighters[1].action = {kind: 'recoil', elapsed: 0.05, duration: 0.5};
          g.fighters[0].stamina = 2.0;
        },
      });
      const passed = res.sides[0].tackles > 0 || res.sides[0].hits > 0;
      return {
        id: 'rival_recovery',
        name: 'Adversário em recuperação',
        passed,
        score: passed ? 1 : 0,
        detail: passed ? 'Aproveitou a janela de recuperação para punir o adversário' : 'Não converteu a oportunidade de punição imediata',
      };
    },
  },
  {
    id: 'rival_airborne',
    name: 'Adversário no ar',
    description: 'Adversário lançado ao ar em voo balístico (y = 1.6m, vy > 0).',
    run: (candidateRev) => {
      const res = evalMatch({
        seed: 310,
        blueRev: candidateRev,
        redRev: 0,
        maxSeconds: 0.4,
        initialPositions: [vec(0, -1.8), vec(0, 0)],
        scenarioSetup: g => {
          g.fighters[1].flight = {y: 1.6, vy: 3.0, horizontal: vec(0, 0)};
        },
      });
      // Não deve gastar tackle no vazio contra o alvo no ar
      const passed = res.sides[0].whiffs === 0;
      return {
        id: 'rival_airborne',
        name: 'Adversário no ar',
        passed,
        score: passed ? 1 : 0,
        detail: passed ? 'Aguardou aterrissagem sem desperdiçar tackle no ar' : 'Desperdiçou tackle contra oponente no ar',
      };
    },
  },
];
/** Executa a bateria de cenários difíceis para as duas IAs e compara o aproveitamento. */
export function runDifficultScenarios({candidateRev = 1, baselineRev = 0, loadouts = 'both'} = {}) {
  const candidateResults = DIFFICULT_SCENARIOS.map(s => s.run(candidateRev));
  const baselineResults = DIFFICULT_SCENARIOS.map(s => s.run(baselineRev));

  const candScore = candidateResults.reduce((a, b) => a + b.score, 0);
  const baseScore = baselineResults.reduce((a, b) => a + b.score, 0);

  return {
    totalScenarios: DIFFICULT_SCENARIOS.length,
    candidateScore: candScore,
    baselineScore: baseScore,
    candidatePassRate: +(candScore / DIFFICULT_SCENARIOS.length).toFixed(3),
    baselinePassRate: +(baseScore / DIFFICULT_SCENARIOS.length).toFixed(3),
    scenarios: DIFFICULT_SCENARIOS.map((s, i) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      candidate: candidateResults[i],
      baseline: baselineResults[i],
    })),
  };
}
