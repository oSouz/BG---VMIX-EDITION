#include "EngineFade.h"
#include "PanelServer.h"
#include <stdexcept>
void check(bool condition){if(!condition)throw std::runtime_error("fade regression");}
#include <limits>
#include <iostream>
int main(){
 souz::EngineFade f; f.Advance(5,.01f);check(f.from==5&&f.to==5&&f.progress==1);
 f.Advance(3,.06f);check(f.from==5&&f.to==3&&std::abs(f.progress-.1f)<.0001f);
 f.Advance(7,.06f);check(f.from==5&&f.to==3&&std::abs(f.progress-.2f)<.0001f);
 f.Advance(9,.24f);check(f.to==3&&std::abs(f.progress-.6f)<.0001f);
 f.Advance(9,.25f);check(f.from==3&&f.to==9&&f.progress==0);
 for(int i=0;i<10;++i){f.Advance(9,.1f);}
 check(f.to==9&&f.progress==1);
 f.Advance(9,0);check(f.progress==1);
 f.Advance(2,0);check(f.from==9&&f.to==2&&f.progress==0);
 f.Advance(2,std::numeric_limits<float>::quiet_NaN());check(f.progress==0);
 souz::PanelState state;state.PublishFade(9,2,.375f);auto word=state.fade.load();uint32_t bits=uint32_t(word);float progress;std::memcpy(&progress,&bits,4);check(((word>>32)&255)==9&&((word>>40)&255)==2&&progress==.375f);
 // Full-scene TAKE crossfade: duration clamp, independent outgoing clock, smoothstep weight.
 const size_t speed=souz::PanelState::Find("Speed"),reverse=souz::PanelState::Find("Reverse");
 souz::SceneValues from{};from[speed]=.5f;from[reverse]=1;
 souz::SceneFade s;check(!s.active&&s.progress==1);
 s.Start(7,from,10.0,0.01f);check(s.active&&s.generation==7&&s.duration==souz::MinTakeDuration&&s.progress==0);
 s.Start(7,from,10.0,99.f);check(s.duration==souz::MaxTakeDuration);
 s.Start(7,from,10.0,2.f);s.Advance(.1f,speed,reverse);
 check(std::abs(s.progress-.05f)<1e-6f&&std::abs(s.fromTime-(10.0-.1*.5*.5*4))<1e-6);
 s.Advance(5.f,speed,reverse);check(std::abs(s.progress-.175f)<1e-6f); // dt clamped to 0.25 s
 s.Advance(std::numeric_limits<float>::quiet_NaN(),speed,reverse);check(std::abs(s.progress-.175f)<1e-6f);
 for(int i=0;i<20;++i)s.Advance(.25f,speed,reverse);check(!s.active&&s.progress==1);
 check(souz::SceneFade::Weight(0)==0&&souz::SceneFade::Weight(1)==1&&souz::SceneFade::Weight(.5f)==.5f&&souz::SceneFade::Weight(2)==1);
 // Exchange: one queued TAKE at a time, committed once, superseded publications ignored.
 souz::SceneExchange x;souz::SceneRequest r;r.duration=1;r.time=3;r.values[speed]=.9f;
 souz::SceneRequest got;check(x.TryTake(got,from,1)==0);
 check(x.Submit(r)&&!x.Submit(r)&&x.Describe().status==souz::SceneQueued);
 const auto g=x.TryTake(got,from,4.5);check(g&&got.values[speed]==.9f&&got.time==3&&x.TryTake(got,from,1)==0);
 auto v=x.Describe();check(v.status==souz::SceneFading&&v.oldTime==4.5&&v.from[speed]==.5f&&!x.Submit(r));
 check(x.TryPublish(g,.4f,5,false)&&x.Describe().progress==.4f);
 check(x.TryPublish(g+1,.9f,5,true)&&x.Describe().status==souz::SceneFading); // other generation: ignored
 check(x.TryPublish(g,1,6,true)&&x.Describe().status==souz::SceneIdle&&x.Submit(r));
 std::cout<<"PASS fade startup, duration, latest queued engine, paused time, invalid dt and coherent publication\n";
 std::cout<<"PASS scene TAKE: duration clamp, independent outgoing clock, smoothstep, single queue, commit once, stale publications ignored\n";
}
