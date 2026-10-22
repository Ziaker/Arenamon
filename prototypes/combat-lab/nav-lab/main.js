// Laboratório de navegação Yuka (Fase 3). Roda a simulação REAL do Arenamon (Game) em cenários sólidos e compara
// a navegação atual (linha reta) com a rota planejada (grafo de superfícies com caminhada, salto e queda sobre o
// A* do Yuka). A física continua do motor; o Yuka só planeja. Offline: tudo empacotado pelo esbuild.
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {C, defaults, resetConfig} from '../src/sim/config.js';
import {Game} from '../src/sim/game.js';
import {emptyCommand} from '../src/sim/entity.js';
import {vec} from '../src/sim/math.js';
import {registerStandardMoves} from '../src/sim/moves/standard.js';
import {getGroundHeight} from '../src/sim/physics.js';
import {NAV_SCENARIOS, NAV_SCENARIO_IDS, setupNavScenario, runNavScenario} from '../src/nav/nav-scenarios.js';
import {getNavGraph, clearNavCache} from '../src/nav/nav-graph.js';

registerStandardMoves();
resetConfig(defaults());
const $ = id => document.getElementById(id);
const say = html => {$('status').innerHTML = html;};

// ---------- cena ----------
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({canvas, antialias: true});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d1017);
const camera = new THREE.PerspectiveCamera(50, 1, .1, 200);
camera.position.set(0, 24, 17);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;controls.target.set(0, 0, 0);
scene.add(new THREE.HemisphereLight(0xbfd6ff, 0x202631, 1.0));
const sun = new THREE.DirectionalLight(0xffffff, 1.2);sun.position.set(6, 14, 4);scene.add(sun);
scene.add(new THREE.GridHelper(36, 36, 0x2a3346, 0x1b2230));
function onResize() {
  const w = canvas.clientWidth || 800, h = canvas.clientHeight || 600;
  camera.aspect = w / h;camera.updateProjectionMatrix();renderer.setSize(w, h, false);
}
window.addEventListener('resize', onResize);

const world = new THREE.Group(), overlay = new THREE.Group(), dyn = new THREE.Group();
scene.add(world, overlay, dyn);
function marker(color) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(.4, .5, 6, 14), new THREE.MeshStandardMaterial({color, roughness: .5}));
  body.position.set(0, .65, 0);g.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(.16, .4, 10), new THREE.MeshBasicMaterial({color: 0xffffff}));
  nose.rotation.x = Math.PI / 2;nose.position.set(0, .7, .55);g.add(nose);
  return g;
}
const blueM = marker(0x4fa3ff), redM = marker(0xff5a5a);
scene.add(blueM, redM);

// ---------- partida ----------
let game, info, running = false, speed = 1, acc = 0, mode = 0, tick = 0;
let live;
function freshLive() {return {wallTicks: 0, jumps: 0, wasAir: false, tackles: 0, vain: 0, hits: 0, reachedAt: null, path: 0, lastX: null, lastZ: null};}

function loadScenario(id, keepPositions = null) {
  clearNavCache();
  game = new Game({seed: 7});game.start();
  C.extras.nav.enableNav = mode;
  info = setupNavScenario(game, id);
  if (keepPositions) {
    const [b, r] = game.fighters;
    b.position = vec(keepPositions.blue.x, keepPositions.blue.z);b.groundY = keepPositions.blue.y;
    r.position = vec(keepPositions.red.x, keepPositions.red.z);r.groundY = keepPositions.red.y;
  }
  live = freshLive();acc = 0;tick = 0;
  $('scenario-hint').textContent = info.scenario.hint + (info.scenario.expect === 'unreachable' ? ' (esperado: NÃO alcançável)' : '');
  buildWorld();
  trailPts.length = 0;updateTrail();
  render();
}

// ---------- geometria do cenário ----------
const matSolid = new THREE.MeshStandardMaterial({color: 0x4a5873, roughness: .8}), matPlat = new THREE.MeshStandardMaterial({color: 0x5a8f6a, roughness: .8}), matDest = new THREE.MeshStandardMaterial({color: 0x9a7c52, roughness: .8});
function disposeGroup(gp) {
  for (const o of [...gp.children]) {gp.remove(o);o.geometry?.dispose();if (Array.isArray(o.material)) o.material.forEach(m => m.dispose()); else if (o.material && o.material !== matSolid && o.material !== matPlat && o.material !== matDest) o.material.dispose();}
}
function buildWorld() {
  disposeGroup(world);
  const m = game.mapState;
  const ring = new THREE.Mesh(new THREE.RingGeometry((C.map.arenaRadius ?? 32.5) - .15, C.map.arenaRadius ?? 32.5, 96), new THREE.MeshBasicMaterial({color: 0x2f5f85, side: THREE.DoubleSide}));
  ring.rotation.x = -Math.PI / 2;ring.position.y = .02;world.add(ring);
  const solid = (geo, mat, x, y, z, edge = true) => {
    const mesh = new THREE.Mesh(geo, mat);mesh.position.set(x, y, z);world.add(mesh);
    if (edge) {const l = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({color: 0x0d1017}));l.position.copy(mesh.position);world.add(l);}
  };
  for (const o of m.obstacles) {
    if (o.shape === 'cylinder' || o.shape === 'pillar') solid(new THREE.CylinderGeometry(o.radius, o.radius, o.height, 28), matSolid, o.pos.x, (o.pos.y ?? 0) + o.height / 2, o.pos.z);
    else solid(new THREE.BoxGeometry(o.hx * 2, o.height, o.hz * 2), matSolid, o.pos.x, (o.pos.y ?? 0) + o.height / 2, o.pos.z);
  }
  for (const p of m.platforms) solid(new THREE.BoxGeometry(p.width, p.height, p.depth), matPlat, p.pos.x, p.height / 2, p.pos.z);
  for (const d of m.destructibles) if (d.state === 'solid') solid(new THREE.BoxGeometry(d.size.hx * 2, d.size.height, d.size.hz * 2), matDest, d.pos.x, d.size.height / 2, d.pos.z);
  for (const z of m.navBlocked ?? []) {
    const disc = new THREE.Mesh(z.r != null ? new THREE.CircleGeometry(z.r, 40) : new THREE.PlaneGeometry(z.hx * 2, z.hz * 2), new THREE.MeshBasicMaterial({color: 0xff4d4d, transparent: true, opacity: .28, side: THREE.DoubleSide, depthWrite: false}));
    disc.rotation.x = -Math.PI / 2;disc.position.set(z.x, .05, z.z);world.add(disc);
  }
  buildOverlay();
}

// ---------- sobreposições do grafo ----------
let overlayKey = '';
function buildOverlay() {
  const nav = getNavGraph(game.mapState);
  overlayKey = nav.signature;
  disposeGroup(overlay);
  const pts = [], cols = [];
  const ground = new THREE.Color(0x6fa8dc), top = new THREE.Color(0xffe08a);
  for (const n of nav.nodes) {pts.push(n.x, n.y + .06, n.z);const c = n.surface === 'ground' ? ground : top;cols.push(c.r, c.g, c.b);}
  const pg = new THREE.BufferGeometry();pg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));pg.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const points = new THREE.Points(pg, new THREE.PointsMaterial({size: .14, vertexColors: true, depthTest: false}));points.name = 'nodes';points.renderOrder = 5;overlay.add(points);
  const seg = {walk: [], jump: [], drop: []};
  for (const e of nav.edges.values()) {
    const a = nav.nodes[e.from], b = nav.nodes[e.to];
    if (e.type === 'walk' && e.from > e.to) continue;   // as de caminhada são bidirecionais: desenha uma vez
    seg[e.type].push(a.x, a.y + .08, a.z, b.x, b.y + .08, b.z);
  }
  const colors = {walk: 0x3b4a63, jump: 0xffb361, drop: 0x6fc9ff};
  for (const k of Object.keys(seg)) {
    const g = new THREE.BufferGeometry();g.setAttribute('position', new THREE.Float32BufferAttribute(seg[k], 3));
    const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({color: colors[k], depthTest: false}));l.name = 'edges-' + k;l.renderOrder = 4;overlay.add(l);
  }
  applyVisibility();
}
function applyVisibility() {
  overlay.getObjectByName('nodes').visible = $('show-nodes').checked;
  for (const o of overlay.children) if (o.name.startsWith('edges-')) o.visible = $('show-edges').checked;
}
['show-nodes', 'show-edges'].forEach(id => $(id).addEventListener('change', applyVisibility));

// ---------- rota atual e trilha ----------
let pathLine = null, goalMark = null, trail = null;
const trailPts = [];
const trailMat = new THREE.LineBasicMaterial({color: 0xff9a9a, transparent: true, opacity: .75, depthTest: false});
function updateTrail() {
  if (trail) {dyn.remove(trail);trail.geometry.dispose();trail = null;}
  if (!trailPts.length || !$('show-trail').checked) return;
  const g = new THREE.BufferGeometry().setFromPoints(trailPts);trail = new THREE.Line(g, trailMat);trail.renderOrder = 6;dyn.add(trail);
}
function updatePath() {
  if (pathLine) {dyn.remove(pathLine);pathLine.geometry.dispose();pathLine = null;}
  if (goalMark) {dyn.remove(goalMark);goalMark.geometry.dispose();goalMark.material.dispose();goalMark = null;}
  const st = game.brain.nav;
  if (!$('show-path').checked || !st || !st.path?.length || mode !== 1) return;
  const nav = getNavGraph(game.mapState), red = game.fighters[1];
  const ps = [new THREE.Vector3(red.position.x, (red.groundY ?? 0) + (red.flight?.y ?? 0) + .2, red.position.z)];
  for (let i = st.i; i < st.path.length; i++) {const n = nav.nodes[st.path[i]];ps.push(new THREE.Vector3(n.x, n.y + .2, n.z));}
  pathLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(ps), new THREE.LineBasicMaterial({color: 0x7dffb0, depthTest: false}));pathLine.renderOrder = 8;dyn.add(pathLine);
  const g = nav.nodes[st.goal];
  if (g) {goalMark = new THREE.Mesh(new THREE.SphereGeometry(.28, 16, 12), new THREE.MeshBasicMaterial({color: st.status === 'unreachable' ? 0xff9f43 : 0x7dffb0, depthTest: false}));goalMark.position.set(g.x, g.y + .3, g.z);goalMark.renderOrder = 9;dyn.add(goalMark);}
}
$('show-path').addEventListener('change', updatePath);
$('show-trail').addEventListener('change', updateTrail);

// ---------- laço da simulação ----------
function stepOnce() {
  const [blue, red] = game.fighters;
  if (blue.hp < 30) blue.hp = blue.attributes?.hp ?? 100;   // o alvo é um boneco: reanima para continuar o teste
  if (game.phase === 'result') game.phase = 'playing';
  const before = {x: red.position.x, z: red.position.z}, act0 = red.action?.kind, dt = C.test.step;
  game.step(emptyCommand());
  const cmd = game.lastCommands?.[1];
  const moved = Math.hypot(red.position.x - before.x, red.position.z - before.z) / dt;
  if (tick > 60 && cmd && Math.hypot(cmd.move.x, cmd.move.z) > .5 && moved < .5 && !red.flight && !red.action) live.wallTicks++;
  if (red.flight && !live.wasAir) live.jumps++;
  live.wasAir = !!red.flight;
  if (red.action?.kind === 'tackle' && act0 !== 'tackle') {
    live.tackles++;
    if (Math.abs((red.groundY ?? 0) - (blue.groundY ?? 0)) > C.extras.nav.attackMaxHeightDiff) live.vain++;
  }
  if (game.lastStepEvents?.some(e => e.result === 'impact' || e.result === 'footstool')) live.hits++;
  const d = Math.hypot(red.position.x - blue.position.x, red.position.z - blue.position.z);
  if (live.reachedAt === null && d <= 2 && Math.abs((red.groundY ?? 0) + (red.flight?.y ?? 0) - (blue.groundY ?? 0)) < 1.2) live.reachedAt = tick * dt;
  if (live.lastX !== null) live.path += Math.hypot(red.position.x - live.lastX, red.position.z - live.lastZ);
  live.lastX = red.position.x;live.lastZ = red.position.z;
  if (tick % 6 === 0) {trailPts.push(new THREE.Vector3(red.position.x, (red.groundY ?? 0) + (red.flight?.y ?? 0) + .12, red.position.z));if (trailPts.length > 3000) trailPts.shift();}
  tick++;
}
function syncMarkers() {
  const [b, r] = game.fighters;
  blueM.position.set(b.position.x, (b.groundY ?? 0) + (b.flight?.y ?? 0), b.position.z);blueM.rotation.y = typeof b.facing === 'number' ? b.facing : 0;
  redM.position.set(r.position.x, (r.groundY ?? 0) + (r.flight?.y ?? 0), r.position.z);redM.rotation.y = typeof r.facing === 'number' ? r.facing : 0;
}
function liveText() {
  const [b, r] = game.fighters, st = game.brain.nav, d = Math.hypot(r.position.x - b.position.x, r.position.z - b.position.z);
  const row = (k, v) => `<div>${k}: <b>${v}</b></div>`;
  return row('Tempo simulado', (tick * C.test.step).toFixed(1) + ' s') + row('Distância ao alvo', d.toFixed(1) + ' m') + row('Estado da rota', mode ? (st?.status ?? 'aguardando') : 'navegação atual') +
    row('Chegou ao alvo', live.reachedAt === null ? 'não' : live.reachedAt.toFixed(1) + ' s') + row('Tempo empurrando parede', (live.wallTicks * C.test.step).toFixed(1) + ' s') +
    row('Saltos', live.jumps) + row('Ataques / no vazio', live.tackles + ' / ' + live.vain) + row('Replanejamentos / travamentos', mode ? `${st?.plans ?? 0} / ${st?.stuckCount ?? 0}` : '—') + row('Impactos', live.hits);
}
let last = performance.now(), frame = 0;
function render() {
  syncMarkers();controls.update();renderer.render(scene, camera);
}
function loop(now) {
  const dt = Math.min(.1, (now - last) / 1000);last = now;
  if (running) {
    acc += dt * speed;
    while (acc >= C.test.step) {stepOnce();acc -= C.test.step;}
    if (++frame % 3 === 0) {updatePath();updateTrail();}
  }
  if (frame % 6 === 0) $('live').innerHTML = liveText();
  render();
  requestAnimationFrame(loop);
}

// ---------- controles ----------
const sel = $('scenario');
for (const id of NAV_SCENARIO_IDS) sel.append(new Option(NAV_SCENARIOS[id].label, id));
sel.onchange = () => loadScenario(sel.value);
document.querySelectorAll('#nav-mode .btn').forEach(b => b.onclick = () => {
  mode = Number(b.dataset.nav);
  document.querySelectorAll('#nav-mode .btn').forEach(x => x.classList.toggle('active', x === b));
  C.extras.nav.enableNav = mode;
  restart();
});
$('run').onclick = () => {running = !running;$('run').textContent = running ? '⏸ Pausar' : '▶ Iniciar';};
function restart() {loadScenario(sel.value);updatePath();}
$('restart').onclick = restart;
$('speed').oninput = e => {speed = Number(e.target.value);$('speed-out').textContent = speed + '×';};

// Parâmetros do grafo (vão direto para C.extras.nav; o grafo é reconstruído).
const PARAMS = [
  {k: 'spacing', label: 'Espaçamento dos nós (m)', min: .75, max: 3, step: .25, rebuild: true},
  {k: 'jumpReach', label: 'Alcance horizontal do salto (m)', min: 1, max: 4, step: .1, rebuild: true},
  {k: 'jumpMargin', label: 'Folga sob a altura do salto (m)', min: 0, max: 1, step: .05, rebuild: true},
  {k: 'launch', label: 'Distância para decolar (m)', min: .5, max: 3, step: .1},
  {k: 'replan', label: 'Replanejamento (s)', min: .1, max: 2, step: .05},
  {k: 'stuckTime', label: 'Janela de travamento (s)', min: .3, max: 3, step: .1},
];
for (const p of PARAMS) {
  const wrap = document.createElement('div');wrap.className = 'pfield';
  wrap.innerHTML = `<label>${p.label}</label><output></output><input type="range" min="${p.min}" max="${p.max}" step="${p.step}">`;
  const out = wrap.querySelector('output'), inp = wrap.querySelector('input');
  inp.value = C.extras.nav[p.k];out.textContent = inp.value;
  inp.oninput = () => {
    C.extras.nav[p.k] = Number(inp.value);out.textContent = inp.value;
    if (p.rebuild) {clearNavCache();buildOverlay();}
  };
  $('params').append(wrap);
}

// Clique move o alvo; Shift+clique move o perseguidor.
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
let downAt = null;
canvas.addEventListener('pointerdown', e => {downAt = [e.clientX, e.clientY];});
canvas.addEventListener('pointerup', e => {
  if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 4) return;
  const rect = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = new THREE.Vector3();
  if (!ray.ray.intersectPlane(plane, hit)) return;
  const gy = getGroundHeight({x: hit.x, z: hit.z}, game.world, null);
  const [b, r] = game.fighters, keep = {blue: {x: b.position.x, z: b.position.z, y: b.groundY ?? 0}, red: {x: r.position.x, z: r.position.z, y: r.groundY ?? 0}};
  if (e.shiftKey) keep.red = {x: hit.x, z: hit.z, y: gy}; else keep.blue = {x: hit.x, z: hit.z, y: gy};
  loadScenario(sel.value, keep);
  say(`${e.shiftKey ? 'Perseguidor' : 'Alvo'} movido para (${hit.x.toFixed(1)}, ${hit.z.toFixed(1)}) · altura ${gy.toFixed(1)} m.`);
});

// Comparação A/B headless (mesmo cenário, duas navegações).
$('ab').onclick = () => {
  const btn = $('ab');btn.disabled = true;btn.textContent = 'Calculando…';
  setTimeout(() => {
    const id = sel.value, a = runNavScenario(Game, id, {nav: 0, seconds: 30}), b = runNavScenario(Game, id, {nav: 1, seconds: 30});
    clearNavCache();
    const f = v => v === null ? '—' : v + ' s';
    const better = (x, y, lowIsGood = true) => (lowIsGood ? y < x : y > x) ? 'ok' : (x === y ? '' : 'bad');
    $('ab-result').innerHTML = `<table class="m"><tr><th></th><th>Atual</th><th>Yuka</th></tr>
      <tr><td>Chegou ao alvo</td><td>${f(a.reachedAt)}</td><td class="${b.reachedAt !== null && a.reachedAt === null ? 'ok' : ''}">${f(b.reachedAt)}</td></tr>
      <tr><td>Menor distância</td><td>${a.minDist} m</td><td class="${better(a.minDist, b.minDist)}">${b.minDist} m</td></tr>
      <tr><td>Parede empurrada</td><td>${a.wallSeconds} s</td><td class="${better(a.wallSeconds, b.wallSeconds)}">${b.wallSeconds} s</td></tr>
      <tr><td>Saltos</td><td>${a.jumps}</td><td>${b.jumps}</td></tr>
      <tr><td>Ataques no vazio</td><td>${a.tacklesOutOfReach}</td><td class="${better(a.tacklesOutOfReach, b.tacklesOutOfReach)}">${b.tacklesOutOfReach}</td></tr>
      <tr><td>Travamentos</td><td>—</td><td>${b.stuckCount}</td></tr></table>
      <p class="hint">Esperado neste cenário: <b>${NAV_SCENARIOS[id].expect === 'reach' ? 'alvo alcançável' : 'alvo inalcançável'}</b>.</p>`;
    btn.disabled = false;btn.textContent = '⚖ Comparar A/B (30 s simulados)';
    loadScenario(id, null);
  }, 30);
};

// Gancho para testes de navegador.
window.__navLab = {get game() {return game;}, loadScenario, stepOnce, setMode: m => {mode = m;C.extras.nav.enableNav = m;}, runNavScenario: (id, o) => runNavScenario(Game, id, o)};

onResize();
loadScenario('muro');
say('Escolha o cenário, alterne <b>Atual</b> × <b>Yuka</b> e clique em <b>Iniciar</b>. Clique no piso para mover o alvo.');
requestAnimationFrame(loop);
