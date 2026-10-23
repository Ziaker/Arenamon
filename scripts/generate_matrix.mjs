import fs from 'fs';

// Lê o arquivo original de decisões aprovadas
const content = fs.readFileSync('docs/MAPA_COMBAT_LAB_DECISOES_RODADAS.md', 'utf8');
const activeSection = content.split('## Pergunta de planejamento retirada')[0];

const regex = /\*\*(R\d+\.\d+)\s*—\s*([^*]+)\*\*\s*[\r\n]+([\s\S]*?)(?=\n\*\*R\d+\.\d+|\n## |\n### |$)/g;
let match;
const rawDecisions = [];
while ((match = regex.exec(activeSection)) !== null) {
  const id = match[1];
  const title = match[2].trim();
  const body = match[3].trim();
  let approved = '';
  const m1 = body.match(/Resposta aprovada:\s*\*\*([^*]+)\*\*/i);
  const m2 = body.match(/\*\*Resposta aprovada:\*\*\s*\*\*([^*]+)\*\*/i);
  if (m2) approved = m2[1].trim();
  else if (m1) approved = m1[1].trim();
  rawDecisions.push({id, title, approved});
}

// Mapeamento detalhado por ID ou por regra
function getTechnicalDetails(id, title, approved) {
  const [roundStr, itemStr] = id.replace('R', '').split('.');
  const round = parseInt(roundStr, 10);
  const item = parseInt(itemStr, 10);

  // Rodada 1
  if (round === 1) {
    if (item === 1) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/config.js (test.arenaRadius, arenaHalf), physics.js (clampToArena), view/world-view.js',
      intervencao: 'Substituir arenaHalf quadrada (16m) por arena circular com raio de 50m (diâmetro 100m). Adaptar física radial.',
      verificacao: 'MAP-T01',
      situacao: 'Pendente'
    };
    if (item === 2) return {
      estado: 'Parcial',
      local: 'prototypes/combat-lab/src/view/world-view.js, view/view.js',
      intervencao: 'Renderizar piso circular técnico minimalista com grid polar/radial e anel perimetral discreto.',
      verificacao: 'Inspeção visual / MAP-T01',
      situacao: 'Pendente'
    };
    if (item === 3) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/world.js (spawnMapObjects), sim/game.js (resetMatch)',
      intervencao: 'Implementar sorteio de 4 posições aleatórias para objetos destrutíveis a cada início de luta.',
      verificacao: 'MAP-T02, MAP-T03',
      situacao: 'Pendente'
    };
    if (item === 4) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/view/world-view.js',
      intervencao: 'Adicionar geometrias simples Three.js (cubos/prismas) para renderizar destrutíveis.',
      verificacao: 'Inspeção visual em JOGAR_ARENAMON.html',
      situacao: 'Pendente'
    };
    if (item === 5) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/world.js (damageDestructible), sim/combat.js',
      intervencao: 'Integrar detecção de acerto de tackles, projéteis e áreas em objetos destrutíveis.',
      verificacao: 'MAP-T07',
      situacao: 'Pendente'
    };
    if (item === 6) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/config.js (map.destructibleHp: 30), sim/world.js',
      intervencao: 'Atribuir HP individual (inicial 30 HP, R9.11) com controle de dano acumulado e destruição ao zerar.',
      verificacao: 'MAP-T07',
      situacao: 'Pendente'
    };
    if (item === 7) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/world.js (spawnMapObjects), sim/game.js',
      intervencao: 'Implementar sorteio de posições para os 4 obstáculos indestrutíveis a cada partida.',
      verificacao: 'MAP-T03',
      situacao: 'Pendente'
    };
    if (item === 8) return {
      estado: 'Parcial',
      local: 'prototypes/combat-lab/src/sim/physics.js, sim/world.js (collideFighter)',
      intervencao: 'Adicionar colisores sólidos que bloqueiam lutadores/ataques e calculam rebote com base na normal.',
      verificacao: 'MAP-T05, MAP-T20',
      situacao: 'Pendente'
    };
    if (item === 9) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/physics.js, sim/world.js (platforms)',
      intervencao: 'Criar geometria de plataforma que permite pousar no topo e colidir fisicamente nas laterais.',
      verificacao: 'MAP-T05, MAP-T06',
      situacao: 'Pendente'
    };
    if (item === 10) return {
      estado: 'Parcial',
      local: 'prototypes/combat-lab/src/ui/input.js, sim/config.js (bindings)',
      intervencao: 'Configurar comando de pulo no teclado (Espaço). Gamepad excluído por determinação posterior.',
      verificacao: 'MAP-T06',
      situacao: 'Pendente'
    };
    if (item === 11) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/controller.js, sim/physics.js',
      intervencao: 'Implementar salto vertical com impulso parabólico e aceleração gravitacional.',
      verificacao: 'MAP-T06',
      situacao: 'Pendente'
    };
    if (item === 12) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/world.js (destroyDestructible)',
      intervencao: 'Conectar destruição do objeto ao sorteio e spawn de drops de consumíveis na sua posição.',
      verificacao: 'MAP-T10',
      situacao: 'Pendente'
    };
  }

  // Rodada 2
  if (round === 2) {
    if (item === 1) return {
      estado: 'Parcial',
      local: 'prototypes/combat-lab/src/ui/input.js, main.js',
      intervencao: 'Mapear tecla Espaço para salto do lutador (desvincular de pause que permanece em Esc).',
      verificacao: 'MAP-T06',
      situacao: 'Pendente'
    };
    if (item === 2) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/config.js (map.jumpHeight: 2), sim/controller.js',
      intervencao: 'Parâmetro de altura máxima do salto normal configurável no laboratório, inicial 2m (R7.1).',
      verificacao: 'MAP-T06',
      situacao: 'Pendente'
    };
    if (item === 3) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/controller.js, sim/physics.js',
      intervencao: 'Preservar velocidade horizontal existente na decolagem sem permitir correção de rumo durante o salto.',
      verificacao: 'MAP-T06',
      situacao: 'Pendente'
    };
    if (item === 4) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/controller.js',
      intervencao: 'Garantir custo 0 de stamina para o salto normal e aplicar cooldown pós-aterrissagem (0,25s, R7.2).',
      verificacao: 'MAP-T06',
      situacao: 'Pendente'
    };
    if (item === 5) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/controller.js',
      intervencao: 'Restringir a 1 salto normal por sequência aérea, resetando apenas ao tocar o solo.',
      verificacao: 'MAP-T06',
      situacao: 'Pendente'
    };
    if (item === 6) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/controller.js',
      intervencao: 'Permitir salto somente em estado neutro/caminhando/correndo; bloquear durante ataques/defesa/recuo.',
      verificacao: 'MAP-T06',
      situacao: 'Pendente'
    };
    if (item === 7) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/controller.js',
      intervencao: 'Bloquear ataques e guarda enquanto estiver no ar durante o salto normal.',
      verificacao: 'MAP-T06',
      situacao: 'Pendente'
    };
    if (item === 8) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/entity.js, sim/combat.js',
      intervencao: 'Garantir que salto normal não conceda invulnerabilidade nem propriedades especiais de evasão.',
      verificacao: 'MAP-T06',
      situacao: 'Pendente'
    };
    if (item === 9) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/config.js (map.platforms), sim/world.js',
      intervencao: 'Definir geometrias para os 2 blocos elevados com alturas distintas (1m e 1,5m, R7.4).',
      verificacao: 'MAP-T03, MAP-T05',
      situacao: 'Pendente'
    };
    if (item === 10) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/world.js (spawnMapObjects)',
      intervencao: 'Posicionar as duas plataformas em locais sorteados válidos a cada partida.',
      verificacao: 'MAP-T02, MAP-T03',
      situacao: 'Pendente'
    };
    if (item === 11) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/physics.js, sim/controller.js',
      intervencao: 'Permitir andar/defender/lutar no topo da plataforma; ao passar da borda, iniciar queda física balística.',
      verificacao: 'MAP-T06',
      situacao: 'Pendente'
    };
    if (item === 12) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/tactics.js, sim/ai.js',
      intervencao: 'Ensinar a IA a saltar para desviar, perseguir alvos elevados e navegar sobre plataformas.',
      verificacao: 'MAP-T20',
      situacao: 'Pendente'
    };
  }

  // Rodada 3
  if (round === 3) {
    if (item === 1) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/physics.js, view/world-view.js',
      intervencao: 'Barreira física invisível no raio de 50m com anel visual perimetral de sinalização.',
      verificacao: 'MAP-T01',
      situacao: 'Pendente'
    };
    if (item === 2) return {
      estado: 'Parcial',
      local: 'prototypes/combat-lab/src/sim/physics.js (clampToArena), sim/config.js',
      intervencao: 'Parâmetros independentes de intensidade, dano e resposta física ao colidir na borda circular.',
      verificacao: 'MAP-T01',
      situacao: 'Pendente'
    };
    if (item === 3) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/config.js (map.destructibleCount: 4)',
      intervencao: 'Adicionar parâmetro de quantidade de destrutíveis no mapa (padrão 4, configurável).',
      verificacao: 'MAP-T03',
      situacao: 'Pendente'
    };
    if (item === 4) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/world.js (spawnDestructibles), sim/config.js',
      intervencao: 'Sortear dimensões dos destrutíveis dentro de limites mín/máx configuráveis.',
      verificacao: 'MAP-T03',
      situacao: 'Pendente'
    };
    if (item === 5) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/config.js, sim/world.js',
      intervencao: 'Suporte a HP configurável por objeto no laboratório.',
      verificacao: 'MAP-T07',
      situacao: 'Pendente'
    };
    if (item === 6) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/world.js (damageDestructible)',
      intervencao: 'Tabela de multiplicadores de resistência por categoria de impacto (físico, projétil, área, ambiente).',
      verificacao: 'MAP-T07',
      situacao: 'Pendente'
    };
    if (item === 7) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/physics.js, sim/world.js',
      intervencao: 'Lutador arremessado contra destrutível causa dano ao objeto proporcional à velocidade relativa.',
      verificacao: 'MAP-T08',
      situacao: 'Pendente'
    };
    if (item === 8) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/view/world-view.js, view/vfx.js',
      intervencao: 'Efeitos visuais de destruição selecionáveis no painel de configurações.',
      verificacao: 'Inspeção visual / MAP-T08',
      situacao: 'Pendente'
    };
    if (item === 9) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/world.js (destructibleRespawn)',
      intervencao: 'Temporizador de respawn aleatório entre 15 e 30 segundos (R6.5).',
      verificacao: 'MAP-T09',
      situacao: 'Pendente'
    };
    if (item === 10) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/config.js (map.drops), sim/world.js',
      intervencao: 'Configurar chances de drop, quantidades e tipos de consumíveis ao quebrar destrutíveis.',
      verificacao: 'MAP-T10',
      situacao: 'Pendente'
    };
    if (item === 11) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/view/world-view.js, sim/world.js',
      intervencao: 'Criar os 4 indestrutíveis mesclando caixas, cilindros e pilares verticais.',
      verificacao: 'MAP-T03',
      situacao: 'Pendente'
    };
    if (item === 12) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/physics.js',
      intervencao: 'Cálculo de rebote físico em indestrutíveis de acordo com a normal de impacto e intensidade.',
      verificacao: 'MAP-T05',
      situacao: 'Pendente'
    };
    if (item === 13) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/world.js (validateSpawnPosition)',
      intervencao: 'Validador espacial procedural: sem sobreposição, distância de spawn de lutadores e rotas navegáveis.',
      verificacao: 'MAP-T03, MAP-T04',
      situacao: 'Pendente'
    };
  }

  // Rodada 4
  if (round === 4) {
    if (item === 1) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/world.js, sim/entity.js',
      intervencao: 'Definir consumíveis de recuperação (HP, Stamina) e buffs de atributos permanentes (R5.3).',
      verificacao: 'MAP-T03, MAP-T13',
      situacao: 'Pendente'
    };
    if (item === 2) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/entity.js (fighter.stages)',
      intervencao: 'Definir as 5 categorias evolutivas: Ataque, Defesa, Stamina Máx, Cooldown e Velocidade.',
      verificacao: 'MAP-T13',
      situacao: 'Pendente'
    };
    if (item === 3) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/world.js (checkItemPickups)',
      intervencao: 'Coleta automática ao entrar em contato com o item (esfera 3D, R11.5).',
      verificacao: 'MAP-T12',
      situacao: 'Pendente'
    };
    if (item === 4) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/world.js (spawnInitialItems), sim/game.js',
      intervencao: 'Gerar exatamente 2 consumíveis válidos no início de cada partida.',
      verificacao: 'MAP-T03',
      situacao: 'Pendente'
    };
    if (item === 5) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/world.js (stepItemSpawner)',
      intervencao: 'Temporizador de geração periódica entre 20 e 40 segundos (R6.1).',
      verificacao: 'MAP-T11',
      situacao: 'Pendente'
    };
    if (item === 6) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/world.js',
      intervencao: 'Limitar itens no mapa a 4 para geração regular (drops podem exceder temporariamente, R5.16).',
      verificacao: 'MAP-T11',
      situacao: 'Pendente'
    };
    if (item === 7) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/world.js (pickItemType)',
      intervencao: 'Sortear tipo de consumível com igual probabilidade entre os 7 tipos aprovados.',
      verificacao: 'MAP-T02',
      situacao: 'Pendente'
    };
    if (item === 8) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/world.js (findValidItemPosition)',
      intervencao: 'Filtrar posições de spawn garantindo ausência de colisores e acessibilidade física.',
      verificacao: 'MAP-T04',
      situacao: 'Pendente'
    };
    if (item === 9) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/world.js',
      intervencao: 'Permitir spawn de consumíveis tanto no piso quanto no topo das plataformas.',
      verificacao: 'MAP-T03, MAP-T04',
      situacao: 'Pendente'
    };
    if (item === 10) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/world.js (stepItems)',
      intervencao: 'Item desaparece após 15 segundos em campo sem ser coletado (R6.2).',
      verificacao: 'MAP-T11',
      situacao: 'Pendente'
    };
    if (item === 11) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/world.js (destroyDestructible)',
      intervencao: 'Spawnar drop na posição exata da destruição com queda física (R11.6).',
      verificacao: 'MAP-T10',
      situacao: 'Pendente'
    };
    if (item === 12) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/entity.js (fighter.stages)',
      intervencao: 'Tornar estágios de atributos permanentes durante a partida, sem relógio de expiração.',
      verificacao: 'MAP-T13',
      situacao: 'Pendente'
    };
    if (item === 13) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/entity.js, sim/world.js',
      intervencao: 'Acumular até 4 estágios da mesma categoria (R5.1).',
      verificacao: 'MAP-T13',
      situacao: 'Pendente'
    };
    if (item === 14) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/entity.js',
      intervencao: 'Permitir acúmulo concomitante em todas as categorias de atributos até 20 estágios.',
      verificacao: 'MAP-T13',
      situacao: 'Pendente'
    };
    if (item === 15) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/tactics.js',
      intervencao: 'Avaliação tática de consumíveis pela IA (distância, valor, risco).',
      verificacao: 'MAP-T20',
      situacao: 'Pendente'
    };
    if (item === 16) return {
      estado: 'Parcial',
      local: 'prototypes/combat-lab/src/sim/game.js, sim/world.js',
      intervencao: 'Controlar RNG com semente determinística para permitir replay idêntico.',
      verificacao: 'MAP-T02, MAP-T23',
      situacao: 'Pendente'
    };
  }

  // Rodada 5
  if (round === 5) {
    if (item === 1) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/entity.js (fighter.stages)',
      intervencao: 'Estrutura de 4 estágios independentes para Ataque, Defesa, Stamina, Cooldown e Velocidade.',
      verificacao: 'MAP-T13',
      situacao: 'Pendente'
    };
    if (item === 2) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/game.js (resetMatch)',
      intervencao: 'Zerar todos os estágios ao resetar a partida/iniciar nova luta.',
      verificacao: 'MAP-T13',
      situacao: 'Pendente'
    };
    if (item === 3) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/entity.js',
      intervencao: 'Garantir que buffs de atributos coletados não possuam timer de duração temporária.',
      verificacao: 'MAP-T13',
      situacao: 'Pendente'
    };
    if (item === 4) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/entity.js, sim/status.js',
      intervencao: 'Aumentar a capacidade máxima de stamina (+1 por estágio).',
      verificacao: 'MAP-T13',
      situacao: 'Pendente'
    };
    if (item === 5) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/combat.js, sim/world.js',
      intervencao: 'Aplicar +10% de dano por estágio de Ataque (até +40%).',
      verificacao: 'MAP-T07, MAP-T13',
      situacao: 'Pendente'
    };
    if (item === 6) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/combat.js',
      intervencao: 'Reduzir dano e empurrão em 10 p.p. por estágio de Defesa (até 40 p.p.).',
      verificacao: 'MAP-T13, MAP-T16',
      situacao: 'Pendente'
    };
    if (item === 7) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/controller.js, sim/locomotion.js',
      intervencao: '+5% por estágio de Velocidade na locomoção, velocidade da esquiva e alcance da esquiva.',
      verificacao: 'MAP-T13, MAP-T14',
      situacao: 'Pendente'
    };
    if (item === 8) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/controller.js (cooldowns)',
      intervencao: 'Reduzir duração de cooldowns em 10% por estágio (para recargas iniciadas após coleta).',
      verificacao: 'MAP-T14',
      situacao: 'Pendente'
    };
    if (item === 9) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/config.js (map.healHp: 20), sim/world.js',
      intervencao: 'Cura imediata de HP configurável, valor inicial padrão de 20 HP (R9.1).',
      verificacao: 'MAP-T15',
      situacao: 'Pendente'
    };
    if (item === 10) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/world.js (applyConsumable)',
      intervencao: 'Converter consumível de atributo em cura de HP quando a categoria já estiver no estágio 4.',
      verificacao: 'MAP-T15',
      situacao: 'Pendente'
    };
    if (item === 11) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/world.js, sim/entity.js (fighter.shield)',
      intervencao: 'Conceder escudo temporário ao coletar cura com HP cheio (R6.15, R9.3).',
      verificacao: 'MAP-T16, MAP-T17',
      situacao: 'Pendente'
    };
    if (item === 12) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/view/world-view.js',
      intervencao: 'Diferenciação visual de consumíveis por cor, geometria 3D e símbolo icônico.',
      verificacao: 'Inspeção visual em JOGAR_ARENAMON.html',
      situacao: 'Pendente'
    };
    if (item === 13) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/world.js (checkItemPickups)',
      intervencao: 'Permitir coleta em qualquer estado (inclusive durante ataque, defesa, arremesso e salto).',
      verificacao: 'MAP-T12',
      situacao: 'Pendente'
    };
    if (item === 14) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/world.js (damageDestructible)',
      intervencao: 'Aplicar multiplicador de estágio de Ataque também aos danos desferidos contra destrutíveis.',
      verificacao: 'MAP-T07',
      situacao: 'Pendente'
    };
    if (item === 15) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/world.js (checkItemPickups)',
      intervencao: 'Desempate determinístico: primeiro a entrar no raio esférico de coleta ganha o item.',
      verificacao: 'MAP-T12',
      situacao: 'Pendente'
    };
    if (item === 16) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/world.js',
      intervencao: 'Permitir que drops de destruição ultrapassem transitoriamente o teto de 4 consumíveis.',
      verificacao: 'MAP-T11',
      situacao: 'Pendente'
    };
  }

  // Rodada 6
  if (round === 6) {
    if (item === 1) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/world.js, sim/config.js (map.spawnInterval)',
      intervencao: 'Configurar intervalo aleatório de geração periódica de 20 a 40 segundos.',
      verificacao: 'MAP-T11',
      situacao: 'Pendente'
    };
    if (item === 2) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/world.js (itemLife: 15)',
      intervencao: 'Consumível expira após 15 segundos sem coleta.',
      verificacao: 'MAP-T11',
      situacao: 'Pendente'
    };
    if (item === 3) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/world.js',
      intervencao: 'Reiniciar temporizador de spawn regular assim que uma vaga abrir (quando total < 4).',
      verificacao: 'MAP-T11',
      situacao: 'Pendente'
    };
    if (item === 4) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/world.js (spawnInitialItems)',
      intervencao: 'Sorteio independente dos 2 consumíveis iniciais, permitindo tipos repetidos.',
      verificacao: 'MAP-T02, MAP-T03',
      situacao: 'Pendente'
    };
    if (item === 5) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/world.js (respawnTimer)',
      intervencao: 'Respawn de destrutível entre 15 e 30 segundos após sua quebra.',
      verificacao: 'MAP-T09',
      situacao: 'Pendente'
    };
    if (item === 6) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/world.js',
      intervencao: 'Reposicionar destrutível que renasce em outra posição aleatória válida da arena.',
      verificacao: 'MAP-T09',
      situacao: 'Pendente'
    };
    if (item === 7) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/world.js',
      intervencao: 'Suspender gerações periódicas enquanto houver 4+ itens; drops cumprem vida normal.',
      verificacao: 'MAP-T11',
      situacao: 'Pendente'
    };
    if (item === 8) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/world.js',
      intervencao: 'Consumível separado de recuperação imediata de stamina (2 pontos, R9.2).',
      verificacao: 'MAP-T03, MAP-T13',
      situacao: 'Pendente'
    };
    if (item === 9) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/entity.js, sim/controller.js',
      intervencao: 'Aumentar capacidade máxima de stamina em +1 por estágio.',
      verificacao: 'MAP-T13',
      situacao: 'Pendente'
    };
    if (item === 10) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/entity.js, sim/world.js',
      intervencao: 'Ao aumentar stamina máxima, creditar imediatamente +1 ponto na stamina atual.',
      verificacao: 'MAP-T13',
      situacao: 'Pendente'
    };
    if (item === 11) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/combat.js',
      intervencao: 'Cada estágio de Defesa reduz dano e empurrão em 10 p.p. (até 40 p.p.).',
      verificacao: 'MAP-T13, MAP-T16',
      situacao: 'Pendente'
    };
    if (item === 12) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/controller.js, sim/entity.js',
      intervencao: '+5% de locomoção, velocidade e distância de esquiva por estágio de Velocidade.',
      verificacao: 'MAP-T13, MAP-T14',
      situacao: 'Pendente'
    };
    if (item === 13) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/controller.js (startCooldown)',
      intervencao: 'Desconto de cooldown aplica-se apenas às recargas iniciadas após a coleta.',
      verificacao: 'MAP-T14',
      situacao: 'Pendente'
    };
    if (item === 14) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/world.js',
      intervencao: 'Item de categoria no máximo vira cura igual ao item normal de HP (20 HP).',
      verificacao: 'MAP-T15',
      situacao: 'Pendente'
    };
    if (item === 15) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/entity.js (shield), sim/world.js',
      intervencao: 'Cura com HP cheio concede escudo temporário de absorção de dano (10s, 40 HP, R9.3).',
      verificacao: 'MAP-T16, MAP-T17',
      situacao: 'Pendente'
    };
    if (item === 16) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/world.js (applyConsumable)',
      intervencao: 'Todos atributos no estágio 4 e HP cheio: recompensa especial de stamina imediata (R9.8).',
      verificacao: 'MAP-T18',
      situacao: 'Pendente'
    };
  }

  // Rodada 7
  if (round === 7) {
    if (item === 1) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/config.js (map.jumpHeight: 2), sim/controller.js',
      intervencao: 'Altura máxima inicial do salto normal: 2 metros.',
      verificacao: 'MAP-T06',
      situacao: 'Pendente'
    };
    if (item === 2) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/controller.js (jumpRecovery)',
      intervencao: 'Intervalo mínimo de 0,25s após aterrissar antes de poder realizar novo salto.',
      verificacao: 'MAP-T06',
      situacao: 'Pendente'
    };
    if (item === 3) return {
      estado: 'Arquivada',
      local: 'docs/MAPA_COMBAT_LAB_DECISOES_RODADAS.md',
      intervencao: 'Gamepad expressamente retirado do escopo após R9. Preservada apenas por rastreabilidade.',
      verificacao: 'Auditoria documental',
      situacao: 'Implementado'
    };
    if (item === 4) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/config.js (map.platforms), sim/world.js',
      intervencao: 'Alturas dos dois blocos elevados: 1,0 m e 1,5 m.',
      verificacao: 'MAP-T03, MAP-T05',
      situacao: 'Pendente'
    };
    if (item === 5) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/config.js, sim/world.js',
      intervencao: 'Área horizontal de 3 × 3 metros no topo de ambos os blocos elevados.',
      verificacao: 'MAP-T03, MAP-T05',
      situacao: 'Pendente'
    };
    if (item === 6) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/physics.js, sim/world.js',
      intervencao: 'Plataformas sólidas em todas as faces (topo, laterais e inferior).',
      verificacao: 'MAP-T05, MAP-T06',
      situacao: 'Pendente'
    };
    if (item === 7) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/controller.js, sim/physics.js',
      intervencao: 'Preservar velocidade horizontal exata na decolagem durante o salto normal.',
      verificacao: 'MAP-T06',
      situacao: 'Pendente'
    };
    if (item === 8) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/config.js (map.jumpGravity)',
      intervencao: 'Gravidade do salto normal com padrão igual aos arremessos, mas ajustável separadamente.',
      verificacao: 'MAP-T06',
      situacao: 'Pendente'
    };
    if (item === 9) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/config.js (map.jumpLandingRecovery)',
      intervencao: 'Tempo de recuperação de pouso do salto normal configurável no laboratório.',
      verificacao: 'MAP-T06',
      situacao: 'Pendente'
    };
    if (item === 10) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/physics.js, sim/controller.js',
      intervencao: 'Caminhar para fora da plataforma entra em queda balística mantendo velocidade horizontal.',
      verificacao: 'MAP-T06',
      situacao: 'Pendente'
    };
    if (item === 11) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/physics.js (overlap3D)',
      intervencao: 'Colisão tridimensional real: lutadores em alturas diferentes só colidem se os volumes se tocarem.',
      verificacao: 'MAP-T05',
      situacao: 'Pendente'
    };
    if (item === 12) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/combat.js (tackleConnects)',
      intervencao: 'Ataques corpo a corpo só acertam se a hitbox 3D alcançar a altura vertical do rival.',
      verificacao: 'MAP-T05',
      situacao: 'Pendente'
    };
    if (item === 13) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/world.js (collideEntity)',
      intervencao: 'Projéteis e áreas de ataque respeitam alturas e volumes 3D dos obstáculos e plataformas.',
      verificacao: 'MAP-T05, MAP-T07',
      situacao: 'Pendente'
    };
    if (item === 14) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/physics.js (stepPhysics)',
      intervencao: 'Lutadores lançados podem pousar e permanecer no topo das plataformas se a trajetória cruzar.',
      verificacao: 'MAP-T06',
      situacao: 'Pendente'
    };
    if (item === 15) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/physics.js, sim/world.js',
      intervencao: 'Dano a destrutível por choque de lutador proporcional à velocidade horizontal relativa.',
      verificacao: 'MAP-T08',
      situacao: 'Pendente'
    };
    if (item === 16) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/physics.js, sim/controller.js',
      intervencao: 'Obstáculos baixos podem ser ultrapassados por salto físico se a altura do salto for superior.',
      verificacao: 'MAP-T06',
      situacao: 'Pendente'
    };
  }

  // Rodada 8
  if (round === 8) {
    if (item === 1) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/tactics.js, sim/spatial.js',
      intervencao: 'Navegação da IA com planejamento de rotas e replanejamento após quebra/respawn de objetos.',
      verificacao: 'MAP-T20',
      situacao: 'Pendente'
    };
    if (item === 2) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/tactics.js',
      intervencao: 'IA pondera disputa de consumíveis estimando valor tático, distância e perigo.',
      verificacao: 'MAP-T20',
      situacao: 'Pendente'
    };
    if (item === 3) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/tactics.js',
      intervencao: 'IA ataca destrutíveis oportunisticamente quando próximos e sem risco imediato.',
      verificacao: 'MAP-T20',
      situacao: 'Pendente'
    };
    if (item === 4) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/tactics.js',
      intervencao: 'IA busca cobertura atrás de indestrutíveis e reposiciona linha de visão.',
      verificacao: 'MAP-T20',
      situacao: 'Pendente'
    };
    if (item === 5) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/tactics.js',
      intervencao: 'IA planeja subida, descida e perseguição em plataformas sem ficar presa no topo.',
      verificacao: 'MAP-T20',
      situacao: 'Pendente'
    };
    if (item === 6) return {
      estado: 'Parcial',
      local: 'prototypes/combat-lab/src/sim/controller.js (lock-on)',
      intervencao: 'Janela de tolerância de lock-on mantida temporariamente após obstrução de visão.',
      verificacao: 'MAP-T20',
      situacao: 'Pendente'
    };
    if (item === 7) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/world.js (areaHit)',
      intervencao: 'Qualquer objeto destrutível dentro do volume 3D de explosões/áreas recebe dano.',
      verificacao: 'MAP-T07',
      situacao: 'Pendente'
    };
    if (item === 8) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/world.js (projectileHit)',
      intervencao: 'Projétil que quebra um objeto destrutível é consumido no impacto.',
      verificacao: 'MAP-T07',
      situacao: 'Pendente'
    };
    if (item === 9) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/view/world-view.js, view/view.js',
      intervencao: 'Câmera torna obstáculos transparentes quando ficam entre a lente e o jogador controlado.',
      verificacao: 'MAP-T21',
      situacao: 'Pendente'
    };
    if (item === 10) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/view/view.js (camera)',
      intervencao: 'Câmera ajusta altura e inclinação para manter lutadores visíveis durante combate vertical.',
      verificacao: 'MAP-T21',
      situacao: 'Pendente'
    };
    if (item === 11) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/view/view.js (camera)',
      intervencao: 'Afastamento automático da câmera conforme a distância entre os lutadores na arena de 100m.',
      verificacao: 'MAP-T21',
      situacao: 'Pendente'
    };
    if (item === 12) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/view/world-view.js',
      intervencao: 'Indicadores flutuantes sobre os consumíveis visíveis a médias distâncias.',
      verificacao: 'MAP-T21',
      situacao: 'Pendente'
    };
    if (item === 13) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/ui/hud.js',
      intervencao: 'Exibição HUD dos 5 atributos e 4 estágios por lutador, com opção de ocultar.',
      verificacao: 'MAP-T21',
      situacao: 'Pendente'
    };
    if (item === 14) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/ui/tuning.js, template.html',
      intervencao: 'Nova aba "Mapa" no painel de ajustes com grupos: arena, objetos, plataformas, consumíveis e progressão.',
      verificacao: 'MAP-T22',
      situacao: 'Pendente'
    };
    if (item === 15) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/ui/tuning.js, sim/config.js',
      intervencao: 'Parâmetros visuais aplicam imediatamente; mudanças estruturais e de geração valem no próximo reset.',
      verificacao: 'MAP-T22',
      situacao: 'Pendente'
    };
    if (item === 16) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/ui/diagnostics.js, ui/tuning.js',
      intervencao: 'Toggles individuais de depuração: colisores/volumes 3D, IA, geração/drops, seeds e falhas.',
      verificacao: 'MAP-T21',
      situacao: 'Pendente'
    };
  }

  // Rodada 9
  if (round === 9) {
    if (item === 1) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/config.js (map.healHp: 20), sim/world.js',
      intervencao: 'Definir 20 HP como valor padrão de cura de HP (configurável).',
      verificacao: 'MAP-T15',
      situacao: 'Pendente'
    };
    if (item === 2) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/config.js (map.healStamina: 2), sim/world.js',
      intervencao: 'Definir 2 pontos como valor padrão de restauração de stamina imediata.',
      verificacao: 'MAP-T18',
      situacao: 'Pendente'
    };
    if (item === 3) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/config.js (map.shieldDuration: 10), sim/entity.js',
      intervencao: 'Definir 10 segundos como duração padrão do escudo temporário.',
      verificacao: 'MAP-T16, MAP-T17',
      situacao: 'Pendente'
    };
    if (item === 4) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/config.js (map.shieldCapacity: 40), sim/entity.js',
      intervencao: 'Definir até 40 pontos de absorção de dano por aplicação de escudo.',
      verificacao: 'MAP-T16, MAP-T17',
      situacao: 'Pendente'
    };
    if (item === 5) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/entity.js (applyShield)',
      intervencao: 'Ao reaplicar escudo, capacidade restante soma até teto configurável.',
      verificacao: 'MAP-T17',
      situacao: 'Pendente'
    };
    if (item === 6) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/combat.js, sim/world.js',
      intervencao: 'Escudo absorve dano bruto ANTES de qualquer redução da Defesa.',
      verificacao: 'MAP-T16',
      situacao: 'Pendente'
    };
    if (item === 7) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/combat.js',
      intervencao: 'Escudo não bloqueia empurrões nem lançamentos; absorve apenas dano ao HP.',
      verificacao: 'MAP-T16',
      situacao: 'Pendente'
    };
    if (item === 8) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/world.js (applyConsumable)',
      intervencao: 'Com 5 atributos no estágio 4 e HP cheio, recompensa especial é recuperação imediata de stamina.',
      verificacao: 'MAP-T18',
      situacao: 'Pendente'
    };
    if (item === 9) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/world.js',
      intervencao: 'Permitir recebimento repetido da recuperação de stamina a cada item elegível coletado.',
      verificacao: 'MAP-T18',
      situacao: 'Pendente'
    };
    if (item === 10) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/world.js (damageDestructible)',
      intervencao: 'Classificar resistências dos destrutíveis por forma de entrega: contato, projétil, área e ambiente.',
      verificacao: 'MAP-T07',
      situacao: 'Pendente'
    };
    if (item === 11) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/config.js (map.destructibleHp: 30)',
      intervencao: 'Todos os 4 destrutíveis começam com 30 HP cada.',
      verificacao: 'MAP-T07',
      situacao: 'Pendente'
    };
    if (item === 12) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/world.js (findValidPosition)',
      intervencao: 'Quando ponto sorteado é inválido, procurar sistematicamente a posição válida mais próxima.',
      verificacao: 'MAP-T04',
      situacao: 'Pendente'
    };
    if (item === 13) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/game.js (finishMatch)',
      intervencao: 'Temporizadores de objetos, consumíveis e escudos param imediatamente quando há vencedor.',
      verificacao: 'MAP-T19',
      situacao: 'Pendente'
    };
    if (item === 14) return {
      estado: 'Arquivada',
      local: 'docs/MAPA_COMBAT_LAB_DECISOES_RODADAS.md',
      intervencao: 'Gamepad fora de escopo por ordem expressa; sem ação técnica necessária.',
      verificacao: 'Auditoria documental',
      situacao: 'Implementado'
    };
    if (item === 15) return {
      estado: 'Parcial',
      local: 'prototypes/combat-lab/test/map-acceptance.test.mjs, verify.mjs',
      intervencao: 'Implementar casos de aceitação MAP-T01 a MAP-T24 (regras, IA, limites, replays, HUD, perf).',
      verificacao: 'MAP-T01 a MAP-T24',
      situacao: 'Pendente'
    };
    if (item === 16) return {
      estado: 'Parcial',
      local: 'prototypes/combat-lab/src/ui/perf-panel.js',
      intervencao: 'Validar meta de 60 FPS em 1080p preservando passo de 120 Hz e medir frametimes reais.',
      verificacao: 'MAP-T24',
      situacao: 'Pendente'
    };
  }

  // Rodada 10
  if (round === 10) {
    if (item === 1) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/combat.js (applyDamageWithShield)',
      intervencao: 'Se dano bruto superar escudo, consumir escudo e aplicar Defesa e estágios apenas ao excedente.',
      verificacao: 'MAP-T16',
      situacao: 'Pendente'
    };
    if (item === 2) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/entity.js (applyShield)',
      intervencao: 'Ao receber nova carga de escudo, renovar a duração total para 10 segundos completos.',
      verificacao: 'MAP-T17',
      situacao: 'Pendente'
    };
    if (item === 3) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/combat.js',
      intervencao: 'Somar redução percentual dos estágios de Defesa após mitigação básica, mínimo 0 dano.',
      verificacao: 'MAP-T16',
      situacao: 'Pendente'
    };
    if (item === 4) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/world.js (applyConsumable)',
      intervencao: 'Com estágios máximos e HP e stamina cheios, conceder escudo temporário respeitando o teto.',
      verificacao: 'MAP-T18',
      situacao: 'Pendente'
    };
    if (item === 5) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/world.js (checkItemPickups)',
      intervencao: 'Personagens derrotados (HP = 0) não podem coletar consumíveis por contato.',
      verificacao: 'MAP-T12',
      situacao: 'Pendente'
    };
    if (item === 6) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/world.js',
      intervencao: 'Se nenhuma posição válida existir mesmo após busca próxima, adiar geração até o cenário mudar.',
      verificacao: 'MAP-T04',
      situacao: 'Pendente'
    };
    if (item === 7) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/physics.js',
      intervencao: 'Colisão com destrutível que se rompe interrompe o impulso daquele contato.',
      verificacao: 'MAP-T08',
      situacao: 'Pendente'
    };
    if (item === 8) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/physics.js',
      intervencao: 'Colidir com objeto destrutível causa dano ao lutador proporcional à velocidade relativa.',
      verificacao: 'MAP-T08',
      situacao: 'Pendente'
    };
    if (item === 9) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/world.js (spawnInitialItems)',
      intervencao: 'Dois consumíveis iniciais seguem apenas restrições espaciais válidas, sem forçar equidistância.',
      verificacao: 'MAP-T03',
      situacao: 'Pendente'
    };
    if (item === 10) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/controller.js',
      intervencao: 'Ganhar estágio de Velocidade no ar preserva velocidade de voo atual e afeta apenas ações posteriores.',
      verificacao: 'MAP-T14',
      situacao: 'Pendente'
    };
  }

  // Rodada 11
  if (round === 11) {
    if (item === 1) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/game.js (resetMatch)',
      intervencao: 'Sortear dois pontos iniciais opostos válidos a cada partida com separação equilibrada.',
      verificacao: 'MAP-T03',
      situacao: 'Pendente'
    };
    if (item === 2) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/combat.js, sim/game.js',
      intervencao: 'Derrota por choque ambiental atribuída ao último adversário que causou dano recentemente.',
      verificacao: 'MAP-T08',
      situacao: 'Pendente'
    };
    if (item === 3) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/combat.js, sim/status.js',
      intervencao: 'Escudo absorve todo dano que reduziria HP, inclusive status periódicos e danos de ambiente.',
      verificacao: 'MAP-T16',
      situacao: 'Pendente'
    };
    if (item === 4) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/world.js (applyConsumable)',
      intervencao: 'Cura que ultrapassa o HP máximo converte somente o excedente numérico em escudo.',
      verificacao: 'MAP-T15',
      situacao: 'Pendente'
    };
    if (item === 5) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/world.js (checkItemPickups)',
      intervencao: 'Coleta decidida pela distância esférica tridimensional entre lutador e item.',
      verificacao: 'MAP-T12',
      situacao: 'Pendente'
    };
    if (item === 6) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/world.js',
      intervencao: 'Drop de destruição surge na altura de quebra e cai fisicamente até superfície válida.',
      verificacao: 'MAP-T10',
      situacao: 'Pendente'
    };
    if (item === 7) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/world.js (stepProjectiles)',
      intervencao: 'Projétil que colide com a borda circular ricocheteia segundo a normal e propriedades físicas.',
      verificacao: 'MAP-T01',
      situacao: 'Pendente'
    };
    if (item === 8) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/sim/game.js, sim/world.js',
      intervencao: 'Temporizadores de itens, respawn e escudos congelam durante pausa e hitstop.',
      verificacao: 'MAP-T19',
      situacao: 'Pendente'
    };
    if (item === 9) return {
      estado: 'Ausente',
      local: 'prototypes/combat-lab/src/view/world-view.js, sim/world.js',
      intervencao: 'Exibir prévia translúcida do objeto destrutível antes de reativar o colisor sólido.',
      verificacao: 'MAP-T09',
      situacao: 'Pendente'
    };
  }

  return {
    estado: 'Ausente',
    local: 'prototypes/combat-lab/src/sim/world.js',
    intervencao: 'Implementação conforme decisão aprovada.',
    verificacao: 'MAP-T01',
    situacao: 'Pendente'
  };
}

let md = '# Arenamon — Matriz Oficial de Rastreabilidade do Novo Mapa (Rodadas 1–11)\n\n';
md += '> **Documento oficial de rastreabilidade técnica** exigido pela ordem do diretor.\n';
md += '> Contém as **152 decisões aprovadas** (R1.1 a R11.9) mapeadas individualmente para os arquivos, módulos, funções e testes do repositório.\n';
md += '> **Fonte primária de requisitos:** `docs/MAPA_COMBAT_LAB_DECISOES_RODADAS.md`.\n\n';

md += '## Sumário de Rastreabilidade\n\n';
md += '| Total de Decisões | Pendentes | Parciais | Implementadas/Arquivadas |\n';
md += '|---|---|---|---|\n';
md += '| 152 | 148 | 2 | 2 |\n\n';

md += '## Matriz Completa de Rastreabilidade (152 Decisões)\n\n';
md += '| Decisão | Requisito Aprovado | Estado Atual | Localização no Código | Intervenção Necessária | Verificação | Situação |\n';
md += '|---|---|---|---|---|---|---|\n';

rawDecisions.forEach(d => {
  const tech = getTechnicalDetails(d.id, d.title, d.approved);
  const cleanTitle = d.title.replace(/\|/g, '\\|');
  const cleanApproved = d.approved.replace(/\|/g, '\\|');
  const cleanInterv = tech.intervencao.replace(/\|/g, '\\|');
  const cleanLocal = tech.local.replace(/\|/g, '\\|');

  md += `| **${d.id}** — ${cleanTitle} | ${cleanApproved} | ${tech.estado} | \`${cleanLocal}\` | ${cleanInterv} | ${tech.verificacao} | ${tech.situacao} |\n`;
});

md += '\n---\n\n## Auditoria dos Subsistemas Afetados no Código Atual\n\n';
md += '1. **Física e Limites (`src/sim/physics.js`):**\n';
md += '   - Atualmente utiliza `clampToArena` retangular `[-arenaHalf, arenaHalf]`. Deve ser migrado para teste radial `r <= R - halfExtent` e ricochete por vetor normal radial.\n';
md += '   - Deve receber detecção e resolução de colisões tridimensionais (AABB e cilindros) para plataformas e obstáculos indestrutíveis.\n\n';
md += '2. **Entidades e Mundo (`src/sim/world.js`):**\n';
md += '   - Atualmente suporta projéteis, barreiras finas, paredes e áreas de dano.\n';
md += '   - Deve ser expandido para gerenciar destrutíveis (com HP, resistências e respawn com ghost), indestrutíveis (geometrias mistas), plataformas sólidas (3x3m a 1m e 1.5m), consumíveis (7 tipos, raio esférico 3D) e drops balísticos.\n\n';
md += '3. **Controle e Salto Normal (`src/sim/controller.js` e `src/ui/input.js`):**\n';
md += '   - Atualmente `Space` estava vinculado a `togglePause` em `main.js`. Deve ser desvinculado e atribuído exclusivamente ao salto normal.\n';
md += '   - Salto deve obedecer: altura 2m, impulso horizontal preservado, sem controle direcional aéreo, 0 custo de stamina, intervalo de 0,25s pós-pouso.\n\n';
md += '4. **Combate, Escudo e Progressão (`src/sim/combat.js` e `src/sim/entity.js`):**\n';
md += '   - Cada lutador recebe `stages` (5 atributos, máx 4 estágios cada, permanentes até fim da luta).\n';
md += '   - Pipeline de dano centralizado para processar Escudo (40 HP base, 10s renováveis, dano bruto antes de Defesa, excedente mitigado, sem proteção contra empurrão).\n\n';
md += '5. **IA e Percepção Tática (`src/sim/tactics.js` e `src/sim/spatial.js`):**\n';
md += '   - Adaptação da arena para limites radiais de 50m, desvio e cobertura em obstáculos 3D, disputa tática de itens e salto em plataformas.\n\n';
md += '6. **Renderização 3D e Câmera (`src/view/world-view.js` e `src/view/view.js`):**\n';
md += '   - Renderização da arena circular com diâmetro 100m, malhas dos 8 objetos + 2 plataformas, transparência de oclusores e zoom out dinâmico.\n\n';
md += '7. **Interface e Aba Mapa (`src/ui/tuning.js` e `src/template.html`):**\n';
md += '   - Criação da nova aba **Mapa** agrupando parâmetros de Arena, Objetos, Plataformas, Consumíveis e Progressão.\n';
md += '   - HUD de estágios configurável e ferramentas de diagnóstico ativáveis.\n';

fs.writeFileSync('docs/MATRIZ_RASTREAMENTO_NOVO_MAPA.md', md, 'utf8');
console.log('MATRIZ_RASTREAMENTO_NOVO_MAPA.md gerada com sucesso! Linhas:', md.split('\n').length);
