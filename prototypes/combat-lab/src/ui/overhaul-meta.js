// Metadados dos parâmetros do overhaul: locomoção contínua, curva em fases de X/C, sprint, IA, efeitos visuais,
// sombras, HUD, altura visual e tremor de câmera. kind: 'range' (padrão), 'select', 'toggle' ou 'color'.
import {VFX_TYPES, SHAKE_PROFILES} from '../view/vfx.js';
import {C} from '../sim/config.js';
import {SOLID_FAMILIES, SOLID_KEYS} from '../view/solid-fx.js';

const sec = n => n.toFixed(2) + ' s', mps2 = n => n.toFixed(1) + ' m/s²', x = n => n.toFixed(2) + '×', pct = n => (n * 100).toFixed(0) + '%', m = n => n.toFixed(2) + ' m', num = n => n.toFixed(2);
const onOff = n => n ? 'Ligado' : 'Desligado';
const R = (min, max, step, fmt) => ({min, max, step, fmt});
const toggle = {min: 0, max: 1, step: 1, fmt: onOff, kind: 'toggle'};
const color = {min: 0, max: 0xffffff, step: 1, fmt: n => '#' + Math.round(n).toString(16).padStart(6, '0'), kind: 'color'};
const select = options => ({min: 0, max: options.length - 1, step: 1, fmt: n => options[n] ?? '?', kind: 'select', options});

const SMEAR = {
  enableSmear: ['Smear de membros no Tackle', 'Lâminas sólidas curtas entre posições dos ossos. Só aparência; não altera o GLB ou colisões.', toggle],
  smearDurationFrames: ['Persistência da lâmina', 'Quadros de referência a 60 Hz: 2 quadros = 33 ms. A duração em segundos permanece igual em outras taxas de renderização.', R(1, 4, 1, n => n + ' quadros (' + Math.round(n * 1000 / 60) + ' ms)')],
  smearMinVelocity: ['Velocidade mínima', 'Velocidade mundial da extremidade (animação + corpo) necessária para emitir uma lâmina.', R(5, 25, .5, n => n.toFixed(1) + ' m/s')],
  smearWidth: ['Largura da lâmina', 'Largura em metros, independente da escala original do GLB.', R(.05, .4, .01, m)],
  smearColorMode: ['Cor da lâmina', 'Cor média do material/textura do personagem, destaque azul/vermelho do time ou branco.', select(['Cor do personagem', 'Destaque do time', 'Branco'])],
  smearOpacity: ['Opacidade', 'Opacidade inicial; a lâmina desvanece até desaparecer.', R(.2, 1, .05, pct)],
  smearPlBoost: ['Reforço por Power Level', 'PL2: largura +25%. PL3: contorno neon na cor do time.', toggle],
};
const SQUASH = {
  enableSquashStretch: ['Deformação elástica do Tackle', 'Deforma somente o modelo 3D durante a investida, sem alterar ossos ou colisões.', toggle],
  squashIntensity: ['Compressão no arranque', 'Compressão na direção do golpe antes do alongamento.', R(0, .3, .01, pct)],
  stretchIntensity: ['Alongamento no impulso', 'Alongamento na direção do golpe. PL2 e PL3 podem ampliar esta intensidade.', R(0, .4, .01, pct)],
  squashWindow: ['Janela de compressão', 'Duração em ms. Zero remove a compressão; golpes curtos limitam a janela à metade do arranque disponível.', R(0, 150, 1, n => n + ' ms')],
  settleDuration: ['Retorno amortecido', 'Tempo em ms para retornar aproximadamente 98% à escala neutra após desaceleração, impacto ou cancelamento.', R(30, 200, 1, n => n + ' ms')],
  preserveVolume: ['Preservar volume', 'Compensa os eixos transversais com 1/raiz(Sz), mantendo Sx × Sy × Sz = 1.', toggle],
  plScaling: ['Alongamento por Power Level', 'PL2 amplia o alongamento em 25%; PL3, em 50%. A compressão não muda.', toggle],
};
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
  useCharge: ['IA usa o tackle carregado', 'Ligado: a IA carrega PL2/PL3 quando o alvo está fora do alcance normal, dentro do alcance da carga e há tempo seguro para carregar.', toggle],
  useFeint: ['IA usa a finta', 'Ligado: a IA cancela o próprio tackle no startup quando o rival abre a defesa perfeita ou esquiva, e cancela a carga se o alvo some.', toggle],
  wallEscape: ['IA foge do wall-splat', 'Ligado: lançada rumo à parede, a IA mergulha (X) para sair do voo antes de ficar presa.', toggle],
  chargeMargin: ['IA: margem de segurança da carga', 'Folga extra (s) que a IA exige, além do tempo de carga, antes de o rival poder alcançá-la. Maior = carrega menos e com mais segurança.', R(0, 1, .01, sec)],
  chargeChance: ['IA: chance de carregar', 'Probabilidade de a IA carregar quando a situação permite.', R(0, 1, .01, pct)],
  feintChance: ['IA: chance de fintar', 'Probabilidade de a IA fintar quando lê a defesa perfeita ou a esquiva do rival no startup do tackle.', R(0, 1, .01, pct)],
  sprintReserve: ['Reserva de stamina ao correr (IA)', 'Stamina que a IA exige sobrar, além do custo de C e de X, para começar um sprint. Menor = corre mais; maior = poupa stamina para atacar.', R(0, 1.5, .05, n => n.toFixed(2))],
  sprintMargin: ['Distância para correr (IA)', 'A IA só corre quando está a mais que a zona de ameaça do rival somada a esta margem (m). Negativa = corre mais cedo; maior = só corre de muito longe.', R(-3, 3, .1, m)],
  moveSmoothing: ['Suavização da intenção de movimento (IA)', 'Giro máximo (rad/s) da direção que a IA envia ao controlador. Contra giros instantâneos e zigue-zague; ataques e respostas a ameaças passam direto. 0 = intenções cruas (v6).', R(0, 40, .5, n => n ? n.toFixed(1) + ' rad/s' : 'desligada')],
  minDirectionHold: ['Retenção contra zigue-zague (IA)', 'Tempo mínimo antes de a IA voltar à direção anterior logo depois de mudar.', R(0, .6, .01, sec)],
};
const TOGGLES = {
  enableTackleFeint: ['Finta do tackle (C ou D cancelam)', 'Ligado: C ou D no startup do tackle ou durante a carga cancelam o ataque e o lutador só derrapa, voltando ao neutro rápido. Desligado: C durante a carga esquiva e D defende.', toggle],
  enableWallSplat: ['Wall-splat (preso na parede)', 'Ligado: lançado que bate na parede já caindo e rápido fica suspenso e indefeso (janela de combo). Subindo, vale o ricochete.', toggle],
  enableFlightSlam: ['Mergulho no ar para quem foi lançado (X)', 'Desligado (padrão): quem leva knockback não pode fazer nada no ar, nem cancelar com X. Ligado: X durante o voo vira meteor slam.', toggle],
  enableMeteorSlam: ['Meteor slam e ground bounce', 'Ligado: C → X no salto do vault, e o X de quem foi lançado, viram mergulho oblíquo; o acerto lança o rival para cima. Desligado: descida suave como antes.', toggle],
  enableChargeTackle: ['Tackle carregado (segurar X)', 'Ligado: o X dispara ao soltar; segurar carrega até PL3. X correndo vira PL2 imediato e C → X continua imediato. Desligado: o X dispara na hora, como antes.', toggle],
  enableClashPush: ['Clash por empurrão (em vez de lançamento)', 'Ligado: no clash entre tackles (mesmo Power Level) os dois são empurrados para trás no chão, sem voar. Desligado: lançamento aéreo (padrão).', toggle],
  enableTechRecovery: ['Recovery rápido (C no ar)', 'Ligado: apertar C pouco antes de tocar o chão, depois de ser lançado, faz uma esquiva imediata ao pousar, na direção segurada, gastando stamina.', toggle],
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
  elevation: ['Elevação', R(0, 3, .01, x)], cone: ['Abertura do cone de fagulhas (variante D)', R(0, 1.4, .01, n => (n * 57.3).toFixed(0) + '°')], debris: ['Detritos (variante D)', R(0, 3, .05, x)], dust: ['Poeira rente ao chão (variante D)', R(0, 3, .05, x)],
  crack: ['Rachadura no chão (variante D)', R(0, 2, .05, x)], byDamage: ['Escala pelo dano e lançamento reais (variante D)', R(0, 1, .01, pct)],
  mixA: ['Combinado (D): poeira (A)', R(0, 2, .01, x)], mixB: ['Combinado (D): anel (B)', R(0, 2, .01, x)], mixC: ['Combinado (D): estilhaços (C)', R(0, 2, .01, x)], minImpact: ['Impacto mínimo para disparar', R(0, 15, .1, n => n.toFixed(1) + ' m/s')], fallSpeed: ['Velocidade de queda', R(.1, 6, .01, n => n.toFixed(2) + ' m/s')],
  startHeight: ['Altura inicial', R(.3, 4, .01, m)], height: ['Altura', R(.3, 4, .01, m)], scaleWithRate: ['Intensidade acompanha a taxa de recuperação', toggle],
  rotSpeed: ['Velocidade de rotação', R(0, 10, .1, n => n.toFixed(1) + ' rad/s')], trail: ['Rastro de partículas', toggle],
  trailDensity: ['Densidade do rastro', R(1, 30, 1, n => String(n))], shatter: ['Estilhaçar no impacto', toggle],
  shatterCount: ['Fragmentos de estilhaço', R(4, 32, 1, n => String(n))], cracksEmissive: ['Brilho das veias de energia', toggle],
  shatterSpeed: ['Velocidade dos estilhaços', R(.2, 3, .05, x)], shatterLife: ['Duração dos estilhaços', R(.3, 3, .05, x)], shatterSize: ['Tamanho dos estilhaços', R(.4, 3, .05, x)],
  pulseFreq: ['Frequência de pulsação', R(.5, 8, .1, n => n.toFixed(1) + ' Hz')], ripples: ['Ondas de impacto na barreira', toggle],
  shatterFragments: ['Fragmentos ao quebrar', R(6, 48, 2, n => String(n))], edgeGlow: ['Brilho nas bordas', R(.2, 3, .1, x)],
  maxObjects: ['Limite de objetos 3D ativos', R(8, 512, 1, n => String(n))], quality: ['Qualidade dos efeitos 3D', select(['Baixa (menos objetos)', 'Média', 'Alta (mais objetos)'])],
  target: ['Mostrar em', select(['Adversário', 'Ambos', 'Jogador'])], enabled: ['Ligado', toggle], variant: ['Variante', null],
  maxParticles: ['Limite de partículas simultâneas', R(100, 4000, 50, n => String(n))], debugLog: ['Registrar motivo de cada disparo', toggle], legacy: ['Efeitos legados do v6 (partículas em caixa e tremor antigo)', toggle],
  profile: ['Perfil', select(SHAKE_PROFILES)], amplitude: ['Amplitude', R(0, .6, .005, m)], damping: ['Amortecimento', R(0, 30, .1, num)], angular: ['Deslocamento angular', R(0, 3, .01, x)], limit: ['Limite máximo', R(0, 1, .01, m)],
};
// Controles das famílias 3D: multiplicadores sobre o padrão de cada estilo (1,00× = como entregue). Só aparência.
const SOLID_PARAMS_META = {
  intensity: ['Intensidade (força geral)', 'Multiplica velocidade e quantidade de forma proporcional.', R(.1, 3, .01, x)],
  amount: ['Quantidade / taxa de emissão', 'Quantos objetos nascem por disparo ou por passada. Abaixo de 1× some parte deles; acima de 1× repete com pequena variação.', R(.1, 3, .01, x)],
  size: ['Tamanho', 'Escala dos volumes (múltiplo do tamanho de cada estilo).', R(.3, 3, .01, x)],
  duration: ['Duração (× do padrão)', 'Quanto tempo os objetos duram antes de sumir. Só aparência: não muda a duração do dash nem do sprint.', R(.3, 3, .01, x)],
  velocity: ['Velocidade dos objetos (×)', 'Velocidade com que poeira e vento são lançados.', R(.2, 3, .01, x)],
  scatter: ['Dispersão (×)', 'Abre ou fecha o leque: afasta os objetos do ponto de origem e espalha as trajetórias.', R(.2, 3, .01, x)],
  lift: ['Altura (×)', 'Altura de nascimento e impulso vertical.', R(.2, 3, .01, x)],
  turbulence: ['Turbulência e rotação (×)', 'Giro dos volumes e ruído nas trajetórias; 1,00× é o padrão, abaixo reduz o giro.', R(0, 3, .01, x)],
  opacity: ['Opacidade', 'Opacidade máxima dos volumes (no começo da vida).', R(.1, 1, .01, pct)],
  fadeStart: ['Começa a sumir em (% da vida)', 'Quando a opacidade começa a diminuir. 0% = já nasce sumindo; 100% = só some no último instante.', R(0, .98, .01, pct)],
  fadeEnd: ['Some por completo em (% da vida)', 'Quando a opacidade chega a zero. Quanto mais perto do início, mais rápido o efeito dissipa; 100% = dura até o fim.', R(.05, 1, .01, pct)],
};
const VFX_HELP = {
  freeze: 'Pausa só as poses dos personagens e aplica um filtro na tela; a simulação continua no mesmo tempo (nada muda nas regras).',
  minImpact: 'Velocidade vertical mínima no contato com o solo (evento físico real) para mostrar o efeito.',
  target: 'A exaustão é o estado real da simulação (stamina esgotada), não “stamina baixa”.',
  scaleWithRate: 'Liga: mais partículas quando a regeneração está mais rápida (curva da simulação).',
  limit: 'Deslocamento máximo somado de todos os tremores ativos.',
  cone: 'Variante D: ângulo de abertura (para cada lado) do leque de fagulhas ao redor da direção do golpe. 0° = jato reto.', debris: 'Variante D: quantidade de lascas que quicam no chão. 0 = sem detritos.', dust: 'Variante D: nuvem baixa de poeira empurrada no sentido do golpe. 0 = sem poeira.',
  crack: 'Variante D: tamanho da rachadura que fica marcada no chão em golpes fortes. 0 = desligada.', byDamage: 'Variante D: quanto a força do efeito segue o dano e o lançamento reais do golpe. 0% = sempre a mesma força; 100% = golpe fraco ou forte se vê diferente.',
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
const PASSIVE = {
  enabled: ['Habilidades passivas visuais', 'Ativa os efeitos e as barras “Ability:” no começo da luta. Só apresentação.', toggle],
  playerAbility: ['Habilidade do jogador', 'Nome exibido na barra do lutador azul; todas usam sparkles brancos de 0,5 s.', select(['Órbita', 'Prisma', 'Ressonância'])],
  enemyAbility: ['Habilidade do adversário', 'Nome exibido na barra do lutador vermelho; todas usam sparkles brancos de 0,5 s.', select(['Órbita', 'Prisma', 'Ressonância'])],
  borderMotion: ['Animação da borda metálica', 'Reflexo atravessando, pulso prateado ou luz percorrendo o contorno.', select(['Reflexo deslizante', 'Pulso prateado', 'Luz no contorno'])],
  textScale: ['Tamanho do texto “Ability”', 'Escala do nome e do prefixo nas barras laterais.', R(.8, 1.6, .05, x)],
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
  chargeTackleMaxTime: ['Tackle carregado: tempo até o PL3', 'Segundos segurando X até a carga máxima (PL3). PL2 começa em 50% desse tempo; soltar antes dispara PL1.', R(.2, 4, .05, sec)],
  chargeTackleDrain: ['Tackle carregado: dreno de stamina', 'Stamina gasta por segundo enquanto carrega (além do custo normal do tackle, pago ao começar). Para de gastar na carga máxima. Sem stamina, o tackle sai sozinho no PL alcançado.', R(0, 4, .05, n => n.toFixed(2) + '/s')],
  chargeTackleMove: ['Tackle carregado: velocidade ao andar', 'Fração da velocidade de caminhada enquanto carrega o tackle (80% = 20% mais lento). Não para o lutador.', R(0, 1, .01, pct)],
  chargeTackleTurn: ['Tackle carregado: giro durante a carga', 'Fração da velocidade de giro normal enquanto carrega (parado, sem andar). A direção das setas ou do alvo travado na soltura vale para o tackle.', R(0, 1, .01, pct)],
  chargeTackleSpeed2: ['Tackle PL2: velocidade e alcance', 'Multiplicador da velocidade e do alcance do tackle PL2 (a duração do tackle é fixa, então os dois andam juntos). 1,25 = +25%.', R(1, 3, .01, x)],
  chargeTackleSpeed3: ['Tackle PL3: velocidade e alcance', 'Multiplicador da velocidade e do alcance do tackle PL3. 1,60 = +60%.', R(1, 4, .01, x)],
  chargeTackleDamage2: ['Tackle PL2: dano', 'Multiplicador do dano (e do impulso de lançamento) do tackle PL2. 1,30 = +30%.', R(1, 4, .01, x)],
  chargeTackleDamage3: ['Tackle PL3: dano', 'Multiplicador do dano (e do impulso de lançamento) do tackle PL3. 1,70 = +70%.', R(1, 6, .01, x)],
  sprintTacklePL: ['X no sprint: PL do tackle', 'Apertar X correndo dispara na hora, sem carga, neste Power Level (1 a 3), herdando a velocidade da corrida.', R(1, 3, 1, n => 'PL' + n)],
  feintFxOn: ['Finta: efeitos amarelos de esquiva', 'Liga os efeitos normais de esquiva (poeira, vento e rastro) tingidos de amarelo quando a esquiva rápida da finta acontece. Desligado: efeitos da esquiva comum.', toggle],
  feintFxIntensity: ['Finta: intensidade dos efeitos', 'Multiplicador da intensidade/opacidade dos efeitos da finta (1,00 = igual à esquiva comum).', R(0, 3, .05, x)],
  feintFxSize: ['Finta: tamanho dos efeitos', 'Multiplicador do tamanho dos efeitos da finta (1,00 = igual à esquiva comum).', R(.2, 3, .05, x)],
  feintFxColor: ['Finta: cor dos efeitos (amarelo → laranja)', '0% = amarelo-limão; 50% = amarelo-ouro (padrão); 100% = laranja.', R(0, 1, .01, pct)],
  feintWindow: ['Finta: janela de startup', 'Segundos do início do tackle em que C (para os lados ou para trás) ainda cancela o ataque. Na carga (X segurado) a finta vale a qualquer momento.', R(0, .5, .01, sec)],
  feintMinAngle: ['Finta: ângulo mínimo da direção', 'Ângulo mínimo entre a direção apertada e a do ataque. 60° = só vale para os lados e para trás; para a frente (ou sem direção) não há finta e o C faz a esquiva normal.', R(0, 180, 1, n => n.toFixed(0) + '°')],
  feintDuration: ['Finta: duração (× da esquiva)', 'Duração da finta como fração da duração da esquiva normal. Menor = mais curta e, com a mesma distância, mais rápida (0,80 = 20% mais curta).', R(.2, 1.5, .01, pct)],
  feintDistance: ['Finta: distância (× da esquiva)', 'Distância percorrida como múltiplo da esquiva normal (1,00 = a mesma).', R(.2, 2, .01, x)],
  feintCost: ['Finta: custo de stamina', 'Stamina total da finta (o custo do tackle cancelado é devolvido). Maior que o da esquiva normal por padrão; sem stamina suficiente não há finta.', R(0, 4, .05, num)],
  wallSplatMinSpeed: ['Wall-splat: velocidade mínima', 'Velocidade horizontal mínima (m/s) para o lançado, já CAINDO, ficar preso na parede. Abaixo disso (ou subindo) vale o ricochete.', R(0, 30, .5, n => n.toFixed(1) + ' m/s')],
  wallSplatDuration: ['Wall-splat: duração', 'Quanto tempo o lutador fica suspenso e indefeso na parede, na altura do impacto (janela de combo), antes de cair.', R(.1, 2, .01, sec)],
  wallSplatDamage: ['Wall-splat: dano extra', 'HP perdido ao ficar preso na parede. 0 = nenhum (o ganho é a janela de combo).', R(0, 30, .5, n => n.toFixed(1) + ' HP')],
  slamAngle: ['Meteor slam: ângulo do mergulho', 'Ângulo de descida em relação ao chão: 45° desce 1 m por metro andado. Maior = mais vertical e mais curto.', R(Math.PI / 18, Math.PI * 80 / 180, Math.PI / 180, n => (n * 180 / Math.PI).toFixed(0) + '°')],
  slamMinHeight: ['Meteor slam: altura mínima do C → X', 'Altura mínima (m) do salto do vault para o X virar mergulho. Abaixo disso o X desce suave como antes.', R(0, 2, .05, m)],
  slamSpeedLoss: ['Meteor slam: velocidade perdida na preparação', 'Quanto da velocidade que o personagem trazia do dash ele perde durante a preparação no ar. 0% = continua deslizando com a velocidade inteira; 100% = para na hora. Ao terminar a preparação a velocidade herdada zera por completo e ele despenca sobre o inimigo.', R(0, 1, .01, pct)],
  tackleFriction1: ['Tackle PL1: atrito durante o movimento', 'Atrito (1/s) aplicado durante o movimento do Tackle PL1: a velocidade decai com o tempo do ataque e o alcance diminui. 0 = sem atrito (como antes); valores altos fazem o Tackle frear logo.', R(0, 12, .1, n => n.toFixed(1) + ' /s')],
  tackleFriction2: ['Tackle PL2: atrito durante o movimento', 'Atrito (1/s) aplicado durante o movimento do Tackle PL2 (carga média ou X no sprint). 0 = sem atrito; maior = freia mais cedo e alcança menos.', R(0, 12, .1, n => n.toFixed(1) + ' /s')],
  tackleFriction3: ['Tackle PL3: atrito durante o movimento', 'Atrito (1/s) aplicado durante o movimento do Tackle PL3 (carga máxima). 0 = sem atrito; maior = freia mais cedo e alcança menos.', R(0, 12, .1, n => n.toFixed(1) + ' /s')],
  slamRingOn: ['Meteor slam: anel de fogo no chão', 'Liga o anel de fogo que se expande em círculo a partir do ponto onde o mergulho aterrissa (estado meteorGround), acertando ou não.', toggle],
  slamRingStart: ['Meteor slam: raio inicial do anel', 'Raio (m) do anel no instante do impacto.', R(.1, 3, .05, m)],
  slamRingRadius: ['Meteor slam: raio final do anel', 'Raio (m) que o anel alcança ao fim da expansão.', R(.5, 12, .1, m)],
  slamRingDuration: ['Meteor slam: duração do anel', 'Tempo (s) que o anel leva para se expandir até o raio final e sumir.', R(.1, 2.5, .01, sec)],
  slamRingThickness: ['Meteor slam: espessura do anel', 'Largura da faixa de fogo como fração do raio (1,00 = disco cheio; 0,10 = fio fino).', R(.05, 1, .01, pct)],
  slamRingIntensity: ['Meteor slam: brilho do anel', 'Brilho do anel (1,00 = padrão; acima de 1 estoura o brilho).', R(0, 3, .05, x)],
  slamRingOpacity: ['Meteor slam: opacidade inicial do anel', 'Opacidade do anel no instante do impacto.', R(0, 1, .01, pct)],
  slamRingFade: ['Meteor slam: queda da opacidade com a duração', 'Quanto da opacidade se perde até o fim da duração. 0% = não some; 100% = termina totalmente transparente.', R(0, 1, .01, pct)],
  slamFxOn: ['Meteor slam: efeito de fogo na queda', 'Liga o rastro de fogo que aparece só durante o mergulho (queda), apontando para baixo.', toggle],
  slamFxSize: ['Meteor slam: largura do fogo', 'Largura do fogo em relação ao personagem. 1,00 = tão largo quanto o próprio personagem.', R(.2, 4, .05, x)],
  slamFxLength: ['Meteor slam: tamanho (altura) do fogo', 'Altura do fogo em relação ao personagem. 1,00 = tão alto quanto o próprio personagem; aumente para um rastro mais longo.', R(.2, 5, .05, x)],
  slamFxIntensity: ['Meteor slam: brilho do fogo', 'Opacidade e brilho do efeito (1,00 = padrão; acima de 1 estoura o brilho).', R(0, 3, .05, x)],
  slamFxHeat: ['Meteor slam: cor (vermelho → branco)', '0 = brasa vermelha/laranja; 1 = branco-amarelo quente.', R(0, 1, .01, pct)],
  slamFxSparks: ['Meteor slam: quantidade de faíscas', 'Multiplicador das faíscas que soltam do rastro (0 = sem faíscas).', R(0, 4, .05, x)],
  slamFxFlicker: ['Meteor slam: tremulação das chamas', 'Quanto as chamas tremem e variam de comprimento (0 = estático).', R(0, 1, .01, pct)],
  slamFxFadeOut: ['Meteor slam: dissipação ao aterrissar', 'Tempo (s) que o fogo leva para sumir depois que o mergulho toca o chão.', R(0, 1.5, .01, sec)],
  slamGroundTime: ['Meteor slam: estado no chão', 'Tempo (s) que o personagem fica no estado do meteor slam no chão (pose de impacto) depois de aterrissar. Se o mergulho errou, soma a recuperação ao errar.', R(0, 2, .01, sec)],
  slamGroundRadius: ['Meteor slam: alcance do impacto no chão', 'Distância (m) ao redor de onde o personagem aterrissa em que o inimigo é acertado pelo impacto (dano e lançamento).', R(.5, 4, .05, m)],
  slamPrepTime: ['Meteor slam: preparação no ar', 'Tempo (s) que o personagem é jogado para cima, parado no ar, antes de despencar. 0 = mergulha na hora.', R(0, 1.5, .01, sec)],
  slamHop: ['Meteor slam: altura da preparação', 'Quantos metros o personagem sobe durante a preparação, além da altura em que estava.', R(0, 3, .05, m)],
  slamFallTime: ['Meteor slam: tempo de queda', 'Tempo (s) para despencar da altura do salto até o chão ao começar o mergulho. Menor = cai mais rápido. 0 = cai instantaneamente.', R(0, .6, .01, sec)],
  slamImpactScale: ['Meteor slam: tamanho do efeito de impacto no chão', 'Multiplicador do efeito visual de aterrissagem (poeira, anéis) criado onde o mergulho aterrissa. 1,00 = igual ao pouso normal; 1,20 = 20% maior.', R(.5, 3, .05, x)],
  slamImpactShake: ['Meteor slam: tremor da câmera no impacto', 'Multiplicador do tremor de câmera do impacto do mergulho no chão (1,00 = tremor de um pouso normal).', R(0, 3, .05, x)],
  slamDamage: ['Meteor slam: dano', 'Multiplicador do dano do mergulho sobre o dano base do Tackle, sem Power Level. 1,00 = igual ao Tackle normal.', R(1, 4, .01, x)],
  slamRecovery: ['Meteor slam: recuperação ao errar', 'Tempo vulnerável ao aterrissar quando o mergulho não acerta ninguém.', R(0, 2, .01, sec)],
  slamLaunchHorizontal: ['Ground bounce: empurrão horizontal', 'Fração do empurrão horizontal normal que o mergulho aplica (o rival sobe mais do que anda).', R(0, 1, .01, pct)],
  groundBounceForce: ['Ground bounce: força do quique', 'Velocidade vertical (m/s) com que o rival acertado pelo mergulho quica para cima. Maior = quique mais alto.', R(0, 30, .5, n => n.toFixed(1) + ' m/s')],
  slamBlockPushDistance: ['Meteor slam bloqueado: distância do empurrão', 'Quanto o defensor que bloqueou o mergulho (bloqueio parcial) é arrastado para trás deslizando no chão, em metros. Sem lançamento; a defesa perfeita não é empurrada (fica com a vantagem do contra-ataque).', R(3, 10, .1, m)],
  clashPushDistance: ['Clash por empurrão: distância', 'Quanto cada lutador desliza para trás (m) quando “Clash por empurrão” está ligado. O choque, o dano e o hitstop são os mesmos do clash normal.', R(0, 8, .1, m)],
  clashPushDuration: ['Clash por empurrão: duração', 'Tempo do deslize (s) do empurrão do clash.', R(.1, 1.2, .01, sec)],
  techWindow: ['Recovery rápido: janela', 'Quantos segundos antes de tocar o chão o C é aceito para armar o recovery (voando). Maior = mais fácil; menor = exige timing.', R(.05, 1.5, .01, sec)],
  techMinAir: ['Recovery rápido: tempo mínimo de voo', 'Só aceita o C depois de tantos segundos de voo (0 = desde o lançamento, respeitando a janela antes do chão). Evita escapar logo ao ser atingido.', R(0, 1.5, .01, sec)],
  techCost: ['Recovery rápido: custo de stamina', 'Stamina gasta ao fazer o recovery (substitui o custo da esquiva). 0 = grátis. Sem stamina suficiente, o lutador cai normalmente.', R(0, 2, .05, n => n.toFixed(2))],
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
  if (path.startsWith('extras.visual.smear.')) {const m = SMEAR[path.split('.').pop()];return m ? {label: m[0], help: m[1], range: {...m[2]}} : null;}
  if (path.startsWith('extras.visual.squashStretch.')) {const m = SQUASH[path.split('.').pop()];return m ? {label: m[0], help: m[1], range: {...m[2]}} : null;}
  const parts = path.split('.'), key = parts.at(-1), root = parts[0];
  const out = (label, help, range) => range && {label, help, range: {...range}};
  if (root === 'locomotion' && LOCO[key]) return out(...LOCO[key]);
  if (root === 'display' && parts[1] === 'passive' && PASSIVE[key]) return out(...PASSIVE[key]);
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
    if (SOLID_KEYS.includes(type) && SOLID_PARAMS_META[key]) { const [l, h, r] = SOLID_PARAMS_META[key];return out(l, h, r); }
    if (SOLID_KEYS.includes(type) && (key === 'color' || key === 'color2')) return out(key === 'color' ? 'Cor' : 'Cor secundária (energia)', 'Cor base dos volumes deste efeito.', color);
    if (SOLID_KEYS.includes(type) && key === 'enabled') return out('Ligado', 'Liga ou desliga este efeito 3D.', toggle);
    const solid = SOLID_FAMILIES.find(f => f.key === type);
    if (key === 'variant' && solid) return out('Estilo 3D', `Formas com volume real (sem sprites). Disparo: ${solid.trigger}. Cada opção tem forma e movimento próprios, não só cor ou tamanho.`, select(solid.names));
    if (type === 'solid' && key === 'enabled') return out('Efeitos 3D sólidos (todos)', 'Liga ou desliga todas as malhas 3D de poeira, esquiva, aterrissagem, impacto, bloqueio e colisão.', toggle);
    const p = VFX_PARAMS[key];if (!p) return null;
    const label = type === 'shakeMaster' && key === 'enabled' ? 'Tremores de câmera (todos)' : type === 'master' && key === 'enabled' ? 'Efeitos visuais (todos)' : p[0];
    return out(label, VFX_HELP[key] || `${p[0]} do efeito. Só aparência: não altera regras, tempos da simulação ou cooldowns.`, p[1]);
  }
  return null;
}
