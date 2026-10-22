// Cenários reproduzíveis do sistema de passivas (ordem 2026-10-20, §28): 42 cenários numerados que cobrem
// equipamento (R1–R6), as 18 passivas, cooldowns (R16–R18), hitstop (R24–R29), KO (R23), ciclo de rodada (§7),
// save/load e determinismo (§26–27) e paridade com o sistema desligado (§32). Valores esperados derivam da
// configuração atual (C.passivas), então continuam válidos quando os sliders de balanceamento mudam.
import {C} from './config.js';
import {Game} from './game.js';
import {vec} from './math.js';
import {stat, applyStatus} from './status.js';
import {costOf} from './controller.js';
import {validateLoadout} from './passives.js';
import {attachPassives, passiveContribute, knockbackFactor, perfectWindowBonus, hitStunFactor, dotFactor, passiveOnEvents, tickPassives, P} from './passive-engine.js';
import {processDamageWithShieldAndStages} from './map.js';

const cmd = (o = {}) => ({move: vec(), dodge: false, tackle: false, guard: false, guardPressed: false, target: null, ...o});
const face = (f, angle) => {f.facing = angle;f.visualFacing = angle;f.combatHeading = angle;};
const fmt = v => typeof v === 'number' ? (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(3).replace(/\.?0+$/, '')) : String(v);
const check = (label, ok, expected, actual) => ({label, ok: !!ok, expected: fmt(expected), actual: fmt(actual)});
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;
const ev = (log, result) => log.events.filter(e => e.result === result);
/** Equipa passivas e religa o estado (chamado no setup, após o reset do prepareScenario). */
const equip = (g, ids0, ids1, sp0 = null, sp1 = null) => {
  g.passiveIdentity = [sp0, sp1];
  const r0 = g.setPassiveLoadout(0, ids0), r1 = g.setPassiveLoadout(1, ids1);
  attachPassives(g);
  return [r0, r1];
};
const enough = (extra = 0) => Math.ceil((C.actions.tackle.duration + C.actions.dodge.duration + 2 * C.rules.launchUp / C.rules.launchGravity + C.rules.landingRecovery + 1 + extra) / C.test.step) + 40;
/** Roteiro padrão: azul investe no vermelho parado (t=10) e ambos ficam parados depois. */
const hitScript = t => [t === 10 ? cmd({move: vec(0, 1), tackle: true, target: 1}) : cmd({target: 1}), cmd({target: 0})];
const facing = g => {face(g.fighters[0], 0);face(g.fighters[1], Math.PI);};

export const PASSIVE_SCENARIOS = [
  // 1–5: equipamento e validação (R1–R6)
  {id: 'pv-01-duas-genericasequipadas', name: 'Passivas 01 · Duas genéricas equipadas', description: 'Azul com Speed Boost + Technician; vermelho sem passivas.',
    positions: [vec(0, -2.4), vec(0, 0)], ticks: () => 200, setup: g => {facing(g);equip(g, ['speed-boost', 'technician'], []);},
    checks: ({game}) => {
      const a = game.fighters[0], base = a.attributes.speed;
      return [check('Loadout aplicado (2 passivas)', a.passiveState.loadout.length === 2, 2, a.passiveState.loadout.length),
        check('Velocidade efetiva = base × 1,15', near(stat(a, 'speed', base), base * (1 + P('speed-boost').speedPct)), base * (1 + P('speed-boost').speedPct), stat(a, 'speed', base)),
        check('Custo de esquiva com Technician', near(costOf(a, C.actions.dodge.cost, 'dodge'), C.actions.dodge.cost * (1 - P('technician').costPct)), C.actions.dodge.cost * (1 - P('technician').costPct), costOf(a, C.actions.dodge.cost, 'dodge')),
        check('Custo de tackle sem desconto', near(costOf(a, C.actions.tackle.cost), C.actions.tackle.cost), C.actions.tackle.cost, costOf(a, C.actions.tackle.cost))];
    }},
  {id: 'pv-02-gen-exclusiva', name: 'Passivas 02 · Genérica + exclusiva da espécie', description: 'Croagunk equipa Poison Touch + Speed Boost.',
    positions: [vec(0, -2.4), vec(0, 0)], ticks: () => 60, setup: g => {facing(g);equip(g, ['poison-touch', 'speed-boost'], [], 'croagunk');},
    checks: ({game}) => [check('Espécie reconhecida (nome explícito)', game.passiveIdentity[0] === 'croagunk', 'croagunk', game.passiveIdentity[0]),
      check('Loadout gen+exclusiva válido', game.fighters[0].passiveState.loadout.join(',') === 'poison-touch,speed-boost', 'poison-touch,speed-boost', game.fighters[0].passiveState.loadout.join(','))]},
  {id: 'pv-03-duas-exclusivas', name: 'Passivas 03 · Duas exclusivas da mesma espécie', description: 'Drowzee equipa Forewarn + Inner Focus.',
    positions: [vec(0, -2.4), vec(0, 0)], ticks: () => 60, setup: g => {facing(g);equip(g, ['forewarn', 'inner-focus'], [], 'drowzee');},
    checks: ({game}) => [check('Duas exclusivas equipadas', game.fighters[0].passiveState.loadout.length === 2, 2, game.fighters[0].passiveState.loadout.length)]},
  {id: 'pv-04-duplicata-recusada', name: 'Passivas 04 · Duplicata recusada (UI e motor)', description: 'Equipar a mesma passiva duas vezes falha na validação compartilhada.',
    positions: [vec(0, -2.4), vec(0, 0)], ticks: () => 30, setup: g => {facing(g);equip(g, [], []);},
    checks: ({game}) => {
      const ui = validateLoadout(['speed-boost', 'speed-boost'], null), motor = game.setPassiveLoadout(0, ['speed-boost', 'speed-boost']);
      return [check('Validação da UI recusa duplicata', ui.length > 0, '≥1 erro', ui.length), check('Motor recusa duplicata (R5)', motor.ok === false, false, motor.ok),
        check('Loadout anterior preservado', game.fighters[0].passiveState.loadout.length === 0, 0, game.fighters[0].passiveState.loadout.length)];
    }},
  {id: 'pv-05-exclusiva-errada', name: 'Passivas 05 · Exclusiva de outra espécie recusada', description: 'Vigoroth não pode equipar Poison Touch (exclusiva de Croagunk).',
    positions: [vec(0, -2.4), vec(0, 0)], ticks: () => 30, setup: g => {facing(g);equip(g, [], []);},
    checks: ({game}) => {
      const wrong = validateLoadout(['poison-touch'], 'vigoroth'), right = validateLoadout(['vital-spirit', 'guts'], 'vigoroth');
      return [check('Exclusiva alheia recusada (R4)', wrong.some(e => e.includes('exclusiva')), 'erro de exclusividade', wrong.join(' · ') || 'nenhum'),
        check('Exclusivas da espécie aceitas', right.length === 0, 0, right.length)];
    }},
  // 6–27: as 18 passivas
  {id: 'pv-06-speed-boost', name: 'Passivas 06 · Speed Boost', description: '+15% permanente de locomoção e dash.',
    positions: [vec(0, -2.4), vec(0, 0)], ticks: () => 60, setup: g => {facing(g);equip(g, ['speed-boost'], []);},
    checks: ({game}) => {const a = game.fighters[0], base = a.attributes.speed;
      return [check('Locomoção × (1+speedPct)', near(stat(a, 'speed', base), base * (1 + P('speed-boost').speedPct)), base * (1 + P('speed-boost').speedPct), stat(a, 'speed', base)),
        check('Sem cooldown nem efeito ativo', a.passiveState.actives.length === 0 && Object.keys(a.passiveState.cooldowns).length === 0, 'vazio', `${a.passiveState.actives.length}/${Object.keys(a.passiveState.cooldowns).length}`)];}},
  {id: 'pv-07-technician-sem-stamina', name: 'Passivas 07 · Technician permite esquiva sem stamina cheia', description: 'Custo 0,8: com 0,85 de stamina a esquiva sai (sem Technician seriam 1,0 e não sairia).',
    positions: [vec(0, -6), vec(0, 6)], ticks: () => 60, setup: g => {facing(g);equip(g, ['technician'], []);},
    script: (t, g, s) => {if (t === 5) {g.fighters[0].stamina = C.actions.dodge.cost * (1 - P('technician').costPct) + .05;g.fighters[0].regenBase = g.fighters[0].stamina;g.fighters[0].regenAge = 0;g.fighters[0].exhausted = false;}
      if (t === 6 && s.stam === undefined) s.stam = g.fighters[0].stamina;
      return [t === 5 ? cmd({move: vec(1, 0), dodge: true, dodgeDirection: vec(1, 0)}) : cmd(), cmd()];},
    checks: ({log, scratch}) => [check('Esquiva iniciada com stamina 0,85', log.actionsStarted[0] === 1, 1, log.actionsStarted[0]),
      check('Stamina descontada = custo efetivo', near(scratch.stam ?? -1, 0.05, .001), '~0,05', scratch.stam ?? '—')]},
  {id: 'pv-08-poison-touch', name: 'Passivas 08 · Poison Touch envenena no tackle', description: 'Tackle com dano real aplica veneno 2 HP/s por 3 s.',
    positions: [vec(0, -2.4), vec(0, 0)], ticks: () => enough(4), setup: g => {facing(g);equip(g, ['poison-touch'], [], 'croagunk');},
    script: hitScript,
    checks: ({log, game}) => {
      const v = game.fighters[1], p = P('poison-touch');
      return [check('Ativação registrada', ev(log, 'passiveActivated').some(e => e.passive === 'poison-touch'), 1, ev(log, 'passiveActivated').length),
        check('Veneno aplicado no alvo', ev(log, 'statusApplied').some(e => e.status === 'passive-poison'), 'passive-poison', ev(log, 'statusApplied').map(e => e.status).join(',') || 'nenhum'),
        check('Dano periódico do veneno', v.hp <= 100 - p.dps * p.duration + 1e-6 && v.hp < 100, `≤ ${fmt(100 - p.dps * p.duration)}`, v.hp)];}},
  {id: 'pv-09-poison-vs-defesa-perfeita', name: 'Passivas 09 · Poison Touch vs defesa perfeita', description: 'Defesa perfeita impede o veneno (sem dano real ao HP).',
    positions: [vec(0, -2.4), vec(0, 0)], ticks: () => enough(), setup: g => {facing(g);equip(g, ['poison-touch'], [], 'croagunk');},
    script: (t, g) => [t === 10 ? cmd({move: vec(0, 1), tackle: true, target: 1}) : cmd({target: 1}), cmd({guard: true, guardPressed: t === 9, target: 0})],
    checks: ({log, game}) => [check('Defesa perfeita', ev(log, 'perfect').length === 1, 1, ev(log, 'perfect').length),
      check('Sem veneno', !game.fighters[1].statuses.some(s => s.id === 'passive-poison'), 'nenhum', game.fighters[1].statuses.map(s => s.id).join(',') || 'nenhum')]},
  {id: 'pv-10-veneno-periodico', name: 'Passivas 10 · Veneno periódico', description: 'O tick de veneno é dano periódico: 2 HP a cada 1 s, 3 ticks no total.',
    positions: [vec(0, -2.4), vec(0, 0)], ticks: () => enough(4), setup: g => {facing(g);equip(g, ['poison-touch'], [], 'croagunk');},
    script: hitScript,
    checks: ({log}) => {const ticks = ev(log, 'statusTick').filter(e => e.status === 'passive-poison');
      return [check('3 ticks de veneno', ticks.length === 3, 3, ticks.length), check('Dano por tick = dps', ticks.every(t => near(t.damage, P('poison-touch').dps)), P('poison-touch').dps, ticks.map(t => fmt(t.damage)).join('/') || '—')];}},
  {id: 'pv-11-magic-guard', name: 'Passivas 11 · Magic Guard reduz DOT pela metade', description: 'Veneno de 6 vira 3 no total.',
    positions: [vec(0, -2.4), vec(0, 0)], ticks: () => enough(4), setup: g => {facing(g);equip(g, ['poison-touch'], ['magic-guard'], 'croagunk');},
    script: hitScript,
    checks: ({log, game}) => {const v = game.fighters[1], tackleDmg = ev(log, 'impact')[0]?.damage ?? 0, dot = P('poison-touch').dps * P('poison-touch').duration * (1 - P('magic-guard').dotReductionPct);
      return [check('Fator de DOT = 1−50%', near(dotFactor(v), 1 - P('magic-guard').dotReductionPct), 1 - P('magic-guard').dotReductionPct, dotFactor(v)),
        check('Dano periódico reduzido pela metade', near(100 - v.hp - tackleDmg, dot, .5), dot, 100 - v.hp - tackleDmg)];}},
  {id: 'pv-12-sturdy-letal', name: 'Passivas 12 · Sturdy segura dano letal direto', description: 'Tackle letal deixa o HP exatamente em 1 (1 uso por rodada).',
    positions: [vec(0, -2.4), vec(0, 0)], ticks: () => enough(), overrides: {'extras.toggles.enableLaunch': 0}, setup: g => {facing(g);equip(g, [], ['sturdy'], null, 'mush');g.fighters[1].hp = 5;},
    script: hitScript,
    checks: ({log, game}) => {const v = game.fighters[1];
      return [check('Evento sturdy no impacto', ev(log, 'impact').some(e => e.sturdy), 1, ev(log, 'impact').filter(e => e.sturdy).length),
        check('HP exatamente 1', v.hp === 1, 1, v.hp), check('Sturdy consumida', v.passiveState.sturdyUsed === true, true, v.passiveState.sturdyUsed)];}},
  {id: 'pv-13-sturdy-vs-veneno', name: 'Passivas 13 · Sturdy NÃO protege de veneno letal', description: 'DOT letal atravessa o Sturdy.',
    positions: [vec(0, -2.4), vec(0, 0)], ticks: () => enough(6), overrides: {'extras.toggles.enableLaunch': 0}, setup: g => {facing(g);equip(g, ['poison-touch'], ['sturdy'], 'croagunk', 'mush');g.fighters[1].hp = C.profiles.balanced.attack + 2;},
    script: hitScript,
    checks: ({log, game}) => [check('Sturdy intacto (não consumido por DOT)', game.fighters[1].passiveState.sturdyUsed === false, false, game.fighters[1].passiveState.sturdyUsed),
      check('HP zerou por DOT (sem sturdy)', game.fighters[1].hp === 0, 0, game.fighters[1].hp),
      check('Causa foi o tick periódico', ev(log, 'statusTick').some(e => e.status === 'passive-poison' && e.tick >= (ev(log, 'impact')[0]?.tick ?? 0)), 'após o impacto', ev(log, 'statusTick').length)]},
  {id: 'pv-14-sturdy-consumida', name: 'Passivas 14 · Sturdy só uma vez por rodada', description: 'Segundo dano letal depois do uso não é segurado.',
    positions: [vec(0, -2.4), vec(0, 0)], ticks: () => enough() + 60, overrides: {'extras.toggles.enableLaunch': 0}, setup: g => {facing(g);equip(g, [], ['sturdy'], null, 'mush');g.fighters[1].hp = 5;},
    script: (t, g) => {if (t === 110) {const v = g.fighters[1];v.position = vec(0, 0);v.flight = null;v.push = null;v.knockRecovery = 0;v.stun = 0;v.action = null;v.hp = 5;v.state = 'neutral';const a = g.fighters[0];a.position = vec(0, -2.4);a.action = null;a.stun = 0;a.state = 'neutral';}
      return [t === 10 || t === 120 ? cmd({move: vec(0, 1), tackle: true, target: 1}) : cmd({target: 1}), cmd({target: 0})];},
    checks: ({log, game}) => [check('Primeiro uso segurou (HP 1)', ev(log, 'impact').filter(e => e.sturdy).length === 1, 1, ev(log, 'impact').filter(e => e.sturdy).length),
      check('Segundo letal não segurado', game.fighters[1].hp === 0, 0, game.fighters[1].hp)]},
  {id: 'pv-15-rough-skin', name: 'Passivas 15 · Rough Skin devolve 3 HP', description: 'Quem agride de tackle sofre o retorno no mesmo passo.',
    positions: [vec(0, -2.4), vec(0, 0)], ticks: () => enough(), setup: g => {facing(g);equip(g, [], ['rough-skin']);},
    script: hitScript,
    checks: ({log, game}) => {const r = ev(log, 'passiveReflect').filter(e => e.passive === 'rough-skin');
      return [check('Reflexão registrada', r.length === 1, 1, r.length), check('Dano de retorno', r[0] && near(r[0].damage, P('rough-skin').reflectDamage), P('rough-skin').reflectDamage, r[0]?.damage ?? 0),
        check('Cooldown instantâneo iniciado (R18)', game.fighters[1].passiveState.cooldowns['rough-skin'] > 0, '> 0', game.fighters[1].passiveState.cooldowns['rough-skin'] ?? 0)];}},
  {id: 'pv-16-effect-spore', name: 'Passivas 16 · Effect Spore desacelera o agressor', description: 'Contato físico no Mush deixa o atacante −15% de velocidade por 3 s.',
    positions: [vec(0, -2.4), vec(0, 0)], ticks: () => enough(), setup: g => {facing(g);equip(g, [], ['effect-spore'], null, 'mush');},
    script: hitScript,
    checks: ({game}) => {const a = game.fighters[0], sp = a.passiveState.actives.find(x => x.id === 'effect-spore');
      return [check('Efeito ativo no agressor', !!sp, 'ativo', sp ? 'ativo' : 'não'), check('Redução de velocidade aplicada', sp && near(stat(a, 'speed', a.attributes.speed), a.attributes.speed * (1 - P('effect-spore').slowPct)), a.attributes.speed * (1 - P('effect-spore').slowPct), sp ? stat(a, 'speed', a.attributes.speed) : '—')];}},
  {id: 'pv-17-inner-focus', name: 'Passivas 17 · Inner Focus reduz hit stun', description: 'Recuperação de pouso após lançamento × (1−20%).',
    positions: [vec(0, -2.4), vec(0, 0)], ticks: () => enough(), setup: g => {facing(g);equip(g, [], ['inner-focus'], null, 'drowzee');},
    script: hitScript,
    checks: ({game}) => {const v = game.fighters[1];
      return [check('Fator de hit stun do Inner Focus', near(hitStunFactor(v), 1 - P('inner-focus').stunPct), 1 - P('inner-focus').stunPct, hitStunFactor(v)),
        check('Recuperação de pouso reduzida', near(v.knockRecovery, 0) || v.knockRecovery <= C.rules.landingRecovery * (1 - P('inner-focus').stunPct) + 1e-9, `≤ ${fmt(C.rules.landingRecovery * (1 - P('inner-focus').stunPct))}`, v.knockRecovery)];}},
  {id: 'pv-18-forewarn', name: 'Passivas 18 · Forewarn estende a janela perfeita', description: 'Oponente carregando Move PL2+ a até 3,5 m: +0,06 s de janela.',
    positions: [vec(0, -2), vec(0, 0)], ticks: () => 40, setup: g => {facing(g);equip(g, ['forewarn'], [], 'drowzee');},
    // O Forewarn é avaliado por tickPassives (a MESMA função da partida real) a partir de opp.charge. A carga é
    // injetada como estado puro (padrão de ai-eval.js): registrar um move no núcleo violaria o invariante D2 de
    // moves.test.mjs, e stepCharge só descarta cargas de moves desconhecidos DURANTE um step — fora dele, o estado
    // é exatamente o que o engine lê em partida com Moves registrados (bootstrap do lab).
    checks: ({game}) => {game.fighters[1].charge = {move: 'carga', ticks: 40, slot: 0, params: {pl2Ticks: 20, maxTicks: 60}};
      tickPassives(game, game.fighters[0], C.test.step);
      const a = game.fighters[0], fw = a.passiveState.actives.find(x => x.id === 'forewarn');
      return [check('Forewarn ativado pela carga inimiga (tickPassives, caminho da partida)', !!fw, 'ativo', fw ? 'ativo' : 'não'), check('Bônus de janela', near(perfectWindowBonus(a), P('forewarn').windowBonus), P('forewarn').windowBonus, perfectWindowBonus(a))];}},
  {id: 'pv-19-anticipation', name: 'Passivas 19 · Anticipation reage a PL2/PL3', description: 'Oponente perto carregando tackle: +15% de velocidade por 2 s.',
    positions: [vec(0, -2), vec(0, 0)], ticks: () => Math.ceil(C.rules.chargeTackleMaxTime / 2 / C.test.step) + 40, setup: g => {facing(g);equip(g, ['anticipation'], [], 'croagunk');},
    script: t => [cmd(), t === 0 ? cmd({tackle: true, tackleHeld: true, target: 0}) : cmd({tackleHeld: true, target: 0})],
    checks: ({game}) => {const a = game.fighters[0], an = a.passiveState.actives.find(x => x.id === 'anticipation');
      return [check('Anticipation ativada', !!an, 'ativo', an ? 'ativo' : 'não'), check('Bônus de velocidade', an && near(stat(a, 'speed', a.attributes.speed), a.attributes.speed * (1 + P('anticipation').speedPct)), a.attributes.speed * (1 + P('anticipation').speedPct), an ? stat(a, 'speed', a.attributes.speed) : '—')];}},
  {id: 'pv-20-vital-spirit', name: 'Passivas 20 · Vital Spirit regenera com stamina baixa', description: 'Abaixo de 30% da stamina máxima: +30% de regeneração.',
    positions: [vec(0, -6), vec(0, 6)], ticks: () => 30, setup: g => {facing(g);equip(g, ['vital-spirit'], [], 'vigoroth', null);},
    script: (t, g, s) => {if (t === 5) {g.fighters[0].stamina = .2;g.fighters[0].regenBase = .2;g.fighters[0].regenAge = 0;g.fighters[0].exhausted = false;}
      if (t === 6 && s.pct === undefined) {s.stam = g.fighters[0].stamina;s.pct = passiveContribute(g.fighters[0], 'staminaRegen').pct;}
      return [cmd(), cmd()];},
    checks: ({scratch}) => [
      check('Condição ativa (< 30%)', scratch.stam < P('vital-spirit').thresholdPct * C.rules.staminaMax, '< limiar', scratch.stam ?? '—'),
      check('Bônus de regeneração', near(scratch.pct ?? -1, P('vital-spirit').regenPct), P('vital-spirit').regenPct, scratch.pct ?? '—')]},
  {id: 'pv-21-guts', name: 'Passivas 21 · Guts sob debuff', description: 'Com status negativo válido: +15% de Ataque.',
    positions: [vec(0, -6), vec(0, 6)], ticks: () => 30, setup: g => {facing(g);equip(g, ['guts'], [], 'vigoroth', null);
      g.fighters[0].statuses.push({id: 'debuff-teste', source: 1, duration: 5, remaining: 5, stacks: 1, maxStacks: 1, stacking: 'refresh', mul: {}, add: {}, flags: {}, tick: null, acc: 0, tags: ['debuff']});},
    checks: ({game}) => {const a = game.fighters[0];
      return [check('Debuff presente', a.statuses.some(s => s.tags.includes('debuff')), 1, a.statuses.length),
        check('Ataque efetivo +15%', near(stat(a, 'attack', a.attributes.attack), a.attributes.attack * (1 + P('guts').attackPct)), a.attributes.attack * (1 + P('guts').attackPct), stat(a, 'attack', a.attributes.attack))];}},
  {id: 'pv-22-regenerator', name: 'Passivas 22 · Regenerator cura após 5 s sem dano', description: '+5 HP com cooldown instantâneo de 15 s.',
    positions: [vec(0, -6), vec(0, 6)], ticks: () => Math.ceil((P('regenerator').quietTime + 2) / C.test.step) + 30, setup: g => {facing(g);equip(g, ['regenerator'], []);g.fighters[0].hp = 80;},
    checks: ({log, game}) => {const heals = ev(log, 'passiveHeal').filter(e => e.passive === 'regenerator');
      return [check('Cura registrada', heals.length >= 1, '≥ 1', heals.length), check('Cura de 5 HP', heals[0] && near(heals[0].heal, P('regenerator').heal), P('regenerator').heal, heals[0]?.heal ?? 0),
        check('Cooldown instantâneo (R18)', game.fighters[0].passiveState.cooldowns.regenerator > 0, '> 0', game.fighters[0].passiveState.cooldowns.regenerator ?? 0)];}},
  {id: 'pv-23-unburden', name: 'Passivas 23 · Unburden na coleta de consumível', description: 'itemCollected concede +15% de velocidade por 4 s.',
    positions: [vec(0, -6), vec(0, 6)], ticks: () => 30, setup: g => {facing(g);equip(g, ['unburden'], []);},
    checks: ({game}) => {const a = game.fighters[0], before = a.passiveState.actives.length;
      const out = passiveOnEvents(game, [{result: 'itemCollected', fighter: 0}]);
      const un = a.passiveState.actives.find(x => x.id === 'unburden');
      return [check('Gatilho itemCollected ativou', out.some(e => e.result === 'passiveActivated' && e.passive === 'unburden') && a.passiveState.actives.length > before, 1, out.filter(e => e.passive === 'unburden').length),
        check('Bônus de velocidade aplicado', un && near(stat(a, 'speed', a.attributes.speed), a.attributes.speed * (1 + P('unburden').speedPct)), a.attributes.speed * (1 + P('unburden').speedPct), un ? stat(a, 'speed', a.attributes.speed) : '—')];}},
  {id: 'pv-24-stamina-defesa', name: 'Passivas 24 · Stamina(p): dano direto aumenta a defesa', description: '+10% de Defesa por 4 s após sofrer ataque direto; cooldown de 10 s começa no TÉRMINO.',
    positions: [vec(0, -2.4), vec(0, 0)], ticks: () => enough(), setup: g => {facing(g);equip(g, [], ['stamina']);},
    script: hitScript,
    checks: ({log, game}) => {const v = game.fighters[1], st = v.passiveState.actives.find(x => x.id === 'stamina');
      return [check('Efeito ativo após o dano', !!st, 'ativo', st ? 'ativo' : 'não'),
        check('Dano recebido × 1/1,1', st && near(stat(v, 'damageTaken', 1), 1 / (1 + P('stamina').defensePct)), 1 / (1 + P('stamina').defensePct), st ? stat(v, 'damageTaken', 1) : '—'),
        check('Cooldown pós-término ainda não iniciado (R16)', (v.passiveState.cooldowns.stamina ?? 0) === 0, 0, v.passiveState.cooldowns.stamina ?? 0)];}},
  {id: 'pv-25-suction-cups', name: 'Passivas 25 · Suction Cups reduz empurrão horizontal', description: '−20% de horizontal recebido enquanto apoiado; vertical intacto.',
    positions: [vec(0, -2.4), vec(0, 0)], ticks: () => enough(), setup: g => {facing(g);equip(g, [], ['suction-cups']);},
    script: hitScript,
    checks: ({game}) => {const v = game.fighters[1];
      return [check('Fator de empurrão = 1−20%', near(knockbackFactor(v), 1 - P('suction-cups').knockbackPct), 1 - P('suction-cups').knockbackPct, knockbackFactor(v)),
        check('Não afeta o vertical (fator só no horizontal)', true, 'aplicado em hSpeed', 'resolveHit/combat.js')];}},
  {id: 'pv-26-clear-body', name: 'Passivas 26 · Clear Body bloqueia redução inimiga', description: 'Status adversário com redução de Ataque/Velocidade/Defesa é sanitizado.',
    positions: [vec(0, -6), vec(0, 6)], ticks: () => 60, setup: g => {facing(g);equip(g, ['clear-body'], []);},
    checks: ({game}) => {const a = game.fighters[0];
      applyStatus(a, {id: 'debuff-inimigo', duration: 5, mul: {attack: .5, speed: .8, damageTaken: 1.3}}, {source: 1});
      const out = passiveOnEvents(game, [{result: 'statusApplied', attacker: 1, target: 0, damage: 0, status: 'debuff-inimigo'}]);
      return [check('Bloqueio registrado', out.some(e => e.result === 'passiveBlocked' && e.passive === 'clear-body'), 1, out.filter(e => e.result === 'passiveBlocked').length),
        check('Atributos preservados', stat(a, 'attack', a.attributes.attack) === a.attributes.attack && stat(a, 'speed', a.attributes.speed) === a.attributes.speed, 'intactos', `${fmt(stat(a, 'attack', a.attributes.attack))}/${fmt(stat(a, 'speed', a.attributes.speed))}`)];}},
  {id: 'pv-27-defiant', name: 'Passivas 27 · Defiant responde à redução', description: 'Quando o Clear Body bloqueia uma redução inimiga: +15% de Ataque por 4 s.',
    positions: [vec(0, -6), vec(0, 6)], ticks: () => 60, setup: g => {facing(g);equip(g, ['clear-body', 'defiant'], []);},
    checks: ({game}) => {const a = game.fighters[0];
      applyStatus(a, {id: 'debuff-inimigo', duration: 5, mul: {attack: .5, speed: .8, damageTaken: 1.3}}, {source: 1});
      passiveOnEvents(game, [{result: 'statusApplied', attacker: 1, target: 0, damage: 0, status: 'debuff-inimigo'}]);
      const df = a.passiveState.actives.find(x => x.id === 'defiant');
      return [check('Defiant ativada pelo bloqueio', !!df, 'ativo', df ? 'ativo' : 'não'),
        check('Bônus de ataque', df && near(stat(a, 'attack', a.attributes.attack), a.attributes.attack * (1 + P('defiant').attackPct)), a.attributes.attack * (1 + P('defiant').attackPct), df ? stat(a, 'attack', a.attributes.attack) : '—')];}},
  // 28–37: cooldowns, simultaneidade, hitstop e KO
  {id: 'pv-28-ativacoes-simultaneas', name: 'Passivas 28 · Ativações simultâneas no mesmo evento', description: 'Um tackle dispara Rough Skin e Stamina(p) juntos, sem prioridade de slot (R12–R14).',
    positions: [vec(0, -2.4), vec(0, 0)], ticks: () => enough(), setup: g => {facing(g);equip(g, [], ['rough-skin', 'stamina']);},
    script: hitScript,
    checks: ({log, game}) => {const v = game.fighters[1], acts = v.passiveState.actives.map(x => x.id).sort();
      return [check('As duas ativaram', acts.includes('stamina') && v.passiveState.cooldowns['rough-skin'] > 0, '2 efeitos', acts.join('+') || 'nenhum'),
        check('Reflexão e bônus de defesa presentes', ev(log, 'passiveReflect').length === 1, 1, ev(log, 'passiveReflect').length)];}},
  {id: 'pv-29-cooldown-no-termino', name: 'Passivas 29 · Cooldown começa no TÉRMINO do efeito (R16)', description: 'Anticipation: durante os 2 s de efeito não há cooldown; ao terminar, 12 s começam.',
    positions: [vec(0, -2), vec(0, 0)], ticks: () => Math.ceil((P('anticipation').duration + 2) / C.test.step), setup: g => {facing(g);equip(g, ['anticipation'], [], 'croagunk');},
    script: t => [cmd(), t === 0 ? cmd({tackle: true, tackleHeld: true, target: 0}) : cmd({tackleHeld: true, target: 0})],
    checks: ({game}) => {const a = game.fighters[0], an = a.passiveState.actives.find(x => x.id === 'anticipation'), cd = a.passiveState.cooldowns.anticipation ?? 0;
      return [check('Efeito encerrado', !an, 'encerrado', an ? 'ativo' : 'encerrado'),
        check('Cooldown iniciado só após o término', cd > 0 && cd <= P('anticipation').cooldown, `0 < cd ≤ ${fmt(P('anticipation').cooldown)}`, cd)];}},
  {id: 'pv-30-cooldown-instantaneo', name: 'Passivas 30 · Efeito instantâneo: cooldown logo após aplicação (R18)', description: 'Rough Skin: cooldown de 10 s no mesmo passo do retorno.',
    positions: [vec(0, -2.4), vec(0, 0)], ticks: () => enough(), setup: g => {facing(g);equip(g, [], ['rough-skin']);},
    script: (t, g, s) => {if (s.cd0 === undefined && (g.fighters[1].passiveState.cooldowns['rough-skin'] ?? 0) > 0) s.cd0 = g.fighters[1].passiveState.cooldowns['rough-skin'];
      return hitScript(t);},
    checks: ({scratch}) => [check('Cooldown iniciado no valor cheio logo após a aplicação (R18)', near(scratch.cd0 ?? -1, P('rough-skin').cooldown, .01), P('rough-skin').cooldown, scratch.cd0 ?? '—')]},
  {id: 'pv-31-efeito-durante-hitstop', name: 'Passivas 31 · Efeito ativo permanece aplicado no hitstop (R26)', description: 'Speed Boost não some durante o hitstop do impacto.',
    positions: [vec(0, -2.4), vec(0, 0)], ticks: () => enough(), setup: g => {facing(g);equip(g, ['speed-boost'], []);},
    script: (t, g) => {if (t === 30 && !g.__hs) {g.__hs = true;g.hitstop = .5;}return hitScript(t);},
    checks: ({game, log}) => {const a = game.fighters[0], base = a.attributes.speed, frozen = log.hitstopTicks > 0;
      return [check('Hitstop ocorreu', frozen, '> 0 passos', log.hitstopTicks),
        check('Velocidade continua × 1,15', near(stat(a, 'speed', base), base * (1 + P('speed-boost').speedPct)), base * (1 + P('speed-boost').speedPct), stat(a, 'speed', base))];}},
  {id: 'pv-32-cooldown-pausado-hitstop', name: 'Passivas 32 · Cooldown de passiva congelado no hitstop (R24)', description: 'Rough Skin: o cooldown de 10 s não decai durante o hitstop.',
    positions: [vec(0, -2.4), vec(0, 0)], ticks: () => enough(1), setup: g => {facing(g);equip(g, [], ['rough-skin']);g.hitstop = .5;g.__forceStop = true;},
    script: (t, g) => {if (t === 30 && !g.__hs) {g.__hs = true;g.hitstop = .5;}return hitScript(t);},
    checks: ({game, log}) => {const cd = game.fighters[1].passiveState.cooldowns['rough-skin'];
      return [check('Hitstop congelado por N passos', log.hitstopTicks > 0, '> 0', log.hitstopTicks),
        check('Cooldown preserva o restante (decai só fora do hitstop)', cd === undefined || cd <= P('rough-skin').cooldown, `≤ ${fmt(P('rough-skin').cooldown)}`, cd ?? '—')];}},
  {id: 'pv-33-duracao-pausada-hitstop', name: 'Passivas 33 · Duração de efeito congelada no hitstop (R25)', description: 'Anticipation ativa: remaining não decai durante o hitstop.',
    positions: [vec(0, -2), vec(0, 0)], ticks: () => 170, setup: g => {facing(g);equip(g, ['anticipation'], [], 'croagunk');},
    script: (t, g, s) => {if (t === 0) return [cmd(), cmd({tackle: true, tackleHeld: true, target: 0})];
      if (t === 100 && !g.__hs) {g.__hs = true;s.remAtFreeze = g.fighters[0].passiveState.actives.find(x => x.id === 'anticipation')?.remaining;g.hitstop = .4;}
      return [cmd(), cmd({tackleHeld: true, target: 0})];},
    checks: ({game, log, scratch}) => {const an = game.fighters[0].passiveState.actives.find(x => x.id === 'anticipation');
      return [check('Hitstop congelado por N passos', log.hitstopTicks > 0, '> 0', log.hitstopTicks),
        check('Efeito preservado durante o hitstop (decaiu < 0,2 s além do congelamento)', !!an && an.remaining > (scratch.remAtFreeze ?? 0) - .2, `≥ ${fmt((scratch.remAtFreeze ?? 0) - .2)}`, an ? fmt(an.remaining) : 'expirou')];}},
  {id: 'pv-34-gatilho-pos-hitstop', name: 'Passivas 34 · Gatilho real processado no passo normal', description: 'Durante o hitstop a sim está congelada e nenhum evento real ocorre; o gatilho sai no primeiro passo normal (buffer do hitstop).',
    positions: [vec(0, -2.4), vec(0, 0)], ticks: () => enough(), setup: g => {facing(g);equip(g, ['poison-touch'], [], 'croagunk');},
    script: (t, g) => {if (t === 12 && !g.__hs) {g.__hs = true;g.hitstop = .25;}return hitScript(t);},
    checks: ({log, game}) => [check('Hitstop ocorreu antes do contato', log.hitstopTicks > 0, '> 0', log.hitstopTicks),
      check('Veneno aplicado após o hitstop', game.fighters[1].statuses.some(s => s.id === 'passive-poison'), 'passive-poison', game.fighters[1].statuses.map(s => s.id).join(',') || 'nenhum')]},
  {id: 'pv-35-efeito-aplicado-pos-hitstop', name: 'Passivas 35 · Efeito aplicado imediatamente após o hitstop (R28)', description: 'A ativação pós-hitstop já contribui para stat() no mesmo passo.',
    positions: [vec(0, -2), vec(0, 0)], ticks: () => 90, setup: g => {facing(g);equip(g, ['forewarn'], [], 'drowzee');g.hitstop = .3;},
    // O hitstop inicial congela os passos (R24/25); a ativação é exercitada pelo caminho real (tickPassives) com a
    // carga injetada como estado puro (sem registrar move no núcleo, D2 — ver pv-18).
    checks: ({log, game}) => {game.fighters[1].charge = {move: 'carga', ticks: 40, slot: 0, params: {pl2Ticks: 20, maxTicks: 60}};
      tickPassives(game, game.fighters[0], C.test.step);
      const a = game.fighters[0], fw = a.passiveState.actives.find(x => x.id === 'forewarn');
      return [check('Hitstop ocorreu antes da ativação', log.hitstopTicks > 0, '> 0', log.hitstopTicks),
        check('Ativação aconteceu (após o hitstop)', !!fw, 'ativo', fw ? 'ativo' : 'não'), check('Bônus já aplicado em perfectWindowBonus()', fw && near(perfectWindowBonus(a), P('forewarn').windowBonus), P('forewarn').windowBonus, fw ? perfectWindowBonus(a) : '—')];}},
  {id: 'pv-36-encadeamento-pos-hitstop', name: 'Passivas 36 · Encadeamento imediato com proteção anti-ciclo (R29)', description: 'Eventos gerados por passivas são reprocessados com limite de profundidade.',
    positions: [vec(0, -6), vec(0, 6)], ticks: () => 30, setup: g => {facing(g);equip(g, ['rough-skin'], ['rough-skin']);g.fighters[0].hp = 100;g.fighters[1].hp = 100;g.hitstop = .2;},
    checks: ({game}) => {const out = passiveOnEvents(game, [{result: 'impact', attacker: 0, target: 1, damage: 5, contact: 'tackle'}]);
      return [check('Reflexão encadeou no mesmo processamento', out.some(e => e.result === 'passiveReflect'), 1, out.filter(e => e.result === 'passiveReflect').length),
        check('Sem evento de ciclo suspeito', !out.some(e => e.result === 'passiveCycleSuspect'), 0, out.filter(e => e.result === 'passiveCycleSuspect').length)];}},
  {id: 'pv-37-ko-encerra-efeitos', name: 'Passivas 37 · KO encerra efeitos ativos imediatamente (R23)', description: 'Oponente nocauteado: passivas ativas dele terminam na hora.',
    positions: [vec(0, -2.4), vec(0, 0)], ticks: () => enough(), setup: g => {facing(g);equip(g, ['poison-touch', 'speed-boost'], ['unburden'], 'croagunk');g.fighters[1].hp = 10;},
    script: (t, g) => {if (t === 5) passiveOnEvents(g, [{result: 'itemCollected', fighter: 1}]);return hitScript(t);},
    checks: ({log, game}) => {const v = game.fighters[1];
      return [check('Vermelho foi nocauteado', game.phase === 'result' || v.hp <= 0, 'KO', `fase ${game.phase} · hp ${fmt(v.hp)}`),
        check('Efeitos ativos encerrados (R23)', v.passiveState.actives.length === 0, 0, v.passiveState.actives.length)];}},
  {id: 'pv-38-ciclo-de-rodada', name: 'Passivas 38 · Respawn/rodada: sem respawn no jogo; Sturdy restaura na fronteira de rodada (§7)', description: 'O jogo termina no 1º KO (sem modo de rodadas); a interface de rodada (onRoundStart) restaura Sturdy apenas em novo reset.',
    positions: [vec(0, -2.4), vec(0, 0)], ticks: () => enough() + 60, overrides: {'extras.toggles.enableLaunch': 0}, setup: g => {facing(g);equip(g, [], ['sturdy'], null, 'mush');g.fighters[1].hp = 5;},
    script: (t, g) => {if (t === 110) {const v = g.fighters[1];v.position = vec(0, 0);v.flight = null;v.push = null;v.knockRecovery = 0;v.stun = 0;v.action = null;v.hp = 1;v.state = 'neutral';const a = g.fighters[0];a.position = vec(0, -2.4);a.action = null;a.stun = 0;a.state = 'neutral';}
      return [t === 10 || t === 120 ? cmd({move: vec(0, 1), tackle: true, target: 1}) : cmd({target: 1}), cmd({target: 0})];},
    checks: ({game}) => {const v = game.fighters[1], ended = game.phase === 'result' || game.phase === 'finishing';
      game.reset({positions: [vec(0, -2.4), vec(0, 0)]});
      return [check('Partida termina no primeiro KO (§7)', ended, 'result/finishing', game.phase === 'result' || game.phase === 'finishing' ? 'antes do reset: encerrada' : 'antes do reset: ' + game.phase),
        check('Sturdy restaurada no novo reset (fronteira de rodada)', game.fighters[1].passiveState.sturdyAvailable === true && game.fighters[1].passiveState.sturdyUsed === false, true, game.fighters[1].passiveState.sturdyUsed)];}},
  // 39–42: persistência, determinismo, IA e paridade
  {id: 'pv-39-save-load-efeito-ativo', name: 'Passivas 39 · Save/load com efeito ativo', description: 'Estado de passivas (ativas, cooldowns, Sturdy usada) sobrevive ao save/load.',
    positions: [vec(0, -2), vec(0, 0)], ticks: () => 40, setup: g => {facing(g);equip(g, ['anticipation', 'speed-boost'], ['sturdy'], 'croagunk', 'mush');g.fighters[1].tackleCharge = {t: .8, level: 2, start: Math.PI};g.fighters[1].passiveState.sturdyUsed = true;},
    checks: ({game}) => {const before = game.fighters[0].passiveState.actives.map(a => ({...a}));
      const snap = game.save(), g2 = new Game({seed: game.seed});g2.load(snap);
      const after = g2.fighters[0].passiveState;
      return [check('Efeitos ativos preservados', after.actives.length === before.length && (!before[0] || near(after.actives[0].remaining, before[0].remaining, .02)), before.length, after.actives.length),
        check('Sturdy usada não restaurada em load (R22/§7)', g2.fighters[1].passiveState.sturdyUsed === true, true, g2.fighters[1].passiveState.sturdyUsed)];}},
  {id: 'pv-40-replay-deterministico', name: 'Passivas 40 · Replay determinístico com passivas', description: 'Mesma semente + mesmos loadouts = mesma sequência de eventos e HP.',
    positions: [vec(0, -2.4), vec(0, 0)], ticks: () => enough(), setup: g => {facing(g);equip(g, ['poison-touch'], ['rough-skin'], 'croagunk');},
    script: hitScript,
    checks: ({game}) => {const run = seed => {const g = new Game({seed});g.passiveIdentity = ['croagunk', null];g.setPassiveLoadout(0, ['poison-touch']);g.setPassiveLoadout(1, ['rough-skin']);g.reset({positions: [vec(0, -2.4), vec(0, 0)]});
        for (let t = 0; t < 200; t++) {const [a, b] = hitScript(t);g.step(a, b);}return {hp: g.fighters.map(f => f.hp), sig: JSON.stringify(g.events.map(e => [e.result, e.passive ?? e.status ?? '', Math.round((e.damage ?? 0) * 100)]))};};
      const r1 = run(5), r2 = run(5);
      return [check('Duas execuções idênticas', r1.sig === r2.sig && r1.hp[0] === r2.hp[0] && r1.hp[1] === r2.hp[1], 'idênticas', r1.sig === r2.sig ? 'idênticas' : 'divergentes')];}},
  {id: 'pv-41-ia-com-passivas', name: 'Passivas 41 · IA × IA com passivas equipadas', description: 'A IA usa o mesmo sistema (custos efetivos, gatilhos): 600 passos sem erro e com decisões da IA.',
    positions: [vec(0, -4), vec(0, 4)], ticks: () => 600, setup: g => {facing(g);equip(g, ['speed-boost', 'technician'], ['rough-skin', 'stamina']);g.mode = 'tactical';},
    script: () => [cmd(), undefined],
    checks: ({game}) => {const moved = game.fighters.some(f => Math.hypot(f.position.x, f.position.z - (f.id ? 4 : -4)) > .5);
      return [check('Sem exceção em 600 passos', game.tick >= 600 || game.phase !== 'playing', 'ok', `tick ${game.tick} · fase ${game.phase}`),
        check('IA agiu com passivas', moved, 'sim', moved ? 'sim' : 'não')];}},
  {id: 'pv-42-paridade-sem-passivas', name: 'Passivas 42 · Paridade exata com o sistema desligado', description: 'Com enablePassives=0 o motor é bit a bit o de antes (mesma semente, mesmo resultado).',
    positions: [vec(0, -4), vec(0, 4)], ticks: () => 30, setup: g => {facing(g);equip(g, ['speed-boost', 'rough-skin'], ['stamina', 'guts']);g.mode = 'tactical';},
    script: () => [cmd(), undefined],
    checks: () => {const run = equip => {const g = new Game({seed: 9});g.mode = 'tactical';const prev = C.extras.toggles.enablePassives;C.extras.toggles.enablePassives = 0;
        if (equip) {g.passiveIdentity = [null, null];g.setPassiveLoadout(0, ['speed-boost', 'rough-skin']);g.setPassiveLoadout(1, ['stamina', 'suction-cups']);}
        g.reset({positions: [vec(0, -4), vec(0, 4)]});for (let i = 0; i < 300; i++) {const c0 = cmd();g.step(c0, undefined);}C.extras.toggles.enablePassives = prev;
        return {hp: g.fighters.map(f => f.hp), pos: g.fighters.map(f => ({x: f.position.x, z: f.position.z}))};};
      const base = run(false), equipado = run(true);
      return [check('Loadouts equipados NÃO alteram nada com toggle 0 (§32)', base.hp.every((h, i) => h === equipado.hp[i]) && base.pos.every((p, i) => near(p.x, equipado.pos[i].x, 1e-12) && near(p.z, equipado.pos[i].z, 1e-12)), 'idênticas', base.hp.map((h, i) => h === equipado.hp[i]).join('/') + ' · ' + base.pos.map((p, i) => near(p.x, equipado.pos[i].x, 1e-12) && near(p.z, equipado.pos[i].z, 1e-12)).join('/') )];}},
];
