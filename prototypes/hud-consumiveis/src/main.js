// Laboratório visual: HUD de progressão (5 atributos) × coleções de consumíveis (7 tipos), 3×3 combinações.
// Isolado do jogo principal: não importa nada de prototypes/combat-lab e não implementa coleta, spawn nem regras.
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {ATTRS, ATTR_BY_KEY, ITEM_TYPES, ITEM_STYLES, HUD_STYLES, MAX_STAGE, stageText} from './data.js';
import {HudManager} from './hud.js';
import {ItemField, HOVER} from './items.js';
import {ItemFx} from './fx.js';
import {buildArena, LAYOUTS, CAMERA_PRESETS} from './arena.js';

const $ = id => document.getElementById(id);
const errors = [];
addEventListener('error', e => errors.push(String(e.message)));
addEventListener('unhandledrejection', e => errors.push(String(e.reason)));

// ---------- cena ----------
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({canvas, antialias: true, powerPreference: 'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 220);
const controls = new OrbitControls(camera, canvas);
Object.assign(controls, {enableDamping: true, dampingFactor: 0.09, minDistance: 2.2, maxDistance: 40, maxPolarAngle: Math.PI / 2 - 0.03, screenSpacePanning: false, rotateSpeed: .8, zoomSpeed: .9});

const arena = buildArena(scene);
const field = new ItemField(scene);
const fx = new ItemFx(scene);
const hud = new HudManager($('hud-root'));

// ---------- câmera ----------
const tween = {active: false, t: 0, dur: .7, fp: new THREE.Vector3(), ft: new THREE.Vector3(), tp: new THREE.Vector3(), tt: new THREE.Vector3()};
function flyTo(pos, target, dur = .7) {
  tween.fp.copy(camera.position); tween.ft.copy(controls.target);
  tween.tp.set(...pos); tween.tt.set(...target);
  tween.t = 0; tween.dur = dur; tween.active = true;
}
function setCameraPreset(name, instant = false) {
  const p = CAMERA_PRESETS[name];
  if (!p) return;
  if (instant) { camera.position.set(...p.pos); controls.target.set(...p.target); controls.update(); tween.active = false; }
  else flyTo(p.pos, p.target);
}

// ---------- estado ----------
const state = {hud: 'A', items: 'A', layout: 'arena', selected: null, particles: true, hudUser: 1};

function autoScale() { return innerHeight >= 1000 ? 1.22 : 1; }
function applyHudScale() { hud.setScale(+(state.hudUser * autoScale()).toFixed(3)); }
function refreshFx() {
  fx.enabled = state.particles;
  if (!state.particles) { fx.clear(); return; }
  fx.attach(field.items.map(it => ({object: it.slot, color: it.type.color})), state.items, HOVER[state.items]);
}

function setHud(id) {
  if (!HUD_STYLES.some(h => h.id === id)) return;
  state.hud = id; hud.show(id);
  document.querySelectorAll('[data-hud-btn]').forEach(b => b.classList.toggle('on', b.dataset.hudBtn === id));
  $('cap-hud').textContent = `HUD ${id} · ${HUD_STYLES.find(h => h.id === id).nome}`;
}
function setItems(id) {
  if (!ITEM_STYLES.some(s => s.id === id)) return;
  state.items = id; field.setStyle(id); refreshFx();
  document.querySelectorAll('[data-items-btn]').forEach(b => b.classList.toggle('on', b.dataset.itemsBtn === id));
  $('cap-items').textContent = `Itens ${id} · ${ITEM_STYLES.find(s => s.id === id).nome}`;
}
function setLayout(name) {
  state.layout = name; field.setPositions(LAYOUTS[name]);
  $('layout').value = name;
  setCameraPreset(name === 'vitrine' ? 'vitrine' : 'inicial');
}

// ---------- inspeção ----------
const label = $('itemlabel');
function select(item) {
  state.selected = item; field.selected = item;
  document.querySelectorAll('.chip-item').forEach(c => c.classList.toggle('on', !!item && c.dataset.item === item.type.id));
  const card = $('inspect');
  if (!item) { card.hidden = true; label.hidden = true; return; }
  const t = item.type;
  card.hidden = false;
  card.style.setProperty('--c', t.color);
  $('ins-nome').textContent = t.nome;
  $('ins-cat').textContent = t.cat;
  $('ins-efeito').textContent = t.efeito;
  const cur = t.attr ? hud.stages[t.attr] : null;
  $('ins-estado').textContent = t.attr ? `Estágio demonstrativo atual: ${cur}/${MAX_STAGE} (${stageText(t.attr, cur)})` : 'Não é atributo evolutivo: não aparece no HUD de estágios.';
  label.hidden = false; label.textContent = t.nome; label.style.setProperty('--c', t.color);
  const p = item.slot.position.clone();
  flyTo([p.x + (camera.position.x - p.x) * .0 + 0, 2.4, p.z + 4.6], [p.x, HOVER[state.items], p.z], .6);
}
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast.h); toast.h = setTimeout(() => { t.hidden = true; }, 3600);
}
function collectDemo(item) {
  if (!item) return;
  const t = item.type, pos = item.slot.position.clone(); pos.y += HOVER[state.items];
  fx.burst(pos, t.color, state.items);
  if (t.attr) {
    const s = hud.stages[t.attr];
    if (s >= MAX_STAGE) toast(`DEMONSTRAÇÃO · ${ATTR_BY_KEY[t.attr].label} já está no estágio 4. No jogo, esse item viraria cura (R5.10) — não simulado aqui.`);
    else { setStage(t.attr, s + 1); toast(`DEMONSTRAÇÃO · ${ATTR_BY_KEY[t.attr].label}: estágio ${s + 1}/4 (${stageText(t.attr, s + 1)}). Não é a mecânica oficial de coleta.`); }
  } else {
    toast(`DEMONSTRAÇÃO · ${t.efeito} HP e stamina atuais não fazem parte deste HUD.`);
  }
  select(item);
}

// ---------- estágios ----------
const rows = {};
function setStage(key, n) {
  hud.setStage(key, n);
  const r = rows[key]; if (r) { r.val.textContent = `${hud.stages[key]}/${MAX_STAGE}`; r.bonus.textContent = stageText(key, hud.stages[key]); }
  if (state.selected) select(state.selected);
}
function buildAttrRows() {
  const host = $('attr-rows');
  host.innerHTML = '';
  for (const a of ATTRS) {
    const row = document.createElement('div');
    row.className = 'arow'; row.style.setProperty('--c', a.color);
    row.innerHTML = `<span class="aname" title="${a.per} (limite ${a.cap})">${a.label}</span>
      <button data-act="dec" aria-label="Diminuir ${a.label}">−</button><b class="aval">0/4</b><button data-act="inc" aria-label="Aumentar ${a.label}">+</button>
      <span class="abonus">+0%</span>`;
    host.appendChild(row);
    rows[a.key] = {val: row.querySelector('.aval'), bonus: row.querySelector('.abonus')};
    row.querySelector('[data-act=dec]').onclick = () => setStage(a.key, hud.stages[a.key] - 1);
    row.querySelector('[data-act=inc]').onclick = () => setStage(a.key, hud.stages[a.key] + 1);
    setStage(a.key, 0);
  }
}
function buildChips() {
  const host = $('chips');
  for (const t of ITEM_TYPES) {
    const b = document.createElement('button');
    b.className = 'chip-item'; b.dataset.item = t.id; b.style.setProperty('--c', t.color);
    b.innerHTML = `<i></i>${t.nome}`;
    b.onclick = () => select(field.items.find(it => it.type.id === t.id));
    host.appendChild(b);
  }
}

// ---------- interface ----------
function bindUi() {
  document.querySelectorAll('[data-hud-btn]').forEach(b => b.onclick = () => setHud(b.dataset.hudBtn));
  document.querySelectorAll('[data-items-btn]').forEach(b => b.onclick = () => setItems(b.dataset.itemsBtn));
  document.querySelectorAll('[data-cam]').forEach(b => b.onclick = () => setCameraPreset(b.dataset.cam));
  $('btn-panel').onclick = () => toggleDrawer();
  $('btn-hidehud').onclick = () => toggleHud();
  $('chk-hud').onchange = e => { hud.setVisible(e.target.checked); syncHudBtn(); };
  $('hud-scale').oninput = e => { state.hudUser = +e.target.value / 100; $('hud-scale-v').textContent = `${e.target.value}%`; applyHudScale(); };
  $('btn-zero').onclick = () => hudAll(0);
  $('btn-max').onclick = () => hudAll(MAX_STAGE);
  $('layout').onchange = e => setLayout(e.target.value);
  $('chk-ind').onchange = e => { field.showIndicators = e.target.checked; };
  $('ind-size').oninput = e => { field.indicatorSize = +e.target.value / 100; $('ind-size-v').textContent = `${e.target.value}%`; };
  $('chk-anim').onchange = e => { field.animate = e.target.checked; };
  $('chk-part').onchange = e => { state.particles = e.target.checked; refreshFx(); };
  $('btn-collect').onclick = () => collectDemo(state.selected);
  $('btn-clear').onclick = () => select(null);
  addEventListener('keydown', e => {
    if (e.target.matches?.('input[type=text],select')) return;
    const k = e.key.toLowerCase();
    if (k === '1' || k === '2' || k === '3') setHud('ABC'[+k - 1]);
    else if (k === '4' || k === '5' || k === '6') setItems('ABC'[+k - 4]);
    else if (k === 'h') toggleHud();
    else if (k === 'p') toggleDrawer();
    else if (k === 'r') setCameraPreset(state.layout === 'vitrine' ? 'vitrine' : 'inicial');
    else if (k === 'escape') select(null);
  });
  // seleção por clique (sem arrastar)
  let down = null;
  canvas.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; });
  canvas.addEventListener('pointerup', e => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
    const r = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster(); ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(field.pickables(), false)[0];
    select(hit ? hit.object.userData.item : null);
  });
}
function hudAll(n) { hud.setAll(n); for (const a of ATTRS) setStage(a.key, n); }
function toggleDrawer(force) {
  const d = $('drawer'); const open = force ?? d.hidden;
  d.hidden = !open; $('app').style.setProperty('--drawer', open ? '320px' : '0px');
  $('btn-panel').classList.toggle('on', open);
}
function syncHudBtn() { $('btn-hidehud').textContent = hud.visible ? 'Ocultar HUD' : 'Mostrar HUD'; $('chk-hud').checked = hud.visible; }
function toggleHud() { hud.setVisible(!hud.visible); syncHudBtn(); }

// ---------- laço ----------
function resize() {
  const w = $('stage').clientWidth, h = $('stage').clientHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  applyHudScale();
}
let last = performance.now(), frames = 0;
function frame() {
  const now = performance.now(), dt = Math.min((now - last) / 1000, .05); last = now;
  if (tween.active) {
    tween.t += dt / tween.dur;
    const k = Math.min(1, tween.t), e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    camera.position.lerpVectors(tween.fp, tween.tp, e); controls.target.lerpVectors(tween.ft, tween.tt, e);
    if (k >= 1) tween.active = false;
  }
  controls.update();
  field.update(dt, camera);
  fx.update(dt);
  hud.tick(dt);
  if (state.selected && !label.hidden) {
    const p = state.selected.slot.position.clone(); p.y = .05;
    p.project(camera);
    const w = $('stage').clientWidth, h = $('stage').clientHeight;
    label.style.transform = `translate(${(p.x * .5 + .5) * w}px, ${(-p.y * .5 + .5) * h + 16}px) translate(-50%, 0)`;
  }
  renderer.render(scene, camera);
  frames++;
  requestAnimationFrame(frame);
}

// ---------- início ----------
buildAttrRows(); buildChips(); bindUi();
field.setPositions(LAYOUTS.arena, true);
setHud('A'); setItems('A'); syncHudBtn();
setCameraPreset('inicial', true);
new ResizeObserver(resize).observe($('stage'));
resize();
requestAnimationFrame(frame);
setTimeout(() => { $('hint').classList.add('fade'); }, 12000);

// API de verificação/depuração (somente leitura do estado visual; não toca regras de jogo)
window.__ARENAMON_HUD_CONSUMIVEIS__ = {
  state, hud, field, fx, camera, controls, renderer, scene,
  setHud, setItems, setStage, hudAll, setLayout, select, collectDemo, setCameraPreset, toggleHud, toggleDrawer,
  get errors() { return errors; },
  get frames() { return frames; },
  info() {
    const r = renderer.info;
    return {frames, drawCalls: r.render.calls, triangles: r.render.triangles, geometries: r.memory.geometries, particlesLive: fx.count,
      visibleItems: field.items.filter(i => i.styles[state.items].holder.visible).length, style: state.items, hud: state.hud, stages: {...hud.stages}};
  },
  itemMeshCounts() {
    return Object.fromEntries(['A', 'B', 'C'].map(s => [s, field.items.map(it => { let n = 0; it.styles[s].holder.traverse(o => { if (o.isMesh) n++; }); return n; })]));
  },
};
