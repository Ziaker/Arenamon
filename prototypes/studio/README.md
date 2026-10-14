# Arenamon Animation Studio (v7 · Fase 1 + interface + Rigging experimental)

Editor de animações esqueléticas no navegador, construído sobre o Studio v6. Gere com `npm run build` e abra
`dist/arenamon-animation-studio.html` por duplo clique: o HTML contém Three.js, FBXLoader, GLTFLoader e
GLTFExporter e funciona offline. Nenhum modelo é embutido.

## Origem do código

O v6 era um único HTML com o bundle minificado do importador editado à mão e quatro scripts colados no fim.
Não havia fonte correspondente no repositório. A Fase 1 transformou esse HTML em fontes:

| Arquivo | Origem |
| --- | --- |
| `src/template.html` | Marcação e CSS do v6 (sem alterações de conteúdo). |
| `src/engine.js` | Importador (`prototypes/importer/src/main.js`) + alterações do bundle v6 (pintura global, `sourceFile`, ganchos V3) + API de edição. |
| `src/actions.js` | Editor de ações do importador com a lista expandida do v6. |
| `src/legacy/*.js` | Scripts V3–V6 do HTML, quase literais. As alterações estão marcadas com “Fase 1”. |
| `src/editor/*` | Novo: modelo não destrutivo, histórico, timeline, ferramentas, comparação. |

## Interface

- **Barra superior:** modelo carregado, animação selecionada, estado de salvamento, desfazer/refazer, **Salvar** e **Exportar**.
- **Barra de ferramentas (esquerda):** Projeto, **Rigging**, Aparência, Cenário, Câmera, Movimento, Inspeção e Exportar abrem uma ferramenta por vez no painel lateral. Clicar no ícone ativo, ou em ⟨, recolhe o painel. O painel pode ser redimensionado pela divisória (arraste ou setas do teclado).
- **Animações / Editar:** mostram ou ocultam a biblioteca (direita) e a timeline (embaixo).
- O botão **Foco** (menu “Mais” do visualizador) recolhe as duas laterais.
- No tablet (≤ 1100 px), os painéis aparecem sobrepostos ao visualizador, um de cada vez. No celular (≤ 700 px), a barra de ferramentas fica embaixo e os painéis abrem como folhas.
- Cada controle da v6 foi movido, com o mesmo id e handler, para uma única ferramenta. O antigo painel “Seu projeto”, a gaveta “Ajustes” e o diálogo de exportação deixaram de existir como superfícies separadas. Os atalhos do visualizador (câmera, grid, visão do jogo) continuam sincronizados com as abas Câmera e Cenário.

## Rigging — preparação antes da animação

A aba **Rigging** tem dois fluxos: editar/validar os ossos de um personagem já rigado, ou criar **20 pontos ósseos guiados** para uma malha sem rig e gerar pesos iniciais por proximidade aos segmentos. Inclui simetria Left/Right, edição no visualizador por marcadores, coordenadas locais/mundo, comprimento entre bones, vértices influenciados, diagnóstico de pesos e exportação/importação JSON. A geometria é realmente convertida em `SkinnedMesh`, e o GLB pode ser reimportado. O cálculo automático **não garante anatomia ou pesos profissionais**; pintura manual de pesos e templates não humanoides são objetivos futuros. Veja [RIGGING_FASE1.md](RIGGING_FASE1.md).

## Animações genéricas para teste do Rigging

Na aba **Rigging**, o grupo **Animações genéricas para testar o rig** oferece oito movimentos procedurais: inspeção osso por osso, idle, caminhada, corrida, agachamento, investida, esquiva e defesa. Eles ajudam a detectar falhas de pesos e de orientação em personagens humanoides e semihumanoides.

A interface reconhece nomes conhecidos (como Mixamo) e os ossos do template guiado. Para esqueletos com nomes atípicos, disponibiliza **mapeamento manual por articulação**, intensidade ajustável e relatório de articulações ausentes.

**Adicionar à biblioteca** gera um `AnimationClip` separado sem apagar animações anteriores; **Gerar e assistir** também abre a prévia. Os movimentos são marcados como **DIAGNÓSTICO**, apenas para testar deformações, **sem root motion, física de combate ou eventos de hitbox**.

Veja [DIAGNOSTIC_ANIMATIONS.md](DIAGNOSTIC_ANIMATIONS.md) para limitações, procedimentos e testes.

## Salvar, sair e recuperar

- **Salvar projeto** grava um `.arenamon.glb` completo: materiais originais, animações editadas, organização, eventos e root motion. Reabra-o como modelo para continuar. O **GLB final** e o **JSON** ficam em Exportar e não contam como salvar o projeto.
- O estado “Projeto salvo” só aparece depois que o arquivo é gravado pelo seletor do navegador (File System Access API). Cancelar o seletor ou uma falha de gravação mantêm “Alterações não salvas”. Sem essa API, o arquivo vai para Downloads e o estado mostra “baixado · não verificado”.
- **Marcam alterações:** importar modelos e animações, renomear, organizar e associar, edições da timeline (todas as que entram no desfazer), favoritos, marcadores, loop A–B e câmeras salvas. Reproduzir, mover a câmera, trocar de aba ou mudar preferências de prévia (grid, cores, câmera ativa) não marcam.
- **Ao substituir o modelo** com alterações pendentes, o Studio pergunta: Cancelar, Sair sem salvar ou Salvar projeto. Ao fechar ou recarregar a aba, aparece o aviso nativo do navegador.
- **Recuperação local:** com alterações pendentes, depois de 4 s sem novas edições, o projeto completo é gravado no IndexedDB deste navegador. Nada é enviado a servidores. O limite é de 80 MB, e a cópia não é gravada se faltar cota. Na próxima abertura, o painel Projeto oferece Recuperar ou Descartar. A cópia é apagada ao salvar o projeto ou ao escolher “Sair sem salvar”.

## Uso rápido

1. Em **Projeto**, importe o personagem. Se ele não tem esqueleto, use **Rigging** para criar um rig inicial e vincular a malha; se já é rigado, ajuste as posições e verifique o skin. Depois anexe as animações. Nomes genéricos (`mixamo.com`, `Take 001`) passam a usar o nome do arquivo.
2. Escolha a animação na barra da timeline. Arraste na régua para navegar. Use ←/→ para avançar quadro a quadro.
3. Em **✂ Recortar**, arraste na faixa *Trecho* ou use I/O. Depois clique em **Criar clipe com o trecho**.
4. Use **Salvar** para guardar o projeto e **Exportar › GLB final** para levar ao jogo.

Atalhos: Ctrl+S salva · Espaço reproduz · ←/→ quadro · Home/End · I/O marcam o trecho · Ctrl+Z / Ctrl+Y (ou Ctrl+Shift+Z) · Delete remove o evento selecionado · Ctrl+roda dá zoom na timeline.

## Ferramentas da Fase 1

- **Timeline:** régua em quadros/segundos, FPS de trabalho (24/30/60), zoom e rolagem horizontal, faixas de trecho, eventos, marcadores da V4 e chaves. A altura é redimensionável e a timeline pode ser recolhida.
- **Recortar:** cria um clipe derivado ou recorta o atual. As fronteiras recebem chaves interpoladas: lerp para vetores, slerp para quaternions e degrau para tracks discretos.
- **Tempo:** velocidade (%), duração, fechar loop, duplicar, restaurar original e excluir derivado. Fechar loop faz o fim convergir suavemente para a pose inicial. Por padrão, o avanço horizontal da raiz é preservado.
- **Eventos:** 13 tipos de evento de combate, como início de ataque, hitbox, invulnerabilidade, impacto, efeitos, som, recuperação, contato com o chão e movimento especial. Eles podem ser posicionados, renomeados, movidos, recebem um parâmetro livre e mostram avisos para pares abertos. São apenas dados: não alteram o combate.
- **Root motion:** detecta o osso raiz e mostra deslocamento (em unidades do modelo), altura e giro acumulado. Também permite reduzir ou remover o deslocamento horizontal, de forma total ou removendo só o avanço linear. A altura e o giro (yaw) podem ser neutralizados. O resultado pode virar uma versão nova ou ser aplicado ao clipe atual.
- **Comparar:** reaproveita o comparador da V3 (botão, tipos e divisão de tela) e acrescenta *A × B* e *Original × editada*. Oferece vista lado a lado ou sobreposição transparente, sincronia por tempo ou fase, ou reprodução independente com velocidade e pausa próprias para B.
- **Desfazer/Refazer:** cobre todas as edições de animação, eventos e criação/exclusão de clipes derivados.

## Modelo não destrutivo

- Ao entrar na biblioteca, cada clipe tem uma cópia da fonte guardada em memória (`store.source`).
- As edições nunca alteram arrays de tracks. Cada operação gera tracks novos e o histórico guarda referências aos estados antes/depois.
- Versões derivadas são clipes novos, com `derivedFrom`, adicionados ao fim da lista. Clipes importados não podem ser excluídos.
- As operações de **edição de clipes** não alteram o esqueleto, skinning ou hierarquia. A nova aba **Rigging** é uma ferramenta separada: ela pode editar a pose de repouso ou criar um skin inicial, com confirmação antes da conversão estrutural. Consulte [RIGGING_FASE1.md](RIGGING_FASE1.md). A exportação continua a clonar o modelo e restaurar a pose de repouso atualizada.

## Dados exportados

Cada animação do GLB recebe `extras.arenamon` (o GLTFExporter grava `clip.userData`; o GLTFLoader devolve o mesmo
objeto ao reimportar):

```json
{
  "schemaVersion": 1, "id": "clip-…", "fps": 30,
  "derivedFrom": {"id": "clip-…", "clipName": "tackle"},
  "edits": [{"op": "trim", "start": 1.2, "end": 1.6, "at": "2026-10-14T…"}],
  "events": [{"id": "ev-…", "type": "hitbox_on", "time": 0.2667, "frame": 8, "label": "Hitbox do tackle", "payload": ""}],
  "rootMotion": {
    "rootNode": "mixamorigHips", "inPlace": true, "horizontalRemoved": true, "verticalRemoved": false, "yawRemoved": false,
    "options": {"horizontal": 0, "method": "full", "vertical": "keep", "rotation": "keep"},
    "original": {"fps": 30, "space": "model", "relativeTo": "first-frame", "columns": ["time", "x", "y", "z", "yawDegrees"], "samples": [[0, 0, 0, 0, 0]], "metrics": {}}
  }
}
```

O manifesto do nó raiz (`extras.arenamonActions`, o mesmo do JSON de ações) ganha `animationEditor` com a lista
de tipos de evento e o resumo por clipe (`clipIndex`, `clipName`, eventos com `frame`, root motion). O tempo do evento
fica em segundos (`time`). `frame` é derivado do FPS de trabalho no momento da exportação.

**Root motion no jogo:** a física do Arenamon controla a posição autoritativa. Use clipes com `inPlace: true` e não
reaplique `rootMotion.original`. Esse dado serve para medir ou calibrar, não para mover o personagem uma segunda vez.

## GLTFExporter: limitações e estratégia

- Exporta tracks lineares, de degrau e cubic spline vindas do GLTFLoader. Curvas `InterpolateSmooth` do Three não têm equivalente em glTF. Por isso, as operações convertem tracks cúbicos em amostras lineares (`bakeTrack`). Na Fase 2, curvas Bézier e mistura serão consolidadas por bake controlado antes da exportação.
- O glTF não guarda a duração do clipe. Ela é recalculada pela última chave. Todas as operações deixam uma chave no fim de cada track, então a duração sobrevive à reimportação.
- Metadados vão em `extras`, que é JSON puro.

## Testes

- `node prototypes/studio/test/ops.test.mjs` tem 18 testes unitários em Node. Eles cobrem recorte com interpolação, não destrutividade, velocidade, eventos, fechamento de loop, bake, decomposição swing–twist, análise e edição de root motion, histórico e avisos.
- `node prototypes/studio/verify.mjs` testa no Edge headless, offline, um rig sintético no estilo Mixamo. O fluxo inclui importação com nomes duplicados, timeline, recorte de 0,4 s, eventos nos quadros 8/22, versão in-place, tempo/loop/restaurar com undo/redo, drag & drop, comparação e regressões do v6. Em seguida, exporta o GLB, reimporta e confirma que recorte, eventos, in-place, nomes, associações, hierarquia e skinning foram preservados.
- `ARENAMON_LOCAL_MODEL=…glb node prototypes/studio/verify.mjs` acrescenta um modelo local. Os resultados ficam em `validation/`, que é ignorado pelo Git.
- `node prototypes/studio/test/local-shot.mjs modelo.glb [índice]` gera capturas locais do editor.
- `node prototypes/studio/test/shots.mjs` e `node prototypes/studio/test/smoke.mjs nome largura altura` geram as capturas de comparação com o rig sintético.
- O `verify.mjs` usa um seletor de arquivos simulado para testar gravação, cancelamento e falha, além de layout, abas, painéis, aviso de saída e recuperação.
