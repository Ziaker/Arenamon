# Navegação (Yuka) na IA — medição

IA × IA, 100 partidas por lado e por mapa (sementes fixas, azul/vermelho alternados). "Com nav" = a IA daquele lado usa o planejador; "sem nav" = o adversário dela. Gerado por `test/nav-ai-compare.mjs --write`.

| Mapa | Vitórias com nav | Vitórias sem nav | Parado/luta (s) com × sem | Quedas/luta com × sem | Pressão ≤3 m (s) com × sem | Em voo (s) com × sem |
|---|---|---|---|---|---|---|
| padrão | 46% | 45% | 6.91 × 8.13 | 0.16 × 0.10 | 8.93 × 8.90 | 3.18 × 3.00 |
| muro | 48% | 42% | 6.74 × 6.98 | 0.00 × 0.00 | 9.32 × 9.25 | 2.97 × 3.28 |
| corredor | 38% | 49% | 7.18 × 7.56 | 0.00 × 0.00 | 9.35 × 9.43 | 3.36 × 3.02 |
| rotas | 36% | 46% | 7.72 × 10.67 | 0.00 × 0.00 | 10.19 × 10.24 | 3.31 × 3.05 |
| plataforma | 49% | 39% | 6.42 × 6.75 | 0.07 × 0.05 | 8.46 × 8.43 | 3.40 × 3.44 |
| completo | 6% | 7% | 29.26 × 25.27 | 0.04 × 0.01 | 12.21 × 12.23 | 0.82 × 0.74 |

## Leitura dos números

- **Com paredes entre os lutadores a IA comum quase não luta.** Sem navegação nos dois lados, só 6% das partidas do mapa "muro" e 3% do "rotas" terminam com vencedor (o resto esgota o tempo sem os dois se encontrarem). Com navegação nos dois lados, 80% a 73% delas têm vencedor (`test/nav-ai.test.mjs`).
- **Em mapa aberto a navegação é neutra** (padrão: 46% × 45%). Ela só ajuda onde o caminho em linha reta não existe.
- **O custo de salto/queda (6×) foi o ajuste que importou.** Com custo 1× a IA subia em obstáculos e plataformas e despencava (1,04 quedas por luta, 38% × 54% de vitórias no mapa padrão). Com 6× caiu para 0,16 quedas e o placar empatou; em plataformas passou a ganhar (49% × 39%).
- **Ainda há perda em corredor e rotas** (38% × 49% e 36% × 46%, cerca de 2 desvios-padrão): quem navega chega, mas o adversário que espera e contra-ataca leva vantagem. É o próximo ponto a melhorar (deixar a tática comandar o movimento quando já está perto).
- **Continua desligada por padrão** (`extras.nav.enableNav = 0`); ligue em Ajustes › Navegação para testar. Os sliders de custo de salto e de queda estão no mesmo painel.

Reproduzir: `node prototypes/combat-lab/test/nav-ai-compare.mjs 50 --write` (ajuste com `--set=jumpPenalty=4,dropPenalty=4`, mapas com `--maps=muro,rotas`).
