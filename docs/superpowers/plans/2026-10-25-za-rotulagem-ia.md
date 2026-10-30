# Rotulagem IA auditável — Implementation Plan

> **For agentic workers:** usar superpowers:subagent-driven-development em tarefas delimitadas. Especificação: pedido do usuário nesta conversa, 25/10/2026.

**Goal:** entregar propostas e revisão separadas para os quatro itens ativos do lote 02 (477115ec150e).
**Architecture:** preparação determinística em Python, interpretação visual explicitamente registrada, exportação validada e HTML local independente. Cache por conteúdo; nenhum rótulo humano é entrada da análise.
**Tech Stack:** Python, FFmpeg/FFprobe, decodificador local za_anim, HTML/JS.

## Restrições
- Originais, ignorados, localStorage humano e addons preservados; sem push.
- Dados derivados locais em dumper test/za-referencias/avaliacao/lote_02_ia/ (ignorado pelo Git).
- Código novo em tools/za-referencias; documentos aqui; links aditivos nos portais.
- Evidência A exige concordância visual/3D; B visual; C hipótese. Sem probabilidade inventada.
- Escopo: lote 02 mais recente; lote 01 não processado.

## Revisão de riscos
Identidade por nomes não basta; verificar código visual e timeline. Zero movimento não prova contato. Cache inclui interpretação e ferramentas. JSON válido não prova semântica. Interface de revisão nunca escreve armazenamento humano.

## Tarefas e interfaces
- [x] 1. Pipeline: criar ia_pipeline.py e tests/test_ia_pipeline.py. TDD: leitura segura de LOTE, filtro ignorados, opções reais, validação de respostas/evidências, hashes, erros e retomada; 16 cenários do pedido como testes de política de evidência, sem fingir classificação visual automática.
- [x] 2. Dados: criar ia_cinematica.py; consumir IDs ativos e produzir cinematica/<modelo>.json com hashes de fontes, hierarquia, séries originais e medições; não consumir previsões anteriores.
- [x] 3. Piloto: extrair e abrir quadros das duas vistas, refinar eventos, documentar interpretações separadas; revisar antes do quarto clipe.
- [x] 4. Revisão: criar ia_review.py e HTML gerado, um item carregado por vez, vídeos sincronizados, quadros e evidências, edição/aprovação/rejeição e exportação separada.
- [x] 5. Verificar testes novos e suíte ZA pertinente, build obrigatório, integridade de originais, links e inventário/relatório reais. Sem publicar conteúdo Z-A.

## Responsabilidades / conflitos
Pipeline e testes: subagente; cinemática e suas saídas: subagente; inspeção visual, propostas, interface, portais e docs: principal. Nenhum arquivo editável compartilhado. Dados cinemáticos são evidência quantitativa, não rótulos. Preservar alterações anteriores (incluindo portal).

## Registro
Inspeção: workspace oficial passou. Fetch falhou por permissão de .git/FETCH_HEAD. Há muitas alterações anteriores; não serão adicionadas a commits desta tarefa. Skills lidas: using-superpowers, brainstorming (pedido já especifica execução), writing-plans, TDD, subagent-driven-development, verification-before-completion, arenamon-routing (sem alteração no jogo).

## Conclusão (Claude, 25/10/2026)
O Codex parou por limite de uso depois das Tarefas 1, 2 e 4 (código e testes) e da preparação. O Claude:
- refez a preparação e a cinemática com os vídeos atuais (com chão estimado);
- inspecionou os 4 clipes (resumo 3D e quadros abertos, em `inspecao/claude_*.png`);
- escreveu `interpretacao.json`;
- criou `ia_propostas.py` com 6 testes;
- gerou as propostas, as evidências, o relatório e a página de revisão;
- adicionou os links no portal e o `docs/za-referencias/ROTULAGEM_IA.md`.

Testes: 191 OK, dos quais 35 da rotulagem por IA. Sem push.
