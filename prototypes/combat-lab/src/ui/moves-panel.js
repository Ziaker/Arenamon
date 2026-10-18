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
    ['reflect', 'minCharge', 'Carga mínima para materializar', 'Tempo mínimo segurando o botão; soltar antes disso falha e devolve a stamina (M4.1; provisório).', 0, 4, .05, sec, false],
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
    ['psyshock', 'searchStep', 'Passo da busca de espaço', 'Distância entre as posições testadas ao procurar um lugar livre para cada pedra (provisório).', .05, 1, .05, m, false],
    ['psyshock', 'arc', 'Abertura do arco das pedras', 'Ângulo total em que as pedras se distribuem à frente do lançador ao formar (provisório).', 0, 360, 5, deg, false],
    ['psyshock', 'ringMin', 'Distância mínima do lançador', 'Raio mínimo do anel onde as pedras nascem, sorteado por pedra (provisório).', .3, 3, .05, m, false],
    ['psyshock', 'ringMax', 'Distância máxima do lançador', 'Raio máximo do anel onde as pedras nascem (provisório).', .3, 3, .05, m, false],
    ['psyshock', 'heightMin', 'Altura mínima das pedras', 'Altura inicial mínima, sorteada por pedra; só visual e posição de saída (M30.2; provisório).', 0, 2.5, .05, m, false],
    ['psyshock', 'heightMax', 'Altura máxima das pedras', 'Altura inicial máxima, sorteada por pedra (M30.2; provisório).', 0, 2.5, .05, m, false],
    ['psyshock', 'scaleMin', 'Tamanho visual mínimo', 'Escala mínima da pedra; não muda a colisão (M30.2; provisório).', .3, 3, .05, x, false],
    ['psyshock', 'scaleMax', 'Tamanho visual máximo', 'Escala máxima da pedra; não muda a colisão (M30.2; provisório).', .3, 3, .05, x, false],
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

/** Controles da aba (exportado para os testes de cobertura: cada parâmetro da configuração dos Moves precisa de slider). */
export const MOVES_PARAMS = PARAMS;

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

export function createMovesPanel({$, game, download, tuning, view, ui}) {
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
  /** Cenários de reflexão e neutralização em tempo real na simulação ativa */
  function testLaserScene(kind) {
    if (game.phase !== 'playing') game.startMatch?.('center');
    if (kind === 'reflect') {
      spawn(game.world, {kind: 'wall', reflect: true, owner: 0, pos: {x: 0, z: 0}, height: 2.2, hx: 2.5, hz: 0.1, angle: 0, life: 8, age: 0, pl: 1}, game.lastStepEvents);
      spawn(game.world, {kind: 'beam', owner: 1, pos: {x: 0, z: 5}, dir: {x: 0, z: -1}, life: 4, pl: 1, length: 24, maxSegments: 8, interval: 0.25, hit: {damage: 2}}, game.lastStepEvents);
    } else if (kind === 'neutralize') {
      spawn(game.world, {kind: 'wall', reflect: true, owner: 0, pos: {x: 0, z: 0}, height: 2.2, hx: 2.5, hz: 0.1, angle: 0, life: 8, age: 0, pl: 1}, game.lastStepEvents);
      spawn(game.world, {kind: 'beam', owner: 1, pos: {x: 0, z: 5}, dir: {x: 0, z: -1}, life: 4, pl: 3, length: 24, maxSegments: 8, interval: 0.25, hit: {damage: 2}}, game.lastStepEvents);
    }
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
  function renderMovesAnimSection() {
    const ch = ui?.characters?.[0];
    if (!ch) {
      return `
        <div class="moves-anim-section">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <h3 style="margin:0;font-size:13px;color:var(--cyan);display:flex;align-items:center;gap:6px;">
              <span>⚔</span> Animações dos Moves (Carga & Disparo)
            </h3>
            <span class="muted" style="font-size:11px;">Jogador Azul · Modelo GLB</span>
          </div>
          <p class="hint" style="margin:0;">
            ℹ Nenhum modelo GLB carregado no jogador azul. Carregue um modelo na aba <b>Personagens</b> para associar os clipes de carga (com slider de loop) e disparo de cada Move.
          </p>
        </div>
      `;
    }

    const movesList = [
      ['reflect', 'Reflect (Barreira)', 'Tecla A · Slot 0', 'Escudo refletor frontal'],
      ['psyshock', 'Psyshock (Pedras Psíquicas)', 'Tecla S · Slot 1', 'Disparo de projéteis com homing']
    ];

    const cardsHtml = movesList.map(([moveId, title, keyHelp, desc]) => {
      const conf = ch.getMoveAnimConfig(moveId);
      const chargeClip = conf.chargeClip != null ? ch.clips[conf.chargeClip] : null;
      const chargeDur = chargeClip?.duration || 1.0;
      const loopEnd = Math.min(chargeDur, Math.max(0.02, conf.chargeLoopEnd ?? chargeDur));
      const loopStart = Math.min(Math.max(0, conf.chargeLoopStart || 0), Math.max(0, loopEnd - 0.02));

      const clipOptions = (selectedIdx, placeholder) => {
        return `<option value="">${placeholder}</option>` + ch.clips.map((c, i) => {
          const isSel = i === selectedIdx;
          return `<option value="${i}" ${isSel ? 'selected' : ''}>${escape(c.name)} (${c.duration.toFixed(2)}s)</option>`;
        }).join('');
      };

      const isPreviewing = ch.movePreview?.moveId === moveId;

      return `
        <div class="moves-anim-card" data-card-move="${moveId}">
          <div class="moves-anim-card-head">
            <div>
              <h4 style="margin:0;font-size:13px;color:#78ebff;"><span>✨</span> ${escape(title)}</h4>
              <small class="muted">${escape(keyHelp)} · ${escape(desc)}</small>
            </div>
            <button type="button" class="btn-preview-move ${isPreviewing ? 'active' : ''}" data-preview-move="${moveId}">
              ${isPreviewing ? '⏹ Parar Teste' : '▶ Testar Carga (com Loop) ➔ Disparo'}
            </button>
          </div>

          <div class="moves-anim-grid">
            <!-- 1. Animação de Carga + intervalo de Loop -->
            <div class="moves-anim-col">
              <label>1. Animação de Carga (Segurar tecla):</label>
              <select data-move-anim-select="charge" data-move-id="${moveId}">
                ${clipOptions(conf.chargeClip, '— Selecionar animação de carga —')}
              </select>
              
              <div class="moves-loop-slider-box">
                <label for="move-loop-start-${moveId}">Início do loop <output data-move-loop-out="${moveId}-start">${loopStart.toFixed(2)} s</output></label>
                <input id="move-loop-start-${moveId}" type="range" data-move-loop-range="${moveId}" data-loop-edge="start" min="0" max="${Math.max(0, loopEnd - 0.02).toFixed(2)}" step="0.01" value="${loopStart.toFixed(2)}" ${chargeClip ? '' : 'disabled'}>
                <label for="move-loop-end-${moveId}">Fim do loop <output data-move-loop-out="${moveId}-end">${loopEnd.toFixed(2)} s</output></label>
                <input id="move-loop-end-${moveId}" type="range" data-move-loop-range="${moveId}" data-loop-edge="end" min="${Math.min(chargeDur, loopStart + 0.02).toFixed(2)}" max="${chargeDur.toFixed(2)}" step="0.01" value="${loopEnd.toFixed(2)}" ${chargeClip ? '' : 'disabled'}>
                <div class="move-loop-timeline" data-loop-timeline="${moveId}">
                  <div class="loop-intro" style="flex:${Math.max(0.001, loopStart)};" title="Windup inicial: 0.00s a ${loopStart.toFixed(2)}s">
                    ${loopStart > 0.15 ? `Intro (${loopStart.toFixed(2)}s)` : ''}
                  </div>
                  <div class="loop-repeat" style="flex:${Math.max(0.001, loopEnd - loopStart)};" title="Ciclo contínuo de loop: ${loopStart.toFixed(2)}s a ${loopEnd.toFixed(2)}s">
                    🔁 Loop (${(loopEnd - loopStart).toFixed(2)}s)
                  </div>
                  <div class="loop-tail" style="flex:${Math.max(0.001, chargeDur - loopEnd)};" title="Trecho após o loop: ${loopEnd.toFixed(2)}s a ${chargeDur.toFixed(2)}s">${chargeDur - loopEnd > 0.15 ? 'Final' : ''}</div>
                </div>
                <p class="hint" style="margin:4px 0 0 0;font-size:10.5px;">
                  Segurando: toca a introdução uma vez e repete apenas o trecho entre início e fim. Ao soltar: passa imediatamente para a animação de disparo. O trecho final do clipe de carga fica fora do loop.
                </p>
              </div>
            </div>

            <!-- 2. Animação de Disparo -->
            <div class="moves-anim-col">
              <label>2. Animação de Disparo (Ao soltar tecla):</label>
              <select data-move-anim-select="release" data-move-id="${moveId}">
                ${clipOptions(conf.releaseClip, '— Selecionar animação de disparo —')}
              </select>
              <p class="hint" style="margin-top:6px;font-size:11px;">
                Dispara ao soltar a tecla do Move, transitando com suavidade (blend) da pose de carga atual até o golpe.
              </p>
            </div>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="moves-anim-section">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <h3 style="margin:0;font-size:13px;color:var(--cyan);display:flex;align-items:center;gap:6px;">
            <span>⚔</span> Animações dos Moves (Carga & Disparo)
          </h3>
          <span class="muted" style="font-size:11px;">Jogador Azul · Modelo GLB</span>
        </div>
        <p class="hint" style="margin-top:2px;">
          Reflect e Psyshock usam Charge. Defina o início e o fim do trecho repetido da animação de carga; o disparo começa ao soltar a tecla, sem esperar o clipe terminar.
        </p>
        <div class="moves-anim-cards">
          ${cardsHtml}
        </div>
      </div>
    `;
  }

  function render() {
    const openKeys = new Set([...root.querySelectorAll('details[open][data-k]')].map(d => d.dataset.k));   // a interface não recolhe os grupos que você abriu
    const eq0 = equipped(0), eq1 = equipped(1);
    const scen = results ? results.map(s => `<details data-k="s:${s.id}" ${s.ok ? '' : 'open'}><summary class="${s.ok ? 'ok' : 'warn'}">${s.ok ? '✓' : '✗'} ${escape(s.name)}</summary><table><tr><th>Verificação</th><th>Esperado</th><th>Obtido</th></tr>${s.rows.map(r => `<tr class="${r.ok ? 'ok' : 'warn'}"><td>${r.ok ? '✓' : '✗'} ${escape(r.what)}</td><td>${escape(r.expected)}</td><td>${escape(r.got)}</td></tr>`).join('')}</table></details>`).join('') : '<p class="hint">Cada cenário roda num duelo isolado, com semente fixa e os ajustes atuais, e compara esperado × obtido.</p>';
    root.innerHTML = `
      <p class="hint">Reflect (tecla <b>A</b>) e Psyshock (tecla <b>S</b>): <b>segure para carregar, solte para executar</b>. Vêm desligados: marque abaixo para equipar (valem nas próximas partidas e já na atual). A aprovação de jogabilidade e visual é sua (aba Homologação).</p>
      <h3>Equipar</h3>
      <div class="row"><b>Jogador (azul)</b><label><input type="checkbox" data-equip="0.reflect" ${eq0.reflect ? 'checked' : ''}> Reflect</label><label><input type="checkbox" data-equip="0.psyshock" ${eq0.psyshock ? 'checked' : ''}> Psyshock</label></div>
      ${renderMovesAnimSection()}
      
      <div class="vfx-quick-style">
        <b>Estilo VFX dos Golpes:</b>
        <div class="seg" role="group" aria-label="Variante dos Moves">
          <button type="button" data-moves-vfx="0" ${(C.vfx.hit?.variant === 0) ? 'aria-pressed="true"' : 'aria-pressed="false"'}>A (Arcade)</button>
          <button type="button" data-moves-vfx="1" ${(C.vfx.hit?.variant === 1) ? 'aria-pressed="true"' : 'aria-pressed="false"'}>B (Halo)</button>
          <button type="button" data-moves-vfx="2" ${(C.vfx.hit?.variant === 2) ? 'aria-pressed="true"' : 'aria-pressed="false"'}>C (Tático)</button>
        </div>
      </div>
  
      <div class="row"><b>Adversário (vermelho)</b><label><input type="checkbox" data-equip="1.reflect" ${eq1.reflect ? 'checked' : ''}> Reflect</label><label><input type="checkbox" data-equip="1.psyshock" ${eq1.psyshock ? 'checked' : ''}> Psyshock</label><span class="muted">usa a IA tática</span></div>
      <h3>Emissores técnicos & Laser (Simulação Física Real)</h3>
      <div class="row"><button type="button" data-emit="1">Projétil hostil PL1</button><button type="button" data-emit="2">PL2</button><button type="button" data-emit="3">PL3</button><button type="button" data-emit="boom">Explosão no centro (PL2)</button></div>
      <div class="row">
        <b>Laser real:</b>
        <button type="button" data-laser="1">Laser Real PL1 (Ciano)</button>
        <button type="button" data-laser="2">Laser Real PL2 (Dourado)</button>
        <button type="button" data-laser="3">Laser Real PL3 (Magenta)</button>
        <button type="button" data-laser="sweep">Laser Giratório (Sweep)</button>
      </div>
      <div class="row" style="margin-top:6px;">
        <b>Cenários de Laser Real:</b>
        <button type="button" data-laser-scene="reflect">▶ Testar Reflexão: Laser PL1 × Reflect</button>
        <button type="button" data-laser-scene="neutralize">▶ Testar Neutralização: Laser PL3 × Reflect PL1</button>
      </div>
      <p class="hint">Os feixes acima são gerados na simulação ativa (física real, dano, colisões, reflexão em barreiras e neutralização), consumidos em tempo real pelo novo BeamRenderer com exclusão mútua do renderizador legado.</p>
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
    
    // Controles de animação dos Moves (Carga com Loop + Disparo)
    const ch = ui?.characters?.[0];
    if (ch) {
      for (const sel of root.querySelectorAll('[data-move-anim-select]')) {
        sel.onchange = () => {
          const moveId = sel.dataset.moveId;
          const type = sel.dataset.moveAnimSelect;
          const val = sel.value === '' ? null : Number(sel.value);
          ch.setMoveAnim(moveId, type, val);
          render();
        };
      }

      for (const inp of root.querySelectorAll('[data-move-loop-range]')) {
        inp.oninput = () => {
          const moveId = inp.dataset.moveLoopRange;
          const edge = inp.dataset.loopEdge;
          const conf = ch.getMoveAnimConfig(moveId);
          const chargeClip = conf.chargeClip != null ? ch.clips[conf.chargeClip] : null;
          const chargeDur = chargeClip?.duration || 1.0;
          if (edge === 'start') ch.setMoveChargeLoopStart(moveId, Number(inp.value));
          else ch.setMoveChargeLoopEnd(moveId, Number(inp.value));
          const start = conf.chargeLoopStart || 0;
          const end = conf.chargeLoopEnd ?? chargeDur;
          const startInput = root.querySelector(`[data-move-loop-range="${moveId}"][data-loop-edge="start"]`);
          const endInput = root.querySelector(`[data-move-loop-range="${moveId}"][data-loop-edge="end"]`);
          startInput.max = Math.max(0, end - 0.02).toFixed(2);
          endInput.min = Math.min(chargeDur, start + 0.02).toFixed(2);
          startInput.value = start.toFixed(2);
          endInput.value = end.toFixed(2);
          root.querySelector(`[data-move-loop-out="${moveId}-start"]`).textContent = `${start.toFixed(2)} s`;
          root.querySelector(`[data-move-loop-out="${moveId}-end"]`).textContent = `${end.toFixed(2)} s`;

          const timeline = root.querySelector(`[data-loop-timeline="${moveId}"]`);
          if (timeline) {
            const intro = timeline.querySelector('.loop-intro');
            const repeat = timeline.querySelector('.loop-repeat');
            const tail = timeline.querySelector('.loop-tail');
            if (intro) {
              intro.style.flex = String(Math.max(0.001, start));
              intro.textContent = start > 0.15 ? `Intro (${start.toFixed(2)}s)` : '';
              intro.title = `Windup inicial: 0.00s a ${start.toFixed(2)}s`;
            }
            if (repeat) {
              repeat.style.flex = String(Math.max(0.001, end - start));
              repeat.textContent = `🔁 Loop (${(end - start).toFixed(2)}s)`;
              repeat.title = `Ciclo contínuo de loop: ${start.toFixed(2)}s a ${end.toFixed(2)}s`;
            }
            if (tail) {tail.style.flex = String(Math.max(0.001, chargeDur - end));tail.textContent = chargeDur - end > 0.15 ? 'Final' : '';tail.title = `Trecho após o loop: ${end.toFixed(2)}s a ${chargeDur.toFixed(2)}s`;}
          }
        };
      }

      for (const b of root.querySelectorAll('[data-preview-move]')) {
        b.onclick = () => {
          const moveId = b.dataset.previewMove;
          if (ch.movePreview?.moveId === moveId) {
            ch.stopMovePreview();
            b.classList.remove('active');
            b.textContent = '▶ Testar Carga (com Loop) ➔ Disparo';
          } else {
            for (const other of root.querySelectorAll('[data-preview-move]')) {
              other.classList.remove('active');
              other.textContent = '▶ Testar Carga (com Loop) ➔ Disparo';
            }
            b.classList.add('active');
            b.textContent = '⏹ Parar Teste';
            ch.startMovePreview(moveId, () => {
              b.classList.remove('active');
              b.textContent = '▶ Testar Carga (com Loop) ➔ Disparo';
            });
          }
        };
      }
    }
    for (const s of root.querySelectorAll('[data-hom]')) s.onchange = () => {homolog[s.dataset.hom] = {...homolog[s.dataset.hom], v: s.value};saveHomolog(homolog);};
    for (const s of root.querySelectorAll('[data-hom-note]')) s.onchange = () => {homolog[s.dataset.homNote] = {...homolog[s.dataset.homNote], n: s.value};saveHomolog(homolog);};
    
    for (const b of root.querySelectorAll('[data-moves-vfx]')) {
      b.onclick = () => {
        const v = Number(b.dataset.movesVfx) || 0;
        const targets = ['hit', 'dodge', 'sprint', 'block', 'clash'];
        if (tuning) {
          const changes = [];
          for (const t of targets) {
            if (C.vfx[t] && C.vfx[t].variant !== v) {
              changes.push([`vfx.${t}.variant`, v]);
            }
          }
          if (changes.length) {
            tuning.commit(changes, 'VFX dos Moves ' + ['A', 'B', 'C'][v]);
          }
        } else {
          for (const t of targets) {
            if (C.vfx[t]) C.vfx[t].variant = v;
          }
        }
        for (const t of targets) {
          view?.vfxRuntime?.setVariant?.(t, v);
        }
        for (const x of root.querySelectorAll('[data-moves-vfx]')) {
          x.setAttribute('aria-pressed', String(x === b));
        }
      };
    }
    tuning?.onChange?.(() => {
      const activeVar = C.vfx.hit?.variant ?? 0;
      for (const x of root.querySelectorAll('[data-moves-vfx]')) {
        x.setAttribute('aria-pressed', String(Number(x.dataset.movesVfx) === activeVar));
      }
    });
    
    for (const c of root.querySelectorAll('[data-equip]')) c.onchange = () => {const [id, kind] = c.dataset.equip.split('.');setEquip(Number(id), kind, c.checked);};
    for (const b of root.querySelectorAll('[data-laser]')) b.onclick = () => {const k = b.dataset.laser;(k === 'sweep' ? emitLaser(1, .8) : emitLaser(Number(k)));};
    for (const b of root.querySelectorAll('[data-laser-scene]')) b.onclick = () => testLaserScene(b.dataset.laserScene);
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
