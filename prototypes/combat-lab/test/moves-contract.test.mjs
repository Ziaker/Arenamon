// Fase 0 (plano de Reflect/Psyshock) — TESTE DE CARACTERIZAÇÃO do contrato M28.4 (“slider mid-flight”).
// Não corrige nada: documenta, para cada entidade do mundo já criada, quais ajustes globais (`C.*`) ALTERAM o seu
// comportamento hoje. O contrato M28.4 diz que sliders de Moves só valem para usos posteriores; as fases de
// implementação devem mover essas leituras para parâmetros capturados na criação (`entity.captured`) e, então, esta tabela
// muda DE PROPÓSITO (os itens “AFETA” que forem parâmetros de Move passam a “não afeta”) e o teste é atualizado junto.
// Sem navegador. Os caminhos de `C` aqui são regras de mundo/física compartilhadas, não parâmetros de Move.
import assert from 'node:assert/strict';
import {C, defaults, resetConfig} from '../src/sim/config.js';
import {Game} from '../src/sim/game.js';
import {emptyCommand} from '../src/sim/entity.js';
import {vec} from '../src/sim/math.js';
import {registerMove, getMove, clearMoves} from '../src/sim/moves.js';
import {spawn} from '../src/sim/world.js';

let n = 0;const ok = l => {n++;console.log('✓', l);};
const set = (p, v) => {const k = p.split('.'), last = k.pop(), o = k.reduce((a, x) => a[x], C);assert.ok(last in o, `caminho inexistente em C: ${p}`);o[last] = v;};
const arena = () => {resetConfig(defaults());const g = new Game();g.mode = 'inactive';g.reset({positions: [vec(0, -3), vec(0, 3)]});g.fighters[0].facing = 0;g.fighters[1].facing = Math.PI;return g;};
const finger = (g, ev) => JSON.stringify({e: g.world.entities.map(e => ({k: e.kind, p: e.pos, y: e.y, d: e.dead, hp: e.hp, h: e.hitLog})),
  red: {hp: g.fighters[1].hp, p: g.fighters[1].position, v: g.fighters[1].velocity, f: !!g.fighters[1].flight, st: g.fighters[1].stun}, ev: ev.map(x => x.result)});
/** Cria `extra` (opcional) e `template` no mundo, aplica a alteração de `C` e roda 60 passos (0,5 s). O vermelho defende se `guard`. */
function run(template, extra, mut, guard) {
  const g = arena();if (extra) spawn(g.world, structuredClone(extra), []);const ev = [];spawn(g.world, structuredClone(template), ev);
  if (mut) set(mut[0], mut[1]);
  for (let i = 0; i < 60; i++) {g.step(undefined, {...emptyCommand(), guard, guardPressed: false});ev.push(...g.lastStepEvents);}
  const r = finger(g, ev);resetConfig(defaults());return r;
}
const PROJ = {kind: 'projectile', owner: 0, pos: {x: 0, z: -2}, dir: {x: 0, z: 1}, y: .65, radius: .25, speed: 14, life: 2, hit: {damage: 10, knockback: {horizontal: 6, vertical: 4}}};
const FAST = {...PROJ, speed: 60, radius: .02, pos: {x: 0, z: -2.2}};
const BARR = {kind: 'barrier', owner: 1, pos: {x: 0, z: 0}, angle: 0, hx: 2, hz: .05, y: 0, height: 2, life: 5, hp: Infinity, blocksProjectiles: true};
const AREA = {kind: 'area', owner: 0, pos: {x: 0, z: 1.5}, radius: 1.5, y: 0, height: 2, life: .3, pulses: 1, hit: {damage: 10, knockback: {horizontal: 4, vertical: 2}}};
const AREAM = {...AREA, pos: {x: 0, z: .6}};                                  // alcança o vermelho só se halfExtent crescer
const AREAH = {...AREA, pos: {x: 0, z: 2}, y: 1.5, height: .5, radius: 3};     // sobreposição vertical depende da altura do corpo

// [descrição, caminho de C, novo valor, entidade, entidade extra, vermelho defende?, AFETA hoje?]
const CASES = [
  ['projétil × lutador: meia-largura do corpo', 'test.halfExtent', .1, PROJ, null, false, true],
  ['projétil × lutador: altura do corpo (grupo “visual”)', 'extras.visual.bodyHeight', .3, PROJ, null, false, true],
  ['projétil: limite da arena', 'test.arenaHalf', 2.5, PROJ, null, false, true],
  ['projétil: lançamento ligado/desligado', 'extras.toggles.enableLaunch', 0, PROJ, null, false, true],
  ['projétil × defesa: multiplicador de dano da defesa', 'extras.combat.guardDamageMultiplier', .1, PROJ, null, true, true],
  ['projétil × defesa: guard stun', 'rules.guardStun', 1, PROJ, null, true, true],
  ['projétil rápido × barreira fina: passo de contato (tunelamento)', 'test.contactStep', 3, FAST, BARR, false, true],
  ['área: meia-largura do corpo', 'test.halfExtent', 1.0, AREAM, null, false, true],
  ['área: altura do corpo (sobreposição vertical)', 'extras.visual.bodyHeight', 1.9, AREAH, null, false, true],
  ['área: lançamento ligado/desligado', 'extras.toggles.enableLaunch', 0, AREA, null, false, true],
  ['área × defesa: multiplicador de dano da defesa', 'extras.combat.guardDamageMultiplier', .1, AREA, null, true, true],
  ['projétil rápido × barreira: limite de entidades (só vale na criação)', 'world.maxEntities', 1, FAST, BARR, false, false],
];
const report = [];
for (const [desc, path, val, tpl, extra, guard, expected] of CASES) {
  const base = run(tpl, extra, null, guard), mut = run(tpl, extra, [path, val], guard), affects = base !== mut;
  report.push(`${affects ? 'AFETA    ' : 'não afeta'}  ${path} = ${val}  — ${desc}`);
  assert.equal(affects, expected, `${desc}: ${path}=${val} deveria ${expected ? 'afetar' : 'não afetar'} a entidade já criada (estado atual do motor)`);
}
ok(`${CASES.filter(c => c[6]).length} de ${CASES.length} leituras de C ainda alteram entidades já criadas (caracterização do estado atual; ver relatório abaixo)`);
console.log('\n  Relatório (o que o contrato M28.4 exigirá capturar na criação, quando for parâmetro de Move):\n  ' + report.join('\n  ') + '\n');

// ---------- O que JÁ está congelado hoje ----------
{
  const g = arena(), tpl = structuredClone(PROJ), e = spawn(g.world, tpl, []);
  tpl.speed = 1;tpl.hit.damage = 999;tpl.radius = 9;                       // alterar o modelo depois de criar não afeta a entidade
  assert.equal(e.speed, 14);assert.equal(e.hit.damage, 10);assert.equal(e.radius, .25);
}
ok('entidade criada guarda cópia própria do modelo (velocidade, raio, vida e dados de acerto); alterar o modelo depois não a afeta');
{
  clearMoves();
  const def = {id: 'teste:congelado', duration: .4, cost: 1, cooldown: 2, timeline: [{at: .1, spawn: {...PROJ, offset: {forward: .8}}}]};
  registerMove(def);
  def.cost = 99;def.cooldown = 99;def.timeline[0].spawn.speed = 1;       // mutar a definição original depois de registrar
  const reg = getMove('teste:congelado');
  assert.equal(reg.cost, 1);assert.equal(reg.cooldown, 2);assert.equal(reg.timeline[0].spawn.speed, 14);
  assert.throws(() => {'use strict';reg.cost = 5;}, TypeError, 'a definição registrada é congelada');
  clearMoves();
}
ok('definição registrada de um Move é cópia congelada: alterar o objeto original ou a definição registrada não tem efeito');
{
  const g = arena(), ev = [];set('world.maxEntities', 1);spawn(g.world, structuredClone(BARR), ev);
  const second = spawn(g.world, structuredClone(PROJ), ev);
  assert.equal(second, null);assert.ok(ev.some(e => e.result === 'spawnRefused'), 'acima do limite a criação é recusada com evento');resetConfig(defaults());
}
ok('limite de entidades vale na criação (recusa com evento) e não remove as já existentes');

console.log(`\n${n} verificações do contrato M28.4 (caracterização, Fase 0) aprovadas.`);
resetConfig(defaults());
