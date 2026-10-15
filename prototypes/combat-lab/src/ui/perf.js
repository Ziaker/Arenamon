// Medidor de desempenho real: tempos por quadro medidos no próprio laço (CPU), contadores do renderizador e das
// partículas e, só quando o navegador expõe uma consulta de tempo de GPU confiável, o tempo de GPU. Tempo de CPU
// gasto para enviar o desenho ao WebGL NÃO é tempo de GPU; sem a extensão, o tempo de GPU aparece como indisponível.

/** Informações do renderizador (inclui detecção de renderização por software). */
export function rendererInfo(renderer) {
  const gl = renderer.getContext(), dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const vendor = dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR), name = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  const software = /swiftshader|llvmpipe|softpipe|basic render|microsoft basic|software/i.test(`${vendor} ${name}`);
  const webgl2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
  return {vendor: String(vendor), renderer: String(name), software, webgl2, unmasked: !!dbg};
}

/** Consulta de tempo de GPU (EXT_disjoint_timer_query_webgl2). Resultados chegam alguns quadros depois. */
export function createGpuTimer(renderer) {
  const gl = renderer.getContext(), ext = gl.getExtension?.('EXT_disjoint_timer_query_webgl2');
  if (!ext || typeof gl.createQuery !== 'function') return {available: false, reason: 'o navegador não expõe EXT_disjoint_timer_query_webgl2 (comum: desligado por padrão em navegadores comuns)', begin() {}, end() {}, poll() {return null;}};
  const pending = [], done = [];let active = null;
  return {
    available: true, reason: '',
    begin() {if (active || pending.length > 4) return;active = gl.createQuery();gl.beginQuery(ext.TIME_ELAPSED_EXT, active);},
    end() {if (!active) return;gl.endQuery(ext.TIME_ELAPSED_EXT);pending.push(active);active = null;},
    /** Lê os resultados prontos (ms); descarta medições afetadas por disjunção (troca de contexto/frequência). */
    poll() {
      const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);
      while (pending.length && gl.getQueryParameter(pending[0], gl.QUERY_RESULT_AVAILABLE)) {const q = pending.shift();const ns = gl.getQueryParameter(q, gl.QUERY_RESULT);gl.deleteQuery(q);if (!disjoint) done.push(ns / 1e6);}
      return done.length ? done.splice(0) : null;
    },
  };
}

const RING = 600;
/** Janela deslizante de medições por quadro. */
export class PerfMeter {
  constructor() {this.reset();this.fps = 0;}
  reset() {this.samples = [];this.gpu = [];this.resetAt = performance.now();this.spawned0 = null;this.peak = 0;}
  get emaFrameMs() {return this.emaMs ?? null;}
  /** s: {frameMs, simMs, steps, animMs, vfxMs, renderMs, overlayMs, calls, triangles, active, spawned, byType} */
  push(s) {
    this.samples.push(s);if (this.samples.length > RING) this.samples.shift();
    if (this.spawned0 === null) this.spawned0 = s.spawned;this.peak = Math.max(this.peak, s.active ?? 0);
    // FPS suavizado = 1000 ÷ média móvel exponencial do tempo de quadro (quadros muito curtos não geram picos).
    this.emaMs = this.emaMs ? this.emaMs + (s.frameMs - this.emaMs) * .05 : s.frameMs;this.fps = 1000 / Math.max(.1, this.emaMs);
  }
  pushGpu(list) {if (list) {this.gpu.push(...list);if (this.gpu.length > RING) this.gpu.splice(0, this.gpu.length - RING);}}
  summary(last = this.samples.length) {
    const s = this.samples.slice(-last), n = s.length;if (!n) return null;
    const avg = k => s.reduce((a, x) => a + (x[k] ?? 0), 0) / n, max = k => Math.max(...s.map(x => x[k] ?? 0));
    const ft = s.map(x => x.frameMs).sort((a, b) => a - b), p95 = ft[Math.min(n - 1, Math.floor(n * .95))];
    const work = s.map(x => x.simMs + x.animMs + x.vfxMs + x.renderMs + x.overlayMs).sort((a, b) => a - b);
    const g = this.gpu.slice(-last);
    return {frames: n, fps: this.fps, fpsAvg: 1000 / (ft.reduce((a, b) => a + b, 0) / n), frameAvg: avg('frameMs'), frameP95: p95, frameWorst: ft[n - 1],
      workAvg: work.reduce((a, b) => a + b, 0) / n, workP95: work[Math.min(n - 1, Math.floor(n * .95))], simAvg: avg('simMs'), stepsAvg: avg('steps'), animAvg: avg('animMs'), vfxAvg: avg('vfxMs'), renderAvg: avg('renderMs'), overlayAvg: avg('overlayMs'),
      callsAvg: avg('calls'), callsMax: max('calls'), trianglesAvg: avg('triangles'), activeAvg: avg('active'), activePeak: this.peak, spawned: (s[n - 1].spawned ?? 0) - (this.spawned0 ?? 0),
      gpuAvg: g.length ? g.reduce((a, b) => a + b, 0) / g.length : null, gpuSamples: g.length};
  }
}
export const fmtMs = v => v == null ? 'indisponível' : `${v.toFixed(v < 10 ? 2 : 1)} ms`;
