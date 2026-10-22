import {categories, controls, defaults, type Category, type Variant, type Values} from './config.ts';

export const SCHEMA_VERSION=1;
export const ATELIER_VERSION='5.0.0';
export type Presets=Record<Category, Record<'A'|'B'|'C', Record<string, number>>>;
export type Presentation={bloom:number;exposure:number;shake:number;rate:number;reduce:boolean;loop:boolean;model:'match'|'0'|'1'|'2';previewCount:number;camera:'three'|'low'|'top';wire:boolean;grid:boolean};
export function initialPresets():Presets{return Object.fromEntries(categories.map(c=>[c,Object.fromEntries(['A','B','C'].map(v=>[v,{...defaults[c]}]))])) as Presets;}
const letters=['A','B','C'] as const;
const keys=<T extends object>(obj:T)=>Object.keys(obj);
function exact(obj:unknown,expected:string[],label:string){if(!obj||typeof obj!=='object'||Array.isArray(obj))throw Error(`${label}: objeto esperado`);for(const key of keys(obj))if(!expected.includes(key))throw Error(`${label}: campo desconhecido “${key}”`);for(const key of expected)if(!(key in obj))throw Error(`${label}: falta “${key}”`);return obj as Record<string,unknown>;}
function validateParams(category:Category,input:unknown){const map=exact(input,controls[category].map(d=>d[0]),'Controles');for(const [key,,unit,min,max] of controls[category]){const value=map[key];if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw Error(`${key}: número entre ${min} e ${max} ${unit} esperado`);}return map as Record<string,number>;}
function validatePresentation(input:unknown):Presentation{const p=exact(input,['bloom','exposure','shake','rate','reduce','loop','model','previewCount','camera','wire','grid'],'Apresentação');for(const [key,min,max] of [['bloom',0,1.2],['exposure',.6,1.8],['shake',0,1],['rate',.2,1.5]] as const){if(typeof p[key]!=='number'||!Number.isFinite(p[key])||p[key]<min||p[key]>max)throw Error(`Apresentação: ${key} fora da faixa`);}if(typeof p.reduce!=='boolean'||typeof p.loop!=='boolean'||typeof p.wire!=='boolean'||typeof p.grid!=='boolean')throw Error('Apresentação: flags inválidas');if(!['match','0','1','2'].includes(p.model as string)||!['three','low','top'].includes(p.camera as string)||!Number.isInteger(p.previewCount)||Number(p.previewCount)<3||Number(p.previewCount)>8)throw Error('Apresentação: seleção inválida');return p as Presentation;}
export function exportSingle(presets:Presets,category:Category,variant:Variant,presentation:Presentation){const letter=letters[variant];return {schemaVersion:SCHEMA_VERSION,atelier:'arenamon-vfx',atelierVersion:ATELIER_VERSION,exportScope:'single-variant',category,variant:letter,presetName:`${category} ${letter} - estudo visual`,visualParameters:presets[category][letter],presentation,assets:{embedded:true,externalUrls:[]}};}
export function exportAll(presets:Presets,presentation:Presentation){return {schemaVersion:SCHEMA_VERSION,atelier:'arenamon-vfx',atelierVersion:ATELIER_VERSION,exportScope:'all-variants',presets,presentation,assets:{embedded:true,externalUrls:[]}};}
export function parsePreset(raw:string){if(new TextEncoder().encode(raw).length>512000)throw Error('Arquivo acima de 500 KB');let value:unknown;try{value=JSON.parse(raw);}catch{throw Error('JSON inválido');}
 const head=exact(value,['schemaVersion','atelier','atelierVersion','exportScope','presentation','assets',...((value as any)?.exportScope==='single-variant'?['category','variant','presetName','visualParameters']:['presets'])],'Arquivo');
 if(head.schemaVersion!==SCHEMA_VERSION||head.atelier!=='arenamon-vfx'||!['3.0.0',ATELIER_VERSION].includes(head.atelierVersion as string))throw Error('Versão ou atelier incompatível');
 const assets=exact(head.assets,['embedded','externalUrls'],'Recursos');if(assets.embedded!==true||!Array.isArray(assets.externalUrls)||assets.externalUrls.length)throw Error('Recursos externos não são aceitos');
 const presentation=validatePresentation(head.presentation);
 if(head.exportScope==='single-variant'){
  if(!categories.includes(head.category as Category)||!letters.includes(head.variant as any))throw Error('Categoria ou alternativa inválida');
  if(typeof head.presetName!=='string'||head.presetName.length>120)throw Error('Nome de preset inválido');
  const category=head.category as Category,variant=head.variant as 'A'|'B'|'C';return {scope:'single' as const,category,variant,values:validateParams(category,head.visualParameters),presentation};
 }
 if(head.exportScope!=='all-variants')throw Error('Escopo desconhecido');
 const sourceCategories=head.atelierVersion==='3.0.0'?categories.filter(c=>c!=='bulletpunch'&&c!=='quickattack'):categories;
 const all=exact(head.presets,sourceCategories,'Presets');const presets=initialPresets();for(const c of sourceCategories){const variants=exact(all[c],['A','B','C'],`Categoria ${c}`);for(const v of letters)presets[c][v]=validateParams(c,variants[v]);}
 return {scope:'all' as const,presets,presentation};
}
export function migrateLocal(data:any){const presets=initialPresets();for(const c of categories){for(const v of letters){const source=data?.presets?.[c]?.[v]??data?.values?.[c];if(!source)continue;for(const [key,,,min,max] of controls[c]){const n=source[key];if(typeof n==='number'&&Number.isFinite(n))presets[c][v][key]=Math.min(max,Math.max(min,n));}}}return presets;}
