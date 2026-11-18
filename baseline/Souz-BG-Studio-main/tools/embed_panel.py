"""Generate the panel and its C++ schema from the existing parameter source."""
import json
import runpy
from pathlib import Path
root = Path(__file__).resolve().parents[1]
runpy.run_path(str(root/'tools/verify_release.py')) if (root/'release-manifest.json').exists() else None
tables = runpy.run_path(str(root / 'tools/gen_shader.py'))
options = {
    'option_engine': [None if i in tables['REMOVED'] else x[0] for i, x in enumerate(tables['ENGINES'])],  # null = removed id
    'option_mirror': tables['MIRROR_MODES'],
    'option_shape': tables['SHAPES'],
    'option_palette': [x[0] for x in tables['PALETTES']],
    'option_mode': ['Off','Color','Palette'],
}
schema = []
for name, kind, default in tables['PARAMS']:
    if kind == 'color':
        for suffix, value in zip(['', '_saturation', '_brightness', '_alpha'], [*default, 1]):
            schema.append(dict(name=name+suffix, kind='range', default=value, max=1))
    else:
        item = dict(name=name, kind='option' if kind in options else kind, default=float(default), max=len(options[kind])-1 if kind in options else 1)
        if kind in options: item['options'] = options[kind]
        schema.append(item)
header = ['#pragma once', '#include <array>', '#include <cstddef>', 'namespace souz {',
          'struct ParamDef { const char* name; float defaultValue; float maximum; bool discrete; };',
          f'inline constexpr int EngineCount = {len(tables["ENGINES"])};',
          f'inline constexpr size_t ParamCount = {len(schema)};',
          'inline constexpr std::array<ParamDef, ParamCount> ParamDefs = {{']
for d in schema:
    header.append('    {%s, %.6ff, %.6ff, %s},' % (json.dumps(d['name']), d['default'], d['max'], 'true' if d['kind'] in ['bool','option'] else 'false'))
header += ['}};', '}']
(root/'src/PanelSchema.h').write_text('\n'.join(header)+'\n', encoding='utf-8')
template=(root/'web/panel.template.html').read_text(encoding='utf-8')
template=template.replace('{{REVISION}}', (root/'VERSION').read_text().strip())
template=template.replace('{{ENGINE_COUNT}}', str(len(tables['ACTIVE'])))
template=template.replace('/*QR_LIBRARY*/', (root/'web/qrcode.js').read_text(encoding='utf-8'))
template=template.replace('/*NATIVE_RENDERER*/', (root/'web/preview.js').read_text(encoding='utf-8'))
template=template.replace('{{REVISION}}', (root/'VERSION').read_text().strip())
page=template.replace('/*PARAM_SCHEMA*/[]',json.dumps(schema, ensure_ascii=False, separators=(',',':')))
thumbs=json.loads((root/'web/engine-thumbs.json').read_text(encoding='utf-8'))
assert len(thumbs)==len(tables['ENGINES']) and all(t.startswith('data:image/jpeg;base64,') for t in thumbs), 'web/engine-thumbs.json needs one JPEG per engine'
page=page.replace('/*ENGINE_THUMBS*/[]',json.dumps(thumbs))
import base64
for marker, name in [('/*LOGO_DARK*/', 'souz-logo-dark.png'), ('/*LOGO_LIGHT*/', 'souz-logo-light.png')]:
    page=page.replace(marker,'data:image/png;base64,'+base64.b64encode((root/'web'/name).read_bytes()).decode())
page=page.replace('/*ENGINE_CATEGORIES*/[]',json.dumps(tables['CATEGORIES'], ensure_ascii=False))
from web_shader_parts import build_parts
page=page.replace('/*PREVIEW_PARTS*/{}',json.dumps(build_parts(tables),ensure_ascii=False,separators=(',',':')))
(root/'web/panel.html').write_text(page, encoding='utf-8')
assert ')SOUZWEB"' not in page
# MSVC limits individual raw literals. Keep each chunk well below 16 KiB.
chunks=[page[i:i+6000] for i in range(0,len(page),6000)]
code='#pragma once\n#include <string>\nnamespace souz {\ninline constexpr const char* PanelRevision = \"'+(root/'VERSION').read_text().strip()+'\";\ninline std::string BuildPanelPage() {\nstd::string page;\n'
for chunk in chunks: code+='page += R"SOUZWEB('+chunk+')SOUZWEB";\n'
code+='return page;\n}\n}\n'
(root/'src/PanelPage.h').write_text(code, encoding='utf-8')
print(f'Panel generated: {len(schema)} parameter channels; {len(chunks)} HTML chunks')
