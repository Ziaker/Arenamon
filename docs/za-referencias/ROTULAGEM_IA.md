# Rotulagem por IA (propostas auditáveis)

A IA propõe rótulos para os itens de um lote de rotulagem, e cada resposta vem com a evidência que a sustenta. **Não é gabarito.** As propostas ficam separadas da avaliação cega e só valem depois que um humano aprova ou corrige na página de revisão.

## Abrir

- **Revisão das propostas (lote 02):** `dumper test/za-referencias/avaliacao/lote_02_ia/rotulagem_ia_review.html`. No portal: Banco de Referências → "Propostas da IA · lote 02".
  - Para cada item, a página mostra os vídeos sincronizados, a proposta, a evidência de cada campo (nível, quadros e justificativa), as imagens examinadas, os eventos e as limitações.
  - Cada proposta pode ser aprovada, corrigida ou rejeitada. "Baixar revisão separada" gera `revisao_ia_<lote>.json`.
  - Esta página não lê nem altera as respostas da página de rotulagem humana.
- **Arquivos** (em `lote_02_ia/`):
  - `rotulos_ia.json`: as propostas, no formato do "Baixar rótulos";
  - `evidencias/<id>.json`;
  - `relatorio_execucao.json`;
  - `interpretacao.json`: as respostas com a justificativa de cada uma;
  - `inspecao/`: os quadros examinados;
  - `cinematica/`: os dados 3D originais por clipe.

## Níveis de evidência

| Nível | Quando |
|---|---|
| A | Os dados 3D originais (`.tranm` decodificado) e o vídeo concordam. |
| B | Visto com clareza nos quadros das duas vistas, sem confirmação 3D. |
| C | Hipótese ou interpretação artística: peso e intenção. |
| INCONCLUSIVO | Sem base suficiente; o motivo fica registrado. |

A confiança dos blocos (alta, média ou baixa) vem só do nível (A, B ou C); não é probabilidade. O contato com o chão fica INCONCLUSIVO enquanto o chão for apenas estimado.

## Como foi feito (lote 02, 25/10/2026)

Começou com o Codex, que parou por limite de uso, e foi terminado pelo Claude:

1. `ia_pipeline.py` (Codex):
   - lê o `LOTE` da página sem executar JavaScript e pula os itens ignorados;
   - copia vídeos e folhas com hash (`fontes/`) e confere a sincronia das duas vistas com o ffprobe;
   - escolhe quadros pela mudança visual;
   - valida as respostas contra a política de evidência (`evidence_gate`, `validate_export`).
2. `ia_cinematica.py` (Codex): mede o `.tranm` original de cada item (velocidade por osso e região, raiz, ossos escondidos por escala), sem inferir papéis.
3. **Inspeção (Claude):**
   - um resumo 3D por clipe: trajetória das mãos para a frente e para cima, altura dos pés no chão estimado, giro do quadril e início de cada região;
   - quadros extraídos dos dois vídeos e **abertos**, guardados em `inspecao/claude_*.png`.
4. `interpretacao.json` (Claude): cada resposta com nível, quadros, vistas e justificativa, mais a observação técnica.
5. `ia_propostas.py` (Claude): junta tudo, passa pelo `validate_export` (se houver erro, nada é gravado) e grava as propostas, as evidências, o relatório e a página de revisão.

## Novo lote

```bash
"/c/Program Files/Blender Foundation/Blender 5.2/5.2/python/bin/python.exe" tools/za-referencias/ia_pipeline.py "dumper test/za-referencias/avaliacao/lote_03/rotulagem.html" --saida "dumper test/za-referencias/avaliacao/lote_03_ia"
```

```bash
"/c/Program Files/Blender Foundation/Blender 5.2/5.2/python/bin/python.exe" tools/za-referencias/ia_cinematica.py "dumper test/za-referencias/avaliacao/lote_03/rotulagem.html" "dumper test/LegendsZAPkmnModelDumpWithDLC" "dumper test/za-referencias/avaliacao/lote_03_ia/cinematica"
```

Depois disso, a IA examina os quadros, escreve `lote_03_ia/interpretacao.json` no mesmo formato do lote 02 e roda:

```bash
"/c/Program Files/Blender Foundation/Blender 5.2/5.2/python/bin/python.exe" tools/za-referencias/ia_propostas.py "dumper test/za-referencias/avaliacao/lote_03/rotulagem.html" "dumper test/za-referencias/avaliacao/lote_03_ia" "dumper test/za-referencias/avaliacao/lote_03_ia/interpretacao.json"
```

A preparação usa cache por hash do conteúdo: rodar de novo sem mudança reaproveita tudo, e falhas ficam registradas por item. A saída nunca pode ficar dentro da pasta do lote humano.

## Resultado do lote 02 (4 itens ativos: 1, 7, 9, 14)

- **4 de 4 analisados**, todos com cinemática original e vídeo. As linhas do tempo das duas vistas são compatíveis nos 4.
- **Lucario, ataque:**
  - executor: braço direito (A);
  - apoio/impulso: as duas pernas (A);
  - recuo ativo em q2–9, pose armada em q10–35, golpe com início no q36 e pico no q40, extensão até o q60.
- **Hawlucha e Groudon, `charge01_loop`:** são **poses de carga paradas**, não locomoção. A raiz se move até 3% da altura, os pés ficam imóveis e só há uma oscilação tipo respiração. Executor e iniciador ficam INCONCLUSIVO. Isso explica os 70% de charge sem executor no banco. Por decisão do revisor, `charge` saiu da regra de locomoção (25/10/2026). Também foi criada a regra de **pose parada**, e agora o sistema dá para os dois charge exatamente o que a revisão propôs: executor INCONCLUSIVO, as duas pernas como apoio e iniciador INCONCLUSIVO.
- **Sawk, rugido:**
  - executores: os dois braços e a cabeça (A); pernas como impulso;
  - recuo de fechar e agachar em q12–24, pose fechada em q25–33, abertura em q34–40, pose segurada até o q104.
- **Inconclusivos por campo:**

  | Campo | Inconclusivos |
  |---|---|
  | iniciador (campo antigo) | 4/4 (as regiões começam juntas) |
  | pés no chão | 4/4 (chão estimado) |
  | executores | 2/4 (os loops de pose) |
  | iniciadores | 2/4 |
  | peso | 2/4 |
  | intenção | 1/4 |
  | apoio/impulso, antecipação, parte some, leitura | 0 |

- **Não verificado:** a correção artística das propostas, que depende da revisão humana; a abertura da boca do Sawk; contato real com o chão.

## Gabarito aceito do lote 02 (29/10/2026)

- O responsável aceitou a **auditoria integral** de uma IA externa (30 vídeos, 2.530 quadros, 15 montagens integrais) como visão de referência. Cópia local: `dumper test/za-referencias/avaliacao/auditoria_externa/` (HTML 68 MB + JSON; dado derivado do Z-A, fora do git).
- **Gabarito:** `dumper test/za-referencias/avaliacao/gabarito_lote_02_aceito.json`, origem `ACEITO_PELO_USUARIO`. Cobre só os **4 clipes** com campos estruturados (Lucario, Hawlucha, Groudon, Sawk): executores, iniciador, antecipação, apoio/impulso e parte some/aparece. Os outros 11 clipes têm na auditoria só fases visuais aproximadas, sem gabarito.
- **Ajuste sobre a proposta:** Hawlucha e Groudon (`charge01_loop`) passam de antecipação `nao` para `nao_se_aplica` (carga sem golpe).
- **Novo valor `nao_se_aplica` em antecipação:** existe no schema da IA, na página de revisão da IA e na página de rotulagem de lotes novos (lotes 01 e 02 já gerados não mudam; o hash deles é a chave das respostas). Na pontuação (`avaliacao.py`: placar, A/B e concordância) vale como `nao` **só nesse campo**, porque a previsão do sistema para loops continua `nao`. Teste: `TestAntecipacaoNaoSeAplica` e `TestSchemaIA`.
- **Limites:** revisor único (sem kappa); o `revisao_ia_477115ec150e.json` com a revisão campo a campo ainda não chegou; a auditoria não testou rig, contato nem jogo.

## Lote 03 (29/10/2026)

- **Filtro de espécies** (`elegibilidade.py`, lista em `elegiveis_lote03.json`, 497 de 1.025 espécies): sem baby; só 2º ou 3º estágio da linha; espécie sem evolução só se o egg group for Humanoide (`humanshape`) ou Monster. Dados da PokeAPI em `dumper test/_ref/` (`pokemon_species.csv`, `pokemon_egg_groups.csv`).
- **Seleção:** 15 clipes da parte de **teste** (sem vazamento), uma espécie e uma linha por item dentro do lote. Com os lotes 01 e 02 barrando espécies, sobravam só 3 clipes; por decisão do responsável os lotes anteriores agora barram **só o mesmo clipe** (`gerar_lote.py --diverso --repetir-especies --elegiveis`).
- **Página para rotular (às cegas):** `dumper test/za-referencias/avaliacao/lote_03/rotulagem.html`, hash do lote `a83c78d9fc71`. A pergunta de antecipação já tem a opção "não se aplica". Previsões do sistema ficam em `lote_03_sistema/` (não abrir antes de rotular).
- **Propostas da IA (29/10/2026):** `dumper test/za-referencias/avaliacao/lote_03_ia/rotulagem_ia_review.html` (15 clipes, validados por `ia_propostas.py`; propostas em `rotulos_ia.json`, evidências por clipe em `evidencias/`). A IA inspecionou só a **vista D_e12** de cada clipe (a E_e35 não foi lida) e a cinemática original. Muitas respostas ficam INCONCLUSIVO de propósito (executores 10/15, iniciador 15/15, apoio 15/15, massa 6/15, intenção 7/15). Casos em que a IA ficou em dúvida: Sylveon (fitas ou patas dianteiras como executor) e Wigglytuff (disparo pela boca é hipótese, sem projétil). Overqwil e Kleavor atravessam o quadro no vídeo com a raiz da cinemática parada (deslocamento provavelmente em outro osso; não verificado). Pupitar e Spewpa: enquadramento corta o corpo. Propostas **não são gabarito**: só entram no A/B depois da sua revisão.

## Auditoria externa do lote 03 (30/10/2026)

- Outra IA auditou os 15 clipes do lote 03 nas **duas vistas** (2.302 quadros decodificados, 71 intervalos de descrição, sem rótulos estruturados). Cópia local, fora do git: `dumper test/za-referencias/avaliacao/auditoria_externa/lote_03/Arenamon_Auditoria_Lote03/` (abrir `index.html`; resumo em `resumo_auditoria_lote_03.md`; limites em `VALIDACAO_E_LIMITES.txt`).
- **Confronto com as propostas da IA do lote 03** (nenhum campo estruturado foi alterado): concorda em Sawk (executor de braço não assegurado; participação de tronco e pernas), Sylveon (executor incerto entre pata e fita), Pupitar e Spewpa (close, sem ação), Fletchinder e Swalot (só o final do ataque), Overqwil (flutua, sem patas), Pyroar (só a cauda se move), Drampa, Diggersby e Blastoise.
- **Divergências a conferir:** Wigglytuff — a auditoria não vê boca nem projétil e descreve só um gesto de esticar o corpo no q35–43; a proposta de executor `mandibula` é hipótese fraca (nível C). Lairon — a auditoria diz que a cabeça desce e contrai no q0–6; o texto de evento da proposta diz que sobe e gira (só texto, não campo). A proposta só leu a vista D; a auditoria leu D e E.
- Não é gabarito: continua dependendo da sua rotulagem e revisão.
