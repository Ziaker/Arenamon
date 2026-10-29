# Game feel 5–9 — implementação (v1.48.0)

Brief de origem: `docs/ARENAMON_GAME_FEEL_IMPROVEMENTS_5_9_EN.docx`. Tudo abre em `JOGAR_ARENAMON.html`; todos os controles estão em **Ajustes › Visual › «Game feel 5–9»** (`C.extras.gameFeel`) e, por personagem, em **Personagens › Altura visual**.

Regra geral: **apresentação apenas**. Dano, stamina, recargas, colisão, Power Level, IA e permissões de Moves não mudam. A única chave que escolhe a fonte de tempos do combate é `phaseMode` (padrão 0 = Definição, paridade total).

| # | Recurso | Onde está | Padrão | Controles |
|---|---|---|---|---|
| 5 | Feedback de golpe no vazio | `src/view/whiff-fx.js` | **ligado** | liga/desliga, rastro (×), poeira (×), giro de desequilíbrio (°), distância mínima (m) |
| 7 | Animações de borda | `src/view/characters.js` | clipes só se existirem | ajuste vertical/horizontal da pose (m) global e por personagem |
| 8 | Apoio visual dos pés (IK) | `src/view/rig-layers.js` | **desligado** | correção do tornozelo, da pelve, suavização, velocidade de plantio, alinhamento da sola |
| 9 | Olhar para o alvo travado | `src/view/rig-layers.js` | **desligado** | limite da cabeça (yaw/pitch), tronco (%), suavização, tempo de soltura |
| 6 | Fases da animação no combate | `src/sim/phase-contract.js` | **Definição (0)** | modo, autorização por fase, tabela antes/depois, «Restaurar» por fase |

## 5 · Golpe no vazio
Um tackle que **termina sozinho sem nenhum alvo em `action.hits`** (o combate grava ali bloqueio, defesa perfeita, reflexo, absorção e invulnerabilidade, então esses casos já ficam de fora) dispara: linhas de ar, poeira rente ao chão e um pequeno giro de desequilíbrio na recuperação. Não gera número de dano, clarão, hit stop, tremor nem som de acerto. Dispara uma vez por execução. O evento `feintWhiff` (finta fora da janela) tem tratamento próprio (arco curto para trás, sem poeira). Respeita «Reduzir movimento» (sem giro e sem esticar) e «Sem flashes» (brilho limitado). Dono único do canal `whiff` no despachante (`vfx/dispatch.js`).

## 7 · Borda
Estados novos: `ledge_grab` (entrada, enquanto a simulação encaixa), `ledge_hang` (laço), `ledge_climb` (acompanha a duração da subida da simulação, sem reinício), `ledge_drop` (ao soltar) e `ledge_blocked` (subida bloqueada, depois volta ao hang). Reservas preservadas: sem clipe, grab → hang → wall_splat → fall; climb → jump → vault; drop → fall; blocked → hang. As ações aparecem no editor de animações no grupo «Borda (Ledge Grab)». O deslocamento é só visual (a física não muda; sem root motion).

## 8 e 9 · Pés e olhar
`RigLayers` detecta coxa/canela/pé, tronco/pescoço e cabeça por nome (Mixamo, Rigify e similares). Perna ausente, ambígua ou com cadeia/eixos inválidos desliga **só aquela perna/camada** e mostra o motivo em «Personagens» (diagnóstico do rig). As rotações são calculadas em espaço mundial, então não dependem da orientação local dos ossos. Os pés usam IK de dois ossos com correção limitada, pelve compartilhada e fade em salto, queda, knockback, borda e vault. O olhar usa **apenas o alvo já travado pela simulação** (`action.lock` ou o ponto de mira confirmado), limita cabeça e tronco, desliga em hitstun/stagger/parede/derrota/borda/ar e volta suave à pose base.

## 6 · Fases da animação
Modos: **Definição** (padrão), **Animação aprovada** e **Comparar** (só calcula a tabela). No modo aprovado cada fase (ativa, cancelamento, invulnerabilidade) precisa de autorização própria. O contrato é validado (ordem, sobreposição, duração, janela ativa com ≥ 1 passo, cancelamento não antes do primeiro compromisso, clipe presente); **qualquer falha rejeita o contrato inteiro** e o combate usa a definição, com a mensagem exata no painel. O contrato resolvido vai nas janelas de combate do `Game` (salvas no replay). Novos marcadores de clipe aceitos: `cancel_start` / `cancel_end`.

## Modelos grandes (Wookada como referência)
O Wookada (1,85× em altura e largura) é a referência de modelo pesado. Testado no jogo real com ele: rastro e poeira do golpe no vazio nascem a partir do tamanho **visual** (antes ficavam dentro do corpo); na borda o modelo baixa o excedente de altura (`ledgeSizeComp`, ×) para as mãos ficarem na quina, sem afundar abaixo do piso; os pés (correção até 0,2 m numa plataforma de 0,15 m) e o olhar (alvo travado a ~30°) rodaram sem NaN e sem erro de página.

## Verificação
- `node prototypes/combat-lab/test/game-feel-5-9.test.mjs` (21 verificações: decisão de whiff, detecção de rig, limites de olhar, contrato de fases, paridade com o modo Definição).
- `test/game-feel-wookada.browser.mjs`: partida real IA × IA com Wookada × Cogumelo, 12 s em tempo real, sem erro de página nem NaN.
- `test/game-feel-cenas.browser.mjs`: cenas dirigidas no jogo real (golpe no vazio, borda, degrau, olhar) com capturas em `evidence/game-feel-5-9/`.
