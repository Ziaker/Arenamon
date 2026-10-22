# Checklist de correções do laboratório (22/10/2026)

Pedidos do responsável, com o estado de cada um. «Feito» = alterado, compilado e coberto por teste de simulação; **nenhum item foi visto rodando na tela** (o navegador embutido não abriu o HTML local). Teste você mesmo em `prototypes/combat-lab/dist/arenamon-combate-laboratorio.html` (atalho `JOGAR_ARENAMON.html`).

| # | Pedido | Estado | Onde / como conferir |
|---|--------|--------|----------------------|
| 1 | Moves que invocam objetos ou deslocam bloqueados em certos momentos | Feito (no ar) | O bloqueio era o **ar**: no salto, na queda de borda e no arco do vault da esquiva nenhum Move podia ser usado. Agora cada Move declara `air` (`sim/air.js`): **cast** = o corpo segue em voo (Harden, Second Wind, Swift, Riposte, Feint, Reflect, Psyshock, Spikes, Emerging Stone, Sand Wave nasce no chão sob o corpo, Bounce parte da altitude atual) e **descend** = desce suavemente em `actions.cancel.airDescent` enquanto age, como o C → X do vault (Lunge, Quick Attack, Guard Break, Bullet Punch). Lançado por golpe e preso na parede continuam sem comando. Teste `moves-air` (13) + varredura de travamentos com 60 partidas aleatórias. Não mexi na recuperação de pouso nem no guard stun. |
| 2 | Riposte sem efeito visual na ativação | Feito | `view/riposte-fx.js`: postura (disco de aço + lâmina de guarda; dourados dentro da janela) e contra-golpe (clarão, anel, corte em X). Controles em **Ações › Moves › Riposte**: efeito ligado, intensidade e tamanho. |
| 3 | Limite dos sliders de combate muito pequeno | Feito | Máximo ×2 nos sliders de regras, ações, Moves, atributos, locomoção, passivas, física e salto/footstool (`ui/tuning.js` e `ui/moves-panel.js`). Liga/desliga e seletores não mudam. Valores já fora da faixa continuam permitidos. |
| 4 | Opção «término do movimento trava outros movimentos pela duração da animação» sumiu | Feito (visível + estendida) | Estava escondida em Personagens › avançado (`Usar duração dos clipes nas regras`) e só cobria X, C, recuo, guard stun e pouso. Agora há um atalho no topo da gaveta **Ações** (mesma opção) e ela também ajusta o **cast dos Moves** equipados que têm clipe próprio `move_N`. |
| 5 | Botões de IA do jogador e do oponente na HUD superior ao lado da busca | Feito | Barra superior: «🤖 IA jogador» e «🧠 IA oponente», com ON/OFF visível (antes ficavam no menu Ferramentas). |
| 6 | Tooltip com descrição e uso na seleção de Moves e habilidades | Feito | Ações › Moves (slots) e aba Passivas: passar o mouse no seletor mostra título, descrição e uso (Moves: custo, recarga e botão; passivas: gatilho e efeito). Também há uma linha de descrição visível sob cada escolha e `title` em cada opção da lista. |
| 7 | Calibração enviada passa a ser a base do jogo | Feito | `src/sim/calibration-base.js` (184 linhas, reversíveis) + `prototypes/game/src/config.ts`. Detalhes em `docs/CALIBRACAO_BASE_V8.md`. |
| 8 | Riposte sem clash e recarga acelerada em TODOS os Moves | Feito (já existia na branch `feat/calibracao-v8-base`) | Teste `moves-cooldown-boost` e `slam-riposte-rules`. |
| 9 | Bullet Punch deixa o personagem invisível e intangível para sempre se usado sobre plataforma | Feito | Causa: o lutador «ausente» caía da borda da plataforma durante a viagem invisível (queda R7.10), o que apagava a ação e deixava `absent` ligado. Correção em `sim/physics.js` (ausente não cai) e `sim/controller.js` (rede de segurança: ausência só existe com a ação de viagem). Teste `moves-softlock` (reprodução exata + 12 partidas aleatórias com os 15 Moves procurando ausência, ação, voo, invulnerabilidade, mira, carga e recuperação presos: nenhum). |

## Auditoria de travamentos nos outros Moves (item 9)
Varredura com entradas aleatórias (movimento, esquiva, tackle, defesa, salto e os 4 slots) em partidas completas, plataformas do mapa e a calibração atual, com todos os 15 Moves sorteados nos slots: **nenhum estado preso** depois da correção. Casos de falha de efeito observados (custo devolvido, sem travar): Spikes `invalidPlacement:occupied`; cancelamentos de marcador: Spikes (`invalidMarker`, golpe sofrido) e Emerging Stone (perda de apoio no cast).

## Pendências que dependem de você
- Item 1: ver no jogo se o tratamento de cada Move no ar (cast × descend) está como você queria; o que o responsável decidir vira `air: 'cast' | 'descend' | 'none'` no registro do Move.
- Faixa de montagem em caixas de 2,2 m (resíduo de colisão, ver `CALIBRACAO_BASE_V8.md`).
- Nenhum teste de navegador foi executado nesta rodada.
