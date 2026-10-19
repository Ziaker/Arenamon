#!/usr/bin/env node
/**
 * Conversor FBX → GLB para o personagem Mosh (cogumelo autoral)
 *
 * Uso:
 *   node scripts/convert-mosh-to-glb.mjs
 *   ARENAMON_BLENDER="C:\Program Files\Blender Foundation\Blender 4.2\blender.exe" node scripts/convert-mosh-to-glb.mjs
 *
 * Requisitos:
 *   - Blender 3.6+ (recomendado 4.x) no PATH ou via variável ARENAMON_BLENDER
 *   - Node.js 20+
 *
 * Saída:
 *   chars/mosh/mosh.glb          (modelo com rig + animações)
 *   chars/mosh/mosh-animations/  (animações separadas, opcional)
 */

import { spawn, execSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');

const MOSH_DIR = join(ROOT, 'chars', 'mosh');
const FBX_FILE = join(MOSH_DIR, 'Cogumelo_com_rig.fbx');
const FBX_NO_RIG = join(MOSH_DIR, 'Cogumelo_sem_rig.fbx');
const OUT_GLB = join(MOSH_DIR, 'mosh.glb');

/* ================================================================
   Helpers
   ================================================================= */

function log(kind, msg) {
  const colors = {
    info: '\x1b[36m',
    ok: '\x1b[32m',
    warn: '\x1b[33m',
    err: '\x1b[31m',
    reset: '\x1b[0m',
  };
  const c = colors[kind] || colors.reset;
  const label = kind.toUpperCase().padEnd(5);
  console.log(`${c}${label}${colors.reset} ${msg}`);
}

function findBlender() {
  const env = process.env.ARENAMON_BLENDER;
  if (env && existsSync(env)) return env;

  const candidates = [
    'blender',
    'blender.exe',
    'C:\\Program Files\\Blender Foundation\\Blender 4.2\\blender.exe',
    'C:\\Program Files\\Blender Foundation\\Blender 4.1\\blender.exe',
    'C:\\Program Files\\Blender Foundation\\Blender 4.0\\blender.exe',
    'C:\\Program Files\\Blender Foundation\\Blender 3.6\\blender.exe',
    '/Applications/Blender.app/Contents/MacOS/Blender',
    '/usr/bin/blender',
    '/usr/local/bin/blender',
  ];

  for (const c of candidates) {
    try {
      execSync(`"${c}" --version`, { stdio: 'ignore' });
      return c;
    } catch { /* ignora */ }
  }
  return null;
}

/* ================================================================
   Script Python embutido (Blender headless)
   ================================================================= */

const BLENDER_SCRIPT = `
import bpy
import sys
import os

fbx_path = sys.argv[-3]
out_path = sys.argv[-2]
no_rig_path = sys.argv[-1] if len(sys.argv) > 3 and os.path.exists(sys.argv[-1]) else None

# Limpa cena padrão
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

# Importa FBX com rig
print(f"[MOSH] Importando: {fbx_path}")
bpy.ops.import_scene.fbx(filepath=fbx_path, use_anim=True)

# Se houver modelo sem rig, importa como LOD0 opcional (não implementado aqui)

# Aplica todas as transformações
for obj in bpy.context.scene.objects:
    if obj.type == 'ARMATURE' or obj.type == 'MESH':
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# Configura exportação GLB (gltf)
print(f"[MOSH] Exportando: {out_path}")
bpy.ops.export_scene.gltf(
    filepath=out_path,
    export_format='GLB',
    export_yup=True,
    export_animations=True,
    export_animation_mode='ACTIONS',
    export_bake_animation=False,
    export_skins=True,
    export_morph=False,
    export_draco_mesh_compression_enable=False,
    export_materials='EXPORT',
    export_image_format='AUTO',
    check_existing=False,
)

print("[MOSH] Concluído com sucesso.")
`;

/* ================================================================
   Main
   ================================================================= */

async function main() {
  console.log('\n' + '═'.repeat(60));
  console.log('  Arenamon — Conversor Mosh FBX → GLB');
  console.log('═'.repeat(60) + '\n');

  // --- checa existência do FBX ---
  if (!existsSync(FBX_FILE)) {
    log('err', `Arquivo não encontrado: ${FBX_FILE}`);
    log('info', 'Certifique-se de que chars/mosh/Cogumelo_com_rig.fbx existe.');
    process.exit(1);
  }
  log('ok', `FBX encontrado: ${basename(FBX_FILE)}`);

  // --- procura Blender ---
  const blender = findBlender();
  if (!blender) {
    log('err', 'Blender não encontrado.');
    console.log('\nInstalação:');
    console.log('  1. Baixe o Blender em https://www.blender.org/download/');
    console.log('  2. Adicione ao PATH do sistema, OU');
    console.log('  3. Defina a variável de ambiente ARENAMON_BLENDER com o caminho completo');
    console.log('\nAlternativa (sem Blender):');
    console.log('  - Use FBX2glTF: https://github.com/CesiumGS/FBX2glTF');
    console.log('  - Comando: FBX2glTF --binary --input Cogumelo_com_rig.fbx --output mosh.glb');
    process.exit(1);
  }
  log('ok', `Blender detectado: ${blender}`);

  // --- escreve script Python temporário ---
  const tmpDir = join(ROOT, '.tmp-convert');
  if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });
  const pyScript = join(tmpDir, 'mosh-convert.py');
  writeFileSync(pyScript, BLENDER_SCRIPT);

  // --- roda Blender headless ---
  const args = [
    '--background',
    '--factory-startup',
    '--python', pyScript,
    '--',
    FBX_FILE,
    OUT_GLB,
    existsSync(FBX_NO_RIG) ? FBX_NO_RIG : 'none',
  ];

  log('info', `Convertendo para GLB...`);
  console.log(`  Comando: ${blender} ${args.join(' ')}\n`);

  const code = await new Promise((resolve) => {
    const child = spawn(`"${blender}"`, args, {
      cwd: ROOT,
      shell: true,
      stdio: 'inherit',
    });
    child.on('close', resolve);
  });

  // --- limpa temporários ---
  try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ok */ }

  if (code !== 0) {
    log('err', `Blender saiu com código ${code}`);
    process.exit(1);
  }

  if (!existsSync(OUT_GLB)) {
    log('err', 'Arquivo GLB não foi gerado.');
    process.exit(1);
  }

  const stats = require('node:fs').statSync(OUT_GLB);
  log('ok', `GLB gerado: ${OUT_GLB}`);
  log('info', `Tamanho: ${(stats.size / 1024).toFixed(1)} KB`);

  console.log('\n' + '═'.repeat(60));
  console.log('  Próximos passos:');
  console.log('  1. Abra o Combat Lab → aba Personagens');
  console.log('  2. Carregue chars/mosh/mosh.glb no slot desejado');
  console.log('  3. Associe as animações no mapa de ações do Studio');
  console.log('═'.repeat(60) + '\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
