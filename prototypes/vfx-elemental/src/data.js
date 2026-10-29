// ============================================================================
// 1. METADADOS POR ABA ELEMENTAL (PSÍQUICO, VOADOR E FOGO) E SLIDERS
// ============================================================================

export const ELEMENT_DEFS = {
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

export const SLIDER_SPECS = [
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

export function createDefaultState() {
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

export const STATE = createDefaultState();
