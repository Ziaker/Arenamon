# VFX sólidos 3D do Combat Lab

Camada de efeitos feita só de malhas com volume real em `InstancedMesh`, sem sprites, billboards nem planos com textura. Funciona com o renderizador legado e com o `VfxRuntime`. Só apresentação: não altera regras, stamina, tempos nem cooldowns.

- Núcleo: `prototypes/combat-lab/src/view/solid-fx.js` (pool, materiais, controles de família, estados de dash/sprint, prévias).
- Geometrias e estilos de movimento: `src/view/solid-motion.js`.
- Referências de linguagem visual (vídeo e imagens de fumaça em desenho animado): usadas só como vocabulário — faixas curvas em camadas, volumes que rolam, anéis de nuvem, colunas em espiral, caudas em S. As formas são originais, geradas por código; nenhum arquivo de referência entra no projeto.

## Geometrias e material
- **Debris** (poeiras A–D, esquiva, aterrissagem, impacto, bloqueio, colisão): icosaedro irregular, tetraedro, octaedro, caixa, cone, prisma hexagonal, toroide baixo, em `InstancedMesh`.
- **Fumaça, poeira clara e vento** (poeiras E–H e todo o vento): cada partícula é uma esfera simulada normalmente (posição, velocidade, órbita, atraso, escala), mas elas **não são desenhadas como malhas**. As esferas de um mesmo efeito formam um *cluster* (até 24) e `src/view/smoke-volume.js` as desenha como **uma massa contínua por raymarching de campo de distância**: união suave das esferas + ruído nas bordas, num cubo proxy por cluster. A massa funde, incha e se esfarela (ruído 3D) em vez de parecer um monte de bolas. É 3D de verdade (gira com a câmera e escreve profundidade); a única "textura" é uma tabela numérica com as esferas. Sem sprites, billboards nem planos com textura.
- **Sombreamento:** 3 tons chapados a partir da normal do campo de distância (como as nuvens das referências).

## Famílias e estilos (painel Visualizar › Efeitos 3D sólidos)
| Família | Disparo | Estilos |
|---|---|---|
| Poeira do dash/arrancada (`solidDust`) | dash/esquiva, arrancada, parada | A compacta · B turbulenta · C impacto pesado · D energética · **E ondas em camadas · F nuvem rolante · G anel de nuvem · H coluna em espiral** (E–H em fumaça clara) |
| Vento do dash/arrancada (`solidWind`) | idem | A rajada em S · B redemoinho · C caracol rasteiro · D onda de pressão |
| Poeira da corrida (`solidRunDust`) | sprint contínuo | A pegadas · B nuvem contínua · C sulcos rolantes |
| Vento da corrida (`solidRunWind`) | sprint contínuo | A fitas contínuas · B esteira helicoidal · C arcos de pressão |
| Esquiva, aterrissagem, impacto, bloqueio, colisão | eventos da luta | 3 estilos cada (ver `SOLID_FAMILIES`) |

Poeira e vento são famílias independentes: estilo, intensidade e cores escolhidos separadamente, usados juntos no dash e na arrancada. Na corrida, a emissão é contínua e proporcional à velocidade, a poeira e o vento seguem a curva (giro do rumo real), a desaceleração afina a emissão (`coast`) e a parada solta uma rajada final.

## Sliders (todas as famílias)
`intensity` (força), `amount` (quantidade/taxa), `size`, `duration` (× do padrão), `velocity`, `scatter` (dispersão), `lift` (altura), `turbulence` (rotação e ruído), `opacity`, `fadeStart` e `fadeEnd` (a partir de que fração da vida a opacidade cai e em que fração chega a zero), `color` (e `color2` na poeira, estilo D). Todos são multiplicadores aplicados em `SolidFx.spawn()`, então valem para qualquer estilo; o teste `solid-motion.test.mjs` exige efeito mensurável de cada um (99 combinações). Controles globais: `vfx.solid.maxObjects` (teto, 8–512) e `vfx.solid.quality`.

## Coerência do seletor
A escolha vive só em `C.vfx.<família>.variant` (histórico do ajustador: Ctrl+Z/Ctrl+Y; exportação JSON, presets e A × B usam o mesmo caminho). Painel, `SolidFx` e `VfxRuntime.getVariant` leem esse valor; `VfxRuntime.setVariant` não cria mais escolha paralela. As prévias de dash/arrancada/corrida/curva/parada usam um lutador virtual que passa pelo MESMO `trackDash` da luta.

## Desempenho
Teto de objetos ativos (esferas e debris), até 48 clusters de fumaça por quadro (1 desenho para todos), geometrias e 3 materiais compartilhados (lit, glow, smoke), no máximo uma malha instanciada por (forma, material). O raymarching custa por pixel: 26 passos e até 24 esferas por cluster; o custo real de quadro está em `desempenho.json` (`frameMs`). Medição em `evidence/vfx-solido/desempenho.json`, com o renderizador WebGL identificado (`env.glRenderer`; em Edge headless é SwiftShader, por software: só vale como custo de CPU e contagem de desenhos).

## Evidências e testes
- `evidence/vfx-solido/comparacao-poeira.html`: todos os estilos × 3 ângulos, curvas e clipes `movimento/*.mp4` de comparação lado a lado (dash, corrida, curva e parada).
- `test/solid-vfx.test.mjs`, `test/solid-motion.test.mjs` (Node) e `test/solid-vfx.browser.mjs` (Edge, interface real: sliders, desfazer/refazer, exportação, luta nos dois renderizadores, vazamento, desempenho).
