# Rede e pareamento — Versão 07

Use **Conectar tablet** no painel do computador, aberto pelo botão da DLL. Copie o endereço e digite no tablet o código de seis números mostrado no computador. Não copie uma chave longa.

O endereço inclui `http://IP_LOCAL:PORTA/`. O código é separado, válido por cinco minutos, de uso único, com até cinco tentativas. Gere outro para um novo aparelho. Credenciais são guardadas na sessão da aba, sem criar conta ou exigir um servidor na internet.

Não é necessário ativar o Webserver/REST API do Resolume: este painel usa o servidor incorporado na DLL. Código curto facilita a autorização, mas não altera o firewall ou o roteador. Se a página não abre, confira IP local, porta, firewall privado do Resolume e isolamento entre clientes Wi-Fi. Se a página abre e pede código, a comunicação HTTP já chegou ao servidor.

Links antigos com `/#chave` continuam aceitos para compatibilidade. As instruções anteriores abaixo sobre copiar a chave foram substituídas pelo pareamento da V07; as orientações de rede continuam válidas.

---

# Tablet na mesma rede — Versão 06

O painel é servido pela DLL dentro do Resolume. O WebGL apenas desenha o preview no navegador; ele não é o servidor de rede. Não é necessário ativar o Webserver/REST API do Resolume para este painel.

1. Recompile a DLL da V06, feche o Resolume e substitua a DLL antiga.
2. Abra o Resolume, carregue **Souz Content-BG** e clique em **Abrir painel**.
3. No painel do computador, clique em **Conectar tablet**. Selecione o endereço IPv4 da placa de rede que está conectada à mesma rede do tablet.
4. Clique em **Copiar link** e envie o texto completo ao tablet. Ele deve conter `http://`, IP, `:porta` e `/#chave`. A chave tem 48 caracteres. Não publique esse link: ele permite controlar esta instância.
5. Cole o link no navegador do tablet. Não substitua `http://` por `https://`. Não use `localhost`, `127.0.0.1` nem o IP público do roteador.
6. Em **Testar conexão**, a mensagem confirma a conexão do aparelho que executou o teste. Um sucesso no PC não comprova que o tablet conseguiu atravessar a rede/firewall.

## Se não abrir nenhuma página

- Confirme que a mesma instância ainda existe no Resolume. O host escolhe uma porta livre; recriar a instância pode mudar porta e chave. Copie o novo link.
- Confira o IPv4 do computador no `ipconfig`. Se houver VPN, Ethernet e Wi-Fi, compare o endereço exibido no painel com a placa usada na rede do tablet.
- No Windows, abra **Segurança do Windows → Firewall e proteção de rede → Permitir um aplicativo pelo firewall**. Permita o executável do Resolume Arena/Avenue para a rede privada confiável. A comunicação pertence ao executável do Resolume, não a um processo separado chamado BackgroundGen.
- Não desligue o firewall. A DLL não altera o firewall ou o perfil da rede automaticamente. Em computadores administrados, pode ser necessário pedir a liberação à equipe de TI.
- Redes de convidados, isolamento de clientes Wi-Fi e VLANs podem impedir a comunicação mesmo quando ambos têm internet. Teste numa rede local que permita comunicação entre dispositivos.
- Usar apenas o IP, sem a porta, costuma abrir outro serviço ou não encontrar servidor algum.

## Se abrir a página mas não controlar

- Abra **Conectar tablet**, cole o link completo (ou a chave após `#`) no campo de acesso e clique em **Conectar**.
- Chaves são diferentes para cada instância. A chave de uma instância não autoriza outra.
- Em caso de perda de rede, o painel tenta reconectar; ao voltar à aba ele tenta novamente. Mudanças feitas no Resolume voltam para os controles.
- Automação/MIDI/OSC do host pode substituir parâmetros enviados pelo painel.

## Se controlar, mas não houver imagem

A rede está funcionando. O preview precisa de WebGL 2 e aceleração gráfica no navegador. Atualize o navegador ou teste outro navegador compatível. Falha de WebGL não desativa os controles. O preview nativo mostra apenas este gerador, não a composição inteira.

## O que foi testado aqui

Requisições autenticadas pela interface IPv4 não loopback do ambiente de teste e sincronização de controles passaram. Isso não testa o firewall, o roteador ou o tablet físico do usuário. Ainda é necessário confirmar nessa rede real.

Referências: https://support.microsoft.com/en-us/windows/security/windows-security/firewall-and-network-protection-in-the-windows-security-app e https://developer.mozilla.org/en-US/docs/Web/API/AbortController
