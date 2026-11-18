# Instalar em outro PC

1. Extraia o ZIP em uma pasta própria, por exemplo Documentos/Souz BG Studio. Não execute diretamente dentro do ZIP.
2. Instale Node.js 22 ou superior.
3. Abra **INICIAR-STUDIO.bat**. O navegador abre automaticamente; o Studio continua em segundo plano.
4. Para usar somente a saída Navegador, nenhuma preparação NDI é necessária.
5. Para NDI, instale Python **3.12 x64** e o [runtime oficial NDI 6](https://ndi.link/NDIRedistV6). Depois abra **PREPARAR-NDI.bat** uma vez, com internet, e encerre/reabra o Studio.
6. Na página inicial, clique em **Iniciar NDI**. O outro aplicativo deve encontrar a fonte pelo nome do computador e pelo nome escolhido no Studio.

Para encerrar completamente, abra **ENCERRAR-STUDIO.bat**. Fechar uma aba do navegador não encerra o servidor nem a transmissão NDI.

O pacote não inclui presets, códigos de acesso, runtime proprietário NDI ou bibliotecas Python deste computador. Para levar cenas, exporte os backgrounds pelo painel e importe no PC de destino.

Se o Studio não abrir, leia o arquivo `studio-error-3947.log` na pasta do programa. Se houver outra versão aberta, encerre-a primeiro. O endereço padrão é http://127.0.0.1:3947.

O NDI entre computadores deve ser testado inicialmente na mesma rede. O aplicativo não altera firewall nem configura conexão entre redes distintas.

# Conferir o pacote

Opcionalmente, execute `python tools/verify_package.py` depois de extrair o ZIP. Ele confere a integridade dos arquivos distribuídos. Alterações feitas por você após a extração serão apontadas como diferenças.

Esta é uma distribuição de código com iniciadores Windows; ainda exige Node.js e, para NDI, Python e o runtime oficial. Não é um instalador autossuficiente.
