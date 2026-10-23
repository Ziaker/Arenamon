---
name: arenamon-routing
description: >
  Roteamento das GameDev Agent Skills para o Arenamon (three.js 0.186, HTML autocontido,
  física/combate/câmera/VFX próprios). Carregue ao iniciar QUALQUER tarefa de jogo no
  repositório: VFX e partículas, câmera, física e colisões, IA e navegação, animação,
  shaders, postprocessing, game feel, performance, depuração e testes do combat-lab.
  Diz quais skills ler e quais ignorar (Unity, Godot, Unreal, Roblox, Phaser...).
---

# Roteamento GameDev → Arenamon

**Prioridade:** `AGENTS.md`, `docs/` e as regras aprovadas do Arenamon vencem qualquer
recomendação genérica destas skills. Skill é consulta técnica, não especificação.

**Engine do projeto:** three.js 0.186 puro (sem React/R3F), bundle esbuild em HTML
único e offline. Física, combate, câmera, animação e VFX são próprios do combat-lab.

## Mapa tarefa → skill (ler o `SKILL.md` antes de agir; `references/` só sob demanda)

| Tarefa no Arenamon | Skills |
|---|---|
| Cena, renderer, loop, resize, OrbitControls, postprocessing | `threejs-scene-setup` |
| Materiais, luzes, sombras, bloom/emissivos | `threejs-materials-lighting` |
| GLB, esqueleto, mixer, clipes, animação procedural | `threejs-gltf-loading` |
| VFX, partículas, impacto, shake, hit-stop, juice | `game-feel`, `shader-programming` |
| Física, colisões, salto, knockback, tunagem | `physics-tuning` |
| IA, navegação, comportamento, utilidade | `game-ai`, `ai-behavior-trees-utility-ai` |
| Câmera (follow, lock-on, cinematográfica ZZZ) | `camera-systems` |
| FPS, draw calls, memória GPU, orçamento de quadro | `performance-optimization` |
| Depuração e testes | `performance-optimization` (profiling) + suítes `npm run test:combat-lab:*` |
| Roteador oficial quando incerto | `router` |

## Ignorar neste projeto
Skills específicas de Unity, Godot, Unreal, Roblox, Phaser, PixiJS, Bevy, pygame, LÖVE.
Nenhuma delas é dependência do Arenamon.

## Como usar no dia a dia
1. Tarefa nova → identifique a linha da tabela, leia o `SKILL.md` correspondente.
2. Pivotou de domínio (VFX → IA)? Releia a tabela.
3. Registre usos reais em `docs/GAMEDEV_SKILLS.md` (data, tarefa, skill, o que aplicou).
4. Entregáveis seguem `AGENTS.md` (portal, build, docs, versão).
