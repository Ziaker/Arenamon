# VFX e avisos das habilidades passivas

O jogo principal exibe avisos laterais no formato `Ability: NOME` quando a luta começa ou quando uma prévia é acionada. Os nomes visuais são palavras únicas: **Órbita**, **Prisma** e **Ressonância**.

## Comportamento no jogo

- A notificação do jogador entra pela extrema esquerda; a do adversário entra pela extrema direita.
- A placa tem interior branco, moldura metálica e três animações selecionáveis: **Reflexo**, **Pulso** e **Luz no contorno**.
- Cada placa mede no máximo **170 × 26 px** e nunca passa de **15% da largura da arena** em seu lado.
- O nome usa 15,6 px na configuração padrão e pode ser ajustado de 80% a 160% no painel **Visualizar → Habilidades passivas**.
- Todas as habilidades usam o mesmo efeito: sparkles brancos ao redor do lutador por **0,5 s**.
- Os sparkles usam a posição, a altura visual e a orientação atuais de cada lutador. Eles continuam presos ao personagem enquanto ele se move e quando a simulação está pausada.
- As malhas são criadas uma vez e reutilizadas nas ativações seguintes.

Os três efeitos e seus nomes são uma apresentação visual. Esta entrega não define bônus, cooldowns ou regras de combate para as passivas documentadas em `PASSIVAS_DECISOES.md`.

## Como conferir

1. Abra `JOGAR_ARENAMON.html`.
2. Inicie um combate para ver os dois avisos.
3. Abra **Visualizar → Habilidades passivas**.
4. Escolha as habilidades, a animação da moldura e o tamanho do texto.
5. Use os botões de prévia para repetir qualquer efeito durante a partida.

A evidência automatizada está em `prototypes/combat-lab/evidence/passive-abilities/index.html`.

## Verificações

- `node prototypes/combat-lab/test/passive-abilities.test.mjs`
- `node prototypes/combat-lab/test/passive-abilities.browser.mjs`
- `npm run build:combat-lab`
- `npm run typecheck`
