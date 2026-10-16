// Aba Moves: equipar Reflect e Psyshock, ajustar os parâmetros (valem só para os PRÓXIMOS usos, M28.4), emitir projéteis e explosões de teste
// na partida e rodar os cenários técnicos repetíveis (M28.3, M28.8). Valores marcados “provisório” são pontos de partida (M30.10), não decisões.
import {C, defaults} from '../sim/config.js';
import {spawn} from '../sim/world.js';
import {runMoveScenarios} from '../sim/scenarios-moves.js';
/** Escapa texto para HTML (local: importar o ajustador arrastaria o config.ts do jogo, que só o esbuild lê). */
const escape = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

const STANDARD = [['reflect', 'Reflect', 0], ['psyshock', 'Psyshock', 1]];
const sec = v => `${v.toFixed(2)} s`, pct = v => `${(v * 100).toFixed(0)}%`, num = v => v.toFixed(2), m = v => `${v.toFixed(2)} m`, deg = v => `${v.toFixed(0)}°`, ms = v => `${v.toFixed(2)} m/s`, x = v => `${v.toFixed(2)}×`, int = v => v.toFixed(0);
/** [grupo em C.world, chave, rótulo, descrição, min, max, passo, formato, aprovado?] — “aprovado” = valor decidido pelo diretor; o resto é provisório (M30.10). */
const PARAMS = [
  ['Carga (compartilhada)', [
    ['charge', 'moveSlow', 'Velocidade durante a carga', 'Fração da velocidade de caminhada enquanto carrega (M2.6).', .2, 1, .01, pct, true],
    ['charge', 'turnSlow', 'Giro durante a carga', 'Fração da velocidade de giro enquanto carrega (M11.7).', .2, 1, .01, pct, true],
    ['charge', 'dodgeCancelAfter', 'Esquiva cancela a carga após', 'Antes disso a esquiva é negada e a soltura dispara (M16.2).', 0, 1, .01, sec, true],
    ['charge', 'interruptCooldownFactor', 'Recarga após interrupção ou cancelamento', 'Fração da recarga normal aplicada quando a carga é interrompida (M7.3).', 0, 1, .01, pct, true],
    ['charge', 'recovery', 'Recuperação após soltar', 'Tempo sem Tackle nem novos Moves depois de materializar/disparar (M26s.8).', 0, 1, .01, sec, true],
    ['charge', 'bufferWindow', 'Comando guardado no fim da esquiva', 'Janela em que um Move pedido durante a esquiva fica guardado (M16.3).', 0, .5, .01, sec, true],
    ['charge', 'boostStaminaPerSecond', 'Custo da recarga acelerada', 'Stamina gasta por segundo de recarga encurtado por novo toque (M5.8).', 0, 3, .05, num, true],
    ['charge', 'boostStep', 'Recarga encurtada por toque', 'Segundos de recarga removidos por novo toque (M5.8).', .25, 4, .25, sec, true],
  ]],
  ['Reflect', [
    ['reflect', 'widthMin', 'Largura mínima', 'Múltiplo da largura lógica do personagem com carga mínima (M5.2, M30.4).', .5, 3, .05, x, true],
    ['reflect', 'widthMax', 'Largura máxima', 'Múltiplo da largura lógica com carga máxima (M5.2).', 1, 6, .05, x, true],
    ['reflect', 'heightMin', 'Altura mínima', 'Múltiplo da altura lógica com carga mínima (M5.3).', .5, 3, .05, x, true],
    ['reflect', 'heightMax', 'Altura máxima', 'Múltiplo da altura lógica com carga máxima (M5.3).', 1, 5, .05, x, true],
    ['reflect', 'thickness', 'Espessura', 'Espessura física do painel (M29.2: 0,10 m sugerido).', .02, .5, .01, m, true],
    ['reflect', 'gapFraction', 'Distância livre à frente', 'Fração da profundidade do personagem entre ele e a barreira (M26s.4).', 0, 2, .05, pct, true],
    ['reflect', 'durationBase', 'Duração base', 'Segundos de duração com carga zero; soma o tempo carregado (M4.2–M4.4).', 1, 10, .25, sec, true],
    ['reflect', 'tackleRecoil', 'Recuo do Tackle ao destruir', 'Fração do deslocamento nominal do Tackle (provisório, M30.10).', 0, .6, .01, pct, false],
    ['reflect', 'tackleStagger', 'Stagger do Tackle ao destruir', 'Tempo em stagger do atacante (M14.3).', 0, 1, .01, sec, true],
    ['reflect', 'tieTolerance', 'Tolerância de empate geométrico', 'Distância dentro da qual frente > borda > verso (M30.5; provisório).', 0, .05, .001, m, false],
    ['reflect', 'maxReflections', 'Limite de reflexões por passo', 'Salvaguarda contra ciclos degenerados (M17.2; provisório).', 1, 64, 1, int, false],
  ]],
  ['Psyshock', [
    ['psyshock', 'minStones', 'Pedras iniciais', 'Quantidade com carga mínima (M11.1).', 1, 8, 1, int, true],
    ['psyshock', 'maxStones', 'Pedras no máximo', 'Limite com a carga máxima (M11.2); o mundo comporta 64 entidades.', 1, 16, 1, int, true],
    ['psyshock', 'stoneSeconds', 'Segundos por pedra extra', 'Uma pedra a mais a cada tanto tempo de carga (M11.2).', .2, 2, .05, sec, true],
    ['psyshock', 'speedMin', 'Velocidade mínima', 'Sorteada por pedra (D4, M5.5).', 2, 30, .5, ms, true],
    ['psyshock', 'speedMax', 'Velocidade máxima', 'Sorteada por pedra (D4, M5.5).', 2, 30, .5, ms, true],
    ['psyshock', 'homingSeconds', 'Duração do homing', 'Só com alvo travado (M10.2).', 0, 1, .05, sec, true],
    ['psyshock', 'homingRate', 'Giro máximo do homing', 'Graus por segundo (M12.1).', 0, 720, 10, deg, true],
    ['psyshock', 'fanAngle', 'Leque sem alvo', 'Abertura total do leque discreto frontal (provisório, M30.10).', 0, 90, 1, deg, false],
    ['psyshock', 'searchRange', 'Alcance da busca de espaço', 'Quanto à frente procurar posições livres para as pedras (provisório).', 0, 8, .25, m, false],
    ['psyshock', 'damageFraction', 'Dano-base', 'Fração do Ataque do lançador gravada no disparo (M30.1).', .01, 1, .01, pct, true],
    ['psyshock', 'successiveFactor', 'Fator por acerto no mesmo alvo', 'Cada acerto seguinte da mesma execução causa este fator do anterior (M6.3).', .1, 1, .01, pct, true],
    ['psyshock', 'knockbackPerStone', 'Knockback por pedra', 'Empurrão horizontal por pedra (M26s.7).', 0, 2, .05, ms, true],
    ['psyshock', 'knockbackCap', 'Teto de knockback por alvo', 'Máximo acumulado por alvo em cada execução (M30.3).', 0, 3, .05, ms, true],
    ['psyshock', 'counterStagger', 'Counter Stagger', 'Stagger quando uma pedra de PL superior atinge o corpo do derrotado (M21.5).', 0, 1, .01, sec, true],
    ['psyshock', 'radius', 'Raio de colisão da pedra', 'Igual em todas as pedras (o tamanho visual varia sem efeito na física, M30.2).', .05, .5, .01, m, false],
  ]],
  ['Laser (emissor técnico)', [
    ['beam', 'length', 'Alcance do feixe', 'Comprimento total somando os segmentos refletidos (provisório).', 4, 40, 1, m, false],
    ['beam', 'maxSegments', 'Segmentos máximos', 'Salvaguarda contra reflexões em cadeia (M17.2); acima disso o feixe para e avisa uma vez.', 1, 16, 1, int, false],
    ['beam', 'interval', 'Intervalo entre danos', 'Tempo entre dois danos do feixe no mesmo alvo (provisório).', .05, 1, .05, sec, false],
    ['beam', 'damage', 'Dano por acerto', 'Dano de cada acerto do emissor técnico, antes do Ataque (provisório).', 0, 20, .5, num, false],
  ]],
];

/** Itens da avaliação jogável e visual dos Moves (M28.9: separada dos testes automáticos; decisão do diretor). */
export const MOVES_HOMOLOG = [
  'Reflect: segurar A carrega e a prévia (verde/vermelha) mostra onde a barreira nasce; soltar cria a barreira',
  'Reflect: o tamanho cresce com a carga e a duração (4 a 8 s) é legível; o piscar de fim de vida avisa a expiração',
  'Reflect: reflete projéteis pela frente e pelas bordas, deixa passar pelo verso, e a cor mostra o PL',
  'Reflect: o Tackle destrói a barreira com recuo e stagger; a explosão destrói e protege quem está atrás',
  'Psyshock: segurar S forma as pedras (3 + 1 a cada 0,8 s) e soltar dispara todas juntas',
  'Psyshock: com alvo travado as pedras miram partes diferentes do corpo; sem alvo saem em leque',
  'Carga: a lentidão de 25%, o cancelamento por defesa/esquiva e a recuperação de 0,25 s têm boa sensação',
  'HUD dos slots: o estado (pronto, carregando, recarga, recuperação, bloqueado) é claro e confiável',
  'IA: usa Reflect e Psyshock de forma convincente e sem trapacear',
  'Visual e VFX: anéis de impacto, cores de PL e avisos de falha são suficientes (ou o que falta)',
];
const HOMOLOG_KEY = 'arenamon-moves-homolog';
const loadHomolog = () => {try {return JSON.parse(localStorage.getItem(HOMOLOG_KEY) ?? '{}');} catch {return {};}};
const saveHomolog = h => {try {localStorage.setItem(HOMOLOG_KEY, JSON.stringify(h));} catch {/* sem armazenamento: a avaliação vale só nesta sessão */}};

export function createMovesPanel({$, game, download}) {
  const root = $('moves-panel');
  let results = null, homolog = loadHomolog();
  const equipped = id => ({reflect: game.fighters[id]?.loadout?.includes('reflect'), psyshock: game.fighters[id]?.loadout?.includes('psyshock')});
  function setEquip(id, kind, on) {
    const cur = equipped(id);cur[kind] = on;
    game.setLoadout(id, [cur.reflect ? 'reflect' : null, cur.psyshock ? 'psyshock' : null]);
  }
  function emitProjectile(pl) {
    if (game.phase !== 'playing') return false;
    const [b, r] = game.fighters, dx = b.position.x - r.position.x, dz = b.position.z - r.position.z, d = Math.hypot(dx, dz) || 1;
    spawn(game.world, {kind: 'projectile', owner: 1, pos: {x: r.position.x + dx / d * .9, z: r.position.z + dz / d * .9}, dir: {x: dx / d, z: dz / d}, speed: 12, y: .7, radius: .2, life: 4, pierce: 1, pl, clashable: true,
      hit: {damage: C.world.psyshock.damageFraction * r.attributes.attack, knockback: {horizontal: C.world.psyshock.knockbackPerStone, vertical: 0}}, captured: {attackFraction: C.world.psyshock.damageFraction, counterStagger: C.world.psyshock.counterStagger}}, game.lastStepEvents);
    return true;
  }
  /** Laser técnico do vermelho rumo ao azul (PL 1–3); `turn` (rad/s) faz o emissor varrer a arena. Vive 4 s. */
  function emitLaser(pl, turn = 0) {
    if (game.phase !== 'playing') return false;
    const [b, r] = game.fighters, dx = b.position.x - r.position.x, dz = b.position.z - r.position.z, d = Math.hypot(dx, dz) || 1;
    spawn(game.world, {kind: 'beam', owner: 1, pos: {x: r.position.x + dx / d * .7, z: r.position.z + dz / d * .7}, dir: {x: dx / d, z: dz / d}, life: 4, pl, turn, length: C.world.beam.length, maxSegments: C.world.beam.maxSegments, interval: C.world.beam.interval, hit: {damage: C.world.beam.damage}}, game.lastStepEvents);
    return true;
  }
  function emitExplosion() {
    if (game.phase !== 'playing') return false;
    spawn(game.world, {kind: 'area', explosion: true, owner: 1, affectsOwner: true, pos: {x: 0, z: 0}, radius: 4, y: 0, height: 3, life: .25, pulses: 1, falloff: 'linear', pl: 2, hit: {damage: 10, knockback: {horizontal: 5, vertical: 4}}}, game.lastStepEvents);
    return true;
  }
  function paramRow([group, key, label, tip, min, max, step, fmt, approved]) {
    const v = C.world[group][key], def = defaults().world[group][key];
    return `<div class="mvp-param" title="${escape(tip)}"><label>${escape(label)} <small class="${approved ? 'ok' : 'warn'}">${approved ? 'aprovado' : 'provisório'}</small></label>
      <div class="row"><input type="range" data-p="${group}.${key}" min="${min}" max="${max}" step="${step}" value="${v}"><output data-o="${group}.${key}">${fmt(v)}</output><button type="button" data-reset="${group}.${key}" title="Padrão: ${escape(fmt(def))}" ${v === def ? 'disabled' : ''}>↺</button></div></div>`;
  }
  function render() {
    const openKeys = new Set([...root.querySelectorAll('details[open][data-k]')].map(d => d.dataset.k));   // a interface não recolhe os grupos que você abriu
    const eq0 = equipped(0), eq1 = equipped(1);
    const scen = results ? results.map(s => `<details data-k="s:${s.id}" ${s.ok ? '' : 'open'}><summary class="${s.ok ? 'ok' : 'warn'}">${s.ok ? '✓' : '✗'} ${escape(s.name)}</summary><table><tr><th>Verificação</th><th>Esperado</th><th>Obtido</th></tr>${s.rows.map(r => `<tr class="${r.ok ? 'ok' : 'warn'}"><td>${r.ok ? '✓' : '✗'} ${escape(r.what)}</td><td>${escape(r.expected)}</td><td>${escape(r.got)}</td></tr>`).join('')}</table></details>`).join('') : '<p class="hint">Cada cenário roda num duelo isolado, com semente fixa e os ajustes atuais, e compara esperado × obtido.</p>';
    root.innerHTML = `
      <p class="hint">Reflect (tecla <b>A</b>) e Psyshock (tecla <b>S</b>): <b>segure para carregar, solte para executar</b>. Vêm desligados: marque abaixo para equipar (valem nas próximas partidas e já na atual). A aprovação de jogabilidade e visual é sua (aba Homologação).</p>
      <h3>Equipar</h3>
      <div class="row"><b>Jogador (azul)</b><label><input type="checkbox" data-equip="0.reflect" ${eq0.reflect ? 'checked' : ''}> Reflect</label><label><input type="checkbox" data-equip="0.psyshock" ${eq0.psyshock ? 'checked' : ''}> Psyshock</label></div>
      <div class="row"><b>Adversário (vermelho)</b><label><input type="checkbox" data-equip="1.reflect" ${eq1.reflect ? 'checked' : ''}> Reflect</label><label><input type="checkbox" data-equip="1.psyshock" ${eq1.psyshock ? 'checked' : ''}> Psyshock</label><span class="muted">usa a IA tática</span></div>
      <h3>Emissores técnicos (na partida)</h3>
      <div class="row"><button type="button" data-emit="1">Projétil hostil PL1</button><button type="button" data-emit="2">PL2</button><button type="button" data-emit="3">PL3</button><button type="button" data-emit="boom">Explosão no centro (PL2)</button></div>
      <div class="row"><button type="button" data-laser="1">Laser PL1</button><button type="button" data-laser="2">PL2</button><button type="button" data-laser="3">PL3</button><button type="button" data-laser="sweep">Laser giratório (PL1)</button></div>
      <p class="hint">O projétil e o laser (4 s, contínuo, dano a cada 0,25 s) saem do vermelho rumo ao azul: use para testar o Reflect, a reflexão em cadeia e o Counter. A explosão destrói barreiras alcançadas; quem está atrás de uma barreira fica protegido.</p>
      <h3>Cenários técnicos</h3>
      <div class="row"><button type="button" id="mvp-run">▶ Executar todos</button><button type="button" id="mvp-export" ${results ? '' : 'disabled'}>↓ JSON</button></div>
      <div id="mvp-results">${scen}</div>
      <h3>Avaliação jogável dos Moves</h3>
      <p class="hint">A sua aprovação (separada dos testes automáticos). Fica salva neste navegador e vai no JSON exportado.</p>
      ${MOVES_HOMOLOG.map((t, i) => `<div class="mvp-hom"><div>${escape(t)}</div><div class="row"><select data-hom="${i}"><option value="">pendente</option><option value="ok" ${homolog[i]?.v === 'ok' ? 'selected' : ''}>aprovado</option><option value="no" ${homolog[i]?.v === 'no' ? 'selected' : ''}>reprovado</option></select><input type="text" data-hom-note="${i}" placeholder="observação" value="${escape(homolog[i]?.n ?? '')}"></div></div>`).join('')}
      <h3>Parâmetros <small class="muted">(valem para os próximos usos; barreiras e pedras já criadas guardam os valores de quando nasceram)</small></h3>
      ${PARAMS.map(([title, list]) => `<details data-k="p:${escape(title)}"><summary><b>${escape(title)}</b></summary>${list.map(paramRow).join('')}</details>`).join('')}
      <div class="row"><button type="button" id="mvp-reset-all">Restaurar todos os padrões</button></div>`;
    for (const d of root.querySelectorAll('details[data-k]')) if (openKeys.has(d.dataset.k)) d.open = true;
    for (const s of root.querySelectorAll('[data-hom]')) s.onchange = () => {homolog[s.dataset.hom] = {...homolog[s.dataset.hom], v: s.value};saveHomolog(homolog);};
    for (const s of root.querySelectorAll('[data-hom-note]')) s.onchange = () => {homolog[s.dataset.homNote] = {...homolog[s.dataset.homNote], n: s.value};saveHomolog(homolog);};
    for (const c of root.querySelectorAll('[data-equip]')) c.onchange = () => {const [id, kind] = c.dataset.equip.split('.');setEquip(Number(id), kind, c.checked);};
    for (const b of root.querySelectorAll('[data-laser]')) b.onclick = () => {const k = b.dataset.laser;(k === 'sweep' ? emitLaser(1, .8) : emitLaser(Number(k)));};
    for (const b of root.querySelectorAll('[data-emit]')) b.onclick = () => {const k = b.dataset.emit;(k === 'boom' ? emitExplosion() : emitProjectile(Number(k)));};
    $('mvp-run').onclick = () => {results = runMoveScenarios();render();};
    $('mvp-export').onclick = () => results && download(JSON.stringify({schema: 'arenamon-lab-report', version: 1, kind: 'moves-scenarios', createdAt: new Date().toISOString(), step: C.test.step, scenarios: results, homologation: MOVES_HOMOLOG.map((t, i) => ({item: t, verdict: homolog[i]?.v || 'pendente', note: homolog[i]?.n || ''}))}, null, 1), 'arenamon-cenarios-moves.json');
    for (const inp of root.querySelectorAll('[data-p]')) inp.oninput = () => {
      const [g, k] = inp.dataset.p.split('.'), spec = PARAMS.flatMap(p => p[1]).find(s => s[0] === g && s[1] === k), v = Number(inp.value);
      C.world[g][k] = v;root.querySelector(`[data-o="${inp.dataset.p}"]`).textContent = spec[7](v);root.querySelector(`[data-reset="${inp.dataset.p}"]`).disabled = v === defaults().world[g][k];
    };
    for (const b of root.querySelectorAll('[data-reset]')) b.onclick = () => {const [g, k] = b.dataset.reset.split('.');C.world[g][k] = defaults().world[g][k];render();};
    $('mvp-reset-all').onclick = () => {for (const g of ['charge', 'reflect', 'psyshock', 'beam']) Object.assign(C.world[g], defaults().world[g]);render();};
  }
  return {render, emitProjectile, emitLaser, emitExplosion, setEquip, get results() {return results;}, STANDARD};
}
