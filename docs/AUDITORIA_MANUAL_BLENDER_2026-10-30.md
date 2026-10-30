# Auditoria do «Manual Blender para Agentes de IA» V1.0 — 30/10/2026

- **Objeto:** [ARENAMON_Manual_Blender_Para_Agentes_IA_V1_original.docx](ARENAMON_Manual_Blender_Para_Agentes_IA_V1_original.docx)
  (SHA-256 `1376D218…F5D629C2`).
- **Resultado:** [MANUAL_BLENDER_AGENTES.md](MANUAL_BLENDER_AGENTES.md) (V2.0) e
  [o DOCX V2](ARENAMON_Manual_Blender_Para_Agentes_IA_V2.docx).
- **Método:** o texto da V1 foi comparado com o repositório (commit `0f846815`, v1.49.14, igual a `origin/main`) e com o
  Blender 5.2.2 LTS do responsável, consultado só para leitura pelo Blender MCP. O responsável conferiu os pontos
  principais na `main` do GitHub e acrescentou duas ressalvas (§3).

## 1. O que a V1 acertou

| Item | Situação |
|---|---|
| Versão 1.49.14, os 8 arquivos citados existem | Confirmado |
| `startup` = `applied:false`; `armor` e `hitstopMult` = `applied:true` | Confirmado |
| O Studio importa FBX/GLB, edita clipes, eventos e root motion e exporta GLB; o rigging é experimental | Confirmado |
| Assinatura de `bpy.ops.nla.bake` | Válida no 5.2.2 (faltavam `clear_parents`, `clean_curves`, `channel_types`) |
| Disciplina geral: preservar a fonte, conferir o roundtrip, não inventar resultados, não escolher o frame de contato | Coerente com o `PROTOCOLO_AGENTE_VISUAL.md` |

## 2. Problemas encontrados

| # | Problema | Gravidade | Correção na V2 |
|---|---|---|---|
| C1 | Ignorava o pipeline existente (`scripts/blender-vision/`: `vision.py`, `perception.py`, `witness.py`, `pose_lib.py`, `apply_fix.py`, `tackle_attempt.py`, `PROTOCOLO_AGENTE_VISUAL.md`) e podia levar a sistemas duplicados | Crítica | §3 (inventário) e §5 (fluxos baseados nele) |
| C2 | Afirmava que não havia add-on e propunha o «Arenamon Blender Bridge», mas Motion Lens e Direction Lines já existem | Crítica | Bridge descartado; §10.1: estender o que existe |
| C3 | Misturava versões (4.2, 4.4, 4.5, API 5.3); o instalado é o **5.2.2**, onde `Action.fcurves` não existe | Crítica | §4 e §4.1 (slots, layers, channelbags) |
| C4 | Tratava o MCP como hipotético; o `blender_mcp_addon` 1.8 está ativo | Alta | §3.3 (só leitura, sessão viva pode ter alterações não salvas) |
| C5 | Contradizia o AGENTS.md sobre a publicação de assets de terceiros | Alta | §9 (ver ressalva 2) |
| C6 | Leitura incompleta dos campos `applied:false` e das janelas de combate | Alta | §6 (ver ressalva 1) |
| M1 | Personagens: «Cogumelo» é o Mosh; faltavam Vigoroth, Eggo, Croagunk, Drowzee, Gumshoos | Média | §9 |
| M2 | Exportação glTF listava 3 modos; o 5.2.2 tem 5 | Média | §7.3 |
| M3 | `--factory-startup` desliga os add-ons do usuário | Média | §4 |
| M4 | Caminho da Pose Library: manter tanto o Action Editor quanto o Asset Shelf da 3D Viewport (ambos válidos na doc oficial 5.2) | Baixa | §7.1 (tabela) |
| M5 | O script de auditoria não mostrava o slot e ignorava `fps_base` | Baixa | §8.1 (testado no 5.2.2) |
| M6 | Testes «10+ ciclos» e regressão ampla contra a regra de testes leves | Baixa | §10.3 com as ferramentas existentes |
| M7 | Auditoria e edição não eram separadas | Alta | §1: modos A/B/C |

## 3. Ressalvas do responsável (incorporadas)

1. **Janelas de combate.** O `overlayProfileWindows()` (`characters.js`) converte as porcentagens do perfil sobre a
   duração da **ação** (`actionDurationSteps`). Por isso, mudar só a duração do clipe **não** muda a janela mecânica
   vinda do perfil. Os eventos do GLB (`fromGlbEvents`) são escalados por duração da ação ÷ duração do clipe, ou seja,
   de forma proporcional. Tudo isso só vale com «Fonte dos tempos» = Animação aprovada (`phaseMode = 1`). O efeito
   depende da configuração e da origem dos marcadores. A afirmação da auditoria inicial («mudar a duração pode mudar a
   janela») foi **refinada** na V2 §6.
2. **Direitos de terceiros.** O AGENTS.md autoriza versionar material não autoral no repositório **privado**. Isso não
   equivale a uma licença de redistribuição. A V2 §9 registra as duas coisas.

## 4. Achado adicional desta revisão

O **Motion Lens do repositório** (painel «0.4.0», `bl_info` 0.3.1, 17 operadores com `strike` e `apply_impact`) **não é
o instalado** (0.3.1, 15 operadores, sem esses dois; verificado em 30/10/2026). O documento
[BLENDER_ADDONS_MOTION_LENS.md](BLENDER_ADDONS_MOTION_LENS.md) ainda diz «cópia byte a byte» e não registra essa
diferença. Ele não foi alterado nesta revisão (escopo: só o manual); fica a recomendação de atualizá-lo.

## 5. Não verificado

- Os caminhos de menu da GUI um a um.
- Os URLs externos (não foram abertos).
- `vision.py doctor`.
- Execução de qualquer fluxo B (nenhum `.blend` foi criado ou alterado).
