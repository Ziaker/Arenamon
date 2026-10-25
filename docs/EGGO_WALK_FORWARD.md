# Caminhada para frente do Eggo

Abra [`chars/Eggo/Eggo_Walk_Forward.blend`](../chars/Eggo/Eggo_Walk_Forward.blend) no Blender. O rig `AlienRig` já está com **Walk Forward 2 Fast** ativa. No **Dope Sheet → Action Editor**, você pode alternar entre:

- **Walk Forward 1:** caminhada original, quadros 1–25 a 24 fps.
- **Walk Forward 2 Fast:** caminhada rápida, quadros 1–19 a 24 fps. A passada e a elevação programadas dos pés foram ampliadas em 50%; o ciclo dura 0,75 s em vez de 1 s. O quadril, o tronco e a cabeça se movem mais.

A caminhada foi criada em um arquivo separado de `Eggo.blend`. As duas versões mantêm a inclinação do tronco e o encaixe original das mãos atrás das costas da idle. Os passos alternam entre as pernas esquerda e direita; o pé livre levanta enquanto o outro apoia. O primeiro e o último quadro de cada ação têm a mesma pose para repetir o ciclo.

Os ciclos são **no lugar**: o `Root` não avança. Ao usá-los no jogo, o deslocamento para frente deve vir do movimento do personagem. Para ver toda a Walk Forward 1 no Blender, ajuste o fim da timeline para 25; para a versão rápida, use 19. As ações Idle 1 e Idle 2 também continuam disponíveis como referência. As caminhadas ainda não foram exportadas para GLB nem testadas dentro do jogo.
