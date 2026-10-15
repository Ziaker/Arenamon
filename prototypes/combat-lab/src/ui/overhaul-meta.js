// Metadados dos parâmetros do overhaul: locomoção contínua, curva em fases de X/C, sprint, IA, efeitos visuais,
// sombras, HUD, altura visual e tremor de câmera. kind: 'range' (padrão), 'select', 'toggle' ou 'color'.
import {VFX_TYPES, SHAKE_PROFILES} from '../view/vfx.js';

const sec = n => n.toFixed(2) + ' s', mps2 = n => n.toFixed(1) + ' m/s²', x = n => n.toFixed(2) + '×', pct = n => (n * 100).toFixed(0) + '%', m = n => n.toFixed(2) + ' m', num = n => n.toFixed(2);
const onOff = n => n ? 'Ligado' : 'Desligado';
const R = (min, max, step, fmt) => ({min, max, step, fmt});
const toggle = {min: 0, max: 1, step: 1, fmt: onOff, kind: 'toggle'};
const color = {min: 0, max: 0xffffff, step: 1, fmt: n => '#' + Math.round(n).toString(16).padStart(6, '0'), kind: 'color'};
const select = options => ({min: 0, max: options.length - 1, step: 1, fmt: n => options[n] ?? '?', kind: 'select', options});

const LOCO = {
  model: ['Modelo de locomoção', 'Contínuo (overhaul): aceleração com curva, aderência lateral, atrito e giro com aceleração angular. v6: aproximação linear antiga (mantida para comparação e paridade).', select(['v6 (linear)', 'Contínuo (overhaul)'])],
  acceleration: ['Aceleração', 'Aceleração (m/s²) ao sair do repouso rumo à direção pedida. Valores altos ≈ resposta instantânea; baixos dão sensação de peso.', R(1, 200, .5, mps2)],
  braking: ['Frenagem', 'Desaceleração (m/s²) ao soltar as setas. Somada ao atrito; nunca inverte o sentido.', R(1, 200, .5, mps2)],
  reversal: ['Inversão (desaceleração contra o movimento)', 'Ao pedir o sentido oposto, a velocidade atual cai com esta desaceleração até atravessar zero; só então acelera no novo sentido.', R(1, 300, .5, mps2)],
  accelCurve: ['Curva da aceleração', '0 = aceleração constante; 1 = forte no início e suave perto da velocidade máxima (aproximação progressiva).', R(0, .95, .01, num)],
  brakeCurve: ['Curva da frenagem', 'Quanto a frenagem suaviza perto de parar (deslizamento residual). 0 = frenagem constante.', R(0, .95, .01, num)],
  friction: ['Atrito', 'Desaceleração proporcional à velocidade (por segundo) somada à frenagem.', R(0, 10, .05, num)],
  turnGrip: ['Resistência à mudança de direção (aderência lateral)', 'Desaceleração (m/s²) da parte da velocidade fora da direção pedida. Baixa = curvas largas e deriva; alta = mudança de direção quase seca.', R(1, 200, .5, mps2)],
  residualSpeed: ['Velocidade residual', 'Abaixo desta velocidade a curva de frenagem deixa de suavizar e o deslizamento termina.', R(0, 2, .01, n => n.toFixed(2) + ' m/s')],
  turnAcceleration: ['Aceleração angular do giro', 'Quão rápido o corpo começa e termina de girar (rad/s²). O giro máximo continua sendo “Giro do personagem”.', R(1, 400, 1, n => n.toFixed(0) + ' rad/s²')],
  moveFrame: ['Referencial das setas com lock-on', 'Câmera: o lock-on cuida só da câmera, da orientação e da mira (movimento livre). Alvo (v6): ↑ sempre rumo ao alvo.', select(['Câmera (livre)', 'Alvo (v6)'])],
  frameLatch: ['Travar o referencial enquanto a seta é mantida', 'Lê o ângulo da câmera quando a direção pressionada muda e o mantém. Evita que a câmera girando encurve a trajetória (órbita involuntária).', toggle],
  lockFacing: ['Orientação do corpo com lock-on', 'Para onde o corpo olha com alvo fixado. Híbrido: para o alvo parado/defendendo e para onde anda em movimento.', select(['Para onde anda', 'Sempre para o alvo', 'Híbrido'])],
  stopThreshold: ['Limiar das animações de freio', 'Fração da velocidade de caminhada acima da qual uma frenagem real toca o “Freio da caminhada”.', R(0, 1, .01, pct)],
};
const PHASES = {
  distanceReference: ['Tempo de referência da distância', 'Distância nominal = multiplicador × este tempo × velocidade do lutador. Fixo: mudar a duração (inclusive pela sincronização com clipes) não muda a distância. 0 = usa a própria duração (Etapa A).', R(0, 1.5, .01, n => n ? sec(n) : 'duração')],
  profile: ['Curva de movimento', 'Em fases: preparação → impulso → deslocamento → desaceleração → recuperação, com a mesma distância total. Polinomial: curva da Etapa A (impulso inicial).', select(['Polinomial (Etapa A)', 'Em fases (overhaul)'])],
  prepTime: ['Fase de preparação', 'Fração da duração em que a ação ainda arranca devagar (antecipação).', R(0, .4, .01, pct)],
  impulseTime: ['Fase de impulso', 'Fração da duração em que a velocidade sobe até o pico.', R(.02, .5, .01, pct)],
  decelStart: ['Início da desaceleração', 'Momento (fração da duração) em que a velocidade começa a cair até parar.', R(.1, .95, .01, pct)],
  recoveryTime: ['Fase de recuperação', 'Fração final da duração já sem deslocamento.', R(0, .4, .01, pct)],
  prepSpeed: ['Velocidade na preparação', 'Velocidade ao fim da preparação, relativa ao pico.', R(0, 1, .01, pct)],
  travelEnd: ['Velocidade ao fim do deslocamento', 'Velocidade relativa ao pico quando começa a desaceleração.', R(.1, 1, .01, pct)],
};
const SPRINT = {
  speedMultiplier: ['Velocidade do sprint', 'Multiplicador da velocidade de caminhada do lutador durante o sprint.', R(1, 3, .01, x)],
  acceleration: ['Aceleração do sprint', 'Aceleração própria (m/s²) até a velocidade do sprint.', R(1, 200, .5, mps2)],
  braking: ['Frenagem do sprint', 'Desaceleração (m/s²) ao soltar C ou acabar a stamina, até a velocidade de caminhada (ou de exausto).', R(1, 200, .5, mps2)],
  turnGrip: ['Aderência lateral no sprint', 'Resistência à mudança de direção durante o sprint (curvas mais abertas que andando).', R(1, 200, .5, mps2)],
  staminaDrain: ['Consumo de stamina por segundo', 'Stamina gasta por segundo de sprint. A regeneração fica suspensa durante o sprint.', R(0, 3, .01, n => n.toFixed(2) + '/s')],
  minStamina: ['Stamina mínima para entrar', 'Sem esta stamina, segurar C depois da esquiva não inicia o sprint.', R(0, 3, .05, num)],
  entryFraction: ['Entrada a partir de (fração da esquiva)', 'Com C ainda pressionado e uma direção, a esquiva vira sprint a partir desta fração (1 = só quando a esquiva termina). Invulnerabilidade e janelas anteriores não mudam.', R(.3, 1, .01, pct)],
  exhaustedStop: ['Stamina zerada encerra o sprint', 'Ao zerar a stamina o sprint termina com o freio do sprint e o lutador fica exausto (regra da stamina).', toggle],
};
const AI = {
  moveSmoothing: ['Suavização da intenção de movimento (IA)', 'Giro máximo (rad/s) da direção que a IA envia ao controlador. Contra giros instantâneos e zigue-zague; ataques e respostas a ameaças passam direto. 0 = intenções cruas (v6).', R(0, 40, .5, n => n ? n.toFixed(1) + ' rad/s' : 'desligada')],
  minDirectionHold: ['Retenção contra zigue-zague (IA)', 'Tempo mínimo antes de a IA voltar à direção anterior logo depois de mudar.', R(0, .6, .01, sec)],
};
const TOGGLES = {
  enableEnemyAI: ['IA do oponente', 'Desligada: o vermelho fica na arena como boneco, recebendo dano, colisões e reações físicas, sem tomar decisões.', toggle],
  enableSprint: ['Permitir sprint (C mantido)', 'Liga o sprint depois da esquiva com C pressionado.', toggle],
};
// ---------- VFX ----------
const VFX_PARAMS = {
  size: ['Tamanho', R(.2, 3, .01, x)], duration: ['Duração', R(.05, 2, .01, sec)], count: ['Quantidade de partículas', R(1, 80, 1, n => String(n))], intensity: ['Intensidade', R(.1, 3, .01, x)],
  speed: ['Velocidade de expansão', R(.5, 25, .1, n => n.toFixed(1) + ' m/s')], opacity: ['Opacidade', R(0, 1, .01, pct)], color: ['Cor', color], color2: ['Cor secundária', color],
  glow: ['Brilho', R(.2, 4, .01, x)], fade: ['Dissipação', R(.3, 4, .01, num)], length: ['Comprimento', R(.1, 4, .01, m)], width: ['Largura', R(.01, .4, .005, m)],
  spread: ['Dispersão / abertura', R(0, 2, .01, m)], interval: ['Intervalo', R(.005, .4, .005, sec)], density: ['Densidade', R(.1, 4, .01, x)], frequency: ['Frequência', R(1, 80, 1, n => n + '/s')],
  expansion: ['Expansão', R(0, 3, .01, x)], scale: ['Escala', R(.2, 3, .01, x)], wave: ['Tamanho da onda', R(.2, 6, .01, m)], flash: ['Intensidade do flash', R(0, 1, .01, pct)],
  freeze: ['Congelamento visual (só poses e efeito)', R(0, .25, .005, n => (n * 1000).toFixed(0) + ' ms')], radius: ['Raio', R(.2, 4, .01, m)], particleSize: ['Tamanho das partículas', R(.02, 1, .01, m)],
  elevation: ['Elevação', R(0, 3, .01, x)], minImpact: ['Impacto mínimo para disparar', R(0, 15, .1, n => n.toFixed(1) + ' m/s')], fallSpeed: ['Velocidade de queda', R(.1, 6, .01, n => n.toFixed(2) + ' m/s')],
  startHeight: ['Altura inicial', R(.3, 4, .01, m)], height: ['Altura', R(.3, 4, .01, m)], scaleWithRate: ['Intensidade acompanha a taxa de recuperação', toggle],
  target: ['Mostrar em', select(['Adversário', 'Ambos', 'Jogador'])], enabled: ['Ligado', toggle], variant: ['Variante', null],
  maxParticles: ['Limite de partículas simultâneas', R(100, 4000, 50, n => String(n))], debugLog: ['Registrar motivo de cada disparo', toggle], legacy: ['Efeitos legados do v6 (partículas em caixa e tremor antigo)', toggle],
  profile: ['Perfil', select(SHAKE_PROFILES)], amplitude: ['Amplitude', R(0, .6, .005, m)], damping: ['Amortecimento', R(0, 30, .1, num)], angular: ['Deslocamento angular', R(0, 3, .01, x)], limit: ['Limite máximo', R(0, 1, .01, m)],
};
const VFX_HELP = {
  freeze: 'Pausa só as poses dos personagens e aplica um filtro na tela; a simulação continua no mesmo tempo (nada muda nas regras).',
  minImpact: 'Velocidade vertical mínima no contato com o solo (evento físico real) para mostrar o efeito.',
  target: 'A exaustão é o estado real da simulação (stamina esgotada), não “stamina baixa”.',
  scaleWithRate: 'Liga: mais partículas quando a regeneração está mais rápida (curva da simulação).',
  limit: 'Deslocamento máximo somado de todos os tremores ativos.',
};
const SHADOW = {
  style: ['Estilo da sombra', 'A: quadrada (compatibilidade). B: círculo simples. C: círculo suave com gradiente radial.', select(['A · Quadrada (atual)', 'B · Círculo simples', 'C · Círculo suave'])],
  opacity: ['Opacidade', 'Opacidade da sombra circular no chão.', R(0, 1, .01, pct)], radius: ['Raio', 'Raio da sombra circular.', R(.1, 2, .01, m)],
  scaleX: ['Escala X', 'Alongamento lateral.', R(.2, 3, .01, x)], scaleZ: ['Escala Z', 'Alongamento frente/trás.', R(.2, 3, .01, x)],
  softness: ['Suavidade', 'Largura da borda que se dissipa (estilo C).', R(0, 1, .05, pct)], offsetX: ['Deslocamento X', 'Deslocamento relativo à posição física.', R(-1, 1, .01, m)], offsetZ: ['Deslocamento Z', 'Deslocamento relativo à posição física.', R(-1, 1, .01, m)],
  intensity: ['Intensidade', 'Multiplicador final da escuridão da sombra.', R(0, 2, .01, x)],
};
const HUD = {
  proposal: ['HUD em uso', 'Atual: HUD do laboratório. A/B/C: propostas para avaliação (mesmos dados reais). Só uma aparece por vez.', select(['Atual', 'A · Arcade Vector', 'B · Combat Halo', 'C · Tactical Combat'])],
  scale: ['Escala das propostas', 'Tamanho dos elementos das propostas A/B/C.', R(.5, 1.6, .01, x)],
  demoCooldowns: ['Mostrar cooldowns demonstrativos', 'Quatro indicadores de DEMONSTRAÇÃO para os quatro movimentos futuros (sem nomes, tempos ou regras oficiais).', toggle],
  demoAuto: ['Ciclo automático dos cooldowns (demonstração)', 'Dispara os quatro indicadores em sequência para verificar o comportamento visual.', toggle],
  demoDuration: ['Recarga de demonstração', 'Duração FICTÍCIA da recarga dos indicadores de demonstração.', R(.5, 15, .1, sec)],
  damageDelay: ['Atraso visual do dano', 'Tempo até a faixa de dano recente alcançar a vida atual (propostas A e C).', R(0, 2, .01, sec)],
};
const GROUND = {
  autoGround: ['Ajuste automático de altura (GLB)', 'Apoia o ponto mais baixo de cada clipe no chão (por animação, com mistura nas transições).', toggle],
  visualOffset: ['Altura visual global', 'Desloca blocos e modelos sem mover colisor nem sombra. O offset por personagem fica em Personagens.', R(-1, 1, .01, m)],
};
const RING = {
  inner: ['Raio interno do indicador C → X', 'Só desenho: a regra do cancelamento C → X é por TEMPO (janela início/fim), não por distância.', R(.2, 3, .01, m)],
  width: ['Largura do indicador C → X', 'Só desenho.', R(.02, 1, .01, m)], opacity: ['Opacidade do indicador C → X', 'Só desenho.', R(0, 1, .01, pct)],
};

/** Metadado de um caminho do overhaul (ou null). */
export function overhaulMeta(path) {
  const parts = path.split('.'), key = parts.at(-1), root = parts[0];
  const out = (label, help, range) => range && {label, help, range: {...range}};
  if (root === 'locomotion' && LOCO[key]) return out(...LOCO[key]);
  if (root === 'actions' && (parts[1] === 'dodge' || parts[1] === 'tackle') && PHASES[key]) {const [l, h, r] = PHASES[key];return out(`${l} · ${parts[1] === 'dodge' ? 'C' : 'X'}`, h, r);}
  if (root === 'actions' && parts[1] === 'sprint' && SPRINT[key]) return out(...SPRINT[key]);
  if (path.startsWith('extras.ai.') && AI[key]) return out(...AI[key]);
  if (path.startsWith('extras.toggles.') && TOGGLES[key]) return out(...TOGGLES[key]);
  if (root === 'display') {const table = {shadow: SHADOW, hud: HUD, grounding: GROUND, cancelRing: RING}[parts[1]];if (table?.[key]) return out(...table[key]);return null;}
  if (root === 'vfx') {
    const type = parts[1], def = VFX_TYPES.find(t => t[0] === type);
    if (key === 'variant' && def) return out('Variante', 'Três alternativas visuais realmente diferentes.', select(def[2]));
    const p = VFX_PARAMS[key];if (!p) return null;
    const label = type === 'shakeMaster' && key === 'enabled' ? 'Tremores de câmera (todos)' : type === 'master' && key === 'enabled' ? 'Efeitos visuais (todos)' : p[0];
    return out(label, VFX_HELP[key] || `${p[0]} do efeito. Só aparência: não altera regras, tempos da simulação ou cooldowns.`, p[1]);
  }
  return null;
}
