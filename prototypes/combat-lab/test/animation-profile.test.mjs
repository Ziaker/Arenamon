// Perfil de animação: herança, migração idempotente, fases do salto, timeline e validação.
import assert from 'node:assert/strict';
import {emptyProfile, migrateProfile, setField, resolveField, jumpPhaseFor, buildTimeline, validateEntry, clipTimeAt, trimOf, loopRange, setHitboxes, ANIMATION_GROUPS, JUMP_PHASES, FIELDS} from '../src/sim/animation-profile.js';

// Herança: sem sobrescrita vale o global; ação e variante sobrescrevem; restaurar volta ao global.
let p = emptyProfile();
assert.deepEqual(resolveField(p, 'blendIn', 'jump', 'x', {}).overridden, false);
assert.equal(resolveField(p, 'speed', 'jump', 'x', {speed: 1.5}).value, 1.5);
p = setField(p, 'jump', 'blendIn', .2);
assert.equal(resolveField(p, 'blendIn', 'jump', 'clipA').value, .2);
p = setField(p, 'jump@clipA', 'blendIn', .05);
assert.equal(resolveField(p, 'blendIn', 'jump', 'clipA').value, .05);
assert.equal(resolveField(p, 'blendIn', 'jump', 'clipB').value, .2);
p = setField(setField(p, 'jump@clipA', 'blendIn', null), 'jump', 'blendIn', null);
assert.equal(resolveField(p, 'blendIn', 'jump', 'clipA').overridden, false);
assert.equal(setField(emptyProfile(), 'a', 'speed', 99).entries.a.speed, 4, 'valor limitado ao máximo');

// Migração: dado antigo vira perfil vazio; idempotente; lixo é descartado.
assert.deepEqual(migrateProfile(undefined), emptyProfile());
const dirty = migrateProfile({entries: {jump: {speed: 2, naoExiste: 3}}, hitboxes: {tackle: [{shape: 'x', start: 5}]}});
assert.equal(dirty.entries.jump.speed, 2);assert.equal(dirty.entries.jump.naoExiste, undefined);
assert.equal(dirty.hitboxes.tackle[0].start, 1);
assert.deepEqual(migrateProfile(dirty), dirty);

// Fases do salto cobrem início → subida → pico → queda.
assert.equal(jumpPhaseFor({vy: 5, sinceLaunch: .05}), 'jump_start');
assert.equal(jumpPhaseFor({vy: 5, sinceLaunch: .5}), 'jump_rise');
assert.equal(jumpPhaseFor({vy: .1, sinceLaunch: .5}), 'jump_apex');
assert.equal(jumpPhaseFor({vy: -4, sinceLaunch: .9}), 'jump_fall');
assert.equal(JUMP_PHASES.length, 4);
const all = ANIMATION_GROUPS.flatMap(g => g[2]);
for (const id of [...JUMP_PHASES, 'land', 'jump', 'vault' === 'x' ? '' : 'tackle', 'move_4']) assert.ok(all.includes(id), id);

// Recorte e laço.
assert.equal(clipTimeAt({elapsed: 5, duration: 2, loop: false, trim: [0, .5], loopRange: [0, .5]}), 1);
const t = clipTimeAt({elapsed: 3, duration: 2, loop: true, trim: [0, 1], loopRange: [.5, 1]});
assert.ok(t >= 1 && t <= 2, 'laço central fica entre início e fim do laço');
assert.deepEqual(trimOf({trimStart: 10, trimEnd: 50}), [.1, .5]);
assert.ok(loopRange({trimStart: 0, trimEnd: 100, loopStart: 20, loopEnd: 80})[1] === .8);

// Timeline: eventos do GLB intactos + camada local; conversão segue a velocidade.
const glb = [{type: 'hitbox_on', time: .2}, {type: 'hitbox_off', time: .4}, {type: 'invulnerable_start', time: 0}, {type: 'invulnerable_end', time: .3}];
let tl = buildTimeline({duration: 1, speed: 2, glbEvents: glb, values: {}});
const active = tl.tracks.find(x => x.kind === 'active');
assert.equal(active.origin, 'glb');assert.ok(Math.abs(active.seconds[0] - .1) < 1e-9, 'segundos de jogo = fração × duração ÷ velocidade');
tl = buildTimeline({duration: 1, speed: 1, glbEvents: glb, values: {activeStart: 10, activeEnd: 90}, hitboxes: setHitboxes(emptyProfile(), 'k', [{shape: 'box', start: .1, end: .5}]).hitboxes.k});
assert.equal(tl.tracks.find(x => x.kind === 'active').origin, 'local');
assert.ok(tl.tracks.some(x => x.kind === 'hitbox'));
assert.equal(tl.events.filter(e => e.origin === 'glb').length, 4, 'eventos do GLB preservados');

// Validação.
const bad = validateEntry({duration: 1, values: {activeStart: 50, activeEnd: 20}, hitboxes: [{id: 'a', shape: 'box', size: [1, 1, 1], position: [0, 0, 0], rotation: [0, 0, 0], bone: 'osso?', start: .5, end: .2}], markers: [], bones: new Set(['hips'])});
assert.ok(bad.some(i => i.text.includes('trecho ativo')) && bad.some(i => i.text.includes('osso')) && bad.some(i => i.text.includes('Hitbox 1: o fim')));
assert.deepEqual(validateEntry({duration: 1, values: {}, hitboxes: [], hasClip: true}), [], 'sem hitbox é válido');
assert.ok(validateEntry({duration: 0, values: {}, hasClip: false}).some(i => i.level === 'aviso'));
assert.ok(FIELDS.every(f => f.id && f.group && f.tip), 'todo campo tem grupo e tooltip');
console.log('animation-profile: ok');

// Fases da simulação → faixas de referência (fração da ação).
import {gameTracksFromPhases} from '../src/sim/animation-profile.js';
const gt = gameTracksFromPhases({duration: 1, startup: [0, .2], active: [[.2, .5]], recovery: [.5, 1], cancel: [.7, 1], invulnerable: [[0, .1]], impacts: []});
assert.deepEqual(gt.map(x => x.kind), ['startup', 'active', 'recovery', 'cancel', 'invuln']);
assert.equal(gt[1].end, .5);
assert.deepEqual(gameTracksFromPhases(null), []);
assert.ok(buildTimeline({duration: 2, speed: 1, gameTracks: gt}).tracks.some(x => x.origin === 'jogo'));
console.log('animation-profile (regras do jogo): ok');
