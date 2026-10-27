// @ts-check
// DOC03 — Portão ZERO: cobertura mecânica dos três pilotos (Sand Wave, Bullet Punch e Water Pulse).
// Este módulo é PURO (sem imports de config/UI) e monta a matriz de candidatos mecânicos com:
//   origem · tipo/escopo · valor · fase de leitura · consumidor · controle na UI · persistência · herança ·
//   teste A/B · decisão (PASS / TECH-JUSTIFIED / INHERITED / BLOCKED / OPEN).
// A unidade auditada é o CANDIDATO (numérico, booleano, enum, lista de colisão, flag ou fórmula), não o literal.
// Nenhum candidato pode sumir: o que não tem controle entra como OPEN ou como regra técnica justificada.
import {classifyParamRow} from './params-registry.js';

/** Os três pilotos do overhaul (DOC01/DOC02/DOC03). */
export const PILOT_MOVES = Object.freeze([
  {id: 'sand-wave', group: 'sandWave', file: 'src/sim/moves/sand-wave/sand-wave.js', json: 'src/sim/moves/sand-wave/sand-wave.move.json'},
  {id: 'bullet-punch', group: 'bulletPunch', file: 'src/sim/moves/bullet-punch/bullet-punch.js', json: 'src/sim/moves/bullet-punch/bullet-punch.move.json'},
  {id: 'water-pulse', group: 'waterPulse', file: 'src/sim/moves/water-pulse/water-pulse.js', json: 'src/sim/moves/water-pulse/water-pulse.move.json'},
]);

/** Momento em que o valor é lido/capturado, por categoria mecânica. */
const PHASE_BY_CATEGORY = Object.freeze({
  'Recursos': 'ativação (t = 0)',
  'Preparação': 'cast',
  'Dano': 'hit',
  'Hitboxes': 'tick',
  'Knockback': 'hit',
  'Movimentação': 'tick',
  'Projéteis': 'spawn',
  'Área e persistência': 'tick',
  'Status': 'hit',
  'Defesa e Counter': 'hit',
  'Cancelamentos': 'soltar',
  'Alvo e mira': 'pressão',
  'Ambiente e colisão': 'tick',
  'Eventos e múltiplos hits': 'tick',
  'IA do Move': 'decisão',
  'Interações globais': 'hit',
});

/** Campos do perfil declarativo de IA que são candidatos mecânicos editáveis (DOC03 §3–§5). */
export const AI_EDITABLE_FIELDS = Object.freeze([
  {key: 'p', label: 'Chance base (p)', unit: 'pct', min: 0.01, max: 1, step: 0.01},
  {key: 'distance.min', label: 'Distância mínima', unit: 'm', min: 0, max: 40, step: 0.1},
  {key: 'distance.max', label: 'Distância máxima', unit: 'm', min: 0, max: 40, step: 0.1},
  {key: 'minStamina', label: 'Stamina mínima', unit: 'num', min: 0, max: 5, step: 0.1},
  {key: 'maxStamina', label: 'Stamina máxima', unit: 'num', min: 0, max: 5, step: 0.1},
]);

/** Campos do perfil de IA que são regras semânticas (não viram slider): explicados e testados como bloqueados. */
const AI_FIXED_FIELDS = Object.freeze([
  {key: 'kind', reason: 'Modalidade de execução (tap/charge/aim) define o fluxo do controlador; trocar em runtime invalidaria a captura do Move.'},
  {key: 'why', reason: 'Texto de telemetria/log da IA; não altera mecânica.'},
  {key: 'requires', reason: 'Condições de elegibilidade (facing/tGround). Alterar exigiria recompilar a regra e muda o contrato de leitura justa da IA.'},
  {key: 'forbids', reason: 'Condições proibidas; mesma natureza de requires.'},
  {key: 'anyOf', reason: 'Condições alternativas; mesma natureza de requires.'},
  {key: 'notStatus', reason: 'Evita repetir buff já ativo; regra semântica do perfil.'},
  {key: 'when', reason: 'Predicado específico do Move (ex.: alcance do Bullet Punch). Bloqueado: é código, não dado.'},
]);

/** Regras fixas (políticas) dos pilotos: continuam fixas por contrato, com invariante e justificativa. */
export const PILOT_POLICIES = Object.freeze([
  {
    id: 'water-pulse.blockedBy', move: 'water-pulse', value: "['barrier', 'wall']",
    consumer: 'src/sim/moves/water-pulse/water-pulse.js:waterPulseEffect', file: 'src/sim/moves/water-pulse/water-pulse.js',
    reason: 'Política de colisão do combate: a esfera para em barreiras e paredes. Transformar em slider quebraria o contrato de barreira refletora e o de oclusão.',
    invariant: 'water-pulse: projétil não atravessa barreira nem parede',
  },
  {
    id: 'water-pulse.clashable', move: 'water-pulse', value: 'true',
    consumer: 'src/sim/world/world-hit.js:resolveClash', file: 'src/sim/moves/water-pulse/water-pulse.js',
    reason: 'Participa do clash universal entre projéteis/golpes; é regra de combate, não parâmetro do Move.',
    invariant: 'water-pulse: clash com projétil oposto consome ambos',
  },
  {
    id: 'water-pulse.lifeFormula', move: 'water-pulse', value: 'range / speed + dt * 0.5',
    consumer: 'src/sim/world/world-proj.js:stepProjectile', file: 'src/sim/moves/water-pulse/water-pulse.js',
    reason: 'Vida derivada de alcance e velocidade (com meia margem de passo para não expirar no mesmo tick do alcance). Sliders próprios criariam estados inalcançáveis.',
    invariant: 'water-pulse: alcance máximo é percorrido antes de expirar',
  },
  {
    id: 'water-pulse.speed3d', move: 'water-pulse', value: 'direção 3D + velocidade escalar constante',
    consumer: 'src/sim/moves/projectile-util.js:straightLaunch', file: 'src/sim/moves/water-pulse/water-pulse.js',
    reason: 'Com alvo travado, a esfera mantém a velocidade escalar e muda o vetor (mirar no centro do corpo). A regra é geométrica e compartilhada.',
    invariant: 'water-pulse: distância percorrida = speed × tempo com alvo em altura',
  },
  {
    id: 'water-pulse.spawnRefundPolicy', move: 'water-pulse', value: 'falha com reembolso se spawnBlocked',
    consumer: 'src/sim/controller/ctrl-moves.js:startMove', file: 'src/sim/moves/water-pulse/water-pulse.js',
    reason: 'WP-P05 aprovado: sem espaço para nascer, o Move falha e devolve o custo; não teletransporta o projétil.',
    invariant: 'water-pulse: spawn bloqueado não cobra stamina nem cria entidade',
  },
  {
    id: 'bullet-punch.absentBody', move: 'bullet-punch', value: 'f.absent durante vanish',
    consumer: 'src/sim/controller/ctrl-moves.js:updateMove', file: 'src/sim/moves/bullet-punch/bullet-punch.js',
    reason: 'O corpo deixa de existir (sem colisão, acerto ou seleção) no desaparecimento; é a identidade mecânica do Move, não um número.',
    invariant: 'bullet-punch: ausente não é acertado nem bloqueia o caminho',
  },
  {
    id: 'bullet-punch.lockTarget', move: 'bullet-punch', value: 'alvo fixado na soltura',
    consumer: 'src/sim/moves/bullet-punch/bullet-punch.js:bulletPunchVanish', file: 'src/sim/moves/bullet-punch/bullet-punch.js',
    reason: 'O alvo é escolhido ao soltar e seguido até a posição daquele instante; trocar a política mudaria a leitura de compromisso do golpe.',
    invariant: 'bullet-punch: soltar sem alvo no alcance não gasta nada',
  },
  {
    id: 'bullet-punch.firstSolid', move: 'bullet-punch', value: 'para no primeiro sólido (rayStep)',
    consumer: 'src/sim/moves/bullet-punch/bullet-punch.js:firstFree', file: 'src/sim/moves/bullet-punch/bullet-punch.js',
    reason: 'A corrida invisível não atravessa paredes. O passo de amostragem (rayStep) é editável; a política de parada é fixa.',
    invariant: 'bullet-punch: parede entre os dois impede chegada ao alvo',
  },
  {
    id: 'sand-wave.perfectNullifiesBlind', move: 'sand-wave', value: 'perfeita/riposte anulam cegueira',
    consumer: 'src/sim/sand.js:stepSand', file: 'src/sim/sand.js',
    reason: 'Regra de defesa perfeita aprovada (SW-Dxx): o acerto perfeito anula dano, cegueira e empurrão.',
    invariant: 'sand-wave: alvo em defesa perfeita não fica cego',
  },
  {
    id: 'sand-wave.oneHitPerTarget', move: 'sand-wave', value: 'um acerto válido por alvo por execução',
    consumer: 'src/sim/sand.js:stepSand', file: 'src/sim/sand.js',
    reason: 'A onda mantém o empurrão contínuo, mas não repete dano/cegueira no mesmo alvo; é a identidade do campo.',
    invariant: 'sand-wave: atravessar a onda não aplica dano duas vezes',
  },
]);

/** Evidência A/B específica já existente para os pilotos (teste que roda em CI). Vazio = pendente. */
export const PILOT_EVIDENCE = Object.freeze({
  'sand-wave.damage': 'moves-sand-wave.test.mjs:dano',
  'sand-wave.blind': 'moves-sand-wave.test.mjs:cegueira',
  'sand-wave.length': 'moves-sand-wave.test.mjs:alcance',
  'sand-wave.width': 'moves-sand-wave.test.mjs:largura',
  'sand-wave.cast': 'moves-sand-wave.test.mjs:preparação',
  'sand-wave.cost': 'moves-sand-wave.test.mjs:stamina e recarga',
  'sand-wave.cooldown': 'moves-sand-wave.test.mjs:cooldown',
  'sand-wave.active': 'moves-sand-wave.test.mjs:janela ativa',
  'sand-wave.dissipate': 'moves-sand-wave.test.mjs:dissipação',
  'sand-wave.knockbackH': 'moves-sand-wave.test.mjs:empurrão',
  'sand-wave.knockbackV': 'moves-doc03-pilots.test.mjs:knockbackV',
  'sand-wave.accel': 'moves-doc03-pilots.test.mjs:accel',
  'sand-wave.speedFromReach': 'moves-doc03-pilots.test.mjs:velocidade da frente',
  'sand-wave.waveSpeed': 'moves-doc03-pilots.test.mjs:velocidade da frente',
  'sand-wave.waveAccel': 'moves-doc03-pilots.test.mjs:velocidade da frente',
  'sand-wave.pushSpeed': 'moves-doc03-pilots.test.mjs:impulso e duração do empurrão',
  'sand-wave.pushDuration': 'moves-doc03-pilots.test.mjs:impulso e duração do empurrão',
  'sand-wave.pushClearsLocomotion': 'moves-doc03-pilots.test.mjs:preservar movimento próprio',
  'sand-wave.pushCancelsDodge': 'moves-doc03-pilots.test.mjs:cancelar esquiva',
  'sand-wave.pushDurationMode': 'moves-sand-push.test.mjs:duração por alvo independente',
  'sand-wave.pushContinueAfterActive': 'moves-sand-push.test.mjs:continua depois da janela',
  'sand-wave.pushContinuesOutsideArea': 'moves-sand-push.test.mjs:continua fora do retângulo',
  'sand-wave.pushReleaseDelay': 'moves-sand-push.test.mjs:tolerância de perda de contato',
  'sand-wave.pushContinuesDuringStagger': 'moves-sand-push.test.mjs:continua no stagger',
  'sand-wave.pushPreserveVelocity': 'moves-sand-push.test.mjs:preserva velocidade',
  'sand-wave.pushMaxSpeed': 'moves-sand-push.test.mjs:limite de velocidade',
  'sand-wave.pushAccelerationMode': 'moves-sand-push.test.mjs:modos de aceleração',
  'sand-wave.pushCurvePower': 'moves-sand-push.test.mjs:modos de aceleração',
  'sand-wave.pushTargetSpeed': 'moves-sand-push.test.mjs:modos de aceleração',
  'sand-wave.pushRampTime': 'moves-sand-push.test.mjs:modos de aceleração',
  'sand-wave.pushCancelsExistingDodge': 'moves-sand-push.test.mjs:esquiva existente',
  'sand-wave.blindOnPartial': 'moves-doc03-pilots.test.mjs:cegueira na parcial',
  'sand-wave.hitsAirborne': 'moves-doc03-pilots.test.mjs:alvo em voo baixo',
  'sand-wave.wallStaggerOn': 'moves-doc03-pilots.test.mjs:stagger contra parede',
  'sand-wave.wallPressStopRatio': 'moves-doc03-pilots.test.mjs:stagger contra parede',
  'sand-wave.wallUnpinDistance': 'moves-doc03-pilots.test.mjs:stagger contra parede',
  'sand-wave.maxTargets': 'moves-doc03-pilots.test.mjs:limite de alvos',
  'sand-wave.partialFactor': 'moves-sand-wave.test.mjs:guarda parcial',
  'sand-wave.waveHeight': 'moves-ab-sensitivity.test.mjs:waveHeight',
  'sand-wave.wallStagger': 'moves-doc03-pilots.test.mjs:wallStagger',
  'sand-wave.visionRadius': 'moves-doc03-pilots.test.mjs:visionRadius',
  'sand-wave.detour': 'moves-doc03-pilots.test.mjs:detour',
  'sand-wave.wallPressMinSpeed': 'moves-doc03-pilots.test.mjs:wallPressMinSpeed',
  'sand-wave.wallPressMoveRatio': 'moves-doc03-pilots.test.mjs:wallPressMoveRatio',
  'sand-wave.waveBottomTolerance': 'moves-doc03-pilots.test.mjs:waveBottomTolerance',
  'bullet-punch.cost': 'moves-doc03-pilots.test.mjs:custo e cooldown',
  'bullet-punch.cooldown': 'moves-doc03-pilots.test.mjs:custo e cooldown',
  'bullet-punch.cast': 'moves-bullet-punch.test.mjs:preparação',
  'bullet-punch.vanish': 'moves-bullet-punch.test.mjs:desaparecimento',
  'bullet-punch.reach': 'moves-bullet-punch.test.mjs:alcance',
  'bullet-punch.strikeReach': 'moves-bullet-punch.test.mjs:golpe',
  'bullet-punch.stopShort': 'moves-bullet-punch.test.mjs:parada antes do alvo',
  'bullet-punch.hitRadius': 'moves-bullet-punch.test.mjs:raio de contato',
  'bullet-punch.impactMult': 'moves-bullet-punch.test.mjs:impacto',
  'bullet-punch.knockbackOwn': 'moves-doc03-pilots.test.mjs:knockback próprio',
  'bullet-punch.knockbackH': 'moves-doc03-pilots.test.mjs:knockback próprio',
  'bullet-punch.knockbackV': 'moves-doc03-pilots.test.mjs:knockback próprio',
  'bullet-punch.slow': 'moves-doc03-pilots.test.mjs:slow',
  'bullet-punch.maxRise': 'moves-doc03-pilots.test.mjs:maxRise',
  'bullet-punch.freeSearchRadius': 'moves-doc03-pilots.test.mjs:freeSearchRadius',
  'bullet-punch.freeSearchStep': 'moves-doc03-pilots.test.mjs:freeSearchStep',
  'bullet-punch.airReach': 'moves-bullet-punch.test.mjs:alvo aéreo',
  'bullet-punch.rayStep': 'moves-doc03-pilots.test.mjs:rayStep',
  'water-pulse.damagePl1': 'moves-water-pulse.test.mjs:PL1',
  'water-pulse.damagePl2': 'moves-water-pulse.test.mjs:PL2',
  'water-pulse.damagePl3': 'moves-water-pulse.test.mjs:PL3',
  'water-pulse.knockbackPl1': 'moves-water-pulse.test.mjs:knockback PL1',
  'water-pulse.knockbackPl2': 'moves-water-pulse.test.mjs:knockback PL2',
  'water-pulse.knockbackPl3': 'moves-water-pulse.test.mjs:knockback PL3',
  'water-pulse.knockbackV': 'moves-doc03-pilots.test.mjs:knockbackV',
  'water-pulse.speed': 'moves-water-pulse.test.mjs:velocidade',
  'water-pulse.radius': 'moves-doc03-pilots.test.mjs:raio físico',
  'water-pulse.range': 'moves-water-pulse.test.mjs:alcance',
  'water-pulse.pierce': 'moves-doc03-pilots.test.mjs:pierce',
  'water-pulse.maxCharge': 'moves-water-pulse.test.mjs:carga',
  'water-pulse.minCharge': 'moves-water-pulse.test.mjs:carga mínima',
  'water-pulse.chargeRecovery': 'moves-doc03-pilots.test.mjs:chargeRecovery',
  'water-pulse.originHeight': 'moves-doc03-pilots.test.mjs:originHeight',
  'water-pulse.spawnForward': 'moves-doc03-pilots.test.mjs:spawnForward',
  'water-pulse.counterStagger': 'moves-doc03-pilots.test.mjs:counterStagger',
  'water-pulse.cost': 'moves-water-pulse.test.mjs:custo na ativação',
  'water-pulse.cooldown': 'moves-water-pulse.test.mjs:cooldown',
});

/**
 * Candidatos TÉCNICOS que continuam com controle (slider técnico) ou são só de aparência:
 * a decisão é TECH-JUSTIFIED porque o teste prova um invariante (mesma mecânica / mesmo resultado),
 * não um A/B de efeito. Nunca contam como PASS para não inflar a cobertura.
 */
export const PILOT_TECH_JUSTIFIED = Object.freeze({
  'sand-wave.cell': {
    reason: 'Resolução da grade de caminho: só quantiza o trajeto; o teste prova que o mesmo obstáculo é contornado no mesmo passo com célula fina ou grossa.',
    invariant: 'sand-wave: cell 0,1 m e 0,5 m atingem no mesmo tick no cenário de desvio',
    test: 'moves-doc03-pilots.test.mjs:cell',
  },
  'sand-wave.replanSteps': {
    reason: 'Intervalo de recálculo do campo de distâncias (desempenho): a assinatura dos sólidos já invalida o cache; mudar o intervalo não altera o resultado mecânico.',
    invariant: 'sand-wave: replanSteps 1 e 60 atingem no mesmo tick com obstáculo estático',
    test: 'moves-doc03-pilots.test.mjs:replanSteps',
  },
  'sand-wave.fogDarkness': {
    reason: 'Só escurece a câmera do jogador cegado (view.js); não participa da simulação nem da hitbox.',
    invariant: 'sand-wave: fogDarkness não altera o hash da simulação',
    test: 'moves-doc03-pilots.test.mjs:fogDarkness',
  },
  'bullet-punch.fxLines': {
    reason: 'Só desenha as linhas de velocidade no sumiço (aim-marker-view.js); não participa da simulação nem da hitbox.',
    invariant: 'bullet-punch: fxLines não altera o hash da simulação',
    test: 'moves-doc03-pilots.test.mjs:fxLines e fxHideBody',
  },
  'bullet-punch.atelierVfx': {
    reason: 'Alterna entre o VFX classico (0) e o do Atelie (1) na camada de visual; nao altera a simulacao mecanica nem hitboxes.',
    invariant: 'bullet-punch: atelierVfx nao altera o hash da simulacao nem o dano',
    test: 'moves-doc03-pilots.test.mjs:atelierVfx',
  },
  'bullet-punch.fxHideBody': {
    reason: 'Só oculta o corpo durante o sumiço na camada de view; o corpo já está ausente na simulação por `absent`.',
    invariant: 'bullet-punch: fxHideBody não altera o hash da simulação',
    test: 'moves-doc03-pilots.test.mjs:fxLines e fxHideBody',
  },
  'water-pulse.plScaleBonus': {
    reason: 'Muda apenas a escala visual da esfera (visualScale) por PL; o raio físico da colisão continua sendo `radius`.',
    invariant: 'water-pulse: plScaleBonus muda visualScale e mantém radius/hitbox e o resultado do hit',
    test: 'moves-doc03-pilots.test.mjs:plScaleBonus',
  },
});

/** @typedef {{id: string, move: string, origin: string, kind: 'exclusive'|'ai'|'inherited'|'technical'|'blocked'|'open', value: any, runtime?: number, unit: string, phase: string, consumer: string, ui: string, persistence: string, inheritance: string, ab: string|null, decision: 'PASS'|'TECH-JUSTIFIED'|'INHERITED'|'BLOCKED'|'OPEN', evidence: string}} MatrixEntry */

/**
 * Monta a matriz DOC03 de um piloto.
 * @param {{id: string, group: string, params: {rows: any[]}, aiProfile?: any, inherited?: any[], runtime?: Record<string, number>}} move
 * @returns {MatrixEntry[]}
 */
export function buildPilotMatrix(move) {
  /** @type {MatrixEntry[]} */
  const out = [];
  // 1. Parâmetros exclusivos da ficha (todos expostos no Editor: slider + digitação exata).
  for (const r of move.params.rows) {
    if (String(r.key).startsWith('hitShake')) continue;
    const meta = classifyParamRow(move.group, r);
    const id = `${move.id}.${r.key}`;
    const evidence = (/** @type {Record<string, any>} */ (PILOT_EVIDENCE))[id] ?? null;
    const tech = (/** @type {Record<string, any>} */ (PILOT_TECH_JUSTIFIED))[id] ?? null;
    const runtime = move.runtime?.[r.key];
    out.push({
      id, move: move.id, origin: `${move.id}.move.json`, kind: tech ? 'technical' : 'exclusive', value: r.value, unit: r.unit,
      ...(runtime !== undefined ? {runtime} : {}),
      phase: PHASE_BY_CATEGORY[/** @type {keyof typeof PHASE_BY_CATEGORY} */ (meta.category)] ?? 'tick',
      consumer: `${meta.consumer.file}:${meta.consumer.fn}`,
      ui: tech ? `slider técnico + input exato (#ed-num-world-${move.group}-${r.key})` : `slider + input exato (#ed-num-world-${move.group}-${r.key})`,
      persistence: 'src/sim/moves/' + move.id + '.move.json',
      inheritance: r.dependsOn ? `exclusivo · depende de ${r.dependsOn}` : 'exclusivo',
      ab: tech ? tech.test : evidence,
      decision: tech ? 'TECH-JUSTIFIED' : evidence ? 'PASS' : 'OPEN',
      evidence: tech ? tech.reason : evidence ? 'A/B registrado' : 'exposto, sem A/B individual registrado',
    });
  }
  // 2. IA declarativa.
  const ai = move.aiProfile;
  if (ai) {
    for (const f of AI_EDITABLE_FIELDS) {
      const has = f.key.includes('.') ? ai.distance?.[f.key.split('.')[1]] !== undefined : ai[f.key] !== undefined;
      if (!has) continue;
      const value = f.key.includes('.') ? ai.distance[f.key.split('.')[1]] : ai[f.key];
      const id = `${move.id}.ai.${f.key}`;
      out.push({
        id, move: move.id, origin: `${move.id}.js → ficha.ai (perfil declarativo)`, kind: 'ai', value, unit: f.unit,
        phase: 'decisão (0,25 s)', consumer: 'src/sim/ai-new-moves.js:newMovesCommand → ai-profile.js:compileAiProfile',
        ui: `Editor › IA do Move (${f.label})`, persistence: 'sessão (ficha JS; não gravável no .move.json)',
        inheritance: ai.kind === 'charge' ? 'IA · perfil charge' : 'IA · perfil tap',
        ab: `${move.id}: ajuste de perfil muda a decisão`,
        decision: 'PASS',
        evidence: 'A/B de decisão (moves-doc03-pilots.test.mjs)',
      });
    }
    for (const f of AI_FIXED_FIELDS) {
      if (f.key === 'forbids' || f.key === 'anyOf' || f.key === 'notStatus' || f.key === 'maxStamina') {
        if (ai[f.key] === undefined) continue;
      } else if (f.key === 'when') {
        if (ai.when === undefined) continue;
      } else if (f.key !== 'requires' && ai[f.key] === undefined) continue;
      out.push({
        id: `${move.id}.ai.${f.key}`, move: move.id, origin: `${move.id}.js → ficha.ai`, kind: 'blocked',
        value: f.key === 'when' ? 'predicado' : ai[f.key], unit: 'enum', phase: 'decisão (0,25 s)',
        consumer: 'src/sim/ai-new-moves.js:newMovesCommand', ui: 'somente leitura (explicado no Editor)',
        persistence: 'ficha JS (código)', inheritance: 'IA · regra semântica', ab: null,
        decision: 'BLOCKED', evidence: f.reason,
      });
    }
  }
  // 3. Herdados de sistemas compartilhados (Charge/Tackle/Combate/IA global).
  for (const inh of move.inherited ?? []) {
    out.push({
      id: `${move.id}.inherited.${inh.path}`, move: move.id, origin: `C.${inh.path}`, kind: 'inherited',
      value: '—', unit: inh.unit ?? 'num', phase: 'tick', consumer: `${inh.consumer.file}:${inh.consumer.fn}`,
      ui: `Editor › herdados (${inh.label})`, persistence: 'configuração global (C)',
      inheritance: inh.overriddenBy ? `herdado · substituído por ${inh.overriddenBy}` : 'herdado (global)',
      ab: null, decision: 'INHERITED', evidence: inh.tip,
    });
  }
  // 4. Regras fixas dos pilotos.
  for (const p of PILOT_POLICIES.filter(p => p.move === move.id)) {
    out.push({
      id: p.id, move: move.id, origin: p.file, kind: 'technical', value: p.value, unit: 'política',
      phase: 'tick', consumer: p.consumer, ui: 'somente leitura (regra técnica justificada)',
      persistence: 'código do motor', inheritance: 'regra fixa', ab: p.invariant,
      decision: 'TECH-JUSTIFIED', evidence: p.reason,
    });
  }
  return out;
}

/** Percentuais justificáveis de cobertura: exposição (UI) e evidência A/B individual. */
export function coverageSummary(/** @type {MatrixEntry[]} */ entries) {
  const total = entries.length;
  const count = (/** @type {string} */ d) => entries.filter(e => e.decision === d).length;
  const decided = entries.filter(e => e.decision !== 'OPEN').length;
  const evidence = entries.filter(e => e.decision === 'PASS').length;
  const open = entries.filter(e => e.decision === 'OPEN');
  const pct = (/** @type {number} */ n) => total ? +(n / total * 100).toFixed(1) : 100;
  return {
    total, decided, open: open.length, pass: count('PASS'), inherited: count('INHERITED'),
    technical: count('TECH-JUSTIFIED'), blocked: count('BLOCKED'),
    decidedPct: pct(decided), evidencePct: pct(evidence), openPct: pct(open.length),
    openIds: open.map(e => e.id),
  };
}

/** Resumo agregado dos três pilotos. */
export function coverageForMoves(/** @type {Array<any>} */ moves) {
  const entries = moves.flatMap(m => buildPilotMatrix(m));
  return {entries, summary: coverageSummary(entries)};
}
