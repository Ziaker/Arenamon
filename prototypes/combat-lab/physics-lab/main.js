// Laboratório de física Rapier (Fase 5, prova de conceito ISOLADA). Roda os mesmos cenários na física atual do Arenamon e em
// Rapier (API JS direta; WASM embutido em base64 → funciona offline) e mostra trilhas, métricas, determinismo e custo.
// Nada aqui altera o jogo: a física principal continua sendo a do Arenamon.
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {C} from '../src/sim/config.js';
import {registerStandardMoves} from '../src/sim/moves/standard.js';
import {POC_SCENARIOS, POC_IDS, DT, HALF, BODY_H} from '../src/physics-poc/poc-scenarios.js';
import {runAll, evaluate, battery, ENGINES, CRITERIA} from '../src/physics-poc/poc-report.js';
import {rapierDefaults} from '../src/physics-poc/poc-rapier.js';
import {determinismArenamon, determinismRapier, benchRapier, benchArenamon, median} from '../src/physics-poc/poc-bench.js';

registerStandardMoves();
const $ = id => document.getElementById(id);
const say = html => {$('status').innerHTML = html;};

// ---------- inicialização do WASM (medida) ----------
const t0 = performance.now();
RAPIER.init().then(() => start(performance.now() - t0));

function start(initMs) {
$('init-info').textContent = `Rapier ${RAPIER.version()} · WASM iniciado em ${initMs.toFixed(0)} ms (embutido, sem rede)`;

// ---------- cena ----------
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({canvas, antialias: true});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d1017);
const camera = new THREE.PerspectiveCamera(48, 1, .1, 200);
camera.position.set(9, 6, -4);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;controls.target.set(0, 1, 4);
scene.add(new THREE.HemisphereLight(0xbfd6ff, 0x202631, 1.0));
const sun = new THREE.DirectionalLight(0xffffff, 1.2);sun.position.set(5, 12, -3);scene.add(sun);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({color: 0x1d2433, roughness: .9}));
floor.rotation.x = -Math.PI / 2;scene.add(floor);
scene.add(new THREE.GridHelper(40, 40, 0x2f3a52, 0x1d2433));
const world = new THREE.Group();scene.add(world);
function onResize() {
  const w = canvas.clientWidth || 800, h = canvas.clientHeight || 600;
  camera.aspect = w / h;camera.updateProjectionMatrix();renderer.setSize(w, h, false);
}
window.addEventListener('resize', onResize);

const COLORS = {arenamon: 0x4fa3ff, box: 0xffa94d, capsule: 0x69db7c};
const ghosts = {}, trails = {};
function makeGhost(engine) {
  const g = new THREE.Group(), color = COLORS[engine];
  if (engine === 'capsule') g.add(Object.assign(new THREE.Mesh(new THREE.CapsuleGeometry(HALF, BODY_H - 2 * HALF, 6, 16), new THREE.MeshStandardMaterial({color, transparent: true, opacity: .75}))));
  else g.add(new THREE.Mesh(new THREE.BoxGeometry(HALF * 2, BODY_H, HALF * 2), new THREE.MeshStandardMaterial({color, transparent: true, opacity: .7})));
  g.children[0].position.y = BODY_H / 2;
  g.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(HALF * 2, BODY_H, HALF * 2)), new THREE.LineBasicMaterial({color})));
  g.children[1].position.y = BODY_H / 2;
  return g;
}
for (const e of ENGINES) {ghosts[e.id] = makeGhost(e.id);scene.add(ghosts[e.id]);}

function disposeGroup(gp) {for (const o of [...gp.children]) {gp.remove(o);o.geometry?.dispose();o.material?.dispose?.();}}
function buildWorld(id) {
  disposeGroup(world);
  for (const s of POC_SCENARIOS[id].solids) {
    const h = s.top - s.base, geo = s.shape === 'cyl' ? new THREE.CylinderGeometry(s.r, s.r, h, 36) : new THREE.BoxGeometry(s.hx * 2, h, s.hz * 2);
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({color: s.id.startsWith('plat') ? 0x5a8f6a : 0x4a5873, roughness: .8, transparent: true, opacity: .85}));
    m.position.set(s.x, s.base + h / 2, s.z);world.add(m);
    const l = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({color: 0x0d1017}));l.position.copy(m.position);world.add(l);
  }
}
function drawTrails(results) {
  for (const k of Object.keys(trails)) {scene.remove(trails[k]);trails[k].geometry.dispose();delete trails[k];}
  for (const e of ENGINES) {
    const pts = results[e.id].trace.map(p => new THREE.Vector3(p.x, p.y + .05, p.z));
    trails[e.id] = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({color: COLORS[e.id], transparent: true, opacity: .55}));
    scene.add(trails[e.id]);
  }
}

// ---------- estado ----------
let current = POC_IDS[0], results = null, tick = 0, playing = false, speed = 1, acc = 0;
const opts = rapierDefaults();
const shared = {jumpHeight: C.map.jumpHeight, jumpGravityUp: C.map.jumpGravityUp, jumpGravityDown: C.map.jumpGravityDown};
const tweak = c => {c.map.jumpHeight = shared.jumpHeight;c.map.jumpGravityUp = shared.jumpGravityUp;c.map.jumpGravityDown = shared.jumpGravityDown;};

function run() {
  const sc = POC_SCENARIOS[current];
  for (const r of Object.values(results ?? {})) r.sim?.dispose?.();
  results = runAll(RAPIER, current, opts, tweak);
  const checks = evaluate(current, results);   // (descarta as instâncias do Rapier)
  $('scrub').max = sc.ticks - 1;tick = 0;$('scrub').value = 0;
  buildWorld(current);drawTrails(results);syncGhosts();
  const row = e => {
    const r = results[e.id], mine = checks.filter(c => c.engine === e.id), ok = mine.every(c => c.ok);
    return `<tr><td>${e.label}</td><td>${r.final.y.toFixed(3)}</td><td>${r.maxY.toFixed(2)}</td><td>${(r.penetration * 1000).toFixed(1)}</td><td>${r.jitter.y.toFixed(2)}</td><td class="${ok ? 'ok' : 'bad'}">${ok ? '✓' : '✗'}</td></tr>`;
  };
  $('result').innerHTML = `<table class="m"><tr><th></th><th>y final (m)</th><th>y máx (m)</th><th>penetr. (mm)</th><th>tremor (mm)</th><th></th></tr>${ENGINES.map(row).join('')}</table>
    <ul class="hint" style="padding-left:16px;margin:8px 0 0">${CRITERIA[current].map(([t]) => `<li>${t}</li>`).join('')}</ul>
    <p class="hint">Penetração medida por oráculo geométrico independente. Arenamon admite até 25 cm ao montar plataformas (tolerância de degrau do projeto).</p>`;
  $('scenario-hint').textContent = sc.hint;$('scenario-expect').textContent = 'Esperado: ' + sc.expect + '.';
}
function syncGhosts() {
  const i = Math.min(tick, POC_SCENARIOS[current].ticks - 1);
  for (const e of ENGINES) {
    const p = results[e.id].trace[i];
    ghosts[e.id].position.set(p.x, p.y, p.z);
    ghosts[e.id].visible = $('vis-' + e.id).checked;
  }
  $('scrub').value = i;$('scrub-out').textContent = (i * DT).toFixed(2).replace('.', ',') + ' s';
}

// ---------- controles ----------
const sel = $('scenario');
for (const id of POC_IDS) sel.append(new Option(POC_SCENARIOS[id].label, id));
sel.onchange = () => {current = sel.value;run();};
$('rerun').onclick = run;
$('play').onclick = () => {
  playing = !playing;$('play').textContent = playing ? '⏸ Pausar' : '▶ Reproduzir';
  if (playing && tick >= POC_SCENARIOS[current].ticks - 1) tick = 0;
};
$('scrub').oninput = e => {tick = Number(e.target.value);syncGhosts();};
$('speed').oninput = e => {speed = Number(e.target.value);$('speed-out').textContent = speed + '×';};
for (const e of ENGINES) $('vis-' + e.id).onchange = syncGhosts;

const FIELDS = [
  {o: shared, k: 'jumpHeight', l: 'Altura do salto (m) — as duas físicas', min: .5, max: 4, step: .1},
  {o: shared, k: 'jumpGravityUp', l: 'Gravidade na subida (m/s²) — as duas', min: 5, max: 40, step: .5},
  {o: shared, k: 'jumpGravityDown', l: 'Gravidade na descida (m/s²) — as duas', min: 5, max: 40, step: .5},
  {o: opts, k: 'skin', l: 'Rapier: folga de contato (skin, m)', min: .001, max: .1, step: .001},
  {o: opts, k: 'snapDistance', l: 'Rapier: snap-to-ground (m, 0 = desligado)', min: 0, max: .5, step: .01},
  {o: opts, k: 'maxSlope', l: 'Rapier: inclinação máxima escalável (°)', min: 5, max: 85, step: 1},
  {o: opts, k: 'autostepHeight', l: 'Rapier: altura do autostep (m)', min: .1, max: 1.2, step: .05},
  {o: opts, k: 'autostep', t: 'chk', l: 'Rapier: autostep (sobe degraus sem pular)'},
  {o: opts, k: 'ccd', t: 'chk', l: 'Rapier: CCD no corpo cinemático'},
];
for (const f of FIELDS) {
  const w = document.createElement('div');w.className = 'pfield';
  if (f.t === 'chk') {
    w.innerHTML = `<label class="chk" style="grid-column:1/-1"><input type="checkbox"> ${f.l}</label>`;
    const i = w.querySelector('input');i.checked = !!f.o[f.k];i.onchange = () => {f.o[f.k] = i.checked ? 1 : 0;run();};
  } else {
    w.innerHTML = `<label>${f.l}</label><output></output><input type="range" min="${f.min}" max="${f.max}" step="${f.step}">`;
    const i = w.querySelector('input'), o = w.querySelector('output');
    i.value = f.o[f.k];o.textContent = (+i.value).toFixed(f.step < .01 ? 3 : 2);
    i.oninput = () => {f.o[f.k] = Number(i.value);o.textContent = (+i.value).toFixed(f.step < .01 ? 3 : 2);};
    i.onchange = run;
  }
  $('params').append(w);
}

// ---------- bateria completa ----------
$('battery').onclick = async () => {
  const b = $('battery');b.disabled = true;b.textContent = 'Executando…';
  await new Promise(r => setTimeout(r, 30));
  const res = battery(RAPIER, opts, tweak);
  let det = {a: 0, r: 0, n: 0};
  for (const id of POC_IDS) {
    const a = await determinismArenamon(POC_SCENARIOS[id]), r = await determinismRapier(RAPIER, POC_SCENARIOS[id], opts);
    det.n++;if (a.repeat && a.saveLoad) det.a++;if (r.repeat && r.saveLoad) det.r++;
  }
  const arena = median(() => benchArenamon(300)), r2 = median(() => benchRapier(RAPIER, 2, 300)), r50 = median(() => benchRapier(RAPIER, 50, 200), 3);
  const cell = e => `<td class="${res.pass[e] === res.total[e] ? 'ok' : 'bad'}">${res.pass[e]}/${res.total[e]}</td>`;
  const mark = (r, id) => res.rows.find(x => x.id === id).checks.filter(c => c.engine === r).every(c => c.ok) ? '<td class="ok">✓</td>' : '<td class="bad">✗</td>';
  $('battery-result').innerHTML = `<table class="m"><tr><th>Cenário</th><th>Arenamon</th><th>Caixa</th><th>Cápsula</th></tr>
    ${POC_IDS.map(id => `<tr><td>${POC_SCENARIOS[id].label}</td>${mark('arenamon', id)}${mark('box', id)}${mark('capsule', id)}</tr>`).join('')}
    <tr><td>Critérios aprovados</td>${cell('arenamon')}${cell('box')}${cell('capsule')}</tr>
    <tr><td>Determinismo + save/load</td><td class="${det.a === det.n ? 'ok' : 'bad'}">${det.a}/${det.n}</td><td class="${det.r === det.n ? 'ok' : 'bad'}" colspan="2">${det.r}/${det.n} (snapshot)</td></tr></table>
    <p class="hint"><b>Custo por passo (mediana):</b> Arenamon completo ${arena.fullStepUs.toFixed(0)} µs (só física ${arena.physicsOnlyUs.toFixed(0)} µs) · Rapier 2 personagens ${r2.toFixed(0)} µs · 50 personagens ${r50.toFixed(0)} µs · orçamento a 120 Hz = 8333 µs.<br>
    <b>WASM:</b> iniciado em ${initMs.toFixed(0)} ms; embutido em base64 (≈4,3 MB) dentro do HTML.<br>
    A "caixa" trava de frente em cilindros (esperado); a cápsula contorna. O Arenamon aproxima o personagem por círculo contra cilindros.</p>`;
  b.disabled = false;b.textContent = '⚙ Rodar bateria (7 cenários × 3 motores)';
  window.__physLab.lastBattery = {pass: res.pass, total: res.total, det, perf: {arena, r2, r50}};
};

// ---------- laço ----------
let last = performance.now();
function loop(now) {
  const dt = Math.min(.1, (now - last) / 1000);last = now;
  if (playing) {
    acc += dt * speed;
    while (acc >= DT) {acc -= DT;tick++;}
    if (tick >= POC_SCENARIOS[current].ticks - 1) {tick = POC_SCENARIOS[current].ticks - 1;playing = false;$('play').textContent = '▶ Reproduzir';}
    syncGhosts();
  }
  controls.update();renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
window.__physLab = {RAPIER, initMs, run, select: id => {sel.value = id;current = id;run();}, get results() {return results;}, lastBattery: null};
onResize();run();
say('Escolha o cenário, reproduza e compare as três trilhas. Todos os parâmetros têm controle ao lado.');
requestAnimationFrame(loop);
}
