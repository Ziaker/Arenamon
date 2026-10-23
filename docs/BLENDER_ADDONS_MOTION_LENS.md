# Addons do Blender: Motion Lens e Direction Lines

Cópia versionada dos dois addons personalizados usados nos testes de animação. Antes, eles viviam só na pasta de addons do Blender do usuário.

## Arquivos

| Addon | Caminho no repositório | Versão | SHA-256 |
|---|---|---|---|
| Motion Lens | `scripts/blender-vision/addons/motion_lens.py` | 0.3.1 | `e39adb0e3495ccac4944effe1fcafaa71eb4d2ac30740c1b7052ca35f5cd2d38` |
| Direction Lines | `scripts/blender-vision/addons/direction_lines.py` | 0.1.0 | `2574f9797ec0c5554331cc65bf1afb39f04da10d92c13efb5c05b5fe080d9464` |

As cópias são byte a byte da versão instalada no Blender 5.2 (`scripts/addons/`). Nenhum comportamento foi alterado.

## O que cada um faz (lido no código)

**Motion Lens**
- Analisa a animação quadro a quadro dentro de `frame_start`..`frame_end` da cena.
- Gera fantasmas de pose, trilhas de juntas, gráficos, contact sheet, silhueta, mapa de diferenças e relatório HTML.
- Salva perfis e baseline, e lê/escreve um contrato JSON (`motion_lens_contract`).
- **Não cria nem altera keyframes.** Smear e stretch aparecem apenas em `check_contract`, que verifica janelas com esses nomes no contrato. Não gera esses efeitos.
- Há um trecho marcado como `PATCH:` em `check_contract` (linha 386), ajuste local que ainda não tem documentação própria.

**Direction Lines**
- Cria curvas-guia de direção nos ossos, a partir do movimento (`new_motion`, `new_action`) e comparações entre actions (`compare`).
- Gera blocos de texto `DL_Guides` e `DL_Report`.
- Não altera a animação.

## Ativação

Os dois addons precisam estar **ativos** no Blender. Ative em Preferências → Add-ons, ou por script com `addon_utils.enable(..., persistent=True)`. Confirme pelo painel "Motion Lens" e "Direction Lines" na barra lateral da viewport.

Esta cópia está no repositório, mas o Blender usa a cópia de `scripts/addons/`. Se você atualizar o arquivo do repositório, copie de novo para `scripts/addons/`.

## Outra cópia encontrada

Existe uma segunda versão de `motion_lens.py` em `Documents\Codex\…\outputs\`, com SHA-256 `215cc906c172fee2e3fa06cbc7d9ab0d43fcf20ae14fd7d3a73960e88c18598c`. Ela é diferente da instalada e não está no repositório. Ainda não foi decidido qual é a versão oficial.

## Cópias soltas em `chars/vigor` (inventário de 23/10/2026)

`chars/vigor/` é pasta local (não vai para o GitHub). Lá ficaram versões antigas, mantidas como estão:

| Arquivo | Versão | SHA-256 (início) |
|---|---|---|
| `motion_lens_v0_3_1_com_correcao_draw_text.py` | 0.3.1 | `e39adb0e…` (igual à oficial) |
| `motion_lens_v0_3_patched.py` | 0.3 (variante) | `62b02fd6…` |
| `backup_addons/motion_lens_v0_2_instalado.py` | 0.2 | `4495cebb…` |
| `motion_lens.py`, `motion_lens_v0.1.py` | 0.1 | `32b9d977…` |
| `direction_lines.py` | 0.1.0 | `2574f979…` (igual à oficial) |

## Verificação de 23/10/2026 (via Blender MCP)

- Blender 5.2.2 LTS, addon MCP for Blender 1.8 (protocolo 14).
- Os dois addons estavam **instalados mas desligados**. Ligados na sessão (sem salvar preferência), carregaram sem erro; o operador `bpy.ops.motionlens.*` expõe 15 comandos e `bpy.ops.dirlines.*` 5 comandos.

## Limites

- Os `.blend` de `chars/` não foram alterados por esta entrega. Os SHA-256 foram registrados antes e serão conferidos depois.
- Estes addons não foram executados nesta entrega. A verificação funcional está nos registros de `scripts/blender-vision/` e não foi repetida aqui.

## Relacionados

- [Documentação do Blender Vision (percepção ativa)](BLENDER_VISION_PERCEPCAO.md)
