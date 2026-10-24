import assert from 'node:assert/strict';
import {initialPresets,exportSingle,exportAll,parsePreset,migrateLocal,exportFileName,serializeLocal,restoreLocal,ATELIER_VERSION} from './src/presets.ts';
const p={bloom:.48,exposure:1.1,shake:.35,rate:.7,reduce:false,loop:true,model:'match',previewCount:5,camera:'three',wire:false,grid:false,noFlash:false};
const presets=initialPresets();presets.swift.B.starScale=1.35;presets.rock.C.rotation=47;
const one=exportSingle(presets,'swift',1,p),parsed=parsePreset(JSON.stringify(one));
assert.equal(parsed.scope,'single');assert.equal(parsed.values.starScale,1.35);
const all=parsePreset(JSON.stringify(exportAll(presets,p)));assert.equal(all.scope,'all');assert.equal(all.presets.rock.C.rotation,47);
for(const mutation of [
  v=>{v.schemaVersion=99},v=>{v.visualParameters.starScale=100},v=>{v.assets.externalUrls=['https://example.com']},v=>{v.presentation.bloom='x'}
]){const bad=structuredClone(one);mutation(bad);assert.throws(()=>parsePreset(JSON.stringify(bad)));}
assert.throws(()=>parsePreset('{'));
assert.equal(migrateLocal({values:{sand:{length:5}}}).sand.C.length,5);
for(const c of ['bulletpunch','quickattack'])for(let v=0;v<3;v++){const x=parsePreset(JSON.stringify(exportSingle(presets,c,v,p)));assert.equal(x.category,c);assert.equal(x.values.travelTime,presets[c]['ABC'[v]].travelTime);}
const old=exportAll(presets,p);old.atelierVersion='3.0.0';old.presets=structuredClone(presets);delete old.presets.bulletpunch;delete old.presets.quickattack;delete old.presets.riposte;
const migrated=parsePreset(JSON.stringify(old));assert.equal(migrated.presets.swift.B.starScale,1.35);assert.ok(migrated.presets.bulletpunch.A.travelTime>0);assert.ok(migrated.presets.quickattack.C.travelTime>0);
const old5=exportAll(structuredClone(presets),p);old5.atelierVersion='5.0.0';delete old5.presets.riposte;assert.ok(parsePreset(JSON.stringify(old5)).presets.riposte.A.guardSize>0);
for(let v=0;v<3;v++){const single=parsePreset(JSON.stringify(exportSingle(presets,'riposte',v,p)));assert.equal(single.values.scenario,0);}

// Importação tolerante (docs/PADRAO_ATELIES_VFX.md §4): campo desconhecido é IGNORADO e CONTADO; controle ausente é completado com o padrão e contado
const extra=structuredClone(one);extra.visualParameters.unknown=1;extra.visualParameters.outro=2;extra.campoNovo=true;
const tolerant=parsePreset(JSON.stringify(extra));assert.equal(tolerant.scope,'single');assert.equal(tolerant.ignored,3,'2 parâmetros + 1 campo do arquivo');assert.equal(tolerant.values.starScale,1.35);assert.equal('unknown' in tolerant.values,false);
const missing=structuredClone(one);delete missing.visualParameters.startOn;delete missing.visualParameters.shotKind;
const filled=parsePreset(JSON.stringify(missing));assert.equal(filled.filled,2);assert.equal(filled.values.startOn,1);assert.equal(filled.values.shotKind,0);assert.equal(filled.ignored,0);
assert.equal(parsePreset(JSON.stringify(one)).ignored,0);
const v6=structuredClone(one);v6.atelierVersion='6.0.0';assert.equal(parsePreset(JSON.stringify(v6)).scope,'single','arquivos da versão 6.0.0 continuam entrando');
assert.equal(ATELIER_VERSION,'7.0.0');
for(const mutation of [v=>{v.visualParameters.starScale='x'},v=>{v.visualParameters.shotKind=9},v=>{v.assets.embedded=false},v=>{v.atelier='outro'},v=>{v.exportScope='todos'}]){const bad=structuredClone(one);mutation(bad);assert.throws(()=>parsePreset(JSON.stringify(bad)));}
// nome do arquivo exportado leva a data
assert.equal(exportFileName({scope:'single',category:'swift',variant:1},'2026-10-24'),'arenamon-swift-B-2026-10-24.json');
assert.equal(exportFileName({scope:'all'},'2026-10-24'),'arenamon-vfx-todas-2026-10-24.json');
assert.throws(()=>exportFileName({scope:'all'},'24/10/2026'),/data/i);
// salvamento automático: ida e volta com seleção, apresentação e interruptores das fases
const saved=initialPresets();saved.sand.B.startOn=0;saved.sand.B.shotKind=2;saved.sand.B.shotCount=77;
const local=serializeLocal({presets:saved,category:'sand',variant:1,model:'2',presentation:{...p,reduce:true,noFlash:true}});
const back=restoreLocal(JSON.parse(JSON.stringify(local)));
assert.equal(back.category,'sand');assert.equal(back.variant,1);assert.equal(back.model,'2');assert.equal(back.presets.sand.B.startOn,0);assert.equal(back.presets.sand.B.shotKind,2);assert.equal(back.presets.sand.B.shotCount,77);assert.equal(back.presentation.reduce,true);assert.equal(back.presentation.noFlash,true);
assert.equal(restoreLocal(null),null);assert.equal(restoreLocal({lixo:1}),null,'dado sem formato conhecido é descartado');
const legacy=restoreLocal({presets:{sand:{C:{length:5}}},category:'sand',variant:2,model:'match'});assert.equal(legacy.presets.sand.C.length,5,'formato anterior (v3) continua restaurando');
console.log('PASS: JSON individual/todas, round-trip, rejeições, importação tolerante, nome datado e salvamento automático');
