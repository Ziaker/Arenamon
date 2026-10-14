# Importador de protótipos

Execute `npm run build` e abra `dist/importador-prototipo.html` por duplo clique. O HTML contém Three.js, FBXLoader, GLTFLoader e GLTFExporter e funciona offline. Não contém modelos embutidos.

Importe um FBX ou GLB rigado, depois selecione um ou vários arquivos para anexar animações. As animações internas são preservadas. Animações externas são associadas por nome (incluindo a variação de prefixo `mixamorig`), sem modificar ossos, hierarquia ou pesos. Isso exige rigs e poses de referência compatíveis; não converte automaticamente um rig arbitrário em Mixamo. Um arquivo com um alvo desconhecido é rejeitado sem anexar parcialmente seus clips.

O padrão é texturas OFF, iluminação OFF, exportação sem texturas e unlit ON. As cores podem ser globais ou distribuídas por identidade do material original. Materiais de protótipo são opacos, sem mapas, sem cores por vértice e sem iluminação. O preview não usa sombras, environment ou tone mapping. Os controles de exportação são independentes do preview.

A exportação clona o esqueleto e restaura as transformações locais originais antes de salvar. MeshBasicMaterial produz `KHR_materials_unlit`. Geometria, morph targets, skinning e clips seguem para GLB. Texturas embutidas podem ser visualizadas ao ativar Texturas; caminhos externos são substituídos por um pixel local. Arquivos Draco/KTX2 e rigs que exigem retarget não são suportados nesta versão.

`node prototypes/importer/verify.mjs` testa offline um rig sintético texturizado, três clips, anexação incremental, rejeição de alvo inválido, alternância do preview, GLB sem imagens/texturas, unlit e deformação após reimportar. Defina `ARENAMON_LOCAL_MODEL` para testar adicionalmente um GLB local: conta/nome dos clips, skins, hierarquia dos ossos e contagens de atributos. Resultados e GLBs ficam em `validation/`, excluído do Git. Recursos proprietários nunca entram no build nem nos testes públicos.
