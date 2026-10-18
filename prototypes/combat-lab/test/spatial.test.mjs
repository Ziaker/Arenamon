// Testes unitários da Fase 4 — Gestão inteligente de distância e arena
import {strict as assert} from 'node:assert';
import {createFighter} from '../src/sim/entity.js';
import {vec} from '../src/sim/math.js';
import {
  getCombatZones,
  safeArenaDirection,
  cornerPressureDirection,
  hysteresisDistance,
  okizemePlan,
  shouldSprintManaged,
} from '../src/sim/spatial.js';

const baseAttributes = {hp: 100, attack: 10, defense: 10, speed: 1.0};

console.log('--- Iniciando testes da Fase 4 (Gestão de distância e arena) ---');

// 1. Definição de zonas de combate por estilo e loadout
{
  const self = createFighter(0, baseAttributes, vec(0, 0));
  const target = createFighter(1, baseAttributes, vec(3, 0));

  const rushStyle = {id: 'rushdown', range: 0.72};
  const rushZones = getCombatZones(self, target, rushStyle);
  assert(rushZones.threatZone > 0, 'Zona de ameaça deve ser positiva');
  assert(rushZones.sweetSpot < rushZones.threatZone, 'Rushdown deve ter sweetSpot dentro da zona de aproximação curta');

  // Com projétil equipado (Psyshock), o sweet spot é ampliado para média-longa distância
  self.loadout = ['psyshock', null];
  const rangedZones = getCombatZones(self, target, rushStyle);
  assert(rangedZones.sweetSpot >= 4.5, `Sweet spot com projétil deve ser à distância, obtido: ${rangedZones.sweetSpot}`);
  console.log('✓ zonas de combate contextuais calculadas por estilo e loadout');
}

// 2. Desvio de paredes e cantos da arena (anti-encurralamento)
{
  // Lutador encostado na parede direita (x = 6.8 em arena 7.0), tentando continuar indo para a direita
  const posNearRight = {x: 6.8, z: 0};
  const wantedRight = vec(1.0, 0);
  const safeDir = safeArenaDirection(posNearRight, wantedRight, 7.0, 1.6);
  assert(safeDir.x < 0, `Direção segura deve repelir da parede direita (+X), obtido x: ${safeDir.x}`);

  // Lutador no centro livre
  const posCenter = {x: 0, z: 0};
  const forwardDir = vec(0, 1.0);
  const centerSafe = safeArenaDirection(posCenter, forwardDir, 7.0, 1.6);
  assert(Math.abs(centerSafe.z - 1.0) < 0.05, 'No centro da arena, direção desejada é mantida');
  console.log('✓ navegação com repulsão de parede e proteção contra auto-encurralamento');
}

// 3. Planos de encurralamento com corte de saída para o centro
{
  // Rival preso próximo à parede (+X = 6.5, Z = 0)
  const selfPos = {x: 3.5, z: 0};
  const targetPos = {x: 6.5, z: 0};
  const cornerPress = cornerPressureDirection(selfPos, targetPos, 7.0);
  assert(cornerPress.x > 0, 'Vetor de encurralamento deve pressionar na direção do alvo encurralado');
  console.log('✓ encurralamento posiciona IA entre o centro e o rival');
}

// 4. Histerese de distância anti-oscilação
{
  const targetDist = 3.0;
  // Se está se aproximando e está a 3.1m (ainda acima de 3.0), continua em approach
  let mode = hysteresisDistance(3.1, targetDist, 'approach', 0.3);
  assert.equal(mode, 'approach', 'Deve continuar aproximando');

  // Ao cruzar ligeiramente para 2.9m, entra em hold (sem recuar abruptamente)
  mode = hysteresisDistance(2.9, targetDist, 'approach', 0.3);
  assert.equal(mode, 'hold', 'Deve entrar em hold na zona neutra da histerese');

  // Só recua se ultrapassar a banda morta inferior (ex: 2.6m)
  mode = hysteresisDistance(2.6, targetDist, 'approach', 0.3);
  assert.equal(mode, 'retreat', 'Deve recuar apenas após transpor o limiar de histerese');
  console.log('✓ histerese elimina oscilações e jitter de aproximação/recuo');
}

// 5. Okizeme plan e perseguição pós-lançamento
{
  const self = createFighter(0, baseAttributes, vec(0, 0));
  const airborneTarget = createFighter(1, baseAttributes, vec(2.0, 0));
  airborneTarget.flight = {y: 1.0, vy: 5.0, horizontal: vec(2.0, 0)};

  const plan = okizemePlan(self, airborneTarget, 7.0);
  assert(plan.arriveTime > 0, 'Tempo até o impacto deve ser positivo');
  assert(plan.targetPosition.x > 2.0, 'Ponto de queda previsto deve avançar com o vetor horizontal');
  assert(plan.moveDir.x > 0, 'Direção de movimento deve guiar em direção à interceptação');
  console.log('✓ okizeme prevê aterrissagem e posiciona para punição');
}

// 6. Gestão disciplinada de sprint
{
  const self = createFighter(0, baseAttributes, vec(0, 0));
  self.stamina = 5.0;
  const budget = 2.5;

  // Longe (6.0m) e com stamina: deve correr
  assert(shouldSprintManaged(self, 6.0, 3.0, budget) === true, 'Deve ativar sprint a longa distância com stamina');

  // Próximo da zona de ameaça (3.2m): deve parar de correr para não entrar vulnerável
  assert(shouldSprintManaged(self, 3.2, 3.0, budget) === false, 'Deve parar o sprint ao se aproximar da zona de perigo');

  // Pouca stamina: não deve correr
  self.stamina = 2.0;
  assert(shouldSprintManaged(self, 6.0, 3.0, budget) === false, 'Não deve correr sem orçamento suficiente');
  console.log('✓ sprint disciplinado preserva recursos e evita aproximação imprudente');
}

console.log('\n6 verificações de gestão de distância e arena (Fase 4) aprovadas.');
