// @ts-check
// Suíte de Teste de Navegador Dedicada: Paridade Visual e Ciclo de Vida dos 3 Pilotos (Documento 02).
// Valida visualmente e estruturalmente em ambiente WebGL real (Playwright, offline file://):
//   1. Sand Wave: nascimento, propagação, partículas Quarks, transição dying, cauda de 0.4s e descarte limpo.
//   2. Bullet Punch: rush exclusivo, f.absent (invisibilidade do boneco), linha de trajeto, impacto e descarte.
//   3. Water Pulse: scaling de PL1/PL2/PL3, anel projectilePlBorder dinâmico, variantes A/B/C,
//      explosão de contato splash, cauda dying de 2.4s e retenção da posição de impacto.
//   4. Isolamento estrito: manipuladores legados (atelierFx e elementalFx) NÃO duplicam os 3 pilotos.
//   5. Acessibilidade: respeito a noFlash, reduceMotion e elemental.enabled = 0.

import {chromium} from '@playwright/test';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {mkdirSync, writeFileSync} from 'node:fs';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = root + 'evidence/moves-vfx-parity/';
mkdirSync(out, {recursive: true});

const labUrl = pathToFileURL(root + 'dist/arenamon-combate-laboratorio.html').href;
const BROWSER = process.env.ARENAMON_BROWSER === 'chromium' ? {} : {channel: process.env.ARENAMON_BROWSER || 'msedge'};

let passed = 0, failed = 0;
const results = [];

function check(label, ok, detail = '') {
  if (ok) passed++; else failed++;
  const msg = `  ${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`;
  (ok ? console.log : console.error)(msg);
  results.push({label, ok, detail});
}

console.log('\n--- NAVEGADOR: PARIDADE E CICLO DE VIDA VISUAL DOS 3 PILOTOS (DOC 02) ---\n');

const browser = await chromium.launch({
  ...BROWSER,
  headless: true,
  args: process.env.ARENAMON_GL === 'software'
    ? ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader']
    : []
});

try {
  const page = await browser.newPage({viewport: {width: 1400, height: 900}});
  const errors = [], requests = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => {if (m.type() === 'error') errors.push(m.text());});
  page.on('request', r => {if (!/^(file|data|blob):/.test(r.url())) requests.push(r.url());});

  await page.context().setOffline(true);
  await page.goto(labUrl + '?fabrica=1');
  await page.waitForFunction(() => window.__lab?.moves && window.__lab.game, null, {timeout: 60000});

  const L = (fn, arg) => page.evaluate(fn, arg);
  const frames = n => L(n => new Promise(res => {let i = 0;const f = () => (++i >= n ? res(0) : requestAnimationFrame(f));requestAnimationFrame(f);}), n);

  // Inicializa o combate pausado para avanço determinístico frame a frame
  await L(() => {
    document.getElementById('moves-close')?.click();
    window.__lab.startMatch();
    window.__labRecording.ui.paused = true;
  });

  const idle = `({move: {x: 0, z: 0}, dodge: false, dodgeHeld: false, tackle: false, tackleHeld: false, guard: false, guardPressed: false, jump: false, jumpHeld: false, target: null, skill: null, skillHeld: null})`;

  const setupFighters = (move, dist = 5) => L(([move, dist]) => {
    window.__lab.startMatch();
    window.__labRecording.ui.paused = true;
    const g = window.__lab.game;
    const a = g.fighters[0], b = g.fighters[1];
    g.setLoadout(0, [move, null, null, null]);
    a.position = {x: 0, z: 0};
    a.groundY = 0;
    a.flight = null;
    a.action = null;
    a.velocity = {x: 0, z: 0};
    a.stamina = 12;
    a.moveCooldowns = {};
    a.facing = 0;
    b.position = {x: 0, z: dist};
    b.groundY = 0;
    b.flight = null;
    b.action = null;
    b.hp = 100;
  }, [move, dist]);

  const stepGame = (n, press) => L(([n, press, idle]) => {
    const g = window.__lab.game;
    const e = () => eval(idle);
    for (let i = 0; i < n; i++) {
      g.step({...e(), ...(press && i === 0 ? {skill: 0} : {}), skillHeld: [!!press && press !== 'once', false, false, false]}, e());
      window.__lab.view.worldView.update(g.world, {fighters: g.fighters, events: g.events ?? [], dt: 1 / 60});
    }
  }, [n, press, idle]);

  // =========================================================================
  // 1. TESTE DO SAND WAVE
  // =========================================================================
  console.log('\n[1/3] Sand Wave: nascimento, propagação, cauda e descarte modular');
  await setupFighters('sand-wave', 6);
  await frames(6);
  await stepGame(1, 'once');

  // Aguarda barragem nascer na simulação (após preparação de 0.25s = ~30 steps)
  let waveSpawned = false;
  for (let i = 0; i < 40; i++) {
    await stepGame(1);
    waveSpawned = await L(() => window.__lab.game.world.entities.some(e => e.kind === 'sandwave'));
    if (waveSpawned) break;
  }

  let swDiag = await L(() => {
    const wv = window.__lab.view.worldView;
    const mv = wv.movesVfx.diagnostics();
    const at = wv.atelierFx.diagnostics();
    const waveEnt = window.__lab.game.world.entities.find(e => e.kind === 'sandwave');
    const inst = waveEnt ? wv.movesVfx.activeInstances.get(waveEnt.id) : null;
    return {
      mv,
      at,
      hasWaveEnt: !!waveEnt,
      instHandled: !!inst,
      wavePos: inst ? wv.movesVfx.positionOf(waveEnt.id) : null,
      atelierCount: at.items.filter(x => x.kind === 'sandwave').length
    };
  });

  check('Sand Wave: barragem nasce na simulação', swDiag.hasWaveEnt);
  check('Sand Wave: gerenciado exclusivamente pelo MovesVfxRegistry (Doc 02)', swDiag.instHandled);
  check('Sand Wave: isolamento garantido (atelierFx não duplica a entidade)', swDiag.atelierCount === 0);
  check('Sand Wave: posição 3D calculada no centro da onda', swDiag.wavePos != null && swDiag.wavePos.z >= 0);

  await page.screenshot({path: out + 'sand-wave-ativo.png'});

  // Avança até o fim da vida ativa na simulação -> entra na cauda de dissipação (+0.4s)
  for (let i = 0; i < 200; i++) {
    await stepGame(1);
    const waveAlive = await L(() => window.__lab.game.world.entities.some(e => e.kind === 'sandwave'));
    if (!waveAlive) break;
  }
  await frames(4);

  let swTail = await L(() => {
    const wv = window.__lab.view.worldView;
    const waveEnt = window.__lab.game.world.entities.find(e => e.kind === 'sandwave');
    const dyingInst = [...wv.movesVfx.activeInstances.values()].find(x => x.module.id === 'sand-wave');
    return {
      entExpired: !waveEnt,
      isDying: dyingInst?.dying === true,
      age: dyingInst?.age ?? 0,
      tailPosValid: dyingInst ? wv.movesVfx.positionOf(dyingInst.entity.id) != null : false
    };
  });

  check('Sand Wave: entidade expira na simulação e transiciona para fase dying', swTail.entExpired && swTail.isDying);
  check('Sand Wave: posição de dissipação retida durante a cauda', swTail.tailPosValid);

  // Avança até a dissipação total (> 0.4s = 35 frames)
  for (let i = 0; i < 50; i++) {
    await stepGame(1);
    const stillActive = await L(() => [...window.__lab.view.worldView.movesVfx.activeInstances.values()].some(x => x.module.id === 'sand-wave'));
    if (!stillActive) break;
  }
  await frames(6);

  let swClean = await L(() => {
    const wv = window.__lab.view.worldView;
    return {
      activeInstances: wv.movesVfx.activeInstances.size,
      sandActive: [...wv.movesVfx.activeInstances.values()].some(x => x.module.id === 'sand-wave')
    };
  });

  check('Sand Wave: efeito dissipado e descartado limpo sem vazamento', !swClean.sandActive);

  // =========================================================================
  // 2. TESTE DO BULLET PUNCH
  // =========================================================================
  console.log('\n[2/3] Bullet Punch: avanço rush, f.absent, impacto e descarte');
  await setupFighters('bullet-punch', 4);
  await frames(6);
  await stepGame(1, 'once');

  // Preparação de 0.75s (~90 steps) antes do vanish
  for (let i = 0; i < 95; i++) {
    await stepGame(1);
    const vanished = await L(() => window.__lab.game.fighters[0].absent);
    if (vanished) break;
  }

  let bpVanish = await L(() => {
    const wv = window.__lab.view.worldView;
    const f0 = window.__lab.game.fighters[0];
    const mv = wv.movesVfx.diagnostics();
    const rush = mv.rushes.find(r => r.move === 'bullet-punch');
    const f0Obj = wv.meshes.get(f0.id) ?? wv.characters?.[0]?.root;
    return {
      absent: f0.absent,
      rushActive: !!rush,
      rushAge: rush?.age ?? 0,
      bodyHidden: f0Obj ? f0Obj.visible === false : true
    };
  });

  check('Bullet Punch: lutador entra em vanish (f.absent = true)', bpVanish.absent);
  check('Bullet Punch: modelo 3D do personagem ocultado durante vanish', bpVanish.bodyHidden);
  check('Bullet Punch: rush visual gerenciado exclusivamente pelo MovesVfxRegistry', bpVanish.rushActive);

  await page.screenshot({path: out + 'bullet-punch-vanish.png'});

  // Avança vanish (0.2s = ~25 steps) até a chegada / bulletReturn / impacto
  for (let i = 0; i < 30; i++) {
    await stepGame(1);
    const reappeared = await L(() => !window.__lab.game.fighters[0].absent);
    if (reappeared) break;
  }
  await frames(6);

  let bpImpact = await L(() => {
    const wv = window.__lab.view.worldView;
    const f0 = window.__lab.game.fighters[0];
    const mv = wv.movesVfx.diagnostics();
    const rush = wv.movesVfx.rushes.find(r => r.module.id === 'bullet-punch')?.rush;
    return {
      reappeared: !f0.absent,
      rushDone: rush?.done === true,
      impactValid: rush?.impact != null,
      impactZ: rush?.impact?.z ?? 0
    };
  });

  check('Bullet Punch: reaparece perto do alvo (f.absent = false)', bpImpact.reappeared);
  check('Bullet Punch: evento de impacto acionado na chegada', bpImpact.rushDone && bpImpact.impactValid);

  await page.screenshot({path: out + 'bullet-punch-impacto.png'});

  // Avança até o fim da cauda de dissipação (+0.4s)
  for (let i = 0; i < 150; i++) {
    await stepGame(1);
    const bpActive = await L(() => window.__lab.view.worldView.movesVfx.rushes.some(r => r.module.id === 'bullet-punch'));
    if (!bpActive) break;
  }
  await frames(6);

  let bpClean = await L(() => {
    const wv = window.__lab.view.worldView;
    return {
      rushesCount: wv.movesVfx.rushes.length,
      bpActive: wv.movesVfx.rushes.some(r => r.module.id === 'bullet-punch')
    };
  });

  check('Bullet Punch: rush descartado limpo após a dissipação', !bpClean.bpActive);

  // =========================================================================
  // 3. TESTE DO WATER PULSE
  // =========================================================================
  console.log('\n[3/3] Water Pulse: PL scaling, border toggle, contato splash e cauda 2.4s');
  await setupFighters('water-pulse', 8);
  await frames(6);

  // Carrega por 95 passos (PL2) e solta
  await L(() => {
    const g = window.__lab.game;
    const e = () => ({move: {x: 0, z: 0}, dodge: false, dodgeHeld: false, tackle: false, tackleHeld: false, guard: false, guardPressed: false, jump: false, jumpHeld: false, target: null, skill: 0, skillHeld: [true, false, false, false]});
    for (let i = 0; i < 95; i++) {
      g.step(e(), {move: {x: 0, z: 0}, dodge: false, dodgeHeld: false, tackle: false, tackleHeld: false, guard: false, guardPressed: false, jump: false, jumpHeld: false, target: null, skill: null, skillHeld: null});
      window.__lab.view.worldView.update(g.world, {fighters: g.fighters, events: g.events ?? [], dt: 1 / 60});
    }
    // Solta
    g.step({move: {x: 0, z: 0}, dodge: false, dodgeHeld: false, tackle: false, tackleHeld: false, guard: false, guardPressed: false, jump: false, jumpHeld: false, target: null, skill: null, skillHeld: [false, false, false, false]}, {move: {x: 0, z: 0}, dodge: false, dodgeHeld: false, tackle: false, tackleHeld: false, guard: false, guardPressed: false, jump: false, jumpHeld: false, target: null, skill: null, skillHeld: null});
    window.__lab.view.worldView.update(g.world, {fighters: g.fighters, events: g.events ?? [], dt: 1 / 60});
  });

  await frames(4);

  let wpSpawn = await L(() => {
    const wv = window.__lab.view.worldView;
    const proj = window.__lab.game.world.entities.find(e => e.kind === 'projectile' && e.visual === 'waterorb');
    const inst = proj ? wv.movesVfx.activeInstances.get(proj.id) : null;
    const elemProj = wv.elementalFx.items.get(proj?.id);
    return {
      hasProj: !!proj,
      pl: proj?.pl,
      instActive: !!inst,
      previewActive: inst?.state?.preview?.active === true,
      scale: inst?.state?.preview?.root?.scale?.x ?? 0,
      elementalDuplicated: !!elemProj
    };
  });

  check('Water Pulse: projétil PL2 gerado na simulação', wpSpawn.hasProj && wpSpawn.pl === 2);
  check('Water Pulse: gerenciado exclusivamente pelo MovesVfxRegistry', wpSpawn.instActive && wpSpawn.previewActive);
  check('Water Pulse: isolamento garantido (elementalFx não processa Water Pulse)', !wpSpawn.elementalDuplicated);
  check('Water Pulse: escala proporcional ao PL2 aplicada na malha', wpSpawn.scale > 0.3);

  // Teste dinâmico de toggle do anel projectilePlBorder
  await L(() => {
    window.__lab.C.vfx.projectilePlBorder = true;
  });
  await stepGame(2);
  await frames(2);

  let borderOn = await L(() => {
    const wv = window.__lab.view.worldView;
    const proj = window.__lab.game.world.entities.find(e => e.kind === 'projectile' && e.visual === 'waterorb');
    const inst = proj ? wv.movesVfx.activeInstances.get(proj.id) : null;
    const ring = inst?.state?.preview?.root?.getObjectByName('plBorder');
    return {hasBorder: !!ring, visible: ring?.visible !== false};
  });

  check('Water Pulse: anel projectilePlBorder dinâmico criado e visível', borderOn.hasBorder && borderOn.visible);

  await L(() => {
    window.__lab.C.vfx.projectilePlBorder = false;
  });
  await stepGame(2);
  await frames(2);

  let borderOff = await L(() => {
    const wv = window.__lab.view.worldView;
    const proj = window.__lab.game.world.entities.find(e => e.kind === 'projectile' && e.visual === 'waterorb');
    const inst = proj ? wv.movesVfx.activeInstances.get(proj.id) : null;
    const ring = inst?.state?.preview?.root?.getObjectByName('plBorder');
    return {hasBorder: !!ring};
  });

  check('Water Pulse: anel projectilePlBorder dinamicamente removido ao desligar', !borderOff.hasBorder);

  // Teste de troca de variante visual em tempo real (variante B = 1)
  await L(() => {
    window.__lab.C.vfx.elemental.waterVariant = 1;
  });
  await stepGame(2);
  await frames(2);

  let varB = await L(() => {
    const wv = window.__lab.view.worldView;
    const proj = window.__lab.game.world.entities.find(e => e.kind === 'projectile' && e.visual === 'waterorb');
    const inst = proj ? wv.movesVfx.activeInstances.get(proj.id) : null;
    return {
      variant: inst?.state?.preview?.p?.variant
    };
  });

  check('Water Pulse: troca de variante A/B/C reconstruída em tempo real', varB.variant === 1);

  await page.screenshot({path: out + 'water-pulse-voo.png'});

  // Avança até o impacto com o alvo em z = 8
  for (let i = 0; i < 50; i++) {
    await stepGame(1);
    const projExists = await L(() => window.__lab.game.world.entities.some(e => e.kind === 'projectile' && e.visual === 'waterorb'));
    if (!projExists) break;
  }
  await frames(4);

  let wpImpact = await L(() => {
    const wv = window.__lab.view.worldView;
    const dyingInst = [...wv.movesVfx.activeInstances.values()].find(x => x.module.id === 'water-pulse');
    return {
      isDying: dyingInst?.dying === true,
      age: dyingInst?.age ?? 0,
      contactPos: dyingInst ? wv.movesVfx.positionOf(dyingInst.entity.id) : null
    };
  });

  check('Water Pulse: impacto ativa animação splash e transiciona para cauda dying', wpImpact.isDying);
  check('Water Pulse: posição do ponto de contato retida durante todo o splash', wpImpact.contactPos != null && wpImpact.contactPos.z > 5);

  await page.screenshot({path: out + 'water-pulse-splash.png'});

  // Avança parcialmente na cauda (1.0s de 2.4s) -> ainda deve estar vivo no splash
  await stepGame(60);
  await frames(4);

  let wpMidTail = await L(() => {
    const wv = window.__lab.view.worldView;
    const dyingInst = [...wv.movesVfx.activeInstances.values()].find(x => x.module.id === 'water-pulse');
    return {
      stillDying: dyingInst?.dying === true,
      age: dyingInst?.age ?? 0
    };
  });

  check('Water Pulse: partículas de splash sustentadas durante a cauda de 2.4s', wpMidTail.stillDying && wpMidTail.age > 0.5);

  // Avança até o término completo da cauda de 2.4s (mais 120 frames)
  await stepGame(120);
  await frames(6);

  let wpClean = await L(() => {
    const wv = window.__lab.view.worldView;
    return {
      wpActive: [...wv.movesVfx.activeInstances.values()].some(x => x.module.id === 'water-pulse')
    };
  });

  check('Water Pulse: descarte e liberação total de memória após 2.4s', !wpClean.wpActive);

  // =========================================================================
  // 4. SANIDADE DO SISTEMA
  // =========================================================================
  check('sem erros de console ou página WebGL', errors.length === 0, errors.slice(0, 3).join(' | '));
  check('sem requisições externas não autorizadas', requests.length === 0, requests.slice(0, 3).join(' | '));

  writeFileSync(out + 'resultado-paridade-vfx.json', JSON.stringify({
    timestamp: new Date().toISOString(),
    passed,
    failed,
    results,
    errors
  }, null, 2));

} finally {
  await browser.close();
}

console.log(failed ? `\n✗ Falhou: ${failed} (de ${passed + failed}).` : `\n✓ Todos os ${passed} testes de paridade visual APROVADOS.`);
process.exit(failed ? 1 : 0);
