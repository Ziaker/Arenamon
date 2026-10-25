# Banco de Referências Z-A · Fase 1 (1A–1J) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar o banco atual (medidas por clipe) num corpus rastreável que sabe **qual parte do corpo age**, em que ordem, apoiada em quê, e com quais poses-chave. O corpus é consultado pelo Blender Vision e pelo Motion Lens sem nunca aprovar arte sozinho.

**Architecture:** Python puro em `tools/za-referencias/`, com módulos pequenos por camada: inventário, ontologia, cinemática, contato, poses-chave, normas e API. Roda com o Python do Blender 5.2, que já tem numpy e flatbuffers. Os testes usam rigs sintéticos montados em código; os testes que precisam do dump real pulam sozinhos quando ele não existe. Os addons só ganham código **novo e aditivo**, depois de um portão de inventário. Nada reescreve os originais do Z-A nem os `.blend`.

**Tech Stack:** Python 3.13 (Blender 5.2), numpy, flatbuffers (classes do addon PokemonSwitchV3), unittest, Blender em segundo plano para paridade e folhas visuais, HTML autocontido para relatórios.

**Spec:** `C:\Users\zerke\Downloads\ARENAMON_FASE1_REFERENCIAS_ZA_CORPUS_COMPLETO_REV2.docx` (REV2, 25/10/2026). Os números já reconciliados estão na seção "Fatos de partida" abaixo.

## Revisão 2 do plano (25/10/2026), depois do parecer externo

| Prioridade | Subfase | Correção aplicada |
|---|---|---|
| Crítica | 1C | Papéis na ação (executores, que podem ser vários; iniciadores; acompanhantes) por regras de ação + anatomia em `regras_papeis.json`. Mandíbula e língua podem executar mordida; pálpebra nunca executa. Testes provam o golpe certo (soco, dois braços, cabeçada, mordida, bote), com gabarito humano de 30 ataques. |
| Crítica | 1E | Contato em três níveis (`CONTATO_INFERIDO`, `CONTATO_CONFIRMADO` só com revisão visual, `SEM_INFORMACAO`). Plano do chão estimado, com teste de estabilidade. Escorregão só com chão estável e modo decidido. |
| Crítica | 1G | Erro de orientação (≤ 3°) além do de posição; extremos de rotação expressiva são chaves obrigatórias; teste de torção sem mudar de posição. |
| Alta | 1A | Step 0: lista do estado local, SHA-256 antes e depois, nenhum destino sobrescrito e só trechos novos aplicados em arquivos que já existem na main. |
| Alta | 1B | Tolerâncias por componente: posição ≤ 0,25% de H (pior) e ≤ 0,01% (mediana); ângulo ≤ 0,5° e ≤ 0,05°. Quem passar do limite vira investigação, não é aceito. |
| Alta | 1I | Divisão por cadeia + família de rig + origem da animação (hash e quase duplicata). A/B completo nas mesmas animações, com precisão, falsos positivos, inconclusivos, kappa entre ≥ 2 revisores e McNemar. |
| Alta | 1J | Inventário das duas versões do Motion Lens, cópia preservada das duas e exclusivas aprovadas incorporadas antes do código novo, com teste de presença. |
| Desempenho | todas | `lote.py`: cache por hash (arquivo + esqueleto + decodificador + config), retomada depois de interrupção, falha registrada por arquivo e escrita atômica. |

**Ordem de execução recomendada pelo parecer:** 1A–1B primeiro (Tasks 1–2). Depois, nova revisão de 1C–1I com os resultados de 1A–1B na mão. 1J só depois do Portão E.

## Fatos de partida (verificados em 25/10/2026, banco `dumper test/za-referencias/clipes.jsonl`)

- 41.790 clipes = 40.811 na busca + 463 de rosto (08xxx, todos do grupo 0) + 516 parados (g0 90, g1 8, g2 383, g3 35).
- Os modelos fora da busca são `pm0000_00_00` e `pm0544_00_00`, que só têm clipes parados ou de rosto.
- São 364 espécies reais mais a espécie 9999 sem nome. Rótulos técnicos: `pm0770_14_00`, `pm0770_15_00` (espécie 0 no catálogo) e `pm9999_00_00`.
- A cinemática direta bate com o Blender em 1 rig (Golisopod): 3,3 mm, ou 0,23% de H. Os outros rigs não foram testados.
- A cópia do Motion Lens no repositório (`scripts/blender-vision/addons/motion_lens.py`, 2.115 linhas, SHA `5d751b4e…`, com `motionlens.strike`/`apply_impact`) **difere** da instalada (`%APPDATA%/…/addons/motion_lens.py`, 1.924 linhas, SHA `e39adb0e…`). O Direction Lines é igual nas duas (SHA `2574f979…`).
- O Blender Vision espera trilhas com nomes humanoides (`Hips`, `Spine2`, `RightArm`, `RightForeArm`, `RightHand`) em `pose = {"frames", "joints", "quat", "floor_z"}` (`perception_motion.segment_signals`).

## Global Constraints

- "Não decidir destino público/privado ou publicação de arquivos do Z-A sem resolver o conflito documental." → tudo derivado do Z-A (séries, folhas, relatórios) fica em `dumper test/` (ignorado). No Git só entram código, testes, `normas_za.json` (números agregados) e documentos.
- "Não substituir Motion Lens, Blender Vision ou Direction Lines por uma arquitetura nova." → nos addons, só funções, operadores e comandos **novos**. Nenhuma função existente é reescrita.
- "Não promover automaticamente animações do Z-A a referências artisticamente aprovadas." → todo dado do corpus sai com `review.art_approved_by: null` e `adequacao_artistica: "NAO_AVALIADA"`.
- "Não aplicar retiming, retargeting, correções ou mudanças em arquivos .blend originais sem decisão específica."
- "Nunca inferir contato do pico de velocidade."
- "Se o grupo comparável for insuficiente, retornar SEM_BASE_COMPARÁVEL e mostrar as razões." O limiar fica em `config.N_ESPECIES_MIN = 8`, ajustável no relatório.
- "Exibir sempre n de clipes, n de espécies e n de rigs distintos."
- Estados de evidência (fixos, em maiúsculas): `MEDIDO`, `CANDIDATO`, `REVISADO`, `HIPOTESE`, `INCONCLUSIVO`, `SEM_INFORMACAO`, `CONTATO_INFERIDO`, `CONTATO_CONFIRMADO`, `APROXIMACAO`, `NAO_OBSERVAVEL`, `SEM_BASE_COMPARAVEL`, `NAO_AVALIADA`.
- Python: `PY="/c/Program Files/Blender Foundation/Blender 5.2/5.2/python/bin/python.exe"`. Testes: `"$PY" -m unittest discover -s tools/za-referencias/tests -v`.
- Trabalho na branch `feat/za-referencias-fase1`, num worktree interno `.worktrees/za-referencias`, a partir de `origin/main` (regra do AGENTS.md). Commits locais por tarefa; push só com autorização.
- Todo entregável ganha link no `ABRIR_ARENAMON.html` e menção em `docs/za-referencias/README.md` (AGENTS.md, regra 2). Resposta final em português.
- A versão do `package.json` **não** sobe: a entrega é só de ferramentas e não muda o jogo, o mesmo critério usado no Blender Vision.

## Review Focus

1. **Clipe com 1 quadro ou sem osso animado:** precisa sair com estado `INCONCLUSIVO`/`parado`, sem quebrar o lote. O teste fica na Task 4.
2. **Faixa com nome de osso inexistente no esqueleto:** precisa ser contada em `faixas_sem_osso` e ignorada, nunca aplicada ao osso errado. O teste fica na Task 2.
3. **Rig sem pernas ou sem braços (serpente, bola, peixe):** papel do executor sai pela cabeça/cauda ou `INCONCLUSIVO`, e o contato sai `SEM_INFORMACAO`, sem impor humanoide. Os testes ficam nas Tasks 3 e 5.
4. **Nome de clipe fora do padrão** (`damege`, `categoryin`, sem código de 5 dígitos): mantém a categoria crua com `nome_fora_do_padrao: true` e aparece no inventário. O teste fica na Task 1.
5. **Faixa de escala diferente de 1** (squash/stretch): as posições ignoram a escala. O clipe precisa ser marcado `escala_animada: true`, com o fator máximo, e não pode passar como medido sem ressalva. O teste fica na Task 2.

---

## Mapa de arquivos

| Arquivo (em `tools/za-referencias/`) | Responsabilidade | Tarefa |
|---|---|---|
| `config.py` | Limiares e constantes nomeados (um lugar só) | 1 |
| `inventario.py` | Manifesto do dump (hash, grupo, padrão de nome) + reconciliação busca × banco | 1 |
| `za_anim.py` (existe) | + `Esqueleto.de_arrays`, `Clipe.de_arrays`, `faixas_sem_osso`, escala animada | 2 |
| `paridade_fk.py` | Paridade da cinemática × Blender em vários rigs (roda no Blender) | 2 |
| `ontologia.py` + `regras_papeis.json` | Região de cada osso, anatomia do esqueleto, papéis na ação (executores, iniciadores, acompanhantes), revisões humanas | 3 |
| `cinematica.py` | Curvas por região, eventos (vários picos), ordem de ativação, follow-through | 4 |
| `metricas.py` (existe) | Passa a usar o efetor principal de `ontologia`; os campos antigos ficam com sufixo `_maior_percurso` | 4 |
| `contato.py` | Chão, apoio/balanço por pé, cadência, esteira × escorregão, proxy de CoM e base | 5 |
| `folhas_visuais.py` | Folhas multivista nos quadros de evento (roda no Blender; usa `perception_geom`) | 6 |
| `poses_chave.py` | Simplificação controlada por erro + reconstrução | 7 |
| `normas.py` | Distribuições por subgrupo com n de clipes/espécies/rigs, MAD/IQR, SEM_BASE_COMPARAVEL, aprovações | 8 |
| `avaliacao.py` + `rotulagem.html` | Divisão dev/teste por cadeia evolutiva, página de rótulos humanos, placar | 9 |
| `za_corpus.py` | API única de consulta e comparação para os addons | 10 |
| `gerar_banco.py`, `gerar_relatorio.py` (existem) | Passam a chamar os módulos novos; o relatório ganha "Cobertura", "Efetores", "Contato", "Poses-chave" | 1, 3–8 |
| `tests/` | `sintetico.py` (fábrica de rigs/clipes) + um `test_<modulo>.py` por módulo | todas |

Fora de `tools/za-referencias/`:
- `scripts/blender-vision/perception.py`: novo comando `za-compare` (Task 10).
- `scripts/blender-vision/addons/motion_lens.py`: novo operador `motionlens.za_compare` (Task 10, depois do portão).
- `scripts/blender-vision/addons/direction_lines.py`: novo operador `dirlines.functional_map` (Task 10, depois do portão).

---

### Task 1: Inventário, reconciliação e processamento retomável (1A)

**Files:**
- Create: `tools/za-referencias/config.py`, `tools/za-referencias/inventario.py`, `tools/za-referencias/lote.py`, `tools/za-referencias/tests/sintetico.py`, `tools/za-referencias/tests/test_inventario.py`, `tools/za-referencias/tests/test_lote.py`
- Modify: `tools/za-referencias/metricas.py` (`classificar`), `tools/za-referencias/gerar_banco.py` (passa a usar `lote.py`), `tools/za-referencias/gerar_relatorio.py` (seção Cobertura)

**Step 0: Preservar o trabalho local antes do worktree (revisão: prioridade alta).** Nada é copiado nem sobrescrito em silêncio:
1. `git status --short` e `git stash list` no checkout oficial. Gravar a lista completa em `dumper test/za-referencias/evidencia/estado_local_antes.txt`. Ela inclui as mudanças de outros agentes (evidências do combat-lab, `package.json`, `AGENTS.md`), que **não são tocadas**.
2. Calcular o SHA-256 de cada arquivo que vai para o worktree: `tools/za-extrator/**`, `tools/za-referencias/**`, `docs/za-extrator/**`, `docs/za-referencias/**`, `docs/superpowers/plans/2026-10-25-za-referencias-fase1.md`, os trechos do `.gitignore` e do `ABRIR_ARENAMON.html`.
3. Criar o worktree `.worktrees/za-referencias`, branch `feat/za-referencias-fase1`, a partir de `origin/main`. Antes de copiar cada arquivo, conferir que o destino **não existe**. Se existir, parar e mostrar o diff ao usuário.
4. `.gitignore` e `ABRIR_ARENAMON.html` existem na main: aplicar **só os trechos novos** como edição, nunca copiar o arquivo inteiro.
5. Conferir que os SHA-256 batem nos dois lados. Os originais ficam onde estão: o checkout oficial não perde nada.

**Processamento retomável (revisão: desempenho e retomada).** O lote de 41.790 clipes passa por `lote.py`:
- **Cache por clipe:** a chave é `sha256(arquivo .tranm) + sha256(.trskl) + DECODER_VERSAO + hash(config)`. O resultado vai para `dumper test/za-referencias/cache/<2 primeiros hex>/<chave>.json`. Na segunda rodada, clipe com a mesma chave não é recalculado.
- **Retomada:** depois de uma interrupção (Ctrl+C, queda, exceção), a próxima rodada pula o que já está em cache. O `clipes.jsonl` é remontado do cache no fim, com escrita atômica (arquivo temporário + `os.replace`).
- **Falha por arquivo:** uma exceção num clipe vira uma linha em `falhas.jsonl` (`arquivo, sha256, etapa, erro, traceback_curto`) e o lote continua. O relatório mostra a contagem de falhas por etapa.
- **Progresso:** uma linha a cada 25 formas, com tempo decorrido e estimativa.

**Interfaces:**
- Produces: `classificar(nome) -> dict` com a chave nova `nome_fora_do_padrao: bool`. `manifesto(pasta_dump) -> list[dict]`, com campos `modelo, clipe, arquivo, sha256, bytes, grupo`. `reconciliar(clipes: list[dict]) -> dict`, com `{"total", "na_busca", "excluidos": {"rosto": n, "parado": n, "fora_do_padrao": n}, "por_grupo": {g: {...}}, "modelos_fora_da_busca": [..], "rotulos_tecnicos": [..]}`. `config.LIMIAR_ATIVO=0.10`, `LIMIAR_LENTO=0.30`, `HOLD_MIN=3`, `N_ESPECIES_MIN=8`, `DECODER_VERSAO="za_anim-1"`.
- Cada linha do banco ganha a rastreabilidade da REV2 §7.1: `fonte_sha256`, `decoder_versao`, `espaco: "modelo_Y_up_relativo_raiz"`, `interpolacao: "linear+slerp"`, `limiares: {...}` (copiados de `config`).
- Segurança (REV2 §10): `manifesto` resolve cada caminho e recusa os que saem da pasta do dump (link simbólico, `..`). O teste é `test_manifesto_recusa_caminho_fora_da_raiz`.

- [ ] **Step 1: Escrever os testes**

```python
def test_reconciliar_soma_exata(self):
    clipes = [c("pm0001_00_00", "00400_attack01"), c("pm0001_00_00", "08000_eye01"),
              c("pm0002_00_00", "20000_defaultwait01_loop", parado=True)]
    r = inventario.reconciliar(clipes)
    self.assertEqual(r["total"], 3)
    self.assertEqual(r["na_busca"], 1)
    self.assertEqual(r["excluidos"], {"rosto": 1, "parado": 1, "fora_do_padrao": 0})
    self.assertEqual(r["por_grupo"]["2"]["parado"], 1)
    self.assertEqual(r["modelos_fora_da_busca"], ["pm0002_00_00"])

def test_nome_fora_do_padrao_mantem_categoria(self):
    k = metricas.classificar("categoryin")
    self.assertTrue(k["nome_fora_do_padrao"])
    self.assertEqual(k["categoria"], "categoryin")

def test_manifesto_tem_hash(self):  # dump sintético em tempfile com 2 .tranm de bytes conhecidos
    m = inventario.manifesto(self.tmp)
    self.assertEqual(m[0]["sha256"], hashlib.sha256(b"abc").hexdigest())

# test_lote.py (funcao_medir falsa e injetada, para contar chamadas)
def test_segunda_rodada_usa_cache(self):
    lote.rodar(tarefas, medir_contado, self.cache); lote.rodar(tarefas, medir_contado, self.cache)
    self.assertEqual(medir_contado.chamadas, len(tarefas))
def test_retoma_depois_de_interrupcao(self):   # medir levanta KeyboardInterrupt no 3º clipe
    with self.assertRaises(KeyboardInterrupt): lote.rodar(tarefas, medir_interrompe_no_3, self.cache)
    r = lote.rodar(tarefas, medir_contado, self.cache)
    self.assertEqual(medir_contado.chamadas, len(tarefas) - 2); self.assertEqual(r["medidos"], len(tarefas))
def test_falha_num_clipe_nao_para_o_lote(self):
    r = lote.rodar(tarefas, medir_falha_no_2, self.cache)
    self.assertEqual(r["falhas"], 1); self.assertEqual(r["medidos"], len(tarefas) - 1)
def test_mudar_config_invalida_cache(self):
    lote.rodar(tarefas, medir_contado, self.cache, config_hash="a"); lote.rodar(tarefas, medir_contado, self.cache, config_hash="b")
    self.assertEqual(medir_contado.chamadas, 2 * len(tarefas))
```

`lote.rodar(tarefas, medir, pasta_cache, config_hash=None, processos=None) -> {"medidos", "do_cache", "falhas", "segundos"}`. `tarefas` é uma lista de `{"chave", "args"}`.

- [ ] **Step 2: Rodar e ver falhar.** `"$PY" -m unittest tools/za-referencias/tests/test_inventario.py -v`. Esperado: `ModuleNotFoundError: inventario`.
- [ ] **Step 3: Implementar** `config.py`, `inventario.manifesto` (os.walk + sha256 em blocos de 1 MiB), `inventario.reconciliar` e `classificar(...)["nome_fora_do_padrao"]`. Um clipe de rosto é aquele com código começando em `08`.
- [ ] **Step 4: Rodar e ver passar.**
- [ ] **Step 5: Conferir no corpus real.** `"$PY" tools/za-referencias/inventario.py "dumper test/LegendsZAPkmnModelDumpWithDLC" "dumper test/za-referencias/clipes.jsonl"`. Esperado: `total 41790, na_busca 40811, rosto 463, parado 516` e `modelos_fora_da_busca ['pm0000_00_00','pm0544_00_00']`. Grava `dumper test/za-referencias/inventario.json`.
- [ ] **Step 6: Seção "Cobertura" no relatório.** Mostra a tabela de exclusões por grupo, os modelos fora da busca, os rótulos técnicos, as 3 contagens de espécie (reais, sem nome, rótulos) e o **denominador** da estatística de chaves: canais de translação e rotação contados separadamente, escala excluída, e "esparso" = faixa Framed8/16. Regenerar e abrir no navegador para conferir.
- [ ] **Step 7: Commit.** `git commit -m "feat(za-referencias): inventario e reconciliacao de contagens (1A)"`

### Task 2: Decodificador, paridade multi-rig e escala (1B)

**Files:**
- Modify: `tools/za-referencias/za_anim.py`
- Create: `tools/za-referencias/paridade_fk.py`, `tools/za-referencias/tests/test_za_anim.py`

**Interfaces:**
- Consumes: `tools/za-extrator/montar_blend.py` (gera o `.blend` de cada amostra).
- Produces: `Esqueleto.de_arrays(nomes, pais, loc, rot_quat) -> Esqueleto`. `Clipe.de_arrays(esq, fps, loc[F,B,3], rot[F,B,4], escala=None, animados=None) -> Clipe`. Atributos novos em `Clipe`: `faixas_sem_osso: int`, `escala_animada: bool`, `escala_max_desvio: float`. `paridade_fk.py <pasta_modelo> <clipe>` imprime JSON `{"modelo","clipe","erro_max_m","erro_max_rel_H","erro_mediana_rel_H","erro_ang_max_graus","erro_ang_mediana_graus","osso_pior","quadro_pior"}`. `Esqueleto.fk_completa(loc, rot) -> (posicoes [F,B,3], rot_mundo [F,B,3,3])` expõe a rotação no mundo, usada aqui e na Task 7.

- [ ] **Step 1: Escrever os testes**

```python
def test_quat_desempacotado_unitario(self):          # 50 valores aleatórios de 16 bits
    for x, y, z in amostras: self.assertAlmostEqual(np.linalg.norm(za_anim._desempacotar_quat(x, y, z)), 1, 5)
def test_euler_igual_matriz_de_referencia(self):     # Rz@Ry@Rx montada à mão
    np.testing.assert_allclose(za_anim.quat_para_matriz(za_anim.euler_xyz_para_quat(.3, -.7, 1.1)), R, atol=1e-9)
def test_pai_depois_do_filho_na_lista(self):         # pais=[2,-1,1]
    self.assertEqual(sorted(esq.ordem), [0, 1, 2]); self.assertLess(esq.ordem.index(1), esq.ordem.index(0))
def test_faixa_com_osso_inexistente_e_contada(self): # .tranm sintético via flatbuffers.Builder com faixa "nao_existe"
    self.assertEqual(clipe.faixas_sem_osso, 1)
def test_escala_animada_marcada(self):
    c = za_anim.Clipe.de_arrays(esq, 60, loc, rot, escala=escala_com_pico_1_3)
    self.assertTrue(c.escala_animada); self.assertAlmostEqual(c.escala_max_desvio, 0.3, 3)
def test_interpolacao_esparsa_slerp(self):           # chaves nos quadros 0 e 10; quadro 5 = slerp(0.5)
```

- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.** Em `Clipe.__init__`, ler também `ScaleType/Scale`, guardar `escala [F,B,3]` e marcar `escala_animada` quando `max|escala-1| > 0.02`. A cinemática continua sem escala (documentado). Contar `faixas_sem_osso`.
- [ ] **Step 4: Rodar e ver passar.**
- [ ] **Step 5: Paridade multi-rig.** Rodar `paridade_fk.py` (Blender em segundo plano, via `montar_blend.py`) em 8 rigs de formas diferentes: `pm0867_00_00` (humanoide), `pm0025_00_00` (quadrúpede), `pm0006_00_00` (asas), a primeira serpente, bola, tentáculos e peixe que aparecerem no banco, e uma Mega. Em cada rig, `attack01` e o loop de andar, em todos os quadros (não só 4).

  **Tolerâncias por componente (revisão: prioridade alta).** O ponto de partida medido foi 0,23% de H no pior osso do Golisopod.

  | Componente | Aceite | Por quê |
  |---|---|---|
  | Posição, pior osso de todos os quadros | ≤ 0,25% de H | não pode ficar pior que o caso já medido |
  | Posição, mediana dos ossos | ≤ 0,01% de H | o erro típico tem de ser praticamente zero |
  | Orientação, pior osso (ângulo entre quaternions do mundo) | ≤ 0,5° | posição sozinha esconde osso girado no próprio eixo |
  | Orientação, mediana | ≤ 0,05° | |

  `paridade_fk.py` passa a imprimir também `erro_ang_max_graus` e `erro_ang_mediana_graus`, comparando com `pose_bone.matrix` do Blender. **Qualquer rig acima de uma tolerância não é aceito "por ser pouco".** Ele vira uma investigação própria (superpowers:systematic-debugging), com hipótese e teste, antes de seguir. Hipótese inicial a conferir: o erro de 3,3 mm no quadro 89 do Golisopod coincide com uma faixa de escala ≠ 1. Grava `dumper test/za-referencias/evidencia/paridade_fk.json`; o resumo vai para o README.
- [ ] **Step 6: Regerar o banco** com `faixas_sem_osso`, `escala_animada` e `escala_max_desvio` por clipe, e registrar no relatório quantos clipes têm escala animada.
- [ ] **Step 7: Commit.**

### Task 3: Ontologia funcional e papéis na ação (1C)

**Correção da revisão (crítica):** saber qual osso mais se move não é entender a ação. A tarefa deixa de escolher "um efetor permitido" e passa a atribuir **papéis**: quem executa o golpe (um ou mais), quem inicia o movimento e quem só acompanha. Rosto e apêndices **não** ficam proibidos: mandíbula e língua podem executar uma mordida. O que decide é a regra por ação + anatomia, e um humano pode corrigir. Também não basta provar que a pálpebra saiu; os testes precisam mostrar que o golpe certo foi identificado.

**Files:**
- Create: `tools/za-referencias/ontologia.py`, `tools/za-referencias/regras_papeis.json` (regras editáveis), `tools/za-referencias/revisoes_efetor.json` (começa `{}`), `tools/za-referencias/tests/test_ontologia.py`

**Interfaces:**
- Produces:
  - `REGIOES = ("nucleo","pescoco","cabeca","mandibula","lingua","olho_palpebra","braco_E","braco_D","perna_E","perna_D","cauda","asa_E","asa_D","apendice_sensorial","raiz","outro")`. A antiga `face` foi separada: `mandibula`/`lingua` são funcionais, `olho_palpebra` é expressivo.
  - `regioes(esq) -> list[str]` (uma por osso): token do nome mais herança do pai. Ex.: `left_finger_*` herda `braco_E`; `*jaw*|*mouth*` → `mandibula`; `*tongue*` → `lingua`; `*eye*|*eyelid*|*brow*` → `olho_palpebra`; `*feeler*|*ear*|*antenna*|*whisker*` → `apendice_sensorial`.
  - `anatomia(esq) -> {"pernas","bracos","asas": int, "cauda","mandibula","lingua","apendices": bool, "classe": "bipede"|"quadrupede"|"alado"|"serpentino"|"sem_membros"|"outro"}` (pelo esqueleto, não pela PokeAPI).
  - `papeis(clipe, esq, regs, categoria, anat) -> {"executores": [{"regiao","osso_ponta","evidencia":{...},"status"}], "iniciadores": [{"regiao","quadro_inicio"}], "acompanhantes": [{"regiao","motivo"}], "maior_percurso": {"osso","regiao"}, "status": "CANDIDATO"|"INCONCLUSIVO", "regra_aplicada": str}`.
  - `aplicar_revisoes(res, modelo, clipe, revisoes) -> res` (status `REVISADO`, `revisado_por`).

**Regras de papel** (`regras_papeis.json`, editável e citada na saída como `regra_aplicada`):
1. **Executor** = região cuja ponta tem pico de velocidade **e** cujo deslocamento no pico aponta para fora do corpo, na direção do avanço do núcleo. Pode haver mais de um: dois braços, cabeça + mandíbula. Entram como executores as regiões com pico ≥ 60% do maior pico entre as candidatas, dentro de ±4 quadros.
2. **Candidatas por ação e anatomia:**
   - `attack`/`rangeattack`: braços, pernas, cabeça, cauda e asas. Mandíbula e língua entram quando a anatomia tem mandíbula/língua **e** a mandíbula abre e fecha (amplitude angular ≥ 15°) no intervalo do pico do avanço. Apêndice sensorial só entra quando é a única cadeia longa da anatomia (`apendices` e nenhum membro).
   - Locomoção: pernas (asas para `fly`).
   - `olho_palpebra` nunca executa golpe. É expressão e fica em acompanhantes, com motivo.
3. **Iniciadores:** as regiões cujo início (20% do próprio pico) vem primeiro na janela do evento. Normalmente é o núcleo, mas o sistema registra o que medir.
4. **Acompanhantes:** regiões que se movem com atraso em relação a um executor ou ao núcleo, sem avanço próprio (follow-through: cauda, orelhas, antenas, pálpebras).
5. Sem candidata que cumpra a regra 1: `INCONCLUSIVO`, com o motivo.

- [ ] **Step 1: Escrever os testes** (rigs de `sintetico.py`; cada um prova **o golpe certo**, não só a ausência do errado)

```python
def test_soco_com_antena_executor_e_a_mao(self):
    r = ontologia.papeis(*sintetico.golpe_com_antena(), "attack", anat)   # antena percorre 3x mais que a mão
    self.assertEqual([e["regiao"] for e in r["executores"]], ["braco_D"])
    self.assertEqual(r["maior_percurso"]["regiao"], "apendice_sensorial")
    self.assertIn("apendice_sensorial", [a["regiao"] for a in r["acompanhantes"]])
def test_golpe_com_dois_bracos_tem_dois_executores(self):
    r = ontologia.papeis(*sintetico.golpe_dois_bracos(defasagem=2), "attack", anat)
    self.assertEqual(sorted(e["regiao"] for e in r["executores"]), ["braco_D", "braco_E"])
def test_cabecada_executor_e_a_cabeca(self):
    self.assertEqual([e["regiao"] for e in ontologia.papeis(*sintetico.cabecada(), "attack", anat)["executores"]], ["cabeca"])
def test_mordida_inclui_mandibula(self):
    r = ontologia.papeis(*sintetico.mordida(abertura_graus=30), "attack", anat_com_mandibula)
    self.assertIn("mandibula", [e["regiao"] for e in r["executores"]])
def test_mandibula_parada_nao_vira_executor(self):    # cabeçada com mandíbula fechada
    self.assertNotIn("mandibula", [e["regiao"] for e in ontologia.papeis(*sintetico.cabecada(), "attack", anat_com_mandibula)["executores"]])
def test_palpebra_nunca_executa(self):
    r = ontologia.papeis(*sintetico.so_palpebra(), "attack", anat)
    self.assertEqual(r["status"], "INCONCLUSIVO"); self.assertIn("olho_palpebra", [a["regiao"] for a in r["acompanhantes"]])
def test_nucleo_inicia_antes_do_braco(self):
    r = ontologia.papeis(*sintetico.cadeia_quadril_braco(atraso=3), "attack", anat)
    self.assertEqual(r["iniciadores"][0]["regiao"], "nucleo")
def test_serpente_bote_executor_cabeca(self):
    self.assertEqual(ontologia.papeis(*sintetico.serpente_bote(), "attack", anat_serpente)["executores"][0]["regiao"], "cabeca")
def test_revisao_humana_substitui(self):
    r = ontologia.aplicar_revisoes(r0, "pm0001_00_00", "00400_attack01",
        {"pm0001_00_00/00400_attack01": {"executores": ["cabeca"], "por": "Rafael"}})
    self.assertEqual(r["status"], "REVISADO"); self.assertEqual(r["revisado_por"], "Rafael")
def test_anatomia_quadrupede(self):
    self.assertEqual(ontologia.anatomia(sintetico.quadrupede())["classe"], "quadrupede")
```

- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar** `regioes`, `anatomia` e `papeis` seguindo as regras acima. Os limiares 60%, ±4 q e 15° vêm de `regras_papeis.json`, nunca do código.
- [ ] **Step 4: Rodar e ver passar.**
- [ ] **Step 5: Conferência no corpus com gabarito.** Os números contam como **contagem**, não como acerto:
  - Nos 441 `00400_attack01`, contar executores por região, quantos têm 2+ executores e quantos ficam `INCONCLUSIVO`. Grava `evidencia/papeis_attack01.json`.
  - **Acerto de verdade:** 30 `attack01` sorteados (semente 1025, uma forma por espécie, de classes anatômicas variadas) vão para o lote de rotulagem da Task 9 com a pergunta "quem executa o golpe?". O papel calculado só passa a valer como "acertado" depois desse gabarito. Enquanto isso, fica `CANDIDATO`.
  - Esta conferência tem sua própria página no relatório, com folha visual (Task 6) e papel calculado lado a lado, para você olhar.
- [ ] **Step 6: Commit.**

### Task 4: Cinemática por região, eventos e follow-through (1D + L02/L03/L05)

**Files:**
- Create: `tools/za-referencias/cinematica.py`, `tools/za-referencias/tests/test_cinematica.py`
- Modify: `tools/za-referencias/metricas.py`, `tools/za-referencias/gerar_banco.py`

**Interfaces:**
- Consumes: `ontologia.regioes`, `ontologia.papeis`.
- Produces:
  - `curvas_regiao(clipe, esq, regs, raiz) -> dict[regiao, {"vel": np.ndarray, "acel", "jerk"}]` (H/s, H/s², H/s³).
  - `eventos(vel, fps, proeminencia=0.25) -> list[{"inicio","pico","fim"}]` (vários picos).
  - `ordem_ativacao(curvas, janela, alfa=0.2) -> list[{"regiao","quadro_inicio"}]`, ordenada.
  - `follow_through(curvas, regiao_ref, regioes_apendice) -> list[{"regiao","atraso_q","amortecimento"}]`.
  - `metricas.medir` passa a usar `papeis()["executores"]` para antecipação/overshoot (com 2+ executores, mede cada um e guarda a lista) e guarda os valores antigos como `antecipacao_q_maior_percurso` etc. Clipe com `quadros < 3` ou sem osso animado devolve `{"parado": True, "status": "INCONCLUSIVO"}`.
  - Séries densas por modelo em `dumper test/za-referencias/series/<modelo>.npz` (local).

- [ ] **Step 1: Escrever os testes**

```python
def test_golpe_com_dois_picos_vira_dois_eventos(self):
    self.assertEqual(len(cinematica.eventos(sintetico.vel_dois_picos(), 60)), 2)
def test_nucleo_antes_do_braco(self):        # núcleo começa no q10, braço no q13
    o = cinematica.ordem_ativacao(*sintetico.cadeia_quadril_braco(atraso=3))
    self.assertEqual([x["regiao"] for x in o][:2], ["nucleo", "braco_D"]); self.assertEqual(o[1]["quadro_inicio"] - o[0]["quadro_inicio"], 3)
def test_cauda_atrasada_e_amortecida(self):
    f = cinematica.follow_through(*sintetico.cauda_amortecida(atraso=4, razao=0.5))
    self.assertEqual(f[0]["atraso_q"], 4); self.assertAlmostEqual(f[0]["amortecimento"], 0.5, 1)
def test_clipe_de_um_quadro_inconclusivo(self):
    self.assertEqual(metricas.medir(sintetico.um_quadro(), esq)["status"], "INCONCLUSIVO")
def test_reprocessamento_deterministico(self):
    self.assertEqual(json.dumps(metricas.medir(c, e), sort_keys=True), json.dumps(metricas.medir(c, e), sort_keys=True))
```

- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.** Velocidade por região = média da velocidade dos ossos da região relativa à raiz. Picos com proeminência ≥ 25% do maior pico. A ordem usa o início de cada região a partir de 20% do pico dela.
- [ ] **Step 4: Rodar e ver passar.**
- [ ] **Step 5: Regerar o banco** (≈10 min, em segundo plano). Conferir no relatório quantos `attack01` têm mais de 1 evento e a distribuição de "quem começa primeiro" por classe anatômica.
- [ ] **Step 6: Commit.**

### Task 5: Corpo, apoio e locomoção (1E + L04/L06)

**Correção da revisão (crítica):** o Z-A não traz a geometria do chão, só ossos e o deslocamento da raiz. Por isso o contato tem **três níveis**, e o escorregão só é afirmado quando o referencial é confiável:
- `CONTATO_INFERIDO`: o pé está perto de um plano de chão **estimado** e quase parado nesse referencial. É sempre inferência; o Z-A sozinho nunca dá `CONTATO_CONFIRMADO`.
- `CONTATO_CONFIRMADO`: só por revisão visual (Task 6 / Task 9) ou por um chão fornecido por outra fonte (ex.: cena do Arenamon).
- `SEM_INFORMACAO`: não dá para decidir. Casos: sem pernas, plano do chão instável no clipe (pulo, queda), raiz sem deslocamento quando ele seria necessário para separar esteira de escorregão, ou pé que nunca chega perto do plano.

**Files:**
- Create: `tools/za-referencias/contato.py`, `tools/za-referencias/tests/test_contato.py`

**Interfaces:**
- Consumes: `ontologia.regioes`, `ontologia.anatomia`.
- Produces:
  - `plano_chao(clipe, esq, regs) -> {"y": float|None, "fonte": "repouso"|"minimos_do_clipe", "estavel": bool, "dispersao_H": float}`. Junta o Y mínimo das pontas de perna em repouso com o percentil 5 da altura das pontas ao longo do clipe. Fica `estavel = False` quando os mínimos por passo variam mais de 2% de H.
  - `apoio_por_pe(clipe, esq, regs, chao, tol_altura=0.02, tol_vel=0.15) -> {"por_pe": {osso: list["CONTATO_INFERIDO"|"BALANCO"|"SEM_INFORMACAO"]}, "status", "motivos": [...]}`.
  - `locomocao(apoios, traj_raiz, fps, chao) -> {"cadencia_passos_s","simetria","modo":"real"|"esteira"|"SEM_INFORMACAO","escorregoes":[{"osso","quadros","deslize_H","nivel":"INFERIDO"}],"motivos"}`.
  - `massa_sobre_base(clipe, esq, apoios) -> {"proxy":"centroide_ossos","dentro_da_base_frac":float|None}`. Fica `None` quando não há pelo menos 2 contatos inferidos.

  Regras de escorregão:
  - Só é calculado com `chao.estavel` **e** com o modo decidido.
  - Na esteira (raiz sem deslocamento e pés em ciclo), o pé em contato desliza para trás em relação ao corpo: isso **não** é escorregão.
  - No modo real, escorregão é contato inferido com deslize horizontal no espaço do modelo acima de `tol_vel`.
  - Sem modo decidido, o resultado é `SEM_INFORMACAO`, nunca "sem escorregão".

- [ ] **Step 1: Escrever os testes**

```python
def test_andar_com_deslocamento_sem_escorregao(self):
    self.assertEqual(contato.locomocao(*sintetico.andar_real())["escorregoes"], [])
def test_andar_parado_e_esteira_sem_escorregao(self):
    r = contato.locomocao(*sintetico.andar_esteira()); self.assertEqual(r["modo"], "esteira"); self.assertEqual(r["escorregoes"], [])
def test_pe_deslizando_e_escorregao_inferido(self):
    e = contato.locomocao(*sintetico.pe_deslizando())["escorregoes"]; self.assertEqual(len(e), 1); self.assertEqual(e[0]["nivel"], "INFERIDO")
def test_pulo_deixa_chao_instavel_e_sem_informacao(self):
    ch = contato.plano_chao(*sintetico.pulo()); self.assertFalse(ch["estavel"])
    self.assertEqual(contato.locomocao(*sintetico.pulo_locomocao())["modo"], "SEM_INFORMACAO")
def test_serpente_sem_informacao(self):
    self.assertEqual(contato.apoio_por_pe(*sintetico.serpente_bote())["status"], "SEM_INFORMACAO")
def test_nunca_contato_confirmado_sozinho(self):
    r = contato.apoio_por_pe(*sintetico.andar_real())
    self.assertNotIn("CONTATO_CONFIRMADO", {s for v in r["por_pe"].values() for s in v})
def test_pico_de_velocidade_nao_cria_contato(self):   # golpe no ar: a mão não aparece como contato
    self.assertNotIn("mao_D", contato.apoio_por_pe(*sintetico.golpe_no_ar())["por_pe"])
```

- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar e ver passar.**
- [ ] **Step 5: Corpus.** Nos loops `walk01`/`run01`, registrar no banco a cadência, a simetria, o modo, os escorregões inferidos e os motivos de `SEM_INFORMACAO`, por clipe. O relatório ganha a seção "Locomoção" com a distribuição por classe anatômica e a **taxa de `SEM_INFORMACAO`**, mostrada, não escondida. Abrir no Blender 3 casos marcados como escorregão e 3 como esteira (via `pokemon_za.py`). Conferir visualmente e registrar no README se a inferência bateu.
- [ ] **Step 6: Commit.**

### Task 6: Linguagem visual com folhas multivista (1F + L07)

**Files:**
- Create: `tools/za-referencias/folhas_visuais.py`, `tools/za-referencias/tests/test_folhas.py`

**Interfaces:**
- Consumes: `scripts/blender-vision/perception_geom.py` (`candidate_views`, `independent_of`, `fit_span`), `cinematica.eventos`, `tools/za-extrator/montar_blend.py`.
- Produces:
  - `quadros_para_folha(eventos, n_quadros, limite=8) -> list[int]` (puro).
  - `vistas_independentes(direcoes, min_graus=35) -> list` (puro; reaproveita `independent_of`).
  - CLI no Blender: `blender -b <x.blend> --python folhas_visuais.py -- <clipe> <saida>` gera `folha_<clipe>_<vista>.png`, com código de leitura estampado, região do efetor em laranja e `indice.json`.

- [ ] **Step 1: Escrever os testes**

```python
def test_quadros_incluem_inicio_pico_fim_de_cada_evento(self):
    q = folhas_visuais.quadros_para_folha([{"inicio":5,"pico":20,"fim":40},{"inicio":50,"pico":60,"fim":80}], 100)
    self.assertTrue({5, 20, 40, 50, 60, 80} <= set(q))
def test_vistas_com_menos_de_35_graus_nao_contam_como_duas(self):
    self.assertEqual(len(folhas_visuais.vistas_independentes([(1,0,0),(0.95,0.31,0)])), 1)
```

- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar e ver passar.**
- [ ] **Step 5: Smoke real.** Gerar as folhas do `00400_attack01` do Golisopod e de um quadrúpede em 2 vistas independentes. **Abrir as imagens com Read** e conferir se o efetor em laranja aparece. Região escondida nas duas vistas fica `NAO_OBSERVAVEL` no `indice.json`. As folhas ficam em `dumper test/za-referencias/folhas/`, com link no relatório.
- [ ] **Step 6: Commit.**

### Task 7: Poses-chave controladas por erro de posição e de orientação (1G + L10)

**Correção da revisão (crítica):** medir só o erro de posição deixa passar um osso que gira no próprio eixo (mão que torce, cabeça que inclina) sem mudar de lugar. A simplificação passa a respeitar **dois** limites, posição e ângulo. Os extremos de rotação expressiva são chaves obrigatórias.

**Files:**
- Create: `tools/za-referencias/poses_chave.py`, `tools/za-referencias/tests/test_poses_chave.py`

**Interfaces:**
- Consumes: `za_anim.Esqueleto.fk_completa` (posições + rotação no mundo), `cinematica.eventos`, `ontologia.regioes`.
- Produces:
  - `simplificar(clipe, esq, tol_H=0.01, tol_graus=3.0, obrigatorios=(), regs=None) -> {"quadros": [int], "erro_max_H": float, "erro_max_graus": float, "erro_por_osso": {nome: {"pos_H": float, "graus": float}}, "obrigatorios_por_motivo": {"evento": [...], "extremo_rotacao": [...]}, "status": "APROXIMACAO"}`.
  - `reconstruir(clipe, esq, quadros) -> (posicoes [F,B,3], rot_mundo [F,B,3,3])`.
  - `extremos_de_rotacao(clipe, esq, regs, limiar_graus=10.0) -> list[int]`: quadros onde a velocidade angular local de um osso de `cabeca`/`braco_*`/`perna_*`/`cauda` troca de sinal, com amplitude ≥ 10° em relação ao vizinho anterior.

  A reconstrução faz slerp das rotações locais e interpolação linear das translações entre as chaves, seguidos da FK completa. O erro angular é o ângulo entre a rotação no mundo original e a reconstruída. O laço guloso adiciona o quadro que mais viola **qualquer** dos dois limites (normalizado por `tol_H` ou `tol_graus`) até os dois serem cumpridos. São obrigatórios: início, pico e fim de cada evento, e os extremos de rotação.

- [ ] **Step 1: Escrever os testes**

```python
def test_movimento_linear_precisa_de_duas_chaves(self):
    self.assertEqual(poses_chave.simplificar(*sintetico.linear())["quadros"], [0, 59])
def test_uma_dobra_vira_tres_chaves(self):
    self.assertEqual(len(poses_chave.simplificar(*sintetico.dobra_no_q30())["quadros"]), 3)
def test_torcao_sem_mudar_posicao_exige_chave(self):   # mão gira 40° no próprio eixo do q20 ao q30 e volta; posição constante
    r = poses_chave.simplificar(*sintetico.torcao_de_mao())
    self.assertIn(30, r["quadros"]); self.assertLessEqual(r["erro_max_graus"], 3.0 + 1e-6)
def test_extremo_de_rotacao_da_cabeca_e_obrigatorio(self):
    r = poses_chave.simplificar(*sintetico.cabeca_inclina(pico_q=25, graus=20), regs=regs)
    self.assertIn(25, r["obrigatorios_por_motivo"]["extremo_rotacao"])
def test_eventos_obrigatorios_preservados(self):
    self.assertIn(17, poses_chave.simplificar(c, e, obrigatorios=(17,))["quadros"])
def test_erro_reconstruido_dentro_das_duas_tolerancias(self):
    r = poses_chave.simplificar(c, e, tol_H=0.01, tol_graus=3.0)
    pos, rot = poses_chave.reconstruir(c, e, r["quadros"])
    self.assertLessEqual(np.abs(pos - c.posicoes).max() / H, 0.01 + 1e-9)
    self.assertLessEqual(angulo_max(rot, rot_original), 3.0 + 1e-6)
def test_nunca_afirma_chave_autoral(self):
    self.assertEqual(r["status"], "APROXIMACAO")
```

- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar e ver passar.**
- [ ] **Step 5: Corpus.** Por clipe, registrar `poses_chave_n`, `poses_chave_frac` (n/quadros), quantas chaves vieram de evento, de extremo de rotação e de erro, e a comparação com `chaves_por_faixa_esparsa`. O relatório mostra a distribuição por categoria, com o aviso "aproximação, não o blocking do animador". Em 3 clipes, abrir no Blender o original e a reconstrução lado a lado (Action derivada, nunca no `.blend` original) para conferir visualmente.
- [ ] **Step 6: Commit.**

### Task 8: Normas por subgrupo e aprovações por aspecto (1H)

**Files:**
- Create: `tools/za-referencias/normas.py`, `tools/za-referencias/aprovacoes_za.json` (começa `{"aprovacoes": []}`), `tools/za-referencias/tests/test_normas.py`
- Modify: `tools/za-referencias/gerar_relatorio.py` (usa `normas.py`; a tabela mostra n de clipes, espécies e rigs)

**Interfaces:**
- Consumes: `scripts/blender-vision/perception_refs.ASPECTS` (mesma lista de aspectos).
- Produces:
  - `grupo(clipes, categoria, fase, classe_anatomica=None, conjunto=0) -> {"status": "MEDIDO"|"SEM_BASE_COMPARAVEL", "motivos": [...], "n_clipes", "n_especies", "n_rigs", "medidas": {m: {"p10","p25","mediana","p75","p90","mad","iqr","faltantes_frac"}}, "aprovacao": {"aspectos_aprovados": [...], "art_approved_by": None}}`.
  - `aprovar(aspecto, grupo_id, por, escopo) -> dict`: sem `por` levanta `RefError`.

  `n_rigs` conta hashes distintos de pose de repouso (`rest_pose_hash` = sha256 de `loc_repouso`/`rot_repouso` arredondados a 1e-5).

- [ ] **Step 1: Escrever os testes**

```python
def test_formas_da_mesma_especie_contam_uma_vez(self):
    self.assertEqual(normas.grupo([c(esp=6, mod="pm0006_00_00"), c(esp=6, mod="pm0006_51_00")], "attack", "")["n_especies"], 1)
def test_grupo_pequeno_sem_base(self):
    g = normas.grupo(sete_especies, "attack", ""); self.assertEqual(g["status"], "SEM_BASE_COMPARAVEL"); self.assertIn("n_especies=7 < 8", g["motivos"])
def test_aprovar_sem_pessoa_falha(self):
    with self.assertRaises(RefError): normas.aprovar("timing", "attack||bipede|0", None, ["timing"])
def test_nada_aprovado_por_padrao(self):
    self.assertEqual(normas.grupo(muitos, "attack", "")["aprovacao"]["art_approved_by"], None)
```

- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar e ver passar.**
- [ ] **Step 5: Regerar o relatório e o `normas_za.json`.** O relatório ganha um seletor visível "n mínimo de espécies" (padrão 8) que esconde os grupos insuficientes em tempo real, e o rótulo "MEDIDO, NÃO APROVADO" em toda tabela. Abrir no navegador e mexer no seletor.
- [ ] **Step 6: Commit.**

### Task 9: Avaliação cega A/B, sem vazamento, com concordância entre revisores (1I)

**Correções da revisão (alta):**
1. Separar só por cadeia evolutiva não basta. Rigs compartilhados e animações quase iguais podem cair nos dois lados. O agrupamento passa a usar **três chaves unidas**: cadeia evolutiva, família de rig e origem da animação.
2. A avaliação é um **A/B completo nas mesmas animações**: Blender Vision atual (sem corpus) × Blender Vision com corpus. Mede precisão, falsos positivos, inconclusivos e concordância entre revisores.

**Files:**
- Create: `tools/za-referencias/avaliacao.py`, `tools/za-referencias/rotulagem.html`, `tools/za-referencias/tests/test_avaliacao.py`
- Modify: `tools/za-referencias/especies.json` (+ `cadeia_evolutiva` a partir de `evolution_chain_id` da PokeAPI)

**Interfaces:**
- Produces:
  - `familia_de_rig(esq) -> str`: hash da assinatura estrutural (nomes de osso ordenados + pais), **sem** a pose de repouso. Rigs com o mesmo esqueleto e proporções diferentes caem na mesma família.
  - `origem_de_animacao(clipes) -> dict[id_clipe, id_grupo]`: o mesmo `sha256` do `.tranm` é a mesma origem. Clipes da mesma categoria/fase com correlação ≥ 0,98 da curva de energia reamostrada **e** da curva do executor também são considerados a mesma origem (quase duplicata).
  - `dividir(clipes, frac_teste=0.3, semente=1025) -> {"dev": [...], "teste": [...], "grupos": int, "relatorio_vazamento": {...}}`: union-find sobre as três chaves; cada componente vai inteiro para um lado.
  - `placar(previsoes, rotulos) -> {problema: {"precisao","revocacao","falsos_positivos","inconclusivos_corretos","inconclusivos_errados","n"}}`.
  - `concordancia(rotulos_por_revisor) -> {problema: {"kappa_cohen" (2 revisores) | "kappa_fleiss" (3+), "n_itens", "discordancias": [ids]}}`.
  - `ab(previsoes_a, previsoes_b, gabarito) -> {problema: {"a": placar, "b": placar, "diferenca": {...}, "conclusao": "MELHOROU"|"PIOROU"|"SEM_DIFERENCA_DEMONSTRAVEL"}}`. Usa um teste de McNemar pareado (α = 0,05) nos acertos; abaixo disso, `SEM_DIFERENCA_DEMONSTRAVEL`.
  - `rotulagem.html` abre as folhas da Task 6 e pede, por clipe: executores do golpe, iniciador, antecipação (sim/não/quadros), apoio, leitura da pose e massa aparente, com campo "discordo/observação" e o nome do revisor. **Não mostra** o que o sistema calculou (avaliação cega). Exporta JSON pelo botão "Baixar rótulos". Intenção e personalidade (L09) ficam **só** como rótulo humano.

**Protocolo A/B** (escrito no README antes de qualquer rodada):
1. Lote congelado de 40 clipes do conjunto de teste, com semente 1025, variados em categoria e classe anatômica. Inclui os 30 `attack01` da Task 3.
2. Pelo menos **2 revisores** independentes rotulam sem ver as saídas. O gabarito é a maioria. Itens sem acordo ficam marcados e saem da conta de acerto, entrando na de concordância.
3. A = `perception.py motion` atual nas mesmas animações; B = o mesmo fluxo com `za-compare`. As duas rodadas usam os mesmos arquivos e a mesma configuração, e são gravadas antes de ver o gabarito.
4. Só se declara melhora com `conclusao = MELHOROU` num problema, citando n, kappa e p. Caso contrário, o resultado é dito como é.

- [ ] **Step 1: Escrever os testes**

```python
def test_mesma_cadeia_nunca_nos_dois_lados(self):
    d = avaliacao.dividir(clipes_com_cadeias)
    self.assertFalse({c["cadeia"] for c in d["dev"]} & {c["cadeia"] for c in d["teste"]})
def test_mesmo_rig_de_cadeias_diferentes_fica_junto(self):    # duas espécies sem parentesco com o mesmo esqueleto
    d = avaliacao.dividir(dois_com_mesmo_rig)
    self.assertFalse({c["familia_rig"] for c in d["dev"]} & {c["familia_rig"] for c in d["teste"]})
def test_animacao_quase_identica_fica_junto(self):            # correlação 0,99 em espécies diferentes
    d = avaliacao.dividir(quase_duplicatas)
    self.assertEqual(len({lado for lado in ("dev", "teste") if any(c["id"] in ids_dup for c in d[lado])}), 1)
def test_placar_conta_inconclusivo_correto(self):
    p = avaliacao.placar([{"id":1,"antecipacao":"INCONCLUSIVO"}], [{"id":1,"antecipacao":"INCONCLUSIVO"}])
    self.assertEqual(p["antecipacao"]["inconclusivos_corretos"], 1)
def test_kappa_concordancia_perfeita_e_1(self):
    self.assertAlmostEqual(avaliacao.concordancia({"r1": rot, "r2": rot})["antecipacao"]["kappa_cohen"], 1.0)
def test_ab_sem_diferenca_quando_iguais(self):
    self.assertEqual(avaliacao.ab(prev, prev, gab)["antecipacao"]["conclusao"], "SEM_DIFERENCA_DEMONSTRAVEL")
```

- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar e ver passar.**
- [ ] **Step 5: Gerar e congelar o lote** de 40 clipes e o pacote de rotulagem (folhas + `rotulagem.html`) em `dumper test/za-referencias/avaliacao/lote_01/`, com hash do lote. Gravar o `relatorio_vazamento` da divisão: grupos, maiores componentes e quantas uniões cada chave causou. **Os rótulos são de pessoas, não meus.** Os limiares das Tasks 3–5 nunca podem ser ajustados com o conjunto de teste.
- [ ] **Step 6 (depois que os rótulos chegarem): rodar o A/B** e publicar no relatório a página "Avaliação", com placar A e B, kappa e conclusão por problema.
- [ ] **Step 7: Commit.**

### Task 10: API única e integração aditiva com os addons (1J), com portão

**Portão E (antes de qualquer mudança nos addons).** A revisão pede para preservar as funcionalidades exclusivas antes de integrar:
1. **Inventário das duas versões do Motion Lens** (só leitura): diff completo entre a do repositório (2.115 linhas, SHA `5d751b4e…`) e a instalada (1.924 linhas, SHA `e39adb0e…`). Listar cada operador, painel, propriedade e função **exclusivo** de cada lado (ex.: `motionlens.strike` e `motionlens.apply_impact` só existem no repositório), com o commit de origem (`git log -L`). Grava `docs/za-referencias/motion_lens_versoes.md`.
2. **Decisão do usuário**, com o inventário na mão: qual é a base oficial, e se as exclusivas do outro lado são incorporadas.
3. **Preservação:** antes de qualquer edição, copiar as duas versões, com o SHA no nome, para `scripts/blender-vision/addons/_versoes/`. Se a base escolhida não tiver as exclusivas aprovadas, elas entram num commit separado, **antes** do código do Z-A, com um teste de presença de cada operador.
4. Teste de regressão: depois da integração, todos os operadores que existiam na base continuam registrados (`hasattr(bpy.ops.motionlens, nome)` em segundo plano no Blender).

Sem os itens 1–3, a Task 10 faz só `za_corpus.py` e o comando do Blender Vision.

**Files:**
- Create: `tools/za-referencias/za_corpus.py`, `tools/za-referencias/tests/test_za_corpus.py`
- Modify (aditivo): `scripts/blender-vision/perception.py` (comando `za-compare`), `scripts/blender-vision/addons/motion_lens.py` (operador `motionlens.za_compare` + bloco de painel), `scripts/blender-vision/addons/direction_lines.py` (operador `dirlines.functional_map`)
- Test: `scripts/blender-vision/tests/test_motion_lens_background.py` (novo caso), `scripts/blender-vision/tests/test_perception.py` (novo caso)

**Interfaces:**
- Consumes: `normas.grupo`, `ontologia.regioes`/`anatomia`, `metricas.medir`, `perception_refs.compare`.
- Produces:
  - `consultar(categoria, fase="", classe_anatomica=None, n_min=8) -> normas.grupo(...)`.
  - `comparar(medidas: dict, grupo: dict) -> {"status", "por_medida": {m: {"valor","percentil","faixa_p10_p90","fora_da_faixa_empirica": bool}}, "adequacao_artistica": "NAO_AVALIADA", "texto": [...]}`. O texto nunca contém "pior", "errado" nem "ruim".
  - `mapa_funcional(esq_origem_regs, esq_destino_regs) -> [{"origem","destino","status":"PENDENTE_REVISAO"|"SEM_CORRESPONDENCIA","prova":{"regiao","profundidade_na_cadeia","comprimento_rel"}}]`. A correspondência é por região + posição na cadeia + comprimento relativo, **nunca só pelo nome**.

- [ ] **Step 1: Escrever os testes**

```python
def test_comparar_nunca_julga(self):
    r = za_corpus.comparar({"ate_pico_s": 0.1}, grupo_medido)
    self.assertEqual(r["adequacao_artistica"], "NAO_AVALIADA")
    self.assertFalse(any(p in " ".join(r["texto"]).lower() for p in ("pior", "errado", "ruim")))
def test_comparar_grupo_pequeno_sem_base(self):
    self.assertEqual(za_corpus.comparar({}, grupo_sem_base)["status"], "SEM_BASE_COMPARAVEL")
def test_mapa_nao_casa_so_por_nome(self):   # destino tem "left_hand" numa cauda
    m = za_corpus.mapa_funcional(regs_a, regs_b_nome_enganoso)
    self.assertNotEqual(next(x for x in m if x["origem"] == "left_hand")["destino"], "left_hand")
```

- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar `za_corpus.py`** e o comando `perception.py za-compare --motion <motion.json> --categoria attack --classe bipede`, que grava `za_compare.json`.
- [ ] **Step 4: Rodar e ver passar** (os testes novos e a suíte inteira do Blender Vision: `python scripts/blender-vision/tests/test_perception.py`, `test_perception_failures.py`).
- [ ] **Step 5 (só com o Portão E respondido): Motion Lens.**
  - No painel: seletor "Categoria do clipe", seletor "Classe do corpo", slider "n mínimo de espécies (padrão 8)" e botão "Comparar com Z-A".
  - O operador lê o `normas_za.json` versionado e escreve um relatório HTML com percentis, n e "adequação artística: não avaliada".
  - Teste em segundo plano no Blender, na cópia combinada com o usuário. Copiar para `scripts/addons/` só depois do teste.
- [ ] **Step 6 (idem): Direction Lines.** O operador `dirlines.functional_map` grava o mapa como bloco de texto `DL_MapaFuncional` com status `PENDENTE_REVISAO`. Não retargeta nada.
- [ ] **Step 7: Commit, e documentação no portal.** Card atualizado, `docs/za-referencias/README.md` com "como usar no Blender" e `docs/BLENDER_ADDONS_MOTION_LENS.md` com os SHA novos.

---

## Checklist de aceite da REV2 → tarefa

| Item da REV2 (seção 13) | Onde é provado |
|---|---|
| Contagens reconciliadas por ID | Task 1, Step 5 |
| 36/11/53% com denominador | Task 1, Step 6 |
| 3D e escala em rigs diferentes | Task 2, Steps 5–6 |
| Efetor revisável ≠ maior deslocamento | Task 3 (papéis + gabarito humano de 30 ataques) |
| Ação + anatomia com n e cobertura | Task 8 |
| Curvas por cadeia, fases, sem falso contato | Tasks 4 e 5 |
| Poses-chave por erro, sem chave autoral | Task 7 |
| Revisão visual com vistas suficientes | Task 6 |
| Blender Vision mantém NAO_AVALIADA | Task 10 (teste `comparar_nunca_julga`) |
| Motion Lens compara sem reprovar | Task 10, Step 5 |
| Direction Lines sem remapeamento por nome | Task 10 (teste `mapa_nao_casa_so_por_nome`) |
| Originais e `.blend` intactos; sem binários no Git | Global Constraints + `git status` em cada commit |
| Superior em teste humano cego | Task 9 entrega a ferramenta; **o resultado depende dos rótulos humanos** |
| Diff, testes, evidências e limites | Resposta final de cada tarefa |

## Fora deste plano (decisões que não são minhas)

- O conflito AGENTS.md × README.md sobre publicação de recursos do Z-A.
- Qual Motion Lens é o oficial (Portão E).
- Quem rotula o lote da Task 9 e quando.
- O significado dos conjuntos 1xxxx–4xxxx (não inferir).

## Coberto só em parte (declarado)

- **L08, deformação da malha:** este plano mede a escala animada dos ossos (Task 2). Squash/stretch e deformação na malha exigem render e malha deformada; ficam para depois da Task 6, se você quiser.
- **L09, intenção e personalidade:** só como rótulo humano (Task 9), nunca calculado.
- **Melhora "demonstrável" (REV2 §9):** só existe depois que houver rótulos humanos e o A/B com e sem corpus rodar. O plano entrega os meios, não o resultado.
