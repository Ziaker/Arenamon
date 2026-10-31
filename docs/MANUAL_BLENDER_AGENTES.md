# Manual Blender para agentes de IA — Arenamon (V2.0)

> **Documento operacional · Arenamon · V2.0 · 30/10/2026**
> Versão de referência para Claude, Codex, Antigravity e outros agentes. A versão para leitura e compartilhamento é o
> DOCX [ARENAMON_Manual_Blender_Para_Agentes_IA_V2.docx](ARENAMON_Manual_Blender_Para_Agentes_IA_V2.docx), gerado deste
> arquivo por `python scripts/docs/manual_blender_docx.py`. **Os dois formatos devem ser mantidos sincronizados: edite este
> Markdown e gere o DOCX de novo.**
>
> - **Substitui:** a V1.0 ([original preservado](ARENAMON_Manual_Blender_Para_Agentes_IA_V1_original.docx)).
>   Os motivos da revisão estão na [auditoria](AUDITORIA_MANUAL_BLENDER_2026-10-30.md).
> - **Base verificada:** commit `0f846815` (v1.49.14), igual a `origin/main` em 30/10/2026, e o Blender **5.2.2 LTS** do
>   responsável, consultado só para leitura pelo Blender MCP.
> - **Escopo:** apenas documentação. Este manual não instala, não ativa e não altera add-ons, `.blend`, GLB, código do jogo
>   nem preferências do Blender.

**Princípio:** antes de criar qualquer coisa, use o que o projeto já tem. Nunca altere um clipe, esqueleto ou arquivo
original. Toda mudança gera uma **versão nova**, medida e comparada, com registro do que foi feito.

---

## 1. Os três modos de trabalho (escolha um antes de começar)

| Modo | O que pode | O que NÃO pode | Base |
|---|---|---|---|
| **A · Auditoria / análise** | Ler `.blend`, GLB e FBX; renderizar e medir em cópia descartável; escrever relatórios | Gravar qualquer `.blend` ou Action, mudar keyframes, salvar a cena aberta no Blender | [`PROTOCOLO_AGENTE_VISUAL.md`](../scripts/blender-vision/PROTOCOLO_AGENTE_VISUAL.md): «correção sugerida, **nunca aplicada**» |
| **B · Edição autorizada de animação** | Criar **Actions novas** e **arquivos `.blend` novos** a partir das originais; exportar um GLB de teste | Sobrescrever a Action, o `.blend` ou o GLB de origem; mexer em malha, pesos, hierarquia ou rest pose sem pedido específico | `apply_fix.py`, `tackle_attempt.py`, `vision.py footlock` (§5) |
| **C · Mudança na mecânica do jogo** | Só com pedido explícito: janelas de combate, perfis e regras no Combat Lab | Ajustar a mecânica para «combinar» com a animação, ou o contrário, sem decisão do responsável | §6 e AGENTS.md |

O modo vem do pedido. Se o pedido diz «analisar», «auditar» ou «avaliar», o modo é **A**, e a correção vai no relatório
como sugestão. Passar de A para B, ou de B para C, exige autorização nova e explícita.

## 2. Regras obrigatórias

1. **Ler antes de agir:** `AGENTS.md`, este manual, o README da ferramenta que vai usar e o código atual da área afetada.
   Nunca trabalhe de memória nem a partir de relatórios antigos.
2. **Identificar o ambiente:** versão do Blender (`bpy.app.version_string`), arquivo aberto, se a cena tem alterações não
   salvas (`bpy.data.is_dirty`), armature, Action e slot. **Não assuma** nomes de operadores ou caminhos de menu.
3. **Origem somente leitura:** confira o SHA-256 antes e depois (as ferramentas do `blender-vision` já fazem isso). Gravação
   só com `save_as_mainfile(copy=True)` num arquivo **novo** e nunca por cima de um existente.
4. **Separar três coisas:** dado do rig, animação visual e regra de combate (§6).
5. **Não inventar:** ferramenta, comando, MCP, skill, teste ou resultado. Se algo não foi executado, escreva «não
   verificado».
6. **Não duplicar:** antes de escrever um script ou add-on, procure em `scripts/blender-vision/` (§3) e no Animation Studio.
7. **Não instalar nem ativar nada** (add-on, extensão, MCP, pacote Python) e não mudar preferências do Blender sem
   consentimento.
8. **Testes leves:** rode só o teste da área tocada; benchmarks e baterias inteiras, só com pedido explícito (AGENTS.md).
9. **Tudo acessível:** documentos em `docs/`, evidências versionáveis em `prototypes/<sistema>/evidence/` ou
   `scripts/blender-vision/evidence/`, e um link no portal `ABRIR_ARENAMON.html`.

## 3. Inventário: o que o projeto já tem (use primeiro)

### 3.1 `scripts/blender-vision/` (Python fora do Blender que chama o Blender em segundo plano)

| Ferramenta | Para quê | Altera algo? |
|---|---|---|
| `vision.py doctor` | Confere o Blender 5.2 (`BLENDER_EXE`), ImageMagick e ffmpeg | Não |
| `vision.py shot` · `pair` · `compare` · `video` | Capturas multivista (solid, bones, onion, contact, sil, ids), A/B de duas Actions com a mesma câmera, prévia MP4 | Não (SHA-256 conferido; código 3 se o `.blend` mudar) |
| `vision.py check` · `snap` · `history` · `cycle` | Regras de briefing JSON (`foot_planted`, `loop_seam`, `not_frozen`, `visual_only`…), snapshots e diff entre versões | Não |
| `vision.py dense` · `corpus` | Análise temporal densa (velocidade, aceleração, holds, fase dos pés) e envelopes de calibração | Não |
| `vision.py footlock` | Gera a Action `<nome>_footlock` (IK de 2 ossos) **só** num `.blend` novo (`--save-as`) | Só a cópia nova |
| `perception.py motion` · `investigate` · `contacts` · `diagnose-template` · `validate-diagnosis` · `reference` | Percepção ativa: regiões realmente observadas, 2 vistas independentes, diagnóstico A–G validado | Não |
| `witness.py inspect` · `review` · `calibrate-claw` · `art-reference` | Animation Witness: afirmações com evidência ([ADR](../scripts/blender-vision/WITNESS_ARCHITECTURE.md)) | Não |
| `prep_source.py` | Cópia derivada `.blend` de um GLB/FBX (ex.: Cogumelo a 24→30 fps) com hashes | Só a cópia |
| `pose_dump.py` | Descreve cada pose em direções no espaço do corpo (texto/JSON) | Não |
| `pose_lib.py` | Biblioteca **dentro do Blender**: `aim`, `aim_world`, `key`, `set_interp`, `iter_fcurves` (compatível com o 5.x), `assign` (com slot), `duplicate_action`, `ground_foot`, `ik_leg`, `shift_hips`, `set_hips_rel`, `snapshot_effectors`… | Só pose bones da Action em que for usada |
| `apply_fix.py` | Cria **nova versão** de uma Action a partir de um módulo de correção (`DESCRIPTION` + `apply(ctx)`) e grava com `copy=True`; recusa sobrescrever | Só o `.blend` novo |
| `tackle_attempt.py` + `tackle_fixes/f00…f25` | Ciclo de tentativas do Tackle do Vigoroth: duplicar → corrigir → salvar vN+1 → medir → aceitar/rejeitar → histórico imutável | Só versões novas |
| `briefs/`, `criteria/`, `evidence/`, `tests/` | Briefings (valores = **propostas**, não decisões), envelopes, evidências e casos rotulados | — |

Documentação: [README do blender-vision](../scripts/blender-vision/README.md) ·
[Protocolo do agente visual](../scripts/blender-vision/PROTOCOLO_AGENTE_VISUAL.md) ·
[Blender Vision: percepção](BLENDER_VISION_PERCEPCAO.md) · [Auditoria das ferramentas](../scripts/blender-vision/AUDITORIA.md).

### 3.2 Add-ons próprios (dentro do Blender)

| Add-on | No repositório | Instalado no Blender (verificado em 30/10/2026) |
|---|---|---|
| **Motion Lens** | `scripts/blender-vision/addons/motion_lens.py` + `motion_lens_parts/`. Versão 0.3.3, 17 operadores e 40 propriedades. Inclui `motionlens.strike` (candidato de timing) e `motionlens.apply_impact` (cria uma **cópia** transacional da Action) | **0.3.2 modular, 15 operadores expostos; não foi reinstalado nesta auditoria** |
| **Direction Lines** | `scripts/blender-vision/addons/direction_lines.py` 0.1.2; 5 operadores; frame/subframe protegido sob falha | 0.1.1; 5 operadores; não reinstalado |

> [!WARNING]
> **A versão do Motion Lens no repositório não é a instalada.** Antes de citar `strike` ou `apply_impact`, confirme no
> Blender com `'apply_impact' in dir(bpy.ops.motionlens)`. Para atualizar, existe `instalar_motion_lens.py`: sem
> `--instalar` ele só mostra o que faria; com `--instalar` copia e guarda um `.bak`. Instalar e ativar exigem consentimento
> do responsável. O documento [BLENDER_ADDONS_MOTION_LENS.md](BLENDER_ADDONS_MOTION_LENS.md) registra separadamente
> a fonte e a cópia instalada.

Os operadores do Motion Lens instalado (todos de análise): `ghosts`, `trails`, `report`, `graphs`, `contact_sheet`,
`silhouette_sheet`, `skeleton_sheet`, `reference_overlay`, `pose_diff`, `html_report`, `save_profile`, `load_profile`,
`save_baseline`, `check_baseline`, `clear`. Eles criam objetos auxiliares e textos (`ML_*`, `DL_*`), que contam como
alteração da cena aberta. **No modo A, use-os só numa cópia** e não salve.

### 3.3 Blender MCP (`blender_mcp_addon` 1.8, ativo)

- Executa Python **na sessão viva** do Blender, lê a cena e captura o viewport (`execute_blender_code`, `get_scene_info`,
  `look`).
- A sessão viva pode ter **alterações não salvas** do responsável. Em 30/10/2026, por exemplo, estava aberto
  `chars/Eggo/Eggo dash back.blend` com `is_dirty = True`. Pelo MCP: só leitura no modo A; **nunca** chame
  `wm.save_mainfile` nem troque a Action ativa sem pedido.
- O `blender-vision` **não depende** do MCP: ele roda o Blender headless em cópia. Prefira-o para medições reproduzíveis
  e use o MCP para inspecionar o que o responsável está vendo.

### 3.4 Arenamon: Studio e Combat Lab

| Componente | O que faz |
|---|---|
| Animation Studio (`prototypes/studio/`, [README](../prototypes/studio/README.md)) | Importa FBX/GLB; edita clipes, eventos e root motion; compara; exporta GLB final. **Não cria poses.** Rigging inicial guiado e experimental ([RIGGING_FASE1](../prototypes/studio/RIGGING_FASE1.md)) |
| `combat-lab/src/view/characters.js` | Estados, variantes, fades, epílogo visual; `getCombatWindows` e `overlayProfileWindows` (§6) |
| `combat-lab/src/view/rig-layers.js` | Camadas visuais de IK dos pés, olhar e mira |
| `combat-lab/src/view/clip-scheduler.js` | Introdução, ciclo, saída e emenda temporal |
| `combat-lab/src/sim/animation-profile.js` | Campos do Editor de animações (`applied:true` = o jogo usa; `false` = só salvo) |
| `combat-lab/src/sim/animation-combat-windows.js` | Converte eventos do clipe em janelas de combate (contrato) |

## 4. Ambiente: Blender 5.2.2 LTS

- **Executável:** `C:\Program Files\Blender Foundation\Blender 5.2\blender.exe` (padrão do `vision.py`; outro caminho via
  `BLENDER_EXE`). Confirme com `python scripts/blender-vision/vision.py doctor`.
- **Add-ons ativos verificados:** `io_scene_gltf2`, `io_scene_fbx`, `rigify`, `pose_library`, `motion_lens`,
  `direction_lines`, `blender_mcp_addon` (e outros padrão).
- **`--factory-startup`** inicia o Blender sem os add-ons do usuário: Motion Lens e Direction Lines **não** estarão
  disponíveis nesse modo.

### 4.1 API de animação no 5.x: slots, layers e channelbags

Desde o Blender 4.4, as Actions têm **slots**. No 5.x, a API legada saiu: **`Action.fcurves` não existe** (verificado no
5.2.2). As F-Curves ficam em `action.layers[i].strips[j].channelbags[k].fcurves`, e cada channelbag pertence a um slot.
Ao atribuir uma Action, defina também `animation_data.action_slot`.

```python
# Padrão 5.x (o mesmo de pose_lib.iter_fcurves e motion_lens_parts/strikes.py)
def iter_fcurves(action):
    for layer in action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                yield from bag.fcurves
```

Não escreva `action.fcurves`. Se precisar de compatibilidade com versões antigas, use `pose_lib.iter_fcurves`, que tenta
o caminho novo antes do antigo.

## 5. Fluxos de trabalho

### 5.1 Fluxo A: auditoria (somente leitura)

1. **Preparar a fonte:** para um `.blend`, use-o direto (as ferramentas não gravam). Para GLB/FBX, gere uma cópia com
   `prep_source.py` (por exemplo, `--out %TEMP%\arenamon-vision\mosh_source.blend`; a cópia é descartável).
2. **Inventário rápido:** rode o script da §8.1 (pelo MCP na sessão viva ou com `blender -b`).
3. **Medir:** `perception.py motion` e/ou `vision.py dense`. As medidas apontam **onde olhar**; não respondem à pergunta.
4. **Observar:** `perception.py investigate` (2 vistas independentes ≥ 35° por frame) e `vision.py shot` /
   `vision.py cycle`. **Abra cada folha** e cite o código «LEITURA XXXXX».
5. **Contatos:** `perception.py contacts --baseline-action idle`. O resultado é **hipótese** até haver imagem.
6. **Diagnóstico A–G:** `diagnose-template` e depois `validate-diagnosis`.
7. **Relatório:** separe fato geométrico, observação visual, hipótese coreográfica e preferência artística (esta só com
   referência aprovada). A correção vai como **sugestão (F), nunca aplicada**.

**Regras fixas do modo A:** não escolher o frame de contato (sem alvo autorizado ele é `null`; pico de velocidade ≠
impacto); regiões ocultas são `NAO_OBSERVAVEL`, não «corretas»; duas imagens quase iguais não são duas evidências.

### 5.2 Fluxo B: edição autorizada (versão nova, original intacto)

1. **Autorização registrada:** personagem, Action de origem, objetivo, critério visual e destino do arquivo novo.
2. **Baseline:** `vision.py snap --label antes --history PASTA` (ou `check` com briefing) na Action original.
3. **Criar a variante:**
   - **Caminho preferido:** um módulo de correção (`DESCRIPTION` + `apply(ctx)`, como em `tackle_fixes/`), aplicado com
     `blender -b ORIGEM.blend --python scripts/blender-vision/apply_fix.py -- config.json`, onde `config.json` tem
     `src_action`, `new_action`, `fix`, `save_as`, `offset` e `out`.
   - **Apoio de pés:** `vision.py footlock --save-as COPIA.blend` (não serve para animação «in place»).
   - **Retiming do bote:** `motionlens.apply_impact`, **só se** a versão instalada tiver esse operador (§3.2).
   - **Pose por direção:** `pose_lib.aim`, `ik_leg`, `ground_foot` etc., dentro do módulo de correção.
   - **Ferramentas nativas** (§7), quando a decisão for artística e feita na interface, sempre numa Action duplicada com
     nome rastreável (`<acao>_vN`, `<acao>_<motivo>`).
4. **Medir de novo e comparar:** `vision.py pair` (original × nova, mesma câmera), `snap`/`history` e `check`. Aceite só
   o que melhorou sem regressão.
5. **Exportar GLB de teste** (§7.3) com nome novo, reimportar num Blender limpo e conferir.
6. **No jogo:** importar no Animation Studio e testar no Combat Lab, sem tocar nas regras (§6).
7. **Relatório** (§10.2) com caminho do arquivo novo, hashes da origem (antes = depois) e como reverter (basta não usar a
   versão nova).

### 5.3 Fluxo C: mecânica

Só com pedido explícito. Um ajuste visual não autoriza mudar `sim/`, perfis de Move, hitboxes, colisores, stamina ou
janelas. Siga o AGENTS.md: diff limitado, teste só da área tocada e link no portal.

## 6. Animação × mecânica: como as janelas de combate funcionam

A duração **mecânica** de uma ação vem da simulação (definição do Move, `actionDuration`), não do tamanho do clipe. O
clipe é **esticado** sobre essa duração. As janelas (ativa, cancelamento, invulnerabilidade) podem vir de três fontes:

| Fonte | Como é convertida | Efeito de mudar o clipe no Blender |
|---|---|---|
| **Definição do Move** (`phaseMode = 0`, padrão) | Valores da simulação | **Nenhum** na mecânica |
| **Eventos do clipe** (`hitbox_on/off`, `invulnerable_start/end`, `cancel_start/end`, `impact`, `recovery_start`, editados no Studio) | `fromGlbEvents`: tempo do evento × (duração da ação ÷ duração do clipe), ou seja, proporcional | Mudar a duração do clipe **sem mover os eventos** desloca a posição proporcional da janela |
| **Perfil do Editor** (`activeStart/End`, `cancelStart`, `invulnStart/End`, em %) | `overlayProfileWindows`: % × `actionDurationSteps`, isto é, % da **ação**, não do clipe original | Mudar só a duração do clipe **não** muda a janela; retimar as poses dentro do clipe muda **onde o golpe aparece** em relação a uma janela que ficou parada |

As janelas vindas da animação só valem no combate com **«Fonte dos tempos» = Animação aprovada** (`phaseMode = 1`) e
com cada fase autorizada no painel Personagens. Em `phaseMode = 2` («Comparar») o combate não muda. O resultado depende
da configuração e da origem dos marcadores. Num relatório, diga qual fonte estava ativa.

### 6.1 Quais alterações exigem nova validação mecânica (checklist)

| Tipo de alteração no Blender | Afeta a mecânica do jogo? | Exige revalidação no Combat Lab? | O que verificar |
|---|---|---|---|
| **Ajuste de poses e curvas internas** (arcos, easing, silhueta) mantendo duração e eventos intactos | **Não** (a física e os tempos mecânicos permanecem idênticos) | Opcional (apenas inspeção visual) | Verificar se o impacto visual ainda coincide aproximadamente com a janela ativa |
| **Mudar a duração total do clipe** com eventos no GLB | **Sim** (em `phaseMode = 1` com eventos GLB, a proporção evento/duração desloca as janelas) | **Sim (obrigatória)** | Rechecar `getCombatWindows()` no console do Lab e rodar teste de combate |
| **Adicionar, mover ou apagar marcadores de eventos** (`hitbox_on/off`, `invuln_*`, etc.) | **Sim** (altera o contrato canônico `AnimationCombatWindows`) | **Sim (obrigatória)** | Conferir no Studio se os pares início/fim estão na ordem correta e fecham intervalos válidos |
| **Retimar o golpe (adiantar/atrasar o frame do contato)** sob perfil existente | **Indireto** (a janela mecânica fica fixa no perfil, mas o golpe bate «no ar» ou antes da hora) | **Sim (obrigatória)** | Comparar o frame do impacto no visual com o início da janela ativa no Lab |
| **Alterar `rootMotion` ou `lockToGround`** no perfil | **Sim** (muda o deslocamento físico e a ancoragem vertical) | **Sim (obrigatória)** | Verificar colisão com paredes, alcance efetivo do golpe e travamento no piso |

**Campos que ficam só salvos (`applied:false`) em `animation-profile.js`:** `startup`, `priority` (camada), `repeats`,
`exitCondition`, `displacement`, `verticalSpeed`, `minTime`, `autoNext`. Não os apresente como efeito implementado.
Exemplos com efeito (`applied:true`): `armor`, `hitstopMult`, `interruptible`, as janelas acima, `rootMotion` e
`lockToGround`.

**Consequência prática:** depois de retimar um golpe, compare o frame visual de contato com a janela ativa efetiva. Se
não baterem, relate o desencontro e proponha um ajuste (evento, perfil ou animação). Não corrija a mecânica sozinho.

## 7. Técnicas nativas do Blender 5.2 (quando decidir na interface)

Menus e atalhos variam com a versão e o keymap. Na dúvida, use **F3 (Search)**, registre o operador encontrado e não
invente caminhos.

### 7.1 Ferramentas

| Técnica | Onde | Uso correto | Limite para o jogo |
|---|---|---|---|
| Graph Editor | Editor Type › Graph Editor; Key › Interpolation Mode / Handle Type | Spacing, easing, arcos, overshoot | Curva visual ≠ deslocamento físico (root vem da física salvo `rootMotion`) |
| Dope Sheet / Action Editor | Dope Sheet › Action Editor; seletor de Action **e de slot** | Duplicar Action, organizar poses-chave | Confira se a chave caiu na Action/slot pretendido |
| Pose Library | Dope Sheet › Action Editor ou Asset Shelf da 3D Viewport em Pose Mode; Pose › Create Pose Asset | Poses reutilizáveis | Rigs diferentes (Wookada × Mosh × Vigoroth) não são compatíveis automaticamente |
| In-Betweens / Breakdowner | Pose › In-Betweens | Poses intermediárias | — |
| IK / Constraints | Bone Constraints › Add › Inverse Kinematics | Contatos persistentes (Target, Pole, Chain Length) | Constraints **não** exportam: bake visual numa cópia |
| Rigify | Add-on `rigify` (ativo); Add › Armature › metarig | Gerar controles para rig novo | Não substitui pesos nem revisão de deformação |
| NLA | Editor Type › Nonlinear Animation; Push Down / Stash | Composição e revisão de faixas | Faixas combinadas não viram camadas no Three.js: faça bake se o alvo é um clipe só |
| Weight Paint | Mesh › Weight Paint; Vertex Groups | Corrigir dobras (só com pedido de rig) | Fora do escopo de edição de animação |
| Drivers / Shape Keys / F-Curve Noise | Propriedade › Add Driver; Mesh Data › Shape Keys; Modifiers no Graph Editor | Secundários, expressões | Drivers e Noise não exportam como lógica: bake. Shape keys exportam como morph targets (testar) |
| Motion Paths | Pose › Motion Paths › Calculate | Diagnóstico de arcos | Não exporta (a trilha das juntas do Motion Lens faz o mesmo papel) |

### 7.2 Bake visual (numa cópia)

```python
# Contexto: armature ativa em Pose Mode, só os ossos DEFORM selecionados, Action já duplicada.
bpy.ops.nla.bake(
    frame_start=1, frame_end=60, step=1,
    only_selected=True, visual_keying=True,
    clear_constraints=False, clear_parents=False,
    use_current_action=False,          # cria Action nova
    clean_curves=False,
    bake_types={'POSE'},
)
```

Parâmetros conferidos no 5.2.2: `frame_start`, `frame_end`, `step`, `only_selected`, `visual_keying`,
`clear_constraints`, `clear_parents`, `use_current_action`, `clean_curves`, `bake_types`, `channel_types`. É um operador
de interface: depende de contexto e seleção. Valide a Action gerada com `vision.py pair`.

### 7.3 Exportação GLB e roundtrip

`File › Export › glTF 2.0`, formato **GLB**. No 5.2.2, `export_animation_mode` tem **5** opções:

| Modo | Quando usar |
|---|---|
| `ACTIONS` | Um clipe por Action (o normal para o Arenamon) |
| `ACTIVE_ACTIONS` | Junta as Actions ativas dos objetos num clipe |
| `BROADCAST` | Aplica cada Action a todos os objetos com slot compatível |
| `NLA_TRACKS` | Um clipe por trilha NLA |
| `SCENE` | A cena inteira como um clipe |

Checklist: salvar com nome novo · conferir modo, skinning, morph targets, só ossos deform, nomes dos clipes · frame
range e amostragem · escala, altura e eixos · **reimportar num Blender limpo** e listar Actions, ossos e durações ·
abrir no Animation Studio · testar no Combat Lab.

| Verificação | Aprovação | Evidência |
|---|---|---|
| Rig | Mesmos ossos deform; nada renomeado sem autorização | Lista antes/depois |
| Clipes | Todos os previstos, nomes corretos | Lista + duração/frames |
| Deformação | Sem ruptura nas poses examinadas | `vision.py pair` |
| Loop | Sem salto na emenda (`check` com `loop_seam`) | Relatório `check` |
| Runtime | Clipe certo no estado certo | Capturas/replay do Combat Lab |
| Mecânica | Janelas, hitbox e custos iguais (§6) | Fonte dos tempos registrada |

## 8. Exemplos de automação (conferidos no 5.2.2)

### 8.1 Inventário somente leitura (MCP ou `blender -b ARQ.blend --python inv.py`)

```python
import bpy
scn = bpy.context.scene
print('Blender:', bpy.app.version_string)
print('Arquivo:', bpy.data.filepath or '(sem arquivo)', '| alterado sem salvar:', bpy.data.is_dirty)
print('FPS:', scn.render.fps / scn.render.fps_base, '| frames:', scn.frame_start, '-', scn.frame_end)
for ob in bpy.data.objects:
    if ob.type != 'ARMATURE':
        continue
    ad = ob.animation_data
    act = ad.action if ad else None
    slot = ad.action_slot if ad and act else None
    print('ARMATURE:', ob.name, '| ossos:', len(ob.data.bones), '| deform:', sum(b.use_deform for b in ob.data.bones))
    print('  action ativa:', act.name if act else '(nenhuma)', '| slot:', slot.identifier if slot else '(nenhum)')
    print('  trilhas NLA:', len(ad.nla_tracks) if ad else 0)
for a in bpy.data.actions:
    n = sum(len(cb.fcurves) for l in a.layers for s in l.strips for cb in s.channelbags)
    print('ACTION:', a.name, '| faixa:', tuple(a.frame_range), '| slots:', [s.identifier for s in a.slots], '| fcurves:', n)
```

Executado em 30/10/2026 na sessão viva (Eggo, rig `AlienRig`, 20 ossos, 25 Actions) sem alterar nada.

### 8.2 Comandos do `blender-vision` mais usados

```bash
python scripts/blender-vision/vision.py doctor
python scripts/blender-vision/vision.py cycle --blend A.blend --action X --prev-action Y --offset 1 --brief BRIEF.json --label L --out DIR
python scripts/blender-vision/vision.py pair  --blend A.blend --action-a ORIGINAL --action-b NOVA --frames 3,9,11 --offset 1 --views front,side_nX,top --out DIR
python scripts/blender-vision/perception.py motion --blend B --action "attack 1" --frames 1-54 --stroke-bone Hips --floor-from-action idle --out DIR
python scripts/blender-vision/instalar_motion_lens.py        # só mostra; NÃO instala
```

### 8.3 Esqueleto de módulo de correção (para `apply_fix.py`)

```python
# scripts/blender-vision/<pasta_da_tarefa>/fNN_motivo.py  (somente com autorização do modo B)
DESCRIPTION = "Braço direito lidera o bote (g9-g12). Nenhuma outra fase é tocada."

def apply(ctx):
    # ctx (apply_fix.py): arm, action (a NOVA), scene, pl (pose_lib), offset, log (lista), go(g) = ir ao frame autoral g
    pl, arm = ctx.pl, ctx.arm
    for g in (9, 12):
        ctx.go(g)
        pl.aim(arm, "RightArm", (-1.0, 0.2, -0.3))   # (esquerda, cima, frente) do corpo
        pl.key(arm, ["RightArm"], g + ctx.offset)
        ctx.log.append("g%d: RightArm apontado à frente" % g)
```

Modelo real: `tackle_fixes/f01_start_limbs.py`. O `apply_fix.py` grava `fix_log.json` com a descrição e o log.

## 9. Personagens e fontes

| Personagem | Fonte | Observação |
|---|---|---|
| Wookada | `chars/wookada/wookada.glb` (+ FBX e referências PNG) | No jogo |
| Mosh («Cogumelo») | `chars/mosh/Cogumelo.glb`, `Cogumelo_com_rig.fbx` + clipes Mixamo FBX | Rig Mixamo; GLB importado a 24 fps (use `prep_source.py --time-scale 1.25 --fps 30`); chapéu pesado no osso `Head` |
| Vigoroth | `chars/vigor/` (Tackle v1–v20, Ombrada) | **Só local** (pasta pesada fora do Git) |
| Eggo | `chars/Eggo/*.blend` (rig `AlienRig`) | Idles, Walk e Dash em `.blend` |
| Croagunk · Drowzee · Gumshoos | `chars/croagunk`, `chars/drowzee`, `chars/gumshoos` | Rig do Gumshoos não confirmado |

Não use um template humanoide sem conferir o rig. `pose_lib.BONES` usa nomes Mixamo e não serve para o `AlienRig` sem
mapeamento.

**Direitos:** o AGENTS.md autoriza versionar e publicar `chars/` no **repositório privado**, inclusive material não
autoral. Isso é uma decisão de hospedagem do projeto, **não uma licença**: não redistribua esses arquivos fora do
repositório (releases públicos, sites, terceiros) sem decisão do responsável.

## 10. Governança

### 10.1 Novo add-on? Só depois de esgotar o que existe

**Não crie** o «Arenamon Blender Bridge» proposto na V1: auditoria, contrato, baseline, relatório e roundtrip já existem
no Motion Lens e no `blender-vision`. A ordem é esta:

1. Descrever a lacuna com reprodução passo a passo.
2. Mostrar que `blender-vision`, Motion Lens, Direction Lines, `pose_lib.py`, Studio e as ferramentas nativas não
   resolvem.
3. Propor **extensão** da ferramenta existente (novo comando no `vision.py`, novo operador no Motion Lens, nova função
   na `pose_lib`), respeitando o limite de 2.000 linhas por arquivo.
4. Só se a extensão for inviável, propor add-on novo com escopo mínimo, Blender alvo 5.2, plano de testes com Blender
   real e plano de reversão.
5. Implementar só com aprovação explícita de escopo e destino.

### 10.2 Relatório obrigatório

```
MODO: A auditoria | B edição autorizada | C mecânica
ENTRADA: Blender (versão) · repositório/branch/commit · arquivo · rig · Action/slot
FATO VERIFICADO: arquivos lidos, comandos executados, folhas abertas (códigos LEITURA)
PROBLEMA: sintoma, frames, ossos, evidência
AÇÃO: comandos, arquivos NOVOS criados, hashes da origem antes = depois
RESULTADO: clipes, duração, root, comparação pair/snap
MECÂNICA: fonte dos tempos (phaseMode) e se as janelas mudaram
VALIDAÇÃO: reimportação GLB, Studio, Combat Lab, teste da área
NÃO VERIFICADO: o que ficou sem prova
ENTREGA: caminho para abrir e como reverter
```

### 10.3 Casos de teste mínimos

| Teste | Como verificar | Falha típica |
|---|---|---|
| T01 idle | `check` com `loop_seam`, `not_frozen`, `foot_planted` | Salto na emenda, pé deslizando |
| T02 golpe | `perception.py motion` + janela efetiva (§6) | Impacto visual fora da janela ativa |
| T03 esquivas | `vision.py shot` nas vistas da câmera real | Direção/silhueta inconsistentes |
| T04 IK/footlock | `vision.py footlock` + `contact` | Torção, estiramento |
| T05 export | Reimportação GLB; nomes, durações, deformação | Action omitida, bind alterado |
| T06 rigs | Wookada, Mosh, Eggo, Vigoroth (local) | Pipeline quebra num rig específico |
| T07 regressão | Mesmo replay antes/depois no Combat Lab | Mudança acidental na mecânica |

## 11. Prompt operacional (copiar para o agente)

> Você vai trabalhar com animação 3D do Arenamon. Antes de qualquer coisa: leia `AGENTS.md`,
> `docs/MANUAL_BLENDER_AGENTES.md`, `scripts/blender-vision/README.md` e `scripts/blender-vision/PROTOCOLO_AGENTE_VISUAL.md`,
> e informe branch e commit. Declare o **modo** (A auditoria · B edição autorizada · C mecânica) e não passe de modo sem
> autorização.
>
> Confirme a versão do Blender (esperado 5.2.2 LTS) e quais add-ons estão realmente ativos. A versão do Motion Lens no
> repositório pode ser mais nova que a instalada. Não instale nem ative nada sem consentimento. Pelo MCP, a sessão viva
> pode ter alterações não salvas: só leitura, nunca salve.
>
> Use primeiro `vision.py`, `perception.py`, `witness.py`, `pose_lib.py`, `apply_fix.py`, Motion Lens e Direction Lines.
> Não crie ferramenta nova sem mostrar a lacuna. Use a API 5.x (slots, layers, channelbags; `Action.fcurves` não existe).
>
> No modo A, correções são sugestões, nunca aplicadas. No modo B, crie Actions e arquivos novos, nunca sobrescreva a
> origem, e compare com `vision.py pair`. Não escolha o frame de contato sem alvo autorizado. Não mude janelas de combate
> nem regras; relate a fonte dos tempos (phaseMode) e qualquer desencontro entre animação e mecânica.
>
> No final, entregue o relatório §10.2 com fatos verificados, arquivos novos, hashes, validação e o que não foi verificado.

### 11.1 Campos para uma tarefa concreta

```
MODO: [A | B | C]
OBJETIVO: [idle / golpe / esquiva / retarget / export / análise]
PERSONAGEM(S) E RIG: [...]
FONTE: [caminho .blend/GLB/FBX; Action; branch/commit]
RESTRIÇÕES: [o que fica inalterado]
CRITÉRIO VISUAL: [referência aprovada, câmera, frames críticos]
DESTINO: [caminho do arquivo NOVO, pasta de evidências]
ADD-ON: [não | analisar lacuna | autorizado após escopo]
ENTREGA: [blend novo, GLB de teste, relatório, capturas]
```

## 12. Critérios verificáveis de conformidade deste manual

- [ ] Todo caminho citado existe no commit-base (`scripts/blender-vision/*`, `prototypes/*`, `chars/*` exceto `vigor/`,
      que é só local).
- [ ] O script §8.1 roda no 5.2.2 sem erro e sem alterar a cena.
- [ ] Os parâmetros de `nla.bake` e os modos de exportação glTF batem com o Blender instalado.
- [ ] A lista `applied:false` (§6) bate com `animation-profile.js`.
- [ ] O DOCX V2 foi gerado deste Markdown e está linkado no portal ao lado deste arquivo.

## 13. Referências

**Projeto:** [AGENTS.md](../AGENTS.md) · [blender-vision](../scripts/blender-vision/README.md) ·
[Protocolo visual](../scripts/blender-vision/PROTOCOLO_AGENTE_VISUAL.md) ·
[Witness](../scripts/blender-vision/WITNESS_ARCHITECTURE.md) · [Percepção](BLENDER_VISION_PERCEPCAO.md) ·
[Addons](BLENDER_ADDONS_MOTION_LENS.md) · [Plano ZZZ](ANIMACAO_ESTILO_ZZZ_PLANO.md) ·
[Studio](../prototypes/studio/README.md) · [Rigging fase 1](../prototypes/studio/RIGGING_FASE1.md).

**Blender 5.2 (oficial; use sempre a versão instalada no URL):**
- Manual: https://docs.blender.org/manual/en/5.2/
- API Python: https://docs.blender.org/api/5.2/ (`bpy.types.Action`, `ActionSlot`, `ActionChannelbag`, `bpy.ops.nla.bake`)
- glTF 2.0: https://docs.blender.org/manual/en/5.2/addons/import_export/scene_gltf2.html

Os URLs seguem o padrão da documentação oficial e não foram abertos nesta revisão. O comportamento citado foi conferido
no Blender instalado.

## 14. Histórico

- **V1.0 — 30/10/2026:** versão inicial (DOCX), [preservada](ARENAMON_Manual_Blender_Para_Agentes_IA_V1_original.docx).
- **V2.0 — 30/10/2026:** auditoria técnica e governança.
- **V2.1 — 31/10/2026:** Motion Lens 0.3.3.
