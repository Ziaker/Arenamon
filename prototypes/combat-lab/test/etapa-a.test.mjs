// Etapa A: casos dedicados às direções de X/C, custo independente, cancelamento C→X e clash.
// Executar: node prototypes/combat-lab/test/etapa-a.test.mjs
import assert from 'node:assert/strict';
import {Game} from '../src/sim/game.js';
import {C, resetConfig} from '../src/sim/config.js';
import {emptyCommand, isInvulnerable, nominalDistance} from '../src/sim/entity.js';
import {vec, normalize} from '../src/sim/math.js';
let passed = 0;
function test(name, fn) {resetConfig();try {fn();passed++;console.log('✓', name);} finally {resetConfig();}}
const cmd = (v, type) => ({...emptyCommand(), move: v, dodgeDirection: v, [type]: true});
const idle = () => emptyCommand();
function duel(direction, distance = 2.5) {
  const g = new Game();g.mode = 'inactive';
  g.reset({positions: [vec(0, 0), vec(direction.x * distance, direction.z * distance)]});
  // A orientação não é usada para decidir se o X conecta.
  g.fighters[0].facing = 0;g.fighters[0].visualFacing = 0;
  return g;
}
function advance(g, first, second = idle(), ticks = 90) {
  for (let t = 0; t < ticks; t++) g.step(t === 0 ? first : idle(), t === 0 ? second : idle());
  return g.events;
}
const dirs = {frente:vec(0,1), trás:vec(0,-1), esquerda:vec(-1,0), direita:vec(1,0),
  'frente-esquerda':normalize(vec(-1,1)), 'frente-direita':normalize(vec(1,1)),
  'trás-esquerda':normalize(vec(-1,-1)), 'trás-direita':normalize(vec(1,-1))};
for (const [name, v] of Object.entries(dirs)) {
  test('X atinge na direção '+name+' mesmo com orientação inicial diferente', () => {
    const g = duel(v), events = advance(g, cmd(v,'tackle'));
    const hits = events.filter(e => e.result === 'impact' && e.attacker === 0);
    assert.equal(hits.length, 1, 'contato ofensivo único em '+name);
    assert.equal(hits[0].damage, C.profiles.balanced.attack);
    assert.ok(g.fighters[1].hp < C.profiles.balanced.hp);
  });
  test('C não produz dano na direção '+name, () => {
    const g = duel(v), events = advance(g, cmd(v,'dodge'));
    assert.equal(events.filter(e => e.attacker === 0 && e.damage > 0).length, 0);
    assert.equal(g.fighters[1].hp, C.profiles.balanced.hp);
  });
}
test('X que se afasta do adversário não causa dano', () => {
  const g = duel(vec(0,1));advance(g, cmd(vec(0,-1),'tackle'));assert.equal(g.fighters[1].hp, 100);
});
test('durações, distâncias, custos e invulnerabilidade X/C são independentes', () => {
  C.actions.dodge.duration = .6;C.actions.tackle.duration = .3;C.actions.dodge.distance = 1.3;
  C.actions.tackle.distance = 3.2;C.actions.dodge.cost = .5;C.actions.tackle.cost = 1.5;
  C.actions.dodge.invulnerable = .16;C.actions.tackle.invulnerable = .02;
  const g = new Game();g.reset();
  assert.notEqual(nominalDistance(g.fighters[0],'dodge'), nominalDistance(g.fighters[0],'tackle'));
  g.step(cmd(vec(0,1),'dodge'),idle());
  assert.equal(g.fighters[0].action.kind,'dodge');assert.ok(Math.abs(g.fighters[0].stamina-2.5)<1e-8);
  assert.ok(isInvulnerable(g.fighters[0]));
  const h = new Game();h.reset();h.step(cmd(vec(0,1),'tackle'),idle());
  assert.equal(h.fighters[0].action.kind,'tackle');assert.ok(Math.abs(h.fighters[0].stamina-1.5)<1e-8);
  assert.ok(isInvulnerable(h.fighters[0]));
});
function prepareCancel(ticks, near = false) {
  const g = new Game();g.mode='inactive';g.reset({positions:[vec(0, near ? -2.4 : -5),vec(0,0)]});
  g.step(cmd(vec(0,1),'dodge'),idle());
  for(let i=0;i<ticks;i++)g.step(idle(),idle());
  return g;
}
for (const tick of [0,1,10,23,32]) {
  test('C→X ocorre após '+(tick+1)+' passos, inclusive durante invulnerabilidade', () => {
    const g=prepareCancel(tick);const f=g.fighters[0], prev=f.action, before=f.stamina, remain=Math.max(0,C.actions.dodge.invulnerable-prev.elapsed);
    g.step(cmd(vec(0,1),'tackle'),idle());
    assert.equal(f.action?.kind,'tackle');assert.equal(f.action.fromCancel,true);
    assert.notEqual(prev,f.action);assert.ok(Math.abs(f.stamina-(before-C.actions.tackle.cost))<1e-8);
    assert.ok(Math.abs((f.action.invulnerableFor??-99)-remain)<C.test.step+.0001,'herdar somente janela restante');
  });
}
test('C→X negado por stamina insuficiente mantém a esquiva sem cobrança dupla', () => {
  const g=prepareCancel(2),f=g.fighters[0],original=f.action;
  f.stamina=.2;f.regenBase=.2;f.regenAge=0;g.step(cmd(vec(0,1),'tackle'),idle());
  assert.equal(f.action,original);assert.ok(f.stamina>=.2-1e-8);assert.equal(f.action.kind,'dodge');
});
test('C→X fora da janela própria é rejeitado mesmo quando encadeamento comum está aberto', () => {
  C.actions.cancel.windowEnd=.05;const g=prepareCancel(9),f=g.fighters[0],original=f.action;
  g.step(cmd(vec(0,1),'tackle'),idle());assert.equal(f.action,original);
});
test('C→X durante salto conserva altura e inicia descida contínua', () => {
  const g=prepareCancel(12,true),f=g.fighters[0];
  assert.equal(f.action.kind,'dodge');assert.ok(f.vaultHeight>0,'esquiva entrou no salto');
  const from=f.vaultHeight;g.step(cmd(vec(0,1),'tackle'),idle());
  assert.equal(f.action.kind,'tackle');assert.equal(f.action.fromCancel,true);
  assert.ok(f.vaultHeight>0 && f.vaultHeight<=from,'não teletransporta ao chão');
  let old=f.vaultHeight;for(let i=0;i<30;i++){g.step(idle(),idle());assert.ok(f.vaultHeight<=old+1e-7,'altura não salta para cima');old=f.vaultHeight;}
  assert.ok(f.vaultHeight<=1e-6,'desceu até o chão');
});
test('C→X não recebe invulnerabilidade adicional completa de X', () => {
  C.actions.dodge.invulnerable=.04;C.actions.tackle.invulnerable=.35;
  const g=prepareCancel(7),f=g.fighters[0];g.step(cmd(vec(0,1),'tackle'),idle());
  assert.equal(f.action.kind,'tackle');assert.equal(f.action.invulnerableFor,0);assert.equal(isInvulnerable(f),false);
});
for(const diagonal of [false,true])test('clash '+(diagonal?'diagonal':'frontal')+' causa 30% do ataque rival e lança ambos',()=>{
  const v=diagonal?normalize(vec(1,1)):vec(0,1);
  const g=new Game();g.mode='inactive';g.reset({positions:[vec(-v.x*1.8,-v.z*1.8),vec(v.x*1.8,v.z*1.8)]});
  const events=advance(g,cmd(v,'tackle'),cmd(vec(-v.x,-v.z),'tackle'),80);
  const clash=events.filter(e=>e.result==='clash');assert.equal(clash.length,2);
  assert.equal(g.fighters[0].hp,94);assert.equal(g.fighters[1].hp,94);
  assert.ok(events.every(e=>e.result==='clash'),'sem impacto comum simultâneo');
});
console.log('\nEtapa A: '+passed+' testes dedicados aprovados.');
