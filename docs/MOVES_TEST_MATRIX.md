# Matriz de testes dos Moves (regra → teste)

> Criada na Fase 0 do plano (`PLANO_IMPLEMENTACAO_REFLECT_PSYSHOCK.md`). Liga cada grupo de decisões de `MOVES_DECISOES_RODADAS.md` ao teste que o verifica. **Estados:** `caracterizado` = teste existente que documenta o comportamento **atual**; `existente` = teste anterior à Fase 0; `planejado` = teste ainda não escrito (fase indicada); `visual` = só homologação jogável do diretor (M28.9). Nada aqui significa que a regra já esteja implementada: **Reflect e Psyshock não estão implementados.**
> Atualize esta tabela a cada fase (estado, arquivo do teste, resultado).

## Infraestrutura já existente (anterior aos Moves reais)

| Garantia | Teste | Estado |
|---|---|---|
| Registro vazio; slots vazios não alteram a partida | `test/moves.test.mjs` | existente |
| Entidades (projétil, barreira, parede, área), status, linha do tempo, save/load, determinismo | `test/moves.test.mjs` | existente |
| Cópia congelada do modelo e da definição registrada | `test/moves-contract.test.mjs` | caracterizado (Fase 0) |
| Limite de entidades vale na criação | `test/moves-contract.test.mjs` | caracterizado (Fase 0) |

## Contrato M28.4 e ordem das entradas (Fase 0)

| Regras | Teste | Estado | Resultado em 2026-10-16 |
|---|---|---|---|
| **M28.4** sliders só valem para usos posteriores | `test/moves-contract.test.mjs` | caracterizado | **11 de 12** leituras de `C` ainda alteram entidades já criadas (corpo, altura, arena, lançamento, defesa, guard stun, passo de contato); precisam virar parâmetros capturados nas Fases 2–3 |
| **M30.9** ordem defesa → X/C → soltar o Move (base atual) | `test/moves-order.test.mjs` | caracterizado | ordem atual registrada: defesa é aplicada primeiro, mas X/C/slot pedido no mesmo passo prevalece; slot só entra se não houve X/C |

## Por fase (planejado)

| Fase | Regras (IDs) | Teste | Estado |
|---|---|---|---|
| 1 Charge | M2.4–M2.6, M7.1–M7.5, M7.9, M15.1–M15.4, M16.1–M16.8, M17.8, M26s.8, M27.1, M27.4, M30.9, M5.8–M5.9 | `test/charge.test.mjs` | planejado |
| 2 Reflect | M1.2–M1.3, M3.1–M3.6, M4.1–M4.6, M4.10, M5.1–M5.4, M7.6–M7.8, M8.6–M8.8, M10.6–M10.7, M13.1–M13.7, M14.1–M14.8, M17.2–M17.4, M17.7, M26s.1–M26s.4, M27.2, M29.2, M30.4–M30.7 | `test/reflect.test.mjs` | planejado |
| 3 Psyshock | M1.4–M1.7, M4.7–M4.9, M5.5, M6.1–M6.4, M8.1–M8.3, M9.1–M9.3, M10.1–M10.5, M11.1–M11.7, M12.1–M12.6, M26s.5–M26s.7, M27.3, M27.5, M29.3, M30.1–M30.3, M30.8 | `test/psyshock.test.mjs` | planejado |
| 4 PL / Clash / Counter | M18.1–M18.9, M19.1–M19.9, M20.1–M20.9, M21.1–M21.9, M22.1–M22.9, M9.5 | `test/pl.test.mjs` | planejado |
| 5 IA | M15.7–M15.8, M27.6, seção 8 do registro | `test/ai-moves.test.mjs` (+ `ai`, `ai-eval` sem regressão) | planejado |
| 6 Laboratório | M16.7, M27.7–M27.8, M28.2–M28.3, M28.5–M28.9 | `test/*.browser.mjs` + homologação | planejado / visual |
| 7 Lasers (opcional) | M3.5, M9.6, M17.5–M17.7, M20.6 | `test/beam.test.mjs` | planejado |

## Regras sem teste automatizável (decisão ou calibração)

- **M30.10 (valores provisórios):** verificados só pela existência dos parâmetros configuráveis e pela marcação “provisório”; a sensação (leque, inércia, VFX) é **homologação do diretor**.
- **P11, P13–P15:** pendências abertas; o teste correspondente só pode ser escrito quando a decisão sair.
- **Invariante transversal (todas as fases):** com registro vazio ou slots vazios a partida é **idêntica à atual** (regressão por estado, lutas IA × IA de semente fixa).
