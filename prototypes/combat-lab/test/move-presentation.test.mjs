import assert from 'node:assert/strict';
import {firstAvailablePresentationAction, presentationActionCandidates} from '../src/sim/move-presentation.js';

assert.deepEqual(
  presentationActionCandidates({id: 'quick-attack', presentation: {action: 'quick_attack'}}, 2, 'action'),
  ['quick_attack', 'move_3', 'tackle', 'idle'],
  'a identidade específica vence o slot, preservando todos os fallbacks legados',
);

assert.equal(
  firstAvailablePresentationAction(
    {id: 'quick-attack', presentation: {action: 'quick_attack'}},
    2,
    'action',
    key => key === 'move_3' || key === 'idle',
  ),
  'move_3',
  'clipe específico ausente cai para o slot atual',
);
assert.equal(
  firstAvailablePresentationAction(
    {id: 'quick-attack', presentation: {action: 'quick_attack'}},
    0,
    'action',
    key => key === 'quick_attack' || key === 'move_1',
  ),
  'quick_attack',
  'clipe específico existente vence o fallback por slot',
);

assert.deepEqual(
  presentationActionCandidates({id: 'quick-attack'}, 2, 'action'),
  ['move_3', 'tackle', 'idle'],
  'Move antigo continua usando exatamente o caminho legado por slot',
);

assert.deepEqual(
  presentationActionCandidates({id: 'reflect', presentation: {charge: 'reflect_charge', release: 'reflect_release'}}, 9, 'charge'),
  ['reflect_charge', 'charge_reflect', 'idle'],
  'carga específica preserva a chave legada e limita slot inválido',
);

assert.deepEqual(
  presentationActionCandidates({id: 'reflect', presentation: {release: 'reflect_release'}}, -4, 'release'),
  ['reflect_release', 'release_reflect', 'move_1', 'tackle', 'idle'],
  'soltura específica preserva release legado, slot limitado e fallbacks gerais',
);

assert.deepEqual(
  presentationActionCandidates({id: 'quick-attack', presentation: {action: 'move_1'}}, 0, 'action'),
  ['move_1', 'tackle', 'idle'],
  'candidatos duplicados são removidos sem mudar a ordem',
);

console.log('✓ contrato de identidade visual dos Moves aprovado');
