# Robustez dos Add-ons Blender — Plano de Implementação

> **Para agentes:** usar TDD e executar as tarefas abaixo em ordem, sem remover funcionalidades.

**Objetivo:** estabilizar Motion Lens e Direction Lines para uso diário antes de qualquer integração com referências de Gigantic.

**Arquitetura:** validações locais nos operadores do Direction Lines; instalador do Motion Lens com preparação em diretório temporário, troca controlada e rollback; painel reorganizado apenas com caixas funcionais. A evolução semântica para rigs de Gigantic fica fora deste trabalho.

**Stack:** Python 3, API `bpy` do Blender 5.2, `unittest`, Blender headless.

**Especificação:** parecer anexado pelo usuário e decisões desta conversa.

## Restrições globais

- Não remover, ocultar, desativar nem substituir funcionalidades existentes.
- Não adicionar handler nem retorno automático de frame; o frame deixado pela operação continua sendo o frame corrente.
- Não implementar mapeamento semântico ou auditoria direcional de Gigantic nesta entrega.
- Rodar somente os testes isolados dos add-ons e verificações rápidas do repositório.
- Preservar todas as mudanças de outras sessões.

## Foco da revisão

- Armature ausente, osso inexistente e coluna incompleta devem cancelar com mensagem clara.
- Guia com menos de dois pontos deve ser ignorada ou rejeitada sem exceção.
- Intervalo invertido deve ser rejeitado antes de amostrar frames.
- Falha durante instalação deve restaurar o add-on completo anterior.
- Registro e desregistro repetidos não devem deixar propriedades quebradas.

---

### Tarefa 1: Robustez do Direction Lines

**Arquivos:**
- Criar: `scripts/blender-vision/tests/test_direction_lines_background.py`
- Modificar: `scripts/blender-vision/addons/direction_lines.py`

- [x] Escrever testes headless para rig ausente, coluna incompleta, guia degenerada, osso ausente e intervalo invertido.
- [x] Executar e confirmar as falhas esperadas.
- [x] Implementar validações e mensagens sem alterar o comportamento de frame.
- [x] Executar o teste isolado até passar.

### Tarefa 2: Instalação transacional do Motion Lens

**Arquivos:**
- Criar: `scripts/blender-vision/tests/test_instalar_motion_lens.py`
- Modificar: `scripts/blender-vision/instalar_motion_lens.py`

- [x] Escrever testes para instalação limpa, backup completo e rollback após falha simulada.
- [x] Executar e confirmar as falhas esperadas.
- [x] Preparar e validar o pacote antes da troca; restaurar entrada e módulos em conjunto se a troca falhar.
- [x] Executar o teste isolado até passar.

### Tarefa 3: Interface e versões do Motion Lens

**Arquivos:**
- Modificar: `scripts/blender-vision/addons/motion_lens.py`
- Modificar: `scripts/blender-vision/addons/motion_lens_parts/ui.py`
- Modificar: `scripts/blender-vision/addons/motion_lens_parts/report.py`
- Modificar: `docs/BLENDER_ADDONS_MOTION_LENS.md`

- [x] Criar verificação funcional do inventário de controles e da versão única.
- [x] Confirmar que a verificação falha com a divergência atual.
- [x] Agrupar os controles por função, preservando integralmente o inventário.
- [x] Usar uma única constante de versão no painel, relatório e documentação.
- [x] Executar novamente a verificação.

### Tarefa 4: Verificação e entrega

**Arquivos:** todos os anteriores e `ABRIR_ARENAMON.html`.

- [x] Rodar os três testes isolados, `npm run verificar:tamanho` e `npm run rapido:build`.
- [x] Revisar diff, inventário anterior/posterior e segredos.
- [x] Criar commit apenas com os arquivos desta entrega; envio e comparação remota são o gate operacional posterior.
