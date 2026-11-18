"""Compare specialized browser math with the unchanged FFGL shader via Mesa."""
import sys,json,re,ctypes
from pathlib import Path
import numpy as np
root=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root/'tools'))
import preview as p
parts=json.loads(re.search(r'const PREVIEW_PARTS=(.*);',(root/'web/panel.html').read_text()).group(1))
tint=dict(TintBlackR=.12,TintBlackG=.02,TintBlackB=.4,TintWhiteR=1,TintWhiteG=.7,TintWhiteB=.1)
neutral={}
extra=dict(PositionX=.6,PositionY=.42,Rotation=.1,Blur=.35)
count=len(p.G.ENGINES);assert len(parts['engines'])==count
reference=[[p.render(48,27,Engine=i,**t,**extra).astype(float) for t in (tint,neutral)] for i in range(count)]
original_compile=p._compile
for i,body in enumerate(parts['engines']):
    if p._prog:p.gl('glDeleteProgram',None,ctypes.c_uint)(p._prog)
    p._prog=None
    shader=(parts['common']+body).replace('#version 300 es','#version 410 core').encode()
    p._compile=lambda kind,src:original_compile(kind,shader if kind==0x8B30 else src)
    for k,t in enumerate((tint,neutral)):
        actual=p.render(48,27,Engine=i,**t,**extra).astype(float)
        error=np.max(np.abs(actual-reference[i][k]))
        assert error<=2,(i,k,error)
p._compile=original_compile
print(f'PASS: all {count} specialized engine images (custom and neutral tint, offset position) match the FFGL reference within 2/255 per channel')
