# Eggo · sprint (Sprint 1)

Estado: **bloqueio v1 aguardando opinião do responsável** (31/10/2026). Ideia escolhida: **1 corrida para a frente** +
corpo girando no jogo (pernas para onde corre, tronco/cabeça para o rival). A parte do jogo só começa depois da
animação aprovada.

## Onde abrir

- Arquivo: `chars/Eggo/eggo sprint v1.blend` (Action `Sprint 1`).
- Folhas dos 26 frames: `scripts/blender-vision/evidence/eggo_sprint_v1/shot_Sprint_1/report.html`.
- Motion Lens / Direction Lines: `scripts/blender-vision/evidence/eggo_sprint_v1/motion_lens_Sprint_1/`.

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

## Verificação (v1)

- `vision.py shot` nos 26 frames, lado e 3/4 (`blend_untouched`).
- Motion Lens: sola até 7 cm abaixo do chão no toque (f1/f14; as clips aprovadas ficam em ~4 cm); braço direito
  encosta no tronco nas cápsulas em f15–19 (confirmar na malha).
- Direction Lines: trajetórias sem retrocesso; maior desvio 11 cm no f13 (aterrissagem).

## Não verificado

Jogo (giro do corpo ainda não existe), exportação GLB, velocidade de outros perfis (ágil 9,3 m/s, resistente 6,3 m/s
deixariam o pé escorregando sem ajuste de velocidade do clipe).
