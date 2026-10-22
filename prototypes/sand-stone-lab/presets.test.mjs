import assert from 'node:assert/strict';
import {initialPresets,exportSingle,exportAll,parsePreset,migrateLocal} from './src/presets.ts';
const p={bloom:.48,exposure:1.1,shake:.35,rate:.7,reduce:false,loop:true,model:'match',previewCount:5,camera:'three',wire:false,grid:false};
const presets=initialPresets();presets.swift.B.starScale=1.35;presets.rock.C.rotation=47;
const one=exportSingle(presets,'swift',1,p),parsed=parsePreset(JSON.stringify(one));
assert.equal(parsed.scope,'single');assert.equal(parsed.values.starScale,1.35);
const all=parsePreset(JSON.stringify(exportAll(presets,p)));assert.equal(all.scope,'all');assert.equal(all.presets.rock.C.rotation,47);
for(const mutation of [
  v=>{v.schemaVersion=99},v=>{v.visualParameters.starScale=100},v=>{v.visualParameters.unknown=1},v=>{v.assets.externalUrls=['https://example.com']},v=>{v.presentation.bloom='x'}
]){const bad=structuredClone(one);mutation(bad);assert.throws(()=>parsePreset(JSON.stringify(bad)));}
assert.throws(()=>parsePreset('{'));
assert.equal(migrateLocal({values:{sand:{length:5}}}).sand.C.length,5);
console.log('PASS: JSON individual/todas, round-trip, rejeições e migração local v2');
