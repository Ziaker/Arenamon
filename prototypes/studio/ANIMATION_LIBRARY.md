# Biblioteca de animações reais — auditoria e compatibilidade

Data da pesquisa: 14 de outubro de 2026. Esta entrega parte de `fix/studio-diagnostic-ci` (`a549d23`) e não altera o núcleo estrutural de Rigging, o laboratório de combate ou as propostas A/B/C.

## Fontes pesquisadas

| Fonte | Autor / versão verificada | Licença e evidência | Formato / rig | Seleção | Decisão |
|---|---|---|---|---:|---|
| [Universal Animation Library](https://quaternius.itch.io/universal-animation-library) | Quaternius · Standard v3.0 · arquivo de 16/06/2026 | CC0 1.0 declarada na página oficial e no `License.txt` do pacote | GLB/FBX · humanoide universal, 65 bones, 30 FPS | 20 de 43 clipes do GLB Standard | **Incluída.** Duas variantes oficiais: in-place e root motion. Personagem demonstrativo do mesmo pacote. |
| [KayKit Character Animations](https://kaylousberg.itch.io/kaykit-character-animations) | Kay Lousberg · Free 1.1 | CC0 1.0 declarada na página oficial; uso pessoal/comercial e sem atribuição obrigatória | FBX/GLTF · `Rig_Medium` e `Rig_Large` · 161 movimentos anunciados | 0 nesta entrega | Candidata legítima. Não foi embutida para não duplicar ~14 MB antes de validar as duas famílias de rig e evitar inflar o HTML inicial. |
| [CMU Motion Capture Database](https://mocap.cs.cmu.edu/) | Carnegie Mellon Graphics Lab · base contínua, 2605 trials anunciados | A página oficial permite todos os usos e produtos comerciais, mas proíbe revenda direta dos dados, inclusive convertidos; agradecimento é solicitado | ASF/AMC por sujeito, esqueletos calibrados diferentes | 0 | Não redistribuída. Embutir conversões no Studio pode se aproximar da redistribuição direta proibida e exigiria um conversor ASF/AMC auditado. |

Mixamo não é redistribuído. O Studio continua aceitando FBX/GLB obtido legitimamente pelo próprio usuário.

## Pacote incorporado

Arquivos preservados em `assets/animation-library/quaternius-ual1-v3/`, junto da licença, README e proveniência:

- `UAL1_Standard.glb` — SHA-256 `69591853D817488EDAA8FD9BF8FC1D821EAEAF789F8627B3CD23B41C4ED67997`.
- `UAL1_Standard_RM.glb` — SHA-256 `BE684571ED655A1B892C2C07E6E2AECA053B606C442D34004ADAF1D944090D01`.
- `UAL1_Standard.fbx.gz` — FBX oficial compactado, usado somente pela suíte automatizada; não é incorporado ao HTML.

O build incorpora ambos como data URLs. O resultado continua sendo um único HTML que abre por duplo clique, sem rede. O tamanho maior (~21 MB) é consequência explícita dos dois GLBs reais; não há download oculto em runtime.

### Catálogo inicial (20 clipes reais)

- Locomoção: Idle, caminhada, corrida leve, sprint/arrancada e caminhada agachada.
- Combate: rolamento, soco direto, soco cruzado, ataque amplo, impactos no tronco/cabeça e queda.
- Genéricas: agachamento parado, início/sustentação/aterrissagem do salto, interação, empurrar, dança/giro e ajoelhar/interagir.

Os nomes “investida”, “esquiva” e “ataque” descrevem somente a aparência do movimento. Nenhum clipe cria dano, hitbox, invulnerabilidade ou regra de física.

## Retarget

1. Indexa bones da origem e do personagem por nome canônico, sem aceitar nomes duplicados silenciosamente.
2. Prioriza correspondência exata e depois aliases anatômicos para raiz, quadril, coluna, cabeça, braços e pernas.
3. Permite substituir manualmente cada papel por um bone do personagem atual.
4. Avalia requisitos específicos por clipe; o botão de adicionar fica bloqueado se faltarem articulações essenciais.
5. Faz bake a 30 FPS. Para cada amostra, calcula a variação da orientação global da origem em relação à pose de repouso e a reconstrói na hierarquia do destino.
6. Gera somente trilhas de quaternion para bones mapeados. Posições intermediárias e escalas não são copiadas.
7. Root motion é opcional e gera uma única trilha de posição na raiz, escalada pela altura relativa dos modelos.
8. O clipe resultante aponta para UUIDs reais do modelo e inclui fonte, licença, FPS, mapeamento e bones ausentes em `clip.userData.arenamonLibrary`.

O esqueleto, skinning e pose de repouso do personagem não são substituídos. A operação cria um `AnimationClip` novo e entra no Undo/Redo.

## Fluxo de teste

1. Abra **Biblioteca** e clique em **Abrir demonstração CC0**.
2. Escolha uma entrada e confira compatibilidade, duração, loop e root motion.
3. Use **Prévia temporária** para assistir sem alterar o projeto.
4. Use **Adicionar ao projeto** para criar um clipe editável.
5. Edite na timeline, salve o projeto ou exporte o GLB.
6. Reimporte o GLB para confirmar skinning, clipe e metadados.

## Limitações reais

- A entrega prioriza humanoides e semihumanoides. Quadrúpedes e anatomias incomuns são bloqueados quando os requisitos não são atendidos; não existe retarget anatômico automático para criaturas.
- Fingers/twist bones só são preservados quando há correspondência exata. O mapeamento manual atual cobre os papéis corporais principais.
- Não há IK de contato com o chão nesta fase; diferenças grandes de proporção podem produzir pés deslizando ou membros intersectando.
- O bake preserva rotação e root motion translacional. Tracks de escala e translação de bones intermediários são descartados deliberadamente.
- O mapeamento manual vale para a sessão atual; ainda não há presets persistentes por espécie/rig.
- KayKit e CMU foram pesquisados, mas não integrados. A ausência é deliberada e não é apresentada como compatibilidade validada.
- Aprovação automatizada não substitui avaliação visual/jogável do usuário.

## Testes específicos

- Integridade dos dois GLBs, 65 bones, 2 SkinnedMesh e presença dos 20 clipes; o FBX oficial também é aberto pelo `FBXLoader` com 43 animações, 65 bones e skinning.
- Diferença real entre arquivos in-place e root-motion.
- Correspondência Quaternius → rig com nomes Mixamo, falha explícita e repousos diferentes.
- Bake quaternion, root motion opcional e ausência de tracks órfãos.
- Personagem demonstrativo, reprodução no `AnimationMixer`, Undo/Redo e preservação dos oito diagnósticos.
- Exportação/reimportação GLB com 2 SkinnedMesh, clipe real, 65 tracks e metadados CC0.
