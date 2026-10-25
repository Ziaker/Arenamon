# Idles do Eggo no Blender

Abra [`chars/Eggo/Eggo.blend`](../chars/Eggo/Eggo.blend) no Blender. No **Dope Sheet → Action Editor**, selecione o rig `AlienRig` e escolha uma destas ações:

- **Idle 1:** animação original preservada, quadros 1–45.
- **Idle 2:** versão com mais respiração e balanço de quadril, tronco e cabeça; curvas Bézier com desaceleração e aceleração suaves. Suas chaves foram comprimidas de 45 para **37 quadros**, sem cortar poses. O encaixe dos braços e das mãos atrás das costas foi restaurado exatamente da pose inicial da Idle 1. As mãos mantêm essa mesma posição relativa durante todo o movimento, sem sair do encaixe. É a ação ativa ao abrir o arquivo.

As duas ações ficam salvas no mesmo `.blend` com usuário fictício para permanecerem disponíveis mesmo quando não estão ativas. A cena está configurada para 24 quadros por segundo e termina no quadro 37. Os quadros 1 e 37 da Idle 2 têm a mesma pose para repetir sem salto. A Idle 1 permanece com seus 45 quadros originais.

Para reproduzir a Idle 1 até o fim no Blender, selecione-a no Action Editor e ajuste o fim da timeline para o quadro 45. Ao voltar à Idle 2, use o quadro 37.

Esta edição foi feita diretamente no Blender. As animações ainda não foram exportadas para GLB nem verificadas dentro do jogo.
