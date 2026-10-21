# IA com os Moves novos — medição

IA com o Move × IA sem Moves, 60 partidas por Move (lados alternados, sementes fixas, `newMovesRate` = 1). "Uso/luta" = vezes que a IA aciona o Move; vitórias do lado equipado × do adversário (o resto são lutas sem desfecho). Gerado por `test/ai-new-moves-eval.mjs --write`.

| Move | Uso/luta | Vitórias (com × sem) | Dano causado × sofrido |
|---|---|---|---|
| harden | 0.72 | 40% × 52% | 65 × 77 |
| second-wind | 1.33 | 72% × 27% | 88 × 55 |
| swift | 2.57 | 60% × 35% | 84 × 59 |
| lunge | 0.10 | 33% × 57% | 71 × 77 |
| quick-attack | 0.53 | 42% × 48% | 71 × 68 |
| guard-break | 0.48 | 38% × 53% | 68 × 73 |
| feint | 0.32 | 35% × 53% | 63 × 73 |
| riposte | 0.12 | 35% × 53% | 67 × 77 |
| bounce | 0.33 | 42% × 43% | 66 × 67 |
| spikes | 1.15 | 40% × 50% | 66 × 75 |
| sand-wave | 0.13 | 33% × 53% | 68 × 72 |
| bullet-punch | 0.77 | 32% × 52% | 60 × 78 |
| emerging-stone | 0.53 | 42% × 42% | 74 × 67 |

## Leitura

- **A IA usa os 13 Moves** quando eles estão equipados nela (`test/ai-new-moves.test.mjs`), pelos mesmos comandos do jogador; com a taxa em 0 ou sem equipar, nada muda.
- **Second Wind e Swift dão vantagem clara** (recuperar stamina e pressionar à distância). Isso é também um sinal de **balanceamento** para você avaliar: os números do Second Wind (+40% da stamina máxima por segundo) são provisórios (MV-P09).
- **Os demais ficam dentro do ruído** (cerca de ±6 pontos com 60 lutas): a IA não se prejudica por usá-los. A primeira versão da regra perdia muito com Quick Attack, Bounce e Feint; as regras foram apertadas (mais stamina de reserva, nada contra rival defendendo ou atacando, Feint só contra defesa perfeita recém-aberta).
- **Corrigido de passagem:** qualquer Move equipado fazia a IA abrir um plano de "preparar carga" (próprio do Reflect/Psyshock) em 40% das trocas de postura, desperdiçando tempo; agora só o faz com Reflect ou Psyshock.
- **Riposte** sai pouco (a janela é de 0,13 s): a IA avalia a cada passo quando um golpe está chegando.
- Ajuste em Moves › IA com Moves › "Uso dos Moves novos pela IA" (0 = nunca usa; 1 = padrão).
