// Laboratório de pós-processamento (Fase 4). Cena comparativa com o MESMO renderer do Arenamon e o pipeline
// pmndrs/postprocessing (sem React): bloom por limiar ou seleção, distorção em impactos fortes, aberração cromática,
// color grading, vinheta e profundidade de campo. A/B (atual × pós × dividido), acessibilidade, eventos reais da
// simulação e medição de desempenho. Offline: tudo empacotado pelo esbuild.
import * as THREE from 'three';
import * as PP from 'postprocessing';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {PostPipeline} from '../src/view/post/post-pipeline.js';
import {postDefaults, feedPulses} from '../src/view/post/post-params.js';
import {rendererInfo, createGpuTimer} from '../src/ui/perf.js';
import {C, defaults, resetConfig} from '../src/sim/config.js';
import {Game} from '../src/sim/game.js';
import {emptyCommand} from '../src/sim/entity.js';
import {vec} from '../src/sim/math.js';
import {registerStandardMoves} from '../src/sim/moves/standard.js';

registerStandardMoves();
const $ = id => document.getElementById(id);
const say = html => {$('status').innerHTML = html;};

// ---------- cena ----------
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({canvas, antialias: true});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0e14);
scene.fog = new THREE.Fog(0x0b0e14, 16, 34);
const camera = new THREE.PerspectiveCamera(52, 1, .1, 100);
camera.position.set(0, 3.6, 9.2);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;controls.target.set(0, 1.1, 0);
scene.add(new THREE.HemisphereLight(0x9fb8e8, 0x1a1f2b, .85));
const sun = new THREE.DirectionalLight(0xffffff, 1.1);sun.position.set(5, 9, 4);scene.add(sun);

const floor = new THREE.Mesh(new THREE.CircleGeometry(12, 64), new THREE.MeshStandardMaterial({color: 0x232a38, roughness: .85}));
floor.rotation.x = -Math.PI / 2;scene.add(floor);
const grid = new THREE.GridHelper(24, 24, 0x2f3a52, 0x1d2433);grid.position.y = .01;scene.add(grid);
const ring = new THREE.Mesh(new THREE.RingGeometry(11.7, 11.9, 96), new THREE.MeshBasicMaterial({color: 0x2f6f9f, side: THREE.DoubleSide}));
ring.rotation.x = -Math.PI / 2;ring.position.y = .02;scene.add(ring);
// Painel claro "isca": brilha no bloom por limiar, NÃO no bloom por seleção (mostra por que não aplicamos bloom na arena inteira).
const decoy = new THREE.Mesh(new THREE.PlaneGeometry(4, 2), new THREE.MeshBasicMaterial({color: new THREE.Color(1.15, 1.15, 1.15), toneMapped: false}));
decoy.position.set(-7.5, 1.4, -5);decoy.rotation.y = .5;scene.add(decoy);
for (const [x, z, h, c] of [[7, -4, 2.6, 0x2c3a52], [9, 2, 1.6, 0x3a2c52], [-8, 3, 1.2, 0x2c523a]]) {
  const b = new THREE.Mesh(new THREE.BoxGeometry(2, h, 2), new THREE.MeshStandardMaterial({color: c, roughness: .8}));
  b.position.set(x, h / 2, z);scene.add(b);
}

function fighter(color) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(.4, .6, 6, 16), new THREE.MeshStandardMaterial({color, roughness: .5, metalness: .1}));
  body.position.y = .75;g.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(.15, .38, 10), new THREE.MeshBasicMaterial({color: 0xffffff}));
  nose.rotation.x = Math.PI / 2;nose.position.set(0, .8, .55);g.add(nose);
  return g;
}
const blue = fighter(0x4fa3ff), red = fighter(0xff5a5a);
blue.position.set(-2.6, 0, 0);blue.rotation.y = Math.PI / 2;red.position.set(2.6, 0, 0);red.rotation.y = -Math.PI / 2;
scene.add(blue, red);

// Objetos energéticos (candidatos ao bloom): orbe de carga, feixe e rastro de tackle (cores acima de 1 = HDR).
const hdr = (hex, k) => new THREE.Color(hex).multiplyScalar(k);
const orb = new THREE.Mesh(new THREE.SphereGeometry(.34, 24, 16), new THREE.MeshBasicMaterial({color: hdr(0x7fd4ff, 2.6), toneMapped: false}));
orb.position.set(0, 1.1, .2);blue.add(orb);orb.visible = false;
const beam = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, 5.2, 14), new THREE.MeshBasicMaterial({color: hdr(0xff9a3d, 2.4), toneMapped: false}));
beam.rotation.z = Math.PI / 2;beam.position.set(0, 1.2, 0);scene.add(beam);
const trail = new THREE.Mesh(new THREE.PlaneGeometry(3.2, .35), new THREE.MeshBasicMaterial({color: hdr(0xffe08a, 2.2), toneMapped: false, transparent: true, opacity: .9, side: THREE.DoubleSide}));
trail.position.set(-.2, .6, 2.2);trail.rotation.y = Math.PI / 2 - .3;scene.add(trail);
const energy = [orb, beam, trail];

// ---------- pipeline ----------
const P = {...postDefaults(), enabled: 1, dofOn: 1};
const a11y = () => ({noFlash: $('a-noFlash').checked, reduceMotion: $('a-reduceMotion').checked, highContrast: $('a-highContrast').checked});
const post = new PostPipeline({THREE, PP, renderer, scene, camera, params: P, accessibility: a11y});
function syncSelection() {for (const o of energy) post.select(o);}
syncSelection();

function onResize() {
  const w = canvas.clientWidth || 800, h = canvas.clientHeight || 600;
  camera.aspect = w / h;camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);post.setSize(w, h);
}
window.addEventListener('resize', onResize);

// ---------- A/B ----------
let viewMode = 'split', splitPct = 50;
function setView(m) {
  viewMode = m;
  document.querySelectorAll('#view-mode .btn').forEach(b => b.classList.toggle('active', b.dataset.m === m));
  $('split-line').style.display = $('tag-l').style.display = $('tag-r').style.display = m === 'split' ? 'block' : 'none';
  updateSplitLine();
}
function updateSplitLine() {$('split-line').style.left = splitPct + '%';$('tag-l').style.left = '12px';$('tag-r').style.right = '12px';}
document.querySelectorAll('#view-mode .btn').forEach(b => b.onclick = () => setView(b.dataset.m));
$('split').oninput = e => {splitPct = Number(e.target.value);$('split-out').textContent = splitPct + '%';updateSplitLine();};

// ---------- parâmetros (controles visuais) ----------
const GROUPS = [
  ['Bloom', [
    {k: 'bloomOn', t: 'chk', l: 'Bloom ligado'},
    {k: 'bloomMode', t: 'sel', l: 'Modo do bloom', opts: ['Por limiar de brilho', 'Por seleção (só energia)'], rebuild: true},
    {k: 'bloomIntensity', l: 'Intensidade', min: 0, max: 3, step: .05},
    {k: 'bloomThreshold', l: 'Limiar de brilho', min: .3, max: 1.5, step: .01},
    {k: 'bloomSmoothing', l: 'Suavização do limiar', min: 0, max: 1, step: .01},
    {k: 'bloomRadius', l: 'Raio', min: .1, max: 1, step: .01},
    {k: 'bloomAttackBoost', l: 'Reforço em ataques (×)', min: 1, max: 4, step: .1}]],
  ['Distorção de tela (impactos fortes)', [
    {k: 'distortOn', t: 'chk', l: 'Distorção ligada'},
    {k: 'distortStrength', l: 'Intensidade', min: 0, max: 2, step: .05},
    {k: 'distortSize', l: 'Largura da onda', min: .05, max: .8, step: .01},
    {k: 'distortMinDamage', l: 'Dano mínimo para disparar (HP)', min: 0, max: 40, step: 1}]],
  ['Aberração cromática', [
    {k: 'chromaOn', t: 'chk', l: 'Aberração ligada'},
    {k: 'chromaOffset', l: 'Base (discreta)', min: 0, max: .006, step: .0001},
    {k: 'chromaImpact', l: 'Pulso no impacto', min: 0, max: .02, step: .0005}]],
  ['Color grading', [
    {k: 'gradeOn', t: 'chk', l: 'Grading ligado'},
    {k: 'gradeSaturation', l: 'Saturação', min: -1, max: 1, step: .02},
    {k: 'gradeContrast', l: 'Contraste', min: -.5, max: .8, step: .02},
    {k: 'gradeBrightness', l: 'Brilho', min: -.4, max: .4, step: .01},
    {k: 'gradeHue', l: 'Matiz (°)', min: -180, max: 180, step: 1}]],
  ['Vinheta', [
    {k: 'vignetteOn', t: 'chk', l: 'Vinheta ligada'},
    {k: 'vignetteDarkness', l: 'Escuridão', min: 0, max: 1, step: .02},
    {k: 'vignetteOffset', l: 'Alcance (offset)', min: 0, max: 1, step: .02}]],
  ['Profundidade de campo', [
    {k: 'dofOn', t: 'chk', l: 'Profundidade de campo permitida'},
    {k: 'dofKoOnly', t: 'chk', l: 'Só em momentos cinematográficos (botão K.O.)'},
    {k: 'dofBokeh', l: 'Escala do bokeh', min: .5, max: 8, step: .1}]],
];
const controlsByKey = {};
function buildParams() {
  const box = $('params');box.innerHTML = '';
  for (const [title, fields] of GROUPS) {
    const h = document.createElement('div');h.className = 'hint';h.style.cssText = 'margin:10px 0 2px;color:var(--accent);font-weight:700';h.textContent = title;box.append(h);
    for (const f of fields) {
      const w = document.createElement('div');w.className = 'pfield';
      if (f.t === 'chk') {
        w.innerHTML = `<label class="chk" style="grid-column:1/-1"><input type="checkbox"> ${f.l}</label>`;
        const i = w.querySelector('input');i.checked = !!P[f.k];i.onchange = () => {P[f.k] = i.checked ? 1 : 0;};controlsByKey[f.k] = () => {i.checked = !!P[f.k];};
      } else if (f.t === 'sel') {
        w.innerHTML = `<label>${f.l}</label><select>${f.opts.map((o, n) => `<option value="${n}">${o}</option>`).join('')}</select>`;
        const s = w.querySelector('select');s.value = String(P[f.k]);s.onchange = () => {P[f.k] = Number(s.value);};controlsByKey[f.k] = () => {s.value = String(P[f.k]);};
      } else {
        w.innerHTML = `<label>${f.l}</label><output></output><input type="range" min="${f.min}" max="${f.max}" step="${f.step}">`;
        const i = w.querySelector('input'), o = w.querySelector('output');
        const show = () => {o.textContent = (+i.value).toFixed(f.step < .01 ? 4 : f.step < 1 ? 2 : 0);};
        i.value = P[f.k];show();i.oninput = () => {P[f.k] = Number(i.value);show();};controlsByKey[f.k] = () => {i.value = P[f.k];show();};
      }
      box.append(w);
    }
  }
}
buildParams();
const PRESETS = {
  sutil: {bloomIntensity: .6, bloomThreshold: .9, bloomAttackBoost: 1.4, distortStrength: .3, chromaOffset: .0005, chromaImpact: .002, gradeSaturation: .05, gradeContrast: .03, vignetteDarkness: .3},
  cinema: {bloomIntensity: .9, bloomThreshold: .8, bloomAttackBoost: 1.8, distortStrength: .5, chromaOffset: .0008, chromaImpact: .004, gradeSaturation: .1, gradeContrast: .06, vignetteDarkness: .4},
  intenso: {bloomIntensity: 1.6, bloomThreshold: .65, bloomAttackBoost: 2.6, distortStrength: 1, chromaOffset: .0015, chromaImpact: .009, gradeSaturation: .22, gradeContrast: .14, vignetteDarkness: .6},
};
document.querySelectorAll('[data-preset]').forEach(b => b.onclick = () => {
  Object.assign(P, PRESETS[b.dataset.preset]);for (const f of Object.values(controlsByKey)) f();say(`Predefinição <b>${b.textContent}</b> aplicada.`);
});

// ---------- eventos ----------
const seen = new WeakSet(), shock = (pos, s) => post.shock(pos, s);
const synth = (result, damage) => ({result, damage, attacker: 0, target: 1});
const fightersView = () => [{position: {x: blue.position.x, z: blue.position.z}, groundY: 0}, {position: {x: red.position.x, z: red.position.z}, groundY: 0}];
$('ev-impact').onclick = () => {feedPulses(post.pulses, [synth('impact', 32)], fightersView(), seen, shock, P.distortMinDamage);say('Impacto forte: pulso de bloom + aberração + onda de choque (se permitidos).');};
$('ev-clash').onclick = () => {feedPulses(post.pulses, [synth('clash', 0)], fightersView(), seen, shock, P.distortMinDamage);say('Clash: pulso médio no centro entre os lutadores.');};
let chargeUntil = 0;
$('ev-charge').onclick = () => {chargeUntil = performance.now() + 3000;orb.visible = true;say('Carga: o bloom é reforçado enquanto durar.');};
let koUntil = 0;
$('ev-ko').onclick = () => {koUntil = performance.now() + 3000;say('K.O.: profundidade de campo focada no vermelho por 3 s (precisa estar permitida).');};
$('dom-overlays').onchange = e => {const on = e.target.checked;$('lt').classList.toggle('on', on);$('lb').classList.toggle('on', on);$('sp').classList.toggle('on', on);$('hud').style.display = on ? 'flex' : 'none';};
$('dom-overlays').onchange({target: $('dom-overlays')});

// Simulação real: tackle do azul no vermelho; os eventos reais alimentam o pós.
let sim = null;
$('ev-sim').onclick = () => {
  if (sim) return;
  resetConfig(defaults());
  C.extras.toggles.enableEnemyAI = 0;
  const g = new Game({seed: 11});g.start();
  const a = g.fighters[0], d = g.fighters[1];
  a.position = vec(-2.6, 0);a.velocity = vec();a.facing = Math.PI / 2;a.groundY = 0;
  d.position = vec(0, 0);d.velocity = vec();d.facing = -Math.PI / 2;d.groundY = 0;
  sim = {g, ticks: 0, names: []};
  say('Simulação real em execução…');
};
function stepSim() {
  if (!sim) return;
  for (let k = 0; k < 4 && sim; k++) {
    const t = sim.ticks;
    const cmd = t <= 30 ? {...emptyCommand(), tackle: true, tackleHeld: true, move: vec(1, 0)} : emptyCommand();
    sim.g.step(cmd, emptyCommand());sim.ticks++;
    feedPulses(post.pulses, sim.g.lastStepEvents, sim.g.fighters.map(f => ({...f, position: {x: f.position.x, z: f.position.z}})), seen, shock, P.distortMinDamage);
    for (const e of sim.g.lastStepEvents) if (e.result === 'impact') sim.names.push('impacto');
    if (sim.ticks > 420) {say(`Simulação real encerrada · eventos de impacto: <b>${sim.names.length}</b>`);sim = null;blue.position.set(-2.6, 0, 0);red.position.set(2.6, 0, 0);return;}
  }
  if (sim) {const [a, d] = sim.g.fighters;blue.position.set(a.position.x, a.groundY ?? 0, a.position.z);red.position.set(d.position.x, d.groundY ?? 0, d.position.z);}
}

// ---------- laço ----------
const gpu = createGpuTimer(renderer);
const info = rendererInfo(renderer);
let last = performance.now();
const frames = {ms: [], cpu: [], gpu: []};
let collecting = false;
function drawFrame(mode, dt) {
  const t0 = performance.now();
  gpu.begin();
  if (mode === 'off') renderer.render(scene, camera);
  else {
    const ok = post.render(dt);
    if (!ok) renderer.render(scene, camera);
    else if (mode === 'split') {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      renderer.setScissorTest(true);renderer.setScissor(0, 0, Math.round(w * splitPct / 100), h);
      renderer.render(scene, camera);renderer.setScissorTest(false);
    }
  }
  gpu.end();
  const cpu = performance.now() - t0;
  if (collecting) {frames.cpu.push(cpu);const g = gpu.poll();if (g) frames.gpu.push(...g);}
}
function loop(now) {
  const dt = Math.min(.1, (now - last) / 1000);last = now;
  if (collecting) frames.ms.push(dt * 1000);
  controls.update();
  stepSim();
  const nowMs = performance.now();
  orb.visible = nowMs < chargeUntil;
  if (nowMs < chargeUntil) {orb.scale.setScalar(.6 + .8 * (1 - (chargeUntil - nowMs) / 3000));post.trigger('attack', .6);}
  post.setDof(nowMs < koUntil, {x: red.position.x, y: 1, z: red.position.z});
  const t = now / 1000;
  trail.material.opacity = .55 + .35 * Math.sin(t * 5);beam.scale.y = 1 + .06 * Math.sin(t * 9);
  drawFrame(collectingMode ?? viewMode, dt);
  requestAnimationFrame(loop);
}
let collectingMode = null;

// ---------- medição de desempenho ----------
const stat = a => {const s = [...a].sort((x, y) => x - y);return {avg: s.reduce((p, c) => p + c, 0) / (s.length || 1), p95: s[Math.floor(s.length * .95)] ?? 0};};
async function run(mode, ms) {
  collectingMode = mode;frames.ms.length = frames.cpu.length = frames.gpu.length = 0;collecting = true;
  await new Promise(r => setTimeout(r, ms));
  collecting = false;collectingMode = null;
  const f = stat(frames.ms.slice(2)), c = stat(frames.cpu.slice(2));
  return {fps: 1000 / f.avg, frameP95: f.p95, cpu: c.avg, gpu: frames.gpu.length ? stat(frames.gpu).avg : null, n: frames.ms.length};
}
$('measure').onclick = async () => {
  const b = $('measure');b.disabled = true;b.textContent = 'Medindo…';
  const off = await run('off', 3000), on = await run('on', 3000);
  const f = (v, d = 1) => v == null ? 'indisponível' : v.toFixed(d);
  const delta = on.cpu - off.cpu;
  $('perf-result').innerHTML = `<table class="m"><tr><th></th><th>Atual</th><th>Pós</th></tr>
    <tr><td>FPS médio</td><td>${f(off.fps)}</td><td>${f(on.fps)}</td></tr>
    <tr><td>Quadro p95 (ms)</td><td>${f(off.frameP95)}</td><td>${f(on.frameP95)}</td></tr>
    <tr><td>Envio ao WebGL (ms)</td><td>${f(off.cpu, 2)}</td><td>${f(on.cpu, 2)}</td></tr>
    <tr><td>Tempo de GPU (ms)</td><td>${f(off.gpu, 2)}</td><td>${f(on.gpu, 2)}</td></tr></table>
    <p class="hint">Custo do pós no envio ao WebGL: <b>${delta >= 0 ? '+' : ''}${delta.toFixed(2)} ms/quadro</b> · ${post.stats.passes} passes (${post.stats.effects.join(', ') || '—'}).
    ${info.software ? '<br><b>Atenção:</b> renderização por SOFTWARE detectada — FPS/GPU não representam uma placa de vídeo real.' : ''} ${gpu.available ? '' : '<br>Tempo de GPU: ' + gpu.reason}</p>`;
  b.disabled = false;b.textContent = '⏱ Medir (3 s cada)';
};

window.__postLab = {post, P, setView, get viewMode() {return viewMode;}, info, run, scene, renderer, camera};
onResize();setView('split');syncSelection();
say('Compare <b>Atual</b> × <b>Pós</b> (ou o modo dividido) e use os botões de evento. Todos os parâmetros têm controle ao lado.');
requestAnimationFrame(loop);
