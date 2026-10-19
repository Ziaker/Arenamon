# Workspace inicial do laboratório

`workspace-inicial.zip` é o pacote de workspace (o mesmo que **Exportar › Workspace Completo**) embutido no HTML na compilação.
Na **primeira abertura num navegador sem workspace** (perfil novo, outro caminho de arquivo, dados limpos), o laboratório o importa
sozinho: ajustes calibrados, os dois personagens dos slots (Cogumelo e arenamon-prototipo) com as associações de animação,
calibrações salvas e preferências. Depois disso o workspace do navegador manda: nada é reimportado.

- `calibracao-v8.json`: os mesmos ajustes em JSON (referência; já estão dentro do ZIP).
- Foram retirados do ZIP, de propósito: IA do oponente desligada, IA do jogador ligada e a revisão/dificuldade da IA (não existem mais).
- Para atualizar: exporte o workspace no laboratório, substitua `workspace-inicial.zip` e rode `npm run build:combat-lab`.
- Navegadores automatizados (testes) não recebem o pacote, para os testes partirem do estado vazio. Para forçar: `?inicial=sim`; para impedir: `?inicial=nao`.
