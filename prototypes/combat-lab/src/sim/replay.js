// Replay por estado: guarda o estado completo de cada passo (últimos N segundos). Voltar e avançar
// quadro a quadro restaura estados exatos; retomar a partir de um ponto descarta o futuro gravado.
export class ReplayBuffer {
  constructor(capacity = 120 * 12) {this.capacity = capacity;this.frames = [];this.cursor = -1;}
  clear() {this.frames = [];this.cursor = -1;}
  push(state) {
    if (this.cursor >= 0 && this.cursor < this.frames.length - 1) this.frames.length = this.cursor + 1; // ramificação
    this.frames.push(state);if (this.frames.length > this.capacity) this.frames.shift();this.cursor = this.frames.length - 1;
  }
  get length() {return this.frames.length;}
  get current() {return this.frames[this.cursor] ?? null;}
  get atEnd() {return this.cursor === this.frames.length - 1;}
  seek(index) {this.cursor = Math.max(0, Math.min(this.frames.length - 1, index));return this.current;}
  step(delta) {return this.seek(this.cursor + delta);}
}
