SOUZ CONTENT BG-STUDIO — v1.17

Plugin FFGL SOURCE para Resolume Arena (Windows x64), identidade ABGE / "Souz Content-BG".
97 engines procedurais em GLSL, todas em preto e branco (a cor vem da paleta/tint), 28 parâmetros,
painel web embutido na DLL com PGM/PVW, TAKE com fade de 0,1 a 10 s, 60 paletas e miniaturas reais.

DLL
- Download direto da última versão: https://github.com/oSouz/Souz-BG-Studio/releases/latest/download/BG-STUDIO-SOUZ.dll
  (o CI publica um Release a cada versão nova na main).
- A DLL é gerada pelo GitHub Actions (.github/workflows/main.yml) como artifact "BG-STUDIO-SOUZ-win64".
- Build local no Windows: build_windows.bat (Visual Studio 2022, CMake, Git e Python 3).
- Build cruzado (Linux/WSL/macOS): build_mingw.sh (MinGW-w64, CMake, Git e Python 3).

Instalação
1. Feche o Resolume.
2. Faça backup da DLL anterior.
3. Copie BG-STUDIO-SOUZ.dll para a pasta de plugins FFGL do Resolume. Apague a BackgroundGen.dll antiga, se existir:
   as duas têm a mesma identidade ABGE e não podem ficar juntas.
4. Abra o Resolume, carregue Souz Content-BG como Source e clique em Abrir painel.

Uso do painel
- Layout: prévia à esquerda; à direita, o inspetor com as abas Essenciais, Gerador, Parâmetros e Cores.
  Cada slider tem um campo para digitar o valor exato.
- PGM · Ao vivo: cada ajuste vai direto para o LED.
- PVW · Preview: rascunho isolado; nada vai ao LED até clicar em "Enviar PVW ao vivo".
- TAKE: envia a cena completa do PVW (engine, cores, posição, velocidade e relógio) com o fade escolhido.
  Durante a transição o PGM fica bloqueado; a DLL desenha as duas cenas e libera ao terminar.
- Trocar só a engine no PGM faz um fade fixo de 0,6 s.
- Todas as engines saem em preto e branco; paleta ou tint (Black To / White To) dão a cor.
- Aba 02: Posição X/Y, forma (Scale, Rotation, Density, Twist, Ripple, Stretch, Mirror) e acabamento
  (Smoothness, Blur, Vignette, Grain, Posterize); cada parâmetro tem reset.
- Prévia: "Preencher" ocupa o quadro todo; "Proporção do LED" mostra o enquadramento exato da saída (botão no rodapé da prévia).
- Tamanho: a interface escala sozinha em monitores grandes (Auto); A− / A+ na barra superior ajustam à mão.
- Aba Salvos: dê um nome e salve a cena atual (do PGM ou do PVW, conforme o banco aberto) para reusar depois.
  Carregar no PVW coloca a cena no rascunho; nada vai ao LED até o TAKE. Mesmo nome substitui a cena salva;
  excluir pede confirmação. A lista (até 100) fica num arquivo da DLL, igual no computador e no tablet:
  %APPDATA%\Souz\BG-Studio\backgrounds.txt. Exportar/Importar arquivo (.json) serve de backup e para levar
  os backgrounds a outra máquina.
- Prévia local sem Resolume: abra web/panel.html no navegador (modo demonstração, não controla o LED).
- Tablet: docs/REDE_TABLET.md.

Compatibilidade
- Ids das engines e índices dos parâmetros nunca mudam: PositionX/PositionY foram acrescentados no fim,
  então composições salvas com versões anteriores continuam abrindo iguais.
- A estrutura FFGL só guarda major/minor; a DLL informa major.minor do VERSION (ex.: 1.15).

Estrutura
- src/      C++ do plugin (BackgroundGen, servidor HTTP do painel, TAKE) e arquivos gerados.
- shader/   GLSL: 00_common (helpers), 10_engines (as 105 engines), 90_main (dispatch e grade).
- web/      painel (panel.template.html, preview.js), engine-catalog.json (ids, nomes, categorias),
            engine-thumbs.json (miniaturas), qrcode.js. web/panel.html é gerado.
- tools/    geradores (gen_shader.py, embed_panel.py), preview headless, verificação de release.
- Miniatura no Resolume: edite docs/souz-thumbnail.png (160 × 120) e rode python3 tools/gen_plugin_thumb.py.
- tests/    testes C++, Python e Node (veja docs/VALIDACAO.md).
- third_party/glew/  GLEW 2.1.0 (glew.c) para o build MinGW.
- docs/     catálogo visual (CATALOGO.html), categorias, rede/tablet, validação, relatórios e
            docs/historico/ (notas das versões anteriores).

Versões e geração
- VERSION é a referência: CMake, painel (/api/info, título e rodapé) e manifesto usam esse valor.
- Depois de editar fontes: python3 tools/verify_release.py --write e python3 tools/embed_panel.py.
- Engines novas: acrescente a função eng_vNN em shader/10_engines.glsl e a entrada no fim de
  web/engine-catalog.json, depois rode tools/gen_thumbs.py. Nunca reordene nem reutilize ids
  (engine removida: "removed_alias" no catálogo aponta a engine que ela passa a desenhar).
