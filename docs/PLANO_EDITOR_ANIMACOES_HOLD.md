# Plano: editor de animações com «segurar quadro» e escopo por personagem

Estado (01/11/2026, v1.49.22): **F1, F3 e F4 implementadas; F2 só com aviso** (veja «Entregue» abaixo). F5 (hang time mecânico) não será feita: o responsável escolheu «só visual». Pedido do responsável (01/11/2026): escolher por botão qual quadro fica em laço (estilo Mugen), por exemplo o quadro 14 do pulo em laço por 2 s antes de ir direto para a descida, e fazer os controles da aba de animações funcionarem de forma previsível e **por personagem**, não em todos ao mesmo tempo.

## O que o código faz hoje (lido em `prototypes/combat-lab/src`, não executado)

- O perfil de animação fica no `Character` (`animProfile`, `speeds`, `playback`) e é gravado em `localStorage` pela chave `STORE + source.name` (`view/characters.js:347`). **Dois lutadores com o mesmo modelo, ou modelos sem nome (`sem-nome`), dividem o mesmo perfil.** É a causa mais provável de «aplica em todos». O botão «Copiar do outro» já existe (`ui/animation-editor.js:534`).
- Opções estáticas (`Character.options`: fade, velocidade global, trava de raiz) valem para todos os personagens.
- O editor tem 60 campos; só 2 estão como `applied:false`. Mesmo assim muitos «não funcionam» porque **dependem do estado**: estados com duração da simulação (`TIMED`: `jump`, `vault`, tackle, esquivas, recuos…) ignoram o laço e o agendador (`characters.js:848`); as **fases do pulo** (`jump_start/rise/apex/fall`) usam o relógio livre, mas ficam **fora da conclusão visual** (`view/visual-epilogue.js:110`) e a fase só muda quando a física muda.
- Fase do pulo = velocidade vertical: início 0,12 s, subida até `vy ≤ 1,8 m/s`, pico entre ±1,8 m/s, queda abaixo disso (`sim/animation-profile.js:18`). Com `jumpHeight` 2,0 m isso dá subida ≈ 0,26 s, pico ≈ 0,19 s, queda ≈ 0,34 s. Um quadro 14 segurado por 2 s **não cabe no pico**: a física já terá passado para a queda.
- Já existem peças reaproveitáveis: laço central em segundos (`loopStartTime/loopEndTime`), pausas, intro/ciclo/saída com velocidades próprias (`view/clip-scheduler.js`), `freezeAt` (congelar por %) e `jumpApexFreeze` (congelamento do pico, no máximo 0,3 s).

## Plano (cada fase entrega algo visível e testável sozinho)

### F1. Diagnóstico (sem mudar comportamento)
1. Teste pequeno `animation-field-audit`: para cada campo `applied:true`, aplicar um valor no perfil e medir o efeito no tempo do clipe pelo agendador puro (sem navegador). Saída: tabela **campo × estado → funciona / ignorado (motivo)**, em `docs/` e linkada no portal.
2. Reproduzir «aplica em todos» com Wookada × Eggo e com dois lutadores do mesmo modelo; registrar qual chave de armazenamento é lida/escrita.
3. Decidir com o responsável quais estados precisam de qual campo (matriz estado × controle).

### F2. Escopo por personagem
- Chave de perfil por **slot + modelo** (Azul/Vermelho), com migração do perfil antigo (`STORE + nome`) sem perdê-lo.
- Seletor visível «Gravar em: este lutador / este modelo / todos», padrão **este lutador**, e rótulo fixo «Editando: Azul (eggo.glb)».
- Opções hoje estáticas passam a ter valor por lutador quando fizer sentido (fade, velocidade), com «herdar do global».

### F3. Quadros numerados e botão «Laço neste quadro»
- A linha do tempo do editor mostra **números de quadro** (fps do clipe) e o quadro atual.
- Controle novo, com nome pela função: **«Segurar quadro»**: quadro N (slider + número + clique na timeline), **duração (s)**, e **modo**:
  1. *Visual por tempo*: segura/faz laço do quadro N (ou do trecho A–B) por T segundos, depois segue para a próxima ação;
  2. *Até a fase mudar*: mantém o laço até o jogo trocar de estado (o pico do pulo dura o que a física mandar);
  3. *Hang time mecânico* (só na F5).
- Implementação: converter quadro → segundo e alimentar o `clip-scheduler` (segmento «hold»), sem criar um segundo sistema de tempo.

### F4. Segurar o quadro nas fases do pulo
- Incluir `jump_apex` (e, se pedido, outras fases) na **conclusão visual**: o clipe do pico continua tocando/segurando o quadro N pelo tempo configurado **mesmo depois que a física entrou na queda**, e então vai direto para `jump_fall` (blend curto `jumpPhaseFade`).
- Caso de teste do responsável: quadro 14 do pulo em laço por 2 s, depois transição direta para a descida. Critério de aceitação: o tempo de `a.time` fica no quadro 14 por 2,0 s ±1 quadro e a próxima camada é `jump_fall`, medido pelo agendador e pela telemetria de transição.
- Efeito colateral a decidir: durante o hold o corpo cai por física (a pose fica no ar), o que é um «segurar visual».

### F5. (Opcional, mecânica) Hang time real
- Se o responsável quiser que o personagem **fique no ar** 2 s, é mudança de física (gravidade reduzida na faixa do pico, `map.jumpGravity*`/faixa do pico) e exige pedido explícito (Fluxo C do `MANUAL_BLENDER_AGENTES.md`): diff limitado, teste só da área e link no portal. Não será feita sem essa decisão.

## Decisões que preciso do responsável
1. Os 2 s são **só visual** (a pose segura enquanto a física cai) ou o personagem deve **ficar no ar** (F5)?
2. Escopo padrão ao editar: este lutador, este modelo ou todos?
3. Quais estados precisam do «segurar quadro» além do pico do pulo?

## O que não foi verificado
- Nada foi executado no jogo; as causas acima vêm da leitura do código. «Aplica em todos» é hipótese até a F1.
- O Eggo ainda não tem as fases novas (`Jump * 2`) no GLB; o teste do quadro 14 depende disso.

## Entregue (v1.49.22)

- **F1:** `node scripts/gen-matriz-campos-animacao.mjs` gera `docs/MATRIZ_CAMPOS_ANIMACAO.md` (ação × relógio × controles que valem). Resultado: estados `TIMED` (jump inteiro, tackle, esquivas, recuos…) ignoram Loop avançado e Segurar quadro.
- **F2 (parcial):** o editor avisa quem está sendo editado e quando os dois lutadores usam o mesmo modelo (o perfil é por modelo). **Não separei o perfil por lutador**: a causa de «aplica em todos» ainda é hipótese; falta você confirmar no jogo com dois modelos diferentes.
- **F3:** grupo **Segurar quadro** na aba «Visão geral» do editor: *Quadro a segurar* (nº do quadro, 1 = primeiro), *Tempo segurado* (0/vazio = enquanto o estado durar) e o botão **«Segurar o quadro da prévia»** (preenche com o quadro que a prévia mostra, com quadros/s do clipe). Implementado no agendador (`view/clip-scheduler.js`, `view/frame-hold.js`): corre até o quadro, segura e segue de onde parou, em qualquer combinação com recorte, laço, pausas e velocidades.
- **F4:** nas fases do pulo, um *Tempo segurado* finito atrasa a troca visual para a fase seguinte (ex.: pico → queda) mesmo com a física já descendo. **Limite:** o pouso, reações e ações novas interrompem na hora. O pulo do jogo dura cerca de 0,9 s no ar, então um hold de 2 s no pico é cortado pelo pouso; para ficar 2 s no ar seria preciso mexer na física (F5).
- Teste: `prototypes/combat-lab/test/animation-hold-frame.test.mjs`.
