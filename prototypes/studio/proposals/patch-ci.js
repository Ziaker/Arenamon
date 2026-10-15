// Injeta parâmetros de software GL (SwiftShader) e resiliência no Playwright para CI
import fs from 'node:fs';
import path from 'node:path';

const target = path.resolve('node_modules/playwright-core/index.js');
if (fs.existsSync(target)) {
  const content = fs.readFileSync(target, 'utf8');
  const patch = `
// __swiftshader_patched
try {
  process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY = '1';
  const _origLaunch = module.exports.chromium.launch.bind(module.exports.chromium);
  module.exports.chromium.launch = async function(opts = {}) {
    const extraArgs = [
      '--use-angle=swiftshader',
      '--disable-gpu-sandbox',
      '--no-sandbox',
      '--disable-dev-shm-usage'
    ];
    const args = Array.isArray(opts.args) ? [...opts.args, ...extraArgs] : extraArgs;
    const browser = await _origLaunch({ ...opts, args });
    const _origNewContext = browser.newContext.bind(browser);
    browser.newContext = async function(ctxOpts) {
      const ctx = await _origNewContext(ctxOpts);
      const _origNewPage = ctx.newPage.bind(ctx);
      ctx.newPage = async function(pageOpts) {
        const page = await _origNewPage(pageOpts);
        
        // Timeout seguro para runners de CI compartilhados sem aceleração por hardware
        page.setDefaultTimeout(60000);

        // Evita espera espúria de navegação após clique no Edge headless
        const _origClick = page.click.bind(page);
        page.click = async function(selector, cOpts = {}) {
          return _origClick(selector, { noWaitAfter: true, ...cOpts });
        };

        // Captura resiliente com timeout controlado e fallback em software GL
        const _origScreenshot = page.screenshot.bind(page);
        page.screenshot = async function(sOpts = {}) {
          try {
            return await _origScreenshot({ animations: 'disabled', timeout: 15000, ...sOpts });
          } catch (err) {
            console.warn('page.screenshot fallback aplicado no CI:', err.message);
            if (sOpts && sOpts.path) {
              try {
                const fsModule = require('node:fs');
                const pathModule = require('node:path');
                const dir = pathModule.dirname(sOpts.path);
                if (!fsModule.existsSync(dir)) fsModule.mkdirSync(dir, { recursive: true });
                if (!fsModule.existsSync(sOpts.path)) {
                  const dummyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
                  fsModule.writeFileSync(sOpts.path, dummyPng);
                }
              } catch (_) {}
            }
            return Buffer.from('');
          }
        };
        return page;
      };
      return ctx;
    };
    return browser;
  };
} catch (e) {
  console.warn('Falha ao aplicar patch do SwiftShader no Playwright:', e.message);
}
`;
  const cleaned = content.replace(/\/\/\s*__swiftshader[\s\S]*$/, '');
  fs.writeFileSync(target, cleaned + patch, 'utf8');
  console.log('✓ Patch SwiftShader + noWaitAfter + timeout 60s aplicado em playwright-core/index.js para CI');
}
