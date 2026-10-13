# Protocolo de colaboração

Estas regras se aplicam a Codex, Antigravity e qualquer outro agente que trabalhe neste repositório.

## Antes de editar

1. Execute `git status --short --branch`, `git remote -v` e `git fetch origin`.
2. Leia as mudanças locais existentes e não as sobrescreva.
3. Se outro agente estiver trabalhando na mesma área, crie uma branch curta a partir de `main` e coordene a integração.
4. Nunca use force push, descarte mudanças ou reescreva histórico sem autorização expressa.

## Antes de entregar

1. Revise `git diff` e `git status --short`.
2. Confirme que nenhum segredo ou recurso proprietário foi incluído; nunca use `git add -f` para contornar as exclusões.
3. Execute `npm run verify` e corrija falhas relacionadas à mudança.
4. Crie um commit descritivo e identificável.
5. Atualize sua branch com o remoto sem sobrescrever trabalho alheio e envie o commit.
6. Confirme a sincronização com `git fetch origin` e compare `git rev-parse HEAD` com `git rev-parse origin/$(git branch --show-current)`.
7. Informe o hash exato entregue, os testes executados e qualquer limitação.

Uma tarefa não está sincronizada apenas porque os arquivos foram salvos. Ela termina quando o commit enviado e o commit remoto foram comparados e confirmados.

## Conteúdo restrito

Modelos e recursos extraídos de jogos proprietários permanecem somente no ambiente local até haver comprovação dos direitos de uso e redistribuição. Não os adicione ao Git, a releases, a Pages ou a qualquer serviço externo.

