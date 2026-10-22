# Balanceamento — Second Wind e Swift (medido com a IA)

Na medição dos 13 Moves, **Second Wind** e **Swift** deram vantagem clara à IA que os tinha (72% e 60% de vitórias contra IA sem Moves). Como os números deles são **provisórios** (MV-P09 e o catálogo, nada homologado), varri os sliders para mostrar quanto cada um pesa. **Nada foi alterado nos padrões**: a escolha é sua.

IA com o Move × IA sem Moves, 80 lutas por linha (lados alternados). Referência de "neutro": ≈ 50% × 41% (o resto são lutas sem desfecho).

| Move | Ajuste | Vitórias (com × sem) | Leitura |
|---|---|---|---|
| Second Wind | regeneração 0,40/s (padrão) | 64% × 31% | forte demais |
| Second Wind | 0,30/s | 54% × 38% | leve vantagem |
| Second Wind | 0,20/s | 50% × 41% | neutro |
| Second Wind | 0,10/s | 50% × 41% | neutro (o efeito some) |
| Second Wind | desconto de esquiva/sprint 25% ou 50% (regen 0,20) | 50% × 41% / 49% × 41% | o desconto quase não pesa |
| Swift | dano por estrela 3 (padrão) | 65% × 31% | forte demais |
| Swift | dano 2 | 54% × 39% | leve vantagem |
| Swift | dano 1,5 | 46% × 45% | neutro |
| Swift | 2 estrelas em vez de 3 | 45% × 45% | neutro |
| Swift | recarga 10 s em vez de 7 s | 60% × 28% | ainda forte (a recarga pesa pouco) |

**Sugestão (a decidir por você):** Second Wind com **0,30/s** e Swift com **dano 2** dão uma vantagem leve e sensata para quem usa o Move; reduzir mais deixa o Move sem efeito. A regeneração é o que pesa no Second Wind (o desconto de esquiva quase não muda nada), e no Swift pesam o dano e a quantidade de estrelas (a recarga quase não). Os sliders estão na aba Moves; reproduzir: `node prototypes/combat-lab/test/ia-balance-sweep.mjs`.

*Ressalva:* é a IA jogando, não um jogador humano; o peso real pode diferir.
