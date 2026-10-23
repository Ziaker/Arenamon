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
 const p={...shotDefaults(id),...waterDefaults(overrides.variant??0),...fireDefaults(overrides.variant??0),variant:0,stretch:1,opening:1.1,contactSize:1,...ELEMENTAL_PRESETS[id],...overrides};
 if(!ELEMENTAL_PRESETS[id]) throw new Error('Move visual desconhecido: '+id);
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
 return {};
}
