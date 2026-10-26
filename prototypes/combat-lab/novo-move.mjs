// Gerador de Move: cria a FICHA completa em dado (src/sim/moves/<id>.move.json + <id>.params.js + <id>.js) e o teste de fumaça
// (test/moves-<id>.test.mjs) a partir de um modelo que já funciona e aparece automaticamente no Editor de Moves.
// Uso:  npm run novo-move -- "Nome do Move"
import {existsSync, writeFileSync} from 'node:fs';
import {writeIndex} from './gen-fichas.mjs';
import {factoryDefaults} from './src/sim/config.js';

const name = process.argv.slice(2).join(' ').trim();
if (!name) {console.error('Uso: npm run novo-move -- "Nome do Move"');process.exit(1);}
const words = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
if (!words.length || /^[0-9]/.test(words[0])) {console.error('O nome precisa começar com letra.');process.exit(1);}
const id = words.join('-'), group = words.map((w, i) => i ? w[0].toUpperCase() + w.slice(1) : w).join(''), fn = group;
const jsonFile = new URL(`./src/sim/moves/${id}.move.json`, import.meta.url);
const file = new URL(`./src/sim/moves/${id}.js`, import.meta.url);
const paramsFile = new URL(`./src/sim/moves/${id}.params.js`, import.meta.url);
const testFile = new URL(`./test/moves-${id}.test.mjs`, import.meta.url);
if (group in factoryDefaults().world) {console.error(`O nome "${name}" vira o grupo "${group}", que já existe em C.world (regras compartilhadas). Escolha outro nome.`);process.exit(1);}
for (const f of [jsonFile, file, paramsFile, testFile]) if (existsSync(f)) {console.error(`Já existe: ${f.pathname}. Escolha outro nome ou apague os arquivos do Move "${id}".`);process.exit(1);}

const moveJson = {
  schemaVersion: 1,
  def: {
    id,
    name,
    air: 'cast',
    group,
    description: `TODO: descreva o que o ${name} faz em uma frase.`,
    cost: 0.8,
    cooldown: 10,
    duration: 0.35,
    aim: 'facing',
    timeline: [{at: 0.35, atKey: 'cast', effect: id}],
  },
  params: {
    group,
    title: name,
    hint: 'TODO: texto de apoio da aba Moves e do Editor de Moves (tipo · categoria · como usar).',
    meta: {
      category: 'Normal',
      types: ['Buff'],
      pl: 'PL1',
      status: {proposto: true, aprovado: false, implementado: true, homologado: false},
    },
    rows: [
      {key: 'cost', label: 'Custo de stamina', tip: 'Cobrado no início do uso (M28.4).', min: 0, max: 5, step: 0.05, unit: 'num', value: 0.8},
      {key: 'cooldown', label: 'Cooldown', tip: 'Recarga aplicada no início do uso.', min: 0, max: 60, step: 0.5, unit: 'sec', value: 10},
      {key: 'cast', label: 'Duração da ação', tip: 'Tempo da ação até o efeito.', min: 0.05, max: 3, step: 0.01, unit: 'sec', value: 0.35},
      {key: 'duration', label: 'Duração do efeito', tip: 'Quanto tempo o status dura depois do cast.', min: 0.5, max: 20, step: 0.25, unit: 'sec', value: 5},
      {key: 'defensePct', label: 'Bônus de Defesa', tip: 'Dano recebido × 1/(1+bônus) enquanto o status durar.', min: 0, max: 2, step: 0.05, unit: 'pct', value: 0.3},
    ],
  },
};

writeFileSync(jsonFile, JSON.stringify(moveJson, null, 2) + '\n');

writeFileSync(paramsFile, `// @ts-check
// Parâmetros do Move "${id}" (title: ${JSON.stringify(name)}): padrão em C.world.${group}, faixa, unidade, rótulo e dica de cada slider.
// (Move como dado) Os parâmetros e a definição vêm de ${id}.move.json: edite lá ou no Editor de Moves.
import {loadMoveData} from './move-data.js';
import data from './${id}.move.json' with {type: 'json'};

const loaded = loadMoveData(data);
export const params = loaded.params;
export const def = loaded.def;
export const visual = loaded.visual;
`);

writeFileSync(file, `// @ts-check
// ${name} — FICHA do Move: este arquivo (regras e efeito) + ${id}.move.json (parâmetros e definição).
// REGRA OBRIGATÓRIA DE PARÂMETROS MECÂNICOS: nenhum número que controle o comportamento mecânico pode ficar fixo neste arquivo;
// declare-o em ${id}.move.json e leia de \`P.<chave>\` (o teste moves-mechanics-audit.test.mjs verifica automaticamente).
import {C} from '../config.js';
import {applyStatus} from '../status.js';
import {defineFicha} from './params-registry.js';
import {params, def as ${fn}Def} from './${id}.params.js';

export {${fn}Def};

/** Efeito do fim do cast. Os parâmetros vêm de C.world.${group} (capturados no início do uso: vale só nos PRÓXIMOS usos, M28.4). */
export function ${fn}Effect(game, f, def, fx) {
  const P = fx.params ?? C.world.${group};
  applyStatus(f, /** @type {any} */ ({id: '${id}', duration: P.duration, stacking: 'refresh', tags: ['buff', '${id}'], mul: {damageTaken: 1 / (1 + P.defensePct)}}), {source: f.id});
  fx.events?.push({result: 'moveEffect', move: '${id}', attacker: f.id, target: f.id, damage: 0, status: '${id}', duration: P.duration});
}

export const ficha = defineFicha({
  def: ${fn}Def, effect: ['${id}', ${fn}Effect],
  params,
  // Opcional: quando a IA usa o Move (perfil declarativo, ver src/sim/ai-profile.js). Sem esta linha a IA não usa o Move.
  // ai: {kind: 'tap', p: .3, why: 'motivo que aparece no log da IA', distance: {min: 3, max: 9}, requires: ['tGround'], minStamina: 1.5},
});
`);

writeFileSync(testFile, `// @ts-check
// ${name}: teste de fumaça gerado por \`npm run novo-move\`. Acrescente aqui as regras do Move (dano, alcance, interrupções…).
import {assert, suite, arena, press, run, secs, status} from './moves-new-helpers.mjs';
import {getMove} from '../src/sim/moves.js';

const {test, done} = suite(${JSON.stringify(name.toUpperCase())});

test('registrado pela ficha e nada equipado por padrão', () => {
  const g = arena();
  assert.ok(getMove('${id}'), 'o Move precisa estar registrado');
  assert.ok(g.fighters.every(f => (f.loadout ?? []).every(x => !x)));
});
test('cobra stamina e recarga ao iniciar e aplica o status depois do cast', () => {
  const g = arena({equip: ['${id}']});const b = g.fighters[0], s0 = b.stamina;
  press(g, 0);
  assert.ok(s0 - b.stamina > .5, 'stamina cobrada');
  assert.ok(b.moveCooldowns['${id}'] > 5, 'recarga iniciada');
  run(g, secs(.35) + 6);
  assert.ok(status(b, '${id}'), 'status ativo depois do cast');
});

done();
`);

writeIndex();
console.log(`Criado o Move "${name}" (id ${id}):
  ficha JSON  src/sim/moves/${id}.move.json
  regras      src/sim/moves/${id}.js
  parâmetros  src/sim/moves/${id}.params.js
  teste       test/moves-${id}.test.mjs
Próximos passos: edite ${id}.move.json e ${id}.js, rode  node prototypes/combat-lab/test/moves-${id}.test.mjs  e depois  npm run build:combat-lab.`);
