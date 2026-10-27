# VFX Composer F2 Design

## Intenção

Transformar a autoria geométrica da F1.1 em uma ferramenta capaz de animar, pintar máscaras e montar aparências reutilizáveis, mantendo o projeto offline e o `VfxProject` como fonte única. A F2 deve permitir que um artista crie e revise movimento e material sem escrever código, mas não publica nem executa o efeito no jogo.

## Escopo e decisões

- Timeline determinística em 24, 30 ou 60 FPS, com play, pause, stop, avanço reverso e scrub em segundos/frames.
- Tracks numéricas para opacidade, escala, posição e rotação; keyframes step, linear e cubic Bézier com tangentes de entrada/saída visíveis.
- Eventos autorais marcados no tempo e animação quadro a quadro por visibilidade de nós.
- Morph de vértices apenas para caminhos compatíveis (mesma quantidade de pontos), com onion skin anterior/próximo no viewport.
- Workspace Texturas com pintura RGBA 2D, pincel em pixels, cor/opacidade, limpar, importar PNG e metadados de spritesheet (colunas, linhas e FPS).
- Workspace Materiais com grafo declarativo seguro. Nós permitidos: `color`, `texture`, `gradient`, `noise`, `fresnel`, `dissolve`, `multiply` e `output`; sem código GLSL arbitrário, loops, funções ou URLs.
- A prévia compila o grafo para parâmetros/material Three.js locais. A representação publicada continua declarativa e validada; compilação runtime pertence à F4.
- Workspaces Desenho, Animação, Texturas e Materiais ficam acessíveis por abas. Partículas e Integração aparecem somente como etapas futuras desabilitadas.

## Modelo de dados e compatibilidade

`VfxProject` ganha campos opcionais `textures` e `materials`; projetos F0/F1 sem esses campos recebem listas vazias em leitura e continuam válidos. `timeline` ganha duração, eventos e tracks estendidas. Keyframes mantêm `time` e `value`, aceitam `bezier` e tangentes numéricas opcionais; valores antigos linear/step continuam válidos.

Máscaras pintadas são armazenadas como assets de dados locais versionáveis, com largura/altura limitadas a 1024 e conteúdo RGBA codificado. Spritesheets guardam apenas divisão e FPS de autoria. Grafos têm IDs estáveis, no máximo 64 nós, conexões acíclicas, uma única saída e profundidade máxima 16. A validação rejeita referências ausentes, ciclos, operadores desconhecidos e parâmetros não finitos.

O `DocumentStore` oferece mutações de timeline, textura e material dentro do Undo/Redo e incrementa revisão para acionar autosave. Playback, scrub e seleção de workspace são estado transitório de interface e não alteram o JSON.

### Formatos canônicos

A F2 mantém `schemaVersion: 1`: todos os campos novos são opcionais e têm defaults de leitura, portanto não há migração destrutiva. O formato canônico é:

- `timeline.duration: number`, `timeline.events: {id, time, name}[]` e `timeline.tracks: VisualTrack[]`.
- Animação quadro a quadro usa propriedade `visible` com valores `0|1` e interpolação `step`.
- Morph usa uma track `property: 'path.points'` cujos keyframes guardam `value: Vec3[]`; somente `linear` ou `step` são aceitos e todas as amostras de uma track precisam ter a mesma topologia.
- Keyframe numérico Bézier usa `{time, value, interpolation: 'bezier', inTangent?, outTangent?}`; tangentes ausentes valem zero.
- `textures: TextureDocument[]`, cada uma com `{id, name, width, height, rgbaBase64, spriteSheet?}`. `rgbaBase64` codifica exatamente `width*height*4` bytes crus, não é URI nem `VisualAsset.uri`; máximo de 16 texturas e 1024×1024, respeitando também o teto JSON global de 8 MiB.
- `materials: MaterialGraph[]`, cada grafo com `{id, name, nodes, connections, outputNodeId}`. Nó é `{id, type, params}`; conexão é `{fromNodeId, fromPort, toNodeId, toPort}`.

Portas e parâmetros permitidos: `color` produz `color` e aceita `color`; `texture` produz `color/alpha` e aceita `textureId`; `gradient` produz `color` e aceita `startColor/endColor`; `noise` produz `value` e aceita `scale`; `fresnel` produz `value` e aceita `power`; `dissolve` recebe `source/mask`, produz `color/alpha` e aceita `threshold/edgeWidth/edgeColor`; `multiply` recebe `a/b` e produz `color`; `output` recebe `color/alpha/emissive` e aceita `roughness/metalness`. Cada porta de entrada aceita no máximo uma conexão. `outputNodeId` deve apontar para o único nó `output`, e todo nó deve contribuir para essa saída.

A igualdade entre duas páginas WebGL é da receita declarativa compilada, byte por byte após ordenação estável. O teste também exige renderização sem erro em ambas, mas não compara pixels, pois rasterização varia por GPU/driver.

## Comportamento da animação

O avaliador é uma função pura: recebe track e tempo e retorna valor. Antes do primeiro keyframe usa o primeiro valor; depois do último usa o último. Step mantém o valor anterior, linear interpola, e Bézier cúbica usa tangentes em unidades de valor por segundo. Tracks são avaliadas independentemente e aplicadas à cópia visual da cena, sem escrever no documento durante playback.

Play avança pelo tempo real e encerra na duração; reverse recua e encerra em zero. Scrub sempre quantiza para o frame do FPS selecionado. Alterar FPS preserva tempos em segundos, mudando apenas a grade e a leitura de frames.

Onion skin mostra até um quadro anterior e um posterior, com opacidade ajustável de 0 a 100%, usando clones sem interação. Morph de caminho interpola ponto a ponto e é rejeitado quando as topologias diferem.

## Aparência e segurança

Pintura acontece em `CanvasRenderingContext2D`, sem dependência de rede. Importação aceita somente PNG decodificado pelo navegador, limitado a 1024×1024; o conteúdo vira asset interno do projeto para preservar roundtrip offline. A interface expõe tamanho do pincel em px, opacidade em %, cor, largura/altura e configuração de spritesheet.

O grafo seguro não emite nem aceita texto de shader. Cada tipo possui portas e parâmetros conhecidos; a compilação produz uma receita de prévia (`color`, `opacity`, `roughness`, `metalness`, `emissive`, mapas e uniforms aprovados). Dissolve e Fresnel usam uma implementação interna fixa; entradas do usuário são somente números, cores e referências validadas.

## Limites explícitos

- Não inclui partículas, Three.quarks, emissão, colisão, forças ou pooling (F3).
- Não inclui compilador/player runtime, binding com Moves, publicação ou Game.step (F4).
- Não inclui editor GLSL/HLSL, scripts, plugins ou carregamento remoto.
- Não inclui deformação de malhas trianguladas; morph F2 cobre caminhos autorais da F1.
- Não altera combate, Animation Studio ou outros protótipos.

## Aceite

- Testes unitários provam interpolação step/linear/Bézier, quantização 24/30/60, reverse determinístico, morph compatível e rejeição incompatível.
- Testes unitários provam validação/compilação do grafo, incluindo ciclo, nó desconhecido, profundidade e referência ausente.
- Roundtrip preserva timeline, textura e material; projeto antigo recebe defaults sem migração destrutiva.
- Teste de navegador offline cobre workspaces, controles de timeline, keyframe, scrub/reverse, onion skin, pintura/importação, spritesheet e grafo seguro.
- O mesmo projeto abre em duas páginas WebGL independentes sem erro e produz a mesma receita material.
- Build autocontido, typecheck e testes anteriores continuam verdes; evidência fica em `prototypes/vfx-composer/evidence/f2/` e a documentação/portal apontam para a entrega.

## Chamadas do implementador

- Duração padrão: 2 segundos; FPS padrão preservado do projeto, com 30 FPS para projeto novo.
- Pincel padrão: 24 px, 100% de opacidade, branco; máscara padrão: 256×256.
- Onion skin padrão: desligado, 25% de opacidade.
- Material padrão: cor branca, roughness 0,35, metalness 0, sem transparência.
- A UI prioriza um fluxo vertical completo e testável sobre um editor visual de conexões com drag-and-drop; conexões são editadas por seletores claros nesta fase.
