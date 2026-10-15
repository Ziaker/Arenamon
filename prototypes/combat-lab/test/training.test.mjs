// Treino de defesa/esquiva perfeitas (sem navegador): o adversário ataca de forma determinística, o impacto previsto
// pelo motor coincide com o real e a cronometragem concorda com o resultado do motor em todos os deslocamentos.
import assert from 'node:assert/strict';
import {C, defaults, resetConfig} from '../src/sim/config.js';
import {Game} from '../src/sim/game.js';
import {emptyCommand} from '../src/sim/entity.js';
import {vec, sub, normalize} from '../src/sim/math.js';
import {Trainer, evaluate, predictImpact} from '../src/sim/training.js';

let n = 0;const ok = l => {n++;console.log('✓', l);};
/** Roda o treino com um jogador roteirizado que responde `k` passos antes do impacto previsto (negativo = depois). */
function drill({mode, offsets, attack = 'front', seed = 4}) {
  resetConfig(defaults());const g = new Game(), tr = new Trainer({mode, attack, seed, interval: .8}).start(g);const out = [];let plan = null, i = 0;
    for (let t = 0; t < 120 * 60 && out.length < offsets.length; t++) {
    const c1 = tr.enemyCommand(g), cur = tr.cur;
    // O jogador decide o momento antes do ataque começar (pode responder cedo demais), pelo passo previsto do impacto.
    if (cur?.predictedTick != null && !plan) plan = {at: cur.predictedTick - offsets[i], k: offsets[i]};
    let c0 = emptyCommand();
    if (plan && g.tick === plan.at) {
      if (mode === 'guard') c0 = {...emptyCommand(), guard: true, guardPressed: true};
      else {const away = normalize(sub(g.fighters[1].position, g.fighters[0].position)), d = vec(away.x * .45 + away.z * .9, away.z * .45 - away.x * .9);c0 = {...emptyCommand(), move: d, dodge: true, dodgeDirection: d};}
    } else if (plan && mode === 'guard' && g.tick > plan.at) c0 = {...emptyCommand(), guard: true};
    g.step(c0, c1);
    const done = tr.observe(g, c0);
    if (done) {out.push({...done, k: plan?.k});plan = null;i++;}
  }
  return {out, tr};
}
{
  const {out} = drill({mode: 'guard', offsets: [0, 5, 10, 20, 23, 24, 25, 30, 40, -2, -6]});
  for (const a of out) {
    assert.equal(a.impactSource, 'real', 'houve contato');assert.equal(a.impactTick, a.predictedTick, `impacto previsto = real (#${a.n})`);
    assert.equal(a.timing === 'inside', a.success, `cronometragem × motor no deslocamento ${a.k}: ${a.timing} / ${a.result}`);
  }
  const W = Math.round(C.rules.perfect / C.test.step);
  assert.ok(out.find(a => a.k === W - 1).success && !out.find(a => a.k === W).success, `limite exato da janela: ${W - 1} passos antes ainda é perfeita, ${W} não`);
  const early = out.find(a => a.k === 30);assert.equal(early.timing, 'early');assert.match(early.text, /^Defesa executada \d+ ms antes da janela perfeita\.$/);
  assert.equal(Math.round(early.error * 1000), Math.round((30 - W + 1) * C.test.step * 1000));
  const late = out.find(a => a.k === -6);assert.equal(late.timing, 'late');assert.match(late.text, /depois do impacto/);assert.equal(late.result, 'impact');
  console.log('   ' + out.map(a => `${a.k}p→${a.result}`).join(' · '));
}
ok('defesa perfeita: impacto previsto pelo motor = real; dentro da janela ⇔ evento “perfect” (limite exato ao passo); “N ms antes da janela perfeita”');
{
  const {out} = drill({mode: 'dodge', offsets: [0, 4, 10, 20, 23, 24, 30, -3]});
  const contact = out.filter(a => a.result);
  assert.ok(contact.length >= 3, 'esquivas em cima do impacto encostam no tackle (as muito antecipadas saem do caminho)');
  for (const a of contact) assert.equal(a.timing === 'inside', a.success, `esquiva: ${a.k} passos → ${a.timing} / ${a.result}`);
  for (const a of out.filter(x => !x.result)) assert.equal(a.impactSource, 'previsto', 'sem contato: cronometragem pelo impacto previsto');
  assert.ok(out.find(a => a.k === 4)?.success && out.find(a => a.k === 10)?.success, 'esquivas pouco antes do impacto são perfeitas');
  assert.equal(out.find(a => a.k === 24)?.timing, 'early', 'antes da invulnerabilidade alcançar o impacto');assert.equal(out.find(a => a.k === -3)?.timing, 'late');
  console.log('   ' + out.map(a => `${a.k}p→${a.result ?? 'sem contato'}`).join(' · '));
}
ok('esquiva perfeita: dentro da invulnerabilidade ⇔ evento “perfectDodge”; sem contato, usa o impacto previsto');
{
  const a = drill({mode: 'guard', offsets: [5, 30, 12], attack: 'random', seed: 9}).out.map(x => [x.kind, x.attackTick, x.impactTick, x.result]);
  const b = drill({mode: 'guard', offsets: [5, 30, 12], attack: 'random', seed: 9}).out.map(x => [x.kind, x.attackTick, x.impactTick, x.result]);
  assert.deepEqual(a, b, 'mesma semente: mesmos ataques, mesmos passos');
  const c = drill({mode: 'guard', offsets: [5, 30, 12], attack: 'random', seed: 10}).out.map(x => [x.kind, x.attackTick]);
  assert.notDeepEqual(a.map(x => [x[0], x[1]]), c, 'outra semente muda o sorteio');
}
ok('treino determinístico pela semente (tipo de ataque, intervalos e passos)');
{
  assert.equal(evaluate({mode: 'guard', impactTick: 100, commandTick: null}).timing, 'none');
  const g = new Game();g.reset({positions: [vec(0, -2), vec(0, 2)]});assert.equal(predictImpact(g), null, 'sem ataque, sem impacto previsto');
  const s = drill({mode: 'guard', offsets: [8, 8, 40]}).tr.stats;assert.equal(s.total, 3);assert.equal(s.hits, 2);assert.ok(s.meanError > 0);
  // Logo depois de uma defesa que não foi perfeita a janela fica em recarga: o treino diz isso em vez de culpar o tempo.
  const cd = drill({mode: 'guard', offsets: [40, 8]}).out[1];assert.ok(!cd.success && cd.timing === 'cooldown' && /recarga/.test(cd.text), JSON.stringify([cd.timing, cd.text]));
}
ok('placar: tentativas, acertos e erro médio; toque com a defesa perfeita em recarga é identificado');
resetConfig(defaults());
console.log(`\n${n} verificações do treino aprovadas.`);
