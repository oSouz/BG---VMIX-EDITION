# Souz | BG Studio — vMix Edition

Gerador independente de backgrounds animados para Windows x64. Versão **0.6.0**.

## Instalar e abrir

Baixe o **[instalador Windows da versão 0.6.0](https://github.com/oSouz/BG---VMIX-EDITION/releases/download/v0.6.0/Souz-BG-Studio-vMix-Setup-0.6.0.exe)** ou veja a **[última versão publicada](https://github.com/oSouz/BG---VMIX-EDITION/releases/latest)**.

1. Execute o instalador. Node.js, Python e as bibliotecas gráficas já estão incluídos.
2. Se ainda não tiver NDI, use a opção de instalar o runtime oficial ao terminar. Esse componente pode solicitar permissão de administrador e apresenta seus próprios termos.
3. Abra **Souz BG Studio vMix** no menu Iniciar ou no atalho da área de trabalho, se escolhido.
4. Use o painel para preparar a cena e fazer TAKE. Para transmitir, clique em **Iniciar NDI** na página inicial.
5. Para encerrar o aplicativo e o NDI, use **Encerrar Souz BG Studio** no menu Iniciar. Fechar o navegador não encerra a transmissão.

Também há um ZIP Windows portátil, com os mesmos componentes. Extraia e abra **ABRIR-STUDIO.vbs**. Não é necessário instalar Node.js ou Python manualmente. O runtime oficial NDI continua sendo necessário para transmissão e seu instalador está em `redist/`.

## Recursos

- 97 engines procedurais ativas, com 105 IDs preservados incluindo oito aliases.
- 28 parâmetros, cores, paletas, miniaturas e cenas salvas.
- PVW isolado, PGM compartilhado e TAKE com fade, aguardando preparação das saídas.
- Saída WebGL 2 independente para entradas Navegador em OBS/vMix.
- Emissor NDI com renderização GPU pelos mesmos shaders, até 1920 × 1080; metas de 25/30/50/60 FPS, com taxa real e receptores exibidos no Studio.
- Nome, resolução e FPS NDI, endereço vMix e entrada selecionada persistidos. Nenhuma transmissão ou comando de produção começa automaticamente ao reabrir.
- Ponte HTTP vMix: listar entradas e enviar Preview, Cut e Fade por GUID. TAKE interno e troca de entrada no vMix são operações separadas.

No aplicativo receptor, selecione a fonte NDI **NOME-DO-PC (Souz BG Studio)**. Para Web Browser, copie o endereço completo da saída mostrado no Studio, incluindo o trecho após `#`, e configure 1920 × 1080.

## Instalação e atualização seguras

A instalação é por usuário. Dados ficam em `%LOCALAPPDATA%\Souz\BG-Studio-vMix\data` e não são removidos pela desinstalação. Atualizações preservam presets e configurações. Se a instalação estiver aberta, encerre-a pelo atalho antes de atualizar.

Outra cópia do aplicativo procura a sessão já aberta. Uma versão anterior em uso não é encerrada à força; o iniciador informa quando é necessário fechá-la para aplicar a nova versão. A edição de fontes mantém dados locais em `data/`.

NDI é inicialmente destinado à mesma rede local. O aplicativo não configura firewall nem cria conexão entre redes diferentes. A API de controle do Studio continua restrita ao próprio computador. O vídeo NDI é progressivo e sem áudio.

## Estado da validação

Confirmado pelo usuário: **OBS, Resolume e ProPresenter**. **vMix ainda pendente**.

Testados localmente: regressão HTTP/TAKE/configurações, compilação das 105 variantes nativas, recepção e cores NDI, 1080p30 em ensaio curto na RTX 2060, instalador, runtimes embutidos, atualização protegida e desinstalação com preservação dos dados. Uso prolongado e instalação em Windows limpo ainda precisam de validação. O instalador do Studio não possui assinatura de código.

## Desenvolvimento

Para trabalhar nas fontes, use Node.js 22+ e `npm start`. Para desenvolver o NDI, use Python 3.12 x64, o runtime NDI e `PREPARAR-NDI.bat`. Testes: `npm test`. Integração NDI real: `npm run test:ndi`.

- [Build do instalador e validações](docs/BUILD-WINDOWS.md)
- [Transferência e edição de fontes](docs/TRANSFERIR-PARA-OUTRO-PC.md)
- [Histórico de versões](CHANGELOG.md)

Fontes do runtime em `app/`, iniciadores e build em `tools/`. O material Resolume 1.17.1 original está preservado em `baseline/Souz-BG-Studio-main/`; seu repositório original não foi alterado. Esta edição usa `VERSION` como referência própria.

Node.js, Python, ModernGL, glcontext e o instalador NDI mantêm suas licenças próprias; os avisos e licenças acompanham a distribuição Windows. Nenhuma DLL NDI modificada é incluída.
