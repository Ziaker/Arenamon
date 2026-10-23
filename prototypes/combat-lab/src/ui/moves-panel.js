// Aba Moves: equipar Reflect e Psyshock, ajustar os parâmetros (valem só para os PRÓXIMOS usos, M28.4), emitir projéteis e explosões de teste
// na partida e rodar os cenários técnicos repetíveis (M28.3, M28.8). Valores marcados “provisório” são pontos de partida (M30.10), não decisões.
import {C, defaults} from '../sim/config.js';
import {spawn} from '../sim/world.js';
import {listMoves, getMove} from '../sim/moves.js';
import {runMoveScenarios} from '../sim/scenarios-moves.js';
import {elementalVisualMarkup, elementalGlobalMarkup, bindElementalVisual} from './elemental-move-controls.js';
/** Escapa texto para HTML (local: importar o ajustador arrastaria o config.ts do jogo, que só o esbuild lê). */
const escape = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

const STANDARD = [['reflect', 'Reflect', 0], ['psyshock', 'Psyshock', 1]];
/** Informações de interface por move (o que o registro não traz): grupo de parâmetros e texto de apoio. Moves novos funcionam sem entrada aqui. */
export const MOVE_INFO = {
  reflect: {group: 'Reflect', hint: 'Barreira refletora frontal. Segure para carregar, solte para criar.'},
  psyshock: {group: 'Psyshock', hint: 'Pedras psíquicas com homing. Segure para carregar, solte para disparar.'},
  harden: {group: 'Harden', hint: 'Normal · Status. Toque para endurecer: +30% de Defesa e nenhum knockback ofensivo por 5 s (cast de 0,35 s).'},
  swift: {group: 'Swift', hint: 'Burst · Projectile · PL1. Toque para disparar 3 estrelas com homing curto (com alvo travado) ou em leque (sem alvo).'},
  riposte: {group: 'Riposte', hint: 'Normal · Status + Melee. Toque e seja atingido entre 0,13 e 0,30 s: o golpe é anulado e você contra-ataca na hora. Fora do tempo, fica exposto.'},
  'emerging-stone': {group: 'Emerging Stone', hint: 'Normal. Segure: o cast de 0,55 s começa já e as setas movem o marcador (3–10 m); solte com o cast completo para o projétil subterrâneo ir ao marcador, explodir (5 m) e deixar uma rocha 3×3×3 m.'},
  'bullet-punch': {group: 'Bullet Punch', hint: 'Normal · PL2. Como o Quick Attack: segure para ver o círculo de alcance (azul = alvo dentro, vermelho = fora), solte: prepara 0,75 s, some por 0,2 s numa corrida invisível até o adversário mais próximo e golpeia ao chegar (quem estiver no caminho leva o golpe).'},
  'sand-wave': {group: 'Sand Wave', hint: 'Burst · PL1 · só no chão. Toque: após 0,25 s lança uma barragem de areia 4 × 3 m que fere (6 HP), empurra e cega por 4 s quem estiver no chão dentro dela.'},
  spikes: {group: 'Spikes', hint: 'Normal · Field. Segure para escolher o local (setas movem o marcador, até 5 m), solte para confirmar: nasce uma armadilha de espinhos que fere o primeiro adversário que pisar nela.'},
  bounce: {group: 'Bounce', hint: 'Charge · Trick + Melee · PL1–PL3. Segure para carregar (até 1,2 s), solte para saltar em arco rumo ao alvo (até 6 m) e cair em cima do adversário.'},
  feint: {group: 'Feint', hint: 'Burst · Trick. Toque logo após iniciar um ataque (ou durante a carga) para cancelá-lo e recuar com i-frames curtos. Tarde demais: gasta o Move e o ataque segue.'},
  'guard-break': {group: 'Guard Break', hint: 'Charge · Melee · PL1–PL3. Segure para carregar (até 1 s), solte para um golpe pesado que derruba a guarda e causa guard stun de 0,5 s.'},
  lunge: {group: 'Lunge', hint: 'Burst · Melee · PL1. Toque para avançar 3,5 m em linha reta com um Tackle curto e ficar onde parou.'},
  'quick-attack': {group: 'Quick Attack', hint: 'Burst · Melee · PL1. Toque para investir no adversário mais próximo (até 7 m) e voltar na hora ao ponto de partida. Sem alvo ao alcance, não faz nada.'},
  'second-wind': {group: 'Second Wind', hint: 'Normal · Status. Toque para regenerar stamina bem mais rápido e gastar 25% menos em esquiva e sprint por 5 s (cast de 0,35 s).'},
  'water-pulse': {group: 'Water Pulse', hint: 'Charge · Projectile · PL1–PL3. Segure para carregar (até 1,5 s; PL2 em 0,75 s, PL3 em 1,5 s) — a esfera de água cresce na mão — e solte para disparar UMA esfera reta, sem homing. Mais carga = mais dano e empurrão. Protótipo: números do prompt de 22/10, não homologados.'},
  'fire-spin': {group: 'Fire Spin', hint: 'Normal · Field. Segure para escolher o local (setas movem o marcador, até 20 m), solte para confirmar: após 0,4 s nasce um tornado de fogo (1,6 m de raio) que dá 4 pulsos de dano em 2,4 s. O anel da prévia mostra o raio real da zona. Protótipo: números não homologados.'},
  'air-slash': {group: 'Air Slash', hint: 'Burst · Projectile · PL1. Toque: após 8 passos (0,067 s) nasce uma lâmina de ar rápida em linha reta, sem homing; com alvo travado a mira é a do instante do toque. Protótipo: números não homologados.'},
  'seed-bomb': {group: 'Seed Bomb', hint: 'Normal · Projectile + Field. Segure para escolher o destino (até 32 m, setas movem o marcador), solte para confirmar: após 0,3 s uma semente voa em arco e explode ao tocar algo, num raio esférico de 1,8 m. O anel da prévia mostra o raio real da explosão. Protótipo: números não homologados.'},
};
const SKILL_NAMES = ['skill1', 'skill2', 'skill3', 'skill4'];
const ACTION_NAMES = {forward: 'Mover ↑', back: 'Mover ↓', left: 'Mover ←', right: 'Mover →', tackle: 'Tackle (X)', dodge: 'Esquiva (C)', defend: 'Defesa (D)', lock: 'Travar alvo', pause: 'Pausar', restart: 'Reiniciar', debug: 'Depuração'};
const keyName = code => String(code ?? '?').replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, 'Num ').replace('Arrow', 'Seta ').replace('Space', 'Espaço').replace('Escape', 'Esc');
const yesno = v => v ? '1 · sim' : '0 · não';
const ms2 = v => `${v.toFixed(2)} m/s²`, sec = v => `${v.toFixed(2)} s`, pct = v => `${(v * 100).toFixed(0)}%`, num = v => v.toFixed(2), m = v => `${v.toFixed(2)} m`, deg = v => `${v.toFixed(0)}°`, ms = v => `${v.toFixed(2)} m/s`, x = v => `${v.toFixed(2)}×`, int = v => v.toFixed(0);
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
    ['reflect', 'burstRadius', 'Pulso ao invocar: alcance', 'Raio, a partir do centro da barreira, em que o pulso atinge os lutadores ao materializar (0 = sem pulso). A própria barreira não quebra (provisório).', 0, 10, .25, m, false],
    ['reflect', 'burstForce', 'Pulso ao invocar: força do empurrão', 'Empurrão horizontal do pulso (cai com a distância). Só vale com “Causa empurrão” ligado (provisório).', 0, 10, .05, ms, false],
    ['reflect', 'burstDamage', 'Pulso ao invocar: dano', 'Dano do pulso como fração do Ataque do lançador (0 = nenhum; cai com a distância). Só vale com “Causa dano” ligado (provisório).', 0, 2, .01, pct, false],
    ['reflect', 'burstPush', 'Pulso ao invocar: causa empurrão?', 'Liga o empurrão do pulso (provisório).', 0, 1, 1, yesno, false],
    ['reflect', 'burstHurt', 'Pulso ao invocar: causa dano?', 'Liga o dano do pulso (provisório).', 0, 1, 1, yesno, false],
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
    ['psyshock', 'knockbackPerStone', 'Knockback por pedra', 'Empurrão horizontal por pedra (M26s.7).', 0, 10, .05, ms, true],
    ['psyshock', 'knockbackCap', 'Teto de knockback por alvo', 'Máximo acumulado por alvo em cada execução (M30.3).', 0, 10, .05, ms, true],
    ['psyshock', 'knockbackVertical', 'Lançamento vertical por pedra', 'Componente vertical do empurrão: com valor acima de 0 a pedra lança o alvo para cima (voo) em vez de só empurrá-lo (provisório).', 0, 10, .05, ms, false],
    ['psyshock', 'knockbackLevelBonus', 'Bônus de empurrão por nível de PL', 'Soma esta fração do empurrão base para cada Power Level acima do 1 (PL2 = +1×, PL3 = +2×; provisório).', 0, 1.6, .05, pct, false],
    ['psyshock', 'knockbackSpeedFactor', 'Empurrão acompanha a velocidade da pedra', 'Quanto o empurrão varia com a velocidade sorteada da pedra em relação à média: 0% = igual para todas; 100% = proporcional (provisório).', 0, 1.6, .05, pct, false],
    ['psyshock', 'counterStagger', 'Counter Stagger', 'Stagger quando uma pedra de PL superior atinge o corpo do derrotado (M21.5).', 0, 1, .01, sec, true],
    ['psyshock', 'radius', 'Raio de colisão da pedra', 'Igual em todas as pedras (o tamanho visual varia sem efeito na física, M30.2).', .05, .5, .01, m, false],
  ]],
  ['Harden', [
    ['harden', 'cost', 'Custo de stamina', 'Cobrado no início do cast (Normal sem marcador); vale nos PRÓXIMOS usos (M28.4). Valor do catálogo — proposta, não homologada.', 0, 5, .05, num, false],
    ['harden', 'cooldown', 'Cooldown', 'Começa junto com o custo, no início do cast (proposta).', 0, 60, .5, sec, false],
    ['harden', 'cast', 'Duração do cast', 'Tempo do cast antes do efeito começar; interrupção nesse intervalo cancela sem reembolso (proposta).', .05, 2, .01, sec, false],
    ['harden', 'duration', 'Duração do efeito', 'Quanto tempo o status dura depois do cast (proposta).', .5, 20, .25, sec, false],
    ['harden', 'defensePct', 'Bônus de Defesa', '+30% de Defesa = dano recebido × 1/(1+bônus), mesma convenção da passiva de Defesa (MV-P01; proposta).', 0, 2, .05, pct, false],
    ['harden', 'negateKnockback', 'Anula o knockback ofensivo?', 'Liga a negação do arremesso/empurrão de ataques e projéteis. O empurrão físico do corpo do atacante e a gravidade não são knockback (MV-P12).', 0, 1, 1, yesno, false],
  ]],
  ['Second Wind', [
    ['secondWind', 'cost', 'Custo de stamina', 'Cobrado no início do cast (Normal sem marcador); vale nos PRÓXIMOS usos (M28.4). Valor do catálogo — proposta, não homologada.', 0, 5, .05, num, false],
    ['secondWind', 'cooldown', 'Cooldown', 'Começa junto com o custo, no início do cast (proposta).', 0, 60, .5, sec, false],
    ['secondWind', 'cast', 'Duração do cast', 'Tempo do cast antes do efeito começar; interrupção nesse intervalo cancela sem reembolso (proposta).', .05, 2, .01, sec, false],
    ['secondWind', 'duration', 'Duração do efeito', 'Quanto tempo o status dura depois do cast (proposta).', .5, 20, .25, sec, false],
    ['secondWind', 'regenPctPerSecond', 'Regeneração extra por segundo', 'Fração da stamina MÁXIMA recuperada por segundo durante o efeito (MV-P09: o documento diz "+40%/s" sem base).', 0, 2, .05, pct, false],
    ['secondWind', 'mobilityCostPct', 'Desconto em esquiva e sprint', 'Redução do custo da esquiva (C) e do consumo do sprint durante o efeito (proposta: 25%).', 0, .9, .05, pct, false],
  ]],
  ['Swift', [
    ['swift', 'cost', 'Custo de stamina', 'Cobrado no início do uso (Burst); vale nos PRÓXIMOS usos (M28.4). Valor do catálogo — proposta, não homologada.', 0, 5, .05, num, false],
    ['swift', 'cooldown', 'Cooldown', 'Começa junto com o custo, no início do uso (proposta).', 0, 60, .5, sec, false],
    ['swift', 'cast', 'Duração da ação', 'Tempo da ação (recuperação do Burst: não definido no catálogo; provisório MV-P14).', .05, 2, .01, sec, false],
    ['swift', 'count', 'Quantidade de estrelas', 'Estrelas por uso (catálogo: 3).', 1, 9, 1, int, false],
    ['swift', 'speed', 'Velocidade', 'Velocidade de cada estrela (catálogo: 15 m/s).', 2, 40, .5, ms, false],
    ['swift', 'damage', 'Dano nominal por estrela', 'Dano com o Ataque de referência; final = nominal × Ataque ÷ referência (MV-P13). Catálogo: 3 HP.', 0, 30, .5, num, false],
    ['swift', 'homingSeconds', 'Duração do homing', 'Só com alvo travado; sem garantia de acerto (catálogo: 0,25 s).', 0, 1.5, .05, sec, false],
    ['swift', 'homingRate', 'Correção angular do homing', 'Graus por segundo (catálogo: 90°/s).', 0, 720, 10, deg, false],
    ['swift', 'range', 'Alcance máximo', 'Distância percorrida antes de expirar (catálogo: 12 m).', 2, 40, .5, m, false],
    ['swift', 'knockback', 'Knockback por acerto', 'Empurrão horizontal de cada estrela (catálogo: 0,3 m/s); vertical é sempre 0.', 0, 10, .05, ms, false],
    ['swift', 'knockbackCap', 'Teto de knockback por alvo e execução', 'Máximo acumulado pelas estrelas de um mesmo uso (catálogo: 0,9 m/s).', 0, 10, .05, ms, false],
    ['swift', 'radius', 'Raio de colisão da estrela', 'Colisor de cada estrela (provisório).', .05, .5, .01, m, false],
    ['swift', 'fanAngle', 'Leque sem alvo travado', 'Abertura total do leque frontal quando não há lock-on (provisório).', 0, 90, 1, deg, false],
    ['swift', 'spawnForward', 'Saída à frente do lançador', 'Distância à frente em que as estrelas nascem (provisório).', .3, 2, .05, m, false],
    ['swift', 'spawnSpacing', 'Espaçamento lateral na saída', 'Distância lateral entre as estrelas ao nascer (provisório).', 0, 1.5, .05, m, false],
    ['swift', 'counterStagger', 'Counter Stagger', 'Stagger quando a estrela vence uma disputa de PL e atinge o corpo (M21.5; PL1 não vence PL1).', 0, 1, .01, sec, false],
  ]],
  ['Lunge', [
    ['lunge', 'cost', 'Custo de stamina', 'Cobrado no início do uso (Burst); vale nos PRÓXIMOS usos (M28.4). Valor da proposta — não homologada.', 0, 5, .05, num, false],
    ['lunge', 'cooldown', 'Cooldown', 'Começa junto com o custo, no início do uso (proposta: 6 s).', 0, 60, .5, sec, false],
    ['lunge', 'cast', 'Duração total da ação', 'Do início ao fim da recuperação (proposta: 0,6 s).', .1, 2, .01, sec, false],
    ['lunge', 'range', 'Distância do avanço', 'Distância percorrida em linha reta, sem retorno (proposta: 3,5 m).', .5, 12, .1, m, false],
    ['lunge', 'damage', 'Dano nominal', 'Com o Ataque de referência; final = nominal × Ataque ÷ referência (MV-P13). Proposta: 8 HP.', 0, 40, .5, num, false],
    ['lunge', 'knockbackH', 'Knockback horizontal', 'Empurrão deslizante no alvo (proposta: 4 m/s).', 0, 20, .1, ms, false],
    ['lunge', 'knockbackV', 'Knockback vertical', 'Com valor acima de zero o golpe passa a lançar o alvo (proposta: 0).', 0, 20, .1, ms, false],
    ['lunge', 'invulnerableSeconds', 'Invulnerabilidade inicial', 'Janela de i-frames do atacante no começo do avanço (proposta: 0,133 s; 0 desliga).', 0, 1, .01, sec, false],
    ['lunge', 'chainAfter', 'Cancelável após', 'Instante a partir do qual esquiva/outras ações podem cancelar (proposta: 0,45 s).', 0, 2, .01, sec, false],
    ['lunge', 'hitStart', 'Janela ativa: início', 'Só vale com "janelas de combate" ligadas (proposta: 0,19 s).', 0, 1, .01, sec, false],
    ['lunge', 'hitEnd', 'Janela ativa: fim', 'Só vale com "janelas de combate" ligadas (proposta: 0,26 s).', 0, 1, .01, sec, false],
  ]],
  ['Quick Attack', [
    ['quickAttack', 'cost', 'Custo de stamina', 'Cobrado no início do uso (Burst); vale nos PRÓXIMOS usos (M28.4). Valor da proposta — não homologada.', 0, 5, .05, num, false],
    ['quickAttack', 'cooldown', 'Cooldown', 'Começa junto com o custo, no início do uso (proposta: 6 s).', 0, 60, .5, sec, false],
    ['quickAttack', 'acquireRange', 'Alcance de aquisição do alvo', 'Adversário elegível mais próximo dentro desta distância; sem ninguém o Move nem começa (MV-P17). Proposta: 7 m.', 1, 20, .5, m, false],
    ['quickAttack', 'approachMax', 'Tempo máximo da ida', 'A ida termina no contato, ao chegar ou neste tempo (proposta: 0,16 s). A velocidade da ida = alcance ÷ este tempo.', .05, 1, .01, sec, false],
    ['quickAttack', 'returnMax', 'Tempo máximo da volta', 'Retorno ao ponto de partida (proposta: 0,14 s). Sem segundo acerto na volta.', .05, 1, .01, sec, false],
    ['quickAttack', 'recovery', 'Recuperação final', 'Tempo parado depois de voltar, antes de agir de novo (proposta: 0,12 s).', 0, 1, .01, sec, false],
    ['quickAttack', 'damage', 'Dano nominal', 'Com o Ataque de referência; final = nominal × Ataque ÷ referência (MV-P13). Proposta: 8 HP.', 0, 40, .5, num, false],
    ['quickAttack', 'knockbackH', 'Knockback horizontal', 'Empurrão deslizante no alvo (proposta: 4 m/s).', 0, 20, .1, ms, false],
    ['quickAttack', 'knockbackV', 'Knockback vertical', 'Com valor acima de zero o golpe passa a lançar o alvo (proposta: 0).', 0, 20, .1, ms, false],
    ['quickAttack', 'invulnerableSeconds', 'Invulnerabilidade do atacante', 'I-frames no começo da ida; o catálogo não define, então o padrão é 0 (MV-P16).', 0, 1, .01, sec, false],
    ['quickAttack', 'fxLines', 'Linhas de velocidade no sumiço', 'O lutador some em linhas de velocidade na ida e volta com outras linhas no retorno, como o Bullet Punch. Só aparência.', 0, 1, 1, yesno, false],
    ['quickAttack', 'fxHideBody', 'Ocultar o corpo durante o sumiço', 'Liga/desliga o desaparecimento visual do corpo durante a ida e a volta. Só aparência.', 0, 1, 1, yesno, false],
    ['quickAttack', 'airReach', 'Alcance vertical anti-aéreo', 'Altura de alvo em voo que o Move consegue adquirir e acertar (0 = só no chão, como antes). Padrão: 3 m.', 0, 8, .25, m, false],
  ]],
  ['Guard Break', [
    ['guardBreak', 'cost', 'Custo de stamina', 'Cobrado ao INICIAR a carga (Charge); interromper a carga não devolve. Valor da proposta — não homologada.', 0, 5, .05, num, false],
    ['guardBreak', 'cooldown', 'Cooldown', 'Começa junto com o custo, ao iniciar a carga (proposta: 10 s).', 0, 60, .5, sec, false],
    ['guardBreak', 'cast', 'Duração do golpe (pós-soltura)', 'Do disparo ao fim da recuperação (proposta: 0,7 s).', .2, 3, .01, sec, false],
    ['guardBreak', 'maxCharge', 'Carga máxima', 'PL1 abaixo de 50%, PL2 de 50% até antes de 100%, PL3 na carga máxima (proposta: 1 s).', .2, 4, .05, sec, false],
    ['guardBreak', 'minCharge', 'Carga mínima para soltar', '0 = pode soltar a qualquer momento (proposta).', 0, 2, .05, sec, false],
    ['guardBreak', 'range', 'Distância do avanço', 'Não definida no documento: provisório (MV-P20).', .5, 8, .1, m, false],
    ['guardBreak', 'damage', 'Dano nominal', 'Com o Ataque de referência; final = nominal × Ataque ÷ referência (MV-P13); não cresce com o PL. Valor do laboratório: 14 HP (a proposta original era 6; subiu para o contra-golpe ser um grande impacto).', 0, 40, .5, num, false],
    ['guardBreak', 'knockbackH', 'Knockback horizontal (sem guarda)', 'Empurrão em quem NÃO está defendendo (proposta: 2 m/s). Contra guarda o valor é o guard stun.', 0, 20, .1, ms, false],
    ['guardBreak', 'knockbackV', 'Knockback vertical', 'Com valor acima de zero o golpe passa a lançar o alvo (proposta: 0).', 0, 20, .1, ms, false],
    ['guardBreak', 'stun', 'Guard stun', 'Tempo que o defensor fica sem agir após ter a guarda quebrada (proposta: 0,5 s, GM-P04). Defesa perfeita anula.', 0, 3, .05, sec, false],
    ['guardBreak', 'invulnerableSeconds', 'Invulnerabilidade do atacante', 'I-frames no começo do golpe (proposta: nenhum; o startup é punível).', 0, 1, .01, sec, false],
    ['guardBreak', 'chainAfter', 'Cancelável após', 'Instante a partir do qual esquiva/outras ações podem cancelar (proposta: 0,47 s).', 0, 2, .01, sec, false],
    ['guardBreak', 'hitStart', 'Janela ativa: início', 'Só vale com "janelas de combate" ligadas (proposta: 0,33 s).', 0, 1.5, .01, sec, false],
    ['guardBreak', 'hitEnd', 'Janela ativa: fim', 'Só vale com "janelas de combate" ligadas (proposta: 0,53 s).', 0, 1.5, .01, sec, false],
  ]],
  ['Feint', [
    ['feint', 'cost', 'Custo de stamina', 'Cobrado na confirmação (Burst); o custo da ação cancelada não volta (MV-P26). Valor da proposta — não homologada.', 0, 3, .05, num, false],
    ['feint', 'cooldown', 'Cooldown', 'Começa junto com o custo (proposta: 3 s).', 0, 30, .5, sec, false],
    ['feint', 'cast', 'Duração do recuo', 'Do disparo até o fim do recuo (proposta: 0,22 s).', .05, 1, .01, sec, false],
    ['feint', 'cancelAfter', 'Libera outras ações após', 'Instante a partir do qual esquiva/ataque/outro Move podem começar (provisório: 0,033 s).', 0, 1, .01, sec, false],
    ['feint', 'cancelWindow', 'Janela de cancelamento do ataque', 'Só cancela Tackle/Lunge/Guard Break que ainda estão nesta antecipação (proposta: 4 quadros = 0,133 s); depois o Move é gasto sem efeito (MV-P21). Cargas em curso sempre são canceladas.', 0, 1, .01, sec, false],
    ['feint', 'retreat', 'Distância do recuo', 'Deslocamento para trás (ou para o lado do input). A proposta varia de 5,5 cm a 40 cm; provisório: 25 cm.', 0, 2, .01, m, false],
    ['feint', 'invulnStart', 'I-frames: início', 'Micro-janela de invulnerabilidade durante o recuo (proposta: passo 2 = 0,017 s).', 0, .5, .005, sec, false],
    ['feint', 'invulnEnd', 'I-frames: fim', 'Fim da invulnerabilidade (proposta: passo 10 = 0,083 s).', 0, .5, .005, sec, false],
  ]],
  ['Riposte', [
    ['riposte', 'cost', 'Custo de stamina', 'Cobrado no toque, sem marcador (MV-P11). Valor da proposta — não homologada.', 0, 5, .05, num, false],
    ['riposte', 'cooldown', 'Cooldown', 'Começa junto com o custo (proposta: 8 s).', 0, 60, .5, sec, false],
    ['riposte', 'cast', 'Duração total da postura', 'Da postura ao fim da recuperação exposta (proposta: 0,65 s).', .2, 3, .01, sec, false],
    ['riposte', 'windowStart', 'Janela do contra-ataque: início', 'Acertos antes disto causam dano normal (proposta: 0,13 s).', 0, 2, .01, sec, false],
    ['riposte', 'windowEnd', 'Janela do contra-ataque: fim', 'Entre início e fim, o acerto é anulado e dispara o contra-golpe; Guard Break não é anulado (proposta: 0,30 s).', 0, 2, .01, sec, false],
    ['riposte', 'damage', 'Dano nominal do contra-golpe', 'Com o Ataque de referência; final = nominal × Ataque ÷ referência (MV-P13). Proposta: 6 HP.', 0, 40, .5, num, false],
    ['riposte', 'knockbackH', 'Knockback horizontal do contra-golpe', 'Empurrão em quem foi contra-atacado (laboratório: 9 m/s; a calibração do jogo substitui por 16,8).', 0, 40, .1, ms, false],
    ['riposte', 'knockbackV', 'Knockback vertical do contra-golpe', 'Com valor acima de zero o contra-golpe lança o alvo (laboratório: 2,5 m/s).', 0, 40, .1, ms, false],
    ['riposte', 'strikeRange', 'Alcance do contra-golpe', 'Distância percorrida pelo golpe rumo a quem atacou; não definida no documento (MV-P25).', .3, 6, .1, m, false],
    ['riposte', 'hitstopMult', 'Pausa de impacto do contra-golpe (×)', 'Multiplica a pausa (hitstop) normal de impacto quando o contra-golpe acerta: 1 = igual a um golpe comum; 2,5 = bem pesado (padrão).', 0, 8, .1, num, false],
    ['riposte', 'shakeMult', 'Tremor de tela do contra-golpe (×)', 'Multiplica o tremor de tela do impacto quando o contra-golpe acerta (padrão 2,4).', 0, 8, .1, num, false],
    ['riposte', 'blastOn', 'Explosão visual do contra-golpe', 'Efeito PROVISÓRIO: onda esférica, anéis, faíscas e clarão no alvo quando o contra-golpe acerta. 1 = ligado.', 0, 1, 1, num, false],
    ['riposte', 'blastSize', 'Tamanho da explosão visual', 'Escala da explosão provisória do contra-golpe (padrão 1,5).', .3, 5, .1, num, false],
    ['riposte', 'fxOn', 'Efeito visual: ligado', 'Liga/desliga o visual da postura (disco de aço e lâmina de guarda, dourados dentro da janela) e do contra-golpe (clarão, anel e corte em X). Só aparência.', 0, 1, 1, yesno, false],
    ['riposte', 'fxIntensity', 'Efeito visual: intensidade', 'Brilho e opacidade do visual do Riposte (1 = padrão). Só aparência.', 0, 3, .05, num, false],
    ['riposte', 'fxSize', 'Efeito visual: tamanho', 'Escala da lâmina, do disco e do clarão do Riposte (1 = padrão). Só aparência.', .3, 3, .05, num, false],
  ]],
  ['Emerging Stone', [
    ['emergingStone', 'cost', 'Custo de stamina', 'Cobrado só quando o cast terminou E o botão foi solto com destino válido, antes do disparo; sem reembolso (documento: 3).', 0, 10, .1, num, false],
    ['emergingStone', 'cooldown', 'Cooldown', 'Começa junto com o custo, no disparo (documento: 9 s).', 0, 60, .5, sec, false],
    ['emergingStone', 'cast', 'Cast físico', 'Começa ao pressionar; o disparo espera o cast terminar E a soltura (documento: 0,55 s).', .1, 3, .05, sec, false],
    ['emergingStone', 'castSlow', 'Redução de velocidade no cast', '0,7 = anda a 30% durante o cast; depois não há lentidão extra (documento: 70%).', 0, .95, .05, pct, false],
    ['emergingStone', 'minRange', 'Alcance mínimo do marcador (3D)', 'Marcador mais perto que isto fica vermelho e não confirma (documento: 3 m).', 0, 10, .25, m, false],
    ['emergingStone', 'range', 'Alcance máximo do marcador (3D)', 'Inclui a diferença de altura (documento: 10 m).', 1, 30, .5, m, false],
    ['emergingStone', 'speed', 'Velocidade do projétil', 'Linha reta virtual, atravessa paredes e buracos (documento: 15 m/s).', 2, 60, .5, ms, false],
    ['emergingStone', 'blastRadius', 'Raio da explosão (horizontal)', 'Independe da altura e atravessa paredes (documento: 5 m).', .5, 20, .25, m, false],
    ['emergingStone', 'damage', 'Dano nominal da explosão', 'Com o Ataque de referência; final = nominal × Ataque ÷ referência (MV-P13). Documento: 20.', 0, 100, 1, num, false],
    ['emergingStone', 'blastKnockback', 'Empurrão radial da explosão', 'Horizontal, para fora do centro (documento: 8 m/s).', 0, 30, .5, ms, false],
    ['emergingStone', 'rockScale', 'Escala do prisma da rocha', 'Prisma 3×3×3 m × escala; colisor, topo e espaço necessário acompanham (documento: 0,25× a 4×, passo 0,25, padrão 1×).', .25, 4, .25, x, false],
    ['emergingStone', 'rockHp', 'HP da rocha', 'Dano por golpe válido: sem PL 1, PL1 2, PL2 3, PL3 4 (documento: 5 HP).', 1, 30, 1, int, false],
    ['emergingStone', 'riseTime', 'Tempo de emergência', 'Colisor e topo crescem com a altura exposta (documento: 0,40 s).', .1, 3, .05, sec, false],
    ['emergingStone', 'launchH', 'Lançamento da emergência: horizontal', 'Uma vez por personagem, na primeira interseção com a parte exposta (documento: 8 m/s).', 0, 30, .5, ms, false],
    ['emergingStone', 'launchV', 'Lançamento da emergência: vertical', 'Idem (documento: 14 m/s).', 0, 40, .5, ms, false],
    ['emergingStone', 'maxRocks', 'Rochas simultâneas por dono', 'A nova destrói a mais antiga que sobrou da explosão (documento: 3).', 1, 10, 1, int, false],
    ['emergingStone', 'rockSearch', 'Busca de lugar válido (m)', 'Se o prisma não couber no marcador, procura o lugar válido mais próximo até esta distância; a explosão fica no marcador (provisório: 4 m).', 0, 10, .25, m, false],
    ['emergingStone', 'startDistance', 'Distância inicial do marcador', 'Onde o marcador nasce ao pressionar (provisório: 5 m).', 1, 10, .25, m, false],
    ['emergingStone', 'markerAccel', 'Aceleração do marcador', 'Quão rápido o marcador ganha velocidade ao mudar a direção do corpo: ele DESLIZA para o novo lado em vez de aparecer lá. 0 = instantâneo (como antes); padrão 24 m/s².', 0, 200, 1, num, false],
    ['emergingStone', 'fxTrailOn', 'Rastro de terra do projétil', 'Efeito PROVISÓRIO: sulco de terra, montículo grande e terra saltando ao longo do trajeto subterrâneo. 1 = ligado.', 0, 1, 1, yesno, false],
    ['emergingStone', 'fxTrailSize', 'Tamanho do rastro de terra', 'Escala do montículo, do sulco e da terra que salta (padrão 1,8×; 1 = tamanho antigo).', .5, 5, .1, x, false],
    ['emergingStone', 'markerSpeed', 'Velocidade do marcador', 'Quão rápido a direção move o marcador (provisório: 8 m/s).', 1, 30, .5, ms, false],
    ['emergingStone', 'maxRise', 'Altura de apoio do marcador (técnico)', 'Até que altura acima dos pés o marcador procura apoio.', 0, 6, .25, m, false],
    ['emergingStone', 'edgeMargin', 'Folga da borda da arena (técnico)', 'O marcador não passa desta distância da borda.', 0, 2, .05, m, false],
    ['emergingStone', 'radius', 'Folga contra paredes do marcador (técnico)', '0 = o marcador pode ficar colado; a rocha procura lugar se não couber.', 0, 3, .1, m, false],
    ['emergingStone', 'allowOccupied', 'Marcador sobre personagem?', '1 = pode (a rocha lança quem estiver no local); 0 = marcador inválido sobre corpos.', 0, 1, 1, yesno, false],
  ]],
  ['Bullet Punch', [
    ['bulletPunch', 'cost', 'Custo de stamina (× Tackle)', 'Cobrado na SOLTURA com alvo no alcance, junto com a recarga; 1,5 = 1,5× o custo do Tackle (documento: 1,5×; faixa 0–5×).', 0, 5, .1, x, false],
    ['bulletPunch', 'cooldown', 'Cooldown', 'Começa na soltura (documento: 8 s).', 0, 60, .5, sec, false],
    ['bulletPunch', 'cast', 'Preparação', 'Depois de soltar; anda a 30% e pode ser interrompida mantendo o custo (documento: 0,75 s).', .1, 3, .05, sec, false],
    ['bulletPunch', 'vanish', 'Tempo da corrida invisível', 'Tempo da viagem invisível até o alvo: o lutador não existe fisicamente (sem corpo, colisão, acerto nem alvo) e a câmera o acompanha (padrão: 0,2 s; faixa 0,05–6 s).', .05, 6, .05, sec, false],
    ['bulletPunch', 'reach', 'Alcance do Move (aquisição do alvo)', 'Como o Quick Attack: o alvo é o adversário elegível mais próximo dentro desta distância, fixado ao soltar o botão. É o raio do círculo azul/vermelho que aparece ao segurar o botão (calibração: 6 m).', .5, 20, .25, m, false],
    ['bulletPunch', 'strikeReach', 'Alcance do golpe na chegada', 'Distância percorrida pelo Tackle PL2 que sai NO MOMENTO da chegada, rumo ao alvo (padrão 2,2 m).', .5, 8, .1, m, false],
    ['bulletPunch', 'stopShort', 'Distância de parada antes do alvo', 'A corrida invisível termina a esta distância do alvo (centro a centro), para o golpe acertar na hora (padrão 1,1 m; abaixo de 0,8 m a corrida já conta como contato).', .6, 4, .1, m, false],
    ['bulletPunch', 'hitRadius', 'Raio de contato no caminho', 'Quem ficar a menos desta distância do trecho da corrida invisível leva o golpe e a corrida para ali (padrão 0,8 m).', .3, 3, .05, m, false],
    ['bulletPunch', 'impactMult', 'Velocidade de impacto do knockback (× Tackle)', 'Multiplica a velocidade de impacto usada na fórmula do Tackle (documento: 1×; faixa 0–5×).', 0, 5, .1, x, false],
    ['bulletPunch', 'slow', 'Redução da velocidade na preparação', '0,7 = anda a 30% durante a preparação (documento: 70%).', 0, .95, .05, pct, false],
    ['bulletPunch', 'maxRise', 'Altura de apoio na chegada (técnico)', 'Até que altura acima dos pés o lutador procura apoio ao reaparecer.', 0, 6, .25, m, false],
    ['bulletPunch', 'fxLines', 'Linhas de velocidade no sumiço', 'Desenha linhas de velocidade do ponto de partida até o alvo enquanto o lutador some (e outras na volta, no Quick Attack). Só aparência.', 0, 1, 1, yesno, false],
    ['bulletPunch', 'fxHideBody', 'Ocultar o corpo durante o sumiço', 'Liga/desliga o desaparecimento visual do corpo (a simulação não muda). Só aparência.', 0, 1, 1, yesno, false],
    ['bulletPunch', 'airReach', 'Alcance vertical anti-aéreo', 'Altura de alvo em voo que o Move consegue adquirir e acertar (0 = só no chão). Padrão: 3 m.', 0, 8, .25, m, false],
  ]],
  ['Sand Wave', [
    ['sandWave', 'cost', 'Custo de stamina', 'Cobrado na ATIVAÇÃO (t = 0), antes da preparação. Valor do documento (2).', 0, 5, .05, num, false],
    ['sandWave', 'cooldown', 'Cooldown', 'Começa junto com o custo (documento: 10 s).', 0, 60, .5, sec, false],
    ['sandWave', 'cast', 'Preparação', 'Único período obrigatório; sair do chão ou ser interrompido cancela sem devolver nada (documento: 0,25 s).', .05, 2, .01, sec, false],
    ['sandWave', 'length', 'Alcance frontal (ALTURA na vista superior)', 'Comprimento do retângulo à frente do lançador (documento: 4 m; faixa 0,5–30 m). Velocidade da onda = alcance ÷ janela ativa.', .5, 30, .25, m, false],
    ['sandWave', 'width', 'Largura', 'Extensão lateral do retângulo (documento: 3 m; faixa 0,5–20 m).', .5, 20, .25, m, false],
    ['sandWave', 'active', 'Janela de acerto (hitbox)', 'Primeiros segundos da barragem: a onda avança e atinge (documento: 0,75 s).', .1, 3, .05, sec, false],
    ['sandWave', 'dissipate', 'Dissipação visual', 'Tempo extra só de efeito, sem hitbox nem empurrão (documento: 0,75 s).', 0, 3, .05, sec, false],
    ['sandWave', 'damage', 'Dano fixo', 'HP por inimigo por execução, independente do Ataque (documento: 6 HP).', 0, 40, .5, num, false],
    ['sandWave', 'accel', 'Empurrão (aceleração)', 'Aceleração horizontal enquanto houver contato na janela; metade sob defesa parcial (documento: 12 m/s²).', 0, 40, .5, ms2, false],
    ['sandWave', 'partialFactor', 'Fator do empurrão na defesa parcial', 'Multiplica a aceleração quando o alvo defende (documento: 0,5).', 0, 1, .05, num, false],
    ['sandWave', 'blind', 'Duração da cegueira', 'Reiniciada (não somada) a cada novo acerto válido; defesa perfeita anula (documento: 4 s).', 0, 15, .25, sec, false],
    ['sandWave', 'wallStagger', 'Stagger contra a parede', 'Sem dano extra; não renova enquanto o alvo continuar pressionado (documento: 0,30 s).', 0, 2, .05, sec, false],
    ['sandWave', 'visionRadius', 'Raio de visão do cegado', 'Lock-on e IA só enxergam adversários até esta distância e com linha de visão (documento: 10 m).', 2, 30, .5, m, false],
    ['sandWave', 'fogDarkness', 'Escurecimento do fog (só a câmera do cegado)', 'Redução da luz ambiente na visão do jogador cegado (documento: 60%). A arte final da areia/nuvem ainda não foi aprovada.', 0, 1, .05, pct, false],
    ['sandWave', 'cell', 'Resolução do caminho livre (técnico)', 'Tamanho da célula da grade que calcula o caminho mais curto da onda ao redor de obstáculos.', .1, 1, .05, m, false],
    ['sandWave', 'detour', 'Margem de desvio (técnico)', 'Quanto a grade se estende além do retângulo para a areia contornar obstáculos (provisório: 3 m).', 0, 10, .5, m, false],
    ['sandWave', 'replanSteps', 'Recalcular obstáculos a cada (passos)', 'Obstáculos móveis: o caminho é refeito neste intervalo (SW-D67; provisório: 6).', 1, 60, 1, int, false],
  ]],
  ['Spikes', [
    ['spikes', 'cost', 'Custo de stamina', 'Cobrado ao CONFIRMAR o marcador (Normal); marcador inválido cancela sem custo. Valor do catálogo — proposta, não homologada.', 0, 5, .05, num, false],
    ['spikes', 'cooldown', 'Cooldown', 'Começa junto com o custo, na confirmação (catálogo: 10 s).', 0, 60, .5, sec, false],
    ['spikes', 'cast', 'Duração do cast', 'Tempo entre confirmar e a armadilha nascer; interrupção cancela sem reembolso (catálogo: 0,4 s).', .05, 2, .01, sec, false],
    ['spikes', 'range', 'Alcance de colocação (3D)', 'Distância tridimensional máxima do marcador, incluindo a altura do apoio (catálogo: 5 m).', 1, 15, .5, m, false],
    ['spikes', 'minRange', 'Alcance mínimo', '0 = pode colocar colada em você (provisório).', 0, 10, .25, m, false],
    ['spikes', 'radius', 'Raio do campo', 'Região ofensiva da armadilha (catálogo: 1,2 m).', .3, 4, .05, m, false],
    ['spikes', 'life', 'Duração máxima', 'Tempo até sumir sem acionar (catálogo: 8 s).', 1, 30, .5, sec, false],
    ['spikes', 'damage', 'Dano nominal', 'Com o Ataque de referência; final = nominal × Ataque ÷ referência (MV-P13); dano comum para Sturdy (MV-P05). Catálogo: 6 HP.', 0, 40, .5, num, false],
    ['spikes', 'knockbackH', 'Knockback horizontal', 'O catálogo define 0: dano sem empurrão.', 0, 10, .1, ms, false],
    ['spikes', 'knockbackV', 'Knockback vertical', 'O catálogo define 0.', 0, 10, .1, ms, false],
    ['spikes', 'armDelay', 'Tempo de armação', 'Depois de nascer, a armadilha só aciona após este tempo (provisório: 0,25 s, MV-P31).', 0, 2, .05, sec, false],
    ['spikes', 'markerAccel', 'Aceleração do marcador', 'Quão rápido o marcador ganha velocidade ao mudar a direção do corpo: ele DESLIZA para o novo lado em vez de aparecer lá. 0 = instantâneo (como antes); padrão 24 m/s².', 0, 200, 1, num, false],
    ['spikes', 'markerSpeed', 'Velocidade do marcador', 'Quão rápido a direção move o marcador enquanto o botão está segurado (provisório: 8 m/s, MV-P29).', 1, 30, .5, ms, false],
    ['spikes', 'startDistance', 'Distância inicial do marcador', 'Onde o marcador aparece ao apertar, à frente do corpo (provisório: 3 m).', .5, 10, .25, m, false],
    ['spikes', 'maxRise', 'Altura máxima de apoio acima dos pés', 'Até que altura de plataforma/rampa o marcador alcança (provisório: 2 m).', 0, 6, .25, m, false],
    ['spikes', 'trapHeight', 'Altura da região ofensiva', 'Faixa vertical em que a armadilha pega quem pisa (provisório: 1,2 m).', .3, 4, .1, m, false],
  ]],
  ['Bounce', [
    ['bounce', 'cost', 'Custo de stamina', 'Cobrado ao INICIAR a carga (Charge); interromper não devolve. Valor do catálogo — proposta, não homologada.', 0, 5, .05, num, false],
    ['bounce', 'cooldown', 'Cooldown', 'Começa junto com o custo, ao iniciar a carga (catálogo: 12 s).', 0, 60, .5, sec, false],
    ['bounce', 'maxCharge', 'Carga máxima', 'PL1 abaixo de 50%, PL2 de 50% até antes de 100%, PL3 na carga máxima (catálogo: 1,2 s).', .2, 4, .05, sec, false],
    ['bounce', 'minCharge', 'Carga mínima para soltar', '0 = pode soltar a qualquer momento.', 0, 2, .05, sec, false],
    ['bounce', 'maxDistance', 'Distância horizontal máxima', 'Com alvo travado mais perto, o salto vai só até ele (catálogo: 6 m).', 1, 15, .5, m, false],
    ['bounce', 'heightPl1', 'Altura do salto PL1', 'Altura máxima inicial com pouca carga (parâmetro experimental: 1,5 m).', .3, 8, .1, m, false],
    ['bounce', 'heightPl2', 'Altura do salto PL2', 'Altura com carga média (parâmetro experimental: 2,5 m).', .3, 8, .1, m, false],
    ['bounce', 'heightPl3', 'Altura do salto PL3', 'Altura com carga máxima (parâmetro experimental: 3,5 m).', .3, 8, .1, m, false],
    ['bounce', 'gravity', 'Gravidade do arco', 'Define o tempo de voo e a velocidade horizontal; não vem do catálogo (provisório: 17,5 m/s²).', 5, 40, .5, num, false],
    ['bounce', 'damage', 'Dano nominal', 'Com o Ataque de referência; final = nominal × Ataque ÷ referência (MV-P13). Catálogo: 12 HP.', 0, 60, .5, num, false],
    ['bounce', 'knockbackH', 'Knockback horizontal', 'Empurrão no alvo atingido (catálogo: 3 m/s).', 0, 20, .1, ms, false],
    ['bounce', 'knockbackV', 'Knockback vertical', 'Lançamento do alvo atingido (catálogo: 6 m/s).', 0, 20, .1, ms, false],
    ['bounce', 'landRecovery', 'Recuperação após o pouso', 'Tempo sem agir depois de aterrissar (catálogo: 0,25 s).', 0, 2, .01, sec, false],
    ['bounce', 'contactRadius', 'Folga do contato na descida', 'Margem somada ao corpo para acertar durante a descida (provisório: 0,3 m).', 0, 2, .05, m, false],
    ['bounce', 'landRadius', 'Raio do impacto do pouso', 'Quem está no chão dentro deste raio ao aterrissar também é atingido (provisório: 1,4 m).', 0, 5, .1, m, false],
  ]],
  ['Water Pulse', [
    ['waterPulse', 'cost', 'Custo de stamina', 'Cobrado quando a carga é ATIVADA (Charge, norma universal). Prompt: 1,0.', 0, 5, .05, num, false],
    ['waterPulse', 'cooldown', 'Cooldown', 'Começa junto com o custo, na ativação da carga. Interromper mantém a recarga cheia (prompt: 9 s).', 0, 60, .5, sec, false],
    ['waterPulse', 'maxCharge', 'Carga máxima', 'Tempo para o PL3; o PL2 vem em 50% dele. Em passos: 1,5 s = 180 (prompt: 1,5 s).', .5, 4, .05, sec, false],
    ['waterPulse', 'minCharge', 'Carga mínima para disparar', 'Soltar antes cancela (0 = sem mínimo).', 0, 2, .05, sec, false],
    ['waterPulse', 'chargeRecovery', 'Recuperação após soltar', 'Sem Tackle nem novos Moves a partir da soltura (prompt: 36 passos = 0,30 s). O projétil sai NO PASSO DA SOLTURA (WP-P08 A, provisório).', 0, 1, .01, sec, false],
    ['waterPulse', 'damagePl1', 'Dano PL1 (nominal)', 'Com o Ataque de referência; final = nominal × Ataque ÷ referência (MV-P13). Prompt: 6 HP.', 0, 40, .5, num, false],
    ['waterPulse', 'damagePl2', 'Dano PL2 (nominal)', 'Mesma regra do PL1 (MV-P13). Prompt: 9 HP.', 0, 40, .5, num, false],
    ['waterPulse', 'damagePl3', 'Dano PL3 (nominal)', 'Mesma regra do PL1 (MV-P13). Prompt: 12 HP.', 0, 40, .5, num, false],
    ['waterPulse', 'knockbackPl1', 'Empurrão H, PL1', 'ATENÇÃO: sem vertical, o motor empurra o alvo 1,5 × este valor em METROS (2 → 3 m) e dá 0,63 s de recuperação (EL-P04 A, provisório). Prompt: 2.', 0, 10, .1, ms, false],
    ['waterPulse', 'knockbackPl2', 'Empurrão H, PL2', 'Mesma regra do PL1: 1,5 × este valor em metros (prompt: 3).', 0, 10, .1, ms, false],
    ['waterPulse', 'knockbackPl3', 'Empurrão H, PL3', 'Mesma regra do PL1: 1,5 × este valor em metros (prompt: 4).', 0, 10, .1, ms, false],
    ['waterPulse', 'speed', 'Velocidade do projétil', 'Velocidade escalar 3D (prompt: 14 m/s).', 5, 30, .5, ms, false],
    ['waterPulse', 'radius', 'Raio do projétil', 'Colisor circular (prompt: 0,38 m).', .1, .8, .01, m, false],
    ['waterPulse', 'range', 'Alcance', 'Distância máxima; a vida do projétil é alcance ÷ velocidade (o prompt tinha 12 m e 1,0 s, incoerentes a 14 m/s).', 3, 20, .5, m, false],
    ['waterPulse', 'originHeight', 'Altura de nascimento (mão)', 'Acima da altitude do atirador (chão, plataforma ou voo). Não definida no prompt.', .2, 1.3, .05, m, false],
    ['waterPulse', 'spawnForward', 'Distância de nascimento', 'À frente do corpo. Se houver sólido ali, o Move FALHA com reembolso (sem teletransporte).', .3, 1.5, .05, m, false],
    ['waterPulse', 'counterStagger', 'Counter Stagger', 'Stagger do derrotado quando este projétil vence um Counter e atinge o corpo (M21.5: 0,2 s).', 0, 1, .01, sec, true],
  ]],
  ['Fire Spin', [
    ['fireSpin', 'cost', 'Custo de stamina', 'Cobrado ao CONFIRMAR o marcador (Normal); marcador inválido cancela sem custo. Prompt: 1,0.', 0, 5, .05, num, false],
    ['fireSpin', 'cooldown', 'Cooldown', 'Começa junto com o custo, na confirmação (prompt: 11 s).', 0, 60, .5, sec, false],
    ['fireSpin', 'cast', 'Cast (até a zona nascer)', 'Entre confirmar e a zona nascer (prompt: 0,4 s = 48 passos).', .05, 2, .01, sec, false],
    ['fireSpin', 'recovery', 'Recovery depois da zona nascer', 'Tempo até recuperar o controle; a zona vive sozinha (prompt: 0,2 s = 24 passos).', 0, 1, .01, sec, false],
    ['fireSpin', 'range', 'Alcance do marcador (3D)', 'Inclui a altura do apoio. Padrão atual: 20 m.', 1, 40, .5, m, false],
    ['fireSpin', 'zoneRadius', 'Raio da zona', 'Região ofensiva cilíndrica (prompt: 1,6 m). O anel da prévia usa este raio real.', .5, 4, .05, m, false],
    ['fireSpin', 'zoneHeight', 'Altura da zona', 'Faixa vertical que pega quem está dentro, a partir do apoio (prompt: 2,4 m).', .5, 5, .1, m, false],
    ['fireSpin', 'life', 'Duração da zona', 'Vida da entidade em tempo LOCAL (cada acerto congela o mundo 1 passo de hitstop). Prompt: 2,4 s = 288 passos.', .5, 8, .1, sec, false],
    ['fireSpin', 'pulses', 'Número de pulsos', 'O último pulso precisa cair antes de a zona expirar: pulsos serão limitados a (duração ÷ intervalo). Prompt: 4.', 1, 12, 1, int, false],
    ['fireSpin', 'interval', 'Intervalo entre pulsos', 'O primeiro pulso sai no primeiro passo da zona (prompt: 0,6 s = 72 passos).', .1, 2, .05, sec, false],
    ['fireSpin', 'startup', 'Atraso do primeiro pulso (start-up)', 'Tempo antes do primeiro pulso de dano (s). 0 = dano imediato.', 0, 3, .05, sec, false],
    ['fireSpin', 'damage', 'Dano por pulso (nominal)', 'Final = nominal × Ataque ÷ referência (MV-P13); uma vez por alvo por pulso. Prompt: 2 HP (o teto de 8 HP por alvo é igual a 4 × 2, redundante).', 0, 10, .25, num, false],
    ['fireSpin', 'guardStun', 'Guard stun por pulso', '0 = quem defende toma o dano reduzido e continua livre (FS-P07 A, provisório). Com o valor do motor (0,514 s) a guarda trava ≈83% do tempo.', 0, 1, .01, sec, false],
    ['fireSpin', 'occlusion', 'Paredes bloqueiam os pulsos', 'Liga: sólidos de chão entre o centro e o alvo impedem o dano (plano XZ). Desligado: o dano atravessa (padrão do motor).', 0, 1, 1, yesno, false],
    ['fireSpin', 'maxActive', 'Zonas simultâneas por dono', 'A mais antiga some quando o limite é passado (FS-P04, provisório: 1).', 1, 4, 1, int, false],
    ['fireSpin', 'allowOccupied', 'Permitir colocar sobre um lutador', 'Desligado: o marcador fica inválido sobre personagens (prompt §3.1).', 0, 1, 1, yesno, false],
    ['fireSpin', 'minRange', 'Alcance mínimo do marcador', '0 = pode colocar o destino colado em você.', 0, 10, .25, m, false],
    ['fireSpin', 'markerSpeed', 'Velocidade do marcador', 'Quão rápido a direção move o marcador enquanto o botão está segurado (8 m/s, MV-P29).', 1, 30, .5, ms, false],
    ['fireSpin', 'markerAccel', 'Aceleração do marcador', '0 = instantâneo; o padrão desliza para o novo lado.', 0, 100, 1, ms2, false],
    ['fireSpin', 'startDistance', 'Distância inicial do marcador', 'Onde o marcador aparece ao apertar (3 m).', .5, 10, .25, m, false],
    ['fireSpin', 'maxRise', 'Altura máxima de apoio acima dos pés', 'Até que altura de plataforma o marcador alcança (2 m).', 0, 6, .25, m, false],
  ]],
  ['Air Slash', [
    ['airSlash', 'cost', 'Custo de stamina', 'Cobrado NO TOQUE (Burst, MV-P11). Prompt: 0,8.', 0, 5, .05, num, false],
    ['airSlash', 'cooldown', 'Cooldown', 'Começa no toque (prompt: 6 s).', 0, 60, .5, sec, false],
    ['airSlash', 'startup', 'Startup (sem hitbox)', 'Do toque até a lâmina nascer (prompt: 8 passos = 0,067 s).', 0, .5, .005, sec, false],
    ['airSlash', 'recovery', 'Recovery', 'Depois da lâmina nascer, até recuperar o controle (prompt: 20 passos = 0,167 s).', 0, 1, .005, sec, false],
    ['airSlash', 'speed', 'Velocidade da lâmina', 'Prompt: 22 m/s.', 5, 50, .5, ms, false],
    ['airSlash', 'range', 'Alcance', 'A vida da lâmina é alcance ÷ velocidade (o prompt tinha 10 m e 0,60 s, incoerentes a 22 m/s).', 2, 25, .5, m, false],
    ['airSlash', 'radius', 'Raio do colisor (equivalente)', 'O motor colide projéteis como CÍRCULO; a caixa 1,20 × 0,70 × 0,22 do prompt é só o desenho (AS-P02 A, provisório). Alcança 0,5 m + este raio do centro do alvo.', .1, 1.5, .05, m, false],
    ['airSlash', 'damage', 'Dano (nominal)', 'Final = nominal × Ataque ÷ referência (MV-P13). Prompt: 8 HP.', 0, 40, .5, num, false],
    ['airSlash', 'knockbackH', 'Empurrão H', 'ATENÇÃO: sem vertical, o motor empurra 1,5 × este valor em METROS (2,5 → 3,75 m) e dá 0,63 s de recuperação (EL-P04 A, provisório). Prompt: 2,5.', 0, 12, .1, ms, false],
    ['airSlash', 'originHeight', 'Altura de nascimento (mão)', 'Acima da altitude do atirador.', .2, 1.3, .05, m, false],
    ['airSlash', 'spawnForward', 'Distância de nascimento', 'À frente do corpo; sólido ali = a lâmina se dissipa (Burst gasto sem efeito).', .3, 1.5, .05, m, false],
    ['airSlash', 'counterStagger', 'Counter Stagger', 'Stagger do derrotado quando este projétil vence um Counter (M21.5: 0,2 s).', 0, 1, .01, sec, true],
    ['airSlash', 'visualWidth', 'Desenho: largura (só aparência)', 'Largura do crescente (prompt: 1,20 m). Não muda a colisão.', .2, 3, .05, m, false],
    ['airSlash', 'visualHeight', 'Desenho: altura (só aparência)', 'Altura do crescente (prompt: 0,70 m).', .2, 2, .05, m, false],
    ['airSlash', 'visualThickness', 'Desenho: espessura (só aparência)', 'Espessura do crescente (prompt: 0,22 m).', .05, 1, .01, m, false],
  ]],
  ['Seed Bomb', [
    ['seedBomb', 'cost', 'Custo de stamina', 'Cobrado ao CONFIRMAR o marcador (Normal). Prompt: 1,0.', 0, 5, .05, num, false],
    ['seedBomb', 'cooldown', 'Cooldown', 'Começa junto com o custo, na confirmação (prompt: 8 s).', 0, 60, .5, sec, false],
    ['seedBomb', 'cast', 'Cast (até a semente sair)', 'Prompt: 0,3 s = 36 passos.', .05, 2, .01, sec, false],
    ['seedBomb', 'recovery', 'Recovery', 'Prompt: 0,2 s = 24 passos (ação total 0,5 s).', 0, 1, .01, sec, false],
    ['seedBomb', 'range', 'Alcance do marcador (3D)', 'Padrão atual: 32 m. O destino precisa de apoio sólido (não mira o ar).', 2, 64, .5, m, false],
    ['seedBomb', 'flightTime', 'Tempo de voo (arco)', 'Fixo: quanto mais longe, mais rápida a semente (prompt: 0,65 s = 78 passos).', .2, 1.5, .01, sec, false],
    ['seedBomb', 'gravity', 'Gravidade do arco', 'Não definida no prompt: 17,5 é a do salto e do Bounce. Com 28,5 ou 39,6 destinos altos passam da velocidade máxima.', 5, 60, .5, ms2, false],
    ['seedBomb', 'maxSpeed', 'Velocidade inicial máxima', 'Destino que exigir mais FALHA (sem corrigir a trajetória em silêncio). Prompt: 20 m/s.', 5, 35, .5, ms, false],
    ['seedBomb', 'seedRadius', 'Raio da semente', 'Colisor circular (prompt: 0,24 m). A semente só detona; não causa dano por contato.', .1, .6, .01, m, false],
    ['seedBomb', 'lifetime', 'Vida máxima da semente', 'Sem contato até aqui, ela se dissolve SEM explodir (prompt: 1,25 s).', .5, 3, .05, sec, false],
    ['seedBomb', 'explosionRadius', 'Raio da explosão (esfera 3D)', 'Volume ESFÉRICO de verdade (SB-P04 B, provisório): conta a altura do alvo. Prompt: 1,8 m. O anel da prévia usa este raio real.', .5, 4, .05, m, false],
    ['seedBomb', 'damage', 'Dano da explosão (nominal)', 'UM evento por alvo; final = nominal × Ataque ÷ referência (MV-P13); na reflexão usa o Ataque de quem refletiu. Prompt: 10 HP.', 0, 40, .5, num, false],
    ['seedBomb', 'knockbackH', 'Empurrão H', 'Radial a partir do centro. Com V > 0 vira um salto físico (prompt: 3).', 0, 12, .1, ms, false],
    ['seedBomb', 'knockbackV', 'Empurrão V', 'ATENÇÃO: 1 m/s sob a gravidade de lançamento dá um salto de ≈1 cm (prompt: 1).', 0, 12, .1, ms, false],
    ['seedBomb', 'occlusion', 'Paredes bloqueiam a explosão', 'Liga: sólidos de chão entre o centro e o alvo impedem o dano (plano XZ).', 0, 1, 1, yesno, false],
    ['seedBomb', 'blastLife', 'Duração visual da explosão', 'Só aparência: o dano é um único pulso no instante do contato.', .1, 1.5, .05, sec, false],
    ['seedBomb', 'originHeight', 'Altura de lançamento (mão)', 'Acima da altitude do atirador.', .2, 1.3, .05, m, false],
    ['seedBomb', 'spawnForward', 'Distância de nascimento', 'À frente do corpo; sólido ali = o Move falha.', .3, 1.5, .05, m, false],
    ['seedBomb', 'markerSpeed', 'Velocidade do marcador', 'Quão rápido a direção move o marcador com o botão segurado (8 m/s, MV-P29).', 1, 30, .5, ms, false],
    ['seedBomb', 'markerAccel', 'Aceleração do marcador', '0 = instantâneo; o padrão desliza para o novo lado em vez de aparecer lá.', 0, 100, 1, ms2, false],
    ['seedBomb', 'startDistance', 'Distância inicial do marcador', 'Onde o marcador aparece ao apertar, à frente do corpo (3 m).', .5, 10, .25, m, false],
    ['seedBomb', 'minRange', 'Alcance mínimo do marcador', '0 = pode colocar o destino colado em você.', 0, 10, .25, m, false],
    ['seedBomb', 'maxRise', 'Altura máxima de apoio acima dos pés', 'Até que altura de plataforma o marcador alcança (2 m).', 0, 6, .25, m, false],
    ['seedBomb', 'allowOccupied', 'Permitir destino sobre um lutador', 'Desligado: marcador inválido sobre personagens.', 0, 1, 1, yesno, false],
    ['seedBomb', 'counterStagger', 'Counter Stagger', 'Stagger do derrotado quando este projétil vence um Counter (M21.5: 0,2 s).', 0, 1, .01, sec, true],
  ]],
  ['IA com Moves (decisões do adversário)', [
    ['ai', 'newMovesRate', 'Uso dos Moves novos pela IA', 'Multiplica a chance de a IA usar Harden, Second Wind, Swift, Lunge, Quick Attack, Guard Break, Feint, Riposte, Bounce, Spikes, Sand Wave, Bullet Punch e Emerging Stone quando equipados nela (0 = nunca usa; só vale para o que estiver equipado).', 0, 3, .1, x, false],
    ['ai', 'evadeDistance', 'Esquiva emergencial: distância do Tackle rival', 'Durante a carga, se o rival inicia um Tackle a menos desta distância, a IA esquiva cancelando a carga (provisório).', 0, 10, .1, m, false],
    ['ai', 'pl2Distance', 'Psyshock: distância para carregar até PL2', 'A partir desta distância do alvo a IA segura o Psyshock até o PL2 (provisório).', 0, 15, .1, m, false],
    ['ai', 'pl3Distance', 'Psyshock: distância para carregar até PL3', 'A partir desta distância do alvo a IA segura o Psyshock até o PL3 (provisório).', 0, 20, .1, m, false],
    ['ai', 'reflectHold', 'Reflect: tempo mínimo segurando', 'Tempo mínimo que a IA segura o Reflect antes de soltar (provisório).', .5, 4, .05, sec, false],
    ['ai', 'lastSecondDefend', 'Defesa em cima da hora (janela)', 'Se um projétil chega em menos que isto, a IA solta a carga e defende (provisório).', 0, 1, .01, sec, false],
    ['ai', 'noTimeDefend', 'Defesa sem tempo para o PL (janela)', 'Sem tempo de carregar um Reflect de PL suficiente, a IA defende se o projétil chega em menos que isto (provisório).', 0, 1, .01, sec, false],
    ['ai', 'barrierBreakRange', 'Barreira rival: alcance para destruir com Tackle', 'A IA tenta destruir a barreira do adversário com Tackle a menos desta distância (provisório).', 0, 8, .1, m, false],
    ['ai', 'barrierBreakChance', 'Barreira rival: chance de tentar', 'Probabilidade de a IA investir contra a barreira quando está ao alcance (provisório).', 0, 1, .01, pct, false],
    ['ai', 'psyshockMinDistance', 'Psyshock ofensivo: distância mínima', 'A IA só usa o Psyshock acima desta distância do alvo (provisório).', 0, 12, .1, m, false],
    ['ai', 'psyshockMinStamina', 'Psyshock ofensivo: stamina mínima', 'Stamina mínima para a IA iniciar o Psyshock (provisório).', 0, 6, .1, num, false],
    ['ai', 'psyshockChanceMax', 'Psyshock ofensivo: chance máxima por decisão', 'Teto da probabilidade de usar o Psyshock quando é viável (provisório).', 0, 1, .01, pct, false],
    ['ai', 'afterChargeWait', 'Pausa depois de uma carga', 'Tempo que a IA espera depois de soltar ou perder uma carga antes de decidir de novo (provisório).', 0, 3, .05, sec, false],
    ['ai', 'decisionInterval', 'Intervalo entre decisões de Move', 'Tempo mínimo entre duas decisões de Move da IA (provisório).', .1, 3, .05, sec, false],
  ]],
  ['Laser (emissor técnico)', [
    ['beam', 'length', 'Alcance do feixe', 'Comprimento total somando os segmentos refletidos (provisório).', 4, 40, 1, m, false],
    ['beam', 'maxSegments', 'Segmentos máximos', 'Salvaguarda contra reflexões em cadeia (M17.2); acima disso o feixe para e avisa uma vez.', 1, 16, 1, int, false],
    ['beam', 'interval', 'Intervalo entre danos', 'Tempo entre dois danos do feixe no mesmo alvo (provisório).', .05, 1, .05, sec, false],
    ['beam', 'damage', 'Dano por acerto', 'Dano de cada acerto do emissor técnico, antes do Ataque (provisório).', 0, 20, .5, num, false],
  ]],
];

/** Controles da aba (exportado para os testes de cobertura: cada parâmetro da configuração dos Moves precisa de slider). */
// Pedido de 22/10/2026: o limite máximo dos sliders de Moves vale o DOBRO (liga/desliga e seletores de poucos valores ficam como estão).
for (const [, rows] of PARAMS) for (const r of rows) if (r[7] !== yesno && !(r[6] >= 1 && r[5] <= 3)) r[5] *= 2;
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
  let results = null, homolog = loadHomolog(), subscribed = false;
  const loadoutOf = id => Array.from({length: C.world.slots}, (_, i) => game.fighters[id]?.loadout?.[i] ?? null);
  const equipped = id => ({reflect: loadoutOf(id).includes('reflect'), psyshock: loadoutOf(id).includes('psyshock')});
  /** Descrição e uso do Move para dicas e linha de apoio: texto do Move, custo, recarga e botão. */
  const moveTip = (mid, key) => {const d = mid ? listMoves().find(m => m.id === mid) : null;if (!d) return '';const eff = getMove(mid) ?? d;return `${MOVE_INFO[mid]?.hint ?? d.description ?? ''} Custo ${(eff.cost ?? 1).toFixed(2)} de stamina · recarga ${(eff.cooldown ?? 0).toFixed(1)} s${key ? ` · botão ${key}` : ''}.`;};
  const moveLabel = mid => MOVE_INFO[mid]?.group ?? listMoves().find(m => m.id === mid)?.name ?? mid;
  /** Põe (ou tira, com null) um move num slot; um move não ocupa dois slots do mesmo lutador. */
  function setSlot(id, slot, moveId) {
    const list = loadoutOf(id);if (moveId) for (let i = 0; i < list.length; i++) if (list[i] === moveId) list[i] = null;
    list[slot] = moveId || null;game.setLoadout(id, list);
  }
  /** Compatível com o formato antigo: liga/desliga um move no primeiro slot livre (preferindo o slot clássico). Devolve false se não houver slot. */
  function setEquip(id, kind, on) {
    const list = loadoutOf(id), at = list.indexOf(kind);
    if (!on) {if (at >= 0) {list[at] = null;game.setLoadout(id, list);}return true;}
    if (at >= 0) return true;
    const pref = STANDARD.find(([k]) => k === kind)?.[2], slot = pref != null && !list[pref] ? pref : list.findIndex(v => !v);
    if (slot < 0) return false;
    list[slot] = kind;game.setLoadout(id, list);return true;
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
      <div class="row">${min === 0 && max === 1 && step === 1 ? `<input type="checkbox" data-p="${group}.${key}" ${v ? 'checked' : ''}>` : `<input type="range" data-p="${group}.${key}" min="${min}" max="${max}" step="${step}" value="${v}">`}<output data-o="${group}.${key}">${fmt(v)}</output><button type="button" data-reset="${group}.${key}" title="Padrão: ${escape(fmt(def))}" ${v === def ? 'disabled' : ''}>↺</button></div></div>`;
  }
  /** Cartão de animação (carga com loop + disparo) de um move para o personagem de um lado (0 azul, 1 vermelho). */
  function animCard(moveId, who) {
    const ch = ui?.characters?.[who], who_ = who ? 'Vermelho' : 'Azul';
    if (!ch) return `<div class="moves-anim-card"><small class="muted">${who_}: nenhum modelo GLB carregado. Carregue em <b>Personagens</b> para associar as animações deste move.</small></div>`;
    const conf = ch.getMoveAnimConfig(moveId), key = `${who}|${moveId}`;
    const chargeClip = conf.chargeClip != null ? ch.clips[conf.chargeClip] : null, chargeDur = chargeClip?.duration || 1.0;
    const loopEnd = Math.min(chargeDur, Math.max(0.02, conf.chargeLoopEnd ?? chargeDur)), loopStart = Math.min(Math.max(0, conf.chargeLoopStart || 0), Math.max(0, loopEnd - 0.02));
    const clipOptions = (selectedIdx, placeholder) => `<option value="">${placeholder}</option>` + ch.clips.map((c, i) => `<option value="${i}" ${i === selectedIdx ? 'selected' : ''}>${escape(c.name)} (${c.duration.toFixed(2)}s)</option>`).join('');
    const isPreviewing = ch.movePreview?.moveId === moveId;
    return `<div class="moves-anim-card" data-card="${key}">
      <div class="moves-anim-card-head"><div><h4>${who_} · animação e loop</h4></div>
        <button type="button" class="btn-preview-move ${isPreviewing ? 'active' : ''}" data-preview="${key}">${isPreviewing ? '⏹ Parar teste' : '▶ Testar carga (com loop) ➔ disparo'}</button></div>
      <div class="moves-anim-grid">
        <div class="moves-anim-col"><label>1. Animação de carga (segurar a tecla)</label>
          <select data-anim-select="charge" data-key="${key}">${clipOptions(conf.chargeClip, '— selecionar animação de carga —')}</select>
          <div class="moves-loop-slider-box">
            <label>Início do loop <output data-loop-out="${key}|start">${loopStart.toFixed(2)} s</output></label>
            <input type="range" data-loop-range="${key}" data-loop-edge="start" min="0" max="${Math.max(0, loopEnd - 0.02).toFixed(2)}" step="0.01" value="${loopStart.toFixed(2)}" ${chargeClip ? '' : 'disabled'}>
            <label>Fim do loop <output data-loop-out="${key}|end">${loopEnd.toFixed(2)} s</output></label>
            <input type="range" data-loop-range="${key}" data-loop-edge="end" min="${Math.min(chargeDur, loopStart + 0.02).toFixed(2)}" max="${chargeDur.toFixed(2)}" step="0.01" value="${loopEnd.toFixed(2)}" ${chargeClip ? '' : 'disabled'}>
            <div class="move-loop-timeline" data-loop-timeline="${key}">
              <div class="loop-intro" style="flex:${Math.max(0.001, loopStart)}" title="Introdução: 0,00 s a ${loopStart.toFixed(2)} s">${loopStart > 0.15 ? `Intro (${loopStart.toFixed(2)}s)` : ''}</div>
              <div class="loop-repeat" style="flex:${Math.max(0.001, loopEnd - loopStart)}" title="Trecho repetido: ${loopStart.toFixed(2)} s a ${loopEnd.toFixed(2)} s">🔁 Loop (${(loopEnd - loopStart).toFixed(2)}s)</div>
              <div class="loop-tail" style="flex:${Math.max(0.001, chargeDur - loopEnd)}" title="Depois do loop: ${loopEnd.toFixed(2)} s a ${chargeDur.toFixed(2)} s">${chargeDur - loopEnd > 0.15 ? 'Final' : ''}</div>
            </div>
          </div></div>
        <div class="moves-anim-col"><label>2. Animação de disparo (ao soltar a tecla)</label>
          <select data-anim-select="release" data-key="${key}">${clipOptions(conf.releaseClip, '— selecionar animação de disparo —')}</select>
          <p class="hint">Dispara ao soltar, com blend suave a partir da pose de carga, sem esperar o clipe de carga terminar.</p></div>
      </div></div>`;
  }

  /** Slots (até C.world.slots) de um lutador: move e botão de cada um. */
  function loadoutBox(id, title) {
    const list = loadoutOf(id), moves = listMoves(), bind = id ? C.extras.bindings2 : C.extras.bindings, codes = C.extras.keyCodes;
    const used = Object.entries(bind).filter(([k]) => !SKILL_NAMES.includes(k));
    const count = list.filter(Boolean).length;
    const rows = list.map((cur, slot) => {
      const myKey = bind[SKILL_NAMES[slot]], clash = used.find(([, i]) => i === myKey) ?? SKILL_NAMES.map((n, j) => [n, bind[n], j]).find(([, i, j]) => j !== slot && i === myKey && list[j]);
      const warn = cur && clash ? `<small class="warn" title="A mesma tecla também é ${escape(ACTION_NAMES[clash[0]] ?? 'outro slot')}">tecla repetida</small>` : '';
      return `<div class="mv-slot" data-slot-row="${id}.${slot}"><span class="mv-slot-n">Slot ${slot + 1}</span>
        <select data-slot-move="${id}.${slot}" aria-label="Move do slot ${slot + 1} (${escape(title)})" ${cur ? `data-tip-title="${escape(moveLabel(cur))}" data-tip="${escape(moveTip(cur, keyName(codes[myKey])))}"` : 'data-tip-title="Slot vazio" data-tip="Escolha um Move: passe o mouse sobre o nome para ver a descrição e o uso."'}><option value="">— vazio —</option>${moves.map(m => `<option value="${m.id}" title="${escape(moveTip(m.id, ''))}" ${m.id === cur ? 'selected' : ''} ${list.includes(m.id) && m.id !== cur ? 'disabled' : ''}>${escape(moveLabel(m.id))}</option>`).join('')}</select>
        <label class="mv-key">Botão <select data-slot-key="${id}.${slot}" aria-label="Botão do slot ${slot + 1} (${escape(title)})">${codes.map((c, i) => `<option value="${i}" ${i === myKey ? 'selected' : ''}>${escape(keyName(c))}</option>`).join('')}</select></label>${warn}</div>${cur ? `<p class="tip-line">${escape(moveTip(cur, keyName(codes[myKey])))}</p>` : ''}`;
    }).join('');
    return `<div class="mv-loadout" data-loadout="${id}"><h4>${escape(title)} <small class="muted">${count} de ${list.length} slots${id ? ' · botões só valem no controle manual do vermelho' : ''}</small></h4>${rows}</div>`;
  }

  function paramGroup(title, open = false) {
    const g = PARAMS.find(([t]) => t === title);if (!g) return '';
    return `<details data-k="p:${escape(title)}" ${open ? 'open' : ''}><summary><b>${escape(title)}</b></summary>${g[1].map(paramRow).join('')}</details>`;
  }

  /** Liga os controles de parâmetros (data-p) de um escopo: arrastar mostra o valor ao vivo e, ao soltar, entra UMA entrada no histórico do ajustador (Ctrl+Z / Ctrl+Y). */
  function bindParams(scope, rerender) {
    const before = new Map(), label = path => PARAMS.flatMap(p => p[1]).find(r => r[0] + '.' + r[1] === path)?.[2] ?? path;
    const show = (inp, v) => {const [g, k] = inp.dataset.p.split('.'), spec = PARAMS.flatMap(p => p[1]).find(r => r[0] === g && r[1] === k);scope.querySelector(`[data-o="${inp.dataset.p}"]`).textContent = spec[7](v);scope.querySelector(`[data-reset="${inp.dataset.p}"]`).disabled = v === defaults().world[g][k];};
    const commit = (changes, text) => tuning ? tuning.commit(changes, text) : changes.forEach(([p, , v]) => {const [g, k] = p.replace(/^world\./, '').split('.');C.world[g][k] = v;});
    for (const inp of scope.querySelectorAll('[data-p]')) {
      const [g, k] = inp.dataset.p.split('.'), path = `world.${g}.${k}`;
      if (inp.type === 'checkbox') {inp.onchange = () => {commit([[path, inp.checked ? 1 : 0]], label(inp.dataset.p));rerender();};continue;}
      inp.oninput = () => {const v = Number(inp.value);if (!before.has(path)) before.set(path, C.world[g][k]);C.world[g][k] = v;show(inp, v);};
      inp.onchange = () => {const after = C.world[g][k], was = before.get(path);before.delete(path);if (was !== undefined && was !== after) {C.world[g][k] = was;commit([[path, after]], label(inp.dataset.p));}rerender();};
    }
    for (const b of scope.querySelectorAll('[data-reset]')) b.onclick = () => {const [g, k] = b.dataset.reset.split('.');commit([[`world.${g}.${k}`, defaults().world[g][k]]], 'Restaurar ' + label(b.dataset.reset));rerender();};
  }
  /** Parâmetros da IA com Moves, para a aba IA da gaveta de Ações (antes ficavam na aba Moves). */
  function renderAiParams(container) {
    container.innerHTML = paramGroup('IA com Moves (decisões do adversário)', true);
    bindParams(container, () => renderAiParams(container));
  }
  function render() {
    const openKeys = new Set([...root.querySelectorAll('details[open][data-k]')].map(d => d.dataset.k));   // a interface não recolhe os grupos que você abriu
    const l0 = loadoutOf(0), l1 = loadoutOf(1), eqIds = listMoves().map(m => m.id);
    const scen = results ? results.map(s => `<details data-k="s:${s.id}" ${s.ok ? '' : 'open'}><summary class="${s.ok ? 'ok' : 'warn'}">${s.ok ? '✓' : '✗'} ${escape(s.name)}</summary><table><tr><th>Verificação</th><th>Esperado</th><th>Obtido</th></tr>${s.rows.map(r => `<tr class="${r.ok ? 'ok' : 'warn'}"><td>${r.ok ? '✓' : '✗'} ${escape(r.what)}</td><td>${escape(r.expected)}</td><td>${escape(r.got)}</td></tr>`).join('')}</table></details>`).join('') : '<p class="hint">Cada cenário roda num duelo isolado, com semente fixa e os ajustes atuais, e compara esperado × obtido.</p>';
    const cards = eqIds.map(mid => {
      const info = MOVE_INFO[mid], owners = [[0, l0], [1, l1]].filter(([, l]) => l.includes(mid)).map(([w, l]) => `${w ? 'Vermelho' : 'Azul'}: slot ${l.indexOf(mid) + 1}${w ? '' : ` · botão ${escape(keyName(C.extras.keyCodes[C.extras.bindings[SKILL_NAMES[l.indexOf(mid)]]]))}`}`).join(' · ');
      const anims = [0, 1].filter(w => (w ? l1 : l0).includes(mid)).map(w => animCard(mid, w)).join('');
      return `<details class="mv-move" data-move="${mid}" data-k="move:${mid}"><summary><b>✦ ${escape(moveLabel(mid))}</b><small class="muted">${owners || 'Não equipado'}</small></summary>
        ${info?.hint ? `<p class="hint">${escape(info.hint)}</p>` : ''}${anims}${info ? paramGroup(info.group) : '<p class="hint">Este move ainda não tem parâmetros ajustáveis nesta tela.</p>'}${elementalVisualMarkup(mid)}</details>`;
    }).join('');
    const shared = eqIds.length ? `<section class="mv-move" data-move="_charge"><header><h3>⚙ Carga (todos os moves equipados)</h3></header>${paramGroup('Carga (compartilhada)')}</section>` : '';
    root.innerHTML = `
      <p class="hint">Escolha até <b>${C.world.slots} moves por personagem</b> e o <b>botão</b> de cada slot. Todos os Moves têm grupos expansíveis abaixo; os valores entram no JSON de Exportar.</p>
      <div class="row"><button type="button" id="mvp-export-params">↓ Exportar parâmetros dos Moves (JSON)</button></div>
      <section class="mv-card"><h3>Equipar</h3>${loadoutBox(0, 'Jogador (azul)')}${loadoutBox(1, 'Adversário (vermelho)')}</section>
      ${elementalGlobalMarkup()}${cards}${shared}
      <details class="mv-tools" data-k="tools"><summary><b>Ferramentas de teste</b> <small class="muted">emissores, laser, cenários técnicos, estilo dos efeitos e avaliação</small></summary>
      <div class="vfx-quick-style">
        <b>Estilo VFX dos Golpes:</b>
        <div class="seg" role="group" aria-label="Variante dos Moves">
          <button type="button" data-moves-vfx="0" ${(C.vfx.hit?.variant === 0) ? 'aria-pressed="true"' : 'aria-pressed="false"'}>A (Arcade)</button>
          <button type="button" data-moves-vfx="1" ${(C.vfx.hit?.variant === 1) ? 'aria-pressed="true"' : 'aria-pressed="false"'}>B (Halo)</button>
          <button type="button" data-moves-vfx="2" ${(C.vfx.hit?.variant === 2) ? 'aria-pressed="true"' : 'aria-pressed="false"'}>C (Tático)</button>
        </div>
      </div>
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
      ${paramGroup('Laser (emissor técnico)')}
      <details class="mvp-hom-fold" data-k="homolog"><summary><b>Avaliação jogável dos Moves (${MOVES_HOMOLOG.length})</b></summary>
      <p class="hint">A sua aprovação (separada dos testes automáticos). Fica salva neste navegador e vai no JSON exportado.</p>
      ${MOVES_HOMOLOG.map((t, i) => `<div class="mvp-hom"><div>${escape(t)}</div><div class="row"><select data-hom="${i}"><option value="">pendente</option><option value="ok" ${homolog[i]?.v === 'ok' ? 'selected' : ''}>aprovado</option><option value="no" ${homolog[i]?.v === 'no' ? 'selected' : ''}>reprovado</option></select><input type="text" data-hom-note="${i}" placeholder="observação" value="${escape(homolog[i]?.n ?? '')}"></div></div>`).join('')}</details>
      <div class="row"><button type="button" id="mvp-reset-all">Restaurar todos os padrões dos moves</button></div></details>`;
    for (const d of root.querySelectorAll('details[data-k]')) if (openKeys.has(d.dataset.k)) d.open = true;

    // Slots: move e botão de cada um (o botão é o mesmo de Controles › Teclas e entra no desfazer).
    for (const sel of root.querySelectorAll('[data-slot-move]')) sel.onchange = () => {const [id, slot] = sel.dataset.slotMove.split('.').map(Number);setSlot(id, slot, sel.value || null);render();};
    for (const sel of root.querySelectorAll('[data-slot-key]')) sel.onchange = () => {
      const [id, slot] = sel.dataset.slotKey.split('.').map(Number), path = `extras.${id ? 'bindings2' : 'bindings'}.${SKILL_NAMES[slot]}`;
      if (tuning) tuning.commit([[path, Number(sel.value)]], `Botão do slot ${slot + 1}`);else {const [, g, k] = path.split('.');C.extras[g][k] = Number(sel.value);}
      render();
    };

    // Animação de carga (loop) e disparo, por lado.
    const chOf = key => ui?.characters?.[Number(key.split('|')[0])], moveOf = key => key.split('|')[1];
    for (const sel of root.querySelectorAll('[data-anim-select]')) sel.onchange = () => {
      const ch = chOf(sel.dataset.key);if (!ch) return;
      ch.setMoveAnim(moveOf(sel.dataset.key), sel.dataset.animSelect, sel.value === '' ? null : Number(sel.value));render();
    };
    for (const inp of root.querySelectorAll('[data-loop-range]')) inp.oninput = () => {
      const key = inp.dataset.loopRange, ch = chOf(key), moveId = moveOf(key);if (!ch) return;
      const conf0 = ch.getMoveAnimConfig(moveId), chargeClip = conf0.chargeClip != null ? ch.clips[conf0.chargeClip] : null, chargeDur = chargeClip?.duration || 1.0;
      if (inp.dataset.loopEdge === 'start') ch.setMoveChargeLoopStart(moveId, Number(inp.value));else ch.setMoveChargeLoopEnd(moveId, Number(inp.value));
      const conf = ch.getMoveAnimConfig(moveId), start = conf.chargeLoopStart || 0, end = conf.chargeLoopEnd ?? chargeDur;
      const st = root.querySelector(`[data-loop-range="${key}"][data-loop-edge="start"]`), en = root.querySelector(`[data-loop-range="${key}"][data-loop-edge="end"]`);
      st.max = Math.max(0, end - 0.02).toFixed(2);en.min = Math.min(chargeDur, start + 0.02).toFixed(2);st.value = start.toFixed(2);en.value = end.toFixed(2);
      root.querySelector(`[data-loop-out="${key}|start"]`).textContent = `${start.toFixed(2)} s`;root.querySelector(`[data-loop-out="${key}|end"]`).textContent = `${end.toFixed(2)} s`;
      const tl = root.querySelector(`[data-loop-timeline="${key}"]`), intro = tl?.querySelector('.loop-intro'), rep = tl?.querySelector('.loop-repeat'), tail = tl?.querySelector('.loop-tail');
      if (intro) {intro.style.flex = String(Math.max(0.001, start));intro.textContent = start > 0.15 ? `Intro (${start.toFixed(2)}s)` : '';}
      if (rep) {rep.style.flex = String(Math.max(0.001, end - start));rep.textContent = `🔁 Loop (${(end - start).toFixed(2)}s)`;}
      if (tail) {tail.style.flex = String(Math.max(0.001, chargeDur - end));tail.textContent = chargeDur - end > 0.15 ? 'Final' : '';}
    };
    const previewIdle = '▶ Testar carga (com loop) ➔ disparo';
    for (const b of root.querySelectorAll('[data-preview]')) b.onclick = () => {
      const key = b.dataset.preview, ch = chOf(key), moveId = moveOf(key);if (!ch) return;
      if (ch.movePreview?.moveId === moveId) {ch.stopMovePreview();b.classList.remove('active');b.textContent = previewIdle;return;}
      for (const o of root.querySelectorAll('[data-preview]')) {o.classList.remove('active');o.textContent = previewIdle;}
      b.classList.add('active');b.textContent = '⏹ Parar teste';
      ch.startMovePreview(moveId, () => {b.classList.remove('active');b.textContent = previewIdle;});
    };
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
    if (!subscribed && tuning?.onChange) {subscribed = true;tuning.onChange(() => {
      if (!root.closest('[data-section="moves"]')?.hidden && !root.querySelector('[data-p]:active')) render();
      const activeVar = C.vfx.hit?.variant ?? 0;
      for (const x of root.querySelectorAll('[data-moves-vfx]')) {
        x.setAttribute('aria-pressed', String(Number(x.dataset.movesVfx) === activeVar));
      }
    });}
    
    for (const b of root.querySelectorAll('[data-laser]')) b.onclick = () => {const k = b.dataset.laser;(k === 'sweep' ? emitLaser(1, .8) : emitLaser(Number(k)));};
    for (const b of root.querySelectorAll('[data-laser-scene]')) b.onclick = () => testLaserScene(b.dataset.laserScene);
    for (const b of root.querySelectorAll('[data-emit]')) b.onclick = () => {const k = b.dataset.emit;(k === 'boom' ? emitExplosion() : emitProjectile(Number(k)));};
    $('mvp-run').onclick = () => {results = runMoveScenarios();render();};
    $('mvp-export').onclick = () => results && download(JSON.stringify({schema: 'arenamon-lab-report', version: 1, kind: 'moves-scenarios', createdAt: new Date().toISOString(), step: C.test.step, scenarios: results, homologation: MOVES_HOMOLOG.map((t, i) => ({item: t, verdict: homolog[i]?.v || 'pendente', note: homolog[i]?.n || ''}))}, null, 1), 'arenamon-cenarios-moves.json');
    $('mvp-export-params').onclick = () => download(JSON.stringify(tuning.exportData(), null, 2), 'arenamon-parametros-moves.json');
    bindParams(root, render);
    bindElementalVisual(root, tuning);
    $('mvp-reset-all').onclick = () => {const ch = [];for (const g of ['charge', 'reflect', 'psyshock', 'beam', 'ai']) for (const [k, v] of Object.entries(defaults().world[g])) if (C.world[g][k] !== v) ch.push([`world.${g}.${k}`, v]);commit(ch, 'Restaurar os parâmetros dos Moves');render();};
  }
  return {render, renderAiParams, emitProjectile, emitLaser, emitExplosion, setEquip, setSlot, loadoutOf, get results() {return results;}, STANDARD};
}
