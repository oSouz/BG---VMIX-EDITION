# Validação v1.11.1

Ambiente: Linux, Mesa llvmpipe (OpenGL 4.1 core e GLSL ES 3.0), MinGW-w64 para a DLL Windows.
Não executado no Windows/Resolume: uso real e desempenho no LED precisam de validação no equipamento.

## Restauração da 1.11.0

O código da 1.11.0 nunca tinha sido enviado ao repositório. Ele foi recuperado do painel da 1.11.0
(ABRIR-PAINEL.html, commit "v1.11.0"), que incorporava o shader completo das 105 engines, o schema
de 21 parâmetros, as miniaturas, as categorias e o JavaScript PGM/PVW/TAKE.

- Shader FFGL reconstruído × shader original da 1.11.0: as 105 engines, com tint neutro e com tint
  personalizado, posição deslocada e blur, diferença ≤ 2/255 por canal (a maioria idêntica).
- web/panel.html gerado × painel original da 1.11.0: idêntico (exceto o número da versão).
- O lado nativo do TAKE (C++) não estava no painel e foi reimplementado: endpoint /api/take,
  estado `scene` em /api/state e fade da cena completa em duas passadas.

## Testes

| Teste | Onde roda | O que cobre |
|---|---|---|
| tests/test_fade.cpp (ctest `engine_fade`) | CI Windows, Linux | fade de engine, TAKE: limites de duração, relógio independente, smoothstep, fila única, commit único |
| tests/test_panel.py (ctest `panel_http`) | CI Windows, Linux | HTTP, autenticação, pareamento, 105 engines, 21 parâmetros, TAKE (fila, corpo estrito, 409, desbloqueio), duas instâncias, deadlines |
| tests/test_panel.py (backgrounds salvos, v1.14) | CI Windows, Linux | /api/presets: corpo estrito, UTF-8, mesmo nome substitui, lista compartilhada entre instâncias, arquivo de outra versão/danificado, limite de 100 |
| tests/test_release_manifest.py (ctest `release_manifest`) | CI Windows, Linux | manifesto determinístico, CRLF, arquivos alterados/ausentes/estranhos |
| tests/test_frontend.mjs | CI Windows, Linux | JavaScript real do painel contra o servidor real: controles, galeria, paletas, tint, PVW isolado, TAKE com bloqueio/commit/desbloqueio |
| tests/test_preview_lifecycle.mjs | CI Windows, Linux | preview WebGL: zero GPU ao abrir, cache limitado, fade de engine e de TAKE, perda de contexto |
| tests/test_plugin_render.py | Linux (Mesa) | **classe real do plugin** num host FFGL mínimo: TAKE e troca de engine renderizados e comparados quadro a quadro (≤ 2/255); estado de blend restaurado |
| tests/test_fade_render.py | Linux (Mesa) | crossfades de engine e de cena completa = mistura dos extremos |
| tests/test_web_shader_render.py | Linux (Mesa) | 105 shaders do preview = shader FFGL (≤ 2/255) |
| tests/test_shader_es.py | Linux (Mesa) | 105 shaders GLSL ES compilam, uma engine cada |
| tests/test_engine_catalog.py | Linux (Mesa) | 105 engines animam, têm contraste e são distintas; gera validation/engine-overview.jpg |
| tests/test_color_grade.py | Linux (Mesa) | grade, Warp/Pulse, posição, regra de tint das engines 32+ |

Os testes Linux (Mesa) precisam de libEGL; tests/test_plugin_render.py precisa também do SDK FFGL
(`ffgl-sdk/` ou caminho como argumento).

## DLL

- Compilada com MinGW-w64 (build_mingw.sh): PE x64, exports plugMain e SetLogCallback.
- Imports: bcrypt, iphlpapi, kernel32, msvcrt, ole32, opengl32, shell32, ws2_32.
- Identidade ABGE preservada; versão do plugin 1.11.

## Observação técnica

O dispatch das 105 engines é feito em dois níveis (grupos de 16). Um `switch` único com ~74 ou mais
casos é compilado incorretamente pelo Mesa (engines 79–104 erradas); dividir evita o problema e
reduz o risco em outros drivers.
