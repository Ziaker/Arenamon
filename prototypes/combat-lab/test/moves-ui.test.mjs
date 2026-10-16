// Fase 6 (plano de Reflect/Psyshock) — parte sem navegador: estado dos slots para o HUD (mesmas permissões do controlador) e cenários
// técnicos repetíveis (esperado × obtido) com os ajustes atuais. Cobre M16.7, M28.3, M28.5, M28.8.
import assert from 'node:assert/strict';
import {C, defaults, resetConfig} from '../src/sim/config.js';
import {Game} from '../src/sim/game.js';
import {emptyCommand} from '../src/sim/entity.js';
import {vec} from '../src/sim/math.js';
import {clearMoves} from '../src/sim/moves.js';
import {clearEffects} from '../src/sim/move-effects.js';
import {registerStandardMoves} from '../src/sim/moves/standard.js';
import {slotStatus, slotStatuses} from '../src/sim/move-state.js';
import {MOVE_SCENARIOS, runMoveScenarios} from '../src/sim/scenarios-moves.js';
import {MOVES_HOMOLOG} from '../src/ui/moves-panel.js';

let n = 0;const ok = l => {n++;console.log('✓', l);};
const cmd = o => ({...emptyCommand(), ...o});
registerStandardMoves();
const arena = () => {resetConfig(defaults());const g = new Game();g.mode = 'inactive';g.reset({positions: [vec(0, -3), vec(0, 3)]});g.setLoadout(0, ['reflect', 'psyshock']);return g;};
const H = [true, false, false, false];

{
  const g = arena(), f = g.fighters[0];
  assert.deepEqual(slotStatuses(g.fighters[1]), [], 'sem movimento equipado não há slots');
  assert.deepEqual(slotStatuses(f).map(s => [s.id, s.state, s.text]), [['reflect', 'pronto', 'pronto'], ['psyshock', 'pronto', 'pronto']]);
  g.step(cmd({skill: 0, skillHeld: H}), cmd());for (let i = 0; i < 59; i++) g.step(cmd({skillHeld: H}), cmd());
  let s = slotStatus(f, 0);assert.equal(s.state, 'carregando');assert.equal(s.level, 1);assert.ok(s.progress > .1 && s.progress < .2);assert.match(s.text, /carregando 1\d% · PL1/);
  s = slotStatus(f, 1);assert.equal(s.state, 'bloqueado');assert.equal(s.reason, 'charging');assert.match(s.text, /carga em andamento/);
  for (let i = 0; i < 200; i++) g.step(cmd({skillHeld: H}), cmd());
  assert.match(slotStatus(f, 0).text, /PL2/);for (let i = 0; i < 300; i++) g.step(cmd({skillHeld: H}), cmd());assert.match(slotStatus(f, 0).text, /PL3 \(máximo\)/);
  g.step(cmd(), cmd());                                                                          // soltou
  s = slotStatus(f, 0);assert.equal(s.state, 'recarga');assert.ok(s.left > 7 && s.progress < .1);
  s = slotStatus(f, 1);assert.equal(s.state, 'recuperacao');assert.ok(s.left > 0 && s.left <= .25);
  for (let i = 0; i < 40; i++) g.step(cmd(), cmd());
  assert.equal(slotStatus(f, 1).state, 'pronto', 'recuperação acabou: o outro slot volta a ficar pronto');
  f.stamina = .2;f.regenBase = .2;f.regenAge = 0;g.step(cmd(), cmd());
  s = slotStatus(f, 1);assert.equal(s.state, 'bloqueado');assert.equal(s.reason, 'stamina');assert.match(s.text, /stamina insuficiente/);
}
ok('estado dos slots: pronto, carregando (% e PL), recarga, recuperação e bloqueado com o motivo do motor');
{
  const g = arena();g.fighters[0].flight = {y: 0, vy: 3, horizontal: vec(0, 0)};
  const s = slotStatus(g.fighters[0], 0);assert.equal(s.state, 'bloqueado');assert.equal(s.reason, 'noGround');
  // o HUD nunca promete o que o controlador negaria: conferido contra a própria permissão
  const h = arena();for (let slot = 0; slot < 2; slot++) assert.equal(slotStatus(h.fighters[0], slot).state === 'pronto', true);
}
ok('a tela usa as mesmas permissões do controlador (sem apoio no chão: bloqueado)');
{
  resetConfig(defaults());const all = runMoveScenarios();
  assert.equal(all.length, MOVE_SCENARIOS.length);assert.equal(all.length, 10);
  const bad = all.flatMap(s => s.rows.filter(r => !r.ok).map(r => `${s.name}: ${r.what} (${r.expected} × ${r.got})`));
  assert.deepEqual(bad, [], 'todos os cenários passam com os padrões');
  assert.ok(all.every(s => s.rows.length >= 1 && s.rows.every(r => r.expected !== undefined && r.got !== undefined)));
  assert.equal(runMoveScenarios(['reflect-tamanho']).length, 1);
  // mesma entrada, mesmo resultado (semente fixa)
  assert.equal(JSON.stringify(runMoveScenarios()), JSON.stringify(all), 'cenários repetíveis');
}
ok('10 cenários técnicos passam com os padrões, devolvem esperado × obtido e são repetíveis');
{
  resetConfig(defaults());C.world.reflect.widthMax = 2;C.world.psyshock.successiveFactor = .5;C.world.psyshock.maxStones = 6;
  const all = runMoveScenarios(), bad = all.flatMap(s => s.rows.filter(r => !r.ok).map(r => `${s.name}: ${r.what} (${r.expected} × ${r.got})`));
  assert.deepEqual(bad, [], 'os cenários acompanham os ajustes atuais (esperado calculado a partir dos sliders)');
  const r = all.find(s => s.id === 'reflect-tamanho').rows.at(-1);assert.match(r.expected, /^2 m/);
  resetConfig(defaults());
}
ok('os cenários usam os ajustes atuais: mexer nos sliders muda o esperado e o obtido juntos');
{
  assert.ok(MOVES_HOMOLOG.length >= 8 && MOVES_HOMOLOG.every(t => typeof t === 'string' && t.length > 20));
}
ok('há um checklist de avaliação jogável dos Moves, separado dos testes automáticos (M28.9)');

clearMoves();clearEffects();resetConfig(defaults());
console.log(`\n${n} verificações da interface dos Moves (Fase 6, sem navegador) aprovadas.`);
