# Eggo · pulos (Jump, fases, Fall e Land)

Estado: **aguardando aprovação do responsável** (31/10/2026). Modo B do [manual](MANUAL_BLENDER_AGENTES.md): Actions novas
numa cópia nova; nenhum `.blend` existente sobrescrito.

## Onde abrir

- Arquivo: `chars/Eggo/eggo pulos v4.blend` (cópia da sessão aberta, com todas as Actions do Eggo + as 7 novas).
- Folhas de todos os frames: `scripts/blender-vision/evidence/eggo_pulos_v4/shot_<Action>/report.html`.
- Motion Lens / Direction Lines: `scripts/blender-vision/evidence/eggo_pulos_v4/motion_lens_<Action>/`.

## Como o jogo usa (lido em `combat-lab/src/sim/animation-profile.js` e `view/characters.js`)

- O salto sobe 2 m pela física (`map.jumpHeight`, gravidade 17,5 na subida e 22 na descida): os clipes são **no lugar**.
- Fases por velocidade vertical: `jump_start` (0,12 s após o impulso), `jump_rise` (loop), `jump_apex` (|vy| < 0,6 m/s,
  toca uma vez e segura; o editor tem «Congelamento no pico»), `jump_fall` (loop) e `land`. Sem as fases, usa `jump`.
- `fall` é a queda genérica (lançado, borda).

## Actions criadas

| Action | Estado do jogo | Frames | Loop |
|---|---|---|---|
| `Jump 1` | `jump` (pulo inteiro) | 26 | não |
| `Jump Start 1` | `jump_start` | 4 | não |
| `Jump Rise 1` | `jump_rise` | 9 | sim |
| `Jump Apex 1` | `jump_apex` | 5 | não |
| `Jump Fall 1` | `jump_fall` | 9 | sim |
| `Fall 1` | `fall` | 9 | sim |
| `Land 1` | `land` | 16 | não |

Poses: agacha (antecipação) → impulso com as pernas esticadas e braços subindo → subida com pernas para trás →
pico encolhido (joelhos para a frente e para cima) → queda com braços abertos e pernas descendo → pouso: impacto em
1 frame, agachamento máximo no f4, levanta e passa do ponto até a idle. Chaves LINEAR, até 12 por osso.

## Verificação

- `vision.py shot` em todas as Actions (lado e frente), arquivo intacto (`blend_untouched`).
- Corrigido durante a verificação: chicote das mãos no impulso (46 → 18 cm/frame), joelhos abrindo para os lados no
  pico (canela girando 93°/frame → ≤ 30°/frame) e joelho entrando na barriga no encolhimento máximo.
- Motion Lens: `Jump 1` só com a cabeça invertendo no estalo do impulso (f5); `Land 1` e `Jump Apex 1` sem alerta ALTO.

## Não verificado

Exportação GLB, Animation Studio e Combat Lab (tempos reais das fases no jogo).
