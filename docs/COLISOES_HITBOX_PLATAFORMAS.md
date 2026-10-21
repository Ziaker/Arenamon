# Correção de hitboxes, plataformas e blocos

Esta entrega corrige dois defeitos relacionados no jogo principal:

- A sobreposição de hitbox agora usa `groundY`, portanto acompanha o personagem quando ele está sobre uma plataforma elevada.
- Plataformas, blocos e destrutíveis mantêm colisão lateral enquanto o personagem sobe. O topo só deixa de bloquear quando os pés realmente o alcançam.

As caixas giradas agora usam a mesma rotação no desenho e na física. A projeção de contato também expulsa o personagem pela face mais próxima quando ele começa profundamente dentro de um volume, evitando que permaneça atravessando um bloco grande.

O apoio sobre superfícies considera toda a largura dos pés. Isso mantém o personagem sustentado até a borda visual e reduz quedas ou alternância de altura na quina.

## Como conferir

1. Abra `JOGAR_ARENAMON.html`.
2. Inicie uma partida e abra **Visualizar**.
3. Ative **Colisores por estado**.
4. Suba em uma plataforma: a caixa de arame deve permanecer em volta do personagem.
5. Corra e pule contra plataformas e blocos: o personagem deve deslizar pela lateral e só montar no topo ao alcançar sua altura.

## Verificações automatizadas

- `node prototypes/combat-lab/test/collision-regression.test.mjs`
- `node prototypes/combat-lab/test/map.test.mjs`
- `node prototypes/combat-lab/test/collision-regression.browser.mjs`

A evidência visual e o resultado estruturado ficam em `prototypes/combat-lab/evidence/collision-regression/`.
