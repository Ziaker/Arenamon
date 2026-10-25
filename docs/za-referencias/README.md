# Banco de referências de animação (Pokémon Legends: Z-A)

Este é o item 1 do plano de melhorar o Motion Lens e o Blender Vision. Cada animação do dump `dumper test/LegendsZAPkmnModelDumpWithDLC` vira números de timing e espaçamento, para servir de referência profissional. **Os addons ainda não foram alterados.**

## Abrir

- **Relatório:** [`dumper test/za-referencias/relatorio.html`](../../dumper%20test/za-referencias/relatorio.html). Tem as normas por tipo de clipe, a curva típica, o ataque por forma do corpo e uma busca por Pokémon ou clipe.
- **Normas (JSON, versionado):** [`tools/za-referencias/normas_za.json`](../../tools/za-referencias/normas_za.json). É o arquivo que os addons vão ler.
- **Banco completo:** `dumper test/za-referencias/clipes.jsonl`, uma linha por clipe. Fica só no local porque é grande e pode ser gerado de novo.

## Fase 1: subfases 1A e 1B (25/10/2026)

**1A, inventário e reconciliação** (`inventario.py`, seção "Cobertura" do relatório):
- 41.790 arquivos `.tranm` no disco = 41.790 linhas no banco. Nenhum arquivo sem linha e nenhuma linha sem arquivo (manifesto com SHA-256 em `dumper test/za-referencias/inventario.json`).
- Busca = 40.811. Os 979 restantes são 463 clipes de rosto (08xxx, todos do grupo 0) e 516 parados (g0 90, g1 8, g2 383, g3 35).
- Fora da busca: `pm0000_00_00` e `pm0544_00_00`. Rótulos técnicos: `pm0770_14_00`, `pm0770_15_00`, `pm9999_00_00`.
- **Denominador das chaves:** as faixas de translação e rotação são contadas separadamente; escala fora da conta. Esparsa = Framed8/16, densa = Dynamic, fixa = Fixed.
- **Lote retomável** (`lote.py`): cache por hash do conteúdo + configuração, retomada depois de interrupção, falha registrada por arquivo, escrita atômica. Uma rodada completa leva cerca de 10 min; uma rodada sem mudanças sai toda do cache.

**1B, decodificador e paridade com o Blender** (`za_anim.py`, `paridade_fk.py`):
- A primeira conferência em todos os quadros **falhou**: Golisopod `walk01_loop` com 9,7% de H. A investigação (registrada no ledger) testou 4 hipóteses:
  - A: propagar a escala total. Rejeitada: o erro piorou para 10,5%.
  - B: canal sem chave no importador. Rejeitada: os canais tinham chave e o erro era constante em todos os quadros.
  - C: compensação de escala por osso (flag `InheritScale` do trskl). Confirmada: a escala do pai move a posição do filho, mas não escala os eixos dele. Isso explica o grosso do erro (9,7% → 0,59% de H).
  - D: interpolação entre chaves esparsas. Confirmada: o Blender usa Bézier, o decodificador usa linear/slerp. Com as duas correções, o erro cai para 0,0005% de H.
- A cinemática agora aplica a escala com essa compensação (`DECODER_VERSAO = za_anim-2`).
- **Paridade final:** 8 rigs × 2 clipes (`attack01`, `walk01_loop`), todos os quadros, posição e orientação. A conferência força interpolação linear numa cena derivada, sem abrir nem salvar arquivo do usuário.

  | Rig | Forma | Posição máx. (% H) | Ângulo máx. (°) |
  |---|---|---|---|
  | pm0867_00_00 Golisopod | humanoide | 0,0005 | 0,021 |
  | pm0001_00_00 Bulbasaur | quadrúpede | 0,0006 | 0,024 |
  | pm0016_00_00 Pidgey | asas | 0,0003 | 0,026 |
  | pm0014_00_00 Kakuna | serpente | 0,0004 | 0,014 |
  | pm0544_00_00 Whirlipede | bola | 0,0000 | 0,015 |
  | pm0703_00_00 Trevenant | tentáculos | 0,0007 | 0,021 |
  | pm0129_00_00 Magikarp | peixe | 0,0006 | 0,019 |
  | pm0867_51_00 Mega Golisopod | Mega | 0,0005 | 0,022 |

  As tolerâncias eram 0,25% de H e 0,5° (máximos), e 0,01% de H e 0,05° (medianas); todos os casos passaram. Os JSON estão em `dumper test/za-referencias/evidencia/paridade/`.
- **Limite:** "paridade" significa igual ao que o addon importa no Blender. A semântica real do jogo (curva entre chaves, escala) não pode ser conferida sem o motor do jogo.
- **Pendente (decisão sua):** os `.blend` do extrator (`montar_blend.py`) ficam com Bézier entre chaves e, entre as chaves, se afastam até ~0,6% de H do linear.

## Fase 1: subfases 1C a 1I (25/10/2026)

Novos módulos em `tools/za-referencias/`, cada um com testes em `tests/` (rigs sintéticos; 150 testes em 25/10/2026):

| Subfase | Módulo | O que mede | Estado de evidência |
|---|---|---|---|
| 1C | `ontologia.py`, `regras_papeis.json`, `revisoes_efetor.json` | Região de cada osso, classe do corpo pelo esqueleto, **papéis** na ação: executores (um ou mais), iniciador, acompanhantes | `CANDIDATO` até revisão humana (`REVISADO`) |
| 1D | `cinematica.py` | Curvas por região, eventos com vários picos, ordem de ativação, follow-through, squash/stretch × partes escondidas | `CANDIDATO` |
| 1E | `contato.py` | Chão estimado, apoio por pé, modo real/esteira, cadência, escorregão | `CONTATO_INFERIDO` / `SEM_INFORMACAO` (nunca confirmado sozinho) |
| 1F | `folhas_visuais.py` | Folhas em 2 vistas independentes, executor em laranja, código de leitura; modo `cego` para rotulagem | `OBSERVAVEL` / `NAO_OBSERVAVEL` / `OCULTO_POR_ESCALA` |
| 1G | `poses_chave.py` | Menor conjunto de quadros que reconstrói o clipe (≤ 1% de H e ≤ 3°) | `APROXIMACAO` |
| 1H | `normas.py`, `aprovacoes_za.json` | Grupos com n de clipes, espécies, rigs; MAD/IQR; `SEM_BASE_COMPARAVEL` abaixo de 8 espécies | Medido, **não aprovado** (`NAO_AVALIADA`) |
| 1I | `avaliacao.py`, `gerar_lote.py`, `rotulagem.html` | Divisão sem vazamento, placar, kappa, A/B com McNemar; lote de 40 para rotular | Aguarda rótulos humanos |

**Máscara de visibilidade:** o Z-A esconde partes zerando a escala. Todo osso com escala < 0,1 (nele ou num ancestral) sai das medidas nesses quadros (`za_anim.ocultos`).

### Resultados no corpus (banco final, 41.790 clipes, 0 falhas)

**1C, papéis no ataque físico** (300 espécies, conjunto 0):
- Executor por região: braço direito 55%, braço esquerdo 38%, cabeça 25%, cauda 22%, perna direita 14%, mandíbula 7%. 52% dos ataques têm 2 ou mais executores.
- Olho, orelha ou antena como "efetor": 81 pelo critério antigo, 1 agora (uma antena, permitida porque é a única cadeia longa daquele rig). Nenhum ataque ficou inconclusivo.
- Quem inicia o movimento: núcleo 19%, braço direito 17%, cauda 16%.
- Classe do corpo pelo esqueleto × forma da PokeAPI: "ereto" → bípede em 132 de 142; "humanoide" → bípede em 77 de 83.
- Só 1 de 590 modelos tem mais de 5% de ossos animados sem região.
- Status `CANDIDATO`: o acerto real só existe depois do gabarito humano.

**1D, eventos:**
- 70% dos ataques têm mais de um pico de velocidade no executor (preparação, golpe, recuperação).
- Squash/stretch aparece em 24% dos ataques e 29% dos clipes de dano; partes escondidas por escala, em 8–9%.

**1E, locomoção** (1.490 loops):
- 938 saem `real` e 552 `SEM_INFORMACAO`. Destes, 245 não têm pernas, há pés que nunca levantam, pés apoiando em alturas diferentes e pulos.
- Escorregão inferido em 65 de 736 loops reais do conjunto 0 (9%): 129 trechos de deslize lento e 41 de patinação (pé rente ao chão andando junto com o corpo).
- Cadência mediana: 2,9 passos/s.

**1G, poses-chave:** no ataque físico, mediana de 53% dos quadros (dentro de 1% de H e 3°). Concordância com os "quadros fortes" do arquivo entre 30% e 57% conforme a categoria.

**1H, normas:** cada grupo traz n de espécies, rigs estruturais e poses de repouso. O ataque físico (conjunto 0) tem 300 espécies e 302 rigs; 58% dos clipes têm escala animada e 10% têm partes escondidas. Status `MEDIDO`, `adequacao_artistica = NAO_AVALIADA`.

**1I, lote de rotulagem:** em `dumper test/za-referencias/avaliacao/lote_01/`.
- Divisão sem vazamento: 189 grupos, teste com 30%.
- Cada animação tem **vídeo nas duas vistas, sincronizado**: play/pausa, câmera lenta (0,1–1×), quadro a quadro, barra de posição e contador de quadro. Os quadros fixos continuam disponíveis em "Ver quadros fixos". Tudo em modo cego: sem cor e sem nada calculado. Os vídeos são WebM com todo quadro sendo chave, gerados por `gerar_videos_lote.py`, sem mudar os 40 itens.
- As previsões do sistema ficam **fora** da pasta dos revisores, em `avaliacao/lote_01_sistema/`.
- Itens ignorados por decisão sua (Pokémon redundantes): a página mostra só 12, 30, 32 e 35 (`avaliacao/lote_01_ignorados.json`). A chave de armazenamento e o hash do lote não mudaram.
- **Bolinha azul = lado ESQUERDO do Pokémon** (no ombro esquerdo; se não houver braço, no quadril ou na asa esquerda). Ela aparece por cima do corpo e só orienta: não diz nada do que o sistema calculou. Os vídeos dos 4 itens mantidos foram refeitos com ela. Conferido no Blastoise: na vista de frente a bolinha fica à direita de quem olha, e o braço que sobe antes do golpe fica do outro lado, ou seja, é o braço **direito** do Pokémon.

### Ajustes depois dos primeiros rótulos (25/10/2026)

- **Antecipação não se aplica em loops:** `antecipacao_status = NAO_SE_APLICA` e a previsão é "não".
- **Locomoção conta todos os membros que ciclam** (walk, run, backwalk, turnmove, dash, fly): braços, pernas e asas com pico ≥ 40% do maior viram executores (`regras_papeis.json` → `locomocao`).
- Previsões refeitas com o banco novo (`gerar_lote.py --previsoes`, sem mudar o lote). Comparação com os 4 rótulos:

| Item | Executores | Antecipação |
|---|---|---|
| Blastoise, ataque | você: braço E + perna D; sistema: braço D | igual (sim) |
| Meditite, ataque | você: braço E + 2 pernas; sistema: braço D | igual (sim) |
| pm0965, charge (loop) | você: 2 "pernas" (tentáculos); sistema: braço E | igual (não) |
| Meditite, andar (loop) | **igual** (2 braços + 2 pernas) | igual (não) |

  Os lados dos ataques divergiam. **Conferido com a bolinha (25/10/2026):** o revisor tinha marcado pelo lado da tela. Os rótulos foram espelhados para o lado do Pokémon (`rotulos_zac_144f286e17c8.json`; o original está em `…_lado_da_tela.json`). Depois disso, o braço que ataca bate nos 2 ataques (braço D). Restam duas diferenças: as pernas de apoio e impulso, que o humano conta e o sistema não; e o iniciador, que no Blastoise é braço D para o humano e braço E para o sistema, e no Meditite é braço D para o humano e núcleo para o sistema.

### Campo `apoio_impulso` (decisão do revisor, 25/10/2026)

- **Executor é só quem golpeia.** As pernas que sustentam o peso ou empurram, sem golpear, vão para `apoio_impulso`.
- **Regra do sistema** (`regras_papeis.json` → `apoio_impulso`): perna não executora com algum osso que gira ≥ 10° entre o início da preparação (30 q antes do pico) e o golpe. Em locomoção não se aplica, porque lá os membros que ciclam já são executores.
- **Página de rotulagem:** ganhou a pergunta "Pernas de apoio/impulso", com a opção "nenhuma". Os rótulos do revisor zac foram migrados: as pernas dos 2 ataques saíram de executores e foram para `apoio_impulso`.
- **Banco refeito:** 41.790 clipes, 0 falhas. 1.786 dos 2.764 ataques com executor têm pelo menos uma perna de apoio; no relatório (um ataque por espécie, conjunto 0), 84%.
- **Relatório:** seção "Pernas de apoio/impulso" e seção "Papéis na locomoção" (charge, run, walk...). Nos loops, a coluna de antecipação mostra "não se aplica" (`normas.grupo` → `antecipacao_status`).
- **Comparação depois da mudança:**
  - executores iguais nos 2 ataques e no andar;
  - apoio/impulso igual no Meditite;
  - no Blastoise, o humano marcou só a perna E e o sistema marcou as duas. Na observação, o revisor diz que as duas pernas flexionam no início.
- **Limiar de 10°:** é baixo para os valores reais (31–65°) e pode estar marcando perna demais. Precisa de mais rótulos para calibrar.

### `charge` entra na locomoção (decisão do revisor, 25/10/2026)

- Os 738 clipes `charge` são todos `charge01_loop`, de 364 espécies. Eles entraram na regra de locomoção dos papéis: todo membro que cicla é executor.
- A camada de contato e passos (`CATEGORIAS_LOCOMOCAO` em `metricas.py`) **não** mudou.
- Banco refeito: 41.790 clipes, 0 falhas.
- **Achado:** 471 dos 738 `charge01_loop` ficam sem executor, porque nenhum membro passa de 0,5 H/s. Muitos devem ser um avanço do corpo inteiro, ou uma pose de carga quase parada, e não membros ciclando. Precisa de rótulos para confirmar.
- **pm0965:** o sistema dá executores braço D, braço E, perna C, perna D e perna E, sem apoio. O revisor marcou 2 "pernas", que são os tentáculos. No rig eles se chamam `shoulder`, por isso o sistema os conta como braço.

### Lote 02 de rotulagem (25/10/2026)

**Abrir:** `dumper test/za-referencias/avaliacao/lote_02/rotulagem.html`. Também está no portal: Banco de Referências → "Rotulagem cega (lote 02, 15 variados)".

Gerado com `gerar_lote.py --diverso <banco> <dump> <saida> <lotes anteriores…>`, depois `gerar_videos_lote.py`.

- **15 itens sem redundância:** uma espécie e uma linha evolutiva por item. Nenhuma espécie nem linha do lote 01 se repete. Todos vêm da parte de teste da divisão, então não há vazamento.
- **Formas do corpo:** bípede, quadrúpede, serpente (Qwilfish de Hisui, conjunto 1) e "outro" (Vanillite, conjunto 2).
- **Formas raras:** o lote 01 já tinha usado quase todas da parte de teste, por isso essas vagas aceitam outro conjunto ou outra forma da mesma classe. Não sobrou nenhum Pokémon alado.
- **Categorias:**
  - ataque (5);
  - andar, correr e pouso;
  - charge (3): 1 com executor previsto e 2 sem, para conferir os 70% de charge sem executor;
  - dano, ataque à distância, rugido e pulo.
- **Vídeos:** vista de frente e 3/4, com a bolinha azul do lado esquerdo, câmera lenta e avanço quadro a quadro. A página já traz a pergunta de apoio/impulso.
- **Pokémon sem braço, perna ou asa** (Qwilfish): a bolinha fica ao lado do corpo, no lado esquerdo, e gira junto com ele. Os 15 itens foram conferidos com quadros extraídos dos vídeos.
- **Previsões do sistema:** ficam em `avaliacao/lote_02_sistema/`, fora da pasta do revisor.

### Achados que mudaram o código durante a execução (todos com teste que falhou antes)

| Achado no corpus | Correção |
|---|---|
| `foot_index` (dedo do pé) caía em "braço": 117 eretos viravam quadrúpedes | Perna tem precedência sobre os tokens de dedo |
| Antenas e pálpebras em balanço de idle "iniciavam" 25% dos ataques | Iniciador e ordem só entre regiões motoras, na janela antes do golpe |
| Roupas e saias deixavam 41 modelos acima de 5% em "outro" | Região `acessorio` |
| 78% dos loops `SEM_INFORMACAO` por mergulho do pé no ar e balanço do corpo | Faixa de apoio por pé; pulo só acima de 25% de H |
| Escorregão em 37% dos loops (pés que não levantam, apoios de 2 q, balanço rasante) | Passo não observável; apoio mínimo de 4 q; pé rápido rente ao chão = balanço |
| A divisão dev/teste juntava o corpus num componente só | Quase duplicata exige correlação ≥ 0,9999 + mesmos quadros + mesma energia de pico |
| Folhas com o executor pintado entregariam a resposta ao revisor | Modo `cego` |

### Revisão independente da branch

Um revisor novo (outro modelo, sem o contexto da execução) leu o código e rodou os testes: 0 críticos, 10 importantes e 8 menores. Os 10 importantes foram corrigidos, cada um com um teste que falhou antes:
- ponta de região escondida por escala apagava o braço;
- o cache ignorava regras e revisões;
- a revisão humana entrava pela metade;
- normas abaixo do mínimo saíam MEDIDO;
- faltava n de clipes no relatório;
- a página de rotulagem não tinha todas as regiões nem lados claros;
- as previsões ficavam na pasta dos revisores;
- patinação passava despercebida;
- só um executor era medido.

A exceção foi a quase duplicata (item 8): ficou como está, e a decisão é sua (abaixo). Os 5 menores adiados estão no ledger.

### Não verificado

- O acerto de executores, iniciador, antecipação e apoio. Depende dos rótulos humanos do lote 01 e do A/B.
- Escorregão conferido no visual: 2 tentativas, ambas inconclusivas (câmera seguindo o pé). Continua `INFERIDO`.
- O significado dos conjuntos 1xxxx–4xxxx. Há um indício, não confirmado: no conjunto 1 a raiz fica mais alta e os pés mais longe do chão em 3 de 4 espécies amostradas.
- **Decisão sua:** a quase duplicata mudou em relação ao plano. O plano pedia correlação ≥ 0,98 da curva de energia e da curva do executor; a implementação usa ≥ 0,9999 + mesmos quadros + energia de pico a até 1%, porque a regra do plano juntava o corpus inteiro num grupo só. Com isso, uma animação retargetada para outro rig não é detectada e pode cair nos dois lados da divisão (registrado em `relatorio_vazamento.json`).
- O "A" do A/B (Blender Vision atual) só entende rigs com nomes humanoides (`Hips`, `RightArm`…). Na maioria dos Pokémon ele vai sair sem resposta, e isso precisa entrar na leitura do A/B.


## Próxima fase

O plano das subfases 1A–1J (resposta à auditoria REV2) está em [`docs/superpowers/plans/2026-10-25-za-referencias-fase1.md`](../superpowers/plans/2026-10-25-za-referencias-fase1.md). As Tasks 1–9 (1A–1I) foram executadas. A Task 10 (1J, integração com Motion Lens, Blender Vision e Direction Lines) espera a escolha do Motion Lens oficial.

Ainda falta, comparando com o REV2:
- A/B cego com mais revisores e mais itens. Hoje há 4 itens rotulados por 1 revisor.
- L07 (silhueta, linhas de ação, espaço negativo).
- L09 (intenção medida pelo sistema).
- Curvas `.trcrv`, efeitos `.traef` e câmeras.
- Iniciador: discorda nos 3 itens rotulados, ainda não investigado.

## Gerar de novo

Tudo roda com o Python do Blender 5.2, que já tem `numpy` e `flatbuffers`:

```bash
"/c/Program Files/Blender Foundation/Blender 5.2/5.2/python/bin/python.exe" tools/za-referencias/gerar_banco.py "dumper test/LegendsZAPkmnModelDumpWithDLC" "dumper test/extraido/ik_pokemon/catalog/catalog/poke_resource_table.trpmcatalog" "dumper test/za-referencias/clipes.jsonl"
```

```bash
python -I tools/za-referencias/gerar_relatorio.py "dumper test/za-referencias/clipes.jsonl" "dumper test/za-referencias"
```

Depois copie `dumper test/za-referencias/normas_za.json` e `normas_grupos_za.json` para `tools/za-referencias/`.

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

## Limitações conhecidas (da primeira rodada)

- ~~O "efetor" era o osso de maior percurso (antenas, dedos, caudas).~~ Resolvido na 1C: executores por regra de ação + anatomia; o maior percurso continua só como métrica de trajetória.
- "Ease" e "hold" usam como limiar o pico da energia. Em ataques com um chicote muito rápido, quase tudo fica abaixo do limiar.
- O significado dos conjuntos 1xxxx, 2xxxx, 3xxxx e 4xxxx não foi confirmado.

## Conferência

- Cinemática direta × Blender (Golisopod, `00400_attack01`, quadros 0/45/89/134, 75 ossos): o pior erro foi de 3,3 mm, 0,23% da altura.
- Loops (`walk01_loop`, `run01_loop`): erro de loop 0,0 H depois de restringir as medidas aos ossos do corpo.
