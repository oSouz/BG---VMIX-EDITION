# v1.17.1 — Título do About menor

- Na janela About, o título "BG Studio" ficou 50% menor (30 px → 15 px).

# v1.17.0 — Marca SOUZ | BG Studio e janela About

- Barra superior com o logo "souz" (imagem oficial; versão escura no tema claro e branca no tema escuro) seguido de | BG Studio. A assinatura "by Souz Content" saiu da barra e foi para o About.
- Clique no logo "souz" abre o About: logo, BG Studio, versão e "A product by Souz Content". Fecha com ✕, Esc ou clique fora.
- Logos em web/souz-logo-dark.png e web/souz-logo-light.png, embutidos no painel por tools/embed_panel.py.
- Nenhuma mudança em engines, parâmetros, DLL ou identidade ABGE.

# v1.16.0 — Versão do plugin informada ao Resolume acompanha o VERSION

- A DLL informava ao Resolume a versão 1.12 desde a v1.12.0. Agora informa major.minor do arquivo VERSION (1.16), definido pelo CMake. Com isso o Resolume enxerga que o plugin mudou e pode atualizar as informações guardadas dele, como a miniatura "souz" da v1.15.3.
- Só o número de versão do plugin mudou: identidade ABGE, nome, engines e parâmetros iguais; composições salvas continuam abrindo.

# v1.15.3 — Miniatura "souz" no Resolume

- A miniatura do plugin no Resolume (navegador de Sources e quadrado do clip) passa a mostrar o escrito "souz" em branco sobre o fundo escuro, no lugar do ícone "S".
- Nova ferramenta tools/gen_plugin_thumb.py: converte docs/souz-thumbnail.png (160 × 120) em src/Thumbnail.h. Para trocar a miniatura, edite o PNG e rode a ferramenta.
- Identidade ABGE, nome, engines e parâmetros inalterados.

# v1.15.2 — DLL renomeada para BG-STUDIO-SOUZ.dll

- Trazida da branch feat/dll-bg-studio-souz (v1.13.1): o arquivo da DLL passa a se chamar BG-STUDIO-SOUZ.dll (build local, MinGW, artifact do CI e Release). Novo link fixo: https://github.com/oSouz/Souz-BG-Studio/releases/latest/download/BG-STUDIO-SOUZ.dll
- Só o nome do arquivo mudou: identidade ABGE, nome no Resolume (Souz Content-BG), engines e parâmetros iguais. Ao instalar, apague a BackgroundGen.dll antiga para não ficar com duas cópias do mesmo plugin.
- Os backgrounds salvos (%APPDATA%\Souz\BG-Studio\backgrounds.txt) não dependem do nome da DLL e continuam disponíveis.

# v1.15.1 — Prévia do shader ocupa o quadro inteiro

- O quadro da prévia agora usa toda a largura da área de preview (16:9 enquanto cabe; mais baixo quando a janela é baixa). Antes, em telas largas, ele ficava encolhido à esquerda.
- Novo modo **Preencher** (padrão): o shader é desenhado no formato do próprio quadro, então a imagem cobre o quadro todo, sem faixas pretas, mesmo com LED ultrawide.
- Botão no rodapé da prévia alterna para **Proporção do LED** (enquadramento exato da saída, com faixas). A escolha fica guardada no navegador.
- Resolução da prévia acompanha o tamanho do quadro com orçamento fixo de pixels (~480 × 270, até 15 FPS); o rodapé mostra a resolução real. Nenhuma mudança em engines, parâmetros, DLL ou identidade ABGE.

# v1.15.0 — Interface que se adapta ao monitor, miniaturas maiores e assinatura

- Escala automática da interface: em monitores grandes tudo cresce junto (textos, botões, miniaturas, prévia), sem mudar o layout. Automático = largura/1440 ou altura/880, o menor (ex.: 34" 3440×1440 → 160%; 1920×1080 → 120%); telas menores ficam em 100%.
- Controle A− / Auto / A+ na barra superior para ajuste manual (fica guardado no navegador); clicar no valor volta ao automático.
- O layout ocupa a largura toda (sem o limite de 1600 px); o inspetor fica com 460 px a partir de 1500 px de largura.
- Miniaturas dos geradores maiores: duas por linha no inspetor (antes quatro). Miniaturas da aba Salvos também maiores.
- Assinatura "by Souz Content" ao lado de BG Studio e "A Souz Content product" no rodapé.
- Seletores de cor e demais controles conferidos com a escala (Chromium, 100–160%). Nenhuma mudança em engines, parâmetros, DLL ou identidade ABGE.

# v1.14.0 — Aba Salvos: guardar e reusar backgrounds

- Nova aba **Salvos** no inspetor: dá nome à cena atual e salva (botão "Salvar PGM" ou "Salvar PVW", conforme o banco aberto). Guarda a cena completa: engine, paleta/tint, posição, forma, acabamento e velocidade.
- Cada background salvo aparece com a miniatura da engine já com as cores da paleta, o nome da engine e da paleta. "Carregar no PVW" coloca a cena no rascunho: nada vai ao LED até clicar em Enviar PVW ao vivo. Funciona inclusive durante uma transição.
- Salvar com um nome que já existe atualiza aquele background. Excluir pede confirmação (segundo clique).
- A lista fica na DLL, num arquivo em %APPDATA%\Souz\BG-Studio\backgrounds.txt: é a mesma no computador e no tablet, para todas as instâncias do plugin, e continua lá depois de fechar o Resolume. Gravação segura (arquivo temporário + troca), limite de 100 backgrounds.
- Exportar arquivo (.json) e Importar arquivo: backup e transporte entre máquinas. Parâmetros desconhecidos são ignorados e os ausentes usam o padrão, então arquivos de versões futuras ou antigas continuam abrindo.
- DLL: novas rotas autenticadas `GET /api/presets`, `POST /api/presets` (nome + todos os parâmetros, validação estrita como no TAKE) e `POST /api/presets/delete`. Nenhuma engine ou índice de parâmetro mudou; identidade ABGE preservada.
- Testes: tests/test_panel.py (corpo estrito, nomes UTF-8, substituição, lista compartilhada entre instâncias, arquivo danificado/de outra versão, limite) e tests/test_frontend.mjs (salvar, carregar só no PVW, confirmação de exclusão, importação). Os testes usam um arquivo temporário (SOUZ_PRESETS_FILE).

# v1.13.0 — Novo layout do painel (guia de interface Souz)

- Painel no padrão do guia Souz Grid Panel: barra superior (marca, status, Conectar tablet, tema), prévia à esquerda e inspetor fixo de 400 px à direita (350 px entre 781 e 1050 px). Abaixo de 780 px os controles ficam sob a prévia.
- Inspetor com abas acessíveis (Essenciais, Gerador, Parâmetros, Cores; setas, Home e End). Essenciais abre primeiro com Engine, Speed, Scale, Rotation, Brightness e Contrast, sincronizados com as outras abas.
- Cada slider ganhou um campo de valor exato em unidades legíveis (%, ×, graus); slider e campo escrevem o mesmo parâmetro.
- Selo Ao vivo / PVW e rodapé com o alcance da alteração (PGM no LED ou rascunho PVW).
- Cores do guia: fundo #F5F5F7, superfícies #FDFDFE, texto #1D1D1F/#6E6E73, azul #0071E3, divisórias #E6E6EB, interruptor #34C759; tema escuro mantido.
- Desfeito o commit "bg studio - v1.11.0" enviado direto na main, que voltava arquivos antigos e quebrava o CI. Nenhuma mudança em engines, parâmetros, DLL ou identidade ABGE.

# v1.12.1 — Paletas em pastas, pesquisa e rolagem do painel

- Corrigido: a coluna de controles não rolava (regra antiga com overflow oculto); agora rola com mouse, trackpad e toque.
- Paletas organizadas em pastas por família de cor (recolhíveis, com faixa dos tons); a primeira começa aberta.
- Lupa discreta ao lado de Ajustes: pesquisa por nome da cor (qualquer trecho, sem acento) ou pelo início da família; Esc limpa.

# v1.12.0 — Padrão preto e branco, novos parâmetros, paletas e Release automático

- Todas as engines em preto e branco (mesmo padrão): a cor vem só da paleta/tint. Composições antigas com engines 32+ e tint neutro passam a sair em preto e branco.
- 8 engines removidas por serem repetidas (mesma forma, só mudava a cor): 41 Candy Flow, 68 Prismatic Haze, 72 Midnight Ripples, 80 Cobalt Flow, 84 Chromatic Veil, 86 Blue Horizon, 100 Solar Pleats, 102 Violet Vapor. Os ids continuam válidos e desenham a engine equivalente (37, 55, 59, 70, 58, 32, 52, 73), então composições salvas não quebram. 97 engines visíveis.
- Novos parâmetros (no fim; padrão neutro = imagem idêntica): Twist, Ripple, Stretch, Mirror (Off, Mirror X, Mirror Y, Mirror XY, Kaleido), Vignette, Grain e Posterize. 28 parâmetros.
- Aba 02: Posição X e Y lado a lado no topo, Warp e Reverse embaixo, botão de reset em cada parâmetro.
- Cores: 60 paletas em 10 famílias (Neutros, Azuis, Cianos, Verdes, Roxos, Rosas, Vermelhos, Laranjas, Dourados, Terrosos), 6 tons cada.
- Miniaturas e docs/CATALOGO.html regenerados a partir do shader (tools/gen_thumbs.py).
- Release automático: a cada versão nova na main, o CI publica a DLL. Link fixo: https://github.com/oSouz/Souz-BG-Studio/releases/latest/download/BackgroundGen.dll
- Painel: corrigida a sobreposição dos títulos das seções quando a aba aberta é longa.

# v1.11.1 — 1.11.0 restaurada e repositório organizado

O código da 1.11.0 nunca tinha sido enviado ao GitHub (só a documentação), por isso a DLL gerada pelo CI era a 1.8. Esta versão restaura a 1.11 no código.

- 105 engines (32 clássicas + 73 da Reference Collection, 7 categorias), recuperadas do painel da 1.11.0, que trazia o shader completo. O shader FFGL reconstruído bate com o original em todas as engines (≤ 2/255).
- PositionX/PositionY acrescentados no fim dos parâmetros (21 no total): índices salvos e identidade ABGE preservados.
- Engines 32+ mantêm as cores originais com tint neutro; paleta ou tint personalizado aplica a luminância.
- Painel 1.11 restaurado sem alterações: PGM/PVW, TAKE com fade 0,1–10 s, galeria por categoria com 105 miniaturas reais.
- DLL (reimplementado, não estava no pacote recuperado): `/api/take` com validação estrita da cena completa, estado `scene` em `/api/state`, 409 durante a transição e desbloqueio automático se o clip parar. O fade desenha as duas cenas em duas passadas (cores, posição, escala e relógios independentes); a troca de engine no PGM usa o mesmo mecanismo (0,6 s).
- Dispatch das engines em grupos de 16: um `switch` único com ~74+ casos é compilado errado pelo Mesa.
- Build MinGW funcionando: GLEW 2.1.0 em third_party/glew; build_mingw.sh baixa o SDK fixado.
- Testes atualizados para 105 engines/21 parâmetros/TAKE, e novo tests/test_plugin_render.py (classe real do plugin num host FFGL mínimo, TAKE e troca de engine comparados quadro a quadro).
- Repositório organizado: removidas as cópias antigas da raiz; documentação em docs/ (versões antigas em docs/historico/); catálogo em web/engine-catalog.json.

# v1.8.3 — Correção do CI Windows (parte 2)

- tests/test_release_manifest.py: o passo "CRLF checkout must verify" falhava no Windows porque o arquivo copiado já estava em CRLF e a conversão gerava \r\r\n. Agora normaliza para LF antes de converter para CRLF.
- Validado simulando um checkout Windows completo (todas as fontes em CRLF, manifesto em LF e em CRLF).
- Sem mudança de renderização, engines, parâmetros, identidade ABGE ou painel; só o número da versão exibido mudou.

# v1.8.2 — Correção do CI Windows

- Corrigido o teste release_manifest no Windows ("manifest generation is not deterministic"): o checkout convertia release-manifest.json para CRLF, enquanto verify_release.py --write sempre grava LF e o teste comparava bytes crus.
- Adicionado .gitattributes fixando release-manifest.json e VERSION em LF.
- tests/test_release_manifest.py: compara ignorando apenas a conversão CRLF do arquivo commitado, exige saída LF, geração repetível e manifesto regenerado verificável. As demais proteções (arquivo alterado, ausente ou estranho) continuam intactas.
- Sem mudança de renderização, engines, parâmetros, identidade ABGE ou painel; só o número da versão exibido mudou.

# v1.8.1 — Estabilização do build

- Versão corrigida: o código deste repositório é a linha 1.8 (32 engines). O VERSION 1.11.0 tinha sido aplicado sem as fontes do pacote 1.11.
- release-manifest.json regenerado a partir das fontes canônicas, sem o SDK FFGL (baixado no build) e sem arquivos gerados.
- tools/verify_release.py: ganhou o modo --write (geração determinística) e agora também recusa arquivos de outro release.
- GitHub Actions: passo explícito de validação do manifesto antes da geração.
- CMake: removido o teste take_http, que apontava para tests/test_take.py (o arquivo não existe e o servidor não tem endpoint de TAKE); adicionado o teste release_manifest.
- CMake/MinGW: mensagem de erro clara quando third_party/glew/glew.c não existe.
- Sem mudança de renderização, engines, parâmetros, identidade ABGE ou painel; só o número da versão exibido mudou.

# v1.11.0 — Reference Collection

> Nota: até a v1.8.3 este pacote não estava no código do repositório. A v1.11.1 o restaurou (veja acima).

- 73 new procedural backgrounds; 105 engines total; original IDs 0–31 retained.
- Seven English categories. Native still thumbnails for every engine.
- Neutral black/white tint preserves the new engines' original colors; custom tint/palettes keep the existing luminance mapping.
- PGM/PVW, full-scene TAKE and all 21 parameter channels retained.
- Reference interpretations, not embedded image/video assets.

## 1.9.0 — Studio PGM/PVW

- Bancos separados: edição imediata no PGM, rascunho local isolado no PVW.
- TAKE com snapshot completo, fade 0,1–10 s executado na DLL e bloqueio de reentrada.
- Fade compõe imagens completas, com cores, posição e relógios independentes.
- 32 miniaturas reais, catálogo paginado e seções recolhíveis sem empilhar ajustes.
- Cores organizadas em Paletas, Personalizar e Ajustes; controles existentes preservados.
- PositionX/PositionY acrescentados ao final dos parâmetros, preservando ABGE e índices.
- Build MinGW x64 estático, compatível com SDK oficial, sem dependência de runtime extra.
- Testes de isolamento, protocolo TAKE, renderização e lifecycle atualizados.

# v1.8.0

- Integra o painel fornecido, com temas claro/escuro e preferência persistente.
- Preserva as 32 engines, 16 paletas, Tint, pareamento QR e transições.
- Unifica versão do painel, API e diagnósticos; FFGL informa 1.8 (campos major/minor).

# V16 — Versão unificada

- Integra integralmente o catálogo de 32 engines da V14-Engines.
- Inclui as 16 paletas da V14-Paletas e as abas Paletas/Personalizar da V15.
- Regenera shaders, schema e painel incorporado a partir das fontes unificadas.
- Mantém Tint, QR, pareamento, fade e identidade ABGE.
- Os slots substituídos na V14-Engines continuam com os novos visuais; confira composições antigas.

# V14 — catálogo autoral

32 engines: 12 preservadas e renomeadas, 12 substituídas e 8 adicionadas. Tint e identidade ABGE preservados. Slots substituídos passam a mostrar o novo visual em composições antigas; faça backup antes de trocar a DLL.


## V15 — Paletas integradas ao painel

- Abas Paletas / Personalizar compartilham a área Cores.
- Grade compacta 4 × 4, nome da paleta ativa e controles manuais preservados.
- Pulse compacto; altura de controles ajustada para desktop e toque.
- Base: V14-Paletas (engines da V13-Tint). Não inclui a variante V14-Engines.

## V14 — Paletas prontas

- 16 paletas de duas cores com miniaturas em gradiente e aplicação em um clique.
- Black To e White To enviados juntos; engine, movimento e ajustes de brilho preservados.
- Seleção acompanha ajustes locais e do host; cores manuais indicam Personalizada.
- Usa os parâmetros Tint existentes e mantém a identidade ABGE.

## V13 — Tint

- Black To e White To independentes; PICK, HSB, RGB, Palette e HEX.
- Mapeamento de luminância no shader nativo e preview, sem Opacity/Blend Mode.
- Mantidos ABGE, índices dos controles V12 e Abrir painel (13).

# Versão 12 — 2026-10-30

- Gerador: Engine em toda a primeira linha; Scale/Speed/Rotation na segunda, Density/Smoothness/Blur na terceira, Warp/Reverse lado a lado.
- Cores: Brightness/Contrast/Saturation na mesma linha, com reset individual e Padrão cores; Pulse agora é botão HTML com aria-pressed e rótulos exatos pulse on / pulse off, sincronizado com o host.
- Removidos do painel e dos parâmetros da DLL: Shape, Seed, ColorShift, Invert, Tint e Colorize, incluindo cores e presets. São 13 canais; forma interna fixa no perfil circular e seed interno zero, mantendo o aspecto dos motores com os padrões anteriores.
- Mantém os 24 motores, QR, fade e abertura leve. Mantém ABGE.
- Remoção/reordenação altera índices de parâmetros: usar instância nova; não há migração automática de composições V11.

# Versão 11 — 2026-10-30

- Substituição integral dos 14 motores antigos por 24 novos motores procedurais. Ver ENGINES_V11.md para correspondências, nomes e limitações visuais.
- Analisa imagens e prévias de movimento públicas do catálogo Sunday Screens. Recriação procedural independente; não inclui mídia de terceiros nem promete equivalência exata aos loops.
- Contagem de motores gerada em PanelSchema.h e usada pelo fade C++; validação WebGL usa o schema, evitando limitar os novos motores a 14.
- Mantém os 31 canais e ordem de parâmetros da V10, Tint/Colorize, resets, Warp/Seed/Pulse bool, QR e inicialização sem WebGL. Mantém ABGE.
- Amostragem de difusão para Blur, remapeamento de suavidade e deformação global de Warp. As formas afetam os motores radiais, não todos os motores de maneira idêntica.
- Preserva até dois motores por fade e no máximo dois programas WebGL. Novos testes verificam os 24 índices, animação e diferença entre imagens.
- O índice Engine agora representa outro visual. Composições antigas precisam da seleção revisada; recomenda-se instância nova.

# Versão 10 — 2026-10-30

- Substitui Color1–4 por Tint Black To, Tint White To e Colorize Color. Tint faz remapeamento de luminância entre as duas cores; Colorize multiplica o resultado pela cor escolhida. Implementação própria compartilhada pelo FFGL e WebGL, sem invocar efeitos nativos do Resolume e sem promessa de identidade matemática com eles.
- Colorize Mode: Off / Color / Palette. Sem opacidade, Weighted ou Keep Greys; Contrast e Invert permanecem somente globais. Palette só aparece como ColorizePalette, com nove presets de cor única: Fire, Ember, Gold, Ocean, Electric Blue, Ultraviolet, Rose, Mono, Desert. Removidas variações redundantes e presets verdes.
- Warp/Seed/Pulse são bool no host, HTTP e painel. Warp usa intensidade 0.4 ao ligar; Seed usa variação determinística 4317, desligado zero; Pulse aplica a pulsação existente.
- Brightness, Contrast, Saturation e ColorShift exibem desvio do padrão em escala -100..0..+100; botão de reset individual e Padrão cores. ColorShift agora tem padrão interno 0.5 (neutro), mantendo zero no centro visual. Demais ranges mantêm seus domínios próprios.
- Mudança de esquema para 31 canais: parâmetros antigos não são migrados. Usar instância nova e conferir composições anteriores; preservado ID ABGE conforme AGENTS.md.
- Preserva QR, abertura sem WebGL, fade e comunicação não bloqueante.

# Versão 09 — 2026-10-30

- QR code local (sem serviço externo) em Conectar tablet. Contém IPv4/porta escolhidos e código de seis dígitos de uso único, válido por cinco minutos. A câmera abre o painel e preenche o código; o usuário toca em Conectar. O token longo não aparece no QR.
- Mantém a abertura sem WebGL da V07/V08. A consulta de interfaces de rede agora acontece somente ao abrir Conectar tablet, não durante a inicialização dos controles. O código antigo encontrado no GitHub ainda compilava o shader completo na abertura; atualizar todo o pacote é necessário.
- Teste HTTP lê VERSION para evitar versão esperada fixa. Manifesto verifica arquivos-fonte antes de incorporar o painel, apontando uploads incompletos; comparação aceita CRLF no Windows.
- Preserva ABGE, parâmetros e fade. Windows/Resolume, leitura por câmera física e tempo real de abertura ainda precisam de validação no equipamento do usuário.

# Versão 08 — 2026-10-29

- Correção de fechamento HTTP compatível com o WinError 10054 observado no teste Windows: após enviar a resposta, faz shutdown somente do envio e drena dados pendentes até EOF ou prazo absoluto de um segundo, sem armazenar o corpo rejeitado.
- Não remove nem flexibiliza a validação de entradas inválidas. Novo teste recebe o status 400 e depois envia o restante do corpo antes de encerrar, verificando que a resposta completa é preservada.
- Mantém o worker não bloqueante, limite de clientes, desligamento rápido e todos os recursos da V07.
- Revisão visível 08; testes locais de HTTP, UI e lifecycle passaram. Confirmação do reparo no Winsock/MSVC depende da próxima execução do GitHub Actions.

# Versão 07 — 2026-10-29

- Abertura sem criar contexto WebGL, compilar shaders ou iniciar animação. Botão Ativar preview inicia explicitamente; Desligar preview libera programas, shaders, VAO e contexto quando a extensão está disponível.
- Shader especializado por motor, derivado dos mesmos arquivos GLSL. No máximo dois programas alocados pelo painel, incluindo um em compilação; apenas uma compilação pendente. O fade do navegador mistura dois desenhos, sem executar um shader monolítico com todos os motores.
- KHR_parallel_shader_compile quando disponível, timeout de preparação e mensagens de falha. Sem recuperação automática/recompilação repetida após perda de contexto.
- Preview inicial até 320 × 180, 15 FPS; suspende ao ocultar a aba. Mantidos controles, nome, thumbnail, layout e fade da DLL.
- Pareamento por código de seis números: cinco minutos, uso único, até cinco tentativas por código; geração exige sessão autorizada. Credencial longa mantida internamente na sessão da aba. Endereço copiado não contém a chave. QR Code não incluído nesta entrega.
- Diagnóstico `souzPreviewDiagnostics()` sem credenciais.

A foto mostra aproximadamente 62 MB na linha da aba, não 1,9 GB. A causa exata do preview branco não foi reproduzida no Windows; o valor do processo de GPU não está na foto. Não há medição de RAM/FPS no equipamento do usuário.

# Versão 06 — 2026-10-28

- Fade de motores de 0,6 segundo, com curva suave, na DLL e no preview WebGL. Usa no máximo dois motores por quadro. Durante uma transição, o último motor escolhido aguarda a conclusão da atual.
- Estado do fade publicado atomicamente pela DLL e consultado pelo navegador. O preview conectado acompanha o estado do host com atraso de rede; não é saída de vídeo nem sincronismo quadro a quadro.
- Preview ocupa aproximadamente dois terços da largura no desktop; gerador em cima e cores embaixo à direita. Página sem rolagem; quatro abas de cor compartilham a área de controles HSV. Em telas estreitas, botões Preview/Controles alternam a área visível.
- Acesso na rede: link completo com porta e chave, cópia compatível com HTTP local, entrada manual de chave, diagnóstico por aparelho, reconexão e fallback de timeout via AbortController.
- Página principal aceita query string e tem até 15 segundos para transferência após receber a requisição, mantendo o limite curto para clientes com requisições incompletas.
- Preserva nome Souz Content-BG, ID ABGE, thumbnail e índices dos parâmetros. Versão 06 visível no painel.

Recompile a DLL. Ainda validar layout em navegador real, desempenho no Windows/Resolume e acesso pelo tablet na rede do usuário. A imagem de referência prometida ainda não foi recebida; o layout segue a descrição textual.

# Versão 05 — 2026-10-28

- Nome em Sources: Souz Content-BG (limite FFGL de 16 bytes).
- Thumbnail fixa com o S verde do cabeçalho, incorporada via CFFGLThumbnailInfo.
- Número da revisão no cabeçalho e rodapé; fonte única em VERSION.
- Preview WebGL e parâmetros preservados.

Recompilar e substituir BackgroundGen.dll com o Resolume fechado. Validar nome e thumbnail em Sources no Windows/Resolume; ainda não testado nesse host.
