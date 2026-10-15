# Laboratório de combate — ambiente de calibração (fases 1 a 5)

Branch `feat/combat-lab-calibracao`, criada a partir da `main` em `74ecbb8`. O HTML de referência anexado era idêntico, byte a byte, ao build dessa `main`, então nenhuma funcionalidade mais recente ficou para trás. Nada foi mesclado na `main`. O GDD e o jogo oficial (`prototypes/game`) não foram alterados.

**Como abrir**
- **Laboratório:** `prototypes/combat-lab/dist/arenamon-combate-laboratorio.html`. Continua sendo um HTML único e offline, aberto com dois cliques.
- **Painel de relatórios:** `prototypes/combat-lab/dist/arenamon-painel-relatorios.html`. É complementar e também offline.
- **Servidor local (opcional):** `npm run dev:combat-lab` abre http://127.0.0.1:5173. Recompila ao salvar e dá acesso às pastas do projeto. Não é necessário para jogar.
- **Build:** `npm run build:combat-lab` gera os dois HTMLs.

As evidências ficam em [`evidence/calibracao/`](evidence/calibracao/): capturas, relatórios dos testes, benchmark e avaliação da IA.

---

## Fase 1 — Workspace persistente e backup

**Auditoria do que existia.** O `localStorage` guardava quatro coisas:
- ajustes (`arenamon-lab-session-v7`);
- presets (`arenamon-lab-presets-v7`);
- associações de animação por **nome de arquivo** (`arenamon-lab-anim-v1:<nome>`);
- homologação.

Modelos e animações importadas não eram guardados: era preciso carregá-los de novo a cada sessão.

**Armazenamento (`src/workspace/`).** O backend é escolhido por **gravação de teste**, não pela simples existência da API:
1. **IndexedDB.** GLBs e animações vão como `ArrayBuffer`, nunca como base64.
2. **localStorage.** Só para o JSON; os modelos ficam apenas na aba, e a interface avisa.
3. **Memória.** Nada persiste, e a interface avisa.

Garantias:
- **Identidade:** cada arquivo é identificado pelo SHA-256 do conteúdo. Arquivos iguais com nomes diferentes viram um só asset; nomes iguais com conteúdos diferentes são assets distintos.
- **Integridade:** o hash é conferido em toda leitura. Uma cópia danificada não é carregada; é regravada quando o arquivo é escolhido de novo.
- **Gravação honesta:** uma gravação só é dada como concluída no `oncomplete` da transação. Cota esgotada e outras falhas aparecem em vermelho e nunca como "salvo".
- **Exclusão** só por ação explícita, com confirmação. Personagens › Armazenamento mostra o espaço usado e oferece "Liberar não usados" e "Pedir armazenamento persistente".
- **Migração:** os ajustes v7 e as associações por nome viram estado por SHA-256 na primeira vez. Os dados antigos não são apagados.

**O que é restaurado ao abrir:**
- modelos por slot e animações importadas, na ordem original (os nomes dos clipes dependem dela);
- variantes, velocidades e offsets;
- ajustes físicos, de combate e de VFX, além do HUD;
- preferências de interface (aba, sobreposições, câmera lenta, modos);
- última partida (semente, perfis, modo da IA) e histórico de calibrações;
- sequências gravadas e benchmarks.

Em Personagens, cada slot tem "↺ Reabrir último modelo utilizado" e "Restaurar automaticamente na próxima sessão", independentes para o azul e o vermelho. Uma falha diz o motivo (ausente, corrompido, formato) e pede para escolher o arquivo de novo.

**Backup (Exportar).**
- "Exportar Workspace Completo" gera um ZIP próprio, sem dependências, contendo: `manifest.json` versionado, `workspace.json`, `presets.json`, `homologation.json` e `assets/<sha256>.glb`.
- "Importar Workspace Completo" valida tudo **antes** de mudar qualquer coisa: esquema, versão (versões futuras são recusadas), CRC-32, SHA-256 de cada arquivo e referências entre modelos, clipes e estados.
- Em seguida mostra uma prévia (ajustes diferentes, modelos, presets em conflito) com opções por item: usar o do pacote ou manter o atual; para presets em conflito, também manter os dois.
- Antes de aplicar, os ajustes atuais viram o ponto "Antes da importação" no histórico, e Ctrl+Z desfaz.

**Comportamento que mudou de propósito.**
- A sessão é restaurada automaticamente, com o aviso "Desfazer restauração". A preferência fica em Exportar › Workspace.
- O aviso nativo ao fechar só aparece se o workspace não conseguiu salvar. A preferência "Avisar ao fechar com ajustes não exportados" recupera o comportamento anterior.

## Fase 2 — Presets, calibração simplificada, A × B jogável e gravador

**Presets (Ajustes).**
- Cada preset tem nome, versão, descrição, datas e escopo: **completo** ou **por categorias**. São 15 categorias, como locomoção, sprint, curvas de X/C, animação, câmera, VFX e regras.
- Aplicar um preset de locomoção nunca toca VFX, HUD, câmera ou regras.
- Ações disponíveis: Aplicar (mostra **antes** quantos parâmetros mudam, por categoria), Duplicar, Renomear, Atualizar com os atuais (sobe a versão), Excluir, Comparar, Medir e "↶ Restaurar estado anterior".
- Os presets antigos foram migrados para o workspace.

**Presets iniciais.** São propostas para avaliação, **não valores aprovados**. Mudam só locomoção, sensação do sprint, curvas de X/C e transições de animação. Valores principais (padrão do laboratório → Storm-like / Etapa A / Pesado):

| Parâmetro | Padrão | Storm-like | Etapa A | Pesado |
|---|---|---|---|---|
| Aceleração (m/s²) | 26 | 40 | 30 | 15 |
| Frenagem (m/s²) | 22 | 34 | 30 | 13 |
| Inversão (m/s²) | 38 | 62 | 48 | 22 |
| Curva acel. / frenagem | 0,45 / 0,35 | 0,55 / 0,50 | 0,20 / 0,15 | 0,20 / 0,20 |
| Atrito / residual | 0,8 / 0,25 | 1,1 / 0,35 | 0,6 / 0,15 | 0,45 / 0,40 |
| Aderência lateral | 34 | 52 | 40 | 18 |
| Giro (°/s) / acel. angular | 720 / 90 | 1080 / 160 | 720 / 120 | 450 / 40 |
| Sprint (×, acel., frenagem) | 1,55 · 16 · 12 | 1,8 · 26 · 15 | 1,55 · 18 · 14 | 1,45 · 10 · 8 |
| C: preparação / impulso | 6% / 14% | 3% / 10% | 6% / 14% | 10% / 18% |
| Transição / ações (s) | 0,18 / 0,07 | 0,14 / 0,05 | 0,18 / 0,07 | 0,24 / 0,09 |

Medido com a sequência padrão (mesmos comandos e estado inicial; `test/calibration.test.mjs`), na ordem padrão · Storm-like · Etapa A · Pesado:

| Medida | Padrão | Storm-like | Etapa A | Pesado |
|---|---|---|---|---|
| Até 95% da caminhada | 225 ms | 150 ms | 167 ms | 333 ms |
| Inversão até v = 0 | 125 ms | 75 ms | 100 ms | 217 ms |
| Inversão até 95% no novo sentido | 350 ms | 233 ms | 267 ms | 550 ms |
| Frenagem (andando exausto, 3,4 m/s) | 175 ms | 117 ms | 117 ms | 267 ms |
| Distância de frenagem | 0,25 m | 0,17 m | 0,17 m | 0,42 m |
| Velocidade máx. no sprint | 9,6 m/s | 11,5 m/s | 9,6 m/s | 8,0 m/s |

**Calibração simplificada (modo simples).** São 16 controles que editam os **parâmetros oficiais**, sem cópias. Cada um lista, logo abaixo, os parâmetros que edita.
- **Controles diretos:** velocidade de caminhada (do perfil em uso), aceleração, frenagem, fricção, inversão, velocidade do sprint, distância e duração de C e de X.
- **Conjuntos documentados, de 0 a 100% (50% = padrão):**
  - inércia: curvas e velocidade residual;
  - giro: giro, giro visual e aceleração angular;
  - impulso de C e de X: preparação, impulso e velocidade de preparação;
  - transições de animação;
  - intensidade visual dos impactos: hit, clash, chão e tremores.
- O valor exibido é sempre derivado dos parâmetros reais. Quando eles foram ajustados um a um no modo avançado, o controle avisa que divergem.
- As transições de animação passaram a ser parâmetros oficiais (`display.animation.*`), com desfazer, presets, exportação e workspace. Os sliders da aba Personagens editam esses mesmos parâmetros.

**Comparação jogável A × B (Ajustes).**
- Escolha A e B e alterne pela tecla configurável em Controles (padrão **B**), sem reiniciar a partida. Um indicador discreto mostra "PRESET A/B" e quantos parâmetros aguardam.
- Auditoria da troca durante a partida (`sim/presets.js › switchClass`):
  - **Na hora:** locomoção, sprint, animação, câmera, VFX e IA. São lidos a cada passo, então a velocidade continua do estado atual: sem teletransporte nem mudança retroativa.
  - **Só em limite seguro:** curvas, durações e distâncias de X/C, regras, combate e atributos. Esperam que nenhum lutador esteja em ação, recuo, stun, voo, recuperação, empurrão, buffer ou hitstop.
  - **Nunca:** passo da simulação, arena, vida e stamina máximas e teclas. São listados para o usuário.
- A troca nunca escreve stamina, vida, posição ou estado de combate, e só mudam os parâmetros que A ou B definem.
- Ao encerrar, você escolhe manter A, B ou o estado anterior (com desfazer).

**Gravador de movimento (Cenários).**
- Grava alguns segundos jogando (comandos dos dois lados, a partir do estado salvo da partida) ou usa a **sequência padrão** roteirizada: direita → inverte → C → sprint → X → anda → freia.
- Reexecuta com o **mesmo motor** (`Game.step`): mesmo estado inicial, mesma semente e mesmos comandos, com os parâmetros de A e de B. Não existe um segundo simulador.
- Mede:
  - distância, velocidades média e máxima, tempo até a velocidade, frenagem e inversão;
  - duração e distância de X e de C, stamina e colisões;
  - transições de estado e, se houver modelo, de animação reais (cópia do personagem sem cena).
- Gráficos: velocidade, aceleração, posição X/Z, distância e stamina, mais uma faixa de estados. Marcadores: inversão, v = 0, início e fim de C, X e sprint, colisões, interrupções e comandos negados. Há hover com tooltip.
- Exporta CSV por passo e relatório JSON. Também reproduz a sequência na arena com A; os valores voltam ao terminar.
- Se as condições diferirem (passo, arena), o relatório diz "não compare diretamente".

## Fase 3 — Diagnóstico, janelas, treino e validador

**Comandos negados.**
- O controlador relata cada tentativa (X, C, defesa, defesa perfeita, sprint) **no ponto em que decide**, com o próprio resultado de `startPermission` e a mesma condição de stamina (`sim/attempts.js`). Não existe uma lista paralela de regras.
- Mensagens como "X ignorado: stamina insuficiente (0,60 / 1,00)" e "C → X negado: fora da janela de cancelamento (abre em 92 ms)".
- Resultados possíveis: negado, guardado no buffer, buffer expirado (com o mesmo motivo) e executado (opcional).
- Onde aparece:
  - aviso curto na arena (só o jogador ou ambos);
  - histórico em Visualizar › Diagnóstico de comandos, com filtros e exportação;
  - relatórios do gravador.
- Teste de propriedade: em lutas IA × IA, **cada motivo relatado é uma condição verdadeira** naquele instante (285 tentativas verificadas), e a simulação é idêntica com e sem diagnóstico.

**Janelas de combate (Visualizar).**
- Barras acima dos lutadores, todas lidas do estado real: invulnerabilidade, C → X (quando abre e quanto falta), encadear, recuperação, guard stun, recuo, defesa perfeita e sua recarga, contra-ataque, buffer e hitstop.
- Configurações: só o jogador ou ambos, escala, opacidade e quais janelas mostrar.
- O motor não tem "hit stun" separado. O equivalente é voo + recuperação ao aterrissar, mostrado como Recuperação.

**Treino de defesa e esquiva perfeitas (Cenários).**
- O vermelho repete um ataque conhecido (frontal, diagonal, aproxima e investe, ou sorteado pela semente). O intervalo, a semente e a velocidade são configuráveis.
- Tudo é medido em **passos de simulação**:
  - início do ataque;
  - impacto: real ou **previsto pelo próprio motor**, quando o jogador saiu do caminho (reexecução sem a resposta dele);
  - comando e distância até a janela, por exemplo "Defesa executada 142 ms antes da janela perfeita.";
  - "Defesa perfeita em recarga" quando o toque não abriria a janela.
- O resultado é sempre o do motor (eventos `perfect` / `perfectDodge`). O limite foi verificado com exatidão: 23 passos antes do impacto ainda é perfeita; 24 já não é.
- Placar, erro médio, histórico, exportação e reinício rápido (R).

**Validador (Personagens).**
- Verifica: formato (GLB 2.0; FBX e GLB truncado são recusados com motivo), malhas e skinning, animações e durações, nomes duplicados, ossos ausentes com a cobertura, trilhas incompatíveis, escala e posição vertical inesperadas, root motion (neutralizado), diferença de rig, estados inexistentes e referências inválidas do mapa do Studio.
- Veredito: **Compatível / Compatível com ressalvas / Incompatível**.
- Os clipes incompatíveis continuam na biblioteca, desabilitados para associação: nada é descartado. Cada clipe tem prévia.

## Fase 4 — Desempenho e interface

**Medidor (Visualizar › Desempenho; caixa opcional na arena):**
- FPS suavizado, tempo médio, P95 e pior quadro;
- trabalho de CPU por quadro e por etapa (simulação, animação, VFX, sobreposições e envio ao WebGL);
- draw calls, triângulos e partículas (ativas, pico e geradas);
- tempo de GPU **só** via `EXT_disjoint_timer_query_webgl2`; sem a extensão aparece "indisponível";
- renderização por software é detectada e rotulada: "CPU emulando a GPU".

**Perfis gráficos Baixo/Médio/Alto/Personalizado.** Mudam só a resolução, as partículas e a sombra. Teste: uma luta IA × IA com o perfil Baixo e com o Alto tem estados **idênticos**.

**Benchmark.** IA × IA com semente fixa, aquecimento e quatro casos (sem VFX, leves, médios, todos os efeitos) × uma e duas personagens. Registra resolução, pixel ratio, navegador, renderizador, GPU timer e configuração, e só declara dois resultados comparáveis em condições iguais.

Resultado no ambiente de teste (Edge sem interface, **SwiftShader = GPU por software**, 1070 × 638 px, pixel ratio 1, GLB local de 3,4 MB):

| Caso | Pers. | FPS | Quadro méd./P95 (ms) | CPU/quadro (ms) | VFX (ms) | Render CPU (ms) | "GPU" software (ms) | Pico partículas |
|---|---|---|---|---|---|---|---|---|
| Sem VFX | 1 / 2 | 16,3 / 13,4 | 61 / 150 · 75 / 167 | 12,7 / 12,0 | 0,04 / 0,03 | 11,4 / 10,1 | 23,6 / 26,6 | 0 |
| Leves | 1 / 2 | 17,3 / 17,3 | 58 / 117 · 58 / 100 | 10,6 / 11,6 | 0,07 / 0,07 | 9,5 / 9,8 | 22,6 / 26,4 | 14 |
| Médios | 1 / 2 | 16,5 / 16,7 | 61 / 100 · 60 / 117 | 13,3 / 12,4 | 0,07 / 0,06 | 11,6 / 10,8 | 27,0 / 27,2 | 24–25 |
| Todos | 1 / 2 | 16,0 / 16,4 | 63 / 133 · 61 / 117 | 17,3 / 14,0 | 0,24 / 0,08 | 15,3 / 12,5 | 27,5 / 27,0 | 31–32 |

Leitura: neste ambiente, o gargalo é a rasterização por software. O sistema de VFX custa menos de 0,3 ms de CPU por quadro mesmo com tudo ligado. **Esses números não representam uma GPU dedicada.** O Playwright força o SwiftShader até em janela visível, então rode o benchmark no seu navegador normal (Visualizar › Desempenho › Executar benchmark) para medir a sua GPU.

**Problema de desempenho encontrado pelo medidor e corrigido.** A curva de apoio no chão de cada clipe (usada pelo ajuste automático de altura) era calculada de forma síncrona na primeira vez que o clipe tocava. Isso travava a luta por dezenas a centenas de milissegundos. Agora o cálculo sai do quadro: até ficar pronto usa a pose de repouso, e a altura converge suavemente.

Efeito com o GLB local: a animação caiu de ~21 ms para ~0,6 ms por quadro, e o pior quadro de ~900 ms para ~300 ms (SwiftShader). Física e regras não mudam.

**VFX simples/avançado (Visualizar).**
- **Simples:** cada efeito com liga/desliga, variante, intensidade principal, prévia e "Avançado ▸".
- **Avançado:** todos os parâmetros, em grupos recolhíveis que preservam os valores.
- **Filtros:** todos, ativos, alterados e mais caros. "Mais caros" usa as partículas medidas por tipo.

## Fase 5 — IA, servidor local e painel de relatórios

**IA tática revisada** (`extras.ai.revision`; "Anterior" continua selecionável em Ajustes › IA). Usa as mesmas regras do jogador, sem vantagens. As mudanças:
- **Valida antes de apertar:** usa a mesma `startPermission` do controlador. Mantém pedidos que o motor guardaria no buffer e não aperta D no próprio tackle quando isso não teria efeito.
- **Alcance real do X:** prevê a posição do rival pelo tempo restante da ação dele.
- **Contra-ataque:** aproveita a janela quando o X alcança.
- **Sprint:** C mantido para encurtar distâncias longas.

**Avaliação com sementes fixas** (`src/sim/ai-eval.js`, Cenários › Avaliação da IA, `test/ai-eval.test.mjs`). São 400 lutas por variante, com o azul contra a IA anterior no vermelho:

| | Anterior | Revisada |
|---|---|---|
| Vitórias do azul | 55,5% | 52,8% (dentro do ruído, ±5 pontos) |
| Ações negadas pelo motor | 4114 | 2717 (−34%) |
| X sem contato | 39% | 37% |
| Sprints | 0 | 72 |
| Contra-ataques aproveitados | 69 de 213 | 64 de 196 |
| Tempo exausto por luta | 13,5 s | 13,2 s |

Por estilo (os dois lados com o mesmo estilo), a revisada fica entre 51% e 57% contra 51% a 58% da anterior, sempre com menos ações negadas. Detalhes em `evidence/calibracao/fase5-avaliacao-ia.txt`.

**O que não funcionou e foi descartado.** A ablação mediu cada melhoria isoladamente. "Nunca se exaurir por escolha", que é a reserva de stamina, **derrubou a taxa de vitória de ~56% para ~34%**: a IA fica passiva demais, e punir a queda do rival vale mais do que a exaustão custa. Por isso essa melhoria fica desligada na revisão (`REVISION_1.stamina = false`), embora continue disponível para avaliação.

Também ficou claro que a maioria dos contra-ataques perdidos vem da falta de stamina durante a própria esquiva, o que é regra do jogo e não da IA.

**Conclusão honesta:** a revisada usa mais mecânicas e desperdiça menos, mas **não ficou mais forte**. Com as regras atuais, a força da IA anterior vem da agressividade.

**Servidor local opcional (`npm run dev:combat-lab`).** Serve o laboratório e o painel, recompila ao salvar `src/` ou `reports/` e recarrega a página. As pastas do projeto ficam acessíveis só nestas áreas, só com estas extensões e só para a própria origem:

| Área | Pasta | Extensões |
|---|---|---|
| Presets | `prototypes/combat-lab/presets/` (versionada) | `.json` |
| Modelos e animações | `chars/` (a pasta que o projeto já usa, fora do Git) | `.glb`, `.gltf` |
| Relatórios | `prototypes/combat-lab/validation/reports/` (fora do Git) | `.json`, `.csv` |
| Benchmarks | `prototypes/combat-lab/validation/benchmarks/` (fora do Git) | `.json` |

Nenhuma pasta nova foi criada para modelos. Sem servidor, Exportar › Pastas do projeto oferece "Escolher pasta…" quando o navegador tem acesso a arquivos e a sua autorização. Senão, explica o motivo; o workspace e o backup ZIP continuam valendo.

**Painel de relatórios.** Lê os relatórios versionados (`schema: arenamon-lab-report`) e a telemetria de animação, sem acessar a partida:
- gravador de movimento, com os mesmos gráficos;
- diagnóstico de comandos, com o histograma de motivos;
- treino, com a faixa de cada comando em relação à janela;
- benchmark e avaliação da IA.

Recusa arquivos inválidos e versões futuras com o motivo. A central de acesso (`ABRIR_ARENAMON.html`, `HTMLS_ARENAMON.html`) ganhou os links.

---

## Testes executados (todos aprovados na última execução da branch)

| Suíte | Resultado |
|---|---|
| Unitárias antigas: `sim`, `core`, `properties`, `ai`, `gamepatch`, `locomotion`, `animation`, `rules` | aprovadas |
| `workspace.test` | 12 |
| `calibration.test` | 10 |
| `diagnostics.test` | 7 |
| `training.test` | 4 |
| `perf.test` | 3 |
| `ai-eval.test` | 3 |
| `devserver.test` | 4 |
| `verify.mjs` (navegador, antiga) | 19 |
| `overhaul.browser` (antiga) | 116 |
| `workspace.browser` | 43, inclui fechar/reabrir com perfil persistente, backup → perfil limpo, cota, IndexedDB indisponível, corrupção, migração e GLB real de 3,4 MB |
| `calibration.browser` | 32 |
| `diagnostics.browser` | 21 |
| `perf.browser` | 23 |
| `tools.browser` | 18 |

Os testes antigos foram ajustados só onde a mudança de comportamento foi pedida, **sem remover asserções**:
- `verify.mjs` agora abre o modo avançado do ajustador antes de usar a busca. Também abre o formulário "Salvar como novo preset", testa a sessão nos dois modos (automático e por aviso) e fixa o modo tático do azul, porque o workspace agora restaura a última partida.
- `overhaul.browser` abre o modo avançado de VFX antes de exportar o preset de um efeito.
- `animation.test` pré-calcula as curvas de apoio, como o `warmGround` faz no app, já que no quadro o cálculo agora é adiado.

## Limitações e pendências

1. **GPU:** o ambiente de teste só oferece SwiftShader (software). O tempo de "GPU" medido aqui é a CPU emulando a GPU. O benchmark real precisa ser executado por você, no seu navegador.
2. **Navegadores:** a persistência foi testada no Edge (Chromium) por `file://`. Firefox e Safari não estão instalados aqui. O fallback (localStorage → memória) foi testado simulando a falha do IndexedDB.
   - Em navegadores que separam a origem `file://` por pasta, mover o HTML de pasta pode separar o armazenamento; o backup ZIP resolve.
   - "Armazenamento persistente" costuma ser recusado em `file://`, e o painel avisa.
3. **IA:** a revisada não é mais forte (ver acima). Se preferir a força da anterior, selecione "Anterior" em Ajustes › IA.
4. **Presets iniciais** são propostas. Os valores aprovados continuam os do laboratório e do jogo oficial.
5. **Paridade com o v6:** o teste `parity.mjs` é ignorado sem o HTML v6 local em Downloads (como antes).
6. **Teste de gravação do `verify.mjs`:** a compressão de comandos de uma luta IA × IA de 2,5 s em tempo real falhou duas vezes durante a regressão, antes da correção do modo do azul. Depois disso foram seis execuções seguidas aprovadas, e a mensagem do teste agora traz os detalhes se voltar a acontecer.
7. **Decisões pendentes da etapa anterior** continuam abertas: círculo × janela de tempo do C → X e escolha do HUD A/B/C.
