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

### 2026-10-21 — Melhorias de física, colisão, hitbox e desenho (v1.13.0)

- **Tarefa:** varredura medida do jogo e correções (`docs/MELHORIAS_FISICA_COLISAO.md`).
- **Skill `physics-tuning`:** (a) *tunelamento: distância por passo < colisor mais fino* → `tunneling.test.mjs` prova que parede de 0,2 m
  segura a 90 m/s e mostra o limite quando `contactStep` é absurdo; (b) *interpolar o desenho entre passos fixos* → `sim/interpolation.js`
  (só visual, restaura a simulação); (c) *contato/offset e tolerâncias como parâmetro* → `map.mountTolerance` virou slider; (d) *testar
  em estresse* → varredura de 30 partidas achou lançados atravessando até 1 m de plataformas (regra `risesOver` só para salto voluntário).
- **Skill `game-feel`:** *faixas de importância* → hitstop proporcional ao dano (opt-in); feedback fica fora da simulação crítica
  (interpolação não altera o estado; teste compara a simulação ligada × desligada).
- **Skill `performance-optimization`:** *medir antes de mexer*: oráculo + varredura geraram números antes/depois (1,00 m → 0,23 m; alcance 6,2 → 5,7 m).


### 2026-10-21 — Laboratório HUD de progressão e consumíveis (v1.14.6)

- **Tarefa:** protótipo visual de 3 HUDs (5 atributos, estágios 0–4) e 3 coleções de 7 consumíveis (`docs/HUD_CONSUMIVEIS_LAB.md`).
- **Skill `threejs-scene-setup`:** *renderer + `setAnimationLoop`/resize + OrbitControls com limite polar* → arena com câmera interativa
  e presets animados; *PMREM de `RoomEnvironment`* para o metal da coleção C funcionar offline.
- **Skill `threejs-materials-lighting`:** *flat shading + emissivo* (coleção A), *`MeshToonMaterial` com gradiente de 3 tons e contorno de
  casco invertido* (B) e *PBR metálico com faixas emissivas* (C); luz direcional com sombra e duas luzes de recorte.
- **Skill `game-feel`:** *squash & stretch e saltitar elástico* (B), pulsos de emissão (A/C) e animação ao ganhar estágio nos HUDs.
- **three.quarks:** emissores localizados por coleção (cada `ParticleSystem` já cria o próprio `emitter`; usar `system.emitter`, e não um
  `new ParticleEmitter(system)` separado, que fica fora da cena e é descartado no primeiro `update`).

### 2026-10-21 — Laboratório HUD de vida, stamina e moves (v1.15.5)

- **Tarefa:** protótipo visual de 3 HUDs (Impacto, Quadrinhos, Clássico) para vida, stamina e 4 moves (`docs/HUD_VIDA_STAMINA_MOVES_LAB.md`).
- **Skill `threejs-scene-setup`:** *renderer + loop + resize + OrbitControls com limite polar* e presets de câmera com interpolação (testar o HUD
  de vários ângulos); *`ResizeObserver` no palco* porque a gaveta de controles muda a largura útil.
- **Skill `threejs-materials-lighting`:** três temas de arena (escuro, claro, quente) trocando textura do piso, cor dos blocos e intensidade das
  luzes, para checar a legibilidade dos HUDs contra fundos diferentes.
- **Skill `game-feel`:** *feedback legível por forma e movimento, não só por cor* (carga treme, vida crítica pulsa, selecionado avança).
- **Superpowers:** `brainstorming` (dispensada pelo pedido de execução direta), `verification-before-completion` (verify de navegador antes de declarar pronto).

- 2026-10-22 — Reconstrução visual de Water Pulse, Fire Spin e Air Slash: `arenamon-routing`, `game-feel` e `shader-programming`; aplicados envelopes de nascimento/dissipação, UVs animadas, Fresnel, ruído e faixas curvas. Partículas continuam em three.quarks; prévia sem mecânica.
- 2026-10-23 — Integração dos controles visuais no jogo: `arenamon-routing`, `game-feel`, `shader-programming` e `threejs-materials-lighting`; opacidade mestre no shader, mais brilho/escala para Air Slash e ancoragem temporal dos efeitos de disparo após 0,3 s.

- 2026-10-23 — Plano de 15 melhorias (IA, Moves, depuração, desempenho): `arenamon-routing` (invocada; roteou para as duas abaixo), `performance-optimization` (SKILL.md lido; método medir → achar o gargalo → só então mexer: `bench-moves.mjs` mede a simulação com carga de Moves e conclui que ela usa no máximo ~3% do orçamento de 8333 µs, sem propor otimização) e `game-ai` (SKILL.md lido; separação decidir/mover/rotear: o perfil tático declarativo só decide "vale a pena agora", permissão e movimento continuam no controlador). Superpowers: TDD aplicado à mão (RED sintético → GREEN em `moves-contracts`, `move-matrix`, `replay-diff`, `bug-capture`, `ai-profile`), sem invocar as skills `test-driven-development`/`writing-plans` pela ferramenta Skill. Claude Superskills (`ericgandrade`): não está entre as skills disponíveis nesta sessão; nada foi instalado.

### 2026-10-27 — VFX Composer F1: vértices

- **Tarefa:** restaurar com escopo mínimo o Composer preservado no stash `backup-pre-main` e continuar a autoria geométrica sem aplicar mudanças alheias.
- **Skills:** `arenamon-routing` manteve o trabalho isolado no editor Three.js offline; `test-driven-development` guiou testes RED/GREEN para inclusão e remoção validada de pontos.
- **Resultado:** `DocumentStore` inclui/remove vértices com limites, snapping, degeneração, Undo/Redo e autosave; controles visíveis foram ligados ao HTML compilado e verificados no Edge offline.
- **Desenho no viewport:** `threejs-scene-setup` orientou o raycasting da câmera para um plano XZ e o bloqueio temporário do OrbitControls; a prévia usa recursos descartáveis e a finalização cria uma única operação autoral.
- **Arquivos F1:** TDD cobriu substituição validada e reversível no `DocumentStore`; o teste Edge verifica download JSON real, reimportação pela interface, reconstrução da hierarquia e Undo do projeto importado.
- **Pivô F1:** o contrato ganhou pivô local opcional e finito; a camada Three.js translada a geometria e compensa o objeto com `rotação × escala × pivô`, preservando visualmente o efeito e mantendo o gizmo coerente.
- **Extrusão F1:** Ribbon ganhou espessura autoral em metros e passou a usar `ExtrudeGeometry` com seção retangular ao longo da `CatmullRomCurve3`; projetos anteriores continuam compatíveis por padrão proporcional.
- **Superfícies F1:** raycasting foi restringido aos meshes autorais, evitando grade, gizmo e prévia; o teste Edge usa projeção câmera→tela para clicar deterministicamente no cubo e comprovar pontos fora do plano XZ.
- **F1.1 (27/10):** `arenamon-routing` preservou a fronteira visual; `threejs-scene-setup` orientou plano rotacionado, vistas determinísticas e controles de câmera; brainstorming e planning fecharam o escopo; TDD comprovou primeiro as APIs ausentes e depois os contratos de tapering, assistência geométrica, lock, seleção múltipla e UI offline.

### 2026-10-27 — Skill específica do VFX Composer

- **Inventário:** `npm run skills:check` confirmou as skills versionadas; as cópias `.claude` foram sincronizadas. `playwright` do catálogo oficial e `frontend-design` do repositório recomendado foram instaladas localmente em `.agents/skills/`.
- **RED:** sem a skill específica, um agente propôs iniciar emissores Quarks, adaptador runtime e partículas na F2, antecipando F3/F4.
- **GREEN:** com `arenamon-vfx-composer`, o mesmo cenário manteve F2 em timeline, animação, texturas e materiais e reservou Quarks para F3.
- **Fonte:** `tools/gamedev-skills/arenamon-vfx-composer/SKILL.md`; detalhes e proveniência em `docs/VFX_COMPOSER_SKILLS.md`.
