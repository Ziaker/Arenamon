# Addons do Blender: Motion Lens e Direction Lines

Cópia versionada dos dois addons personalizados usados nos testes de animação. Antes, eles viviam só na pasta de addons do Blender do usuário.

## Arquivos

| Addon | Caminho no repositório | Versão | SHA-256 |
|---|---|---|---|
| Motion Lens | `scripts/blender-vision/addons/motion_lens.py` + `motion_lens_parts/` | 0.3.3 | ponto de entrada: `f4f948b6029e3bb3912150c9cd4da010bd3dfb8c9badc8258a69fedb69091bb3`; as partes possuem hashes próprios |
| Direction Lines | `scripts/blender-vision/addons/direction_lines.py` | 0.1.1 | `a0f95852ba55908cae7b0c6ab1d69a747608b6099b1127fe376999dccd526793` |

Estes arquivos são as fontes oficiais versionadas. A cópia instalada no Blender 5.2 só muda quando o instalador é executado explicitamente.

## O que cada um faz (lido no código)

**Motion Lens**
- Analisa a animação; a análise de golpe usa o intervalo real da Action, não a faixa global da cena.
- Gera fantasmas de pose, trilhas de juntas, gráficos, contact sheet, silhueta, mapa de diferenças e relatório HTML.
- Salva perfis e baseline, e lê/escreve um contrato JSON (`motion_lens_contract`).
- Quase todos os operadores são somente análise. `apply_impact` é a exceção explícita: cria uma Action derivada, nunca sobrescreve a Action fonte, e restaura o estado em caso de falha. Smear e stretch aparecem apenas em `check_contract`; não são gerados.
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


## Divisão por responsabilidade (v1.49.5)

Para respeitar o limite de 2.000 linhas por arquivo (AGENTS.md), `scripts/blender-vision/addons/motion_lens.py` virou o **ponto de entrada** (≈ 55 linhas: `bl_info`, reexporta toda a API anterior e `register/unregister`) e o código foi para `scripts/blender-vision/addons/motion_lens_parts/`: `common` (utilitários e constantes), `contract`, `analysis`, `graphs`, `sheets` (contact sheet e esqueleto), `comparison` (ações e baseline), `report`, `ghosts`, `strikes`, `operators` e `ui`. Nenhuma função ou operador foi removido; o teste `tests/test_motion_lens_background.py` dá 7/7 e resultados idênticos aos da versão de arquivo único.

**Instalar:** copie `motion_lens.py` **e** a pasta `motion_lens_parts/` juntos (ou rode `python scripts/blender-vision/instalar_motion_lens.py`, que por padrão só simula). Com `--instalar`, o instalador valida a sintaxe, prepara o pacote fora do destino e troca entrada e módulos como uma unidade. Se a troca falhar, restaura os dois; se houver versão anterior, guarda `motion_lens.py.bak` e `motion_lens_parts.bak`.

## Robustez e interface (v0.3.3 / v0.1.1)

- Direction Lines rejeita intervalo invertido e coluna com menos de dois pontos antes de criar uma guia.
- Guias degeneradas, ossos ausentes e armature ausente são ignorados com diagnóstico legível durante a comparação, sem derrubar o operador.
- Nenhum handler ou retorno automático de frame foi adicionado.
- O painel Motion Lens preserva os 15 comandos anteriores e expõe os dois operadores de golpe já existentes: 17 operadores e 40 propriedades.
- O diagnóstico de golpe rotula contato como **CANDIDATO**, mostra frames, segundos, m/frame e m/s, e não infere colisão sem alvo/evento.
- Derivação e comparação preservam Action Slot, frame/subframe e estado anterior; a derivação é removida se falhar.
- Os controles estão agrupados por função: **Gerar evidências**, **Comparar animações**, **Visualizar movimento**, **Diagnosticar movimento**, **Perfis** e **Limpeza**.
- `bl_info`, título do painel e relatório HTML usam a mesma versão definida em `motion_lens_parts/version.py`.

Testes rápidos específicos:

```powershell
python scripts/blender-vision/tests/test_instalar_motion_lens.py
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' -b --factory-startup --python scripts/blender-vision/tests/test_direction_lines_background.py -- scripts/blender-vision/addons/direction_lines.py
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' -b --factory-startup --python scripts/blender-vision/tests/test_motion_lens_ui_background.py -- scripts/blender-vision/addons/motion_lens.py
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' -b --factory-startup --python scripts/blender-vision/tests/test_motion_lens_strikes_background.py -- scripts/blender-vision/addons/motion_lens.py
```

Auditoria detalhada: [MOTION_LENS_AUDITORIA_EVOLUCAO_2026-10-31.md](MOTION_LENS_AUDITORIA_EVOLUCAO_2026-10-31.md).
