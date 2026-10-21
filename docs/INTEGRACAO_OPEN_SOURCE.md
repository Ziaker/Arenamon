# Integração de ferramentas open source — Fases 1 e 2

Plano: `# ARENAMON — INTEGRA.txt` (5 fases). Este documento registra o que foi
instalado, verificado e entregue nas **Fases 1 e 2** (executadas nesta rodada),
com versões, licenças, motivos, arquivos, acesso, testes, limitações e próximos passos.

## Panorama

| Fase | Ferramenta | Estado |
|---|---|---|
| 1 | GameDev Agent Skills (gamedev-skills/awesome-gamedev-agent-skills) | ✅ concluída |
| 2 | three.quarks (Alchemist0823/three.quarks) | ✅ concluída |
| 3 | Yuka (navegação/IA) | ⏳ pendente (módulo separado) |
| 4 | postprocessing pmndrs (SEM React) | ⏳ pendente (módulo separado) |
| 5 | Rapier (só prova de conceito; sem migrar a física principal) | ⏳ pendente |

Fora de escopo por decisão do plano: Unity MCP, Godot MCP, React Three Fiber,
React Drei, React Three Rapier, Colyseus, TripoSR. Nenhuma dependência é carregada
por CDN em runtime — tudo entra no HTML autocontido via esbuild (`build-lib.mjs`).

---

## Fase 1 — GameDev Agent Skills

- **O que é:** catálogo de skills de desenvolvimento de jogos para agentes de IA
  (roteador + skills de three.js, game feel, física, IA, shaders, câmera, performance).
- **Fonte:** https://github.com/gamedev-skills/awesome-gamedev-agent-skills · **Licença: Apache-2.0**
  (copiada em `tools/gamedev-skills/LICENSE` com `NOTICE` e `README.md`).
- **Instalação (forma oficial):** copiar as pastas `<nome>/` com `SKILL.md` para o
  diretório de skills + instalar o `router`. Cópia feita **no escopo do projeto**
  (nada global): canônica versionada em `tools/gamedev-skills/` (11 skills + router,
  265 KB, com LICENSE/NOTICE/README) e cópia operacional em `.agents/skills/`
  (gitignored, mesmo conteúdo).
- **Roteamento:** `tools/gamedev-skills/ROUTING_ARENAMON.md` (cópia operacional; origem em
  `tools/gamedev-skills/router/`) — fingerprint do projeto (three.js 0.186,
  HTML autocontido) e mapa tarefa → skill; as regras do Arenamon têm prioridade.
- **Uso real registrado:** `docs/GAMEDEV_SKILLS.md` (as skills `threejs-scene-setup`
  e `game-feel` foram lidas e aplicadas na construção do laboratório e dos presets
  da Fase 2 — satisfeito o critério de demonstrar tarefa técnica real).

## Fase 2 — three.quarks

- **O que é:** sistema geral de partículas GPU para three.js (instanciamento em
  lote, curvas de vida, emissores, serialização de presets).
- **Fonte:** https://github.com/Alchemist0823/three.quarks · **Licença: MIT**
  (arquivo `node_modules/three.quarks/LICENSE`).
- **Versões:** three.quarks **0.17.1** (mai/2026) · three do projeto **0.186.1** ·
  peer exigido `three >= 0.182.0` → **compatível**. Dependência interna `quarks.core`.
- **Instalação:** `npm install three.quarks@0.17.1` (raiz, package.json).
- **Editor oficial:** o repositório `three.quarks-editor` está **arquivado** (React +
  mui, sem manutenção) → **não integrado**; em vez dele foi construído um painel de
  edição próprio dentro do laboratório (parâmetros mínimos exigidos pelo plano:
  quantidade, duração, cor/gradiente, escala, velocidade, direção, forma do emissor,
  transparência, curvas de tamanho/intensidade, emissão contínua/explosão, posição e
  rotação relativas).

### Arquitetura (adaptador isolado — nada toca a simulação)

```
src/view/quarks/
  presets.js   4 presets declarativos (JSON puro): charge (A), impact (B),
               landing (C), footstool
  adapter.js   conversão pura preset → ParticleSystemParameters (testável em Node)
               + classe QuarksFx (BatchedRenderer, explosões, emissão contínua
               com intensidade crescente, reduceMotion, dispose sem vazamento)
  bridge.js    QuarksBridge: âncoras por lutador + consumo dos MESMOS eventos do
               VFX legado (impact, footstool, clash*, wallSplat, carga, lastLanding,
               meteor slam) → explode/continua na camada quarks
quarks-lab/    laboratório visual (template/styles/main) → dist/arenamon-vfx-quarks.html
```

### Integração com o combate (A/B)

- Config: `C.vfx.quarks.enabled` (default **0 = desligado, custo zero** — nada é
  instanciado). Controle no jogo: **Visualizar › Camada three.quarks (experimental)**
  e em **Ajustes › VFX · three.quarks (experimental)**.
- Quando ligada, a camada **coexiste** com o VFX aprovado (comparação A/B lado a
  lado); não substitui nenhum efeito automaticamente. Respeita o mestre de VFX da
  HUD (`hud.fxVisible`), pausa (congela junto) e acessibilidade (movimento reduzido
  reduz a quantidade de partículas).
- `view/view.js` cria a ponte sob demanda e a descarta ao desligar.

### Laboratório visual (critérios de conclusão do plano)

`prototypes/combat-lab/dist/arenamon-vfx-quarks.html` (offline, ~1,1 MB):

- Efeitos A (carga orbital com intensidade crescente e encerramento controlado),
  B (explosão radial com faíscas e dissipação), C (poeira de pouso proporcional à
  intensidade física do contato) e footstool (efeito separado).
- Painel com todos os parâmetros mínimos + presets: salvar/carregar em
  localStorage, exportar/importar JSON, restaurar padrão.
- **Gatilho por evento real da simulação:** botão “Evento real da simulação” roda
  um `Game` real (tackle carregado → impacto; queda sobre o rival → footstool +
  pousos) e dispara os efeitos a partir dos eventos — mesmo caminho da ponte do jogo.

## Acesso (2 cliques a partir dos portais)

- Portal: `ABRIR_ARENAMON.html` → seção do Combat Lab → “✨ Laboratório VFX · Quarks”.
- Testes: `TESTES_ARENAMON.html` → suíte “VFX three.quarks”.
- Direto: `prototypes/combat-lab/dist/arenamon-vfx-quarks.html`.

## Testes executados

| Verificação | Resultado |
|---|---|
| `node prototypes/combat-lab/test/quarks.test.mjs` (19 testes: conversão, serialização round-trip, runtime, reduceMotion, reset/dispose, toggle, **eventos reais de impacto/footstool/carga/pouso**) | ✅ 19/19 |
| Suíte incluída nas cadeias `test:combat-lab:unit` e `test` do package.json | ✅ |
| `npm run build:combat-lab` (laboratório + painel + quarks autocontidos) | ✅ |
| Smoke Playwright do laboratório quarks (explosão, carga 3 s, simulação real, presets, zero erros de console) | ✅ |
| Smoke Playwright do jogo com `vfx.quarks.enabled = 1` (abas do painel, toggle via tuning, zero erros) | ✅ |

## Licenças e versões (registro)

| Ferramenta | Versão | Licença |
|---|---|---|
| three.quarks | 0.17.1 | MIT |
| quarks.core (deps) | (via three.quarks) | MIT |
| three | 0.186.1 (projeto) | MIT |
| awesome-gamedev-agent-skills | snapshot 2026-10-20 | Apache-2.0 |

## O que NÃO integrou (e por quê)

- **Editor oficial three.quarks-editor:** repositório arquivado, stack React/mui
  incompatível com a arquitetura autocontida — substituído pelo painel próprio do
  laboratório (edição real de parâmetros, prévia, exportação/importação).
- Fases 3–5: fora do escopo desta rodada (dependem de aprovação/ordem do plano).

## Limitações conhecidas

- A camada quarks roda **ao lado** do VFX aprovado; a decisão de promover algum
  efeito ao renderizador principal é do responsável (A/B manual).
- Presets do laboratório vivem no localStorage do navegador (exportável em JSON);
  ainda não há biblioteca de presets versionada no repositório.
- Duas instâncias de carga simultâneas (azul e vermelho) são suportadas por chaves
  separadas (`charge#0`, `charge#1`).

## Próximos passos (dependem de aprovação)

1. Fase 3 (Yuka) e Fase 4 (postprocessing) em módulos separados, sem CDN/React.
2. Fase 5 (Rapier) apenas como prova de conceito isolada — sem migrar a física.
3. Biblioteca de presets versionada se o laboratório for adotado no pipeline.
