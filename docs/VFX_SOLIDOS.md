# VFX sólidos 3D do Combat Lab

Camada de efeitos feita só de malhas com volume real (tetraedros, icosaedros irregulares, caixas, prismas, cones e toroides em `InstancedMesh`), sem sprites, billboards nem planos com textura. Código em `prototypes/combat-lab/src/view/solid-fx.js`; funciona com o renderizador legado e com o `VfxRuntime`. Só apresentação: não altera regras, tempos nem cooldowns.

## Opções (painel Visualizar › Efeitos 3D sólidos)
- **Poeira do dash** (dash comum = esquiva, arrancada = início do sprint, parada = fim): A compacta, B turbulenta, C impacto pesado, D energética.
- **Esquiva**: lâminas de vento · cristais fantasma · anéis de ar.
- **Aterrissagem/colisão com o chão**: cratera de torrões · coroa de estacas · onda e lascas.
- **Impacto**: estilhaços cúbicos · lanças de cristal · núcleo e argola.
- **Bloqueio e defesa perfeita**: placas de escudo · lascas defletidas · anel de contenção.
- **Colisão entre tackles**: cruz de lâminas · argolas duplas · núcleo prismático.

## Coerência do seletor
A escolha vive só em `C.vfx.<família>.variant` (histórico do ajustador: Ctrl+Z/Ctrl+Y). O painel, o `SolidFx` e o `VfxRuntime.getVariant` leem esse valor; `VfxRuntime.setVariant` não cria mais uma escolha paralela (causa da divergência apontada na auditoria).

## Desempenho
Teto `vfx.solid.maxObjects` (220; limite rígido 512), 7 geometrias e 2 materiais compartilhados, no máximo uma malha instanciada por (forma, material). Medição em `evidence/vfx-solido/desempenho.json` (SwiftShader: custo de CPU e contagem de desenhos; tempo de GPU não é representativo).

## Evidências e testes
- `evidence/vfx-solido/comparacao-poeira.html` (4 poeiras × 3 ângulos + demais famílias × 2 ângulos).
- `test/solid-vfx.test.mjs` (Node) e `test/solid-vfx.browser.mjs` (Edge, UI real com desfazer/refazer).
