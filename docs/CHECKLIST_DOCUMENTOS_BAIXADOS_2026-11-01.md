# Checklist dos 8 documentos baixados — estado em 01/11/2026

Base: `main` b2b6c9f2 (v1.49.24). Conferido por código, relatórios do repositório e `tsc` (0 erros). Não foram rodados testes de navegador nem baterias: o que depende deles está como não verificado.
Legenda: ✅ implementado · 🟡 incompleto · ❌ não feito.

## 1. Auditoria de 29/10 (A-01 a A-15)
- ✅ A-01 TypeScript: `tsc` passa com 0 erros.
- ✅ A-02 Limite de velocidade: corrigido na v1.49.1 (`65a12c87`, tackle carregado). `properties.test.mjs` não reexecutado.
- ✅ A-03 Índice vivo dos Moves: regenerado em 01/11 e a CI documental passa.
- ✅ A-04 Validação Editor × motor: a gravação chama `validateMoveData` com as regras mecânicas.
- 🟡 A-05 Testes fora da cadeia: 197 arquivos de teste; falta descoberta automática dos elegíveis e o inventário dos excluídos.
- ❌ A-06 Proteção da `main` no GitHub: decisão administrativa sua.
- ✅ A-07 Gravações concorrentes: exclusão mútua por arquivo e `.tmp` próprio.
- ✅ A-08 `withRegistry` assíncrono: pilha de escopos.
- ✅ A-09 `save`/`load`: levam modo, semente e perfis.
- 🟡 A-10 Sand Wave na recuperação: há tratamento (`continuesDuringStagger`), sem matriz de regras documentada.
- ✅ A-11 Cache do Sand Wave: assinatura inclui `hz`, raio e ângulo.
- 🟡 A-12 Custo do Dijkstra com sliders extremos: sem medição (só mede se o usuário pedir).
- 🟡 A-13 Typecheck de UI/view: `tsconfig.json` cobre só `src/sim`; `tsconfig.vfx.json` cobre módulos de VFX.
- 🟡 A-14 Navegador na CI: job só sob demanda; sem smoke para PR.
- ✅ A-15 `POST /__dev/rebuild`: confere `Origin`/`Host`.

## 2. Overhaul F0–F9 (`Arenamon_Claude_Overhaul_Final`)
Fonte: `docs/RELATORIO_OVERHAUL_F0_F9.md` (29/10, v1.43.0).
- ✅ F0–F4: auditoria, contratos, correções P0, resolvedores de dano e reação (inclui counterStagger, breakByTackle e stagger de parede do Sand Wave), `contactId` por instância, eventos, permissões, consultas de colisão.
- ✅ F6: 19 Moves com matriz executável e contratos verdes.
- 🟡 F5 VFX: 38/43 verificações; 5 referências antigas esperam aceite em `AB_PARIDADE.html`; modos `useNewVfx` e quarks nunca vistos a olho.
- 🟡 F7 Editor: 24 sliders órfãos, 304 de gameplay sem A/B observável, 354 sem unidade, 2 bônus de estágio só no HUD.
- 🟡 F8: simulação ok (86.400 passos, 100 resets); faltam relógio de rodada, intervalo de 45 s, preparação de 90 s, 100 resets pelo fluxo do app, acessibilidade fora do VFX padrão.
- 🟡 F9: adaptadores `launch`/`pushAway`/`knockbackReaction` mantidos de propósito; `getCeilingHeight` e `map-collision.js` não migrados.
- 🟡 Frente visual do Sand Wave segue retângulo reto (decisão sua).
- ❌ Relatório final de homologação.

## 3. DOC01 e DOC02 (Sand Wave, Bullet Punch, Water Pulse)
- ✅ Os 3 Moves em pastas próprias (`.move.json`, `.js`, `.vfx.js`); os outros 16 no formato antigo, como pedido.
- ✅ Cobertura mecânica fechada: 173 candidatos, 173 decididos, 0 abertos.
- 🟡 Não conferidos: pacote de entrega DOC01→DOC02 (`catalogo_parametros.json`, replays de baseline) e os portões SW-02/BP-02/WP-02.

## 4. DOC03 (Editor avançado) — NÃO HOMOLOGADO
- ✅ Portão ZERO fechado e detector de mutação ativo.
- ✅ Perfil do empurrão no Editor, com teste de navegador.
- ❌ Gizmos para arrastar atores no palco 3D.
- ❌ Fantasma A/B visual lado a lado.
- ❌ Linha do tempo com passo a passo e bookmarks.
- ❌ Presets nomeados, desfazer/refazer persistente, cenários salvos.
- ❌ Exportar relatório por Move direto do Editor.
- ❌ Teste WebGL pixel a pixel e `npm run verify` completo.

## 5. Game Feel 5–9 (`docs/GAME_FEEL_5_9.md`, v1.49.0)
- ✅ 5 Golpe no vazio (ligado por padrão).
- ✅ 6 Fases da animação (modo Definição por padrão; contrato viaja no save).
- ✅ 7 Animações de borda (clipes só se existirem).
- ✅ 8 Pés e 9 Olhar (desligados por padrão).
- 🟡 21 testes de unidade e testes de navegador existem; não reexecutados. Desempenho (~0,4 ms) medido com render por software.

## 6. Banco de referências Z-A (Fase 1 e Revisão 2)
- ✅ 1A–1B: inventário reconciliado (41.790 clipes, 979 fora da busca explicados); paridade FK < 0,001% de H.
- ✅ 1C–1H: executores por anatomia, cinemática, contato, folhas visuais, poses-chave, normas (status candidato / não avaliado).
- 🟡 1I: lotes e gabarito existem (placar 17/19); faltam rótulos humanos para calibrar o limiar de 10° do apoio/impulso.
- ❌ 1J: Motion Lens, Blender Vision e Direction Lines ainda não leem `normas_za.json`.
- ❌ Teste cego contra o assistente sem o corpus.
- 🟡 Conflito `AGENTS.md` × `README.md` sobre publicar recursos proprietários: decisão do usuário.

## Decisões que só o usuário pode tomar
Aceitar as 5 referências visuais; destino dos 24 sliders órfãos; curvar ou não a frente do Sand Wave; proteção da `main`; publicação do corpus Z-A.
