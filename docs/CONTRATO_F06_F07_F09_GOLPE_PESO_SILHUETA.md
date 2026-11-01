# Contratos F06, F07 e F09 — Análise de Golpe, Peso/Impulso e Orquestração de Silhuetas

Data: 01/11/2026.
Versão: 1.1.0 (Auditada com Rigor Epistêmico).
Arquitetura: Motion Lens / Blender Vision / Arenamon Agent Report (`arenamon.agent-report/1`).

---

## 1. F06 — Análise de Golpe e Contato (`arenamon.strike-analysis/1`)

### Objetivo
Analisar o timing e a dinâmica de aceleração de golpes de combate (socos, chutes, cabeçadas, cortes), diferenciando categoricamente:
1. **Contato CANDIDATO (`CANDIDATO`):** inferido por desaceleração cinemática ou aproximação de efetores.
2. **Contato CONFIRMADO_ALVO (`CONFIRMADO_ALVO`):** verificado por colisão contínua (CCD / Continuous Collision Detection) com alvo geométrico explícito (`SPHERE` ou `BOX`), detectando travessia do colisor entre amostras de quadros (sem falso-negativo por tunneling).
3. **Contato CONFIRMADO_EVENTO (`CONFIRMADO_EVENTO`):** associado a um evento formalmente autenticado de combate na timeline de gameplay contendo obrigatoriamente `event_name`, `frame`, `source` (ex.: `"GAMEPLAY_TIMELINE"`, `"COMBAT_SIMULATOR"`) e `is_verified=True`. Passar apenas um número de frame solto é explicitamente rejeitado e recai em `CANDIDATO` com advertência formal.

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

### Regra Epistêmica de Pés Ausentes
- Quando as trajetórias dos pés não são fornecidas, a métrica `support_stability_ratio` é estritamente **`None`** (não avaliada), sendo registrada a ausência em `missing_data`. É terminantemente proibido atribuir `1.0` (estabilidade perfeita) sem dados reais medidos.

### Métricas Principais
- `pelvis_total_travel_distance`: distância total percorrida pela pelve (m).
- `pelvis_anticipation_recoil`: recuo sagital na direção oposta ao ataque antes do avanço (m).
- `pelvis_thrust_advance`: avanço do quadril no golpe ao longo do eixo de ataque (m).
- `pelvis_vertical_compression_drop`: rebaixamento do quadril em compressão de mola (m).
- `pelvis_peak_velocity`: velocidade máxima da pelve (m/s).
- `pelvis_peak_acceleration`: aceleração máxima do quadril (m/s²).
- `momentum_recovery_ratio`: razão entre tempo de absorção/retorno e tempo de avanço.
- `support_stability_ratio`: proporção de quadros com pelo menos um pé apoiado no solo (calibrado por `ground_z_reference_m`) ou `None` se pés não fornecidos.

---

## 3. F09 — Orquestração de Silhuetas e Poses-Chave (`arenamon.pose-silhouette/1`)

### Objetivo
Identificar poses estruturais fundamentais (`START_REST`, `ANTICIPATION_APEX`, `STRIKE_APEX`, `RECOVERY_POSE`), calcular as dimensões das caixas delimitadoras e vincular diretamente cada pose com a evidência visual correspondente no disco (com SHA-256 verificado).

### Regras de Rigor Factual
1. **Distinção Categórica de Bounding Box Esquelética:** As métricas representam a caixa delimitadora 2D projetada das articulações do esqueleto (`skeletal_projected_frontal_width_m`, `skeletal_projected_frontal_height_m`), distinguindo formalmente de rasterizações de contorno de malha densa.
2. **Seleção Automática de Marcos:** O analisador conta com o algoritmo `auto_detect_keyframe_milestones()`, capaz de extrair os marcos fundamentais analiticamente a partir das curvas de velocidade e deslocamento, sem requerer marcos manuais hardcoded.

---

## 4. Integração com o Relatório Canônico F15 (`arenamon.agent-report/1`)

Os três módulos implementam funções canônicas de exportação:
- `export_strike_to_agent_report()`
- `export_weight_momentum_to_agent_report()`
- `export_pose_silhouette_to_agent_report()`

Todas exigem mapeamento anatômico semântico F03 (`arenamon.rig-map/1`), utilizam o `frame_range` e taxa de quadros reais da Action, e preservam a integridade epistêmica de fatos, limitações e riscos.
