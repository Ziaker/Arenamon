# VFX sólidos 3D do Combat Lab

Camada de efeitos feita só de malhas com volume real em `InstancedMesh`, sem sprites, billboards nem planos com textura. Funciona com o renderizador legado e com o `VfxRuntime`. Só apresentação: não altera regras, stamina, tempos nem cooldowns.

- Núcleo: `prototypes/combat-lab/src/view/solid-fx.js` (pool, materiais, controles de família, estados de dash/sprint, prévias).
- Geometrias e estilos de movimento: `src/view/solid-motion.js`.
- Referências de linguagem visual (vídeo e imagens de fumaça em desenho animado): usadas só como vocabulário — faixas curvas em camadas, volumes que rolam, anéis de nuvem, colunas em espiral, caudas em S. As formas são originais, geradas por código; nenhum arquivo de referência entra no projeto.

## Geometrias (todas sólidos fechados)
Existentes: icosaedro irregular, tetraedro, octaedro, caixa, cone, prisma hexagonal, toroide baixo. Novas: `lump` (volume macio, normais suaves), `crescent` (faixa curva extrudada), `arch` (meio toro em pé), `windArc` (fita em S), `windSpiral` (hélice), `windCurl` (gancho/caracol). Os tubos de vento são afilados nas duas pontas.

## Famílias e estilos (painel Visualizar › Efeitos 3D sólidos)
| Família | Disparo | Estilos |
|---|---|---|
| Poeira do dash/arrancada (`solidDust`) | dash/esquiva, arrancada, parada | A compacta · B turbulenta · C impacto pesado · D energética · **E ondas em camadas · F nuvem rolante · G anel de nuvem · H coluna em espiral** |
| Vento do dash/arrancada (`solidWind`) | idem | A fitas em S · B espirais · C ganchos rentes ao chão · D cunha de rajadas |
| Poeira da corrida (`solidRunDust`) | sprint contínuo | A pegadas · B nuvem contínua · C sulcos rolantes |
| Vento da corrida (`solidRunWind`) | sprint contínuo | A fitas laterais · B espirais de esteira · C arcos de corrente |
| Esquiva, aterrissagem, impacto, bloqueio, colisão | eventos da luta | 3 estilos cada (ver `SOLID_FAMILIES`) |

Poeira e vento são famílias independentes: estilo, intensidade e cores escolhidos separadamente, usados juntos no dash e na arrancada. Na corrida, a emissão é contínua e proporcional à velocidade, a poeira e o vento seguem a curva (giro do rumo real), a desaceleração afina a emissão (`coast`) e a parada solta uma rajada final.

## Sliders (todas as famílias)
`intensity` (força), `amount` (quantidade/taxa), `size`, `duration` (× do padrão), `velocity`, `scatter` (dispersão), `lift` (altura), `turbulence` (rotação e ruído), `opacity`, `color` (e `color2` na poeira, estilo D). Todos são multiplicadores aplicados em `SolidFx.spawn()`, então valem para qualquer estilo; o teste `solid-motion.test.mjs` exige efeito mensurável de cada um (81 combinações). Controles globais: `vfx.solid.maxObjects` (teto, 8–512) e `vfx.solid.quality`.

## Coerência do seletor
A escolha vive só em `C.vfx.<família>.variant` (histórico do ajustador: Ctrl+Z/Ctrl+Y; exportação JSON, presets e A × B usam o mesmo caminho). Painel, `SolidFx` e `VfxRuntime.getVariant` leem esse valor; `VfxRuntime.setVariant` não cria mais escolha paralela. As prévias de dash/arrancada/corrida/curva/parada usam um lutador virtual que passa pelo MESMO `trackDash` da luta.

## Desempenho
Teto de objetos ativos, 13 geometrias e 4 materiais compartilhados, no máximo uma malha instanciada por (forma, material), opacidade por instância sem materiais extras. Medição em `evidence/vfx-solido/desempenho.json`, com o renderizador WebGL identificado (`env.glRenderer`; em Edge headless é SwiftShader, por software: só vale como custo de CPU e contagem de desenhos).

## Evidências e testes
- `evidence/vfx-solido/comparacao-poeira.html`: todos os estilos × 3 ângulos, curvas e clipes `movimento/*.mp4` de comparação lado a lado (dash, corrida, curva e parada).
- `test/solid-vfx.test.mjs`, `test/solid-motion.test.mjs` (Node) e `test/solid-vfx.browser.mjs` (Edge, interface real: sliders, desfazer/refazer, exportação, luta nos dois renderizadores, vazamento, desempenho).
