# Presets de calibração (JSON)

Pasta para presets exportados pelo laboratório de combate (Exportar › Pastas do projeto), um arquivo por preset.
O laboratório lê e grava aqui quando aberto pelo servidor local opcional (`npm run dev:combat-lab`) ou quando você
escolhe esta pasta pelo navegador (acesso a arquivos com sua autorização). No HTML offline comum, os presets ficam no
workspace do navegador e no backup ZIP.

Formato: `{"schema": "arenamon-lab-preset", "version": 1, "preset": {id, name, version, description, createdAt, updatedAt, scope, categories, values}}`.
Os presets iniciais (Storm-like, Etapa A, Pesado) vivem no código e não precisam estar aqui.
