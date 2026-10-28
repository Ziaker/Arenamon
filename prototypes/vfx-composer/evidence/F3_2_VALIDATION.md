# Evidência de validação — VFX Composer F3.2

Data: 27/10/2026
Escopo: adaptador declarativo `three.quarks@0.17.1`, preview A/B e ciclo de vida.

## Critérios verificados

| Critério | Evidência automatizada | Resultado |
|---|---|---|
| Conversão defensiva e independente de DOM | `f3-quarks.test.mjs` | Aprovado |
| Quatro formas e emissão burst/contínua | `f3-quarks.test.mjs` | Aprovado |
| Perfil, Reduce motion e No flash | `f3-quarks.test.mjs` | Aprovado |
| Instâncias reais de ParticleSystem/BatchedRenderer | `f3-quarks-adapter.test.mjs` | Aprovado |
| Rewind reconstrói; remoção/dispose zeram sistemas | `f3-quarks-adapter.test.mjs` | Aprovado |
| Burst periódico, teto real e `depthWrite` do batch | `f3-quarks-adapter.test.mjs` | Aprovado |
| Abertura consumida e scrub de 60 s limitado a 120 passos | `f3-quarks-adapter.test.mjs` | Aprovado |
| Draft inválido é rejeitado sem interromper o loop | `f3-quarks-adapter.test.mjs` + `f3-quarks.browser.mjs` | Aprovado |
| Modos Autoral, Quarks e A/B no HTML offline | `f3-quarks.browser.mjs` | Aprovado |
| Preferência de preview não altera VfxProject | `f3-quarks.browser.mjs` | Aprovado |
| Seis trocas de backend sem crescimento fora do limite | `f3-quarks.browser.mjs` | Aprovado |
| Regressão F3.1 | `f3-app.browser.mjs` | Aprovado |

## Limitações da evidência

- O teste mede contagem de recursos e comportamento, não tempo de GPU ou FPS.
- A comparação A/B é visual/contratual; não afirma igualdade das amostras aleatórias internas do Quarks.
- O teste é focal no Edge headless e offline; QA manual em outros navegadores não foi executado.
