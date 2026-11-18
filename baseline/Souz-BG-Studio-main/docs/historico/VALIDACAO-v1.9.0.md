# Validação v1.9.0

- DLL Windows x64 compilada com MinGW-w64 13.2, SDK Resolume fixado no commit registrado em ffgl-sdk/SDK-COMMIT.txt.
- PE x64 (0x8664), exports plugMain e SetLogCallback.
- Imports: bcrypt, iphlpapi, kernel32, msvcrt, ole32, opengl32, shell32, ws2_32.
- Testes HTTP: autenticação, pareamento, parâmetros, múltiplas instâncias, concorrência, shutdown e restart.
- TAKE: validação de snapshot completo, fila sem alteração antecipada do PGM, captura da origem no render, bloqueio de reentrada e desbloqueio.
- Frontend com DOM e servidor HTTP reais: PGM/PVW isolados, persistência entre abas e polls, snapshot imutável após envio, todas as funções anteriores, presets e X/Y.
- Lifecycle WebGL: sem contexto no carregamento, no máximo dois programas, perda de contexto, timeout, erro de compilação e limpeza.
- Mesa: 32 engines com movimento e imagens distintas; GLSL ES especializado compilado para todas as engines.
- Fade de engines e TAKE: comparação da mistura de pixels nos pontos 0/25/50/75/100%; cena completa inclui clocks independentes, escala, posição e tint, inclusive mesma engine.
- Comparação WebGL/FFGL: desvio máximo 2/255 nos testes de 30 engines. Engines 8 e 23 têm descontinuidades de floor/fract em bordas exatas de células: percentil 99 <= 2/255, erro médio < 0,5/255; pixels isolados podem divergir mais.
- Preview de demonstração: inicialização e interações locais testadas com DOM (não é teste de layout).

Limites: não executado em Windows/Resolume nem em LED físico. O navegador headless local não pôde iniciar devido à restrição de sockets deste ambiente; o layout não foi inspecionado por screenshot automatizado. A DLL requer ensaio na GPU e resolução da operação; o custo aumenta durante a mistura de duas cenas. Não declarar homologação de produção.
