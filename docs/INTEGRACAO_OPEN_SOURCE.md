# Integração de ferramentas open source — Fases 1 a 5

Plano: `# ARENAMON — INTEGRA.txt` (5 fases). Este documento registra o que foi instalado,
verificado e entregue, com versões, licenças, motivos, arquivos, acesso, testes, limitações
e próximos passos. **Nada foi integrado à `main`**: tudo está na branch
`feat/ferramentas-open-source` (base: `feat/salto-footstool`, que contém câmera ZZZ,
salto 3D, footstool, passivas e a camada three.quarks).

> **Continuação (v1.13.0):** as melhorias de movimentação, colisão, física, hitbox e desenho feitas com estas skills estão em
> `docs/MELHORIAS_FISICA_COLISAO.md`.

## Panorama

| Fase | Ferramenta | Estado | Como abrir |
|---|---|---|---|
| 1 | GameDev Agent Skills | ✅ instalada em `.claude/skills/`, usada em tarefas reais | `docs/GAMEDEV_SKILLS.md` |
| 2 | three.quarks 0.17.1 | ✅ adaptador + laboratório + A/B no jogo | `dist/arenamon-vfx-quarks.html` |
| 3 | Yuka 0.7.8 | ✅ grafo com salto/queda + laboratório A/B + modo opcional na IA | `dist/arenamon-navegacao-yuka.html` |
| 4 | postprocessing 6.39.5 (sem React) | ✅ pipeline + laboratório A/B + camada opcional no jogo | `dist/arenamon-posprocessamento.html` |
| 5 | Rapier 0.21.0 (`rapier3d-compat`) | ✅ prova de conceito isolada (física principal intacta) | `dist/arenamon-fisica-rapier.html` |

(`dist/` = `prototypes/combat-lab/dist/`.) Todos os laboratórios abrem **pelo portal**
(`ABRIR_ARENAMON.html` → botões azuis, e `HTMLS_ARENAMON.html` → “Mais HTMLs”) e pelo
`TESTES_ARENAMON.html` (suítes com os comandos). No jogo, os controles ficam em
**Ajustes → IA · Navegação Yuka (experimental)** e **Ajustes → VFX · Pós-processamento (experimental)**.

Tudo que é opcional vem **desligado por padrão** (`extras.nav.enableNav = 0`,
`vfx.post.enabled = 0`, `vfx.quarks.enabled = 0`): com os padrões, o jogo se comporta
exatamente como antes (há teste provando isso para a navegação).

Fora de escopo por decisão do plano: Unity MCP, Godot MCP, React Three Fiber, React Drei,
React Three Rapier, Colyseus, TripoSR. Nenhuma dependência é carregada por CDN em runtime —
tudo entra nos HTMLs autocontidos via esbuild (`build-lib.mjs`, que também embute os
textos de licença no cabeçalho de cada bundle).

## Dependências, versões e licenças

| Pacote | Versão | Licença | Compatibilidade | Observação |
|---|---|---|---|---|
| three | 0.186.1 (já do projeto) | MIT | — | |
| three.quarks | 0.17.1 | MIT | peer `three >= 0.182` ✅ | Fase 2 |
| yuka | 0.7.8 | MIT | independe do three | Fase 3 |
| postprocessing | 6.39.5 | **Zlib** | peer `three >= 0.168 < 0.187` ✅ (0.186.1) | Fase 4; é o único que trava o teto do three (< 0.187) |
| @dimforge/rapier3d-compat | 0.21.0 | Apache-2.0 | WASM embutido em base64 | Fase 5 |
| awesome-gamedev-agent-skills | snapshot 2026-10-20 | Apache-2.0 | — | Fase 1 (`tools/gamedev-skills/`) |

Versões fixadas exatas (`--save-exact`) para yuka, postprocessing e rapier. Os arquivos de
licença de cada pacote entram no comentário inicial de cada HTML compilado. Antes desta
rodada, `@dimforge/rapier3d-compat 0.12.0` já existia em `node_modules` só como dependência
transitiva de `@types/three` (dev); agora a 0.21.0 é dependência direta e a antiga segue aninhada.

### Impacto no tamanho (HTML autocontido)

| Arquivo | Tamanho | Observação |
|---|---|---|
| `arenamon-combate-laboratorio.html` (jogo) | ≈11 185 → 11 573 KB (**≈ +390 KB**, aproximado: base = dist anterior do checkout oficial) | ≈ +320 KB da biblioteca postprocessing (medido) e ≈ +60 KB do Yuka + módulo `nav/` |
| `arenamon-vfx-quarks.html` | 1 199 KB | |
| `arenamon-navegacao-yuka.html` | 845 KB | |
| `arenamon-posprocessamento.html` | 1 353 KB | |
| `arenamon-fisica-rapier.html` | 5 089 KB | WASM (≈3 MB) em base64 (≈4,3 MB) |

O Rapier **não** entra no jogo principal (só no laboratório de física).

---

## Fase 1 — GameDev Agent Skills

- **Instalação (escopo do projeto, nada global):** fonte canônica versionada em
  `tools/gamedev-skills/` (11 skills + `router` + `arenamon-routing`, Apache-2.0 com `LICENSE`/`NOTICE`).
  `npm run skills:install` copia para **`.claude/skills/`** (pasta nativa do Claude Code, versionada)
  e para `.agents/skills/` (Codex/Gemini/Antigravity, ignorada pelo Git).
  `npm run skills:check` (também dentro de `npm run verify`) falha se a cópia divergir da fonte ou
  se algum `SKILL.md` tiver frontmatter inválido.
- **Correção desta rodada:** antes as skills estavam só em `.agents/skills/`, que o Claude Code **não**
  lê. Agora estão em `.claude/skills/`.
- **Roteamento:** skill `arenamon-routing` (descrição que dispara em qualquer tarefa de jogo):
  Three.js/WebGL, física e colisões, animação, game feel, IA, shaders/materiais, performance,
  depuração/testes, câmera. Regra no topo: **as regras do Arenamon vencem as skills**; Unity,
  Godot, Unreal, Roblox etc. são ignoradas.
- **Carregamento:** verificado estruturalmente (frontmatter, nome = pasta, cópia idêntica). O
  Claude Code descobre skills ao **iniciar a sessão**; esta sessão já estava aberta, então o
  carregamento efetivo só será visto na próxima sessão (`/skills`). Não foi possível rodar o CLI
  `claude` aqui para confirmar.
- **Uso real:** `docs/GAMEDEV_SKILLS.md` (registro com data, tarefa, skill e o que mudou no código).

## Fase 2 — three.quarks (já entregue; detalhes preservados)

Adaptador isolado (`src/view/quarks/`), 4 presets (carga, impacto, pouso, footstool), ponte que
consome os mesmos eventos do VFX legado, A/B no jogo (**Visualizar › Camada three.quarks**) e
laboratório com painel de edição (quantidade, duração, cor/gradiente, escala, velocidade,
direção, emissor, transparência, curvas, contínuo × explosão, posição/rotação) e
salvar/exportar/importar presets. O editor oficial `three.quarks-editor` está **arquivado**
(React + mui) e não foi integrado — substituído pelo painel próprio. 19 testes unitários.

## Fase 3 — Yuka: navegação com salto e queda

**O que é:** a IA atual só sabe andar em linha reta; contra um muro ela empurra a parede para
sempre e ataca alvos em plataformas altas como se estivessem no chão. A camada nova planeja a
rota **só quando o alvo não é alcançável em linha reta** e devolve apenas uma *intenção* de
movimento (e pedido de salto); a física continua toda do Arenamon.

**Arquitetura (`src/nav/`):**

```
nav-graph.js     Graph/NavNode/NavEdge/AStar do Yuka + grade de nós do chão e dos topos
                 (plataformas, obstáculos, destrutíveis). Arestas EXPLÍCITAS: walk | jump | drop.
                 Cache por assinatura do layout (destrutível quebrado reconstrói o grafo).
nav-planner.js   planeja (BFS de alcançabilidade + A*), segue a rota, suaviza cantos, decide o salto,
                 detecta travamento (penaliza a aresta e replaneja). Estado = JSON puro.
nav-assist.js    ponte com a IA: só mexe na intenção quando o alvo não está em linha reta; preserva
                 recuos da IA; não ataca alvo inalcançável. Desligado = devolve o comando intacto.
nav-scenarios.js 6 cenários sólidos + execução com métricas (laboratório e testes)
nav-debug.js     rotas e pontos de destino desenhados no jogo (Ajustes → mostrar rotas)
```

O Yuka **não** resolve salto/navegação vertical por conta própria: por isso as transições são
arestas do grafo (subida só se `altura ≤ jumpHeight − folga`; queda até 6 m; alcance horizontal do
salto configurável). Alvo em altura incompatível (ex.: bloco de 3,5 m) → status `unreachable`: o
perseguidor vai ao ponto alcançável mais próximo, para, e **não** ataca.

**Cenários e resultados medidos** (30 s simulados, IA ofensiva; navegação atual × Yuka):

| Cenário | Atual | Yuka |
|---|---|---|
| Muro entre os lutadores | nunca chega (25 s empurrando a parede) | chega em 4,7 s |
| Corredor estreito (1,8 m) | chega | idêntico (caminho livre → não interfere) |
| Rotas alternativas + zona bloqueada | nunca chega (24 s na parede) | chega em 5,6 s |
| Plataforma de 1,5 m | 12 ataques no vazio | pula (1–2 saltos), chega, 0 ataques no vazio |
| Alvo em bloco de 3,5 m | 12 ataques no vazio | para ao pé, 0 ataques, 0 s na parede |
| Arena completa | nunca chega | chega em 6,6 s |

**Desempenho:** grafo da arena de testes 1 417 nós / 10 590 arestas em ≈18 ms (só quando o layout
muda); replanejamento ≈0,6 ms por chamada (amortizado ≈0,012 ms por passo de 120 Hz).

**Acesso:** `dist/arenamon-navegacao-yuka.html` — escolha o cenário, alterne **Atual × Yuka**,
Iniciar; clique no piso move o alvo, Shift+clique move o perseguidor; mostra nós, arestas
(caminhada/salto/queda), rota atual e trilha; botão **Comparar A/B** executa as duas navegações e
tabela os resultados; sliders do grafo (espaçamento, alcance do salto, folga, decolagem, replan,
travamento). No jogo: **Ajustes → IA · Navegação Yuka (experimental)** (liga a navegação para a IA
do vermelho e do azul-IA; “mostrar rotas” desenha a rota).

## Fase 4 — postprocessing (pmndrs, sem React)

**Pipeline (`src/view/post/`):** `post-params.js` (padrões, acessibilidade e pulsos de evento — puro,
testável) e `post-pipeline.js` (`EffectComposer` sobre o MESMO renderer/cena/câmera; passes criados só para
os efeitos ligados): bloom **por limiar** (só o que passa do limiar brilha; a arena escura não) ou **por
seleção** (só objetos de energia), distorção de tela (onda de choque) em impactos com dano ≥ limite,
aberração cromática discreta com pulso no impacto, color grading (matiz/saturação/brilho/contraste),
vinheta e profundidade de campo (só no K.O. quando “só cinemático” está ligado). O pulso de bloom
(“reforço em ataques”) vem dos mesmos eventos do VFX (impacto, clash, carga).

**Compatibilidade com a câmera ZZZ:** letterbox, speedlines e a camada de impact-frame são **DOM** sobre o
canvas — o pós não as toca (HUD e overlays legíveis). Durante o impact frame (silhueta pura, fases
`white`/`invert`) o jogo **desvia do pós** e usa `renderer.render` (teste prova 0 quadros pelo pipeline
nessa janela). Nenhum efeito cinematográfico aprovado foi alterado.

**Acessibilidade** (as mesmas opções do jogo): *sem flash* remove o reforço de brilho e limita o bloom;
*reduzir movimento* remove distorção, pulso de aberração e DoF; *alto contraste* desliga bloom, vinheta,
grading, aberração e distorção (volta ao renderer atual).

**Acesso:** `dist/arenamon-posprocessamento.html` — comparação **Atual | Dividido | Pós** (divisor
ajustável), botões de evento (impacto forte, clash, carga, K.O.), evento **real** da simulação,
predefinições (Sutil/Cinemático/Intenso), acessibilidade, todos os parâmetros em sliders e **Medir
desempenho** (FPS, p95, tempo de envio ao WebGL e GPU quando o navegador expõe a consulta). No jogo:
**Ajustes → VFX · Pós-processamento (experimental)**.

**Desempenho medido:** neste PC o teste automatizado roda em renderização **por software** (SwiftShader):
≈41 fps sem pós × ≈14 fps com a cadeia completa; tempo de envio ao WebGL 0,5 → 1,1 ms. Esses números
**não representam uma placa de vídeo real** — o laboratório mede na sua máquina (o aviso de software
aparece quando detectado). Não foi medido em GPU real.

## Fase 5 — Rapier: prova de conceito (física principal intacta)

Rapier **não foi integrado ao jogo** e nenhum código de combate, controle ou estados foi migrado. O
laboratório isolado roda os mesmos 7 cenários (queda, salto para plataforma de 1 m, parede lateral com
quina, teto/laje flutuante, pilar cilíndrico, 40 m/s contra parede de 0,2 m, queda pela borda) em três
motores: **Arenamon (atual)**, **Rapier · caixa** (mesmo volume do Arenamon) e **Rapier · cápsula**. O
personagem Rapier é um `KinematicCharacterController` com gravidade assimétrica, salto variável, buffer e
controle aéreo copiados das constantes do jogo; só se compara a camada de colisão/gravidade (o “feeling”
continuaria sendo do Arenamon).

**Resultados** (`rapier.test.mjs`, 35 verificações):

| Medida | Arenamon | Rapier caixa | Rapier cápsula |
|---|---|---|---|
| Critérios dos 7 cenários | 13/13 | 12/13 | 13/13 |
| Penetração máx. (oráculo geométrico) | 0 (até 25 cm ao montar plataformas: tolerância de degrau do projeto) | < 1 cm | < 1 cm, exceto ≈13 cm no vão da borda (base curva: o oráculo vertical é conservador) |
| Tunelamento a 40 m/s (parede 0,2 m) | não atravessa (subpassos de contato) | não atravessa (shape-cast; com ou sem CCD) | idem |
| Repouso (tremor em y) | 0 mm | 0 mm | 0 mm |
| Altura de repouso | 0 | +5 mm a +10 mm (folga de contato) | +10 mm |
| Cilindro de frente | contorna (aproxima por círculo) | **trava** (caixa × curva) | contorna |
| Repetição / save-load / snapshot idênticos | 7/7 | 7/7 | 7/7 |

- **Achados que mudam a decisão:** (1) com personagem em caixa o Rapier trava de frente em cilindros —
  usar cápsula, o que muda a semântica de cantos e o oráculo; (2) sem *snap-to-ground* o personagem termina
  flutuando ≈5,7 cm ao descer de plataforma; (3) com *autostep* ele sobe degraus sem pular (o Arenamon não
  quer isso); (4) a física atual tolera até 25 cm de “montagem” por projeto; (5) a gravidade/jump feel e todo
  o resto (footstool, wall-splat, hitstop) teriam de ser reimplementados por cima.
- **Custo por passo** (mediana, Node, 120 Hz = orçamento de 8 333 µs): Arenamon `Game.step` completo ≈43–71 µs
  (só `stepPhysics` ≈6–7 µs); Rapier 2 personagens ≈37–56 µs; 50 personagens ≈420–540 µs. Ambos desprezíveis a 2
  lutadores; o ganho do Rapier só apareceria em muitos corpos/dinâmica (não necessário no combate 1×1).
- **WASM / offline:** `rapier3d-compat` embute o WASM em base64; inicia em ≈50–140 ms; o teste de navegador
  roda com a rede cortada e verifica **zero requisições externas**. Custa ≈4,3 MB no HTML (por isso fica fora
  do jogo principal). A build determinística (`rapier3d-deterministic`) não foi instalada: determinismo foi
  verificado só na mesma máquina/build, **não entre máquinas/navegadores**.
- **Custo de integração:** o cenário é declarativo e compartilhado (≈10 linhas para virar colisores Rapier);
  porém trocar a física exigiria reescrever `collideMapFighter`, `getGroundHeight`, teto, footstool e wall-splat
  e re-homologar toda a suíte.
- **Conclusão fundamentada:** **não adotar o Rapier agora** para o combate. Os ganhos reais (formas verdadeiras,
  shape-cast sem tunelamento, escala de corpos) não resolvem problema atual do Arenamon, enquanto o custo de migração e o risco
  de regressão são altos. **Adotar componentes no futuro** se surgirem: física dinâmica (caixas empurráveis,
  detritos), terreno inclinado/rampas, ou necessidade de muitos corpos. Caminho incremental sugerido: usar o
  Rapier só como **consulta de colisão** (ray/shape-cast) sob um adaptador, sem tocar nos estados.

**Acesso:** `dist/arenamon-fisica-rapier.html` — cenário, reprodução com 3 fantasmas coloridos e trilhas,
tabela de resultado e critérios, parâmetros (altura do salto e gravidades valem para as DUAS físicas; skin,
snap-to-ground, inclinação, autostep, CCD só no Rapier) e **bateria completa** (7 × 3 + determinismo + custo).

---

## Arquivos criados e modificados

**Novos:** `tools/gamedev-skills/arenamon-routing/`, `.claude/skills/*`, `scripts/install-skills.mjs`,
`prototypes/combat-lab/src/nav/*` (5), `src/view/post/*` (2), `src/physics-poc/*` (6),
`nav-lab/`, `post-lab/`, `physics-lab/` (template + estilos + main cada), testes `nav.test.mjs`,
`nav-lab.browser.mjs`, `post-params.test.mjs`, `post-lab.browser.mjs`, `post-game.browser.mjs`,
`rapier.test.mjs`, `physics-lab.browser.mjs`, evidências em `prototypes/combat-lab/evidence/`
(`nav-yuka-lab.png`, `post-lab-split.png`, `physics-rapier-lab.png`).

**Modificados (mínimo):** `sim/config.js` (`extras.nav`, `vfx.post`), `sim/ai.js` (campo `nav` no estado da Brain),
`sim/game.js` e `main.js` (gancho `assistNav`), `view/view.js` (diagnóstico de rotas e `renderPost`),
`ui/tuning.js` e `ui/tuning-meta.js` (controles), `build-lib.mjs`/`build.mjs` (3 labs novos + licenças embutidas),
`package.json`/`package-lock.json` (dependências, scripts e versão 1.12.0), portais (`ABRIR_`, `HTMLS_`, `TESTES_ARENAMON.html`).
Não foram tocados: Animation Studio, modelos de personagens, regras de combate, física, balanceamento da IA.

## Testes executados

| Verificação | Resultado |
|---|---|
| `nav.test.mjs` (grafo, cenários, determinismo, save/load, orçamento) | 20/20 |
| `nav-lab.browser.mjs` (offline, A/B, interface) | 9/9 |
| `post-params.test.mjs` (padrões, acessibilidade, pulsos) | 11/11 |
| `post-lab.browser.mjs` (cadeia, DoF, A/B, acessibilidade, medição) | 16/16 |
| `post-game.browser.mjs` (jogo real: criação sob demanda, impact frame, DOM, desligar/religar) | 12/12 |
| `rapier.test.mjs` | 35/35 |
| `physics-lab.browser.mjs` (offline, zero rede, bateria) | 11/11 |
| `npm run skills:check`, `check:offline` (10 HTMLs sem dependência externa), `tsc` do combat-lab | ✅ |
| Suíte unitária completa do combat-lab (`test:combat-lab:unit`) | ver relatório final |

## Limitações conhecidas

- **Yuka:** a grade 1,5 m perde passagens menores que ≈1,2 m entre sólidos; sem desvio de outros lutadores nem de
  projéteis; o planejador não usa o salto para fugir/atacar (só navegação); só testado em arenas com obstáculos
  retos (caixa/cilindro/plataforma). Em partidas padrão (mapa aleatório) só interfere se o caminho reto estiver bloqueado.
- **Pós-processamento:** bloom por limiar pode acender painéis claros da cena (o modo por seleção evita, mas no
  jogo os objetos de VFX não são registrados automaticamente); sem desempenho medido em GPU real; o pipeline reconstrói
  passes quando o conjunto de efeitos muda (pequeno engasgo ao ligar/desligar um efeito).
- **Rapier:** harness reimplementa locomoção simplificada (trajetórias não são comparáveis, só desfechos); determinismo
  entre máquinas não verificado.
- **Skills:** carregamento efetivo só confirmável na próxima sessão do Claude Code.
- **Escritor único:** o checkout oficial tinha outro agente editando; o trabalho foi feito em
  `.worktrees/open-source/` (worktree interno permitido pelo AGENTS.md). `npm run verify:workspace` recusa o worktree
  por desenho; rode `npm run verify` na pasta oficial depois do merge.

## Próximos passos (dependem de aprovação)

1. Aprovar a navegação Yuka no jogo: testar na pasta oficial com mapas reais e decidir se vira padrão da IA.
2. Aprovar o pós-processamento como camada visual opcional (e escolher a predefinição padrão).
3. Registrar automaticamente os objetos de VFX no bloom por seleção.
4. Medir pós-processamento em GPU real e revisar orçamento de quadro.
5. Rapier: só se surgir física dinâmica/rampas; começar por consulta de colisão sob adaptador.
6. Biblioteca de presets versionada para three.quarks/pós se os laboratórios forem adotados.
