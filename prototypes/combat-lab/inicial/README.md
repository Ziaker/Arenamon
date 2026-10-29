# Workspace inicial do laboratório

`workspace-inicial.zip` é o pacote de workspace (o mesmo que **Exportar › Workspace Completo**) embutido no HTML na compilação.
Na **primeira abertura num navegador sem workspace** (perfil novo, outro caminho de arquivo, dados limpos), o laboratório o importa
sozinho: ajustes calibrados, os dois personagens dos slots (**Azul = Wookada, Vermelho = Cogumelo**) com as associações de animação,
as 15 calibrações salvas, o preset «tester», a câmera cinematográfica e as preferências. Depois disso o workspace do navegador manda: nada é reimportado.

- Versão atual: exportação de **28/10/2026 22:36 UTC** (laboratório v1.42.0), enviada pelo responsável como «as configs principais». Entrou **sem retiradas**
  (a versão anterior, de 18/10, tinha tirado do ZIP a IA do oponente e a revisão/dificuldade da IA; agora valem os ajustes exatamente como exportados:
  IA do oponente ligada, IA do jogador desligada, `extras.ai.revision` 1).
- `calibracao-v8.json`: os ajustes do mesmo dia em JSON (referência; a base do jogo em `src/sim/calibration-base.js` vem dele, ver `docs/CALIBRACAO_BASE_V8.md`).
- Para atualizar: exporte o workspace no laboratório, substitua `workspace-inicial.zip` e rode `npm run build:combat-lab`.
- Navegadores automatizados (testes) não recebem o pacote, para os testes partirem do estado vazio. Para forçar: `?inicial=sim`; para impedir: `?inicial=nao`.
