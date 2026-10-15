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
  start(meta) {this.meta = {...meta, startedAt: new Date().toISOString()};this.commands = [];}
  /** Comando usado no passo `tick` (o índice é o passo, então retomar do passado apaga o futuro). */
  record(tick, command) {if (!this.meta) return;this.commands.length = tick;this.commands[tick] = structuredClone(command);}
  truncate(tick) {if (this.commands.length > tick) this.commands.length = tick;}
  get ticks() {return this.commands.length;}
  toJSON() {
    return {schema: MATCH_SCHEMA, version: 1, ...this.meta, ticks: this.commands.length, commands: packCommands(this.commands.map(c => c ?? null))};
  }
}

/** Valida e expande um JSON de gravação. */
export function parseRecording(raw) {
  let data;try {data = typeof raw === 'string' ? JSON.parse(raw) : raw;} catch (e) {return {error: 'JSON inválido: ' + e.message};}
  if (data?.schema !== MATCH_SCHEMA || !Array.isArray(data.commands)) return {error: 'Não é uma gravação de partida do laboratório.'};
  const commands = unpackCommands(data.commands);
  if (commands.length !== data.ticks) return {error: `Gravação incompleta: ${commands.length} de ${data.ticks} passos.`};
  return {data, commands};
}
