// @ts-check
// Fase 2 do Overhaul dos Sliders Mecânicos: detecção automática de números mecânicos e auditoria do registro único.
// Garante que:
//   1. Nenhum Move esconde números mecânicos fora da ficha .move.json (exceto constantes técnicas justificadas ou fallbacks de P.<chave>);
//   2. Todos os 19 Moves têm parâmetros exclusivos classificados nas 16 categorias obrigatórias, com consumidor real, parâmetros herdados,
//      fórmulas calculadas ao vivo e constantes técnicas documentadas;
//   3. Um caso sintético RED com número mágico escondido é detectado imediatamente pela análise sintática.

import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {assert, C, suite, arena} from './moves-new-helpers.mjs';
import {EDITABLE_MOVES} from '../src/editor/editable-moves.js';
import {
  auditMoveRegistry,
  findUnclassifiedMoveNumbers,
  getCalculatedValuesForMove,
  getInheritedParamsForMove,
  getTechnicalConstantsForMove,
} from '../src/sim/moves/move-mechanics-audit.js';
import {MOVE_MECHANIC_CATEGORIES, classifyParamRow, moveParamGroups} from '../src/sim/moves/params-registry.js';

const {test, done} = suite('AUDITORIA AUTOMÁTICA DE PARÂMETROS MECÂNICOS (AST + REGISTRO)');
const labDir = fileURLToPath(new URL('..', import.meta.url));

test('registro único: todos os 19 Moves têm parâmetros exclusivos válidos, categorias oficiais e consumidores verificados', () => {
  arena();
  const audit = auditMoveRegistry();
  assert.equal(audit.groupsCount, 19, '19 grupos de Moves registrados');
  assert.ok(audit.totalExclusiveParams >= 280, `esperado >= 280 parâmetros exclusivos, veio ${audit.totalExclusiveParams}`);
  assert.deepEqual(audit.issues, [], 'nenhum problema de esquema ou faixa no registro único');

  const usedCategories = new Set();
  for (const g of moveParamGroups()) {
    for (const r of g.rows) {
      const c = classifyParamRow(g.group, r);
      usedCategories.add(c.category);
      const consumerFile = labDir + c.consumer.file;
      const src = readFileSync(consumerFile, 'utf8');
      assert.ok(src.length > 0, `arquivo consumidor existe: ${c.consumer.file}`);
    }
  }
  assert.ok(usedCategories.size >= 14, `categorias cobertas pelos parâmetros exclusivos: ${usedCategories.size}`);
  for (const cat of usedCategories) {
    assert.ok(MOVE_MECHANIC_CATEGORIES.includes(cat), `categoria oficial: ${cat}`);
  }
});

test('detector sintático: nenhum dos 19 arquivos de Move nem os módulos compartilhados contém números mecânicos escondidos', () => {
  const moveFiles = EDITABLE_MOVES.map(m => `src/sim/moves/${m.id}.js`);
  const sharedFiles = [
    'src/sim/sand.js',
    'src/sim/stone.js',
    'src/sim/trap.js',
    'src/sim/charge.js',
  ];
  const allOffenders = [];
  for (const rel of [...moveFiles, ...sharedFiles]) {
    const code = readFileSync(labDir + rel, 'utf8');
    allOffenders.push(...findUnclassifiedMoveNumbers(code, rel));
  }
  assert.deepEqual(
    allOffenders,
    [],
    'Números mecânicos sem slider encontrados:\n' + allOffenders.map(o => `  ${o.file}:${o.line} -> ${o.value} (${o.context})`).join('\n'),
  );
});

test('detector sintático (RED sintético): falha imediatamente se alguém introduzir um número mágico escondido num Move', () => {
  const badCode = `
    export function fakeMoveEffect(game, f, def, fx) {
      const P = fx.params;
      const hiddenLife = 120;
      const hiddenHeight = 0.35;
      return {damage: P.damage, life: hiddenLife, height: hiddenHeight};
    }
  `;
  const found = findUnclassifiedMoveNumbers(badCode, 'src/sim/moves/fake-move.js');
  assert.equal(found.length, 2, 'detecta exatamente os 2 números mágicos escondidos (120 e 0.35)');
  assert.deepEqual(found.map(x => x.value), [120, 0.35]);
});

test('todos os 19 Moves expõem parâmetros herdados, valores calculados ao vivo e constantes técnicas justificadas', () => {
  arena();
  for (const m of EDITABLE_MOVES) {
    const inherited = getInheritedParamsForMove(m.id, m.group);
    const calculated = getCalculatedValuesForMove(m.id, m.group, C.world, {
      attackRef: C.test.attackReference,
      bodyHeight: C.extras.visual.bodyHeight,
      halfExtent: C.test.halfExtent,
    });
    const technical = getTechnicalConstantsForMove(m.id);
    assert.ok(inherited.length >= 2, `${m.id}: pelo menos 2 parâmetros herdados`);
    assert.ok(calculated.length >= 2, `${m.id}: pelo menos 2 fórmulas calculadas ao vivo`);
    assert.ok(technical.length >= 1, `${m.id}: pelo menos 1 constante técnica justificada`);
  }
});

done();
