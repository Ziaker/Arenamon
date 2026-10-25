# Caminhada para frente do Eggo

Abra [`chars/Eggo/Eggo_Walk_Forward.blend`](../chars/Eggo/Eggo_Walk_Forward.blend) no Blender. O rig `AlienRig` já está com **Walk Forward 3 Weighted** ativa. No **Dope Sheet → Action Editor**, você pode alternar entre:

- **Walk Forward 1:** caminhada original, quadros 1–25 a 24 fps.
- **Walk Forward 2 Fast:** caminhada rápida, quadros 1–19 a 24 fps. A passada e a elevação programadas dos pés foram ampliadas em 50%; o ciclo dura 0,75 s em vez de 1 s. O quadril, o tronco e a cabeça se movem mais.
- **Walk Forward 3 Weighted:** locomoção para frente mais aberta e pesada, quadros 1–19 a 24 fps. A passada medida no tornozelo é de aproximadamente 0,298 m em cada perna, contra 0,194 m na versão 2. O quadril desce no apoio e sobe na passagem; a coluna, o peito e a cabeça giram com atraso e contrapeso, movimentando também os ombros. Os pés foram ajustados para não atravessar o plano de chão na análise.

A caminhada foi criada em um arquivo separado de `Eggo.blend`. As três versões mantêm a inclinação do tronco e o encaixe original das mãos atrás das costas da idle. Os passos alternam entre as pernas esquerda e direita; o pé livre levanta enquanto o outro apoia. O primeiro e o último quadro de cada ação têm a mesma pose para repetir o ciclo.

Os ciclos são **no lugar**: o `Root` não avança. Ao usá-los no jogo, o deslocamento para frente deve vir do movimento do personagem. Para ver toda a Walk Forward 1 no Blender, ajuste o fim da timeline para 25; para as versões 2 e 3, use 19. As ações Idle 1 e Idle 2 também continuam disponíveis como referência. As caminhadas ainda não foram exportadas para GLB nem testadas dentro do jogo.

## Comparação visual

- [Versão 3: capturas de lado e de costas, com vista de contato](../prototypes/combat-lab/evidence/eggo-walk-forward/after/report.html)
- [Versão 2: capturas anteriores para comparação](../prototypes/combat-lab/evidence/eggo-walk-forward/before/report.html)
- [Relatório Motion Lens da versão 3](../prototypes/combat-lab/evidence/eggo-walk-forward/after/motion_lens_report.txt)

As capturas foram produzidas pelo Blender Vision a partir do arquivo salvo. O Motion Lens analisou os 19 quadros da versão 3: não apontou penetração do plano de chão configurado em -0,04 m. A diferença máxima da relação entre as mãos foi inferior a 0,000001 na matriz de pose, e os quadros 1 e 19 coincidem. O relatório ainda sinaliza equilíbrio simplificado em alguns quadros; a sensação de peso foi avaliada visualmente, não por esse indicador.
