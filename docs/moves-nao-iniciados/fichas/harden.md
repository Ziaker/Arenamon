# MOVE Harden — `harden`
**Status:** design = proposta catalogada (aprovado para registro, números NÃO homologados) · implementado e testado em `feat/moves-novos` · **homologação do diretor: pendente.**
**Fonte:** `docs/MOVES_GENERICOS_CATALOGO.md` §4 · **Código:** `src/sim/moves/harden.js` · **Testes:** `test/moves-harden.test.mjs` (13), `test/moves-new.browser.mjs`.

| Campo | Valor |
|---|---|
| Categoria / Tipo / PL | Normal · Status · **sem PL** (não participa de Clash/Counter) |
| Entrada | toque (borda) no slot; sem marcador: a confirmação é a própria pressão (MV-P11) |
| Cobrança | 0,8 de stamina e cooldown 10 s **no início do cast** (regra universal para Normal sem mira) |
| Cast | 0,35 s (movimento desliza até parar; defesa não está liberada nesse intervalo) |
| Efeito | status `harden` por 5 s: **+30% Defesa** = dano × 1/1,3 (MV-P01, mesma convenção da passiva de Defesa) e `knockbackTaken` = 0 |
| Dano / Knockback causados | nenhum / 0 m/s H e 0 m/s V |
| Knockback recebido | **anulado** (ataques e projéteis); o empurrão físico de corpo do atacante e a gravidade não são knockback (MV-P12) |
| Não faz | invulnerabilidade, anular hit stun/guard stun, segurar no ar, atravessar sólidos |
| Interrupção do cast | sem status, **sem reembolso** de stamina nem de cooldown |
| Reuso com o status ativo | renova a duração (1 pilha, sem acumular Defesa) |
| Parâmetros capturados | `C.world.harden` copiado ao iniciar o uso (M28.4): cost, cooldown, cast, duration, defensePct, negateKnockback |
| Sliders | aba Moves › Harden (6 controles, todos marcados provisórios) |
| VFX | casca cristalina branco-prateada com contorno e onda quando o golpe é absorvido (`view/status-aura.js`); `reduceMotion` desliga pulso e onda, `noFlash` limita o brilho |
| SFX | ainda não (o laboratório não tem banco de sons dos Moves) — pendente |
| IA | não usa ainda (marco M10 do plano) |
| Pendências | MV-P03 empurrão contínuo de Fields (hoje NÃO negado); homologação de números; SFX |
