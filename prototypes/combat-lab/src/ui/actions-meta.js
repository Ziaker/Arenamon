// Metadados dos parâmetros independentes de C (actions.dodge), X (actions.tackle) e do cancelamento C → X
// (actions.cancel): rótulos, explicações, faixas, correspondência com o jogo oficial e migração dos JSONs antigos.
const DEG = Math.PI / 180;
const sec = n => n.toFixed(2) + ' s', onOff = n => n ? 'Sim' : 'Não';
const WHO = {dodge: 'da esquiva C', tackle: 'do tackle X'};

/** [rótulo, explicação (função da ação), faixa] por chave. */
const COMMON = {
  duration: ['Duração', w => `Duração total ${w}, em segundos. Só esta ação é afetada.`, {min: .05, max: 4, step: .01, fmt: sec}],
  cost: ['Custo de stamina', w => `Stamina cobrada ao iniciar a ação ${w.replace('da ', '').replace('do ', '')}. Sem stamina suficiente, a ação não começa.`, {min: 0, max: 3, step: .05, fmt: n => n.toFixed(2)}],
  invulnerable: ['Invulnerabilidade inicial', w => `Tempo, desde o início ${w}, em que a ação ignora tackles (se a invulnerabilidade estiver ligada em Sistemas).`, {min: 0, max: 1, step: .01, fmt: sec}],
  distance: ['Distância (× duração × velocidade)', w => `Distância nominal ${w} = este multiplicador × duração × velocidade do lutador (GDD 7.2: 2,5). A velocidade média resulta de distância ÷ duração.`, {min: 0, max: 6, step: .05, fmt: n => n.toFixed(2) + '×'}],
  curveStart: ['Impulso inicial da curva', w => `Velocidade inicial relativa ${w}: p(u) = a·u + (3−2a)·u² + (a−2)·u³, sempre terminando sem velocidade residual. 1 = uniforme; 1,6 = v6 (70% da distância na 1ª metade); 3 = arrancada máxima.`, {min: 1, max: 3, step: .05, fmt: n => n.toFixed(2)}],
  steerLimit: ['Limite de correção de trajetória', w => `Quanto a trajetória ${w} pode girar em relação à direção inicial (GDD: ±30°).`, {min: 0, max: Math.PI, step: DEG, fmt: n => (n / DEG).toFixed(0) + '°'}],
  steerRate: ['Velocidade da correção', w => `Rotação máxima da trajetória ${w} por segundo (GDD: 180°/s).`, {min: 0, max: 8 * Math.PI, step: DEG, fmt: n => (n / DEG).toFixed(0) + '°/s'}],
  blend: ['Transição de velocidade ao iniciar', w => `Tempo da mistura suave (Smoothstep) entre a velocidade anterior e a ${w.replace('da ', '').replace('do ', '')} quando ela interrompe outra ação.`, {min: 0, max: .5, step: .01, fmt: sec}],
  chainAfter: ['Encadear outra ação após', w => `A partir deste tempo ${w}, a defesa ou uma nova ação (exceto C → X, que tem janela própria) podem interrompê-la (GDD 7.3/7.4: 200 ms).`, {min: 0, max: 1, step: .01, fmt: sec}],
  recovery: ['Recuperação ao terminar', w => `Tempo sem controle depois que a ação ${w.replace('da ', '').replace('do ', '')} termina (0 = nenhum).`, {min: 0, max: 1, step: .01, fmt: sec}],
  fromGuard: ['Pode sair direto da defesa', w => `Permite iniciar a ação ${w.replace('da ', '').replace('do ', '')} enquanto D está pressionado (cancela a defesa; GDD 3.4).`, {min: 0, max: 1, step: 1, fmt: onOff}],
  fromRecoil: ['Pode sair do recuo', w => `Permite iniciar a ação ${w.replace('da ', '').replace('do ', '')} durante o recuo de um tackle bloqueado. GDD 8.2: esquiva sim, ataque não.`, {min: 0, max: 1, step: 1, fmt: onOff}],
  fromGuardStun: ['Pode sair do guard stun', w => `Permite iniciar a ação ${w.replace('da ', '').replace('do ', '')} durante o guard stun. No tackle, “Não” guarda o último pedido e o executa quando o stun termina (GDD 5).`, {min: 0, max: 1, step: 1, fmt: onOff}],
};
const DODGE = {
  vaultHeight: ['Altura do salto', () => 'Altura máxima do arco da esquiva quando ela atravessa o adversário. Não causa dano.', {min: 0, max: 5, step: .05, fmt: n => n.toFixed(2) + ' m'}],
  vaultReachBonus: ['Alcance extra para saltar', () => 'Margem somada à distância da esquiva para reconhecer um adversário alcançável no caminho.', {min: 0, max: 3, step: .05, fmt: n => n.toFixed(2) + ' m'}],
  vaultForwardMin: ['Distância mínima do rival para saltar', () => 'O rival precisa estar pelo menos esta distância à frente da trajetória para haver salto.', {min: 0, max: 2, step: .05, fmt: n => n.toFixed(2) + ' m'}],
  vaultLateralWidth: ['Largura do caminho para saltar', () => 'Desvio lateral máximo entre o rival e a trajetória para que a esquiva salte sobre ele.', {min: 0, max: 3, step: .05, fmt: n => n.toFixed(2) + ' m'}],
  perfectEvadeStamina: ['Stamina da esquiva perfeita', () => 'Stamina devolvida quando a esquiva C evita um tackle durante a invulnerabilidade (uma vez por tackle).', {min: 0, max: 3, step: .05, fmt: n => n.toFixed(2)}],
  counterWindow: ['Janela de contra-ataque', () => 'Tempo, após uma esquiva perfeita, para executar um X fortalecido.', {min: 0, max: 2, step: .01, fmt: sec}],
};
const TACKLE = {
  counterSpeed: ['Multiplicador do X de contra-ataque', () => 'Velocidade e alcance do primeiro X feito dentro da janela de contra-ataque (esquiva perfeita ou defesa perfeita).', {min: 1, max: 2, step: .01, fmt: n => n.toFixed(2) + '×'}],
};
const CANCEL = {
  dodgeToTackle: ['Permitir C → X', 'Permite transformar a esquiva em tackle durante a janela abaixo. O custo de C continua gasto e X cobra o próprio custo.', {min: 0, max: 1, step: 1, fmt: onOff}],
  windowStart: ['Início da janela', 'Tempo de C a partir do qual X pode interromper a esquiva (0 = desde o primeiro passo, inclusive durante a invulnerabilidade).', {min: 0, max: 1, step: .01, fmt: sec}],
  windowEnd: ['Fim da janela', 'Último tempo de C em que X ainda pode interromper a esquiva.', {min: 0, max: 4, step: .01, fmt: sec}],
  transition: ['Transição de velocidade', 'Tempo da mistura suave entre a velocidade da esquiva e a do tackle no cancelamento (evita picos e descontinuidades).', {min: 0, max: .5, step: .01, fmt: sec}],
  velocityInfluence: ['Influência da velocidade de C', 'Fração da velocidade da esquiva usada como ponto de partida da transição (1 = continuidade total, padrão; valores menores fazem o X começar mais lento, com perda brusca de velocidade no passo do cancelamento).', {min: 0, max: 1, step: .05, fmt: n => (n * 100).toFixed(0) + '%'}],
  airDescent: ['Descida no cancelamento aéreo', 'Durante o salto de C, X começa na altura atual e desce suavemente até o chão neste tempo (sem teletransporte). Acima da altura de atravessamento não há contato.', {min: 0, max: 1, step: .01, fmt: sec}],
  invulnerability: ['Invulnerabilidade de X no cancelamento', 'Padrão: só o tempo que restava da invulnerabilidade de C (sem janela nova). Alternativas para comparação: nenhuma, ou a janela completa de X.', {min: 0, max: 2, step: 1, fmt: n => ['Resto de C', 'Nenhuma', 'Janela completa de X'][n] ?? '?'}],
};

const BUFFER = {
  window: ['Janela do buffer de entrada', 'X ou C apertados até este tempo antes de serem permitidos (fim do encadeamento, abertura da janela C → X, fim do recuo ou da aterrissagem) ficam guardados e saem no primeiro passo permitido. Vale o pedido mais recente; um toque em D descarta. 0 = desligado (v6).', {min: 0, max: .3, step: .01, fmt: n => n ? (n * 1000).toFixed(0) + ' ms' : 'Desligado'}],
};

/** Rótulo, explicação e faixa de um caminho actions.* (ou null). */
export function actionMeta(path) {
  const [root, kind, key] = path.split('.');if (root !== 'actions') return null;
  if (kind === 'buffer') {const m = BUFFER[key];return m && {label: m[0], help: m[1], range: {...m[2]}};}
  if (kind === 'cancel') {const m = CANCEL[key];return m && {label: m[0], help: m[1], range: {...m[2]}};}
  const m = COMMON[key] || (kind === 'dodge' ? DODGE : TACKLE)[key];if (!m) return null;
  return {label: `${m[0]} · ${kind === 'dodge' ? 'C' : 'X'}`, help: m[1](WHO[kind]), range: {...m[2]}};
}

/**
 * Correspondência com o jogo oficial (prototypes/game/src/config.ts). No jogo, o tackle ainda é propriedade da
 * esquiva frontal (GDD v0.1), então X e C são comparados aos mesmos valores da esquiva do jogo.
 */
export const OFFICIAL_MAP = {
  'actions.dodge.duration': 'rules.dodge', 'actions.tackle.duration': 'rules.dodge',
  'actions.dodge.invulnerable': 'rules.invulnerable', 'actions.tackle.invulnerable': 'rules.invulnerable',
  'actions.dodge.chainAfter': 'rules.invulnerable', 'actions.tackle.chainAfter': 'rules.invulnerable',
  'actions.dodge.steerLimit': 'rules.steerLimit', 'actions.tackle.steerLimit': 'rules.steerLimit',
  'actions.dodge.steerRate': 'rules.steerRate', 'actions.tackle.steerRate': 'rules.steerRate',
  'actions.dodge.blend': 'rules.blend', 'actions.tackle.blend': 'rules.blend',
};

// ---------- Migração de JSONs antigos (v5, v6 e v7) ----------
/** Campos antigos → novos. Campos que eram compartilhados por X e C são copiados para os dois. */
export const LEGACY_MAP = {
  'rules.dodge': ['actions.dodge.duration', 'actions.tackle.duration'],
  'rules.tackleDuration': ['actions.tackle.duration'],
  'rules.invulnerable': ['actions.dodge.invulnerable', 'actions.tackle.invulnerable', 'actions.dodge.chainAfter', 'actions.tackle.chainAfter'],
  'rules.steerLimit': ['actions.dodge.steerLimit', 'actions.tackle.steerLimit'],
  'rules.steerRate': ['actions.dodge.steerRate', 'actions.tackle.steerRate'],
  'rules.dodgeVaultHeight': ['actions.dodge.vaultHeight'],
  'extras.combat.actionCost': ['actions.dodge.cost', 'actions.tackle.cost'],
  'extras.combat.vaultReachBonus': ['actions.dodge.vaultReachBonus'],
  'extras.combat.vaultForwardMin': ['actions.dodge.vaultForwardMin'],
  'extras.combat.vaultLateralWidth': ['actions.dodge.vaultLateralWidth'],
  'extras.combat.perfectEvadeStamina': ['actions.dodge.perfectEvadeStamina'],
  'extras.combat.counterWindow': ['actions.dodge.counterWindow'],
  'extras.combat.counterSpeed': ['actions.tackle.counterSpeed'],
};
/** No v6, rules.blend também era a transição ao iniciar X/C (além da dissipação da defesa). */
const ALSO_COPY = {'rules.blend': ['actions.dodge.blend', 'actions.tackle.blend']};

/** Achata um objeto em {caminho: número}. */
export function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj || {})) {
    const p = prefix ? prefix + '.' + k : k;
    if (typeof v === 'number') out[p] = v;
    else if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, p, out);
  }
  return out;
}
/**
 * Converte um mapa {caminho: valor} antigo para o formato atual.
 * known: conjunto de caminhos do ajustador atual. Devolve {values, converted, ignored} (nada é descartado em silêncio).
 */
export function migrateFlat(flat, known) {
  const values = {}, converted = [], ignored = [];
  const legacyDurationTackle = 'rules.tackleDuration' in flat;
  for (const [path, v] of Object.entries(flat)) {
    if (LEGACY_MAP[path]) {
      for (const to of LEGACY_MAP[path]) {
        if (path === 'rules.dodge' && to === 'actions.tackle.duration' && legacyDurationTackle) continue; // v7 já trazia a duração própria do tackle
        if (!(to in flat)) {values[to] = v;converted.push({from: path, to, value: v});}
      }
      continue;
    }
    if (ALSO_COPY[path]) for (const to of ALSO_COPY[path]) if (!(to in flat)) {values[to] = v;converted.push({from: path, to, value: v});}
    if (known.has(path)) values[path] = v;
    else ignored.push({path, value: v});
  }
  return {values, converted, ignored};
}
