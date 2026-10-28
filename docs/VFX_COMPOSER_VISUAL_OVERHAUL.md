# VFX Composer Visual Overhaul

## Estado

Implementação isolada na branch `codex/vfx-composer-visual-overhaul`, baseada no estado local mais recente da F3.2 importado da pasta oficial em 28 de outubro de 2026.

## Baseline preservado

O overhaul deve manter funcionais e compatíveis:

- explosão radial determinística por semente;
- seleção múltipla;
- rotação em graus e escala em multiplicador;
- paleta rápida e cor por objeto;
- duplicação com trilhas e remoção de objetos;
- enquadramento de cena e projeto vazio;
- recuperação por autosave e backup;
- simulação autoral determinística;
- preview real three.quarks;
- comparação Autoral/Quarks;
- demonstração viva de Brasa Ascendente, Névoa Fria e Estilhaço Arcano;
- criação, exportação e reimportação de projetos F3.2.

## Verificação de referência

- `npm run test:vfx-composer:f3:authoring`
- `npm run test:vfx-composer:f3:audit`

Os resultados desta baseline foram preservados antes da extração da nova interface. A especificação aprovada está em `docs/superpowers/specs/2026-10-28-vfx-composer-visual-overhaul-design.md` e o plano em `docs/superpowers/plans/2026-10-28-vfx-composer-visual-overhaul.md`.

## Entrega

- Workspace de autoria em cinco regiões, com viewport maximizável e painéis dimensionáveis.
- Densidade `reference-80`: o uso em zoom de navegador 80% é a referência visual, sem depender de `zoom` CSS.
- Hierarquia filtrável, inspetor por contexto e paleta de comandos em `Ctrl+K`.
- Timeline visual agrupada por objeto e família de propriedade, com keyframes e marcadores de contato/explosão.
- Barra compacta de autosave, backend e orçamento de partículas, com equivalente acessível.
- Academia VFX opcional e recolhida por padrão, com sessões retomáveis fora do documento do efeito.
- Três aulas sobre projetos editáveis comuns: Esfera mágica explosiva, Corte de energia e Círculo arcano.
- Evidências em `prototypes/vfx-composer/evidence/visual-overhaul/index.html`.

Abra `prototypes/vfx-composer/dist/arenamon-vfx-composer.html` ou use o link no `ABRIR_ARENAMON.html`.
