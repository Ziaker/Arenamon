# Eggo · pulo (Jump 1)

Estado: **Jump 1 v9 aprovado pelo responsável** (31/10/2026). Modo B do [manual](MANUAL_BLENDER_AGENTES.md): Action
criada na sessão aberta e gravada numa cópia nova; nenhum `.blend` existente sobrescrito.

## Onde abrir

- Arquivo: `chars/Eggo/eggo pulo v9.blend` (cópia da sessão, com todas as Actions do Eggo + `Jump 1`).
- Folhas de todos os 30 frames: `scripts/blender-vision/evidence/eggo_pulo_v9/shot_Jump_1/report.html`.
- Motion Lens / Direction Lines: `scripts/blender-vision/evidence/eggo_pulo_v9/motion_lens_Jump_1/`.

## Jump 1 v9 (aprovado)

30 frames, 24 fps, LINEAR, 12–15 chaves por osso. O Eggo **sai do lugar**: o Root sobe em parábola, decola no f6,
pico de 0,60 m no f13 e pousa no f20.

| Frame | Pose |
|---|---|
| 1 | neutro (pose da Idle 5) |
| 4 | agacha (antecipação) |
| 6 | impulso: arqueia, olha para cima, pernas esticadas, pés ainda no chão |
| 8 | subida: pernas para trás |
| 13–15 | pico: encolhe as pernas (sem a coxa entrar na barriga) |
| 18 | queda: pernas descem, olha o chão |
| 20 | toca o chão |
| 21–23 | impacto e amassado |
| 27 | levanta |
| 30 | neutro |

Os **braços ficam na pose de sempre** e só acompanham o corpo (pedido do responsável: nada de balanço de pulo
humano).

## Verificação

- `vision.py shot` nos 30 frames (lado e 3/4), arquivo intacto (`blend_untouched`).
- Motion Lens: mãos no máximo 0,16 m/frame; alertas ALTO só de reversão na antecipação (f5), na saída do encolhido
  (f14) e no fundo do amassado (f22). Sola a 3–4 cm do chão (igual às clips aprovadas).
- Direction Lines: quadril com desvio máximo de 2,7 cm da guia.

## Histórico

- v4 (7 Actions no lugar: Jump/Start/Rise/Apex/Fall, Fall, Land) foi **rejeitada** e as Actions apagadas da sessão;
  o arquivo `chars/Eggo/eggo pulos v4.blend` e as evidências `eggo_pulos_v4/` ficam só como histórico.
- v5–v8: tentativas intermediárias (braços para trás, malha rasgando no pico, balanço de braço humano), descartadas.
- Correção de cena: o objeto `AlienRig` tinha descido para z 0,216 (todas as clips abaixo do chão); voltou para
  z 0,532, como nos arquivos anteriores (x e y mantidos).

## Não verificado

Exportação GLB, Animation Studio e Combat Lab. No jogo a subida é feita pela física (2 m); com root motion travado,
o Root deste clipe não desloca o personagem.
