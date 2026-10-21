import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root = new URL('../', import.meta.url);
const browser = await chromium.launch({channel: process.env.ARENAMON_BROWSER || 'msedge', headless: true});
const page = await browser.newPage({viewport: {width: 1280, height: 800}});
try {
  await page.goto(pathToFileURL(fileURLToPath(new URL('dist/arenamon-combate-laboratorio.html', root))).href);
  await page.waitForFunction(() => window.__lab);
  const bytes = readFileSync(new URL('../../chars/mosh/Cogumelo.glb', root)).toString('base64');
  const result = await page.evaluate(async encoded => {
    const L = window.__lab, raw = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
    const source = await L.loadStudioFile(new File([raw], 'Cogumelo.glb'));
    L.setCharacter(0, source);
    const ch = L.ui.characters[0], f = L.game.fighters[0];
    const index = ch.clips.findIndex(clip => /left strafe/i.test(clip.name));
    if (index < 0) throw new Error('Clipe Left Strafe não encontrado');

    const sample = lock => {
      ch.lockRootMotion = lock;ch.stopPreview();ch.current = null;ch.layers.length = 0;ch.mixer.stopAllAction();
      ch.startPreview(index);
      const points = [];
      for (let frame = 0; frame < 80; frame++) {
        ch.update(f, 1 / 60, 0, [], {tick: frame});
        ch.root.updateMatrixWorld(true);
        let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
        ch.model.traverse(mesh => {
          if (!mesh.isSkinnedMesh) return;
          mesh.computeBoundingBox();
          const box = mesh.boundingBox;
          for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
            const point = box.min.clone().set(x, y, z).applyMatrix4(mesh.matrixWorld);
            minX = Math.min(minX, point.x);maxX = Math.max(maxX, point.x);minZ = Math.min(minZ, point.z);maxZ = Math.max(maxZ, point.z);
          }
        });
        const hipWorld = ch.hips.getWorldPosition(ch.hips.position.clone());
        points.push({x: (minX + maxX) / 2 - ch.root.position.x, z: (minZ + maxZ) / 2 - ch.root.position.z,
          hipX: ch.hips.position.x, hipZ: ch.hips.position.z,
          hipWorldX: hipWorld.x - ch.root.position.x, hipWorldZ: hipWorld.z - ch.root.position.z});
      }
      const range = key => Math.max(...points.map(p => p[key])) - Math.min(...points.map(p => p[key]));
      return {xRange: range('x'), zRange: range('z'), hipXRange: range('hipX'), hipZRange: range('hipZ'),
        hipWorldXRange: range('hipWorldX'), hipWorldZRange: range('hipWorldZ')};
    };
    const locked = sample(true), unlocked = sample(false), anchors = [];
    ch.lockRootMotion = true;ch.update(f, 0, 0, [], {tick: 81});
    for (const heading of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      f.visualFacing = heading;ch.place(f, 0, 0);ch.root.updateMatrixWorld(true);
      const p = ch.hips.getWorldPosition(ch.hips.position.clone());
      anchors.push({x: p.x - ch.root.position.x, z: p.z - ch.root.position.z});
    }
    return {clip: ch.clips[index].name, rootMotionNodes: ch.rootMotionNodes.map(entry => entry.node.name), locked, unlocked, anchors};
  }, bytes);
  console.log(JSON.stringify(result, null, 2));
  assert.ok(result.unlocked.xRange > result.locked.xRange * 2, `lock sem efeito visível: ${result.locked.xRange} vs ${result.unlocked.xRange}`);
  assert.ok(result.locked.hipWorldXRange < 1e-6 && result.locked.hipWorldZRange < 1e-6,
    `quadril ainda viaja no mundo: ${result.locked.hipWorldXRange}, ${result.locked.hipWorldZRange}`);
  assert.ok(result.anchors.every(p => Math.hypot(p.x, p.z) < .005), `pivô fora da hitbox: ${JSON.stringify(result.anchors)}`);
  console.log('✓ Mushroom: translação raiz neutralizada na malha e quadril preso à hitbox em quatro direções.');
} finally {
  await browser.close();
}
