# Roteamento de skills GameDev — Arenamon

Este projeto é **fingerprinted** para o roteador (`router/SKILL.md`):

- **Engine: three.js 0.186** (WebGL, bundle esbuild autocontido). Motor de física, combate,
  câmera, animação e VFX são próprios — as skills de engine cobrem three.js puro; onde a
  arquitetura do Arenamon difere, **as regras aprovadas do Arenamon têm prioridade**.
- Não usar skills de Unity, Godot, Unreal, Phaser, PixiJS, Bevy, pygame, LÖVE ou Roblox.

## Mapa de tarefas → skills (projeto)

| Contexto no Arenamon | Skills a carregar |
|---|---|
| Cena, renderizador, loop, resize, OrbitControls | `threejs-scene-setup` |
| Materiais, luzes, sombras, GLB/skeletal | `threejs-materials-lighting`, `threejs-gltf-loading` |
| VFX, partículas, game feel, juice | `game-feel`, `shader-programming` |
| Física, colisões, tunagem de movimento | `physics-tuning` |
| IA de jogo, árvore de comportamento, utilidade | `game-ai`, `ai-behavior-trees-utility-ai` |
| Câmera (rig, lock-on, cinematográfica) | `camera-systems` |
| Performance (FPS, draw calls, memória GPU) | `performance-optimization` |

## Instalação

Skills em `.agents/skills/` (uma cópia única, escopo do projeto — nada global):

- 11 skills + `router` (Apache-2.0, versão do repositório baixada em 2026-10-20;
  `LICENSE`/`NOTICE`/`README` preservados em `tools/gamedev-skills/`).

Como carregar conforme o agente:

- **Claude Code / Cursor / Codex / Cline**: apontar o diretório de skills do agente para
  `.agents/skills/` (ou copiar os `<name>/` para o path nativo — ver
  `tools/gamedev-skills/README.md` → docs/INSTALLATION.md).
- **Kimi Work (este agente)**: ler o `SKILL.md` escolhido com a ferramenta de leitura antes
  da tarefa (o índice gerenciado não inclui skills de terceiros). Comece pelo `router` quando
  incerto.

## Uso cotidiano

1. Comece pelo `router` em tarefas de game dev novas; ele nomeia o conjunto mínimo.
2. Leia o `SKILL.md` escolhido antes de agir; `references/` só sob demanda.
3. Ao pivotar de domínio (ex.: de VFX para IA), re-roteie.
4. Registre usos concretos em `docs/GAMEDEV_SKILLS.md` (data, tarefa, skill, o que aplicou).
