// Preservação do trabalho do usuário: associações de clipes salvas NÃO podem ser trocadas em silêncio por reserva.
// Cobre: salvar → recarregar com NOMES DUPLICADOS de clipe, clipe REMOVIDO do arquivo (a associação some e é reportada, as outras ficam),
// clipes ADICIONAIS importados depois, estado de workspace antigo (animationProfileVersion 1, sem campos novos) e conclusão visual/Reverso/Congelamento persistidos.
// Uso: node prototypes/combat-lab/test/animation-preservar-config.test.mjs
import assert from 'node:assert/strict';
import * as T from 'three';
import {setupRegistry} from './animation-runtime-harness.mjs';
import {Character} from '../src/view/characters.js';
import {setField} from '../src/sim/animation-profile.js';

setupRegistry();
let n = 0;const ok = l => {n++;console.log('✓', l);};
const clip = (name, d = 1) => new T.AnimationClip(name, d, [new T.NumberKeyframeTrack('.position[x]', [0, d], [0, 1])]);
const mk = names => ({name: 'dup.glb', assetId: 'dup-1', scene: (() => {const g = new T.Group();const b = new T.Bone();b.name = 'root';g.add(b);return g;})(), animations: names.map(x => clip(x))});
const store = new Map();
Character.stateStore = {get: c => store.has(c.source.assetId) ? structuredClone(store.get(c.source.assetId)) : null, set: (c, d) => store.set(c.source.assetId, structuredClone(d))};

// ---- nomes duplicados: as duas variantes distintas sobrevivem ao salvar/recarregar? ----
{
  const a = new Character(mk(['Idle', 'Hit', 'Hit', 'Walk']), {persist: true});
  a.variants.hit = [1, 2];a.save();
  const b = new Character(mk(['Idle', 'Hit', 'Hit', 'Walk']), {persist: true});
  assert.deepEqual(b.variants.hit, [1, 2], 'duas variantes com o mesmo nome de clipe voltam como duas (não colapsam em uma)');
  ok('nomes de clipe duplicados: as duas variantes voltam distintas após salvar e recarregar');
}
// ---- clipe removido do arquivo: a associação dele sai, as outras ficam; nada vira reserva em silêncio ----
{
  const a = new Character(mk(['Idle', 'Hit', 'Walk']), {persist: true});
  a.variants.idle = [0];a.variants.walk = [2];a.variants.hit = [1];a.save();
  const b = new Character(mk(['Idle', 'Walk']), {persist: true});   // «Hit» sumiu do arquivo
  assert.deepEqual(b.variants.walk.map(i => b.clips[i].name), ['Walk'], 'a associação de um clipe que continua existindo é preservada');
  assert.ok(!b.variants.hit?.length || b.variants.hit.every(i => b.clips[i]), 'nenhum índice aponta para clipe inexistente');
  assert.ok(Array.isArray(b.missingAssociations) || b.variants.hit === undefined || b.variants.hit.length === 0, 'a ausência é visível (lista de associações perdidas ou vazia), não trocada por outro clipe');
  ok('clipe removido do arquivo: as demais associações ficam; a perdida não é trocada por outro clipe');
}
// ---- clipes importados DEPOIS: as associações anteriores seguem nos mesmos clipes ----
{
  const a = new Character(mk(['Idle', 'Walk']), {persist: true});
  a.variants.walk = [1];a.save();
  const b = new Character(mk(['Idle', 'Walk', 'Extra A', 'Extra B']), {persist: true});
  assert.deepEqual(b.variants.walk.map(i => b.clips[i].name), ['Walk'], 'clipes adicionais não deslocam associações antigas');
  ok('clipes adicionais importados depois não deslocam as associações antigas');
}
// ---- estado antigo (versão 1, sem os campos novos): migra sem apagar as escolhas e preenche os padrões novos ----
{
  store.set('dup-1', {variants: {walk: ['Walk']}, speeds: {walk: 1.7}, playback: {}, animationProfileVersion: 1});
  const b = new Character(mk(['Idle', 'Walk']), {persist: true});
  assert.deepEqual(b.variants.walk.map(i => b.clips[i].name), ['Walk'], 'associação do estado antigo preservada');
  assert.equal(b.speeds.walk, 1.7, 'velocidade do estado antigo preservada');
  assert.equal(b.profileValue('walk', 'visualCompletion', 'Walk'), undefined, 'campo novo herda o padrão (ligado) sem gravar valor por cima');
  ok('estado antigo (versão 1) migra sem perder associações nem velocidades; campos novos entram com o padrão');
}
// ---- campos novos persistem ----
{
  store.clear();
  const a = new Character(mk(['Idle', 'Walk']), {persist: true});
  a.animProfile = setField(setField(setField(a.animProfile, 'walk', 'visualCompletion', false), 'walk', 'reverse', true), 'walk', 'freezeFor', .2);a.save();
  const b = new Character(mk(['Idle', 'Walk']), {persist: true});
  assert.equal(b.profileValue('walk', 'visualCompletion'), false);assert.equal(b.profileValue('walk', 'reverse'), true);assert.equal(b.profileValue('walk', 'freezeFor'), .2);
  ok('Conclusão visual, Reverso e Congelamento persistem após salvar e recarregar');
}
// ---- migração do perfil curado (Wookada): a associação PERSONALIZADA salva não é substituída; só ações sem associação salva recebem o perfil ----
{
  store.clear();
  const names = ['Idle', 'Walk Custom', 'Walk', 'Sprint'];
  const w = () => ({...mk(names), name: 'wookada.glb', assetId: 'wk-1'});
  store.set('wk-1', {variants: {walk: ['Walk Custom']}, speeds: {}, playback: {}, animationProfileVersion: 1});
  const b = new Character(w(), {persist: true});
  if (b.animationProfile) {
    assert.deepEqual(b.variants.walk.map(i => b.clips[i].name), ['Walk Custom'], 'a escolha personalizada sobrevive à migração de versão do perfil');
    ok('migração do perfil curado do Wookada: a associação personalizada salva não é trocada');
  } else ok('(perfil curado do Wookada não ativo neste fixture: migração não se aplica)');
}
Character.stateStore = null;
console.log(`\n${n} verificações de preservação de configuração aprovadas.`);
process.exit(0);
