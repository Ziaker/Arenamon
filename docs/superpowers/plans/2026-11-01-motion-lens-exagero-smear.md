# Motion Lens Exagero e Smear Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** adicionar ao Motion Lens autoria não destrutiva de exagero, smears 3D, variantes de pose e relatório estruturado para agentes.

**Architecture:** um módulo `exaggeration.py` concentra análise, geração de malhas auxiliares e Actions derivadas; operadores finos expõem essas funções; o painel mantém todos os recursos anteriores e ganha um bloco funcional visível. O runtime de smear do Combat Lab permanece intocado.

**Tech Stack:** Blender 5.2 Python API, `bpy`, `mathutils`, Actions/Action Slots, meshes e materiais procedurais.

**Spec:** dez ideias aprovadas pelo responsável nesta conversa em 01/11/2026.

## Global Constraints

- Nunca alterar a Action original, rest pose, pesos, hierarquia ou mecânicas de combate.
- Malhas geradas ficam numa coleção auxiliar removível e não são salvas automaticamente.
- Todas as intensidades, formas, frames e ossos têm controles visíveis.
- Preservar os 17 operadores e 40 propriedades do Motion Lens 0.3.3.
- Não tocar nos arquivos modificados por outras sessões.

## Review Focus

- Action com vários slots: derivadas e análise preservam o slot fonte.
- Osso ausente: ignorar com diagnóstico, sem quebrar geração inteira.
- Trajetória degenerada: não criar faces inválidas.
- Exceção no meio da geração: remover objetos parciais e restaurar frame/Action/slot.
- Repetição: nomes únicos e limpeza exclusiva da coleção gerada.

---

### Task 1: Núcleo de smear e exagero

**Files:**
- Create: `scripts/blender-vision/addons/motion_lens_parts/exaggeration.py`
- Test: `scripts/blender-vision/tests/test_motion_lens_exaggeration_background.py`

**Interfaces:**
- Produces: `analyze_exaggeration(context)`, `create_smear_meshes(context)`, `create_exaggeration_variants(context)`, `build_agent_exaggeration_report(context)` e `clear_exaggeration_generated()`.

- [x] Criar teste sintético com rig, Action 10–20 e dois Action Slots.
- [x] Implementar amostragem restaurável e diagnóstico de candidatos.
- [x] Implementar presets `RIBBON`, `TUBE`, `CONE`, `DROP`, `BLADE`, `ARC`, `ECHO`, `HULL`.
- [x] Criar material procedural com cor, emissão, opacidade e fade longitudinal.
- [x] Criar variantes derivadas `Sutil`, `Estilizada`, `Extrema`, sem alterar curvas fonte.
- [x] Gerar relatório JSON/texto com evidências, limites e propostas.

### Task 2: Operadores e interface

**Files:**
- Modify: `scripts/blender-vision/addons/motion_lens_parts/operators.py`
- Modify: `scripts/blender-vision/addons/motion_lens_parts/ui.py`
- Modify: `scripts/blender-vision/addons/motion_lens.py`
- Modify: `scripts/blender-vision/addons/motion_lens_parts/version.py`
- Test: `scripts/blender-vision/tests/test_motion_lens_ui_background.py`

**Interfaces:**
- Consumes: funções da Task 1.
- Produces: quatro operadores e propriedades visíveis de forma, intensidade, frames, ossos, espessura, cor, emissão e opacidade.

- [x] Escrever expectativas de inventário antes do registro.
- [x] Registrar operadores/propriedades sem remover os anteriores.
- [x] Adicionar bloco `Criar exagero e smear` ao painel.
- [x] Atualizar a versão para 0.4.0.

### Task 3: Documentação, instalação e entrega

**Files:**
- Modify: `docs/BLENDER_ADDONS_MOTION_LENS.md`
- Create: `docs/MOTION_LENS_EXAGERO_SMEAR.md`
- Modify: `ABRIR_ARENAMON.html`
- Modify: `TESTES_ARENAMON.html`

- [x] Documentar as dez capacidades, limites e fluxo de uso.
- [x] Rodar somente testes específicos, `verificar:tamanho` e `rapido:build`.
- [ ] Instalar com backup no Blender e validar inventário na sessão viva. **Bloqueado até autorização explícita para instalar o 0.4.0.**
- [x] Comparar inventário anterior/posterior e confirmar nenhuma remoção.
- [ ] Commitar só os arquivos desta entrega, publicar e comparar hashes local/remoto.
