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

Os resultados desta baseline devem ser registrados antes da extração da nova interface. A especificação aprovada está em `docs/superpowers/specs/2026-10-28-vfx-composer-visual-overhaul-design.md` e o plano em `docs/superpowers/plans/2026-10-28-vfx-composer-visual-overhaul.md`.
