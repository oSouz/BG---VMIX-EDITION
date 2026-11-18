import {defaults,validate} from './assets.mjs';
export class Studio {
 constructor(now=()=>performance.now()){this.now=now;this.last=now();this.params={...defaults};this.time=0;this.phase=0;this.revision=0;this.scene=null;this.fade=null;}
 speed(p){return p.Speed*p.Speed*4*(p.Reverse>.5?-1:1);}
 advance(){const now=this.now(),dt=Math.max(0,(now-this.last)/1000);this.last=now;this.time+=dt*this.speed(this.params);this.phase=(this.phase+dt*120/240)%1;if(this.scene){this.scene.oldTime+=dt*this.speed(this.scene.from);if(now>=this.scene.end)this.scene=null;}if(this.fade&&now>=this.fade.end)this.fade=null;return now;}
 busy(){return !!(this.scene||this.fade);}
 edit(values){validate(values);this.advance();if(this.busy())throw Object.assign(Error('Transition in progress'),{status:409});if('Engine'in values&&values.Engine!==this.params.Engine)this.fade={from:this.params.Engine,to:values.Engine,start:this.last,end:this.last+600};Object.assign(this.params,values);this.revision++;}
 take(values,duration,time){validate(values,true);if(!Number.isFinite(duration)||duration<.1||duration>10||!Number.isFinite(time)||Math.abs(time)>1e9)throw Error('Invalid TAKE');this.advance();if(this.busy())throw Object.assign(Error('Transition in progress'),{status:409});this.scene={from:{...this.params},oldTime:this.time,start:this.last,end:this.last+duration*1000,duration};this.params={...values};this.time=time;this.revision++;}
 snapshot(){const now=this.advance();return {revision:this.revision,serverTime:now,params:{...this.params},animTime:this.time,phase:this.phase,bpm:120,width:1920,height:1080,fade:this.fade?{from:this.fade.from,to:this.fade.to,progress:(now-this.fade.start)/600,duration:.6}:{from:this.params.Engine,to:this.params.Engine,progress:1,duration:.6},scene:this.scene?{status:3,from:{...this.scene.from},oldTime:this.scene.oldTime,progress:(now-this.scene.start)/(this.scene.end-this.scene.start),duration:this.scene.duration}:{status:0}};}
}
