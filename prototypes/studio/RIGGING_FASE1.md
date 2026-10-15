# Arenamon Animation Studio — Rigging, primeira entrega funcional

**Situação:** implementação experimental em branch isolada `feat/studio-rigging-fase1-gpt6`. A funcionalidade precisa de avaliação com personagens reais antes da homologação. Não fazer merge na `main` sem autorização.

## Local na interface

A ferramenta **Rigging** fica na barra de ferramentas **depois de Projeto e antes de Aparência/Animações**. A integração não substitui o importador, a biblioteca ou a timeline. A função é dar uma etapa anterior à animação para preparar a estrutura esquelética dentro do Studio.

## Caminho A — personagem SEM rig

1. Em **Projeto**, importe FBX ou GLB com a malha, sem skinning.
2. Abra **Rigging** e clique em **Criar/renovar pontos guiados**.
3. O modelo recebe um rascunho editável de **20 posições ósseas**. Não é aplicado skin nem deformação ainda.
4. Selecione um marcador clicando no visualizador ou no seletor. Edite em X/Y/Z ou arraste o manipulador; use simetria para os pares Left/Right. O sistema calcula a posição **relativa à raiz do modelo**, sem confundir coordenadas da tela com coordenadas 3D.
5. Ajuste clavículas, ombros, cotovelos, punhos, quadris, joelhos, tornozelos, pés, coluna, pescoço e cabeça. O template é uma aproximação, não uma posição anatômica perfeita.
6. Clique em **Vincular malha aos ossos (skin)** e confirme o aviso de operação estrutural.
7. O sistema cria `THREE.SkinnedMesh`, `THREE.Bone`, `THREE.Skeleton`, `skinIndex` e `skinWeight`, com até quatro influências por vértice. A distribuição inicial usa a distância dos vértices aos segmentos entre ossos, com suavização ajustável.
8. Use **Teste temporário da deformação** para rotacionar cada articulação. Retorne a 0°, verifique as regiões de dobra e salve o projeto GLB.
9. Exporte e reimporte o GLB para confirmar que skin e hierarquia foram preservados. Anexe/importa animações no Studio **depois** de preparar o rig.

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
  "version": 1,
  "space": "model-root",
  "joints": [
    {"name": "Hips", "parent": null, "p": [0, 1.2, 0]},
    {"name": "Spine", "parent": "Hips", "p": [0, 1.7, 0]}
  ]
}
```

O JSON exportado traz também `bounds`, `audit`, coordenadas locais/mundo para rigs existentes e identificação do modelo.

O usuário pode anexar esse JSON a uma conversa para auditoria osso por osso, e reimportar o arquivo corrigido. A importação em modelos já rigados altera posições dos ossos correspondentes, **não substitui nomes, topologia ou pesos**. Em malhas sem rig, restaura o rascunho de pontos.

Não importamos arbitrariamente novos esqueletos por JSON em malhas já vinculadas.

## Salvamento e histórico

- **Salvar projeto** e **Exportar GLB** preservam o skinning criado e as poses de repouso capturadas.
- Um rascunho anterior ao bind também é armazenado como `userData.arenamonRigDraft` no GLB do projeto; ao reabrir, o Studio tenta localizar o nó onde os metadados foram salvos e converte as coordenadas à nova raiz do modelo.
- Alterar posições (inclusive simetria) entra no histórico. A etapa de **gerar o skin é estrutural e intencionalmente NÃO tem undo**; após vinculá-lo o histórico de undo anterior é limpo para evitar operações de rascunho aplicadas em ossos de outra estrutura. Faça uma cópia antes.
- Mudanças de rig chamam o mecanismo existente de alterações não salvas, salvamento e recuperação local.
- Marcadores, helper e teste de rotação são recursos de visualização e **não são exportados**.

## Limitações desta primeira entrega

1. Pesos são automáticos e básicos; **não há pintura manual de pesos**, mapas de influência, IK, retargeting automático, controles para acrescentar/remover ossos ou geração automática de anatomia de criaturas não humanas.
2. O template de 20 ossos é configurável em posição, mas a sua topologia é fixa nesta etapa. Personagens com membros extraordinários precisarão de topologias personalizadas numa fase posterior.
3. Rig importado com nomes de ossos duplicados ou hierarquias com múltiplas raízes exige análise especial; a ferramenta avisa casos diagnosticados, mas a edição por nome e a importação JSON não são ideais para essas estruturas.
4. O modo de preview de flexão gira temporariamente um osso para inspecionar pesos; não cria animação nem keyframes.
5. Testes com um rig sintético não provam que deformações dos modelos proprietários são satisfatórias.
6. Limite de segurança da vinculação automática: 250.000 vértices. Verificação do GLB exportado depende do formato suportado por `GLTFExporter`.

## Testes

- `node prototypes/studio/test/rigging.test.mjs` — geometria, simetria, validação, atributos skinned, pesos e deformação.
- `node prototypes/studio/test/rigging.browser.mjs` — interface, edições, undo/redo, pesos, teste de flexão, GLB roundtrip, telemetria, rigs existentes e layout responsivo.
- `node prototypes/studio/test/ops.test.mjs` e `node prototypes/studio/verify.mjs` — regressões pré-existentes, mantidas.
- `npm run build` gera `prototypes/studio/dist/arenamon-animation-studio.html` único e offline.

Os modelos proprietários devem ficar no disco local do usuário. Não commitar arquivos Pokémon, FBX ou GLB privados.

## Próximas fases recomendadas

Após avaliar esta entrega no browser, priorizar: edição manual de pesos com pincel e heatmap; criação/exclusão/reparenting de ossos; convenção esquerda/direita configurável; ferramentas de checagem de simetria e comprimento; templates paramétricos para criaturas; IK de mãos/pés; importação/retargeting de clips Mixamo; validação de deformação com animações reais.
