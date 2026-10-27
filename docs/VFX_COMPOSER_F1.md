# Arenamon VFX Composer F1

## Estado

**F1 concluída e navegável.** O ponto principal abre uma aplicação Three.js autocontida e offline. A fundação F0 permanece preservada em `prototypes/vfx-composer/dist/vfx-composer-f0.html`.

## Implementado nesta fatia

- `DocumentStore` como fonte autoral única.
- Criação e remoção segura de nós.
- Transformações de posição, rotação e escala com validação finita.
- Seleção autoral.
- Transações compostas, Undo/Redo e invalidação de Redo após nova edição.
- Histórico limitado e revisões monotônicas ao desfazer/refazer.
- Schema inicial de transformação e geometria box, compatível com projetos F0 existentes.
- Autosave por revisão reutilizando os dois slots recuperáveis da F0.
- Recuperação do último snapshot válido quando o slot principal está corrompido.
- Continuidade de edição depois da recuperação, substituindo o slot corrompido.
- Importação/exportação JSON validada, com File System Access apenas por escolha explícita e download como fallback.
- Transações que falham são revertidas sem criar um passo de Undo vazio.
- Viewport Three.js responsivo com câmera orbital, grade, luz hemisférica e luz direcional.
- Criação de cubos autorais, seleção pela hierarquia e edição de posição X/Y/Z em metros.
- Undo/Redo exercitado no navegador; mudanças idênticas não poluem o histórico.
- Bundle único sem requisições externas, verificado em `file://` com o Edge offline.
- TransformControls anexado à seleção; OrbitControls é suspenso durante o arraste e uma alteração consolidada entra no histórico ao soltar.
- Reabertura real no mesmo contexto do Edge restaura o cubo e sua posição pelo autosave local.
- Contrato autoral para stroke, curve e ribbon com até 4096 pontos 3D, largura positiva, fechamento opcional e snapping configurável.
- Rejeição de `NaN`, excesso de pontos e caminhos degenerados inclusive depois do snapping.
- Botões visíveis `+ Stroke`, `+ Curva` e `+ Ribbon` criam os três tipos de caminho autoral e os projetam no viewport; cada criação participa de Undo/Redo e autosave.
- Controles visíveis de largura e snapping, ambos em metros, alimentam o contrato geométrico no momento da criação.
- Editor visível de vértices permite escolher um ponto do caminho e alterar X/Y/Z em metros; a alteração respeita o snapping atual, participa de Undo/Redo e é salva no documento.
- Botões `+ Ponto` e `− Ponto` incluem ou removem vértices no caminho selecionado; o núcleo impede índices inválidos, mais de 4096 pontos e remoção que deixaria menos de dois pontos.
- Modo `✎ Desenhar` captura cliques diretamente no plano XZ do viewport, mostra prévia com linha e marcadores, aplica snapping e cria o Stroke inteiro como uma única ação de Undo ao finalizar.
- Seção `Arquivo do projeto` importa JSON validado e exporta por download; a opção visível de seletor de arquivo usa File System Access somente quando marcada e disponível.
- A importação substitui o documento como uma ação reversível, reinicializa o autosave para o `projectId` importado e mantém o projeto anterior recuperável por Undo.
- Controles de pivô local X/Y/Z em metros são serializados por nó; a projeção Three.js compensa posição, rotação e escala para preservar a aparência ao mover o pivô.
- TransformControls continua editando a posição autoral correta mesmo quando o objeto usa pivô deslocado.
- Controle `Extrusão` em metros define a espessura da Ribbon; Ribbons usam seção retangular real com `ExtrudeGeometry`, e a edição participa de Undo/Redo.
- Projetos antigos sem `extrusion` continuam válidos e recebem uma espessura proporcional à largura quando projetados.
- Seletor `Alvo` alterna entre `Plano XZ` e `Superfície 3D`; o segundo modo faz raycast apenas contra objetos autorais e grava os pontos mundiais com snapping.

## Verificação

```powershell
npm run test:vfx-composer:f1
npm run test:vfx-composer
npm run typecheck:vfx-composer
npm run build:vfx-composer
```

O teste F1 cobre o store, a persistência por adaptadores e uma experiência vertical no Edge offline, incluindo reload com localStorage, TransformControls, Ribbon extrudida, edição de vértices, pivô sem deslocamento visual, desenho livre no plano e sobre superfície 3D, além de exportação/importação JSON com Undo. Evidências ficam em `prototypes/vfx-composer/evidence/f1/`. Ainda não comprova o diálogo real da File System Access API.

## Limitações verificadas

- O fallback de download e a importação por `<input type=file>` foram comprovados no Edge offline; o diálogo nativo da File System Access API exige interação manual e não foi automatizado.
- A F1 não inclui timeline avançada, materiais, partículas, eventos ou publicação, reservados às fases posteriores da especificação.
- A F2 não foi iniciada.
