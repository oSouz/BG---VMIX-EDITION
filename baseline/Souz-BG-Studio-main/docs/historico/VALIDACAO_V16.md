# Validação V16 unificada

- 32 engines renderizadas, com movimento, contraste e saídas distintas.
- 32 shaders GLSL ES compilados.
- Preview e shader nativo comparados: diferença dentro de 2/255 por canal.
- Transições em 0, 25, 50, 75 e 100% aprovadas.
- Frontend: 16 paletas, abas, Tint, parâmetros, sincronização e envio rápido aprovados com servidor HTTP real.
- HTTP: autenticação, múltiplas instâncias, concorrência e encerramento aprovados.
- Ciclo de vida do preview aprovado.
- Fontes de engines conferidas contra V14-Engines; template do painel conferido contra V15-Paletas-Painel.
- DLL Windows não compilada nem testada no Resolume neste ambiente.
