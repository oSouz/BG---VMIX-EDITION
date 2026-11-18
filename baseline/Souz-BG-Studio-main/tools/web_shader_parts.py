"""Specialize the WebGL program to ONE engine; share math with the FFGL source."""
import re


def build_parts(tables):
    source = tables['read']('shader/10_engines.glsl')
    functions = {}
    for match in re.finditer(r'^(?:vec[234]|float)\s+(\w+)\([^)]*\)\s*\{', source, re.M):
        depth = 1
        end = match.end()
        while depth:
            if source[end] == '{':
                depth += 1
            if source[end] == '}':
                depth -= 1
            end += 1
        functions[match[1]] = source[match.start():end]
    main = tables['read']('shader/90_main.glsl')
    setup = main[main.index('void main(){'):main.index('    vec3 col = renderEngine(')]
    grade = main[main.index('    // ---- final grade ----'):main.index('    return clamp')]
    header = tables['FRAMEWORK_HEADER'].replace('#version 410 core', '#version 300 es\nprecision highp float;\nprecision highp int;') + tables['uniform_decls']()
    common = tables['read']('shader/00_common.glsl').replace('//@PALETTES@', tables['build_palette_glsl']())
    entries = []
    for i in range(len(tables['ENGINES'])):
        name = 'eng_v%02d' % tables['REMOVED'].get(i, i)  # removed duplicates reuse their twin
        entries.append(functions[name] + '\nuniform float previewOpacity;\n' + setup
                       + '    gNCol = 4;\n    vec3 col = %s;\n' % tables['engine_call'](i)
                       + grade
                       + '    fragColor = vec4(clamp(col,0.0,1.0),previewOpacity);\n}\n')
    return {'common': header + common + '\n\n', 'engines': entries}
