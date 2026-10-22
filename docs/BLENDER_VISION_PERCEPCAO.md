# Blender Vision — percepção ativa, movimento e diagnóstico

**O que é.** Uma camada nova sobre o Blender Vision e o Animation Witness para que a IA **saiba o que viu e o que não viu** numa animação 3D antes de opinar: pede novas vistas quando uma região está escondida ou cortada, mede o movimento com sensibilidade declarada, e só aceita um diagnóstico ancorado em folhas realmente abertas. **Não altera animação, rig, `.blend`, jogo, Combat Lab nem Animation Studio.**

**Caso de validação:** o **Mushroom (Mosh)**, clipe `attack 1` de `chars/mosh/Cogumelo.glb` (54 frames a 30 fps), no lugar do Tackle do Vigoroth. *(O Mushroom ≡ Mosh segue a convenção do código: `passives.js` trata `mosh`/`mush`/`cogumelo` como o mesmo personagem.)*

**Abrir:** [`relatorio.html`](../scripts/blender-vision/evidence/perception_mosh/relatorio.html) (também em `ABRIR_ARENAMON.html` → Ferramentas, `HTMLS_ARENAMON.html` e `TESTES_ARENAMON.html` → Blender Vision). Protocolo do agente: [`PROTOCOLO_AGENTE_VISUAL.md`](../scripts/blender-vision/PROTOCOLO_AGENTE_VISUAL.md).

## A. Auditoria inicial (o que já existia e o que faltava)

| Já existia (e foi reaproveitado) | Onde |
|---|---|
| capturas multivista, modos solid/bones/onion/contact/sil/ids, `smart:N`, `pair`, `dense`, regras `check` | `vision.py`, `inside_blender.py`, `dense_inside.py`, `check_inside.py` |
| câmera adaptativa **só da mão**, independência de vistas ≥ 35°, filtro de chão | `witness_camera.AdaptiveHandCamera`, `witness_utility.are_views_independent` |
| claims com estados COMPROVADO/REFUTADO/MEDIDO_SEM_CRITERIO/NAO_COMPROVAVEL, fail-closed | `witness_core.evaluate`, `synthesize_final_status` |
| validação de revisão de agente (imagens citadas existem, vistas independentes) | `witness_review.validate_review` |
| comparação com "referência" por janelas de timing e pico de energia | `witness_review.compare_art_reference` (não é comparação visual) |

**Lacunas confirmadas no checkout real:** (1) o enquadramento padrão **não verifica corte de quadro**: neste clipe cortou o personagem em 34 de 36 vistas; (2) a câmera adaptativa cobre só mãos, nada para tronco, cabeça, pernas ou corpo todo; (3) `validate_review` confia nas câmeras e imagens que o próprio agente informa (não sabe se a região aparecia); (4) não havia pedido automático de novas vistas diante de oclusão; (5) nenhum teste distinguia **atravessar × ocultar** nem **apoiado × próximo**; (6) as "referências" não eram aprovadas por pessoa nem tinham escopo; (7) nada obrigava a diagnóstico a descrever o que foi observado.

## B. Implementação (arquivos e funções)

| Módulo (`scripts/blender-vision/`) | Capacidade nova |
|---|---|
| `perception_geom.py` | `body_frame`, `candidate_views` (8 azimutes × 2 elevações + topo, no referencial do próprio personagem), `independent_of`, `fit_span`, `assess` (suficiência **por frame**), `gain_of`/`rank_candidates`, `investigate` (laço Observar → pedir vista → reavaliar com 3 freios) |
| `perception_inside.py` (Blender) | `visibility_for` (raio na malha deformada, **chão como oclusor**), passes reais `raycast_passes` (profundidade, normais, ids), renders com a região em laranja, `op_pose` (trilha), `op_contacts` |
| `perception_motion.py` | `body_sequence` (ordem com sensibilidade ao alfa), `anticipation`, `snap_events`, `arc_continuity`, `phase_hypotheses` (**nunca escolhe contato**), `foot_ground`, `ground_penetration`, `deformation_report` (declarada × inesperada), `support_vs_mass` (proxy) |
| `perception_principles.py` | os 12 princípios como **perguntas visuais** (sem nota) |
| `perception_diagnosis.py` | protocolo A–G + `validate` (código de leitura, 2 vistas independentes, região observada, aprovação artística só com referência) |
| `perception_refs.py` | referências aprovadas (aprovador + escopo obrigatórios); `compare` devolve semelhança medida e `NAO_AVALIADA` |
| `perception.py` | CLI: `investigate`, `motion`, `contacts`, `diagnose-template`, `validate-diagnosis`, `reference` |
| `prep_source.py` | cópia derivada e descartável de GLB/FBX → `.blend` (origem nunca gravada; 24→30 fps verificado) |
| `perception_report.py` | gera o `relatorio.html` da pasta de evidências |
| `tests/` | `test_perception.py` (42), `test_perception_failures.py` (7), `perception_synth.py` + `run_perception_bench.py` (dev × eval) |

Mudanças em arquivos existentes: só **acréscimos** em `README.md` e `WITNESS_ARCHITECTURE.md`, e links nos três HTMLs de portal. `witness*.py`, `vision.py`, contratos e proteções de sobrescrita **não foram tocados**.

## C. Percepção visual — o que foi realmente aberto

Todas as folhas foram abertas com a ferramenta `Read` (cada uma tem o código de leitura estampado). Folhas lidas no caso final: corpo todo (frente, lado D, lado E), tronco/quadril (lado D, lado E), mão D (lado D, q3 trás D). Novas vistas foram obtidas **sozinhas**: ex. `mao_D` pediu `frente`+`lado_D`, depois `trás`+`q3_trás_D`, depois `q3_frente_D`; `cabeça` pediu `topo`+`q3_frente_D_e35`. Passes de profundidade/normais/ids foram gerados e a folha de ids da mão D foi aberta.

## D. Compreensão da animação

Resumo do que as imagens + medidas sustentam (detalhe A–G no relatório): começa no ar inclinado, cai na vertical, pousa dobrando o corpo todo (chapéu gira para cima/trás), fica agachado apoiado nas mãos; **sem antecipação dentro do clipe**; **mãos 21–26 cm abaixo do chão de g11 a g22** (e pernas 8–10 cm) — por isso a mão some nas imagens; mão é um bloco sem dedos; de frente o chapéu esconde a pose agachada. **Inconclusivo:** interseção mão/braço × chapéu (g1–g10, hipótese; mão D não observada em g6, g7, g9, g11, g21), intenção do clipe, transmissão de força a um alvo, perna visualmente.

## E. Avaliação artística

- **Fato geométrico:** profundidade no chão, classe de apoio dos pés, ausência de recuo, resultado dos testes de contato.
- **Observação visual** (≥ 2 vistas independentes por frame): pose no ar em g1–g2, queda vertical em g6–g7, dobra do tronco em g9–g11, mão em bloco, chapéu escondendo o corpo de frente.
- **Hipótese coreográfica:** "amortecer o pouso, não golpear" (sem briefing).
- **Preferência artística:** **nenhuma**. Não existe referência aprovada; o validador recusa qualquer aprovação sem ela. Appeal não foi julgado.

## F. Evidências

`scripts/blender-vision/evidence/perception_mosh/`: `relatorio.html`, `resumo.json`, `antes_depois.json`, `investigation/` (índice com códigos, 7 folhas lidas + 2 de passes), `motion/`, `contacts/`, `diagnostico_mosh_attack1.json`, `validacao_diagnostico.json`, `validador_adversarial.json`, `bench_dev.json`, `bench_eval.json`, `verificacao_tempo_fbx_x_glb.json`, `antes/`. Especificação do witness anterior para o Mosh: `specs/mosh_attack1.witness.json`.

## G. Antes × depois

| | Antes | Depois |
|---|---|---|
| personagem cortado pela borda do quadro | 34 de 36 vistas | 0 de 48 |
| onde está a mão, o que cobre o corpo | não sabia | por região e frame; oclusores medidos |
| região escondida | sem aviso | `NAO_OBSERVAVEL`/`PARCIAL` com os frames |
| mão enterrada no chão | invisível (a métrica antes ignorava o chão) | 0,21–0,26 m medidos; chão é oclusor |
| aprovação artística sem referência | possível | recusada pelo validador |
| diagnóstico | texto livre | A–G, folhas com código, medidas citadas por caminho |

**Casos controlados** (sintéticos, humanoide de caixas): desenvolvimento 24/24 e avaliação 24/24 (positivos, negativos e inconclusivos; falsos positivos 0, falsos negativos 0). O desenvolvimento precisou de ajustes (erro do gerador, paridade de raios → cercamento por raios, regra de atravessamento); a avaliação foi congelada antes de rodar e nada foi ajustado com ela; o caso do chão nasceu **depois** de ver o Mosh e não é independente.

## H. Git

Branch `feat/blender-vision-perception` (worktree interno `.worktrees/perception`, a partir de `origin/main`). O hash do commit entregue está na resposta final desta tarefa.

## I. Limitações (o que ainda impede a "compreensão artística desejada")

- Isto **não** é inteligência visual comprovadamente superior: melhora honestidade, cobertura e rastreabilidade da evidência.
- Visibilidade é geométrica (raio), em Workbench headless, não o viewport/câmera do jogo; o código de leitura prova abertura, não entendimento; o validador não sabe se a descrição está correta.
- Sem referência aprovada pelo diretor não há julgamento de peso, impacto ou "bom"; sem alvo autorizado não há frame de contato.
- Cercamento por raios e normal assinada falham em malha vizinha aberta; o chapéu do cogumelo é ponderado ao osso `Head` (rótulo `head` = chapéu inteiro); o centro de massa é o centroide dos vértices (proxy).
- O plano do chão é o dos pés da `idle`; o chão do jogo (altura visual/apoio) pode diferir.
- Os testes sintéticos não cobrem malhas reais complexas nem a leitura de imagens por um modelo.
- `tests/test_motion_lens_background.py` (existente) só roda dentro do Blender; não foi alterado.
