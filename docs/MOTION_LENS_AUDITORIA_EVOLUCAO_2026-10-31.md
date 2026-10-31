# Motion Lens — auditoria de confiabilidade e propostas de evolução

Data: 31/10/2026. Especificação operacional: `ARENAMON_MOTION_LENS_AUDITORIA_MELHORIAS_PROMPT_AGENTE.docx` fornecida pelo responsável.

## Resultado executivo

O código-fonte do Motion Lens passou de 15 para 17 operadores e de 36 para 40 propriedades registradas. Os dois operadores de golpe que já existiam no código agora são acessíveis no painel, sem remover nenhum comando anterior. A análise de golpe declara explicitamente **CANDIDATO de contato**, usa o intervalo real da Action e informa frames, segundos, m/frame e m/s. A criação de uma Action derivada é transacional, não altera a original nem o intervalo da cena e restaura Action, Action Slot, frame e subframe. As comparações também restauram o Action Slot.

O instalador foi endurecido contra falhas no staging, backup, remoção e publicação. Nenhuma instalação foi executada: o Blender do usuário continua com a versão 0.3.2 anteriormente instalada. O fonte auditado é 0.3.3.

## Inventário preservado

| Estado | Propriedades | Operadores | Observação |
|---|---:|---:|---|
| Antes | 36 | 15 expostos | `strike` e `apply_impact` existiam, mas não eram registrados |
| Depois | 40 | 17 expostos | todos os 15 anteriores preservados; quatro controles de golpe adicionados |

Nenhuma mecânica de combate, arquivo `.blend`, animação original, Wookada, Cogumelo, Animation Studio ou recurso proprietário foi alterado.

## Defeitos R01–R08

| ID | Evidência e decisão | Estado |
|---|---|---|
| R01 | `strike` e `apply_impact` existiam, mas faltavam no registro. Agora aparecem em **Analisar e derivar golpe**. | Corrigido e testado |
| R02 | Quatro propriedades eram consumidas sem registro. Foram registradas com rótulos, limites e unidades visíveis. | Corrigido e testado |
| R03 | Uma falha depois do backup podia deixar a instalação parcial. A remoção/publicação agora fica dentro da transação e o rollback restaura entrada e módulos. | Corrigido com cinco testes de falha |
| R04 | A heurística confundia desaceleração com contato confirmado. Todos os textos e retornos agora dizem **CANDIDATO**, com limite explícito. | Corrigido e testado |
| R05 | A derivação podia vazar estado e usar nome já existente. Agora tem nome único, Action Slot compatível, rollback e restauração de Action/slot/frame/subframe/faixa. A comparação também preserva slot. | Corrigido e testado |
| R06 | Duas cópias carregadas no mesmo processo reutilizam o primeiro `motion_lens_parts` no `sys.modules`. O probe 9.9.1/9.9.2 reproduziu a colisão. | Confirmado; migração requer aprovação |
| R07 | Fonte agora declara 0.3.3 em um único módulo e documentação distingue fonte de instalado. Hash do ponto de entrada isolado não basta para identificar o pacote modular; os hashes das partes devem integrar um manifesto futuro. | Parcial: fonte/documentos coerentes; instalação não autorizada |
| R08 | A análise usava a faixa da cena. Agora usa `Action.frame_range` e torna FPS/unidades explícitos. | Corrigido e testado |

## Proposta R06 — imports isolados (aprovação necessária)

Migrar o addon de um arquivo de entrada solto que importa `motion_lens_parts` globalmente para um pacote Blender com imports relativos e identidade própria. Critérios de aceite: duas versões podem ser carregadas em processos de teste sem reutilizar módulos; atualização/rollback continuam atômicos; os 17 operadores e 40 propriedades permanecem; arquivo legado recebe uma rota de migração; instalação real só ocorre após autorização. Risco principal: compatibilidade do identificador do addon e preferências existentes. Rollback: manter o pacote 0.3.3 instalável até a nova estrutura passar nos mesmos testes.

## Mapa das 15 melhorias, sem duplicação

| ID | O que já existe | Proposta concreta antes de implementar |
|---|---|---|
| F01 — oito direções | Gigantic inventariado tem Run em 8 direções; Studio já organiza clips. | Relatório de cobertura por direção e espelhamento, separando animação autoral de adaptação runtime. |
| F02 — transições | Studio possui timeline, scheduler e eventos; nomes de transição existem nas referências. | Analisar continuidade de raiz, pés e pose entre pares de clips, sem criar outro editor. |
| F03 — mapa semântico de rig | `pose_lib.py`, Direction Lines e Motion Lens resolvem papéis; Studio e corpus Z-A têm rascunhos de papéis. | Um contrato compartilhado `arenamon.rig-map/1`, com confiança e overrides por personagem. |
| F04 — comparação entre rigs | Motion Lens compara Actions no mesmo armature; Z-A tem métricas FK normalizadas. | Normalizar por altura, origem, quadril, orientação e segundos; nunca comparar coordenadas brutas. |
| F05 — navegação de referências | Blender Vision indexa referências; corpus Z-A já tem catálogo local. | Adaptador de índice somente leitura, sem copiar/publicar assets proprietários. |
| F06 — golpe | Agora há timing candidato; Witness/Blender Vision geram evidência visual. | Confirmar contato só com alvo geométrico ou evento autorizado e registrar a fonte da confirmação. |
| F07 — peso/impulso | Perception mede trajetórias; Z-A possui papéis/suporte. | Métricas explicáveis de preparação, aceleração, transferência do quadril e apoio, sem nota artística automática. |
| F08 — root motion | Animation Studio já analisa e edita root motion. | Motion Lens apenas consome/exporta o diagnóstico do Studio; não duplicar editor. |
| F09 — silhueta/poses | Contact sheets, esqueleto, Witness e Perception já existem. | Orquestrar evidências existentes com frames candidatos e justificativa rastreável. |
| F10 — smear/exagero | Contratos já verificam janelas; corpus Z-A traz normas. | Sugerir janelas/ossos e limites; não inserir escala/keyframes automaticamente. |
| F11 — diretor de pose | `pose_lib.py` cria poses e `apply_fix.py` aplica correções controladas. | Motion Lens emite proposta JSON de pose; aplicação continua separada e explícita. |
| F12 — correção localizada | `apply_fix.py` já é o executor seguro. | Definir adaptador de proposta com Action fonte, frames, ossos, valores, confiança e rollback. |
| F13 — variantes A/B/C | Studio já compara variantes; Motion Lens tem baseline/diff. | Agregar resultados em um relatório comparável, sem decidir automaticamente o “melhor”. |
| F14 — timeline interativa | Animation Studio já é a interface apropriada. | Não duplicar no Blender; expor links/JSON somente se houver fluxo real aprovado. |
| F15 — relatório para IA | Motion Lens gera HTML; Witness gera JSON/evidências. | Esquema versionado com achado, evidência, limite, proposta, risco e passos reproduzíveis. |

## Referências profissionais usadas com cautela

- **Gigantic: Rampage Edition:** a amostra local da Fase 0 mostra Run em oito direções, coberturas assimétricas de Dodge/Sprint, clips direcionais e rigs distintos (80–127 ossos). Isso apoia análise por função e direção, não cópia direta entre esqueletos. Duração deve ser comparada em segundos, não apenas frames.
- **Pokémon Legends: Z-A:** o catálogo local já contém papéis, poses, normas e métricas de muitos clips. A integração oficial com Motion Lens ainda precisa ser escolhida; o relatório propõe consumir o índice, sem duplicar o acervo ou publicar recursos.

## Fases propostas para aprovação

1. **Contrato semântico e relatório IA (F03 + F15):** somente schemas, adaptadores e fixtures sintéticas.
2. **Análise de direção/transição (F01 + F02 + F04):** relatório read-only, normalizado por tempo e rig.
3. **Golpe e peso com evidência (F06 + F07 + F09):** alvo/evento explícito e evidências reaproveitadas.
4. **Propostas aplicáveis (F10–F13):** Motion Lens propõe; `pose_lib.py`/`apply_fix.py` aplicam apenas sob comando.
5. **Integração de interface (F05 + F08 + F14):** só após validar que Studio/Blender Vision não atendem o fluxo.

Nenhuma dessas fases maiores foi implementada nesta entrega. A aprovação deve indicar a fase, os personagens e se é permitido abrir/salvar cópias derivadas.

## Testes específicos

- Blender 5.2.2, factory startup: inventário 40 propriedades/17 operadores e registro/desregistro repetido.
- Blender 5.2.2, rig sintético: intervalo 10–20 apesar da cena 1–250; unidades; candidato; fonte imutável; nome/slot; rollback; preservação de Action, slot, frame, subframe, câmera, render e seleção.
- Python unittest: cinco cenários do instalador (limpo e falhas em staging, backup, remoção e troca).
- Probe de imports: colisão 9.9.1/9.9.2 reproduzida, mantida como diagnóstico arquitetural.

## Limitações e não verificado

- Wookada e Cogumelo não foram abertos nem alterados, pois a especificação condiciona validações reais à autorização.
- Não houve instalação, teste no perfil real após instalação, benchmark, bateria completa, avaliação visual artística nem teste de combate.
- Gigantic foi usado apenas como inventário local read-only; nenhuma mídia proprietária entrou na entrega.

## RESUMO PARA CHATGPT — MOTION LENS

O Motion Lens fonte está em 0.3.3, modularizado em `scripts/blender-vision/addons/motion_lens.py` + `motion_lens_parts/`. A instalação real permanece 0.3.2 porque o usuário proibiu instalar addons sem autorização. O inventário público passou de 15/36 para 17 operadores/40 propriedades, preservando todos os recursos anteriores. `strike` e `apply_impact`, já existentes mas ocultos, agora estão registrados em um bloco funcional visível.

Os defeitos objetivos R01–R05 e R08 foram corrigidos com testes sintéticos: golpe usa a faixa real da Action, informa frames/segundos e m/frame/m/s, chama o suposto contato de CANDIDATO, não de fato confirmado; derivação trabalha em cópia com nome único e slot compatível; falhas removem a cópia parcial e restauram Action/slot/frame/subframe/faixa; comparações restauram slot; o instalador tem staging/backup/publicação/rollback testados.

R06 foi reproduzido: duas árvores do addon no mesmo processo colidem no nome global `motion_lens_parts`, fazendo a segunda reutilizar a primeira versão. Não corrigir silenciosamente. A solução proposta é empacotamento Blender com imports relativos, migração compatível e testes de coexistência, sujeita a aprovação. R07 ficou coerente no fonte e documentação, mas a cópia instalada deliberadamente não foi atualizada.

As F01–F15 foram mapeadas contra Blender Vision, Animation Witness, Direction Lines, `pose_lib.py`, `apply_fix.py`, Animation Studio, corpus Z-A e inventário Gigantic. Direção/transição e comparação cross-rig devem ser análises normalizadas; root motion/timeline pertencem ao Studio; pose/correção deve usar propostas JSON e os executores existentes; contato só pode ser confirmado por alvo/evento; relatórios para IA devem carregar evidência e limites. Próxima decisão recomendada: aprovar primeiro F03 + F15 (contrato semântico e relatório rastreável) com fixtures sintéticas; depois autorizar explicitamente quais cópias derivadas de Wookada/Cogumelo podem ser usadas.
