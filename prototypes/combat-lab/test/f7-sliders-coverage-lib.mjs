// @ts-nocheck
// F7 (Task 15): matriz de cobertura dos sliders do Editor — TODO slider sai das definições reais (manifesto do Ajustes em ui/tuning.js
// `tuningManifest()` e fichas dos Moves em sim/moves/*.params.js pelo registro), nunca de lista à mão. Para cada um: caminho em C, rótulo,
// unidade/formato, faixa, padrão dentro da faixa, round-trip JSON (exportar→importar pelo caminho real do Ajustes e dos presets), consumidor
// real por busca estática em src/sim|src/view|src/app|src/nav (fora dos arquivos de definição) e, para os de gameplay, A/B (mín × máx) num
// cenário curto e determinístico. Usado por test/f7-sliders-coverage.test.mjs (asserções) e scripts/gen-matriz-sliders.mjs (docs/MATRIZ_SLIDERS_F7.md).
import {readdirSync, readFileSync, statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {C, resetConfig, defaults, ROOT_KEYS} from '../src/sim/config.js';
import {baseAnterior} from './base-anterior.mjs';
import {Game} from '../src/sim/game.js';
import {emptyCommand} from '../src/sim/entity.js';
import {registerStandardMoves} from '../src/sim/moves/standard.js';
import {moveParamGroups, classifyParamRow, inferParamConsumer, PARAM_UNITS} from '../src/sim/moves/params-registry.js';
import {MOVES_PARAMS, isVisualWorldParam, DEPENDS_ON} from '../src/ui/moves-panel.js';
import {EDITABLE_MOVES} from '../src/editor/editable-moves.js';
import {traceMove, compareTraces, defaultValues} from '../src/editor/move-trace.js';
import {migrateLegacyPreset, presetValues} from '../src/sim/presets.js';
import {flatten} from '../src/ui/actions-meta.js';
import {vec} from '../src/sim/math.js';
import {launch} from '../src/sim/combat.js';
import {setupNavScenario} from '../src/nav/nav-scenarios.js';
import {PASSIVES} from '../src/sim/passives.js';

registerStandardMoves();
export const LAB = fileURLToPath(new URL('..', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
export const REPO = LAB.replace(/\/prototypes\/combat-lab$/, '');
export const DOC_PATH = `${REPO}/docs/MATRIZ_SLIDERS_F7.md`;

// ---------- definições reais ----------
/** ui/tuning.js importa o config.ts do jogo (só comparação): o esbuild resolve como no build do laboratório. Devolve o módulo empacotado. */
let bundled = null;
export async function tuningModule() {
  if (bundled) return bundled;
  const out = await build({stdin: {contents: "export {tuningManifest, previewTuningImport} from './src/ui/tuning.js';", resolveDir: LAB, loader: 'js'}, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'error'});
  bundled = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'));
  return bundled;
}

/** Unidade lida do PRÓPRIO formato do slider (o texto que o painel mostra), sem os números. */
export function unitOf(fmt, value, kind, range = null) {
  if (kind === 'toggle') return 'liga/desliga';
  if (kind === 'select') return 'seletor';
  if (kind === 'color') return 'cor';
  // 0/1 de passo 1 cujo formato só tem texto: Sim/Não ou Ligado/Desligado = interruptor; outros dois rótulos = seletor de duas opções.
  if (range && range.min === 0 && range.max === 1 && range.step === 1) {
    const a = String(fmt(0)), b = String(fmt(1));
    if (!/\d/.test(a + b)) return /^(sim|não|nao|ligado|desligado)$/i.test(a.trim()) && /^(sim|não|nao|ligado|desligado)$/i.test(b.trim()) ? 'liga/desliga' : 'seletor';
  }
  const t = String(fmt(value)).replace(/[-+−]?\d+(?:[.,]\d+)?(?:e[-+]?\d+)?/gi, '').replace(/\s+/g, ' ').trim();
  return t || '—';
}
const MOVE_UNIT_TEXT = {num: 'número', int: 'inteiro', sec: 's', pct: '%', m: 'm', ms: 'm/s', ms2: 'm/s²', deg: '°', x: '×', yesno: 'liga/desliga'};

/** Grupos compartilhados da aba Moves (sem ficha no registro): o arquivo do motor que os lê. */
const SHARED_GROUP_CONSUMER = Object.freeze({charge: 'src/sim/charge.js', ai: 'src/sim/ai-moves.js'});
/** Todos os sliders: [{id, source:'ajustes'|'move', section, path, key, group, label, unit, min, max, step, value, fmt}]. */
export async function allSliders() {
  const {tuningManifest} = await tuningModule();
  const out = [];
  for (const m of tuningManifest()) out.push({id: m.path, source: 'ajustes', section: m.section, path: m.path, key: m.key, group: m.path.split('.').slice(0, -1).join('.'), label: m.label, unit: unitOf(m.fmt, m.initial, m.kind, m), min: m.min, max: m.max, step: m.step, value: m.initial, fmt: m.fmt, kind: m.kind ?? 'range', help: m.help});
  // Aba Moves e Editor de Moves: MOVES_PARAMS (ui/moves-panel.js) = carga/IA/laser compartilhados + todas as fichas do registro, já com a faixa efetiva.
  // O padrão é o de defaults() (fábrica + calibração do usuário em sim/calibration-base.js), o mesmo que «restaurar» aplica.
  const base = defaults(), rowsOf = new Map(moveParamGroups().map(g => [g.group, new Map(g.rows.map(r => [r.key, r]))]));
  for (const [title, rows] of MOVES_PARAMS) for (const t of rows) {
    const [group, key, label, tip, min, max, step, fmt] = t, raw = rowsOf.get(group)?.get(key), path = `world.${group}.${key}`;
    const r = raw ? classifyParamRow(group, raw) : null, value = pathGet(base, path), toggle = fmt?.name === 'yesno' || raw?.unit === 'yesno';
    out.push({id: path, source: 'move', section: `Moves · ${title}`, path, key, group: `world.${group}`, moveGroup: group, label, unit: raw ? MOVE_UNIT_TEXT[raw.unit] ?? raw.unit : unitOf(fmt, value), rawUnit: raw?.unit ?? null,
      min, max, step, value, factory: raw?.value, fmt, kind: toggle ? 'toggle' : 'range', help: tip, declaredConsumer: SHARED_GROUP_CONSUMER[group] ?? (r?.consumer ?? inferParamConsumer(group, key)).file});
  }
  return out;
}

// ---------- validação estática de cada slider ----------
const pathGet = (o, p) => p.split('.').reduce((a, k) => a?.[k], o);
/** Problemas de definição (vazio = ok): caminho em C, rótulo, unidade/formato, faixa, padrão. */
export function definitionProblems(s, base = defaults()) {
  const p = [];
  const v = pathGet(base, s.path);
  if (typeof v !== 'number' || !Number.isFinite(v)) p.push(`caminho ${s.path} não é número em C`);
  if (!s.label || !String(s.label).trim() || s.label === s.key) p.push('sem rótulo próprio');
  if (s.source === 'move' && s.rawUnit !== null && !PARAM_UNITS.includes(s.rawUnit)) p.push(`unidade desconhecida ${s.rawUnit}`);
  if (s.fmt) for (const x of [s.min, s.value, s.max]) {const t = String(s.fmt(x));if (!t || /NaN|undefined/.test(t)) p.push(`formato inválido em ${x}: «${t}»`);}
  if (![s.min, s.max, s.step, s.value].every(Number.isFinite)) p.push('min/max/step/padrão não numéricos');
  if (!(s.step > 0)) p.push('step ≤ 0');
  if (!(s.min < s.max)) p.push(`faixa vazia ${s.min}..${s.max}`);
  if (s.value < s.min - 1e-9 || s.value > s.max + 1e-9) p.push(`padrão ${s.value} fora de ${s.min}..${s.max}`);
  if (typeof v === 'number' && Math.abs(v - s.value) > 1e-9) p.push(`padrão do slider ${s.value} ≠ C ${v}`);
  return p;
}
/** Valor de teste do round-trip: o extremo mais distante do padrão (≠ padrão), no passo do slider. */
export const probeValue = s => Math.abs(s.max - s.value) >= Math.abs(s.value - s.min) ? s.max : s.min;

/** Round-trip pelo caminho REAL: JSON exportado (formato de exportData) → previewTuningImport; e preset salvo → migrateLegacyPreset → presetValues. */
export async function roundTripProblems(sliders) {
  const {tuningManifest, previewTuningImport} = await tuningModule();
  const manifest = tuningManifest(), base = defaults(), problems = [];
  const known = new Set([...manifest.map(m => m.path), ...Object.keys(flatten(Object.fromEntries(ROOT_KEYS.map(k => [k, base[k]]))))]);
  // Um JSON com TODOS os sliders no valor de teste ao mesmo tempo (como um arquivo exportado depois de mexer em tudo).
  const exported = structuredClone(Object.fromEntries(ROOT_KEYS.map(k => [k, base[k]])));
  const want = new Map();
  for (const s of sliders) {const v = probeValue(s);const keys = s.path.split('.'), last = keys.pop(), obj = keys.reduce((a, k) => a?.[k], exported);if (obj && last in obj) {obj[last] = v;want.set(s.path, v);}}
  const raw = JSON.stringify({schema: 'arenamon-tuning', version: 9, values: exported});
  const res = previewTuningImport(raw, manifest, defaults(), base);
  if (res.error) return [`importação recusou o JSON: ${res.error}`];
  const got = new Map(res.changes);
  for (const [path, v] of want) if (!got.has(path) || Math.abs(got.get(path) - v) > 1e-9) problems.push(`${path}: exportado ${v}, importado ${got.get(path)}`);
  // Preset do usuário (sim/presets.js): salvar → JSON → migrar → valores efetivos.
  const preset = JSON.parse(JSON.stringify(migrateLegacyPreset({name: 'f7', savedAt: 0, values: Object.fromEntries(want)})));
  const pv = presetValues(preset, known);
  for (const [path, v] of want) if (Math.abs(pv[path] - v) > 1e-9) problems.push(`${path}: preset salvo ${v}, preset lido ${pv[path]}`);
  return problems;
}

// ---------- consumidor real (busca estática) ----------
/** Arquivos que DEFINEM sliders, padrões, presets ou auditorias (não contam como consumidor): config, registro e fichas, metadados e painéis que só
 * montam controles, o Editor de Moves (interface de edição) e as auditorias estáticas. HUD, entrada, view e aplicação (tuning-sync) CONTAM. */
export const DEFINITION_FILE = /(^src\/sim\/config\.js$|^src\/sim\/moves\/params-registry\.js$|\.params\.js$|\.generated\.js$|^src\/editor\/|^src\/physics-poc\/|^src\/sim\/scenarios[\w-]*\.js$|^src\/sim\/ai-eval\/|^src\/sim\/(presets|calibration-base|telemetry|combat-windows-report|move-contracts)\.js$|^src\/sim\/moves\/(move-mechanics-audit|pilot-coverage)\.js$|^src\/ui\/(tuning|tuning-meta|tuning-io|overhaul-meta|actions-meta|organize|official|quick-panel|presets-panel|moves-panel|moves-vfx-panel|elemental-move-controls|elemental-visual-model|move-spec-model|move-spec-panel|visual-panel|actions-drawer|workspace-panel|project-files)\.js$)/;
const SCAN_DIRS = ['src'];
let sourceCache = null;
export function sources() {
  if (sourceCache) return sourceCache;
  const files = [];
  const walk = d => {for (const n of readdirSync(`${LAB}/${d}`)) {const rel = `${d}/${n}`;if (statSync(`${LAB}/${rel}`).isDirectory()) walk(rel);else if (/\.(js|ts|mjs)$/.test(n) && !DEFINITION_FILE.test(rel)) {const text = readFileSync(`${LAB}/${rel}`, 'utf8'), lines = text.split('\n');files.push({file: rel, text, lines, comment: lines.map(l => /^\s*(\/\/|\*|\/\*)/.test(l))});}}};
  for (const d of SCAN_DIRS) walk(d);
  return (sourceCache = files);
}
/** Famílias lidas com chave MONTADA em tempo de execução (a busca literal não vê): cores por canal via rgb('base') e teclas via keyFor('nome')/key('nome'). */
export const DYNAMIC_FAMILIES = Object.freeze([
  {match: /^extras\.colors\.(.+)[RGB]$/, token: m => m[1], why: 'canal RGB lido por rgb(base) / ratio(base, canal) de sim/config.js: a chave é base + R|G|B'},
  {match: /^extras\.bindings2?\.(.+)$/, token: m => m[1], why: 'tecla lida por keyFor(nome) / keyFor2(nome) (ui/input.js, main.js): o nome do comando chega como texto'},
]);
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Linha (1-based) da primeira leitura de `key` (propriedade, desestruturação ou chave entre aspas) no arquivo, ou 0. */
const READ_RE = new Map();
function firstRead(lines, key, sameLine = null, f = null) {
  if (f && !f.text.includes(key)) return 0;
  let re = READ_RE.get(key);
  if (!re) READ_RE.set(key, re = new RegExp(`(\\.${esc(key)}\\b|\\[['"\`]${esc(key)}['"\`]\\]|[{,]\\s*${esc(key)}\\s*[,}:=]|['"\`]${esc(key)}['"\`])`));
  let first = 0;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];if ((f ? f.comment[i] : /^\s*(\/\/|\*|\/\*)/.test(l)) || !re.test(l)) continue;
    if (!sameLine || sameLine(l)) return i + 1;   // preferência: a linha que lê a chave E cita o grupo (C.rules.x, world.beam.x)
    first ||= i + 1;
  }
  return first;
}
/** O arquivo «amarra» o grupo do slider? Vale: o caminho completo do pai (C.display.windows, display?.windows, world.sandWave, world['sandWave']);
 * ou a raiz como caminho (vfx[, C.vfx.) + o último segmento do pai como texto ('hit'); ou, num Move, o id/grupo como texto. «.map(» e «.test(» não contam. */
function binders(s) {
  const parts = s.path.split('.'), parentParts = parts.slice(0, -1), root = parts[0], last = parentParts.at(-1);
  const full = new RegExp('\\b' + parentParts.map(esc).join(`(\\?\\.|\\.|\\[['"\`])`) + (parentParts.length === 1 ? `\\b(\\?\\.|\\.|\\[)` : `\\b`));
  const lit = t => new RegExp(`['"\`]${esc(t)}['"\`]`), rootPath = new RegExp(`\\b${esc(root)}(\\?\\.|\\.|\\[)`);
  const out = [l => full.test(l)];
  if (parentParts.length > 1) {const re = lit(last);const b = (l, f) => re.test(l) && f.lines.some(x => rootPath.test(x));b.loose = true;out.push(b);}
  if (s.moveGroup) {const mv = EDITABLE_MOVES.find(m => m.group === s.moveGroup), ids = [s.moveGroup, mv?.id].filter(Boolean).map(lit), b = l => ids.some(re => re.test(l));b.loose = true;out.push(b);}
  if (root === 'profiles') out.push(l => /\bprofiles?\b(\?\.|\.|\[)|\bprofile\b/.test(l));
  return out;
}
/** Chaves que aparecem em mais de um grupo de C: a leitura só conta num arquivo que também cite o grupo. */
let leafCount = null;
function ambiguous(key) {
  if (!leafCount) {leafCount = new Map();for (const p of Object.keys(flatten(defaults()))) {const k = p.split('.').at(-1);leafCount.set(k, (leafCount.get(k) ?? 0) + 1);}}
  return (leafCount.get(key) ?? 0) > 1 || key.length < 6;
}
/** Famílias lidas por um OBJETO genérico (recebido por parâmetro ou escolhido por chave em tempo de execução), que a busca pelo caminho não vê.
 * Cada uma: quais sliders (match), em que arquivos (files), o que o arquivo precisa conter para o objeto ser daquela família (obj) e a leitura da chave
 * (read). Conferidas à mão; o teste reconfere que cada slider da família tem a leitura. */
export const MANUAL_CONSUMERS = Object.freeze([
  {match: /^actions\.cancel\./, files: /^src\/sim\/controller\//, obj: /=\s*A\.cancel\b|C\.actions\.cancel/, read: k => new RegExp(`\\bc\\.${k}\\b|cancel\\??\\.${k}\\b`), why: 'c = A.cancel (A = C.actions) no C → X de ctrl-update.js'},
  {match: /^world\.beam\./, files: /^src\/(ui\/moves-panel|sim\/(beam|world))\.js$/, extraFiles: ['src/ui/moves-panel.js'], obj: /C\.world\.beam/, read: k => new RegExp(`C\\.world\\.beam\\.${k}\\b`), why: 'emissor técnico: ui/moves-panel.js (emitir laser) passa C.world.beam ao spawn; sim/beam.js e sim/world.js leem maxSegments'},
  {match: /^actions\.(dodge|tackle)\./, files: /^src\/sim\//, obj: /C\.actions\[|actionParams\(|C\.actions\.(dodge|tackle)|\bp\.profile\b/, read: k => new RegExp(`\\bp\\.${k}\\b`), why: 'p = C.actions[tipo] / actionParams(tipo): controller, motion.js (curva) e entity.js (distância nominal)'},
  {match: /^profiles\.\w+\.(hp|attack|speed)$/, files: /^src\/sim\//, obj: /attributes/, read: k => new RegExp(`attributes\\??\\.${k}\\b`), why: 'createFighter(C.profiles[perfil]) copia o perfil em f.attributes'},
  {match: /^extras\.(aiRed|aiBlue)\./, files: /^src\/sim\//, obj: /personality\(\)|\bP\b/, read: k => new RegExp(`\\bP\\??\\.${k}\\b`), why: 'P = Brain.personality() = {...NEUTRAL_PERSONALITY, ...C.extras[lado]} (sim/ai.js)'},
  {match: /^vfx\.laser\./, files: /^src\/view\/vfx\//, obj: /cfg|config/, read: k => new RegExp(`\\b(cfg|config)\\??\\.${k}\\b|set${k[0].toUpperCase()}${k.slice(1)}\\(`), why: 'BeamRenderer.config recebe C.vfx.laser (ui/visual-panel.js: setConfig/setQuality)'},
  {match: /^vfx\.elemental\./, files: /^src\/view\//, obj: /elementalCfg|C\.vfx\??\.elemental/, read: k => new RegExp(`(elementalCfg\\(\\)|elemental)\\??\\.${k}\\b`), why: 'elementalCfg() = C.vfx.elemental (view/quarks/elemental-game.js)'},
  {match: /^vfx\.(?!laser|elemental|post|master|solid\.|quarks)\w+\./, files: /^src\/view\//, obj: /C\.vfx\[/, read: k => new RegExp(`\\.${k}\\b|['"\`]${k}['"\`]`), why: 'famílias de efeito/tremor lidas por C.vfx[tipo] (view/vfx.js fire/shake, view/solid-fx.js)'},
  {match: /^passivas\.[\w-]+\./, files: /^src\/sim\//, obj: /\bP\(|C\.passivas/, read: k => new RegExp(`\\.${k}\\b`), why: 'P(id) = C.passivas[id] (sim/passive-engine.js)'},
  {match: /^vfx\.post\./, files: /^src\/view\/post\//, obj: /\bE\b/, read: k => new RegExp(`\\bE\\??\\.${k}\\b`), why: 'E = parâmetros efetivos de C.vfx.post (view/post/post-params.js → post-pipeline.js)'},
  {match: /^world\.\w+\.atelierVfx$/, files: /\.vfx\.js$|atelier-game\.js$/, obj: /atelierVfx/, read: () => /\.atelierVfx\b/, why: 'interruptor do rush do Ateliê lido pelo .vfx.js do Move (atelierVfxOn) e por view/quarks/atelier-game.js'},
  {match: /^display\.windows\./, files: /^src\/(ui\/diagnostics-panel|view\/)/, obj: /C\.display\.windows/, read: k => new RegExp(`\\[['"\`]${k}['"\`]|\\bW\\??\\.${k}\\b`), why: 'tabela de janelas [chave, rótulo, cor] lida por W = C.display.windows (ui/diagnostics-panel.js)'},
]);
/** Sliders SEM consumidor confirmados à mão (nenhuma leitura no código além da definição). Não se apagam (presets e JSON antigos os citam): ficam
 * rotulados na interface com «(sem efeito)» e listados aqui com o motivo. Ligar a um consumidor mudaria o jogo no padrão (ou a regra não existe). */
export const ORPHANS_LABELED = Object.freeze([
  {id: 'rules.blockPushback', why: 'repulsão do defensor ao bloquear não é lida; o recuo da defesa usa rules.recoil/recoilFraction'},
  {id: 'extras.ai.revision', why: 'só existe a IA revisão 2: tactics.js revisionOf ignora o ajuste global (revisionOverride só na avaliação pareada)'},
  {id: 'profiles.balanced.defense', why: 'f.attributes.defense não é lido (a defesa do dano usa guardDamageMultiplier/estágios); legado do v6'},
  {id: 'profiles.agile.defense', why: 'f.attributes.defense não é lido (a defesa do dano usa guardDamageMultiplier/estágios); legado do v6'},
  {id: 'profiles.resistant.defense', why: 'f.attributes.defense não é lido (a defesa do dano usa guardDamageMultiplier/estágios); legado do v6'},
  {id: 'test.hp', why: 'perfil «test» do v6: a vida vem de C.profiles[perfil].hp'},
  {id: 'test.defense', why: 'perfil «test» do v6: não é lido'},
  {id: 'test.speed', why: 'perfil «test» do v6: a velocidade vem de C.profiles[perfil].speed (só a prova de conceito physics-poc lê)'},
  {id: 'rules.slamAngle', why: 'o mergulho do meteor slam mira o rival (aimSlamDive); o ângulo fixo só aparece em comentário'},
  {id: 'test.speedReference', why: 'legado do v6; mantido só para a comparação com o config.ts do jogo (official.js)'},
  {id: 'test.defenseMedian', why: 'legado do v6; mantido só para a comparação com o config.ts do jogo (official.js)'},
  {id: 'test.pushCoefficient', why: 'empurrão legado do v6; o laboratório usa resolvers de reação (F3)'},
  {id: 'test.aiRange', why: 'legado do v6; a IA usa extras.ai.attackRange/approachDistance'},
  {id: 'test.forwardTolerance', why: 'legado do v6; a frente do golpe usa extras.combat.*Alignment'},
  {id: 'map.wallDamageMultiplier', why: 'a borda circular não causa dano próprio; o wall-splat usa rules.wallSplatDamage (0 por padrão)'},
  {id: 'map.jumpLandingRecovery', why: 'o pouso de pulo normal não tem recuperação (physics.js land: wasNormalJump → 0); ligar mudaria o jogo'},
  {id: 'actions.sprint.exhaustedStop', why: 'o sprint SEMPRE termina na exaustão (ctrl-update.js); a regra «desligado» não existe'},
  {id: 'extras.hud.debugFontSize', why: 'a tela de depuração usa o CSS fixo; o valor não é aplicado'},
  {id: 'extras.hud.footerFontSize', why: 'o rodapé usa o CSS fixo; o valor não é aplicado'},
  {id: 'extras.hud.menuOpacity', why: 'o menu usa o CSS fixo; o valor não é aplicado'},
  {id: 'vfx.rock.trailDensity', why: 'o rastro da rocha não lê a densidade (view/vfx não consulta C.vfx.rock.trailDensity)'},
  {id: 'vfx.barrier.ripples', why: 'a barreira não lê o interruptor de ondas'},
  {id: 'vfx.laser.flowSpeed', why: 'BeamRenderer recebe C.vfx.laser (visual-panel setConfig) mas não lê flowSpeed'},
  {id: 'vfx.laser.dynamicLight', why: 'BeamRenderer recebe C.vfx.laser (visual-panel setConfig) mas não lê dynamicLight'},
]);
export const ORPHAN_MARK = '(sem efeito)';
/** Lê um arquivo fora do conjunto escaneado (família que precisa de um painel que também define controles). */
const loadSource = rel => {const text = readFileSync(`${LAB}/${rel}`, 'utf8'), lines = text.split('\n');return {file: rel, text, lines, comment: lines.map(() => false)};};
const ALIAS_CACHE = new Map(), CONSUMER_CACHE = new Map();
/** Consumidor real (memorizado por id): {file, line, how} ou null. */
export function findConsumer(s) {if (!CONSUMER_CACHE.has(s.id)) CONSUMER_CACHE.set(s.id, findConsumerRaw(s));return CONSUMER_CACHE.get(s.id);}
/** Consumidor real: {file, line, how} ou null. Preferência: arquivo declarado na ficha do Move; depois arquivos que citam o grupo. */
function findConsumerRaw(s) {
  const files = sources();
  for (const fam of DYNAMIC_FAMILIES) {
    const m = s.path.match(fam.match);if (!m) continue;
    const tok = esc(fam.token(m)), re = new RegExp(`\\b(rgb|ratio|keyFor2?|key|k|pk)\\(\\s*['"\`]${tok}['"\`]|\\[[^\\]]*['"\`]${tok}['"\`][^\\]]*\\]\\.findIndex\\(p?k\\)`);
    for (const f of files) {const i = f.lines.findIndex(l => re.test(l));if (i >= 0) return {file: f.file, line: i + 1, how: 'família dinâmica'};}
    return null;
  }
  const bind = binders(s), amb = ambiguous(s.key);
  const cites = f => f.lines.some(l => bind.some(b => b(l, f)));
  const order = s.declaredConsumer ? [...files.filter(f => f.file === s.declaredConsumer), ...files.filter(f => f.file !== s.declaredConsumer)] : files;
  let loose = null;
  // Apelidos do grupo no arquivo (const R = C.rules; T = C.test; {a, b} = C.map): a leitura `R.chave` / a desestruturação valem.
  // Também apelido de um PREFIXO do pai (X = C.extras → X.combat.chave; A = C.actions → A.cancel.chave).
  const parent = s.path.split('.').slice(0, -1), pathRe = parts => `(C\\??\\.)?${parts.map(esc).join('\\??\\.')}`, parentRe = pathRe(parent);
  const destr = new RegExp(`\\{[^}]*\\b${esc(s.key)}\\b[^}]*\\}\\s*=\\s*${parentRe}\\b`);
  const viaAlias = f => {
    // aliasOf[n] = nomes que valem C.<parent[0..n)>: declarados direto (X = C.extras) ou por apelido de um prefixo menor (S = A.sprint, A = C.actions).
    const ck = f.file + '|' + parent.join('.');let aliasOf = ALIAS_CACHE.get(ck);
    if (!aliasOf) {
      aliasOf = [];
      const declOf = src => {const decl = new RegExp(`\\b([A-Za-z_$][\\w$]*)\\s*=\\s*${src}\\s*(?=[;,)\\n]|\\?\\?|\\|\\||$)`), g = new RegExp(decl.source, 'g'), out = new Set();for (const l of f.lines) {const m = l.match(g);if (m) for (const x of m) out.add(x.match(decl)[1]);}return out;};
      for (let n = 1; n <= parent.length; n++) {
        const names = declOf(pathRe(parent.slice(0, n)));
        for (let m = 1; m < n; m++) for (const a of aliasOf[m]) for (const x of declOf(`\\b${esc(a)}\\??\\.${parent.slice(m, n).map(esc).join('\\??\\.')}`)) names.add(x);
        aliasOf[n] = names;
      }
      ALIAS_CACHE.set(ck, aliasOf);
    }
    const reads = [];
    for (let n = parent.length; n >= 1; n--) for (const a of aliasOf[n]) reads.push(new RegExp(`\\b${esc(a)}\\??\\.${[...parent.slice(n), s.key].map(esc).join('\\??\\.')}\\b`));
    for (let i = 0; i < f.lines.length; i++) {const l = f.lines[i];if (f.comment?.[i]) continue;if (destr.test(l) || reads.some(re => re.test(l))) return i + 1;}
    return 0;
  };
  for (const f of order) {
    const line = firstRead(f.lines, s.key, l => bind.some(b => b(l, f)), f);if (!line) continue;
    if (f.file === s.declaredConsumer) return {file: f.file, line, how: 'consumidor declarado na ficha'};
    if (bind.some(b => !b.loose && b(f.lines[line - 1], f)) && !/^\s*['"`]?[\w.]+['"`]?\s*:/.test(f.lines[line - 1])) return {file: f.file, line, how: 'chave + grupo na mesma linha'};
    const al = viaAlias(f);if (al) return {file: f.file, line: al, how: 'apelido do grupo'};
    // Evidência FRACA (só co-ocorrência no arquivo): guardada; vale apenas se nenhuma evidência forte aparecer abaixo, e sai marcada `weak`.
    if (!loose && !amb && cites(f)) loose = {file: f.file, line, how: 'chave + grupo no arquivo', weak: true};
    else if (!loose && !amb && !f.file.startsWith('src/ui/')) loose = {file: f.file, line, how: 'chave única', weak: true};
  }
  // Família lida por objeto genérico (MANUAL_CONSUMERS).
  for (const fam of MANUAL_CONSUMERS.filter(x => x.match.test(s.id))) {
    const re = fam.read(s.key);
    for (const f of [...files, ...(fam.extraFiles ?? []).map(loadSource)]) {if (!fam.files.test(f.file) || !f.lines.some(l => fam.obj.test(l))) continue;const i = f.lines.findIndex(l => !/^\s*(\/\/|\*)/.test(l) && re.test(l));if (i >= 0) return {file: f.file, line: i + 1, how: 'objeto genérico da família (conferido)'};}
  }
  if (s.moveGroup) {
    // Ficha de dados do Move (.move.json): a chave citada em durationKeys/atKey(s)/startKey/endKey/distanceKey/invulnerableKeys é lida pelo motor (moves.js effectiveMove, ctrl-moves).
    const mv = EDITABLE_MOVES.find(m => m.group === s.moveGroup), jsonRel = mv && `src/sim/moves/${mv.id}.move.json`;
    if (jsonRel) try {
      const text = readFileSync(`${LAB}/${jsonRel}`, 'utf8'), def = JSON.parse(text).def ?? {};
      const refs = new Set();const walk = (o, k) => {if (Array.isArray(o)) o.forEach(x => walk(x, k));else if (o && typeof o === 'object') for (const [kk, v] of Object.entries(o)) walk(v, kk);else if (typeof o === 'string' && /Keys?$/.test(k ?? '')) refs.add(o);};
      walk(def);
      if (refs.has(s.key)) {const lines = text.split('\n'), i = lines.findIndex(l => l.includes(`"${s.key}"`));return {file: jsonRel, line: i + 1, how: 'chave nomeada no def do .move.json (motor: moves.js effectiveMove / ctrl-moves)'};}
    } catch {/* Move sem .move.json */}
    // Snapshot genérico dos parâmetros do Move (action.params / C.world[def.group]) lido pelo motor ou pela view.
    const re = new RegExp(`(\\bparams\\)?\\??\\.${esc(s.key)}\\b|\\bP\\??\\.${esc(s.key)}\\b|C\\.world\\[[^\\]]+\\]\\??\\.${esc(s.key)}\\b)`);
    for (const f of [...files.filter(f => f.file === s.declaredConsumer), ...files]) {const i = f.lines.findIndex(l => !/^\s*(\/\/|\*)/.test(l) && re.test(l));if (i >= 0) return {file: f.file, line: i + 1, how: 'snapshot genérico de params do Move'};}
  }
  return loose;
}

// ---------- parâmetros jogáveis sem slider (ocultos) ----------
/** Raízes de gameplay cujos números deveriam ter controle. */
export const GAMEPLAY_ROOTS = ['rules', 'actions', 'profiles', 'locomotion', 'map', 'ledge', 'passivas', 'world'];
export function hiddenParams(sliders) {
  const have = new Set(sliders.map(s => s.path)), base = defaults(), out = [];
  for (const root of GAMEPLAY_ROOTS) for (const path of Object.keys(flatten(base[root], root))) if (!have.has(path)) out.push(path);
  return out;
}
export {C, resetConfig, defaults, Game, emptyCommand, traceMove, compareTraces, defaultValues, EDITABLE_MOVES};

// ---------- A/B (mín × máx) ----------
/** Sliders só de aparência, entrada, câmera ou depuração: o consumidor é a view/HUD/entrada, sem efeito na simulação; não entram no A/B da sim. */
export const VISUAL_OR_DEBUG = Object.freeze([
  {match: /^vfx\./, why: 'efeito visual (view/vfx, solid-fx, quarks, pós-processamento)'},
  {match: /^display\./, why: 'apresentação: HUD, sombras, cenário, indicadores'},
  {match: /^camera\.|^extras\.cameraExtra\./, why: 'câmera (view/camera)'},
  {match: /^extras\.(visual|fx|hud|colors)\./, why: 'aparência do lutador, partículas, HUD e cores'},
  {match: /^extras\.bindings2?\./, why: 'tecla física (entrada), sem número de gameplay'},
  {match: /^rules\.(feintFx|slamRing|slamFx)/, why: 'efeito visual da finta / do meteor slam'},
  {match: /^extras\.toggles\.(showHitboxes|showAttackVectors|enableCameraFollow|enableCameraRecenter)$/, why: 'depuração visual / câmera'},
  {match: /^extras\.nav\.showDebug$/, why: 'depuração visual da navegação'},
  {match: /^locomotion\.visualTurnRate$/, why: 'giro só do indicador visual'},
  {match: /^world\.beam\./, why: 'emissor técnico de teste (aba Moves → emitir laser e cenários técnicos de sim/scenarios-moves.js); nenhum Move do jogo dispara feixe'},
  {match: /^world\.[^.]+\.hitShake(On|Amount|Duration)$/, why: 'tremor de câmera ao acertar (view/vfx.js), só aparência'},
  {match: /^world\.\w+\.atelierVfx$/, why: 'rush visual do Ateliê; o piloto (sim/moves/pilot-coverage.js) garante que não altera o hash da simulação nem o dano'},
  {match: s => isVisualWorldParam([s.moveGroup, s.key]), why: 'parâmetro visual do Move (VISUAL_WORLD_KEYS em ui/moves-panel.js)'},
]);
export const visualReason = s => VISUAL_OR_DEBUG.find(v => typeof v.match === 'function' ? s.moveGroup && v.match(s) : v.match.test(s.path))?.why ?? null;

/** Cenários curtos e determinísticos (120 Hz, semente fixa, sem navegador). Cada um: config (antes do slider), setup do Game, segundos e os comandos
 * por passo [azul, vermelho] (undefined = as duas IAs). Amostra a cada 2 passos: posição, altura, velocidade, vida, stamina, estado, ação e giro de cada
 * lutador + entidades do mundo + eventos. O A/B roda o cenário com o slider no MÍN e no MÁX em passo travado e para na primeira divergência. */
const cmd = o => ({...emptyCommand(), ...o});
const wallX = () => (C.map?.arenaShape === 'square' ? C.test.arenaHalf : (C.map?.arenaRadius ?? 50)) - C.test.halfExtent;
const clearMap = g => {const m = g.mapState;if (m) {m.destructibles = [];m.obstacles = [];m.platforms = [];m.items = [];}};
const face = g => {const [a, b] = g.fighters;a.facing = Math.atan2(b.position.x - a.position.x, b.position.z - a.position.z);b.facing = a.facing + Math.PI;};
const place = (a, b) => g => {g.reset({positions: [vec(...a), vec(...b)]});clearMap(g);face(g);};
const bothAi = () => {C.extras.toggles.enablePlayerAI = 1;C.extras.toggles.enableEnemyAI = 1;};
/** Duelo como o da avaliação de IA (sim/ai-eval/eval-match.js): as duas mentes no modo tático; o azul pela playerBrain, o vermelho pela brain interna do Game. */
const duelSetup = (profile = 'balanced') => g => {g.profile = g.enemyProfile = profile;g.mode = 'tactical';g.brain.seed = 7;g.playerBrain.seed = 7 + 7919;g.brain.reset();g.playerBrain.reset();g.reset();};
const aiCmds = (t, g) => [g.playerBrain.command(g.fighters[0], g.fighters[1], 'tactical', C.test.step), undefined];
/** Borda (Ledge Grab): caixa sólida de 2,6 m na origem; o lutador que pula (azul, ou vermelho em `ai`) corre em +x, pula a ~0,6 m da parede e agarra.
 * O estado do roteiro fica no próprio Game (g.f7), nunca em variável compartilhada entre A e B. */
const ledgeSetup = g => {
  g.reset({positions: [vec(-3.8, 0), vec(12, 12)]});clearMap(g);g.mapState.regularSpawnTimer = 1e9;
  g.mapState.obstacles = [{id: 'cx', pos: {x: 0, y: 0, z: 0}, shape: 'box', hx: 1.5, hz: 1.5, height: 2.6, angle: 0}];
  for (const f of g.fighters) {f.groundY = 0;f.facing = Math.PI / 2;}
  g.f7 = {jumped: -1, grabbed: -1};
};
const ledgeCmds = mode => (t, g) => {
  const who = mode === 'ai' ? 1 : 0, f = g.fighters[who], st = g.f7;
  if (st.jumped < 0 && !f.flight && !f.ledge && -2.0 - f.position.x < .6) st.jumped = t;
  if (f.ledge && st.grabbed < 0) st.grabbed = t;
  const since = st.grabbed < 0 ? -1 : t - st.grabbed;
  let c = cmd({move: vec(1, 0), jump: st.jumped === t, jumpHeld: st.jumped >= 0 && t < st.jumped + 40 && st.grabbed < 0});
  if (since >= 0) {
    if (mode === 'climb' && since > 60) c = cmd({move: vec(1, 0), jump: since === 61, jumpHeld: since > 60 && since < 140});
    else if (mode === 'drop' && since > 60) c = cmd({move: since < 120 ? vec(-1, 0) : vec(1, 0), guard: since > 60 && since < 120, jump: since === 160, jumpHeld: since > 160 && since < 200});
    else if (mode === 'hang' || mode === 'hurt' || mode === 'ai') c = cmd();
  }
  const other = mode === 'hurt' && since > 30 ? cmd({move: vec(1, 0), tackle: since === 31, target: 0}) : cmd();
  return who ? [cmd(), c] : [c, other];
};
/** Navegação (Yuka): cenários determinísticos de sim/nav/nav-scenarios.js com a navegação ligada; o vermelho (IA ofensiva) persegue o azul parado. */
const navConfig = () => {C.extras.nav.enableNav = 1;C.extras.toggles.enableEnemyAI = 1;};
const navSetup = id => g => {setupNavScenario(g, id, {mode: 'offensive'});};
export const SCENARIOS = Object.freeze({
  tackle: {label: 'tackle acertando um alvo parado (e um segundo tackle)', seconds: 2.2, setup: place([0, -1.1], [0, 1.1]), cmds: t => [cmd({move: t < 30 ? vec(0, 1) : vec(), tackle: t === 4 || t === 150, target: 1}), cmd()]},
  guard: {label: 'tackle contra defesa (parcial e perfeita)', seconds: 2.4, setup: place([0, -1.1], [0, 1.1]), cmds: t => [cmd({move: (t >= 30 && t < 60) || (t >= 130 && t < 150) ? vec(0, 1) : vec(), tackle: t === 40 || t === 140, target: 1}), cmd({guard: t < 128 || t >= 136, guardPressed: t === 0 || t === 136, target: 0})]},
  clash: {label: 'clash (tackle × tackle)', seconds: 2, setup: place([0, -1.6], [0, 1.6]), cmds: t => [cmd({move: t < 16 ? vec(0, 1) : vec(), tackle: t === 5, target: 1}), cmd({move: t < 16 ? vec(0, -1) : vec(), tackle: t === 5, target: 0})]},
  dodge: {label: 'esquiva (perfeita) do tackle rival, C → X e C sobre o rival', seconds: 2.4, setup: place([0, -1.1], [0, 1.1]), cmds: t => [cmd({move: t >= 8 && t < 14 ? vec(1, 0) : t >= 150 && t < 160 ? vec(0, 1) : vec(), dodge: t === 8 || t === 150, dodgeHeld: t === 8 || t === 150, tackle: t === 30, target: 1}), cmd({move: t < 10 ? vec(0, -1) : vec(), tackle: t === 4, target: 0})]},
  sprint: {label: 'sprint, caminhada, X no sprint e exaustão', seconds: 2.5, setup: place([-6, 0], [6, 0]), cmds: t => [cmd({move: t < 260 ? vec(1, 0) : vec(), dodge: t === 2, dodgeHeld: t >= 2 && t < 200, tackle: t === 120}), cmd()]},
  charge: {label: 'tackle carregado (PL3) acertando', seconds: 2.5, setup: place([0, -4], [0, 4]), cmds: t => [cmd({move: vec(0, 1), tackle: t === 1, tackleHeld: t >= 1 && t < 160, target: 1}), cmd()]},
  feint: {label: 'finta (tackle → esquiva lateral imediata)', seconds: 1.5, setup: place([0, -3], [0, 3]), cmds: t => [cmd({move: t < 6 ? vec(0, 1) : t < 14 ? vec(1, 0) : vec(), tackle: t === 4, dodge: t === 8, dodgeHeld: t === 8, target: 1}), cmd()]},
  wallPush: {label: 'tackle carregado jogando o rival na parede', seconds: 2.5, setup: g => {const x = wallX();place([x - 4.5, 0], [x - 1.6, 0])(g);}, cmds: t => [cmd({move: t < 30 ? vec(1, 0) : vec(), tackle: t === 1, tackleHeld: t >= 1 && t < 80, target: 1}), cmd()]},
  wall: {label: 'rival caindo na parede (wall-splat) e combo', seconds: 2.2, setup: g => {const x = wallX();place([x - 4.5, 0], [x - 2, 0])(g);const r = g.fighters[1];r.position = vec(x - .05, 0);r.flight = {y: .8, vy: -2, horizontal: vec(10, 0)};r.state = 'airborne';g.fighters[0].facing = Math.PI / 2;}, cmds: t => [cmd({tackle: t === 1, move: t < 60 ? vec(1, 0) : vec(), dodgeDirection: vec(1, 0)}), cmd()]},
  wallBounce: {label: 'rival subindo contra a parede (ricochete)', seconds: 2, setup: g => {const x = wallX();place([x - 6, 0], [x - 2, 0])(g);const r = g.fighters[1];r.position = vec(x - .05, 0);r.flight = {y: 1, vy: 3, horizontal: vec(10, 0)};r.state = 'airborne';}, cmds: () => [cmd(), cmd()]},
  slam: {label: 'salto sobre o rival (C) → meteor slam (X) e quique', seconds: 2, setup: place([0, -2], [0, 2]), cmds: t => [cmd({move: vec(0, 1), dodgeDirection: vec(0, 1), dodge: t === 0, dodgeHeld: t === 0, tackle: t === 35}), cmd()]},
  flight: {label: 'voo de lançamento, pouso e tech (C perto do chão)', seconds: 2.2, setup: g => {place([-4, 0], [4, 0])(g);launch(g.fighters[0], vec(0, 1), 6, 7.3);}, cmds: t => [cmd({move: vec(1, 0), dodge: t % 6 === 0, dodgeHeld: t % 6 === 0}), cmd()]},
  jump: {label: 'pulo, controle aéreo e footstool no rival', seconds: 2.5, setup: place([0, -1.2], [0, 1.2]), cmds: t => [cmd({move: t < 120 ? vec(0, 1) : vec(1, 0), jump: t === 5 || t === 160, jumpHeld: (t >= 5 && t < 40) || (t >= 160 && t < 175), target: 1}), cmd()]},
  duel: {label: 'duelo IA tática × IA tática (3 s)', seconds: 3, config: bothAi, setup: duelSetup(), cmds: aiCmds},
  duelLong: {label: 'duelo IA tática × IA tática (8 s)', seconds: 8, config: bothAi, setup: duelSetup(), cmds: aiCmds},
  duelAgile: {label: 'duelo IA × IA, perfil ágil', seconds: 3, config: bothAi, setup: duelSetup('agile'), cmds: aiCmds},
  duelResistant: {label: 'duelo IA × IA, perfil resistente', seconds: 3, config: bothAi, setup: duelSetup('resistant'), cmds: aiCmds},
  duelMoves: {label: 'duelo IA × IA com Reflect, Psyshock, Water Pulse e Swift equipados (6 s)', seconds: 6, config: bothAi, setup: g => {duelSetup()(g);for (const i of [0, 1]) g.setLoadout(i, ['reflect', 'psyshock', 'water-pulse', 'swift']);}, cmds: aiCmds},
  items: {label: 'consumíveis no caminho (cura, stamina, estágios, escudo) e tackle', seconds: 3, setup: g => {place([-6, 0], [5, 0])(g);const f = g.fighters[0];f.stamina = 1;
    g.mapState.items = ['heal_hp', 'heal_stamina', 'buff_attack', 'buff_defense', 'buff_stamina_max', 'buff_cooldown', 'buff_speed', 'buff_attack', 'buff_attack', 'buff_attack', 'buff_attack', 'heal_hp'].map((type, i) => ({id: 900 + i, type, pos: {x: -5 + i * .7, y: 0, z: 0}, life: 30, isDrop: false, vy: 0}));},
    cmds: t => [cmd({move: t < 200 ? vec(1, 0) : vec(), tackle: t === 205, target: 1}), cmd({tackle: t === 260, target: 0})]},
  ledgeClimb: {label: 'pulo na caixa de 2,6 m, agarre de borda, pendura e sobe (Espaço + frente)', seconds: 4, setup: ledgeSetup, cmds: ledgeCmds('climb')},
  ledgeDrop: {label: 'agarre de borda e solta segurando para trás; tenta agarrar de novo', seconds: 4, setup: ledgeSetup, cmds: ledgeCmds('drop')},
  ledgeHang: {label: 'agarre de borda e fica pendurado até o tempo máximo (dreno de stamina)', seconds: 6, setup: ledgeSetup, cmds: ledgeCmds('hang')},
  ledgeHurt: {label: 'pendurado na borda e atingido pelo tackle do rival', seconds: 4, setup: g => {ledgeSetup(g);g.fighters[1].position = vec(-5.5, 0);g.fighters[1].facing = Math.PI / 2;}, cmds: ledgeCmds('hurt')},
  ledgeAi: {label: 'IA do vermelho pendura na borda e sobe sozinha (aiClimb)', seconds: 5, config: () => {C.extras.toggles.enableEnemyAI = 1;}, setup: g => {ledgeSetup(g);const [b, r] = g.fighters;b.position = vec(-3.8, 0);r.position = vec(12, 12);}, cmds: ledgeCmds('ai')},
  navMuro: {label: 'navegação: muro entre os lutadores (IA ofensiva persegue)', seconds: 6, config: navConfig, setup: navSetup('muro'), cmds: () => [cmd(), undefined]},
  navPlataforma: {label: 'navegação: alvo em plataforma de 1,5 m (salto)', seconds: 6, config: navConfig, setup: navSetup('plataforma'), cmds: () => [cmd(), undefined]},
  navTorre: {label: 'navegação: alvo inalcançável no alto (não insiste nem ataca o vazio)', seconds: 5, config: navConfig, setup: navSetup('torre'), cmds: () => [cmd(), undefined]},
  navCompleto: {label: 'navegação: arena completa (muros, corredor, plataformas, zona bloqueada)', seconds: 8, config: navConfig, setup: navSetup('completo'), cmds: () => [cmd(), undefined]},
});
/** Roteiro da passiva: o azul a equipa com 30% de vida e pouca stamina; o vermelho dá tackles periódicos; o azul ora defende, ora contra-ataca,
 * ora fica parado (passivas de tempo parado), ora corre. Cobre gatilhos de dano recebido, vida baixa, defesa, golpe dado e repouso. */
/** Espécie exigida pela passiva (R4: passivas exclusivas só equipam com a identidade da espécie). */
const speciesOf = id => PASSIVES.find(p => p.id === id)?.species ?? null;
const passiveScript = id => ({label: `roteiro com a passiva ${id} no azul (vida 30%, tackles do rival, defesa, contra-ataque, repouso)`, seconds: 7,
  setup: g => {place([0, -1.1], [0, 1.1])(g);g.passiveIdentity = [speciesOf(id), null];g.setPassiveLoadout(0, [id]);g.reset({positions: [vec(0, -1.1), vec(0, 1.1)]});clearMap(g);face(g);const b = g.fighters[0];b.hp = Math.round(b.attributes.hp * .6);b.stamina = 1.2;},
  cmds: t => {const ph = t % 240;return [cmd({target: 1, guard: ph >= 60 && ph < 100, guardPressed: ph === 60, tackle: ph === 130 || ph === 132, move: ph >= 125 && ph < 150 ? vec(0, 1) : ph >= 200 ? vec(1, 0) : vec(), dodgeHeld: ph >= 200, dodge: ph === 200}),
    cmd({target: 0, tackle: ph === 10 || ph === 165, move: ph < 25 || (ph >= 160 && ph < 175) ? vec(0, -1) : ph >= 150 && ph < 175 ? vec(0, 1) : vec()})];}});
/** Duelo com a passiva equipada nos dois lados (passivas.<id>.*). */
const passiveDuel = id => ({label: `duelo IA × IA com a passiva ${id} nos dois lados (5 s)`, seconds: 5, config: bothAi, setup: g => {duelSetup()(g);g.passiveIdentity = [speciesOf(id), speciesOf(id)];g.setPassiveLoadout(0, [id]);g.setPassiveLoadout(1, [id]);g.reset();}, cmds: aiCmds});
/** Interruptor que libera o slider (sem ele ligado o valor não age): ligado no A e no B. */
export const ENABLERS = Object.freeze([
  [/^extras\.hitbox\.(?!enableShapes)/, [['extras.hitbox.enableShapes', 1]]],
  [/^map\.footstoolVault/, [['map.footstoolVault', 1]]],
  [/^map\.jump(GravityUp|GravityDown|ReleaseMult|MaxFallSpeed|AirAccel|AirMaxSpeed|CoyoteTime|BufferWindow)$/, [['map.jumpImprovements', 1]]],
  [/^rules\.clash(Push)/, [['extras.toggles.enableClashPush', 1]]],
]);
/** Cenários tentados por grupo (primeira regra que casa com o caminho), na ordem. */
export const SCENARIO_RULES = Object.freeze([
  [/^profiles\.agile\./, ['duelAgile']],
  [/^profiles\.resistant\./, ['duelResistant']],
  [/^profiles\.balanced\./, ['tackle', 'duel']],
  [/^actions\.dodge\.|^actions\.cancel\.|^actions\.buffer\./, ['dodge', 'slam', 'feint', 'sprint', 'duel']],
  [/^actions\.sprint\./, ['sprint']],
  [/^actions\.tackle\./, ['tackle', 'guard', 'charge', 'clash', 'dodge', 'duel']],
  [/^rules\.feint/, ['feint']],
  [/^rules\.(tackleFriction|chargeTackle|sprintTacklePL)/, ['charge', 'sprint']],
  [/^rules\.(wallSplat|wallRestitution|wallBounce)/, ['wall', 'wallBounce', 'wallPush']],
  [/^rules\.(slam|groundBounce)/, ['slam']],
  [/^rules\.(tech|landing|launch)/, ['flight', 'tackle', 'wallPush']],
  [/^rules\.clash/, ['clash']],
  [/^rules\./, ['guard', 'tackle', 'dodge', 'sprint', 'charge', 'duel', 'duelLong']],
  [/^extras\.combat\./, ['tackle', 'guard', 'clash', 'flight', 'dodge', 'slam', 'charge', 'duel']],
  [/^locomotion\./, ['sprint', 'duel']],
  [/^map\.(jump|footstool)/, ['jump']],
  [/^map\.(heal|shield|stage|item)/, ['items', 'duelLong']],
  [/^ledge\./, ['ledgeClimb', 'ledgeDrop', 'ledgeHang', 'ledgeHurt', 'ledgeAi']],
  [/^map\.|^ledge\./, ['duelLong']],
  [/^world\.(charge|ai)\./, ['duelMoves']],
  [/^extras\.nav\./, ['navMuro', 'navPlataforma', 'navTorre', 'navCompleto']],
  [/^extras\.(ai|aiRed|aiBlue|nav)\./, ['duel', 'duelLong']],
  [/^test\./, ['tackle', 'duel']],
  [/^extras\.toggles\./, ['tackle', 'guard', 'clash', 'dodge', 'sprint', 'charge', 'wall', 'wallBounce', 'slam', 'flight', 'feint', 'jump', 'duel']],
  [/^/, ['tackle', 'duel']],
]);
export const scenariosFor = s => SCENARIO_RULES.find(([re]) => re.test(s.path))[1];

/** Mapa na amostra: objetos (posição, vida, estado) e itens; o A/B dos sliders de mapa enxerga geração, dano em objetos, respawn e consumíveis. */
const mapPrint = (m, r) => m ? [(m.destructibles ?? []).map(d => [r(d.pos?.x), r(d.pos?.z), r(d.hp), d.state]), (m.obstacles ?? []).map(o => [r(o.pos?.x), r(o.pos?.z)]), (m.platforms ?? []).map(p => [r(p.pos?.x), r(p.pos?.z)]), (m.items ?? []).map(i => [i.type, r(i.pos?.x), r(i.pos?.z), r(i.life)]), r(m.regularSpawnTimer)] : null;
const rnd = v => typeof v === 'number' ? Math.round(v * 1e6) / 1e6 : v ?? null;
const printOf = g => JSON.stringify([g.fighters.map(f => [rnd(f.position.x), rnd(f.position.z), rnd(f.flight?.y ?? f.groundY ?? 0), rnd(f.velocity?.x), rnd(f.velocity?.z), rnd(f.hp), rnd(f.stamina), f.state, f.action?.kind ?? null, rnd(f.facing)]),
  (g.world?.entities ?? []).map(e => [e.kind, rnd(e.pos?.x), rnd(e.pos?.z)]), g.events.length, mapPrint(g.mapState, rnd), g.fighters.map(f => [rnd(f.shield?.hp ?? 0), rnd(f.shield?.duration ?? 0), f.stages ? Object.values(f.stages).join(',') : '', (f.statuses ?? []).map(x => `${x.id}:${rnd(x.remaining ?? x.duration)}`).join(',')])]);
/** A e B em PASSO TRAVADO: dois Games, o caminho do slider trocado para o valor de cada um antes de cada passo (o resto de C é igual); para na primeira
 * amostra diferente. Devolve o passo da divergência ou -1. O controle (mesmo valor nos dois lados) nunca diverge: conferido no teste. */
function lockstep(sc, path, va, vb, enable = []) {
  resetConfig(baseAnterior());sc.config?.();for (const [p, x] of enable) setPath(p, x);
  const make = v => {setPath(path, v);const g = new Game({seed: 7});sc.setup(g);g.start();return g;};
  const gA = make(va), gB = make(vb), n = Math.round(sc.seconds * 120);
  try {
    for (let t = 0; t < n; t++) {
      setPath(path, va);const [a, b] = sc.cmds(t, gA);gA.step(a, b);
      setPath(path, vb);const [a2, b2] = sc.cmds(t, gB);gB.step(a2, b2);
      if (t % 2) continue;
      setPath(path, va);const sA = printOf(gA);setPath(path, vb);const sB = printOf(gB);
      if (sA.includes('NaN') || sB.includes('NaN')) throw new Error(`NaN no passo ${t}`);
      if (sA !== sB) return t;
    }
    return -1;
  } finally {resetConfig(baseAnterior());}
}
/** Aplica um valor no caminho de C (respeitando o atalho de enableInfiniteStamina do painel). */
function setPath(path, v) {
  if (path === 'rules.enableInfiniteStamina') {C.extras.toggles.enableInfiniteStamina = v;return;}
  const keys = path.split('.'), last = keys.pop();keys.reduce((a, k) => a[k], C)[last] = v;
}
/** Interruptores do slider: ENABLERS do Ajustes e, nos Moves, o dependsOn da ficha (ex.: knockbackH do Bullet Punch depende de knockbackOwn). */
export function enablersOf(s) {
  const out = ENABLERS.filter(([re]) => re.test(s.path)).flatMap(([, list]) => list);
  if (s.moveGroup) {const raw = moveParamGroups().find(g => g.group === s.moveGroup)?.rows.find(r => r.key === s.key), dep = raw ? classifyParamRow(s.moveGroup, raw).dependsOn : null;const dep2 = DEPENDS_ON[`${s.moveGroup}.${s.key}`];for (const d of [dep, dep2]) if (d && d !== s.key) out.push([`world.${s.moveGroup}.${d}`, 1]);}
  return out;
}

/** Cenários dos Moves: o azul equipa o Move e o usa contra o vermelho em estágios diferentes (parado, defendendo, longe, atacando, correndo). */
const moveStage = (id, {d = 3, red = 'still', hold = 0, seconds = 2.5} = {}) => ({label: `${id} a ${d} m, alvo ${red}`, seconds,
  setup: g => {g.setLoadout(0, [id]);place([0, -d / 2], [0, d / 2])(g);},
  cmds: t => [cmd({target: 1, skill: t === 1 ? 0 : null, skillHeld: [t >= 1 && t <= 1 + Math.round(hold * 120), false, false, false]}),
    cmd({target: 0, guard: red === 'guard', guardPressed: red === 'guard' && t === 0, tackle: red === 'tackle' && t === 20, move: red === 'tackle' && t < 30 ? vec(0, -1) : red === 'run' ? vec(1, 0) : vec()})]});
export function moveScenarios(group) {
  const m = EDITABLE_MOVES.find(x => x.group === group);if (!m) return [];
  const hold = m.def.charge ? 1.2 : m.def.aimMode ? 0.35 : 0, h2 = m.def.charge ? 0.5 : hold;
  return [['perto', {d: 3, hold}], ['defesa', {d: 3, red: 'guard', hold}], ['longe', {d: 9, hold, seconds: 3}], ['contra-ataque', {d: 3, red: 'tackle', hold}], ['correndo', {d: 4, red: 'run', hold}], ['carga curta', {d: 3, hold: h2}], ['colado', {d: 1.2, hold}]]
    .map(([k, o]) => [`${m.id}/${k}`, moveStage(m.id, o)]);
}
/** Sliders de gameplay cujo A/B (mín × máx) NÃO mudou nenhum cenário curto: listados um a um, por motivo, e reportados na matriz (não pulados
 * em silêncio). Medido por scripts/gen-matriz-sliders.mjs (busca completa); para tirar um daqui, crie o cenário que o exercite. */
export const SENSITIVITY_PENDING = Object.freeze({
  combate: {why: 'condição não exercitada pelos cenários roteirizados de 1,5–3 s (cadeia/cancelamento específico, janela fina, clash sem lançamento, hitstop, entrada do controle)', ids: [
    'actions.dodge.invulnerable', 'actions.dodge.curveStart', 'actions.dodge.chainAfter', 'actions.dodge.fromGuard', 'actions.dodge.fromRecoil', 'actions.dodge.fromGuardStun',
    'actions.dodge.vaultHeight', 'actions.dodge.vaultReachBonus', 'actions.dodge.perfectEvadeStamina', 'actions.dodge.counterWindow', 'actions.dodge.selfCancelFromEnd',
    'actions.tackle.invulnerable', 'actions.tackle.curveStart', 'actions.tackle.steerLimit', 'actions.tackle.steerRate', 'actions.tackle.chainAfter', 'actions.tackle.fromGuard',
    'actions.tackle.fromRecoil', 'actions.tackle.fromGuardStun', 'actions.tackle.counterSpeed', 'actions.tackle.selfCancel', 'actions.tackle.guardCancel',
    'actions.tackle.perfectGuardCancel', 'actions.cancel.windowEnd', 'actions.cancel.transition', 'actions.cancel.airDescent', 'actions.cancel.invulnerability',
    'actions.cancel.fromEnd', 'actions.cancel.perfectAnytime', 'rules.blend', 'rules.hitstun', 'rules.comboWindow', 'rules.tackleFriction1', 'rules.chargeTackleTurn',
    'rules.chargeTackleDamage2', 'rules.slamImpactScale', 'rules.slamImpactShake', 'rules.slamRecovery', 'rules.slamBlockPushDistance', 'rules.clashUp', 'rules.clashHorizontal',
    'rules.techWindow', 'extras.combat.vaultCollisionHeight', 'extras.combat.clashFacingAlignment', 'extras.combat.clashClosingSpeed', 'extras.combat.launchNormalWeight',
    'extras.combat.launchCenterWeight', 'extras.combat.contactProjectionPasses', 'extras.combat.hitstopDamageRef', 'extras.combat.perfectGuardCounterWindow',
    'extras.combat.exhaustRecovery', 'extras.combat.guardRegenFactor', 'locomotion.braking', 'locomotion.reversal', 'locomotion.brakeCurve', 'locomotion.friction',
    'locomotion.residualSpeed', 'locomotion.moveFrame', 'locomotion.frameLatch', 'locomotion.stopThreshold', 'locomotion.lockTackleHoming', 'extras.toggles.enableInvulnerability',
    'extras.toggles.enableAIAttack', 'extras.toggles.enableAIReactive', 'extras.toggles.enablePlayerAI', 'extras.toggles.integerDamage', 'extras.toggles.enableCounterBonus',
    'extras.toggles.enemyManual', 'extras.toggles.enableAnimationCombatWindows', 'extras.toggles.enableFlightSlam', 'extras.toggles.enablePassives', 'actions.sprint.braking',
    'actions.sprint.turnGrip', 'actions.sprint.minStamina', 'extras.hitbox.enableShapes', 'extras.hitbox.shapeRadius',
  ]},
  ia: {why: 'decisão da IA tática não mudou nos duelos de 3 e 8 s (probabilidade/limiar não atingido com a semente fixa)', ids: [
    'extras.ai.wallEscape', 'extras.ai.orbitChangePeriod', 'extras.ai.threatDistance', 'extras.ai.defensiveRetreatDistance', 'extras.ai.defensiveRetreatStrength',
    'extras.ai.reactiveRetreatStrength', 'extras.ai.approachDistance', 'extras.ai.retreatDistance', 'extras.ai.retreatStrength', 'extras.ai.strafeStrength', 'extras.ai.wallPrediction',
    'extras.ai.wallMargin', 'extras.ai.attackRange', 'extras.ai.combatAttackCooldown', 'extras.ai.lowStaminaThreshold', 'extras.ai.lowStaminaDistance', 'extras.ai.lowStaminaRetreat',
    'extras.ai.evadeCycle', 'extras.ai.evadeCycleIndex', 'extras.aiRed.reaction', 'extras.aiRed.reactionJitter', 'extras.aiRed.mistake', 'extras.aiRed.aggression',
    'extras.aiRed.hesitation', 'extras.aiRed.evadeChance', 'extras.aiRed.adaptation', 'extras.aiBlue.mistake', 'extras.aiBlue.evadeChance', 'extras.aiBlue.adaptation',
  ]},
  tecnico: {why: 'técnico de precisão/solver ou legado de comparação: sem efeito observável no cenário curto (não é parâmetro de gameplay, §14)', ids: [
    'test.maxFrame', 'test.arenaRadius', 'test.attack', 'test.attackReference', 'test.pushDuration', 'test.aiInterval', 'test.epsilon', 'test.contactShape',
  ]},
  mapa: {why: 'condição do mapa não ocorre no cenário curto (respawn de objeto, impacto em objeto, montagem em sólido, controle aéreo fino, pick-up repetido)', ids: [
    'map.wallBounceMultiplier', 'map.destructibleRespawnMin', 'map.destructibleRespawnMax', 'map.destructibleGhostPreview', 'map.impactMinSpeed', 'map.impactDamageToObject',
    'map.impactDamageToFighter', 'map.mountTolerance', 'map.jumpPassOver', 'map.launchSolidCollision', 'map.jumpAirControl', 'map.jumpCoyoteTime', 'map.footstoolCooldown',
    'map.footstoolVault', 'map.footstoolVaultMargin', 'map.healHp', 'map.healStamina', 'map.stageAttackBonus', 'map.stageCooldownReduction', 'map.stageSpeedBonus',
  ]},
  partida: {why: 'lido na montagem da partida (app/match-flow.js), fora do Game: sem A/B na simulação pura', ids: [
    'extras.gameModes.enemyMode', 'extras.gameModes.playerProfile',
  ]},
  ledge: {why: 'cenários de borda (subir, soltar, pendurar até o máximo, ser atingido, IA pendurada) não mudam: modo/dica/alcance de agarre, tempos de segurar e recarga pedem a borda em outra geometria ou input; coberto pelos testes de ledge', ids: [
    'ledge.mode', 'ledge.hint', 'ledge.reach', 'ledge.minHangHeight',
    'ledge.maxHang', 'ledge.climbHold', 'ledge.climbInvuln',
    'ledge.dropInput', 'ledge.cooldown', 'ledge.hurtDrops', 'ledge.aiClimb',
  ]},
  passiva: {why: 'gatilho da passiva não ocorreu no duelo de 5 s nem no roteiro de 7 s com a passiva no azul (detecção de ataque, veneno/queimadura, perda de item, queda de atributo ou recarga longa)', ids: [
    'passivas.poison-touch.dps', 'passivas.poison-touch.duration', 'passivas.poison-touch.cooldown', 'passivas.anticipation.speedPct', 'passivas.anticipation.duration',
    'passivas.anticipation.cooldown', 'passivas.anticipation.detectDistance', 'passivas.forewarn.windowBonus', 'passivas.forewarn.maxDuration', 'passivas.forewarn.cooldown',
    'passivas.forewarn.detectDistance', 'passivas.effect-spore.cooldown',
    'passivas.guts.attackPct', 'passivas.rough-skin.cooldown',
    'passivas.regenerator.quietTime', 'passivas.unburden.speedPct', 'passivas.unburden.duration', 'passivas.unburden.cooldown', 'passivas.stamina.defensePct',
    'passivas.stamina.cooldown', 'passivas.magic-guard.dotReductionPct', 'passivas.defiant.attackPct',
    'passivas.defiant.duration', 'passivas.defiant.cooldown', 'passivas.globals.detectDistance',
  ]},
  nav: {why: 'cenários de navegação (muro, plataforma, torre, arena completa) não ficam presos nem exigem ataque com desnível: detecção de travamento e limite de altura do ataque pendentes', ids: [
    'extras.nav.stuckTime', 'extras.nav.stuckDistance', 'extras.nav.attackMaxHeightDiff',
  ]},
  iaMoves: {why: 'decisão de carga/IA com Moves não ocorreu no duelo de 6 s com Reflect/Psyshock/Water Pulse/Swift', ids: [
    'world.charge.turnSlow', 'world.charge.dodgeCancelAfter', 'world.charge.interruptCooldownFactor', 'world.charge.bufferWindow', 'world.charge.boostStaminaPerSecond',
    'world.charge.boostStep', 'world.ai.evadeDistance', 'world.ai.pl2Distance', 'world.ai.pl3Distance', 'world.ai.reflectHold', 'world.ai.lastSecondDefend',
    'world.ai.barrierBreakRange', 'world.ai.barrierBreakChance', 'world.ai.afterChargeWait',
  ]},
  move: {why: 'os estágios curtos do Move (perto, defesa, longe, contra-ataque, correndo, carga curta, colado, duelo) não acionam esta condição (parede, alvo no ar, cadeia, limite técnico)', ids: [
    'world.airSlash.counterStagger', 'world.bounce.cooldown', 'world.bulletPunch.maxRise', 'world.bulletPunch.airReach', 'world.bulletPunch.rayStep',
    'world.bulletPunch.freeSearchRadius', 'world.emergingStone.maxRocks', 'world.emergingStone.rockSearch', 'world.emergingStone.startDistance', 'world.emergingStone.maxRise',
    'world.emergingStone.edgeMargin', 'world.emergingStone.radius', 'world.emergingStone.burrowMaxLife', 'world.emergingStone.rockSearchStep', 'world.emergingStone.supportTolerance',
    'world.feint.cooldown', 'world.feint.cancelAfter', 'world.feint.cancelWindow', 'world.feint.invulnStart', 'world.feint.invulnEnd', 'world.fireSpin.cooldown',
    'world.fireSpin.zoneHeight', 'world.fireSpin.occlusion', 'world.fireSpin.maxActive', 'world.fireSpin.startDistance', 'world.fireSpin.maxRise', 'world.fireSpin.pulsePl',
    'world.guardBreak.cooldown', 'world.guardBreak.maxCharge', 'world.guardBreak.stun', 'world.guardBreak.invulnerableSeconds', 'world.guardBreak.chainAfter',
    'world.guardBreak.hitStart', 'world.guardBreak.hitEnd', 'world.harden.cooldown', 'world.lunge.cooldown', 'world.lunge.invulnerableSeconds', 'world.lunge.chainAfter',
    'world.lunge.hitStart', 'world.lunge.hitEnd', 'world.psyshock.cooldown', 'world.psyshock.fanAngle', 'world.psyshock.knockbackLevelBonus', 'world.psyshock.counterStagger',
    'world.quickAttack.invulnerableSeconds', 'world.quickAttack.airReach', 'world.quickAttack.stuckTicks', 'world.reflect.cooldown', 'world.reflect.widthMin', 'world.reflect.widthMax',
    'world.reflect.heightMin', 'world.reflect.heightMax', 'world.reflect.durationBase', 'world.reflect.tackleRecoil', 'world.reflect.tackleStagger', 'world.reflect.tieTolerance',
    'world.reflect.maxReflections', 'world.reflect.burstRadius', 'world.reflect.burstHeight', 'world.reflect.burstLife', 'world.reflect.burstForce', 'world.reflect.burstVertical',
    'world.reflect.burstDamage', 'world.reflect.burstPush', 'world.reflect.burstHurt', 'world.riposte.cooldown', 'world.riposte.strikePl', 'world.riposte.shakeMult',
    'world.sandWave.cooldown', 'world.sandWave.pushDuration', 'world.sandWave.pushContinueAfterActive', 'world.sandWave.pushPreserveVelocity', 'world.sandWave.pushMaxSpeed',
    'world.sandWave.pushTargetSpeed', 'world.sandWave.pushRampTime', 'world.sandWave.pushClearsLocomotion', 'world.sandWave.pushCancelsDodge', 'world.sandWave.pushCancelsExistingDodge',
    'world.sandWave.wallStagger', 'world.sandWave.wallStaggerOn', 'world.sandWave.fogDarkness', 'world.sandWave.cell', 'world.sandWave.detour', 'world.sandWave.replanSteps',
    'world.sandWave.waveHeight', 'world.sandWave.wallPressMinSpeed', 'world.sandWave.wallUnpinDistance', 'world.sandWave.waveBottomTolerance', 'world.sandWave.hitsAirborne',
    'world.sandWave.maxTargets', 'world.secondWind.cooldown', 'world.secondWind.mobilityCostPct', 'world.seedBomb.occlusion', 'world.seedBomb.originHeight',
    'world.seedBomb.startDistance', 'world.seedBomb.maxRise', 'world.seedBomb.counterStagger', 'world.seedBomb.seedPl', 'world.spikes.cooldown', 'world.spikes.damage',
    'world.spikes.knockbackH', 'world.spikes.knockbackV', 'world.spikes.armDelay', 'world.spikes.markerAccel', 'world.spikes.markerSpeed', 'world.spikes.startDistance',
    'world.spikes.maxRise', 'world.spikes.trapHeight', 'world.spikes.supportTolerance', 'world.spikes.trapPl', 'world.swift.fanAngle', 'world.swift.counterStagger',
    'world.waterPulse.damagePl3', 'world.waterPulse.knockbackPl3', 'world.waterPulse.counterStagger', 'world.waterPulse.plScaleBonus',
  ]},
});
const PENDING_BY_ID = new Map(Object.entries(SENSITIVITY_PENDING).flatMap(([k, g]) => g.ids.map(id => [id, k])));
export const pendingKey = s => PENDING_BY_ID.get(s.id) ?? null;
/** Cenários do slider, na ordem: Moves (estágios do próprio Move + duelo com ele equipado), passivas (duelo com a passiva), demais pelas SCENARIO_RULES. */
export function scenarioList(s) {
  const mv = s.moveGroup && EDITABLE_MOVES.find(m => m.group === s.moveGroup);
  if (mv) return [...moveScenarios(s.moveGroup), [`${mv.id}/duelo`, {label: `duelo IA × IA com ${mv.id} equipado (6 s)`, seconds: 6, config: bothAi, setup: g => {duelSetup()(g);g.setLoadout(0, [mv.id]);g.setLoadout(1, [mv.id]);}, cmds: aiCmds}]];
  const pas = s.path.match(/^passivas\.([\w-]+)\./);
  if (pas && pas[1] !== 'globals') return [[`passiva/${pas[1]}`, passiveDuel(pas[1])], [`passiva/${pas[1]}/roteiro`, passiveScript(pas[1])]];
  if (pas) return [['passiva/anticipation', passiveDuel('anticipation')], ['passiva/forewarn', passiveDuel('forewarn')]];
  return scenariosFor(s).map(id => [id, SCENARIOS[id]]);
}
/** A/B de um slider de gameplay: {status: 'muda'|'igual'|'erro', scenario, detail}. */
export function abSensitivity(s) {
  const list = scenarioList(s), enable = enablersOf(s);
  try {
    for (const [id, sc] of list) {
      const t = lockstep(sc, s.path, s.min, s.max, enable);
      if (t >= 0) return {status: 'muda', scenario: id, detail: `${sc.label}: diverge no passo ${t}`};
    }
    return {status: 'igual', scenario: null, detail: `sem diferença em ${list.map(([id]) => id).join(', ')}`};
  } catch (e) {return {status: 'erro', scenario: null, detail: String(e.message).slice(0, 140)};}
}

// ---------- classificação, parâmetros ocultos e unidade ----------
/** Números de gameplay SEM slider de propósito: limites técnicos do motor (não viram slider de gameplay, §14). */
export const TECHNICAL_NO_SLIDER = Object.freeze({
  'world.maxEntities': 'limite técnico de entidades simultâneas no mundo (salvaguarda de desempenho; acima dele a criação é recusada com evento)',
  'world.slots': 'quantidade de slots de Moves por lutador (estrutura do loadout e do HUD, não ajuste de equilíbrio)',
});
/** Sliders numéricos cujo formato não mostra unidade (fração/multiplicador mostrado como número puro). Orçamento: não pode crescer. */
export const UNIT_MISSING_BUDGET = 354;
/** Orçamentos que só podem DIMINUIR: sliders de gameplay sem A/B observável e, entre eles, os que só têm evidência fraca de consumidor. */
export const PENDING_BUDGET = 304;
export const WEAK_PENDING_BUDGET = 2;
export const pendingCount = () => Object.values(SENSITIVITY_PENDING).reduce((n, g) => n + g.ids.length, 0);
/** Órfãos com significado de jogo: a decisão (ligar com padrão neutro, manter como legado, remover com alias + migração de preset) é do responsável. */
export const OWNER_DECISIONS = Object.freeze([
  {id: 'rules.blockPushback', wired: 'empurraria o DEFENSOR para trás ao bloquear um tackle (hoje só existe o recuo do atacante: rules.recoil/recoilFraction); 0,5 m ligado mudaria toda defesa'},
  {id: 'rules.slamAngle', wired: 'fixaria o ângulo de mergulho do meteor slam (hoje o mergulho mira o rival em aimSlamDive); ligado trocaria a mira por um ângulo fixo'},
  {id: 'map.jumpLandingRecovery', wired: 'daria recuperação ao pousar de um pulo normal (hoje 0: physics.js land); 0,19 s ligado travaria o lutador a cada pulo'},
  {id: 'map.wallDamageMultiplier', wired: 'multiplicaria o dano na borda circular (hoje a borda não causa dano próprio; o wall-splat usa rules.wallSplatDamage = 0); com 1 não mudaria nada até existir dano de borda'},
  {id: 'actions.sprint.exhaustedStop', wired: 'permitiria (0) continuar o sprint com stamina zerada; hoje o sprint SEMPRE para na exaustão; com 1 o comportamento é o atual'},
  {id: 'extras.ai.revision', wired: 'voltaria a IA para a revisão 0/1 (hoje tactics.js fixa a revisão 2; revisionOverride só na avaliação pareada); 2 mantém o atual'},
  {id: 'map.stageCooldownReduction', wired: 'aplicaria −recarga por estágio de Recarga (hoje SÓ o HUD de progresso mostra o bônus; a simulação não o aplica): achado F7, consumidor fraco (só exibição)'},
  {id: 'map.stageSpeedBonus', wired: 'aplicaria +velocidade por estágio de Velocidade (hoje SÓ o HUD de progresso mostra o bônus; a simulação não o aplica): achado F7, consumidor fraco (só exibição)'},
]);
export const missingUnit = s => s.unit === '—' && !['toggle', 'select', 'color'].includes(s.kind);
/** {kind: 'orfao'|'visual'|'pendente'|'gameplay', why} de um slider. */
export function classify(s) {
  const orphan = ORPHANS_LABELED.find(o => o.id === s.id);if (orphan) return {kind: 'orfao', why: orphan.why};
  const vis = visualReason(s);if (vis) return {kind: 'visual', why: vis};
  const pk = pendingKey(s);if (pk) return {kind: 'pendente', why: SENSITIVITY_PENDING[pk].why, key: pk};
  return {kind: 'gameplay', why: null};
}
/** Controle do passo travado: o mesmo valor nos dois lados NÃO pode divergir (prova que nada global entre os dois Games cria diferença falsa). */
export function controlRun(s, scenarioId) {const sc = scenarioList(s).find(([id]) => id === scenarioId)?.[1];return lockstep(sc, s.path, s.value, s.value, enablersOf(s));}
/** Reexecuta UM cenário nomeado (o registrado na matriz) e diz se o mín × máx diverge. */
export function verifyScenario(s, scenarioId) {
  const sc = scenarioList(s).find(([id]) => id === scenarioId)?.[1];if (!sc) return {ok: false, detail: `cenário ${scenarioId} não existe para ${s.id}`};
  try {const t = lockstep(sc, s.path, s.min, s.max, enablersOf(s));return t >= 0 ? {ok: true, detail: `diverge no passo ${t}`} : {ok: false, detail: `${scenarioId}: mín e máx idênticos`};} catch (e) {return {ok: false, detail: String(e.message)};}
}

// ---------- matriz (docs/MATRIZ_SLIDERS_F7.md) ----------
const num = v => typeof v === 'number' ? String(+v.toPrecision(6)) : String(v);
const cell = v => String(v ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
/** Sem o número da linha do consumidor: o teste compara a matriz com a regeneração ignorando só o deslocamento de linhas no código. */
export const normalizeMatrix = text => text.replace(/\r\n/g, '\n').replace(/(\.(?:js|mjs|json)):\d+/g, '$1');
/** Monta a matriz. `abFor(s)` devolve o texto da coluna A/B dos sliders de gameplay ('muda · <cenário>' ou 'FALHA: …'). */
export async function buildMatrix(abFor) {
  const sliders = await allSliders(), counts = {total: sliders.length, ajustes: 0, move: 0, gameplay: 0, muda: 0, falha: 0, visual: 0, pendente: 0, orfao: 0, weakPending: 0, weak: 0};
  const sections = new Map();
  for (const s of sliders) {
    counts[s.source === 'move' ? 'move' : 'ajustes']++;
    const c = classify(s), con = findConsumer(s);
    let ab;
    if (c.kind === 'gameplay') {counts.gameplay++;ab = abFor(s);if (ab.startsWith('muda')) counts.muda++;else counts.falha++;}
    else {counts[c.kind]++;ab = c.kind === 'orfao' ? 'sem efeito (órfão rotulado)' : c.kind === 'visual' ? 'visual/depuração' : `pendente (${c.key})`;}
    const line = `| \`${s.id}\` | ${cell(s.label)} | ${cell(s.unit)} | ${num(s.min)} | ${num(s.max)} | ${num(s.step)} | ${num(s.value)} | ${con ? `${con.file}:${con.line}${con.weak ? ' (consumerWeak)' : ''}` : '**SEM CONSUMIDOR**'} | ${ab} |`;
    if (con?.weak) {counts.weak++;if (c.kind === 'pendente') counts.weakPending++;}
    if (!sections.has(s.section)) sections.set(s.section, []);
    sections.get(s.section).push(line);
  }
  const hidden = hiddenParams(sliders).filter(h => !(h in TECHNICAL_NO_SLIDER)), units = sliders.filter(missingUnit).length;
  const out = ['# Matriz de cobertura dos sliders (F7)', '',
    '> GERADO por `scripts/gen-matriz-sliders.mjs` a partir de `prototypes/combat-lab/test/f7-sliders-coverage-lib.mjs`. Não edite à mão: rode `node scripts/gen-matriz-sliders.mjs`.',
    '> O teste `prototypes/combat-lab/test/f7-sliders-coverage.test.mjs` exige esta matriz em dia (ignora só o número da linha do consumidor) e reexecuta o cenário A/B de cada linha «muda».', '',
    'Todo slider sai das definições reais: manifesto do Ajustes (`ui/tuning.js` `tuningManifest()`: `SECTIONS` de `ui/tuning-meta.js` + `EXTRA_SECTIONS`) e aba Moves/Editor (`MOVES_PARAMS` de `ui/moves-panel.js` = carga, IA e laser compartilhados + fichas `sim/moves/*.params.js`).',
    'Para cada um: caminho em `C`, rótulo, unidade (lida do formato do próprio slider), faixa efetiva, padrão (`defaults()`, com a calibração), round-trip JSON (exportar → importar pelo `previewTuningImport` do Ajustes e pelo preset salvo), consumidor real (busca estática fora dos arquivos de definição) e A/B (mín × máx num cenário curto e determinístico, 120 Hz, semente fixa).', '',
    '## Resumo', '',
    `- Sliders: **${counts.total}** (Ajustes ${counts.ajustes} · Moves ${counts.move}).`,
    `- Gameplay com A/B: **${counts.gameplay}** — muda no cenário: **${counts.muda}**${counts.falha ? ` · **FALHA: ${counts.falha}**` : ''}.`,
    `- Visual/depuração (sem A/B da simulação): ${counts.visual}. Pendentes de cenário (listados com motivo): ${counts.pendente}. Órfãos rotulados «(sem efeito)»: ${counts.orfao}.`,
    `- Parâmetros jogáveis sem slider: ${hidden.length ? hidden.map(h => '`' + h + '`').join(', ') : 'nenhum'} (fora os ${Object.keys(TECHNICAL_NO_SLIDER).length} limites técnicos abaixo).`,
    `- Sliders numéricos sem unidade no formato (número puro: fração, multiplicador): ${units} (orçamento ${UNIT_MISSING_BUDGET}, não pode crescer).`, '',
    `- Pendentes de A/B: ${counts.pendente} (orçamento ${PENDING_BUDGET}, só diminui); pendentes só com evidência fraca de consumidor (consumerWeak): ${counts.weakPending} (orçamento ${WEAK_PENDING_BUDGET}). Total com evidência fraca (inclui visuais): ${counts.weak}.`, '',
    '## Decisões pendentes do responsável', '',
    'Sliders com significado de jogo que hoje não agem (ou só aparecem no HUD). Não foram ligados (mudaria o jogo no padrão) nem apagados (proibido sem pedido). Opções: ligar com padrão neutro, manter como legado ou remover com alias + migração de preset.', '',
    ...OWNER_DECISIONS.map(d => {const s = sliders.find(x => x.id === d.id);return `- \`${d.id}\` (${s ? cell(s.label) : '?'}; padrão ${s ? num(s.value) : '?'} ${s ? cell(s.unit) : ''}): ${d.wired}.`;}), '',
    '## Órfãos (sem consumidor) — rotulados «(sem efeito)» na interface, nunca apagados', '',
    ...ORPHANS_LABELED.map(o => `- \`${o.id}\`: ${o.why}.`), '',
    '## Consumidores lidos por objeto genérico (conferidos)', '',
    ...MANUAL_CONSUMERS.map(m => `- \`${m.match.source}\`: ${m.why}.`), ...DYNAMIC_FAMILIES.map(m => `- \`${m.match.source}\`: ${m.why}.`), '',
    '## Visual/depuração (VISUAL_OR_DEBUG)', '',
    ...VISUAL_OR_DEBUG.map(v => `- ${typeof v.match === 'function' ? 'parâmetro visual do Move' : '`' + v.match.source + '`'}: ${v.why}.`), '',
    '## Pendentes de cenário A/B (SENSITIVITY_PENDING)', '',
    ...Object.entries(SENSITIVITY_PENDING).map(([k, g]) => `- **${k}** (${g.ids.length}): ${g.why}.`), '',
    '## Limites técnicos sem slider', '',
    ...Object.entries(TECHNICAL_NO_SLIDER).map(([k, w]) => `- \`${k}\`: ${w}.`), '',
    '## Cenários A/B', '',
    ...Object.entries(SCENARIOS).map(([k, sc]) => `- \`${k}\`: ${sc.label} (${sc.seconds} s).`),
    '- `<move>/perto|defesa|longe|contra-ataque|correndo|carga curta|colado|duelo`: o azul usa o Move contra o vermelho em cada estágio (duelo: IA × IA com o Move equipado, 6 s).',
    '- `passiva/<id>`: duelo IA × IA de 5 s com a passiva nos dois lados e vida em 40%.', ''];
  for (const [section, lines] of sections) out.push(`## ${section}`, '', '| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |', '|---|---|---|---|---|---|---|---|---|', ...lines, '');
  return out.join('\n');
}
/** Lê da matriz já gerada a coluna A/B de cada slider (o teste reexecuta o cenário citado). */
export function claimsFrom(text) {
  const map = new Map();
  for (const l of text.replace(/\r\n/g, '\n').split('\n')) {const m = l.match(/^\| `([^`]+)` \|.*\| ([^|]+) \|$/);if (m) map.set(m[1], m[2].trim());}
  return map;
}
/** Texto A/B do gerador: busca completa nos cenários do slider. */
export const searchAb = s => {const r = abSensitivity(s);return r.status === 'muda' ? `muda · ${r.scenario}` : `FALHA: ${r.status} (${r.detail})`;};
