# Eggo · esquiva lateral (Dodge Left 1 / Dodge Right 1)

Estado: **aguardando aprovação do responsável** (30/10/2026). Modo B do [manual](MANUAL_BLENDER_AGENTES.md): Actions novas,
nenhum original sobrescrito.

## Onde abrir

- Arquivo novo: `chars/Eggo/eggo dodge lateral v1.blend` (cópia gravada com `save_as_mainfile(copy=True)` da sessão
  aberta; Actions `Dodge Left 1` e `Dodge Right 1`).
- Folhas multivista: `scripts/blender-vision/evidence/eggo_dodge_lateral/shot_Dodge_Left_1/report.html`.
- Análise temporal: `scripts/blender-vision/evidence/eggo_dodge_lateral/dense_Dodge_Left_1/dense_graph.png`
  (e `dense_Dodge_Right_1/`).

## O que é

- 33 frames, LINEAR, mesmo timing e distância dos dashes aprovados: o Root anda 2,3 m em X de f3 a f17.
- Roteiro: antecipação (f1–3) → estalo da decolagem (f3–4) → voo com pernas encolhidas, ápice 12 cm em f8 → pé líder
  toca em f12, os dois em f13 (agacha 8 cm) → derrapagem até f17 → passa do ponto e assenta (f17–20) → idle (f33).
- `Dodge Right 1` é o espelho exato da esquerda (diferença medida ≤ 0,3 mm nas juntas).
- Início e fim = frame 1 da `Idle 5 Organica`.

## Medido (vision.py dense / shot, origem intacta: SHA-256 igual antes e depois)

| Medida | Valor | Observação |
|---|---|---|
| Pés no ar | f4–f11 (ambos) | |
| Pés deslizando | esquerdo f12–17, direito f13–17; até 0,175 m/frame | Derrapagem prevista no roteiro |
| Possível congelamento | f25–33 (9 frames quase parados) | Sugestão: respiro ou encurtar o final |
| Contato «penetrando» desde o f1 | marcador vermelho em f1, f3, f15–33 | Já existe na pose da idle: a altura do Root dos clipes aprovados deixa a sola ~4 cm abaixo de z = 0 |
| Envelope do corpus | t50, t90, fração parada e duração fora da faixa típica | O envelope mede o quão típico é, não se é bom |

Limite da ferramenta: o gráfico do `dense` escreve «t = g + 1» e «30 FPS» fixos no texto, mesmo com `--offset 0` e cena
a 24 fps; os dados do relatório usam o offset 0 correto.

## v2 (Dodge Left 2 / Dodge Right 2) · giro do frame 6 desde o início

Pedido do responsável: seguir o frame 6 que ele editou na `Dodge Left 1` (corpo girado −41° no Root, coluna −33°, pernas
recolhidas) desde o início, voltando suave à rotação normal no fim. A `Dodge Left 1` com a edição dele ficou intacta.

- Arquivo novo: `chars/Eggo/eggo dodge lateral v2.blend` (Actions `Dodge Left 2` e `Dodge Right 2`, espelho).
- Giro do Root: 0 → −18° (f3) → −34° (f4) → −41° (f6–f17) → volta suave a 0° entre f17 e f33. Coluna: até −33° (f6).
- Pernas no voo: pés ~20 cm à frente e ~25 cm acima do chão, pé líder embaixo do corpo (medido no f6 dele).
- Joelhos dobram para a frente do corpo girado (no f6, a até 4 cm dos joelhos da edição).
- Evidências: `scripts/blender-vision/evidence/eggo_dodge_lateral_v2/` — `shot_Dodge_Left_2/report.html` (33 frames,
  frente/topo/3-4), `pair_v1edit_vs_v2/` (f6: IoU 0,89 com a edição), `dense_Dodge_Left_2/`, `motion_lens/`.
- Observado: na volta (f20–33) os pés giram no lugar junto com o corpo (pivô, ~16 cm de arrasto em 13 frames);
  o pé de trás arrasta no f4 (decolagem). Alertas ALTO do Motion Lens só no estalo (f4–6), no pouso (f11–12) e na
  derrapagem (f13–14).
- Primeira tentativa do `pair` falhou com o Blender em segundo plano sem memória; repetida sozinha, passou.

## v3 (correção da v2)

A v2 só tinha chaves de Root nos frames do deslocamento; a volta do giro saía como uma reta de f17 a f33 (−32,6° no f20
em vez de −36°). A v3 chaveia o Root também nos frames-pose: −40° (f17), −36° (f20), −24° (f24), −9° (f28), 0° (f33).
Refeita depois que o Blender travou e reabriu do autosave.

- Arquivo: `chars/Eggo/eggo dodge lateral v3.blend` (`Dodge Left 2`, `Dodge Right 2` corrigidas; a v2 fica como histórico).
- Folhas: `scripts/blender-vision/evidence/eggo_dodge_lateral_v3/shot_Dodge_Left_2/report.html` (33 frames, frente/topo).

## Final do responsável (22 frames) e espelho

O responsável retrabalhou a `Dodge Left 2` em `chars/Eggo/eggo dodge lateral final.blend` (22 frames, 13 chaves LINEAR).
A pedido dele, a `Dodge Right 2` foi espelhada dessa versão (mesmas chaves, erro de espelho 0,0 mm) e as duas Actions
passaram a terminar no f22. Como o Blender reiniciou e perdeu a primeira tentativa, o resultado foi gravado numa cópia:
`chars/Eggo/eggo dodge lateral final espelhado.blend` (o arquivo `final` dele não foi sobrescrito; hash igual).

- Folhas da direita: `scripts/blender-vision/evidence/eggo_dodge_lateral_final/shot_Dodge_Right_2/report.html`.
- Motion Lens: malha abaixo do chão no f3 (−9,9 cm) e no f14 (−9,0 cm), vindo das poses editadas (pé cravando).

## Não verificado

Exportação GLB, Animation Studio e Combat Lab; `perception.py investigate` (códigos de leitura); revisão humana.
