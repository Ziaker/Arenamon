# GameDev Agent Skills — instalação e uso no Arenamon

Registro da Fase 1 do plano de integração de ferramentas open source
(ver `docs/INTEGRACAO_OPEN_SOURCE.md` para o panorama das fases).

## Origem e licença

- Repositório: https://github.com/gamedev-skills/awesome-gamedev-agent-skills
- Licença: **Apache-2.0** (arquivo `tools/gamedev-skills/LICENSE`, copiado junto com
  `NOTICE` e o `README.md` do repositório).
- Forma de instalação oficial: copiar as pastas `<nome>/` (com `SKILL.md`) para o
  diretório de skills do agente e instalar o `router`. No nosso caso a cópia foi feita
  **no escopo do projeto** (nada global na máquina):
  - **Cópia canônica versionada** (entra no Git):

```
tools/gamedev-skills/
  LICENSE  NOTICE  README.md   # proveniência e licença Apache-2.0
  router/                       # roteador oficial (quais skills aplicam a qual tarefa)
  threejs-scene-setup/
  threejs-materials-lighting/
  threejs-gltf-loading/
  game-ai/
  ai-behavior-trees-utility-ai/
  game-feel/
  physics-tuning/
  performance-optimization/
  shader-programming/
  camera-systems/
```

  - **Cópia operacional** usada pelo agente em `.agents/skills/` (mesmo conteúdo;
    a pasta `.agents/` é gitignore do projeto, por isso a canônica fica em `tools/`).

## Roteamento — fingerprint do Arenamon

O roteamento do projeto está em `tools/gamedev-skills/ROUTING_ARENAMON.md`. Resumo do que vale para
qualquer agente que trabalhe aqui:

- Engine do combat-lab: **three.js 0.186** (empacotada em HTML autocontido via
  esbuild; nada de CDN em runtime).
- As regras do Arenamon (`AGENTS.md`, `docs/`, convenções do combat-lab) têm
  **prioridade** sobre as skills; skill é consulta, não ordem.
- Mapa tarefa → skill mais usado aqui:

| Tarefa | Skill |
|---|---|
| Cena three.js, loop de render, resize | `threejs-scene-setup` |
| Materiais, luzes, sombras | `threejs-materials-lighting` |
| Carregar .glb / animações | `threejs-gltf-loading` |
| IA de jogo | `game-ai`, `ai-behavior-trees-utility-ai` |
| Impacto, shake, hit-stop, juice | `game-feel` |
| Ajuste de física/knockback | `physics-tuning` |
| FPS, partículas, lotação | `performance-optimization` |
| Shaders | `shader-programming` |
| Câmera: follow, deadzone, orbit | `camera-systems` |

## Registro de uso real (critério de conclusão da Fase 1)

Cada entrada: data · tarefa · skill · o que foi aplicado de fato.

### 2026-10-20 — Adaptador e laboratório three.quarks (Fase 2)

- **Tarefa:** construir o laboratório de VFX com three.quarks
  (`prototypes/combat-lab/quarks-lab/`) e o adaptador isolado
  (`src/view/quarks/`).
- **Skill `threejs-scene-setup`:** seguido o padrão de cena do laboratório —
  `THREE.Scene` + `PerspectiveCamera` + `WebGLRenderer` com `setPixelRatio` limitado,
  loop com `renderer.setAnimationLoop`, handler de resize que atualiza
  `camera.aspect` + `updateProjectionMatrix()`, e `OrbitControls` com damping
  (`controls.update()` por quadro). Como o projeto usa bundler (esbuild), não há
  import map; os imports resolvem pelo `package.json`.
- **Skill `game-feel`:** os presets seguem o modelo de "faixas de importância" —
  charge = feedback contínuo de média intensidade, impacto = explosão curta com
  dissipadação, pouso = poeira proporcional à intensidade física real do contato
  (`lastLanding.vertical`), footstool = efeito separado de intensidade menor.
  Shake e flash permanecem no sistema legado; a camada quarks não toca a
  simulação nem a câmera (regra: juice nunca move o corpo simulado).
