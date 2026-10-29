// Inventário de animações ANTES do editor (754d6b2): nada pode ter desaparecido (regra do AGENTS.md).
import assert from 'node:assert/strict';
import {ACTION_IDS, STATE_ACTIONS, STATE_LABELS, VERTICAL_MOTION_FREE_GROUPS} from '../src/view/characters.js';
import {ANIMATION_GROUPS, JUMP_PHASES} from '../src/sim/animation-profile.js';
const ANTES_ACTIONS = ["idle","turn","walk","walk_back","walk_left","walk_right","sprint","sprint_back","sprint_left","sprint_right","walk_stop","sprint_stop","block_start","block","block_end","guard_impact","blocked","tackle","tackle_charge","tackle_pl2","tackle_pl3","brake","wall_splat","meteor_prep","meteor_dive","meteor_ground","dodge_forward","dodge_back","dodge_left","dodge_right","jump","hit","knockback","fall","land","recover","downed","death","move_1","move_2","move_3","move_4"];
const ANTES_STATES = ["neutral","turn","walk","walk_back","walk_left","walk_right","sprint","sprint_back","sprint_left","sprint_right","walk_stop","sprint_stop","guard_enter","guard","guard_exit","guard_hit","guardStun","tackle","wallSplat","ledge_hang","ledge_climb","meteor_prep","meteor_dive","meteor_ground","tackle_charge","tackle_pl2","tackle_pl3","brake","dodge_forward","dodge_back","dodge_left","dodge_right","vault","recoil","move_1","move_2","move_3","move_4","charge_reflect","release_reflect","charge_psyshock","release_psyshock","jump","airborne","landing","recover","defeated","pushed","stagger","hitstun","actionRecovery"];
for (const id of ANTES_ACTIONS) assert.ok(ACTION_IDS.includes(id), 'ação preservada: ' + id);
for (const k of ANTES_STATES) assert.ok(k in STATE_ACTIONS, 'estado preservado: ' + k);
for (const g of ['dodge', 'jump', 'tackle']) assert.ok(VERTICAL_MOTION_FREE_GROUPS.some(x => x.id === g), 'grupo vertical livre preservado: ' + g);
// Cobertura do editor: toda ação do jogo aparece na lista do editor (nenhuma fica escondida).
const listed = new Set(ANIMATION_GROUPS.flatMap(g => g[2]));
for (const id of ACTION_IDS) assert.ok(listed.has(id), 'o editor lista ' + id);
for (const id of JUMP_PHASES) assert.ok(ACTION_IDS.includes(id) && id in STATE_ACTIONS, 'fase do salto registrada: ' + id);
for (const k of Object.keys(STATE_ACTIONS)) if (!k.startsWith('ledge')) assert.ok(STATE_LABELS[k] || k === 'neutral', 'rótulo: ' + k);
console.log('animation-inventory: ok (' + ANTES_ACTIONS.length + ' ações e ' + new Set(ANTES_STATES).size + ' estados anteriores preservados)');
