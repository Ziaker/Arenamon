# Eggo · sprint (Sprint 1)

Estado: **v9 APROVADA pelo responsável** (31/10/2026). Pedido: 4 pulinhos nos mesmos 32 frames, com pisada forte e impacto. A v1 (4 m por pisada) foi recusada («4 metros parece imenso, eu digo 0,8 metros»); a v2 também («mudou tudo além de só a distância» e as pernas não esticavam). Ideia escolhida: **1 corrida para a frente** +
corpo girando no jogo (pernas para onde corre, tronco/cabeça para o rival). A parte do jogo só começa depois da
animação aprovada.

## Sprint nas outras direções: corpo girando no jogo (v1.49.16)

- **Onde ajustar:** `JOGAR_ARENAMON.html` › Ajustes › aba **X e C** › bloco **«Sprint em qualquer direção (corpo girando)»**:
  ligar/desligar, velocidade do giro das pernas (°/s, padrão 540), torção máxima do tronco (°, 60), quanto a cabeça
  ainda acompanha (°, 45) e o ângulo a partir do qual ele corre de costas (°, 110).
- **Como funciona (só visual, a física não muda):** personagem que tem só o sprint para a frente (sem `sprint_back`,
  `sprint_left` e `sprint_right`, como o Eggo) toca o `sprint` em qualquer direção; o corpo (pernas e quadril) gira para
  onde ele corre e o tronco e a cabeça torcem de volta para o rival. Correndo de costas (acima de 110°), o tronco solta e
  só a cabeça olha por cima do ombro. Quem já tem clipes direcionais (ex.: Wookada) continua igual.
- Código: `prototypes/combat-lab/src/view/sprint-turn.js` (+ `applyTwist` em `rig-layers.js`); teste:
  `prototypes/combat-lab/test/sprint-turn.test.mjs`.
- **Eggo no jogo (v1.49.17):** `chars/Eggo/eggo.glb` vem embutido no `JOGAR_ARENAMON.html` (como o Wookada) e aparece
  nos seletores de personagem do Azul/Vermelho como **eggo.glb**. Tem só as 13 animações aprovadas, já com os nomes que o
  jogo reconhece: `idle`, `walk`, `sprint`, `dodge forward/back/left/right`, `jump`, `jump start/rise/apex/fall`, `land`.
  Exportado de `chars/Eggo/eggo sprint v9.blend` por `scripts/blender-vision/exportar_eggo_glb.py` (Blender em segundo
  plano; o .blend não é alterado). Teste: `prototypes/combat-lab/test/eggo-sprint-turn.browser.mjs` (13 animações
  reconhecidas; para o lado o corpo gira 90° e a cabeça fica a −3° do rival; de costas, corpo 180°, tronco solto e
  cabeça a 45°).
- O pulinho de 7 cm do sprint só aparece com **«Trava ao chão» desligada** para a animação `sprint` (editor de animação,
  grupo Movimento); com ela ligada (padrão) o jogo apoia o pé no chão e o sobe-desce some.
- Não verificado: jogar com o Eggo de verdade (só testes automáticos); o Eggo ainda não tem ataque, dano, defesa etc.

## Onde abrir

- Arquivo: `chars/Eggo/eggo sprint v9.blend` (Action `Sprint 1`).
- Folhas dos 32 frames (lado e frente): `scripts/blender-vision/evidence/eggo_sprint_v9/shot_Sprint_1/report.html`; os 4 impactos lado a lado em `impactos.png`.
- Motion Lens / Direction Lines: `scripts/blender-vision/evidence/eggo_sprint_v9/motion_lens_Sprint_1/`.
- Scripts (gerador e pose do responsável): `scripts/blender-vision/evidence/eggo_sprint_v9/*.py`.
- v8 (histórico, 2 pisadas): `chars/Eggo/eggo sprint v8.blend`.
- v7 (histórico, braços em onda): `chars/Eggo/eggo sprint v7.blend`.
- Script dos braços: `scripts/blender-vision/evidence/eggo_sprint_v7/eggo_sprint_bracos_onda.py`.
- v6 (histórico): `chars/Eggo/eggo sprint v6.blend`.
- A edição do responsável no f5, intacta, antes de qualquer mudança minha: `chars/Eggo/eggo sprint v5 com f5 do usuario.blend`.
- Histórico: `eggo sprint v1.blend` (4 m), `v2` (0,8 m com tudo mudado), `v3` (26 f, LINEAR) e `v4` (40 f), evidências em `eggo_sprint_v1/` a `v4/`.

## Como foi feito

- Pedido: em pé, inclinado para a frente; corrida de **pulinhos em arco de 20°**, **4 m por pisada**; tronco baixa
  ~20°; braços semi-estáticos, um pouco mais articulados.
- Velocidade do sprint no jogo: 4,8 m/s × 1,55 = **7,4 m/s** → 4 m por pisada = **13 frames** a 24 fps; ciclo de
  **26 frames** (pé esquerdo toca no f1, direito no f14). Contato de 2 frames, voo de 12 frames com o Root subindo em
  arco até **0,36 m** (20° sobre 4 m).
- O Root anda 8 m por ciclo (modificador Cycles com deslocamento) só para ver no Blender: o jogo descarta o
  deslocamento horizontal. Para o arco aparecer no jogo, a opção **«Trava ao chão»** desta animação precisa ficar
  desligada (editor de animação, grupo Movimento).
- Braços: o braço do Eggo aponta para trás; ao inclinar o tronco ele levantaria, então gira para a frente o mesmo
  ângulo e balança ±12° oposto às pernas; cotovelo ~20° mais dobrado que na idle.
- Chaves LINEAR, 15 por osso.

## v9 (4 pulinhos com impacto)

- **4 pisadas em 32 frames:** 8 frames por pisada (ciclo de 16 f repetido 2×; pés tocam em f1, f9, f17, f25), 0,8 m por
  pisada e arco de 20° mantidos. O corpo anda o dobro (3,2 m por clipe).
- **Pisada forte:** toque (p0) → **impacto** no frame seguinte (quadril amassa 7 cm, tronco cai 6° para a frente, linear,
  seco) → impulso com a perna de apoio **99–100%** reta (quadril sobe 17 cm em 1 frame) → voo de 6 frames.
- Braços semi-estáticos na pose do f5 do responsável (como na v8). A coluna, a coxa e a canela que ele editou foram
  aplicadas na fase equivalente (1º frame de voo: f4/f20, e espelhadas em f12/f28).
- Perna que está no ar fica mais baixa durante o impacto do outro pé: antes a coxa entrava na barriga (malha rasgando no
  f10/f26).
- Motion Lens: pés cravados no contato (deslize 0); o arrasto do pé direito no f20 da v8 sumiu. Alertas ALTO só de
  reversão da perna de apoio entre o amassado e o impulso (f3/f11/f19/f27) — é o próprio impacto. Direction Lines:
  quadril e mãos sem retrocesso, desvio máx. 7,6 cm.

## v8 (braços semi-estáticos)

- Ombros, braços, antebraços e mãos ficam **na pose do f5 feita pelo responsável em todas as chaves**: não têm
  animação própria, só acompanham o tronco (tombo, inclinação e pulinho). A mão não se move em relação ao peito
  (0,0 cm); no mundo o braço varia só pelo corpo (esquerdo −3° a 6°, direito −14° a −5° em relação à horizontal).
- Pernas, tronco, Root e o resto do f5 dele não mudaram.
- Motion Lens: mãos a no máximo 8,4 cm/frame (a velocidade do corpo); só resta o ALTO do pé direito arrastando 11 cm no
  f20. Direction Lines: mãos e quadril sem retrocesso, desvio máx. 5 cm.

## v7 (braços em onda contínua)

- Braço = pose da v5 + a mudança do responsável no f5 (e o espelho dela na 2ª pisada) multiplicada por uma **onda**:
  no toque os braços caem para a frente/baixo (32–36° abaixo da horizontal), no impulso varrem para trás e para cima,
  chegam à pose dele no f5/f21 (**0,0° de diferença**, chaves dele intactas), flutuam até f7/f23 e descem num arco
  contínuo até o próximo toque.
- **Contrapeso do tombo:** quando o corpo tomba 5° para um lado, o braço abre até 5° para o lado oposto (zero no pico, para
  não mexer na pose dele).
- **Arrasto das mãos:** a mão dobra conforme a onda dos 2 frames anteriores (~12° por unidade), continuando o movimento.
- Mãos: nenhuma reversão, pico 17 cm/frame. Motion Lens: só resta o ALTO do pé direito arrastando 11 cm no f20 (já
  existia). Direction Lines: mãos e quadril sem retrocesso, desvio máx. 6,5 cm.

## v6 (pose do f5 do responsável nas duas pisadas)

- O responsável editou o f5 (8 ossos): braços levantados para trás até a horizontal (−3° / −13°), cotovelos mais
  abertos, ombro direito acompanhando, coluna 6° mais à frente, coxa esquerda 10° e perna direita (a da frente) reta.
  As chaves do f5 **não foram tocadas**.
- **Espelho na segunda pisada:** a diferença do f5 (pose dele − v5) foi espelhada (esquerda↔direita) e aplicada no f21.
- **Volta dos braços sem estalo:** a pose dos braços fica de f5 a f7 (e f21 a f23) e volta para a v5 em 4 frames (até f11
  / f27). Antes, só o f5 mudava: as mãos iam a 17–20 cm/frame com reversão ALTO no f6; agora o pico é 16 cm/frame e as
  reversões das mãos sumiram.
- Motion Lens: resta 1 alerta ALTO, pé direito arrastando 11 cm no f20 (na v5 era 7,5 cm, MEDIO; a coxa espelhada no f21
  aumentou). Direction Lines: nenhum retrocesso no quadril, desvio máx. 5 cm.

## v5 (braços atrás, tombo no corpo inteiro, 32 frames)

- **Braços fixos atrás:** sem a compensação e sem o balanço da v4 (que fazia o braço ir e voltar e às vezes passar para a
  frente). O braço fica atrás do corpo, 21–24° abaixo da horizontal em todos os frames, com só um atraso leve de 3° no
  sobe/desce do pulinho; cotovelo continua mais dobrado.
- **Tombo de 5° de verdade:** a inclinação saiu do quadril/coluna/peito e foi para o **Root** (personagem inteiro, pernas
  corrigidas pelo IK com os pés no lugar): +5° para a esquerda no toque do pé esquerdo, −5° para a direita no direito.
- **Mais rápido:** ciclo de **32 frames** (16 por pisada; pé direito toca no f17), tempos escalados; resto igual à v4.
- Depois do impulso o quadril fica 6 cm mais alto e desce em 8 frames (corpo esticado seguindo o empurrão), para a
  perna de trás ficar reta sem arrastar o pé (dobra só até 78% e volta a 95%).
- Motion Lens: **nenhum alerta ALTO**; Direction Lines: quadril sem retrocesso, desvio máx. 5 cm.

## v4 (40 frames, suave, inclinação lateral)

- Ciclo de **40 frames** (20 por pisada; pé esquerdo toca no f1, direito no f21), tempos da v3 escalados; contato de
  3 frames; 0,8 m por pisada e arco de 20° mantidos. 15 chaves por osso.
- Chaves **BEZIER** (auto-clamped, cíclicas); só o avanço do Root e o trecho de contato das pernas ficam LINEAR
  (velocidade constante e pé parado no chão).
- **Volta das pernas suave:** o chute para trás é espalhado em 6 frames (sem tranco: pé no máximo 0,11 m/frame, antes
  0,37) e a perna dobra devagar até ~45% em 12 frames, em vez de 82% → 18% em 3 frames.
- **Joelho estável:** o eixo do joelho passou a ser o eixo lateral fixo do corpo. Antes o polo frente/cima ficava quase
  oposto à perna esticada para trás e a canela girava 180° no meio da interpolação.
- **Inclinação lateral:** 5° para o lado da perna de apoio (tronco medido do quadril ao peito: +5° no toque esquerdo,
  −5° no direito, em relação à pose neutra), dividida entre quadril, coluna e peito.
- Extensão: impulso 99–100%, perna da frente 99–100% antes do toque, dobra mínima ~44%.
- Motion Lens: **nenhum alerta ALTO**, sem deslize de pé; Direction Lines: nenhum retrocesso, desvio máx. 7,5 cm.

## v3 (v1 mudando só a distância + pernas esticando)

- Igual à v1: 26 frames, 13 por pisada, contato de 2 frames, arco de 20°, braços ±12°, tronco 20°. Só a pisada mudou:
  **0,8 m** (arco de 20° sobre 0,8 m = 7 cm). 15 chaves por osso.
- Pernas montadas pela **extensão** (distância quadril-tornozelo ÷ comprimento da perna, medida por frame):
  impulso com a perna de apoio a **99%** (o quadril sobe até ela esticar: f2 e f15); perna de trás esticada para trás
  (92–99% até f6); perna da frente esticada à frente antes do toque (99% de f19 a f25); encolhimento até 16–28%.
  A v2 nunca passava de 94% e no impulso ficava em 71%.
- Esta medida não existe no Motion Lens nem no Direction Lines; passou a fazer parte da verificação.
- Motion Lens: sem deslize de pé; alertas ALTO só de reversão no recolhimento da perna (f10/f23), no estalo do
  impulso (f15) e na mão direita (f4). Direction Lines: quadril sem retrocesso, desvio máx. 7 cm.

## v2 (0,8 m por pisada, recusada)

- Pisada de **0,8 m** em **6 frames**; ciclo de **12 frames** (pé esquerdo toca no f1, direito no f7); contato de 2 frames,
  voo de 5; arco de 20° sobre 0,8 m = **7 cm** de altura. 7 chaves por osso.
- Velocidade do clipe: 3,2 m/s a 24 fps. O sprint do jogo é 7,4 m/s, então no jogo o clipe precisa tocar **~2,3×**
  mais rápido (ou a cadência sobe) para o pé não escorregar.
- Braços: balanço ±8°, cotovelo mais dobrado, mesma compensação da inclinação.
- Motion Lens: nenhum alerta ALTO; sola até 5 cm abaixo do chão (padrão do Eggo ~4 cm); braço direito perto do
  tronco nas cápsulas (f9–f1), sem atravessar nas folhas. Direction Lines: sem retrocesso no quadril, desvio máx. 5 cm.

## Verificação (v1)

- `vision.py shot` nos 26 frames, lado e 3/4 (`blend_untouched`).
- Motion Lens: sola até 7 cm abaixo do chão no toque (f1/f14; as clips aprovadas ficam em ~4 cm); braço direito
  encosta no tronco nas cápsulas em f15–19 (confirmar na malha).
- Direction Lines: trajetórias sem retrocesso; maior desvio 11 cm no f13 (aterrissagem).

## Não verificado

Jogo (giro do corpo ainda não existe), exportação GLB, velocidade de outros perfis (ágil 9,3 m/s, resistente 6,3 m/s
deixariam o pé escorregando sem ajuste de velocidade do clipe).
