# Plano de 15 melhorias: registro de prova, Gate 2 e skills (23/10/2026)

Cumpre o que o prompt do plano exige e que eu tinha deixado de fazer: lista efetiva de skills com proveniência, tabela FATO / INFERÊNCIA / HIPÓTESE / DECISÃO PENDENTE e registro de prova por etapa. Estado dos 15 itens: `docs/PLANO_15_MELHORIAS_STATUS_2026-10-23.md`. Plano do que falta: `docs/plans/2026-10-23-melhorias-restantes.md`.

## 1. Skills: o que existe, de onde veio e o que foi realmente usado

| Pacote / skill | Proveniência | Estado nesta sessão | Uso real |
|---|---|---|---|
| Superpowers 7.0.0 (`obra/superpowers` via `claude-plugins-official`) | plugin instalado em 21/10/2026 (`installed_plugins.json`) | carregado | `verification-before-completion` (invocada e seguida), `requesting-code-review` (invocada; revisão feita por subagente independente). **Não invocadas:** `writing-plans`, `test-driven-development`, `systematic-debugging` (o TDD foi feito à mão: RED sintético → GREEN). |
| Claude Superskills 2.0.8 (`ericgandrade/claude-superskills`) | `npx claude-superskills install -y`, rodado pelo responsável em 23/10/2026 | o instalador **não detectou o Claude Code** e instalou em `~/.gemini/skills` e `~/.antigravity`; copiei 5 para `~/.claude/skills` (`agent-skill-discovery`, `agent-skill-orchestrator`, `senior-solution-architect`, `writing-plans`, `executing-plans`). **Só aparecem numa sessão nova**: não estão carregadas nesta | **Nenhuma invocada.** Li o cabeçalho e o fluxo do `writing-plans` (formato do plano em `docs/plans/`) e os cabeçalhos das outras quatro. Segui o formato do `writing-plans` para escrever o plano restante, **sem** tê-lo invocado pela ferramenta Skill. |
| GameDev (`.claude/skills`) | versionadas no repositório | carregadas | `arenamon-routing`, `performance-optimization` e `game-ai` (SKILL.md lidos; aplicação em `docs/GAMEDEV_SKILLS.md`). |

## 2. Gate 2: fatos, inferências, hipóteses e decisões pendentes

| Tipo | Afirmação | Base |
|---|---|---|
| FATO | Os 5 commits `292b16c`..`366c961` + `57f76ee` estão no `origin/codex/elemental-quarks-visual`; local = remoto | `git rev-parse` após o push |
| FATO | 128 testes de simulação, 9 suítes de navegador, `tsc` e `check:offline` passam | execução em 23/10 (saídas no histórico da sessão) |
| FATO | `solid-vfx.browser` falha (2434 ms e 2164 ms contra o limite de 1500 ms) | duas execuções |
| FATO | `npm run verify` para em `skills:check` (`.claude/skills` difere da fonte) | execução; as pastas já estavam alteradas antes do trabalho |
| FATO | Nenhum teste novo estava no `npm test` real até `366c961` | `scripts/run-test-chain.mjs` |
| INFERÊNCIA | A falha de `solid-vfx` não vem das minhas mudanças (não toco em fumaça volumétrica) | leitura do diff; **sem prova**, a tentativa no commit `6d4ad50` não compilou na worktree |
| INFERÊNCIA | O desempenho da simulação não é gargalo (P95 ≤ ~3% do orçamento mesmo com 64 entidades) | `docs/DESEMPENHO_MOVES_2026-10-23.md`, **só CPU em Node** |
| HIPÓTESE | A CI em `windows-latest` com Node 22 passa | YAML validado e `.gitattributes` corrigido, **nunca executada** |
| HIPÓTESE | Migrar os outros 15 Moves para ficha é mecânico | o codemod funcionou nos 4 pilotos |
| DECISÃO PENDENTE | `riposte.knockbackH` 16,8 × slider 15; `riposte.cost` 0,8 × 1,55 | `moves-contracts.test.mjs` |
| DECISÃO PENDENTE | Trava contra velocidade infinita no motor | travamento observado na matriz |
| DECISÃO PENDENTE | A esquiva C encerra o guard stun | `codex/combos` |
| DECISÃO PENDENTE | Dica do Guard Break diz 14 HP; o valor é 6 | `guard-break.params.js`, `config.js` de `5b4343a` |
| DECISÃO PENDENTE | O que é «fase» de VFX em cada Move (#06); UX do Workbench (#03) | plano marca como `[proposta]` |
| DECISÃO PENDENTE | `solid-vfx`: corrigir a causa ou rever o limite de tempo | — |
| DECISÃO PENDENTE | Desenho em dois arquivos por Move (`<id>.js` + `<id>.params.js`) e formato v1 da captura de bug: escolhidos por mim sem apresentar alternativas (o plano manda apresentar em mudança estrutural) | `docs/COMO_CRIAR_UM_MOVE.md`; alternativa descartada: um arquivo só, que cria ciclo de módulos com `config.js` |

## 3. Registro de prova por etapa

Data de todas as linhas: 23/10/2026. «Skill real» = invocada pela ferramenta Skill; «segui» = li o SKILL.md e apliquei à mão.

| Etapa | Item | Skill | Comando / prova | Arquivo | Resultado | Limitação |
|---|---|---|---|---|---|---|
| 0 | #08 validador | segui TDD (RED sintético → GREEN) | `node prototypes/combat-lab/test/moves-contracts.test.mjs` | `src/sim/move-contracts.js` | 6 passam; 2 avisos conhecidos (riposte) | CI não rodou |
| 0 | #13 índice | — | `npm run indice` · `…/moves-indice.test.mjs` | `docs/INDICE_VIVO_MOVES.md` | 3 passam | não avisa PRs sobrepostos |
| 1 | #14 CI | — | `python -c "yaml.safe_load(...)"` | `.github/workflows/combat-lab.yml` | YAML válido | nunca executada no GitHub |
| 1 | #11 captura | segui TDD | `…/bug-capture.test.mjs`, `…/bug-capture.browser.mjs` | `src/sim/bug-capture.js` | 4 + 6 passam | captura visual opcional não feita |
| 1 | #12 replay | segui TDD | `…/replay-diff.test.mjs` | `src/sim/replay-diff.js` | 6 passam | sem gravações de referência guardadas |
| 2 | #01 ficha | segui `writing-plans` (formato) | `…/moves-fichas.test.mjs`, `…/moves-revisao.test.mjs` | `src/sim/moves/*.params.js` | 5 + 7 passam (paridade com os valores de `5b4343a`) | 4 de 19 Moves |
| 2 | #02 assistente | segui TDD | `…/move-spec.test.mjs`, `…/move-spec.browser.mjs` | `src/ui/move-spec-*.js` | 7 + 7 passam | — |
| 2 | #09 perfil IA | `game-ai` (lida) | `…/ai-profile.test.mjs` | `src/sim/ai-profile.js` | 4 passam, ~15 mil contextos iguais às regras antigas | 4 de 17 Moves |
| 3 | #04 / #05 / #07 | — | `…/move-timeline.test.mjs`, `…/collision-tools.test.mjs`, `…/move-ab.test.mjs`, `…/move-gizmos.browser.mjs` | `src/sim/move-*.js`, `src/view/collision-overlays.js` | passam | ninguém olhou as telas |
| 4 | #10 matriz | segui TDD (mutações) | `…/move-matrix.test.mjs` | `src/sim/move-matrix.js` | 8 passam; 208 ok / 0 falhas / 1 N/A por semente | faltam teto, borda, destrutível, refletir |
| 5 | #15 benchmark | `performance-optimization` (lida) | `npm run bench:moves` | `bench-moves.mjs` | 6 cenários, 5 repetições | só CPU em Node; 2 cenários com ruído alto (~25%) |
| fechamento | revisão | `requesting-code-review` (invocada) | subagente independente sobre `5b4343a..fcec8e4` | — | 1 crítico, 4 importantes, 9 menores; corrigidos em `366c961` | revisão não cobriu os commits de correção |
| fechamento | verificação | `verification-before-completion` (invocada) | `tsc`, testes, `check:offline` | — | ver Gate 2 | `verify` completo e `solid-vfx` pendentes |
