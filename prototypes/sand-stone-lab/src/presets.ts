import {categories, controls, defaults, type Category, type Variant, type Values} from './config.ts';

export const SCHEMA_VERSION=1;
export const ATELIER_VERSION='7.0.0';
const ACCEPTED_VERSIONS=['3.0.0','5.0.0','6.0.0',ATELIER_VERSION];
export type Presets=Record<Category, Record<'A'|'B'|'C', Record<string, number>>>;
export type Presentation={bloom:number;exposure:number;shake:number;rate:number;reduce:boolean;loop:boolean;model:'match'|'0'|'1'|'2';previewCount:number;camera:'three'|'low'|'top';wire:boolean;grid:boolean;noFlash:boolean};
export function initialPresets():Presets{return Object.fromEntries(categories.map(c=>[c,Object.fromEntries(['A','B','C'].map(v=>[v,{...defaults[c]}]))])) as Presets;}
const letters=['A','B','C'] as const;
const keys=<T extends object>(obj:T)=>Object.keys(obj);
export type ImportStats={ignored:number;filled:number};
const newStats=():ImportStats=>({ignored:0,filled:0});
function asObject(obj:unknown,label:string){if(!obj||typeof obj!=='object'||Array.isArray(obj))throw Error(`${label}: objeto esperado`);return obj as Record<string,unknown>;}
/** Campos fora da lista são IGNORADOS e CONTADOS (docs/PADRAO_ATELIES_VFX.md §4); campo obrigatório ausente continua recusando o arquivo. */
function pick(obj:unknown,expected:string[],label:string,stats:ImportStats,required:string[]=expected){const o=asObject(obj,label);for(const key of keys(o))if(!expected.includes(key))stats.ignored++;for(const key of required)if(!(key in o))throw Error(`${label}: falta “${key}”`);return o;}
function validateParams(category:Category,input:unknown,stats:ImportStats){
  const map=asObject(input,'Controles'),known=controls[category].map(d=>d[0]),out:Record<string,number>={};
  for(const key of keys(map))if(!known.includes(key))stats.ignored++;
  for(const [key,,unit,min,max] of controls[category]){
    if(!(key in map)){out[key]=defaults[category][key];stats.filled++;continue;}
    const value=map[key];
    if(key==='scenario'&&!Number.isInteger(value))throw Error('Cenário inválido');
    if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw Error(`${key}: número entre ${min} e ${max} ${unit} esperado`);
    out[key]=value;
  }
  return out;
}
function validatePresentation(input:unknown,stats:ImportStats):Presentation{
  const p=pick(input,['bloom','exposure','shake','rate','reduce','loop','model','previewCount','camera','wire','grid','noFlash'],'Apresentação',stats,['bloom','exposure','shake','rate','reduce','loop','model','previewCount','camera','wire','grid']);
  for(const [key,min,max] of [['bloom',0,1.2],['exposure',.6,1.8],['shake',0,1],['rate',.2,1.5]] as const){if(typeof p[key]!=='number'||!Number.isFinite(p[key])||p[key]<min||p[key]>max)throw Error(`Apresentação: ${key} fora da faixa`);}
  if(typeof p.reduce!=='boolean'||typeof p.loop!=='boolean'||typeof p.wire!=='boolean'||typeof p.grid!=='boolean')throw Error('Apresentação: flags inválidas');
  if(p.noFlash===undefined){p.noFlash=false;stats.filled++;}else if(typeof p.noFlash!=='boolean')throw Error('Apresentação: flags inválidas');
  if(!['match','0','1','2'].includes(p.model as string)||!['three','low','top'].includes(p.camera as string)||!Number.isInteger(p.previewCount)||Number(p.previewCount)<3||Number(p.previewCount)>8)throw Error('Apresentação: seleção inválida');
  return p as Presentation;
}
export function exportSingle(presets:Presets,category:Category,variant:Variant,presentation:Presentation){const letter=letters[variant];return {schemaVersion:SCHEMA_VERSION,atelier:'arenamon-vfx',atelierVersion:ATELIER_VERSION,exportScope:'single-variant',category,variant:letter,presetName:`${category} ${letter} - estudo visual`,visualParameters:presets[category][letter],presentation,assets:{embedded:true,externalUrls:[]}};}
export function exportAll(presets:Presets,presentation:Presentation){return {schemaVersion:SCHEMA_VERSION,atelier:'arenamon-vfx',atelierVersion:ATELIER_VERSION,exportScope:'all-variants',presets,presentation,assets:{embedded:true,externalUrls:[]}};}
export function parsePreset(raw:string){
 if(new TextEncoder().encode(raw).length>512000)throw Error('Arquivo acima de 500 KB');let value:unknown;try{value=JSON.parse(raw);}catch{throw Error('JSON inválido');}
 const stats=newStats(),scope=(value as any)?.exportScope;
 const head=pick(value,['schemaVersion','atelier','atelierVersion','exportScope','presentation','assets',...(scope==='single-variant'?['category','variant','presetName','visualParameters']:['presets'])],'Arquivo',stats);
 if(head.schemaVersion!==SCHEMA_VERSION||head.atelier!=='arenamon-vfx'||!ACCEPTED_VERSIONS.includes(head.atelierVersion as string))throw Error('Versão ou atelier incompatível');
 const assets=pick(head.assets,['embedded','externalUrls'],'Recursos',stats);if(assets.embedded!==true||!Array.isArray(assets.externalUrls)||assets.externalUrls.length)throw Error('Recursos externos não são aceitos');
 const presentation=validatePresentation(head.presentation,stats);
 if(head.exportScope==='single-variant'){
  if(!categories.includes(head.category as Category)||!letters.includes(head.variant as any))throw Error('Categoria ou alternativa inválida');
  if(typeof head.presetName!=='string'||head.presetName.length>120)throw Error('Nome de preset inválido');
  const category=head.category as Category,variant=head.variant as 'A'|'B'|'C';return {scope:'single' as const,category,variant,values:validateParams(category,head.visualParameters,stats),presentation,...stats};
 }
 if(head.exportScope!=='all-variants')throw Error('Escopo desconhecido');
 const sourceCategories=head.atelierVersion==='3.0.0'?categories.filter(c=>!['bulletpunch','quickattack','riposte'].includes(c)):head.atelierVersion==='5.0.0'?categories.filter(c=>c!=='riposte'):categories;
 const all=pick(head.presets,sourceCategories,'Presets',stats);const presets=initialPresets();
 for(const c of sourceCategories){const variants=pick(all[c],['A','B','C'],`Categoria ${c}`,stats);for(const v of letters)presets[c][v]=validateParams(c,variants[v],stats);}
 return {scope:'all' as const,presets,presentation,...stats};
}
/** Nome do arquivo exportado: leva a data (AAAA-MM-DD). */
export function exportFileName(what:{scope:'single';category:Category;variant:number}|{scope:'all'},date:string){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('A data do nome do arquivo precisa ser AAAA-MM-DD');
 return what.scope==='single'?`arenamon-${what.category}-${letters[what.variant]}-${date}.json`:`arenamon-vfx-todas-${date}.json`;
}
/** Salvamento automático no navegador: tudo (valores de todas as propostas, seleção e preferências de tela). */
export function serializeLocal(state:{presets:Presets;category:Category;variant:number;model:string;presentation:Presentation}){
 return {schemaVersion:SCHEMA_VERSION,atelier:'arenamon-vfx',atelierVersion:ATELIER_VERSION,savedAt:new Date().toISOString(),presets:state.presets,category:state.category,variant:state.variant,model:state.model,presentation:state.presentation};
}
/** Lê o que o salvamento automático guardou (também o formato anterior, v3). null = nada utilizável. */
export function restoreLocal(data:any){
 if(!data||typeof data!=='object'||!data.presets&&!data.values)return null;
 const category=categories.includes(data.category)?data.category as Category:'sand';
 const variant=Number.isInteger(data.variant)?Math.min(2,Math.max(0,data.variant)):0;
 const model=['match','0','1','2'].includes(data.model)?data.model as string:'match';
 let presentation:Presentation|null=null;try{presentation=validatePresentation(data.presentation,newStats());}catch{presentation=null;}
 return {presets:migrateLocal(data),category,variant,model,presentation};
}
export function migrateLocal(data:any){const presets=initialPresets();for(const c of categories){for(const v of letters){const source=data?.presets?.[c]?.[v]??data?.values?.[c];if(!source)continue;for(const [key,,,min,max] of controls[c]){const n=source[key];if(typeof n==='number'&&Number.isFinite(n))presets[c][v][key]=Math.min(max,Math.max(min,n));}}}return presets;}
