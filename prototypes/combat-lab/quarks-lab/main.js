// Laboratório three.quarks do Arenamon (Fase 2): os efeitos A (carga), B (impacto),
// C (pouso) e footstool, editáveis por painel, com gatilho manual e a partir de
// eventos REAIS da simulação (Game). HTML autocontido offline (esbuild no build).
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import * as Quarks from 'three.quarks';
import {QuarksBridge} from '../src/view/quarks/bridge.js';
import {defaultQuarksPresets, QUARKS_PRESET_ORDER} from '../src/view/quarks/presets.js';
import {C, defaults, resetConfig} from '../src/sim/config.js';
import {Game} from '../src/sim/game.js';
import {emptyCommand} from '../src/sim/entity.js';
import {vec} from '../src/sim/math.js';
import {registerStandardMoves} from '../src/sim/moves/standard.js';

registerStandardMoves();

// ---------- cena (padrão threejs-scene-setup) ----------
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({canvas, antialias: true});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(canvas.clientWidth || window.innerWidth - 320, canvas.clientHeight || window.innerHeight - 49);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d1017);
scene.fog = new THREE.Fog(0x0d1017, 14, 30);

const camera = new THREE.PerspectiveCamera(55, 1, .1, 100);
camera.position.set(4.4, 3.2, 6.2);
camera.lookAt(0, 1, 0);

scene.add(new THREE.HemisphereLight(0xbfd6ff, 0x202631, .9));
const sun = new THREE.DirectionalLight(0xffffff, 1.4);
sun.position.set(4, 8, 3);
scene.add(sun);
scene.add(new THREE.GridHelper(16, 16, 0x2a3346, 0x1b2230));
const arenaRing = new THREE.Mesh(
  new THREE.RingGeometry(5.65, 5.8, 64),
  new THREE.MeshBasicMaterial({color: 0x2f5f85, side: THREE.DoubleSide}));
arenaRing.rotation.x = -Math.PI / 2;arenaRing.position.y = .01;
scene.add(arenaRing);

function onResize() {
  const w = canvas.clientWidth || window.innerWidth - 320, h = canvas.clientHeight || window.innerHeight - 49;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
window.addEventListener('resize', onResize);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 1, 0);

// ---------- marcadores dos lutadores ----------
function makeMarker(color) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(.34, .8, 6, 14),
    new THREE.MeshStandardMaterial({color, roughness: .55, metalness: .1}));
  body.position.y = .95;
  g.add(body);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(.42, .5, 32),
    new THREE.MeshBasicMaterial({color, transparent: true, opacity: .6, side: THREE.DoubleSide}));
  ring.rotation.x = -Math.PI / 2;ring.position.y = .02;
  g.add(ring);
  return g;
}
const blueMarker = makeMarker(0x4fa3ff), redMarker = makeMarker(0xff5a5a);
blueMarker.position.set(0, 0, -1.4);
redMarker.position.set(0, 0, 1.4);
scene.add(blueMarker, redMarker);

// ---------- camada quarks ----------
const reduceMotion = () => document.getElementById('reduce-motion').checked;
let presets = loadStored() ?? defaultQuarksPresets();
const bridge = new QuarksBridge({
  THREE, Quarks, scene,
  presets,
  accessibility: {reduceMotion},
});
const status = document.getElementById('status');
const say = html => {status.innerHTML = html;};

// ---------- persistência de presets ----------
const STORE_KEY = 'arenamon.quarks.presets.v1';
function loadStored() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    // valida formato mínimo
    return QUARKS_PRESET_ORDER.every(k => data[k] && data[k].label) ? data : null;
  } catch {return null;}
}
function storePresets() {
  localStorage.setItem(STORE_KEY, JSON.stringify(presets));
  setPresetStatus(`Salvo neste navegador (${new Date().toLocaleTimeString()}).`);
}
function setPresetStatus(t) {document.getElementById('preset-status').textContent = t;}
function applyPresets() {
  bridge.fx.presets = presets;
  renderParams();
}

document.getElementById('preset-save').onclick = storePresets;
document.getElementById('preset-load').onclick = () => {
  const data = loadStored();
  if (data) {presets = data;applyPresets();setPresetStatus('Presets carregados do navegador.');}
  else setPresetStatus('Nenhum preset salvo neste navegador.');
};
document.getElementById('preset-reset').onclick = () => {
  presets = defaultQuarksPresets();
  applyPresets();
  setPresetStatus('Presets restaurados ao padrão de fábrica.');
};
document.getElementById('preset-export').onclick = () => {
  const blob = new Blob([JSON.stringify(presets, null, 2)], {type: 'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'arenamon-quarks-presets.json';
  a.click();
  URL.revokeObjectURL(a.href);
  setPresetStatus('Exportado arenamon-quarks-presets.json.');
};
document.getElementById('preset-import').onchange = async e => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!QUARKS_PRESET_ORDER.every(k => data[k]?.label)) throw new Error('formato inválido');
    presets = data;
    applyPresets();
    setPresetStatus(`Importado de ${file.name}.`);
  } catch (err) {setPresetStatus(`Falha na importação: ${err.message}`);}
  e.target.value = '';
};

// ---------- abas de efeito ----------
let current = 'impact';
const DESC = {
  charge: 'Efeito A — partículas orbitando o personagem, intensidade crescente e encerramento controlado.',
  impact: 'Efeito B — explosão radial curta com faíscas energéticas e dissipação progressiva.',
  landing: 'Efeito C — poeira ao tocar o chão, proporcional à intensidade física do contato.',
  footstool: 'Efeito separado do footstool — nuvem curta e leve acima do alvo pisado.',
};
const tabsEl = document.getElementById('effect-tabs');
for (const name of QUARKS_PRESET_ORDER) {
  const b = document.createElement('button');
  b.className = 'btn';b.textContent = presets[name]?.label ?? name;
  b.onclick = () => {current = name;renderTabs();renderParams();};
  tabsEl.append(b);
}
function renderTabs() {
  [...tabsEl.children].forEach((b, i) => b.classList.toggle('active', QUARKS_PRESET_ORDER[i] === current));
  document.getElementById('effect-desc').textContent = DESC[current] ?? '';
}
renderTabs();

// ---------- painel de parâmetros ----------
const SIZE_CURVES = {'fade suave': [1, .9, .35, .05], 'fade rápido': [1, .5, .15, 0], 'cresce': [.2, .6, 1, 1.2], 'constante': [1, 1, 1, 1]};
const SPEED_CURVES = {'dissipa': [1, .75, .3, .1], 'sustenta': [1, 1, .8, .6], 'impulso': [.2, .9, 1, .4]};
const hex = n => '#' + (n ?? 0xffffff).toString(16).padStart(6, '0');
const num = h => parseInt(h.slice(1), 16);

function getPath(obj, path) {return path.split('.').reduce((o, k) => o?.[k], obj);}
function setPath(obj, path, v) {
  const ks = path.split('.'), last = ks.pop();
  const tgt = ks.reduce((o, k) => (o[k] ??= {}), obj);
  tgt[last] = v;
}

const FIELDS = [
  {path: 'burst.count', label: 'Quantidade (explosão)', min: 4, max: 120, step: 1, when: p => !p.continuous},
  {path: 'emissionOverTime', label: 'Emissão contínua (part./s)', min: 5, max: 300, step: 5, when: p => !!p.continuous},
  {path: 'duration', label: 'Duração (s)', min: .1, max: 3, step: .05},
  {path: 'scale', label: 'Escala global', min: .25, max: 3, step: .05},
  {path: 'startSpeed.0', label: 'Velocidade mín (m/s)', min: 0, max: 15, step: .1},
  {path: 'startSpeed.1', label: 'Velocidade máx (m/s)', min: 0, max: 15, step: .1},
  {path: 'startSize.0', label: 'Tamanho mín (m)', min: .02, max: 1, step: .01},
  {path: 'startSize.1', label: 'Tamanho máx (m)', min: .02, max: 1, step: .01},
  {path: 'opacity', label: 'Transparência (alfa global)', min: .1, max: 1, step: .05, when: p => p.opacity !== undefined},
  {path: 'gravity', label: 'Gravidade (m/s²)', min: -20, max: 0, step: .5, when: p => p.gravity !== undefined},
  {type: 'color', path: 'startColor.a', label: 'Cor inicial A'},
  {type: 'color', path: 'startColor.b', label: 'Cor inicial B'},
  {type: 'color', path: 'colorOverLife.end', label: 'Cor final do gradiente'},
  {type: 'select', path: 'shape.type', label: 'Forma do emissor', options: ['point', 'sphere', 'cone', 'donut', 'circle']},
  {path: 'shape.radius', label: 'Raio do emissor (m)', min: .05, max: 2, step: .05, when: p => p.shape?.type !== 'point'},
  {path: 'shape.angle', label: 'Abertura do cone (°)', min: 5, max: 120, step: 1, when: p => p.shape?.type === 'cone'},
  {path: 'shape.thickness', label: 'Espessura do anel (m)', min: .01, max: .5, step: .01, when: p => ['donut', 'circle'].includes(p.shape?.type)},
  {path: 'shape.dir.y', label: 'Direção do cone (Y)', min: -1, max: 1, step: .1, when: p => p.shape?.type === 'cone'},
  {path: 'emitterOffset.y', label: 'Altura relativa (m)', min: -.5, max: 3, step: .05},
  {path: 'emitterOffset.x', label: 'Lateral relativa (m)', min: -2, max: 2, step: .05},
  {path: 'emitterRotation.x', label: 'Rotação do emissor X (°)', min: -180, max: 180, step: 5, deg: true, when: p => !!p.emitterRotation},
  {type: 'curve', path: 'sizeOverLife', label: 'Curva de tamanho', curves: SIZE_CURVES, when: p => !!p.sizeOverLife},
  {type: 'curve', path: 'speedOverLife', label: 'Curva de intensidade', curves: SPEED_CURVES, when: p => !!p.speedOverLife},
  {path: 'orbit.speed.0', label: 'Velocidade orbital mín', min: 0, max: 12, step: .2, when: p => !!p.orbit},
  {path: 'orbit.speed.1', label: 'Velocidade orbital máx', min: 0, max: 12, step: .2, when: p => !!p.orbit},
];

function renderParams() {
  const box = document.getElementById('params');
  box.innerHTML = '';
  const preset = presets[current];
  for (const f of FIELDS) {
    if (f.when && !f.when(preset)) continue;
    const wrap = document.createElement('div');
    wrap.className = 'pfield';
    const lab = document.createElement('label');
    lab.textContent = f.label;
    wrap.append(lab);
    if (f.type === 'select') {
      const sel = document.createElement('select');
      for (const o of f.options) {
        const op = document.createElement('option');
        op.value = op.textContent = o;
        sel.append(op);
      }
      sel.value = getPath(preset, f.path);
      sel.onchange = () => {setPath(preset, f.path, sel.value);renderParams();};
      wrap.append(sel);
    } else if (f.type === 'curve') {
      const sel = document.createElement('select');
      const entries = Object.entries(f.curves);
      for (const [name, v] of entries) {
        const op = document.createElement('option');
        op.value = JSON.stringify(v);op.textContent = name;
        sel.append(op);
      }
      const cur = JSON.stringify(getPath(preset, f.path));
      sel.value = entries.some(([, v]) => JSON.stringify(v) === cur) ? cur : JSON.stringify(entries[0][1]);
      sel.onchange = () => {setPath(preset, f.path, JSON.parse(sel.value));};
      wrap.append(sel);
    } else if (f.type === 'color') {
      const inp = document.createElement('input');
      inp.type = 'color';
      if (f.path === 'colorOverLife.end') {
        const stops = preset.colorOverLife?.stops ?? [];
        inp.value = hex(stops.length ? stops[stops.length - 1].color : 0xffffff);
        inp.oninput = () => {if (stops.length) stops[stops.length - 1].color = num(inp.value);};
      } else {
        inp.value = hex(getPath(preset, f.path) ?? 0xffffff);
        inp.oninput = () => setPath(preset, f.path, num(inp.value));
      }
      wrap.append(inp);
    } else {
      // slider numérico (com índice de array e graus opcional)
      const [base, idx] = f.path.includes('.') && /^\d+$/.test(f.path.split('.').pop() ?? '')
        ? [f.path.slice(0, f.path.lastIndexOf('.')), Number(f.path.split('.').pop())]
        : [f.path, null];
      const out = document.createElement('output');
      const slider = document.createElement('input');
      slider.type = 'range';slider.min = f.min;slider.max = f.max;slider.step = f.step;
      const read = () => {
        let v = getPath(preset, base);
        if (idx !== null) v = v?.[idx];
        if (f.deg) v = (v ?? 0) * 180 / Math.PI;
        return v ?? 0;
      };
      const write = v => {
        if (f.deg) v = v * Math.PI / 180;
        if (idx !== null) {
          const arr = getPath(preset, base) ?? [];
          arr[idx] = v;
          setPath(preset, base, arr);
        } else setPath(preset, base, v);
        out.textContent = (+v).toFixed(f.step < 1 ? 2 : 0);
      };
      slider.value = read();
      out.textContent = (+slider.value).toFixed(f.step < 1 ? 2 : 0);
      slider.oninput = () => write(+slider.value);
      wrap.append(out, slider);
    }
    box.append(wrap);
  }
}
renderParams();

// ---------- gatilhos manuais ----------
const markerPos = m => ({x: m.position.x, y: 0, z: m.position.z});
document.getElementById('trigger-burst').onclick = () => {
  if (presets[current].continuous) say(`<b>${presets[current].label}</b> é contínuo — use “Simular carga”.`);
  else {
    bridge.fx.emitBurst(current, markerPos(blueMarker), {power: 1});
    say(`Explosão <b>${presets[current].label}</b> disparada no marcador.`);
  }
};
let chargeTimer = null;
document.getElementById('trigger-charge').onclick = () => {
  if (chargeTimer) return;
  bridge.fx.attach('charge', blueMarker, {key: 'lab'});
  let t = 0;
  say('Carga em andamento — intensidade crescendo…');
  chargeTimer = setInterval(() => {
    t += .1;
    bridge.fx.setIntensity('lab', Math.min(1, t / 3));
    if (t >= 3) {
      clearInterval(chargeTimer);chargeTimer = null;
      bridge.fx.detach('lab');
      bridge.fx.emitBurst('charge', markerPos(blueMarker), {power: 1.6});
      say('Carga liberada — encerramento controlado + rajada final.');
    }
  }, 100);
};

// ---------- modo simulação real ----------
let sim = null;
document.getElementById('trigger-sim').onclick = () => {
  if (sim) return;
  resetConfig(defaults());
  C.extras.toggles.enableEnemyAI = 0;
  const g = new Game({seed: 11});
  g.start();
  const a = g.fighters[0], d = g.fighters[1];
  a.position = {x: 0, z: -2.4};a.velocity = vec();a.facing = 0;a.groundY = 0;
  d.position = {x: 0, z: 0};d.velocity = vec();d.facing = Math.PI;d.groundY = 0;
  const cmd = o => ({...emptyCommand(), ...o});
  // roteiro: carrega e solta o tackle no rival; depois persegue, pula sobre ele
  // e cai de novo (footstool + pousos reais).
  sim = {g, ticks: 0, events: [], jumped: false};
  sim.stepCmd = () => {
    if (sim.ticks <= 30) return cmd({tackle: true, tackleHeld: true, move: vec(0, 1)}); // carrega e solta
    const defenderFirme = !d.flight && (d.state === 'neutral' || d.state === 'grounded' || d.state === 'idle');
    if (!sim.jumped && sim.ticks >= 80 && defenderFirme) {                               // rival firme no chão: cair sobre ele
      sim.jumped = true;
      a.position = {x: d.position.x, z: d.position.z - .3};
      a.velocity = vec();
      a.flight = {y: 2.4, vy: -3, horizontal: vec(), isNormalJump: true, jumpFeel: true, jumpHeld: false};
    }
    return cmd(); // deixa a física rolar (footstool, pousos e re-ações)
  };
  say('Simulação real em execução — eventos disparam os efeitos…');
};
const EVENT_LABEL = {
  impact: 'impacto', footstool: 'footstool', clash: 'clash', tackleClash: 'clash de tackles',
  partial: 'bloqueio', perfect: 'parry', chargeRelease: 'soltura de carga', wallSplat: 'parede',
};
function stepSim() {
  if (!sim) return;
  for (let k = 0; k < 4 && sim; k++) { // 4 passos de sim por quadro (~4×)
    sim.g.step(sim.stepCmd(), emptyCommand());
    sim.ticks++;
    bridge.update(sim.g.fighters, sim.g.lastStepEvents, C.test.step * 4);
    for (const e of sim.g.lastStepEvents) {
      const label = EVENT_LABEL[e.result];
      if (label) sim.events.push(`${label} (${e.tick})`);
    }
    if (sim.ticks > 600) {
      say(`Simulação encerrada · eventos: <b>${sim.events.join(', ') || 'nenhum'}</b>`);
      sim = null;
      return;
    }
  }
  if (sim) {
    // marcadores acompanham os lutadores da simulação
    blueMarker.position.set(sim.g.fighters[0].position.x, (sim.g.fighters[0].flight?.y ?? 0), sim.g.fighters[0].position.z);
    redMarker.position.set(sim.g.fighters[1].position.x, (sim.g.fighters[1].flight?.y ?? 0), sim.g.fighters[1].position.z);
    const last = sim.events[sim.events.length - 1];
    say(`Sim. passo ${sim.ticks}/600 · último evento: <b>${last ?? '—'}</b>`);
  }
}

// ---------- toggles ----------
document.getElementById('quarks-enabled').onchange = e => {bridge.fx.enabled = e.target.checked;};
document.getElementById('reduce-motion').onchange = () => say(`Movimento reduzido: ${reduceMotion() ? 'ligado (partículas ×0,35)' : 'desligado'}.`);

// ---------- loop ----------
let last = performance.now();
renderer.setAnimationLoop(now => {
  const dt = Math.min(.05, (now - last) / 1000);
  last = now;
  controls.update();
  stepSim();
  // respiro visual dos marcadores fora da simulação
  const bob = Math.sin(now / 400) * .04;
  if (!sim) {
    blueMarker.children[0].position.y = .95 + bob;
    redMarker.children[0].position.y = .95 - bob;
    bridge.fx.update(dt); // durante a simulação o próprio stepSim já avança a camada
  }
  renderer.render(scene, camera);
});
onResize();
