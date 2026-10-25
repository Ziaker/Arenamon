# Caminhada para frente do Eggo

Abra [`chars/Eggo/Eggo_Walk_Forward.blend`](../chars/Eggo/Eggo_Walk_Forward.blend) no Blender. O rig `AlienRig` já está com **Walk Forward 4 Expressive** ativa. No **Dope Sheet → Action Editor**, você pode alternar entre:

- **Walk Forward 1:** caminhada original, quadros 1–25 a 24 fps.
- **Walk Forward 2 Fast:** caminhada rápida, quadros 1–19 a 24 fps. A passada e a elevação programadas dos pés foram ampliadas em 50%; o ciclo dura 0,75 s em vez de 1 s. O quadril, o tronco e a cabeça se movem mais.
- **Walk Forward 3 Weighted:** locomoção para frente mais aberta e pesada, quadros 1–19 a 24 fps. A passada medida no tornozelo é de aproximadamente 0,298 m em cada perna, contra 0,194 m na versão 2. O quadril desce no apoio e sobe na passagem; a coluna, o peito e a cabeça giram com atraso e contrapeso, movimentando também os ombros. Os pés foram ajustados para não atravessar o plano de chão na análise.
- **Walk Forward 4 Expressive:** ciclo construído a partir das edições do usuário nos quadros 1 e 10. Essas duas poses foram preservadas exatamente; a mudança de pernas, quadril, raiz, coluna, peito e ombros foi distribuída pelo restante dos 19 quadros com entrada e saída suaves. O quadro 19 repete o 1. A excursão frontal do tornozelo esquerdo é de cerca de 0,549 m e a do direito, 0,407 m.
- **Walk Forward 3 Edited Poses:** cópia das edições originais do usuário, guardada como referência no arquivo. Não é a ação final para reprodução em loop.

A caminhada foi criada em um arquivo separado de `Eggo.blend`. As quatro versões de ciclo mantêm a inclinação do tronco e o encaixe das mãos atrás das costas da idle. Os passos alternam entre as pernas esquerda e direita; o pé livre levanta enquanto o outro apoia. O primeiro e o último quadro de cada ciclo têm a mesma pose.

Os ciclos são **no lugar**: o `Root` não avança na direção da caminhada. Ao usá-los no jogo, o deslocamento para frente deve vir do movimento do personagem. Para ver toda a Walk Forward 1 no Blender, ajuste o fim da timeline para 25; para as versões 2, 3 e 4, use 19. As ações Idle 1 e Idle 2 também continuam disponíveis como referência. As caminhadas ainda não foram exportadas para GLB nem testadas dentro do jogo.

## Comparação visual

- [Versão 4: ciclo seguindo as poses dos quadros 1 e 10](../prototypes/combat-lab/evidence/eggo-walk-forward/expressive/report.html)
- [Relatório Motion Lens da versão 4](../prototypes/combat-lab/evidence/eggo-walk-forward/expressive/motion_lens_report.txt)
- [Versão 3: capturas de lado e de costas, com vista de contato](../prototypes/combat-lab/evidence/eggo-walk-forward/after/report.html)
- [Versão 2: capturas anteriores para comparação](../prototypes/combat-lab/evidence/eggo-walk-forward/before/report.html)
- [Relatório Motion Lens da versão 3](../prototypes/combat-lab/evidence/eggo-walk-forward/after/motion_lens_report.txt)

As capturas foram produzidas pelo Blender Vision a partir do arquivo salvo. O Motion Lens analisou os 19 quadros da versão 3: não apontou penetração do plano de chão configurado em -0,04 m. A diferença máxima da relação entre as mãos foi inferior a 0,000001 na matriz de pose, e os quadros 1 e 19 coincidem. O relatório ainda sinaliza equilíbrio simplificado em alguns quadros; a sensação de peso foi avaliada visualmente, não por esse indicador.

Na versão 4, a diferença das curvas nos quadros 1 e 10 em relação às poses editadas foi inferior a 0,00000001. A distância entre as mãos variou menos de 0,00002 m ao longo do ciclo, e os quadros 1 e 19 coincidem. O Motion Lens não apontou penetração do chão, mas sinalizou deslizamento rápido do pé esquerdo durante parte da passada e alertas de equilíbrio simplificado. O contato final deve ser avaliado com o deslocamento real do personagem no jogo.
