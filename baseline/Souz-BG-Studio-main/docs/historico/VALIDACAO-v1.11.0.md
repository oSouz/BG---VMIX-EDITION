# Validação v1.11.0

Ambiente: Linux/Mesa, compilação cruzada MinGW x64. Não executado no Windows/Resolume.

- PASS all 105 animate, have visual contrast and unique outputs
- PASS: 105 WebGL/native images; <=2/255, except documented sparse cell boundaries (8/23) and grain rounding (37/38/41)
- PASS: all 32 specialized GLSL ES shaders compile; each contains exactly one engine
- PASS: both groups, every control, dropdown options, button pulse, reset and removal checks, host sync, rapid writes, disconnect and offline preview
- PASS: HTTP, embedded UI, auth, validation, host updates, two instances, concurrent clients, fragmented requests, deadlines, shutdown and restart
- PASS: authenticated full-scene TAKE, strict validation, delayed commit, source snapshot, duplicate/busy rejection, unlock
- PASS: zero WebGL at startup, bounded cache over 48 changes, asynchronous status, fade blending, background suspend, cleanup, context loss, timeout, link failure and unavailable GPU
- PASS: full-scene GPU crossfade including same-engine colors, scale, position and independent clocks
- PASS: remaining effects render and removed controls are absent from generated plugin schema

DLL PE x64 verificada, export plugMain e dependências padrão do Windows. Identidade ABGE preservada.

Tolerâncias de comparação: <=2/255; engines antigas 8/23 permitem erro esparso nas bordas de células (percentil 99 <=2, média <0,5); novas 37/38/41 permitem até6/255 em grão esparso (percentil 99 <=2, média <0,1).

Todos os nomes das engines e das categorias em inglês. Navegação testada sem alterar o estado ao vivo. Todas as 105 miniaturas foram geradas do shader. A política HTTP permite data: para as miniaturas incorporadas.

As referências foram reinterpretadas proceduralmente. Sem garantia de equivalência visual exata ou desempenho real de GPU no Resolume.
