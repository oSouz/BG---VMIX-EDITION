# Souz BG-Studio — Fase 1: Estabilização do Build

Relatório técnico da Fase 1. Base: `docs/reports/BG_STUDIO_TECHNICAL_AUDIT.md`.

- Versão resultante: **1.8.1** (decisão do responsável, 2026-06)
- Identidade FFGL preservada: `ABGE` / `Souz Content-BG`, API 2.1, FF_SOURCE, major 1 / minor 8
- Nada foi commitado, enviado ao GitHub ou mesclado. As mudanças estão no working tree, prontas para revisão.

---

## 1. Diagnóstico

### 1.1 A versão 1.11.0 não corresponde ao código

O histórico do git mostra que o commit `a0561a6 "v1.11.0"` alterou só: `ABRIR-PAINEL.html`, `CATALOGO.html`, `CATEGORIAS.md`, `CHANGELOG.md`, `CMakeLists.txt`, `LEIA-ME-v1.11.0.txt`, `README.md`, `VALIDACAO*.md`, `VERSION`, `build_mingw.sh`, `engine-catalog.json` e `release-manifest.json`.

**Nenhum arquivo em `src/`, `shader/`, `tests/`, `tools/` ou `web/` foi alterado.** A DLL gerada por este repositório continua sendo a linha 1.8 (32 engines, 19 parâmetros). Por isso o `VERSION=1.11.0` não foi usado como referência. A versão escolhida foi **1.8.1**: uma correção de build da linha 1.8.

### 1.2 O CI estava quebrado antes da compilação

No workflow real (`.github/workflows/main.yml`), o passo “Regenerate shader + parameter sources” executa `tools/embed_panel.py`. Esse script roda `tools/verify_release.py` sempre que existe um `release-manifest.json`. O manifesto vinha do ZIP 1.11 e listava:

- 85 arquivos do SDK FFGL (`ffgl-sdk/...`), incluindo `SDK-COMMIT.txt`, que não existe num clone do SDK;
- `.github/workflows/build.yml` (o workflow real se chama `main.yml`);
- 7 arquivos que não existem: `tests/test_take.py`, `tests/test_scene_render.py`, `third_party/glew/glew.c`, `tools/generate_thumbnails.py`, `tools/catalog_preview.py`, `web/engine-thumbs.json` e o `build.yml` citado acima;
- 22 fontes com hash de outra versão (`shader/*.glsl`, `src/BackgroundGen.*`, `src/PanelServer.*`, `tests/*`, `tools/*`, `web/*`).

Reproduzi a falha aqui: `python3 tools/embed_panel.py` → exit 1, *“Incomplete or modified release”*. No Windows a falha é a mesma. Assim, **o workflow não chegava ao passo de CMake**.

> Não consegui confirmar isso no GitHub Actions: o repositório é privado e a API pública responde 404. A conclusão vem da reprodução local do mesmo script.

### 1.3 Referências quebradas em alvos ativos

| Referência | Onde | Ativa no CI? | Tratamento |
|---|---|---|---|
| `tests/test_take.py` | `CMakeLists.txt` (`add_test take_http`) | **Sim** (`ctest`) | Teste removido (ver §2.3) |
| `third_party/glew/glew.c` | `CMakeLists.txt`, bloco `if(MINGW)` | Não (só `build_mingw.sh`) | Erro claro no configure (ver §2.4) |
| `tests/test_scene_render.py`, `tools/generate_thumbnails.py`, `tools/catalog_preview.py`, `web/engine-thumbs.json` | só no manifesto antigo | Não | Saíram do manifesto regenerado |

---

## 2. Correções

### 2.1 Versão unificada em 1.8.1

| Declaração | Antes | Depois | Como |
|---|---|---|---|
| `VERSION` | 1.11.0 | **1.8.1** | editado |
| `CMakeLists.txt` `project(... VERSION)` | 1.11.0 | **1.8.1** | editado |
| `src/PanelPage.h` `PanelRevision` (`/api/info`) | 1.8.0 | **1.8.1** | gerado por `embed_panel.py` |
| Título, cabeçalho, rodapé, aviso de DLL antiga e `previewDiagnostics` do painel | 1.8.0 | **1.8.1** | gerados a partir de `{{REVISION}}` |
| `web/panel.html` | 1.8.0 | **1.8.1** | gerado |
| FFGL `PluginInfo` (`src/BackgroundGen.cpp`) | 1 / 8 | **1 / 8 (sem mudança)** | a estrutura FFGL só guarda major/minor |

Para confirmar que só o número mudou:
- antes de qualquer edição, rodei os geradores numa cópia limpa do HEAD com `VERSION=1.8.0`. Os 5 arquivos gerados (`PanelPage.h`, `panel.html`, `PanelSchema.h`, `ShaderSource.h`, `ParamsGenerated.inc`) saíram **idênticos byte a byte** aos commitados. Ou seja, a geração é reprodutível;
- depois da mudança, o diff dos arquivos gerados tem 7 linhas em `src/PanelPage.h` e 6 em `web/panel.html`, todas de versão. `ShaderSource.h`, `ParamsGenerated.inc` e `PanelSchema.h` não mudaram.

### 2.2 Manifesto regenerado e validação reforçada

`tools/verify_release.py` (o mesmo arquivo, sem ser desativado):

- **Inventário determinístico** das fontes canônicas: `.github/workflows/main.yml`, `CMakeLists.txt`, `VERSION`, `build_windows.bat`, `build_mingw.sh`, `README.md`, `CHANGELOG.md`, `shader/*.glsl`, `src/*`, `tests/*`, `tools/*.py`, `tools/*.cpp` e `web/*`.
- **Excluídos do inventário**: os 5 arquivos gerados (o build os reescreve) e `ffgl-sdk/` (baixado no commit fixado `5b6e078…`).
- **`--write`**: gera o manifesto com chaves ordenadas, LF e hash SHA-256 normalizando CRLF. Duas execuções seguidas produzem bytes idênticos.
- **Verificação (padrão)**, mais rígida que antes. Falha se:
  1. um arquivo listado sumiu ou teve o conteúdo alterado (comportamento original);
  2. **novo:** existe uma fonte canônica que não está no manifesto, por exemplo um arquivo de outro release misturado no upload;
  3. **novo:** o manifesto lista arquivos gerados ou do SDK.
- Continua sendo executado por `tools/embed_panel.py` (local, `build_windows.bat` e CI).
- Novo passo explícito no workflow, **“Verify release manifest (no mixed source versions)”**, antes da geração.

Manifesto resultante: **39 arquivos**, nenhum placeholder, nenhuma entrada inexistente.

### 2.3 Teste `take_http` removido

O `tests/test_take.py` não existe, e o servidor (`src/PanelServer.cpp`) não tem endpoint de TAKE nem de PVW. Os endpoints existentes são `/`, `/api/pair`, `/api/pair/start`, `/api/preview*`, `/api/info`, `/api/speed`, `/api/params` e `/api/state`. Recriar esse teste exigiria implementar uma função nova, o que está fora do escopo desta fase, ou escrever um teste de fachada, o que foi proibido. Por isso a referência saiu do `CMakeLists.txt`. O protocolo HTTP real continua coberto pelo `panel_http` (`tests/test_panel.py`) e pelo `tests/test_frontend.mjs`.

### 2.4 MinGW: falha clara em vez de erro de compilação obscuro

O SDK oficial só traz `glew32s.lib` para MSVC. O build MinGW (`build_mingw.sh`, experimental, fora do CI) precisa do `third_party/glew/glew.c` (GLEW 2.1.0), que não está no repositório. Agora o CMake para no configure com uma mensagem que explica a falta e indica o build MSVC. Não adicionei o GLEW (cerca de 20 mil linhas de código de terceiros) sem decisão do responsável.

### 2.5 Novo teste: `tests/test_release_manifest.py`

Registrado no CTest como `release_manifest`. Ele roda numa cópia temporária do repositório e verifica:
- o manifesto atual passa;
- `--write` é determinístico;
- SDK e arquivos gerados não aparecem no inventário;
- um checkout com CRLF (Windows) passa;
- a validação falha, citando o arquivo, quando uma fonte é editada, quando aparece um arquivo estranho em `tests/` ou quando uma fonte (`shader/90_main.glsl`) é removida;
- `--write` falha sem `VERSION` e não sobrescreve o manifesto.

### 2.6 Documentação

- `README.md`: reescrito para a 1.8.1. Explica que o repositório não contém DLL (ela é o artifact `BackgroundGen-win64`), separa o pacote 1.11.0 do código atual, lista as fontes canônicas e mostra o fluxo de regeneração.
- `CHANGELOG.md`: nova entrada v1.8.1 e nota na v1.11.0 dizendo que ela não foi incorporada ao código.
- `LEIA-ME-v1.11.0.txt` e `CATEGORIAS.md`: aviso no topo. O conteúdo original foi mantido.
- `AGENTS.md`: o fluxo de entrega agora inclui `verify_release.py --write` e o uso exclusivo das fontes canônicas.

---

## 3. Fontes canônicas e duplicatas na raiz (nada foi apagado)

O build usa **somente** `src/` (`CMakeLists.txt`), `shader/` (`tools/gen_shader.py`), `web/` e `tools/` (`tools/embed_panel.py`), `tests/` (CTest e Node) e `.github/workflows/main.yml`.

Arquivos da raiz com o mesmo nome (comparados por SHA-256):

| Raiz | Canônico | Situação |
|---|---|---|
| `00_common.glsl` | `shader/00_common.glsl` | idêntico |
| `10_engines.glsl` | `shader/10_engines.glsl` | **diferente** (339 × 138 linhas) |
| `90_main.glsl` | `shader/90_main.glsl` | **diferente** (69 × 90) |
| `BackgroundGen.cpp` | `src/BackgroundGen.cpp` | **diferente** (134 × 140) |
| `BackgroundGen.h` | `src/BackgroundGen.h` | idêntico |
| `EngineFade.h` | `src/EngineFade.h` | **diferente** (26 × 27) |
| `PanelPage.h` | `src/PanelPage.h` | **diferente** (315 × 3026) |
| `PanelSchema.h` | `src/PanelSchema.h` | **diferente** (43 × 29) |
| `PanelServer.cpp` / `PanelServer.h` | `src/` | idênticos |
| `ParamsGenerated.inc` | `src/ParamsGenerated.inc` | **diferente** (53 × 25) |
| `ShaderSource.h` | `src/ShaderSource.h` | **diferente** (687 × 502) |
| `Thumbnail.h` | `src/Thumbnail.h` | idêntico |
| `check_dll.py`, `preview.py`, `sweep.py`, `test_framework.cpp` | `tools/` | idênticos |
| `embed_panel.py` | `tools/embed_panel.py` | **diferente** (43 × 48) |
| `gen_shader.py` | `tools/gen_shader.py` | **diferente** (266 × 258) |
| `web_shader_parts.py` | `tools/web_shader_parts.py` | **diferente** |
| `panel.html` | `web/panel.html` | **diferente** (291 × 2984) |
| `panel.template.html` | `web/panel.template.html` | **diferente** (155 × 552) |
| `preview.js` | `web/preview.js` | **diferente** (136 × 135) |
| `panel_harness.cpp`, `test_fade.cpp` | `tests/` | idênticos |
| `test_fade_render.py`, `test_frontend.mjs`, `test_panel.py`, `test_preview_lifecycle.mjs`, `test_shader_es.py`, `test_web_shader_render.py` | `tests/` | **diferentes** |
| `engines.png`, `palettes.png`, `shapes.png`, `souz-thumbnail.png` | `docs/` | idênticos |
| `build.yml` | `.github/workflows/main.yml` | **diferente** (não tem os passos de Node e de manifesto) |

Recomendação para a Fase 2, que depende de aprovação: mover as duplicatas para `legacy/` ou apagá-las. Mudanças nesses arquivos **não** afetam a DLL.

---

## 4. Preservação (verificado)

- **32 engines**: `shader/10_engines.glsl` não mudou. `ShaderSource.h` regenerado sem diferença. `test_shader_es.py` compila as 32.
- **Parâmetros e índices**: `ParamsGenerated.inc` e `PanelSchema.h` regenerados sem diferença (19 canais, `OpenPanel` na mesma posição).
- **Identidade FFGL**: `src/BackgroundGen.cpp` não mudou (`ABGE`, `Souz Content-BG`, 2.1, 1.8, FF_SOURCE).
- **Painel**: só o número de versão mudou no HTML gerado. `test_frontend.mjs` e `test_preview_lifecycle.mjs` passam.
- **Renderização**: nenhum `.glsl` nem C++ de render foi alterado.

---

## 5. Testes executados no ambiente Emergent

Ambiente: Linux Debian 12, gcc 12.2, Python 3.11, Node 22, Mesa llvmpipe (sem GPU). O CMake 4.x foi instalado só no ambiente de teste (`pip install cmake`), não no projeto. O SDK FFGL foi clonado no commit fixado, fora do repositório (`/tmp/ffgl-sdk`).

| Comando | Resultado |
|---|---|
| `python3 tools/verify_release.py` (manifesto antigo, antes da correção) | FALHA esperada, exit 1 (reproduz a quebra do CI) |
| `python3 tools/verify_release.py --write` e depois `python3 tools/verify_release.py` | PASS, 39 arquivos |
| `python3 tools/gen_shader.py` | PASS: engines=32, shapes=14, palettes=9 |
| `python3 tools/embed_panel.py` | PASS: manifesto verificado, 19 canais, 33 blocos HTML |
| Reprodutibilidade (cópia do HEAD, `VERSION=1.8.0`) | PASS: 5/5 arquivos gerados idênticos |
| `cmake -S . -B /tmp/build-linux -DFFGL_ROOT=/tmp/ffgl-sdk` | PASS (configure) |
| `cmake --build /tmp/build-linux --target test_fade panel_harness` | PASS |
| `ctest --test-dir /tmp/build-linux --output-on-failure` | **PASS 3/3**: `engine_fade`, `panel_http` (6,2 s), `release_manifest` (1,8 s) |
| `node tests/test_frontend.mjs /tmp/build-linux/panel_harness` | PASS |
| `node tests/test_preview_lifecycle.mjs` | PASS |
| `GET /api/info` no `panel_harness` | `"revision":"1.8.1"`; título `Souz Content-BG · v1.8.1` |
| `python3 tests/test_shader_es.py` | PASS: 32 shaders GLSL ES compilam |
| `python3 tests/test_color_grade.py` | **NÃO CONCLUÍDO**: mais de 10 min sem terminar o 1º render (ver abaixo) |
| `python3 tests/test_fade_render.py` | **NÃO CONCLUÍDO** (mesmo motivo) |
| `python3 tests/test_web_shader_render.py` | **NÃO CONCLUÍDO** (mesmo motivo) |
| `python3 tests/test_engine_catalog.py` (regrava `validation/V14-engine-overview.jpg`, por isso foi rodado numa cópia) | **NÃO CONCLUÍDO** (mesmo motivo) |

**Por que os 4 testes de render não terminaram:** o container tem cota de **1 CPU** (`cpu.max = 100000/100000`), e o llvmpipe compila o shader desktop completo (32 engines × 3 amostras + fade) em CPU. Rodando sozinho, o `test_color_grade.py` passou de 10 minutos sem concluir o primeiro render de 40×24. Não é uma falha de asserção, mas também **não é um PASS**.

Em compensação, comprovei que as entradas desses testes **não mudaram** nesta fase:
- `tools/out/full_shader.frag` gerado no HEAD e na versão final são idênticos (24.043 bytes);
- o `PREVIEW_PARTS` e o `SCHEMA` embutidos em `web/panel.html` são idênticos;
- `shader/`, `tools/gen_shader.py`, `tools/preview.py`, `tools/web_shader_parts.py` e o código dos 4 testes não têm diff contra o HEAD.

Esses testes também não fazem parte do `ctest` nem do workflow. Recomendo rodá-los numa máquina com vários núcleos: `python tools/gen_shader.py`, depois cada `python tests/<teste>.py`.

**Não executado:** a compilação da `BackgroundGen.dll` (alvo Windows/MSVC) e `tools/check_dll.py`. **Não afirmo que o build Windows funciona.** Isso só será confirmado quando o GitHub Actions terminar com sucesso.

---

## 6. Bloqueios restantes

1. **Build Windows não confirmado.** É preciso rodar o workflow `main.yml` (push numa branch ou `workflow_dispatch`) e verificar o artifact `BackgroundGen-win64` e o passo `check_dll.py`. Precisa da sua aprovação para enviar as mudanças.
2. **Build MinGW** continua indisponível até alguém decidir incluir o GLEW 2.1.0 em `third_party/glew/`.
3. **Validação no Resolume Arena** (Windows real): carregar a fonte, conferir a identidade ABGE, o botão Abrir painel, o pareamento e as 32 engines.
4. **Pacote 1.11.0** (105 engines, PGM/PVW/TAKE, fade configurável, PositionX/Y): o código não está no repositório. É preciso obter as fontes originais ou reimplementar em fases futuras.
5. **Duplicatas na raiz**: estão documentadas e serão limpas na Fase 2, com aprovação.
6. **Testes de render (Mesa)** não concluíram aqui por causa da cota de 1 CPU. Rode-os numa máquina com vários núcleos.
7. **Regra operacional nova:** depois de editar uma fonte canônica, rode `python tools/verify_release.py --write`. Sem isso, o `embed_panel.py` e o CI falham, e é isso que impede uma release misturada.

---

## 7. Mensagem de commit proposta

```
build: stabilize v1.8.1 build and release manifest

- Set VERSION/CMake to 1.8.1: the v1.11.0 commit changed no plugin,
  shader or panel sources, so the DLL is the 1.8 line (32 engines).
- Regenerate release-manifest.json from canonical sources (39 files);
  exclude generated files and the downloaded FFGL SDK.
- verify_release.py: deterministic --write mode; also reject unlisted
  canonical files and SDK/generated entries. Keep it in embed_panel.py
  and add an explicit CI step.
- CMake: drop take_http (tests/test_take.py never existed; no TAKE
  endpoint in PanelServer); add release_manifest test; fail clearly
  when third_party/glew/glew.c is missing for MinGW.
- Regenerate PanelPage.h/panel.html (version strings only).
- Docs: README for 1.8.1, CHANGELOG entry, notes on 1.11.0 docs.

No rendering, engine, parameter-index, ABGE identity or panel behavior
changes. Windows DLL build pending GitHub Actions confirmation.
```
