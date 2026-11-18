"""Render the real desktop shader in EGL; two-pass crossfades match graded endpoint mixtures."""
import sys
from pathlib import Path
import numpy as np
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
import preview
count=len(preview.G.ENGINES)
frames=[preview.render(64,36,Engine=i).astype(float) for i in range(count)]
assert all(np.isfinite(f).all() for f in frames)
# Engine crossfades (classic, Reference Collection, across both) and a full-scene
# TAKE (different engine, colors, position, scale and clock on each side).
scene_a=dict(Engine=13,Scale=.3,TintWhiteG=.5,PositionX=.35,t=4.0)
scene_b=dict(Engine=88,Scale=.7,Rotation=.2,PositionY=.7,Contrast=.8,t=19.0)
pairs=[(dict(Engine=s),dict(Engine=t)) for s,t in [(0,1),(5,6),(13,2),(31,32),(40,77),(104,0)]]+[(scene_a,scene_b)]
for old,new in pairs:
    a=preview.render(64,36,**old).astype(float);b=preview.render(64,36,**new).astype(float)
    assert np.max(np.abs(a-b))>5,(old,new)
    for progress in [0,.25,.5,.75,1]:
        frame=preview.render_crossfade(64,36,old,new,progress).astype(float)
        weight=progress*progress*(3-2*progress)
        error=np.max(np.abs(frame-(a*(1-weight)+b*weight)))
        assert error<=2,(old,new,progress,error)
print(f'PASS: {count} engines render; engine and full-scene crossfades match graded endpoint mixtures at 0/25/50/75/100 percent')
