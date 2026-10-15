// Constrói os três protótipos de rigging em arquivos HTML únicos e independentes,
// incluindo Three.js, controles e estilos embutidos sem dependências externas de rede.
import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('.', import.meta.url);

async function buildProposal(name, entryJs, styleCss, templateHtml, outHtml) {
  console.log(`[Build] Compilando ${name}...`);

  // Bundle JavaScript com Three.js e todos os módulos
  const bundle = await build({
    entryPoints: [fileURLToPath(new URL(entryJs, root))],
    bundle: true,
    write: false,
    format: 'iife',
    minify: true,
    target: 'es2022'
  });

  const [sharedCss, proposalCss, template] = await Promise.all([
    readFile(new URL('src/shared/styles.css', root), 'utf8'),
    readFile(new URL(styleCss, root), 'utf8'),
    readFile(new URL(templateHtml, root), 'utf8')
  ]);

  const script = bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  const styles = `<style>\n${sharedCss}\n${proposalCss}\n</style>`;

  const html = template
    .replace('<!--__STYLES__-->', () => styles)
    .replace('<!--__SCRIPTS__-->', () => `<script>\n${script}\n</script>`);

  await writeFile(new URL(outHtml, root), html, 'utf8');
  console.log(`✓ ${outHtml} gerado com sucesso: ${(html.length / 1024).toFixed(0)} KB`);
}

async function main() {
  await buildProposal(
    'Proposta A (Workspace)',
    'src/proposta-a/app.js',
    'src/proposta-a/style.css',
    'src/proposta-a/template.html',
    'proposta-a.html'
  );

  await buildProposal(
    'Proposta B (Guided Rigging)',
    'src/proposta-b/app.js',
    'src/proposta-b/style.css',
    'src/proposta-b/template.html',
    'proposta-b.html'
  );

  await buildProposal(
    'Proposta C (Hybrid Studio)',
    'src/proposta-c/app.js',
    'src/proposta-c/style.css',
    'src/proposta-c/template.html',
    'proposta-c.html'
  );

  console.log('Todos os 3 protótipos foram compilados com sucesso em arquivos HTML únicos!');
}

main().catch(err => {
  console.error('Falha na compilação dos protótipos:', err);
  process.exit(1);
});
