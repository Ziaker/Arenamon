# Fundação de Sensação dos Moves

## Intenção

Fazer os Moves responderem como golpes completos e coerentes, do comando ao encerramento, sem remover, ocultar ou simplificar nenhuma funcionalidade existente. O primeiro incremento deve corrigir a fundação compartilhada antes de calibrar cada Move individualmente.

## Problema observado

O laboratório já possui regras, parâmetros, animação, VFX, câmera, áudio, buffer e telemetria, mas essas camadas nem sempre compartilham a mesma identidade e o mesmo relógio. A maioria dos Moves usa animações genéricas por slot (`move_1` a `move_4`), enquanto marcadores de startup, trecho ativo, recovery, cancelamento e freeze ainda podem ser apenas informativos. Isso permite divergência entre pose, contato mecânico e feedback.

## Objetivos do primeiro incremento

1. Dar a cada Move uma identidade de apresentação estável, independente do slot em que foi equipado.
2. Preservar fallback integral para `move_N`, Tackle e idle quando não houver clipe específico.
3. Expor uma timeline efetiva única para startup, ativo, recovery, cancelamento, invulnerabilidade e impacto, mantendo a simulação como autoridade.
4. Fazer o comando produzir feedback observável nos estados aceito, bufferizado e negado, sem mudar permissões ou custos.
5. Preparar perfis de impacto por natureza do golpe sem trocar os VFX existentes neste incremento.

## Não objetivos deste incremento

- Rebalancear dano, stamina, cooldown, alcance ou Power Level.
- Substituir animações, VFX, áudio ou câmera já existentes.
- Reescrever Moves individuais.
- Mudar IA, física geral, Animation Studio ou formato dos GLBs.
- Tornar metadados visuais a autoridade da simulação sem validação explícita.

## Arquitetura aprovada

Um contrato puro de apresentação resolve `moveId + slot + fase` em uma chave de ação específica, com cadeia de fallback compatível com o comportamento atual. Uma segunda projeção pura transforma a definição efetiva do Move em fases temporais normalizadas. A visão consome essas projeções, mas o controlador continua sendo a autoridade para permissões, custos, execução e impacto.

O sistema deve ser aditivo: Moves sem conteúdo específico continuam funcionando exatamente como hoje. Dados específicos entram gradualmente por Move, começando por Quick Attack, Sand Wave, Bullet Punch, Riposte, Bounce, Water Pulse e Emerging Stone.

## Regras de experiência

- Todo comando precisa deixar claro se foi aceito, bufferizado ou negado.
- A antecipação visual deve terminar antes ou no início do perigo mecânico.
- O contato visual e o evento mecânico devem compartilhar a mesma marca efetiva.
- Recovery precisa ser distinguível de cooldown.
- A troca de slot não pode trocar a identidade visual do Move quando existir ação específica.
- Acessibilidade de redução de movimento, flashes e tremor permanece respeitada.

## Compatibilidade e preservação

- Nenhum Move, painel, slider, marcador, fallback, telemetria ou evento existente será removido.
- Perfis e modelos antigos continuam válidos.
- Quando dados específicos estiverem ausentes ou inválidos, a resolução retorna ao caminho legado por slot.
- Mudanças locais de outras sessões são preservadas e integradas apenas após comparação explícita.

## Verificação

O incremento será comprovado por testes unitários dos contratos puros, teste focal do controlador para os três resultados de comando, build do Combat Lab e um teste de navegador apenas da área de Moves. A verificação visual manual será relatada separadamente e não será presumida.

