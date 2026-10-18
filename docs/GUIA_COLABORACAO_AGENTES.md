# Arenamon — Guia de Colaboração para Agentes (Codex, Claude, Antigravity)

Este guia prático orienta Codex, Claude, Antigravity e qualquer outro agente ou desenvolvedor que trabalhe no repositório Arenamon para evitar conflitos, preservar stashes locais e garantir entregas verificáveis.

---

## 1. Regras Fundamentais (Invioláveis)

1. **Nunca altere a branch `main` diretamente.**
2. **Nunca execute `git push --force`, não descarte alterações e não reescreva histórico sem autorização expressa.**
3. **Nunca utilize `git add -f` para forçar inclusão de arquivos bloqueados pelo `.gitignore`.** Modelos e recursos extraídos de franquias proprietárias devem permanecer exclusivamente no ambiente local.
4. **Preserve todos os stashes locais existentes.** Nunca aplique nem descarte stashes sem autorização expressa do usuário.
5. **Não escolha unilateralmente propostas visuais pelo usuário.** Mantenha as opções experimentais intactas até decisão expressa.

---

## 2. Protocolo de Início de Tarefa (Antes de Editar)

Sempre execute na raiz do projeto:

```powershell
git status --short --branch
git remote -v
git fetch origin
git stash list
```

- Verifique se outro agente trabalhou recentemente na mesma área consultando o log da branch ou de branches paralelas.
- Se for trabalhar em uma nova tarefa, crie uma **branch curta e identificável** a partir do estado de base acordado:
  ```powershell
  git checkout -b <tipo>/<nome-descritivo>
  ```

---

## 3. Divisão de Responsabilidades e Áreas do Projeto

| Área | Diretório | Agente Principal / Foco | Recomendações Técnicas |
|---|---|---|---|
| **Jogo Principal (Combat Lab)** | `prototypes/combat-lab/` | Claude / Equipe / Antigravity | Este é o jogo oficial do Arenamon (`arenamon-combate-laboratorio.html`). Mapa de módulos e testes: `docs/INDICE_MODULOS.md`. |
| **Animation Studio** | `prototypes/studio/` | Codex / Claude / Antigravity | Preservar compatibilidade do Action Editor e dos 3 modos com arquivos GLB. |
| **Núcleo de Rigging** | `prototypes/studio/src/rigging/` | Codex | O núcleo estrutural, bind pose e pesos são de responsabilidade do Codex. Não reescreva sem coordenação. |
| **Propostas Visuais de Rigging** | `prototypes/studio/proposals/` | Antigravity | Três propostas visuais independentes (A, B e C). Não escolher uma delas unilateralmente. |
| **Protótipo Legado de Blocos** | `prototypes/game/` | Histórico (Descontinuado) | Protótipo inicial antigo (`arenamon-jogavel.html`); ignorar para novas features do jogo. |
| **Central de Acesso & Docs**| Raiz e `docs/` | Antigravity / Claude | Manter links relativos sempre válidos para execução via `file://`. |

---

## 4. Protocolo de Finalização e Entrega

Antes de entregar sua tarefa:

1. **Revisar o status e o diff:**
   ```powershell
   git status --short
   git diff
   ```
2. **Validar com a suíte de testes:**
   ```powershell
   npm run verify
   ```
   Se houver falhas, corrija antes de commitar ou documente com precisão se a falha já existia de forma comprovada.
3. **Criar commit semântico e descritivo:**
   ```powershell
   git add <arquivos-especificos>
   git commit -m "<tipo>(<escopo>): <descricao clara da alteracao>"
   ```
4. **Publicar e verificar a sincronização:**
   ```powershell
   git push origin <sua-branch>
   git fetch origin
   git rev-parse HEAD
   git rev-parse origin/<sua-branch>
   ```
   **Uma tarefa só termina quando o hash do commit local e o hash do commit remoto forem comparados e confirmados como idênticos.**
5. **No relatório final para o usuário:**
   - Informe o hash exato entregue (`git rev-parse HEAD`).
   - Relacione os testes executados e seus resultados verificáveis.
   - Indique qualquer limitação técnica encontrada com transparência.
