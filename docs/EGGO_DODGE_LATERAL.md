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

## Não verificado

Exportação GLB, Animation Studio e Combat Lab; `perception.py investigate` (códigos de leitura); revisão humana.
