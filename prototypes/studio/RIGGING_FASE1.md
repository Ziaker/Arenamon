# Arenamon Animation Studio — Rigging, primeira entrega funcional

**Situação:** editor estrutural experimental na branch isolada `codex/rig-editor-fase1`, construído sobre `feat/studio-rigging-fase1-gpt6`. A funcionalidade precisa de avaliação com personagens reais antes da homologação. Não fazer merge na `main` sem autorização.

## Local na interface

A ferramenta **Rigging** fica na barra de ferramentas **depois de Projeto e antes de Aparência/Animações**. A integração não substitui o importador, a biblioteca ou a timeline. A função é dar uma etapa anterior à animação para preparar a estrutura esquelética dentro do Studio.

## Caminho A — personagem SEM rig

1. Em **Projeto**, importe FBX ou GLB com a malha, sem skinning.
2. Abra **Rigging** e clique em **Criar/renovar pontos guiados**.
3. O modelo recebe um rascunho editável de **20 posições ósseas**. Não é aplicado skin nem deformação ainda.
4. Selecione um marcador clicando no visualizador, seletor ou árvore hierárquica. Crie, duplique, renomeie, exclua ou troque o pai de qualquer osso. Cada articulação recebe um ID estável que não muda quando o nome é editado.
5. Edite em X/Y/Z ou arraste o manipulador; alterne mover/rotacionar, local/global, snapping, precisão e bloqueio de eixos. Use simetria para os pares Left/Right. O sistema calcula a posição **relativa à raiz do modelo**, sem confundir coordenadas da tela com coordenadas 3D.
6. Use as vistas ortográficas frontal, traseira, esquerda, direita e superior, foco na articulação, transparência e raio X para posicionar pontos dentro da malha. Os marcadores mantêm tamanho visual legível durante o zoom e exibem etiquetas.
7. Ajuste o template à anatomia do personagem e clique em **Vincular malha aos ossos (skin)**.
8. O sistema cria `THREE.SkinnedMesh`, `THREE.Bone`, `THREE.Skeleton`, `skinIndex` e `skinWeight`, com até quatro influências por vértice. A distribuição inicial usa a distância dos vértices aos segmentos entre ossos, com suavização ajustável.
9. O bind inteiro é uma transação: **Desfazer** restaura a malha estática e o rascunho; **Refazer** recoloca o mesmo skin sem recalcular ou perder os IDs.
10. Use **Teste temporário da deformação**, exporte e reimporte o GLB para confirmar que skin e hierarquia foram preservados. Anexe/importa animações no Studio **depois** de preparar o rig.

A vinculação é bloqueada se o modelo sem rig contiver clipes importados: trocar `Mesh` por `SkinnedMesh` troca UUIDs e invalidaria trilhas ligadas à malha. Importe um modelo limpo para essa etapa.

## Caminho B — personagem JÁ rigado

1. Importe FBX/GLB com os ossos e o skin existente.
2. Abra **Rigging**. A reprodução é pausada e o modelo retorna à pose de repouso.
3. Selecione os ossos por nome ou marcador 3D, altere a posição e espelhe o par quando desejar.
4. O Studio recalcula as matrizes inversas do bind e atualiza a pose de repouso registrada para exportação. **Não sobrescreve os pesos originais do skin**.
5. Posições editadas participam do histórico de desfazer/refazer do Studio.
6. Use o teste de dobra e exporte para GLB; o editor mantém as animações existentes, mas deformações e retargeting precisam de revisão visual.

**Atenção:** reconfigurar a pose de repouso de um personagem com animações pré-existentes pode alterar a deformação reproduzida. O usuário deve testar animações após a edição.

## Telemetria e verificações

O painel mostra, quando disponível:

- Nome e pai de cada osso, posição na raiz do modelo, posição local do osso e posição no mundo.
- Comprimento em relação ao osso pai, rotação local em quaternion, matriz de bind inversa e vértices influenciados.
- Estatísticas por malha: número de vértices, skinned ou não, número de ossos, pesos inválidos, vértices sem influência e ossos sem influência.
- Avisos de duplicidade de nomes, ossos coincidentes, skin incompleto ou inexistente.

Os números do JSON de coordenadas são mantidos com precisão numérica do modelo, sem arredondamento a cinco casas. A exibição no painel é arredondada para leitura, mas **não se trata de coordenadas anatômicas verificadas automaticamente**. Não existe um algoritmo universal que determine a posição correta dos ossos em qualquer criatura.

## JSON de rig para correção assistida

A aba oferece **Exportar coordenadas JSON** e **Importar coordenadas JSON**. O arquivo segue:

```json
{
  "schema": "arenamon-rig",
  "version": 2,
  "space": "model-root",
  "joints": [
    {"id": "joint-…", "name": "Hips", "parent": null, "p": [0, 1.2, 0], "q": [0, 0, 0, 1]},
    {"id": "joint-…", "name": "Spine", "parent": "Hips", "p": [0, 1.7, 0], "q": [0, 0, 0, 1]}
  ]
}
```

O JSON exportado traz também `bounds`, `audit`, coordenadas locais/mundo para rigs existentes e identificação do modelo.

### Compatibilidade do contrato

- **Leitura v1:** continua aceita. Como v1 não exigia `id` nem `q`, o Studio atribui IDs estáveis e quaternion identidade somente na cópia em memória antes de editar ou vincular.
- **Leitura v2:** é estrita. Cada articulação precisa de `id` único e não vazio e de `q` com quatro números finitos. IDs duplicados, versões desconhecidas e quaternions inválidos são recusados, sem correção silenciosa.
- **Escrita:** novos rascunhos, metadados de GLB e JSON de coordenadas são emitidos em v2. A versão declarada corresponde aos campos efetivamente gravados.
- O upgrade em memória não muda o arquivo v1 de origem. Ele só passa a v2 quando o usuário exporta ou salva novamente pelo Studio.

O usuário pode anexar esse JSON a uma conversa para auditoria osso por osso, e reimportar o arquivo corrigido. A importação em modelos já rigados altera posições dos ossos correspondentes, **não substitui nomes, topologia ou pesos**. Em malhas sem rig, restaura o rascunho de pontos.

Não importamos arbitrariamente novos esqueletos por JSON em malhas já vinculadas.

## Salvamento e histórico

- **Salvar projeto** e **Exportar GLB** preservam o skinning criado e as poses de repouso capturadas.
- Um rascunho anterior ao bind também é armazenado como `userData.arenamonRigDraft` no GLB do projeto; ao reabrir, o Studio tenta localizar o nó onde os metadados foram salvos e converte as coordenadas à nova raiz do modelo.
- Alterações de posição/orientação, criação, duplicação, nome, hierarquia e exclusão entram no histórico. A etapa de **gerar o skin também tem Undo/Redo transacional** e conserva o histórico do rascunho.
- Mudanças de rig chamam o mecanismo existente de alterações não salvas, salvamento e recuperação local.
- Marcadores, helper e teste de rotação são recursos de visualização e **não são exportados**.

## Limitações desta primeira entrega

1. Pesos são automáticos e básicos; **não há pintura manual de pesos**, mapas de influência, IK, retargeting automático ou geração automática de anatomia de criaturas não humanas.
2. O template inicial continua humanoide, mas sua topologia agora é livre: caudas, orelhas, asas, dedos e membros adicionais podem ser criados manualmente.
3. Rig importado com nomes duplicados ou múltiplas raízes exige análise especial. A seleção da interface usa IDs estáveis, mas a compatibilidade por nome de animações/JSON ainda pode ser ambígua.
4. O modo de preview de flexão gira temporariamente um osso para inspecionar pesos; não cria animação nem keyframes.
5. Testes com um rig sintético não provam que deformações dos modelos proprietários são satisfatórias.
6. Limite de segurança da vinculação automática: 250.000 vértices. Verificação do GLB exportado depende do formato suportado por `GLTFExporter`.

## Testes

- `node prototypes/studio/test/rigging.test.mjs` — geometria, simetria, JSON v1/v2, IDs duplicados, skinning com 2/3/20 ossos, pesos e deformação.
- `node prototypes/studio/test/rigging.browser.mjs` — interface, edições, metadados durante Undo/Redo, operações estruturais, GLB roundtrip, telemetria, rigs existentes e layout responsivo.
- `node prototypes/studio/test/ops.test.mjs` e `node prototypes/studio/verify.mjs` — regressões pré-existentes, mantidas.
- `npm run build` gera `prototypes/studio/dist/arenamon-animation-studio.html` único e offline.
- `npm run verify` reproduz localmente o mesmo comando obrigatório do workflow `.github/workflows/arenamon-studio-rigging.yml`. O CI publica o HTML e os relatórios de `prototypes/studio/validation/` como artefato por 14 dias, inclusive em falhas.

Os modelos proprietários devem ficar no disco local do usuário. Não commitar arquivos Pokémon, FBX ou GLB privados.

## Próximas fases recomendadas

Após avaliar esta entrega no browser, priorizar: edição manual de pesos com pincel e heatmap; convenção esquerda/direita configurável; ferramentas de checagem de simetria e comprimento; templates paramétricos para criaturas; IK de mãos/pés; importação/retargeting de clips Mixamo; validação de deformação com animações reais.
