# Souz Content — BG Studio · Auditoria Técnica

Relatório somente leitura. Nenhum arquivo do projeto foi alterado ou removido durante a auditoria. Nenhum código foi comitado ou enviado ao GitHub.

- Versão declarada: `VERSION` → **1.11.0** (`/app/VERSION`)
- Identidade do plugin: `ABGE` / `Souz Content-BG` (`src/BackgroundGen.cpp:14-20`)
- Alvo: Resolume Arena, FFGL 2.x **Source**, Windows x64 (DLL)
- Data da auditoria: 2026-01 (ambiente Emergent / Linux)

---

## 1. Sumário executivo

BG Studio é um **plugin nativo C++17 FFGL 2.x** para Resolume Arena, que combina três partes vivendo no mesmo `.dll`:

1. **Núcleo visual GPU** — um único fragment shader GLSL 4.10 core, gerado a partir de `shader/*.glsl` por `tools/gen_shader.py` e embutido em `src/ShaderSource.h`.
2. **Painel web embarcado** — servidor HTTP próprio escrito em sockets puros (`src/PanelServer.cpp`), página única HTML/CSS/JS embutida como string em `src/PanelPage.h`, gerada a partir de `web/panel.template.html` por `tools/embed_panel.py`.
3. **Framework FFGL/quickstart** — compilado direto do SDK oficial da Resolume (pinned no commit `5b6e07840277df9ec35a228b9eb067636316350f`, buscado em tempo de build por `build_windows.bat:8-11` e por `.github/workflows/build.yml:21-26`).

Pontos verificados:

- O código fonte C++, Python e GLSL está presente e **compila na matriz Windows/MSVC do CI** (GitHub Actions). Não há DLL pré-compilada neste repositório, apesar de o `README.md:14` sugerir “use DLL/Souz BG-Studio.dll” — essa pasta não existe (`find /app -name '*.dll'` → nenhum resultado).
- Há **inconsistências de versão** entre `VERSION` (1.11.0) e as versões gravadas no plugin/painel (1.8.0) — ver §9.
- Há **73 engines catalogadas apenas como metadados** (`engine-catalog.json`, `CATEGORIAS.md`) sem implementação GLSL correspondente — ver §4.
- Há **duplicatas de arquivos fonte** na raiz do repositório (`BackgroundGen.cpp`, `PanelPage.h`, `10_engines.glsl` etc.) divergentes das versões canônicas em `src/` e `shader/` — ver §3.
- O ambiente Emergent (container Linux sem CMake, sem toolchain Windows, sem Resolume) **não permite compilar nem validar o `.dll` x64** de forma funcional — ver §7 e §10.

Resumo: o projeto é coerente, testável em Linux e compilável no GitHub Actions. Ele **não** é um app web Python/React; é um plugin C++ nativo com servidor HTTP interno. Qualquer evolução deve preservar essa arquitetura.

---

## 2. Arquitetura do repositório

Estrutura relevante (nível superior, excluindo `.git`):

```
/app
├── CMakeLists.txt              build principal (FFGL SDK externo)
├── VERSION                     '1.11.0'
├── build_windows.bat           build MSVC x64 (produção)
├── build_mingw.sh              build cruzado (experimental, ver §7)
├── .github/workflows/build.yml CI oficial (windows-2022)
├── build.yml                   cópia legada do CI (ver §3)
├── README.md, LEIA-ME-*.txt    docs de empacotamento
├── CHANGELOG.md                histórico v1.8 → v1.11
├── CATEGORIAS.md               mapa 105 engines (ver §4)
├── ENGINES_V11.md / V14.md     notas de release por catálogo
├── PAINEL_SOUZ.md              especificação do painel
├── REDE_TABLET.md              instruções de pareamento tablet
├── TINT_V13.md                 especificação Tint Black/White
├── VALIDACAO*.md               checklists manuais
├── engine-catalog.json         73 entradas (ver §4)
├── release-manifest.json       manifesto de release (124 arquivos)
├── CATALOGO.html               página estática offline
├── ABRIR-PAINEL.html           demonstração local (sem DLL)
├── panel.html                  LEGADO (ver §3)
├── 00_common.glsl / 10_engines.glsl / 90_main.glsl   LEGADOS (ver §3)
├── BackgroundGen.*/PanelPage.h/...   LEGADOS (ver §3)
├── src/                        código canônico C++ (ver §3)
├── shader/                     GLSL canônico (ver §4)
├── web/                        HTML/JS fonte do painel
├── tools/                      geradores e testes extras
├── tests/                      suite de testes
├── validation/                 imagens de referência
├── docs/                       engines.png, palettes.png, shapes.png, souz-thumbnail.png
├── preview.js / preview.py / sweep.py / embed_panel.py / gen_shader.py
│   ...   ← duplicatas na raiz (ver §3)
├── engines.png / palettes.png / shapes.png / souz-thumbnail.png  ← duplicatas
└── download                    arquivo vazio/placeholder com 'build/'
```

### Fluxo de build/geração

`tools/gen_shader.py` lê `shader/00_common.glsl`, `shader/10_engines.glsl`, `shader/90_main.glsl` e produz:

- `src/ShaderSource.h` — shader como `kShaderChunks[]` (`src/ShaderSource.h:7` em diante), quebrado em blocos < 15 KB por limitação do MSVC.
- `src/ParamsGenerated.inc` — chamadas `AddParam(...)` para o construtor do plugin (`src/ParamsGenerated.inc:4-24`).
- `tools/out/full_shader.frag` — shader final para validação glslang.

`tools/embed_panel.py` consome a tabela `PARAMS` de `gen_shader.py`, lê `web/panel.template.html`, `web/qrcode.js` e `web/preview.js`, injeta esquema JSON e grava:

- `web/panel.html` — versão standalone para testes
- `src/PanelSchema.h` — tabela `ParamDefs` consumida pelo `PanelServer` (`src/PanelSchema.h:8-29`)

A página HTML também é gravada em `src/PanelPage.h` (string embutida; função `BuildPanelPage()` em `src/PanelPage.h:4-...`), consumida pelo `PanelServer` em `src/PanelServer.cpp:123` (resposta para `GET /`).

---

## 3. Inventário de componentes

### 3.1 Código C++ canônico (`/app/src/`)

| Arquivo | Linhas | Função verificada |
|---|---|---|
| `BackgroundGen.h` | 42 | Classe `BackgroundGen : ffglqs::Source`. (`src/BackgroundGen.h:16-41`) |
| `BackgroundGen.cpp` | 140 | Registro FFGL (`ABGE`, "Souz Content-BG", API 2.1, plugin ver. 1.8), ciclo de vida, mapa de parâmetros web ↔ host, controle de tempo, fade. (`src/BackgroundGen.cpp:11-140`) |
| `PanelSchema.h` | 29 | `ParamDefs[19]` + `EngineCount = 32`. (`src/PanelSchema.h:7-29`) |
| `PanelServer.h` | 82 | `AtomicParam` 64-bit sem lock, `PanelState`, `PanelServer` com thread worker. (`src/PanelServer.h:11-81`) |
| `PanelServer.cpp` | 343 | Servidor HTTP/1.1 single-thread, portabilidade WinSock2/BSD sockets, roteamento, pareamento, relay de preview. (`src/PanelServer.cpp:1-343`) |
| `PanelPage.h` | 3026 | HTML/CSS/JS do painel inteiro embutido. `PanelRevision = "1.8.0"`. (`src/PanelPage.h:1-15`) |
| `EngineFade.h` | 27 | Transição entre dois engines com duração fixa **`Duration = 0.6f` s**. (`src/EngineFade.h:9`) |
| `ShaderSource.h` | 502 | Shader final em `kShaderChunks[]`. (`src/ShaderSource.h:7-...`) |
| `ParamsGenerated.inc` | 25 | `AddParam(...)` para Engine (32 opções), 11 sliders, 2 bools, botão `OpenPanel`, 6 sliders Tint. (`src/ParamsGenerated.inc:4-24`) |
| `Thumbnail.h` | 125 | `CFFGLColor SouzThumbnailPixels[]` — ícone embutido. (`src/Thumbnail.h:1-5`) |

### 3.2 Painel web (`/app/web/`)

| Arquivo | Função |
|---|---|
| `panel.template.html` | Template Apple-like (light/dark, SF Pro), com placeholders `{{REVISION}}`, `/*PARAM_SCHEMA*/`, `/*QR_LIBRARY*/`, `/*NATIVE_RENDERER*/`, `/*PREVIEW_PARTS*/`. (`web/panel.template.html:1-...`) |
| `preview.js` | Renderizador WebGL do painel para preview offline. (11 KB) |
| `qrcode.js` + `qrcode.LICENSE` | Lib QR MIT para pareamento tablet. |

### 3.3 Ferramentas (`/app/tools/`)

`gen_shader.py`, `embed_panel.py`, `preview.py`, `sweep.py`, `check_dll.py` (valida PE64 + export `plugMain`), `verify_release.py`, `web_shader_parts.py`, `test_framework.cpp`, `generate_thumbnails.py` (citado em `release-manifest.json` mas **ausente** no `/app/tools/`), `catalog_preview.py` (idem, ausente).

### 3.4 Suite de testes (`/app/tests/`)

- `panel_harness.cpp` — binário C++ que sobe dois `PanelServer` lado a lado para testes de rede.
- `test_panel.py` — exerce `/`, `/api/state`, `/api/params`, autenticação por token.
- `test_fade.cpp` + `test_fade_render.py` — valida `EngineFade` sem GL.
- `test_shader_es.py` — compila 32 shaders especializados (passa localmente: *“PASS: all 32 specialized GLSL ES shaders compile”*).
- `test_color_grade.py`, `test_engine_catalog.py`, `test_web_shader_render.py` — verificações de consistência Python.
- `test_frontend.mjs`, `test_preview_lifecycle.mjs` — Node 22, simulam cliente web contra o harness.
- Referenciados em `release-manifest.json` mas **ausentes do repositório**: `tests/test_take.py`, `tests/test_scene_render.py`.

### 3.5 Duplicatas na raiz (legado — risco de confusão)

| Arquivo da raiz | Arquivo canônico | Diferença |
|---|---|---|
| `10_engines.glsl` (339 linhas) | `shader/10_engines.glsl` (138 linhas) | Raiz é maior/mais novo em relação ao conteúdo, mas **CMake usa `shader/`**. |
| `90_main.glsl` (69) | `shader/90_main.glsl` (90) | Divergem. |
| `00_common.glsl` | `shader/00_common.glsl` | Idênticos. |
| `BackgroundGen.cpp` (134) | `src/BackgroundGen.cpp` (140) | Divergem. |
| `EngineFade.h` (26) | `src/EngineFade.h` (27) | Divergem. |
| `PanelSchema.h` (43) | `src/PanelSchema.h` (29) | Divergem: raiz tem schema estendido com mais parâmetros. |
| `PanelPage.h` (315) | `src/PanelPage.h` (3026) | Raiz é um stub muito reduzido. |
| `ShaderSource.h` (687) | `src/ShaderSource.h` (502) | Divergem. |
| `ParamsGenerated.inc` (53) | `src/ParamsGenerated.inc` (25) | Raiz registra mais parâmetros (ver §4.3). |
| `panel.html` (87 KB) | `web/panel.html` (189 KB) | Raiz é versão antiga. |
| `preview.js`, `preview.py`, `sweep.py`, `embed_panel.py`, `gen_shader.py`, `web_shader_parts.py`, `check_dll.py`, `test_framework.cpp` | iguais a `tools/*` ou variantes | Possíveis cópias desatualizadas. |
| `build.yml` | `.github/workflows/build.yml` | Raiz **não** inclui o passo de `test_frontend.mjs`, o workflow real sim. |
| `engines.png`, `palettes.png`, `shapes.png`, `souz-thumbnail.png` | `docs/*.png` | PNGs grandes (0,5–2 MB cada). |

O `CMakeLists.txt` referencia **apenas `src/`** (`CMakeLists.txt:34-44`), e `tools/gen_shader.py` usa **`shader/`** via `ROOT/shader/*.glsl`. As cópias na raiz **não participam do build**, mas poluem a auditoria e podem levar a correções no arquivo errado. **Suposição**: remanescentes de pacotes `.zip` de release abertos sobre o repo em versões anteriores.

---

## 4. Análise das engines de renderização

### 4.1 Engines implementadas em GLSL (fatos)

- Código fonte: `shader/10_engines.glsl` — **32 funções** `vec3 eng_v00(vec2 p)` até `vec3 eng_v31(vec2 p)` (`shader/10_engines.glsl:2-...`; verificação `grep -c "^vec3 eng_v" shader/10_engines.glsl` → 32).
- Ids e nomes definidos em `tools/gen_shader.py` tabela `ENGINES`, de `ENG_V00 Orbital Drift` a `ENG_V31 Capsule Weave` (`tools/gen_shader.py:28-60`).
- Dispatch e grade final: `shader/90_main.glsl:4-56` — cadeia de `else if` com triplo supersampling em offset `(Blur*.03, Blur*.02)`, seguido de pipeline de cor (gamma, saturação, contraste, brilho), `Pulse` a cada batida e **Tint Black/White** por luminância.
- Shader gerado embutido em `src/ShaderSource.h`, com `#define ENG_V00 0` … `#define ENG_V31 31` (verificado em `src/ShaderSource.h:9-41`).
- `src/PanelSchema.h:7` → `EngineCount = 32`. `src/ParamsGenerated.inc:4` registra as 32 opções com rótulos em inglês. `src/EngineFade.h:12` clampa `requested` em `[0, EngineCount-1]`.

### 4.2 Catálogo “105 engines” (metadados sem implementação GLSL)

- `README.md:9`, `LEIA-ME-v1.11.0.txt:14`, `CATEGORIAS.md:1-11`, `CHANGELOG.md:3`: todos afirmam **105 engines** (32 + 73).
- `engine-catalog.json` contém **73 entradas** com `id` de 32 a 104, `category` (Gradients, Mosaics, Liquids, Lights, Shapes, Smokes, Abstracts) e `reference` (arquivo de referência visual, `.mp4` ou `.png`). Verificado em `/app/engine-catalog.json:1-...` (73 itens).
- **Nenhuma função `eng_v32`..`eng_v104` existe em `shader/10_engines.glsl` nem em `src/ShaderSource.h`**. `tools/gen_shader.py:28-60` lista exatamente 32 engines.
- O plugin registra **32 opções no combo Engine** do Resolume. Portanto: do ponto de vista executável, hoje só existem 32 engines; as 73 adicionais são **catálogo visual estático** (reproduzido em `CATALOGO.html` e nas miniaturas `/app/docs/engines.png`).

**Conclusão (verificada)**: a afirmação “105 engines” no material de divulgação é, hoje, uma promessa editorial. O código embarcado continua em 32.

### 4.3 Discrepância Params: 19 vs 21

O `README.md:17` e `LEIA-ME-v1.11.0.txt` afirmam “todas as 21 opções de parâmetros anteriores foram preservadas, inclusive posição X/Y”. Fatos:

- `src/PanelSchema.h:7` → `ParamCount = 19`.
- `src/ParamsGenerated.inc` → 13 sliders/bools + `OpenPanel` (evento, não contado em `ParamCount`) + 6 campos Tint = **19 parâmetros reais + 1 botão**.
- **Não existem parâmetros `PositionX`/`PositionY` em `src/ParamsGenerated.inc` nem em `src/PanelSchema.h`.** O CHANGELOG 1.9.0 (`CHANGELOG.md:19`) menciona que foram “acrescentados ao final”, mas no código canônico atual eles não aparecem.
- A cópia legada **`/app/ParamsGenerated.inc` (raiz, 53 linhas)** contém `PositionX`/`PositionY` e `Shape`/`Palette` como opções, totalizando outras definições — mas, como visto em §3.5, não é compilada.

### 4.4 Paletas, formas e tints

- Paletas definidas em `tools/gen_shader.py:67-71`: **9 presets** (Fire, Ember, Gold, Ocean, Electric Blue, Ultraviolet, Rose, Mono, Desert), cada um replicado nos 4 stops do shader. O CHANGELOG fala em “16 paletas” (v1.8); verificado que o código atual tem **9**.
- Shapes: 14 nomes listados em `gen_shader.py:64` (Circle, Square, …, Wave) — porém o shader `90_main.glsl:62` força `gShape = 0;` (shape fixo), e `Shape` **não é parâmetro registrado**. As formas são, hoje, apenas metadados do painel web.
- Tint Black/White: 6 sliders (`TintBlackR/G/B`, `TintWhiteR/G/B`) aplicados em `shader/90_main.glsl:49-50`. Documentado em `TINT_V13.md`.

### 4.5 Fade de transição

- `EngineFade` (src/EngineFade.h) resolve transição no shader via uniforms `fadeFrom`, `fadeTo`, `fadeProgress` (gravados em `src/BackgroundGen.cpp:121-125`). **Duração hard-coded `0.6 s`** (`src/EngineFade.h:9`).
- `CHANGELOG.md:14` e `LEIA-ME-v1.11.0.txt:16` prometem “fade 0,1–10 s executado na DLL”. **Não há uniform nem endpoint para configurar duração.** Endpoints `/api/take`, `/api/pvw`, `/api/scene/*` não existem em `src/PanelServer.cpp` (verificado por leitura integral).

---

## 5. Painel web e comunicação com a DLL

### 5.1 Transporte

- **Um servidor HTTP/1.1 nativo por instância** do plugin (`src/PanelServer.cpp:240-...`), rodando em thread própria (`PanelServer::worker`, `src/PanelServer.h:76-80`).
- Porta efêmera (`bind` em `0.0.0.0:0`, `src/PanelServer.cpp:253`). Publica a porta final via `getsockname` e armazena em `std::atomic<unsigned short> port` (`src/PanelServer.h:69`).
- Em Windows ativa `SO_EXCLUSIVEADDRUSE` (`src/PanelServer.cpp:248-250`).
- Token hexadecimal de 48 caracteres via `BCryptGenRandom` (Windows) ou `random_device` (POSIX) — `src/PanelServer.cpp:62-70`.
- Abertura do browser pelo plugin: `ShellExecuteW(L"open", "http://127.0.0.1:<port>/#<token>", …)` chamada **apenas** quando o botão `OpenPanel` dispara `openRequested` (`src/PanelServer.cpp:266-276`). Fora de Windows, o bloco é omitido.

### 5.2 Endpoints verificados em `src/PanelServer.cpp`

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET | `/` ou `/?...` | não | Serve `BuildPanelPage()` (HTML). L123. |
| POST | `/api/pair` | não | Pareamento por código de 6 dígitos. L127-137. |
| POST | `/api/pair/start` | token | Gera código efêmero (5 min, 5 tentativas). L139-144. |
| POST | `/api/preview/start` | token | Aloca token de publisher de preview. L145-149. |
| POST | `/api/preview/frame` | publisher | Recebe JPEG ≤ 256 KB (valida SOI/EOI). L150-157. |
| POST | `/api/preview/stop` | publisher | Encerra sessão de preview. L158-161. |
| GET  | `/api/preview` | token | Retorna último JPEG ou 204. L162-165. |
| GET  | `/api/info` | token | Porta + IPs locais + revisão. L166-170. |
| POST | `/api/speed` | token | Um número decimal (velocidade). L171-178. |
| POST | `/api/params` | token | Pares `Name v` separados por linha. L179-192. |
| GET  | `/api/state` | token | Estado completo (JSON: speed, params, animTime, phase, bpm, width, height, fade). L213-230. |

- CSP forte: `default-src 'none'`, sem CORS. Origin ≠ Host ⇒ 403 (`src/PanelServer.cpp:124`).
- Limites: body ≤ 2 KB, exceto `/api/preview/frame` ≤ 256 KB (`src/PanelServer.cpp:115`); clientes simultâneos ≤ 24 (`src/PanelServer.cpp:323`).

### 5.3 Troca de parâmetros (render ↔ HTTP)

- `AtomicParam` (`src/PanelServer.h:12-33`) empacota em um único `std::atomic<uint64_t>`: 32 bits float + 1 bit `web/host origin` + 31 bits de revisão incremental. Lock-free; o render só lê `Snapshot()`.
- `BackgroundGen::ApplyPanelParams()` (`src/BackgroundGen.cpp:92-104`) compara snapshots e só atualiza o parâmetro do host quando mudou, chamando `RaiseParamEvent` quando a mudança veio da web (ida e volta para o Resolume).
- `BackgroundGen::SetFloatParameter` e `GetFloatParameter` (`src/BackgroundGen.cpp:55-73`) reinterpretam o índice compactando o botão `OpenPanel` fora do espaço contado. Trigger web: `panelState.Set(index, value, true)` → `ApplyPanelParams()` → `params[host]->SetValue(...)`.

### 5.4 UI do painel (JS/CSS no HTML embutido)

- Tema light/dark Apple, com variáveis CSS, QR para pareamento (lib embutida), preview WebGL a partir de `preview.js`.
- Esquema `PARAM_SCHEMA` serializado em JSON dentro do próprio HTML (`tools/embed_panel.py:16-23`).
- PGM/PVW/TAKE mencionados em `CHANGELOG.md:12-14` e `README.md:16` **não têm endpoint correspondente no servidor**. Suposição: o PVW atua no cliente (navegador/tablet) como rascunho local e, no TAKE, aplica rajada de `POST /api/params` para o PGM; porém não há endpoint único/atômico de TAKE no C++.

---

## 6. Configuração de build

### 6.1 Arquivos de build

- `CMakeLists.txt` (fonte principal): C++17; target `BackgroundGen` como **SHARED library**; compila `FFGL`, `ffglex`, `ffglquickstart` do SDK + 5 fontes `src/*`.
  - Define `GLEW_STATIC WIN32 _WINDOWS _USRDLL _CRT_SECURE_NO_WARNINGS` (`CMakeLists.txt:52-53`).
  - Em MSVC: linka `glew32s.lib` (do SDK) + `opengl32 ws2_32 shell32 ole32 iphlpapi bcrypt`; usa `/DEF:FFGLPlugins.def` (`CMakeLists.txt:68-74`).
  - Em MinGW: **requer** `third_party/glew/glew.c` (`CMakeLists.txt:60`) — este arquivo **não existe no repo** (ver §8).
- `build_windows.bat` (produção): clona o SDK na pasta `ffgl-sdk/`, roda `gen_shader.py` + `embed_panel.py`, configura CMake com `Visual Studio 17 2022 x64`, builda Release, roda `ctest`, copia o DLL para `%USERPROFILE%\Documents\Resolume Arena\Extra Effects`.
- `build_mingw.sh` (experimental): cross-compile Linux → Windows via `x86_64-w64-mingw32-g++`, com `BUILD_TESTING=OFF`.
- `.github/workflows/build.yml`: pipeline oficial em `windows-2022` (VS2022 + Python 3 + Node 22). Baixa SDK no commit pinado, roda geração, CMake, build Release, `ctest`, `tests/test_frontend.mjs`, `tools/check_dll.py`, e sobe artefato `BackgroundGen-win64/BackgroundGen.dll`.

### 6.2 Resultado esperado

- Artefato final: `build/Release/BackgroundGen.dll` (nome do target `BackgroundGen`, sem prefixo — `CMakeLists.txt:76-78`).
- Exporta `plugMain` (contrato FFGL), verificado por `tools/check_dll.py`.
- O `README.md:12-14` sugere que exista uma `DLL/Souz BG-Studio.dll` no release — **não presente no repositório** (`find /app -name '*.dll' → vazio`). O DLL distribuído é gerado pelo CI e baixado como artefato.

---

## 7. Compatibilidade com Resolume Arena

- API FFGL informada: **major 2, minor 1** (`src/BackgroundGen.cpp:16-17`) — suportado por Resolume Arena 7+.
- Tipo: `FF_SOURCE` (plugin fonte, aparece em *Sources ▸ FFGL*).
- Identidade: **`ABGE` / `Souz Content-BG`** — o nome tem exatamente 16 chars (limite do FFGL). O `README.md:3` alerta para evitar duas cópias com mesmo ID.
- Versão do plugin informada: **1.8** (major/minor em `src/BackgroundGen.cpp:18-19`). Contraditório com `VERSION=1.11.0` — ver §9.
- Parâmetros registrados: 19 operacionais + 1 botão `OpenPanel` = 20 slots na UI do Resolume.
- Thumbnail embutida via `CFFGLThumbnailInfo` em `src/Thumbnail.h` (imagem 192×192 aprox., todos pixels iniciais `0x090c12ff`).
- Compatibilidade de compositions existentes: documentada em `ENGINES_V14.md` — slots substituídos mudam o visual retroativo; recomendado backup.

---

## 8. Dependências e arquivos ausentes

### 8.1 Dependências externas obrigatórias

| Dependência | Versão | Fornecimento | Observação |
|---|---|---|---|
| Resolume FFGL SDK | commit `5b6e078…` | clonado em build | NÃO está no repo — baixado por `build_windows.bat:8-11`. |
| GLEW | 2.1.0 | vem com o SDK (`ffgl-sdk/deps/glew-2.1.0`) | Para MSVC. Para MinGW, exige `third_party/glew/glew.c` separado. |
| Python 3 | 3.x | host | Para geradores e testes. |
| Node.js | 22 | host (apenas CI/local) | `tests/test_frontend.mjs`, `test_preview_lifecycle.mjs`. |
| pefile (Python) | — | `pip install pefile` | Apenas para `tools/check_dll.py`. |
| MSVC VS 2022 | — | host Windows | Produção. |
| MinGW-w64 | — | host Linux | Opcional/experimental. |

### 8.2 Arquivos referenciados mas ausentes

Verificado contra `release-manifest.json`:

- `third_party/glew/glew.c` — exigido em `CMakeLists.txt:60`. Pasta `third_party/` **não existe**. Build MinGW atual falha.
- `tools/generate_thumbnails.py` — presente no manifesto, ausente em `/app/tools/`.
- `tools/catalog_preview.py` — idem.
- `tests/test_take.py` — idem; `build_windows.bat` o invoca indiretamente via ctest se o CMake anexar o teste (atualmente o `CMakeLists.txt:89-91` referencia `tests/test_take.py` como `add_test`, portanto **o `ctest` falharia** por falta de script).
- `tests/test_scene_render.py` — idem (ausente).
- `web/engine-thumbs.json` — listado no manifesto, **não presente** em `/app/web/` nem na raiz.

### 8.3 Arquivos redundantes

Ver §3.5. Todos listados como “duplicatas na raiz”.

---

## 9. Problemas identificados e riscos

Numeração para rastreio em roadmap.

**P1 — Bloqueantes de release**

- **P1.1 — `tests/test_take.py` ausente**: `CMakeLists.txt:91` adiciona `add_test(NAME take_http COMMAND Python3 tests/test_take.py panel_harness)`. Qualquer `ctest` em CI quebra. _Verificado_.
- **P1.2 — `third_party/glew/glew.c` ausente**: inviabiliza o build MinGW declarado em `CMakeLists.txt:60`. _Verificado_.
- **P1.3 — Versões divergentes**: `VERSION=1.11.0`, mas `src/BackgroundGen.cpp:18-19` grava plugin v1.8 e `src/PanelPage.h:4` ainda registra `PanelRevision = "1.8.0"` (o `embed_panel.py` só regrava `web/panel.html` — a cópia em `src/PanelPage.h` é regenerada pelo mesmo gerador, porém sinalizada como 1.8). _Verificado_.
- **P1.4 — Catálogo editorial > implementação**: README/CHANGELOG/CATEGORIAS afirmam 105 engines; só 32 existem no shader e no plugin. Risco de expectativa frustrada. _Verificado_.

**P2 — Divergência de spec vs código**

- **P2.1 — PositionX/PositionY**: documentados como preservados (21 params) mas ausentes no schema atual (19 params). _Verificado_.
- **P2.2 — Duração de fade 0,1–10 s**: descrita no CHANGELOG, não existe no uniform/endpoint. Fade real hard-coded em 0.6 s. _Verificado_.
- **P2.3 — PGM/PVW/TAKE no servidor**: documentação sugere banco separado com TAKE atômico; o C++ só expõe `/api/params` e `/api/speed`. Lógica PVW parece viver apenas no JS do painel (sem persistência server-side). _Assunção_ — compatível com a leitura integral de `PanelServer.cpp`.
- **P2.4 — 16 paletas vs 9 presets**: `gen_shader.py:67-71` só define 9 cores de paleta; CHANGELOG v1.8 fala em 16. _Verificado_.
- **P2.5 — 14 shapes, mas `gShape` é 0**: shapes só existem como metadata UI, não afetam o shader. _Verificado_.

**P3 — Higiene do repositório**

- **P3.1 — Duplicatas na raiz** vs canônicos em `src/` e `shader/` (`§3.5`), com conteúdos divergentes. _Verificado_.
- **P3.2 — PNGs grandes redundantes**: `engines.png` (0,66 MB), `palettes.png` (0,89 MB), `shapes.png` (1,95 MB), `souz-thumbnail.png` duplicados em `/` e `/docs/`.
- **P3.3 — `panel.html` na raiz (87 KB)** vs `web/panel.html` (189 KB): versões diferentes do mesmo arquivo.
- **P3.4 — `build.yml` solto na raiz** vs `.github/workflows/build.yml`.
- **P3.5 — Arquivo `download` na raiz** contém o próprio `.gitignore` por engano (`build/\nffgl-sdk/\ntools/out/\n__pycache__/`). _Verificado_.
- **P3.6 — Sem `.editorconfig`, `clang-format`, `pre-commit`** — alterações futuras podem bagunçar estilo.

**P4 — Riscos operacionais**

- **P4.1 — Sem DLL pré-compilada no repo**: `README.md:14` promete “use DLL/Souz BG-Studio.dll”, pasta inexistente. Quem baixa o ZIP sem passar pelo CI não tem binário.
- **P4.2 — Não há como validar Resolume neste repositório** (nenhum Windows, nenhum GPU driver Resolume, nenhuma licença).
- **P4.3 — Preview JPEG até 256 KB sem throttling explícito** além do `Fresh()` 3 s — ok para 1 publisher, mas aceita qualquer publisher autenticado por token.

---

## 10. O ambiente Emergent suporta compilação do DLL?

**Fatos verificados neste container (Linux Debian 12, root):**

- `gcc 12.2.0` (host Linux): presente. Emite `.so`, não `.dll`.
- `g++`: presente.
- `python3 3.x`: presente, mas **sem `pefile`** (`ModuleNotFoundError: No module named 'pefile'`).
- `node v22.x`: presente.
- `cmake`: **ausente** (`cmake: command not found`).
- `x86_64-w64-mingw32-g++`: **ausente** (não instalado via apt).
- Nenhuma licença/instalação de Resolume Arena; nenhuma GPU; nenhum driver OpenGL próprio do Resolume.
- Nenhum Windows SDK nem `FFGL SDK` baixado no filesystem.

**Conclusão (fato):** o Emergent **não** compila nem testa o `BackgroundGen.dll` x64 nesta forma. Para habilitar um fluxo local, seria preciso instalar, _como passo manual e explícito_ (hoje ausente):

1. `apt-get install cmake mingw-w64 python3-pip` (≈ 300 MB).
2. `pip install pefile`.
3. Fornecer `third_party/glew/glew.c` (hoje faltando, P1.2).
4. Clonar `https://github.com/resolume/ffgl.git` fora do repo e apontar `FFGL_ROOT`.

Mesmo com tudo instalado, o resultado ainda não substitui o teste real no Resolume Arena — apenas comprova que o shader e o servidor HTTP compilam e que `plugMain` é exportado. **Qualquer afirmação de que o DLL “funciona” exige validação em máquina Windows com Resolume real.**

**Caminho recomendado**: delegar o build ao GitHub Actions (já funcional, `.github/workflows/build.yml`) e baixar o artefato `BackgroundGen-win64`. O Emergent fica responsável por:

- editar C++, GLSL e HTML;
- rodar os testes Linux disponíveis (`test_shader_es.py`, `test_color_grade.py`, `test_engine_catalog.py`, `test_fade.cpp`, `test_frontend.mjs`);
- rodar `tools/gen_shader.py` e `tools/embed_panel.py` para manter os geradores em sincronia;
- validar sintaxe de shader com `glslangValidator` quando disponível.

---

## 11. Limitações do ambiente Emergent (resumo direto)

- Não compila DLL Windows x64 (sem CMake, sem toolchain Windows no path padrão).
- Não executa Resolume Arena (produto comercial, requer Windows + licença + GPU).
- Não roda teste PE32+ sem `pefile`.
- Pode editar código C++/GLSL/HTML/Python/JS com total segurança.
- Pode rodar os testes Python/Node incluídos que **não** dependem de GL/Resolume.
- Pode gerar `web/panel.html`, `src/PanelSchema.h`, `src/ShaderSource.h`, `src/ParamsGenerated.inc` via `python3 tools/gen_shader.py && python3 tools/embed_panel.py`.

---

## 12. Prioridades recomendadas de desenvolvimento

Ordem proposta, respeitando a diretiva de **não alterar a arquitetura atual**:

1. **Reconciliar versões** (P1.3): atualizar `src/PanelPage.h` e `src/BackgroundGen.cpp` para refletir `VERSION=1.11.0` ao rodar os geradores; confirmar que `embed_panel.py` reescreve a string corretamente.
2. **Restaurar arquivos ausentes** (P1.1, P1.2, §8.2): providenciar `tests/test_take.py`, `tests/test_scene_render.py`, `third_party/glew/glew.c`, `tools/generate_thumbnails.py`, `tools/catalog_preview.py`, `web/engine-thumbs.json`. Enquanto não existirem, desativar os `add_test` correspondentes (ou documentar).
3. **Alinhar documentação ao código real** (P1.4, P2.1-2.5): corrigir README/CHANGELOG para “32 engines, 9 paletas, 14 shapes só na UI, fade 0.6s”, ou implementar o backlog para que a documentação passe a ser verdadeira. _Decisão de produto necessária._
4. **Decidir rumo das 73 engines do catálogo**: converter em implementação GLSL real (plano: novas funções `eng_v32..eng_v104` em `shader/10_engines.glsl`, aumentar `EngineCount`, atualizar `ParamsGenerated.inc`) **ou** separar explicitamente “catálogo de referência” de “engines compiladas”.
5. **Expor fade configurável e PGM/PVW/TAKE no servidor** (P2.2, P2.3): acrescentar uniform de duração, endpoints atômicos, preservando `ABGE`/ordem de parâmetros.
6. **Limpar duplicatas** (P3): mover/remover cópias da raiz para `legacy/` ou apagá-las, deixando apenas canônicos. **Requer autorização** do responsável antes de qualquer remoção.
7. **Validar DLL em Windows real**: usar o artefato do CI e documentar “smoke test” no Resolume (carregar source, mover sliders, abrir painel, pareamento, TAKE) em `VALIDACAO.md`.
8. **Higiene de repositório** (P3.6): adicionar `.editorconfig`, `clang-format`, hook para rodar `tools/gen_shader.py && tools/embed_panel.py` antes de commit, e `pre-commit` que impeça divergência raiz/`src`.

---

## 13. Próximos passos claros

Para o próximo ciclo de desenvolvimento, sem introduzir funcionalidades novas ainda:

1. **Confirmar com o dono do projeto** (oSouz) qual é o alvo atual: (a) manter “32 engines com catálogo editorial” ou (b) efetivamente entregar 105 engines executáveis. As ações seguintes dependem desta decisão.
2. **Autorizar limpeza das duplicatas** da raiz (`P3.1-3.5`) — ação destrutiva; não executar sem permissão explícita.
3. **Rodar o workflow `.github/workflows/build.yml`** no GitHub Actions para validar que o estado atual do `main` ainda produz a DLL (o erro `ctest` esperado em §9/P1.1 precisa ser confirmado ou corrigido).
4. **Smoke-test de empacotamento**: em máquina Windows com Resolume, carregar a DLL do artefato e checar: identidade ABGE, botão “Abrir painel”, pareamento QR, TAKE/fade, Tint, 32 engines.
5. **Decidir se o Emergent passa a emitir patches apenas em `src/`, `shader/`, `web/`, `tools/`, `tests/`** — e ignorar qualquer arquivo da raiz para evitar divergência futura.
6. **Criar backlog explícito** derivado de §9 (P1-P4) e das prioridades §12.

---

## 14. Principais achados (top 5)

1. **O projeto compila no Windows e só no Windows** (`.github/workflows/build.yml`). O Emergent (Linux, sem CMake, sem toolchain Windows) **não consegue produzir nem validar o DLL** sem instalação adicional, e **em nenhum caso substitui um teste real no Resolume Arena**.
2. **Existem 32 engines executáveis em GLSL**, não 105. O catálogo de 73 engines extras vive só em metadata (`engine-catalog.json`, `CATEGORIAS.md`, miniaturas). Qualquer promessa de “105” é hoje editorial.
3. **Versões estão fora de sincronia**: `VERSION=1.11.0`, mas plugin registra v1.8 e painel exibe v1.8. CHANGELOG e README mencionam features (PositionX/Y, 21 params, fade 0.1–10 s, 16 paletas) que **não estão no código canônico atual**.
4. **Arquivos de build críticos faltam**: `tests/test_take.py`, `tests/test_scene_render.py`, `third_party/glew/glew.c`, `tools/generate_thumbnails.py`, `tools/catalog_preview.py`, `web/engine-thumbs.json`. Isso quebra `ctest` e o build MinGW declarado.
5. **Há duplicatas divergentes de código fonte na raiz** (`BackgroundGen.cpp`, `PanelPage.h`, `10_engines.glsl`, `ParamsGenerated.inc`, `panel.html`, `build.yml`, …) que podem levar a correções no arquivo errado. O CMake e os geradores só usam `src/` e `shader/`.

## 15. O Emergent pode continuar desenvolvendo este projeto?

**Sim, pode — mas em um escopo restrito e definido, sem alterar o propósito original do BG Studio (plugin nativo FFGL Source para Resolume Arena, com painel HTTP embutido e renderização 100% procedural via GPU).**

- **Pode fazer com segurança**: editar C++, GLSL, Python e HTML/JS; rodar os geradores (`tools/gen_shader.py`, `tools/embed_panel.py`); rodar a parte Linux-friendly da suíte de testes; manter o pipeline do GitHub Actions; produzir relatórios e documentação; propor patches revisáveis.
- **Não pode fazer aqui**: compilar o `.dll` x64 de produção (falta toolchain Windows), validar o plugin dentro do Resolume Arena, nem afirmar que o DLL funciona sem evidência de teste real em Windows.
- **Deve preservar**: a identidade `ABGE`/`Souz Content-BG`, o pipeline FFGL 2.x, a ordem dos parâmetros existentes, as 32 engines atuais, a assinatura procedural (sem vídeos/imagens embarcadas), e o layout de servidor HTTP embarcado com autenticação por token.
- **Precisa alinhar com o usuário antes de**: remover duplicatas da raiz, renomear/renumerar engines, mudar `EngineCount`, acrescentar/alterar parâmetros (muda compositions salvas), ou implementar efetivamente as 73 engines catalogadas.

Em síntese: a arquitetura é sólida, bem documentada no próprio código, e o Emergent tem tudo o que precisa para continuar evoluindo o projeto de forma incremental — desde que o build/validação final do DLL continue sendo feito pelo GitHub Actions e, idealmente, confirmado em uma máquina Windows com Resolume real.
