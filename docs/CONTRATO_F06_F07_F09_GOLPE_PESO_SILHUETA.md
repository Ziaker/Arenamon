# Contratos F06, F07 e F09 — Análise de Golpe, Peso/Impulso e Orquestração de Silhuetas

Data: 31/10/2026.
Versão: 1.0.0.
Arquitetura: Motion Lens / Blender Vision / Arenamon Agent Report (`arenamon.agent-report/1`).

---

## 1. F06 — Análise de Golpe e Contato (`arenamon.strike-analysis/1`)

### Objetivo
Analisar o timing e a dinâmica de aceleração de golpes de combate (socos, chutes, cabeçadas, cortes), diferenciando categoricamente:
1. **Contato CANDIDATO (`CANDIDATO`):** inferido por desaceleração cinemática ou aproximação de efetores.
2. **Contato CONFIRMADO_ALVO (`CONFIRMADO_ALVO`):** verificado por colisão com alvo/volume geométrico explícito (ex.: esfera ou caixa delimitadora de colisão).
3. **Contato CONFIRMADO_EVENTO (`CONFIRMADO_EVENTO`):** associado a um marcador ou frame de evento de combate autorizado na timeline de gameplay.

### Métricas Principais
- `strike_windup_frame`: frame de máxima antecipação / recolhimento do membro.
- `strike_contact_frame`: frame de impacto (candidato ou confirmado).
- `strike_duration_frames` e `strike_duration_seconds`: tempo de projeção balística do ataque.
- `strike_peak_speed` e `strike_contact_speed`: velocidades em m/s via diferenças finitas.
- `strike_acceleration_ratio`: razão $V_{contato} / V_{media}$ (golpes contundentes aceleram até o contato $\ge 1.0$).
- `strike_hold_duration_frames`: sustentação pós-contato (leitura do golpe / hit-stop).

---

## 2. F07 — Análise de Peso e Impulso (`arenamon.weight-momentum/1`)

### Objetivo
Calcular a transferência de massa da pelve/tronco e a base de suporte dos pés durante ações de combate, expressando grandezas físicas puras (metros, m/s e m/s²) **sem notas artísticas subjetivas arbitrárias**.

### Métricas Principais
- `pelvis_total_travel_distance`: distância total percorrida pela pelve (m).
- `pelvis_anticipation_recoil`: recuo sagital na direção oposta ao ataque antes do avanço (m).
- `pelvis_thrust_advance`: avanço do quadril no golpe ao longo do eixo de ataque (m).
- `pelvis_vertical_compression_drop`: rebaixamento do quadril em compressão de mola (m).
- `pelvis_peak_velocity`: velocidade máxima da pelve (m/s).
- `pelvis_peak_acceleration`: aceleração máxima do quadril (m/s²).
- `momentum_recovery_ratio`: razão entre tempo de absorção/retorno e tempo de avanço.
- `support_stability_ratio`: proporção de quadros com pelo menos um pé apoiado no solo (calibrado por `ground_z_reference_m`).

---

## 3. F09 — Orquestração de Silhuetas e Poses-Chave (`arenamon.pose-silhouette/1`)

### Objetivo
Identificar e orquestrar as poses estruturais fundamentais (`START_REST`, `ANTICIPATION_APEX`, `STRIKE_APEX`, `RECOVERY_POSE`), projetar suas caixas delimitadoras e proporções de aspecto (frontal e lateral), e vincular diretamente cada pose com a evidência visual correspondente no disco (com SHA-256 verificado).

### Métricas Principais
- `keyframe_{f}_frontal_width_m` e `keyframe_{f}_frontal_height_m`: dimensões da silhueta frontal.
- `aspect_ratio`: proporção de aspecto (Largura / Altura).
- `keyframe_{f}_sagittal_tilt_deg`: inclinação sagital do vetor pelve $\to$ tronco em graus.
- `evidence_ref`: referência à evidência visual rastreável (`evidence_id`, `file_path`, `sha256`, `view_type`).

---

## 4. Integração com o Relatório Canônico F15 (`arenamon.agent-report/1`)

Os três módulos implementam funções canônicas de exportação:
- `export_strike_to_agent_report()`
- `export_weight_momentum_to_agent_report()`
- `export_pose_silhouette_to_agent_report()`

Todas exigem mapeamento anatômico semântico F03 (`arenamon.rig-map/1`), utilizam o `frame_range` e taxa de quadros reais da Action, e preservam a integridade epistêmica de fatos, limitações e riscos.
