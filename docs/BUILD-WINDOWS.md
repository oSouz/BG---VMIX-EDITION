# Build Windows x64

Ferramentas de desenvolvimento: Node.js 22+, Python 3.12 x64 e PowerShell. O usuário final não precisa instalá-las; o aplicativo Windows inclui seus próprios runtimes.

1. Execute `powershell -NoProfile -ExecutionPolicy Bypass -File tools/fetch_windows_inputs.ps1`. O script baixa os componentes oficiais listados em `tools/windows-inputs.json`, verifica SHA-256 e prepara Inno Setup 6.4.3 localmente em `build/inno`.
2. Execute `python -m pip install -r app/ndi/requirements.txt --target app/ndi/python-libs`.
3. Execute `npm test`.
4. Execute `python tools/build_windows.py`. O instalador `.exe`, o ZIP portátil Windows e seus checksums são gerados em `dist/`.
5. Opcionalmente, execute `python tools/build_release.py` para gerar o ZIP de fontes.

Não envie `build/`, `dist/`, `data/` ou as bibliotecas Python instaladas para o Git. Distribua os binários como arquivos de uma versão do GitHub.

O manifesto fixa Node.js 22.23.5, Python 3.12.10, Inno Setup 6.4.3 e o instalador oficial NDI baixado. Se a URL NDI passar a entregar outra versão, a verificação bloqueia o build; revise a distribuição oficial e atualize o hash antes de continuar.

Os componentes mantêm suas licenças no pacote. O runtime NDI é distribuído como instalador oficial não modificado e tem licença própria. O compilador Inno Setup 6.4.3 permite uso comercial segundo sua licença. Não há certificado de assinatura de código do projeto configurado; o instalador do Studio não é assinado.

## Dados e atualização

A instalação é por usuário em `%LOCALAPPDATA%\Programs\Souz BG Studio vMix`. Presets, configurações e código de acesso ficam em `%LOCALAPPDATA%\Souz\BG-Studio-vMix\data`, preservados na atualização e na desinstalação. A primeira abertura pode importar os arquivos da edição de fontes previamente registrada, sem sobrescrever dados existentes.

A atualização é bloqueada quando a mesma instalação está em execução. Outra sessão antiga é reutilizada sem interrupção; o iniciador avisa que é preciso encerrá-la para aplicar a versão nova. Versões antigas sem registro precisam ser encerradas pela interface/pasta original.

## Validação realizada

- 13 testes de regressão executados também com o Node.js incluído.
- Importação do renderizador com o Python embutido.
- Instalação isolada, abertura, transmissão e recepção NDI real em 1080p usando os componentes do pacote.
- Reinstalação com Node.js e Python fora do PATH, recuperação da configuração, ausência de início automático do NDI e bloqueio de atualização com sessão ativa.
- Encerramento e desinstalação preservando configurações.

Isso não substitui teste em uma máquina Windows limpa, uso prolongado ou validação no vMix. OBS, Resolume e ProPresenter foram confirmados pelo usuário.
