"""Embed the Resolume thumbnail (FFGL CFFGLThumbnailInfo) from a 160x120 PNG.

  python3 tools/gen_plugin_thumb.py [docs/souz-thumbnail.png]

Writes src/Thumbnail.h: one CFFGLColor(0xRRGGBBAA) per pixel, top row first.
The PNG is the editable source; src/Thumbnail.h is committed (the build does not need Pillow).
"""
import sys
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1]) if len(sys.argv) > 1 else root / 'docs/souz-thumbnail.png'
image = Image.open(source).convert('RGBA')
assert image.size == (160, 120), f'{source} must be 160x120, got {image.size}'
pixels = image.tobytes()
cells = ['CFFGLColor(0x%02x%02x%02x%02xu)' % tuple(pixels[i:i + 4]) for i in range(0, len(pixels), 4)]
lines = ['#pragma once', '#include <ffgl/FFGLThumbnailInfo.h>', 'static const CFFGLColor SouzThumbnailPixels[] = {']
lines += [','.join(cells[i:i + 160]) + ',' for i in range(0, len(cells), 160)]
lines += ['};', 'static CFFGLThumbnailInfo SouzThumbnailInfo(160, 120, SouzThumbnailPixels);']
(root / 'src/Thumbnail.h').write_text('\n'.join(lines) + '\n', encoding='utf-8')
print(f'src/Thumbnail.h: 160x120 from {source.name}')
