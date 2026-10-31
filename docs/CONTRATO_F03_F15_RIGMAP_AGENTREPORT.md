# Especificação Técnica F03 + F15: Mapeamento Semântico e Relatório para IA

Data: 31/10/2026.
Contratos implementados:
- **F03:** `arenamon.rig-map/1` em [`scripts/blender-vision/rig_map.py`](../scripts/blender-vision/rig_map.py)
- **F15:** `arenamon.agent-report/1` em [`scripts/blender-vision/agent_report.py`](../scripts/blender-vision/agent_report.py)

---

## 1. F03 — Mapeamento Anatômico Semântico (`arenamon.rig-map/1`)

### 1.1 Objetivo e Regras Fundamentais
1. **Preservação de Nomes Originais:** Nenhum osso tem seu identificador alterado. O mapeamento associa o nome real do osso no armature a um papel anatômico funcional canônico (`role`).
2. **Separação de Confiança:** Mapeamentos registram seu método de resolução (`OVERRIDE`, `KNOWN_TEMPLATE`, `TOKEN_HEURISTIC`, `NOT_FOUND`) e pontuação de confiança ($0.0$ a $1.0$).
3. **Não-Invenção de Anatomia:** Seres sem membros específicos (ex: Cogumelo sem braços, bípedes sem cauda/asas) registram tais papéis explicitamente como `status: "ABSENT"` ou `status: "UNMAPPED"`. Não há preenchimento forçado de lacunas.
4. **Distinção Raiz vs. Pelve:** Separação mandatória entre o osso de deslocamento global no mundo (`root`) e o centro de massa/rotação do quadril (`pelvis`).
5. **Prevenção de Colisões:** Um osso físico não pode ser mapeado simultaneamente para múltiplos papéis incompatíveis. O validador rejeita colisões.

### 1.2 Templates Nativos Suportados
- **MIXAMO:** Padrão clássico com prefixos `mixamorig:` ou diretos (`Hips`, `Spine`, `LeftArm`, `RightFoot`).
- **GIGANTIC_UNREAL:** Padrão de action game Unreal Engine (`b_Root`, `b_Pelvis`, `b_Spine`, `b_LeftUpLeg`, `b_RightHand`).
- **ALIEN_RIG:** Padrão do personagem Eggo no Arenamon (`Root`, `Hips`, `Spine`, `LeftFoot`, com `Crest`/`Tail` opcionais).
- **POKEMON_ZA:** Padrão indexado do corpus Z-A (`Origin`/`Root`, `Waist`/`Hips`, `SpineA`, `ArmL`, `FootR`, `TailA`).
- **RIGIFY_BLENDER:** Padrão do gerador de rigs do Blender (`root`, `torso`, `chest`, `thigh.L`, `foot.R`).
- **CUSTOM:** Heurística de decomposição de tokens e lateralidade com resolução de ambiguidades.

### 1.3 Exemplo de Documento `arenamon.rig-map/1`
```json
{
  "schema": "arenamon.rig-map/1",
  "rig_id": "eggo_alien",
  "armature_name": "AlienRig",
  "detected_template": "ALIEN_RIG",
  "template_fit": 0.88,
  "total_bones": 17,
  "mapped_count": 14,
  "unmapped_bones_count": 1,
  "absent_roles": ["left_wing", "right_wing", "tail_base", "tail_mid", "tail_tip"],
  "unmapped_bones": ["b_Prop_Slot"],
  "overrides_applied": {},
  "confidence_summary": {
    "min": 0.95,
    "max": 0.95,
    "mean": 0.95,
    "low_confidence_roles": []
  },
  "roles": {
    "root": {
      "role": "root",
      "bone_name": "Root",
      "status": "MAPPED",
      "confidence": 0.95,
      "method": "KNOWN_TEMPLATE",
      "notes": "Template ALIEN_RIG match exato em 'Root'"
    },
    "pelvis": {
      "role": "pelvis",
      "bone_name": "Hips",
      "status": "MAPPED",
      "confidence": 0.95,
      "method": "KNOWN_TEMPLATE",
      "notes": "Template ALIEN_RIG match exato em 'Hips'"
    },
    "tail_base": {
      "role": "tail_base",
      "bone_name": null,
      "status": "ABSENT",
      "confidence": 1.0,
      "method": "OVERRIDE",
      "notes": "Declarado ausente pela anatomia do modelo"
    }
  }
}
```

---

## 2. F15 — Relatório Estruturado para Agentes (`arenamon.agent-report/1`)

### 2.1 Objetivo e Regras Fundamentais
1. **Consumo por Claude, Codex e Antigravity:** Relatório serializado em JSON com rastreabilidade completa de fonte, armature, Action Slot (Blender 5.x), frames, FPS e unidades.
2. **Taxonomia Epistêmica Rigorosa:** Separação estrita em quatro categorias inconfundíveis:
   - `facts`: Fatos comprovados matematicamente por leitura direta de curvas F-Curve ou geometria.
   - `observations`: Observações visuais ou medidas em folhas de contato renderizadas.
   - `inferences`: Inferências lógicas técnicas fundamentadas em dados.
   - `hypotheses`: Hipóteses condicionais que dependem do código da engine ou intenção artística.
3. **Proibições Invioláveis:**
   - **`applied: false` mandatório:** Toda e qualquer proposta em `proposed_corrections` deve conter `applied: false`. O validador rejeita qualquer relatório que tente auto-aplicar correções no arquivo.
   - **Rejeição de Expressões Genéricas:** Expressões vagas sem fundamentação (como *"está fluido"*, *"ficou bom"*, *"sem problemas"*) são rejeitadas pelo validador.
4. **Verificação Criptográfica de Evidências:** Cada imagem ou folha de evidência possui registro de caminho e hash SHA-256. Em modo de validação com verificação de arquivos (`verify_files=True`), o validador confere a presença física no disco e a integridade do hash.

### 2.2 Exemplo de Documento `arenamon.agent-report/1`
```json
{
  "schema": "arenamon.agent-report/1",
  "report_id": "REP-20261031-EGGO-DODGE",
  "timestamp": "2026-10-31T17:20:00Z",
  "target": {
    "source_file": "chars/Eggo/eggo dodge lateral v1.blend",
    "action_name": "Dodge_Right_1",
    "action_slot": "Slot_Body",
    "armature_name": "AlienRig",
    "frame_range": [1, 24],
    "frame_count": 24,
    "fps": 24.0,
    "duration_seconds": 1.0,
    "unit_system": "METRIC_METERS"
  },
  "rig_mapping": {
    "schema": "arenamon.rig-map/1",
    "rig_id": "eggo_alien",
    "detected_template": "ALIEN_RIG"
  },
  "measurements": [
    {
      "metric": "root_motion_x_displacement",
      "value": 3.25,
      "unit": "m",
      "method": "fcurve_eval",
      "confidence": 0.98,
      "target_role": "root",
      "target_bone": "Root"
    }
  ],
  "visual_evidence": [
    {
      "evidence_id": "EV-EGGO-DODGE-01",
      "file_path": "scripts/blender-vision/evidence/eggo_dodge/sheet_front.png",
      "sha256": "07d838b6ec758e6deeda5d7f18fe2866013d0efbec4b490b39abb53954dc2492",
      "view_type": "FRONT",
      "frames_shown": [1, 6, 12, 18, 24],
      "reading_token": "EGG01",
      "verified_exists": true
    }
  ],
  "findings": {
    "facts": [
      "A curva de translação em X do osso Root atinge exatamente 3.25 m ao término da ação."
    ],
    "observations": [
      "O pé direito permanece em contato com o plano do solo entre os frames 8 e 14."
    ],
    "inferences": [
      "A desaceleração suave após o frame 16 reflete transição de inércia para frenagem."
    ],
    "hypotheses": [
      "A amplitude total de 3.25 m foi projetada para cobrir a largura do grid da arena."
    ]
  },
  "limitations_and_risks": {
    "missing_data": [
      "Armature sem ossos de dedos individuais das mãos"
    ],
    "assumptions": [
      "Massa corporal estimada em 45 kg"
    ],
    "risks": [
      "Reduzir a duração para menos de 0.8 s comprometerá a janela mecânica de invulnerabilidade"
    ],
    "confidence_score": 0.92
  },
  "proposed_corrections": [
    {
      "proposal_id": "PROP-EGGO-01",
      "target_role": "pelvis",
      "frame_range": [12, 20],
      "suggested_action": "Ajustar ângulo de guinada da pelve em +4.0 graus",
      "parameters": {"yaw_deg": 4.0},
      "rationale": "Evitar desvio na linha de ação frontal durante a desaceleração",
      "applied": false
    }
  ],
  "reproduction": {
    "tool": "blender_headless",
    "command_template": "blender.exe -b <file> -P scripts/blender-vision/perception.py",
    "validation_checklist": [
      "Conferir paridade de FPS entre a Action e a timeline da cena",
      "Verificar hashes SHA-256 das evidências em manifest.json",
      "Validar limites mecânicos antes de editar keyframes"
    ]
  }
}
```

---

## 3. Demonstração e Homologação Prática

### 3.1 Pipeline Sintético Ponta a Ponta
O teste automatizado [`test_f03_f15_end_to_end.py`](../scripts/blender-vision/tests/test_f03_f15_end_to_end.py) demonstra o pipeline completo operando em fixtures sintéticas:
1. **Entrada:** Lista de ossos do armature e canais de pose.
2. **F03:** Mapeamento automático de papéis via `build_rig_map(...)` com preservação dos nomes originais de ossos e isolamento de membros ausentes.
3. **Diagnóstico:** Extração de métricas de deslocamento e rotação ancoradas nos papéis identificados (`root`, `pelvis`).
4. **F15:** Construção do relatório estruturado via `build_agent_report(...)` com taxonomia epistêmica e evidências criptografadas.
5. **Validação:** Validação estrita via `validate_agent_report(report, verify_files=True)` garantindo conformidade matemática, ausência de frases genéricas e impossibilidade de auto-aplicação não autorizada.

### 3.2 Homologação com Assets Reais (`test_f03_f15_real_assets.py`)
O teste [`test_f03_f15_real_assets.py`](../scripts/blender-vision/tests/test_f03_f15_real_assets.py) homologa os contratos contra arquivos reais dos três ecossistemas do projeto:
1. **Gigantic Real (`Pakko_Animations.blend`):**
   - Extrai via Blender 5.2.2 headless a lista exata de 83 ossos de Pakko (`b_Root`, `b_Pelvis`, `b_Bicep_L`, `b_Elbow_L`, `b_Wrist_L`, `b_Thigh_L`, `b_Knee_L`, `b_Ankle_L`, etc.).
   - Mapeia via F03 com template `GIGANTIC_UNREAL`.
   - Lê a curva de deslocamento de raiz da Action `Skill_RushAttack` via channelbag do Blender 5, medindo exatamente 400.0 cm ($4.00\text{ m}$).
   - Vincula a folha de contato real PNG publicada (`GIG-P1-PAKKO-Skill_RushAttack-FRONT.png`), validando a existência física e o hash SHA-256 no disco.
2. **Arenamon Real (`Eggo idle.blend`):**
   - Extrai via Blender 5.2.2 headless a lista exata de 20 ossos do armature `AlienRig` do Eggo (`Root`, `Hips`, `Spine`, `Chest`, `Neck`, `Head`, `LeftArm`, `LeftFoot`, etc.).
   - Mapeia via F03 com template `ALIEN_RIG`.
   - Avalia a Action real de repouso `Idle 5 Organica` (101 frames a 24 FPS) e valida o relatório F15 gerado.
3. **Pokémon Z-A Real (`paridade_fk_2026-10-25.json`):**
   - Extrai dados reais do benchmark de paridade de cinemática direta FK (Golisopod `pm0867`).
   - Mapeia os ossos via F03 com template `POKEMON_ZA` (`Root`, `Waist`, `ArmL`, `FootL`).
   - Registra as métricas reais de altura ($1.98\text{ m}$) e erro relativo de FK ($0.0005\% H$).

### Como Executar os Testes
```bash
# Executa todos os 17 testes unitários, ponta a ponta e de assets reais
python -m unittest discover -s scripts/blender-vision/tests -p "test_f*.py"
```
