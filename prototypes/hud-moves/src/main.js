// Laboratório visual: HUD de vida, stamina e 4 moves (3 propostas) sobre uma arena 3D de contexto.
// Isolado do jogo: não importa nada de prototypes/combat-lab e não implementa combate, stamina nem cooldown reais.
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {HP_MAX, ST_MAX, MOVE_STATES, HUD_STYLES, ICON_NAMES, MOVE_NAME_SUGGESTIONS, PRESETS, defaultModel, clamp, esc} from './data.js';
import {HudManager, DEMO_CD_SECONDS} from './hud.js';
import {buildArena, THEMES, CAMERA_PRESETS} from './arena.js';

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
const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.5;
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
const controls = new OrbitControls(camera, canvas);
Object.assign(controls, {enableDamping: true, dampingFactor: 0.09, minDistance: 2, maxDistance: 40, maxPolarAngle: Math.PI / 2 - 0.02, screenSpacePanning: false, rotateSpeed: .8});
const arena = buildArena(scene);
const hud = new HudManager($('hud-root'));

// ---------- câmera ----------
const tween = {active: false, t: 0, dur: .7, fp: new THREE.Vector3(), ft: new THREE.Vector3(), tp: new THREE.Vector3(), tt: new THREE.Vector3()};
function setCameraPreset(name, instant = false) {
  const p = CAMERA_PRESETS[name]; if (!p) return;
  if (instant) { camera.position.set(...p.pos); controls.target.set(...p.target); controls.update(); tween.active = false; return; }
  tween.fp.copy(camera.position); tween.ft.copy(controls.target); tween.tp.set(...p.pos); tween.tt.set(...p.target);
  tween.t = 0; tween.active = true;
}

// ---------- estado ----------
let model = defaultModel();
const state = {hud: 'A', scaleUser: 1, animate: false, motion: true, theme: 'escuro', preset: 'neutro'};
const CAM_LABEL = {inicial: 'Inicial', frente: 'Frente', lado: 'Lado', cima: 'Cima', rente: 'Rente ao chão', longe: 'Longe'};

function autoScale() { const h = $('stage').clientHeight; return Math.max(1, Math.sqrt(h / 720)); }
function applyScale() { hud.setScale(+(state.scaleUser * autoScale()).toFixed(3)); }

function setHud(id) {
  if (!HUD_STYLES.some(h => h.id === id)) return;
  state.hud = id; hud.show(id);
  document.querySelectorAll('[data-hud-btn]').forEach(b => b.classList.toggle('on', b.dataset.hudBtn === id));
  const s = HUD_STYLES.find(h => h.id === id);
  $('caption').textContent = `HUD ${id} · ${s.nome} — ${s.desc}`;
  hud.update(model, 0);
}

// ---------- controles ----------
const ui = {vals: {}, moves: []};
function buildValues() {
  const host = $('vals'); host.innerHTML = '';
  const defs = [['p', 'hp', 'HP do jogador', HP_MAX, 1, '', 'ui-p-hp'], ['e', 'hp', 'HP do adversário', HP_MAX, 1, '', 'ui-e-hp'],
    ['p', 'st', 'Stamina do jogador', ST_MAX, .05, ' / 3', 'ui-p-st'], ['e', 'st', 'Stamina do adversário', ST_MAX, .05, ' / 3', 'ui-e-st']];
  for (const [who, key, label, max, step, suf, id] of defs) {
    const row = document.createElement('div'); row.className = 'row';
    row.innerHTML = `<span>${label}</span><input type="range" id="${id}" min="0" max="${max}" step="${step}" value="${max}"><b id="${id}-v"></b>`;
    host.appendChild(row);
    const inp = row.querySelector('input');
    inp.oninput = () => { model[who][key] = +inp.value; syncValues(); update(); };
    ui.vals[id] = {inp, out: row.querySelector('b'), who, key, suf};
  }
  const dl = document.createElement('datalist'); dl.id = 'move-names';
  dl.innerHTML = MOVE_NAME_SUGGESTIONS.map(n => `<option value="${esc(n)}">`).join(''); host.appendChild(dl);
}
function syncValues() {
  for (const v of Object.values(ui.vals)) {
    const val = model[v.who][v.key]; v.inp.value = val;
    v.out.textContent = v.key === 'hp' ? `${Math.round(val)}` : `${(+val).toFixed(2)}${v.suf}`;
  }
}
function buildMoves() {
  const host = $('moves'); host.innerHTML = ''; ui.moves = [];
  for (let i = 0; i < 4; i++) {
    const box = document.createElement('div'); box.className = 'mvbox'; box.dataset.i = i;
    box.innerHTML = `<b>Move ${i + 1}</b>
      <div class="row"><span>Nome</span><input type="text" data-f="name" list="move-names" maxlength="22"></div>
      <div class="row two"><span>Tecla</span><input type="text" data-f="key" maxlength="4"><select data-f="icon" title="Ícone">${ICON_NAMES.map(n => `<option>${n}</option>`).join('')}</select></div>
      <div class="row"><span>Estado</span><select data-f="state">${MOVE_STATES.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></div>
      <div class="row"><span>Recarga restante</span><input type="range" data-f="cd" min="0" max="1" step="0.01"><b data-o="cd"></b></div>
      <div class="row"><span>Carga</span><input type="range" data-f="charge" min="0" max="1" step="0.01"><b data-o="charge"></b></div>
      <div class="row"><span>Custo de stamina</span><input type="range" data-f="cost" min="0" max="3" step="0.25"><b data-o="cost"></b></div>
      <div class="row"><label><input type="checkbox" data-f="selected"> Selecionado / destacado</label></div>`;
    host.appendChild(box);
    const refs = {};
    box.querySelectorAll('[data-f]').forEach(el => {
      refs[el.dataset.f] = el;
      const f = el.dataset.f, num = ['cd', 'charge', 'cost'].includes(f);
      el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input', () => {
        model.moves[i][f] = el.type === 'checkbox' ? el.checked : num ? +el.value : el.value;
        syncMoves(); update();
      });
    });
    refs.out = Object.fromEntries([...box.querySelectorAll('[data-o]')].map(o => [o.dataset.o, o]));
    ui.moves.push(refs);
  }
}
function syncMoves() {
  ui.moves.forEach((r, i) => {
    const m = model.moves[i];
    for (const f of ['name', 'key']) if (document.activeElement !== r[f]) r[f].value = m[f];
    r.icon.value = m.icon; r.state.value = m.state; r.cd.value = m.cd; r.charge.value = m.charge; r.cost.value = m.cost; r.selected.checked = m.selected;
    r.out.cd.textContent = `${Math.round(m.cd * 100)}% · ${(m.cd * DEMO_CD_SECONDS).toFixed(1)}s`;
    r.out.charge.textContent = `${Math.round(m.charge * 100)}%`; r.out.cost.textContent = (+m.cost).toFixed(2);
    r.cd.disabled = m.state !== 'recarga'; r.charge.disabled = m.state !== 'carregando';
  });
}
function update(dt = 0) { hud.update(model, dt); }
function applyPreset(id) {
  const p = PRESETS.find(x => x.id === id); if (!p) return;
  model = p.build(); state.preset = id;
  document.querySelectorAll('[data-preset]').forEach(b => b.classList.toggle('on', b.dataset.preset === id));
  hud.trail = [model.p.hp / HP_MAX, model.e.hp / HP_MAX]; hud.lastHp = [null, null];
  syncValues(); syncMoves(); update();
}
function resetAll() {
  applyPreset('neutro'); state.scaleUser = 1; $('hud-scale').value = 100; $('hud-scale-v').textContent = '100%'; applyScale();
  setAnimate(false); setMotion(true); setTheme('escuro'); hud.setVisible(true); syncHudBtn(); setCameraPreset('inicial'); setHud('A');
}
function setAnimate(on) { state.animate = on; $('btn-anim').classList.toggle('on', on); $('btn-anim').firstChild.textContent = on ? '⏸ Animando' : '▶ Animar'; }
function setMotion(on) { state.motion = on; $('chk-motion').checked = on; }
function setTheme(name) { if (!THEMES[name]) return; state.theme = name; arena.setTheme(name); $('theme').value = name; }
function syncHudBtn() { $('btn-hidehud').textContent = hud.visible ? 'Ocultar HUD' : 'Mostrar HUD'; $('chk-hud').checked = hud.visible; }
function toggleHud() { hud.setVisible(!hud.visible); syncHudBtn(); if (hud.visible) update(); }
function toggleDrawer(force) {
  const d = $('drawer'); const open = force ?? d.hidden;
  d.hidden = !open; $('app').style.setProperty('--drawer', open ? '360px' : '0px');
  $('btn-panel').classList.toggle('on', open);
}

function bindUi() {
  document.querySelectorAll('[data-hud-btn]').forEach(b => b.onclick = () => setHud(b.dataset.hudBtn));
  const pl = $('preset-list'), pb = $('preset-btns');
  PRESETS.forEach((p, i) => {
    for (const host of [pl, pb]) {
      const b = document.createElement('button'); b.dataset.preset = p.id; b.title = `${p.desc} (tecla ${i + 4})`;
      if (host === pb) { b.className = 'seg-btn'; b.innerHTML = `${p.curto}<kbd>${i + 4}</kbd>`; } else b.textContent = p.nome;
      b.onclick = () => applyPreset(p.id); host.appendChild(b);
    }
  });
  const cams = $('cams');
  for (const [k, l] of Object.entries(CAM_LABEL)) { const b = document.createElement('button'); b.dataset.cam = k; b.textContent = l; b.onclick = () => setCameraPreset(k); cams.appendChild(b); }
  $('btn-panel').onclick = () => toggleDrawer();
  $('btn-hidehud').onclick = toggleHud;
  $('btn-anim').onclick = () => setAnimate(!state.animate);
  $('btn-reset').onclick = resetAll;
  $('chk-hud').onchange = e => { hud.setVisible(e.target.checked); syncHudBtn(); if (hud.visible) update(); };
  $('hud-scale').oninput = e => { state.scaleUser = +e.target.value / 100; $('hud-scale-v').textContent = `${e.target.value}%`; applyScale(); };
  $('theme').onchange = e => setTheme(e.target.value);
  $('chk-motion').onchange = e => setMotion(e.target.checked);
  addEventListener('keydown', e => {
    if (e.target.matches?.('input[type=text],select')) return;
    const k = e.key.toLowerCase();
    if (k === '1' || k === '2' || k === '3') setHud('ABC'[+k - 1]);
    else if (k >= '4' && k <= '7') applyPreset(PRESETS[+k - 4].id);
    else if (k === 'h') toggleHud();
    else if (k === 'p') toggleDrawer();
    else if (k === 'n') setAnimate(!state.animate);
    else if (k === 'r') setCameraPreset('inicial');
  });
}

// ---------- laço ----------
function resize() {
  const w = $('stage').clientWidth, h = $('stage').clientHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); applyScale();
}
let last = performance.now(), frames = 0, clock = 0;
function animateMoves(dt) {
  let dirty = false;
  for (const m of model.moves) {
    if (m.state === 'recarga') { m.cd -= dt / DEMO_CD_SECONDS; if (m.cd <= 0) m.cd = 1; dirty = true; }
    else if (m.state === 'carregando') { m.charge += dt / 2.4; if (m.charge >= 1) m.charge = 0; dirty = true; }
  }
  if (dirty) syncMoves();
}
function frame() {
  const now = performance.now(), dt = Math.min((now - last) / 1000, .05); last = now; clock += dt;
  if (tween.active) {
    tween.t += dt / tween.dur; const k = Math.min(1, tween.t), e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    camera.position.lerpVectors(tween.fp, tween.tp, e); controls.target.lerpVectors(tween.ft, tween.tt, e);
    if (k >= 1) tween.active = false;
  }
  if (state.animate) animateMoves(dt);
  controls.update();
  arena.update(clock, state.motion);
  update(dt);
  renderer.render(scene, camera);
  frames++;
  requestAnimationFrame(frame);
}

// ---------- início ----------
buildValues(); buildMoves(); bindUi();
new ResizeObserver(resize).observe($('stage'));
resize();
setCameraPreset('inicial', true);
applyPreset('neutro'); setHud('A'); syncHudBtn();
requestAnimationFrame(frame);
setTimeout(() => $('hint').classList.add('fade'), 12000);

// API de verificação/depuração (mexe só no estado visual demonstrativo)
window.__ARENAMON_HUD_MOVES__ = {
  hud, camera, controls, renderer, scene, arena, state,
  get model() { return model; },
  setHud, applyPreset, resetAll, setAnimate, setTheme, setCameraPreset, toggleHud, toggleDrawer, syncValues, syncMoves, update,
  get errors() { return errors; }, get frames() { return frames; },
  info() { const r = renderer.info; return {frames, drawCalls: r.render.calls, triangles: r.render.triangles, hud: state.hud}; },
};
