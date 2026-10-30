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

  // Locomoção 8 direções: só andar (Mutant Walking) e sprint (sprint 8 dir); “run” não existe mais.
  for (const dir of ['walk', 'walk_back', 'walk_left', 'walk_right']) {
    assert.equal(byIdx(variants[dir][0]), 'Mutant Walking', `Direção ${dir} usa Mutant Walking`);
  }
  for (const dir of ['sprint', 'sprint_back', 'sprint_left', 'sprint_right']) {
    assert.equal(byIdx(variants[dir][0]), 'sprint 8 dir', `Direção ${dir} usa sprint 8 dir`);
  }
  for (const id of ['run', 'run_back', 'run_left', 'run_right']) assert.equal(variants[id], undefined, `Estado ${id} removido`);

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
  assert.ok(variants.land.map(byIdx).includes('fall_hitground'), 'Impacto da queda na aterrissagem');
  assert.equal(byIdx(variants.fall[0]), 'falling');
  assert.equal(byIdx(variants.meteor_prep[0]), 'Mutant Jumping', 'Meteoro sobe com o pulo');
  assert.equal(byIdx(variants.meteor_dive[0]), 'Mutant Jump Attack');
  assert.equal(byIdx(variants.meteor_ground[0]), 'ground crash');

  // Defesa e Esquiva
  assert.equal(byIdx(variants.block_start[0]), 'block start');
  assert.equal(byIdx(variants.block[0]), 'bloking still');
  assert.equal(byIdx(variants.guard_impact[0]), 'block start', 'Impacto na defesa reergue a guarda');
  assert.equal(byIdx(variants.blocked[0]), 'dash back', 'Recuo usa o dash para trás');
  assert.ok(variants.wall_splat.map(byIdx).includes('Wall Crash'));
  assert.ok(variants.wall_splat.map(byIdx).includes('post fall wall crash'));
  assert.equal(byIdx(variants.dodge_forward[0]), 'dodge foward');
  assert.equal(byIdx(variants.dodge_back[0]), 'dash back');
  assert.equal(byIdx(variants.dodge_left[0]), 'dodge left');
  assert.equal(byIdx(variants.dodge_right[0]), 'dodge right');
  assert.equal(byIdx(variants.vault[0]), 'roll foward');

  // Golpes Especiais
  assert.equal(byIdx(variants.move_1[0]), 'move 1');
  assert.ok(variants.move_1.map(byIdx).includes('move blast'), 'Variantes de blast agrupadas no movimento 1');
  assert.equal(byIdx(variants.move_2[0]), 'Stabbing');
  assert.equal(byIdx(variants.move_3[0]), 'buff 2');
  assert.equal(byIdx(variants.move_4[0]), 'status move');
});

test('Wookada: mapa antigo salvo é PRESERVADO na migração (só ações sem associação salva recebem o perfil) e “run” não volta', async () => {
  const buf = readFileSync('chars/wookada/wookada.glb');
  const source = await loadStudioFile(new File([buf], 'wookada.glb'));
  source.assetId = 'wookada-migracao';
  const old = Character.stateStore;
  try {
    Character.stateStore = {
      get: () => ({variants: {run: ['sprint 8 dir'], blocked: ['post fall wall crash'], guard_impact: ['get hit 2'], meteor_prep: ['charge move start']}, speeds: {walk: 1.2}}),
      set: () => {}
    };
    const ch = new Character(source);
    assert.equal(ch.variants.run, undefined, 'Estado run descartado');
    assert.equal(ch.clips[ch.variants.blocked[0]].name, 'post fall wall crash', 'Associação salva do usuário NÃO é trocada pela migração (pedido: não substituir associações personalizadas)');
    assert.equal(ch.clips[ch.variants.guard_impact[0]].name, 'get hit 2', 'Impacto na defesa salvo preservado');
    assert.equal(ch.clips[ch.variants.meteor_prep[0]].name, 'charge move start', 'Preparação do meteoro salva preservada');
    assert.ok(ch.variants.jump?.length, 'ação sem associação salva recebe o perfil curado');
    assert.equal(ch.speeds.walk, 1.2, 'Ajustes do usuário preservados na migração');
    // Depois da migração, o painel manda: um estado salvo com a versão nova não é sobrescrito de novo.
    Character.stateStore = {get: () => ({animationProfileVersion: 2, variants: {blocked: ['get hit']}}), set: () => {}};
    const custom = new Character(source);
    assert.equal(custom.clips[custom.variants.blocked[0]].name, 'get hit', 'Personalização posterior preservada');
  } finally {
    Character.stateStore = old;
  }
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

  // Exceções do Wookada: esquiva, pulo e tackles sobem/descem com o próprio clipe. O deslocamento horizontal continua
  // travado em TODAS as animações (a física manda no X/Z).
  for (const key of ['dodge_forward', 'dodge_back', 'dodge_left', 'dodge_right', 'vault', 'jump', 'tackle', 'tackle_charge', 'tackle_pl2', 'tackle_pl3']) {
    assert.equal(ch.verticalMotionFree(key), true, `Trava vertical livre em ${key}`);
  }
  for (const key of ['idle', 'walk', 'block', 'hit', 'land']) {
    assert.equal(ch.verticalMotionFree(key), false, `Trava vertical ativa em ${key}`);
  }

  // Tamanho: o Wookada nasce 2× em altura e largura (ajustável no painel Personagens).
  assert.equal(ch.heightScale, 2, 'Altura 2×');
  assert.equal(ch.widthScale, 2, 'Largura 2×');
  const data = ch.stateData();
  assert.deepEqual(data.sizeScale, {height: 2, width: 2});
  assert.deepEqual(data.freeVerticalMotion, ['dodge', 'jump', 'tackle']);
});

test('Wookada: exceção vertical sobe, mas nunca afunda abaixo do chão', async () => {
  const buf = readFileSync('chars/wookada/wookada.glb');
  const file = new File([buf], 'wookada.glb');
  const source = await loadStudioFile(file);
  const ch = new Character(source);
  const oldFit = Character.options.fit;
  try {
    Character.options.fit = false;
    ch.heightScale = ch.widthScale = 1;ch.visualOffset = 0;ch.autoGround = true;ch.lockToGround = true;
    ch.layers = [];
    ch.current = {key: 'jump', id: 'jump', index: 0, action: {time: 0}, weight: 1, entry: 'jump#1'};
    const fighter = {position: {x: 0, y: 0, z: 0}, velocity: {x: 0, y: 0, z: 0}, facing: 0, visualFacing: 0, hp: 100, attributes: {speed: 0}};
    let ground = ch.restMinY - .4;
    ch.groundAtFrame = () => ground;
    ch.place(fighter, 0, .016);
    const scale = ch.root.scale.y;
    assert.ok(ch.root.position.y + ground * scale >= -1e-6, 'O clipe não empurra o ponto mais baixo para baixo do chão');
    ground = ch.restMinY + .5;
    ch.place(fighter, 0, .016);
    assert.ok(ch.root.position.y + ground * scale > .4, 'O clipe continua livre para subir');
    // Estado fora do grupo liberado: comportamento antigo, apoiado exatamente no chão.
    ch.current.key = 'idle';
    ground = ch.restMinY - .2;
    ch.place(fighter, 0, .016);
    assert.ok(Math.abs(ch.root.position.y + ground * scale) < 1e-6, 'Idle continua travado no chão');
  } finally {
    Character.options.fit = oldFit;
  }
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
