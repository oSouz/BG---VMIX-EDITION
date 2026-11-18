"""Compile every shared shader on the actual native GPU used by NDI."""
from pathlib import Path
import json
import re
import sys

sys.path.insert(0, str(Path(__file__).parent / 'python-libs'))
import moderngl
from renderer import VERTEX

panel = (Path(__file__).resolve().parents[2] / 'baseline/Souz-BG-Studio-main/web/panel.html').read_text(encoding='utf-8')
parts = json.loads(re.search(r'const PREVIEW_PARTS=(.*);', panel).group(1))
ctx = moderngl.create_standalone_context(require=330)
try:
    for index, engine in enumerate(parts['engines']):
        source = (parts['common']+engine).replace('#version 300 es', '#version 330')
        source = re.sub(r'precision\s+\w+\s+\w+;', '', source)
        program = ctx.program(vertex_shader=VERTEX, fragment_shader=source)
        program.release()
    print(f"PASS: {len(parts['engines'])} native NDI shaders compiled on {ctx.info['GL_RENDERER']}")
finally:
    ctx.release()
