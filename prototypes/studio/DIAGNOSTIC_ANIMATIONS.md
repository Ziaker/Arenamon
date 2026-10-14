# Arenamon Studio — animações genéricas para diagnóstico de rigging

**Branch experimental:** `feat/studio-diagnostic-animations-gpt6`, criada a partir de `feat/studio-rigging-fase1-gpt6`. Não fazer merge na `main` sem aprovação.

## Objetivo

Disponibilizar animações **procedurais simples e não destrutivas** dentro da aba **Rigging**, para ajudar a identificar defeitos de skinning e posições dos ossos em personagens humanoides e semihumanoides. Os movimentos não são animações autorais de qualidade de produção e **não substituem** rigging apropriado, pintura manual de pesos ou animação final.

## Movimentos disponíveis

| Preset | Diagnóstico principal |
|---|---|
| Inspeção osso por osso | Verificar influência e dobras isoladas |
| Respiração / idle | Estabilidade, pescoço e torso |
| Caminhada no lugar | Alternância de pernas, braços, tronco |
| Corrida no lugar | Deformações sob movimentos rápidos/amplos |
| Agachamento e recuperação | Joelho, quadril, tornozelo |
| Investida de combate | Ombro, tronco e cotovelo |
| Esquiva lateral | Torção e flexão lateral |
| Postura defensiva | Levantamento e flexão dos braços |

## Como usar

1. Importe o personagem em **Projeto**.
2. Se estiver sem rig, crie esqueleto e skin na aba **Rigging**. **Não** gere clipes de teste antes de criar o skin.
3. Abra **Rigging → Animações genéricas para testar o rig**.
4. Escolha um movimento, ajuste **intensidade** (10%–130%) e confira as articulações reconhecidas.
5. Em **Mapeamento dos ossos**, associe manualmente os bones se os nomes não seguirem convenções habituais. A interface aceita osso existente por UUID, sem renomear nem criar articulações.
6. Clique em **Adicionar à biblioteca** para inserir sem iniciar reprodução, ou **Gerar e assistir** para inserir e abrir a prévia.
7. Compare a malha em movimento e revise posições/pesos antes de gerar novos clipes.
8. Exporte GLB: os movimentos já adicionados entram como `AnimationClip` reais, com metadados `arenamonDiagnostic.testOnly=true`.

## Segurança e integração

- Os clipes originais são mantidos; gerar um teste **acrescenta** outro clipe, e marca o projeto como não salvo.
- Não é feito download de animações comerciais ou de arquivos de terceiros. A geração é inteiramente local no navegador.
- Tracks afetam **somente quaternion local** de bones reconhecidos. A geração não aplica `position` nem `root motion`; portanto, `tackle`, `dodge` e `guard` são apenas poses/movimentos demonstrativos, **não** acionam hitboxes, física de combate ou regras de invulnerabilidade.
- Não são criadas articulações inexistentes e não são sobrescritas poses/rotacões originais durante a geração. A captura parte da pose de repouso.
- Clipes gerados têm prefixo **DIAGNÓSTICO** e marcação `testOnly`. Não devem ser associados automaticamente a ações definitivas do jogo.
- A nomenclatura `mixamorig` e a estrutura guiada de 20 ossos são reconhecidas por aliases. Nomes desconhecidos ficam sem correspondência até que o usuário os mapeie manualmente.
- Osso mapeado duplicadamente é reportado e não gera trilhas repetidas.
- Animações incompletas são permitidas para facilitar o diagnóstico parcial, mas as articulações faltantes aparecem no relatório. Uma animação parcial **não** equivale a resultado visual adequado.

## Limitações relevantes para Pokémon humanoides/semihumanoides

- Não há reconhecimento anatômico perfeito nem adaptação automática a personagens com quatro braços, caudas/orelhas móveis, asas ou articulações personalizadas.
- Um Pokémon de corpo arredondado e membros curtos pode precisar de pesos, amplitudes e hierarquia personalizados. Movimentos genéricos podem parecer artificiais mesmo que a matemática esteja correta.
- A biblioteca atual foca em personagens bípedes com componentes de cabeça, coluna, braços e pernas. Quatro pés, caudas, asas e assimetrias exigem presets separados e validação por personagem.
- Os clipes não aplicam translação à raiz; isso garante estabilidade no teste de skin, porém uma caminhada no lugar não é uma animação de locomoção final para jogos.

## Testes

- `node prototypes/studio/test/diagnostic-animations.test.mjs`
- `node prototypes/studio/test/diagnostic-animations.browser.mjs`
- `node prototypes/studio/build.mjs`
- Testes anteriores: `rigging.test.mjs`, `rigging.browser.mjs`, `ops.test.mjs`, `verify.mjs`.

O pipeline GitHub Actions `arenamon-studio-diagnostics.yml` produz o HTML offline em `prototypes/studio/dist/arenamon-animation-studio.html` com um artefato para download.

**Critério de homologação visual:** testar pelo menos um personagem humanoide e um semihumanoide real no navegador, com casos de flexão de braços e joelhos, sem quebra de skin e com GLB reimportável.
