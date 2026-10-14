# Importador de protótipos

O estado de importação aparece junto ao seletor de modelo. O carregamento só é confirmado após preparar os materiais e desenhar o preview. **Enquadrar modelo** recalcula a câmera a partir da pose atual. Arquivos sem malha (por exemplo, Mixamo Without Skin) são rejeitados no campo de modelo sem remover o personagem já aberto; use o campo de anexação para eles.

Os testes verificam pixels visíveis no preview. Defina `ARENAMON_LOCAL_FBX` ao executar `node prototypes/importer/verify.mjs` para verificar também um FBX local, o reenquadramento e o layout em janelas larga e estreita. Nenhum modelo local é incluído no repositório.

## Nomes e ações

Selecione um clip, edite seu nome e clique em **Renomear animação**. Nomes vazios ou repetidos são rejeitados. Na importação, nomes duplicados recebem sufixos numéricos para que as referências sejam inequívocas. Renomear não altera os tracks nem o rig.

A lista **Ações do personagem** contém 23 ações e quatro extras opcionais. Cada ação pode apontar para qualquer clip; o mesmo clip pode atender várias ações. O contador mostra o que já foi associado e os campos vazios continuam pendentes. `downed` representa a recuperação no chão após knockback. Reimportar um GLB exportado aqui restaura o mapeamento salvo; importar outro modelo começa um novo mapeamento.

Exporte **GLB** e **ações (JSON)** ao terminar. Os nomes do JSON são os mesmos gravados nas animações do GLB, e os índices são baseados em zero. O arquivo `arenamon-actions.json` usa `schemaVersion: 1`, com `actions` (referência `{clipIndex, clipName}` ou `null`), `extras`, catálogo `clips`, `missingActions` e `warnings`. O mesmo documento fica em `extras.arenamonActions` no nó raiz exportado do GLB.

Nos extras, nomes como `alt tackle`, `alt walk back`, `alt dodge left` e `alt move 1` definem `alternativeFor`. Espaços, hífens e underscores são equivalentes. Nomes ambíguos ou sem ação reconhecida geram aviso e `alternativeFor: null`; não se tornam candidatos. Extras sem ação principal associada também geram aviso.

`randomAlternatives` descreve a regra para o consumidor do JSON: ao iniciar a ação, aplicar `probability` (padrão 0,20, ajustável de 0 a 100% na interface), escolher uniformemente entre clips extras distintos correspondentes e usar a animação principal quando não houver alternativa válida ou o sorteio não a selecionar. Associar o mesmo clip em dois extras não aumenta seu peso. A integração dessa regra no jogo é responsabilidade do consumidor; este laboratório exporta a configuração e não modifica o combate.

Os testes de navegador cobrem renomeação, nomes inválidos, associação, interpretação dos extras, exportação JSON, correspondência dos nomes no GLB e restauração do mapeamento ao reimportar.

Execute `npm run build` e abra `dist/importador-prototipo.html` por duplo clique. O HTML contém Three.js, FBXLoader, GLTFLoader e GLTFExporter e funciona offline. Não contém modelos embutidos.

Importe um FBX ou GLB rigado, depois selecione um ou vários arquivos para anexar animações. As animações internas são preservadas. Animações externas são associadas por nome (incluindo a variação de prefixo `mixamorig`), sem modificar ossos, hierarquia ou pesos. Isso exige rigs e poses de referência compatíveis; não converte automaticamente um rig arbitrário em Mixamo. Um arquivo com um alvo desconhecido é rejeitado sem anexar parcialmente seus clips.

O padrão é texturas OFF, iluminação OFF, exportação sem texturas e unlit ON. As cores podem ser globais ou distribuídas por identidade do material original. Materiais de protótipo são opacos, sem mapas, sem cores por vértice e sem iluminação. O preview não usa sombras, environment ou tone mapping. Os controles de exportação são independentes do preview.

A exportação clona o esqueleto e restaura as transformações locais originais antes de salvar. MeshBasicMaterial produz `KHR_materials_unlit`. Geometria, morph targets, skinning e clips seguem para GLB. Texturas embutidas podem ser visualizadas ao ativar Texturas; caminhos externos são substituídos por um pixel local. Arquivos Draco/KTX2 e rigs que exigem retarget não são suportados nesta versão.

`node prototypes/importer/verify.mjs` testa offline um rig sintético texturizado, três clips, anexação incremental, rejeição de alvo inválido, alternância do preview, GLB sem imagens/texturas, unlit e deformação após reimportar. Defina `ARENAMON_LOCAL_MODEL` para testar adicionalmente um GLB local: conta/nome dos clips, skins, hierarquia dos ossos e contagens de atributos. Resultados e GLBs ficam em `validation/`, excluído do Git. Recursos proprietários nunca entram no build nem nos testes públicos.
