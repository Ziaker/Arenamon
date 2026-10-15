// Gravação de partida: semente, perfis, comportamento, ajustes e os comandos do azul a cada passo (comprimidos por
// repetição). Reproduzir com os ajustes da gravação repete a luta exatamente; com os ajustes atuais, repete as
// mesmas entradas do azul em outra configuração (o vermelho reage de novo, pela IA).
export const MATCH_SCHEMA = 'arenamon-match';

/** Comprime comandos idênticos consecutivos: [[repetições, comando], ...]. */
export function packCommands(commands) {
  const out = [];let prev = null;
  for (const c of commands) {const key = JSON.stringify(c);if (prev && prev.key === key) prev.run[0]++;else {prev = {key, run: [1, c]};out.push(prev.run);}}
  return out;
}
export function unpackCommands(runs) {
  const out = [];for (const [n, c] of runs) for (let i = 0; i < n; i++) out.push(structuredClone(c));return out;
}

export class MatchRecording {
  constructor() {this.meta = null;this.commands = [];}
  start(meta) {this.meta = {...meta, startedAt: new Date().toISOString()};this.commands = [];this.commands1 = [];}
  /** Comando usado no passo `tick` (o índice é o passo, então retomar do passado apaga o futuro). */
  /** command1: comando do vermelho quando ele é controlado manualmente (senão a IA decide de novo na reprodução). */
  record(tick, command, command1) {if (!this.meta) return;this.commands.length = tick;this.commands[tick] = structuredClone(command);this.commands1 ??= [];this.commands1.length = tick;this.commands1[tick] = command1 ? structuredClone(command1) : null;}
  truncate(tick) {if (this.commands.length > tick) this.commands.length = tick;if (this.commands1?.length > tick) this.commands1.length = tick;}
  get ticks() {return this.commands.length;}
  toJSON() {
    const manual = this.commands1?.some(Boolean);
    return {schema: MATCH_SCHEMA, version: 1, ...this.meta, ticks: this.commands.length, commands: packCommands(this.commands.map(c => c ?? null)), ...(manual ? {commands1: packCommands(Array.from({length: this.commands.length}, (_, i) => this.commands1[i] ?? null))} : {})};
  }
}

/** Valida e expande um JSON de gravação. */
export function parseRecording(raw) {
  let data;try {data = typeof raw === 'string' ? JSON.parse(raw) : raw;} catch (e) {return {error: 'JSON inválido: ' + e.message};}
  if (data?.schema !== MATCH_SCHEMA || !Array.isArray(data.commands)) return {error: 'Não é uma gravação de partida do laboratório.'};
  const commands = unpackCommands(data.commands);
  if (commands.length !== data.ticks) return {error: `Gravação incompleta: ${commands.length} de ${data.ticks} passos.`};
  return {data, commands, commands1: data.commands1 ? unpackCommands(data.commands1) : null};
}
