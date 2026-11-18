# Souz BG Studio vMix 0.6.0

Primeira distribuição Windows com instalador e runtimes incluídos.

## Downloads

- **Setup**: instalação por usuário, atalhos e desinstalador. Node.js, Python e as bibliotecas gráficas já acompanham o programa.
- **Windows ZIP**: aplicativo portátil com os mesmos componentes. Extraia e abra ABRIR-STUDIO.vbs.
- **ZIP sem Windows no nome**: código-fonte para desenvolvimento.
- Arquivos `.sha256`: checksums para conferir cada download.

Se NDI ainda não estiver instalado, use a opção do runtime oficial ao terminar a instalação; ela pode solicitar permissão de administrador e possui termos próprios. No ZIP portátil, seu instalador está na pasta redist.

## Incluído

97 engines ativas, 105 IDs preservados, painel com PVW/PGM/TAKE, presets, saída WebGL, emissor NDI GPU e controles HTTP vMix. Nome/resolução/FPS NDI e conexão vMix são salvos. Nada começa a transmitir ou troca entradas da produção automaticamente ao reabrir.

Dados do aplicativo instalado ficam fora da pasta do programa e são preservados na atualização e desinstalação. A atualização pede para encerrar a instalação ativa; outra versão aberta não é interrompida à força.

## Verificado nesta entrega

13 testes de regressão com o Node.js incluído, Python embutido, instalação e desinstalação isoladas, recepção NDI real em 1080p, restauração de configurações e abertura sem Node.js/Python no PATH. Atualização com sessão ativa foi bloqueada e a sessão permaneceu acessível.

O usuário confirmou NDI em OBS, Resolume e ProPresenter. **Teste no vMix, Windows limpo e estabilidade prolongada ainda pendentes.** O instalador do Studio não possui assinatura de código.

O projeto Resolume original não foi alterado. O material de origem foi preservado na pasta baseline deste repositório independente.
