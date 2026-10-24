// A fase «Permanência» passou de `sustain` para `hold`: presets e salvamentos antigos (sustainOn) continuam valendo.
import assert from 'node:assert/strict';
import {defaults, phases} from './src/config.ts';
import {restoreLocal, parsePreset, exportSingle, initialPresets} from './src/presets.ts';

assert.ok(phases.includes('hold') && !phases.includes('sustain'));
assert.equal(defaults.sand.holdOn, 1);assert.equal(defaults.sand.sustainOn, undefined);
const old = {schemaVersion: 1, presets: {sand: {A: {...defaults.sand, sustainOn: 0}}}, category: 'sand', variant: 0};
delete old.presets.sand.A.holdOn;
assert.equal(restoreLocal(old).presets.sand.A.holdOn, 0, 'salvamento automático antigo migra');
const file = JSON.parse(JSON.stringify(exportSingle(initialPresets(), 'sand', 0, {bloom:.48,exposure:1.1,shake:.35,rate:.7,reduce:false,loop:true,model:'match',previewCount:5,camera:'three',wire:false,grid:false,noFlash:false})));
const vp = file.visualParameters;vp.sustainOn = 0;delete vp.holdOn;
assert.equal(parsePreset(JSON.stringify(file)).values.holdOn, 0, 'arquivo exportado antes migra');
console.log('PASS: migração sustain → hold');
