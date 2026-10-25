# Gravar pelo Editor de Moves (direto no disco)

O Editor de Moves (botão **🛠 Editor** no laboratório) pode **gravar** as suas alterações nos arquivos do projeto, com confirmação. Isso só funciona com o **servidor local** ligado, porque uma página aberta por duplo clique (`file://`) não pode escrever no disco.

## Como ligar
1. Na pasta do projeto, dê **duplo clique em `INICIAR_SERVIDOR.bat`** (ou rode `npm run servidor`). Uma janela fica aberta e o laboratório abre em `http://127.0.0.1:5173/` (só este computador consegue acessar).
2. Abra o **🛠 Editor**, escolha o Move, ajuste mecânica e visual, e na seção **Salvar** clique em:
   - **💾 Gravar move.json no disco** → `prototypes/combat-lab/src/sim/moves/<move>.move.json` (sliders de mecânica e custo/recarga/preparação);
   - **💾 Gravar visual aprovado no disco** → `prototypes/sand-stone-lab/approved/<categoria>.json` (parâmetros visuais do atelier, para os Moves que têm visual vinculado).
3. Aparece um **diálogo com as diferenças** (o que muda, antes no disco × depois) e o foco em **Cancelar**. Só **«Gravar no arquivo»** grava.
4. Depois de gravar, o servidor recompila e o laboratório **recarrega sozinho**; o Editor reabre no mesmo Move. O Git guarda a versão anterior (`git diff` mostra o que mudou; `git checkout -- <arquivo>` desfaz).

Sem o servidor, os botões de gravar ficam desligados (e explicam como ligar); **Copiar move.json / Copiar visual** continuam funcionando.

## O que o servidor garante
- Só altera arquivos que **já existem** (`<id>.move.json` e `approved/<categoria>.json`); não cria nem apaga arquivos e não aceita caminhos.
- **Valida** antes de gravar: o `move.json` precisa seguir o esquema (e o `def.id` casar com o arquivo); o visual precisa ser uma exportação válida do atelier (faixas, categoria, sem campo ignorado).
- Só aceita gravação **da própria página** (mesma origem); outra aba ou site é recusado.
- **Conflito**: se o arquivo mudou no disco depois que o editor o leu (outro programa, outro agente, `git checkout`), a gravação é recusada (409) e nada é sobrescrito.
- **Atômica** (arquivo temporário + renomear), com a mesma formatação de sempre (JSON com 2 espaços e quebra de linha final).
- **Salvar sem mudar nada não altera o arquivo** (o editor parte do arquivo do disco e só muda o que você mexeu; o preset do tremor de hit, o selo «approved» e a referência de visual são preservados).

## Detalhes que vale saber
- Os sliders do Editor têm limites **ampliados** (o dobro; knockback até 15). Se você gravar um valor acima do limite que está no arquivo, o **limite do arquivo é ampliado** para caber (o jogo recusa valor fora da faixa) — isso aparece no diálogo como «… · limite máximo do arquivo».
- Mexeu no **tremor de câmera ao acertar** (VFX)? O preset deixa de caber e vira linhas explícitas no arquivo (também aparece no diálogo).
- A **definição** (`def.cost`, `def.cooldown`, `def.duration`) acompanha os sliders de custo, recarga e preparação **só quando eles mudaram**.
- O servidor também recarrega o laboratório quando qualquer arquivo de `src/` muda (como o vigia), então ele serve para desenvolver sem rodar `npm run build`.

## Testes
`move-save-model.test.mjs` (documento novo e diferenças; ida e volta nos 19 Moves), `move-save-api.test.mjs` (servidor: validação, hash, origem, atomicidade; usa pastas temporárias) e `move-save.browser.mjs` (21 verificações: diálogo, cancelar, gravar, conflito, visual, Reflect, sem servidor, reabrir o Editor).
