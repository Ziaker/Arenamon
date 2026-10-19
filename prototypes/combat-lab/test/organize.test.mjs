// Organização dos parâmetros (visão por mecânica, níveis, valores derivados, etiquetas): funções puras, sem navegador.
import assert from 'node:assert/strict';
import {C, defaults, resetConfig} from '../src/sim/config.js';
import {mechanicsOf, levelOf, levelVisible, derivedText, nestedFrom, allTags, MECHANIC_ORDER} from '../src/ui/organize.js';

resetConfig(defaults());
let n = 0;const ok = l => {n++;console.log('✓', l);};

// Todo parâmetro numérico do config cai em alguma mecânica e tem nível.
const paths = [];
(function walk(o, p) {for (const [k, v] of Object.entries(o)) {const q = p ? p + '.' + k : k;if (typeof v === 'number') paths.push(q);else if (v && typeof v === 'object' && !Array.isArray(v)) walk(v, q);}})(C, '');
for (const p of paths) {assert.ok(mechanicsOf(p).length >= 1, p);assert.ok(['basic', 'advanced', 'technical'].includes(levelOf(p)), p);assert.ok(MECHANIC_ORDER.includes(mechanicsOf(p)[0]), p);}
ok(`${paths.length} parâmetros têm mecânica e nível`);

assert.ok(mechanicsOf('actions.tackle.duration').includes('tackle'));
assert.ok(mechanicsOf('actions.dodge.cost').includes('dodge'));
assert.ok(mechanicsOf('vfx.hit.intensity').includes('tackle'), 'VFX de impacto aparece no Tackle');
assert.ok(mechanicsOf('rules.guardStun').includes('defense'));
assert.ok(mechanicsOf('rules.staminaMax').includes('stamina'));
assert.ok(mechanicsOf('rules.clashFraction').includes('clash'));
ok('mecânicas principais mapeadas (inclusive VFX/tremor de cada mecânica)');

assert.equal(levelOf('actions.tackle.duration'), 'basic');
assert.equal(levelOf('actions.tackle.curveStart'), 'technical');
assert.equal(levelOf('extras.colors.playerR'), 'technical');
assert.equal(levelOf('vfx.hit.intensity'), 'basic');
assert.equal(levelOf('extras.toggles.enableTackle'), 'basic');
assert.ok(levelVisible('actions.tackle.duration', 'basic') && !levelVisible('actions.tackle.curveStart', 'advanced') && levelVisible('actions.tackle.curveStart', 'technical'));
const counts = {basic: 0, advanced: 0, technical: 0};for (const p of paths) counts[levelOf(p)]++;
assert.ok(counts.basic > 40 && counts.basic < counts.advanced + counts.technical, JSON.stringify(counts));
ok(`níveis: ${counts.basic} básicos · ${counts.advanced} avançados · ${counts.technical} técnicos`);

const t = derivedText('actions.tackle.distance');
assert.match(t, /Percorre ≈ [\d,]+ m em [\d,]+ s/);
C.actions.tackle.duration = C.actions.tackle.duration * 2;
assert.notEqual(derivedText('actions.tackle.distance'), t, 'o texto acompanha o valor atual');
resetConfig(defaults());
assert.match(derivedText('actions.tackle.cost'), /uso\(s\) seguidos/);
assert.match(derivedText('rules.staminaMax'), /Recarga completa/);
assert.match(derivedText('rules.guardStun'), /ms/);
assert.equal(derivedText('extras.colors.playerR'), null);
ok('valores derivados corretos e atualizados com a configuração');

assert.deepEqual(nestedFrom(['actions.tackle.duration', 'rules.guardStun'], p => p.length), {actions: {tackle: {duration: 23}}, rules: {guardStun: 15}});
assert.ok(allTags({'a.b': ['zzz', 'em teste']}).includes('zzz') && allTags({}).includes('em teste'));
ok('exportação aninhada e lista de etiquetas');
console.log(`\n${n} verificações da organização dos parâmetros aprovadas.`);
