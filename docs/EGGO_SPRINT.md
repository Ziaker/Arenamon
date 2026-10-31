# Eggo · sprint (Sprint 1)

Estado: **bloqueio v2 aguardando opinião do responsável** (31/10/2026). A v1 (4 m por pisada) foi recusada: «4 metros parece imenso, eu digo 0,8 metros». Ideia escolhida: **1 corrida para a frente** +
corpo girando no jogo (pernas para onde corre, tronco/cabeça para o rival). A parte do jogo só começa depois da
animação aprovada.

## Onde abrir

- Arquivo: `chars/Eggo/eggo sprint v2.blend` (Action `Sprint 1`).
- Folhas dos 12 frames: `scripts/blender-vision/evidence/eggo_sprint_v2/shot_Sprint_1/report.html`.
- Motion Lens / Direction Lines: `scripts/blender-vision/evidence/eggo_sprint_v2/motion_lens_Sprint_1/`.
- v1 (histórico): `chars/Eggo/eggo sprint v1.blend`, evidências em `eggo_sprint_v1/`.

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

## v2 (0,8 m por pisada)

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
