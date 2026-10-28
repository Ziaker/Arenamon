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
