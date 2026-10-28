import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {build} from 'esbuild';

const root = new URL('../', import.meta.url);
await mkdir(new URL('validation/', root), {recursive: true});
await build({entryPoints: [fileURLToPath(new URL('src/index.ts', root))], bundle: true, platform: 'node', format: 'esm', outfile: fileURLToPath(new URL('validation/visual-overhaul.mjs', root))});
const api = await import(new URL('validation/visual-overhaul.mjs', root));

const memoryStorage = (seed = {}) => {
  const values = new Map(Object.entries(seed));
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
    value: key => values.get(key),
  };
};

test('defaults UI preferences without mutating a VfxProject', () => {
  const storage = memoryStorage();
  const preferences = api.loadUiPreferences(storage);
  assert.equal(preferences.density, 'reference-80');
  assert.equal(preferences.workspace, 'modeling');
  assert.equal(preferences.academy.open, false);
  assert.equal(preferences.viewportMaximized, false);
  api.saveUiPreferences(storage, preferences);
  const saved = storage.value('arenamon.vfx.ui.v1');
  assert.ok(saved);
  assert.equal(/projectId|effectId|phases|nodes/.test(saved), false);
});

test('migrates malformed or old UI preference records safely', () => {
  const storage = memoryStorage({'arenamon.vfx.ui.v1': JSON.stringify({version: 0, density: 'tiny', paneSizes: {hierarchy: -40, inspector: 9000, timeline: 2}})});
  const preferences = api.loadUiPreferences(storage);
  assert.equal(preferences.density, 'reference-80');
  assert.equal(preferences.paneSizes.hierarchy, 180);
  assert.equal(preferences.paneSizes.inspector, 520);
  assert.equal(preferences.paneSizes.timeline, 96);
  assert.deepEqual(preferences.collapsedPanes, []);
});

test('continues in memory when storage throws', () => {
  const broken = {getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() { throw new Error('denied'); }};
  assert.doesNotThrow(() => api.loadUiPreferences(broken));
  assert.doesNotThrow(() => api.saveUiPreferences(broken, api.DEFAULT_UI_PREFERENCES));
});

test('renders every icon with title and aria-label', () => {
  const names = ['project', 'undo', 'redo', 'play', 'stop', 'export', 'create', 'transform', 'appearance', 'movement', 'particles', 'output', 'settings', 'help', 'visibility', 'lock', 'search', 'frame', 'onion', 'keyframe', 'stroke', 'ribbon', 'emitter'];
  assert.deepEqual([...api.ICON_NAMES], names);
  for (const name of names) {
    const svg = api.icon(name, {label: `Icon ${name}`});
    assert.match(svg, /^<svg/);
    assert.match(svg, /<title>Icon /);
    assert.doesNotMatch(svg, /https?:\/\//);
    assert.doesNotMatch(svg, /[\u{1F300}-\u{1FAFF}]/u);
    const button = api.iconButton({name, label: `Action ${name}`});
    assert.match(button, /aria-label="Action /);
    assert.match(button, /title="Action /);
  }
});

test('workspace presets clamp panes and reference density without CSS zoom', () => {
  assert.deepEqual(api.clampPaneSizes({hierarchy: 20, inspector: 999, timeline: 40}), {hierarchy: 180, inspector: 520, timeline: 96});
  assert.deepEqual(api.workspacePreset('animation').collapsedPanes, []);
  assert.equal(api.workspacePreset('animation').paneSizes.timeline, 300);
  assert.equal(api.workspacePreset('materials').paneSizes.inspector, 440);
  assert.equal(api.DENSITY_TOKENS['reference-80'].scale, 1.25);
  assert.equal(api.DENSITY_TOKENS['reference-80'].usesCssZoom, false);
});

test('command registry searches labels and explains unavailable actions', () => {
  const registry = new api.CommandRegistry([
    {id: 'frame', label: 'Enquadrar seleção', icon: 'frame', isAvailable: context => Boolean(context.selectedId), unavailableReason: () => 'Selecione um objeto', execute: () => {}},
    {id: 'keyframe', label: 'Adicionar keyframe', icon: 'keyframe', isAvailable: () => true, execute: () => {}},
  ]);
  assert.deepEqual(registry.search('enquadrar', {selectedId: null}).map(result => [result.command.id, result.available, result.reason]), [['frame', false, 'Selecione um objeto']]);
  assert.deepEqual(registry.search('key', {}).map(result => result.command.id), ['keyframe']);
});

test('inspector groups follow object type and never retain stale fields', () => {
  assert.deepEqual(api.inspectorGroupsForNode({kind: 'mesh'}), ['transform', 'appearance', 'geometry', 'animation']);
  assert.deepEqual(api.inspectorGroupsForNode({kind: 'stroke'}), ['transform', 'appearance', 'drawing', 'animation']);
  assert.deepEqual(api.inspectorGroupsForNode({kind: 'particles'}), ['transform', 'particles', 'budget']);
  assert.deepEqual(api.inspectorGroupsForNode(null), []);
});

test('timeline groups existing tracks and exposes semantic visual markers', () => {
  const tracks = [
    {id: 'move-x', targetId: 'orb', property: 'position.x', keyframes: [{time: 0, value: 0, interpolation: 'linear'}, {time: .8, value: 4, interpolation: 'bezier'}]},
    {id: 'fade', targetId: 'orb', property: 'opacity', keyframes: [{time: .8, value: 1, interpolation: 'linear'}, {time: 1.2, value: 0, interpolation: 'linear'}]},
    {id: 'spin', targetId: 'ring', property: 'rotation.z', keyframes: [{time: 0, value: 0, interpolation: 'linear'}]},
  ];
  const view = api.timelineViewModel(tracks, {duration: 1.4, zoom: 99, selectedKeyframes: ['move-x@0'], markers: [{id: 'contact', time: .8, label: 'Contato'}, {id: 'explosion', time: 1.2, label: 'Explosao'}]});
  assert.equal(view.zoom, 4);
  assert.deepEqual(view.groups.map(group => [group.targetId, group.tracks.length]), [['orb', 2], ['ring', 1]]);
  assert.equal(view.groups[0].tracks[0].family, 'transform');
  assert.equal(view.groups[0].tracks[1].family, 'appearance');
  assert.equal(view.groups[0].tracks[0].keyframes[0].selected, true);
  assert.deepEqual(view.markers.map(marker => marker.kind), ['contact', 'explosion']);
  assert.equal(api.clampTimelineZoom(.01), .5);
});

test('status model uses visual thresholds and accessible equivalents', () => {
  const safe = api.statusViewModel({budget: {peak: 120, rawPeak: 160, suppressed: 40, activeEmitters: 2, cost: {particles: 120, lights: 0, drawCalls: 2}, verdict: {ok: true, violations: []}}, recoveryNotice: 'Snapshot recuperado', backend: 'quarks', autosave: 'saved'});
  assert.equal(safe.budget.level, 'safe');
  assert.match(safe.accessibleText, /120 partículas/i);
  assert.match(safe.accessibleText, /Snapshot recuperado/);
  const danger = api.statusViewModel({budget: {peak: 950, rawPeak: 950, suppressed: 0, activeEmitters: 5, cost: {particles: 950, lights: 0, drawCalls: 5}, verdict: {ok: false, violations: ['particles']}}, recoveryNotice: '', backend: 'authoring', autosave: 'pending'});
  assert.equal(danger.budget.level, 'danger');
  assert.equal(danger.autosave, 'pending');
});

test('academy sessions stay outside the project and resume only exact matches', () => {
  const storage = memoryStorage();
  const project = {projectId: 'p1', revision: 4, nodes: []};
  const lesson = {id: 'lesson', title: 'Aula', summary: 'Resumo', steps: [
    {id: 'start', title: 'Comece', instruction: 'Crie algo', validate: current => ({ok: current.nodes.length > 0, message: 'Crie um objeto'})},
    {id: 'finish', title: 'Finalize', instruction: 'Revise', validate: () => ({ok: true, message: 'Pronto'})},
  ]};
  const academy = new api.AcademyController({lessons: [lesson], storage, getProject: () => project, autosaveSlot: 'slot-p1'});
  assert.equal(academy.state.open, false);
  academy.start('lesson');
  assert.equal(academy.state.session.stepId, 'start');
  assert.equal(JSON.stringify(project).includes('lesson'), false);
  assert.equal(academy.validateCurrentStep().ok, false);
  project.nodes.push({id: 'orb'});
  assert.equal(academy.validateCurrentStep().ok, true);
  academy.next(); academy.minimize();
  assert.equal(academy.state.minimized, true);
  const resumed = new api.AcademyController({lessons: [lesson], storage, getProject: () => project, autosaveSlot: 'slot-p1'});
  assert.equal(resumed.resume().status, 'resumed');
  assert.equal(resumed.state.session.stepId, 'finish');
  const stale = new api.AcademyController({lessons: [lesson], storage, getProject: () => ({...project, projectId: 'other'}), autosaveSlot: 'slot-other'});
  assert.equal(stale.resume().status, 'stale');
  assert.deepEqual(stale.recoveryChoices(), ['restart', 'current-project']);
});
