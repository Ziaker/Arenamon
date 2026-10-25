# Banco de referências de animação (Pokémon Legends: Z-A)

Este é o item 1 do plano de melhorar o Motion Lens e o Blender Vision. Cada animação do dump `dumper test/LegendsZAPkmnModelDumpWithDLC` vira números de timing e espaçamento, para servir de referência profissional. **Os addons ainda não foram alterados.**

## Abrir

- **Relatório:** [`dumper test/za-referencias/relatorio.html`](../../dumper%20test/za-referencias/relatorio.html). Tem as normas por tipo de clipe, a curva típica, o ataque por forma do corpo e uma busca por Pokémon ou clipe.
- **Normas (JSON, versionado):** [`tools/za-referencias/normas_za.json`](../../tools/za-referencias/normas_za.json). É o arquivo que os addons vão ler.
- **Banco completo:** `dumper test/za-referencias/clipes.jsonl`, uma linha por clipe. Fica só no local porque é grande e pode ser gerado de novo.

## Próxima fase

O plano de implementação das subfases 1A–1J (resposta à auditoria REV2) está em [`docs/superpowers/plans/2026-10-25-za-referencias-fase1.md`](../superpowers/plans/2026-10-25-za-referencias-fase1.md). Ele aguarda aprovação para ser executado.

## Gerar de novo

Tudo roda com o Python do Blender 5.2, que já tem `numpy` e `flatbuffers`:

```bash
"/c/Program Files/Blender Foundation/Blender 5.2/5.2/python/bin/python.exe" tools/za-referencias/gerar_banco.py "dumper test/LegendsZAPkmnModelDumpWithDLC" "dumper test/extraido/ik_pokemon/catalog/catalog/poke_resource_table.trpmcatalog" "dumper test/za-referencias/clipes.jsonl"
```

```bash
python -I tools/za-referencias/gerar_relatorio.py "dumper test/za-referencias/clipes.jsonl" "dumper test/za-referencias"
```

Depois copie `dumper test/za-referencias/normas_za.json` para `tools/za-referencias/`.

## Peças

| Arquivo | O que faz |
|---|---|
| `za_anim.py` | Lê `.trskl` e `.tranm` sem o Blender, interpola chaves esparsas e faz a cinemática direta. |
| `metricas.py` | Calcula as medidas por clipe. As definições estão no topo do arquivo e no relatório. |
| `gerar_banco.py` | Mede todas as formas em paralelo e grava `clipes.jsonl`. |
| `gerar_relatorio.py` | Gera as normas (mediana e p10–p90 por categoria e fase, um clipe por espécie) e o HTML. |
| `conferir_fk.py` | Confere a cinemática contra a pose que o Blender importa. |
| `testar_um.py` | Mede uma forma e imprime as medidas, para conferência. |
| `especies.json` | Nome e forma do corpo por número da Pokédex, tirados da PokeAPI. |

## Resultado da primeira rodada (25/10/2026)

- **41.790 clipes**, 590 modelos e 365 espécies, todos a 60 fps, medidos em cerca de 10 minutos, sem nenhum erro.
- **Chaves:** 36% das faixas têm chaves esparsas, 11% são densas e 53% são fixas. Nas esparsas, a mediana é 34% dos quadros com chave (p10–p90: 20%–51%).
- **Ataque físico (`attack01`, conjunto 0, 300 espécies):**
  - duração de 1,98 s (1,78–2,25);
  - do início ao pico, 0,57 s;
  - 92% dos ataques têm antecipação, com mediana de 27 quadros, e o recuo máximo fica 6 quadros antes do pico do golpe;
  - 93% têm hold;
  - overshoot de 0,56.
- **Andar (loop):** 1,02 s por ciclo. **Correr (loop):** 0,55 s.
- **Nenhum Pokémon do elenco atual do Arenamon está no Z-A:** Vigoroth, Croagunk, Drowzee, Gumshoos e Exeggcute. A comparação terá de ser feita com Pokémon de forma de corpo parecida.

## Limitações conhecidas (para o item 2)

- O "efetor" escolhido costuma ser um apêndice de movimento secundário: antenas do Lucario, dedos do Golisopod, caudas. Para medir golpe e antecipação de verdade, ele deveria ser escolhido entre mãos e pés, e os apêndices deveriam ser medidos à parte, como follow-through.
- "Ease" e "hold" usam como limiar o pico da energia. Em ataques com um chicote muito rápido, quase tudo fica abaixo do limiar.
- O significado dos conjuntos 1xxxx, 2xxxx, 3xxxx e 4xxxx não foi confirmado.

## Conferência

- Cinemática direta × Blender (Golisopod, `00400_attack01`, quadros 0/45/89/134, 75 ossos): o pior erro foi de 3,3 mm, 0,23% da altura.
- Loops (`walk01_loop`, `run01_loop`): erro de loop 0,0 H depois de restringir as medidas aos ossos do corpo.
