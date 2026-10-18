# blender-vision

Ponte de visão Blender → Claude. O Blender roda em segundo plano (headless), grava PNGs, e o Claude **abre cada PNG com a ferramenta `Read`**, que entrega a imagem ao modelo. Não depende do Blender MCP estar conectado.

> **Não é o viewport real.** É uma renderização Workbench com câmera própria (ortográfica nas vistas retas, perspectiva 50 mm nas 3/4), luz de estúdio e chão/grade da ferramenta. O `manifest.json` repete esse aviso.

## Garantias

- **Nunca salva o `.blend`.** O SHA-256 é conferido antes/depois; se mudar, a execução termina com **erro crítico (código 3)** e preserva imagens, logs e `INTEGRITY_FAILURE.json`.
- **Saída atômica:** renderiza em `PASTA.tmp-PID` e só renomeia para `PASTA` após sucesso. Falhas ficam em `PASTA.FAILED-<hora>` com `_blender.log`. Pasta existente exige `--overwrite` (a antiga vira `PASTA.prev-<hora>`).
- **Timeouts** (variáveis `VISION_TIMEOUT_BLENDER` 900 s, `VISION_TIMEOUT_MAGICK` 180 s, `VISION_TIMEOUT_FFMPEG` 300 s), com processo encerrado e mensagem clara.
- Vista, modo, action ou armature inválidos falham com a lista de valores válidos; arquivo com mais de um armature exige `--armature`.

## Comandos

```bash
python scripts/blender-vision/vision.py doctor
python scripts/blender-vision/vision.py shot --blend A.blend --action X --frames smart:12 --offset 1 --views side_nX,front --modes solid,onion,contact,sil --out DIR
python scripts/blender-vision/vision.py pair --blend A.blend --action-a X --action-b Y --frames 3,9,11 --offset 1 --views front,side_nX,top --out DIR
python scripts/blender-vision/vision.py compare DIR_ANTES DIR_DEPOIS --out DIR
python scripts/blender-vision/vision.py video DIR --view side_nX --mode solid --out previa.mp4
```

| Opção (`shot`) | Significado |
|---|---|
| `--frames` | Frames **autorais**: `14`, `1,5,9`, `0-40`, `0-40:4` ou **`smart:N`** (início, fim, picos de velocidade, pausas, inversões, contatos dos pés, maior mudança; a razão aparece na legenda). |
| `--offset` | `frame_timeline = frame_autoral + offset`. Os PNGs trazem `g` (autoral) e `t` (timeline). |
| `--views` | `front, back, side_pX, side_nX, top, q3, q3_left, q3_back`. O personagem olha para −Y: `side_nX` mostra o lado **direito** dele. |
| `--modes` | `solid`; `bones` (malha translúcida + ossos opacos; amarelo centro, laranja esq., ciano dir., magenta cauda/crista); `bones_only`; **`onion`** (anterior azul, próximo vermelho, atual em cor; `--onion-step N`); **`contact`** (marcador no chão por pé: verde parado, amarelo deslizando, vermelho penetrando, azul no ar, pontos cinza = trilha); **`sil`** (silhueta). Com `sil` sai também `permanence_<vista>.png` (branco = ocupado quase sempre = congelado). |
| `--align` | `hips` (padrão, câmera segue o quadril em x, y e z: cancela também o balanço vertical), `root` (só xy; o balanço vertical aparece) ou `none` (câmera fixa). Escala e lente são fixas para todos os frames. |
| `--zoom OSSO --zoom-radius 0.6,0.25,0.12` | Aproximação progressiva centrada no meio do osso; `--bone-cam` acrescenta câmeras alinhadas aos eixos do osso (`bone_px/nx/pz/nz`, Y do osso para cima; sem o chão). |

`pair` renderiza duas actions do **mesmo** arquivo com a **mesma câmera** (lente, escala e centro idênticos) em dois modos: `global` e `hips` (cada action centrada no próprio quadril, separando pose de deslocamento). Para cada frame/vista: IoU de silhueta, áreas só-A/só-B, RMSE normalizado, imagem de diferença (vermelho só A, azul só B, cinza comum). No manifesto: diferença por junta em metros (global e alinhada pelo quadril, com frame do máximo) e distância das juntas em pixels nas vistas.

`compare` (capturas antigas) valida os manifestos (tamanho, offset, motor, alinhamento, vistas, frames, lente, escala e centro da câmera) e recusa comparar capturas incompatíveis; prefira `pair`. O RMSE vem normalizado (0–1) do ImageMagick, sem depender de Q8/Q16.

Cada captura gera `manifest.json`, sheets com legenda e **`report.html`** (miniaturas clicáveis em resolução integral, filtros por vista/modo/frame, hashes, métricas).

## Briefing verificável, histórico, ciclo e travar pés (v3)

```bash
python scripts/blender-vision/vision.py check  --blend A.blend --action X --offset 1 --brief scripts/blender-vision/briefs/vigoroth_tackle.brief.json --out DIR
python scripts/blender-vision/vision.py snap   --blend A.blend --action X --offset 1 --brief BRIEF.json --label minha_versao --history PASTA   # grava e compara com o snapshot anterior
python scripts/blender-vision/vision.py history PASTA
python scripts/blender-vision/vision.py cycle  --blend A.blend --action X --prev-action Y --offset 1 --brief BRIEF.json --label L --out DIR   # regras + snapshot + imagens smart + comparação
python scripts/blender-vision/vision.py footlock --blend A.blend --action X --save-as COPIA.blend [--ranges "Left:9-20;Right:0-8"]
python scripts/blender-vision/vision.py shot ... --modes ids ...            # cores chapadas por região
python scripts/blender-vision/vision.py shot ... --zoom RightHand --zoom-preset hand   # raios 0.6/0.25/0.12, câmeras do osso, 2x nos pequenos
```

- **`check`**: avalia as regras de um briefing em JSON (`frame_count`, `limb_extended`, `foot_planted`, `foot_airborne`, `joint_rel`, `joint_height`, `scale_window` com `ignore_frames`, `not_frozen`, `pose_matches_action`, `loop_seam`, `no_interpenetration` (malha real, por região de pesos), `hand_digits`, `visual_only`). Cada regra sai PASS, FAIL (com os frames), HIPOTESE (indício sem prova, ex.: interpenetração) ou INCONCLUSIVO; o cabeçalho soma os quatro e mostra o total de regras. `scale_window` reprova se QUALQUER frame da janela ficar sem efeito. Também reporta o que o rig consegue representar (por exemplo, 2 dedos por mão). **Os valores numéricos do briefing de exemplo são propostas, não decisões do diretor.**
- **`snap`/`history`**: cada snapshot guarda regras, métricas e posições alinhadas ao quadril; o diff mostra regras que mudaram de estado, picos de velocidade e juntas que mais mudaram de pose.
- **`cycle`**: um comando, uma lista curta de imagens para ler com `Read` (`OVERVIEW.png`, contato, permanência, comparação).
- **`footlock`**: cria uma action `<nome>_footlock` (IK de 2 ossos nas pernas, com rampa de 3 frames) e salva **somente** num `.blend` novo (`--save-as`); o de origem nunca é gravado. Detecta trechos de apoio (baixo e lento) ou usa `--ranges`. Não serve para animações "in place" (esteira), onde o pé desliza por definição.
- **`ids`**: vermelho = direito (mão clara, braço escuro), azul = esquerdo, verde/ciano = pernas e pés, amarelo = cabeça, magenta = cauda/crista, cinza = tronco.

## Ver

Abrir `sheet_*.png`, `multiview_*.png` ou cada PNG com `Read`. Sheets muito largos são reduzidos pelo leitor: prefira `--size 260` e poucas colunas.

## Limites

- Não é o viewport real; o vídeo MP4 é para o diretor (o Claude lê frames, não assiste vídeo).
- `pair` exige as duas actions no mesmo `.blend`.
- Os marcadores de contato ficam ao lado do pé (não recolorem o pé); heurística: baixo = tornozelo a menos de 5 cm do seu mínimo, deslizando ≥ 1,2 cm/frame.
- Requer Blender 5.2 (`BLENDER_EXE` para outro caminho), ImageMagick e, para vídeo, ffmpeg. `doctor` confere tudo.

## Análise temporal densa, fase dos pés e casos rotulados (v4)

```bash
python scripts/blender-vision/vision.py dense --blend A.blend --action X --offset 1 --out DIR [--ref-action Y | --ref-profile P.json] [--criteria C.json] [--save-profile P.json]
python scripts/blender-vision/vision.py check ... --mode oneshot --baseline-action idle      # opções de CLI: o briefing NÃO é alterado
python scripts/blender-vision/tests/run_cases.py --blend A.blend --work PASTA_TEMP            # 6 casos rotulados à mão
```

- **`dense`** (somente leitura): todos os frames consecutivos → velocidade, aceleração, espaçamento por junta, paradas classificadas por interpolação (`hold_por_interpolacao_constante`, `hold_chaveado`, `parado_em_clip_bakeado`, `possivel_congelamento`), fase dos pés, perfil de ritmo (t10/t50/t90, pico, pico/média, fração parada), `dense_graph.png` e `dense_report.json`.
- **Fase dos pés** (`vision_common.foot_phase`): altura relativa ao próprio mínimo e à perna, modo `deslocamento_real` (quadril com deslocamento líquido) ou `in_place` (esteira: pé apoiado = velocidade quase constante). Passagem rasante < 4 frames conta como no ar; trechos "deslizando" são tipados (`desaceleracao_ate_o_apoio`, `arrasto_de_velocidade_quase_constante`, `indefinido`). Continua heurística.
- **Referência e critérios**: `--ref-action`/`--ref-profile` comparam curvas de percurso acumulado normalizadas no tempo; `--criteria` avalia faixas **fornecidas pelo diretor** (`criteria/template.json` está todo `null`). A ferramenta não define "pesado/rápido/agressivo" nem sabe se a referência é boa.
- **Interpenetração** agora devolve `HIPOTESE` (nunca FAIL): é distância à malha vizinha, não colisão provada. `not_frozen` em interpolação constante vira INCONCLUSIVO.
- **Casos rotulados** (`tests/`): idle, Walk fwd, skate, holds em constante, braço dentro do corpo, braço afastado. Rótulos escritos à mão em `cases.json`; o runner confere a ferramenta contra eles em cópia temporária.

### Correções da revisão externa (v5)

`scale_window` parcial agora FAIL; cabeçalho conta HIPOTESE; `dense` tem aceleração vetorial, jerk, velocidade angular, mudança de direção, curvatura, posição relativa ao quadril, contribuição por região e fases candidatas (antecipação/impacto/recuperação, por limiar, não verificadas); duração do perfil = nº real de frames; interpenetração lista só os frames cujo excesso sobre o baseline passa da tolerância; `cycle` aborta se snap/shot/pair falhar; `--align root` ≠ `hips`; "saltos de espaçamento" = variação relativa ao pico da junta (sem razões absurdas). Motion Lens: silhueta binarizada (preto/branco puro). **Não coberto:** coreografia do briefing oficial (linha de ação em arco, precedência do braço, trajetória diagonal, golpe contínuo, palma E, braço E atrás, pulinho g27–g30, retorno gradual) — o briefing de exemplo é rascunho e não tem essas regras; o contrato do Motion Lens guarda só durações de Smear/Stretch, não as janelas g4–g8/g9–g12.

### Calibração pelo corpus (v6)

```bash
python scripts/blender-vision/calibrate_interp.py --blend A.blend --work PASTA_TEMP     # criteria/interp_envelope.json (limite por fração de vértices dentro, leave-one-out incluído)
python scripts/blender-vision/vision.py corpus --blend A.blend --offset 1 --out DIR --actions "Headbutt" "Tackle 1" ...
python scripts/blender-vision/calibrate.py DIR/corpus_report.json --out scripts/blender-vision/criteria/corpus_envelope.json
```

`check` usa `interp_envelope.json` automaticamente (HIPOTESE quando a fração de vértices dentro passa do limite do corpus); `dense` usa `corpus_envelope.json` quando não há `--criteria`. São envelopes empíricos de "típico", não aprovação artística.

### Segurança e honestidade dos resultados (v7)

`cycle --overwrite` só apaga pastas com o marcador `.vision_output`; `footlock --save-as` recusa destinos existentes (`--overwrite-save-as`); relatórios trazem `proveniencia` (hash do código, `.blend`, briefing, critérios); regras trazem `confianca`; interpenetração é sempre HIPOTESE de confiança baixa; `shot --modes ids` grava `visibilidade_por_regiao` (regiões ocultas por câmera: nada pode ser afirmado sobre elas). `tests/run_regression.py` retorna **NAO TESTADO** (exit 3) se qualquer etapa falhar.
