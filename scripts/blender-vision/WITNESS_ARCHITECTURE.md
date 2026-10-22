# ADR: Animation Witness em vez de mais heurísticas de aprovação

**Status:** Implementação inicial

## Contexto

O `blender-vision` produz imagens e medidas úteis, mas seus alertas podem parecer
mais conclusivos do que a evidência permite. O objetivo do usuário não é receber
mais números: é permitir que um agente compreenda o ataque sem inventar o que não viu.

## Decisão

Adicionar um observador orientado a afirmações. Toda conclusão declara:

- a afirmação exata;
- a evidência que a sustenta;
- o critério e sua origem;
- o que está faltando;
- a limitação residual.

Os estados são `COMPROVADO`, `REFUTADO`, `MEDIDO_SEM_CRITERIO` e
`NAO_COMPROVAVEL`. Regras desconhecidas falham fechadas. Julgamento artístico
exige exemplos aprovados. Contato exige alvo geométrico explícito.

## Consequências

- O sistema deixa de produzir aprovação falsa por ausência de alerta.
- As transformações usam a matriz avaliada e eixos completos do quadril, incluindo rotação.
- Ossos em Euler são observados por `matrix_basis`, não por uma propriedade quaternion possivelmente inativa.
- Algumas perguntas continuam sem resposta até existir alvo, critério ou referência.
- Esta arquitetura melhora honestidade e rastreabilidade; não torna julgamento artístico matematicamente perfeito.

## Uso inicial

```powershell
python scripts/blender-vision/witness.py inspect `
  --blend chars/vigor/Vigoroth_tackle_v1.blend `
  --action Tackle_blocking_v2 --offset 1 `
  --spec scripts/blender-vision/specs/vigoroth_tackle.witness.json `
  --out witness-tackle --visual
```

O comando nunca salva o `.blend` e compara seu SHA-256 antes/depois.
Com `--visual`, ele também produz um pacote multivista e `AGENT_REVIEW.md`.
O spec do Teste 01 aceita por padrão somente o SHA-256 do backup original;
uma fonte diferente exige `--allow-unpinned-source` explícito.

## Adendo (v8): percepção ativa e diagnóstico ancorado em imagem

**Problema.** O Witness já recusa aprovação falsa, mas ainda deixava um agente descrever uma região que a câmera nunca mostrou, e a câmera adaptativa só cobria a mão.

**Decisão.** `perception.py` (módulos `perception_*`) acrescenta: (1) visibilidade medida por raio na malha deformada, por frame e por região, com pedido de novas vistas até haver 2 vistas independentes ou um freio explícito; (2) passes geométricos reais (profundidade, normais, ids), sem reconstrução; (3) análise temporal com sensibilidade ao limiar e fases só como hipótese; (4) protocolo A–G com validador que só aceita afirmação ancorada em folhas abertas (código de leitura), regiões observadas e referência aprovada para qualquer aprovação artística.

**Compatibilidade.** Não altera `witness*.py`, `vision.py` nem os contratos existentes; `.blend`/GLB/FBX nunca são gravados (SHA-256 antes/depois).

**Consequências.** Região oculta passa a ser `NAO_OBSERVAVEL`/`OBSERVADO_PARCIAL` com a lista de frames, nunca "correta". O frame de contato continua nulo sem alvo autorizado. O sistema melhora a honestidade e a cobertura da evidência; **não** mede interpretação artística nem garante que o modelo entendeu a imagem.
