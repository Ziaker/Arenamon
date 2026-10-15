// Comparação jogável A × B: alterna dois conjuntos de parâmetros DURANTE a partida, sem reiniciar.
// Regras de segurança (auditoria em presets.js › switchClass):
//   • “live”: aplicados no próximo passo (a física continua do estado atual: sem teletransporte nem mudança retroativa);
//   • “boundary”: guardados e aplicados só quando nenhum lutador está em ação, recuo, stun, voo, recuperação,
//     empurrão, buffer ou hitstop — a ação em curso termina com os parâmetros com que começou;
//   • nunca trocados: passo da simulação, arena, vida/stamina máximas e teclas (exigem reiniciar ou quebrariam o controle).
// Só os caminhos definidos em A ou B mudam; o que nenhum dos dois define fica intacto. Stamina, vida, posição e
// estado de combate nunca são escritos por este módulo.
import {switchClass, categoryOf, safeBoundary} from './presets.js';

export const NEVER_SWITCHED = path => switchClass(path) === 'restart' || categoryOf(path) === 'bindings';
const same = (a, b) => Math.abs(a - b) <= 1e-12 * Math.max(1, Math.abs(a), Math.abs(b));

export class ABSwitch {
  /** get(path) → valor atual; setTransient([[path, valor]]) → aplica sem histórico. */
  constructor({get, setTransient}) {this.get = get;this.setTransient = setTransient;this.active = false;this.log = [];this.pending = [];}
  /** sides: {A: {name, values}, B: {name, values}}. Devolve o plano (caminhos, excluídos, classes). */
  start(sides, {side = 'A', game = null, tick = 0} = {}) {
    const paths = [...new Set([...Object.keys(sides.A.values), ...Object.keys(sides.B.values)])];
    this.baseline = Object.fromEntries(paths.map(p => [p, this.get(p)]));
    const val = s => Object.fromEntries(paths.map(p => [p, sides[s].values[p] ?? this.baseline[p]]));
    this.values = {A: val('A'), B: val('B')};this.names = {A: sides.A.name, B: sides.B.name};
    this.excluded = paths.filter(p => NEVER_SWITCHED(p) && !same(this.values.A[p], this.values.B[p]));
    this.paths = paths.filter(p => !NEVER_SWITCHED(p));
    this.differing = this.paths.filter(p => !same(this.values.A[p], this.values.B[p]));
    this.classes = Object.fromEntries(this.paths.map(p => [p, switchClass(p)]));
    this.active = true;this.side = null;this.pending = [];this.log = [];
    this.setSide(side, game, tick);
    return {paths: this.paths, differing: this.differing, excluded: this.excluded, live: this.differing.filter(p => this.classes[p] === 'live'), boundary: this.differing.filter(p => this.classes[p] === 'boundary')};
  }
  toggle(game, tick) {return this.setSide(this.side === 'A' ? 'B' : 'A', game, tick);}
  /** Troca de lado: “live” agora; “boundary” agora se for seguro, senão no primeiro passo seguro. */
  setSide(side, game = null, tick = 0) {
    if (!this.active) return null;
    this.side = side;const v = this.values[side], live = [], boundary = [];
    for (const p of this.paths) (this.classes[p] === 'live' ? live : boundary).push([p, v[p]]);
    const running = game && (game.phase === 'playing' || game.phase === 'finishing');
    const now = !running || safeBoundary(game);
    this.setTransient(now ? [...live, ...boundary] : live);
    this.pending = now ? [] : boundary.filter(([p, x]) => !same(this.get(p), x));
    const entry = {side, tick, live: live.filter(([p]) => this.differing.includes(p)).length, deferred: this.pending.length, appliedTick: this.pending.length ? null : tick};
    this.log.push(entry);if (this.log.length > 200) this.log.shift();
    return entry;
  }
  /** Chamado antes de cada passo da simulação ao vivo: aplica os parâmetros adiados assim que for seguro. */
  beforeStep(game) {
    if (!this.active || !this.pending.length || !safeBoundary(game)) return 0;
    const n = this.pending.length;this.setTransient(this.pending);this.pending = [];
    const last = this.log.at(-1);if (last) last.appliedTick = game.tick;
    return n;
  }
  /** Encerra: keep 'A' | 'B' | 'baseline'. Devolve as mudanças [[path, valor]] para registrar no histórico de ajustes. */
  stop(keep = 'baseline') {
    if (!this.active) return [];
    const target = keep === 'baseline' ? this.baseline : this.values[keep];
    this.active = false;this.pending = [];
    return Object.entries(target).filter(([p]) => !NEVER_SWITCHED(p) || keep === 'baseline').map(([p, v]) => [p, v]);
  }
  get status() {return {active: this.active, side: this.side, name: this.active ? this.names[this.side] : null, pending: this.pending.length, differing: this.differing?.length ?? 0, excluded: this.excluded?.length ?? 0};}
}
