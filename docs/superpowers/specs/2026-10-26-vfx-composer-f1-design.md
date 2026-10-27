# VFX Composer F1 — design aprovado pelo documento-mestre

## Intenção

Transformar a fundação F0 em uma aplicação offline de autoria geométrica 3D acessível pelo portal. O viewport é soberano, mas hierarquia, propriedades, fases e salvamento permanecem sempre alcançáveis. O editor usa um único `VfxProject`; objetos Three.js são projeções descartáveis desse documento, nunca o estado autoral.

## Escopo F1

- HTML autocontido compilado com TypeScript, Three.js r186 e esbuild.
- Cena, câmera orbital, grade, resize responsivo, seleção e gizmo de transformação.
- Hierarquia e propriedades; criação de grupo, primitivas, stroke livre/plano/superfície, curva e ribbon.
- Edição básica de vértices, extrusão, pivô e snapping com controles visíveis.
- Undo/Redo composto, autosave recuperável e importação/exportação JSON.
- File System Access somente por ação explícita, com download/upload como fallback.
- Testes unitários do documento e teste de navegador offline com reabertura sem perda.

## Fora do escopo

Materiais por nós, pintura/texturas, Quarks, timeline avançada, runtime do jogo, publicação F4 e alterações no combate ou Animation Studio.

## Decisões de implementação

- Estado mutável fica em um `DocumentStore` que aplica comandos sobre snapshots válidos e limita histórico.
- Autosave usa storage versionado e serialização F0; o viewport só observa revisões.
- Geometria autoral usa dados JSON finitos e limites explícitos. Recursos GPU são reconstruídos e descartados ao mudar o documento.
- O build embute CSS, JS e dependências em um único HTML offline.
- A primeira entrega vertical prioriza primitivas/seleção/transformação/persistência; ferramentas de stroke e vértices entram em fatias seguintes da mesma F1.

## Aceite

Criar e transformar geometria, desfazer/refazer, salvar, reabrir e obter o mesmo projeto; controles não podem ser placebo; navegador offline sem rede; nenhuma mudança de gameplay.
