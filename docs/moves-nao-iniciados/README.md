# Arenamon — Moves ainda não iniciados

> **Atualização de 22/10/2026 (auditoria `docs/AUDITORIA_DOCUMENTACAO_2026-10-22.md`):** esta pasta guarda prompts e propostas de Moves; **quase todos já foram implementados** (tabela abaixo). Só o **Body Slam** continua sem gameplay especificado.

**Pasta:** `docs/moves-nao-iniciados/`  
**Situação:** organização de documentação e preparação para desenvolvimento — **não significa que os golpes abaixo tenham sido implementados**.  
**Repositório oficial:** [Ziaker/Arenamon](https://github.com/Ziaker/Arenamon)

## Entregas e acesso

| Arquivo | Conteúdo | Estado |
|---|---|---|
| [EMERGING_STONE_PROMPT_IMPLEMENTACAO.md](EMERGING_STONE_PROMPT_IMPLEMENTACAO.md) | Prompt de execução para Codex/agente implementar e testar Emerging Stone (Move 1 de Mushroom), vinculado a **ES-D01–ES-D103** | **Implementado** (v1.14.x); homologação pendente |
| [PROMPT_IMPLEMENTACAO_MOVES_NOVOS.md](PROMPT_IMPLEMENTACAO_MOVES_NOVOS.md) | Prompt de trabalho do agente para implementar os 13 Moves novos (genéricos, Mushroom e Emerging Stone), com infraestrutura, ordem, protocolo e critérios | **Concluído e integrado à `main`** (v1.14.0 em diante) |
| [DECISOES_PROVISORIAS_MOVES_NOVOS.md](DECISOES_PROVISORIAS_MOVES_NOVOS.md) | Registro vivo dos padrões provisórios adotados onde a fonte marca pendência | Atualizado a cada Move |
| [../MOVES_ELEMENTAIS_PROTOTIPO.md](../MOVES_ELEMENTAIS_PROTOTIPO.md) | Protótipo dos 4 Moves elementais (Water Pulse, Fire Spin, Air Slash, Seed Bomb) de 23/10/2026: como testar, decisões provisórias e limites; fichas em `fichas/` | **Implementado (protótipo), homologação pendente** |
| [5_MOVES_GENERICOS_PROMPT.md](5_MOVES_GENERICOS_PROMPT.md) | Proposta dos 5 genéricos adicionais (Lunge, Guard Break, Feint, Riposte, Second Wind) — vinda do branch `docs/5-moves-genericos` | **Implementado** (v1.14.0); valores provisórios |
| [AUDITORIA_PASTA_TACKLE.md](AUDITORIA_PASTA_TACKLE.md) | Verificação da pasta `docs/tackle` e justificativa de classificação dos arquivos encontrados | Auditoria documental |

## Fontes oficiais que continuam em seus caminhos originais

Não confundir **organizar tarefas futuras** com transferir documentos-mestre que descrevem simultaneamente golpes iniciados, pendentes ou já implementados. Estes arquivos **não foram movidos nem duplicados**, para evitar links quebrados e divergência entre cópias:

- [`docs/MUSHROOM_MOVES_DECISOES.md`](../MUSHROOM_MOVES_DECISOES.md): fonte canônica do Emerging Stone (**ES-D01–ES-D103**, inclusive **opção C** do cast), Bullet Punch (projeto descrito), Sand Wave (especificação e pendências) e Body Slam (nome aprovado, gameplay ainda não especificado). Abrange a diretriz universal de cobrança.
- [`docs/MOVES_GENERICOS_CATALOGO.md`](../MOVES_GENERICOS_CATALOGO.md): Quick Attack, Swift, Harden, Spikes e Bounce: **catálogo para implementação futura**; não homologar automaticamente números marcados como propostas.
- [`docs/MOVES_DECISOES_RODADAS.md`](../MOVES_DECISOES_RODADAS.md): documento histórico sobre Reflect/Psyshock e sistema de Moves. **Não usar o status antigo "não implementado" como diagnóstico atual**, porque o código já contém módulos de Reflect e Psyshock.
- [`docs/PLANO_IMPLEMENTACAO_REFLECT_PSYSHOCK.md`](../PLANO_IMPLEMENTACAO_REFLECT_PSYSHOCK.md): plano e fases históricas; consultar código/commits antes de decidir o que ainda falta.
- [`prototypes/combat-lab/MOVIMENTOS.md`](../../prototypes/combat-lab/MOVIMENTOS.md): infraestrutura atual de slots, estados, entidades, controles e testes; informação introdutória pode estar desatualizada e deve ser confrontada com o código vigente.

## Convenção desta pasta

1. Um prompt/brief separado por move **que ainda aguarda implementação**, sem retirar as decisões canônicas do catálogo central.
2. Nomear `<MOVE>_PROMPT_IMPLEMENTACAO.md` e referenciar **IDs aprovados**, não substituí-los por resumo que possa alterar semântica.
3. Diferenciar **design aprovado**, **protótipo visual/animação aprovado**, **implementação jogável**, **testes** e **homologação final**. Uma dessas condições não implica as outras.
4. Não converter indevidamente implementações ativas em "moves não iniciados"; antes de mover arquivos verificar referências, imports, caminhos relativos, scripts e portal.
5. Quando um move for de fato implementado, atualizar este inventário, o portal, os testes e os documentos de status na mesma entrega. Não apagar a rastreabilidade histórica.

## Auditoria de `docs/tackle`

O diretório contém **apenas** [`docs/tackle/VER_TACKLE.html`](../tackle/VER_TACKLE.html), visualizador do **Tackle do Vigoroth — Teste 01**, com selo de **animação aprovada (v26)**. Não contém documentos de outros moves inacabados. O **Tackle de combate já possui implementação** no Combat Lab; integração final dessa animação local específica não foi certificada pela presença do visualizador. **Não foi classificado como move não iniciado nem movido**, porque a operação quebraria seu link existente no portal e as referências relativas a mídia sem oferecer comprovação de status. Consulte a auditoria.

**Escopo desta reorganização:** criação de arquivos de documentação, indexação no portal e auditoria; **nenhum código de simulação, artefato Blender, vídeo, teste ou jogabilidade foi alterado**.

## Moves implementados (branch `feat/moves-novos`, v1.14.0)

Todos no **Laboratório de Combate** (`JOGAR_ARENAMON.html` → aba **Moves**), nenhum equipado por padrão. Cada ficha tem fonte, código, testes, regras e pendências. Nada aqui é homologação do diretor.

| Move | Ficha | Testes |
|---|---|---|
| Harden · Second Wind · Swift | [harden](fichas/harden.md) · [second-wind](fichas/second-wind.md) · [swift](fichas/swift.md) | 13 · 11 · 16 |
| Lunge · Quick Attack | [lunge](fichas/lunge.md) · [quick-attack](fichas/quick-attack.md) | 14 · 17 |
| Guard Break · Feint · Riposte | [guard-break](fichas/guard-break.md) · [feint](fichas/feint.md) · [riposte](fichas/riposte.md) | 16 · 16 · 15 |
| Bounce · Spikes | [bounce](fichas/bounce.md) · [spikes](fichas/spikes.md) | 17 · 18 |
| Sand Wave · Bullet Punch · Emerging Stone | [sand-wave](fichas/sand-wave.md) · [bullet-punch](fichas/bullet-punch.md) · [emerging-stone](fichas/emerging-stone.md) | 24 · 18 · 26 |

**Body Slam:** NÃO implementado — a jogabilidade não está especificada em nenhum documento. Perguntas mínimas: tipo (Melee/Trick), PL, custo, alcance/ângulo, dano, knockback, interação com Guard/Perfect e se vira Tackle real.
