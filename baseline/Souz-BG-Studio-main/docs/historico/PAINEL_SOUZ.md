# V12 — Painel reorganizado

Gerador e movimento:

1. Engine: largura completa.
2. Scale, Speed, Rotation.
3. Density, Smoothness, Blur.
4. Warp e Reverse lado a lado.

Cores: Brightness, Contrast e Saturation na mesma linha; Pulse é um botão separado, com pulse on e pulse off. Mantidos resets.

Shape, Seed, ColorShift, Invert, Tint e Colorize foram removidos do painel e da DLL. Os motores continuam com o aspecto neutro do padrão anterior, sem seleção de cor. A saturação continua disponível, embora sua atuação seja limitada nos motores monocromáticos.

Instalação: envie todo o conteúdo de BackgroundGen ao repositório original, aguarde Actions verde e substitua a DLL com o Resolume fechado. Crie instância nova e confirme Versão 12: os parâmetros foram reduzidos/reordenados e composições V11 não são migradas automaticamente.

--- Histórico ---

# V11 — Novo catálogo

Envie todo o conteúdo de BackgroundGen ao repositório original, aguarde a nova execução do Actions e instale a DLL com o Resolume fechado. Confirme Versão 11. Use instância nova ou revise o motor: os índices antigos agora apontam para outros visuais.

Todos os controles da V10 continuam, incluindo QR, cores simplificadas e reset. A imagem de referência dos novos motores está em validation/V11-engine-overview.jpg. Veja ENGINES_V11.md para a lista e as diferenças em relação às prévias externas. Nuvens e água são procedurais abstratas, não filmagens.

--- Histórico ---

# V10 — Cores simplificadas

Instale a nova DLL com o Resolume fechado. Crie uma instância nova: a substituição dos parâmetros de cor altera os índices e não migra configurações salvas da V09. Guarde a DLL anterior se precisar reabrir uma composição antiga.

Tint tem Black To e White To. O padrão é preto e branco. Colorize Mode Off preserva o Tint; Color aplica o seletor livre; Palette aplica um dos nove presets de cor única sem verde. Não há opacidade. Invert e Contrast ficam apenas no grupo geral.

Os seletores de cor usam a janela de cores do navegador. A interface não reproduz os submodos PICK/HSB/RGB do Resolume; o cálculo é próprio, dentro da DLL e do preview.

Botões Warp/Seed/Pulse: off = efeito desativado; on = intensidade definida. Seed on sempre retorna à mesma variação, off retorna ao seed original.

↺ 0 nos ajustes gerais restaura o padrão real. A leitura -20/0/+20 é um desvio do padrão, não o valor bruto normalizado transmitido ao plugin. Padrão cores restaura todos os parâmetros do grupo Cores. Os ajustes de movimento mantêm seus ranges anteriores.

Envie todo o conteúdo de BackgroundGen para o repositório original. Aguarde Actions verde, baixe o artefato dessa execução, instale e confira Versão 10.

--- Histórico ---

# V09: instalação e conexão

Extraia este ZIP em uma pasta nova. Envie TODO o conteúdo de BackgroundGen para a raiz do repositório, incluindo web, tools, src, tests, VERSION e release-manifest.json. Não misture com pastas extraídas de ZIPs anteriores. Após o novo Actions ficar verde, baixe a DLL dessa execução e substitua a antiga com o Resolume fechado. Confirme Versão 09 no painel.

Para conectar o tablet: no computador, clique em Conectar tablet, selecione o endereço da placa de rede usada e escaneie o QR com a câmera do tablet. O código estará preenchido; toque em Conectar. Ambos os aparelhos precisam estar na mesma rede e o firewall precisa permitir o Resolume na rede privada. QR não contorna bloqueios de rede. Para outro aparelho ou código expirado, clique em Gerar novo código.

O preview começa desligado. Os controles funcionam sem ativá-lo. Se a página demorar antes de aparecer qualquer interface, registre o tempo entre o clique no plugin e a abertura; se a demora ocorrer somente ao Ativar preview, registre esse tempo separadamente. A V09 não inclui uma medição no computador do usuário.

Para desenvolvimento: release-manifest.json fixa os fontes desta entrega. Após editar fontes, atualize seus hashes SHA-256 (normalizando CRLF para LF) no manifesto antes de executar embed_panel.py. Não altere o manifesto apenas para ocultar arquivos faltantes de um upload.

--- Histórico anterior ---

# Versão 08 — correção do teste HTTP no Windows

Substitua os arquivos do repositório pelo conteúdo desta pasta e execute novamente o workflow. A falha enviada ocorreu na etapa de testes, depois da compilação, durante uma requisição inválida. A correção está no encerramento de conexões do servidor, não no preview.

O teste não foi removido: a resposta HTTP 400 continua sendo exigida. Esta versão envia a resposta e permite a conclusão dos dados pendentes antes de fechar o socket, com prazo de um segundo no worker não bloqueante.

Confirme a execução completa do GitHub Actions antes de instalar a nova DLL. O painel deve mostrar Versão 08. Preview leve e pareamento por seis dígitos da V07 foram preservados.

---

# Versão 07 — teste de abertura e preview

Esta versão prioriza o travamento relatado. Recompile e substitua a DLL, mantendo uma cópia da anterior. O painel precisa mostrar Versão 07. O layout foi preservado.

## Primeiro teste

1. Abra `web/panel.html` no computador. Ele começa em modo local, **com preview desligado**.
2. Confirme que os controles respondem sem travar as demais abas. Ainda não há WebGL ativo.
3. Clique em **Ativar preview**. O modo inicial é leve: até 320 × 180, 15 FPS.
4. Se falhar, a área do preview mostra o motivo quando o navegador permite reportá-lo. Não existe um ciclo de tentativas automáticas.
5. Clique em **Desligar preview** para liberar recursos. Isso não pausa o plugin no Resolume.
6. Depois de recompilar a DLL, repita pelo botão **Abrir painel** no Resolume para testar parâmetros e sincronização.

Se o navegador inteiro travar mesmo antes de Ativar preview, informe isso: a V07 não cria um contexto WebGL nessa etapa. Se o processo gráfico do navegador for encerrado, ele pode não conseguir entregar uma mensagem de erro ao JavaScript.

## O que mudou no preview

- Um shader por motor, com somente o código daquele motor. Helpers, paletas e cálculos são derivados do fonte original.
- Até dois programas, contando um que ainda está compilando; o cache não cresce indefinidamente ao trocar motores.
- Consultas de conclusão não bloqueantes via KHR_parallel_shader_compile quando disponível. Sem essa extensão, a consulta final de link ainda pode bloquear em alguns drivers; não há garantia de ausência total de travamento.
- O navegador pode atrasar a primeira imagem de um novo motor enquanto compila. O fade na DLL não espera a web. O preview é aproximado no tempo e pode não mostrar uma transição inteira se a compilação terminar depois dela.
- A consulta aos parâmetros continua independente do preview. Ausência de WebGL não desativa controles.
- O custo total de memória do driver/navegador não pode ser garantido pelos contadores de objetos da aplicação.

Para um diagnóstico textual, no console do navegador execute `souzPreviewDiagnostics()`. Ele mostra estado, motor em preparação, tempo de compilação, número de programas e erro recente; não inclui a chave de acesso.

## Tablet com código curto

1. No painel aberto pelo Resolume no computador, clique **Conectar tablet**. Será gerado um código de seis números.
2. Copie o endereço mostrado e abra no tablet, na mesma rede.
3. Digite os seis números. O código vale cinco minutos, é de uso único e aceita até cinco tentativas.
4. Para outro aparelho, gere novo código. A autorização fica na sessão da aba; ao fechar a aba/navegador ou recriar a instância, poderá ser necessário parear novamente.

A chave longa não precisa ser copiada. Links antigos com chave continuam compatíveis. Nesta versão, o pareamento é manual por endereço + código; o QR Code ainda não foi implementado. Código curto não atravessa bloqueios de firewall ou de Wi-Fi: consulte REDE_TABLET.md.

## Validação

Testes automatizados passaram, incluindo compilação dos 14 shaders especializados, comparação de suas imagens com o shader original, descarte de recursos, falhas simuladas, controles HTTP e pareamento. Não houve teste real no Windows/Edge, no tablet do usuário, nem medição de memória do processo de GPU.

Referências técnicas: https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices e https://registry.khronos.org/webgl/extensions/KHR_parallel_shader_compile/

---

## Histórico (a V07 acima tem prioridade)

# Versão 06 — instruções atuais

Recompile e substitua a DLL para receber o fade no Resolume e o painel atualizado. A numeração no cabeçalho/rodapé deve indicar **06**. O nome em Sources continua **Souz Content-BG**.

## Layout

- Desktop: aproximadamente 2/3 da largura para o preview nativo à esquerda; gerador compacto em cima e cores embaixo na lateral direita.
- Não há rolagem na página nem nos dois blocos de parâmetros. As quatro cores estão nos botões Color 1–4: escolha uma para mostrar seus ajustes HSV. Editar a cor continua ativando a paleta Custom.
- Em telas estreitas, use Preview/Controles para alternar a área visível sem rolar a página. Em telas muito baixas, os dois blocos de parâmetros aparecem lado a lado.
- A janela de ajuda de conexão pode rolar seu próprio texto. Ela é separada da área de operação.
- O layout foi feito com base na descrição, sem a imagem de referência. Zoom elevado ou telas muito pequenas ainda precisam ser avaliados visualmente.

## Transição

Trocar Engine inicia um crossfade de 0,6 segundo. Os dois motores continuam animando durante a passagem. Speed=0 pausa o movimento, mas não o fade. Se houver novas escolhas durante o fade, apenas a última fica pendente e inicia quando o fade em curso termina. Isso limita o processamento a dois motores simultâneos e evita corte na mistura atual.

A transição existe no shader compartilhado pela DLL e pelo WebGL. O tempo do fade é independente da velocidade do motor. O browser conectado usa o estado publicado pela DLL; o modo HTML offline calcula sua própria transição. Em uma instância inativa, o host pode deixar de chamar o processamento: o estado do preview acompanha essa limitação. Não há garantia de correspondência quadro a quadro entre navegador e Resolume.

O preview é nativo e representa somente o gerador. Não captura janelas e não inclui outras camadas da composição. Renderiza até 640 × 360 (proporção adaptada ao host), com limite de aproximadamente 30 FPS para reduzir a carga do tablet. O fade pode aumentar o custo de GPU enquanto calcula dois motores; medir na máquina de apresentação.

## Tablet

Consulte **REDE_TABLET.md**. Use Conectar tablet → Copiar link no computador. O endereço precisa de **IP local + porta + chave**. O Webserver/REST API do Resolume não participa dessa conexão. O servidor da DLL já atende em todas as interfaces IPv4; firewall e isolamento da rede precisam permitir o tráfego. Não há alteração automática do firewall.

## Compilar

Envie os arquivos para o repositório, incluindo `src/EngineFade.h`, `tests/test_fade.cpp` e o workflow existente. Gere a DLL pelo GitHub Actions como antes. Feche o Resolume antes de substituir a DLL. Abra `web/panel.html` para experimentar o layout e o fade offline; para controlar o host, use Abrir painel na DLL V06.

---

## Histórico das versões anteriores (instruções da V06 acima têm prioridade)

# Souz Content — Painel 04

O painel agora controla todos os parâmetros solicitados e mantém a identidade visual da primeira versão.

## Dois blocos

**Gerador e movimento:** Engine, Shape, Palette, Scale, Density, Smoothness, Blur, Speed, Warp, Seed, Rotation e Reverse.

**Cores:** Brightness, Contrast, Saturation, ColorShift, Pulse, Invert e Color 1–4.

- Engine: 14 motores; Shape: 14 formas; Palette: Custom e 31 paletas prontas. São as mesmas opções do código original.
- Reverse e Invert são interruptores.
- Color 1–4 têm seletor de cor e sliders de matiz, saturação e brilho. Editar uma cor ativa Palette = Custom para que ela apareça no visual. Gradient 2 usa Color 1–2; Gradient 3 usa Color 1–3.
- Speed mantém os botões Pausar e Padrão. O valor normalizado 0,35 equivale a 0,49× na curva original de velocidade.
- Os demais sliders mostram valores normalizados de 0 a 1, iguais aos parâmetros do plugin.

## Ver o HTML

Abra `web/panel.html` diretamente no navegador. Ele mostra **Prévia visual · sem conexão com o plugin**. O shader roda no navegador e os controles alteram o preview local, sem alterar o Resolume.

## Usar no Resolume

**É necessário recompilar e substituir a DLL.** A DLL da primeira versão só tinha a API de Speed; trocar somente o HTML não acrescenta os outros parâmetros ao servidor.

1. Envie o conteúdo da pasta `BackgroundGen` para a raiz do seu repositório, incluindo `.github/workflows/build.yml`. A pasta `src` e `CMakeLists.txt` devem estar nessa raiz.
2. Execute `Build FFGL plugin (Windows x64)` no GitHub Actions e baixe `BackgroundGen-win64` quando o fluxo terminar com sucesso.
3. Feche o Resolume, faça backup da DLL antiga e substitua-a pela nova `BackgroundGen.dll` na pasta de efeitos adicionais. Não mantenha duas DLLs com o mesmo ID nessa pasta.
4. Abra o Resolume e carregue `Sources → FFGL → Background Gen`. Deixe o clipe ativo e clique em **Abrir painel** no final dos parâmetros.
5. Teste Engine, Shape, Palette, os sliders e interruptores. Edite uma das quatro cores e confira a ativação de Custom.
6. Mude os valores no Resolume e confira o retorno ao painel. Desative automações dos parâmetros durante o primeiro teste.
7. Expanda a seção de acesso pela rede e copie o link completo do IP apropriado para o celular na mesma rede. O fragmento após `#` contém a chave de acesso.

Compilação local: Visual Studio 2022 com C++, CMake, Git e Python 3; execute `build_windows.bat`. Se sua pasta de efeitos difere da configurada no script, copie a DLL para a pasta definida nas preferências do Resolume.

## Instâncias e sincronização

O nome `Background Gen`, o ID `ABGE`, os índices dos 34 canais originais e o botão OpenPanel no índice 34 foram preservados. Os quatro canais alpha continuam presentes no plugin/API para compatibilidade; o painel não acrescenta um controle de opacidade que o shader original não usa nas cores da paleta.

Cada instância mantém uma porta IPv4 escolhida pelo sistema e uma chave própria. O servidor e a abertura do navegador executam em uma thread separada. A comunicação com os parâmetros usa registros atômicos; o render não executa chamadas de rede nem aguarda o navegador.

Os 34 canais são aplicados no início do processamento do quadro, antes de enviar os uniforms. Mudanças da web geram eventos FFGL para o host. Os getters refletem o estado atual para leitura e persistência. A última escrita em cada parâmetro prevalece, incluindo automações do Resolume. Use Resolume 7.4 ou posterior para eventos de alteração de valor.

O HTML consulta o estado a cada 100 ms após a resposta anterior, agrega movimentos pendentes e mantém apenas uma escrita em andamento. A API valida nomes, tipos e limites antes de aceitar uma requisição. A aplicação de um conjunto de canais é por canal; não há garantia de transação indivisível entre todos os canais em um mesmo quadro.

Ao liberar a instância/Clean do SDK, o servidor fecha clientes, libera a porta e termina sua thread. Reabrir a instância pode mudar porta/chave. Um clipe inativo pode continuar existindo no host; mudanças passam ao visual quando ele voltar a renderizar.

O servidor limita conexões a 24 clientes, cabeçalhos a 8 KiB, corpo a 2 KiB (256 KiB para frames JPEG) e prazo a 2 segundos por conexão. A abertura do navegador usa ShellExecuteW no worker; o encerramento aguarda essa chamada do Windows se ela ainda estiver em curso.

## Rede

Permita o Resolume no firewall apenas na rede privada. Redes de convidados ou isolamento de clientes podem bloquear acesso entre celular e computador. Links de adaptadores VPN também podem aparecer: escolha o IP da rede local usada pelo celular.

O link autoriza acesso à instância. As APIs verificam a chave e rejeitam origem cruzada. HTTP é destinado à rede local confiável, sem encaminhamento da porta para a internet.

## Editar o painel

- Layout e lógica: `web/panel.template.html`.
- Definições originais dos parâmetros: `tools/gen_shader.py`.
- Execute `python tools/embed_panel.py` para gerar `web/panel.html`, `src/PanelSchema.h` e `src/PanelPage.h`.
- O mesmo esquema gera os nomes/limites do servidor e as opções do HTML; não é necessário manter listas duplicadas.
- O HTML é dividido em literais pequenos no header para respeitar os limites do compilador MSVC. O workflow e o script local fazem a geração antes da compilação.

Consulte `VALIDACAO.md` para os testes locais e o que ainda precisa ser confirmado no Windows/Resolume.


## Preview nativo — Painel 04

O canvas WebGL 2 reproduz os mesmos shaders GLSL, engines e paletas do plugin. Nenhuma janela é capturada; não há pedido de compartilhamento de tela. O renderer está em `web/preview.js` e é incorporado ao HTML e à DLL por `tools/embed_panel.py`. Não há dependência de CDN.

O preview fica à esquerda e os controles à direita. Em telas pequenas, fica acima dos controles. O botão Pausar preview pausa somente a imagem local. Speed controla a animação do gerador e do plugin.

A DLL publica animTime, phase, bpm e as dimensões do viewport por valores atômicos. O navegador consulta o estado, interpola brevemente o tempo e aplica imediatamente as alterações locais. Trata-se de uma reprodução sincronizada aproximada: latência de rede, polling, precisão de GPU e resolução reduzida impedem prometer igualdade pixel a pixel ou quadro a quadro. O preview mostra exclusivamente Background Gen, sem outras camadas ou efeitos do Resolume.

Para experimentar sem compilar, abra `web/panel.html`. Para controlar o plugin e receber seu tempo e ritmo reais, recompile e substitua a DLL; abra o painel pelo botão do plugin. No celular, cada navegador renderiza localmente usando os parâmetros da mesma instância.

WebGL 2 é necessário para o preview. Se indisponível, o painel informa a limitação e mantém os controles. A aba oculta suspende desenho; a perda de contexto da GPU é tratada. As rotas antigas de relay permanecem no servidor por compatibilidade, mas este painel não as utiliza.
