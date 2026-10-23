// Presets declarativos dos efeitos three.quarks do Arenamon (Fase 2 do plano de
// integração open source). Formato: dados puros (JSON-serializável) — o adaptador
// (adapter.js) converte em ParticleSystemParameters da biblioteca. Assim o teste
// em Node exercita a mesma definição que o jogo e o laboratório usam.
//
// Campos da linguagem de preset (todos opcionais salvo indicação):
//   label            nome amigável (painel)
//   continuous       true = emissão contínua em loop (efeito A); false = explosão única
//   duration         duração do sistema em s (loop = ciclo; explosão = janela total)
//   looping          repete o ciclo (só faz sentido com continuous)
//   worldSpace       true = partículas ficam no mundo ao nascer (padrão true)
//   maxParticles     teto de partículas vivas
//   scale            multiplicador global de tamanho aplicado no adapter
//   emissionOverTime partículas/seg em modo contínuo
//   burst            {count, time} explosão única em instante (só explosões)
//   shape            {type: point|sphere|cone|donut|circle, ...} forma do emissor
//   emitterOffset    {x,y,z} posição relativa ao ancorador (personagem)
//   emitterRotation  {x,y,z} rotação do emissor (rad), relativa ao ancorador
//   startLife        [min,max] vida inicial (s)
//   startSpeed       [min,max] velocidade inicial (m/s)
//   startSize        [min,max] tamanho inicial (m)
//   startColor       {a,b} faixa de cor de nascimento (hex)
//   direction        {x,y,z} eixo do cone (emitter cone)
//   angle            abertura do cone em graus
//   gravity          aceleração vertical extra (m/s², negativa = para baixo)
//   sizeOverLife     [p1,p2,p3,p4] curva de tamanho ao longo da vida (Bezier)
//   speedOverLife    [p1,p2,p3,p4] curva de velocidade ao longo da vida
//   colorOverLife    {stops:[{t, color, alpha}]} gradiente cor+alfa sobre a vida
//   opacity          alfa global multiplicador
//   orbit            {speed:[min,max]} faz a partícula orbitar o emissor (efeito A)

export const QUARKS_PRESET_ORDER = ['charge', 'impact', 'landing', 'footstool'];

export const QUARKS_PRESETS = {
  // Efeito A — Carregamento de energia: anel orbitando o lutador, intensidade
  // crescente (o adapter recebe `intensity` 0..1 da carga e escala a emissão),
  // encerramento controlado via detach() suave.
  charge: {
    label: 'A · Carregamento de energia',
    continuous: true,
    duration: 1.1,
    looping: true,
    worldSpace: false,
    maxParticles: 320,
    scale: 1,
    emissionOverTime: 90,
    shape: {type: 'donut', radius: .78, thickness: .1, arc: Math.PI * 2},
    emitterOffset: {x: 0, y: 1.15, z: 0},
    emitterRotation: {x: -Math.PI / 2, y: 0, z: 0},
    startLife: [.45, .8],
    startSpeed: [.1, .5],
    startSize: [.07, .16],
    startColor: {a: 0x6fc9ff, b: 0xeaf7ff},
    sizeOverLife: [1, .9, .35, .05],
    speedOverLife: [1, 1, .6, .3],
    colorOverLife: {stops: [{t: 0, color: 0xffffff, alpha: .95}, {t: 1, color: 0x6fc9ff, alpha: 0}]},
    orbit: {speed: [3.2, 5.2]},
  },

  // Efeito B — Impacto de ataque: explosão radial curta com faíscas energéticas e
  // dissipação progressiva; origem no ponto real do impacto (adapter recebe a pos).
  impact: {
    label: 'B · Impacto de ataque',
    continuous: false,
    duration: .6,
    looping: false,
    worldSpace: true,
    maxParticles: 240,
    scale: 1,
    burst: {count: 42, time: 0},
    shape: {type: 'sphere', radius: .16},
    emitterOffset: {x: 0, y: 1, z: 0},
    startLife: [.25, .5],
    startSpeed: [4.5, 9.5],
    startSize: [.1, .26],
    startColor: {a: 0xffb361, b: 0xfff3d6},
    gravity: -2.5,
    sizeOverLife: [1, .85, .4, .05],
    speedOverLife: [1, .75, .3, .1],
    colorOverLife: {stops: [{t: 0, color: 0xfff3d6, alpha: .95}, {t: .35, color: 0xffb361, alpha: .7}, {t: 1, color: 0xff7a3c, alpha: 0}]},
  },

  // Efeito C — Pouso: poeira/energia proporcional à intensidade física do contato
  // (adapter recebe `power` derivado de lastLanding.vertical); emissor achatado
  // (cone aberto para cima e para os lados) para ler como "onda no chão".
  landing: {
    label: 'C · Pouso (poeira)',
    continuous: false,
    duration: .7,
    looping: false,
    worldSpace: true,
    maxParticles: 200,
    scale: 1,
    burst: {count: 26, time: 0},
    shape: {type: 'cone', radius: .55, angle: 78},
    direction: {x: 0, y: 1, z: 0},
    emitterOffset: {x: 0, y: .08, z: 0},
    startLife: [.35, .7],
    startSpeed: [1.8, 4.2],
    startSize: [.14, .34],
    startColor: {a: 0xe6edf2, b: 0xb9a07a},
    gravity: -1.2,
    sizeOverLife: [1, 1, 1.15, 1.3],
    speedOverLife: [1, .6, .25, .08],
    colorOverLife: {stops: [{t: 0, color: 0xe6edf2, alpha: .8}, {t: 1, color: 0xb9a07a, alpha: 0}]},
    opacity: .9,
  },

  // Footstool: impacto separado e mais leve — nuvem curta acima do alvo, tom
  // esverdeado para distinguir do impacto normal sem confundir com bloqueio.
  footstool: {
    label: 'Footstool',
    continuous: false,
    duration: .45,
    looping: false,
    worldSpace: true,
    maxParticles: 140,
    scale: 1,
    burst: {count: 20, time: 0},
    shape: {type: 'sphere', radius: .3},
    emitterOffset: {x: 0, y: 1.6, z: 0},
    startLife: [.2, .42],
    startSpeed: [2.2, 5],
    startSize: [.09, .2],
    startColor: {a: 0x9dffd8, b: 0xffffff},
    gravity: -3,
    sizeOverLife: [1, .8, .35, .05],
    speedOverLife: [1, .7, .3, .1],
    colorOverLife: {stops: [{t: 0, color: 0xffffff, alpha: .9}, {t: 1, color: 0x9dffd8, alpha: 0}]},
  },
};

/** Reseta os presets para os padrão de fábrica (deep copy). */
export function defaultQuarksPresets() {
  return JSON.parse(JSON.stringify(QUARKS_PRESETS));
}

// Protótipos exclusivamente visuais: parâmetros compartilhados pela tela e runtime.
export const ELEMENTAL_PRESETS = {
  waterPulse: {label:'Water Pulse · Água', color:'#007ddd', accent:'#a8faff', size:1, quantity:100, speed:2.2, duration:3, brightness:1, particleSize:.12, life:.8, detail:1, trail:2.5, rings:3, rotation:2, height:1.8, spread:1.2},
  fireSpin: {label:'Fire Spin · Fogo', color:'#ff3809', accent:'#ffce32', size:1.1, quantity:210, speed:2.6, duration:4, brightness:1, particleSize:.42, life:1.4, detail:1, trail:2.5, rings:2, rotation:6, height:3.4, spread:1},
  airSlash: {label:'Air Slash · Voador', color:'#8ecddd', accent:'#ffffff', size:1.25, quantity:110, speed:3, duration:2.6, brightness:1, particleSize:.13, life:.65, detail:1, trail:2.8, rings:3, rotation:1.2, height:1.8, spread:1.5},
  seedBomb: {label:'Seed Bomb · Grama', color:'#77d535', accent:'#805326', size:.45, quantity:85, speed:2.5, duration:3, brightness:1, particleSize:.2, life:1.1, rings:3, rotation:4, height:2.8, spread:2.5},
};
export const ELEMENTAL_CONTROLS = [
 ['stretch','Alongamento pela velocidade','×',0,2.5,.1],['opening','Raio do centro aberto','m',.5,2.5,.1],['contactSize','Tamanho do contato','×',.3,2,.1],
 ['detail','Contraste das faixas / espuma','×',.1,2,.1],['trail','Comprimento do rastro de vento','m',.5,5,.1],
 ['size','Tamanho do núcleo','m',.15,2,.05],['quantity','Emissão / quantidade da explosão','partículas',10,400,5],
 ['speed','Velocidade de deslocamento / subida','m/s',.2,6,.1],['duration','Duração da emissão / trajeto','s',1,7,.1],
 ['brightness','Intensidade luminosa','×',.1,2.5,.1],['particleSize','Tamanho das partículas','m',.03,.8,.01],
 ['life','Vida das partículas','s',.2,2.5,.1],['rings','Anéis / faixas de vento','un.',0,6,1],
 ['rotation','Rotação','rad/s',0,8,.1],['height','Altura / arco','m',.5,5,.1],['spread','Dispersão de gotas / folhas','m/s',.2,5,.1],
];
export function elementalSettings(id, overrides={}, pl=1) {
 const p={...waterDefaults(overrides.variant??0),...fireDefaults(overrides.variant??0),...shotDefaults(id),variant:0,stretch:1,opening:1.1,contactSize:1,shotFollowTime:.3,opacity:1,...ELEMENTAL_PRESETS[id],...overrides};
 if(!ELEMENTAL_PRESETS[id]) throw new Error('Move visual desconhecido: '+id);
 // Os dois efeitos de disparo guardam valores independentes: mescla em profundidade
 // para que um override parcial não apague as chaves que faltam.
 if(id==='seedBomb'){p.shotRing={...shotRingDefaults(),...(overrides.shotRing??{})};p.shotCone={...shotConeDefaults(),...(overrides.shotCone??{})};}
 if(id==='waterPulse') {const level=Math.max(1,Math.min(3,pl));p.size*=1+(level-1)*.32;p.quantity*=1+(level-1)*.55;p.rings+=level-1;p.brightness*=1+(level-1)*.2;}
 return p;
}

export const ELEMENTAL_VARIANTS={
 waterPulse:['A · Hadouken — núcleo compacto','B · Lança — ponta longa','C · Hélice — jatos orbitais'],
 fireSpin:['A · Vórtice — anel de chamas','B · Espiral — braços abertos','C · Coroa — dupla borda'],
 airSlash:['A · Corte — arco único','B · Navalhas — três cortes','C · Rajada — arco e rastros longos'],
};

export const FIRE_CONTROLS=[
 ['fireArms','Braços de fogo','un.',1,16,1,'Quantidade de braços distribuídos ao redor do centro aberto.'],
 ['fireArc','Volta de cada braço','rad',.3,8,.1,'Quanto cada braço contorna o centro antes de terminar.'],
 ['fireWidth','Largura das chamas','×',.1,3,.1,'Alarga a faixa para fora, preservando a abertura central.'],
 ['fireLift','Elevação dos braços','×',0,3,.1,'Eleva as cristas das chamas acima do anel no chão.'],
 ['fireRadial','Abertura da espiral','m',0,4,.1,'Afasta progressivamente a ponta de cada braço do centro.'],
 ['fireRings','Coroas no chão','un.',0,6,1,'Quantidade de coroas concêntricas de fogo na base.'],
 ['fireSpacing','Distância entre coroas','m',.05,2,.05,'Espaçamento radial entre as coroas da base.'],
 ['fireRise','Tempo para surgir','s',.05,2,.05,'Tempo da expansão inicial do vórtice.'],
 ['fireFade','Tempo para apagar','s',.1,3,.1,'Duração da redução de emissão e das superfícies no final.'],
 ['fireEmbers','Quantidade de brasas','×',0,4,.1,'Multiplica somente a emissão de brasas, sem mudar os braços de fogo.'],
];
export const CONTROL_HELP={stretch:'Alongamento do rastro para trás conforme a velocidade; a frente permanece ancorada.',opening:'Raio livre no centro do vórtice.',contactSize:'Escala da explosão ou do corte no contato.',detail:'Contraste das faixas luminosas e da espuma.',trail:'Comprimento do rastro atrás da lâmina de vento.',size:'Tamanho base da superfície principal do efeito.',quantity:'Taxa de partículas durante o trajeto e quantidade base emitida no contato.',speed:'Velocidade do projétil ou velocidade de subida das partículas de fogo.',duration:'Tempo do trajeto ou da sustentação antes do encerramento automático.',brightness:'Multiplica a luminosidade das superfícies e partículas.',particleSize:'Tamanho de cada gota, brasa, folha ou risco de vento.',life:'Tempo que cada partícula permanece visível.',rings:'Quantidade de faixas orbitais da água.',rotation:'Velocidade das correntes, faixas e órbitas.',height:'Altura do projétil, do arco da semente ou das chamas.',spread:'Velocidade de dispersão das partículas após a emissão.'};
export function fireDefaults(variant=0){return {fireArms:variant===0?5:variant===1?3:8,fireArc:variant===1?4.4:2.4,fireWidth:1,fireLift:1,fireRadial:variant===1?.88:0,fireRings:variant===2?2:1,fireSpacing:.825,fireRise:.35,fireFade:.7,fireEmbers:1};}

export const WATER_CONTROLS = [
 ["launchCount","Argolas disparadas","un.",0,12,1,"Quantidade de argolas criadas na origem do disparo."],
 ["launchDelay","Atraso do primeiro disparo","s",0,2,0.01,"Tempo antes de surgir a primeira argola."],
 ["launchInterval","Intervalo entre disparos","s",0,1,0.01,"Intervalo entre o surgimento de cada argola."],
 ["launchDuration","Duração de cada argola","s",0.01,3,0.01,"Tempo de vida e desaparecimento de cada argola, contado do seu disparo."],
 ["launchRadius","Raio das argolas","× núcleo",0.01,3,0.01,"Raio inicial relativo ao tamanho do núcleo."],
 ["launchWidth","Espessura das argolas","× núcleo",0.01,1,0.01,"Largura da faixa de água de cada argola."],
 ["launchSpacing","Distância entre argolas","× núcleo",0,2,0.01,"Separação das argolas para trás da origem."],
 ["launchRadiusStep","Aumento de raio por argola","× núcleo",0,1,0.01,"Quanto cada argola é maior que a anterior."],
 ["launchScale","Escala inicial das argolas","×",0.01,2,0.01,"Escala da argola no instante em que surge."],
 ["launchExpansion","Expansão das argolas","×/s",0,10,0.1,"Velocidade de crescimento radial após cada disparo."],
 ["launchSpeed","Avanço das argolas","m/s",0,10,0.1,"Velocidade das argolas no sentido do projétil."],
 ["launchOpacity","Opacidade das argolas","×",0,1,0.01,"Visibilidade inicial; desaparece ao longo da duração."],
 ["waterNose","Comprimento da ponta","× núcleo",0,3,0.05,"Projeta a ponta para a frente; o smear continua para trás."],
 ["waterWarp","Ondulação da superfície","×",0,4,0.05,"Amplitude da deformação das correntes na superfície."],
 ["waterContraction","Afinamento pela velocidade","×",0,2,0.01,"Quanto o núcleo afina lateralmente durante o alongamento."],
 ["orbitRadius","Raio das faixas orbitais","× núcleo",0.005,3,0.005,"Distância das faixas em relação ao centro da água."],
 ["orbitWidth","Largura das faixas orbitais","rad",0.01,1,0.01,"Espessura angular das faixas que envolvem o núcleo."],
 ["jetCount","Jatos da opção Hélice","un.",0,12,1,"Quantidade de jatos traseiros, usada somente na opção C."],
 ["jetLength","Comprimento dos jatos","× núcleo",0,5,0.1,"Extensão dos jatos atrás da água na opção C."],
 ["jetWidth","Largura dos jatos","m",0.01,1,0.01,"Espessura dos jatos da opção C."],
 ["trailRate","Quantidade de gotas no rastro","×",0,4,0.1,"Multiplica a emissão durante o voo sem alterar a explosão."],
 ["trailRadius","Raio de emissão do rastro","× núcleo",0,3,0.05,"Área em torno do núcleo de onde saem as gotas."],
 ["trailSpeed","Velocidade das gotas do rastro","× dispersão",0,3,0.05,"Multiplica a velocidade das gotas emitidas durante o voo."],
 ["trailSize","Tamanho das gotas do rastro","×",0.05,4,0.05,"Multiplica o tamanho base das partículas somente no rastro."],
 ["trailLife","Vida das gotas do rastro","× vida",0.05,4,0.05,"Multiplica a vida base das partículas somente no rastro."],
 ["contactDuration","Duração visual do contato","s",0.01,5,0.01,"Tempo até a coroa e a onda da explosão desaparecerem."],
 ["contactExpansionTime","Tempo de abertura do contato","s",0.01,3,0.01,"Tempo para a explosão atingir sua primeira expansão."],
 ["contactExpansion","Expansão contínua do contato","×/s",0,3,0.05,"Crescimento após a abertura, multiplicado pela dispersão."],
 ["contactInitial","Escala inicial do contato","×",0.01,2,0.01,"Tamanho da explosão no primeiro instante do contato."],
 ["squashDuration","Duração da compressão","s",0.01,2,0.01,"Tempo em que o núcleo permanece visível sendo comprimido no contato."],
 ["squashAmount","Força da compressão","×",0,1,0.01,"Quanto o núcleo encurta no eixo do disparo antes de desaparecer."],
 ["burstCount","Quantidade de gotas da explosão","×",0,5,0.1,"Multiplica a quantidade base somente no contato."],
 ["burstSpeed","Velocidade da explosão","× dispersão",0,5,0.1,"Velocidade das gotas lançadas pelo contato."],
 ["burstSize","Tamanho das gotas da explosão","×",0.05,5,0.05,"Multiplica o tamanho base das partículas do contato."],
 ["burstLife","Vida das gotas da explosão","× vida",0.05,5,0.05,"Duração das gotas do contato, independente da coroa."],
 ["burstRadius","Raio de emissão da explosão","× núcleo",0,2,0.01,"Área inicial de emissão das gotas no contato."],
 ["crownHeight","Altura da coroa de contato","×",0,3,0.05,"Altura das cristas de água na explosão."],
 ["crownRadius","Raio da coroa de contato","×",0.05,3,0.05,"Raio da superfície de água que rompe no contato."],
 ["crownPeaks","Cristas da coroa","un.",1,20,1,"Quantidade de pontas principais da coroa de água."],
 ["waveRadius","Raio da onda de contato","×",0.05,3,0.05,"Tamanho da onda circular ao redor da explosão."]
];
export function waterDefaults(variant=0){return {...{"launchCount":3,"launchDelay":0,"launchInterval":0,"launchDuration":0.3,"launchRadius":0.8,"launchWidth":0.12,"launchSpacing":0.3,"launchRadiusStep":0.18,"launchScale":0.6,"launchExpansion":4,"launchSpeed":0,"launchOpacity":1,"waterNose":0.65,"waterWarp":1,"waterContraction":0.3,"orbitRadius":1.025,"orbitWidth":0.12,"jetCount":3,"jetLength":2.5,"jetWidth":0.13,"trailRate":1,"trailRadius":0.7,"trailSpeed":0.35,"trailSize":1.5,"trailLife":1,"contactDuration":1.3,"contactExpansionTime":0.2,"contactExpansion":0.3,"contactInitial":0.3,"squashDuration":0.12,"squashAmount":0.96,"burstCount":1.8,"burstSpeed":2,"burstSize":1.5,"burstLife":1,"burstRadius":0.15,"crownHeight":1,"crownRadius":1,"crownPeaks":7,"waveRadius":1},waterNose:.65+variant*.4};}

// Impacto do disparo (Water Pulse e Air Slash): clarão, impulso do núcleo, ondas de choque e jato de partículas.
export const SHOT_CONTROLS = [
 ["shotDuration","Duração do impacto do disparo","s",0,1.5,0.01,"Tempo do clarão, do impulso e das ondas de choque. Zero desliga todo o impacto do disparo."],
 ["shotFlash","Clarão no disparo","×",0,3,0.05,"Brilho extra do núcleo no instante do disparo; decai até o fim da duração. Desligado em \"Sem flash\"."],
 ["shotGlow","Halo do clarão","m",0,4,0.1,"Tamanho do halo luminoso que surge na origem do disparo. Desligado em \"Sem flash\"."],
 ["shotKick","Impulso do núcleo","×",0,4,0.05,"Alongamento do núcleo para a frente no disparo, como um coice que se recupera sozinho."],
 ["shotShockCount","Ondas de choque","un.",0,8,1,"Quantidade de anéis que se expandem perpendicularmente ao disparo."],
 ["shotShockSize","Raio máximo das ondas","m",0.2,6,0.1,"Tamanho final de cada anel de choque."],
 ["shotShockWidth","Espessura das ondas","× raio",0.02,1,0.01,"Largura da faixa de cada anel, relativa ao seu raio."],
 ["shotShockStagger","Intervalo entre ondas","s",0,0.3,0.01,"Atraso entre o surgimento de cada anel."],
 ["shotBurst","Partículas do disparo","un.",0,600,5,"Gotas (água) ou riscos de vento (ar) lançados para trás no instante do disparo."],
 ["shotBurstSpeed","Velocidade das partículas","m/s",0,20,0.5,"Velocidade inicial do jato de partículas do disparo."],
 ["shotBurstSize","Tamanho das partículas","×",0.1,5,0.1,"Multiplica o tamanho base das partículas do disparo."],
 ["shotBurstLife","Vida das partículas","× vida",0.1,4,0.1,"Multiplica a vida base das partículas do disparo."],
 ["shotAngle","Abertura do jato para trás","°",0,180,1,"Ângulo do cone do jato: 0° é uma linha reta atrás do núcleo; 180° espalha em todas as direções."]
];
Object.assign(CONTROL_HELP, Object.fromEntries(SHOT_CONTROLS.map(c => [c[0], c[6]])));
export function shotDefaults(id) {
 if (id === 'waterPulse') return {shotDuration:0.45,shotFlash:1.4,shotGlow:1.6,shotKick:1.6,shotShockCount:3,shotShockSize:2.4,shotShockWidth:0.14,shotShockStagger:0.07,shotBurst:140,shotBurstSpeed:8,shotBurstSize:1.6,shotBurstLife:1,shotAngle:50};
 if (id === 'airSlash') return {shotDuration:0.4,shotFlash:1.2,shotGlow:1.4,shotKick:1.2,shotShockCount:3,shotShockSize:2.8,shotShockWidth:0.1,shotShockStagger:0.06,shotBurst:90,shotBurstSpeed:10,shotBurstSize:2.5,shotBurstLife:1,shotAngle:35};
 if (id === 'seedBomb') return seedDefaults();
 return {};
}

// ---------------------------------------------------------------------------
// Seed Bomb — controles completos por fase (23/10/2026)
//
// Formato da tupla: [chave, rótulo, unidade, min, max, passo, explicação, fase].
// `unidade` especial: 'cor' (seletor de cor), 'efeito' (seletor de disparo),
// 'eixo' (seletor X/Y/Z/Diagonal). A fase vira um título no painel.
// Os limites da interface seguem a regra do ateliê: máximo ×5 (e mínimo ×5
// quando negativo); ângulos de direção ficam em ±180° e aberturas em 0..180°.
// ---------------------------------------------------------------------------
export const SEED_PHASES = ['Base (vale para todas as fases)','Surgimento','Disparo','Voo','Rastro de folhas','Contato / explosão'];

export const SEED_CONTROLS = [
 // Base: multiplicadores que valem para o efeito inteiro.
 ['quantity','Quantidade base de partículas','partículas',10,400,5,'Multiplica o rastro de folhas e a explosão de uma vez. Cada fase tem o seu próprio multiplicador.','Base (vale para todas as fases)'],
 ['brightness','Intensidade luminosa','×',.1,2.5,.1,'Multiplica o brilho das partículas e da semente em todas as fases.','Base (vale para todas as fases)'],
 ['particleSize','Tamanho base das partículas','m',.03,.8,.01,'Tamanho de referência; cada fase multiplica este valor.','Base (vale para todas as fases)'],
 ['life','Vida base das partículas','s',.2,2.5,.1,'Vida de referência; cada fase multiplica este valor.','Base (vale para todas as fases)'],
 ['spread','Dispersão base','m/s',.2,5,.1,'Velocidade de referência da dispersão; cada fase multiplica este valor.','Base (vale para todas as fases)'],

 // 1. Surgimento / conjuração.
 ['seedRise','Duração do surgimento','s',0,2,.01,'Tempo para a semente aparecer crescendo. 0 = aparece já no tamanho final (visual atual).','Surgimento'],
 ['seedStartScale','Escala inicial da semente','×',0,1,.01,'Tamanho da semente no primeiro instante do surgimento; cresce até 1×.','Surgimento'],
 ['spawnCount','Partículas de surgimento','partículas',0,200,1,'Quantidade de folhas que aparecem junto da semente. 0 = nenhuma (visual atual).','Surgimento'],
 ['spawnRadius','Raio das partículas de surgimento','m',0,2,.01,'Área em volta da semente de onde saem as folhas do surgimento.','Surgimento'],
 ['spawnSpeed','Velocidade das partículas de surgimento','m/s',0,10,.1,'Velocidade com que as folhas do surgimento se afastam.','Surgimento'],
 ['spawnSize','Tamanho das partículas de surgimento','×',.05,4,.05,'Multiplica o tamanho base das folhas do surgimento.','Surgimento'],
 ['spawnLife','Vida das partículas de surgimento','s',.05,3,.05,'Tempo que as folhas do surgimento permanecem visíveis.','Surgimento'],
 ['spawnColor','Cor das partículas de surgimento','cor',0,0,0,'Cor das folhas que aparecem na conjuração.','Surgimento'],

 // 2. Disparo / lançamento.
 ['__shotEffect','Efeito de disparo','efeito',0,0,0,'Escolhe o efeito que sai da semente no disparo. Nenhum desliga o disparo. Cada efeito guarda os próprios valores.','Disparo'],
 ['launchFlash','Clarão no disparo','×',0,3,.05,'Brilho extra da semente no instante do disparo; decai em "Duração do clarão". Desligado em "Sem flash".','Disparo'],
 ['launchFlashTime','Duração do clarão e do coice','s',0,2,.01,'Tempo do clarão e da recuperação do coice. 0 desliga os dois.','Disparo'],
 ['launchKick','Coice (recuo da semente)','×',0,3,.05,'Quanto a semente recua e se estica para trás no disparo antes de partir.','Disparo'],
 ['launchAngle','Ângulo de lançamento','°',-180,180,1,'Inclina o trajeto inteiro. Positivo sobe para a frente; negativo desce para a frente; 0 mantém o arco atual.','Disparo'],
 ['launchSpeed','Velocidade de lançamento','m/s',-10,10,.1,'Velocidade somada ao trajeto no disparo. Positivo vai à frente; negativo sai para trás; 0 mantém o visual atual.','Disparo'],

 // 3. Semente em voo.
 ['size','Tamanho geral da semente','m',.15,2,.05,'Raio de referência da semente; comprimento e largura são múltiplos deste valor.','Voo'],
 ['seedLength','Comprimento (eixo vertical)','× tamanho',.05,3,.01,'Estica a semente no eixo mais longo. O padrão 1,2 reproduz a semente atual.','Voo'],
 ['seedWidth','Largura (espessura)','× tamanho',.05,3,.01,'Engrossa a semente nos eixos do voo e da profundidade. O padrão 0,72 reproduz a semente atual.','Voo'],
 ['seedShape','Formato (0 = redonda, 1 = ponta)','×',0,1,.01,'0 deixa a semente esférica; 1 afina a frente em ponta. O padrão 0 mantém o visual atual.','Voo'],
 ['seamThickness','Espessura da costura','×',0,4,.05,'Engrossa o anel que desenha a costura da semente.','Voo'],
 ['seamBrightness','Brilho da costura','×',0,4,.05,'Luminosidade da costura, independente do brilho geral.','Voo'],
 ['seamColor','Cor da costura','cor',0,0,0,'Cor do anel da costura.','Voo'],
 ['spinAxis','Eixo do giro','eixo',0,0,0,'Eixo em que a semente gira durante o voo. Diagonal combina os três eixos.','Voo'],
 ['spinSpeed','Velocidade do giro','rad/s',-12,12,.01,'Quanto a semente gira por segundo. Positivo e negativo giram em sentidos opostos; 0 não gira. O padrão 0,48 reproduz o giro atual.','Voo'],
 ['arcHeight','Altura do ponto mais alto','m',0,10,.05,'Altura máxima do arco acima do ponto de partida. O padrão 2,8 mantém o arco atual.','Voo'],
 ['arcPeak','Posição do ponto mais alto','× trajeto',.05,.95,.01,'Onde o arco atinge o topo: 0,5 no meio; perto de 0 sobe cedo e cai longo; perto de 1 sobe tarde.','Voo'],
 ['speed','Velocidade ao longo do arco','m/s',.2,6,.1,'Velocidade horizontal média do voo. O padrão 2,5 mantém o trajeto atual.','Voo'],
 ['duration','Duração do voo','s',1,7,.1,'Tempo total do trajeto até o contato. O padrão 3 s mantém o visual atual.','Voo'],

 // 4. Rastro de folhas.
 ['leafRate','Quantidade de folhas','×',0,4,.05,'Multiplica a emissão de folhas durante o voo. 0 = sem rastro.','Rastro de folhas'],
 ['leafRadius','Raio de emissão','× tamanho',0,3,.05,'Área em volta da semente de onde saem as folhas do rastro.','Rastro de folhas'],
 ['leafSpeed','Velocidade das folhas','× dispersão',0,3,.05,'Multiplica a velocidade com que as folhas do rastro se afastam.','Rastro de folhas'],
 ['leafSize','Tamanho das folhas','×',.05,4,.05,'Multiplica o tamanho base das folhas do rastro.','Rastro de folhas'],
 ['leafLife','Vida das folhas','× vida',.05,4,.05,'Multiplica a vida base das folhas do rastro.','Rastro de folhas'],
 ['leafSpin','Giro das folhas','rad/s',-8,8,.1,'Faz as folhas orbitarem a semente. Positivo e negativo giram em sentidos opostos; 0 não gira.','Rastro de folhas'],
 ['leafColor','Cor das folhas do rastro','cor',0,0,0,'Cor das folhas emitidas durante o voo.','Rastro de folhas'],

 // 5. Contato / explosão.
 ['contactDuration','Duração visual do contato','s',.01,5,.01,'Tempo até o anel do chão e as folhas da explosão desaparecerem.','Contato / explosão'],
 ['contactOpening','Tempo de abertura','s',.01,3,.01,'Tempo para a explosão atingir a primeira expansão.','Contato / explosão'],
 ['contactInitial','Escala inicial','×',.01,2,.01,'Tamanho da explosão no primeiro instante do contato.','Contato / explosão'],
 ['contactExpansion','Expansão contínua','×/s',0,3,.05,'Crescimento do anel do chão depois da abertura.','Contato / explosão'],
 ['burstCount','Folhas da explosão','×',0,5,.1,'Multiplica a quantidade de folhas lançadas no contato.','Contato / explosão'],
 ['burstSpeed','Velocidade das folhas da explosão','× dispersão',0,5,.1,'Multiplica a velocidade das folhas do contato.','Contato / explosão'],
 ['burstSize','Tamanho das folhas da explosão','×',.05,5,.05,'Multiplica o tamanho das folhas do contato.','Contato / explosão'],
 ['burstLife','Vida das folhas da explosão','× vida',.05,5,.05,'Multiplica a vida das folhas do contato.','Contato / explosão'],
 ['burstRadius','Raio de emissão da explosão','× tamanho',0,2,.01,'Área inicial de onde saem as folhas do contato.','Contato / explosão'],
 ['burstColor','Cor das folhas da explosão','cor',0,0,0,'Cor das folhas lançadas no contato.','Contato / explosão'],
 ['dustCount','Poeira da explosão','×',0,3,.05,'Multiplica a quantidade de poeira levantada no contato.','Contato / explosão'],
 ['dustSpeed','Velocidade da poeira','× dispersão',0,3,.05,'Multiplica a velocidade da poeira do contato.','Contato / explosão'],
 ['dustSize','Tamanho da poeira','×',.1,6,.05,'Multiplica o tamanho dos tufos de poeira.','Contato / explosão'],
 ['dustLife','Vida da poeira','× vida',.05,4,.05,'Multiplica a vida da poeira do contato.','Contato / explosão'],
 ['dustColor','Cor da poeira','cor',0,0,0,'Cor da poeira levantada no contato.','Contato / explosão'],
 ['groundWave','Anel no chão','×',0,4,.05,'Tamanho do anel que se abre no chão no contato. 0 = desligado (padrão atual).','Contato / explosão'],
 ['groundWaveSpeed','Expansão do anel no chão','×/s',0,6,.05,'Velocidade com que o anel do chão cresce.','Contato / explosão'],
 ['groundWaveThickness','Espessura do anel no chão','× raio',.02,1,.01,'Espessura da faixa do anel no chão.','Contato / explosão'],
 ['groundWaveColor','Cor do anel no chão','cor',0,0,0,'Cor do anel que se abre no chão.','Contato / explosão'],
 ['squashDuration','Duração da compressão','s',0,1,.01,'Tempo em que a semente continua visível sendo comprimida no contato.','Contato / explosão'],
 ['squashAmount','Força da compressão','×',0,1,.01,'Quanto a semente encurta no eixo do voo antes de desaparecer.','Contato / explosão'],
];

export function seedDefaults() {
 return {
  quantity:85, brightness:1, particleSize:.2, life:1.1, spread:2.5,
  seedRise:0, seedStartScale:1, spawnCount:0, spawnRadius:.25, spawnSpeed:1.6, spawnSize:1.2, spawnLife:.7, spawnColor:'#bcf77a',
  launchFlash:0, launchFlashTime:.25, launchKick:0, launchAngle:0, launchSpeed:0,
  size:.45, seedLength:1.2, seedWidth:.72, seedShape:0, seamThickness:1, seamBrightness:1, seamColor:'#77d535', spinAxis:'Z', spinSpeed:.48, arcHeight:2.8, arcPeak:.5, speed:2.5, duration:3,
  leafRate:1, leafRadius:.3, leafSpeed:.25, leafSize:1, leafLife:1, leafSpin:0, leafColor:'#77d535',
  contactDuration:1.3, contactOpening:.2, contactInitial:.3, contactExpansion:.3,
  burstCount:1.8, burstSpeed:2, burstSize:1.5, burstLife:1, burstRadius:.15, burstColor:'#77d535',
  dustCount:.45, dustSpeed:.5, dustSize:3, dustLife:1, dustColor:'#8b9d58',
  groundWave:0, groundWaveSpeed:2.5, groundWaveThickness:.12, groundWaveColor:'#77d535',
  squashDuration:.12, squashAmount:.8,
  ...shotEffectDefaults(),
 };
}

// ---------------------------------------------------------------------------
// Efeitos de disparo SELECIONÁVEIS — módulo reutilizável (shot-effect.js).
// Neste pedido só o Seed Bomb os usa; Water Pulse e Air Slash continuam com o
// impacto próprio deles, intocado.
// ---------------------------------------------------------------------------
export const SHOT_EFFECTS = [
 ['none','Nenhum (desligado)'],
 ['ring','Argola — anel que sai da semente'],
 ['cone','Tiro em cone — jato de partículas'],
];
export const SHOT_EFFECT_IDS = SHOT_EFFECTS.map(([id]) => id);

export const SHOT_RING_CONTROLS = [
 ['ringRadius','Raio da argola','m',.05,1.2,.01,'Raio do anel no instante em que sai da semente.'],
 ['ringVertical','Deslocamento vertical','m',-1,1,.01,'Sobe ou desce a argola. Positivo sobe; negativo desce; 0 sai na altura da semente.'],
 ['ringHorizontal','Deslocamento no trajeto','m',-1,1,.01,'Adianta ou recua o ponto de nascimento da argola. Positivo à frente; negativo atrás; 0 na semente.'],
 ['ringSquash','Achatamento horizontal','×',.05,3,.05,'Comprime ou estica a argola no eixo do trajeto. Abaixo de 1 achata; acima de 1 estica.'],
 ['ringImpulse','Impulso horizontal','m/s',-6,6,.1,'Velocidade de avanço da argola. Positivo vai à frente; negativo vai para trás; 0 fica parada.'],
 ['ringThickness','Espessura','× raio',.01,.5,.01,'Espessura da faixa que desenha o anel.'],
 ['ringCount','Quantidade de argolas','un.',1,8,1,'Quantas argolas saem em sequência.'],
 ['ringInterval','Intervalo entre argolas','s',0,.5,.01,'Tempo entre o nascimento de uma argola e a seguinte.'],
 ['ringDuration','Duração','s',.05,2,.01,'Tempo de vida de cada argola, contado do próprio nascimento.'],
 ['ringExpansion','Expansão','×/s',0,6,.1,'Velocidade com que o raio da argola cresce depois de nascer.'],
 ['ringOpacity','Opacidade','×',0,1,.01,'Visibilidade inicial da argola; desaparece até o fim da duração.'],
 ['ringFadeIn','Tempo de aparecimento','s',0,1,.01,'Tempo para a argola atingir a opacidade cheia. 0 = aparece de uma vez.'],
 ['ringTilt','Inclinação','°',-180,180,1,'Inclina o plano da argola. Positivo e negativo inclinam para lados opostos; 0 fica perpendicular ao trajeto.'],
 ['ringColor','Cor da argola','cor',0,0,0,'Cor do anel. A luminosidade é ajustada em Brilho da argola.'],
 ['ringBrightness','Brilho da argola','×',.2,3,.05,'Luminosidade do anel, independente do brilho geral.'],
];

export const SHOT_CONE_CONTROLS = [
 ['coneAngleH','Direção horizontal','°',-180,180,1,'Gira o cone no plano do chão. Positivo aponta para um lado; negativo para o outro; 0 segue o trajeto.'],
 ['coneAngleV','Direção vertical','°',-180,180,1,'Inclina o cone para cima ou para baixo. Positivo sobe; negativo desce; 0 na horizontal.'],
 ['coneRadius','Raio de abertura','m',0,1.5,.01,'Área de onde as partículas nascem na boca do cone.'],
 ['coneLength','Comprimento do cone','m',0,6,.05,'Distância que o jato percorre. Vira velocidade junto com a vida das partículas.'],
 ['coneSpread','Abertura do cone','°',0,180,1,'Quanto o jato se abre. 0 = linha reta; 180 = espalha em todas as direções.'],
 ['coneCount','Quantidade de partículas','partículas',0,400,1,'Total de partículas emitidas durante a duração do disparo.'],
 ['coneSize','Tamanho das partículas','×',.05,4,.05,'Multiplica o tamanho base das partículas do cone.'],
 ['coneLife','Vida das partículas','× vida',.05,4,.05,'Multiplica a vida base das partículas do cone.'],
 ['coneImpulseH','Impulso horizontal','m/s',-12,12,.1,'Velocidade inicial no eixo do trajeto. Positivo acelera à frente; negativo puxa para trás; 0 usa só o comprimento.'],
 ['coneImpulseV','Impulso vertical','m/s',-12,12,.1,'Velocidade inicial para cima ou para baixo. Positivo sobe; negativo desce; 0 não altera a altura.'],
 ['coneDispersion','Dispersão','×',0,3,.05,'Variação de velocidade entre as partículas: 0 = todas iguais; 3 = muito irregulares.'],
 ['coneDuration','Duração da emissão','s',.05,3,.01,'Tempo durante o qual o cone continua emitindo partículas.'],
 ['coneDelay','Atraso','s',0,2,.01,'Tempo de espera antes de o cone começar a emitir.'],
 ['coneGravity','Gravidade','m/s²',-8,8,.1,'Puxa as partículas para baixo (positivo) ou para cima (negativo). 0 = sem gravidade.'],
 ['coneColor','Cor das partículas','cor',0,0,0,'Cor do jato de partículas.'],
 ['coneBrightness','Brilho das partículas','×',.2,3,.05,'Luminosidade do jato, independente do brilho geral.'],
];

export function shotRingDefaults() {
 return {ringRadius:.5,ringVertical:0,ringHorizontal:0,ringSquash:1,ringImpulse:0,ringThickness:.08,ringCount:1,ringInterval:.08,ringDuration:.4,ringExpansion:2,ringOpacity:.9,ringFadeIn:.05,ringTilt:0,ringColor:'#77d535',ringBrightness:1.4};
}
export function shotConeDefaults() {
 return {coneAngleH:0,coneAngleV:0,coneRadius:.3,coneLength:1.2,coneSpread:30,coneCount:120,coneSize:1.2,coneLife:1,coneImpulseH:4,coneImpulseV:0,coneDispersion:1,coneDuration:.35,coneDelay:0,coneGravity:0,coneColor:'#77d535',coneBrightness:1.2};
}
export function shotEffectDefaults() {
 return {shotEffect:'none',shotRing:shotRingDefaults(),shotCone:shotConeDefaults()};
}
