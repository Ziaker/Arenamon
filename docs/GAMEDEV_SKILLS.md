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

  - **Cópia para o Claude Code em `.claude/skills/`** (pasta nativa de skills de projeto; versionada;
    `npm run skills:install` recria, `npm run skills:check` valida frontmatter e sincronia).
  - **Cópia para Codex/Gemini/Antigravity em `.agents/skills/`** (mesmo conteúdo; `.agents/` é
    gitignore do projeto, por isso a canônica fica em `tools/`).
  - Skill extra do projeto: `arenamon-routing` (mapa tarefa → skill, regras do Arenamon primeiro,
    ignora Unity/Godot/Unreal/Roblox).

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

### 2026-10-21 — Navegação Yuka (Fase 3)

- **Tarefa:** grafo de navegação com salto/queda, planejador e ponte com a IA (`src/nav/`).
- **Skill `game-ai` + `references/pathfinding.md`:** A* testa o objetivo ao **retirar** da fila (o `AStar`
  do Yuka faz isso — conferido no código-fonte do Yuka), heurística admissível (euclidiana; penalidade só
  AUMENTA custo de aresta, então segue admissível), **grafo de waypoints em vez de grade densa**, cache e
  replanejamento com orçamento (replan a cada 0,4 s, não a cada passo) e "navmesh engine não resolve off-mesh
  links": por isso saltos e quedas viraram arestas explícitas.
- **Skill `performance-optimization`:** *medir antes de otimizar* → `nav.test.mjs` §4 mede o grafo (≈18 ms para
  1 417 nós) e o replanejamento (≈0,6 ms) e fixa orçamento (< 150 ms e < 3 ms) dentro da verificação; grafo em
  cache invalidado por assinatura do layout ("memoize e invalide quando mudar").
- **Skill `physics-tuning`:** a alta velocidade (40 m/s) contra parede de 0,2 m virou cenário de teste
  (`speed/120 Hz = 0,33 m > espessura`), seguindo a regra "tunelamento = passo maior que o colisor".

### 2026-10-21 — Pós-processamento (Fase 4)

- **Tarefa:** pipeline pmndrs/postprocessing sobre o renderer do jogo (`src/view/post/`) e laboratório A/B.
- **Skill `threejs-scene-setup`:** `setPixelRatio` limitado, `setSize` com `updateStyle=false`, resize atualizando
  aspecto/projeção, `renderer.setAnimationLoop`/rAF único — repetidos no laboratório; composer recebe tamanho CSS
  (não multiplicado pelo pixel ratio — bug evitado conforme o padrão da skill).
- **Skill `threejs-materials-lighting`:** cores HDR (`toneMapped: false`, multiplicador > 1) apenas nos objetos de
  energia; arena fica no brilho normal, assim o bloom por limiar não "acende" o cenário.
- **Skill `game-feel` (faixas de importância/juice):** pulsos de evento com decaimento exponencial — impacto forte
  ≫ clash ≫ carga contínua; distorção só acima de dano mínimo; sem flash/movimento reduzido respeitados
  (a skill pede que juice nunca prejudique legibilidade).
- **Skill `camera-systems`/câmera ZZZ do projeto:** impact frame (silhueta) passa por fora do pipeline.
- **Skill `performance-optimization`:** laboratório mede FPS, p95 e tempo de envio, e **avisa** quando a
  renderização é por software (GPU real não medida).

### 2026-10-21 — Rapier (Fase 5)

- **Tarefa:** prova de conceito de física isolada (`src/physics-poc/`).
- **Skill `physics-tuning` + `references/timestep-and-ccd.md`:** passo fixo de 1/120 s nos dois lados, CCD só
  quando necessário (medido: o controlador cinemático já faz shape-cast; CCD ligado ou desligado não atravessa),
  "contato/offset pequeno e repouso sem tremor" (skin 1 cm, snap-to-ground) — a medição mostrou 5,7 cm de
  flutuação sem snap; checklist de estabilidade virou critérios de teste.
- **Skill `performance-optimization`:** custo por passo com mediana de várias execuções, orçamento de 8 333 µs a
  120 Hz e separação "física isolada × passo completo".
