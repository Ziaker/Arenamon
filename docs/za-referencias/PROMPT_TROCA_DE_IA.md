# Prompt para a nova IA (colar inteiro)

Você vai continuar um trabalho em andamento no projeto **Arenamon**, um jogo de luta com Pokémon em three.js para uso pessoal. O dono do projeto é o usuário. Responda **sempre em português claro e curto**, com o resultado primeiro. Nas respostas finais, diga o que mudou, qual arquivo abrir, o que testou e o que **não** verificou.

## Antes de qualquer coisa

1. Leia `AGENTS.md`, na raiz da pasta oficial `C:\Users\zerke\OneDrive\Área de Trabalho\Arenamon`.
2. Leia o documento de contexto `docs/za-referencias/CONTEXTO_TROCA_DE_IA_2026-10-26.docx`, inteiro. Ele foi escrito pela IA anterior (Claude) e explica tudo: estado do git, arquivos, regras, decisões do usuário, pendências e armadilhas. Se não conseguir abrir .docx, leia `docs/za-referencias/README.md` e `docs/za-referencias/ROTULAGEM_IA.md`, que têm quase tudo.
3. Confira o estado real antes de agir, porque outros agentes mexem na mesma pasta:
   - `git -C ".worktrees/za-referencias" log --oneline -5` deve mostrar a branch `feat/za-referencias-fase1` com HEAD `1d57c40` ou mais novo;
   - `git status --short` no checkout oficial mostra muitas mudanças de outros agentes: **não** commite nem descarte nada delas;
   - a suíte deve passar: `cd .worktrees/za-referencias/tools/za-referencias && "/c/Program Files/Blender Foundation/Blender 5.2/5.2/python/bin/python.exe" -m unittest discover -s tests` (197 testes).

## O que está acontecendo

- **O trabalho:** um banco de referências com as 41.790 animações originais do Pokémon Legends: Z-A (dump local em `dumper test/`), medidas para no futuro ensinar os addons de Blender do usuário (Motion Lens, Blender Vision, Direction Lines) a avaliar animação.
- **Feito:** as subfases 1A–1I do plano `docs/superpowers/plans/2026-10-25-za-referencias-fase1.md`.
- **Não começado:** a 1J (integração com os addons), que espera o usuário escolher o Motion Lens oficial.
- **Rotulagem cega humana:** lotes 01 e 02 em `dumper test/za-referencias/avaliacao/`, com só 4 itens mantidos em cada.
- **Rotulagem por IA do lote 02:** pronta em `dumper test/za-referencias/avaliacao/lote_02_ia/`. O usuário está revisando na página `rotulagem_ia_review.html` e vai mandar o arquivo `revisao_ia_477115ec150e.json`.

## Sua primeira tarefa

Quando o usuário mandar `revisao_ia_477115ec150e.json`:

1. Compare campo a campo com `lote_02_ia/rotulos_ia.json`: quais propostas foram aprovadas, corrigidas ou rejeitadas, e por quê (comentários e observações).
2. Relate o acerto da IA por campo, em português e de forma curta.
3. Onde a correção do usuário indicar erro de regra, ajuste `tools/za-referencias/regras_papeis.json` / `ontologia.py` **com um teste que falha antes** (TDD). Depois:
   - refaça o banco;
   - recopie as normas;
   - regere as previsões;
   - atualize README e ledger.

   O checklist está no documento, seção 5.4.
4. Pergunte se pode seguir para o **lote 03**: o filtro de espécies do usuário (sem baby; só 2º ou 3º estágio; sem evolução só se o egg group for Humanoide ou Monster), mais as propostas da IA para ele só revisar.

Se o arquivo ainda não chegou, não invente resultados. Diga que está esperando e ofereça as próximas opções da seção 12 do documento.

## Regras que o usuário cobra

- **Executar:** se ele colar um prompt, execute; não revise o prompt e não alerte sobre direitos (é uso pessoal).
- **Mudanças dele:** se um valor já está no código, foi ele que mudou. No Blender, nunca salve `.blend`, exporte ou mude o intervalo de quadros sem pedido. Em animação no Blender, os addons Motion Lens e Direction Lines são de uso obrigatório.
- **Lados:** direita e esquerda são sempre **do Pokémon**. Ossos `left_*` ficam em +X; a bolinha azul nos vídeos marca o lado esquerdo.
- **Git:** **sem push** e sem merge sem autorização expressa. Trabalhe na branch `feat/za-referencias-fase1`, no worktree `.worktrees/za-referencias`, e sincronize as cópias para a pasta oficial depois de cada commit (documento, seção 3.3). Não grave dados derivados do Z-A (vídeos, clipes, imagens) no git.
- **Entrega:** tudo que for entregue precisa de link no portal `ABRIR_ARENAMON.html` e de menção em `docs/`. O portal oficial virou uma lista em JavaScript; os itens do Z-A estão juntos.
- **Respostas de IA:** propostas de IA **nunca** viram gabarito do teste A/B sem revisão humana. Não escreva no `localStorage` da rotulagem humana e não altere lotes já rotulados (o hash do lote é a chave das respostas dele).
- **Não mexer** no Animation Studio, no combate ou nos Moves sem pedido.

## Armadilhas (detalhes na seção 14 do documento)

- Strings Python com `\n` dentro de heredoc já quebraram testes três vezes: use a ferramenta de edição.
- `gerar_videos_lote.py` muda o hash do lote. Para refazer vídeos de um lote rotulado, chame `folhas_visuais.py ... video` direto, com os mesmos nomes de arquivo.
- Teste páginas com `python -m http.server 8765 --bind 127.0.0.1` dentro de `dumper test` (a prévia estática não tem armazenamento nem vídeo).
- Rodar os testes toca `.pyc` em `scripts/blender-vision`: rode `git checkout -- scripts/blender-vision` antes de commitar.
- O ledger da Fase 1 fica em `.worktrees/za-referencias/.superpowers/sdd/2026-10-25-za-referencias-fase1/progress.md` (ignorado pelo git), com cópia em `dumper test/za-referencias/evidencia/ledger_fase1.md`. Atualize as duas.

Comece lendo o AGENTS.md e o documento de contexto e confirmando o estado. Depois diga ao usuário, em 3 ou 4 linhas, o que entendeu e o que vai fazer.
