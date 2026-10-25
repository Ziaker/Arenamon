// Gerador de Move: cria a FICHA (src/sim/moves/<id>.js + <id>.params.js) e o teste de fumaça (test/moves-<id>.test.mjs) a partir de um modelo que já
// funciona (um buff de Defesa por alguns segundos) e atualiza os índices automáticos. Uso:  npm run novo-move -- "Nome do Move"
// Depois: abra a ficha, troque o efeito pelo que o Move faz, ajuste os parâmetros e rode  npm run build:combat-lab.
import {existsSync, writeFileSync} from 'node:fs';
import {writeIndex} from './gen-fichas.mjs';
import {factoryDefaults} from './src/sim/config.js';

const name = process.argv.slice(2).join(' ').trim();
if (!name) {console.error('Uso: npm run novo-move -- "Nome do Move"');process.exit(1);}
const words = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
if (!words.length || /^[0-9]/.test(words[0])) {console.error('O nome precisa começar com letra.');process.exit(1);}
const id = words.join('-'), group = words.map((w, i) => i ? w[0].toUpperCase() + w.slice(1) : w).join(''), fn = group;
const file = new URL(`./src/sim/moves/${id}.js`, import.meta.url), paramsFile = new URL(`./src/sim/moves/${id}.params.js`, import.meta.url), testFile = new URL(`./test/moves-${id}.test.mjs`, import.meta.url);
if (group in factoryDefaults().world) {console.error(`O nome "${name}" vira o grupo "${group}", que já existe em C.world (regras compartilhadas). Escolha outro nome.`);process.exit(1);}
for (const f of [file, paramsFile, testFile]) if (existsSync(f)) {console.error(`Já existe: ${f.pathname}. Escolha outro nome ou apague os arquivos do Move "${id}".`);process.exit(1);}

writeFileSync(paramsFile, `// @ts-check
// Parâmetros do ${name} (declarativo): padrão em C.world.${group}, faixa, unidade, rótulo e dica de cada slider da aba Moves.
// Módulo PURO (só importa params-registry.js): o config.js o carrega, então C.world.${group} existe sempre. Acrescentar uma linha aqui cria o slider sozinho.
import {defineMoveParams, standardRows, paramRow} from './params-registry.js';

export const params = defineMoveParams('${group}', {
  id: '${id}', title: ${JSON.stringify(name)},
  hint: 'TODO: texto de apoio da aba Moves (tipo · categoria · como usar).',
  rows: [
    ...standardRows({cost: .8, cooldown: 10, cast: .35}),
    paramRow({key: 'duration', label: 'Duração do efeito', tip: 'Quanto tempo o status dura depois do cast.', min: .5, max: 20, step: .25, unit: 'sec', value: 5}),
    paramRow({key: 'defensePct', label: 'Bônus de Defesa', tip: 'Dano recebido × 1/(1+bônus) enquanto o status durar.', min: 0, max: 2, step: .05, unit: 'pct', value: .3}),
  ],
});
`);

writeFileSync(file, `// @ts-check
// ${name} — FICHA do Move: este arquivo (regras e efeito) + ${id}.params.js (parâmetros). Modelo gerado por \`npm run novo-move\`: um buff de Defesa
// por alguns segundos, que já funciona. Troque o efeito (${fn}Effect) pelo que o Move faz. Nenhuma outra lista ou tabela precisa ser editada
// (os índices são gerados no build).
import {C} from '../config.js';
import {applyStatus} from '../status.js';
import {defineFicha} from './params-registry.js';
import {params} from './${id}.params.js';

export const ${fn}Def = Object.freeze({
  id: '${id}', name: ${JSON.stringify(name)}, air: 'cast', group: '${group}',
  description: ${JSON.stringify(`TODO: descreva o que o ${name} faz em uma frase.`)},
  cost: .8, cooldown: 10, duration: .35, aim: 'facing',
  timeline: [{at: .35, atKey: 'cast', effect: '${id}'}],
});

/** Efeito do fim do cast. Os parâmetros vêm de C.world.${group} (capturados no início do uso: vale só nos PRÓXIMOS usos). */
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
  regras      src/sim/moves/${id}.js
  parâmetros  src/sim/moves/${id}.params.js
  teste       test/moves-${id}.test.mjs
Próximos passos: edite os dois arquivos do Move, rode  node prototypes/combat-lab/test/moves-${id}.test.mjs  e depois  npm run build:combat-lab.`);
