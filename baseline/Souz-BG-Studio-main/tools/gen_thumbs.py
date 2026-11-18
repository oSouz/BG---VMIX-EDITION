#!/usr/bin/env python3
"""Render the engine thumbnails from the real shader (Linux + Mesa) and the static catalog.

  python tools/gen_thumbs.py   ->  web/engine-thumbs.json, docs/CATALOGO.html

Thumbnails use the default parameters and the neutral tint (black and white), like the
plugin with no palette. Removed duplicate ids reuse the thumbnail of the engine they render.
Run after adding or changing engines, then tools/verify_release.py --write and embed_panel.py.
"""
import base64
import html
import io
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import preview  # noqa: E402  (compiles tools/out/full_shader.frag: run gen_shader.py first)
from PIL import Image  # noqa: E402

G = preview.G
thumbs = {}
for i in G.ACTIVE:
    buf = io.BytesIO()
    Image.fromarray(preview.render(160, 90, Engine=i, t=8.0)).save(buf, 'JPEG', quality=82)
    thumbs[i] = 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode()
out = [thumbs[G.REMOVED.get(i, i)] for i in range(len(G.ENGINES))]
with open(os.path.join(G.ROOT, 'web', 'engine-thumbs.json'), 'w', encoding='utf-8', newline='\n') as f:
    f.write(json.dumps(out, indent=0) + '\n')

version = open(os.path.join(G.ROOT, 'VERSION'), encoding='utf-8').read().strip()
parts = ['<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
         '<title>Souz BGEN Studio — Catálogo %s</title>' % version,
         '<style>body{background:#101216;color:#eee;font:15px system-ui;margin:24px}h1{font-size:24px}h2{margin-top:28px}'
         '.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px}'
         'figure{margin:0;background:#20242b;border-radius:10px;overflow:hidden}img{width:100%;display:block}'
         'figcaption{padding:8px 10px}small{color:#a4adb8}</style>',
         '<h1>Souz BGEN Studio · %s</h1><p>%d engines em preto e branco · a cor vem da paleta/tint</p>' % (version, len(G.ACTIVE))]
for c in G.CATEGORIES:
    parts.append('<h2>%s · %d</h2><div class="grid">' % (html.escape(c['name']), len(c['engines'])))
    for i in c['engines']:
        parts.append('<figure><img src="%s" alt=""><figcaption>%s<br><small>#%d</small></figcaption></figure>'
                     % (thumbs[i], html.escape(G.ENGINES[i][0]), i))
    parts.append('</div>')
with open(os.path.join(G.ROOT, 'docs', 'CATALOGO.html'), 'w', encoding='utf-8', newline='\n') as f:
    f.write('\n'.join(parts) + '\n')
print('thumbnails: %d engines (%d ids); wrote web/engine-thumbs.json, docs/CATALOGO.html' % (len(G.ACTIVE), len(out)))
