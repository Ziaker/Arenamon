// Metadados dos parâmetros do overhaul: locomoção contínua, curva em fases de X/C, sprint, IA, efeitos visuais,
// sombras, HUD, altura visual e tremor de câmera. kind: 'range' (padrão), 'select', 'toggle' ou 'color'.
import {VFX_TYPES, SHAKE_PROFILES} from '../view/vfx.js';
import {C} from '../sim/config.js';

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
  lockFacing: ['Orientação do corpo com lock-on', 'Para onde o corpo olha com alvo fixado. “Sempre para o alvo” vale também no sprint e nas ações, independente da animação. Híbrido: para o alvo parado/defendendo e para onde anda em movimento.', select(['Para onde anda', 'Sempre para o alvo (inclusive sprint e ações)', 'Híbrido'])],
  lockTackleHoming: ['Lock-on: tackle sempre rumo ao oponente', 'Com alvo fixado, o tackle parte e corrige a trajetória rumo ao oponente, mesmo segurando ↓ ou vindo de C → X. Vale para o controle do jogador (a IA mira por conta própria).', toggle],
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
  revision: ['Revisão da IA tática', 'Revisada: só pede ações que o motor aceitaria agora (mesma regra do jogador), estima se o X alcança antes de atacar, evita ficar exausta, usa sprint para encurtar distância e aproveita contra-ataques. Anterior: IA tática de 15/10/2026 (para comparação).', select(['Anterior (15/10/2026)', 'Revisada'])],
  moveSmoothing: ['Suavização da intenção de movimento (IA)', 'Giro máximo (rad/s) da direção que a IA envia ao controlador. Contra giros instantâneos e zigue-zague; ataques e respostas a ameaças passam direto. 0 = intenções cruas (v6).', R(0, 40, .5, n => n ? n.toFixed(1) + ' rad/s' : 'desligada')],
  minDirectionHold: ['Retenção contra zigue-zague (IA)', 'Tempo mínimo antes de a IA voltar à direção anterior logo depois de mudar.', R(0, .6, .01, sec)],
};
const TOGGLES = {
  enableEnemyAI: ['IA do oponente', 'Desligada: o vermelho fica na arena como boneco, recebendo dano, colisões e reações físicas, sem tomar decisões.', toggle],
  enableSprint: ['Permitir sprint (C mantido)', 'Liga o sprint depois da esquiva com C pressionado.', toggle],
  enemyManual: ['Controle manual do vermelho', 'Ligado: o vermelho é controlado pelo teclado (teclas configuráveis em Controles; padrão I J K L, U tackle, O esquiva, P defesa, Y alvo) ou pelo segundo gamepad. A IA dele é ignorada.', toggle],
};
// ---------- VFX ----------
const VFX_PARAMS = {
  size: ['Tamanho', R(.2, 3, .01, x)], duration: ['Duração', R(.05, 2, .01, sec)], count: ['Quantidade de partículas', R(1, 80, 1, n => String(n))], intensity: ['Intensidade', R(.1, 3, .01, x)],
  speed: ['Velocidade de expansão', R(.5, 25, .1, n => n.toFixed(1) + ' m/s')], opacity: ['Opacidade', R(0, 1, .01, pct)], color: ['Cor', color], color2: ['Cor secundária', color],
  glow: ['Brilho', R(.2, 4, .01, x)], fade: ['Dissipação', R(.3, 4, .01, num)], length: ['Comprimento', R(.1, 4, .01, m)], width: ['Largura', R(.01, .4, .005, m)],
  spread: ['Dispersão / abertura', R(0, 2, .01, m)], interval: ['Intervalo', R(.005, .4, .005, sec)], density: ['Densidade', R(.1, 4, .01, x)], frequency: ['Frequência', R(1, 80, 1, n => n + '/s')],
  expansion: ['Expansão', R(0, 3, .01, x)], scale: ['Escala', R(.2, 3, .01, x)], wave: ['Tamanho da onda', R(.2, 6, .01, m)], flash: ['Intensidade do flash', R(0, 1, .01, pct)],
  freeze: ['Congelamento visual (só poses e efeito)', R(0, .25, .005, n => (n * 1000).toFixed(0) + ' ms')], radius: ['Raio', R(.2, 4, .01, m)], particleSize: ['Tamanho das partículas', R(.02, 1, .01, m)],
  elevation: ['Elevação', R(0, 3, .01, x)], mixA: ['Combinado (D): poeira (A)', R(0, 2, .01, x)], mixB: ['Combinado (D): anel (B)', R(0, 2, .01, x)], mixC: ['Combinado (D): estilhaços (C)', R(0, 2, .01, x)], minImpact: ['Impacto mínimo para disparar', R(0, 15, .1, n => n.toFixed(1) + ' m/s')], fallSpeed: ['Velocidade de queda', R(.1, 6, .01, n => n.toFixed(2) + ' m/s')],
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
  mixA: 'Peso da poeira (componente A) na variante D. 0 = sem esse componente.', mixB: 'Peso do anel (componente B) na variante D. 0 = sem esse componente.', mixC: 'Peso dos estilhaços (componente C) na variante D. 0 = sem esse componente.',
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

const ANIM = {
  fade: ['Transição suave entre estados', 'Tempo de mistura (fade) entre estados comuns da animação. Só visual.', R(.02, .6, .01, sec)],
  actionFade: ['Transição de entrada em X, C e reações', 'Fade curto para as ações e reações prevalecerem visualmente. Só visual.', R(.02, .3, .01, sec)],
  locomotionHold: ['Estabilidade da locomoção (histerese)', 'Tempo mínimo de um estado de locomoção antes de trocar (contra oscilação). Só visual.', R(0, .4, .01, sec)],
  speed: ['Velocidade geral das animações', 'Multiplica a velocidade de todos os clipes. Com “durações das animações definem as ações”, muda também as durações (regra explícita na aba Personagens).', R(.25, 3, .05, x)],
};
const DIAG = {
  toast: ['Aviso curto na arena', 'Mostra por um instante, acima da arena, por que um comando não saiu (mesmo motivo avaliado pelo motor).', select(['Desligado', 'Só o jogador (azul)', 'Ambos'])],
  toastMs: ['Duração do aviso', 'Tempo em tela do aviso de comando negado.', R(300, 5000, 50, n => n + ' ms')],
  logExecuted: ['Registrar também comandos executados', 'O histórico passa a listar X, C, defesa e defesa perfeita executados (útil para cronometrar).', toggle],
};
const PERF = {overlay: ['Medidor compacto na arena', 'Mostra FPS, tempos de quadro, CPU por etapa, GPU (se disponível), draw calls e partículas no canto da arena.', toggle]};
const WIN = {
  mode: ['Indicadores de janelas de combate', 'Barras acima dos lutadores com o tempo restante de cada janela, lidas do estado real da simulação.', select(['Desligados', 'Só o jogador (azul)', 'Ambos'])],
  scale: ['Escala dos indicadores', 'Tamanho das barras.', R(.5, 2, .05, x)], opacity: ['Opacidade dos indicadores', 'Transparência das barras.', R(.2, 1, .05, pct)],
  invulnerable: ['Invulnerabilidade', 'Tempo restante da invulnerabilidade de X/C (incluindo a herdada no C → X).', toggle],
  cancel: ['Janela C → X', 'Durante a esquiva: quando o cancelamento abre e quanto falta para fechar.', toggle],
  chain: ['Encadear outra ação', 'Até quando a ação em curso ainda não pode ser substituída (janela genérica).', toggle],
  recovery: ['Recuperação', 'Recuperação ao aterrissar, por exaustão ou depois da ação (o equivalente a “hit stun” deste motor: voo + recuperação).', toggle],
  guardStun: ['Guard stun', 'Tempo restante do guard stun.', toggle], recoil: ['Recuo', 'Tempo restante do recuo (tackle bloqueado).', toggle],
  perfect: ['Janela da defesa perfeita', 'Tempo restante da janela perfeita aberta pelo toque em D.', toggle], perfectCooldown: ['Recarga da defesa perfeita', 'Tempo até poder abrir outra janela perfeita.', toggle],
  counter: ['Janela de contra-ataque', 'Tempo restante do bônus de contra-ataque (após esquiva ou defesa perfeita).', toggle], buffer: ['Buffer de entrada', 'Comando X/C guardado e tempo até expirar.', toggle],
  hitstop: ['Hitstop', 'Congelamento de impacto (global).', toggle],
  statuses: ['Buffs e debuffs', 'Tempo restante de cada efeito de status do lutador (verde: buff; vermelho: debuff).', toggle],
  cooldowns: ['Recargas dos movimentos', 'Tempo até cada movimento especial poder ser usado de novo.', toggle],
};
const RULES2 = {
  exhaustMode: ['Quando fica exausto', 'Abaixo do menor custo: ao sobrar menos stamina que a ação mais barata (X ou C), o lutador fica exausto até recuperar toda a stamina. Só em zero: regra da Etapa A (com máximos fracionários, ex.: 5,1, nunca acontecia).', select(['Só em zero (Etapa A)', 'Abaixo do menor custo de X/C'])],
  wallRestitution: ['Rebote na parede: horizontal', 'Fração da velocidade horizontal devolvida ao bater na parede durante o voo (0 = gruda, 1 = rebote total).', R(0, 2, .01, x)],
  wallBounceVertical: ['Rebote na parede: vertical (× velocidade vertical)', 'Multiplica a velocidade vertical no momento do choque com a parede (1 = mantém, 0 = zera, negativo inverte).', R(-1, 2, .01, x)],
  wallBounceUp: ['Rebote na parede: impulso vertical', 'Velocidade para cima somada ao bater na parede durante o voo.', R(0, 20, .1, n => n.toFixed(1) + ' m/s')],
};
const TACKLE2 = {
  selfCancel: ['X pode cancelar o próprio X', 'Desligado: um novo X durante o tackle é ignorado (o tackle vai até o fim).', toggle],
  guardCancel: ['Defesa cancela o tackle', 'Ligado: segurar D depois de “Encadear outra ação após” interrompe o tackle. Desligado (padrão): o tackle vai até o fim.', toggle],
  perfectGuardCancel: ['Toque de defesa perfeita cancela o tackle', 'Mesmo com “Defesa cancela o tackle” desligado, um toque em D com a defesa perfeita disponível interrompe o tackle e abre a janela perfeita.', toggle],
};
const DODGE2 = {
  selfCancelFromEnd: ['C só cancela C nos últimos', 'Uma nova esquiva durante a esquiva só sai nestes últimos segundos dela.', R(0, 1.5, .01, sec)],
  vaultPhysics: ['Salto sobre o rival como pulo físico', 'Ligado: o salto é balístico (impulso vertical, gravidade e velocidade horizontal próprias) e termina ao tocar o chão. Desligado: arco fixo na duração da esquiva (Etapa A, usa “Altura do salto”).', toggle],
  vaultUp: ['Salto: impulso vertical', 'Velocidade vertical inicial do pulo sobre o rival.', R(0, 30, .1, n => n.toFixed(1) + ' m/s')],
  vaultGravity: ['Salto: gravidade', 'Gravidade aplicada ao pulo sobre o rival (maior = pulo mais curto e rápido).', R(1, 150, .5, mps2)],
  vaultHorizontal: ['Salto: velocidade horizontal', 'Velocidade horizontal constante durante o pulo, na direção da esquiva.', R(0, 30, .1, n => n.toFixed(1) + ' m/s')],
};
const CANCEL2 = {
  windowMode: ['Janela do C → X', 'Últimos segundos: X só sai no fim da esquiva (ver abaixo). Absoluta: usa “Início da janela” e “Fim da janela” (Etapa A).', select(['Início e fim absolutos (Etapa A)', 'Últimos segundos da esquiva'])],
  fromEnd: ['C → X: últimos segundos da esquiva', 'Com a janela nos últimos segundos, X pode interromper a esquiva só neste trecho final.', R(0, 1.5, .01, sec)],
  perfectAnytime: ['C → X a qualquer momento após esquiva perfeita', 'Depois de uma esquiva perfeita (com a janela de contra-ataque aberta), X pode sair em qualquer momento da esquiva.', toggle],
};
/** Metadado de um caminho do overhaul (ou null). */
export function overhaulMeta(path) {
  const parts = path.split('.'), key = parts.at(-1), root = parts[0];
  const out = (label, help, range) => range && {label, help, range: {...range}};
  if (root === 'locomotion' && LOCO[key]) return out(...LOCO[key]);
  if (root === 'actions' && (parts[1] === 'dodge' || parts[1] === 'tackle') && PHASES[key]) {const [l, h, r] = PHASES[key];return out(`${l} · ${parts[1] === 'dodge' ? 'C' : 'X'}`, h, r);}
  if (root === 'actions' && parts[1] === 'sprint' && SPRINT[key]) return out(...SPRINT[key]);
  if (root === 'rules' && RULES2[key]) return out(...RULES2[key]);
  // Teclas (jogador e vermelho): seleção pela tecla física.
  if (parts[1] === 'bindings' || parts[1] === 'bindings2') {
    const names = {forward: 'Mover para cima', back: 'Mover para baixo', left: 'Mover à esquerda', right: 'Mover à direita', tackle: 'Tackle (X)', dodge: 'Esquiva (C) — segure para sprint', defend: 'Defesa (D)', lock: 'Fixar alvo', pause: 'Pausar', restart: 'Reiniciar', debug: 'Depuração', skill1: 'Movimento especial 1', skill2: 'Movimento especial 2', skill3: 'Movimento especial 3', skill4: 'Movimento especial 4'};
    const codes = C.extras.keyCodes, who = parts[1] === 'bindings2' ? 'Vermelho · ' : '';
    return out(who + (names[key] || key), `Tecla física de “${names[key] || key}”${who ? ' do vermelho no controle manual' : ''}. Evite repetir a mesma tecla em comandos diferentes.`, select(codes.map(c => c.replace(/^Key/, '').replace(/^Digit/, '').replace('Arrow', 'Seta '))));
  }
  if (root === 'actions' && parts[1] === 'tackle' && TACKLE2[key]) {const [l, h, r] = TACKLE2[key];return out(l + ' · X', h, r);}
  if (root === 'actions' && parts[1] === 'dodge' && DODGE2[key]) {const [l, h, r] = DODGE2[key];return out(l + ' · C', h, r);}
  if (root === 'actions' && parts[1] === 'cancel' && CANCEL2[key]) return out(...CANCEL2[key]);
  if (path.startsWith('extras.ai.') && AI[key]) return out(...AI[key]);
  if (path.startsWith('extras.toggles.') && TOGGLES[key]) return out(...TOGGLES[key]);
  if (root === 'display') {const table = {shadow: SHADOW, hud: HUD, grounding: GROUND, cancelRing: RING, animation: ANIM, diagnostics: DIAG, windows: WIN, perf: PERF}[parts[1]];if (table?.[key]) return out(...table[key]);return null;}
  if (root === 'vfx') {
    const type = parts[1], def = VFX_TYPES.find(t => t[0] === type);
    if (key === 'variant' && def) return out('Variante', 'Três alternativas visuais realmente diferentes.', select(def[2]));
    const p = VFX_PARAMS[key];if (!p) return null;
    const label = type === 'shakeMaster' && key === 'enabled' ? 'Tremores de câmera (todos)' : type === 'master' && key === 'enabled' ? 'Efeitos visuais (todos)' : p[0];
    return out(label, VFX_HELP[key] || `${p[0]} do efeito. Só aparência: não altera regras, tempos da simulação ou cooldowns.`, p[1]);
  }
  return null;
}
