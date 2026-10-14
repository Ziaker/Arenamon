// Qualidade da renderização conforme o hardware.
// Sem GPU, o WebGL roda em software (SwiftShader, llvmpipe, WARP). Nesse caso o antisserrilhamento (MSAA) multiplica
// o custo de cada quadro, que é desenhado e composto continuamente enquanto a animação toca. A cada troca de painel
// o canvas muda de tamanho, a página deixa de produzir quadros por vários segundos e a interface parece travada.
// No executor do CI (sem GPU), isso levava a etapa de layout do verify de ~2 s para 100–230 s.
// Sem GPU, o Studio usa o modo leve (sem MSAA). Com GPU nada muda. ?gl=full força o modo completo; ?gl=lite, o leve.
const query = new URLSearchParams(location.search).get('gl');

function detectSoftware() {
  try {
    const canvas = document.createElement('canvas'), gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return false;
    const ext = gl.getExtension('WEBGL_debug_renderer_info'), name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /swiftshader|llvmpipe|softpipe|microsoft basic render|\bwarp\b/i.test(name);
  } catch {return false;}
}

const softwareGL = query === 'lite' ? true : query === 'full' ? false : detectSoftware();
export const GL_QUALITY = Object.freeze({softwareGL, antialias: !softwareGL, mode: softwareGL ? 'leve' : 'completo', forced: query === 'lite' || query === 'full'});
window.__studioGL = GL_QUALITY;
