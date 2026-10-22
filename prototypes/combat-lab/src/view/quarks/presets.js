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
