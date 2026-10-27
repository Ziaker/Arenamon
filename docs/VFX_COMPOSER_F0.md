# Arenamon VFX Composer F0

## Estado da entrega

**F0 concluída localmente; parada obrigatória antes da F1.** Os contratos e as provas exigidas pelo gate F0 estão implementados. Ainda não existe janela, viewport, editor ou painel do Composer, porque esses itens começam na F1.

O schema inicial é a versão 1, portanto ainda não existe versão anterior para converter; a migração reconhece v1 e rejeita versões futuras. Schemas detalhados de geometria, materiais, partículas e o compilador/player pertencem respectivamente às fases F1–F4 e não foram antecipados. Publicação no jogo também pertence à F4.

## O que existe

- Schemas TypeScript e validadores defensivos para projeto autoral, runtime compilado e ligação de Move.
- Seis fases autorais `start`, `launch`, `body`, `hold`, `finish` e `impact`, com fases desligáveis e branching exclusivo de desfecho.
- Conversão de tempo para autoria em 24, 30 e 60 FPS sem dependência do passo da simulação.
- Classificação estrita de eventos; eventos desconhecidos, `miss`, `timeout` e `cancel` não disparam impacto.
- Cancelamento e cleanup idempotentes com motivo preservado.
- Ordenação semântica de versões, incluindo o caso `1.9.0 < 1.10.0`.
- Serialização e leitura de projeto com validação, componentes fixados por versão e rejeição de campos executáveis.
- Rejeição de caminhos absolutos, protocolos remotos e traversal `..` em assets.
- PRNG determinístico isolado e contratos de orçamento low, medium e high.

## Fronteiras preservadas

O pacote `prototypes/vfx-composer` não importa a simulação, Three.js, DOM, scheduler legado ou renderizadores. A F0 não altera `Game.step`, dano, hitboxes, invulnerabilidade, colisão ou efeitos aprovados.

## Como verificar

```powershell
npm run test:vfx-composer
npm run typecheck:vfx-composer
```

O teste focado cobre 23 contratos. A fixture canônica fica em `prototypes/vfx-composer/test/fixtures/canonical-project.json`.

Na segunda continuação foram tipados nós, assets, tracks e subefeitos, com limites e validação de IDs/referências/ciclos/keyframes. Snapshots são cópias profundamente congeladas. Cancelamento possui política de dissipação capturada no nascimento e cleanup idempotente que continua mesmo se um recurso falhar. Eventos desconhecidos e cancelamento retornam desfecho nulo; somente miss/timeout selecionam finish.

Na terceira continuação foram adicionados stream de eventos com deduplicação, contato obrigatório e capacidade limitada; `hold` ligado ao estado autoritativo do objeto; catálogo imutável com atualização e rollback explícitos; e pacote ZIP real com manifesto, SHA-256, limites, confinamento de caminhos e conferência das dependências declaradas. O ZIP F0 usa entradas armazenadas sem compressão para permitir validar os tamanhos antes da extração. Um relatório HTML offline é gerado em `prototypes/vfx-composer/dist/arenamon-vfx-composer.html`.

Na continuação de 26/10, foram adicionadas validação recursiva de dados JSON (não finitos, funções, ciclos, getters, campos perigosos e limites), proteção contra nomes herdados na classificação de eventos e recuperação por dois slots com rejeição de revisão antiga. A recuperação foi testada com armazenamento em memória; persistência em navegador e falhas reais de disco ainda não foram verificadas. Removidos os tetos de draw calls sem medição: o resultado agora explicita `performanceVerified: false`.

Na continuação final da F0, uma auditoria estática passou a conferir os seis eventos marcados como disponíveis diretamente nos produtores atuais `combat.js` e `game.js`, sem importar nem executar a simulação. Se essas emissões mudarem, o contrato falha em vez de manter uma capacidade obsoleta.

Verificação desta continuação: 23 testes focados, typecheck, build próprio do Composer e smoke test offline do relatório no Edge aprovados. O build do combate continua bloqueado pela proteção contra downgrade (fonte 1.36.0, dist 1.40.0). Sem commit/push nesta etapa; a integração com o jogo não foi executada, conforme a fronteira F0/F4.

## Próximo marco

STOP normativo da especificação: F1 exige nova autorização explícita. Ela incluirá a aplicação HTML offline, viewport e autoria geométrica; nada disso faz parte desta entrega.
