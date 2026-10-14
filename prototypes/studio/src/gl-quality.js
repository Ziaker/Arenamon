// Qualidade da renderização conforme o hardware.
// Sem GPU, o WebGL roda em software (SwiftShader, llvmpipe, WARP). Cada quadro do canvas, desenhado continuamente
// enquanto a animação toca, precisa ser entregue à composição da página também em software. Com o canvas em tamanho
// cheio a 60 quadros/s, a página passa segundos sem produzir quadros a cada troca de painel e a interface parece travada.
// Medido no executor do CI (sem GPU): etapa de layout do verify ~2 s localmente, 100–230 s no CI; 5,6 s no CI com o
// canvas fora da composição.
// Modo leve (só sem GPU): sem MSAA, resolução interna de 50%, no máximo 30 quadros compostos por segundo (o tempo da
// animação continua exato) e sem desfoque de fundo (backdrop-filter). Com GPU nada muda.
// Parâmetros na URL: ?gl=full força o modo completo; ?gl=lite, o leve; ?glscale=0.5 e ?glfps=30 ajustam o modo leve.
const params = new URLSearchParams(location.search), query = params.get('gl');

function detectSoftware() {
  try {
    const canvas = document.createElement('canvas'), gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return false;
    const ext = gl.getExtension('WEBGL_debug_renderer_info'), name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /swiftshader|llvmpipe|softpipe|microsoft basic render|\bwarp\b/i.test(name);
  } catch {return false;}
}
const number = (key, fallback, min, max) => {const v = Number(params.get(key));return Number.isFinite(v) && v >= min && v <= max ? v : fallback;};

const softwareGL = query === 'lite' ? true : query === 'full' ? false : detectSoftware();
export const GL_QUALITY = Object.freeze(softwareGL
  ? {softwareGL, mode: 'leve', antialias: false, pixelRatio: number('glscale', .5, .25, 1), maxFps: number('glfps', 30, 10, 60), blur: false, forced: query === 'lite'}
  : {softwareGL, mode: 'completo', antialias: true, pixelRatio: 1, maxFps: 0, blur: true, forced: query === 'full'});
window.__studioGL = GL_QUALITY;
if (!GL_QUALITY.blur) document.documentElement.classList.add('gl-lite');
