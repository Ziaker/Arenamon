// Injeta parâmetros de software GL (SwiftShader) no launcher do Playwright em ambiente CI
import fs from 'node:fs';
import path from 'node:path';

const target = path.resolve('node_modules/playwright-core/index.js');
if (fs.existsSync(target)) {
  const content = fs.readFileSync(target, 'utf8');
  if (!content.includes('__swiftshader_patched')) {
    const patch = `
// __swiftshader_patched
try {
  const _origLaunch = module.exports.chromium.launch.bind(module.exports.chromium);
  module.exports.chromium.launch = function(opts = {}) {
    const extraArgs = ['--use-angle=swiftshader', '--disable-gpu-sandbox', '--no-sandbox'];
    const args = Array.isArray(opts.args) ? [...opts.args, ...extraArgs] : extraArgs;
    return _origLaunch({ ...opts, args });
  };
} catch (e) {
  console.warn('Falha ao aplicar patch do SwiftShader no Playwright:', e.message);
}
`;
    fs.appendFileSync(target, patch);
    console.log('✓ Patch SwiftShader aplicado em playwright-core/index.js para CI');
  }
}
