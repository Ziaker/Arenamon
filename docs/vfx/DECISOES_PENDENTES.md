# ARENAMON — Decisões de VFX pendentes de homologação/reconciliação

Este registro **não decide** nenhuma questão. Cada item distingue o documento da `main`, a fonte de branch, o efeito prático e a ação dependente de autorização do responsável.

| ID | Divergência ou questão | Evidência | Antes de implementar |
|---|---|---|---|
| P01 | O padrão da `main` requer seis grupos construídos e desligáveis; o documento exclusivo de outra branch admite `n/a` para uma fase não aplicável | [Padrão §1](atelies/PADRAO_ATELIES_VFX.md) × [Regras de Protótipos §2](atelies/REGRAS_PROTOTIPOS_VFX.md) | Definir se `n/a` é apenas uma anotação e o controle continua presente, ou exceção à obrigação técnica |
| P02 | O padrão `main` deixa em aberto se o impacto visual do disparo soma ao seletor; o plano de outra branch registra a opção **soma** | [Padrão §§3.3, 10](atelies/PADRAO_ATELIES_VFX.md) × [Plano 24/10](historico/PLANO_VFX_FASES_AREIA_PEDRA_2026-10-24.md) | Confirmar aplicação global, específica do Areia/Pedra, ou apenas da branch |
| P03 | Direção artística definitiva, paleta padrão e uso obrigatório de Quarks fora dos ateliês permanecem sem aceitação universal demonstrada | [Padrão §6](atelies/PADRAO_ATELIES_VFX.md) × [Regras de Protótipos §1](atelies/REGRAS_PROTOTIPOS_VFX.md) | Não substituir implementação legada nem estabelecer tecnologia universal |
| P04 | Impacto D e tratamentos específicos de pouso/parede não têm paridade demonstrada no `VfxRuntime` | [Impacto D](efeitos/VFX_IMPACTO_D.md), [Pouso/Paredes](efeitos/VFX_POUSO_E_PAREDES.md), [sistemas](SISTEMAS_E_RENDERIZADORES.md) | Auditoria funcional A/B e autorização para migração |
| P05 | Documento de passivas referencia `src/view/passive-vfx.js`, ausente na árvore `main` verificada; sistema ativo é `passive-abilities.js` | [Implementação de Passivas](../PASSIVAS_IMPLEMENTACAO.md) × [sistemas](SISTEMAS_E_RENDERIZADORES.md) | Revisar histórico/commit antes de corrigir documentação técnica antiga |
| P06 | Limites 5×/300× e sistemas volumétricos não têm benchmark geral com máximos simultâneos em GPU real | [Padrão §8](atelies/PADRAO_ATELIES_VFX.md), [Sólidos](efeitos/VFX_SOLIDOS.md), [Visual Quarks](efeitos/MOVES_ELEMENTAIS_VISUAL_QUARKS.md) | Testes reproduzíveis antes de fixar budget global |
| P07 | Ateliê Areia/Pedra e plano das 24 propostas existem em outra branch; integração no jogo e homologação artística não foram comprovadas | [Ateliê](atelies/LAB_AREIA_PEDRA.md), [Plano](historico/PLANO_VFX_FASES_AREIA_PEDRA_2026-10-24.md) | Aprovar visuais/escopo e auditar código da branch; não mesclar implementação incidentalmente |
| P08 | Documento de Quarks mistura descrições revisadas e históricas | [Visual Quarks](efeitos/MOVES_ELEMENTAIS_VISUAL_QUARKS.md), seção "Revisão atual" | Confirmar fichas vigentes por Move antes de criar normas adicionais; não apagar o histórico |
| P09 | Documentação dos ateliês cita comportamento `duration = 0` como desligamento, enquanto padrão novo exige interruptor por fase | [Padrão §§1.1, 3.3](atelies/PADRAO_ATELIES_VFX.md), [Visual Quarks](efeitos/MOVES_ELEMENTAIS_VISUAL_QUARKS.md) | Definir compatibilidade e migração de presets sem perda de valores antigos |

**Regras de resolução:** pedir aprovação explícita quando material; registrar data/ID/abrangência; não reescrever registro histórico; só depois alterar manual, fichas, código e testes relacionados.
