# Motion Lens Auditoria de Confiabilidade e Evolução Técnica

> **Para agentes:** executar em TDD, com correções pequenas e verificáveis. Funcionalidades F01–F15 dependem de aprovação posterior.

**Objetivo:** corrigir os defeitos objetivos R01–R08 que forem reproduzidos no checkout atual e produzir propostas sem duplicação para a evolução funcional do Motion Lens.

**Arquitetura:** manter o ponto de entrada e os módulos atuais. Corrigir registro, propriedades, transações e unidades dentro das responsabilidades existentes; não criar novo add-on, não mudar o Combat Lab e não instalar no Blender.

**Stack:** Python 3, Blender 5.2.2 LTS, `bpy`, `unittest`, Blender headless.

**Especificação:** `C:\Users\zerke\Downloads\ARENAMON_MOTION_LENS_AUDITORIA_MELHORIAS_PROMPT_AGENTE.docx`.

## Restrições globais

- Preservar todos os operadores e propriedades anteriores.
- Nunca modificar uma Action original; qualquer derivação usa cópia e nome único.
- Não alterar Wookada, Cogumelo, Animation Studio, Direction Lines ou mecânicas de combate.
- Não instalar nem ativar add-ons.
- Não publicar nem incorporar recursos proprietários de Gigantic ou Pokémon.
- Rodar somente testes específicos e o build rápido exigido pelo repositório.

## Tarefas

### 1 Registro e propriedades R01 R02

- [x] Testar duas sequências `register()` → `unregister()` e inventário anterior/posterior.
- [x] Registrar `strike` e `apply_impact` e as quatro propriedades consumidas, com limites, padrões e unidades visíveis.
- [x] Preservar os 15 operadores e 36 propriedades anteriores.

### 2 Instalação transacional R03

- [x] Injetar falhas no staging, backup, remoção e commit.
- [x] Garantir que todo caminho de falha deixa a versão anterior utilizável.
- [x] Não instalar a versão resultante.

### 3 Diagnóstico de golpe R04 R08

- [x] Usar o intervalo da Action ativa, não o intervalo global da cena.
- [x] Recusar lista vazia de efetores e armature sem Action.
- [x] Rotular contato inferido como `CANDIDATO`, com método e confiança limitada.
- [x] Exibir duração em quadros e segundos e velocidade em m/frame e m/s.

### 4 Derivação segura R05

- [x] Provar que a Action original permanece byte/curvas inalterada.
- [x] Atribuir Action Slot compatível à derivada.
- [x] Restaurar Action, slot, frame e intervalo da cena em qualquer exceção.
- [x] Usar nome único e não deixar Action parcial após falha.

### 5 R06 R07 e propostas F01 F15

- [x] Reproduzir ou refutar colisão de cache/importação global antes de propor mudança de embalagem.
- [x] Comparar fonte e instalação por hash sem instalar.
- [x] Mapear cada F01–F15 contra Blender Vision, Witness, Direction Lines, pose library, apply fix, Studio, Gigantic e Z-A.
- [x] Criar relatório acessível no portal com propostas que exigem aprovação.

### 6 Verificação e entrega

- [x] Rodar testes específicos no Blender 5.2.2.
- [x] Rodar `npm run verificar:tamanho` e `npm run rapido:build`.
- [x] Comparar inventário antes/depois e confirmar nenhuma remoção.
- [ ] Commitar apenas os arquivos desta tarefa, enviar e comparar HEAD local/remoto.
