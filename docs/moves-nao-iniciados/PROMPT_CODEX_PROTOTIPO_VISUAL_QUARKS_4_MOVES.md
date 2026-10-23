# Prompt para o Codex — protótipo VISUAL (Quarks) dos 4 Moves elementais

> Cole o texto abaixo no Codex. Escopo: **só visual**. Nada de regra de jogo, dano, IA ou motor.

---

Você vai trabalhar no repositório Arenamon (pasta oficial; leia `AGENTS.md` antes de editar e siga o protocolo: `git status --short --branch`, `git fetch origin`, `npm run verify:workspace`). Responda sempre em português do Brasil.

## Objetivo
Fazer **um protótipo visual para cada um dos 4 Moves elementais, usando o three.quarks** (não partículas feitas à mão). O usuário quer **ver e ajustar o efeito**, não jogar o Move. **Não implemente mecânica**: nada em `src/sim/`, nada de dano, colisão, stamina, cooldown, IA, loadout ou slots.

Moves e o visual esperado (provisório, o usuário vai ajustar):
1. **Water Pulse (Água):** esfera de água azul-clara, com 2–3 anéis finos girando ao redor, gotas soltas e rastro de respingos. Três intensidades: PL1, PL2, PL3 (maior, mais anéis, mais gotas, brilho mais forte).
2. **Fire Spin (Fogo):** coluna/redemoinho de fogo no chão, com chamas subindo em espiral, brasas e anel de calor no solo que pulsa. Início (brotando), sustentação e fim (apagando).
3. **Air Slash (Voador):** lâmina de ar em crescente, branca/azul-pálida, com rastro de vento e linhas de velocidade, e um pequeno estouro ao sumir.
4. **Seed Bomb (Grama):** semente verde/marrom em arco com rastro de folhinhas; ao bater, explosão esférica verde com folhas e poeira.

## Passo 0 — o laboratório de VFX Quarks hoje não reproduz nada
O usuário reportou que o laboratório de VFX Quarks "nem funciona direito, nenhum VFX é reproduzido". Um diagnóstico anterior achou **dois bugs no adaptador**, em `prototypes/combat-lab/src/view/quarks/adapter.js`:
1. `bezierFn`: `new PiecewiseBezier([[new Bezier(...), 1]])` — o segundo valor é o **início** do segmento e deve ser `0` (com `1` a curva nunca é avaliada para t < 1).
2. `new Quarks.ParticleEmitter(system)` (3 ocorrências em `QuarksFx`): o `ParticleSystem` já cria o emissor; use `system.emitter`.

Confirme os bugs lendo o código e a versão instalada do three.quarks, **aplique a correção e prove em navegador que um preset existente passa a aparecer** (captura de tela) antes de criar qualquer coisa nova. Se o diagnóstico estiver errado, diga o que achou de verdade.

## O que entregar
- Presets novos em `prototypes/combat-lab/src/view/quarks/presets.js` (e o que mais o adaptador exigir), um por Move (Water Pulse com PL1/2/3).
- Uma **tela de pré-visualização acessível pela interface** (no painel de VFX do laboratório de combate, ou página própria linkada): lista dos 4 Moves, botão **Reproduzir**, **Repetir em loop**, seletor de PL (Water Pulse), fundo neutro para ver o efeito isolado. Sem depender de partida, loadout ou de ter o Move equipado.
- **Todo valor importante com controle visível** (slider/seletor com nome e unidade): cor, tamanho, quantidade, velocidade, duração, intensidade/brilho, número de anéis, etc. Nada importante só no código.
- Respeitar as opções de acessibilidade já existentes (sem flash / movimento reduzido).
- Manter o jogo funcionando sem o Quarks se ele não carregar (comportamento atual do adaptador).

## Regras do projeto (resumo do `AGENTS.md`)
- Entrega acessível em até 2 cliques a partir de `ABRIR_ARENAMON.html`: **adicione o link no portal** e documente em `docs/` (ex.: `docs/MOVES_ELEMENTAIS_VISUAL_QUARKS.md`).
- Recompile antes de entregar: `npm run build:combat-lab` (e outros `build` afetados). Diga qual arquivo abrir (`JOGAR_ARENAMON.html` / `prototypes/combat-lab/dist/arenamon-combate-laboratorio.html`).
- Evidências (capturas) em `prototypes/combat-lab/evidence/<nome>/`, nunca só em pasta temporária.
- Não mexa no que não foi pedido (Animation Studio, motor de combate, IA, balanceamento).
- Não rode baterias de teste longas sem necessidade; rode `npm run typecheck`, os testes do Quarks (`quarks.test.mjs`) e os que o seu código tocar. Valide no navegador com capturas.
- Sem force push. Commit descritivo, push na sua branch e compare `git rev-parse HEAD` com o remoto.

## Observação sobre o PR #94
O PR #94 (branch `claude/elegant-carson-vzdxvo`) implementou a mecânica dos 4 Moves por engano. **Não dependa dele nem o use como base**: parta da `main`. Se quiser, use `prototypes/combat-lab/src/view/elemental-fx.js` e `src/sim/config.js` (grupos `waterPulse`, `fireSpin`, `airSlash`, `seedBomb`) só como referência de tamanhos (raio da esfera, da zona, etc.).

## Resposta final
Em português claro: o que mudou, **qual arquivo abrir e onde clicar**, o que foi testado e o que **não** foi verificado (por exemplo, desempenho em máquinas lentas).
