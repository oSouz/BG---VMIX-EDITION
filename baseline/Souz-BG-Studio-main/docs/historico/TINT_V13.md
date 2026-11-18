# Souz Content V13 — Tint

Abra o painel da DLL. Em Cores → Tint, use Black To para sombras e White To para luzes. Cada aba pode ser recolhida separadamente.

- PICK: arraste no quadrado para saturação/brilho; use a faixa para matiz.
- HSB e RGB: valores numéricos independentes. HEX aceita seis dígitos.
- Palette: 12 cores de acesso rápido. ↺ restaura a cor daquele seletor.
- Padrão cores restaura os ajustes de cor e os dois extremos do Tint.
- Sem Opacity, Blend Mode ou Colorize nesta entrega.

O shader interpola as cores usando a luminância do gerador após os ajustes de brilho/contraste/pulse. Preto e branco são os padrões. Implementação própria, sem código proprietário do Resolume. A reprodução pixel a pixel da referência anterior não foi verificada: o HTML e a captura aprovados não estavam anexados a este ZIP.

Para testar a interface sem DLL: abra web/panel.html no navegador. Para instalar, compile o projeto pelo workflow GitHub Actions incluído e baixe BackgroundGen-win64. O SDK FFGL é baixado pelo workflow; não está incluído no ZIP. Substitua a DLL com o Resolume fechado.

Validação: shader OpenGL executado via Mesa, painel HTTP C++ e sincronização, preview WebGL (ciclo de vida), comparação entre os 24 shaders do preview e o nativo com Tint colorido. A compilação Windows e o teste real no Resolume precisam ser realizados no ambiente de destino.

Compatibilidade: identidade ABGE preservada. Controles V12 nos índices 0–12 e Abrir painel no índice 13. Seis novos canais RGB nos índices 14–19.
