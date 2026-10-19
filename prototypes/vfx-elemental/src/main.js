import * as THREE from 'three';

// ============================================================================
// 1. METADADOS POR ABA ELEMENTAL (PSÍQUICO, VOADOR E FOGO) E SLIDERS
// ============================================================================

const ELEMENT_DEFS = {
  psychic: {
    key: 'psychic',
    label: 'Psíquico (PSI)',
    submodeLabel: 'Objeto Invocado:',
    submodes: [
      { value: 'boulder', label: 'Rocha Telecinética Fraturada' },
      { value: 'monolith', label: 'Monólito / Obelisco Arcano' },
      { value: 'polyhedron', label: 'Cristal Merkaba Poliedral' },
      { value: 'biocore', label: 'Núcleo Mitocondrial Orgânico' },
    ],
    categories: [
      { key: 'summon', label: '🪨 1. Invocação de Objetos (Telecinese)' },
      { key: 'hit', label: '💥 2. Hit Effects (Impacto Psíquico)' },
      { key: 'aura', label: '✨ 3. Aura Psíquica (Campo Contínuo)' },
      { key: 'sequence', label: '🎬 4. Sequência Completa (Aura + Invocação + Hit)' },
    ],
    options: [
      {
        id: 'psychicA',
        code: 'A',
        name: 'Opção A · PSI Kaleidoscope & Starstorm',
        inspiration: 'EarthBound / Mother 3',
        sub: 'Ref: EarthBound / Mother 3 · Ondas PSI hipnóticas, octaedros cromáticos e anéis concêntricos',
      },
      {
        id: 'psychicB',
        code: 'B',
        name: 'Opção B · Cognitive Rebel & Velvet Arcana',
        inspiration: 'Persona 4 & Persona 5',
        sub: 'Ref: Persona 4 & 5 · Estrelas gráficas, silhueta alto contraste, fendas e vidro cognitivo',
      },
      {
        id: 'psychicC',
        code: 'C',
        name: 'Opção C · Mitochondrial Bio-Kinesis',
        inspiration: 'Parasite Eve',
        sub: 'Ref: Parasite Eve · Hélices de DNA/ATP, membrana celular refrativa, sinapses e domo tático',
      },
    ],
  },
  flying: {
    key: 'flying',
    label: 'Voador (Vento, Poeira, Tornados, Vendavais & Tufões)',
    submodeLabel: 'Camadas 3D:',
    submodes: [
      { value: 'all', label: 'Vento + Poeira + Detritos 3D (Completo)' },
      { value: 'wind-only', label: 'Somente Vento, Fitas & Lâminas de Ar' },
      { value: 'dust-only', label: 'Somente Poeira Volumétrica & Redemoinhos de Solo' },
      { value: 'heavy-debris', label: 'Tempestade Pesada (Extra Rochas & Detritos)' },
    ],
    categories: [
      { key: 'tornado', label: '🌪️ 1. Tornados (Funil 3D + Poeira de Base)' },
      { key: 'gale', label: '💨 2. Vendavais & Lâminas (Rajadas + Poeira)' },
      { key: 'typhoon', label: '🌀 3. Tufões (Super-Ciclone + Tempestade)' },
      { key: 'winddust', label: '🌫️ 4. Vento & Poeira (Aura / Solo Contínuo)' },
      { key: 'sequence', label: '🎬 5. Sequência Voador (Vendaval → Tornado → Tufão)' },
    ],
    options: [
      {
        id: 'flyingA',
        code: 'A',
        name: 'Opção A · Cel-Shaded Gale & Cloud Scrolls',
        inspiration: 'Wind Waker / Okami / Ghibli',
        sub: 'Ref: Wind Waker & Okami · Fitas caligráficas em S, espirais cel-shaded e nuvens rolantes de poeira clara',
      },
      {
        id: 'flyingB',
        code: 'B',
        name: 'Opção B · Graphic Sonic Shear & Garudyne',
        inspiration: 'Persona 5 (Garudyne) / Guilty Gear',
        sub: 'Ref: Persona 5 & Guilty Gear · Lâminas de vento com silhueta preta + neon, cones sônicos e poeira facetada',
      },
      {
        id: 'flyingC',
        code: 'C',
        name: 'Opção C · Atmospheric Cyclone & Dust Storm',
        inspiration: 'Monster Hunter (Kushala) / Storm King',
        sub: 'Ref: Kushala Daora & Storm King · Funil atmosférico turbulento, parede de areia/poeira densa e detritos',
      },
    ],
  },
  fire: {
    key: 'fire',
    label: 'Fogo (Mitológico Japonês, Tinta Sumi-e & Fogo Mágico)',
    submodeLabel: 'Camadas Ígneas:',
    submodes: [
      { value: 'all', label: 'Chamas + Fumaça/Tinta + Brasas 3D (Completo)' },
      { value: 'flame-only', label: 'Somente Línguas de Fogo & Núcleo Ígneo' },
      { value: 'embers-only', label: 'Somente Brasas, Fagulhas, Selos & Respingos' },
      { value: 'inferno-heavy', label: 'Inferno Máximo (Alta Densidade de Chamas & Brasas)' },
    ],
    categories: [
      { key: 'fireball', label: '🔥 1. Rajada & Bola de Fogo (Projétil + Rastro)' },
      { key: 'pillar', label: '🌋 2. Pilar de Fogo & Erupção (Coluna Ígnea 3D)' },
      { key: 'explosion', label: '💥 3. Explosão & Hit de Fogo (Detonação no Alvo)' },
      { key: 'emberaura', label: '✨ 4. Aura Flamejante & Brasas (Manto Contínuo)' },
      { key: 'sequence', label: '🎬 5. Sequência Fogo (Aura → Disparo → Pilar & Explosão)' },
    ],
    options: [
      {
        id: 'fireA',
        code: 'A',
        name: 'Opção A · Fogo Mitológico Japonês (Hinokami / Ukiyo-e)',
        inspiration: 'Okami (Amaterasu) / Hinokami Kagura / Kaen-daiko',
        sub: 'Ref: Mitologia Japonesa (Okami / Ukiyo-e) · Espirais sagradas vermelhão e ouro, rodas solares e pétalas de brasa',
      },
      {
        id: 'fireB',
        code: 'B',
        name: 'Opção B · Fogo Estilizado em Tinta (Sumi-e Ink Flame)',
        inspiration: 'Street Fighter IV & 6 / Caligrafia Sumi-e em Brasa',
        sub: 'Ref: Pintura em Tinta Sumi-e (SF4 / SF6) · Pinceladas secas de nanquim negro + brasa viva, cortes e respingos 3D',
      },
      {
        id: 'fireC',
        code: 'C',
        name: 'Opção C · Fogo Mágico & Arcano (Astral Pyromancy)',
        inspiration: 'Elden Ring / Dragon’s Dogma 2 / Final Fantasy XVI',
        sub: 'Ref: Fogo Mágico Arcano · Chamas astrais prismáticas (rubi/violeta/ouro), círculos rúnicos e cristais de éter',
      },
    ],
  },
};

const SLIDER_SPECS = [
  // Grupo 1: Opacidade Total & Redução durante a Duração
  { key: 'opacity', label: 'Opacidade Total', min: 0.0, max: 1.0, step: 0.01, unit: '', group: 'opacity' },
  { key: 'fadeStart', label: 'Início da Queda (Duração)', min: 0.0, max: 0.95, step: 0.01, unit: '%', scale: 100, group: 'opacity' },
  { key: 'fadeEnd', label: 'Fim da Queda (Duração)', min: 0.05, max: 1.0, step: 0.01, unit: '%', scale: 100, group: 'opacity' },
  { key: 'fadePower', label: 'Curva da Redução', min: 0.25, max: 3.5, step: 0.05, unit: '×', group: 'opacity' },
  { key: 'endOpacity', label: 'Opacidade Residual Final', min: 0.0, max: 0.8, step: 0.01, unit: '', group: 'opacity' },

  // Grupo 2: Dinâmica, Escala & Tempo
  { key: 'intensity', label: 'Intensidade Geral', min: 0.2, max: 2.5, step: 0.05, unit: '×', group: 'dynamics' },
  { key: 'size', label: 'Tamanho / Escala 3D', min: 0.3, max: 2.5, step: 0.05, unit: '×', group: 'dynamics' },
  { key: 'duration', label: 'Duração do Ciclo', min: 0.35, max: 4.5, step: 0.05, unit: 's', group: 'dynamics' },
  { key: 'velocity', label: 'Velocidade de Animação', min: 0.2, max: 2.5, step: 0.05, unit: '×', group: 'dynamics' },
  { key: 'amount', label: 'Quantidade de Elementos', min: 0.25, max: 2.5, step: 0.05, unit: '×', group: 'dynamics' },

  // Grupo 3: Espaço, Distorção & Pulso
  { key: 'scatter', label: 'Dispersão / Abertura 3D', min: 0.25, max: 2.5, step: 0.05, unit: '×', group: 'space' },
  { key: 'lift', label: 'Elevação / Altura', min: 0.25, max: 2.5, step: 0.05, unit: '×', group: 'space' },
  { key: 'turbulence', label: 'Turbulência / Sinuosidade', min: 0.0, max: 2.5, step: 0.05, unit: '×', group: 'space' },
  { key: 'pulseFreq', label: 'Frequência de Ondas', min: 0.5, max: 12.0, step: 0.25, unit: 'Hz', group: 'space' },
  { key: 'glow', label: 'Brilho / Emissão 3D', min: 0.0, max: 2.5, step: 0.05, unit: '×', group: 'space' },
];

function createDefaultState() {
  const psychicPalettes = [
    { color: '#ff2e7e', color2: '#00f0ff', color3: '#ffe600' },
    { color: '#b829ff', color2: '#ff0055', color3: '#ffd500' },
    { color: '#00e676', color2: '#ff6d00', color3: '#00e5ff' },
  ];

  const flyingPalettes = [
    { color: '#7dd3fc', color2: '#e7e5e4', color3: '#38bdf8' },
    { color: '#10b981', color2: '#cbd5e1', color3: '#bef264' },
    { color: '#38bdf8', color2: '#d97706', color3: '#e2e8f0' },
  ];

  // Paletas do Tipo Fogo:
  // color = Chama Principal, color2 = Sombra/Tinta/Secundária, color3 = Núcleo Incandescente/Brasas
  const firePalettes = [
    // Opção A: Mitológico Japonês (Vermelhão Xintoísta, Ouro Imperial, Pérola Solar)
    { color: '#ff2a1f', color2: '#ff9500', color3: '#ffe66d' },
    // Opção B: Fogo em Tinta Sumi-e (Laranja Cinábrio Vivo, Carvão/Carmesim Escuro, Amarelo Brasa)
    { color: '#ff5500', color2: '#27171c', color3: '#ffbe0b' },
    // Opção C: Fogo Mágico Arcano (Rubi-Magenta Astral, Violeta Arcano Profundo, Ouro-Ciano Místico)
    { color: '#ff1e8e', color2: '#7c3aed', color3: '#fde047' },
  ];

  const psychicDefaults = {
    summon: [
      { opacity: 0.95, fadeStart: 0.68, fadeEnd: 0.98, fadePower: 1.35, endOpacity: 0.0, intensity: 1.2, size: 1.05, duration: 2.1, velocity: 1.1, amount: 1.15, scatter: 1.0, lift: 1.15, turbulence: 1.0, pulseFreq: 4.5, glow: 1.35 },
      { opacity: 0.96, fadeStart: 0.65, fadeEnd: 0.96, fadePower: 1.6, endOpacity: 0.0, intensity: 1.3, size: 1.1, duration: 1.9, velocity: 1.25, amount: 1.2, scatter: 1.1, lift: 1.1, turbulence: 1.15, pulseFreq: 6.0, glow: 1.4 },
      { opacity: 0.92, fadeStart: 0.62, fadeEnd: 0.98, fadePower: 1.15, endOpacity: 0.02, intensity: 1.15, size: 1.05, duration: 2.2, velocity: 1.0, amount: 1.25, scatter: 1.05, lift: 1.05, turbulence: 1.2, pulseFreq: 3.5, glow: 1.3 },
    ],
    hit: [
      { opacity: 0.98, fadeStart: 0.35, fadeEnd: 0.92, fadePower: 1.1, endOpacity: 0.0, intensity: 1.35, size: 1.15, duration: 1.25, velocity: 1.3, amount: 1.25, scatter: 1.2, lift: 1.0, turbulence: 1.1, pulseFreq: 6.5, glow: 1.5 },
      { opacity: 1.0, fadeStart: 0.42, fadeEnd: 0.94, fadePower: 1.75, endOpacity: 0.0, intensity: 1.45, size: 1.2, duration: 1.15, velocity: 1.4, amount: 1.3, scatter: 1.25, lift: 1.05, turbulence: 1.25, pulseFreq: 7.5, glow: 1.6 },
      { opacity: 0.94, fadeStart: 0.38, fadeEnd: 0.95, fadePower: 0.95, endOpacity: 0.0, intensity: 1.3, size: 1.15, duration: 1.35, velocity: 1.15, amount: 1.2, scatter: 1.15, lift: 1.0, turbulence: 1.35, pulseFreq: 5.0, glow: 1.45 },
    ],
    aura: [
      { opacity: 0.88, fadeStart: 0.55, fadeEnd: 0.98, fadePower: 1.0, endOpacity: 0.18, intensity: 1.15, size: 1.05, duration: 2.0, velocity: 1.05, amount: 1.15, scatter: 1.0, lift: 1.1, turbulence: 0.95, pulseFreq: 4.0, glow: 1.25 },
      { opacity: 0.92, fadeStart: 0.58, fadeEnd: 0.96, fadePower: 1.25, endOpacity: 0.15, intensity: 1.25, size: 1.08, duration: 1.8, velocity: 1.2, amount: 1.2, scatter: 1.05, lift: 1.15, turbulence: 1.1, pulseFreq: 5.5, glow: 1.35 },
      { opacity: 0.86, fadeStart: 0.50, fadeEnd: 0.98, fadePower: 0.9, endOpacity: 0.22, intensity: 1.15, size: 1.05, duration: 2.2, velocity: 1.0, amount: 1.25, scatter: 1.0, lift: 1.1, turbulence: 1.15, pulseFreq: 3.2, glow: 1.3 },
    ],
  };

  const flyingDefaults = {
    tornado: [
      { opacity: 0.94, fadeStart: 0.66, fadeEnd: 0.98, fadePower: 1.25, endOpacity: 0.0, intensity: 1.25, size: 1.1, duration: 2.4, velocity: 1.25, amount: 1.25, scatter: 1.05, lift: 1.2, turbulence: 1.1, pulseFreq: 5.0, glow: 1.25 },
      { opacity: 0.96, fadeStart: 0.68, fadeEnd: 0.97, fadePower: 1.55, endOpacity: 0.0, intensity: 1.35, size: 1.12, duration: 2.1, velocity: 1.4, amount: 1.3, scatter: 1.1, lift: 1.25, turbulence: 1.2, pulseFreq: 6.5, glow: 1.4 },
      { opacity: 0.92, fadeStart: 0.62, fadeEnd: 0.98, fadePower: 1.1, endOpacity: 0.0, intensity: 1.3, size: 1.15, duration: 2.6, velocity: 1.15, amount: 1.35, scatter: 1.15, lift: 1.25, turbulence: 1.35, pulseFreq: 4.5, glow: 1.2 },
    ],
    gale: [
      { opacity: 0.95, fadeStart: 0.52, fadeEnd: 0.95, fadePower: 1.2, endOpacity: 0.0, intensity: 1.3, size: 1.1, duration: 1.5, velocity: 1.35, amount: 1.25, scatter: 1.1, lift: 1.0, turbulence: 1.0, pulseFreq: 5.5, glow: 1.3 },
      { opacity: 0.98, fadeStart: 0.55, fadeEnd: 0.94, fadePower: 1.65, endOpacity: 0.0, intensity: 1.4, size: 1.15, duration: 1.35, velocity: 1.5, amount: 1.3, scatter: 1.15, lift: 1.05, turbulence: 1.15, pulseFreq: 7.0, glow: 1.45 },
      { opacity: 0.92, fadeStart: 0.48, fadeEnd: 0.96, fadePower: 1.05, endOpacity: 0.0, intensity: 1.25, size: 1.12, duration: 1.65, velocity: 1.25, amount: 1.35, scatter: 1.2, lift: 1.0, turbulence: 1.3, pulseFreq: 4.8, glow: 1.2 },
    ],
    typhoon: [
      { opacity: 0.96, fadeStart: 0.60, fadeEnd: 0.98, fadePower: 1.3, endOpacity: 0.0, intensity: 1.4, size: 1.2, duration: 2.8, velocity: 1.3, amount: 1.4, scatter: 1.25, lift: 1.3, turbulence: 1.2, pulseFreq: 5.5, glow: 1.35 },
      { opacity: 0.98, fadeStart: 0.64, fadeEnd: 0.97, fadePower: 1.6, endOpacity: 0.0, intensity: 1.5, size: 1.22, duration: 2.5, velocity: 1.45, amount: 1.4, scatter: 1.3, lift: 1.3, turbulence: 1.3, pulseFreq: 7.0, glow: 1.5 },
      { opacity: 0.94, fadeStart: 0.58, fadeEnd: 0.98, fadePower: 1.15, endOpacity: 0.0, intensity: 1.45, size: 1.25, duration: 3.0, velocity: 1.2, amount: 1.5, scatter: 1.35, lift: 1.35, turbulence: 1.45, pulseFreq: 4.5, glow: 1.25 },
    ],
    winddust: [
      { opacity: 0.88, fadeStart: 0.58, fadeEnd: 0.98, fadePower: 1.0, endOpacity: 0.2, intensity: 1.15, size: 1.05, duration: 2.0, velocity: 1.15, amount: 1.2, scatter: 1.05, lift: 1.05, turbulence: 0.95, pulseFreq: 4.2, glow: 1.2 },
      { opacity: 0.92, fadeStart: 0.60, fadeEnd: 0.96, fadePower: 1.3, endOpacity: 0.16, intensity: 1.25, size: 1.08, duration: 1.85, velocity: 1.3, amount: 1.25, scatter: 1.1, lift: 1.1, turbulence: 1.1, pulseFreq: 5.8, glow: 1.35 },
      { opacity: 0.86, fadeStart: 0.54, fadeEnd: 0.98, fadePower: 0.95, endOpacity: 0.24, intensity: 1.2, size: 1.08, duration: 2.2, velocity: 1.1, amount: 1.3, scatter: 1.1, lift: 1.05, turbulence: 1.25, pulseFreq: 3.8, glow: 1.15 },
    ],
  };

  const fireDefaults = {
    fireball: [
      { opacity: 0.96, fadeStart: 0.64, fadeEnd: 0.98, fadePower: 1.3, endOpacity: 0.0, intensity: 1.3, size: 1.1, duration: 1.8, velocity: 1.25, amount: 1.25, scatter: 1.05, lift: 1.1, turbulence: 1.05, pulseFreq: 5.5, glow: 1.45 },
      { opacity: 0.98, fadeStart: 0.62, fadeEnd: 0.96, fadePower: 1.65, endOpacity: 0.0, intensity: 1.4, size: 1.15, duration: 1.65, velocity: 1.35, amount: 1.3, scatter: 1.15, lift: 1.05, turbulence: 1.25, pulseFreq: 6.5, glow: 1.35 },
      { opacity: 0.94, fadeStart: 0.66, fadeEnd: 0.98, fadePower: 1.2, endOpacity: 0.0, intensity: 1.35, size: 1.12, duration: 1.95, velocity: 1.15, amount: 1.3, scatter: 1.1, lift: 1.15, turbulence: 1.15, pulseFreq: 5.0, glow: 1.55 },
    ],
    pillar: [
      { opacity: 0.96, fadeStart: 0.60, fadeEnd: 0.98, fadePower: 1.35, endOpacity: 0.0, intensity: 1.4, size: 1.18, duration: 2.3, velocity: 1.3, amount: 1.35, scatter: 1.15, lift: 1.3, turbulence: 1.1, pulseFreq: 6.0, glow: 1.5 },
      { opacity: 0.98, fadeStart: 0.58, fadeEnd: 0.96, fadePower: 1.7, endOpacity: 0.0, intensity: 1.45, size: 1.2, duration: 2.1, velocity: 1.4, amount: 1.35, scatter: 1.2, lift: 1.25, turbulence: 1.3, pulseFreq: 7.0, glow: 1.4 },
      { opacity: 0.95, fadeStart: 0.62, fadeEnd: 0.98, fadePower: 1.25, endOpacity: 0.0, intensity: 1.4, size: 1.22, duration: 2.4, velocity: 1.2, amount: 1.4, scatter: 1.25, lift: 1.35, turbulence: 1.2, pulseFreq: 5.2, glow: 1.6 },
    ],
    explosion: [
      { opacity: 0.98, fadeStart: 0.38, fadeEnd: 0.94, fadePower: 1.2, endOpacity: 0.0, intensity: 1.45, size: 1.2, duration: 1.35, velocity: 1.35, amount: 1.35, scatter: 1.25, lift: 1.1, turbulence: 1.15, pulseFreq: 6.5, glow: 1.55 },
      { opacity: 1.0, fadeStart: 0.42, fadeEnd: 0.93, fadePower: 1.75, endOpacity: 0.0, intensity: 1.5, size: 1.25, duration: 1.25, velocity: 1.45, amount: 1.4, scatter: 1.3, lift: 1.1, turbulence: 1.35, pulseFreq: 7.5, glow: 1.45 },
      { opacity: 0.96, fadeStart: 0.40, fadeEnd: 0.95, fadePower: 1.1, endOpacity: 0.0, intensity: 1.4, size: 1.22, duration: 1.45, velocity: 1.25, amount: 1.35, scatter: 1.25, lift: 1.15, turbulence: 1.25, pulseFreq: 5.8, glow: 1.65 },
    ],
    emberaura: [
      { opacity: 0.90, fadeStart: 0.56, fadeEnd: 0.98, fadePower: 1.05, endOpacity: 0.2, intensity: 1.2, size: 1.08, duration: 2.0, velocity: 1.15, amount: 1.25, scatter: 1.05, lift: 1.15, turbulence: 1.0, pulseFreq: 4.8, glow: 1.4 },
      { opacity: 0.94, fadeStart: 0.58, fadeEnd: 0.96, fadePower: 1.35, endOpacity: 0.16, intensity: 1.3, size: 1.1, duration: 1.85, velocity: 1.3, amount: 1.3, scatter: 1.1, lift: 1.15, turbulence: 1.2, pulseFreq: 6.0, glow: 1.35 },
      { opacity: 0.88, fadeStart: 0.54, fadeEnd: 0.98, fadePower: 0.95, endOpacity: 0.22, intensity: 1.25, size: 1.1, duration: 2.2, velocity: 1.1, amount: 1.3, scatter: 1.1, lift: 1.2, turbulence: 1.1, pulseFreq: 4.2, glow: 1.5 },
    ],
  };

  const buildCats = (defs, pals) => {
    const out = {};
    for (const [k, arr] of Object.entries(defs)) {
      out[k] = [0, 1, 2].map((i) => ({ ...arr[i], ...pals[i] }));
    }
    return out;
  };

  return {
    element: 'fire', // Abre direto na nova aba Fogo solicitada!
    activeCategoryByElement: {
      psychic: 'summon',
      flying: 'tornado',
      fire: 'pillar',
    },
    submodeByElement: {
      psychic: 'boulder',
      flying: 'all',
      fire: 'all',
    },
    selectedOptions: {
      psychic: { summon: 0, hit: 1, aura: 2 },
      flying: { tornado: 0, gale: 1, typhoon: 2, winddust: 0 },
      fire: { fireball: 0, pillar: 0, explosion: 1, emberaura: 2 },
    },
    elements: {
      psychic: buildCats(psychicDefaults, psychicPalettes),
      flying: buildCats(flyingDefaults, flyingPalettes),
      fire: buildCats(fireDefaults, firePalettes),
    },
    viewMode: 'triple',
    cameraPreset: 'combat',
    showDummies: true,
    playing: true,
    globalSpeed: 1.0,
    get activeCategory() {
      return this.activeCategoryByElement[this.element];
    },
    set activeCategory(v) {
      this.activeCategoryByElement[this.element] = v;
    },
    get categories() {
      return this.elements[this.element];
    },
  };
}

const STATE = createDefaultState();

// ============================================================================
// 2. MATEMÁTICA DE OPACIDADE TOTAL & REDUÇÃO AO LONGO DA DURAÇÃO
// ============================================================================

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / Math.max(1e-5, b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function computeDurationOpacity(params, u) {
  const totalOp = clamp(params.opacity ?? 1, 0, 1);
  const fs = clamp(params.fadeStart ?? 0.6, 0, 0.98);
  const fe = clamp(params.fadeEnd ?? 1.0, fs + 0.02, 1.0);
  const fp = clamp(params.fadePower ?? 1.0, 0.2, 4.0);
  const endOp = clamp(params.endOpacity ?? 0.0, 0, 1);

  const entry = u < 0.04 ? smoothstep(0, 0.04, u) : 1.0;

  let decay = 1.0;
  if (u <= fs) {
    decay = 1.0;
  } else if (u >= fe) {
    decay = endOp;
  } else {
    const raw = clamp((u - fs) / Math.max(0.01, fe - fs), 0, 1);
    const curved = Math.pow(raw, fp);
    const s = curved * curved * (3 - 2 * curved);
    decay = 1.0 - s * (1.0 - endOp);
  }
  return clamp(totalOp * entry * decay, 0, 1);
}

// ============================================================================
// 3. SHADERS CUSTOMIZADOS GLSL — PSÍQUICO, VOADOR E FOGO (3 REFERÊNCIAS)
// ============================================================================

function createEarthboundMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uAlpha: { value: 1 },
      uColor1: { value: new THREE.Color('#ff2e7e') },
      uColor2: { value: new THREE.Color('#00f0ff') },
      uColor3: { value: new THREE.Color('#ffe600') },
      uFreq: { value: 5.0 },
      uTurbulence: { value: 1.0 },
      uGlow: { value: 1.2 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vPos;
      uniform float uTime;
      uniform float uTurbulence;
      uniform float uFreq;
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vec3 p = position;
        float w = sin(p.y * uFreq * 1.6 + uTime * 5.0) * cos(p.x * uFreq * 1.4 - uTime * 4.0);
        p += normal * w * 0.08 * uTurbulence;
        vPos = p;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vPos;
      uniform float uTime;
      uniform float uAlpha;
      uniform vec3 uColor1;
      uniform vec3 uColor2;
      uniform vec3 uColor3;
      uniform float uFreq;
      uniform float uTurbulence;
      uniform float uGlow;
      float SmoothStepBand(float x) { return floor(x * 4.0) / 4.0; }
      void main() {
        vec2 uv = vUv - 0.5;
        float r = length(uv) * 2.0;
        float ang = atan(uv.y, uv.x);
        float wave = sin(r * uFreq * 3.2 - uTime * 6.0 + sin(ang * 4.0 + uTime * 3.0) * uTurbulence);
        float scan = sin((vPos.y + vPos.x * 0.5) * uFreq * 4.0 + uTime * 8.0);
        float band = fract((wave * 0.5 + 0.5) * 3.0 + scan * 0.18 + uTime * 0.7);
        vec3 col = band < 0.33 ? mix(uColor1, uColor2, SmoothStepBand(band * 3.0))
                 : band < 0.66 ? mix(uColor2, uColor3, SmoothStepBand((band - 0.33) * 3.0))
                 : mix(uColor3, uColor1, SmoothStepBand((band - 0.66) * 3.0));
        float rim = 1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0)));
        float mask = smoothstep(0.15, 0.85, 0.5 + 0.5 * wave) * (0.45 + 0.55 * rim);
        gl_FragColor = vec4(col * (0.85 + 0.55 * uGlow), clamp(mask * uAlpha, 0.0, 1.0));
      }
    `,
  });
}

function createPersonaGraphicMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uAlpha: { value: 1 },
      uColor1: { value: new THREE.Color('#b829ff') },
      uColor2: { value: new THREE.Color('#ff0055') },
      uColor3: { value: new THREE.Color('#ffd500') },
      uFreq: { value: 6.0 },
      uGlow: { value: 1.3 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vPos;
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vPos;
      uniform float uTime;
      uniform float uAlpha;
      uniform vec3 uColor1;
      uniform vec3 uColor2;
      uniform vec3 uColor3;
      uniform float uFreq;
      uniform float uGlow;
      void main() {
        float diag = fract((vUv.x * 6.0 - vUv.y * 6.0) + uTime * 2.2);
        float stripe = step(0.42, diag);
        float ring = sin(length(vUv - 0.5) * uFreq * 6.0 - uTime * 9.0);
        float hardRing = step(0.0, ring);
        float ndv = abs(dot(vNormal, vec3(0.0, 0.0, 1.0)));
        vec3 neon = mix(uColor1, uColor2, hardRing);
        neon = mix(neon, uColor3, step(0.82, fract(vUv.y * uFreq + uTime * 1.5)));
        float inkBand = step(0.22, ndv) * (1.0 - step(0.42, ndv));
        vec3 finalCol = mix(neon * (0.9 + 0.5 * uGlow), vec3(0.03, 0.01, 0.06), inkBand * 0.88);
        float alpha = (0.65 + 0.35 * stripe) * uAlpha;
        gl_FragColor = vec4(finalCol, clamp(alpha, 0.0, 1.0));
      }
    `,
  });
}

function createParasiteBioMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uAlpha: { value: 1 },
      uColor1: { value: new THREE.Color('#00e676') },
      uColor2: { value: new THREE.Color('#ff6d00') },
      uColor3: { value: new THREE.Color('#00e5ff') },
      uFreq: { value: 4.0 },
      uTurbulence: { value: 1.0 },
      uGlow: { value: 1.3 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vWorldPos;
      uniform float uTime;
      uniform float uTurbulence;
      uniform float uFreq;
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vec3 p = position;
        float bio = sin(p.x * uFreq * 2.2 + uTime * 4.2) * cos(p.y * uFreq * 2.5 - uTime * 3.7) * sin(p.z * uFreq * 2.0 + uTime * 3.1);
        p += normal * bio * 0.14 * uTurbulence;
        vWorldPos = p;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vWorldPos;
      uniform float uTime;
      uniform float uAlpha;
      uniform vec3 uColor1;
      uniform vec3 uColor2;
      uniform vec3 uColor3;
      uniform float uFreq;
      uniform float uGlow;
      void main() {
        float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 1.7);
        float veins = abs(sin(vWorldPos.x * uFreq * 4.5 + uTime * 3.0) * cos(vWorldPos.y * uFreq * 4.5 - uTime * 2.5) + sin(vWorldPos.z * uFreq * 4.0 + uTime * 4.0));
        float synapse = smoothstep(0.72, 0.98, veins);
        vec3 membrane = mix(uColor1, uColor3, fresnel);
        vec3 col = mix(membrane, uColor2 * 1.4, synapse);
        float a = clamp((0.28 + 0.72 * fresnel + 0.45 * synapse) * uAlpha, 0.0, 1.0);
        gl_FragColor = vec4(col * (0.85 + 0.55 * uGlow), a);
      }
    `,
  });
}

function createWindFunnelMaterial(styleIndex) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: styleIndex === 1 ? THREE.NormalBlending : THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uAlpha: { value: 1 },
      uColor1: { value: new THREE.Color('#7dd3fc') },
      uColor2: { value: new THREE.Color('#e7e5e4') },
      uColor3: { value: new THREE.Color('#38bdf8') },
      uFreq: { value: 5.0 },
      uTurbulence: { value: 1.0 },
      uGlow: { value: 1.2 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying float vHeight;
      uniform float uTime;
      uniform float uTurbulence;
      uniform float uFreq;
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vec3 p = position;
        float h = clamp(uv.y, 0.0, 1.0);
        vHeight = h;
        float swayX = sin(h * 4.2 - uTime * 4.8) * 0.24 * uTurbulence * (0.25 + h);
        float swayZ = cos(h * 3.8 - uTime * 4.2) * 0.24 * uTurbulence * (0.25 + h);
        p.x += swayX;
        p.z += swayZ;
        float spiral = sin(uv.x * 18.8495 + h * uFreq * 3.0 - uTime * 10.0);
        p += normal * spiral * 0.06 * uTurbulence;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader:
      styleIndex === 0
        ? `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying float vHeight;
      uniform float uTime;
      uniform float uAlpha;
      uniform vec3 uColor1;
      uniform vec3 uColor2;
      uniform vec3 uColor3;
      uniform float uFreq;
      uniform float uGlow;
      void main() {
        float scroll = fract(vUv.x * 3.0 + vHeight * uFreq * 0.85 - uTime * 1.9);
        float ribbon = smoothstep(0.18, 0.24, scroll) * (1.0 - smoothstep(0.68, 0.76, scroll));
        float fineLine = smoothstep(0.84, 0.88, scroll) * (1.0 - smoothstep(0.93, 0.97, scroll));
        float edgeFade = sin(vHeight * 3.14159);
        vec3 baseCol = mix(uColor2, uColor1, smoothstep(0.05, 0.45, vHeight));
        vec3 col = mix(baseCol, uColor3 * 1.25, fineLine);
        float mask = clamp((ribbon * 0.82 + fineLine * 1.1) * edgeFade, 0.0, 1.0);
        gl_FragColor = vec4(col * (0.85 + 0.45 * uGlow), mask * uAlpha);
      }
    `
        : styleIndex === 1
        ? `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying float vHeight;
      uniform float uTime;
      uniform float uAlpha;
      uniform vec3 uColor1;
      uniform vec3 uColor2;
      uniform vec3 uColor3;
      uniform float uFreq;
      uniform float uGlow;
      void main() {
        float slash = fract(vUv.x * 4.0 - vHeight * uFreq * 1.1 - uTime * 2.6);
        float hardBand = step(0.32, slash) * (1.0 - step(0.78, slash));
        float border = (step(0.24, slash) - step(0.32, slash)) + (step(0.78, slash) - step(0.86, slash));
        float edgeFade = sin(vHeight * 3.14159);
        vec3 neon = mix(uColor1, uColor3, step(0.55, slash));
        neon = mix(uColor2, neon, smoothstep(0.0, 0.35, vHeight));
        vec3 finalCol = mix(neon * (0.95 + 0.5 * uGlow), vec3(0.03, 0.04, 0.07), clamp(border, 0.0, 1.0));
        float a = clamp((hardBand + border) * edgeFade, 0.0, 1.0) * uAlpha;
        gl_FragColor = vec4(finalCol, a);
      }
    `
        : `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying float vHeight;
      uniform float uTime;
      uniform float uAlpha;
      uniform vec3 uColor1;
      uniform vec3 uColor2;
      uniform vec3 uColor3;
      uniform float uFreq;
      uniform float uGlow;
      void main() {
        float n1 = sin(vUv.x * 25.132 + vHeight * uFreq * 4.0 - uTime * 9.0);
        float n2 = cos(vUv.x * 12.566 - vHeight * uFreq * 2.5 - uTime * 6.5);
        float turb = 0.5 + 0.5 * (n1 * 0.6 + n2 * 0.4);
        float fresnel = 0.35 + 0.65 * (1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))));
        float edgeFade = sin(vHeight * 3.14159);
        vec3 stormCol = mix(uColor2 * 1.1, uColor1, smoothstep(0.08, 0.58, vHeight));
        stormCol = mix(stormCol, uColor3, smoothstep(0.68, 0.96, turb));
        float a = clamp(turb * fresnel * edgeFade * 1.15, 0.0, 1.0) * uAlpha;
        gl_FragColor = vec4(stormCol * (0.8 + 0.5 * uGlow), a);
      }
    `,
  });
}

// ---- SHADERS EXCLUSIVOS DO TIPO FOGO (MITOLÓGICO JAPONÊS, TINTA SUMI-E, FOGO MÁGICO) ----

function createFireMaterial(styleIndex) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    // Opção B (Tinta Sumi-e) usa NormalBlending para que o nanquim negro tenha peso sólido ao redor da brasa!
    blending: styleIndex === 1 ? THREE.NormalBlending : THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uAlpha: { value: 1 },
      uColor1: { value: new THREE.Color('#ff2a1f') },
      uColor2: { value: new THREE.Color('#ff9500') },
      uColor3: { value: new THREE.Color('#ffe66d') },
      uFreq: { value: 5.5 },
      uTurbulence: { value: 1.1 },
      uGlow: { value: 1.4 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying float vHeight;
      varying vec3 vPos;
      uniform float uTime;
      uniform float uTurbulence;
      uniform float uFreq;
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vec3 p = position;
        float h = clamp(uv.y, 0.0, 1.0);
        vHeight = h;
        // Línguas de fogo ascendentes que serpenteiam e afilam com turbulência
        float lickX = sin(h * uFreq * 1.5 - uTime * 7.5 + uv.x * 6.2831) * 0.16 * uTurbulence * h;
        float lickZ = cos(h * uFreq * 1.3 - uTime * 6.8 + uv.x * 6.2831) * 0.16 * uTurbulence * h;
        p.x += lickX;
        p.z += lickZ;
        p += normal * sin(h * uFreq * 3.2 - uTime * 11.0 + uv.x * 12.566) * 0.07 * uTurbulence;
        vPos = p;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader:
      styleIndex === 0
        ? `
      // Opção A: Fogo Mitológico Japonês (Ukiyo-e / Hinokami Kagura / Okami Amaterasu)
      // Espirais tradicionais Kaen em degraus nítidos (Vermelhão Lacado -> Laranja -> Ouro -> Núcleo Branco-Solar)
      varying vec2 vUv;
      varying vec3 vNormal;
      varying float vHeight;
      uniform float uTime;
      uniform float uAlpha;
      uniform vec3 uColor1;
      uniform vec3 uColor2;
      uniform vec3 uColor3;
      uniform float uFreq;
      uniform float uGlow;
      void main() {
        // Padrão de voluta/espiral japonesa Kaen subindo
        float coil = sin(vUv.x * 18.8495 + sin(vHeight * uFreq * 2.2 - uTime * 5.5) * 2.4 - uTime * 4.0);
        float tongues = fract(vUv.x * 4.0 + vHeight * uFreq * 0.9 - uTime * 2.4 + coil * 0.22);
        // Faixas concêntricas de xilogravura japonesa (Ukiyo-e)
        float step1 = step(0.16, tongues) * (1.0 - step(0.86, tongues));
        float step2 = step(0.32, tongues) * (1.0 - step(0.72, tongues));
        float step3 = step(0.46, tongues) * (1.0 - step(0.58, tongues));
        // Filete tradicional escuro/dourado entre as faixas
        float goldLine = (step(0.29, tongues) - step(0.32, tongues)) + (step(0.72, tongues) - step(0.75, tongues));
        vec3 col = uColor1;
        col = mix(col, uColor2, step2);
        col = mix(col, uColor3 * 1.25, step3 + goldLine);
        float verticalMask = smoothstep(0.0, 0.12, vHeight) * (1.0 - smoothstep(0.72, 0.99, vHeight));
        float a = clamp((step1 * 0.92 + goldLine) * verticalMask, 0.0, 1.0) * uAlpha;
        gl_FragColor = vec4(col * (0.9 + 0.45 * uGlow), a);
      }
    `
        : styleIndex === 1
        ? `
      // Opção B: Fogo Estilizado em Tinta (Sumi-e Ink-Wash & Dry-Brush Flame — SF4 / SF6)
      // Cerdas de pincel secas com contorno pesado de nanquim preto e brasa incandescente no centro
      varying vec2 vUv;
      varying vec3 vNormal;
      varying float vHeight;
      uniform float uTime;
      uniform float uAlpha;
      uniform vec3 uColor1;
      uniform vec3 uColor2;
      uniform vec3 uColor3;
      uniform float uFreq;
      uniform float uGlow;
      void main() {
        // Textura de cerdas de pincel caligráfico (dry brush)
        float bristles = sin(vUv.x * 62.8318 + vHeight * 8.0) * 0.5 + 0.5;
        float stroke = fract(vUv.x * 3.0 - vHeight * uFreq * 0.95 - uTime * 2.5);
        float erosion = sin(vUv.x * 18.849 + vHeight * uFreq * 3.0 - uTime * 7.0) * 0.15;
        float body = smoothstep(0.18 + erosion, 0.28, stroke) * (1.0 - smoothstep(0.74, 0.85 - erosion, stroke));
        // Núcleo de brasa viva vs Borda de Nanquim Preto (Sumi-e Ink)
        float emberCore = smoothstep(0.36, 0.46, stroke) * (1.0 - smoothstep(0.56, 0.66, stroke));
        float hotHeart = smoothstep(0.45, 0.50, stroke) * (1.0 - smoothstep(0.51, 0.56, stroke));
        float ndv = abs(dot(vNormal, vec3(0.0, 0.0, 1.0)));
        // Borda de tinta preta nas extremidades do golpe de pincel e silhueta
        vec3 inkBlack = mix(vec3(0.03, 0.02, 0.04), uColor2 * 0.35, 0.4);
        vec3 fireCol = mix(uColor1, uColor3 * 1.3, hotHeart);
        vec3 finalCol = mix(inkBlack, fireCol * (0.95 + 0.55 * uGlow), clamp(emberCore * (0.55 + 0.45 * bristles) * step(0.22, ndv), 0.0, 1.0));
        float verticalMask = smoothstep(0.0, 0.10, vHeight) * (1.0 - smoothstep(0.75, 0.99, vHeight));
        float a = clamp(body * (0.65 + 0.35 * bristles) * verticalMask, 0.0, 1.0) * uAlpha;
        gl_FragColor = vec4(finalCol, a);
      }
    `
        : `
      // Opção C: Fogo Mágico & Arcano (Astral Pyromancy / Prism Hellfire)
      // Plasma místico iridescente (Rubi / Violeta Arcano / Ouro Solar) com grade rúnica geométrica
      varying vec2 vUv;
      varying vec3 vNormal;
      varying float vHeight;
      varying vec3 vPos;
      uniform float uTime;
      uniform float uAlpha;
      uniform vec3 uColor1;
      uniform vec3 uColor2;
      uniform vec3 uColor3;
      uniform float uFreq;
      uniform float uGlow;
      void main() {
        float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 1.5);
        float plasma1 = sin(vUv.x * 18.8495 + vHeight * uFreq * 3.5 - uTime * 7.0);
        float plasma2 = cos(vUv.x * 12.5663 - vHeight * uFreq * 2.8 - uTime * 5.2);
        // Interferência geométrica de runas/sigilos arcanos na chama
        float sigilGrid = abs(sin(vUv.x * 37.699 + uTime * 3.0) * sin(vHeight * uFreq * 6.0 - uTime * 6.0));
        float runeGlow = smoothstep(0.82, 0.97, sigilGrid);
        float flameWave = 0.5 + 0.5 * (plasma1 * 0.6 + plasma2 * 0.4);
        vec3 arcaneCol = mix(uColor2, uColor1, smoothstep(0.2, 0.75, flameWave));
        arcaneCol = mix(arcaneCol, uColor3 * 1.35, runeGlow + smoothstep(0.78, 0.98, flameWave) * 0.7);
        float verticalMask = smoothstep(0.0, 0.10, vHeight) * (1.0 - smoothstep(0.72, 1.0, vHeight));
        float a = clamp((flameWave * 0.8 + fresnel * 0.5 + runeGlow * 0.6) * verticalMask, 0.0, 1.0) * uAlpha;
        gl_FragColor = vec4(arcaneCol * (0.9 + 0.55 * uGlow), a);
      }
    `,
  });
}

// ============================================================================
// 4. GEOMETRIAS 3D COMPARTILHADAS (PSÍQUICO + VOADOR + FOGO)
// ============================================================================

const SHARED_GEOS = {
  octa: new THREE.OctahedronGeometry(0.5, 0),
  icosa: new THREE.IcosahedronGeometry(0.55, 1),
  icosaWire: new THREE.IcosahedronGeometry(0.62, 1),
  tetra: new THREE.TetrahedronGeometry(0.4, 0),
  sphere: new THREE.SphereGeometry(0.5, 24, 18),
  box: new THREE.BoxGeometry(0.5, 0.5, 0.5),
  monolith: new THREE.BoxGeometry(0.55, 1.35, 0.32),
  cone: new THREE.ConeGeometry(0.18, 1.0, 4),
  needle: new THREE.ConeGeometry(0.11, 1.35, 4),
  prism: new THREE.CylinderGeometry(0.45, 0.45, 0.12, 6),
  ring: new THREE.TorusGeometry(1.0, 0.055, 10, 48),
  thinRing: new THREE.TorusGeometry(1.0, 0.025, 8, 48),
  crescentBlade: new THREE.TorusGeometry(0.75, 0.065, 8, 32, Math.PI * 1.15),
  kaenScroll: new THREE.TorusGeometry(0.62, 0.075, 10, 36, Math.PI * 1.45),
  shardGlass: new THREE.CylinderGeometry(0.35, 0.1, 0.03, 3),
  boulder: (() => {
    const g = new THREE.DodecahedronGeometry(0.55, 1);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i), vy = pos.getY(i), vz = pos.getZ(i);
      const n = 1 + 0.22 * Math.sin(vx * 5.1 + vy * 3.7) * Math.cos(vz * 4.3);
      pos.setXYZ(i, vx * n, vy * n * 0.9, vz * n);
    }
    g.computeVertexNormals();
    return g;
  })(),
  dustPuff: (() => {
    const g = new THREE.IcosahedronGeometry(0.42, 1);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i), vy = pos.getY(i), vz = pos.getZ(i);
      const n = 1 + 0.18 * Math.sin(i * 4.7 + vx * 6.0);
      pos.setXYZ(i, vx * n * 1.15, vy * n * 0.78, vz * n * 1.15);
    }
    g.computeVertexNormals();
    return g;
  })(),
  funnel: (() => {
    const g = new THREE.CylinderGeometry(1.18, 0.24, 2.6, 40, 28, true);
    g.translate(0, 1.3, 0);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 2.6;
      const flare = 0.72 + 0.55 * Math.pow(y, 1.7);
      pos.setX(i, pos.getX(i) * flare);
      pos.setZ(i, pos.getZ(i) * flare);
    }
    g.computeVertexNormals();
    return g;
  })(),
  flameColumn: (() => {
    // Coluna/língua de fogo 3D esculpida: base larga em brasa que ondula e afila em chama no topo
    const g = new THREE.CylinderGeometry(0.32, 0.88, 2.6, 36, 28, true);
    g.translate(0, 1.3, 0);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 2.6;
      const profile = Math.sin(y * Math.PI * 0.88) * (1.15 - 0.55 * y) + 0.22;
      pos.setX(i, pos.getX(i) * profile);
      pos.setZ(i, pos.getZ(i) * profile);
    }
    g.computeVertexNormals();
    return g;
  })(),
};

function createFighterDummy(colorHex, isCaster) {
  const group = new THREE.Group();
  const matBody = new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness: 0.55,
    metalness: 0.2,
    flatShading: true,
  });
  const matVisor = new THREE.MeshBasicMaterial({ color: isCaster ? 0x7dd3fc : 0xfda4af });

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.65, 0.08, 20),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 })
  );
  base.position.y = 0.04;
  group.add(base);

  const legGeo = new THREE.CapsuleGeometry(0.13, 0.45, 4, 8);
  const legL = new THREE.Mesh(legGeo, matBody);
  legL.position.set(-0.18, 0.42, 0);
  const legR = new THREE.Mesh(legGeo, matBody);
  legR.position.set(0.18, 0.42, 0);
  group.add(legL, legR);

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.52, 6, 12), matBody);
  torso.position.y = 1.05;
  group.add(torso);

  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.24, 1), matBody);
  head.position.y = 1.65;
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.16), matVisor);
  visor.position.set(0, 1.66, isCaster ? 0.18 : -0.18);
  group.add(head, visor);

  const armGeo = new THREE.CapsuleGeometry(0.1, 0.42, 4, 8);
  const armL = new THREE.Mesh(armGeo, matBody);
  armL.position.set(-0.4, 1.12, isCaster ? 0.15 : 0);
  armL.rotation.x = isCaster ? -0.6 : 0.15;
  const armR = new THREE.Mesh(armGeo, matBody);
  armR.position.set(0.4, 1.12, isCaster ? 0.15 : 0);
  armR.rotation.x = isCaster ? -0.6 : 0.15;
  group.add(armL, armR);

  group.userData = { torso, head, armL, armR, baseY: 0 };
  return group;
}

// ============================================================================
// 5. PALCO 3D POR OPÇÃO (A, B, C) COM SUPORTE A PSÍQUICO, VOADOR E FOGO
// ============================================================================

class OptionStage {
  constructor(optionIndex) {
    this.index = optionIndex;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(optionIndex === 0 ? 0x0b070c : optionIndex === 1 ? 0x09080c : 0x070612);

    const amb = new THREE.AmbientLight(0xdbeafe, 0.8);
    const dir = new THREE.DirectionalLight(0xffffff, 1.45);
    dir.position.set(4, 8, 5);
    const point = new THREE.PointLight(0xffffff, 2.2, 14);
    point.position.set(0, 2.2, 0);
    this.pointLight = point;
    this.scene.add(amb, dir, point);

    const floorMat = new THREE.MeshStandardMaterial({
      color: optionIndex === 0 ? 0x130d18 : optionIndex === 1 ? 0x121016 : 0x0e0c1e,
      roughness: 0.88,
      metalness: 0.15,
    });
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(5.8, 5.8, 0.12, 48), floorMat);
    floor.position.y = -0.06;
    this.scene.add(floor);

    const grid = new THREE.PolarGridHelper(5.4, 12, 6, 48, 0x2a243b, 0x1a1829);
    grid.position.y = 0.005;
    this.scene.add(grid);

    this.caster = createFighterDummy(0x2563eb, true);
    this.target = createFighterDummy(0xe11d48, false);
    this.caster.rotation.y = Math.PI / 2;
    this.target.rotation.y = -Math.PI / 2;
    this.scene.add(this.caster, this.target);

    this.fxRoot = new THREE.Group();
    this.scene.add(this.fxRoot);

    this.psychicShaderMat =
      optionIndex === 0
        ? createEarthboundMaterial()
        : optionIndex === 1
        ? createPersonaGraphicMaterial()
        : createParasiteBioMaterial();

    this.windFunnelMat = createWindFunnelMaterial(optionIndex);
    this.fireShaderMat = createFireMaterial(optionIndex);

    this.activeMeshCount = 0;
    this.lastAlpha = 1.0;
    this.buildReusableNodes();
  }

  buildReusableNodes() {
    this.nodes = {
      summonCore: new THREE.Group(),
      shaderShells: [],
      funnels: [],
      fireColumns: [],
      fireOrbs: [],
      crescents: [],
      dustPuffs: [],
      rings: [],
      shards: [],
      spikes: [],
      helixNodes: [],
      wireframes: [],
    };

    // Objeto central invocado (Psíquico)
    this.summonedMeshes = {
      boulder: new THREE.Mesh(
        SHARED_GEOS.boulder,
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.25, flatShading: true, transparent: true })
      ),
      monolith: new THREE.Mesh(
        SHARED_GEOS.monolith,
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2, metalness: 0.6, flatShading: true, transparent: true })
      ),
      polyhedron: new THREE.Group(),
      biocore: new THREE.Mesh(SHARED_GEOS.sphere, this.psychicShaderMat.clone()),
    };

    const m1 = new THREE.Mesh(
      SHARED_GEOS.octa,
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.15, metalness: 0.7, flatShading: true, transparent: true })
    );
    const m2 = new THREE.Mesh(
      SHARED_GEOS.octa,
      new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true })
    );
    m2.scale.setScalar(1.25);
    this.summonedMeshes.polyhedron.add(m1, m2);

    this.summonCage = new THREE.Mesh(
      SHARED_GEOS.icosaWire,
      new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true })
    );
    this.nodes.summonCore.add(this.summonCage);
    for (const m of Object.values(this.summonedMeshes)) {
      this.nodes.summonCore.add(m);
    }
    this.fxRoot.add(this.nodes.summonCore);

    // 4 Esferas com Shader Psíquico
    for (let i = 0; i < 4; i++) {
      const mat = this.psychicShaderMat.clone();
      const mesh = new THREE.Mesh(SHARED_GEOS.sphere, mat);
      this.fxRoot.add(mesh);
      this.nodes.shaderShells.push(mesh);
    }

    // 5 Funis de Tornado / Tufão 3D com Shader de Vento
    for (let i = 0; i < 5; i++) {
      const mat = this.windFunnelMat.clone();
      const mesh = new THREE.Mesh(SHARED_GEOS.funnel, mat);
      this.fxRoot.add(mesh);
      this.nodes.funnels.push(mesh);
    }

    // 5 Colunas / Línguas de Fogo 3D com Shader de Fogo (Mitológico / Sumi-e / Arcano)
    for (let i = 0; i < 5; i++) {
      const mat = this.fireShaderMat.clone();
      const mesh = new THREE.Mesh(SHARED_GEOS.flameColumn, mat);
      this.fxRoot.add(mesh);
      this.nodes.fireColumns.push(mesh);
    }

    // 4 Orbes / Domos de Fogo 3D com Shader de Fogo
    for (let i = 0; i < 4; i++) {
      const mat = this.fireShaderMat.clone();
      const mesh = new THREE.Mesh(SHARED_GEOS.sphere, mat);
      this.fxRoot.add(mesh);
      this.nodes.fireOrbs.push(mesh);
    }

    // 24 Lâminas Crescentes / Volutas Kaen / Pinceladas em Arco
    for (let i = 0; i < 24; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        depthWrite: false,
        blending: this.index === 1 ? THREE.NormalBlending : THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(this.index === 0 ? SHARED_GEOS.kaenScroll : SHARED_GEOS.crescentBlade, mat);
      this.fxRoot.add(mesh);
      this.nodes.crescents.push(mesh);
    }

    // 42 Volumes 3D de Poeira / Fumaça / Respingos de Tinta (Sumi-e)
    for (let i = 0; i < 42; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.85,
        metalness: 0.05,
        flatShading: this.index === 1,
        transparent: true,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(SHARED_GEOS.dustPuff, mat);
      this.fxRoot.add(mesh);
      this.nodes.dustPuffs.push(mesh);
    }

    // 16 Anéis Torus 3D
    for (let i = 0; i < 16; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        depthWrite: false,
        blending: this.index === 1 ? THREE.NormalBlending : THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(i % 2 === 0 ? SHARED_GEOS.ring : SHARED_GEOS.thinRing, mat);
      this.fxRoot.add(mesh);
      this.nodes.rings.push(mesh);
    }

    // 36 Fragmentos / Pétalas de Brasa / Cristais Arcanos 3D
    for (let i = 0; i < 36; i++) {
      const geo = i % 3 === 0 ? SHARED_GEOS.octa : i % 3 === 1 ? SHARED_GEOS.shardGlass : SHARED_GEOS.boulder;
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 0.65,
        roughness: 0.3,
        metalness: 0.25,
        flatShading: true,
        transparent: true,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      this.fxRoot.add(mesh);
      this.nodes.shards.push(mesh);
    }

    // 24 Pontas / Lanças de Chama & Nanquim
    for (let i = 0; i < 24; i++) {
      const group = new THREE.Group();
      const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false });
      const hullMat = new THREE.MeshBasicMaterial({
        color: 0x06040b,
        transparent: true,
        depthWrite: false,
        side: THREE.BackSide,
      });
      const core = new THREE.Mesh(SHARED_GEOS.needle, coreMat);
      const hull = new THREE.Mesh(SHARED_GEOS.needle, hullMat);
      hull.scale.set(1.34, 1.08, 1.34);
      group.add(core, hull);
      group.userData = { core, hull };
      this.fxRoot.add(group);
      this.nodes.spikes.push(group);
    }

    // 48 Fagulhas / Brasas / Wisps
    for (let i = 0; i < 48; i++) {
      const geo = this.index === 2 ? SHARED_GEOS.octa : SHARED_GEOS.sphere;
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(geo, mat);
      this.fxRoot.add(mesh);
      this.nodes.helixNodes.push(mesh);
    }

    // 6 Gaiolas / Selos Rúnicos / Polígonos Arcanos
    for (let i = 0; i < 6; i++) {
      const geo = this.index === 2 ? SHARED_GEOS.octa : SHARED_GEOS.icosaWire;
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        wireframe: true,
        transparent: true,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      this.fxRoot.add(mesh);
      this.nodes.wireframes.push(mesh);
    }
  }

  hideAllPool() {
    this.nodes.summonCore.visible = false;
    for (const s of this.nodes.shaderShells) s.visible = false;
    for (const f of this.nodes.funnels) f.visible = false;
    for (const fc of this.nodes.fireColumns) fc.visible = false;
    for (const fo of this.nodes.fireOrbs) fo.visible = false;
    for (const c of this.nodes.crescents) c.visible = false;
    for (const d of this.nodes.dustPuffs) d.visible = false;
    for (const r of this.nodes.rings) r.visible = false;
    for (const s of this.nodes.shards) s.visible = false;
    for (const sp of this.nodes.spikes) sp.visible = false;
    for (const h of this.nodes.helixNodes) h.visible = false;
    for (const w of this.nodes.wireframes) w.visible = false;
    this.activeMeshCount = 0;
  }

  syncShaderUniforms(mat, params, alpha, time) {
    if (!mat.uniforms) return;
    mat.uniforms.uTime.value = time * params.velocity;
    mat.uniforms.uAlpha.value = alpha;
    mat.uniforms.uColor1.value.set(params.color);
    mat.uniforms.uColor2.value.set(params.color2);
    mat.uniforms.uColor3.value.set(params.color3);
    mat.uniforms.uFreq.value = params.pulseFreq;
    if (mat.uniforms.uTurbulence) mat.uniforms.uTurbulence.value = params.turbulence;
    if (mat.uniforms.uGlow) mat.uniforms.uGlow.value = params.glow * params.intensity;
  }

  update(elementKey, catKey, u, absTime) {
    this.hideAllPool();
    this.caster.position.set(-1.95, 0, 0);
    this.caster.rotation.set(0, Math.PI / 2, 0);
    this.target.position.set(1.95, 0, 0);
    this.target.rotation.set(0, -Math.PI / 2, 0);

    if (elementKey === 'fire') {
      this.updateFire(catKey, u, absTime);
    } else if (elementKey === 'flying') {
      this.updateFlying(catKey, u, absTime);
    } else {
      this.updatePsychic(catKey, u, absTime);
    }
  }

  // ==========================================================================
  // ABA 3: EFEITOS 3D DO TIPO FOGO (MITOLÓGICO JAPONÊS, TINTA SUMI-E, FOGO MÁGICO)
  // ==========================================================================
  updateFire(catKey, u, absTime) {
    const showDummies = STATE.showDummies;
    this.caster.visible = showDummies;
    this.target.visible = showDummies;

    const layerMode = STATE.submodeByElement.fire || 'all';
    const showFlames = layerMode !== 'embers-only';
    const showEmbers = layerMode !== 'flame-only';
    const densityMult = layerMode === 'inferno-heavy' ? 1.6 : 1.0;

    if (catKey === 'emberaura') {
      this.caster.position.set(0, 0, 0);
      this.caster.rotation.y = 0;
      this.target.visible = false;
    } else if (catKey === 'pillar' || catKey === 'explosion') {
      this.caster.visible = false;
      this.target.position.set(0, 0, 0);
      this.target.rotation.y = 0;
    }

    if (catKey === 'sequence') {
      const pAura = STATE.elements.fire.emberaura[this.index];
      const pBall = STATE.elements.fire.fireball[this.index];
      const pPil = STATE.elements.fire.pillar[this.index];
      const pExp = STATE.elements.fire.explosion[this.index];

      if (u < 0.42) {
        this.renderFireAura(pAura, clamp(u / 0.42, 0, 1), absTime, new THREE.Vector3(-1.95, 0, 0), showFlames, showEmbers, densityMult);
      }
      if (u >= 0.15 && u <= 0.68) {
        this.renderFireball(pBall, clamp((u - 0.15) / 0.5, 0, 1), absTime, new THREE.Vector3(-1.35, 0, 0), new THREE.Vector3(1.95, 0, 0), showFlames, showEmbers, densityMult);
      }
      if (u >= 0.55) {
        const uImpact = clamp((u - 0.55) / 0.45, 0, 1);
        this.renderFirePillar(pPil, uImpact, absTime, new THREE.Vector3(1.95, 0, 0), showFlames, showEmbers, densityMult);
        this.renderFireExplosion(pExp, uImpact, absTime, new THREE.Vector3(1.95, 0, 0), showFlames, showEmbers, densityMult);
      }
      const domP = u < 0.25 ? pAura : u < 0.58 ? pBall : pPil;
      const domU = u < 0.25 ? u / 0.25 : u < 0.58 ? (u - 0.15) / 0.5 : (u - 0.55) / 0.45;
      this.lastAlpha = computeDurationOpacity(domP, clamp(domU, 0, 1));
      return;
    }

    const params = STATE.elements.fire[catKey][this.index];
    this.lastAlpha = computeDurationOpacity(params, u);

    if (catKey === 'fireball') {
      this.renderFireball(params, u, absTime, new THREE.Vector3(-1.35, 0, 0), new THREE.Vector3(1.95, 0, 0), showFlames, showEmbers, densityMult);
    } else if (catKey === 'pillar') {
      this.renderFirePillar(params, u, absTime, new THREE.Vector3(0, 0, 0), showFlames, showEmbers, densityMult);
    } else if (catKey === 'explosion') {
      this.renderFireExplosion(params, u, absTime, new THREE.Vector3(0, 0, 0), showFlames, showEmbers, densityMult);
    } else if (catKey === 'emberaura') {
      this.renderFireAura(params, u, absTime, new THREE.Vector3(0, 0, 0), showFlames, showEmbers, densityMult);
    }
  }

  // --------------------------------------------------------------------------
  // FOGO 1: RAJADA & BOLA DE FOGO (PROJÉTIL ÍGNEO + RASTRO)
  // --------------------------------------------------------------------------
  renderFireball(p, u, absTime, startPos, targetPos, showFlames, showEmbers, densityMult) {
    const alpha = computeDurationOpacity(p, u);
    if (alpha <= 0.002) return;

    const cMain = new THREE.Color(p.color);
    const cSec = new THREE.Color(p.color2);
    const cCore = new THREE.Color(p.color3);
    const S = p.size, I = p.intensity, L = p.lift, SC = p.scatter, V = p.velocity, TB = p.turbulence;
    const t = absTime * V;

    const chargeK = smoothstep(0.0, 0.24, u);
    const flyK = smoothstep(0.20, 0.88, u);
    const fx = THREE.MathUtils.lerp(startPos.x, targetPos.x, Math.pow(flyK, 1.5));
    const fy = (1.18 + Math.sin(flyK * Math.PI) * 0.28 * (this.index === 0 ? 1 : 0.4)) * L;
    const fz = Math.sin(t * 4.5) * 0.08 * TB * (1 - flyK);

    this.pointLight.position.set(fx, fy, fz);
    this.pointLight.color.copy(cMain);
    this.pointLight.intensity = 3.0 * I * alpha * p.glow;

    if (this.target.visible && flyK > 0.78) {
      this.target.position.x = targetPos.x + Math.sin(t * 45) * 0.14 * I;
    }

    if (showFlames) {
      // Núcleo Esférico + Cauda Cônica de Fogo (Shader GLSL da Opção A/B/C)
      const orb = this.nodes.fireOrbs[0];
      orb.visible = true;
      orb.position.set(fx, fy, fz);
      orb.scale.setScalar(0.68 * S * chargeK * (1 + 0.12 * Math.sin(t * p.pulseFreq * 2)));
      orb.rotation.set(t * 3, -t * 4, 0);
      this.syncShaderUniforms(orb.material, p, alpha, absTime);
      this.activeMeshCount++;

      // Cone de Chama arrastado para trás como cometa ígneo
      const wakeCol = this.nodes.fireColumns[0];
      wakeCol.visible = true;
      wakeCol.position.set(fx, fy, fz);
      wakeCol.rotation.set(0, 0, Math.PI / 2);
      wakeCol.scale.set(0.52 * S * SC, 1.15 * S * Math.max(0.2, flyK), 0.52 * S * SC);
      this.syncShaderUniforms(wakeCol.material, p, alpha * 0.88, absTime + 0.3);
      this.activeMeshCount++;

      if (this.index === 0) {
        // OPÇÃO A (Mitológico Japonês): Roda Solar Hinokami / Kaen-daiko girando ao redor da bola de fogo + Volutas Vermelhão/Ouro
        const wheelN = clamp(Math.round(12 * p.amount * densityMult), 4, 22);
        for (let i = 0; i < wheelN; i++) {
          const cb = this.nodes.crescents[i];
          cb.visible = true;
          const lag = Math.max(0, flyK - (i % 4) * 0.06);
          const wx = THREE.MathUtils.lerp(startPos.x, targetPos.x, Math.pow(lag, 1.5));
          const a = (i / wheelN) * Math.PI * 2 + t * 7.5;
          cb.position.set(wx, fy, fz);
          cb.rotation.set(a, Math.PI / 2 * (i % 2), a);
          cb.scale.setScalar((0.55 + (i % 3) * 0.22) * S * SC * chargeK);
          cb.material.color.copy(i % 2 === 0 ? cCore : cMain);
          cb.material.opacity = alpha * 0.92;
          this.activeMeshCount++;
        }
      } else if (this.index === 1) {
        // OPÇÃO B (Tinta Sumi-e): Rasgos de Pincel Negro + Brasa Viva cortando o ar
        const spN = clamp(Math.round(14 * p.amount * densityMult), 4, 22);
        for (let i = 0; i < spN; i++) {
          const sp = this.nodes.spikes[i];
          sp.visible = true;
          const lag = Math.max(0, flyK - i * 0.035);
          const sx = THREE.MathUtils.lerp(startPos.x, targetPos.x, Math.pow(lag, 1.5));
          const a = i * 1.9 + t * 8.0;
          const r = (0.25 + (i % 3) * 0.22) * S * SC;
          sp.position.set(sx, fy + Math.sin(a) * r, fz + Math.cos(a) * r);
          sp.rotation.set(0, 0, Math.PI / 2 + Math.sin(a) * 0.35);
          sp.scale.set(0.42 * S, 1.15 * S * I, 0.42 * S);
          sp.userData.core.material.color.copy(i % 2 === 0 ? cMain : cCore);
          sp.userData.core.material.opacity = alpha;
          sp.userData.hull.material.opacity = alpha;
          this.activeMeshCount += 2;
        }
      } else {
        // OPÇÃO C (Fogo Mágico Arcano): Selos Rúnicos Giratórios no Lançador + Anéis Astrais no Projétil
        for (let i = 0; i < 6; i++) {
          const r = this.nodes.rings[i];
          r.visible = true;
          if (i < 2) {
            // Círculo hermético duplo no lançador
            r.position.set(startPos.x, 1.18 * L, 0);
            r.rotation.set(0, Math.PI / 2, t * (i % 2 ? 3 : -3));
            r.scale.setScalar((0.75 + i * 0.35) * S * SC * chargeK);
          } else {
            // Anéis giroscópicos envolvendo o orbe mágico
            r.position.set(fx, fy, fz);
            r.rotation.set(t * 4 + i, t * 3 - i, i);
            r.scale.setScalar((0.48 + (i - 2) * 0.16) * S * SC);
          }
          r.material.color.copy(i % 2 === 0 ? cCore : cSec);
          r.material.opacity = alpha * 0.9;
          this.activeMeshCount++;
        }
      }
    }

    // Rastro de Brasas / Respingos de Tinta / Cristais de Éter
    if (showEmbers) {
      if (this.index === 1) {
        // Respingos 3D de Nanquim & Brasa (Sumi-e Ink Drops)
        const dropN = clamp(Math.round(20 * p.amount * densityMult), 6, 38);
        for (let i = 0; i < dropN; i++) {
          const dp = this.nodes.dustPuffs[i];
          dp.visible = true;
          const prog = (i / dropN + u * 1.6) % 1;
          const dx = THREE.MathUtils.lerp(startPos.x, fx, prog);
          const a = i * 2.3 + t * 4;
          const rad = (0.18 + (1 - prog) * 0.65) * S * SC;
          dp.position.set(dx, fy + Math.sin(a) * rad, Math.cos(a) * rad);
          dp.rotation.set(t * 5, a, i);
          dp.scale.setScalar((0.18 + (i % 3) * 0.1) * S);
          dp.material.color.copy(i % 3 === 0 ? cMain : new THREE.Color(0x110c14));
          dp.material.opacity = alpha * 0.92;
          this.activeMeshCount++;
        }
      } else {
        // Pétalas de Ouro Solar (Opção A) ou Cristais/Fagulhas Arcanas (Opção C)
        const embN = clamp(Math.round(24 * p.amount * densityMult), 6, 44);
        for (let i = 0; i < embN; i++) {
          const hn = this.nodes.helixNodes[i];
          hn.visible = true;
          const prog = (i / embN + u * 1.8) % 1;
          const ex = THREE.MathUtils.lerp(startPos.x, fx, prog);
          const a = i * 1.7 + t * 6.0;
          const rad = (0.15 + (1 - prog) * 0.72) * S * SC;
          hn.position.set(ex, fy + Math.sin(a) * rad + (1 - prog) * 0.35 * L, Math.cos(a) * rad);
          hn.scale.setScalar((0.11 + (i % 3) * 0.05) * S * I);
          hn.material.color.copy(i % 3 === 0 ? cCore : i % 3 === 1 ? cMain : cSec);
          hn.material.opacity = alpha * prog;
          this.activeMeshCount++;
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // FOGO 2: PILAR DE FOGO & ERUPÇÃO (COLUNA ÍGNEA / GÊISER 3D)
  // --------------------------------------------------------------------------
  renderFirePillar(p, u, absTime, center, showFlames, showEmbers, densityMult) {
    const alpha = computeDurationOpacity(p, u);
    if (alpha <= 0.002) return;

    const cMain = new THREE.Color(p.color);
    const cSec = new THREE.Color(p.color2);
    const cCore = new THREE.Color(p.color3);
    const S = p.size, I = p.intensity, L = p.lift, SC = p.scatter, V = p.velocity, TB = p.turbulence;
    const t = absTime * V;

    const erupt = smoothstep(0.0, 0.22, u);
    this.pointLight.position.set(center.x, 1.8 * L, center.z);
    this.pointLight.color.copy(cMain);
    this.pointLight.intensity = 3.5 * I * alpha * p.glow;

    if (this.target.visible) {
      this.target.position.set(center.x, Math.sin(u * Math.PI) * 0.75 * L * erupt, center.z);
      this.target.rotation.y = t * 5.0;
    }

    if (showFlames) {
      // Colunas de Fogo Concêntricas (Núcleo + Manto Externo Contra-Rotativo)
      for (let i = 0; i < 3; i++) {
        const fc = this.nodes.fireColumns[i];
        fc.visible = true;
        fc.position.set(center.x, 0.01, center.z);
        fc.rotation.set(0, t * (i % 2 === 0 ? 5.2 : -4.0) + i * 1.1, 0);
        const rS = (0.72 + i * 0.34) * S * SC * (0.3 + 0.7 * erupt);
        const hS = (1.28 - i * 0.1) * S * L * erupt;
        fc.scale.set(rS, hS, rS);
        this.syncShaderUniforms(fc.material, p, alpha * (i === 0 ? 0.98 : 0.78), absTime + i * 0.45);
        this.activeMeshCount++;
      }

      if (this.index === 0) {
        // OPÇÃO A (Mitológico Japonês): Volutas de Fogo Xintoísta (Kaen Scrolls) subindo em lótus + Espelho Solar no Chão
        const scrollN = clamp(Math.round(16 * p.amount * densityMult), 6, 24);
        for (let i = 0; i < scrollN; i++) {
          const cb = this.nodes.crescents[i];
          cb.visible = true;
          const hFrac = (i / scrollN + u * 1.8) % 1;
          const a = (i / scrollN) * Math.PI * 2 + t * 5.5;
          const rad = (0.55 + Math.sin(hFrac * Math.PI) * 0.65) * S * SC;
          cb.position.set(center.x + Math.cos(a) * rad * 0.35, hFrac * 2.8 * L * S * erupt, center.z + Math.sin(a) * rad * 0.35);
          cb.rotation.set(0.35, a, Math.PI / 4);
          cb.scale.setScalar(rad * (0.75 + 0.25 * (i % 2)));
          cb.material.color.copy(i % 2 === 0 ? cCore : cMain);
          cb.material.opacity = alpha * Math.sin(hFrac * Math.PI) * 0.95;
          this.activeMeshCount++;
        }
      } else if (this.index === 1) {
        // OPÇÃO B (Tinta Sumi-e): Rasgos Verticais de Pincel com Contorno de Nanquim Preto + Círculo Enso no Solo
        const spN = clamp(Math.round(18 * p.amount * densityMult), 6, 24);
        for (let i = 0; i < spN; i++) {
          const sp = this.nodes.spikes[i];
          sp.visible = true;
          const hFrac = (i / spN + u * 2.0) % 1;
          const a = i * 1.65 + t * 6.0;
          const rad = (0.45 + (1 - hFrac) * 0.55) * S * SC;
          sp.position.set(center.x + Math.cos(a) * rad, hFrac * 2.75 * L * S * erupt, center.z + Math.sin(a) * rad);
          sp.rotation.set(0.18 * Math.sin(a), -a, 0.15);
          const sc = (0.52 + (i % 3) * 0.2) * S * I;
          sp.scale.set(sc * 0.7, sc * 1.45, sc * 0.7);
          sp.userData.core.material.color.copy(i % 3 === 0 ? cCore : cMain);
          sp.userData.core.material.opacity = alpha;
          sp.userData.hull.material.opacity = alpha;
          this.activeMeshCount += 2;
        }
      } else {
        // OPÇÃO C (Fogo Mágico Arcano): Anéis de Invocação Rúnica Subindo pela Coluna + Poliedros de Éter
        const ringN = clamp(Math.round(10 * p.amount * densityMult), 4, 16);
        for (let i = 0; i < ringN; i++) {
          const r = this.nodes.rings[i];
          r.visible = true;
          const hFrac = i < 3 ? 0.03 + i * 0.03 : ((i - 3) / (ringN - 3) + u * 1.5) % 1;
          r.position.set(center.x, hFrac * 2.8 * L * S * erupt, center.z);
          r.rotation.set(Math.PI / 2 + (i >= 3 ? 0.22 * Math.sin(t * 3 + i) : 0), 0, t * (i % 2 ? 4 : -4));
          r.scale.setScalar((i < 3 ? 1.15 + i * 0.45 : 0.65 + Math.sin(hFrac * Math.PI) * 0.55) * S * SC);
          r.material.color.copy(i % 3 === 0 ? cCore : i % 3 === 1 ? cMain : cSec);
          r.material.opacity = alpha * (i < 3 ? 0.95 : Math.sin(hFrac * Math.PI));
          this.activeMeshCount++;
        }
      }
    }

    if (showEmbers) {
      if (this.index === 1) {
        // Nuvens de Fumaça/Nanquim & Gotas de Tinta na Base do Pilar Sumi-e
        const inkN = clamp(Math.round(24 * p.amount * densityMult), 8, 38);
        for (let i = 0; i < inkN; i++) {
          const dp = this.nodes.dustPuffs[i];
          dp.visible = true;
          const hFrac = (i / inkN + u * 1.4) % 1;
          const a = i * 2.1 + t * 4.5;
          const rad = (0.55 + (1 - hFrac) * 0.75) * S * SC;
          dp.position.set(center.x + Math.cos(a) * rad, hFrac * 2.3 * L * S, center.z + Math.sin(a) * rad);
          dp.rotation.set(t * 3, a, i);
          const sc = (0.35 * (1 - hFrac * 0.4)) * S;
          dp.scale.set(sc * 1.2, sc * 0.9, sc * 1.2);
          dp.material.color.copy(i % 3 === 0 ? cMain : new THREE.Color(0x140e16));
          dp.material.opacity = alpha * (1 - hFrac * 0.5) * 0.92;
          this.activeMeshCount++;
        }
      } else {
        // Chuva Ascendente de Pétalas Solares (A) ou Cristais de Fogo Mágico (C)
        const shardN = clamp(Math.round(22 * p.amount * densityMult), 6, 34);
        for (let i = 0; i < shardN; i++) {
          const sh = this.nodes.shards[i];
          sh.visible = true;
          const hFrac = (i / shardN + u * 1.6) % 1;
          const a = i * 2.35 + t * 5.0;
          const rad = (0.45 + Math.sin(hFrac * Math.PI) * 0.95) * S * SC;
          sh.position.set(center.x + Math.cos(a) * rad, (0.15 + hFrac * 2.95) * L * S, center.z + Math.sin(a) * rad);
          sh.rotation.set(t * 6 + i, t * 4, i);
          sh.scale.setScalar((0.16 + (i % 3) * 0.06) * S * I);
          const col = i % 3 === 0 ? cCore : i % 3 === 1 ? cMain : cSec;
          sh.material.color.copy(col);
          sh.material.emissive.copy(col);
          sh.material.opacity = alpha * Math.sin(hFrac * Math.PI);
          this.activeMeshCount++;
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // FOGO 3: EXPLOSÃO & HIT DE FOGO (COMBUSTÃO / DETONAÇÃO NO ALVO)
  // --------------------------------------------------------------------------
  renderFireExplosion(p, u, absTime, center, showFlames, showEmbers, densityMult) {
    const alpha = computeDurationOpacity(p, u);
    if (alpha <= 0.002) return;

    const cMain = new THREE.Color(p.color);
    const cSec = new THREE.Color(p.color2);
    const cCore = new THREE.Color(p.color3);
    const S = p.size, I = p.intensity, L = p.lift, SC = p.scatter, V = p.velocity, TB = p.turbulence;
    const t = absTime * V;

    const hitPos = new THREE.Vector3(center.x, 1.15 * L, center.z);
    const burst = 1 - Math.pow(1 - u, 2.5);

    this.pointLight.position.copy(hitPos);
    this.pointLight.color.copy(cCore);
    this.pointLight.intensity = 3.8 * I * alpha * p.glow;

    if (showFlames) {
      // Esferas de Detonação Ígnea em Camadas
      for (let i = 0; i < 2; i++) {
        const orb = this.nodes.fireOrbs[i];
        orb.visible = true;
        orb.position.copy(hitPos);
        orb.scale.setScalar((0.38 + burst * (1.75 + i * 0.65)) * S * SC);
        orb.rotation.set(t * (i ? -3 : 3), t * 4, i);
        this.syncShaderUniforms(orb.material, p, alpha * (i === 0 ? 0.96 : 0.68), absTime + i * 0.4);
        this.activeMeshCount++;
      }

      if (this.index === 0) {
        // OPÇÃO A (Mitológico Japonês): Desabrochar de Lótus de Fogo (Kaen Lotus) + Anéis Solares
        const lotusN = clamp(Math.round(16 * p.amount * densityMult), 6, 24);
        for (let i = 0; i < lotusN; i++) {
          const cb = this.nodes.crescents[i];
          cb.visible = true;
          const a = (i / lotusN) * Math.PI * 2 + t * 2.5;
          const layer = i % 2;
          const dist = (0.35 + burst * (1.35 + layer * 0.45)) * S * SC;
          cb.position.set(hitPos.x + Math.cos(a) * dist * 0.5, hitPos.y + (layer ? 0.25 : -0.15) * burst, hitPos.z + Math.sin(a) * dist * 0.5);
          cb.rotation.set(0.65 + layer * 0.4, a, t * 3);
          cb.scale.setScalar((0.55 + burst * 0.75) * S);
          cb.material.color.copy(i % 2 === 0 ? cCore : cMain);
          cb.material.opacity = alpha * 0.92;
          this.activeMeshCount++;
        }
      } else if (this.index === 1) {
        // OPÇÃO B (Tinta Sumi-e): Explosão de Lanças de Nanquim & Brasa (Ink-Splash Impact)
        const spN = clamp(Math.round(20 * p.amount * densityMult), 6, 24);
        for (let i = 0; i < spN; i++) {
          const sp = this.nodes.spikes[i];
          sp.visible = true;
          const golden = Math.PI * (3 - Math.sqrt(5));
          const y = 1 - (i / Math.max(1, spN - 1)) * 2;
          const r = Math.sqrt(Math.max(0, 1 - y * y));
          const th = golden * i * (1 + 0.1 * TB);
          const dir = new THREE.Vector3(Math.cos(th) * r, y * L, Math.sin(th) * r).normalize();
          const reach = (0.3 + burst * (1.65 + (i % 3) * 0.4)) * S * SC;
          sp.position.copy(hitPos).addScaledVector(dir, reach * 0.65);
          sp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
          sp.scale.set(0.55 * S, 1.3 * S * I * (1 - 0.2 * u), 0.55 * S);
          sp.userData.core.material.color.copy(i % 2 === 0 ? cMain : cCore);
          sp.userData.core.material.opacity = alpha;
          sp.userData.hull.material.opacity = alpha;
          this.activeMeshCount += 2;
        }
      } else {
        // OPÇÃO C (Fogo Mágico Arcano): Supernova Rúnica com Gaiola Poliedral + Anéis Herméticos Inclinados
        for (let i = 0; i < 3; i++) {
          const wf = this.nodes.wireframes[i];
          wf.visible = true;
          wf.position.copy(hitPos);
          wf.scale.setScalar((0.5 + burst * (1.6 + i * 0.55)) * S * SC);
          wf.rotation.set(t * (i + 1), -t * 2, i);
          wf.material.color.copy(i === 0 ? cCore : cSec);
          wf.material.opacity = alpha * 0.85;
          this.activeMeshCount++;
        }
        for (let i = 0; i < 6; i++) {
          const r = this.nodes.rings[i];
          r.visible = true;
          r.position.copy(hitPos);
          r.rotation.set(i * 0.7 + t * 2, i * 0.5, t * 3);
          r.scale.setScalar((0.4 + burst * (1.5 + i * 0.32)) * S * SC);
          r.material.color.copy(i % 2 === 0 ? cMain : cCore);
          r.material.opacity = alpha * 0.88;
          this.activeMeshCount++;
        }
      }
    }

    if (showEmbers) {
      const count = clamp(Math.round(24 * p.amount * densityMult), 6, 36);
      for (let i = 0; i < count; i++) {
        const mesh = this.index === 1 ? this.nodes.dustPuffs[i] : this.nodes.shards[i];
        mesh.visible = true;
        const phi = Math.acos(1 - (2 * (i + 0.5)) / count);
        const theta = Math.PI * (1 + Math.sqrt(5)) * i + t * 1.2;
        const dist = (0.35 + burst * (2.2 + (i % 3) * 0.45)) * S * SC;
        mesh.position.set(
          hitPos.x + Math.sin(phi) * Math.cos(theta) * dist,
          Math.max(0.12, hitPos.y + Math.cos(phi) * dist * L - 0.3 * u * u),
          hitPos.z + Math.sin(phi) * Math.sin(theta) * dist
        );
        mesh.rotation.set(t * 6 + i, t * 5, i);
        mesh.scale.setScalar((this.index === 1 ? 0.28 : 0.22) * S);
        mesh.material.color.copy(this.index === 1 && i % 2 === 0 ? new THREE.Color(0x140d16) : i % 2 === 0 ? cCore : cMain);
        if (mesh.material.emissive) mesh.material.emissive.copy(cMain);
        mesh.material.opacity = alpha;
        this.activeMeshCount++;
      }
    }
  }

  // --------------------------------------------------------------------------
  // FOGO 4: AURA FLAMEJANTE & BRASAS (MANTO DE FOGO CONTÍNUO)
  // --------------------------------------------------------------------------
  renderFireAura(p, u, absTime, center, showFlames, showEmbers, densityMult) {
    const alpha = computeDurationOpacity(p, u);
    if (alpha <= 0.002) return;

    const cMain = new THREE.Color(p.color);
    const cSec = new THREE.Color(p.color2);
    const cCore = new THREE.Color(p.color3);
    const S = p.size, I = p.intensity, L = p.lift, SC = p.scatter, V = p.velocity;
    const t = absTime * V;

    this.pointLight.position.set(center.x, 1.3 * L, center.z);
    this.pointLight.color.copy(cMain);
    this.pointLight.intensity = 2.6 * I * alpha * p.glow;

    if (showFlames) {
      // Manto de Fogo 3D ao redor do corpo do lutador
      const auraCol = this.nodes.fireColumns[0];
      auraCol.visible = true;
      auraCol.position.set(center.x, 0.02, center.z);
      auraCol.scale.set(0.75 * S * SC, 0.88 * S * L, 0.75 * S * SC);
      auraCol.rotation.y = t * 3.8;
      this.syncShaderUniforms(auraCol.material, p, alpha * 0.82, absTime);
      this.activeMeshCount++;

      if (this.index === 0) {
        // OPÇÃO A (Mitológico Japonês): Halo Sagrado Xintoísta (Kaen Mandorla / Amaterasu) atrás das costas do lutador!
        const haloRing = this.nodes.rings[0];
        haloRing.visible = true;
        haloRing.position.set(center.x, 1.25 * L, center.z - 0.32);
        haloRing.rotation.set(0, 0, t * 1.8);
        haloRing.scale.setScalar(1.05 * S * SC);
        haloRing.material.color.copy(cCore);
        haloRing.material.opacity = alpha * 0.95;
        this.activeMeshCount++;

        const tongueN = clamp(Math.round(12 * p.amount * densityMult), 4, 20);
        for (let i = 0; i < tongueN; i++) {
          const cb = this.nodes.crescents[i];
          cb.visible = true;
          const a = (i / tongueN) * Math.PI * 2 + t * 2.2;
          const rad = 1.05 * S * SC;
          cb.position.set(center.x + Math.cos(a) * rad, 1.25 * L + Math.sin(a) * rad, center.z - 0.32);
          cb.rotation.set(0, 0, a + Math.PI / 2);
          cb.scale.setScalar(0.32 * S * I);
          cb.material.color.copy(i % 2 === 0 ? cMain : cCore);
          cb.material.opacity = alpha * 0.92;
          this.activeMeshCount++;
        }
      } else if (this.index === 1) {
        // OPÇÃO B (Tinta Sumi-e): Labaredas de Pincel Negro + Brasa subindo do chão + Círculo Enso nos pés
        const spN = clamp(Math.round(16 * p.amount * densityMult), 6, 24);
        for (let i = 0; i < spN; i++) {
          const sp = this.nodes.spikes[i];
          sp.visible = true;
          const phase = (i / spN + u * 1.6) % 1;
          const a = i * 1.5 + t * 3.2;
          const rad = (0.58 + 0.25 * (1 - phase)) * S * SC;
          sp.position.set(center.x + Math.cos(a) * rad, (0.15 + phase * 1.95) * L, center.z + Math.sin(a) * rad);
          sp.rotation.set(0.15, -a, 0.2);
          const sc = Math.sin(phase * Math.PI) * 0.55 * S * I;
          sp.scale.set(sc * 0.65, sc * 1.4, sc * 0.65);
          sp.userData.core.material.color.copy(i % 2 === 0 ? cMain : cCore);
          sp.userData.core.material.opacity = alpha;
          sp.userData.hull.material.opacity = alpha;
          this.activeMeshCount += 2;
        }
      } else {
        // OPÇÃO C (Fogo Mágico Arcano): Selos Rúnicos nos Pés e Peito + Chamas Espirituais (Will-o'-the-Wisp) em Órbita
        for (let i = 0; i < 5; i++) {
          const r = this.nodes.rings[i];
          r.visible = true;
          r.position.set(center.x, (0.06 + i * 0.42) * L, center.z);
          r.rotation.set(Math.PI / 2 + 0.15 * Math.sin(t * 2 + i), 0, t * (i % 2 ? 3 : -3));
          r.scale.setScalar((1.15 - i * 0.12) * S * SC);
          r.material.color.copy(i % 2 === 0 ? cCore : cSec);
          r.material.opacity = alpha * 0.88;
          this.activeMeshCount++;
        }
      }
    }

    if (showEmbers) {
      const embN = clamp(Math.round(24 * p.amount * densityMult), 6, 42);
      for (let i = 0; i < embN; i++) {
        const hn = this.nodes.helixNodes[i];
        hn.visible = true;
        const phase = (i / embN + u * 1.4) % 1;
        const a = i * 1.85 + t * 3.5;
        const rad = (0.55 + 0.35 * Math.sin(phase * Math.PI + i)) * S * SC;
        hn.position.set(center.x + Math.cos(a) * rad, (0.1 + phase * 2.25) * L, center.z + Math.sin(a) * rad);
        hn.scale.setScalar((0.11 + 0.05 * Math.sin(t * 6 + i)) * S * I);
        hn.material.color.copy(i % 3 === 0 ? cCore : i % 3 === 1 ? cMain : cSec);
        hn.material.opacity = alpha * Math.sin(phase * Math.PI);
        this.activeMeshCount++;
      }
    }
  }

  // ==========================================================================
  // ABA 2: EFEITOS 3D DO TIPO VOADOR (TORNADOS, VENDAVAIS, TUFÕES, VENTO & POEIRA)
  // ==========================================================================
  updateFlying(catKey, u, absTime) {
    const showDummies = STATE.showDummies;
    this.caster.visible = showDummies;
    this.target.visible = showDummies;

    const layerMode = STATE.submodeByElement.flying || 'all';
    const showWind = layerMode !== 'dust-only';
    const showDust = layerMode !== 'wind-only';
    const debrisMult = layerMode === 'heavy-debris' ? 1.75 : layerMode === 'wind-only' ? 0.0 : 1.0;

    if (catKey === 'winddust') {
      this.caster.position.set(0, 0, 0);
      this.caster.rotation.y = 0;
      this.target.visible = false;
    } else if (catKey === 'typhoon') {
      this.caster.visible = false;
      this.target.position.set(0, 0, 0);
      this.target.rotation.y = 0;
    }

    if (catKey === 'sequence') {
      const pWind = STATE.elements.flying.winddust[this.index];
      const pGale = STATE.elements.flying.gale[this.index];
      const pTyph = STATE.elements.flying.typhoon[this.index];

      if (u < 0.45) {
        this.renderFlyingWindDust(pWind, clamp(u / 0.45, 0, 1), absTime, new THREE.Vector3(-1.95, 0, 0), showWind, showDust, debrisMult);
      }
      if (u >= 0.15 && u <= 0.72) {
        const uG = clamp((u - 0.15) / 0.55, 0, 1);
        this.renderFlyingGale(pGale, uG, absTime, new THREE.Vector3(-1.4, 0, 0), new THREE.Vector3(1.95, 0, 0), showWind, showDust, debrisMult);
      }
      if (u >= 0.55) {
        const uT = clamp((u - 0.55) / 0.45, 0, 1);
        this.renderFlyingTyphoon(pTyph, uT, absTime, new THREE.Vector3(1.95, 0, 0), showWind, showDust, debrisMult);
      }
      const domP = u < 0.25 ? pWind : u < 0.6 ? pGale : pTyph;
      const domU = u < 0.25 ? u / 0.25 : u < 0.6 ? (u - 0.15) / 0.55 : (u - 0.55) / 0.45;
      this.lastAlpha = computeDurationOpacity(domP, clamp(domU, 0, 1));
      return;
    }

    const params = STATE.elements.flying[catKey][this.index];
    this.lastAlpha = computeDurationOpacity(params, u);

    if (catKey === 'tornado') {
      this.renderFlyingTornado(params, u, absTime, new THREE.Vector3(-1.1, 0, 0), new THREE.Vector3(1.95, 0, 0), showWind, showDust, debrisMult);
    } else if (catKey === 'gale') {
      this.renderFlyingGale(params, u, absTime, new THREE.Vector3(-1.45, 0, 0), new THREE.Vector3(1.95, 0, 0), showWind, showDust, debrisMult);
    } else if (catKey === 'typhoon') {
      this.renderFlyingTyphoon(params, u, absTime, new THREE.Vector3(0, 0, 0), showWind, showDust, debrisMult);
    } else if (catKey === 'winddust') {
      this.renderFlyingWindDust(params, u, absTime, new THREE.Vector3(0, 0, 0), showWind, showDust, debrisMult);
    }
  }

  renderFlyingTornado(p, u, absTime, startPos, targetPos, showWind, showDust, debrisMult) {
    const alpha = computeDurationOpacity(p, u);
    if (alpha <= 0.002) return;

    const cWind = new THREE.Color(p.color), cDust = new THREE.Color(p.color2), cBlade = new THREE.Color(p.color3);
    const S = p.size, I = p.intensity, L = p.lift, SC = p.scatter, V = p.velocity, TB = p.turbulence;
    const t = absTime * V;

    const travel = smoothstep(0.08, 0.88, u);
    const tx = THREE.MathUtils.lerp(startPos.x, targetPos.x, travel);
    const tz = Math.sin(travel * Math.PI * 2) * 0.32 * TB * (1 - travel * 0.5);
    const grow = smoothstep(0.0, 0.18, u);

    this.pointLight.position.set(tx, 1.5 * L, tz);
    this.pointLight.color.copy(cWind);
    this.pointLight.intensity = 2.4 * I * alpha * p.glow;

    if (this.target.visible && travel > 0.68) {
      this.target.position.y = Math.sin(clamp((travel - 0.68) / 0.32, 0, 1) * Math.PI) * 0.85 * L * I;
      this.target.rotation.y = -Math.PI / 2 + t * 8.0;
    }

    if (showWind) {
      for (let fIdx = 0; fIdx < 2; fIdx++) {
        const fn = this.nodes.funnels[fIdx];
        fn.visible = true;
        fn.position.set(tx, 0.02, tz);
        const radScale = (fIdx === 0 ? 0.78 : 1.12) * S * SC * grow;
        const hScale = (fIdx === 0 ? 1.15 : 0.98) * S * L * grow;
        fn.scale.set(radScale, hScale, radScale);
        fn.rotation.y = t * (fIdx === 0 ? 5.5 : -3.8);
        this.syncShaderUniforms(fn.material, p, alpha * (fIdx === 0 ? 0.95 : 0.65), absTime + fIdx * 0.7);
        this.activeMeshCount++;
      }

      const bladeN = clamp(Math.round(14 * p.amount), 4, 24);
      for (let i = 0; i < bladeN; i++) {
        const cb = this.nodes.crescents[i];
        cb.visible = true;
        const hFrac = (i / bladeN + u * 2.2) % 1;
        const y = hFrac * 2.75 * S * L * grow;
        const coneR = (0.28 + 0.88 * Math.pow(hFrac, 1.45)) * S * SC;
        const ang = i * 1.4 + t * 9.0;
        const swayX = Math.sin(hFrac * 4.2 - t * 4.8) * 0.22 * TB * (0.25 + hFrac);
        const swayZ = Math.cos(hFrac * 3.8 - t * 4.2) * 0.22 * TB * (0.25 + hFrac);
        cb.position.set(tx + swayX, y, tz + swayZ);
        cb.rotation.set(Math.PI / 2 + 0.28 * Math.sin(ang), 0.22 * Math.cos(ang), ang);
        cb.scale.setScalar(coneR * (0.85 + 0.25 * (i % 2)));
        cb.material.color.copy(i % 3 === 0 ? cBlade : cWind);
        cb.material.opacity = alpha * Math.sin(hFrac * Math.PI) * 0.92;
        this.activeMeshCount++;
      }
    }

    if (showDust) {
      const dustN = clamp(Math.round(24 * p.amount), 8, 40);
      for (let i = 0; i < dustN; i++) {
        const dp = this.nodes.dustPuffs[i];
        dp.visible = true;
        const ringLayer = i % 3;
        const a = (i / dustN) * Math.PI * 2 + t * (5.5 - ringLayer * 1.3);
        const rad = (0.42 + ringLayer * 0.34 + 0.14 * Math.sin(t * 6 + i)) * S * SC * grow;
        const py = (0.14 + ringLayer * 0.16 + 0.08 * Math.abs(Math.sin(t * 5 + i))) * S * L;
        dp.position.set(tx + Math.cos(a) * rad, py, tz + Math.sin(a) * rad);
        dp.rotation.set(t * 3 + i, a, t * 2);
        const puffScale = (0.42 + 0.18 * (i % 3)) * S * (1 + 0.15 * I);
        dp.scale.set(puffScale * 1.25, puffScale * 0.85, puffScale * 1.25);
        dp.material.color.copy(cDust).lerp(cWind, ringLayer === 2 ? 0.35 : 0.1);
        dp.material.opacity = alpha * (0.88 - ringLayer * 0.18);
        this.activeMeshCount++;
      }
    }

    if (debrisMult > 0) {
      const debN = clamp(Math.round(14 * p.amount * debrisMult), 3, 32);
      for (let i = 0; i < debN; i++) {
        const sh = this.nodes.shards[i];
        sh.visible = true;
        const hFrac = (i * 0.19 + u * 1.6) % 1;
        const a = i * 2.4 + t * 7.5;
        const rad = (0.38 + hFrac * 1.15) * S * SC;
        sh.position.set(tx + Math.cos(a) * rad, (0.15 + hFrac * 2.55) * L * S, tz + Math.sin(a) * rad);
        sh.rotation.set(t * 6 + i, t * 5, i);
        sh.scale.setScalar((0.16 + (i % 3) * 0.07) * S);
        sh.material.color.copy(i % 2 === 0 ? cDust : cBlade);
        sh.material.opacity = alpha;
        this.activeMeshCount++;
      }
    }
  }

  renderFlyingGale(p, u, absTime, startPos, targetPos, showWind, showDust, debrisMult) {
    const alpha = computeDurationOpacity(p, u);
    if (alpha <= 0.002) return;

    const cWind = new THREE.Color(p.color), cDust = new THREE.Color(p.color2), cBlade = new THREE.Color(p.color3);
    const S = p.size, I = p.intensity, L = p.lift, SC = p.scatter, V = p.velocity, TB = p.turbulence;
    const t = absTime * V;

    const surge = 1 - Math.pow(1 - u, 2.2);
    const gx = THREE.MathUtils.lerp(startPos.x, targetPos.x, surge);

    if (showWind) {
      const tunnel = this.nodes.funnels[0];
      tunnel.visible = true;
      tunnel.position.set(startPos.x, 1.1 * L, 0);
      tunnel.rotation.set(0, 0, -Math.PI / 2);
      tunnel.scale.set(0.68 * S * SC, 1.35 * S * Math.min(1, u * 2.2), 0.68 * S * SC);
      this.syncShaderUniforms(tunnel.material, p, alpha * 0.78, absTime);
      this.activeMeshCount++;

      const slashN = clamp(Math.round(12 * p.amount), 3, 22);
      for (let i = 0; i < slashN; i++) {
        const cb = this.nodes.crescents[i];
        cb.visible = true;
        const waveLag = clamp((u - (i % 4) * 0.07) / 0.75, 0, 1);
        const sx = THREE.MathUtils.lerp(startPos.x, targetPos.x + 0.4, 1 - Math.pow(1 - waveLag, 2));
        cb.position.set(sx, (1.1 + Math.sin(i * 2.1 + t * 5) * 0.38 * SC) * L, Math.cos(i * 1.7 + t * 4) * 0.45 * SC);
        cb.rotation.set((i % 2 === 0 ? 0.55 : -0.55) + Math.sin(t * 3 + i) * 0.2 * TB, Math.PI / 2, -Math.PI / 2 + t * 6);
        cb.scale.setScalar((0.55 + (i % 3) * 0.28) * S * I);
        cb.material.color.copy(i % 2 === 0 ? cBlade : cWind);
        cb.material.opacity = alpha * (1 - waveLag * 0.35);
        this.activeMeshCount++;
      }
    }

    if (showDust) {
      const wakeN = clamp(Math.round(22 * p.amount), 6, 38);
      for (let i = 0; i < wakeN; i++) {
        const dp = this.nodes.dustPuffs[i];
        dp.visible = true;
        const side = i % 2 === 0 ? 1 : -1;
        const prog = (i / wakeN + u * 1.4) % 1;
        dp.position.set(THREE.MathUtils.lerp(startPos.x - 0.3, gx, prog), (0.12 + prog * 0.45 * L) * S, side * (0.28 + prog * 0.95) * SC * S);
        dp.rotation.set(t * 4, prog * 3, side * t * 3);
        const sc = (0.32 + prog * 0.42) * S;
        dp.scale.set(sc * 1.35, sc * 0.8, sc);
        dp.material.color.copy(cDust);
        dp.material.opacity = alpha * (1 - prog * 0.65) * 0.9;
        this.activeMeshCount++;
      }
    }
  }

  renderFlyingTyphoon(p, u, absTime, center, showWind, showDust, debrisMult) {
    const alpha = computeDurationOpacity(p, u);
    if (alpha <= 0.002) return;

    const cWind = new THREE.Color(p.color), cDust = new THREE.Color(p.color2), cBlade = new THREE.Color(p.color3);
    const S = p.size, I = p.intensity, L = p.lift, SC = p.scatter, V = p.velocity;
    const t = absTime * V;
    const expand = 1 - Math.pow(1 - clamp(u / 0.35, 0, 1), 2.4);

    if (showWind) {
      for (let i = 0; i < 5; i++) {
        const fn = this.nodes.funnels[i];
        fn.visible = true;
        if (i < 3) {
          fn.position.set(center.x, 0.01, center.z);
          const rS = (0.75 + i * 0.58) * S * SC * expand;
          const hS = (1.35 - i * 0.12) * S * L * expand;
          fn.scale.set(rS, hS, rS);
          fn.rotation.y = t * (i % 2 === 0 ? 4.8 : -3.6);
        } else {
          const satA = t * 2.4 + (i - 3) * Math.PI;
          const satR = 1.65 * S * SC * expand;
          fn.position.set(center.x + Math.cos(satA) * satR, 0.02, center.z + Math.sin(satA) * satR);
          fn.scale.set(0.38 * S * SC, 0.92 * S * L * expand, 0.38 * S * SC);
          fn.rotation.y = -t * 8.0;
        }
        this.syncShaderUniforms(fn.material, p, alpha * (i === 0 ? 0.95 : 0.68), absTime + i * 0.4);
        this.activeMeshCount++;
      }
    }

    if (showDust) {
      const dustN = clamp(Math.round(32 * p.amount), 10, 42);
      for (let i = 0; i < dustN; i++) {
        const dp = this.nodes.dustPuffs[i];
        dp.visible = true;
        const band = i % 4;
        const a = (i / dustN) * Math.PI * 2 + t * (4.8 - band * 0.8);
        const rad = (0.55 + band * 0.52 + 0.2 * Math.sin(t * 4 + i)) * S * SC * expand;
        const py = (0.16 + band * 0.24 + 0.12 * Math.sin(t * 5 + i)) * S * L;
        dp.position.set(center.x + Math.cos(a) * rad, py, center.z + Math.sin(a) * rad);
        dp.rotation.set(t * 2.5 + i, a, t * 2);
        const sc = (0.48 + (i % 3) * 0.22) * S * (0.9 + 0.2 * I);
        dp.scale.set(sc * 1.3, sc * 0.85, sc * 1.3);
        dp.material.color.copy(cDust).lerp(cWind, band * 0.18);
        dp.material.opacity = alpha * (0.92 - band * 0.15);
        this.activeMeshCount++;
      }
    }
  }

  renderFlyingWindDust(p, u, absTime, center, showWind, showDust) {
    const alpha = computeDurationOpacity(p, u);
    if (alpha <= 0.002) return;

    const cWind = new THREE.Color(p.color), cDust = new THREE.Color(p.color2), cBlade = new THREE.Color(p.color3);
    const S = p.size, I = p.intensity, L = p.lift, SC = p.scatter, V = p.velocity;
    const t = absTime * V;

    if (showWind) {
      const auraFunnel = this.nodes.funnels[0];
      auraFunnel.visible = true;
      auraFunnel.position.set(center.x, 0.02, center.z);
      auraFunnel.scale.set(0.68 * S * SC, 0.85 * S * L, 0.68 * S * SC);
      auraFunnel.rotation.y = t * 4.2;
      this.syncShaderUniforms(auraFunnel.material, p, alpha * 0.72, absTime);
      this.activeMeshCount++;

      const cN = clamp(Math.round(10 * p.amount), 3, 20);
      for (let i = 0; i < cN; i++) {
        const cb = this.nodes.crescents[i];
        cb.visible = true;
        const phase = (i / cN + u * 1.5) % 1;
        const a = i * 1.7 + t * 5.5;
        cb.position.set(center.x, (0.2 + phase * 1.95) * L, center.z);
        cb.rotation.set(Math.PI / 2 + 0.32 * Math.sin(a), 0.25 * Math.cos(a), a);
        cb.scale.setScalar((0.55 + 0.35 * Math.sin(phase * Math.PI)) * S * SC);
        cb.material.color.copy(i % 2 === 0 ? cWind : cBlade);
        cb.material.opacity = alpha * Math.sin(phase * Math.PI) * 0.9;
        this.activeMeshCount++;
      }
    }

    if (showDust) {
      const dustN = clamp(Math.round(18 * p.amount), 6, 32);
      for (let i = 0; i < dustN; i++) {
        const dp = this.nodes.dustPuffs[i];
        dp.visible = true;
        const phase = (i / dustN + u) % 1;
        const a = (i / dustN) * Math.PI * 2 + t * 3.2;
        const rad = (0.48 + phase * 0.85) * S * SC;
        dp.position.set(center.x + Math.cos(a) * rad, (0.12 + Math.sin(phase * Math.PI) * 0.22) * S, center.z + Math.sin(a) * rad);
        const sc = Math.sin(phase * Math.PI) * 0.42 * S * I + 0.12;
        dp.scale.set(sc * 1.25, sc * 0.78, sc * 1.25);
        dp.material.color.copy(cDust);
        dp.material.opacity = alpha * Math.sin(phase * Math.PI) * 0.88;
        this.activeMeshCount++;
      }
    }
  }

  // ==========================================================================
  // ABA 1: EFEITOS 3D DO TIPO PSÍQUICO (INVOCAÇÃO, HIT, AURA & SEQUÊNCIA)
  // ==========================================================================
  updatePsychic(catKey, u, absTime) {
    const showDummies = STATE.showDummies;
    this.caster.visible = showDummies;
    this.target.visible = showDummies;

    if (catKey === 'aura') {
      this.caster.position.set(0, 0, 0);
      this.caster.rotation.y = 0;
      this.target.visible = false;
    } else if (catKey === 'hit') {
      this.caster.visible = false;
      this.target.position.set(0, 0, 0);
      this.target.rotation.y = 0;
    }

    if (catKey === 'sequence') {
      const pAura = STATE.elements.psychic.aura[this.index];
      const pSummon = STATE.elements.psychic.summon[this.index];
      const pHit = STATE.elements.psychic.hit[this.index];

      const uAura = clamp(u / 0.55, 0, 1);
      if (u < 0.6) this.renderPsychicAura(pAura, uAura, absTime, new THREE.Vector3(-1.95, 0, 0));
      if (u >= 0.12 && u <= 0.78) {
        this.renderPsychicSummon(pSummon, clamp((u - 0.12) / 0.62, 0, 1), absTime, new THREE.Vector3(-1.1, 0, 0), new THREE.Vector3(1.95, 0, 0));
      }
      if (u >= 0.62) {
        this.renderPsychicHit(pHit, clamp((u - 0.62) / 0.38, 0, 1), absTime, new THREE.Vector3(1.95, 0, 0));
      }
      const domP = u < 0.25 ? pAura : u < 0.65 ? pSummon : pHit;
      const domU = u < 0.25 ? uAura : u < 0.65 ? clamp((u - 0.12) / 0.62, 0, 1) : clamp((u - 0.62) / 0.38, 0, 1);
      this.lastAlpha = computeDurationOpacity(domP, domU);
      return;
    }

    const params = STATE.elements.psychic[catKey][this.index];
    this.lastAlpha = computeDurationOpacity(params, u);

    if (catKey === 'summon') {
      this.renderPsychicSummon(params, u, absTime, new THREE.Vector3(-1.05, 0, 0), new THREE.Vector3(1.95, 0, 0));
    } else if (catKey === 'hit') {
      this.renderPsychicHit(params, u, absTime, new THREE.Vector3(0, 0, 0));
    } else if (catKey === 'aura') {
      this.renderPsychicAura(params, u, absTime, new THREE.Vector3(0, 0, 0));
    }
  }

  renderPsychicSummon(p, u, absTime, spawnOrigin, targetOrigin) {
    const alpha = computeDurationOpacity(p, u);
    if (alpha <= 0.002) return;

    const c1 = new THREE.Color(p.color), c2 = new THREE.Color(p.color2), c3 = new THREE.Color(p.color3);
    const S = p.size, I = p.intensity, L = p.lift, SC = p.scatter, V = p.velocity, TB = p.turbulence;
    const t = absTime * V;

    const emergeK = smoothstep(0.0, 0.32, u);
    const launchK = smoothstep(0.66, 0.94, u);
    const hoverY = (1.35 + 0.22 * Math.sin(t * p.pulseFreq)) * L;
    const curX = THREE.MathUtils.lerp(spawnOrigin.x, targetOrigin.x - 0.2, Math.pow(launchK, 1.8));
    const curY = THREE.MathUtils.lerp(0.15, hoverY, emergeK) * (1 - 0.25 * launchK) + 0.25 * launchK;
    const curZ = Math.sin(t * 3.0) * 0.08 * TB * (1 - launchK);

    const core = this.nodes.summonCore;
    core.visible = true;
    core.position.set(curX, curY, curZ);
    core.scale.setScalar(Math.max(0.001, emergeK * S * (1 + 0.12 * Math.sin(t * p.pulseFreq * 1.5) * I)));
    core.rotation.set(t * 1.4 * (1 + 0.4 * TB), t * 2.1, t * 0.9);
    this.activeMeshCount += 2;

    const chosenObj = STATE.submodeByElement.psychic || 'boulder';
    for (const [k, m] of Object.entries(this.summonedMeshes)) {
      m.visible = k === chosenObj;
      if (m.visible) {
        if (k === 'polyhedron') {
          m.children[0].material.color.copy(c1);
          m.children[0].material.opacity = alpha;
          m.children[1].material.color.copy(c3);
          m.children[1].material.opacity = alpha * 0.85;
        } else if (k === 'biocore') {
          this.syncShaderUniforms(m.material, p, alpha, absTime);
        } else {
          m.material.color.copy(c1).lerp(new THREE.Color(0xffffff), 0.25);
          m.material.emissive.copy(c2);
          m.material.opacity = alpha;
        }
      }
    }

    const portal = this.nodes.shaderShells[0];
    portal.visible = true;
    portal.position.set(curX, curY, 0);
    portal.scale.setScalar(0.88 * S * emergeK);
    this.syncShaderUniforms(portal.material, p, alpha * 0.85, absTime);
    this.activeMeshCount++;

    const shardCount = clamp(Math.round(14 * p.amount), 3, 28);
    for (let i = 0; i < shardCount; i++) {
      const sh = this.nodes.shards[i];
      sh.visible = true;
      const ang = (i / shardCount) * Math.PI * 2 + t * 2.8;
      const orbitR = (1.1 - 0.45 * emergeK) * SC * S;
      sh.position.set(curX + Math.cos(ang) * orbitR * 0.45, curY + Math.sin(ang) * orbitR, Math.cos(ang * 2) * orbitR);
      sh.rotation.set(t * 4 + i, t * 3, i);
      sh.scale.setScalar(0.2 * S);
      sh.material.color.copy(i % 3 === 0 ? c1 : i % 3 === 1 ? c2 : c3);
      sh.material.opacity = alpha;
      this.activeMeshCount++;
    }
  }

  renderPsychicHit(p, u, absTime, center) {
    const alpha = computeDurationOpacity(p, u);
    if (alpha <= 0.002) return;

    const c1 = new THREE.Color(p.color), c2 = new THREE.Color(p.color2), c3 = new THREE.Color(p.color3);
    const S = p.size, I = p.intensity, L = p.lift, SC = p.scatter, V = p.velocity;
    const t = absTime * V;
    const impactCenter = new THREE.Vector3(center.x, 1.15 * L, center.z);
    const burst = 1 - Math.pow(1 - u, 2.6);

    const sh = this.nodes.shaderShells[0];
    sh.visible = true;
    sh.position.copy(impactCenter);
    sh.scale.setScalar((0.4 + burst * 1.75) * S * SC);
    this.syncShaderUniforms(sh.material, p, alpha * 0.92, absTime);
    this.activeMeshCount++;

    const shardN = clamp(Math.round(18 * p.amount), 4, 32);
    for (let i = 0; i < shardN; i++) {
      const s = this.nodes.shards[i];
      s.visible = true;
      const phi = Math.acos(1 - (2 * (i + 0.5)) / shardN);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i + t * 1.5;
      const dist = (0.3 + burst * 2.2) * S * SC;
      s.position.set(
        impactCenter.x + Math.sin(phi) * Math.cos(theta) * dist,
        Math.max(0.12, impactCenter.y + Math.cos(phi) * dist * L),
        impactCenter.z + Math.sin(phi) * Math.sin(theta) * dist
      );
      s.scale.setScalar(0.22 * S * I);
      s.material.color.copy(i % 3 === 0 ? c1 : i % 3 === 1 ? c2 : c3);
      s.material.opacity = alpha;
      this.activeMeshCount++;
    }
  }

  renderPsychicAura(p, u, absTime, center) {
    const alpha = computeDurationOpacity(p, u);
    if (alpha <= 0.002) return;

    const c1 = new THREE.Color(p.color), c2 = new THREE.Color(p.color2), c3 = new THREE.Color(p.color3);
    const S = p.size, L = p.lift, SC = p.scatter, V = p.velocity;
    const t = absTime * V;

    const shell = this.nodes.shaderShells[0];
    shell.visible = true;
    shell.position.set(center.x, 1.05 * L, center.z);
    shell.scale.set(1.05 * S * SC, 1.42 * S * L, 1.05 * S * SC);
    shell.rotation.y = t * 1.5;
    this.syncShaderUniforms(shell.material, p, alpha * 0.76, absTime);
    this.activeMeshCount++;

    const ringN = clamp(Math.round(8 * p.amount), 3, 14);
    for (let i = 0; i < ringN; i++) {
      const r = this.nodes.rings[i];
      r.visible = true;
      const phase = (i / ringN + u * 1.5) % 1;
      r.position.set(center.x, phase * 2.2 * L, center.z);
      r.rotation.set(Math.PI / 2, 0, t * 2);
      r.scale.setScalar((Math.sin(phase * Math.PI) * 1.1 + 0.35) * S * SC);
      r.material.color.copy(i % 3 === 0 ? c1 : i % 3 === 1 ? c2 : c3);
      r.material.opacity = alpha * Math.sin(phase * Math.PI);
      this.activeMeshCount++;
    }
  }
}

// ============================================================================
// 6. INICIALIZAÇÃO WEBGL, CONTROLES DE CÂMERA E INTERAÇÃO
// ============================================================================

const canvas = document.getElementById('vfx-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setScissorTest(true);

const stages = [new OptionStage(0), new OptionStage(1), new OptionStage(2)];
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);

let camYaw = 0.22;
let camPitch = 0.36;
let camDist = 6.8;
let isDragging = false;
let prevMouse = { x: 0, y: 0 };

function applyCameraPreset(preset) {
  if (preset === 'combat') {
    camYaw = 0.22;
    camPitch = 0.36;
    camDist = 6.8;
  } else if (preset === 'side') {
    camYaw = 0.0;
    camPitch = 0.18;
    camDist = 6.6;
  } else if (preset === 'front') {
    camYaw = Math.PI / 2;
    camPitch = 0.22;
    camDist = 5.8;
  } else if (preset === 'top') {
    camYaw = 0.0;
    camPitch = 1.35;
    camDist = 7.5;
  }
}

canvas.addEventListener('pointerdown', (e) => {
  isDragging = true;
  prevMouse = { x: e.clientX, y: e.clientY };
});
window.addEventListener('pointerup', () => {
  isDragging = false;
});
window.addEventListener('pointermove', (e) => {
  if (!isDragging) return;
  const dx = e.clientX - prevMouse.x;
  const dy = e.clientY - prevMouse.y;
  prevMouse = { x: e.clientX, y: e.clientY };
  camYaw -= dx * 0.008;
  camPitch = clamp(camPitch + dy * 0.008, 0.05, 1.48);
});
canvas.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    camDist = clamp(camDist + e.deltaY * 0.004, 3.2, 13.0);
  },
  { passive: false }
);

// ============================================================================
// 7. CONSTRUÇÃO DINÂMICA DAS ABAS, OVERLAYS, CURVAS E SLIDERS
// ============================================================================

function syncModernRangeSlider(input) {
  input.style.setProperty('--attr-min', input.min || 0);
  input.style.setProperty('--attr-max', input.max || 100);
  input.style.setProperty('--control-value', input.value);
}

const curveCanvases = [];

function getActiveBaseCategory() {
  const elDef = ELEMENT_DEFS[STATE.element];
  const curCat = STATE.activeCategory;
  if (curCat === 'sequence') {
    return elDef.categories[0].key;
  }
  return curCat;
}

function drawOpacityCurve(optIdx, uCurrent) {
  const cvs = curveCanvases[optIdx];
  if (!cvs) return;
  const ctx = cvs.getContext('2d');
  const w = cvs.width;
  const h = cvs.height;
  ctx.clearRect(0, 0, w, h);

  const baseCat = getActiveBaseCategory();
  const params = STATE.elements[STATE.element][baseCat][optIdx];

  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, h / 2);
  ctx.lineTo(w, h / 2);
  ctx.moveTo(w * params.fadeStart, 0);
  ctx.lineTo(w * params.fadeStart, h);
  ctx.moveTo(w * params.fadeEnd, 0);
  ctx.lineTo(w * params.fadeEnd, h);
  ctx.stroke();

  const strokeCol = optIdx === 0 ? '#38bdf8' : optIdx === 1 ? '#a855f7' : '#10b981';
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let i = 0; i <= 60; i++) {
    const u = i / 60;
    const op = computeDurationOpacity(params, u);
    ctx.lineTo(u * w, h - op * (h - 8) - 4);
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fillStyle = optIdx === 0 ? 'rgba(56,189,248,0.22)' : optIdx === 1 ? 'rgba(168,85,247,0.22)' : 'rgba(16,185,129,0.22)';
  ctx.fill();

  ctx.beginPath();
  for (let i = 0; i <= 60; i++) {
    const u = i / 60;
    const op = computeDurationOpacity(params, u);
    const x = u * w;
    const y = h - op * (h - 8) - 4;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = strokeCol;
  ctx.lineWidth = 2;
  ctx.stroke();

  const curOp = computeDurationOpacity(params, uCurrent);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(uCurrent * w, h - curOp * (h - 8) - 4, 3.8, 0, Math.PI * 2);
  ctx.fill();
}

function formatSliderValue(spec, val) {
  if (spec.scale === 100) return `${Math.round(val * 100)}${spec.unit}`;
  return `${Number(val).toFixed(2)}${spec.unit}`;
}

function renderElementChrome() {
  const elDef = ELEMENT_DEFS[STATE.element];

  document.querySelectorAll('.el-pill[data-el]').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-el') === STATE.element);
  });

  const tabWrap = document.getElementById('category-tabs');
  tabWrap.innerHTML = '';
  elDef.categories.forEach((cat) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.id = `tab-${cat.key}`;
    b.className = `tab-btn${STATE.activeCategory === cat.key ? ' active' : ''}`;
    b.setAttribute('data-cat', cat.key);
    b.textContent = cat.label;
    b.addEventListener('click', () => {
      STATE.activeCategory = cat.key;
      simTime = 0;
      renderElementChrome();
      buildSlidersDeck();
      updateFavoriteButtonsUI();
      refreshExportData();
    });
    tabWrap.appendChild(b);
  });

  document.getElementById('lbl-submode').textContent = elDef.submodeLabel;
  const selSub = document.getElementById('sel-submode');
  selSub.innerHTML = '';
  elDef.submodes.forEach((sm) => {
    const opt = document.createElement('option');
    opt.value = sm.value;
    opt.textContent = sm.label;
    selSub.appendChild(opt);
  });
  selSub.value = STATE.submodeByElement[STATE.element];

  elDef.options.forEach((optMeta, idx) => {
    document.getElementById(`vp-title-${idx}`).textContent = optMeta.name.toUpperCase();
    document.getElementById(`vp-sub-${idx}`).textContent = optMeta.sub;
  });
}

function buildSlidersDeck() {
  const deck = document.getElementById('sliders-deck');
  deck.innerHTML = '';
  curveCanvases.length = 0;

  const elDef = ELEMENT_DEFS[STATE.element];
  const baseCat = getActiveBaseCategory();
  const catLabel = elDef.categories.find((c) => c.key === baseCat)?.label || '';

  const colorLabels =
    STATE.element === 'flying'
      ? ['Cor do Vento', 'Cor da Poeira', 'Cor Lâminas/Brilho']
      : STATE.element === 'fire'
      ? ['Chama Principal', 'Sombra / Tinta', 'Núcleo / Brasas']
      : ['Cor Primária', 'Cor Secundária', 'Cor Destaque'];

  elDef.options.forEach((meta, optIdx) => {
    const params = STATE.elements[STATE.element][baseCat][optIdx];
    const card = document.createElement('article');
    card.className = `option-card opt-${optIdx}`;

    card.innerHTML = `
      <div class="opt-card-header">
        <div>
          <div class="opt-card-title">${meta.name}</div>
          <div class="opt-card-ref">Inspiração: <strong>${meta.inspiration}</strong> · Editando: <em>${catLabel}</em></div>
        </div>
        <div class="opt-card-btns">
          <button type="button" class="btn-mini" data-copy-cats="${optIdx}" title="Aplicar estes sliders de ${meta.code} para todas as categorias deste elemento">⇄ Aplicar na Aba</button>
          <button type="button" class="btn-mini" data-reset-opt="${optIdx}" title="Restaurar padrão desta opção">↺ Resetar ${meta.code}</button>
        </div>
      </div>

      <div class="curve-box">
        <canvas class="curve-canvas" width="140" height="52" id="curve-cvs-${optIdx}"></canvas>
        <div class="curve-info">
          <strong>Curva de Opacidade na Duração (Ao Vivo)</strong>
          <span id="curve-summary-${optIdx}">
            Total: ${(params.opacity * 100).toFixed(0)}% · Cai de ${Math.round(params.fadeStart * 100)}% até ${Math.round(params.fadeEnd * 100)}% (Curva ${params.fadePower.toFixed(2)}×)
          </span>
        </div>
      </div>

      <div class="slider-section">
        <div class="sec-label">
          <span>1. Opacidade Total &amp; Redução durante a Duração</span>
          <span style="color:var(--accent)">Controle de Fade</span>
        </div>
        <div class="slider-grid" id="grid-opacity-${optIdx}"></div>
      </div>

      <div class="slider-section">
        <div class="sec-label">
          <span>2. Dinâmica, Escala &amp; Duração da Animação 3D</span>
          <span>Tempo Real</span>
        </div>
        <div class="slider-grid" id="grid-dynamics-${optIdx}"></div>
      </div>

      <div class="slider-section">
        <div class="sec-label">
          <span>3. Espaço, Turbulência, Pulso &amp; Cores 3D</span>
          <span>Shaders &amp; Malhas</span>
        </div>
        <div class="slider-grid" id="grid-space-${optIdx}"></div>
        <div class="color-row">
          <label class="color-cell">
            <input type="color" data-opt="${optIdx}" data-color="color" value="${params.color}">
            <span>${colorLabels[0]}</span>
          </label>
          <label class="color-cell">
            <input type="color" data-opt="${optIdx}" data-color="color2" value="${params.color2}">
            <span>${colorLabels[1]}</span>
          </label>
          <label class="color-cell">
            <input type="color" data-opt="${optIdx}" data-color="color3" value="${params.color3}">
            <span>${colorLabels[2]}</span>
          </label>
        </div>
      </div>
    `;

    deck.appendChild(card);
    curveCanvases[optIdx] = card.querySelector(`#curve-cvs-${optIdx}`);

    for (const spec of SLIDER_SPECS) {
      const targetGrid = card.querySelector(`#grid-${spec.group}-${optIdx}`);
      const item = document.createElement('div');
      item.className = `slider-item${spec.key === 'opacity' ? ' full-width' : ''}`;
      const inputId = `sl-${optIdx}-${spec.key}`;
      const val = params[spec.key];
      const formatted = formatSliderValue(spec, val);

      item.innerHTML = `
        <div class="slider-top">
          <label for="${inputId}">${spec.label}</label>
          <span class="slider-val" id="val-${inputId}">${formatted}</span>
        </div>
        <input
          type="range"
          id="${inputId}"
          min="${spec.min}"
          max="${spec.max}"
          step="${spec.step}"
          value="${val}"
          aria-valuetext="${formatted}"
          data-opt="${optIdx}"
          data-key="${spec.key}"
        />
      `;
      targetGrid.appendChild(item);

      const input = item.querySelector('input[type="range"]');
      const valSpan = item.querySelector(`#val-${inputId}`);
      syncModernRangeSlider(input);

      input.addEventListener('input', () => {
        const num = parseFloat(input.value);
        const curParams = STATE.elements[STATE.element][baseCat][optIdx];

        if (spec.key === 'fadeStart' && num >= curParams.fadeEnd - 0.02) {
          curParams.fadeEnd = clamp(num + 0.03, 0.05, 1.0);
          const feInput = document.getElementById(`sl-${optIdx}-fadeEnd`);
          if (feInput) {
            feInput.value = curParams.fadeEnd;
            syncModernRangeSlider(feInput);
            const feSpec = SLIDER_SPECS.find((s) => s.key === 'fadeEnd');
            document.getElementById(`val-sl-${optIdx}-fadeEnd`).textContent = formatSliderValue(feSpec, curParams.fadeEnd);
          }
        } else if (spec.key === 'fadeEnd' && num <= curParams.fadeStart + 0.02) {
          curParams.fadeStart = clamp(num - 0.03, 0.0, 0.95);
          const fsInput = document.getElementById(`sl-${optIdx}-fadeStart`);
          if (fsInput) {
            fsInput.value = curParams.fadeStart;
            syncModernRangeSlider(fsInput);
            const fsSpec = SLIDER_SPECS.find((s) => s.key === 'fadeStart');
            document.getElementById(`val-sl-${optIdx}-fadeStart`).textContent = formatSliderValue(fsSpec, curParams.fadeStart);
          }
        }

        curParams[spec.key] = num;
        syncModernRangeSlider(input);
        const textVal = formatSliderValue(spec, num);
        valSpan.textContent = textVal;
        input.setAttribute('aria-valuetext', textVal);

        const sumEl = document.getElementById(`curve-summary-${optIdx}`);
        if (sumEl) {
          sumEl.textContent = `Total: ${(curParams.opacity * 100).toFixed(0)}% · Cai de ${Math.round(curParams.fadeStart * 100)}% até ${Math.round(curParams.fadeEnd * 100)}% (Curva ${curParams.fadePower.toFixed(2)}×)`;
        }
        refreshExportData();
      });
    }

    card.querySelectorAll('input[type="color"]').forEach((colInput) => {
      colInput.addEventListener('input', () => {
        const key = colInput.getAttribute('data-color');
        STATE.elements[STATE.element][baseCat][optIdx][key] = colInput.value;
        refreshExportData();
      });
    });

    card.querySelector(`[data-copy-cats="${optIdx}"]`).addEventListener('click', () => {
      const src = STATE.elements[STATE.element][baseCat][optIdx];
      for (const k of Object.keys(STATE.elements[STATE.element])) {
        STATE.elements[STATE.element][k][optIdx] = { ...src };
      }
      refreshExportData();
    });

    card.querySelector(`[data-reset-opt="${optIdx}"]`).addEventListener('click', () => {
      const fresh = createDefaultState();
      STATE.elements[STATE.element][baseCat][optIdx] = fresh.elements[STATE.element][baseCat][optIdx];
      buildSlidersDeck();
      refreshExportData();
    });
  });
}

// ============================================================================
// 8. EXPORTADOR JSON & GERADOR DE PROMPT PARA IMPLEMENTAÇÃO NO JOGO
// ============================================================================

function generateExportPayload() {
  const elKey = STATE.element;
  const elDef = ELEMENT_DEFS[elKey];
  const favMap = STATE.selectedOptions[elKey];
  const selectedFavorites = {};
  const combatLabVfxPatch = {};

  for (const [catKey, optIdx] of Object.entries(favMap)) {
    const optMeta = elDef.options[optIdx];
    const params = STATE.elements[elKey][catKey][optIdx];
    selectedFavorites[catKey] = {
      optionIndex: optIdx,
      optionCode: optMeta.code,
      optionName: optMeta.name,
      inspiration: optMeta.inspiration,
      params: { ...params },
    };
    combatLabVfxPatch[`${elKey}_${catKey}`] = {
      variant: optIdx,
      ...params,
    };
  }

  return {
    schema: 'arenamon-vfx-elemental-v3',
    activeElement: elKey,
    timestamp: new Date().toISOString(),
    submode: STATE.submodeByElement[elKey],
    selectedFavorites,
    combatLabVfxPatch,
    allElementsCalibrated: STATE.elements,
  };
}

function generateImplementationPrompt(payload) {
  const elDef = ELEMENT_DEFS[payload.activeElement];
  const lines = [
    `Implemente no jogo principal (prototypes/combat-lab) os efeitos visuais 3D da aba "${elDef.label}" com exatamente as opções favoritas e os sliders calibrados abaixo (incluindo opacidade total e curva de redução de opacidade durante a duração):`,
    ``,
  ];

  let idx = 1;
  for (const [catKey, fav] of Object.entries(payload.selectedFavorites)) {
    const p = fav.params;
    lines.push(
      `${idx++}. ${catKey.toUpperCase()} (${fav.optionName} · Ref: ${fav.inspiration}):`,
      `   - Opacidade: total=${p.opacity}, fadeStart=${p.fadeStart}, fadeEnd=${p.fadeEnd}, fadePower=${p.fadePower}, endOpacity=${p.endOpacity}`,
      `   - Parâmetros 3D: intensity=${p.intensity}, size=${p.size}, duration=${p.duration}s, velocity=${p.velocity}, amount=${p.amount}, scatter=${p.scatter}, lift=${p.lift}, turbulence=${p.turbulence}, pulseFreq=${p.pulseFreq}Hz, glow=${p.glow}`,
      `   - Cores: primary=${p.color}, secondary/ink=${p.color2}, core/embers=${p.color3}`,
      ``
    );
  }

  lines.push(`JSON compatível com C.vfx (Combat Lab):`, JSON.stringify(payload.combatLabVfxPatch, null, 2));
  return lines.join('\n');
}

function refreshExportData() {
  const payload = generateExportPayload();
  const jsonEl = document.getElementById('txt-export-json');
  const promptEl = document.getElementById('txt-export-prompt');
  if (jsonEl) jsonEl.value = JSON.stringify(payload, null, 2);
  if (promptEl) promptEl.value = generateImplementationPrompt(payload);
}

// ============================================================================
// 9. EVENTOS DE NAVEGAÇÃO ENTRE ABAS ELEMENTAIS E CONTROLES GLOBAIS
// ============================================================================

function updateFavoriteButtonsUI() {
  const baseCat = getActiveBaseCategory();
  const fav = STATE.selectedOptions[STATE.element][baseCat];
  document.querySelectorAll('[data-pick]').forEach((btn) => {
    const idx = parseInt(btn.getAttribute('data-pick'), 10);
    if (idx === fav) {
      btn.classList.add('selected');
      btn.textContent = '★ Favorita na Categoria';
    } else {
      btn.classList.remove('selected');
      btn.textContent = '☆ Marcar Favorita';
    }
  });
}

function updateViewportOverlaysUI() {
  const container = document.getElementById('viewport-overlays');
  const overlays = container.querySelectorAll('.vp-Overlay');
  if (STATE.viewMode === 'triple') {
    container.classList.remove('single-mode');
    overlays.forEach((ov) => (ov.style.display = 'flex'));
    document.querySelectorAll('[data-focus]').forEach((b, i) => {
      b.textContent = `🔍 Expandir ${['A', 'B', 'C'][i]}`;
    });
  } else {
    const focusIdx = parseInt(STATE.viewMode.split('-')[1], 10);
    container.classList.add('single-mode');
    overlays.forEach((ov, i) => {
      ov.style.display = i === focusIdx ? 'flex' : 'none';
    });
    document.querySelectorAll('[data-focus]').forEach((b) => {
      b.textContent = '⚖️ Voltar p/ 3 Opções';
    });
  }
}

document.querySelectorAll('.el-pill[data-el]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const el = btn.getAttribute('data-el');
    if (!ELEMENT_DEFS[el]) return;
    STATE.element = el;
    simTime = 0;
    renderElementChrome();
    buildSlidersDeck();
    updateFavoriteButtonsUI();
    refreshExportData();
  });
});

document.querySelectorAll('[data-pick]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const idx = parseInt(btn.getAttribute('data-pick'), 10);
    const baseCat = getActiveBaseCategory();
    STATE.selectedOptions[STATE.element][baseCat] = idx;
    updateFavoriteButtonsUI();
    refreshExportData();
  });
});

document.querySelectorAll('[data-focus]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const idx = parseInt(btn.getAttribute('data-focus'), 10);
    const selView = document.getElementById('sel-view');
    STATE.viewMode = STATE.viewMode === `focus-${idx}` ? 'triple' : `focus-${idx}`;
    selView.value = STATE.viewMode;
    updateViewportOverlaysUI();
  });
});

document.getElementById('sel-view').addEventListener('change', (e) => {
  STATE.viewMode = e.target.value;
  updateViewportOverlaysUI();
});

document.getElementById('sel-submode').addEventListener('change', (e) => {
  STATE.submodeByElement[STATE.element] = e.target.value;
  refreshExportData();
});

document.getElementById('sel-cam').addEventListener('change', (e) => {
  STATE.cameraPreset = e.target.value;
  applyCameraPreset(STATE.cameraPreset);
});

document.getElementById('btn-toggle-dummies').addEventListener('click', (e) => {
  STATE.showDummies = !STATE.showDummies;
  e.currentTarget.textContent = `🧍 Lutadores: ${STATE.showDummies ? 'ON' : 'OFF'}`;
});

const btnPlayPause = document.getElementById('btn-play-pause');
btnPlayPause.addEventListener('click', () => {
  STATE.playing = !STATE.playing;
  btnPlayPause.textContent = STATE.playing ? '⏸️ Pausar' : '▶️ Reproduzir';
});

document.getElementById('btn-restart').addEventListener('click', () => {
  simTime = 0;
});

const scrubInput = document.getElementById('global-scrub');
syncModernRangeSlider(scrubInput);
scrubInput.addEventListener('input', () => {
  STATE.playing = false;
  btnPlayPause.textContent = '▶️ Reproduzir';
  const u = parseFloat(scrubInput.value);
  const baseCat = getActiveBaseCategory();
  const refDur = STATE.elements[STATE.element][baseCat][0].duration;
  simTime = u * refDur;
  syncModernRangeSlider(scrubInput);
});

const speedInput = document.getElementById('global-speed');
syncModernRangeSlider(speedInput);
speedInput.addEventListener('input', () => {
  STATE.globalSpeed = parseFloat(speedInput.value);
  document.getElementById('global-speed-val').textContent = `${STATE.globalSpeed.toFixed(2)}×`;
  syncModernRangeSlider(speedInput);
});

// Modal Exportador JSON & Prompt
const exportModal = document.getElementById('export-modal');
const exportStatus = document.getElementById('export-status');

document.getElementById('btn-open-export').addEventListener('click', () => {
  refreshExportData();
  exportModal.classList.add('open');
});
document.getElementById('btn-close-export').addEventListener('click', () => {
  exportModal.classList.remove('open');
});
exportModal.addEventListener('click', (e) => {
  if (e.target === exportModal) exportModal.classList.remove('open');
});

document.getElementById('btn-copy-json').addEventListener('click', async () => {
  const txt = document.getElementById('txt-export-json').value;
  try {
    await navigator.clipboard.writeText(txt);
    exportStatus.textContent = '✓ JSON copiado para a área de transferência!';
  } catch {
    document.getElementById('txt-export-json').select();
    exportStatus.textContent = '✓ JSON selecionado (pressione Ctrl+C).';
  }
});

document.getElementById('btn-copy-prompt').addEventListener('click', async () => {
  const txt = document.getElementById('txt-export-prompt').value;
  try {
    await navigator.clipboard.writeText(txt);
    exportStatus.textContent = '🚀 Prompt de implementação + JSON copiados!';
  } catch {
    document.getElementById('txt-export-prompt').select();
    exportStatus.textContent = '✓ Prompt selecionado (pressione Ctrl+C).';
  }
});

document.getElementById('btn-download-json').addEventListener('click', () => {
  const txt = document.getElementById('txt-export-json').value;
  const blob = new Blob([txt], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `arenamon-vfx-${STATE.element}-${STATE.activeCategory}.json`;
  a.click();
  URL.revokeObjectURL(url);
  exportStatus.textContent = '💾 Arquivo JSON baixado com sucesso!';
});

document.getElementById('btn-import-json').addEventListener('click', () => {
  const raw = prompt('Cole abaixo o JSON exportado anteriormente para carregar os sliders:');
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    if (parsed.allElementsCalibrated) {
      STATE.elements = parsed.allElementsCalibrated;
      buildSlidersDeck();
      refreshExportData();
      exportStatus.textContent = '📂 Configuração JSON importada e aplicada!';
    }
  } catch {
    exportStatus.textContent = '✖ JSON inválido: verifique o formato.';
  }
});

document.getElementById('btn-reset-all').addEventListener('click', () => {
  const fresh = createDefaultState();
  STATE.elements = fresh.elements;
  STATE.selectedOptions = fresh.selectedOptions;
  buildSlidersDeck();
  updateFavoriteButtonsUI();
  refreshExportData();
  exportStatus.textContent = '↺ Todos os sliders foram restaurados para os padrões de fábrica.';
});

// ============================================================================
// 10. LOOP DE ANIMAÇÃO 3D EM TEMPO REAL (60 FPS · MULTI-VIEWPORT)
// ============================================================================

let simTime = 0;
let lastFrameMs = performance.now();

function renderLoop(nowMs) {
  requestAnimationFrame(renderLoop);

  const dtRaw = Math.min(0.05, (nowMs - lastFrameMs) / 1000);
  lastFrameMs = nowMs;

  if (STATE.playing) {
    simTime += dtRaw * STATE.globalSpeed;
  }

  if (STATE.cameraPreset === 'orbit' && !isDragging) {
    camYaw += dtRaw * 0.45;
  }

  const stageWrap = document.getElementById('stage-wrapper');
  const rect = stageWrap.getBoundingClientRect();
  const width = Math.max(1, Math.floor(rect.width));
  const height = Math.max(1, Math.floor(rect.height));

  if (canvas.width !== Math.floor(width * renderer.getPixelRatio()) || canvas.height !== Math.floor(height * renderer.getPixelRatio())) {
    renderer.setSize(width, height, false);
  }

  const cx = Math.sin(camYaw) * Math.cos(camPitch) * camDist;
  const cy = Math.sin(camPitch) * camDist + 0.9;
  const cz = Math.cos(camYaw) * Math.cos(camPitch) * camDist;
  camera.position.set(cx, cy, cz);
  camera.lookAt(0, 1.05, 0);

  const elKey = STATE.element;
  const catKey = STATE.activeCategory;
  const baseCat = getActiveBaseCategory();

  for (let i = 0; i < 3; i++) {
    const dur = Math.max(0.25, STATE.elements[elKey][baseCat][i].duration || 1.8) * (catKey === 'sequence' ? 1.55 : 1.0);
    const u = (((simTime % dur) + dur) % dur) / dur;
    stages[i].update(elKey, catKey, u, simTime);
    drawOpacityCurve(i, u);

    const statEl = document.getElementById(`stat-${i}`);
    if (statEl) statEl.textContent = `Malhas 3D: ${stages[i].activeMeshCount} · Ciclo: ${(u * 100).toFixed(0)}%`;
    const alphaBar = document.getElementById(`alpha-bar-${i}`);
    const alphaTxt = document.getElementById(`alpha-txt-${i}`);
    if (alphaBar) alphaBar.style.width = `${Math.round(stages[i].lastAlpha * 100)}%`;
    if (alphaTxt) alphaTxt.textContent = stages[i].lastAlpha.toFixed(2);

    if (i === 0 && STATE.playing) {
      scrubInput.value = u.toFixed(3);
      syncModernRangeSlider(scrubInput);
      document.getElementById('scrubber-time').textContent = `Ciclo A: ${(u * dur).toFixed(2)}s / ${dur.toFixed(2)}s`;
    }
  }

  if (STATE.viewMode === 'triple') {
    const vpW = Math.floor(width / 3);
    for (let i = 0; i < 3; i++) {
      const x = i * vpW;
      const w = i === 2 ? width - x : vpW;
      camera.aspect = w / height;
      camera.updateProjectionMatrix();
      renderer.setViewport(x, 0, w, height);
      renderer.setScissor(x, 0, w, height);
      renderer.render(stages[i].scene, camera);
    }
  } else {
    const focusIdx = parseInt(STATE.viewMode.split('-')[1], 10) || 0;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setViewport(0, 0, width, height);
    renderer.setScissor(0, 0, width, height);
    renderer.render(stages[focusIdx].scene, camera);
  }
}

renderElementChrome();
buildSlidersDeck();
updateFavoriteButtonsUI();
updateViewportOverlaysUI();
refreshExportData();
requestAnimationFrame(renderLoop);

window.__ARENAMON_VFX_ELEMENTAL__ = {
  STATE,
  stages,
  computeDurationOpacity,
  generateExportPayload,
  generateImplementationPrompt,
};
