# VFX Composer F1.1 Design

## Intenção

Fechar as lacunas de autoria geométrica e de aceite visual da F1 sem iniciar timeline, materiais, partículas ou integração com o jogo. A experiência continua offline, autocontida e baseada em um único `VfxProject` validado.

## Escopo

- Plano de desenho orientável com origem e rotação X/Y/Z visíveis.
- Desenho assistido com simetria no eixo local X e repetição radial de 1 a 12 cópias.
- Ribbon com largura inicial/final para tapering e edição reversível.
- Primitivas box, esfera e plano, mantendo modelagem deliberadamente simples.
- Seleção múltipla pela hierarquia, isolamento visual, travamento de edição e transformação em espaço local/global.
- Painéis laterais recolhíveis, viewport frontal/lateral e retorno à vista perspectiva.
- Controles geométricos com slider e campo numérico sincronizados, unidade, passo e limites normais; o núcleo mantém os limites defensivos amplos já existentes.
- Evidências frontal e lateral e teste de navegador do fluxo completo.

## Modelo de dados

`VisualGeometry` ganha `sphere.radius` e `plane.size: [largura, altura]`. `PathGeometry` ganha `endWidth`, preservando compatibilidade ao assumir `width` quando ausente. `VfxProject` ganha configuração opcional `authoring` com plano de desenho, simetria e repetição radial; a ausência usa padrões neutros. Origem é armazenada em metros, e rotação em radianos; a interface apresenta graus.

Estado puramente de interface — seleção múltipla, isolamento, espaço do gizmo e painéis recolhidos — não é publicado como conteúdo do efeito. Travamento é persistido por nó porque protege operações destrutivas ao reabrir o projeto.

## Interação

O plano orientável usa um `THREE.Plane` calculado a partir da rotação Euler. Cliques são convertidos para coordenadas mundiais e então passam por snapping. Ao finalizar, o caminho original é criado e as cópias de simetria/repetição são calculadas deterministicamente ao redor da origem do plano, dentro de uma única transação Undo.

Seleção simples continua funcionando. `Ctrl` ou `Shift` alterna itens na seleção múltipla. O valor numérico posiciona o item ativo e o delta é aplicado aos demais selecionados destravados. O gizmo opera no item ativo e respeita local/global. Isolamento apenas oculta os demais no viewport. Lock bloqueia transformação, pivô, vértices, tapering, extrusão e remoção; não impede seleção ou isolamento.

`createAssistedPaths(points, {origin, rotation, mirrorX, radialCopies})` retorna uma lista determinística de listas de pontos; IDs monotônicos são responsabilidade da camada chamadora. Assistência é aplicada ao desenho finalizado, não aos botões de formas prontas. O tapering usa uma malha própria amostrada ao longo da curva, interpolando `width` até `endWidth`.

Faixas normais dos sliders: largura, taper e extrusão `0,01–2 m` passo `0,01`; snap `0,01–10 m` passo `0,01`; origem `-10–10 m` passo `0,1`; rotação `-180–180°` passo `1`; repetição `1–12` passo `1`. Campos numéricos aceitam até cinco vezes a faixa normal onde aplicável.

## Compatibilidade e limites

- Projetos F0/F1 continuam válidos sem migração obrigatória.
- Nenhum módulo de simulação, combate, Animation Studio ou runtime é alterado.
- Não inclui deformação arbitrária de malha, triângulos editáveis, suavização de stroke nem File System Access automatizado; esses itens permanecem explicitamente registrados.
- A repetição é materializada em nós independentes para manter exportação simples e previsível.

## Aceite

- Testes unitários provam defaults, validação, tapering e geração determinística das cópias.
- Teste de navegador prova plano inclinado, controles sincronizados, esfera/plano, multi-seleção, lock, isolamento, espaço local/global e que estados transitórios não alteram o JSON.
- Build offline, typecheck, contratos F0/F1 e reabertura continuam verdes.
- Duas capturas versionáveis demonstram vistas frontal e lateral da mesma cena com enquadramento determinístico.
