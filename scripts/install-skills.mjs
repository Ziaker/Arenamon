#!/usr/bin/env node
// Instala/verifica as GameDev Agent Skills no escopo do projeto.
//  - Fonte canônica versionada: tools/gamedev-skills/<skill>/SKILL.md (Apache-2.0, LICENSE/NOTICE junto).
//  - Destino do Claude Code: .claude/skills/<skill>/ (carregado nativamente pelo Claude Code).
//  - Destino de Codex/Gemini/Antigravity: .agents/skills/<skill>/ (ignorado pelo Git).
// Uso: node scripts/install-skills.mjs          (copia)
//      node scripts/install-skills.mjs --check  (só verifica; sai com 1 se divergir ou se o frontmatter for inválido)
// Nada global é tocado.
import {readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync, rmSync} from 'node:fs';
import {join, resolve, dirname, relative} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'tools', 'gamedev-skills');
const targets = [join(root, '.claude', 'skills'), join(root, '.agents', 'skills')];
const check = process.argv.includes('--check');

const skills = readdirSync(src, {withFileTypes: true}).filter(d => d.isDirectory() && existsSync(join(src, d.name, 'SKILL.md'))).map(d => d.name);

/** Valida frontmatter YAML mínimo: name igual à pasta e description não vazia. */
function frontmatter(name) {
  const text = readFileSync(join(src, name, 'SKILL.md'), 'utf8').replace(/\r\n/g, '\n');
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  const errs = [];
  if (!m) return ['sem frontmatter'];
  const nm = m[1].match(/^name:\s*(.+)$/m)?.[1]?.trim();
  if (nm !== name) errs.push(`name="${nm}" difere da pasta "${name}"`);
  if (!/^description:\s*(>|\|)?\s*\S/m.test(m[1]) && !/^description:\s*\n\s+\S/m.test(m[1])) errs.push('description vazia');
  return errs;
}
function files(dir, base = dir, out = []) {
  for (const e of readdirSync(dir, {withFileTypes: true})) {
    const p = join(dir, e.name);
    if (e.isDirectory()) files(p, base, out); else out.push([relative(base, p).split('\\').join('/'), readFileSync(p).toString('base64')]);
  }
  return out.sort(([a], [b]) => a < b ? -1 : 1);
}

let problems = 0;
for (const s of skills) {
  const errs = frontmatter(s);
  if (errs.length) {problems++;console.error(`✗ ${s}: ${errs.join('; ')}`);}
}
for (const t of targets) {
  for (const s of skills) {
    const dest = join(t, s);
    if (check) {
      const same = existsSync(dest) && JSON.stringify(files(join(src, s))) === JSON.stringify(files(dest));
      if (!same) {
        // .agents/ é opcional e ignorado pelo Git; só .claude/skills é obrigatório.
        if (t.includes('.claude')) {problems++;console.error(`✗ ${relative(root, dest)} ausente ou diferente da fonte (rode: npm run skills:install)`);}
      }
    } else {
      rmSync(dest, {recursive: true, force: true});
      mkdirSync(dirname(dest), {recursive: true});
      for (const [rel, b64] of files(join(src, s))) {
        const out = join(dest, ...rel.split('/'));
        mkdirSync(dirname(out), {recursive: true});
        writeFileSync(out, Buffer.from(b64, 'base64'));
      }
    }
  }
}
console.log(`${check ? 'Verificadas' : 'Instaladas'} ${skills.length} skills (${skills.join(', ')})`);
if (problems) {console.error(`${problems} problema(s).`);process.exit(1);}
console.log(check ? '✓ skills em sincronia com tools/gamedev-skills' : `✓ copiadas para ${targets.map(t => relative(root, t)).join(' e ')}`);
