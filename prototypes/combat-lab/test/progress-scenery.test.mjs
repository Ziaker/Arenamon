// HUD de progressão "Banco de Células", cenário "Laboratório técnico" e consumíveis "Gemas Facetadas" (escolhidos em 21/10/2026):
// parte pura, sem navegador. Valores exibidos = regras aprovadas (R5.1, R5.5–R5.8, R6.9–R6.13), anel de blocos determinístico, os
// 7 tipos da simulação mapeados para a identidade visual e os parâmetros novos registrados no ajustador. Só apresentação.
import assert from 'node:assert/strict';
import {C, resetConfig, defaults} from '../src/sim/config.js';
import {PROGRESS_ATTRS, progressRows, stagesOf} from '../src/ui/progress-values.js';
import {ringBlocks, floorKey} from '../src/view/scenery.js';
import {GEM_TYPES} from '../src/view/consumables-gems.js';
import {SYMBOLS} from '../src/view/symbols.js';
import {NAMES, TOOLTIPS} from '../src/ui/tuning-meta.js';
import {CONSUMABLE_TYPES} from '../src/sim/map.js';

let passed = 0;
const test = (name, fn) => {resetConfig();fn();passed++;console.log('✓', name);};
const fighter = stages => ({stages});

test('os cinco atributos e os valores aprovados em cada estágio (0 a 4)', () => {
  const want = {attack: s => `+${10 * s}%`, defense: s => `−${10 * s} p.p.`, stamina: s => `+${s}`, cooldown: s => `−${10 * s}%`, speed: s => `+${5 * s}%`};
  assert.deepEqual(PROGRESS_ATTRS.map(a => a.key), ['attack', 'defense', 'stamina', 'cooldown', 'speed']);
  for (let s = 0; s <= 4; s++) {
    const rows = progressRows(fighter({attack: s, defense: s, staminaMax: s, cooldown: s, speed: s}), C.map);
    for (const r of rows) {assert.equal(r.text, want[r.key](s), `${r.key} estágio ${s}`);assert.equal(r.stage, s);assert.equal(r.isMax, s === 4);assert.equal(r.remaining, 4 - s);}
  }
});

test('estágio ausente = zero; valores fora da faixa são limitados a 0…máx', () => {
  assert.deepEqual(stagesOf(null), [0, 0, 0, 0, 0]);
  assert.deepEqual(stagesOf(fighter({attack: 9, defense: -2, staminaMax: 1.4})), [4, 0, 1, 0, 0]);
});

test('o HUD acompanha os sliders de Mapa › Progressão (nada fixo no código)', () => {
  C.map.stageAttackBonus = .2;C.map.stageDefenseReduction = .15;C.map.stageStaminaBonus = 2;C.map.stageCooldownReduction = .05;C.map.stageSpeedBonus = .1;C.map.stagesMax = 5;
  const r = Object.fromEntries(progressRows(fighter({attack: 3, defense: 2, staminaMax: 1, cooldown: 4, speed: 5}), C.map).map(x => [x.key, x]));
  assert.equal(r.attack.text, '+60%');assert.equal(r.defense.text, '−30 p.p.');assert.equal(r.stamina.text, '+2');assert.equal(r.cooldown.text, '−20%');assert.equal(r.speed.text, '+50%');
  assert.equal(r.speed.max, 5);assert.equal(r.speed.isMax, true);assert.equal(r.attack.remaining, 2);
});

test('anel de blocos: determinístico, cobre a borda e cresce com o raio', () => {
  const a = ringBlocks(32.5), b = ringBlocks(32.5), c = ringBlocks(16);
  assert.deepEqual(a, b);
  assert.ok(a.length > c.length && c.length >= 18);
  for (const k of a) assert.ok(Math.abs(Math.hypot(k.x, k.z) - 34) < 1e-9, 'todos a raio + 1,5 m');
  const tall = ringBlocks(16, 2), base = ringBlocks(16, 1);
  assert.ok(tall.every((k, i) => Math.abs(k.h - 2 * base[i].h) < 1e-9), 'altura proporcional ao multiplicador');
});

test('a chave da textura do piso muda só com o que a redesenha', () => {
  const k0 = floorKey(32.5);
  C.extras.visual.wallHeight = 1;assert.equal(floorKey(32.5), k0, 'altura da parede não redesenha o piso');
  C.extras.colors.floorR += 10;assert.notEqual(floorKey(32.5), k0, 'cor do piso redesenha');
  resetConfig();C.display.scenery.labRingStep = 8;assert.notEqual(floorKey(32.5), k0, 'distância dos anéis redesenha');
  resetConfig();C.extras.visual.gridDivisions = 40;assert.notEqual(floorKey(32.5), k0, 'divisões do grid redesenham');
});

test('os 7 tipos de consumível da simulação têm cor, símbolo e identidade próprios', () => {
  assert.deepEqual(Object.keys(GEM_TYPES).sort(), [...CONSUMABLE_TYPES].sort());
  const colors = Object.values(GEM_TYPES).map(t => t.color), ids = Object.values(GEM_TYPES).map(t => t.id);
  assert.equal(new Set(colors).size, 7);assert.equal(new Set(ids).size, 7);
  for (const id of ids) assert.ok(SYMBOLS[id]?.length, 'símbolo ' + id);
  for (const a of PROGRESS_ATTRS) assert.ok(SYMBOLS[a.key], 'símbolo do atributo ' + a.key);
});

test('parâmetros novos: padrões aprovados e registrados no ajustador (nome e explicação)', () => {
  const D = defaults().display;
  assert.equal(D.scenery.labTheme, 1);assert.equal(D.progress.pgEnabled, 1);assert.equal(D.progress.pgSubject, 2, 'padrão: jogador e adversário');assert.equal(D.progress.pgLayout, 1, 'padrão: horizontal compacto');assert.equal(D.progress.pgScale, 1);assert.equal(D.progress.pgScaleEnemy, 1, 'tamanho do adversário independente');assert.equal(D.consumables.gemStyle, 1);
  for (const group of [D.scenery, D.progress, D.consumables]) for (const key of Object.keys(group)) {
    assert.ok(NAMES[key], 'nome de ' + key);assert.ok(TOOLTIPS[key], 'explicação de ' + key);assert.equal(typeof group[key], 'number', key + ' numérico (vira slider)');
  }
});

console.log(`\n${passed} testes passaram`);
