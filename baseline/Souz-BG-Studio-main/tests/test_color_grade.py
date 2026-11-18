import sys
from pathlib import Path
import numpy as np
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
import preview as p
base=p.render(40,24)[:,:,:3].astype(float)
black=p.render(40,24,Brightness=0)[:,:,:3];assert black.max()==0
for effect in ['Warp','Pulse']:
 changed=p.render(40,24,**{effect:1})[:,:,:3]
 assert np.max(np.abs(changed.astype(float)-base))>1,effect
names={name for name,_,_ in p.G.PARAMS}
assert names=={'Engine','Scale','Speed','Rotation','Density','Smoothness','Blur','Warp','Reverse','Brightness','Contrast','Saturation','Pulse','TintBlackR','TintBlackG','TintBlackB','TintWhiteR','TintWhiteG','TintWhiteB','PositionX','PositionY','Twist','Ripple','Stretch','Mirror','Vignette','Grain','Posterize'}
print('PASS: remaining effects render and removed controls are absent from generated plugin schema')

red=p.render(40,24,TintBlackR=1,TintBlackG=0,TintBlackB=0,TintWhiteR=1,TintWhiteG=0,TintWhiteB=0)[:,:,:3]
assert red[:,:,0].min()==255 and red[:,:,1:].max()==0
# Position offsets the image (PositionX/Y at the end keeps saved indices) and 0.5 is centered.
names_in_order=[n for n,_,_ in p.G.PARAMS]
assert names_in_order[19:]==['PositionX','PositionY','Twist','Ripple','Stretch','Mirror','Vignette','Grain','Posterize'],'new parameters only at the end'
assert np.array_equal(p.render(40,24,PositionX=.5,PositionY=.5),p.render(40,24))
assert np.max(np.abs(p.render(40,24,PositionX=.8)[:,:,:3].astype(float)-base))>1
assert np.max(np.abs(p.render(40,24,PositionY=.2)[:,:,:3].astype(float)-base))>1
# v1.12 shape controls: neutral defaults change nothing, every control changes the image.
neutral=dict(Twist=.5,Ripple=0,Stretch=.5,Mirror=0,Vignette=0,Grain=0,Posterize=0)
for e in (5,40,90):
    ref=p.render(40,24,Engine=e)
    assert np.array_equal(p.render(40,24,Engine=e,**neutral),ref)
    for k,v in dict(Twist=.9,Ripple=.7,Stretch=.8,Mirror=1,Vignette=.8,Grain=.6,Posterize=.7).items():
        assert np.max(np.abs(p.render(40,24,Engine=e,**{k:v}).astype(float)-ref))>3,(e,k)
for m in range(len(p.G.MIRROR_MODES)):assert np.isfinite(p.render(40,24,Engine=50,Mirror=m)).all()
# Every engine is black and white with the neutral tint; a tint maps the luminance.
for e in p.G.ACTIVE:
    img=p.render(32,18,Engine=e)[:,:,:3].astype(float)
    assert np.abs(img[:,:,0]-img[:,:,2]).max()<=1 and np.abs(img[:,:,1]-img[:,:,2]).max()<=1,e
red=p.render(32,18,Engine=40,TintWhiteG=0,TintWhiteB=0)[:,:,:3].astype(float)
assert red[:,:,0].max()>100 and red[:,:,1:].max()==0
# Removed duplicates keep their id and render the engine they duplicated.
for gone,twin in p.G.REMOVED.items():assert np.array_equal(p.render(32,18,Engine=gone),p.render(32,18,Engine=twin)),gone
print('PASS: position, shape controls (neutral = unchanged), all engines black and white, removed ids alias their twin')
