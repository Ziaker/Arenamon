# VFX Composer F3.2 — Design do adaptador three.quarks

## Objetivo

Adicionar ao Composer um backend visual real baseado em `three.quarks@0.17.1`, sem substituir a simulação autoral determinística da F3.1 nem antecipar a publicação/runtime da F4.

## Decisões

- `ParticleEmitter` continua sendo o único contrato persistido e a simulação fechada continua sendo a verdade de autoria, orçamento, scrub e rewind.
- Um conversor puro produz uma receita declarativa Quarks, validada e inspecionável, sem DOM, Three.js ou instâncias da biblioteca.
- Um adaptador de navegador materializa a receita em `ParticleSystem`, `BatchedRenderer`, formas, geradores e comportamentos Quarks.
- O painel oferece `Autoral`, `Quarks` e `Comparar A/B`; a escolha é uma preferência de visualização, não altera o projeto salvo.
- Perfil de qualidade e acessibilidade são aplicados antes da materialização. `noFlash` limita a opacidade e `reduceMotion` reduz emissão de forma visível e reportada.
- Mudança de emissor, troca de backend, rewind e descarte removem sistemas, geometrias e materiais pertencentes ao adaptador.

## Limite de fidelidade

O Quarks é um simulador acumulativo e seu gerador aleatório não é usado como autoridade determinística. A comparação F3.2 prova paridade de contrato — forma, janela de emissão, quantidade efetiva, vida, velocidade, aparência, gravidade e arrasto — enquanto posições exatas, orçamento e snapshots continuam vindo da simulação autoral.

## Interface proposta

- `toQuarksRecipe(emitter, options): QuarksRecipe`
- `QuarksParticlePreview.update(emitters, time, options): QuarksPreviewReport`
- `QuarksParticlePreview.reset(): void`
- `QuarksParticlePreview.dispose(): void`

`QuarksRecipe` contém apenas JSON seguro: IDs, forma, emissão, intervalos, aparência, forças, teto e avisos de aproximação.

## Segurança e desempenho

- Emissores inválidos são rejeitados antes de chegar à biblioteca.
- No máximo 12 sistemas e 1.400 partículas, seguindo o contrato existente.
- Um material compartilhado só é permitido quando blending/depthWrite e aparência forem compatíveis; a primeira versão usa material por sistema e descarte explícito para evitar acoplamento invisível.
- Telemetria diferencia backend, sistemas, partículas estimadas e aproximações; não promete FPS.

## Fora do escopo

- Publicação no jogo, compilador runtime e integração de eventos (F4).
- Trails/beams, decals, subefeitos, luzes e pós-processamento (incrementos F3 posteriores).
- Paridade numérica de cada posição aleatória do Quarks com a simulação autoral.

