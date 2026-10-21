// Aba Moves: equipar Reflect e Psyshock, ajustar os parâmetros (valem só para os PRÓXIMOS usos, M28.4), emitir projéteis e explosões de teste
// na partida e rodar os cenários técnicos repetíveis (M28.3, M28.8). Valores marcados “provisório” são pontos de partida (M30.10), não decisões.
import {C, defaults} from '../sim/config.js';
import {spawn} from '../sim/world.js';
import {listMoves} from '../sim/moves.js';
import {runMoveScenarios} from '../sim/scenarios-moves.js';
/** Escapa texto para HTML (local: importar o ajustador arrastaria o config.ts do jogo, que só o esbuild lê). */
const escape = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

const STANDARD = [['reflect', 'Reflect', 0], ['psyshock', 'Psyshock', 1]];
/** Informações de interface por move (o que o registro não traz): grupo de parâmetros e texto de apoio. Moves novos funcionam sem entrada aqui. */
export const MOVE_INFO = {
  reflect: {group: 'Reflect', hint: 'Barreira refletora frontal. Segure para carregar, solte para criar.'},
  psyshock: {group: 'Psyshock', hint: 'Pedras psíquicas com homing. Segure para carregar, solte para disparar.'},
  harden: {group: 'Harden', hint: 'Normal · Status. Toque para endurecer: +30% de Defesa e nenhum knockback ofensivo por 5 s (cast de 0,35 s).'},
  swift: {group: 'Swift', hint: 'Burst · Projectile · PL1. Toque para disparar 3 estrelas com homing curto (com alvo travado) ou em leque (sem alvo).'},
  lunge: {group: 'Lunge', hint: 'Burst · Melee · PL1. Toque para avançar 3,5 m em linha reta com um Tackle curto e ficar onde parou.'},
  'quick-attack': {group: 'Quick Attack', hint: 'Burst · Melee · PL1. Toque para investir no adversário mais próximo (até 7 m) e voltar na hora ao ponto de partida. Sem alvo ao alcance, não faz nada.'},
  'second-wind': {group: 'Second Wind', hint: 'Normal · Status. Toque para regenerar stamina bem mais rápido e gastar 25% menos em esquiva e sprint por 5 s (cast de 0,35 s).'},
};
const SKILL_NAMES = ['skill1', 'skill2', 'skill3', 'skill4'];
const ACTION_NAMES = {forward: 'Mover ↑', back: 'Mover ↓', left: 'Mover ←', right: 'Mover →', tackle: 'Tackle (X)', dodge: 'Esquiva (C)', defend: 'Defesa (D)', lock: 'Travar alvo', pause: 'Pausar', restart: 'Reiniciar', debug: 'Depuração'};
const keyName = code => String(code ?? '?').replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, 'Num ').replace('Arrow', 'Seta ').replace('Space', 'Espaço').replace('Escape', 'Esc');
const yesno = v => v ? '1 · sim' : '0 · não';
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
  ]],
  ['IA com Moves (decisões do adversário)', [
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
        <select data-slot-move="${id}.${slot}" aria-label="Move do slot ${slot + 1} (${escape(title)})"><option value="">— vazio —</option>${moves.map(m => `<option value="${m.id}" ${m.id === cur ? 'selected' : ''} ${list.includes(m.id) && m.id !== cur ? 'disabled' : ''}>${escape(moveLabel(m.id))}</option>`).join('')}</select>
        <label class="mv-key">Botão <select data-slot-key="${id}.${slot}" aria-label="Botão do slot ${slot + 1} (${escape(title)})">${codes.map((c, i) => `<option value="${i}" ${i === myKey ? 'selected' : ''}>${escape(keyName(c))}</option>`).join('')}</select></label>${warn}</div>`;
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
    const l0 = loadoutOf(0), l1 = loadoutOf(1), eqIds = [...new Set([...l0, ...l1].filter(Boolean))];
    const scen = results ? results.map(s => `<details data-k="s:${s.id}" ${s.ok ? '' : 'open'}><summary class="${s.ok ? 'ok' : 'warn'}">${s.ok ? '✓' : '✗'} ${escape(s.name)}</summary><table><tr><th>Verificação</th><th>Esperado</th><th>Obtido</th></tr>${s.rows.map(r => `<tr class="${r.ok ? 'ok' : 'warn'}"><td>${r.ok ? '✓' : '✗'} ${escape(r.what)}</td><td>${escape(r.expected)}</td><td>${escape(r.got)}</td></tr>`).join('')}</table></details>`).join('') : '<p class="hint">Cada cenário roda num duelo isolado, com semente fixa e os ajustes atuais, e compara esperado × obtido.</p>';
    const cards = eqIds.map(mid => {
      const info = MOVE_INFO[mid], owners = [[0, l0], [1, l1]].filter(([, l]) => l.includes(mid)).map(([w, l]) => `${w ? 'Vermelho' : 'Azul'}: slot ${l.indexOf(mid) + 1}${w ? '' : ` · botão ${escape(keyName(C.extras.keyCodes[C.extras.bindings[SKILL_NAMES[l.indexOf(mid)]]]))}`}`).join(' · ');
      const anims = [0, 1].filter(w => (w ? l1 : l0).includes(mid)).map(w => animCard(mid, w)).join('');
      return `<section class="mv-move" data-move="${mid}"><header><h3>✦ ${escape(moveLabel(mid))}</h3><small class="muted">${owners}</small></header>
        ${info?.hint ? `<p class="hint">${escape(info.hint)}</p>` : ''}${anims}${info ? paramGroup(info.group) : '<p class="hint">Este move ainda não tem parâmetros ajustáveis nesta tela.</p>'}</section>`;
    }).join('');
    const shared = eqIds.length ? `<section class="mv-move" data-move="_charge"><header><h3>⚙ Carga (todos os moves equipados)</h3></header>${paramGroup('Carga (compartilhada)')}</section>` : '';
    root.innerHTML = `
      <p class="hint">Escolha até <b>${C.world.slots} moves por personagem</b> e o <b>botão</b> de cada slot. Segure para carregar e solte para executar. Só aparecem os ajustes dos moves equipados.</p>
      <section class="mv-card"><h3>Equipar</h3>${loadoutBox(0, 'Jogador (azul)')}${loadoutBox(1, 'Adversário (vermelho)')}</section>
      ${cards || '<p class="hint mv-empty">Nenhum move equipado. Escolha um nos slots acima para ver os ajustes, animações e loops dele.</p>'}${shared}
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
      if (!root.closest('#moves-drawer')?.hidden && !root.querySelector('[data-p]:active')) render();
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
    bindParams(root, render);
    $('mvp-reset-all').onclick = () => {const ch = [];for (const g of ['charge', 'reflect', 'psyshock', 'beam', 'ai']) for (const [k, v] of Object.entries(defaults().world[g])) if (C.world[g][k] !== v) ch.push([`world.${g}.${k}`, v]);commit(ch, 'Restaurar os parâmetros dos Moves');render();};
  }
  return {render, renderAiParams, emitProjectile, emitLaser, emitExplosion, setEquip, setSlot, loadoutOf, get results() {return results;}, STANDARD};
}
