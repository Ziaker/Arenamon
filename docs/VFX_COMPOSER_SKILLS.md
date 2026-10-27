# Skills do Arenamon VFX Composer

## Estado em 27 de outubro de 2026

O conjunto do Composer foi verificado no workspace oficial. A fonte versionada das skills do Arenamon fica em `tools/gamedev-skills/`; as cópias consumidas pelos agentes ficam em `.claude/skills/` e `.agents/skills/`.

## Skill específica

`arenamon-vfx-composer` foi criada para preservar as fronteiras e os gates F0–F5. O teste RED sem a skill iniciou Quarks e runtime na F2. O teste GREEN com a skill corrigiu o roteiro: F2 ficou restrita a timeline, animação, texturas e materiais; partículas/Quarks permaneceram na F3.

Fonte versionada: `tools/gamedev-skills/arenamon-vfx-composer/SKILL.md`.

## Skills verificadas para o Composer

| Skill | Origem | Estado |
|---|---|---|
| `arenamon-vfx-composer` | Arenamon | criada, validada e instalada localmente |
| `arenamon-routing` | Arenamon | disponível |
| `threejs-scene-setup` | Arenamon | disponível |
| `threejs-materials-lighting` | Arenamon | disponível |
| `shader-programming` | Arenamon | disponível |
| `performance-optimization` | Arenamon | disponível |
| `game-feel` | Arenamon | disponível |
| `camera-systems` | Arenamon | disponível |
| `threejs-gltf-loading` | Arenamon | disponível |
| `playwright` | catálogo oficial `openai/skills` | instalada em `.agents/skills/` |
| `frontend-design` | `dobromirdikov/codex-frontend-design-skill` | instalada em `.agents/skills/` |

`physics-tuning`, `game-ai` e skills de outros motores não pertencem ao conjunto principal do Composer.

## Verificação

```powershell
npm run skills:check
python C:\Users\zerke\.codex\skills\.system\skill-creator\scripts\quick_validate.py tools\gamedev-skills\arenamon-vfx-composer
```

O `skills:check` valida as skills versionadas do projeto. As duas skills externas são instalações locais reproduzíveis a partir das origens acima e não substituem os testes `*.browser.mjs` do repositório.
