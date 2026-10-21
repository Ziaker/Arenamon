# Animações dos personagens no Combat Lab

Abra `JOGAR_ARENAMON.html` e use **Personagens e animações**.

- O seletor de uma linha troca a animação principal daquele estado. Ele não transforma a animação anterior em variante.
- Animações extras só entram pelo controle **+ adicionar variante…** dentro do botão de variantes.
- Andar, correr e sprint possuem estados próprios para frente, trás, esquerda e direita.
- Cada estado oferece velocidade, repetição em loop e duração máxima. Duração `0` usa o clipe inteiro.
- **Ocultar abas** recolhe os filtros; **Ocultar biblioteca** libera a largura ocupada pela biblioteca. A gaveta possui rolagem horizontal quando a tela não comporta as colunas.
- Se um estado não tiver clipe válido, o personagem mantém a animação atual. Na primeira exibição, usa o primeiro clipe compatível em vez da T-pose.

Os efeitos **Squash & Stretch** e **Smear de Membros** ficam em **Ações → Tackle**, com controles próprios. Eles alteram somente a apresentação visual.

