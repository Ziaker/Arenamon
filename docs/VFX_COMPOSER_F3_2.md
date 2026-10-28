# Arenamon VFX Composer F3.2

## Estado

**F3.2 concluída; a F3 completa permanece parcial.** O Composer agora materializa o contrato de partículas em `three.quarks@0.17.1` e permite comparar a prévia autoral com o backend Quarks. A simulação autoral continua sendo a verdade determinística para scrub, rewind, snapshots e orçamento.

## O que mudou

- Conversor puro `toQuarksRecipe`: valida o emissor antes da biblioteca e produz dados declarativos inspecionáveis.
- Adaptador `QuarksParticlePreview`: cria `ParticleSystem` e `BatchedRenderer` reais, mapeia as quatro formas, emissão, vida, velocidade, tamanho, cor, alpha, gravidade, arrasto, turbulência, blending e `depthWrite`.
- Seletor visível **Preview** com `Autoral`, `Quarks` e `Comparar A/B`.
- No modo A/B, as prévias ficam lado a lado; a telemetria identifica sistemas, partículas, draw calls e aproximações.
- Perfil low/medium/high, Reduce motion e No flash são aplicados antes da materialização Quarks.
- Rewind reconstrói o sistema; troca de backend, remoção e descarte liberam sistemas, batches e materiais.
- Bursts periódicos são materializados individualmente, `maxParticles` é imposto no sistema real e scrub longo usa no máximo 120 passos síncronos por rebuild.
- Draft inválido não encerra o loop: o emissor é rejeitado antes do Quarks e a telemetria informa a rejeição.
- A escolha de preview é apenas de interface e não entra no `VfxProject` nem no autosave.

## Como abrir

Abra `ABRIR_ARENAMON.html` e escolha **VFX Composer · F3.2**. Na aba **Partículas**, crie um emissor e altere **Preview** para `Quarks` ou `Comparar A/B`.

## Verificação focal

- `npm run test:vfx-composer:f3:quarks`: conversão pura, formas, emissão, qualidade, acessibilidade e entrada inválida.
- `npm run test:vfx-composer:f3:quarks:adapter`: biblioteca real, avanço, rewind, remoção e dispose.
- O mesmo teste cobre bursts repetidos, teto real, `depthWrite` no batch, abertura mapeada, draft inválido e horizonte de passos.
- `npm run test:vfx-composer:f3:quarks:browser`: HTML offline, três modos, não persistência da preferência e alternância sem acúmulo de geometria.
- `npm run test:vfx-composer:f3:browser`: regressão de determinismo, orçamento e acessibilidade da F3.1.

Resultados completos estão em `prototypes/vfx-composer/evidence/F3_2_VALIDATION.md`.

## Limites honestos

- Não há paridade numérica de posições aleatórias entre Quarks e a simulação autoral. A paridade é do contrato de parâmetros; snapshots exatos continuam autorais.
- Turbulência, abertura angular e arrasto usam as aproximações oferecidas pelo Quarks e são identificados na telemetria.
- Não foi feita medição de GPU/FPS nem baseline por hardware.
- Trails/beams, impacto desenhado, decals, máscaras de profundidade, subefeitos, luzes e pós continuam para os próximos incrementos F3.
- Publicação no jogo, eventos e compilador runtime permanecem bloqueados até a F4.

## Skills aplicadas

- `arenamon-routing` e `arenamon-vfx-composer`: gate F3 e isolamento do Combat Lab.
- `performance-optimization`: limites, telemetria e ciclo de vida explícito, sem alegação de FPS.
- `shader-programming` e `threejs-scene-setup`: integração de materiais/blending/depth e um único renderer da cena.
- `game-feel`: curvas de tamanho/cor/alpha e comparação visual A/B.
- `writing-plans`, `test-driven-development`, `systematic-debugging` e `executing-plans`: plano persistido, RED→GREEN e correção da fronteira de vetores Three/Quarks pela causa raiz.

