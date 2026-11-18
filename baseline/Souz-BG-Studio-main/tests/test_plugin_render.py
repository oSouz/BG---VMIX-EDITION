"""Real plugin class in a minimal FFGL host (Mesa EGL): TAKE and engine crossfades.

Builds tests/plugin_render_harness.cpp with the plugin sources and the FFGL SDK,
runs it, and checks every frame against tools/preview.py (same two-pass blend).
Linux only; prints SKIP when the SDK, a compiler or EGL is unavailable.
  python tests/test_plugin_render.py [ffgl-sdk path]
"""
import ctypes.util
import glob
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np

root = Path(__file__).resolve().parents[1]
sdk = Path(sys.argv[1] if len(sys.argv) > 1 else os.environ.get('FFGL_ROOT', root / 'ffgl-sdk'))
if sys.platform != 'linux' or not shutil.which('g++') or not ctypes.util.find_library('EGL') \
        or not (sdk / 'source/lib/ffgl/FFGL.cpp').is_file() or not Path('/usr/include/EGL/egl.h').is_file():
    print('SKIP plugin render: needs Linux, g++, EGL headers/library and the FFGL SDK')
    sys.exit(0)
sys.path.insert(0, str(root / 'tools'))
subprocess.run([sys.executable, str(root / 'tools/gen_shader.py')], check=True, stdout=subprocess.DEVNULL)
import preview  # noqa: E402  (after gen_shader: reads tools/out/full_shader.frag)

with tempfile.TemporaryDirectory() as tmp:
    tmp = Path(tmp)
    sources = [str(p) for d in ('ffgl', 'ffglex', 'ffglquickstart') for p in sorted((sdk / 'source/lib' / d).glob('*.cpp'))]
    flags = ['-O1', '-DGLEW_STATIC', '-DGLEW_EGL', '-DGLEW_NO_GLU', '-I', str(root / 'src'),
             '-I', str(sdk / 'source/lib'), '-I', str(sdk / 'deps/glew-2.1.0/include')]
    subprocess.run(['gcc', '-c', *flags, str(root / 'third_party/glew/glew.c'), '-o', str(tmp / 'glew.o')], check=True)
    exe = tmp / 'harness'
    subprocess.run(['g++', '-std=c++17', '-w', *flags, *sources, str(root / 'src/BackgroundGen.cpp'), str(root / 'src/PanelServer.cpp'),
                    str(root / 'tests/plugin_render_harness.cpp'), str(tmp / 'glew.o'), '-lEGL', '-lGL', '-lpthread', '-o', str(exe)], check=True)
    out = tmp / 'frames'
    out.mkdir()
    env = dict(os.environ, EGL_PLATFORM='surfaceless', LIBGL_ALWAYS_SOFTWARE='1')
    subprocess.run([str(exe), str(out)], check=True, env=env, timeout=600)

    W, H = 96, 54
    frames = [json.loads(line) for line in (out / 'frames.jsonl').read_text().splitlines()]
    fades = 0
    seen_progress = set()
    for f in frames:
        s = f['state']
        actual = np.frombuffer((out / f['file']).read_bytes(), np.uint8).reshape(H, W, 4)[::-1, :, :3].astype(float)
        new = dict(s['to'], t=s['time'], phase=0.0)
        if s['fading']:
            fades += 1
            seen_progress.add(round(s['progress'], 1))
            old = dict(s['from'], t=s['fromTime'], phase=0.0)
            expected = preview.render_crossfade(W, H, old, new, s['progress']).astype(float)
        else:
            expected = preview.render(W, H, **new).astype(float)
        error = np.max(np.abs(actual - expected))
        assert error <= 2, (f['file'], s['fading'], s['progress'], error)
    engines = {round(f['state']['to']['Engine']) for f in frames}
    assert {3, 40, 77} <= engines, engines
    assert fades >= 6 and len(seen_progress) >= 4, (fades, seen_progress)
    assert any(f['state']['fading'] and f['state']['from']['Engine'] == 3 and f['state']['to']['Engine'] == 40 for f in frames), 'TAKE crossfade not observed'
    assert any(f['state']['fading'] and f['state']['from']['Engine'] == 40 and f['state']['to']['Engine'] == 77 for f in frames), 'engine crossfade not observed'
print(f'PASS plugin render: real plugin class, {len(frames)} frames; TAKE (scene, colors, position, clocks) and engine crossfades match the reference within 2/255; GL blend state restored')
