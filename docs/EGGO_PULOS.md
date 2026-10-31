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

## Fases do jogo (31/10/2026)

O `Jump 1` ganhou **marcadores** com o nome da fase (chaves intactas): `jump_start` f4, `jump_rise` f6, `jump_apex` f12,
`jump_fall` f16, `land` f20. Cada fase também virou uma **Action própria**, copiada do `Jump 1`, **no lugar** (o Root
não sobe; no jogo a altura é da física). Arquivo: `chars/Eggo/eggo pulo v9 fases.blend`.

| Action | Estado do jogo | Trecho do Jump 1 | Frames | Tipo |
|---|---|---|---|---|
| `Jump Start 1` | `jump_start` | f4–6 (agacha → impulso) | 3 | uma vez |
| `Jump Rise 1` | `jump_rise` | f7 → f9 → f7 (vai e volta) | 5 | loop |
| `Jump Apex 1` | `jump_apex` | f12–16 (encolhido) | 5 | uma vez (segura no fim) |
| `Jump Fall 1` | `jump_fall` | f17 → f19 → f17 (vai e volta) | 5 | loop |
| `Land 1` | `land` | f20–30 (impacto → neutro) | 11 | uma vez |

Os loops de subida e queda são um vai-e-volta curto do meio do trecho, porque o trecho inteiro não fecha em ciclo.
Motion Lens em cada fase: as únicas reversões são o ponto de volta dos loops (f4, movimentos de 3–5 cm) e os
antebraços no fundo do amassado do pouso (f3); pés travados no `Land 1`. Folhas e relatórios:
`scripts/blender-vision/evidence/eggo_pulo_v9_fases/`.

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
