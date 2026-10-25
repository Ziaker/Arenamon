# Caminhada para frente do Eggo

Abra [`chars/Eggo/Eggo_Walk_Forward.blend`](../chars/Eggo/Eggo_Walk_Forward.blend) no Blender. O rig `AlienRig` já está com a ação **Walk Forward 1** ativa. Reproduza os quadros **1–25** a **24 fps** para ver o ciclo completo.

A caminhada foi criada em um arquivo separado de `Eggo.blend`. Ela mantém a inclinação do tronco e o encaixe original das mãos atrás das costas da idle. Os passos alternam entre as pernas esquerda e direita; o pé livre levanta enquanto o outro apoia, com uma pequena oscilação do quadril e da cabeça. Os quadros 1 e 25 têm a mesma pose para repetir o ciclo.

O ciclo é **no lugar**: o `Root` não avança. Ao usá-lo no jogo, o deslocamento para frente deve vir do movimento do personagem. As ações Idle 1 e Idle 2 também continuam disponíveis no arquivo como referência. A caminhada ainda não foi exportada para GLB nem testada dentro do jogo.
