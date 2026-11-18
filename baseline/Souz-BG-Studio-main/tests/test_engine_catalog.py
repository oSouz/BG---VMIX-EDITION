import sys,itertools
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw
r=Path(__file__).resolve().parents[1];sys.path.insert(0,str(r/'tools'));import preview as p
count=len(p.G.ACTIVE);canvas=Image.new('RGB',(1200,180*((count+3)//4)),'#0b1018');d=ImageDraw.Draw(canvas);frames=[]
for i in p.G.ACTIVE:
 name=p.G.ENGINES[i][0]
 f=p.render(288,162,Engine=i,t=8);later=p.render(96,54,Engine=i,t=18);early=p.render(96,54,Engine=i,t=8)
 motion=np.abs(later[:,:,:3].astype(float)-early[:,:,:3]).mean();assert motion>.05,(name,motion)
 assert f[:,:,:3].std()>2,(name,'flat');assert np.isfinite(f).all()
 frames.append(early[:,:,:3].astype(float));k=len(frames)-1;x=k%4*300;y=k//4*180;canvas.paste(Image.fromarray(f).convert('RGB'),(x+6,y+18));d.text((x+7,y+3),name,fill='#d5efe9')
 print(name,round(motion,2))
def corr(a,b):
 a=a[:,:,0]-a[:,:,0].mean();b=b[:,:,0]-b[:,:,0].mean();n=np.sqrt((a*a).sum()*(b*b).sum());return (a*b).sum()/n if n else 0
late=[p.render(96,54,Engine=i,t=17)[:,:,:3].astype(float) for i in p.G.ACTIVE]
for i,j in itertools.combinations(range(count),2):  # indices into ACTIVE order
 assert np.abs(frames[i]-frames[j]).mean()>.4,(p.G.ACTIVE[i],p.G.ACTIVE[j],'duplicate')
 # Black and white: same structure at two times = duplicate (removed ones scored >= 0.95).
 assert (corr(frames[i],frames[j])+corr(late[i],late[j]))/2<.95,(p.G.ACTIVE[i],p.G.ACTIVE[j],'duplicate structure')
out=r/'validation';out.mkdir(exist_ok=True);canvas.save(out/'engine-overview.jpg',quality=90)
print(f'PASS all {count} animate, have visual contrast and unique outputs')
