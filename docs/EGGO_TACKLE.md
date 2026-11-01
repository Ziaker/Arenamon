# Eggo: Tackle 1 (ombrada de direita em pulo)

Arquivo: `chars/Eggo/eggo tackle ombrada v1.blend` · Action `Eggo Tackle 1` · rig `AlienRig` · 25 frames a 24 fps · LINEAR.
Base: pose do idle aprovado `Idle 5 Organica` (frame 1). Braços em pose fixa em relação ao tronco; quem anima são tronco e pernas.

## Fases

| Frames | Fase |
|---|---|
| 1–2 | Idle e antecipação (pose dinâmica: tronco enrolado para trás) |
| 3 | Disparo: pernas estouram, saída do chão |
| 3–12 | Pulo (no ar de F3 a F12, pouso no F12) |
| 5–7 | Impacto: ombro direito em 1,85 de escala |
| 8–12 | Ombro volta a 1,0 aos poucos (1,55, 1,32, 1,18, 1,09, 1,0) |
| 12–17 | Pouso agachado e frenagem forte |
| 17–25 | Assenta e volta à guarda |

## Números (da física do jogo)

- Pulo: gravidade de subida 17,5 m/s² e de descida 22 m/s² (`map.jumpGravityUp/Down`), 9 frames no ar, altura máxima cerca de 0,36 m (menos de 1 m).
- Horizontal: 8,25 m/s no ar (11 m/s do `vaultHorizontal` reduzido em 25%), cerca de 3,1 m de avanço no pulo.
- Frenagem após o pouso: 8,2 → 4,8 → 2,6 → 1,4 → 0,7 → 0 m/s em 5 frames. O Eggo termina cerca de 3,5 m à frente.
- Chão: a malha não passa de z=0 nos 25 frames.

## Como a escala do ombro funciona

Só o `RightShoulder` escala. O `RightArm` tem escala inversa em cada frame (de 1 a 13, mais 17, 21 e 25) para o braço, o antebraço e a mão não crescerem junto.

## Conferência

Motion Lens 0.4.1 (relatório, folhas de contato) e Direction Lines. Alertas conhecidos: inversão brusca no F3–F4 (disparo colado ao agachamento), escala do ombro e do Root (intencionais) e deslizamento dos pés no pouso. Não foi exportado para GLB nem ligado ao jogo.
