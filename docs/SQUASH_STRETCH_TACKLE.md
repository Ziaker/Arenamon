# Squash & Stretch do Tackle

Abra JOGAR_ARENAMON.html e acesse Ações → Tackle → Squash & Stretch do modelo.
Importe um personagem GLB animado em Personagens. O efeito se aplica ao modelo, não ao bloco substituto.

## Controles

- Deformação elástica: ligada por padrão (interruptor 0/1, como os demais controles do laboratório).
- Compressão: 0–30%, padrão 15%.
- Alongamento: 0–40%, padrão 20%.
- Janela de compressão: 0–150 ms, padrão 60 ms; zero elimina a compressão.
- Retorno amortecido: 30–200 ms, padrão 80 ms; aproximadamente 98% do retorno nesse intervalo.
- Preservar volume: ligado; Sx = Sy = 1 / sqrt(Sz).
- Alongamento por PL: ligado; PL2 +25% e PL3 +50% sobre a intensidade.

Todos os controles participam do histórico, Ctrl+Z/Ctrl+Y e exportação/importação dos ajustes.
Mudanças ficam disponíveis durante a execução e na próxima investida. A prévia isolada de um clipe não simula um Tackle.

## Implementação e auditoria

O mixer continua ligado à raiz do GLB. Três nós de apresentação separam escala base, deformação na direção do golpe e orientação visual. Nenhum GLB, clipe ou osso é editado pela deformação.
A compressão usa uma janela em ms; o alongamento cresce suavemente durante o impulso e retorna na desaceleração. Golpes muito curtos limitam a janela à metade do tempo disponível antes da desaceleração.
Impacto, finta, recuo e derrota acionam uma mola criticamente amortecida; pausa congela o efeito. Desligar o efeito restaura a escala neutra imediatamente. Recomeço de partida/recuo de replay limpa o estado visual.
A escala neutra de deformação é 1; a escala de ajuste da altura do personagem permanece intacta. A compensação vertical evita que a expansão transversal enterre os pés. Colisores e estado da simulação permanecem iguais.
O estado é alocado uma vez por personagem. A rotina nova não cria objetos, arrays, matrizes ou vetores por quadro. Isso não significa que todo o renderizador esteja livre de alocações.
Os testes de janelas de combate, antes fora dos comandos principais, agora participam de npm test e test:combat-lab:unit.

## Evidências

[Relatório navegável](../prototypes/combat-lab/evidence/squash-stretch/index.html).
Testes específicos: squash-stretch.test.mjs e squash-stretch.browser.mjs. O segundo usa Edge offline e o modelo chars/mosh/Cogumelo.glb.
Não foi feita análise dedicada do impacto deste efeito em FPS/GPU nem validação visual de todos os personagens do acervo.

O recurso está integrado ao jogo oficial e seus controles ficam em Ações → Tackle.
