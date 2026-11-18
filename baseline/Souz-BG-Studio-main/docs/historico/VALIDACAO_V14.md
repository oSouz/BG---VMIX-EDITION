# Validação V14

- 32 engines renderizadas em OpenGL 4.1 (Mesa), com contraste, movimento e comparação entre pares.
- 32 shaders GLSL ES compilados; imagens do preview comparadas com o shader FFGL: diferença máxima permitida de 2/255 por canal.
- Transições, Tint, controles, sincronização HTTP, autenticação, múltiplas instâncias e ciclo de vida do preview aprovados nos testes locais.
- Galeria: validation/V14-engine-overview.jpg. A galeria usa o Tint padrão preto/branco para comparar a geometria.
- A DLL Windows não foi compilada nem testada dentro do Resolume neste ambiente. Use o workflow GitHub Actions incluído para compilá-la.
