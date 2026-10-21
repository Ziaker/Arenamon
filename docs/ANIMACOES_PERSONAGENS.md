# Animações dos personagens no Combat Lab

Abra `JOGAR_ARENAMON.html` e use **Personagens e animações**.

- O seletor de uma linha troca a animação principal daquele estado. Ele não transforma a animação anterior em variante.
- Animações extras só entram pelo controle **+ adicionar variante…** dentro do botão de variantes.
- Andar, correr e sprint possuem estados próprios para frente, trás, esquerda e direita.
- Cada estado oferece velocidade, repetição em loop e duração máxima. Duração `0` usa o clipe inteiro.
- **Ocultar abas** recolhe os filtros; **Ocultar biblioteca** libera a largura ocupada pela biblioteca. A gaveta possui rolagem horizontal quando a tela não comporta as colunas.
- Se um estado não tiver clipe válido, o personagem mantém a animação atual. Na primeira exibição, usa o primeiro clipe compatível em vez da T-pose.
- Trocas rápidas que retornam a um clipe ainda em transição (A → B → A) reutilizam a ação sem permitir que o fade antigo a desligue; assim o mixer não cai momentaneamente na T-pose.
- Em **Personagens → Altura visual e apoio no chão**, **Travar deslocamento horizontal da animação (mundo X/Z)** neutraliza a translação gravada no osso raiz mesmo em rigs com eixos locais rotacionados, como o Mushroom. O quadril também é alinhado ao centro físico para a malha não orbitar ao mudar de direção. **Travar no chão** neutraliza a subida ou descida gravada no clipe sem remover a pose. As duas ficam ligadas por padrão; movimento, saltos, vaults e lançamentos continuam vindo da física do jogo.

Os efeitos **Squash & Stretch** e **Smear de Membros** ficam em **Ações → Tackle**, com controles próprios. Eles alteram somente a apresentação visual.

