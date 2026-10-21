# Cobertura na IA — tentativa descartada

**Ideia:** quando a IA decide se recuperar (intenção `recover`), em vez de circular à vista do rival ela anda até um ponto onde uma parede/obstáculo quebra a linha de visão, espera ali e volta a lutar.

**Medição** (IA × IA, 100 partidas por mapa, lados alternados, sementes fixas; "com × sem" = o lado que usa cobertura × o adversário dele):

| Variante | Mapa padrão | Corredor | Muro | Rotas | Completo |
|---|---|---|---|---|---|
| Cobertura sempre que recupera | 31% × 50% | 41% × 40% | 3% × 13% | 3% × 5% | 20% × 26% |
| Idem, com navegação nos dois lados | 32% × 53% | 37% × 51% | 41% × 42% | 44% × 36% | 2% × 2% |
| Só quando exausta | 39% × 47% | 36% × 47% | 10% × 8% | 2% × 2% | 25% × 21% |

**Conclusão:** nenhuma variante melhorou a IA; no mapa padrão ela perdeu (31% a 39% contra 47% a 53%). Esconder-se cede a iniciativa e o rival aproveita. **Não adotada**: o código (`ai-cover.js` e a opção no `ai-eval`) foi removido; este registro fica para não repetir o experimento.

**Plataformas de propósito:** não testado. A IA nunca salta hoje, então o ganho de altura só existiria com um ataque aéreo (Footstool ou Meteor Slam) que ela ainda não usa; seria um trabalho de maior porte (decidir saltar, mirar a queda) e fica como próximo passo possível.
