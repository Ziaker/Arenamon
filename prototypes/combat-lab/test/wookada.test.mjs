import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadStudioFile, autoVariants, Character} from '../src/view/characters.js';
import {smearAnchors} from '../src/view/smear-mesh.js';
import {speciesFromName} from '../src/sim/passives.js';

test('Wookada: carregamento, manifesto de ações e variantes', async () => {
  const buf = readFileSync('chars/wookada/wookada.glb');
  const file = new File([buf], 'wookada.glb');
  const source = await loadStudioFile(file);

  assert.equal(source.name, 'wookada.glb');
  assert.equal(source.animations.length, 48);
  assert.ok(source.manifest, 'Manifesto arenamonActions embutido');

  const variants = autoVariants(source);
  const byIdx = i => source.animations[i]?.name;

  // Idle e Turn
  assert.equal(byIdx(variants.idle[0]), 'Mutant Idle');
  assert.equal(byIdx(variants.turn[0]), 'turn');

  // Locomoção 8 direções: walk com Mutant Walking, corrida/sprint com sprint 8 dir
  for (const dir of ['walk', 'walk_back', 'walk_left', 'walk_right']) {
    assert.equal(byIdx(variants[dir][0]), 'Mutant Walking', `Direção ${dir} usa Mutant Walking`);
  }
  for (const dir of ['run', 'run_back', 'run_left', 'run_right', 'sprint', 'sprint_back', 'sprint_left', 'sprint_right']) {
    assert.equal(byIdx(variants[dir][0]), 'sprint 8 dir', `Direção ${dir} usa sprint 8 dir`);
  }

  // Tackles (PL1, PL2, PL3 e variantes extras)
  assert.equal(byIdx(variants.tackle[0]), 'tackle 1', 'Tackle base PL1');
  const extraNames = variants.tackle.slice(1).map(byIdx);
  assert.ok(extraNames.includes('tackle 3'), 'Variante tackle 3');
  assert.ok(extraNames.includes('tackle 4'), 'Variante tackle 4');
  assert.ok(extraNames.includes('tackle 6'), 'Variante tackle 6');
  assert.ok(extraNames.includes('tacke 7'), 'Variante tacke 7');
  assert.equal(byIdx(variants.tackle_pl2[0]), 'tackle 2', 'Tackle PL2');
  assert.equal(byIdx(variants.tackle_pl3[0]), 'tackle 5', 'Tackle PL3');
  assert.equal(byIdx(variants.tackle_charge[0]), 'charge move start', 'Carga do tackle');

  // Pulo, Aterrissagem e Queda
  assert.equal(byIdx(variants.jump[0]), 'Mutant Jumping');
  assert.equal(byIdx(variants.land[0]), 'jump land');
  assert.equal(byIdx(variants.fall[0]), 'falling');
  assert.equal(byIdx(variants.meteor_dive[0]), 'Mutant Jump Attack');
  assert.equal(byIdx(variants.meteor_ground[0]), 'ground crash');

  // Defesa e Esquiva
  assert.equal(byIdx(variants.block_start[0]), 'block start');
  assert.equal(byIdx(variants.block[0]), 'bloking still');
  assert.equal(byIdx(variants.dodge_forward[0]), 'dodge foward');
  assert.equal(byIdx(variants.dodge_back[0]), 'dash back');
  assert.equal(byIdx(variants.dodge_left[0]), 'dodge left');
  assert.equal(byIdx(variants.dodge_right[0]), 'dodge right');
  assert.equal(byIdx(variants.vault[0]), 'roll foward');

  // Golpes Especiais
  assert.equal(byIdx(variants.move_1[0]), 'move 1');
  assert.equal(byIdx(variants.move_2[0]), 'Stabbing');
});

test('Wookada: root motion travado em runtime (física manda no deslocamento)', async () => {
  const buf = readFileSync('chars/wookada/wookada.glb');
  const file = new File([buf], 'wookada.glb');
  const source = await loadStudioFile(file);
  const ch = new Character(source);

  // Os clipes do GLB trazem deslocamento horizontal da raiz (vários passam de 1 m). O jogo não depende
  // disso: o lock de root motion (padrão ligado) descarta X/Z da raiz e a posição vem só da física.
  assert.equal(ch.lockRootMotion, true, 'Lock de root motion ligado por padrão');
  assert.ok(ch.rootMotionNodes.length > 0, 'Nó de root motion (Hips) identificado');
});

test('Wookada: Squash & Stretch e Smear de membros', async () => {
  const buf = readFileSync('chars/wookada/wookada.glb');
  const file = new File([buf], 'wookada.glb');
  const source = await loadStudioFile(file);
  const ch = new Character(source);

  // Âncoras de smear
  const anchors = smearAnchors(ch);
  assert.equal(anchors.length, 3, '3 âncoras (punhos e chifre)');
  assert.ok(anchors.some(a => a.label === 'Punho esquerdo'));
  assert.ok(anchors.some(a => a.label === 'Punho direito'));
  assert.ok(anchors.some(a => a.label === 'Chifre'));

  // Espécie reconhecida
  assert.equal(speciesFromName('wookada.glb'), 'wookada');

  // Teste de deformação Squash & Stretch durante Tackle PL3
  const fighter = {
    position: {x: 0, y: 0, z: 0},
    velocity: {x: 6, y: 0, z: 0},
    facing: 0,
    visualFacing: 0,
    hp: 100,
    action: {kind: 'tackle', elapsed: 0.12, duration: 0.5, pl: 3, heading: 0},
    attributes: {speed: 6}
  };

  ch.update(fighter, 0.016, 0);
  assert.ok(ch.squash.active, 'Squash ativo no tackle');
  assert.ok(ch.squash.z > 1.15, `Alongamento no tackle PL3: ${ch.squash.z.toFixed(2)}`);
  assert.ok(Math.abs(ch.squash.transverse * Math.sqrt(ch.squash.z) - 1.0) < 1e-4, 'Preservação de volume');
});
