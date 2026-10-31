# Eggo · sprint (Sprint 1)

Estado: **v4 aguardando opinião do responsável** (31/10/2026). Pedido da v4: mais suave, 40 frames, volta das pernas mais suave e inclinar 5° para o lado da perna. A v1 (4 m por pisada) foi recusada («4 metros parece imenso, eu digo 0,8 metros»); a v2 também («mudou tudo além de só a distância» e as pernas não esticavam). Ideia escolhida: **1 corrida para a frente** +
corpo girando no jogo (pernas para onde corre, tronco/cabeça para o rival). A parte do jogo só começa depois da
animação aprovada.

## Onde abrir

- Arquivo: `chars/Eggo/eggo sprint v4.blend` (Action `Sprint 1`).
- Folhas dos 40 frames (lado e frente): `scripts/blender-vision/evidence/eggo_sprint_v4/shot_Sprint_1/report.html`.
- Motion Lens / Direction Lines: `scripts/blender-vision/evidence/eggo_sprint_v4/motion_lens_Sprint_1/`.
- Histórico: `eggo sprint v1.blend` (4 m), `v2` (0,8 m com tudo mudado) e `v3` (26 f, LINEAR), evidências em `eggo_sprint_v1/` a `v3/`.

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
